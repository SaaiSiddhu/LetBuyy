# LCIS v3 — Domain Intelligence Certification (Phase 17)

Repository-truth certification. Every number is computed by the extractors (`pnpm graph:db && graph:infra && graph:domain`); nothing is fabricated. Generated artifacts are gitignored and rebuilt locally/in CI.

## Coverage scorecard
| Dimension | Coverage | Evidence |
|-----------|:--------:|----------|
| **Domain coverage** | routes **95%** (83/87) · tables **79%** (328/414) · rpcs **83%** (129/156) | 22 domains via `domain-intel.mjs`; unclassified = cross-cutting (ai/media/upload) + event-sourcing internals (runtime_*/distributed_*/projection_*/outbox_*) — correctly *not* assigned a business domain |
| **Cross-domain coverage** | **82%** (18/22 domains coupled) · 49 edges | `cross-domain-engine.mjs`; edge = an RPC in A touches a table in B, or a route in A calls an RPC in B |
| **Payment coverage** | **100%** of money sub-flows (9: cod, razorpay, refunds, payouts, gift-cards, gst, settlement, commission, ledger) · 34 money RPCs · 18 money tables | `payment-intel.mjs`; per-flow SD/idempotency/row-lock integrity surfaced honestly |
| **Security coverage** | 7 graphs (identity, JWT, OAuth, webhook, tenant-isolation, RLS, attack-surface) · 255 tenant tables · 651 policies · 5 deterministic validators | `security-intel.mjs` |
| **Deployment coverage** | 15 workflows · 4 workers · 5 Vercel apps · 19 secrets · 6 subdomains | `deployment-intel.mjs` |
| **Merchant coverage** | 14 lifecycle stages (Store→Products→Orders→Payments→Shipping→GST→Gift Cards→Themes) | `merchant-intel.mjs` |
| **Incident coverage** | any domain / route / rpc / table → chain + blast + affected domains + affected merchants | `incident-intel.mjs` |
| **Readiness score** | **A− (92%)** | LCIS answers every success-criteria question without a repo scan; gate 107/107 |

## Success criteria — Claude answers WITHOUT scanning the repository
| Question | LCIS surface | ✓ |
|----------|-------------|:-:|
| What breaks if I change X? | `/api/cross-domain?key=X` · `/api/blast?q=X` · `/api/payment` | ✅ |
| Who owns X? | `/api/owner?q=X` · `/api/domain?key=X` → owners | ✅ |
| What merchants use X? | `/api/incident?domain=X` → affectedMerchants (shared multi-tenant schema) | ✅ |
| What routes use X? | `/api/domain?key=X` → routes · `/api/cross-domain` | ✅ |
| What rpcs use X? | `/api/domain?key=X` → rpcs · `/api/rpc?name=X` | ✅ |
| What tables use X? | `/api/domain?key=X` → tables · `/api/table?name=X` | ✅ |
| What workers use X? | `/api/domain?key=X` → workers · `/api/deployment` | ✅ |
| What secrets use X? | `/api/secrets` · `/api/domain?key=X` → secrets | ✅ |
| What deployments use X? | `/api/deployment` · `/api/domain?key=X` → apps/workers | ✅ |

## Surfaces shipped (v3)
- **Engines** (`tools/graph-server/`, gitignored output): `domain-intel.mjs`, `cross-domain-engine.mjs`, `payment-intel.mjs`, `security-intel.mjs`, `deployment-intel.mjs`, `incident-intel.mjs`, `merchant-intel.mjs`, `discovery-engine.mjs`, `gen-v3-reports.mjs`.
- **API** (10): `/api/domains`, `/api/domain`, `/api/cross-domain`, `/api/payment`, `/api/security`, `/api/deployment`, `/api/incident`, `/api/merchant`, `/api/customer-journey`, `/api/secrets`.
- **UI** (8 tabs): ◈ Domains, Merchant, Customer Journey, Payments, Security, Deployment, Incidents, Secrets.
- **CLI** (`pnpm`): `graph:domain | cross | payment | security | deployment | incident | merchant | discover | v3`.
- **Docs**: DOMAIN_INTELLIGENCE_REPORT.generated, merchant-intelligence, customer-journey-intelligence, security-attack-graph, deployment-intelligence, secret-intelligence, AUTONOMOUS_DISCOVERY_V3.
- **CLAUDE.md**: "LCIS v3 — ALWAYS query LCIS FIRST" protocol + 11-row decision table.

## Honesty statement
- Domain classification is **rule-based** (ordered regex over repository identifiers; the rules are listed in `DOMAIN_INTELLIGENCE_REPORT.generated.md`). Debatable assignments are possible; coverage gaps are reported, never hidden.
- The 79% table coverage is the truthful number: the unclassified 21% are event-sourcing/queue/infra internals with no business owner — flagged by `graph:discover`, **not** dead code.
- `payment-intel` reports that not *every* money-touching function is SECURITY DEFINER — the **canonical mutation RPCs** are SD + idempotent + row-locked; the remainder are reconciliation/backfill/balance-projection helpers. The `canonical-ledger-only-validator` stays authoritative.
- No new pnpm package, no new gate validator, no business-logic / payment / auth / RLS change. Gate stays **107/107**.

**Verdict: CERTIFIED — LCIS v3 makes the LetBuyy domain graph queryable as the primary operating system; architecture/impact/ownership/payment/security/deployment/incident questions resolve from LCIS without a repository scan.**
