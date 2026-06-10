# Developer Feature Gap Analysis (Phase 7)

> Classification of every developer-platform capability vs Shopify. Status reflects what is **actually usable by an external developer in the Developer App** (not merely whether a backend route exists). A capability whose backend exists but has no developer UI/tooling is a **gap**, because a developer cannot use it.
>
> Status: ✅ usable · 🟡 partial (backend-only or no UI) · 🟥 missing. Priority: **CRITICAL / IMPORTANT / NICE-TO-HAVE**.

## CRITICAL MISSING (a developer is blocked or cannot self-serve)

| # | Capability | LetBuyy today | Evidence | Why critical |
|---|---|---|---|---|
| C1 | **CLI / scaffolding** | 🟥 None. No `@letbuyy/cli`, no `create-letbuyy` | `developer-surface.ts` `sdkToolingGaps`; `reference.ts` sdkGuides "LetBuyy CLI: SKIP" | No local dev loop; every workflow is manual cURL/JSON authoring |
| C2 | **Interactive API explorer / GraphiQL** | 🟥 None | no explorer component anywhere | Cannot try calls without writing a client; Shopify ships GraphiQL |
| C3 | **OpenAPI / machine-readable schema** | 🟥 Not checked in | portal: "OpenAPI export is not present"; repo grep confirms none | No codegen, no Postman import, no typed clients |
| C4 | **API key / credential management UI** | 🟡 Rotate route exists; **no inventory/reveal/revoke UI** | `dashboardSurfaces` "Credential management UI — [SKIP — NEEDS UI]"; `/dashboard` API-keys panel `[SKIP]` | Developers can't see or rotate their own keys in a UI |
| C5 | **Single coherent docs IA** | 🟥 Two duplicate page systems, conflicting nav, half unstyled | UI/UX + IA audits | Broken first impression = no trust = no adoption |
| C6 | **Quickstart / "first app" path** | 🟥 None (reference only) | no `get-started` route | Nothing converts a curious dev into a building dev |
| C7 | **Published client SDK(s)** | 🟡 Only `createLetbuyyAppSdk` (server, scoped reads + metadata) | `api-client/src/index.ts:1726` | No browser App Bridge SDK; no multi-language libs |
| C8 | **Working app media upload** | 🟥 Uploaders are placeholder divs | `apps/new/page.tsx` | Can't complete a real, listable app submission |

## IMPORTANT MISSING (self-serve exists elsewhere but not for developers; or major DX hole)

| # | Capability | LetBuyy today | Evidence | Why important |
|---|---|---|---|---|
| I1 | **Webhook test sender / delivery log UI** | 🟥 Dispatch is internal-only; no dev test endpoint | `webhookDeliveryRules` "Internal dispatch routes — SKIP"; `sdkToolingGaps` | Devs can't simulate or inspect deliveries |
| I2 | **Self-serve webhook subscription management** | 🟡 Operations endpoints exist but are merchant/ops-gated | `operations` route group; `dashboardShell` | No developer UI to manage topics/endpoints |
| I3 | **Development store create/manage** | 🟡 Appears in partner aggregate; no create flow in dev app | `dashboard/page.tsx` dev-stores read-only | Can't spin up a sandbox to test installs |
| I4 | **Developer analytics (installs funnel, API traffic)** | 🟥 `[SKIP - NEEDS BACKEND]` | `/dashboard` Analytics panel | No visibility into app health/usage |
| I5 | **Docs search** | 🟥 None | no search component | Reference is large; unbrowsable without search |
| I6 | **Persistent sidebar + in-page TOC** | 🟥 Flat top-bar only | `PortalChrome`/`DeveloperHeader` | Long reference pages have no wayfinding |
| I7 | **Error-code catalog + handling guide** | 🟡 Codes scattered, no consolidated page | `gatewayResponseContracts`, payment matrix | Devs can't program against errors confidently |
| I8 | **App versioning / release management** | 🟥 None in dev app | n/a | Shopify Dev Dashboard has versions; LetBuyy submits once |
| I9 | **Write-capable app bridge** | 🟥 GET-only proxy | `app-store.ts:781`; `appBridgeFetchRules` | Embedded apps can read but not write via bridge |
| I10 | **Docs ⇄ Console cross-links / unified shell** | 🟥 Two apps, no links | IA audit | Devs can't move between learning and doing |
| I11 | **Changelog / API version policy page** | 🟥 None (`X-LetBuyy-API-Version` exists) | `gatewayFacts` | No way to track breaking changes |
| I12 | **Pricing/revenue/payout docs page** | 🟡 Only inside register wizard step | `register/page.tsx` | Monetization terms buried |
| I13 | **Support / status / contact entry point** | 🟥 None | n/a | No escalation path builds distrust |

## NICE-TO-HAVE

| # | Capability | LetBuyy today | Note |
|---|---|---|---|
| N1 | Language tabs + copy buttons on code | 🟥 | Static `<pre>` only |
| N2 | Postman/Insomnia collection | 🟥 | Falls out of C3 (OpenAPI) |
| N3 | Sample apps / starter repos | 🟥 | Pairs with C1/C7 |
| N4 | Extension UI design system (Polaris-equivalent) | 🟥 | For consistent app/extension UIs |
| N5 | Webhook delivery replay (developer-facing) | 🟡 | Ops-only today |
| N6 | EventBridge/PubSub webhook delivery | 🟥 | HTTPS-only today |
| N7 | Granular partner roles/teams | 🟡 | `app_collaboration` scope + collaborator code exist; no team UI |
| N8 | Dark/light theme toggle, i18n of docs | 🟥 | Tokens exist; no toggle |

## What is genuinely DONE (credit where due — these are not gaps)

| Capability | Status | Evidence |
|---|---|---|
| OAuth 2.0 auth-code + **PKCE S256** | ✅ | `app-store.ts:1140/1225/1312`; `oauthTokenLifecycle` |
| Refresh-token rotation, token-exchange, embed sessions | ✅ | `oauthTokenLifecycle` |
| Scoped server app API `/v1/app/*` | ✅ | `app-api.ts`; `contractCards` "Scoped app API" |
| HMAC-signed webhooks + mandatory GDPR compliance topics | ✅ | `app-lifecycle-dispatch.ts`; `webhookTopics` |
| Webhook retry w/ backoff (120s→3600s, ≤8) | ✅ | `webhookDeliveryRules` |
| App submission + manifest validate + quality gate ("Built-for-LetBuyy") | ✅ (backend) | `app-engine`; `appQualityGateChecks` |
| Theme JSON-contract bundle + upload + review | ✅ | `theme-bundle.ts`; `themeUploadGatewayContracts` |
| Extensions/Functions registry (Admin/Checkout UI, theme app blocks, Wasm) | ✅ (backend) | `sdkGuides` "App manifest and extensions" |
| Advisory checkout functions (discount/shipping/payment/validation) | ✅ | `sdkGuides`; `appQualityGateChecks` |
| App charges / billing (INR, GST, payouts, Razorpay proof) | ✅ | `dashboardSurfaces` charges/approve |
| Functional Partner Console with live data | ✅ | `app-marketplace/.../developers/dashboard` |
| Query-cost rate limiting + `X-RateLimit-*` | ✅ | `rateLimitFacts`; `rateLimit.ts` |
| Hash-only credential storage, show-once secrets | ✅ | `contractCards`; `sdkGuides` "Partner API keys" |

## Gap summary

- **8 CRITICAL** gaps — all are **developer-facing tooling/experience** (CLI, explorer, OpenAPI, key UI, IA, quickstart, SDKs, upload), **not backend capability**.
- **13 IMPORTANT** gaps — mostly missing **UIs over routes that already exist** (webhooks, dev stores, analytics, versioning, support).
- The backend is ~80% Shopify-parity; the developer experience is ~20%. **The entire gap is on the surface the developer actually touches.** That is good news for cost: most fixes are front-end + tooling on a capable backend.
