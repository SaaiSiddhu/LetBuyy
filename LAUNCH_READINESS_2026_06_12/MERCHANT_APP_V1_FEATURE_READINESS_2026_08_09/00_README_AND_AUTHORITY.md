# 00 — README AND AUTHORITY

**Package:** `LAUNCH_READINESS_2026_06_12/MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09/`
**Date:** 2026-08-09
**Audited commit:** `ee371182` (`ee3711829d857e986014c5811bb94d86ebc3d343`) on branch `stepup/main`
**Program:** Merchant App V1 — repository forensics, scope freeze, completion, launch execution

---

## 1. What this package is

This is an **evidence and implementation package**. It is a *map of what the repository
actually is* on 2026-08-09, a **frozen V1 scope** derived from that map, and a record of the
repository changes made during this program.

It is **not** a constitution, not an architecture document, and not a canonical-systems
registry. It creates no new authority and re-litigates no settled decision.

## 2. Authority position (subordinate, always)

This package sits at the **bottom** of the authority chain. On any conflict, the higher
authority wins and this package is void to the extent of the conflict.

| # | Document | Role |
|---|---|---|
| 1 | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (DOC 01) | **Supreme.** Nothing overrides it. |
| 2 | root `AGENTS.md` (DOC 02, `LETBUYY_AGENTS_V2`) | Operating rules for every agent and engineer. |
| 3 | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` (DOC 03) | Winner registry. |
| 4 | `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md` + `LETBUYY_FOUNDATION_ROADMAP.md` | Convergence sequencing. |
| 5 | `LETBUYY_UI_UX_GOVERNANCE.md` + `docs/governance/*` | Domain governance. |
| 6 | The launch-readiness program (`LAUNCH_READINESS_2026_06_12/`) | Program context this package registers under. |
| 7 | **This package** | Evidence + implementation record. Lowest authority. |

Specifically, this package **does not** modify or reinterpret: the scale envelope
(100 → 1,000 → 10,000 India merchants), the Never-Build List, the canonical winners
(canonical double-entry ledger, Liquid-first theme, `identity-platform` sole issuer,
RLS+FORCE+GUC tenancy, modular monolith, one region), 0% transaction fee, or never-custody.

## 3. Audited state

### 3.1 Commit and branch

```
HEAD                              ee3711829d857e986014c5811bb94d86ebc3d343
branch                            stepup/main
git rev-list --count main..stepup/main          106
git rev-list --count origin/main..stepup/main   291
```

The branch-lag counts are **not** incidental — they are the ART-03 / DEPLOY-R1 deploy
meta-blocker, and they are recorded as blocker `BLK-DEPLOY-001` in
[`07_GAP_BLOCKER_AND_DEPENDENCY_REGISTER.md`](07_GAP_BLOCKER_AND_DEPENDENCY_REGISTER.md).

### 3.2 Working tree — DIRTY and USER-OWNED

```
git status --short | wc -l                      6821
git diff --numstat | awk '$1+$2>0' | wc -l         84
untracked                                          27
```

**6,821 paths appear modified, but only 84 files have real content changes.** The remaining
~6,700 are file-permission flips (`100644` → `100755`) with byte-identical content.

Every pre-existing modification in this tree is **user-owned**. This program:

- never ran `git reset`, `git clean`, `git restore`, `git stash`, `git checkout <branch>`,
  `git commit`, or `git push`;
- never reverted, discarded, or overwrote a change it did not make;
- inspected `git diff` on every file before editing it;
- committed nothing. **All changes described in this package are uncommitted working-tree
  changes** awaiting the user's review.

### 3.3 Evidence classification used throughout this package

Every claim in this package carries one of these labels. They are not interchangeable.

| Label | Meaning |
|---|---|
| **STATIC** | Proven by reading source at `ee371182`, cited `path:line`. |
| **LOCAL RUNTIME** | Proven by executing something on this machine; the command and its output are recorded. |
| **STAGING** | Proven against a deployed staging environment. **Nothing in this package carries this label.** |
| **PRODUCTION** | Proven against production. **Nothing in this package carries this label.** |
| **HUMAN-PROVIDED** | Depends on a credential, account, or approval only a human can supply. |
| **UNVERIFIED** | Could not be settled here. Always paired with the exact probe that would settle it. |
| **NOT CONNECTED** | A live adapter exists but has no credentials. Never counted as a pass. |

### 3.4 Standing caveats

1. **A generated document is not evidence.** LCIS output, prior certification documents, and
   any scan-derived artifact are treated as *hypotheses requiring direct source verification*
   (DOC-R1, DOC-R2, ANTI-R8). Where LCIS and source disagree, source wins and the
   disagreement is recorded in
   [`10_LCIS_FINDINGS_AND_INDEPENDENT_RECONCILIATION.md`](10_LCIS_FINDINGS_AND_INDEPENDENT_RECONCILIATION.md).
2. **The LCIS code graph is stale relative to HEAD.** `pnpm lcis health` reports
   `graphCommit 0db025a6b8529dfac74fd781f944a49fcd2563fd`; HEAD is `ee371182`.
3. **Nothing here is deployed.** No claim of "live", "deployed", or "in production" is made
   anywhere in this package. Completion percentages measure the **working tree**, not
   production.
4. **`100% complete` means 100% of the frozen V1 scope** in
   [`05_V1_SCOPE_FREEZE_AND_EXCLUSIONS.md`](05_V1_SCOPE_FREEZE_AND_EXCLUSIONS.md) — never
   100% of every capability present in the repository.

## 4. Supersession and change control

This package **does not delete, overwrite, or contradict**
`V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_SCOPE_LOCK.md`.

That document classified `apps/mobile/merchant-app` as **V2 at ~68%** (§3, "Mobile app
(built ~68%, push dead, signing unprovisioned → V2)"). This program was asked to re-derive
the V1 scope from *current* state with the merchant app as the candidate centre. The prior
classification is therefore treated as a **prior hypothesis re-tested at `ee371182`**, and
the re-test result — including where it is **confirmed** — is recorded in
[`05_V1_SCOPE_FREEZE_AND_EXCLUSIONS.md`](05_V1_SCOPE_FREEZE_AND_EXCLUSIONS.md) §"Prior
mobile-V2 classification".

Registration duties observed:

- **`000_LAUNCH_READINESS_INDEX.md`** — this package is linked from the owning program index.
- **`PROMPTS.md`** — **no row required.** The prompt-perimeter validator registers artifacts
  whose *basename* matches the prompt-class token set (`MISSION|PROMPT|BLUEPRINT|MASTERPLAN|DELETION`).
  No filename in this package matches. This is the same reasoning recorded in
  `V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_SCOPE_LOCK.md` §Governance note.
- **`EXECUTION_LEDGER.md`** — the repository changes this program made are recorded there in
  the established row format (`Action ID | What changed | Files | Migrations | Tests added |
  Validators touched | Status | Commit`), with `Commit` left as the uncommitted working tree.

## 5. Package map

| # | Document | Contents |
|---|---|---|
| 00 | `00_README_AND_AUTHORITY.md` | *This file.* Authority, audited state, definitions, change control. |
| 01 | `01_EXECUTIVE_LAUNCH_DECISION.md` | What V1 is, the verdict, the largest blockers, what is excluded. |
| 02 | `02_COMPLETE_MERCHANT_FEATURE_INVENTORY.md` | Every merchant-facing capability, scored, with evidence. |
| 03 | `03_70_PERCENT_PLUS_V1_CANDIDATES.md` | Everything scoring ≥ 70, with contradictory evidence and verifier results. |
| 04 | `04_MANDATORY_V1_LAUNCH_FEATURE_REGISTER.md` | Indispensable capabilities — including those at 1% or absent. |
| 05 | `05_V1_SCOPE_FREEZE_AND_EXCLUSIONS.md` | The frozen scope, the exclusions, the gating plan, the supersession record. |
| 06 | `06_END_TO_END_TRACEABILITY_MATRIX.md` | Feature → screen → service → contract → endpoint → RPC → policy → effect → test. |
| 07 | `07_GAP_BLOCKER_AND_DEPENDENCY_REGISTER.md` | Every blocker with ID, severity, owner, evidence, closure criteria. |
| 08 | `08_IMPLEMENTATION_WAVES_AND_AGENT_OWNERSHIP.md` | Agents, path ownership, dependency DAG, verification assignment. |
| 09 | `09_TEST_SECURITY_AND_QUALITY_EVIDENCE.md` | Commands, exit codes, failures, fixes, skipped-test register. |
| 10 | `10_LCIS_FINDINGS_AND_INDEPENDENT_RECONCILIATION.md` | LCIS output vs direct source verification, verdict by claim. |
| 11 | `11_INFRA_PROVIDER_AND_ENVIRONMENT_READINESS.md` | Local/staging/production matrix, provider modes, env var names. |
| 12 | `12_DEPLOYMENT_ROLLBACK_AND_RELEASE_RUNBOOK.md` | Preflight, sequence, smoke, rollback triggers and commands. |
| 13 | `13_ANDROID_IOS_STORE_RELEASE_CHECKLIST.md` | Identifiers, signing, privacy, account deletion, store metadata. |
| 14 | `14_HUMAN_REQUIRED_ACTIONS.md` | Every action automation cannot perform, with expected artifact. |
| 15 | `15_FINAL_GO_NO_GO_CERTIFICATION.md` | Final scores, gate matrix, verdict, unresolved risks. |
| 16 | `16_CHANGELOG_AND_EVIDENCE_INDEX.md` | Files changed, tests, evidence locations, known limitations. |
| — | `ZIP_MANIFEST.md` | Per-file SHA-256, sizes, and the ZIP checksum. |

## 6. No secrets

No document in this package contains a credential, key, token, password, connection string,
or provider secret. Environment variables appear by **name only**. This was verified before
packaging; see [`16_CHANGELOG_AND_EVIDENCE_INDEX.md`](16_CHANGELOG_AND_EVIDENCE_INDEX.md).
