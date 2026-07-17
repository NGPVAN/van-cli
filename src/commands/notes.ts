// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Notes API endpoints
 * Handles note creation and management for people
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List notes for a person
     * @param {number} vanId - Person's VAN ID (required)
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of notes for the person
     */
    async list(vanId, options = {}) {
      if (!vanId) {
        throw new Error('Required field \'vanId\' is missing');
      }

      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };

      return client.get(`/people/${vanId}/notes`, params);
    },

    /**
     * Get a specific note by ID
     * @param {number} vanId - Person's VAN ID (required)
     * @param {number} noteId - The note ID (required)
     * @returns {Promise<Object>} Note object
     */
    async get(vanId, noteId) {
      if (!vanId) {
        throw new Error('Required field \'vanId\' is missing');
      }
      if (!noteId) {
        throw new Error('Required field \'noteId\' is missing');
      }

      return client.get(`/people/${vanId}/notes/${noteId}`);
    },

    /**
     * Create a new note for a person
     * @param {number} vanId - Person's VAN ID (required)
     * @param {Object} noteData - Note data
     * @param {string} noteData.text - Note text (required)
     * @param {number} noteData.noteCategoryId - Note category ID (optional)
     * @returns {Promise<Object>} Created note object
     */
    async create(vanId, noteData = {}) {
      if (!vanId) {
        throw new Error('Required field \'vanId\' is missing');
      }
      if (!noteData.text) {
        throw new Error('Required field \'text\' is missing');
      }

      const body = { text: noteData.text };
      if (noteData.noteCategoryId !== undefined) {
        body.category = { noteCategoryId: noteData.noteCategoryId };
      }

      await client.post(`/people/${vanId}/notes`, body);
      return `Note created for VanID ${vanId}`;
    },

    /**
     * Update a note for a person
     * @param {number} vanId - Person's VAN ID (required)
     * @param {number} noteId - The note ID (required)
     * @param {Object} noteData - Updated note data
     * @param {string} noteData.text - Note text (optional)
     * @param {number} noteData.noteCategoryId - Note category ID (optional)
     * @returns {Promise<Object>} Updated note object
     */
    async update(vanId, noteId, noteData = {}) {
      if (!vanId) {
        throw new Error('Required field \'vanId\' is missing');
      }
      if (!noteId) {
        throw new Error('Required field \'noteId\' is missing');
      }
      if (noteData.text === undefined && noteData.noteCategoryId === undefined) {
        throw new Error('At least one of \'text\' or \'noteCategoryId\' is required');
      }

      const body = {};
      if (noteData.text !== undefined) body.text = noteData.text;
      if (noteData.noteCategoryId !== undefined) {
        body.category = { noteCategoryId: noteData.noteCategoryId };
      }

      const response = await client.put(`/people/${vanId}/notes/${noteId}`, body);
      return (response !== null) ? response : this.get(vanId, noteId);
    },

    /**
     * Delete a note for a person
     * @param {number} vanId - Person's VAN ID (required)
     * @param {number} noteId - The note ID (required)
     * @returns {Promise<Object>} Response
     */
    async delete(vanId, noteId) {
      if (!vanId) {
        throw new Error('Required field \'vanId\' is missing');
      }
      if (!noteId) {
        throw new Error('Required field \'noteId\' is missing');
      }

      try {
        await client.delete(`/people/${vanId}/notes/${noteId}`);
        return `Note ${noteId} deleted`;
      } catch (error) {
        throw new Error(`Failed to delete noteId ${noteId}`, { cause: error });
      }
    },

    async categories() {
      return client.get('/notes/categories');
    }
  };
};

export default create;
