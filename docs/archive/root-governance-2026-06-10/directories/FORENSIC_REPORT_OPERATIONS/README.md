# LetBuyy Operations, Internal Admin & Teams Platform — Forensic Investigation

**Date:** 2026-06-05
**Scope:** Internal operational systems, employee tooling, support, review, moderation, permissions, and team management capabilities of the current LetBuyy platform.
**Method:** Full repository scan — all apps, services, packages, database migrations, seeds, governance docs, scripts. Read-only investigation. No code written, no files modified outside this report directory.

## Deliverables

| # | Report | File |
|---|--------|------|
| 1 | Internal Operations Audit | [01-internal-operations-audit.md](01-internal-operations-audit.md) |
| 2 | Employee Workflow Report | [02-employee-workflow-report.md](02-employee-workflow-report.md) |
| 3 | Merchant Lifecycle Investigation | [03-merchant-lifecycle-investigation.md](03-merchant-lifecycle-investigation.md) |
| 4 | App Marketplace Operations Report | [04-app-marketplace-operations-report.md](04-app-marketplace-operations-report.md) |
| 5 | Theme Marketplace Operations Report | [05-theme-marketplace-operations-report.md](05-theme-marketplace-operations-report.md) |
| 6 | Support Platform Investigation | [06-support-platform-investigation.md](06-support-platform-investigation.md) |
| 7 | Teams Platform Investigation | [07-teams-platform-investigation.md](07-teams-platform-investigation.md) |
| 8 | Internal Admin Investigation | [08-internal-admin-investigation.md](08-internal-admin-investigation.md) |
| 9 | Permission System Report | [09-permission-system-report.md](09-permission-system-report.md) |
| 10 | Operational Gap Analysis | [10-operational-gap-analysis.md](10-operational-gap-analysis.md) |
| 11 | Enterprise SaaS UI/UX Research Report | [11-ui-ux-research-report.md](11-ui-ux-research-report.md) |
| 12 | Operational Risk Assessment | [12-operational-risk-assessment.md](12-operational-risk-assessment.md) |
| 13 | Critical Missing Systems Report | [13-critical-missing-systems-report.md](13-critical-missing-systems-report.md) |
| 14 | Production Operations Readiness Assessment | [14-production-operations-readiness-assessment.md](14-production-operations-readiness-assessment.md) |
| 15 | Evidence Appendix | [15-evidence-appendix.md](15-evidence-appendix.md) |

## Headline Findings

1. **The backend admin API is ahead of the internal UIs.** `services/api-gateway` exposes super-admin store suspension, employee invites, marketplace review decisions, incident management, queue recovery, and replay authorization — but the two internal web apps render most of these as read-only dashboards or disabled buttons.
2. **There is no support platform.** `GET /employees/tickets` returns HTTP 501 `SUPPORT_TICKETS_UNAVAILABLE` by design. No ticket tables, no chat, no helpdesk integration. Merchants have no in-product channel to reach LetBuyy.
3. **The employee system is split-brained.** One `employees` table serves both merchant store staff and LetBuyy platform staff (disambiguated by nullable `store_id`); invite emails are a TODO; seeded `employee_permissions` are never enforced by any middleware.
4. **The operations portal has no employee authentication guard.** Any merchant session can load it. The platform console, by contrast, enforces email allowlist + magic link + TOTP MFA.
5. **One review queue carries the entire marketplace.** A single wired UI (`platform-operations-portal /operations`) approves/rejects apps and themes with no code inspection, no preview, no assignment, no SLA, no appeal.
6. **Fraud, risk, compliance, and DSR systems are absent** — no tables, no APIs, no UI. Trust & Safety is a UI shell over derived signals with every action disabled.
7. **The operator mobile app is an unmodified Flutter counter demo** despite being canonical topology.
