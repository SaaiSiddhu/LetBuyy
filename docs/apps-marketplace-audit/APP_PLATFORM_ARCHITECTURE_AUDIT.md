# App Platform Architecture Audit (Phase 11)

Can a real third-party ecosystem exist on this architecture? Audits OAuth, scopes/permissions, app authentication, webhooks, extensions, embedded apps, billing APIs, and developer APIs. This is the strongest area of the marketplace. Parent: [Master Audit](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md).

## Architecture in one line

A **Next.js thin client** over a **Hono API gateway** (`services/api-gateway`) backed by **Supabase/Postgres**, with domain events emitted to **queue-workers / webhook-service**. The app-store routes are ~3,940 LOC (≈4,455 with the `app-auth` middleware and the `/app` data API) across 30 endpoints.

## Subsystem assessment

| Subsystem | Implementation | Status |
|---|---|---|
| **OAuth 2.0** | `/apps/:id/oauth/authorize`, `/oauth/token`, `/oauth/token-exchange`; `mintAppOAuthAccessToken` / `mintAppOAuthRefreshToken` (jose JWT) | ✅ Real — but **unused by the marketplace UI** |
| **Scopes** | `marketplace_apps.api_scopes`; install normalizes requested scopes against declared (`normalizeAppInstallScopes`) | ✅ Real; ❌ no optional/incremental scopes; no re-consent (no update flow) |
| **App authentication** | `middleware/app-auth.ts`; app credentials minted at submit; API-key rotation endpoint | ✅ Real; ❌ no key-management UI |
| **Webhooks** | `app_webhooks` table; `insertAppWebhookSubscriptions`; lifecycle outbox `app.installed`; signing secret generated server-side (not forwarded from client — good) | ✅ Real; ❌ no developer webhook UI/delivery logs |
| **Extensions** | 8 types in `app_extensions` (storefront_block, admin_link, checkout_extension, product_action, order_action, settings_page, dashboard_widget, api_endpoint); registry + function registration endpoints; manifest validation | ✅ Real model; ❌ no configuration UI |
| **Embedded apps** | `/installations/:id/embed-session`, `/bridge/fetch` (App-Bridge-style) | ✅ Endpoints exist; ❌ UI raw-iframes `app_url` instead |
| **Billing API** | `app_billing_charges` (pending_merchant_approval → approved → active → cancelled → failed); merchant approval w/ `verifySiteOwnership`; revenue share + GST | ✅ Real; ❌ no UI; ❌ no usage metering, trials, refunds |
| **App data API** | `/app/products`, `/app/orders`, `/app/installation/metadata` (`app-api.ts`) | ✅ Real scoped data access for installed apps |
| **Compliance** | `/compliance/customers/data-request`, `/customers/redact`, `/shop/redact` | ✅ Matches Shopify's mandatory webhooks |
| **Idempotency** | `X-Idempotency-Key` → `IdempotencyExecutionAdapter` on install | ✅ Real |
| **Events** | `emitDomainEvent` (`app.installed`, `app.charge.created`, `app.approved/rejected`) | ✅ Real |

## Why an ecosystem *could* exist here

The hard primitives are present and mostly correct: OAuth with refresh, scoped install with server-side normalization, server-generated webhook signing secrets, an extension/manifest model, App-Bridge-style embedding, merchant-approval billing, scoped app data APIs, idempotency, and event emission. That's the load-bearing structure of a Shopify-class platform. A competent third party *could* build against `@letbuyy/api-client`.

## Why it can't *yet*

These are the architecture-level blockers (distinct from UI gaps):

1. **No app update/versioning anywhere.** No `PATCH/PUT /developers/apps/:id`, no version records, no staged rollout. An ecosystem where apps can never change after approval is not viable. **(S0)**
2. **Review gating is non-functional.** Automated checks are recorded as passed without executing; the only real gate is a human in another portal. Malicious/over-scoped apps aren't actually screened. **(S1)**
3. **Search injection.** `GET /app-store/apps` interpolates the raw `search` string into a PostgREST `.or()` filter (`name.ilike.%q%,tagline.ilike.%q%`). A crafted query can inject additional filter syntax. Use escaped builders or an RPC full-text function. **(S1 security)**
4. **OAuth designed but disconnected.** The platform has a real authorization-code flow the product doesn't use; install posts scopes directly. This forks the security model and makes optional scopes / incremental auth impossible in practice. **(S1)**
5. **No app health / API-usage / rate-limit observability** exposed to developers or the review team — so quality bars like Shopify's p95<500ms can't be enforced.
6. **Pricing model mismatch.** UI offers `usage_based`; DB CHECK on `marketplace_apps.pricing_model` allows only `free/freemium/one_time/recurring`. Submissions can desync from the schema. **(S2)**
7. **Economic logic inconsistent.** `revenue_share_bps` defaults to `8000` (20% platform) while the product promises 15%. **(S0 trust)**

## Scale & resilience notes

- **Data model** is normalized with denormalized counters maintained by triggers (`install_count`, `rating_avg`) — fine to thousands of apps.
- **Catalog reads** use inner joins on `app_developers`/`app_categories` with `status='published'` and range pagination (cap 50) — reasonable, but no stated caching/CDN for a public catalog.
- **Install/charge** paths are idempotent and event-driven — good for retries and async fan-out.
- The repo carries heavy runtime/replay/queue governance validators; the app-store routes plug into that execution/idempotency/outbox machinery rather than reinventing it.

## Bottom line

**Architecturally a B+/A− foundation.** The ecosystem can exist on this once four things are fixed: (1) add app update/versioning, (2) make review gating real, (3) close the search-injection and OAuth-bypass gaps, and (4) reconcile economics and the pricing-model enum. None require re-platforming — they're additive.
