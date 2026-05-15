// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Emails API endpoints
 * Handles email campaigns and message management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List batch emails
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of emails
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };

      return client.get('/email/messages', params);
    },
    
    /**
     * Get a specific batch email by its foreign message ID
     * @param {string} foreignMessageId - The foreign message ID
     * @returns {Promise<Object>} Email object
     */
    async get(foreignMessageId) {
      return client.get(`/email/message/${foreignMessageId}`);
    },
  };
};

export default create;