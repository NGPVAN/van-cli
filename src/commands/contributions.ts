// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Contributions API endpoints
 * Handles contribution records and financial data
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List contributions
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {number} vanId - Person VAN ID
     * @returns {Promise<Object>} List of contributions
     */
    async list(vanId, options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0,
        vanId: vanId
      };

      return client.get('/contributions/recentContributions', params);
    },
    
    /**
     * Get a specific contribution by ID
     * @param {number} contributionId - The contribution ID
     * @returns {Promise<Object>} Contribution object
     */
    async get(contributionId) {
      return client.get(`/contributions/${contributionId}`);
    },
    
    /**
     * Create a new contribution record
     * @param {Object} contributionData - Contribution data
     * @param {number} contributionData.vanId - Person's VAN ID (required)
     * @param {number} contributionData.amount - Contribution amount (required)
     * @param {string} contributionData.dateReceived - Date received (required)
     * @param {string} contributionData.contributionType - Type of contribution
     * @returns {Promise<Object>} Created contribution object
     */
    async create(contributionData) {
      const requiredFields = ['vanId', 'amount', 'dateReceived', 'designationId', 'status', 'paymentType'];
      for (const field of requiredFields) {
        if (contributionData[field] === undefined) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }

      const body = {
        contact: {
          vanId: contributionData.vanId
        },
        designation: {
          designationId: contributionData.designationId
        },
        dateReceived: contributionData.dateReceived,
        amount: contributionData.amount,
        status: contributionData.status,
        paymentType: contributionData.paymentType
      };

      return client.post('/contributions', body);
    },
    
    /**
     * Update a contribution
     * @param {number} contributionId - The contribution ID
     * @param {Object} contributionData - Updated contribution data
     * @returns {Promise<Object>} Updated contribution object
     */
    async update(contributionId, contributionData) {
      const existing = await client.get(`/contributions/${contributionId}`);

      // Remove server-managed/read-only fields
      for (const readOnlyProperty of [ 'processedAmount', 'processedCurrency', ]) {
        delete existing[readOnlyProperty];
      }
      
      if (contributionData.vanId !== undefined) existing.contact = { vanId: contributionData.vanId };
      if (contributionData.designationId !== undefined) existing.designation = { designationId: contributionData.designationId };
      if (contributionData.amount !== undefined) existing.amount = contributionData.amount;
      if (contributionData.dateReceived !== undefined) existing.dateReceived = contributionData.dateReceived;
      if (contributionData.status !== undefined) existing.status = contributionData.status;
      if (contributionData.paymentType !== undefined) existing.paymentType = contributionData.paymentType;

      const response = await client.put(`/contributions/${contributionId}`, existing);
      return (response !== null) ? response : this.get(contributionId);
    },
  };
};

export default create;