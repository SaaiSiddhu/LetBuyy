# Dead Code Investigation Report

Documenting only — nothing was deleted.

## 1. Code-free declared services (dead topology)

`services/{analytics-pipeline, checkout-runtime, event-bus, media-service, notification-service, search-service}` — each exactly 2 files (`runtime.manifest.json` ~122 lines of governance prose + `AGENTS.md`). No package.json, no wrangler.toml, no src/. They are referenced as live topology by governance docs while being empty.

## 2. Legacy Firebase stack (unreferenced)

`legacy/firebase/` (~40 files): `firestore.rules`, `storage.rules`, `.firebaserc`, `firestore.indexes.json`, `functions/` with 30+ TypeScript Cloud Functions (`storeDeployment.ts`, `returnService.ts`, `walletService.ts`, `commissionService.ts`, `settlementService.ts`, `kycVerification.ts`, `razorpayService.ts`, `sellerAuth.ts`, …), `scripts/migrate-firebase.sh`. Active-code references to Firebase: ~2 (a mention in `packages/dart/core/AGENTS.md`; `packages/infrastructure/storage-adapter`). Note: Firebase function names (wallet, commission, settlement, KYC, seller) describe **marketplace-seller features that have no successor implementation** in the current platform — dropped capabilities, not just migrated code. Mobile merchant-app still bundles `google-services.json`/plist.

## 3. Root-level process residue

**73 root .md files** (verified): `AGENTS.md` (the live constitution, 32 KB) + 72 ledgers/status/mission/report files — `CODEX_MASTER_EXECUTION_LEDGER.md` (270 KB), `CODEX_SHOPIFY_UX_LEDGER.md` (204 KB), `CODEX_FEDERATION_LEDGER.md` (108 KB), `CODEX_MISSION_LEDGER.md` (104 KB), `LETBUYY_STATE.md` (77 KB), `LETBUYY_ENTERPRISE_ARCHITECTURE_AUDIT.md` (77 KB), `CODEX_WS1–WS13_LEDGER.md`, `WAVE1–7_REPORT.md`, brand/color/token reports, etc. Grep shows none are read by code or validators (except AGENTS.md by convention) — pure AI-agent work-log residue at the repository root. Additional prior-audit set in `Audit/` (6 parts).

## 4. Stale/contradictory docs

`docs/` (~100 subdirs). `docs/audit/01-executive-summary.md` references deprecated `apps/admin`, `apps/storefront`, `apps/merchant` paths that no longer exist. `docs/archive/migrations-history/` (001–065) and `docs/archive/flutter-legacy/` are properly archived. Multiple overlapping "master plans" (`LETBUYY_MASTER_EXECUTION_PLAN.md`, `LETBUYY_CODEX_IMPLEMENTATION_MASTER.md`, P0–P4 masters) with no marker of which is current.

## 5. Self-referential validation artifacts

- `scripts/validators/` — **132 scripts** whose inputs are static JSON under `config/runtime/` (e.g. `durable-execution-contract.json`, `convergence-invariants.json`, `runtime-survivability-intelligence.json`, `production-certification-execution.json`) plus string-presence checks on source files. Representative quotes:
  - `convergence-proof-validator.mjs`: `reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", …)`; loops asserting `source.includes("compileConvergenceProof")` etc.
  - `crash-recovery-validator.mjs` (11 lines): delegates to `validateProductionCertification({ requiredEvidence: ["process-interruption","wal-restoration",…] })` — checks the contract JSON lists those strings.
  - `distributed-clock-validator.mjs`: asserts forbidden list contains `"Date.now"`, `"new Date()"`, `"Math.random"` and source contains `tickLamportClock`, `mergeVectorClock`, …
  - Shared core `governance-common.mjs`: `readJson`/`readFile`/`exists`/`createReporter` — no execution, no network.
- `load/run-load-evidence.mjs` and `chaos/run-chaos-evidence.mjs`: default `--mode=plan` prints planned k6/locust/gatling or chaos commands and exits ("plan mode complete; no evidence was recorded and no certification was claimed"); execute mode env-gated (`LETBUYY_CHAOS_EXECUTION_APPROVED=true`, `LETBUYY_API_BASE_URL`, `LETBUYY_OPERATIONS_TOKEN`).
- **No committed live-evidence directory exists** (no `evidence/` folder) — consistent with fail-closed design, but it means every "certification" npm script can pass with zero systems touched.

## 6. Unused/under-used assets

| Item | Evidence | Verdict |
|------|----------|---------|
| Helm + K8s manifests | `infrastructure/deployment/{helm,kubernetes}` vs all services deploying via wrangler | Unused IaC (no consumer) |
| `apps/mobile/operator-app` | 1-file Flutter counter demo | Placeholder, no shared-package usage |
| `apps/mobile/shopper-app` | manifest+AGENTS only | Reserved namespace |
| `packages/dart/services` | ~50 LOC façade | Stub |
| `projection-runtime` | 8 importing files (lowest of all packages) | Under-consumed relative to 2,815 LOC |
| `artifacts/shopify-ux/` ~100 PNGs | before/after screenshots | Visual residue, never read by code |
| `memory/lessons.md`, `tasks/`, `.codex/`, `.codex-dev.log` (0 bytes) | agent working dirs | Residue |
| `/api/seed` (storefront) | returns 410 in prod | Intentionally dead endpoint |
| Legacy postMessage alias `LETBUYY_THEME_EDITOR_SELECTION` | `storefront-preview-bridge.tsx:5` | Backwards-compat dead naming |
| `vercel.json` at root (134 B) + per-app Vercel deploy assumptions vs Cloudflare-routed workers | root file | Possible stale deploy config |

## 7. Database dead weight

- Legacy portfolio domain tables (live but off-domain): `portfolio_projects`, `resume_versions`, `education`, `work_experience`, `certifications`, `skills`, `skill_endorsements`, `testimonials` — actively indexed and RLS-policied; consumed only by legacy admin pages/gateway routers.
- ~60 operational tables (`runtime_*`, `replay_*`, `projection_*`, `queue_*`, `provider_*`, `failover_drill_runs`, `load_test_runs`, `chaos_experiment_runs`, `operational_certification_reports`) whose writers are the evidence runners that, by default, never execute.
- `database/supabase/verification/` 031–042: one-off alignment-check SQL retained in-tree.
- Env vars: sampled declared vars in `config/env/*.example` (80+) all matched references in code — no orphan env vars detected in sample.
