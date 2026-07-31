# Checkout Extensions Platform Design

> Evidence-based design document. No code was modified. All findings cite file:line.
> Prior research: `06-checkout-extensibility-analysis.md`, `02-checkout-flow-audit.md`.

---

## 1. Current Extension State

### Evidence Summary

**There is no extension system in checkout today.** The checkout is a monolithic React client component with no hook points, plugin registry, or middleware chain.

Key evidence:

- `checkout-payment-routes.ts:430` — `extensionFunctions: []` is returned in every order creation response. This is a stub/placeholder array that is always empty. No extension functions are ever registered or called.
- `checkout-client.tsx:67-74` — `CheckoutClientProps` has six fields (`storeId`, `sellerId`, `subdomain`, `storeName`, `codEnabled`, `onlinePaymentEnabled`). No `extensions`, `features`, `checkoutConfig`, or `blocks` prop exists.
- `checkout-client.tsx` — Zero matches for `extension`, `Extension`, `plugin`, `Plugin`, `widget`, or `Widget`. Confirmed by grep.
- `services/api-gateway/src/routes/app-store/extension-routes.ts` — The app-store extension routes exist for merchant app installations (`app_installations` table, scoped access tokens, bridge requests), but these extensions are admin-embed surfaces only. No checkout slot registration or injection path exists in the gateway.
- `StorefrontCreateOrderBody` (`checkout-payment-routes.ts:37-64`) — Fixed typed interface with no `metadata`, `extensions`, `custom_fields`, or `extra_charges` passthrough.

### Existing Checkout Capabilities That Are Extension-Like

| Capability | Status | Evidence |
|---|---|---|
| Coupon codes | Implemented | `checkout-client.tsx:366-405`, `coupons.ts:90-98` |
| Trust badges | Hardcoded static only | `checkout-client.tsx:1125-1139` — 3 icons, no merchant config |
| Shipping rates | Implemented (DB + fallback) | `checkout-payment-routes.ts`, `shipping-rates` table |
| Gift cards (backend only) | Schema present, UI absent | `checkout-payment-routes.ts:60`, no UI field in `checkout-client.tsx` |
| Order notes | Schema present, UI absent | `checkout-payment-routes.ts:58`, not in `buildOrderPayload` |
| Gift wrap | Absent | Zero evidence anywhere |
| COD fee | Absent | Zero evidence anywhere |
| Upsell / cross-sell | Absent | Zero evidence anywhere |
| Loyalty points at checkout | Absent | Zero evidence (wallet.ts is merchant payout only) |
| EMI options | Absent | Not in `RazorpayOptions` |

---

## 2. Checkout Extensions Architecture

### Extension Slot Model

The checkout renders in two steps (address → payment). Extension blocks are injected at named slots relative to these sections. The slot positions below map to the current `checkout-client.tsx` render structure.

```
[ABOVE_CONTACT_INFO]
  ← Contact info section (name / email / phone)
[BELOW_CONTACT_INFO]

[ABOVE_SHIPPING]
  ← Shipping rate selector (embedded in step 1)
[BELOW_SHIPPING]

[ABOVE_COUPON]
  ← Coupon code input (order summary sidebar)
[BELOW_COUPON]

[ABOVE_PAYMENT]
  ← Payment method selector (step 2)
[BELOW_PAYMENT]

[BELOW_ORDER_SUMMARY]
  ← Order summary sidebar (step 2)

[THANK_YOU_PAGE]
  ← Inline success screen (isSuccess === true)
```

**Step 1 sidebar slots** (visible throughout address entry):
- `[BELOW_COUPON]` — gift card code, loyalty points redemption
- `[BELOW_ORDER_SUMMARY]` — trust badges, announcement banners

**Step 2 primary slots** (visible at payment):
- `[BELOW_SHIPPING]` — delivery date picker, gift wrap
- `[ABOVE_PAYMENT]` — upsell block, COD fee notice, EMI options
- `[BELOW_ORDER_SUMMARY]` — trust badges (persistent)

**Post-checkout slots**:
- `[THANK_YOU_PAGE]` — post-purchase upsell, loyalty earn confirmation, delivery tracking preview

---

### Block Types

| Block Type | Slot | What It Does | Risk |
|---|---|---|---|
| `AnnouncementBlock` | `ABOVE_CONTACT_INFO` | Show store banner / free shipping threshold | LOW |
| `TrustBadgeBlock` | `BELOW_ORDER_SUMMARY` | Show security / return / authenticity badges (merchant-configured) | LOW |
| `OrderNoteBlock` | `BELOW_SHIPPING` | Customer order note / delivery instruction textarea | LOW |
| `GiftCardBlock` | `BELOW_COUPON` | Gift card code input (wires existing `giftCardCode` API field) | LOW |
| `GiftWrapBlock` | `BELOW_SHIPPING` | Checkbox + gift message + optional price surcharge | MEDIUM |
| `CODFeeBlock` | `ABOVE_PAYMENT` | Display COD handling fee, added to total | MEDIUM |
| `UpsellBlock` | `ABOVE_PAYMENT` | Show 1–3 recommended products; add to order before submission | MEDIUM |
| `LoyaltyBlock` | `BELOW_COUPON` | Show/redeem loyalty points (requires customer domain, future) | MEDIUM |
| `DeliveryDateBlock` | `BELOW_SHIPPING` | Let customer select preferred delivery window | MEDIUM |
| `GSTINBlock` | `BELOW_CONTACT_INFO` | GSTIN input for B2B invoice (wires existing `customer.gstin` API field) | LOW |
| `EMIBlock` | `ABOVE_PAYMENT` | Show Razorpay EMI plans + monthly instalment preview | HIGH |
| `BNPLBlock` | `ABOVE_PAYMENT` | Show Simpl / LazyPay / Snapmint options | HIGH |

---

## 3. Extension Data Contract

### What an Extension Receives (Read-Only Context)

```typescript
interface CheckoutExtensionContext {
  // Store identity
  store: {
    id: string;           // site_id (UUID)
    name: string;         // storeName prop
    subdomain: string;
    currency: 'INR';
  };

  // Cart snapshot at extension render time
  cart: {
    items: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      title: string;
      price_minor: number;    // authoritative price from server
    }>;
    subtotal_minor: number;   // sum of item prices * quantities
    item_count: number;
  };

  // Customer info (filled so far; may be partial in step 1)
  customer: {
    email?: string;
    phone?: string;
    name?: string;
    is_guest: boolean;        // always true in V1 (no session auth at checkout)
  };

  // Address (available after step 1 completes)
  address?: {
    city: string;
    state: string;
    pincode: string;          // 6-digit string
    stateCode?: string;       // derived from pincode lookup (future)
  };

  // Selected shipping rate (available after step 1 completes)
  shipping?: {
    rateId: string;
    name: string;
    amount_minor: number;
    estimated_days?: string;
  };

  // Payment method selected by customer
  payment?: {
    method: 'razorpay' | 'cod';
  };

  // Applied coupon (if any)
  coupon?: {
    code: string;
    discount_minor: number;
    free_shipping: boolean;
  };
}
```

### What an Extension Can Output (Mutations)

```typescript
interface ExtensionOutput {
  // Extra line items added to the order total.
  // Server MUST validate these amounts against merchant config before accepting.
  // Client-declared amounts are advisory only — the RPC is authoritative.
  extra_charges?: Array<{
    label: string;          // e.g. "Gift Wrap", "COD Fee"
    amount_minor: number;   // in paise
    type: 'gift_wrap' | 'cod_fee' | 'delivery_surcharge' | 'custom';
  }>;

  // Customer-provided notes / instructions
  order_notes?: string;     // max 500 chars; sanitized server-side

  // Arbitrary key-value metadata attached to the order
  // Surfaced in merchant dashboard; never in payment provider notes
  metadata?: Record<string, string>;  // max 10 keys, 256 chars per value

  // Gift wrap signal
  gift_wrap?: {
    enabled: boolean;
    message?: string;       // max 200 chars
  };

  // Selected gift card code (wires existing API field)
  gift_card_code?: string;

  // Customer GSTIN (wires existing API field)
  gstin?: string;

  // Preferred delivery date (advisory — carrier-dependent)
  preferred_delivery_date?: string;  // ISO 8601 date

  // UI rendered by this block (LetBuyy native blocks only — not third-party)
  // Third-party extensions use sandboxed iframes; they cannot return ui here.
  ui?: {
    rendered: true;   // signal that the block handled its own render
  };
}
```

### Security Invariants on Extension Output

1. `extra_charges` amounts are advisory. The gateway must look up the canonical amount from merchant config (e.g. `checkout_extensions.gift_wrap.price_minor`). If the client-supplied amount differs from the config, the config wins.
2. `order_notes` is sanitized (strip HTML, max 500 chars) before storage.
3. `metadata` keys are allowlisted or stripped of sensitive-looking names (`card`, `cvv`, `password`, `secret`).
4. `gift_card_code` redemption is validated inside the `create_checkout_order` RPC — the client-supplied code cannot bypass server-side balance checks.
5. `gstin` is passed through to the existing `customer.gstin` field and validated with the RPC.

---

## 4. Extension Hosting

### LetBuyy Native Extensions

Built by LetBuyy, deployed as part of `storefront-runtime`. Zero additional trust boundary — these run inside the same React component as the checkout.

- No iframe, no postMessage, no sandbox.
- Receive the full `CheckoutExtensionContext`.
- Can return any `ExtensionOutput` field.
- Enabled/disabled per store via `checkout_extensions` JSONB column on `sites` table (see Section 5).
- Examples: `GiftWrapBlock`, `CODFeeBlock`, `OrderNoteBlock`, `TrustBadgeBlock`, `GSTINBlock`, `GiftCardBlock`.

### Merchant-Configured Extensions

Merchants configure via their control-plane editor (Checkout > Customize). The underlying data model is the `checkout_extensions` JSONB column — no code deploy. The UI renders the appropriate native block, parameterized by the merchant's config.

- No custom code — merchants pick from the block catalog and configure values (badge labels, COD fee amount, gift wrap price, etc.).
- All parameters are validated server-side.
- This tier covers 100% of Tier 1 and Tier 2 priority extensions.

### Third-Party Extensions (Future — App Marketplace)

Developer-submitted via the app marketplace (`app_installations` table). The extension-routes.ts gateway already handles app installation lifecycle and scoped access tokens. A checkout-specific extension would add:

- A `checkout_extension_point` field on `marketplace_apps` — declaring which slot the app targets.
- A sandboxed `<iframe>` at the declared slot, loaded from the app's `checkout_block_url`.
- The iframe receives a `postMessage` with a serialized, read-only `CheckoutExtensionContext` (no payment fields, no full session data).
- The iframe can post back an `ExtensionOutput` message; the parent checkout validates and applies it.
- Payment fields (`razorpayOptions`, `payment_id`, signatures) are **never** sent to iframe extensions.
- Gateway-side: the order creation route receives `extension_outputs` in the request body and validates each output against the installed app's declared permissions.

This tier is not implemented in V1. The `extension-routes.ts` file provides the installation / access-token / bridge infrastructure but has no checkout slot registration.

---

## 5. Merchant Config Data Model

A `checkout_extensions` JSONB column on the `sites` table enables merchant-configurable checkout behavior without code deploys. The `CheckoutClientProps` gains a `checkoutConfig` prop loaded server-side by the page server component.

```json
{
  "extensions": {
    "announcement": {
      "enabled": true,
      "message": "Free shipping on orders above ₹999",
      "style": "info"
    },
    "gift_wrap": {
      "enabled": true,
      "price_minor": 5000,
      "message_max_length": 200,
      "label": "Add gift wrapping"
    },
    "order_notes": {
      "enabled": true,
      "placeholder": "Special delivery instructions..."
    },
    "cod_rules": {
      "enabled": true,
      "max_order_minor": 500000,
      "fee_minor": 2500,
      "fee_label": "COD Handling Fee",
      "blocked_pincodes": []
    },
    "gift_card": {
      "enabled": false
    },
    "gstin_collection": {
      "enabled": false,
      "required": false,
      "label": "GSTIN (optional, for B2B invoice)"
    },
    "trust_badges": {
      "enabled": true,
      "badges": [
        { "icon": "shield",    "label": "Secure Checkout" },
        { "icon": "truck",     "label": "Fast Delivery" },
        { "icon": "return",    "label": "7-Day Returns" }
      ]
    },
    "upsell": {
      "enabled": false,
      "strategy": "same_collection",
      "max_items": 2,
      "slot": "ABOVE_PAYMENT"
    },
    "loyalty": {
      "enabled": false
    },
    "delivery_date_picker": {
      "enabled": false,
      "blackout_days": []
    },
    "emi": {
      "enabled": false
    },
    "post_purchase": {
      "enabled": false,
      "redirect_url": null
    }
  }
}
```

**Required schema change**: `ALTER TABLE sites ADD COLUMN checkout_extensions JSONB NOT NULL DEFAULT '{}'`.

The server component at `apps/storefront-runtime/src/app/store/[subdomain]/checkout/page.tsx` reads `sites.checkout_extensions` and passes it as `checkoutConfig` to `CheckoutClientProps`. The API gateway reads the same config during order creation to enforce server-side rules (COD fee, gift wrap pricing, max COD amount).

---

## 6. Security Model

### Payment Field Isolation

Payment-sensitive data is never accessible to extension code:

| Data | Native LetBuyy Blocks | Merchant-Configured | Third-Party (iframe) |
|---|---|---|---|
| Cart items + prices | YES | YES | YES (read-only postMessage) |
| Customer name / email / phone | YES | YES | NO |
| Shipping address | YES | YES | NO |
| Razorpay key ID | YES | NO | NO |
| Razorpay order ID | YES | NO | NO |
| Payment signature | YES | NO | NO |
| HMAC secrets | YES | NO | NO |

### Amount Integrity

All extra charges declared by extension output go through server-side validation before reaching the `create_checkout_order` RPC:

```
Client Extension Output (extra_charges)
        ↓
Gateway reads checkout_extensions config from DB
        ↓
Gateway validates: config amount == client-declared amount
        ↓
If mismatch → use config amount (log discrepancy)
        ↓
create_checkout_order RPC receives validated amounts only
```

The RPC itself is a `SECURITY DEFINER` Postgres function that re-derives totals from DB-authoritative product prices. A malicious client cannot inflate or deflate the order total through extension output.

### Extension Output Sanitization

Before `buildOrderPayload` is assembled:

- `order_notes` → strip HTML tags, truncate to 500 chars.
- `metadata` → filter keys containing `card`, `cvv`, `password`, `secret`, `token`, `key`; max 10 keys; max 256 chars per value.
- `extra_charges` → must match a declared `type`; amount must equal config amount; max 5 extra charges.
- `gift_wrap.message` → strip HTML, truncate to `message_max_length` from config.
- `gstin` → validate format `/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/` before passing to RPC.

### Third-Party iframe Sandbox Policy

```html
<iframe
  src="{app.checkout_block_url}"
  sandbox="allow-scripts allow-same-origin"
  allow=""
  referrerpolicy="no-referrer"
  loading="lazy"
/>
```

- `allow-forms` is NOT granted — forms inside iframes cannot POST to external servers.
- No camera, microphone, geolocation, payment APIs.
- The parent frame sends context via `postMessage` only to the iframe's declared origin.
- The parent frame validates that `event.origin === app.checkout_block_origin` before reading any postMessage from the iframe.

---

## 7. Built-In Extensions Priority List

Priority driven by India commerce conversion impact, implementation complexity, and existing schema support.

| Extension | Value | Complexity | Schema Ready? | Priority |
|---|---|---|---|---|
| **Trust Badges** (configurable) | High — social proof at every step | Low | No (`sites.checkout_extensions`) | Tier 1 |
| **Order Notes** | High — delivery instructions reduce failed deliveries | Low | Partial (`notes` field in API, no UI) | Tier 1 |
| **Gift Card** (storefront UI) | High — backend complete, UI gap only | Low | Yes (`giftCardCode` in API schema) | Tier 1 |
| **COD Fee** | High — standard India practice (₹25–₹50) | Low | No (needs `extra_charges` in RPC) | Tier 1 |
| **Announcement Banner** | Medium — free shipping threshold messaging | Low | No | Tier 1 |
| **Gift Wrap** | Medium — premium/gifting market | Low | No | Tier 2 |
| **Upsell Block** | High — AOV lift pre-payment | Medium | No (needs `/checkout/upsell` endpoint) | Tier 2 |
| **GSTIN Collection** | High — B2B segment, GST invoice | Low | Yes (`customer.gstin` in API schema) | Tier 2 |
| **Delivery Date Picker** | Medium — conversion lift for time-sensitive buyers | Medium | No | Tier 2 |
| **Loyalty Points** | High — retention and repeat purchase | Medium | No (requires customer loyalty domain) | Tier 2 |
| **Post-Purchase Upsell** | High — incremental AOV after payment | Medium | No (requires new route) | Tier 3 |
| **EMI Options** | High — high-ticket conversion | High | No (Razorpay config + UI) | Tier 3 |
| **BNPL** | Medium — segment-specific | High | No (provider integration) | Tier 3 |

---

## 8. Implementation Roadmap

### Tier 1 — Config-Driven, No New RPC Required

These four extensions require only:
1. `ALTER TABLE sites ADD COLUMN checkout_extensions JSONB NOT NULL DEFAULT '{}'`.
2. Read config in the page server component; pass as `checkoutConfig` prop.
3. Render the block conditionally in `checkout-client.tsx`.
4. Pass the extension output through `buildOrderPayload` to the existing `notes` / `giftCardCode` API fields.

**Trust Badges**: replace hardcoded 3-icon block (`checkout-client.tsx:1125-1139`) with a dynamic list from `checkoutConfig.extensions.trust_badges.badges`. Merchant can configure up to 5 badges with icon + label.

**Order Notes**: add a `<textarea>` in step 1 below the address fields; wire to the existing `notes` field in `StorefrontCreateOrderBody`. Already wired at the gateway (`checkout-payment-routes.ts:387`); UI-only change.

**Gift Card**: add a code input below the coupon field (same pattern as coupon apply); wire to the existing `giftCardCode` field in `StorefrontCreateOrderBody`. Add a public storefront endpoint for `check_gift_card_balance` (existing merchant endpoint at `gift-cards.ts` is merchant-auth gated).

**Announcement Banner**: render a configurable banner above the contact info section from `checkoutConfig.extensions.announcement`.

### Tier 2 — Requires New Extra-Charges Pathway

COD Fee and Gift Wrap both add a line-item surcharge to the order. This requires:
1. Add `extra_charges` array to `StorefrontCreateOrderBody`.
2. Validate each charge against `checkout_extensions` config in the gateway.
3. Pass validated amounts to `create_checkout_order` RPC as a new `extra_charges` input parameter.
4. RPC adds each charge as an order line or fee field to the total.

This is the one schema + RPC change that unlocks COD Fee, Gift Wrap, and future surcharge-based extensions.

### Tier 3 — Separate Domain Work

EMI, BNPL, loyalty points, and post-purchase upsell each require a larger implementation scope (new domain tables, new Razorpay config, customer loyalty system) and are out of scope for the checkout extensions platform itself.

---

## Appendix: File Locations

| Concern | File |
|---|---|
| Checkout UI (monolithic, to be extended) | `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx` |
| Order creation route (extension output landing) | `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts` |
| `extensionFunctions` stub | `checkout-payment-routes.ts:430` |
| App-store extension lifecycle routes | `services/api-gateway/src/routes/app-store/extension-routes.ts` |
| App installation table | `app_installations` (Supabase) |
| Marketplace app table | `marketplace_apps` (Supabase) |
| Prior extensibility analysis | `docs/checkout-research/06-checkout-extensibility-analysis.md` |
| Prior flow audit | `docs/checkout-research/02-checkout-flow-audit.md` |
