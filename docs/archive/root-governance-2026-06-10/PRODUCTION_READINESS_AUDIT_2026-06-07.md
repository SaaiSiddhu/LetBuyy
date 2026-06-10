# LetBuyy — Production Readiness Audit
**Date:** 2026-06-07 · **Scope:** entire monorepo (apps, services, packages, mobile, DB, governance, CI)

---

## TL;DR — the core foundation problem

The thing your gut is telling you is real, but it's **not** that the product code is junk. The backend (`services/api-gateway`) is genuinely solid: real Razorpay/Stripe flows with HMAC signature verification, idempotency, ownership checks, and double-payment guards. The merchant mobile app is a real ~60-screen app. RLS is configured. No real secrets are committed.

**The actual foundation issue is an inverted pyramid of confidence:**

> You have **167 governance validators that all pass**, 100KB+ of `CODEX_*` "hardening" ledgers, "convergence proofs", "split-brain" and "saga recovery" certifications — wrapped around a product that still has committed placeholder secrets that 500 the mobile backend, a rate limiter that 503s every request if one env var is missing, and a half-finished domain migration. **The green checkmarks are measuring the wrong thing.**

~60–70 of the 167 validators don't run code — they string-match words inside markdown/JSON "evidence" files. The `convergence-proof` manifest literally declares `mode: "governance-contract-not-live-evidence"`. The test suite mostly spawns validators and asserts they print "passed". So *"all validators green" tells you the documentation is internally consistent, not that the system works.* Six services (`checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`) are empty manifest-only stubs — meaning product **search and notifications/email are effectively unbuilt**.

**Verdict on "production-ready next week":** The *P0 deploy blockers below are fixable in a week* — they're config/secret/migration issues, not rewrites. But you must stop treating the validator suite as your readiness gate and instead drive off the checklist below. Realistically: a **soft/closed launch** in a week is achievable if you burn down P0+P1; a confident open launch needs the P1s closed and the missing notification/search surfaces decided.

---

## How the system is actually built (ground truth)

| Layer | Reality |
|---|---|
| **Backend** | `services/api-gateway` (~40k LOC, 36 route files, Hono on Cloudflare Workers + Supabase) is THE backend. Real, compiles clean. |
| **Payments** | Real. Razorpay + Stripe in `routes/payments.ts` + `packages/infrastructure/*-adapter`. Sig verification, idempotency, ownership, double-pay guards present. |
| **Frontend** | Real Next.js apps: `storefront-runtime`, `merchant-control-plane` (biggest), `identity-platform`, marketplace/portal apps. |
| **Mobile** | Real Flutter merchant app (~60 screens) wired to a real BFF. Not a scaffold. |
| **DB** | Supabase, 99 migrations, RLS configured (354 policies in baseline). |
| **Empty/reserved** | 6 services + `shopper-app`/`operator-app` are manifest-only stubs. Search + notifications are NOT implemented. |
| **Governance** | 167 validators, ~700 doc markdown files. Structural validators are real; certification/evidence validators mostly check that text exists in files. |

---

## P0 — Launch blockers (must fix before any production traffic)

**P0-1 · Mobile BFF is dead in every environment — committed placeholder secret**
`services/mobile-bff/wrangler.toml:30,60,100` ships `INTERNAL_API_SECRET = "SKIP_NEEDS_HUMAN_BFF_INTERNAL_API_SECRET"` for default/staging/production. At runtime `src/index.ts:139` rejects any secret starting with the placeholder prefix and returns **HTTP 500 for every session-authenticated request** — i.e. the entire mobile app (`/v1/stores`, `/v1/products`, `/v1/orders`, `/v1/payments`) is non-functional.
→ Generate a real secret, `wrangler secret put INTERNAL_API_SECRET`, remove the literal from wrangler.toml. Add a CI check that fails if any `SKIP_NEEDS_HUMAN` string exists in committed config.

**P0-2 · Rate limiter is fail-closed → 503 on every request if Redis isn't provisioned**
`services/api-gateway/src/middleware/rateLimit.ts:793-804,958-965`: in production with no Upstash Redis, the limiter returns `unavailable: true`. It's mounted on `api.use('/*')` (`index.ts:523`), so **every route — auth, storefront, checkout — returns 503**. Worse, the secret-setting script treats Upstash as *optional*, so it's easy to deploy without it.
→ Either make the limiter fall back to the always-present KV (`CACHE`) instead of hard-failing, or add a deploy gate that refuses production without `UPSTASH_REDIS_REST_URL`/`_TOKEN`.

**P0-3 · Domain migration is half-done — `letbuyy.store` hardcoded across runtime paths**
Canonical domain is `letbuyy.com` (per your migration), but live defaults still point to the old domain, and several are **string literals env vars cannot override**:
- Cookie domain: `apps/identity-platform/src/lib/auth/cookies.ts:40` and `config/env/production.env.example:52` (`COOKIE_DOMAIN=.letbuyy.store`) → **cross-app SSO silently breaks after DNS cutover** (cookies scoped to wrong apex).
- Storefront CSP `frame-ancestors`: `apps/storefront-runtime/next.config.ts:13-14` → theme-editor iframe embedding breaks.
- Transactional email: `apps/identity-platform/src/lib/email/resend.ts:4,232,291` (`noreply@letbuyy.store` + support links) → password-reset/verify emails from wrong domain, spam risk.
- Stripe success/cancel URLs: `services/api-gateway/src/routes/payments.ts:756-757` (hardcoded `https://letbuyy.store/checkout/...`) → post-payment redirect to wrong domain.
- Mobile defaults: `apps/mobile/merchant-app/lib/config/app_config.dart:11,17,23,29` + `packages/dart/core/.../api_constants.dart` → release builds hit the old domain.
- Footers/proxies in `app-marketplace`, `theme-marketplace`, `developer-portal`, platform portals.
→ Make `*_URL`/`COOKIE_DOMAIN` required (no hardcoded fallback), replace string literals with config/`--dart-define`, invert `production.env.example` so `.com` is default. There is **no validator scanning Dart for this** — add one.

**P0-4 · `AUTH_SECRET` falls back to empty string → cryptographically meaningless sessions**
`apps/identity-platform/src/lib/auth/cookies.ts:5` (`process.env.AUTH_SECRET || ''`) and `apps/platform-console/src/lib/console-session.ts:24`. If the env var is ever missing, JWTs are signed with an empty key — sessions *look* valid but are forgeable. A missing secret should crash the boot, not silently downgrade security.
→ Assert non-empty signing secrets at startup; never `|| ''` for a key.

---

## P1 — High (fix before relying on it / open launch)

**P1-1 · Tenant isolation is a manual invariant, not enforced.** api-gateway uses the RLS-bypassing **service-role** client in ~500 places; isolation depends on 151 manual `verifySiteOwnership` calls across 36 route files. RLS exists as a backstop (good) but is bypassed in the hot path. One forgotten check = cross-tenant data leak. → Add a route-level test/validator asserting every tenant-scoped query is preceded by an ownership check; consider a typed query wrapper that requires a verified `storeId`.

**P1-2 · Missing notification surfaces (the empty `notification-service` bites).** Three core flows are TODOs that silently drop: employee-invite email (`services/api-gateway/src/routes/employee.ts:287`, `admin.ts:283`), contact-form notification (`routes/contacts.ts:48`), and `order.paid` → no consumer (notification-service is empty). Merchants get no invite emails and no order alerts. → Decide per-flow: ship via Resend now, or gate the feature and document it.

**P1-3 · `webhook-service` secret compare isn't timing-safe.** `services/webhook-service/src/index.ts:568,658` uses `!==` on `INTERNAL_API_SECRET` (api-gateway correctly uses `timingSafeEqual`). Publicly routable dispatch endpoints. → Use the already-imported `timingSafeEqual`.

**P1-4 · Sensitive `/internal/*` routes lack per-IP brute-force limiting.** `services/api-gateway/src/index.ts:565-568` register `/internal/console` (returns full user/subscription/revenue data), `/internal/billing`, `/internal/events`, `/internal/store-access` before `authMiddleware`. Only the shared leaky-bucket touches them; no per-IP cap on failed auth. → Add a strict per-IP limiter keyed on `CF-Connecting-IP` regardless of auth outcome.

**P1-5 · Merchant admin silently logs out / 404s on any backend blip.** `apps/merchant-control-plane/src/lib/auth/session.ts:23,46,91` do `catch { return null/[] }`. A transient API error → redirect to login or `notFound()` for valid merchants. → Distinguish 401/403 from network errors; render an error boundary instead of redirecting.

**P1-6 · Empty services are wired into the live deployment topology.** `config/runtime/deployment-topology.json` gives the six empty services health-check names and dependency edges (e.g. `checkout-runtime` as an api-gateway dependency). Operators chasing a checkout incident will hunt a service that doesn't exist; health automation will false-green or false-fail. → Mark reserved services `"status":"placeholder"` and exclude from health evaluation.

**P1-7 · Mobile push notifications crash on registration.** `apps/mobile/merchant-app/lib/services/push_service.dart:71,81` throw `SkipNeedsBackendException` — the gateway route for device tokens doesn't exist. Merchants get zero push. → Implement `POST/DELETE /v1/push/device-tokens`, remove throws.

**P1-8 · No `error.tsx` / `not-found.tsx` in any app.** Unhandled errors/404s render Next.js defaults (leaks framework info, unbranded). → Add root `error.tsx` + `not-found.tsx` to at least storefront-runtime and merchant-control-plane.

**P1-9 · Storefront edge middleware throws on missing env.** `apps/storefront-runtime/src/middleware.ts:39,45,50` throw inside the request path → 500 on *every* storefront request if config is absent. → Validate env in `instrumentation.ts`; degrade gracefully.

**P1-10 · "Governance theater" gives false readiness signal.** ~60–70 of 167 validators only assert strings exist in markdown/JSON; the test suite largely re-runs validators. → Split CI into (a) *real* gates — `tsc`/`turbo typecheck`, `turbo build`, structural validators (circular-import, undeclared-import, domain-boundary, dead-residue), real unit/integration tests — and (b) evidence/certification validators marked "human-review, non-gating". Don't let the 167-green number stand in for readiness.

---

## P2 — Medium (quality / polish / hardening)

- **Stub/blocked UI visible to users:** merchant `ats-score` page renders `StubPage` "Coming Soon" (`merchant-control-plane/.../ats-score/page.tsx:3`); platform-ops portal ships 6 of 7 modules as "blocked" skeletons; platform-console `marketplace-governance` is a "backend missing" panel. → Hide from nav until built.
- **Mobile half-built features:** onboarding data discarded (`create_store_wizard.dart:285`), product-row tap is a no-op (`products_screen.dart:931`), export is a toast stub (`:333`), analytics charts are placeholders (`analytics_screen.dart:120-353`), barcode scanner throws (`inventory_service.dart:686`).
- **Public `POST /contacts` has no schema validation** (`routes/contacts.ts:8-49`) — manual `if` checks only, no Zod, no length caps. → Add `validate('json', …)`.
- **XSS is logged, not blocked:** `services/api-gateway/src/middleware/security.ts:113-124` warns on dangerous content but lets it through; stored content isn't sanitized at ingestion. → Decide ingestion sanitization vs. mandatory output-escaping in themes (and enforce the latter).
- **Dead shared scaffolding:** `packages/dart/core/.../api_constants.dart` is a full shopper-app API surface unused by the merchant app; Durable Object `runtime-coordinator.ts` has no product call sites.

---

## P3 — Repo hygiene & process

- **AI work-logs committed at repo root:** `CODEX_FOUNDATION_HARDENING_LEDGER.md` (118KB), `…STATUS.md` (100KB), `CODEX_UI_FOUNDATION_*` (80KB), `CODEX_DOMAIN_SPLIT_*`, plus `FORENSIC_REPORT/` (29 files) and `FORENSIC_REPORT_OPERATIONS/` (18 files). → `git mv` into `docs/archive/` (a `docs/archive/root-residue/` already exists for exactly this).
- **No pre-commit/pre-push hook** runs `validate-governance` despite CLAUDE.md requiring it after topology/import changes. → Add husky/lefthook or enforce in CI.
- **Validator sprawl maintenance burden:** 167 validators for a medium-complexity SaaS is disproportionate. Consolidate/retire the simulation family.

---

## What's actually healthy (so you know where NOT to spend the week)

Payment flow security · RLS policy coverage · no committed real secrets · correct `.gitignore` · api-gateway typechecks clean · dev-auth-bypass is correctly gated (`NODE_ENV==='development'` + explicit flag, blocked in prod) · deprecated app aliases are fully removed · dead-code archival validators work · execution adapters are real DB logic (not stubs).

---

## Suggested 1-week burn-down

1. **Day 1–2 (deploy blockers):** P0-1 BFF secret, P0-2 rate-limit fallback, P0-4 AUTH_SECRET assert. Add a CI gate: no `SKIP_NEEDS_HUMAN` / no `letbuyy.store` literals in shipped code.
2. **Day 2–3 (domain cutover):** P0-3 — sweep `letbuyy.store`, make URLs/cookie-domain required, fix Stripe redirect + emails + mobile defaults, invert env template.
3. **Day 3–4 (security + reliability):** P1-3 timing-safe, P1-4 internal-route limiter, P1-5 session error handling, P1-8 error pages, P1-9 middleware env, P1-1 ownership-check test.
4. **Day 4–5 (decisions):** P1-2 notifications (ship or gate), P1-6 topology placeholders, P1-7 push, P1-10 split CI gates from evidence.
5. **Throughout:** run the *real* gates — `turbo typecheck`, `turbo build`, `node --test` integration tests, structural validators — on a clean checkout with production-shaped env. Treat **a successful build + green real tests + a staging smoke test of signup→create store→add product→checkout→pay→order**, not the 167-validator count, as your readiness bar.
