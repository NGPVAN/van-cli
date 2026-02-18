// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Contact Types API endpoints
 * Handles contact type definitions and management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List contact types
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of contact types
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get('/contactTypes', params);
    },
    
    /**
     * Get a specific contact type by ID
     * @param {number} contactTypeId - The contact type ID
     * @returns {Promise<Object>} Contact type object
     */
    async get(contactTypeId) {
      return client.get(`/contactTypes/${contactTypeId}`);
    },
    
    /**
     * Get all contact types (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all contact types
     */
    async getAll(criteria = {}, maxResults = 1000) {
      return client.getAllPaginated('/contactTypes', criteria, maxResults);
    }
  };
};

export default create;