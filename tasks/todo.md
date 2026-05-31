# LetBuyy — Task List

> Rewritten 2026-03-01 after full documentation consolidation and security audit.

---

## ✅ COMPLETED — Repository Intelligence Reconstruction

- [x] Generate root `AGENTS.md` as the master engineering constitution from the current repository scan
- [x] Generate `docs/architecture/master-system-intelligence.md` with 60,000+ lines of source-derived system intelligence
- [x] Generate topic intelligence directories under `docs/`
- [x] Generate required app and package `AGENTS.md` files, including alias governance files for requested compatibility paths
- [x] Add repeatable `scripts/generate-repository-intelligence.mjs` generator for future refreshes

---

## 🔴 PHASE 0 — EMERGENCY (Do Before Anything Else)

### Secrets Rotation (CRITICAL — Committed to `all.env`)
- [ ] Rotate Supabase anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- [ ] Rotate Supabase service role key (`SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Rotate Turnstile secret key (`TURNSTILE_SECRET_KEY`)
- [ ] Rotate Upstash Redis token (`UPSTASH_REDIS_REST_TOKEN`)
- [ ] Rotate Resend API key (`RESEND_API_KEY`)
- [ ] Rotate auth secret (`AUTH_SECRET`)
- [ ] Rotate CSRF secret (`CSRF_SECRET`)
- [ ] Rotate customer session secret (`CUSTOMER_SESSION_SECRET`)
- [ ] Rotate Razorpay key secret (`RAZORPAY_KEY_SECRET`)
- [ ] Replace all hardcoded Razorpay key identifiers in Dart, admin, and storefront source with environment-driven public keys
- [ ] Delete `all.env` from git, create `all.env.example` with placeholders
- [ ] Purge `all.env` from git history (`git filter-branch` or BFG Repo-Cleaner)
- [ ] Verify `.gitignore` blocks `all.env` and all `*.env` files

### Webhook Signature Verification (CRITICAL)
- [ ] Add Stripe webhook signature verification (`stripe.webhooks.constructEvent()`)
- [ ] Add Razorpay webhook signature verification (`crypto.createHmac()`)
- [ ] Add PayPal webhook signature verification

### Auth Rate Limiting (CRITICAL)
- [ ] Add rate limiting to `/api/auth/signup` (5/min/IP)
- [ ] Add rate limiting to `/api/auth/login` (10/min/IP)
- [ ] Add rate limiting to `/api/auth/verify-otp` (3/min/IP)
- [ ] Add rate limiting to `/api/auth/send-reset` (3/min/IP)
- [ ] Add rate limiting to `/api/auth/set-password` (5/min/IP)

---

## 🔴 PHASE 1 — Schema & Security (40-50h)

### Schema Compliance
- [ ] Add `deleted_at TIMESTAMPTZ DEFAULT NULL` to all entity tables (migration 028)
- [ ] Add `created_by UUID` and `updated_by UUID` audit columns to key tables (migration 029)
- [ ] Add `version INT DEFAULT 1` for optimistic locking on products, orders, sites, pages (migration 030)
- [ ] Fix duplicate migration number 022 (rename `022_media_and_forms.sql` → `022b_media_and_forms.sql`)
- [ ] Fix inconsistent trigger function name — standardize to `update_updated_at()`
- [ ] Create proper `order_items` table and migrate JSONB items data (migration 031)
- [ ] Add missing indexes on un-indexed foreign keys
- [ ] Add missing RLS policies on any tables without them

### Security Hardening
- [ ] Add CSRF token validation to all mutating API routes
- [ ] Add security headers middleware (X-Content-Type-Options, X-Frame-Options, HSTS, X-XSS-Protection)
- [ ] Implement server-side price re-calculation on all payment endpoints
- [ ] Add error sanitization — never expose DB errors or stack traces in API responses
- [ ] Configure CORS with explicit origin whitelist (no wildcard)
- [ ] Add brute-force prevention (5 failed logins → 15min lockout)

### API Consistency
- [ ] Add API versioning prefix `/api/v1/` to all Hono worker routes
- [ ] Add API versioning prefix `/api/v1/` to all Next.js API routes
- [ ] Standardize error response format: `{ error: { code, message, details } }`
- [ ] Add Zod validation to every API route handler that doesn't have it
- [ ] Create shared error code constants in `@letbuyy/api-types`

### Code Quality
- [ ] Centralize auth logic in API worker — remove from Next.js route handlers
- [ ] Extract business logic from route handlers into service modules
- [ ] Pin all Next.js apps to same version (16.1.6)
- [ ] Remove suppressed lint rules in `analysis_options.yaml`

---

## 🟡 PHASE 2 — Complete P0 Features (120-150h)

### Auth System
- [ ] Implement proper refresh token rotation
- [ ] Implement token revocation strategy (logout all devices)
- [ ] Add 2FA (TOTP) support for Super Admin Console
- [ ] Implement email allowlist for console.letbuyy.store
- [ ] Implement VPN + IP whitelist for console.letbuyy.store

### Admin Dashboard (Complete remaining sections)
- [ ] Implement full shipping configuration UI
- [ ] Implement full inventory management UI (multi-location)
- [ ] Implement tax rate management UI
- [ ] Complete blog post management (create, edit, publish with Tiptap)
- [ ] Implement media library / file manager
- [ ] Implement customer management views
- [ ] Complete analytics dashboard with real data
- [ ] Implement coupon creation and management UI

### Storefront (Complete e-commerce flow)
- [ ] Implement server-side cart persistence (carts table)
- [ ] Implement abandoned cart recovery emails
- [ ] Complete product review/rating display and submission
- [ ] Implement product search (PostgreSQL full-text search)
- [ ] Implement product collections and smart collections UI
- [ ] Implement SEO meta tags rendering per store
- [ ] Implement sitemap.xml generation per store
- [ ] Complete customer account: order history, addresses, profile

### Payments (Full integration)
- [ ] Complete Razorpay checkout integration (frontend + backend)
- [ ] Complete Stripe checkout integration (frontend + backend)
- [ ] Complete PayPal checkout integration (frontend + backend)
- [ ] Implement subscription billing for store owners (plan upgrades/downgrades)
- [ ] Implement refund processing
- [ ] Implement invoice generation

### Console (Super Admin) — Currently scaffold only
- [ ] Implement dashboard with platform metrics
- [ ] Implement users management (list, search, suspend/unsuspend)
- [ ] Implement stores management (list, search, view details, suspend)
- [ ] Implement subscription management (revenue overview, invoices)
- [ ] Implement employee management (invite, roles, deactivate)
- [ ] Implement audit logs viewer
- [ ] Implement feature flag management

### Team (Employee Portal) — Currently scaffold only
- [ ] Implement login with email allowlist
- [ ] Implement support ticket system
- [ ] Implement user lookup (read-only)
- [ ] Implement store moderation tools
- [ ] Implement role-based access control (14 permission scopes)

---

## 🟡 PHASE 3 — Polish, Testing & Launch Readiness (80-100h)

### Testing (Zero tests currently exist)
- [ ] Set up Vitest for web apps
- [ ] Set up Flutter test framework
- [ ] Write unit tests for auth service functions
- [ ] Write unit tests for payment processing
- [ ] Write unit tests for order management
- [ ] Write integration tests for critical API endpoints
- [ ] Write e2e tests for critical flows (signup → store → product → order)

### UI/UX Polish
- [ ] Standardize font family to Inter across all apps
- [ ] Create shared design token file in `@letbuyy/ui`
- [ ] Implement dark mode on ALL screens (verify coverage)
- [ ] Replace all spinner-only loading with skeleton screens
- [ ] Add empty state illustrations to all list views
- [ ] Add error boundaries to all page components
- [ ] Ensure all interactive elements have 5 states

### Performance
- [ ] Configure Cloudflare KV for session caching
- [ ] Configure Cloudflare R2 for file storage
- [ ] Implement Redis caching for store lookup and product queries
- [ ] Run Lighthouse audits on all public-facing pages (target 90+)
- [ ] Optimize bundle sizes with code splitting

### Monitoring & Observability
- [ ] Set up structured logging (Axiom)
- [ ] Set up error tracking (Sentry)
- [ ] Set up uptime monitoring
- [ ] Implement health check endpoints

### Deployment
- [ ] Configure CI/CD pipeline (GitHub Actions)
- [ ] Set up staging environment
- [ ] Configure domain DNS for all subdomains
- [ ] Test zero-downtime deployments

---

## 🟢 PHASE 4 — P1 Features (50-60h)

- [ ] AI-powered product descriptions (multi-model routing)
- [ ] AI content generation for portfolios/resumes
- [ ] Theme marketplace: developer submission flow
- [ ] App Store: developer API and SDK
- [ ] Multi-language / i18n support
- [ ] Email campaign builder
- [ ] Abandoned cart recovery automation
- [ ] Advanced analytics dashboards (cohort analysis, funnel)
- [ ] PDF resume export system
- [ ] Bulk product import/export (CSV)
- [ ] Multi-currency automatic conversion

---

## 🟢 PHASE 5 — P2 Features (40-50h)

- [ ] Custom domain setup (CNAME mapping)
- [ ] Multi-store management (single account, multiple stores)
- [ ] Social commerce integrations (Instagram, Facebook Shop)
- [ ] POS (Point of Sale) integration
- [ ] Affiliate/referral program
- [ ] A/B testing for storefronts
- [ ] Mobile push notifications (FCM)
- [ ] Real-time collaboration on store editing
- [ ] White-label / enterprise deployment
- [ ] Public API for third-party integrations

---

## SKIPPED — NEEDS HUMAN

SKIP: Start local infrastructure — Reason: `docker-compose` is not installed and the installed Docker CLI does not provide the `docker compose` plugin, so the local stack cannot be started without installing Docker Compose tooling. Resume point: Phase 0 Task 0.4.

SKIP: Razorpay provider order creation smoke test — Reason: Razorpay test credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) are not available in this environment, so live provider order creation and webhook smoke testing cannot be executed safely. Resume point: Phase 2 Task 2.5 after configuring Razorpay test credentials.

SKIP: Phase 3.7 merchant install/editor/publish live verification — Reason: local merchant auth/API database stack is unavailable because Docker Compose was skipped, and no authenticated merchant session or live worker credentials are available in this environment. Resume point: Phase 3 Task 3.7 after local infrastructure and merchant auth credentials are available.

---

## GOVERNANCE FAILURES — PHASE 0

- `pnpm run validate:governance` failed in `Stale artifact validator`: untracked/generated/forbidden topology artifacts were detected at app/package-local `node_modules` paths, including `apps/app-marketplace/node_modules`, `apps/identity-platform/node_modules`, `apps/marketing-site/node_modules`, `apps/merchant-control-plane/node_modules`, `apps/platform-console/node_modules`, `apps/platform-operations-portal/node_modules`, `apps/storefront-runtime/node_modules`, `apps/theme-marketplace/node_modules`, and multiple `packages/*/node_modules` directories. Baseline command exit code: 1.

---

## TYPECHECK BASELINE — PHASE 0

- `pnpm turbo typecheck` completed successfully: 53 tasks succeeded, 0 TypeScript errors, command exit code 0.

---

## GOVERNANCE FAILURES — PHASE 1 VERIFICATION

- `pnpm run validate:governance` failed in `Stale artifact validator`: untracked/generated/forbidden topology artifacts were detected at app/package-local `.turbo`, `dist`, and `node_modules` paths after dependency install and typecheck/build verification, including `apps/*/.turbo`, `apps/*/node_modules`, `packages/app-engine/.turbo`, `packages/app-engine/dist`, `packages/app-engine/node_modules`, and `packages/application-services/.turbo`. All other governance validators reported pass before this stale artifact failure. Verification command exit code: 1.

---

## GOVERNANCE FAILURES — PHASE 2 VERIFICATION

- `pnpm run validate:governance` failed in `Stale artifact validator`: untracked/generated/forbidden topology artifacts were detected at local install/build cache paths, including `apps/app-marketplace/.turbo`, `apps/app-marketplace/node_modules`, `apps/identity-platform/.turbo`, `apps/identity-platform/node_modules`, `apps/marketing-site/.turbo`, `apps/marketing-site/node_modules`, `apps/merchant-control-plane/.turbo`, `apps/merchant-control-plane/node_modules`, `apps/platform-console/.turbo`, `apps/platform-console/node_modules`, `apps/platform-operations-portal/.turbo`, `apps/platform-operations-portal/node_modules`, `apps/storefront-runtime/.turbo`, `apps/storefront-runtime/node_modules`, `apps/theme-marketplace/.turbo`, `apps/theme-marketplace/node_modules`, `packages/app-engine/.turbo`, `packages/app-engine/dist`, `packages/app-engine/node_modules`, and `packages/application-services/.turbo`. All other governance validators reported pass before this stale artifact failure. Verification command exit code: 1.
