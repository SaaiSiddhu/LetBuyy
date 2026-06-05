# Current Apps Ecosystem Audit

**Audit date:** 2026-06-05 · **Method:** Forensic code analysis (6 parallel scans + direct verification) · **Status:** Evidence-based; every claim cites a repo path. Where prior root-level docs conflict with code, code wins (see §11).

---

## 1. Platform Topology (As Built)

```
                         ┌─────────────────────────────────────────────┐
                         │                 VERCEL (Next.js)            │
                         │                                             │
  Shopper ──────────────▶│ apps/storefront-runtime  (store.*)          │
  Merchant ─────────────▶│ apps/merchant-control-plane (admin.*)       │
  Identity ─────────────▶│ apps/identity-platform   (accounts.*)       │
  App browsing ─────────▶│ apps/app-marketplace     (apps.*)           │
  Theme browsing ───────▶│ apps/theme-marketplace   (themes.*)         │
  Developer ────────────▶│ apps/developer-portal    (≈10 files, SHELL) │
  Platform staff ───────▶│ apps/platform-console / platform-operations-portal │
  Marketing ────────────▶│ apps/marketing-site                         │
                         └──────────────────┬──────────────────────────┘
                                            │ @letbuyy/api-client (thin clients, 0 direct Supabase imports)
                                            ▼
                         ┌─────────────────────────────────────────────┐
                         │           CLOUDFLARE WORKERS (Hono)         │
                         │ services/api-gateway   ── /v1/* (REAL, 78f) │
                         │ services/webhook-service (REAL, ~1.4K LOC)  │
                         │ services/queue-workers   (REAL, slim)       │
                         │ services/event-bus        (MANIFEST-ONLY)   │
                         │ services/checkout-runtime (MANIFEST-ONLY)   │
                         │ services/notification-service (MANIFEST-ONLY)│
                         │ services/media-service    (MANIFEST-ONLY)   │
                         │ services/search-service   (MANIFEST-ONLY)   │
                         │ services/analytics-pipeline (MANIFEST-ONLY) │
                         └──────────────────┬──────────────────────────┘
                                            ▼
        Supabase Postgres (233 tables, 352 RLS policies) · Cloudflare D1/KV/R2/Queues/Durable Objects · Upstash Redis
```

- Verified: only `api-gateway`, `webhook-service`, `queue-workers` contain source. The other six service roots contain exactly `AGENTS.md` + `runtime.manifest.json` (verified by directory listing 2026-06-05). They are reserved roots per `docs/governance/runtime-boundaries.md`, but their declared responsibilities currently execute inside `api-gateway`/`queue-workers`.
- Mobile: `apps/mobile/merchant-app` is real (~151 files, consumes `/v1` gateway). `apps/mobile/operator-app/lib/main.dart` is the stock Flutter counter template. `apps/mobile/shopper-app` is manifest-only.
- Federation claim "all web apps are thin clients" is **verified true**: zero `@supabase/*` imports in app source trees.

## 2. Apps Ecosystem — Component Inventory

### 2.1 `apps/app-marketplace` (storefront of the App Store)
- 39 files, ~2,000 LOC. Next.js 16.1.6.
- Routes: `(store)/search`, `(store)/apps/[slug]`, API routes under `src/app/api/` — `GET /api/apps` (filters: category, sort, pricing, siteType), `GET/POST/DELETE /api/apps/[id]/install`, `POST /api/developers/register`.
- Service layer `src/lib/app-service.ts` delegates to gateway via `@letbuyy/api-client`; **silently returns `{apps: [], total: 0}` on backend failure** (`app-service.ts:48-56`) — outage masking.
- Auth: merchant session cookie (`LETBUYY_MERCHANT_SESSION_COOKIE`) + signed internal headers (`createLetbuyyInternalSessionHeaders`, `src/lib/api/client.ts:27-62`). Hardcoded fallback `DEFAULT_API_BASE_URL = 'https://api.staging.letbuyy.store'` (`client.ts:14`).

### 2.2 `services/api-gateway/src/routes/app-store.ts` — the de-facto Apps Platform backend (2,721 lines)
This single file is the real platform. Endpoint inventory (verified by grep, line numbers cited):

| Concern | Endpoints | Lines |
|---|---|---|
| Catalog | `GET /categories`, `GET /apps`, `GET /apps/:id`, `GET/POST /apps/:id/reviews` | 689–871 |
| Installations | `GET /installations`, `GET /installations/:id/extensions`, `PATCH /installations/:id/extensions/:registrationId`, `PATCH /installations/:id/functions/:registrationId` | 874–1133 |
| Embedded apps | `POST /installations/:id/embed-session`, `POST /bridge/fetch` (server-side proxy w/ token-hash check) | 1135–1332 |
| App billing | `POST /installations/:id/charges`, `POST /charges/:id/approve` | 1334–1590 |
| OAuth | `POST /apps/:id/oauth/authorize` (issues short-lived code), `POST /oauth/token` (code→scoped token), `POST /oauth/token-exchange` (merchant session→embedded app token) | 1592–1941 |
| Install lifecycle | `POST /apps/:id/install`, `DELETE /apps/:id/install` | 1943–2247 |
| Developers | `GET /developers/me`, `POST /developers/register`, `GET /developers/apps`, `POST /developers/apps`, `GET /developers/:id` | 2249–2721 |
| Partners | `GET /partners/dashboard`, `POST /partners/collaborator-code` (role-gated `requireRoleCategory('partner')`) | 2369–2575 |

**Critical architectural fact:** OAuth state (authorization codes, `access_token_hash`, `bridge_token_hash`, redirect URIs) is persisted inside `app_installations.config` **JSONB** (`appOAuthConfig()` at line 126, 212, 1195, 1286, 1820), not in dedicated `oauth_tokens` / `api_keys` tables. There is no refresh token, no token rotation, no per-token revocation, no token listing.

### 2.3 `packages/app-engine` (manifest + contracts, 1,778 LOC, single `src/index.ts`)
- Zod manifest schema (`AppManifestExtensionSchema`, index.ts:234-251): `handle, name, surface, target, renderer, source{url,entrypoint}, scopes, capabilities, settings`.
- Surfaces (index.ts:192-196): `admin.product_details`, `admin.dashboard`, `checkout.payment`, `theme.app_block`.
- Targets: admin `button|modal|section` (198-203); checkout `shipping|payment` (205-211); theme `hero|product|cart` (213-217).
- Renderers (231): `iframe`, `web_component`, `liquid_app_block`.
- Records: `AppDeveloperRegistrationInsert` (80-91), `MarketplaceAppSubmissionInsert` (92-108, includes `pricing_model`, `webhook_topics`), `MarketplaceAppOAuthRecord` (115-119: `client_id`, `client_secret`, `redirect_uri`), `AppWebhookDefinition`/`AppWebhookSubscriptionInsert` (120-139), `MANDATORY_COMPLIANCE_WEBHOOK_TOPICS` (150-156), `AppAdminEmbedExtensionRecord`/`AppAdminEmbedInstallationRecord` (158-185), `AppExtensionRegistryRecord` (446-470, status `enabled|disabled|revoked`), `AppFunctionRegistryRecord` (471-496), `AppExtensionRegistryInstallPlan` (497-502).
- `AppBlockInstance` (64-78): `{id, app_id, extension_id, slot, title, render_mode: 'inline'|'iframe', settings, content{heading,body,cta_label,cta_href}, iframe_url?}` + `normalizeAppBlockInstances()` (≈1556) with silent-coercion defaults (≈1520).

### 2.4 `packages/extension-host` (328 LOC)
- Declared "pure host policy; no fetches, secrets, browser globals, provider SDKs, DB clients" (`packages/extension-host/AGENTS.md`). **Verified consumed**: `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx` (267 lines) imports it and implements an iframe host with postMessage bridging + bearer-token injection (`Authorization: ${session.bridge.token_type} ${session.bridge.access_token}`, line 141), mounted at `[store]/apps/[installationId]/page.tsx`. The embedded-app chain therefore has a working admin-side host; the missing half is a published client SDK for app developers (the postMessage protocol is undocumented/unpackaged).

### 2.5 Database (apps platform slice; `database/supabase/migrations/000_baseline.sql` + `076_app_extension_registry.sql`)
Tables (line numbers in baseline): `app_billing_charges` (8245), `app_categories` (8295), `app_developers` (8311), `app_extensions` (8333), `app_installations` (8350: `store_id`, `installed_by`, `scopes_granted`, `config`, `status`), `app_reviews` (8368), `app_webhooks` (8391), `marketplace_apps` (9693), `marketplace_review_records` (9736), `partner_payout_ledger_entries` (10225), `webhook_subscriptions` (13049), `webhook_deliveries` (1361), `outbox_events` (1215), plus migration `076_app_extension_registry.sql`.

Known structural defects:
- `app_installations.store_id` is nullable, no FK to `sites`.
- `app_reviews` ≈ duplicate of `marketplace_review_records`; `app_webhooks` overlaps `webhook_subscriptions` (two delivery registries).
- No `api_keys`, no `oauth_tokens`, no `app_versions`, no `theme_app_extensions` tables.
- Secrets (`webhook_subscriptions.signing_secret`, `app_webhooks.secret`) stored plaintext.
- RLS: `service_role_app_installations ... USING (true) WITH CHECK (true)` (baseline:26324) — one of **50 permissive `CREATE POLICY … USING (true)` lines** (grep-verified) including `sessions`, `users_custom`, `devices`, `verification_tokens`, `customer_credentials`, and `products` service-role bypass at 26436.

## 3. App Lifecycle (As Implemented)

```
Developer registers ──▶ POST /v1/app-store/developers/register        (app_developers, status='pending', verified=false — never flipped)
Developer creates app ─▶ POST /v1/app-store/developers/apps           (marketplace_apps, status draft|pending|published|suspended)
Review/approval ───────▶ status field only; no review queue UI/workflow engine found in platform-console scans
Merchant discovers ────▶ app-marketplace UI → GET /v1/app-store/apps
Merchant installs ─────▶ POST /v1/app-store/apps/:id/install
                          ├─ writes app_installations (store_id, scopes_granted, config)
                          ├─ seeds config.oauth (client info, token hashes)
                          ├─ registers extension/function registry rows (per 076)
                          └─ app webhook subscriptions (status 'pending')
OAuth handshake ───────▶ /oauth/authorize → code → /oauth/token → scoped token (hash stored in config JSONB)
Embedded session ──────▶ /installations/:id/embed-session + /oauth/token-exchange + /bridge/fetch proxy
Billing ───────────────▶ POST /installations/:id/charges → merchant POST /charges/:id/approve (app_billing_charges: pending_merchant_approval→approved→active)
Uninstall ─────────────▶ DELETE /apps/:id/install (config.oauth wiped per lines 2164-2165; no documented data-purge webhook enforcement)
```

Missing lifecycle stages vs. Shopify: app versioning/releases, staged rollout, review pipeline with checklists, scope-change re-consent, mandatory compliance webhook verification at submission, deprecation/sunset flow, reinstall token semantics.

## 4. OAuth & Permissions — Current State
- **Exists:** authorization-code grant (short-lived code `app_oauth_code:{installationId}:{uuid}`, app-store.ts:1667), scoped token issuance, session→token exchange for embedded apps (Shopify-token-exchange analog), bridge fetch proxy validating `bridge_token_hash`/`access_token_hash` (1286-1288), `api_scopes` + `oauth_redirect_uris` on `marketplace_apps` (1619), redirect URI normalization (1633).
- **Gaps:** no offline/online token distinction; no refresh/rotation; no expiry sweep job found; tokens-as-JSONB prevents audit/revocation queries; no consent screen recorded artifacts (grant record table); no scope taxonomy doc (scopes are free strings; `uniqueManifestStrings(raw.scopes, inheritedScopes)` app-engine:738 — **no enforcement at request time**: gateway middleware checks merchant RBAC (`packages/auth-core/src/index.ts:43-90` — 5 roles, resource/action/scope model) but no app-scope→route mapping layer.
- Identity-platform owns human auth (18 auth API route files); it does **not** host the app OAuth server — that lives in the gateway. Split is workable but undocumented.

## 5. Billing — Current State
- `packages/billing-core` (~762 LOC): tiers free/starter/business/enterprise; `CreateAppBillingChargeSchema {store_id, installation_id, billing_mode: recurring|usage, name, amount_minor, currency, idempotency_key, return_url, metadata}` (billing-core:80-98); `MerchantApprovedUsageChargeSchema`.
- Charge lifecycle implemented in gateway (create → merchant approve). Invoices written to `billing_history` by webhook-service (18% tax hardcoded, webhook-service/src/index.ts:655-670).
- Merchant SaaS subscriptions (platform plans) fully wired via payment-provider webhooks (Stripe subscription events handled).
- **Gaps:** no app subscription object (trial, frequency, proration, cancellation), no usage-record ingestion API, no billing webhooks to apps, no revenue-share computation writing `partner_payout_ledger_entries`, no payout release flow (events `payout.released/failed` defined in `packages/event-core/src/index.ts:74-98` but no producer found), no managed-pricing equivalent.

## 6. Webhooks & Events — Current State
- **Outbound (platform→app/merchant):** transactional outbox (`outbox_events`) → cron in gateway (`src/index.ts:280-354`) → `webhook_deliveries` rows → `webhook-service` claims via Supabase RPC `claim_webhook_deliveries(dispatcher_id, limit, lock_seconds)` → HMAC-SHA256-signed POST → exponential backoff `min(120·2^attempts, 3600)`, dead-letter after cap (webhook-service/src/index.ts:776-851). App lifecycle dispatch endpoint `/app-lifecycle/dispatch` gated by `X-LetBuyy-Internal-Secret` (742-774).
- **Inbound (provider→platform):** Razorpay/Stripe/PayPal/Cashfree handlers **with signature verification implemented per provider** (HMAC formats documented in webhook-service; Stripe `t=,v1=` scheme, PayPal server-side verification call). Note: a stale claim in `tasks/todo.md` ("no cryptographic signature verification") contradicts the shipped code — treat the code as authoritative, but see §11.
- **Event taxonomy** (`event-core:74-98`): `store.created`, `product.*`, `order.*`, `app.installed/uninstalled/submitted/approved/rejected`, `app.charge.created/activated`, `theme.submitted/approved/rejected/installed`, `payout.*`.
- **Registry semantics (verified):** `app_webhooks` holds app-level webhook *definitions*; `planAppWebhookSubscriptions()` (app-engine:1420-1445) expands them at install into per-store `webhook_subscriptions` rows (`metadata.source='app-platform'`, mandatory compliance topics auto-merged into `event_types`). So the design is definitions→subscriptions, not pure duplication — but the naming invites split-brain writes and `app_webhooks.secret` duplicates secret storage.
- **Gaps:** subscription create lacks per-merchant caps/rate limits; no topic-permission link to app scopes; no delivery dashboard for developers; PayPal inbound webhook misplaced in `apps/storefront-runtime/src/app/api/payments/paypal/webhook/route.ts` (violates gateway-owns-API rule, root `AGENTS.md`); no event replay API for apps; `queue-workers` persists to `distributed_queue_messages` with idempotency + ≤10 attempts (queue-workers/src/index.ts:62-80) but consumers for analytics/search queues were not found (declared queues exist in `config/cloudflare/resource-names.json`).

## 7. Extensions, App Blocks, Embedded Apps — Current State
- **Theme-side mount point:** `appBlockSlot` built-in section (`packages/theme-engine/src/theme-registry.ts`, ~30 built-in section schemas). `injectAppBlocksIntoSections()` (`apps/storefront-runtime/src/lib/store-service.ts:220-288`) matches `AppBlockInstance.slot` → slot sections, creating missing slot sections dynamically.
- **Render paths:** inline (escaped HTML article wrapper) or sandboxed iframe (`sandbox="allow-forms allow-popups allow-scripts allow-same-origin"`) — `composition-engine.tsx:95-149`; Liquid path via `buildLiquidAppBlocks()` map keyed by block id/extension id/slot.
- **Embedded admin apps:** `embed-session` + token-exchange + `bridge/fetch` (gateway) + `EmbeddedAppBridgeClient` host page (control-plane, §2.4) constitute a working App-Bridge analog server+host side; `AppAdminEmbedExtensionRecord` stores iframe manifests. Missing: a published client-side App Bridge SDK for app developers and a documented postMessage/session-token contract.
- **Missing entirely:** app-supplied Liquid (apps cannot ship `.liquid` blocks/snippets/assets — `renderer: 'liquid_app_block'` is declared in app-engine but no ingestion/validation/deploy pipeline exists); app embeds (head/body, on/off, theme-version-agnostic); `@app` block support inside arbitrary theme sections; app asset CDN pipeline; extension versioning/deploy; checkout UI extension host (`packages/runtime-composition/checkout-runtime-adapter` + `CheckoutExtensionHost.tsx` are scaffolds); admin extension rendering host (extension-host unwired); function runtime execution (`AppFunctionRegistryRecord` + I/O types exist, no executor).

## 8. Theme Runtime & LiquidJS — Current State (verified against code, not stale docs)
- `liquidjs@^10.27.0`; engine factory `createLiquidEngine()` (`theme-renderer.ts:230-250`): `cache:false`, strict filters, dynamic partials off, parse/render/memory limits (300K/250/2M), globals `content_for_header/footer`.
- **`LiquidRenderer` is fully implemented** (`theme-renderer.ts:104-210`): bundle parse → template resolve → per-section block render (incl. app blocks) → section `parseAndRender` → layout render → `sanitizeRenderedHtml()` (471-476: strips `<script>`, `on*` handlers, `javascript:`/`data:text/html` URLs). Root doc `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md` claiming "LiquidRenderer stubbed / zero .liquid files" is **stale** — bundle contract `THEME_LIQUID_BUNDLE_SCHEMA_VERSION='2026-06-liquid-sections'` with `sections/*.liquid`, `blocks/*.liquid`, `templates/*.json`, `config/settings_schema.json`, `locales/*` exists in `theme-bundle.ts` (2,100 LOC) with forbidden-fragment validation (`<script`, `{% include`, `{% layout`, `{% render`), 200KB/file cap, ≤50 blocks/section, ≤80 sections/template.
- Dual renderer: `JsonContractThemeRenderer` (32 hardcoded React sections via `renderer-registry.tsx`) + Liquid. Hydration islands (add-to-cart, cart-drawer, search, variant-picker) declared in `theme-bundle.ts:30-51`.
- Theme lifecycle: drafts/releases/preview tokens/rollback schemas (`theme-engine/src/index.ts:886-909`), tables `themes`, `store_themes`, `theme_packages`, `theme_releases`, `theme_purchases`, `theme_reviews`, `theme_instance_drafts`, `theme_editor_drafts`, `theme_preview_sessions` (baseline lines 12895/12121/12635/12737/12708/12789/12525/12506/12679).
- Performance defects: per-request engine instantiation with cache disabled; sequential product fetch before render (`data-binding-engine.ts:46-84`); O(N×M) section-definition walking (`store-service.ts:348-376`); hardcoded demo store `isUrbanKicksDemoSubdomain()` (store-service.ts:55-56).

## 9. Multi-Tenancy & Security Posture (apps slice)
- Tenant key `store_id`/`site_id`; gateway resolves tenant from JWT claim, `X-Store-ID`, or subdomain (`middleware/store-context.ts`); RBAC roles Administrator/Merchandiser/Support/Partner/Ops-Reviewer (`auth-core:43-90`).
- Risks: service-role Supabase client available across gateway routes (Env at `api-gateway/src/index.ts:49-104`) → RLS bypass by construction; 39 permissive policies; install route trusts client-supplied `store_id` body field with backend-side validation assumed (app-marketplace install route:19); no per-store rate limits (global 300/min, `middleware/rateLimit.ts`, Upstash→KV→memory fallback); no idempotency keys on install/uninstall; webhook secret accepted in plaintext request body (install route:21); 97 `console.*` statements across 58 active files (grep-verified; top: storefront API routes, app-marketplace API routes, `packages/typescript/utils/src/auth.ts`); no audit-log triggers on `app_installations`.

## 10. Per-Subsystem Verdict Matrix

| Subsystem | State | Implementation | Biggest violation | Biggest risk |
|---|---|---|---|---|
| Apps Marketplace (UI) | Real, thin | ~85% | Silent empty-state fallback | Outage masking |
| Apps backend (gateway app-store.ts) | Real, monolithic | ~75% | 2,721-line single file owns 8 concerns | Unmaintainable; no module boundaries |
| App manifest/SDK (app-engine) | Real schemas | ~90% types / 0% runtime SDK | No published developer SDK | Contract drift |
| Extension registry | Tables+endpoints | ~60% | No versioning/deploy pipeline | Unsafe extension updates |
| Theme app extensions | Slot-only | ~25% | Apps can't ship Liquid/assets | Shopify-parity blocker |
| App embeds | Absent | 0% | — | Parity blocker |
| Embedded admin apps | Bridge + host page | ~60% | No published App Bridge SDK; token hashes in JSONB | Session security |
| OAuth | Real flow | ~55% | Token state in JSONB | No revocation/rotation/audit |
| Permissions/scopes | Strings only | ~30% | No request-time scope enforcement | Over-broad app access |
| App billing | Charges only | ~45% | No subscriptions/usage/payouts | Revenue ops impossible |
| Webhooks (outbound) | Real pipeline | ~80% | Dual registries; plaintext secrets | Forgeable on DB breach |
| Events | Real outbox | ~75% | Missing queue consumers | Silent data loss |
| Developer portal | Shell | ~10% | 10-file app vs. live gateway endpoints | Developers have no console |
| Partner platform | Endpoints only | ~35% | No orgs/teams/keys/payout UI | Ecosystem can't onboard |
| App review/moderation | Status fields | ~15% | No review workflow in console apps | Unvetted apps publishable |
| Theme runtime (Liquid) | Real | ~80% | No compiled-template cache | Per-request latency |
| Storefront integration | Real (slots) | ~70% | No app data-binding contract | Apps limited to static/iframe |
| Tenant isolation | Partial | ~60% | 39 permissive RLS policies | Cross-tenant exposure via service role |

## 11. Docs-vs-Reality Corrections (both directions)
1. **Stale-negative:** `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md` (2026-06-04) claims Liquid is stubbed/no portable bundles → **false as of audit**; full Liquid path + bundle contract shipped (`theme-renderer.ts:104-210`, `theme-bundle.ts`).
2. **Stale-negative:** `tasks/todo.md` claims payment webhook signature verification missing → webhook-service implements per-provider verification; residual true issue: PayPal inbound handler misplaced in storefront-runtime.
3. **Stale-positive:** `CODEX_MARKETPLACE_LEDGER.md` claims marketplace flows "complete" → UI exists, but backend tests are "SKIP—NEEDS BACKEND" and services hide failures with empty fallbacks (`LETBUYY_STATE.md:961,997` corroborates).
4. **Historical artifacts cited as current:** duplicate migration `022` and `all.env` secrets exist only in `memory/lessons.md` history; current tree has 7 clean migration files and **no tracked `.env` with secrets** (`git ls-files` verified — only `config/env/*.example|template`). Secret-rotation hygiene still recommended given the historical note.
5. **Counts drift:** root `AGENTS.md` references "65 Supabase migrations" → current: 1 baseline + 6 incremental (post-squash).
6. `LETBUYY_STATE.md` reports failing local `typecheck` (Cloudflare worker types) and governance failure on stale artifacts. **Re-tested 2026-06-05:** `node scripts/validate-governance.mjs` now passes (128 validators) — the governance half of that claim is stale; the typecheck claim was not re-run by this audit and remains to be verified (tracked as H10).

## 12. Metrics Snapshot
~991 source files in apps/packages/services (633/264/94). Apps-platform slice ≈ 4,450 LOC (engine+marketplace+host) + 2,721-line gateway route + ~6,500 LOC theme/storefront layer. DB: 233 tables, 365 indexes, 389 FKs, 352 RLS policies (50 permissive `USING (true)` policy lines). 69 env vars in templates. 10 GitHub workflows; 98 governance validators (`scripts/validate-governance.mjs`). Tests: 139 files, overwhelmingly governance/contract — functional app-platform E2E ≈ 0.
