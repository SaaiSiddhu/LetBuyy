# LCIS V11 Baseline Audit (Phase 0)

Repository-truth snapshot before V11 (Business + Operational Intelligence). Directly verified against the running server. V11 **extends** this — no rebuild, no duplicate engines/graphs/APIs, no fabricated telemetry.

## Domains, workspaces, perspectives
- **22 domains** (`/api/domains`): themes, marketplace, developer, gift-cards, refunds, payouts, payments, gst, discounts, shipping, inventory, collections, products, orders, storefront, authorization, authentication, identity, merchant, notifications, analytics, operations.
- **Domain Workspace** (V8/V9/V10): 17 perspectives (overview · explain · technical · database · api · infrastructure · security · operations · incidents · dependencies · impact · live · graphs · trace · related · ai · atlas). Search/select/URL → workspace.
- **Modes:** Explain (default) · Technical · Atlas, plus V10 URL/navigation foundation (deep links, history, command palette, typed edges, graph levels).

## Graph & journey layers (already present)
- **Knowledge-graph layers** (`/api/graph?kind=`): **business · journey · revenue** · security · ownership · infrastructure · ai.
- **Flows:** `/api/explain` → `flows` is a per-domain step list (e.g. orders: "Customer adds product → Cart → Checkout (totals+tax+shipping server-side) → Payment authorized/captured → Order created (create_checkout_order) → Inventory reserved → …").
- **Customer journey:** `/api/customer-journey` (funnel + stages) · `/api/customer-ops`.
- **Merchant journey:** `/api/merchant` operating graph (14 stages · 33 routes · 92 RPCs · 181 tables) · `/api/merchant-ops` · `/api/merchant-intelligence`.

## Operational layers (already present — LCIS X)
- `/api/executive-center` — Founder readiness (7 panels, verdict NO-GO, blockers, health).
- `/api/observability` — logs/events/deployments/incidents/errors/queues/workers (live = NOT CONNECTED).
- `/api/operations` — declared vs live area status.
- `/api/investigate?q=` — autonomous investigation (routes/rpcs/tables/queues/workers/incidents/owners + diagnosis).
- `/api/root-cause` · `/api/incident-control` · `/api/runbook?domain=` (detection/diagnosis/recovery/rollback/verification) · `/api/time-travel` (git points).
- `/api/impact-score?domain=` — affected apis/tables/workers/queues/domains/merchants/customers/revenuePaths/launchReadiness/security/rls/fk + impact·risk·recovery + whatBreaksIf (immediate/secondary/revenue/merchant/customer/operational).
- `/api/revenue-v2` (ledger models, money RPCs, gift-card liability; amounts NOT CONNECTED) · `/api/cost-intelligence`.
- `/api/memory` (why/decisions/migrations) · `/api/explain` `gettingStarted` (30-min onboarding).
- `/api/production-readiness-v2` · `/api/security-intelligence` · `/api/launch-command-center`.

## Missing Business Intelligence (V11 to add)
| Gap | V11 work |
|-----|----------|
| Unified **Business Flow** over the 10 journeys | new `business-flow-intel.mjs` → `/api/business-flow` (merchant/customer/order/checkout/payment/refund/inventory/payout/subscription/gift-card) as a Business Flow Graph |
| **Journey Workspaces** (Phase 2) | journey → Overview/Purpose/Actors/Dependencies/Systems/Failure/Recovery/Metrics/AI/Atlas |
| **Business Impact** in plain language (Phase 3) | `/api/business-impact?domain=` — merchant/customer/revenue/operational/growth/launch, plain-language (composes impact-score) |
| **Investor Mode** (Phase 15) | `/api/investor` — platform overview / business model / merchant lifecycle / growth / revenue / risk (composes readiness + merchant + revenue + security) |
| **Business graph tabs** (Phase 11) | surface business/journey/customer/merchant/revenue/operational/support layers in a Business Flow view |

## Missing Operational Intelligence surfaces (UI modes — backends exist)
| Mode | Backend (already present) | V11 UI |
|------|---------------------------|--------|
| **Founder / Executive** (Phase 4) | `/api/executive-center` | new page |
| **Operations** (Phase 5) | `/api/observability` + `/api/operations` | new page |
| **Support** (Phase 6) | `/api/investigate` | new page (NL: where is order / why payment failed / why refund pending) |
| **Developer 30-min** (Phase 16) | `/api/explain` `gettingStarted` | new page |
| **Autonomous Investigation** (Phase 17) | `/api/investigate` + `/api/root-cause` | surfaced in Support |
| **AI Copilot V2** (Phase 10) | `/api/search-v2` + `/api/ops-copilot` + cmdk | route business/journey NL → workspace |

## Conclusion
Most V11 **backends already exist** (LCIS X built the operational engines; explain/journey/revenue/memory exist). V11's net-new code is: **one engine** (`business-flow-intel.mjs`), **three composition endpoints** (`/api/business-flow`, `/api/business-impact`, `/api/investor`), and a **Business Intelligence UI layer** (Founder / Operations / Support / Investor / Developer modes + Journey Workspaces + business graph tabs + Copilot V2 routing) — all reusing existing engines, mobile-first, with live values CONNECTED or NOT CONNECTED only.

**Note:** the schema has **no `subscriptions` domain** — the Subscription Journey is surfaced honestly as **NOT IMPLEMENTED** (reserved), never fabricated.
