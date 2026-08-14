# LETBUYY LAUNCH READINESS PROGRAM — INDEX

**Date:** 2026-06-12 · **Mode:** CTO + Principal Architect + Program Director · **Basis tree:** `main` == `stepup/main` @ `533479cb`, gate GREEN (105 validators), Safe Deletion Certification complete.

This directory is the complete launch-readiness program. It is **documentation only** — no code, no file modifications were performed in producing it. It builds strictly on ratified evidence: the Constitution chain, `SKIPPED_HUMAN_DECISIONS.md` (56 seams), `CAPABILITY_BACKLOG.md` (16 gaps), `MERGE_RUNBOOK.md`, `EXECUTABLE_HUMAN_REQUIRED.md`, `FINAL_TRUTH_AUDIT_2026_06_11/` (G4 packet + Reality-Promotion / Money-Unification / Liquid-Convergence plans), and `FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12/`.

## Reading order

| # | Document | Purpose |
|---|---|---|
| 1 | `FOUNDATION_FREEZE_CERTIFICATION.md` | What is frozen, what may change, what may never change |
| 2 | `LAUNCH_READINESS_MASTER_PROGRAM.md` | The complete Phase A–G roadmap with gates, risks, rollback |
| 3 | `HUMAN_SEAMS_CLOSURE_PROGRAM.md` | All 56 SKIP seams categorized and prioritized |
| 4 | `PRODUCTION_INFRASTRUCTURE_PROGRAM.md` | Environments, secrets, monitoring, backups, DR, deploy + readiness checklist |
| 5 | `MONEY_CERTIFICATION_PROGRAM.md` | End-to-end money proof: scenarios, invariants, reconciliation, rollback |
| 6 | `LIQUID_ACTIVATION_PROGRAM.md` | React/Liquid parity matrix, activation, canary, rollback (React deletion gated) |
| 7 | `MERCHANT_PILOT_PROGRAM.md` | First 5 merchants: onboarding, support, feedback, success criteria |
| 8 | `LAUNCH_CERTIFICATION.md` | Launch requirements + GO / NO-GO checklist |
| 9 | `LAUNCH_READINESS_CLAUDE_EXECUTION_PROMPT.md` | The single gated Claude execution constitution for this program |

## Subordinate evidence packages

| Package | Date | Purpose |
|---|---|---|
| `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09/` | 2026-08-09 | Merchant App V1 forensics, scope freeze, implementation and launch certification at `ee371182`. 18 documents. Verdict **NO-GO**. Evidence/implementation class — subordinate to DOC 01, root `AGENTS.md`, DOC 03; it redefines no constitutional decision. Re-tests the prior `V1_SCOPE_LOCK_2026_06_12` mobile-as-V2 classification and **upholds it**, restated as V1.1 gated on four named items (Class B, ARB review). No `PROMPTS.md` row required — no basename matches the prompt-class regex. |

## Standing constraints (apply to every document)

1. The authority chain is unchanged and non-negotiable: `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → local `AGENTS.md` → rewrite docs.
2. No document here reopens a settled decision (Liquid winner, canonical ledger SSOT, identity-platform sole issuer, RLS+GUC, modular monolith, one region, 0% commission, PA-split rails only).
3. The governance gate (`node scripts/validate-governance.mjs --lane=gate`) must be GREEN before and after every commit this program produces.
4. **Prompt-perimeter registration duty (commit-time):** two files in this program's scope are prompt-class by filename and MUST be registered in `PROMPTS.md` in the same commit that tracks them, or the gate goes red:
   - `| CANONICAL-LAUNCH-READINESS-EXECUTION | `LAUNCH_READINESS_2026_06_12/LAUNCH_READINESS_CLAUDE_EXECUTION_PROMPT.md` | CANONICAL-EXECUTION |`
   - `| EXECUTED-SAFE-DELETION-CERTIFICATION | `FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12/FINAL_SAFE_DELETION_CERTIFICATION.md` | EXECUTED-DO-NOT-RERUN |` (a report, but its basename matches the DELETION prompt-class token)
   The existing `CANONICAL-FINAL-CONVERGENCE-EXECUTION` row must remain — `prompt-perimeter-validator.mjs:13` pins it. Retargeting that pin is a future governed change, not part of this program's baseline.
