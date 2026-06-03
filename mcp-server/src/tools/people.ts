import { z } from 'zod';
import { createRequire } from 'module';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../client.js';

const require = createRequire(import.meta.url);
const createPeople = (require('../../../src/commands/people.js') as { default: Function }).default;

export function registerPeopleTools(server: McpServer): void {
  server.tool(
    'van_people_list',
    'Search for people by name, email, phone, address, or other criteria',
    {
      firstName: z.string().optional().describe('First name'),
      lastName: z.string().optional().describe('Last name'),
      email: z.string().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      city: z.string().optional().describe('City'),
      stateOrProvince: z.string().optional().describe('State or province'),
      zipOrPostalCode: z.string().optional().describe('ZIP or postal code'),
      top: z.number().int().min(1).max(50).default(25).describe('Number of results (max 50)'),
      skip: z.number().int().min(0).default(0).describe('Results to skip for pagination'),
    },
    async (params) => {
      const client = await getClient();
      const api = createPeople(client);
      const result = await api.list(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_people_get',
    'Get a person by their VAN ID',
    {
      vanId: z.number().int().positive().describe('VAN ID of the person'),
      expand: z.string().optional().describe('Comma-separated fields to expand (e.g. addresses,phones,emails)'),
    },
    async ({ vanId, expand }) => {
      const client = await getClient();
      const api = createPeople(client);
      const result = await api.get(vanId, expand ? { $expand: expand } : {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_people_find_or_create',
    'Find an existing person or create a new one by name and contact info',
    {
      firstName: z.string().describe('First name'),
      lastName: z.string().describe('Last name'),
      email: z.string().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
    },
    async (params) => {
      const client = await getClient();
      const api = createPeople(client);
      const result = await api.findOrCreate(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_people_quick_search',
    'Fuzzy search for people by a single name string',
    {
      name: z.string().describe('Name query (e.g. "John Smith")'),
    },
    async ({ name }) => {
      const client = await getClient();
      const api = createPeople(client);
      const result = await api.quickSearch({ name });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
