// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Notes API endpoints
 * Handles note creation and management for people
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List notes
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {number} options.vanId - Person VAN ID filter
     * @param {string} options.category - Note category filter
     * @returns {Promise<Object>} List of notes
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.vanId) params.vanId = options.vanId;
      if (options.category) params.category = options.category;
      
      return client.get('/notes', params);
    },
    
    /**
     * Get a specific note by ID
     * @param {number} noteId - The note ID
     * @returns {Promise<Object>} Note object
     */
    async get(noteId) {
      return client.get(`/notes/${noteId}`);
    },
    
    /**
     * Create a new note
     * @param {Object} noteData - Note data
     * @param {number} noteData.vanId - Person's VAN ID (required)
     * @param {string} noteData.text - Note text (required)
     * @param {string} noteData.category - Note category
     * @param {boolean} noteData.isViewRestricted - Whether note is view restricted
     * @returns {Promise<Object>} Created note object
     */
    async create(noteData) {
      const requiredFields = ['vanId', 'text'];
      for (const field of requiredFields) {
        if (!noteData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/notes', noteData);
    },
    
    /**
     * Update a note
     * @param {number} noteId - The note ID
     * @param {Object} noteData - Updated note data
     * @returns {Promise<Object>} Updated note object
     */
    async update(noteId, noteData) {
      return client.put(`/notes/${noteId}`, noteData);
    },
    
    /**
     * Delete a note
     * @param {number} noteId - The note ID
     * @returns {Promise<Object>} Response
     */
    async delete(noteId) {
      return client.delete(`/notes/${noteId}`);
    },
    
    /**
     * Get notes for a specific person
     * @param {number} vanId - Person's VAN ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of notes for the person
     */
    async getByPerson(vanId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/people/${vanId}/notes`, params);
    },
    
    /**
     * Get all notes (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all notes
     */
    async getAll(criteria = {}, maxResults = 10000) {
      return client.getAllPaginated('/notes', criteria, maxResults);
    }
  };
};

export default create;