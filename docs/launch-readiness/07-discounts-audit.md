# Discounts Audit

**Date:** 2026-06-19  
**LCIS Domain:** `discounts` (2 routes, 2 RPCs, 11 tables, 20 policies)  
**Evidence:** `services/api-gateway/src/routes/coupons.ts` (304 lines), `services/api-gateway/src/routes/marketing.ts`, merchant admin `/coupons/page.tsx`

---

## Completion Score: **83%**

---

## Sub-System Audit

### Coupons
**Score: 90%**

**What exists:**
- `coupons` table with full schema (code, type, value, usage limits, expiry)
- `promotion_codes` table for multi-code promotions
- `promotion_usage_counters` for atomic usage tracking
- `promotion_redemptions` for per-customer tracking
- Coupon CRUD in merchant admin: `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx`
- Coupon CRUD API: `GET/POST /v1/coupons`, `GET/PUT/DELETE /v1/coupons/:id` (`coupons.ts:304 lines`)
- Coupon validation at checkout: `apps/storefront-runtime/src/app/api/coupons/validate/route.ts`
- Coupon applied in `create_checkout_order` RPC (server-authoritative)
- Percentage and fixed-amount discount types
- Minimum order value requirement
- Maximum usage limit (global + per-customer)
- Expiry date enforcement

**What is missing:**
- Bulk coupon generation (e.g., generate 1,000 unique codes)
- Usage analytics dashboard (see how many times each coupon was used)

**Evidence:** `coupons.ts:304 lines`, discounts domain LCIS (11 tables), `coupons/page.tsx`

---

### Discount Rules
**Score: 82%**

**What exists:**
- `promotions` table with rule engine
- `promotion_rules` table for condition-based rules
- `promotion_effects` table for effects (discount, free item, etc.)
- `evaluate_checkout_promotion` RPC — server-authoritative promotion evaluation
- `discount_allocations` table for per-line-item allocation
- Rule types: order value, product-based, collection-based, customer-based
- `deployment_promotion_runs` + `record_deployment_promotion_run` RPC for scheduled promotions

**What is missing:**
- BOGO (Buy One Get One) rule type — not confirmed
- Tiered discount rules (spend $X get Y%, spend $2X get 2Y%)

**Evidence:** LCIS discounts domain — `promotion_rules`, `promotion_effects`, `promotions` tables; `evaluate_checkout_promotion` RPC

---

### Free Shipping
**Score: 75%**

**What exists:**
- Free shipping threshold in `shipping_rates` table
- Can configure free shipping over $X in shipping settings
- Applied server-side in checkout via shipping rate resolver (LB-7)

**What is missing:**
- Coupon-triggered free shipping (separate from threshold-based)
- Free shipping promotion rule type (e.g., "use code FREESHIP")

**Evidence:** `shipping_rates` table with threshold field, LB-7 shipping rate resolver

---

### Promotions / Marketing Campaigns
**Score: 72%**

**What exists:**
- `marketing_email_campaigns` + `marketing_email_recipients` tables in discounts domain
- `marketing.ts` route: `services/api-gateway/src/routes/marketing.ts`
- Scheduled promotions via `deployment_promotion_runs`
- Event-based promotion triggers via EVENT_QUEUE

**What is missing:**
- Marketing campaign UI in merchant admin (campaign creation/send)
- Email campaign delivery (tied to CAP-C18 / LB-10 / H6 Resend)
- Flash sale / timed discount UI

**Evidence:** LCIS discounts domain — `marketing_email_campaigns`, `marketing_email_recipients` tables; `marketing.ts`

---

## Blockers

| # | Blocker | Severity | Impact |
|---|---|---|---|
| LB-7 | Free shipping threshold depends on rate resolver | 🟡 Medium | Free shipping threshold not applied until LB-7 committed |
| H6 | Resend live email | Human seam | Marketing campaigns fail closed without email provider |

---

## Launch Readiness

**Discounts is 83% ready and launch-capable.** The coupon engine is complete: creation, validation, application at checkout, usage tracking. The promotion rule engine is implemented. Free shipping via threshold works after LB-7.

Primary gap for V1: marketing campaign sending (tied to email provider, H6).

**Recommended V1.0.0 scope:** Coupons (percentage + fixed), minimum order value, usage limits, free shipping threshold (after LB-7).

**Delay to V1.1:** Bulk coupon generation, marketing campaigns, BOGO rules, tiered discounts.

**Delay to V2:** Loyalty points, referral programs, flash sales, affiliate codes.
