// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Bulk Import API endpoints
 * Handles bulk data import operations
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * Generic list method (defaults to listing jobs)
     * @param {Object} options - Optional parameters
     * @returns {Promise<Object>} List of bulk import jobs
     */
    async list(options = {}) {
      return this.listJobs(options);
    },
    /**
     * List bulk import jobs
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.status - Job status filter
     * @returns {Promise<Object>} List of bulk import jobs
     */
    async listJobs(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.status) params.status = options.status;
      
      return client.get('/bulkImportJobs', params);
    },
    
    /**
     * Get a specific bulk import job by ID
     * @param {number} jobId - The bulk import job ID
     * @returns {Promise<Object>} Bulk import job object
     */
    async getJob(jobId) {
      return client.get(`/bulkImportJobs/${jobId}`);
    },
    
    /**
     * Create a new bulk import job
     * @param {Object} jobData - Import job data
     * @param {string} jobData.name - Job name (required)
     * @param {string} jobData.description - Job description
     * @param {string} jobData.importType - Type of import (required)
     * @param {Object} jobData.mappings - Field mappings (required)
     * @returns {Promise<Object>} Created bulk import job object
     */
    async createJob(jobData) {
      const requiredFields = ['name', 'importType', 'mappings'];
      for (const field of requiredFields) {
        if (!jobData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/bulkImportJobs', jobData);
    },
    
    /**
     * Upload data for a bulk import job
     * @param {number} jobId - The bulk import job ID
     * @param {Buffer|string} fileData - File data to upload
     * @param {Object} options - Upload options
     * @param {string} options.filename - Original filename
     * @param {string} options.contentType - Content type
     * @returns {Promise<Object>} Upload response
     */
    async uploadData(jobId, fileData, options = {}) {
      // For file uploads, we would typically use form-data
      // This is a simplified implementation
      return client.post(`/bulkImportJobs/${jobId}/upload`, {
        data: fileData.toString('base64'),
        filename: options.filename || 'upload.csv',
        contentType: options.contentType || 'text/csv'
      });
    },
    
    /**
     * Start processing a bulk import job
     * @param {number} jobId - The bulk import job ID
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Response
     */
    async startJob(jobId, options = {}) {
      return client.post(`/bulkImportJobs/${jobId}/start`, options);
    },
    
    /**
     * Cancel a bulk import job
     * @param {number} jobId - The bulk import job ID
     * @returns {Promise<Object>} Response
     */
    async cancelJob(jobId) {
      return client.post(`/bulkImportJobs/${jobId}/cancel`);
    },
    
    /**
     * Get bulk import job results
     * @param {number} jobId - The bulk import job ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} Import results
     */
    async getJobResults(jobId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/bulkImportJobs/${jobId}/results`, params);
    },
    
    /**
     * Get bulk import job errors
     * @param {number} jobId - The bulk import job ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} Import errors
     */
    async getJobErrors(jobId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/bulkImportJobs/${jobId}/errors`, params);
    },
    
    /**
     * Get all bulk import jobs (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all bulk import jobs
     */
    async getAllJobs(criteria = {}, maxResults = 1000) {
      return client.getAllPaginated('/bulkImportJobs', criteria, maxResults);
    }
  };
};

export default create;