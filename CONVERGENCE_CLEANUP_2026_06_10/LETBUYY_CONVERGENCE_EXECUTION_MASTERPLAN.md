<!-- PHASE 8 — CONVERGENCE EXECUTION MASTERPLAN. Synthesis of the whole Convergence Cleanup Program into a phased execution plan. DISCOVERY/PLANNING ONLY: this report is the only file written; read-only git; no code, schema, migration, commit, deletion, archive-move, validator-retarget, or codex prompt was executed by authoring it. Authored 2026-06-10 against stepup/main @ 5cf9e64e. -->

# LETBUYY CONVERGENCE EXECUTION MASTERPLAN — Phase 8

> **Program:** Convergence Cleanup 2026-06-10 · **Phase:** 8 — CONVERGENCE EXECUTION MASTERPLAN (the synthesis that collapses the whole program into one phased execution plan).
> **Mode:** DISCOVERY / PLANNING ONLY. This plan **describes** convergence ACTIONS (commit / archive / delete / retarget / fast-forward) in dependency order; it does **NOT** execute, modify code, commit, delete, or move anything. Read-only git. It designs **no** new product architecture and contains **no** codex prompt (that is Phase 9). The single file written is this report.
> **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · **CONFIRMED BASELINE (re-verified this phase):** branch **`stepup/main`** @ HEAD **`5cf9e64e`** (`git rev-parse HEAD = 5cf9e64e7e62482adaf4b65e74d8cbca754a0a15`) · **+30** over `main` (`git rev-list --count main..HEAD = 30`) · deploy branch **`main`** is the only branch production CI triggers from · working tree **512 D / 410 M / 79 ??** (`git status --porcelain` re-counted this phase).
> **Inputs (synthesized — this masterplan is consistent with EVERY one):** `CONVERGENCE_CLEANUP_2026_06_10/` — `REPOSITORY_FORENSICS_REPORT.md` (P1), `STRATEGIC_WINNERS_FINAL.md` (P2, 14 winners / 0 overturns), `SINGLE_SOURCE_OF_TRUTH_MASTERPLAN.md` (P3, 22 domains / 4 buckets), `SAFE_DELETION_PLAN.md` (P4, Batches 0–6), `DOCUMENT_CONVERGENCE_PLAN.md` (P5), `PROMPT_DRIFT_ELIMINATION_PLAN.md` (P6), `GOVERNANCE_CONSTITUTION.md` (P7, Cleanup Laws L1–L8). Prior `CONVERGENCE_AUDIT_2026_06_10/REPOSITORY_CONVERGENCE_ROADMAP.md` consulted for the Phase-0..7 shape. Substantive authority deferred throughout to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (DOC 01) → root `AGENTS.md` (= `AGENTS_V2`, DOC 02) → `LETBUYY_CANONICAL_SYSTEMS.md` (DOC 03).

---

## Executive Summary

This masterplan is the **execution layer** of the Convergence Cleanup Program. The six prior phases mapped the duplication (P1), named the winner for every domain (P2, 14 winners, **0 overturns**), defined the one-owner-per-domain target and its blockers (P3, 22 domains sorted into 4 buckets), classified every artifact KEEP/ARCHIVE/DELETE with batch ordering (P4), cut the documents (P5) and the drift-capable prompts (P6), and laid down the binding rules of execution (P7, the eight Cleanup Laws). **Phase 8 sequences all of it into Phases 0→8** — each phase mapped to the SAFE_DELETION batch(es) it executes and the Cleanup Laws it must satisfy, each gated by an explicit validation check that must pass to proceed.

**The defining fact that governs the entire sequence is temporal triplication.** Three realities co-own every domain: **plane A = `main`** (the only branch CI deploys — `production-deploy.yml:5-6`; ships account-takeover, 3% rake, anon RLS leaks, mutable money, un-ledgered capture), **plane B = HEAD `stepup/main`** (+30; the canonical ledger kernel and most winners as committed code), **plane C = the uncommitted working tree** (migrations 162–166, the asymmetric identity issuer, RLS+GUC, the 512 staged deletions of the dead CQRS cluster — the **only** Constitution-conforming reality, with **zero version-control protection**). Authority and durability are inversely correlated: the winner is, for every S0 domain, the least durable reality, one `git clean -fd` from non-existence. **Because the winners are already decided, convergence is not a "which one wins" exercise — it is a gated sequence of commit / ratify / delete / archive / retarget** that makes the decided winner durable and live, then removes the decided losers in dependency order.

**The work sorts into four buckets that do not substitute for one another** (P3): **Bucket 1** (Phase-0 commit unblocks — 5 domains), **Bucket 2** (ARB decision required — 5 domains, the survivability-unhook is the keystone), **Bucket 3** (call-graph trace required — 5 domains), **Bucket 4** (genuine engineering / capability gap — 7 domains). **Phases 0–8 are organized so that each phase executes the convergence that is reachable and stops, by name, at the capability-gap boundary** — the ~6 money/identity/theme/mobile/alerting builds a commit cannot close. This plan converges; it does **not** design those builds.

**Three human gating decisions govern go/no-go**, and one is non-obvious and pivotal: **(1) ARB survivability-unhook**, **(2) the Phase-0 commit**, **(3) ARB GATE-1 ratification**. The pivotal mechanic (verified repeatedly): **committing the working tree ARMS the multi-region self-block**, because `survivability-governance-validator.mjs` is tracked ON `main` and the untracked `whole-repo-end-state-validator.mjs` mandates `globalRegions: india/apac/eu/us` — so the **survivability-unhook must land in or before the Phase-0 commit**, never after. The plan encodes this as Cleanup Law L4 and as the first edge of the dependency graph below.

---

## Pivotal Sequencing Insight — the commit ARMS the self-block

This is the single most important sequencing fact in the program, and it is **counter-intuitive**: the act that makes the *correct* reality durable simultaneously makes the gate **enforce the architecture the Constitution forbids**.

**The mechanism (re-verified this phase against working-tree source).** Two validators hard-mandate the rejected multi-region topology:
- `scripts/validators/survivability-governance-validator.mjs` is **tracked AND on `main`** (`git cat-file -e main:… → ON MAIN`). It asserts `config/runtime/multi-region-runtime.json` must contain regions `india/apac/eu/us` (`:94`), failover pairs with replay + RTO/RPO (`:98-102`), and `production-topology.json.regions.globalRegions.length >= 4` (`:106`).
- `scripts/validators/whole-repo-end-state-validator.mjs` is **untracked / plane-C-only / absent on `main`** (`WHOLE-REPO ABSENT ON MAIN`). It re-asserts the same 4 regions (`:172-177`) and wires `validate:survivability` / `validate:production-certification` into 3 workflows (`architecture-governance.yml`, `production-rollout.yml`, `live-production-certification.yml`).

`config/runtime/multi-region-runtime.json` indeed declares `india/apac/eu/us`. The Constitution forbids certifying multi-region (DOC 01 §6, §5.3; `AGENTS_V2` `ENV-R2`/`ARCH-R8`/`NEVER-R1`). So the instant Phase 0 runs `git add -A && git commit`, the untracked end-state validator **becomes tracked and CI-active**, and the gate **enforces, repository-wide, the very multi-region topology the Constitution voids.** Committing the truth is the act that arms the lie.

**The forced ordering (P7 Law L4; P2 Decision 8; P3 Domain 18; prior roadmap "Pivotal Insight").** Because removing the multi-region artifacts *fails CI* once the validators are live, and the validators go live *at commit*, the **[SURVIVABILITY-UNHOOK]** — the ARB repeal + the one paired retarget of both validators + `production-topology.json.globalRegions` + the 3 workflows — **must be sequenced into Phase 1 either before or in the same change as the Phase-0 commit, never after.** Admissible orderings, in preference order:

1. **Preferred — unhook *in* the Phase-0 commit.** ARB repeal recorded first (a governance decision, no code); Phase 0 then stages the working tree with the region asserts already stripped and the topology already honest → the gate is green-and-honest on its first CI run. One commit, no contradictory intermediate state.
2. **Acceptable — unhook as the *first* commit, working-tree truth as the *second*,** both before any push to `main`. The armed-but-not-yet-honest window never reaches the deploy branch.
3. **Forbidden — commit the working tree, then unhook later.** This leaves a committed window in which the canonical gate certifies the loser; `main` could fast-forward into it.

**Phase 0 and the survivability-unhook are not independent adjacent steps — the unhook is a precondition of the commit being honest.** No `SKIP` row authorizes *keeping* the contract; an explicit ARB repeal is required (P2 Unknown #4; P3 Unknown #6).

---

## Execution Dependency Graph (one page)

Text graph. `→` = "must complete before." The **3 gating decisions** are boxed `⟦ ⟧`. `∥` marks the **capability-gap boundary** — builds that are out of convergence (named, not designed) and gate *go-live*, not the convergence deletes. Batch tags `[B0]..[B6]` map to SAFE_DELETION batches; law tags `[L1]..[L8]` map to Cleanup Laws.

```
              ⟦ GATING DECISION 1 — ARB SURVIVABILITY-UNHOOK (the keystone) ⟧  [L4]
              (no SKIP row covers "keep multi-region"; ARB must rule; gates Infra +
               the Validators region pair, AND is WORSENED by the Phase-0 commit)
                                       │  (repeal recorded → unhook authored)
                                       ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │ PHASE 0 — REPOSITORY TRUTH FREEZE                          [B0]  [L1][L2][L8]   │
   │   git add -A → commit working tree on stepup/main                              │
   │   (NEVER git clean -fd / git checkout . / git reset --hard / git restore)      │
   │   captures: Constitution+AGENTS_V2+archives, migs 162–166+rollbacks,           │
   │   22 money/identity validators, EXECUTION_LEDGER, SKIPPED_HUMAN_DECISIONS;     │
   │   finalizes 512 staged deletions (8 pkgs/154 files, 77 validators, 69 tests…)  │
   │   ⟦ GATING DECISION 2 — THE COMMIT ITSELF (privileged, clean-tree) ⟧            │
   │   MUST be sequenced WITH/BEFORE the unhook (Pivotal Insight)                   │
   │   ── Batch 1 [B1] machine-junk/caches may run any time (no precondition)       │
   └───────────────────────────────────────────────────────────────────────────────┘
        │  (winner now durable; clean clone reproduces canon; gate green-and-honest)
        ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │ PHASE 1 — GOVERNANCE & DRIFT-LOCK CONVERGENCE     [B1][B2][B4 part]  [L2][L4][L6][L7] │
   │   • survivability-unhook EXECUTED (paired retarget; config/doc deletes follow) │
   │   • ⟦ GATING DECISION 3 — ARB GATE-1 RATIFICATION ⟧ (SKIP-GATE1) [L8]           │
   │   • retarget anti-scan validator below root → collapse 61 active nested AGENTS │
   │   • install PROMPTS.md registry req + docs/-wide prompt-perimeter guard [L7]    │
   │   • DELETE 9 prompt hazards; ARCHIVE ~41 + generated-stale README REWRITE/DEL  │
   └───────────────────────────────────────────────────────────────────────────────┘
        │                 │                 │                 │
        ▼                 ▼                 ▼                 ▼
  ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
  │ PHASE 2   │    │ PHASE 3   │    │ PHASE 4   │    │ PHASE 5   │
  │ IDENTITY  │    │ MONEY     │    │ THEME     │    │ MOBILE    │   [B3]
  │ [B3]      │    │ [B3]      │    │ (B5 gated)│    │ [B3]      │
  │ del shadow│    │ commit    │    │ collapse  │    │ del dead  │
  │ stack(18),│    │ 162–166   │    │ schema/   │    │ GoRouter, │
  │ randomHex │    │ authority;│    │ compose   │    │ home twins│
  │ after drn │    │ demote    │    │ forks;    │    │ token forks│
  │           │    │ mutable   │    │ React     │    │           │
  │ ∥ keys    │    │           │    │ FROZEN    │    │ ∥ login   │
  │ ∥ step-up │    │ ∥ capture │    │ (NOT del) │    │  Turnstile│
  │ ∥ OIDC    │    │ ∥ payout  │    │ ∥ Liquid  │    │ ∥ editor  │
  │ ∥ HS256   │    │ ∥ recon   │    │   chrome  │    │  ARB pick │
  │  re-home  │    │  wiring   │    │           │    │           │
  └───────────┘    └───────────┘    └───────────┘    └───────────┘
        └─────────────────┬─────────────────┬─────────────────┘
                          ▼                 ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │ PHASE 6 — DEPLOYMENT CONVERGENCE          [B5][B6]  [L3][L4][L6]                │
   │   • fast-forward main (lag 30→0); deploy the frozen truth                      │
   │   • collapse staging/prod matrices; remove frozen-app rows                     │
   │   • EXECUTE the Infra deletes the Phase-1 unhook unblocked [B6]                 │
   │   • TRACE-gated: retire MCP-62 + storefront-21 second-backend routes [B5]      │
   └───────────────────────────────────────────────────────────────────────────────┘
                          ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │ PHASE 7 — PRODUCTION READINESS                              [L5][L8]            │
   │   • resolve human seams (keys/secrets/DNS/PITR/Sentry/WABA; live-DB probes)    │
   │   • NAME the no-alerting gap (no emitters/SDK/channel)                         │
   │   ∥ the capability builds from Phases 2–5 gate the first paying user           │
   └───────────────────────────────────────────────────────────────────────────────┘
                          ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │ PHASE 8 — CONVERGENCE VERIFICATION & ONE-REALITY LOCK                          │
   │   gate green WITHOUT self-block · one owner per domain confirmed ·             │
   │   prompt perimeter enforced · the binary "one reality, one authority" exit test│
   └───────────────────────────────────────────────────────────────────────────────┘
```

**The 3 gating decisions, isolated:**
1. **ARB Survivability-Unhook** (Law L4) — the keystone; gates Infrastructure + the Validators region pair; *worsened* by the Phase-0 commit, so it precedes/accompanies it.
2. **The Phase-0 Commit** (Law L1; privileged, clean-tree, avoiding the commit trap of Law L2) — makes the winner durable; flips ~5 domains overnight.
3. **ARB GATE-1 Ratification** (`SKIP-GATE1-ARB-RATIFICATION`, Law L8) — the human signature that turns the Constitution's self-declared "RATIFIED. SUPREME." into fact.

**Capability-gap boundary (where convergence stops and engineering begins):** Phases 0, 1, 6 are **convergence-complete** (commit / unhook / archive / delete / retarget / fast-forward / trace-gated cutover — none moves a rupee or builds a feature). Phases 2, 3, 4, 5, 7 are **convergence-partial**: each executes its duplicate-writer collapse and validator-retarget (so the gap becomes *visible*), then **stops at a named ∥ capability gap** that no commit closes. The four hardest gaps — capture ledgering (P3 #5), reconciliation wiring (#6), payout client + executor (#12/#7), Liquid chrome (#14) — are the real critical path and are restated in the Capability-Gap Boundary section.

---

# Phase 0 — Repository Truth Freeze

**Maps to:** SAFE_DELETION **Batch 0** (commit the working tree — the gate, not a delete) + **Batch 1** (machine junk/caches, no precondition). **Cleanup Laws:** **L1** (commit-before-delete; never `git clean -fd`/`git checkout .`), **L2** (archive-before-delete — the commit trap), **L8** (human-seam respect — the tasks/* pure-delete decision; the GATE-1 seam).

### Goals
Make the single correct reality (the working tree, plane C) **durable and version-controlled** without triggering the **commit trap** (L2) and without re-arming the survivability self-block in a committed window (the unhook of Phase 1 must be in/before this commit, per L4 + the Pivotal Insight). This is the persistence seam that gates **every** physical deletion in the program — it is one act, but it sits in front of all others.

### Inputs (prior-phase artifacts/decisions that feed this phase)
- P4 SAFE_DELETION Batch 0 (`[COMMIT]` precondition; the exact untracked-canon manifest) + the §7 Dangerous-to-Delete Watchlist row #1 (the working tree itself) + #7 (untracked migs 162–166 / 22 validators / ledgers).
- P5 DOCUMENT_CONVERGENCE §6 (the ARCHIVE-needs-COMMIT list: 285 untracked `docs/archive/**` + 50 program-folder + 25 auth + the root working docs) — the commit-trap counterpart.
- P2 Decision 7 (`stepup/main` working tree is the canonical reality; `ANTI-R11` — never `git checkout .`/`git clean -fd`) + P3 Domain 19.
- P7 Laws L1, L2, L8; the GATING DECISION 2 framing.
- **Gating dependency:** GATING DECISION 1 (ARB survivability-unhook) must be **recorded first** so the unhook can be authored *into* this commit (ordering #1) or as the immediately-preceding commit (ordering #2).

### Outputs (convergence artifacts produced)
- **One privileged, clean-tree commit on `stepup/main`** that stages the whole working tree with `git add -A` first (so tracked-deleted files AND their untracked archive copies are captured atomically), capturing:
  - The constitutional layer: `GOVERNANCE_REWRITE_2026_06_10/` (Constitution + 6 siblings, all untracked), `STRATEGIC_CANONICALIZATION_2026_06_10/`, `REPOSITORY_TRUTH_AUDIT_2026_06_10/`, `CONVERGENCE_AUDIT_2026_06_10/`, `CONVERGENCE_CLEANUP_2026_06_10/` (this program), root `AGENTS.md` (AGENTS_V2, tracked-M), `CLAUDE.md`.
  - The money/identity/tenancy migrations: `162_phase_a_commission_zero`, `163_d2_live_data_leak_rls`, `164_d4_tenant_role_guc`, `165_d5_canonical_money_paths`, `166_d6_checkout_handoff_inventory` + their 5 rollbacks (all untracked — the **highest-priority preserve**).
  - The 22 untracked Phase-B/C/D money/identity validators (a clean clone today has **none**) + `scripts/validate-governance.mjs`.
  - `EXECUTION_LEDGER.md` + `SKIPPED_HUMAN_DECISIONS.md` (validator-required verbatim; untracked); the untracked `.github` mobile-release workflow; `scripts/dev/dev-up.sh`/`dev-backend.sh`/`identity-security-gate.mjs`.
  - Both 2026-06-10 archive trees under `docs/archive/**` (the only copies of FORENSIC_MASTER / GOVERNANCE_HARDENING / FOUNDATION_AUTOPSY, etc.) + the validator-pinned `docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md`.
- **Finalized deletions (Batch 0, made durable by git history):** the 8 worktree-deleted rejected package roots / 154 files, 77 worktree-deleted theater validators, 69 worktree-deleted theater test files, 6 helm/k8s files, `packages/dart/services`, `packages/typescript/ui/src/mobile-tokens.ts`, the app-local mobile token forks — all already `^D`, now committed.
- **Machine junk reclaimed (Batch 1, no precondition, never as a pre-commit `clean`):** `.DS_Store ×11`, `.codex-dev.log` (0 bytes), `.codex/`/`.tmp/`/`packages/.tmp/` (empty), `build/` (161 MB), `.dart_tool/`, `test-results/`, `.pnpm-store/`, `.turbo/` (1.8 GB) — ≈2 GB.

### Risks
- **The commit trap (the highest-risk action in the program).** 512 paths are tracked-as-deleted with archive copies that exist **only as untracked files**. A tracked-only `git commit -am` **orphans the archive** (deletions land, copies do not). A `git checkout .` resurrects the 60 root artifacts at HEAD (the condemned regime). A `git clean -fd` **permanently destroys** the Constitution, AGENTS_V2, migs 162–166, the 22 validators, and both archives — zero history anywhere. **Mitigation (L1/L2): `git add -A` is mandatory and first; `git clean -fd`/`git checkout .`/`git reset --hard`/`git restore` are categorically forbidden** until after the commit is durable.
- **Committing ARMS the survivability self-block** (Pivotal Insight) — mitigated only by the Phase-1 unhook being in/before this commit (ordering #1/#2).
- `migration-safety-validator` is structurally blind to untracked migrations (`getTrackedFiles()` only); committing 162–166 also resolves that blindness.
- **L8 human-seam:** `tasks/**` (16 deleted `.md`) have **no archive copy found** — confirm pure-delete-vs-loss before committing the removal (P5 §8 #2; P4 §3.4). The `tasks/executable` / `EXECUTABLE_HUMAN_REQUIRED` items are human-decision, not code-completable.

### Validation Gates (must pass to proceed)
- `git status --porcelain` shows a **clean tree** — `0` untracked governance/migration/validator/archive paths that belong to the canonical set (the `??` count drops to genuinely-ignored machine residue only).
- A **clean clone** (`git clone` + checkout, no dirty tree) contains migrations 162–166 and all 22 money/identity validators; `supabase db push` from the clone would include 162–166.
- `pnpm run validate:governance` **PASS from tracked files only** (not off a dirty disk) — `rls-force-coverage-validator` no longer errors on an absent untracked `164_*`; `ls database/supabase/migrations/16{2,3,4,5,6}_*.sql` all present and now tracked.
- **No `git clean -fd` can destroy the canonical reality** (it is now tracked) — the binary exit test for this phase.

### Exit Criteria (binary)
The entire hardened working tree exists as committed history on `stepup/main`; a clean clone reproduces it exactly; the commit was made with the survivability-unhook already applied (or as the immediately-following commit before any push). **`main` is NOT yet fast-forwarded** (that is Phase 6).

---

# Phase 1 — Governance & Drift-Lock Convergence

**Maps to:** SAFE_DELETION **Batch 1** (post-commit zero-risk: orphan validators, generated-stale docs) + **Batch 2** (generated-intelligence docs, orphan validators, dangling refs) + **Batch 4** (archive moves) + the **Batch 6 head** (the survivability-unhook itself, which gates the rest of Batch 6 in Phase 6) + the P6 PROMPT DELETE/ARCHIVE sets + the P5 generated-README REWRITE/DELETE. **Cleanup Laws:** **L4** (survivability-unhook before/with commit — the keystone, executed here), **L2** (archive-before-delete), **L6** (one-owner-per-domain — governance), **L7** (prompt-perimeter), **L8** (GATE-1 ratification).

### Goals
Make the Constitution stack the single, **ratified, in-force** law; perform the **survivability-unhook** so the gate stops mandating the rejected multi-region architecture; collapse the 61-active scan-AGENTS proliferation to one root law policed below root; install the **prompt-perimeter guard + PROMPTS.md registry requirement** so `docs/` can never refill; and execute the prompt DELETE/ARCHIVE sets + the generated-stale README REWRITE/DELETE. This is the phase that resolves the GATE-1 self-block.

### Inputs
- P7 Laws L4, L7, L6, L8 + §4 Drift-Prevention Regime (§4.1 PROMPTS.md, §4.2 the `docs/`-wide guard, §4.3 the repeal stays repealed, §4.5 generator stays retired) + §2.3 (the nested-AGENTS subordinate-map rule).
- P3 Domain 18 (Infrastructure — the ARB repeal + the one paired retarget: 2 validators + `production-topology.json.globalRegions` + 3 workflows), Domain 20 (Governance), Domain 21 (Validators).
- P4 SAFE_DELETION `[SURVIVABILITY-UNHOOK]` precondition (§2.1, the 6-step atomic change) + Batch 2 items (80 generated docs, 11 orphan validators, dangling refs) + Batch 4 archive list.
- P5 DOCUMENT_CONVERGENCE §4 (the 97-file generated-stale tree REWRITE/DELETE) + §5 REWRITE list + §7 DELETE list (5 frozen-root app AGENTS, `master-system-intelligence.md`).
- P6 PROMPT_DRIFT §4 (the **9** DELETE hazards), §5 (the **~41** ARCHIVE-quarantine set + the verbatim quarantine header), §6 (Requirement A PROMPTS.md + Requirement B perimeter guard), §7 (the factory deep-dive).
- P2 Decision 5 (Constitution + AGENTS_V2 win) + Decision 8 (the survivability winner) + Decision 6.

### Outputs
- **The [SURVIVABILITY-UNHOOK] paired retarget** (sequenced with/before the Phase-0 commit per L4): record the ARB repeal; strip the `globalRegions:[india,apac,eu,us]` asserts from `whole-repo-end-state-validator.mjs:172-177` (KEEP the keystone validator, remove only its region loop) and `survivability-governance-validator.mjs:94,106`; **delete `survivability-governance-validator.mjs` wholesale**; remove `validate:survivability`/`validate:production-certification` (+ the 6 theater aliases) from `package.json` and from the 3 workflows **in the same change**; remove `regions.globalRegions` from `config/runtime/production-topology.json`; retarget the reserved-service manifests' `governanceDocs` off the theater docs; re-run the gate green. *(This unblocks — but does not yet execute — the Batch-6 config/doc/test deletes, which land in Phase 6.)*
- **ARB GATE-1 ratification** (`SKIP-GATE1-ARB-RATIFICATION`, L8): the human signature recorded in `SKIPPED_HUMAN_DECISIONS.md`; the Constitution status line corrected from self-declared to ARB-signed.
- **Anti-scan validator retargeted below root** so it polices the 61 active nested `AGENTS.md` (today `no-scan-generated-agents-validator.mjs` reads only root). Then the nested + scan-gen root copies become REWRITE-or-DELETE (L6, §2.3) — never before the retarget (else dangling authority refs).
- **PROMPTS.md registry installed** (one `CANONICAL-EXECUTION` entry — `CODEX_MASTER_IMPLEMENTATION_PROMPT.md` promoted from archive; added to `allowedRootMarkdown`) **+ the `docs/`-wide prompt-perimeter guard** wired into `validate:governance` (fails on any `*MISSION*/*PROMPT*/*BLUEPRINT*/TERMINAL_*` outside `docs/archive/`; quarantine-sentinel check; forbidden-token check).
- **Prompt DELETE set (9, L7):** the factory `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md` + both orchestrators (`CODEX_MASTER_SEQUENTIAL_MISSION.md`, the extension-platform mission `CODEX_EXTENSION_PLATFORM_MISSION.md`) + `CODEX_LAUNCH_PLAYBOOK.md` + the `TERMINAL_1..6_*` relaunch kit — recorded `DELETED-2026-06-10` in PROMPTS.md.
- **Prompt + document ARCHIVE-quarantine set (~41 + the doc clusters):** `docs/Codex_waves/` remainder, `docs/agents/` (40, after precedence check), `docs/audit/` (19), `docs/audits/apps-platform/` (23), the `*-audit` mission folders, the docs-root prompt/plan family, the frozen-app mission families, the 4 root business decks, `tasks/todo.md` + `memory/lessons.md` (after AGENT-R16 amendment) — each under `docs/archive/<cluster>-2026-06-10/` with the quarantine header.
- **Generated-stale tree REWRITE/DELETE:** `master-system-intelligence.md` (192,565 lines) → DELETE (snapshot archived); 65 `docs/<domain>/README.md` → REWRITE-to-stub (or DELETE scan-noise after inspection); 12 app + 18 package `AGENTS.md` → REWRITE (DELETE the 5 frozen/reserved-root app AGENTS); `docs/README.md`, `docs/architecture/README.md`, `docs/agents/repository-map.md` → REWRITE to hand stubs; the 2 `letbuyy.store`-asserting READMEs → `letbuyy.com`.
- **Batch 2 zero-risk deletes:** 80 generated-intelligence docs, 11 orphan validators (0 refs), `docs/conflicts/`+`docs/future-roadmap/`+`docs/mobile-migration-blueprint/` (empty/generated-only), `legacy/`+`tests/projections/` (empty), `tsconfig.workspace.json:68` dangling `utils` ref + `pubspec.yaml run:super_admin`, the `replay-safety-contract.json`(+schema) + the `identity-residency.schema.json`/`residency.json` pair, the urban-kicks demo residue + firebase remotePattern.
- **Live self-contradiction fixes:** amend `AGENTS.md` AGENT-R16 to point at living equivalents before the 2026-03-01 fossils archive; resolve `LEG-078` (which sentences `memory/lessons.md` to DELETE while AGENT-R16 mandates reading it); rewrite `MERGE_RUNBOOK.md` so `SKIP-D1` sends the maintainer to the real `stepup/main → main` promotion.

### Risks
- **Ordering risk = the single biggest sequencing risk in the program.** If the unhook lands *after* a pushed commit, the canonical gate certifies the rejected multi-region topology in a committed window (forbidden ordering #3). Mitigated by ordering #1/#2 (L4).
- Deleting the nested `AGENTS.md` *before* retargeting the anti-scan validator below root leaves dangling authority refs — the retarget must precede the deletes.
- The unhook is an **ARB-level act, not a janitor edit** — `survivability-governance-validator` is self-protecting (removing the topology lines fails the gate; removing the validator requires editing the gate wiring). The two must move together (one atomic change).
- Archiving a paste-ready prompt still leaves a relaunch button one `cp` away — hence the 9 hazards are **DELETE**, not archive (L7).
- The generated-doc generator is hard-retired (exits 1); the 97 stale files **cannot be regenerated** — REWRITE-by-hand or DELETE, never re-run the generator (L7 / §4.5).

### Validation Gates (must pass to proceed)
- **Gate green WITHOUT the survivability lock** — `validate-governance.mjs` is green AND `config/runtime/production-topology.json` has **no `globalRegions` block**, with `globalRegions`/`failoverPairs`/`survivability` asserted by **no** validator (`git grep globalRegions scripts/validators/` → **0 hits**).
- The anti-scan validator **fails on a planted nested `AGENTS.md`** below root (proves the perimeter extended); there is exactly **one** root `AGENTS.md` (AGENTS_V2).
- The prompt-perimeter guard **fails on a planted `*MISSION*` outside `docs/archive/`**; `find -iname '*MISSION*' -o -iname '*PROMPT*' -o -iname '*BLUEPRINT*'` outside `docs/archive/` (and not registered `CANONICAL-*` in PROMPTS.md) returns **0**; every archived prompt carries the `ARCHIVED — REJECTED ARCHITECTURE — DO NOT EXECUTE` sentinel.
- `git grep -l "GENERATED BY scripts/generate-repository-intelligence"` returns **0 tracked** live files; `repository-intelligence-validator` (asserts the generator stays retired) PASS.
- `SKIPPED_HUMAN_DECISIONS.md` shows `SKIP-GATE1-ARB-RATIFICATION` **signed**; the Constitution status line reads ratified-by-ARB.

### Exit Criteria (binary)
The Constitution stack is the committed, ratified, in-force law; the canonical gate is green and **no longer mandates a single multi-region artifact**; there is exactly one root `AGENTS.md` policed below root; the PROMPTS.md registry + `docs/`-wide perimeter guard are in force; the 9 prompt hazards are deleted and every dangerous prompt/blueprint program is archived-and-quarantined.

---

# Phase 2 — Identity Convergence

**Maps to:** SAFE_DELETION **Batch 3** (post-commit finalize: identity shadow-stack + mint-path deletes are DELETE_AFTER_MIGRATION gated on the drain). **Cleanup Laws:** **L3** (never delete a loser whose winner is uncommitted/undeployed — the drain gate), **L6** (one issuer per realm), **L8** (the keys/step-up/OIDC human-and-capability seams).

### Goals
Converge identity onto the **`identity-platform` asymmetric ES256/EdDSA sole issuer** (P2 Decision 2) by deleting the loser mint paths once the winner is live, and **name** (do not design) the identity capability gaps that survive convergence: keys, step-up, OIDC.

### Inputs
- P2 Decision 2 (asymmetric sole issuer; `IDN-R2` dual-verify drain gate; `IDN-R3` verify-only-live gate) + the Loser Registry row #2.
- P3 Domain 4 (5 current sources → identity-platform sole issuer; the named capability gap = keys/step-up/OIDC; non-merchant realms still HS256) + Domain 22 (DB ownership / `service_role`).
- P1 forensics §13 (the asymmetric-vs-symmetric-vs-opaque triad; the 18-file `identity-foundation/` shadow stack; OIDC 501 skeleton) + L5/L6/L7 ledger rows.
- P4 §3.10/§3.11 identity-foundation + mint-path rows (DELETE_AFTER_MIGRATION); P7 Laws L3, L6, L8.

### Outputs
- Retarget the gateway to **verify-only** against env-injected JWKS (`identity-session-verifier.ts`, now committed); run the `IDN-R2` dual-verify drain (telemetry: zero legacy-HS256 verifications) as the gate before any mint-path delete.
- Collapse the cookie/CSRF sprawl: consolidate the ≥4 cookie-realm authorities + the two CSRF cookie names to one canonical name (L6, N→1, no new design).
- **DELETE_AFTER_MIGRATION (gated on the drain, L3):** gateway `randomHex(32)` mint (`auth.ts:1140`) + the `/api/auth/switch` mint branch — condition: dual-verify drain shows zero legacy-HS256 verifications.
- **DELETE_AFTER_MIGRATION:** the 18-file `services/api-gateway/src/identity-foundation/` shadow stack — condition: identity-platform serves verify-only **live** (`IDN-R3`).
- **DELETE_AFTER_MIGRATION:** the `auth-core` HS256 minters per realm — condition: each realm re-homed (this re-home is *capability work*, named below, not a convergence delete). The dev-only `localAuthSessions` Map is SAFE_DELETE (dead in prod).

### Risks
- Deleting the `randomHex(32)` mint or the `/switch` branch **before** the drain proves zero legacy verifications strands any still-issuing legacy session — the drain telemetry is the hard gate (L3).
- The asymmetric property covers **exactly one** of ~5 token types today (merchant session); deleting the HS256 minters before each realm (shopper/console/app/magic-link/`lb_accounts`) is re-homed breaks those realms.

### Validation Gates (must pass to proceed)
- Dual-verify telemetry reads **zero legacy-HS256 verifications** for the drain window before the mint-path delete.
- After the delete: `git grep "randomHex(32)"` in the session-mint path → **0**; `/api/auth/switch` contains no mint branch; the `identity-foundation/` directory is gone; `identity-sole-issuer-validator` PASS with the shadow stack removed (and its `legacyAllowedUntilD3` allowlist drained).

### Capability-Gap Boundary (NAMED, not designed — out of convergence)
- **∥ BLOCKED — live identity keypairs/JWKS unprovisioned** (`SKIP-D3`, Class-B human seam): without them the asymmetric topology **fails closed in production**. Gates go-live, not the deletes.
- **∥ BLOCKED — step-up real crypto:** step-up is a self-served `mock-step-up-${uuid}` certified by a validator, guarding refund/payout/DSR-erase. Real TOTP/passkey/re-auth is capability work; convergence only stops the validator allowlisting the mock once a real path exists.
- **∥ BLOCKED — OIDC / per-realm HS256 re-home / stateless JWT revocation:** the `oauth2/*` tree is a 501 skeleton; re-keying 4 realms + a revocation list + OAuth are builds. Named only.

### Exit Criteria (binary)
The gateway and all realms **verify** sessions against the identity-platform issuer; the legacy mint path, the `/switch` takeover branch, and the 18-file shadow stack are deleted; and the identity capability gaps (keys, step-up crypto, OIDC, per-realm re-home, JWT revocation) are recorded as out-of-convergence prerequisites with no design attempted.

---

# Phase 3 — Money Convergence

**Maps to:** SAFE_DELETION **Batch 3** (the ledger-authority migrations were committed in Batch 0; demote-then-delete-as-truth and the razorpayx-residue purge are DELETE_AFTER_MIGRATION here). **Cleanup Laws:** **L3** (never delete the mutable model while the wallet read isn't deriving cleanly), **L5** (proof/live-writer-probe before any money-table drop), **L6** (single settlement writer), **L8** (the mig-162 in-place-rewrite ARB call; the capture/payout/recon human-and-capability seams).

### Goals
Make the **canonical append-only double-entry ledger** the single money truth (P2 Decision 3) by committing its authority layer (migs 162–166, landed at Phase 0) and collapsing the duplicate writers/rails around it; **name** (do not design) the four money capability gaps that no commit closes: capture ledgering, payout client, reconciliation wiring, refund ledgering. This is the phase where the line between convergence and engineering is sharpest.

### Inputs
- P2 Decision 3 (canonical ledger wins; `PAY-R1` balance always derived) + Decision 11 (0 bps) + Decision 12 (PA-split rail) + Decision 13 (ledgered capture is the target — **the #1 unfinished winner**) + the Loser Registry rows #3, #11, #12, #13 and the Migration-Complexity "High" critical path.
- P3 Domain 5 (payments capture — SoT BLOCKED BY CAPABILITY GAP), Domain 6 (ledger — recon wiring gap), Domain 7 (settlement — executor/dedup gap + ARB which-writer).
- P1 forensics §12 (the un-ledgered `confirm_order_payment_with_ledger`; ledger-table sprawl; payout hard-fail stub) + L11–L15 ledger rows.
- P4 §3 money rows (mutable-as-truth demote-then-delete; razorpayx residue) + §9 probe #1 (live-DB writer probes); P7 Laws L3, L5, L6, L8.

### Outputs
- Commit-gated authority **made operative** here (committed at Phase 0): migs `160` (reconciliation tables, claim-payout-release balance gate, capture/refund ledger columns), `162` (commission-zero defaults + `commission-bps-zero-validator`), `165` (settlement source-row ownership, ledger UPDATE/DELETE revoke from every role incl. `service_role`).
- Retarget `wallet.ts` reads to derive from the canonical ledger; **demote** `wallet_ledger_entries`/`payout_statements`/`commission_*` (mig 119) and the mini-ledgers to **read-only projections** (L6 — not deleted; they back the wallet read until zero-drift).
- Collapse the payout rail: delete the `razorpayx` self-custody **defaults** (the Phase-0 commit removed them); schedule the enum/CHECK residue purge (DELETE_AFTER_MIGRATION).
- **Retarget `canonical-ledger-only-validator`** to see SQL-side writers and add `orders`/capture to its ratchet list — so the capture gap stops being **invisible** to the gate. This is the one genuine convergence step on the capture domain (the success is *visibility*, not closure).
- **DELETE_AFTER_MIGRATION (demote, then delete as truth, L3+L5):** mutable `wallet_ledger_entries`/`payout_statements`/`commission_*` *as truth source* — condition: 160/162/165 committed + reconciliation refreshers wired to a scheduler + zero-drift proof (`SKIP-D5`) + backfill (`DEL-R2`) + a live writer probe (L5).
- **DELETE_AFTER_MIGRATION:** the never-consumed `scheduled` `payouts` instruction rows + the `orders.total`-derived gross — condition: ARB picks the surviving writer per flow (statements + claim guard is the named winner). The razorpayx enum/CHECK residue (~8–11 sites) — condition: enum-purge migration after the commit. The misleading `_with_ledger` name deletes only **after** a ledgered path replaces it (capability-gated, below).

### Risks
- Committing code without 162–166 ships the kernel without its authority layer (a partial Phase 0 would silently omit the money fixes) — Phase 0's clean-clone validation guards this.
- The mutable model **cannot be deleted (only demoted)** until the wallet read derives cleanly without manual ops — which requires the reconciliation wiring, a capability gap. **A delete here does not produce a working SoT** (L3).
- **L5/L8:** a money/tenancy table can have SQL/ops-path writers invisible to a code grep — a `DROP` requires a live writer probe; the mig-162 in-place rewrite of settled commission rows (no ledger correction entry) is an ARB call (ledgered-correction vs accepted-backfill).

### Validation Gates (must pass to proceed)
- A clean clone applies 160/162/165; `commission-bps-zero-validator` PASS; the canonical ledger has UPDATE/DELETE revoked from `service_role` (the `165` REVOKE is live).
- `canonical-ledger-only-validator` now **reports the storefront capture writer** (the gap is **visible**, not silently passing) — convergence success here is *visibility*.
- The committed default commission is **0 bps** (`?? 0` everywhere; no `?? 300` remains; DB default not 300).

### Capability-Gap Boundary (NAMED, not designed — out of convergence)
- **∥ BLOCKED — storefront/webhook capture ledgering:** `confirm_order_payment_with_ledger` (`000_baseline.sql:1590-1709`) writes **0** canonical ledger lines on the path every shopper hits, in all three realities. Making the verify route + all 4 provider webhooks post canonical entries is capability work — **survives any commit/merge. The single largest unfinished winner.**
- **∥ BLOCKED — payout provider client:** `initiateTransfer` throws `PayoutProviderUnavailable` in every plane; **no `PayoutProviderClient` exists in any branch.** Merchants can never be paid until one is built.
- **∥ BLOCKED — reconciliation wiring:** `refresh/assert_money_ledger_site_reconciliation` + `backfill_wallet_ledger_to_canonical` have **0 runtime callers**; the wallet fails closed at HTTP 409 forever. A scheduled caller + an in-product operator-clear action is a build.
- **∥ BLOCKED — 2/3 refund paths ledgering + `merchant_payable` cross-source dedup** — reversing entries + dedup are builds. Named, not designed.

### Exit Criteria (binary)
The canonical ledger authority (160/162/165) is committed and operative; the mutable model is demoted to read-only projection; the payout rail defaults to never-custody PA-split with the enum purge scheduled; and the **four money capability gaps (capture ledgering, payout client, reconciliation wiring, refund ledgering) are recorded as out-of-convergence prerequisites with no design attempted** — the plan explicitly does not claim the money SoT is reached by convergence.

---

# Phase 4 — Theme Convergence

**Maps to:** SAFE_DELETION **Batch 5** (the React renderer is a KEEP-conditional loser, deletable only post-`[WINNER-DEPLOYED]` + the 8-part Liquid parity gate — i.e. NOT in this program); the schema/compose-fork collapse + the DOMPurify swap are commit-gated and execute here. **Cleanup Laws:** **L3** (never delete React early — "S0-grade self-harm"), **L6** (one schema + one compose source).

### Goals
Converge the theme **schema and compose** sources onto the engine, make the DOMPurify sanitizer the deployable one, and **keep both renderers** — React is the FROZEN, load-bearing default and is **explicitly NOT deletable** (P2 Decision 1); the Liquid winner's chrome is a named capability gap. This is the flagship honest-tension phase (completeness contradicts the strategic winner).

### Inputs
- P2 Decision 1 (Liquid wins; React FROZEN — `THEME-R1`; the 8-part parity gate; `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`; 20-section parity table with no header/footer) + the Loser Registry row #1.
- P3 Domain 14 (two renderers + two engine roots → Liquid canonical, React FROZEN not deleted now; capability gap = Liquid chrome/data-binding) + Bucket-2 (ARB flip) / Bucket-4 (Liquid build).
- P1 forensics §14 (the renderer duplication; two theme-engine roots; schema/compose forks) + L17/L18.
- P4 §3.3/§7 Watchlist #5 (deleting React blanks every storefront) + Batch 5; P7 Laws L3, L6.

### Outputs
- Retarget the ~10 runtime-only schemas from storefront `RUNTIME_SECTION_SCHEMAS` (`renderer-registry.tsx`) into the engine `SECTION_SCHEMAS` (collapse the schema fork — L6, N→1, no design).
- Retarget the Liquid render plan/canary resolution **out of** the React-side `template-resolver.ts` into the engine `composeStorefrontTheme` (collapse the compose fork).
- The committed DOMPurify + LiquidJS auto-escape (landed at Phase 0) replaces the `main`/HEAD 3-regex sanitizer as the deployable sanitizer — closing the XSS exposure on every storefront.
- De-duplicate the split `FEATURE_LIQUID` switch (gateway capability env vs `theme-governance.ts` canary flag) to one authority (prevents the `=true`-while-governance-`false` split-brain).
- **DELETE_AFTER_MIGRATION (schema/compose forks — S3, independent of the renderer gate):** `RUNTIME_SECTION_SCHEMAS` re-declaration + the `template-resolver.ts` compose re-impl — condition: migrated into the engine; editor re-pointed at the merged set. The 3-regex sanitizer — condition: DOMPurify is the live deployable sanitizer.
- **NOT deletable now (Batch 5, post-`[WINNER-DEPLOYED]` + 8-part parity + ARB flip):** the React renderer + 20 frozen sections + `marquee.tsx`. `no-new-react-sections-validator` keeps freezing React (it is NOT deleted).

### Risks
- **Deleting React prematurely blanks every storefront** — React is the runtime default for 100% of stores; Liquid has no header/footer, no data binding, an `index`-only template, no canary write path, no editor. The textbook "ratified winner is right but completeness forbids acting now" (L3). The schema/compose forks converge to the engine **independently** of the renderer-deletion gate.
- Migrating the runtime-only schemas must not break the editor (which depends on the merged set) — migrate, don't drop.

### Validation Gates (must pass to proceed)
- The engine is the single schema + compose source: `git grep "RUNTIME_SECTION_SCHEMAS"` → **0** (after migration); the Liquid plan no longer lives in `template-resolver.ts`.
- The deployable sanitizer is **DOMPurify** (the 3-regex path is gone); `no-new-react-sections-validator` still freezes React (it is **NOT** deleted — proving L3 honored).
- One `FEATURE_LIQUID` authority remains (no split switch).

### Capability-Gap Boundary (NAMED, not designed — out of convergence)
- **∥ BLOCKED — Liquid chrome + data binding + templates + canary write path + editor:** the ratified Liquid winner cannot run a real store (no header/footer — the plan hard-codes empty groups; hard-coded product strings; `index`-only; stubbed cart/customer drops; no write path; no editor). This is the **React-deletion prerequisite**, and the platform-wide flip is **ARB-deferred** (Bucket-2). Designed nowhere here.
- **∥ BLOCKED — 5 of 24 section types render a fallback box** (incl. the default-template `announcementBar`) — named, not designed.

### Exit Criteria (binary)
The engine owns theme schema and compose; the deployable sanitizer is DOMPurify; the `FEATURE_LIQUID` split-brain is resolved; **React remains as the FROZEN, load-bearing renderer (not deleted)**; and the Liquid chrome/data-binding/template/canary-write-path gap (plus the ARB flip) is recorded as the out-of-convergence React-deletion prerequisite with no design attempted.

---

# Phase 5 — Mobile Convergence

**Maps to:** SAFE_DELETION **Batch 3** (post-commit, with same-change test edits: dead GoRouter/widgets/token forks); the theme-editor pair + 34 dead screens are **Batch 5** (ARB/per-screen-gated DELETE_AFTER_MIGRATION). **Cleanup Laws:** **L3** (the editor stays until ARB rules), **L5** (cited no-caller proof for each dead screen/route), **L8** (the login double-spend is a bug-seam, not code-completable in convergence; the editor ARB pick).

### Goals
Converge mobile onto **classic Navigator + composite mobile-bff + ui_kit generated tokens + one reachable surface per capability** (P2 Decision 10a/10b/10c) by deleting the dead navigation/widget/token duplicates; resolve the theme-editor by **ARB pick** (re-wire vs delete); and **name** (do not design) the mobile login double-spend that blocks any mobile launch regardless of the cleanup.

### Inputs
- P2 Decision 10 (Navigator + composite BFF; ui_kit generated bridge; section-editor re-wire-or-delete; the login Turnstile double-spend is an S1 bug) + the Loser Registry rows #10a/10b/10c.
- P3 Domain 16 (5 current sources → merchant-app + composite mobile-bff; capability gap = login; ARB = editor) + Bucket-4 (login) / Bucket-2 (editor).
- P1 forensics §15 / Decision-10 evidence (the zero-caller `AppDeepLinkRouter` + `go_router`; the 1,200-line dead `SectionEditorScreen`; 5 dart model-fork collisions).
- P4 §3.11 (mobile dead-weight DELETE with same-change test edits; the theme-editor pair KEEP-conditional; 34 dead screens per-screen) + §9 probe #6/#7; P7 Laws L3, L5, L8.

### Outputs
- **SAFE_DELETE (post-commit, with same-change test edits, L5):** `lib/app/deep_link_router.dart` + the `go_router ^17.0.0` dep (zero callers — verified); the `widgets/home/` duplicate twins; `widgets/shared/empty_state.dart`; `platform_blocked_screen.dart` + `platform_blocked_service.dart`; `upgrade_screen.dart`; `splash_screen.dart`; ui_kit dup pairs (one of `empty_state*`, one of `error_*`); the `pubspec.yaml run:super_admin` melos script (targets the sourceless reserved `operator-app`).
- Retarget the analytics screen onto the composite BFF `/v1/mobile/dashboard` once the BFF covers that field set, then collapse the 5-call gateway fan-out (L6). The DTCG token bridge (`--check` exit 0) is the single mobile token source (durable at Phase 0). **Retarget the 5 forked dart models** to `packages/dart/models` and delete the app-local shims.
- **DELETE_AFTER_MIGRATION (Batch 5):** the mobile theme-editor pair (`customize/theme_screen.dart` 631L + `editor/section_editor_screen.dart` 1,200L + 12 `widgets/editor/*`, ~1,830 lines) — condition: **ARB wire-or-delete decision** (L8) + rewrite the 42 protecting source-string tests. The 34 dead/capability screens + 36 `/features/*` routes — condition: per-screen wire-vs-delete product decision (KYC/2FA/returns invisibility is a product gap, not classic dead code).

### Risks
- The mobile **login Turnstile double-spend is a *bug*, not a seam, and blocks any mobile launch regardless of the nav cleanup** — tracked as a capability prerequisite (below), not conflated with the convergence deletes (L8).
- Deleting the dead GoRouter requires the same-change edit of the source-string tests that "protect" it; deleting the editor (if ARB chooses delete) requires rewriting its 42 source-string tests (L5).

### Validation Gates (must pass to proceed)
- `flutter analyze` + `flutter test` green after the GoRouter/twin/token deletes; `go_router` no longer in `pubspec.yaml`.
- One navigation system remains (Navigator); the analytics screen calls the composite BFF (the 5-call fan-out is gone) once the BFF field set covers it; the 5 dart model forks resolve to `packages/dart/models`.
- The theme-editor **ARB decision is recorded and executed** (re-wired with a reachable route, or deleted with its tests rewritten).

### Capability-Gap Boundary (NAMED, not designed — out of convergence)
- **∥ BLOCKED — mobile login Turnstile single-verify:** the app pre-verifies the single-use token at the BFF, then submits the **same** token to identity login, which re-verifies and gets `timeout-or-duplicate` → login **fails closed**. Spending the token exactly once (drop BFF pre-verify OR mint per-verifier tokens) is capability work. The Turnstile prod secret (`SKIP-W7`) is a second, independent Class-B seam.
- **∥ BLOCKED — no store-publish pipeline** (no Play upload, no iOS lane) — named; iOS is a future lane.

### Exit Criteria (binary)
Mobile has one navigation system, one dashboard data path, one token source, one model source, and no dead GoRouter/widget/token duplicates; the theme editor is either reachable or deleted; and the mobile login double-spend (plus the publish pipeline) is recorded as an out-of-convergence prerequisite with no design attempted.

---

# Phase 6 — Deployment Convergence

**Maps to:** SAFE_DELETION **Batch 5** (the trace-gated second-backend retirement, post-`[WINNER-DEPLOYED]`) + **Batch 6** (the full multi-region/chaos/load/certification unhook-execution, the highest-risk batch). **Cleanup Laws:** **L3** (the second backend + frozen-app source wait on `[WINNER-DEPLOYED]`), **L4** (the unhook's Batch-6 deletes execute here, after the Phase-1 retarget), **L6** (one backend per domain).

### Goals
Make the deployment topology **honest and lean**: deploy the now-frozen truth by **fast-forwarding `main`** (lag 30→0), collapse the staging/prod matrices, remove the frozen-app deploy rows, **execute** the one-region Infrastructure deletes the Phase-1 unhook unblocked, and retire the second backend on a verified **call-graph trace**.

### Inputs
- P2 Decision 7 (`DEPLOY-R1` branch-lag → 0) + Decision 8 (one-region topology — the Batch-6 deletes) + Decision 9 (single backend; per-page call-graph trace + proxy-or-port; `gift-cards` ported) + the Loser Registry rows #7, #8, #9.
- P3 Domain 18 (Infrastructure — the Batch-6 config/doc deletes), Domain 19 (deployment / fast-forward), Domains 9–13 (the Bucket-3 call-graph-trace proxy routes).
- P4 SAFE_DELETION Batch 5 + Batch 6 (the full item list + the `[WINNER-DEPLOYED]` + `[SURVIVABILITY-UNHOOK]` preconditions) + §9 probe #2 (per-page call-graph) / #3 (live deploy state).
- P7 Laws L3, L4, L6 + §4.4 (the branch model collapses to one — `git rev-list main..stepup/main = 0`).

### Outputs
- **Fast-forward `main`** to the committed-and-ratified `stepup/main` (`SKIP-D1`, a privileged clean-tree merge) — the act that finally deploys the hardened truth and retires `main` as the source of the condemned platform.
- Collapse the matrices: cut the frozen-app rows from **both** staging workflows (`deploy-staging.yml:99-102`, `staging-deploy.yml:189-198`) and from `config/vercel/projects.json` (lines 79/94/109/124); align the production matrix to the lean 6-Vercel-app + 4-worker topology.
- **Execute the Infrastructure deletes the [SURVIVABILITY-UNHOOK] (Phase 1) unblocked (Batch 6):** `config/runtime/multi-region-runtime.json` (+schema), `survivability-execution.json`, `observability-platform.json` (split its real prometheus rules into a non-theater validator first), the `production-topology.globalRegions` block (already stripped at Phase 1), the ~15 1–2-consumer distributed `config/runtime/*` contracts (each after its single consumer retires), `chaos/` + `load/`, `infrastructure/scripts/{operations,load,chaos}/`, the survivability/certification validator cluster + theater aliases + `production-certification-common.mjs`, the 13 contradicting + 4 validator-required `docs/governance/*` docs + 6 theater runbooks, `tests/{chaos,survivability,replay,queues,operations,production-certification,cloudflare}`.
- **SAFE_DELETE (post-commit):** `replay-safety-contract.json` + the `identity-residency` pair (if not done in Phase-1 Batch 2), the `tsconfig.workspace.json:68` dangling `utils` ref, the urban-kicks demo residue + firebase remotePattern.
- **TRACE-gated second-backend retirement (Batch 5, L6):** per-page call-graph trace, then proxy-or-port + contract tests, then delete the merchant-control-plane **62** routes + storefront-runtime **21** routes (`gift-cards` **ported**, not proxied — single-writer in the wrong runtime). The gateway `portfolio.ts`/`resume.ts` + BFF allowlist — DELETE_AFTER_MIGRATION gated on `SKIP-D11` live writer probe + ARB non-store-site-type decision.
- **ARCHIVE (after decision):** `apps/developer-portal` (ARB consolidation) + `apps/platform-operations-portal` (unique modules ported to `platform-console` first). Frozen-app *source* (`app-marketplace`/`theme-marketplace`) stays KEEP — only the deploy rows are cut (the gateway still serves their endpoints).

### Risks
- **Fast-forwarding `main` before the unhook/ratification would deploy a gate that certifies the rejected multi-region topology** (the Pivotal Insight at deploy scope) — forbidden ordering. The fast-forward depends on Phase-0 commit + Phase-1 unhook + GATE-1 ratification all complete (L4).
- Deleting MCP/storefront-runtime routes **before** the call-graph trace risks removing a route a UI page actually calls — the trace is the hard gate (L6); without it these are DELETE_AFTER_MIGRATION, not SAFE_DELETE.
- Deleting a frozen-app deploy row while the gateway still serves its endpoints is safe (only the *row* is drift); deleting the app **source** is out of scope here (L3 — `[WINNER-DEPLOYED]` / ARB).

### Validation Gates (must pass to proceed)
- `git rev-list --count main..stepup/main` → **0** (branch lag closed; `main` is the deployed truth).
- No frozen-app appears in any staging workflow or in `projects.json`; the production matrix lists exactly the 6 Vercel apps + 4 workers.
- `config/runtime/` contains **no** multi-region/distributed/survivability contract; `git grep -l "globalRegions\|failoverPairs\|multi-region" config/` → **0**; the Batch-6 validation check (`git grep globalRegions scripts/validators/` returns nothing) holds.
- After the trace + cutover: **no UI page calls a deleted MCP/storefront-runtime route** (contract tests green); the gateway is the single commerce backend (`one-system-per-domain-validator` PASS).

### Exit Criteria (binary)
`main` is fast-forwarded to the ratified truth (lag 0); the staging/prod matrices are lean and frozen-app-free; the entire multi-region/distributed/chaos/load contract layer is deleted (the unhook fully executed); and the second backend is either retired (trace complete) or carried as a single TRACE-gated DELETE_AFTER_MIGRATION with the trace named as its only blocker.

---

# Phase 7 — Production Readiness

**Maps to:** no new SAFE_DELETION batch originates here; the live-DB-gated `SKIP-D11` deletes (dead product-era tables, residual PUBLIC `USING(true)` policies, the duplicate index) execute here **after** the live probes only a human with DB access can run. **Cleanup Laws:** **L5** (live writer/policy/index probes before any DB-level drop), **L8** (every human seam resolved or badged-deferred; never fake a live integration; a mock must never read as `live`).

### Goals
Close the **human seams** that no code change resolves, and **name** (do not design) the no-alerting capability gap and the residual capability prerequisites from Phases 2–5 that gate the first paying user. This phase ends convergence and makes the platform's go-live blockers explicit — it builds nothing; it **enumerates** what must still be provisioned or built.

### Inputs
- P7 Laws L5, L8 + §5.2 (the GATE-1 deliverables an ARB signature must cover) + the Drift-Prevention Regime as standing governance.
- P4 §9 probes (live-DB `pg_stat_user_tables`/`pg_policies`/`pg_indexes`; live deploy state) + §3.12 observability rows.
- P2 Decision 14 (notifications honest mock-by-default; dead Prometheus/otel config) + P3 Domain 17 (alerting capability gap).
- The full `SKIPPED_HUMAN_DECISIONS.md` register (keys/secrets/DNS/PITR/Sentry/WABA/checkout cutover/RLS-grant probes/money reconciliation).

### Outputs (seam resolution + naming — no features)
- Resolve the launch-blocking subset of `SKIPPED_HUMAN_DECISIONS.md` (Class-B human-only seams; ~9 of ~22 launch-blocking): `SKIP-D1` (the Phase-6 merge); `SKIP-D3` identity live keys/JWKS/OIDC/Turnstile; `SKIP-PROVIDER-SECRETS` (the 29 `SKIP_NEEDS_HUMAN_*` prod wrangler placeholders); `SKIP-PROD-DNS-CUTOVER`/`SKIP-W3-DNS-CUTOVER` (`.com` resolution); `SKIP-D6` checkout cutover (DNS + Vercel host + `CHECKOUT_SIGNING_SECRET` + carrier creds + mig 166 apply); `SKIP-PROD-DEPLOY-PROMOTION` (branch protection); `SKIP-D2`/`SKIP-D4` live RLS/grant/FORCE probes; `SKIP-D5` live money reconciliation + split-rail creds; `SKIP-W0-PITR`.
- Retarget the observability config theater to the real Cloudflare Analytics Engine dataset **or** archive the Grafana/SLO/prometheus JSONs pointing at deleted k8s / empty reserved roots (convergence of *config*; the *capability* is named below).
- **Live-DB-gated deletes (L5), executed here after the human-run probes:** dead product-era tables (`portfolio_projects`/`resume_versions`/`gallery_items`/`skill_endorsements`) + the `sites.site_type` enum shrink; the duplicate `provider_payment_id` index (107-vs-142); the 25 residual PUBLIC `USING(true)` policies.

### Risks
- Provisioning a Sentry DSN (`SKIP-W3`) **does nothing** because no error-tracking SDK consumes it — the seam is *moot* without the capability build (the Class-B-looks-like-the-fix-but-Class-C trap, L8). Naming this prevents a false "we provisioned alerting" claim.
- Resolving the merge/keys/DNS seams without the money capability builds yields a platform that deploys cleanly but **cannot ledger a sale, pay a merchant, show a wallet, enforce step-up, alert on a break, render a Liquid store, or log into mobile.** The seam resolution is necessary, not sufficient.

### Validation Gates (must pass to proceed)
- `SKIPPED_HUMAN_DECISIONS.md` shows every launch-blocking `SKIP-D*`/`SKIP-W*` either signed/provisioned or explicitly badged-deferred with its blast radius.
- The observability config no longer references a deleted k8s cluster or an empty reserved root (retargeted or archived).
- A written go-live gate **enumerates** the named capability prerequisites (alerting, capture, payout, reconciliation, step-up, Liquid chrome, mobile login) as **out-of-convergence builds** — convergence is complete, but the platform is explicitly **not** declared launch-ready until those ship.

### Capability-Gap Boundary (NAMED, not designed — the go-live boundary)
- **∥ BLOCKED — no alerting end-to-end (the launch-critical operability gap):** `prometheus-rules.yaml` alerts on 7 metrics with **zero code emitters**; `otel` exports to a deleted cluster; **no error-tracking SDK in any runtime**; **no alert delivery channel** (no PagerDuty/Opsgenie/Slack/webhook). An alert channel fed by emitted metrics + an error SDK is capability work — named as a launch blocker for any money platform.
- **∥ BLOCKED — the carried prerequisites from Phases 2–5** (capture ledgering, payout client, reconciliation wiring, step-up crypto, Liquid chrome, mobile login, 2/3 refund ledgering) — all named, none designed.

### Exit Criteria (binary)
Every human seam is resolved or badged-deferred with its blast radius recorded; the observability config theater is retargeted or archived; and the no-alerting gap plus the residual money/identity/theme/mobile capability prerequisites are recorded as the explicit, un-designed boundary between "converged" and "launch-ready." **Convergence is done; the named capability builds are the platform's remaining go-live work and are out of this plan's scope.**

---

# Phase 8 — Convergence Verification & One-Reality Lock

**Maps to:** no SAFE_DELETION batch (verification, not deletion) — it confirms Batches 0–6 landed and the buckets cleared. **Cleanup Laws:** all eight as standing acceptance criteria; **L4 §4.3** (the repeal stays repealed), **L7 §4.1/§4.2** (the perimeter stays enforced), **L6** (one owner confirmed), **§4.4** (one branch), **§4.5** (generator stays retired).

### Goals
Prove convergence is complete and **lock the one-reality state**: the gate is green **without** the survivability self-block, the prompt perimeter is enforced, the generator stays retired, the branch model is one, and **exactly one owner exists per domain** — then record the binary "one reality, one authority" exit test and the residual capability-gap boundary as the only remaining work.

### Inputs
- All eight prior phases' exit criteria; P7 §4 Drift-Prevention Regime (the standing governance) + §6 Conflicts-Resolved table (each Phase-1 duplicate → its single winner).
- P3 SoT Summary Table (one owner per domain; the bucket counts) + P2 Winner Registry (14 winners) + P4 §10 counts.

### Outputs (verification artifacts — assertions, not deletions)
- A recorded **convergence-completion attestation** confirming, per domain, that exactly one owner/implementation/authority remains (or that the only residual is a named ∥ capability gap), cross-checked against the P2 Winner Registry and the P3 SoT Summary Table.
- A recorded **drift-prevention attestation**: PROMPTS.md registry live with exactly one `CANONICAL-EXECUTION` entry; the `docs/`-wide perimeter guard wired into `validate:governance`; the survivability/multi-region assertions absent from every validator; the generator hard-retired; `main` = `stepup/main`.
- The **residual capability-gap ledger** carried forward as the go-live backlog (Phase 9 codex-prompt input — authored there, not here).

### Risks
- A "green gate" that is green only because a self-block was re-introduced, or because a loser still coexists "as a fallback," is a false pass (L4 §4.3 / L6). The verification must assert the **absence** of the self-block and the **absence** of any second owner, not merely a green run.
- Declaring "convergence complete" could be misread as "launch-ready" — the attestation must restate the capability-gap boundary so the two are never conflated (L8).

### Validation Gates (the binary one-reality lock — must ALL pass)
- **Gate green WITHOUT the self-block:** `pnpm run validate:governance` PASS **and** `git grep -l "globalRegions\|failoverPairs\|multi-region\|survivability" scripts/validators/ config/runtime/` → **0**.
- **One branch:** `git rev-list --count main..stepup/main` → **0** (the deploy branch carries the hardened end-state).
- **One owner per domain:** `one-system-per-domain-validator` PASS; the gateway is the single commerce backend (no MCP/storefront second-writer route survives the trace); identity-platform is the sole issuer (`identity-sole-issuer-validator` PASS, allowlists drained); the canonical ledger is the single money truth (mutable model demoted to projection); one design-token source; one theme schema + compose source; one renderer-canonical (Liquid) with React FROZEN-not-deleted; one ops console.
- **Prompt perimeter enforced:** a planted `*MISSION*` outside `docs/archive/` turns the gate red; every archived prompt carries the quarantine sentinel; exactly one `CANONICAL-EXECUTION` entry in PROMPTS.md.
- **Generator retired:** `repository-intelligence-validator` PASS; `git grep -l "GENERATED BY scripts/generate-repository-intelligence"` → **0 tracked** live files.

### Exit Criteria (binary — "one reality, one authority")
**Repository Convergence is Complete when, and only when:** (1) `git rev-list --count main..stepup/main = 0` and `main` deploys the committed-and-ratified hardened end-state; (2) `validate:governance` is **green WITHOUT any multi-region/survivability assertion** in any validator or config; (3) for **every** domain there is **exactly one** owning system/route/writer/issuer/ledger/token-source/renderer-canonical/ops-console (the P2 winner), with every loser either deleted or — for the React renderer and the capability-gated money/identity surfaces — explicitly FROZEN/projection-demoted behind a named, undesigned capability gap; (4) the prompt perimeter + PROMPTS.md registry are in force and the generator stays retired; (5) the residual capability-gap boundary (capture ledgering, payout client + executor, reconciliation wiring, step-up crypto, Liquid chrome, mobile login, alerting) is recorded as the explicit go-live backlog, designed nowhere in this program. **At that point the eight Cleanup Laws' execution clauses (§3) are DISCHARGED; the authority restatement (§2) and the Drift-Prevention Regime (§4) persist as standing governance.**

---

## Capability-Gap Boundary — what this cleanup deliberately does NOT fix

This masterplan **adds no features, redesigns no architecture, invents no systems.** It only converges: commit, ratify, delete, archive, retarget, collapse N→1, fast-forward, trace-gated cutover. Every genuine capability gap is **named as an out-of-convergence prerequisite and left undesigned** — the boundary the program mandated. These survive *any* commit, *any* merge, and *any* secret; **a delete does not fix any of them.** The masterplan's only contributions to these domains are convergence-legitimate: it *commits* their authority migrations (160/162/163/164/165/166), *retargets* the validators so the gaps become *visible* (e.g. `canonical-ledger-only-validator` sees the SQL capture writer; the step-up validator stops certifying the mock once a real path exists), and *names* the build as the BLOCKED prerequisite gating go-live.

| # | Gap (named, not designed) | Phase that names it | Bucket | Why it is out of convergence |
|---|---|---|---|---|
| 1 | **Storefront/webhook capture ledgering** — `confirm_order_payment_with_ledger` posts **0** canonical ledger lines on the path every shopper hits, in all 3 realities | 3 | 4 (hard) | The #1 unfinished winner; capability, survives any merge |
| 2 | **Payout provider client** — `initiateTransfer` throws; **no `PayoutProviderClient` in any branch** | 3 | 4 (hard) | Merchants can never be paid until built |
| 3 | **Reconciliation wiring** — refreshers have **0 callers**; the wallet 409s forever | 3 | 4 (hard, partial: commit lands the kernel) | Scheduled caller + operator-clear action is a build |
| 4 | **2/3 refund paths ledgering + `merchant_payable` cross-source dedup** | 3 | 4 | Reversing entries + dedup are builds |
| 5 | **Settlement executor + cross-source dedup** — no executor consumes the `scheduled` payout rows | 3 | 4 (+ ARB which-writer) | The execution side is a build; the writer choice is ARB |
| 6 | **Step-up real crypto** — a self-served mock token guards refund/payout/DSR-erase | 2 | 4 | TOTP/passkey/re-auth is a build; convergence only stops the validator allowlisting the mock |
| 7 | **Per-realm HS256 re-home + JWT revocation + OIDC** — `oauth2/*` is a 501 skeleton; 4 realms still HS256 | 2 | 4 (partial: commit lands the merchant issuer) | Asymmetric re-keying + revocation list + OAuth are builds |
| 8 | **Live identity keypairs/JWKS** — unprovisioned (`SKIP-D3`) | 2 | human seam | Without them the asymmetric topology fails closed in prod |
| 9 | **Liquid chrome + data binding + full templates + canary write path + editor** — the ratified winner cannot run a real store | 4 | 4 (+ ARB flip) | The React-deletion prerequisite; React stays FROZEN, undesigned here |
| 10 | **Mobile login Turnstile single-verify** — same token spent twice → login fails closed | 5 | 4 (bug) | A bug fix (drop BFF pre-verify or mint per-verifier tokens), not a convergence delete |
| 11 | **Alerting end-to-end** — no metric emitters, no error SDK, no delivery channel; the Sentry DSN seam is moot without them | 7 | 4 (partial) | An alert channel + emitters + error SDK are builds |
| 12 | **RT-1…9 `withTenantTx` adoption proof + raw-REST parity** — the commit lands mig 163/164 | 1/6 | 4 (partial) | The red-team adoption proof + raw-REST removal are builds |

**The four hardest gates are the real critical path: capture ledgering (1), reconciliation wiring (3), payout client + executor (2/5), and Liquid chrome (9).** The money path (1 + 2/5 + 3 + 4) cannot complete until the canonical ledger is fed by capture, a payout provider client exists, the recon refreshers run, and dedup exists. Everything else in Phases 0–8 is a commit, a validator retarget, an archive move, a fast-forward, or a contract-tested proxy cutover — **none of which moves a rupee or builds a feature.**

---

## Convergence-Complete Definition — the binary "one reality, one authority" exit test

Repository Convergence is **Complete** when, and only when, **all** of the following hold simultaneously (this is the Phase-8 lock, restated as the program's single acceptance test):

1. **One reality (branch + commit).** `git rev-list --count main..stepup/main = 0`; the committed-and-ratified hardened working tree is what `main` deploys; the temporal triplication has collapsed (`main` = `stepup/main` = the committed tree). No `git clean -fd` can destroy the canon, because it is tracked.
2. **One law, no self-block.** `validate:governance` is **green WITHOUT any multi-region/survivability/`globalRegions`/failover/replay/chaos/CQRS assertion** in any validator or config (`git grep` for those tokens in `scripts/validators/` + `config/runtime/` → 0); a green gate **means** "conforms to the Constitution," permanently; GATE-1 is ARB-signed (not self-declared).
3. **One owner per domain.** For every domain the P2 winner is the **sole** owning system/route/writer/issuer/ledger/token-source/renderer-canonical/ops-console; every loser is either **deleted**, or — for the React renderer and the capability-gated money/identity surfaces — explicitly **FROZEN** / **projection-demoted** behind a **named, undesigned** capability gap. No domain carries two writers, two issuers, two ledgers-as-truth, two API surfaces, or two ops consoles "as a fallback."
4. **One prompt perimeter.** PROMPTS.md is the single registry with exactly **one** `CANONICAL-EXECUTION` entry; the `docs/`-wide guard turns the gate red on any `*MISSION*/*PROMPT*/*BLUEPRINT*/TERMINAL_*` outside `docs/archive/`; every archived prompt carries the quarantine sentinel; the generator stays hard-retired.
5. **One honest boundary.** The residual capability builds (capture ledgering, payout client + executor, reconciliation wiring, step-up crypto, Liquid chrome, mobile login, alerting) are recorded as the explicit go-live backlog — **convergence is complete, but the platform is NOT declared launch-ready until those ship.**

**If any of 1–5 fails, convergence is not complete.** Conditions 1–4 are achievable entirely by the convergence acts of Phases 0–8 (commit / ratify / unhook / delete / archive / retarget / fast-forward / trace-gated cutover). Condition 5 is the deliberate hand-off to engineering — the masterplan **defines** the boundary and **does not cross it**.

---

## Unknowns / UNVERIFIED (never silently upgraded to fact)

All carried from the prior phases; none resolvable by read-only git; each gates one or more steps.

1. **Live deployed reality** — which of `main`/HEAD/working-tree actually serves production; whether 162–166 were applied out-of-band; live Vercel/Cloudflare/Supabase state. `production-topology.json` self-labels `governance-contract-not-live-evidence`. Every "Target SoT lives on the working tree" and every live-DB-gated delete inherits this. **UNVERIFIED.**
2. **ARB intent on multi-region** — whether the survivability restore was directed or program-improvised; **no `SKIP` row covers the "keep" decision.** The single decision the ARB must adjudicate to unblock the Phase-1 unhook (Gating Decision 1). **UNVERIFIED.**
3. **Per-page call-graph (the TRACE gate)** — which surface (gateway vs MCP-62 vs storefront-runtime-21) each UI page calls. Gates every Phase-6 second-backend delete (Bucket 3). Wave-A established the 62 MCP routes are BFF proxies *in aggregate* (0 DB client); the per-route trace is **UNVERIFIED**.
4. **`production-topology.json` `globalRegions` semantics** — whether the 4-region block encodes Cloudflare *edge* presence (compatible with one-region) or a *data-region* contract (incompatible). The survivability validator's `failoverPairs`+`replayRequired` read as a data-region contract (incompatible), but ARB should confirm.
5. **Live-DB probes for the `SKIP-D11` / Phase-7 deletes** — `pg_stat_user_tables` (dead product-era tables, `leads`/`comments`, gift-cards), `pg_policies`/grants (the 25 residual PUBLIC `USING(true)` policies + live anon-reachability), `pg_indexes` (the duplicate `provider_payment_id` index). Gate the Phase-6/7 DB-level deletes (Law L5).
6. **Whether the capture / payout / step-up / alerting gaps were closed out-of-band in production** — code-derived from all three repo realities; live behavior UNVERIFIED. If any shipped out-of-band, the corresponding BLOCKED gate would soften — but no repo evidence supports it.
7. **`packages/search-core` asymmetry** — present at HEAD (4 files), in the distributed cluster by nature, but **not** in the 7-entry `rejectedPackageRoots`. Whether it is intentionally retained or an omission is UNVERIFIED; the Phase-3-packages step flags adding it; ARB should confirm before deletion.
8. **Migration 162 in-place commission-history rewrite** — whether ARB accepts an un-ledgered backfill of past rows or requires a ledgered correction entry is an open human decision (affects Ledger/Settlement honesty; Phase 3, Law L8).
9. **Working-tree count delta** — live `git status --porcelain | grep -c '^??'` = **79** this phase (the P1/P5 prose cited **78**); the 1-file delta is normal working-tree churn and changes no winner or sequencing step. `D=512 / M=410` re-confirmed exactly.
10. **`_GOVERNANCE_SPINE.md`** — cited 26× by canon docs, exists nowhere; authored-and-lost vs never-written undetermined. Adds a dangling-citation cleanup to Phase 1 (author it or strip the 26 citations).
11. **Validator de-aliasing, changeset release-flow, ui_kit unused-export pruning, newest-copy direction for diverged prompt twins** — minor INVESTIGATE probes folded into the relevant phase's archive/delete step.

---

*End of Phase 8 — LETBUYY CONVERGENCE EXECUTION MASTERPLAN. DISCOVERY / PLANNING ONLY: this report is the only file written; read-only git; no code, schema, migration, commit, deletion, archive-move, validator-retarget, or codex prompt was executed by authoring it. The plan is consistent with all six prior Convergence Cleanup phase reports + the eight Cleanup Laws (P7) + the prior CONVERGENCE_AUDIT Phase-0..7 roadmap; every winner binds to STRATEGIC_WINNERS_FINAL (0 overturns); every batch binds to SAFE_DELETION (Batches 0–6); every phase maps to its batch(es) and the Cleanup Laws it must satisfy. The pivotal sequencing fact — committing the working tree ARMS the multi-region self-block, so the survivability-unhook must land in/before the Phase-0 commit — was re-verified live against `whole-repo-end-state-validator.mjs:172-177` + `survivability-governance-validator.mjs:94,106` against `config/runtime/multi-region-runtime.json`. Baseline pinned at `stepup/main` @ `5cf9e64e`, working tree dirty (512 D / 410 M / 79 ??), 2026-06-10. The capability-gap boundary (the ~6 money/identity/theme/mobile/alerting builds) is named throughout and designed nowhere — that is Phase 9's codex-prompt and the platform's engineering backlog, not this masterplan's scope.*
