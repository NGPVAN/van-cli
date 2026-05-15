// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Supporter Groups API endpoints
 * Handles supporter group management and membership
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List supporter groups
     * @param {Object} options - Optional parameters
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @returns {Promise<Object>} List of supporter groups
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      return client.get('/supporterGroups', params);
    },
    
    /**
     * Get a specific supporter group by ID
     * @param {number} supporterGroupId - The supporter group ID
     * @returns {Promise<Object>} Supporter group object
     */
    async get(supporterGroupId) {
      return client.get(`/supporterGroups/${supporterGroupId}`);
    },
    
    /**
     * Create a new supporter group
     * @param {Object} groupData - Supporter group data
     * @param {string} groupData.name - Group name (required)
     * @param {string} groupData.description - Group description
     * @returns {Promise<Object>} Created supporter group object
     */
    async create(groupData) {
      const requiredFields = ['name'];
      for (const field of requiredFields) {
        if (!groupData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
      
      return client.post('/supporterGroups', groupData);
    },

    /**
     * Add a person to a supporter group
     * @param {number} supporterGroupId - Supporter group ID
     * @param {number} vanId - Person's VAN ID
     * @returns {Promise<Object>} Response
     */
    async addPerson(supporterGroupId, vanId) {
      try {
        await client.put(`/supporterGroups/${supporterGroupId}/people/${vanId}`);
        return `Van ID ${vanId} added to Supporter Group ${supporterGroupId}`;
      } catch (error) {
        throw new Error(`Failed to add Van ID ${vanId} to Supporter Group ${supporterGroupId}`, { cause: error });
      }
    },

    /**
     * Remove a person from a supporter group
     * @param {number} supporterGroupId - Supporter group ID
     * @returns {Promise<Object>} Response
     */
    async removePerson(supporterGroupId, vanId) {
      try {
        await client.delete(`/supporterGroups/${supporterGroupId}/people/${vanId}`);
        return `Van ID ${vanId} removed from Supporter Group ${supporterGroupId}`;
      } catch (error) {
        throw new Error(`Failed to remove Van ID ${vanId} from Supporter Group ${supporterGroupId}`, { cause: error });
      }
    },

    /**
     * Deletes a supporter group
     * @param {number} supporterGroupId - Supporter group ID
     * @returns {Promise<Object>} Response
     */
    async delete(supporterGroupId) {
      try {
        await client.delete(`/supporterGroups/${supporterGroupId}`);
        return `Supporter Group ${supporterGroupId} deleted`;
      } catch (error) {
        throw new Error(`Failed to delete Supporter Group ${supporterGroupId}`, { cause: error });
      }
    },
  };
};

export default create;