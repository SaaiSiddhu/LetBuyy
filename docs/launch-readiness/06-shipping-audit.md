# Shipping Audit

**Date:** 2026-06-19  
**LCIS Domain:** `shipping` (3 routes, 1 RPC, 10 tables, 20 policies)  
**Evidence:** `services/api-gateway/src/routes/shipping.ts` (175 lines), `services/api-gateway/src/routes/shipping-labels.ts`, `CAPABILITY_BACKLOG.md` CAP-C16

---

## Completion Score: **68%**

*Dragged down by CAP-C16 (no live carrier integration) and LB-7 uncommitted state.*

---

## Sub-System Audit

### Shiprocket / Carrier Integration
**Score: 35%** ← **CRITICAL GAP (CAP-C16)**

**What exists:**
- `packages/infrastructure/logistics-adapter/index.ts:121` — logistics adapter scaffolded
- `services/api-gateway/src/routes/shipping-labels.ts` — label creation route
- Sandbox mode: local label generation works in sandbox
- Database tables: `shipping_labels`, `shipments`, `shipment_events`
- AWB (Air Waybill) tracking structure in `shipments` table

**What is broken/missing:**
- **Live mode fails closed** — the logistics adapter now fails closed with an explicit error rather than reusing scaffold labels as live carrier output (per `provider-mode-badge-validator`)
- No live Shiprocket, Delhivery, or Pickrr API client implemented
- No live credentials (`CAP-C16`/`SKIP-CAP-LOGISTICS-LIVE-PROVIDER` required)
- Live AWB generation: not available
- Real carrier rate lookup: not available

**What this means for V1:** Merchants cannot generate real shipping labels from LetBuyy for V1 unless CAP-C16 is implemented. Manual fulfillment (mark as fulfilled with external tracking number) is the fallback.

**Evidence:** `CAPABILITY_BACKLOG.md` CAP-C16 — "Live logistics provider clients for Shiprocket/Delhivery/Pickrr label creation, rate lookup, AWB, and tracking. Sandbox logistics can generate local labels, but live mode now fails closed."

---

### Tracking
**Score: 60%**

**What exists:**
- `shipments` + `shipment_events` tables — tracking event storage
- `shipment_events` stores carrier status updates
- Fulfillment order management: `fulfillment_orders` + `fulfillment_order_lines`
- Order tracking visible to customer on account orders page
- Webhook webhook-service can receive carrier tracking webhooks

**What is missing:**
- Live carrier webhook registration (requires CAP-C16 credentials)
- Proactive tracking push notifications to customers
- Tracking page on storefront (exists as `shipping/page.tsx` but content unverified)

**Evidence:** shipping domain LCIS tables, `shipment_events` table

---

### Shipping Zones
**Score: 83%**

**What exists:**
- `shipping_zones` table with full schema
- `shipping_serviceability_rules` table for pin-code based rules
- `shipping_profiles` table for per-product shipping profiles
- Zone management in merchant settings: `apps/merchant-control-plane/src/app/[store]/settings/shipping/page.tsx`
- Zone → Rate assignment

**Evidence:** shipping domain LCIS (10 tables), `settings/shipping/page.tsx`

---

### Shipping Rates
**Score: 75%** ← **LB-7 uncommitted**

**What exists:**
- `shipping_rates` table with weight/price/free-threshold rules
- Shipping rate resolver: `services/api-gateway/src/lib/shipping-rate-resolver.ts` (LB-7)
- Rate API: `apps/storefront-runtime/src/app/api/shipping/rates/route.ts`
- Migration 170 (`170_v1_shipping_rates_gst.sql`) — validates 28/28 but UNCOMMITTED
- Free shipping threshold support
- Multiple rate tiers per zone

**What is blocked:**
- LB-7 cannot be committed due to `git index.lock` in current sandbox
- Until committed, migration 170 is untracked and the sequential-migration validator fails

**Evidence:** `LB7_CERTIFICATION.md` — "lb7 28/28 passed; gate green except untracked-170 (commit seam blocks)"

---

### Fulfillment
**Score: 78%**

**What exists:**
- `create_order_fulfillment` RPC (canonical SECURITY DEFINER)
- `fulfillment_orders` + `fulfillment_order_lines` tables
- Fulfillment status tracking
- Manual fulfillment (mark fulfilled with tracking number) — the V1 primary path
- LB-4 payout release (committed): fulfillment triggers payout eligibility

**What is missing:**
- Automated fulfillment trigger (auto-fulfill on payment)
- Partial fulfillment (ship some items, hold others)
- Return/exchange management (returns route exists but process unverified)

**Evidence:** LCIS shipping domain (1 RPC: `create_order_fulfillment`), `ACTUAL_STATE.md` LB-4

---

## Blockers

| # | Blocker | Severity | Impact |
|---|---|---|---|
| LB-7 | Shipping rates uncommitted | 🟡 High | No computed shipping cost at checkout until committed |
| CAP-C16 | No live carrier integration | 🟠 High | Merchants cannot generate real labels from LetBuyy |
| H2 | Production secrets | Human seam | No production writes |

---

## Launch Readiness

**Shipping is 68% ready.** The data model is complete and fulfillment works manually. The critical gap is CAP-C16 — there is no live carrier integration (Shiprocket/Delhivery/Pickrr). V1 merchants will need to:

1. Manage shipping externally (their own Shiprocket account)
2. Enter tracking numbers manually into LetBuyy
3. Mark orders fulfilled manually

This is acceptable for a V1 pilot with a small merchant cohort.

**LB-7 must be committed** before launch to enable computed shipping costs.

**Recommended V1.0.0 scope:** Manual fulfillment + tracking number entry + zone-based rates (after LB-7 commit).

**Delay to V1.1:** Shiprocket integration (CAP-C16), automated label generation, proactive tracking notifications.

**Delay to V2:** Multi-carrier comparison, returns portal, dimensional weight pricing.
