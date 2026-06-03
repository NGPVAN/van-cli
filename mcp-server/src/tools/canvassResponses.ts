import { z } from 'zod';
import { createRequire } from 'module';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../client.js';

const require = createRequire(import.meta.url);
const createCanvassResponses = (require('../../../src/commands/canvassResponses.js') as { default: Function }).default;

export function registerCanvassResponsesTools(server: McpServer): void {
  server.tool(
    'van_canvass_responses_list',
    'List canvass responses for a specific person',
    {
      vanId: z.number().int().positive().describe('Person VAN ID'),
      top: z.number().int().min(1).max(50).default(50).describe('Number of results'),
      skip: z.number().int().min(0).default(0).describe('Results to skip for pagination'),
    },
    async ({ vanId, top, skip }) => {
      const client = await getClient();
      const api = createCanvassResponses(client);
      const result = await api.list({ vanId, top, skip });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_canvass_responses_create',
    'Record a canvass response for a person',
    {
      vanId: z.number().int().positive().describe('Person VAN ID'),
      resultCodeId: z.number().int().optional().describe('Result code ID (e.g. Canvassed, Not Home)'),
      canvassContext: z.object({
        contactTypeId: z.number().int().optional().describe('Contact type ID (e.g. Walk, Phone)'),
        inputTypeId: z.number().int().optional().describe('Input type ID'),
        dateCanvassed: z.string().optional().describe('Date canvassed (YYYY-MM-DD)'),
      }).optional().describe('Canvass context details'),
    },
    async ({ vanId, resultCodeId, canvassContext }) => {
      const client = await getClient();
      const api = createCanvassResponses(client);
      const result = await api.create({ vanId, resultCodeId, canvassContext });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_canvass_input_types',
    'List available canvass input types',
    {},
    async () => {
      const client = await getClient();
      const api = createCanvassResponses(client);
      const result = await api.inputTypes();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_canvass_result_codes',
    'List available canvass result codes (e.g. Canvassed, Not Home, Moved)',
    {},
    async () => {
      const client = await getClient();
      const api = createCanvassResponses(client);
      const result = await api.resultCodes();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_canvass_contact_types',
    'List available canvass contact types (e.g. Walk, Phone, Text)',
    {},
    async () => {
      const client = await getClient();
      const api = createCanvassResponses(client);
      const result = await api.contactTypes();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
