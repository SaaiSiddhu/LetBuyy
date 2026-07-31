# 03 — MCP API Route Registry

**Source:** `apps/merchant-control-plane/src/app/api/**/route.ts`. **Total registered proxy routes: 95.** All are same-origin Next route handlers that delegate to `services/api-gateway` via the merchant api-client (browser never hits the gateway directly — CORS/CSP rule).

## New / changed Phase-4.x proxies (all verified present + type-clean)
| Proxy | Verbs | Gateway delegation | Phase |
|---|---|---|---|
| `stores/[store]/collections/[collectionId]` | PATCH, DELETE | `products.collections.update/remove` | 4 |
| `stores/[store]/customers/[email]` | GET | `customers.getByEmail` | 4.5 |
| `stores/[store]/customers/[email]/notes` | GET, POST | `customers.notes.list/create` | 4.5 |
| `stores/[store]/customers/segments` | GET, POST | `customers.segments.list/create` | 4.75 |
| `stores/[store]/customers/segments/[id]` | PATCH | `customers.segments.update` | 4.75 |
| `stores/[store]/customers/segments/preview` | POST | `customers.segments.preview` | 4.75 |
| `stores/[store]/orders/[orderId]` | GET, PATCH | `orders.get` / `orders.update` | 4.75 |
| `stores/[store]/marketing/campaigns` | GET, POST | `marketing.emailCampaigns.list/create` | 4.75 |
| `stores/[store]/marketing/campaigns/[id]` | GET | `marketing.emailCampaigns.get` | 4.75 |
| `stores/[store]/marketing/campaigns/[id]/send` | POST | `marketing.emailCampaigns.send` | 4.75 |
| `stores/[store]/marketing/campaigns/audience-preview` | POST | `marketing.emailCampaigns.previewAudience` | 4.75 |
| `stores/[store]/shipping/rates/[rateId]` | PATCH (+DELETE) | `shipping.rates.update/remove` | 4.5 |
| `stores/[store]/analytics` | GET | `analytics.dashboard/orders/revenue` (real `revenueByMonth`) | 4.5 |

All are **ownership-checked** via `resolveOwnedStoreId`. No proxy references a non-existent gateway endpoint (verified by the `tsc` EXIT 0 against the api-client + the launch contract tests). No fabricated APIs.

## Gateway write routes with staff-RBAC enforcement (server side)
products (4) · orders (4: status/fulfill/refund/refund-complete) · coupons (3) · customers (2: create/update) · shipping rates (3) = **16 handlers** guarded by `assertStaffPermission` (dry-run default — see `04`).

**Locked:** the API proxy registry is complete; every Phase-4.x proxy maps to a real gateway endpoint.
