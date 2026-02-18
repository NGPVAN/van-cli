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
    
    /**
     * Get all activist codes (automatically paginated)
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all activist codes
     */
    async getAll(maxResults = 1000) {
      return client.getAllPaginated('/activistCodes', {}, maxResults);
    },
    
    /**
     * Apply an activist code to a person
     * @param {number} vanId - Person's VAN ID
     * @param {number} activistCodeId - Activist code ID
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response
     */
    async apply(vanId, activistCodeId, options = {}) {
      const data = {
        activistCodeId: activistCodeId,
        ...options
      };
      
      return client.post(`/people/${vanId}/activistCodes`, data);
    },
    
    /**
     * Remove an activist code from a person
     * @param {number} vanId - Person's VAN ID
     * @param {number} activistCodeId - Activist code ID
     * @returns {Promise<Object>} Response
     */
    async remove(vanId, activistCodeId) {
      return client.delete(`/people/${vanId}/activistCodes/${activistCodeId}`);
    }
  };
};

export default create;