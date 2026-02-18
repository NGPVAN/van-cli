// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Saved Lists API endpoints
 * Handles saved list management and operations
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List saved lists
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results (max 100 for saved lists)
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.$expand - Comma-separated fields to expand
     * @returns {Promise<Object>} List of saved lists
     */
    async list(options = {}) {
      const params = {
        $top: Math.min(options.top || 50, 100), // VAN limits saved lists to 100
        $skip: options.skip || 0
      };
      
      if (options.$expand) params.$expand = options.$expand;
      
      return client.get('/savedLists', params);
    },
    
    /**
     * Get a specific saved list by ID
     * @param {number} savedListId - The saved list ID
     * @param {Object} options - Optional parameters
     * @param {string} options.$expand - Comma-separated fields to expand
     * @returns {Promise<Object>} Saved list object
     */
    async get(savedListId, options = {}) {
      return client.get(`/savedLists/${savedListId}`, options);
    },
    
    /**
     * Create a new saved list
     * @param {Object} listData - Saved list data
     * @param {string} listData.name - List name (required)
     * @param {string} listData.description - List description
     * @returns {Promise<Object>} Created saved list object
     */
    async create(listData) {
      if (!listData.name) {
        throw new Error("Required field 'name' is missing");
      }
      
      return client.post('/savedLists', listData);
    },
    
    /**
     * Update a saved list
     * @param {number} savedListId - The saved list ID
     * @param {Object} listData - Updated list data
     * @returns {Promise<Object>} Updated saved list object
     */
    async update(savedListId, listData) {
      return client.put(`/savedLists/${savedListId}`, listData);
    },
    
    /**
     * Delete a saved list
     * @param {number} savedListId - The saved list ID
     * @returns {Promise<Object>} Response
     */
    async delete(savedListId) {
      return client.delete(`/savedLists/${savedListId}`);
    },
    
    /**
     * Get people in a saved list
     * @param {number} savedListId - The saved list ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.$expand - Comma-separated fields to expand
     * @returns {Promise<Object>} List of people in the saved list
     */
    async getPeople(savedListId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.$expand) params.$expand = options.$expand;
      
      return client.get(`/savedLists/${savedListId}/people`, params);
    },
    
    /**
     * Add a person to a saved list
     * @param {number} savedListId - The saved list ID
     * @param {number} vanId - Person's VAN ID
     * @returns {Promise<Object>} Response
     */
    async addPerson(savedListId, vanId) {
      return client.post(`/savedLists/${savedListId}/people/${vanId}`, {});
    },
    
    /**
     * Remove a person from a saved list
     * @param {number} savedListId - The saved list ID
     * @param {number} vanId - Person's VAN ID
     * @returns {Promise<Object>} Response
     */
    async removePerson(savedListId, vanId) {
      return client.delete(`/savedLists/${savedListId}/people/${vanId}`);
    },
    
    /**
     * Get all saved lists (automatically paginated)
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all saved lists
     */
    async getAll(maxResults = 1000) {
      return client.getAllPaginated('/savedLists', {}, maxResults);
    }
  };
};

export default create;