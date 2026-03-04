---
name: van
description: Use this skill when the user needs to interact with the NGP VAN API — searching for people, managing events, exporting data, recording canvass responses, managing supporter groups, or any VAN/EveryAction/VoteBuilder operations. Also use when the user mentions VAN IDs, activist codes, survey questions, saved lists, or voter data.
argument-hint: "[command] [subcommand] [options]"
allowed-tools: Bash, Read, Grep, Glob
---

# VAN CLI — NGP VAN API Tool

You have access to the `van` CLI, a command-line wrapper for the NGP VAN (EveryAction / VoteBuilder) API.

## Prerequisites

The CLI must be built and linked before first use. Run this once per session if `van --help` fails:

```bash
cd /Users/sunil/workspace/ngpvan/van-cli && npm ci && npm run build && npm link
```

The environment variable `VAN_API_KEY` must be set (format: `api_key|mode` where mode is 0 or 1).

## Invoking the CLI

Always use `van` via the Bash tool. Add `--pretty` for human-readable JSON output.

```bash
van <resource> <subcommand> [options] --pretty
```

## Available Commands

### People (voter/contact records)
```bash
van people get <vanId> [--expand <fields>]        # Fetch person by VAN ID
van people find --lastName Smith --city Richmond   # Search by criteria
van people quick-search --name "John Smith"        # Fuzzy name search
van people find-or-create --data '{"firstName":"Jane","lastName":"Doe",...}'
van people update <vanId> --data '{...}'           # Update person
van people delete <vanId>                          # Delete person
```

**Find filters:** `--firstName`, `--lastName`, `--city`, `--stateOrProvince`, `--zip`, `--email`, `--phone`, `--streetAddress`, `--top`, `--skip`

**Expand fields for get:** addresses, phones, emails, customFields, contributionHistory, codes, electionRecords, suppressions, reportedDemographics, disclosureFieldValues, districts, membershipStatus

### Activist Codes
```bash
van activist-codes list [--top N] [--skip N]
```

### Survey Questions
```bash
van survey-questions list [--top N] [--skip N]
```

### Events
```bash
van events list [--startDate YYYY-MM-DD] [--endDate YYYY-MM-DD]
van events update <eventId> --data '{...}'
van events delete <eventId>
```

### Saved Lists
```bash
van saved-lists list [--top 100]
van saved-lists update <savedListId> --data '{...}'
van saved-lists delete <savedListId>
```

### Export Jobs
```bash
van export-jobs create --savedListId <id>
```

### Canvass Responses
```bash
van canvass-responses create --vanId <id> --data '{...}'
```

### Notes
```bash
van notes create --vanId <id> --data '{"text":"...","isViewRestricted":false,"category":{"noteCategory":"..."}}'
van notes update <noteId> --data '{...}'
van notes delete <noteId>
```

### Contributions
```bash
van contributions list [--startDate YYYY-MM-DD] [--endDate YYYY-MM-DD]
van contributions get <contributionId>
```

### Signups (event attendance)
```bash
van signups list [--eventId <id>] [--vanId <id>]
van signups create --data '{"person":{"vanId":123},"event":{"eventId":456},"role":{"roleId":789},"status":{"statusId":1}}'
van signups update <signupId> --data '{...}'
van signups delete <signupId>
```

### Scores
```bash
van scores list
van scores apply --vanId <id> --data '{"score":{"scoreId":1,"scoreValue":50}}'
```

### Custom Fields
```bash
van custom-fields list
```

### Locations
```bash
van locations list
van locations find --name "Community Center"
```

### Bulk Import
```bash
van bulk-import list
```

### Changed Entity Export Jobs
```bash
van changed-entity-exports list
van changed-entity-exports create --data '{...}'
```

### Contact Types & Event Types
```bash
van contact-types list
van event-types list
```

### Supporter Groups
```bash
van supporter-groups list
van supporter-groups create --data '{"name":"My Group","description":"..."}'
van supporter-groups update <groupId> --data '{...}'
van supporter-groups delete <groupId>
```

### API Key Info
```bash
van api-key-profiles --pretty
```

## Tips

- Use `--top N` and `--skip N` for pagination on list commands.
- Use `--pretty` to format JSON output for readability.
- Pipe output to `jq` for advanced filtering: `van people find --lastName Smith | jq '.[].vanId'`
- The API key format is `api_key|mode` where mode `0` = My Voters, mode `1` = My Campaign.
- Rate limits are handled automatically with exponential backoff retries.

## SDK Usage (for writing scripts)

The van-cli also exports a TypeScript/JavaScript SDK:

```typescript
import { VanApi } from 'van-cli';
const van = new VanApi({ apiKey: process.env.VAN_API_KEY! });

// Examples
const person = await van.people.get(12345);
const results = await van.people.find({ lastName: 'Smith', city: 'Richmond' });
const events = await van.events.list({ startDate: '2026-01-01' });
```

The SDK has broader coverage than the CLI — see the README for the full resource/method list.
