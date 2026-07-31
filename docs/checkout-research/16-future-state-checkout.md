# Future State Checkout — LetBuyy Checkout 2.0

_Design document. Research date: 2026-06-18. No code was modified._
_Grounded in: 01-checkout-system-inventory, 02-checkout-flow-audit, 03-payment-architecture, 09-conversion-analysis, 11-mcp-checkout-analysis._

---

## 1. Vision Statement

By 2028, LetBuyy Checkout 2.0 is the fastest, most conversion-optimised checkout layer in Indian commerce. Every LetBuyy store — from a first-day founder to a 100,000-order brand — completes checkout on a single shared platform that the merchant never has to build, maintain, or redeploy. Customers complete a purchase in under two seconds on mobile, with UPI intent, saved addresses, and pincode-aware COD. Merchants configure checkout in plain English through the control plane or by talking to an AI. Developers extend checkout with typed SDK slots and ship to the marketplace. LCIS and MCP agents autonomously detect payment failures, abandonment spikes, and conversion drops — and act on them before the merchant notices.

The current state (V1) is a monolithic 1,160-line client component embedded in `storefront-runtime`, with two-step sequential state, no client-side funnel analytics, no cart abandonment recovery, no address autocomplete, and no checkout extensibility. Checkout 2.0 decouples this into a dedicated platform, preserves the canonical ledger and security architecture that V1 got right, and builds the missing layers on top.

---

## 2. Design Principles

| Principle | What It Means | How It Differs From Today |
|---|---|---|
| **Centralized** | One shared checkout platform serves every store at `checkout.letbuyy.com/{store}`. Checkout is not an app embedded inside each store's Next.js bundle. | Today checkout is 1,160 lines inside `storefront-runtime/checkout-client.tsx`. Every improvement requires redeploying the storefront. In 2.0 a single deployment benefits all stores simultaneously. |
| **Upgrade-safe** | Merchants never wait for a checkout update. The platform ships silently. Breaking changes go through canary + feature-flag lanes. | Today the checkout component is co-deployed with storefront changes. A product change can accidentally break checkout. 2.0 separates the deployment lifecycle completely. |
| **Theme-aware** | Checkout inherits the store's `--lb-*` design tokens — primary color, font, border radius — from the branding API without any per-store configuration work. The base `store_branding` record is the source of truth. | Today `checkout.ts` exposes `GET /v1/stores/:storeId/branding` and `PUT /v1/stores/:storeId/branding` but the storefront checkout client does not consume them; it renders hardcoded design-system tokens. The branding surface exists but is not wired into the checkout UI. |
| **Brand-aware** | Checkout renders the store's logo, name, and color palette. The shopper never sees a generic LetBuyy-branded page; they see the store they started shopping on. | Today `CheckoutClient` receives `storeName` as a prop and displays it but does not apply store-specific colors or the store logo fetched from the branding API. |
| **AI-operable** | LCIS can autonomously detect payment failure spikes, cart abandonment surges, COD abuse patterns, and address-step drop-off — and either alert the merchant or trigger a remediation action via the MCP tool layer. | Today there are zero checkout-stage analytics events fired from `checkout-client.tsx`. The LCIS cannot observe where shoppers abandon; it only sees aggregate `checkouts_started` and `orders.paid` — missing every intermediate step. |
| **MCP-operable** | Merchants, agents, and LCIS can manage checkout configuration through the 30 READY/PARTIAL MCP tools already documented in `11-mcp-checkout-analysis.md`, plus the new tools required by 2.0: `enable_cod_with_rules`, `configure_checkout_extensions`, `get_checkout_funnel`, `update_payment_providers`. | Today 30 tools are READY but 6 checkout-critical tools are BLOCKED, including live payment intent creation, checkout funnel analytics, COD toggle, and abandonment report. These gaps are first-class 2.0 deliverables. |
| **Secure** | All security invariants from V1 are preserved and hardened: server-authoritative amounts, HMAC-SHA256 Razorpay verification via `timingSafeEqualHex`, `SECURITY DEFINER` RPCs for all money mutations, idempotency keys on all payment operations, and ES256 merchant JWT + `verifySiteOwnership` for all configuration endpoints. Step-up tokens gate refunds and payouts. | The V1 security architecture is correct. 2.0 inherits it fully. The only new security surface is the extensions runtime, which must sandbox extension code and forbid direct DB or RPC access. |
| **Fast** | Checkout page load under 1.5 seconds by end of 2026, under 1 second by 2028. The monolithic 1,160-line client component is split into streaming server-rendered sections. The Razorpay SDK loads asynchronously and does not block paint. | Today checkout is a monolithic `'use client'` component with no code-splitting, no `Suspense`, no streaming. The Razorpay SDK is loaded `afterInteractive` which is correct but the rest of the bundle is unoptimised. `next/image` uses `unoptimized` passthrough. |
| **Extensible** | Merchants and developers can inject custom UI into defined slots (above/below contact, above/below address, above/below payment, above/below order summary) without touching the checkout core. Extensions are typed, sandboxed, and testable in a developer sandbox. | Today there is no extension surface. The checkout is a sealed component. Any customisation requires a fork of `checkout-client.tsx`. |

---

## 3. LetBuyy Checkout 2.0 Architecture

### System Overview

```
Customer Browser
      │ navigates to {store}.letbuyy.com/products/...
      │ adds to cart
      │
      ▼
Storefront Runtime ({store}.letbuyy.com)
      │
      │ "Proceed to Checkout" → generates HMAC-signed handoff URL
      │   (GET /v1/storefront/{subdomain}/cart/{cartToken}/checkout-url)
      │   payload: site_id, cart_id, cart_token, expires_at, signature
      │
      ▼ redirect (302) to
Checkout Platform (checkout.letbuyy.com/{store}?cart=...&sig=...&exp=...)
  │
  ├── [Session Layer]
  │     Checkout Session Manager
  │       - verifies HMAC handoff signature (CHECKOUT_SIGNING_SECRET)
  │       - creates / resumes checkout_sessions row
  │       - fetches brand tokens from GET /v1/stores/:storeId/branding
  │       - fetches merchant settings (contact_method, customer_accounts, tip_option)
  │       - state machine: contact → delivery → payment_intent → completed | failed
  │
  ├── [Rendering Layer]
  │     Checkout Form Engine (React Server Components + client islands)
  │       - Contact island: name, email, phone; OTP gate (2028)
  │       - Address island: pincode-first autocomplete, city/state auto-fill
  │       - Shipping island: real-time rates by pincode from /v1/shipping/rates
  │       - Coupon island: validate via /v1/coupons/validate (server re-validates at order)
  │       - Payment island: Razorpay, COD (with pincode serviceability), UPI intent (2028)
  │       - Order Summary: server-rendered, never client-computed totals
  │
  ├── [Extensions Runtime] (2027)
  │     Slot host for developer-installed extensions
  │       Slots: above_contact, below_contact, above_address, below_address,
  │              above_shipping, above_payment, below_payment, above_order_summary,
  │              post_purchase
  │       Sandbox: extensions run in iframe or Trusted Types boundary
  │       SDK: @letbuyy/checkout-extensions npm package
  │
  ├── [Branding Engine]
  │     Reads store_branding (logo_url, primary_color, accent_color, checkout_theme, tokens)
  │     Injects --lb-* CSS custom properties onto :root at session start
  │     Dark/light mode: respects checkout_theme ('system' | 'light' | 'dark')
  │
  ├── [Preview Mode] (2026)
  │     Merchant editor sends preview=true + unsigned token
  │     Renders live branding changes in real time without completing a checkout
  │     Powered by: merchant-control-plane Checkout Editor sending SSE updates
  │
  ├── [Analytics Engine]
  │     Fires structured events at every step transition:
  │       checkout.session_started, checkout.contact_entered,
  │       checkout.address_entered, checkout.shipping_selected,
  │       checkout.payment_method_selected, checkout.payment_initiated,
  │       checkout.payment_failed, checkout.completed, checkout.abandoned
  │     Sink: Cloudflare Analytics Engine → /v1/analytics/live (existing infra)
  │
  └── [Webhook Emitter]
        checkout.started, checkout.completed, checkout.abandoned, payment.failed
        dispatched via services/webhook-service (existing outbound webhook infra)
        (fills the BLOCKED gap in 11-mcp-checkout-analysis: inbound Razorpay webhook receiver)

      │ all writes flow through
      ▼
API Gateway (/v1/checkout, /v1/storefront, /v1/payments, /v1/orders)
      │
      ├── POST /v1/checkout/:cartId/contact
      ├── POST /v1/checkout/:cartId/delivery
      ├── POST /v1/checkout/:cartId/payment-intent
      └── POST /v1/checkout/:cartId/confirm
              │
              ▼ exclusively through SECURITY DEFINER Postgres RPCs
Canonical Ledger
      ├── create_checkout_order
      ├── attach_order_payment_reference_with_ledger
      ├── confirm_order_payment_with_ledger
      └── record_order_payment_failure_with_ledger

      │ async post-payment
      ▼
Queue Workers + Webhook Service
      ├── order.created → GST invoice generation, confirmation email (Resend)
      ├── order.paid → WhatsApp order confirmation (existing whatsapp.ts)
      ├── cart.abandoned → recovery email / WhatsApp (fills current gap: no consumer exists)
      └── payment.failed → merchant alert if failure rate exceeds threshold (LCIS detection)
```

### What Changes From Today

The V1 checkout path (`GET /store/{subdomain}/checkout`) continues to work for the transition period. Checkout 2.0 introduces the hosted checkout platform as the primary path while the V1 path is deprecated over a merchant migration window. The canonical ledger RPCs, the API gateway, queue workers, and webhook service are unchanged — Checkout 2.0 is a new entry layer, not a replacement of the payment or order infrastructure.

The key structural change is that the `checkout_sessions` state machine in `services/api-gateway/src/routes/checkout.ts` — which is already implemented (`contact → delivery → payment_intent → completed`) but currently blocked for live use (`HR-MERCHANT-PSP-LIVE`) — becomes the authoritative checkout path. The V1 storefront checkout directly called `/v1/storefront/:subdomain/orders` and bypassed the session state machine; 2.0 routes all checkout through the session machine to get step-level observability, extension slots, and branding.

---

## 4. Customer Experience: 2028 Target

### One-Page Checkout

The default checkout layout renders all sections simultaneously on a single scrollable page: contact, address, shipping, coupon, order summary, and payment. Progress is indicated by an anchor nav on desktop and a sticky progress bar on mobile. No multi-step wizard is required for simple carts. The step wizard mode is available for stores that prefer it (configurable in merchant checkout settings).

Address entry is pincode-first. Entering a 6-digit pincode triggers an instant lookup that auto-fills city and state, confirms COD availability for that pincode, and displays the estimated delivery dates for each available shipping method. This eliminates the V1 gap where `'000000'` was used as the placeholder pincode at mount time — in 2.0 the first meaningful interaction is pincode entry which unlocks the rest of the form.

### Instant Payment

Razorpay remains the primary payment gateway. The Razorpay checkout.js modal opens without a loader screen because the SDK is preloaded during the address step (not waited on at the pay button press). This eliminates the `razorpayLoaded` gate that today can delay the payment button by the SDK load time.

UPI intent links (PhonePe, Google Pay, Paytm) are rendered as direct deep-links on mobile, allowing customers on those apps to pay without going through the full Razorpay modal. The UPI intent links are server-generated via the Razorpay UPI intent API, avoiding the schema-only `'upi'` stub in V1.

Saved payment methods are offered to returning customers who have a customer account. Razorpay tokenization (`tokenize: true`) is passed at checkout-order creation, enabling one-click payment on subsequent purchases.

### Smart Defaults

LCIS augments the checkout session start with inference from prior order data:

- **Likely pincode:** if the returning customer has placed two or more orders to the same pincode, the pincode field is pre-filled and the address suggestion is offered above the form.
- **Preferred payment method:** if the customer has always used COD, the default selection is COD. If they have always used Razorpay UPI, UPI intent is shown first.
- **Free shipping threshold nudge:** if the cart is within ₹50 of the free shipping threshold, an inline nudge is shown: "Add ₹50 more to get free delivery."

These are presented as suggestions, never as forced defaults that block the customer.

### Post-Purchase

The order confirmation page is the first active revenue surface for the merchant:

- **Cross-sell slot:** the merchant or an extension can inject "Customers also bought" recommendations. The slot is empty by default (no mandatory LetBuyy branding).
- **Subscription opt-in** (2028): if the store has a subscription product, the post-purchase slot offers a one-click subscribe to recurring delivery.
- **Loyalty enrollment:** if the store has a loyalty programme configured, the post-purchase slot offers points enrollment with a single tap.
- **WhatsApp opt-in:** a single-tap WhatsApp opt-in captures the customer's consent for order updates and future marketing, feeding into the `whatsapp.ts` `abandoned_cart` and order-update flows that already exist in the gateway.

The post-purchase page has a persistent URL (`/orders/{orderNumber}/confirmation`) so the merchant can share it and the customer can return to it.

---

## 5. Merchant Experience: 2028 Target

### Checkout Editor

The merchant control plane gains a visual checkout editor at `/[store]/settings/checkout/editor`. The editor renders a live preview of `checkout.letbuyy.com/{store}` in an iframe via the Preview Mode surface described in §3. Changes to branding tokens, enabled payment methods, field visibility, and extension slot order are reflected in the preview in real time via SSE updates — no page reload required.

The editor is structured in three panels:

1. **Appearance:** primary color picker, logo upload, checkout theme (light/dark/system), font selection from the `--lb-*` type scale.
2. **Form fields:** toggle visibility and optionality of company name, order notes, tip option. Set contact method (email / phone / both). Set customer accounts mode (disabled / optional / required).
3. **Extensions:** drag-and-drop ordering of installed extensions within each slot. Enable/disable individual extensions. Preview the extension output within the editor.

All changes write to `store_branding` and `site_settings` via the existing `PUT /v1/stores/:storeId/branding` and `PATCH /api/stores/{store}/settings` endpoints. No new endpoints are required for the editor itself.

### AI Checkout Assistant

The merchant-control-plane dashboard gains a checkout-scoped AI assistant powered by MCP tools and LCIS. The assistant accepts natural language commands:

- "Enable COD with a maximum order value of ₹2,000" → calls a new `enable_cod_with_rules` MCP tool that writes to `shipping_serviceability_rules` (fills the BLOCKED gap from `11-mcp-checkout-analysis`).
- "Add a gift wrap option for the festive season" → scaffolds a gift wrap checkout extension and adds it to the `above_order_summary` slot.
- "Why is my checkout conversion down this week?" → queries LCIS `/api/decision-engine` and `/api/checkout-funnel` to surface the drop-off stage and a suggested fix.
- "Create a 20% off coupon valid until Diwali for orders above ₹500" → calls `create_coupon` with the computed parameters. The READY status confirmed in `11-mcp-checkout-analysis` means this works today.
- "Turn off online payments for the next two hours while I fix my Razorpay keys" → calls `update_payment_providers` to set `online_payment_enabled: false` temporarily, with an auto-restore timer.

The assistant's authority is bounded: it cannot modify the canonical ledger directly, cannot issue refunds above ₹10,000 without step-up verification, and cannot delete orders.

### Checkout Analytics

The merchant dashboard gains a Checkout Funnel card sourced from the new per-step analytics events defined in §3. The funnel shows:

1. Sessions entered checkout
2. Contact info entered
3. Address entered + pincode confirmed
4. Shipping method selected
5. Payment method selected
6. Payment initiated (Razorpay modal opened / COD confirmed)
7. Orders completed (paid + COD)

Each step shows absolute count and conversion rate from the previous step. A "biggest drop-off" callout highlights the step with the highest abandonment and links to a recommended fix from LCIS.

COD is broken out separately to show: COD sessions initiated, COD orders placed, COD orders delivered, COD orders returned — giving the merchant insight into true COD realisation (today the dashboard has revenue from `orders.paid` but no COD delivery realisation rate).

Payment method performance shows: Razorpay success rate, modal open-to-complete rate, top failure reason codes from Razorpay callbacks.

---

## 6. Developer Experience: 2028 Target

### Checkout Extensions SDK

The `@letbuyy/checkout-extensions` npm package provides a typed API for building checkout extensions:

```typescript
import { defineCheckoutExtension, Slot } from '@letbuyy/checkout-extensions';

export default defineCheckoutExtension({
  slot: Slot.AbovePayment,
  render(context) {
    // context.cart: readonly cart summary (items, subtotal, currency)
    // context.customer: email, phone, name (after contact step)
    // context.shipping: selected rate, pincode, estimated delivery
    // context.store: store_id, name, primary_color
    return <GiftWrapToggle onSelect={(selected) => context.setMetadata('gift_wrap', selected)} />;
  },
});
```

Extensions run in a sandboxed iframe with a postMessage bridge. They receive a read-only context and can call a restricted set of `context.*` methods: `setMetadata`, `addLineItem` (for extension-initiated add-ons like gift wrap or insurance), `showBanner`, `blockCompletion` (to require a field to be filled before proceeding). They cannot call the gateway directly, cannot read other stores' data, and cannot execute arbitrary scripts outside their iframe.

The extension bundle is validated at publish time: no external fetch, no `eval`, no DOM mutations outside the shadow root, no PII capture.

### Checkout Webhooks

The existing `services/webhook-service` outbound webhook infrastructure is extended with four checkout-scoped events:

| Event | Trigger | Payload |
|---|---|---|
| `checkout.started` | Customer enters checkout (contact step begins) | `{ checkout_id, cart_id, site_id, session_started_at }` |
| `checkout.completed` | Order confirmed + payment confirmed (or COD placed) | `{ checkout_id, order_id, order_number, payment_method, total_minor, site_id }` |
| `checkout.abandoned` | Cart abandonment job consumed (1 hour after last activity with no order) | `{ checkout_id, cart_id, buyer_email, subtotal_minor, last_step_reached, site_id }` |
| `payment.failed` | Razorpay `payment.failed` event received server-side | `{ checkout_id, order_id, provider, failure_reason, site_id }` |

`checkout.started` and `checkout.completed` already exist as domain events in `checkout.ts` (lines 142–146 of the gateway inventory). `checkout.abandoned` requires wiring the existing `cart.abandonment_check` queue job to a downstream consumer (the queue job is enqueued but unconsumed — the biggest single gap in the current analytics system). `payment.failed` requires the missing inbound Razorpay webhook receiver (gap identified in `03-payment-architecture §10`).

### Checkout CLI

The `letbuyy` CLI gains a `checkout` subcommand:

```sh
# scaffold a new extension
letbuyy checkout extension create gift-wrap --slot above_payment

# run the extension in the developer sandbox
letbuyy checkout dev

# publish to the app marketplace
letbuyy checkout extension publish

# test a checkout flow against the sandbox gateway
letbuyy checkout test --payment cod --pincode 400001
letbuyy checkout test --payment razorpay --test-mode
```

The `letbuyy checkout dev` command starts a local checkout preview server that renders the extension inside a real checkout session against the sandbox gateway. The developer can see exactly how the extension interacts with the form, the order summary, and the payment step — without needing a live store or Razorpay live credentials.

---

## 7. AI-Operable Checkout

LCIS gains a checkout intelligence module that uses the new per-step analytics events to power autonomous operations. The module operates in three modes: detection, prediction, and action.

### Detection (real-time, polling analytics engine)

| Signal | Condition | LCIS Action |
|---|---|---|
| Payment failure spike | `payment.failed` events > 3x the 7-day rolling average in a 15-minute window | Alert merchant via control-plane notification + LCIS `/api/incident-intelligence?domain=payments` |
| COD abuse pattern | COD delivery realisation rate < 60% over 14 days for a specific pincode cluster | Suggest `enable_cod_with_rules` to restrict COD for those pincodes, surfaced in AI Checkout Assistant |
| Cart abandonment at address step | Address step drop-off rate > 40% (vs. 25% median) | Suggest address autocomplete activation; flag in LCIS `/api/decision-engine` as a conversion blocker |
| Free shipping threshold sensitivity | Average cart size clusters near the shipping threshold (within 10%) | Suggest lowering the free shipping threshold to capture the near-threshold segment |
| Razorpay SDK load regression | Razorpay modal open rate drops relative to payment step entry rate | Alert: SDK CDN may be blocked or slow; suggest fallback payment method ordering |

### Prediction (structural analysis, daily)

| Prediction | Evidence Signal | Output |
|---|---|---|
| Which payment method will dominate in 6 months | Historical COD vs. Razorpay mix by region + UPI adoption trend | Merchant readiness score for UPI intent; surfaced in Merchant OS `/api/merchant-ops` |
| Which pincode clusters are high COD risk | `cod_reconciliation_entries.difference_amount_minor` distribution by pincode prefix | Pre-emptive COD rule suggestions before losses occur |
| When checkout load will exceed current infra | Order volume trend + p95 checkout page load time | Infrastructure scaling recommendation to the platform operations team |

### Action (MCP tool calls, always with merchant approval except metric queries)

LCIS can autonomously query checkout analytics and propose actions, but cannot modify checkout configuration, create coupons, or change payment settings without explicit merchant approval via the control-plane notification centre or the AI Checkout Assistant. This is the same authority boundary as the assistant in §5 — read autonomously, write with approval.

---

## 8. Performance Targets

The current V1 checkout has no code-splitting, no streaming, no address autocomplete, and ships the entire Framer Motion animation library as part of the checkout bundle. These are direct levers for the performance targets below.

| Metric | Current Estimate (V1) | Target 2026 | Target 2028 |
|---|---|---|---|
| Checkout page load (LCP on mobile 4G) | ~3–4s (monolithic client bundle, no code-splitting) | < 1.5s | < 1s |
| Time from "Pay" click to order confirmation | ~4–6s (order create + Razorpay order + modal + verify) | < 3s | < 2s |
| Mobile checkout completion rate | Unknown (no funnel tracking) | > 60% | > 75% |
| Razorpay payment success rate | Unknown (no per-store tracking) | > 95% | > 98% |
| Cart abandonment recovery rate | 0% (queue job enqueued, never consumed) | > 10% (email recovery wired) | > 25% (WhatsApp + email + retargeting) |
| Checkout funnel visibility | Blind (0 of 7 steps tracked client-side) | 7 of 7 steps tracked | Full funnel + session replay integration |
| Address step drop-off | Unknown | Measured baseline established | < 15% (pincode autocomplete wired) |
| COD delivery realisation rate (platform) | Not measured | Measurement established | > 85% per pincode serviceable zone |

The 2026 targets require: (1) streaming server-rendered checkout with React Server Components, (2) code-split payment island so Razorpay SDK loads in parallel with address entry, (3) wiring the `cart.abandonment_check` queue consumer, (4) firing the 7-step analytics events. These are engineering tasks, not design decisions.

The 2028 targets additionally require: (5) UPI intent links on mobile, (6) pincode autocomplete, (7) saved payment methods via Razorpay tokenization, (8) WhatsApp recovery wired to the `abandoned_cart` template that already exists in `whatsapp.ts`.

---

## 9. India-First Checkout 2.0

India-specific capabilities are first-class in the platform, not add-ons.

### UPI Intent Links

Razorpay UPI intent generates a `upi://pay?...` deep-link that opens PhonePe, Google Pay, or Paytm directly on mobile without the Razorpay modal. On iOS and Android, the payment app handles the transaction and returns the customer to the checkout confirmation page. The `V1PaymentProviderSchema` already enumerates `'upi'`; what is missing is the route handler, which Checkout 2.0 adds at `POST /v1/checkout/:cartId/upi-intent`.

### Pincode-Based COD Availability

The `shipping_serviceability_rules` table (referenced in `11-mcp-checkout-analysis`) carries `cod_available` per pincode. In V1 this table exists but COD availability is only gated by the binary `sites.cod_enabled` boolean. In Checkout 2.0, the address step queries `GET /v1/shipping/serviceability/{pincode}?store_id=` on every pincode entry and shows or hides the COD option in real time. The endpoint already exists (`shipping.ts: GET /v1/shipping/serviceability/:pincode`). The gap is wiring it into the checkout form.

### GST Invoice Auto-Generation

`create_checkout_order` RPC already generates `gst_invoice_number` and populates a `gst_invoice` column on the `orders` table (confirmed in `01-checkout-system-inventory §1` and `11-mcp-checkout-analysis BLOCKED: get_order_gst_invoice`). Checkout 2.0 exposes a `GET /v1/orders/:id/invoice` endpoint (currently BLOCKED) and surfaces the GST invoice link on the order confirmation page and in the post-purchase email. B2B customers can enter their GSTIN at checkout (a new optional field) and have it included on the invoice.

### Vernacular Checkout

The checkout platform is internationalised from its first deployment. The initial set of locale packs:

| Locale | Status |
|---|---|
| `en-IN` | Default (current) |
| `hi-IN` | Hindi — 2026 |
| `ta-IN` | Tamil — 2027 |
| `te-IN` | Telugu — 2027 |
| `kn-IN` | Kannada — 2028 |

Locale is detected from the browser's `Accept-Language` header with a merchant-configured default and a per-store language override in `site_settings`. All string keys are in a single `@letbuyy/checkout-i18n` package shared between the checkout platform and the merchant control plane.

### WhatsApp Order Confirmation

`whatsapp.ts` already defines an order confirmation template and an `abandoned_cart` template. The order confirmation message is dispatched via `queue-workers` on the `order.paid` domain event. In V1 this is present in the gateway but the queue consumer for WhatsApp delivery may not be wired end-to-end for all stores. Checkout 2.0 makes WhatsApp order confirmation a default on-by-default feature for all stores, gated only by the store having a WhatsApp sender number configured.

The post-purchase opt-in surface (§4) captures explicit WhatsApp marketing consent, satisfying TRAI requirements for promotional messages.

### EMI on Eligible Orders

Razorpay's EMI API (`/v1/payment-links` with `options.checkout.method.emi`) is surfaced as a payment method variant for orders above ₹3,000. EMI is not a separate payment provider — it is a Razorpay modal option. The checkout payment island shows an "EMI" tab alongside "UPI / Cards / NetBanking" when the cart qualifies. The qualifying threshold is configurable per store in merchant checkout settings.

### Delivery Date Selection

The shipping island in 2.0 renders estimated delivery dates alongside each rate: "Standard — Arrives 23–25 Jun", "Express — Arrives 21 Jun". In 2028, customers can select a preferred delivery date from the available range (constrained by carrier cut-off times). The selected date is stored as a preference on the order (`orders.metadata.preferred_delivery_date`) and passed to Shiprocket/Delhivery at fulfillment time. Date selection requires live carrier credential installation (`HR-CARRIER-LIVE`) and is therefore a 2028 target.

---

## 10. Migration and Backward Compatibility

### V1 Deprecation Plan

| Phase | Timeline | Action |
|---|---|---|
| Checkout 2.0 Alpha | Q4 2026 | Deploy checkout platform behind feature flag. New stores default to 2.0. |
| Checkout 2.0 Beta | Q1 2027 | Existing stores opt in via merchant settings. V1 and 2.0 coexist. |
| V1 Sunset Notice | Q3 2027 | V1 deprecated; stores given 90-day migration window. |
| V1 Removed | Q4 2027 | `checkout-client.tsx` removed from `storefront-runtime`. Storefront emits handoff URL only. |

### What Does Not Change

The following components are unchanged in Checkout 2.0 and do not require migration:

- `services/api-gateway` routes and RPCs — Checkout 2.0 is a new entry layer, not a gateway replacement.
- Canonical ledger RPCs (`create_checkout_order`, `confirm_order_payment_with_ledger`, etc.).
- `store_branding` and `site_settings` schemas.
- Merchant control plane payment settings UI.
- Razorpay adapter and HMAC verification logic.
- COD reconciliation system.
- Queue workers for order confirmation emails and WhatsApp.
- `identity-platform` and merchant JWT authentication.

---

## Appendix A: Gap Resolution Map

Each gap identified in the prior research documents and its resolution in Checkout 2.0:

| Gap (source doc) | Checkout 2.0 Resolution |
|---|---|
| `cart.abandonment_check` job enqueued but never consumed (09 §2) | New queue consumer wired; dispatches WhatsApp + email recovery |
| Zero checkout funnel events fired from `checkout-client.tsx` (09 §3) | 7-step event emission built into Checkout Platform Analytics Engine |
| No inbound Razorpay webhook receiver (03 §7, §10) | New `POST /v1/webhooks/razorpay` receiver in api-gateway; feeds `payment.failed` domain event |
| Placeholder pincode `'000000'` used at mount for shipping rates (02 §4) | Pincode-first address entry; shipping rates fetched on pincode change |
| No address autocomplete (09 §8.3) | Pincode → city/state auto-fill from India Post lookup |
| Checkout form state lost on reload (09 §8.7) | Session-based checkout state persisted server-side in `checkout_sessions` |
| COD has no pincode serviceability or value limits (03 §3) | Real-time COD availability check via `shipping_serviceability_rules` on pincode entry |
| `get_order_gst_invoice` endpoint BLOCKED (11 §1) | New `GET /v1/orders/:id/invoice` endpoint added |
| `enable_cod` MCP tool BLOCKED — no dedicated endpoint (11 §1) | New `PATCH /v1/stores/:storeId/settings/cod` endpoint added |
| `get_checkout_funnel_analytics` BLOCKED — no aggregation API (11 §1) | New `GET /v1/analytics/checkout-funnel?store_id=` endpoint built on per-step events |
| UPI schema-only stub, no route handler (03 §1) | New `POST /v1/checkout/:cartId/upi-intent` route handler |
| No Razorpay SDK tokenization at checkout (03 §10) | `tokenize: true` passed at checkout-order creation for returning customers |
| Branding API exists but not consumed by checkout UI (05, current state) | Branding Engine reads `store_branding` at session start; applies `--lb-*` tokens to checkout |
| No express checkout / buy-now path (09 §6) | New `POST /v1/storefront/:subdomain/buy-now` creates a single-item cart + handoff URL |
