---
name: van-cli
description: "Interact with the NGP VAN API using the van-cli tool to manage people, events, saved lists, contributions, and more."
---

# VAN CLI Skill

You are an agent that can query and manage data in NGP VAN using the `van` CLI tool located in the user's workspace folder.

## Setup

### CLI location
The van-cli repo is at the path the user selected (their workspace folder). If `van` is not available as a global command, run the CLI directly:
```bash
node <workspace>/van-cli/bin/cli.js <command>
```
Or, if the user has already run `npm link` inside the van-cli folder, use `van <command>` directly.

### Authentication
The CLI requires a VAN API key set as an environment variable:
```bash
export VAN_API_KEY="your-api-key|1"   # |1 = MyCampaign, |0 = MyVoters
export VAN_APP_NAME="your-app-name"   # optional, defaults to default_user
```
Alternatively, use named profiles:
```bash
van config add myprofile --api-key "your-api-key|1"
van --profile myprofile people find --firstName Jane
```
If the user hasn't set up credentials, ask them to set `VAN_API_KEY` before proceeding.

### Global flags (available on all commands)
- `--pretty` — pretty-print JSON output
- `--json <payload>` — merge a raw JSON object with CLI options
- `--dry-run` — print the HTTP request without executing it
- `--fields <keys>` — comma-separated list of fields to include in output
- `--profile <name>` — use a named config profile

---

## Resource Commands

### People
```bash
# Find people by criteria
van people find --firstName Jane --lastName Doe --top 10 --pretty
van people find --city "Falls Church" --stateOrProvince VA --lastName Smith

# Fuzzy name search
van people quick-search --name "John Smith" --top 10 --pretty

# Get a person by VAN ID
van people get <vanId> --expand addresses,phones,emails

# Find or create (upsert)
van people find-or-create --firstName Jane --lastName Doe --email jane@example.com

# Update a person
van people update <vanId> --data '{"firstName":"Jane","lastName":"Doe"}'

# Delete a person
van people delete <vanId>

# List valid $expand fields
van people expand-fields
```

Available `--expand` fields for `people get`: contributionHistory, addresses, phones, emails, codes, customFields, externalIds, preferences, recordedAddresses, reportedDemographics, suppressions, cases, customProperties, districts, electionRecords, membershipStatuses, notes, organizationRoles, scores, pollingLocation

### Events
```bash
# List events
van events list --startDate 2024-01-01 --endDate 2024-12-31 --top 50

# Update an event
van events update <eventId> --data '{"name":"Updated Event Name"}'

# Delete an event
van events delete <eventId>
```

### Saved Lists
```bash
# List saved lists
van saved-lists list --top 100 --pretty

# Update a saved list
van saved-lists update <listId> --data '{"name":"New Name"}'

# Delete a saved list
van saved-lists delete <listId>
```

### Export Jobs
```bash
# Create an export job from a saved list
van export-jobs create --savedListId 12345
```

### Canvass Responses
```bash
# Record a canvass response
van canvass-responses create --vanId <vanId> --data '{"resultCodeId":18}'
```

### Notes
```bash
# Create a note on a person
van notes create --vanId <vanId> --text "Met at event, very interested." --isViewRestricted false

# Update a note
van notes update <noteId> --data '{"text":"Updated note text"}'

# Delete a note
van notes delete <noteId>
```

### Contributions
```bash
# List contributions
van contributions list --top 50 --pretty

# Get a specific contribution
van contributions get <contributionId>
```

### Signups (Event Signups)
```bash
# List signups
van signups list --top 50

# Create a signup
van signups create --data '{"eventId":123,"eventSignupStatusId":2,"vanId":456}'

# Update a signup
van signups update <signupId> --data '{"eventSignupStatusId":3}'

# Delete a signup
van signups delete <signupId>
```

### Scores
```bash
# List scores
van scores list --pretty

# Apply a score to a person
van scores apply --vanId <vanId> --scoreId <scoreId> --value 85
```

### Activist Codes
```bash
van activist-codes list --top 50 --pretty
```

### Survey Questions
```bash
van survey-questions list --top 50 --pretty
```

### Custom Fields
```bash
van custom-fields list --pretty
```

### Locations
```bash
# List locations
van locations list --top 50

# Find a location
van locations find --name "City Hall"
```

### Supporter Groups
```bash
# List supporter groups
van supporter-groups list

# Create a supporter group
van supporter-groups create --data '{"name":"My Group"}'

# Update a supporter group
van supporter-groups update <groupId> --data '{"name":"Updated Name"}'

# Delete a supporter group
van supporter-groups delete <groupId>
```

### Bulk Import
```bash
van bulk-import list --pretty
```

### Changed Entity Exports
```bash
# List changed entity exports
van changed-entity-exports list

# Create a changed entity export
van changed-entity-exports create --data '{"exportJobTypeId":1}'
```

### Contact Types & Event Types
```bash
van contact-types list --pretty
van event-types list --pretty
```

### API Key Profiles
```bash
van api-key-profiles --pretty
```

### Config Management
```bash
van config add <profileName> --api-key "key|1" --app-name "MyApp"
van config list
van config set-default <profileName>
van config remove <profileName>
```

---

## Workflow Guidelines

1. **Always confirm destructive operations** (delete, update) with the user before executing.
2. **Use `--dry-run`** first when a user is uncertain about an operation — show them what would be sent.
3. **Use `--fields`** to trim large responses to only what the user needs.
4. **Use `--pretty`** when showing output to the user in conversation.
5. **Handle pagination**: The CLI uses `--top` (max 50 for people, higher for other resources) and `--skip` for pagination. For large result sets, paginate automatically by looping with increasing `--skip`.
6. **Database mode matters**: Mode `|0` = MyVoters (organizing/volunteers), Mode `|1` = MyCampaign (voter contact/canvassing). Ask the user which mode to use if unclear.
7. **Error handling**: On API errors, show the error message to the user. On 429 (rate limit), the CLI retries automatically with backoff.
8. **Sensitive data**: Treat VAN data (voter info, contact details, contribution records) as sensitive. Do not log or expose API keys.

## Common Task Examples

**Find a contact and view their details:**
```bash
van people find --firstName Jane --lastName Doe --pretty
# Then get full profile:
van people get <vanId> --expand addresses,phones,emails,notes --pretty
```

**Add a note to a contact after a conversation:**
```bash
van notes create --vanId <vanId> --text "Called on 2024-03-10, interested in volunteering." --isViewRestricted false
```

**Look up upcoming events:**
```bash
van events list --startDate $(date +%Y-%m-%d) --top 20 --pretty
```

**Export a saved list:**
```bash
van saved-lists list --pretty          # find your list ID
van export-jobs create --savedListId <id>
```
