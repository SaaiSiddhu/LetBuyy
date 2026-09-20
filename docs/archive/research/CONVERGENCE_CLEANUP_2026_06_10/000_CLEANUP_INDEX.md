# LetBuyy — Convergence Cleanup Program (Single Source of Truth Elimination) — 2026-06-10

**Research + decision phase only. No code, migrations, validators, architecture, or commits were created or modified; nothing was deleted. Read-only git throughout.** This program produces the definitive cleanup strategy **and** the safe Codex execution prompt, layered on the two prior audits (`REPOSITORY_TRUTH_AUDIT_2026_06_10/` 14 reports, `CONVERGENCE_AUDIT_2026_06_10/` 10 reports). Per request, all 9 phases were **re-derived fresh** and independently re-verified against source.

- **Baseline (re-confirmed live):** branch `stepup/main`, HEAD `c4fc3cd6`, +30 over `main`, working tree **512 D / 410 M / 79 ??**, 1,254 markdown files.
- **Result of fresh re-derivation:** the 14 strategic winners survive with **zero overturns**; key counts refined (917 `getSupabaseAdmin` occurrences across 99 files all in api-gateway; 79 nested AGENTS.md; 62 merchant-control-plane routes confirmed to be **BFF proxies**, not a second DB backend; `.DS_Store` ×11).

---

## The 9 deliverables

| Phase | File | What it is |
|---|---|---|
| 1 | **REPOSITORY_FORENSICS_REPORT.md** | Fresh duplication forensics — 31-cluster ledger across 12 categories + heat map |
| 2 | **STRATEGIC_WINNERS_FINAL.md** | 14 winner/loser calls with reason, risk, migration complexity (0 overturns) |
| 3 | **SINGLE_SOURCE_OF_TRUTH_MASTERPLAN.md** | ~22 domains → one owner/impl/authority + convergence path + blocker class |
| 4 | **SAFE_DELETION_PLAN.md** | DELETE/ARCHIVE/KEEP with path/reason/deps/risk, ordered into Batches 0–6 |
| 5 | **DOCUMENT_CONVERGENCE_PLAN.md** | 1,254-doc census → keep/archive/rewrite/delete; the generated-stale README problem |
| 6 | **PROMPT_DRIFT_ELIMINATION_PLAN.md** | Drift-capable prompts → delete/quarantine + the structural anti-drift guard |
| 7 | **GOVERNANCE_CONSTITUTION.md** | The cleanup constitution — final authority chain + 8 Cleanup Laws + drift regime |
| 8 | **LETBUYY_CONVERGENCE_EXECUTION_MASTERPLAN.md** | Phases 0–8, each with goals/inputs/outputs/risks/validation gates + batch/law mapping |
| 9 | **docs/archive/codex-prompts/CODEX_REPOSITORY_CONVERGENCE_EXECUTION_PROMPT.md** | Historical HALT-mode predecessor prompt archived after transformation into the canonical foundation stepup execution prompt |

`_PREMISES_SEED.md` (carried from the convergence audit) anchors the shared winner spine.

---

## The two things this program adds beyond the prior audits

**1. The Cleanup Governance Constitution (Phase 7)** names the final authority chain definitively and lays down 8 binding Cleanup Laws:

- **L1 Commit-before-delete** — Phase-0 truth freeze first; never `git clean -fd` / `git checkout .` (they destroy the only canon-conforming reality).
- **L2 Archive-before-delete** — historical-value deletions `git mv` to `docs/archive/` and commit first (beats the commit trap).
- **L3 Never delete a loser while its winner is uncommitted or undeployed** — `main` still ships the losers.
- **L4 Survivability-unhook-before-commit (keystone)** — committing arms the multi-region self-block; the ARB repeal must precede/accompany the commit.
- **L5 Proof-before-deletion** — cited no-consumer proof per delete; dead-table drops need a live writer probe.
- **L6 One-owner-per-domain** — collapse to the single Canonical Systems winner; no "fallback" coexistence.
- **L7 Prompt-perimeter** — no `*MISSION*`/`*PROMPT*`/`*BLUEPRINT*` outside `docs/archive/`.
- **L8 Human-seam respect** — `SKIPPED_HUMAN_DECISIONS` items are not code-completable.

**2. The Codex Execution Prompt (Phase 9)** operationalizes all of the above into a single self-contained order with: Rule #0 (never discard the working tree), a 15-item "things you must never do" list, explicit STOP/escalate conditions (the 22 open `SKIP-*` seams), 3 authority gates, the Batch 0–6 gated loop (precondition → action with proof → validation gate → roll-forward/abort), a capability-gap out-of-scope register, and a one-reality-lock self-audit.

---

## The pivotal sequencing insight (unchanged, re-verified)

Committing the working tree (Phase 0) **arms** the multi-region self-block: `survivability-governance-validator.mjs:94,106` is tracked **on `main`** and `whole-repo-end-state-validator.mjs:174` (untracked) both require `globalRegions:[india,apac,eu,us]`, contradicting the one-region Constitution. So the **survivability-unhook (ARB repeal) must land in or before the Phase-0 commit, never after** — encoded as Cleanup Law L4 and as the Codex prompt's Gate 2.

## The boundary this cleanup does NOT cross

Convergence (commit/archive/delete/retarget/collapse) cannot fix the ~6 genuine capability gaps that gate real money: storefront capture ledgering, payout provider client, reconciliation wiring, step-up real crypto, Liquid chrome + data binding, mobile single-verify login, and alerting. Every deliverable **names** them and the Codex prompt routes them to escalation; none designs a fix. Convergence-complete ≠ launch-ready.

## Provenance

9 deliverables + seed · ~3,260 lines · fresh agent-based re-derivation on top of 24 prior reports · HEAD `c4fc3cd6` · tree 512D/410M/79?? · 2026-06-10.
