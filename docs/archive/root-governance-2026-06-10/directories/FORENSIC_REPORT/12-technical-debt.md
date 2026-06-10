# Technical Debt Report

## Debt class 1 — Legacy systems carried forward

| Item | Detail | Evidence |
|------|--------|----------|
| Portfolio/resume product | Full prior product alive in 3 layers (admin pages 473–509 LOC each, gateway routers, 8+ tables, `PortfolioGrid` storefront section, `040_portfolio_resume_runtime_alignment.sql` verification). Only `ats-score` was stubbed (`StubPage`, 4 lines). | verified counts; `index.ts:215-216` |
| Firebase era | `legacy/firebase/` 40 files incl. 30+ functions for wallet/commission/settlement/KYC/seller flows — capabilities dropped, not migrated; mobile app still ships google-services config. | `legacy/firebase/functions/` |
| Migration history | 000_baseline squash of 001–072 (originals in `docs/archive/migrations-history/`); one-off `verification/` SQL retained in-tree. | `database/supabase/` |
| Naming strata | `sites` (DB) vs `stores` (everything else); legacy postMessage alias; deploy-workflow name pairs. | V-M8, V-L5/6 |

## Debt class 2 — Temporary solutions in production paths

- Hardcoded demo tenant short-circuit (`store-service.ts:54-57`) — "demo for now" baked into tenant resolution.
- `devOtp` in API responses outside production (`signup/route.ts:21-23`).
- Static bearer token for the entire platform-console privileged plane.
- `formatPrice` ad-hoc locals instead of shared money util (despite `Money` type in shared-types).
- Storefront session secret resolved lazily per-request.

## Debt class 3 — Incomplete implementations (verified)

| Item | State | Evidence |
|------|-------|----------|
| Email sends at 3 gateway integration points | TODO comments, code absent | `routes/employee.ts:287`, `routes/contacts.ts:48`, `routes/admin.ts:283` — the only 3 TODOs in services/packages/apps (grep-verified; low TODO count reflects deletion discipline, not completeness) |
| OAuth provider login | empty `/auth/callback` page | identity-platform |
| Magic-link login | endpoint present, implementation unevidenced | `api/auth/send-magic` |
| Checkout UI extension rendering | registry without render site | I-4 |
| App-block storefront surfacing | registry without query | I-1 |
| Search indexing | producer without consumer | I-3 |
| Outbox scheduling | adapter without trigger | I-2 |
| Theme preset switching | schema without UI | theme report |
| platform-console | self-described scaffold | governance docs |

## Debt class 4 — Abandoned/parked features

- `apps/mobile/operator-app` (counter demo), `apps/mobile/shopper-app` (manifest), `packages/dart/services` (stub façade).
- 6 manifest-only services (aspirational microservice topology).
- Helm/K8s manifests with no deployment consumer.
- `ats-score` stub page.

## Debt class 5 — Architecture drift

- Declared DDD package ownership vs gateway-resident logic (V-C1): the 26-LOC `commerce-core` package "owning" commerce while `routes/storefront.ts` holds 4,320 lines is the canonical example.
- 3 inventories of the platform disagree (CLAUDE.md 13 runtimes / manifests 21 / reality 12 implemented).
- ~10,700 LOC distributed-systems substrate (`distributed-runtime` 5,744 + `projection-runtime` 2,815 + `orchestration` 2,160) + ~60 ops tables serving a single-worker deployment — sophistication debt: high carrying cost, no second consumer, 0 unit tests over it.
- 132 validators + 132 meta-tests + ~40 root `validate:*/certify:*` scripts forming a parallel "proof system" that must itself be maintained with every refactor (string-fragment assertions break on rename — e.g. `distributed-clock-validator.mjs` asserts source contains `tickLamportClock`).

## Debt class 6 — Documentation debt

73 root markdown files (~1.4 MB, largest 270 KB) across 4 generations of self-audit; contradictions present (deprecated paths cited as live in `docs/audit/01-executive-summary.md`); no index distinguishing current from historical truth except `AGENTS.md`.

## Quantified debt snapshot

| Metric | Value |
|--------|-------|
| Package unit tests | 0 |
| Apps/packages/services TODO-FIXME | 3 (all gateway email sends) |
| `any` types | 11 |
| Manifest-only services | 6 of 9 |
| Schema definitions for sections | 3 locations |
| Root process-residue .md | 72 (+constitution) |
| Empty/placeholder runtimes (mobile) | 2 of 3 |
| Validators asserting documents not behavior | 132 |
| Largest single route file | `storefront.ts` 4,320 lines |
| Baseline migration size | 27,740 lines / 233 tables |
