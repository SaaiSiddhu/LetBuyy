# REPOSITORY CONVERGENCE ROADMAP — Convergence Audit Phase 9 (synthesis)

**Phase:** 9 of 10 — CONVERGENCE ROADMAP. The whole audit collapses here into one **converge-only** plan.
**Mode:** DISCOVERY / PLANNING ONLY. Read-only git. No code, no architecture, no new systems, **no codex prompts**. This roadmap **only converges** — commit, ratify, delete, archive, retarget, collapse N→1. Where a genuine capability gap exists (money / identity / themes / mobile), it is **named as an out-of-convergence prerequisite and NOT designed**. The single file written is this report.
**Repo state (re-verified this phase, read-only):** branch `stepup/main` @ HEAD `c4fc3cd6`; deploy branch `main` 30 commits behind (the **only** branch production CI triggers from); working tree **512 D / 410 M / 78 ??**. Migrations `162–166` untracked (verified `git status --porcelain`); `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` untracked; the survivability self-block verified live at `whole-repo-end-state-validator.mjs:171-193` and `survivability-governance-validator.mjs:94-107` against `config/runtime/production-topology.json:34-39`.
**Inputs (all 8 convergence-phase reports + the premise seed, synthesized):** `_PREMISES_SEED.md`, `REPOSITORY_TRUTH_REPORT.md`, `DUPLICATE_AUTHORITY_REPORT.md`, `SINGLE_SOURCE_OF_TRUTH_PLAN.md`, `STRATEGIC_WINNER_DECISIONS.md`, `DELETE_CANDIDATES.md`, `PROMPT_DRIFT_REPORT.md`, `FOUNDATION_GAP_REPORT.md`, `ARCHITECTURAL_DRIFT_REPORT.md`; prior `REPOSITORY_TRUTH_AUDIT_2026_06_10/` as the citation base. This roadmap is **consistent with every prior phase**; where a count diverged across phases ([SEED-CONFLICT, magnitude] on `getSupabaseAdmin` 664–917 and nested `AGENTS.md` 38–79), the larger figure is carried as the convergence delete-set and the winner spine is unchanged.

---

## Executive Summary

The audit's verdict is singular and the same in all eight phases: **the architecture is right, decided, and coherent — and almost nothing that conforms to it is committed.** The defining fact is **temporal triplication** — three realities co-own every domain: `main` (the only deploy trigger, condemned), `HEAD` (+30, interim), and the **uncommitted working tree** (the hardened end-state, the *only* reality that conforms to the ratified canon, with **zero git history**). Authority and durability are inversely correlated: the winner this audit names is, for every S0 domain, the least durable reality, one `git clean -fd` from non-existence.

Because the winners are *already decided* (every Phase-4 score and every Phase-3 Target SoT matches the seed spine with **zero overturns**), convergence is **not a "which one wins" exercise** — it is a **gated sequence of commit / ratify / delete / archive / retarget** that makes the decided winner durable and live, then removes the decided losers in dependency order. The work sorts into exactly three buckets that **do not substitute for each other** (the central planning truth, carried from Phase 3 §"Convergence Dependency Map" and Phase 7 §5):

- **Commit-unblocked (~6 domains + the committable halves of ~6 more):** Governance, Validators-cleanup, Mobile-nav/token cleanup, Database (163/164), Commission (162), and the Branch-reality collapse. Phase 0 commit + fast-forward `main` flips these overnight.
- **ARB-gated (~3 core):** Infrastructure (multi-region), the Validators region pair, and Themes/React-deletion — each needs a **human ARB ruling** before any delete; for the multi-region case, **committing the working tree *worsens* it** (the pivotal insight, below).
- **Capability-gapped (4 hard + Notifications + 3 partials):** storefront capture ledgering, payout provider client, reconciliation wiring, step-up real crypto, alerting, Liquid chrome, mobile Turnstile single-verify, the 2/3 un-ledgered refund paths. **No commit and no secret closes these.** This roadmap **names them as out-of-convergence prerequisites and does not design the fix.**

The roadmap is structured in **8 phases (0–7)** exactly as mandated. Phase 0 freezes the truth by committing the working tree (avoiding the commit trap). Phase 1 converges governance — and **must carry the survivability-unhook with or before the commit**, because the commit is what makes the self-block CI-active. Phases 2–5 (identity / money / theme / mobile) cleanly separate the **convergence deliverables** (delete losers, collapse N→1) from the **named capability prerequisites** that are gated as BLOCKED and explicitly out of scope. Phase 6 converges deployment (collapse matrices, remove frozen-app rows, one-region honesty, retire the second backend on a call-graph trace). Phase 7 closes production-readiness: the human seams (`SKIPPED_HUMAN_DECISIONS.md`) and the no-alerting capability gap, named.

**What this roadmap deliberately does NOT do:** it adds no features, redesigns no architecture, invents no systems. The capability gaps (capture ledgering, payout client, reconciliation, step-up, Liquid chrome, mobile login, alerting) are the **boundary** — named, scoped as prerequisites, never designed here. See §"Capability-Gap Boundary."

---

## The Pivotal Sequencing Insight — Phase 0 commit *worsens* the self-block, so the unhook must precede or accompany it

This is the single most important sequencing fact in the roadmap, and it is **not intuitive**. It was verified live this phase against the working-tree validator source.

**The mechanism.** The two validators that hard-mandate the rejected multi-region architecture — `whole-repo-end-state-validator.mjs` (the keystone gate validator) and `survivability-governance-validator.mjs` — are part of the **22 untracked Phase-B/C/D validators** that exist only in the working tree. Today the gate that *executes in GitHub Actions* is HEAD's 181-lane (which does not yet contain these validators in their hardened, region-mandating form on the deploy path). The 90-lane working-tree gate that *does* contain them passes only because it reads untracked files off the dirty disk.

The instant Phase 0 runs `git add -A && git commit`, those untracked validators **become tracked and CI-active**, and they enforce, against committed config:

- `whole-repo-end-state-validator.mjs:172-177` — `production-topology.json.regions.globalRegions` must include each of `["india","apac","eu","us"]` (verified live).
- `whole-repo-end-state-validator.mjs:179-193` — `validate:survivability`, `validate:production-certification`, `validate:reconciliation`, `validate:queues` must be wired into `architecture-governance.yml`, `production-rollout.yml`, `live-production-certification.yml` (verified live).
- `survivability-governance-validator.mjs:94-95,106-107` — the multi-region runtime contract must declare all 4 regions and `globalRegions.length >= 4` (verified live).

So the act that makes the *correct* reality durable simultaneously makes the gate **enforce the architecture the Constitution forbids** (`LETBUYY_CONSTITUTION.md:98` "validators may not certify multi-region survivability"; `:108,112` one region; Never-Build #3). Committing the truth is the act that arms the lie. **This is the GATE-1 self-block reborn:** the original was "a validator asserts the drifted `AGENTS.md` must stay" (inverted at the root in a prior wave); this is "the end-state validator asserts the rejected topology must stay."

**The forced ordering.** Because removing the multi-region artifacts *fails CI* once the validators are live, and because the validators go live *at commit*, the **[SURVIVABILITY-UNHOOK]** (the ARB repeal + the paired retarget of both validators + `production-topology.json.globalRegions` + the 3 workflows) **must be sequenced into Phase 1 either before or in the same change as the Phase-0 commit** — never after. Three admissible orderings, in preference order:

1. **Preferred — unhook *in* the Phase-0 commit.** ARB repeal lands first (a governance decision, no code), then Phase 0 stages the working tree **with the region asserts already stripped and the topology already honest**, so the gate is green-and-honest on its first CI run. One commit, no contradictory intermediate state.
2. **Acceptable — unhook as the *first* commit, working-tree truth as the *second*,** both before any push to `main`. The window where the gate is armed-but-not-yet-honest never reaches the deploy branch.
3. **Forbidden — commit the working tree, then unhook later.** This leaves a committed window in which the canonical gate enforces the rejected multi-region architecture against the canonical config; any CI run in that window certifies the loser, and `main` could fast-forward into it.

The roadmap encodes ordering #1/#2 as a hard Phase-1 constraint. **Phase 0 and the survivability-unhook are not independent steps that happen to be adjacent — the unhook is a *precondition of the commit being honest*.**

---

## Convergence Dependency Graph (one page)

Text graph. `→` = "must complete before." The **3 gating decisions** are boxed `⟦ ⟧`. `∥` marks the capability-gap prerequisites that are **out of convergence** (named, not designed) and gate *go-live*, not the convergence deletes.

```
                         ⟦ GATING DECISION 1: ARB SURVIVABILITY REPEAL ⟧
                         (no SKIP row covers the "keep" decision — ARB must rule;
                          this is the keystone — it gates Infra, the Validators region
                          pair, AND is WORSENED by the Phase-0 commit)
                                          │
                                          ▼  (repeal recorded → unhook authored)
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │ PHASE 0 — REPOSITORY TRUTH FREEZE                                             │
   │   git add -A  (NEVER git clean -fd / git checkout .)                          │
   │   commit working tree: Constitution+archives, migs 162–166, 22 validators,   │
   │   EXECUTION_LEDGER/SKIPPED_HUMAN_DECISIONS, AGENTS_V2                         │
   │   ⟦ GATING DECISION 2: THE COMMIT ITSELF (privileged, clean-tree) ⟧           │
   │   MUST be sequenced WITH/AFTER the unhook (see Pivotal Insight)               │
   └──────────────────────────────────────────────────────────────────────────────┘
        │                                                                  │
        ▼  (winner now durable; gate green-and-honest)                     │
   ┌─────────────────────────────────────────────────┐                     │
   │ PHASE 1 — GOVERNANCE CONVERGENCE                 │                     │
   │   • survivability-unhook executed (the paired    │                     │
   │     retarget; doc/config/validator deletes follow)│                    │
   │   • delete 47–79 nested + scan-gen root AGENTS.md │                    │
   │     (AFTER anti-scan validator retargeted below   │                    │
   │      root)                                        │                    │
   │   • ⟦ GATING DECISION 3: ARB GATE-1 RATIFICATION ⟧│                    │
   │     (SKIP-GATE1) — fixes "RATIFIED" status line   │                    │
   │   • archive docs/agents, Codex_waves, docs/audit, │                    │
   │     docs/audits/apps-platform, prompt corpus      │                    │
   └─────────────────────────────────────────────────┘                     │
        │                    │                    │                         │
        ▼                    ▼                    ▼                         ▼
  ┌───────────┐      ┌───────────┐      ┌───────────┐            ┌──────────────────┐
  │ PHASE 2   │      │ PHASE 3   │      │ PHASE 4   │            │ (Infra deletes    │
  │ IDENTITY  │      │ MONEY     │      │ THEME     │            │  ride PHASE 1     │
  │ converge: │      │ converge: │      │ converge: │            │  unhook → exec    │
  │ del shadow│      │ commit    │      │ collapse  │            │  in PHASE 6)      │
  │ stack(18),│      │ 160/162/  │      │ schema +  │            └──────────────────┘
  │ randomHex │      │ 165; del  │      │ compose   │
  │ mint after│      │ razorpayx │      │ forks to  │
  │ drain     │      │ defaults; │      │ engine;   │
  │           │      │ del 3-regex│     │ del 3-regex│
  │ ∥ step-up │      │ sanitizer │      │ sanitizer │
  │   crypto  │      │           │      │           │
  │ ∥ HS256   │      │ ∥ capture │      │ ∥ Liquid  │
  │   re-home │      │   ledger  │      │   chrome  │
  │ ∥ live    │      │ ∥ payout  │      │   (React  │
  │   keys    │      │   client  │      │   FROZEN, │
  │ (SKIP-D3) │      │ ∥ recon   │      │   NOT     │
  │           │      │   wiring  │      │   deletable)│
  └───────────┘      └───────────┘      └───────────┘
        │                    │                    │
        │              ┌───────────┐              │
        │              │ PHASE 5   │              │
        │              │ MOBILE    │              │
        │              │ converge: │              │
        │              │ del dead  │              │
        │              │ GoRouter, │              │
        │              │ home/twins│              │
        │              │ token forks│             │
        │              │ ∥ login   │              │
        │              │  Turnstile│              │
        │              │ ∥ editor  │              │
        │              │  ARB pick │              │
        │              └───────────┘              │
        └──────────────────┬─────────────────────┘
                           ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ PHASE 6 — DEPLOYMENT CONVERGENCE                                  │
   │   • fast-forward main (lag 30→0; the deploy of the frozen truth)  │
   │   • collapse staging+prod matrices; delete frozen-app rows (BOTH  │
   │     staging workflows + projects.json)                            │
   │   • execute the Infra deletes unblocked by PHASE 1 unhook         │
   │     (multi-region-runtime.json, chaos/, load/, distributed config)│
   │   • TRACE-gated: retire merchant-control-plane 2nd backend +      │
   │     storefront-runtime 21 routes (per-page call-graph first)      │
   └──────────────────────────────────────────────────────────────────┘
                           ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ PHASE 7 — PRODUCTION READINESS                                    │
   │   • resolve human seams (SKIP-D*/W*: keys, secrets, DNS, PITR,    │
   │     Sentry DSN, WABA, checkout cutover)                           │
   │   • NAME the no-alerting capability gap (no emitters/SDK/channel) │
   │   • the capability ∥ prerequisites from Phases 2–5 gate go-live   │
   └──────────────────────────────────────────────────────────────────┘
```

**The 3 gating decisions, isolated:**
1. **ARB Survivability Repeal** — the keystone; gates Infrastructure + the Validators region pair, and is *worsened* by the Phase-0 commit (so it precedes/accompanies it).
2. **The Phase-0 Commit** (privileged, clean-tree, avoiding the commit trap) — makes the winner durable; flips PR for ~6 domains.
3. **ARB GATE-1 Ratification** (`SKIP-GATE1-ARB-RATIFICATION`) — the human signature that turns the Constitution's "RATIFIED. SUPREME." from a self-declaration into fact.

---

# Phase 0 — Repository Truth Freeze

### Goals
Make the single correct reality (the working tree) **durable and version-controlled** without triggering the **commit trap**, and without re-arming the survivability self-block in a committed window. This is the persistence seam that gates **every** Class-A fix in the entire audit (Phase 7 GOV-1). It is one act, but it sits in front of all others.

### Deliverables (convergence artifacts — commits, not features)
- One privileged, clean-tree commit on `stepup/main` that **stages the whole working tree with `git add -A` first** (so the tracked-deleted files AND their untracked archive copies are captured atomically), then commits. Specifically it must capture:
  - The constitutional layer: `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` + 6 sibling rewrite docs (verified untracked), `STRATEGIC_CANONICALIZATION_2026_06_10/`, root `AGENTS.md` (AGENTS_V2, tracked-modified), `CLAUDE.md`.
  - The money/identity/tenancy migrations: `162_phase_a_commission_zero`, `163_d2_live_data_leak_rls`, `164_d4_tenant_role_guc`, `165_d5_canonical_money_paths`, `166_d6_checkout_handoff_inventory` + their 5 rollbacks (all verified untracked — the **highest-priority preserve**).
  - The 22 untracked Phase-B/C/D validators (the *only* money/identity gates — a clean clone today has **none**) + `scripts/validate-governance.mjs` (the 90-lane gate, tracked-modified).
  - `EXECUTION_LEDGER.md` + `SKIPPED_HUMAN_DECISIONS.md` (validator-required verbatim; untracked).
  - Both 2026-06-10 archives under `docs/archive/` (the only copies of FORENSIC_MASTER, GOVERNANCE_HARDENING, FOUNDATION_AUTOPSY, etc.) + `docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md` (validator-pinned).
  - The already-executed deletions finalize at this commit: 8 rejected package roots / 154 files, 77 WT-deleted theater validators, 69 WT-deleted theater test files, 6 helm/k8s files, the app-local mobile token forks — all preserved in git history.

### Dependencies
- **GATING DECISION 1 (ARB Survivability Repeal) must be recorded first**, so the unhook can be authored *into* this commit (see Phase 1 Goals and the Pivotal Insight). Phase 0 staging includes the region-assert strip and the honest topology iff ordering #1 is chosen; otherwise the unhook is the immediately-preceding commit (ordering #2).

### Risks
- **The commit trap (highest-risk action in the audit).** 58–60 root `.md` + the 8 newest archive dirs are tracked-deleted with untracked-only archive copies. A tracked-only `git commit -am` **orphans the archive** (the deletions land, the new copies do not). A `git checkout .` resurrects all 60 root artifacts at HEAD (the condemned regime). A `git clean -fd` **permanently destroys** the Constitution, AGENTS_V2, migs 162–166, the 22 validators, and both archives — zero history anywhere. Mitigation: **`git add -A` is mandatory and first; `git clean -fd`/`git checkout .` are forbidden** until after the commit is durable.
- Committing arms the survivability self-block (Pivotal Insight) — mitigated only by the Phase-1 unhook being in/before this commit.
- `migration-safety-validator` is structurally blind to untracked migrations (scans `getTrackedFiles()` only); committing 162–166 also resolves that blindness (Phase 7 GOV-3 / DB-1).

### Delete Actions (from Phase 5, executed here)
All **SAFE_DELETE [COMMIT]-finalized** rows — these are already-executed deletions that this commit makes durable (git history preserves them):
- 8 worktree-deleted rejected package roots / 154 files (`app-engine`, `application-services`, `distributed-runtime`, `extension-host`, `orchestration`, `projection-runtime`, `runtime-composition`, `search-core`) — condition met: 0 residual `@letbuyy/*` imports re-verified.
- 77 WT-deleted theater validators + 69 WT-deleted theater test files + 6 helm/k8s files — condition met: copies archived / history-preserved.
- `packages/dart/services`; `packages/typescript/ui/src/mobile-tokens.ts`; app-local mobile token forks — condition met: replaced by DTCG bridge, `--check` exit 0.
- The machine-local junk that is not a tracked artifact may be removed any time *after* the commit is durable (never as a pre-commit `clean`): `build/` (161 MB), `.dart_tool/`, `.tmp/` (empty), `test-results/`, `.pnpm-store/`, `.turbo/`, `.codex/` (empty), `.codex-dev.log` (0 bytes), `.DS_Store ×3`, `git stash@{0}` (inspect-then-drop).

### Validation Criteria
- `git status --porcelain` shows **0 untracked governance/migration/validator/archive paths** that belong to the canonical set (the `??` count drops from 78 to only genuinely-ignored machine residue).
- A **clean clone** (`git clone` + checkout, no dirty tree) contains migrations 162–166 and all 22 money/identity validators; `supabase db push` from the clone would include 162–166 (resolves DB-1 / LED-1 / GOV-3).
- The gate runs green **from tracked files only** (not off a dirty disk) — i.e. `rls-force-coverage-validator` no longer errors on an absent untracked `164_*`.

### Exit Criteria (binary)
The entire hardened working tree exists as committed history on `stepup/main`, a clean clone reproduces it exactly, and **no `git clean -fd` can destroy the canonical reality** because it is now tracked. The commit was made with the survivability-unhook already applied (or as the immediately-following commit before any push). `main` is **not yet** fast-forwarded (that is Phase 6).

---

# Phase 1 — Governance Convergence

### Goals
Make the Constitution stack the single, **ratified**, **in-force** law; perform the **survivability-unhook** so the gate stops mandating the rejected multi-region architecture; collapse the scan-AGENTS proliferation to one root law; and archive the dangerous prompt corpus. This is the phase that resolves the GATE-1 self-block — both halves of it (the inverted-root original and the reborn end-state-validator version).

### Deliverables (convergence artifacts)
- **The [SURVIVABILITY-UNHOOK] paired retarget** (sequenced with/before the Phase-0 commit per the Pivotal Insight): strip the `globalRegions` 4-region assert and the `validate:survivability/production-certification/reconciliation/queues` workflow mandate from `whole-repo-end-state-validator.mjs:172-193`; delete `survivability-governance-validator.mjs` wholesale (it is a theater validator per ART-02); remove the `validate:survivability` (+ 6 theater aliases) lanes from `package.json` and from `architecture-governance.yml` / `production-rollout.yml` / `live-production-certification.yml` **in the same change**; remove `regions.globalRegions` from `config/runtime/production-topology.json`; re-run the gate green.
- **ARB GATE-1 ratification** (`SKIP-GATE1-ARB-RATIFICATION`): the human signature; then fix the Constitution status line per `DOC-R3` (the self-declared "RATIFIED. SUPREME." becomes true rather than asserted).
- **Anti-scan validator retargeted below root** so it polices the 47–79 nested `AGENTS.md` (today `no-scan-generated-agents-validator.mjs:7` reads only root — every nested copy is unpoliced law an agent obeys).
- **Resolve the live self-contradiction:** amend `AGENTS.md` AGENT-R16 (which mandates reading `memory/lessons.md` + `tasks/todo.md`) to point at living equivalents *before* those 2026-03-01 fossils are archived; resolve `LEG-078` (which sentences `memory/lessons.md` to DELETE while AGENT-R16 mandates reading it).
- **Rewrite (not delete) `MERGE_RUNBOOK.md`** so `SKIP-D1` sends the maintainer to the real `stepup/main → main` promotion (current text merges two non-existent `stream/*` branches into `develop`).

### Dependencies
- **Phase 0 commit** (the law must be durable to be ratified) — but the unhook half **precedes/accompanies** the commit (Pivotal Insight).
- **GATING DECISION 1 (ARB repeal)** — the unhook cannot start without it (no `SKIP` row covers the "keep multi-region" decision; ARB must rule).
- **GATING DECISION 3 (ARB GATE-1 ratification)** — a human seam (Class B).

### Risks
- **Ordering risk = the single biggest sequencing risk in the whole roadmap.** If the unhook lands *after* a pushed commit, the canonical gate certifies the rejected multi-region topology in a committed window. Mitigated by ordering #1/#2.
- Deleting the nested `AGENTS.md` *before* retargeting the validator below root leaves dangling authority references; the retarget must precede the deletes.
- The unhook is an **ARB-level act, not a janitor edit** — `survivability-governance-validator` is self-protecting (removing the topology lines fails the gate; removing the validator requires editing the gate wiring). The two must move together.

### Delete Actions (from Phase 5)
- **DELETE_AFTER_MIGRATION → executed here, gated on [SURVIVABILITY-UNHOOK]:** delete `survivability-governance-validator.mjs` + the 10 `validate:production-certification` validators + `operational-proof-validator.mjs`; strip the region block from `whole-repo-end-state-validator.mjs` (KEEP the keystone validator itself); delete the 6 package.json theater aliases (`validate:distributed-execution/durable-execution/distributed-survivability/operational-certification/replay/survivability-intelligence`) **with the `architecture-governance.yml:75-81` workflow retarget in the same change** (`DEL-R3`); delete the `validate:rollback` alias **after authoring the real rollback validator first**.
- **SAFE_DELETE (post-commit):** the 11 zero-reference orphan validators (`contracted-domain-event-ingress`, `custom-domain-abuse-screening`, `custom-domain-reconciler`, `gateway-events-client`, `mobile-domain-parity`, `no-orphan-webhook-delivery-queue`, `observability-producer`, `registrar-provider`, `replayable-secret-persistence`, `shopper-identity-seam`, `vercel-domain-automation`) — 0 external refs re-verified; the 80 generated-intelligence docs (`docs/**/README.md` tree + `docs/architecture/{master-system-intelligence,README}.md`) — unregenerable stale falsehoods; the prompt-factory `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md` + 6 `TERMINAL_*` relaunchers + 3 rejected-package missions + 1 duplicate identity-stepup mission.
- **DELETE_AFTER_MIGRATION (delete the 47–79 nested + scan-gen root `AGENTS.md`)** — condition: anti-scan validator retargeted below root first; the scan-gen *root* copy deletes only once AGENTS_V2 is the committed root law.
- **ARCHIVE (git mv under `docs/archive/`):** `docs/agents/` (40 files), `docs/Codex_waves/` (26), `docs/audit/` (19), `docs/audits/apps-platform/` (23), the docs-root prompt/plan family (`CODEX_LETBUYY_FOUNDATION_MISSION.md`, `LETBUYY_MASTER_EXECUTION_PLAN.md`, `LETBUYY_CODEX_IMPLEMENTATION_MASTER.md`, P0–P4), the frozen-app mission/audit families, `memory/lessons.md` + `tasks/todo.md` (after AGENT-R16 amendment), `MERGE_RUNBOOK.md` old text (after rewrite); the 13 contradicting + 4 validator-required `docs/governance/*` docs + 6 theater runbooks ride the [SURVIVABILITY-UNHOOK] and are archived after it (their references in reserved-manifest `governanceDocs` must be retargeted in the same move).

### Validation Criteria
- **The gate passes WITHOUT the survivability lock** — `validate-governance.mjs` is green and `production-topology.json` has **no `globalRegions` block**, with `globalRegions`/`survivability` asserted by **no** validator (grep the validators for `globalRegions` → 0 hits).
- The anti-scan validator fails on a planted nested `AGENTS.md` below root (proves the perimeter extended).
- `git grep -l "GENERATED BY scripts/generate-repository-intelligence"` returns 0 tracked files; `*MISSION*`/`*PROMPT*`/`*BLUEPRINT*` outside `docs/archive/` returns 0 (or a new ratchet fails on them).
- `SKIPPED_HUMAN_DECISIONS.md` shows `SKIP-GATE1-ARB-RATIFICATION` **signed**; the Constitution status line reads ratified-by-ARB, not self-declared.

### Exit Criteria (binary)
The Constitution stack is the committed, ratified, in-force law; the canonical gate is green and **no longer mandates a single multi-region artifact**; there is exactly one root `AGENTS.md` (AGENTS_V2) policed below root; and every dangerous prompt/blueprint program is under `docs/archive/`.

---

# Phase 2 — Identity Convergence

### Goals
Converge identity onto the **`identity-platform` asymmetric ES256/EdDSA sole issuer** by deleting the loser mint paths once the winner is live, and **name** (do not design) the identity capability gaps that survive convergence.

### Deliverables (convergence artifacts)
- Retarget the gateway to **verify-only** against env-injected JWKS (`identity-session-verifier.ts`, now committed); run the `IDN-R2` dual-verify drain (telemetry: zero legacy-HS256 verifications) as the gate before any mint-path delete.
- Collapse the cookie/CSRF sprawl: consolidate the ≥11 cookie-name authorities and the **two** CSRF cookie names (`lb_csrf` / `letbuyy_csrf`) to one canonical CSRF name (convergence N→1, no new design).
- Demote the 664–917 `getSupabaseAdmin` plane is a **Database/Phase-6** concern; here only the identity-foundation shadow stack and mint paths are in scope.

### Dependencies
- **Phase 0 commit** (the issuer/verifier files `identity-issued-session.ts` + `identity-session-verifier.ts` are untracked until then).
- **Phase 1** (governance committed/ratified).
- Live identity keypairs/JWKS — **`SKIP-D3` (Class B, human seam)** — without them the new topology **fails closed in production** (the seam's own blast-radius statement). This gates *go-live*, not the convergence deletes.

### Risks
- Deleting the `randomHex(32)` mint or the `/api/auth/switch` branch **before** the dual-verify drain proves zero legacy verifications strands any still-issuing legacy session. The drain telemetry is the hard gate.
- The asymmetric property covers **exactly one** of ~5 token types today (merchant session); deleting the HS256 minters before each realm (shopper/console/app/magic-link/`lb_accounts`) is re-homed breaks those realms.

### Delete Actions (from Phase 5)
- **DELETE_AFTER_MIGRATION:** gateway `randomHex(32)` mint (`auth.ts:1140`) + the `/api/auth/switch` mint branch — condition: `IDN-R2` dual-verify drain shows zero legacy-HS256 verifications.
- **DELETE_AFTER_MIGRATION:** the 18-file `services/api-gateway/src/identity-foundation/` shadow stack — condition: identity-platform serves verify-only **live** (`IDN-R3` SAFE_DELETE gate).
- **DELETE_AFTER_MIGRATION:** the `auth-core` HS256 minters per realm — condition: each realm re-homed onto an asymmetric or dedicated-secret replacement (this re-home is *capability work*, gated below, not a convergence delete).
- The dev-only `localAuthSessions` in-memory Map is SAFE_DELETE (dead in prod).

### Out-of-convergence capability prerequisites (NAMED, not designed — BLOCKED gates)
- **BLOCKED — `verifySensitiveActionStepUp` real crypto.** Step-up is a self-served `mock-step-up-${uuid}` (≥12-char) certified by a validator, guarding refund/payout/DSR-erase (Phase 7 ID-3, Class C). A real TOTP/passkey/re-auth challenge is **capability work, out of scope for convergence**. Convergence only stops the validator from *allowlisting the mock* once the real path exists.
- **BLOCKED — per-realm HS256 re-home.** Moving shopper/console/app/magic-link/`lb_accounts` issuance into the asymmetric issuer is engineering, not a delete (Phase 7 ID-5). Named only.
- **BLOCKED — stateless JWT revocation** (Phase 7 ID-6) and **OIDC/OAuth/passkeys** (501 skeleton, Phase 7 ID-4) — capability, out of scope.

### Validation Criteria
- Dual-verify telemetry reads **zero legacy-HS256 verifications** for the drain window before the mint-path delete.
- After the delete: `git grep "randomHex(32)"` in the session-mint path → 0; `/api/auth/switch` no longer contains a mint branch; the `identity-foundation/` directory is gone.
- The `identity-sole-issuer-validator` passes with the shadow stack removed.

### Exit Criteria (binary)
The gateway and all realms **verify** sessions against the identity-platform issuer; the legacy mint path, the `/switch` takeover branch, and the 18-file shadow stack are deleted; and the four identity capability gaps (step-up crypto, per-realm re-home, JWT revocation, OIDC) are recorded as out-of-convergence prerequisites with no design attempted.

---

# Phase 3 — Money Convergence

### Goals
Make the **canonical append-only double-entry ledger** the single money truth by committing its authority layer and collapsing the duplicate writers/rails around it; **name** (do not design) the four money capability gaps that no commit closes. This is the phase where the line between convergence and engineering is sharpest.

### Deliverables (convergence artifacts)
- Commit-gated authority: migrations `160` (reconciliation tables, `claim_payout_statement_release` balance gate, capture/refund ledger columns), `162` (commission-zero defaults + `commission-bps-zero-validator`), `165` (settlement source-row ownership, ledger UPDATE/DELETE revoke from every role incl. service_role) — all land at Phase 0; this phase makes them the operative authority.
- Retarget `wallet.ts` reads to derive from the canonical ledger; demote `wallet_ledger_entries` / `payout_statements` / `commission_*` (mig 119) and the mini-ledgers to **read-only projections** (not deleted — they back the wallet read until zero-drift).
- Collapse the payout rail: delete the `razorpayx` self-custody **defaults** (the commit removes them), schedule the enum/CHECK residue purge.
- Retarget `canonical-ledger-only-validator` to see SQL-side writers and add `orders` to its ratchet list — so the capture gap stops being **invisible** to the gate (this is the one genuine convergence step on the capture domain).

### Dependencies
- **Phase 0 commit** (160/162/165 untracked until then).
- **Phase 1** (governance/ratification).
- **ARB call on migration 162's in-place historical-row rewrite** (`162:14-22` rewrites settled commission rows with no ledger correction entry — an audit contradiction inside the fix; DATABASE_TRUTH §7.1): ledgered-correction vs accepted-backfill.

### Risks
- Committing code without 162–166 (e.g. a partial Phase 0) ships the kernel without its authority layer and silently omits the money fixes — a clean-HEAD `supabase db push` would skip them (DB-1). Phase 0's clean-clone validation guards this.
- The mutable model cannot be deleted (only demoted) until the wallet read derives cleanly without manual ops — and that requires the reconciliation wiring, which is a capability gap (below). **A delete here does not produce a working SoT.**
- Deleting the `razorpayx` enum residue before a provider client exists is harmless (transfer is fail-closed dead code either way) but must wait on the enum-purge migration.

### Delete Actions (from Phase 5)
- **DELETE_AFTER_MIGRATION (demote, then delete as truth):** mutable `wallet_ledger_entries` / `payout_statements` / `commission_*` *as truth source* — condition: 160/162/165 committed + reconciliation refreshers wired to a scheduler + zero-drift reconciliation proof (`SKIP-D5`) + backfill (`DEL-R2`). Until then they stay as projections.
- **DELETE_AFTER_MIGRATION:** the never-consumed `scheduled` `payouts` instruction rows (`settlements.ts:283`) and the `orders.total`-derived payout gross — condition: ARB picks the surviving writer per flow (statements + claim guard is the named winner).
- **DELETE_AFTER_MIGRATION:** `razorpayx` enum/CHECK residue in ~8–11 sites + `partner_payout_ledger_entries.rail` CHECK — condition: enum-purge migration after the commit removes the defaults.
- **DELETE_AFTER_MIGRATION:** the 3-regex theme sanitizer is a *theme* concern (Phase 4); the no-ledger `confirm_order_payment_with_ledger` body's misleading `_with_ledger` name deletes only **after** a ledgered path replaces it (capability-gated, below).

### Out-of-convergence capability prerequisites (NAMED, not designed — BLOCKED gates)
- **BLOCKED — storefront/webhook capture ledgering.** `confirm_order_payment_with_ledger` (`000_baseline.sql:1590`) writes **zero** canonical ledger lines on the path every shopper hits, in all three realities (Phase 7 PAY-1, the #1 unfinished winner). Making the storefront/webhook confirm chain post canonical `payment_capture` entries is **capability work, out of scope for convergence** — survives any commit/merge.
- **BLOCKED — payout provider client.** `initiateTransfer` unconditionally throws `PayoutProviderUnavailable` (`payout-transfer-adapter/index.ts:104-105`); **no `PayoutProviderClient` exists in any branch** (Phase 7 PAY-2). Merchants can never be paid until one is built. Out of scope.
- **BLOCKED — reconciliation wiring.** `refresh/assert_money_ledger_site_reconciliation` + `backfill_wallet_ledger_to_canonical` have **zero runtime callers**; the wallet fails closed at HTTP 409 forever (`wallet.ts:163-176`) (Phase 7 PAY-3). Wiring a scheduled caller + an in-product operator-clear action is capability work. Out of scope.
- **BLOCKED — 2/3 refund paths ledgering** (`complete_order_refund`, webhook `refund.created`; Phase 7 PAY-4) and **`merchant_payable` cross-source dedup** (Phase 7 PAY-5) — named, not designed.

### Validation Criteria
- A clean clone applies 160/162/165; `commission-bps-zero-validator` passes; the canonical ledger has UPDATE/DELETE revoked from service_role (verify the `165:463-464` REVOKE is live).
- `canonical-ledger-only-validator` now reports the storefront capture writer (i.e. the gap is **visible**, not silently passing) — the convergence success here is *visibility*, not closure.
- The committed default commission is **0 bps** (`?? 0` everywhere; no `?? 300` fallback remains; DB default not 300).

### Exit Criteria (binary)
The canonical ledger authority (160/162/165) is committed and operative; the mutable model is demoted to read-only projection; the payout rail defaults to never-custody PA-split with the enum purge scheduled; and the **four money capability gaps (capture ledgering, payout client, reconciliation wiring, refund ledgering) are recorded as out-of-convergence prerequisites with no design attempted** — the roadmap explicitly does not claim the money SoT is reached by convergence.

---

# Phase 4 — Theme Convergence

### Goals
Converge the theme **schema and compose** sources onto the engine, make the DOMPurify sanitizer the deployable one, and **keep both renderers** — React is the FROZEN, load-bearing default and is **explicitly NOT deletable**; the Liquid winner's chrome is a named capability gap. This is the flagship honest-tension phase (completeness contradicts the strategic winner).

### Deliverables (convergence artifacts)
- Retarget the ~10 runtime-only schemas from storefront `RUNTIME_SECTION_SCHEMAS` (`renderer-registry.tsx:66`) into the engine `SECTION_SCHEMAS` (collapse the schema fork — N→1, no design).
- Retarget the Liquid render plan/canary resolution **out of** `template-resolver.ts` into the engine `composeStorefrontTheme` (the plan currently lives inside the React-side loser file).
- The committed DOMPurify + LiquidJS auto-escape (landed at Phase 0) replaces the `main`/HEAD 3-regex sanitizer as the deployable sanitizer — closing the XSS exposure on every storefront.
- De-duplicate the split `FEATURE_LIQUID` switch (gateway capability env vs `theme-governance.ts` canary flag) to one authority (prevents the `=true`-while-governance-`false` split-brain).

### Dependencies
- **Phase 0 commit** (DOMPurify sanitizer + parity table + freeze validator are untracked until then).
- **Phase 1** (governance).
- **ARB ratification of the deferred platform-wide Liquid flip** — gates *React deletion only*, not the schema/compose convergence.

### Risks
- **Deleting React prematurely blanks every storefront.** React is the runtime default for 100% of stores; Liquid has no header/footer, no data binding, an `index`-only template, no canary write path, no editor. This is the textbook "ratified winner is right but completeness forbids acting now." The schema/compose forks can converge to the engine **independently** of (and without waiting on) the renderer-deletion gate.
- Migrating the runtime-only schemas must not break the editor (which depends on the merged set) — migrate, don't drop.

### Delete Actions (from Phase 5)
- **DELETE_AFTER_MIGRATION (schema/compose forks — S3, independent of renderer gate):** `RUNTIME_SECTION_SCHEMAS` re-declaration and the `template-resolver.ts` compose re-impl — condition: migrated into the engine; editor re-pointed at the merged set.
- **DELETE_AFTER_MIGRATION:** the 3-regex sanitizer (`theme-renderer.ts:606-610`) — condition: DOMPurify is the live deployable sanitizer (Phase 0 commit).
- **DELETE_AFTER_MIGRATION (the React renderer + 20 frozen sections + `marquee.tsx`):** condition: the full **8-item THEME §10 Liquid parity gate** — Liquid header/footer + section-group routing + commerce-bound product/collection/cart/page templates + real cart/customer drops + canary write path + merchant install/edit/preview surface + per-section parity harness green + ARB ratifies the deferred platform-wide flip — **AND** D7 committed/deployed. **None deletable now.**

### Out-of-convergence capability prerequisites (NAMED, not designed — BLOCKED gates)
- **BLOCKED — Liquid chrome + data binding + templates + canary write path.** The ratified Liquid winner cannot run a real store: no header/footer (the plan hard-codes empty groups, `template-resolver.ts:213-216`), hard-coded product strings, `index`-only template, stubbed cart/customer drops, discarded head/SEO, **no write path**, no editor (Phase 7 THM-1, Class C). This is **capability work, out of scope for convergence** — the roadmap names it as the React-deletion prerequisite and designs none of it.
- **BLOCKED — 5 of 24 section types render a fallback box** (incl. the default-template `announcementBar`; Phase 7 THM-3) — named, not designed.

### Validation Criteria
- The engine is the single schema + compose source: `git grep "RUNTIME_SECTION_SCHEMAS"` → 0 (after migration); the Liquid plan no longer lives in `template-resolver.ts`.
- The deployable sanitizer is DOMPurify (the 3-regex path is gone); `no-new-react-sections-validator.mjs` still freezes React (it is NOT deleted).
- One `FEATURE_LIQUID` authority remains (no split switch).

### Exit Criteria (binary)
The engine owns theme schema and compose; the deployable sanitizer is DOMPurify; the `FEATURE_LIQUID` split-brain is resolved; **React remains as the FROZEN, load-bearing renderer (not deleted)**; and the Liquid chrome/data-binding/template/canary-write-path gap is recorded as the out-of-convergence React-deletion prerequisite with no design attempted.

---

# Phase 5 — Mobile Convergence

### Goals
Converge mobile onto **classic Navigator + composite BFF + ui_kit generated tokens + one reachable surface per capability** by deleting the dead navigation/widget/token duplicates; resolve the theme-editor by ARB pick (re-wire vs delete); and **name** (do not design) the mobile login capability gap that blocks any mobile launch regardless of the cleanup.

### Deliverables (convergence artifacts)
- Delete the dead GoRouter navigation system and its dependency; delete the `widgets/home/` dead twins; the app-local token forks are already deleted on the worktree (durable at Phase 0).
- Retarget the analytics screen onto the composite BFF `/v1/mobile/dashboard` once the BFF covers that field set, then collapse the 5-call gateway fan-out (`analytics_service.dart:371`).
- The DTCG token bridge (`--check` exit 0) is the single mobile token source (durable at Phase 0).

### Dependencies
- **Phase 0 commit** (the token-fork deletions, composite BFF, and fail-closed signing land there).
- **ARB pick on the theme editor** (re-wire the 1,800-line section editor by giving it a construction site/route, or delete it — it cannot persist as dead code).
- Confirm no external `/features/*` or deep-link consumers (none found in-repo; out-of-band unknowable).

### Risks
- The mobile **login Turnstile double-spend is a *bug*, not a seam, and blocks any mobile launch regardless of the nav cleanup** — it must be tracked as a capability prerequisite (below), not conflated with the convergence deletes.
- Deleting the dead GoRouter requires the same-change edit of the source-string tests (`mobile_services_test.dart:3791-3797`) that "protect" it; deleting the editor (if ARB chooses delete) requires rewriting the 42 source-string tests at `:947-1008`.

### Delete Actions (from Phase 5)
- **SAFE_DELETE (post-commit, with same-change test edits):** `lib/app/deep_link_router.dart` + the `go_router ^17.0.0` dependency; the `widgets/home/` duplicate twins; `widgets/shared/empty_state.dart`; `platform_blocked_screen.dart` + `platform_blocked_service.dart`; `upgrade_screen.dart`; `splash_screen.dart`; ui_kit dup pairs (one of `empty_state*`, one of `error_*`); the `pubspec.yaml` `run:super_admin` melos script (targets the sourceless reserved `operator-app`).
- **DELETE_AFTER_MIGRATION:** the mobile theme-editor pair (`customize/theme_screen.dart` 631L + `editor/section_editor_screen.dart` 1,200L + 12 `widgets/editor/*`, ~1,830 lines) — condition: ARB wire-or-delete decision + rewrite the 42 protecting source-string tests.
- **DELETE_AFTER_MIGRATION:** the 34 dead/capability screens + 36 `/features/*` routes — condition: per-screen wire-vs-delete product decision (KYC/2FA/returns invisibility is a product gap, not classic dead code).

### Out-of-convergence capability prerequisites (NAMED, not designed — BLOCKED gates)
- **BLOCKED — mobile login Turnstile single-verify.** The app pre-verifies the single-use Turnstile token at the BFF (`store_auth_service.dart:379` → `mobile-bff/index.ts:140-151` consumes it), then submits the **same** token to identity login, which re-verifies and gets `timeout-or-duplicate` → login **fails closed** (Phase 7 MOB-1, Class C). Spending the token exactly once (drop BFF pre-verify OR mint per-verifier tokens) is **capability work, out of scope for convergence**. The Turnstile prod secret (`SKIP-W7`) is a *second* independent failure mode (Class B, Phase 7).
- **BLOCKED — no store-publish pipeline** (no Play upload, no iOS lane; Phase 7 MOB-3) — named; iOS is a future lane, de-scoped for an Android/web beta.

### Validation Criteria
- `flutter analyze` + `flutter test` green after the GoRouter/twin/token deletes; `go_router` no longer in `pubspec.yaml`.
- One navigation system remains (Navigator); the analytics screen calls the composite BFF (the 5-call fan-out is gone) once the BFF field set covers it.
- The theme-editor ARB decision is recorded and executed (re-wired with a reachable route, or deleted with its tests rewritten).

### Exit Criteria (binary)
Mobile has one navigation system, one dashboard data path, one token source, and no dead GoRouter/widget/token duplicates; the theme editor is either reachable or deleted; and the mobile login Turnstile double-spend (plus the publish pipeline) is recorded as an out-of-convergence prerequisite with no design attempted.

---

# Phase 6 — Deployment Convergence

### Goals
Make the deployment topology **honest and lean**: deploy the now-frozen truth by fast-forwarding `main` (lag 30→0), collapse the staging/prod matrices, remove the frozen-app deploy rows, execute the one-region Infrastructure deletes that the Phase-1 unhook unblocked, and retire the second backend on a verified call-graph trace.

### Deliverables (convergence artifacts)
- **Fast-forward `main`** to the committed-and-ratified `stepup/main` (`DEPLOY-R1`: branch lag → 0) under a privileged clean-tree merge (`SKIP-D1`) — this is the act that finally deploys the hardened truth and retires `main` as the source of the condemned platform.
- Collapse the matrices: cut the frozen-app rows from **both** staging workflows and from `config/vercel/projects.json`; align the production matrix to the lean 5-Vercel + 4-worker topology.
- Execute the Infrastructure deletes that the [SURVIVABILITY-UNHOOK] (Phase 1) unblocked: `config/runtime/multi-region-runtime.json`, `survivability-execution.json`, `distributed-consistency-contract.json`, `chaos/`, `load/`, the 12×1-consumer + 3×2-consumer distributed contracts — each after its single consuming validator/script is retired.
- TRACE-gated second-backend retirement: per-page call-graph trace, then proxy-or-port + contract tests, then delete the merchant-control-plane 62 routes + storefront-runtime 21 routes (`gift-cards` ported, not proxied — it is single-writer in the wrong runtime).

### Dependencies
- **Phase 0 commit + Phase 1 unhook + GATE-1 ratification** (you cannot fast-forward `main` into an unratified, self-blocking gate).
- **Phase 5 (and 2–4) convergence** landed on `stepup/main` before the fast-forward.
- **Per-page call-graph trace (TRACE gate, UNVERIFIED in the audit)** — gates every MCP/storefront-runtime route delete.
- Live deploy provisioning is **Phase 7** (this phase makes the *config* honest; whether it goes live is the human-seam phase).

### Risks
- Fast-forwarding `main` **before** the unhook/ratification would deploy a gate that certifies the rejected multi-region topology (the Pivotal Insight at deploy scope) — forbidden ordering.
- Deleting a frozen-app deploy row while the gateway still serves its endpoints (`/app-store`, `/themes/:slug/reviews`) is safe (only the *row* is drift; the app source is KEEP/ARCHIVE-after-decision) — but deleting the app source is **out of scope** here.
- Deleting MCP/storefront-runtime routes **before** the call-graph trace risks removing a route a UI page actually calls — the trace is the hard gate; without it these are DELETE_AFTER_MIGRATION, not SAFE_DELETE.

### Delete Actions (from Phase 5)
- **SAFE_DELETE (post-commit):** frozen-app rows in **both** `deploy-staging.yml:99-102` + `staging-deploy.yml:189-198` and the 4 `config/vercel/projects.json` entries (lines 79/94/109/124); `config/runtime/replay-safety-contract.json` + `identity-residency.schema.json` (0 refs); the `tsconfig.workspace.json:68` dangling `packages/typescript/utils` reference; the `apps/storefront-runtime/src/app/demo/urban-kicks/` residue + the firebasestorage remotePattern.
- **DELETE_AFTER_MIGRATION (Infra, gated on the Phase-1 [SURVIVABILITY-UNHOOK]):** `config/runtime/multi-region-runtime.json` (+schema), `survivability-execution.json`, `observability-platform.json` (split its real prometheus rules into a non-theater validator first), the `production-topology.globalRegions` block (already stripped at Phase 1), the 12×1-consumer + 3×2-consumer distributed `config/runtime/*` contracts (each after its single consumer is retired), `infrastructure/scripts/{operations,load,chaos}/`, `tests/{chaos,survivability,replay,queues,operations,production-certification,cloudflare}`.
- **DELETE_AFTER_MIGRATION (TRACE-gated):** the merchant-control-plane 62 second-backend routes (48 `/api/stores/*` + 10 `/api/themes/*`) + the storefront-runtime 21 `/api` routes — condition: per-page call-graph trace + proxy-or-port cutover with contract tests; `gift-cards` ported.
- **ARCHIVE (DAP):** `apps/developer-portal` (ARB consolidation decision) + `apps/platform-operations-portal` (unique modules ported to `platform-console` first).
- The gateway `portfolio.ts`/`resume.ts` routers + BFF allowlist + the dead product-era DB tables are **DELETE_AFTER_MIGRATION** gated on `SKIP-D11` live writer probe + ARB non-store-site-type decision (a live-DB probe, so it straddles Phase 6/7).

### Validation Criteria
- `git rev-list main..stepup/main` → **0** (branch lag closed; `main` is the deployed truth).
- No frozen-app appears in any staging workflow or in `projects.json`; the production matrix lists exactly the 5 Vercel apps + 4 workers.
- `config/runtime/` contains no multi-region/distributed/survivability contract; `git grep -l "globalRegions\|failoverPairs\|multi-region"` in `config/` → 0.
- After the trace + cutover: no UI page calls a deleted MCP/storefront-runtime route (contract tests green); the gateway is the single commerce backend (`one-system-per-domain-validator` passes).

### Exit Criteria (binary)
`main` is fast-forwarded to the ratified truth (lag 0); the staging/prod matrices are lean and frozen-app-free; the entire multi-region/distributed/chaos/load contract layer is deleted (the unhook fully executed); and the second backend is either retired (trace complete) or carried as a single TRACE-gated DELETE_AFTER_MIGRATION with the trace named as its only blocker.

---

# Phase 7 — Production Readiness

### Goals
Close the **human seams** that no code change resolves, and **name** (do not design) the no-alerting capability gap and the residual capability prerequisites from Phases 2–5 that gate the first paying user. This phase is where convergence ends and the platform's go-live blockers are made explicit — it builds nothing, it **enumerates** what must still be provisioned or built.

### Deliverables (convergence artifacts — seam resolution + naming)
- Resolve the launch-blocking subset of `SKIPPED_HUMAN_DECISIONS.md` (Class B, human-only seams; ~9 of ~22 are launch-blocking):
  - `SKIP-D1` privileged clean-tree merge (executed at Phase 6); `SKIP-D3` identity live keys/JWKS/OIDC/Turnstile (without them merchant login fails closed); `SKIP-PROVIDER-SECRETS` (the 29 `SKIP_NEEDS_HUMAN_*` placeholders in prod wrangler vars, `wrangler.toml:255-267`); `SKIP-PROD-DNS-CUTOVER` + `SKIP-W3-DNS-CUTOVER` (`.com` resolution); `SKIP-D6` checkout cutover (DNS + Vercel host + `CHECKOUT_SIGNING_SECRET` + carrier creds + migration 166 apply — else prod checkout URLs fail closed); `SKIP-PROD-DEPLOY-PROMOTION` (branch protection); `SKIP-D2`/`SKIP-D4` live RLS/grant/FORCE probes (prove the anon-leak class is closed live); `SKIP-D5` live money reconciliation + split-rail credentials; `SKIP-W0-PITR` (recovery beyond a single `pg_dump`).
  - Deferrable-but-recorded: `SKIP-GATE-OPS-SURVIVOR-ARB`, `SKIP-D8`/`SKIP-W7` mobile signing/Turnstile, `SKIP-D10`/`SKIP-W7` WhatsApp/WABA, `SKIP-W4` rotation + mTLS, `SKIP-D11` cleanup probes.
- Retarget the observability config theater to the real Cloudflare Analytics Engine dataset **or** archive the Grafana/SLO/prometheus JSONs pointing at deleted k8s / empty reserved roots (convergence of *config*; the *capability* is named below).

### Dependencies
- **Phases 0–6 complete** (the truth is committed, ratified, deployed, and lean).
- The capability prerequisites from Phases 2–5 (below) — these gate the *first paying user*, not the convergence.

### Risks
- Provisioning a Sentry DSN (`SKIP-W3`) **does nothing** because no error-tracking SDK consumes it — the seam is *moot* without the capability build (the classic Class-B-looks-like-the-fix-but-Class-C trap). Naming this prevents a false "we provisioned alerting" claim.
- Resolving the merge/keys/DNS seams without the money capability builds yields a platform that **deploys cleanly but cannot ledger a sale, pay a merchant, show a wallet, enforce step-up, alert on a break, render a Liquid store, or log into mobile** (Phase 7 §5). The seam resolution is necessary, not sufficient.

### Delete Actions (from Phase 5)
- **SAFE_DELETE / ARCHIVE (config theater, after retarget-or-replace):** the dangling `prometheus-rules.yaml`, `otel-collector.yaml` (exports to deleted k8s `*.letbuyy-observability.svc.cluster.local`), and the 6 Grafana dashboard JSONs + `slo-catalog.yaml` rows assigned to empty reserved roots — archived once retargeted to the real dataset or replaced.
- No new deletes originate here; the live-DB-gated `SKIP-D11` deletes (dead product-era tables `portfolio_projects`/`resume_versions`/`gallery_items`/`skill_endorsements` + `sites.site_type` enum shrink; the duplicate `provider_payment_id` index 107-vs-142; the 25 residual PUBLIC `USING(true)` policies) execute here **after** the live `pg_stat_user_tables` / `pg_policies` / `pg_indexes` probes that only a human with DB access can run.

### Out-of-convergence capability prerequisites (NAMED, not designed — the go-live boundary)
- **BLOCKED — no alerting end-to-end (the launch-critical operability gap).** `prometheus-rules.yaml` alerts on 7 metrics with **zero code emitters**; `otel` exports to a deleted cluster; **no error-tracking SDK in any runtime**; **no alert delivery channel** (no PagerDuty/Opsgenie/Slack/webhook); `MONEY_LEDGER_RECONCILIATION_ALERT_READY` is a config flag name with no backing capability (Phase 7 OBS-1/OBS-2, Class C). An alert channel fed by emitted metrics + an error SDK is **capability work, out of scope for convergence** — named as a launch blocker for any money platform.
- **BLOCKED — the carried capability prerequisites from Phases 2–5** that gate the first paying user: storefront capture ledgering, payout provider client, reconciliation wiring, step-up real crypto, Liquid chrome, mobile login single-verify, 2/3 refund ledgering. All named, none designed.

### Validation Criteria
- `SKIPPED_HUMAN_DECISIONS.md` shows every launch-blocking `SKIP-D*`/`SKIP-W*` either signed/provisioned or explicitly badged-deferred with its blast radius.
- The observability config no longer references a deleted k8s cluster or an empty reserved root (retargeted or archived).
- A written go-live gate enumerates the named capability prerequisites (alerting, capture, payout, reconciliation, step-up, Liquid chrome, mobile login) as **out-of-convergence builds** — convergence is complete, but the platform is explicitly **not** declared launch-ready until those ship.

### Exit Criteria (binary)
Every human seam is resolved or badged-deferred with its blast radius recorded; the observability config theater is retargeted or archived; and the no-alerting gap plus the residual money/identity/theme/mobile capability prerequisites are recorded as the explicit, un-designed boundary between "converged" and "launch-ready." **Convergence is done; the named capability builds are the platform's remaining go-live work and are out of this roadmap's scope.**

---

## Capability-Gap Boundary — what this roadmap deliberately does NOT do

This roadmap **adds no features, redesigns no architecture, invents no systems.** It only converges: commit, ratify, delete, archive, retarget, collapse N→1. Every genuine capability gap is **named as an out-of-convergence prerequisite and left undesigned** — restating the boundary the user mandated. These survive *any* commit, *any* merge, and *any* secret; a delete does not fix any of them:

| Gap (named, not designed) | Phase that names it | Why it is out of convergence |
|---|---|---|
| **Storefront/webhook capture ledgering** — `confirm_order_payment_with_ledger` posts 0 canonical ledger lines on the path every shopper hits | 3 | The #1 unfinished winner; capability, survives any merge (Phase 7 PAY-1) |
| **Payout provider client** — `initiateTransfer` throws; no `PayoutProviderClient` in any branch | 3 | Merchants can never be paid until built (Phase 7 PAY-2) |
| **Reconciliation wiring** — refreshers have 0 callers; wallet 409s forever | 3 | Scheduled caller + operator-clear action is a build (Phase 7 PAY-3) |
| **2/3 refund paths ledgering + `merchant_payable` dedup** | 3 | Reversing entries + cross-source dedup are builds (Phase 7 PAY-4/5) |
| **Step-up real crypto** — self-served mock token guards refund/payout/DSR-erase | 2 | TOTP/passkey/re-auth is a build; convergence only stops the validator allowlisting the mock (Phase 7 ID-3) |
| **Per-realm HS256 re-home + JWT revocation + OIDC** | 2 | Asymmetric re-keying of 4 realms + revocation list + OAuth are builds (Phase 7 ID-4/5/6) |
| **Liquid header/footer + data binding + full templates + canary write path + editor** | 4 | The ratified winner cannot run a real store; this is the React-deletion prerequisite, undesigned (Phase 7 THM-1) |
| **Mobile login Turnstile single-verify** | 5 | A bug fix (drop BFF pre-verify or mint per-verifier tokens), not a convergence delete (Phase 7 MOB-1) |
| **Alerting end-to-end** — no emitters, no error SDK, no channel | 7 | An alert channel + metric emitters + error SDK are builds; the Sentry DSN seam is moot without them (Phase 7 OBS-1/2) |

The roadmap's **only** contributions to these domains are convergence-legitimate: it *commits* their authority migrations (160/162/165/164/163/166), *retargets* the validators so the gaps become *visible* (e.g. `canonical-ledger-only-validator` sees the SQL capture writer; the step-up validator stops certifying the mock once a real path exists), and *names* the build as the BLOCKED prerequisite gating go-live. It designs none of them.

---

## Unknowns / UNVERIFIED

All carried from the prior phases; none resolvable by read-only git, all gating one or more roadmap steps.

1. **Live deployed reality** — which of `main`/HEAD/working-tree actually serves production; whether 162–166 were applied out-of-band; live Vercel/Cloudflare/Supabase state. `production-topology.json` self-labels `governance-contract-not-live-evidence`. Every "Target SoT lives on the working tree" and every live-DB-gated delete inherits this.
2. **ARB intent on multi-region** — whether the survivability restore was directed or program-improvised; **no `SKIP` row covers the "keep" decision**. This is the single decision the ARB must adjudicate to unblock the Phase-1 unhook (Gating Decision 1). Phase 5 §5 / ARCHITECTURAL_DRIFT §11.1.
3. **Per-page call-graph (the TRACE gate)** — which surface (gateway vs MCP-62 vs storefront-runtime-21) each UI page calls. Gates every Phase-6 second-backend delete. UNVERIFIED (CODEBASE_REALITY §13.4).
4. **Live-DB probes for `SKIP-D11` deletes** — `pg_stat_user_tables` (dead product-era tables, `leads`/`comments`, gift-cards), `pg_policies`/grants (the 25 residual PUBLIC `USING(true)` policies + their live anon-reachability), `pg_indexes` (the duplicate `provider_payment_id` index). Gate the Phase-6/7 DB-level deletes.
5. **Whether the capture / payout / step-up / alerting gaps were closed out-of-band in production** — code-derived from all three repo realities; live behavior UNVERIFIED. If any shipped out-of-band, the corresponding BLOCKED gate would soften — but no repo evidence supports it.
6. **Count divergences (winner spine unchanged):** `getSupabaseAdmin` 664–917; nested `AGENTS.md` 38–79; generated-intelligence docs 67–80. The roadmap carries the larger figure as the delete-set; none change a winner or a sequencing step. [SEED-CONFLICT, magnitude]
7. **`_GOVERNANCE_SPINE.md`** — cited 26× by canon docs, exists nowhere; authored-and-lost vs never-written undetermined. Adds a dangling-citation cleanup to Phase 1 (author it or strip the 26 citations).
8. **Newest-copy direction for diverged prompt twins**, **changeset release-flow**, **per-file behavioral-value of source-regex tests**, **ui_kit unused-export pruning** — minor INVESTIGATE probes folded into the relevant phase's archive/delete step.

---

*End of Phase 9 — REPOSITORY CONVERGENCE ROADMAP. DISCOVERY / PLANNING ONLY — the single file written is this report; read-only git; no code, no architecture, no new systems, no codex prompts. Every phase is consistent with all 8 prior convergence-phase reports and the premise seed; every winner binds to `_PREMISES_SEED.md` with zero overturns. The roadmap only converges (commit / ratify / delete / archive / retarget / collapse N→1); every capability gap is named as an out-of-convergence prerequisite and explicitly left undesigned. The load-bearing sequencing facts (the commit trap, the survivability self-block at `whole-repo-end-state-validator.mjs:171-193` + `survivability-governance-validator.mjs:94-107`, the 30-commit `main` lag, the untracked 162–166) were re-verified live this phase.*
