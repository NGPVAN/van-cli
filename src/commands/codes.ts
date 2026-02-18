// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Codes API endpoints
 * Handles various code types (result codes, contact types, etc.)
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * Generic list method (defaults to result codes)
     * @param {Object} options - Optional parameters
     * @returns {Promise<Object>} List of result codes
     */
    async list(options = {}) {
      return this.listResultCodes(options);
    },
    /**
     * List result codes
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of result codes
     */
    async listResultCodes(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get('/codes/resultCodes', params);
    },
    
    /**
     * Get a specific result code by ID
     * @param {number} resultCodeId - The result code ID
     * @returns {Promise<Object>} Result code object
     */
    async getResultCode(resultCodeId) {
      return client.get(`/codes/resultCodes/${resultCodeId}`);
    },
    
    /**
     * List contact types
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of contact types
     */
    async listContactTypes(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get('/codes/contactTypes', params);
    },
    
    /**
     * Get a specific contact type by ID
     * @param {number} contactTypeId - The contact type ID
     * @returns {Promise<Object>} Contact type object
     */
    async getContactType(contactTypeId) {
      return client.get(`/codes/contactTypes/${contactTypeId}`);
    },
    
    /**
     * List input types
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of input types
     */
    async listInputTypes(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get('/codes/inputTypes', params);
    },
    
    /**
     * Get a specific input type by ID
     * @param {number} inputTypeId - The input type ID
     * @returns {Promise<Object>} Input type object
     */
    async getInputType(inputTypeId) {
      return client.get(`/codes/inputTypes/${inputTypeId}`);
    },
    
    /**
     * List supporter groups
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of supporter groups
     */
    async listSupporterGroups(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get('/codes/supporterGroups', params);
    },
    
    /**
     * Get a specific supporter group by ID
     * @param {number} supporterGroupId - The supporter group ID
     * @returns {Promise<Object>} Supporter group object
     */
    async getSupporterGroup(supporterGroupId) {
      return client.get(`/codes/supporterGroups/${supporterGroupId}`);
    },
    
    /**
     * Get all result codes (automatically paginated)
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all result codes
     */
    async getAllResultCodes(maxResults = 1000) {
      return client.getAllPaginated('/codes/resultCodes', {}, maxResults);
    },
    
    /**
     * Get all contact types (automatically paginated)
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all contact types
     */
    async getAllContactTypes(maxResults = 1000) {
      return client.getAllPaginated('/codes/contactTypes', {}, maxResults);
    }
  };
};

export default create;