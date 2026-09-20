# REALITY PROMOTION IMPLEMENTATION PLAN

**Program:** LetBuyy Final Convergence · **Document 1 of 5** · **Status:** PLAN ONLY — no code changes authorized by this document
**Audited HEAD:** `3da1416c` (`main` == `stepup/main`, clean tree) · **Remote:** `origin/main` == `origin/develop` == `c2547049` (127 commits behind)
**Authority:** subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → `MERGE_RUNBOOK.md`. This plan proposes execution; it does not promote anything itself.
**Location note:** lives under `FINAL_TRUTH_AUDIT_2026_06_11/` because `whole-repo-end-state-validator.mjs:16-38` allowlists exactly 9 root markdown files; adding a root `.md` fails the governance gate.

---

## 0. WHY THIS IS PRIORITY 1

The truth audit proved a **temporal split**: the converged reality exists only in local commits `c2547049..3da1416c` (127 commits). The remote, CI, and any merchant who shows up today live in `c2547049` (2026-06-09), which still ships — verified in code — the unauthenticated account-takeover `/api/auth/switch` (0 ownership checks), the 3% commission rake (`commission.ts:202 commission_bps: 300`), no anon-RLS-leak fix, no tenant GUC, no canonical ledger authority (migrations 160–167 absent), and `letbuyy.store`-bound worker routes.

Every other plan in this program (Money, Liquid, Duplicates) operates on the converged tree. **None of their value reaches a single user until this promotion completes.** Reality Promotion is therefore the gating dependency for the entire program, and also the highest-risk single action, because the new code **fails closed** without live secrets: a code-only deploy with no identity JWKs bricks merchant login (verified: `auth.ts:1124` returns `503 IDENTITY_ISSUER_REQUIRED`).

Two findings make this non-trivial rather than "just push":

1. **The promotion path is booby-trapped.** `branch-lag-guard-validator.mjs:48-73` fetches `refs/heads/stepup/main` from origin and asserts `HEAD..origin/stepup/main == 0`, failing closed on fetch error. `stepup/main` **does not exist on origin** (`git branch -r` shows only `origin/main`, `origin/develop`). `MERGE_RUNBOOK.md` step 4 says "Push or merge the validated local `main`" and never mentions pushing `stepup/main`. **Following the runbook literally makes the first guarded production deploy fail closed on the missing remote branch.**
2. **The deploy pipeline does not run the governance gate.** `production-deploy.yml` contains zero `validate-governance` references (verified). The 92-validator hard-wall suite is not a `needs:` prerequisite of any deploy job, and no branch-protection-as-code exists in-repo. A `workflow_dispatch` on the old workflow can ship the vulnerable build with no new gates. This must be closed *as part of* promotion, not after.

---

## 1. DIVERGENCE ANALYSIS (evidence)

| Dimension | Local `main`/`stepup/main` (`3da1416c`) | Remote `origin/main` (`c2547049`) | Delta |
|---|---|---|---|
| Commits | tip | 127 behind | `git rev-list --count origin/main..main` = 127 |
| Files | — | — | `git diff --stat`: 2,042 files, +76,344 / −253,383 |
| `/api/auth/switch` | session + proven-device + rate-limit (143 lines) | `email_verified` only (93 lines) — takeover | S0 |
| Commission | `commission_bps: 0` + migration 162 | `commission_bps: 300` | S0 (revenue/contract) |
| Migrations | 160–167 present | ends at 159 | schema S0s unfixed |
| Worker routes | `*.letbuyy.com` | `api.letbuyy.store` | domain split |
| Deploy workflow | branch-lag guard + 34-secret preflight + encrypted backup + staging-E2E gate | no guard, `.store` URLs | safety only local |
| `develop` branch | — | == `origin/main` == `c2547049` | a dormant third pointer, not a third codebase |

**Reality count: 2.** Local-converged (`main`==`stepup/main`, all 8 wave branches ahead:0 — nothing stranded) vs remote-stale (`origin/main`==`origin/develop`==local `develop`). The push moves reality 2 onto reality 1.

---

## 2. RISK REGISTER (pre-mitigation)

| ID | Risk | Severity | Source of truth |
|---|---|---|---|
| RP-R1 | Old `origin/main` workflow redeployed via `workflow_dispatch` ships takeover+rake | Critical | `production-deploy.yml` on origin has 0 guard refs |
| RP-R2 | First guarded deploy fails closed because `stepup/main` not on origin | High | `branch-lag-guard-validator.mjs:48-73` |
| RP-R3 | Code-only deploy without identity JWKs bricks merchant login | Critical | `auth.ts:1124`, SKIP-D3 |
| RP-R4 | Migrations 160–167 applied without provider secrets leave money paths fail-closed but live-labeled | High | `wrangler.toml [env.production.vars]` `…_MODE="live"` + placeholders |
| RP-R5 | Untracked destructive migration reaches prod DB via `db push --include-all` | Critical | probe-proven; `production-deploy.yml:254` |
| RP-R6 | Gate not wired into deploy → a failing validator does not block promotion | High | 0 `validate-governance` refs in deploy workflow |
| RP-R7 | Second guard-less production lane (`production-rollout.yml`) bypasses branch-lag entirely | Medium | no guard job in that workflow |
| RP-R8 | DNS cutover applies colliding Terraform (two zone-id vars, overlapping records post-sed) | Medium | `dns.tf` + `letbuyy_com.tf` |
| RP-R9 | `.claude/` or other untracked residue committed during alignment | Low | `git status` shows `?? .claude/` |

---

## PHASE 0 — SAFETY SNAPSHOT

**Goal:** an immutable, restorable record of both realities before any pointer moves.

Steps (human-operated; all read-only to the remote):
1. Tag the converged tree locally and on a backup remote ref: `git tag -a convergence-3da1416c -m "converged reality snapshot"` (do not push to a protected ref yet). Record the SHA in `EXECUTION_LEDGER.md` as the promotion baseline.
2. Capture the condemned reality: `git tag -a pre-promotion-origin-c2547049 origin/main`. This guarantees a one-command rollback target.
3. Snapshot the **production database** before any migration: confirm the `production-deploy.yml` `migrate-production` job's encrypted `pg_dump` step (already present) runs and the artifact is retrievable; additionally take an out-of-band manual backup and PITR checkpoint (SKIP-W0 is open — PITR tier may need enabling first; if not enabled, a manual logical dump is the floor).
4. Record current production worker/app versions (Cloudflare + Vercel deployment IDs) so a rollback can re-pin exact prior artifacts.

**Exit gate G0:** two tags exist; a readable DB backup artifact exists; prior deploy artifact IDs recorded. **No pointer has moved.**

**Rollback for Phase 0:** none needed — nothing changed.

---

## PHASE 1 — REPOSITORY VERIFICATION

**Goal:** prove the local converged tree is exactly what the audit certified, before exposing it.

Steps:
1. `git status --short` → must be empty (gitignore `.claude/` first if present, as a separate reviewed commit; RP-R9).
2. `git rev-parse --short HEAD` → `3da1416c`; `git rev-list --count main..stepup/main` → `0`.
3. `node scripts/validate-governance.mjs --lane=gate` → green (92 validators). Capture full output to the ledger.
4. Run the foundation suites named in EXECUTION_LEDGER VERIFY rows: `node --test tests/governance/phase-b-validators.test.mjs` (16/16), the D-series money/identity/checkout tests (ensure `pnpm install` has materialized workspace symlinks — the audit found `jose`/`zod` resolution fails on a partial install; CI must `pnpm install --frozen-lockfile` first).
5. Confirm all 8 wave branches are ahead:0 of `main` (nothing valuable stranded).

**Exit gate G1:** clean tree + lag 0 + gate green + headline tests pass on a fully-installed workspace.

**Rollback:** none — verification only. If any check fails, **halt the entire program** and route the failure to the relevant domain plan.

---

## PHASE 2 — BRANCH CONVERGENCE (close the runbook trap)

**Goal:** make the remote able to accept the guarded deploy. This is the phase that fixes RP-R2.

**Decision required (ARB):** the branch-lag guard compares against `origin/stepup/main`. Two valid resolutions — pick one and record it:

- **Option A (recommended): push `stepup/main` to origin alongside `main`.** Lowest code change. The guard then resolves. Requires correcting `MERGE_RUNBOOK.md` step 4 to: "Push the validated local `main` **and** `stepup/main` to the protected remote, in that order." Keeps the guard's two-branch invariant meaningful (origin main must not lag origin stepup/main).
- **Option B: retarget the guard** to compare local `HEAD..origin/main == 0` after push (single-branch model) and retire the `stepup/main` remote dependency. Cleaner long-term (one promoted branch) but is a validator code change that must itself pass the gate and ARB review, and removes the dual-branch safety the guard was designed around.

Steps (Option A):
1. ARB approves the branch model; `MERGE_RUNBOOK.md` is corrected (reviewed commit on the converged tree, re-run gate).
2. Human owner enables remote branch protection on `main` **before** the first push (RP-R1): required status check = the governance gate workflow (see Phase 3), required PR review, no force-push, no `workflow_dispatch` deploy from unprotected refs.
3. Push `stepup/main` to origin, then fast-forward-push `main`. Order matters: pushing `main` first while the guard expects `origin/stepup/main` would fail the next deploy.
4. Verify on the remote: `origin/main` == `origin/stepup/main` == `3da1416c`; `develop` is explicitly retired or re-pointed (it currently equals the condemned reality and `config/vercel/projects.json` still names it for staging — a Duplicate-Elimination item, but flag it here so a stale `develop`-triggered staging deploy can't fire).

**Exit gate G2:** remote `main`==`stepup/main`==`3da1416c`; branch protection live; runbook corrected; `develop` neutralized; the branch-lag guard now resolves green against the remote.

**Rollback for Phase 2:** branch protection + tags make this reversible. To abort: `git push origin pre-promotion-origin-c2547049:main --force-with-lease` (re-pin remote to the snapshot tag) under a maintainer with protection-bypass, then disable any deploy that fired. Because no deploy runs in this phase (push ≠ deploy if `workflow_dispatch`/auto-deploy is gated by protection), the blast radius is the repo pointer only.

---

## PHASE 3 — GOVERNANCE VALIDATION (wire the gate into deploy)

**Goal:** close RP-R5 and RP-R6 — make the 92-validator gate and untracked-migration safety **block** the deploy, not run beside it. This is a prerequisite to any production rollout and is the one place this plan touches CI config (a governance change, ARB-reviewed, gate-passing).

Required changes (proposed, to be implemented under the Master Program's Phase A, not here):
1. Add a `governance-gate` job to `production-deploy.yml` and `production-rollout.yml` (RP-R7) running `node scripts/validate-governance.mjs --lane=gate`, and make `migrate-production` + `deploy-*` jobs `needs: [governance-gate, branch-lag-guard, …]`.
2. Add an **untracked-migration rejection** step before `supabase db push --include-all`: fail if `git ls-files --others --exclude-standard database/supabase/migrations/` is non-empty, or pin the push to `git ls-files database/supabase/migrations` only. (RP-R5 — probe-proven that a `DROP TABLE payouts;` untracked file is invisible to every validator yet applied by `--include-all`.)
3. Register the gate workflow as a GitHub **required status check** on `main` (the branch-protection half that cannot live in-repo; record as a human seam).

**Exit gate G3:** a deliberately-failing validator (mutation probe, reverted) blocks a dry-run of `production-deploy.yml`; an untracked migration probe is rejected before `db push`. Both proven in a staging run, then reverted.

**Rollback:** CI-config-only; revert the workflow commit. No production impact (these gates only add failure modes, never new deploys).

---

## PHASE 4 — PROMOTION VALIDATION (the atomic go-live)

**Goal:** put the converged code in production **with** the secrets and migrations it fails closed without — atomically, so login/checkout never run against half-provisioned state (RP-R3, RP-R4).

This phase has a hard ordering because the new code is fail-closed by design:

1. **Provision secrets first** (human seams, all recorded): identity ES256/Ed25519 private JWK + public JWKS (SKIP-D3), `CHECKOUT_SIGNING_SECRET` (SKIP-D6), mobile-bff `TURNSTILE_SECRET_KEY` (SKIP-W7 — note the workflow already requires `PRODUCTION_TURNSTILE_SECRET_KEY` at preflight but never pipes it to mobile-bff; fix that wiring here), internal/session/TOTP rotation (SKIP-W4). Leave provider-money secrets (payout, PSP, KYC, logistics, WhatsApp, ESP) **unprovisioned** — those subsystems stay sandbox/fail-closed and are Money/Capability-phase work, not launch blockers, as long as nothing claims them live.
2. **Migrate production**: apply 160→167 in order via the gated `migrate-production` job (each has a paired rollback file — verified all 8 exist in `database/supabase/rollback/`). The encrypted backup precedes the push.
3. **Deploy workers + apps** to `*.letbuyy.com` via the converged matrix.
4. **DNS**: resolve the Terraform collision (RP-R8) before applying — `dns.tf` and `letbuyy_com.tf` define overlapping records under `cloudflare_zone_id` vs `cloudflare_zone_id_com`; this must be reconciled to one zone definition (a Duplicate-Elimination Phase-5 item; promotion can proceed on existing DNS if cutover is deferred, but checkout.letbuyy.com requires it).
5. **Smoke**: run the production smoke job + manual probes — merchant login issues an identity-signed session, a test capture flows, `/api/auth/switch` rejects an unproven cross-account switch, anon cannot read `orders` (migration 163 live-probe, SKIP-D2).

**Exit gate G4:** smoke green; login works; switch-takeover probe denied; anon-leak probe denied; commission reads 0; no `…_MODE="live"` subsystem returns a fabricated success (all sandbox-badged). Record live evidence against SKIP-D2/D3/D4 probe rows.

**Rollback for Phase 4 (the critical one):**
- **Code:** re-deploy the prior worker/app artifact IDs captured in Phase 0 (Cloudflare/Vercel rollback to pinned deployment).
- **Schema:** apply rollback files 167→160 **in reverse order** (they exist and are paired). Caveat: rollbacks of data-bearing migrations (162 zeroed commission rows; 165 money-path columns) must be reviewed for data already written under the new schema — a pure DDL rollback is safe; a rollback after live money movement needs a forward-fix, not a reverse migration. Since all money rails are fail-closed at launch, no live money will have moved, so the reverse path is clean **only if** Phase 4 is executed before provider-money secrets are provisioned. This is a reason to keep money secrets out of the launch atom (step 1).
- **DNS:** revert to prior records.
- **Decision rule:** if login or capture smoke fails and is not fixable within the maintenance window, roll back code + schema to the Phase-0 snapshot; do not leave production on a partial migration set.

---

## PHASE 5 — POST-PROMOTION AUDIT

**Goal:** prove reality is now singular and durable.

Steps:
1. Confirm `origin/main` == `origin/stepup/main` == `3da1416c`; `develop` retired.
2. Re-run the full forensic harness (the 10-agent audit's architecture/governance/validator passes) against the **remote** tree — confirm the converged findings now describe production.
3. Update `EXECUTION_LEDGER.md`: backfill the stale "not committed" column on rows 1–46 to the freeze commit `72e80c2b` (the audit flagged this as misleading), and add the promotion + live-probe evidence rows. Remove or supersede `SKIP-PROD-DEPLOY-PROMOTION`, `SKIP-D1-MERGE-RUNBOOK-DIRTY-TREE` only when truly done.
4. Obtain the 3 pending ARB signatures (GATE-1 ratification, ops-survivor, survivability repeal) now that the promotion they authorize is live.
5. Set up a standing **branch-lag monitor** (scheduled check that `origin/main` never silently falls behind a future `stepup/main`) so the temporal split cannot recur.

**Exit gate G5:** remote forensic audit returns the converged findings; ledger truthful and current; ARB signatures recorded; monitor live.

**Rollback:** none — audit/record only.

---

## VALIDATION GATES SUMMARY

| Gate | Blocks | Pass condition |
|---|---|---|
| G0 | start of Phase 1 | two tags + DB backup + artifact IDs |
| G1 | start of Phase 2 | clean tree, lag 0, gate green, tests pass |
| G2 | start of Phase 4 | remote converged, branch protection, runbook fixed, `develop` neutralized |
| G3 | production rollout | gate + untracked-migration rejection block a dry-run |
| G4 | post-promotion | login/switch/anon/commission smoke all correct, no false-live |
| G5 | program continuation | remote audit converged, ledger current, ARB signed |

## DEPLOYMENT & PRODUCTION RISKS (residual after mitigations)

- The new pipeline is well-gated but **has never run** end-to-end against production — first real execution is the highest-uncertainty moment; rehearse fully in staging (two staging lanes exist — consolidate first or pick one explicitly to avoid a racing deploy).
- Fail-closed design means **partial provisioning = outage**, not degradation. The atomic ordering in Phase 4 is mandatory, not advisory.
- `production-rollout.yml` is a second, dispatch-driven lane; until G3 wires the gate into it too, treat it as disabled.
- Provider-money subsystems will be live-labeled but sandbox-executing post-launch; this is acceptable **only** while the provider-mode badge is honest end-to-end (Money plan certifies this). Watch for any surface that drops the badge.

## DEPENDENCIES OUT

Reality Promotion is the **root dependency** of the program. Money (Doc 2), Liquid (Doc 3), and Duplicate Elimination (Doc 4) all assume the converged tree is the deployed tree. Phase 3's gate-wiring and Phase 4's secret ceremony are shared with the Master Program's Phase A. **Nothing in Docs 2–4 should deploy to production until G4 passes.**
