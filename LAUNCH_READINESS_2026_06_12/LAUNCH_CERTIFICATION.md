# DOCUMENT 8 — LAUNCH CERTIFICATION

**Scope:** Phase G — the terminal gate between "pilot" and "open for merchants." Launch = public self-serve merchant signup on `letbuyy.com`. This certification consumes evidence from Phases A–F; it generates none of its own. **No self-certification:** the agent or person who executed a phase may not be its sole certifier; each domain row below names a human sign-off.

## 1. LAUNCH REQUIREMENTS BY DOMAIN

### 1.1 Security
- Live tenancy proofs green in production: anon-grant probe (SKIP-D2), FORCE-RLS coverage (SKIP-D4), RT-1…RT-9 red-team under production roles (CAP-C11).
- Identity: sole-issuer holds live; step-up cryptographic path certified (CAP-C06); mobile Turnstile single-use exchange certified (CAP-C09); secret rotation drill done ≤ 90 days ago (SKIP-W4).
- Perimeter: internal routes behind CF-Access/mTLS (SKIP-W4-MTLS) or explicit ARB risk acceptance recorded.
- Zero open security P0/P1 from pilot; `/api/auth/switch`-class regression tests green (the takeover never comes back).

### 1.2 Money
- Phase D certificate: 12/12 scenarios + 7-day clean soak (G-D1…G-D5).
- Pilot money record: F2/F3/F4 green — ledger-complete orders, scheduled payouts, clean refunds/COD.
- Invariants I1–I8 re-run green on the full pilot dataset at certification time.
- Payout kill-switch tested; finance sign-off on the pilot ledger.

### 1.3 Identity
- KYC path live (automated, or manual-review with documented operator capacity for projected signup volume).
- OIDC/HS256-drain status explicitly dispositioned: either drained (CAP-C07 + SKIP-IDN-R2 telemetry) or formally deferred by ARB with the dual-verify risk recorded.
- Legal entity facts resolved (SKIP-BRAND-LEGAL-FACTS) — ToS/privacy/invoice footers truthful; DPDP posture recorded (HR-LEGAL-DPDP-PA).

### 1.4 Infrastructure
- Document 4 checklist rows 1–12 all EVIDENCED and ≤ 30 days old (re-verify stale rows).
- DR drill executed within RTO/RPO; PITR active; restore evidence current.
- Deploy discipline held through pilot: every production change via gated workflow (audit the deploy log — zero console deploys).

### 1.5 Monitoring
- Alert end-to-end certified (CAP-C10) and **fired truthfully during pilot** (at least one real page handled per runbook).
- Money pages, availability synthetics, branch-lag monitor all active; on-call rota named for launch week.
- Error budget defined for launch month (availability ≥ 99.5%, checkout success ≥ 99%).

### 1.6 Merchant Success
- Pilot exit F1–F10 green (Document 7 §6).
- Self-serve onboarding tested by a cold user (someone outside the team completes signup→first-order without human help, timed ≤ 1 day).
- Support capacity plan for launch volume (rota, FAQ/runbook from pilot tickets, offboarding path generalized).
- Theme state coherent: Liquid canary disposition recorded (default flipped post-ARB, or launch-on-React with Phase E continuing — either is launchable; ambiguity is not).

## 2. GO / NO-GO CHECKLIST

Convene: founder (chair), engineering owner, finance/ARB signer, ops/support owner. Each row: GO / NO-GO / WAIVED (waiver = named risk-acceptor + expiry date; **rows marked ⛔ are non-waivable**).

| # | Gate | Domain | Evidence | Sign-off | ⛔ |
|---|---|---|---|---|---|
| 1 | origin == reality; gate green on main; zero drift since pilot | Governance | CI link, SHA match | eng | ⛔ |
| 2 | Tenancy probes green in production | Security | SKIP-D2/D4, CAP-C11 | eng | ⛔ |
| 3 | Step-up + Turnstile live certs | Security | CAP-C06/C09 | eng | ⛔ |
| 4 | Money Phase D certificate + pilot invariants re-run | Money | Doc 5 gates | finance | ⛔ |
| 5 | Zero unexplained recon breaks, trailing 14 days | Money | recon log | finance | ⛔ |
| 6 | Payout kill-switch live-tested | Money | drill row | eng |  |
| 7 | KYC live path + operator capacity | Identity | CAP-C15 status | ops | ⛔ |
| 8 | Legal facts + ToS/privacy/DPDP posture | Identity | SKIP-BRAND-LEGAL-FACTS | founder | ⛔ |
| 9 | Infra checklist 12/12 current | Infrastructure | Doc 4 §7 | eng | ⛔ |
| 10 | DR drill within RTO/RPO | Infrastructure | drill record | eng |  |
| 11 | Alerting fired-and-handled in pilot; rota named | Monitoring | page record | ops | ⛔ |
| 12 | Pilot F1–F10 green | Merchant | Doc 7 evidence pack | founder | ⛔ |
| 13 | Cold-user self-serve onboarding ≤ 1 day | Merchant | timed run | ops |  |
| 14 | Theme disposition recorded (flip or React-launch) | Merchant | ARB row | founder |  |
| 15 | All 🔴 CRITICAL seams closed; open 🟡 each ARB-dispositioned | Program | Doc 3 table state | founder | ⛔ |
| 16 | Launch-week freeze: no non-essential deploys planned | Program | calendar | eng |  |

**Decision rule:** any ⛔ row NO-GO ⇒ program NO-GO (fix and reconvene; no partial launches). All ⛔ GO + every non-⛔ row GO-or-waived ⇒ **LAUNCH CERTIFIED**.

## 3. CERTIFICATION ARTIFACT

On GO: append the launch certificate row to `EXECUTION_LEDGER.md` (date, tree SHA, the 16 gate verdicts, signers), supersede the launch-blocking seam rows it closes, and record the launch-day rollback stance: Document 4 §6 redeploy path + payout kill-switch + signup pause flag as the three levers. Post-launch, the standing cadence becomes: weekly recon attestation, monthly checklist re-verification, and Phase E React-decommission clock (G + 30 days) starts now.
