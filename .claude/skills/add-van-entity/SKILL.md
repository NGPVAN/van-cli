---
name: add-van-entity
description: Audit and implement van-cli support for one NGP VAN API entity (e.g. bulkImport, customFields, stories). Phase 1 compares the real VAN endpoints against the existing SDK module, CLI commands, tests and README and reports gaps for developer review; Phase 2 implements the agreed scope. Use when asked to add, update, audit or finish CLI support for a VAN entity.
argument-hint: <entity name, any casing> [special instructions]
---

# add-van-entity

Arguments: `$ARGUMENTS`. The first word is the entity. Everything after it is special instructions from the developer. Those instructions override the defaults below.

The skill runs in two phases with a hard stop between them. **Do not edit any file in Phase 1.**

---

## Phase 0: Resolve the entity name

The developer may give the name in any form, and it may not match exactly: `bulkImport`, `bulk-import`, `bulk_import`, `BulkImportJobs`, `bulk import`. Split it into words and build these variants:

- camelCase (`bulkImport`): the `src/commands/<entity>.ts` module, the `VanApi` property, the README lines and the API route prefix
- PascalCase (`BulkImportJobs`): the VAN controller (`<PascalCase>Controller.cs`) and its DTOs
- kebab-case (`bulk-import`): the CLI command group. If the entity already has a group, keep its existing name, even if it doesn't match this form, unless the developer asks to rename it.
- lowercase with no separators (`bulkimportjobs`): the docs reference page names
- Title Case (`Bulk Import`): the `// --- <Entity> ---` section in `cli.ts` and the docs headings

Search each source with the variant that fits it, and also try singular and plural forms and nearby names (`bulkImport` and `bulkImportJobs`, `events` and `eventTypes`). If the matches point to more than one entity, or to none, list the candidates and ask the developer before going on. Use the resolved forms everywhere below.

---

## Phase 1: Research and report

### 1. Gather the real VAN endpoint surface

Use each source and record which ones confirm each endpoint:

- **The VAN API source (`NGPVAN/VAN`).** This is the authoritative source. Use a local checkout if the developer has one (ask for its path if you don't know it, for example `c:\code\VAN`). Otherwise read the repository on GitHub with `gh` (`gh search code --repo NGPVAN/VAN <PascalCase>Controller`, then `gh api repos/NGPVAN/VAN/contents/<path>`). If neither is available, say so in the report and fall back to the docs. Read:
  - **The controller**, usually `Source/Web.Api/Model/<Area>/<PascalCase>Controller.cs`. Find it by searching `.cs` files for the route prefix (`changedEntityExportJobs`), because the folder doesn't always match the entity. The `[RoutePrefix]` and each action's `[Http*]` and `[Route]` attributes are the complete list of endpoints. Note route constraints (`{id:long}`) and security checks.
  - **The request and response DTOs** in `Source/Web.Api.Dtos/<Area>/`. These list every field the API accepts and returns, including fields the docs leave out.
  - **The FluentValidation validator** in `Source/Web.Api/Model/<Area>/Validation/<Dto>Validator.cs`. This holds the required fields, ranges, maximum list sizes and cross-field rules. Mirror these in the SDK layer.
  - **Translators and services**, only when a field's meaning or default isn't clear from the DTO and validator (for example, what a filter field joins on, or what a missing date defaults to).
- **VAN docs.** These are a secondary source, for descriptions, examples and behavior notes. They're often incomplete or wrong (for example, they mark a request field as response-only), so when the docs and the code disagree, the code wins. Note each disagreement in the report. Adding `.md` to a docs URL gives a version agents can read; use it on every page you fetch.
  - Start at the reference page `https://docs.ngpvan.com/reference/<lowercase-no-separators>.md`, plus its singular and plural forms and nearby names (`bulkimport`, `bulkimportjobs`).
  - Sub-resource pages are named after the path with its segments joined in lowercase, for example `changedentityexportjobsexportjobid`, `changedentityexportjobsresources` and `changedentityexportjobsfieldsresourcetype`. For each endpoint in the controller, try its page.
  - The index at `https://docs.ngpvan.com/llms.txt` is a plain-Markdown site index for agents. It leaves out many reference pages, so don't treat a missing entry as a missing endpoint.
- **Developer input.** Use any request bodies, sample responses or quirks given in the special instructions.

### 2. Inventory current van-cli support

- `src/commands/<entity>.ts`: every SDK method and the method, path and body it sends.
- `src/cli.ts`: the `// --- <Entity> ---` section and every subcommand, option and required option.
- `src/index.ts`: whether the module is registered on `VanApi`.
- `tests/commands/coverage.test.js` and `tests/commands/smoke.test.js`: which methods are exercised and what is asserted.
- `README.md`: the entity's line in both "SDK support" and "CLI support".

### 3. Classify every endpoint and method

Treat existing van-cli code as **unverified**, not as proof that an endpoint exists. Many older modules were scaffolded by an agent with little context. They contain invented endpoints, wrong bodies and old-style validation. Don't use them as a model for anything, including style. When a module is like this, plan to rewrite it from the reference modules in Phase 2 rather than patch it. Mock-based Jest tests pass for any path, so they don't prove anything either.

Use one status per row:

| Status | Meaning |
|---|---|
| `supported` | Confirmed endpoint, SDK and CLI both implement it correctly |
| `sdk-only` | Confirmed endpoint, SDK has it, no CLI command |
| `missing` | Confirmed endpoint, not in van-cli at all |
| `incorrect` | van-cli implements it but the path, required fields or body shape differ from the source |
| `unverified` | van-cli implements it but the controller has no such action (or, without the VAN source, the docs don't show it) |

"Confirmed" means the controller has the action. When the VAN source isn't available, a docs page is enough, but say that the endpoint was confirmed from the docs only.

### 4. Report and stop

Present:

1. A table with these columns: endpoint (method and path), VAN source?, docs?, SDK method, CLI command, status, and recommended action (add, fix, keep, remove, or verify live).
2. **Request fields and rules** from the DTO and validator, especially ones the docs leave out or get wrong.
3. **Correctness bugs** found in the existing code, such as missing required-field validation or a wrong body shape.
4. **Open questions**, such as `unverified` endpoints when the VAN source wasn't available, or behavior only a live call can show (for example a POST that echoes nulls, or how a plain date is parsed). Recommend checking each one with `van --dry-run ...` to see the request and then a real call.
5. A **proposed scope** for Phase 2, with commands named in kebab-case.

Then stop and ask the developer to confirm or adjust the scope. Don't start Phase 2 until they reply.

---

## Phase 2: Implement the agreed scope

Implement only what was agreed. Follow the reliable, recently updated modules as the reference style: `src/commands/exportJobs.ts`, `folders.ts`, `savedLists.ts`, `stories.ts`, `activistCodes.ts`, `changedEntityExportJobs.ts`, and their `cli.ts` sections. Never use the module you're replacing as a model.

### SDK module (`src/commands/<entity>.ts`)

- Use the factory shape `const create = function(client: VanApiClientLike) { return { ... } }; export default create;` with short JSDoc on each method.
- Validate at the SDK layer with the helpers in `src/validation.ts` (`validatePositiveInt`, `validateIdList`, `validateIntRange`, `validateBoolean`, `validateWebhookUrl`, `validatePaging`), which throw `VanValidationError`. Check required fields before any request. Mirror the validator's rules (required fields, ranges, list maximums, date order and window) so bad input fails before the request is sent. Where a rule depends on something the client can't know, such as the API key's type, leave it to the server.
- Build request bodies from known input keys only, so output-only fields like ids, status or URLs are never sent. A module-level `buildCreatePayload` like the one in `exportJobs.ts` works well.
- For nested write objects, send just the id. For example, send `storyStatus: { storyStatusId }` even though GET returns `{ storyStatusId, statusName }`.
- If a POST response is unreliable (empty, null or zeroed fields), take the id from it, throw a clear error if the id is missing, and return a follow-up `this.get(id)`. See `stories.ts` `create`.
- If a PUT returns nothing, return a follow-up `this.get(id)` using the id you already have. See `signups.ts` `update`.
- Encode string path segments with `encodeURIComponent`.
- When a method is `unverified` and the developer chose to remove it, delete it outright. Don't leave stubs or comments.

### CLI (`src/cli.ts`)

- Keep everything in the entity's `// --- <Entity> ---` section, with the comment at column 0. Create the `<entity>Cmd` group in kebab-case if it doesn't exist, and register any new module import at the top of the file.
- Pass `lazyClient` to the module factory. Wrap each action in `try { ... outputResult(result, program.opts()); } catch (error) { handleError(error); }`.
- Use `.requiredOption()` for API-required fields and `.option()` for the rest. Positional ids go in `command('get <id>')`. Use `mergeJsonOption(options, program.opts())` for commands that accept a body, so `--json` works. Commander checks required options before the action runs, so `--json` can't supply a `.requiredOption()` field.
- Pass the merged options straight to the SDK method when the SDK already validates and picks known keys (see `export-jobs create`). Don't rebuild the body in the CLI.
- Add an `.addHelpText('after', ...)` block with one or two `Examples:` lines to each command.
- For checks that only matter to CLI input, use the helpers already in `cli.ts` (`validateNonemptyString`, `parseTagsOption`). Don't copy them into the SDK module. Rules the API enforces belong in the SDK layer. `validateDate` accepts only `YYYY-MM-DD`; when the API takes a full timestamp, validate it in the SDK instead.
- Take lists as comma-separated values (`--tags 101,102`), never raw JSON arguments. Braces and quotes break in PowerShell and bash. Normalize array input from `--json` with the same code path (see `validateIdList` and `parseTagsOption`).

### SDK registration (`src/index.ts`)

- Register the module on `VanApi` if it isn't there already.

### Tests

- `tests/commands/smoke.test.js`: add an exact `toHaveBeenCalledWith(path, body)` assertion for each new or changed method, so path and body changes are caught. Include one test that passes every option plus some output-only keys, and asserts the exact normalized body. When a method needs a specific response (such as `{ storyId }`), use `client.post.mockResolvedValueOnce(...)`. Don't change the shared default mocks.
- `tests/commands/coverage.test.js`: update the entity's block and the "validation branches for required fields" test. Add a test for each required field, each range or cross-field rule, and any response-handling branch.
- Remove tests for deleted methods.
- `src/cli.ts` runs `program.parseAsync(process.argv)` when it loads, so don't import it in Jest. Test CLI-only parsing through an exported pure helper, or note the gap.

### Docs

- Update the entity's line in both README lists ("SDK support" and "CLI support"). Add a usage example under "CLI usage" for any new create command.

### Verify

- Run `npm test`, which cleans, builds and runs Jest. Fix failures before reporting. Its `clean` step uses `rm -rf`. If that fails on Windows, run `npm run build && npx jest --runInBand` instead, and don't change `package.json`.
- Run each new or changed command once with `--dry-run` and the CLI command group (for example `node bin/cli.js --dry-run bulk-import create ...`), and check the method, path and body against the controller and DTO. A dry run still needs credentials, but it never sends the request, so a placeholder works: `VAN_API_KEY=dry-run-placeholder node bin/cli.js --dry-run ...`. Also run one command with invalid input to check that the validation error comes back.

### Report

- Report what changed and anything still unverified that the developer should test live. Don't commit unless asked.
- End the summary with **sample commands** that use fake data, about one per new or changed command. Together they should use every option at least once: a minimal and a full `create`, the lookups whose output feeds `create` (resource types, fields), and the `get` that polls the result. Put each in a fenced `bash` block.
