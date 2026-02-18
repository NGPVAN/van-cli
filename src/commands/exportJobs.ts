// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Export Jobs API endpoints
 * Handles data export job creation and management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List export jobs
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of export jobs
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get('/exportJobs', params);
    },
    
    /**
     * Get a specific export job by ID
     * @param {number} exportJobId - The export job ID
     * @returns {Promise<Object>} Export job object
     */
    async get(exportJobId) {
      return client.get(`/exportJobs/${exportJobId}`);
    },
    
    /**
     * Create a new export job
     * @param {Object} jobData - Export job data
     * @param {number} jobData.savedListId - Saved list ID to export (required)
     * @param {string} jobData.webhookUrl - Webhook URL for completion notification
     * @param {Array} jobData.fields - Array of field names to include in export
     * @param {string} jobData.format - Export format (csv, tsv, etc.)
     * @returns {Promise<Object>} Created export job object
     */
    async create(jobData) {
      if (!jobData.savedListId) {
        throw new Error("Required field 'savedListId' is missing");
      }
      
      return client.post('/exportJobs', jobData);
    },
    
    /**
     * Get the download URL for a completed export job
     * @param {number} exportJobId - The export job ID
     * @returns {Promise<Object>} Download information
     */
    async getDownloadUrl(exportJobId) {
      return client.get(`/exportJobs/${exportJobId}/downloadUrl`);
    },
    
    /**
     * Get all export jobs (automatically paginated)
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all export jobs
     */
    async getAll(maxResults = 1000) {
      return client.getAllPaginated('/exportJobs', {}, maxResults);
    }
  };
};

export default create;