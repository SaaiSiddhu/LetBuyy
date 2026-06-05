# Apps Ecosystem Investigation Report

Scope: third-party app platform — manifests, OAuth, billing, webhooks, extensions, embedding — vs Shopify's app platform.

## Implemented (with evidence)

| Capability | Status | Evidence |
|------------|--------|----------|
| App manifest schema | Real | `packages/app-engine/src/index.ts` (1,779 lines): `LetbuyyAppManifestSchema`, version `2026-06-05.ws13`; `normalizeLetbuyyAppManifest()` (795–857); registration planner (878–1014); example factory (1148–1214) |
| OAuth 2.0 (auth-code) | Real | `services/api-gateway/src/routes/app-store.ts:1592-1775` `POST /app-store/apps/:id/oauth/authorize`; 15-min codes (1668–1679); `createAppScopedAccessToken()` (2014–2020); scopes validated vs declared `api_scopes` (1628); SHA-256 token hashes stored (1709, 2021) in `app_installations.config` |
| Scope enforcement | Real | `normalizeAppInstallScopes()` (app-engine 1326–1342); per-resource required scopes on bridge calls (app-store.ts 290–300) |
| App billing | Real (INR-only) | `POST /app-store/installations/:id/charges` (1334–1470); `app_billing_charges`: billing_mode usage/recurring, status `pending_merchant_approval` → approval_url, revenue_share_bps, partner_gst_bps, payout_rail (razorpay_route/upi/manual), idempotency_key |
| Webhooks | Real | `services/webhook-service/src/{index,app-lifecycle-dispatch}.ts`: HMAC `X-LetBuyy-Hmac-SHA256` over `timestamp.rawBody`, `v1=<hex>` format; retries 2^n·120 s cap 1 h ×8; `X-LetBuyy-Event-ID` dedupe; mandatory GDPR-style topics `customers/data_request`, `customers/redact`, `shop/redact` (app-engine 150–154); tables `app_webhooks`, `app_webhook_subscriptions`, `webhook_deliveries` |
| Extension registry | Real (DB) | migration `076_app_extension_registry.sql`: `app_extension_registrations` + `app_function_registrations`, RLS-enabled, status enabled/disabled/revoked; surfaces `admin.ui` (settings_page, dashboard_widget, product_action, order_action), `checkout.ui` (5 targets), `theme.app_block` (4 targets: home, product, collection, footer) |
| App functions | Real (contract) | WASM-only, hooks `cart.discount.calculate`, `checkout.shipping.rate`, `checkout.payment.customize`, `checkout.validation.run`; SHA-256 binary verification (mig. 076:107-109); runtime `services/api-gateway/src/extensions/app-functions-runtime.ts` |
| Embedded apps (App Bridge equivalent) | Real | `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx` (postMessage, line 113); sandbox `allow-forms allow-popups allow-same-origin allow-scripts` admin / no same-origin checkout (extension-host 17, 26); `GET /app-store/installations/:id/embed-session` → scoped bearer + context (1134–1230); bridge fetch restricted to `POST /v1/app-store/bridge/fetch`, GET-only paths (136–147) |
| Compliance topics | Real | mandatory webhook topics above — Shopify-parity GDPR webhooks |
| Tests | Present (3) | `tests/app-platform/{extension-manifest,lifecycle,app-bridge}.test.mjs` — schema/normalization assertions |

## Missing / gaps (with evidence)

| Gap | Severity | Evidence |
|-----|----------|----------|
| **Theme app-block auto-surfacing**: installs write `app_extension_registrations`, but the storefront renders blocks only from `section.blocks` in theme data; no storefront query of the registry exists. Installed app ⇒ nothing visible until merchant manually edits theme. The install→storefront chain is unproven. | High | `app-block-slot.tsx:8,18-27`; absence of registry query under `apps/storefront-runtime/src/` |
| **No app CLI / SDK**: developers hand-craft manifest JSON and call OAuth endpoints; developer-portal documents this and self-labels `[SKIP - NEEDS SDK/CLI]` | High | `apps/developer-portal/src/lib/reference.ts`; no bin/ in any package |
| Manifest types not exported to api-client (server-side Zod only) — drift risk for app developers | Medium | `packages/typescript/api-client/src/index.ts` (no LetbuyyAppManifest export) |
| Outbox dispatcher trigger not visible (no cron/route found invoking `dispatchBatch`) — cadence of app lifecycle webhooks unproven | Medium | `src/execution/outbox-execution.adapter.ts` (claim via RPC `claim_outbox_events`, 120 s lock) — no scheduler reference found |
| App review/listing moderation workflow tables exist (`marketplace_review_records`) but no reviewer UI found beyond platform-console scaffold | Medium | baseline tables; platform-console status |
| Checkout UI extensions: registry + retrieval route exist; no storefront checkout page integration found rendering them | Medium | extension-host 228–265; storefront checkout components |
| Billing INR-only, Razorpay-centric | Low (strategic) | `app_billing_charges.currency`; payout rails |

## Shopify app-platform parity snapshot

Parity present: OAuth+scopes, mandatory compliance webhooks, HMAC signing, app billing with revenue share, embedded admin apps, extension targets, WASM functions (analog of Shopify Functions).
Parity absent: CLI/dev tooling, app extension auto-injection into themes, checkout extension rendering, public app store review pipeline, partner dashboard (portal is docs-only), multi-currency billing.
