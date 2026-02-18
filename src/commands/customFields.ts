// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Custom Fields API endpoints
 * Handles custom field definitions and values
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List custom fields
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.fieldType - Field type filter
     * @returns {Promise<Object>} List of custom fields
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.fieldType) params.fieldType = options.fieldType;
      
      return client.get('/customFields', params);
    },
    
    /**
     * Get a specific custom field by ID
     * @param {number} customFieldId - The custom field ID
     * @returns {Promise<Object>} Custom field object
     */
    async get(customFieldId) {
      return client.get(`/customFields/${customFieldId}`);
    },
    
    /**
     * Get all custom fields (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all custom fields
     */
    async getAll(criteria = {}, maxResults = 1000) {
      return client.getAllPaginated('/customFields', criteria, maxResults);
    },
    
    /**
     * Set a custom field value for a person
     * @param {number} vanId - Person's VAN ID
     * @param {number} customFieldId - Custom field ID
     * @param {*} value - Field value
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response
     */
    async setValue(vanId, customFieldId, value, options = {}) {
      const data = {
        customFieldId: customFieldId,
        assignedValue: value,
        ...options
      };
      
      return client.post(`/people/${vanId}/customFields`, data);
    },
    
    /**
     * Get custom field values for a specific person
     * @param {number} vanId - Person's VAN ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of custom field values for the person
     */
    async getByPerson(vanId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/people/${vanId}/customFields`, params);
    },
    
    /**
     * Update a custom field value for a person
     * @param {number} vanId - Person's VAN ID
     * @param {number} customFieldId - Custom field ID
     * @param {*} value - New field value
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response
     */
    async updateValue(vanId, customFieldId, value, options = {}) {
      const data = {
        assignedValue: value,
        ...options
      };
      
      return client.put(`/people/${vanId}/customFields/${customFieldId}`, data);
    },
    
    /**
     * Remove a custom field value from a person
     * @param {number} vanId - Person's VAN ID
     * @param {number} customFieldId - Custom field ID
     * @returns {Promise<Object>} Response
     */
    async removeValue(vanId, customFieldId) {
      return client.delete(`/people/${vanId}/customFields/${customFieldId}`);
    }
  };
};

export default create;