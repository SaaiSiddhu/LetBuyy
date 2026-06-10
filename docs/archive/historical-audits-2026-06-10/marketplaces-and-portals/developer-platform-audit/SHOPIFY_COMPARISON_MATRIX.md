# Shopify Developer Platform Benchmark — Comparison Matrix (Phase 2)

> Scope: **LetBuyy Developer App only** — `apps/developer-portal` (docs/reference) + the developer-facing slice of `apps/app-marketplace` (`/developers/*`, `/my-apps`) and the gateway/services they document. Merchant, consumer, theme-editor, and admin apps are out of scope except where they back a developer capability.
>
> Method: every LetBuyy claim below is grounded in source read during this audit (file paths cited). Shopify claims are from current Shopify developer documentation (sources listed at the end).
>
> Legend: ✅ Built & usable · 🟡 Partial / backend-only / no UI · 🟥 Missing · 📄 Documented only (no tooling)

---

## 0. Executive scoreboard

| Dimension | LetBuyy | Shopify | Gap |
|---|---|---|---|
| Backend API surface (commerce/app/theme) | ✅ Large, real (`/v1`, ~30 route groups) | ✅ | **Near parity** |
| OAuth 2.0 + token lifecycle | ✅ Auth-code + PKCE S256, refresh rotation, token-exchange | ✅ | Parity (LetBuyy strong) |
| Webhooks (signing/compliance) | ✅ HMAC + mandatory GDPR topics | ✅ | Parity on contract; 🟥 on tooling |
| Developer onboarding | 🟡 Register wizard, no guided "hello world" | ✅ CLI `create` → running app in minutes | **Large** |
| CLI / scaffolding | 🟥 None (explicitly skipped) | ✅ First-class | **Critical** |
| API explorer / GraphiQL | 🟥 None | ✅ GraphiQL (Admin + Storefront) | **Critical** |
| SDKs (client libraries) | 🟡 1 minimal server wrapper | ✅ JS/Ruby/Python/PHP + App Bridge | **Large** |
| Developer dashboard (live) | ✅ Partner Console (real data) **but** 🟥 a second *fake* shell exists in the docs portal | ✅ Dev Dashboard | Parity on data; **trust risk** from duplication |
| API keys / credential UI | 🟡 Rotate route exists; **no inventory/revoke UI** | ✅ | **Important** |
| Documentation quality | 🟡 Honest + source-backed, but reference-only, no tutorials/quickstart, half **unstyled** | ✅ Tutorials, quickstarts, references | **Large** |
| Information architecture | 🟥 Two duplicate page systems, conflicting nav | ✅ Single coherent IA | **Critical (trust)** |
| Distribution / app review | ✅ Submission + quality gate + review records (backend) | ✅ | Parity on backend; 🟡 UI thin |
| Billing / revenue / payouts | ✅ App charges, INR, GST, payout ledger | ✅ | Parity (India-localized) |

**One-line verdict:** LetBuyy has a *Shopify-class backend* wrapped in a *pre-alpha developer experience*. The platform can technically host an app; it cannot yet help a developer **discover, build, test, or trust** their way to shipping one without hand-holding.

---

## 1. Developer onboarding

| | LetBuyy | Shopify |
|---|---|---|
| Entry point | `apps/app-marketplace/.../developers/page.tsx` marketing page → `/developers/register` 3-step wizard (Company → Business → Agreements) | Partner/Dev Dashboard signup → `shopify app dev` running locally in minutes |
| First "hello world" | 📄 None. Docs say the path is "author JSON against schemas, validate manifest, submit, verify OAuth" (`sdk/page.tsx`) | ✅ `npm init @shopify/app@latest` scaffolds a running app |
| Time-to-first-call | High (manual cURL against `/v1`) | Low (CLI + GraphiQL) |
| Guided/interactive | 🟥 No | ✅ CLI prompts, templates |

**Gap:** No scaffold, no runnable starter, no "first request in 5 minutes." Onboarding is a registration form, not a build experience.

## 2. App creation

| | LetBuyy | Shopify |
|---|---|---|
| Create app | `/developers/apps/new` form → `POST /api/developers/apps` → gateway `submitDeveloperApp` | `shopify app create` / Dev Dashboard |
| Manifest | ✅ `POST /v1/app-store/developers/apps/manifest/validate` (app-engine `2026-06-05.ws13`) | ✅ `shopify.app.toml` |
| Icon/screenshot upload | 🟥 **Non-functional** — the icon/screenshot zones in `apps/new/page.tsx` are styled `<div>`s with no file input; only text fields are POSTed | ✅ |
| Auto-slug, draft/submit | ✅ slug auto-gen, `save_as_draft` | ✅ |

**Gap:** Media upload is fake UI; app creation is a single web form with no local project, versioning, or config-as-code.

## 3. API discovery

| | LetBuyy | Shopify |
|---|---|---|
| Reference | 📄 Static curated tables (`/api`, `/api-reference`) listing route groups + endpoints with source refs | ✅ Full per-operation reference (Admin/Storefront GraphQL + REST) |
| OpenAPI / schema | 🟥 None checked in (confirmed; portal states "OpenAPI export is not present in this branch") | ✅ GraphQL introspection + schemas |
| Search | 🟥 No search on the portal | ✅ Doc + schema search |
| Two conflicting API pages | 🟥 `/api` and `/api-reference` both claim to be "the API reference" and **disagree** (e.g., `/api-reference` lists a GraphQL route group; `/api` omits GraphQL entirely) | ✅ Single source |

## 4. Authentication & 5. API keys

| | LetBuyy | Shopify |
|---|---|---|
| OAuth | ✅ Auth-code + **PKCE S256**, 15-min codes (hash-stored), refresh rotation, merchant-session token-exchange, embed sessions (`app-store.ts`) | ✅ OAuth + managed installation |
| Scopes | ✅ `read_products/orders/customers/themes/storefront`, `write_themes`, `app_collaboration`; checked vs `api_scopes` | ✅ + optional scopes via TOML |
| Token storage | ✅ Hash-only; show-once secrets | ✅ |
| Credential UI | 🟡 `POST .../developers/apps/:id/api-key` rotates a show-once key **backend-only**; the portal Dashboard explicitly marks key inventory/reveal/rotation/revoke as `[SKIP - NEEDS BACKEND]` | ✅ Dashboard credential management |

**Note:** LetBuyy's OAuth contract is genuinely strong — arguably the best-developed part of the platform. The weakness is purely the **absence of a UI** to see/manage keys.

## 6. Webhooks

| | LetBuyy | Shopify |
|---|---|---|
| Signing | ✅ HMAC-SHA256 over `timestamp.rawBody`, `X-LetBuyy-Hmac-SHA256: v1=…` (+ legacy alias) | ✅ `X-Shopify-Hmac-Sha256` |
| Compliance topics | ✅ Mandatory `customers/data_request`, `customers/redact`, `shop/redact` always added | ✅ Same (LetBuyy mirrors Shopify's GDPR topics) |
| Delivery/retry | ✅ Exponential backoff 120s→cap 3600s, attempts 0–8 | ✅ |
| Delivery methods | 🟡 HTTPS only | ✅ HTTPS + EventBridge + Pub/Sub |
| Test sender | 🟥 None public (dispatch routes are internal-only) | ✅ CLI `webhook trigger` |
| Self-serve subscription UI | 🟥 None for developers (operations endpoints are merchant/ops-gated) | ✅ TOML + API |

## 7. Testing / dev stores / sandbox

| | LetBuyy | Shopify |
|---|---|---|
| Development stores | 🟡 `development_stores` appear in Partner dashboard aggregate, but **no create/manage dev-store flow in the developer app** | ✅ Create dev stores on any plan |
| Local dev / hot reload | 🟥 None (no CLI) | ✅ `shopify app dev` |
| Test data / sandbox | 🟥 None documented | ✅ |
| Webhook/Function logs | 🟥 None for developers | ✅ In Dev Dashboard + `app logs` |

## 8. Documentation

| | LetBuyy | Shopify |
|---|---|---|
| Quickstart | 🟥 None | ✅ |
| Tutorials / guides | 🟥 None (reference tables only) | ✅ Extensive |
| Reference | 📄 Curated, source-backed, **honest** | ✅ Generated, exhaustive |
| Examples | 🟡 A few request/response snippets | ✅ Copy-paste + runnable |
| Rendering quality | 🟥 4 of the richest pages (`/api`,`/oauth`,`/webhooks`,`/sdks`) reference ~30 CSS classes **defined nowhere** → unstyled tables/grids | ✅ Polished |
| Voice | 🟥 Internal jargon leaks ("D0 app", "SKIP — NEEDS BACKEND/SDK", source `file.ts:1225` refs) | ✅ Developer-facing prose |

## 9. API Explorer / 10. GraphQL Explorer

| | LetBuyy | Shopify |
|---|---|---|
| Interactive explorer | 🟥 None | ✅ GraphiQL (Admin + Storefront), read-only demo, Documentation Explorer |
| GraphQL status | 🟡 Admin + Storefront GraphQL mounted behind gateway w/ query-cost limiting; **portal under-documents it** (one page lists it "Partial", the other omits it) | ✅ Primary API (GraphQL-only for new apps since Apr 2025) |
| "Try it" auth | 🟥 No | ✅ CLI GraphiQL uses app's scopes |

## 11. Developer analytics

| | LetBuyy | Shopify |
|---|---|---|
| Install funnel / API traffic | 🟥 Portal marks Analytics `[SKIP - NEEDS BACKEND]` | ✅ |
| App performance metrics | 🟡 Quality gate reads Lighthouse score at submit; no ongoing dashboard | ✅ |
| Partner aggregate | ✅ `GET /v1/app-store/partners/dashboard` (installs, uninstalls, earnings) surfaced in Partner Console | ✅ |

## 12. Partner Dashboard / 13. Revenue / 14. Billing

| | LetBuyy | Shopify |
|---|---|---|
| Dashboard | ✅ **Functional** Partner Console (`app-marketplace/.../developers/dashboard`) with live installs/earnings/payouts/GST/ratings/reviews/dev-stores/collaborator code | ✅ Dev Dashboard |
| **Duplicate fake dashboard** | 🟥 The **docs portal** ships a *separate* `/dashboard` "shell" describing a dashboard that already exists — confusing and trust-eroding | — |
| Revenue share | ✅ Stated **15%** commission (net-85) | 0% first $1M lifetime, then 15% (+2.9% processing, $19 one-time) |
| Payouts | ✅ INR payout ledger, GST evidence, UPI/bank (India-localized) | ✅ Region-based |
| App charges/billing | ✅ `installations/:id/charges` + approve w/ Razorpay proof, `app.charge.activated` | ✅ Billing API |

**Note:** India-localized monetization (INR, GST, UPI) is a genuine differentiator vs Shopify's defaults.

## 15. App distribution / 16. Submission / 17. Reviews

| | LetBuyy | Shopify |
|---|---|---|
| Submission | ✅ `POST /v1/app-store/developers/apps` (+ manifest validate) | ✅ |
| Quality gate | ✅ "Built-for-LetBuyy": Lighthouse ≥70, ≥1 review @4.0+, ≥1 install, ≥1 storefront app block, HTTPS URLs | ✅ "Built for Shopify" |
| Review records | ✅ Automated checks (schema, profile, quality gate) + `app.submitted`; statuses draft/in_review | ✅ Draft→Submitted→Reviewed→Published |
| Listing editor | 🟡 Single form; no rich listing builder, no screencast field, no localization | ✅ Full listing builder |

## 18. CLI / 19. SDKs / 20. Tooling

| | LetBuyy | Shopify |
|---|---|---|
| CLI | 🟥 **None** — no `@letbuyy/cli`, no `create-letbuyy` (portal states this plainly) | ✅ `shopify` CLI |
| Client SDKs | 🟡 Only `createLetbuyyAppSdk` in `@letbuyy/api-client` (server-side scoped reads + metadata write) | ✅ JS/TS, Ruby, Python, PHP |
| Browser App SDK / App Bridge | 🟥 None published (capabilities `api.fetch/toast/resize` listed but no package) | ✅ App Bridge (React) |
| Scaffolds/templates | 🟥 None | ✅ Remix template + extensions |

## 21. Extension system / 22. App marketplace

| | LetBuyy | Shopify |
|---|---|---|
| Extension model | ✅ Manifest + registry: Admin UI, Checkout UI, theme app blocks (WS11 portable Liquid), Wasm Functions | ✅ Admin/Checkout/Customer/Theme/POS UI + Functions |
| Checkout functions | ✅ **Advisory-only** (apply discount/shipping/payment/validation; cannot set totals/taxes/prices) | ✅ Shopify Functions (discounts/delivery/payment/cart) |
| App bridge | 🟡 **GET-only** read proxy (`bridge/fetch`); writes `[SKIP]` | ✅ Full |
| Marketplace | ✅ Catalog, install/uninstall, reviews, categories, app blocks in storefront slots | ✅ App Store |
| Design system for extensions | 🟥 No Polaris-equivalent for app/extension UIs documented for developers | ✅ Polaris (web components, stable 2025) |

---

## Category roll-up score (0–5; 5 = Shopify parity)

| Category | Score | Category | Score |
|---|---:|---|---:|
| Onboarding | 1 | API Explorer | 0 |
| App creation | 2 | GraphQL Explorer | 0 |
| API discovery | 2 | Dev analytics | 1 |
| Authentication | 4 | Partner dashboard | 3 |
| API keys | 2 | Revenue | 4 |
| Webhooks | 3 | Billing | 4 |
| Testing/dev stores | 1 | Distribution | 3 |
| Documentation | 2 | Submission | 3 |
| Reviews | 3 | CLI | 0 |
| SDKs | 1 | Tooling | 1 |
| Extension system | 3 | Marketplace | 3 |
| IA/coherence | 1 | Trust/polish | 1 |

**Average ≈ 2.1 / 5.** Backend-heavy categories (auth, billing, webhooks, extensions) score well; everything a developer *touches directly* (CLI, explorers, onboarding, docs polish, IA) scores poorly.

---

## The decisive insight

LetBuyy is, by design, a **close architectural clone of Shopify's app platform** — the compliance topics, scope names, "Built-for-X" quality gate, theme app blocks, and advisory checkout functions are near-1:1. That means the gap is **not** capability; it is **developer experience surface area**. Closing it is mostly front-end/tooling work (CLI, explorer, SDK, IA consolidation, CSS) on top of an already-capable backend — a far cheaper path than building the backend itself.

---

### Sources (Shopify, current)
- [Dev Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard) · [Migrate from Partner Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard/migrate-from-partners) · [2025 Partner Program updates](https://www.shopify.com/partners/blog/updates-to-the-shopify-partner-program)
- [Shopify CLI — app commands](https://shopify.dev/docs/api/shopify-cli/app) · [About Shopify CLI for apps](https://shopify.dev/docs/apps/build/cli-for-apps)
- [Revenue share for App Store developers](https://shopify.dev/docs/apps/launch/distribution/revenue-share) · [Revenue share changelog](https://shopify.dev/changelog/update-to-shopifys-app-developer-revenue-share)
- [GraphiQL for the Admin API](https://shopify.dev/docs/api/usage/api-exploration/admin-graphiql-explorer)
- [Submit your app for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review) · [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
- [Checkout UI extensions](https://shopify.dev/docs/api/checkout-ui-extensions/latest) · [Polaris (web, 2025)](https://www.shopify.com/partners/blog/polaris-goes-stable-the-future-of-shopify-app-development-is-here) · [App surfaces](https://shopify.dev/docs/apps/build/app-surfaces)
- [About webhooks](https://shopify.dev/docs/apps/build/webhooks) · [Manage access scopes](https://shopify.dev/docs/apps/build/authentication-authorization/app-installation/manage-access-scopes)

### Sources (LetBuyy, this repo)
`apps/developer-portal/src/lib/developer-surface.ts`, `…/lib/reference.ts`, `…/components/_local-ui/developer-docs.tsx`, `…/components/PortalChrome.tsx`, `…/app/{page,api,api-reference,oauth,webhooks,sdk,sdks,docs,dashboard}/page.tsx`, `…/app/globals.css`; `apps/app-marketplace/src/app/(auth)/developers/{page,register/page,dashboard/page,apps/new/page}.tsx`, `…/api/developers/*`, `…/lib/api/client.ts`; `services/api-gateway/src/routes/app-store*`, `services/webhook-service/src/*`, `packages/typescript/api-client/src/index.ts`, `packages/typescript/ui/src/*`.
