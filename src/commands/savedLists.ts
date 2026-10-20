// @ts-nocheck

import type { VanApiClientLike } from '../types';
import { validateBoolean, validateIntRange, validateNonNegativeInt, validatePositiveInt } from '../validation';

/**
 * Saved Lists API endpoints
 * Handles saved list management and operations
 */

/**
 * Build and validate GET /savedLists query params
 * @param {Object} options - Optional parameters
 * @param {string} options.text - Name search
 * @param {number} options.folderId - Only lists in this folder
 * @param {number} options.maxDoorCount - Only lists with at most this many doors
 * @param {number} options.maxPeopleCount - Only lists with at most this many people
 * @param {boolean} options.isFollowed - Filter by whether the list is followed
 * @param {number} options.top - Number of results (1-100, default 50)
 * @param {number} options.skip - Number of results to skip (default 0)
 * @param {string} options.$expand - Comma-separated fields to expand
 * @returns {Object} Query params
 */
function buildListParams(options = {}) {
  const params = {
    $top: options.top === undefined ? 50 : validateIntRange(options.top, 'top', 1, 100),
    $skip: options.skip === undefined ? 0 : validateNonNegativeInt(options.skip, 'skip')
  };

  if (options.text !== undefined) params.text = options.text;
  if (options.folderId !== undefined) params.folderId = validatePositiveInt(options.folderId, 'folderId');
  if (options.maxDoorCount !== undefined) params.maxDoorCount = validateNonNegativeInt(options.maxDoorCount, 'maxDoorCount');
  if (options.maxPeopleCount !== undefined) params.maxPeopleCount = validateNonNegativeInt(options.maxPeopleCount, 'maxPeopleCount');
  if (options.isFollowed !== undefined) params.isFollowed = validateBoolean(options.isFollowed, 'isFollowed');
  if (options.$expand) params.$expand = options.$expand;

  return params;
}

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List saved lists (only lists in folders the API key can access are returned)
     * @param {Object} options - See buildListParams
     * @returns {Promise<Object>} List of saved lists
     */
    async list(options = {}) {
      return client.get('/savedLists', buildListParams(options));
    },
    
    /**
     * Get a specific saved list by ID
     * @param {number} savedListId - The saved list ID
     * @param {Object} options - Optional parameters
     * @param {string} options.$expand - Comma-separated fields to expand
     * @returns {Promise<Object>} Saved list object
     */
    async get(savedListId, options = {}) {
      const id = validatePositiveInt(savedListId, 'savedListId');
      return client.get(`/savedLists/${id}`, options);
    },
  };
};

export default create;
