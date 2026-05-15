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
  };
};

export default create;