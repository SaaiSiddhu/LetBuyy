# Apps Feature Gap Analysis (Phase 7)

**Parent:** [`../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md`](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md) · **Date:** 2026-06-07

Gaps vs. a production app ecosystem (Shopify-class), classified **CRITICAL MISSING / IMPORTANT MISSING / NICE-TO-HAVE**. A key distinction runs through this report: **"backend exists, no UI"** (cheap to close — wire the SDK method) vs **"nothing exists"** (real build). Of 26 `appStore` SDK methods, **10 are never called by the front-end** — much of the "missing" surface is actually un-wired, not un-built.

## A. Backend-exists / UI-missing (cheapest wins)

These have working gateway endpoints **and** `@letbuyy/api-client` methods, but no marketplace UI calls them:

| Capability | SDK method → endpoint | Status |
|---|---|---|
| OAuth install/authorize | `oauthAuthorize`,`oauthToken`,`oauthTokenExchange` → `billing-oauth-routes.ts:530,725,920` | UI never calls; flag-on path **throws** |
| App billing charges | `createCharge`,`approveCharge` → `billing-oauth-routes.ts:62,208` | **No charge UI anywhere** |
| Extension/function management | `extensionRegistry`,`updateExtensionRegistration`,`updateFunctionRegistration` → `extension-routes.ts:73,149,223` | UI is a 22-line stub |
| Embedded admin session | `embedSession` → `extension-routes.ts:297` | `embedUrl` hardcoded null |
| Scoped data bridge | `bridgeFetch` → `extension-routes.ts:397` | unused |
| Public developer profile | `developer-routes.ts:842` (`GET /developers/:id`) | page is a placeholder |

**These six clusters are the highest-leverage fixes in the entire marketplace:** the platform already does the hard part.

## B. CRITICAL MISSING (nothing exists; blocks launch)

| Gap | Evidence | Impact |
|---|---|---|
| **App update / versioning** — no endpoint, no `app_versions` table; `version` never bumped | `dashboard:309`; schema | Developers can never ship v2; merchants never get fixes |
| **Payout settlement** — ledger only ever `pending`; no transfer execution | `queue-execution.adapter.ts:474` | Developers never get paid |
| **Single revenue-share rate** — code 20% vs docs 15% vs UI "pending" | `billing-core:269` | Economics undefined; legal/financial risk |
| **Self-serve developer approval** — no `pending→approved` endpoint | `rbac.ts:55` | Onboarding requires manual DB edits |
| **Catalog seed / launch partners** — empty catalog | `page.tsx:274` | No reason for either side to show up |
| **Real submission checks** — automated checks hardcoded to passed | `developer-routes.ts:683` | No safety gate before human review |
| **Working app media upload** — icon/screenshot boxes are dead UI | `apps/new:233-246` | Listings can't have required media |
| **Registration data integrity** — GSTIN + consent dropped client-side | `register:46-52` | Can't pay (no tax id) or prove consent |

## C. IMPORTANT MISSING (degrades the ecosystem materially)

| Gap | Evidence |
|---|---|
| Install/revenue **analytics** (time-series, per-app, funnel) — only a snapshot in `partnerDashboard` | `developer-routes.ts:517` |
| **Pricing plans/tiers** — flat price only; no named plans, no feature gating | schema (`pricing_model`+price only) |
| **Usage metering** endpoint for `usage` billing mode | `billing-core:69` (mode exists, no meter) |
| **Trial** support in app billing | `billing-core:80` |
| **Developer webhook management** (register/list/update/delete) | `app_webhooks` read-only, no writer |
| **Review replies** by developers; **abuse reporting** (buttons disabled) | `apps/[slug]:493,617` |
| **Compare apps** / alternatives / recommendations | none |
| **Real collections/curation** + `/collections` index | `collections/[slug]:13` |
| **All categories visible** in search (14 hidden) | `search/page.tsx:154` |
| **"Built for LetBuyy" quality program** (perf/design/integration) + backing column | `marketplace-display.ts:49` |
| **Security scanning** of submissions | none |
| **Agency/collaborator** model (code is non-functional) | `shared.ts:242` |
| **Granted-scope review & revocation** post-install for merchants | `my-apps` lacks it |
| **App health/status** surfaced to merchants | `status_url` read but not featured |
| **Rate-limit accounting** per app/install + dedicated OAuth brute-force limit | `index.ts:543` |
| **Real RLS** on the 7 core tables (currently service-role blanket only) | `000_baseline.sql:24311+` |
| **Support/ticketing** between merchants and developers | none |

## D. NICE-TO-HAVE

Saved/wishlist apps; recently-viewed; partner tiers/badges; app bundles & multi-app discounts; merchant spend caps/alerts; uninstall-reason capture; demo/sandbox stores; multi-currency display; real experiment framework (current `experiments.ts` ignores its argument); editorial "new this week"; cross-store review proof; deeper i18n (only 5 strings today).

## E. Schema gaps behind the features

Confirmed absent (grep over `database/`): `app_versions`/release history; install/usage **event** analytics tables; rate-limit/quota accounting; `app_pricing_plans`/tiers; support/ticketing; persisted OAuth codes/tokens. Note also: `app_webhooks` has **no writer** (effectively dead), and `partner_payout_ledger_entries.charge_id`/`source_event_id` are `NOT NULL` but carry **no FK** (integrity gap).

## F. Prioritized close-out

1. **Wire what already exists (A):** charge UI, extension management, OAuth install, embed session, public developer profile, bridge. Days-to-weeks, not months.
2. **Build the CRITICAL eight (B):** update/versioning, payout settlement, one revenue rate, self-serve approval, catalog seed, real submission checks, media upload, registration integrity.
3. **Then the IMPORTANT set (C),** roughly in the order: analytics → pricing plans → usage metering/trials → webhook mgmt → reviews/abuse → discovery (compare/collections/categories) → quality program → security → RLS hardening.

The single most important realization: **LetBuyy's gap is less "build a platform" and more "finish wiring and operationalizing the platform you already built."**
