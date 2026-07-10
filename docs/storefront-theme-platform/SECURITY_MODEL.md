# Theme Platform Security Model

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Last updated:** 2026-07-10 (post Phase P)
**Branch:** `stepup/main`

This document is a living security contract for the theme persistence surface. It covers authentication, tenant isolation, RLS, audit trail, and known residuals. Update it when a new phase changes the security surface.

---

## 1. Authentication

### 1.1 Merchant Routes

All theme persistence routes (`/themes/:slug/validate`, `/themes/:slug/publish`, `/themes/:slug/releases/:releaseId/rollback`, and all existing theme routes) are protected by `authMiddleware` at `services/api-gateway/src/routes/themes.ts`.

`authMiddleware` calls `identity-session-verifier.ts:42` `validateIdentityIssuedMerchantSessionToken`:

| Property | Required value |
|---|---|
| JWT algorithm | ES256 or EdDSA (header.alg + protectedHeader.alg both checked) |
| `iss` | `env.LETBUYY_IDENTITY_ISSUER` or `'https://accounts.letbuyy.com'` |
| `aud` | `'letbuyy:merchant-session'` |
| `payload.realm` | `'merchant'` |
| `payload.token_use` | `'merchant_session'` |
| `payload.sub` | must match `userId` |
| `exp` | must be in the future |
| `iat` | must be ≤ now + 60s |
| `jti` | must be ≥ 16 characters |

**Customer HS256 tokens** (issued by `issueCustomerSession` / `CUSTOMER_SESSION_SECRET`) are rejected at `authMiddleware` level — the Supabase `auth.getUser()` call does not accept custom HS256 tokens; they return an error producing **401 UNAUTHORIZED** before reaching any route handler.

### 1.2 Secondary Defense

After `authMiddleware`, `resolveCustomUser(db, auth.user)` checks that the Supabase-authenticated user has a `users_custom` profile row. If null → **403 FORBIDDEN**. This is a secondary check; it does not replace the primary ES256 validation.

### 1.3 Gateway DB Access

All DB mutations in the theme execution adapter use `getSupabaseAdmin()` (service_role client). This bypasses row-level security at the DB layer. The tenant isolation guarantee is therefore provided by the TS-layer `verifySiteOwnership` / `verifyStoreOwner` checks, not by RLS for writes.

---

## 2. Tenant Isolation

### 2.1 Invariant

**The `site_id` / `store_id` used for every DB operation MUST come from the authenticated merchant context — never from the URL slug, path parameters, or request body alone.**

Implementation: `ThemeExecutionAdapter.verifyStoreOwner(storeId, userId)` queries `sites WHERE id=storeId AND (custom_user_id=userId OR user_id=userId) AND deleted_at IS NULL`. If no row returns, `ForbiddenError` is thrown before any theme table is touched.

This check fires at the beginning of every adapter method that operates on tenant data: `validateDocument`, `publish`, `rollbackRelease`, `saveDraft`, `saveInstanceDraftSnapshot`, `listReleases`, etc.

### 2.2 Explicit store_id in Every Mutation

Every `UPDATE` / `INSERT` / `UPSERT` on a tenant table carries an explicit `.eq('store_id', storeId)` (or equivalent) in the WHERE clause, regardless of whether the row's `id` was already derived from a store-scoped query. This prevents any future id-derivation bug from becoming cross-tenant exploitable.

Confirmed for (as of Phase P):
- `theme_editor_drafts` — UPSERT conflict target includes `store_id`
- `theme_releases` — `publish_theme_release` RPC takes `p_store_id`; post-enrich UPDATE uses both `id` AND `store_id`
- `theme_instance_drafts` — UPDATE uses both `id` AND `store_id` (hardened in Phase P)
- `theme_instances` — all UPDATEs use both `id` AND `store_id` (hardened in Phase P)

### 2.3 Idempotency Cross-Tenant Safety

The partial unique index on `theme_releases (store_id, idempotency_key) WHERE NOT NULL AND deleted_at IS NULL` is composite — a client on Site A and a client on Site B can use the same `idempotency_key` string without collision.

---

## 3. Row-Level Security

### 3.1 `theme_releases`

| Policy | Type | Scope |
|---|---|---|
| `theme_releases_owner_read` | SELECT | `EXISTS(sites WHERE id=store_id AND (user_id=uid OR custom_user_id=uid))` |
| `theme_releases_public_current_read` | SELECT | `is_current=true AND release_status='published'` — public storefronts can read the live release |
| `theme_releases_service_all` | ALL | `auth.role()='service_role'` — gateway writes via service_role |

No unconditional `USING(true)` on tenant data.

### 3.2 `theme_editor_drafts`

| Policy | Type | Scope |
|---|---|---|
| SELECT policy | SELECT | `EXISTS(sites WHERE id=store_id AND user_id=auth.uid())` |
| INSERT policy | INSERT | Same |
| UPDATE policy | UPDATE | Same |
| DELETE policy | DELETE | Same |

**Known debt (RISK-SEC-P01):** Policies check `user_id` only — not `custom_user_id`. Gateway bypasses via service_role; no live route relies on these policies. Target: security migration before Phase R realtime subscriptions.

### 3.3 `theme_instance_drafts`

| Policy | Type | Scope |
|---|---|---|
| `theme_instance_drafts_owner_manage` | ALL | `EXISTS(sites WHERE id=store_id AND (user_id=uid OR custom_user_id=uid) AND deleted_at IS NULL)` |

Correctly checks both `user_id` and `custom_user_id`.

### 3.4 `themes` (global catalog)

| Policy | Scope |
|---|---|
| `Themes are viewable by everyone` | `USING(true)` — intentional; global non-tenant catalog |

Write access requires service_role. The `USING(true)` is correct for a public catalog.

---

## 4. Audit Trail

| Event | Action name | Triggered by |
|---|---|---|
| Draft saved | `theme.draft.save` | `emitAuditEvent` in `saveDraft()` (pre-existing) |
| Theme published | `theme.publish` | `emitAuditEvent` in `publish()` (added Phase P) |
| Theme rolled back | `theme.rollback` | `emitAuditEvent` in `rollbackRelease()` (added Phase P) |
| Document validated | `theme.document.validate` | Best-effort non-blocking `emitAuditEvent` in `validateDocument()` (added Phase P) |

All audit events are emitted after the primary DB operation succeeds. A transient audit failure leaves the release committed but without an audit record (eventual consistency — matches the existing pattern for all audit events in the system).

The `theme.document.validate` event is fire-and-forget (`.catch(() => {})`). The validate route is read-only; the event exists solely for forensic/abuse-detection purposes.

---

## 5. SECURITY DEFINER RPC Surface

### 5.1 `publish_theme_release` (existing, ARB-gated)

- Called by `ThemeExecutionAdapter.publishReleaseSnapshot()`.
- Atomically supersedes the old `is_current` release, inserts the new one, and updates `sites.current_theme_release_id`.
- Takes `p_store_id` — tenant-scoped at the Postgres level.
- Does NOT accept `p_idempotency_key` today (ARB-gated follow-up).

### 5.2 Fallback Path

`publishReleaseSnapshotFallback` runs when the RPC is absent from the DB (migration 188 unapplied). It executes three sequential non-transactional writes. Phase P hardens step 1 (supersede) to capture and throw on error, preventing split-brain. Full atomic-transaction hardening is ARB-gated.

---

## 6. Known Residuals (ARB-Gated)

| Residual | Risk ID | Closure |
|---|---|---|
| Publish idempotency TOCTOU (~1-5ms concurrent window) | RISK-TOCTOU-P01 | Add `p_idempotency_key` to `publish_theme_release` RPC with `ON CONFLICT` |
| Rollback CAS is TS-level only | RISK-TOCTOU-P02 | Add `p_expected_current_release_version` to SECURITY DEFINER RPC |
| Draft CAS bypass when `base_version` omitted | (no RISK-ID yet) | Make `base_version` required for concurrent-save editors |
| Fallback publish non-transactional 3-step writes | (no RISK-ID yet) | Wrap in Postgres transaction or advisory lock |
| `theme_editor_drafts` RLS `user_id`-only policies | RISK-SEC-P01 | Add `custom_user_id` check to all 4 policies in a security migration |

---

## 7. What the Theme Platform NEVER Does

- Never accesses money tables (`orders`, `payment_transactions`, `checkouts`, `refunds`, `payouts`, `gift_card_*`).
- Never modifies customer sessions or customer credentials.
- Never bypasses `verifySiteOwnership` / `verifyStoreOwner` for tenant operations.
- Never derives `site_id` from the URL slug or path alone.
- Never sends theme document content to an external service (AI or otherwise) without merchant consent (Phase AC gate).
- Never publishes to production without the `publish_theme_release` SECURITY DEFINER RPC (or the fallback equivalent) as the last step.
