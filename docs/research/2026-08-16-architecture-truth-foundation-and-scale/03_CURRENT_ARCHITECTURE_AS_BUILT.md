# 03 — The Architecture as Built (source and configuration at this SHA)

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> Audited commit `f52abca7ef6b2ddfc39f03b38206779cbe543e46` · branch `stepup/main` · 2026-08-16.

---

## 0. What this document is, and the four things it establishes

`02_GOVERNED_ARCHITECTURE.md` states what law requires. `04_LIVE_DEPLOYMENT_TRUTH.md` states that what production runs is `UNKNOWN`. This document is the third thing: **what the repository actually contains and does at this SHA.** Every claim is `VERIFIED-SOURCE` or `VERIFIED-CONFIG` unless marked otherwise. Nothing here proves deployment.

**The four load-bearing conclusions:**

1. **The topology is clean and the count question is settled.** 8 / 9 / 10 / 11 / 17 / 21 are six different, individually correct counts of six different things (§A.1). The six reserved services and two reserved mobile roots are genuinely empty — two files each, enforced by a path allowlist (§A.4). All seven `ARCH-R7` rejected packages are absent with zero importers. The four frozen apps are de-deployed at the root, and the frozen backend that *is* compiled into the monolith is **provably unreachable** behind a fail-closed kill switch with a real behavioural test (`VERIFIED-TEST`). The one genuine topology breach is `services/lcis-api`, an undeclared ninth service root (§A.3).
2. **Database-enforced tenancy is DDL-real and runtime-dead.** `withResolvedTenantTx` — the only code that issues `SET LOCAL ROLE app_tenant` plus the tenant GUC — has **zero callers outside its own definition and one string-matching test**. All 114 gateway files that touch data use `getSupabaseAdmin`, whose own doc-comment says it "bypasses RLS" (`services/api-gateway/src/lib/supabase.ts:11-15`). This is the only S0 that survived the adversarial pass with severity intact.
3. **Two checkout implementations are live and only one is governed.** The path the shipped UI uses (`POST /v1/storefront/:subdomain/orders`) is mounted 27 lines before the auth middleware and requires no signed handoff at all; the ART-14 hosted path (`/v1/checkout/*`) confirms payment from an unverified client-supplied `provider_payment_id`. I verified both mechanisms directly (§B.14, §B.17).
4. **The gate is a static-analysis suite, not a behavioural one.** 0 of 110 gate-lane validators execute the runtime, boot a Worker, or connect to Postgres. Real behavioural coverage exists and runs on every PR — 20 Docker-Postgres suites under `tests/executable/` with no skip guards — but it is invisible inside a 582-file corpus that is ~38% source-grep.

### 0.1 Evidence caveat that must travel with this document

The discovery pass produced 217 findings across 10 dimensions. An adversarial verification pass then re-derived 32 of the highest-severity claims from source and returned **26 OVERSTATED, 2 REFUTED, 4 CONFIRMED**. Wherever a verdict exists, this document uses the corrected claim, severity, and evidence state — never the original.

**Two dimensions received no adversarial pass at all: `data` and `flow-commerce`.** Those two dimensions carry five of the surviving S0-rated claims. Given that 81% of adversarially-tested claims were overstated, **every unverified `data` and `flow-commerce` S0 in this document should be read as a single-pass claim, not a settled fact** — except the two I independently re-derived from source myself (§B.14, §B.17, marked *own reading*).

| Dimension | Findings | Adversarial verdicts | Status of its S0s |
|---|---|---|---|
| topology | 19 | 3 (2 OVERSTATED, 1 REFUTED) | none |
| **data** | **24** | **0** | **3 S0 claims — single-pass, unverified** |
| deploy | 19 | 5 (4 OVERSTATED, 1 CONFIRMED) | none |
| flow-identity | 20 | 5 (4 OVERSTATED, 1 CONFIRMED) | none |
| **flow-commerce** | **25** | **0** | **2 S0 claims — single-pass; both re-derived here** |
| flow-storefront | 19 | 3 (all OVERSTATED) | none |
| async | 21 | 5 (all OVERSTATED; 3 S0 → S1/S2) | 3 S0s all downgraded |
| tests | 18 | 5 (4 OVERSTATED, 1 REFUTED) | none |
| observability | 26 | 5 (4 OVERSTATED, 1 CONFIRMED) | 2 S0s both → S1 |
| governance-drift | 26 | 1 (CONFIRMED) | 1 S0 **held at S0** |

---

# A. Runtime and root inventory

## A.1 The count reconciliation — settled exactly

The seed question for this audit was why the repository is variously described as having 8, 9, 10, 11, or 21 runtimes. **There is no contradiction. Six different artefacts count six different sets.** All six numbers were re-derived first-hand at this SHA.

| Count | What it is | Where it comes from | State |
|---|---|---|---|
| **8** | The `ARCH-R1` **constitutional core runtimes** | `AGENTS.md:70-78` — api-gateway, queue-workers, mobile-bff, identity-platform, webhook-service, storefront-runtime, merchant-control-plane, marketing-site | `GOVERNED` |
| **9** | **Production CI deploy targets** = 5 Vercel Next apps + 4 Cloudflare Workers | `.github/workflows/production-deploy.yml:331-385` (workers), `:398-427` (apps); asserted by `scripts/validators/deploy-matrix-topology-validator.mjs:18-31,140` ("9 production deploy targets"). **= the 8 core + `apps/platform-console`** | `VERIFIED-CONFIG` |
| **10** | `canonicalRuntimeRoots` = `canonicalAppRoots`(6) + `canonicalServiceRoots`(4) | `scripts/validators/governance-common.mjs:97-116`. **= the 9 + `apps/mobile/merchant-app`**, which releases via `.github/workflows/mobile-merchant-release.yml`, not `production-deploy.yml` | `VERIFIED-SOURCE` |
| **11** | `production-topology.json` entries with `status: "active"` | `config/runtime/production-topology.json` — re-counted: 11 active. **= the 10 code roots + `database/supabase`**, a schema root, not a code runtime | `VERIFIED-CONFIG` |
| **17** | `deployment-topology.json` `nodes[]` | `config/runtime/deployment-topology.json` — re-counted: 17. **= 11 active + 6 reserved.** The 4 frozen apps are omitted | `VERIFIED-CONFIG` |
| **21** | `production-topology.json` total `runtimes[]` | re-counted: 21 = 11 `active` + 6 `reserved` + 4 `frozen` | `VERIFIED-CONFIG` |
| *(5)* | `config/vercel/projects.json` apps | identity-platform, merchant-control-plane, storefront-runtime, marketing-site, platform-console | `VERIFIED-CONFIG` |
| *(22)* | `runtime.manifest.json` files on disk | 12 app roots (incl. 3 mobile) + 10 service roots. **`services/lcis-api` is the only `package.json`-bearing root without one** — re-verified by enumerating `apps/* apps/mobile/* services/*` | `VERIFIED-SOURCE` |

**The one real defect inside the count question.** `config/runtime/deployment-topology.json` declares `generatedFrom: "runtime-manifests"` while omitting the four frozen apps — all four of which *do* carry `runtime.manifest.json` files. A genuine generation from runtime manifests would yield 21 nodes, not 17. `scripts/validators/runtime-topology-validator.mjs:16` asserts only that the `generatedFrom` string literally equals `"runtime-manifests"`; it never verifies the derivation. **The provenance claim is false and the validator guarding it checks a string.** `VERIFIED-CONFIG`.

## A.2 App roots (10 on disk, 12 including reserved mobile)

| Path | Class | Framework | Entry | Deploy manifest | Real src | Tests | Constitutional status |
|---|---|---|---|---|---|---|---|
| `apps/storefront-runtime` | canonical | next 16.1.6 / react 19.2.3 | `next.config.ts` + `src/proxy.ts` | `vercel.json` + registry + both matrices | 146 files | **0** | conforms (topology); zero-test buyer runtime |
| `apps/merchant-control-plane` | canonical | next 16.1.6 / react 19.2.3 | `next.config.ts` | `vercel.json` + registry + matrices | 309 | 13 | conforms |
| `apps/identity-platform` | canonical — sole asymmetric issuer | next 16.1.6 / react 19.2.3 | `next.config.ts` | `vercel.json` + registry + matrices | 72 | 5 | conforms |
| `apps/marketing-site` | canonical | next 16.1.6 / react 19.2.3 | `next.config.ts` | `vercel.json` + registry + matrices | 106 | **0** | conforms |
| `apps/platform-console` | supporting (`ARCH-R10` surviving ops console) | next 16.1.6 / react 19.2.3 | `next.config.ts` | `vercel.json` + registry + matrices | 48 | **0** | conforms |
| `apps/mobile/merchant-app` | supporting, canonical, separate release | Flutter, Dart sdk ^3.10.0 | `pubspec.yaml` | `mobile-merchant-release.yml` (signed AAB artifact) | 159 dart | 6 | conforms |
| `apps/app-marketplace` | **frozen** | next 16.1.6 | `next.config.ts` | **none** | 95 | 0 | root conforms; backend compiled into gateway but **unreachable** (§A.5) |
| `apps/developer-portal` | **frozen** | next 16.1.6 | `next.config.ts` | **none** | 26 | 0 | conforms at root |
| `apps/theme-marketplace` | **frozen** | next 16.1.6 | `next.config.ts` | **none** | 74 | 3 | conforms at root; **has no row in DOC 03, DOC 04's register, or `AGENTS.md`** — an app root with no constitutional fate |
| `apps/platform-operations-portal` | **frozen** (`ARCH-R10` non-survivor) | next 16.1.6 | `next.config.ts` | **none** | 36 | 0 | conforms at root; still named "active owner" by `apps/mobile/operator-app/runtime.manifest.json` |
| `apps/mobile/shopper-app` | **reserved** | — | — | — | **0 (2 files)** | 0 | conforms |
| `apps/mobile/operator-app` | **reserved** | — | — | — | **0 (2 files)** | 0 | conforms |

## A.3 Service roots (11 on disk)

| Path | Class | Framework / pins | Entry | Deploy manifest | Real src | Tests | Constitutional status |
|---|---|---|---|---|---|---|---|
| `services/api-gateway` | canonical — **the modular monolith** | hono ^4.7.0 → lock 4.12.4; wrangler ^4.100.0 → lock 4.100.0; compat date 2026-05-25 | `src/index.ts` | `wrangler.toml` (`letbuyy-api`) + prod matrix | 312 files / **100,735 lines**, 83 mounted routers | 82 | conforms; carries the frozen marketplace backend and an unmounted Wasm executor |
| `services/queue-workers` | canonical satellite | wrangler ^4.100.0, no hono | `src/index.ts` | `wrangler.toml` (`letbuyy-queue-workers`) + prod matrix | 20 files / 4,487 lines | 9 | conforms |
| `services/webhook-service` | canonical satellite | hono ^4.0.0 | `src/index.ts` | `wrangler.toml` (`letbuyy-webhook`) + prod matrix | 7 files / 1,727 lines | 3 | conforms |
| `services/mobile-bff` | canonical satellite | hono ^4.0.0 | `src/index.ts` | `wrangler.toml` (`letbuyy-mobile-bff`) + prod matrix | **1 file / 516 lines** (re-counted) | 1 | conforms, but thin relative to its `ARCH-R1` standing; absent from the rollout deploy script and 3 validators |
| **`services/lcis-api`** | **UNGOVERNED** | hono ^4.7.0, zod ^4.3.6, `@hono/node-server` | `src/server.ts` (port `LCIS_API_PORT`, default 7100) | **none — no wrangler.toml, no vercel.json, NO `runtime.manifest.json`** | 4 files / **1,527 lines** (re-counted: 1324+177+21+5), 52 routes | 2 files / 2,205 lines | **`ARCH-R2` breach — see below** |
| `services/checkout-runtime` | reserved | — | — | — | **2 files** | 0 | conforms |
| `services/event-bus` | reserved | — | — | — | **2 files** | 0 | conforms |
| `services/notification-service` | reserved | — | — | — | **2 files** | 0 | conforms |
| `services/analytics-pipeline` | reserved | — | — | — | **2 files** | 0 | conforms |
| `services/media-service` | reserved | — | — | — | **2 files** | 0 | conforms |
| `services/search-service` | reserved | — | — | — | **2 files** | 0 | conforms |

### `services/lcis-api` — the corrected verdict (S2, not S1)

The original finding rated this S1 on the grounds that it is an unowned, unauthenticated HTTP service reading provider credentials. **The adversarial pass corrected it to S2 / `VERIFIED-SOURCE`**, and this document uses the corrected claim.

**What is confirmed** (I re-verified the manifest gap and line counts myself): it is the only `apps/*` or `services/*` root with a `package.json` and no `runtime.manifest.json`; it is absent from `canonicalServiceRoots` and `reservedServiceRoots` (`scripts/validators/governance-common.mjs:97-111`); it is absent from both topology files; its middleware (`services/lcis-api/src/middleware.ts:1-177`) implements request-id, security headers, per-IP rate limiting, Zod validation and audit logging but **no authentication of any kind**; and because the root `build`/`typecheck` scripts filter only the 4 frozen apps (`package.json:16,124`) it sits inside `pnpm build`, `pnpm typecheck` and `turbo test`.

The enforcement gap is structural and is the mechanism: `scripts/validators/runtime-validator.mjs:21,33-48` readdirs `apps/` and rejects unexpected app roots, but `:72` only iterates the canonical list for services — **`services/` is never enumerated, so an undeclared service root is structurally undetectable.** `AGENTS.md:81` self-annotates `ARCH-R2` with `[validator-gap]`.

**What the adversarial pass refuted, and why S1 is not earned:** it *is* code-owned (`.github/CODEOWNERS:6,27`); it *does* carry a hand-authored `services/lcis-api/AGENTS.md` forbidding production deploy targets; it is registered `HUMAN_DECISION_REQUIRED` in `config/governance/web-v1-scope-registry.json:450-460`; and that registry is a **gate-registered growth ratchet** (`scripts/validate-governance.mjs:180`) whose un-baselined probes would fail if it were added to `production-deploy.yml` or to the api-gateway dependency graph. The "drags 7 LCIS packages into the CI critical path" causation is also wrong — those packages are enumerated independently in `pnpm-workspace.yaml`. The residual gap is narrower: a *different* workflow or a manual ops launch is not probed.

**Classification (delete / relocate under `tools/` / adopt as a ninth runtime) is `HUMAN-REQUIRED`.**

## A.4 The conformance wins — state these plainly

These are the strongest surfaces in the repository and they are enforced behaviourally, not by name-matching.

**The six reserved services and two reserved mobile roots are genuinely empty.** I re-enumerated all eight: **exactly two files each** (`AGENTS.md` + `runtime.manifest.json`). Zero source, zero tests, zero `package.json` (so none is a pnpm workspace member despite the `services/*` glob), zero `wrangler.toml`, zero `vercel.json`, zero `pubspec.yaml`. Every manifest declares `implementationStatus.status: "reserved-not-implemented"`, `sourceState: "manifest-and-agents-only"`, `deploymentAuthority.platform: "Reserved only - no deployable runtime artifact"` with `config: []`, and names the real current owner. None appears in any deploy workflow. Enforcement is a **path allowlist, not a name check**: `scripts/validators/no-reserved-service-activation-validator.mjs:14-26` allowlists exactly `{root}/AGENTS.md` and `{root}/runtime.manifest.json` and flags any other tracked file; `scripts/validators/mobile-topology-honesty-validator.mjs:18-50` asserts the same independently for the two mobile roots plus the manifest field values. **`ART-19` / `ARCH-R4` / `ARCH-R5` / `ARCH-R6` fully conform.** `VERIFIED-SOURCE`. This is the reference pattern for how `ARCH-R2` should also be enforced.

**All seven `ARCH-R7` rejected packages are absent with zero importers.** `packages/app-engine`, `application-services`, `extension-host`, `projection-runtime`, `orchestration`, `distributed-runtime`, `runtime-composition` — none exists on disk, and ripgrep for each `@letbuyy/<pkg>` specifier across `apps/`, `services/` and `packages/` returns **0 files for all seven**. `scripts/validators/no-rejected-package-imports-validator.mjs:55-59` asserts the roots are **deleted**, not merely unimported, and `:39-53` additionally blocks the terminology `orchestration-runtime` and `application-service` in active source. (`packages/lcis-orchestration` exists but is LCIS tooling with a distinct specifier and 0 app/service importers.) `VERIFIED-SOURCE`. Note that `AGENTS.md:92` still describes these packages as "kept temporarily until their asserting validators are retargeted" — **that text is now stale**; the retargeting is done and the roots are gone.

**Import boundaries `ARCH-R11`/`R12`/`R13`/`R14` are clean at both import and `package.json` dependency level.** Zero apps import apps; zero services import apps; zero packages import apps or services; no active runtime imports repository-level `infrastructure/*`. Verified two independent ways (specifier ripgrep + programmatic scan of every `package.json` dependency block). The dependency graph is strictly apps→packages, services→packages, packages→packages. The only cross-root reaches are three **test** files using deep relative paths (`services/api-gateway/src/__tests__/checkout-d6.test.ts:7`; `services/queue-workers/test/gateway-events.test.mjs:4`; `services/webhook-service/test/gateway-events.test.mjs:4`) — an `ARCH-R15` S3, test-only.

## A.5 The four frozen apps — de-deployed at the root, and the backend is provably unreachable

**At the app-root level, freeze holds completely.** For all four of `app-marketplace`, `developer-portal`, `theme-marketplace`, `platform-operations-portal`: no `vercel.json`; absent from `config/vercel/projects.json` (which lists exactly the 5 active apps); absent from `production-deploy.yml:398-408`, `staging-deploy.yml:180-192` and `deploy-staging.yml:130-136`; each `runtime.manifest.json` declares `runtimeCategory: "frozen-next-app"`, `deploymentAuthority.platform: "frozen-not-deployed"`, `config: []`, `secretStore: "none - frozen app is not deployed"`; and all four are excluded from root `build`, `lint` and `typecheck` (`package.json:16,17,124`). They retain real source (95 / 26 / 74 / 36 files) — the intended source-kept, de-deployed state. `scripts/validators/deploy-matrix-topology-validator.mjs:48-113` asserts every one of these conditions. `VERIFIED-CONFIG`.

**The app-marketplace backend IS compiled into the always-deployed monolith** — 11 route modules under `services/api-gateway/src/routes/app-store/`, mounted at `services/api-gateway/src/index.ts:756-757`. The original finding rated this S1 on the grounds that the frozen capability's OAuth, install-lifecycle, billing and revenue-share surface is therefore reachable on the production gateway.

> **That claim was REFUTED. Corrected verdict: INFO / `VERIFIED-TEST`.**

I re-read the mount site myself. A dedicated fail-closed kill switch is registered **before** the mounts — `api.use('/app-store', appPlatformKillSwitch)`, `'/app-store/*'`, `'/app'`, `'/app/*'` at `index.ts:729-732`, plus `'/operations/marketplace-reviews'` and `'/operations/developers'` at `:740-743`. Hono composes in registration order, so the gate runs first. `services/api-gateway/src/middleware/appPlatformKillSwitch.ts:25-28` is explicitly fail-**closed** (`return value ? POSITIVE.has(value) : false`) and its docblock states it deliberately does not reuse the fail-open `featureGate`. `FEATURE_APP_PLATFORM` is declared in **no** `wrangler.toml` var block and **no** deploy workflow.

The evidence state is `VERIFIED-TEST`, not merely `VERIFIED-CONFIG`, because `services/api-gateway/src/__tests__/app-platform-killswitch.test.ts` imports the real handler from `../index.ts`, **enumerates every route from the live `appStoreRouter`/`appApiRouter` rather than hard-coding them** (asserting ≥60 routes), and asserts `404` + `error.code === 'APP_PLATFORM_DISABLED'` for every enumerated route across nine env shapes **including the verbatim `[env.production.vars]` and `[env.staging.vars]` blocks**, with a positive control proving the 404s are the gate and not a broken mount. It runs in CI (`ci.yml:159`). Every merchant-control-plane and platform-console UI entry point 404s independently via a mirrored fail-closed flag (`apps/merchant-control-plane/src/lib/app-platform-flag.ts:11-13`).

**What survives is narrow and correctly INFO-grade:** "frozen" here is enforced by a runtime flag plus dead-but-shipped code (~340KB) rather than by code removal; `services/mobile-bff/src/index.ts:68-69` still allowlists the frozen prefixes for proxying (inert while the gateway 404s); and `deploy-matrix-topology-validator.mjs:83-113` asserts only app-root properties, never capability reachability — so a reader of that validator alone should not infer capability-level freeze.

## A.6 Packages, tools, infrastructure

| Group | Count | Size | Governance status |
|---|---|---|---|
| Commerce/runtime pnpm packages | 21 | 228 TS files / **81,100 lines** | In `pnpm-workspace.yaml`, turbo graph, `activeRootPrefixes` |
| **LCIS/intelligence pnpm packages** | **19** | 542 TS files / **119,107 lines (59.5% of the `packages/` TS footprint)** | In the workspace and the root turbo graph; **zero apps or services import any of them** (runtime-isolated from commerce, but on the CI critical path — `ci.yml:156` runs a full-repo `turbo typecheck` in the merge-safety gate) |
| Dart packages | 4 | — | `packages/dart/{core,models,ui_kit}` are in `workspacePackageRoots`; **`packages/dart/api_client` is not**, despite being a path dependency of the canonical Flutter app (`apps/mobile/merchant-app/pubspec.yaml:19-20`) |
| `tools/graph-server` | 81 files | 7,287 lines | **Outside every governance perimeter** — no `package.json`, not in `pnpm-workspace.yaml`, not in `turbo.json`, `tools/` absent from `activeRootPrefixes` (`governance-common.mjs:163-170`) |
| `tools/central-intelligence` | 121 files | 38,877 lines + a `docker-compose.yml` declaring Qdrant (:6333/:6334) and signoz-clickhouse | Same — has its own `package.json` (`@letbuyy/central-intelligence`) and therefore **installs dependencies outside the frozen lockfile** |
| `infrastructure/` | 8 subtrees, 41 files | — | `ARCH-R14` clean: 0 imports from `apps/` or `services/` |

**The LCIS-vs-commerce line-count inversion is a real, citable fact:** 119,107 lines of intelligence tooling against 81,100 lines of commerce packages. Every one of the 19 LCIS packages declares both a `build` and a `test` script, so all sit in the root turbo graph that every commerce PR must keep green.

## A.7 Cloudflare bindings actually declared (api-gateway, `[env.production]`)

Re-read first-hand in `evidence/02-api-gateway-wrangler-production.txt`. `VERIFIED-CONFIG` — **configuration, not deployment.**

| Binding class | Declared |
|---|---|
| Queues (producers) | `EVENT_QUEUE`, `ANALYTICS_QUEUE`, `SEARCH_QUEUE`, `NOTIFICATION_QUEUE`, `RUNTIME_QUEUE` |
| KV | `CACHE` (id `ee82af47…`) |
| R2 | `R2_BUCKET` → `letbuyy-media-production` |
| Hyperdrive | `HYPERDRIVE` (id `9e08563f…`) |
| D1 | `RUNTIME_DB` → `letbuyy-production-d1` (`76d197a5…`), own `migrations_dir` |
| Durable Object | `RUNTIME_COORDINATOR` → `LetbuyyRuntimeDurableObject`, `new_sqlite_classes` |
| Service | `WEBHOOK_SERVICE` → `letbuyy-webhook` |
| Analytics Engine | `RUNTIME_TELEMETRY` → `letbuyy-production-telemetry` |
| Routes / cron / placement | `api.letbuyy.com` custom domain; `crons = ["*/15 * * * *"]`; `placement mode = "smart"` |

---

# B. The twenty flow traces

## B.0 Summary matrix

Legend: **DB role** — `svc` = `service_role` via `getSupabaseAdmin` (BYPASSRLS); `defr` = inside a `SECURITY DEFINER` RPC. **Test class** — `behavioural` = executes the code; `source-grep` = `readFileSync` + `assert.match`; `none`.

| # | Flow | Auth mechanism | Authorization | Tenant derivation | DB role | Transaction boundary | Idempotency | Audit record | Failure response | Test class |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Merchant signup | none (public) | — | none | `svc` | per-statement | OTP token row | **none** | 4xx JSON | source-grep |
| 2 | Merchant login → session issue | password (bcryptjs cost 12) + Turnstile | email allowlist n/a | none | `svc` | per-statement | none | **none** | 401 JSON | behavioural (issuer only) |
| 3 | Session refresh / rotation | — | — | — | `defr` | single RPC | `UNIQUE(old_token_hash)` | rotation-events table | — | **dead code** |
| 4 | Revocation (logout / logout-all) | session cookie | self | none | `svc` | single UPDATE | none | **none** | 200 | source-grep |
| 5 | Store switch `/api/auth/switch` | session + `lb_accounts` cookie | target ∈ signed cookie | none | `svc` | **non-atomic** (destroy before validate) | rate-limit only | **none** | 401 / 403 / 404 | source-grep only |
| 6 | Buyer / customer session | **HS256 shared secret** | customer_id + store scope | `store_id` cross-check | `svc` | stateless verify (0 DB reads) | n/a | activity row | 401 | source-grep |
| 7 | Operator (platform-console) | email allowlist + per-principal TOTP | allowlist | n/a | `svc` | stateless 8h | **none** (magic link replayable 15 min) | **yes** — `/internal/console/audit-logs` | 401 | source-grep |
| 8 | Claim → tenant GUC bridge | validated ES256 claim (in principle) | — | `assertTenantSiteId` UUID | **`app_tenant`** | pooled SQL tx | n/a | request-id GUC | throws | **ZERO CALLERS** |
| 9 | Subdomain resolution | none | publish/access gates | host → `sites.subdomain` | `svc` | 1 SELECT | n/a | none | 404 / 401 / **503 fail-closed** | none |
| 10 | Custom domain resolution | none | `custom_domain_status='active'` | host → `sites` then `site_domains` | `svc` | up to 3 SELECTs | n/a | none | 404 / 503 | none |
| 11 | PLP / PDP render (hit & miss) | none | published-store gate | subdomain handle | `svc` + pooled | per-query | n/a | sampled view event **on miss only** | 404 uncached | source-grep ("performance") |
| 12 | Cache invalidation on mutation | merchant session | site ownership | handle set | `svc` | KV put | n/a | none | silent | none |
| 13 | Cart create / mutate | cart token | token ⇒ cart | `store_id` on cart | `svc` | 3 reads + 1 write, **5 separate txns** | idempotency row | outbox event | 4xx | source-grep |
| 14 | Checkout session + signed handoff | **HMAC-SHA256 over cart digest** | digest recompute + timing-safe compare | `siteId` in payload | `svc` | 4 separate txns | `idempotency_key` | outbox | 503 if unsigned; 409 on mismatch | behavioural (D6 test) |
| 15 | Inventory reserve→commit | inherited | inherited | `p_store_id` param | `defr` | **reserve+commit in ONE tx** | reservation row | `inventory_events` | RPC EXCEPTION | **behavioural** (oversell test) |
| 16 | COD order + confirmation | **none — public route** | **none** | `:subdomain` path param | `svc`+`defr` | 4 txns + 1 RPC tx | `idempotency_key` | audit INSERT in RPC | 4xx | none |
| 17 | Prepaid create/verify/capture/webhook | HMAC (verify + webhook) | replay-guard on verify | order → `store_id` | `svc`+`defr` | 4 txns per hop | `assertProviderPaymentNotReplayed`; `(provider,event_id)` unique | `payment_webhook_events` | 4xx / 502 | source-grep |
| 18 | Refund + reversal + step-up | session + **HMAC step-up** | step-up bound to action+actor+site | resolved tenant | `svc`+`defr` | RPC tx; gift-card restore **outside** | `idempotency_key` | ledger + refund rows | **502 with no ledger entry** on provider failure | behavioural (ledger only) |
| 19 | Ledger posting + reconciliation | internal | `writer_module` CHECK | GUC set inside RPC from data | `defr` | single RPC tx, deferred balance constraint | `idempotency_key` | append-only, immutable | RAISE | **behavioural** (money-ledger) |
| 20 | Outbox → queue → worker → DLQ | HMAC tenant envelope (**15-min window**) | — | envelope `siteId` | `svc`+`defr` | **SQL path in-tx; TS path post-commit** | `UNIQUE(idempotency_key)` | `distributed_queue_messages` (write-only) | quarantine → dead-letter | source-grep only |

## B.1 Merchant signup

`apps/identity-platform/src/app/api/auth/signup/route.ts:40` per-IP rate limit → `:49` CSRF double-submit → `:60` Turnstile → gateway `POST /v1/auth/custom/users/by-email` → `/users/ensure` → `createOTPToken` (6-digit, `services/api-gateway/src/routes/auth.ts:214-218`) → Resend email. **No audit record is written for any merchant authentication event anywhere in `apps/identity-platform/src` or `services/api-gateway/src/routes/auth.ts`** — by contrast `apps/platform-console/src/lib/console-auth-server.ts:208-238` does audit its login/MFA/logout, proving the pattern is understood.

OTP verification (`api/auth/verify-otp/route.ts:20`) throttles **5 attempts / 15 min per source IP only**. The gateway validates by plain equality (`auth.ts:1304-1311`), the token row carries **no attempt counter**, and it is invalidated only on success (`:1333`) — never after N failures. The consume is a read-then-write, not a conditional `UPDATE … WHERE used=false`.

## B.2 Merchant login and session issue

`login/route.ts:22` rate limit → `:31` CSRF → `:42` Turnstile → gateway `/users/authenticate` → **bcryptjs cost 12, pure JavaScript, inside the metered Worker isolate** (`services/api-gateway/src/lib/merchant-password.ts:3,11`; invoked `routes/auth.ts:527`) → MFA → device → `createSession`.

`createSession` (`apps/identity-platform/src/lib/auth/session.ts:8-39`) mints the **ES256 token** — `new SignJWT(...)` with the key from `LETBUYY_IDENTITY_PRIVATE_JWK`, `aud: letbuyy:merchant-session`, `iss: LETBUYY_IDENTITY_ISSUER`, TTL 30 days, `jti: crypto.randomUUID()` (`identity-issued-session.ts:52-68`) — then `POST`s it to the gateway, which **verifies it once** (`routes/auth.ts:1130`) and then stores it **verbatim as the row value**: `db.from('sessions').insert({ user_id, device_id, token, expires_at })` where `token` is the ES256 JWT (`auth.ts:1141-1149`).

**The consequence is architectural:** the asymmetric signature is verified exactly once per login. Every subsequent request authenticates against the opaque DB row via `validate_and_rotate_merchant_session`, not against the signature. `R-14` is satisfied for the merchant asymmetric realm — and the verifier has a **real behavioural test** with generated keypairs covering forge / HS256 / missing-`jti` denial (`services/api-gateway/src/__tests__/identity-issuer-d3.test.ts:93-153`), the one identity test in this repository that actually exercises forgery rejection.

Per-request cost: `middleware/auth.ts:136` calls the RPC, which does `SELECT * FROM public.sessions WHERE token = p_token FOR UPDATE` (`175_fix_session_rpc_search_path.sql:58-62`) and then an **unconditional** `UPDATE public.sessions SET … last_active = v_now` (`:119-124`) — the UPDATE sits outside the rotation `IF`. Then a second query against `users_custom` (`auth.ts:138-142`). **Every authenticated merchant request is 2 Supabase REST round-trips + 1 exclusive row lock + 1 row write.**

## B.3 Session refresh / rotation — dead code

`validate_and_rotate_merchant_session` implements rotation (`175:95-117`), reuse detection and revoke-on-reuse (`:37-56`), backed by `session_token_rotation_events` with `UNIQUE(old_token_hash)` (`161_foundation_session_security.sql:21-33`). **Both and only both TypeScript callers pass `{ rotate: false }`** — `middleware/auth.ts:136` and `routes/auth.ts:387` — so `MERCHANT_SESSION_ROTATION_INTERVAL_SECONDS = 10*60` is never reached and the `rotated_session_token` handling in `apps/identity-platform/src/app/api/auth/session/route.ts:25-28` is unreachable.

**Corrected verdict: S2, not S1.** The adversarial pass established that (a) only `routes/auth.ts:387` is the actual defect — `middleware/auth.ts` has no channel to return a new cookie, so `rotate:false` there is *required*; (b) enabling rotation is not a one-line fix, because three of four consumers of `GET /auth/custom/session` discard `rotated_session_token`; and (c) the RPC's rotation mints `encode(gen_random_bytes(32),'hex')` **inside Postgres** (`175:98`), which would displace the identity-issued ES256 token required in production — so flipping the flag would silently demote the merchant realm to database-issued opaque tokens after 10 minutes, and `identity-sole-issuer-validator.mjs` does not scan `.sql`. Live compensating controls verified: the 8h idle timeout does fire, revocation works and is checked on every request, the cookie is httpOnly and HMAC-re-wrapped in transit, and refund/payout are step-up gated.

## B.4 Revocation

`logout/route.ts:38-44` (no CSRF, documented) → gateway `/sessions/destroy` → `UPDATE sessions SET revoked_at, revoked_reason='logout'`. Logout-everywhere at `auth.ts:1203`. The RPC checks `revoked_at` on every validation (`175:69-72`), so revocation is genuinely enforced per request. **Session tokens are stored in cleartext** (`sessions.token` holds the raw bearer including the full ES256 JWT), matched raw at `175:61`, with a partial index on the raw token — while the sibling rotation-events table correctly stores only SHA-256 hashes (`175:111-112`), proving the hashed pattern is understood.

## B.5 Store switch — `POST /api/auth/switch`

`apps/identity-platform/src/app/api/auth/switch/route.ts`: `:35-41` rate limit → `:44-46` CSRF → `:56-63` a **valid current session**, else 401 → `:69-81` the target email must appear in the signed httpOnly `lb_accounts` cookie, else 403 → `:84` `destroySession` → `:87` by-email → `:102-104` `email_verified` check → `:110` `createSession`.

**The fix is present and correctly ordered. Its entire test suite is `readFileSync` + `indexOf`/`assert.match` on the route source text** (`apps/identity-platform/src/__tests__/auth-switch-guard.test.ts:41-67`), whose own doc-comment concedes at `:20-22` that the 401/403/200 contract test is unwritten. A repo-wide grep for `await POST(` across `tests/`, `apps/`, `packages/` returns **zero results** — no test anywhere in this repository invokes a Next route handler.

**Corrected verdict: S2, not S1.** The adversarial pass established that a coarse signal *does* exist (the text test runs in CI via `ci.yml:126` and a wholesale revert fails it), that the current decrypt path fails **closed** (`decryptAccounts` returns `[]` on error ⇒ `[].some(...)` ⇒ 403), and — going the other way — that **both nominal governance controls for this path are dead code**: `scripts/governance/identity-security-gate.mjs` and `scripts/validators/frozen-path-override-gate.mjs` are referenced by no `package.json`, no `turbo.json`, no workflow and no `validate-governance.mjs`; there is no `.husky/` directory. The precise residual gap is that a **logic-preserving-text** subversion escapes.

Two ordering defects survive: `destroySession` runs *before* the target is validated, so a failed switch strands the caller logged out (`:84` → `:102-104` with no cookie clear); and the `lb_accounts` cookie is **signed, not encrypted** (`cookies.ts:176-180` — `SignJWT` HS256, base64url payload), carries up to 10 `{email,name,avatar,lastLogin}` entries for **90 days** across `.letbuyy.com`, and doubles as the authorization credential.

## B.6 Buyer / customer session

Minted as a hand-rolled **HS256** JWT (`packages/auth-core/src/customer-session.ts:28-59`, alg at `:52`) — signing key and verification key are the same value. Two runtimes mint on live, mounted paths: the gateway (`routes/storefront/customer-registration.ts:141`; `customer-engagement-routes.ts:610,770`, mount chain `index.ts:752` → `storefront.ts:1312` → `public-routes.ts:1227`) and `apps/storefront-runtime` (`src/lib/session.ts:34,56`, called from `app/api/customer/{login,register,set-password}/route.ts`). Verification is a pure in-Worker HMAC with **zero DB reads** (`middleware/customer-session.ts:56-68`) — the cheapest verification path in the system, and there is no revocation store. Store scope is cross-checked and fails closed at `customer-engagement-routes.ts:111-119`.

**Corrected verdict: severity S1 holds; the *breadth* claim was overstated.** The claim that the secret is "injected into all five Vercel Next apps" is **not established**: `production-deploy.yml:443-444` runs `vercel deploy --prod` with no `--prebuilt` and no `-e`/`-b` flag, and there is no `vercel env add` anywhere — so that step materialises the value into five GitHub Actions **runner** environments, not five app runtimes. Two holders are proven (api-gateway via `wrangler secret put` at `:317`; storefront-runtime, which throws without it). Distribution to the other four is `INFERRED`/`UNKNOWN` from a permissive class-wide config list. The evidence state was *raised* to `VERIFIED-SOURCE` for the dual-issuer violation itself, which is the load-bearing half.

## B.7 Operator authentication

`apps/platform-console/src/lib/console-auth-server.ts:35-46` — a `PLATFORM_CONSOLE_ALLOWED_EMAILS` env allowlist, plus per-principal TOTP (`:70-81`, HMAC-SHA1 HOTP at `:157-171`), plus an 8-hour stateless session (`packages/auth-core/src/index.ts:962`). **This is the only realm that writes an audit trail** (`:208-238` → `/internal/console/audit-logs`). The console magic link is a stateless HMAC payload with a 15-minute expiry (`auth-core:997-1008`); `readConsoleMagicLinkToken` verifies signature and expiry only (`callback/route.ts:60-63`) with **no single-use store**, so the same link is redeemable repeatedly for its full lifetime — in the highest-privilege realm on the platform.

## B.8 The claim → tenant-GUC bridge — the S0 that survived

The mechanism is correct in isolation. `withTenantTx` (`services/api-gateway/src/lib/tenant-transaction.ts:15-35`) acquires a pooled SQL connection, runs `SET LOCAL ROLE app_tenant` (`:29`), then `SELECT set_config('app.site_id', $2, true)` where the value passes `assertTenantSiteId` UUID validation (`packages/tenant-core/src/index.ts:586-598`), and **throws rather than faking the transaction over REST**. `public.current_site_id()` = `NULLIF(current_setting('app.site_id', true),'')::uuid` (`139_executable_foundation_ledger_core.sql:8-14`). `app_tenant` is `CREATE ROLE … NOLOGIN NOBYPASSRLS` (`164_d4_tenant_role_guc.sql:11`).

**It has zero callers.** I ran the search myself:

```
rg -n "withResolvedTenantTx|withTenantTx" -g '*.ts' -g '*.tsx' -g '*.mjs'
  services/api-gateway/src/lib/tenant-context.ts:16     (import)
  services/api-gateway/src/lib/tenant-context.ts:67     (definition)
  services/api-gateway/src/lib/tenant-context.ts:72     (call to withTenantTx)
  services/api-gateway/src/lib/tenant-transaction.ts:15 (definition)
  services/api-gateway/src/__tests__/tenant-load-bearing-d4.test.ts:42  (assert.match on source text)
```

Meanwhile **114 non-test files under `services/api-gateway/src` use `getSupabaseAdmin`** (re-counted), which returns `createTenantGuardedSupabaseClient(createSupabaseServiceClient(env))` — I read the factory: its doc-comment at `services/api-gateway/src/lib/supabase.ts:11` says verbatim *"service role — bypasses RLS"*.

**Verdict: CONFIRMED at S0 / `VERIFIED-SOURCE`** (governance-drift) and **CONFIRMED at S1** (flow-identity, where the adversarial pass held severity because two application-side compensating controls still stand). This is the only claim in the entire study that the adversarial pass left at S0.

Tenant isolation at runtime therefore rests on exactly two application-layer controls:

1. **`verifySiteOwnership`** (`services/api-gateway/src/lib/auth-user.ts:58-85`) — itself a `service_role` SELECT on `sites`. Not all 114 files call it; several public/platform routes perform no ownership check at all.
2. **The `createTenantGuardedSupabaseClient` proxy** (`services/api-gateway/src/tenant/tenant-scoped.ts:52-77`) — which asserts only that a tenant **column name** appears in a predicate, never that its **value** matches the session (`:56-58`: `if (typeof args[0] === 'string' && columns.includes(args[0])) state.scoped = true`).

The proxy is further incomplete: it wraps only `.from()`, so **77 `.rpc(` calls bypass it entirely**; three sites construct an unguarded service client directly (`middleware/auth.ts:133`, `routes/auth.ts:1342`, `routes/employee.ts:235`); and the registry covers 265 tables against ~414 in the schema.

The repository states the consequence itself: `database/supabase/migrations/196_theme_rls_tenant_hardening.sql:30-36` records, as an empirically verified fact on a local database, that `postgres` and `service_role` carry `BYPASSRLS`, which "takes precedence over FORCE", concluding that the gateway is "therefore unaffected" — i.e. **migration 164's FORCE-RLS and `app_tenant` policies are inert for gateway traffic by the repo's own later admission.**

The governing validator cannot see any of this: `scripts/validators/no-blanket-service-role-validator.mjs:16-21` substring-checks that `tenant-transaction.ts` *contains* the string `SET LOCAL ROLE app_tenant`, and `:33` restricts its offender scan to `entry.path.startsWith('apps/')` — `services/` and `packages/` are never scanned.

## B.9 Subdomain resolution

`apps/storefront-runtime/src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`; there is no `middleware.ts`):

`:305` `normalizeRequestHost(x-forwarded-host || host)` → `:317` Vercel-deployment-host bypass → `:321` `resolveStorefrontHost(host, root)` classifies into subdomain / custom_domain / root / reserved / invalid (`packages/tenant-core/src/index.ts:119-137`) → `:346` `resolveAccess` → `GET {gateway}/v1/internal/store-access/resolve?host=` with **`cache: 'no-store'` and a 3s abort** (`proxy.ts:110-122`) → gateway `routes/internal-store-access.ts:30-57` → `middleware/store-context.ts:209-254`, **1 `sites` SELECT** → gates (`:391-402`: preview_only/unpublished → 401 holding page; offline → 503; password → 401 unless gate cookie) → `:213-225` `NextResponse.rewrite` to `/store/<subdomain>/…`.

**This lookup is cached nowhere** — no KV, no Cache API, no in-process memo. It is one extra gateway round-trip plus 1 Postgres query on **100% of storefront traffic**, and any gateway error, timeout or missing `INTERNAL_API_SECRET` turns every storefront on the platform into a 503 holding page (`proxy.ts:347-354`).

## B.10 Custom domain resolution and provisioning

**Resolution** (`store-context.ts:209-254`): q1 `sites WHERE custom_domain=$1 AND custom_domain_status='active'`; on miss q2 `site_domains WHERE domain=$1 AND status='active'`; on hit q3 `sites WHERE id=site_id`. **3 DB queries per request** for a custom-domain host, uncached.

**Provisioning** (`services/api-gateway/src/routes/custom-domains.ts:150-258`): rejects localhost / IPv4 / public-suffix / LetBuyy-owned zones / reserved labels, screens for abuse, writes `sites.custom_domain` + `custom_domain_status='pending'` + a 24-byte hex token, upserts a `site_domains` row, returns TXT / CNAME / apex-ALIAS records.

**Verification** (`:260-350`): a DoH TXT challenge on `_letbuyy-challenge.<domain>` requiring **at least 2 matching answers**, then a CNAME match, then `attachVercelProjectDomain` (`POST /v10/projects/{id}/domains`) and `readVercelDomainStatus` (`services/api-gateway/src/lib/vercel-domains.ts:124-194`). **TLS is Vercel-issued, not Cloudflare for SaaS.** `apps/storefront-runtime/vercel.json` pins `regions: ["bom1"]` — one India region, conformant. Gated on `VERCEL_API_TOKEN` + `VERCEL_STOREFRONT_PROJECT_ID`, which are in no `wrangler.toml` var block; the route 503s without them.

## B.11 PLP / PDP render — on hit and on miss

Three cache tiers exist in source. **Only one works.**

| Tier | Mechanism | State |
|---|---|---|
| **L0 — Next Full Route Cache / ISR** | `export const revalidate = 60/30` across the `/store/[subdomain]` subtree | **Structurally dead.** `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:76` unconditionally `await resolveThemePreviewToken(subdomain)`, which calls `cookies()` (`lib/theme-preview-server.ts:12`), forcing the entire subtree dynamic. `next.config.ts` has **no `experimental` block**, and Next 16.1.6 defaults `cacheComponents: false`, so PPR is off. |
| **L1 — Next fetch Data Cache** | `storefrontReadInit(revalidate, tags)` at 19 call sites | **Present, 0% hit rate.** `apps/storefront-runtime/src/lib/api/client.ts:45` stamps a fresh `X-Request-ID: crypto.randomUUID()` on every server-side gateway fetch, and Next 16.1.6 hashes all init headers except `traceparent`/`tracestate` into **both** the Data Cache key and the request-memoisation key. Every read writes an entry under a key that can never be read again, and duplicate fetches in one render are not deduplicated. |
| **L2 — Cloudflare Worker Cache API** | `caches.default` via `cachedJson` (`services/api-gateway/src/lib/storefront-cache.ts:107-130`), 13 namespaces, TTL 60s | **Real and tenant-safe.** Keys are `storefront-rest:<ns>:<version>:<handle>[:<id>][:<params>]` with **every part `encodeURIComponent`'d before joining on `:`** (`:63-68`), so no part can inject a separator; `<handle>` is the unique `sites.subdomain`. **Cross-tenant key collision is structurally impossible** and no cached namespace is personalised. |
| **L3 — KV** | `storefront-cache-version:<handle>`, one GET per cacheable route call | Version register only, not a payload cache. Written with **no `expirationTtl`** (`:89`); a read error silently returns `'0'` (`:75-80`) — the generation *before* the store's first invalidation, so a KV blip serves the **oldest** cached generation rather than bypassing. |

**Measured cost of one product-detail render (cold gateway cache):** 18 gateway HTTP calls, ~35 DB round-trips, 15 KV reads. **Warm** (all 13 namespaces HIT): still 18 gateway calls, still 15 KV reads, still 3 DB round-trips (`resolve` + `status` + `reviews` are uncacheable). The dominant payload drivers are (a) the bootstrap payload emitting `release_config` **and** `template_snapshot` as the identical object twice (`packages/tenant-core/src/index.ts:510-512`) fetched 3× per render, and (b) `layout.tsx:99-112` fetching **100 full product rows** (`PRODUCT_SELECT_FULL` — description, images, tags, variants, seo) plus a `product_variants` join on **every** route under `/store/[subdomain]`, including cart, account and checkout, purely to seed header search.

**Corrected verdicts (all three OVERSTATED → S2/S3):** the `X-Request-ID` defect is S2 (cost/latency only, graceful degradation; and the "governed 3-tier cache" cited from the Constitution is a *Worker KV* cache that does not exist in this app — zero KV usage in `apps/storefront-runtime/src` — so no constitutional invariant is breached). The dynamic-rendering finding is S2 (`next.config.ts:124-126` sets `Cache-Control: public, max-age=300, stale-while-revalidate=3600` on `/:path*`, and Next 16 **preserves** a user-set Cache-Control — `send-payload.js:58-62` — so whether an edge HTML cache exists is provider behaviour, `UNKNOWN`). Missing stampede protection is S3 (KV version propagation is eventually consistent so invalidation is staggered per colo, and the pooled SQL client caps at `max: 5` per isolate so excess concurrency queues in-client).

> **One risk the adversarial pass raised that the original finding did not:** if that `public, max-age=300` directive *is* honoured by a shared cache, then per-request HTML that varies on the theme-preview cookie is marked publicly cacheable for 300s **with no `Vary: Cookie`** — which would let a shared cache serve a merchant's draft theme render to the public. Separately, the Liquid path resolves the customer server-side (`composition-engine.tsx:571`), making `/account`, `/account/orders` genuinely per-user HTML under the same blanket `public` header. `next.config.ts:122-129` has no exclusion for account, orders, cart or checkout.

## B.12 Cache invalidation on mutation

`bumpStorefrontCacheVersion` and `purgeStorefrontCache` have **exactly one call site between them**: `purgeThemeStorefrontCache` in `services/api-gateway/src/routes/themes.ts:140-158`, reached only from theme publish (`:642`) and rollback (`:697`). Products, collections, categories, navigation, pages, policies, blog and custom-domain mutations bump nothing and rely purely on the 60s TTL. The per-key purge at `:157` targets the literal version `'0'`, so **once any bump has occurred it deletes a key that no longer exists** — and `cache.delete` is colo-local anyway.

`revalidateTag` is called **zero times** across `apps/`, `services/` and `packages/`, so the ~20 declared `storefront:*` tags are decorative. This is currently masked by L1 never hitting; fixing the `X-Request-ID` defect without adding invalidation would surface up-to-60s staleness.

## B.13 Cart create / mutate

Cart line prices are hydrated **from the `products` table, never from the client** (`services/api-gateway/src/routes/storefront/cart-routes.ts:262-276`). Read is 2 queries (`loadPublishedStore` + `loadCartByToken` at `:198`); mutation is 3 reads + ≥1 write (`:404-424`), plus an outbox upsert on create, plus 3 more if `buyer_email` is present — **up to 4 reads and 5 writes across 5 separate transactions.**

## B.14 Checkout session and the ART-14 signed handoff — *own reading*

**The signing and verification code is correct.** `cart-routes.ts:547-566` signs `HMAC-SHA256(secret, {site, cart, token, channel, expires_at, cart_content_digest})`, where the digest is SHA-256 over line items sorted by `product_id`/`variant_id`/`quantity` including `unit_price_minor` and `line_total_minor`, plus de-duplicated uppercased sorted coupon codes (`packages/checkout-core/src/index.ts:510-547`). Expiry is 10 minutes (`cart-routes.ts:546`) and is enforced (`checkout.ts:236-239`). **`checkout.ts:263-288` re-computes the digest from the current DB cart and compares timing-safe (`:286`)** — so a mutated cart genuinely invalidates the handoff and there is no replay of stale contents. I confirmed the timing-safe compare at `checkout.ts:286` directly.

**Three defects.** (1) `ART-14` specifies the HMAC binds line items **plus coupons plus subtotal**; there is no explicit `subtotal` term, only per-line totals (low forgery risk — the subtotal is implied — but a literal deviation). (2) The signed URL is a reusable bearer capability in the address bar for 10 minutes with no nonce or single-use marker. (3) **The signing key falls back to `AUTH_SECRET`.** I read this myself:

```ts
// services/api-gateway/src/routes/checkout.ts:87-92
function checkoutSigningSecret(c: AppContext): string | null {
    const configured = c.env.CHECKOUT_SIGNING_SECRET || c.env.AUTH_SECRET || c.env.STORE_ACCESS_SIGNING_KEY;
    if (configured && !configured.startsWith('SKIP_NEEDS_HUMAN_')) return configured;
    if (c.env.ENVIRONMENT === 'production' || c.env.APP_ENV === 'production') return null;
    return 'letbuyy-local-sandbox-checkout-handoff-secret';
}
```

Duplicated verbatim at `cart-routes.ts:306-311`. In **staging** (`ENVIRONMENT="staging"`) the fallback chain resolves to `AUTH_SECRET`, and `staging-deploy.yml:83` sets `AUTH_SECRET` while setting no `CHECKOUT_SIGNING_SECRET` — so in staging **the checkout-handoff HMAC key and the `lb_accounts` cookie key are literally the same value.** In production `production-deploy.yml:320` deploys `CHECKOUT_SIGNING_SECRET`, so the fallback is not reached *assuming that GitHub secret is populated* — which is `UNKNOWN` from the repository. Below production, absent everything, it returns a **hardcoded literal published in this repository**.

**The `AUTH_SECRET` blast radius, corrected.** Five `|| AUTH_SECRET` fallbacks exist (`checkout.ts:88`, `cart-routes.ts:307`, `media.ts:60`, `export.ts:174`, `webhook-service/src/index.ts:584`) plus a direct use at `internal-console.ts:441`. **The adversarial pass refuted four of the five named forgery consequences:** the webhook fallback is unreachable dead code (that Worker is given only `INTERNAL_API_SECRET`); the export fallback is never selected (`INTERNAL_API_SECRET` is deployed in both environments); the media ticket **is** signed with `AUTH_SECRET` in production but is **never verified anywhere** (the `/upload` router authorises by session + site ownership); and the `lb_imp_` impersonation token has no verifier in the repo. Even a forged handoff cannot tamper with amounts, because `checkout.ts:249-270` recomputes the cart digest from the DB row. **What survives intact and serious:** one symmetric `AUTH_SECRET` value is deployed to six trust domains (`production-deploy.yml:315,443`), it is the HS256 key for `lb_accounts`, and `lb_accounts` membership is guard 2-of-2 on `/switch` where guard 1 is only "you hold some valid session" — so `AUTH_SECRET` disclosure from **any** of six runtimes, including `marketing-site` which has no identity role whatsoever, mechanically restores the ART-06 account takeover. **Corrected severity S2 / `VERIFIED-CONFIG`.** No validator covers any of the six sites: `scripts/validators/session-security-validator.mjs` is a hand-listed file allowlist (`:28,42,53,57,65,75`) that includes none of them.

## B.15 Inventory reserve / extend / expire / commit / release

| Stage | Implementation | Status |
|---|---|---|
| **reserve** | `reserve_inventory(…, 1200s TTL)` at `166_d6_checkout_handoff_inventory.sql:134` | exists |
| **extend** | — | **no extend/renew RPC exists at all** |
| **commit** | `commit_inventory_reservation` at `166:221` — **in the SAME transaction as the reserve** | collapsed |
| **expire** | `expire_inventory_reservations` (`141:304-327`), `FOR UPDATE SKIP LOCKED`, limit clamp 1..1000 | exists |
| **release** | `release_inventory_reservation` (`141:277`) | exists |
| **sweeper** | `services/queue-workers/src/inventory-reservations.ts:26` ← `index.ts:634` ← `scheduled()`; cron `17 */6 * * *`; limit 250 ⇒ **≤1,000 expirations/day** | wired, but **6-hour cadence against a 20-minute TTL** |

Because reserve and commit are one transaction, **stock is hard-decremented at order creation, before payment, for prepaid orders.** `checkout_sessions.inventory_reservation_ids` (column added at `146:18`) is read at `checkout.ts:393` and **written by zero code paths**, so the confirm-time reservation revalidation at `checkout.ts:394-403` is unreachable dead code. Consequence: every abandoned prepaid checkout permanently removes stock until an operator cancels the order — the sweeper cannot help, because the reservation is already `committed`, not `active`.

Concurrency is **pessimistic, with no optimistic version check on the order path** (`inventory_levels.version` exists with an increment trigger at `141:48-51` but is never compared). Locks held to COMMIT: `products` `FOR UPDATE` per SKU (`166:87` — the widest, held across the full 30-40 statement transaction), `inventory_levels` per (store,product,variant,location) (`141:121`), `inventory_reservations` (`141:197`), `orders` (`170:181`), `gift_card_accounts` (`170:209`). Additional single-row serialisation hotspots: `UPDATE promotion_codes SET usage_count = usage_count + 1` (`170:419`) and `UPDATE coupons SET usage_count` (`170:424`) — one row per coupon serialises **every** concurrent checkout using that code.

This lifecycle has one of only two real contention proofs in the repository: `tests/executable/inventory-postgres.test.mjs:189,203` asserts oversell prevention under `Promise.allSettled` contention against a live Postgres container. `VERIFIED-TEST`.

## B.16 COD order and confirmation

`create_checkout_order` sets `orders.status='confirmed'` immediately for COD (`166:199`) with **stock committed** (`166:221`) and `payment_transactions.status='pending'`. COD confirmation is a customer/merchant flag only (`order-risk.ts:315-360`) and posts no ledger entry. **Ledger posting happens only at remittance reconciliation** (`165_d5_canonical_money_paths.sql:354` — `cod_receivable` debit / `merchant_payable` credit).

The public route that creates these has **no bot gate**: `POST /v1/storefront/:subdomain/orders` sits behind only the global query-cost bucket (`index.ts:684`, 20 points/s refill, 200 capacity) and is not in the skip list. Turnstile is wired only for customer registration (`storefront/customer-registration.ts:48`) and engagement routes. There is no COD risk gate *before* order creation — `order-risk.ts` operates only on orders that already exist.

## B.17 Prepaid: create → verify → capture → webhook — *own reading*

**Two order-create paths exist and only one is governed.** I verified the mount order directly:

```
services/api-gateway/src/index.ts:752   api.route('/storefront', storefrontRouter);   ← THE LIVE PATH
services/api-gateway/src/index.ts:753   api.route('/checkout',   checkoutRouter);     ← the ART-14 hosted path
…
services/api-gateway/src/index.ts:779   api.use('/*', authMiddleware);
```

`router.post('/:subdomain/orders', validate('json', StorefrontCreateOrderSchema), …)` is registered at `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:251` (verified verbatim) and reaches `create_checkout_order` at `:395`. It is **mounted 27 lines before the auth middleware**, requires **no signed handoff, no customer session and no Turnstile**, and is the path the shipped UI uses (`apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx:414` → `src/app/api/orders/route.ts:48`). **`ART-14` / `R-11` are not enforced on the live order-create path.** *(Single-pass finding, no adversarial verdict; mechanism independently re-derived here.)*

**Razorpay verify** (`checkout-payment-routes.ts:639`): HMAC over `order_id|payment_id` (`packages/infrastructure/razorpay-adapter/index.ts:347-348`, timing-safe at `:223`), then `assertProviderPaymentNotReplayed` (`:628`, which I confirmed is imported at `:24` and called at `:628`), then `confirmPayment` (`:664`). **It never calls `fetchRazorpayPayment`** — the adapter's own doc-comment at `razorpay-adapter/index.ts:129-134` states the HMAC proves neither that money was taken nor how much, and instructs callers to fetch the payment before granting value. The LetBuyy **SaaS billing** route does follow that instruction (`routes/payments.ts:970-985`, checking `status === captured` and amount ≥ expected). The shopper money path is therefore held to a *lower* standard than the platform's own subscription billing.

**Hosted checkout confirm** — `POST /v1/checkout/:cartId/confirm` (`checkout.ts:638-699`). I read the handler. It requires only that `provider_payment_id` be a non-empty 1-200 char string; a grep of `services/api-gateway/src/routes/checkout.ts` for `assertProviderPaymentNotReplayed`, `verifyRazorpay*` or `fetchRazorpayPayment` returns **nothing** — the only `signature` handling in the file is the *handoff* HMAC at `:229-286`. It then calls `PaymentExecutionAdapter.confirmPayment` → `confirm_order_payment_with_ledger`, which sets `orders.payment_status='paid'`, `payment_transactions.status='captured'`, writes `payment_webhook_events` with **`signature_valid = TRUE`** (`000_baseline.sql:1479-1508`), and posts a **balanced canonical ledger transaction crediting `merchant_payable`** (`168_b1_b2_capture_refund_ledgering.sql:238`) — for money that was never received. The route only records whether a ledger row appeared (`checkout.ts:713`); it never asserts on it. *(Single-pass finding; mechanism independently re-derived here. The route is publicly mounted at `index.ts:753`, and reachability in production depends on whether `CHECKOUT_SIGNING_SECRET` is populated — `UNKNOWN`.)*

**Webhook ingest is the one correct hop.** `services/webhook-service/src/index.ts:718-736` computes the HMAC twice (explicit verifier + adapter verifier), both timing-safe, and rejects on either failure. **Only then** does it upsert `payment_webhook_events` on `(provider, provider_event_id)` (`:766`) and return early on duplicate (`:774`) **before any order or ledger mutation**. `SEC-R5`/`PAY-R8` ordering is satisfied. Age is observed and logged but deliberately not used to reject (`:752-758`), and `webhook_subscriptions.replay_window_seconds` (declared with a 60-86400 CHECK at `148:56`) is **never read anywhere** — it appears only in SELECT column lists.

## B.18 Refund, reversal, and step-up

**Step-up is real cryptography, not a forgeable check.** I read `services/api-gateway/src/lib/security-controls.ts:193-215`: it recomputes `hmacSha256(signingSecret, "<header>.<payload>")` and compares with `constantTimeEqual`, binding `action`, `actor_id`, `site_id` and `verified_at`, then enforces a 10-minute window plus a 60s future-skew bound and an explicit `exp`. It is backed by a TOTP-verified challenge persisted with the token hash and `jti` (`routes/security.ts:186-215`). Gates refunds (`routes/payments.ts:497`) and payouts (`routes/payouts.ts:576`).

**Its one defect:** verification performs **no database lookup** — the `step_up_challenges` row and its `jti` are never marked consumed, and neither `payments.ts:497` nor `payouts.ts:576` records the `jti` against the refund. The same token authorises unlimited refunds and payout releases for that actor and site for 10 minutes. It is also accepted from `body.metadata.step_up_token` (`payments.ts:501`), so it can land in request-body logs.

**Refund path.** `complete_order_refund` (`168:311`) locks refund and order `FOR UPDATE`, rejects cumulative refunds exceeding the order total (`168:365`), and posts a balanced ledger transaction debiting `merchant_payable` / crediting `refund_clearing` (`168:401`). The merchant route calls the provider **first** and returns 502 with **no ledger entry** if the provider refund fails (`payments.ts:551-558`) — correct ordering.

**The gift-card restore is outside the refund transaction.** `restore_gift_card_on_refund` (migration 174) is invoked only from the order status-transition route inside a try/catch that merely warns (`routes/orders.ts:1200-1211`) and from the COD cancel path (`order-risk.ts:305-311`) — **never inside `complete_order_refund`**, which migration `174:13` explicitly leaves untouched because it is validator-pinned. A refund executed through `complete_order_refund` or `POST /payments/:id/refund` therefore never restores the gift-card balance. Partial refunds of gift-card orders are explicitly not handled (`174:15-16`).

## B.19 Ledger posting and reconciliation

**This is the strongest surface in the money domain.** `ledger_accounts.account_code` CHECK enumerates exactly eight codes — `pa_clearing`, `merchant_payable`, `platform_revenue`, `gst_payable`, `cod_receivable`, `reserve`, `vendor_payable`, `refund_clearing` (`139:79-88`). `ledger_transactions.writer_module` is `NOT NULL DEFAULT 'settlement' CHECK (writer_module = 'settlement')` (`139:113`). Append-only is enforced **both ways**: BEFORE UPDATE and BEFORE DELETE reject triggers on both tables (`139:358-376`) **AND** `REVOKE UPDATE, DELETE … FROM PUBLIC, anon, authenticated, service_role, app_tenant` (`165:463-464`). `ledger_entries.amount_minor` is `bigint CHECK > 0` (`139:132`); FKs are `ON DELETE RESTRICT`; a `DEFERRABLE INITIALLY DEFERRED` constraint trigger enforces debit = credit per transaction (`139:378-382`); balance is **derived** by `public.ledger_account_balance_minor` (`160:173`), never stored.

**One SQL writer:** `post_ledger_transaction` (`139:223`), reachable only through `post_settlement_ledger_transaction` (`165:214`). SQL callers: `confirm_order_payment_with_ledger` (`168:238`), `complete_order_refund` (`168:401`), `record_order_payment_failure_with_ledger` (`168:663`), `reconcile_cod_remittance_with_ledger` (`165:354`), `backfill_wallet_ledger_to_canonical` (`160:318`). **Four TypeScript call sites can author arbitrary balanced line-sets:** `lib/payment-route-support.ts:185` (used by `payments.ts:294` capture and `:563` refund), `routes/payouts.ts:195`, `routes/commission.ts:148`, `routes/settlements.ts:175`. **No writer ever sets `writer_module`**, so the CHECK pins only the column default and provides no attribution.

**Reconciliation records mismatches without auto-plugging** — `refresh_money_ledger_site_reconciliation` (`160:198`) computes `variance_minor` and upserts `verified` or `mismatch`, leaving `verified_at` NULL on mismatch (`160:238-243`), writing **no compensating entry**. `assert_money_ledger_site_reconciliation` (`160:260`) raises on non-zero variance. Scheduled at `services/queue-workers/src/index.ts:650` on the 6-hourly cron.

**But it reconciles against the wrong thing.** The comparison is ledger `merchant_payable` against `wallet_ledger_entries` — a compatibility table the same RPCs write **in the same transaction** (`165:405+`). That detects code-path divergence, not money divergence. **Nothing compares the ledger against Razorpay settlement files**, so a fabricated capture (§B.17) reconciles cleanly. There is **no suspense account** in the `ledger_accounts` CHECK.

Mismatches are counted, then logged at level `info` with `status: 'completed'` (`services/queue-workers/src/money-ledger-reconciliation.ts:102`), every 6 hours, **with no alert** — because incident paging is hardcoded dry-run (`services/queue-workers/src/incident-command.ts:94-127` sets `mode: 'dry_run'` unconditionally and only writes DB rows; no PagerDuty/Opsgenie/Slack/webhook call exists anywhere in the repository). *Both of those observability findings were originally rated S0 and were corrected to S1 by the adversarial pass.*

This flow carries the repository's other real contention proof: `tests/executable/money-ledger-postgres.test.mjs` runs 64 postings, asserts `ledger_balance_breaks() = 0`, asserts the append-only triggers throw, and collapses 12-way concurrent idempotent writes to one transaction. **The claim that this proves nothing because `post_ledger_transaction` has no production caller was REFUTED and downgraded to S3** — the RPC is the sole writer reached through `post_settlement_ledger_transaction`, which the production RPCs call.

## B.20 Outbox → queue → worker → DLQ

**Two outbox write paths, and only one is constitutional.**

*Path A (SQL, compliant).* Every money/order RPC inserts its `outbox_events` row **inside the same `SECURITY DEFINER` body** as the domain mutation: `create_checkout_order` → `checkout.completed` (current definition `170_v1_shipping_rates_gst.sql:550`, emitting at `:568`), `confirm_order_payment` → `payment.confirmed` (`000_baseline.sql:1531`), `complete_order_refund` (`:1168`), `create_order_with_inventory_reservations` → `order.created` (`166:276`), `complete_refund_with_ledger` → `refund.succeeded` (`168:519`). Genuinely one transaction. `ART-19`/`ARCH-R8` satisfied for the ledger-bearing events.

*Path B (TypeScript, non-atomic).* `EventExecutionAdapter.emitDomainEvent` (`services/api-gateway/src/execution/event-execution.adapter.ts:60-77`) issues a standalone PostgREST `.from('outbox_events').upsert()` **after** the caller's RPC has already committed, at **38 non-test call sites across 28 files**.

**Corrected verdict: S1, not S0.** The adversarial pass established: (a) the events at risk are the notification/webhook/analytics/search tier, not the ledger-bearing ones; (b) the swallow is narrow — only a PostgREST schema-cache miss returns null (`:79-85`); every other error throws, and on the storefront money path that throw produces a 500 **after** the order committed, which is loud rather than silent; (c) `writeWithOutbox` (`packages/event-core/src/index.ts:1120-1166`) is **not** a same-transaction helper — it performs the same two-step non-atomic write with no BEGIN/COMMIT, so it is not a valid remedy; and (d) the item is ARB-accepted and tracked. **One thing the original missed:** `checkout.completed` is emitted by **both** paths with **different idempotency keys** (SQL `'checkout.completed:'||v_order_id` vs TS `checkout.completed:${session.id}:${body.idempotency_key}` at `checkout.ts:739`), producing duplicate outbox rows and double-firing consumers.

**The relay.** I re-read `services/api-gateway/src/index.ts:945-947` — the production cron (`crons = ["*/15 * * * *"]`, `wrangler.toml:236`) calls `outbox.dispatchBatch({ dispatcherId, outboxLimit: 50, webhookLimit: 50 })`, then a webhook-service dispatch at limit 50, then `queue.consumeQueues(workerId, queueNames, 50)`. `claim_outbox_events` hard-caps at `LIMIT LEAST(GREATEST(p_limit,1),100)` (`000_baseline.sql:756`) and no later migration overrides it. **50 × 96 ticks = 4,800 outbox events/day.** Staging has `crons = []` (`wrangler.toml:120`).

**Corrected verdict: S2, not S0.** The adversarial pass established: (a) `POST /operations/outbox/dispatch` (`routes/operations.ts:126-141`) is a second, operator-triggered relay path, so the ceiling *can* be exercised in staging; (b) **order-confirmation emails do not traverse the outbox at all** — `lib/order-confirmation-email.ts:127-130` sends inline to the bound `NOTIFICATION_QUEUE`, so only merchant webhook deliveries and the `platform_queue_jobs` analytics/search fanout are gated by the cron; (c) the `*/15` value is a **beta free-tier throttle**, not an architectural ceiling — the in-file comment records the pre-throttle `*/1` (72,000/day) and the RPC already permits 100/claim (144,000/day). **What genuinely survives: there is no outbox-backlog age metric.** The cron's only lag telemetry reads `replay_operation_schedules` (`index.ts:557-563`), not outbox age, so a backlog would accumulate unmonitored.

**Queue topology (production).** Five queues, all produced by api-gateway and consumed by `services/queue-workers` — **never by a reserved service**, confirming `R-16` leg 1.

| Queue | Batch | Concurrency | Retries | DLQ |
|---|---|---|---|---|
| `letbuyy-events-production` | 50 | 10 | 3 | `letbuyy-dead-letters-production` |
| `letbuyy-analytics-queue-production` | 50 | 10 | 8 | `letbuyy-dead-letters-production` |
| `letbuyy-search-queue-production` | 25 | 10 | 8 | `letbuyy-dead-letters-production` |
| `letbuyy-notifications-queue-production` | 25 | 5 | 6 | `letbuyy-dead-letters-production` |
| `letbuyy-production-queue` | 50 | 10 | 10 | `letbuyy-production-dead-letter-queue` |

**Four correctness defects in the async tier**, all corrected to S2 by the adversarial pass:

- **Batch-level retry re-sends emails.** `dispatchEmailDeliveries` (`services/queue-workers/src/index.ts:482-526`) calls `sendResendEmail` with no already-sent lookup and no Resend idempotency header; it runs at `:598` **before** the ack at `:606`; the outer catch at `:620-621` retries the **entire batch**. *Latent, not live:* `RESEND_API_KEY` is never provisioned to queue-workers by any workflow (`production-deploy.yml:358-362` sets only `INTERNAL_API_SECRET` and `QUEUE_TENANT_ENVELOPE_SECRET`; the Resend put at `:329` targets api-gateway), so `resendConfigured()` is false and the loop logs `missing-resend-secret` and skips. **The adjacent and arguably higher-priority defect: production order-confirmation emails therefore appear to be silently dropped, not duplicated.**
- **15-minute tenant-envelope expiry destroys backlogged messages.** `verifiedTenantSiteId` (`index.ts:172-175`) throws a *deterministic* error for any envelope older than 15 minutes; deterministic errors are not retried — they become `quarantinedDelivery` (`:434-441`), are recorded dead-lettered, and are acked (`:606`). The producer fails **open** (`lib/queue-tenant-envelope.ts:38-40` returns the body unsigned when no secret is configured) while the consumer hard-fails on a missing envelope. Message loss begins precisely when queue residence exceeds 15 minutes.
- **DLQ redrive is a no-op.** `POST /runtime/queues/:queueName/redrive-dead-letters` (`routes/operations.ts:600-619`) flips `distributed_queue_messages` rows to `retrying`. **Nothing ever reads them back** — the four supporting RPCs exist in the schema with zero TypeScript callers, and queue-workers declares no `[[queues.producers]]`, so it cannot re-enqueue either. The endpoint returns `{ redriven_count: N }` while nothing happens. (The *outbox* DLQ is different and does work: `replay_outbox_dead_letter` (`:7220-7261`) resets rows to `queued` and the relay genuinely re-claims them.)
- **No tenant fairness anywhere.** `claim_outbox_events` (`000_baseline.sql:754`), `claim_platform_queue_jobs` (`:822`), `claim_webhook_deliveries` (`:966`) and `expire_inventory_reservations` (`141:323`) all order strictly by `created_at`/`expires_at` ASC with **no `site_id` term and no per-site cap**. A per-tenant quota model exists in the schema — `tenant_execution_quotas` with `max_queued_jobs`, `priority_class`, `noisy_neighbor_protection` (`000_baseline.sql:12506`) — with **zero TypeScript readers**. Fairness was designed into the schema and never wired to any claim path. *Corrected to S2: FIFO with `FOR UPDATE SKIP LOCKED` yields bounded, self-clearing head-of-line delay, not indefinite starvation.*

**Outbound webhook SSRF.** Target validation is `url.protocol === 'https:' && url.hostname.length > 0` and nothing else (`packages/notification-core/src/index.ts:505-512`), applied at registration (`routes/notifications.ts:470`), fanout eligibility (`execution/outbox-execution.adapter.ts:177`) and dispatch (`services/webhook-service/src/app-lifecycle-dispatch.ts:34-41,75`). No DNS check, no deny-list, **no `redirect` option** (default `follow`, so a merchant-controlled 302 escapes the https-only rule) and **no `AbortSignal`/timeout** (`:89-105`). Delivery is a sequential `for…of` with `await` (`webhook-service/src/index.ts:648-658`), so one slow target stalls the entire 50-delivery tick. **Corrected to S2:** the 2,000-char `response_body_preview` is persisted but **no route selects it** and the only delivery-list route is `requireRoleCategory('ops') + requireSuperAdmin` gated — so this is *blind* SSRF, not a read primitive; and the cloud-metadata example does not apply, since the dispatcher is a Cloudflare Worker with no IMDS.

**Provider-mode honesty is violated.** `PUSH_DISPATCH_MODE = "dry-run"` in the production var block (`services/queue-workers/wrangler.toml:257`) with `SKIP_NEEDS_HUMAN_*` FCM/APNS placeholders, and the dispatch loop does `if (result.dryRun) { result.sent += 1; continue; }` (`push-dispatcher.ts:381-384`) — **a dry run increments the same `sent` counter a real delivery would.** Separately, `queue-workers/wrangler.toml` declares **no** `WHATSAPP_PROVIDER_MODE`, so `normalizeMode` falls back to `isProductionRuntime ? 'live' : 'sandbox'` (`whatsapp-commerce-adapter/index.ts:146-147`); with no Twilio credentials `available = false` and every WhatsApp notification is recorded `failed`/`WHATSAPP_UNAVAILABLE` — while api-gateway production pins the same flag to `"sandbox"` (`wrangler.toml:277`). **The two runtimes resolve to opposite modes for the same feature.**

## B.21 Theme resolve → render → sanitize

**Resolution.** `resolveStorefrontTemplate` (`template-resolver.ts:235-308`) → `resolveThemeLiquidRenderingEnabled({templateConfig, defaultEnabled: THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false})`. `packages/theme-engine/src/theme-governance.ts:154-160` returns **`true` unconditionally** when any of `templateConfig.rendererEngine` / `releaseManifest.renderer_engine` / `rendererEngine` / `renderer.engine` equals `'liquid'` — **bypassing the default.** Migration `180_urban_kicks_liquid_theme.sql:37` writes `default_template || jsonb_build_object('rendererEngine','liquid')` onto the urban-kicks theme row, and theme install copies `default_template` into `sites.template_config` (`packages/theme-engine/src/index.ts:738-780`; `theme-execution.adapter.ts:943,1189,1221`). Migration 197 deliberately does **not** set the key for `letbuyy-core`.

**Consequence:** `ART-17`'s "Liquid default OFF / canary" is false for every urban-kicks-derived store, while `letbuyy-core` stores stay React. The engine is decided by a DB jsonb key set by a migration, with no operator surface, no per-store toggle and no rollback path other than another migration. The gateway's `FEATURE_LIQUID` flag (`"false"` in production) is **read by no runtime code** — `index.ts:693-702` constructs gates only for `FEATURE_GRAPHQL` and `FEATURE_EXTENSIONS` — so an operator reading the production wrangler config draws the wrong conclusion entirely.

**Render.** `createLiquidEngine` (`theme-renderer.ts:745-758`): `cache: true`, `dynamicPartials: false`, `strictFilters: true`, `ownPropertyOnly: true`, `outputEscape: 'escape'`, `jsTruthy: false`, `parseLimit 300000`, `renderLimit 5000`, `memoryLimit 2000000`. Drop sandbox: `BLOCKED_DROP_KEYS` covers `__proto__`, `constructor`, `prototype`, `password`, `password_hash`, `access_token`, `refresh_token`, `signing_secret`, `client_secret`, `api_key`, `secret_key`, `private_key`, `webhook_secret` (`:1045`).

**Sanitize.** jsdom + DOMPurify singleton (`theme-renderer.ts:1332-1387`), awaited **per section (`:477`), per block (`:926`), for the whole layout document (`:647`), and per app-block source (`:1227-1228`)**. Config: `USE_PROFILES html`, `FORBID_TAGS ['base','embed','object','script']`, `FORBID_ATTR ['style']`, custom-element `tagNameCheck /^lb-(...)$/`, `allowCustomizedBuiltInElements: false`, and an `uponSanitizeAttribute` hook dropping `javascript:` / `data:text/html` in href/src/url attributes. Upload-time validation additionally rejects `{% include %}`, `{% layout %}`, `{% render %}`, `<script`, `javascript:` and `data:text/html` (`theme-bundle.ts:155-177`).

**The one executable seam** is `ADD_TAGS: ['iframe']` with `src`/`sandbox`, produced by `renderLiquidAppBlockHtml` from `loadPublicStorefrontAppBlocks` — which returns `[]` unless `FEATURE_APP_PLATFORM` is positive (`storefront.ts:920-940`; `appPlatformKillSwitch.ts:25-28`). **That variable is absent from every wrangler env block. No merchant or theme text input reaches an executable path in the current configuration.**

**The performance cost is documented in-file.** `theme-renderer.ts:706-718` records that a trivial section aborted at a 250ms `renderLimit` purely from sibling event-loop contention, that the limit was raised to 5000ms, and that the F9 benchmark shows **sequential rendering is ~5× faster** (42ms vs 227ms for N=25). There is no rendered-fragment cache — `composition-engine.tsx:672` logs `cache_hit: null` with the comment "NOT CONNECTED until per-request render cache is wired". The failure mode under contention is a **silent fallback to the React path with a different DOM** (`composition-engine.tsx:625-634`).

## B.22 Media upload → R2 → delete

Upload key is `${folder}/${auth.user.id}/${Date.now()}-${uuid}.${ext}` (`services/api-gateway/src/routes/upload.ts:168`) — **owner-scoped, not site-scoped**; `store_id` appears only in `customMetadata` (`:196-203`). MIME validation inspects only `file.type`, the client-supplied multipart Content-Type (`lib/upload-mime.ts:70-88`) — **no magic-byte sniffing**, so the SVG hard-block is bypassable by lying about Content-Type. Limits: 10MB standard / 50MB model / 100MB video. Delivery is public via `${ASSET_PUBLIC_BASE_URL}/${key}` = `https://cdn.letbuyy.com/...`, relying on a 122-bit UUID for unguessability. DELETE performs a real `R2_BUCKET.delete(key)` after `head` + `customMetadata.store_id` ownership verification (`:236-271`).

Shipping labels use a **flat** `shipping-labels/${labelId}.pdf` (`routes/shipping-labels.ts:224`); tenancy is enforced *after* the DB row fetch by `resolveTenantContextForOwnedSite(c, row.site_id)` (`:379-384`), not by the key space. **There is no R2 lifecycle or expiry configuration anywhere in the repository**, and no orphan reconciliation. For DPDP erasure, no prefix enumerates one site's media.

## B.23 The mobile-bff composite

`services/mobile-bff` is a single 516-line file (re-counted). `/v1/mobile/dashboard` issues `Promise.all` over **six** gateway requests (verified at `src/index.ts:382-387`): `/v1/analytics/dashboard`, `/analytics/orders`, `/analytics/revenue`, `/analytics/top-products`, `/analytics/traffic-sources`, `/payouts/summary`. Each target independently calls `canAccessStore(db, auth.user, storeId)` — **six authorization queries for one dashboard open** — and none is cached. `/v1/analytics/dashboard` then issues **two `orders` SELECTs with `.eq('store_id',…).gte('created_at', since)` and no `.limit()`**, aggregating revenue in JS (`routes/analytics.ts:568-579`); the rollup projection short-circuits this only when it has data. This is the clearest OOM/latency cliff in the merchant surface as order volume grows.

---

# C. Conformance verdict per constitutional rule

One row per rule R-1…R-23 from `02_GOVERNED_ARCHITECTURE.md` §4. **Where the adversarial pass corrected a severity, this table reflects the correction.**

| Rule | Requirement (one line) | As-built state | Verdict | Evidence (path:line) | State |
|---|---|---|---|---|---|
| **R-1** | RLS `ENABLE`+`FORCE` + per-tx tenant-GUC policy; unset GUC ⇒ zero rows | DDL is real: 423 tables get `ENABLE`; `164:63-64` FORCEs + installs `app_tenant` GUC policies on all 259 `site_id`/`store_id` tables; 112 static FORCEs. **But the GUC is never set at runtime**, so no policy engages on any request; 4 post-164 tables have ENABLE without FORCE | **VIOLATED** | `164_d4_tenant_role_guc.sql:11,63-73`; `169_…rollups.sql:153-156`; `196_theme_rls_tenant_hardening.sql:30-36`; `lib/tenant-context.ts:67` | `VERIFIED-SOURCE` |
| **R-2** | No tenant query under `BYPASSRLS`/blanket `service_role` | 114 non-test gateway files use `getSupabaseAdmin` → `createSupabaseServiceClient`; the factory's own doc-comment says "bypasses RLS". `withResolvedTenantTx` has zero callers | **VIOLATED** (adversarial **CONFIRMED**, S0 governance-drift / S1 flow-identity) | `services/api-gateway/src/lib/supabase.ts:11-15`; `lib/tenant-context.ts:67-73`; `tenant/tenant-scoped.ts:52-77` | `VERIFIED-SOURCE` |
| **R-3** | No `USING(true)` to PUBLIC/anon/authenticated; no anon write to tenant/ownership columns | Replay-order analysis: 680 final-state policies, 110 with `USING(true)`; ~90 correctly `TO service_role`; **~19 remain PUBLIC-effective** (no `TO` clause ⇒ PUBLIC) incl. `auth_password_set_intents`, `gift_cards`, `collections`, `pages`, `audit_logs`; plus 3 explicit anon/authenticated true policies. Migration 163 remediated exactly 12 tables | **VIOLATED** *(single-pass — `data` dimension had no adversarial verdict)* | `078_password_set_intents.sql:41,52`; `000_baseline.sql:26645,26652,26666,26708,24380`; `100_app_discovery_foundation.sql:133,145,152,155`; `163_d2_live_data_leak_rls.sql:1-4,202-216` | `VERIFIED-SOURCE` |
| **R-4** | Tenant GUC set only from a **validated asymmetric claim** | The only claim-derived GUC path (`withTenantTx` + `assertTenantSiteId`) is unused. Where the GUC *is* set, it is self-asserted inside `SECURITY DEFINER` RPCs from their own argument: `IF public.current_site_id() IS NULL THEN PERFORM set_config('app.site_id', p_store_id::text, true)` | **VIOLATED** | `166_d6_checkout_handoff_inventory.sql:63-65`; `141_…reservations.sql:53`; `packages/tenant-core/src/index.ts:586-598` | `VERIFIED-SOURCE` |
| **R-5** | Append-only double-entry, derived balance; every capture/refund/COD/tender posts idempotently | Capture (`168:238`), refund (`168:401`), payment-failure (`168:663`) and COD remittance (`165:354`) all post balanced entries idempotently. **`create_checkout_order` posts zero ledger entries** and, when a gift card covers the whole order, sets `payment_status='paid'` + `status='confirmed'` + `payment_transactions.status='captured'` with **no ledger record** | **PARTIAL** | `170_v1_shipping_rates_gst.sql:299-300,450,472`; `168_…:238,401`; `165_…:354` | `VERIFIED-SOURCE` |
| **R-6** | No mutable balance; no `UPDATE`/`DELETE` of a posted entry; **exactly one** ledger writer | Append-only enforced by trigger **AND** REVOKE; balance derived by function; one SQL writer. **But** 4 TS call sites author arbitrary balanced line-sets, `writer_module` is never set by any writer (the CHECK pins only the default), and 4 compat ledgers retain live TS writers | **PARTIAL** | `139_…:113,223,358-376`; `165_…:214,463-464`; `160_…:173`; `lib/payment-route-support.ts:185`; `routes/{payouts:195,commission:148,settlements:175}` | `VERIFIED-SOURCE` |
| **R-7** | **Never custody**; money moves only via licensed PA-split | `razorpayx` survives **only** as 3 residual CHECK-constraint enum values on app-marketplace tables, all unreachable behind the fail-closed kill switch. No TypeScript emits the value; a ratchet validator bans hardcoding it | **CONFORMS** (residual enum tracked as `SKIP-RAZORPAYX-ENUM-PURGE`) | `000_baseline.sql:8293,8295,10263`; `scripts/validators/no-self-custody-rail-validator.mjs:11,31`; `index.ts:729-743` | `VERIFIED-SOURCE` |
| **R-8** | `bigint` minor units (paise) on every path | Only `ledger_entries.amount_minor` is bigint. `orders.*` is `numeric(12,2)`, `order_items.*` and `payment_transactions.amount` are `numeric(10,2)`, gift-card balances numeric, carts numeric. **~30 `*_minor` columns are 32-bit `integer`** (overflow at ₹2,14,74,836.47) | **VIOLATED** | `109_orders_money_width.sql:3,11-17`; `000_baseline.sql:10022-10042,10131-10135,10311`; `119_mobile_money_ledgers.sql:16-19,107-112`; `140_…:26-29`; `139_…:132` | `VERIFIED-SOURCE` |
| **R-9** | `commission_bps = 0`; no GMV/transaction fee | Migration 162 sets both defaults to 0 and zeroes existing rows; a ratchet validator rejects any non-zero literal, default or `ALTER COLUMN SET DEFAULT`, and positively asserts 162's content. Runtime reads the schedule value, never a hardcoded rate | **CONFORMS** (source-text ratchet, not a DB CHECK) | `162_phase_a_commission_zero.sql:4,7,9-22`; `scripts/validators/commission-bps-zero-validator.mjs` | `VERIFIED-SOURCE` |
| **R-10** | Second factor on refund/payout is **real cryptography**, not a forgeable check | Real HMAC-SHA256 over a versioned payload with constant-time compare, binding action + actor + site + `verified_at`, 10-minute window, backed by a TOTP-verified stored challenge. **Defect (S2, outside R-10's text): the challenge row/`jti` is never consumed**, so the token is replayable within its window, and it is also accepted from `body.metadata` | **CONFORMS** | `lib/security-controls.ts:193-215`; `routes/security.ts:186-215`; `routes/payments.ts:497,501`; `routes/payouts.ts:576` | `VERIFIED-SOURCE` |
| **R-11** | Orders created **only** behind a cart-bound signed handoff; inventory reserve-with-TTL, not pre-payment hard-decrement | **Both legs fail.** The live UI path (`POST /v1/storefront/:subdomain/orders`) is mounted 27 lines before `authMiddleware` with no handoff, no session and no bot gate. Reserve and commit are collapsed into one transaction, so stock is hard-decremented before payment. *(Server-authoritative pricing does hold — no shopper route uses a client total)* | **VIOLATED** | `routes/storefront/checkout-payment-routes.ts:251,395`; `index.ts:752,779`; `166_…:134,221`; `checkout.ts:393-403` | `VERIFIED-SOURCE` *(own reading)* |
| **R-12** | No third-party/extension/Wasm code executes in the live checkout or storefront path | `services/api-gateway/src/extensions/app-functions-runtime.ts` (623 lines, `WebAssembly.compile`/`instantiate`) has **zero importers** in gateway source; order-create hardcodes `extensionFunctions: []`; the extensions route is behind the fail-closed kill switch registered before the feature gate | **CONFORMS** (residual: the module still compiles into the Worker bundle, unmounted only by the absence of an import) | `extensions/app-functions-runtime.ts:585`; `checkout-payment-routes.ts:430`; `index.ts:722`; `middleware/appPlatformKillSwitch.ts:25` | `VERIFIED-SOURCE` |
| **R-13** | No consent-gated message without a consent record; the gate **fails closed** | The DPDP consent gate for WhatsApp blocks on a missing row, a missing table **and** a DB error | **CONFORMS** | `services/queue-workers/src/platform-queue-consumer.ts:710-728,853-907` | `VERIFIED-SOURCE` |
| **R-14** | `identity-platform` is the **sole** issuer, asymmetric sole-signer; every other service verify-only; **no shared symmetric signing secret** | Merchant asymmetric realm conforms (sole private key, gateway verify-only via `createLocalJWKSet`, pins asymmetric algs, rejects HS256 — with a **real** keypair-generating forgery test). **But** the customer realm is HS256 minted by *two* runtimes with a shared secret; identity-platform mints `lb_accounts` HS256 under `AUTH_SECRET`; platform-console mints HS256; Postgres mints a bearer on rotation (unreachable). The sole-issuer validator **allowlists** `customer-session.ts` and its regexes cannot match raw WebCrypto HMAC | **VIOLATED** (corrected: severity S1 holds; the six-runtime distribution claim is `INFERRED`, two holders proven) | `packages/auth-core/src/customer-session.ts:52,86`; `routes/storefront/customer-registration.ts:141`; `apps/storefront-runtime/src/lib/session.ts:34,56`; `apps/identity-platform/src/lib/auth/cookies.ts:176-180`; `175_…:98`; `scripts/validators/identity-sole-issuer-validator.mjs:11,17-22` | `VERIFIED-SOURCE` |
| **R-15** | **Exactly one** canonical system per domain | Open duplicates: two live checkout implementations; the storefront compose fork (`resolveStorefrontTemplate`, 5 live route pages) vs the engine's `composeStorefrontTheme`; `theme_editor_drafts` alongside `theme_instance_drafts`/`theme_draft_patches`; gateway `routes/auth.ts` (1,499 LOC) + the 18-file `identity-foundation/` shadow + 6 identity micro-packages; 4 compat ledgers with live TS writers; `users_custom`, `payment_transactions`, `sessions_v2`, `orders.store_id` (sync trigger still installed) | **VIOLATED** | governance-drift S2 cluster; `checkout.ts:680` vs `checkout-payment-routes.ts:395`; `template-resolver.ts:235-308` | `VERIFIED-SOURCE` |
| **R-16** | No reserved service deployed or declared `production`; events flow through a **same-transaction outbox**, not an event bus | **Leg 1 CONFORMS** — all six reserved services are 2-file manifest-only, never declared production, enforced by a path allowlist; the analytics/search/notification queues are consumed by `queue-workers`, not by a reserved service. **Leg 2 fails** — 38 TypeScript post-commit outbox writes | **PARTIAL** | `no-reserved-service-activation-validator.mjs:14-26`; `config/runtime/production-topology.json` (6 reserved, `environment: "reserved"`); `execution/event-execution.adapter.ts:60-77` | `VERIFIED-SOURCE` |
| **R-17** | Nothing on the Never-Build List built, activated, or designed for | The Constitution requires "the partition-shadow seam (**kept, mirror disabled**)". **Five `AFTER INSERT OR UPDATE OR DELETE … FOR EACH ROW` mirror triggers are installed and enabled** on `worker_request_logs`, `runtime_telemetry_metrics`, `outbox_events`, `platform_queue_jobs`, `webhook_deliveries`; the kill switch `set_hot_table_partition_shadow_mirror_enabled(false)` has **no caller anywhere**; migration 179's own header is proof it executes against live traffic | **VIOLATED** (Never-Build #4, "mirror disabled" leg) | `131_hot_table_partition_shadow_mirror.sql:9-56,58,112-141`; `179_outbox_partition_shadow_published_at.sql:1-11`; `LETBUYY_CONSTITUTION.md:296,316` | `VERIFIED-SOURCE` |
| **R-18** | The validator suite enforces **this** Constitution; a green gate means "conforms"; no validator certifies a forbidden capability | 110 gate-lane validators: **0 make an HTTP request, boot a Worker/Next app, or connect to Postgres**; 2 spawn a subprocess, 1 recomputes SHA-256. Two validators' main loops are dead code in a real run (`if (!entry.extra) continue;`). Two are one-line aliases and one alias sits in `criticalGateValidators`. **`migration-safety-validator.mjs:132-141` asserts the scheduled production partition-maintenance workflow must exist** — a validator mandating a capability the Constitution rejects. `durable-object-validator.mjs:17-18` likewise requires the unused Durable Object capability to remain | **VIOLATED** | `scripts/validate-governance.mjs:70-186`; `rls-force-coverage-validator.mjs:35-36`; `one-system-per-domain-validator.mjs:28`; `phase-b-common.mjs:19-43,52-59`; `migration-safety-validator.mjs:132-141`; `durable-object-validator.mjs:17-18`; `LETBUYY_CONSTITUTION.md:98` | `VERIFIED-SOURCE` |
| **R-19** | No generated document declares topology, architecture, or scale as law | Topology manifests self-label `"mode": "governance-contract-not-live-evidence"` with `liveEvidenceTracked: false` — **honest and asserted by five validators.** But `deployment-topology.json` declares `generatedFrom: "runtime-manifests"` while omitting 4 apps that have manifests (false provenance, validator checks the literal string), `CLAUDE.md:76,92` states a stale "107-validator gate" against a 110-entry array, and `AGENTS.md` MIG-R2 is factually wrong on all three of its claims while being read as law | **PARTIAL** | `config/runtime/deployment-topology.json:2-5`; `runtime-topology-validator.mjs:16`; `CLAUDE.md:76,92`; `AGENTS.md:156,214` | `VERIFIED-CONFIG` |
| **R-20** | Deployment from the canonical branch; the branch-lag guard stays green | The guard is genuinely enforced: `git rev-list --count HEAD..origin/stepup/main` must be 0 after asserting `GITHUB_REF_NAME == main` and force-fetching both refs; wired as the first job of `production-deploy.yml` and hourly in `branch-lag-monitor.yml`. **Measured at this SHA: lag = 0** (`main` == `stepup/main` == `origin/main` == `f52abca7`). Residual: the guard measures ancestry only; `BRANCH_STRATEGY.md:53-57` still asserts the resolved lag as a live gap; and `production-rollout.yml` is `workflow_dispatch`-only with **no branch restriction** | **CONFORMS** | `branch-lag-guard-validator.mjs:66-88`; `production-deploy.yml:24-37`; `evidence/00-preflight.txt`; `.github/BRANCH_STRATEGY.md:53` | `VERIFIED-SOURCE` |
| **R-21** | No secret committed; live paths gated `[HUMAN-REQUIRED]`; every external provider defaults to **mock** | **No committed secret value found** — a ripgrep for `rzp_live`/`rzp_test`, `sk_live_`, JWT-shaped strings and service-role assignments across `config/`, `services/`, `apps/`, `.github/`, `infrastructure/` returns **zero hits**; no `.env` is tracked; `SKIP_NEEDS_HUMAN_*` placeholders are used and a validator enforces them. **But** `queue-workers` never sets `WHATSAPP_PROVIDER_MODE`, so `normalizeMode` falls back to **`'live'`** in production | **PARTIAL** | `committed-secret-placeholder-validator.mjs`; `services/api-gateway/wrangler.toml:275,277-280`; `whatsapp-commerce-adapter/index.ts:146-147`; `services/queue-workers/wrangler.toml` | `VERIFIED-CONFIG` |
| **R-22** | Truthful provider-mode honesty badge; **a stub MUST NEVER read as `success`** | `PUSH_DISPATCH_MODE = "dry-run"` in the production var block, and the dispatcher does `if (result.dryRun) { result.sent += 1; continue; }` — a dry run increments the same counter a real delivery would. WhatsApp sandbox returns `status: 'queued'` with a synthetic `wa_sandbox_*` id, success-shaped | **VIOLATED** | `services/queue-workers/wrangler.toml:257`; `push-dispatcher.ts:99,381-384`; `platform-queue-consumer.ts:665-676`; `whatsapp-commerce-adapter/index.ts:297-311` | `VERIFIED-CONFIG` + `VERIFIED-SOURCE` |
| **R-23** | Every migration ships a **paired rollback**; nothing load-bearing deleted before a zero-drift/zero-importer proof | **48 paired / 78 unpaired of 126** (re-counted first-hand). **12 unpaired at or above the MIG-R3 threshold of 138** — 138, 140, 157, 170, 175, 179, 182, 183, 184, 186, 187, 194 — of which **9 are new since `AGENTS.md` was written** (last committed 2026-06-11; migration 170 landed 2026-06-13, 197 on 2026-08-15). **The promised rollback-pairing validator does not exist**: `rollback-integrity-validator.mjs` governs Cloudflare Worker version lineage, and only 3 validators read the SQL rollback directory, each a single hard-coded file. *(The zero-importer leg conforms — the 7 rejected packages were deleted with a proven 0-importer state.)* | **VIOLATED and REGRESSED** | `evidence/01-migrations-and-rollback-pairing.txt`; `AGENTS.md:157`; `rollback-integrity-validator.mjs:14-57`; `commission-bps-zero-validator.mjs:52`; `session-security-validator.mjs:101`; `provider-mode-badge-validator.mjs:89` | `VERIFIED-SOURCE` |

**Tally: 4 CONFORMS · 5 PARTIAL · 14 VIOLATED · 0 UNKNOWN.** No rule is UNKNOWN — every one is testable from source at this SHA, which is itself a credit to how the Constitution was written.

---

# D. Data architecture

## D.1 Migration and rollback truth

All counts below were re-run first-hand at this SHA (`evidence/01-migrations-and-rollback-pairing.txt`, re-verified in this pass).

| Fact | Value |
|---|---|
| Forward migrations | **126** |
| Unique 3-digit prefixes | **126** |
| Duplicate prefixes | **NONE** (`sort -n \| uniq -d` returns empty) |
| Min / max prefix | 000 / **197** |
| Absent prefixes | **exactly 001–072** — no other gap |
| Rollback files | **48**, all name-matching a forward migration exactly, zero orphans |
| Paired / unpaired | **48 / 78** |

**The 126-files-vs-max-197 gap is a baseline squash, not missing migrations.** `database/supabase/migrations/000_baseline.sql` is a `pg_dump` of PostgreSQL 17.6 (header lines 4-5) that subsumes what were migrations 001–072. Prefixes 073..197 are contiguous with no gaps and no duplicates. `scripts/validators/sequential-migration-validator.mjs` encodes exactly this — `KNOWN_GAP_END = 72` with the comment "migrations 001-072 are absent by design" (`:5-7`), a duplicate check over all prefixes (`:44-49`), a contiguity check restricted to `nums > 72` (`:52-61`), and a fail on untracked migration files (`:17-26`). **The validator passes for the right reason.**

**Root `AGENTS.md` MIG-R2 is wrong on all three of its claims at this SHA.** It states "current max (161) — i.e. the next migration is 162" (real max is 197; 162 is taken by `162_phase_a_commission_zero.sql`), orders agents to "fix the existing duplicate prefix (129)" (no duplicate exists; `129_mobile_customer_segments.sql` occurs once), and cites an enforcing validator named `migration-history-validator` (a repo-wide grep returns only that `AGENTS.md` line — **the file does not exist**). `AGENTS.md:214` (TEST-R10) is stale the same way, requiring CI to "replay 000→161". **An agent following `AGENTS.md` literally would number its next migration 162 and collide.**

**Rollback pairing is a different and real defect.** `AGENTS.md:157` names only 138/140/157 as the known-unpaired set and promises "a rollback-pairing validator gates merge for any migration ≥ 138". At this SHA there are **12** unpaired at or above 138, **9 of them new since the rule was written**, and **no such validator exists**. Consequence: a bad schema change at or after 138 — including 179, which itself fixed a production-breaking outbox failure — has no rehearsed DOWN path. For a single-Postgres, single-region topology, recovery falls back to PITR, which is whole-database rollback with data loss for every tenant, not a targeted revert.

## D.2 RLS / FORCE / policy coverage at replay-final state

Derived from migration SQL only. **No live database was read** — `04_LIVE_DEPLOYMENT_TRUTH.md` L-10…L-13 remain open, and the Constitution itself carries the live GRANT state as `UNVERIFIED` (§14.4 item 1).

| Measure | Value |
|---|---|
| Distinct tables created | **423** |
| Tables receiving `ENABLE ROW LEVEL SECURITY` | **423** — no created table lacks ENABLE |
| Static `FORCE ROW LEVEL SECURITY` statements | 112 tables |
| Additional FORCE via `164:63-64` catalog loop | every public base table with `site_id`/`store_id` = **259 of 423** at replay time of 164 |
| Tables created **after** 164 (escaping the loop) | 13 — 9 declare ENABLE+FORCE; **4 (`metric_rollups`, `mrr_arr_rollups`, `cohort_snapshots`, `funnel_steps`) have ENABLE only** (`169:153-156`) |
| Final-state policies (CREATE minus later DROP, replay order) | **680** |
| Policies with `USING(true)`/`WITH CHECK(true)` | **110** — ~90 correctly `TO service_role` |
| **PUBLIC-effective true-predicate policies surviving to final state** | **~19** with **no `TO` clause** (PostgreSQL default = PUBLIC) + 3 explicit anon/authenticated |

The PUBLIC-effective residue includes `auth_password_set_intents` (`078:52` — the table that binds identity password creation to a verified OTP), `gift_cards`, `collections`, `collection_products`, `pages`, `onboarding_attempts`, `store_surveys`, `audit_logs` (INSERT — audit forgery), `analytics_events`, `leads`, `contact_submissions`, `plans`, `employee_roles`, `ai_usage`, four `app_*` discovery tables, and `employee_permissions`. Migration 163's own header states the root cause verbatim: *"PostgreSQL policies without an explicit TO clause apply to PUBLIC, so the baseline `service_role_*` names were not actually service-role-only."* **163 remediated exactly 12 tables and REVOKEd writes on 11 of them; no equivalent REVOKE exists for the tables above.** A remediation check was explicitly performed: grepping migrations 073–197 for a later DROP or replace of `service_role_gift_cards` / `_collections` / `_pages` / `_collection_products` / `_onboarding` / `_store_surveys` returns **nothing**; only `service_role_email_logs` was fixed (`149:144`).

Two validator gaps make this class invisible to the gate:

- `scripts/validators/no-public-using-true-validator.mjs:23-26` flags an offender only when `hasTruePolicy && publicRole`, where `publicRole` requires a **literal** `TO PUBLIC|anon|authenticated` in the policy text. **A policy with no `TO` clause is therefore not flagged** — precisely the defect class migration 163 was written to fix. It also skips `000_baseline.sql` entirely and scopes its final-state replay to 12 hard-coded tables.
- `scripts/validators/rls-force-coverage-validator.mjs:35-36` begins its scan with `if (!entry.extra) continue;`, and `extra` is `true` only for synthetic entries injected via `LETBUYY_PHASE_B_EXTRA_FILES_JSON` (`phase-b-common.mjs:19-43,52-59`), which is set **only** by `tests/governance/phase-b-validators.test.mjs:147`. **The FORCE ratchet never inspects a real migration.**

`164:28-31` additionally runs `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant`, while the ENABLE+FORCE+policy installation is a **one-shot catalog loop** over tables existing at replay time. Any table created after 164 inherits `app_tenant` DML by default but gets no policy unless its own migration adds one — **grants outrun policies**, and the ratchet that should catch it is dead code.

**The only behavioural RLS proof is `tests/executable/tenant-redteam-postgres.test.mjs`**, which genuinely executes `SET ROLE app_tenant/authenticated/anon/service_role` with positive controls first and asserts zero cross-tenant rows plus fail-closed on an unset GUC. It **is** run in CI via `test:behavioral` (`ci.yml:121,164`). Two caveats: the file `AGENTS.md` TEST-R4 names (`tests/security/cross-tenant-redteam-postgres.test.mjs`) does not exist, and the real suite runs against a **13-table synthetic schema the test builds itself** with only migrations 163 and 164 applied — not against a replay of 000..197. `VERIFIED-TEST`, bounded.

## D.3 Money schema

**The canonical ledger conforms completely** — see §B.19 and R-5/R-6 above. Eight account codes, `writer_module` CHECK, append-only by trigger **and** REVOKE, bigint `amount_minor`, derived balance, deferred balance-enforcing constraint trigger, `reversal_of` self-FK for correction-by-reversal, and ENABLE+FORCE+`site_id = current_site_id()` policies on all five ledger-family tables (`139:384-406`).

**The operational money path does not.** `orders.subtotal/shipping_cost/tax/discount/total/coupon_discount` are `numeric(12,2)` **by deliberate design** — `109_orders_money_width.sql:3` states in its header "Storefront order money remains `numeric(_,2)`". `payment_transactions.amount` is `numeric(10,2)`, capping a single transaction at ₹99,999,999.99. `order_items` price/tax/CGST/SGST/IGST are numeric; gift-card balances are numeric with numeric-typed RPC locals. The bridge is `round(total*100)::bigint` (`168:172`) on the SQL side and `Math.round(Number(order.total) * 100)` on the TypeScript side (`checkout-payment-routes.ts:162`) — **an IEEE-754 round-trip**, and GST maths crosses the boundary twice.

`AGENTS.md:159` (MIG-R5) explicitly schedules the bigint cutover as Wave 5, after Wave-1 correctness wiring — so this is plausibly a **deliberate deferral rather than drift**, but no dated ARB record of that decision was located (carried as an open question).

Separately, **~30 `*_minor` columns are 32-bit `integer`**, overflowing at ₹2,14,74,836.47: `payout_statements` gross/platform_fee/tax/net, `wallet_ledger_entries.amount_minor`, `commission_reconciliation_entries.*` (`119:16-19,52,107-112`), `cod_reconciliation_entries.*` (`140:26-29`), developer payout reconciliation (`134:23-25,70`), app billing (`093:14,20`; `095:15-16,73-74`), spend controls (`096:7-8`), `discount_amount_minor` (`106:63`), `domain_orders.amount_minor` (`090:165`), risk detection (`124:218`), plus baseline partner payout ledger columns.

## D.4 D1 and Durable Objects — **not** a second data authority

The constitutional question is whether `RUNTIME_DB` (D1) or `RUNTIME_COORDINATOR` (Durable Object), both bound in `[env.production]`, constitute a second source of truth in violation of `R-15`/`ART-04`. **They do not.** Established first-hand (`evidence/04-d1-durable-object-second-authority.txt`):

```
rg -n 'RUNTIME_DB' services apps packages --type ts -g '!**/__tests__/**'
  services/api-gateway/src/index.ts:206                 RUNTIME_DB?: D1Database;          ← type declaration
  services/api-gateway/src/routes/internal-console.ts:808  runtime_db: Boolean(c.env.RUNTIME_DB)  ← presence check
```

**Two references in the entire codebase: an optional type declaration and a Boolean presence check in a diagnostics route.** No query, no insert, no read. The one D1 migration (`database/cloudflare/d1/migrations/0001_provider_execution_foundation.sql`) creates `provider_execution_evidence`, `d1_migration_lineage`, `outbox_restoration_lineage` and `rollback_lineage`; a repo-wide grep for those four table names hits only `scripts/validators/d1-governance-validator.mjs:18-21`.

The Durable Object class (`services/api-gateway/src/durable/runtime-coordinator.ts`, 46 lines, read in full) persists exactly two keys — `'initialized'` and `'checkpoint'` — and serves only `GET /health` and `POST /checkpoint`. **No `idFromName`/`get()` dispatch exists anywhere.** No cart, order, payment, inventory, session or tenant state.

**Verdict: `R-15` / `ART-04` are NOT violated on this axis. The one-PostgreSQL invariant holds with respect to D1 and DO.**

Three real secondary findings survive. (1) A real D1 `database_id` and a DO namespace are declared in the production manifest for infrastructure no code path uses — two billable stateful primitives per environment with no traffic. (2) **A validator actively enforces the dead infrastructure**: `scripts/validators/durable-object-validator.mjs:17-18` asserts that `wrangler.toml` contains `new_sqlite_classes = ["LetbuyyRuntimeDurableObject"]` and that `index.ts` exports the class — so the suite **requires** this unused capability to remain. That is a concrete, citable instance of the gate enforcing something that is not a constitutional invariant. (3) `config/runtime/cloudflare-topology.json` declares `durableObjects.checkpointPolicy = "snapshot-and-outbox-cursor-required-before-restoration"` while the code stores **no** outbox cursor and **no** snapshot — anyone reading the manifest during an incident would believe a restoration checkpoint exists.

## D.5 KV and R2 key spaces and tenant scoping

| Store | Key space | Tenant scoping | Notes |
|---|---|---|---|
| **KV `CACHE`** — storefront cache version | `storefront-cache-version:<lowercased handle>` | **Correct** — handle is the unique `sites.subdomain` | Written with **no `expirationTtl`** (`storefront-cache.ts:89`); read failure silently returns `'0'` (`:75-80`), serving the oldest generation rather than bypassing; key space grows monotonically with store count |
| **KV `CACHE`** — fixed-window rate limit | `${key}:${floor(now/windowMs)}`, TTL `max(60, window+30)`s | per-key | **Non-atomic get-then-put** (`rateLimit.ts:317-325`) |
| **KV `CACHE`** — query-cost leaky bucket | JSON entry, TTL `max(60, 2*capacity/rate)` | per-key | **Non-atomic** (`:617-623`); reached only because `RATE_LIMIT_KV_FALLBACK="on"` (`:928` has no `isProduction` clause) |
| **R2 `R2_BUCKET`** — uploads | `${folder}/${auth.user.id}/${ts}-${uuid}.${ext}` | **Owner-scoped, NOT site-scoped**; `store_id` only in `customMetadata` | No prefix enumerates one site's media — DPDP erasure requires a full-bucket scan |
| **R2** — shipping labels | `shipping-labels/${labelId}.pdf` | **Flat, not tenant-prefixed**; tenancy enforced post-fetch by the application | A future list-or-serve-by-key path would leak cross-tenant PDFs containing customer names and addresses |
| **R2** — CSV export, GraphQL bulk | `export.ts:167-170`, `graphql/bulk.ts:133-136` | — | **No lifecycle or expiry configuration exists anywhere in the repository**; no orphan reconciliation |

Production binds the **shared `CACHE` namespace** for rate limiting (`wrangler.toml:313-316`) rather than the dedicated `letbuyy-rate-limit-production` namespace declared at `config/cloudflare/resource-names.json:63-66`, which **no wrangler config in the repository binds**. Separately, `config/runtime/cloudflare-topology.json` declares KV *names* while `wrangler.toml` binds by *id* only, so the name↔id correspondence is not verifiable from the repository.

## D.6 The partition-maintenance question — settled

**Does the monthly workflow conflict with the Constitution? Answer: the *workflow* does not. The *mirror trigger* does. And a validator mandates the workflow, which is a separate `ART-02` problem.**

The Constitution says, verbatim: *"the partition-shadow seam (**kept, mirror disabled**)"* (`LETBUYY_CONSTITUTION.md:296`), and lists "Sharding / partitioning now" as rejected with "the partition helper seam exists, **disabled**" (`:316`).

**Leg 1 — the DDL workflow. NOT a constitutional breach.** `.github/workflows/hot-table-partition-maintenance.yml` runs `cron: "15 2 1 * *"` in the `production-migrations` environment with `EXECUTE_MAINTENANCE` forced true on the schedule branch and `SUPABASE_DB_URL` bound to `PRODUCTION_DB_CONNECTION_STRING`, invoking the driver with `--execute --months-ahead=3`. But those functions operate **exclusively on `retention_policies.shadow_table`**: partition creation is `CREATE TABLE public.<shadow>_YYYY_MM PARTITION OF public.<shadow>` (`079:178-184`) and detachment is `ALTER TABLE public.<shadow> DETACH PARTITION` (`079:293-297`). **No live table is partitioned or renamed.** `079`'s own header states the live rename-swap "is intentionally not performed in a replayable migration" (`:2`), and `backfill_hot_table_partition_shadow` (`079:319-372`) has no caller. Maintaining an empty shadow seam is consistent with "seam kept". *(The operational risk — unattended monthly DDL against production with no plan-then-approve step, and `EXECUTE_MAINTENANCE` defaulting true on schedule — is real but is a deployment-safety issue, not a constitutional one.)*

**Leg 2 — the mirror. This IS the breach.** I read `131_hot_table_partition_shadow_mirror.sql` directly. Its header states "the hot-table partition shadows **must not sit inert**" — the opposite of the Constitution's instruction. It installs five `AFTER INSERT OR UPDATE OR DELETE … FOR EACH ROW` triggers (`:112-141`) on the live tables, each executing `mirror_hot_table_partition_shadow()` (`:9-56`), which per row does a `SELECT * FROM retention_policies WHERE target_table = TG_TABLE_NAME AND lifecycle_mode IN ('partition-shadow','partition-live')` and then a dynamic `DELETE`/`INSERT INTO <shadow> SELECT ($1).*`. **The kill switch `set_hot_table_partition_shadow_mirror_enabled(boolean)` exists at `:58` and a repo-wide grep across `.sql`, `.mjs`, `.ts` and `.yml` finds no caller.** `079:10` registers policies with `lifecycle_mode DEFAULT 'partition-shadow'`, so the trigger's early-return guard does **not** fire — the mirror is active as replayed.

**Migration 179's own header is direct evidence it executes against live traffic:** a missing shadow column raised SQLSTATE 42601 and *"broke EVERY outbox write — including theme release publishing via `publish_theme_release()`"*. This is an availability-critical coupling on the money path, and it doubles the write amplification of every domain event on `outbox_events`, `platform_queue_jobs` and `webhook_deliveries` — the exact tables the relay hammers hardest.

**Leg 3 — the `ART-02` problem.** `scripts/validators/migration-safety-validator.mjs:132-141` asserts that the workflow **must** contain `cron: "15 2 1 * *"`, `production-migrations`, `PRODUCTION_DB_CONNECTION_STRING` and `--months-ahead=3`. **The gate therefore structurally prevents anyone from idling the schedule without first editing the validator** — governance actively defending machinery the Constitution rejects, against `LETBUYY_CONSTITUTION.md:98` ("Validators must enforce *this* Constitution, never the rejected end-state … It may not certify capabilities the Constitution forbids").

## D.7 Observability as a data-architecture problem

Every API request performs **1 `runtime_telemetry_metrics` INSERT (always) + 1 conditional `worker_request_logs` INSERT** (`middleware/observability.ts:265-302,338-381`; 2% sampled for anonymous storefront GET/HEAD, unsampled otherwise). Both tables carry the partition-shadow mirror trigger, adding a `retention_policies` SELECT plus a shadow INSERT per row — **roughly 4-6 statements per request on the single Postgres, before any business work.** *(Corrected to S2: the adversarial pass reduced the "saturates the pool and causes checkout failures" framing.)*

**Neither live table is ever pruned.** `worker_request_logs`, `runtime_telemetry_metrics` and `operation_metrics` are plain heap tables; retention is defined only for the *shadow* partitions, which the maintenance job detaches. **This finding was adversarially CONFIRMED at S1** — one of only four claims to survive verification with severity intact.

---

# E. Deployment configuration

## E.1 The 16 workflows

| # | Workflow | Trigger | Mutates | Role |
|---|---|---|---|---|
| 1 | `ci.yml` | PR + push on `develop`, `main`, `stepup/main`, `codex/web-v1-integration` | nothing | typecheck, secret-hygiene, lint, unit-tests, merge-safety-gate, governance, mobile-merchant, build. **The merge gate.** |
| 2 | `architecture-governance.yml` | PR (path-scoped) + push `main`/`master`/`codex/**` | nothing | 17 continue-on-error steps + a `gate-aggregate` that re-imposes failure. **No push trigger for `stepup/main`.** |
| 3 | **`production-deploy.yml`** | **push `main`** + dispatch | Supabase prod schema, 4 Worker deploys, ~19 secret puts, 5 Vercel `--prod` | **The one gated production path** |
| 4 | **`production-rollout.yml`** | **dispatch only**, no branch restriction | `terraform apply -auto-approve`, worker deploys, `vercel deploy --prod` | **The second production path — see E.3** |
| 5 | `deploy-staging.yml` | push `stepup/main` | 4 Workers `--env staging`, 5 Vercel **preview** deploys | The only automatic staging lane |
| 6 | `staging-deploy.yml` | dispatch only (push commented out at `:4-7`) | staging DB migration, ~20 staging secret puts, 4 Workers, 5 Vercel **`--prod`-alias** deploys, Playwright | The dispatch-only staging lane |
| 7 | `staging-runtime-deployment.yml` | dispatch + **push `main`, `release/**`** (path-scoped) | Terraform/CF primitives on dispatch+execute; plan-only on push | Infrastructure lane |
| 8 | `environment-lifecycle.yml` | PR + dispatch | staging CF primitives + DB seed when dispatched | — |
| 9 | `live-production-certification.yml` | dispatch | can `wrangler secret put` provider secrets in execute mode | 12 validator gates + `phase4-live-certify.mjs` |
| 10 | `branch-lag-monitor.yml` | schedule `17 * * * *` | nothing | Runs the branch-lag guard hourly |
| 11 | **`hot-table-partition-maintenance.yml`** | schedule `15 2 1 * *` | **production DDL** (`EXECUTE_MAINTENANCE` forced true on schedule) | See §D.6 |
| 12 | `mobile-merchant-release.yml` | dispatch | none (signed AAB artifact only) | — |
| 13 | `security-review.yml` | PR | none | Advisory, non-blocking |
| 14 | `full-security-audit.yml` | schedule `30 4 * * 1` | none | Weekly |
| 15 | `lcis-pr-analysis.yml` | PR | none | Uses `--frozen-lockfile=false` |
| 16 | `graph-intelligence.yml` | push/PR + dispatch | regenerates intel artifacts | Advisory |

## E.2 The staging-workflow reconciliation — `DEPLOY-R2` is OPEN

`AGENTS.md:331` requires "Collapse the duplicate staging workflow to one." **Three staging-named workflows exist and none is dead** — `workflow-trigger-coverage-validator.mjs:414-423` lists all three as live deploy lanes and asserts their existence. **No validator asserts they be merged.**

The two app-deploying lanes are genuinely divergent, not duplicates:

| | `deploy-staging.yml` | `staging-deploy.yml` |
|---|---|---|
| Trigger | **push `stepup/main`** (automatic) | dispatch only |
| DB migration | **none** | `db push --include-all` (`:46`) |
| Secrets | **none set** | ~20 `wrangler secret put --env staging`, incl. `RAZORPAY_*` (`:96-98`) |
| Vercel deploy type | `pull --environment=preview` + `build` + `deploy --prebuilt` (`:162-164`) | `vercel deploy --prod` against `STAGING_*` project ids (`:212`) |
| Env var source | pulled from the Vercel project | 22 injected from GitHub secrets |
| E2E | curl health checks | Playwright (`:268`) |

**Two structural consequences.** (1) Whichever ran last determines what the staging alias points at, so **staging has no single reproducible definition** — while `production-deploy.yml:172-223` gates the entire production release on a staging E2E run. (2) The only *automatic* staging lane **deploys code without migrating the schema**, so a commit that adds a migration ships its code to staging but not its DDL, and the release gate then evaluates a schema that does not match the commit.

**A third structural gap:** staging cannot exercise the production rate-limiter at all. `rateLimit.ts:58-67` returns false when `ENVIRONMENT`/`APP_ENV` is explicitly non-production, while `featureFlags.ts:13-17` returns true if **any** of `ENVIRONMENT`/`APP_ENV`/`NODE_ENV` equals `"production"` — and every wrangler env block sets `NODE_ENV="production"`, including `[env.staging.vars]`. On staging the feature-flag helper reports production (fail-closed) while the rate-limit helper reports non-production (in-memory limiter). **Staging green is systematically not evidence for production**, and the repository's own runbook says so.

## E.3 The production deploy matrix — and the second path

**Path 1, `production-deploy.yml` (gated).** Job chain: `branch-lag-guard` → `governance-gate` → `release-preflight` → `migration-preflight` → `staging-e2e` → `migrate-production` → `deploy-workers-production` → `deploy-apps-production` → `release-required-jobs-succeeded` → `smoke-test-production`. Matrix is **exactly 9 targets**: 4 Workers (`api-gateway:338`, `webhook-service:353`, `queue-workers:369`, `mobile-bff:385`) + 5 Vercel apps (`:400-409`). This matches `config/vercel/projects.json` exactly and `deploy-matrix-topology-validator.mjs` enforces it. **No frozen app appears in this workflow, `deploy-staging.yml`, or `staging-deploy.yml`.**

One mismatch: `config/vercel/projects.json` declares per-app production URLs (`accounts.` / `admin.` / `store.` / `www.` / `console.letbuyy.com`), but `production-deploy.yml:433` sets `NEXT_PUBLIC_APP_URL=https://letbuyy.com` for **all five** apps, and the smoke test targets `https://letbuyy.com` as both the marketing and storefront URL (`:522,525`) — **so the production smoke test cannot detect a broken storefront origin because it never requests `store.letbuyy.com`.** `staging-deploy.yml:182-194` by contrast gives each app its own URL.

**Path 2, `production-rollout.yml` → `infrastructure/scripts/deploy/production-deploy.mjs` (ungated for frozen apps).**

> **This is the one finding the adversarial pass CONFIRMED at S1 and found *more* reachable than claimed.**

`infrastructure/scripts/deploy/production-deploy.mjs:121-130` hardcodes **three frozen app roots** into `appRoots` — `apps/app-marketplace` (`:125`), `apps/theme-marketplace` (`:126`), `apps/platform-operations-portal` (`:129`) — *(not `apps/developer-portal`, a correction to the original claim)*. All three have a `package.json`, so the `existsSync` guard at `:133` does not skip them, and at `:138-140` with `--execute` and `environment=production` the script runs `pnpm dlx vercel deploy --cwd <appRoot> --yes --prod`.

**Two workflows reach it with `--execute`**: `production-rollout.yml:174` (target defaults to `all`) and `live-production-certification.yml:117` → `phase4-live-certify.mjs:135`, **the latter passing `--skip-validation`, which bypasses `validate:governance` entirely**. And `infrastructure/deployment/release-promotion.yaml:19` declares `--environment=production --target=all --execute` as **THE governed production `deploymentCommand`** — so this is the normal promotion procedure, not an exotic flag combination.

**No validator covers it.** `deploy-matrix-topology-validator.mjs:11-15` reads only the three workflow YAMLs. Two validators *do* read the script (`deployment-safety-validator.mjs:22-32`, `production-readiness-validator.mjs:625-638`) but assert only the **presence** of safety fragments, never the **absence** of frozen roots. `config/governance/web-v1-scope-registry.json:326` scopes its `frozen_app_deploy_target` rule to `production-deploy.yml` alone.

**Impact, corrected:** the script sets no `VERCEL_PROJECT_ID`, the frozen apps have no `vercel.json`, no `.vercel` link and no registry entry — so the effect would be **creation of new unlinked Vercel projects at auto-assigned `*.vercel.app` production aliases with no environment variables**: unconfigured public origins for code with no security-review lane, not functioning marketplace surfaces on canonical domains. **This is proof the path exists and is uncovered, not proof any such deploy has occurred.**

**Two further deploy-path divergences.** (1) `deploy-worker-runtime.mjs:57` always appends `--keep-vars` while `production-deploy.yml:337/352/368/384` does not — so **the two production paths use opposite var semantics**, and a var set by an earlier action survives every rollout deploy while being invisible in the config. (2) All four `wrangler.toml` files set a top-level `name` **identical** to their `[env.production].name`, and for api-gateway the top-level block is staging-flavoured (`ENVIRONMENT="staging"`, `FEATURE_GRAPHQL/EXTENSIONS/LIQUID="true"`, staging queues/R2) with **no** routes, KV, D1, Hyperdrive, DO, service binding or Analytics dataset. **Corrected to S2:** every CI path passes `--env` explicitly, all four package `deploy` scripts hard-require `--env` via `deploy-worker-runtime.mjs:24`, and wrangler 4.100.0 warns when environments are defined and none is specified — so the residual exposure is manual operator invocation only, and the extension surfaces do **not** re-open (the app-platform kill switch is registered first and fails closed). `docs/runbooks/production-api-rate-limit-backend.md:24-29` records that this operator error did materialise once, on 2026-08-01, producing a routeless Worker.

## E.4 Effective merged production vs staging flags (api-gateway)

Semantics: Cloudflare `[vars]` is a **non-inheritable key** — per-env `[vars]` **replace** the top-level block, never merge. The repository encodes the same assumption (`cloudflare-environment-validator.mjs:126`; `cloudflare-topology.json:16` `"mustUseExplicitEnv": true`).

| Flag | default block | `env.staging` | `env.production` |
|---|---|---|---|
| `ENVIRONMENT` / `APP_ENV` | staging | staging | **production** |
| `NODE_ENV` | production | production | production |
| `FEATURE_GRAPHQL` | true | true | **false** |
| `FEATURE_EXTENSIONS` | true | true | **false** |
| `FEATURE_LIQUID` | true | true | **false** — **read by no runtime code; the real renderer switch is `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` in source** |
| `FEATURE_APP_PLATFORM` | absent | absent | **absent** — the ART-22 kill switch, correct |
| `RATE_LIMIT_KV_FALLBACK` | absent | absent | **`"on"`** |
| `AI_PROVIDER_MODE` / `AI_CREDIT_PURCHASE_MODE` / `WHATSAPP_PROVIDER_MODE` | sandbox | sandbox | **sandbox** |
| `STOREFRONT_CACHE` / `POOLED_SQL` / `SEARCH_PROJECTION` / `ANALYTICS_PROJECTION_READS` / `PRODUCT_VARIANT_DIFF` / `CHECKOUT_POSTCOMMIT_DEFERRAL` / `ORDER_ITEMS_RELATIONAL_READS` / `PRODUCT_VARIANTS_RELATIONAL_READS` | on | on | on |
| `PRIMARY_REGION` | — | — | **`ap-south-1`** (one India region) |
| `CHECKOUT_ORIGIN` | staging | staging | `https://checkout.letbuyy.com` |
| bindings | **NONE** | KV+R2+Hyperdrive+D1+DO+service+AE, route `api-staging` | KV+R2+Hyperdrive+D1+DO+service+AE, route `api.letbuyy.com` |
| `crons` | `[]` | **`[]`** | `["*/15 * * * *"]` |

`queue-workers` production sets `PUSH_DISPATCH_MODE="dry-run"` and `APNS_ENVIRONMENT="production"` with `SKIP_NEEDS_HUMAN_*` FCM/APNS placeholders. **Fifteen `FEATURE_*` flags are declared in the `Env` interface (`index.ts:262-277`) and are never set and never read.** The dev auth bypass is triple-gated and requires `NODE_ENV=development`; both deploy workflows set `NODE_ENV=production`, so it is off in staging and production.

**The rate-limit backend question, settled as far as the repository allows.** The adversarial pass found **no contradiction**: two dated, mutually corroborating 2026-08-01 artefacts (`wrangler.toml:250-259` and `docs/runbooks/production-api-rate-limit-backend.md`, neither changed since) assert that production runs the KV fallback with no Upstash; the Upstash entries in `production-deploy.yml:76-77,111-112,327-328` are a release **precondition** added 2026-06-05, not a state assertion. Both are simultaneously true if the gated pipeline never completes — and the runbook's own root cause (a plain `wrangler deploy` with no `--env`) **cannot** have originated in the pipeline, since every pipeline deploy passes `--env production`. **Corrected verdict: a release-integrity gap (S2 / `VERIFIED-CONFIG`), not a documentation contradiction.** Whether any pipeline run has ever reached `deploy-workers-production` is `UNKNOWN` and is `04`'s L-06 — answerable today from the Actions run history with no new credential.

## E.5 Secrets posture (names only — no value was read, printed, or transmitted)

**No committed secret value exists.** A ripgrep for `rzp_live`/`rzp_test`, `sk_live_`, JWT-shaped strings and service-role assignments across `config/`, `services/`, `apps/`, `.github/` and `infrastructure/` returned **zero hits**. No `.env` file is tracked — only `.example`/`.template` with bracketed placeholders. `scripts/validators/committed-secret-placeholder-validator.mjs` enforces this for `wrangler.toml` credential keys.

| Category | Names |
|---|---|
| Declared required Worker secrets (27) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `CSRF_SECRET`, `STEP_UP_SIGNING_SECRET`, `INTERNAL_API_SECRET`, `LETBUYY_INTERNAL_API_SECRET`, `INTERNAL_API_KEYRING`, `QUEUE_TENANT_ENVELOPE_SECRET`, `PREVIEW_SIGNING_KEY`, `STORE_ACCESS_SIGNING_KEY`, `LETBUYY_IDENTITY_PUBLIC_JWKS`, `PLATFORM_CONSOLE_API_TOKEN`, `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET`, `RAZORPAY_ROUTE_ACCOUNT_ID/KEY_SECRET/WEBHOOK_SECRET/MODE`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `PAYMENT_CONFIG_ENCRYPTION_KEY` |
| Actually provisioned to api-gateway by `production-deploy.yml:312-330` (19) | `SUPABASE_*`, `AUTH_SECRET`, `CSRF_SECRET`, `CUSTOMER_SESSION_SECRET`, `STEP_UP_SIGNING_SECRET`, `LETBUYY_IDENTITY_PUBLIC_JWKS`, `CHECKOUT_SIGNING_SECRET`, `TURNSTILE_SECRET_KEY`, `INTERNAL_API_SECRET`, `LETBUYY_INTERNAL_API_SECRET`, `INTERNAL_API_KEYRING`, `QUEUE_TENANT_ENVELOPE_SECRET`, `PLATFORM_CONSOLE_API_TOKEN`, `UPSTASH_REDIS_REST_URL/TOKEN`, `RESEND_API_KEY`, `PAYMENT_CONFIG_ENCRYPTION_KEY` |
| **Never provisioned by any production path** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_ROUTE_*`, `PREVIEW_SIGNING_KEY`, `STORE_ACCESS_SIGNING_KEY`, `RESEND_FROM_EMAIL`, `MEDIA_UPLOAD_SIGNING_SECRET`, and `RESEND_API_KEY` **for queue-workers** |
| Correctly scoped | `LETBUYY_IDENTITY_PRIVATE_JWK` → identity-platform only (`:446`); `LETBUYY_IDENTITY_PUBLIC_JWKS` → api-gateway only (`:319`) |

**The Razorpay finding was corrected from S1 to S3.** `deployment-safety-validator.mjs:139-155` deliberately **bans** provisioning Razorpay keys in `production-deploy.yml` under governance law A4, so the go-live atom stays rollback-clean, with live keys deferred to a recorded human runbook (`EXECUTABLE_HUMAN_REQUIRED.md:6`, `HR-MERCHANT-PSP-LIVE`). Two of the three core keys **do** have an in-repo CI-invocable production path via `infrastructure/scripts/security/rotate-secrets.mjs:20,22,56` reached from `live-production-certification.yml`. The 503 at `payments.ts:900,1062` is the **intended** fail-closed launch-phase posture, not an outage. What genuinely survives is a **config-classification defect**: the matrix lists Razorpay under `workers.requiredSecrets` rather than the adjacent `optionalProviderSecrets` bucket, and `environment-validator.mjs:90-124` loads the matrix but never compares `requiredSecrets` against any provisioning path.

**Frozen-app and reserved-service identifiers persist in the operator-facing templates:** `config/env/production.env.template:32-36` declares Vercel project ids for all four frozen apps and `:136-141` declares live public URLs `themes.` / `apps.` / `developer.letbuyy.com`; `config/cloudflare/resource-names.json:23-46` declares production Worker names for all six constitutionally-empty reserved services. Combined with the three frozen roots already in `production-deploy.mjs`, that is the full set of inputs a rollout needs to publish them.

## E.6 The branch-lag guard

`scripts/validators/branch-lag-guard-validator.mjs` asserts `GITHUB_REF_NAME == main` (`:77-80`), force-fetches both refs (`:66-72`), then executes `git rev-list --count HEAD..origin/stepup/main` and asserts the count is **0** (`:84-88`). Wired as the first job of `production-deploy.yml:24-37` with `LETBUYY_ENFORCE_BRANCH_LAG=1` and `fetch-depth: 0`, and hourly via `branch-lag-monitor.yml`.

**Measured at this SHA: `main`, `stepup/main`, `origin/main` and `origin/stepup/main` all resolve to `f52abca7`; `git rev-list --left-right --count main...stepup/main` returns `0 0`.** The `ART-03` branch-lag meta-blocker — the reason every remediation was undeployable and every "complete" wave was "~0% live" — is **closed at this SHA**. `VERIFIED-SOURCE`.

Two residuals. The guard measures **ancestry**, not tree equality, so a merge that preserves history without importing content satisfies it — which is exactly what commit `ca745d6a` deliberately did for `main`'s `eec70b3b`, documented in the merge message, but the guard alone cannot detect a case where that is not intended. And `.github/BRANCH_STRATEGY.md:53-57` still states under "Known reality gaps" that `main` is 106 commits behind and `origin/main` 291 behind, measured 2026-08-09 — **stale, and it tells any reader the deploy meta-blocker is still open.**

---

## Cross-references

- What law requires, and the R-1…R-23 text this document tests against — `02_GOVERNED_ARCHITECTURE.md`
- Why nothing here is `VERIFIED-LIVE`, and the 22-item gap register — `04_LIVE_DEPLOYMENT_TRUTH.md`
- The evidence ladder, the exclusions applied to every inventory, and the command ledger — `01_EVIDENCE_METHOD_AND_INDEX.md`
- Where each conformance failure becomes a registered conflict — `05_DRIFT_AND_CONFLICT_REGISTER.md`
- What the measured per-request costs in §B.11, §B.15 and §B.17 mean for throughput — `06_10M_WORKLOAD_DEFINITION.md`, `07_CAPACITY_MODEL.md` (the four ceilings that bind at or below Band G are all traced to source in this document: the KV limiter §D.5, the storefront cache §B.11, telemetry writes §D.7, the outbox relay §B.20)
