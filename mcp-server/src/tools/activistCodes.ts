import { z } from 'zod';
import { createRequire } from 'module';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../client.js';

const require = createRequire(import.meta.url);
const createActivistCodes = (require('../../../src/commands/activistCodes.js') as { default: Function }).default;

export function registerActivistCodesTools(server: McpServer): void {
  server.tool(
    'van_activist_codes_list',
    'List all activist codes, or codes applied to a specific person',
    {
      vanId: z.number().int().positive().optional().describe('Person VAN ID — if provided, returns only codes applied to that person'),
      top: z.number().int().min(1).max(50).default(50).describe('Number of results'),
      skip: z.number().int().min(0).default(0).describe('Results to skip for pagination'),
    },
    async (params: Record<string, unknown>) => {
      const client = await getClient();
      const api = createActivistCodes(client);
      const result = await api.list(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_activist_codes_get',
    'Get an activist code by ID',
    {
      activistCodeId: z.number().int().positive().describe('Activist code ID'),
    },
    async ({ activistCodeId }: { activistCodeId: number }) => {
      const client = await getClient();
      const api = createActivistCodes(client);
      const result = await api.get(activistCodeId);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
