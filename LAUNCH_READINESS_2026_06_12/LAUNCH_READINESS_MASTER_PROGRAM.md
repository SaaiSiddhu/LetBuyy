# DOCUMENT 2 — LAUNCH READINESS MASTER PROGRAM

**The roadmap from a certified-frozen repository to first real merchants.**
Basis: tree `533479cb`, gate GREEN. Local reality is launch-grade repo-side; **everything live is gated by human seams.** This program sequences them.

## 0. PROGRAM SHAPE

```
A. Reality Promotion ──► B. Human Seam Closure (critical lane) ──► D. Money Certification ──► F. Merchant Pilot ──► G. Launch Certification
        │                        │
        │                        └─► C. Production Infrastructure (parallel with B, completes before D)
        └─► A.5 Residual Hygiene (parallel, repo-side)
                                 E. Liquid Activation (parallel after A; must finish before G; React deletion AFTER G+stability)
```

Hard ordering rules: **A before everything** (nothing live exists until origin reflects the converged tree). **C before D** (money certification needs monitored, backed-up production). **D before F** (no merchant touches un-certified money). **E may run parallel** but its default-flip lands only after canary proof; React deletion is post-launch. **G is terminal** and consumes evidence from all phases.

---

## PHASE A — REALITY PROMOTION

**Objective:** make `origin/main` identical to local converged reality and deploy it through the gated pipeline. Executes the already-ratified `FINAL_TRUTH_AUDIT_2026_06_11/REALITY_PROMOTION_IMPLEMENTATION_PLAN.md` + `MERGE_RUNBOOK.md` + `G4_HUMAN_EXECUTION_PACKET.md` — this program adds no new design.

**Deliverables**
1. Pre-push commit of currently untracked governance artifacts (`FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12/`, `LAUNCH_READINESS_2026_06_12/`) **with the two `PROMPTS.md` registry rows** (see index §4) — gate green before push.
2. Remote convergence in branch-lag-safe order (runbook §53–76): push `stepup/main`, then `main`; neutralize `origin/develop`.
3. GitHub branch protection with required `governance-gate` status check (SKIP-A3).
4. First gated production deploy + G4 live smoke evidence (SKIP-A4, SKIP-PROD-DEPLOY-PROMOTION).
5. Branch-lag monitor live activation (SKIP-A5).

**Dependencies:** backup artifacts readable (`EXECUTION_LEDGER.md` row 45); human with repo-admin + provider-console access.
**Risks:** R-A1 push without protection → unguarded window (mitigate: protection rules staged before push where GitHub permits, else minimize window and verify immediately). R-A2 deploy workflow drift vs local gate (mitigate: G4 packet step 5 runs the gate in CI before deploy). R-A3 origin history divergence (none known — origin/main is a strict ancestor; verify `git merge-base` = `origin/main` before push; if not, STOP → human).
**Validation gates:** `git rev-list --count main..stepup/main` == 0; remote SHAs equal local; CI governance-gate green on origin; G4 smoke evidence recorded in ledger.
**Rollback:** branches are append-only promotions — rollback = repoint `origin/main` to prior SHA via protected-branch admin (recorded as incident), redeploy previous build; never history-rewrite.

## PHASE A.5 — RESIDUAL HYGIENE (repo-side, parallel after A)

**Objective:** execute the closed-end residual list from the Safe Deletion Certification. **Deliverables:** (1) delete `services/api-gateway/src/extensions/app-functions-runtime.ts` + `routes/app-store/extension-routes.ts` per ADR-016 **and in the same commit add a `no-app-functions-execution` guard validator**; (2) add sequential-migration validator; (3) remove 16 dead env lines, 2 dead flags, 14 dead dep declarations (per-workspace build check each); (4) delete 9 merged local branches; optional `artifacts/` 44MB move. **Gates:** gate green + full test suite after each commit; proof-before-delete grep evidence in ledger row. **Rollback:** single-commit revert each.

## PHASE B — HUMAN SEAM CLOSURE

**Objective:** close the 56 recorded seams by category and priority. **The full program is Document 3** — this phase is its execution envelope.
**Deliverables:** every CRITICAL seam closed with evidence rows; IMPORTANT seams closed or explicitly waived by ARB for pilot scope; seam table updated (rows superseded, never silently dropped).
**Dependencies:** A (origin + deploy exist); legal/finance humans for ARB seams.
**Risks:** provider onboarding lead times (WhatsApp WABA, KYC providers — start earliest); legal entity facts (`SKIP-BRAND-LEGAL-FACTS`) block invoicing.
**Validation gates:** per-seam evidence artifacts + provider-mode badge honesty (no `setup_required` surfaces lying); gate green.
**Rollback:** seams are additive provisioning; rollback = disable credential/flag, restore `setup_required` state.

## PHASE C — PRODUCTION INFRASTRUCTURE

**Objective:** production environments, secrets, monitoring, alerting, backups, DR, deployment discipline. **Full program is Document 4.**
**Deliverables:** PITR enabled + restore drill (SKIP-W0); Sentry DSN + alert routing + redaction proof (SKIP-W3, CAP-C10); secret rotation + dual-secret cutover (SKIP-W4); mTLS/CF-Access on internal routes (SKIP-W4-MTLS); production readiness checklist signed.
**Dependencies:** A. Parallel with B.
**Risks:** restore-drill on live tier mis-scoped → data incident (mitigate: drill on branch/staging restore target only).
**Validation gates:** checklist in Document 4 §6, all rows EVIDENCED.
**Rollback:** infra changes are provider-console reversible; document each toggle in ledger.

## PHASE D — MONEY CERTIFICATION

**Objective:** prove order → payment → capture → ledger → settlement → refund end-to-end on live rails. **Full program is Document 5**, which executes the ratified `MONEY_UNIFICATION_IMPLEMENTATION_PLAN.md` live phases (CAP-C01…C05) + `SKIP-D5-LIVE-MONEY-RECONCILIATION`.
**Dependencies:** A, C, B-seams: PA-split live (HR-PA-SPLIT-LIVE), merchant PSP credentials, webhook endpoints.
**Validation gates:** all six scenario classes pass with zero unexplained suspense; accounting invariants hold on live data; reconciliation runs clean for 7 consecutive days.
**Rollback:** Document 5 §5 (provider-side void/refund + ledger reversing entries; never mutate ledger rows).

## PHASE E — LIQUID ACTIVATION

**Objective:** Liquid parity proven, canary run, ARB default flip. **Full program is Document 6** (executes `LIQUID_CONVERGENCE_IMPLEMENTATION_PLAN.md` + CAP-C08 + CAP-C12 + SKIP-CAP-LIQUID-CHROME). **React deletion is explicitly out of scope until after G + 30 days stability.**
**Dependencies:** A; store-publish pipeline live cert (CAP-C12).
**Validation gates:** snapshot parity corpus 100% on the 20 frozen sections; canary error/latency within budget; ARB flip approval recorded.
**Rollback:** default flag back to React path (validator-enforced OFF state is the safe pole); zero data migration involved — render-path switch only.

## PHASE F — MERCHANT PILOT

**Objective:** 5 real merchants transacting. **Full program is Document 7.**
**Dependencies:** D certified; C monitoring live; B-critical: KYC (CAP-C15), logistics (CAP-C16), email (CAP-C18), WhatsApp lifecycle sends (SKIP-W7), mobile Turnstile (CAP-C09).
**Validation gates:** Document 7 §6 success criteria, measured over 21 pilot days.
**Rollback:** per-merchant offboarding path with funds settled to zero and data export — defined before the first merchant onboards.

## PHASE G — LAUNCH CERTIFICATION

**Objective:** the terminal GO/NO-GO. **Full program is Document 8.** Consumes evidence from A–F; produces a signed launch certificate row in the ledger. No phase may be self-certified by the agent that executed it — G requires human sign-off per domain.

---

## TIMELINE & CRITICAL PATH (calendar-realistic, not effort-padded)

| Phase | Duration | Critical-path driver |
|---|---|---|
| A | 1–2 days | human availability only |
| A.5 | 2–3 days | parallel |
| B | 2–6 weeks | WhatsApp WABA + KYC provider onboarding lead times (start day 1) |
| C | 1 week | PITR + drill scheduling |
| D | 2 weeks | 7-day clean reconciliation soak |
| E | 2–3 weeks | parity corpus + canary soak (parallel) |
| F | 3–4 weeks | 21-day pilot window |
| G | 2–3 days | evidence assembly |
| **Total** | **~8–11 weeks** | B's provider lead times and F's pilot window dominate |

**Program-level rollback doctrine:** every phase ends in a state where stopping is safe (frozen repo + recorded seams). There is no step in this program after which "the only way out is forward."
