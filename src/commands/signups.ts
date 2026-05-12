// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Signups API endpoints
 * Handles event signup records and registration management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List signups
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {number} options.eventId - Event ID filter
     * @param {number} options.vanId - Person VAN ID filter
     * @returns {Promise<Object>} List of signups
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.eventId) params.eventId = options.eventId;
      if (options.vanId) params.vanId = options.vanId;
      
      return client.get('/signups', params);
    },
    
    /**
     * Get a specific signup by ID
     * @param {number} signupId - The signup ID
     * @returns {Promise<Object>} Signup object
     */
    async get(signupId) {
      return client.get(`/signups/${signupId}`);
    },
    
    /**
     * Create a new signup
     * @param {Object} signupData - Signup data
     * @param {number} signupData.vanId - Person's VAN ID (required)
     * @param {number} signupData.eventId - Event ID (required)
     * @param {number} signupData.eventShiftId - Event shift ID (required)
     * @param {number} signupData.roleId - Role ID (required)
     * @param {number} signupData.statusId - Status ID (required)
     * @param {number} signupData.locationId - Location ID (required)
     * @returns {Promise<Object>} Created signup object
     */
    async create(signupData) {
      const requiredFields = ['vanId', 'eventId', 'eventShiftId', 'roleId', 'statusId', 'locationId'];
      for (const field of requiredFields) {
        if (!signupData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }

      const body = {
        person: { vanId: signupData.vanId },
        event: { eventId: signupData.eventId },
        shift: { eventShiftId: signupData.eventShiftId },
        role: { roleId: signupData.roleId },
        status: { statusId: signupData.statusId },
        location: { locationId: signupData.locationId },
      };

      return client.post('/signups', body);
    },
    
    /**
     * Update a signup
     * @param {number} signupId - The signup ID
     * @param {Object} signupData - Updated signup data
     * @returns {Promise<Object>} Updated signup object
     */
    async update(signupId, signupData) {
      const existing = await client.get(`/signups/${signupId}`);

      if (signupData.eventShiftId) existing.shift = { eventShiftId: signupData.eventShiftId };
      if (signupData.roleId) existing.role = { roleId: signupData.roleId };
      if (signupData.statusId) existing.status = { statusId: signupData.statusId };
      if (signupData.locationId) existing.location = { locationId: signupData.locationId };

      const response = await client.put(`/signups/${signupId}`, existing);
      return (response !== null) ? response : this.get(signupId);
    },

    /**
     * Delete a signup
     * @param {number} signupId - The signup ID
     * @returns {Promise<Object>} Response
     */
    async delete(signupId) {
      try {
        await client.delete(`/signups/${signupId}`);
        return `Signup ${signupId} deleted`;
      } catch (error) {
        throw new Error(`Failed to delete signupId ${signupId}`);
      }
    },
  };
};

export default create;