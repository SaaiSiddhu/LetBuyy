# LCIS Core Runbook

## Artifact Generation

`@letbuyy/lcis-core` is a **reader**, not a writer. It never generates artifacts.
Run the appropriate generator when artifacts are stale or missing:

```bash
# Code graph (graph.json — 52k nodes / 66k links)
uv tool install graphifyy
graphify update .

# Database intelligence (db-intel.json, memory-intel.json, and all domain/infra/readiness reports)
pnpm graph:db

# All reports in one pass (domain-intel, infra-intel, memory-intel, decision-engine-v2,
# fix-engine, production-readiness, production-readiness-v2, audit-engine-v2,
# connections-intel, launch-command-center, relationship-intel, execution-intel)
pnpm graph:omega
```

All generated artifacts land in `graphify-out/` (gitignored).

---

## Staleness Model

### `ArtifactMissingError`

When `store.read('some-artifact')` throws, the artifact does not exist. Remediation:

| Missing artifact | Generator command |
|-----------------|-------------------|
| `graph.json` | `graphify update .` |
| `db-intel.json` | `pnpm graph:db` |
| `domain-intel.json`, `infra-intel.json` | `pnpm graph:omega` |
| `memory-intel.json` | `pnpm graph:omega` |
| `decision-engine-v2.json`, `fix-engine.json` | `pnpm graph:omega` |
| `production-readiness*.json` | `pnpm graph:omega` |
| `audit-engine-v2.json` | `pnpm graph:omega` |
| `connections-intel.json` | `pnpm graph:omega` |
| `launch-command-center.json` | `pnpm graph:omega` |
| `relationship-intel.json` | `pnpm graph:omega` |

Services that use `store.tryRead()` (instead of `store.read()`) return a
`DomainError` or a reduced result rather than throwing. Example:
`BlastRadiusService.relationships()` returns `{ error: 'relationship-intel.json not available' }`
when the artifact is absent.

### `MemoryService` Staleness Flag

`MemoryService` has a built-in staleness signal independent of `ArtifactMissingError`.
`buildContext()` includes `stale: boolean` in its `ContextPack`:

```ts
const pack = svc.buildContext('query');
if (pack.stale) {
  // builtAtMigration < latestMigrationN
  // The corpus was indexed before newer migrations were applied.
  // Run: pnpm graph:omega
}
```

`pack.builtAtMigration` shows which migration the corpus reflects. Compare with
`svc.diagnostics().latestMigrationN` to understand the gap.

---

## Development Workflow

### Typecheck

```bash
pnpm --filter @letbuyy/lcis-core typecheck
# Expands to: tsc --noEmit
```

Run this before pushing to catch type errors without producing build output.

### Full Build

```bash
pnpm --filter @letbuyy/lcis-core build
# Expands to: tsc -b
# Output: packages/lcis-core/dist/
```

### Run Tests

```bash
pnpm --filter @letbuyy/lcis-core test
# Expands to: tsx --test test/*.test.ts
```

Tests that require optional artifacts (`domain-intel.json`, `relationship-intel.json`,
etc.) are automatically skipped when those artifacts are not present. Only
`graph.json` and the markdown corpus are required for all tests to run.

### Governance Gate

```bash
node scripts/validate-governance.mjs
```

This is a repo-wide gate, not specific to `lcis-core`. It checks 107 deterministic
validators across the entire monorepo. A pre-existing `tenant-registry` failure in
this gate is unrelated to `lcis-core` — it reflects a governance validator checking
broader topology. Do not conflate `lcis-core` test failures with governance gate
failures.

---

## Legacy Server Coexistence

`:3333` (`tools/graph-server/`) and `:3334` (`tools/central-intelligence/`) continue
to run during the transition period. `lcis-core` does not touch them.

### Verify-Before-Destroy Gate

Before retiring any legacy `:3333` / `:3334` endpoint, follow this sequence from
`LCIS_MIGRATION_PLAN.md §Verify-Before-Destroy Gate`:

1. Start both `:3333` and `:3334`.
2. Record baseline responses for every endpoint scheduled for archival/removal.
3. Confirm the `:3333` replacement endpoint (or `lcis-core` method) returns
   equivalent or richer data.
4. Only then execute the ARCHIVE/REMOVE step.
5. Regression-test all baseline endpoints against the replacement.

Do not skip this gate even for endpoints that appear unused — they may be called
by audit scripts or CI workflows.

---

## IO Exception: ArchitectureService and package.json

`ArchitectureService` reads `package.json` files directly from the repo filesystem
in its `#validateLayering()` private method and in `explainService()`. This is an
explicit exception to the ArtifactStore-only IO rule. It is documented in
`LCIS_CORE_ARCHITECTURE.md` and exists because `package.json` files are live repo
files, not generated artifacts.

The exception is bounded:
- Only `node:fs.readFileSync` calls in `src/architecture/ArchitectureService.ts`
- Only reads `apps/<name>/package.json`, `services/<name>/package.json`, or
  `packages/<name>/package.json`
- Never writes

If layer validation results look wrong after adding a new app or service,
regenerate `infra-intel.json` (`pnpm graph:omega`) AND check that the new
app/service has a `package.json` at the expected path.

---

## Common Issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `ArtifactMissingError: artifact not found: graph` | `graph.json` not generated | `graphify update .` |
| `ArtifactMissingError: artifact not found: domain-intel` | Reports not run | `pnpm graph:omega` |
| `blast('getSupabaseAdmin')` returns `null` | `graph.json` is stale (symbol moved or removed) | `graphify update .` |
| `MemoryService.buildContext()` returns `stale: true` | New migrations applied since last `graph:omega` | `pnpm graph:omega` |
| `verifyRuntime()` returns `PARTIAL` | Expected — 13 live sources are NOT CONNECTED | Wire live adapters or accept PARTIAL as structural-only verification |
| `launchVerdict()` returns `NO-GO` | Open critical blockers in `execution-intel.json` | Close the blockers, re-run `pnpm graph:omega` |
| Contract test fails: `unexpected runtime deps` | A forbidden dep was added to `package.json` | Remove it; `lcis-core` must have only `zod` as a runtime dep |
