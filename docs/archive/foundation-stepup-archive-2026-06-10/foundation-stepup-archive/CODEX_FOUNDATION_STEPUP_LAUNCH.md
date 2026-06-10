# CODEX FOUNDATION STEP-UP — LAUNCH PROMPT (paste this into Codex)

You are the autonomous execution agent for the **LetBuyy Foundation Step-Up**. Your job is to IMPLEMENT the foundation fixes across this monorepo — not to redesign anything. The architecture is frozen. Run the entire mission in ONE continuous session, wave by wave, until the final gate is green.

## Read these first, in order, before touching any code (they are your binding contract)
1. `FOUNDATION_STEPUP_MISSION_V2.md` — your execution bible (waves, tasks, protocols, acceptance). **Binding.**
2. `LETBUYY_FOUNDATION_AUTHORITY/LETBUYY_SINGLE_SOURCE_OF_TRUTH.md` — the truth + the only approved roadmap.
3. `FOUNDATION_REPO_LOCKS.md` — frozen paths/objects; never edit without a `FROZEN-OVERRIDE: <human>` commit trailer.
4. `FOUNDATION_RISK_MATRIX.md` — the risks you are mitigating (verify at PHASE A.5).
5. `FOUNDATION_EXECUTION_DASHBOARD.md` — the control tower; update after EVERY wave.
6. `FOUNDATION_FINAL_AUDIT.md` — run end-to-end at WAVE FINAL.

Conflict rules: if V2 disagrees with any other doc, **V2 wins**. If V2 disagrees with the actual code, **trust the code and STOP** to reconcile before editing.

## Execute in ONE continuous run, in this exact order, committing per wave to the `stepup/main` integration branch
**PHASE A** (repo truth audit) → **PHASE A.5** (risk matrix) → **Wave 0** (truth harness + test fixture + backups staged) → **Wave 1** (money) → **Wave 2** (tenant isolation) → **Wave 3** (production safety) → **Wave 4** (session security) → **Wave 5** (design governance) → **Wave 6** (theme governance) → **Wave 7** (beta readiness) → **WAVE FINAL** (final audit).

Do not stop for approval between waves. Do not expand scope: **no OIDC provider, no marketplace, no AI, no extensions, no new services** — those are out of scope per the SSOT.

## Non-negotiables (from V2 — apply to every wave)
- **Never fabricate** money, identity, or success. No synthesized UTRs/txn ids, no hardcoded `paid/released`, no `mock:true` runtime payloads.
- **Money posts to the ledger.** Balance reads from the canonical ledger **only after Wave 1.1a backfill + per-site reconciliation (≡, tolerance 0)** — STOP on any mismatch. Payout release needs `FOR UPDATE` + balance check + idempotency. Refunds post to the ledger.
- **Tenancy is fail-closed.** Wave 2.0: build the schema-derived **exhaustive** tenant-table registry first; the IDOR test iterates it; no table left out.
- **Migrations:** forward-only, idempotent, with a tested `down`; **expand→contract** for any type change (no `ALTER TYPE` on live money tables); run only against the ephemeral fixture — **never a shared/staging/prod DB.**
- **NO PRODUCTION ACTIONS.** Build-and-prove only. Any shared-env apply, live-secret rotation, or deploy is a human step recorded as `SKIP-DEPLOY` with an apply/verify/rollback runbook.
- **Address by symbol, not line.** Every `file:line` in the docs is a HINT — re-locate by symbol and re-verify before editing.
- **SKIP vs STOP:** SKIP only **CLASS-A** items (external creds/integrations: PA, WhatsApp/Twilio, KYC, tax, Turnstile, Sentry, KMS, DNS) — gate the feature OFF, log to `FOUNDATION_STEPUP_SKIPPED.md`, continue. For **CLASS-B** (correctness/safety on a P0 path: tenancy, ledger backfill, payout safety, mock-in-prod, frozen edits) — **STOP, write a BLOCK, do not proceed.** Never fake, never guess.
- **Quarantine, don't delete:** DELETE→QUARANTINE→VERIFY→DELETE; prove 0 importers at HEAD; keep build + `validate:dependencies` green.
- **Per-wave checkpoint before merge:** `pnpm run build` green · `pnpm run validate:dependencies` green · the wave's behavioral tests green on the fixture · impl + rollback + governance reports written to `FOUNDATION_STEPUP_LEDGER.md` · `FOUNDATION_EXECUTION_DASHBOARD.md` updated. No next wave until this is green.
- **Obey `FOUNDATION_REPO_LOCKS.md`.** **Resumable:** read `FOUNDATION_STEPUP_STATUS.md` on start; continue from the in-progress marker; never re-run a completed wave.

## Definition of DONE (do not stop earlier)
The **23-point Final Acceptance Gate in V2 §8** is green AND `FOUNDATION_FINAL_AUDIT.md` (WAVE FINAL) is all-green — the re-derived dependency/import/build/tenant/ledger/frozen audits match the PHASE A baseline with **zero unintended drift and no new debt**, and `FOUNDATION_STEPUP_SKIPPED.md` contains only CLASS-A, gated-OFF items.

## Start now
Begin with **PHASE A**: produce `FOUNDATION_REPO_STATE.md`, `ACTIVE_DEPLOYMENT_TOPOLOGY.md`, `BUILD_GRAPH.md`, `IMPORT_GRAPH.md` (no code changes), commit them, set the dashboard, then proceed to PHASE A.5 and onward through WAVE FINAL without stopping (except CLASS-B STOPs). Build the road.
