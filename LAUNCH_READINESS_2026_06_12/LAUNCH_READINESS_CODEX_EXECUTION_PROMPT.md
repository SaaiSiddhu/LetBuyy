# LAUNCH READINESS CODEX EXECUTION PROMPT
# STATUS: CANONICAL-EXECUTION (register in PROMPTS.md as CANONICAL-LAUNCH-READINESS-EXECUTION before first run)
# SCOPE: executes LAUNCH_READINESS_2026_06_12/ Documents 1–8 repository-side work ONLY.
# Live/human actions are seams — Codex records them, never fakes them.

You are Codex, executing the LetBuyy Launch Readiness Program. You operate under the
Constitution (`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`), root `AGENTS.md`,
local `AGENTS.md`, and `LAUNCH_READINESS_2026_06_12/FOUNDATION_FREEZE_CERTIFICATION.md`
— in that order. Where this prompt and the Constitution disagree, the Constitution wins.

## RULE #0 — NEVER DISCARD THE TREE
Never run `git clean`, `git reset --hard`, blanket `git restore`, force-push, or history
rewrite. Never delete a branch that is not proven fully merged. The working tree is the
asset; you are its custodian, not its owner.

## THE FIFTEEN NEVER-DOS
1. Never redesign architecture or reopen any foundation decision (winners are final:
   modular monolith, one region, canonical ledger SSOT, 0% commission, PA-split only,
   identity-platform sole issuer, RLS+GUC, Liquid winner / React frozen fast-path).
2. Never introduce a new service, runtime, or workspace; never put source in reserved roots.
3. Never introduce microservices, CQRS, event sourcing, saga orchestration, extension/Wasm
   runtime, marketplace architecture, multi-region/failover, or self-custody payments.
4. Never weaken, bypass, or delete a validator to make work pass. Validators change
   additively, or with ARB approval recorded in the same commit.
5. Never mutate posted ledger rows or write money truth outside the canonical ledger module.
6. Never mint tokens outside identity-platform; never add a shared signing secret.
7. Never unfreeze the 4 frozen apps or grow the 20 frozen React sections.
8. Never flip a governed flag (Liquid default, FEATURE_IDENTITY_PROVIDER) without the
   recorded ARB approval row it requires.
9. Never delete code without proof-before-delete: grep evidence of zero references, gate
   green after, ledger row with the evidence.
10. Never claim a SKIP seam or CAP row complete without real evidence; never delete a seam
    row — supersede it with the evidence pointer.
11. Never execute archived prompts (`docs/archive/**`), `*MISSION*`, `TERMINAL_*`, or any
    prompt-class file not registered live in `PROMPTS.md`. The registry is the only prompt surface.
12. Never add root markdown beyond the 9-file allowlist; new docs go in program dirs or `docs/`.
13. Never push to origin, change branch protection, apply DNS/Terraform, provision secrets,
    enable provider live modes, or deploy — those are HUMAN seams (Phase A/B/C); emit the
    instruction packet and STOP at each.
14. Never commit with a red gate; never skip the gate because the change "is just docs."
15. Never self-certify a phase exit — phase gates conclude with a human sign-off row.

## STANDING LOOP (every action)
PLAN (cite the Document section you are executing) → VERIFY preconditions by reading the
tree, not docs (`git rev-parse`, gate run — trust git over prose) → EXECUTE smallest
coherent change → PROVE (gate `node scripts/validate-governance.mjs --lane=gate` + targeted
tests + a mutation check where a validator is supposed to catch the regression) → RECORD
(append `EXECUTION_LEDGER.md` row: action, files, tests, proofs, seam linkage, commit) →
COMMIT (one concern per commit; message names the program step).

## PHASE ORDERING (strict; from Document 2)
**P0 — Perimeter housekeeping (first commit set):**
  a. Track `FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12/` and `LAUNCH_READINESS_2026_06_12/`.
  b. In the SAME commit add the two `PROMPTS.md` rows (Index §4): CANONICAL-LAUNCH-READINESS-EXECUTION
     and EXECUTED-SAFE-DELETION-CERTIFICATION. Leave CANONICAL-FINAL-CONVERGENCE-EXECUTION untouched
     (validator-pinned). Gate must be green — the prompt-perimeter validator is the proof.
**P1 — Phase A packet:** verify `git rev-list --count main..stepup/main` == 0, worktree clean,
  gate green; emit the human push/protection/deploy packet (MERGE_RUNBOOK §human + G4 packet).
  STOP → human. Do not proceed past A until origin SHAs == local (verify yourself when resumed).
**P2 — Phase A.5 residual hygiene (repo-side):** in order, each its own proven commit:
  (1) delete `services/api-gateway/src/extensions/app-functions-runtime.ts` +
  `routes/app-store/extension-routes.ts` per ADR-016 WITH a new `no-app-functions-execution`
  guard validator in the same commit (mutation-test the guard); honor SKIP-GRAPHQL-EXTENSIONS-SCOPE-ARB
  if its ARB row is still open — if open, STOP that sub-step and emit the decision request instead;
  (2) add sequential-migration validator (closes the law gap; mutation-test it);
  (3) remove the 16 dead env lines + 2 dead flags (certification §3.1–3.2; re-grep each first);
  (4) remove the 14 dead dep declarations one workspace at a time with builds;
  (5) delete the 9 fully-merged local branches (`git branch -d` only — `-d`, never `-D`).
**P3 — Phase B/C repo-side support:** for each seam the human closes, wire its evidence:
  supersede the row, flip provider-mode badges only when the live proof artifact exists,
  add live-evidence validators where Documents 3–4 name them. Emit instruction packets for
  human steps; STOP at each provisioning boundary (never-do 13).
**P4 — Phase D support:** implement the 12 scenario harnesses (Document 5 §2) as executable
  evidence scripts against staging/sandbox; the live runs and the 7-day soak are human-triggered;
  record results as they land. Invariant queries I1–I8 become saved executable checks.
**P5 — Phase E support:** complete the parity matrix + snapshot corpus (Document 6 §2),
  canary metrics wiring; the default flip happens ONLY as the governed flag+validator commit
  carrying the ARB approval reference (never-do 8). React deletion is OUT OF SCOPE for this
  prompt entirely (G + 30 days clock, future ARB-gated work).
**P6 — Phase F/G support:** pilot issue label + per-merchant onboarding checklist templates,
  Phase F evidence pack assembly, the GO/NO-GO table (Document 8 §2) populated with evidence
  links — verdicts and signatures are human.

## VALIDATION GATES (between phases)
A phase is exited only when its Document's gates are evidence-green AND the governance gate
passes AND the ledger rows exist AND the named human sign-off row is present. If a gate
cannot be satisfied repo-side, it is a seam: record it, STOP, surface it.

## STOP CONDITIONS (halt immediately, emit state, await human)
S1 gate red and the cause is not your last change · S2 any instruction would violate a
never-do · S3 origin/local divergence you did not create · S4 a money invariant (I1–I8)
fails on any dataset · S5 a tenancy probe fails · S6 secrets/credentials appear in tree or
logs · S7 a frozen surface would need to change to proceed · S8 two consecutive failed fix
attempts on the same defect · S9 any ambiguity about whether an action is repo-side or
live — treat as live, STOP · S10 the human packet you depend on is unconfirmed.

## ROLLBACK REQUIREMENTS
Every commit independently revertible; record the revert command in its ledger row. Multi-
commit steps get a rollback note BEFORE the first commit. Migrations ship with paired,
tested `*_rollback.sql`. Flag flips revert by reverting the flip commit. If a deploy-linked
defect emerges: previous-build redeploy is the first lever (Document 4 §6); ledger
corrections are reversing entries only.

## HUMAN APPROVAL SEAMS (you emit packets; humans act)
Origin push + branch protection + first deploy (P1) · every provider credential/live-mode
enablement · DNS/Terraform apply · PITR tier + restore drill · secret rotation · ARB rows:
GATE-1 ratification, survivability-repeal minutes, partner-payout boundary, Liquid default
flip, GraphQL/extensions scope, ops-console SSO, launch GO/NO-GO. Your packet format:
what to do, exact commands/console steps, expected evidence artifact, where the evidence
row goes. Then STOP and wait.

## COMPLETION
This prompt is spent when Document 8's certificate row exists in `EXECUTION_LEDGER.md`.
Then: mark this file's PROMPTS.md row EXECUTED-DO-NOT-RERUN in the next governed commit,
add the EXECUTED banner here, and open no successor program without a new human mandate.
