# LCIS X Health Report (Phase 9)

Per-domain live health for all 22 domains, composed by `live-health-intel.mjs` from repository truth (domain graph + runbooks + CODEOWNERS + RLS coverage + open V1 blockers). **Structural coverage is CONNECTED; live availability and live incident counts are NOT CONNECTED** until an environment is wired. Scores are labelled heuristics, not telemetry.

## Each domain gets
Health Score · Availability · Risk Score · Dependency Health · Incident Count · Runbook Coverage · Owner Coverage · Coverage Score.

## Platform summary
| Metric | Value |
|--------|------:|
| Domains | 22 |
| Avg health | 90 |
| Avg risk | 40 |
| Avg coverage | 98 |
| Runbook coverage | 100% (all 22 domains: detection/diagnosis/recovery/rollback/verification) |
| Availability (live) | **NOT CONNECTED** |
| Live incidents | **NOT CONNECTED** |

## Highest-risk domains (repository-truth scoring)
| Domain | Health | Risk | Coverage | Open blockers | Dependency |
|--------|:------:|:----:|:--------:|:-------------:|:----------:|
| payments | 80 | **73** | 88 | 0 | HEALTHY |
| payouts | 85 | **64** | 90 | 0 | HEALTHY |
| shipping | 92 | 58 | 100 | 1 (LB-7) | HEALTHY |
| storefront | 74 | 56 | 100 | 2 (LB-8, LB-9) | HEALTHY |
| orders | 96 | 55 | 100 | 0 | DEGRADED |

Risk is driven by money flag, tenant flag, open V1 blockers, fan-in (blast radius), and RLS exposure — all repository truth. Payments scores highest (money + high fan-in: consumed by refunds/orders/operations).

## Signals
- **High risk (≥60):** payments, payouts.
- **Degraded dependencies** (depends on a domain with an open blocker): orders, themes, operations.
- **Domains with open V1 blockers:** shipping, storefront, themes, identity, authentication, gst, notifications (mapped from LB-7/8/9/10/12).

## Honesty boundary
- **CONNECTED (repository truth):** health/risk/coverage scores, runbook coverage, owner coverage, RLS coverage, dependency graph, structural open-blocker counts.
- **NOT CONNECTED (live, by design):** availability/uptime (needs Cloudflare workers health + Vercel deployment state), live incident feed (needs Cloudflare logs / on-call), live volumes. Each carries its exact required source.

## Endpoint
`/api/live-health` (all 22 domains + summary, or `?domain=` for one). Surfaced in the UI via the **🌐 Live** perspective (health/risk/coverage cards, dependency health, incident/runbook/owner table, NOT-CONNECTED availability).
