# Phase 3 — Cross-App Dependencies

**Real dependency edges from `graph.json` (relations: imports/imports_from/calls/references/re_exports/inherits/implements/exports — `contains` excluded). Counts are cross-runtime edge totals.**

## Top cross-runtime dependency edges
| Edges | Source runtime | → | Target runtime |
|---:|---|---|---|
| 726 | apps/merchant-control-plane | → | packages/typescript (ui + api-client) |
| 553 | packages/typescript | → | packages/shared-types |
| 359 | services/api-gateway | → | packages/shared-types |
| 175 | services/api-gateway | → | packages/checkout-core |
| 148 | apps/theme-marketplace | → | packages/typescript |
| 122 | services/api-gateway | → | packages/commerce-core |
| 113 | apps/mobile | → | packages/dart |
| 107 | apps/app-marketplace | → | packages/shared-types |
| 103 | apps/platform-console | → | packages/typescript |
| 102 | apps/storefront-runtime | → | packages/theme-engine |
| 98 | services/api-gateway | → | packages/event-core |
| 77 | services/api-gateway | → | packages/theme-engine |
| 76 | services/api-gateway | → | packages/billing-core |
| 75 | services/api-gateway | → | packages/tenant-core |
| 74 | services/api-gateway | → | packages/cms-core |
| 63 | packages/infrastructure | → | packages/payments |
| 31 | services/queue-workers | → | packages/event-core |
| 29 | services/queue-workers | → | packages/infrastructure |
| 29 | services/api-gateway | → | packages/auth-core |
| 24 | services/api-gateway | → | packages/identity-core |

## The architecturally decisive finding
**There are no app→app edges, and no app→`services/api-gateway`-source edges.** Apps (merchant, storefront, identity, console) depend on **`packages/typescript/api-client`** and **`packages/shared-types`**, never on each other or on the gateway's source. This is hard graph evidence that the **HTTP boundary is real**: apps are thin views that call the gateway over the network via the generated client, exactly as the runtime map claims. The program's "Merchant App → API Gateway / Storefront → API Gateway / …" relationships exist **at runtime over HTTP**, not as code imports — the graph correctly shows zero source coupling.

## The hub
`services/api-gateway` is the dependency hub of the *package* layer: it imports shared-types (359), checkout-core (175), commerce-core (122), event-core (98), theme-engine (77), billing-core (76), tenant-core (75), cms-core (74), auth-core (29), identity-core (24), infrastructure (25), payments (indirect via infrastructure 63). It is the single runtime that composes every `*-core` capability — the modular-monolith center.

## Queue / async coupling
`services/queue-workers → packages/event-core (31)` and `→ packages/infrastructure (29)` + `→ shared-types (29)`: the async tier shares the event contracts and adapters with the gateway (the 5-queue envelope), but does not import gateway source — decoupled via the queue.

## Verdict
Dependency topology = **clean layered modular monolith**: apps → (`api-client` + `shared-types`) → [HTTP] → api-gateway → (`*-core` packages) → [SQL] → Postgres. No circular app coupling, no app reaching into the gateway internals. The boundaries the Constitution asserts are observable in the graph.
