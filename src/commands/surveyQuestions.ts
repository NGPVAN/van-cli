// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Survey Questions API endpoints
 * Handles survey questions and response management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List all survey questions
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of survey questions
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get('/surveyQuestions', params);
    },
    
    /**
     * Get a specific survey question by ID
     * @param {number} surveyQuestionId - The survey question ID
     * @returns {Promise<Object>} Survey question object
     */
    async get(surveyQuestionId) {
      return client.get(`/surveyQuestions/${surveyQuestionId}`);
    },
    
    /**
     * Get all survey questions (automatically paginated)
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all survey questions
     */
    async getAll(maxResults = 1000) {
      return client.getAllPaginated('/surveyQuestions', {}, maxResults);
    },
    
    /**
     * Record a survey response for a person
     * @param {number} vanId - Person's VAN ID
     * @param {Object} responseData - Survey response data
     * @param {number} responseData.surveyQuestionId - Survey question ID
     * @param {number} responseData.surveyResponseId - Survey response ID
     * @returns {Promise<Object>} Response
     */
    async recordResponse(vanId, responseData) {
      return client.post(`/people/${vanId}/surveyResponses`, responseData);
    }
  };
};

export default create;