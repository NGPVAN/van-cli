// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Emails API endpoints
 * Handles email campaigns and message management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List emails
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.status - Email status filter
     * @param {string} options.startDate - Start date filter (YYYY-MM-DD)
     * @param {string} options.endDate - End date filter (YYYY-MM-DD)
     * @returns {Promise<Object>} List of emails
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.status) params.status = options.status;
      if (options.startDate) params.startDate = options.startDate;
      if (options.endDate) params.endDate = options.endDate;
      
      return client.get('/emails', params);
    },
    
    /**
     * Get a specific email by ID
     * @param {number} emailId - The email ID
     * @returns {Promise<Object>} Email object
     */
    async get(emailId) {
      return client.get(`/emails/${emailId}`);
    },
    
    /**
     * Create a new email
     * @param {Object} emailData - Email data
     * @param {string} emailData.name - Email name (required)
     * @param {string} emailData.subject - Email subject (required)
     * @param {string} emailData.body - Email body HTML (required)
     * @param {Array} emailData.recipientList - Recipient list IDs
     * @returns {Promise<Object>} Created email object
     */
    async create(emailData) {
      const requiredFields = ['name', 'subject', 'body'];
      for (const field of requiredFields) {
        if (!emailData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/emails', emailData);
    },
    
    /**
     * Update an email
     * @param {number} emailId - The email ID
     * @param {Object} emailData - Updated email data
     * @returns {Promise<Object>} Updated email object
     */
    async update(emailId, emailData) {
      return client.put(`/emails/${emailId}`, emailData);
    },
    
    /**
     * Send an email
     * @param {number} emailId - The email ID
     * @param {Object} sendData - Send options
     * @param {string} sendData.scheduledDate - Scheduled send date (optional)
     * @returns {Promise<Object>} Response
     */
    async send(emailId, sendData = {}) {
      return client.post(`/emails/${emailId}/send`, sendData);
    },
    
    /**
     * Get email statistics
     * @param {number} emailId - The email ID
     * @returns {Promise<Object>} Email statistics
     */
    async getStats(emailId) {
      return client.get(`/emails/${emailId}/stats`);
    },
    
    /**
     * Get email recipients
     * @param {number} emailId - The email ID
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of email recipients
     */
    async getRecipients(emailId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get(`/emails/${emailId}/recipients`, params);
    },
    
    /**
     * Get all emails (automatically paginated)
     * @param {Object} criteria - Filter criteria
     * @param {number} maxResults - Maximum number of results
     * @returns {Promise<Array>} Array of all emails
     */
    async getAll(criteria = {}, maxResults = 1000) {
      return client.getAllPaginated('/emails', criteria, maxResults);
    }
  };
};

export default create;