# Executive Summary

LetBuyy is a multi-tenant commerce platform ("like Shopify") built as a pnpm/Turbo monorepo: 9 Next.js 16 web apps, 3 Flutter apps (1 real), 3 deployed Cloudflare Workers, 26 shared TypeScript packages + 5 Dart packages, a 233-table Supabase (Postgres) database with 352 RLS policies, and a Cloudflare D1 side-database for operational lineage. The platform shows a genuinely working commerce core — storefront rendering, theme editing with versioned releases, checkout/orders/payments (Razorpay/Cashfree/COD, INR-centric), an OAuth-capable app platform with HMAC webhooks and app billing — wrapped in an unusually large layer of self-referential governance machinery.

## The platform in one paragraph

A single Cloudflare Worker (`services/api-gateway`, 90 source files; route handlers alone total 20,340 lines) is the entire backend. Every web and mobile app is a thin client of it via one shared client factory (`@letbuyy/api-client`). Themes are section/block JSON configs with a Liquid bundle option, edited in `apps/merchant-control-plane` and rendered by React components hardcoded in `apps/storefront-runtime`. Six of nine "services" (`checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`) contain zero code — only `runtime.manifest.json` + `AGENTS.md`. The capabilities they claim live inside the api-gateway monolith.

## Five defining facts

**1. The backend is a monolith dressed as microservices.** 6 of 9 service roots are manifest-only namespaces (evidence: `services/checkout-runtime/` contains exactly 2 files). Checkout, search, media, notifications, events and analytics all execute inside `services/api-gateway` (`src/index.ts` mounts 30+ routers; `routes/storefront.ts` is 4,320 lines).

**2. The verification system verifies documents, not systems.** 132 validator scripts (`scripts/validators/`) and 132 test files (`tests/**/*.test.mjs`) overwhelmingly assert that JSON manifests in `config/runtime/` are internally consistent and that source files contain expected string fragments (e.g. `convergence-proof-validator.mjs` checks `source.includes("compileConvergenceProof")`). Load/chaos suites default to `--mode=plan` (print commands, record nothing). The 26 shared packages have **zero unit tests**. There are **no integration/e2e tests that call a running system** in CI. To the system's credit, this is self-aware: manifests carry `mode: "governance-contract-not-live-evidence"` and runners fail closed without approval env vars — but a buyer must understand that "validate:production-certification passing" does not mean production was certified.

**3. The codebase is a pivot, and the previous product is still live inside it.** The platform was a portfolio/resume-site builder before it was a commerce platform. The merchant admin still ships fully implemented (~500 LOC each) Experience, Education, Certifications, Skills, Projects and Testimonials management pages (`apps/merchant-control-plane/src/app/[store]/...`), the gateway still mounts `/portfolio` and `/resume` routers (`services/api-gateway/src/index.ts:215-216`), and the baseline schema retains `portfolio_projects`, `resume_versions`, `education`, `work_experience`, `skills` tables. `ats-score` is the only page stubbed out.

**4. Distributed-systems ambition far exceeds operational reality.** ~10,700 LOC across `distributed-runtime`, `orchestration`, `projection-runtime` implement event sourcing, outbox, CQRS, replay, leases, Lamport/vector clocks, CRDT merge — consumed mainly by the same single Worker. ~60 of 233 database tables are runtime/observability bookkeeping (`runtime_checkpoints`, `replay_dry_run_results`, `chaos_experiment_runs`, …). This is sophisticated engineering whose cost is carried by a platform with one deployed backend worker.

**5. The application layer itself is comparatively clean.** Independent checks confirmed: no app→app imports, no direct Supabase access from apps, no deprecated-alias references in code, no committed secrets, single API-client factory, consistent Next.js 16.1.6/React 19.2.3, store-ownership checks on every sampled merchant API route, and 98.7% RLS coverage at the DB layer. The repo's own governance suite (`node scripts/validate-governance.mjs`) passes every gate except a stale-artifact complaint about local `node_modules`.

## Critical Findings (severity: Critical)

| ID | Finding | Evidence |
|----|---------|----------|
| C-1 | **Single-worker backend monolith / single point of failure.** All commerce, auth, themes, apps, payments, media, analytics, portfolio logic executes in one Cloudflare Worker. | `services/api-gateway/src/index.ts` (30+ mounted routers); `routes/` = 20,340 LOC; 6 sibling services code-free |
| C-2 | **Test coverage is governance theater.** 0 package unit tests; 132 repo tests assert validator output strings & fail-closed gates, not behavior; only `services/api-gateway/src/__tests__/` (5 files) tests real logic. | `tests/production-certification/provider-production-certification.test.mjs`; `scripts/validators/*` |
| C-3 | **Theme sections are hardcoded React components in the storefront app** — third parties cannot add section types; theme extensibility requires platform code deploys. | `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx` (static imports of all sections) |
| C-4 | **Six declared runtime services do not exist.** Manifests claim ownership ("Reserved search and indexing authority…") with no implementation, masking the true topology from any reader of the runtime map. | `services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}/runtime.manifest.json` |

## High Findings (severity: High)

| ID | Finding | Evidence |
|----|---------|----------|
| H-1 | Previous-product domain (portfolio/resume/ATS) live in merchant admin, gateway and schema; pollutes commerce domain and acquisition surface. | `[store]/{experience,education,certifications,skills,projects,testimonials}/page.tsx` (473–509 LOC each); gateway `index.ts:215-216` |
| H-2 | Installed theme app-blocks are registered but not auto-surfaced in storefront rendering; install→render chain unproven end-to-end. | `app_extension_registrations` (mig. 076) vs `apps/storefront-runtime/src/components/sections/app-block-slot.tsx` (reads `section.blocks` only) |
| H-3 | Demo store "Urban Kicks" hardcoded into storefront runtime, bypassing the tenant/theme pipeline. | `apps/storefront-runtime/src/lib/demo/urban-kicks-demo.ts`; short-circuit in `store-service.ts:54-57` |
| H-4 | No rate limiting or bot protection on storefront customer login (identity-platform has both; storefront does not). | `apps/storefront-runtime/src/app/api/customer/login/route.ts` vs `apps/identity-platform/src/lib/rate-limit.ts` |
| H-5 | Theme publish is one-step to live (`make_store_live: true`); no preview-publish separation. | `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/route.ts:83-92` |
| H-6 | 73 root-level process-ledger markdown files (~1.4 MB; e.g. `CODEX_MASTER_EXECUTION_LEDGER.md` 270 KB) and 6 prior audit reports committed at repo root — process residue mixed with source of truth. | repo root listing; `Audit/` |
| H-7 | OTP returned in API responses outside production (`payload.devOtp = otp`). | `apps/identity-platform/src/app/api/auth/signup/route.ts:21-23` |
| H-8 | Governance documents disagree: `CLAUDE.md` canonical runtime map omits `apps/developer-portal`, which exists, is manifest-governed, and ships. | `CLAUDE.md` vs `apps/developer-portal/runtime.manifest.json` |
| H-9 | No theme developer tooling (CLI, theme-check) and no app CLI/SDK — ecosystem growth depends on manual JSON uploads. | absence verified across `packages/`, `scripts/` |
| H-10 | Mobile coverage: `operator-app` is the Flutter counter demo; `shopper-app` is manifest-only; only `merchant-app` is real. | `apps/mobile/operator-app/lib/main.dart`; `apps/mobile/shopper-app/` (2 files) |

Full severity-ranked register: [10-architecture-violations.md](10-architecture-violations.md) and [13-risk-assessment.md](13-risk-assessment.md).

## Bottom line for diligence

What works: a coherent single-gateway commerce platform with real multi-tenancy (subdomain → RLS-backed `sites`), a real theme pipeline with drafts/releases/rollback, a real app platform skeleton (OAuth, scopes, HMAC webhooks, billing charges, extension registry), strong secret hygiene, and disciplined import boundaries enforced by working validators. What does not exist despite appearances: microservices, live certification/load/chaos evidence, meaningful automated testing, theme/app developer tooling, shopper mobile, and any second backend. The largest diligence risk is not broken code — it is the gap between the documented/validated architecture and the much smaller system that actually runs.
