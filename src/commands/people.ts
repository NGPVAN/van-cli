// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * People API endpoints
 * Handles person records, searching, creation, and management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * Get a person by VAN ID
     * @param {number} vanId - The person's VAN ID
     * @param {Object} options - Optional parameters
     * @param {string} options.$expand - Comma-separated fields to expand
     * @returns {Promise<Object>} Person object
     */
    async get(vanId, options = {}) {
      return client.get(`/people/${vanId}`, options);
    },
    
    /**
     * Find people by search criteria
     * @param {Object} criteria - Search criteria
     * @param {string} criteria.firstName - First name
     * @param {string} criteria.lastName - Last name
     * @param {string} criteria.email - Email address
     * @param {string} criteria.phone - Phone number
     * @param {number} criteria.top - Number of results (max 50)
     * @param {number} criteria.skip - Number of results to skip
     * @param {string} criteria.$expand - Comma-separated fields to expand
     * @returns {Promise<Object>} Search results
     */
    async find(criteria = {}) {
      const params = {
        $top: Math.min(criteria.top || 50, 50), // VAN limits people search to 50
        $skip: criteria.skip || 0
      };
      
      // Add search criteria
      if (criteria.firstName) params.firstName = criteria.firstName;
      if (criteria.lastName) params.lastName = criteria.lastName;
      if (criteria.email) params.email = criteria.email;
      if (criteria.phone) params.phone = criteria.phone;
      if (criteria.$expand) params.$expand = criteria.$expand;
      
      return client.get('/people', params);
    },
    
    /**
     * Find or create a person
     * @param {Object} personData - Person data
     * @param {string} personData.firstName - First name (required)
     * @param {string} personData.lastName - Last name (required)
     * @param {string} personData.email - Email address
     * @param {string} personData.phone - Phone number
     * @param {Object} personData.addresses - Array of address objects
     * @returns {Promise<Object>} Person object (existing or newly created)
     */
    async findOrCreate(personData) {
      const requiredFields = ['firstName', 'lastName'];
      for (const field of requiredFields) {
        if (!personData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/people/findOrCreate', personData);
    },
    
    /**
     * Create a new person
     * @param {Object} personData - Person data
     * @returns {Promise<Object>} Created person object
     */
    async create(personData) {
      return client.post('/people', personData);
    },
    
    /**
     * Update a person
     * @param {number} vanId - The person's VAN ID
     * @param {Object} personData - Updated person data
     * @returns {Promise<Object>} Updated person object
     */
    async update(vanId, personData) {
      return client.put(`/people/${vanId}`, personData);
    },
    
    /**
     * Get all people matching criteria (automatically paginated)
     * @param {Object} criteria - Search criteria
     * @param {number} maxResults - Maximum number of results (default 1000)
     * @returns {Promise<Array>} Array of all matching people
     */
    async getAll(criteria = {}, maxResults = 1000) {
      return client.getAllPaginated('/people', criteria, maxResults);
    }
  };
};

export default create;