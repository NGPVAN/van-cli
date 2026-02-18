// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Changed Entity Export Jobs API endpoints
 * Handles export jobs for changed entity tracking
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List changed entity export jobs
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.status - Job status filter
     * @returns {Promise<Object>} List of changed entity export jobs
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.status) params.status = options.status;
      
      return client.get('/changedEntityExportJobs', params);
    },
    
    /**
     * Get a specific changed entity export job by ID
     * @param {number} jobId - The export job ID
     * @returns {Promise<Object>} Changed entity export job object
     */
    async get(jobId) {
      return client.get(`/changedEntityExportJobs/${jobId}`);
    },
    
    /**
     * Create a new changed entity export job
     * @param {Object} jobData - Export job data
     * @param {string} jobData.dateChangedFrom - Start date for changes (required)
     * @param {string} jobData.dateChangedTo - End date for changes
     * @param {Array} jobData.requestedFields - Fields to include in export
     * @param {string} jobData.webhookUrl - Webhook URL for completion notification
     * @returns {Promise<Object>} Created export job object
     */
    async create(jobData) {
      const requiredFields = ['dateChangedFrom'];
      for (const field of requiredFields) {
        if (!jobData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/changedEntityExportJobs', jobData);
    },
    
    /**
     * Get the download URL for a completed export job
     * @param {number} jobId - The export job ID
     * @returns {Promise<Object>} Download information
     */
    async getDownloadUrl(jobId) {
      return client.get(`/changedEntityExportJobs/${jobId}/downloadUrl`);
    },
    
    /**
     * Cancel a changed entity export job
     * @param {number} jobId - The export job ID
     * @returns {Promise<Object>} Response
     */
    async cancel(jobId) {
      return client.post(`/changedEntityExportJobs/${jobId}/cancel`);
    },
    
    /**
     * Get export job status and progress
     * @param {number} jobId - The export job ID
     * @returns {Promise<Object>} Job status information
     */
    async getStatus(jobId) {
      return client.get(`/changedEntityExportJobs/${jobId}/status`);
    },
    
    /**
     * Get all changed entity export jobs (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all export jobs
     */
    async getAll(criteria = {}, maxResults = 1000) {
      return client.getAllPaginated('/changedEntityExportJobs', criteria, maxResults);
    }
  };
};

export default create;