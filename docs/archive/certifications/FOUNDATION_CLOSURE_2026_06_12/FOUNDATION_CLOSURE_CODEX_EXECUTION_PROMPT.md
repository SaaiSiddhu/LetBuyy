# FOUNDATION CLOSURE — CODEX EXECUTION PROMPT

**DOC: FC-04 · Prompt-class: STANDBY executor (see §0 mutual exclusion) · Mission: close B2–B7 repo-side, prepare B1-a, arm FC-02, STOP.**
**Law order:** `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → local `AGENTS.md` → `FOUNDATION_CLOSURE_2026_06_12/FOUNDATION_CLOSURE_PROGRAM.md` (FC-01, your work order) → this prompt. On any conflict, the higher document wins and you STOP with a SKIP row.

---

## §0 — REGISTRATION & MUTUAL EXCLUSION (Batch 0, before any other change)

1. This file and `FOUNDATION_CLOSURE_SONNET46_MAX_PROMPT.md` are prompt-class artifacts. The commit that first tracks `FOUNDATION_CLOSURE_2026_06_12/` MUST, in the SAME commit (P0 precedent, commit `7a0342e0`), add `PROMPTS.md` rows: exactly ONE of the two execution prompts as `CANONICAL-FOUNDATION-CLOSURE-EXECUTION`, the other as `STANDBY-…`. Two ACTIVE canonical executors for one mission is the twin-prompt hazard that P0 already hit once — forbidden.
2. The same Batch-0 commit also tracks `FINAL_REPOSITORY_TRUTH_CERTIFICATION_2026_06_12/` with an `EXECUTED-FINAL-TRUTH-CERTIFICATION` registry row (the report contains prompt-class trigger tokens; untracked = invisible to the perimeter validator, tracked-unregistered = gate-red).
3. If you are running and the Sonnet prompt is marked CANONICAL: STOP immediately; you are the standby.
4. Batch-0 exit: gate green, tree clean, ledger row `CLOSURE-CP0`.

## §1 — RULE #0 AND NEVER-DOS

**Rule #0: never discard the tree.** No `git reset --hard`, no `git clean -fd`, no checkout that destroys uncommitted work, **NEVER `git push`** (B1-a is human-only), never force-push, never rewrite history, never delete ledger/SKIP/HR rows (append-only).

**You may not, under any framing:** redesign architecture; reopen settled decisions (winners list in CONVERGENCE_AUDIT — Liquid, canonical ledger, identity-platform, monolith, one-region, RLS+GUC, 0% commission); introduce services, microservices, CQRS, event sourcing, saga orchestration, marketplace runtime, extension runtime, multi-region; delete the GraphQL/extensions surface (ARB seam `SKIP-GRAPHQL-EXTENSIONS-SCOPE-ARB` is open — not yours); flip the Liquid default; touch frozen apps; add root-level `.md` (budget 9/9 — everything lives in `FOUNDATION_CLOSURE_2026_06_12/`); consolidate token issuers or remove GoTrue (Launch-era, FC-03 §6 — B7 is the shared-secret surface ONLY); weaken or remove any validator; mark anything done in the ledger that the diff does not prove.

## §2 — BATCH LOOP (one blocker per batch, strict order: CP-0 → B4 → B3 → B5 → B6 → B7 → B2)

For each batch: **READ** the blocker's FC-01 §Phase-B section and every file in its touch perimeter → **IMPLEMENT** only within that perimeter → **PROVE** (run the blocker's mutation/negative-control probe; capture transcript into `FOUNDATION_CLOSURE_2026_06_12/evidence/bN/`) → **GATE** (`node scripts/validate-governance.mjs` must be green; record the count) → **LEDGER** (append `CLOSURE-BN` row: what changed, files, probe evidence path, revert command) → **COMMIT** (`foundation-closure-bN: <summary>`; tree clean after) → next batch.

Touch perimeters (exhaustive — a file outside the list = STOP):
- **B4:** `scripts/validators/sequential-migration-validator.mjs` (+ its test if present).
- **B3:** `.github/workflows/deploy-staging.yml`, `.github/workflows/staging-deploy.yml` (gate-or-disable decision, recorded), `scripts/validators/deployment-safety-validator.mjs`.
- **B5:** `scripts/money-certification/check-invariants.mjs`, `scripts/money-certification/invariants/fixtures/` (new), root `package.json` (one script line), `scripts/validators/tooling-governance-validator.mjs` (allowlist only).
- **B6:** `services/api-gateway/src/routes/ai.ts`; Form A additionally: one webhook/queue consumer in existing patterns + intent persistence + `scripts/validators/canonical-ledger-only-validator.mjs` (list extension) + at most one new migration (next sequential number, with rollback); Form B additionally: `wrangler.toml` flag blocks + `SKIPPED_HUMAN_DECISIONS.md` (append) + `scripts/money-certification/scenarios/s11*.mjs` (contract annotation). Decision rule is FC-01's; record which form and why in the ledger row.
- **B7:** `services/api-gateway/src/lib/internal-auth.ts` (+ tests), `scripts/github/set-secrets.mjs`, `.github/workflows/staging-deploy.yml`, `.github/workflows/production-deploy.yml`, `config/env/staging-production-secret-matrix.json`, `scripts/validators/secret-topology-validator.mjs` (new) + gate registration in `scripts/validate-governance.mjs`, `EXECUTABLE_HUMAN_REQUIRED.md` (append `HR-SECRET-ROTATION`), `apps/platform-console/src/lib/console-session.ts` (remove `AUTH_SECRET` fallback only). Keep `INTERNAL_AUTH_LEGACY_ACCEPT` defaulting ON with sunset comment — rotation is human.
- **B2:** ref move only (`git branch -f main stepup/main`) AFTER the final content commit + ledger row; optional `branch-lag-guard-validator.mjs` closed-mode hardening per FC-01.

## §3 — STOP CONDITIONS (emit a SKIP row in `SKIPPED_HUMAN_DECISIONS.md`, commit, halt the batch)

STOP if: a perimeter file's reality contradicts FC-01's description of it · a fix requires schema redesign or a second migration · B6 Form A exceeds the existing webhook/ledger patterns · any gate validator fails for a reason unrelated to your diff · a probe passes when it must fail (your detection is theater — do not proceed on a false-green instrument) · `PROMPTS.md`/ledger conflict · any instruction here conflicts with DOC 01/02. A clean STOP with evidence is success; an improvised workaround is failure.

## §4 — COMPLETION & FINAL STOP

You are DONE when, in order: CP-0 and B4,B3,B5,B6,B7 ledger rows exist with green gate each · B2 executed (`main == stepup/main`, final SHA recorded) · `FOUNDATION_CLOSURE_2026_06_12/evidence/` contains all probe transcripts · FC-02's Activation Record table is filled EXCEPT the human rows (Closure SHA, validator count, ledger lines — yes; `ls-remote`, signature, date — left `_pending-human_`) · a **B1-a handoff packet** is appended to `EXECUTABLE_HUMAN_REQUIRED.md` (exact runbook commands, push order stepup-first per MERGE_RUNBOOK.md:53-60, `origin/develop` deletion, rotation pointer) · gate green, tree clean, `git status --porcelain` empty.

Then output exactly: `FOUNDATION CLOSURE: REPO-SIDE COMPLETE — B2..B7 CLOSED, B1-A AWAITING HUMAN — STOPPING.` and stop. **You never push. You never declare the era closed — only FC-02's completed Activation Record does that, and it requires the human B1-a rows.**
