// @ts-nocheck

import type { VanApiClientLike } from '../types';
import { VanValidationError } from '../errors';
import { validateBoolean, validateIdList, validateIntRange, validatePositiveInt } from '../validation';

/**
 * Changed Entity Export Jobs API endpoints
 * Exports records of a resource type that changed in a time window, as downloadable CSV files
 */

// VAN rejects a dateChangedFrom..dateChangedTo window longer than this.
const MAX_WINDOW_DAYS = 90;
const MIN_FILE_SIZE_KB = 1000;
const MAX_FILE_SIZE_KB = 100000;
const MAX_EXCLUDED_USER_IDS = 20;

// contactMode accepts the enum name or its number; 3 (PersonOrOrganization) is VAN's default.
const CONTACT_MODES = { Person: 1, Organization: 2, PersonOrOrganization: 3 };

// Optional id-list inputs, all sent under the same property name.
const ID_LIST_FIELDS = ['requestedIds', 'requestedCustomFieldIds', 'requestedActivistCodeIds'];

// YYYY-MM-DD, optionally followed by a time and a Z or +/-hh:mm offset.
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

// Date.parse rolls impossible days over (2026-02-30 becomes March 2), so check the calendar date too.
function isCalendarDate(text: string): boolean {
  const [year, month, day] = text.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateTimestamp(value: unknown, label: string): { value: string; time: number } {
  const text = typeof value === 'string' ? value.trim() : '';
  const time = TIMESTAMP_PATTERN.test(text) && isCalendarDate(text) ? Date.parse(text) : NaN;
  if (Number.isNaN(time)) {
    throw new VanValidationError(
      `${label} must be a date (YYYY-MM-DD) or timestamp (YYYY-MM-DDThh:mm:ssZ or with a +/-hh:mm offset), got: "${value}"`
    );
  }
  return { value: text, time };
}

function validateResourceType(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new VanValidationError('resourceType is required (see: van changed-entity-exports resources)');
  }
  return value.trim();
}

function validateNameList(value: unknown, label: string): string[] {
  const entries = Array.isArray(value) ? value : String(value ?? '').split(',');
  return entries.map((entry) => {
    const name = typeof entry === 'string' ? entry.trim() : '';
    if (name === '') {
      throw new VanValidationError(`${label} must be a list of non-empty field names, got: "${value}"`);
    }
    return name;
  });
}

function validateContactMode(value: unknown): number {
  if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(CONTACT_MODES, value.trim())) {
    return CONTACT_MODES[value.trim()];
  }
  return validateIntRange(value, 'contactMode', 1, 3);
}

/**
 * Build the POST /changedEntityExportJobs body from caller input, validating everything the
 * API would otherwise reject. Only known input properties are copied, so output-only
 * properties (exportJobId, jobStatus, files, ...) are never sent.
 */
function buildCreatePayload(jobData = {}) {
  const from = validateTimestamp(jobData.dateChangedFrom, 'dateChangedFrom');
  const payload = {
    resourceType: validateResourceType(jobData.resourceType),
    dateChangedFrom: from.value,
  };

  // Without dateChangedTo the server picks the end of the window, so the window is only
  // checked here when both ends are given.
  if (jobData.dateChangedTo !== undefined && jobData.dateChangedTo !== null) {
    const to = validateTimestamp(jobData.dateChangedTo, 'dateChangedTo');
    if (to.time <= from.time) {
      throw new VanValidationError('dateChangedTo must be after dateChangedFrom');
    }
    if (to.time > Date.now()) {
      throw new VanValidationError('dateChangedTo must not be in the future');
    }
    if (to.time - from.time > MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      throw new VanValidationError(`dateChangedFrom to dateChangedTo must be a period of ${MAX_WINDOW_DAYS} days or less`);
    }
    payload.dateChangedTo = to.value;
  }

  const has = key => jobData[key] !== undefined && jobData[key] !== null;

  for (const key of ID_LIST_FIELDS) {
    if (has(key)) payload[key] = validateIdList(jobData[key], key);
  }
  if (has('requestedFields')) payload.requestedFields = validateNameList(jobData.requestedFields, 'requestedFields');
  if (has('excludeChangesFromUserIds')) {
    payload.excludeChangesFromUserIds = validateIdList(jobData.excludeChangesFromUserIds, 'excludeChangesFromUserIds', { max: MAX_EXCLUDED_USER_IDS });
  }
  if (has('fileSizeKbLimit')) {
    payload.fileSizeKbLimit = validateIntRange(jobData.fileSizeKbLimit, 'fileSizeKbLimit', MIN_FILE_SIZE_KB, MAX_FILE_SIZE_KB);
  }
  if (has('includeInactive')) payload.includeInactive = validateBoolean(jobData.includeInactive, 'includeInactive');
  if (has('excludeChangesFromSelf')) payload.excludeChangesFromSelf = validateBoolean(jobData.excludeChangesFromSelf, 'excludeChangesFromSelf');
  if (has('contactMode')) payload.contactMode = validateContactMode(jobData.contactMode);
  if (has('savedListId')) payload.savedListId = validatePositiveInt(jobData.savedListId, 'savedListId');

  return payload;
}

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List the resource types available to the current API key (e.g. "Contacts", "Contributions")
     * @returns {Promise<string[]>} Resource type names, for use as resourceType
     */
    async listResources() {
      return client.get('/changedEntityExportJobs/resources');
    },

    /**
     * List the fields a resource type can export. Core fields are always exported; others must
     * be named in requestedFields.
     * @param {string} resourceType - A resource type from listResources()
     * @returns {Promise<Object[]>} Field objects ({ fieldName, fieldType, isCoreField, availableValues, ... })
     */
    async listFields(resourceType) {
      const type = validateResourceType(resourceType);
      return client.get(`/changedEntityExportJobs/fields/${encodeURIComponent(type)}`);
    },

    /**
     * List the change types (e.g. CreatedOrUpdated, Merged) an export of a resource type can report
     * @param {string} resourceType - A resource type from listResources()
     * @returns {Promise<Object[]>} Change type objects ({ ChangeTypeID, ChangeTypeName, Description })
     */
    async listChangeTypes(resourceType) {
      const type = validateResourceType(resourceType);
      return client.get(`/changedEntityExportJobs/changeTypes/${encodeURIComponent(type)}`);
    },

    /**
     * Get a changed entity export job by ID, including its jobStatus and, once Complete, its files
     * @param {number} exportJobId - The export job ID from create()
     * @returns {Promise<Object>} Export job object
     */
    async get(exportJobId) {
      const id = validatePositiveInt(exportJobId, 'exportJobId');
      return client.get(`/changedEntityExportJobs/${id}`);
    },

    /**
     * Create a changed entity export job. The export runs in the background; poll get() until
     * jobStatus is Complete or Error.
     * @param {Object} jobData - Export job data
     * @param {string} jobData.resourceType - Resource type from listResources() (required)
     * @param {string} jobData.dateChangedFrom - Start of the window, date or timestamp (required)
     * @param {string} jobData.dateChangedTo - End of the window, at most 90 days after dateChangedFrom (default: now)
     * @param {string|Array} jobData.requestedIds - Record IDs to export; overrides the window and includeInactive
     * @param {string|Array} jobData.requestedFields - Non-core field names from listFields() to include
     * @param {string|Array} jobData.requestedCustomFieldIds - Custom field IDs to include
     * @param {string|Array} jobData.requestedActivistCodeIds - Activist code IDs to filter by (ContactsActivistCodes only)
     * @param {string|Array} jobData.excludeChangesFromUserIds - Skip changes made by these user IDs (max 20)
     * @param {boolean} jobData.excludeChangesFromSelf - Skip changes made by the requesting API user
     * @param {boolean} jobData.includeInactive - Include inactive records, e.g. deleted contacts
     * @param {number|string} jobData.contactMode - 1/Person, 2/Organization or 3/PersonOrOrganization (default)
     * @param {number} jobData.savedListId - Limit the export to people in this saved list (resource types with a VanID)
     * @param {number} jobData.fileSizeKbLimit - Maximum size of each CSV file in KB, 1000-100000 (default: 40000)
     * @returns {Promise<Object>} The accepted request, with its exportJobId
     */
    async create(jobData) {
      return client.post('/changedEntityExportJobs', buildCreatePayload(jobData));
    },
  };
};

export default create;
