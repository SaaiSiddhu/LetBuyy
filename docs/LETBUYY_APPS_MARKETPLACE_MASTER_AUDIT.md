# LetBuyy Apps Marketplace — Master Audit

**Scope:** `apps/app-marketplace` (the Next.js storefront + developer surfaces) and the backend it directly depends on: the app-store routes in `services/api-gateway/src/routes/app-store/*` and `app-api.ts`, the `@letbuyy/api-client` `appStore` namespace, the `marketplace_*`/`app_*` schema in `database/supabase/migrations/`, and the marketplace design system. Other apps (merchant, storefront, themes, developer-portal, identity, platform-console) are referenced only where they directly affect the Apps Marketplace.

**Benchmark:** Shopify App Store (current, June 2026, web-verified) with side glances at Atlassian Marketplace (Forge), Stripe Apps, and Cloudflare.

**Method:** Full read of all 59 marketplace front-end source files (~5,167 LOC TS/TSX), the 33 app-store/app-api gateway endpoints (~150 KB across `app-store/*.ts`) plus the `app-auth` middleware and OAuth/billing helpers in `@letbuyy/auth-core`, `@letbuyy/billing-core`, `@letbuyy/app-engine`, the 12 marketplace/app tables in `database/supabase/migrations/000_baseline.sql` + `076_app_extension_registry.sql`, and `globals.css`. No build or runtime was exercised; UI/responsiveness assessed from source. Every code claim is cited by file (and line where useful).

**Date:** 2026-06-07 · **Supersedes:** the 2026-06-06 edition (full regenerate; git retains the prior version).

> This master document carries the cross-cutting findings — verdict, architecture, the nine lifecycle flows, merchant experience (Phase 3), developer experience (Phase 4), the Top-100 issue register (Phase 17), and the brutal review (Phase 18). The thirteen phase sub-reports live in [`docs/apps-marketplace-audit/`](apps-marketplace-audit/) and are linked in [§11 Sub-report index](#11-sub-report-index).

---

## 0. The one-paragraph verdict

LetBuyy has built a **credible, Shopify-shaped app *platform* underneath an honest-but-hollow app *marketplace*.** The backend is real and unusually complete for a pre-launch product: a Supabase-backed catalog with denormalized install/rating counts maintained by real DB triggers; OAuth 2.0 authorize/token/refresh with PKCE (S256) and HS256 app-scoped tokens whose scopes are genuinely enforced; an app-billing API with merchant-approval semantics and Razorpay payment verification; an extension/function registry with three surfaces, three renderers and WASM functions; the **three mandatory GDPR compliance webhooks Shopify requires**; idempotent install/uninstall; and a partner payout ledger with Indian GST. That is far beyond a prototype. But the marketplace sitting on top is a **thin client that (a) has no apps in it** — there is zero catalog seed data and the home page says so in plain language; **(b) surfaces only ~60% of the platform it sits on** — 10 of 26 `appStore` SDK methods (OAuth, billing charges, extension management, embed sessions) are never called by any UI; **(c) ships visible "governance theater"** — placeholder pages that literally print their own feature-flag *names* on screen, three "collections" that just re-sort the same empty catalog and admit it in their own copy, dead icon/screenshot upload boxes, and a registration form that silently drops the GSTIN and consent checkboxes it collects; **(d) cannot update or version a published app at all**, because no update endpoint exists and the dashboard says editing is "gated on the app-update contract"; **(e) never actually pays a developer** — payout ledger rows are written as `pending` and nothing ever settles them; and **(f) carries an unresolved economics contradiction** — code bakes in a 20% platform commission while the docs promise 15% and the UI says "pending business approval." A merchant arriving today finds an empty, trustworthy-*looking* store; a developer finds a real API they cannot fully self-serve, cannot ship v2 on, and cannot get paid through. **The platform earns a B−; the marketplace experience earns a D.**

---

## 1. Phase 1 — Application discovery & architecture

### 1.1 What the Apps Marketplace actually is

`apps/app-marketplace` is a **Next.js 16 / React 19 thin client** that renders the storefront (catalog, search, categories, collections, app detail, install) and the developer surfaces (portal, registration, partner console, submit-app, my-apps). It owns **no business logic of record**: every data operation is proxied to the platform API gateway through `@letbuyy/api-client`'s `appStore` namespace via a server-only client (`src/lib/api/client.ts`), and when the gateway is unreachable or unconfigured the UI degrades to an explicit `MarketplaceUnavailable` state rather than fabricating data (`src/lib/app-service.ts:55,73`; `src/components/MarketplaceUnavailable.tsx`).

**Front-end inventory — 59 files, ~5,167 LOC:**

| Layer | Files | Notes |
|---|---|---|
| Store pages | `app/page.tsx` (home/directory), `(store)/apps/[slug]`, `(store)/categories`, `(store)/categories/[slug]`, `(store)/collections/[slug]`, `(store)/search`, `(store)/partners` | Catalog, detail, categories, collections, search, partner directory (placeholder) |
| Developer pages | `(auth)/developers`, `/developers/register`, `/developers/dashboard`, `/developers/apps/new`, `/developers/review-requirements`, `/developers/[slug]`, `(auth)/my-apps` | Landing, 3-step registration, partner console, submit-app, review prep (placeholder), public profile (placeholder), installed apps |
| BFF API routes | `api/apps`, `api/apps/search`, `api/apps/[id]`, `api/apps/[id]/install`, `api/apps/[id]/reviews`, `api/developers`, `api/developers/register`, `api/developers/apps` | 8 thin pass-throughs to the gateway; **9 sibling route folders are empty scaffolding** |
| Components | `AppCard`, `AppInstallConsentPanel`, `InstalledAppsGrid`, `ReviewComposer`, `ExtensionConfigPanel` (stub), `ApiKeyPanel`, `CollaboratorCodePanel`, `CategoryGrid`, `StarRating`, `Header`, `Footer`, `MarketplaceUnavailable`, `MarketplaceSkeleton` | |
| Lib | `app-service.ts`, `marketplace-display.ts`, `api/client.ts`, `capabilities.ts` (20 flags), `experiments.ts` (stub), `telemetry.ts` (no sink), `constants/categories.ts` (29 hardcoded), `currency.ts`, `i18n/messages.ts`, `site-url.ts`, `proxy.ts` | |

**The backend it talks to** (`services/api-gateway/src/routes/app-store.ts` + `app-store/*.ts` + `app-api.ts`; **33 endpoints**, ~150 KB) is the real system of record, persisting to **12 tables** (`000_baseline.sql`, `076_app_extension_registry.sql`): `marketplace_apps`, `app_developers`, `app_categories`, `app_extensions`, `app_installations`, `app_reviews`, `app_webhooks`, `app_billing_charges`, `marketplace_review_records`, `partner_payout_ledger_entries`, plus `app_extension_registrations` and `app_function_registrations`. DB triggers keep `install_count`, `rating_avg`, and `review_count` denormalized (`000_baseline.sql:7812-7838`).

### 1.2 Architecture diagram

```mermaid
flowchart TB
  subgraph Client["apps/app-marketplace (Next.js 16 thin client)"]
    P["Store + Developer pages"]
    BFF["/api/* route handlers (8 live, 9 empty)"]
    SVC["AppService + api/client.ts (server-only)"]
    CAP["capabilities.ts (20 flags; 2 wired)"]
  end
  subgraph GW["services/api-gateway (Hono)"]
    AS["/v1/app-store/* (30) + /v1/app/* (3)"]
    MW["authMiddleware + appAuthMiddleware + rbac + verifySiteOwnership"]
  end
  subgraph DATA["Supabase (Postgres)"]
    T[("marketplace_apps, app_developers,\napp_installations, app_reviews,\napp_extensions, app_billing_charges,\nmarketplace_review_records,\npartner_payout_ledger_entries,\napp_extension_registrations(+functions)")]
  end
  OPS["platform-operations-portal\n(review decisions)"]
  Q["queue-workers / webhook-service"]
  P --> SVC --> GW
  P --> BFF --> GW
  AS --> MW --> T
  OPS -->|/operations/marketplace-reviews/:id/decision| T
  AS -->|emitDomainEvent app.installed / app.charge.created / app.charge.activated| Q
  Q -->|writes partner_payout_ledger_entries (status=pending, never settled)| T
```

### 1.3 The nine lifecycle flows

| # | Flow | Reality | Verdict |
|---|---|---|---|
| 1 | **Submission** | `POST /app-store/developers/apps` creates `marketplace_apps` + a `marketplace_review_records` row and emits `app.submitted` (`developer-routes.ts:576,665`). | ⚠️ The four "automated checks" (`schema_validation`, `developer_profile`, `extension_lifecycle_contract`, …) are **hardcoded to `passed`/`warning` regardless of payload** (`developer-routes.ts:683-701`). A `pending` (unapproved) developer can still submit. |
| 2 | **Review** | Operator-only `POST /operations/marketplace-reviews/:id/decision`, gated `requireRoleCategory('ops')` + `requireSuperAdmin` (`operations.ts:320,58`); `approved` → `status='published'`. | ✅ RBAC is real. ❌ But there is **no marketplace UI for this** (it lives in platform-operations-portal) and no automated scanning precedes the human. |
| 3 | **Installation** | `POST /app-store/apps/:id/install` mints an app access token **immediately, with no OAuth/PKCE and no refresh token** (`install-lifecycle-routes.ts:37,128`); UI is the consent modal `AppInstallConsentPanel` → `/api/apps/[id]/install`. Idempotency-key aware. | ✅ Works and has a real consent UI. ⚠️ Two parallel install paths (direct-token vs OAuth) with the simpler one as default. |
| 4 | **Billing** | `POST /installations/:id/charges` → `pending_merchant_approval`; `POST /charges/:id/approve` needs verified Razorpay proof to reach `active`, else `approved` only (`billing-oauth-routes.ts:62,208,410`). Modes: `recurring`/`usage` only — **no one-time, no trial** in app billing (`billing-core:69,80`). | ❌ **No marketplace UI calls `createCharge`/`approveCharge`** — the entire paid-app money path is invisible to merchants and developers. `usage` mode has no metering endpoint. |
| 5 | **Update / versioning** | **Does not exist.** No update or version-publishing endpoint anywhere; `marketplace_apps.version` is never bumped (only `install_count`, `rating_avg`, status, and a one-time `oauth_client_id` backfill ever write the table). | ❌ Dashboard shows a disabled "Edit unavailable" badge: *"Editing and new versions are gated on the app-update contract"* (`developers/dashboard/page.tsx:309-312`). A developer can never ship v2. |
| 6 | **Publishing** | Status transitions to `published` only via the ops decision (flow 2). | ✅ Mechanically works. ❌ No self-serve publish, no staged rollout, no version gate. |
| 7 | **Uninstall** | `DELETE /app-store/apps/:id/install` revokes the token, disables subscriptions, and fires `shop/redact` (`install-lifecycle-routes.ts:257,344`); UI is a `ConfirmDialog` with an explicit data-loss warning (`InstalledAppsGrid.tsx:153-166`). | ✅ One of the cleanest flows in the product. |
| 8 | **Developer revenue / payout** | On `app.charge.activated`, a queue worker inserts a `partner_payout_ledger_entries` row with `status='pending'` (`queue-execution.adapter.ts:458-487`). | ❌ **No code ever sets a ledger entry to `released`/`settled`, and there is no payout execution** (no RazorpayX/Route transfer). The dashboard's "Released" figure reads `status==='released'` and is therefore **always 0** (`developer-routes.ts:527`). Money never moves. |
| 9 | **OAuth handshake** | `POST /apps/:id/oauth/authorize` (PKCE S256) → `POST /oauth/token` (code/refresh) → `POST /oauth/token-exchange` (embedded), fully implemented (`billing-oauth-routes.ts:530,725,920`). | ❌ **No UI calls any of it**; worse, when `NEXT_PUBLIC_MP_OAUTH_INSTALL` is turned on, the consent panel *throws* `"OAuth install is contract-gated until the marketplace BFF route is approved by governance"` (`AppInstallConsentPanel.tsx:90-92`) — the flag-on path breaks install. |

### 1.4 The capability-flag system (the core "shell" mechanism)

`src/lib/capabilities.ts` declares **20** marketplace capabilities, each mapped to a `NEXT_PUBLIC_MP_*` env var. Two are actually consulted in the UI — `featuredRails` (`page.tsx:115`) and `experiments` (`experiments.ts:7`, which ignores its own argument). The other **18 gate nothing**. The two "gated" placeholder pages (`partners`, `developers/[slug]`) don't even branch on their flag — they call `getMarketplaceCapabilityEnv(...)` and render the env-var *name as label text* (e.g. on screen: `Flag: NEXT_PUBLIC_MP_PARTNER_DIRECTORY default off`), so they show "unavailable" unconditionally (`partners/page.tsx:26`, `developers/[slug]/page.tsx:38`). `.env.local` sets none of the `MP_*` flags, so the default surface is the bare minimum.

---

## 2. Phase 3 — Merchant experience audit

| Question | Answer | Evidence |
|---|---|---|
| Can merchants **discover** apps? | Mechanically yes (search/sort/category all wired), but there is nothing to discover — empty catalog, and the home empty state says so. Discovery surfaces over-promise: 29 categories and 3 "collections" all lead to empty grids. | `page.tsx:268-276`; `collections/[slug]/page.tsx:10-29` |
| Can merchants **compare** apps? | No. No compare tray, no side-by-side, no "alternatives," no per-feature comparison. `AppCard` shows rating/installs/price only. | `AppCard.tsx`; no compare component exists |
| Can merchants **trust** apps? | Partially. Honest signals (real rating histogram, "No reviews yet", verified-partner badge sourced from data) are good; but "Built for LetBuyy" reads a `built_for_letbuyy` field with **no DB column** behind it, and there are no install-count proofs of authenticity, no security review surfaced. | `apps/[slug]/page.tsx:251-291,464-506`; `marketplace-display.ts:49-51` |
| Can merchants **understand pricing**? | Mostly. Pricing rows + "merchant approval required" copy are clear; but `usage_based` renders literally as *"Pricing unavailable — Usage billing is not supported yet"* and the pricing taxonomy is inconsistent across display/schema/billing. | `marketplace-display.ts:33-47`; `apps/[slug]/page.tsx:113-171` |
| Can merchants **understand permissions**? | **Yes — this is the strongest merchant surface.** The consent modal lists each scope with a human label + raw code, names the target store, and states billing terms before granting. | `AppInstallConsentPanel.tsx:185-279`; `apps/[slug]/page.tsx:379-408` |
| Can merchants **safely install**? | Yes for the default token path; the modal → `/api/apps/[id]/install` flow is real and session-gated. | `AppInstallConsentPanel.tsx:83-117`; `proxy.ts:9-12` |
| Can merchants **uninstall safely**? | Yes — confirm dialog with data-loss disclosure; backend revokes token, disables subscriptions, fires `shop/redact`. | `InstalledAppsGrid.tsx:153-166`; `install-lifecycle-routes.ts:257` |
| Can merchants **manage an installed app**? | Barely. "My Apps" lists installs and offers uninstall + review, but **Extensions config is a 22-line stub** ("requires an approved BFF route") and per-app Settings is just an external link or a disabled button. | `ExtensionConfigPanel.tsx`; `InstalledAppsGrid.tsx:119-129` |
| Can merchants **judge app quality**? | Weakly. No "Built for LetBuyy" data, no performance/security signals, no developer track record, no update recency they can rely on (no versioning). | §1.3 flow 5; `apps/[slug]/page.tsx` |

**Top merchant friction points:** (1) empty catalog behind a polished shell; (2) categories/collections that lead nowhere; (3) no compare; (4) installed-app management is a stub; (5) trust badges with no data behind some of them; (6) paid billing is invisible (no charge approval UI), so a "recurring" app can be installed but never actually billed through the marketplace. Full detail in [`MERCHANT_TRUST_SCORECARD.md`](apps-marketplace-audit/MERCHANT_TRUST_SCORECARD.md) and [`APP_INSTALLATION_JOURNEY_AUDIT.md`](apps-marketplace-audit/APP_INSTALLATION_JOURNEY_AUDIT.md).

---

## 3. Phase 4 — Developer experience audit

| Question | Answer | Evidence |
|---|---|---|
| Can developers **build** apps? | The platform supports it (manifest schema, 3 extension surfaces, WASM functions, OAuth, app data API `/app/products`,`/app/orders`). | `app-api.ts:152,209`; `app-engine` manifest schema |
| Can developers **register**? | Yes, but the 3-step form **silently drops `tax_id`/GSTIN and both consent checkboxes** — they are collected then never sent (`register/page.tsx:46-52`). India-only. New developers land in `status='pending'`. | `register/page.tsx:46-52,166-173` |
| Can developers **get approved**? | **Not self-serve.** New developers default to `pending` (`app-engine:88`), but the partner dashboard requires `status='approved'`, and **no gateway endpoint transitions `pending → approved`** (`rbac.ts:55-64`). Approval is out-of-band. | partner gating in `developer-routes.ts:369` |
| Can developers **submit** apps? | Yes, with a real manifest validator round-trip — but the icon/screenshot **upload boxes are dead UI** (no file input/handler), there is no scope picker (scopes only via manifest JSON), and "Private app install link" is "(contract-gated)". | `apps/new/page.tsx:233-246,339-358` |
| Can developers **monetize**? | On paper. Charge/approve APIs and a GST-aware payout ledger exist, but **no UI creates charges**, **payouts never settle**, and the **revenue share is contradictory** (code 20% vs docs 15% vs UI "pending"). | `billing-core:269,577`; flow 8 |
| Can developers **update** apps? | **No.** No update/version endpoint; dashboard says editing is "gated on the app-update contract." | §1.3 flow 5 |
| Can developers **manage support**? | No. Only `app_developers.support_email`; no ticketing, no merchant→developer channel, no review replies. | schema: no support tables |
| Can developers **track installs / revenue**? | Partially. The Partner Console shows **real** installs, earnings, pending payouts, GST, ratings from `partnerDashboard()` — but "Released payouts" is structurally always 0, and there is no time-series, no per-app install analytics, no funnel. | `developers/dashboard/page.tsx:107-174` |
| Can developers **understand review requirements**? | No. `/developers/review-requirements` is an explicit placeholder: *"Final policy text requires human approval"* + a `SKIPPED (HUMAN-APPROVAL)` banner, and it's an orphan page (unlinked). | `review-requirements/page.tsx:18,35` |
| Can developers **collaborate** (agencies)? | No. The "collaborator code" is a random `LBP-…` string that is **never persisted and has no redemption endpoint** (`shared.ts:242-244`); the panel displays a dead code. | `CollaboratorCodePanel.tsx`; `developer-routes.ts:544` |

**Bottom line for developers:** a real API they cannot fully reach from the marketplace, cannot get approved on without a human, cannot ship v2 on, and cannot get paid through. Full detail in [`DEVELOPER_TRUST_SCORECARD.md`](apps-marketplace-audit/DEVELOPER_TRUST_SCORECARD.md) and [`APPS_FEATURE_GAP_ANALYSIS.md`](apps-marketplace-audit/APPS_FEATURE_GAP_ANALYSIS.md).

---

## 4. Cross-cutting strengths (credit where due)

These are real and above-prototype quality:

1. **Honest degradation.** No fabricated catalog, reviews, or metrics anywhere; failures surface as `MarketplaceUnavailable`/empty states with candid copy (`app-service.ts`; `page.tsx:270-274`).
2. **Permission/consent UX** rivals Shopify's clarity for the install moment (`AppInstallConsentPanel.tsx`).
3. **Scope enforcement is genuine** — `appAuthMiddleware` validates token-vs-granted scopes and a stored token hash, so revoked tokens fail (`app-auth.ts:78-101`).
4. **OAuth 2.0 with PKCE S256, single-use codes, refresh tokens** — a correct implementation, even if unused by the UI (`billing-oauth-routes.ts`).
5. **The three mandatory GDPR webhooks** are present and auto-subscribed at install (`app-engine:154,1438`) — Shopify rejects apps that lack these; LetBuyy has them at the platform level.
6. **Idempotent install/uninstall/charges** (`install-lifecycle-routes.ts:63-78`).
7. **SEO is strong**: per-app `SoftwareApplication` + `AggregateRating` JSON-LD, sitemap with dynamic app/category entries, robots, OG/Twitter (`layout.tsx`; `apps/[slug]/page.tsx:207-229`; `sitemap.ts`).
8. **Fail-fast configuration** — the API client refuses to fall back to a hardcoded host (`api/client.ts:29`).

---

## 5. Top failure themes (what the 100 issues roll up to)

1. **Empty marketplace** — no seed catalog; every discovery path dead-ends.
2. **Capability theater** — 18 unwired flags; pages that print flag names; "contract-gated" copy everywhere.
3. **Platform-to-UI gap** — 10/26 SDK methods unused; billing, OAuth, extensions, embed sessions invisible.
4. **No app lifecycle v2** — no update/versioning; no changelog source; no staged rollout.
5. **Broken developer economics** — payouts never settle; 15/20% contradiction; approval not self-serve; GSTIN dropped on submit.
6. **Dead/placeholder UI** — upload boxes, report buttons, collaborator codes, review-requirements, partner directory, developer profiles.
7. **Discovery is hardcoded** — 29 categories from a doc, 3 fake collections, 14 categories hidden from search, no real curation/trending/recommendations.
8. **Trust gaps** — `built_for_letbuyy` with no data source; no "Built for LetBuyy" program; no security/perf signals; no developer track record.
9. **Stale domain** — `letbuyy.store` across footer, submit-form slug hint, and auth redirect, versus canonical `letbuyy.com`.
10. **Tenant-model inconsistency & two-tier RLS** — `site_id` vs `store_id`; seven core tables have only `service_role` blanket RLS (no real row isolation).

---

## 6. Phase 17 — Top 100 marketplace issues

Severity: **P0** = blocks launch / data-loss / security; **P1** = major experience or trust failure; **P2** = quality/parity; **P3** = polish. Impact columns: **M** = merchant, **D** = developer (●●● high · ●● med · ● low · ○ none). Citations are representative.

| # | Sev | Issue | M | D | Recommended fix |
|---|---|---|---|---|---|
| 1 | P0 | No app catalog seed data; marketplace is empty | ●●● | ●●● | Seed first-party apps; onboard launch partners before GA |
| 2 | P0 | No app **update/versioning** endpoint; v2 impossible (`dashboard:309`) | ●● | ●●● | Build `PATCH /developers/apps/:id` + `app_versions` table + review-on-update |
| 3 | P0 | Payouts never settle — ledger stuck `pending`, "Released"=0 (`queue-execution.adapter.ts:474`) | ○ | ●●● | Implement RazorpayX/Route transfer + ledger state machine |
| 4 | P0 | Revenue share contradiction: code 20% (`billing-core:269`) vs docs 15% vs UI "pending" | ○ | ●●● | Set one rate in code, docs, and UI; publish before paid launch |
| 5 | P0 | Developer approval not self-serve; no `pending→approved` endpoint (`rbac.ts:55`) | ○ | ●●● | Add review/approval endpoint + ops UI + applicant status page |
| 6 | P0 | Registration drops `tax_id`/GSTIN + consent flags (`register:46-52`) | ○ | ●●● | Send all fields; persist consent with timestamp/version |
| 7 | P0 | Submission "automated checks" hardcoded to `passed` (`developer-routes.ts:683`) | ●● | ● | Run real manifest/scope/URL/security checks before queueing |
| 8 | P0 | No dedicated rate limit on `/oauth/token`,`/authorize`,`/bridge/fetch` (`index.ts:543`) | ● | ● | Add strict per-client brute-force limiter like `/auth/*` |
| 9 | P0 | Seven core tables have only `service_role` blanket RLS — no row isolation (`000_baseline.sql:24311+`) | ●● | ● | Add owner/tenant RLS predicates; defense-in-depth beyond gateway |
| 10 | P1 | Paid-app billing has **no UI** (`createCharge`/`approveCharge` unused) | ●●● | ●●● | Build charge-approval UI in My Apps + dashboard |
| 11 | P1 | Extension management is a stub despite full backend (`ExtensionConfigPanel.tsx`) | ●● | ●● | Wire `extensionRegistry`/`update*Registration` via BFF |
| 12 | P1 | OAuth install flag, when on, **throws** (`AppInstallConsentPanel.tsx:90`) | ●● | ●● | Implement the OAuth BFF route; remove the throw |
| 13 | P1 | Collaborator code non-functional (no persist/redeem) (`shared.ts:242`) | ○ | ●● | Persist codes + redemption endpoint + agency seat model |
| 14 | P1 | Collections are fake re-sorts; admit it in copy (`collections/[slug]:13`) | ●●● | ● | Real editorial curation table + `/collections` index |
| 15 | P1 | 14 of 29 categories hidden from search (`search/page.tsx:154`) | ●● | ● | Render all categories; source from API |
| 16 | P1 | Categories/collections lead to empty grids | ●●● | ○ | Gate discovery rails on real catalog depth |
| 17 | P1 | `built_for_letbuyy` has no DB column/program (`marketplace-display.ts:49`) | ●● | ● | Either build the program + column or remove the badge |
| 18 | P1 | Partner directory page is a placeholder printing a flag name (`partners:26`) | ● | ● | Build real directory or remove the route/links |
| 19 | P1 | Public developer profiles are placeholders (`developers/[slug]:28`) | ●● | ●● | Build profile from `GET /developers/:id` (backend exists) |
| 20 | P1 | review-requirements is placeholder + orphan (`review-requirements:35`) | ○ | ●● | Publish real review policy, SLA, rubric |
| 21 | P1 | Icon/screenshot upload boxes are dead UI (`apps/new:233-246`) | ○ | ●●● | Implement media upload to media-service/CDN |
| 22 | P1 | No usage-based billing UI/metering despite `usage` mode | ● | ●● | Add metering endpoint + usage charge UI |
| 23 | P1 | No trial support in app billing (`billing-core:80`) | ● | ●● | Add trial fields to charge schema + UI |
| 24 | P1 | No install/revenue **analytics** endpoints (snapshot only) (`developer-routes.ts:517`) | ○ | ●●● | Add time-series install/usage/revenue analytics |
| 25 | P1 | No developer webhook subscription management (`app_webhooks` read-only) | ○ | ●● | CRUD for app webhook endpoints |
| 26 | P1 | No app reviews **reply** for developers | ● | ●● | Add developer response to reviews |
| 27 | P1 | "Report review"/"Report listing" buttons disabled (`apps/[slug]:493,617`) | ●● | ○ | Implement abuse reporting workflow |
| 28 | P1 | Stale `letbuyy.store` domain in footer/submit/redirect (`Footer.tsx`, `proxy.ts:7`) | ●● | ●● | Migrate to `letbuyy.com`; centralize host config |
| 29 | P1 | Two install paths (direct-token vs OAuth) — ambiguous default | ● | ●● | Standardize on OAuth; keep token path internal-only |
| 30 | P1 | `app_webhooks` table has no writer — effectively dead (schema) | ○ | ●● | Wire webhook registration or drop the table |
| 31 | P1 | No "Built for LetBuyy" quality program (vs Built for Shopify) | ●● | ●● | Define perf/design/integration bars + badge |
| 32 | P1 | GDPR `customers/redact` only fires if merchant POSTs it (not on real deletion) | ●● | ● | Trigger from actual customer-record lifecycle |
| 33 | P1 | No compare-apps capability | ●●● | ○ | Add compare tray (backend `compare_tray` experiment hints exist) |
| 34 | P1 | No recommendations/"related" beyond same-category 3 (`apps/[slug]:183`) | ●● | ● | Add recommendation service |
| 35 | P1 | Pricing taxonomy mismatch: display vs `pricing_model` CHECK vs billing modes | ●● | ●● | Unify enum across display/schema/billing |
| 36 | P1 | 9 empty BFF route folders imply non-existent capabilities | ○ | ● | Remove dead scaffolding or implement |
| 37 | P1 | No merchant-facing app activity/log | ●● | ○ | Add install/permission/billing activity feed |
| 38 | P1 | No security review/static scan of submitted apps | ●● | ● | Add automated security checks pre-review |
| 39 | P2 | Rating filter is client-only over ≤20 rows (`search/page.tsx:83`) | ●● | ○ | Push rating filter to backend |
| 40 | P2 | Telemetry only dispatches a browser event; no sink (`telemetry.ts`) | ○ | ● | Wire analytics pipeline |
| 41 | P2 | `experiments.ts` ignores its argument — not a real framework | ○ | ○ | Implement real experiment assignment |
| 42 | P2 | 18 of 20 capability flags gate nothing | ○ | ○ | Remove dead flags or wire them |
| 43 | P2 | Trending + made-in-india collections are orphaned | ● | ○ | Link or remove |
| 44 | P2 | No `/collections` index page | ● | ○ | Build index |
| 45 | P2 | Screenshots render 3 placeholders when none ("Awaiting approved media") | ●● | ● | Require ≥1 screenshot at submit |
| 46 | P2 | Changelog UI renders only if data; no source populates it | ● | ●● | Tie to `app_versions` |
| 47 | P2 | `embedUrl` hardcoded `null`; embed sessions never used (`AppInstallConsentPanel.tsx:67`) | ●● | ● | Wire `embedSession` for in-admin launch |
| 48 | P2 | No pagination on search (limit 20, no offset) (`search/page.tsx:69`) | ●● | ○ | Add pagination/infinite scroll |
| 49 | P2 | No "alternatives to this app" / switching aids | ● | ● | Add competitive discovery |
| 50 | P2 | No app demo/sandbox/test-drive | ●● | ● | Add demo store / preview |
| 51 | P2 | No localized pricing beyond INR (multi-currency flag off) | ●● | ● | Implement multi-currency |
| 52 | P2 | No app health/status surfaced to merchants | ●● | ● | Show uptime/incident from `status_url` |
| 53 | P2 | No SLA/support-time signal enforced | ● | ● | Capture + display support SLA |
| 54 | P2 | No "works with" data source (reads tags) (`apps/[slug]:205`) | ● | ● | Add compatibility metadata |
| 55 | P2 | App taxonomy hardcoded ("Doc 15 §4") (`constants/categories.ts:1`) | ● | ● | Move taxonomy to DB + admin |
| 56 | P2 | No featured/sponsored placement model | ● | ●● | Build featured inventory + rules |
| 57 | P2 | Partner dashboard has no time-series/charts | ○ | ●● | Add charts to console |
| 58 | P2 | No app-level API usage metrics for developers | ○ | ●● | Expose request/error/latency per app |
| 59 | P2 | No rate-limit accounting per app/install (schema gap) | ● | ●● | Add quota table + headers |
| 60 | P2 | No pricing-plan/tier model (flat price only) | ●● | ●● | Add `app_pricing_plans` + tier gating |
| 61 | P2 | No app bundling/multi-app discounts | ● | ● | Future monetization |
| 62 | P2 | No merchant app budget/spend controls | ●● | ○ | Add spend caps/alerts |
| 63 | P2 | No uninstall feedback capture | ● | ●● | Capture churn reasons |
| 64 | P2 | Review verification thin (one-per-user; install check at submit) | ●● | ● | Strengthen verified-install proof |
| 65 | P2 | No moderation queue UI for reviews in marketplace | ● | ○ | Surface `reviewModeration` |
| 66 | P2 | No app onboarding/setup guide post-install | ●● | ● | Add setup checklist surface |
| 67 | P2 | No deep-link into merchant admin for embedded apps | ●● | ● | Wire admin bridge embed |
| 68 | P2 | Desktop-first CSS, no fluid type (all px, no `clamp()`) (`globals.css`) | ●● | ○ | Adopt fluid type + mobile-first |
| 69 | P2 | Only `page.tsx` uses Tailwind responsive prefixes | ● | ○ | Standardize responsive system |
| 70 | P2 | Tokens split between app and `@letbuyy/ui` (undefined `--lb-*` locally) | ○ | ○ | Consolidate token source |
| 71 | P2 | No skeleton parity across all async surfaces | ● | ○ | Audit loading states |
| 72 | P3 | `MarketplaceUnavailable` retry only on search page | ● | ○ | Add retry everywhere |
| 73 | P3 | Emoji `🔑` icon in sign-in-required state (`my-apps:38`) | ● | ○ | Use icon system |
| 74 | P3 | "Collections" nav deep-links one collection, not an index (`Header.tsx:36`) | ● | ○ | Point at index |
| 75 | P3 | Footer doc links (`docs.letbuyy.store/*`) likely dead | ● | ●● | Publish docs; fix links |
| 76 | P3 | No breadcrumb on some store pages | ● | ○ | Add consistent breadcrumbs |
| 77 | P3 | No empty-state CTA to "request an app" | ●● | ● | Add demand-capture |
| 78 | P3 | No saved/wishlist apps | ● | ○ | Add saved apps |
| 79 | P3 | No "recently viewed" | ● | ○ | Add personalization |
| 80 | P3 | No category landing SEO content | ● | ● | Add category copy |
| 81 | P3 | Slug hint shows stale `apps.letbuyy.store` (`apps/new:176`) | ○ | ● | Use canonical host |
| 82 | P2 | `partner_payout_ledger_entries.charge_id`/`source_event_id` NOT NULL but no FK | ○ | ●● | Add FK integrity |
| 83 | P2 | No analytics on discovery (search terms, zero-results) | ● | ● | Instrument discovery |
| 84 | P2 | No granted-scopes review in My Apps post-install | ●● | ● | Show granted scopes per install |
| 85 | P2 | No revocation of individual scopes post-install | ●● | ● | Add scope management |
| 86 | P3 | No internationalization beyond 5 strings (`i18n/messages.ts`) | ● | ○ | Real i18n |
| 87 | P3 | No dark-mode QA evidence for marketplace surfaces | ● | ○ | QA dark mode |
| 88 | P2 | Screenshot lightbox is anchor-based, no JS (`apps/[slug]:329`) | ● | ● | Real lightbox |
| 89 | P2 | Demo video `<track>` has no caption source (`apps/[slug]:344`) | ● | ● | Add captions |
| 90 | P2 | No structured "data handling" requirement at submit | ●● | ● | Require data-handling disclosure |
| 91 | P2 | No app dependency/conflict detection | ●● | ● | Detect conflicting apps |
| 92 | P2 | No staged/percentage rollout for updates | ● | ●● | Add rollout controls (after #2) |
| 93 | P2 | No developer sandbox/test store provisioning | ○ | ●● | Provision dev stores |
| 94 | P2 | No app event log for merchants (installed/charged/updated) | ●● | ○ | Add event history |
| 95 | P3 | No "new this week"/editorial blog tie-in | ● | ● | Content marketing |
| 96 | P3 | No partner tiers/badges (silver/gold) | ○ | ●● | Partner program tiers |
| 97 | P3 | No cross-store review proof / import | ● | ● | Cross-store verification |
| 98 | P3 | No accessibility audit evidence for install modal/forms | ●● | ○ | WCAG audit |
| 99 | P2 | No abuse/fraud controls on reviews beyond one-per-user | ●● | ● | Add fraud detection |
| 100 | P2 | No disaster/runbook for marketplace data (catalog, ledger) | ● | ●● | Add ops runbooks |

**Counts:** P0 = 9 · P1 = 29 · P2 = 47 · P3 = 15.

---

## 7. Phase 18 — The brutal review

*If the Shopify App Store team reviewed LetBuyy's Apps Marketplace today, here is what they'd actually say.*

**What they'd praise.** "Your *platform primitives* are legitimate. OAuth with PKCE S256, single-use codes and refresh tokens; HS256 app tokens with real scope-and-hash enforcement; the three mandatory privacy webhooks auto-subscribed at install; idempotent install/uninstall/charges; and an extension model with admin/checkout/theme surfaces plus WASM functions. The install **consent modal** is genuinely good — clearer than some live Shopify apps. And you didn't fake your data: empty states are honest. That restraint is rare and we respect it."

**What they'd reject.** "But this would not pass our app review, and the store itself wouldn't pass our merchant bar. It's **empty**. Every category and 'collection' dead-ends, and your own copy admits the collections are just re-sorts 'until editorial curation is connected.' You ship **pages that print their own feature-flag names** to the merchant — that's an internal artifact leaking into production UI. A developer **can't get approved without a human doing it by hand**, **can't upload an icon or screenshot** (the boxes are decorative), **can't ship a version 2** (no update path — your dashboard says so), and **can't get paid** (the payout ledger only ever writes `pending`; nothing settles). You collect a developer's GSTIN and consent and then **throw both away** before the request leaves the browser. And you can't decide whether your cut is 15% or 20% — the code says 20%, the docs say 15%, the UI says 'pending business approval.' We reject apps for missing a single GDPR webhook URL; you'd be rejecting your *own* marketplace on a dozen counts."

**What they'd redesign.** "Collapse the two install paths to one (OAuth). Make discovery earn its surfaces — don't show 29 categories and three collections over an empty index; show what you actually have. Replace the 20-flag capability theater with real features or delete the flags. Turn the Partner Console's snapshot into real analytics with a time series."

**What they'd remove.** "The partner-directory and public-developer-profile placeholder pages; the dead upload boxes; the disabled 'Report' buttons; the orphan collections; the `letbuyy.store` links; and the 18 capability flags that gate nothing."

**What they'd rebuild from scratch.** "The developer money path end-to-end — pricing plans, charge approval UI, usage metering, **payout settlement**, and one canonical revenue-share number. And the app lifecycle — submit → automated checks that actually run → review → publish → **version/update** → staged rollout. Those two systems are the spine of an app business, and right now both are missing their vertebrae."

**One-line summary:** *A strong platform skeleton wearing a marketplace costume — convincing from the front, hollow the moment a merchant clicks "install a paid app" or a developer tries to ship v2 or get paid.*

---

## 8. Scorecard

| Dimension | Grade | One-line rationale |
|---|---|---|
| Platform architecture (OAuth, scopes, extensions, webhooks) | **B−** | Correct primitives; gaps in versioning, analytics, payout settlement |
| Backend completeness | **B−** | 33 endpoints, real enforcement; missing update/analytics/settlement |
| Merchant discovery | **D** | Empty catalog; dead-end categories/collections; no compare |
| Merchant install/permissions | **B** | Best surface in the product; consent UX is strong |
| Merchant app management | **D+** | Uninstall good; extension config is a stub |
| Developer onboarding | **D** | Drops GSTIN/consent; approval not self-serve |
| Developer monetization | **D−** | No charge UI; payouts never settle; 15/20% contradiction |
| Developer lifecycle (update/version) | **F** | Does not exist |
| Content integrity / honesty | **B** | No fake data; but pervasive placeholder/"contract-gated" copy |
| Trust & safety signals | **C−** | Real reviews/consent; unbacked badges; no security/perf program |
| Responsiveness | **C+** | Works; desktop-first, no fluid type |
| **Overall marketplace experience** | **D** | Platform B−, experience D |

---

## 9. Recommended sequencing (what to fix first)

1. **Make it real before making it pretty:** seed a catalog + onboard launch partners (#1), pick one revenue-share number (#4), implement payout settlement (#3), and ship the app **update/version** path (#2). Without these four, nothing else matters.
2. **Close the platform-to-UI gap:** charge-approval UI (#10), extension management (#11), OAuth install (#12) — the backend already exists.
3. **Fix developer onboarding integrity:** send GSTIN/consent (#6), self-serve approval (#5), real submission checks (#7), working media upload (#21).
4. **Earn discovery:** real curation/collections (#14), show all categories (#15), gate rails on catalog depth (#16), kill placeholder pages (#18, #19, #20).
5. **Harden:** OAuth brute-force limits (#8), real RLS (#9), domain migration (#28).

The ideal end-state is specified in [`LETBUYY_APPS_MARKETPLACE_V2.md`](apps-marketplace-audit/LETBUYY_APPS_MARKETPLACE_V2.md).

---

## 10. Method, limits & honesty notes

- **Read, not run.** No build or live environment was exercised; dynamic behavior (actual API responses, real responsiveness at each breakpoint) is inferred from source. Responsiveness assessed from `globals.css` + component markup.
- **Boundary.** Backend findings cover only the app-store surface the marketplace depends on; the full gateway/queue/webhook services were sampled, not exhaustively audited.
- **Citations.** Line numbers reflect the working tree at audit time (2026-06-07) and may drift as code changes; file paths are stable.
- **Benchmark currency.** Shopify facts were web-verified in June 2026 (see [`SHOPIFY_APP_STORE_COMPARISON.md`](apps-marketplace-audit/SHOPIFY_APP_STORE_COMPARISON.md) for sources).

---

## 11. Sub-report index

| Phase | Report | Focus |
|---|---|---|
| 2 | [SHOPIFY_APP_STORE_COMPARISON.md](apps-marketplace-audit/SHOPIFY_APP_STORE_COMPARISON.md) | Feature-by-feature vs Shopify (+ Atlassian/Stripe/Cloudflare) |
| 5 | [APPS_MARKETPLACE_UI_UX_AUDIT.md](apps-marketplace-audit/APPS_MARKETPLACE_UI_UX_AUDIT.md) | Layout, nav, cards, detail, search, per-page ratings |
| 6 | [APPS_CONTENT_GAP_ANALYSIS.md](apps-marketplace-audit/APPS_CONTENT_GAP_ANALYSIS.md) | Copy accuracy, placeholders, theater inventory |
| 7 | [APPS_FEATURE_GAP_ANALYSIS.md](apps-marketplace-audit/APPS_FEATURE_GAP_ANALYSIS.md) | Critical/important/nice-to-have gaps |
| 8 | [APP_DISCOVERY_AUDIT.md](apps-marketplace-audit/APP_DISCOVERY_AUDIT.md) | Search, categories, collections, rails |
| 9 | [APP_INSTALLATION_JOURNEY_AUDIT.md](apps-marketplace-audit/APP_INSTALLATION_JOURNEY_AUDIT.md) | Browse→install→configure→cancel→uninstall |
| 10 | [APP_REVIEW_SYSTEM_AUDIT.md](apps-marketplace-audit/APP_REVIEW_SYSTEM_AUDIT.md) | Submission→review→publish; safety |
| 11 | [APP_PLATFORM_ARCHITECTURE_AUDIT.md](apps-marketplace-audit/APP_PLATFORM_ARCHITECTURE_AUDIT.md) | OAuth, scopes, webhooks, extensions, billing APIs |
| 12 | [APPS_RESPONSIVENESS_REPORT.md](apps-marketplace-audit/APPS_RESPONSIVENESS_REPORT.md) | 320→1920px |
| 13 | [MERCHANT_TRUST_SCORECARD.md](apps-marketplace-audit/MERCHANT_TRUST_SCORECARD.md) | Would a merchant trust installing here? |
| 14 | [DEVELOPER_TRUST_SCORECARD.md](apps-marketplace-audit/DEVELOPER_TRUST_SCORECARD.md) | Would a SaaS company build here? |
| 15 | [ECOSYSTEM_SCALABILITY_REPORT.md](apps-marketplace-audit/ECOSYSTEM_SCALABILITY_REPORT.md) | 10 / 100 / 1k / 10k apps |
| 16 | [LETBUYY_APPS_MARKETPLACE_V2.md](apps-marketplace-audit/LETBUYY_APPS_MARKETPLACE_V2.md) | The ideal marketplace design |

*Phases 1, 3, 4, 17, 18 are carried in this master document.*
