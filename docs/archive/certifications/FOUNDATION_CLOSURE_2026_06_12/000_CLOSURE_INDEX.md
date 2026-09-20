# FOUNDATION CLOSURE 2026-06-12 — INDEX

**Baseline:** HEAD `f961e23a` (`stepup/main`) · all 7 blockers re-verified STILL VALID · documentation only, nothing executed.

| Doc | File | Role |
|---|---|---|
| FC-01 | `FOUNDATION_CLOSURE_PROGRAM.md` | Phase A re-verification + per-blocker closure plans (root cause/risk/changes/gates/rollback/evidence/criteria) + execution order + definition of done |
| FC-02 | `FOUNDATION_FREEZE_CERTIFICATION.md` | ARMED-not-ACTIVE freeze instrument: 7 domains, may-change / may-never-change, activation record |
| FC-03 | `LAUNCH_HANDOFF_DOCUMENT.md` | Foundation→Launch boundary: human seams, production promotion (B1-b), money cert, identity completion, Liquid, pilot |
| FC-04 | `FOUNDATION_CLOSURE_CODEX_EXECUTION_PROMPT.md` | STANDBY executor constitution (batch-gated, perimetered, SKIP-stopped) |
| FC-05 | `FOUNDATION_CLOSURE_SONNET46_MAX_PROMPT.md` | CANONICAL executor constitution for Claude Sonnet 4.6 Max / Claude Code (long-running autonomous loop) |

**Execution order:** CP-0 (track+register, same-commit) → B4 → B3 → B5 → B6 → B7 → B2 → B1-a (HUMAN push) → FC-02 activation → handoff (FC-03). B1-b (production deploy) = first act of Launch Readiness.

**Registration warning:** tracking this directory and `FINAL_REPOSITORY_TRUTH_CERTIFICATION_2026_06_12/` requires `PROMPTS.md` rows in the SAME commit (prompt-perimeter validator; P0 precedent `4d900a02`) — exactly one of FC-04/FC-05 marked CANONICAL.
