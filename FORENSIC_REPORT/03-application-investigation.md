# Phase 3 — Platform Application & Service Investigation

Investigation date: 2026-06-05

This report documents the *current observed state* of every application under `apps/` and `apps/mobile/`, and every service under `services/`, in the LetBuyy commerce monorepo. Every claim cites a file path and (where useful) line numbers or command output. Where something could not be found, it is written as "not found in repository". Prior-doc claims (root `CODEX_*`/`LETBUYY_*` ledgers, `docs/`, `Audit/`, and existing `FORENSIC_REPORT/` content) were treated as unverified and independently checked; confirmed/contradicted notes appear inline.

---

## Method

- Repository root (file tools): `/Users/saai_sidd/Git/Letbuyy_Store`; (bash) `/sessions/brave-sweet-gates/mnt/Letbuyy_Store`.
- Scans excluded: `node_modules`, `.git`, `.pnpm-store`, `.turbo`, `.dart_tool`, `build`, `test-results`, `artifacts`, `coverage`, `.next`.
- Manifests read: every `package.json`, `runtime.manifest.json`, `pubspec.yaml`, `wrangler.toml`, `vercel.json`, `next.config.ts`, `proxy.ts`.
- Route/page inventory: `find … -name page.tsx`/`-name route.ts` for Next apps; `grep -nE "\.(get|post|put|patch|delete)\('"` for Hono services; `find … -name "*.dart"` for Flutter.
- Data ownership: `grep -rhoE "\.from\('[a-z_]+'\)"` for Supabase table access; env usage via `grep -rhoE "process\.env\.[A-Z_]+"` and Worker `Env` interfaces.
- Integrations: import/usage of provider SDK adapters (`@letbuyy/infrastructure/*-adapter`), env var names, and hardcoded URLs.
- Workspace membership: `pnpm-workspace.yaml` (lines 1–25). Git HEAD at time of scan: `5346ced9` dated `2026-06-05 17:58:44 +0530`.
- Note on tooling: the bash MCP intermittently returned "process already running" RPC errors; affected commands were re-run after a short wait. The `Glob` file tool does not traverse the secondary working directory and returned "No files found" for valid paths; `find` via bash and `Grep`/`Read` against absolute paths were used instead.

### Cross-cutting facts observed (apply to all 9 Next.js apps unless noted)
- Framework: Next.js `16.1.6`, React `19.2.3`, TypeScript `^5` (App Router). All 9 `apps/*/package.json` `build`=`next build`, `test`=`echo 'No tests yet' && exit 0`.
- Each app has a `proxy.ts` (not `middleware.ts`) exporting `proxy()` + a `config.matcher` (e.g. `apps/storefront-runtime/src/proxy.ts:11`, `apps/merchant-control-plane/src/proxy.ts:12`). Using a non-standard `proxy` export name in place of Next's `middleware` is consistent across all 9 apps.
- No app imports `@supabase/supabase-js` or otherwise queries Supabase tables directly: `grep -rhoE "\.from\('[a-z_]+'\)"` over each `apps/*/src` returned `tables=0` for all nine. The only `supabase` text hits in apps are: a SQL schema file (`apps/identity-platform/src/lib/db/schema.sql`), helper-function names `mapSupabaseToStore`/`mapSupabaseToProduct` in storefront (`apps/storefront-runtime/src/lib/store-service.ts:551`, `apps/storefront-runtime/src/lib/product-service.ts:118`), and a placeholder string in `apps/merchant-control-plane/src/app/[store]/projects/page.tsx:369`. This confirms the prior-doc claim in `FORENSIC_REPORT/03-application-reports.md` line 3 ("none touch Supabase directly").
- All apps reach data through `@letbuyy/api-client` → api-gateway. Default base URLs are hardcoded to **staging** in the app API client libs (e.g. `apps/app-marketplace/src/lib/api/client.ts:16`, `apps/identity-platform/src/lib/api/client.ts:14`, `apps/platform-operations-portal/src/lib/api/client.ts:13`, `apps/theme-marketplace/src/lib/api/client.ts:10` all `https://api.staging.letbuyy.store`). They are overridable by env (`LETBUYY_API_URL`/`NEXT_PUBLIC_API_URL`).
- Every `apps/*/vercel.json` (8 of 9; `developer-portal` has none) pins `regions: ["bom1"]` and emits the same 4 security headers (X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy).
- Cross-app session is a shared `lb_session` httpOnly cookie verified via `@letbuyy/auth-core` `verifyLetbuyySessionCookieValue('merchant', …)`.

---

## apps/storefront-runtime — Shopper storefront (tenant data plane)

- **Purpose.** Manifest `runtimeClassification: "tenant-data-plane"`; businessAuthority "Shopper storefront, public catalog, cart, checkout, customer account, and theme presentation runtime" (`apps/storefront-runtime/runtime.manifest.json:9-13`). Largest Next app: ~17,887 LOC across `src` (`find … | cat | wc -l`).
- **Responsibilities (routes).** 23 pages, 21 API routes (`find apps/storefront-runtime/src`). Key pages: `/store/[subdomain]/page.tsx` (home), `/store/[subdomain]/[...path]/page.tsx` (catch-all CMS pages), `/product/[productId]`, `/products`, `/shop`, `/cart`, `/checkout`, `/checkout/success`, `/checkout/paypal-return`, account suite (`account/orders`, `account/addresses`, `account/wishlist`, `account/settings`), `/blog/[slug]`, legal (`privacy`, `terms`, `returns`, `shipping`). Also `/demo/urban-kicks`, `/preview`, `/preview/coming-soon`. API routes: `customer/*` (login, logout, session, profile, addresses, wishlist, wishlist/sync, set-password, auto-create, check, orders), `orders/*` (route, check, login, set-password), `coupons/validate`, `reviews`, `store-lookup`, `themes`, `themes/install`, `seed`.
- **Subdomain routing.** `apps/storefront-runtime/src/proxy.ts` rewrites `<sub>.letbuyy.store` → `/store/<sub>/...` (lines 22-49), reading `x-store-subdomain`/`x-forwarded-host`/`Host`; sets a per-subdomain theme-preview cookie (lines 54-65).
- **Dependencies (internal).** Heaviest workspace consumer: `@letbuyy/api-client, app-engine, auth-core, checkout-core, cms-core, commerce-core, extension-host, runtime-composition, shared-types, tenant-core, theme-engine, ui, utils` (`apps/storefront-runtime/package.json`). External: `@vercel/speed-insights`, `framer-motion`, `jose`, `clsx`, `tailwind-merge`, `lucide-react`.
- **Consumers.** Linked as the live storefront target from merchant control plane (`apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx:19` → `storefront.staging.letbuyy.store`) and seo default (`apps/storefront-runtime/src/lib/seo.ts:6`). CORS-allowlisted by api-gateway (`services/api-gateway/src/index.ts:310`).
- **External integrations.** Client-side payment SDKs invoked in `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx`: Razorpay (`window.Razorpay`, line 65; `/payments/razorpay/order`, line 429), plus Stripe/PayPal/COD payment methods (`PaymentMethod = 'online'|'stripe'|'paypal'|'cod'`, line 102). Cloudflare Turnstile (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`). Image hosts allowlisted in `next.config.ts:22-48` (firebasestorage, unsplash, googleapis, `*.supabase.co/storage`).
- **Runtime ownership.** Next.js SSR (`revalidate = 60` on store pages, e.g. catch-all `:9`) + a set of `app/api/*` route handlers (BFF). vercel.json region `bom1`.
- **Data ownership.** None directly; reads/writes go through api-gateway storefront routes. A bundled demo dataset exists (`src/lib/demo/urban-kicks-demo`) returned when subdomain is the urban-kicks demo (`store-service.ts:54-56`).
- **Known issues.** `app/api/seed/route.ts` is intentionally disabled — returns 404 in production, otherwise HTTP 410 "Runtime seed endpoint is disabled" (lines 8-24). Demo store hardcoded.
- **Potential issues.** Default API base URL is **staging** (`NEXT_PUBLIC_API_BASE_URL`/`LETBUYY_API_BASE_URL` fallback); production deploy relies on env override. CSP `frame-ancestors` in `next.config.ts:3-11` hardcodes `admin.letbuyy.store`/`console.letbuyy.store` alongside staging hosts.
- **CLAUDE.md map.** MATCHES `apps/storefront-runtime`. No deprecated-alias references found in active code.

## apps/merchant-control-plane — Merchant dashboard (merchant control plane)

- **Purpose.** Manifest `merchant-control-plane`; "Merchant dashboard for store configuration, CMS, products, orders, themes, analytics, and settings" (`apps/merchant-control-plane/runtime.manifest.json:9-13`). By far the largest app: 61 pages, 62 API routes, ~34,536 LOC.
- **Responsibilities (routes).** All pages under `/[store]/…`: dashboard, products (+ `[productId]`, `new`, `collections`, `inventory`, `gift-cards`, `purchase-orders`, `transfers`), orders, customers, coupons, categories, reviews, comments/posts/pages, analytics, ai, appearance, online-store (+ `themes`, `themes/[themeId]/editor`, `pages`, `preferences`), export, and a full `settings/*` suite (general, business, payments, checkout, shipping, taxes, domains, users, billing, plan, policies, notifications, security, localization, custom-data, apps). Also portfolio/resume site-type pages: education, experience, skills, certifications, testimonials, projects, gallery, leads, contact, ats-score. API mirror under `/api/stores/[store]/…` (orders, products, customers, coupons, categories, collections, content/[section], gift-cards, inventory, media, navigation, notifications, pages, payment-config, plan, policies, posts, reviews, settings, shipping/zones, taxes, upload, users, dashboard/setup, form-submissions, blog-comments, analytics, billing, ai) plus `/api/themes/*`, `/api/plans`, `/api/subscribe`, `/api/auth/logout`.
- **Auth/routing.** `proxy.ts` gates all `/[store]/*` on `lb_session`; redirects to accounts app `/lookup` if absent (`apps/merchant-control-plane/src/proxy.ts:27-35`). Comment notes deep session validation happens at page/service boundary via `getSessionUser()`.
- **Dependencies (internal).** `@letbuyy/api-client, auth-core, extension-host, shared-types, theme-engine, ui, utils` (`package.json`). Has client hooks dir (`src/hooks`).
- **Consumers.** Redirect target from identity-platform admin URL (`apps/identity-platform/src/lib/config/urls.ts:1` → `merchant.staging.letbuyy.store`); CORS-allowlisted by api-gateway (`services/api-gateway/src/index.ts:309`).
- **External integrations.** Razorpay key id placeholder shown in payments settings UI (`apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx:352`). No direct provider SDK calls; payment config is persisted via api-gateway.
- **Runtime ownership.** Next SSR + extensive `app/api/*` BFF proxy layer.
- **Data ownership.** None directly; the BFF routes call api-gateway via `@letbuyy/api-client` (e.g. `apps/merchant-control-plane/src/app/api/stores/[store]/products/route.ts:34` `createMerchantApiClient().products.list`).
- **Known issues.** One stub page: `apps/merchant-control-plane/src/app/[store]/ats-score/page.tsx` renders `<StubPage title="ATS Score" …/>` (the only `StubPage` use in the app). Other site-type pages (education/experience/skills/etc.) are real client components with API wiring.
- **Potential issues.** Default accounts/admin/API URLs throughout default to **staging** (e.g. `proxy.ts:29`, `src/app/page.tsx:16,26`, `HeaderBar.tsx:180`). Logout route hardcodes staging origins (`src/app/api/auth/logout/route.ts:18,25,55`).
- **CLAUDE.md map.** MATCHES `apps/merchant-control-plane`. No deprecated-alias references in active code.

## apps/identity-platform — Auth, onboarding, store selection (identity control plane)

- **Purpose.** Manifest "Merchant authentication, onboarding, password, OTP, OAuth callback, and store selection UI" (`apps/identity-platform/runtime.manifest.json:9-13`). ~7,389 LOC; 10 pages, 19 route handlers.
- **Responsibilities.** Pages: `/login`, `/signup`, `/lookup`, `/select`, `/onboarding`, `/forgot-password`, `/reset-password`, `/set-password`, `/check-email`, `/`. API routes under `/api/auth/*`: login, logout, signup, session, switch, lookup, accounts, stores, create-store, send-magic, send-reset, set-password, reset-password, verify, verify-otp, validate-subdomain; plus `/api/email/store-creation-success`, `/api/email/store-creation-failure`, and OAuth `/auth/callback/route.ts`.
- **Auth design.** Route handlers call api-gateway internal auth endpoints (`/auth/custom/users/by-email`, `/auth/custom/session`, `/auth/custom/sessions/create|destroy|destroy-all`) using a signed internal client (`apps/identity-platform/src/lib/auth/session.ts`, `…/api/auth/login/route.ts:50-118`). Login is protected by IP rate-limit + CSRF + Turnstile (`login/route.ts:23-46`). New-device email via Resend (`lib/email/resend.ts`). Cookie domain `.letbuyy.store` (prod) / `.staging.letbuyy.store` (else) (`lib/auth/cookies.ts:27`).
- **Dependencies (internal/external).** `@letbuyy/api-client, auth-core, ui, utils` + `@react-email/components`, `react-email`, `bcryptjs`, `jose` (`package.json`). Note: a SQL schema file is checked in at `src/lib/db/schema.sql` (defines `users_custom`, `devices`, `sessions`, etc.) — informational; the app does not execute it.
- **Consumers.** Universal login surface — every other app's `proxy.ts` redirects unauthenticated users to `NEXT_PUBLIC_ACCOUNTS_URL` (accounts.*). 30 hardcoded `accounts.letbuyy.store` references across the repo.
- **External integrations.** Cloudflare Turnstile (`TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`), Resend (`RESEND_FROM_EMAIL`). Feature flags: `FEATURE_MAGIC_LINK`, `FEATURE_MULTI_ACCOUNT`, `FEATURE_PASSKEY`, `FEATURE_TURNSTILE` (env grep).
- **Runtime ownership.** Next SSR + `app/api` BFF. Has unit tests (`src/__tests__/auth-flow.test.ts`, `rate-limit.test.ts`) — but the package `test` script still just echoes "No tests yet".
- **Data ownership.** None directly; identity data lives behind api-gateway (`users_custom`, `sessions`, `devices`, `verification_tokens`, written by the gateway auth route).
- **Known issues.** None found (no TODO/FIXME in app source).
- **Potential issues.** Default API base hardcoded to staging with `/v1` (`lib/api/client.ts:14`). Tests exist but are not wired into the package `test` script.
- **CLAUDE.md map.** MATCHES `apps/identity-platform`. No deprecated aliases.

## apps/marketing-site — Public marketing (public marketing plane)

- **Purpose.** Manifest "Public LetBuyy marketing, pricing, product narrative, and conversion routing" (`apps/marketing-site/runtime.manifest.json`). ~2,885 LOC; 4 pages, 0 API routes.
- **Responsibilities.** `/` (home), `/pricing`, `/signup` (redirect-only), `/create` (site-type chooser). `signup/page.tsx` is a client redirect to `${NEXT_PUBLIC_ACCOUNTS_URL}/signup` (lines 5-10). `/create` posts to api-gateway via `NEXT_PUBLIC_API_URL` (`create/page.tsx:14-25`).
- **Dependencies.** `@letbuyy/api-types, ui, utils` + animation libs `@gsap/react`, `gsap`, `framer-motion`, `lenis` (`package.json`). Note: depends on `@letbuyy/api-types` (types only), unlike most apps which use `@letbuyy/api-client`.
- **Consumers.** Public entry; CTAs link to `accounts.staging.letbuyy.store/signup` (`Navbar.tsx:25`, `CTASection.tsx:11`, `HeroSection.tsx:28`, `PricingSection.tsx:80`).
- **External integrations.** None beyond api-gateway; no payment/email SDKs.
- **Runtime ownership.** Static/SSR Next site; no `app/api`.
- **Data ownership.** None.
- **Known issues.** None (no TODO/FIXME).
- **Potential issues.** Conversion CTAs hardcode **staging** accounts URLs as the `<Link href>` literals (not just defaults) — `Navbar.tsx:22,25`, etc. — so without code edits these point to staging.
- **CLAUDE.md map.** MATCHES `apps/marketing-site`. No deprecated aliases.

## apps/app-marketplace — App store (marketplace control plane)

- **Purpose.** Manifest "App discovery, installation, developer submission, app review, and extension marketplace flows" (`apps/app-marketplace/runtime.manifest.json:9-13`). ~3,863 LOC; 11 pages, 8 API routes.
- **Responsibilities.** Storefront group `(store)`: `/` (home), `/apps/[slug]`, `/categories` + `[slug]`, `/collections/[slug]`, `/search`. Auth group `(auth)`: `/my-apps`, `/developers`, `/developers/dashboard`, `/developers/register`, `/developers/apps`, `/developers/apps/new`. API routes: `/api/apps` (list), `/api/apps/[id]`, `/api/apps/search`, `/api/apps/[id]/install` (POST install / DELETE uninstall), `/api/apps/[id]/reviews`, `/api/developers`, `/api/developers/register`, `/api/developers/apps`.
- **Server layer.** `src/lib/app-service.ts` (`'server-only'`) wraps `@letbuyy/api-client` → api-gateway app-store endpoints. Install route requires session (`api/apps/[id]/install/route.ts:17` `requireSession: true`).
- **Dependencies.** `@letbuyy/api-client, auth-core, shared-types, ui, utils` + `jose`, `lucide-react`, `server-only` (`package.json`).
- **Consumers.** Linked from merchant control plane apps settings (`apps/merchant-control-plane/src/app/[store]/settings/apps/*`, `[store]/apps/page.tsx` → `apps.letbuyy.store`). CORS-allowlisted by api-gateway (`services/api-gateway/src/index.ts:311`).
- **External integrations.** None directly; install/charges flow to api-gateway app-store routes.
- **Runtime ownership.** Next SSR + `app/api` BFF.
- **Data ownership.** None directly; marketplace tables (`marketplace_apps`, `app_installations`, `app_developers`, `app_extension_registrations`, `app_billing_charges`, etc.) are owned by api-gateway.
- **Known issues.** Empty placeholder directory `src/lib/supabase/` (no files) — `ls` shows it exists but contains nothing.
- **Potential issues.** Default API base hardcoded to staging (`src/lib/api/client.ts:16`).
- **CLAUDE.md map.** MATCHES `apps/app-marketplace`. No deprecated aliases.

## apps/theme-marketplace — Theme store (marketplace control plane)

- **Purpose.** Manifest "Theme catalog, theme details, checkout, acquisition, and marketplace discovery flows" (`apps/theme-marketplace/runtime.manifest.json:9-13`). ~4,940 LOC; 12 pages, 3 API routes.
- **Responsibilities.** Pages: `/` (home), `/themes`, `/themes/[slug]`, `/pricing`, `/checkout`, `/checkout/success`, `/install`, dashboard suite (`/dashboard`, `downloads`, `installations`, `purchases`, `settings`). API: `/api/themes`, `/api/themes/[slug]`, OAuth `/auth/callback`.
- **Server layer.** `src/lib/theme-service.ts` (`'server-only'`) calls api-gateway theme endpoints (`getUserPurchases`, `listThemes`).
- **Dependencies.** `@letbuyy/api-client, auth-core, shared-types, theme-engine, ui, utils` + `framer-motion`, `clsx`, `tailwind-merge`, `lucide-react`, `server-only` (`package.json`).
- **Consumers.** Linked from merchant theme browsing (`apps/merchant-control-plane/src/app/[store]/online-store/themes/page.tsx:78` → `themes.staging.letbuyy.store/themes`). CORS-allowlisted (`services/api-gateway/src/index.ts:312`).
- **External integrations.** Payment-method UI present but **not wired**: checkout page lets user pick `stripe`/`razorpay` (`apps/theme-marketplace/src/app/checkout/page.tsx:78,143,155`) but the "Pay" control is a plain `<Link href="/checkout/success?theme=…">` that only fires a toast (lines 206-217). The coupon "Apply" button has no handler (line 201). No payment intent/charge is created.
- **Runtime ownership.** Next SSR + minimal `app/api`.
- **Data ownership.** None directly; `theme_packages`, `theme_purchases`, `theme_instances`, `theme_releases` owned by api-gateway.
- **Known issues.** Checkout is a non-functional happy-path link (no payment); coupon Apply is inert (`checkout/page.tsx:201,206-217`).
- **Potential issues.** Default API base hardcoded to staging (`src/lib/api/client.ts:10`); `ACCOUNTS_URL` defaults to `https://staging.letbuyy.store` (`src/components/layout/navbar.tsx:16`, `src/hooks/useAuth.ts:6`).
- **CLAUDE.md map.** MATCHES `apps/theme-marketplace`. No deprecated aliases.

## apps/platform-console — Super-admin governance (platform governance control plane)

- **Purpose.** Manifest "Super-admin governance surface for platform users, stores, subscriptions, employees, analytics, MFA, settings, and audit logs" (`apps/platform-console/runtime.manifest.json:9-13`). ~3,966 LOC; 14 pages, 4 API routes.
- **Responsibilities.** `(auth)`: `/login`, `/mfa`. `(dashboard)`: `/` , `/dashboard`, `/analytics`, `/audit-logs`, `/employees`, `/operations`, `/settings`, `/stores`, `/subscriptions`, `/trust-safety`, `/users`. API: `/api/console-auth/login`, `/logout`, `/mfa`, `/callback`.
- **Auth design.** Email allowlist + TOTP MFA. `src/lib/console-auth-server.ts`: allowed emails from `PLATFORM_CONSOLE_ALLOWED_EMAILS` (lines 35-46), session cookie `sameSite:'strict'` httpOnly (lines 53-71), `requireConsoleSession({mfa})` redirects to `/login` or `/mfa` (lines 84-96). TOTP verified against `PLATFORM_CONSOLE_TOTP_SECRET` (lines 138-147).
- **Backend.** Reads via `fetchConsoleApi` → api-gateway `/internal/console/*` (summary, analytics, settings, users, stores, subscriptions, employees, audit-logs) using bearer `PLATFORM_CONSOLE_API_TOKEN` (`src/lib/console-api.ts:54`). Several pages document `[SKIP - NEEDS BACKEND]` source notes (e.g. `analytics/page.tsx:172`).
- **Dependencies.** `@letbuyy/api-client, auth-core, ui, utils` + `lucide-react`, `server-only`, `zod` (`package.json`). Only app depending on `zod`.
- **Consumers.** CORS-allowlisted (`services/api-gateway/src/index.ts:313`). The api-gateway `internal-console` router is its dedicated backend (token-gated).
- **External integrations.** None directly.
- **Runtime ownership.** Next SSR + `app/api/console-auth/*`.
- **Data ownership.** None directly; platform tables read via gateway `/internal/console/*`.
- **Known issues.** Dev-only MFA bypass: `PLATFORM_CONSOLE_DEV_MFA_CODE` accepted when `NODE_ENV !== 'production'` (`src/lib/console-auth-server.ts:140-144`). Guarded by NODE_ENV but a notable hardcoded-bypass path.
- **Potential issues.** Auth depends on three env secrets (`PLATFORM_CONSOLE_TOTP_SECRET`, `PLATFORM_CONSOLE_SESSION_SECRET`, `PLATFORM_CONSOLE_API_TOKEN`); `configured()` rejects values containing `replace-with`/`dev-only-placeholder` (lines 24-29), so misconfiguration fails closed.
- **CLAUDE.md map.** MATCHES `apps/platform-console`. No deprecated aliases.

## apps/platform-operations-portal — Employee operations (platform operations control plane)

- **Purpose.** Manifest "Employee operations surface for support, operational queues, marketing workflows, store and user review, and invites" (`apps/platform-operations-portal/runtime.manifest.json:9-13`). ~3,077 LOC; 13 pages, 0 API routes.
- **Responsibilities.** `(auth)`: `/login`, `/invite`. `(dashboard)`: `/`, `/support`, `/merchant-health`, `/crm`, `/users`, `/stores`, `/marketing`, `/operations`, `/operations/onboarding`, `/operations/communications`. Real data pages (CRM 344 LOC, merchant-health 412, support 395, operations 195) derive from api-gateway store APIs (`crm/page.tsx:203-224` `api.stores.list/get`).
- **Auth/routing.** `proxy.ts` gates protected prefixes on `lb_session`; `/login` & `/invite` public; redirects to accounts `/lookup` otherwise (`apps/platform-operations-portal/src/proxy.ts`).
- **Backend client.** `src/lib/api/client.ts` builds an internal-session-signed `@letbuyy/api-client` using `INTERNAL_API_SECRET`/`AUTH_SECRET` and the `lb_session` cookie (lines 28-68).
- **Dependencies.** `@letbuyy/api-client, auth-core, shared-types, ui, utils` + `lucide-react` (`package.json`).
- **Consumers.** Employee-only; CORS-allowlisted (`services/api-gateway/src/index.ts:314`).
- **External integrations.** None directly.
- **Runtime ownership.** Next SSR; no `app/api` (all data through the shared api-client lib).
- **Data ownership.** None directly.
- **Known issues (placeholder/stub heavy).** Multiple shell pages with `TODO` and no functionality:
  - `(auth)/invite/page.tsx:14` `{/* TODO: Validate invite token, show role, create password */}`
  - `(auth)/login/page.tsx:12` `{/* TODO: Employee login with email allowlist… */}`
  - `(dashboard)/stores/page.tsx:16` (19 LOC stub) `{/* TODO: Store search results, moderation actions */}`
  - `(dashboard)/users/page.tsx:16` (19 LOC stub) `{/* TODO: User search results */}`
  - `(dashboard)/marketing/page.tsx:22` (25 LOC stub) `{/* TODO: Campaign builder… */}`
  - `(dashboard)/page.tsx:27` dashboard shows hardcoded `0` metric cards + `{/* TODO: Recent activity feed */}` (lines 15,19,23,27).
  - `(dashboard)/layout.tsx:19` `{/* … TODO: role-based filtering */}` — nav is shown to all roles regardless of employee role.
- **Potential issues.** No role-based access control on dashboard nav despite manifest claiming employee-role surface; the auth boundary is only "has valid merchant `lb_session`," not an employee allowlist (contrast platform-console which enforces `PLATFORM_CONSOLE_ALLOWED_EMAILS`).
- **CLAUDE.md map.** MATCHES `apps/platform-operations-portal`. No deprecated aliases.

## apps/developer-portal — Developer docs/dashboard shell (developer ecosystem plane)

- **Purpose.** Manifest "Developer documentation, API reference, OAuth and webhook guides, SDK quick-starts, and partner dashboard shell" (`apps/developer-portal/runtime.manifest.json:9-13`). Smallest app: ~900 LOC; 5 pages, 0 API routes.
- **Responsibilities.** `/` (home), `/docs`, `/api`, `/sdk`, `/dashboard`. The dashboard is an explicit non-functional shell: `dashboard/page.tsx` renders an information-architecture mockup where API keys / Analytics / Earnings panels are literally labelled `[SKIP - NEEDS BACKEND]` (lines 39-41).
- **Dependencies.** `@letbuyy/ui` only — no `@letbuyy/api-client`, no auth (`apps/developer-portal/package.json`). Pure static content + UI kit. Content from a local `@/lib/reference` module.
- **Consumers.** Linked from app-marketplace footer (`apps/app-marketplace/src/components/Footer.tsx` references `developers`/`apps.letbuyy.store`). No inbound API calls.
- **External integrations.** None.
- **Runtime ownership.** Static Next site; no SSR data, no API. **No `vercel.json`** (only app without one).
- **Data ownership.** None.
- **Known issues.** Entire dashboard is a labelled shell ("A partner workspace without fabricated data", `dashboard/page.tsx:11`). No env vars read (env grep returned empty).
- **Potential issues.** Listed in production-topology (`config/runtime/production-topology.json` → "Developer Portal | apps/developer-portal") and `docs/governance/runtime-boundaries.md:9`, **but absent from the `CLAUDE.md` "Canonical Runtime Map"** (which lists only the other 8 apps). This is a documented-elsewhere runtime that the top-level CLAUDE.md map does not enumerate. It IS a pnpm workspace member (`pnpm-workspace.yaml:2` `apps/*`).
- **CLAUDE.md map.** PARTIAL MISMATCH — exists and is governed in topology/runtime-boundaries but is NOT in CLAUDE.md's Canonical Runtime Map list. No deprecated aliases.

---

## apps/mobile/merchant-app — Flutter merchant builder (mobile merchant control plane)

- **Purpose.** Manifest "Native merchant operations, dashboard, builder, products, themes, preview, and store management surfaces" (`apps/mobile/merchant-app/runtime.manifest.json:9-13`). pubspec `name: letbuyy_store` v`1.0.0+1`. ~35,190 LOC of Dart (112 `.dart` files).
- **Responsibilities (screens).** 25 screens under `lib/screens/`: `auth/login_screen`, `auth/error_screen`, `splash/splash_screen`, `dashboard/home_screen`, `main/store_main_screen`, `products/products_screen`+`product_form_screen`+`import_products_screen`, `orders/orders_screen`, `analytics/analytics_screen`, `customize/theme_screen`, `editor/section_editor_screen`, `preview/live_preview_screen`, `premium/upgrade_screen`, `subscription/pricing_screen`+`connect_razorpay_screen`, `settings/*` (settings, store_details, domain_settings, seo_settings, help), `wizard/create_store_wizard`+`store_published_screen`, `parity/merchant_feature_screen`+`merchant_feature_definitions`.
- **Services.** `lib/services/`: `api_client`, `store_auth_service`, `store_service`, `product_service`, `order_service`, `analytics_service`, `domain_service`, `preview_service`, `subscription_service`, `theme_service`+`theme_provider`, `storage_service`, `language_service`.
- **Dependencies (internal).** Dart workspace packages `letbuyy_core, letbuyy_api_client, letbuyy_models, letbuyy_ui_kit` (`pubspec.yaml`). External: `provider`, `cached_network_image`, `shimmer`, `lottie`, `flutter_animate`, `fl_chart`, `google_fonts`, `font_awesome_flutter`, `fluttertoast`, `flex_color_picker` (+ more).
- **Consumers.** Standalone app store binary. No web app imports it.
- **External integrations.** Talks to the same backend: `AppConfig.apiBaseUrl` default `https://api.letbuyy.store/v1`, `identityBaseUrl` `https://accounts.letbuyy.store`, `storefrontBaseUrl` `https://letbuyy.store` (`lib/config/app_config.dart:5-22`). Razorpay key id is `String.fromEnvironment('RAZORPAY_KEY_ID')` (publishable only) (`app_config.dart:24`). Session uses `lb_session` cookie/token (`lib/services/store_auth_service.dart:83-87`). Dart-define contracts checked in (`dart-defines/staging.json`, `production.json`) with `SKIP_NEEDS_HUMAN_*` placeholders for Supabase anon key + Razorpay key id; README warns not to add service-role/provider secrets.
- **Runtime ownership.** Native mobile client (Android + iOS folders present). Not a server runtime.
- **Data ownership.** None directly; all via api-gateway. Note `dart-defines/*.json` declare `SUPABASE_URL`/`SUPABASE_ANON_KEY` but no Supabase SDK use was found in `lib/` (grep returned no hits).
- **Known issues (TODOs).** Several unimplemented actions: `products_screen.dart:287` "TODO: Implement actual export", `:799` "TODO: Navigate to edit", `:1076` "TODO: Implement hide"; `orders_screen.dart:987` "TODO: Navigate to order details"; `create_store_wizard.dart:279` "TODO: Wire up onboarding data save via API when endpoint is ready"; `pricing_screen.dart:249` & `upgrade_screen.dart:324` "TODO: Integrate Razorpay"; `settings_screen.dart:299` "TODO: Open terms/privacy page"; `auth/error_screen.dart:70` "TODO: Deep link to Seller App".
- **Potential issues.** Razorpay subscription integration not implemented (two TODOs); some list actions are placeholders. Declares Supabase env that appears unused.
- **CLAUDE.md map.** MATCHES `apps/mobile/merchant-app`. No deprecated aliases.

## apps/mobile/operator-app — Flutter operator scaffold (mobile platform operations)

- **Purpose.** Manifest "Native platform operator scaffold for controlled super-admin and operational oversight workflows" (`apps/mobile/operator-app/runtime.manifest.json:9-13`). pubspec `name: letbuyy_super_admin`, `description: "LetBuyy Super Admin Console - Platform Management"`.
- **Responsibilities.** **None implemented.** `lib/` contains a single file `lib/main.dart` (1 `.dart` file) which is the unmodified Flutter counter starter app: `MaterialApp(title: 'Flutter Demo' …)`, `MyHomePage`, `_incrementCounter`, "You have pushed the button this many times" (`apps/mobile/operator-app/lib/main.dart:14,33,107`).
- **Dependencies.** Only `flutter` + `cupertino_icons`; `dev_dependencies: flutter_test` (`pubspec.yaml`). No internal LetBuyy packages, no api-client.
- **Consumers.** None.
- **External integrations.** None.
- **Runtime ownership.** Native scaffold; has `android`, `ios`, `web` dirs and an iml file, but no real screens/services.
- **Data ownership.** None.
- **Known issues.** Pure boilerplate — the seed color comment "TRY THIS: Try running your application…" and counter logic are the default `flutter create` template. Functionally empty.
- **Potential issues.** Manifest/topology treat it as a governed runtime, but there is zero operator functionality; `title: 'Flutter Demo'` ships if built as-is.
- **CLAUDE.md map.** MATCHES `apps/mobile/operator-app`. No deprecated aliases (the deprecated alias `apps/mobile/operator-team-app` is NOT present — confirmed absent in active code).

## apps/mobile/shopper-app — Reserved shopper mobile runtime (mobile customer)

- **Purpose.** Manifest "Reserved mobile shopper runtime for customer browsing, cart, checkout, account, and order flows" (`apps/mobile/shopper-app/runtime.manifest.json:9-13`).
- **Responsibilities.** **None — reserved placeholder.** Directory contains only `AGENTS.md` and `runtime.manifest.json`. No `pubspec.yaml`, no `lib/`, no platform folders (`ls apps/mobile/shopper-app` → 2 files).
- **Dependencies / Consumers / Integrations / Data.** None.
- **Runtime ownership.** Reserved manifest only; not buildable.
- **Known issues.** Empty reserved runtime (manifest-only).
- **CLAUDE.md map.** MATCHES `apps/mobile/shopper-app`. No deprecated aliases.

---

## services/api-gateway — Hono /v1 API (Cloudflare Worker; backend API control plane)

- **Purpose.** Manifest `runtimeCategory: "cloudflare-worker"`, `runtimeClassification: "backend-api-control-plane"`, businessAuthority "Hono /v1 API gateway, validation, service orchestration, tenant enforcement, and worker-owned backend routes" (`services/api-gateway/runtime.manifest.json:11-15`). The central backend: ~35,919 LOC across `src`.
- **Responsibilities (routes).** `src/index.ts` mounts 30+ routers under `/v1` (lines 373-424). Public (pre-auth): `/auth`, `/contacts`, `/storefront`, `/themes`, `/app-store`, `/internal/console`, plus GraphQL storefront. Protected (after `authMiddleware` + `csrfProtection`, lines 388-389): `/stores`, `/products`, `/orders`, `/payments`, `/upload`, `/portfolio`, `/resume`, `/employees`, `/admin`, `/blog`, `/customers`, `/notifications`, `/media`, `/ai`, `/export`, `/shipping-tax`, `/onboarding`, `/inventory`, `/coupons`, `/categories`, `/analytics`, `/reviews`, `/form-submissions`, `/pages`, `/operations`, plus admin GraphQL. 686 total HTTP handlers across 31 route files (`grep` count). Largest: `storefront.ts` (4,826 LOC, ~75 handlers incl. `/customer/*`, `/:subdomain/*`, `/internal/payments/*`), `app-store.ts` (2,721 LOC, OAuth/install/charges/extensions), `operations.ts` (1,436 LOC, runtime control plane: outbox/jobs/webhook-deliveries dispatch, queues recover/redrive, replays, incidents, failover-drills, chaos-experiments, load-tests, deployments, certification-reports). Health: `/health`, `/v1/health`, `/v1/health/queues`.
- **Scheduled work.** Cron-driven outbox/queue/webhook dispatcher `runScheduledDispatch` (`src/index.ts:471-605`); crons `*/5` (staging) / `*/1` (production) (`wrangler.toml`).
- **Durable Object / GraphQL / extensions.** Exports `LetbuyyRuntimeDurableObject` (`src/durable/runtime-coordinator.ts`, bound as `RUNTIME_COORDINATOR`). GraphQL admin+storefront schema (`src/graphql/*`, 1,835-LOC schema, cost/bulk/rest-shim). App functions runtime (`src/extensions/app-functions-runtime.ts`). GraphQL/extensions gated by `FEATURE_GRAPHQL`/`FEATURE_EXTENSIONS` (off in production vars, on in staging — `wrangler.toml`).
- **Dependencies (internal).** Broadest in repo: `@letbuyy/api-types, app-engine, application-services, auth-core, billing-core, checkout-core, cms-core, commerce-core, event-core, infrastructure, notification-core, orchestration, runtime-composition, shared-types, tenant-core, theme-engine` (`package.json`). External: `hono ^4.7`, `zod ^4.3`, `bcryptjs`.
- **Consumers.** Every web app (via `@letbuyy/api-client`), both mobile apps, the webhook-service (cron webhook dispatch, `src/index.ts:512`), platform-console (`/internal/console/*`), operations-portal/CRM. Service binding `WEBHOOK_SERVICE` (`wrangler.toml`).
- **External integrations.** Supabase (service + anon clients via `@letbuyy/infrastructure/supabase-adapter`; `src/lib/supabase.ts`). Cloudflare bindings: Hyperdrive (pooled SQL), R2 (`R2_BUCKET` media), KV (`CACHE`), D1 (`RUNTIME_DB`), Durable Object, Analytics Engine (`RUNTIME_TELEMETRY`), 5 Queue producers (EVENT/ANALYTICS/SEARCH/NOTIFICATION/RUNTIME). Payments: Razorpay/Stripe/PayPal/Cashfree keys in `Env` (`src/index.ts:58-69`). Resend (`RESEND_API_KEY`). Upstash Redis for rate limiting (`UPSTASH_REDIS_REST_URL/TOKEN`, with KV + in-memory fallback — `src/middleware/rateLimit.ts:6-11`). Turnstile.
- **Runtime ownership.** Cloudflare Worker: API + cron scheduler + Durable Object + queue producer. Routes: `api.letbuyy.store` (prod), `api-staging`/`api.staging` (staging) (`wrangler.toml`).
- **Data ownership.** Primary writer/reader of Supabase. 127 distinct tables accessed (`grep .from('…')` unique count). Top tables: `sites` (62), `orders` (28), `products` (24), `app_installations` (21), `store_customers` (17), `employees` (16), `users_custom` (15), `customer_addresses` (15), `marketplace_apps` (14), `subscriptions` (13), `themes`/`storefront_pages`/`product_reviews`/`product_categories`/`coupons` (10 each), plus auth (`sessions`, `verification_tokens`, `customer_credentials`), theming (`theme_releases`, `theme_editor_drafts`, `theme_instances`), ops (`outbox_events`, `platform_queue_jobs`, `webhook_deliveries`, `audit_logs`, `idempotency_keys`, `worker_request_logs`). R2 bucket `letbuyy-media-{env}`.
- **Auth model.** `authMiddleware` accepts Supabase Bearer token OR signed internal SSO (`X-LetBuyy-Internal-*` HMAC) OR internal session token (`src/middleware/auth.ts:64-247`). `/operations/*` additionally requires `requireRoleCategory('ops')` + `requireSuperAdmin` (`src/routes/operations.ts:58`). `/internal/console/*` requires bearer == `PLATFORM_CONSOLE_API_TOKEN`, else 503 if unset / 401 if mismatch (`src/routes/internal-console.ts:43-66`). Auth-service internal endpoints require `requireAccountsInternal` HMAC (`src/routes/auth.ts:47-50`).
- **Known issues (TODO).** Email-send stubs: `src/routes/employee.ts:287` "TODO: Send invite email via Resend", `src/routes/admin.ts:283` same, `src/routes/contacts.ts:48` "TODO: Send notification to store owner via Resend". AI generation is deliberately unconfigured: `/ai/generate` always inserts an `ai_usage` row with `provider:'none', status:'failed'` and returns HTTP 503 `AI_PROVIDER_UNCONFIGURED` (`src/routes/ai.ts:121-148`); no LLM SDK present (grep for openai/anthropic/etc. → only schema imports).
- **Potential issues.** `Env` declares `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` as required (non-optional, `src/index.ts:119-120`) though the rate limiter treats Redis as optional with fallback. Package `test` script echoes "No tests yet" while 6 real test files exist under `src/__tests__/` (e.g. `tenant-isolation.test.ts`) — they assert on source text rather than runtime behavior and are not invoked by the package script.
- **CLAUDE.md map.** MATCHES `services/api-gateway`. No deprecated aliases (the `governance-common.mjs:73-79` list is the *deny-list definition*, not a usage).

## services/webhook-service — Payment provider webhooks (Cloudflare Worker; backend webhook plane)

- **Purpose.** Manifest `runtimeCategory: "cloudflare-worker"`, `"backend-webhook-plane"`, "Inbound provider webhook verification, idempotency, and side-effect reconciliation" (`services/webhook-service/runtime.manifest.json:9-13`). ~1,638 LOC.
- **Responsibilities (routes).** `src/index.ts` (1,511 LOC): `GET /health` (line 714); `POST /app-lifecycle/dispatch` (742); `POST /webhook-deliveries/dispatch` (832); provider callbacks `POST /razorpay` (857), `POST /stripe` (1043), `POST /paypal` (1253), `POST /cashfree` (1390). Each verifies signatures via Web Crypto / provider adapters, writes `payment_webhook_events` with idempotent upsert on `(provider, provider_event_id)` (`writeWebhookEvent`, lines 54-75), then reconciles order/payment state.
- **Outbound webhook signer.** `src/app-lifecycle-dispatch.ts` (127 LOC) HMAC-signs outgoing LetBuyy app-lifecycle webhooks (`X-LetBuyy-Hmac-SHA256`, lines 3-4), enforces HTTPS target (lines 33-39).
- **Dependencies (internal/external).** `@letbuyy/auth-core, infrastructure` + `hono ^4`. Uses `@letbuyy/infrastructure` payment adapters (razorpay/cashfree/paypal/stripe) and supabase-adapter (`src/index.ts:2-17`).
- **Consumers.** api-gateway cron calls it via `WEBHOOK_SERVICE` binding for delivery dispatch (`services/api-gateway/src/index.ts:512`). It in turn binds back to `API_GATEWAY_SERVICE` (`wrangler.toml`).
- **External integrations.** Razorpay/Stripe/PayPal/Cashfree (secrets in `Env`, `src/index.ts:25-48`: `RAZORPAY_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`, PayPal `*_WEBHOOK_ID`, Cashfree). Supabase service role. Analytics Engine (`RUNTIME_TELEMETRY`).
- **Runtime ownership.** Cloudflare Worker. Routes `webhooks.letbuyy.store` (prod), `webhooks-staging`/`webhooks.staging` (staging) (`wrangler.toml`).
- **Data ownership.** Writes `payment_webhook_events` (idempotency + processing status, lines 64-92) and reconciles `orders` (inventory_reserved/released, payment_status). Note: `grep .from()` returns 0 because it uses the REST helper functions `upsertSupabaseRows`/`patchSupabaseRows`/`selectSupabaseRows` (table names passed as args, e.g. `"payment_webhook_events"` line 64) rather than `.from()`.
- **Known issues.** None found (no TODO/FIXME).
- **Potential issues.** Package `test` script echoes "No tests yet"; no test files in `src`.
- **CLAUDE.md map.** Not in CLAUDE.md Canonical Runtime Map — but the map lists only `services/api-gateway` and `services/webhook-service`; this IS one of the two. MATCHES. No deprecated aliases.

## services/queue-workers — Cloudflare Queue consumers (Cloudflare Worker; async worker plane)

- **Purpose.** Manifest `runtimeCategory: "reserved-service"` yet has real code; `"async-worker-plane"`, "Reserved background queue worker authority for asynchronous commerce jobs" (`services/queue-workers/runtime.manifest.json:8-12`). ~1,156 LOC. (Note: manifest category says "reserved-service" but it is an implemented, deployable Worker — see Potential issues.)
- **Responsibilities.** `src/index.ts` (303 LOC) exports a `queue(batch, env)` handler (line 258): normalizes/validates messages, persists to `distributed_queue_messages` (upsert on `message_id`), records `runtime_telemetry_metrics`, quarantines invalid messages to dead-letter, acks/retries. Delegates domain work to `consumePlatformQueuesForCloudflareQueue` (`src/platform-queue-consumer.ts`, 853 LOC), which handles platform queues `analytics-events`, `search-indexing`, `payment-events` and plans analytics rollups / search projections / in-app notifications via `@letbuyy/runtime-composition` + `@letbuyy/notification-core`.
- **Queue topology.** Consumes (per `wrangler.toml`, prod): `letbuyy-events-production`, `letbuyy-analytics-queue-production`, `letbuyy-search-queue-production`, `letbuyy-notifications-queue-production`, `letbuyy-dead-letters-production`, `letbuyy-production-queue`, `letbuyy-production-dead-letter-queue`, each with batch/concurrency/retry/DLQ config.
- **Dependencies (internal/external).** `@letbuyy/event-core, infrastructure, notification-core, orchestration, runtime-composition` (`package.json`). No external runtime deps beyond Cloudflare types/wrangler (dev).
- **Consumers.** Cloudflare invokes it on queue messages produced by api-gateway's 5 queue producers. Binds `API_GATEWAY_SERVICE` (`wrangler.toml`).
- **External integrations.** Supabase service role (`SupabaseServiceEnv`). Analytics Engine telemetry.
- **Runtime ownership.** Cloudflare Worker queue consumer (no HTTP routes). No custom routes/domains (queue-triggered only).
- **Data ownership.** Writes `distributed_queue_messages`, `runtime_telemetry_metrics`; via the platform consumer also touches `search_documents` (3×), `analytics_event_stream`, `orders`, `order_items`, `notifications`, `outbox_events`, `partner_payout_ledger_entries`, `marketplace_apps`, `app_developers`, `sites`, `products` (`grep .from()` over `src`).
- **Known issues.** None found (no TODO/FIXME).
- **Potential issues.** Manifest `runtimeCategory: "reserved-service"` contradicts its actual implemented `cloudflare-worker` queue-consumer status and its `package.json`/`wrangler.toml` (it is buildable and deployable). The `deployment-topology.json` lists it as `deploymentKind: "queue-worker"`, platform `cloudflare-workers` — so topology and manifest category disagree.
- **CLAUDE.md map.** Not in CLAUDE.md Canonical Runtime Map (which lists only api-gateway + webhook-service among services). It is a real, deployed service governed by topology and `docs/governance/runtime-boundaries.md:25`. PARTIAL MISMATCH (governed elsewhere, omitted from CLAUDE.md service list). No deprecated aliases.

## services/checkout-runtime — Reserved (manifest only)

- **Purpose.** Manifest `runtimeCategory: "reserved-service"`, `"checkout-service-plane"`, "Reserved backend checkout authority for server-side totals, payment orchestration, and idempotent checkout mutations" (`services/checkout-runtime/runtime.manifest.json:9-13`).
- **Responsibilities.** **None implemented.** Directory contains only `AGENTS.md` + `runtime.manifest.json` (no `src`, no `package.json`, no `wrangler.toml`). `allowedDependencies.workspacePackages` = `["@letbuyy/api-types"]`; forbids importing `apps/*`, `services/*` (lines 33-44).
- **Consumers / Integrations / Data.** None present. Manifest delegates queue execution to api-gateway/queue-workers and event persistence to Supabase append-only store (lines 105-107). Actual server-side checkout/totals logic currently lives in api-gateway `storefront.ts` `/internal/payments/*` and `/:subdomain/orders`, not here.
- **Runtime ownership.** Reserved placeholder; listed in production/deployment topology as `reserved-service`/platform `reserved`.
- **Known issues.** Empty reserved runtime; functionality it "owns" per manifest is actually implemented in api-gateway.
- **CLAUDE.md map.** Not in CLAUDE.md Canonical Runtime Map. Governed in `docs/governance/runtime-boundaries.md:22`. No deprecated aliases.

## services/event-bus — Reserved (manifest only)

- **Purpose.** Manifest `"reserved-service"`, `"event-service-plane"`, "Reserved internal event transport authority for commerce domain events and async workflow fanout"; uniquely claims `eventStoreOwnership: "Owns event transport execution against the Supabase Postgres append-only … event store"` (`services/event-bus/runtime.manifest.json:106`).
- **Responsibilities.** **None implemented.** Only `AGENTS.md` + `runtime.manifest.json`. Actual event transport today is Cloudflare Queues (api-gateway producers → queue-workers consumers) + the `outbox_events`/`distributed_queue_messages` tables.
- **Consumers / Integrations / Data.** None present.
- **Runtime ownership.** Reserved placeholder; topology platform `reserved`, `deploymentKind: "reserved-service"`, regions `ap-south-1`+`global-edge`, scaleMetric `replay-lag` (`config/runtime/deployment-topology.json`).
- **Known issues.** Empty reserved runtime.
- **CLAUDE.md map.** Not in CLAUDE.md Canonical Runtime Map. Governed in runtime-boundaries. No deprecated aliases.

## services/notification-service — Reserved (manifest only)

- **Purpose.** Manifest `"reserved-service"`, `"notification-service-plane"`, "Reserved notification authority for email, SMS, push, and commerce lifecycle messaging" (`services/notification-service/runtime.manifest.json:8-12`).
- **Responsibilities.** **None implemented.** Only `AGENTS.md` + `runtime.manifest.json`. Notification logic currently lives in `@letbuyy/notification-core` (consumed by queue-workers) and Resend calls in api-gateway/identity-platform.
- **Consumers / Integrations / Data.** None present.
- **Runtime ownership.** Reserved placeholder.
- **Known issues.** Empty reserved runtime; named authority implemented elsewhere.
- **CLAUDE.md map.** Not in CLAUDE.md Canonical Runtime Map. Governed in runtime-boundaries. No deprecated aliases.

## services/search-service — Reserved (manifest only)

- **Purpose.** Manifest `"reserved-service"`, `"search-service-plane"`, "Reserved search and indexing authority for storefront, merchant, and marketplace discovery" (`services/search-service/runtime.manifest.json:10-14`).
- **Responsibilities.** **None implemented.** Only `AGENTS.md` + `runtime.manifest.json`. Search indexing/query is currently implemented as Supabase `search_documents` projections written by queue-workers (`platform-queue-consumer.ts`) and read by api-gateway storefront routes.
- **Consumers / Integrations / Data.** None present.
- **Runtime ownership.** Reserved placeholder.
- **Known issues.** Empty reserved runtime; functionality implemented elsewhere.
- **CLAUDE.md map.** Not in CLAUDE.md Canonical Runtime Map. Governed in runtime-boundaries. No deprecated aliases.

## services/media-service — Reserved (manifest only)

- **Purpose.** Manifest `"reserved-service"`, `"media-service-plane"`, "Reserved media upload, transformation, metadata, storage, and delivery authority" (`services/media-service/runtime.manifest.json:9-13`).
- **Responsibilities.** **None implemented.** Only `AGENTS.md` + `runtime.manifest.json`. Media upload today is api-gateway `/upload` + `/media` routes writing R2 (`R2_BUCKET`) and the `media` table.
- **Consumers / Integrations / Data.** None present.
- **Runtime ownership.** Reserved placeholder.
- **Known issues.** Empty reserved runtime.
- **CLAUDE.md map.** Not in CLAUDE.md Canonical Runtime Map. Governed in runtime-boundaries. No deprecated aliases.

## services/analytics-pipeline — Reserved (manifest only)

- **Purpose.** Manifest `"reserved-service"`, `"analytics-service-plane"`, "Reserved analytics ingestion, aggregation, attribution, and reporting pipeline authority" (`services/analytics-pipeline/runtime.manifest.json:8-12`).
- **Responsibilities.** **None implemented.** Only `AGENTS.md` + `runtime.manifest.json`. Analytics today is Supabase `analytics_event_stream` + rollup planning in queue-workers (`platform-queue-consumer.ts`) and api-gateway `/analytics` routes.
- **Consumers / Integrations / Data.** None present.
- **Runtime ownership.** Reserved placeholder.
- **Known issues.** Empty reserved runtime; functionality implemented elsewhere.
- **CLAUDE.md map.** Not in CLAUDE.md Canonical Runtime Map. Governed in runtime-boundaries. No deprecated aliases.

---

## Cross-runtime observations (factual)

1. **CLAUDE.md Canonical Runtime Map vs. filesystem.** CLAUDE.md lists 8 apps + 3 mobile + 2 services (api-gateway, webhook-service). The filesystem additionally contains: `apps/developer-portal` (real, governed in topology/runtime-boundaries but omitted from CLAUDE.md map) and `services/{queue-workers, checkout-runtime, event-bus, media-service, notification-service, search-service, analytics-pipeline}` (governed in `docs/governance/runtime-boundaries.md` and `config/runtime/*-topology.json`, but only api-gateway+webhook-service appear in the CLAUDE.md "Canonical Runtime Map"). All are pnpm/topology members.
2. **Deprecated aliases.** No active code references `apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/mobile/operator-team-app`, or `apps/storefront-runtime/consumer-storefront`. The only occurrences of these literals are the deny-list definition in `scripts/validators/governance-common.mjs:73-79`. (Confirms CLAUDE.md Deprecated Runtime Policy is currently honored in code.)
3. **Implemented vs. reserved services.** Of 9 services, 3 are implemented Cloudflare Workers (api-gateway, webhook-service, queue-workers) and 6 are manifest-only reserved placeholders. queue-workers' manifest `runtimeCategory` ("reserved-service") disagrees with its actual deployable worker status and with `deployment-topology.json` ("queue-worker").
4. **Functionality centralization.** Capabilities the reserved services "own" per manifest (checkout totals, event transport, notifications, search, media, analytics) are presently implemented inside api-gateway + queue-workers + Supabase tables, not in the named services.
5. **Default-environment coupling.** App/mobile default base URLs point to **staging** (web) or **production** (mobile dart-defines) and are env-overridable; several marketing CTAs hardcode staging accounts URLs as literal hrefs.
6. **Tests not wired.** All 12 `apps/*` + `services/*` `package.json` `test` scripts echo "No tests yet", although real test files exist for api-gateway (6), identity-platform (2), and merchant-app (1 Dart). 150 governance `*.test.mjs` files live under root `tests/` and are run via the root `package.json` instead.

---

## Evidence Index (every cited path)

Root / config:
- `/Users/saai_sidd/Git/Letbuyy_Store/CLAUDE.md`
- `/Users/saai_sidd/Git/Letbuyy_Store/pnpm-workspace.yaml`
- `/Users/saai_sidd/Git/Letbuyy_Store/package.json`
- `/Users/saai_sidd/Git/Letbuyy_Store/config/runtime/deployment-topology.json`
- `/Users/saai_sidd/Git/Letbuyy_Store/config/runtime/production-topology.json`
- `/Users/saai_sidd/Git/Letbuyy_Store/config/env/templates/{next-app.env.example,worker.env.example,mobile.dart-defines.example}`
- `/Users/saai_sidd/Git/Letbuyy_Store/config/env/schemas/{next-app.schema.json,worker.schema.json,mobile.schema.json}`
- `/Users/saai_sidd/Git/Letbuyy_Store/scripts/validators/governance-common.mjs`
- `/Users/saai_sidd/Git/Letbuyy_Store/docs/governance/runtime-boundaries.md`
- `/Users/saai_sidd/Git/Letbuyy_Store/FORENSIC_REPORT/03-application-reports.md`

apps/storefront-runtime:
- `runtime.manifest.json`, `package.json`, `vercel.json`, `next.config.ts`, `src/proxy.ts`
- `src/app/api/seed/route.ts`, `src/app/store/[subdomain]/[...path]/page.tsx`
- `src/app/store/[subdomain]/checkout/page.tsx`, `…/checkout/checkout-client.tsx`
- `src/lib/store-service.ts`, `src/lib/product-service.ts`, `src/lib/seo.ts`
- `src/app/storefront-landing.tsx`

apps/merchant-control-plane:
- `runtime.manifest.json`, `package.json`, `vercel.json`, `src/proxy.ts`
- `src/app/api/stores/[store]/products/route.ts`, `src/app/[store]/ats-score/page.tsx`
- `src/app/[store]/settings/payments/page.tsx`, `src/app/api/auth/logout/route.ts`
- `src/app/page.tsx`, `src/components/HeaderBar.tsx`, `src/components/theme-editor/CenterPanel.tsx`
- `src/components/Sidebar.tsx`, `src/lib/auth/session.ts`, `src/app/[store]/projects/page.tsx`
- `src/app/[store]/online-store/themes/page.tsx`

apps/identity-platform:
- `runtime.manifest.json`, `package.json`, `vercel.json`, `src/proxy.ts`
- `src/app/api/auth/login/route.ts`, `src/lib/auth/session.ts`, `src/lib/auth/cookies.ts`
- `src/lib/api/client.ts`, `src/lib/config/urls.ts`, `src/lib/email/resend.ts`
- `src/lib/db/schema.sql`, `src/app/api/auth/logout/route.ts`
- `src/__tests__/auth-flow.test.ts`, `src/__tests__/rate-limit.test.ts`

apps/marketing-site:
- `runtime.manifest.json`, `package.json`, `vercel.json`
- `src/app/signup/page.tsx`, `src/app/create/page.tsx`
- `src/components/{Navbar.tsx,CTASection.tsx,HeroSection.tsx,PricingSection.tsx}`

apps/app-marketplace:
- `runtime.manifest.json`, `package.json`, `vercel.json`
- `src/app/api/apps/route.ts`, `src/app/api/apps/[id]/install/route.ts`
- `src/lib/app-service.ts`, `src/lib/api/client.ts`, `src/lib/supabase/` (empty), `src/components/Footer.tsx`

apps/theme-marketplace:
- `runtime.manifest.json`, `package.json`, `vercel.json`
- `src/app/checkout/page.tsx`, `src/app/dashboard/purchases/page.tsx`
- `src/lib/theme-service.ts`, `src/lib/api/client.ts`
- `src/components/layout/navbar.tsx`, `src/hooks/useAuth.ts`

apps/platform-console:
- `runtime.manifest.json`, `package.json`, `vercel.json`
- `src/lib/console-auth-server.ts`, `src/lib/console-api.ts`, `src/lib/console-session.ts`
- `src/app/(dashboard)/{analytics,operations,subscriptions,employees}/page.tsx`

apps/platform-operations-portal:
- `runtime.manifest.json`, `package.json`, `vercel.json`, `src/proxy.ts`
- `src/lib/api/client.ts`
- `src/app/(dashboard)/{page.tsx,layout.tsx,crm/page.tsx,stores/page.tsx,users/page.tsx,marketing/page.tsx,merchant-health/page.tsx,support/page.tsx,operations/page.tsx}`
- `src/app/(auth)/{invite/page.tsx,login/page.tsx}`

apps/developer-portal:
- `runtime.manifest.json`, `package.json`
- `src/app/{page.tsx,dashboard/page.tsx,docs/page.tsx,api/page.tsx,sdk/page.tsx}`

apps/mobile/merchant-app:
- `runtime.manifest.json`, `pubspec.yaml`, `lib/config/app_config.dart`, `lib/services/store_auth_service.dart`
- `lib/screens/**` (products_screen.dart, orders_screen.dart, wizard/create_store_wizard.dart, subscription/pricing_screen.dart, premium/upgrade_screen.dart, settings/settings_screen.dart, auth/error_screen.dart)
- `dart-defines/{README.md,staging.json,production.json}`

apps/mobile/operator-app:
- `runtime.manifest.json`, `pubspec.yaml`, `lib/main.dart`

apps/mobile/shopper-app:
- `runtime.manifest.json` (directory contains only this + `AGENTS.md`)

services/api-gateway:
- `runtime.manifest.json`, `package.json`, `wrangler.toml`
- `src/index.ts`, `src/middleware/{auth.ts,rateLimit.ts}`, `src/lib/supabase.ts`
- `src/routes/{auth.ts,storefront.ts,operations.ts,internal-console.ts,app-store.ts,products.ts,stores.ts,ai.ts,employee.ts,admin.ts,contacts.ts,portfolio.ts,resume.ts,themes.ts,payments.ts,inventory.ts,media.ts,upload.ts,export.ts}`
- `src/graphql/{schema.ts,admin.ts,storefront.ts,bulk.ts,cost.ts,rest-shim.ts}`
- `src/durable/runtime-coordinator.ts`, `src/extensions/app-functions-runtime.ts`
- `src/__tests__/{tenant-isolation.test.ts,payments.test.ts,products.test.ts,security.test.ts,observability.test.ts,store-publish.test.ts}`

services/webhook-service:
- `runtime.manifest.json`, `package.json`, `wrangler.toml`
- `src/index.ts`, `src/app-lifecycle-dispatch.ts`

services/queue-workers:
- `runtime.manifest.json`, `package.json`, `wrangler.toml`
- `src/index.ts`, `src/platform-queue-consumer.ts`

services (reserved, manifest-only):
- `services/checkout-runtime/runtime.manifest.json`
- `services/event-bus/runtime.manifest.json`
- `services/notification-service/runtime.manifest.json`
- `services/search-service/runtime.manifest.json`
- `services/media-service/runtime.manifest.json`
- `services/analytics-pipeline/runtime.manifest.json`
