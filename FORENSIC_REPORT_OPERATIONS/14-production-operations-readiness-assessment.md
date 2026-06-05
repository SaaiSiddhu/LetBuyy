# 14. Production Operations Readiness Assessment

Readiness of LetBuyy to be *operated as a production business* — distinct from runtime/deployment readiness, which the repo's own certification machinery already tracks.

## Scoring Model
Per domain: **Ready** (staff can operate it today, in-system, with audit) / **Conditional** (operable by super-admin via API/SQL only) / **Not Ready** (cannot be performed). Weighting reflects business criticality.

## Domain Scorecard

| Domain | Status | Rationale (evidence) |
|---|---|---|
| Runtime/SRE substrate | CONDITIONAL | Deep ops API (queues, replays, incidents, gates, drills) + CLI/validators; no UI, no paging. The repo's own `docs/operations` phase report concedes operational maturity "remaining unclaimed until real execute-mode evidence exists." |
| Deployment & rollback | CONDITIONAL→READY | `production-deploy.mjs`/`production-rollback.mjs`, readiness/health gate APIs + tables; CI-enforced validators (131) |
| Internal admin (read) | READY | Console wired read pages behind allowlist+MFA |
| Internal admin (act) | CONDITIONAL | All mutations API-only; 1 UI action platform-wide |
| Employee access mgmt | NOT READY | Portal unauthenticated; permissions unenforced; invite emails unsent |
| Support | NOT READY | 501 by design; no intake |
| Merchant success | CONDITIONAL | Read-only health/CRM dashboards; zero actions |
| Marketplace review | CONDITIONAL | Working queue+decision; blind reviews; super-admin-only |
| Trust & Safety | NOT READY | UI shell; no cases; actions disabled |
| Fraud/risk/disputes | NOT READY | Nothing exists |
| Finance ops | NOT READY | Ledgers without workflows; manual rails |
| Billing enforcement | NOT READY | No trial/dunning enforcement despite full schema |
| Compliance/DSR | NOT READY | Contract strings only |
| Internal analytics | CONDITIONAL | MRR/ARR live; churn/GMV absent; pipeline service empty |
| Audit & evidence | READY (collection) / CONDITIONAL (use) | Strong write-side audit; viewer exists; no export/retention/reason capture |
| Incident mgmt | CONDITIONAL | API+tables, no UI/paging/on-call |
| Teams/internal coordination | NOT READY | No teams/tasks/comms/approvals |
| Mobile operator surface | NOT READY | Flutter counter demo (`apps/mobile/operator-app/lib/main.dart`) |

**Totals: 1.5 Ready / 7.5 Conditional / 9 Not Ready** out of 18 domains.

## Readiness by Actor (can this person operate in production?)
- Founder/super-admin: YES, via console reads + raw API writes + SQL (single-human dependency).
- Any platform employee: NO — cannot be securely admitted, permissioned, or given a working tool other than the review queue (which requires super-admin anyway).
- Any partner-facing or merchant-facing operational function: NO in-system path.

## Gate Assessment (what "production operations ready" would require — statement of fact about current failure, not a design)
1. **Identity gate — FAILED:** an employee surface accepts merchant sessions; employee RBAC unenforced; two admin allowlist sources diverge.
2. **Obligation gate — FAILED:** cannot meet support, dispute, DSR, or payout obligations with evidence.
3. **Enforcement gate — FAILED:** schema states (frozen trials, plan limits, approved flags) have no enforcement actors.
4. **Observability-of-humans gate — PARTIAL:** machine audit strong; human attribution collapses to `super_admin`; no reasons.
5. **Continuity gate — FAILED:** operations are founder-bound; no role below super-admin can act; bus-factor = allowlist length.

## Contrast With the Repo's Own Certifications
The repository carries extensive *runtime* certification machinery (operational_certification_reports, production_readiness_gate_runs, chaos/failover/load tables, ~115 governance docs). None of it measures *human-operations* readiness — there is no governance doc for support SLAs, review SLAs, payout release control, or employee tooling. The platform certifies that machines can run; nothing certifies that people can operate.

## Verdict
**Not ready for production operations beyond founder-operated scale.** The runtime is governed and observable; the business operating layer (people, permissions, queues, obligations) is between absent and API-only. Current state supports a controlled beta where founders are simultaneously support, reviewer, finance, T&S, and SRE — with the explicit caveats that employee surfaces must not be exposed (auth gap) and payment/compliance obligations remain manually honored.
