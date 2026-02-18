// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Canvass Responses API endpoints
 * Handles canvass response creation and management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List canvass responses
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.startDate - Start date filter
     * @param {string} options.endDate - End date filter
     * @returns {Promise<Object>} List of canvass responses
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.startDate) params.startDate = options.startDate;
      if (options.endDate) params.endDate = options.endDate;
      
      return client.get('/canvassResponses', params);
    },
    
    /**
     * Get a specific canvass response by ID
     * @param {number} canvassResponseId - The canvass response ID
     * @returns {Promise<Object>} Canvass response object
     */
    async get(canvassResponseId) {
      return client.get(`/canvassResponses/${canvassResponseId}`);
    },
    
    /**
     * Create a new canvass response
     * @param {Object} responseData - Canvass response data
     * @param {number} responseData.vanId - Person's VAN ID (required)
     * @param {number} responseData.resultCodeId - Result code ID (required)
     * @param {string} responseData.canvassContext - Canvass context
     * @param {string} responseData.contactTypeId - Contact type ID
     * @param {Array} responseData.responses - Array of survey responses
     * @returns {Promise<Object>} Created canvass response object
     */
    async create(responseData) {
      const requiredFields = ['vanId', 'resultCodeId'];
      for (const field of requiredFields) {
        if (!responseData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/canvassResponses', responseData);
    },
    
    /**
     * Get canvass responses for a specific person
     * @param {number} vanId - Person's VAN ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of canvass responses for the person
     */
    async getByPerson(vanId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/people/${vanId}/canvassResponses`, params);
    },
    
    /**
     * Get all canvass responses (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all canvass responses
     */
    async getAll(criteria = {}, maxResults = 10000) {
      return client.getAllPaginated('/canvassResponses', criteria, maxResults);
    }
  };
};

export default create;