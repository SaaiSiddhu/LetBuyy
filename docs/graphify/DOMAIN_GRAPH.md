# Phase 2 — LetBuyy Domain Graph

**Business-domain view over the code subgraph. Node/degree counts from `graph.json` (code nodes only); ownership from the runtime map.**

| Domain | Graph footprint (code nodes / total degree) | Primary owner (source_file root) |
|---|---|---|
| Identity | session 360 / 1,100 | `apps/identity-platform`, `packages/auth-core` (254), `packages/identity-core` (55), `packages/session-core` (54) |
| Merchant | merchant-control-plane 1,293 | `apps/merchant-control-plane`, `services/api-gateway` |
| Store/Site | tenancy 342 / 1,140 | `services/api-gateway`, `packages/tenant-core` (123) |
| Catalog | (products subset of gateway 3,623) | `services/api-gateway/src/routes`, `packages/commerce-core` (179) |
| Inventory | reservation RPCs (SQL, ungraphed) + gateway | `services/api-gateway`, `database/` |
| Collection | gateway routes | `services/api-gateway` |
| Theme | theme-engine 464 + storefront 114 | `packages/theme-engine`, `apps/storefront-runtime/src/lib/theme-engine` |
| Checkout | checkout-core 259 (+227 deg on index.ts) | `packages/checkout-core`, `services/api-gateway` |
| Orders | gateway routes | `services/api-gateway` |
| Payments | **864 / 2,307** | `services/api-gateway/src/routes/payments.ts`, `packages/payments` (101), `packages/infrastructure` adapters |
| Refunds | within payments subgraph | `services/api-gateway/src/routes/payments.ts` |
| Payouts | within payments subgraph | `services/api-gateway/src/routes/payouts.ts` |
| Shipping | 305 / 758 | `services/api-gateway`, `packages/checkout-core` |
| GST/Tax | 203 / 430 | `packages/checkout-core`, `services/api-gateway/src/routes/tax.ts` |
| Gift Cards | 99 / 256 | `services/api-gateway/src/routes/gift-cards.ts` |
| Coupons | gateway routes | `services/api-gateway` |
| Notifications | notification-core 94 | `packages/notification-core`, `services/queue-workers` |
| Analytics | gateway + queue-workers | `services/api-gateway`, `services/queue-workers` |
| Marketplace | app-marketplace 679 (frozen) | `apps/app-marketplace`, `apps/theme-marketplace` (576) |
| Developer Platform | developer-portal 277 (frozen) | `apps/developer-portal` |
| Internal Operations | platform-console 443 + ops-portal 348 | `apps/platform-console`, `services/api-gateway/src/routes/operations` |

## Reading the domain graph
- **Payments is the densest business domain** (864 code nodes, total degree 2,307) — consistent with it being the most safety-critical area.
- **Tenancy and Session are the next-densest** (1,140 / 1,100 degree) — the cross-cutting concerns touch the most code, as expected for a multi-tenant platform with two issuers.
- **The money/tax/shipping/gift-card domains live in `services/api-gateway` + `packages/*-core`**, never in the apps — confirming the api-gateway write-truth ownership boundary.
- **Marketplace/Developer-Platform footprints are real but frozen** (679 + 576 + 277 nodes) — indexed code that is not a deploy target.
- **Inventory's truth is in SQL** (reservation RPCs) which the graph does not capture — a domain that is under-represented in the graph for the SQL reason.
