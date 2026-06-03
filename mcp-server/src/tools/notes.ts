import { z } from 'zod';
import { createRequire } from 'module';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../client.js';

const require = createRequire(import.meta.url);
const createNotes = (require('../../../src/commands/notes.js') as { default: Function }).default;

export function registerNotesTools(server: McpServer): void {
  server.tool(
    'van_notes_list',
    'List notes, optionally filtered by person VAN ID or category',
    {
      vanId: z.number().int().positive().optional().describe('Filter by person VAN ID'),
      category: z.string().optional().describe('Filter by note category'),
      top: z.number().int().min(1).max(50).default(50).describe('Number of results'),
      skip: z.number().int().min(0).default(0).describe('Results to skip for pagination'),
    },
    async (params) => {
      const client = await getClient();
      const api = createNotes(client);
      const result = await api.list(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_notes_get',
    'Get a note by ID',
    {
      noteId: z.number().int().positive().describe('Note ID'),
    },
    async ({ noteId }) => {
      const client = await getClient();
      const api = createNotes(client);
      const result = await api.get(noteId);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_notes_get_by_person',
    'Get all notes for a specific person',
    {
      vanId: z.number().int().positive().describe('Person VAN ID'),
      top: z.number().int().min(1).max(50).default(50).describe('Number of results'),
      skip: z.number().int().min(0).default(0).describe('Results to skip for pagination'),
    },
    async ({ vanId, top, skip }) => {
      const client = await getClient();
      const api = createNotes(client);
      const result = await api.getByPerson(vanId, { top, skip });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_notes_create',
    'Create a new note on a person',
    {
      vanId: z.number().int().positive().describe('Person VAN ID'),
      text: z.string().describe('Note text'),
      category: z.string().optional().describe('Note category'),
      isViewRestricted: z.boolean().optional().describe('Whether the note is view restricted'),
    },
    async (params) => {
      const client = await getClient();
      const api = createNotes(client);
      const result = await api.create(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_notes_update',
    'Update an existing note',
    {
      noteId: z.number().int().positive().describe('Note ID'),
      text: z.string().optional().describe('Updated note text'),
      category: z.string().optional().describe('Updated note category'),
      isViewRestricted: z.boolean().optional().describe('Whether the note is view restricted'),
    },
    async ({ noteId, ...noteData }) => {
      const client = await getClient();
      const api = createNotes(client);
      const result = await api.update(noteId, noteData);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'van_notes_delete',
    'Delete a note by ID',
    {
      noteId: z.number().int().positive().describe('Note ID'),
    },
    async ({ noteId }) => {
      const client = await getClient();
      const api = createNotes(client);
      const result = await api.delete(noteId);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
