# LetBuyy — Lessons Learned

> Extracted from codebase analysis and security audit on 2026-03-01.
> Every anti-pattern found in the existing code, plus new findings from documentation audit.

---

## Lesson 1 — Schema Naming Inconsistency: `sites` vs `stores`
**What happened:** The database uses `sites` as the primary table name, but the codebase, URL paths, and documentation all refer to "stores" — e.g., `store_name`, `[store]` dynamic routes, `create-store` API.
**Rule:** ALWAYS use `sites` in database queries and `store` in user-facing UI/URLs. Document this mapping clearly. Never introduce a new table called `stores`.
**Location:** `backend/supabase/migrations/001_initial_schema.sql` (table is `sites`), `apps/web/consumer/admin/src/app/[store]/` (route uses `store`)
**Severity:** MEDIUM

---

## Lesson 2 — Missing Soft Deletes on All Tables
**What happened:** No table in the schema has a `deleted_at` column. Deletes are hard deletes via `ON DELETE CASCADE`. Data recovery impossible, audit trails broken.
**Rule:** ALWAYS add `deleted_at TIMESTAMPTZ DEFAULT NULL` to every entity table. Use soft deletes in application code — never hard delete user-created content.
**Location:** `backend/supabase/migrations/001_initial_schema.sql` — every `CREATE TABLE`
**Severity:** MEDIUM

---

## Lesson 3 — Missing Audit Columns
**What happened:** Tables lack `created_by` and `updated_by` columns. No way to track who modified a record.
**Rule:** ALWAYS include `created_by UUID` and `updated_by UUID` on tables where multiple users can modify records.
**Location:** `backend/supabase/migrations/001_initial_schema.sql` — products, orders, pages
**Severity:** MEDIUM

---

## Lesson 4 — Missing Version Column for Optimistic Locking
**What happened:** No table has a `version` column, so concurrent writes silently overwrite each other.
**Rule:** ALWAYS add `version INT DEFAULT 1` to tables with concurrent write potential.
**Location:** `backend/supabase/migrations/` — products, orders, sites, pages
**Severity:** MEDIUM

---

## Lesson 5 — Production Secrets Committed to Repository
**What happened:** `all.env` contains 9 live production secrets committed to git: Supabase keys (including service role key), Upstash Redis token, Resend API key, Razorpay keys, auth secrets, CSRF secret, customer session secret.
**Rule:** NEVER commit actual secrets to git. Use `all.env.example` with placeholder values. Store real secrets in environment variables via Vercel/Cloudflare dashboards only. Purge from git history.
**Location:** `all.env` lines 8-47
**Severity:** CRITICAL

---

## Lesson 6 — Inconsistent Trigger Function Names
**What happened:** Migration 001 creates `update_updated_at()`, migration 027 references `update_updated_at_column()`, and doc 01_Architecture uses `update_modified_at()`. Three different names for the same function.
**Rule:** ALWAYS use a single, consistent trigger function name: `update_updated_at()`. Verify the function exists before creating triggers that reference it.
**Location:** `001_initial_schema.sql` line 578, `027_missing_tables.sql` line 342, `01_Architecture.md` line 530
**Severity:** HIGH

---

## Lesson 7 — Duplicate Migration Number
**What happened:** Two migration files numbered `022`: `022_deactivate_non_urban_kicks_themes.sql` and `022_media_and_forms.sql`. This causes migration conflicts.
**Rule:** NEVER duplicate migration numbers. Always check the latest number before creating a new migration.
**Location:** `backend/supabase/migrations/022_*.sql`
**Severity:** HIGH

---

## Lesson 8 — No API Versioning
**What happened:** All API routes (Hono worker and Next.js) are unversioned. `/api/auth/login` not `/api/v1/auth/login`. Breaking changes impossible to manage.
**Rule:** ALWAYS version API endpoints: `/api/v1/auth/login`.
**Location:** `apps/web/consumer/accounts/src/app/api/auth/`, `backend/workers/api/src/`
**Severity:** HIGH

---

## Lesson 9 — Auth Logic Split Between Apps
**What happened:** Authentication is implemented in 18 Next.js API route files in accounts app, not in the centralized Cloudflare Worker API. Auth logic duplicated and inconsistent.
**Rule:** ALWAYS centralize auth operations in the API gateway worker. Next.js apps should call the worker API.
**Location:** `apps/web/consumer/accounts/src/app/api/auth/` (18 route files)
**Severity:** HIGH

---

## Lesson 10 — Suppressed Linting Rules
**What happened:** `analysis_options.yaml` suppresses warnings: `unused_field: ignore`, `dead_code: ignore`, `avoid_print: false`, `empty_catches: false`. Hides real code quality issues.
**Rule:** NEVER suppress lint warnings globally. Fix the underlying issues instead.
**Location:** `analysis_options.yaml` lines 14-44
**Severity:** MEDIUM

---

## Lesson 11 — KV and R2 Not Configured
**What happened:** `wrangler.toml` has KV namespaces and R2 buckets commented out. API worker has no caching or file storage despite docs describing them.
**Rule:** ALWAYS configure all infrastructure bindings referenced in docs. If not ready, document as TODO, not commented-out code.
**Location:** `backend/workers/api/wrangler.toml` lines 9-17
**Severity:** MEDIUM

---

## Lesson 12 — Order Items Stored as JSONB
**What happened:** Orders store items as a JSONB array (`items JSONB NOT NULL`). Impossible to query individual items, calculate per-product sales, or manage inventory via SQL.
**Rule:** ALWAYS use a proper `order_items` relational table with foreign keys. JSONB is for flexible metadata, not core relational data.
**Location:** `backend/supabase/migrations/001_initial_schema.sql` line 124
**Severity:** HIGH

---

## Lesson 13 — Inconsistent Error Response Format
**What happened:** Different API routes return errors differently: `{ error: string }`, `{ message: string }`, raw strings. No standard error codes.
**Rule:** ALWAYS return: `{ error: { code: "ERROR_CODE", message: "Human readable", details?: any } }`.
**Location:** Various API route files across accounts, storefront, admin
**Severity:** HIGH

---

## Lesson 14 — Documentation vs Code Out of Sync
**What happened:** IMPLEMENTATION_PLAN.md defines `order_items` as a separate table, but actual migration stores items as JSONB. Docs say Next.js 15.1, code uses 16.1. Docs say `update_modified_at()`, code uses `update_updated_at()`.
**Rule:** ALWAYS keep documentation and code in sync. When changing one, update the other.
**Location:** Throughout docs/ and IMPLEMENTATION_PLAN.md
**Severity:** HIGH

---

## Lesson 15 — Business Logic in Route Handlers
**What happened:** Next.js API routes contain inline business logic — password hashing, email sending, session management, database queries — all in the route handler function.
**Rule:** NEVER put business logic in route handlers. Create service modules (`src/lib/services/`) and call them from handlers.
**Location:** `accounts/src/app/api/auth/signup/route.ts`, `storefront/src/app/api/orders/route.ts`
**Severity:** HIGH

---

## Lesson 16 — Next.js Version Mismatch
**What happened:** Storefront uses 16.1.1 while accounts, admin, and landing use 16.1.6. Subtle runtime differences and monorepo build issues possible.
**Rule:** ALWAYS keep all Next.js apps on the same version. Pin in root workspace config.
**Location:** `storefront/package.json` (16.1.1) vs others (16.1.6)
**Severity:** MEDIUM

---

## Lesson 17 — Zero Test Files Exist
**What happened:** No test files across all web apps, API worker, or Flutter apps. No unit tests, no integration tests, no e2e tests. `turbo.json` defines a `test` task but nothing to run.
**Rule:** ALWAYS write tests for business logic, API endpoints, and critical user flows before marking a feature complete.
**Location:** All apps — no `__tests__/`, `*.test.ts`, or `*.spec.ts` files
**Severity:** CRITICAL

---

## Lesson 18 — Console and Team Apps Are Scaffold Only
**What happened:** `console/` and `team/` apps contain only scaffold pages with minimal content. No actual functionality.
**Rule:** ALWAYS document the completion status of each app clearly. Don't count scaffold pages as "built" features.
**Location:** `apps/web/administrative/console/`, `apps/web/administrative/team/`
**Severity:** MEDIUM

---

## Lesson 19 — Shared UI Package Is Minimal
**What happened:** `@letbuyy/ui` contains only 3 components (Button, Input, DataTable). Each app re-implements common components independently.
**Rule:** ALWAYS extract shared components to `@letbuyy/ui` when used in 2+ apps.
**Location:** `packages/typescript/ui/src/` — only 3 components
**Severity:** MEDIUM

---

## Lesson 20 — No Standardized Font or Design Tokens
**What happened:** Each app defines its own CSS custom properties and font choices independently. No shared design token file.
**Rule:** ALWAYS use shared design tokens in `@letbuyy/ui`. Define colors, typography, spacing, shadows centrally.
**Location:** Various `globals.css` files across apps
**Severity:** MEDIUM

---

## Lesson 21 — No Webhook Signature Verification
**What happened:** Payment webhook endpoints (Stripe, Razorpay, PayPal) exist in docs and routes but have no cryptographic signature verification. An attacker could fake payment confirmations.
**Rule:** ALWAYS verify webhook signatures before processing. Use `stripe.webhooks.constructEvent()`, Razorpay HMAC verification, PayPal IPN verification.
**Location:** `backend/workers/api/` webhook routes
**Severity:** CRITICAL

---

## Lesson 22 — Missing Rate Limiting on Auth Endpoints
**What happened:** Only the accounts app has partial rate limiting via Upstash Redis. Many auth endpoints (signup, login, OTP verify, password reset) lack rate limiting, enabling brute-force attacks.
**Rule:** ALWAYS add rate limiting to all auth endpoints: 5/min for sensitive ops (OTP, password), 10/min for login, 3/min for password reset.
**Location:** `apps/web/consumer/accounts/src/app/api/auth/`
**Severity:** CRITICAL

---

## Lesson 23 — No CSRF Protection on Mutating Endpoints
**What happened:** CSRF_SECRET is defined in env vars but no actual CSRF token validation middleware exists on state-mutating endpoints (POST, PUT, DELETE).
**Rule:** ALWAYS implement CSRF token validation (double-submit cookie pattern) on all mutating API endpoints.
**Location:** All Next.js route handlers and Hono routes
**Severity:** HIGH

---

## Lesson 24 — Client-Sent Prices Trusted for Payments
**What happened:** No evidence of server-side price re-calculation before payment processing. Client could send a modified price to the checkout endpoint.
**Rule:** ALWAYS re-calculate order total server-side from product prices in the database before creating a payment session. NEVER trust client-submitted prices.
**Location:** Payment API routes
**Severity:** CRITICAL

---

## Lesson 25 — Internal Error Details Exposed in API Responses
**What happened:** Several API routes return raw Supabase error messages (`error.message`) directly to clients, potentially exposing internal database structure.
**Rule:** ALWAYS sanitize error responses. Log the full error server-side, return a generic code+message to the client.
**Location:** Various API routes — `c.json({ error: error.message }, 500)`
**Severity:** HIGH

---

## Lesson 26 — CORS Wildcard Risk
**What happened:** Hono CORS middleware configured with `origin: ['https://letbuyy.store', 'https://*.letbuyy.store']` which is correct in docs, but actual code needs verification. Wildcard origins in production are a security vulnerability.
**Rule:** ALWAYS configure CORS with explicit origin whitelist. NEVER use `*` in production.
**Location:** `backend/workers/api/src/`
**Severity:** HIGH

---

## Lesson 27 — Missing Security Headers
**What happened:** No security headers middleware configured: no `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, or `X-XSS-Protection`.
**Rule:** ALWAYS set security headers on all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `HSTS: max-age=31536000`, `X-XSS-Protection: 1; mode=block`.
**Location:** All apps — middleware files
**Severity:** MEDIUM

---

## Lesson 28 — Documentation Explosion Without Consolidation
**What happened:** 40+ documentation files across 4 locations (consumer/docs, docs/, docs/Audit/, root) totaling 60,000+ lines. Massive duplication — the same overview, architecture, and schema content repeated 3-5 times. Contradictions between files (e.g., Next.js version, trigger function names, table counts).
**Rule:** ALWAYS maintain a single source of truth. All platform documentation in `docs/LETBUYY.md`. Delete all other docs after extracting unique content.
**Location:** `apps/web/consumer/docs/` (20 files), `docs/` (40 files)
**Severity:** HIGH

---

## Lesson 29 — Aspirational Features Documented as Built
**What happened:** Docs describe features as implemented (e.g., "4-model AI engine", "KV caching", "R2 file storage", "real-time collaboration") that don't actually exist in the codebase. Creates confusion about what's actually built vs planned.
**Rule:** ALWAYS clearly distinguish between "IS built" and "SHOULD be built". Use status badges: ✅ Built, 🔶 Partial, ❌ Not Started.
**Location:** `00_Overview.md` (AI engine described as built), `01_Architecture.md` (R2/KV described as configured)
**Severity:** HIGH

---

## Lesson 30 — Super Admin Console Has No Access Controls
**What happened:** Docs describe VPN + 2FA + IP whitelist for console.letbuyy.store, but the actual app is scaffold-only with no access control implementation.
**Rule:** ALWAYS implement security controls BEFORE building features for admin/console apps. Access control is prerequisite, not afterthought.
**Location:** `apps/web/administrative/console/`
**Severity:** CRITICAL

---

## Lesson 31 — No Error Boundaries
**What happened:** No error boundary components exist in any Next.js app. Runtime errors crash the entire page instead of showing a retry-able error UI.
**Rule:** ALWAYS add error boundaries to every page component. Use Next.js `error.tsx` in every route segment.
**Location:** All Next.js apps — no `error.tsx` files found
**Severity:** MEDIUM

---

## Lesson 32 — No Structured Logging
**What happened:** No structured logging configured (no Axiom, no Logflare, no Sentry). Console.log is the only logging. No way to debug production issues, track errors, or monitor performance.
**Rule:** ALWAYS implement structured logging before going to production. Use Axiom or equivalent for logs, Sentry for error tracking.
**Location:** All apps
**Severity:** MEDIUM

---

## Lesson 33 — Missing Environment Variable Documentation
**What happened:** Each app needs different env vars but there's no documentation mapping which app needs which variables. Developers must reverse-engineer from code.
**Rule:** ALWAYS maintain an environment variable matrix documenting which variables are needed by which app and whether they're public or secret.
**Location:** `all.env` has comments but no formal matrix
**Severity:** LOW

---

## Lesson 34 — No CI/CD Pipeline
**What happened:** `turbo.json` defines build/lint/test tasks and a GitHub Actions workflow was discussed but no actual `.github/workflows/` configuration exists for automated testing and deployment.
**Rule:** ALWAYS configure CI/CD before going to production. Automate: lint → test → build → deploy with migration execution.
**Location:** Root — no `.github/workflows/` for this project
**Severity:** MEDIUM

---

## Lesson 35 — Commented-Out Infrastructure Code
**What happened:** `wrangler.toml` has KV namespaces and R2 bucket configurations commented out instead of being properly documented as TODO or tracked in tasks.
**Rule:** NEVER leave commented-out infrastructure config. Either remove it and track in todo, or configure it properly.
**Location:** `backend/workers/api/wrangler.toml` lines 9-17
**Severity:** LOW

---

## Lesson 36 — Repository Intelligence Scans Must Exclude Generated Outputs
**What happened:** The first repository intelligence scan included Flutter iOS `.symlinks` dependency sources and would have self-scanned generated AGENTS/docs on the next run. This inflated source counts and polluted topic risk reports with third-party dependency files.
**Rule:** ALWAYS exclude generated intelligence outputs, dependency symlinks, build output, package manager caches, and compiled artifacts from architecture scans. Keep source-derived docs tied to first-party repository systems only.
**Location:** `scripts/generate-repository-intelligence.mjs`
**Severity:** MEDIUM

---

## Lesson 37 — Hardcoded Payment Provider Key IDs in Source
**What happened:** The repository scan found Razorpay-style public key identifiers hardcoded in Dart services/config, storefront checkout, and admin subscription checkout code. Even public provider key IDs should be environment-driven to prevent mode confusion, accidental live/test mixing, and tenant-specific payment leakage.
**Rule:** ALWAYS load payment provider identifiers from scoped environment/config values. Never hardcode Razorpay, Stripe, PayPal, or gateway-specific key identifiers in source code.
**Location:** `packages/dart/core/lib/src/config/razorpay_config.dart`, `packages/dart/services/lib/src/custom_payment_service.dart`, `apps/web/consumer/storefront/src/app/store/[subdomain]/checkout/checkout-client.tsx`, `apps/web/consumer/admin/src/app/api/subscribe/route.ts`
**Severity:** HIGH
