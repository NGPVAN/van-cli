// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Locations API endpoints
 * Handles location and geographic data management
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List locations
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.name - Location name filter
     * @returns {Promise<Object>} List of locations
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };

      if (options.name) params.name = options.name;

      return client.get('/locations', params);
    },
    
    /**
     * Get a specific location by ID
     * @param {number} locationId - The location ID
     * @returns {Promise<Object>} Location object
     */
    async get(locationId) {
      return client.get(`/locations/${locationId}`);
    },
    
    /**
     * Create a new location
     * @param {Object} locationData - Location data
     * @param {string} locationData.name - Location name (required)
     * @param {string} locationData.displayName - Display name (optional; defaults to name if omitted)
     * @param {Object} locationData.address - Address object (optional)
     * @param {string} locationData.address.addressLine1 - Street address line 1
     * @param {string} locationData.address.addressLine2 - Street address line 2
     * @param {string} locationData.address.city - City
     * @param {string} locationData.address.stateOrProvince - State/province code
     * @param {string} locationData.address.zipOrPostalCode - ZIP/postal code
     * @param {string} locationData.address.countryCode - Country code (e.g., 'US')
     * @returns {Promise<Object>} Created location object
     */
    async create(locationData) {
      const requiredFields = ['name'];
      for (const field of requiredFields) {
        if (!locationData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }

      const body: Record<string, unknown> = {
        name: locationData.name,
        displayName: locationData.displayName || locationData.name,
        address: {}
      };

      if (locationData.addressLine1) body.address.addressLine1 = locationData.addressLine1;
      if (locationData.addressLine2) body.address.addressLine2 = locationData.addressLine2;
      if (locationData.city) body.address.city = locationData.city;
      if (locationData.stateOrProvince) body.address.stateOrProvince = locationData.stateOrProvince;
      if (locationData.zipOrPostalCode) body.address.zipOrPostalCode = locationData.zipOrPostalCode;
      if (locationData.countryCode) body.address.countryCode = locationData.countryCode;

      return client.post('/locations', body);
    },

        /**
     * Find-or-Create a new location
     * @param {Object} locationData - Location data
     * @param {string} locationData.name - Location name (required)
     * @param {string} locationData.displayName - Display name (optional; defaults to name if omitted)
     * @param {Object} locationData.address - Address object (optional)
     * @param {string} locationData.address.addressLine1 - Street address line 1
     * @param {string} locationData.address.addressLine2 - Street address line 2
     * @param {string} locationData.address.city - City
     * @param {string} locationData.address.stateOrProvince - State/province code
     * @param {string} locationData.address.zipOrPostalCode - ZIP/postal code
     * @param {string} locationData.address.countryCode - Country code (e.g., 'US')
     * @returns {Promise<Object>} Created location object
     */
    async findOrCreate(locationData) {
      const requiredFields = ['name'];
      for (const field of requiredFields) {
        if (!locationData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }

      const body: Record<string, unknown> = {
        name: locationData.name,
        displayName: locationData.displayName || locationData.name,
        address: {}
      };

      if (locationData.addressLine1) body.address.addressLine1 = locationData.addressLine1;
      if (locationData.addressLine2) body.address.addressLine2 = locationData.addressLine2;
      if (locationData.city) body.address.city = locationData.city;
      if (locationData.stateOrProvince) body.address.stateOrProvince = locationData.stateOrProvince;
      if (locationData.zipOrPostalCode) body.address.zipOrPostalCode = locationData.zipOrPostalCode;
      if (locationData.countryCode) body.address.countryCode = locationData.countryCode;

      return client.post('/locations/findOrCreate', body);
    },
    
    /**
     * Delete a location
     * @param {number} locationId - The location ID
     * @returns {Promise<Object>} Updated location object
     */
    async delete(locationId) {
      try {
        await client.delete(`/locations/${locationId}`);
        return `Location ${locationId} deleted`;
      } catch (error) {
        throw new Error(`Failed to delete location ${locationId}`);
      }
    },
  };
};

export default create;