// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Signups API endpoints
 * Handles event signup records and registration management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List signups
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {number} options.eventId - Event ID filter
     * @param {number} options.vanId - Person VAN ID filter
     * @returns {Promise<Object>} List of signups
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.eventId) params.eventId = options.eventId;
      if (options.vanId) params.vanId = options.vanId;
      
      return client.get('/signups', params);
    },
    
    /**
     * Get a specific signup by ID
     * @param {number} signupId - The signup ID
     * @returns {Promise<Object>} Signup object
     */
    async get(signupId) {
      return client.get(`/signups/${signupId}`);
    },
    
    /**
     * Create a new signup
     * @param {Object} signupData - Signup data
     * @param {number} signupData.eventId - Event ID (required)
     * @param {number} signupData.vanId - Person's VAN ID (required)
     * @param {string} signupData.role - Person's role at the event
     * @param {string} signupData.status - Signup status
     * @returns {Promise<Object>} Created signup object
     */
    async create(signupData) {
      const requiredFields = ['eventId', 'vanId'];
      for (const field of requiredFields) {
        if (!signupData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/signups', signupData);
    },
    
    /**
     * Update a signup
     * @param {number} signupId - The signup ID
     * @param {Object} signupData - Updated signup data
     * @returns {Promise<Object>} Updated signup object
     */
    async update(signupId, signupData) {
      return client.put(`/signups/${signupId}`, signupData);
    },
    
    /**
     * Delete a signup
     * @param {number} signupId - The signup ID
     * @returns {Promise<Object>} Response
     */
    async delete(signupId) {
      return client.delete(`/signups/${signupId}`);
    },
    
    /**
     * Get signups for a specific event
     * @param {number} eventId - Event ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of signups for the event
     */
    async getByEvent(eventId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/events/${eventId}/signups`, params);
    },
    
    /**
     * Get signups for a specific person
     * @param {number} vanId - Person's VAN ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of signups for the person
     */
    async getByPerson(vanId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/people/${vanId}/signups`, params);
    },
    
    /**
     * Get all signups (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all signups
     */
    async getAll(criteria = {}, maxResults = 10000) {
      return client.getAllPaginated('/signups', criteria, maxResults);
    }
  };
};

export default create;