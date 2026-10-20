// @ts-nocheck

import type { VanApiClientLike } from '../types';
import { VanValidationError } from '../errors';
import { validateIdList, validatePositiveInt, validateWebhookUrl } from '../validation';

/**
 * Export Jobs API endpoints
 * Handles data export job creation and management
 */

// GET /v4/exportJobTypes returns the types available to the API key; 4 = "SavedListExport" is
// the only type available in standard MyCampaign databases.
const DEFAULT_EXPORT_JOB_TYPE = 4;

// Optional dynamic-field id lists accepted by create(): input key -> [body property, id property].
const DYNAMIC_FIELDS = [
  ['surveyQuestionIds', 'surveyQuestions', 'surveyQuestionId'],
  ['activistCodeIds', 'activistCodes', 'activistCodeId'],
  ['customFieldIds', 'customFields', 'customFieldId'],
  ['districtFieldIds', 'districtFields', 'districtFieldId'],
];
const MAX_IDS_PER_FIELD = 5;
const MAX_IDS_TOTAL = 10;

// The server echoes these legacy aliases of exportJobId/exportJobGuid; they're dropped from output.
const LEGACY_ALIASES = ['canvassFileRequestId', 'canvassFileRequestGuid'];

/**
 * Normalize an export job response: drop the canvassFileRequest* aliases and lead with the
 * fields callers care about (exportJobId, status, errorCode when status is Error, downloadUrl).
 * Anything that isn't an export job (e.g. a --dry-run request preview) is returned unchanged.
 */
function formatExportJob(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job) || !('exportJobId' in job)) {
    return job;
  }
  const { exportJobId, status, downloadUrl, errorCode, ...rest } = job;
  for (const alias of LEGACY_ALIASES) delete rest[alias];

  const result = { exportJobId, status };
  if (status === 'Error') result.errorCode = errorCode;
  result.downloadUrl = downloadUrl;
  if (status !== 'Error') result.errorCode = errorCode;
  return { ...result, ...rest };
}

/**
 * Build the POST /exportJobs body from caller input, validating everything the API would
 * otherwise reject. Only known input properties are copied, so output-only properties
 * (exportJobId, status, downloadUrl, ...) are never sent.
 */
function buildCreatePayload(jobData = {}) {
  const payload = {
    savedListId: validatePositiveInt(jobData.savedListId, 'savedListId'),
    type: jobData.type === undefined ? DEFAULT_EXPORT_JOB_TYPE : validatePositiveInt(jobData.type, 'type'),
    webhookUrl: validateWebhookUrl(jobData.webhookUrl, 'webhookUrl'),
  };

  let total = 0;
  for (const [inputKey, bodyKey, idKey] of DYNAMIC_FIELDS) {
    if (jobData[inputKey] === undefined || jobData[inputKey] === null) continue;
    const ids = validateIdList(jobData[inputKey], inputKey, { max: MAX_IDS_PER_FIELD });
    total += ids.length;
    payload[bodyKey] = ids.map(id => ({ [idKey]: id }));
  }

  if (total > MAX_IDS_TOTAL) {
    throw new VanValidationError(
      `At most ${MAX_IDS_TOTAL} ids are allowed in total across surveyQuestionIds, activistCodeIds, customFieldIds and districtFieldIds, got ${total}`
    );
  }

  return payload;
}

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List the export job types allowed for the current API key (paged wrapper, single page)
     * @returns {Promise<Object>} Paged list of { exportJobTypeId, name }
     */
    async listExportJobTypes() {
      return client.get('/exportJobTypes');
    },

    /**
     * Get a specific export job by ID
     * @param {number} exportJobId - The export job ID
     * @returns {Promise<Object>} Export job object
     */
    async get(exportJobId) {
      const id = validatePositiveInt(exportJobId, 'exportJobId');
      return formatExportJob(await client.get(`/exportJobs/${id}`));
    },

    /**
     * Create a new export job. The server runs the export synchronously, so the response
     * normally already has status "Completed" and a downloadUrl.
     * @param {Object} jobData - Export job data
     * @param {number} jobData.savedListId - Saved list ID to export (required)
     * @param {number} jobData.type - Export job type ID from listExportJobTypes() (default: 4 = SavedListExport)
     * @param {string} jobData.webhookUrl - Public HTTPS URL notified on completion (required)
     * @param {string|Array} jobData.surveyQuestionIds - Survey question IDs to include (max 5)
     * @param {string|Array} jobData.activistCodeIds - Activist code IDs to include (max 5)
     * @param {string|Array} jobData.customFieldIds - Contacts custom field IDs to include (max 5)
     * @param {string|Array} jobData.districtFieldIds - District field IDs to include (max 5)
     * @returns {Promise<Object>} Created export job object
     */
    async create(jobData) {
      return formatExportJob(await client.post('/exportJobs', buildCreatePayload(jobData)));
    },
  };
};

export default create;
