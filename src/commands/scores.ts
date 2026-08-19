// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Scores API endpoints
 * Handles score listing and lookups
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List scores
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of scores
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };

      return client.get('/scores', params);
    },

    /**
     * Get a score by ID
     * @param {number} scoreId - The score ID
     * @returns {Promise<Object>} Score object
     */
    async get(scoreId) {
      return client.get(`/scores/${scoreId}`);
    },

    /**
     * List scores assigned to a person
     * @param {number} vanId - Person's VAN ID
     * @returns {Promise<Object>} Person object with expanded scores
     */
    async getByPerson(vanId) {
      return client.get(`/people/${vanId}`, { $expand: 'scores' });
    }
  };
};

export default create;