// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Targets API endpoints
 * Handles target lists and voter universe management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List targets
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.targetType - Target type filter
     * @returns {Promise<Object>} List of targets
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.targetType) params.targetType = options.targetType;
      
      return client.get('/targets', params);
    },
    
    /**
     * Get a specific target by ID
     * @param {number} targetId - The target ID
     * @returns {Promise<Object>} Target object
     */
    async get(targetId) {
      return client.get(`/targets/${targetId}`);
    },
    
    /**
     * Create a new target
     * @param {Object} targetData - Target data
     * @param {string} targetData.name - Target name (required)
     * @param {string} targetData.description - Target description
     * @param {string} targetData.targetType - Target type
     * @returns {Promise<Object>} Created target object
     */
    async create(targetData) {
      const requiredFields = ['name'];
      for (const field of requiredFields) {
        if (!targetData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/targets', targetData);
    },
    
    /**
     * Update a target
     * @param {number} targetId - The target ID
     * @param {Object} targetData - Updated target data
     * @returns {Promise<Object>} Updated target object
     */
    async update(targetId, targetData) {
      return client.put(`/targets/${targetId}`, targetData);
    },
    
    /**
     * Delete a target
     * @param {number} targetId - The target ID
     * @returns {Promise<Object>} Response
     */
    async delete(targetId) {
      return client.delete(`/targets/${targetId}`);
    },
    
    /**
     * Get people in a target
     * @param {number} targetId - Target ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of people in the target
     */
    async getPeople(targetId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/targets/${targetId}/people`, params);
    },
    
    /**
     * Add a person to a target
     * @param {number} targetId - Target ID
     * @param {number} vanId - Person's VAN ID
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response
     */
    async addPerson(targetId, vanId, options = {}) {
      const data = {
        vanId: vanId,
        ...options
      };
      
      return client.post(`/targets/${targetId}/people`, data);
    },
    
    /**
     * Remove a person from a target
     * @param {number} targetId - Target ID
     * @param {number} vanId - Person's VAN ID
     * @returns {Promise<Object>} Response
     */
    async removePerson(targetId, vanId) {
      return client.delete(`/targets/${targetId}/people/${vanId}`);
    },
    
    /**
     * Get all targets (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all targets
     */
    async getAll(criteria = {}, maxResults = 1000) {
      return client.getAllPaginated('/targets', criteria, maxResults);
    }
  };
};

export default create;