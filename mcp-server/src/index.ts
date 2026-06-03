import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAuthTools } from './tools/auth.js';
import { registerPeopleTools } from './tools/people.js';
import { registerEventsTools } from './tools/events.js';
import { registerActivistCodesTools } from './tools/activistCodes.js';
import { registerSavedListsTools } from './tools/savedLists.js';
import { registerNotesTools } from './tools/notes.js';
import { registerCanvassResponsesTools } from './tools/canvassResponses.js';

const server = new McpServer({
  name: 'van-mcp',
  version: '0.1.0',
});

registerAuthTools(server);
registerPeopleTools(server);
registerEventsTools(server);
registerActivistCodesTools(server);
registerSavedListsTools(server);
registerNotesTools(server);
registerCanvassResponsesTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`van-mcp error: ${err.message}\n`);
  process.exit(1);
});
