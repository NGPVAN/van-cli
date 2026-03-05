# van-cli

A CLI wrapper for the NGP VAN API for human 🧬 and agentic 🤖 use. 

**Aliases:** `van`, `van-cli`, `ea`

**API Docs:** [docs.ngpvan.com](https://docs.ngpvan.com) (append `.md` for agent-consumable format, e.g. `https://docs.ngpvan.com/reference/people.md`)

## Requirements

- Node.js 18+
- VAN API key (via `~/.van/config`, `VAN_API_KEY` env, or `--profile`)

## Setup

### Option 1: Config file (recommended)

```bash
# Install and link
npm ci && npm run build && npm link

# Add your API key
van config add default --api-key "your-api-key|1" --app-name "your-app-name"

# Verify
van api-key-profiles
```

### Option 2: Environment variables

```bash
export VAN_API_KEY="your-api-key|1"
export VAN_APP_NAME="your-app-name"
```

### Multiple profiles

Store multiple API keys in `~/.van/config` (AWS CLI-style):

```ini
[default]
api_key = your-api-key|1
app_name = your_app

[profile staging]
api_key = staging-key|0
app_name = your_app
```

```bash
# Add profiles via CLI
van config add staging --api-key "staging-key|0" --app-name "your_app"
van config add production --api-key "prod-key|1"

# Switch default
van config set-default production

# Use a specific profile
van --profile staging people find --lastName Smith

# Or via environment
VAN_PROFILE=staging van people find --lastName Smith

# Manage profiles
van config list              # list all (keys masked)
van config show staging      # details for one profile
van config remove staging    # delete a profile
van config path              # print config file location
```

**Resolution priority:** `--profile` flag → `VAN_PROFILE` env → `VAN_API_KEY` env → config `[default]`

## Agent-friendly features

These flags make the CLI first-class for AI agent consumption, inspired by [Rewrite Your CLI for AI Agents](https://justin.poehnelt.com/posts/rewrite-your-cli-for-ai-agents/).

### `--dry-run`

Print the HTTP request without executing it:

```bash
van --dry-run people find --lastName Smith --top 5
# {"method":"GET","url":"https://api.securevan.com/v4/people","params":{"$top":5,"$skip":0,"lastName":"Smith"}}
```

### `--fields`

Filter output to specific keys (saves context window tokens):

```bash
van --fields vanId,firstName,lastName people find --lastName Smith --top 5
```

### `--json`

Pass raw JSON payloads for create/update endpoints:

```bash
van --json '{"firstName":"Jane","lastName":"Doe","emails":[{"email":"jane@example.com"}]}' people find-or-create
```

### `schema`

Self-documenting API introspection (no API key required):

```bash
van schema                      # list all resources
van schema people               # actions for people
van schema people.find          # params, options, defaults
```

### Input validation

- Positional IDs validated as positive integers
- `--json` parse errors show received value + fix tip
- Unknown resources suggest closest match via Levenshtein distance

## Generic API access

Query any VAN API endpoint, even if not wrapped by the CLI:

```bash
# GET with query params
van api get '/people?zipOrPostalCode=22043&$top=10'

# POST with JSON body
van --json '{"firstName":"Jane"}' api post /people/findOrCreate

# PUT / DELETE
van --json '{"firstName":"Updated"}' api put /people/12345
van api delete /notes/67890

# API documentation links
van api docs              # list common endpoint docs
van api docs people       # specific endpoint URL + .md link
```

All global flags (`--dry-run`, `--fields`, `--profile`) work with generic API commands.

## CLI usage

```bash
van people find --firstName Jane --lastName Doe --top 10 --pretty
van people find --city "Falls Church" --stateOrProvince VA --lastName Smith --top 10
van people find --zipOrPostalCode 22043 --top 50
van people quick-search --name "John Smith" --top 10
van api-key-profiles --pretty
van saved-lists list --top 100
van export-jobs create --savedListId 12345
```

## Quickstart: Install from source

```bash
# 1) Install dependencies
npm ci

# 2) Build the TypeScript source
npm run build

# 3) Expose the `van` command globally from this repo
npm link

# 4) Confirm the CLI is available
van --help
```

If you prefer to skip `npm link`, you can run the CLI directly:

```bash
npx tsx src/cli.ts --help
```

## Shell completion

```bash
# zsh
eval "$(van completion zsh)"

# bash
eval "$(van completion bash)"
```

To make it persistent, add to `~/.zshrc` or `~/.bashrc`.

## Scripts

```bash
npm run build
npm test
npm run test:coverage
```

## Resource support

This package exposes resources through the TypeScript client (`VanApi`) and also ships a CLI (`van`).

### SDK support (full resource surface)

```ts
import { VanApi } from 'van-cli';

const van = new VanApi({ apiKey: process.env.VAN_API_KEY! });
```

- `people`: `get`, `find`, `quickSearch`, `findOrCreate`, `create`, `update`, `getAll`
- `activistCodes`: `list`, `get`, `getAll`, `apply`, `remove`
- `surveyQuestions`: `list`, `get`, `getAll`, `recordResponse`
- `events`: `list`, `get`, `create`, `update`, `delete`, `getSignups`, `getAll`
- `savedLists`: `list`, `get`, `create`, `update`, `delete`, `getPeople`, `addPerson`, `removePerson`, `getAll`
- `exportJobs`: `list`, `get`, `create`, `getDownloadUrl`, `getAll`
- `canvassResponses`: `list`, `get`, `create`, `getByPerson`, `getAll`
- `contributions`: `list`, `get`, `create`, `update`, `getByPerson`, `getAll`
- `signups`: `list`, `get`, `create`, `update`, `delete`, `getByEvent`, `getByPerson`, `getAll`
- `notes`: `list`, `get`, `create`, `update`, `delete`, `getByPerson`, `getAll`
- `scores`: `list`, `get`, `getAll`, `apply`, `getByPerson`, `update`, `remove`
- `customFields`: `list`, `get`, `getAll`, `setValue`, `getByPerson`, `updateValue`, `removeValue`
- `codes`: `list`, `listResultCodes`, `getResultCode`, `listContactTypes`, `getContactType`, `listInputTypes`, `getInputType`, `listSupporterGroups`, `getSupporterGroup`, `getAllResultCodes`, `getAllContactTypes`
- `targets`: `list`, `get`, `create`, `update`, `delete`, `getPeople`, `addPerson`, `removePerson`, `getAll`
- `stories`: `list`, `get`, `create`, `update`, `delete`, `getByPerson`, `getAll`
- `emails`: `list`, `get`, `create`, `update`, `send`, `getStats`, `getRecipients`, `getAll`
- `bulkImport`: `list`, `listJobs`, `getJob`, `createJob`, `uploadData`, `startJob`, `cancelJob`, `getJobResults`, `getJobErrors`, `getAllJobs`
- `changedEntityExportJobs`: `list`, `get`, `create`, `getDownloadUrl`, `cancel`, `getStatus`, `getAll`
- `locations`: `list`, `get`, `find`, `create`, `update`, `getEvents`, `getAll`
- `contactTypes`: `list`, `get`, `getAll`
- `eventTypes`: `list`, `get`, `getAll`
- `supporterGroups`: `list`, `get`, `create`, `update`, `addPerson`, `removePerson`, `getPeople`, `getAll`

### CLI support (current command coverage)

The CLI implements a subset of SDK methods. Use `van api get/post/put/delete` for any endpoint not listed below.

- `people`: `get`, `find`, `quick-search`, `find-or-create`, `update`, `delete`
- `activist-codes`: `list`
- `survey-questions`: `list`
- `events`: `list`, `update`, `delete`
- `saved-lists`: `list`, `update`, `delete`
- `export-jobs`: `create`
- `canvass-responses`: `create`
- `notes`: `create`, `update`, `delete`
- `contributions`: `list`, `get`
- `signups`: `list`, `create`, `update`, `delete`
- `scores`: `list`, `apply`
- `custom-fields`: `list`
- `locations`: `list`, `find`
- `bulk-import`: `list`
- `changed-entity-exports`: `list`, `create`
- `contact-types`: `list`
- `event-types`: `list`
- `supporter-groups`: `list`, `create`, `update`, `delete`
- `api-key-profiles`
- `config`: `list`, `add`, `remove`, `set-default`, `show`, `path`
- `schema`: resource/action introspection
- `api`: `get`, `post`, `put`, `delete`, `docs`

## Robustness features

- Retries on transient VAN errors (`429`, `5xx`) with exponential backoff
- Consistent typed API errors (`VanApiError`)
- Pagination helpers (`getPaginated`, `getAllPaginated`)
- Built-in shell completion generator (`van completion zsh|bash`)
- Jest coverage thresholds enforced in CI (`jest.config.cjs`)
- Config file created with `0600` permissions, directory with `0700`
