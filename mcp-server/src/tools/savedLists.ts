import { z } from 'zod';
import { createRequire } from 'module';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../client.js';

const require = createRequire(import.meta.url);
const createSavedLists = (require('../../../src/commands/savedLists.js') as { default: Function }).default;

export function registerSavedListsTools(server: McpServer): void {
  server.tool(
    'van_saved_lists_list',
    'List saved lists',
    {
      top: z.number().int().min(1).max(100).default(50).describe('Number of results (max 100)'),
      skip: z.number().int().min(0).default(0).describe('Results to skip for pagination'),
    },
    async (params: Record<string, unknown>) => {
      const client = await getClient();
      const api = createSavedLists(client);
      const result = await api.list(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_saved_lists_get',
    'Get a saved list by ID',
    {
      savedListId: z.number().int().positive().describe('Saved list ID'),
    },
    async ({ savedListId }: { savedListId: number }) => {
      const client = await getClient();
      const api = createSavedLists(client);
      const result = await api.get(savedListId, {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
