# Phase P Security Review — Tenancy, Auth, and Cross-Tenant Proof

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** P — Drafts, Revisions, Publish, and Rollback
**Date:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Scope

Phase P's security surface spans three routes and one migration:

- **POST /themes/:slug/validate** — new route; validates a `ThemeDocument` V2 + optional G4 bundle without DB writes.
- **POST /themes/:slug/publish** — existing route; gains idempotency pre-check, post-enrich, and audit event.
- **POST /themes/:slug/releases/:releaseId/rollback** — existing route; gains `expected_current_release_id` CAS guard and audit event.
- **Migration 189** — adds nullable `idempotency_key` column + partial unique index to `theme_releases`.

---

## 2. Authentication Layer

### 2.1 Primary Auth: ES256 Merchant Session

All three routes are protected by `authMiddleware` which calls `identity-session-verifier.ts:42` `validateIdentityIssuedMerchantSessionToken(env, token, userId)`.

Validation chain:
1. `jose jwtVerify` + `createLocalJWKSet(parseIdentityPublicJwks(env))` where `env.LETBUYY_IDENTITY_PUBLIC_JWKS` is the JWKS JSON string.
2. `alg` must be ES256 or EdDSA (header.alg check at line 57 + protectedHeader.alg check at line 95).
3. `iss = env.LETBUYY_IDENTITY_ISSUER || 'https://accounts.letbuyy.com'`
4. `aud = 'letbuyy:merchant-session'`
5. `payload.realm = 'merchant'`
6. `payload.token_use = 'merchant_session'`
7. `payload.sub = userId`
8. `exp > now`; `iat <= now+60s`; `jti >= 16 chars`

**Customer HS256 tokens** (issued by `issueCustomerSession` / `CUSTOMER_SESSION_SECRET`) are rejected at `authMiddleware` level — `supabase.auth.getUser()` does not accept custom HS256 tokens; the call returns an error producing 401 before reaching route handlers.

**Source confirmation:** `router.use('/:slug/validate', authMiddleware)`, `router.use('/:slug/publish', authMiddleware)`, `router.use('/:slug/releases/*', authMiddleware)` all present in `themes.ts`.

### 2.2 Secondary Defense: resolveCustomUser

After `authMiddleware`, `resolveCustomUser(db, auth.user)` is called. If the Supabase-authenticated user lacks a `users_custom` profile row, it returns `null` and the handler returns `403 FORBIDDEN`. This is the secondary defense; it does not replace the primary ES256 check.

---

## 3. Per-Route Tenancy Proof

### 3.1 POST /themes/:slug/validate

| Security property | Implementation | Verification |
|---|---|---|
| ES256 enforced | `authMiddleware` on route prefix | Source pattern test confirms `router.use('/:slug/validate', authMiddleware)` |
| site_id from merchant context, not slug | `verifyStoreOwner(body.store_id, userId)` — `store_id` from request body, `userId` from `auth.user` | Mock-db test: ForbiddenError when Site B merchant calls with Site A `store_id` |
| Cross-tenant forbidden | `verifyStoreOwner()` DB-checks `sites WHERE id=body.store_id AND (custom_user_id=userId OR user_id=userId) AND deleted_at IS NULL` — throws `ForbiddenError` if no row | Test: spy confirms 0 calls to `theme_releases` table when ForbiddenError fires |
| No DB write | No DB mutation anywhere in `validateDocument()` path | Unit test: 0 `.insert()` / `.update()` / `.upsert()` calls traced |
| No audit event blocking | `emitAuditEvent` called with `.catch(() => {})` — fire-and-forget | Test confirms non-blocking behaviour |

### 3.2 POST /themes/:slug/publish

| Security property | Implementation | Verification |
|---|---|---|
| ES256 enforced | `authMiddleware` on route prefix | Source pattern test |
| site_id from merchant context | `verifyStoreOwner(input.store_id, userId)` inside adapter, before any idempotency check | Execution order: verifyStoreOwner → pre-check → RPC |
| Idempotency pre-check scoped to site | Query: `store_id = input.store_id` as first `.eq()` before `idempotency_key` | Source pattern test: `storeIdIdx < idemKeyIdx` assertion |
| Post-enrich update scoped to both release id AND site | `.eq('id', release.release_id).eq('store_id', input.store_id)` | Source pattern test: both `release_id` and `store_id` present in WHERE |
| Post-enrich error handled | `const { error: keyError } = await ...` — unique-constraint violations tolerated; other errors logged | Unit test for error capture |
| Audit event after commit | `emitAuditEvent` called after `deleteDraft`, before return | Unit test confirms audit event fired on successful publish |
| Idempotency index cross-tenant safe | `(store_id, idempotency_key)` composite index — cross-site key collision structurally impossible | Migration 189 index definition; migration no-public-USING test |

### 3.3 POST /themes/:slug/releases/:releaseId/rollback

| Security property | Implementation | Verification |
|---|---|---|
| ES256 enforced | `authMiddleware` on route prefix | Source pattern test |
| site_id from merchant context | `verifyStoreOwner(input.store_id, userId)` inside adapter, before CAS check | Execution order: verifyStoreOwner → CAS → fetch target release |
| CAS query scoped to site | `store_id = input.store_id` as first `.eq()` before `is_current` | Source pattern test: `storeIdIdx < isCurrentIdx` assertion |
| CAS guard prevents stale-editor rollback | If `currentRelease.id !== input.expected_current_release_id` → `ConflictError('Current release has changed since listing')` | Unit test: stale expected id throws ConflictError |
| Audit event after commit | `emitAuditEvent` called after `finalizeInstanceRelease` | Unit test confirms audit event fired on successful rollback |

---

## 4. Cross-Tenant Proof

Two complementary proof layers were applied (logic-level; no real DB required):

### Layer 1 — Adapter-Level Mock-DB

Test `'validateDocument: ForbiddenError when Site B merchant calls with Site A store_id'` mocks the `sites` table query to return `{ data: null, error: { message: 'store not found' } }`. This causes `verifyStoreOwner()` to throw `ForbiddenError` BEFORE `parseThemeDocument` is called and BEFORE any `theme_releases` query runs. Spy confirms 0 calls to the `theme_releases` table.

The identical guard fires on `publish()` and `rollbackRelease()` because all three begin with `verifyStoreOwner(input.store_id, userId)`.

### Layer 2 — Source Pattern (Structural)

| Check | Assertion |
|---|---|
| Idempotency pre-check: `store_id` before `idempotency_key` | `storeIdIdx < idemKeyIdx` in adapter source |
| CAS guard: `store_id` before `is_current` | `storeIdIdx < isCurrentIdx` in adapter source |
| Post-enrich update: both release id AND `store_id` in WHERE | Both `release.release_id` and `store_id` present in the update chain |

---

## 5. Three New store_id Guards (Pre-Existing Code Hardened)

The following updates to pre-existing Phase G code were applied in Phase P hardening to eliminate authorization-by-derived-id patterns:

| Location | Guard added |
|---|---|
| `ensureThemeInstance` — `theme_instances` UPDATE | `.eq('store_id', storeId)` added alongside `.eq('id', existing.id)` |
| `saveInstanceDraftSnapshot` — `theme_instance_drafts` UPDATE | `.eq('store_id', input.storeId)` added alongside `.eq('id', existingRecord.id)` |
| `saveInstanceDraftSnapshot` — `theme_instances` current_draft_id pointer UPDATE | `.eq('store_id', input.storeId)` added alongside `.eq('id', themeInstanceId)` |

These updates prevent a scenario where a bug in id-derivation logic could allow a cross-tenant update. Even though normal-flow exploitation was impossible (ids were correctly derived from store-scoped queries), explicit tenant scope in every mutation is the program's invariant.

---

## 6. RLS Verification

### 6.1 `theme_releases`

No new RLS policy was added. Existing policies confirmed:
- `theme_releases_service_all` — ALL for `auth.role()='service_role'` — covers gateway writes.
- `theme_releases_owner_read` — SELECT for owner (sites JOIN with `user_id` OR `custom_user_id`) — covers SELECT of new `idempotency_key` column.
- `theme_releases_public_current_read` — SELECT WHERE `is_current=true AND release_status='published'` — scoped, not unconditional.

**No unconditional `USING(true)` on tenant data.** Test confirms: when migration 189 SQL is stripped of comments, no `USING (true)` string appears.

### 6.2 Migration 189 Safety

| Property | Value |
|---|---|
| `ADD COLUMN IF NOT EXISTS` | Yes — idempotent |
| `CREATE UNIQUE INDEX IF NOT EXISTS` | Yes — idempotent |
| No `DROP` / `RENAME` / `TRUNCATE` | Confirmed — passes `migration-safety-validator` |
| No new RLS policy | Confirmed — existing `service_all` policy covers the new column |
| Column nullable | Yes — existing rows and RPC unaffected at apply time |
| Cross-tenant collision prevention | `(store_id, idempotency_key)` composite index — a key from Site A cannot match Site B's record |

### 6.3 `theme_editor_drafts` RLS Debt (Pre-Existing)

The existing 4 RLS policies on `theme_editor_drafts` check `sites.user_id = auth.uid()` only — they do not check `sites.custom_user_id`. This is pre-existing debt not introduced by Phase P. The gateway bypasses via service_role for all operations, so there is no live route that relies on these policies for protection today. Registered as RISK-SEC-P01 and deferred to Phase R or a dedicated security migration.

---

## 7. Publish Fallback Path Safety

`publishReleaseSnapshotFallback` (triggered when the `publish_theme_release` RPC is absent from the DB) runs three sequential non-transactional DB writes. Phase P hardening:

1. **Supersede step error captured:** `const { error: supersededError } = await db...` — if it errors, execution throws before the INSERT proceeds. This prevents the split-brain scenario where the supersede succeeds but the subsequent INSERT fails, leaving all releases with `is_current=false` and no live theme.

**Residual risk:** The three writes are still non-transactional. Full safety requires wrapping in a Postgres transaction or advisory lock. This is an ARB-gated follow-up for any phase that targets the fallback path.

---

## 8. Summary of Security Properties

| Property | Status | Evidence |
|---|---|---|
| ES256 merchant token enforced on all three routes | ACHIEVED | `authMiddleware` on route prefixes; customer HS256 rejected at auth layer (401) |
| site_id never derived from slug or path alone | ACHIEVED | `verifyStoreOwner(input.store_id, userId)` is the tenant gate; store_id always comes from request body |
| Cross-tenant operations blocked | ACHIEVED | `verifyStoreOwner` throws ForbiddenError before any DB operation; mock-db test + 0 theme_releases calls proof |
| Idempotency index cross-tenant safe | ACHIEVED | `(store_id, idempotency_key)` composite; cross-site key collision structurally impossible |
| Post-enrich update tenant-scoped | ACHIEVED | Both `release_id` and `store_id` in WHERE clause; source pattern test |
| CAS guard tenant-scoped | ACHIEVED | `store_id` first `.eq()` in CAS query; source pattern test |
| No unconditional `USING(true)` on tenant data | CONFIRMED | Migration 189 SQL checked; existing `theme_releases` policies confirmed |
| Explicit store_id in all mutations (hardening) | ACHIEVED | 3 new `.eq('store_id', ...)` guards added to pre-existing code |
| Fallback publish supersede error handled | ACHIEVED | `const { error: supersededError }` captured and thrown |
| TOCTOU residuals documented and ARB-gated | DOCUMENTED | Publish TOCTOU; rollback CAS; draft CAS bypass — all noted with ARB tickets |
