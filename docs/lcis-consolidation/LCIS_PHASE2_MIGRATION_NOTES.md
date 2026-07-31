# LCIS Phase 2 Migration Notes

How Phase 2 slots into the monorepo, what changed, and what did not.

---

## New Packages

Four new packages were added in Phase 2. All are additive — they do not modify any existing package.

| Package | Location | Type |
|---------|----------|------|
| `@letbuyy/lcis-cli` | `packages/lcis-cli/` | Workspace package (ESM) |
| `@letbuyy/lcis-mcp` | `packages/lcis-mcp/` | Workspace package (ESM) |
| `@letbuyy/lcis-pr-check` | `packages/lcis-pr-check/` | Workspace package (ESM) |
| `@letbuyy/lcis-api` | `services/lcis-api/` | Service (ESM, no `bin`) |

All four declare `@letbuyy/lcis-core` as `workspace:*` — they always consume the local Phase 1 engine.

---

## No Breaking Changes

Phase 2 is purely additive:

- No existing package's `package.json`, `tsconfig.json`, or source files were modified
- No existing workspace scripts were removed or renamed
- `@letbuyy/lcis-core` (`packages/lcis-core/`) is unchanged from Phase 1
- The governance validator (`scripts/validate-governance.mjs`) passes without modification
- The 107 deterministic validators are unaffected

---

## Root Workspace Script Additions

New scripts added to the root `package.json` (the existing scripts block is unchanged):

| Script | Command |
|--------|---------|
| `lcis` | `pnpm --filter @letbuyy/lcis-cli run start` |
| `lcis:mcp` | `pnpm --filter @letbuyy/lcis-mcp run start` |
| `lcis:api` | `pnpm --filter @letbuyy/lcis-api run start` |
| `lcis:pr-check` | `pnpm --filter @letbuyy/lcis-pr-check run start` |

---

## Dependency Additions

No new dependencies were added to any existing package. The four new packages pull in:

| Dependency | Used by |
|------------|---------|
| `commander ^12.1.0` | lcis-cli |
| `@modelcontextprotocol/sdk ^1.0.0` | lcis-mcp |
| `hono ^4.7.0` | lcis-api |
| `@hono/node-server ^1.13.0` | lcis-api |
| `zod ^4.3.6` | lcis-cli, lcis-mcp, lcis-api, lcis-pr-check |

`zod` is already present in many other packages in the monorepo at `^4.3.6` — no version conflict.

---

## CI Additions

Two new CI files were added:

| File | What it does |
|------|-------------|
| `.github/actions/lcis-analysis/action.yml` | Composite action: diff → pr-check → comment → artifact |
| `.github/workflows/lcis-pr-analysis.yml` | Workflow: triggers on PR, caches `graphify-out/`, calls composite action |

No existing workflows were modified.

---

## Build Outputs

Each package builds to its own `dist/` directory (TypeScript → `tsc`):

```
packages/lcis-cli/dist/cli.js      # lcis binary
packages/lcis-mcp/dist/server.js   # lcis-mcp binary
packages/lcis-pr-check/dist/cli.js # lcis-pr-check binary
services/lcis-api/dist/server.js   # API server entry
```

All `dist/` directories are gitignored.

---

## Module System

All four packages are `"type": "module"` (ESM). They match `@letbuyy/lcis-core` which is also ESM. No CommonJS interop is needed.

---

## TypeScript Configuration

Each package has its own `tsconfig.json` extending the repo root config. No changes to the root `tsconfig.json` or shared tsconfig were required.

---

## Testing Infrastructure

Each package uses the Node.js built-in test runner (`node --test`, invoked via `tsx --test`):

```
pnpm --filter @letbuyy/lcis-cli test
pnpm --filter @letbuyy/lcis-mcp test
pnpm --filter @letbuyy/lcis-api test
pnpm --filter @letbuyy/lcis-pr-check test
```

Or run all Phase 2 tests at once:
```bash
pnpm --filter "@letbuyy/lcis-*" test
pnpm --filter "@letbuyy/lcis-api" test  # services/ package
```

---

## Rollback

Phase 2 can be rolled back without affecting any other part of the system:

1. Remove `packages/lcis-cli/`, `packages/lcis-mcp/`, `packages/lcis-pr-check/`, `services/lcis-api/`
2. Remove the 4 root workspace scripts
3. Remove `.github/actions/lcis-analysis/` and `.github/workflows/lcis-pr-analysis.yml`
4. `packages/lcis-core/` remains intact and is unaffected

No database migrations, no topology changes, no breaking changes to existing apps.
