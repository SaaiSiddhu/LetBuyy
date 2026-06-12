# GO / NO-GO Checklist — Document 8 §2

**Convene:** founder (chair), engineering owner, finance/ARB signer, ops/support owner.
**Rule:** any ⛔ NO-GO = program NO-GO; fix and reconvene. All ⛔ GO + non-⛔ GO-or-waived = LAUNCH CERTIFIED.
**Status:** SCAFFOLD — evidence links are repo-side pointers. Verdicts (GO / NO-GO / WAIVED) and signatures are HUMAN actions.

> Waiver format: `WAIVED: [named risk-acceptor] | expires [date] | risk: [one-line statement]`

---

| # | Gate | Domain | Evidence pointer | Verdict | Sign-off | ⛔ |
|---|------|--------|-----------------|---------|----------|----|
| 1 | origin == reality; gate green on main; zero drift since pilot | Governance | CI governance-gate link; `git rev-parse HEAD` == `git rev-parse origin/main`; `git rev-list --count main..origin/main` == 0 | PENDING | eng | ⛔ |
| 2 | Tenancy probes green in production | Security | `SKIPPED_HUMAN_DECISIONS.md` SKIP-D2 + SKIP-D4 evidence; `tests/executable/tenant-redteam-postgres.test.mjs` (CAP-C11) run against production-shaped DB | PENDING | eng | ⛔ |
| 3 | Step-up + Turnstile live certs | Security | CAP-C06 `services/api-gateway/src/__tests__/stepup-crypto.test.ts` + `EXECUTION_LEDGER.md` FINAL-F-CAP-C06; CAP-C09 `apps/identity-platform/src/__tests__/turnstile-proof.test.ts` + `EXECUTION_LEDGER.md` FINAL-F-CAP-C09; live secret provisioned via human seam SKIP-W7 | PENDING | eng | ⛔ |
| 4 | Money Phase D certificate + pilot invariants re-run | Money | `evidence/d-money-certification/` (12/12 scenarios pass + 7-day soak; gate G-D1–G-D5); `scripts/money-certification/check-invariants.mjs` re-run on pilot dataset at certification time | PENDING | finance | ⛔ |
| 5 | Zero unexplained recon breaks, trailing 14 days | Money | Reconciliation log from `services/queue-workers/src/money-ledger-reconciliation.ts` scheduled runs; `evidence/f-pilot/PHASE_F_EVIDENCE_PACK.md` F2 | PENDING | finance | ⛔ |
| 6 | Payout kill-switch live-tested | Money | Drill record: kill-switch toggled → verified payout release blocked → toggled back → payout released; ledger row appended | PENDING | eng | |
| 7 | KYC live path + operator capacity for projected signup volume | Identity | `packages/infrastructure/kyc-verification-adapter/index.ts` CAP-C15 (automated pass or manual-review path); operator capacity documented for signup projection; `EXECUTION_LEDGER.md` FINAL-F-CAP-C15-KYC-MANUAL-REVIEW | PENDING | ops | ⛔ |
| 8 | Legal facts + ToS/privacy/DPDP posture | Identity | `SKIPPED_HUMAN_DECISIONS.md` SKIP-BRAND-LEGAL-FACTS resolved; ToS/privacy/invoice footers truthful in production; DPDP PA posture recorded (HR-LEGAL-DPDP-PA) | PENDING | founder | ⛔ |
| 9 | Infra checklist 12/12 current (≤ 30 days old) | Infrastructure | `PRODUCTION_INFRASTRUCTURE_PROGRAM.md` §7 all rows EVIDENCED; re-verify any rows older than 30 days | PENDING | eng | ⛔ |
| 10 | DR drill within RTO/RPO | Infrastructure | PITR active (SKIP-W6); restore drill executed (drill record with actual RTO/RPO measured) | PENDING | eng | |
| 11 | Alerting fired-and-handled in pilot; on-call rota named for launch week | Monitoring | `EXECUTION_LEDGER.md` FINAL-F-CAP-C10-RUNTIME-ALERTING; at least one real page handled per runbook during pilot; on-call rota named | PENDING | ops | ⛔ |
| 12 | Pilot F1–F10 green | Merchant | `evidence/f-pilot/PHASE_F_EVIDENCE_PACK.md` all cells PASS | PENDING | founder | ⛔ |
| 13 | Cold-user self-serve onboarding ≤ 1 day | Merchant | Timed cold-user run (someone outside the team completes signup → first-order without human help; time recorded) | PENDING | ops | |
| 14 | Theme disposition recorded (Liquid default flip or launch-on-React with Phase E continuing) | Merchant | ARB approval row in `EXECUTION_LEDGER.md` OR explicit "launch-on-React" decision row; `evidence/e-liquid-parity/PARITY_MATRIX.md` canary stage reached | PENDING | founder | |
| 15 | All 🔴 CRITICAL seams closed; open 🟡 each ARB-dispositioned | Program | `SKIPPED_HUMAN_DECISIONS.md` table: zero SKIP rows with priority CRITICAL and status OPEN; all MEDIUM OPEN rows have explicit ARB disposition references | PENDING | founder | ⛔ |
| 16 | Launch-week freeze: no non-essential deploys planned | Program | Calendar entry / deploy freeze notice in Slack/GitHub; branch protection rules verified | PENDING | eng | |

---

## Decision

| | |
|-|-|
| **Decision date** | PENDING |
| **Verdict** | GO / NO-GO |
| **Signers** | Founder: __ · Eng owner: __ · Finance/ARB: __ · Ops: __ |
| **Certificate commit SHA** | PENDING |
| **Rollback stance** | Document 4 §6 redeploy path + payout kill-switch + signup pause flag |

---

## On GO: Certificate Row

Append to `EXECUTION_LEDGER.md`:

```
| LAUNCH-CERTIFICATE | Launch certified: 16/16 gate verdicts, signers confirmed, tree SHA [SHA].
  Phase E React-decommission clock starts (G + 30 days). Post-launch standing cadence:
  weekly recon attestation, monthly checklist re-verification. Rollback levers: Doc 4 §6
  redeploy + payout kill-switch + signup pause. |
  [files touched in final cleanup] | None | None | All 16 GO/NO-GO gate verifications |
  LAUNCH-CERTIFIED | [cert commit SHA] |
```

Supersede all launch-blocking seam rows with the certificate commit SHA as evidence pointer.
Record the launch-day rollback stance on the same row.
