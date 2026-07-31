# 14 — Regression

**Status:** ✅ No regressions. This phase's fixes added coverage and broke nothing.

| Check | Result |
|---|---|
| **merchant-control-plane typecheck** (`tsc --noEmit`) | ✅ clean — the new collections proxy + AISidebar edit compile ("every page compiles") |
| New contract test `lb-merchant-admin.test.mjs` | ✅ **2/2** (collections proxy PATCH/DELETE + delegation; AISidebar link fixed) |
| Full launch suite (`tests/launch/*.test.mjs`) | ✅ **171/171** (was 169 + 2 new) |
| `foundation-antifabrication-gate` | ✅ PASS |
| `undeclared-import-validator` | ✅ PASS |
| Canonical-ledger / frozen-path / theme-governance / no-new-react / session-security (carried green from Phase 3) | ✅ PASS |
| `validate-design-system` | 🔴 PRE-EXISTING WIP (cross-app CSS drift; this phase added 0 — see `13-ux.md`) |
| `tenant-isolation-validator` | 🔴 PRE-EXISTING WIP (registry drift; not this phase) |

## Scope of change this phase
2 files changed + 1 test added:
- `apps/merchant-control-plane/src/app/api/stores/[store]/collections/[collectionId]/route.ts` (NEW — edit/delete proxy)
- `apps/merchant-control-plane/src/components/AISidebar.tsx` (1-line link fix)
- `tests/launch/lb-merchant-admin.test.mjs` (NEW — 2 contract tests)

No money path, no frozen file, no schema, no new React section touched. **No regressions introduced.**
