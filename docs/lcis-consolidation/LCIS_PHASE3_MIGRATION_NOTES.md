# LCIS Phase 3 Migration Notes

How Phase 3 slots into the monorepo, what changed, and what did not.

---

## New Packages

Two new packages added in Phase 3. Both are additive — they do not modify any existing package.

| Package | Location | Type |
|---------|----------|------|
| `@letbuyy/lcis-adapters` | `packages/lcis-adapters/` | Workspace package (ESM) |
| `@letbuyy/lcis-live` | `packages/lcis-live/` | Workspace package (ESM) |

Both declare `@letbuyy/lcis-core` as `workspace:*`. `lcis-live` additionally declares `@letbuyy/lcis-adapters` as `workspace:*`.

---

## Extended Access Packages (Additive)

Three Phase 2 packages were extended with live surfaces. No existing commands, exports, or behavior was changed.

| Package | Addition |
|---------|---------|
| `@letbuyy/lcis-cli` | `live`, `db`, `github`, `cloudflare`, `vercel`, `investigate` command groups |
| `@letbuyy/lcis-mcp` | 5 live MCP tools: `lcis_live_status`, `lcis_live_investigate`, `lcis_db_health`, `lcis_recent_changes`, `lcis_deployment_status` |
| `services/lcis-api` | 7 live routes: `GET /live/health`, `GET /live/status`, `POST /live/investigate`, `GET /db/status`, `GET /github/status`, `GET /cloudflare/status`, `GET /vercel/status` |

All three packages added `@letbuyy/lcis-live` as a `workspace:*` dependency.

---

## The `HealthResult.missingEnvVars` Contract Field

`HealthResult` in `packages/lcis-adapters/src/shared/contracts.ts` adds the `missingEnvVars` field:

```ts
interface HealthResult {
  status: AdapterStatus
  latencyMs: number
  checkedAt: string
  missingEnvVars?: string[]   // new in Phase 3
  error?: string
}
```

This is **additive** — existing consumers of the Phase 2 `HealthResult` type (none existed; the type is new to Phase 3) are unaffected. The field is optional, so any future consumer that doesn't reference it is unaffected.

---

## No Breaking Changes

Phase 3 is purely additive:

- No existing package's `package.json`, `tsconfig.json`, or source files were modified except to add a new dependency and new command handlers.
- `@letbuyy/lcis-core` (`packages/lcis-core/`) is unchanged from Phase 1.
- `@letbuyy/lcis-adapters` and `@letbuyy/lcis-live` are new packages — they have no prior consumers.
- The governance validator (`scripts/validate-governance.mjs`) passes without modification.
- The 107 deterministic validators are unaffected.

---

## Root Workspace Script Additions

New scripts added to the root `package.json`:

| Script | Command |
|--------|---------|
| `lcis:adapters` | `pnpm --filter @letbuyy/lcis-adapters run build` |
| `lcis:live` | `pnpm --filter @letbuyy/lcis-live run build` |

Existing scripts (`lcis`, `lcis:mcp`, `lcis:api`, `lcis:pr-check`) are unchanged.

---

## New Dependencies

| Dependency | Used by | Notes |
|------------|---------|-------|
| `zod ^4.3.6` | `lcis-adapters`, `lcis-live` | Already in the monorepo at this version |

The three extended access packages (`lcis-cli`, `lcis-mcp`, `services/lcis-api`) added `@letbuyy/lcis-live` as a `workspace:*` peer. No new external dependencies.

---

## Rollback Steps

Phase 3 is additive; rollback does not require touching any pre-existing package.

1. Remove `packages/lcis-adapters/` and `packages/lcis-live/` from the monorepo.
2. Remove the live command groups from `packages/lcis-cli/src/cli.ts` (the `live`, `db`, `github`, `cloudflare`, `vercel`, `investigate` blocks).
3. Remove the 5 live MCP tools from `packages/lcis-mcp/src/tools.ts`.
4. Remove the 7 live routes from `services/lcis-api/src/app.ts`.
5. Remove `@letbuyy/lcis-live` from the `dependencies` of `lcis-cli`, `lcis-mcp`, and `lcis-api` in their `package.json` files.
6. Remove `lcis:adapters` and `lcis:live` scripts from root `package.json`.

All Phase 1 and Phase 2 behavior is restored. No data is lost (the live adapter platform holds only in-memory snapshots, no persistent state).

---

## Artifact Dependency Note

The `CorrelationEngine` and structural checks (schema-drift, missing-rls) in `@letbuyy/lcis-adapters` read `graphify-out/db-intel.json` and `graphify-out/code-graph.json` via `@letbuyy/lcis-core`'s `ArtifactStore`. These artifacts are gitignored and must be generated locally with `pnpm graph:update && pnpm graph:db`. If the artifacts are absent, affected checks are skipped gracefully — no error is thrown; the finding is simply omitted.

This is the same behavior as Phase 1 and Phase 2: LCIS degrades gracefully when the artifact store is not populated.
