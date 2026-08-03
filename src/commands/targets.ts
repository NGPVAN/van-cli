// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Targets API endpoints
 * Handles target lists and voter universe management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List targets
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.status - Target status filter (Any, Setup, Ready, Active)
     * @param {string} options.type - Target type filter (Static, Dynamic)
     * @param {boolean} options.withSubgroups - Use the expanded targetsWithSubgroups endpoint
     * @returns {Promise<Object>} List of targets
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };

      if (options.status) params.status = options.status;
      if (options.type) params.type = options.type;

      const endpoint = options.withSubgroups ? '/targets/targetsWithSubgroups' : '/targets';
      return client.get(endpoint, params);
    },

    /**
     * Get a specific target by ID
     * @param {number} targetId - The target ID
     * @returns {Promise<Object>} Target object
     */
    async get(targetId) {
      return client.get(`/targets/${targetId}`);
    },

    /**
     * List subgroups
     * @param {Object} options - Optional parameters
     * @param {number} options.targetId - Restrict to subgroups of a specific target
     * @param {boolean} options.minivanFormats - Get subgroups formatted for miniVAN (requires targetId)
     * @returns {Promise<Object>} List of subgroups
     */
    async subgroups(options = {}) {
      if (options.targetId) {
        const endpoint = options.minivanFormats
          ? `/targets/${options.targetId}/subgroupsForMiniVANFormats`
          : `/targets/${options.targetId}/subgroups`;
        return client.get(endpoint);
      }

      return client.get('/targets/subgroups');
    },
  };
};

export default create;