// @ts-nocheck

import type { VanApiClientLike } from '../types';
import { validateBoolean, validateIdList, validatePaging, validatePositiveInt } from '../validation';

/**
 * Folders API endpoints
 * Handles folders that saved lists are organized into
 */

/**
 * Build and validate GET /folders query params
 * @param {Object} options - Optional parameters
 * @param {string} options.text - Name search
 * @param {string|Array} options.ids - Folder IDs (comma-separated or array), sent as one comma-delimited value
 * @param {boolean} options.writableOnly - Only return shared folders others can save into (owned folders are always returned)
 * @param {number} options.top - Number of results (>= 1, default 50; the endpoint has no fixed max)
 * @param {number} options.skip - Number of results to skip (default 0)
 * @returns {Object} Query params
 */
function buildListParams(options = {}) {
  const params = validatePaging(options);

  if (options.text !== undefined) params.text = options.text;
  if (options.ids !== undefined) params.ids = validateIdList(options.ids, 'ids', { allowDuplicates: true }).join(',');
  if (options.writableOnly !== undefined && validateBoolean(options.writableOnly, 'writableOnly')) {
    params.writableOnly = true;
  }

  return params;
}

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List folders
     * @param {Object} options - See buildListParams
     * @returns {Promise<Object>} List of folders
     */
    async list(options = {}) {
      return client.get('/folders', buildListParams(options));
    },

    /**
     * Get a specific folder by ID
     * @param {number} folderId - The folder ID
     * @returns {Promise<Object>} Folder object
     */
    async get(folderId) {
      const id = validatePositiveInt(folderId, 'folderId');
      return client.get(`/folders/${id}`);
    },
  };
};

export default create;
