# PHASE 1 — REPO TOPOLOGY AUDIT

**Forensic Master 2026-06-10 · LetBuyy (`/Users/saai_sidd/Git/Letbuyy_Store`)**

| | |
|---|---|
| **Date** | 2026-06-10 |
| **Auditor** | Principal-level forensic repository audit (automated, evidence-only) |
| **Source of truth** | `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` (§6 Final Service Topology is canonical) |
| **Branch / HEAD at audit** | `stepup/main` @ `5cf9e64e` ("fix(foundation): resolve final audit drift") — **HEAD moved from `c94b71eb` to `5cf9e64e` while this audit ran**; concurrent automation is active in this tree |
| **Working tree** | DIRTY — 20 modified tracked files + ~42 untracked paths (`git status --short` = 62 entries), audited as-is |
| **Branch deltas** | `main` (production deploy trigger) is **30 commits behind** `stepup/main`; `develop` (staging trigger) is **18 commits behind** (`git rev-list --count`) |

## Methodology

1. Read `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` in full; §6 used as the compliance baseline for production / reserved / dormant / deprecated topology.
2. Enumerated every directory under `apps/`, `services/`, `packages/` plus all non-runtime top-level roots; file counts via `find -type f` (excluding `node_modules`, `.next`, `.turbo`, `dist`, `.dart_tool`, Flutter `build/`), LOC via `wc -l` over `*.ts|tsx|js|mjs|dart|sql|css|sh`.
3. Deploy reality established from actual config only: `.github/workflows/*.yml` (10 workflows read), `services/*/wrangler.toml`, `apps/*/vercel.json`, `runtime.manifest.json` files, `config/runtime/*.json`, `turbo.json`, root/app `package.json` scripts. `ACTIVE_DEPLOYMENT_TOPOLOGY.md` treated as a claim and re-verified line-by-line.
4. Dependency/dead-code graph built from all workspace `package.json` files (workspace deps extracted programmatically) and cross-checked against actual `import`/`from '@letbuyy/...'` statements via ripgrep.
5. Duplicate/scaffold analysis via targeted greps (formatters, session libs, theme engines, identity stacks, sentinels) and `git log -1 -- <path>` per area; prior audits (`FOUNDATION_FORENSICS_2026_06_09/`, `FOUNDATION_AUTOPSY/`, `IDENTITY_PLATFORM_AUDIT/`, root `*_REPORT.md`) used **only** as hypothesis lists — every claim below was re-verified against the current working tree. Items previously reported and now fixed are explicitly marked **FIXED**.
6. No code was modified. The only file written is this document. Builds/deploys were **not executed** (see UNVERIFIED notes).

---

## Executive Verdict

**The repository's deployed topology is not the V1 topology, and the repository's most important security fix is not in any deployable branch.**

Four findings dominate everything else:

1. **What deploys is a 13-runtime estate, not V1's 8-runtime monolith-plus-satellites.** `production-deploy.yml` deploys 4 Cloudflare Workers (`api-gateway`, `webhook-service`, `queue-workers`, `mobile-bff`) **and 9 Vercel Next.js apps** — including `app-marketplace` and `developer-portal`, which V1 §4 R-11 explicitly **REJECTS** for this envelope, and two internal-ops portals that V1 Appendix B #15 defers. The deploy pipeline implements the generated `AGENTS.md` 9-app canon, not the V1 §6 4-surface production list. Two constitutions are live and the wrong one is winning at the deploy layer.
2. **The fix for an unauthenticated account takeover exists only as an uncommitted working-tree edit.** `apps/identity-platform/src/app/api/auth/switch/route.ts` at HEAD (`git show HEAD:...`) still mints a session for **any** verified email behind a JS-readable CSRF cookie; the SEC-C1 fix (rate-limit → CSRF → valid session → proven-account check) is present only in the dirty working tree, and the production deploy branch (`main`) is 30 commits further behind. Every artifact any pipeline can currently produce is the vulnerable version.
3. **Reserved-service compliance is real on disk but contradicted by the topology metadata.** All 6 reserved services and both reserved mobile roots contain exactly `AGENTS.md` + `runtime.manifest.json` (verified file-by-file). But `config/runtime/production-topology.json` declares `services/event-bus` a **production runtime** with `deploymentManifests` pointing at a **Kubernetes Helm chart** (`infrastructure/deployment/helm/letbuyy-production/Chart.yaml`) that no workflow ever applies, backed by `packages/distributed-runtime` — a package with **zero production importers**. The governance layer describes a fictional distributed system.
4. **~13.3k LOC of V1-rejected CQRS/saga/extension scaffolding is dead but still in the build**, and one "dormant" package (`runtime-composition`) is wired into the production storefront read path — a direct §6 violation in the live code, while six other dormant packages are kept alive only by the validators that exist to govern them.

Counting this register: **41 findings — 2×S0, 6×S1, 20×S2, 13×S3.** The repo is *more* compliant than prior audits found in several places (deprecated aliases fully absent, payment-forgery binding + `provider_payment_id` unique index live, FORCE RLS in 17 migrations, no direct Supabase client in any app) — but the deploy topology, the constitution stack, and the uncommitted security state are each, independently, restructuring-level problems.

---

## 1. Deploy-Reality Table

Verdicts: **DEPLOYS** = working deploy config + a CI workflow that ships it · **BUILDS-ONLY** = built/typechecked in CI, no deploy path · **NEVER-DEPLOYS** = no build or deploy path.

### Workers (Cloudflare)

| Runtime | Verdict | Evidence |
|---|---|---|
| `services/api-gateway` | **DEPLOYS** (staging + production) | `wrangler.toml:1` `name="letbuyy-api"`, `[env.production]` route `api.letbuyy.store` (`wrangler.toml:211-216`); `production-deploy.yml:292-293` `wrangler deploy --env production`; staging via both `deploy-staging.yml` and `staging-deploy.yml:74` |
| `services/webhook-service` | **DEPLOYS** | `wrangler.toml:72-75` prod `letbuyy-webhook` on `webhooks.letbuyy.store`; `production-deploy.yml:309-310` |
| `services/queue-workers` | **DEPLOYS** | `wrangler.toml:227-228` prod `letbuyy-queue-workers` (queue consumer + cron); `production-deploy.yml:324-325` |
| `services/mobile-bff` | **DEPLOYS — but is a stub** | `wrangler.toml:90-93` prod `letbuyy-mobile-bff` on `bff.letbuyy.com`; `production-deploy.yml:339-340`. Entire service = `src/index.ts` (305 lines): `/health`, `/v1/health`, `/v1/auth/mobile/turnstile/verify` (`index.ts:276-278`). The V1-claimed "composite/fan-in endpoints" do not exist. |
| `services/checkout-runtime` | **NEVER-DEPLOYS** | 2 files only (`AGENTS.md`, `runtime.manifest.json`); no wrangler/package.json; absent from all workflows |
| `services/event-bus` | **NEVER-DEPLOYS** (but declared "production" in `config/runtime/production-topology.json:118-121` — see TOPO-013) | same 2-file shape |
| `services/notification-service` | **NEVER-DEPLOYS** | same 2-file shape |
| `services/analytics-pipeline` | **NEVER-DEPLOYS** | same 2-file shape |
| `services/media-service` | **NEVER-DEPLOYS** | same 2-file shape |
| `services/search-service` | **NEVER-DEPLOYS** | same 2-file shape |

### Web apps (Vercel, all `regions: ["bom1"]`)

| App | Verdict | Evidence |
|---|---|---|
| `apps/marketing-site` | **DEPLOYS** | `vercel.json` present; `production-deploy.yml:353-354` matrix; `deploy-staging.yml:98` |
| `apps/identity-platform` | **DEPLOYS** | `vercel.json` (framework nextjs, bom1, security headers); `production-deploy.yml:355-356`; staging `deploy-staging.yml:95` |
| `apps/merchant-control-plane` | **DEPLOYS** | `vercel.json`; `production-deploy.yml:357-358` |
| `apps/storefront-runtime` | **DEPLOYS** | `vercel.json`; `production-deploy.yml:359-360` |
| `apps/theme-marketplace` | **DEPLOYS** | `vercel.json`; `production-deploy.yml:361-362` |
| `apps/app-marketplace` | **DEPLOYS** — *V1-rejected surface* | `vercel.json`; `production-deploy.yml:363-364`; V1 §4 R-11 / Appendix A "App Marketplace → REJECTED (now)" |
| `apps/developer-portal` | **DEPLOYS (production only; asymmetric)** | **No local `vercel.json`** (only app missing one); still in `production-deploy.yml:365-366` matrix; **absent** from `deploy-staging.yml:94-102` staging matrix |
| `apps/platform-console` | **DEPLOYS** — beyond V1 "thin ops sliver" | `vercel.json`; `production-deploy.yml:367-368` |
| `apps/platform-operations-portal` | **DEPLOYS** — beyond V1 "thin ops sliver" | `vercel.json`; `production-deploy.yml:369-370` |

All app deploys are `vercel deploy --prod` from the app dir (`production-deploy.yml:387-388`) with env hard-coded to `letbuyy.store` URLs (`NEXT_PUBLIC_APP_URL: https://letbuyy.store`, `...API_URL: https://api.letbuyy.store/v1`).

### Mobile

| App | Verdict | Evidence |
|---|---|---|
| `apps/mobile/merchant-app` | **BUILDS-ONLY (debug)** | `ci.yml:218` `flutter build apk --debug`, `ci.yml:222` `flutter build ios --debug --no-codesign`. No release build, no signing, no fastlane/store-upload workflow anywhere in `.github/workflows/` (grep for `fastlane|appbundle|--release|testflight` → 0 hits in workflows). |
| `apps/mobile/shopper-app` | **NEVER-DEPLOYS** | 2 files (`AGENTS.md`, `runtime.manifest.json`) — reserved, compliant |
| `apps/mobile/operator-app` | **NEVER-DEPLOYS** | 2 files — reserved, compliant |

### Packages (all 28 + 5 Dart)

All TypeScript packages are **BUILDS-ONLY** by design (`turbo.json` `build.dependsOn: ["^typecheck","^build"]`; CI `build` job). None has a deploy config. The six-package rejected cluster (`app-engine`, `application-services`, `extension-host`, `projection-runtime`, `orchestration`, `distributed-runtime`) builds in CI despite zero production consumers (§4 below).

### Pipeline-level facts

- **Production trigger:** `production-deploy.yml:3-7` — `push: branches: [main]` + manual. `main`'s tip is `bf8c18c1` (2026-06-09), **30 commits behind** `stepup/main`. None of the foundation waves 0–7 (money fixes, tenant isolation, session security…, per `FOUNDATION_STEPUP_STATUS.md` state machine) can deploy until a merge to `main` (runbook exists: `MERGE_RUNBOOK.md`).
- **Two staging pipelines race on the same trigger:** both `deploy-staging.yml:3-5` and `staging-deploy.yml:3-6` fire on `push: branches: [develop]`, both deploy the same four workers with different app matrices (TOPO-016).
- **Other workflows:** `ci.yml` (typecheck, secret-hygiene, lint, unit-tests, merge-safety-gate incl. gateway/behavioral/contract tests + `flutter analyze`/`flutter test`, governance, mobile debug builds, filtered build), `architecture-governance.yml` (validators only), `production-rollout.yml` / `live-production-certification.yml` / `environment-lifecycle.yml` / `staging-runtime-deployment.yml` (manual, human-gated), `hot-table-partition-maintenance.yml` (cron, prod DB maintenance for partitioning that V1 §7 defers to P2).
- UNVERIFIED: whether GitHub-side secrets exist and the workflows succeed (no CI run logs accessible from this tree); whether `pnpm turbo build` currently passes for all 50 workspaces (not executed).

---

## 2. Full Inventory Census

LOC = code files only (`ts|tsx|js|mjs|dart|sql|css|sh`), excluding `node_modules`/build caches. "Imported by" from workspace-dep graph + grep of actual imports.

### apps/ (10 web + 3 mobile roots)

| Path | Files | LOC | Purpose | Imported/consumed by | Verdict |
|---|---:|---:|---|---|---|
| `apps/merchant-control-plane` | 187 | 42,241 | Merchant dashboard (V1 production app) | terminal app | **ACTIVE, DEPLOYS** |
| `apps/storefront-runtime` | 149 | 20,665 | Tenant storefronts + hosted checkout read path (V1 production app) | terminal app | **ACTIVE, DEPLOYS** |
| `apps/identity-platform` | 93 | 10,127 | Auth/signup/session UI + auth APIs (V1 production app) | terminal app | **ACTIVE, DEPLOYS** (S0 uncommitted fix, TOPO-001) |
| `apps/app-marketplace` | 107 | 19,557 | App marketplace + developer app submission | terminal app | **DEPLOYS — V1-REJECTED scope (R-11)** |
| `apps/developer-portal` | 31 | 4,903 | Developer docs/API reference shell | terminal app | **DEPLOYS — V1-rejected ecosystem surface; prod-only deploy asymmetry** |
| `apps/theme-marketplace` | 116 | 10,173 | Theme catalog/checkout | terminal app | **DEPLOYS — outside V1 §6 production list** |
| `apps/marketing-site` | 43 | 8,322 | Public marketing/pricing | terminal app | **DEPLOYS — outside V1 §6 production list (benign)** |
| `apps/platform-console` | 56 | 5,983 | Super-admin scaffold (own AGENTS.md description: "scaffold") | terminal app | **DEPLOYS — beyond V1 thin-ops sliver** |
| `apps/platform-operations-portal` | 52 | 4,044 | Employee ops portal scaffold | terminal app | **DEPLOYS — beyond V1 thin-ops sliver** |
| `apps/mobile/merchant-app` | 307 | 80,030 (Dart) | Flutter merchant app (V1 production app) | terminal app | **ACTIVE, BUILDS-ONLY (debug)**; still contains V1-banned parity catalog (TOPO-012) |
| `apps/mobile/shopper-app` | 2 | 0 | Reserved root | — | **COMPLIANT EMPTY** |
| `apps/mobile/operator-app` | 2 | 0 | Reserved root | — | **COMPLIANT EMPTY** |

### services/ (10)

| Path | Files | LOC | Purpose | Verdict |
|---|---:|---:|---|---|
| `services/api-gateway` | 259 | 83,402 | The modular monolith: 60+ route modules (`src/routes/`), GraphQL, extensions runtime, identity-foundation shadow stack, tenant registry, execution adapters | **ACTIVE, DEPLOYS** |
| `services/queue-workers` | 23 | 4,118 | Queue consumer: outbox relay, push, risk-scoring, compliance, analytics jobs (`src/platform-queue-consumer.ts` etc.) | **ACTIVE, DEPLOYS** |
| `services/webhook-service` | 13 | 2,041 | Outbound merchant webhooks (app lifecycle, order/billing transitions) | **ACTIVE, DEPLOYS** |
| `services/mobile-bff` | 8 | 391 | 305-line worker: health + Turnstile verify only | **DEPLOYS, STUB** (TOPO-009) |
| `services/checkout-runtime` | 2 | 0 | Reserved | **COMPLIANT EMPTY** |
| `services/event-bus` | 2 | 0 | Reserved | **COMPLIANT EMPTY** on disk; fabricated as production in `production-topology.json` (TOPO-013) |
| `services/notification-service` | 2 | 0 | Reserved | **COMPLIANT EMPTY** |
| `services/analytics-pipeline` | 2 | 0 | Reserved | **COMPLIANT EMPTY** |
| `services/media-service` | 2 | 0 | Reserved | **COMPLIANT EMPTY** |
| `services/search-service` | 2 | 0 | Reserved | **COMPLIANT EMPTY** |

### packages/ (28 TS + 5 Dart)

| Path | Files | LOC | Dependents (package.json graph, verified by import grep) | Verdict |
|---|---:|---:|---|---|
| `packages/shared-types` | 7 | 7,785 | ~30 workspaces (everything) | ACTIVE (god-package risk, TOPO-035) |
| `packages/typescript/ui` | 423 (38 src TS/TSX, **319 PNG** visual snapshots) | 11,751 | all 9 web apps | ACTIVE (design system + storybook + visual baselines in-repo) |
| `packages/typescript/api-client` | 5 | 5,320 (4,943 in one `src/index.ts`) | 8 apps | ACTIVE (god-file) |
| `packages/typescript/api-types` | 5 | 186 | `marketing-site`, `api-gateway` | ACTIVE; re-exports dormant `search-core` (`src/index.ts:92`) |
| `packages/auth-core` | 13 | 2,105 | 10 workspaces (apps + 3 workers + identity packages) | ACTIVE |
| `packages/tenant-core` | 4 | 629 | identity-platform, storefront, api-gateway, api-types, runtime-composition, organization-core | ACTIVE |
| `packages/commerce-core` | 4 | 1,188 | storefront, checkout-core, api-gateway, api-types, runtime-composition | ACTIVE |
| `packages/checkout-core` | 5 | 2,113 | storefront, api-gateway, api-types, runtime-composition | ACTIVE (allowed library per V1 §6) |
| `packages/payments` | 5 | 653 | infrastructure, api-gateway, api-types | ACTIVE |
| `packages/billing-core` | 5 | 1,518 | app-marketplace, api-gateway, queue-workers, api-types | ACTIVE |
| `packages/event-core` | 5 | 1,403 | billing/notification-core, api-gateway, queue-workers, api-types (+ dead cluster) | ACTIVE (V1's typed event catalog) |
| `packages/notification-core` | 4 | 419 | api-gateway, queue-workers, api-types | ACTIVE |
| `packages/cms-core` | 4 | 878 | merchant-control-plane, storefront, api-gateway, api-types, runtime-composition | ACTIVE |
| `packages/theme-engine` | 11 | 5,937 | storefront (32 imports), theme-marketplace (17), api-gateway (3), mcp (2), tenant-core, api-types | ACTIVE — V1 dormant-list item used well beyond "existing theme editor needs" (TOPO-017/026 context) |
| `packages/infrastructure` | 30 | 4,174 | api-gateway, queue-workers, webhook-service, runtime-composition | ACTIVE |
| `packages/runtime-composition` | 15 | 1,119 | storefront `store/[subdomain]/page.tsx:7`, api-gateway `queue-execution.adapter.ts:16`, queue-workers `platform-queue-consumer.ts:16` | **DORMANT-LISTED BUT WIRED INTO PRODUCTION** (TOPO-005) |
| `packages/identity-core` | 4 | 60 | audit/organization/permission/session/token-core | ACTIVE shell (fragmentation, TOPO-029) |
| `packages/session-core` | 4 | 53 | api-gateway | ACTIVE shell |
| `packages/token-core` | 4 | 44 | api-gateway | ACTIVE shell |
| `packages/permission-core` | 4 | 45 | api-gateway | ACTIVE shell |
| `packages/organization-core` | 4 | 59 | api-gateway | ACTIVE shell |
| `packages/audit-core` | 4 | 73 | api-gateway | ACTIVE shell |
| `packages/app-engine` | 5 | 2,190 | **none** (only `scripts/validators/beta-readiness-validator.mjs`) | **DEAD** (TOPO-008) |
| `packages/application-services` | 15 | 1,078 | **none** (validators only) | **DEAD** — yet named the "workflow authority" in every runtime manifest (TOPO-014) |
| `packages/extension-host` | 4 | 358 | **none** (validators only) | **DEAD** (V1 R-11) |
| `packages/projection-runtime` | 18 | 1,023 | **none** (3 validators only) | **DEAD** (V1 R-5) |
| `packages/orchestration` | 16 | 1,393 | only dead `application-services` (+ validators) | **TRANSITIVELY DEAD** (V1 R-4) |
| `packages/distributed-runtime` | 77 | 7,303 | only dead `orchestration` + `projection-runtime` | **TRANSITIVELY DEAD** (V1 R-4/R-5/R-13; 76 src files of CQRS/CRDT/saga/control-plane code) |
| `packages/search-core` | 4 | 47 | api-types re-export (`:92`), dead application-services | DORMANT, leaked into active surface (TOPO-026) |
| `packages/dart/core` | 27 | 3,268 | merchant-app (`pubspec.yaml:17-18`) | ACTIVE |
| `packages/dart/api_client` | 9 | 4,125 | merchant-app (`pubspec.yaml:19-20`) | ACTIVE |
| `packages/dart/models` | 21 | 5,118 | merchant-app (`pubspec.yaml:21-22`) | ACTIVE |
| `packages/dart/ui_kit` | 28 | 2,697 | merchant-app (`pubspec.yaml:23-24`) | ACTIVE |
| `packages/dart/services` | 5 | 8 | **not in merchant-app pubspec**; facade re-exporting one symbol from `letbuyy_core` | **DEAD facade** (TOPO-028) |

### Non-runtime roots

| Path | Files | LOC | Purpose / verdict |
|---|---:|---:|---|
| `database/` | 139 | 46,602 | Supabase: **91 migrations** (`000_baseline` … `161_foundation_session_security`; numbers 1–72 squashed into baseline), 21 rollbacks, 19 verification scripts, 3 seeds, 1 script, `database/cloudflare` (1). ACTIVE. Gaps: 3 of 24 post-V1 migrations missing rollbacks (TOPO-011). |
| `scripts/` | 226 | 18,034 | **187 validator scripts** in `scripts/validators/` + generators/governance/migration/staging/utilities + `generate-repository-intelligence.mjs` (generates AGENTS.md). ACTIVE — governance machine (TOPO-024). |
| `infrastructure/` | 63 | 3,389 | observability stack decls, cloudflare scripts, dns, **Kubernetes + Helm production charts** (`deployment/kubernetes/namespace.yaml` quota 16 CPU/64Gi/120 pods; `deployment/helm/letbuyy-production/`) used by no workflow (grep `helm|kubectl` in `.github`+`scripts` → only `scripts/validators/production-readiness-validator.mjs`). PART-FANTASY (TOPO-015). |
| `config/` | 97 | 236 | `config/runtime/` (70 files: topology/contract/schema JSONs incl. `deployment-topology.json`, `production-topology.json`), env templates/schemas, eslint/tailwind/vercel/supabase shards. ACTIVE but encodes reserved services as topology nodes (TOPO-013). |
| `tests/` | 274 | 20,602 | 271 test files in 30 suites (governance, contracts, executable, security, gst, queues, projections, replay, survivability, chaos, federation…). Wired via root `package.json` `test:*`/`validate:*` scripts and `ci.yml` merge-safety-gate. ACTIVE (some suites test rejected architecture concepts). |
| `load/` | 9 | 263 | k6/Gatling/Locust scenarios + `run-load-evidence.mjs`; last commit 2026-05-25. SHELF-WARE for V1 (deferred SLO/load proofs). |
| `chaos/` | 3 | 97 | failure-matrix + runner; last commit 2026-05-25. SHELF-WARE. |
| `legacy/` | 37 | 15,406 | Old Firebase functions/rules (wallet, commission, settlement, notifications). Git-tracked at root; untouched since 2026-05-25. ORPHANED (TOPO-019). |
| `tasks/` | 18 | 0 (md) | 16 superseded Build-Mission task specs (`tasks/executable/001…016`) + `todo.md` + `env-setup-skips.md`. HISTORICAL at root. |
| `build/` | 9 | 0 | Flutter unit-test cache + native assets. Untracked, regenerable. CLUTTER (TOPO-032). |
| `artifacts/` | 208 (176 git-tracked) | 244 | `local-operational-proof/` screenshot evidence (PNG-heavy). Binary bloat in git (TOPO-034). |
| `founder-journey/` | 3 | 0 | LinkedIn day-1 content (PNG/SVG/copy). **Untracked**, non-engineering (TOPO-031). |
| `FOUNDER_CONTENT_ENGINE/` | 7 | 0 | 90-day social plans. **Untracked**, non-engineering (TOPO-031). |
| `memory/` | 1 | 0 | `lessons.md`. Vestigial. |
| `docs/` | 1,176 | 29,507 | 87 subdirs + 36 root-level docs; 862 .md. Top: `archive/` 468, `governance/` 127, `research/` 95, `auth/` 61, `design-system/` 50, `agents/` 40. ACTIVE-but-sprawling (TOPO-037). |
| Root audit dirs | 109 total | — | `FORENSIC_REPORT` 27, `FORENSIC_REPORT_OPERATIONS` 16, `FOUNDATION_FORENSICS_2026_06_09` 18, `IDENTITY_PLATFORM_AUDIT` 15, `PHASE2_ARB_CHALLENGE_2026_06_09` 9, `IDENTITY_RECOVERY_ENHANCEMENT` 9, `LETBUYY_FOUNDATION_AUTHORITY` 8, `FOUNDATION_AUTOPSY` 7 (+ this dir). **Most are untracked in git** (`git status`: `?? FOUNDATION_AUTOPSY/` etc.). |
| Root documents | 88 .md + 2 .pptx + 2 .xlsx | — | §8 below. |

Aggregate: **~247,109 LOC of TS/TSX** across `apps`+`services`+`packages` (excl. Dart 80k, SQL 46k).

---

## 3. Reserved / Dormant / Deprecated Compliance

### 3.1 Reserved services — file-by-file listing (V1 §6: "manifest-only, remain EMPTY")

Verified by `find <dir> -type f`:

```
services/checkout-runtime:    AGENTS.md, runtime.manifest.json   ✅
services/event-bus:           AGENTS.md, runtime.manifest.json   ✅
services/notification-service:AGENTS.md, runtime.manifest.json   ✅
services/analytics-pipeline:  AGENTS.md, runtime.manifest.json   ✅
services/media-service:       AGENTS.md, runtime.manifest.json   ✅
services/search-service:      AGENTS.md, runtime.manifest.json   ✅
apps/mobile/shopper-app:      AGENTS.md, runtime.manifest.json   ✅
apps/mobile/operator-app:     AGENTS.md, runtime.manifest.json   ✅
```

**On-disk compliance: PASS.** No source, no deploy config, no package.json in any reserved root. The reserved manifests even self-describe honestly (`services/event-bus/runtime.manifest.json`: "Reserved/not-implemented … no event-bus worker is deployed").

**Metadata compliance: FAIL.**
- `config/runtime/deployment-topology.json` models all six as topology `nodes` with `deploymentKind: "reserved-service"`, scaling specs (`maxInstances: 20`, `scaleMetric: "replay-lag"`) and health checks (`event-bus.replay.health`) — capacity plans for empty directories.
- `config/runtime/production-topology.json:118-127` lists `"runtimeName": "Event Bus", "runtimeRoot": "services/event-bus", "environment": "production"` with `deploymentManifests: ["infrastructure/deployment/helm/letbuyy-production/Chart.yaml", ...]` and `eventStore: "...via packages/distributed-runtime"` — i.e., an empty reserved service declared a production runtime, deployed by a Helm chart no pipeline uses, backed by a dead package. All six reserved services appear there.
- Capability queues named for reserved services (`letbuyy-analytics-queue-*`, `letbuyy-search-queue-*`, `letbuyy-notifications-queue-*`, producers in `services/api-gateway/wrangler.toml:63-86`) are **allowed** — V1 §6 places those capabilities in `api-gateway`+`queue-workers`; noted for completeness, not a violation.

### 3.2 Dormant packages (V1 §6: "exists, no investment, do not wire as active topology")

| Package | Status vs V1 |
|---|---|
| `extension-host`, `projection-runtime`, `distributed-runtime`, `orchestration`, `app-engine` | Dormant and **dead** (zero production importers) — compliant in wiring, non-compliant in cost: built+typechecked in CI, in `pnpm-workspace.yaml`, kept "needed" only by `scripts/validators/beta-readiness-validator.mjs`, `distributed-runtime-validator.mjs`, `projection-recovery-validator.mjs`, `execution-layer-validator.mjs` |
| `runtime-composition` | **VIOLATION — wired into active topology**: `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:7` (`composeStorefrontRuntimeProjection`), `services/api-gateway/src/execution/queue-execution.adapter.ts:16`, `services/queue-workers/src/platform-queue-consumer.ts:16` |
| `search-core` | Dormant but leaked into the active dependency surface via `packages/typescript/api-types/src/index.ts:92` (`export * from '@letbuyy/search-core'`) consumed by `api-gateway` and `marketing-site` |
| `theme-engine` | Permitted "only as far as the existing theme editor needs"; actual usage is much wider: 32 import sites in `storefront-runtime`, 17 in `theme-marketplace`, 3 in `api-gateway` — the storefront *renderer* depends on it, not just the editor. Borderline; flagged. |

### 3.3 Deprecated aliases (V1 §6: "never reference as active topology")

Grep of all 9 aliases across `apps services packages scripts config infrastructure database tests .github`:

- **No deprecated directory exists** (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/storefront-runtime/consumer-storefront`, `apps/mobile/operator-team-app` — all absent on disk).
- All string hits are **deny-list entries** in `scripts/validators/governance-common.mjs:76-87` and `scripts/generate-repository-intelligence.mjs` (the validators that ban them), plus regex false-positives on `apps/merchant-control-plane`/`apps/storefront-runtime` substrings.

**Compliance: PASS — and this marks a previously-reported risk as FIXED** (prior audits flagged alias-resurrection risk; current tree is clean).

### 3.4 Previously-reported items re-verified against this tree

| Prior claim (source) | Current state |
|---|---|
| `/api/auth/switch` unauthenticated takeover (IDENTITY_PLATFORM_AUDIT; memory says "FIXED (working tree)") | **FIXED in working tree only — uncommitted.** HEAD `5cf9e64e` version has no session/proven-account check (`git show HEAD:apps/identity-platform/src/app/api/auth/switch/route.ts` — destroys current session if present, then mints a session for any `email_verified` user; 0 matches for `SEC-C1`). Working-tree version (`route.ts:14-81`) adds rate-limit + valid-session + proven-account. New test `apps/identity-platform/src/__tests__/auth-switch-guard.test.ts` is **untracked**. → TOPO-001 (S0). |
| Payment forgery (verify under-bound) | **FIXED at HEAD**: `services/api-gateway/src/routes/payments.ts:836-881` binds `razorpay_order_id` + `razorpay_payment_id` + timing-safe signature (`timingSafeEqualHex`, `:842`) with order-binding check (`:879-881`). |
| Missing unique `provider_payment_id` | **FIXED**: `database/supabase/migrations/142_executable_payment_sessions.sql:144-148` (`payments_provider_payment_id_uniq`, `payment_transactions_provider_payment_id_v1_uniq`); also `107_security_rls_hardening_and_payment_uniqueness.sql`. |
| RLS not FORCEd | **LARGELY FIXED**: `FORCE ROW LEVEL SECURITY` present in 17 migrations (incl. 139, 141, 142, 146, 147, 151). Full table coverage UNVERIFIED (would require live-DB introspection). |
| Apps bypass gateway with direct Supabase | **FIXED/CLEAN**: zero `@supabase/supabase-js` imports and zero `SERVICE_ROLE` references anywhere under `apps/` (grep). |
| "Fabricated payouts" framing (FOUNDATION_AUTOPSY) → reframed as ledger logic defects (FOUNDATION_FORENSICS) | Ledger/settlement migrations now exist (`139_executable_foundation_ledger_core.sql`, `151_executable_settlement_ledger.sql`, `160_foundation_money_ledger_authority.sql`). Behavioral correctness is out of scope for Phase 1 (topology); not re-adjudicated here. |
| Mobile login blocked on Turnstile placeholders | Mitigation present in topology: `mobile-bff` ships `/v1/auth/mobile/turnstile/verify` (`src/index.ts:278`) and fails closed per `wrangler.toml:31-38` comments; production Turnstile key provisioning remains a human SKIP-DEPLOY action. Runtime behavior UNVERIFIED. |

---

## 4. Dead Code

1. **The rejected six-package cluster — 13,345 LOC with zero production importers.** `app-engine` (2,190) + `application-services` (1,078) + `extension-host` (358) + `projection-runtime` (1,023) + `orchestration` (1,393) + `distributed-runtime` (7,303). Verified: no file under `apps/`, `services/`, or live `packages/` imports them; the only references are 4 validator scripts (`scripts/validators/beta-readiness-validator.mjs`, `distributed-runtime-validator.mjs`, `projection-recovery-validator.mjs`, `execution-layer-validator.mjs`) and intra-cluster imports (`packages/application-services/*/index.ts` → orchestration; `packages/orchestration/src/*-runtime.ts` + `packages/projection-runtime/src/*` → distributed-runtime). These are V1 §4 R-4/R-5/R-11 rejections that still cost CI build/typecheck time in every pipeline (`turbo build` has no exclusion; `pnpm-workspace.yaml` lists all of them).
2. **`packages/dart/services`** — an 8-LOC facade whose own doc-comment says its contents were "removed in WS8 M5"; not referenced in `apps/mobile/merchant-app/pubspec.yaml` (only `letbuyy_core`, `letbuyy_api_client`, `letbuyy_models`, `letbuyy_ui_kit` at `pubspec.yaml:17-24`), only in root `pubspec.yaml` workspace list.
3. **`legacy/` (37 git-tracked files, 15,406 LOC)** — complete Firebase backend (walletService, commissionService, settlementService, storeAuth…) last touched 2026-05-25; imported by nothing; not under `docs/archive/` where V1 puts historical material.
4. **Dead-by-flag production surfaces inside the deployed monolith:** `services/api-gateway/src/graphql/` (6 files; `schema.ts` 1,835 lines), `src/extensions/app-functions-runtime.ts` (623 lines), Liquid paths — all shipped in the production Worker bundle while `[env.production.vars]` sets `FEATURE_GRAPHQL/FEATURE_EXTENSIONS/FEATURE_LIQUID = "false"` (`wrangler.toml:239-241`). Staging sets all three `"true"` (`wrangler.toml:38-40`) — staging exercises code production never runs.
5. **Orphan/cache directories:** `build/` (Flutter test cache, untracked), `.tmp/` (empty), `test-results/` (1 file), `.codex/` (empty), `memory/` (1 file, stale since 2026-05-24).
6. **Validator-only liveness loop:** the dead cluster cannot be deleted without editing the validators that assert its shape — governance code is the only consumer of the code it governs (see TOPO-008/024).
7. **mobile-bff composite layer** — not dead code but a dead *promise*: the deployed worker contains none of the V1-named composite endpoints; 391 LOC total.

---

## 5. Duplicate Systems

| # | Capability | Side A | Side B (and C/D) | Notes |
|---|---|---|---|---|
| 1 | **Identity/auth** | `apps/identity-platform/src/lib/auth/` (password, tokens, session, device, csrf, cookies) | `services/api-gateway/src/routes/auth.ts` (1,441 lines) **+** `services/api-gateway/src/identity-foundation/` (18 files, 1,655 LOC: `token-shadow.ts`, `shadow-compare.ts`, `oauth-skeleton.ts`, `admin-mfa-scaffold.ts`, `session-services.ts`…) wired via `services/api-gateway/src/middleware/auth.ts` **+** 6 contract micro-packages (`identity/session/token/permission/organization/audit-core`) | Four parallel representations of identity. The shadow "identity-foundation" (+ migration `159_identity_foundation_core.sql`) is the prior-audit "two parallel systems" pattern, still present. |
| 2 | **Session handling per app** | `apps/identity-platform/src/lib/auth/session.ts` (87) | `apps/merchant-control-plane/src/lib/auth/session.ts` (166), `apps/storefront-runtime/src/lib/session.ts` (129), `apps/platform-console/src/lib/console-session.ts` | Four hand-rolled session libs in four deployed apps; none sourced from `auth-core`. |
| 3 | **Theme engine** | `packages/theme-engine/src/` (7 files, 5,937 LOC: registry, renderer, governance, execution-runtime) | `apps/storefront-runtime/src/lib/theme-engine/` (9 files: `composition-engine.tsx`, `data-binding-engine.ts`, `renderer-registry.tsx`, `template-resolver.ts`…) | Two directories both named `theme-engine` splitting one rendering pipeline across a package and an app; merchant-control-plane + theme-marketplace import the package while storefront layers its own on top. |
| 4 | **Staging deploy pipeline** | `.github/workflows/deploy-staging.yml` (push→develop; 4 workers + 8 apps, no developer-portal) | `.github/workflows/staging-deploy.yml` (push→develop + dispatch; DB push + 4 workers) | Same trigger, overlapping scope, different matrices → double-deploy race and matrix drift. |
| 5 | **Money formatting** | `packages/typescript/ui/src/formatting.ts` (`formatCurrency`, `formatDate` — the V1 single source) | `formatMoneyFromPaise` ×3 (`apps/platform-console/src/lib/console-api.ts:107`, duplicated locally in `StoreDirectoryIndexTable.tsx:180`, `SubscriptionManagementIndexTable.tsx:122`); `formatMoney` ×2 (`apps/merchant-control-plane/.../plan/page.tsx:136`, `.../billing/page.tsx:107`); `formatPrice` ×2 (`apps/storefront-runtime/src/components/cart/cart-drawer.tsx:17` INR, `apps/theme-marketplace/src/lib/utils.ts:10` **USD default**) | Violates V1 §3 "single-source for … currency+date formatting"; USD default on an India-first surface. |
| 6 | **Topology truth** | `config/runtime/deployment-topology.json` + `production-topology.json` | `.github/workflows/*` (actual deploys) + `ACTIVE_DEPLOYMENT_TOPOLOGY.md` (generated narrative) + 13 `runtime.manifest.json` + `AGENTS.md` map + V1 §6 | Six representations of "what runs"; at least three disagree (reserved services as production nodes; AGENTS 9-app canon vs V1 4-surface list; ACTIVE_DEPLOYMENT claims `deploy-staging.yml` lacks mobile-bff while `deploy-staging.yml:46,66-69` builds and deploys it). |
| 7 | **Constitutions** | `AGENTS.md` (generated 2026-06-08, "Master Engineering Constitution") | `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` (FROZEN, supersedes Freeze+Mission) + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` (superseded but present) + `LETBUYY_FOUNDATION_AUTHORITY/LETBUYY_SINGLE_SOURCE_OF_TRUTH.md` (untracked!) + `CLAUDE.md` (ranks AGENTS.md first) + 21 root `CODEX_*` mission/ledger/status docs | §8 below. |
| 8 | **API typing** | `packages/typescript/api-types` (thin, re-exports core packages) | `packages/shared-types` (7,785 LOC) + `packages/typescript/api-client` (4,943-LOC client with its own response shapes) | Three places where wire types live; AGENTS.md names shared-types canonical while api-types re-exports 12 packages wholesale. |

---

## 6. Scaffold / Abandoned Systems

- **`services/api-gateway/src/identity-foundation/`** — file names announce scaffolding: `oauth-skeleton.ts`, `admin-mfa-scaffold.ts`, `csrf-scaffold.ts`, `migration-scaffold.ts`, `operations-scaffold.ts`, `shadow-compare.ts`, `mock-key-service.ts`. Wired into `middleware/auth.ts`, so it is *live scaffolding* on the request path. Prior audit called OIDC "a 501 skeleton"; the skeleton files remain.
- **`apps/platform-console` + `apps/platform-operations-portal`** — AGENTS.md itself describes both as "scaffold" (platform-console: "Super admin scaffold"; ops portal: "Employee portal scaffold"); both deploy to production anyway.
- **`packages/distributed-runtime`** — 76 files of `*-runtime.ts` contracts (`crdt-convergence-runtime.ts`, `convergence-proof-runtime.ts`, `deployment-intelligence-runtime.ts`…) with no consumer: archetypal résumé-architecture, frozen 2026-06-08 (`git log -1` → `c50d4d59`).
- **`load/` + `chaos/`** — runner scripts and scenario JSONs (k6/Gatling/Locust, failure-matrix) last committed 2026-05-25 while sibling runtimes changed daily; referenced by `package.json` scripts (`load:plan`, `chaos:plan`) and manifests' `loadTestingOwnership` prose, but no workflow executes them on any schedule.
- **`infrastructure/deployment/kubernetes|helm`** — production-grade K8s namespace/quota and a Helm chart for a platform that deploys exclusively to Cloudflare Workers + Vercel; referenced only by `production-topology.json` and one validator. Abandoned-by-design fantasy.
- **`tasks/executable/001…016`** — the 16 Build-Mission task specs whose architecture V1 partially rejected; retained verbatim at root (not in `docs/archive/`).
- **Mobile parity catalog** — `apps/mobile/merchant-app/lib/screens/parity/merchant_feature_definitions.dart` + `merchant_feature_screen.dart` still exist and are still routed (`lib/app/routes.dart:776`), despite V1 §10: "**Removed outright** … duplicates real screens to inflate apparent coverage (TD-5)".
- **`legacy/firebase`** — see Dead Code; an entire abandoned backend at root.
- **Sentinel scaffolding in production config** — 74 `SKIP_NEEDS_HUMAN` occurrences across services/apps/config; notably **inside `[env.production.vars]`** of the deployed gateway (`services/api-gateway/wrangler.toml:253-262`: `AI_PROVIDER_MODEL`, `AI_CREDIT_RAZORPAY_KEY_ID`, `WHATSAPP_WEBHOOK_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_WHATSAPP_FROM`). Honest (preflight rule at `config/runtime/production-safety-preflight.json:9` rejects them) but they are plaintext vars in the production deploy unit.
- **TODO density is near-zero** (api-gateway 3, mobile 4, most dirs 0) — scaffolding here doesn't say TODO; it says `scaffold`/`skeleton`/`mock`/`SKIP_NEEDS_HUMAN`, or it is prose in manifests. Comment-marker counts are not a useful abandonment signal in this codebase.

---

## 7. Architectural Violations of V1 §6 (and adjacent V1 mandates)

| V1 rule | Violation | Evidence |
|---|---|---|
| §6 production list = MCP, storefront, identity, merchant-app + 4 workers | 5 additional apps deployed to production incl. two V1-REJECTED marketplace/ecosystem surfaces and two deferred ops portals | `production-deploy.yml:350-370` matrix; V1 §4 R-11, Appendix A rows "App Marketplace", "Operations" |
| §6 dormant: `runtime-composition` "do not wire as active topology" | Wired into production storefront page + gateway + queue-workers | `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:7`; `services/api-gateway/src/execution/queue-execution.adapter.ts:16`; `services/queue-workers/src/platform-queue-consumer.ts:16` |
| §6 reserved services remain manifest-only | Disk: compliant. Metadata: `production-topology.json` declares all six as `environment: "production"` runtimes with Helm deployment manifests | `config/runtime/production-topology.json:117-127` (+ five sibling entries); `deployment-topology.json` reserved nodes |
| §6 deprecated aliases never referenced as active | **COMPLIANT** (deny-list refs only) | `scripts/validators/governance-common.mjs:76-87` |
| §7 "new migrations begin at 138, each with a paired rollback" | Migrations `138_mobile_store_metafields.sql`, `140_mobile_cod_reconciliation.sql`, `157_product_metadata.sql` have no rollback in `database/supabase/rollback/` (21 rollbacks vs 24 forwards ≥138) | `comm -23` of migration vs rollback number sets |
| §3 "route files ≤ 1500 lines" / module boundaries | Route files compliant (max 1,494); but `src/tenant/tenant-tables.registry.ts` 3,051, `src/graphql/schema.ts` 1,835, `src/execution/theme-execution.adapter.ts` 1,572 | `wc -l` over `services/api-gateway/src` |
| §3 single-source currency/date | 7 ad-hoc money formatters incl. USD default | Duplicate Systems #5 |
| §9/§16 P0 hosted checkout origin `checkout.letbuyy.com` | Zero references in any code/config (only the in-monolith handoff routes exist, with mock secret fallback `letbuyy-local-mock-checkout-handoff-secret`) | grep `checkout\.letbuyy` across `services apps config .github` → 0; `services/api-gateway/src/routes/checkout.ts:89` |
| §16 P0 "Finish domain migration to `letbuyy.com`" | Production config split-brained: `api.letbuyy.store` (`api-gateway/wrangler.toml:215`), `webhooks.letbuyy.store` (`webhook-service/wrangler.toml:74-75`), but `bff.letbuyy.com` (`mobile-bff/wrangler.toml:93`); deploy env vars pin `https://letbuyy.store` and `https://api.letbuyy.store/v1` (`production-deploy.yml:387-400` env block); ~90 `letbuyy.store` references in active deploy config | grep counts |
| §10 "Removed outright: parity feature catalog" | Still present and routed | `apps/mobile/merchant-app/lib/app/routes.dart:776` |
| §2/§4 mobile-bff = composite endpoints | Deployed BFF has none (health + turnstile only) | `services/mobile-bff/src/index.ts:276-278` |
| §5 partitioning DEFERRED to P2 | A scheduled production workflow maintains hot-table partitions monthly (`cron "15 2 1 * *"`, default env production, `EXECUTE_MAINTENANCE=true` on schedule) | `.github/workflows/hot-table-partition-maintenance.yml:4-35`; partition migrations `081_partition_outbox_events.sql`, `131_hot_table_partition_shadow_mirror.sql` predate V1 — the *seam* was allowed, an executing production cron goes beyond it |
| Principle 12 "No new architecture documents" | Since V1 (2026-06-08): `FOUNDATION_STEPUP_MISSION_V2.md`, `IDENTITY_FOUNDATION_RECOVERY_PLAN.md`, `LETBUYY_MASTER_FORENSICS_AND_FOUNDATION_VERDICT.md`, `LETBUYY_FOUNDATION_AUTHORITY/` (8 docs incl. `TARGET_AUTH_ARCHITECTURE.md`, `SSO_ARCHITECTURE.md`), `LETBUYY_INVESTOR_DECK_PROMPT.md`, 12+ governance/empty-state reports — most untracked | root listing + `git status` `??` entries |

---

## 8. Root-Level Document Sprawl & Governance Risk

**Census:** 88 root `.md` + 2 `.pptx` (`LETBUYY_BUSINESS_REVIEW_DECK`, `LETBUYY_MERCHANT_OS_BOARD_DECK`) + 2 `.xlsx` (`LETBUYY_MERCHANT_OS_ROADMAP`, `LETBUYY_PRICING_UNIT_ECONOMICS_MODEL`) = **92 root artifacts**, plus **9 root audit directories** (109 files). Repo-wide: **1,185 markdown files**, of which 862 under `docs/`; **89 `AGENTS.md`** files.

Classification of the 88 root .md:

| Class | Count | Examples |
|---|---:|---|
| Constitutions / architecture authorities | 6 | `AGENTS.md`, `CLAUDE.md`, `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md`, `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` (superseded, still at root), `LETBUYY_STOREFRONT_ACCESS_V1.md`, `DOMAIN_PHASE_DECISIONS.md` |
| Codex mission/ledger/status triples | 21 | `CODEX_FOUNDATION_HARDENING_{LEDGER,STATUS}`, `CODEX_FOUNDATION_STEPUP_V2_{MISSION,LEDGER,STATUS}`, `CODEX_APPS_MARKETPLACE_*`, `CODEX_DOMAIN_*`, `CODEX_UI_FOUNDATION_*`, `CODEX_EXECUTABLE_BUILD_*` |
| Foundation wave state (current program) | 12 | `FOUNDATION_STEPUP_{STATUS,LEDGER,MISSION_V2,MISSION_REVIEW,SKIPPED}`, `FOUNDATION_{EXECUTION_DASHBOARD,FINAL_AUDIT,REPO_LOCKS,REPO_STATE,RISK_MATRIX}`, `MERGE_RUNBOOK.md`, `IDENTITY_FOUNDATION_RECOVERY_PLAN.md` |
| Generated repo intelligence | 3 | `ACTIVE_DEPLOYMENT_TOPOLOGY.md`, `BUILD_GRAPH.md`, `IMPORT_GRAPH.md` |
| Audits / reports / scorecards | 33 | `DESIGN_SYSTEM_MASTER_AUDIT`, 12 `*_GOVERNANCE_REPORT`/scorecards, 4 `EMPTY_STATE_*`, 3 `PRODUCTION_READINESS_*`, `SHOPIFY_BENCHMARK_REPORT`, `LETBUYY_MERCHANT_OS_MASTER_AUDIT`, `LETBUYY_MASTER_FORENSICS_AND_FOUNDATION_VERDICT`, … |
| Business / strategy / content | 9 | `LETBUYY_BUSINESS_MASTER_PLAN`, `LETBUYY_CHECKOUT_PLATFORM_{MASTER_PLAN,CTO_REVIEW,ARCHITECTURE}`, `LETBUYY_INVESTOR_DECK_PROMPT`, `LETBUYY_BUSINESS_VERDICT_ONEPAGER`, `EXECUTABLE_*` set |
| Misc engineering | 4 | `README.md`, `SECURITY_FIXES_APPLIED_2026-06-07.md`, `LOCAL_DEV`-adjacent, etc. |

**Governance risk — the constitution stack is circular and partly unversioned:**

1. `CLAUDE.md` ranks `AGENTS.md` first ("canonical engineering constitution… follow AGENTS.md first").
2. `AGENTS.md` is **generated** (`scripts/generate-repository-intelligence.mjs`, header timestamp 2026-06-08T16:24Z) and already stale: it claims "**19 Supabase migrations**" (line ~15, "Current source scan") against the actual **91**, and its scan predates all eight stepup waves. A machine-generated snapshot is the top-ranked constitution.
3. `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` declares itself FROZEN and supersedes `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` + the Build Mission — but the superseded Freeze and 21 CODEX mission/ledger docs remain at root, and the *deploy pipelines implement the AGENTS canon, not V1 §6*.
4. The newest authority claimant — `LETBUYY_FOUNDATION_AUTHORITY/LETBUYY_SINGLE_SOURCE_OF_TRUTH.md` plus 7 companion docs — is **untracked in git** (`?? LETBUYY_FOUNDATION_AUTHORITY/`), as are `FOUNDATION_AUTOPSY/`, `FOUNDATION_FORENSICS_2026_06_09/`, `IDENTITY_PLATFORM_AUDIT/`, `PHASE2_ARB_CHALLENGE_2026_06_09/` and ~20 root reports. The documents that adjudicate the codebase's truth have no history, no review, and would vanish on a clean clone.
5. V1 Principle 12 ("no new architecture documents") has been violated weekly since the day it froze (§7 last row), so the freeze's own enforcement mechanism is demonstrably inert.

Net effect: **any agent or engineer entering this repo gets at least four conflicting answers to "what is the topology and who decides?"** — and the only machine-enforced answer (validators + workflows) encodes the 9-app/13-runtime worldview, not the V1 §6 freeze.

---

## Findings Register

| ID | Severity | Area | Title | Root Cause | Evidence (path:line) | Impact | Fix Complexity | Recommended Fix |
|---|---|---|---|---|---|---|---|---|
| TOPO-001 | **S0** | Security/Release | Account-takeover fix for `/api/auth/switch` exists only as an uncommitted working-tree edit | Wave-style work landed in tree but never committed; deploy branches lag further | `git show HEAD:apps/identity-platform/src/app/api/auth/switch/route.ts` (no session/proven-account guard; HEAD `5cf9e64e`); working tree `route.ts:14-81` (SEC-C1 fix); `git status` ` M …/switch/route.ts`, `?? …/__tests__/auth-switch-guard.test.ts` | Every buildable/deployable artifact still mints sessions for any verified email behind a JS-readable CSRF cookie = unauthenticated takeover of any merchant account | S | Commit the fix + test immediately; cherry-pick to `main`/`develop`; tag as security release; add a repo rule that security fixes may not sit uncommitted |
| TOPO-002 | **S0** | Release topology | Production deploy branch (`main`) is 30 commits behind the integration branch; all 8 foundation waves undeployable | All remediation ran on `stepup/main`; `production-deploy.yml` triggers only on `main`; merge never executed | `production-deploy.yml:3-7`; `git rev-list --count main..stepup/main` = 30; `develop` = 18 behind; `FOUNDATION_STEPUP_STATUS.md` waves 0–7 "complete"; `MERGE_RUNBOOK.md` | Money fixes, tenant isolation, session security, theme governance — all claimed "complete" — cannot reach staging or production; deployed estate runs pre-wave code | S | Execute MERGE_RUNBOOK to fast-forward `develop`→`main`; until then treat all wave claims as "not shipped" |
| TOPO-003 | S1 | Constitutions | Two live constitutions: generated `AGENTS.md` 9-app canon vs V1 §6 4-surface freeze; pipelines follow AGENTS | V1 froze topology without updating the generator, workflows, or CLAUDE.md ranking | `AGENTS.md` "Canonical Active Runtimes" (9 web apps); `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md:130-144`; `CLAUDE.md` ("AGENTS.md… first"); `production-deploy.yml:350-370` | Every topology decision is contestable; agents legitimately produce opposite changes depending on which constitution they read | M | Pick one: either amend V1 §6 to bless the 9-app estate via ARB, or shrink the deploy matrix; regenerate AGENTS.md from V1; demote the loser to docs/archive |
| TOPO-004 | S1 | Deploy vs V1 | V1-REJECTED marketplace/ecosystem surfaces deploy to production (`app-marketplace`, `developer-portal`) | R-11 rejection never propagated to deploy workflows/Vercel projects | `production-deploy.yml:363-366`; V1 §4 R-11 + Appendix A "App Marketplace → REJECTED (now)"; `apps/app-marketplace` 19,557 LOC | 24k+ LOC of rejected surface area carries production attack/maintenance/cost surface for "an empty mall" | M | Gate both apps out of production matrix (keep staging if desired); or get ARB sign-off to overturn R-11 explicitly |
| TOPO-005 | S1 | Dormant wiring | Dormant-listed `runtime-composition` is wired into the production storefront read path | Storefront query layer was built on the CQRS-flavored package before V1 declared it dormant | `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:7`; `services/api-gateway/src/execution/queue-execution.adapter.ts:16`; `services/queue-workers/src/platform-queue-consumer.ts:16`; V1 §6 dormant list | The freeze's dormant list is fiction for this package; deleting the "no investment" cluster would break production | M | Either move the storefront-query-layer into the monolith/storefront and re-dormant the package, or reclassify `runtime-composition` as an active library in V1 via ARB |
| TOPO-006 | S1 | Domains | Split-brain production domains: `api.letbuyy.store` + `webhooks.letbuyy.store` vs `bff.letbuyy.com`; deploy env pins `letbuyy.store` | P0 "finish domain migration to letbuyy.com" executed only for mobile-bff | `services/api-gateway/wrangler.toml:215`; `services/webhook-service/wrangler.toml:74-75`; `services/mobile-bff/wrangler.toml:93`; `production-deploy.yml` env (`NEXT_PUBLIC_APP_URL: https://letbuyy.store`, `…api.letbuyy.store/v1`); ~90 `.store` refs in active deploy config | Cookies/CORS/SEO split across two apex domains; canonical-domain migration (memory: letbuyy.com) silently stalled mid-flight | M | One migration PR: wrangler routes + workflow envs + vercel domains to `letbuyy.com`, with `.store` 301s; add a validator banning `letbuyy.store` in deploy config |
| TOPO-007 | S1 | Duplicate systems | Identity implemented 4 ways (identity-platform lib, gateway `routes/auth.ts`, gateway `identity-foundation` shadow stack, 6 contract micro-packages) | Recovery programs layered a shadow identity foundation next to the legacy path instead of replacing it | `apps/identity-platform/src/lib/auth/*`; `services/api-gateway/src/routes/auth.ts` (1,441 lines); `services/api-gateway/src/identity-foundation/` (18 files, 1,655 LOC) imported by `src/middleware/auth.ts`; `packages/{identity,session,token,permission,organization,audit}-core` | Four places to patch any auth bug; shadow/skeleton files (`oauth-skeleton.ts`, `csrf-scaffold.ts`) sit on the live request path | L | Adopt `LETBUYY_FOUNDATION_AUTHORITY/TARGET_AUTH_ARCHITECTURE.md` (or V1 identity module) as the single target; schedule deletion of the losing paths with shadow-compare evidence |
| TOPO-008 | S1 | Dead code | 13,345 LOC of V1-rejected CQRS/saga/extension packages with zero production importers still in workspace+CI | R-4/R-5/R-11 rejection never followed by deletion/quarantine; validators assert their existence | `packages/{app-engine,application-services,extension-host,projection-runtime,orchestration,distributed-runtime}`; importer grep → only `scripts/validators/{beta-readiness,distributed-runtime,projection-recovery,execution-layer}-validator.mjs`; `pnpm-workspace.yaml` lists all six | CI builds/typechecks dead architecture forever; misleads every audit and newcomer about system shape; validator loop blocks deletion | M | Delete or move to `docs/archive/legacy-packages` (precedent exists); update the four validators; remove from pnpm-workspace + tsconfig.workspace |
| TOPO-009 | S2 | Deploy honesty | `mobile-bff` deploys to production as a 305-line stub (health + Turnstile only); V1 calls it a real composite-endpoint service | Service was carved out before its endpoints were built | `services/mobile-bff/src/index.ts:276-278`; V1 §1/§3 ("composite/fan-in endpoints… kills N+1") | V1's "already-real satellite" premise is false; Flutter app still does N+1 against the gateway; a near-empty worker holds a production domain | M | Either build the P1 composite endpoints or collapse BFF duties into api-gateway routes until then; fix V1 §3 wording |
| TOPO-010 | S2 | P0 gap | Hosted checkout origin `checkout.letbuyy.com` does not exist anywhere in code or config | P0 item unstarted; only in-monolith handoff routes exist | grep `checkout\.letbuyy` → 0 hits; `services/api-gateway/src/routes/checkout.ts:89` mock handoff secret fallback | The PCI-scope-shrinking single checkout surface — a §9 APPROVED P0 — is absent while V1 marks the architecture FROZEN | M | Provision the origin (storefront read-path route + DNS) or re-phase the item explicitly in the wave plan |
| TOPO-011 | S2 | Database | Migrations 138, 140, 157 lack paired rollbacks (V1 §7 mandate: every migration ≥138 ships forward+rollback) | Mobile/product migrations bypassed the executable-migration template | `database/supabase/migrations/{138_mobile_store_metafields,140_mobile_cod_reconciliation,157_product_metadata}.sql`; `database/supabase/rollback/` (21 files vs 24 forwards ≥138) | Irreversible deploys for those three changes; rollback drill incomplete | S | Author the three rollback files; add a validator asserting forward/rollback pairing ≥138 |
| TOPO-012 | S2 | Mobile | V1-banned "parity" feature catalog still present and routed in merchant app | §10 "Removed outright" never executed | `apps/mobile/merchant-app/lib/screens/parity/merchant_feature_{definitions,screen}.dart`; routed at `lib/app/routes.dart:776` | Inflates apparent feature coverage (TD-5); dead-end UX in a production-bound app | S | Delete the parity screens + route; re-run `flutter analyze`/tests |
| TOPO-013 | S2 | Topology metadata | `production-topology.json` declares all 6 reserved services as production runtimes deployed by an unused Helm chart, backed by dead `distributed-runtime` | Topology JSON generated from the 22-service worldview and never re-frozen | `config/runtime/production-topology.json:117-127` (Event Bus entry; 5 siblings); `deployment-topology.json` reserved nodes with scaling/health specs | The machine-readable "production truth" is fabricated; validators that consume it enforce fiction; certifications built on it are unsound | M | Regenerate both topology files from the actual deploy matrix; mark reserved roots as `reserved`, never `production`; delete Helm references |
| TOPO-014 | S2 | Manifests | Runtime manifests (66 prose keys each) delegate authority to dead `application-services`, empty `services/event-bus`, and an unprovisioned Grafana/Tempo/Loki/Prometheus stack | Manifest template written for the rejected architecture; copied to all 13 runtimes | `apps/developer-portal/runtime.manifest.json` (`workflowAuthority`: "owned by application-services"; `replayOperationsOwnership`: "delegates… to services/event-bus"; `observabilityInfrastructureOwnership`: "OpenTelemetry, Prometheus, Tempo, Loki, and Grafana… declared in infrastructure/observability") — same keys in all manifests | Governance authority chains point at things that don't run; manifest validation enforces prose nobody can satisfy | M | Slim the manifest schema to fields validators actually check (root, platform, deploy config, deps); strip authority prose referencing rejected/reserved components |
| TOPO-015 | S2 | Infrastructure | Kubernetes namespace/quota + Helm `letbuyy-production` chart for a Workers+Vercel platform; no pipeline uses helm/kubectl | Aspirational infra committed as if real | `infrastructure/deployment/kubernetes/namespace.yaml` (16 CPU/64Gi/120 pods); `infrastructure/deployment/helm/letbuyy-production/Chart.yaml`; grep helm/kubectl in `.github`+`scripts` → only `scripts/validators/production-readiness-validator.mjs` | Fantasy deploy surface cited as `deploymentManifests` by production-topology (TOPO-013); confuses ops reality | S | Move to `docs/archive/`; remove from production-topology and the validator |
| TOPO-016 | S2 | CI/CD | Two staging pipelines (`deploy-staging.yml`, `staging-deploy.yml`) both trigger on push→develop with divergent scopes | Second workflow added without retiring the first | `deploy-staging.yml:3-5` vs `staging-deploy.yml:3-6`; matrices differ (developer-portal absent in `deploy-staging.yml:94-102`; DB push only in staging-deploy) | Concurrent double worker deploys on every develop push; nondeterministic staging state; app-matrix drift | S | Delete one workflow (keep `staging-deploy.yml` + add the app matrix), or make one dispatch-only |
| TOPO-017 | S2 | Duplicate systems | Two theme engines: `packages/theme-engine` (5,937 LOC) and `apps/storefront-runtime/src/lib/theme-engine` (9 files) | Storefront grew its own composition/data-binding layer next to the shared package | `packages/theme-engine/src/*`; `apps/storefront-runtime/src/lib/theme-engine/{composition-engine.tsx,data-binding-engine.ts,renderer-registry.tsx,…}` | Rendering semantics split across two same-named systems; V1 confines theme-engine to "editor needs" while the renderer half lives elsewhere | M | Decide one home for composition (package or storefront); rename the other; document in V1 §6 dormant note |
| TOPO-018 | S2 | Dead-by-flag | GraphQL (1,835-line schema), extensions runtime, Liquid ship in the production Worker bundle with all three flags `false` in production, `true` in staging | Features built, then production-disabled instead of excluded | `services/api-gateway/wrangler.toml:38-40` (staging true) vs `:239-241` (production false); `src/graphql/` 6 files; `src/extensions/app-functions-runtime.ts` (623) | Production ships ~4.5k LOC it never executes (bundle size, attack surface); staging materially diverges from production behavior | M | Build-time exclude flagged-off modules for production (conditional imports/entry split), or align flags and own the surface |
| TOPO-019 | S2 | Orphans | `legacy/` Firebase backend (37 git-tracked files, 15,406 LOC) at repo root, frozen since 2026-05-25 | Migration to Supabase/Workers done; old backend never archived | `legacy/firebase/functions/src/*` (walletService, settlementService, commissionService…); `git log -1 -- legacy` = 2026-05-25 | Dead money-logic (wallets/settlement/commission) discoverable as if live; contradicts archive policy (history only under `docs/archive/`) | S | `git mv legacy/ docs/archive/firebase-legacy/` (precedent: docs/archive/flutter-legacy exists) |
| TOPO-020 | S2 | Doc sprawl | 92 root artifacts + 9 root audit dirs; ≥5 competing authority claimants; newest authority set untracked | Each engagement appends root-level mission/ledger/status/audit files; no archive discipline | Root `ls`; classification table §8; `git status` `??` on `LETBUYY_FOUNDATION_AUTHORITY/`, `FOUNDATION_AUTOPSY/`, `FOUNDATION_FORENSICS_2026_06_09/`, `IDENTITY_PLATFORM_AUDIT/`, 20+ reports | Authority ambiguity is the root enabler of TOPO-003/004/013; unversioned constitutions can be silently edited or lost | M | Adopt a root-doc budget (constitution, README, CLAUDE, current STATUS only); commit-or-archive everything untracked; move superseded docs to docs/archive |
| TOPO-021 | S2 | Constitutions | Top-ranked constitution `AGENTS.md` is a stale generated snapshot (claims 19 migrations vs 91; scan of 2026-06-08) | Generator output crowned as constitution; regeneration not tied to change events | `AGENTS.md:1` (generated header + "19 Supabase migrations"); `ls database/supabase/migrations | wc -l` = 91; `CLAUDE.md` ranking | Agents obey factually wrong numbers/maps with constitutional force | S | Regenerate on every topology-affecting merge (CI step), or strip AGENTS.md to non-volatile rules and link generated facts separately |
| TOPO-022 | S2 | Monolith hygiene | Files above the 1,500-line module ceiling in api-gateway: `tenant-tables.registry.ts` 3,051; `graphql/schema.ts` 1,835; `theme-execution.adapter.ts` 1,572 | Registry/schema growth unchecked by the route-file-only lint | `wc -l services/api-gateway/src/...` (route files max 1,494 — compliant) | Single-writer/tenant registry is a 3k-line god-file at the heart of isolation logic | M | Split tenant registry by domain; extend the ≤1500 rule beyond `routes/` |
| TOPO-023 | S2 | Deploy vs V1 | Internal-ops portals (`platform-console`, `platform-operations-portal`) deploy to production despite V1 "thin internal-ops sliver" scope (and self-described "scaffold" status) | Pre-V1 apps grandfathered into the deploy matrix | `production-deploy.yml:367-370`; AGENTS.md descriptions ("Super admin scaffold", "Employee portal scaffold"); V1 Appendix B #15 | Two privileged admin surfaces (10k LOC combined) in production beyond ratified scope; expands the staff-attack surface | M | Keep one console behind SSO/allowlist, park the other; or ARB-ratify both with an ownership/RBAC review |
| TOPO-024 | S2 | Governance economics | 187 validator scripts + 127 governance docs + 70 runtime-config contracts vs ~247k LOC product code; validators are the only consumers of dead packages | Governance grew as its own product ("two parallel systems" pattern at the meta level) | `ls scripts/validators/*.mjs | wc -l` = 187; `docs/governance` 127 files; `config/runtime` 70 files; TOPO-008 importer evidence | Governance asserts a world (reserved nodes, dead packages, Helm) that doesn't exist, while missing real drift (TOPO-006/016); maintenance tax on every change | L | Validator audit: keep gates that check deployed reality (topology-from-workflows, RLS, secrets), delete gates that check fiction; one validator per real invariant |
| TOPO-025 | S2 | Generated truth drift | `ACTIVE_DEPLOYMENT_TOPOLOGY.md` (the deployment truth doc, generated 2026-06-09) already contradicts the workflows it summarizes | Point-in-time generation, no regeneration trigger | `ACTIVE_DEPLOYMENT_TOPOLOGY.md:14,23` ("Missing `mobile-bff` in this older staging workflow") vs `deploy-staging.yml:46,66-69` (builds + deploys mobile-bff) | The doc teams rely on for "what deploys" is wrong within 24h of generation | S | Regenerate in CI on workflow changes; stamp source-commit into the doc |
| TOPO-026 | S2 | Dormant leakage | Dormant `search-core` re-exported wholesale into the active type surface | `api-types` does `export *` over 12 packages including dormant ones | `packages/typescript/api-types/src/index.ts:92` (`export * from '@letbuyy/search-core'`); api-types consumed by `api-gateway`, `marketing-site` | Dormant contracts ossify into public API; deleting dormant packages becomes a breaking change | S | Replace `export *` with explicit exports of used types; drop search-core from api-types deps |
| TOPO-027 | S3 | Duplicate utils | Money formatting hand-rolled 7× across 4 apps (incl. `formatPrice` USD default in theme-marketplace) despite `ui/formatting.ts` single source | Apps predate/ignore the shared formatter | Duplicate Systems #5 paths; `apps/theme-marketplace/src/lib/utils.ts:10` (USD) | Inconsistent INR rendering; USD default on India-first surface; violates V1 single-source rule | S | Codemod all call sites to `@letbuyy/ui` `formatCurrency`; add eslint rule banning local money formatters |
| TOPO-028 | S3 | Dead package | `packages/dart/services` is an 8-LOC facade with no consumer | WS8 M5 removed contents but kept the shell "while downstream shopper ownership is decided" | `packages/dart/services/lib/letbuyy_services.dart` (facade comment); absent from `apps/mobile/merchant-app/pubspec.yaml:17-24`; listed in root `pubspec.yaml` workspace | Phantom workspace member; melos bootstrap cost | S | Delete the package + workspace entry (recreate if shopper-app ever activates) |
| TOPO-029 | S3 | Package fragmentation | Six identity contract micro-packages totaling 334 LOC (44–73 LOC each), all consumed only by api-gateway (+ each other) | One-package-per-noun decomposition from the 22-service plan | `packages/{identity,session,token,permission,organization,audit}-core/src/index.ts` wc -l: 60/53/44/45/59/73 | 6 package.json/tsconfig/AGENTS/build pipelines to maintain ~5 files of types | S | Fold all six into `auth-core` (or shared-types) with sub-path exports |
| TOPO-030 | S3 | Config hygiene | `SKIP_NEEDS_HUMAN` placeholder values baked as plaintext `[env.production.vars]` in the deployed gateway config (74 occurrences repo-wide) | Honesty-sentinel pattern applied inside prod deploy unit instead of secret store | `services/api-gateway/wrangler.toml:253-262` (WHATSAPP_WEBHOOK_SECRET, TWILIO_ACCOUNT_SID, AI_CREDIT_RAZORPAY_KEY_ID…); preflight rule `config/runtime/production-safety-preflight.json:9` | Pattern is honest and preflight-guarded, but secrets-shaped values live as vars; risk of someone "filling them in" in plaintext | S | Move all secret-shaped keys to `wrangler secret`; keep vars only for non-secrets; preflight already enforces non-sentinel |
| TOPO-031 | S3 | Repo scope | Founder marketing content at engineering repo root, untracked (`FOUNDER_CONTENT_ENGINE/` 7 files, `founder-journey/` 3 files) | Convenience drop into the code repo | `git status` `?? FOUNDER_CONTENT_ENGINE/`, `?? founder-journey/`; file listings (LinkedIn/X/IG/YouTube 90-day plans) | Non-engineering IP unversioned in a code tree; noise in every audit | S | Move to a content repo/drive, or commit under `docs/marketing/` |
| TOPO-032 | S3 | Clutter | Build caches and empty dirs at root: `build/` (Flutter test cache, 9 files), `.tmp/` (empty), `test-results/` (1), `.codex/` (empty), `memory/` (1 stale file) | Tooling residue without cleanup discipline | `find build -type f` (dill caches); root `ls -la` | Auditor/agent noise; risk of accidental tracking | S | Extend .gitignore (build/, test-results/, .tmp/); delete empties; fold memory/lessons.md into docs |
| TOPO-033 | S3 | Deploy asymmetry | `developer-portal` deploys to production without a local `vercel.json` and is absent from the `deploy-staging.yml` matrix | App added to prod matrix; staging matrix + local config never updated | deploy-config find (no `apps/developer-portal/vercel.json`); `production-deploy.yml:365-366`; `deploy-staging.yml:94-102` | Prod-only app with Vercel-dashboard-implicit build config; untestable in staging path | S | Add vercel.json + staging matrix entry — or remove from prod matrix per TOPO-004 |
| TOPO-034 | S3 | Repo weight | 176 git-tracked binary screenshots under `artifacts/local-operational-proof/` + 319 PNG visual baselines in `packages/typescript/ui` | Evidence and snapshots committed to the code repo | `git ls-files artifacts/ | wc -l` = 176; ui package file-type census (319 .png) | Clone weight grows monotonically; screenshots are write-once evidence better suited to release artifacts/LFS | S | Move operational proof to CI artifacts or LFS; keep only current visual baselines |
| TOPO-035 | S3 | God-files | Contract god-files: `api-client/src/index.ts` 4,943 lines; `shared-types` 7,785 LOC/7 files; `app-engine/src/index.ts` 2,084 (dead) | Single-file package style | `wc -l packages/typescript/api-client/src/index.ts`; package LOC census | Merge-conflict magnet; every consumer recompiles on any change | M | Split api-client by domain module; carve shared-types into sub-path exports |
| TOPO-036 | S3 | Governance docs | 89 `AGENTS.md` files across the tree, all subordinate to a stale generated root constitution | Per-directory constitution pattern | `find . -name AGENTS.md … | wc -l` = 89 | Update fan-out on every policy change; drift guaranteed | M | Generate per-dir AGENTS from one source; or reduce to root + per-runtime only |
| TOPO-037 | S3 | docs/ sprawl | `docs/` = 1,176 files; `docs/archive/` alone 468; plus 9 root audit dirs duplicating docs/audit* trees | No retention/index policy; each audit adds a tree | docs census table §2; `find docs/archive -type f | wc -l` = 468 | Search noise; conflicting historical claims cited as current (this audit had to re-verify everything) | M | Index + dedupe: one `docs/audits/<date>/` convention; root audit dirs moved under it |
| TOPO-038 | S3 | Superseded missions | 16 Build-Mission task specs (`tasks/executable/001…016`) for partially-rejected scope retained at root | V1 Appendix C reconciled the tasks but files never moved | `tasks/executable/*.md` listing; V1 Appendix C | Agents may execute superseded instructions (e.g., 010 notifications-service activation contradicts R-2) | S | Stamp each file with its V1 Appendix C verdict or move to docs/archive |
| TOPO-039 | S2 | Process | Repo is being modified by concurrent automation during audits; HEAD advanced mid-audit; `.git/index.lock` contention observed | Multiple agents/processes share one working tree | HEAD `c94b71eb` → `5cf9e64e` between two commands in this session; `warning: unable to unlink .git/index.lock` during read-only `git status` | Audit/test evidence is unstable; risk of half-committed states (TOPO-001 is the live example) | S | Serialize agent work via worktrees/branch locks; require clean-tree gates before audits/certifications |
| TOPO-040 | S2 | V1 deferral breach | Monthly production cron executes hot-table partition maintenance although V1 §5/§7 defers partitioning to P2 | Pre-V1 partition infra (migrations 081, 131) left armed | `.github/workflows/hot-table-partition-maintenance.yml:4-6` (`cron "15 2 1 * *"`, default production, `EXECUTE_MAINTENANCE=true` on schedule) | Scheduled prod-DB DDL maintenance for a deferred capability; runs against the live database with no current need | S | Disable the schedule (keep workflow_dispatch plan-mode); revisit at the P2 trigger |
| TOPO-041 | S3 | Naming/duplication meta | `DESIGN_TOKEN_AUDIT.md` exists at both root and `docs/` with same name (and 12 root governance reports mirror docs/ trees) | Reports written to both locations | root `ls` + `docs/` listing (both contain `DESIGN_TOKEN_AUDIT.md`) | Two versions of "the" audit can diverge silently | S | Single location per report; symlink/link from index |

### Severity totals

| Severity | Count |
|---|---:|
| S0 | 2 (TOPO-001, TOPO-002) |
| S1 | 6 (TOPO-003…008) |
| S2 | 20 (TOPO-009…026, 039, 040) |
| S3 | 13 (TOPO-027…038, 041) |
| **Total** | **41** |

### UNVERIFIED (and what would prove it)

- **CI/deploy success**: whether GitHub secrets exist and `production-deploy.yml`/staging workflows actually succeed (needs GitHub Actions run history / Vercel+Cloudflare dashboards).
- **Live DNS/runtime state** of `api.letbuyy.store`, `bff.letbuyy.com`, the nine Vercel apps, and whether `main`'s old code is what currently serves traffic (needs DNS + HTTP probes; not performed from this offline tree).
- **Full RLS coverage** per tenant table (17 migrations carry FORCE; proving every tenant table is covered needs live-DB `pg_policies` introspection or executing `tests/` RLS suites).
- **Workspace build health** (`pnpm turbo build` across 50 workspaces) and wave test pass status (`test:foundation:wave0..7`) — not executed (runtime > sandbox timeout; mutating caches).
- **Vercel project-level config** for `developer-portal` (deploys without local vercel.json — project settings live in Vercel, not the repo).

*End of Phase 1 — Repo Topology Audit. Evidence pinned at `stepup/main` @ `5cf9e64e`, working tree dirty, 2026-06-10.*
