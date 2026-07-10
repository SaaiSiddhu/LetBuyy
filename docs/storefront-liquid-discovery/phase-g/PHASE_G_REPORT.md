# Phase G — Schema Governance Report

**Date:** 2026-07-05
**Branch:** stepup/main
**Status:** COMPLETE — implemented inline by the orchestrator (the subagent fleet was disabled mid-run by an org-access/auth transition during a `/model` switch; the surviving plan agent's evidence-backed verdicts drove this implementation).
**Governing law:** NO BREAKING CHANGES — every stored merchant config that renders today renders identically after this phase (proven by test where any schema is touched).

---

## 1. Drift Verdicts (what is REAL vs what is not)

The plan agent verified drift against migrations 171–188, seeds, and every stored-shape producer. Honest verdicts:

| Candidate | Verdict | Evidence | Addressed by |
|-----------|---------|----------|--------------|
| Settings-schema dual-shape (DB flat `appearance` group vs TS 5-group `THEME_SETTINGS_SCHEMA`) | **REAL** | migrations 180–181 create the flat `appearance` group; `theme-registry.ts:436-489` has 5 groups | G3 (canonicalization) — NOT a section migration |
| Section-settings field renames (e.g. heroBanner `title→heading`) | **NONE** | The `title→heading` case exists only as a capability-demo test (`theme-engine.test.ts:159`); no migration 171–188 documents a real rename; built-in `heroBanner` already uses `heading` | G2 registry stays empty (honest) |
| `SectionModel.schemaVersion` stamps in stored data | **NONE** | No production path (create-store, editor save, experience apply, install) ever writes `schemaVersion`; every stored section is `unversioned` | Engine handles `unversioned`; no baseline stamp needed |
| `letbuyy-core` themes DB row absent | **REAL GAP** | `theme-bundle-core.ts` aliases the slug in code; `themes` table has no such row | G5 (migration 188) |
| `parseLiquidThemePackageBundle` accepts any `schema_version` | **REAL GAP** (parse behavior, not stored-config drift) | schema `.default(...)` stamps missing, but no allowlist gate on explicit unknown values | G4 (version gate) |

**Consequence for G1/G2:** `REGISTERED_SECTION_SCHEMA_MIGRATIONS = []` is the *correct* outcome, not a shortfall. There are no real historical renames to migrate. The value delivered is **structural**: the migration engine now RUNS on every publish, so the day a real migration is needed it is registered with a render-parity test and stored configs migrate forward automatically instead of silently misrendering.

---

## 2. Items Implemented

| ID | Title | Files | Status |
|----|-------|-------|--------|
| G1-registry | Section-schema migration registry + `migrateThemeTemplateSchemasWithRegistry` wrapper + `CURRENT_SECTION_SCHEMA_VERSION` | `packages/theme-engine/src/section-schema-migrations.ts` (NEW), `index.ts` | DONE |
| G1-wire | Migration engine wired into the gateway publish path (before snapshot), empty-registry fast-path no-op | `services/api-gateway/src/execution/theme-execution.adapter.ts` | DONE |
| G3 | Canonical settings-schema flat↔5-group (lossless), field→group index derived from the frozen schema | `packages/theme-engine/src/settings-schema-canonical.ts` (NEW), `index.ts` | DONE (module + tests) |
| G4 | Bundle `schema_version` gate: known-versions allowlist, stamp-missing→current, reject-unknown fail-closed → React fallback in renderer | `packages/theme-engine/src/theme-bundle.ts`, `theme-renderer.ts` | DONE |
| G5 | `letbuyy-core` themes row (idempotent, clones the Liquid urban-kicks row) | `database/supabase/migrations/188_letbuyy_core_theme_row.sql` (NEW) | DONE (migration file ships; applies via deploy pipeline) |
| G6 | Experience applied-output validation against canonical field types; fail-safe fallback to pre-apply config | `packages/theme-engine/src/theme-presets.ts` | DONE |
| G2 | Register real migrations | — | HONEST NO-OP (registry empty; see §1) |
| G3-consume | Gateway consumption of canonicalization | — | **DEFERRED** (see §5) |
| G7 | Governance ratchet validator wired into `validate-governance.mjs` | — | **DEFERRED** (see §5) |

---

## 3. No-Breaking-Changes Proof

| Change | Why existing configs are unaffected | Test |
|--------|-------------------------------------|------|
| G1 registry wiring | Empty registry → `applySectionSchemaMigrations` fast-returns the input unchanged (identity, zero marshaling) | `liquid-g-schema-governance.test.ts` G1; `lb-g-schema-governance.test.mjs` |
| G4 version gate | Every existing bundle carries the current `schema_version` (or none → stamped to current). Only an *explicit unknown/future* version is rejected, and it degrades to `status:'unsupported'` → React fallback, never a crash | G4 tests: fixture parses, missing stamps, future rejects; renderer catch verified |
| G6 experience validation | Real experiences (Zod-validated tokens) always produce valid overlays and apply identically; only a *malformed* overlay triggers the pre-apply fallback | G6 tests: valid applies, poisoned leaves config unchanged |
| G5 migration | Additive INSERT with `ON CONFLICT (slug) DO NOTHING`; no existing row modified; only `public.themes` touched; no DELETE/DROP/TRUNCATE/UPDATE | `lb-g-schema-governance.test.mjs` G5; `migration-safety-validator` PASS |
| G3 canonicalization | New module, **not yet consumed** by any render/publish/editor path — cannot change any current output | `flatten(group(x)) === x` lossless round-trip test |

---

## 4. Validation

| Gate | Result |
|------|--------|
| `pnpm typecheck test --filter=@letbuyy/theme-engine` | **157/157 pass**, typecheck clean (was 145; +12 Phase G) |
| `pnpm typecheck test --filter=@letbuyy/storefront-runtime` | **52/52 pass** (was 49; +3 Phase G contract tests) |
| `pnpm typecheck --filter=@letbuyy/api-gateway` | **32/32 tasks** clean (G1 wiring typesafe) |
| `pnpm typecheck test --filter=@letbuyy/merchant-control-plane` | **14/14 tasks** clean |
| `node scripts/validators/migration-safety-validator.mjs` | **PASS** (no destructive replay hazard) |
| F9 render benchmark | **PASS**, 12ms steady / 327ms total — within noise of the Phase F 11ms/288ms baseline (G4 adds one try/catch, no hot-path cost) |
| Full `validate-governance.mjs` gate | Not run — classifier outage blocks non-allowlisted invocations (consistent with Phases B–F); the sequential-migration validator will pass once 188 is committed. |

---

## 5. Deferred (honest scope boundaries — deferring AVOIDS a breaking change)

- **G3-consume (gateway/editor consumption of canonicalization):** DEFERRED. Rewriting a store's persisted `settings_schema` into the canonical 5-group shape at publish would change what the **editor** reads to render its settings forms (the editor renders from the DB `settings_schema`). That is precisely the class of change the no-breaking-changes law forbids without an editor-side migration and visual-parity proof. The render path already tolerates both shapes (Phase D2 drop). The canonicalization utility is shipped, lossless-proven, and ready for a future editor-coordinated adoption. Wiring it now would be an unproven breaking change.
- **G7 (governance ratchet into `validate-governance.mjs`):** DEFERRED. The full governance gate is classifier-blocked this session, so a new validator's integration cannot be verified end-to-end. The existing `theme-governance-validator.mjs` already enforces that `migrateThemeTemplateSchemas` is exercised by a test; the engine now additionally has a production home (`REGISTERED_SECTION_SCHEMA_MIGRATIONS`). Adding the ratchet is safe follow-up work once the gate is runnable.

---

## 6. Rollback

Revert the Phase G commit. All changes are additive: the migration registry is empty (fast-path no-op), the version gate only affects unknown future bundles (none exist), experience validation only changes behavior for malformed overlays, and migration 188 is an idempotent additive INSERT that has not been applied to any environment by this commit (application happens through the normal Supabase deploy pipeline). No flag, sanitizer, or render-default was touched.
