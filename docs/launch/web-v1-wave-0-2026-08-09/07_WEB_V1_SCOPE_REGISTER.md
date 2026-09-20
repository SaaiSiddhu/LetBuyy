# Web V1 Scope Register

**Status:** Evidence artifact — NOT governance authority. Where this document conflicts with `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` or root `AGENTS.md`, those documents win; conflicts found are logged in `08_WEB_V1_PERIMETER_AND_EXCLUSIONS.md`.

- **Repo SHA at time of audit:** `bf35062eda22f4d881efd61fb1d36c8fc83baed1`
- **Branch:** `stepup/main`
- **Timestamp used:** 2026-08-09 (literal date supplied by task; system clock was not queried)
- **Author:** Agent D — Web V1 Scope and Perimeter Auditor, Wave 0 Phase 1 (read-only)
- **Repository root used for all commands:** `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store`
- **Raw evidence directory:** `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/D/`

## What was executed vs. inferred

**Executed (commands run, output captured under `raw-evidence/D/`):**
- `git rev-parse HEAD`, `git branch --show-current`, `git status --short`
- `rg --files` enumeration of `page.tsx` / `route.ts` across all four in-scope apps
- `node scripts/validate-governance.mjs` (full run, exit code captured)
- Targeted `rg` searches for feature-flag patterns, external marketplace links, provider names (PayPal/Stripe/Cashfree/WhatsApp), variant/gift-card/subscription code, and route-mount lines in `services/api-gateway/src/index.ts`
- Direct file reads of navigation config, settings navigation config, gateway route-mount block, `featureFlags.ts` middleware, and the App Bridge client component

**Inferred / not independently executed:**
- No dev servers were started and no HTTP requests were made against any runtime — reachability is assessed from source code (route existence, navigation wiring, and gating logic), not from a live click-through or curl. This is stated explicitly per finding below.
- Database/RLS state was not queried; this document is scoped to route/UI/API surface, not data-layer enforcement.
- The readiness ZIP (`artifacts/local-operational-proof/letbuyy-merchant-app-v1-readiness-2026-08-09.zip`) was **not opened or trusted** for any claim in this document; all counts below are freshly recomputed.

## Unverified / remaining gaps

- Whether `apps.letbuyy.com` (the external marketplace URL linked from merchant-control-plane) currently resolves to a live deployment of `apps/app-marketplace` was not tested (no network access exercised for this artifact; DNS/hosting is out of repo scope). The finding stands regardless: the **link and the backend routes behind it** are live in-repo, independent of what that specific hostname currently serves.
- Whether `FEATURE_EXTENSIONS` / `FEATURE_GRAPHQL` are explicitly set to a disabling value in the real production Cloudflare Worker environment was not checked (no deploy-time secrets accessible from this audit). The code-level default (see Finding P-1 in doc 08) is what is reported here.
- Full line-by-line audit of all 130 merchant-control-plane API routes, 26 identity-platform routes, and ~97 gateway route files was not performed exhaustively — a representative, evidence-backed sample covering every capability named in the task brief was audited to file:line depth; the remainder is enumerated by file path only (see counts table).

---

## 1. Route / UI-entry-point / API-route inventory (counts, independently recomputed)

Commands run from repo root; full file lists saved under `raw-evidence/D/*.txt`.

| App | `page.tsx` (UI routes) | `route.ts` (API routes) | Command |
|---|---|---|---|
| `apps/merchant-control-plane` | 77 | 130 | `rg --files apps/merchant-control-plane -g '*.tsx' -g '*.ts' \| grep -E '/app/.*page\.(ts\|tsx)$'` / `rg --files apps/merchant-control-plane -g 'route.ts'` |
| `apps/storefront-runtime` | 28 | 23 | same pattern against `apps/storefront-runtime` |
| `apps/identity-platform` | 10 | 26 | same pattern against `apps/identity-platform` |
| `services/api-gateway` | n/a (backend) | 97 route files (excl. `__tests__`) mounted via ~83 `api.route(...)` / `api.use(...)` calls in `services/api-gateway/src/index.ts` | `find services/api-gateway/src/routes -name '*.ts' \| grep -v __tests__ \| wc -l` → 97; `rg -n "^api\.route\(" services/api-gateway/src/index.ts` → see `raw-evidence/D/gateway_route_mounts.txt` |

Full path lists: `mcp_pages.txt`, `mcp_routes.txt`, `sf_pages.txt`, `sf_routes.txt`, `id_pages.txt`, `id_routes.txt`, `gw_files.txt`, `gateway_route_mounts.txt` (all under `raw-evidence/D/`).

### 1.1 `apps/merchant-control-plane` — UI route groups (from source, `src/app/[store]/...`)

Dashboard, Orders, Products (new/detail/inventory/inventory-history/operations-dashboard), Collections, Smart collections, Categories, Purchase orders, Transfers, Receipts, Suppliers, Locations, Reservations, Export, Customers (+ detail, + segments), Payouts, Coupons (Marketing), Reviews, Marketing campaigns, AI Studio, Content (Pages/Posts/Comments), Analytics, Online Store (Themes incl. editor + translations, Store pages, Preferences), Apps (installed + `[installationId]` embedded-app viewer), Settings (general/business/billing/billing-profile/checkout/custom-data/domains/localization/notifications/payments/plan/policies/security/shipping/taxes/users/apps/subscribe-checkout), Gift cards, plus non-`store` site-type surfaces (portfolio/resume/landing/blog nav variants: Projects, Gallery, Skills, Education, Testimonials, Experience, Certifications, Leads, Appearance). Root-level: `/`, `/stores`, `/accept-invite`, `/launching-soon`.

### 1.2 `apps/storefront-runtime` — UI route groups

`/`, `/demo/urban-kicks`, `/preview`, `/preview/coming-soon`, and the tenant-scoped tree `/store/[subdomain]/...`: catch-all `[...path]` (theme-rendered pages), account (root/addresses/orders/orders/[id]/settings/wishlist), blog (list + `[slug]`), cart, checkout (+ `paypal-return` dead-link stub, + success), collections/[slug], customers/login, orders, product/[productId], products, returns, shipping, shop, privacy, terms.

### 1.3 `apps/identity-platform` — UI route groups

`/`, `/check-email`, `/forgot-password`, `/login`, `/lookup`, `/onboarding`, `/reset-password`, `/select`, `/set-password`, `/signup`. API: `/api/auth/*` (accounts, create-store, login, logout, lookup, reset-password, send-magic, send-reset, session, set-password, signup, stores, switch, validate-subdomain, verify-otp, verify), `/api/email/*`, plus `/auth/callback`, `/jwks`, `/oauth2/authorize`, `/oauth2/callback`, `/oauth2/consent`, `/oauth2/logout`, `/oauth2/token`, `/oauth2/userinfo`.

### 1.4 `services/api-gateway` — mounted route groups (from `index.ts`, `/v1` base path)

`/auth`, `/contacts`, `/storefront[/graphql]`, `/checkout`, `/stores`, `/themes`, **`/app-store`, `/app`** (see Finding P-1 in doc 08), `/whatsapp[/inbound]`, `/wa[/webhook]`, `/internal/*` (console/billing/founding/events/store-access/custom-domain-reconcile), `/admin[/graphql]`, `/domains`, `/custom`, `/store-access`, `/products`, `/orders`, `/risk`, `/returns`, `/shipping[/labels]`, `/payouts`, `/wallet`, `/commission`, `/settlements`, `/billing`, `/founding`, `/security`, `/cod`, `/kyc`, `/2fa`, `/payments`, `/upload`, `/portfolio`, `/resume`, `/employees`, `/admin`, `/blog`, `/customers`, `/notifications`, `/email`, `/marketing`, `/media`, `/metafields`, `/ai`, `/export`, `/shipping-tax`, `/tax`, `/onboarding`, `/inventory`, `/commerce-analytics`, `/coupons`, `/discounts`, `/smart-collections`, `/categories`, `/analytics`, `/reviews`, `/form-submissions`, `/pages`, `/operations/*` (rbac/risk/support/trust-safety/marketplace-reviews/developers, plus root).

---

## 2. Mobile-app separation check

**Claim:** `apps/mobile/merchant-app` is cleanly separated from the web runtimes, no shared route surface.

**Evidence:**
- `apps/mobile/merchant-app/pubspec.yaml` — Flutter/Dart project (`name: letbuyy_store`, `sdk: '^3.10.0'`), not a Next.js app. Different language and build system from all four web apps; it cannot share a Next.js route tree by construction.
- `apps/mobile/merchant-app/lib/config/app_config.dart:10,16,22,28` — defines its own `BFF_BASE_URL`, `API_BASE_URL`, `IDENTITY_BASE_URL`, `STOREFRONT_BASE_URL` dart-define config, distinct from any web app's env wiring.
- `apps/mobile/merchant-app/lib/services/store_auth_service.dart:383-387` — calls `$baseUrl/auth/mobile/turnstile/verify` on the **mobile-bff** base URL, a mobile-prefixed endpoint distinct from web session auth.
- `apps/mobile/merchant-app/lib/services/push_service.dart:56` — calls `${_api.baseUrl}/notifications/device-tokens`. This endpoint lives in the **shared** canonical `services/api-gateway` (`services/api-gateway/src/routes/notifications.ts:560-589`, mounted at `/notifications` in `index.ts:793`), i.e. it is infrastructure the gateway exposes to any authenticated caller, not a route gated to mobile by network topology.
  - `rg -ln "device-tokens" apps/merchant-control-plane/src apps/storefront-runtime/src apps/identity-platform/src` → **no matches**. No web app calls this endpoint. Push registration is reachable in principle from any bearer-token holder against the gateway, but is **not surfaced or invoked anywhere in the web UI** — reachability from a human web user is effectively nil, but this is an API-level shared-surface note, not a route unique to mobile.
- pnpm workspace: `pnpm-workspace.yaml` lists `apps/*` and `apps/mobile/*` as separate workspace globs; `apps/mobile/merchant-app` has no `package.json` (it's not a Node package at all — pure Flutter), so it cannot appear in any `pnpm --filter` web build/deploy step. Confirmed via `production-deploy.yml` matrix (§3 below) which lists only the 5 web deploy targets — `merchant-app` is not among them (its own workflow is `.github/workflows/mobile-merchant-release.yml`, not audited in depth here as it is out of Web V1 scope).

**Conclusion:** Mobile is cleanly separated at the build-system, config, and deploy-workflow level. The one shared-infrastructure touchpoint (`/notifications/device-tokens` on the canonical gateway) is reachable by any authenticated caller in principle but has zero web-side callers today — classified as a non-issue, noted for completeness.

---

## 3. Deploy-target confirmation (frozen apps NOT wired)

Command: `rg -n "matrix:|app:|- app|include:" .github/workflows/production-deploy.yml`

```
398:      matrix:
399:        include:
400:          - app: marketing-site
402:          - app: identity-platform
404:          - app: merchant-control-plane
406:          - app: storefront-runtime
408:          - app: platform-console
```

Full output in `raw-evidence/D/frozen_apps_check.txt`. Only these 5 apps deploy from `production-deploy.yml`. `rg -n "app-marketplace|developer-portal|theme-marketplace|platform-operations-portal" turbo.json` and the same search across `.github/workflows/*.yml` returned **zero matches** — none of the four frozen/pending apps appear in `turbo.json` or in any CI/CD deploy workflow. `pnpm-workspace.yaml` includes `apps/*` as a workspace glob (all four frozen apps are pnpm packages, i.e. buildable/lintable as workspace members), but workspace membership ≠ deploy target; the deploy-matrix check above is the authoritative signal and confirms they are not deployed. This matches the Constitution's ART-22 (`app-marketplace`/`developer-portal` frozen/de-deployed) and the human-authored `STRATEGIC_WINNER_DECISIONS.md` framing that `platform-operations-portal` folds into `platform-console`.

**Caveat:** this confirms the **named apps themselves** are not deploy targets. It does **not** by itself confirm that the *capabilities* those apps represent (app marketplace, checkout extensions, third-party OAuth/billing) are absent from the runtimes that DO deploy. See Finding P-1 in `08_WEB_V1_PERIMETER_AND_EXCLUSIONS.md` — they are not absent; they are live inside `merchant-control-plane` and `services/api-gateway`, which are deploy targets.

---

## 4. Governance validator run (baseline health check, not scope-specific but material)

Command: `node scripts/validate-governance.mjs` — **exit code 1** (raw output: `raw-evidence/D/validate-governance-output.txt`).

Passing: Foundation anti-fabrication gate, Tenant isolation validator (265 tenant tables, 0 direct service-role bypasses), Production safety validator, Session security validator, Operational lifecycle validator.

Failing: **Design-system governance** — 2 hard invariant violations (`marketing-site` and `developer-portal` dark-mode toggle reachability) plus 9 ratchet regressions (raw hex/px/inline-style/arbitrary-radius/arbitrary-shadow counts rose above baseline across the repo). This is a design-system/CSS-governance failure, not a Web V1 scope/perimeter failure, but it means **the governance gate the brief asked to run does not currently pass** — recorded here as a fact, not resolved or worked around.

---

## 5. Capability reachability — deferred/forbidden capabilities checked against the four in-scope web runtimes

Method for each row: `rg` for the capability's code/route, then trace whether it is (a) linked from primary or settings navigation, (b) has a corresponding API route mounted with no gate, (c) has a corresponding API route mounted behind a feature flag, or (d) exists only as inert/unreferenced code. No feature-flag pattern (`featureFlag|FEATURE_FLAG|isFeatureEnabled|useFeatureFlag|process.env.NEXT_PUBLIC_FEATURE`) was found anywhere in `apps/merchant-control-plane/src` or `apps/storefront-runtime/src` (`raw-evidence/D/feature_flag_search.txt` — zero matches). The only gateway-level feature-flag mechanism found is `services/api-gateway/src/middleware/featureFlags.ts` (`FEATURE_GRAPHQL`, `FEATURE_EXTENSIONS`, `FEATURE_LIQUID`), used at exactly 5 route-mount points (see doc 08 §Finding P-1).

| Capability (brief's deferred list) | Reachable today in web? | Evidence (file:line) | How reachable |
|---|---|---|---|
| Multi-variant products | **Yes, fully live** | `apps/merchant-control-plane/src/app/[store]/products/new/page.tsx` (86 `variant`-related identifiers: `VariantOption`, `VariantRow`, `buildVariantMatrix`, `normalizeApiVariants`) | Primary nav → Products → "Add product" (`n p` shortcut), no gate |
| Collections | **Yes, fully live** | `.../products/collections/page.tsx`; API `apps/merchant-control-plane/src/app/api/stores/[store]/collections/route.ts` + `[collectionId]/route.ts` + `[collectionId]/products/route.ts` | Primary nav → Products → Collections |
| Smart collections | **Yes, fully live** | `.../products/smart-collections/page.tsx` (606 lines, rule builder UI); API `.../smart-collections/route.ts`, `[id]/route.ts`, `[id]/preview/route.ts`; gateway `/smart-collections` mounted `index.ts:809` | Primary nav → Products → Smart collections |
| Gift cards | **Yes, fully live (merchant side)** | `.../products/gift-cards/page.tsx` (604 lines: issue, ledger, redemption count); API `.../gift-cards/route.ts` + `[id]/route.ts`; gateway `services/api-gateway/src/routes/gift-cards.ts` | Nav → Money → Gift cards. Storefront-side redemption at checkout was **not found** in `checkout-client.tsx` (`rg -ni "gift.?card"` → no hits) — merchant can issue/manage but customer-facing redemption UI at checkout is absent |
| Staff roles / users | **Yes, fully live** | `.../settings/users/page.tsx` (526 lines: role icons Crown/ShieldCheck/Truck/Megaphone/Headphones — owner/admin/fulfillment/marketing/support-style roles); API `.../users/route.ts`, `[employeeId]/route.ts`; nav `settings-navigation.ts` "Users and permissions" group, `status` field absent (i.e. not marked `backend-needed` unlike `custom-data`) | Settings → Plan & team → Users and permissions |
| Multi-location (locations/transfers/purchase-orders/suppliers/reservations) | **Yes, fully live** | `.../products/locations/page.tsx`, `.../products/transfers/page.tsx` (858 lines), `.../products/purchase-orders/page.tsx` (723 lines), `.../products/suppliers/page.tsx`, `.../products/reservations/page.tsx`; matching API routes under `.../stores/[store]/{inventory-locations,transfers,purchase-orders,suppliers,inventory/reservations}/route.ts` | Primary nav → Inventory group (Reservations, Locations, Operations dashboard) and Purchasing group (Transfers, Receipts, Vendors) |
| WhatsApp / SMS / push | **Partially live — WhatsApp is fully live at the API layer** | `services/api-gateway/src/routes/whatsapp.ts` (897 lines: templates for order_update/paid/shipped/delivered/cod_confirmation/abandoned_cart, opt-in/consent with DPDP purpose tracking); mounted at `/whatsapp`, `/wa`, and inbound webhook at `/whatsapp/inbound` + `/wa/webhook` (`index.ts:729-730,795-796`), **no feature gate** | Reachable via direct API call against the canonical gateway today; no merchant-control-plane UI page surfaces it under a "WhatsApp" label (not found in nav), so it is API-reachable but not UI-discoverable. Push is mobile-only reachable (see §2). SMS: no dedicated route file found. |
| AI (content generation) | **Yes, fully live** | `.../[store]/ai/page.tsx` (351 lines: AI Studio — copy/SEO/image generation, credits/usage tracking); API `.../stores/[store]/ai/route.ts`; gateway `/ai` mounted `index.ts:800` | Nav → Marketing group → "AI Studio" |
| Alternative PSPs (Stripe/PayPal/Cashfree) | **No — genuinely deferred, cleanly stubbed** | `apps/storefront-runtime/.../checkout-client.tsx:99-101` — comment `// V1 ships Razorpay+COD; Stripe and PayPal deferred (LB-2)`; `type PaymentMethod = 'online' \| 'cod'`. `.../checkout/paypal-return/page.tsx:1-2` — comment `// V1 ships Razorpay+COD; PayPal deferred (LB-2). Route kept so old PayPal return links do not 404.` (dead-link redirect stub only). `payment-execution.adapter.ts` has `'stripe'\|'paypal'\|'cashfree'` in a TypeScript union type only, no route wiring found for them | **This is the one deferred item that is correctly and legibly gated** — worth citing as the pattern the rest of the list should follow |
| Subscriptions (merchant-facing recurring billing for merchant's own store plan, not a customer-subscription commerce feature) | Plan/billing subscription (LetBuyy's own SaaS billing) is live — expected, this is V1-required, not the deferred "subscription commerce" capability. No customer-facing recurring-order/subscription-commerce feature was found in storefront-runtime. | `apps/merchant-control-plane/src/app/api/subscribe/*`, `.../settings/billing/page.tsx` | N/A — not the same capability as the brief's "subscriptions" (customer subscription commerce), which is correctly absent |
| Multi-currency | **No evidence of live multi-currency commerce** | Only match: theme translation editor client (`TranslationEditorClient.tsx`) — locale/translation tooling, not checkout currency switching | Not reachable; correctly absent |
| Headless (storefront API / GraphQL for external clients) | **Partially wired at the gateway, gated** | `graphQLFeatureGate` on `/storefront/graphql` and `/graphql/storefront` (`index.ts:690-693,720-721`) — default-on outside production per `featureFlags.ts` logic (see doc 08 Finding P-1) | Not linked from any web nav; API-only, flag-covered (unlike WhatsApp/extensions) |
| Reseller features | **No dedicated reseller capability found** in `apps/` or `services/` beyond unrelated "reseller" hits in marketing-site demo fields and gateway registrar/index.ts (domain registrar reseller relationship, not a merchant-facing reseller program) | `apps/marketing-site/src/lib/demo/fields.ts`, `services/api-gateway/src/lib/registrar/index.ts` | Not a merchant-reachable capability; correctly absent |
| Custom domains | **Yes, fully live** | `.../settings/domains/page.tsx`; API `.../domains/route.ts`, `[domain]/route.ts`, `[domain]/[action]/route.ts`; gateway `/domains`, `/custom` mounted `index.ts:765-766`; `internal/custom-domain-reconcile` router also mounted | Settings → Storefront trust → Domains |

**Cross-cutting observation:** of the 12 deferred capabilities named in the brief, only **PayPal/Stripe/Cashfree** and **multi-currency** and **reseller** (3 of 12) show the pattern the brief expects from something genuinely deferred (absent, or present only as a dead-link stub with an explicit code comment naming the deferral decision "LB-2"). The remaining 9 — multi-variant products, collections, smart collections, gift cards (merchant side), staff roles, multi-location (5 sub-features), WhatsApp, AI, and custom domains — are fully built, wired into primary or settings navigation, backed by live API routes with no feature flag, and reachable today by any authenticated merchant user with no code change required. This is the central finding of this scope register; see `08_WEB_V1_PERIMETER_AND_EXCLUSIONS.md` for the FORBIDDEN-capability finding (App Bridge / third-party app marketplace backend) which is more severe still.

---

## 6. Machine-readable scope proposal

```json
{
  "audit_meta": {
    "repo_sha": "bf35062eda22f4d881efd61fb1d36c8fc83baed1",
    "branch": "stepup/main",
    "date": "2026-08-09",
    "agent": "Agent D"
  },
  "capabilities": [
    { "capability": "orders_management", "classification": "WEB_V1_REQUIRED", "evidence": "apps/merchant-control-plane/src/app/[store]/orders/page.tsx; services/api-gateway/src/routes/orders.ts" },
    { "capability": "single_variant_products", "classification": "WEB_V1_REQUIRED", "evidence": "apps/merchant-control-plane/src/app/[store]/products/page.tsx" },
    { "capability": "checkout_razorpay_cod", "classification": "WEB_V1_REQUIRED", "evidence": "apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx:99-101" },
    { "capability": "gst_taxes", "classification": "WEB_V1_REQUIRED", "evidence": "apps/merchant-control-plane/src/app/[store]/settings/taxes/page.tsx; services/api-gateway/src/routes (tax.ts, shippingTaxRouter)" },
    { "capability": "shipping_rates_zones", "classification": "WEB_V1_REQUIRED", "evidence": "apps/merchant-control-plane/src/app/[store]/settings/shipping/page.tsx; services/api-gateway index.ts:773-774" },
    { "capability": "themes_liquid_react_render", "classification": "WEB_V1_FOUNDATION", "evidence": "apps/merchant-control-plane/src/app/[store]/online-store/themes/*; services/api-gateway index.ts:726 themesRouter" },
    { "capability": "identity_two_issuer_auth", "classification": "WEB_V1_FOUNDATION", "evidence": "apps/identity-platform/src/app; services/api-gateway/src/routes: authRouter" },
    { "capability": "multi_variant_products", "classification": "HUMAN_DECISION_REQUIRED", "evidence": "apps/merchant-control-plane/src/app/[store]/products/new/page.tsx (86 variant refs, fully live, no gate) — brief lists as deferred but it is fully built and reachable; human must decide keep-live vs. gate-off for V1 launch" },
    { "capability": "collections", "classification": "HUMAN_DECISION_REQUIRED", "evidence": "apps/merchant-control-plane/src/app/[store]/products/collections/page.tsx — fully live, no gate, nav-linked" },
    { "capability": "smart_collections", "classification": "HUMAN_DECISION_REQUIRED", "evidence": "apps/merchant-control-plane/src/app/[store]/products/smart-collections/page.tsx — fully live, no gate, nav-linked" },
    { "capability": "gift_cards_merchant_side", "classification": "HUMAN_DECISION_REQUIRED", "evidence": "apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx — fully live, no gate, nav-linked; storefront redemption UI absent" },
    { "capability": "staff_roles_users", "classification": "HUMAN_DECISION_REQUIRED", "evidence": "apps/merchant-control-plane/src/app/[store]/settings/users/page.tsx — fully live, no gate, settings-nav-linked, not marked backend-needed" },
    { "capability": "multi_location_inventory", "classification": "HUMAN_DECISION_REQUIRED", "evidence": "apps/merchant-control-plane/src/app/[store]/products/{locations,transfers,purchase-orders,suppliers,reservations}/page.tsx — fully live, no gate, nav-linked" },
    { "capability": "custom_domains", "classification": "HUMAN_DECISION_REQUIRED", "evidence": "apps/merchant-control-plane/src/app/[store]/settings/domains/page.tsx — fully live, no gate, settings-nav-linked" },
    { "capability": "ai_studio", "classification": "HUMAN_DECISION_REQUIRED", "evidence": "apps/merchant-control-plane/src/app/[store]/ai/page.tsx — fully live, no gate, nav-linked as 'AI Studio'" },
    { "capability": "whatsapp_commerce_api", "classification": "HUMAN_DECISION_REQUIRED", "evidence": "services/api-gateway/src/routes/whatsapp.ts — 897 lines, fully live at API layer, mounted at /whatsapp and /wa with no feature gate; no merchant-control-plane UI surfaces it" },
    { "capability": "alt_psp_stripe_paypal_cashfree", "classification": "MOBILE_V1_1", "evidence": "explicitly deferred with 'LB-2' code comments; paypal-return route kept only as dead-link redirect; NOT reachable" },
    { "capability": "multi_currency", "classification": "HUMAN_DECISION_REQUIRED", "evidence": "no live commerce implementation found; correctly absent, not formally classified in code" },
    { "capability": "headless_storefront_graphql", "classification": "HUMAN_DECISION_REQUIRED", "evidence": "services/api-gateway/src/index.ts:690-693,720-721 graphQLFeatureGate on /storefront/graphql; default-on outside production per featureFlags.ts" },
    { "capability": "reseller_program", "classification": "RESERVED", "evidence": "no merchant-facing reseller capability found; only registrar-reseller (domain purchasing) and marketing demo copy" },
    { "capability": "app_marketplace_third_party_apps", "classification": "FORBIDDEN", "evidence": "SEE 08_WEB_V1_PERIMETER_AND_EXCLUSIONS.md Finding P-1 — app_marketplace app itself is not a deploy target (correct) BUT the App Bridge host, OAuth authorization-code flow, and billing/revenue-share engine are live inside merchant-control-plane + services/api-gateway (deploy targets), contradicting Constitution NEVER-R3 / AGENT-R13" },
    { "capability": "checkout_extensions", "classification": "FORBIDDEN", "evidence": "services/api-gateway/src/index.ts:698 extensionsFeatureGate on /storefront/:subdomain/checkout/extensions — route exists and is mounted, gated by FEATURE_EXTENSIONS which defaults ON outside production per featureFlags.ts:18-25" },
    { "capability": "mobile_merchant_app", "classification": "MOBILE_V1_1", "evidence": "apps/mobile/merchant-app — Flutter, own deploy workflow mobile-merchant-release.yml, not in production-deploy.yml web matrix" },
    { "capability": "app_marketplace_deploy_target", "classification": "RESERVED", "evidence": "apps/app-marketplace not in production-deploy.yml matrix (confirmed); package.json present but unused as deploy target" },
    { "capability": "developer_portal_deploy_target", "classification": "RESERVED", "evidence": "apps/developer-portal not in production-deploy.yml matrix (confirmed)" },
    { "capability": "theme_marketplace_deploy_target", "classification": "RESERVED", "evidence": "apps/theme-marketplace not in production-deploy.yml matrix (confirmed)" },
    { "capability": "platform_operations_portal_deploy_target", "classification": "RESERVED", "evidence": "apps/platform-operations-portal not in production-deploy.yml matrix (confirmed); Constitution designates it MIGRATE-then-DELETE into platform-console" }
  ]
}
```
