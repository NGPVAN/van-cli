// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Codes API endpoints
 * Handles source codes and tags (v4/codes)
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List entity type names supported for codeType=Tag
     * @returns {Promise<string[]>} Supported entity type names
     */
    async supportedEntities() {
      return client.get('/codes/supportedEntities');
    },

    /**
     * List/search codes
     * @param {Object} options - Optional parameters
     * @param {string[]} options.supportedEntities - Filter to codes associated with these entity type names
     * @param {string} options.name - Filter by name
     * @param {number} options.parentCodeId - Filter by parent code ID
     * @param {string} options.entityType - Entity type ID (EntityTypes table)
     * @param {string} options.codeType - Code type filter (SourceCode or Tag)
     * @param {string} options.orderby - OData $orderby expression (supports dateModified)
     * @param {string} options.expand - Comma-separated fields to expand (supports supportedEntities)
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of codes
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };

      if (options.supportedEntities) params.supportedEntities = options.supportedEntities;
      if (options.name) params.name = options.name;
      if (options.parentCodeId) params.parentCodeId = options.parentCodeId;
      if (options.entityType) params.entityType = options.entityType;
      if (options.codeType) params.codeType = options.codeType;
      if (options.orderby) params.$orderby = options.orderby;
      if (options.expand) params.$expand = options.expand;

      return client.get('/codes', params);
    },

    /**
     * Get a specific code by ID
     * @param {number} codeId - The code ID
     * @param {Object} options - Optional parameters
     * @param {string} options.expand - Comma-separated fields to expand
     * @returns {Promise<Object>} Code object
     */
    async get(codeId, options = {}) {
      const params = {};

      if (options.expand) params.$expand = options.expand;

      return client.get(`/codes/${codeId}`, params);
    },

    /**
     * Check whether a code name is already in use
     * @param {string} name - Name to check
     * @param {Object} options - Optional parameters
     * @param {string} options.codeType - Code type to check against (default: SourceCode)
     * @returns {Promise<boolean>} True if the name is already in use
     */
    async isDuplicateName(name, options = {}) {
      const params = { name };

      if (options.codeType) params.codeType = options.codeType;

      return client.get('/codes/isDuplicateName', params);
    },

    /**
     * Create a new code
     * @param {Object} codeData - Code data
     * @param {string} codeData.name - Code name, max 50 chars (required)
     * @param {string} codeData.description - Code description, max 200 chars
     * @param {number} codeData.parentCodeId - Parent code ID (must be an existing code of the same codeType)
     * @param {string} codeData.codeType - Code type (default: SourceCode)
     * @param {Object[]} codeData.supportedEntities - Required when codeType is Tag: [{name, isSearchable, isApplicable}]
     * @param {number} codeData.campaignId - Campaign ID (SourceCode only)
     * @param {number} codeData.contactTypeId - Contact type ID (SourceCode only)
     * @param {number} codeData.revenueStreamId - Revenue stream ID (SourceCode only)
     * @param {number} codeData.mailMergeTemplateId - Mail merge template ID (SourceCode only)
     * @param {number} codeData.generalLedgerFundId - General ledger fund ID (SourceCode only)
     * @param {number} codeData.costCenterId - Cost center ID (SourceCode only)
     * @returns {Promise<Object>} Created code object
     */
    async create(codeData) {
      if (!codeData.name) {
        throw new Error(`Required field 'name' is missing`);
      }

      const body = { name: codeData.name };

      if (codeData.description !== undefined) body.description = codeData.description;
      if (codeData.parentCodeId !== undefined) body.parentCodeId = codeData.parentCodeId;
      if (codeData.codeType !== undefined) body.codeType = codeData.codeType;
      if (codeData.supportedEntities !== undefined) body.supportedEntities = codeData.supportedEntities;
      if (codeData.campaignId !== undefined) body.campaign = { campaignId: codeData.campaignId };
      if (codeData.contactTypeId !== undefined) body.contactType = { contactTypeId: codeData.contactTypeId };
      if (codeData.revenueStreamId !== undefined) body.revenueStream = { revenueStreamId: codeData.revenueStreamId };
      if (codeData.mailMergeTemplateId !== undefined) body.mailMergeTemplate = { mailMergeTemplateId: codeData.mailMergeTemplateId };
      if (codeData.generalLedgerFundId !== undefined) body.generalLedgerFund = { generalLedgerFundId: codeData.generalLedgerFundId };
      if (codeData.costCenterId !== undefined) body.costCenter = { costCenterId: codeData.costCenterId };

      return client.post('/codes', body);
    },

    /**
     * Update a code (fetches existing code then applies specified changes)
     * @param {number} codeId - The code ID
     * @param {Object} codeData - Updated code data
     * @param {string} codeData.name - Code name, max 50 chars
     * @param {number} codeData.parentCodeId - Parent code ID (must be an existing code of the same codeType)
     * @returns {Promise<Object>} Updated code object
     */
    async update(codeId, codeData) {
      const existing = await client.get(`/codes/${codeId}`);

      // Response-only/read-only fields must not be echoed back on the PUT.
      for (const readOnlyProperty of ['createdByName', 'dateCreated', 'dateModified', 'codePath', 'directResponsePlan']) {
        delete existing[readOnlyProperty];
      }

      // The following fields cannot be updated because they are silently ignored by the update API:
      // description, supportedEntities, campaignId, contactTypeId, revenueStreamId,
      // mailMergeTemplateId, generalLedgerFundId, costCenterId, isSourceCodeApplicable
      if (codeData.name !== undefined) existing.name = codeData.name;
      if (codeData.parentCodeId !== undefined) existing.parentCodeId = codeData.parentCodeId;

      existing.codeId = codeId;

      return client.put(`/codes/${codeId}`, existing);
    },

    /**
     * Delete a code
     * @param {number} codeId - The code ID
     * @returns {Promise<string>} Confirmation message
     */
    async delete(codeId) {
      try {
        await client.delete(`/codes/${codeId}`);
        return `Code ${codeId} deleted`;
      } catch (error) {
        throw new Error(`Failed to delete code ${codeId}`, { cause: error });
      }
    },
  };
};

export default create;
