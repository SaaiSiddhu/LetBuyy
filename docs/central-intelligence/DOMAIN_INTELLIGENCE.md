# LCIS — Domain Intelligence (Phase 8)

Per-domain knowledge maps. Node counts from `/api/domain`; data-layer counts from `db-intel`. Each domain has a live UI tab + a graph audit command (`/graph-*` / `*-audit`).

| Domain | Graph nodes | DB surface | Key anchors | Map |
|--------|------:|-----------|-------------|-----|
| **Payments** | 6,393 | 34 money RPCs, money tables | `create_checkout_order`, `complete_order_refund`, Razorpay HMAC | `docs/graph/payment-intelligence.md` |
| **Orders** | (in payments) | orders/order_items + status RPCs | `orders.ts` PATCH state machine | `FLOW_GRAPH_REPORT.md` |
| **Shipping** | — | shipping_rates (LB-7) | server-resolved rate, pincode serviceability | `.claude/commands/shipping-audit.md` |
| **GST** | — | immutable GST invoices | server-side tax, GSTIN | `.claude/commands/gst-audit.md` |
| **Marketplace** | 1,349 | partner_payout ring-fenced | frozen apps; `proxy.ts` live | `docs/architecture/marketplace-map.md` |
| **Themes** | 5,163 | themes.default_template | Liquid+JSON renderer, sanitizer locked | `docs/architecture/theme-engine-map.md` |
| **Identity** | 5,586 | sessions/credentials | HS256 customer / ES256 merchant | `docs/graph/identity-intelligence.md` |
| **Auth / OAuth** | (in identity) | — | single-issuer invariant, step-up | `docs/architecture/auth-map.md` |
| **Tenancy** | 1,802 | 255 tenant tables, 394 RLS | `site_id`, `verifySiteOwnership` | `docs/graph/tenant-intelligence.md` |
| **Security** | 3,805 | 651 policies | RLS, HMAC, canonical-ledger | `docs/graph/security-intelligence.md` |
| **Developer Platform** | 755 | — | frozen; ARB to activate | `docs/architecture/developer-platform-map.md` |
| **Data layer** | 1,656 | **414 tables / 156 RPCs / 651 policies** | the schema Graphify misses | `DATABASE_INTELLIGENCE_REPORT.generated.md` |

## How to use
- UI: `pnpm graph:ui` → pick the domain tab → "★ View as graph" for the cluster, or **◆ Data Layer** for the schema.
- CLI: `pnpm graph:intel payment` / `tenant` / `flow "<route>"`.
- Claude: `/graph-payments`, `/graph-auth`, `/graph-tenancy`, `/graph-security`, `/graph-dependencies`.

Each domain is **graph-discoverable, schema-mapped, and audit-runnable** — the goal of the central intelligence layer.
