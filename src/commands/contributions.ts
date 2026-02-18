// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Contributions API endpoints
 * Handles contribution records and financial data
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List contributions
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.startDate - Start date filter (YYYY-MM-DD)
     * @param {string} options.endDate - End date filter (YYYY-MM-DD)
     * @param {number} options.vanId - Person VAN ID filter
     * @returns {Promise<Object>} List of contributions
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.startDate) params.startDate = options.startDate;
      if (options.endDate) params.endDate = options.endDate;
      if (options.vanId) params.vanId = options.vanId;
      
      return client.get('/contributions', params);
    },
    
    /**
     * Get a specific contribution by ID
     * @param {number} contributionId - The contribution ID
     * @returns {Promise<Object>} Contribution object
     */
    async get(contributionId) {
      return client.get(`/contributions/${contributionId}`);
    },
    
    /**
     * Create a new contribution record
     * @param {Object} contributionData - Contribution data
     * @param {number} contributionData.vanId - Person's VAN ID (required)
     * @param {number} contributionData.amount - Contribution amount (required)
     * @param {string} contributionData.dateReceived - Date received (required)
     * @param {string} contributionData.contributionType - Type of contribution
     * @returns {Promise<Object>} Created contribution object
     */
    async create(contributionData) {
      const requiredFields = ['vanId', 'amount', 'dateReceived'];
      for (const field of requiredFields) {
        if (!contributionData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/contributions', contributionData);
    },
    
    /**
     * Update a contribution
     * @param {number} contributionId - The contribution ID
     * @param {Object} contributionData - Updated contribution data
     * @returns {Promise<Object>} Updated contribution object
     */
    async update(contributionId, contributionData) {
      return client.put(`/contributions/${contributionId}`, contributionData);
    },
    
    /**
     * Get contributions for a specific person
     * @param {number} vanId - Person's VAN ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of contributions for the person
     */
    async getByPerson(vanId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/people/${vanId}/contributions`, params);
    },
    
    /**
     * Get all contributions (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all contributions
     */
    async getAll(criteria = {}, maxResults = 10000) {
      return client.getAllPaginated('/contributions', criteria, maxResults);
    }
  };
};

export default create;