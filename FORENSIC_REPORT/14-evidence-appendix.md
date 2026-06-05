# Evidence Appendix

## A. Independently verified measurements (commands run 2026-06-05)

| Claim | Verified value | Method |
|-------|---------------|--------|
| Working-tree files (excl. node_modules/.git) | 5,422 | `find . -type f … \| wc -l` |
| Git-tracked files | 2,827 | repo's environment validator output |
| Validator scripts | **132** | `ls scripts/validators/ \| wc -l` |
| Test files | **132** | `find tests -name "*.test.mjs" \| wc -l` |
| Root .md files | **73** | `ls *.md \| wc -l` |
| Baseline tables | **233** | `grep -c "CREATE TABLE" 000_baseline.sql` |
| Baseline length | 27,740 lines | `wc -l` |
| api-gateway src files | 90 | `find … -name "*.ts" \| wc -l` |
| api-gateway routes LOC | **20,340** | `wc -l src/routes/*.ts` |
| Largest routes | storefront.ts 4,320 · app-store.ts 2,721 · operations.ts 1,436 · payments.ts 916 · auth.ts 872 · themes.ts 858 · inventory.ts 851 · pages.ts 811 · stores.ts 649 · blog.ts 605 · orders.ts 595 | same |
| StubPage usage | 1 file (`[store]/ats-score/page.tsx`) | `grep -rl "StubPage" apps/merchant-control-plane/src/app` |
| Portfolio-page sizes | experience 503 · education 499 · certifications 509 · skills 473 · projects 495 · testimonials 492 (all `'use client'` CRUD) | `wc -l` + head |
| Portfolio mounted in gateway | imports lines 17–18; `api.route('/portfolio'…)` line 215, `'/resume'` line 216 | `grep -n` on `services/api-gateway/src/index.ts` |
| Governance suite result | all validators pass except **Stale artifact validator** (flags local `node_modules`/`dist`); notable outputs: "89 required enterprise test proof files checked", "9 load scenarios and 9 chaos experiments checked", "13 domain packages and 17 schema facades checked", "2827 tracked files scanned" | `node scripts/validate-governance.mjs` |
| CI turbo invocations | 4 (typecheck/lint/test/build) | `grep -c turbo .github/workflows/ci.yml` |

## B. Key file references by finding

- **Monolith**: `services/api-gateway/src/index.ts` (30+ `api.route(...)` mounts, Env bindings lines 49–104); `wrangler.toml` (queues, D1, R2, KV, DO, Hyperdrive, routes api.letbuyy.store, `compatibility_date 2026-05-25`).
- **Manifest-only services**: `services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}/{runtime.manifest.json,AGENTS.md}` — 2 files each (verified via find).
- **Validator pattern**: `scripts/validators/governance-common.mjs` (readJson/readFile/exists/createReporter); `production-certification-common.mjs` (83 lines — asserts contract JSON fields, runner fail-closed strings incl. `certification: false`, `LETBUYY_PROVIDER_CERTIFICATION_APPROVED`, and package.json script wiring); samples quoted in Dead Code §5: `convergence-proof-validator.mjs`, `crash-recovery-validator.mjs` (11 lines), `provider-execution-validator.mjs` (11 lines), `distributed-clock-validator.mjs`, `crdt-convergence-validator.mjs`, `replay-simulation-validator.mjs`.
- **Evidence runners**: `load/run-load-evidence.mjs` + `load/scenarios/internet-scale-load.json` (k6/locust/gatling dirs); `chaos/run-chaos-evidence.mjs` + `chaos/scenarios/failure-matrix.json`; both print "plan mode complete; no evidence was recorded and no certification was claimed".
- **Meta-tests**: `tests/production-certification/provider-production-certification.test.mjs` (spawns validators, asserts stdout regex + `report.certification === false`); `tests/survivability/survivability-governance.test.mjs` (asserts execute fails without `LETBUYY_SURVIVABILITY_EXECUTION_APPROVED`; asserts live-drill source does NOT contain `status:"passed"` literal); `tests/replay/replay-determinism.test.mjs` (in-process replay determinism over fixtures).
- **Theme system**: `packages/theme-engine/src/{index,theme-renderer,theme-registry,theme-bundle,execution-runtime}.ts`; editor `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor{,/draft}/route.ts`; preview `apps/storefront-runtime/src/app/preview/{page.tsx,storefront-preview-bridge.tsx}`; registry `…/lib/theme-engine/renderer-registry.tsx`; demo `…/lib/demo/urban-kicks-demo.ts`; seed `database/supabase/seeds/urban-kicks-theme.sql`.
- **App platform**: `packages/app-engine/src/index.ts`; `packages/extension-host/src/index.ts`; `services/api-gateway/src/routes/app-store.ts` (OAuth 1592–1775; charges 1334–1470; embed-session 1134–1230; bridge scopes 290–300); `services/webhook-service/src/app-lifecycle-dispatch.ts` (HMAC 53–64, retry 246–249); `database/supabase/migrations/076_app_extension_registry.sql`; `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx`; slot `apps/storefront-runtime/src/components/sections/app-block-slot.tsx`.
- **Auth/identity**: `apps/identity-platform/src/lib/{rate-limit,turnstile}.ts`, `src/lib/auth/{password,session,tokens,device,cookies,csrf}.ts`; devOtp `api/auth/signup/route.ts:21-23`; storefront sessions `apps/storefront-runtime/src/lib/session.ts`; merchant guards `src/proxy.ts`, `src/lib/stores/resolve-owned-store.ts`, `app/[store]/layout.tsx`.
- **Database**: `database/supabase/migrations/000_baseline.sql` + 073–078; `verification/031–042`; `database/cloudflare/d1/migrations/0001_provider_execution_foundation.sql` (provider_execution_evidence, d1_migration_lineage, replay_restoration_lineage, rollback_lineage); RLS: 352 policies / 230 of 233 tables.
- **Legacy**: `legacy/firebase/**` (40 files); portfolio tables + indexes (`idx_certifications_store_active`, `idx_portfolio_projects_store_active`, …) in baseline; `040_portfolio_resume_runtime_alignment.sql`.
- **Governance docs**: root `AGENTS.md` (32 KB constitution); `CLAUDE.md` canonical map; `docs/governance/runtime-boundaries.md`; 21 `runtime.manifest.json`; 29 package `AGENTS.md`; intelligence generator `scripts/generate-repository-intelligence.mjs` (manifest timestamps 2026-05-25T03:24:32Z).

## C. Investigation-stream discrepancies (resolved by direct verification)

| Agent claim | Verified correction |
|-------------|--------------------|
| "103 / 115+ validators" (two streams) | **132** |
| "60 root ledger files" | **73** total root .md |
| "Resume/portfolio pages are StubPages" (services stream) | Only `ats-score` is a StubPage; the other 6 are 473–509-line live CRUD pages (duplication stream's read was correct) |
| "api-gateway ~8,127 LOC" | routes alone are 20,340 LOC across 90 src files (8,127 likely measured a subset) |
| "0 TODOs in apps/packages" (violations stream) | 3 TODOs exist in gateway routes (quoted) |
| "tests: 108+ files" | **132** |
| "packages have real test coverage" implied by gateway suite | gateway has 5 unit-test files; **packages have 0** |

## D. Method note

Eight parallel read-only investigation streams (packages; core apps; secondary+mobile apps; theme/storefront; app-ecosystem/integration; database/dead-code; duplication/violations; services/infra/debt) followed by direct re-verification of every load-bearing number via shell counts and file reads, plus execution of the repository's own governance validator suite. No files outside `FORENSIC_REPORT/` were created, modified, moved, or deleted.
