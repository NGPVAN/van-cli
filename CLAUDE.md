# CLAUDE.md

This file gives Claude and other coding agents fast context for working in `NGPVAN/van-cli`.

## Essential context

`van-cli` is a TypeScript CLI and SDK for the NGP VAN API. It is intentionally automation-friendly, so safe API usage and stable machine-readable output matter as much as developer ergonomics.

Read these before changing code:

- `AGENTS.md` - repository-wide coding-agent instructions.
- `docs/agent-rules.md` - VAN API safety rules for pagination, export jobs, rate limits, retries, and writes.
- `README.md` - install, config, command, and SDK overview.

## Commands

```bash
npm ci                 # install dependencies
npm run build          # compile TypeScript to dist/
npm test               # build + run Jest tests
npm run test:coverage  # build + run Jest coverage
node bin/cli.js --help # inspect local CLI help
```

Run `npm test` before committing.

## Architecture map

- `src/cli.ts` - Commander command definitions, flags, validation, output formatting.
- `src/client.ts` - Axios client, auth, retry behavior, low-level HTTP verbs, pagination helpers.
- `src/commands/` - resource-specific SDK modules.
- `src/index.ts` - `VanApi` SDK facade and module exports.
- `src/config.ts` - config/profile loading from `VAN_CONFIG_PATH`, `./.van/config`, and `~/.van/config`.
- `tests/` - Jest test suites. Tests should mock clients/API behavior and not depend on live credentials.

## High-priority implementation rules

- Keep the CLI scriptable and non-interactive by default.
- Keep JSON output valid and stable; do not change output shapes casually.
- Validate flags before network calls.
- Centralize HTTP retry/rate-limit behavior in `src/client.ts`.
- Do not add unbounded auto-pagination for broad people/list/member data.
- Prefer export jobs for large extracts and changed entity export jobs for sync/delta workflows.
- Do not print secrets from env vars or config files.

## API safety reminders

For reads:

- Start with `--top 10` or `--top 50`.
- Use narrow filters.
- Use `--fields` when only a subset is needed.
- Avoid `getAllPaginated` unless the max result count is explicit and modest.

For large data:

- Saved-list/person exports should go through `exportJobs`.
- Sync/backfill workloads should go through `changedEntityExportJobs` with explicit date windows.
- Poll async jobs with backoff, not tight loops.

For writes:

- Creates/updates/deletes/imports/cancellations must be explicit.
- Prefer `--dry-run` support for request construction and demos.
- Bulk imports should require review of file/mapping before upload/start.

## Testing guidance

- Add unit tests for new validation, payload construction, retry behavior, and pagination guardrails.
- Avoid live VAN API calls in tests.
- If a command accepts JSON payloads, test invalid JSON and flag precedence.
- If a command changes output contracts, test JSON shape.

## Style

- TypeScript source uses 2-space indentation.
- Prefer clear names and small helper functions.
- Keep comments focused on why, not what.
- Maintain existing Commander/SDK patterns unless refactoring deliberately.
