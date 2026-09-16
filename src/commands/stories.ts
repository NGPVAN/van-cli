// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Stories API endpoints
 * Handles story collection and management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * Get a specific story by ID
     * @param {number} storyId - The story ID
     * @returns {Promise<Object>} Story object
     */
    async get(storyId) {
      return client.get(`/stories/${storyId}`);
    },

    /**
     * Create a new story
     * @param {Object} storyData - Story data
     * @param {number} storyData.vanId - Person's VAN ID (required)
     * @param {string} storyData.title - Story title (required)
     * @param {string} storyData.storyText - Story text (required)
     * @param {number} storyData.storyStatusId - Story status ID (required)
     * @param {Object[]} storyData.tags - Tag objects to apply; only codeId is required per tag, e.g. [{codeId}]
     * @param {number} storyData.campaignId - Campaign ID
     * @returns {Promise<Object>} Created story object
     */
    async create(storyData) {
      if (!storyData.vanId) {
        throw new Error(`Required field 'vanId' is missing`);
      }
      if (!storyData.title) {
        throw new Error(`Required field 'title' is missing`);
      }
      if (!storyData.storyText) {
        throw new Error(`Required field 'storyText' is missing`);
      }
      if (!storyData.storyStatusId) {
        throw new Error(`Required field 'storyStatusId' is missing`);
      }

      const body = {
        vanId: storyData.vanId,
        title: storyData.title,
        storyText: storyData.storyText,
        storyStatus: { storyStatusId: storyData.storyStatusId },
      };

      if (storyData.tags !== undefined) body.tags = storyData.tags;
      if (storyData.campaignId !== undefined) body.campaignId = storyData.campaignId;

      // The POST response only includes the correct storyId (other fields come back null/zeroed),
      // so a follow-up GET is required to return the actual created entity.
      const created = await client.post('/stories', body);
      if (!created?.storyId) {
        throw new Error('Story creation response did not include a storyId');
      }
      return this.get(created.storyId);
    },
  };
};

export default create;
