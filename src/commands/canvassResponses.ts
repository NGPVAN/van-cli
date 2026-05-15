// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Canvass Responses API endpoints
 * Handles canvass response creation and management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * Create a new canvass response
     * @param {Object} responseData - Canvass response data
     * @param {number} responseData.vanId - Person's VAN ID (required)
     * @param {number} responseData.resultCodeId - Result code ID (required)
     * @param {Object} responseData.canvassContext - Canvass context (optional)
     * @returns {Promise<Object>} Created canvass response object
     */
    async create(responseData) {
      const vanId = responseData.vanId;
      if (!vanId) {
        throw new Error('Required field \'vanId\' is missing');
      }
      const body = {
        includeReferenceIdInResponse: true
      };
      if (responseData.resultCodeId !== undefined) body.resultCodeId = responseData.resultCodeId;
      if (responseData.canvassContext !== undefined) body.canvassContext = responseData.canvassContext;

      return client.post(`/people/${vanId}/canvassResponses`, body);
    },
    
    /**
     * Get canvass responses for a specific person
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of canvass responses for the person
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };

      return client.get(`/people/${options.vanId}/canvassResponses`, params);
    },

    async inputTypes() {
      return client.get('/canvassResponses/inputTypes');
    },

    async resultCodes() {
      return client.get('/canvassResponses/resultCodes');
    },

    async contactTypes() {
      return client.get('/canvassResponses/contactTypes');
    },
  };
};

export default create;