# Discount and Gift Card Engine Analysis

## Executive Summary

LetBuyy currently has coupon CRUD and validation, plus gift card issuance/listing. It does not yet have a discount engine or a gift card engine.

That distinction matters. A coupon table can answer "is code X active?" A discount engine answers "which pricing effects apply to this cart, for this customer, in this store, with these products, at this time, under these stacking, usage, fraud, and channel rules?" A gift card engine answers "what is the authoritative stored-value liability balance and which immutable redemptions changed it?"

The current coupon implementation is useful for MVP promotions, but it is not safe enough for production checkout because it:

- computes against submitted order totals;
- does not atomically reserve or increment usage;
- does not participate in `create_order_with_inventory_reservations`;
- does not enforce product/category eligibility;
- does not support stacking rules;
- does not create a redemption ledger;
- does not interact with gift cards, refunds, or abuse controls.

Gift cards are even earlier. `gift_cards` can be created/listed, but there is no storefront redemption, no balance ledger, no partial redemption, no order allocation, no liability accounting, and no refund-to-gift-card flow.

## Current Implementation Map

### Coupon Backend

- Schema: `backend/workers/api/src/schemas/coupon.schema.ts`
- Route: `backend/workers/api/src/routes/coupons.ts`
- Storefront public validation: `backend/workers/api/src/routes/storefront.ts`
- Admin proxy: `apps/web/consumer/admin/src/app/api/stores/[store]/coupons/route.ts`
- Admin page: `apps/web/consumer/admin/src/app/[store]/coupons/page.tsx`
- Initial table: `backend/supabase/migrations/001_initial_schema.sql`

### Gift Card Backend

- Table: `gift_cards` in `backend/supabase/migrations/010_products_section.sql`
- Runtime alignment: `backend/supabase/migrations/042_collections_gift_cards_runtime_alignment.sql`
- Route handlers: `backend/workers/api/src/routes/products.ts` under `/gift-cards`
- Admin proxy: `apps/web/consumer/admin/src/app/api/stores/[store]/gift-cards/route.ts`
- Admin page: `apps/web/consumer/admin/src/app/[store]/products/gift-cards/page.tsx`

### Storefront

- Cart demo coupon logic: `apps/web/consumer/storefront/src/app/store/[subdomain]/cart/page.tsx`
- Coupon validation proxy: `apps/web/consumer/storefront/src/app/api/coupons/validate/route.ts`
- Checkout client: `apps/web/consumer/storefront/src/app/store/[subdomain]/checkout/checkout-client.tsx`

## Current Coupon Data Model

The coupon schema supports:

- `code`
- `type`: percentage/fixed/free shipping
- discount value
- minimum order amount
- usage limit
- date start/end
- active flag
- applicable products/categories in schema

The actual validation flow primarily enforces active/date/usage/minimum order/type and calculates discount from submitted `order_total`.

## Current Gift Card Data Model

The gift card table supports issuance-style records. Observed capabilities include:

- code/value/balance style data,
- expiry/status style alignment,
- admin issue/list UI.

The missing piece is not the card record. The missing piece is the ledger.

## Promotion Engine Gap

### Current Model

```text
coupon row
  -> validate code
  -> return discount amount
```

### Required Model

```text
promotion
  -> campaign
  -> rules
  -> conditions
  -> effects
  -> stacking policy
  -> redemption ledger
  -> abuse controls
  -> checkout allocation
```

### Shopify/Medusa/Commerce Layer Direction

Shopify discount Functions calculate discount effects during cart/checkout and can target cart lines, order subtotal, and shipping rates. Medusa promotions have rule-based promotion types including standard and buy-get flows. Commerce Layer exposes rules-engine direction for complex promotion logic. LetBuyy should evolve from coupons to a rule/effect engine rather than adding many ad hoc columns to `coupons`.

## Missing Rules Engine

### Required Rule Types

```text
Customer rules:
  first_order
  customer_segment
  customer_email_domain
  customer_tags
  lifetime_spend

Cart rules:
  subtotal_min
  subtotal_max
  item_count_min
  currency
  channel

Product rules:
  product_in
  product_not_in
  collection_in
  category_in
  vendor_in
  variant_sku_in

Shipping rules:
  country
  postal_code
  shipping_method
  delivery_zone

Time rules:
  starts_at
  ends_at
  schedule_window
  blackout_dates

Usage rules:
  total_usage_limit
  per_customer_limit
  per_order_limit
  once_per_email
```

### Required Effect Types

```text
percentage_off_line
fixed_amount_off_line
percentage_off_order
fixed_amount_off_order
free_shipping
buy_x_get_y
bundle_discount
volume_tier
gift_card_credit
```

## Missing Stacking Engine

Current coupons do not define how multiple promotions interact. A production engine needs deterministic stacking.

### Required Stacking Policy

```text
exclusive:
  no other promotion may apply

combinable:
  can combine with specific classes

priority:
  lower number applies first

best_price:
  engine evaluates valid alternatives and applies best customer outcome

merchant_priority:
  merchant-defined priority wins
```

### Required Discount Classes

```text
line_item_discount
order_discount
shipping_discount
gift_card_payment
manual_adjustment
```

Gift cards must not be treated as discounts. They are stored value/payment instruments and must be applied after discounts/taxes/shipping according to legal/accounting policy.

## Missing Eligibility Engine

The schema includes `applicable_products` and `applicable_categories`, but current validation does not reliably enforce them against canonical cart lines. A real eligibility engine must evaluate against server-loaded product/variant/collection data.

### Required Inputs

```text
site_id
cart_id/order_id
customer_id/email
line_items:
  product_id
  variant_id
  collection_ids
  category_ids
  unit_price
  quantity
shipping_address
shipping_method
payment_method
channel
```

### Required Outputs

```text
valid_promotions[]
invalid_codes[] with reason
line_adjustments[]
order_adjustments[]
shipping_adjustments[]
promotion_messages[]
```

## Missing Redemption Ledger

### Current Problem

Usage limit checks are read-time validations. Without a ledger and row locks, two concurrent checkouts can both pass validation.

### Required Tables

```text
promotion_redemptions
  id
  site_id
  promotion_id
  coupon_code_id
  order_id
  customer_id
  customer_email
  status
  amount
  currency
  idempotency_key
  reserved_at
  committed_at
  released_at

promotion_usage_counters
  promotion_id
  total_reserved
  total_committed
  version
```

### Redemption State Machine

```text
reserved -> committed
reserved -> released
reserved -> expired
committed -> reversed
```

The checkout transaction should reserve/commit the redemption together with order placement. If payment fails and the order is cancelled, redemption release must be idempotent.

## Coupon Lifecycle Analysis

### Current Lifecycle

```text
create coupon -> validate coupon -> optionally deactivate/delete
```

### Required Lifecycle

```text
draft -> scheduled -> active -> paused -> expired
   \         \          \         \
    -> archived          -> exhausted -> archived
```

### Required Admin Controls

- Preview eligible products/customers.
- Estimate usage/budget.
- Pause immediately.
- Duplicate campaign.
- Schedule start/end.
- Exclude sale items.
- Limit to channels.
- View redemption ledger.
- Export usage.

## Gift Card Engine Gap

### Current Model

```text
gift_cards row
  -> issue/list
```

### Required Model

```text
gift_card_accounts
  one per card code/account

gift_card_ledger_entries
  immutable balance movements

gift_card_redemptions
  order-level allocation records

gift_card_events
  audit/event stream
```

## Gift Card Lifecycle

```text
created
  -> issued
  -> active
  -> partially_redeemed
  -> redeemed

active/partially_redeemed -> expired
active/partially_redeemed -> disabled
active/partially_redeemed -> voided
redeemed -> archived
```

## Gift Card Ledger

### Required Ledger Entry Types

```text
issue
activate
redeem
redeem_reversal
refund_to_card
manual_adjustment
expire
void
fraud_hold
fraud_release
```

### Required Atomicity

Gift card redemption must lock the account row:

```text
SELECT * FROM gift_card_accounts
WHERE site_id = $site_id AND code_hash = $code_hash
FOR UPDATE;
```

Then it must verify:

- active status,
- not expired,
- sufficient balance,
- currency/site compatibility,
- order/customer eligibility,
- idempotency key not already redeemed.

Then it writes ledger entry and updates balance in the same transaction as order payment allocation.

## Abuse and Fraud Prevention

### Coupon Abuse Risks

- Repeated validation attempts to discover valid codes.
- Multiple accounts using first-order coupons.
- Race on usage limit.
- Customer changing email casing or plus aliases.
- Bot checkout with high-value discounts.
- Leaked private campaign code.

### Gift Card Abuse Risks

- Code brute force.
- Double redemption due to retries.
- Stolen gift card balance checks.
- Cross-store redemption if site scoping is weak.
- Refund laundering into gift cards.

### Required Controls

- Store gift card codes hashed, display only once on issue.
- Rate-limit coupon/gift-card validation by IP, site, and customer.
- Do not reveal whether a gift card code exists unless customer context is valid.
- Use redemption idempotency keys.
- Add fraud review states.
- Add audit trail for admin adjustments.
- Add anomaly monitoring for code attempts and high-value redemptions.

## Checkout Pricing Order

Recommended server-side order:

```text
1. Load canonical cart lines from products/variants.
2. Calculate base subtotal.
3. Evaluate line-level promotions.
4. Evaluate order-level promotions.
5. Calculate shipping options.
6. Evaluate shipping promotions.
7. Calculate tax on the legally correct base.
8. Apply gift cards/stored value as payment allocation.
9. Create payment intent for remaining payable amount.
10. Commit order with line adjustments, tax lines, shipping lines, gift-card allocations, and inventory reservations.
```

Current LetBuyy order commit skips steps 3-8.

## Required Data Model

```text
promotions
promotion_codes
promotion_rules
promotion_effects
promotion_redemptions
promotion_usage_counters
order_adjustments
order_line_adjustments
shipping_adjustments

gift_card_accounts
gift_card_ledger_entries
gift_card_redemptions
gift_card_holds
```

All tables must include:

- `site_id`
- `created_at`
- `updated_at`
- `deleted_at`
- audit columns where applicable
- indexes for site/code/status/date
- RLS policies
- immutable ledger constraints where applicable

## Database Integrity Requirements

### Promotion Constraints

- Unique `promotion_codes(site_id, normalized_code)` where active/not deleted.
- Check percent values between 0 and 100.
- Check fixed values non-negative.
- Check start before end.
- Foreign keys for promotion/effect/rule/redemption.
- Idempotency unique key for redemption.

### Gift Card Constraints

- Unique `gift_card_accounts(site_id, code_hash)`.
- Balance cannot be negative.
- Ledger amount cannot be zero.
- Ledger entries immutable after insert.
- Redemption unique by `(site_id, order_id, gift_card_account_id, idempotency_key)`.

## Event Model

Required events:

```text
promotion.created
promotion.activated
promotion.paused
promotion.redeemed
promotion.redemption_released
promotion.exhausted

gift_card.issued
gift_card.activated
gift_card.redeemed
gift_card.redemption_reversed
gift_card.expired
gift_card.disabled
gift_card.balance_adjusted
```

These should write to `outbox_events` and be dispatched through the future event bus.

## Admin UX Requirements

### Discounts

- Discounts list with status, type, usage, revenue impact, starts/ends.
- Create promotion wizard.
- Eligibility builder.
- Stacking controls.
- Preview calculator.
- Redemption ledger.
- Abuse indicators.
- Bulk pause/archive.

### Gift Cards

- Issue card.
- Search card by masked code/customer/order.
- View balance ledger.
- Disable/enable.
- Manual adjustment with reason.
- Expiry management.
- Liability report.
- Redemption history.

## Implementation Recommendations

### Phase 1: Stop Incorrect Discounts

- Remove cart demo codes from storefront checkout path.
- Require server-side coupon validation from canonical cart.
- Do not show coupon as applied unless worker returns canonical adjustment.
- Add idempotency key to checkout.

### Phase 2: Add Promotion Ledger

- Add `promotion_redemptions`.
- Commit coupon usage inside order placement RPC/workflow.
- Add per-customer usage.
- Enforce product/category eligibility.

### Phase 3: Add Rules/Effects

- Add normalized promotions/rules/effects.
- Support line/order/shipping discounts.
- Add stacking policy.

### Phase 4: Add Gift Card Ledger

- Hash card codes.
- Add ledger entries.
- Integrate redemption after discounts and before payment.
- Add refund-to-card.

### Phase 5: Add Abuse/Fraud Systems

- Add rate limits.
- Add anomaly events.
- Add admin audit and fraud hold states.

## Critical Flaws

| Severity | Flaw | Evidence | Impact |
|---|---|---|---|
| Critical | Coupon discount not part of order RPC | `create_order_with_inventory_reservations` discount zero | Customer sees/gets inconsistent totals |
| Critical | No redemption ledger | `coupons.ts` validates only | Usage limits race |
| Critical | Gift card no ledger | gift card issue/list only | Double-spend if redemption is added naively |
| High | Product/category applicability not enforced | schema fields not applied in validation | Promotions apply too broadly |
| High | Client demo coupon logic | storefront cart page | Mismatch with server truth |
| High | No stacking rules | no policy model | Unbounded discount combinations |
| Medium | Coupon PATCH lacks full Zod discipline | route has raw patch behavior | Invalid promotion state risk |

## Production Readiness Score

| Area | Score |
|---|---:|
| Coupon CRUD | 5/10 |
| Coupon validation | 3/10 |
| Promotion rules | 1/10 |
| Redemption ledger | 0/10 |
| Stacking engine | 0/10 |
| Gift card issuance | 3/10 |
| Gift card redemption | 0/10 |
| Fraud controls | 1/10 |
| Overall discount/gift-card engine | 1.6/10 |

## Scalability Score

| Dimension | Score |
|---|---:|
| Coupon list scale | 4/10 |
| Checkout consistency | 2/10 |
| Concurrent redemption | 1/10 |
| Campaign analytics | 1/10 |
| Gift card liability | 0/10 |

## SaaS Maturity Score

Discount/gift card SaaS maturity: **1.5/10**.

The current system is acceptable as an admin-visible promotion MVP. It must not be treated as a production pricing engine until promotion evaluation and gift card redemption are moved into the same canonical checkout transaction as order placement.
