# PROMPT DRIFT — Convergence Report (Phase 6)

**Program:** Convergence Audit 2026-06-10 · **Phase:** 6 — PROMPT DRIFT · **Mode:** Discovery only (no code/architecture/prompt changes; read-only git).
**Repo state:** branch `stepup/main`, HEAD `5cf9e64e` ("fix(foundation): resolve final audit drift"), working tree dirty (`78 ?? / 512 D / 410 M` per `git status --porcelain`).
**Inputs:** `_PREMISES_SEED.md` (winner spine) + the prior `REPOSITORY_TRUTH_AUDIT_2026_06_10/PROMPT_DRIFT_REPORT.md` (verified findings reused and re-confirmed). All paths repo-relative to `/Users/saai_sidd/Git/Letbuyy_Store`.

**This report's job:** produce the three exhaustive lists the user demanded — **ARCHIVE LIST**, **DELETE LIST**, **CANONICAL PROMPT LIST** — each with path + reason, and render the registry-gap verdict. It carries forward the prior report's verified citations and **closes two completeness gaps the prior report missed**: the `docs/audit/` (19 files) and `docs/audits/apps-platform/` (23 files) prescriptive blueprint/refactor-roadmap programs, which are tracked-clean, off-canon, and were never inventoried.

---

## 1. Executive Summary

1. **The prompt corpus is governed by a one-perimeter rule: root is policed, `docs/` is not.** The D11/D13 cleanup archived ~61 root markdown artifacts into untracked `docs/archive/root-governance-2026-06-10/`, and `whole-repo-end-state-validator.mjs:16-46` enforces a **7-file root markdown budget** + pins exactly one archived prompt (`docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md`). Below root, nothing is enforced. The corpus is a documented evasion: `CODEX_INTERNAL_OS_FOUNDATION_STATUS.md:20` says its files were placed under `docs/` *"because root `CODEX_INTERNAL_OS_FOUNDATION_*` files are rejected by `source-ledger-residue-validator`."*

2. **The dangerous-prompt count rises from ~12 to ~24** once the two blueprint programs are counted. Confirmed rejected-package list (`governance-common.mjs:142-150`): `packages/{app-engine, application-services, distributed-runtime, extension-host, orchestration, projection-runtime, runtime-composition}` — **all seven verified gone from disk**. Confirmed frozen apps (CLAUDE.md + AGENTS.md `DEPLOY-R2:331`, `ARCH-R4:86`): `apps/{app-marketplace, developer-portal, theme-marketplace, platform-operations-portal}` + six reserved services manifest-only. At least 24 live prompts/blueprints, executed today, would reintroduce a rejected package, build/deploy a frozen app, activate a reserved service, re-poison CI with the banned `*.letbuyy.store` domain, or design the formally-rejected (ADR-021/ENV-R2) Shopify maximalist end-state.

3. **Two whole prescriptive programs the prior report missed are the largest at-large danger surface.** `docs/audit/` (19 docs) and `docs/audits/apps-platform/` (23 docs) — **42 tracked-clean files** — are audit-plus-build programs. Their descriptive halves are benign-but-stale; their prescriptive halves (refactor plans, "target architecture," "final architecture blueprint," "new-services-to-build," 0–12 implementation roadmaps) **build on `packages/app-engine`/`extension-host` (rejected), build out `apps/developer-portal` (frozen), activate `services/media-service` (reserved), and design the Shopify-OS-2.0 end-state**. They are NOT paste-ready `/goal` prompts, so they are lower-velocity than the Codex_waves missions — but as written law-for-a-build they are off-canon and must be archived, not kept as live plans.

4. **The single highest-leverage artifact remains the prompt factory** `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md`: a meta-prompt that, pasted into claude.ai with `docs/Codex_waves/` attached, **mass-generates new Codex missions** seeded with the rejected-package worldview (`:97-107` declares the 6 rejected packages "✅ Stable"). It manufactures violations rather than committing one.

5. **The live instruction loop still reads 2026-03-01 fossils.** Root `AGENTS.md` AGENT-R16 mandates reading `memory/lessons.md` + `tasks/todo.md` before any edit; both are dated 2026-03-01, describe two-generations-dead topology (`backend/workers/api`, `apps/web/consumer/admin`), and `tasks/todo.md:9-13` records "generate root AGENTS.md from repository scan" as the completed playbook — the exact pattern PHASE-A-HARD-002 + `no-scan-generated-agents-validator` now forbid. `LEG-078` sentences `memory/lessons.md` to DELETE while AGENT-R16 mandates reading it: **a live self-contradiction in the canon.** A parallel stale agent-OS at `docs/agents/` (43 tracked files) self-declares its own "Mandatory Reading Order" and instructs regenerating intelligence via the retired generator.

6. **There is NO prompt registry and NO surviving canonical *execution* prompt — the convergence gap.** Nothing indexes the corpus. The only machine-known prompt is the archived `CODEX_MASTER_IMPLEMENTATION_PROMPT.md` (the prompt that *drove* Phases A–D13, now correctly retired to archive). After convergence there is no living "how to execute the next wave" prompt and no registry to prevent the `docs/` dumping ground from refilling. Canonical *law* survives (AGENTS.md, CLAUDE.md, EXECUTION_LEDGER.md, SKIPPED_HUMAN_DECISIONS.md); canonical *execution instruction* does not.

7. **Archive completeness verdict: INCOMPLETE.** Root = complete & validator-pinned **but the entire archive + validators + ledgers are untracked** (a `git clean -fd` destroys them; a `git checkout .` resurrects all 61 root artifacts at HEAD). `docs/` = ~100 mission/blueprint files at large, unarchived, unregistered, no LEG rows. History = ≥6 prompts git-history-only with no archive copy.

---

## 2. Method

- **Re-glob** of the working tree for `*PROMPT* *MISSION* *CODEX* *BLUEPRINT* *WAVE* *TERMINAL_*` across root + `docs/` (full `find`, excluding `node_modules`/`.git`) — see §3 inventory.
- **Tracked-status classification** of every cluster via `git status --porcelain -- <path>` (tracked-clean / modified / deleted-at-HEAD `D` / untracked `??`).
- **Canon confirmation:** read `scripts/validators/no-rejected-package-imports-validator.mjs` + `governance-common.mjs:142-150` (rejected-package list), `whole-repo-end-state-validator.mjs:16-54` (root budget, pinned archive, rejected-root deletion asserts), and `AGENTS.md` (`AUTH-R2`, `ARCH-R1/R4/R5`, `ENV-R2`, `NEVER`, `DEPLOY-R2`, `THEME-R1`, `AGENT-R16`) + `CLAUDE.md` frozen/deprecated lists.
- **Disk verification:** confirmed all seven rejected `packages/*` roots are **gone** (`[ -e ] → gone`).
- **Danger re-scan** of every non-archived prompt for: rejected packages, CQRS/event-bus/event-sourcing/multi-region, frozen apps as build/deploy targets, reserved-service activation, `letbuyy.store` literals, commission/rake, RazorpayX self-custody — and a paste-ready-`/goal` check to grade velocity.
- **Line-accurate re-verification** of the prior report's 9 headline DANGEROUS citations (all still hold; quoted in §4).
- **New-cluster deep-read:** `docs/audit/` (19), `docs/audits/apps-platform/` (23), `docs/research/shopify-product-intelligence/` (6 BLUEPRINTs), `docs/auth/2026-06-08-*` + `2026-06-09-*` blueprints/wave plans — none inventoried by the prior report.

---

## 3. Full Inventory & Classification

**Classes:** **ACTIVE** (live instruction/law) · **OBSOLETE** (mission complete/superseded, not canon-violating) · **DANGEROUS** (would violate ratified canon if executed/followed today) · **ARCHIVED-OK** (under `docs/archive/`, historical record per AUTH-R2).
**Location-now:** WT = tracked-clean working tree · WT-?? = untracked · WT-M = tracked-modified · HEAD-only = deleted in WT but present at HEAD · HIST = git-history-only.

### 3.1 Root + dot-dirs + tasks/ + memory/ (the live loop)

| Artifact | Location-now | Class | Reason / Evidence |
|---|---|---|---|
| `AGENTS.md` | WT-M | **ACTIVE** | Promoted hand-authored V2 law; AUTH-CHAIN DOC 02; `AGENTS.md:1-11`. **CANONICAL — keep.** |
| `CLAUDE.md` | WT-M | **ACTIVE** | Governance pointer → AGENTS.md → Constitution. **CANONICAL — keep.** |
| `EXECUTION_LEDGER.md` | WT-?? | **ACTIVE** | Required verbatim by `whole-repo-end-state-validator.mjs:122-144` (18 action-IDs). **CANONICAL — keep + commit.** |
| `SKIPPED_HUMAN_DECISIONS.md` | WT-?? | **ACTIVE** | Validator asserts 19 SKIP-IDs (`:146-169`). **CANONICAL — keep + commit.** |
| `EXECUTABLE_HUMAN_REQUIRED.md`, `MERGE_RUNBOOK.md`, `README.md` | WT | **ACTIVE** | In `allowedRootMarkdown` (`:16-24`). **CANONICAL — keep.** |
| `tasks/todo.md` | WT | **ACTIVE + DANGEROUS** | Mandated by AGENT-R16; dated 2026-03-01; `:9-13` records the now-forbidden scan-generate-AGENTS playbook; references `console.letbuyy.store` + `packages/app-engine`/`application-services`. **REWRITE-or-ARCHIVE + amend AGENT-R16.** |
| `memory/lessons.md` | WT | **ACTIVE + DANGEROUS (stale)** | Mandated by AGENT-R16; 2026-03-01; every anchor is dead topology (`backend/workers/api`, `apps/web/consumer/admin`); Lesson 36 maintains the retired generator. **LEG-078 sentences it to DELETE while AGENT-R16 mandates reading it.** **REWRITE-or-ARCHIVE + resolve LEG-078/AGENT-R16.** |
| `tasks/env-setup-skips.md` | WT | OBSOLETE (log) | "Generated by Codex env-setup agent"; pure skip-log; generating mission not in repo (§7). Fold into SKIPPED_HUMAN_DECISIONS or keep as log. |
| `tasks/executable/001…016` | HEAD-only (`D`×16); copies at `docs/archive/build-missions/executable/` (WT-??) | **ARCHIVED-OK** | LEG-074 ARCHIVE executed; commit the move. |
| `.codex/` (empty), `.codex-dev.log` (0 bytes, gitignored) | WT | noise | Not prompts. **DELETE.** |
| `.claude/settings.local.json` | WT-?? | tool-config | Local Claude Code permission allowlist; not a prompt. Keep local / gitignore. |

### 3.2 Root prompt/ledger/status deleted at HEAD (the D11 sweep) — all ARCHIVED-OK pending commit

| Artifact group | Location-now | Class | Reason |
|---|---|---|---|
| 23 root `CODEX_*` + ~60 root governance/audit docs + `LETBUYY_INVESTOR_DECK_PROMPT.md` + 12 prior-audit dirs | HEAD-only; archived copy WT-?? `docs/archive/root-governance-2026-06-10/` (+ `directories/`) | **ARCHIVED-OK (pending commit)** | `git status` root-deletion list matches archive `ls` 1:1; `whole-repo-end-state-validator.mjs:43-46` asserts the dir exists. **Entire archive is untracked — commit to make durable.** |

### 3.3 `docs/Codex_waves/` — 26 tracked-clean files (largest at-large *paste-ready* cluster)

git status: tracked, unmodified. Era: 2026-06-05/06 wave program (pre-rewrite). 6 of these are paste-ready `/goal` terminal relaunchers.

| Artifact | Class | Reason (offending citation) |
|---|---|---|
| `LETBUYY_MASTER_EXECUTION_BLUEPRINT.md` | **DANGEROUS** | `:40-45` declares 6 rejected packages "✅ Stable"; `:59` `services/event-bus` as runtime. |
| `LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md` | **DANGEROUS** | `:139` "Own ONLY `apps/developer-portal/**` (create it) … Scaffold developers.letbuyy.store" (frozen app + dead domain). |
| `CLAUDE_OPUS_MASTER_PROMPT.md` | **DANGEROUS (prompt factory)** | `:6` attach whole `Codex_waves/` to claude.ai; `:97-107` rejected packages "Stable"; `:392` spawns WS10 dev-portal mission. **Highest leverage.** |
| `CODEX_EXTENSION_PLATFORM_MISSION.md` | **DANGEROUS** | `:5` "a new `packages/extension-host/**` + `packages/app-engine/**`"; `:54` "OWN: packages/extension-host/** (create)" — two rejected packages. |
| `CODEX_THEME_BLOCK_ENGINE_MISSION.md` | **DANGEROUS** | `:54` renderer pulls app-blocks "from `app-engine`/`/v1/app-store`" — rejected package + frozen-app surface. |
| `CODEX_DEVELOPER_ECOSYSTEM_MISSION.md` | **DANGEROUS** | `:7,31-32` documents `app-engine` contracts; `:51-58` "Build developers.letbuyy.store" (frozen app + dead domain). |
| `TERMINAL_5_WS10_DEVPORTAL.md` | **DANGEROUS (paste-ready)** | `:4` "Owns ONLY: apps/developer-portal/** (a NEW Next.js app to create)"; `:24` "scaffold developers.letbuyy.store". |
| `CODEX_MASTER_SEQUENTIAL_MISSION.md` | **DANGEROUS** | `:47,68` STAGE 9 executes the dev-ecosystem mission (developers.letbuyy.store, extension SDK). |
| `CODEX_LAUNCH_PLAYBOOK.md` | **DANGEROUS (paste-ready)** | `:122-129` paste-ready relaunch of the dev-portal terminal. |
| `CODEX_ENV_CLEANUP_MISSION.md` | **DANGEROUS** | `:34` "Rewire `.github/workflows/*` … against `*.staging.letbuyy.store`" — banned `.store` in active CI (LEG-077, TEST-R7). |
| `CODEX_MOBILE_PARITY_MISSION.md` | **DANGEROUS/OBSOLETE** | `:65-66` pins `api.staging.letbuyy.store` + `api.letbuyy.store`; catalog removed by D8, LEG-072 delete-target. |
| `CODEX_LETBUYY_REMEDIATION_MISSION.md` | **DANGEROUS/OBSOLETE** | `:49` scales "the existing (correct) architecture" (= pre-V1 drift); `:152` references nonexistent `Codex_waves/REMEDIATION_GOAL.txt`. |
| `CODEX_PRODUCTION_HARDENING_MISSION.md`, `CODEX_API_GRAPHQL_MISSION.md`, `CODEX_DESIGN_SYSTEM_MISSION.md`, `CODEX_MERCHANT_UX_MISSION.md`, `CODEX_MARKETPLACE_UX_MISSION.md`, `CODEX_STOREFRONT_MISSION.md`, `CODEX_OPERATIONS_MISSION.md`, `CODEX_IDENTITY_MARKETING_MISSION.md`, `CODEX_SETTINGS_ARCHITECTURE_MISSION.md` | OBSOLETE | June-05/06 wave missions, executed; ledgers archived at `docs/archive/root-residue/2026-06-05-foundation-hardening/`; reference archived companions at dead root paths. |
| `TERMINAL_1_WS7_PRODUCTION.md`, `TERMINAL_2_WS1_DESIGNSYSTEM.md`, `TERMINAL_3_WS9_SETTINGS.md`, `TERMINAL_4_WS5_OPERATIONS.md`, `TERMINAL_6_WS8_MOBILE.md` | OBSOLETE (paste-ready relaunchers) | Each carries a "PASTE THIS INTO CODEX /goal" block — re-execution one paste away. |

### 3.4 Other at-large prompts/blueprints under `docs/` (tracked unless noted)

| Artifact | Class | Reason (offending citation) |
|---|---|---|
| `docs/CODEX_LETBUYY_FOUNDATION_MISSION.md` | **DANGEROUS** | `:44` "Active runtimes (edit these): … `apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace`, … `apps/platform-operations-portal`" (4 frozen apps as active); `:56-58` maintain `CODEX_LETBUYY_FOUNDATION_LEDGER.md` "at repo root" — breaches the root-markdown budget. |
| **`docs/audit/` — 19 files (NEW; prior report missed)** | **DANGEROUS (prescriptive program) / OBSOLETE (descriptive halves)** | `13-final-architecture-blueprint.md:3` end-state = "LetBuyy as a Shopify-OS-2.0-class SaaS" (= ADR-021/ENV-R2 formally rejected maximalism); `18-new-services-to-build.md` plans new services (vs ARCH-R4 six-reserved-manifest-only); `10-app-extension-spec.md`/`06-storefront-runtime-replacement-plan.md`/`12-api-refactoring-roadmap.md`/`14-migration-roadmap.md`/`15-file-refactor-plan.md` are file-by-file build plans for the Shopify end-state. Tracked-clean, no `/goal` (descriptive medium). Descriptive docs (00,01,02,03,04,05,16,17) benign-but-stale. **ARCHIVE the whole program.** |
| **`docs/audits/apps-platform/` — 23 files (NEW; prior report missed)** | **DANGEROUS (prescriptive program) / OBSOLETE (descriptive halves)** | `09-refactor-plan-file-by-file.md:46-50` refactors `packages/app-engine` + `packages/extension-host` (rejected); `13-storefront-runtime-integration-blueprint.md:30,67` `cdn.letbuyy.store` CSP + extension-host frame component; `15-partner-platform-blueprint.md:3,23` build out `apps/developer-portal` (frozen); `19-runtime-ownership-blueprint.md:20,23,26,29` keeps extension-host as live host + **ACTIVATE media-service / charter event-bus + checkout-runtime** (vs ARCH-R4/R5); `21-implementation-roadmap.md:14` Phase 2 deletes only 3 of 7 rejected packages then `:16-20` builds on app-engine + activates media-service. Tracked-clean, no `/goal`. **ARCHIVE the whole program.** |
| `docs/LETBUYY_CODEX_IMPLEMENTATION_MASTER.md` | OBSOLETE | `:11` "`AGENTS.md` is canonical" (written for the scan-generated drift law); `:13-16` manages the WS11–WS13 stack behind flags — those packages deleted. |
| `docs/LETBUYY_MASTER_EXECUTION_PLAN.md` + `docs/P0_SECURITY_MASTER.md`, `P1_COST_MASTER.md`, `P2_PERFORMANCE_MASTER.md`, `P3_SCALABILITY_MASTER.md`, `P4_PRODUCT_MASTER.md` | OBSOLETE | "Generated 2026-06-05"; P0-P4 are its children (`P0:3 Parent: LETBUYY_MASTER_EXECUTION_PLAN.md`); same-named successor now archived (DOC-R4 competing-fact). |
| `docs/apps-marketplace-audit/CODEX_APPS_MARKETPLACE_FOUNDATION_MISSION.md`, `…UIUX_MISSION.md` | **DANGEROUS + duplicate** | Build missions for frozen `apps/app-marketplace`; `diff -q` proves both **differ** from same-named archived copies in `docs/archive/prompts/` — competing versions. |
| `docs/apps-marketplace-audit/CODEX_APPS_MARKETPLACE_UIUX_WAVE9_MISSION.md` | **DANGEROUS (paste-ready)** | `:1` "Paste this entire file to Codex … FINISH the LetBuyy Apps Marketplace"; `:107` targets `apps/app-marketplace/src` (frozen). |
| `docs/themes-marketplace-audit/` — 7 missions + 10 ledger/status | **DANGEROUS (missions) / OBSOLETE (ledgers)** | `CODEX_THEME_MARKETPLACE_GA_CLOSURE_MISSION.md:64` "Live DB apply / deploy — applying migrations to prod + deploying" for frozen `apps/theme-marketplace`; tests target `apps/theme-marketplace/tests/`. |
| `docs/developer-platform-audit/CODEX_DEVELOPER_APP_FOUNDATION_PROMPT.md` | **DANGEROUS (paste-ready)** | `:3` "Paste everything below the line into Codex"; `:21-22` "YOU OWN (write freely): `apps/developer-portal/**`" (frozen app). |
| `docs/internal-operating-system-audit/mission/CODEX_INTERNAL_OS_FOUNDATION_{MISSION,LEDGER,STATUS}.md` | OBSOLETE + policy-drift | MISSION `:14` grants full ownership of `apps/platform-operations-portal/**` — PHASE-C resolved the ops console to `apps/platform-console` (EXECUTION_LEDGER `:18`), so it builds the loser; STATUS `:20` documents the **root-validator evasion**. |
| `docs/auth/2026-06-08-identity-platform-transformation/CODEX_IDENTITY_FOUNDATION_STEPUP_{MISSION,LEDGER,STATUS}.md` | OBSOLETE + duplicate | Same mission also archived at `docs/archive/prompts/CODEX_IDENTITY_FOUNDATION_STEPUP_MISSION.md` — competing copies. |
| `docs/auth/2026-06-08-…/LETBUYY_IDENTITY_TRANSFORMATION_BLUEPRINT.md`, `PERMISSION_MODEL.md` | OBSOLETE (report/blueprint) | `.letbuyy.store` appears only as **cookie-domain facts to fix** (`:31,39,173`), not as a write instruction; pre-rewrite identity plan, executed. Archive with the mission set. |
| `docs/auth/2026-06-09-identity-execution-recovery/` (IDENTITY_IMPLEMENTATION_WAVES, WAVE_PROGRESS_LEDGER, IDENTITY_EXECUTION_MASTERPLAN, *_DEBT_REGISTER/REPORT, FOUNDATION_CONSOLIDATION_REPORT) | OBSOLETE (report/wave-plan; mostly WT-??) | `IDENTITY_IMPLEMENTATION_WAVES.md:74` proposes "**multi-region keys**" (= ENV-R2/NEVER), and `IDENTITY_EXECUTION_MASTERPLAN.md:23` "Wave 8 (multi-region)" — aspirational wave plans, not paste-ready prompts; `.store` cited as debt to fix. Report-class; archive or fold into identity-axis. |
| `docs/agents/` — `AGENTS.md` + 21 rule files + `subagents/` 19 briefs (43 files, tracked) | **ACTIVE-claiming + DANGEROUS (stale agent OS)** | `AGENTS.md:7-14` declares its own "Mandatory Reading Order"; "Last source-derived analysis 2026-05-24"; `:22` canonical gateway `backend/workers/api`; `:43` "regenerate repository intelligence" (retired generator); `subagents/admin-agent.md:9` owns `apps/web/consumer/admin` (nonexistent). No validator/live doc cites it; its filename makes it a "local AGENTS.md" under CLAUDE.md precedence. **ARCHIVE entire dir.** |
| `docs/README.md` + topic `README.md`s | OBSOLETE (generated index) | "GENERATED BY scripts/generate-repository-intelligence.mjs ON 2026-06-08"; `docs/database/README.md:103` + `docs/products/README.md:102` cite `docs/Codex_waves/*` as live references. Regenerate or archive (docs axis). |
| `docs/research/shopify-product-intelligence/` — 6 `*_BLUEPRINT.md` + `SHOPIFY_RESEARCH_LEDGER.md` | OBSOLETE (benign research) | Danger re-scan = **0 hits** (no rejected pkg, frozen app, dead domain, `/goal`). Competitive/feature research notes. **KEEP** (or archive as research; harmless). |

### 3.5 `docs/archive/` holdings — ARCHIVED-OK (the historical record)

| Archive | Tracked? | Notes |
|---|---|---|
| `docs/archive/prompts/` (15 files: 12 `CODEX_*_MISSION.md` + `claude-setup-prompt.md` + `repository-intelligence-prompt.md`) | tracked | Includes the 2026-06-07 RECREATED marketplace mission; some differ from at-large copies (§3.4 dedupe). |
| `docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md` | **WT-??** | **The prompt that drove Phases A–D13.** Archival is validator-pinned (`whole-repo-end-state-validator.mjs:38-42`); content conforms to canon ("NEVER design for 100k+/1M+", `:40`). **Commit.** |
| `docs/archive/build-missions/executable/` (16 specs) | WT-?? | LEG-074 executed; commit. |
| `docs/archive/root-residue/{2026-06-05-…,2026-06-06-…,2026-06-07-…,2026-06-08-checkout-…,2026-06-08-executable-…}/` (~70 missions/ledgers/statuses + WAVE reports) | tracked | The Codex_waves missions still point here by OLD root paths (dangling, acceptable as history). |
| `docs/archive/CODEX_CHECKOUT_PLATFORM_BUILD_MISSION.md`, `docs/archive/foundation-stepup-archive-2026-06-10/…` (3 missions) | tracked / WT-?? | D11 archival; harmless inside archive. |
| `docs/archive/root-governance-2026-06-10/` (+ `directories/`) | **WT-??** | §3.2 set + 12 prior audit/program dirs. **Entire archive untracked — commit to make durable.** |
| `docs/archive/{governance-theater-,validator-theater-tests-,infra-deployment-legacy-,firebase-legacy}/` | WT-?? | D11 archival. Note `docs/governance/` still holds rejected-architecture-named docs (`event-store-governance.md`, `distributed-execution-survivability-governance.md`, `chaos-*`) — governance axis. |

### 3.6 Git-history-only prompts (no WT or archive copy)

| Artifact | Last seen | Disposition |
|---|---|---|
| `docs/mobile-migration-blueprint/CODEX_MOBILE_FOUNDATION_EXECUTION_MISSION.md` (+`_V2`), `…MANAGED_PAYMENTS_AND_FINAL_PARITY_MISSION.md`, `CODEX_MOBILE_FOUNDATION_{LEDGER,STATUS}.md`, `FIREBASE_DECOMMISSION_PLAN.md` | deleted in `47f29bc6` (2026-06-06) | Recoverable via `git show 47f29bc6^:<path>`; no archive copy. No action required (history is durable). |
| `AGENT_PROMPT_claude_setup.md`, `CODEX_FOUNDATION_HARDENING_MISSION_V2.md` | HIST | Probable renamed successors exist (`claude-setup-prompt.md`; non-V2 hardening mission) — UNVERIFIED (§7). |

---

## 4. Dangerous Prompt Deep-Dives (offending lines quoted — all re-verified line-accurate)

### 4.1 Rejected-architecture canon still declared "Stable" — `docs/Codex_waves/LETBUYY_MASTER_EXECUTION_BLUEPRINT.md:40-45,59`
```
| `app-engine` | `packages/app-engine` | App/OAuth/Bridge contracts | ✅ Stable |
| `application-services` | `packages/application-services` | Workflow orchestration | ✅ Stable |
| `distributed-runtime` | `packages/distributed-runtime` | CQRS/events/workers | ✅ Stable |
| `orchestration` | `packages/orchestration` | Saga/retry/coordination | ✅ Stable |
| `projection-runtime` | `packages/projection-runtime` | Read models/snapshots | ✅ Stable |
| `runtime-composition` | `packages/runtime-composition` | Query aggregation/cache | ✅ Stable |
| **Event Bus** | `services/event-bus` | Cloudflare Workers | 🟡 Scaffold |
```
All six packages are in `rejectedPackageRoots` (`governance-common.mjs:142-150`) and **verified deleted from disk**; `whole-repo-end-state-validator.mjs:52-54` asserts they stay deleted. Obeying this blueprint recreates the rejected topology.

### 4.2 Mission to CREATE a rejected package — `docs/Codex_waves/CODEX_EXTENSION_PLATFORM_MISSION.md:5`
```
**Domain Ownership:** a new `packages/extension-host/**` + `services/api-gateway` extension/function dispatch routes + `packages/app-engine/**` (extension contracts) …
```
`packages/extension-host` is itself on the rejected list. Execution = direct validator breach + ADR-rejected extension architecture.

### 4.3 The prompt factory — `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md:6,97-107`
```
> **Attach:** The entire `docs/Codex_waves/` folder contents as project knowledge.
- packages/app-engine — App/OAuth/Bridge contracts (✅ Stable)
- packages/application-services, distributed-runtime, orchestration, projection-runtime, runtime-composition, infrastructure — Backend orchestration (✅ Stable)
```
Pasted into claude.ai it **emits new Codex missions** seeded with the rejected-package worldview + reserved services as scaffolds-to-build. It manufactures violations — the single highest-leverage dangerous artifact.

### 4.4 Frozen apps as creation/deploy targets — four independent prompts
- `LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md:139`: `Own ONLY apps/developer-portal/** (create it). … Scaffold developers.letbuyy.store`
- `docs/developer-platform-audit/CODEX_DEVELOPER_APP_FOUNDATION_PROMPT.md:21-22`: `YOU OWN (write freely): apps/developer-portal/**`
- `docs/CODEX_LETBUYY_FOUNDATION_MISSION.md:44`: lists all four frozen apps under "Active runtimes (edit these)"
- `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_GA_CLOSURE_MISSION.md:64`: `Live DB apply / deploy — applying migrations to prod + deploying`
CLAUDE.md + AGENTS.md `DEPLOY-R2:331`: these four apps are **de-deploy targets, not production deploy targets.**

### 4.5 Dead-domain CI rewiring — `docs/Codex_waves/CODEX_ENV_CLEANUP_MISSION.md:34`
```
**E5 CI → staging.** Rewire `.github/workflows/*` so CI builds → deploys to **staging** → runs Playwright/J1‑J5 against `*.staging.letbuyy.store`
```
LEG-077 canonicalizes all functional literals to `letbuyy.com` with a ban-validator; this re-poisons CI with `.store`.

### 4.6 NEW — Shopify-OS-2.0 maximalist end-state programs — `docs/audit/` + `docs/audits/apps-platform/`
`docs/audit/13-final-architecture-blueprint.md:3`:
```
The end-state: LetBuyy as a Shopify-OS-2.0-class SaaS.
```
This is the precise maximalism `ENV-R2`/`NEVER`/ADR-021 formally reject ("MUST NOT optimize for 100,000+/1,000,000+ … sharding, multi-region, CQRS, event-sourcing, service mesh, a Wasm extension runtime"). Its companion `18-new-services-to-build.md` plans new services against `ARCH-R4` (six reserved services manifest-only).
`docs/audits/apps-platform/21-implementation-roadmap.md:14,16`:
```
Phase 2 … Batch 1 (distributed-runtime/orchestration/projection-runtime + marketplace dead files) …
Phase 3 — Build Extension Registry (+ media-service activation) … app-engine validator modules …
```
Deletes only **3 of 7** rejected packages, then **builds on `app-engine`** and **activates `media-service`** — half-converged, off-canon. `19-runtime-ownership-blueprint.md:20,23` keeps `packages/extension-host` as the live frame host and marks `services/media-service` **ACTIVATE (P3)** — both forbidden. These 42 files are descriptive (no `/goal`) so lower-velocity, but as a live build plan they are dangerous.

### 4.7 The live loop reads 2026-03-01 fossils — `AGENTS.md:380` (AGENT-R16) + `tasks/todo.md:9-13` + `memory/lessons.md`
```
AGENT-R16 — Read-before-edit. MUST read … `memory/lessons.md`, and `tasks/todo.md` before edits;
```
vs `tasks/todo.md:9-13`:
```
- [x] Generate root `AGENTS.md` as the master engineering constitution from the current repository scan
- [x] Add repeatable `scripts/generate-repository-intelligence.mjs` generator for future refreshes
```
PHASE-A-HARD-002 retired that generator so "repo scans cannot regenerate root governance law." Meanwhile `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:216` (LEG-078) lists `memory/lessons.md` as clutter to DELETE — **the canon simultaneously mandates reading it and sentences it.**

### 4.8 Stale agent OS — `docs/agents/AGENTS.md:7-14,22,43` + `subagents/admin-agent.md:9`
```
## Mandatory Reading Order
1. Root `AGENTS.md`.  2. `memory/lessons.md`.  3. `tasks/todo.md`.  4. This directory entry point.
- The canonical backend gateway is the Cloudflare Hono worker under `backend/workers/api`.
- … regenerate repository intelligence and update this directory.
```
A self-declared mandatory instruction layer frozen at 2026-05-24, describing a gateway/app tree that predates even the deprecated-alias era, instructing regeneration via a retired generator.

### 4.9 Ops-console survivor contradiction — `docs/internal-operating-system-audit/mission/CODEX_INTERNAL_OS_FOUNDATION_MISSION.md:14`
```
- `apps/platform-console/**` … and `apps/platform-operations-portal/**` … — **these two apps only** for internal UI.
```
PHASE-C resolved the survivor to `apps/platform-console` (EXECUTION_LEDGER.md:18); re-running this rebuilds the losing console. STATUS `:20` is the evasion confession.

---

## 5. ARCHIVE LIST (historical value → move under `docs/archive/`)

Move with `git mv` into dated archive folders; these carry analytical/historical value but are off-canon as live instruction. **Bold = ALREADY archived-but-untracked → action is COMMIT, not move.**

**A. Already in `docs/archive/` but UNTRACKED — must be COMMITTED (durability):**
1. **`docs/archive/root-governance-2026-06-10/`** (entire tree incl. `directories/`) — the only copy of the 61-file root sweep + 12 prior-audit dirs.
2. **`docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md`** — validator-pinned, untracked.
3. **`docs/archive/build-missions/executable/001…016`** — LEG-074 archive, untracked.
4. **`docs/archive/foundation-stepup-archive-2026-06-10/…`** (3 missions), **`docs/archive/{governance-theater-,validator-theater-tests-,infra-deployment-legacy-,firebase-legacy}-2026-06-10/`** — untracked D11 archives.
5. **`EXECUTION_LEDGER.md`, `SKIPPED_HUMAN_DECISIONS.md`** (root, untracked) — not archive but same commit-durability gap (also in CANONICAL LIST).

**B. At large under `docs/`, tracked — MOVE to archive:**
6. `docs/Codex_waves/` — **all 26 files** (12 DANGEROUS incl. the prompt factory + 6 paste-ready relaunchers + 8 obsolete wave missions). `git mv docs/Codex_waves docs/archive/codex-waves-2026-06-06/`.
7. `docs/audit/` — **all 19 files** (Shopify-OS-2.0 end-state program). `git mv docs/audit docs/archive/audit-shopify-os2-2026-06/`.
8. `docs/audits/apps-platform/` — **all 23 files** (apps-platform build program on rejected packages + reserved-service activation).
9. `docs/CODEX_LETBUYY_FOUNDATION_MISSION.md` (frozen-apps-as-active + root-budget breach).
10. `docs/LETBUYY_CODEX_IMPLEMENTATION_MASTER.md`; `docs/LETBUYY_MASTER_EXECUTION_PLAN.md`; `docs/P0_SECURITY_MASTER.md`, `P1_COST_MASTER.md`, `P2_PERFORMANCE_MASTER.md`, `P3_SCALABILITY_MASTER.md`, `P4_PRODUCT_MASTER.md`.
11. `docs/apps-marketplace-audit/` — 3 missions (FOUNDATION + UIUX + UIUX_WAVE9; reconcile the two that differ from `docs/archive/prompts/` copies).
12. `docs/themes-marketplace-audit/` — 7 missions + 10 ledger/status files.
13. `docs/developer-platform-audit/CODEX_DEVELOPER_APP_FOUNDATION_PROMPT.md`.
14. `docs/internal-operating-system-audit/mission/` — MISSION + LEDGER + STATUS (3 files).
15. `docs/auth/2026-06-08-identity-platform-transformation/` — MISSION/LEDGER/STATUS + `LETBUYY_IDENTITY_TRANSFORMATION_BLUEPRINT.md` + `PERMISSION_MODEL.md` (5 files; dedupe MISSION vs archived copy).
16. `docs/auth/2026-06-09-identity-execution-recovery/` — wave-plan + debt-register report set (mostly WT-??; multi-region wave plans). Archive or hand to identity axis.
17. `docs/agents/` — **entire dir, 43 files** (stale agent OS with self-declared mandatory reading order; retired generator). `git mv docs/agents docs/archive/agents-os-2026-05-24/`.
18. `docs/README.md` + topic `README.md`s — stale generated indices (regenerate-or-archive; docs axis owns).
19. *(Optional, low-priority)* `docs/research/shopify-product-intelligence/` — benign research; keep, or archive as research-notes. **No danger.**
20. `tasks/todo.md`, `memory/lessons.md` — archive the stale content (after rewriting living replacements) **and** amend AGENT-R16 + resolve LEG-078 so the loop reads the replacements, not fossils.

## 6. DELETE LIST (safe to delete outright — dangerous + zero historical value, or exact duplicate of an archived copy)

The convergence premise ("no production users/data/migration constraints" + aggressive-deletion mandate) makes outright deletion acceptable where git history already preserves the artifact. Recommended hard deletes:

1. `.codex/` — empty directory, noise.
2. `.codex-dev.log` — 0 bytes, gitignored, noise.
3. `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md` — **the prompt factory.** Highest-danger, zero forward value (it only generates rejected-architecture missions); its facts are already wrong. Delete rather than archive if any archive-execution risk is unacceptable; otherwise archive with §5.6. **Recommended: DELETE.**
4. The 6 paste-ready `/goal` relaunchers in `docs/Codex_waves/` (`TERMINAL_1…6_*.md` set incl. `TERMINAL_5_WS10_DEVPORTAL.md`) — their only function is one-paste re-execution of off-canon missions; the underlying wave ledgers are already archived under `root-residue`. **Recommended: DELETE** (history retains them).
5. `docs/Codex_waves/CODEX_EXTENSION_PLATFORM_MISSION.md`, `CODEX_THEME_BLOCK_ENGINE_MISSION.md`, `CODEX_DEVELOPER_ECOSYSTEM_MISSION.md` — instruct creating rejected `packages/extension-host`/`app-engine` + frozen dev-portal; zero forward value. **DELETE** (or archive with §5.6).
6. `docs/apps-marketplace-audit/CODEX_APPS_MARKETPLACE_{FOUNDATION,UIUX}_MISSION.md` **only if** confirmed older/equal to the `docs/archive/prompts/` copies — else archive the newer. (`diff -q` shows they differ; resolve before deleting.)
7. `docs/auth/2026-06-08-…/CODEX_IDENTITY_FOUNDATION_STEPUP_MISSION.md` — exact-duplicate-class of `docs/archive/prompts/CODEX_IDENTITY_FOUNDATION_STEPUP_MISSION.md`; delete the at-large copy after confirming archive copy is current, keep LEDGER/STATUS in archive.

> Conservative alternative: everything in §6 may instead be archived (§5). The DELETE LIST is the user's "safe to delete outright" set — items whose danger is high and whose content is either duplicated in `docs/archive/`/git history or purely generative (the factory). Nothing in CANONICAL (§7) may be deleted.

## 7. CANONICAL PROMPT LIST (live law / instruction — MUST keep)

These ARE the operative instruction set. None may be archived or deleted; the untracked ones must be **committed** at Phase 0.

| File | Status | Why canonical |
|---|---|---|
| `AGENTS.md` | WT-M — **keep, commit** | Promoted hand-authored V2 rulebook; AUTH-CHAIN DOC 02; the one file an agent reads to avoid drift. |
| `CLAUDE.md` | WT-M — **keep, commit** | AI operating-context pointer; encodes canonical/frozen/deprecated runtime maps. |
| `EXECUTION_LEDGER.md` | WT-?? — **keep, COMMIT** | Validator-required verbatim (`whole-repo-end-state-validator.mjs:122-144`). |
| `SKIPPED_HUMAN_DECISIONS.md` | WT-?? — **keep, COMMIT** | Validator-required (`:146-169`); the human-decision backlog incl. SKIP-GATE1-ARB-RATIFICATION. |
| `MERGE_RUNBOOK.md`, `EXECUTABLE_HUMAN_REQUIRED.md`, `README.md` | WT — **keep** | In `allowedRootMarkdown`; the convergence runbook + human-required register. |
| Governance stack: `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (DOC 01), `LETBUYY_AGENTS_V2`, `LETBUYY_CANONICAL_SYSTEMS.md`, `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md`, `LETBUYY_FOUNDATION_ROADMAP.md`, `LETBUYY_UI_UX_GOVERNANCE.md` | tracked — **keep** | The AUTH-CHAIN above AGENTS.md (governance axis owns; listed here as the law agents must follow, not prompts to execute). |
| `docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md` | WT-?? — **keep ARCHIVED, COMMIT** | The retired execution prompt that drove Phases A–D13; validator-pinned as archive. **It is the *only* surviving canonical execution prompt — and it is deliberately retired, not live.** |

**Convergence gap (the user's required note):**
- **No prompt registry exists.** Nothing indexes the corpus; no `PROMPTS.md`/manifest; the only machine-known prompt path is the archived master prompt. After §5–§6 land, the `docs/` dumping ground will refill unless a registry or an archive ratchet is added.
- **No surviving canonical *execution* prompt.** Law (AGENTS.md/Constitution) tells an agent the *rules*; no living prompt tells it *how to execute the next convergence wave*. The master implementation prompt is correctly retired but was never replaced. Convergence should author (a) a single canonical "convergence execution prompt" superseding the retired master, and (b) a prompt registry, and (c) extend `whole-repo-end-state-validator` (or a new ratchet) to fail on `*MISSION*`/`*PROMPT*`/`*BLUEPRINT*` outside `docs/archive/`.

---

## 8. Archive Completeness & Registry Gap Verdict

**INCOMPLETE — one-perimeter enforcement, ~100 files at large, registry absent.**

- **Root: COMPLETE but UNCOMMITTED.** Every prompt-class root file deleted in the WT has a 1:1 copy in `docs/archive/root-governance-2026-06-10/`; the end-state validator enforces the 7-file budget (`:16-36`), the master prompt's archival (`:38-42`), and the archive dirs' existence (`:43-50`). **But the entire archive + the validator + the ledgers are untracked** — `git clean -fd` destroys the only copy and its enforcement; `git checkout .` resurrects all 61 root artifacts at HEAD. **Durability requires a Phase-0 commit.**
- **docs/: NOT ARCHIVED, NOT REGISTERED.** ~100 mission/prompt/blueprint files remain live and tracked outside `docs/archive/` (§3.3–3.4), including **~24 DANGEROUS** and **9 paste-ready `/goal`** prompts plus **two whole prescriptive build programs** (`docs/audit/` 19 + `docs/audits/apps-platform/` 23) the prior report never inventoried. The legacy register (LEG-074/075) has **no row** for any of them — it scoped `tasks/executable/` + root docs only. AGENTS.md `DOC-R4` condemns superseded docs in principle but nothing enumerates or enforces it below root.
- **Registry: NONE.** No index of prompts exists. `docs/README.md` is a stale 2026-06-08 generated topic index that lists none. The single machine-known prompt is the archived master prompt.
- **Evasion is on record and will recur:** `CODEX_INTERNAL_OS_FOUNDATION_STATUS.md:20` — artifacts deliberately placed under `docs/` because root validators reject them. The perimeter must extend below root or the dumping ground refills.
- **History: ≥6 prompts are git-history-only** (mobile-migration set, deleted `47f29bc6`) — durable as history; no archive copy needed.

**Discovery-level end-state (not actioned, for Phase-0/convergence):** commit the untracked archives + ledgers; `git mv` the §5 set into dated archive folders; rewrite-or-archive `tasks/todo.md` + `memory/lessons.md` and amend AGENT-R16 + repeal LEG-078's conflict; author one canonical convergence-execution prompt + a `PROMPTS.md` registry; extend the end-state validator to fail on any `*MISSION*`/`*PROMPT*`/`*BLUEPRINT*` outside `docs/archive/`.

---

## 9. Unknowns / UNVERIFIED

1. **Dedupe direction unresolved:** `docs/apps-marketplace-audit/CODEX_APPS_MARKETPLACE_{FOUNDATION,UIUX}_MISSION.md` differ (`diff -q`) from their `docs/archive/prompts/` namesakes; which is newer is not established → affects whether they are DELETE (older dup) or ARCHIVE (newer variant).
2. **UNVERIFIED renames:** whether `docs/archive/prompts/claude-setup-prompt.md` is the renamed `AGENT_PROMPT_claude_setup.md`, and whether `CODEX_FOUNDATION_HARDENING_MISSION_V2.md` content survives in the non-V2 archived copy.
3. **UNVERIFIED generator:** the mission that produced `tasks/env-setup-skips.md` ("Codex env-setup agent") is absent from WT, archives, and the historical added-file list — possibly run from an out-of-repo prompt.
4. **`docs/audit/` vs `docs/audits/apps-platform/` overlap:** both contain a "13-final-architecture-blueprint" / "20-final-architecture-blueprint" and shared `03-shopify-gap-analysis` naming — they are sibling programs (different scopes: whole-repo vs apps-platform), not exact dupes; per-file dedupe not performed.
5. **Out-of-scope but flagged (governance axis):** `docs/governance/` still holds rejected-architecture-named docs (`event-store-governance.md`, `distributed-execution-survivability-governance.md`, `chaos-*`, `failover-certification-governance.md`) that live missions instruct agents to obey.
6. **Not re-audited here (other axes):** the ~80 local per-app/package/service `AGENTS.md` files; `GOVERNANCE_REWRITE_2026_06_10/` + `STRATEGIC_CANONICALIZATION_2026_06_10/` internals (active governance — Phase 5/other); `docs/auth/2026-06-09-*` untracked report set reviewed by filename + grep, not full read.
7. **Workspace contention:** the shared Linux workspace (parallel auditors) intermittently blocked git/bash; all git evidence shown was captured on successful runs and cross-checked with file-tools.
