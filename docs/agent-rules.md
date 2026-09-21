# Agent Rules for van-cli

These rules are for coding agents and humans using `van-cli` or the `VanApi` SDK against the NGP VAN API. They codify operational safety rules that are easy to forget when automating CLI/API work.

The goal is to keep agents fast without letting them accidentally create large paginated reads, retry storms, unreviewed writes, or fragile command behavior.

## Comparable CLI patterns

These rules follow patterns used by other large API CLIs:

- **Salesforce CLI** documents that standard SOQL queries should switch to `sf data export bulk` when result sets exceed 10,000 records, and its query command warns when a configured max-fetch limit truncates results.
- **AWS CLI/botocore** keeps pagination and retry rules in machine-readable service metadata (`paginators-1.json`, `_retry.json`) and uses that metadata to inject consistent CLI behavior like `--page-size`, `--max-items`, and retry handling.
- **GitHub CLI** makes raw API pagination explicit (`gh api --paginate`) and enforces flag compatibility rules, such as only allowing pagination for appropriate request types.
- **Stripe SDKs** support auto-pagination, but require explicit limits for collecting pages into memory and reject very large in-memory collection limits.

For `van-cli`, the best version of this is: document the rules here, then backstop the most important ones with code-level policy metadata and guardrails as the CLI matures.

## Golden rules

1. **Start reads small.** Use `--top 10` or `--top 50` for exploratory reads.
2. **Never paginate broad person/list/member reads blindly.** Broad people data belongs in export jobs, not page loops.
3. **Prefer exports for large result sets.** If you expect more than roughly 1,000 records, use an export-oriented workflow.
4. **Prefer changed entity exports for syncs.** Delta/sync workloads should use changed entity export jobs with explicit date windows.
5. **Respect rate limits.** On `429`, honor `Retry-After` when present. Otherwise use exponential backoff with jitter.
6. **No parallel fan-out by default.** Do not launch concurrent page walkers or per-record API calls unless the operation has explicit throttling/concurrency controls.
7. **Writes require intent.** Create/update/delete/import operations should be explicit, reviewed, and preferably tested with `--dry-run` when available.
8. **Machine-readable output is a contract.** Preserve JSON shapes and exit-code semantics unless making an intentional breaking change.

## Choosing the right read path

### Single record lookup

Use direct `get` commands/methods when you have a stable identifier.

Examples:

```bash
van people get 12345 --pretty
van contributions get 67890 --pretty
```

### Exploratory search or diagnostics

Use bounded list/search commands with tight filters.

Rules:

- Use `--top <= 50` for people search because VAN caps person search page size.
- Prefer narrow search criteria: name + location, email, phone, saved list ID, event ID, etc.
- Use `--fields` when you only need a subset of output fields.
- Do not use skip/page loops to discover entire universes of people.

Examples:

```bash
van people find --firstName Jane --lastName Doe --top 10 --pretty
van locations find --name "HQ" --top 10 --pretty
van contributions list --personId 12345 --top 50 --pretty
```

### Reference and metadata reads

Normal pagination is acceptable for small/reference resources, such as:

- `activist-codes`
- `survey-questions`
- `contact-types`
- `event-types`
- `supporter-groups`
- `custom-fields`
- result/input/contact type code lists

Still keep result caps explicit when using the SDK `getAll` helpers.

### Large people or saved-list extracts

Use export jobs instead of client-side pagination when you need a large people dataset.

Use this path when:

- The expected output is more than about 1,000 records.
- You are exporting a saved list.
- You are preparing files for downstream processing.
- You need reproducible file output rather than streamed JSON.

Example:

```bash
van export-jobs create --savedListId 12345 --type 101 --webhookUrl https://example.org/completedExportJobs
```

Then retrieve the job status/download URL through the export job commands or SDK methods.

### Delta/sync workloads

Use changed entity export jobs for sync-style workloads. Do not simulate syncs by repeatedly paginating broad endpoints.

Rules:

- Always use an explicit `dateChangedFrom`.
- Prefer bounded `dateChangedTo` windows for backfills.
- Keep requested fields intentional.
- Poll job status with backoff, not a tight loop.

Example:

```bash
van changed-entity-exports create --dateChangedFrom 2026-01-01 --dateChangedTo 2026-01-31
```

## Pagination rules

### CLI usage

- Use `--top` for page size, not total desired output.
- Use `--skip` only for a small number of deliberate pages.
- If you need multiple pages, first ask whether an export job is more appropriate.
- Avoid scripts like `for skip in ...; van people find --skip $skip ...` against broad data.

### SDK usage

`getAllPaginated(endpoint, params, maxResults)` should be used only when:

- `maxResults` is explicit and modest.
- The endpoint is known to be safe for pagination.
- The result set is needed in memory.

Do not use `getAllPaginated` for broad people universe reads, saved-list membership exports, or sync/backfill workflows. Use export jobs or changed entity export jobs.

### Suggested future enforcement

Add a resource policy manifest that classifies endpoints, for example:

```ts
export const resourcePolicies = {
  '/people': {
    category: 'large-person-data',
    defaultPageSize: 50,
    maxPageSize: 50,
    maxSafeAutoPaginatedResults: 1000,
    preferExportAbove: 1000,
    exportAlternative: 'export-jobs or changed-entity-exports',
  },
  '/contactTypes': {
    category: 'reference-data',
    defaultPageSize: 50,
    maxSafeAutoPaginatedResults: 5000,
  },
};
```

Then have CLI/SDK helpers warn or fail when agents try unsafe unbounded reads, with an escape hatch like `--force-paginate` for intentional one-off cases.

## Rate limiting and retries

Required behavior:

- Retry only transient failures: `429`, `500`, `502`, `503`, `504`, and network timeouts where safe.
- Honor `Retry-After` for `429` and service throttling responses.
- Use exponential backoff with jitter when `Retry-After` is absent.
- Cap retries and surface the last API error clearly.
- Avoid retry amplification: do not retry each item in a large parallel batch independently without a shared concurrency/rate limiter.

Preferred defaults:

- Sequential page retrieval.
- Small bounded concurrency for per-record follow-ups only when necessary.
- A single client-level retry implementation rather than command-specific retry loops.

## Write, import, and delete guardrails

Writes include create, update, delete, apply/remove codes, score updates, supporter-group membership changes, bulk import creation/upload/start/cancel, and export job cancellation.

Rules:

- Do not perform destructive operations unless the user explicitly asked for that operation.
- For bulk imports, require review of the input file/mapping before upload/start.
- For deletes/removes/cancels, identify the exact record/job/person/list being changed.
- Prefer `--dry-run` for command construction and demos.
- Never log API keys or config file contents containing credentials.

## CLI implementation rules

When changing `van-cli`, preserve the CLI as an automation-friendly tool:

- Keep commands scriptable and non-interactive by default.
- Keep JSON output valid and stable.
- Add `--pretty` only as presentation; machine output should remain parseable.
- Validate flags before making API calls.
- Keep command help concrete with examples for safe alternatives.
- Do not hide network calls behind surprising defaults.
- Add tests for any new guardrail, retry behavior, or output contract.

## Documentation expectations

When adding or changing commands that can read many records:

- Document default page size and max page size.
- Document whether the endpoint is safe for normal pagination.
- Mention the export alternative when applicable.
- Include one small-read example and one large-export alternative.

When adding writes/imports/deletes:

- Document required identifiers and payload shape.
- Include a dry-run or preview example where possible.
- Call out irreversible/destructive semantics.
