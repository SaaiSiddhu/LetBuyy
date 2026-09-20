# PROMPT DRIFT REPORT — Repository Truth Audit 2026-06-10

**Axis:** PROMPT TRUTH (prompt / mission / execution-artifact inventory and drift)
**Auditor:** PROMPT TRUTH subagent · **Date:** 2026-06-10 · **Repo state:** branch `stepup/main`, HEAD `c4fc3cd6` ("fix(foundation): resolve final audit drift", 2026-06-10), working tree dirty (512 D / 410 M / 76 ?? per `git status --porcelain` counts). Discovery only — no repository changes made except this report.

---

## 1. Executive Summary

1. **The root prompt sprawl was cleaned; the `docs/` prompt sprawl was not.** The D11/D13 cleanup (EXECUTION_LEDGER.md rows D11-PLATFORM-SIMPLIFICATION and D13-WHOLE-REPO-END-STATE) archived ~61 root markdown artifacts (21 `CODEX_*` mission/ledger/status triples, the checkout-platform maximalist plan, etc.) into untracked `docs/archive/root-governance-2026-06-10/`, and a validator (`scripts/validators/whole-repo-end-state-validator.mjs:16-50`) now enforces a 7-file root markdown budget and pins exactly **one** archived prompt path. But **~55 mission/prompt files remain live, tracked, and unarchived under `docs/`** — `docs/Codex_waves/` (26 files), `docs/CODEX_LETBUYY_FOUNDATION_MISSION.md`, 3 apps-marketplace missions, 17 themes-marketplace mission/ledger/status files, 1 developer-platform prompt, 3 internal-OS mission files, 3 identity-stepup mission files, plus the `docs/LETBUYY_MASTER_EXECUTION_PLAN.md` + `LETBUYY_CODEX_IMPLEMENTATION_MASTER.md` + P0–P4 execution-plan family.

2. **At least 12 of the at-large prompts are DANGEROUS** — executed today they would directly violate the promoted root `AGENTS.md` (V2) and the validator gate: they declare the seven deleted rejected packages (`packages/app-engine`, `application-services`, `distributed-runtime`, `extension-host`, `orchestration`, `projection-runtime`, `runtime-composition` — list at `scripts/validators/governance-common.mjs:142-150`) as "✅ Stable" canon, instruct **creating** `packages/extension-host` and `apps/developer-portal`, treat the four frozen apps as active build/deploy targets, command CI rewiring to `*.staging.letbuyy.store` (the banned dead domain), and one (`CLAUDE_OPUS_MASTER_PROMPT.md`) is a **prompt factory** that would mass-generate more missions from the rejected-architecture worldview.

3. **Two stale files are wired into the LIVE instruction loop.** Root `AGENTS.md` AGENT-R16 (line 380) mandates reading `memory/lessons.md` and `tasks/todo.md` before any edit — both are dated 2026-03-01, describe a topology two generations gone (`backend/workers/api`, `apps/web/consumer/admin`), and `tasks/todo.md` records "generate root AGENTS.md from repository scan" as the completed playbook while the live law (`no-scan-generated-agents-validator`) forbids exactly that. The governance rewrite itself sentences `memory/lessons.md` to deletion (LEG-078) while AGENTS.md mandates reading it — a live self-contradiction.

4. **A stale scan-generated agent-instruction layer survives at `docs/agents/`** (22 rule files + 19 `subagents/*.md` briefs, "Last source-derived analysis: 2026-05-24") that declares its own "Mandatory Reading Order" and instructs regenerating repository intelligence — the generator retired by PHASE-A-HARD-002.

5. **Archive evasion is documented in the corpus itself:** `docs/internal-operating-system-audit/mission/CODEX_INTERNAL_OS_FOUNDATION_STATUS.md:20` states the mission ledger/status were placed under `docs/` *"because root `CODEX_INTERNAL_OS_FOUNDATION_*` files are rejected by `source-ledger-residue-validator`"*. The enforcement perimeter is the root directory; `docs/` became the unpoliced prompt dumping ground.

6. **No prompt registry exists.** Nothing indexes the prompt corpus; the only machine-pinned prompt is the archived `CODEX_MASTER_IMPLEMENTATION_PROMPT.md`. The Legacy register (LEG-074/LEG-075) covered `tasks/executable/` and root docs only — it has **no rows** for the `docs/` prompt corpus.

7. **Archive completeness verdict: INCOMPLETE (root: complete & validator-pinned, but uncommitted; docs/: ~55 files at large; git history: ≥6 prompts deleted with no archive copy).**

---

## 2. Method

- Globs/`find` over the working tree for `*PROMPT*`, `*MISSION*`, `*CODEX*`, `*CLAUDE*`, `*EXECUTION*`, `*LEDGER*`, `*STATUS*` at root and under `docs/` (full `find` sweep excluding `node_modules`, `.git`, caches).
- `git status --porcelain` classification of every artifact: tracked-clean / modified / deleted-at-HEAD / untracked.
- `git log --all --diff-filter=A -- '*MISSION*' '*PROMPT*'` (70 unique historical paths) cross-checked against current existence to find git-history-only prompts; `git show`/`git log --stat` on the deleting commits.
- Read the enforcement layer: `scripts/validators/whole-repo-end-state-validator.mjs`, `no-rejected-package-imports-validator.mjs`, `governance-common.mjs`; grep of root `AGENTS.md` for prompt/mission/archive rules; grep of `scripts/`, `.github/`, `README.md` for live references to prompt paths.
- Content danger-scan of every non-archived prompt for: rejected packages, CQRS/event-bus/microservice/multi-region/1M-plan, deprecated app aliases, frozen apps as build/deploy targets, `letbuyy.store` literals, commission/rake economics, RazorpayX self-custody.
- Inventory of `.codex/`, `.claude/`, `tasks/`, `memory/`, `docs/agents/`, and every `docs/archive/` prompt folder.

Today = 2026-06-10. All paths repo-relative to `/Users/saai_sidd/Git/Letbuyy_Store`.

---

## 3. Full Inventory & Classification

Classes: **ACTIVE** (treated as live instruction), **OBSOLETE** (mission complete/superseded, not canon-violating), **DANGEROUS** (would violate current root AGENTS.md / ratified canon if executed today), **ARCHIVED-OK** (under `docs/archive/`, historical record per AUTH-R2). Location-now: WT=working tree (tracked clean unless noted), WT-?? = untracked, HEAD-only = deleted in WT but at HEAD, HIST = git-history-only.

### 3.1 Root + dot-dirs + tasks/ + memory/

| Artifact | Location-now | Class | Evidence | Disposition |
|---|---|---|---|---|
| `AGENTS.md` | WT (modified vs HEAD) | **ACTIVE** | Promoted V2 hand-authored law, "Date: 2026-06-10 … pinned at stepup/main @ c4fc3cd6" (AGENTS.md:1-11); promotion = EXECUTION_LEDGER.md:5 (PHASE-A-HARD-001) | KEEP |
| `CLAUDE.md` | WT (modified) | **ACTIVE** | Governance pointer (excluded from prompt audit per brief); points at AGENTS.md→Constitution | KEEP |
| `EXECUTION_LEDGER.md` | WT-?? (untracked) | **ACTIVE** | Required verbatim by validator: `whole-repo-end-state-validator.mjs:122-144` asserts 18 action-IDs present; all rows say "not committed" | KEEP + commit |
| `SKIPPED_HUMAN_DECISIONS.md` | WT-?? (untracked) | **ACTIVE** | Validator asserts 19 SKIP-IDs (`whole-repo-end-state-validator.mjs:146-169`) | KEEP + commit |
| `EXECUTABLE_HUMAN_REQUIRED.md`, `MERGE_RUNBOOK.md`, `README.md` | WT | **ACTIVE** | In the validator's `allowedRootMarkdown` set (`whole-repo-end-state-validator.mjs:16-24`) | KEEP |
| `tasks/todo.md` | WT (tracked clean) | **ACTIVE + DANGEROUS** | Mandated reading by AGENTS.md AGENT-R16:380; dated "Rewritten 2026-03-01" (line 3); records as completed "Generate root `AGENTS.md` … from the current repository scan" + "Add repeatable `scripts/generate-repository-intelligence.mjs` generator for future refreshes" (lines 9-13) — both now forbidden (PHASE-A-HARD-002, `no-scan-generated-agents-validator`); references `console.letbuyy.store` (lines 89-90), "Theme marketplace: developer submission flow / App Store: developer API" as Phase-4 work (lines 183-184), `packages/app-engine` + `packages/application-services` (lines 254, 260) | REWRITE or ARCHIVE + amend AGENT-R16 |
| `memory/lessons.md` | WT (tracked clean) | **ACTIVE + DANGEROUS (stale)** | Mandated reading by AGENT-R16:380; dated 2026-03-01 (line 3); every Location anchor is dead topology: `backend/supabase/migrations/001_initial_schema.sql` (line 11), `apps/web/consumer/admin` (line 11), `backend/workers/api/wrangler.toml` (line 91), `apps/web/administrative/console/` (line 243); Lesson 36 (line 288-292) instructs maintaining the retired intelligence generator. LEG-078 (LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:216) sentences it to DELETE — direct contradiction with AGENT-R16 | REWRITE or ARCHIVE + resolve AGENT-R16/LEG-078 conflict |
| `tasks/env-setup-skips.md` | WT (tracked clean) | OBSOLETE (log) | "Generated by Codex env-setup agent" (line 2); pure skip-log, respects reserved-service policy (line 6); the mission that generated it is not in the repo (see §6 UNVERIFIED) | KEEP or fold into SKIPPED_HUMAN_DECISIONS |
| `tasks/executable/001…016` | HEAD-only (16× ` D`); copies at `docs/archive/build-missions/executable/001-foundation.md…016-observability.md` (WT-??) | **ARCHIVED-OK** | LEG-074 verdict "ARCHIVE → docs/archive/build-missions/" executed (D11 row, EXECUTION_LEDGER.md:39); archive listing confirmed | Commit the move |
| `memory/` dir itself | WT | — | Only `lessons.md` inside | — |
| `.codex/` | WT, **empty** | noise | `ls -la .codex/` = empty dir | DELETE |
| `.codex-dev.log` | WT, gitignored | noise | 0 bytes; `git check-ignore` = IGNORED | DELETE |
| `.claude/settings.local.json` | WT-?? (untracked) | tool-config (not a prompt) | Local Claude Code permission allowlist; reveals worktree lanes `../Letbuyy_lane-A/B/C` (lines 7-12) | KEEP local / gitignore |

### 3.2 Root prompt/ledger/status files deleted at HEAD (the D11 sweep)

All 23 `CODEX_*` root files in the deletion set (`CODEX_APPS_MARKETPLACE_FOUNDATION_MISSION_V2.md`, `CODEX_APPS_MARKETPLACE_FOUNDATION_V2_{LEDGER,STATUS}.md`, `CODEX_APPS_MARKETPLACE_UIUX_{LEDGER,STATUS}.md`, `CODEX_DOMAIN_FINALIZATION_{LEDGER,STATUS}.md`, `CODEX_DOMAIN_SPLIT_{LEDGER,STATUS}.md`, `CODEX_EXECUTABLE_BUILD_{LEDGER,STATUS}.md`, `CODEX_FOUNDATION_HARDENING_{LEDGER,STATUS}.md`, `CODEX_FOUNDATION_STEPUP_{LEDGER,STATUS}.md`, `CODEX_FOUNDATION_STEPUP_V2_{MISSION,LEDGER,STATUS}.md`, `CODEX_LETBUYY_EXECUTABLE_BUILD_MISSION.md`, `CODEX_UI_FOUNDATION_{LEDGER,STATUS}.md`) plus `LETBUYY_DOMAIN_SPLIT_EXECUTION.md`, `FOUNDATION_STEPUP_{LEDGER,SKIPPED,STATUS}.md`, `LETBUYY_CHECKOUT_PLATFORM_{ARCHITECTURE,CTO_REVIEW,MASTER_PLAN}.md`, `EXECUTABLE_*`, `FOUNDATION_*`, audit reports, etc. — **HEAD-only**, with working-tree copies confirmed under `docs/archive/root-governance-2026-06-10/` (untracked).

| Artifact group | Location-now | Class | Evidence | Disposition |
|---|---|---|---|---|
| 23 root `CODEX_*` + ~60 root governance/audit docs | HEAD-only; archived copy WT-?? `docs/archive/root-governance-2026-06-10/` | **ARCHIVED-OK (pending commit)** | Root deletion list from `git status --porcelain` matches archive `ls` 1:1; LEG-075 verdict ARCHIVE; D11 ledger row EXECUTION_LEDGER.md:39; `whole-repo-end-state-validator.mjs:43-46` asserts the archive dir exists | **Commit** (currently the only copy of the archive is untracked — `git checkout .` would restore root sprawl AND orphan nothing, but `git clean` would destroy the archive) |
| `LETBUYY_INVESTOR_DECK_PROMPT.md` | WT-?? `docs/archive/root-governance-2026-06-10/` | ARCHIVED-OK | In archive listing | Commit |
| Prior audit dirs (FORENSIC_MASTER_2026_06_10, GOVERNANCE_HARDENING_2026_06_10, FOUNDATION_AUTOPSY, IDENTITY_PLATFORM_AUDIT, FOUNDATION_FORENSICS_2026_06_09, PHASE2_ARB_CHALLENGE, LETBUYY_FOUNDATION_AUTHORITY, FORENSIC_REPORT, FORENSIC_REPORT_OPERATIONS, FOUNDER_CONTENT_ENGINE, founder-journey, IDENTITY_RECOVERY_ENHANCEMENT) | WT-?? `docs/archive/root-governance-2026-06-10/directories/` | ARCHIVED-OK | Archive `ls directories/` confirmed; root AGENTS.md:11 cites the FORENSIC_MASTER archive path as evidence base | Commit |

### 3.3 `docs/Codex_waves/` — 26 tracked, clean, NON-archived files (the largest at-large prompt cluster)

git status: **tracked, unmodified** (clean). Referenced as live evidence by generated topic docs (`docs/database/README.md:103`, `docs/products/README.md:102`). Era: 2026-06-05/06 wave program (pre-rewrite).

| Artifact | Class | Evidence (key lines) | Disposition |
|---|---|---|---|
| `LETBUYY_MASTER_EXECUTION_BLUEPRINT.md` | **DANGEROUS** | Lines 40-45: declares `packages/app-engine`, `application-services`, `distributed-runtime` ("CQRS/events/workers"), `orchestration` ("Saga"), `projection-runtime`, `runtime-composition` all "✅ Stable"; line 59: `services/event-bus` as runtime | ARCHIVE |
| `LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md` | **DANGEROUS** | Line 139: "WS10 … Own ONLY apps/developer-portal/** (create it) … Scaffold developers.letbuyy.store"; line 111 same; embeds copy-paste Codex goals for 6 parallel terminals | ARCHIVE |
| `CLAUDE_OPUS_MASTER_PROMPT.md` | **DANGEROUS (prompt factory)** | A meta-prompt for claude.ai to mass-generate further Codex missions (lines 1-32); its embedded repo facts declare rejected packages stable: lines 97-107 ("packages/app-engine — ✅ Stable … application-services, distributed-runtime, orchestration, projection-runtime, runtime-composition … ✅ Stable"); line 392 spawns the WS10 dev-portal mission | ARCHIVE |
| `CODEX_EXTENSION_PLATFORM_MISSION.md` | **DANGEROUS** | Line 5: "Domain Ownership: a new `packages/extension-host/**` … + `packages/app-engine/**`"; lines 30-32: "define the app manifest … extending `app-engine`", "Files: `packages/app-engine`"; line 54: "OWN: packages/extension-host/** (create)" — instructs creating/extending two **deleted rejected packages** (`governance-common.mjs:142-150`); would fail `no-rejected-package-imports-validator.mjs:39-43` | ARCHIVE |
| `CODEX_THEME_BLOCK_ENGINE_MISSION.md` | **DANGEROUS** | Line 54: renderer pulls app-block contributions "from `app-engine`/`/v1/app-store`" — rejected package + frozen-app surface | ARCHIVE |
| `CODEX_DEVELOPER_ECOSYSTEM_MISSION.md` | **DANGEROUS** | Line 7 + 31-32: document `app-engine` contracts; lines 51-58: "Build developers.letbuyy.store" (frozen app + dead domain) | ARCHIVE |
| `TERMINAL_5_WS10_DEVPORTAL.md` | **DANGEROUS** | Line 4: "Owns ONLY: apps/developer-portal/** (a NEW Next.js app to create)"; line 24: "Goal: scaffold developers.letbuyy.store" | ARCHIVE |
| `CODEX_MASTER_SEQUENTIAL_MISSION.md` | **DANGEROUS** | Lines 47, 68: STAGE 9 executes the dev-ecosystem mission (`developers.letbuyy.store`, extension SDK) | ARCHIVE |
| `CODEX_LAUNCH_PLAYBOOK.md` | **DANGEROUS** | Lines 122-129: paste-ready relaunch of the dev-portal terminal ("scaffold developers.letbuyy.store") | ARCHIVE |
| `CODEX_ENV_CLEANUP_MISSION.md` | **DANGEROUS** | Line 34: "Rewire `.github/workflows/*` so CI … deploys to staging → runs Playwright … against `*.staging.letbuyy.store`" — banned `.store` literal in active deploy config (LEG-077; AGENTS.md TEST-R7 `.store`-ban lint) | ARCHIVE |
| `CODEX_MOBILE_PARITY_MISSION.md` | **DANGEROUS/OBSOLETE** | Lines 65-66: pins `https://api.staging.letbuyy.store/v1` and `https://api.letbuyy.store/v1`; the parity catalog it built was removed by D8 ("removed the mobile parity catalog fallback", EXECUTION_LEDGER.md:34) and is LEG-072 delete-target | ARCHIVE |
| `CODEX_LETBUYY_REMEDIATION_MISSION.md` | **DANGEROUS/OBSOLETE** | Line 49: prime directive scales "on the existing (correct) architecture" — i.e. the pre-V1 drifted architecture; lines 75-76 bind it to the superseded `docs/LETBUYY_MASTER_EXECUTION_PLAN.md` lineage; line 152 references `docs/Codex_waves/REMEDIATION_GOAL.txt` which **does not exist** | ARCHIVE |
| `CODEX_PRODUCTION_HARDENING_MISSION.md` | OBSOLETE | Wave-program mission (line 47: "You are WS7 … in LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md"); companion `CODEX_PRODUCTION_READINESS_MISSION.md` only exists archived (`docs/archive/root-residue/2026-06-05-foundation-hardening/`) → dangling read instruction | ARCHIVE |
| `CODEX_API_GRAPHQL_MISSION.md` | OBSOLETE | Line 50 reads `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md` — archived at root-residue, not at referenced path | ARCHIVE |
| `CODEX_DESIGN_SYSTEM_MISSION.md`, `CODEX_MERCHANT_UX_MISSION.md`, `CODEX_MARKETPLACE_UX_MISSION.md`, `CODEX_STOREFRONT_MISSION.md`, `CODEX_OPERATIONS_MISSION.md`, `CODEX_IDENTITY_MARKETING_MISSION.md`, `CODEX_SETTINGS_ARCHITECTURE_MISSION.md` | OBSOLETE | June-05/06 wave missions, executed (ledgers archived at `docs/archive/root-residue/2026-06-05-foundation-hardening/CODEX_WS*_LEDGER.md`); reference archived companions at dead paths | ARCHIVE |
| `TERMINAL_1_WS7_PRODUCTION.md`, `TERMINAL_2_WS1_DESIGNSYSTEM.md`, `TERMINAL_3_WS9_SETTINGS.md`, `TERMINAL_4_WS5_OPERATIONS.md`, `TERMINAL_6_WS8_MOBILE.md` | OBSOLETE (paste-ready relaunchers) | Each contains a "PASTE THIS INTO CODEX /goal" block (e.g. TERMINAL_5:15) — copy-paste re-execution is one paste away | ARCHIVE |

### 3.4 Other at-large prompts under `docs/` (tracked, clean)

| Artifact | Class | Evidence | Disposition |
|---|---|---|---|
| `docs/CODEX_LETBUYY_FOUNDATION_MISSION.md` | **DANGEROUS** | Line 44: "Active runtimes (edit these): … `apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace`, … `apps/platform-operations-portal`" — all four frozen per CLAUDE.md/AGENTS.md; lines 56-58 instruct maintaining `CODEX_LETBUYY_FOUNDATION_{LEDGER,STATUS,SKIPS}.md` "at repo root" — violates the root-markdown budget (`whole-repo-end-state-validator.mjs:16-36`); line 34 reads root `PRODUCTION_READINESS_AUDIT_2026-06-07.md` (archived); line 35 reads `CODEX_FOUNDATION_STRENGTH_MISSION.md` (archived at `docs/archive/prompts/`) | ARCHIVE |
| `docs/LETBUYY_CODEX_IMPLEMENTATION_MASTER.md` | OBSOLETE (superseded execution plan) | Line 11: "`AGENTS.md` is canonical" — written when AGENTS.md was the scan-generated drift law; lines 13-16 manage "the WS11–WS13 stack" behind flags — that stack's packages are now deleted | ARCHIVE |
| `docs/LETBUYY_MASTER_EXECUTION_PLAN.md` | OBSOLETE | "Generated: 2026-06-05" (line 3); superseded by `FORENSIC_MASTER_2026_06_10/LETBUYY_MASTER_EXECUTION_PLAN.md` (different doc, now archived) — two same-named "master execution plans" exist in the tree (DOC-R4 competing-fact risk) | ARCHIVE |
| `docs/P0_SECURITY_MASTER.md`, `P1_COST_MASTER.md`, `P2_PERFORMANCE_MASTER.md`, `P3_SCALABILITY_MASTER.md`, `P4_PRODUCT_MASTER.md` | OBSOLETE | Children of the 2026-06-05 plan (P0:3 "Parent: LETBUYY_MASTER_EXECUTION_PLAN.md") | ARCHIVE |
| `docs/apps-marketplace-audit/CODEX_APPS_MARKETPLACE_FOUNDATION_MISSION.md`, `CODEX_APPS_MARKETPLACE_UIUX_MISSION.md` | **DANGEROUS + duplicate** | Build missions for frozen `apps/app-marketplace`; `diff -q` proves both **differ** from the same-named archived copies in `docs/archive/prompts/` — two competing versions of each mission exist | ARCHIVE (reconcile with archived copy) |
| `docs/apps-marketplace-audit/CODEX_APPS_MARKETPLACE_UIUX_WAVE9_MISSION.md` | **DANGEROUS** | Header: "CODEX MISSION PROMPT. Paste this entire file to Codex … FINISH the LetBuyy Apps Marketplace UI/UX parity by building the §7 DATA LAYER" (line 1); targets `apps/app-marketplace/src` (line 107) — frozen app | ARCHIVE |
| `docs/themes-marketplace-audit/` — 7 missions (`CODEX_THEME_MARKETPLACE_FOUNDATION_MISSION.md`, `_FOUNDATION_CLOSEOUT_MISSION.md`, `_FOUNDATION_STEPUP_MISSION.md`, `_FOUNDATION_STEPUP_V2_MISSION.md`, `_GA_CLOSURE_MISSION.md`, `_UIUX_COMPLETION_MISSION.md`, `CODEX_THEME_PLATFORM_BACKEND_MISSION.md`) + 10 `_LEDGER`/`_STATUS` files | **DANGEROUS (missions) / OBSOLETE (ledgers)** | GA-closure mission drives frozen `apps/theme-marketplace` to GA with a named CUTOVER list including "Live DB apply / deploy — applying migrations to prod + deploying" (GA_CLOSURE_MISSION.md:64); tests target `apps/theme-marketplace/tests/` (line 81) | ARCHIVE |
| `docs/developer-platform-audit/CODEX_DEVELOPER_APP_FOUNDATION_PROMPT.md` | **DANGEROUS** | "Paste everything below the line into Codex" (line 3); "YOU OWN (write freely): `apps/developer-portal/**` … `apps/app-marketplace/src/app/(auth)/developers/**`" (lines 21-26) — two frozen apps as write-targets | ARCHIVE |
| `docs/internal-operating-system-audit/mission/CODEX_INTERNAL_OS_FOUNDATION_{MISSION,LEDGER,STATUS}.md` | OBSOLETE (complete) + **policy-drift** | STATUS: "Wave 11 … completed", "Done count: 82" (lines 13-17); MISSION grants full ownership of `apps/platform-operations-portal/**` (line 14) — PHASE-C resolved the ops-console survivor to `apps/platform-console` (EXECUTION_LEDGER.md:18), so the mission now builds in the losing app; STATUS:20 documents the **root-validator evasion**: ledger/status placed in docs/ "because root CODEX_INTERNAL_OS_FOUNDATION_* files are rejected by source-ledger-residue-validator" | ARCHIVE |
| `docs/auth/2026-06-08-identity-platform-transformation/CODEX_IDENTITY_FOUNDATION_STEPUP_{MISSION,LEDGER,STATUS}.md` | OBSOLETE (complete) + duplicate | Same mission also archived at `docs/archive/prompts/CODEX_IDENTITY_FOUNDATION_STEPUP_MISSION.md` — competing copies | ARCHIVE (dedupe) |
| `docs/agents/` — `AGENTS.md` + 21 rule files + `subagents/` 19 briefs | **ACTIVE-claiming + DANGEROUS (stale instruction layer)** | `docs/agents/AGENTS.md:7-14` declares "Mandatory Reading Order: 1. Root AGENTS.md. 2. memory/lessons.md. 3. tasks/todo.md. 4. This directory…"; "Last source-derived analysis: 2026-05-24" (line 5); facts reference dead topology "`backend/workers/api`" (line 22), "`apps/flutter/*`" (line 24); line 43 instructs "regenerate repository intelligence" (generator retired, PHASE-A-HARD-002); `subagents/admin-agent.md:9` owns "`apps/web/consumer/admin`" (nonexistent); no validator or live doc references `docs/agents` (grep of `scripts/` = 0 hits) | ARCHIVE entire dir (or regenerate from V2 canon) |
| `docs/README.md` + topic `README.md`s | OBSOLETE (generated index) | Header: "GENERATED BY scripts/generate-repository-intelligence.mjs ON 2026-06-08" (line 1); `docs/database/README.md:103` + `docs/products/README.md:102` cite `docs/Codex_waves/*` missions as live references | Regenerate or archive (owner: docs axis) |
| `docs/LETBUYY_MASTER_EXECUTION_BLUEPRINT*`-adjacent: `docs/research/shopify-product-intelligence/SHOPIFY_RESEARCH_LEDGER.md` | OBSOLETE (research ledger, benign) | Research notes ledger, no canon violations found | KEEP |

### 3.5 `docs/archive/` prompt holdings (ARCHIVED-OK)

| Archive | Contents | Tracked? | Evidence/Notes |
|---|---|---|---|
| `docs/archive/prompts/` | 15 files: 12 `CODEX_*_MISSION.md` + `claude-setup-prompt.md` + `repository-intelligence-prompt.md` | tracked, clean | Includes `CODEX_FOUNDATION_STRENGTH_MISSION.md`, `CODEX_UI_FOUNDATION_MISSION_V2.md`, the 2026-06-07 RECREATED marketplace mission |
| `docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md` | 1 file — **the prompt that drove Phases A–D13** | WT-?? (untracked) | Its archival is validator-pinned (`whole-repo-end-state-validator.mjs:38-42`); content conforms to ratified canon ("NEVER design for 100k+/1M+", line 40); its §0 authority chain cites `GOVERNANCE_HARDENING_2026_06_10/` at root (line 27) — that dir now lives under `docs/archive/root-governance-2026-06-10/directories/` (dangling-in-archive, acceptable) |
| `docs/archive/build-missions/executable/` | 16 superseded build-mission task specs (001-foundation…016-observability) | WT-?? | LEG-074 executed; LEG-074 row notes "some contradict V1 (010 notifications-service vs R-2). Risk: agents execute stale instructions" — now archived |
| `docs/archive/root-residue/2026-06-05-foundation-hardening/` | ~40 CODEX missions/ledgers/statuses + companions (incl. `CODEX_SHOPIFY_UX_MISSION.md`, `CODEX_PRODUCTION_READINESS_MISSION.md`, `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md`, `LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md`, `LETBUYY_FLUTTER_WEB_PARITY_AUDIT.md`, `LETBUYY_STAGING_PRODUCTION_ONLY_PLAN.md`) | tracked | The Codex_waves missions still point at these by their OLD root paths (dangling, §5) |
| `docs/archive/root-residue/2026-06-06-foundation-v2/`, `2026-06-07-domain-finalization/`, `2026-06-08-checkout-platform-build/` (5 checkout-mission variants), `2026-06-08-executable-build/` | mission/ledger archives | tracked | Checkout-platform build mission preserved in 4 fragments + full copies |
| `docs/archive/CODEX_CHECKOUT_PLATFORM_BUILD_MISSION.md` | 1 file directly in docs/archive/ | tracked | duplicate-ish of the root-residue copies — harmless inside archive |
| `docs/archive/foundation-stepup-archive-2026-06-10/foundation-stepup-archive/` | `CODEX_FOUNDATION_REMEDIATION_MISSION.md`, `CODEX_FOUNDATION_STEPUP_LAUNCH.md`, `CODEX_FOUNDATION_STEPUP_MISSION.md` | WT-?? | D11 archival |
| `docs/archive/root-governance-2026-06-10/` | §3.2 set + `directories/` (12 prior audit/program dirs incl. GOVERNANCE_HARDENING with `CODEX_ENFORCEMENT_REPORT.md`) | WT-?? | **Entire archive is untracked — must be committed to be durable** |
| `docs/archive/governance-theater-2026-06-10/`, `validator-theater-tests-2026-06-10/`, `infra-deployment-legacy-2026-06-10/`, `firebase-legacy/` | theater governance docs (`cqrs-governance.md`, `application-services-governance.md`…), orphaned validator tests, k8s/helm, firebase | WT-?? | D11 archival; note `docs/governance/` still contains many rejected-architecture-named docs (`failover-certification-governance.md`, `event-store-governance.md`, `distributed-execution-survivability-governance.md`, `chaos-certification-governance.md`) — governance-axis concern, flagged here because live missions instruct "obey docs/governance/" |

### 3.6 Git-history-only prompts (no working-tree or archive copy)

From `git log --all --diff-filter=A -- '*MISSION*' '*PROMPT*'` (70 historical paths) minus current existence:

| Artifact | Last seen | Evidence | Disposition |
|---|---|---|---|
| `docs/mobile-migration-blueprint/CODEX_MOBILE_FOUNDATION_EXECUTION_MISSION.md` (+`_V2`), `CODEX_LETBUYY_MANAGED_PAYMENTS_AND_FINAL_PARITY_MISSION.md`, `CODEX_MOBILE_FOUNDATION_{LEDGER,STATUS}.md`, `FIREBASE_DECOMMISSION_PLAN.md` | deleted in `aed02212` 2026-06-06 "chore(foundation): reconcile broad merge governance" | `git show --stat aed02212` shows -204/-261/-203 line deletions; `find` returns no copy anywhere | Recoverable via `git show aed02212^:<path>` if history needed; no action required |
| `AGENT_PROMPT_claude_setup.md` | HIST | Absent everywhere; `docs/archive/prompts/claude-setup-prompt.md` is the probable renamed successor — **UNVERIFIED** rename | none |
| `CODEX_FOUNDATION_HARDENING_MISSION_V2.md` | HIST | Absent everywhere; `docs/archive/root-residue/2026-06-06-foundation-v2/CODEX_FOUNDATION_HARDENING_MISSION.md` exists (no V2) — **UNVERIFIED** whether V2 content preserved | none |

---

## 4. Dangerous Prompt Deep-Dives (offending lines quoted)

### 4.1 The rejected-architecture canon, still declared "Stable" — `docs/Codex_waves/LETBUYY_MASTER_EXECUTION_BLUEPRINT.md:40-45,59`
```
| `app-engine` | `packages/app-engine` | App/OAuth/Bridge contracts | ✅ Stable |
| `application-services` | `packages/application-services` | Workflow orchestration | ✅ Stable |
| `distributed-runtime` | `packages/distributed-runtime` | CQRS/events/workers | ✅ Stable |
| `orchestration` | `packages/orchestration` | Saga/retry/coordination | ✅ Stable |
| `projection-runtime` | `packages/projection-runtime` | Read models/snapshots | ✅ Stable |
| `runtime-composition` | `packages/runtime-composition` | Query aggregation/cache | ✅ Stable |
...
| **Event Bus** | `services/event-bus` | Cloudflare Workers | 🟡 Scaffold |
```
All six packages are in `rejectedPackageRoots` (`scripts/validators/governance-common.mjs:142-150`) and **deleted from disk** (D11, asserted by `no-rejected-package-imports-validator.mjs:39-43` and `whole-repo-end-state-validator.mjs:52-54`). An agent obeying this blueprint would recreate the rejected topology.

### 4.2 Mission to CREATE a rejected package — `docs/Codex_waves/CODEX_EXTENSION_PLATFORM_MISSION.md:5,54`
```
**Domain Ownership:** a new `packages/extension-host/**` + ... + `packages/app-engine/**` (extension contracts) ...
OWN: packages/extension-host/** (create), packages/app-engine extension contracts, services/api-gateway extension/
```
`packages/extension-host` is itself on the rejected list. Executing this mission = direct validator breach + ADR-rejected extension architecture.

### 4.3 The prompt factory — `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md:6,97-107`
```
> **Attach:** The entire `docs/Codex_waves/` folder contents as project knowledge.
...
- packages/app-engine — App/OAuth/Bridge contracts (✅ Stable)
- packages/application-services, distributed-runtime, orchestration, projection-runtime, runtime-composition, infrastructure — Backend orchestration (✅ Stable)
- services/queue-workers, checkout-runtime, event-bus, analytics-pipeline, search-service, notification-service, media-service — (🟡 Scaffold)
```
This is a mission **generator**: pasted into claude.ai it emits new Codex missions seeded with the rejected-package worldview and reserved services presented as scaffolds-to-build. Highest leverage dangerous artifact — it doesn't just violate canon once, it manufactures violations.

### 4.4 Frozen apps as creation/deploy targets — three independent prompts
- `docs/Codex_waves/LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md:139`: `Own ONLY apps/developer-portal/** (create it). ... Scaffold developers.letbuyy.store`
- `docs/developer-platform-audit/CODEX_DEVELOPER_APP_FOUNDATION_PROMPT.md:21-26`: `YOU OWN (write freely): apps/developer-portal/** ... apps/app-marketplace/src/app/(auth)/developers/** ...`
- `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_GA_CLOSURE_MISSION.md:64`: `10. **Live DB apply / deploy** — applying migrations to prod + deploying (local Postgres apply is proven).`

CLAUDE.md (current, root): "`apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace`, and `apps/platform-operations-portal` are frozen or pending consolidation, not production deploy targets."

### 4.5 Dead-domain CI rewiring — `docs/Codex_waves/CODEX_ENV_CLEANUP_MISSION.md:34`
```
**E5 CI → staging.** Rewire `.github/workflows/*` so CI builds → deploys to **staging** → runs Playwright/J1‑J5 against `*.staging.letbuyy.store`
```
LEG-077 mandates canonicalizing all functional literals to `letbuyy.com` with a ban-validator; D11 migrated functional `.store` literals. This prompt re-poisons CI with `.store`.

### 4.6 The live instruction loop reads 2026-03-01 fossils — root `AGENTS.md:380` + `tasks/todo.md` + `memory/lessons.md`
```
AGENT-R16 — Read-before-edit. MUST read the root + local `AGENTS.md`, `memory/lessons.md`, and `tasks/todo.md` before edits;
```
vs `tasks/todo.md:9-13`:
```
- [x] Generate root `AGENTS.md` as the master engineering constitution from the current repository scan
...
- [x] Add repeatable `scripts/generate-repository-intelligence.mjs` generator for future refreshes
```
and `memory/lessons.md:291` (Lesson 36 Location): `scripts/generate-repository-intelligence.mjs` — the generator PHASE-A-HARD-002 retired so "repo scans cannot regenerate root governance law" (EXECUTION_LEDGER.md:6). The mandated pre-edit reading normalizes the exact pattern the new law exists to kill. Meanwhile `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:216` (LEG-078) lists `memory/lessons.md` as repo clutter to DELETE — the law simultaneously requires reading it and sentencing it.

### 4.7 The stale agent OS — `docs/agents/AGENTS.md:7-14,22,43` + `subagents/admin-agent.md:9`
```
## Mandatory Reading Order
1. Root `AGENTS.md`.  2. `memory/lessons.md`.  3. `tasks/todo.md`.  4. This directory entry point. ...
- The canonical backend gateway is the Cloudflare Hono worker under `backend/workers/api` with `/v1` routes.
- When significant routes, migrations, auth flows, infrastructure, or package boundaries change, regenerate repository intelligence and update this directory.
...
- `apps/web/consumer/admin` UI, route handlers, worker clients, and admin-specific user flows.   (admin-agent.md)
```
A self-declared mandatory instruction layer, frozen at 2026-05-24, describing a gateway location and app tree that predate even the deprecated-alias era, instructing regeneration via a retired generator. Nothing in the live law cites it — but nothing archives or refutes it either, and its filename (`AGENTS.md`) makes it a "local AGENTS.md" under CLAUDE.md's precedence chain for anything touching `docs/agents/`.

### 4.8 Frozen-app foundation mission masquerading as repo-wide law — `docs/CODEX_LETBUYY_FOUNDATION_MISSION.md:44,56-58`
```
Active runtimes (edit these): ... `apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace`, ... `apps/platform-operations-portal`, ...
...
Maintain at repo root (or `docs/` if root work-logs are archived) ...
- `CODEX_LETBUYY_FOUNDATION_LEDGER.md` — ...
```
Executing it creates forbidden root markdown (root budget: `whole-repo-end-state-validator.mjs:16-36`) and edits four frozen apps as "active."

### 4.9 Ops-console survivor contradiction — `docs/internal-operating-system-audit/mission/CODEX_INTERNAL_OS_FOUNDATION_MISSION.md:14`
```
- `apps/platform-console/**` (super-admin / leadership modules) and `apps/platform-operations-portal/**` (employee execution modules) — **these two apps only** for internal UI.
```
PHASE-C-FORCED-DECISIONS "Resolved the ops-console survivor to `apps/platform-console`" (EXECUTION_LEDGER.md:18). The mission's two-app internal topology is now off-canon; re-running it rebuilds the losing console.

---

## 5. Dangling References (prompts pointing at things that no longer exist)

| Prompt | Dangling reference | Reality |
|---|---|---|
| `docs/Codex_waves/CODEX_LETBUYY_REMEDIATION_MISSION.md:152` | `docs/Codex_waves/REMEDIATION_GOAL.txt` | does not exist (`ls`: No such file) |
| `docs/Codex_waves/CODEX_EXTENSION_PLATFORM_MISSION.md`, `CODEX_THEME_BLOCK_ENGINE_MISSION.md`, `CODEX_DEVELOPER_ECOSYSTEM_MISSION.md`, both BLUEPRINTs, `CLAUDE_OPUS_MASTER_PROMPT.md` | `packages/app-engine`, `packages/application-services`, `packages/distributed-runtime`, `packages/extension-host`, `packages/orchestration`, `packages/projection-runtime`, `packages/runtime-composition` | all deleted (D11); deletion asserted by `whole-repo-end-state-validator.mjs:52-54` |
| `docs/Codex_waves/*` missions (e.g. `CODEX_API_GRAPHQL_MISSION.md:50`, `CODEX_MOBILE_PARITY_MISSION.md:165`, `TERMINAL_2:16`, `CODEX_ENV_CLEANUP_MISSION.md:47`) | root-level `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md`, `LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md`, `LETBUYY_FLUTTER_WEB_PARITY_AUDIT.md`, `LETBUYY_STAGING_PRODUCTION_ONLY_PLAN.md`, `CODEX_SHOPIFY_UX_MISSION.md`, `CODEX_PRODUCTION_READINESS_MISSION.md` | all now only at `docs/archive/root-residue/2026-06-05-foundation-hardening/` — the referenced root paths resolve to nothing |
| `docs/CODEX_LETBUYY_FOUNDATION_MISSION.md:34-37` | root `PRODUCTION_READINESS_AUDIT_2026-06-07.md`, `CODEX_FOUNDATION_STRENGTH_MISSION.md`, `apps/app-marketplace/CROSS_BOUNDARY_CONTRACTS.md` | first two archived; third UNVERIFIED (frozen-app file) |
| `memory/lessons.md` (Lessons 1-35) | `backend/supabase/migrations/…`, `backend/workers/api/…`, `apps/web/consumer/…`, `apps/web/administrative/…`, `analysis_options.yaml` at root | none of these paths exist in the working tree |
| `docs/agents/AGENTS.md:22-25` + all 19 `subagents/*.md` | `backend/workers/api`, `apps/flutter/*`, `apps/web/consumer/admin`, accounts/landing/console/team apps | dead topology, two restructures old |
| `tasks/todo.md:89-90,242-260` | `console.letbuyy.store`, `apps/app-marketplace/node_modules` etc., `packages/app-engine/.turbo`, `packages/application-services/.turbo` | `.store` console domain dead; rejected packages deleted |
| `docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md:27,30-32` | root `GOVERNANCE_HARDENING_2026_06_10/`, `FORENSIC_MASTER_2026_06_10/` | moved to `docs/archive/root-governance-2026-06-10/directories/` (dangling inside an archived doc — acceptable as history) |
| `docs/LETBUYY_CODEX_IMPLEMENTATION_MASTER.md:13-16` | "the WS11–WS13 stack" feature flags | WS11-13 (query-layer/composition/extension) packages deleted; flags moot |

---

## 6. Archive Completeness Verdict

**INCOMPLETE — one-perimeter enforcement.**

- **Root: COMPLETE but UNCOMMITTED.** Every prompt-class root file deleted in the working tree has a same-name copy in `docs/archive/root-governance-2026-06-10/` (1:1 match between the `git status` root-deletion list and the archive `ls`). The end-state validator enforces the root budget (`whole-repo-end-state-validator.mjs:16-36`), the master prompt's archival (:38-42), and the archive dirs' existence (:43-50). **However the entire archive (and the validator, and EXECUTION_LEDGER.md) is untracked** — a `git clean -fd` destroys the only copy of the archive plus its enforcement; a `git checkout .` resurrects all 61 root artifacts at HEAD. Durability requires a commit.
- **docs/: NOT ARCHIVED, NOT REGISTERED.** ~55 mission/prompt files remain live and tracked outside `docs/archive/` (§3.3-3.4), including 12+ DANGEROUS ones and 6 paste-ready "/goal" terminal relaunchers. The legacy register has **no LEG row** for any of them — LEG-074/075 scoped to `tasks/executable/` and root docs. AGENTS.md DOC-R4 ("MUST git mv superseded docs to docs/archive/") condemns them in principle but nothing enumerates or enforces it below the root.
- **Registry: NONE.** No index of prompts exists. `docs/README.md` is a stale generated topic index (2026-06-08) that doesn't list prompts; the only generated cross-references to prompts are incidental (`docs/database/README.md:103`, `docs/products/README.md:105`). The single machine-known prompt is `docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md`.
- **Evasion precedent on record:** `CODEX_INTERNAL_OS_FOUNDATION_STATUS.md:20` — mission artifacts deliberately placed under `docs/` because root validators reject them. The pattern will recur for any future mission unless the enforcement perimeter extends below root or a prompt registry/archive ratchet is added.
- **History: ≥6 prompts are git-history-only** (mobile-migration-blueprint set, deleted 2026-06-06 in `aed02212`) — acceptable as git history, but no archive copy exists.

Discovery-level recommended end-state (not actioned): `git mv docs/Codex_waves docs/archive/`; `git mv` the five audit-dir mission sets + `docs/CODEX_LETBUYY_FOUNDATION_MISSION.md` + the `LETBUYY_MASTER_EXECUTION_PLAN`/P0-P4/`LETBUYY_CODEX_IMPLEMENTATION_MASTER` family + `docs/agents/` into dated archive folders; rewrite-or-archive `tasks/todo.md` and `memory/lessons.md` and amend AGENT-R16 to point at living equivalents; commit the untracked archives; optionally extend `whole-repo-end-state-validator` (or a new prompt-archive ratchet) to fail on `*MISSION*`/`*PROMPT*` files outside `docs/archive/`.

---

## 7. Unknowns / UNVERIFIED

1. **UNVERIFIED:** whether `docs/archive/prompts/claude-setup-prompt.md` is the renamed `AGENT_PROMPT_claude_setup.md`, and whether `CODEX_FOUNDATION_HARDENING_MISSION_V2.md`'s content survives in the non-V2 archived copy (rename/content tracing not performed).
2. **UNVERIFIED:** `apps/app-marketplace/CROSS_BOUNDARY_CONTRACTS.md` existence (referenced by `docs/CODEX_LETBUYY_FOUNDATION_MISSION.md:37`); frozen-app internals not inventoried on this axis.
3. **UNVERIFIED:** the mission/prompt that generated `tasks/env-setup-skips.md` ("Codex env-setup agent", references Phases 0-10 of an env-setup plan) — no matching `*ENV_SETUP*` mission found in working tree, archives, or the historical added-file list; possibly run from an out-of-repo prompt.
4. **UNVERIFIED:** content-level diff detail between `docs/apps-marketplace-audit/CODEX_APPS_MARKETPLACE_{FOUNDATION,UIUX}_MISSION.md` and their same-named `docs/archive/prompts/` copies (binary `diff -q` confirms they differ; which is newer not established).
5. **Out-of-scope but flagged:** `docs/governance/` still contains many rejected-architecture-named governance docs (`failover-certification-governance.md`, `event-store-governance.md`, `distributed-execution-survivability-governance.md`, `chaos-*`) that live missions instruct agents to obey — governance-axis ownership.
6. **Not exhaustively audited:** the ~80 local `AGENTS.md` files (per-app/package/service) and `GOVERNANCE_REWRITE_2026_06_10/` + `STRATEGIC_CANONICALIZATION_2026_06_10/` (active governance, other axes). `docs/auth/2026-06-09-*` untracked report sets contain plans/ledgers (e.g. `IDENTITY_EXECUTION_MASTERPLAN.md`, `WAVE_PROGRESS_LEDGER.md`) reviewed only by filename — report-class, not paste-ready prompts.
7. Bash workspace contention (shared with parallel auditors) intermittently blocked git commands; all git evidence shown was captured on successful runs.
