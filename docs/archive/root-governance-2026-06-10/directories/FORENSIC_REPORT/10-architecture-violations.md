# Architecture Violation Report

Severity scale: **Critical** (undermines platform model/single points of failure) · **High** (will block scaling or mislead engineering) · **Medium** (drift/debt with concrete cost) · **Low** (hygiene).

## Critical

| ID | Violation | Evidence |
|----|-----------|----------|
| V-C1 | **Layer violation: all business logic in the edge gateway.** Domain logic (products, orders, payments, themes, apps, auth, media, analytics, portfolio) is implemented inside `services/api-gateway` route handlers rather than the domain packages whose names claim ownership (`commerce-core` = 26 LOC of schemas vs `routes/storefront.ts` = 4,320 LOC of logic). The package layer is contracts-only; the service layer is a monolith. | `services/api-gateway/src/routes/` (20,340 LOC); package LOC table in Inventory |
| V-C2 | **Topology misrepresentation: 6 declared services with zero code** while their manifests claim execution authority. Governance map ≠ runtime truth. | `services/*/runtime.manifest.json` (manifest-only six) |
| V-C3 | **Theme extensibility inversion**: platform app owns section implementations (hardcoded React registry), violating the declared theme-engine ownership and blocking third-party section ecosystems. | `renderer-registry.tsx`; theme-engine AGENTS.md ownership claims |
| V-C4 | **Validation/test system validates documents, not behavior** — 132 validators + 132 tests anchored on `config/runtime/*.json` string assertions; 0 package unit tests; no e2e. "Passing certification" is achievable with no running system. | `scripts/validators/*`; `tests/*`; quotes in Dead Code §5 |

## High

| ID | Violation | Evidence |
|----|-----------|----------|
| V-H1 | **Domain violation: portfolio/resume product inside commerce platform** — unowned domain spanning admin UI (6 pages, 473–509 LOC each), gateway routers (`index.ts:215-216`), and 8+ DB tables. | verified line counts; baseline tables |
| V-H2 | **Demo tenant bypasses tenancy**: `getStoreBySubdomain` short-circuit returns in-code fixture — tenant resolution, theme load, and release pipeline all skipped for the flagship demo. | `store-service.ts:54-57` |
| V-H3 | **Ownership violation: editor/runtime schema split** (D-1) — storefront re-declares section schemas independently of theme-engine. | `renderer-registry.tsx` vs `theme-registry.ts` |
| V-H4 | **Security-control asymmetry between auth surfaces**: identity-platform has rate-limit+Turnstile+CSRF; storefront customer login and guest order lookup have none. Same credential class, different protection. | `apps/storefront-runtime/src/app/api/customer/login/route.ts` vs identity `rate-limit.ts` |
| V-H5 | **Governance source-of-truth conflict**: `CLAUDE.md` canonical map (13 runtimes) omits `apps/developer-portal`; runtime manifests count 21 runtimes incl. 6 empty services. Three inconsistent inventories (CLAUDE.md, manifests, reality). | `CLAUDE.md`; manifest census |
| V-H6 | **One-step theme publish to live** (`make_store_live:true`) — no staged release gate in a multi-tenant platform where a bad publish breaks a live store. | `editor/route.ts:83-92` |
| V-H7 | **Privileged static-token plane**: platform-console → `/internal/console/*` authenticated by long-lived `PLATFORM_CONSOLE_API_TOKEN` env token (no session binding, no MFA at the API layer — MFA is UI-level). | `apps/platform-console/src/lib/console-api.ts` |
| V-H8 | **dev OTP disclosure** in non-production responses. | `identity .../signup/route.ts:21-23` |

## Medium

| ID | Violation | Evidence |
|----|-----------|----------|
| V-M1 | Preview/production renderer divergence for Liquid themes. | `preview/page.tsx` vs `composition-engine.tsx:163` |
| V-M2 | Outbox dispatch trigger unproven (no scheduler found). | `outbox-execution.adapter.ts` |
| V-M3 | SEARCH_QUEUE producer without consumer; search domain unimplemented behind a declared service. | gateway Env bindings; empty `search-service` |
| V-M4 | Unused K8s/Helm IaC alongside wrangler-only deployment — infra map overstates platform. | `infrastructure/deployment/` |
| V-M5 | Wrangler `compatibility_date = 2026-05-25` and app-manifest version `2026-06-05.ws13` — config dated to the working day; `@cloudflare/workers-types 4.20260525.1` pinned to match. Anomalous dating convention embedded in build config. | all three wrangler.toml; app-engine |
| V-M6 | webhook-service ↔ api-gateway bidirectional service-binding coupling (the only two workers depend on each other). | both wrangler.toml |
| V-M7 | India/Razorpay hardcoding in core contracts (`tenant-core` `^rzp_(test|live)_` regex; INR-only app charges) — geographic coupling at the contract layer. | `tenant-core/src/index.ts:112`; mig. app_billing_charges |
| V-M8 | `sites` vs `stores` nomenclature split between DB and every other layer. | baseline DDL vs API paths |
| V-M9 | Session secret fail-late (`getSecret()` throws on first request, not at boot). | `storefront .../lib/session.ts:37-39` |
| V-M10 | Fourth-generation overlapping self-audit documents with contradictions (deprecated app paths cited as live in `docs/audit/01-executive-summary.md`). | Dead Code §4 |

## Low

| ID | Violation | Evidence |
|----|-----------|----------|
| V-L1 | 11 `any` types (theme-marketplace dashboard ×4, gateway admin/onboarding). | grep results |
| V-L2 | 14 inline-style violations + localStorage in app-marketplace Header. | app-marketplace components |
| V-L3 | `console.error` logging in route handlers (information verbosity). | app-marketplace API routes |
| V-L4 | CSRF cookie non-httpOnly (mitigated by sameSite:strict; design choice). | identity `proxy.ts:50` |
| V-L5 | Duplicate/legacy CI workflow names (deploy-staging vs staging-deploy). | `.github/workflows/` |
| V-L6 | Legacy postMessage alias retained. | `storefront-preview-bridge.tsx:5` |
| V-L7 | Root `vercel.json` vs Cloudflare-routed reality. | root |

## Boundary rules that were checked and PASS

For balance — these were grep-verified clean and the repo's own `validate-governance.mjs` run (2026-06-05) passed all gates except a stale-artifact complaint about local `node_modules`/`dist`:

- 0 app→app source imports; 0 service→app; 0 package→app/service imports.
- 0 active references to deprecated aliases (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`) outside archives.
- 0 direct `@supabase/supabase-js` imports under `apps/`.
- 0 committed secrets (only safe test constant `rzp_route_test_` at `app-store.ts:1541` and validation regex in tenant-core); no tracked `.env` files; turbo env allowlist contains only public values.
- 21/21 runtime manifests present; 29 package AGENTS.md present; tenant-isolation and payment-idempotency unit tests exist in the gateway (`src/__tests__/`).
