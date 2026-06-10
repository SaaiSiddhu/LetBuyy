# LetBuyy Platform — Forensic Codebase Investigation

**Engagement:** Platform forensic investigation — *documentation only, no code changed.*
**Date:** 2026-06-05 — **second pass, post-remediation** (HEAD `127a850e` on `develop`)
**Scope:** Entire `Letbuyy_Store` monorepo — ~2,951 in‑scope files, 9 web apps, 3 mobile apps (1 real), 9 services (3 implemented), 30 packages, ~233‑table database.
**Method:** A first pass (AM) produced reports `01`–`17`. Then 68 commits (`63053d18..HEAD`; +21,140 −8,527) landed a Codex Foundation‑Hardening run (phases F0 truth/topology + F1 backend integrity) plus five merged workstreams. This **second pass** re‑verified every prior finding against current source, tagged each RESOLVED / PARTIAL / STILL‑OPEN, documented the new issues the remediation introduced, and re‑ran the repo's own `scripts/validate-governance.mjs` (now **129 validators**, exit 0). Each report carries a "Changes since first pass" section; cross‑cutting verification is in the Evidence Appendix.

> **Forensic constraint honored:** no file in the platform under investigation was written, modified, deleted, moved, or renamed. The only writes were the report files in this folder.

## Canonical deliverables (read in this order)

| # | Deliverable | File |
|---|------------|------|
| 1 | **Executive Summary** (post‑remediation) | [00-EXECUTIVE-SUMMARY.md](00-EXECUTIVE-SUMMARY.md) |
| 17 | **Critical Findings Summary** — resolution scoreboard + new findings | [16-critical-findings-summary.md](16-critical-findings-summary.md) |
| 16 | **Production Readiness Assessment** — with deltas | [15-production-readiness.md](15-production-readiness.md) |
| 2 | Repository Inventory & Maps | [01-repository-inventory.md](01-repository-inventory.md) |
| 3 | Domain Ownership Report | [02-domain-ownership.md](02-domain-ownership.md) |
| 4 | Application Investigation Report | [03-application-investigation.md](03-application-investigation.md) |
| 5 | Theme System Investigation | [04-theme-system.md](04-theme-system.md) |
| 6 | Storefront Runtime Investigation | [05-storefront-runtime.md](05-storefront-runtime.md) |
| 7 | Apps Ecosystem Investigation | [06-apps-ecosystem.md](06-apps-ecosystem.md) |
| 8 | Integration Investigation | [07-integration.md](07-integration.md) |
| 9 | Error & Misconfiguration Report | [08-error-misconfiguration.md](08-error-misconfiguration.md) |
| 10 | Dead Code Investigation | [09-dead-code.md](09-dead-code.md) |
| 11 | Duplication Report | [10-duplication.md](10-duplication.md) |
| 12 | Architecture Violation Report | [11-architecture-violations.md](11-architecture-violations.md) |
| 13 | Shopify Compatibility Report | [12-shopify-compatibility.md](12-shopify-compatibility.md) |
| 14 | Technical Debt Report | [13-technical-debt.md](13-technical-debt.md) |
| 15 | Risk Assessment Report | [14-risk-assessment.md](14-risk-assessment.md) |
| 18 | Evidence Appendix (verification log) | [17-evidence-appendix.md](17-evidence-appendix.md) |

## The one-line conclusion (second pass)

The remediation closed the **honesty and ownership** layers — runtime inventories now agree and are validator‑locked, phantom services admit they're unbuilt, the constitution's dead DB section is corrected, and **core tables now have a single writer enforced by a new validator + regression test** (governance 128→129, still green). **But the product‑facing Criticals are all still open** (app API, compliance webhooks, app billing, theme‑editor preview, server cart, observability), and the single‑writer refactor **introduced a payment‑path auth hole that is fail‑open by default off‑production**, with the one test covering that surface wired into no runner. The platform is meaningfully *more honest and structurally cleaner*; it is not yet *more capable*, and is in one specific way slightly less safe. Shopify parity ticked 41/90 → **43/90 (≈4.8/10)**. See [Critical Findings](16-critical-findings-summary.md).

## Resolution at a glance

- **RESOLVED (verified):** C‑2, C‑12, C‑13, H‑1, H‑10, H‑12 — plus an app‑marketplace integrity batch and real multi‑template theme editing.
- **Correctly SKIPPED — NEEDS HUMAN:** H‑11 (payout rail).
- **STILL OPEN:** C‑1, C‑3, C‑4, C‑5, C‑6, C‑7, C‑8, C‑9, C‑10, C‑14 + H‑2/3/4/5/6/7/8/14/15/16/17.
- **NEW (introduced by remediation):** N‑1 fail‑open payment routes [High], N‑2 plaintext secret persistence [High], N‑3 orphaned security test [High], N‑4 uncontracted payment events, N‑5 duplicated event client, N‑6 ledger residue + dead queue jobs.

## Verification posture

Of 10 second‑pass headline claims re‑checked independently: **8 CONFIRMED, 2 PARTIALLY‑CONFIRMED, 0 REFUTED**; log, reproducible commands, and the live governance output in the [Evidence Appendix](17-evidence-appendix.md).

---

### Note on file numbering
The canonical set above is the complete, current investigation. Eight short stub files dated earlier (`03-application-reports.md`, `08-dead-code.md`, `09-duplication.md`, `10-architecture-violations.md`, `11-shopify-gap-analysis.md`, `12-technical-debt.md`, `13-risk-assessment.md`, `14-evidence-appendix.md`) are residue from an earlier partial pass, left in place at the user's instruction — **superseded, disregard them.** A separate `FORENSIC_REPORT_OPERATIONS/` folder (16 files) was produced by a different process and is outside this investigation's scope.
