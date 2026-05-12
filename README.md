# van-cli

> **Note:** This project is experimental and under active development, with significant improvements planned throughout 2026. Expect APIs and behavior to evolve. We'd love to hear how you're using it and any feedback you have — please send a note to [sunil.sadasivan@ngpvan.com](mailto:sunil.sadasivan@ngpvan.com).

A CLI wrapper for the NGP VAN API.

## Requirements

- Node.js 18+
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

- `people`: `get`, `list`, `quickSearch`, `findOrCreate`, `create`, `update`, `delete`, `getAll`
- `activistCodes`: `list`, `get`
- `surveyQuestions`: `list`, `get`
- `events`: `list`, `get`, `create`, `update`, `delete`
- `savedLists`: `list`, `get`
- `exportJobs`: `list`, `get`, `create`, `getDownloadUrl`, `getAll`
- `canvassResponses`: `create`, `list`, `inputTypes`, `resultCodes`, `contactTypes`
- `contributions`: `list`, `get`, `create`, `update`
- `designations`: `list`, `get`
- `signups`: `list`, `get`, `create`, `update`, `delete`
- `notes`: `list`, `get`, `create`, `update`, `delete`, `getByPerson`, `getAll`
- `scores`: `list`, `get`, `getAll`, `apply`, `getByPerson`, `update`, `remove`
- `customFields`: `list`, `get`, `getAll`, `setValue`, `getByPerson`, `updateValue`, `removeValue`
- `codes`: `list`, `listResultCodes`, `getResultCode`, `listContactTypes`, `getContactType`, `listInputTypes`, `getInputType`, `listSupporterGroups`, `getSupporterGroup`, `getAllResultCodes`, `getAllContactTypes`
- `targets`: `list`, `get`, `create`, `update`, `delete`, `getPeople`, `addPerson`, `removePerson`, `getAll`
- `stories`: `list`, `get`, `create`, `update`, `delete`, `getByPerson`, `getAll`
- `email`: `list`, `get`
- `bulkImport`: `list`, `listJobs`, `getJob`, `createJob`, `uploadData`, `startJob`, `cancelJob`, `getJobResults`, `getJobErrors`, `getAllJobs`
- `changedEntityExportJobs`: `list`, `get`, `create`, `getDownloadUrl`, `cancel`, `getStatus`, `getAll`
- `locations`: `list`, `get`, `create`, `findOrCreate`, `delete`
- `eventTypes`: `list`, `get`
- `supporterGroups`: `list`, `get`, `create`, `update`, `addPerson`, `delete`, `getPeople`, `getAll`
- `apiKeyProfiles`: `get`

### CLI support (current command coverage)

The CLI currently implements a subset of SDK methods:

- `people`: `expand-fields`, `get`, `list`, `quick-search`, `find-or-create`, `create`, `update`, `delete`
- `email`: `list`, `get`
- `activist-codes`: `list`, `get`
- `survey-questions`: `list`, `get`
- `events`: `list`, `expand-fields`, `get`, `create`, `update`, `delete`
- `saved-lists`: `list`, `get`
- `export-jobs`: `create`
- `canvass-responses`: `create`, `list`, `input-types`, `result-codes`, `contact-types`
- `notes`: `create`, `update`, `delete`
- `contributions`: `list`, `get`, `create`, `update`
- `designations`: `expand-fields`, `list`, `get`
- `signups`: `list`, `create`, `update`, `delete`
- `scores`: `list`, `apply`
- `custom-fields`: `list`
- `locations`: `list`, `get`, `create`, `find-or-create`, `delete`
- `bulk-import`: `list`
- `changed-entity-exports`: `list`, `create`
- `event-types`: `list`, `get`
- `supporter-groups`: `list`, `create`, `update`, `delete`
- `api-key-profiles`

## Robustness features

- Retries on transient VAN errors (`429`, `5xx`) with exponential backoff
- Consistent typed API errors (`VanApiError`)
- Pagination helpers (`getPaginated`, `getAllPaginated`)
- Built-in shell completion generator (`van completion zsh|bash`)
- Jest coverage thresholds enforced in CI (`jest.config.cjs`)
