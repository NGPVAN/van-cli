# AGENTS.md

This repository is `NGPVAN/van-cli`, a TypeScript CLI and SDK wrapper for the NGP VAN API. It is designed for both human and agentic use.

## Start here

Before making changes, read:

1. `README.md` for current setup and command coverage.
2. `docs/agent-rules.md` for API safety rules around pagination, exports, rate limits, retries, and writes.
3. The relevant command module in `src/commands/` and CLI wiring in `src/cli.ts`.

## Build, test, and run

```bash
npm ci
npm run build
npm test
npm run test:coverage
node bin/cli.js --help
```

Use `npm test` as the normal verification gate before opening a PR.

## Project structure

- `bin/cli.js` - executable wrapper for the built CLI.
- `src/cli.ts` - Commander command tree, flags, validation, and output formatting.
- `src/client.ts` - low-level VAN API HTTP client, auth, retry behavior, and pagination helpers.
- `src/index.ts` - SDK entry point and resource factory wiring.
- `src/commands/*.ts` - resource-specific SDK modules.
- `src/config.ts` - config file/profile resolution.
- `src/errors.ts` - typed API error wrapper.
- `src/types.ts` - shared TypeScript types.
- `tests/` - Jest tests for client behavior, command modules, config, and package exports.
- `docs/agent-rules.md` - operational rules for safe agent/API usage.

## CLI/API safety rules

Follow `docs/agent-rules.md` for all API-facing changes. The most important rules:

- Start exploratory reads small (`--top 10` or `--top 50`).
- Do not implement broad unbounded pagination over people/list/member data.
- Prefer export jobs for large people/saved-list extracts.
- Prefer changed entity export jobs for sync and delta workloads.
- Respect `429`/`Retry-After`; use bounded exponential backoff with jitter.
- Avoid parallel fan-out unless explicit throttling/concurrency controls exist.
- Writes, imports, deletes, removals, and cancellations must be explicit and reviewable.

## Command implementation conventions

- Add CLI commands in `src/cli.ts` and SDK methods in the appropriate `src/commands/*.ts` module when both surfaces are needed.
- Keep commands non-interactive and scriptable by default.
- Validate required flags and payloads before making API calls.
- Prefer small, explicit options over magic behavior.
- Preserve machine-readable JSON output. `--pretty` may format JSON but should not change the data shape.
- Keep `--dry-run` behavior accurate when adding commands that construct requests.
- Do not print API keys, profile contents, access tokens, or raw config secrets.

## Pagination and large-read conventions

- Treat `--top` as page size, not total result count.
- Treat `--skip` as deliberate small-page navigation, not a bulk export strategy.
- SDK `getAll*` helpers must have explicit, modest maximums.
- For endpoints that may return large people datasets, prefer adding/exporting through `exportJobs` or `changedEntityExportJobs` rather than page loops.
- If adding a new broad read command, document and test the safe limit or export alternative.

## Error handling and retry conventions

- Retry only transient failures (`429`, `5xx`, safe network timeouts).
- Honor `Retry-After` when present.
- Keep retry behavior centralized in `src/client.ts`; do not add command-local retry loops unless there is a strong reason.
- Surface `VanApiError` messages clearly without hiding status codes.

## Testing expectations

- Add or update Jest tests for new commands, SDK methods, retry logic, pagination guardrails, and config behavior.
- Prefer focused tests with mocked clients over live VAN API calls.
- Do not require real `VAN_API_KEY` credentials for unit tests.
- Run `npm test` before committing.

## Git workflow

- Branch from `main` unless instructed otherwise.
- Use `feature/<descriptive-name>` branches.
- Do not commit `node_modules`, `dist`, `.van`, `.env`, coverage output, or API credentials.
- Open PRs against `main` for this repo unless instructed otherwise.

## Stable interfaces

Be careful changing:

- Command names and flag names.
- JSON output shapes.
- Exit behavior for validation/API failures.
- Config file/profile semantics.
- SDK method names and argument shapes.

If a behavior change is intentional, document it in the PR and update README/help text as needed.
