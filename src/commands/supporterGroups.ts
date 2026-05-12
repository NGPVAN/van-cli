// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Supporter Groups API endpoints
 * Handles supporter group management and membership
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List supporter groups
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of supporter groups
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get('/supporterGroups', params);
    },
    
    /**
     * Get a specific supporter group by ID
     * @param {number} supporterGroupId - The supporter group ID
     * @returns {Promise<Object>} Supporter group object
     */
    async get(supporterGroupId) {
      return client.get(`/supporterGroups/${supporterGroupId}`);
    },
    
    /**
     * Create a new supporter group
     * @param {Object} groupData - Supporter group data
     * @param {string} groupData.name - Group name (required)
     * @param {string} groupData.description - Group description
     * @returns {Promise<Object>} Created supporter group object
     */
    async create(groupData) {
      const requiredFields = ['name'];
      for (const field of requiredFields) {
        if (!groupData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/supporterGroups', groupData);
    },
    
    /**
     * Update a supporter group
     * @param {number} supporterGroupId - The supporter group ID
     * @param {Object} groupData - Updated group data
     * @returns {Promise<Object>} Updated supporter group object
     */
    async update(supporterGroupId, groupData) {
      return client.put(`/supporterGroups/${supporterGroupId}`, groupData);
    },
    
    /**
     * Add a person to a supporter group
     * @param {number} supporterGroupId - Supporter group ID
     * @param {number} vanId - Person's VAN ID
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response
     */
    async addPerson(supporterGroupId, vanId, options = {}) {
      const data = {
        vanId: vanId,
        ...options
      };
      
      return client.post(`/supporterGroups/${supporterGroupId}/people`, data);
    },
    
    /**
     * Remove a person from a supporter group
     * @param {number} supporterGroupId - Supporter group ID
     * @returns {Promise<Object>} Response
     */
    async delete(supporterGroupId) {
      return client.delete(`/supporterGroups/${supporterGroupId}`);
    },
    
    /**
     * Get people in a supporter group
     * @param {number} supporterGroupId - Supporter group ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of people in the group
     */
    async getPeople(supporterGroupId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/supporterGroups/${supporterGroupId}/people`, params);
    },
    
    /**
     * Get all supporter groups (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all supporter groups
     */
    async getAll(criteria = {}, maxResults = 1000) {
      return client.getAllPaginated('/supporterGroups', criteria, maxResults);
    }
  };
};

export default create;