# 01 — Platform Console Truth Map (Agent 01) — VERIFIED

**Discovery executed** (classifier recovered). `apps/platform-console` (`@letbuyy/platform-console`, `tsc --noEmit`, 6 api proxy routes) is a **REAL 22-page internal-ops app** — most Phase-6 domains already exist. **Phase 6 is largely already built; the work is filling genuine gaps + deepening thin pages. Reuse, do not duplicate.**

## Existing pages (22) — domains PRESENT (do NOT rebuild)
`(dashboard)/`: dashboard, **merchants** + `merchants/[id]`, **operations** (724 lines, ~22 backend calls — very real), **audit-logs**, **trust-safety**, **compliance** (369 lines), **risk**, **revenue**, **analytics**, **money-reconciliation**, stores, subscriptions, users, employees, founding, marketplace-governance, settings. `(auth)/`: login, mfa.

Mapping to the mission's agents:
- Agent 02 Merchant Ops → **merchants** + detail EXIST.
- Agent 06 Fraud → **risk** page EXISTS.
- Agent 07 Compliance → **compliance** EXISTS.
- Agent 08 Trust & Safety → **trust-safety** EXISTS.
- Agent 09 Payouts → **money-reconciliation** EXISTS.
- Agent 10 Audit → **audit-logs** EXISTS.
- Agent 11 Executive Analytics → **revenue** + **analytics** EXIST.
- Agent 16 Observability → partly under **operations**.

## Genuine GAPS — Phase-6 domains with a real gateway backend but NO platform-console page
| Domain | Backend exists | Build target |
|---|---|---|
| **Incidents** (Agent 05) | `/runtime/incidents` (GET/POST/PATCH, incident RBAC) | **building this wave** |
| **Developer ops** (Agent 13) | `operations/developers.ts` (search/overview/moderation/payout/reconcile) | page over existing route |
| **Support center** (Agent 04) | `support_tickets` + `/employees/tickets` | page over existing route |
| **Order ops** (Agent 03) | orders backend (needs an internal global-search route) | partial |
| **Alerts** (Agent 14) | no clear backend | likely net-new (ARB) |
| **LCIS explorer** (Agent 12) | LCIS UI lives at `:3333` (`tools/graph-server`), separate | integration/embed |
| **Observability** (Agent 16) | LCIS `/api/observability` + operations | deepen existing |

## Realness caveat (to deepen, not rebuild)
Page backend-call counts vary: operations ~22 (very real), risk/merchants ~1 (thin-real), **compliance 0** (verify its data path — may be static/stubbed). "Deepen thin pages" is real follow-up, distinct from the absent-page gaps.

## Build plan (reuse-first)
Build the absent-page gaps (incidents → developer-ops → support center) as UI over the existing gateway routes, matching platform-console's conventions; deepen thin pages; net-new schema (alerts/cases) only where confirmed absent → ARB. Validate via `pnpm --filter @letbuyy/platform-console typecheck` + the launch/governance gates.

**This is the verified Agent-01 discovery.** It establishes that Phase 6 is ~70% pre-existing and pinpoints the real gaps — preventing the duplication the mission forbids.
