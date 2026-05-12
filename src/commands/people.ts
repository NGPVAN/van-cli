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
     * @param {string} criteria.middleName - Middle name
     * @param {string} criteria.streetAddress - Street address
     * @param {string} criteria.city - City
     * @param {string} criteria.stateOrProvince - State/province
     * @param {string} criteria.zipOrPostalCode - ZIP/postal code
     * @param {string} criteria.phoneNumber - Phone number
     * @param {string} criteria.email - Email address
     * @param {string} criteria.commonName - Organization common name
     * @param {string} criteria.officialName - Organization official name
     * @param {string} criteria.contactMode - Person or Organization
     * @param {string} criteria.dateOfBirth - Date of birth (YYYY-MM-DD)
     * @param {string} criteria.employer - Employer name
     * @param {string} criteria.occupation - Occupation
     * @param {number} criteria.top - Number of results (max 50)
     * @param {number} criteria.skip - Number of results to skip
     * @param {string} criteria.$orderby - Sort expression (for example: Name)
     * @param {string} criteria.$expand - Comma-separated fields to expand
     * @returns {Promise<Object>} Search results
     */
    async list(criteria = {}) {
      const params = {
        $top: Math.min(criteria.top || 50, 50), // VAN limits people search to 50
        $skip: criteria.skip || 0
      };

      // Add search criteria
      if (criteria.firstName) params.firstName = criteria.firstName;
      if (criteria.lastName) params.lastName = criteria.lastName;
      if (criteria.middleName) params.middleName = criteria.middleName;
      if (criteria.streetAddress) params.streetAddress = criteria.streetAddress;
      if (criteria.city) params.city = criteria.city;
      if (criteria.stateOrProvince) params.stateOrProvince = criteria.stateOrProvince;
      if (criteria.zipOrPostalCode) params.zipOrPostalCode = criteria.zipOrPostalCode;
      if (criteria.phoneNumber) params.phoneNumber = criteria.phoneNumber;
      if (criteria.phone) params.phoneNumber = criteria.phone; // Backward-compatible alias
      if (criteria.email) params.email = criteria.email;
      if (criteria.dateOfBirth) params.dateOfBirth = criteria.dateOfBirth;
      if (criteria.employer) params.employer = criteria.employer;
      if (criteria.occupation) params.occupation = criteria.occupation;
      if (criteria.commonName) params.commonName = criteria.commonName;
      if (criteria.officialName) params.officialName = criteria.officialName;
      if (criteria.contactMode) params.contactMode = criteria.contactMode;
      if (criteria.$orderby) params.$orderby = criteria.$orderby;
      if (criteria.$expand) params.$expand = criteria.$expand;

      return client.get('/people', params);
    },

    /**
     * Fuzzy name search across people and organizations
     * @param {Object} criteria - Search criteria
     * @param {string} criteria.name - Name string to match
     * @param {number} criteria.top - Number of results (max 50)
     * @param {number} criteria.skip - Number of results to skip
     * @param {string} criteria.$orderby - Sort expression (for example: Name)
     * @param {string} criteria.$expand - Comma-separated fields to expand
     * @returns {Promise<Object>} Search results
     */
    async quickSearch(criteria = {}) {
      const params = {
        name: criteria.name,
        $top: Math.min(criteria.top || 50, 50),
        $skip: criteria.skip || 0
      };

      if (criteria.$orderby) params.$orderby = criteria.$orderby;
      if (criteria.$expand) params.$expand = criteria.$expand;

      return client.get('/people/quickSearch', params);
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
      const requiredFields = ['firstName', 'lastName'];
      for (const field of requiredFields) {
        if (!personData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }

      return client.post('/people/create', personData);
    },
    
    /**
     * Update a person
     * @param {number} vanId - The person's VAN ID
     * @param {Object} personData - Updated person data
     * @returns {Promise<Object>} Updated person object
     */
    async update(vanId, personData) {
      // VAN API docs use POST /people/{vanId} for person updates.
      // PUT is not supported on this endpoint in VAN v4.
      return client.post(`/people/${vanId}`, personData);
    },

    /**
     * Delete a person
     * @param {number} vanId - The person's VAN ID
     * @returns {Promise<Object>} Deletion result
     */
    async delete(vanId) {
      try {
        await client.delete(`/people/${vanId}`);
        return `Person with VanID ${vanId} deleted`;
      } catch (error) {
        throw new Error(`Failed to delete person with VanID ${vanId}`);
      }
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
