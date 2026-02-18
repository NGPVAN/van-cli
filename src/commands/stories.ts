// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Stories API endpoints
 * Handles story collection and management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List stories
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {number} options.vanId - Person VAN ID filter
     * @param {string} options.storyType - Story type filter
     * @returns {Promise<Object>} List of stories
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.vanId) params.vanId = options.vanId;
      if (options.storyType) params.storyType = options.storyType;
      
      return client.get('/stories', params);
    },
    
    /**
     * Get a specific story by ID
     * @param {number} storyId - The story ID
     * @returns {Promise<Object>} Story object
     */
    async get(storyId) {
      return client.get(`/stories/${storyId}`);
    },
    
    /**
     * Create a new story
     * @param {Object} storyData - Story data
     * @param {number} storyData.vanId - Person's VAN ID (required)
     * @param {string} storyData.text - Story text (required)
     * @param {string} storyData.storyType - Story type
     * @param {string} storyData.title - Story title
     * @returns {Promise<Object>} Created story object
     */
    async create(storyData) {
      const requiredFields = ['vanId', 'text'];
      for (const field of requiredFields) {
        if (!storyData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/stories', storyData);
    },
    
    /**
     * Update a story
     * @param {number} storyId - The story ID
     * @param {Object} storyData - Updated story data
     * @returns {Promise<Object>} Updated story object
     */
    async update(storyId, storyData) {
      return client.put(`/stories/${storyId}`, storyData);
    },
    
    /**
     * Delete a story
     * @param {number} storyId - The story ID
     * @returns {Promise<Object>} Response
     */
    async delete(storyId) {
      return client.delete(`/stories/${storyId}`);
    },
    
    /**
     * Get stories for a specific person
     * @param {number} vanId - Person's VAN ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of stories for the person
     */
    async getByPerson(vanId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/people/${vanId}/stories`, params);
    },
    
    /**
     * Get all stories (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all stories
     */
    async getAll(criteria = {}, maxResults = 10000) {
      return client.getAllPaginated('/stories', criteria, maxResults);
    }
  };
};

export default create;