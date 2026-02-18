// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Scores API endpoints
 * Handles score assignment and management for people
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List scores
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {number} options.scoreId - Score type ID filter
     * @returns {Promise<Object>} List of score types
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.scoreId) params.scoreId = options.scoreId;
      
      return client.get('/scores', params);
    },
    
    /**
     * Get a specific score type by ID
     * @param {number} scoreId - The score type ID
     * @returns {Promise<Object>} Score type object
     */
    async get(scoreId) {
      return client.get(`/scores/${scoreId}`);
    },
    
    /**
     * Get all score types (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all score types
     */
    async getAll(criteria = {}, maxResults = 1000) {
      return client.getAllPaginated('/scores', criteria, maxResults);
    },
    
    /**
     * Apply a score to a person
     * @param {number} vanId - Person's VAN ID
     * @param {number} scoreId - Score type ID
     * @param {number} value - Score value
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response
     */
    async apply(vanId, scoreId, value, options = {}) {
      const data = {
        scoreId: scoreId,
        value: value,
        ...options
      };
      
      return client.post(`/people/${vanId}/scores`, data);
    },
    
    /**
     * Get scores for a specific person
     * @param {number} vanId - Person's VAN ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of scores for the person
     */
    async getByPerson(vanId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/people/${vanId}/scores`, params);
    },
    
    /**
     * Update a person's score
     * @param {number} vanId - Person's VAN ID
     * @param {number} scoreId - Score type ID
     * @param {number} value - New score value
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response
     */
    async update(vanId, scoreId, value, options = {}) {
      const data = {
        value: value,
        ...options
      };
      
      return client.put(`/people/${vanId}/scores/${scoreId}`, data);
    },
    
    /**
     * Remove a score from a person
     * @param {number} vanId - Person's VAN ID
     * @param {number} scoreId - Score type ID
     * @returns {Promise<Object>} Response
     */
    async remove(vanId, scoreId) {
      return client.delete(`/people/${vanId}/scores/${scoreId}`);
    }
  };
};

export default create;