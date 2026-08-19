import { Command, program, Option } from 'commander';
import chalk from 'chalk';
import { version } from '../package.json';
import { VanApiError } from './errors';
import { getProfile, checkConfigPermissions } from './config';
import VanApiClient, { DEFAULT_LOGIN_URL } from './client';
import { refreshAccessToken, RefreshRejectedError } from './auth';
import { fetchVanToken } from './vanToken';
import {
  getActiveAccount,
  getSoleAccount,
  getActiveAccountMetadata,
  findAccountByName,
  findAccountMetadataByName,
  listAccountMetadata,
  updateAccountTokens,
  accountKey,
  isBearerTokenExpired,
  bearerTokenExpiry,
  formatAccountStatus,
  type Account,
} from './credentials';
import { runLogin } from './commands/login';
import { runLogout } from './commands/logout';
import { runSwitch } from './commands/switch';
import createActivistCodes from './commands/activistCodes';
import createApiKeyProfiles from './commands/apiKeyProfiles';
import createBulkImport from './commands/bulkImport';
import createCanvassResponses from './commands/canvassResponses';
import createChangedEntityExportJobs from './commands/changedEntityExportJobs';
import createCodes from './commands/codes';
import createContributions from './commands/contributions';
import createCustomFields from './commands/customFields';
import createDesignations from './commands/designations';
import createTargetedEmails from './commands/targetedEmails';
import createEvents from './commands/events';
import createExportJobs from './commands/exportJobs';
import createLocations from './commands/locations';
import createNotes from './commands/notes';
import createPeople from './commands/people';
import createSavedLists from './commands/savedLists';
import createScores from './commands/scores';
import createSignups from './commands/signups';
import createSupporterGroups from './commands/supporterGroups';
import createSurveyQuestions from './commands/surveyQuestions';
import createTargets from './commands/targets';

// Exit code taxonomy so scripts/agents can branch without parsing message text.
const EXIT_API_ERROR = 1;
const EXIT_AUTH_REQUIRED = 2;
const EXIT_VALIDATION_ERROR = 3;

// Node has an open upstream bug on Windows where process.exit() shortly after a fetch()
// call resolves can crash with a libuv assertion (nodejs/node#56645; unresolved as of
// Node 24). A brief delay lets the closing socket handle settle before the event loop
// tears down. Only ever called from the top-level catch in main() below, once the error
// has already been printed, so this is the single place that actually terminates the process.
async function finalizeExit(code: number): Promise<never> {
  await new Promise(resolve => setTimeout(resolve, 100));
  process.exit(code);
}

// Thrown by emitError to unwind synchronously (so validation can't fall through to using
// bad data) without calling process.exit() directly — see finalizeExit() for why.
class CliExit extends Error {
  constructor(public readonly code: number) {
    super('CliExit');
  }
}

// All command failures funnel through here so stderr is always a single JSON object,
// matching the JSON stdout every command already produces via outputResult().
function emitError(code: number, type: string, message: string, extra: Record<string, unknown> = {}): never {
  const payload = { error: { type, message, ...extra } };
  const opts = program.opts();
  console.error(opts.pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload));
  throw new CliExit(code);
}

// For usage mistakes (bad/missing arguments) caught in an action handler before any request
// is attempted — mirrors Commander's own "error: <message>" style (e.g. "unknown command",
// "required option ... not specified") so hand-rolled checks read the same as Commander's.
function emitUsageError(message: string): never {
  console.error(`error: ${message}`);
  throw new CliExit(EXIT_VALIDATION_ERROR);
}

// Resolve API key from: --profile flag > VAN_PROFILE env > VAN_API_KEY env > config [default]
// Deferred until getClient() so --profile flag is available after parsing.
function resolveProfile(): { apiKey: string; appName?: string } | null {
  const globalOpts = program.opts();
  const profileName = globalOpts.profile || process.env.VAN_PROFILE;

  if (profileName) {
    const profile = getProfile(profileName);
    if (!profile || !profile.api_key) {
      emitError(
        EXIT_VALIDATION_ERROR,
        'ProfileNotFound',
        `Profile "${profileName}" not found or has no api_key in config.`,
        { hint: 'Run "van config list" to see available profiles.' }
      );
    }
    return { apiKey: profile.api_key, appName: profile.app_name };
  }

  if (process.env.VAN_API_KEY) {
    return { apiKey: process.env.VAN_API_KEY, appName: process.env.VAN_APP_NAME };
  }

  const defaultProfile = getProfile('default');
  if (defaultProfile?.api_key) {
    return { apiKey: defaultProfile.api_key, appName: defaultProfile.app_name };
  }

  return null;
}

// Create global client instance (deferred until after program parses global options)
let client: VanApiClient | null = null;

// Resolves which stored OAuth account to use for this invocation. An explicit --use-account
// flag or VAN_ACCOUNT env var always wins. Otherwise falls back to the persisted default
// account — but only when that's unambiguous (a single stored account) or a human is
// actually watching (a TTY). Without that guard, a script/agent running many commands
// could silently keep acting on whatever a concurrent `van auth switch` last left default,
// with no one there to notice it changed mid-task.
async function resolveAccountForInvocation(options: { silent?: boolean } = {}): Promise<Account | null> {
  const overrideName = program.opts().useAccount || process.env.VAN_ACCOUNT;

  if (overrideName) {
    const found = await findAccountByName(overrideName);
    if (found) return found.account;
    if (options.silent) return null;
    emitError(EXIT_VALIDATION_ERROR, 'AccountNotFound', `No account found with name "${overrideName}".`, {
      hint: 'Run "van auth status" to see stored accounts.',
    });
  }

  const metas = listAccountMetadata();
  if (metas.length === 0) return null;
  if (metas.length === 1) return getSoleAccount();

  if (!process.stdout.isTTY) {
    if (options.silent) return null;
    emitError(EXIT_VALIDATION_ERROR, 'AmbiguousAccount', 'Multiple accounts are stored and no account was specified.', {
      hint: 'Pass --use-account <name> or set VAN_ACCOUNT.',
      accounts: metas.map(m => m.name ?? m.key),
    });
  }

  return getActiveAccount();
}

async function resolveBearerToken(): Promise<string | null> {
  const account = await resolveAccountForInvocation();
  if (!account) return null;

  // Confirms which committee this specific invocation actually used — printed on stderr
  // (never stdout) so it can't be confused with a *different* invocation's --help banner,
  // and can't interfere with JSON output either.
  const nameLabel = account.name ? ` [${account.name}]` : '';
  console.error(chalk.gray(`Using account: ${formatAccountStatus(account)}${nameLabel}`));

  if (!isBearerTokenExpired(account)) {
    return account.vanBearerToken;
  }

  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), 15_000);
  });

  try {
    const { accessToken, refreshToken } = await Promise.race([
      refreshAccessToken(account.refreshToken),
      timeout,
    ]);

    const tokenData = await Promise.race([
      fetchVanToken(DEFAULT_LOGIN_URL, accessToken, {
        userId: account.userId,
        tenantUri: account.tenantUri,
      }),
      timeout,
    ]);

    if (!tokenData.bearerToken) {
      // Refresh token rejected (expired or rotated away). User must log in again.
      console.error(chalk.yellow('Session expired. Run "van auth login" to re-authenticate.'));
      return null;
    }

    await updateAccountTokens(accountKey(account), {
      vanBearerToken: tokenData.bearerToken,
      vanBearerTokenExpiry: bearerTokenExpiry(),
      refreshToken,
    });

    return tokenData.bearerToken;
  } catch (err) {
    if (err instanceof RefreshRejectedError) {
      console.error(chalk.yellow('Session expired. Run "van auth login" to re-authenticate.'));
    } else {
      const detail = err instanceof Error && err.message === 'timeout' ? 'timed out' : 'hit a network or server error';
      console.error(chalk.yellow(`Could not refresh your session (${detail}). Try again in a moment, or run "van auth login" if this keeps happening.`));
    }
    return null;
  } finally {
    clearTimeout(timer!);
  }
}

async function getClient() {
  if (!client) {
    const globalOpts = program.opts();

    // Bearer auth takes priority when van login has been used.
    const bearerToken = await resolveBearerToken();
    if (bearerToken) {
      client = new VanApiClient({
        bearerToken,
        dryRun: globalOpts.dryRun ?? false,
      });
      return client;
    }

    const resolved = resolveProfile();
    if (!resolved) {
      emitError(EXIT_AUTH_REQUIRED, 'AuthRequired', 'No credentials found.', {
        hints: [
          'van auth login         Log in with your ActionID account',
          '--profile <name>       Use a named API key profile',
          'VAN_API_KEY=<key>      Environment variable for API key',
          '~/.van/config          Add api_key under [default]',
        ],
      });
    }

    const warning = checkConfigPermissions();
    if (warning) console.error(chalk.yellow(warning));

    client = new VanApiClient({
      apiKey: resolved.apiKey,
      appName: resolved.appName,
      dryRun: globalOpts.dryRun ?? false,
    });
  }
  return client;
}

// Valid $expand values for GET /people/{vanId} endpoint.
const PEOPLE_GET_EXPANDS = [
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

// Valid $expand values for GET /people endpoint.
const PEOPLE_LIST_EXPANDS = [
  'Addresses',
  'Emails',
  'Phones',
  'Districts',
  'PollingLocation'
];

// Valid $expand values for GET /events/{eventId} endpoint.
const EVENTS_GET_EXPANDS = [
  'locations',
  'codes',
  'shifts',
  'roles',
  'notes',
  'financialProgram',
  'ticketCategories',
  'voterRegistrationBatches'
];

// Valid $expand values for GET /events endpoint.
const EVENTS_LIST_EXPANDS = [
  'locations',
  'codes',
  'shifts',
  'roles',
  'notes',
  'financialProgram',
  'ticketCategories',
  'onlineForms'
];

// Valid $expand values for GET /designations/{designationId} endpoint.
const DESIGNATIONS_GET_EXPANDS = [
  'paymentTypes',
  'attributionTypes',
  'bankAccounts',
  'disclosureFields'
];

// Valid $expand values for GET /codes endpoint.
const CODES_LIST_EXPANDS = [
  'supportedEntities'
];

// Valid $expand values for GET /codes/{codeId} endpoint.
const CODES_GET_EXPANDS = [
  'directResponsePlanDetails',
  'glFundDetails',
  'generalLedgerFund',
  'costCenter',
  'revenueStream',
  'directResponsePlan',
  'mailMergeTemplate',
  'supportedEntities'
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

function handleError(error: unknown): never {
  if (error instanceof CliExit) {
    // Already printed by emitError — pass it through unchanged rather than re-wrapping it.
    throw error;
  }
  if (error instanceof VanApiError) {
    emitError(EXIT_API_ERROR, 'VanApiError', error.message, { status: error.status });
  } else if (error instanceof Error) {
    emitError(EXIT_API_ERROR, error.name, error.message);
  } else {
    emitError(EXIT_API_ERROR, 'UnknownError', 'An unexpected error occurred.');
  }
}

function parseGlobalJsonPayload(options: Record<string, unknown>) {
  const raw = options.json;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw as string);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('--json value must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    emitError(EXIT_VALIDATION_ERROR, 'InvalidJson', 'Invalid JSON in --json flag.', {
      hint: `Ensure your JSON is properly quoted. Example: --json '{"firstName":"John"}'`,
    });
  }
}

function parseJsonPayload(options: Record<string, unknown>) {
  const raw = options.data || options.json;
  if (!raw) {
    throw new Error('JSON payload is required. Pass --data "{...}"');
  }
  try {
    return JSON.parse(raw as string) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid JSON payload. Ensure the value is valid JSON.');
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
    emitError(EXIT_VALIDATION_ERROR, 'ValidationError', `${label} must be a positive integer, got: "${value}"`);
  }
  return num;
}

function validateNonemptyString(value: string, label: string): string {
  if ((value || "").length < 1) {
    emitError(EXIT_VALIDATION_ERROR, 'ValidationError', `${label} must be a valid string: "${value}"`);
  }
  return value;
}

function validateDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    emitError(EXIT_VALIDATION_ERROR, 'ValidationError', `${label} must be a valid date in YYYY-MM-DD format, got: "${value}"`);
  }
  const parsed = new Date(value + 'T00:00:00');
  if (Number.isNaN(parsed.getTime())) {
    emitError(EXIT_VALIDATION_ERROR, 'ValidationError', `${label} is not a valid date: "${value}"`);
  }
  return value;
}

function validateWebhookUrl(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    emitError(EXIT_VALIDATION_ERROR, 'ValidationError', `${label} must be a valid URL, got: "${value}"`);
  }
  if (parsed.protocol !== 'https:') {
    emitError(EXIT_VALIDATION_ERROR, 'ValidationError', `${label} must use HTTPS`);
  }
  const hostname = parsed.hostname.toLowerCase();
  const privatePatterns = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
  const privateRanges = ['10.', '192.168.', '169.254.'];
  if (
    privatePatterns.includes(hostname) ||
    privateRanges.some(prefix => hostname.startsWith(prefix)) ||
    hostname.startsWith('172.') && (() => {
      const second = parseInt(hostname.split('.')[1], 10);
      return second >= 16 && second <= 31;
    })()
  ) {
    emitError(EXIT_VALIDATION_ERROR, 'ValidationError', `${label} must not point to a private/internal address`);
  }
  return value;
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

function optionTakesValue(option: { required: unknown; optional: unknown }) {
  return Boolean(option.required || option.optional);
}

function findSubcommand(command: Command, token: string) {
  return command.commands.find((sub: Command) => sub.name() === token || sub.aliases().includes(token));
}

function getCompletionCandidates(command: Command, words: string[]) {
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
    .filter((sub: Command & { _hidden?: boolean }) => !sub._hidden)
    .map((sub: Command) => sub.name());

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

  for (const cmd of program.commands as (Command & { _hidden?: boolean })[]) {
    if (cmd._hidden || ['completion', 'schema', 'config'].includes(cmd.name())) continue;
    const resourceName = cmd.name();
    const actions: Record<string, unknown> = {};

    // If the command has subcommands, introspect each
    if (cmd.commands && cmd.commands.length > 0) {
      for (const sub of cmd.commands as (Command & { _hidden?: boolean })[]) {
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

function extractCommandSchema(cmd: Command) {
  const schema: Record<string, unknown> = {
    description: cmd.description(),
  };

  // Arguments
  const args = cmd.registeredArguments ?? [];
  if (args.length > 0) {
    schema.arguments = args.map((arg: { name(): string; required: boolean; description: string }) => ({
      name: arg.name(),
      required: arg.required,
      description: arg.description || undefined,
    }));
  }

  // Options
  const skipFlags = ['--pretty', '--json', '--dry-run', '--fields', '--profile', '-V', '--version', '-h', '--help'];
  const options = cmd.options.filter(opt => {
    // Skip inherited global options
    return !skipFlags.includes(opt.long ?? '') &&
           !skipFlags.includes(opt.short ?? '');
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

// This banner is built before Commander parses argv (its text has to already exist for
// --help), so a --use-account override can't be read via program.opts() yet — scan argv
// manually instead. Metadata-only (no secret store lookup) so --help stays fast.
function findAccountOverrideInArgv(argv: string[]): string | undefined {
  const idx = argv.findIndex(arg => arg === '--use-account' || arg.startsWith('--use-account='));
  if (idx === -1) return undefined;
  const arg = argv[idx];
  return arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[idx + 1];
}

const loginStatus = (() => {
  const accountOverride = findAccountOverrideInArgv(process.argv) || process.env.VAN_ACCOUNT;
  if (accountOverride) {
    const meta = findAccountMetadataByName(accountOverride);
    return meta
      ? chalk.green(`Using account: ${formatAccountStatus(meta)} [${accountOverride}] (override)`)
      : chalk.yellow(`--use-account/VAN_ACCOUNT "${accountOverride}" not found. Run "van auth status" to see stored accounts.`);
  }
  const account = getActiveAccountMetadata();
  if (!account) return '';
  return chalk.green(`Default account: ${formatAccountStatus(account)}`);
})();

program
  .name('van')
  .description(
    'NGP VAN API CLI tool.' +
    (loginStatus ? `\n${loginStatus}` : '') +
    '\n\nSupports --json, --dry-run, --fields, and --profile for agent-friendly usage.' +
    '\nRun "van schema" for a full machine-readable list of commands, arguments, and options.' +
    '\n\nAPI docs: https://docs.ngpvan.com (append .md for agent-consumable format, e.g. https://docs.ngpvan.com/reference/people.md)'
  )
  .version(version)
  .option('-p, --pretty', 'Pretty-print JSON output')
  .option('--json <payload>', 'Raw JSON object to merge with CLI options (CLI flags take precedence)')
  .option('--dry-run', 'Print the HTTP request that would be made without executing it')
  .option('--fields <keys>', 'Comma-separated list of fields to include in the output')
  .option('--profile <name>', 'Use a named profile from ./.van/config or ~/.van/config (overrides VAN_PROFILE env)')
  .option('--use-account <name>', 'Use a specific stored login account for this command only, without changing the default (also settable via VAN_ACCOUNT)');

// --- Auth commands ---

const authCmd = program
  .command('auth')
  .description(
    'Manage authentication accounts\n                        login [--committee --name --device-code] | logout [--account] | switch [--account] | status' +
    '\n\n                        Three ways to pick which stored account a command uses, in order of scope:' +
    '\n                          --use-account <name>   this single command only, changes nothing' +
    '\n                          VAN_ACCOUNT=<name>     this shell session only' +
    '\n                          auth switch            the persistent default for every session, until switched again'
  );

authCmd
  .command('login')
  .description('Log in with your ActionID account via browser')
  .option('--name <name>', 'Alias for this account')
  .option('--committee <name>', 'Committee name to select (partial match, skips interactive prompt)')
  .option('--device-code', 'Use a device code instead of a local browser redirect (for SSH/headless sessions)')
  .action(async (options) => {
    try {
      await runLogin(options.name, options.committee, options.deviceCode);
    } catch (err) {
      handleError(err);
    }
  });

authCmd
  .command('logout')
  .description('Remove a stored account')
  .option('--account <name>', 'Log out of a named account directly')
  .action(async (opts) => {
    try {
      await runLogout(opts.account);
    } catch (err) {
      handleError(err);
    }
  });

authCmd
  .command('switch')
  .description('Set the persistent default account used when no --use-account/VAN_ACCOUNT override is given')
  .option('--account <name>', 'Set the default directly to a named account, skipping the interactive picker')
  .action(async (options) => {
    try {
      await runSwitch(options.account);
    } catch (err) {
      handleError(err);
    }
  });

authCmd
  .command('status')
  .description('Show stored accounts, which is the persistent default, and which would actually be used right now')
  .action(async () => {
    const metas = listAccountMetadata();
    const effective = await resolveAccountForInvocation({ silent: true });
    const effectiveKey = effective ? accountKey(effective) : undefined;

    const data = metas.map(({ key, userName, committeeName, name, isActive }) => ({
      key,
      userName,
      committeeName,
      name,
      isActive,
      isEffective: key === effectiveKey,
    }));
    outputResult(data, program.opts());
  });

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
      const suggestion = suggestClosest(resourceKey, allResources);
      emitError(EXIT_VALIDATION_ERROR, 'UnknownResource', `Unknown resource: "${resourceKey}".`, suggestion ? { suggestion } : {});
    }

    if (!actionKey) {
      outputResult(data[resourceKey], program.opts());
      return;
    }

    const actions = data[resourceKey].actions as Record<string, unknown>;
    const allActions = Object.keys(actions);
    if (!actions[actionKey]) {
      const suggestion = suggestClosest(actionKey, allActions);
      emitError(EXIT_VALIDATION_ERROR, 'UnknownAction', `Unknown action: "${actionKey}" for resource "${resourceKey}".`, suggestion ? { suggestion } : {});
    }

    outputResult(actions[actionKey], program.opts());
  });

// --- People ---

const peopleCmd = program
  .command('people')
  .description('Manage people');

peopleCmd
  .command('get <vanId>')
  .description('Get a person by VAN ID')
  .option('-e, --expand <fields>', 'Expand related fields (comma-separated). See: van people expand-fields')
  .action(async (vanId, options) => {
    try {
      validatePositiveInt(vanId, 'vanId');
      const api = createPeople(await getClient());
      const person = await api.get(vanId, options.expand ? { $expand: options.expand } : {});
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
      const api = createPeople(await getClient());
      const result = await api.update(vanId, merged);
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
      const api = createPeople(await getClient());
      const result = await api.delete(vanId);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

peopleCmd
  .command('list')
  .alias('find')
  .description('List people by criteria')
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

      const criteria: Record<string, unknown> = {
        top: merged.top,
        skip: merged.skip
      };
      const defaultCriteriaKeyCount = Object.keys(criteria).length;

      if (merged.firstName) criteria.firstName = merged.firstName;
      if (merged.lastName) criteria.lastName = merged.lastName;
      if (merged.middleName) criteria.middleName = merged.middleName;
      if (merged.streetAddress) criteria.streetAddress = merged.streetAddress;
      if (merged.city) criteria.city = merged.city;
      if (merged.stateOrProvince) criteria.stateOrProvince = merged.stateOrProvince;
      if (merged.zipOrPostalCode) criteria.zipOrPostalCode = merged.zipOrPostalCode;
      if (merged.phoneNumber) criteria.phoneNumber = merged.phoneNumber;
      if (merged.phone) criteria.phone = merged.phone;
      if (merged.email) criteria.email = merged.email;
      if (merged.dateOfBirth) criteria.dateOfBirth = validateDate(merged.dateOfBirth as string, 'dateOfBirth');
      if (merged.employer) criteria.employer = merged.employer;
      if (merged.occupation) criteria.occupation = merged.occupation;
      if (merged.commonName) criteria.commonName = merged.commonName;
      if (merged.officialName) criteria.officialName = merged.officialName;
      if (merged.contactMode) criteria.contactMode = merged.contactMode;
      if (merged.orderby) criteria.$orderby = merged.orderby;
      if (merged.expand) criteria.$expand = merged.expand;

      if (Object.keys(criteria).length === defaultCriteriaKeyCount) {
        emitUsageError('This endpoint requires at least one search parameter, such as --firstName, --lastName, or --email.');
      }

      const api = createPeople(await getClient());
      const results = await api.list(criteria);
      outputResult(results, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

peopleCmd
  .command('quick-search')
  .description('Fuzzy search people/orgs by a single name string')
  .requiredOption('-n, --name <name>', 'Name query (example: John Smith)')
  .option('--expand <fields>', 'Expand related fields (comma-separated). See: van people expand-fields')
  .action(async (options) => {
    try {
      const criteria: Record<string, unknown> = {
        name: options.name,
      };

      if (options.expand) criteria.$expand = options.expand;

      const api = createPeople(await getClient());
      const results = await api.quickSearch(criteria);
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

      const data: Record<string, unknown> = {
        firstName: merged.firstName,
        lastName: merged.lastName
      };

      if (merged.email) data.email = merged.email;
      if (merged.phone) data.phone = merged.phone;

      const api = createPeople(await getClient());
      const result = await api.findOrCreate(data);
      outputResult(result, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

peopleCmd
  .command('create')
  .description('Create a new person')
  .requiredOption('-f, --firstName <name>', 'First name')
  .requiredOption('-l, --lastName <name>', 'Last name')
  .option('-e, --email <email>', 'Email address')
  .option('-p, --phone <phone>', 'Phone number')
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);

      const data: Record<string, unknown> = {
        firstName: merged.firstName,
        lastName: merged.lastName
      };

      if (merged.email) data.email = merged.email;
      if (merged.phone) data.phone = merged.phone;

      const api = createPeople(await getClient());
      const result = await api.create(data);
      outputResult(result, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

peopleCmd
  .command('expand-fields')
  .description('List $expand fields for people endpoints')
  .action(() => {
    outputResult({
      resource: 'people',
      endpointExpandFields: {
        '/people': PEOPLE_LIST_EXPANDS,
        '/people/{vanId}': PEOPLE_GET_EXPANDS
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

// --- Email ---

const targetedEmailsCmd = program
  .command('targeted-emails')
  .description('Manage targeted emails');

targetedEmailsCmd
  .command('list')
  .description('List batch emails')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const api = createTargetedEmails(await getClient());
      outputResult(await api.list(options), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

targetedEmailsCmd
  .command('get <emailId>')
  .description('Get an email by foreignMessageId')
  .action(async (foreignMessageId) => {
    try {
      validateNonemptyString(foreignMessageId, 'foreignMessageId');
      const api = createTargetedEmails(await getClient());
      outputResult(await api.get(foreignMessageId), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// --- Activist Codes ---

const activistCodesCmd = program
  .command('activist-codes')
  .description('Manage activist codes');

activistCodesCmd
  .command('list')
  .description('List all activist codes, or activist codes applied to a person if --vanId is given')
  .option('-v, --vanId <id>', 'Person VAN ID (returns codes applied to that person)', parseInt)
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const api = createActivistCodes(await getClient());
      const codes = await api.list(options);
      outputResult(codes, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

activistCodesCmd
  .command('get <activistCodeId>')
  .description('Get an activist code by ID')
  .action(async (activistCodeId) => {
    try {
      validatePositiveInt(activistCodeId, 'activistCodeId');
      const api = createActivistCodes(await getClient());
      const code = await api.get(activistCodeId);
      outputResult(code, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// --- Codes ---

const codesCmd = program
  .command('codes')
  .description('Manage codes (source codes and tags)');

codesCmd
  .command('list')
  .description('List/search codes')
  .option('--name <name>', 'Filter by name')
  .option('--parentCodeId <id>', 'Filter by parent code ID', parseInt)
  .option('--entityType <id>', 'Filter by entity type ID (EntityTypes table)')
  .addOption(new Option('--codeType <type>', 'Filter by code type').choices(['SourceCode', 'Tag']))
  .option('--supportedEntities <names>', 'Comma-separated entity type names to filter by')
  .option('--orderby <expr>', 'OData $orderby expression (supports dateModified)')
  .option('-e, --expand <fields>', 'Expand related fields (comma-separated). See: van codes expand-fields')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const listOptions: Record<string, unknown> = {
        top: options.top,
        skip: options.skip
      };

      if (options.name) listOptions.name = options.name;
      if (options.parentCodeId) listOptions.parentCodeId = options.parentCodeId;
      if (options.entityType) listOptions.entityType = options.entityType;
      if (options.codeType) listOptions.codeType = options.codeType;
      if (options.supportedEntities) listOptions.supportedEntities = options.supportedEntities.split(',').map((s: string) => s.trim());
      if (options.orderby) listOptions.orderby = options.orderby;
      if (options.expand) listOptions.expand = options.expand;

      const api = createCodes(await getClient());
      outputResult(await api.list(listOptions), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

codesCmd
  .command('get <codeId>')
  .description('Get a code by ID')
  .option('-e, --expand <fields>', 'Expand related fields (comma-separated). See: van codes expand-fields')
  .action(async (codeId, options) => {
    try {
      validatePositiveInt(codeId, 'codeId');
      const api = createCodes(await getClient());
      outputResult(await api.get(codeId, options.expand ? { expand: options.expand } : {}), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

codesCmd
  .command('supported-entities')
  .description('List entity type names supported for codeType=Tag')
  .action(async () => {
    try {
      const api = createCodes(await getClient());
      outputResult(await api.supportedEntities(), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

codesCmd
  .command('is-duplicate-name')
  .description('Check whether a code name is already in use')
  .requiredOption('-n, --name <name>', 'Name to check')
  .addOption(new Option('--codeType <type>', 'Code type to check against (default: SourceCode)').choices(['SourceCode', 'Tag']))
  .action(async (options) => {
    try {
      const api = createCodes(await getClient());
      outputResult(await api.isDuplicateName(options.name, options.codeType ? { codeType: options.codeType } : {}), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

codesCmd
  .command('create')
  .description('Create a new code')
  .requiredOption('-n, --name <name>', 'Code name (max 50 chars)')
  .option('-d, --description <text>', 'Code description (max 200 chars)')
  .option('--parentCodeId <id>', 'Parent code ID (must be an existing code of the same codeType)', parseInt)
  .addOption(new Option('--codeType <type>', 'Code type (default: SourceCode)').choices(['SourceCode', 'Tag']))
  .option('--supportedEntities <json>', 'JSON array of {name, isSearchable, isApplicable} (required if codeType is Tag)')
  .option('--campaignId <id>', 'Campaign ID (SourceCode only)', parseInt)
  .option('--contactTypeId <id>', 'Contact type ID (SourceCode only)', parseInt)
  .option('--revenueStreamId <id>', 'Revenue stream ID (SourceCode only)', parseInt)
  .option('--mailMergeTemplateId <id>', 'Mail merge template ID (SourceCode only)', parseInt)
  .option('--generalLedgerFundId <id>', 'General ledger fund ID (SourceCode only)', parseInt)
  .option('--costCenterId <id>', 'Cost center ID (SourceCode only)', parseInt)
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data: Record<string, unknown> = {
        name: merged.name
      };

      if (merged.description !== undefined) data.description = merged.description;
      if (merged.parentCodeId !== undefined) data.parentCodeId = merged.parentCodeId;
      if (merged.codeType !== undefined) data.codeType = merged.codeType;
      if (merged.supportedEntities) data.supportedEntities = JSON.parse(merged.supportedEntities as string);
      if (merged.campaignId !== undefined) data.campaignId = merged.campaignId;
      if (merged.contactTypeId !== undefined) data.contactTypeId = merged.contactTypeId;
      if (merged.revenueStreamId !== undefined) data.revenueStreamId = merged.revenueStreamId;
      if (merged.mailMergeTemplateId !== undefined) data.mailMergeTemplateId = merged.mailMergeTemplateId;
      if (merged.generalLedgerFundId !== undefined) data.generalLedgerFundId = merged.generalLedgerFundId;
      if (merged.costCenterId !== undefined) data.costCenterId = merged.costCenterId;

      const api = createCodes(await getClient());
      outputResult(await api.create(data), globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

codesCmd
  .command('update <codeId>')
  .description('Update a code by ID (fetches existing code then applies specified changes)')
  .option('-n, --name <name>', 'Code name (max 50 chars)')
  .option('--parentCodeId <id>', 'Parent code ID (must be an existing code of the same codeType)', parseInt)
  .action(async (codeId, options) => {
    try {
      validatePositiveInt(codeId, 'codeId');
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data: Record<string, unknown> = {};

      if (merged.name !== undefined) data.name = merged.name;
      if (merged.parentCodeId !== undefined) data.parentCodeId = merged.parentCodeId;

      const api = createCodes(await getClient());
      outputResult(await api.update(codeId, data), globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

codesCmd
  .command('delete <codeId>')
  .description('Delete a code by ID')
  .action(async (codeId) => {
    try {
      validatePositiveInt(codeId, 'codeId');
      const api = createCodes(await getClient());
      const result = await api.delete(codeId);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

codesCmd
  .command('expand-fields')
  .description('List $expand fields for codes endpoints')
  .action(() => {
    outputResult({
      resource: 'codes',
      endpointExpandFields: {
        '/codes': CODES_LIST_EXPANDS,
        '/codes/{codeId}': CODES_GET_EXPANDS
      },
      notes: [
        'Some expansions are endpoint and permission dependent.',
        'If an expand is invalid for your context, VAN returns an INVALID_PARAMETER with accepted values.'
      ],
      sources: [
        'https://docs.ngpvan.com/reference/codes'
      ]
    }, program.opts());
  });

// --- Survey Questions ---

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
      const api = createSurveyQuestions(await getClient());
      const questions = await api.list(options);
      outputResult(questions, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

surveyQuestionsCmd
  .command('get <surveyQuestionId>')
  .description('Get a survey question by ID')
  .action(async (surveyQuestionId) => {
    try {
      validatePositiveInt(surveyQuestionId, 'surveyQuestionId');
      const api = createSurveyQuestions(await getClient());
      const question = await api.get(surveyQuestionId);
      outputResult(question, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// --- Events ---

const eventsCmd = program
  .command('events')
  .description('Manage events');

eventsCmd
  .command('list')
  .description('List events')
  .option('--startDate <date>', 'Start date filter (YYYY-MM-DD)')
  .option('--endDate <date>', 'End date filter (YYYY-MM-DD)')
  .option('-e, --expand <fields>', 'Expand related fields (comma-separated). See: van events expand-fields')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const listOptions: Record<string, unknown> = {
        top: options.top,
        skip: options.skip
      };

      if (options.startDate) listOptions.startDate = validateDate(options.startDate, 'startDate');
      if (options.endDate) listOptions.endDate = validateDate(options.endDate, 'endDate');

      const api = createEvents(await getClient());
      const events = await api.list(listOptions);
      outputResult(events, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

eventsCmd
  .command('get <eventId>')
  .description('Get an event by ID')
  .option('-e, --expand <fields>', 'Expand related fields (comma-separated). See: van events expand-fields')
  .action(async (eventId, options) => {
    try {
      validatePositiveInt(eventId, 'eventId');
      const api = createEvents(await getClient());
      const event = await api.get(eventId, options.expand ? { $expand: options.expand } : {});
      outputResult(event, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

eventsCmd
  .command('create')
  .description('Create a new event')
  .requiredOption('--eventTypeId <id>', 'Event type ID', parseInt)
  .requiredOption('-n, --name <name>', 'Event name')
  .option('--shortName <name>', 'Short name (defaults to name if omitted)')
  .requiredOption('--startDate <datetime>', 'Start date/time (ISO 8601, e.g. 2026-05-10T10:00:00Z)')
  .requiredOption('--endDate <datetime>', 'End date/time (ISO 8601, e.g. 2026-05-10T12:00:00Z)')
  .requiredOption('--locationId <id>', 'Location ID', parseInt)
  .requiredOption('--roleId <id>', 'Role ID', parseInt)
  .requiredOption('--shiftStartTime <datetime>', 'Shift start time (ISO 8601)')
  .requiredOption('--shiftEndTime <datetime>', 'Shift end time (ISO 8601)')
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data: Record<string, unknown> = {
        eventTypeId: merged.eventTypeId,
        name: merged.name,
        startDate: merged.startDate,
        endDate: merged.endDate,
        locationId: merged.locationId,
        roleId: merged.roleId,
        shiftStartTime: merged.shiftStartTime,
        shiftEndTime: merged.shiftEndTime,
      };
      if (merged.shortName) data.shortName = merged.shortName;
      const api = createEvents(await getClient());
      const event = await api.create(data);
      outputResult(event, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

eventsCmd
  .command('update <eventId>')
  .description('Update an event by ID (fetches existing event then applies specified changes)')
  .option('--eventTypeId <id>', 'Event type ID', parseInt)
  .option('-n, --name <name>', 'Event name')
  .option('--shortName <name>', 'Short name')
  .option('--startDate <datetime>', 'Start date/time (ISO 8601, e.g. 2026-05-10T10:00:00Z)')
  .option('--endDate <datetime>', 'End date/time (ISO 8601, e.g. 2026-05-10T12:00:00Z)')
  .option('--locationId <id>', 'Location ID', parseInt)
  .option('--roleId <id>', 'Role ID', parseInt)
  .option('--shiftStartTime <datetime>', 'Shift start time (ISO 8601)')
  .option('--shiftEndTime <datetime>', 'Shift end time (ISO 8601)')
  .action(async (eventId, options) => {
    try {
      validatePositiveInt(eventId, 'eventId');
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data: Record<string, unknown> = {};
      if (merged.eventTypeId !== undefined) data.eventTypeId = merged.eventTypeId;
      if (merged.name !== undefined) data.name = merged.name;
      if (merged.shortName !== undefined) data.shortName = merged.shortName;
      if (merged.startDate !== undefined) data.startDate = merged.startDate;
      if (merged.endDate !== undefined) data.endDate = merged.endDate;
      if (merged.locationId !== undefined) data.locationId = merged.locationId;
      if (merged.roleId !== undefined) data.roleId = merged.roleId;
      if (merged.shiftStartTime !== undefined) data.shiftStartTime = merged.shiftStartTime;
      if (merged.shiftEndTime !== undefined) data.shiftEndTime = merged.shiftEndTime;
      const api = createEvents(await getClient());
      const result = await api.update(eventId, data);
      outputResult(result, globalOpts);
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
      const api = createEvents(await getClient());
      const result = await api.delete(eventId);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

eventsCmd
  .command('expand-fields')
  .description('List $expand fields for events endpoints')
  .action(() => {
    outputResult({
      resource: 'events',
      endpointExpandFields: {
        '/events': EVENTS_LIST_EXPANDS,
        '/events/{eventId}': EVENTS_GET_EXPANDS
      },
      notes: [
        'Some expansions are endpoint and permission dependent.',
        'If an expand is invalid for your context, VAN returns an INVALID_PARAMETER with accepted values.'
      ],
      sources: [
        'https://docs.ngpvan.com/reference/events-overview',
        'VAN API INVALID_PARAMETER hint for $expand on /events/{eventId}'
      ]
    }, program.opts());
  });

eventsCmd
  .command('event-types [eventTypeId]')
  .description('List all event types, or get a specific event type by ID')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (eventTypeId, options) => {
    try {
      const api = createEvents(await getClient());
      if (eventTypeId) {
        validatePositiveInt(eventTypeId, 'eventTypeId');
        outputResult(await api.getEventType(eventTypeId), program.opts());
      } else {
        const types = await api.listEventTypes(options);
        outputResult(types, program.opts());
      }
    } catch (error) {
      handleError(error);
    }
  });

// --- Saved Lists ---

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
      const api = createSavedLists(await getClient());
      const lists = await api.list(options);
      outputResult(lists, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

savedListsCmd
  .command('get <savedListId>')
  .description('Get a saved list by ID')
  .option('-e, --expand <fields>', 'Expand related fields (comma-separated)')
  .action(async (savedListId, options) => {
    try {
      validatePositiveInt(savedListId, 'savedListId');
      const api = createSavedLists(await getClient());
      const list = await api.get(savedListId, options.expand ? { $expand: options.expand } : {});
      outputResult(list, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// --- Export Jobs ---

const exportJobsCmd = program
  .command('export-jobs')
  .description('Manage export jobs');

exportJobsCmd
  .command('create')
  .description('Create an export job for a saved list. Triggers an async export; the response includes a downloadUrl valid for ~7 hours.')
  .requiredOption('-s, --savedListId <id>', 'Saved list ID to export', parseInt)
  .requiredOption('-w, --webhookUrl <url>', 'Webhook URL for completion notification (must be a reachable public HTTPS URL)')
  .option('--type <id>', 'Export job type ID (default: 4 = SavedListExport, the only standard type)', val => parseInt(val, 10), 4)
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data: Record<string, unknown> = {
        savedListId: merged.savedListId,
        type: merged.type,
        webhookUrl: validateWebhookUrl(merged.webhookUrl as string, 'webhookUrl'),
      };

      const api = createExportJobs(await getClient());
      const job = await api.create(data);
      outputResult(job, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

// --- Canvass Responses ---

const canvassResponsesCmd = program
  .command('canvass-responses')
  .description('Manage canvass responses');

canvassResponsesCmd
  .command('create')
  .description('Create a canvass response for a person')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .option('-r, --resultCodeId <id>', 'Result code ID', parseInt)
  .option('-c, --canvassContext <json>', 'Canvass context (JSON)')
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const api = createCanvassResponses(await getClient());
      const response = await api.create({
        vanId: merged.vanId,
        resultCodeId: merged.resultCodeId,
        canvassContext: merged.canvassContext ? JSON.parse(merged.canvassContext as string) : undefined,
      });
      outputResult(response, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

canvassResponsesCmd
  .command('list')
  .description('List canvass responses for a person')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      validatePositiveInt(options.vanId, 'vanId');
      const api = createCanvassResponses(await getClient());
      const results = await api.list(options);
      outputResult(results, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

canvassResponsesCmd
  .command('input-types')
  .description('List valid canvass response input types')
  .action(async () => {
    try {
      const api = createCanvassResponses(await getClient());
      outputResult(await api.inputTypes(), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

canvassResponsesCmd
  .command('result-codes')
  .description('List valid canvass response result codes')
  .action(async () => {
    try {
      const api = createCanvassResponses(await getClient());
      outputResult(await api.resultCodes(), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

canvassResponsesCmd
  .command('contact-types')
  .description('List valid canvass response contact types')
  .action(async () => {
    try {
      const api = createCanvassResponses(await getClient());
      outputResult(await api.contactTypes(), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// --- Notes ---

const notesCmd = program
  .command('notes')
  .description('Manage notes');

notesCmd
  .command('list')
  .description('List notes for a person')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      validatePositiveInt(options.vanId, 'vanId');
      const api = createNotes(await getClient());
      const notes = await api.list(options.vanId, options);
      outputResult(notes, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

notesCmd
  .command('get <noteId>')
  .description('Get a note by ID')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .action(async (noteId, options) => {
    try {
      validatePositiveInt(options.vanId, 'vanId');
      validatePositiveInt(noteId, 'noteId');
      const api = createNotes(await getClient());
      const note = await api.get(options.vanId, noteId);
      outputResult(note, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

notesCmd
  .command('create')
  .description('Create a note')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .requiredOption('-t, --text <text>', 'Note text')
  .option('-n, --noteCategoryId <id>', 'Note category ID', parseInt)
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);

      const api = createNotes(await getClient());
      const note = await api.create(merged.vanId, {
        text: merged.text,
        noteCategoryId: merged.noteCategoryId
      });
      outputResult(note, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

notesCmd
  .command('update <noteId>')
  .description('Update a note by ID')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .option('-t, --text <text>', 'Note text')
  .option('-n, --noteCategoryId <id>', 'Note category ID', parseInt)
  .action(async (noteId, options) => {
    try {
      validatePositiveInt(options.vanId, 'vanId');
      validatePositiveInt(noteId, 'noteId');
      const api = createNotes(await getClient());
      const result = await api.update(options.vanId, noteId, {
        text: options.text,
        noteCategoryId: options.noteCategoryId
      });
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

notesCmd
  .command('delete <noteId>')
  .description('Delete a note by ID')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .action(async (noteId, options) => {
    try {
      validatePositiveInt(options.vanId, 'vanId');
      validatePositiveInt(noteId, 'noteId');
      const api = createNotes(await getClient());
      const result = await api.delete(options.vanId, noteId);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

notesCmd
  .command('categories')
  .description('List valid note categories')
  .action(async () => {
    try {
      const api = createNotes(await getClient());
      outputResult(await api.categories(), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// --- Contributions ---

const contributionsCmd = program
  .command('contributions')
  .description('Manage contributions');

contributionsCmd
  .command('list <vanId>')
  .description('List contributions for a person')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (vanId, options) => {
    try {
      validatePositiveInt(vanId, 'vanId');
      const api = createContributions(await getClient());
      outputResult(await api.list(vanId, options), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

contributionsCmd
  .command('get <contributionId>')
  .description('Get a contribution by ID')
  .action(async (contributionId) => {
    try {
      validatePositiveInt(contributionId, 'contributionId');
      const api = createContributions(await getClient());
      outputResult(await api.get(contributionId), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

contributionsCmd
  .command('create')
  .description('Create a contribution')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .requiredOption('-a, --amount <amount>', 'Contribution amount', parseFloat)
  .requiredOption('-d, --dateReceived <date>', 'Date received (YYYY-MM-DD)')
  .requiredOption('--designationId <id>', 'Designation ID', parseInt)
  .requiredOption('--status <status>', 'Contribution status')
  .requiredOption('--paymentType <type>', 'Payment type')
  .action(async (options) => {
    try {
      validateDate(options.dateReceived, 'dateReceived');
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const api = createContributions(await getClient());
      outputResult(await api.create(merged), globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

contributionsCmd
  .command('update <contributionId>')
  .description('Update a contribution by ID (fetches existing contribution then applies specified changes)')
  .option('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .option('-a, --amount <amount>', 'Contribution amount', parseFloat)
  .option('-d, --dateReceived <date>', 'Date received (YYYY-MM-DD)')
  .option('--designationId <id>', 'Designation ID', parseInt)
  .option('--status <status>', 'Contribution status')
  .option('--paymentType <type>', 'Payment type')
  .action(async (contributionId, options) => {
    try {
      validatePositiveInt(contributionId, 'contributionId');
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data: Record<string, unknown> = {};
      if (merged.vanId !== undefined) data.vanId = merged.vanId;
      if (merged.amount !== undefined) data.amount = merged.amount;
      if (merged.dateReceived !== undefined) data.dateReceived = merged.dateReceived;
      if (merged.designationId !== undefined) data.designationId = merged.designationId;
      if (merged.status !== undefined) data.status = merged.status;
      if (merged.paymentType !== undefined) data.paymentType = merged.paymentType;
      const api = createContributions(await getClient());
      outputResult(await api.update(contributionId, data), globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

// --- Designations ---

const designationsCmd = program
  .command('designations')
  .description('Manage designations');

designationsCmd
  .command('list')
  .description('List designations')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const api = createDesignations(await getClient());
      outputResult(await api.list(options), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

designationsCmd
  .command('get <designationId>')
  .description('Get a designation by ID')
  .option('-e, --expand <fields>', 'Expand related fields (comma-separated). See: van designations expand-fields')
  .action(async (designationId, options) => {
    try {
      validatePositiveInt(designationId, 'designationId');
      const api = createDesignations(await getClient());
      outputResult(await api.get(designationId, options), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

designationsCmd
  .command('expand-fields')
  .description('List $expand fields for designations endpoints')
  .action(() => {
    outputResult({
      resource: 'designations',
      endpointExpandFields: {
        '/designations/{designationId}': DESIGNATIONS_GET_EXPANDS
      },
      notes: [
        'If an expand is invalid for your context, VAN returns an INVALID_PARAMETER with accepted values.'
      ],
      sources: [
        'https://docs.ngpvan.com/reference/getdesignationbyid',
        'VAN API INVALID_PARAMETER hint for $expand on /events/{eventId}'
      ]
    }, program.opts());
  });

// --- Signups ---

const signupsCmd = program
  .command('signups')
  .description('Manage event signups');

signupsCmd
  .command('list')
  .description('List signups filtered by eventId, vanId, or both (at least one required)')
  .option('-e, --eventId <id>', 'Event ID', parseInt)
  .option('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      if (!options.eventId && !options.vanId) {
        emitError(EXIT_VALIDATION_ERROR, 'ValidationError', 'At least one of --eventId or --vanId is required.');
      }
      const api = createSignups(await getClient());
      const signups = await api.list(options);
      outputResult(signups, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

signupsCmd
  .command('get <eventSignupId>')
  .description('Get an event signup by ID')
  .action(async (eventSignupId) => {
    try {
      validatePositiveInt(eventSignupId, 'eventSignupId');
      const api = createSignups(await getClient());
      outputResult(await api.get(eventSignupId), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

signupsCmd
  .command('create')
  .description('Create a new signup')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .requiredOption('-e, --eventId <id>', 'Event ID', parseInt)
  .requiredOption('--eventShiftId <id>', 'Event shift ID', parseInt)
  .requiredOption('--roleId <id>', 'Role ID', parseInt)
  .requiredOption('--statusId <id>', 'Status ID', parseInt)
  .requiredOption('--locationId <id>', 'Location ID', parseInt)
  .action(async (options) => {
    try {
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data: Record<string, unknown> = {
        vanId: merged.vanId,
        eventId: merged.eventId,
        eventShiftId: merged.eventShiftId,
        roleId: merged.roleId,
        statusId: merged.statusId,
        locationId: merged.locationId,
      };

      const api = createSignups(await getClient());
      const signup = await api.create(data);
      outputResult(signup, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

signupsCmd
  .command('update <signupId>')
  .description('Update a signup by ID (fetches existing signup then applies specified changes)')
  .option('--eventShiftId <id>', 'Event Shift ID')
  .option('--roleId <id>', 'Role ID')
  .option('--statusId <id>', 'Status ID')
  .option('--locationId <id>', 'Location ID')
  .action(async (signupId, options) => {
    try {
      validatePositiveInt(signupId, 'signupId');
      const globalOpts = program.opts();
      const merged = mergeJsonOption(options, globalOpts);
      const data: Record<string, unknown> = {};
      if (merged.eventShiftId !== undefined) data.eventShiftId = merged.eventShiftId;
      if (merged.roleId !== undefined) data.roleId = merged.roleId;
      if (merged.statusId !== undefined) data.statusId = merged.statusId;
      if (merged.locationId !== undefined) data.locationId = merged.locationId;
      const api = createSignups(await getClient());
      outputResult(await api.update(signupId, data), globalOpts);
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
      const api = createSignups(await getClient());
      const result = await api.delete(signupId);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// --- Scores ---

const scoresCmd = program
  .command('scores')
  .description('Manage scores');

scoresCmd
  .command('list')
  .description('List scores')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const api = createScores(await getClient());
      const scores = await api.list(options);
      outputResult(scores, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

scoresCmd
  .command('get <scoreId>')
  .description('Get a score by ID')
  .action(async (scoreId) => {
    try {
      validatePositiveInt(scoreId, 'scoreId');
      const api = createScores(await getClient());
      outputResult(await api.get(scoreId), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

scoresCmd
  .command('get-by-person <vanId>')
  .description('List scores assigned to a person')
  .action(async (vanId) => {
    try {
      validatePositiveInt(vanId, 'vanId');
      const api = createScores(await getClient());
      outputResult(await api.getByPerson(vanId), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// --- Custom Fields ---

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
      const api = createCustomFields(await getClient());
      const fields = await api.list(options);
      outputResult(fields, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// --- Locations ---

const locationsCmd = program
  .command('locations')
  .description('Manage locations');

locationsCmd
  .command('list')
  .description('List locations')
  .option('-n, --name <name>', 'Location name filter')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const api = createLocations(await getClient());
      const locations = await api.list(options);
      outputResult(locations, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

locationsCmd
  .command('get <locationId>')
  .description('Get a location by ID')
  .action(async (locationId) => {
    try {
      validatePositiveInt(locationId, 'locationId');
      const api = createLocations(await getClient());
      outputResult(await api.get(locationId), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

locationsCmd
  .command('create')
  .description('Create a location')
  .requiredOption('-n, --name <name>', 'Name of location')
  .option('--displayName <name>', 'Display name of location')
  .option('--addressLine1 <address>', 'Address Line 1')
  .option('--addressLine2 <address>', 'Address Line 2')
  .option('--city <city>', 'City')
  .option('--stateOrProvince <state>', 'State or Province')
  .option('--zipOrPostalCode <zip>', 'Zip or Postal Code')
  .option('--countryCode <country>', 'Country Code')
  .action(async (options) => {
    try {
      const api = createLocations(await getClient());
      outputResult(await api.create(options), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

locationsCmd
  .command('find-or-create')
  .description('Find or Create a location')
  .requiredOption('-n, --name <name>', 'Name of location')
  .option('--displayName <name>', 'Display name of location')
  .option('--addressLine1 <address>', 'Address Line 1')
  .option('--addressLine2 <address>', 'Address Line 2')
  .option('--city <city>', 'City')
  .option('--stateOrProvince <state>', 'State or Province')
  .option('--zipOrPostalCode <zip>', 'Zip or Postal Code')
  .option('--countryCode <country>', 'Country Code')
  .action(async (options) => {
    try {
      const api = createLocations(await getClient());
      outputResult(await api.findOrCreate(options), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

locationsCmd
  .command('delete <locationId>')
  .description('Delete a location by ID')
  .action(async (locationId) => {
    try {
      validatePositiveInt(locationId, 'locationId');
      const api = createLocations(await getClient());
      const result = await api.delete(locationId);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// --- Bulk Import ---

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
      const api = createBulkImport(await getClient());
      const jobs = await api.list(options);
      outputResult(jobs, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// --- Changed Entity Export Jobs ---

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
      const api = createChangedEntityExportJobs(await getClient());
      const jobs = await api.list(options);
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
      const data: Record<string, unknown> = {
        dateChangedFrom: validateDate(merged.dateChangedFrom as string, 'dateChangedFrom')
      };

      if (merged.dateChangedTo) data.dateChangedTo = validateDate(merged.dateChangedTo as string, 'dateChangedTo');
      if (merged.webhookUrl) data.webhookUrl = validateWebhookUrl(merged.webhookUrl as string, 'webhookUrl');

      const api = createChangedEntityExportJobs(await getClient());
      const job = await api.create(data);
      outputResult(job, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

// --- Supporter Groups ---

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
      const api = createSupporterGroups(await getClient());
      const groups = await api.list(options);
      outputResult(groups, program.opts());
    } catch (error) {
      handleError(error);
    }
  });
  
supporterGroupsCmd
  .command('get <supporterGroupId>')
  .description('Get a Supporter Group by ID')
  .action(async (supporterGroupId) => {
    try {
      validatePositiveInt(supporterGroupId, 'supporterGroupId');
      const api = createSupporterGroups(await getClient());
      outputResult(await api.get(supporterGroupId), program.opts());
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
      const data: Record<string, unknown> = {
        name: merged.name
      };

      if (merged.description) data.description = merged.description;

      const api = createSupporterGroups(await getClient());
      const group = await api.create(data);
      outputResult(group, globalOpts);
    } catch (error) {
      handleError(error);
    }
  });

supporterGroupsCmd
  .command('delete <supporterGroupId>')
  .description('Delete a supporter group by ID')
  .action(async (supporterGroupId) => {
    try {
      validatePositiveInt(supporterGroupId, 'supporterGroupId');
      const api = createSupporterGroups(await getClient());
      const result = await api.delete(supporterGroupId);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

supporterGroupsCmd
  .command('add-person <supporterGroupId> <vanId>')
  .description('Add a person to a supporter group')
  .action(async (supporterGroupId, vanId) => {
    try {
      validatePositiveInt(supporterGroupId, 'supporterGroupId');
      validatePositiveInt(vanId, 'vanId');
      const api = createSupporterGroups(await getClient());
      const result = await api.addPerson(supporterGroupId, vanId);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

  
supporterGroupsCmd
  .command('remove-person <supporterGroupId> <vanId>')
  .description('Remove a person from a supporter group')
  .action(async (supporterGroupId, vanId) => {
    try {
      validatePositiveInt(supporterGroupId, 'supporterGroupId');
      validatePositiveInt(vanId, 'vanId');
      const api = createSupporterGroups(await getClient());
      const result = await api.removePerson(supporterGroupId, vanId);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

  
// --- Targets ---

const targetsCmd = program
  .command('targets')
  .description('Manage targets');

targetsCmd
  .command('list')
  .description('List targets (Use --with-subgroups for expanded view)')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .addOption(
    new Option('-s, --status <status>', 'Filter by target status')
      .choices(['Any', 'Setup', 'Ready', 'Active'])
      .default('Any')
  )
  .addOption(
    new Option('-t, --type <type>', 'Filter by target type')
      .choices(['Static', 'Dynamic'])
  )
  .option('--with-subgroups', 'Include expanded subgroups view')
  .action(async (options) => {
    try {
      const api = createTargets(await getClient());
      outputResult(await api.list(options), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

targetsCmd
  .command('get <targetId>')
  .description('Get a target by ID')
  .action(async (targetId, options) => {
    try {
      validatePositiveInt(targetId, 'targetId');
      const api = createTargets(await getClient());
      outputResult(await api.get(targetId), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

targetsCmd
  .command('subgroups')
  .description('List generic subgroups, or target-specific ones via flags')
  .option('--target-id <targetId>', 'Restrict to subgroups of a specific target')
  .option('--minivan-formats', 'Get subgroups formatted for miniVAN (requires --target-id)')
  .action(async (options) => {
    try {
      if (options.targetId) {
        validatePositiveInt(options.targetId, 'targetId');
      } else if (options.minivanFormats) {
        emitError(EXIT_VALIDATION_ERROR, 'ValidationError', '--minivan-formats requires --target-id to be specified.');
      }
      const api = createTargets(await getClient());
      outputResult(await api.subgroups(options), program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// --- API Key Profiles ---

const apiKeyProfilesCmd = program
  .command('api-key-profiles')
  .description('Manage API key profiles');

apiKeyProfilesCmd
  .command('get')
  .description('Get API key profile details for the current API key')
  .action(async () => {
    try {
      const api = createApiKeyProfiles(await getClient());
      const profileDetails = await api.get();
      outputResult(profileDetails, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// --- Config ---

import {
  loadConfig, saveConfig, getConfigPath,
  addProfile, removeProfile, setDefaultProfile, maskApiKey,
} from './config';

const configCmd = program
  .command('config')
  .description('Manage CLI configuration profiles (./.van/config when present, otherwise ~/.van/config)');

configCmd
  .command('list')
  .description('List all configured profiles')
  .action(() => {
    const profiles = loadConfig();
    const names = Object.keys(profiles);
    if (names.length === 0) {
      console.log(chalk.yellow('No profiles configured. Add one with: van config add <name> --api-key <key>'));
      return;
    }
    for (const name of names) {
      const p = profiles[name];
      const key = p.api_key ? maskApiKey(p.api_key) : '(not set)';
      const app = p.app_name || '(default)';
      const label = name === 'default' ? chalk.green(`[default]`) : `[profile ${name}]`;
      console.log(`${label}  api_key = ${key}  app_name = ${app}`);
    }
  });

configCmd
  .command('add <name>')
  .description('Add or update a profile')
  .requiredOption('--api-key <key>', 'API key for this profile')
  .option('--app-name <name>', 'Application name for this profile')
  .action((name, options) => {
    addProfile(name, options.apiKey, options.appName);
    console.log(chalk.green(`Profile "${name}" saved.`));
  });

configCmd
  .command('remove <name>')
  .description('Remove a profile')
  .action((name) => {
    if (removeProfile(name)) {
      console.log(chalk.green(`Profile "${name}" removed.`));
    } else {
      emitError(EXIT_VALIDATION_ERROR, 'ProfileNotFound', `Profile "${name}" not found.`);
    }
  });

configCmd
  .command('set-default <name>')
  .description('Copy a named profile to [default]')
  .action((name) => {
    if (setDefaultProfile(name)) {
      console.log(chalk.green(`Default profile set to "${name}".`));
    } else {
      emitError(EXIT_VALIDATION_ERROR, 'ProfileNotFound', `Profile "${name}" not found.`);
    }
  });

configCmd
  .command('show <name>')
  .description('Show profile details (API key masked)')
  .action((name) => {
    const profiles = loadConfig();
    const p = profiles[name];
    if (!p) {
      emitError(EXIT_VALIDATION_ERROR, 'ProfileNotFound', `Profile "${name}" not found.`);
    }
    const display: Record<string, string> = {};
    for (const [k, v] of Object.entries(p)) {
      if (v === undefined) continue;
      display[k] = k === 'api_key' ? maskApiKey(v) : v;
    }
    console.log(JSON.stringify(display, null, 2));
  });

configCmd
  .command('path')
  .description('Print the config file path')
  .action(() => {
    console.log(getConfigPath());
  });

// --- Generic API ---

const apiCmd = program
  .command('api')
  .description('Make raw API requests to any VAN endpoint.\n\nUseful for endpoints not yet wrapped by the CLI.\nAPI reference: https://docs.ngpvan.com (append .md for agent-friendly format)');

apiCmd
  .command('get <endpoint>')
  .description('GET any VAN API endpoint (e.g. /people?zipOrPostalCode=22043&$top=10)')
  .action(async (endpoint) => {
    try {
      const { path, params } = parseEndpoint(endpoint);
      const result = await (await getClient()).get(path, params);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

apiCmd
  .command('post <endpoint>')
  .description('POST to any VAN API endpoint')
  .option('--data <json>', 'Request body as JSON (alias for global --json)')
  .action(async (endpoint, options) => {
    try {
      const globalOpts = program.opts();
      const body = mergeJsonOption(options, globalOpts);
      const result = await (await getClient()).post(normalizeEndpoint(endpoint), body);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

apiCmd
  .command('put <endpoint>')
  .description('PUT to any VAN API endpoint')
  .option('--data <json>', 'Request body as JSON (alias for global --json)')
  .action(async (endpoint, options) => {
    try {
      const globalOpts = program.opts();
      const body = mergeJsonOption(options, globalOpts);
      const result = await (await getClient()).put(normalizeEndpoint(endpoint), body);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

apiCmd
  .command('delete <endpoint>')
  .description('DELETE any VAN API endpoint')
  .action(async (endpoint) => {
    try {
      const result = await (await getClient()).delete(normalizeEndpoint(endpoint));
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

apiCmd
  .command('docs [topic]')
  .description('Print API documentation URL (append .md for agent-consumable format)')
  .action((topic) => {
    const base = 'https://docs.ngpvan.com/reference';
    if (topic) {
      console.log(`${base}/${topic}`);
      console.log(`${base}/${topic}.md  (agent-friendly)`);
    } else {
      console.log(base);
      console.log(`\nCommon endpoints:`);
      console.log(`  ${base}/people.md`);
      console.log(`  ${base}/events.md`);
      console.log(`  ${base}/activist-codes.md`);
      console.log(`  ${base}/survey-questions.md`);
      console.log(`  ${base}/saved-lists.md`);
      console.log(`  ${base}/contributions.md`);
      console.log(`  ${base}/canvass-responses.md`);
    }
  });

// Helper: parse endpoint into path and query params
function parseEndpoint(endpoint: string): { path: string; params: Record<string, string> } {
  const [rawPath, query] = endpoint.split('?');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const params: Record<string, string> = {};
  if (query) {
    for (const pair of query.split('&')) {
      const [key, ...rest] = pair.split('=');
      if (key) params[key] = rest.join('=') || '';
    }
  }
  return { path, params };
}

// Helper: normalize endpoint to ensure it starts with /
function normalizeEndpoint(endpoint: string): string {
  const [path] = endpoint.split('?');
  return path.startsWith('/') ? path : `/${path}`;
}

// Parse command line arguments
program.parseAsync(process.argv).catch((error) => {
  if (error instanceof CliExit) {
    finalizeExit(error.code);
    return;
  }
  // Something escaped without going through emitError/handleError — still avoid the
  // Windows fetch+exit race rather than calling process.exit() directly here.
  console.error(error);
  finalizeExit(EXIT_API_ERROR);
});
