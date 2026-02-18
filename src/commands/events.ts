// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Events API endpoints
 * Handles event management, signups, and related operations
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List events
     * @param {Object} options - Optional parameters
     * @param {string} options.startDate - Start date filter (YYYY-MM-DD)
     * @param {string} options.endDate - End date filter (YYYY-MM-DD)
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.$expand - Comma-separated fields to expand
     * @returns {Promise<Object>} List of events
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.startDate) params.startDate = options.startDate;
      if (options.endDate) params.endDate = options.endDate;
      if (options.$expand) params.$expand = options.$expand;
      
      return client.get('/events', params);
    },
    
    /**
     * Get a specific event by ID
     * @param {number} eventId - The event ID
     * @param {Object} options - Optional parameters
     * @param {string} options.$expand - Comma-separated fields to expand
     * @returns {Promise<Object>} Event object
     */
    async get(eventId, options = {}) {
      return client.get(`/events/${eventId}`, options);
    },
    
    /**
     * Create a new event
     * @param {Object} eventData - Event data
     * @param {string} eventData.name - Event name (required)
     * @param {string} eventData.startDate - Start date (required)
     * @param {string} eventData.endDate - End date (required)
     * @returns {Promise<Object>} Created event object
     */
    async create(eventData) {
      const requiredFields = ['name', 'startDate', 'endDate'];
      for (const field of requiredFields) {
        if (!eventData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/events', eventData);
    },
    
    /**
     * Update an event
     * @param {number} eventId - The event ID
     * @param {Object} eventData - Updated event data
     * @returns {Promise<Object>} Updated event object
     */
    async update(eventId, eventData) {
      return client.put(`/events/${eventId}`, eventData);
    },
    
    /**
     * Delete an event
     * @param {number} eventId - The event ID
     * @returns {Promise<Object>} Response
     */
    async delete(eventId) {
      return client.delete(`/events/${eventId}`);
    },
    
    /**
     * Get event signups
     * @param {number} eventId - The event ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of signups
     */
    async getSignups(eventId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/events/${eventId}/signups`, params);
    },
    
    /**
     * Get all events (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all events
     */
    async getAll(criteria = {}, maxResults = 1000) {
      return client.getAllPaginated('/events', criteria, maxResults);
    }
  };
};

export default create;