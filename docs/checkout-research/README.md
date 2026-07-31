# LetBuyy Checkout Platform — Research Index

> Master index for the checkout platform research corpus (19 documents, 2026-06-18).
> All findings are grounded in static code analysis of the live repository.
> No production code was modified during this research.

---

## Quick Navigation

| # | Document | Key Findings |
|---|---|---|
| 01 | [Checkout System Inventory](#01-checkout-system-inventory) | 1,160-line monolithic `checkout-client.tsx` in `storefront-runtime`; two parallel checkout paths (storefront direct + gateway hosted); 5 storefront BFF proxy routes; 3 payment paths (Razorpay, COD, Cashfree routes-only) |
| 02 | [Checkout Flow Audit](#02-checkout-flow-audit) | Two-step `useState` wizard, no URL routing between steps, no server session; Razorpay flow is 10-step client-initiated; COD is 7-step; success rendered inline (no redirect); form state lost on reload |
| 03 | [Payment Architecture](#03-payment-architecture) | Server-authoritative amounts with AMOUNT_MISMATCH 400 guard; `timingSafeEqualHex` HMAC-SHA256 Razorpay verification; `IdempotencyExecutionAdapter` with DB claims; AES-GCM encrypted per-merchant Razorpay keys; no inbound webhook receiver for any provider |
| 04 | [Checkout UI Architecture](#04-checkout-ui-architecture) | Pure `'use client'` React, zero Liquid; server component passes only 5 props (no logo, no brand colors); 3 elements hardcoded (COD button `rgb(22 163 74)`, online button `rgb(26 26 46)`, Razorpay modal `rgb(99 102 241)`); mobile-first `grid-cols-1 lg:grid-cols-3` |
| 05 | [Checkout Branding Analysis](#05-checkout-branding-analysis) | Branding API (`GET /v1/stores/:storeId/branding`) is fully built but never consumed; store logo not rendered anywhere in checkout body; 6 branding elements are wrong/missing; CSS variable inheritance works for embedded checkout but would break if extracted |
| 06 | [Checkout Extensibility Analysis](#06-checkout-extensibility-analysis) | Zero extension architecture; `extensionFunctions: []` is a permanent stub at `checkout-payment-routes.ts:430`; gift cards and order notes are API-ready but have no UI; no hook points, no event emissions, no feature flags |
| 07 | [Order Platform Analysis](#07-order-platform-analysis) | 40+ field order entity with risk_score, cod_confirmation_status, gst_invoice; 8-state machine; monthly quota check before creation; `completeOrderPostCommitWork` for GST invoice + usage meter; 6-signal risk scoring triggers `pending_cod` |
| 08 | [Shipping Platform Analysis](#08-shipping-platform-analysis) | `liveLogisticsProviderAvailable()` hardcoded `false` — all labels sandbox-only; `'000000'` placeholder pincode at checkout mount; zone-to-checkout matching not implemented; weight not summed from products; 10 missing shipping capabilities |
| 09 | [Conversion Analysis](#09-conversion-analysis) | Zero tracking calls in `checkout-client.tsx`; cart abandonment consumer never implemented (job enqueued, zero matches in queue-workers); dashboard hardcodes "Not tracked" for Conversion Rate; 8 conversion gaps identified |
| 10 | [LCIS Checkout Analysis](#10-lcis-checkout-analysis) | 30 MCP tools READY; 3 PARTIAL; 6 BLOCKED (funnel analytics, COD toggle, live payment intent, GST invoice, abandonment report, bulk cancel); 9 LCIS tool candidates; COD and Razorpay failure detection callable |
| 11 | [MCP Readiness Analysis](#11-mcp-readiness-analysis) | Complete MCP tool registry with input schemas, gateway calls, and ready/partial/blocked assessments for all 36 tools; auth strategy: ES256 merchant JWT + `verifySiteOwnership`; recommended 3-domain starter bundle (coupons + orders + shipping = 17 tools) |
| 12 | [Centralized Checkout Platform Design](#12-centralized-checkout-platform-design) | 5 storefront-runtime couplings block extraction; 3-phase URL strategy (no change → `{store}.letbuyy.com/checkout` → `checkout.letbuyy.com/{store}`); HMAC cart handoff already built in `cart-routes.ts`; `checkout_sessions` state machine already implemented in gateway; governance requires `apps/checkout-platform` (not `apps/checkout`) |
| 13 | [Checkout Branding Platform Design](#13-checkout-branding-platform-design) | `CheckoutBrandPayload` interface with 20 tokens + `razorpay_theme_color` + `primary_color_raw` explicit fields; 3 concrete brand examples (Electra/blue, Velvet/near-black luxury, Harvest/green food); server-side inline `<style>` injection recommended (zero FOUC); `google_fonts_required[]` array for custom font preloading |
| 14 | [Checkout Editor Architecture](#14-checkout-editor-architecture) | All 6 merchant checkout settings stored but never consumed (CERTAIN HIGH risk); simulated preview panel (not iframe) recommended; direct mutation save model (no versioning like theme editor); settings live in existing `sites.site_settings.checkout` JSONB (no new table needed) |
| 15 | [Checkout Extensions Platform Design](#15-checkout-extensions-platform-design) | 9 named slot positions mapped to current `checkout-client.tsx` structure; 3-tier extension model (LetBuyy native / merchant-configured / third-party iframe); `CheckoutExtensionContext` data contract; Tier 1 (trust badges, order notes, gift card, announcement) requires only `ALTER TABLE sites ADD COLUMN checkout_extensions JSONB` |
| 16 | [Future State Checkout 2.0](#16-future-state-checkout-20) | 2028 target: `checkout.letbuyy.com/{store}`, <1s LCP, UPI intent links, pincode-first address, 7-step funnel events, cart abandonment recovery; 8 design principles; 25-item gap resolution map; 4-phase V1 deprecation timeline (Q4 2026 alpha → Q4 2027 V1 removed) |
| 17 | [Risks Register](#17-risks-register) | 26 risks (8 CRITICAL, 8 HIGH, 6 MEDIUM, 4 LOW); top 5 by score: R008 inventory race (12), R011 payment failure inventory lock (12), R016 settings never consumed (12), R009 no Razorpay webhook receiver (9), R010 guest order enumeration (9) |
| 18 | [Unknowns Register](#18-unknowns-register) | 33 unknowns; 10 critical (block centralization); top unknowns: cart localStorage vs server `carts` table authority (U001), Razorpay webhook existence in webhook-service (U002), checkout URL strategy decision (U006), `HR-MERCHANT-PSP-LIVE` blocker nature (U020) |
| 19 | [Executive Strategy](#19-executive-strategy) | 90-day 3-phase plan; Day 1-30: 5 CERTAIN/CRITICAL risks fixed; Day 31-60: extraction + branding pipeline + 3 extensions; Day 61-90: 5 MCP tools unblocked + pincode autocomplete + LCIS integration; critical path from idempotency keys → full checkout platform |

---

## Executive Summary

LetBuyy's checkout is a 1,160-line monolithic `'use client'` component embedded inside `storefront-runtime` that processes real Razorpay and COD payments for live merchants today. The payment architecture is fundamentally sound: all money mutations flow exclusively through SECURITY DEFINER Postgres RPCs (`create_checkout_order`, `confirm_order_payment_with_ledger`), amounts are server-authoritative with a 400 AMOUNT_MISMATCH guard when clients supply amounts, and Razorpay signature verification uses constant-time HMAC-SHA256 via `timingSafeEqualHex`. The canonical ledger pattern that prevents money-table direct writes in TypeScript is correctly enforced. However, a cluster of critical gaps sits on top of this sound foundation, each directly impacting live revenue and merchant trust.

The most urgent gap is the absence of an inbound Razorpay webhook receiver. Payment confirmation is entirely client-initiated: if the browser tab closes after the Razorpay modal succeeds but before `POST /payments/razorpay/verify` completes, the order stays `payment_status: 'pending'` indefinitely, inventory remains reserved, and the merchant never fulfils. This is a production launch blocker for Razorpay live mode. Compounding this, idempotency keys live in React `useRef` and vanish on page refresh — a customer who refreshes mid-payment generates a new UUID, can create a second Razorpay order from the same cart, and both orders can independently reach `confirm_order_payment_with_ledger`. The double-charge risk is CRITICAL and POSSIBLE, meaning it will occur under normal usage conditions.

Three more CERTAIN risks are equally urgent. Cart abandonment recovery operates at exactly 0%: `enqueueAbandonmentCheck()` writes jobs to `platform_queue_jobs` but the queue-workers have zero handlers for `cart.abandonment_check`. The `abandoned_cart` WhatsApp template already exists in `whatsapp.ts` but has no trigger — every abandonment event since launch has been silently discarded. Additionally, all six merchant checkout configuration fields (`contact_method`, `customer_accounts`, `full_name`, `company_name`, `order_notes`, `tip_option`) are stored in `site_settings.checkout` but the checkout server component never reads them — merchants who believe they have enforced mandatory fields or disabled guest checkout are unknowingly running an unconfigured checkout. Finally, the dashboard hardcodes "Conversion Rate: Not tracked" because not a single analytics event fires from `checkout-client.tsx` across its entire 1,160 lines.

The platform opportunity is large. The gateway already contains a complete hosted checkout session state machine (`checkout.ts`: `contact → delivery → payment_intent → completed`) with HMAC-signed cart handoff, `checkout_sessions` DB persistence, and domain event emission — but it is blocked for live use by a `HR-MERCHANT-PSP-LIVE` comment at line 573 whose exact nature is Unknown U020. The branding API (`GET /v1/stores/:storeId/branding`) is fully implemented and returns `primary_color`, `logo_url`, `accent_color`, `checkout_theme`, and a `tokens` JSONB — but zero lines of checkout code consume it; every store shows the same generic LetBuyy-styled page regardless of brand configuration. The `app_extension_registrations` table and extension-routes gateway already support the checkout.ui surface with `iframe | web_component | liquid_app_block` renderer types — but `extensionFunctions: []` at `checkout-payment-routes.ts:430` is always an empty stub with no consuming code.

The recommended execution path is three phases over 90 days. Phase 1 (Days 1-30) fixes the five CERTAIN/CRITICAL/HIGH risks in place without architecture changes: wire checkout settings to the UI, move idempotency keys to sessionStorage, implement the Razorpay webhook receiver, fix the placeholder pincode with real-time serviceability checks, and wire the cart abandonment consumer. Phase 2 (Days 31-60) extracts the checkout component from storefront-runtime's five internal couplings and activates the branding pipeline, while scaffolding `packages/checkout-core` and shipping the first three built-in extensions (gift wrap, GSTIN field, order notes). Phase 3 (Days 61-90) connects the 7-step funnel events to LCIS, unblocks five MCP tools, and ships pincode autocomplete. The governance constraint is firm throughout: `apps/checkout` is a deprecated alias in CLAUDE.md line 34 and the governance validator will reject it — any new checkout app must use `apps/checkout-platform` or the reserved `services/checkout-runtime` (which requires ARB scope approval).

---

## Current State

### Architecture

- **Location:** `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx` (1,160 lines, `'use client'`)
- **Checkout paths:** Two exist. Path 1: direct storefront path (`checkout-client.tsx` → storefront BFF `/api/orders` → gateway `checkout-payment-routes.ts` → `create_checkout_order` RPC). Path 2: gateway hosted session state machine (`checkout.ts`, `contact → delivery → payment_intent → completed`) — fully implemented but blocked for live use.
- **Step model:** Two-step `useState(1)` wizard. No URL routing between steps. Success rendered inline via `isSuccess` flag. No redirect to `/checkout/success`. Form state is entirely ephemeral React `useState` — lost on page refresh.
- **Server component props:** `storeId`, `sellerId`, `subdomain`, `storeName`, `codEnabled`, `onlinePaymentEnabled` — no logo URL, no brand colors, no checkout config settings.
- **Cart state:** Dual persistence — `localStorage` (`lb_cart`, `lb_cart_token`) + server `carts` table via PATCH. Checkout reads from React context, not a fresh server fetch.
- **Session:** None. No server-side checkout session in the current path. Idempotency keys in `useRef`, lost on refresh.

### Payment

- **Active providers:** Razorpay (online card/UPI/NetBanking via modal) + COD. Cashfree routes exist in the gateway but are not surfaced in the UI.
- **Deferred:** Stripe (LB-2 label), PayPal (LB-2 label). UPI is a schema enum stub only — no route handler.
- **Amount security:** Server derives Razorpay amount from `orders.total * 100` (DB); AMOUNT_MISMATCH guard returns 400 if client-supplied amount differs.
- **Signature verification:** `timingSafeEqualHex` constant-time HMAC-SHA256 on `(razorpay_order_id + "|" + razorpay_payment_id)`.
- **Idempotency:** `IdempotencyExecutionAdapter` with DB-level claims scoped to `(siteId, key, scope)`. Keys in `useRef` — not durable across refresh.
- **Critical gap:** No inbound webhook receiver for Razorpay, Stripe, Cashfree, or PayPal. Orders stay `pending` if browser closes after modal.

### Branding

- CSS variable inheritance from `[subdomain]/layout.tsx` `:root` injection works for embedded checkout.
- `GET /v1/stores/:storeId/branding` endpoint is fully built but zero lines of `checkout-client.tsx` consume it.
- Hardcoded values that override brand: COD button `rgb(22 163 74)`, online button `rgb(26 26 46)`, Razorpay modal theme `rgb(99 102 241)`.
- Logo: not rendered in checkout page body. Razorpay `image` field hardcoded to `/logo.png` (platform logo, not merchant).

### Extensions

- No extension architecture. Sealed monolith. Zero composition points.
- `extensionFunctions: []` at `checkout-payment-routes.ts:430` — permanent stub, always empty.
- Gift cards: backend schema complete (`giftCardCode` in API), no UI.
- Order notes: `notes` field in API schema, wired to RPC, no UI textarea.
- `app_extension_registrations` table and `GET /storefront/:subdomain/checkout/extensions` API endpoint exist and are correct — no consumer in `checkout-client.tsx`.

### Conversion

- **Funnel tracking:** 0 of 7 steps tracked in `checkout-client.tsx`. Dashboard shows "Conversion Rate: Not tracked".
- **Cart abandonment recovery:** `enqueueAbandonmentCheck()` writes job; zero queue-worker handlers for `cart.abandonment_check`. Recovery rate = 0%.
- **Address capture:** No pincode autocomplete, no India Post lookup, no city/state auto-fill. Placeholder pincode `'000000'` at checkout mount.
- **Shipping:** Rates fetched at mount with `'000000'`. Zone restrictions not enforced. Real-time COD serviceability never checked against the customer's actual pincode.

---

## Target State

### 90-Day Targets

| Dimension | Target |
|---|---|
| Payment recovery | Razorpay webhook receiver live; orphaned pending orders recovered within 15 min |
| Double-charge risk | Eliminated — idempotency keys derived from cart token, persisted in sessionStorage, DB uniqueness constraint on `(site_id, session_id, payment_method)` |
| Merchant settings | All 6 `site_settings.checkout` fields consumed by checkout UI |
| Cart abandonment recovery | >3% (from 0%) via wire of existing queue consumer + `abandoned_cart` WhatsApp template |
| Funnel visibility | 7 of 7 steps tracked, merchant dashboard funnel card live |
| Branding | Store logo + primary color rendered in checkout; Razorpay modal shows store brand color |
| Extensions (built-in) | Gift wrap toggle, GSTIN field, order notes textarea live via `checkout_extensions` JSONB config |
| MCP tools unblocked | `get_checkout_funnel_analytics`, `enable_cod_with_rules`, `update_payment_providers`, `get_order_gst_invoice`, `create_payment_intent` |
| COD serviceability | Real-time pincode check on address entry; COD hidden for restricted pincodes before payment step |

### Checkout 2.0 (2028) Vision

Centralized platform at `checkout.letbuyy.com/{store}` with sub-1-second LCP, UPI intent deep-links, pincode-first address autocomplete, 7-step funnel analytics, server-side checkout session state (refresh-safe), store-branded payment pages, built-in extensions framework, and LCIS autonomous detection of payment failure spikes and abandonment surges. The `checkout_sessions` state machine already built in the gateway becomes the canonical backend; the V1 client-side wizard is deprecated by Q4 2027.

---

## Gap Analysis

| Gap | Severity | Score | Evidence | Recommended Fix |
|---|---|---|---|---|
| No inbound Razorpay webhook receiver | HIGH | 9 | R009; `03-payment-architecture §7` | `POST /v1/webhooks/razorpay` in api-gateway verifying `X-Razorpay-Signature`; calls `internal/payments/confirm` for `payment.captured` |
| Idempotency keys in `useRef` — lost on refresh | CRITICAL | 8 | R001; `checkout-client.tsx:172` | Move to `sessionStorage`, derive from `lb_cart_token`, add DB unique constraint |
| Payment failure leaves inventory locked indefinitely | HIGH | 12 | R011; `checkout-client.tsx:534-537` | Background cleanup job cancels `pending` Razorpay orders > 15 min; `payment.failed` webhook calls `record_order_payment_failure_with_ledger` with `p_release_inventory: true` |
| Cart abandonment consumer never implemented | MEDIUM | 8 | R021; `09-conversion-analysis §2` | `queue-workers` handler for `cart.abandonment_check` dispatching recovery email + WhatsApp |
| Checkout settings stored but never consumed | HIGH | 12 | R016; `14-checkout-editor §1` | `page.tsx` reads `store.siteSettings?.checkout`, passes as `checkoutConfig` prop to `CheckoutClient` |
| Placeholder pincode `'000000'` — COD serviceability not checked | CRITICAL | 12 | R008 + R012; `checkout-client.tsx:220` | Re-fetch rates + serviceability on pincode field blur with real pincode |
| Zero checkout funnel analytics | LOW | 4 | R023; `09-conversion-analysis §1` | 7 analytics calls at step transitions routed to existing Cloudflare Analytics Engine |
| Branding API built but not consumed | — | — | `05-checkout-branding-analysis`; `13-checkout-branding-platform` | Server component fetches `GET /v1/stores/:storeId/branding`; passes `logoUrl`, `primaryColorRaw` as props |
| 5 storefront-runtime couplings block extraction | — | — | `12-centralized-checkout-platform §1` | Phase 1: decouple `useCart`, `StorefrontEmptyState`, API proxies, CSS tokens, `/logo.png` |
| `extensionFunctions: []` permanent stub | — | — | `06-checkout-extensibility-analysis §3` | `ALTER TABLE sites ADD COLUMN checkout_extensions JSONB`; Tier 1 extensions via config |
| COD shown for restricted pincodes | HIGH | 9 | R012; `08-shipping-platform §3` | Server-side `cod_available` check in `create_checkout_order` RPC on COD orders |
| Guest order enumeration — no rate limit | HIGH | 9 | R010; `07-order-platform §10` | Cloudflare rate limit + Turnstile on `GET /api/orders/check` |
| `HR-MERCHANT-PSP-LIVE` blocker unknown | — | — | U020; `checkout.ts:573` | Read `checkout.ts:560-590` to determine if feature flag, env var, or TODO; resolve to activate hosted state machine |
| MCP tools BLOCKED: funnel, COD toggle, GST invoice | — | — | `11-mcp-checkout-analysis §1` | 5 new gateway endpoints: `/analytics/checkout-funnel`, `/stores/:id/settings/cod`, `/stores/:id/payment-config`, `/orders/:id/invoice`, MCP auth scope on existing payment intent route |

---

## Top 10 Non-Obvious Discoveries

1. **The gateway already has a complete hosted checkout — it is just blocked.** `services/api-gateway/src/routes/checkout.ts` implements a full `contact → delivery → payment_intent → completed | failed` session state machine with HMAC cart handoff, `checkout_sessions` DB persistence, and domain event emission. Centralization is activating what is already built, not a greenfield build. The only blocker is a `HR-MERCHANT-PSP-LIVE` comment at line 573 whose exact nature (feature flag, missing env var, or TODO) is Unknown U020 in the unknowns register.

2. **The COD hardcoded button color `rgb(22 163 74)` accidentally matches one specific brand perfectly.** The Harvest (grocery) brand palette happens to use `#16a34a` as its primary color — which is `rgb(22 163 74)`. Every other store gets this wrong green on their COD button regardless of brand. The Razorpay modal `rgb(99 102 241)` (indigo) is similarly wrong for all non-indigo-primary stores. Both are one-line fixes once `primaryColorRaw` is passed as a prop from the server component.

3. **Cart abandonment has never worked since day one.** The `enqueueAbandonmentCheck()` function writes jobs to `platform_queue_jobs` and the `abandoned_cart` WhatsApp template exists in `whatsapp.ts`. But `platform-queue-consumer.ts` has zero handlers for `cart.abandonment_check`. The jobs are enqueued, sit in the table forever, and no recovery email or WhatsApp message has ever been sent to a cart-abandoning customer. This is not a recent regression — it was never wired.

4. **`@letbuyy/checkout-core` is listed as an allowed dependency in the storefront-runtime manifest but does not exist as a package.** The manifest declares it as an allowed workspace dependency, signalling the intended abstraction boundary — but `packages/checkout-core` has never been scaffolded. The centralization plan builds on this manifest declaration.

5. **Shipping zone restrictions are completely unenforced at checkout.** Merchants can create zones with `countries`, `states`, and `zip_codes` allowlists in the UI, but `POST /v1/shipping/rates` returns all active rates for the store regardless of which zone covers the customer's pincode. A customer in Karnataka can select a zone-restricted "Maharashtra Express" rate and the server will accept it. The rate is validated against `site_id + is_active` but not against zone coverage.

6. **The `assertBrandingIsDataOnly` function protects against script injection in the branding API, but its CSS color validation strength is unknown.** The function exists at `checkout.ts:797` and gates `PUT /v1/stores/:storeId/branding`. The research could not confirm whether it validates `primary_color` against strict hex/rgb patterns or accepts arbitrary strings — a CSS injection via `; content: url('https://evil.com/steal.png')` in a color token would be served to all customers of that store via the public brand endpoint.

7. **Post-commit work (GST invoice generation) can silently fail with no retry.** The `CHECKOUT_POSTCOMMIT_DEFERRAL` flag is ON by default, deferring GST invoice generation and usage metering to Cloudflare Worker `waitUntil`. The `catch` block at `checkout-payment-routes.ts:399` logs the error and does nothing else — no re-enqueue, no dead-letter queue. B2B buyers who need a GST invoice for input-tax credit claims may find no invoice exists for their order, with no indication of failure.

8. **COD fraud has a direct merchant-controlled vector.** A merchant can call `PATCH /v1/orders/:id` with `status: 'delivered'` at any time, which sets `payment_status=paid` and emits `order.paid` — without a physical delivery or a matching `cod_reconciliation_entries` row in `collected` state. The COD reconciliation lifecycle (`pending → collected → reconciled`) is correct and well-designed, but it is completely disconnected from the order status transition that triggers revenue recognition.

9. **The two-factor tenant isolation for internal payment routes is a single shared secret.** `POST /storefront/internal/payments/confirm` is protected by `isInternalApiSecretRequest` which checks for the `INTERNAL_API_SECRET` header. This is a single credential shared across all queue workers and services that grants unlimited cross-tenant payment confirmation authority. `signQueueTenantEnvelope` exists but whether it is enforced on the payment confirm path specifically was not confirmed. A leaked `INTERNAL_API_SECRET` allows confirming any pending order for any merchant with no Razorpay payment.

10. **The `VALID_TRANSITIONS` state machine in `@letbuyy/checkout-core` may not block `pending → delivered`.** The research confirmed that `planOrderStatusTransition` enforces transitions and that `delivered` sets `payment_status=paid`. What was not confirmed is whether `pending → delivered` is an explicitly blocked transition or an allowed one. If allowed, a merchant with a compromised account can confirm revenue for unpaid orders, generating GST invoices and confirmation emails for orders that were never actually paid.

---

## Critical Risks Summary

Top 5 risks from `17-risks-register.md` requiring immediate attention:

### Rank 1: R008 — Inventory Race Condition (Score 12, CRITICAL × LIKELY)

The `create_checkout_order` RPC reserves inventory atomically, but the placeholder pincode `'000000'` means COD serviceability is never checked against the customer's real address before order creation. Concurrent checkout submissions for limited-stock items can race to the RPC, and the error surfaces as a generic "Order creation failed" message with no stock-specific or COD-specific guidance. This is the highest-probability critical risk: it occurs under ordinary traffic conditions and directly drives checkout abandonment. Fix: re-fetch shipping rates and COD serviceability on pincode field blur with the real pincode; return typed error codes (`INSUFFICIENT_STOCK`, `COD_UNAVAILABLE`) from the RPC instead of a generic 400.

### Rank 2 (tied): R011 — Payment Failure Inventory Lock (Score 12, HIGH × CERTAIN)

Every Razorpay payment failure leaves the order in `pending` state with inventory reserved. The `record_order_payment_failure_with_ledger` RPC exists but is only reachable via the inbound webhook path — which has no receiver. The client `payment.failed` handler resets `isProcessing` but makes no server call to release inventory. This is CERTAIN in production: payment failures occur in every live system. Fix: implement the Razorpay webhook receiver (Rank 4) to handle `payment.failed` with `p_release_inventory: true`; add a 15-minute background cleanup job as a fallback.

### Rank 3 (tied): R016 — Checkout Settings Never Consumed (Score 12, HIGH × CERTAIN)

All six merchant checkout configuration fields (`contact_method`, `customer_accounts`, `full_name`, `company_name`, `order_notes`, `tip_option`) are stored in `sites.site_settings.checkout` via the merchant control plane, but `checkout/page.tsx` never reads them. Merchants who set `customer_accounts: required` for B2B compliance or `contact_method: phone` for WhatsApp flows have zero effect on the live checkout. This is CERTAIN and constitutes a direct merchant contract violation. Fix: add `checkoutConfig` prop read from `store.siteSettings?.checkout` in the server component, consume in `CheckoutClient`. Estimated effort: 1 day.

### Rank 4: R009 — No Inbound Razorpay Webhook Receiver (Score 9, HIGH × LIKELY)

Razorpay fires `payment.captured` when a payment succeeds. LetBuyy has no receiver for this event. Any browser crash, network drop, or tab-close after the Razorpay modal closes leaves the order permanently `pending` with revenue confirmed at Razorpay but not in the LetBuyy ledger. This is a production launch blocker before enabling Razorpay live keys at scale. Fix: implement `POST /v1/webhooks/razorpay` in the api-gateway verifying `X-Razorpay-Signature` with `RAZORPAY_WEBHOOK_SECRET`; call `internal/payments/confirm` on `payment.captured` and `internal/payments/failure` on `payment.failed`.

### Rank 5: R010 — Guest Order Enumeration (Score 9, HIGH × LIKELY)

`GET /api/orders/check?contact={emailOrPhone}&subdomain={subdomain}` returns `{ hasOrders: boolean, hasPassword: boolean }` with no authentication, no rate limiting, and no CAPTCHA. An attacker can determine whether any email address has placed orders on any LetBuyy store via automated enumeration. Under India's DPDP Act 2023, this constitutes an unauthorised disclosure of personal data. Fix: add Cloudflare rate limit (5 requests/IP/min/subdomain) and Turnstile CAPTCHA token validation on the BFF route.

---

## Critical Unknowns Summary

Top 5 unknowns from `18-unknowns-register.md` blocking centralization or launch:

### U001 — Cart Persistence Authority (Critical, blocks centralization cart handoff)

Is the `carts` server-side table canonical, or is `localStorage` canonical? The checkout client reads exclusively from React context (localStorage-backed), never issuing a fresh server-cart read before order submission. But the hosted checkout state machine in `checkout.ts` uses the server `carts` table as its source of truth. For a centralized checkout at `checkout.letbuyy.com`, the HMAC-signed handoff URL encodes the server cart token — but if localStorage mutations are not guaranteed to be reflected in the server `carts` table before handoff, the order payload and the server cart will diverge. Resolution: read `cart-routes.ts` sync semantics; confirm whether every localStorage mutation is guaranteed synced to the server cart before the checkout-url handoff URL is generated.

### U002 — Razorpay Webhook Receiver Existence (Critical, blocks revenue recovery confidence)

Does any inbound Razorpay webhook receiver exist in `services/webhook-service/src/`? The gateway has no `POST /webhooks/razorpay` route. `02-checkout-flow-audit §7` states that "Razorpay webhooks reach the webhook-service" as an intended design but this was not confirmed as implemented. If no receiver exists anywhere in the deployed stack, every Razorpay payment where the browser closes before verify is permanent revenue leakage. Resolution: read `services/webhook-service/src/` fully.

### U006 — Checkout URL Strategy Decision (Critical, blocks all centralization scaffold work)

Three URL options are analysed in doc 12 with a phased recommendation (Phase 1 = no change, Phase 2 = `{store}.letbuyy.com/checkout`, Phase 3 = `checkout.letbuyy.com/{store}`) but no ARB decision has been recorded. This decision determines CORS policy, cookie strategy, Razorpay domain whitelist, identity-platform JWT issuer, and whether the HMAC cart-handoff protocol is required at launch or only for Phase 3. Getting this wrong after launch requires a breaking URL migration. Resolution: Product + ARB decision, recorded as an ADR, before Day 31.

### U020 — `HR-MERCHANT-PSP-LIVE` Blocker Nature (Critical, blocks activating gateway state machine)

A `HR-MERCHANT-PSP-LIVE` comment at `checkout.ts:573` prevents the hosted checkout state machine from running in live mode. The entire centralization plan (doc 12 Phase 2) depends on activating this path as the canonical checkout backend. Whether the blocker is a conditional on a missing env var, a feature flag, a compliance gate, or a pure TODO comment with no runtime enforcement has not been determined from the static analysis. Resolution: read `checkout.ts:560-590` directly.

### U007 — Inventory Reservation Timeout Policy (Critical, blocks stock availability under payment abandonment)

The `create_checkout_order` RPC sets `inventory_reserved_at` atomically. But what releases the reservation when payment fails and the browser closes? The research confirmed that `inventory_released_at` and `release_order_inventory_with_ledger` columns and RPC exist, but no cron job or background worker for stale-order cleanup was confirmed. In a flash sale scenario, a handful of concurrent payment failures can create false out-of-stock for all other buyers indefinitely. Resolution: read queue-workers cron jobs; confirm whether a stale-order release job exists; if not, file as a production-hygiene blocker.

---

## Recommended Immediate Actions

From `19-executive-strategy.md` Day 1-30 plan:

### Must Do (blocks everything else)

**1. Wire checkout settings to checkout UI** (Effort: 1 day, Risk: LOW)
- File: `apps/storefront-runtime/src/app/store/[subdomain]/checkout/page.tsx` — read `store.siteSettings?.checkout`, pass as `checkoutConfig` prop.
- File: `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx` — consume `checkoutConfig` to conditionally render company name field, enforce contact method, show order notes textarea, respect tip option.
- Fixes R016 (Score 12, CERTAIN). Removes silent merchant contract violation.

**2. Move idempotency keys to sessionStorage + derive from cart token** (Effort: 1 day, Risk: LOW/MEDIUM)
- Replace `useRef<Record<string, string>>({})` at `checkout-client.tsx:172` with `sessionStorage` read/write keyed by `lb_cart_token`.
- Derive idempotency key as `{cartToken}-order-{paymentMethod}` so the same cart always produces the same key.
- Add DB-level `UNIQUE` constraint on `(site_id, session_id, payment_method)` on `orders` table as secondary guard (requires migration + governance validation run).
- Fixes R001 (Score 8, CRITICAL double-charge risk).

**3. Implement inbound Razorpay webhook receiver** (Effort: 2-3 days, Risk: MEDIUM)
- Add `POST /v1/webhooks/razorpay` in `services/api-gateway/src/routes/`. Verify `X-Razorpay-Signature` using HMAC-SHA256 with `RAZORPAY_WEBHOOK_SECRET`.
- `payment.captured` → call `POST /storefront/internal/payments/confirm`. `payment.failed` → call `POST /storefront/internal/payments/failure` with `p_release_inventory: true`.
- Register webhook URL in Razorpay dashboard (`[HUMAN-REQUIRED]`).
- Add 15-minute background cleanup job in `queue-workers` as a fallback for orphaned pending orders.
- Fixes R009 (Score 9) and R011 (Score 12).

**4. Fix pincode placeholder + re-fetch rates on real pincode** (Effort: 1-2 days, Risk: LOW)
- `checkout-client.tsx` — on 6-digit pincode completion, call `GET /api/shipping/serviceability/:pincode?store_id=` and update `codEnabled` state. Re-fetch `POST /api/shipping/rates` with real pincode.
- `checkout-payment-routes.ts` — add server-side COD serviceability validation for COD orders.
- Return typed error codes (`INSUFFICIENT_STOCK`, `COD_UNAVAILABLE`, `SHIPPING_UNAVAILABLE`) instead of generic 400.
- Fixes R008 (Score 12), R012 (Score 9), and root cause of R020.

**5. Wire cart abandonment consumer** (Effort: 1 day, Risk: LOW)
- `services/queue-workers/src/platform-queue-consumer.ts` — add handler for `job_type: 'cart.abandonment_check'`.
- Handler checks if order was placed (`orders.cart_token = cartToken`); if not, dispatches recovery email via Resend and WhatsApp via existing `abandoned_cart` template in `whatsapp.ts` (opt-in only).
- Add TTL policy on `platform_queue_jobs` to prevent unbounded table growth from historical unprocessed jobs.
- Fixes R021 (Score 8). Ends 0% cart abandonment recovery rate.

### Should Do (high value, low risk)

**6. Add 7-step checkout funnel analytics events** — additive calls at `checkout.session_started`, `checkout.contact_entered`, `checkout.address_entered`, `checkout.shipping_selected`, `checkout.payment_method_selected`, `checkout.payment_initiated`, `checkout.completed`. Route through existing Cloudflare Analytics Engine infrastructure.

**7. Rate-limit public checkout endpoints + add Turnstile to order creation** — Cloudflare rate limiting on `POST /api/orders` (5/IP/min) and `GET /api/orders/check` (5/IP/min/subdomain). Turnstile token validation on order creation. Fixes R010 (Score 9).

**8. Surface store branding in checkout** — server-side fetch of `GET /v1/stores/:storeId/branding` in `page.tsx`; pass `logoUrl`, `primaryColorRaw`, `checkoutTheme` as props; replace 3 hardcoded color values in `checkout-client.tsx`.

---

## Architecture Decisions

Top 3 decisions from `18-unknowns-register.md` Architecture Decisions table:

| Decision | Recommendation | Owner | Deadline |
|---|---|---|---|
| **Checkout URL strategy for centralization** | Phase 1 = no URL change (zero risk); Phase 2 = `{store}.letbuyy.com/checkout` (same-origin, simpler); Phase 3 = `checkout.letbuyy.com/{store}` (full deployment independence + A/B capability, requires HMAC cart handoff). Record decision as ADR before any scaffold work begins — this determines CORS, cookies, Razorpay domain whitelist, and JWT issuer for every downstream decision. | Product + ARB | Before Day 31 |
| **Checkout session token issuer for central-origin checkout** | Introduce a new short-lived HS256 checkout session JWT scoped to `(site_id, cart_id)`, rotated per checkout session. ES256 (identity-platform) is strong but the existing issuer is for merchant authentication — a separate checkout-specific token avoids crossing the two-issuer boundary mandated by CLAUDE.md security rules. The HMAC cart-handoff token (`CHECKOUT_HANDOFF_SECRET`) is single-use and unsuitable as a session bearer. | ARB (security) | Before Day 31 |
| **Inbound Razorpay webhook receiver location** | Add to `services/webhook-service` following the existing webhook-service pattern; webhook-service calls `/storefront/internal/payments/confirm` over the internal API. This keeps payment confirmation logic co-located with the webhook delivery infrastructure rather than adding a public-facing webhook route to the api-gateway alongside the authenticated merchant and storefront routes. | Engineering lead | Before Day 14 |

---

## Document Details

### 01 Checkout System Inventory

Complete file inventory of all checkout-related source across `storefront-runtime`, `merchant-control-plane`, `api-gateway`, and `queue-workers`. Documents the storefront checkout page (`page.tsx` 39 lines, `checkout-client.tsx` 1,160 lines), the 5 BFF proxy routes, the gateway checkout state machine (`checkout.ts` 816 lines), payment routes (`checkout-payment-routes.ts` 1,274 lines), and the full dependency graph of imports and external service integrations (Razorpay, Cashfree, Stripe stubs, Framer Motion, Resend).

### 02 Checkout Flow Audit

Step-by-step walkthrough of both checkout paths. Razorpay is 10 steps (cart → checkout entry → address form → shipping selection → payment selection → order creation → Razorpay order → modal → verify → confirmation). COD is 7 steps. Documents the complete API call sequence, idempotency key scoping, failure modes for each step, and the inline success screen pattern (no redirect). Identifies the `isSuccess` flag as the success gate, not a URL transition.

### 03 Payment Architecture

Deep-dive on payment security: `AMOUNT_MISMATCH` guard, `assertProviderPaymentNotReplayed`, `timingSafeEqualHex` constant-time comparison, `IdempotencyExecutionAdapter` DB claim lifecycle, AES-GCM per-merchant key encryption (SHA-256 key derivation — KDF weakness noted), and the per-store `PaymentSettings` JSONB. Documents the missing inbound webhook receiver as a critical gap and the `CHECKOUT_POSTCOMMIT_DEFERRAL` silent failure risk for GST invoices.

### 04 Checkout UI Architecture

Structural analysis of `CheckoutClientProps` (6 fields only), the CSS variable token inheritance chain from `[subdomain]/layout.tsx`, the 3 hardcoded color values, the `razorpayLoaded` gate on the Pay button, and the 5 storefront-runtime couplings that must be resolved before the component can be extracted. Documents the 7 changes required for standalone portability.

### 05 Checkout Branding Analysis

Audit of every branding element (logo, store name, primary color, typography, favicon, button style, footer, trust badges) against its current rendering state. Scores the checkout at 3/10 for branding. Defines the `CheckoutBrandingProps` interface needed for a centralized checkout. Documents why the CSS inheritance approach that works for embedded checkout will break if extracted to a standalone domain.

### 06 Checkout Extensibility Analysis

Documents the zero extension architecture with code evidence: zero matches for `extension`, `plugin`, `widget` in `checkout-client.tsx`; `extensionFunctions: []` stub at `checkout-payment-routes.ts:430`; fixed `CheckoutClientProps` with no `extensions`, `features`, or `blocks` prop. Proposes the `checkout_extensions` JSONB config model as a merchant-configurable block system requiring only a schema column addition.

### 07 Order Platform Analysis

40+ field order entity map, 8-state state machine, monthly quota check mechanism, `completeOrderPostCommitWork` anatomy, 6-signal risk scoring algorithm, COD confirmation 12-hour window, and the WhatsApp `[HUMAN-REQUIRED]` gate for live delivery. Documents the `pending_cod` state trigger and the COD reconciliation full lifecycle.

### 08 Shipping Platform Analysis

3-table shipping data model (`shipping_zones`, `shipping_rates`, `shipping_serviceability_rules`). Documents `liveLogisticsProviderAvailable()` hardcoded false, the `'000000'` placeholder pincode pattern, the weight-based rate type as schema-complete but UI-inaccessible, and 10 missing shipping capabilities including live carrier integration, product weight summation, zone enforcement, and ETA display.

### 09 Conversion Analysis

Confirms zero tracking calls in `checkout-client.tsx` by full-file grep. Documents the broken cart abandonment infrastructure (job enqueued, no consumer). Maps 8 conversion gaps: cart abandonment recovery, payment failure UX, address autocomplete, saved addresses (partial), one-click reorder, express checkout, checkout progress persistence on reload, SMS/WhatsApp OTP. Documents dashboard "Not tracked" hardcoded strings.

### 10 LCIS Checkout Analysis

Maps available LCIS APIs for checkout management, identifies 9 MCP tool candidates, and documents the API gaps blocking autonomous operations: no COD toggle endpoint, no funnel metrics API, no checkout session list. Documents which LCIS autonomous detection scenarios (COD RTO, Razorpay failure spike) are callable vs. blocked.

### 11 MCP Readiness Analysis

Complete registry of all 36 checkout-related MCP tools with input schemas, gateway endpoints, auth mechanism, and READY/PARTIAL/BLOCKED status. 30 READY tools across coupon management, shipping config, order management, and refunds. 3 PARTIAL (checkout analytics, COD toggle, shipment tracking). 6 BLOCKED (funnel analytics, live payment intent, abandonment report, payment provider config, GST invoice, bulk cancel). Recommends 17-tool 3-domain starter scope.

### 12 Centralized Checkout Platform Design

Evidence-based architecture for `apps/checkout-platform`. Documents 5 storefront-runtime couplings by file and line. Defines 3-phase URL strategy with detailed per-option assessment (SEO, branding, security, CORS, multi-tenancy, deployment). Designs the HMAC cart handoff sequence (7 steps) for Option C central checkout. Maps component boundaries between storefront-runtime and checkout-platform. Documents 8-step Phase 1 extraction, Phase 2 proxy-based standalone deployment, and Phase 3 fully central deployment. Lists 7 governance constraints including `apps/checkout` as forbidden.

### 13 Checkout Branding Platform Design

Defines the full `CheckoutBrandPayload` interface (20 CSS tokens + `razorpay_theme_color` + `primary_color_raw` + `is_dark` + `google_fonts_required[]`). Explains why CSS variables cannot be read at `RazorpayOptions` construction time (requiring explicit raw hex fields). Three concrete brand examples (Electra/tech/blue, Velvet/luxury/near-black, Harvest/grocery/green) with full token sets. Documents the recommended server-side inline `<style>` injection strategy (Strategy A) for zero-FOUC. Defines brand invariants (PCI payment fields, security indicators, LetBuyy attribution) that must never be merchant-customizable.

### 14 Checkout Editor Architecture

Documents all 6 existing checkout settings with evidence that none are consumed. Defines the `checkout` sub-object schema within `sites.site_settings` JSONB. Recommends simulated preview panel (not live iframe) to avoid cart/session dependencies. Documents 15 merchant-customizable elements with risk levels and storage locations. Maps 6-section editor UI (Header, Branding, Form, Payment, Trust, Advanced). Defines direct mutation save model and explains why versioning is not needed for checkout config.

### 15 Checkout Extensions Platform Design

Maps 9 named slot positions against `checkout-client.tsx` structure. Defines `CheckoutExtensionContext` (read-only) and `ExtensionOutput` (mutations) data contracts. Documents 3-tier extension model with security boundaries for each tier. Defines iframe sandbox policy (`allow-scripts allow-same-origin`, no `allow-forms`). Prioritizes 13 extension types across Tier 1 (config-driven, no new RPC), Tier 2 (extra-charges pathway required), and Tier 3 (separate domain work). Documents `ALTER TABLE sites ADD COLUMN checkout_extensions JSONB NOT NULL DEFAULT '{}'` as the only schema change for Tier 1.

### 16 Future State Checkout 2.0

2028 vision document with 8 design principles and system architecture diagram. 7-step customer experience (one-page, pincode-first, UPI intent, saved payment, smart defaults, post-purchase). Merchant experience (visual editor, AI checkout assistant, funnel analytics dashboard). Developer experience (`@letbuyy/checkout-extensions` SDK, checkout webhooks, CLI). AI-operable checkout with 5 detection signals and 3 prediction modes. Performance targets (V1 ~3-4s → 2026 <1.5s → 2028 <1s LCP). 25-item gap resolution map linking each V1 limitation to its Checkout 2.0 resolution. V1 deprecation timeline: Q4 2026 alpha → Q4 2027 V1 removed.

### 17 Risks Register

26 risks with severity, probability, risk score (1-16), and specific remediation recommendations. Each risk includes evidence with file:line citations. Risk summary matrix with open/partially-mitigated status. Top 5 by score: R008 inventory race (12, CRITICAL×LIKELY), R011 payment failure inventory lock (12, HIGH×CERTAIN), R016 settings never consumed (12, HIGH×CERTAIN), R009 Razorpay webhook missing (9, HIGH×LIKELY), R010 guest enumeration (9, HIGH×LIKELY). Top 5 ranked with justification and fix time estimates.

### 18 Unknowns Register

33 unknowns across Critical (10), High (10), Medium (7), and Low (6) priority tiers. Structured with: what is unknown, why it matters, evidence of the gap, how to resolve, and effort estimate. 7-item architecture decisions table at the end with options, tradeoffs, recommendations, and owners. Critical unknowns include cart persistence authority (U001), Razorpay webhook existence (U002), CSRF/session design for central checkout (U003), payment amount reconciliation process (U004), checkout URL strategy (U006), inventory reservation timeout (U007), and `HR-MERCHANT-PSP-LIVE` blocker nature (U020).

### 19 Executive Strategy

Top-level synthesis and action plan. Current state scorecard across 9 dimensions (2/10 to 6/10). 10 non-obvious discoveries. Day 1-30 plan (5 must-do initiatives with files, effort, and risk; 3 should-do initiatives). Day 31-60 centralization phase (5-step extraction sequence + branding pipeline + 3 built-in extensions). Day 61-90 AI-native phase (checkout funnel API, 5 MCP tools, pincode autocomplete, Razorpay SDK preload, saved payment pre-selection). Critical path sequence from idempotency keys to full platform. 5-decision table with deadlines and owners. 4-item "What NOT to Build Next" list (third-party extensions, UPI intent, vernacular checkout, tokenization) with prerequisites for each.

---

*Generated: 2026-06-18*
*Sources: 19 research documents in `docs/checkout-research/`, static analysis of `apps/storefront-runtime`, `services/api-gateway`, `apps/merchant-control-plane`, `services/queue-workers`, `packages/checkout-core`, `packages/theme-engine`*
*Governance: `apps/checkout` is a deprecated alias per CLAUDE.md line 34. Any new checkout runtime must use `apps/checkout-platform` or the reserved `services/checkout-runtime` (requires ARB scope approval).*
