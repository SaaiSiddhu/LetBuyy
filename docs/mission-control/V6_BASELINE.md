# LCIS Mission Control — V6 Baseline Audit (Phase 1)

Inventory of the LCIS platform at the start of the Mission Control program. All counts are repository-derived.

## Current inventory
| Asset | Count |
|-------|------:|
| Intelligence engines (`tools/graph-server/*.mjs`) | **59** |
| API endpoints (`/api/*`) | **57** |
| Technical-mode UI tabs | **47** |
| Explain-mode IA nodes | **15** |
| `pnpm graph:*` scripts | **44** |
| Generated/authored reports (`docs/central-intelligence/`) | **51** |
| Certifications (v2 → v6) | **7** |

## Intelligence layers (already operational before Mission Control)
- **Code** — Graphify graph (52,246 nodes / 66,761 edges / 3,279 communities) + Atlas.
- **Database** — db-intel: 414 tables · 156 RPCs · 651 policies · 395 triggers · 826 indexes.
- **Domain** — 22 domains · 49 cross-domain edges.
- **Infra / Runtime / Deployment** — 4 Workers, queues+DLQ, R2/Hyperdrive, 5 Vercel apps, 19 secrets; runtime observability graph.
- **Security** — 11 controls, 5 trust boundaries, 5 deterministic validators.
- **Merchant / Customer / Revenue / Cost / Telemetry / Memory / Fixing** (Omega) — unified into a 13-layer brain.
- **Explain mode (v6)** — dual-mode operating system (Explain default / Technical / Atlas), AI-context pack, copilot, command palette, readiness center.

## Gaps this program closes
| Gap (before) | Closed by |
|--------------|-----------|
| No foreign-key / relationship graph (db-intel had tables but not FKs) | `relationship-intel.mjs` — **705 FKs**, tenant root `sites` (fan-in 260) |
| No environment model / live-vs-repo distinction in the UI | `environment-intel.mjs` + header **environment switcher** (Local/Staging/Production) with honest "Live Data Source Not Connected" |
| No purpose-built knowledge sub-graphs | `knowledge-graphs.mjs` — business/journey/security/ownership/infrastructure/revenue/ai |
| No single Operations Center | `operations-center.mjs` — incident/deploy/env/runtime/queue/worker/dependency status |
| No Database Mission Control surface in Explain mode | Explain **Database** page (schema/relationship/policy/function explorers) |

## Current limitations (honest)
- **Live data is not connected** in any environment — runtime metrics, live deploy versions, revenue rows and per-merchant scores are query-bound to the named sources (Analytics Engine, deploy APIs, ledger). The repo holds the model + adapters, never fabricated values.
- Production readiness is **structural** (repository evidence), not a live SLA; launch is **NO-GO** (5 open launch-scope blockers).
- Marketplace / developer-portal are **frozen** (not deploy targets).

## Intelligence quality
- **Deterministic core**: the 107-validator governance gate is authoritative and green.
- **Heuristic layers** (domain classification, readiness scoring, drift) are clearly labeled as candidates with their verification command.
- **No fabricated metrics** anywhere — verified by cross-checking every certification number against fresh extraction across v2–v6.

> Baseline captured for the Mission Control program. See `CONTROL_CENTER_CERTIFICATION.md` for the post-program grade.
