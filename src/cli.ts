// @ts-nocheck

import { Command, program } from 'commander';
import chalk from 'chalk';
import VanApiClient from './client';
import { version } from '../package.json';

const isCompletionMode = process.argv.includes('completion') || process.argv.includes('__complete');

// Check for required environment variables (not needed for schema/completion)
const isSchemaMode = process.argv.includes('schema');
if (!process.env.VAN_API_KEY && !isCompletionMode && !isSchemaMode) {
  console.error(chalk.red('Error: VAN_API_KEY environment variable is required'));
  console.error(chalk.yellow('Set it in your shell: export VAN_API_KEY="your-api-key|0"'));
  process.exit(1);
}

// Create global client instance (deferred until after program parses global options)
let client: VanApiClient | null = null;

function getClient() {
  if (!client) {
    const globalOpts = program.opts();
    client = new VanApiClient({ dryRun: globalOpts.dryRun ?? false });
  }
  return client;
}

// Known people expand values for /people/{vanId}.
// Source: VAN API validation hint for invalid $expand and docs.ngpvan.com people docs.
const PEOPLE_GET_KNOWN_EXPANDS = [
  'contributionHistory',
  'addresses',
  'phones',
  'emails',
  'codes',
  'customFields',
  'externalIds',
  'preferences',
  'recordedAddresses',
  'reportedDemographics',
  'suppressions',
  'cases',
  'customProperties',
  'districts',
  'electionRecords',
  'membershipStatuses',
  'notes',
  'organizationRoles',
  'scores',
  'disclosureFieldValues',
  'primaryContact',
  'pollingLocation'
];

// Valid $expand values for GET /people search endpoint.
const PEOPLE_SEARCH_EXPANDS = [
  'Addresses',
  'Emails',
  'Phones',
  'Districts',
  'PollingLocation'
];

// --- Utility functions ---

function filterFields(data: unknown, fields: string): unknown {
  const keys = fields.split(',').map(k => k.trim()).filter(Boolean);
  if (keys.length === 0) return data;

  function pickFields(obj: unknown): unknown {
    if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => pickFields(item));
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      if (key in (obj as Record<string, unknown>)) {
        result[key] = (obj as Record<string, unknown>)[key];
      }
    }
    return result;
  }

  // Handle paginated {items:[...], ...} responses
  if (data && typeof data === 'object' && !Array.isArray(data) && 'items' in (data as Record<string, unknown>)) {
    const d = data as Record<string, unknown>;
    return { ...d, items: pickFields(d.items) };
  }

  return pickFields(data);
}

function outputResult(data: unknown, options: Record<string, unknown> = {}) {
  let output = data;
  if (options.fields) {
    output = filterFields(output, options.fields as string);
  }
  if (options.pretty) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(JSON.stringify(output));
  }
}

// Error handler
function handleError(error) {
  if (error.status && error.details) {
    console.error(chalk.red(`VAN API Error (${error.status}):`));
    console.error(chalk.red(JSON.stringify(error.details, null, 2)));
  } else {
    console.error(chalk.red(`Error: ${error.message}`));
  }
  process.exit(1);
}

function parseGlobalJsonPayload(options) {
  const raw = options.json;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('--json value must be a JSON object');
    }
    return parsed;
  } catch (error) {
    console.error(chalk.red(`Invalid JSON in --json flag.`));
    console.error(chalk.yellow(`Received: ${raw}`));
    console.error(chalk.yellow(`Tip: Ensure your JSON is properly quoted. Example: --json '{"firstName":"John"}'`));
    process.exit(1);
  }
}

function parseJsonPayload(options) {
  const raw = options.data || options.json;
  if (!raw) {
    throw new Error('JSON payload is required. Pass --data "{...}"');
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON payload: ${error.message}`);
  }
}

function mergeJsonOption(cliOptions: Record<string, unknown>, globalOpts: Record<string, unknown>): Record<string, unknown> {
  if (!globalOpts.json) return cliOptions;
  const jsonData = parseGlobalJsonPayload(globalOpts);
  // CLI flags take precedence over JSON keys
  const merged = { ...jsonData };
  for (const [key, value] of Object.entries(cliOptions)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}

function validatePositiveInt(value: string, label: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    console.error(chalk.red(`Error: ${label} must be a positive integer, got: "${value}"`));
    process.exit(1);
  }
  return num;
}

// Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[la][lb];
}

function suggestClosest(input: string, candidates: string[], maxDistance = 3): string | null {
  let best: string | null = null;
  let bestDist = maxDistance + 1;
  const lower = input.toLowerCase();
  for (const c of candidates) {
    const dist = levenshtein(lower, c.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

function optionTakesValue(option) {
  return Boolean(option.required || option.optional);
}

function findSubcommand(command, token) {
  return command.commands.find(sub => sub.name() === token || sub.aliases().includes(token));
}

function getCompletionCandidates(command, words) {
  const tokens = Array.isArray(words) ? words : [];
  const current = tokens.length > 0 ? tokens[tokens.length - 1] : '';
  const consumed = tokens.slice(0, -1);
  let currentCommand = command;

  for (let i = 0; i < consumed.length; i += 1) {
    const token = consumed[i];
    if (token.startsWith('-')) {
      const opt = currentCommand.options.find(option => option.long === token || option.short === token);
      if (opt && optionTakesValue(opt)) {
        i += 1;
      }
      continue;
    }

    const sub = findSubcommand(currentCommand, token);
    if (!sub) {
      break;
    }
    currentCommand = sub;
  }

  const previous = consumed.length > 0 ? consumed[consumed.length - 1] : '';
  if (previous.startsWith('-')) {
    const previousOpt = currentCommand.options.find(option => option.long === previous || option.short === previous);
    if (previousOpt && optionTakesValue(previousOpt)) {
      return [];
    }
  }

  const subcommands = currentCommand.commands
    .filter(sub => !sub._hidden)
    .map(sub => sub.name());

  const options = currentCommand.options.flatMap(option => {
    const entries = [];
    if (option.long) entries.push(option.long);
    if (option.short) entries.push(option.short);
    return entries;
  });

  const candidates = current.startsWith('-')
    ? options
    : [...subcommands, ...options];

  return candidates
    .filter(candidate => candidate.startsWith(current))
    .sort();
}

// --- Schema introspection ---

function buildSchemaData() {
  const resources: Record<string, Record<string, unknown>> = {};

  for (const cmd of program.commands) {
    if (cmd._hidden || ['completion', 'schema'].includes(cmd.name())) continue;
    const resourceName = cmd.name();
    const actions: Record<string, unknown> = {};

    // If the command has subcommands, introspect each
    if (cmd.commands && cmd.commands.length > 0) {
      for (const sub of cmd.commands) {
        if (sub._hidden) continue;
        actions[sub.name()] = extractCommandSchema(sub);
      }
    } else {
      // Top-level command with no subcommands (e.g. api-key-profiles)
      actions['default'] = extractCommandSchema(cmd);
    }

    resources[resourceName] = {
      description: cmd.description(),
      actions
    };
  }
  return resources;
}

function extractCommandSchema(cmd) {
  const schema: Record<string, unknown> = {
    description: cmd.description(),
  };

  // Arguments
  const args = cmd._args || cmd.registeredArguments || [];
  if (args.length > 0) {
    schema.arguments = args.map(arg => ({
      name: arg.name(),
      required: arg.required,
      description: arg.description || undefined,
    }));
  }

  // Options
  const options = cmd.options.filter(opt => {
    // Skip inherited global options
    return !['--pretty', '--json', '--dry-run', '--fields', '-V', '--version', '-h', '--help'].includes(opt.long) &&
           !['--pretty', '--json', '--dry-run', '--fields', '-V', '--version', '-h', '--help'].includes(opt.short);
  });
  if (options.length > 0) {
    schema.options = options.map(opt => {
      const o: Record<string, unknown> = {
        flags: opt.flags,
        description: opt.description,
        required: opt.mandatory || false,
      };
      if (opt.defaultValue !== undefined) o.default = opt.defaultValue;
      return o;
    });
  }

  return schema;
}

// --- Set up the main program ---

program
  .name('van')
  .description('NGP VAN API CLI tool. Supports --json, --dry-run, and --fields for agent-friendly usage.')
  .version(version)
  .option('-p, --pretty', 'Pretty-print JSON output')
  .option('--json <payload>', 'Raw JSON object to merge with CLI options (CLI flags take precedence)')
  .option('--dry-run', 'Print the HTTP request that would be made without executing it')
  .option('--fields <keys>', 'Comma-separated list of fields to include in the output');

const internalCompleteCmd = new Command('__complete');
internalCompleteCmd
  .argument('[words...]')
  .action((words = []) => {
    const suggestions = getCompletionCandidates(program, words);
    if (suggestions.length > 0) {
      console.log(suggestions.join('\n'));
    }
  });
program.addCommand(internalCompleteCmd, { hidden: true });

program
  .command('completion [shell]')
  .description('Generate shell completion script (bash|zsh)')
  .action((shell = 'zsh') => {
    if (shell === 'bash') {
      console.log(`# bash completion for van
_van_completion() {
  local -a words
  local i
  for ((i=1; i<=COMP_CWORD; i++)); do
    words+=("\${COMP_WORDS[i]}")
  done
  COMPREPLY=( $(van __complete "\${words[@]}") )
}
complete -F _van_completion van`);
      return;
    }

    if (shell === 'zsh') {
      console.log(`#compdef van
_van_completion() {
  local -a args completions
  local i
  for ((i=2; i<=CURRENT; i++)); do
    args+=("\${words[i]}")
  done
  completions=("\${(@f)$(van __complete "\${args[@]}")}")
  compadd -a completions
}
compdef _van_completion van`);
      return;
    }

    throw new Error(`Unsupported shell '${shell}'. Use 'bash' or 'zsh'.`);
  });

// --- Schema command ---

const schemaCmd = program
  .command('schema [path]')
  .description('Introspect CLI commands and their parameters. Usage: van schema, van schema <resource>, van schema <resource>.<action>')
  .action((path) => {
    const data = buildSchemaData();
    const allResources = Object.keys(data);

    if (!path) {
      outputResult(data, program.opts());
      return;
    }

    const parts = path.split('.');
    const resourceKey = parts[0];
    const actionKey = parts[1];

    if (!data[resourceKey]) {
      let msg = `Unknown resource: "${resourceKey}".`;
      const suggestion = suggestClosest(resourceKey, allResources);
      if (suggestion) msg += ` Did you mean "${suggestion}"?`;
      console.error(chalk.red(msg));
      process.exit(1);
    }

    if (!actionKey) {
      outputResult(data[resourceKey], program.opts());
      return;
    }

    const actions = data[resourceKey].actions as Record<string, unknown>;
    const allActions = Object.keys(actions);
    if (!actions[actionKey]) {
      let msg = `Unknown action: "${actionKey}" for resource "${resourceKey}".`;
      const suggestion = suggestClosest(actionKey, allActions);
      if (suggestion) msg += ` Did you mean "${suggestion}"?`;
      console.error(chalk.red(msg));
      process.exit(1);
    }

    outputResult(actions[actionKey], program.opts());
  });

// --- People commands ---

const peopleCmd = program
  .command('people')
  .description('Manage people');

peopleCmd
  .command('expand-fields')
  .description('List known $expand fields for people endpoints')
  .action(() => {
    outputResult({
      resource: 'people',
      endpointExpandFields: {
        '/people': PEOPLE_SEARCH_EXPANDS,
        '/people/{vanId}': PEOPLE_GET_KNOWN_EXPANDS
      },
      notes: [
        'Some expansions are endpoint and permission dependent.',
        'If an expand is invalid for your context, VAN returns an INVALID_PARAMETER with accepted values.'
      ],
      sources: [
        'https://docs.ngpvan.com/reference/peoplevanid-1',
        'VAN API INVALID_PARAMETER hint for $expand on /people/{vanId}'
      ]
    }, program.opts());
  });

peopleCmd
  .command('get <vanId>')
  .description('Get a person by VAN ID')
  .option('-e, --expand <fields>', 'Expand related fields (comma-separated). See: van people expand-fields')
  .action(async (vanId, options) => {
    try {
      validatePositiveInt(vanId, 'vanId');
      const params = {};
      if (options.expand) {
        params.$expand = options.expand;
      }
      const person = await getClient().get(`/people/${vanId}`, params);
      outputResult(person, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

peopleCmd
  .command('update <vanId>')
  .description('Update a person by VAN ID')
  .requiredOption('-d, --data <json>', 'JSON payload for person update')
  .action(async (vanId, options) => {
    try {
      validatePositiveInt(vanId, 'vanId');
      const payload = parseJsonPayload(options);
      const globalOpts = program.opts();
      const merged = globalOpts.json ? { ...parseGlobalJsonPayload(globalOpts), ...payload } : payload;
      const result = await getClient().post(`/people/${vanId}`, merged);
      outputResult(result, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

peopleCmd
  .command('delete <vanId>')
  .description('Delete a person by VAN ID')
  .action(async (vanId) => {
    try {
      validatePositiveInt(vanId, 'vanId');
      const result = await getClient().delete(`/people/${vanId}`);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

peopleCmd
  .command('find')
  .description('Find people by criteria')
  .option('-f, --firstName <name>', 'First name')
  .option('-l, --lastName <name>', 'Last name')
  .option('--middleName <name>', 'Middle name')
  .option('--streetAddress <address>', 'Street address')
  .option('--city <city>', 'City')
  .option('--stateOrProvince <state>', 'State/province')
  .option('--zipOrPostalCode <zip>', 'ZIP/postal code')
  .option('--phoneNumber <phone>', 'Phone number')
  .option('-e, --email <email>', 'Email address')
  .option('-p, --phone <phone>', 'Phone number (alias for --phoneNumber)')
  .option('--dateOfBirth <date>', 'Date of birth (YYYY-MM-DD)')
  .option('--employer <employer>', 'Employer name')
  .option('--occupation <occupation>', 'Occupation')
  .option('--commonName <name>', 'Organization common name')
  .option('--officialName <name>', 'Organization official name')
  .option('--contactMode <mode>', 'Contact mode: Person or Organization')
  .option('--top <count>', 'Number of results (max 50)', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .option('--orderby <expr>', 'OData $orderby expression (example: Name)')
  .option('--expand <fields>', 'Expand related fields (comma-separated). See: van people expand-fields')
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);

      const params = {
        $top: merged.top,
        $skip: merged.skip
      };

      if (merged.firstName) params.firstName = merged.firstName;
      if (merged.lastName) params.lastName = merged.lastName;
      if (merged.middleName) params.middleName = merged.middleName;
      if (merged.streetAddress) params.streetAddress = merged.streetAddress;
      if (merged.city) params.city = merged.city;
      if (merged.stateOrProvince) params.stateOrProvince = merged.stateOrProvince;
      if (merged.zipOrPostalCode) params.zipOrPostalCode = merged.zipOrPostalCode;
      if (merged.phoneNumber) params.phoneNumber = merged.phoneNumber;
      if (merged.phone) params.phoneNumber = merged.phone;
      if (merged.email) params.email = merged.email;
      if (merged.dateOfBirth) params.dateOfBirth = merged.dateOfBirth;
      if (merged.employer) params.employer = merged.employer;
      if (merged.occupation) params.occupation = merged.occupation;
      if (merged.commonName) params.commonName = merged.commonName;
      if (merged.officialName) params.officialName = merged.officialName;
      if (merged.contactMode) params.contactMode = merged.contactMode;
      if (merged.orderby) params.$orderby = merged.orderby;
      if (merged.expand) params.$expand = merged.expand;

      const results = await getClient().get('/people', params);
      outputResult(results, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

peopleCmd
  .command('quick-search')
  .description('Fuzzy search people/orgs by a single name string')
  .requiredOption('-n, --name <name>', 'Name query (example: John Smith)')
  .option('--top <count>', 'Number of results (max 50)', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .option('--orderby <expr>', 'OData $orderby expression (example: Name)')
  .option('--expand <fields>', 'Expand related fields (comma-separated). See: van people expand-fields')
  .action(async (options) => {
    try {
      const params = {
        name: options.name,
        $top: options.top,
        $skip: options.skip
      };

      if (options.orderby) params.$orderby = options.orderby;
      if (options.expand) params.$expand = options.expand;

      const results = await getClient().get('/people/quickSearch', params);
      outputResult(results, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

peopleCmd
  .command('find-or-create')
  .description('Find or create a person')
  .requiredOption('-f, --firstName <name>', 'First name')
  .requiredOption('-l, --lastName <name>', 'Last name')
  .option('-e, --email <email>', 'Email address')
  .option('-p, --phone <phone>', 'Phone number')
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);

      const data = {
        firstName: merged.firstName,
        lastName: merged.lastName
      };

      if (merged.email) data.email = merged.email;
      if (merged.phone) data.phone = merged.phone;

      const result = await getClient().post('/people/findOrCreate', data);
      outputResult(result, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

// Activist Codes commands
const activistCodesCmd = program
  .command('activist-codes')
  .description('Manage activist codes');

activistCodesCmd
  .command('list')
  .description('List all activist codes')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      const codes = await getClient().get('/activistCodes', params);
      outputResult(codes, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Survey Questions commands
const surveyQuestionsCmd = program
  .command('survey-questions')
  .description('Manage survey questions');

surveyQuestionsCmd
  .command('list')
  .description('List all survey questions')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      const questions = await getClient().get('/surveyQuestions', params);
      outputResult(questions, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Events commands
const eventsCmd = program
  .command('events')
  .description('Manage events');

eventsCmd
  .command('list')
  .description('List events')
  .option('--startDate <date>', 'Start date filter (YYYY-MM-DD)')
  .option('--endDate <date>', 'End date filter (YYYY-MM-DD)')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };

      if (options.startDate) params.startDate = options.startDate;
      if (options.endDate) params.endDate = options.endDate;

      const events = await getClient().get('/events', params);
      outputResult(events, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

eventsCmd
  .command('update <eventId>')
  .description('Update an event by ID')
  .requiredOption('-d, --data <json>', 'JSON payload for event update')
  .action(async (eventId, options) => {
    try {
      validatePositiveInt(eventId, 'eventId');
      const payload = parseJsonPayload(options);
      const result = await getClient().put(`/events/${eventId}`, payload);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

eventsCmd
  .command('delete <eventId>')
  .description('Delete an event by ID')
  .action(async (eventId) => {
    try {
      validatePositiveInt(eventId, 'eventId');
      const result = await getClient().delete(`/events/${eventId}`);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Saved Lists commands
const savedListsCmd = program
  .command('saved-lists')
  .description('Manage saved lists');

savedListsCmd
  .command('list')
  .description('List saved lists')
  .option('--top <count>', 'Number of results (max 100)', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: Math.min(options.top, 100), // VAN limits saved lists to 100
        $skip: options.skip
      };
      const lists = await getClient().get('/savedLists', params);
      outputResult(lists, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

savedListsCmd
  .command('update <savedListId>')
  .description('Update a saved list by ID')
  .requiredOption('-d, --data <json>', 'JSON payload for saved list update')
  .action(async (savedListId, options) => {
    try {
      validatePositiveInt(savedListId, 'savedListId');
      const payload = parseJsonPayload(options);
      const result = await getClient().put(`/savedLists/${savedListId}`, payload);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

savedListsCmd
  .command('delete <savedListId>')
  .description('Delete a saved list by ID')
  .action(async (savedListId) => {
    try {
      validatePositiveInt(savedListId, 'savedListId');
      const result = await getClient().delete(`/savedLists/${savedListId}`);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Export Jobs commands
const exportJobsCmd = program
  .command('export-jobs')
  .description('Manage export jobs');

exportJobsCmd
  .command('create')
  .description('Create an export job')
  .requiredOption('-s, --savedListId <id>', 'Saved list ID to export', parseInt)
  .option('-w, --webhookUrl <url>', 'Webhook URL for completion notification')
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data = {
        savedListId: merged.savedListId
      };

      if (merged.webhookUrl) data.webhookUrl = merged.webhookUrl;

      const job = await getClient().post('/exportJobs', data);
      outputResult(job, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

// Canvass Responses commands
const canvassResponsesCmd = program
  .command('canvass-responses')
  .description('Manage canvass responses');

canvassResponsesCmd
  .command('create')
  .description('Create a canvass response')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .requiredOption('-r, --resultCodeId <id>', 'Result code ID', parseInt)
  .option('-c, --canvassContext <context>', 'Canvass context')
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data = {
        vanId: merged.vanId,
        resultCodeId: merged.resultCodeId
      };

      if (merged.canvassContext) data.canvassContext = merged.canvassContext;

      const response = await getClient().post('/canvassResponses', data);
      outputResult(response, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

// Notes commands
const notesCmd = program
  .command('notes')
  .description('Manage notes');

notesCmd
  .command('create')
  .description('Create a note')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .requiredOption('-t, --text <text>', 'Note text')
  .option('-c, --category <category>', 'Note category')
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data = {
        vanId: merged.vanId,
        text: merged.text
      };

      if (merged.category) data.category = merged.category;

      const note = await getClient().post('/notes', data);
      outputResult(note, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

notesCmd
  .command('update <noteId>')
  .description('Update a note by ID')
  .requiredOption('-d, --data <json>', 'JSON payload for note update')
  .action(async (noteId, options) => {
    try {
      validatePositiveInt(noteId, 'noteId');
      const payload = parseJsonPayload(options);
      const result = await getClient().put(`/notes/${noteId}`, payload);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

notesCmd
  .command('delete <noteId>')
  .description('Delete a note by ID')
  .action(async (noteId) => {
    try {
      validatePositiveInt(noteId, 'noteId');
      const result = await getClient().delete(`/notes/${noteId}`);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Contributions commands
const contributionsCmd = program
  .command('contributions')
  .description('Manage contributions');

contributionsCmd
  .command('list')
  .description('List contributions')
  .option('--startDate <date>', 'Start date filter (YYYY-MM-DD)')
  .option('--endDate <date>', 'End date filter (YYYY-MM-DD)')
  .option('--vanId <id>', 'Person VAN ID filter', parseInt)
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };

      if (options.startDate) params.startDate = options.startDate;
      if (options.endDate) params.endDate = options.endDate;
      if (options.vanId) params.vanId = options.vanId;

      const contributions = await getClient().get('/contributions', params);
      outputResult(contributions, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

contributionsCmd
  .command('get <contributionId>')
  .description('Get a contribution by ID')
  .action(async (contributionId, options) => {
    try {
      validatePositiveInt(contributionId, 'contributionId');
      const contribution = await getClient().get(`/contributions/${contributionId}`);
      outputResult(contribution, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Signups commands
const signupsCmd = program
  .command('signups')
  .description('Manage event signups');

signupsCmd
  .command('list')
  .description('List signups')
  .option('--eventId <id>', 'Event ID filter', parseInt)
  .option('--vanId <id>', 'Person VAN ID filter', parseInt)
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };

      if (options.eventId) params.eventId = options.eventId;
      if (options.vanId) params.vanId = options.vanId;

      const signups = await getClient().get('/signups', params);
      outputResult(signups, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

signupsCmd
  .command('create')
  .description('Create a new signup')
  .requiredOption('-e, --eventId <id>', 'Event ID', parseInt)
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .option('-r, --role <role>', 'Person role at event')
  .option('-s, --status <status>', 'Signup status')
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data = {
        eventId: merged.eventId,
        vanId: merged.vanId
      };

      if (merged.role) data.role = merged.role;
      if (merged.status) data.status = merged.status;

      const signup = await getClient().post('/signups', data);
      outputResult(signup, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

signupsCmd
  .command('update <signupId>')
  .description('Update a signup by ID')
  .requiredOption('-d, --data <json>', 'JSON payload for signup update')
  .action(async (signupId, options) => {
    try {
      validatePositiveInt(signupId, 'signupId');
      const payload = parseJsonPayload(options);
      const result = await getClient().put(`/signups/${signupId}`, payload);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

signupsCmd
  .command('delete <signupId>')
  .description('Delete a signup by ID')
  .action(async (signupId) => {
    try {
      validatePositiveInt(signupId, 'signupId');
      const result = await getClient().delete(`/signups/${signupId}`);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Scores commands
const scoresCmd = program
  .command('scores')
  .description('Manage scores');

scoresCmd
  .command('list')
  .description('List score types')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      const scores = await getClient().get('/scores', params);
      outputResult(scores, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

scoresCmd
  .command('apply')
  .description('Apply a score to a person')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .requiredOption('-s, --scoreId <id>', 'Score type ID', parseInt)
  .requiredOption('--value <value>', 'Score value', parseFloat)
  .action(async (options) => {
    try {
      const data = {
        scoreId: options.scoreId,
        value: options.value
      };

      const result = await getClient().post(`/people/${options.vanId}/scores`, data);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Custom Fields commands
const customFieldsCmd = program
  .command('custom-fields')
  .description('Manage custom fields');

customFieldsCmd
  .command('list')
  .description('List custom fields')
  .option('--fieldType <type>', 'Field type filter')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };

      if (options.fieldType) params.fieldType = options.fieldType;

      const fields = await getClient().get('/customFields', params);
      outputResult(fields, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Locations commands
const locationsCmd = program
  .command('locations')
  .description('Manage locations');

locationsCmd
  .command('list')
  .description('List locations')
  .option('--locationType <type>', 'Location type filter')
  .option('--state <state>', 'State filter')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };

      if (options.locationType) params.locationType = options.locationType;
      if (options.state) params.state = options.state;

      const locations = await getClient().get('/locations', params);
      outputResult(locations, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

locationsCmd
  .command('find')
  .description('Find locations by criteria')
  .option('-n, --name <name>', 'Location name')
  .option('-c, --city <city>', 'City name')
  .option('-s, --state <state>', 'State')
  .option('-z, --zip <zip>', 'ZIP code')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };

      if (options.name) params.name = options.name;
      if (options.city) params.city = options.city;
      if (options.state) params.state = options.state;
      if (options.zip) params.zip = options.zip;

      const results = await getClient().get('/locations/find', params);
      outputResult(results, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Bulk Import commands
const bulkImportCmd = program
  .command('bulk-import')
  .description('Manage bulk import jobs');

bulkImportCmd
  .command('list')
  .description('List bulk import jobs')
  .option('--status <status>', 'Job status filter')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };

      if (options.status) params.status = options.status;

      const jobs = await getClient().get('/bulkImportJobs', params);
      outputResult(jobs, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Changed Entity Export Jobs commands
const changedEntityExportCmd = program
  .command('changed-entity-exports')
  .description('Manage changed entity export jobs');

changedEntityExportCmd
  .command('list')
  .description('List changed entity export jobs')
  .option('--status <status>', 'Job status filter')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };

      if (options.status) params.status = options.status;

      const jobs = await getClient().get('/changedEntityExportJobs', params);
      outputResult(jobs, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

changedEntityExportCmd
  .command('create')
  .description('Create a changed entity export job')
  .requiredOption('-f, --dateChangedFrom <date>', 'Start date for changes (YYYY-MM-DD)')
  .option('-t, --dateChangedTo <date>', 'End date for changes (YYYY-MM-DD)')
  .option('-w, --webhookUrl <url>', 'Webhook URL for completion notification')
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data = {
        dateChangedFrom: merged.dateChangedFrom
      };

      if (merged.dateChangedTo) data.dateChangedTo = merged.dateChangedTo;
      if (merged.webhookUrl) data.webhookUrl = merged.webhookUrl;

      const job = await getClient().post('/changedEntityExportJobs', data);
      outputResult(job, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

// Contact Types commands
const contactTypesCmd = program
  .command('contact-types')
  .description('Manage contact types');

contactTypesCmd
  .command('list')
  .description('List contact types')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      const types = await getClient().get('/contactTypes', params);
      outputResult(types, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Event Types commands
const eventTypesCmd = program
  .command('event-types')
  .description('Manage event types');

eventTypesCmd
  .command('list')
  .description('List event types')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      const types = await getClient().get('/eventTypes', params);
      outputResult(types, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Supporter Groups commands
const supporterGroupsCmd = program
  .command('supporter-groups')
  .description('Manage supporter groups');

supporterGroupsCmd
  .command('list')
  .description('List supporter groups')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      const groups = await getClient().get('/supporterGroups', params);
      outputResult(groups, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

supporterGroupsCmd
  .command('create')
  .description('Create a new supporter group')
  .requiredOption('-n, --name <name>', 'Group name')
  .option('-d, --description <desc>', 'Group description')
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data = {
        name: merged.name
      };

      if (merged.description) data.description = merged.description;

      const group = await getClient().post('/supporterGroups', data);
      outputResult(group, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

supporterGroupsCmd
  .command('update <groupId>')
  .description('Update a supporter group by ID')
  .requiredOption('-d, --data <json>', 'JSON payload for supporter group update')
  .action(async (groupId, options) => {
    try {
      validatePositiveInt(groupId, 'groupId');
      const payload = parseJsonPayload(options);
      const result = await getClient().put(`/supporterGroups/${groupId}`, payload);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

supporterGroupsCmd
  .command('delete <groupId>')
  .description('Delete a supporter group by ID')
  .action(async (groupId) => {
    try {
      validatePositiveInt(groupId, 'groupId');
      const result = await getClient().delete(`/supporterGroups/${groupId}`);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// API Key Profiles command
program
  .command('api-key-profiles')
  .description('Get API key profile details for the current API key')
  .action(async () => {
    try {
      const profileDetails = await getClient().get('/apiKeyProfiles');
      outputResult(profileDetails, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Parse command line arguments
program.parseAsync(process.argv);
