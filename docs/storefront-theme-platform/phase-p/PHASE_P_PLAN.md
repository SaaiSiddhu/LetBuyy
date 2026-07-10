# Phase P Plan — Drafts, Revisions, Publish, and Rollback

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** P — Drafts, Revisions, Publish, and Rollback
**Date:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Scope

Phase P ships the full draft lifecycle for the theme persistence surface:

1. **POST /themes/:slug/validate** — new route; pre-flight validation of a `ThemeDocument` V2 + optional G4 bundle; no DB write.
2. **POST /themes/:slug/publish** — existing route gains TS-layer idempotency pre-check/post-enrich and an audit event.
3. **POST /themes/:slug/releases/:releaseId/rollback** — existing route gains a CAS guard for `expected_current_release_id` and an audit event.
4. **Migration 189** — adds nullable `idempotency_key` column + partial unique index to `theme_releases`.

No new DB tables, no new RLS policies, no modification to the `publish_theme_release` SECURITY DEFINER RPC.

---

## 2. Routes

### 2.1 POST /themes/:slug/validate (NEW)

**Auth chain:**
1. `authMiddleware` enforces ES256 merchant session via `identity-session-verifier.ts` `validateIdentityIssuedMerchantSessionToken` (alg=ES256, realm='merchant', token_use='merchant_session', aud='letbuyy:merchant-session').
2. `resolveCustomUser(db, auth.user)` → 403 FORBIDDEN if null.
3. Body validated by `ValidateThemeDocumentSchema`: `store_id: UuidSchema`, `theme_document: record`, `bundle?: record`.
4. `service.validateDocument(slug, body, customUser.id)` calls `verifyStoreOwner(body.store_id, userId)` — DB-checks `sites WHERE id=body.store_id AND (custom_user_id=userId OR user_id=userId) AND deleted_at IS NULL` — throws `ForbiddenError` if no row.
5. `site_id` is NEVER derived from `slug` or path alone.
6. `parseThemeDocument(body.theme_document)` throws `ValidationError` on invalid V2 structure.
7. If `body.bundle` present: `parseLiquidThemePackageBundle(body.bundle)` enforces G4 gate.
8. Returns `{ valid: true, schema_version, issues: [] }`.

**No DB writes. Audit event:** best-effort non-blocking `emitAuditEvent('theme.document.validate')` (fire-and-forget, `.catch(() => {})`).

**Placement:** MUST be placed BEFORE the GET `/:slug` catch-all route at `themes.ts:988` to prevent route shadowing.

---

### 2.2 POST /themes/:slug/publish (EXISTING — adapter additions only)

Existing auth steps unchanged (authMiddleware + resolveCustomUser + verifyStoreOwner inside adapter).

**Addition 1 — Idempotency pre-check:**
If `input.idempotency_key` is set, query `theme_releases WHERE store_id=input.store_id AND idempotency_key=input.idempotency_key AND deleted_at IS NULL`. If row found, return early with existing release data — no DB mutation, skip audit event.

**Addition 2 — Idempotency post-enrich:**
After `publishReleaseSnapshot` succeeds, if `input.idempotency_key` is set:
```typescript
const { error: keyError } = await this.db
  .from('theme_releases')
  .update({ idempotency_key: input.idempotency_key })
  .eq('id', release.release_id)
  .eq('store_id', input.store_id);
// unique-constraint violations tolerated; all other errors logged with forensic repair SQL
if (keyError && !keyError.message?.includes('duplicate key')) {
  // log forensic repair SQL; do not throw (release already committed)
}
```
Both `release_id` AND `store_id` required in WHERE clause — prevents cross-tenant update.

**Addition 3 — Audit event:**
After `deleteDraft`: `emitAuditEvent` with `action='theme.publish'`, `resourceType='theme_release'`, `resourceId=release.release_id`, `afterState={ theme_id, release_version, make_store_live }`.

**Schema change:** `PublishThemeSchema` gains `idempotency_key?: z.string().min(8).max(200)`.

**TOCTOU residual (documented, ARB-gated):** Two truly concurrent publishes within the ~1-5ms window can both pass the TS pre-check before either write lands. The unique index on `(store_id, idempotency_key)` prevents a second keyed release but the RPC runs twice and may create one keyless ghost release. Full closure requires `p_idempotency_key` in the SECURITY DEFINER RPC with `ON CONFLICT` — ARB-gated follow-up.

---

### 2.3 POST /themes/:slug/releases/:releaseId/rollback (EXISTING — adapter additions only)

Existing auth steps unchanged (authMiddleware + resolveCustomUser + verifyStoreOwner inside adapter).

**Addition 1 — CAS guard:**
After `verifyStoreOwner` and BEFORE fetching the target release, if `input.expected_current_release_id` is set:
```typescript
const { data: currentRelease } = await db
  .from('theme_releases')
  .select('id')
  .eq('store_id', input.store_id)          // store_id scoped FIRST
  .eq('is_current', true)
  .is('deleted_at', null)
  .single();
if (currentRelease?.id !== input.expected_current_release_id) {
  throw new ConflictError('Current release has changed since listing');
}
```
`site_id` is ALWAYS the first `.eq()` argument in this query.

**Addition 2 — Audit event:**
After `finalizeInstanceRelease`: `emitAuditEvent` with `action='theme.rollback'`, `resourceType='theme_release'`, `resourceId=rollback.release_id`, `beforeState={ rollback_of_release_id, rollback_of_version }`, `afterState={ new_release_id, new_release_version }`.

**Schema change:** `RollbackThemeReleaseSchema` gains `expected_current_release_id?: z.string().uuid()`.

**TOCTOU residual (documented, ARB-gated):** TS-level CAS check — two concurrent rollbacks both passing the same TS window can both reach `publishReleaseSnapshot`; second write wins `is_current`. Full closure requires `p_expected_current_release_version` in the SECURITY DEFINER RPC — ARB-gated follow-up.

---

## 3. Migration

### 3.1 Migration 189 — `189_theme_persistence_idempotency.sql`

**File:** `database/supabase/migrations/189_theme_persistence_idempotency.sql`

```sql
ALTER TABLE public.theme_releases
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_releases_idempotency
  ON public.theme_releases (store_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.theme_releases.idempotency_key IS
  'Client-supplied dedup key for publish operations. Nullable; set post-publish by TS layer. '
  'Partial unique index (store_id, idempotency_key) WHERE NOT NULL prevents cross-tenant collision and sequential retry duplication.';
```

**Idempotency:** `ADD COLUMN IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS` — passes `migration-safety-validator` (no DROP / RENAME / TRUNCATE).

**Additive:** Column is nullable. Existing rows, the `publish_theme_release` RPC, and all existing TS code are unaffected at apply time.

**No new RLS policy needed:** `theme_releases_service_all` (ALL for `auth.role()='service_role'`) covers writes; `theme_releases_owner_read` covers SELECT of the new column.

**No tenant registry change:** `theme_releases` entry already registered at `tenant-tables.registry.ts:2819`. No new table, no new scope column.

**Production apply:** PRODUCTION APPLY IS ARB / HUMAN-GATED — NOT done by Phase P. Rollback of the migration requires `DROP COLUMN` (forbidden by `migration-safety-validator`) — must go through an ARB repair runbook.

---

## 4. RLS Assessment

| Table | New policy needed | Rationale |
|---|---|---|
| `theme_releases` | None | `theme_releases_service_all` covers gateway writes; `theme_releases_owner_read` covers owner SELECT; no unconditional `USING(true)` on tenant data |
| `theme_editor_drafts` | None | Existing 4 policies cover all operations; pre-existing `user_id`-only debt noted but not introduced by Phase P |
| `theme_instance_drafts` | None | `theme_instance_drafts_owner_manage` already checks both `user_id` and `custom_user_id` |
| `themes` (global catalog) | None | Public read `USING(true)` is correct for a global non-tenant catalog |
| Validate route | None — no DB write | No table data written; zero new policies needed |
| Idempotency pre/post-enrich | None | Both run under service_role via `getSupabaseAdmin`; never under anon client |

---

## 5. Files Changed

| File | Type | Change |
|---|---|---|
| `packages/theme-engine/src/index.ts` | Modified | Export `parseThemeDocument`, `parseLiquidThemePackageBundle` if not already exported; required by validate route's service call |
| `services/api-gateway/src/schemas/theme.schema.ts` | Modified | Add `ValidateThemeDocumentSchema`; add `idempotency_key?: z.string().min(8).max(200)` to `PublishThemeSchema`; add `expected_current_release_id?: z.string().uuid()` to `RollbackThemeReleaseSchema` |
| `services/api-gateway/src/execution/theme-execution.adapter.ts` | Modified | `validateDocument()` new method; `publish()` gains idempotency pre-check + post-enrich + audit; `rollbackRelease()` gains CAS guard + audit; `saveInstanceDraftSnapshot` + `ensureThemeInstance` gain explicit `store_id` guards; `publishReleaseSnapshotFallback` supersede error captured |
| `services/api-gateway/src/routes/themes.ts` | Modified | Register `POST /:slug/validate` BEFORE the GET `/:slug` catch-all |
| `database/supabase/migrations/189_theme_persistence_idempotency.sql` | New | Adds `idempotency_key` column + partial unique index to `theme_releases` |
| `services/api-gateway/src/__tests__/theme-persistence-p.test.ts` | New | 23+ tests covering all Phase P paths, cross-tenant proof, concurrency patterns, audit events |

---

## 6. Concurrency Model

### 6.1 Draft Saves (existing `theme_editor_drafts` CAS)

- `base_version` optional in `SaveThemeDraftSchema`; if omitted, `isStaleThemeEditorBaseVersion(existingVersion, undefined)` returns `false` and no `ConflictError` is raised.
- Two concurrent saves both omitting `base_version` both pass the check and the DB-level upsert on `(store_id, theme_id, template_key)` means last writer silently wins.
- **ARB-gated follow-up:** Make `base_version` required for concurrent-save editors (`admin-web`, `flutter-builder`), or add a DB-level `WHERE version = existingVersion` predicate to the upsert. This is pre-existing; Phase P documents it but does not fix it in this pass.

### 6.2 Publish Idempotency

- Sequential retry: pre-check finds existing keyed release → early return; no second RPC call. Correctly handled.
- Truly concurrent (same ~1-5ms window): both requests pass the pre-check before either write lands → both call the RPC → RPC runs twice. Index prevents a second keyed release from persisting; one keyless ghost release may be created. ARB-gated for full closure.

### 6.3 Rollback CAS

- Sequential: second rollback sees changed `is_current` and throws `ConflictError`. Correctly handled.
- Truly concurrent: two rollbacks both pass the same TS CAS window → both call `publishReleaseSnapshot` → second write wins `is_current`. ARB-gated for full closure.

---

## 7. Dependencies and Ordering

Phase P depends on:
- Phase N: `ThemeDocumentSchema`, `parseThemeDocument` (validate route uses these)
- Phase O: `applyExperienceToDocument` (used in existing stores route, not Phase P's responsibility; validate route only validates structure)
- `parseLiquidThemePackageBundle` already exported from `packages/theme-engine/src/index.ts` (confirmed as Phase B/C artifact)

Phase P does not depend on:
- Phase R (Visual editor shell) — UI layer; Phase P ships the backend surface
- Phase Q (Merchant theme library) — peer phase; no shared new tables
