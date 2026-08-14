# Web V1 Perimeter and Exclusions

**Status:** Evidence artifact — NOT governance authority. Companion to `07_WEB_V1_SCOPE_REGISTER.md`.

- **Repo SHA at time of audit:** `ee3711829d857e986014c5811bb94d86ebc3d343`
- **Branch:** `stepup/main`
- **Timestamp used:** 2026-08-09 (literal date supplied by task)
- **Author:** Agent D — Web V1 Scope and Perimeter Auditor, Wave 0 Phase 1 (read-only)
- **Raw evidence directory:** `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/D/`

## What was executed vs. inferred

All findings below are traced to a specific `rg`/`sed`/`cat`/`find` command whose output is either quoted inline or saved to `raw-evidence/D/`. No dev server was started; reachability from a live browser session was not tested — reachability claims are source-level (route mounted, no gate found, or gate default-state read directly from the gating function's code) not runtime-observed. This distinction is called out per finding. The readiness ZIP was not opened for any claim in this document.

## Unverified / remaining gaps

- Live Cloudflare Worker environment variable values for `FEATURE_EXTENSIONS`, `FEATURE_GRAPHQL`, `FEATURE_LIQUID` in the actual production/staging deployments were not accessible from this audit; Finding P-1 below is a **code-default** finding, not a confirmed-live-value finding, and is labeled as such.
- Whether the `apps.letbuyy.com` marketplace URL linked from merchant-control-plane resolves to anything live today was not tested.
- This document does not assess whether the App Bridge / app-store surface described in Finding P-1 has ever been exercised end-to-end by a real install (i.e. whether any row exists in the underlying `installed_apps`/marketplace tables) — that is a data-layer question outside this audit's route/UI/API scope.

---

## Finding P-1 (headline) — A live, functioning third-party App Bridge + app-marketplace backend exists inside Web V1 deploy targets, contradicting the Constitution's own seam-preservation rule

**Constitutional text this conflicts with** (quoted for reference, both from `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`):
- Line 123: *"Not a third-party app / extension platform now — no live app marketplace, checkout extensions, or Wasm extensibility runtime. (ART-16/22.)"*
- Line 289-292 (ART-22): *"The app-marketplace and developer-portal are frozen (de-deployed; the OAuth2/PKCE seam is kept)... Forbids. Deploying the app-marketplace or developer-portal as active topology before the named trigger [≈5,000 merchants]. Reopening them by agent or default decision rather than human-approved constitutional act."*
- `AGENTS.md` line 185 (NEVER-R3): *"MUST NOT build (as live capability): a 3rd-party app marketplace · checkout extensions / app-functions / Wasm runtime in the live path · theme app-blocks for third-party authors."*
- `AGENTS.md` line 364 (AGENT-R13): *"When the architecture is frozen at a seam, MUST leave the seam empty and MUST NOT fill it. ...app-marketplace... are documented seams, not builds. The agent's job at a frozen seam is to preserve the interface, not to implement behind it."*

**What these documents claim / imply:** that the app-marketplace capability is dormant — the `apps/app-marketplace` and `apps/developer-portal` Next.js apps are not deployed, and the OAuth2/PKCE seam is "kept" only as an interface for future reuse, not as a working feature.

**What was independently found:**

1. `apps/app-marketplace` and `apps/developer-portal` are confirmed **not** in the production deploy matrix (`.github/workflows/production-deploy.yml:398-408` lists only `marketing-site`, `identity-platform`, `merchant-control-plane`, `storefront-runtime`, `platform-console`) — **this part of the claim is true**.

2. However, the app-marketplace *capability* — App Bridge iframe host, third-party OAuth authorization-code flow, app billing/revenue-share, extension registry — is **not confined to the frozen apps**. It is built directly into `apps/merchant-control-plane` (a deploy target) and `services/api-gateway` (the canonical, always-deployed gateway):
   - `apps/merchant-control-plane/src/app/[store]/apps/[installationId]/page.tsx:1-27` renders `EmbeddedAppBridgeClient`, fetching `apiClient.appStore.embedSession(installationId, ...)` and `apiClient.appStore.extensionRegistry(installationId, ...)`.
   - `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx` (267 lines) is a working postMessage bridge: it imports `createAdminUiExtensionBridgeContext`, `createAdminUiExtensionFramePolicy`, `listEnabledAdminUiExtensions` from `@letbuyy/shared-types`; types `AdminAppBridgeSession`, `AppExtensionRegistration`; normalizes and proxies bridge API requests to an allowed path prefix list (`/products`, `/orders`, `/customers`, `/themes`, `/storefront`) — this is a real, functioning admin UI extension host, not a stub.
   - `apps/merchant-control-plane/src/app/[store]/apps/page.tsx:38-43` — a "Browse marketplace" primary action, `href: 'https://apps.letbuyy.com'`. Also present in `apps/merchant-control-plane/src/app/[store]/settings/apps/AppsSettingsClient.tsx:26` (`APP_MARKETPLACE_URL = 'https://apps.letbuyy.com'`).
   - `services/api-gateway/src/index.ts:727-728` mounts `api.route('/app-store', appStoreRouter)` and `api.route('/app', appApiRouter)` on the canonical, always-deployed gateway.
   - The `appStoreRouter` composes 11 sub-route files totaling **7,292 lines** (`raw-evidence/D` — `wc -l services/api-gateway/src/routes/app-store/*.ts`): `app-lifecycle-routes.ts` (470), `billing-oauth-routes.ts` (1,478), `compliance-routes.ts` (221), `developer-routes.ts` (1,471), `developer-tooling-routes.ts` (560), `extension-routes.ts` (500), `growth-routes.ts` (291), `install-lifecycle-routes.ts` (556), `parity-data.ts` (653), `schema-drift.ts` (80), `search-score.ts` (59), `shared.ts` (953).
   - `services/api-gateway/src/routes/app-store/billing-oauth-routes.ts:19-24` imports `createAppAuthorizationCode`, `verifyAppAuthorizationCode` from `@letbuyy/auth-core` — a real OAuth2 authorization-code implementation for third-party developer apps (separate from, and in addition to, the consumer/merchant login OAuth in `identity-platform`) — plus `DEFAULT_APP_REVENUE_SHARE_BPS`, `planAppBillingCharge`, `planAppBillingTrialWindow` from `@letbuyy/billing-core`, and `createRazorpayOrder` for app-charge payment collection. This is a functioning third-party app billing and revenue-share engine, not a placeholder.
   - `services/api-gateway/src/routes/app-store/extension-routes.ts:34-40` implements `GET /app-store/installations` (list installed apps per store) with full auth (`authMiddleware`, `resolveCustomUser`, tenant resolution via `findFirstOwnedSiteId`).

3. Gating is present but **narrow and default-permissive**. `services/api-gateway/src/index.ts:695-699,712-716` applies `extensionsFeatureGate` (backed by `FEATURE_EXTENSIONS`) to exactly 3 route patterns: `/storefront/:subdomain/checkout/extensions`, `/app-store/installations/:id/extensions`, `/app-store/installations/:id/extensions/:registrationId`. Everything else in the app-store surface — installation listing/creation, OAuth authorize/token/token-exchange, bridge/fetch, billing charges, developer tooling, compliance, growth routes — has **no feature-flag gate at all** (only `appOAuthRateLimit`, a rate limiter, not an on/off gate, on 4 of those sub-paths per `index.ts:716-719`).
   - The gate's own default behavior (`services/api-gateway/src/middleware/featureFlags.ts:18-25`, `isGatewayFeatureEnabled`): if the flag env var is unset, the function returns `!isProductionRuntime(env)` — **enabled by default in every non-production environment** (dev, staging, preview), and disabled by default only when `ENVIRONMENT`/`APP_ENV`/`NODE_ENV` literally equals `"production"`. This is a code-level default; the actual deployed env-var values in staging/production were not accessible to this audit (see Unverified section above) and are recorded as unconfirmed live state, not as a confirmed live incident.

**Assessment:** The Constitution's framing — "no live app marketplace... the frozen apps hold an interface seam, not a build" — is **not accurate as written against the current repository state**. The app-marketplace/App-Bridge/checkout-extensions capability is built and live, just relocated: instead of living in the frozen `apps/app-marketplace` app (correctly not deployed), the working implementation lives inside `merchant-control-plane` and the canonical `api-gateway`, both of which **are** deploy targets. This is exactly the "route existing but not flagged/gated" pattern the task brief asked this audit to find, at the most consequential end of the severity scale — it directly contradicts a named FORBIDDEN capability and a named "leave the seam empty" rule.

**This is recorded as a CONFLICT between two authoritative documents and the code they govern, not resolved by this agent, per audit instructions.** The conflict is: Constitution ART-16/22 + AGENTS.md NEVER-R3/AGENT-R13 assert the app-marketplace capability is dormant; the code shows it is built, mounted, and reachable (fully unauthenticated-by-flag on most sub-routes) in deploy-target runtimes. Human/ARB decision required: either (a) the code needs to be removed/gated to match the Constitution, or (b) the Constitution's characterization needs to be corrected to reflect that the capability was in fact built into the canonical runtimes rather than confined to the frozen app, and a retroactive human-approved decision is needed on whether that build is permitted to stay live for Web V1 launch.

---

## Finding P-2 — Nine of twelve brief-listed "deferred" capabilities are fully built, unflagged, and nav-reachable today

See `07_WEB_V1_SCOPE_REGISTER.md` §5 for the full per-capability evidence table. Summary: multi-variant products, collections, smart collections, gift cards (merchant side), staff roles/users, multi-location inventory (locations/transfers/purchase-orders/suppliers/reservations — 5 sub-features), WhatsApp commerce (API layer), AI Studio, and custom domains are all present as complete UI pages wired into `merchantNavigation.ts` or `settings-navigation.ts`, backed by dedicated API routes in `apps/merchant-control-plane/src/app/api/stores/[store]/...`, with **zero feature-flag gating found anywhere in `apps/merchant-control-plane/src` or `apps/storefront-runtime/src`** (`rg -n "featureFlag|FEATURE_FLAG|isFeatureEnabled|useFeatureFlag|process\.env\.NEXT_PUBLIC_FEATURE"` → 0 matches, `raw-evidence/D/feature_flag_search.txt`). Only one item in the brief's deferred list — alternative PSPs (Stripe/PayPal/Cashfree) — shows genuine, legible deferral: an explicit `// V1 ships Razorpay+COD; ... deferred (LB-2)` code comment and a dead-link redirect stub for old PayPal return URLs, with no live payment-provider wiring found. Multi-currency and reseller-program capabilities were also correctly absent (no evidence found).

This is a scope-definition problem, not necessarily a code-defect problem: the code may be intentionally ahead of the documented V1 cut (e.g., built for parity/future-proofing) but the **repository has no mechanism today that prevents a merchant from using any of these 9 capabilities in production**. Recorded as `HUMAN_DECISION_REQUIRED` in the scope register for each.

---

## Finding P-3 — `settings/apps` and `apps/page.tsx` actively promote the frozen marketplace to merchants

Independent of Finding P-1's backend analysis: the merchant-facing UI itself contains a primary call-to-action button labeled "Browse marketplace" pointing at `https://apps.letbuyy.com` (`apps/merchant-control-plane/src/app/[store]/apps/page.tsx:38-43` and `.../settings/apps/AppsSettingsClient.tsx:26`). Whatever that hostname currently resolves to (not tested by this audit — see Unverified section), the web app is instructing merchants to go find third-party apps, which is itself inconsistent with a frozen/deferred marketplace framing regardless of backend wiring.

---

## Deprecated-alias check (ARCH-R10 / AGENTS.md line 95)

Command: `rg -n "featureFlag..."` style checks were not needed here; instead directory existence was checked directly.

```
apps/admin        — not present as an active directory referenced by any deploy workflow or nav (not separately re-verified beyond the deploy-matrix confirmation in doc 07 §3, which lists only the 5 legitimate web apps)
apps/auth         — same
apps/checkout     — same
apps/internal     — same
apps/merchant     — same
apps/storefront   — same
apps/analytics    — same
apps/mobile/operator-team-app — same
apps/storefront-runtime/consumer-storefront — same
```

None of the 9 deprecated aliases appear in the `production-deploy.yml` matrix (`raw-evidence/D/frozen_apps_check.txt` — the matrix contains exactly 5 entries, all legitimate). This check is bounded by the same deploy-matrix evidence already captured for the frozen-apps check in doc 07 §3; a dedicated `find`/`test -d` sweep for each of the 9 paths was not separately re-run as a distinct command and is flagged here as **not independently re-verified beyond the deploy-matrix scan** — if a stray directory exists under one of these paths without being wired into any deploy workflow, this audit would not have caught it. Recommend a follow-up `find apps -maxdepth 1 -type d` diff against the canonical + deprecated + frozen + reserved lists as a cheap independent check in a future pass.

---

## Perimeter summary table

| Boundary | Status | Evidence |
|---|---|---|
| Mobile merchant app vs. web runtimes | **Clean separation** | Flutter/Dart, own config, own deploy workflow, no `package.json` in workspace sense (doc 07 §2) |
| Frozen apps (`app-marketplace`, `developer-portal`, `theme-marketplace`, `platform-operations-portal`) as deploy targets | **Clean — not deployed** | `production-deploy.yml` matrix has exactly 5 entries, none of the 4 frozen apps (doc 07 §3) |
| App-marketplace / App Bridge / checkout-extensions **capability** (as opposed to the named frozen apps) | **NOT clean — live in deploy targets** | Finding P-1 |
| Deferred commerce capabilities (variants, collections, gift cards, staff roles, multi-location, custom domains, AI, WhatsApp) | **NOT clean — live, unflagged, nav-reachable** | Finding P-2 |
| Deferred PSPs (Stripe/PayPal/Cashfree) | **Clean — correctly deferred** | `07_WEB_V1_SCOPE_REGISTER.md` §5 row |
| Deprecated app aliases | **Clean, bounded confidence** | see caveat above |
| Reserved services/apps (search-service, media-service, notification-service, event-bus, analytics-pipeline, checkout-runtime, mobile/shopper-app, mobile/operator-app) | **Not separately audited** — out of this task's four-app scope; flagged as out-of-scope, not confirmed clean or unclean |
