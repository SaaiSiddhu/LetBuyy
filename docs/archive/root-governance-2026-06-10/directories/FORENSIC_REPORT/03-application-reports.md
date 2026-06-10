# Application Investigation Report

All web apps: Next.js 16.1.6 App Router, React 19.2.3, TypeScript 5.x, JWT httpOnly-cookie sessions, data exclusively via `@letbuyy/api-client` → api-gateway (`https://api.letbuyy.store/v1`). No app imports another app; none touch Supabase directly (grep-verified, 0 hits for `@supabase/supabase-js` under `apps/`).

---

## apps/storefront-runtime — customer storefront

- **Size**: 154 files; 29 page routes under `/store/[subdomain]/*` (product, products, cart, checkout, checkout/success, account/{orders,addresses,settings,wishlist}, blog/[slug], shop, policies) plus `/demo/urban-kicks` and `/preview`; 21 API routes (customer auth/profile/addresses/orders/wishlist, guest orders, reviews, coupons/validate, store-lookup, themes, themes/install, seed).
- **Architecture**: `src/proxy.ts` resolves tenant from `x-store-subdomain` header / forwarded host and rewrites to `/store/[subdomain]`. `src/lib/` services (customer/product/order/store/content) wrap the gateway client; `src/lib/theme-engine/` holds the local rendering pipeline (template-resolver, data-binding-engine, composition-engine, renderer-registry).
- **Auth**: customer JWT minted in `src/lib/session.ts` (`CUSTOMER_SESSION_SECRET`; throws at call time if missing — fail-late). Internal gateway calls HMAC-signed via `@letbuyy/auth-core`.
- **Notable**: hardcoded demo store (`src/lib/demo/urban-kicks-demo.ts`, store id `demo-urban-kicks-store`, 6 hardcoded products, mock reviews) short-circuits `StoreService.getStoreBySubdomain` (lines 54–57). `/api/seed` returns 410 in production. Caching: Next revalidation tags per store/product (`storefront:${subdomain}:products`); product fetches batched (`getProductsByIds`, Set-dedupe then Map lookup — no N+1 in sampled path); `next.config.ts` sets AVIF/WebP, 1-year immutable static caching, HSTS, CSP frame-ancestors for admin domains.
- **Risks**: no rate limiting on `/api/customer/login` (identity-platform has it; this surface does not); guest order lookup by email+order id with no visible rate limit; theme-preview cookie tokens (15-min TTL) normalized by regex only.

## apps/merchant-control-plane — merchant admin

- **Size**: 195 files; 78+ pages under `/[store]/…`; 62 API routes under `/api/stores/[store]/…` (products incl. CSV import, orders, customers, inventory adjust/levels, coupons, gift-cards, media/upload, navigation, pages, posts, policies, settings, shipping zones, taxes, users/employees, billing/plan/subscribe, ai, analytics, notifications, payment-config, reviews, comments, form-submissions, content sections) + global `/api/themes/*` (editor, draft, preview-session, releases incl. rollback, sections reorder, install, publish).
- **Tenancy enforcement**: every sampled API route begins with `resolveOwnedStoreId()` (`src/lib/stores/resolve-owned-store.ts`) — gateway-validated ownership, 401/404 on failure; `app/[store]/layout.tsx` enforces session + `getStoreForUser` at page level; `src/proxy.ts` gates all `[store]/*` on the `lb_session` cookie (`verifyLetbuyySessionCookieValue('merchant', …)`).
- **Theme editor**: GET/PUT `/api/themes/[themeId]/editor`, autosave drafts, releases + rollback; publish path calls `api.themes.publish(..., make_store_live: true)` — single-step to live.
- **Legacy product surface (verified line counts)**: `experience/page.tsx` 503, `education/page.tsx` 499, `certifications/page.tsx` 509, `skills/page.tsx` 473, `projects/page.tsx` 495, `testimonials/page.tsx` 492 — all `'use client'` CRUD pages with ConfirmDialog/EmptyState wiring against content APIs; `ats-score/page.tsx` is the sole `StubPage` (4 lines). Plus `gallery` (363 LOC, real media manager) and `leads` (445 LOC, real pipeline new→converted over form-submissions).
- **Risks**: store handle enumeration via 401/404 distinction (by design); AI page UI present with uncertain backend depth.

## apps/identity-platform — central auth

- **Size**: 75 files; 13 pages (lookup → login/signup → check-email/OTP → set/reset password → select account → onboarding/store creation); 19 API routes.
- **Controls (strongest app)**: per-IP+action rate limiting (`src/lib/rate-limit.ts`) on login/signup/send-reset/send-magic; Cloudflare Turnstile on signup/reset (`src/lib/turnstile.ts`); CSRF cookie + validation (`src/lib/auth/csrf.ts`; cookie `letbuyy_csrf` is deliberately non-httpOnly, `sameSite:'strict'`); bcryptjs cost 12; device fingerprinting + new-device email (`src/lib/auth/device.ts`); multi-account switcher via encrypted `lb_accounts` cookie (intentionally persists across logout — comment in merchant logout route); emails via Resend.
- **Findings**: `devOtp` returned in response body when `NODE_ENV !== 'production'` (`api/auth/signup/route.ts:21-23`); signup leaks account existence via 409 (reset flow does not); `/auth/callback` is an empty OAuth placeholder; magic-link endpoint exists, implementation not evidenced; only app with `src/lib/__tests__/` (4 files).

## apps/app-marketplace

39 src files; 20 pages (catalog `/apps/[slug]`, categories, search, `/developers/dashboard`) + 8 API routes (apps, install, developers/register). Real data via `createAppMarketplaceApiClient()`; signed internal headers for privileged calls. Smells: 14 inline-style violations, `any` in 3 pages, `console.error` in handlers, localStorage in Header.

## apps/theme-marketplace

Catalog/detail/pricing/checkout/install/dashboard routes; framer-motion 12; server-side aggregation (`Promise.all` category counts). Razorpay purchase flow; install calls `api.themes.install(slug,{store_id,…})` (`src/lib/theme-service.ts:112-122`). `any` types in 4 dashboard files.

## apps/developer-portal

9 files, `@letbuyy/ui` as its only workspace dep (manifest forbids api-client/auth-core). Pure build-time docs over `src/lib/reference.ts` (10 source files, 46 routes documented). Honest gap labels: `[SKIP - NEEDS SDK/CLI]`, `[SKIP - NEEDS BACKEND]`. Governed by `runtime.manifest.json` (classification `developer-ecosystem-plane`) — but absent from the `CLAUDE.md` canonical runtime map.

## apps/marketing-site

Static marketing (/, /pricing, /signup, /create); GSAP + Framer Motion + Lenis; zero API calls; uses `@letbuyy/api-types` (read-only contracts) not api-client.

## apps/platform-console

Super-admin: dashboard/stores/analytics/subscriptions/audit-logs/trust-safety/operations/settings/users/employees + login/MFA. Talks to privileged `/internal/console/*` gateway routes using static `PLATFORM_CONSOLE_API_TOKEN` (service-role-style bearer; `src/lib/console-api.ts`). Self-described scaffold-level in governance docs. `any` usage in `admin.ts`/`onboarding.ts` gateway counterparts.

## apps/platform-operations-portal

Ops portal: merchant-health (health bands healthy/watch/at_risk computed from products/orders/themes/payments/shipping signals), CRM, support, onboarding queue, communications, marketing. SafeRead<T> error-wrapped reads. Functional.

## Mobile

- **merchant-app (Flutter 3.10)**: 100+ Dart files — auth, dashboard stats, product CRUD, orders, analytics charts (fl_chart), subscription plans, full theme editor with device-frame previews (laptop/phone/tablet); Provider state; consumes all 5 `packages/dart/*`; Firebase config present (google-services.json / plist); session tokens in shared_preferences.
- **operator-app**: 1 file — `lib/main.dart` is the default Flutter counter (`MyHomePage`, `_counter++`). Does not consume shared Dart packages.
- **shopper-app**: no code; `runtime.manifest.json` + `AGENTS.md` only. There is **no customer-facing mobile experience**.
- Root `pubspec.yaml`/`analysis_options.yaml`/`pubspec.lock`: canonical Melos 7 workspace (`letbuyy_workspace`), not orphaned; scripts `run:builder`, `run:super_admin`.

## Cross-app observations

- Auth posture is inconsistent by surface: identity-platform (rate-limit+Turnstile+CSRF) ≫ storefront customer auth (none of those).
- Session secret handling is fail-late (throws on first use) rather than fail-fast at boot in storefront.
- `platform-console`'s static token model is the only non-session privileged path into the gateway.
