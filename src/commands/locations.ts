// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Locations API endpoints
 * Handles location and geographic data management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List locations
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.locationType - Location type filter
     * @param {string} options.state - State filter
     * @returns {Promise<Object>} List of locations
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.locationType) params.locationType = options.locationType;
      if (options.state) params.state = options.state;
      
      return client.get('/locations', params);
    },
    
    /**
     * Get a specific location by ID
     * @param {number} locationId - The location ID
     * @returns {Promise<Object>} Location object
     */
    async get(locationId) {
      return client.get(`/locations/${locationId}`);
    },
    
    /**
     * Find locations by search criteria
     * @param {Object} criteria - Search criteria
     * @param {string} criteria.name - Location name
     * @param {string} criteria.city - City name
     * @param {string} criteria.state - State
     * @param {string} criteria.zip - ZIP code
     * @param {number} criteria.top - Number of results
     * @param {number} criteria.skip - Number of results to skip
     * @returns {Promise<Object>} Search results
     */
    async find(criteria = {}) {
      const params = {
        $top: criteria.top || 50,
        $skip: criteria.skip || 0
      };
      
      if (criteria.name) params.name = criteria.name;
      if (criteria.city) params.city = criteria.city;
      if (criteria.state) params.state = criteria.state;
      if (criteria.zip) params.zip = criteria.zip;
      
      return client.get('/locations', params);
    },
    
    /**
     * Create a new location
     * @param {Object} locationData - Location data
     * @param {string} locationData.name - Location name (required)
     * @param {string} locationData.displayName - Display name
     * @param {Object} locationData.address - Address object
     * @param {string} locationData.locationType - Location type
     * @returns {Promise<Object>} Created location object
     */
    async create(locationData) {
      const requiredFields = ['name'];
      for (const field of requiredFields) {
        if (!locationData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/locations', locationData);
    },
    
    /**
     * Update a location
     * @param {number} locationId - The location ID
     * @param {Object} locationData - Updated location data
     * @returns {Promise<Object>} Updated location object
     */
    async update(locationId, locationData) {
      return client.put(`/locations/${locationId}`, locationData);
    },
    
    /**
     * Get events for a specific location
     * @param {number} locationId - Location ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of events at the location
     */
    async getEvents(locationId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/locations/${locationId}/events`, params);
    },
    
    /**
     * Get all locations (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all locations
     */
    async getAll(criteria = {}, maxResults = 10000) {
      return client.getAllPaginated('/locations', criteria, maxResults);
    }
  };
};

export default create;