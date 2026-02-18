# van-cli

A CLI wrapper for the NGP VAN API for human 🧬 and agentic 🤖 use. 

## Requirements

- Node.js 18+
- `VAN_API_KEY` environment variable
- Optional `VAN_APP_NAME` (defaults to `default_user`)

## Setup

```bash
export VAN_API_KEY="your-api-key|1"
export VAN_APP_NAME="your-app-name"
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

# 5) Confirm the CLI is available
van --help
```

If you prefer to skip `npm link`, you can run the CLI directly from the repo:

```bash
node bin/cli.js --help
```

## Scripts

```bash
npm run build
npm test
npm run test:coverage
```

## CLI usage

```bash
van people find --firstName Jane --lastName Doe --top 10 --pretty
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

- `people`: `get`, `find`, `findOrCreate`, `create`, `update`, `getAll`
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

- `people`: `get`, `find`, `find-or-create`
- `activist-codes`: `list`
- `survey-questions`: `list`
- `events`: `list`
- `saved-lists`: `list`
- `export-jobs`: `create`
- `canvass-responses`: `create`
- `notes`: `create`
- `contributions`: `list`, `get`
- `signups`: `list`, `create`
- `scores`: `list`, `apply`
- `custom-fields`: `list`
- `locations`: `list`, `find`
- `bulk-import`: `list`
- `changed-entity-exports`: `list`, `create`
- `contact-types`: `list`
- `event-types`: `list`
- `supporter-groups`: `list`, `create`

## Robustness features

- Retries on transient VAN errors (`429`, `5xx`) with exponential backoff
- Consistent typed API errors (`VanApiError`)
- Pagination helpers (`getPaginated`, `getAllPaginated`)
- Jest coverage thresholds enforced in CI (`jest.config.cjs`)
