# van-cli

> **Note:** This project is experimental and under active development, with significant improvements planned throughout 2026. Expect APIs and behavior to evolve. We'd love to hear how you're using it and any feedback you have — please send a note to [sunil.sadasivan@ngpvan.com](mailto:sunil.sadasivan@ngpvan.com).

A CLI wrapper for the NGP VAN API.

## Requirements

- Node.js 24+ (current Active LTS; Node.js 20 reached EOL on 2026-04-30)
- `VAN_API_KEY` environment variable, or a profile in `./.van/config` or `~/.van/config`
- Optional `VAN_APP_NAME` (defaults to `default_user`)

## Setup

```bash
export VAN_API_KEY="your-api-key|1"
export VAN_APP_NAME="your-app-name"

# If the database mode suffix is omitted, van-cli assumes MyCampaign (|1)
export VAN_API_KEY="your-api-key"
```

## Quickstart: Install and Run the CLI

```bash
# 1) Install dependencies
npm ci

# 2) Build the TypeScript source
npm run build

# 3) Expose the `van` command globally from this repo
npm link

# 4) Set required auth variables in your shell
export VAN_API_KEY="your-api-key|1"
export VAN_APP_NAME="your-app-name"

# or use a project-local ./.van/config first, falling back to ~/.van/config

# 5) Confirm the CLI is available
van --help
```

If you prefer to skip `npm link`, you can run the CLI directly from the repo:

```bash
node bin/cli.js --help
```

## Shell completion

Enable tab completion by sourcing the generated script:

```bash
# zsh
eval "$(van completion zsh)"

# bash
eval "$(van completion bash)"
```

To make it persistent, add the command for your shell to `~/.zshrc` or `~/.bashrc`.

## Config files

van-cli resolves config in this order:

1. `VAN_CONFIG_PATH`
2. `./.van/config` when present in the current working directory
3. `~/.van/config`

Example:

```ini
[default]
api_key = your-api-key|1
app_name = your-app-name

[profile prod]
api_key = your-prod-api-key
app_name = prod-app
```

If an API key omits the mode suffix, van-cli assumes MyCampaign (`|1`).

## Scripts

```bash
npm run build
npm test
npm run test:coverage
```

## CLI usage

```bash
van people find --firstName Jane --lastName Doe --top 10 --pretty
van people find --city "Falls Church" --stateOrProvince VA --lastName Smith --top 10 --pretty
van people quick-search --name "John Smith" --top 10 --pretty
van api-key-profiles --pretty
van saved-lists list --top 100
van export-jobs create --savedListId 12345
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

The CLI currently implements a subset of SDK methods:

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

## Robustness features

- Retries on transient VAN errors (`429`, `5xx`) with exponential backoff
- Consistent typed API errors (`VanApiError`)
- Pagination helpers (`getPaginated`, `getAllPaginated`)
- Built-in shell completion generator (`van completion zsh|bash`)
- Jest coverage thresholds enforced in CI (`jest.config.cjs`)
