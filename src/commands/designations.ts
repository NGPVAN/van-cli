// @ts-nocheck

import type { VanApiClientLike } from '../types';

const create = function(client: VanApiClientLike) {
  return {
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      return client.get('/designations', params);
    },

    async get(designationId, options = {}) {
      const params = {};

      if (options.expand) params.$expand = options.expand;
      
      return client.get(`/designations/${designationId}`, params);
    },
  };
};

export default create;
