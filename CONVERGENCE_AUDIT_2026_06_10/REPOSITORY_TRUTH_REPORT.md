# REPOSITORY TRUTH REPORT

**Convergence Audit 2026-06-10 · Phase 1 — Repository Truth (Discovery only)**
**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · branch `stepup/main` @ HEAD `5cf9e64e` ("fix(foundation): resolve final audit drift", 2026-06-10 08:42 +0530) · deploy branch `main` 30 commits behind (the **only** branch production CI triggers from — `production-deploy.yml:3-7`) · working tree **512 deleted / 410 modified / 78 untracked** (verified `git status --porcelain` 2026-06-10; wave-1 baseline 76 `??`, the extra entries are this audit's own directories).
**Mode:** DISCOVERY ONLY. This is the definitive "what is real" census for the **whole repository**, framed by the user's exact questions. It builds on (does not redo) the 13-report `REPOSITORY_TRUTH_AUDIT_2026_06_10/` and stays consistent with `CONVERGENCE_AUDIT_2026_06_10/_PREMISES_SEED.md`. Every count and claim below was either re-run read-only by this phase or carries a prior-report citation (`REPORT §x`); items requiring live infra/DB/provider access are marked **UNVERIFIED**.

---

## 1. Executive Summary

**The master fact is temporal triplication, and it dominates "what is real."** LetBuyy is three coexisting platforms in one checkout: **`main`** (condemned, the only deploy trigger), **HEAD `stepup/main`** (+30 commits, waves 0–7), and the **uncommitted working tree** (Phases A–D13, the hardened end-state). For all six load-bearing domains — governance, identity, money, themes, tenancy, deployment — these are three different systems with three different security postures. The only reality that conforms to the platform's own ratified canon is the working tree, and it is the only one with **zero version-control protection** (`EXECUTION_LEDGER.md`: 40 of 44 rows say "not committed" — verified).

**What is genuinely real is a concentrated core.** One backend monolith (`services/api-gateway`: **261 TS files / 84,549 lines / 76 mounted route prefixes** — verified, matches prior audit exactly) + 3 thin satellite workers (`webhook-service`, `queue-workers`, `mobile-bff`) + 5 production Next.js apps + 1 real Flutter app (`merchant-app`); a 91-tracked-file (96-on-disk) additive migration chain; a real append-only double-entry ledger kernel (migration 139); a credible asymmetric identity topology (working-tree only); real RLS FORCE + `app_tenant` GUC tenancy (untracked migration 164); a 90-validator governance gate that passes end to end.

**Counts at a glance (this phase's census).** Apps on disk: **10** (`apps/`) + 3 mobile roots — of which **5 web apps + 1 mobile app deploy**, 4 web apps are frozen-with-full-source, 2 mobile roots are 2-file placeholders. Services on disk: **10** — **4 run/deploy**, **6 are 2-file manifest-only reserved roots**. Packages: **20** lib roots (18 with `package.json`). Migrations: **96 on disk / 91 tracked** (162–166 untracked). Validators: **133 on disk / 187 tracked** (the gap = 77 theater validators staged-as-deleted; + 23 untracked Phase-B/C/D validators). Docs: **1,532 files** (`docs/`), of which **865 under `docs/archive/`** (only 468 tracked; the 8 newest 2026-06-10 archive dirs are 100% untracked). Root `.md`: **65 tracked / 7 on disk** (58 tracked-as-deleted — the commit trap).

**The truth-vs-paper split.** Counting whole "systems" (not files): roughly **22 REAL** systems (exist + run/deployable in at least one reality), **~14 PAPER-ONLY** (exist only in governance/docs/prompts/config, never in runnable code — multi-region, CQRS/distributed runtime, reserved fleet, survivability/chaos contracts, k8s/helm observability), and **~9 GHOST** systems (referenced by name but the referent does not exist on disk: `_GOVERNANCE_SPINE.md` cited 26×, `packages/typescript/utils`, `services/identity-platform`, the otel cluster, `stream/*` merge branches, `checkout.letbuyy.com`'s dedicated runtime). Dead/abandoned artifacts number in the **hundreds** (67 generated intelligence docs, 77 theater validators + 69 theater tests, 34/64 unreachable mobile screens, ~16 theater governance docs, ~55 at-large dangerous prompts, the entire previous-product portfolio/resume cluster).

**The single highest-risk object is not a file — it is the uncommitted state itself.** The hardened reality (the only correct one) has zero git history; `git clean -fd` destroys the Constitution, AGENTS_V2 source, migrations 162–166, 23 validators, and both 2026-06-10 archives; `git reset --hard` resurrects the rejected regime. Repository health carried from the prior master: **3.1/10**; as-deployable-today **2.3/10**; working-tree end-state **5.5/10**.

---

## 2. Method & Evidence Base

- **Read-only git only.** No file modified except this report. All `git`/`find`/`grep` commands were run against the live working tree at `5cf9e64e` and three named refs (`main`, `HEAD`, working tree).
- **Build-on, not redo.** The prior `REPOSITORY_TRUTH_AUDIT_2026_06_10/` 13 reports are the citation base (`CODEBASE_REALITY_REPORT`, `ARCHITECTURE_TRUTH_REPORT`, `DATABASE_TRUTH_REPORT`, `GOVERNANCE_TRUTH_REPORT`, `IDENTITY_TRUTH_REPORT`, `MONEY_TRUTH_REPORT`, `THEME_PARITY_REPORT`, `MOBILE_TRUTH_REPORT`, `PROMPT_DRIFT_REPORT`, `DUPLICATE_REALITY_REPORT`, `DELETION_CANDIDATE_REGISTRY`, `PRODUCTION_READINESS_REPORT`, master). Cited as `REPORT §x`.
- **Spot-verification performed this phase (all re-run read-only):** branch/HEAD/status; tracked vs on-disk counts for validators (133/187), migrations (96/91), docs (1,532; archive 865/468 tracked), root `.md` (65/7); the 6 reserved services = 2 files each; production-deploy.yml app/worker matrix (5 Vercel + 4 workers); `production-topology.json:34` `globalRegions:[india,apac,…]` + the two survivability validators that mandate 4 regions; `_GOVERNANCE_SPINE.md` cited 26× / file absent; `tsconfig.workspace.json:68` → absent `packages/typescript/utils`; CHECKOUT_ORIGIN prod = `checkout.letbuyy.com` vs 2-file reserved `checkout-runtime`; commission `?? 300`(main/HEAD) vs `?? 0`(WT); `AGENTS.md` scan-generated(main/HEAD) vs hand-authored(WT); `confirm_order_payment_with_ledger` writes only `payment_transactions`; portfolio/resume routers mounted at `index.ts:738-739`; FEATURE_GRAPHQL/EXTENSIONS/LIQUID prod=false/staging=true; 29 `SKIP_NEEDS_HUMAN_*` in prod wrangler vars; otel→`*.letbuyy-observability.svc.cluster.local`; GraphQL 3,941 lines / extensions 1,123 lines; `EXECUTION_LEDGER.md` 40 "not committed".
- **Out of scope (UNVERIFIED), per the audit envelope:** live Vercel/Cloudflare deployment state, live Supabase DB row counts/`pg_stat`, live payment/ESP/DNS providers, GitHub Actions run history. Where the report says "deploys" it means "the committed config directs a deploy"; whether that deploy is currently live is UNVERIFIED.

---

## 3. Reality Ledger (master table)

Artifact-class → Exists? → Runs? → Deployed? → Reachable? → Reality plane → Evidence. "Runs" = part of a local dev bring-up or worker/app runtime. "Deployed" = named in a deploy config that targets production (live state UNVERIFIED). "Reality plane" = which of main/HEAD/WT it is canonical in.

| Artifact-class | Exists? | Runs? | Deployed? | Reachable? | Reality plane | Evidence |
|---|---|---|---|---|---|---|
| `services/api-gateway` monolith (261 TS / 84,549 ln / 76 prefixes) | YES | YES | YES (worker, prod) | YES | all (code differs by plane) | verified; CODE §3-4 |
| `services/webhook-service` | YES | YES | YES (worker) | YES | all | `production-deploy.yml:314-326` |
| `services/queue-workers` (36 consumer bindings, 6h cron) | YES | YES | YES (worker) | YES | all (+1 untracked file) | verified; `wrangler.toml` |
| `services/mobile-bff` (449-ln proxy) | YES | YES | YES (worker) | YES | all | `production-deploy.yml:347-357` |
| 6 reserved services (checkout/search/media/notification/event-bus/analytics) | manifest-only (2 files each) | NO | NO | NO | n/a (placeholder) | **verified: 2 files each** |
| `apps/storefront-runtime` | YES | YES | YES (Vercel) | YES | all | `production-deploy.yml:376` |
| `apps/merchant-control-plane` (control plane + 62-route 2nd backend) | YES | YES | YES (Vercel) | YES | all | CODE §1.9; DUPLICATE §7.1 |
| `apps/identity-platform` (sole issuer) | YES | YES | YES (Vercel) | YES | all; **asymmetric topology WT-only** | `production-deploy.yml:372`; IDENT §1 |
| `apps/platform-console` (PHASE-C survivor) | YES | YES | YES (Vercel) | YES | all | `production-deploy.yml:378` |
| `apps/marketing-site` | YES | YES | YES (Vercel) | YES | all | `production-deploy.yml:370` |
| Frozen-four web apps (app-marketplace 93, theme-marketplace 68, platform-operations-portal 34, developer-portal 22 TS/TSX) | YES (full source) | YES (build) | **prod NO; staging deploys 3 of 4** | partial | all | **verified**; `staging-deploy.yml:189,192,198`; CODE §1.3 |
| `apps/mobile/merchant-app` (Flutter, 63 `*_screen.dart`) | YES | YES | YES (release lane untracked) | partial (30/64) | all; D8/D9 hardening WT-only | MOBILE §10; verified |
| 2 reserved mobile apps (shopper/operator) | placeholder (2 files each) | NO | NO | NO | n/a | **verified: 2 files each** |
| 20 lib packages (`packages/*`) | YES | YES (via turbo) | n/a (consumed) | YES | all; bridge rewrites WT-only | verified; CODE §6-7 |
| Migration chain 000–166 (96 disk / 91 tracked) | YES | apply | YES (`db push`) | YES | **162–166 UNTRACKED (WT-only)** | **verified**; DB §3 |
| Canonical double-entry ledger kernel (mig 139) | YES | YES | YES | YES (kernel) — **buyer path un-wired** | all kernel; capture gap all | MONEY §1.1, §2a |
| Validator gate (133 disk / 187 tracked) | YES | YES (`validate-governance.mjs`) | n/a (CI) | YES | **WT 90-lane; 23 validators UNTRACKED; GitHub runs HEAD 181-lane** | **verified**; GOV §5.7, §7 |
| Constitution stack (7 rewrite docs) | YES | n/a | n/a | YES | **WT-only, untracked, zero history** | GOV §3.1; ARCH §3.2 |
| Root `AGENTS.md` (governance law) | YES | n/a | n/a | YES | main/HEAD=scan-generated; **WT=AGENTS_V2 (modified, uncommitted)** | **verified** |
| `EXECUTION_LEDGER.md` + `SKIPPED_HUMAN_DECISIONS.md` (22 SKIP) | YES | n/a | n/a | YES | **WT-only, untracked** | verified; GOV §4.1 |
| `docs/archive/**` (865 files) | YES | n/a | n/a | reference | mixed: **468 tracked; 8 newest dirs 100% untracked** | **verified** |
| 67 generated "intelligence" docs (`docs/*/README.md`, `docs/architecture/*`) | YES | NO (generator exits 1) | n/a | reference (false) | all (frozen falsehoods) | ARCH §1.4 |
| GraphQL surface (3,941 ln) | YES | YES (gated) | YES but **prod-dark** (`FEATURE_GRAPHQL=false`) | NO in prod | all | **verified**; CODE §1.8 |
| Extensions surface (1,123 ln) | YES | YES (gated) | YES but **prod-dark** (`FEATURE_EXTENSIONS=false`) | NO in prod | all | **verified** |
| Liquid renderer (strategic winner) | partial (TS string literals, 0 `.liquid` files) | YES (canary OFF) | YES but **prod-dark** (`FEATURE_LIQUID=false`, flag decorative) | NO | all; engine changes WT-only | THEME §1,5,9 |
| React renderer (operative theme) | YES | YES | YES | YES | all — the live storefront | THEME §2 |
| Previous-product cluster (portfolio/resume/ATS/gallery) | YES | YES (mounted `index.ts:738-739`) | YES | YES (dead product, live route) | all | **verified**; CODE §9 |
| multi-region/CQRS/distributed config (7 `config/runtime/*` + 154 deleted pkg files) | config YES; **code deleted in WT** | NO | NO | NO | HEAD has pkgs; WT deletes them | ARCH §4.3; CODE §1.5 |
| `chaos/` + `load/` drill tooling (12 files) | YES (runnable) | YES (`chaos:execute`) | NO | NO | all (kept alive by validator lock) | **verified**; DELETION §B |
| k8s/helm + otel observability | files YES; **cluster GHOST** | NO | NO (otel→deleted cluster) | NO | helm deleted in WT | **verified**; CODE §8; PROD §3.10 |
| Prometheus alert rules (7 metrics) | YES | NO (nothing emits) | n/a | NO | all (alerts on ghost metrics) | PROD §3.10 |
| Step-up authorization (refund/payout/DSR) | YES (mock) | YES | YES | YES (mock theater) | all | IDENT §7 |
| Payout provider client (`initiateTransfer`) | NO (throws unconditionally) | n/a | n/a | NO | all (merchants unpayable) | MONEY §1.6 |
| Reconciliation RPCs | YES (defined) | **NO (0 runtime callers)** | n/a | NO | all (wiring-dead) | MONEY §1.9, §5 |
| OIDC/OAuth | 501 skeleton | NO | n/a | NO | all | IDENT §1; PROD §8 C10 |

---

## 4. Truth-vs-Paper Matrix

System → exists in code? · in governance? · in prompts? · in docs? → verdict (**REAL** / **PAPER-ONLY** / **GHOST**). REAL = runnable code exists in ≥1 reality. PAPER-ONLY = lives only in governance/docs/prompts/config, no runnable referent. GHOST = referenced by name, referent absent on disk.

| System | Code? | Governance? | Prompts? | Docs? | Verdict |
|---|---|---|---|---|---|
| api-gateway monolith + 3 satellites | YES | YES | YES | YES | **REAL** |
| 5 deployed Next.js apps | YES | YES | YES | YES | **REAL** |
| merchant-app (Flutter) | YES | YES | YES | YES | **REAL** (30/64 reachable) |
| Migration chain / 419-table schema | YES | YES | YES | YES | **REAL** (162–166 untracked) |
| Canonical double-entry ledger kernel | YES | YES | YES | YES | **REAL** (buyer path un-wired) |
| Asymmetric identity sole-issuer | YES (WT) | YES | YES | YES | **REAL** (untracked; verifier `identity-session-verifier.ts` untracked — verified) |
| RLS FORCE + `app_tenant` GUC tenancy | YES (WT) | YES | partial | YES | **REAL** (mig 164 untracked) |
| Constitution / AGENTS_V2 / Canonical Systems | YES (WT docs) | YES | YES | YES | **REAL doc** / unratified (SKIP-GATE1) |
| 90-validator governance gate | YES (WT) | YES | YES | YES | **REAL** (passes; GitHub runs HEAD 181-lane) |
| React theme renderer | YES | YES (frozen winner-loser) | YES | YES | **REAL** (the live storefront) |
| Liquid theme renderer | partial | YES (ratified winner) | YES | YES | **REAL-but-incapable** (no `.liquid` files, no header/footer/data-binding) |
| Frozen-four web apps | YES | "frozen/pending" | "edit these" (stale prompts) | YES | **REAL-but-out-of-prod-matrix** |
| Previous-product portfolio/resume/ATS | YES (mounted) | not in canon | residual | residual | **REAL-but-DEAD-product** |
| GraphQL / Extensions surfaces | YES | gated | YES | YES | **REAL-but-prod-dark** |
| Multi-region / 4-region topology | **NO** (config only) | **YES (validator-mandated)** | YES | YES (theater docs) | **PAPER-ONLY** (+ self-block) |
| CQRS / distributed runtime / projection-runtime | deleted in WT (154 files at HEAD) | YES (runtime-composition-governance) | YES | YES | **PAPER-ONLY** (rejected) |
| Reserved service fleet (6 services) | **NO** (2-file manifests) | YES (canon "reserved") | YES (blueprints "activate") | YES | **PAPER-ONLY** |
| Reserved mobile apps (shopper/operator) | **NO** (2-file) | YES ("reserved") | YES | YES | **PAPER-ONLY** |
| Survivability / chaos / failover / replay contracts | tooling-only (no real targets) | **YES (validator-required)** | YES | YES | **PAPER-ONLY** |
| k8s/helm + otel observability cluster | files only | YES | YES | YES | **PAPER-ONLY** (cluster GHOST) |
| Prometheus alerting / error-tracking / paging | **NO** (no emitters, no SDK) | implied | YES | YES | **PAPER-ONLY** (no detection exists) |
| WASM extension runtime | **NO** | "Never-Build" | **YES** (`13-final-architecture-blueprint.md`) | YES | **PAPER-ONLY** (prompt activates a forbidden system) |
| `_GOVERNANCE_SPINE.md` (cited 26×) | **NO FILE** | cited as anchor | — | — | **GHOST** (verified absent) |
| `packages/typescript/utils` (tsconfig:68) | **NO DIR** | — | — | — | **GHOST** (verified absent) |
| `services/identity-platform` (AGENTS.md:73) | **NO DIR** (it's `apps/`) | mis-cited | — | — | **GHOST** |
| `checkout.letbuyy.com` dedicated runtime | **NO** (`checkout-runtime` = 2 files) | prod var sets origin | — | — | **GHOST** (origin set, no owner) |
| `stream/letbuyy-foundation-v2` + `stream/…ui` merge targets | **NO BRANCHES** | `MERGE_RUNBOOK.md` directs into them | — | — | **GHOST** |
| otel `*.letbuyy-observability.svc.cluster.local` | **NO CLUSTER** | otel-collector exports to it | — | — | **GHOST** |
| `FORENSIC_REPORT/*` rows (docs/conflicts, future-roadmap) | **NO** (paths moved) | enumerated | — | YES | **GHOST refs** |

---

## 5. Dead / Abandoned / Unreachable Census

Code/docs/screens/config that exist and (in many cases) still wire into live runtime but serve no current user or purpose. (Counts verified this phase where marked; else prior-report cited.)

| # | Dead artifact | Scale | Live-routed? | Evidence |
|---|---|---|---|---|
| 1 | Previous-product portfolio/resume/ATS platform | gateway `/portfolio`+`/resume` routers (`index.ts:738-739`, **verified**) + 8 MCP pages + BFF allowlist + DB tables (`portfolio_projects`, `resume_versions`, `gallery_items`, `skill_endorsements`) + `site_type` enum still `{store,portfolio,resume,landing_page,blog}` (`000:9713`, **verified**) | **YES — live mounts** | CODE §1.9, §9; DB §6 |
| 2 | 67 generated "intelligence" docs | `docs/*/README.md` tree + `docs/architecture/{master-system-intelligence,README}.md`; `letbuyy.store` hosts, "19 migrations", deleted packages; generator exits 1 by design | reference (false) | ARCH §1.4 |
| 3 | 77 theater validators | tracked-as-deleted (187 tracked − 133 disk = **54 net delta after +23 new**; 77 deleted incl. CRDT/replay/failover/durable-object) — preserved only in git history | n/a | **verified delta**; GOV §7.1 |
| 4 | 69 theater test files | archived to `docs/archive/validator-theater-tests-2026-06-10/` (untracked) | n/a | DELETION §H |
| 5 | 34/64 unreachable mobile screens | incl. KYC, 2FA, returns, the 1,800-line theme editor; entry points absent (the `editor tab` lands on Settings); `/features/*` catalog deleted in WT (**0 found, verified** — was 36 lying-mapping routes at HEAD) | NO | MOBILE §1.1, §4; verified |
| 6 | Dead mobile theme-editor generation | `theme_screen.dart` (631L) + `section_editor_screen.dart` (1,200L) + 12 editor widgets; historically strongest surface, zero construction sites | NO | MOBILE §1.2 |
| 7 | Never-mounted GoRouter system | `lib/app/deep_link_router.dart` + `go_router ^17.0.0` dep; tests-only consumer | NO | MOBILE §1.10 |
| 8 | 11 orphan validators | `contracted-domain-event-ingress`, `custom-domain-abuse-screening`/`-reconciler`, `gateway-events-client`, `mobile-domain-parity`, `no-orphan-webhook-delivery-queue`, `observability-producer`, `registrar-provider`, `replayable-secret-persistence`, `shopper-identity-seam`, `vercel-domain-automation` — referenced by nothing | n/a | GOV §7.1; DELETION §G |
| 8b | Dead reconciliation wiring | `refresh_/assert_money_ledger_site_reconciliation` + `backfill_wallet_ledger_to_canonical` — **0 runtime callers**; wallet 409s forever | n/a (DB) | MONEY §1.9, §5, §4.4 |
| 9 | otel→deleted k8s cluster | `otel-collector.yaml:29,33` export to `tempo./loki.letbuyy-observability.svc.cluster.local` (**verified**); cluster deleted from repo | NO target | PROD §3.10 |
| 10 | Prometheus rules on ghost metrics | 7 metrics nothing emits; no error SDK; no paging channel anywhere | NO | PROD §3.10 |
| 11 | Demo residue | `apps/storefront-runtime/src/app/demo/urban-kicks/` (live-routed); `firebasestorage.googleapis.com` remotePattern still whitelisted in `next.config.ts` | YES (demo) | CODE §5 |
| 12 | Production-dark surfaces | GraphQL (3,941 ln) + Extensions (1,123 ln) ship behind `=false` in prod; Liquid path dark + `FEATURE_LIQUID` decorative (no gate constructed) | NO in prod | **verified**; CODE §1.8; THEME §5 |
| 13 | Empty husks | `legacy/` (0 files), `tests/projections/`, `docs/mobile-migration-blueprint/`, `.codex/` + `.codex-dev.log` (0 bytes) | NO | DELETION §4 |
| 14 | Machine-local cache residue | root `build/` (161 MB), `.dart_tool/`, `.tmp/`, `test-results/`, `.pnpm-store/`, `.turbo/`, `.DS_Store ×3` | NO | DELETION §4 |
| 15 | Stale `stash@{0}` from a deleted branch | waits to splice the old regime back in | n/a | GOV §6#9 |

---

## 6. Placeholder / Scaffold / Dormant Census

Exists by design as a seam/placeholder, or has full source but is intentionally out of the production matrix.

| # | Placeholder/Scaffold | State | Evidence |
|---|---|---|---|
| 1 | 6 reserved services | **2 files each** (`AGENTS.md` + `runtime.manifest.json`), manifests sed-garbled (11 "service-local event helpers" repeats in checkout-runtime, **verified**); cite theater governance as authority | **verified**; CODE §1.4, §9 |
| 2 | 2 reserved mobile apps | shopper-app + operator-app = 2 files each; `pubspec.yaml` `run:super_admin` melos script targets the sourceless operator-app | **verified**; MOBILE §9 |
| 3 | Frozen-four web apps | full source (app-marketplace 93, theme-marketplace 68, platform-operations-portal 34, developer-portal 22 TS/TSX — **verified**); `staging-deploy.yml` deploys 3; `config/vercel/projects.json` declares production project rows for all 9 apps including these 4 | **verified**; CODE §1.3, §3 |
| 4 | `SKIP_NEEDS_HUMAN_*` in prod vars | **29 occurrences** in prod wrangler vars; api-gateway live values: `AI_PROVIDER_MODEL`, `AI_CREDIT_RAZORPAY_KEY_ID`, `WHATSAPP_WEBHOOK_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_WHATSAPP_FROM` (255-267) | **verified** |
| 5 | OIDC/OAuth | 501 skeleton; published JWKS endpoint serves a disabled placeholder key while real keys are env-injected | IDENT §1; PROD §8 C10 |
| 6 | Step-up authorization | mock: `security.ts` mints `mock-step-up-${uuid}` pre-verified; verify = length ≥12 + timestamp; the validator allowlists the mock | IDENT §7 |
| 7 | Payout rail | `razorpay_route` PA-split is the winner but **no provider client exists**; `initiateTransfer` throws; razorpayx enum residue in 11 files (**verified**) | **verified**; MONEY §1.6, §7 |
| 8 | 22 SKIP-* human seams | `SKIPPED_HUMAN_DECISIONS.md` (**verified count**): live-provider keys, DNS cutover, identity keypairs, PITR tier, Sentry DSN, RLS probes, money reconciliation, prod-deploy promotion | **verified**; GOV §4.1 |
| 9 | Liquid sources | zero `.liquid` files on disk — sources live as TS string literals; 5,000-char `template_config` cap vs 200 KB bundle cap; one index-only template; no header/footer | THEME §3.3, §9 |
| 10 | Dev in-memory auth | gateway `localAuthSessions` in-memory Map (dev-only session store) | IDENT §3 |

---

## 7. Paper-Only & Ghost Systems (on-paper / governance / prompts / docs but NOT in code) — and the inverse

### 7a. PAPER-ONLY — exists only in governance/docs/prompts/config

| System | Where it "exists" | Code reality | Evidence |
|---|---|---|---|
| Multi-region / 4-region topology | `production-topology.json:34-36` `globalRegions:[india,apac,eu,us]` (**verified**); `multi-region-runtime.json` (apac/eu/us namespaces) | one region; namespaces in no terraform/wrangler | **verified**; ARCH §8.1, §8.5 |
| **The survivability self-block** | `whole-repo-end-state-validator.mjs:172-174` + `survivability-governance-validator.mjs:94-107` **machine-mandate** the 4-region/chaos/failover artifacts the Constitution **forbids** (`LETBUYY_CONSTITUTION.md:98,112`) | deleting the rejected arch **fails CI** | **verified**; GOV §5.5; ARCH §1.2 |
| CQRS / distributed runtime | `runtime-composition-governance.md` routes composition through deleted packages; 8 package roots / 154 files | deleted in WT; alive at HEAD only | ARCH §4.3; CODE §1.5 |
| Reserved service fleet | canon "reserved", blueprints "activate the fleet + WASM" (`docs/audit/13-…blueprint.md`) | 6×2-file manifests | **verified**; ARCH §7.3 |
| Survivability/chaos/failover/replay/shadow-traffic | ~16 `docs/governance/*` theater docs + 6 runbooks + `chaos/`+`load/` (12 files, runnable) | no real failover region/replay path | **verified**; GOV §4.2; DELETION §B |
| k8s/helm + otel observability | helm/kubernetes manifests + otel-collector | helm deleted in WT; otel→ghost cluster | CODE §8; PROD §3.10 |
| End-to-end alerting | prometheus rules; "money-reconciliation alerting" as a flag name | zero emitters, no SDK, no channel | PROD §3.10 |
| WASM extension runtime | `13-final-architecture-blueprint.md` (a live prompt) | none; on the Never-Build list | ARCH §7.3 |
| "12-app Canonical Topology" | `docs/governance/repository-topology.md` (no frozen markings) | 8-runtime law (ARCH-R1) | GOV §5.4 |
| Scan-generation playbook | `tasks/todo.md` + `memory/lessons.md` (2026-03-01) record it "completed"; AGENT-R16 mandates reading them | the generator exits 1 by design | PROMPT §4.6 |
| `CLAUDE_OPUS_MASTER_PROMPT.md` prompt factory + 6 paste-ready relaunchers | `docs/Codex_waves/` (committed, live) | manufactures the rejected worldview | PROMPT §3.3 |
| `MERGE_RUNBOOK.md` procedure | directs merging two `stream/*` branches into `develop` | both branches gone (GHOST targets) | GOV §6#1 |

### 7b. GHOST — referenced by name, referent absent on disk (verified this phase)

| Ghost ref | Cited where | Verified absent |
|---|---|---|
| `_GOVERNANCE_SPINE.md` | **26×** across 5 of 7 canonical rewrite docs (authority anchor) | **YES — file does not exist anywhere** |
| `packages/typescript/utils` | `tsconfig.workspace.json:68` project reference | **YES — dir absent (breaks `tsc -b` in all states)** |
| `services/identity-platform` | `AGENTS.md:73` names it runtime #4 | **YES — it's `apps/identity-platform`** |
| `checkout.letbuyy.com` runtime | gateway prod `CHECKOUT_ORIGIN` (line 273) | **YES — `checkout-runtime` is a 2-file manifest** |
| otel observability cluster | `otel-collector.yaml:29,33` | **YES — `*.letbuyy-observability.svc.cluster.local` deleted** |
| `stream/letbuyy-foundation-v2`, `stream/…ui` | `MERGE_RUNBOOK.md` | **YES — branches do not exist** |
| `FORENSIC_REPORT/*` rows | `docs/conflicts/`, `docs/future-roadmap/` | YES — paths moved |

### 7c. The inverse — exists in CODE but NOT in governance/docs (undocumented live behavior)

- **Previous-product live routes** (`/portfolio`, `/resume`) are mounted in production code but appear in **no** canon system list — undocumented live attack/behavior surface (**verified**; CODE §9).
- **Raw-REST service-role bypass** (`packages/infrastructure/supabase-adapter/index.ts:65-150`) fetches with the service-role key, bypassing the tenant Proxy guard — the 664-site `getSupabaseAdmin()` norm is the operative access plane, not the documented `withTenantTx` winner (IDENT R5).
- **`confirm_order_payment_with_ledger`** — the buyer-path money function — writes only `payment_transactions`, **no** canonical ledger lines (**verified** lines 1590-1660); the name asserts behavior the code does not perform; no doc flags this (MONEY §2a).
- **Signature-only Razorpay storefront verify** never fetches capture status/amount; undocumented authorized-not-captured → "paid" path (MONEY §8).
- **`merchant_payable` triple-writer** (capture + commission-reconcile + self-declared settlement) with no cross-source dedup; payout gross derives from `orders.total`, not the ledger — undocumented double-credit surface (MONEY §1.5).

---

## 8. Three-Realities Table (the 6 load-bearing domains)

One-line `main` / `HEAD` / `working-tree` state per domain. Winner = working tree in every row (per `_PREMISES_SEED.md` spine). All file-level states below were **verified this phase**.

| Domain | `main` (deployable, condemned) | `HEAD` (+30) | working tree (hardened winner) |
|---|---|---|---|
| **Governance** | scan-generated `AGENTS.md` ("Master Engineering Constitution", 2026-06-08 generator) + 39 nested scan files + 181-validator lane | identical scan law; 181-validator lane (GitHub runs this) | hand-authored AGENTS_V2 + Constitution stack (untracked) + 90-validator gate; self-block reborn |
| **Identity** | `/api/auth/switch` mints a session for any `email_verified` user (takeover); gateway `randomHex(32)` sessions; shared `AUTH_SECRET` HS256 | same takeover + HS256 family | asymmetric ES256/EdDSA sole-issuer; `identity-session-verifier.ts` **untracked**; switch fix WT-only |
| **Money** | commission `?? 300` (3% rake); no payout double-release guard; razorpayx self-custody default; capture un-ledgered | commission `?? 300`; guard present (mig 160); razorpayx default | commission `?? 0` (mig 162, untracked); 165 atomic COD untracked; capture still un-ledgered (survives merge) |
| **Themes** | React renderer live; regex sanitizer; Liquid path absent/dark | React live; regex sanitizer | React live (frozen winner-loser); Liquid canary OFF + decorative flag; DOMPurify; Liquid still incapable of a real store |
| **Tenancy** | PUBLIC `USING(true)` anon leaks on 11+ tables; everything runs service_role (no `app_tenant`) | same leaks; service_role plane | RLS FORCE + `app_tenant` GUC (mig 163/164, **untracked**); 25 residual PUBLIC policies survive even here |
| **Deployment** | branch is the only deploy trigger; staging deploys 3 frozen apps; `projects.json` declares 9 prod projects | HEAD 9-app prod matrix; staging frozen-3 | 5-Vercel + 4-worker matrix (correct) but **uncommitted**; GitHub still runs HEAD's matrix; `globalRegions` self-block in config |

---

## 9. Unknowns / UNVERIFIED (out of audit scope)

Marked UNVERIFIED because they require live infrastructure, database, provider, or CI-history access the audit envelope excludes. None can be resolved by read-only git.

| Unknown | Why UNVERIFIED | Bearing |
|---|---|---|
| Live Vercel project/deploy state for the 9 declared `projects.json` rows | needs Vercel API | whether frozen-four are actually live in prod |
| Live Cloudflare worker deploy state + which crons are actually scheduled | needs Cloudflare API | whether the `*/15` + 6h crons run |
| Live Supabase: applied migration ceiling, `pg_stat_user_tables` for dead tables, RLS policy state, function EXECUTE grants | needs DB connection | whether 162–166 are applied; whether anon leaks are closed; whether `backfill_*` is PUBLIC-callable |
| Live payment/ESP/DNS/FCM provider provisioning behind the 29 `SKIP_NEEDS_HUMAN_*` + 22 SKIP-* seams | needs provider consoles | whether merchant login / checkout / payouts function in prod |
| GitHub Actions run history — which lane last executed, pass/fail | needs Actions API | whether the HEAD 181-lane currently passes (the master notes its orchestrator would crash on this tree — 77 of its validators are deleted files) |
| Whether the published JWKS URL currently serves the disabled placeholder or real keys | needs live fetch | identity verification in prod |
| Live `checkout.letbuyy.com` DNS/cert attachment vs the empty reserved root | needs DNS | whether prod checkout URLs resolve |

---

## 10. Net Verdict

The repository's **content** is the best LetBuyy has ever had — a real monolith, a real ledger kernel, a credible asymmetric identity and FORCE-RLS tenancy, a passing 90-validator gate, and a coherent constitutional layer — but **none of the correct reality is committed**, the deploy branch ships the condemned one, and the surrounding tree is thick with paper-only systems (multi-region, CQRS, reserved fleet, survivability/chaos, dead observability), ghost references (`_GOVERNANCE_SPINE.md`, `packages/typescript/utils`, the otel cluster), and dead-but-live-routed product residue (portfolio/resume). The new law even **machine-mandates the rejected multi-region architecture it forbids**. Headline census: **~22 REAL · ~14 PAPER-ONLY · ~9 GHOST systems**, with hundreds of dead artifacts. The single highest-risk object is the uncommitted state itself: one `git clean -fd` destroys the entire correct reality, which has zero history on any branch. Carried scores: health **3.1/10**, as-deployable **2.3/10**, working-tree end-state **5.5/10**.

*End of Phase 1 — Repository Truth Report. Discovery only; no implementation, no architecture, no codex prompts.*
