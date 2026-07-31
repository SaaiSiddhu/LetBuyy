# Checkout Extensibility Analysis

> Evidence-based. No code was modified. All findings cite file:line.

---

## 1. Current Extensions That Exist

### Coupon / Discount Codes

**Status: IMPLEMENTED (full stack)**

Evidence:
- `checkout-client.tsx:125-131` — `AppliedCoupon` interface with `code`, `type`, `value`, `discount`, `freeShipping` fields.
- `checkout-client.tsx:163-165` — `couponInput`, `appliedCoupon`, `couponError` state.
- `checkout-client.tsx:366-405` — `applyCoupon()` calls `GET /api/coupons/validate?code=...&subdomain=...&subtotal=...`.
- `checkout-client.tsx:361` — `couponCode: appliedCoupon?.code` included in `buildOrderPayload`.
- `checkout-payment-routes.ts:59` — `couponCode?: string` in `StorefrontCreateOrderBody`.
- `checkout-payment-routes.ts:388` — `coupon_code: body.couponCode` passed to `CreateCheckoutOrderCommand`.
- `coupons.ts:90-98` — V1 scope-lock: `bogo` type rejected; `percentage`, `fixed`, `free_shipping` supported.
- `coupons.ts:237-283` — `POST /coupons/validate` (merchant-authenticated validation endpoint, separate from storefront validate).
- `checkout.ts:208-212` — Hosted checkout also reads `coupon_code` from the cart, revalidates active status before confirm.

How it works: Client calls `GET /api/coupons/validate` with code, subdomain, and subtotal. The gateway validates the coupon record from the `coupons` table (checking `is_active`, expiry). The computed `discount` and `freeShipping` flag are returned to the client for display only. The canonical discount is applied inside the `create_checkout_order` RPC — the client discount shown is an advisory preview, not the authoritative amount. The order payload carries `coupon_code` and the RPC applies it server-authoritatively.

Limitations:
- Only one coupon code per order (no stacking — `combinesWith` field exists in the schema via `@letbuyy/checkout-core` but is not surfaced in the UI).
- `bogo` type is explicitly blocked in V1 (`coupons.ts:90-98`).
- Storefront validate endpoint (`GET /api/coupons/validate`) does a client-side discount preview; the authoritative amount is computed inside the DB RPC — mismatch is possible if products change price between validate and order creation.
- No merchant UI for coupon usage analytics visible in this route file.

---

### Gift Cards

**Status: PARTIAL — backend model complete, storefront checkout UI absent**

Evidence:
- `checkout-payment-routes.ts:60` — `giftCardCode?: string` exists in `StorefrontCreateOrderBody`.
- `checkout-payment-routes.ts:389` — `gift_card_code: body.giftCardCode` passed to `CreateCheckoutOrderCommand`.
- `gift-cards.ts:1-237` — Full merchant-side gift card lifecycle via RPCs (`issue_gift_card`, `set_gift_card_status`, `check_gift_card_balance`, `gift_card_transactions`).
- `checkout-client.tsx` — No `giftCardCode`, `giftCard`, or `gift_card` anywhere in the file. Zero results from grep.

How it works (backend only): Merchant issues a gift card via `POST /products/gift-cards`. The `gift_card_accounts` + `gift_card_ledger_entries` + `gift_card_redemptions` canonical model is maintained via `SECURITY DEFINER` RPCs. The order creation RPC accepts `gift_card_code`. Balance is a ledger projection (no mutable column).

Limitations:
- The storefront checkout UI (`checkout-client.tsx`) has **no input field** for a gift card code. The `giftCardCode` field in the API schema exists but is never populated from the browser checkout.
- A customer cannot redeem a gift card during checkout until the UI is wired.
- No storefront public endpoint for `check_gift_card_balance` visible — only merchant-authenticated balance check exists.

---

### GST / Tax Invoice

**Status: IMPLEMENTED (server-side computation and invoice) — UI input absent**

Evidence:
- `checkout-payment-routes.ts:42-50` — `StorefrontCreateOrderBody` has `customer.gstin?: string` and `customer.address.stateCode?: string`.
- `checkout-payment-routes.ts:295-365` — V1 server-side GST computation: reads `tax_registrations` (supplier GSTIN + state code) and `tax_rates` (active rate), determines intra/inter-state supply, iterates items with `calculateGstLine` from `@letbuyy/checkout-core`, posts `tax_amount` to order RPC.
- `checkout-payment-routes.ts:71-74` — `OrderRpcResult` returns `gst_invoice_number`, `gst_invoice`, `place_of_supply_state`.
- `checkout-payment-routes.ts:424-428` — Response includes `gstInvoiceNumber`, `gstInvoice`, `placeOfSupplyState`.
- `checkout.ts:54-55` — `checkout_sessions` row has `buyer_gstin?: string | null` field, populated from `buyer_gstin: body.gstin` in the contact step.
- `checkout-client.tsx` — No `GSTIN`, `gstin`, `gst`, or `Tax` input field in the form. The UI does not show tax breakdown or GSTIN field.

How it works: If the store has a `tax_registrations` record (supplier GSTIN/state) and an active `tax_rates` record, the gateway computes GST per line item using `calculateGstLine`. Intra-state = CGST+SGST; inter-state = IGST (handled inside the RPC). Tax is computed best-effort — if either table is absent, `tax_amount = null` and the RPC defaults to zero tax (preserving existing behavior). Invoice number and data are returned from the RPC.

Limitations:
- No GSTIN input field in `checkout-client.tsx` — B2B customers cannot provide their GSTIN for GST invoice generation.
- State code normalization depends on `stateCode` in `customer.address` which the checkout form does not currently collect (only a free-text `state` field).
- Tax inclusive pricing not supported in the current UI (no price breakdown showing "price includes X% GST").
- HSN codes are not collected per product in this checkout flow.
- The `gstInvoice` response is returned but not displayed in the checkout success screen.

---

### COD Fee / Handling Fee

**Status: NOT IMPLEMENTED**

Evidence:
- `checkout-payment-routes.ts` — No `cod_fee`, `handling_fee`, or `extra_charge` anywhere in the file. Zero results from grep.
- `checkout-client.tsx:986-1001` — COD option displayed but no fee is added to `totalAmount`; the COD path uses the same total calculation as online payment.
- `checkout-client.tsx:249-254` — `totalAmount = cartTotal + effectiveDeliveryCharges - discountAmount`. No COD surcharge term.

Limitations:
- COD fee is a standard India commerce practice (typically ₹25–₹50 per order). Merchants cannot currently configure it.
- The `CreateCheckoutOrderCommand` schema does not include a `cod_fee` field, so even if the UI were added, the RPC would need updating.

---

### Loyalty / Wallet / Points

**Status: NOT IMPLEMENTED at checkout — Merchant payout wallet only**

Evidence from wallet.ts:
- `wallet.ts:1-127` — The `wallet.ts` route is exclusively the **merchant payout wallet** (ledger of Razorpay settlements, payouts, and commissions). It operates on `wallet_ledger_entries` and `ledger_entries` tables. Entities are `site_id`-scoped (store), not customer-scoped.
- `wallet.ts:10-15` — `WalletQuerySchema` requires `store_id` (merchant ownership context).
- `checkout-client.tsx` — Zero results for `loyalty`, `point`, `reward`, `wallet`.
- No `customer_wallet`, `loyalty_points`, or `rewards` tables found in the routes examined.

Limitations:
- No customer-facing wallet, loyalty points, or cashback system exists.
- The wallet module is entirely merchant-facing (settlement tracking), not a customer spending account.
- Adding customer loyalty would require a new domain: customer wallet tables, earn/burn RPC, and storefront redemption UI.

---

## 2. Extension Points That Are MISSING

### Upsell / Cross-Sell at Checkout

**Absent — zero evidence in any file examined.**

The checkout UI (`checkout-client.tsx`) renders: address form → delivery options → payment method selection. There is no product recommendation component, no "customers also bought" section, and no pre-payment product add widget.

What would be needed:
- A `GET /api/storefront/:subdomain/checkout/upsell` endpoint that returns recommended products based on cart contents.
- A UI block in step 2 (Review & Pay) above the payment button showing 1–3 recommended items with an "Add to order" button.
- The order `items` array would need to support dynamic addition before `createCheckoutOrder` is called.

---

### Gift Wrap

**Absent — zero evidence.**

No `gift_wrap`, `giftWrap`, or gift message input exists in checkout-client.tsx or checkout-payment-routes.ts.

What would be needed:
- A checkbox + optional message textarea in step 1 or step 2.
- `gift_wrap: boolean` and `gift_message?: string` fields in `StorefrontCreateOrderBody` and `CreateCheckoutOrderCommand`.
- Merchant settings to enable/disable and optionally price gift wrap (adds to order total).

---

### Trust Badges

**Partial — static hardcoded icons only.**

Evidence:
- `checkout-client.tsx:1125-1139` — A "Trust Badges" section exists in the order summary sidebar. It shows three hardcoded icons: `ShieldCheck` (Secure), `Truck` (Fast), `Package` (Safe), each with a static 10px label. No dynamic content.
- `checkout-client.tsx:1141-1153` — Razorpay logo shown as a static payment partner badge.

Limitation: Badges are hardcoded. Merchants cannot configure which badges appear, add a "30-day returns" or "100% authentic" badge, or link badges to their store policies. There is no `store_trust_badges` table or settings endpoint.

---

### Order Notes / Delivery Instructions

**Status: Schema present, UI absent.**

Evidence:
- `checkout-payment-routes.ts:58` — `notes?: string` in `StorefrontCreateOrderBody`.
- `checkout-payment-routes.ts:387` — `notes: body.notes` passed to `CreateCheckoutOrderCommand`.
- `checkout-client.tsx:525-530` — `notes` field in Razorpay options is used only for Razorpay metadata (`order_id`, `store_id`, `subdomain`) — it is not a customer-facing order note.
- `checkout-client.tsx:338-364` — `buildOrderPayload` does not include a `notes` property from any form field.

The API schema accepts `notes`, but the checkout UI has no textarea for customer delivery instructions. The field is wired on the server but dead from the client.

---

### Post-Purchase Upsell

**Absent — zero evidence.**

The success screen (`checkout-client.tsx:553-600`) shows only an order confirmation message, order number, COD reminder, and two links ("Track Your Order", "Continue Shopping"). No post-purchase product offer.

What would be needed:
- A post-purchase page route or a second step after the success screen.
- A product offer API keyed to the completed order.
- This is architecturally a separate page from checkout, similar to Shopify's post-purchase extension.

---

### Subscription / Recurring Order

**Absent — zero evidence.**

No `subscription`, `recurring`, `schedule`, or `billing_cycle` field exists anywhere in the checkout files. The LCIS notes confirm the Subscription journey as "NOT IMPLEMENTED" (no subscriptions domain). The `PaymentMethod` type is `'online' | 'cod'`; there is no `'subscription'` or `'recurring'` method.

---

## 3. Extension Architecture Analysis

### How Extensions Currently Work

There is no extension system. Everything is hardcoded into `checkout-client.tsx` and `checkout-payment-routes.ts`. The response from the order creation route includes `extensionFunctions: []` (`checkout-payment-routes.ts:430`) — this is a stub/placeholder array that is always empty; no extension functions are ever registered or called.

The checkout UI is a single React client component with inline state management. There are no:
- Hook points where external code can inject UI blocks.
- Event emissions the UI subscribes to (other than the Razorpay SDK callbacks).
- Feature flags or merchant settings that enable/disable checkout UI sections.
- Plugin registry or middleware chain.

Extensions are added by modifying `checkout-client.tsx` directly (monolithic component pattern).

### Can Extensions Be Added Without Modifying Core?

No. There is no mechanism to add a checkout extension without modifying both the React component and the API route body schema. Evidence:

- `CheckoutClientProps` (`checkout-client.tsx:67-74`) has only: `storeId`, `sellerId`, `subdomain`, `storeName`, `codEnabled`, `onlinePaymentEnabled`. No `extensions`, `features`, or `config` prop.
- `StorefrontCreateOrderBody` (`checkout-payment-routes.ts:37-64`) is a fixed typed interface; there is no `metadata`, `extensions`, or `custom_fields` passthrough.
- Merchant settings for checkout customisation are not read at checkout time. The `store_branding` table (`checkout.ts:778-789`) provides theme colors only.

---

## 4. GST Architecture

### GST-Related Fields in Checkout

| Field | Location | Status |
|---|---|---|
| `customer.gstin` | `checkout-payment-routes.ts:42`, `StorefrontCreateOrderBody` | In schema, not in UI |
| `customer.address.stateCode` | `checkout-payment-routes.ts:47` | In schema, not in UI |
| `buyer_gstin` | `checkout.ts:54` (checkout_sessions row) | Hosted checkout contact step |
| `supplierStateCode` / GSTIN | `checkout-payment-routes.ts:320-323` | Resolved from `tax_registrations` table |
| `defaultRateBps` | `checkout-payment-routes.ts:327-331` | Resolved from `tax_rates` table (active, non-shipping rate) |
| `calculateGstLine` | `checkout-payment-routes.ts:350` | From `@letbuyy/checkout-core` |
| `gst_invoice_number` | `checkout-payment-routes.ts:71` / response | Returned from RPC |
| `gst_invoice` | `checkout-payment-routes.ts:72` / response | Returned from RPC (JSON) |
| `place_of_supply_state` | `checkout-payment-routes.ts:73` / response | Returned from RPC |

### Gaps

- **GSTIN input**: No UI field for B2B buyers to provide their GSTIN.
- **State code**: Only free-text `state` field collected; `stateCode` not derived from pincode or state name.
- **Tax-inclusive pricing**: Not modeled; `tax_inclusive: false` is hardcoded in `calculateGstLine` call (`checkout-payment-routes.ts:356`).
- **HSN codes**: Not per-product in checkout flow.
- **Invoice display**: `gstInvoice` returned in response but not rendered on success screen.
- **Inter-state IGST vs. intra-state CGST+SGST**: Split handled inside the RPC via `supplyType` (`checkout-payment-routes.ts:335`), but not shown to customer.

---

## 5. India-First Checkout Extensions

### What India-Specific Checkout Features Should Exist (Evidence of Gaps)

**EMI Options**
- No EMI (`emi`, `equated_monthly`, `installment`) anywhere in checkout-client.tsx or checkout-payment-routes.ts.
- Razorpay supports EMI natively but it is not surfaced in the checkout options. The `RazorpayOptions` object does not include `emi` or `installment_info`.
- Gap: Add `emi: { enabled: true }` to Razorpay options and a UI toggle for EMI plans.

**Buy Now Pay Later (BNPL)**
- No BNPL (`bnpl`, `simpl`, `lazypay`, `snapmint`) in any examined file.
- Razorpay checkout supports some BNPL providers natively, but they are not configured.
- Gap: Would require merchant BNPL provider setup and a payment method option.

**UPI Deep Links**
- Razorpay is loaded via their hosted checkout JS (`checkout.razorpay.com/v1/checkout.js`), which does present UPI as a payment option within the Razorpay modal. However, no standalone UPI deep link (intent URL for PhonePe/GPay/Paytm) is generated for mobile browsers.
- The `RazorpayOptions.notes` does not include UPI-specific metadata.
- Gap: Direct UPI intent links (`upi://pay?pa=...`) would bypass the Razorpay modal on mobile and improve conversion.

**PhonePe / GPay / Paytm Integration**
- Only Razorpay is integrated in the storefront checkout. `PaymentMethod` type is `'online' | 'cod'` with no PSP-specific sub-type.
- Cashfree and PayPal adapters exist in `checkout-payment-routes.ts` (lines 700–942) but are not surfaced in `checkout-client.tsx` — only Razorpay and COD are rendered.
- Gap: PhonePe/GPay/Paytm as explicit payment method options (beyond what Razorpay modal offers internally).

**Pincode-Based Serviceability Check**
- `checkout-client.tsx:220-223` — shipping rates fetched with `pincode: '000000'` (hardcoded placeholder): "real pincode available at form-fill". The actual customer pincode is collected in the form but not used to re-fetch rates or check serviceability.
- Gap: When the customer enters their pincode, trigger a serviceability check (`POST /api/shipping/rates` with the real pincode) and surface "delivery not available to your area" before they proceed to payment.

**COD with Limit Rules**
- `codEnabled` is a boolean prop (`checkout-client.tsx:72`) — only on/off per store, no order-amount-based COD limit, no pincode-based COD block, no COD fee (per section 1 above).
- Gap: `cod_max_order_amount`, `cod_blocked_pincodes` settings in merchant config, enforced server-side during order creation.

---

## 6. Shopify Checkout Extensions Comparison

| Shopify Feature | LetBuyy Equivalent | Status |
|---|---|---|
| Checkout UI Extensions (blocks anywhere) | None — monolithic `checkout-client.tsx` | Missing |
| Post-purchase page | None | Missing |
| Thank you page customization | Static success screen in `checkout-client.tsx:553-600` | Partial (hardcoded) |
| Order status page | `/store/:subdomain/orders` (link present, separate page) | Exists |
| Discount codes | `applyCoupon()` + `coupons` table | Implemented |
| Gift cards at checkout | API schema has `giftCardCode`, UI absent | Partial |
| Shipping rate extensions | `StoreShippingRate` from DB, fallback to hardcoded | Implemented (basic) |
| Custom fields / metafields at checkout | `notes` field in schema, no UI | Partial |
| Trust badges (configurable) | Hardcoded 3 icons | Partial (static only) |
| Upsell / cross-sell | None | Missing |
| EMI / BNPL | None explicit (inside Razorpay modal only) | Missing |
| Subscription checkout | None | Missing |
| Checkout branding (logo, colors) | `store_branding` table, `primary_color` from CSS var | Implemented |

**Opportunities:**
1. Shopify's Checkout UI Extensions use a JSON-defined block model with React rendering — LetBuyy could adopt a `checkout_extensions` JSON config per store to enable/disable blocks (gift wrap, upsell, order notes) without deploying new code.
2. Post-purchase pages in Shopify drive significant AOV lift. A `/checkout/thank-you/:orderId` route with a configurable upsell offer is achievable with the existing order model.
3. Shopify's checkout.liquid is deprecated in favor of extensible blocks — LetBuyy should not repeat this pattern; start extensible.

---

## 7. Extension Data Model

### Minimal JSON Structure for Checkout Extension Config

A `checkout_extensions` JSONB column on the `sites` table (or a separate `checkout_config` table) would enable merchant-configurable checkout behavior without code deploys:

```json
{
  "extensions": {
    "gift_wrap": {
      "enabled": true,
      "price_minor": 5000,
      "message_max_length": 200
    },
    "order_notes": {
      "enabled": true,
      "placeholder": "Special delivery instructions..."
    },
    "cod_rules": {
      "enabled": true,
      "max_order_minor": 500000,
      "fee_minor": 2500,
      "blocked_pincodes": ["110001", "400001"]
    },
    "upsell": {
      "enabled": false,
      "strategy": "same_collection",
      "max_items": 3
    },
    "trust_badges": {
      "enabled": true,
      "badges": [
        { "icon": "shield", "label": "Secure Checkout" },
        { "icon": "return", "label": "7-Day Returns" },
        { "icon": "authentic", "label": "100% Authentic" }
      ]
    },
    "gstin_collection": {
      "enabled": false,
      "required": false,
      "label": "GSTIN (optional, for B2B invoice)"
    },
    "post_purchase": {
      "enabled": false,
      "redirect_url": null
    }
  }
}
```

The `CheckoutClientProps` would gain a single `checkoutConfig` prop loaded server-side from `site.checkout_extensions`. Each extension section is a self-contained config block. The API route reads the config to enforce server-side rules (COD limits, gift wrap pricing). This mirrors Shopify's app block model without requiring a third-party extension runtime.

**Required changes to implement this model:**
1. Add `checkout_extensions JSONB DEFAULT '{}'` to `sites` table (migration).
2. Pass config in `checkout-client.tsx` props (server component reads it).
3. Render extension UI blocks conditionally based on config flags.
4. Add `gift_wrap`, `order_note`, `cod_fee`, `gstin` fields to `StorefrontCreateOrderBody`.
5. Update `create_checkout_order` RPC to accept and enforce the new fields.
