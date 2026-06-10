# LetBuyy Apps Platform — Master Audit & Rearchitecture Blueprint

**Generated:** 2026-06-05 · Forensic audit + Shopify-parity target architecture. Read order = file order. No code was modified by this audit.

## Documents

| Doc | Title | Mandate phases |
|---|---|---|
| [01](01-executive-summary.md) | Executive Summary | — |
| [02](02-current-apps-ecosystem-audit.md) | Current Apps Ecosystem Audit (+ platform/architecture/integration/data/event-flow maps, docs-vs-reality) | P1, P2 |
| [03](03-shopify-gap-analysis.md) | Shopify Gap Analysis & Compatibility Report (scored 37/150) | P3 |
| [04](04-theme-integration-audit.md) | App ↔ Theme Integration Audit | P4 |
| [05](05-storefront-runtime-integration-audit.md) | App ↔ Storefront Runtime Audit | P5 |
| [06](06-merchant-integration-audit.md) | App ↔ Merchant App Audit | P6 |
| [07](07-error-misconfiguration-report.md) | Error & Misconfiguration Report (Critical/High/Medium/Low) | P7 |
| [08](08-legacy-deletion-report.md) | Legacy Deletion Report + File-by-File Deletion Plan | P8 |
| [09](09-refactor-plan-file-by-file.md) | File-by-File Refactor Plan | — |
| [10](10-target-architecture-apps-platform.md) | Target Apps Platform Architecture (lifecycle/ownership/diagrams) | P9 |
| [11](11-theme-app-extensions-blueprint.md) | Theme App Extensions / App Blocks / App Embeds Blueprint | P10 |
| [12](12-liquidjs-integration-blueprint.md) | LiquidJS Runtime Integration Specification | P11 |
| [13](13-storefront-runtime-integration-blueprint.md) | Storefront Runtime Integration Blueprint | P12 |
| [14](14-apps-marketplace-blueprint.md) | Apps Marketplace Architecture Specification | P13 |
| [15](15-partner-platform-blueprint.md) | Partner Platform Architecture | P14 |
| [16](16-database-refactor-blueprint.md) | Database Refactoring Blueprint (+ new tables DDL) | P15 |
| [17](17-api-refactor-blueprint.md) | API Refactoring Blueprint (+ new APIs) | P16 |
| [18](18-security-and-tenant-isolation-assessment.md) | Security & Multi-Tenant Isolation Assessment | — |
| [19](19-runtime-ownership-blueprint.md) | Runtime Ownership Blueprint + New Services | — |
| [20](20-final-architecture-blueprint.md) | Final Shopify-Style Architecture Blueprint | P17 |
| [21](21-implementation-roadmap.md) | Implementation Roadmap (Phases 0–12) | P18 |
| [22](22-production-readiness-assessment.md) | Production Readiness Assessment + GA Gate | — |

## Required-Deliverables Mapping (1–26)

| # | Deliverable | Doc |
|---|---|---|
| 1 | Executive Summary | 01 |
| 2 | Current Apps Ecosystem Audit | 02 |
| 3 | Shopify Gap Analysis | 03 |
| 4 | Theme Integration Audit | 04 |
| 5 | Storefront Integration Audit | 05 |
| 6 | Merchant Integration Audit | 06 |
| 7 | LiquidJS Integration Blueprint | 12 |
| 8 | App Extensions Blueprint | 11 |
| 9 | App Blocks Blueprint | 11 §5 (+13) |
| 10 | App Embeds Blueprint | 11 §6 (+13) |
| 11 | Apps Marketplace Blueprint | 14 |
| 12 | Partner Platform Blueprint | 15 |
| 13 | Database Refactor Plan | 16 |
| 14 | API Refactor Plan | 17 |
| 15 | Security Assessment | 18 |
| 16 | Multi-Tenant Isolation Assessment | 18 |
| 17 | Error & Misconfiguration Report | 07 |
| 18 | Legacy Deletion Report | 08 |
| 19 | File-by-File Deletion Plan | 08 |
| 20 | File-by-File Refactor Plan | 09 |
| 21 | New Services To Build | 19 §3 |
| 22 | New APIs To Build | 17 §3 |
| 23 | New Database Tables To Build | 16 §2 |
| 24 | Runtime Ownership Blueprint | 19 |
| 25 | Final Shopify-Style Architecture Blueprint | 20 |
| 26 | Production Readiness Assessment | 22 |

## Conventions
- Issue IDs (C/H/M/L#) defined in doc 07; refactor IDs (A/B/C/D/E#) in doc 09; both referenced across all blueprints and the roadmap.
- Evidence: `path:line` citations refer to repo state at audit date; doc 02 §11 lists known stale claims in pre-existing root documents.
- Governance: any implementation following these blueprints must keep `node scripts/validate-governance.mjs` green and respect `AGENTS.md` + `docs/governance/runtime-boundaries.md` (amendments proposed in doc 19 §5).
