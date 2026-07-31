# Executive Strategy — LetBuyy Checkout Platform

> Synthesis of docs 01–18. Research date: 2026-06-18. No code was modified.

---

## Executive Summary

LetBuyy's checkout is a 1,160-line monolithic `'use client'` component embedded inside
`storefront-runtime` with no funnel analytics, no server-side session, no branding pipeline,
and idempotency keys that vanish on page refresh — creating a live double-charge risk and
permanently invisible cart abandonment. The payment layer is architecturally sound (canonical
SECURITY DEFINER RPCs, HMAC-SHA256 Razorpay verification, server-authoritative amounts) but
has a critical gap: there is no inbound Razorpay webhook receiver, so any payment where the
browser tab closes after modal success produces a charged-at-Razorpay / unpaid-in-DB order
with no automated recovery path. The platform opportunity is large: the `checkout_sessions`
state machine is fully built in the gateway but blocked for live use, the branding API exists
but is never consumed by the checkout UI, and six merchant checkout-settings fields are stored
but silently ignored. The recommended path is a three-phase extraction — (1) harden the
existing component in-place and fix the five CERTAIN/CRITICAL/HIGH risks within 30 days;
(2) extract to `apps/checkout-platform` while activating the gateway session state machine in
days 31–60; (3) ship the branding pipeline, extensions framework, and first five MCP tools in
days 61–90. Executed in this order, the platform exits 90 days with a production-safe checkout,
full funnel visibility, store-branded payment pages, and a foundation for India-first features
(pincode-autocomplete, COD rules, UPI intent links) that will lift conversion measurably.

---

## Current State Scorecard

| Dimension | Current State | Score | Evidence |
|---|---|---|---|
| Checkout Completion | Two-step sequential flow, no server session, state lost on refresh, generic error messages | 5/10 | R025 (state loss), R008 (inventory race + generic errors), R016 (settings ignored); 01-02 |
| Payment Architecture | HMAC-SHA256 verified, server-authoritative amounts, canonical RPC ledger — but no inbound webhook receiver | 6/10 | R009 (no webhook receiver); 03 §7, §10 |
| Branding/Theming | Branding API (`GET /v1/stores/:storeId/branding`) built but never consumed by checkout; hardcoded `/logo.png` | 3/10 | 05, 12 §1, 13; checkout-client.tsx line 490 |
| Extensibility | Zero extension slots; sealed 1,160-line monolith; `extensionFunctions: []` always empty | 2/10 | 06 §3, 15; no composition points |
| AI/LCIS Readiness | LCIS cannot observe checkout; zero funnel events fired from checkout-client.tsx | 2/10 | R023, 09 §1, 10 §5 — dashboard shows "Not tracked" |
| MCP Readiness | 30 of 36 tools READY; 6 checkout-critical tools BLOCKED (funnel analytics, COD toggle, live payment intent, GST invoice) | 5/10 | 11 §1 |
| Conversion Optimization | No funnel tracking, no address autocomplete, no cart abandonment recovery, placeholder pincode '000000' | 2/10 | 09 §2–§3, R018, R021; cart abandonment consumer = 0% recovery |
| Security | Strong payment security core; 3 CRITICAL risks score 8+ (double-charge, cart hijack, COD fraud) | 5/10 | R001–R008; 17 top-5 |
| India-First | COD supported + risk scoring; GST invoices generated; no pincode serviceability, no COD value limits, no UPI intent | 5/10 | 03 §3, 07 §8, 16 §9; binary cod_enabled only |

---

## What We Know Now (Top 10 Facts)

1. **The gateway already has a complete hosted checkout state machine** (`checkout.ts`,
   `contact → delivery → payment_intent → completed | failed`) with HMAC-signed cart handoff,
   `checkout_sessions` persistence, and domain event emission — but it is blocked for live use
   by a `HR-MERCHANT-PSP-LIVE` comment at line 573. Centralization activates what is already
   built, not a greenfield build. (Sources: 01 §3, 02 §2, 12 §2, U020)

2. **Checkout settings are stored but never consumed** — all six merchant-configured fields
   (`contact_method`, `customer_accounts`, `full_name`, `company_name`, `order_notes`,
   `tip_option`) write to `site_settings.checkout` but `page.tsx` never reads them. Merchants
   believe they have set mandatory fields that have zero effect. This is a CERTAIN HIGH-severity
   risk with a one-day fix. (Source: R016, 14 §1)

3. **Cart abandonment recovery is completely broken** — `enqueueAbandonmentCheck()` writes
   a `cart.abandonment_check` job to `platform_queue_jobs` but there is no consumer anywhere
   in `queue-workers`. The `abandoned_cart` WhatsApp template exists but has no trigger.
   Every cart abandonment event is silently discarded; recovery rate is exactly 0%. (Source:
   R021, 09 §2, 16 Appendix A)

4. **No inbound Razorpay webhook receiver exists** — payment confirmation is entirely
   client-initiated. If the browser tab closes after the Razorpay modal succeeds but before
   `POST /payments/razorpay/verify` completes, the order stays `payment_status: 'pending'`
   indefinitely, inventory remains reserved, and the merchant never fulfils. This is a launch
   blocker for live Razorpay traffic. (Source: R009, 03 §7, U002)

5. **Payment failure leaves inventory locked forever** — when Razorpay fires `payment.failed`,
   the client resets `isProcessing` but no server call releases the inventory reservation.
   The `record_order_payment_failure_with_ledger` RPC exists but is only reachable via the
   webhook path that has no receiver. CERTAIN to occur in production; every failed payment
   locks stock. (Source: R011)

6. **The branding pipeline is built but unwired** — `GET /v1/stores/:storeId/branding`
   returns `primary_color`, `logo_url`, `accent_color`, and `checkout_theme`. The checkout
   `page.tsx` server component passes only `storeName` — no brand colors, no logo URL. The
   Razorpay modal `image` field is hardcoded to `/logo.png`. Every store's checkout looks
   identical regardless of brand configuration. (Source: 05, 12 §1, 13, R016)

7. **Checkout has zero funnel observability** — not a single analytics event is fired from
   `checkout-client.tsx`. The merchant dashboard shows "Conversion Rate: Not tracked". LCIS
   cannot detect payment failure spikes, abandonment surges, or address-step drop-off because
   there is no data. Seven steps, zero instrumented. (Source: R023, 09 §1–§4)

8. **COD has a real fraud vector via merchant-controlled delivery confirmation** — a merchant
   can call `PATCH /v1/orders/:id` with `status: 'delivered'` at any time, which sets
   `payment_status=paid` and emits `order.paid` without physical delivery or COD reconciliation
   confirmation. No guard requires a `cod_reconciliation_entries` row in `collected` state
   before accepting `delivered`. (Source: R007)

9. **The placeholder pincode `'000000'` creates cascading problems** — COD serviceability is
   never checked against the real pincode, so COD is offered to customers in restricted zones.
   Shipping rate displays are inaccurate before address entry. When the real pincode is entered,
   rates are not re-fetched. This is the root cause of R008, R012, and the shipping zone
   unenforcement in R020. One fix (re-fetch rates on pincode blur) resolves all three. (Source:
   R008, R012, R020, 02 §4)

10. **`apps/checkout` is a forbidden name** — CLAUDE.md line 34 explicitly lists it as a
    deprecated runtime alias. Any new checkout app must use `apps/checkout-platform` or the
    reserved `services/checkout-runtime` (requires ARB scope approval). The governance validator
    will reject a new `apps/checkout` directory at the gate. (Source: 12 §10, CLAUDE.md line 34)

---

## Day 1-30: Foundation

### Must Do (Immediate — blocks everything else)

---

**Initiative:** Wire checkout settings to the checkout UI
**Why Now:** Merchants are paying for and configuring `customer_accounts`, `contact_method`,
`company_name`, `order_notes`, and `tip_option` — none of these settings have any effect on the
live checkout. This is a CERTAIN HIGH-severity trust violation. Merchants who discover their
compliance settings are ignored will escalate immediately. Score: 12 (HIGH × CERTAIN).
**Required Work:**
- `apps/storefront-runtime/src/app/store/[subdomain]/checkout/page.tsx` — add read of
  `store.siteSettings?.checkout`, pass as `checkoutConfig` prop to `CheckoutClient`.
- `checkout-client.tsx` — consume `checkoutConfig` to conditionally show/hide company name
  field, enforce contact method (email/phone/both), show/hide order notes textarea, show tip
  option when enabled.
**Expected Outcome:** Merchants' configured checkout settings take effect. `customer_accounts:
required` blocks guest checkout. B2B merchants who need GSTIN capture or company name can
enforce it. Zero merchant escalations about dead settings.
**Risk:** LOW — additive prop flow with no gateway or DB changes.

---

**Initiative:** Move idempotency keys to sessionStorage + derive from cart token
**Why Now:** Idempotency keys live in `useRef` and vanish on page refresh. A customer who
refreshes mid-payment generates a new key and can create a second Razorpay order from the
same cart. Two captured payments from the same cart = double charge. Score: 8 (CRITICAL ×
POSSIBLE). This is the fastest path to eliminating the double-charge risk.
**Required Work:**
- `checkout-client.tsx` — replace `useRef<Record<string, string>>({})` with read/write to
  `sessionStorage` keyed by `lb_cart_token`. On mount, restore keys from sessionStorage.
- Derive the base idempotency key from `lb_cart_token` (e.g. `{cartToken}-order-{paymentMethod}`)
  so the same cart always produces the same key on retry.
- Add a DB-level `UNIQUE` constraint on `(site_id, session_id, payment_method)` on the
  `orders` table as a secondary guard (gateway change, requires migration).
**Expected Outcome:** Page refresh during payment reuses the same idempotency key. Second order
creation from the same cart is rejected by the DB constraint. Double-charge risk eliminated.
**Risk:** LOW for sessionStorage change. MEDIUM for the DB constraint (requires migration +
governance validation run).

---

**Initiative:** Implement inbound Razorpay webhook receiver
**Why Now:** Without a server-side webhook fallback, any browser crash or network drop after
the Razorpay modal closes leaves a paid-at-Razorpay / unpaid-in-DB order permanently. This
is a launch blocker before enabling Razorpay live keys at scale. Score: 9 (HIGH × LIKELY).
Also fixes inventory lock from payment failures (R011, score 12).
**Required Work:**
- `services/api-gateway/src/routes/` — add `POST /v1/webhooks/razorpay` route. Verify
  `X-Razorpay-Signature` header using HMAC-SHA256 with `RAZORPAY_WEBHOOK_SECRET` env var.
  For `payment.captured` events: call `POST /storefront/internal/payments/confirm`.
  For `payment.failed` events: call `POST /storefront/internal/payments/failure` with
  `p_release_inventory: true`.
- Register the webhook URL in the Razorpay dashboard (operator action, `[HUMAN-REQUIRED]`).
- `services/queue-workers/` — add a 15-minute background cleanup job that scans for
  `status=pending AND payment_method != 'cod' AND created_at < now() - interval '15 minutes'`
  and calls `record_order_payment_failure_with_ledger` with `p_release_inventory: true`.
**Expected Outcome:** No orphaned paid-at-Razorpay / unpaid-in-DB orders. Inventory released
within 15 minutes of any payment failure. Razorpay live mode is safe to enable at scale.
**Risk:** MEDIUM — new gateway route touches security boundary. Requires HMAC secret setup
and Razorpay dashboard configuration (operator dependency).

---

**Initiative:** Fix pincode placeholder and re-fetch shipping rates on real pincode entry
**Why Now:** The hardcoded `pincode: '000000'` at mount time means COD serviceability is never
checked against the customer's real address. COD is offered to customers in restricted zones.
Shipping rates shown before address entry may not apply to the real pincode. This is the root
cause of three separate risk items (R008, R012, R020). Score: R008 = 12 (CRITICAL × LIKELY).
**Required Work:**
- `checkout-client.tsx` — on pincode field `blur` (or on 6-digit completion), call
  `GET /api/shipping/serviceability/:pincode?store_id=` and update `codEnabled` state based
  on `cod_available` in the response. Re-fetch `POST /api/shipping/rates` with the real pincode
  and update `storeRates`.
- `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts` — in
  `create_checkout_order` handling, add server-side validation: if `payment_method=cod`,
  check `shipping_serviceability_rules.cod_available` for the order's pincode.
- Return typed error codes from the gateway (`INSUFFICIENT_STOCK`, `COD_UNAVAILABLE`,
  `SHIPPING_UNAVAILABLE`) instead of generic 400 + message.
- `checkout-client.tsx` — map typed errors to user-friendly messages.
**Expected Outcome:** COD is hidden for restricted pincodes before the customer reaches
payment. Out-of-stock errors show "This item is out of stock" instead of "Order creation
failed." Shipping rate displayed accurately reflects the customer's location.
**Risk:** LOW — UI-layer changes + one server-side validation addition. No DB schema change.

---

**Initiative:** Wire the cart abandonment consumer
**Why Now:** Every cart abandonment since launch has been silently discarded. The recovery
rate is exactly 0%. The `abandoned_cart` WhatsApp template exists in `whatsapp.ts`. The
queue job is enqueued but there is no consumer. India commerce benchmarks show 3–8% WhatsApp
abandonment recovery. Score: R021 = 8 (MEDIUM × CERTAIN).
**Required Work:**
- `services/queue-workers/src/platform-queue-consumer.ts` — add handler for
  `job_type: 'cart.abandonment_check'`. Handler reads the cart, checks whether an order was
  subsequently placed (`orders.cart_token = cartToken`), and if not dispatches:
  (a) recovery email via Resend using the existing `buildOrderConfirmationEmail` pattern, and
  (b) WhatsApp message via the existing `abandoned_cart` template in `whatsapp.ts` (opt-in
  only; requires merchant to have WhatsApp sender configured).
- Add a TTL policy on `platform_queue_jobs` to prevent unbounded table growth from
  unprocessed historical abandonment jobs.
**Expected Outcome:** Cart abandonment recovery begins operating for the first time. Revenue
recovery from historically abandoned carts. Queue table stops accumulating dead-letter entries.
**Risk:** LOW — additive worker code path; no gateway or DB schema changes.

---

### Should Do (High value, low risk)

---

**Initiative:** Add 7-step checkout funnel analytics events
**Why Now:** The merchant dashboard shows "Conversion Rate: Not tracked." LCIS cannot observe
checkout. Zero funnel events in 1,160 lines of checkout code. Score: R023 = 4 (LOW × CERTAIN),
but the downstream value (enables AI-driven incident detection) is disproportionately high.
**Required Work:**
- `checkout-client.tsx` — add analytics calls at 7 steps: `checkout.session_started`
  (mount), `checkout.contact_entered` (Step 1 continue click), `checkout.address_entered`
  (form valid), `checkout.shipping_selected` (rate click), `checkout.payment_method_selected`
  (radio change), `checkout.payment_initiated` (Pay button click), `checkout.completed`
  (success screen), `checkout.abandoned` (page unload with incomplete step).
- Route events through the existing Cloudflare Analytics Engine infrastructure used by
  `storefront.checkouts.started`.
**Expected Outcome:** Full funnel visibility. Merchant dashboard shows step-level conversion.
LCIS can detect payment failure spikes and abandonment surges autonomously.
**Risk:** LOW — additive only; no existing logic modified.

---

**Initiative:** Rate-limit public checkout endpoints and add Turnstile to order creation
**Why Now:** `POST /api/orders`, `GET /api/orders/check`, and `POST /api/shipping/rates` are
public unauthenticated endpoints with no rate limiting. A bot can create thousands of pending
orders, locking inventory. R010 (guest enumeration) score 9. R028 (order creation spam).
**Required Work:**
- `services/api-gateway` middleware — add Cloudflare rate limiting: max 5 `POST /api/orders`
  per IP per minute. Max 5 `GET /api/orders/check` per IP per minute per subdomain.
- Add Turnstile token validation on `POST /api/orders` (Turnstile is already used for
  registration/login per CLAUDE.md).
**Expected Outcome:** Bot-driven inventory lock attacks are blocked. Guest PII enumeration
requires CAPTCHA. DPDP Act exposure reduced.
**Risk:** LOW — Turnstile is already integrated; rate limiting is additive middleware.

---

**Initiative:** Surface store branding in checkout (logo, primary color)
**Why Now:** The branding API (`GET /v1/stores/:storeId/branding`) is fully built and returns
`logo_url`, `primary_color`, `accent_color`, `checkout_theme`. Zero lines of checkout code
consume it. Every store shows the same generic LetBuyy-styled checkout regardless of brand.
Score: 3/10 for branding (scorecard above).
**Required Work:**
- `apps/storefront-runtime/src/app/store/[subdomain]/checkout/page.tsx` — add server-side
  fetch of `GET /v1/stores/{storeId}/branding`. Pass `logoUrl`, `primaryColor`,
  `checkoutTheme` as props to `CheckoutClient`.
- `checkout-client.tsx` — replace hardcoded `/logo.png` with `logoUrl` prop. Replace
  hardcoded `var(--primary, rgb(99 102 241))` button color with `primaryColor` prop injected
  as a CSS variable override. Pass `keyId: ..., image: logoUrl` to the Razorpay modal options.
**Expected Outcome:** Every store's checkout shows its own logo and primary brand color.
Razorpay modal shows the store logo. Brand consistency from browse to payment.
**Risk:** LOW — server-side fetch in existing server component + prop pass-through.

---

## Day 31-60: Centralization

### Checkout Extraction Phase

**Goal:** Decouple `checkout-client.tsx` from `storefront-runtime` internal dependencies
without changing the live URL or deployment.

The five couplings blocking extraction (from doc 12 §1):
1. `useCart` from `@/context/cart-context` — inject `{items, cartTotal, clearCart, cartToken}`
   as props from `page.tsx` instead.
2. Same-origin API proxies (`/api/orders`, `/api/shipping/rates`, etc.) — make the API base
   URL configurable via an injected `checkoutApiBase` prop.
3. CSS token coupling (`card-theme`, `input-theme`, etc.) — these resolve once checkout
   imports from `@letbuyy/ui` directly rather than relying on storefront-runtime globals.
4. `StorefrontEmptyState` from `@/components/storefront/storefront-states` — replace with a
   generic `CheckoutEmptyState` in `packages/checkout-core`.
5. Hardcoded `/logo.png` — resolved by the branding initiative above (Day 1-30).

**Steps:**
1. Scaffold `packages/checkout-core` (confirm it does not exist: `ls packages/checkout-core`).
   Move `buildOrderPayload`, form validation logic, and idempotency key utilities into the
   package. No business logic changes — pure extraction.
2. Run `node scripts/validate-governance.mjs` after creating the package.
3. Decouple `useCart` import: update `page.tsx` to read cart state from the CartContext
   provider and pass as props. `CheckoutClient` no longer imports from `@/context/cart-context`.
4. Replace `@/components/storefront/storefront-states` import with `CheckoutEmptyState` from
   `packages/checkout-core`.
5. Make API proxy base configurable: extract `storefrontBrowserApiFetch` calls into a
   `CheckoutApiClient` class injected via context, pointing to same-origin `/api/*` for now.
6. Persist `formData` and idempotency keys to `sessionStorage` (completes the R001/R025 fix
   started in Day 1-30 for the refresh-safe session goal).

After these six steps, `CheckoutClient` has no imports from `@/context/*`,
`@/components/storefront/*`, or `@/lib/api/browser-client`. It can run in any Next.js app
that injects the required props.

### Branding Pipeline

**Goal:** Get `--lb-*` design tokens flowing from the branding API to the checkout UI.

The `GET /v1/stores/:storeId/branding` endpoint returns `primary_color`, `accent_color`,
`border_radius`, `font_family`, and a `tokens` JSONB with additional overrides. The checkout
`page.tsx` server component fetches this data; the server component injects a `<style>` block
into the `<head>` at render time:

```html
<style>
  :root {
    --lb-primary: #1a56db;
    --lb-accent: #f59e0b;
    --lb-radius: 8px;
  }
</style>
```

Color values must be validated against strict hex/rgb patterns before injection (R019
mitigation — prevent CSS injection via merchant-controlled branding). Use the
`assertBrandingIsDataOnly` function already in `checkout.ts` as the validation layer.

The checkout component uses `var(--lb-primary)` and `var(--lb-accent)` for button colors,
focus rings, and selected-state indicators. This requires a one-time sweep of `checkout-client.tsx`
to replace hardcoded Tailwind color classes with `--lb-*` token references via inline style or
a CSS variable injection pattern consistent with `@letbuyy/ui`.

### Extensions Framework

**Goal:** Ship the first three built-in extensions using the slot infrastructure defined in
doc 15, without opening third-party extensions (that requires ARB security review per U016).

Built-in extension slots to activate in this phase:

**Extension 1: Gift Wrap Toggle (Slot: `above_order_summary`)**
- Backend: `create_checkout_order` RPC already accepts `p_notes`; gift wrap can be a
  line-item note.
- Frontend: a simple toggle rendered above the order summary. If selected, adds "Gift wrap"
  to the order notes and appends a `gift_wrap_fee_minor` to the order total.
- Prerequisite: resolve U008 (gift card + split payment behaviour) to confirm zero-amount
  Razorpay edge case handling before shipping gift card or free gift-wrap path.

**Extension 2: GST Invoice Field (Slot: `below_contact`)**
- Show a "GST Number (optional)" input field for B2B buyers.
- Pass `gstNumber` in the order payload; `create_checkout_order` RPC already accepts it
  and triggers invoice generation.
- Gate on merchant having `sites.gstin` set (only relevant for GST-registered merchants).

**Extension 3: Order Notes (Slot: `above_payment`)**
- A collapsible "Add delivery instructions" textarea.
- Controlled by the `order_notes` setting from `site_settings.checkout` (now consumed after
  Day 1-30 fix).
- Passes `notes` to the order payload.

These three extensions use no sandbox or postMessage — they are first-party UI rendered
directly in the checkout form, toggled by merchant settings. Third-party iframe extensions
remain deferred until the security review (U016) is complete.

---

## Day 61-90: AI-Native Checkout

### LCIS Integration

**Goal:** Connect the 7-step funnel events (shipped in Day 1-30) to LCIS detection and
the decision engine, enabling autonomous checkout monitoring.

Specific tools to build in `services/api-gateway/src/routes/analytics.ts` (or extend the
existing analytics infrastructure):

**Checkout Funnel API** (`GET /v1/analytics/checkout-funnel?store_id=&period=7d`):
Aggregates the 7 funnel events from Cloudflare Analytics Engine. Returns step-level counts
and conversion rates. Powers the merchant dashboard "Checkout Funnel" card. Resolves the
BLOCKED `get_checkout_funnel_analytics` MCP tool gap (11 §1).

**Checkout Incident Detection** (extend existing `/api/detection` in LCIS):
Wire two new detectors to the funnel event stream:
1. Payment failure spike: `payment.failed` events > 3x 7-day rolling average in 15 minutes →
   alert via LCIS `/api/incident-intelligence?domain=payments`.
2. Address-step drop-off: address step exit rate > 40% → flag in `/api/decision-engine` as
   a conversion blocker with "Enable pincode autocomplete" as the recommended action.

**`/api/checkout-intelligence`** (new LCIS endpoint):
Returns: current funnel conversion rates (connected to Analytics Engine), top drop-off step,
payment method mix, COD delivery realisation rate from `cod_reconciliation_entries`, and
payment failure reasons from Razorpay callbacks. Feeds the Merchant OS
(`/api/merchant-ops`).

### MCP Tools

The following five tools are the highest-priority unblocks from the 6 BLOCKED tools in
doc 11 §1:

| Tool | Gateway Endpoint | Unblocks |
|---|---|---|
| `get_checkout_funnel_analytics` | `GET /v1/analytics/checkout-funnel` | Funnel visibility for AI agents and merchant UI |
| `enable_cod_with_rules` | `PATCH /v1/stores/:storeId/settings/cod` (new endpoint with `max_order_minor`, `blocked_pincodes`) | COD serviceability configuration without manual DB edit |
| `update_payment_providers` | `PATCH /v1/stores/:storeId/payment-config` (extend existing endpoint) | Autonomous payment method toggling by LCIS |
| `get_order_gst_invoice` | `GET /v1/orders/:id/invoice` (new endpoint reading `orders.gst_invoice`) | B2B GST invoice access for merchants and agents |
| `create_payment_intent` | `POST /v1/storefront/:subdomain/payments/razorpay/order` (already exists — unblock by adding MCP auth scope) | Live payment intent creation by agents in test mode |

Each MCP tool maps 1:1 to an existing or new gateway endpoint. The tools are documented in
`.claude/commands/` following the existing agent command pattern in the repository.

### Conversion Improvements

**Top 3 changes with projected impact:**

**1. Pincode-first address autocomplete (estimated +15–25% address-step conversion)**
On pincode field completion (6 digits entered), call a lightweight BFF route
`GET /api/checkout/pincode/:pincode` that returns `{ city, state, district }` from a cached
India Post pincode lookup table. Auto-fill city and state fields. Simultaneously call
`GET /v1/shipping/serviceability/:pincode?store_id=` to confirm COD availability and update
displayed shipping rates in real time.

This resolves U025, R018, R012, and the `'000000'` placeholder in one change.
The India Post pincode dataset is public and can be bundled as a static lookup without an
external API dependency.

**2. Razorpay SDK preload during address entry (estimated −1–2s payment initiation time)**
Move the Razorpay `<Script src="...">` load from `afterInteractive` to begin during Step 1
address entry. By the time the customer reaches Step 2 payment, the SDK is already loaded.
The `razorpayLoaded` gate that currently disables the Pay button while the SDK loads becomes
irrelevant. Add a `razorpayLoadTimeout` (5 seconds): if the SDK has not loaded, show "Payment
SDK unavailable — try COD or refresh" rather than a permanently disabled button (U027).

**3. Saved payment method pre-selection + payment method deep-link (estimated +5–10% payment step conversion)**
For returning customers with a prior order using Razorpay, pre-select Razorpay as the default
and show the last-used payment method type (UPI / Card / NetBanking) as a hint. Pass
`tokenize: true` in the Razorpay order creation call for authenticated customers, enabling
one-click payment on subsequent purchases (addresses the tokenization gap in 03 §10).

---

## Critical Path

```
Fix idempotency keys (sessionStorage + cart-token-derived)
  → Fix placeholder pincode + typed error codes
    → Wire checkout settings to UI
      → Implement Razorpay webhook receiver
        → Wire cart abandonment consumer
          → Add 7-step funnel events
            → Scaffold packages/checkout-core
              → Decouple checkout-client.tsx from storefront-runtime internals
                → Wire branding API to checkout page.tsx
                  → Scaffold apps/checkout-platform
                    → Activate hosted checkout state machine (clear HR-MERCHANT-PSP-LIVE)
                      → Ship branding pipeline (--lb-* tokens)
                        → Ship 3 built-in extensions
                          → Ship checkout funnel MCP tool
                            → Ship enable_cod_with_rules MCP tool
                              → Ship pincode autocomplete
```

---

## Decisions That Must Be Made First

| Decision | Options | Deadline | Owner |
|---|---|---|---|
| Checkout URL strategy for centralization | A: no URL change (same `/store/{subdomain}/checkout`); B: `{store}.letbuyy.com/checkout`; C: `checkout.letbuyy.com/{store}` | Before Day 31 — blocks all centralization scaffold work | Product + ARB |
| Checkout session token issuer | Reuse identity-platform ES256 JWKS; OR new short-lived HS256 checkout-specific JWT scoped to `(site_id, cart_id)` | Before Day 31 — blocks Phase 2 session design | ARB (security) |
| COD rules for V1 launch | Binary `cod_enabled` toggle only (faster) OR add `cod_rules` config with `max_order_minor` + `blocked_pincodes` before launch | Before Day 30 — COD in production without value limits creates RTO exposure | Product |
| `HR-MERCHANT-PSP-LIVE` blocker resolution | Read `checkout.ts` lines 560–590 to determine: feature flag, missing env var, or TODO comment | Before Day 31 — blocks activating the hosted checkout state machine in Phase 2 | Engineering lead (U020) |
| Inbound webhook receiver location | Add to api-gateway alongside payment routes; OR expand webhook-service | Before Day 14 — blocks the Razorpay webhook receiver implementation | Engineering lead |

---

## What NOT to Build Next

| Initiative | Why Not Now | What Must Happen First |
|---|---|---|
| Third-party checkout extensions (app marketplace) | The sandbox policy is design-only; no security review has been completed. A single postMessage validation bug in the checkout flow is catastrophic — PII exfiltration, payment data exposure. U016 requires a 2-day formal security review before any external extension runs in checkout. | Formal security review of postMessage contract and CSP policy (U016). ARB sign-off. Only then open the marketplace extension SDK. |
| UPI intent deep-links (PhonePe/GPay/Paytm) | The `V1PaymentProviderSchema` enumerates `'upi'` but there is no route handler. Building UPI intent requires a new `POST /v1/checkout/:cartId/upi-intent` route + Razorpay UPI intent API integration + mobile deep-link handling. This is a 2028 target in doc 16 and requires the centralized checkout platform (Phase 2+) to be deployed first so the URL origin is stable for Razorpay UPI configuration. | Complete checkout extraction (Phase 2). Activate hosted state machine. Confirm stable checkout origin URL with Razorpay. |
| Vernacular checkout (Hindi/Tamil/Telugu) | No i18n infrastructure exists yet (`@letbuyy/checkout-i18n` package is a design proposal). Building locale packs on top of the current 1,160-line monolith without first extracting it will create a maintenance burden. | Complete checkout extraction to `packages/checkout-core`. Scaffold `@letbuyy/checkout-i18n`. Then add locale packs. Hindi-first is the right priority order when ready. |
| Saved cards via Razorpay tokenization for all customers | Tokenization requires authenticated checkout sessions (the customer must be identified to save a token against). The current checkout has no server-side session. Tokenization without a session is only safe for explicit opt-in flows and requires PCI DSS review of the tokenization storage path. | Complete Phase 2 (server-side checkout session activated). Add customer auth to checkout session. Then enable tokenization for logged-in customers only. |

---

## 90-Day Roadmap Table

| Week | Initiative | Deliverable | Success Metric | Owner |
|---|---|---|---|---|
| 1 | Wire checkout settings to UI | `checkoutConfig` prop consumed in `checkout-client.tsx` | 6 merchant settings take live effect; confirmed in staging | Engineering |
| 2 | Idempotency keys to sessionStorage | Keys persist across refresh; derived from cart token | Manual test: refresh mid-payment = same key reused | Engineering |
| 3 | Razorpay webhook receiver | `POST /v1/webhooks/razorpay` live in gateway | Razorpay test webhook fires + payment confirmed server-side | Engineering |
| 4 | Fix pincode placeholder + typed errors | Real-time COD check on pincode entry; typed error codes | COD hidden for restricted pincodes; stock error = specific message | Engineering |
| 5 | Razorpay payment failure inventory release | Background job releases inventory after 15 min on failed payments | Zero long-lived pending-payment inventory locks in staging | Engineering |
| 6 | Wire cart abandonment consumer | Queue worker consumes `cart.abandonment_check` | Recovery email dispatched for test abandonment; WhatsApp opt-in path live | Engineering |
| 7 | 7-step funnel analytics events | All 7 events fire in Cloudflare Analytics Engine | Merchant dashboard shows funnel data for test checkout sessions | Engineering |
| 8 | Rate limiting + Turnstile on order creation | Cloudflare rate limit + Turnstile token on `POST /api/orders` | Bot order creation blocked at rate limit threshold | Engineering |
| 9 | Scaffold `packages/checkout-core` + decouple checkout | No `@/context/*` or `@/components/storefront/*` imports in checkout-client.tsx | Governance validator passes; checkout renders from injected props | Engineering |
| 10 | Wire branding API + --lb-* token injection | `page.tsx` fetches branding; checkout shows store logo + primary color | 3 stores visually differentiated in staging | Engineering |
| 11 | Ship 3 built-in extensions + activate settings | Gift wrap toggle, GST field, order notes extensions live | Merchant enables gift wrap in settings; checkout shows toggle | Engineering |
| 12 | Ship 5 MCP tools + checkout funnel API | `get_checkout_funnel_analytics`, `enable_cod_with_rules`, `update_payment_providers`, `get_order_gst_invoice`, `create_payment_intent` unblocked | LCIS can query funnel; COD rules configurable via MCP | Engineering |

---

## Expected Outcomes

**Day 30:** Five CERTAIN/HIGH/CRITICAL risks resolved. Merchant settings live in checkout.
Idempotency keys durable. Razorpay webhook receiver active. Cart abandonment recovery live
(0% → ~3–5% recovery rate). Inventory no longer locked by failed payments. Checkout has
full funnel observability for the first time.

**Day 60:** Checkout component decoupled from `storefront-runtime` internals and importable
as a standalone unit. Branding pipeline active — every store's checkout shows its logo and
brand color. Three built-in extensions shipped. COD serviceability checked against real
pincodes. Shipping rates re-fetched on address entry. Platform structurally ready for
`apps/checkout-platform` scaffold (pending URL strategy ARB decision).

**Day 90:** Five MCP tools unblocked — LCIS can autonomously detect payment failures,
configure COD rules, and query checkout funnel data. Pincode autocomplete live — India Post
lookup auto-fills city/state, estimated +15–25% address-step conversion uplift. Razorpay SDK
preloaded during address entry — payment initiation time reduced by 1–2 seconds. Foundation
for `apps/checkout-platform` Phase 2 deployment established.

---

*Document: `/Users/saai_sidd/Git/Letbuyy_Store/docs/checkout-research/19-executive-strategy.md`*
*Sources: docs/checkout-research/01 through 18, CLAUDE.md, checkout-client.tsx,
checkout.ts (gateway), checkout-payment-routes.ts, payment-execution.adapter.ts,
order-execution.adapter.ts, internal-payment-routes.ts, cart-routes.ts,
cod-reconciliation.ts, store-payment-config.ts, order-risk.ts*
