# Phase Q Security Review — Tenancy, Auth, and Cross-Tenant Proof

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Q — Merchant Theme Library
**Date:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Scope

Phase Q's new security surface:

- **GET /themes/library** — list themes installed on a store
- **POST /themes/library/create** — create a blank site-private theme
- **POST /themes/:slug/duplicate** — duplicate an installed theme
- **PATCH /themes/:slug/rename** — rename a site-private theme
- **POST /themes/:slug/archive** — archive an unpublished theme
- **DELETE /themes/:slug/unpublished** — soft-delete an unpublished theme
- **6 merchant proxy routes** — thin proxies in `apps/merchant-control-plane/src/app/api/themes/`
- **Migration 190** — additive columns on `themes`; no new RLS policies

---

## 2. Authentication Layer

### 2.1 Primary Auth: ES256 Merchant Session

All six gateway routes are protected by `authMiddleware` registered at the top of `themes.ts` before any existing registrations. Source:

```
router.use('/library', authMiddleware)        // line 64
router.use('/library/*', authMiddleware)      // line 65
router.use('/:slug/duplicate', authMiddleware) // line 66
router.use('/:slug/rename', authMiddleware)   // line 67
router.use('/:slug/archive', authMiddleware)  // line 68
router.use('/:slug/unpublished', authMiddleware) // line 69
```

`authMiddleware` calls `identity-session-verifier.ts` `validateIdentityIssuedMerchantSessionToken`:

| Property | Required value |
|---|---|
| JWT algorithm | ES256 or EdDSA (header.alg + protectedHeader.alg both checked) |
| `iss` | `env.LETBUYY_IDENTITY_ISSUER` (default `'https://accounts.letbuyy.com'`) |
| `aud` | `'letbuyy:merchant-session'` |
| `payload.realm` | `'merchant'` |
| `payload.token_use` | `'merchant_session'` |
| `payload.sub` | must match `userId` |
| `exp` | must be in the future |
| `jti` | must be ≥ 16 characters |

**Customer HS256 tokens** (issued by `issueCustomerSession` / `CUSTOMER_SESSION_SECRET`) are rejected at `authMiddleware` — `supabase.auth.getUser()` does not accept them; the call errors and the middleware returns 401 before reaching route handlers.

### 2.2 Secondary Defense: resolveCustomUser

Every route handler calls `resolveCustomUser(db, auth.user)` and returns 403 if the result is null. This ensures a valid Supabase token with no corresponding `users_custom` profile (e.g. a service account that has bypassed the identity platform) cannot reach any theme library handler.

### 2.3 Merchant Proxy Auth

All six merchant proxy routes call `merchantApiFetch(path, { requireSession: true })`. This attaches the authenticated session token to the forwarded request, so the gateway's `authMiddleware` validates the same ES256 token for every proxied call. No route accepts unauthenticated requests.

---

## 3. Per-Route Tenancy Analysis

For each route the tenancy chain is: `authMiddleware` → `resolveCustomUser` → `verifyStoreOwner` → all subsequent queries scoped by `store_id`. The `verifyStoreOwner` method queries `sites WHERE id=storeId AND (custom_user_id=userId OR user_id=userId)` and throws `ForbiddenError` if no row is returned.

### 3.1 GET /themes/library

- `store_id` comes from the query string, validated by `ListSiteThemesQuerySchema` (UUID required).
- `verifyStoreOwner` is the first adapter call — a cross-tenant `store_id` never reaches `theme_instances`.
- All three sub-queries (theme_instances, theme_releases, theme_editor_drafts) carry `.eq('store_id', storeId)` as the first filter before any other predicate.
- `isCurrentlyPublished` is derived from `sites.theme_id` where `sites` is already scoped to `storeId` by the ownership check.

**Cross-tenant proof:** A Site B merchant supplying Site A's `store_id` hits `verifyStoreOwner` → `ForbiddenError` → 403. No `theme_instances` query runs. Confirmed by test 1 in `theme-library-q.test.ts`.

### 3.2 POST /themes/library/create

- `store_id` comes from the JSON body, validated by `CreateSiteThemeSchema` (UUID required).
- Route handler calls `adapter.verifyStoreOwner(body.store_id, customUser.id)` explicitly before `resolveStoreThemeLimit` — this ordering prevents leaking another store's billing tier and plan name on a cross-tenant `store_id`.
- Both the inserted `themes` row and `theme_instances` row carry `store_id = storeId` / `owned_by_site_id = storeId`.
- The adapter's internal `verifyStoreOwner` call in `createSiteTheme` provides a redundant check.

**Cross-tenant proof:** Confirmed by test 2 in `theme-library-q.test.ts`. Source-pattern test 20 (`POST /library/create: verifyStoreOwner called before resolveStoreThemeLimit`) asserts the call order in `routes/themes.ts` source text.

### 3.3 POST /themes/:slug/duplicate

- Same ownership-before-limit ordering as create (test 21 asserts it).
- Source `theme_instances` lookup uses `.eq('store_id', storeId)` first; if no row → NotFoundError (not 403, preventing slug enumeration of cross-tenant themes).
- `theme_releases` clone query carries `.eq('store_id', storeId)`.
- New `themes` row and `theme_instances` row both carry `owned_by_site_id=storeId` and `store_id=storeId`.

**Cross-tenant proof:** Confirmed by test 3. Enumeration-prevention (NotFoundError for cross-site instance, not ForbiddenError) confirmed by test 10.

### 3.4 PATCH /themes/:slug/rename

This route has additional catalog-integrity protection beyond the standard tenancy chain.

- `verifyStoreOwner` confirms the caller owns the store (cross-tenant blocked at step 1).
- `theme_instances WHERE store_id=storeId` confirms the theme is installed in this store.
- `themes.owned_by_site_id` is read and checked:
  - If `null` (marketplace theme): `ForbiddenError("Marketplace themes cannot be renamed. Duplicate the theme first...")`.
  - If not equal to `storeId` (theme owned by a different site): same `ForbiddenError`.
- The UPDATE query carries `.eq('owned_by_site_id', storeId)` as a belt-and-suspenders DB-level guard — even if the application check were somehow bypassed, the UPDATE would affect zero rows.

**Why this matters:** Without this guard, any authenticated merchant who has a marketplace theme installed (e.g. `urban-kicks`) could rename the shared `themes` catalog row, corrupting the display name for every tenant that has the same theme installed. The TS-layer `owned_by_site_id` check and the DB-level `eq('owned_by_site_id', storeId)` on the UPDATE together prevent this.

**Cross-tenant proof:** Test 4 (ForbiddenError for cross-tenant `store_id`). Tests 28–30 (ForbiddenError for marketplace theme with `owned_by_site_id IS NULL`, ForbiddenError for mismatched `owned_by_site_id`, source-pattern assertion that UPDATE carries `.eq('owned_by_site_id', storeId)`).

### 3.5 POST /themes/:slug/archive

- `verifyStoreOwner` blocks cross-tenant calls.
- Published-theme block: `sites WHERE id=storeId` read (scoped) → if `theme_id === slug` → ConflictError `THEME_CURRENTLY_PUBLISHED` → 409. This prevents merchants from accidentally archiving their live theme.
- `theme_instances` UPDATE scoped by `store_id AND id` (instance id derived from the store-scoped SELECT).

**Cross-tenant proof:** Test 5 (ForbiddenError for cross-tenant). Test 7 (ConflictError when `sites.theme_id === slug`). The 409 passes through `merchantApiErrorResponse` to the UI's `friendlyGatewayError` handler.

### 3.6 DELETE /themes/:slug/unpublished

- `store_id` from query string, validated by `DeleteUnpublishedThemeQuerySchema`.
- `verifyStoreOwner` blocks cross-tenant calls.
- Two-layer published-theme block:
  1. `sites WHERE id=storeId` → if `theme_id === slug` → ConflictError `CANNOT_DELETE_PUBLISHED_THEME`.
  2. `theme_releases WHERE store_id=storeId AND theme_id=slug AND is_current=true` → if found → same ConflictError. This catches edge cases where `sites.theme_id` may not be updated yet but a current release exists.
- Soft-delete UPDATE scoped by `store_id AND id`.

**Cross-tenant proof:** Test 6 (ForbiddenError for cross-tenant). Test 8 (`sites.theme_id` guard). Test 9 (`theme_releases.is_current` guard).

---

## 4. No Direct DB Writes from Browser

All six merchant proxy routes are thin proxies only:

- They call `resolveOwnedStoreId(storeName)` to resolve the `storeId` server-side from the authenticated session.
- They forward the resolved `storeId` to the gateway in the request body or query string.
- No proxy route imports `@supabase/supabase-js`, `getSupabaseAdmin`, or any DB client.
- No proxy route performs any Supabase query.

**Source assertion:** Test 9 in `theme-library-q.test.mjs` (`no proxy route imports Supabase or writes to DB directly`) asserts this at the source level for all six proxy files.

The browser never supplies a `storeId` UUID that the proxy trusts. Even if the merchant's browser supplies a forged store handle or store name, `resolveOwnedStoreId` resolves it via the server-side authenticated session against the merchant's own store record.

---

## 5. Catalog Integrity (Marketplace Theme Protection)

**Threat:** Authenticated merchant with marketplace theme `X` installed calls `PATCH /:slug/rename` to mutate the shared `themes` row, changing the name displayed to all other tenants.

**Mitigations (three layers):**

1. `verifyStoreOwner` blocks the cross-tenant case (wrong `store_id`).
2. `renameSiteTheme` reads `themes.owned_by_site_id`; if null or not equal to `storeId`, throws `ForbiddenError` before the UPDATE.
3. The UPDATE carries `.eq('owned_by_site_id', storeId)` — if somehow the check were bypassed, the UPDATE matches zero rows (marketplace rows have `owned_by_site_id IS NULL`).

This was a HIGH severity finding identified in code review and hardened before completion. Tests 28–30 confirm all three layers.

---

## 6. Published-Theme Delete/Archive Block

Both `archiveSiteTheme` and `deleteUnpublishedSiteTheme` contain a guard that prevents operations on the currently published theme. This is a safety invariant — a merchant must always have a live theme; removing the live one would break the storefront.

**Mechanism:**
- `archiveSiteTheme`: reads `sites.theme_id` (scoped by `store_id`); if `=== slug`, throws `ConflictError`. Maps to HTTP 409 with code `THEME_CURRENTLY_PUBLISHED`.
- `deleteUnpublishedSiteTheme`: same `sites.theme_id` check, plus a second check against `theme_releases.is_current=true` (scoped by `store_id AND theme_id`). Both paths map to HTTP 409 with code `CANNOT_DELETE_PUBLISHED_THEME`.

**Tests:** Tests 7 (archive), 8 and 9 (delete via both guards).

---

## 7. Migration 190 Safety

| Check | Status |
|---|---|
| No `DROP TABLE` | PASS |
| No `DROP COLUMN` | PASS |
| No `RENAME COLUMN` | PASS |
| No `TRUNCATE` | PASS |
| `ADD COLUMN IF NOT EXISTS` (idempotent) | CONFIRMED |
| `CREATE INDEX IF NOT EXISTS` (idempotent) | CONFIRMED |
| No `USING (true)` RLS policy | CONFIRMED — no new RLS policies added |
| `migration-safety-validator` | Must exit 0 before merge |

New columns (`owned_by_site_id`, `is_site_private`) are covered by the existing `themes_service_all` policy (`ALL WHERE auth.role()='service_role'`), which allows gateway writes via `getSupabaseAdmin`. The existing `themes_public_active_read` policy (`SELECT WHERE is_active=true`) already excludes site-private themes (`is_active=false`) from public reads — no new RLS policy is needed.

**Apply status:** Migration 190 has NOT been applied to any database. MUST NOT be applied to production without ARB sign-off.

---

## 8. Plan Limit — IDOR Prevention

A MEDIUM severity finding was identified and fixed before completion: the original implementation called `resolveStoreThemeLimit` (which reads `subscriptions` and `plans`) before `verifyStoreOwner`. A merchant submitting a cross-tenant `store_id` would receive billing details about that store (tier name and theme count) in the 409 THEME_LIMIT_REACHED error body.

**Fix:** Both `POST /library/create` and `POST /:slug/duplicate` now call `adapter.verifyStoreOwner` immediately after `resolveCustomUser`, before any call to `resolveStoreThemeLimit`. A cross-tenant `store_id` returns 403 without ever reading subscriptions or plans.

**Tests:** Tests 31 and 32 (`verifyStoreOwner called before resolveStoreThemeLimit`) assert this call order in the source text of `routes/themes.ts`.

---

## 9. Known Open Residual

### RISK-TOCTOU-Q01 — Plan limit enforcement is non-atomic

**Severity:** MEDIUM  
**Status:** OPEN · documented; ARB-gated for full closure.

For both `POST /library/create` and `POST /:slug/duplicate`, `countInstalledSiteThemes` and the subsequent insert run as two separate DB round-trips with no advisory lock or DB-level CHECK. Two concurrent requests for the same store that both read `count < limit` before either write completes will both succeed, exceeding the billing cap.

**Why it remains open:** Full closure requires either a `SECURITY DEFINER` RPC holding a per-store advisory lock, or a DB-level trigger/CHECK on `theme_instances`. Both require ARB sign-off (SECURITY DEFINER touch or schema constraint addition). Sequential requests (the dominant real-world pattern) are correctly gated by Phase Q's server-authoritative count.

**Target:** ARB follow-up or Phase AB (theme versioning), whichever first touches `theme_instances` schema.

---

## 10. Architectural Invariants Maintained

| Constraint | Status |
|---|---|
| `theme-registry.ts` frozen (ART-17) | MAINTAINED |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` | MAINTAINED |
| `publish_theme_release` SECURITY DEFINER RPC unchanged | MAINTAINED |
| DOMPurify sanitizer unchanged | MAINTAINED |
| Frozen apps unchanged | MAINTAINED |
| No unconditional `USING(true)` on tenant data | CONFIRMED |
| Canonical ledger (`canonical-ledger-only-validator`) | MAINTAINED (no money table mutations) |
| No proxy route performs direct DB writes | CONFIRMED |
| `verifyStoreOwner` called before every theme_instances query | CONFIRMED (all 6 adapter methods) |
| Marketplace theme catalog rows immutable via rename | CONFIRMED (owned_by_site_id guard + UPDATE scope) |
