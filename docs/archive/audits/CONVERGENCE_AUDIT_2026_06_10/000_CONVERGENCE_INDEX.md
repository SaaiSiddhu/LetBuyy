# LetBuyy — Repository Truth, Duplication Elimination & Convergence Audit — 2026-06-10

**Discovery & decision only. No code, migrations, validators, architecture, or codex prompts were created or modified. Read-only git throughout.** This audit layers *convergence decisions* on top of the prior `REPOSITORY_TRUTH_AUDIT_2026_06_10/` evidence base (14 reports) — it names winners, single sources of truth, delete classes, and a converge-only roadmap.

- **Repo baseline:** branch `stepup/main`, HEAD `c4fc3cd6` (2026-06-10). Working tree **512 D / 410 M / ~78 ??**, uncommitted. Deploy branch `main` is **30 commits behind**.
- **Method:** shared premise seed (winner spine + authority reconciliation) → 6 parallel analytical phases → 2 convergence-planning phases → roadmap → executive synthesis. All load-bearing claims lead-spot-checked against source.

---

## Verdict & scores (carried from the audit)

- **Repository Health: 3.1 / 10.** **Production Readiness: 2.3 / 10** from `main` today vs **5.5 / 10** working-tree end-state.
- **What LetBuyy is:** three platforms in one repo, separated in time — `main` (condemned, the only deploy branch), HEAD (+30), and the **uncommitted working tree** (the only canon-conforming reality, with **zero git history**). ~22 real / ~14 paper-only / ~9 ghost systems.
- **The winners are already decided** (14 scored calls, zero overturns): Liquid renderer · identity-platform asymmetric sole issuer · canonical append-only ledger · RLS+FORCE+GUC · api-gateway monolith · one-region topology · 0% commission · provider-split payouts · Constitution/AGENTS_V2 governance · `stepup/main` working tree. The losers survive only because the winner is **uncommitted, undeployed, or validator-mandated**.

---

## The pivotal sequencing insight

Committing the working tree (Phase 0) is necessary — but it **arms the multi-region self-block**: the 22 untracked validators that mandate `globalRegions:[india,apac,eu,us]` + survivability/chaos CI become gate-active the moment they're committed (`whole-repo-end-state-validator.mjs:172-193`, `survivability-governance-validator.mjs:94-107`), and they contradict the Constitution (`:98,:112`). Therefore the **SURVIVABILITY-UNHOOK (ARB repeal + paired validator/topology/workflow retarget) must land in or before the Phase-0 commit, never after.** This is the single highest-leverage decision in the roadmap.

---

## The 10 deliverables

| Phase | Report | What it decides |
|---|---|---|
| 1 | **REPOSITORY_TRUTH_REPORT.md** | What is real / paper-only / ghost; reality ledger; three-realities table |
| 2 | **DUPLICATE_AUTHORITY_REPORT.md** | 39 duplicate-authority conflicts across 27 domains → winner + migrate/delete/archive + risk |
| 3 | **SINGLE_SOURCE_OF_TRUTH_PLAN.md** | 21 domains: current → target SoT → convergence path → blocker class |
| 4 | **STRATEGIC_WINNER_DECISIONS.md** | 14 systems scored 7-dimensions → winner/loser + removal condition |
| 5 | **DELETE_CANDIDATES.md** | Every artifact in 6 classes (SAFE_DELETE / DELETE_AFTER_MIGRATION / ARCHIVE / KEEP / KEEP_CANONICAL / INVESTIGATE) |
| 6 | **PROMPT_DRIFT_REPORT.md** | Archive / Delete / Canonical prompt lists; the prompt-factory; registry gap |
| 7 | **FOUNDATION_GAP_REPORT.md** | 37 ranked production blockers; 11 S0; class split A≈4 / B≈9 / C≈24 |
| 8 | **ARCHITECTURAL_DRIFT_REPORT.md** | 41 drifts; root-cause taxonomy; the self-mandating-drift special case |
| 9 | **REPOSITORY_CONVERGENCE_ROADMAP.md** | Converge-only Phases 0–7 (goals/deliverables/deps/risks/deletes/validation/exit) |
| 10 | **LETBUYY_EXECUTIVE_TRUTH_REPORT.md** | Capstone — the user's 12 questions + five Top-10 lists |

`_PREMISES_SEED.md` is the shared input (winner spine + authority reconciliation) that kept all 10 consistent.

---

## The convergence spine (shortest path to production readiness)

0. **Truth Freeze** — `git add -A` commit the working tree (never `git clean -fd`/`git checkout .`); commit migrations 162–166 + 22 validators + Constitution + archives. Avoids the commit trap.
1. **Governance** — ARB ratify (SKIP-GATE1) **+ survivability-unhook before/with the commit**; collapse the 79 scan-AGENTS.
2. **Identity** — converge to asymmetric sole issuer; delete randomHex mint + `/switch` takeover branch + shared-AUTH_SECRET shadow stack.
3. **Money** — commit ledger authority; demote mutable wallet/commission to projection. *Named capability gaps remain (capture ledgering, payout client, reconciliation wiring).*
4. **Theme** — collapse schema/compose forks to the engine; React stays **FROZEN, not deleted** (no Liquid parity).
5. **Mobile** — delete dead GoRouter/widget/token duplicates; ARB-pick the editor. *Login double-spend is a capability gap.*
6. **Deployment** — fast-forward `main`; collapse staging/prod matrices; remove frozen-app rows; retire the second backend (call-graph-gated).
7. **Production Readiness** — resolve human seams (keys/secrets/DNS/PITR/Sentry/WABA); the no-alerting gap is named, not designed.

---

## What this audit deliberately did NOT do

No features, no redesign, no new architecture, no codex prompts, no code/migration/validator changes. The ~6 genuine capability gaps that gate real money flow (storefront capture ledgering, payout provider client, reconciliation wiring, step-up real crypto, Liquid chrome + data binding, mobile single-verify login, alerting) are **named as out-of-convergence prerequisites only** — never designed. Live infrastructure, live DB, and live providers were out of scope (no access) and flagged UNVERIFIED throughout.

## Provenance

11 files · ~3,410 lines · agent-based parallel audit on top of the 14-report truth audit · HEAD `c4fc3cd6` · tree 512D/410M/78?? · 2026-06-10.
