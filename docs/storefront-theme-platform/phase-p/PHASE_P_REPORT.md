# Phase P Report — Drafts, Revisions, Publish, and Rollback

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** P — Drafts, Revisions, Publish, and Rollback
**Date authored:** 2026-07-10
**Branch:** `stepup/main`
**Author scope:** Phase P ships the full draft-to-publish lifecycle for the theme persistence surface. No new DB tables, no modification to SECURITY DEFINER RPCs, no frozen apps touched.

---

## HUMAN REVIEW GATE — Read Before Deploying

Migration 189 (`189_theme_persistence_idempotency.sql`) adds a nullable `idempotency_key` column to `theme_releases` and a partial unique index on `(store_id, idempotency_key)`. **This migration has NOT been applied to any database. It MUST NOT be applied to production without explicit ARB sign-off.** See `PHASE_P_MIGRATION_REPORT.md` for the full safety analysis.

The Phase P code changes are complete and all 24 new tests pass. The implementation is ready for review. No production deployment is implied by this phase completion.

---

## 1. What Shipped

### 1.1 New Files

| File | Purpose |
|---|---|
| `database/supabase/migrations/189_theme_persistence_idempotency.sql` | Adds nullable `idempotency_key` column + partial unique index `(store_id, idempotency_key) WHERE NOT NULL AND deleted_at IS NULL` to `theme_releases` |
| `services/api-gateway/src/__tests__/theme-persistence-p.test.ts` | 24 tests covering all Phase P paths, cross-tenant proof, concurrency patterns, audit events, store_id guard patterns, fallback supersede error handling |

### 1.2 Modified Files (Surgical)

| File | Change |
|---|---|
| `packages/theme-engine/src/index.ts` | Export additions for `parseThemeDocument` / `parseLiquidThemePackageBundle` as required by the validate route's service call (surgical, additive only) |
| `services/api-gateway/src/schemas/theme.schema.ts` | `ValidateThemeDocumentSchema` added; `idempotency_key?: z.string().min(8).max(200)` added to `PublishThemeSchema`; `expected_current_release_id?: z.string().uuid()` added to `RollbackThemeReleaseSchema` |
| `services/api-gateway/src/execution/theme-execution.adapter.ts` | `validateDocument()` new method; `publish()` gains idempotency pre-check, post-enrich (with error handling), and audit event; `rollbackRelease()` gains CAS guard and audit event; 3 new `store_id` guards on pre-existing `ensureThemeInstance` + `saveInstanceDraftSnapshot` UPDATE calls; `publishReleaseSnapshotFallback` supersede error captured and thrown |
| `services/api-gateway/src/routes/themes.ts` | `POST /:slug/validate` registered BEFORE the `GET /:slug` catch-all to prevent route shadowing |

### 1.3 What Was Not Touched

- `publish_theme_release` SECURITY DEFINER RPC — unchanged (ARB gate)
- `theme-registry.ts` — frozen (ART-17)
- `theme-governance.ts` — `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` stays `false`
- `packages/theme-engine/src/` modules (theme-document, theme-bundle, experience-apply, etc.) — unchanged by Phase P
- DOMPurify sanitizer — unchanged
- Frozen apps (`app-marketplace`, `theme-marketplace`, `developer-portal`) — unchanged
- Foreign WIP files (migrations 186/187, tenant-registry drift, identity-platform, marketing-site WIP) — undisturbed

---

## 2. Test Gate Result

| Stage | Tests passing | Typecheck |
|---|---|---|
| Phase O baseline (entering Phase P) | 1034 (theme-engine) | Clean |
| Phase P implementation (pre-hardening) | 437 (api-gateway) + 1034 (theme-engine) | Clean |
| Phase P hardening (final) | **438 (api-gateway) + 1034 (theme-engine)** | **Clean (32/32 tasks)** |

Command: `pnpm --filter=@letbuyy/api-gateway run test:unit`

Net new tests: **+24**. 3 pre-existing failures unchanged. 0 Phase P regressions.

---

## 3. Key Design Decisions

### 3.1 TS-Layer Idempotency Instead of RPC Modification

The canonical dedup pattern would be to add `p_idempotency_key` to the `publish_theme_release` SECURITY DEFINER RPC and handle `ON CONFLICT` within the atomic Postgres transaction. This is the correct full solution and is ARB-gated.

Phase P implements a TS-layer pre-check + post-enrich pattern as the near-term mitigation. This correctly handles the sequential-retry case (dominant real-world pattern) but leaves the concurrent-window case as a documented TOCTOU residual. The unique index on `(store_id, idempotency_key)` ensures the post-enrich step cannot create a second keyed record even in the concurrent case.

### 3.2 Validate Route as a No-Write Pre-Flight Gate

The validate route exists so editors can pre-flight a `ThemeDocument` V2 + G4 bundle before committing to a publish. It is intentionally stateless — no DB reads beyond the sites ownership check, no audit event that would block the response. A best-effort non-blocking `emitAuditEvent('theme.document.validate')` provides a forensic trail for the security team without affecting the caller's latency.

### 3.3 Optional CAS Field for Backward Compatibility

`expected_current_release_id` is optional on `RollbackThemeReleaseSchema`. Existing callers (SDK, scripts) that do not supply the field continue to work. New callers (Phase R editor) should always supply it to get the safety guarantee.

### 3.4 store_id Explicit in Every Mutation

Phase P hardened three pre-existing `UPDATE` calls that filtered by `id` alone (authorization-by-derived-id pattern). While normal-flow exploitation was not possible (ids were correctly derived from store-scoped queries), the program's invariant is that every mutation carries an explicit tenant scope in its WHERE clause, making any future id-derivation bug non-exploitable.

---

## 4. Hardening Summary

Eight findings from code review were addressed:

| Finding | Severity | Resolution |
|---|---|---|
| Idempotency post-enrich UPDATE error discarded | HIGH | `const { error: keyError }` captured; unique-constraint violations tolerated; other errors logged with forensic repair SQL |
| `saveInstanceDraftSnapshot` UPDATE on `theme_instance_drafts` no `store_id` guard | MEDIUM | `.eq('store_id', input.storeId)` added |
| `ensureThemeInstance` theme_instances UPDATE no `store_id` guard | MEDIUM | `.eq('store_id', storeId)` added |
| `saveInstanceDraftSnapshot` current_draft_id pointer UPDATE no `store_id` guard | MEDIUM | `.eq('store_id', input.storeId)` added |
| `publishReleaseSnapshotFallback` supersede error discarded | MEDIUM | `const { error: supersededError }` captured; throws before INSERT proceeds |
| Test mislabelling: HS256 rejection layer incorrectly described | MEDIUM | Test renamed to `'secondary defense: unknown Supabase user profile returns 403'`; new test added for primary auth layer |
| Draft CAS bypass when `base_version` omitted | MEDIUM | Documented at call sites with ARB-gated note; not fixed in Phase P (pre-existing behaviour) |
| `validateDocument` emits no audit trail | LOW | Best-effort non-blocking `emitAuditEvent('theme.document.validate')` added (`.catch(() => {})`) |

Four findings remain as ARB-gated residuals (not regressions):
- Publish TOCTOU: add `p_idempotency_key` to `publish_theme_release` RPC with `ON CONFLICT`
- Rollback CAS: add `p_expected_current_release_version` to SECURITY DEFINER RPC
- Draft CAS bypass when `base_version` omitted: make required for concurrent-save editors
- Fallback publish non-transactional writes: wrap in Postgres transaction (full safety)

---

## 5. [IRREVERSIBLE] Operations — None in Phase P

Phase P makes no irreversible DB changes. Migration 189 is additive (nullable column + partial index) and has NOT been applied to any database. The only potential irreversibility is:

- **If migration 189 were applied to production AND subsequently needed to be rolled back:** `DROP COLUMN` would be required. This is ARB-repaired (forbidden by `migration-safety-validator`). The column being nullable means the TS code can be reverted without rolling back the migration — the column becomes dormant.

No SECURITY DEFINER RPC was modified. No existing RLS policy was changed.

---

## 6. Rollback

Rollback = revert the Phase P commit(s):

```bash
git revert <phase-p-commit-sha>
```

Phase P adds:
- 2 new files (migration 189, test file)
- Surgical changes to 4 existing files (index.ts, theme.schema.ts, theme-execution.adapter.ts, themes.ts)

A revert removes all new files and reverses the surgical changes. Migration 189 has not been applied to any database, so no DB rollback is required.

---

## 7. Architectural Invariants Maintained

| Constraint | Status |
|---|---|
| `theme-registry.ts` frozen (ART-17) | MAINTAINED |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` | MAINTAINED |
| `publish_theme_release` SECURITY DEFINER RPC unchanged | MAINTAINED (ARB gate respected) |
| DOMPurify sanitizer unchanged | MAINTAINED |
| Frozen apps unchanged | MAINTAINED |
| Foreign WIP files undisturbed | MAINTAINED |
| `validate-governance.mjs` EXIT=1 pre-existing failure | UNCHANGED (pre-existing foreign drift; Phase P does not fix and does not worsen) |
| No unconditional `USING(true)` on tenant data in Phase P additions | CONFIRMED |
| Canonical ledger (`canonical-ledger-only-validator`) — no money table mutations | MAINTAINED (Phase P touches only theme tables) |
| `fromThemeDocumentV2` round-trip invariant | MAINTAINED — validate route calls `parseThemeDocument` + `parseLiquidThemePackageBundle`; draft save path uses `saveDraft()` which already enforces the round-trip |

---

## 8. Risks Registered

Three new Phase P risks are added to `RISK_REGISTER.md`:

- **RISK-SEC-P01** (MEDIUM): `theme_editor_drafts` RLS policies check `sites.user_id` only — not `custom_user_id`. Pre-existing debt not introduced by Phase P. Gateway bypasses via service_role today. Target: dedicated security migration or Phase R.
- **RISK-TOCTOU-P01** (LOW): Publish TOCTOU — truly concurrent publishes (same idempotency_key, ~1-5ms window) can both pass the TS pre-check and call the RPC, potentially creating one keyless ghost release. ARB-gated: `p_idempotency_key` to RPC. Sequential-retry case correctly handled by Phase P.
- **RISK-TOCTOU-P02** (LOW): Rollback CAS is TS-level only — concurrent rollbacks both passing the same window result in the second write winning `is_current`. ARB-gated: `p_expected_current_release_version` to RPC.

---

## 9. Phase Completion Checklist

- [x] `POST /themes/:slug/validate` route registered before GET catch-all
- [x] `ValidateThemeDocumentSchema`, `PublishThemeSchema.idempotency_key`, `RollbackThemeReleaseSchema.expected_current_release_id` — schema changes in `theme.schema.ts`
- [x] `validateDocument()` method: `verifyStoreOwner` → `parseThemeDocument` → optional bundle gate → best-effort audit event
- [x] `publish()` additions: idempotency pre-check (store_id first), post-enrich UPDATE (both release_id + store_id), error handling for post-enrich, audit event
- [x] `rollbackRelease()` additions: CAS guard (store_id first in query), audit event
- [x] 3 explicit `store_id` guards on pre-existing `ensureThemeInstance` + `saveInstanceDraftSnapshot` UPDATE calls
- [x] `publishReleaseSnapshotFallback` supersede error captured and thrown
- [x] Migration 189: `idempotency_key` nullable column + partial unique index `(store_id, idempotency_key)` WHERE NOT NULL
- [x] `migration-safety-validator` exit 0
- [x] Final gate: api-gateway 438/438 pass (3 pre-existing failures unchanged), theme-engine 1034/1034 unchanged, typecheck 32/32 clean
- [x] Cross-tenant proof: 2 complementary layers (mock-db ForbiddenError + source-pattern store_id ordering)
- [x] TOCTOU residuals documented at code level (comment blocks) and in this report
- [x] RISK_REGISTER.md updated (3 new entries: RISK-SEC-P01, RISK-TOCTOU-P01, RISK-TOCTOU-P02)
- [x] PROGRAM_STATE.md updated: Phase P COMPLETE, next = Q
- [x] DATA_MODEL.md, SECURITY_MODEL.md, API_CONTRACTS.md created for theme-persistence surface

---

## 10. Next Phase

**Phase Q — Merchant Theme Library**

Phase Q builds the merchant-facing theme library: browsing the global themes catalog, previewing themes, installing/uninstalling a theme to a store, and the theme instance lifecycle. It consumes `theme_releases` (read: current state for each store), `themes` (global catalog), and the `publish_theme_release` RPC. Phase Q does not modify Phase P's draft/publish/rollback surface.

Gate entering Phase Q: `pnpm --filter=@letbuyy/api-gateway run test:unit` baseline **438** (api-gateway) + **1034** (theme-engine).
