import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// src/ files compile as CommonJS — use require() for named imports
const { getBearerToken } = require('../../src/tokenManager.js') as {
  getBearerToken: () => Promise<string>;
};
const VanApiClient = (require('../../src/client.js') as { default: new (opts: { bearerToken: string }) => unknown }).default;

// Returns a fresh client on every call — getBearerToken() is cheap when token is valid
// (local expiry check only), and this ensures long-lived MCP sessions never use stale tokens.
export async function getClient() {
  const bearerToken = await getBearerToken();
  return new VanApiClient({ bearerToken });
}
