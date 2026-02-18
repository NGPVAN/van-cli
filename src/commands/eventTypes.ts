// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Event Types API endpoints
 * Handles event type definitions and management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List event types
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of event types
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get('/eventTypes', params);
    },
    
    /**
     * Get a specific event type by ID
     * @param {number} eventTypeId - The event type ID
     * @returns {Promise<Object>} Event type object
     */
    async get(eventTypeId) {
      return client.get(`/eventTypes/${eventTypeId}`);
    },
    
    /**
     * Get all event types (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all event types
     */
    async getAll(criteria = {}, maxResults = 1000) {
      return client.getAllPaginated('/eventTypes', criteria, maxResults);
    }
  };
};

export default create;