// @ts-nocheck

import type { VanApiClientLike } from '../types';

const create = function(client: VanApiClientLike) {
  return {
    async get() {
      return client.get('/apiKeyProfiles');
    }
  };
};

export default create;
