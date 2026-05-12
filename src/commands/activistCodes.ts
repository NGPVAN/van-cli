// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Activist Codes API endpoints
 * Handles activist code management and assignment
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List all activist codes
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of activist codes
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.vanId) {
        return client.get(`/people/${options.vanId}/activistCodes`, params);
      }
      return client.get('/activistCodes', params);
    },
    
    /**
     * Get a specific activist code by ID
     * @param {number} activistCodeId - The activist code ID
     * @returns {Promise<Object>} Activist code object
     */
    async get(activistCodeId) {
      return client.get(`/activistCodes/${activistCodeId}`);
    },
  };
};

export default create;