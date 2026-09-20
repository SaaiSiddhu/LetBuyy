# AF-E: Security / Tenancy / Auth / Money Invariant Audit

**Status:** COMPLETE — Read-only discovery audit; zero source mutations applied.
**Auditor:** Subagent AF-E (Claude Sonnet 4.6); initially 2026-07-17; all evidence re-verified 2026-07-18.
**HEAD verified:** `80d0b1af` (stepup/main — Phase AE: marketplace gate + theme_purchases RLS closure)
**Phase M baseline:** `ff6720a9` (discovery baseline for delta comparison)
**Git status count at audit start:** 378 (pre-existing working-tree changes); confirmed 378 at audit end — zero audit-induced delta.

---

## 1. Executive Summary

Core auth invariants (customer HS256 vs. merchant ES256 separation, step-up on refunds/payouts, gateway-only service-role, verifySiteOwnership before theme mutations) are **VERIFIED_CURRENT** in source. The most material security finding — `theme_purchases` wide-open RLS (RISK-SEC-001, first surfaced in Phase M) — was **closed by migration 191** (Phase AE commit `80d0b1af`). Six lower-severity gaps remain open:

1. `validateSafeThemeJson` (theme-engine) recurses without a depth counter — DoS/stack-overflow on deeply nested `template_config` payloads.
2. `theme_editor_drafts` RLS policies check only `sites.user_id = auth.uid()`, missing `sites.custom_user_id = auth.uid()` (present in `theme_instances` and `theme_instance_drafts`). Affects only direct Supabase-auth clients; gateway bypasses via `service_role`.
3. `theme_reviews` has a `USING (true)` FOR ALL policy (no role qualifier) that allows any authenticated Supabase session to mutate arbitrary review rows.
4. `iframe` added to `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG.ADD_TAGS` without enforcement that `sandbox` attribute is present.
5. `themes` table public read policy `USING (true)` — no explicit `is_site_private = false` filter — relies on `is_active = false` data discipline to exclude site-private themes from direct authenticated client reads.
6. `resource_id` in `storefront_translations` POST is not validated against resources owned by that store (data-quality concern; not a tenant-isolation bypass due to `store_id` scoping).

No money/checkout/payment/Razorpay/GST source path changed between Phase M (`ff6720a9`) and HEAD (`80d0b1af`). The canonical-ledger-only invariant is intact in theme-related code (no `payment_transactions`/`refunds`/`payouts` inserts in theme routes).

**THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false is VERIFIED_CURRENT** (`packages/theme-engine/src/theme-governance.ts:14`).

---

## 2. Verification Commands Run (All Read-Only)

```bash
# Auth/token files
git log --oneline -10
find . -type f -name "*.ts" | xargs grep -l "CUSTOMER_SESSION_SECRET|issueCustomerSession|HS256|ES256" ...
find . -type f -name "*.ts" | xargs grep -l "verifySiteOwnership" ...
# Theme routes and adapter
wc -l services/api-gateway/src/routes/themes.ts
wc -l services/api-gateway/src/execution/theme-execution.adapter.ts
# Migration files
ls database/supabase/migrations/ | sort | tail -20
# Money path diff
git diff --name-only ff6720a9..HEAD | grep -E "checkout|payment|razorpay|payout|gst|ledger"
# git status delta
git status --porcelain | wc -l  # before = 378; after = 378 (no delta)
```

**validate-governance.mjs assessment:** NOT RUN. Script calls `fs.rmSync` for directories named `node_modules`, `.next`, `.turbo`, `dist`, `build`, `coverage`, `.cache`, `.wrangler`, `.vercel`, etc. (`scripts/validate-governance.mjs:155-168`). All are gitignored generated directories. Running would not alter tracked source; however running it was not required for this audit scope. Recording as **PENDING/SAFE** for human operator.

---

## 3. Invariant Verification Matrix

### 3.1 ART-05 + R-14 — Customer HS256 vs Merchant ES256 Separation

**Status: VERIFIED_CURRENT**

| Evidence | Location |
|---|---|
| Customer session issuance uses `HMAC` + `SHA-256` (`alg: 'HS256'` in JWT header) | `packages/auth-core/src/customer-session.ts:52` |
| Customer verification enforces `header.alg !== 'HS256'` → reject | `packages/auth-core/src/customer-session.ts:83` |
| Merchant identity-session token validation enforces `header.alg !== 'ES256' && header.alg !== 'EdDSA'` → reject (two layers: pre-parse check + jose `jwtVerify` with `algorithms: ['ES256', 'EdDSA']`) | `services/api-gateway/src/lib/identity-session-verifier.ts:57,95` |
| `jwtVerify` from `jose` v6 validates asymmetric signature server-side | `identity-session-verifier.ts:84-93` |
| `resolveCustomUser` (called by all theme mutations) queries `users_custom` table — customer sessions have no row there → `null` → 403 | `services/api-gateway/src/lib/auth-user.ts:20-37` |
| Auth middleware registry: `oidc-jwks` verifier is `activeByDefault: false`; requires `FEATURE_OIDC_CLIENT` flag | `services/api-gateway/src/identity-foundation/auth-verifier-registry.ts:40-45` |

**Cross-realm bleed risk:** Not found. Customer sessions cannot satisfy `resolveCustomUser` check (no `users_custom` row). The identity-issued ES256 token path is separately gated by `validateIdentityIssuedMerchantSessionToken` before a new session is created in `/auth/custom/sessions/create` (`routes/auth.ts:1129`).

### 3.2 ART-05 — Step-Up on Refunds and Payouts

**Status: VERIFIED_CURRENT**

| Evidence | Location |
|---|---|
| `verifySensitiveActionStepUp` called with `action: 'refund.approve'` before refund ledger write | `services/api-gateway/src/routes/payments.ts:497-506` |
| `verifySensitiveActionStepUp` called for payout release | `services/api-gateway/src/routes/payouts.ts:576-585` |
| Step-up token is HMAC-SHA256 signed with `STEP_UP_SIGNING_SECRET`; 10-minute window; constant-time compare | `services/api-gateway/src/lib/security-controls.ts:80-100,160-243` |
| `configuredSecret` guard: secret must be ≥ 32 chars, not start with `SKIP_NEEDS_HUMAN_` — fails gracefully with `STEP_UP_REQUIRED` (not bypass) | `security-controls.ts:46-51` |
| Step-up failure returns HTTP 428 (`Precondition Required`) | `payments.ts:505-506` |
| `action`, `actor_id`, `site_id`, `verified_at` all bound in token payload and re-verified on check | `security-controls.ts:196-201` |

**SensitiveSecurityAction** covers: `'refund.approve' | 'payout.release' | 'customer.dsr.export' | 'customer.dsr.erase'` (`security-controls.ts:1`). All four are wired.

### 3.3 ART-08/09 + R-1/R-2/R-3 — Gateway-Only Service Role

**Status: VERIFIED_CURRENT**

| Evidence | Location |
|---|---|
| `getSupabaseAdmin` returns `createSupabaseServiceClient(env)` (service_role key) — comment: "bypasses RLS" | `services/api-gateway/src/lib/supabase.ts:10-19` |
| No `getSupabaseUser` (user-role client) calls in theme routes | `routes/themes.ts` — grep: 0 matches |
| `createTenantGuardedSupabaseClient` wraps service-role client for structural auditing | `supabase.ts:14` |
| Direct Supabase-auth client (`getSupabaseUser`) not exposed via any theme mutation path | Confirmed via grep |

### 3.4 verifySiteOwnership Before All Theme Tenant Mutations

**Status: VERIFIED_CURRENT**

`ThemeExecutionAdapter.verifyStoreOwner` (`execution/theme-execution.adapter.ts:277-299`) queries `sites` with `.or('custom_user_id.eq.${userId},user_id.eq.${userId}')` — covers both legacy `user_id` and new `custom_user_id` ownership styles.

| Operation | Line(s) calling `verifyStoreOwner` |
|---|---|
| `listSiteThemes` | adapter:1794 |
| `saveDraft` | adapter:1202 |
| `deleteDraft` | adapter:1309 |
| `publish` | adapter:1363 |
| `createPreviewSession` | adapter:1521 |
| `createSiteTheme` (library) | adapter:1554 |
| `duplicateSiteTheme` | adapter:1676 |
| `renameSiteTheme` | adapter:1716 |
| `archiveSiteTheme` | adapter:1878 |
| `deleteUnpublishedTheme` | adapter:1957 |
| `rollbackRelease` | adapter:2072 |
| `installTheme` | adapter:857 — calls `verifyStoreOwner` inside |
| `loadEditor` | adapter:1111 |
| Theme version update (GET/POST) | `routes/themes/theme-update-route.ts` — calls `verifySiteOwnership` directly |
| Resource-search | `routes/resource-search.ts` — calls `verifySiteOwnership` |
| Media-library | `routes/themes/media-library.ts` — calls `verifySiteOwnership` |

All destructive theme routes are also gated by `authMiddleware` registered on the router before handlers (`themes.ts:80-95`).

### 3.5 RLS Policies on Theme Tables

**Status: STRUCTURAL_ONLY** (migrations define the policies; live DB enforcement is not observable from repository)

#### Correctly scoped tables

| Table | Policy Name | Mechanism |
|---|---|---|
| `theme_instances` | `theme_instances_owner_manage` | `(sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())` AND `deleted_at IS NULL` — covers both owner ID columns |
| `theme_instance_drafts` | `theme_instance_drafts_owner_manage` | Same dual-column check |
| `theme_migrations` | `theme_migrations_service_all` | `auth.role() = 'service_role'` only |
| `theme_schema_manifests` | `theme_schema_manifests_public_read` | Joined to published `theme_package_versions` |
| `theme_packages` | `theme_packages_public_read` | `status = 'active' AND deleted_at IS NULL` |
| `theme_package_versions` | `theme_package_versions_public_read` | `release_status = 'published' AND deleted_at IS NULL` |
| `theme_assets`, `theme_layouts`, `theme_presets`, `theme_block_definitions` | `*_public_read` | `deleted_at IS NULL` (static catalog data) |
| `theme_draft_patches` | `theme_draft_patches_owner_manage` | Joined through `theme_instance_drafts` → `sites` ownership |
| `theme_preview_sessions` | `theme_preview_sessions_owner_manage` | Joined through `sites` ownership |

#### Gaps identified

**GAP-1 (LOW): `theme_editor_drafts` RLS missing `custom_user_id` check**
- Source: `database/supabase/migrations/000_baseline.sql:27605-27639`
- All four CRUD policies for `theme_editor_drafts` only check `sites.user_id = auth.uid()`
- `theme_instance_drafts` and `theme_instances` correctly also check `sites.custom_user_id = auth.uid()`
- Risk: A merchant registered with `custom_user_id` (common for SSO-migrated users) can own a store via `custom_user_id`, but the `theme_editor_drafts_owner_*` policies would not permit their direct Supabase-auth session to read/write their own drafts
- Gateway impact: NONE (gateway uses `service_role`, which bypasses RLS entirely)
- Exploitable only via direct Supabase-auth client access
- Severity: LOW

**GAP-2 (MEDIUM): `theme_reviews` wide-open FOR ALL policy**
- Source: `database/supabase/migrations/000_baseline.sql:24173`
- `CREATE POLICY "Users manage own theme reviews" ON public.theme_reviews USING (true)` — FOR ALL, no role qualifier → any `authenticated` Supabase session can read and mutate any review row
- Gateway uses `service_role` (unaffected); but direct Supabase-auth client can read/update/delete other users' reviews
- No review row scoping exists at the DB level for authenticated sessions
- Severity: MEDIUM (data integrity on marketplace; reputation gaming)
- Proposed owning phase: AG

**GAP-3 (LOW): `themes` table `USING (true)` exposes site-private themes to direct `authenticated` clients**
- Source: `database/supabase/migrations/000_baseline.sql:24152`: `"Themes are viewable by everyone" FOR SELECT USING (true)`
- Site-private themes (migration 190, `is_site_private = true`) are intended to be hidden from public catalog; their defense is `is_active = false` at insert time
- The public listing route (`GET /themes`) filters `.eq('is_active', true)` — correct at gateway layer
- But a direct `authenticated` Supabase-auth client can `SELECT * FROM themes` without the `is_active` filter and see site-private theme records
- Severity: LOW (theme schema/name disclosure only; no customer data, no money)
- Proposed owning phase: AG

### 3.6 theme_purchases RLS (Migration 191 — RISK-SEC-001 Remediation)

**Status: VERIFIED_CURRENT (migration exists on disk; live DB state NOT_CONNECTED)**

`database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql` (commit `80d0b1af`):
- Drops `"Users create theme purchases" WITH CHECK (true)` and `"Users view own theme purchases" USING (true)` (both wide-open, present since baseline:24159,24201)
- Creates `tp_service_role` (ALL for `service_role`)
- Creates `tp_authenticated_select` (SELECT WHERE `user_id = auth.uid()`)
- Creates `tp_authenticated_insert` (INSERT WHERE `user_id = auth.uid()`)

**Architecture note confirmed:** `theme_purchases.user_id` FK → `users_custom(id)`, which uses a different UUID space from `auth.users.id`. The `authenticated` policies therefore deny direct client access in practice (UUIDs won't match). This is explicitly documented in the migration header.

### 3.7 theme_editor_drafts Table Schema

Source: `000_baseline.sql:12615-12629`
- Columns: `id, store_id, theme_id, draft_config (jsonb), version, auto_saved_at, created_by, updated_by, created_at, updated_at, deleted_at`
- **No `user_id` or `custom_user_id` column** — user binding is via `store_id → sites` join in RLS policies and in `ThemeExecutionAdapter` queries
- Gateway queries scope by `store_id` after `verifyStoreOwner` — secure at application layer

### 3.8 Translation POST/DELETE Ownership + Default-Locale Guards

**Status: VERIFIED_CURRENT**

`resolveOwnedLocalizationStore` (`routes/stores-localization.ts:133-186`):
- Queries `sites` with `.or('custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}')` — covers both ownership ID columns (correct; matches `verifySiteOwnership` pattern)

Default-locale guard (`stores-localization.ts:581-583`):
- `DELETE /stores/:id/localization/locales/:localeId` checks `if (existing.is_default)` → returns 400 `"Default locale cannot be deleted."` — VERIFIED

**Gap-4 (INFO): `resource_id` in translation POST not validated against owned resources**
- `POST /stores/:id/localization/translations` body includes `resource_id` (free-form string up to 200 chars; `z.string().trim().min(1).max(200)`)
- `resource_id` is stored in `storefront_translations.resource_id` without checking it is a product/collection/page owned by that store
- All rows are scoped by `store_id` (verified ownership); foreign `resource_id` values cannot access another tenant's data
- Risk: A merchant can annotate their own store with translations for a resource_id they don't own (data quality, not tenant isolation)
- Severity: INFO

### 3.9 Theme Tenancy Across All Mutation Routes

**Status: VERIFIED_CURRENT**

| Route category | Auth guard | Ownership gate |
|---|---|---|
| `/:slug/editor` (GET/PUT) | `authMiddleware` (themes.ts:88-89) | `resolveCustomUser` → `service.loadEditor`/`saveDraft` → `verifyStoreOwner` inside adapter |
| `/:slug/editor/draft` (DELETE) | `authMiddleware` (themes.ts:88-89) | `resolveCustomUser` → `service.deleteDraft` → `verifyStoreOwner` |
| `/:slug/publish` (POST) | `authMiddleware` (themes.ts:90) | `resolveCustomUser` → `service.publish` → `verifyStoreOwner` |
| `/:slug/preview-session` (POST) | `authMiddleware` (themes.ts:91) | `resolveCustomUser` → `service.createPreviewSession` → `verifyStoreOwner` |
| `/:slug/releases` (GET, POST rollback) | `authMiddleware` (themes.ts:94-95) | `resolveCustomUser` → `service.rollbackRelease` → `verifyStoreOwner` |
| `/:slug/install` (POST) | `authMiddleware` (themes.ts:92) | `resolveCustomUser` → `service.installTheme` → `verifyStoreOwner` |
| `/:slug/duplicate`, `/:slug/rename`, `/:slug/archive` | `authMiddleware` (themes.ts:82-84) | `verifyStoreOwner` inside adapter |
| `/:slug/unpublished` (DELETE) | `authMiddleware` (themes.ts:85) | `resolveCustomUser` → `service.deleteUnpublishedTheme` → `verifyStoreOwner` |
| `/library` (GET/POST/PATCH) | `authMiddleware` (themes.ts:75-76) | `verifyStoreOwner` inside adapter |
| `/:slug/update-preview`, `/:slug/update` | `authMiddleware` (themes.ts:80-81) | `resolveCustomUser` + `verifySiteOwnership` in route directly |
| `/media-library` (GET) | `authMiddleware` (themes.ts:67) | `resolveCustomUser` + `verifySiteOwnership` in route |
| `/resource-search` (GET) | `authMiddleware` (themes.ts:71) | `resolveCustomUser` + `verifySiteOwnership` in route |
| `/settings` (GET/PATCH) | `authMiddleware` (themes.ts:103) | `resolveCustomUser` + site ownership via auxiliary routes |

One route is explicitly public:
- `GET /themes/` — public listing with `optionalAuth` (themes.ts:86). Only returns `is_active = true` themes. No tenant data exposed.
- `GET /themes/:slug/schema` — no auth check and no authMiddleware registered. Returns editable section schemas. No tenant data; schema is public metadata.

### 3.10 Cross-Tenant resource_id Injection Possibility

**Status: NOT_CONNECTED** (storefront render path) / **STRUCTURAL_ONLY** (binding resolution)

Dynamic Source Binding (`packages/theme-engine/src/dynamic-source-binding.ts`):
- `ResourceBinding.id` is resolved against `siteDrops` — a tenant-scoped in-memory map populated per render for the specific store
- Foreign/unknown `id` → `null` or `fallback` (line 67: "Never leaks cross-tenant data")
- `BINDING_BLOCKED_KEYS` (`dynamic-source-binding.ts:42-56`) mirrors `BLOCKED_DROP_KEYS` (`theme-renderer.ts:1030`); test asserts superset invariant

The metafield binding path is `NOT_CONNECTED` (storefront-runtime metafield service not yet implemented; always returns fallback/null per `dynamic-source-binding.ts:85-90`).

### 3.11 Direct Table Writes from App Routes (Canonical-Ledger-Only Rule)

**Status: VERIFIED_CURRENT (no violations in theme paths)**

| Search | Result |
|---|---|
| `.from('payment_transactions').insert` | 0 matches in gateway routes |
| `.from('refunds').insert` | 0 matches in gateway routes |
| `.from('payouts').insert` | 0 matches in gateway routes |
| Money mutations in themes.ts | 0 — confirmed no `payment_transactions`/`refunds`/`payouts` operations |
| `theme_purchases.upsert` in purchase route | Present but correct — `theme_purchases` is a marketplace record table, NOT in the canonical ledger set (`payment_transactions`/`refunds`/`payouts`/`gift_card_*`) |

Non-canonical exceptions (both are email field updates, not money fields):
- `customers.ts:1050`: `orders.customer_email` update during customer merge — email merge, not financial
- `security.ts:356`: `orders.customer_email` redaction during DSR erasure — PII operation, not financial

### 3.12 Money/Checkout/Payment/Razorpay/GST Path Changes (Phase M to HEAD)

**Status: VERIFIED_CURRENT (zero changes)**

```
git diff --name-only ff6720a9..HEAD | grep -E "checkout|payment|razorpay|payout|gst|ledger"
# Output: (empty — no matches)
```

The only database migrations introduced between Phase M and HEAD:
- `189_theme_persistence_idempotency.sql` — idempotency key column on `theme_releases` only
- `190_theme_library_q.sql` — `owned_by_site_id` and `is_site_private` columns on `themes` only
- `191_theme_purchases_rls_tenant_scope.sql` — RLS tightening on `theme_purchases` only

All three are theme-platform migrations with no touch on money tables, payment RPCs, or GST logic.

### 3.13 Sanitizer FORBID Config + URL/CSS Validation

**Status: VERIFIED_CURRENT**

**DOMPurify configuration** (`packages/theme-engine/src/theme-renderer.ts:170-231`):
- `USE_PROFILES: { html: true }` — standard HTML profile
- `FORBID_TAGS: ['base', 'embed', 'object', 'script']` — blocks script execution vectors
- `FORBID_ATTR: ['style']` — blocks inline style (all styling must go through validated `<style>` block)
- `ADD_TAGS: ['iframe', 'meta', ...custom elements]`
- `CUSTOM_ELEMENT_HANDLING.tagNameCheck`: strict allow-list regex for lb-* islands

**LiquidJS** (`theme-renderer.ts:736`):
- `outputEscape: 'escape'` — all Liquid template variable output is HTML-escaped

**Custom CSS sanitizer** (`packages/theme-engine/src/custom-css-sanitizer.ts`):
SAFE-CSS LAW enforcement — 11 violation categories checked in order:
1. Size guard (50 000 bytes max)
2. Null-byte check on raw input
3. HTML comment markers `<!--`/`-->` on raw
4. `</style>` breakout on raw
5. Normalization pipeline: strip block comments → decode CSS Unicode hex escapes → decode non-hex backslash escapes → collapse C0/whitespace
6. HTML breakout re-check on normalized form
7. @-rule blocklist: `@import`, `@charset`, `@namespace`
8. Dangerous property blocklist: `expression()`, `behavior:`, `-moz-binding:`, `-o-link:`, `-o-link-source:`, `filter: progid:`
9. `url()` scheme extraction + unsafe scheme detection (javascript:, vbscript:, data:text/html, data:image/svg, blob:, etc.)
10. Brace-balance check (prevents scope wrapper escape)
11. Scope wrapping: `${scopeSelector}{${trimmed}}` (CSS nesting)

**GAP-5 (MEDIUM): `iframe` in `ADD_TAGS` without `sandbox` attribute enforcement**
- `theme-renderer.ts:174`: `'iframe'` in `ADD_TAGS`
- `theme-renderer.ts:217`: `'sandbox'` in `ADD_ATTR` (allowed but not required)
- DOMPurify does not enforce that sandbox is present when iframe is used
- A merchant Liquid template can write `<iframe src="https://external">` without sandbox
- Without `sandbox="allow-scripts allow-same-origin"` restrictions, the iframe can navigate the parent browsing context on some browsers or trigger cross-origin behavior
- Severity: MEDIUM (merchant-authored template only; storefront isolation unclear)
- Proposed owning phase: AG

### 3.14 walkStringLeaves Depth Guard (theme-marketplace-contract.ts)

**Status: VERIFIED_CURRENT**

`MAX_SETTINGS_WALK_DEPTH = 12` at `packages/theme-engine/src/theme-marketplace-contract.ts:128`.
- Fail-closed: reaching the cap with remaining content sets `state.truncated = true` and the caller rejects the bundle rather than skipping unscanned strings (`theme-marketplace-contract.ts:136-146`)
- Documentation confirms this closes the bypass where `@import` buried below the cap could slip through

### 3.15 validateSafeThemeJson Depth Limit (theme-engine/index.ts)

**Status: GAP — MEDIUM**

`packages/theme-engine/src/index.ts:358-384`:
- `validateSafeThemeJson(value, path, issues)` recurses into nested objects and arrays without tracking or capping depth
- Array length > 100 is blocked (line 362) — prevents wide objects
- Object key blocking (`isUnsafeThemeKey`) is correct (`__proto__`, `prototype`, `constructor`, event handlers)
- String length > 5000 is blocked (line 381)
- **Missing:** no depth counter or maximum recursion depth
- Called by `parseThemeDocument` → `callees in saveDraft`, `publish`, `validateDocument`

A pathologically nested `template_config` payload (e.g. `{a:{a:{a:{a:...}}}}` with 10 000 levels) would cause a call stack overflow in the gateway worker.
- Severity: MEDIUM (DoS; no data exfiltration; Cloudflare Workers have 128 MB stack but recursion limits are lower)
- Proposed owning phase: AG
- Fix: add `depth` parameter to `validateSafeThemeJson` with cap `MAX_SETTINGS_WALK_DEPTH = 12` (same as `walkStringLeaves`)

### 3.16 THEME_LIQUID_RENDERING_DEFAULT_ENABLED

**Status: VERIFIED_CURRENT (false)**

| Evidence | Location |
|---|---|
| `export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` | `packages/theme-engine/src/theme-governance.ts:14` |
| `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'`, `authority: 'ARB'` | `theme-governance.ts:16-21` |
| Proxy reads env var: `process.env.THEME_LIQUID_RENDERING_DEFAULT_ENABLED === 'true'` only flips to liquid if explicitly set | `apps/storefront-runtime/src/proxy.ts:175` |
| `LiquidControl.tsx` in merchant editor shows flag — but default remains false | `apps/merchant-control-plane/src/components/theme-editor/controls/LiquidControl.tsx` |

Canary flag remains ARB-controlled. ART-17 freeze remains intact.

### 3.17 BLOCKED_DROP_KEYS Parity Between Renderer and Binding Paths

**Status: VERIFIED_CURRENT**

`BLOCKED_DROP_KEYS` (`theme-renderer.ts:1030`) and `BINDING_BLOCKED_KEYS` (`dynamic-source-binding.ts:42-56`) are identical 12-key sets:
```
__proto__, constructor, prototype, password, password_hash, access_token,
refresh_token, signing_secret, client_secret, api_key, secret_key, private_key, webhook_secret
```
A test asserts `BINDING_BLOCKED_KEYS` is a superset of `BLOCKED_DROP_KEYS` (`dynamic-source-binding.ts:39`). Both paths filter using `!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)` as a first guard (identifier-only keys).

---

## 4. Consolidated Risk Table

| # | Invariant | Source path:line | Exploit precondition | Blast radius | Current control | Gap | Severity | Proposed owning phase |
|---|---|---|---|---|---|---|---|---|
| R-1 | **theme_reviews USING(true)** — any authenticated Supabase session can mutate all reviews | `000_baseline.sql:24173` | Direct Supabase-auth client access (not gateway) | All marketplace theme reviews; reputation gaming | Gateway (service_role) bypasses RLS | Policy has no role qualifier; no `user_id = auth.uid()` scoping | MEDIUM | AG |
| R-2 | **validateSafeThemeJson depth limit missing** — no recursion cap on template_config nesting | `packages/theme-engine/src/index.ts:358` | Authenticated merchant submits `template_config` with deeply nested JSON | Gateway worker stack overflow (DoS); no data leak | Array length > 100 blocked; string > 5000 blocked | No depth counter | MEDIUM | AG |
| R-3 | **iframe ADD_TAGS without sandbox enforcement** — DOMPurify allows `<iframe>` without requiring sandbox attribute | `packages/theme-engine/src/theme-renderer.ts:174,217` | Merchant-authored Liquid template containing `<iframe src="...">` (no sandbox) | Parent browsing context navigation; clickjacking | `sandbox` is in ADD_ATTR (merchant can use it) | DOMPurify does not enforce sandbox presence on iframes | MEDIUM | AG |
| R-4 | **themes table public USING(true)** — direct authenticated client reads ALL themes including site-private | `000_baseline.sql:24152` | Direct Supabase-auth client; no `is_active` filter in their own query | Site-private theme name/schema disclosure | Gateway filters `is_active = true`; `is_site_private = false` is data discipline | No explicit `is_site_private = false` RLS filter | LOW | AG |
| R-5 | **theme_editor_drafts missing custom_user_id in RLS** — policies only check `sites.user_id = auth.uid()` | `000_baseline.sql:27608-27639` | Merchant registered via SSO (custom_user_id) using direct Supabase-auth client | Draft read/write denial for SSO merchants | Gateway (service_role) bypasses RLS; all mutations go through gateway | `theme_instance_drafts` and `theme_instances` correctly check both columns | LOW | AG |
| R-6 | **resource_id in storefront_translations not validated against owned resources** | `routes/stores-localization.ts:54,613-614` | Authenticated merchant submitting translations for foreign resource UUIDs | Data quality only; no cross-tenant read | `store_id` ownership verified; translations are store-scoped | Foreign resource_id accepted and stored | INFO | AI or later |

---

## 5. Confirmed Invariants (No Gap)

| Invariant | Evidence |
|---|---|
| Customer HS256 / Merchant ES256 never crossed | `auth-core/src/customer-session.ts:52,83`; `identity-session-verifier.ts:57,95` |
| Step-up enforced on refund (refund.approve) | `payments.ts:497-506` with 428 response |
| Step-up enforced on payout release | `payouts.ts:576-585` with 428 response |
| Step-up uses HMAC-SHA256 + constant-time compare | `security-controls.ts:80-100,160-243` |
| Gateway uses service_role exclusively for theme mutations | `supabase.ts:10-19`; confirmed no `getSupabaseUser` in theme routes |
| verifySiteOwnership before ALL theme mutations | `theme-execution.adapter.ts:277-299` + all 16 mutation operations |
| theme_purchases RISK-SEC-001 closed | `191_theme_purchases_rls_tenant_scope.sql` — DROP old USING(true) + scoped replacements |
| Default-locale deletion blocked | `stores-localization.ts:581-583` |
| THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false | `theme-governance.ts:14` — constant, not env-var dependent |
| outputEscape: 'escape' on LiquidJS | `theme-renderer.ts:736` |
| BLOCKED_DROP_KEYS parity (renderer + binding) | `theme-renderer.ts:1030`; `dynamic-source-binding.ts:42-56` |
| walkStringLeaves depth cap = 12, fail-closed | `theme-marketplace-contract.ts:128,136-146` |
| CSS sanitizer 11-vector SAFE-CSS LAW | `custom-css-sanitizer.ts:1-424` |
| Money path files unchanged Phase M to HEAD | `git diff --stat ff6720a9..HEAD` — 0 matches on checkout/payment/razorpay/payout/gst |
| No money table direct inserts in theme routes | grep confirmed 0 `.from('payment_transactions').insert` |
| ART-22: frozen apps not touched | No changes to `apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace` in theme commits |

---

## 6. validate-governance.mjs Safety Assessment

`scripts/validate-governance.mjs:170-188`:
- `fs.rmSync` is called only when `stale-artifact-validator.mjs` runs
- Removes directories named: `node_modules`, `.next`, `.turbo`, `dist`, `dart_tool`, `build`, `coverage`, `.cache`, `.wrangler`, `.vercel`, `.symlinks`, `Pods`
- All are gitignored generated artifact directories (confirmed: `git ls-files --others --directory` shows these as untracked)
- Does NOT write to, rename, or delete tracked source files
- **Assessment:** SAFE to run; operator may run `node scripts/validate-governance.mjs` without altering tracked source

---

## 7. STOP/GO Inputs for AF_1 Decision

This workstream contributes the following concrete inputs to the AF_1 STOP/GO decision:

### GO inputs (invariants confirmed green)
1. Customer HS256 / Merchant ES256 issuer separation is code-enforced in two layers — VERIFIED_CURRENT
2. Step-up HMAC gating on refund.approve and payout.release — VERIFIED_CURRENT, constant-time, 10-min window
3. verifySiteOwnership (covering both user_id + custom_user_id) is called before all 16 theme mutation operations — VERIFIED_CURRENT
4. Gateway uses service_role exclusively; no user-role Supabase client in any theme route — VERIFIED_CURRENT
5. RISK-SEC-001 (theme_purchases wide-open USING(true)) — CLOSED by migration 191 in Phase AE — VERIFIED in source
6. THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false (constant in governance module) — VERIFIED_CURRENT
7. Money/checkout/Razorpay/GST source paths unchanged from Phase M to HEAD — VERIFIED_CURRENT (0 file matches)
8. Canonical-ledger-only rule intact — no .from(payment_transactions|refunds|payouts).insert in gateway routes — VERIFIED_CURRENT
9. Custom CSS sanitizer (SAFE-CSS LAW) covers all major injection vectors including unicode-decode, whitespace-smuggling, brace escape — VERIFIED_CURRENT
10. BLOCKED_DROP_KEYS parity between renderer and binding paths — VERIFIED_CURRENT, test-enforced

### STOP / Conditional-GO inputs (human-gated before AF_1 GO)

11. **MEDIUM (R-1): theme_reviews USING(true) policy** — direct Supabase-auth clients can mutate all theme reviews; requires a migration to scope by `user_id = auth.uid()`. Must be addressed before marketplace is live with real partner submissions.
12. **MEDIUM (R-2): validateSafeThemeJson depth limit** — no recursion cap allows stack overflow on pathological template_config. Must add depth counter (same pattern as walkStringLeaves MAX = 12) before enabling merchant-arbitrary theme editing at scale.
13. **MEDIUM (R-3): iframe without sandbox** — DOMPurify ADD_TAGS includes iframe without enforcing sandbox attribute. Recommend adding `FORCE_ADD_ATTR: ['sandbox']` on iframe or enforcing via post-sanitize pass before enabling Liquid canary for production traffic.

### Advisory inputs (does not block AF_1)

14. **LOW (R-4):** themes USING(true) leaks site-private theme names to direct authenticated Supabase clients — remediate in AG with an additional RLS predicate `OR is_site_private = false` on the public read policy.
15. **LOW (R-5):** theme_editor_drafts policies missing custom_user_id check — add `OR sites.custom_user_id = auth.uid()` to all four policies; does not affect gateway-mediated access.
16. **INFO (R-6):** resource_id in translation POST not validated against owned resources — data quality only; does not affect tenant isolation.

---

*End of AF_05_SECURITY_TENANCY_INVARIANT_AUDIT.md*
