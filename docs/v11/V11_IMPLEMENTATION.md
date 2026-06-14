# LCIS V11 Implementation

All 24 phases, by **extending** existing LCIS — no duplicate engines/graphs/APIs, no fabricated telemetry/health/incidents. Change set: `tools/graph-server/business-flow-intel.mjs` (new), `tools/graph-server/server.mjs`, `tools/graph-server/index.html`, `CLAUDE.md`, `docs/v11/`.

## New engine
**`business-flow-intel.mjs`** (Phases 1/7/8/9/11/12) — the 10 business journeys composed from repository truth: systems (routes/rpcs/tables/queues/workers) from domain-intel, dependencies from the domain graph edges, recovery from the runbooks engine, money/tenant from the schema. Stages/actors curated to the canonical explain-flows. **9 implemented, 32 shared-domain edges**; Subscription = NOT IMPLEMENTED (no `subscriptions` domain). Live metrics NOT CONNECTED + their exact source.

## New endpoints (compose existing engines)
| Endpoint | Phase | Composition |
|----------|:-----:|-------------|
| `/api/business-flow` (`?journey=`) | 1/7/8/9/11/12 | business-flow-intel |
| `/api/business-impact?domain=` | 3 | impact-score + explain → plain-language merchant/customer/revenue/operational/growth/launch |
| `/api/investor` | 15 | readiness-v2 + merchant-intelligence + revenue-v2 + security-intelligence + launch-center |
| `/api/developer` | 16 | explain `gettingStarted` + flows + journeys |
| `/api/founder` | 4 | executive-center |

## UI — Business Intelligence modes (index.html)
Injected a "Business Intelligence" nav section + page renderers, all reusing the existing page pattern:

| Phase | Mode | Renderer → source |
|:-----:|------|-------------------|
| 4 | **Founder / Executive** | `xFounder` → `/api/founder` (verdict + 7 readiness panels + blockers) |
| 5 | **Operations** | `xOperationsHub` → `/api/observability` (topology + live NOT CONNECTED + money-domain health) |
| 6/17 | **Support** | `xSupport` → `/api/investigate` (NL: where is order / why payment failed / why refund pending) |
| 15 | **Investor** | `xInvestor` → `/api/investor` (6 plain-language panels) |
| 16 | **New Developer (30 min)** | `xDeveloper` → `/api/developer` (architecture walk + domains + flows + journeys) |
| 1/2/11 | **Business Flows** | `xBusinessFlows` → `/api/business-flow` (10 journey cards + 6 business graph layer tabs) |
| 2/9 | **Journey Workspace** | `xJourney(key)` → `/api/business-flow?journey=` (Overview/Purpose/Actors/Flow/Systems/Dependencies/Failure/Recovery/Metrics + AI/Atlas) — deep-linkable `/journey/<key>` |
| 10 | **Copilot V2** | `v11Copilot` routes business/journey/mode NL → opens the right workspace (wired into `runCopilot`) |
| 18 | **Workspace auto-gen** | every journey/domain query → full workspace (existing + journey) |
| 19 | **Live integration prep** | existing read-only adapters / federation (unchanged) |

## Router
Extended V10's router with `/journey/<key>` (parse + apply + pushState), so journeys are refresh-safe and shareable like domains.

## Reuse & honesty
Net-new code = 1 engine + 5 endpoints + the BI UI layer. Everything else composes existing engines (executive-center, observability, investigate, impact-score, revenue-v2, explain, customer-journey, merchant, runbooks, knowledge graphs). No business-logic/payment/OAuth/RLS/secret change; no new gate validator. Live values are CONNECTED or NOT CONNECTED; the Subscription journey is surfaced as NOT IMPLEMENTED rather than fabricated.
