---
name: add-van-entity
description: Audit and implement van-cli support for one NGP VAN API entity (e.g. changedEntityExportJobs, bulkImport, customFields). Phase 1 compares the real VAN endpoints against the existing SDK module, CLI commands, tests and README and reports gaps for developer review; Phase 2 implements the agreed scope. Use when asked to add, update, audit or finish CLI support for a VAN entity.
argument-hint: <entityName> [special instructions]
---

# add-van-entity

Arguments: `$ARGUMENTS`. The first word is the entity (the `src/commands/<entity>.ts` module name, or the VAN resource name if no module exists yet). Everything after it is special instructions from the developer. Those instructions override the defaults below.

The skill runs in two phases with a hard stop between them. **Do not edit any file in Phase 1.**

---

## Phase 1: Research and report

### 1. Gather the real VAN endpoint surface

Use each source and record which ones confirm each endpoint:

- **VAN docs.** WebFetch `https://docs.ngpvan.com/reference/<entity-lowercase>` and any linked sub-resource pages (resources, mapping types, status, and so on). Capture method, path, path and query params, required and optional body fields, and the response shape. The docs are often incomplete: a page may document only the POST, or only the GET.
- **`van` MCP server tools.** If `mcp__van__van_<entity>_*` tools exist in this session, read their schemas. They come from a separate, working implementation, so they're a second source for which endpoints exist and what their bodies look like. Don't call write tools.
- **Developer input.** Use any request bodies, sample responses or quirks given in the special instructions.

### 2. Inventory current van-cli support

- `src/commands/<entity>.ts`: every SDK method and the method, path and body it sends.
- `src/cli.ts`: the `// --- <Entity> ---` section and every subcommand, option and required option.
- `src/index.ts`: whether the module is registered on `VanApi`.
- `tests/commands/coverage.test.js` and `tests/commands/smoke.test.js`: which methods are exercised and what is asserted.
- `README.md`: the entity's line in both "SDK support" and "CLI support".

### 3. Classify every endpoint and method

Treat existing van-cli code as **unverified**, not as proof that an endpoint exists. Some older modules were scaffolded with endpoints that appear in neither the docs nor the MCP tools. Mock-based Jest tests pass for any path, so they don't prove anything either.

Use one status per row:

| Status | Meaning |
|---|---|
| `supported` | Confirmed endpoint, SDK and CLI both implement it correctly |
| `sdk-only` | Confirmed endpoint, SDK has it, no CLI command |
| `missing` | Confirmed endpoint, not in van-cli at all |
| `incorrect` | van-cli implements it but the path, required fields or body shape differ from the source |
| `unverified` | van-cli implements it but neither docs nor MCP confirm it exists |

### 4. Report and stop

Present:

1. A table with these columns: endpoint (method and path), docs?, MCP?, SDK method, CLI command, status, and recommended action (add, fix, keep, remove, or verify live).
2. **Correctness bugs** found in the existing code, such as missing required-field validation or a wrong body shape.
3. **Open questions**, especially `unverified` endpoints. Recommend checking each one against a real API key, for example `van --dry-run ...` to see the request and then a real call. Only a live call shows undocumented behavior such as a POST that echoes nulls.
4. A **proposed scope** for Phase 2, with commands named in kebab-case.

Then stop and ask the developer to confirm or adjust the scope. Don't start Phase 2 until they reply.

---

## Phase 2: Implement the agreed scope

Implement only what was agreed. Follow the newest modules as the reference style: `src/commands/exportJobs.ts`, `folders.ts`, `savedLists.ts`, `stories.ts`, and their `cli.ts` sections.

### SDK module (`src/commands/<entity>.ts`)

- Use the factory shape `const create = function(client: VanApiClientLike) { return { ... } }; export default create;` with short JSDoc on each method.
- Validate at the SDK layer with the helpers in `src/validation.ts` (`validatePositiveInt`, `validateIdList`, `validateIntRange`, `validateBoolean`, `validateWebhookUrl`, `validatePaging`), which throw `VanValidationError`. Check required fields before any request.
- Build request bodies from known input keys only, so output-only fields like ids, status or URLs are never sent.
- For nested write objects, send just the id. For example, send `storyStatus: { storyStatusId }` even though GET returns `{ storyStatusId, statusName }`.
- If a POST or PUT response is unreliable (empty, null or zeroed fields), take the id from it, throw a clear error if the id is missing, and return a follow-up `this.get(id)`. See `stories.ts` `create` and `signups.ts` `update`.
- When a method is `unverified` and the developer chose to remove it, delete it outright. Don't leave stubs or comments.

### CLI (`src/cli.ts`)

- Keep everything in the entity's `// --- <Entity> ---` section, with the comment at column 0. Create the `<entity>Cmd` group in kebab-case if it doesn't exist, and register any new module import at the top of the file.
- Pass `lazyClient` to the module factory. Wrap each action in `try { ... outputResult(result, program.opts()); } catch (error) { handleError(error); }`.
- Use `.requiredOption()` for API-required fields and `.option()` for the rest. Positional ids go in `command('get <id>')`. Use `mergeJsonOption(options, program.opts())` for commands that accept a body, so `--json` works.
- Take id lists as comma-separated values (`--tags 101,102`), never raw JSON arguments. Braces and quotes break in PowerShell and bash. Normalize array input from `--json` with the same code path (see `parseTagsOption`).

### SDK registration (`src/index.ts`)

- Register the module on `VanApi` if it isn't there already.

### Tests

- `tests/commands/smoke.test.js`: add an exact `toHaveBeenCalledWith(path, body)` assertion for each new or changed method, so path and body changes are caught. When a method needs a specific response (such as `{ storyId }`), use `client.post.mockResolvedValueOnce(...)`. Don't change the shared default mocks.
- `tests/commands/coverage.test.js`: update the entity's block and the "validation branches for required fields" test. Add a test for each required field and for any response-handling branch.
- Remove tests for deleted methods.
- `src/cli.ts` runs `program.parseAsync(process.argv)` when it loads, so don't import it in Jest. Test CLI-only parsing through an exported pure helper, or note the gap.

### Docs

- Update the entity's line in both README lists ("SDK support" and "CLI support"). Add a usage example under "CLI usage" for any new create command.

### Verify

- Run `npm test`, which cleans, builds and runs Jest. Fix failures before reporting.
- Run each new command once with `--dry-run` (for example `node bin/cli.js --dry-run <entity> create ...`) and check the method, path and body.
- Report what changed and anything still unverified that the developer should test live. Don't commit unless asked.
