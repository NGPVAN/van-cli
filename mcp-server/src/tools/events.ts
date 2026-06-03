import { z } from 'zod';
import { createRequire } from 'module';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../client.js';

const require = createRequire(import.meta.url);
const createEvents = (require('../../../src/commands/events.js') as { default: Function }).default;

export function registerEventsTools(server: McpServer): void {
  server.tool(
    'van_events_list',
    'List events, optionally filtered by date range',
    {
      startDate: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
      expand: z.string().optional().describe('Comma-separated expand fields (e.g. locations,shifts,roles)'),
      top: z.number().int().min(1).max(50).default(25).describe('Number of results'),
      skip: z.number().int().min(0).default(0).describe('Results to skip for pagination'),
    },
    async ({ startDate, endDate, expand, top, skip }) => {
      const client = await getClient();
      const api = createEvents(client);
      const params: Record<string, unknown> = { top, skip };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (expand) params.$expand = expand;
      const result = await api.list(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_events_get',
    'Get an event by ID',
    {
      eventId: z.number().int().positive().describe('Event ID'),
      expand: z.string().optional().describe('Comma-separated expand fields (e.g. locations,shifts,roles,codes)'),
    },
    async ({ eventId, expand }) => {
      const client = await getClient();
      const api = createEvents(client);
      const result = await api.get(eventId, expand ? { $expand: expand } : {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
