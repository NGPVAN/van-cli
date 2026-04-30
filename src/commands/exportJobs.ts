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
     * @param {number} jobData.type - Export job type ID (required by API; use 4 for SavedListExport)
     * @param {string} jobData.webhookUrl - Webhook URL for completion notification (required by API)
     * @param {Array} jobData.districtFieldIds - District fields to include in export
     * @param {Array} jobData.customFieldIds - Custom fields to include in export
     * @returns {Promise<Object>} Created export job object
     */
    async create(jobData) {
      if (!jobData.savedListId) {
        throw new Error("Required field 'savedListId' is missing");
      }

      // The VAN API requires `type` as an integer export job type ID.
      // GET /v4/exportJobTypes returns the available types; 4 = "SavedListExport" is
      // the only type available in standard MyCampaign databases.
      const payload = {
        type: 4,
        ...jobData,
      };

      return client.post('/exportJobs', payload);
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