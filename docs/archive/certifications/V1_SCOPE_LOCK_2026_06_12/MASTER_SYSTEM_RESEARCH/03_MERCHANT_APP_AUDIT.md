# 03 — MERCHANT APP AUDIT (apps/merchant-control-plane)

**HEAD `cd5905be` · code-verified.** Web admin = the V1 merchant surface. (The Flutter mobile merchant app is V2 — login blocked on prod, push absent, signing unprovisioned.)

| Capability | Status | Evidence |
|---|---|---|
| Dashboard + setup checklist | **implemented** | `DashboardClient` driven by real setupStatus |
| Products CRUD + media (R2) | **implemented** | products routes + R2 upload |
| Variants | **implemented** | matrix builder → real `variants[]` (LB-5) |
| Collections (create + assign + render) | **implemented** | assignment API/UI + storefront route (LB-6) |
| Inventory (levels/adjust/reservations) | **implemented** | RPCs with row locks; reservation inside checkout RPC |
| Customers | **implemented** | list/detail, notes/tags |
| Orders (list/detail/lifecycle/fulfill) | **implemented** | VALID_TRANSITIONS state machine; manual fulfillment with tracking |
| Refunds | **implemented** | provider refund + step-up TOTP UI (LB-3) |
| Payouts | **implemented** | statements + step-up release (LB-4); live needs Razorpay Route (seam) |
| Shipping zones/rates | **implemented** | honored at checkout (LB-7) |
| GST / taxes | **implemented** | CGST/SGST/IGST engine invoked at order creation |
| Discounts/coupons | **implemented** | %/fixed/free-shipping, server-authoritative; `bogo` blocked (422) |
| Gift cards | **broken — hide** | issuance writes `gift_cards`; checkout reads `gift_card_accounts` → unredeemable; nav still present (LB-11 open) |
| Appearance | **partial** | page saves `site_settings`; storefront bridge just started (LB-9) — verify end-to-end |
| Announcement bar (editor) | **partial** | schema exists; storefront renderer missing (LB-8) |
| Analytics | **partial** | summary real; `revenueByMonth` hardcoded |
| Settings (domains/notifications/security/plan) | **implemented** | domains gateway-backed; security TOTP; free plan |
| Staff/team (merchant-side) | **owner-only (V1.1)** | invites enqueue but no acceptance page; route gates are owner-only |
| Theme editor + nav menus | **implemented** | publish → release → live React storefront |

**Verdict:** the merchant admin is the strongest, most complete surface (~28 real pages, the full product→order→fulfill→refund→payout loop). Remaining V1 gaps: hide gift cards (LB-11), finish appearance bridge (LB-9) + announcement bar (LB-8). Merchant staff/teams is owner-only by design for V1.
