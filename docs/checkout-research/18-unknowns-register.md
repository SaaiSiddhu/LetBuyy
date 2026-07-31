# Checkout Platform — Unknowns Register

> Research date: 2026-06-18.
> Evidence scope: docs/checkout-research/ documents 01–16 (static-code analysis only).
> No code was modified. This document catalogues what the static analysis could not determine
> and what must be resolved before or during centralized checkout development.

---

## Introduction

Sixteen prior research documents (01–16) characterize the LetBuyy checkout system in detail:
its file inventory, two-step UI flow, payment provider architecture, order data model,
conversion gaps, branding constraints, extensibility surface, and a full centralized-checkout
design. That body of work is grounded entirely in static code analysis — file reads, grep
output, and schema inference from TypeScript types.

Static analysis cannot answer questions about runtime behaviour, live configuration, production
deployment topology, operator decisions that live outside source files, or product requirements
that have not yet been encoded anywhere. This register documents every material gap of that
kind that was surfaced during the research. It is structured by priority: decisions that block
centralization work entirely sit at the top; quality-of-life and long-tail unknowns sit at the
bottom.

---

## Critical Unknowns (must resolve before centralization)

---

**ID:** U001
**Unknown:** Is the `carts` server-side table the canonical cart, or is `localStorage` the
canonical cart? The `cart-context.tsx` writes to both but the checkout client reads exclusively
from the React context (localStorage-backed), never issuing a fresh server-cart read before
order submission.
**Category:** Architecture
**Why It Matters:** Centralization (docs/checkout-research/12) requires the checkout-platform
to consume cart state cross-origin. If localStorage is the source of truth the only safe
cross-origin handoff is the HMAC-signed URL that encodes the *server* cart token — but if the
server cart is stale relative to localStorage mutations the order payload and the server cart
will diverge. The design of the handoff protocol changes materially depending on the answer.
**Evidence of Gap:** `02-checkout-flow-audit.md §4` documents that checkout-client reads from
`useCart()` context (localStorage), and that the `carts` table "is used by the hosted-checkout
flow" but NOT by the current storefront checkout path. The two-cart problem is noted but not
resolved.
**How to Resolve:** Product decision + gateway code read of `cart-routes.ts` sync semantics.
Confirm whether every localStorage mutation is guaranteed to be reflected in the `carts` table
before the checkout-url handoff URL is generated. If not, define the authoritative source and
update the handoff protocol design in doc 12.
**Effort:** 4 hours

---

**ID:** U002
**Unknown:** Does a Razorpay inbound webhook receiver exist anywhere in the deployed stack?
The gateway has no `POST /webhooks/razorpay` route. The webhook-service is a separate Worker
process whose source was not fully read. If no webhook receiver exists, orders where the client
tab closes before `/payments/razorpay/verify` is called stay permanently in `pending` state
with no recovery path.
**Category:** Security / Operational
**Why It Matters:** Without a server-side webhook fallback, any browser crash, network drop,
or tab-close after the Razorpay modal closes but before the verify call completes leaves a
paid-at-Razorpay / unpaid-in-DB order. This is a live revenue leak. The centralized checkout
design must specify whether the webhook receiver is built in checkout-platform or kept in
webhook-service.
**Evidence of Gap:** `03-payment-architecture.md §7` — "There is no inbound Razorpay webhook
receiver in the api-gateway routes." and "no inbound Razorpay webhook handler populating these
is currently found in the repository routes."
**How to Resolve:** Read `services/webhook-service/src/` fully. Confirm whether a Razorpay
webhook handler exists there. If not, this is a critical gap that must be filed as a blocker
before launch, independent of centralization.
**Effort:** 2 hours (code read) + decision on remediation path

---

**ID:** U003
**Unknown:** What is the CSRF / session-fixation defence for the checkout flow? The current
checkout uses no session cookie — state is pure React `useState` plus `localStorage`. The
idempotency key (`crypto.randomUUID()`) is generated client-side and stored in `useRef`. There
is no server-issued checkout session token. This means any page that can force a cart mutation
(via the same-origin `/api/storefront/{subdomain}/cart` routes) could influence the items an
unsuspecting shopper sees at checkout.
**Category:** Security
**Why It Matters:** Centralization to `checkout.letbuyy.com` (Option C in doc 12) requires a
server-issued checkout session token to establish tenant isolation. The security model of that
token — its signing algorithm, expiry, binding to `site_id`, and CSRF protection — must be
decided before building the new app. The current no-session design is acceptable for same-
origin storefront-runtime but is not safe for a shared-origin checkout platform.
**Evidence of Gap:** `12-centralized-checkout-platform.md §4` — "There is no checkout session
in the current implementation." The session design in that doc is a proposal, not an
implemented fact.
**How to Resolve:** ARB decision on session token design (HS256 customer token vs. new
checkout-specific ES256 token vs. short-lived HMAC JWT). Coordinate with identity-platform
team. The `LETBUYY_IDENTITY_PUBLIC_JWKS` key infrastructure already exists; the question is
whether to reuse it or introduce a new signing key pair.
**Effort:** 1-day ARB + 0.5 days implementation spec

---

**ID:** U004
**Unknown:** How are payment amount discrepancies caught? The gateway enforces an
`AMOUNT_MISMATCH` check when the client submits an amount that differs from the server-derived
value, but there is no evidence of a periodic reconciliation job that compares
`payment_transactions` amounts against Razorpay-reported capture amounts server-side.
**Category:** Security / Operational
**Why It Matters:** HMAC signature verification proves Razorpay signed `(razorpay_order_id,
razorpay_payment_id)` but does NOT prove the captured amount. The `confirm_order_payment_with_ledger`
RPC trusts the order total in the DB (correct) but the actual amount Razorpay captured is not
fetched and compared at verification time for the storefront flow. A systematic over/under-
capture could go undetected.
**Evidence of Gap:** `03-payment-architecture.md §5` — "HMAC verification proves Razorpay
signed the IDs — it does NOT prove the amount." The subscription flow does a server-side
Razorpay API fetch (`fetchRazorpayPayment`) to compare amounts, but the storefront
`/payments/razorpay/verify` route does not.
**How to Resolve:** Read `payment-execution.adapter.ts` `confirmPayment` implementation fully.
Determine whether `confirm_order_payment_with_ledger` RPC fetches the Razorpay capture amount
and validates it. If not, file as a security gap. Consider adding a reconciliation cron job
that fetches Razorpay settlement reports and cross-checks against `payment_transactions`.
**Effort:** 3 hours (code read + gap assessment) + 1–2 days to implement fetch-and-compare

---

**ID:** U005
**Unknown:** Can a guest shopper claim / link their orders after placing them? The success
screen shows "Track Your Order" linking to `/store/{subdomain}/orders`. The `autoCreateCustomer()`
fire-and-forget call creates a customer record, and `set-password` exists. But whether a guest
who places an order without logging in can (a) see that order on the orders page without a
password, and (b) claim it to a new account, is not confirmed.
**Category:** Product
**Why It Matters:** Guest-to-registered conversion post-purchase is a standard commerce flow.
If it is broken or absent, it reduces repeat-purchase rate and complicates post-order support
(customer cannot see their own orders without contacting support). Centralized checkout must
decide whether to prompt password creation in the success screen.
**Evidence of Gap:** `07-order-platform-analysis.md §10` — guest lookup works via email/phone
(no auth required) and `set-password` exists with a 4-character minimum. But `02-checkout-flow-
audit.md §3` notes: "Whether a guest can actually track without logging in depends on the orders
page auth handling, which is outside the scope of the files read here."
**How to Resolve:** Read `apps/storefront-runtime/src/app/store/[subdomain]/orders/` page
components. Confirm: does the orders page require auth? Is there an unauthenticated
order-lookup-by-email flow? Does the success screen prompt password creation?
**Effort:** 2 hours

---

**ID:** U006
**Unknown:** What is the correct URL strategy for the centralized checkout app? Three options
are analysed in doc 12 (per-store subdomain, path-based same-origin, and
`checkout.letbuyy.com/{store}`), with a phased recommendation. The actual decision has not
been made, and it affects every downstream decision: CORS policy, cookie strategy, Razorpay
domain whitelist, identity-platform JWT issuer, and whether the HMAC cart-handoff protocol
is required at launch or only for Phase 3.
**Category:** Architecture
**Why It Matters:** The URL strategy determines the entire cross-origin security model. Getting
this wrong after launch requires a breaking URL migration, Razorpay domain re-configuration,
and a cookie-scope redesign. It must be decided before scaffold work begins.
**Evidence of Gap:** `12-centralized-checkout-platform.md §3` — three options analysed, Phase
1/2/3 phasing recommended, but no decision recorded and no ARB sign-off referenced.
**How to Resolve:** Product + ARB decision. The doc 12 recommendation is: Phase 1 = no URL
change, Phase 2 = `{store}.letbuyy.com/checkout`, Phase 3 = `checkout.letbuyy.com/{store}`.
Record the decision and its rationale in an ADR.
**Effort:** 0.5-day decision meeting + ADR write-up

---

**ID:** U007
**Unknown:** At what point is inventory reserved — at checkout start (add to cart), at order
creation (submit button), or at payment confirmation? The `create_checkout_order` RPC reserves
inventory atomically at order creation (`inventory_reserved_at` column is set). But the gap
is: if a customer creates an order, payment fails, and the order stays `pending`, does
inventory remain reserved indefinitely? What is the reservation timeout / release policy?
**Category:** Architecture / Operational
**Why It Matters:** Without a timeout, a user who abandons mid-Razorpay-modal holds inventory
from other buyers. In high-demand product scenarios (limited stock, flash sales) this is a
denial-of-stock attack vector. The centralized checkout must document the reservation lifecycle
and implement or verify an expiry-and-release mechanism.
**Evidence of Gap:** `02-checkout-flow-audit.md §6` — "the order exists in DB with status
'pending' and payment_status 'pending'. There is no automatic cancellation from the client."
`07-order-platform-analysis.md §1` — `inventory_reserved_at` and `inventory_released_at`
columns exist but the timeout logic is not confirmed in the route code read.
**How to Resolve:** Read the queue-workers cron jobs for stale-order cleanup. Read
`release_order_inventory_with_ledger` invocation sites. Determine: is there a scheduled job
that releases inventory on orders that are `pending` + older than N minutes?
**Effort:** 3 hours

---

**ID:** U008
**Unknown:** Is split payment (e.g. partial COD + gift card redemption) supported? The
`create_checkout_order` RPC accepts both `p_coupon_code` and `p_gift_card_code` parameters,
and the `StorefrontCreateOrderBody` schema includes a `giftCardCode` field. However, the
checkout UI (`checkout-client.tsx`) has no gift card input, and the interaction between a gift
card partial redemption and a COD or Razorpay remainder is not documented.
**Category:** Product / Architecture
**Why It Matters:** Gift card UI is a Tier 1 extension in doc 15. Before building the UI, the
server-side behaviour for the partial-payment split must be understood: does the RPC compute
`total - gift_card_balance`, and is the remainder charged via COD/Razorpay? If not, building
a gift card UI that hands a zero-remainder order to Razorpay will break the Razorpay flow
(Razorpay requires amount > 0).
**Evidence of Gap:** `15-checkout-extensions.md §1` — "Gift cards (backend only): Schema
present, UI absent." `03-payment-architecture.md §5` — the `create_checkout_order` RPC
accepts `gift_card_code` but the split-payment remainder flow is not described anywhere.
**How to Resolve:** Read the `create_checkout_order` RPC SQL implementation (requires
`pnpm graph:db` to extract). Confirm: what does the RPC return when `gift_card_balance >=
order_total` (zero-amount Razorpay case)? What does it return when `gift_card_balance <
order_total` (remainder case)? Decide the UI flow for each case before building the gift
card extension.
**Effort:** 3 hours (RPC SQL read) + product decision

---

**ID:** U009
**Unknown:** What checkout funnel events are currently tracked, and from where is
`storefront.checkouts.started` emitted? The analytics dashboard uses this metric, but
`checkout-client.tsx` contains zero tracking calls. The emission point is not visible in
the checkout code.
**Category:** Product / Architecture
**Why It Matters:** Centralized checkout development requires knowing the current measurement
baseline. If `storefront.checkouts.started` is emitted by storefront-runtime middleware (not
the checkout component), moving checkout to a separate app will break this metric unless the
emission point is ported. All downstream conversion rate calculations depend on this event.
**Evidence of Gap:** `09-conversion-analysis.md §1` — "storefront.checkouts.started is in
`LIVE_VIEW_METRICS`; its exact emission point is not in the checkout client." The merchant
dashboard explicitly shows Conversion as "Not tracked."
**How to Resolve:** Grep `storefront.checkouts.started` across the full repo (middleware,
server components, analytics routes). Identify the exact file and line that emits it. Confirm
whether it fires on navigation to `/checkout` or on first form interaction.
**Effort:** 1 hour

---

**ID:** U010
**Unknown:** Are COD order-value limits and pincode serviceability restrictions configurable
per store, or are they absent entirely? `cod_enabled` is the only store-level COD gate in the
code. For India COD operations, carriers typically impose per-pincode serviceable lists and
per-order ceiling amounts. Neither is implemented.
**Category:** Business / Operational
**Why It Matters:** Going live with COD and no per-pincode or per-amount restriction means
merchants will receive undeliverable COD orders (non-serviceable pincode) and high-RTO orders
above carrier thresholds. The checkout extensions design in doc 15 proposes `cod_rules` config
including `max_order_minor`, `fee_minor`, and `blocked_pincodes`, but this is a design, not
an implementation. A decision is needed on whether V1 ships COD with no rules, or whether
the `cod_rules` config column must land before launch.
**Evidence of Gap:** `03-payment-architecture.md §3` — "No per-store order-value limits or
pincode restrictions are implemented at the API layer." `15-checkout-extensions.md §5` —
`cod_rules` with `blocked_pincodes` is a proposed schema addition, not live.
**How to Resolve:** Product decision: ship COD as-is (binary on/off, no rules) for V1 and
iterate, or implement `cod_rules` config before launch. If implementing, confirm which carrier
serviceability API to integrate (Shiprocket / Delhivery pincode lookup is infrastructure that
currently defaults to sandbox).
**Effort:** Product decision: 0.5 days. Implementation: 3–5 days.

---

## High-Priority Unknowns (should resolve in next sprint)

---

**ID:** U011
**Unknown:** Which shipping zones are active and complete for each store? The `shipping_rates`
table has `is_active` rows, but the checkout fetches rates with `pincode: '000000'` at mount
time (before the customer enters their address). Whether rates are zone-restricted by pincode
range, state, or flat-rate-only is not confirmed from the code read.
**Category:** Operational
**Why It Matters:** The placeholder pincode `'000000'` at mount time means the shipping rate
shown to the customer during address entry may not be the rate that applies to their actual
pincode. If the final rate differs, the order total changes at confirmation — a silent UX
inconsistency. The centralized checkout design must re-fetch rates after address capture.
**Evidence of Gap:** `02-checkout-flow-audit.md §4` — "Pincode used for rate fetch is a
hardcoded placeholder '000000' — actual pincode is not yet available at mount time. This is
a known V1 limitation."
**How to Resolve:** Read `shipping.ts` `POST /v1/shipping/rates` handler fully. Confirm
whether the handler filters by pincode range or returns all active rates regardless. If
pincode-filtered: the fix in the centralized checkout is to re-fetch after step 1 completes.
If flat-rate-only: the placeholder is benign.
**Effort:** 2 hours

---

**ID:** U012
**Unknown:** What Razorpay webhook events does the webhook-service subscribe to, and does
the webhook-service forward them to the internal payment routes? The `services/webhook-service`
source was not fully read in the prior research. The internal routes (`/internal/payments/
confirm`, `/failure`, `/event`) are designed for worker-to-gateway calls, but no evidence
confirms they are actually called by a Razorpay webhook handler.
**Category:** Operational / Security
**Why It Matters:** If the webhook-service does not call the internal confirm route, the only
payment confirmation path is client-initiated. This is the same gap as U002 but from a
different angle. Even if the receiver exists in webhook-service, the event subscriptions
(payment.captured, payment.failed, refund.created) must be configured in the Razorpay
dashboard with the correct HMAC secret.
**Evidence of Gap:** `02-checkout-flow-audit.md §7` — "Razorpay webhooks reach the
webhook-service (services/webhook-service), which calls the internal payment routes" — this
is stated as the intended design, not confirmed as implemented.
**How to Resolve:** Read `services/webhook-service/src/` fully. Confirm: does a Razorpay
handler exist? Does it call `/storefront/internal/payments/confirm`? What HMAC secret does
it use? Is the webhook URL registered in the Razorpay dashboard?
**Effort:** 3 hours

---

**ID:** U013
**Unknown:** What is the refund SLA from merchant approval to customer receipt? The refund
flow (`complete_order_refund` RPC → `returns.ts`) writes a ledger entry and updates
`refunds.status='refunded'`, but does not call the Razorpay refund API automatically for the
storefront flow (the V1 session path does call `createRazorpayPaymentProvider.refund()`). For
the storefront path a `provider_refund_id` must be supplied manually.
**Category:** Operational / Business
**Why It Matters:** If merchants must manually initiate the Razorpay refund from the Razorpay
dashboard and then supply the `provider_refund_id` to LetBuyy, the refund SLA is effectively
manual and unbounded. This matters for customer trust and for RBI payment-system compliance
(T+5 refund mandate for pre-paid orders).
**Evidence of Gap:** `03-payment-architecture.md §9` — "Non-Razorpay providers must supply
`provider_refund_id` manually." The storefront refund path (`returns.ts`) calls
`complete_order_refund` with `p_provider_refund_id` as an argument — who provides this ID
is not clear from the code.
**How to Resolve:** Read `returns.ts` `POST /v1/returns/:id/refund/complete` fully. Confirm
whether the gateway automatically calls Razorpay API to initiate the refund, or whether the
merchant must do it from Razorpay dashboard. If manual: file as a gap and design auto-refund
initiation.
**Effort:** 2 hours

---

**ID:** U014
**Unknown:** What email templates exist for order confirmation and post-order lifecycle, and
are they configurable per merchant? `order-confirmation-email.ts` defines a hard-coded HTML
template. Whether merchants can customize the template (brand colour, logo, message) is not
determined.
**Category:** Product
**Why It Matters:** A platform-branded confirmation email reduces store credibility. Merchants
expect white-labelled transactional emails. If templates are hard-coded, every store gets the
same email regardless of brand configuration — this conflicts with the India-first brand-
identity goal.
**Evidence of Gap:** `07-order-platform-analysis.md §5` — `buildOrderConfirmationEmail` is
described as a hard-coded template with subject, greeting, items, and total. No per-store
template or dynamic branding injection is mentioned.
**How to Resolve:** Read `services/api-gateway/src/lib/order-confirmation-email.ts` fully.
Confirm whether `brandColor`, `logoUrl`, or `storeName` are injected. If not: assess whether
adding them to the email template is a small enhancement or requires a templating system.
**Effort:** 2 hours

---

**ID:** U015
**Unknown:** What notification channels are active for order status updates (shipped, delivered,
cancelled)? Domain events `order.shipped`, `order.delivered`, `order.cancelled`, and
`order.refunded` are emitted, and `enqueueOrderLifecycleEmail` is called for cancellations
and refunds. Whether email, WhatsApp, or SMS is sent for shipped/delivered status is not
confirmed.
**Category:** Operational / Product
**Why It Matters:** Customers expect real-time notifications after placing an order. If shipped
and delivered events do not trigger customer notifications, the customer experience degrades
and support volume increases. The centralized checkout must specify the notification contract.
**Evidence of Gap:** `07-order-platform-analysis.md §6` — "No explicit push notification
found in orders.ts (would come from queue-workers subscribing to domain events)." The WhatsApp
routes have a `cart_abandonment` session type and `abandoned_cart` template key but no
confirmed shipped/delivered WhatsApp handler.
**How to Resolve:** Read `services/queue-workers/src/` for domain-event consumer handlers.
Map which events trigger which notification actions. Identify gaps (e.g. no SMS on shipped).
**Effort:** 3 hours

---

**ID:** U016
**Unknown:** What is the security sandbox for third-party checkout extensions (iframe
extensions)? The design in doc 15 specifies `sandbox="allow-scripts allow-same-origin"` and
`postMessage` context passing, but no implementation exists. The `extension-routes.ts` gateway
handles app installation and access tokens but has no checkout slot registration. The concrete
threat model for a malicious iframe extension has not been formally reviewed.
**Category:** Security
**Why It Matters:** Before third-party checkout extensions are opened to the app marketplace,
the sandbox policy and postMessage validation must pass a security review. A single XSS or
data-exfiltration vulnerability in the checkout flow is catastrophic — it could expose payment
data to third parties.
**Evidence of Gap:** `15-checkout-extensions.md §4` — "This tier is not implemented in V1.
The extension-routes.ts file provides installation/access-token/bridge infrastructure but has
no checkout slot registration." The iframe sandbox is a design proposal.
**How to Resolve:** Before opening third-party extensions: conduct a formal security review of
the postMessage contract, origin validation, and CSP impact. Define the exact fields excluded
from the extension context (Razorpay key ID, signatures, HMAC secrets). Run the security
review agent (`.claude/commands/full-security-review.md`).
**Effort:** 2-day security review

---

**ID:** U017
**Unknown:** What is the TTL (time-to-live) of a checkout session in the `checkout_sessions`
table? The gateway's hosted checkout state machine persists sessions to `checkout_sessions`
but the prior research did not confirm the `expires_at` value, session cleanup policy, or what
happens when an expired session is resumed.
**Category:** Architecture / Security
**Why It Matters:** Session TTL affects both UX (how long a shopper has to complete checkout
before their session expires) and security (how long an HMAC-signed handoff token is valid
before it can be replayed). The cart handoff URL embeds `expires_at` in its HMAC payload,
but the checkout session's own TTL is a separate parameter that must be set correctly.
**Evidence of Gap:** `12-centralized-checkout-platform.md §4` — session design includes
`expires_at` as a field but its value is not derived from the code read. `checkout.ts §7` in
doc 01 notes the hosted checkout state machine without mentioning TTL.
**How to Resolve:** Read `services/api-gateway/src/routes/checkout.ts` for the
`checkout_sessions` insert statement and `expires_at` computation. Read any cron or queue job
that cleans up expired sessions. Confirm: what is the TTL? Is it enforced on read?
**Effort:** 1 hour

---

**ID:** U018
**Unknown:** Is there a Razorpay domain whitelist that must be updated when checkout moves to
a new origin (`checkout.letbuyy.com`)? Razorpay accounts restrict which origins can open the
checkout modal. If `checkout.letbuyy.com` is not whitelisted, the Razorpay modal will refuse
to open on the new origin.
**Category:** Operational / Architecture
**Why It Matters:** Centralization to `checkout.letbuyy.com` (Phase 3) is blocked until the
Razorpay account is updated. This is an operator action (Razorpay dashboard), not a code
change. It also affects test-mode vs. live-mode keys: each key set may need its own domain
whitelist update.
**Evidence of Gap:** `12-centralized-checkout-platform.md §3, Option C` — "Razorpay account:
add `checkout.letbuyy.com` to the list of allowed referrer domains." This is noted as a
required step but not confirmed as done.
**How to Resolve:** Verify in the Razorpay dashboard (merchant account settings) which domains
are currently whitelisted. Confirm the process for adding new domains. Document the timing
dependency: Razorpay domain changes may take 24–48 hours to propagate.
**Effort:** 1 hour (operator action)

---

**ID:** U019
**Unknown:** Are the post-commit deferrals (`waitUntil` calls for GST invoice generation and
usage metering) guaranteed to complete before the order response is returned to the client?
`isCheckoutPostCommitDeferralEnabled` defaults to `'on'`, deferring these to `waitUntil`. If
the Cloudflare Worker is recycled or hits a CPU-time limit during the deferral, post-commit
work is silently dropped (the catch block logs an error but does not re-enqueue).
**Category:** Operational / Architecture
**Why It Matters:** GST invoices are immutable once set. If GST invoice generation fails
silently and the customer requests a GST invoice, there is no invoice to provide. This affects
B2B buyers who need a GST invoice for input-tax credit claims.
**Evidence of Gap:** `03-payment-architecture.md §10` — "post-commit failures are only logged
and not retried (`catch` at line 399 logs an error but does not re-enqueue)."
**How to Resolve:** Read `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts`
lines 395–405. Confirm whether the `catch` block enqueues a retry job. If not: add a
dead-letter queue for post-commit failures or move GST invoice generation inside the RPC
(synchronous, atomic).
**Effort:** 2 hours code read + product decision on retry strategy

---

**ID:** U020
**Unknown:** What is the `HR-MERCHANT-PSP-LIVE` blocker in `checkout.ts` that prevents the
hosted checkout state machine from running in live mode? This comment appears at line 573
of `checkout.ts` and is cited in docs 02 and 12 as blocking the hosted checkout path. The
exact condition and what must be done to clear it is not documented.
**Category:** Architecture / Operational
**Why It Matters:** The centralized checkout plan (doc 12) depends on activating the hosted
checkout state machine (`/v1/checkout/*`) as the canonical backend. If the `HR-MERCHANT-PSP-LIVE`
blocker is a compliance gate or an unfinished Razorpay integration, it must be cleared before
Phase 2 of the centralization plan can proceed.
**Evidence of Gap:** `02-checkout-flow-audit.md §2` — "this path is gated by a signed handoff
URL from `GET /:subdomain/cart/:cartToken/checkout-url` and is currently blocked in live mode
(`HR-MERCHANT-PSP-LIVE` comment at line 573 of checkout.ts)." No further context on the
blocker is provided in prior research.
**How to Resolve:** Read `services/api-gateway/src/routes/checkout.ts` lines 560–590.
Determine: is `HR-MERCHANT-PSP-LIVE` a feature flag, a conditional on a missing env var, or a
TODO comment with no enforcement? If it is a conditional, identify what env var or DB flag
must be set to enable live mode.
**Effort:** 1 hour

---

## Medium-Priority Unknowns

---

**ID:** U021
**Unknown:** Is the `autoCreateCustomer()` fire-and-forget call (`POST /api/customer/auto-create`)
idempotent? If it is called twice for the same email (e.g. on a page refresh after success or
a payment retry), will it create duplicate customer records?
**Category:** Architecture
**Why It Matters:** Duplicate customer records corrupt the customer database and break saved-
address autofill for returning customers.
**Evidence of Gap:** `02-checkout-flow-audit.md §7` — "`autoCreateCustomer()` fires silently
post-success; errors do not block checkout." No idempotency key is visible in the fire-and-
forget call from the client.
**How to Resolve:** Read `apps/storefront-runtime/src/app/api/customer/auto-create/route.ts`
and the gateway endpoint it proxies to. Confirm whether the underlying RPC uses `ON CONFLICT
DO NOTHING` on `(site_id, email)`.
**Effort:** 1 hour

---

**ID:** U022
**Unknown:** What is the minimum Razorpay key configuration a merchant needs before
`onlinePaymentEnabled` is set to `true`? The `paymentConfigProviderMode()` function requires
`key_secret_ciphertext` to be present and `test_mode === false` for live mode, but it is not
clear whether the platform validates the key with a test API call at save time, or whether an
invalid key is only discovered at checkout when `createIntent` fails.
**Category:** Operational / Product
**Why It Matters:** If a merchant enters a wrong Razorpay key, online payments will fail at
checkout with a generic error. Early-validation at the settings-save step would catch this
before shoppers hit the error.
**Evidence of Gap:** `03-payment-architecture.md §4` — the config save path (`POST payment-
config`) stores the key_id and encrypted key_secret without a live validation call.
**How to Resolve:** Read `services/api-gateway` Razorpay config save handler. Confirm whether
a key-validation API call (e.g. fetch account details from Razorpay) is made at save time. If
not: decide whether to add it.
**Effort:** 2 hours

---

**ID:** U023
**Unknown:** How does the `pending_cod` status interact with the hosted checkout state machine?
The order risk assessment can set `status=pending_cod` when COD risk score >= 35. The hosted
checkout state machine has stages `contact → delivery → payment_intent → completed | failed`
but no `pending_cod` stage. If the centralized checkout uses the hosted state machine, a
`pending_cod` order may leave the session in an ambiguous state.
**Category:** Architecture
**Why It Matters:** The centralized checkout plan must handle the COD confirmation flow. If the
hosted state machine has no `pending_cod` transition, either the state machine must be extended
or the risk assessment must run outside the session lifecycle.
**Evidence of Gap:** `07-order-platform-analysis.md §2` — `pending_cod` is a valid order status
requiring a 12-hour customer confirmation window. `02-checkout-flow-audit.md §2` — the hosted
checkout state machine stages are `contact → delivery → payment_intent → completed | failed`
with no `pending_cod` stage.
**How to Resolve:** Read `services/api-gateway/src/routes/checkout.ts` confirm step. Determine
whether the confirm step invokes risk assessment and what it returns on a medium-risk COD order.
**Effort:** 2 hours

---

**ID:** U024
**Unknown:** Is the `checkout_sessions` table cleaned up by a cron job, or do stale sessions
accumulate? No queue-worker or cron job for session cleanup was confirmed in the prior research.
**Category:** Operational
**Why It Matters:** Unbounded table growth on `checkout_sessions` degrades query performance
over time. For a multi-tenant platform with many stores this is a production database health
concern.
**Evidence of Gap:** `01-checkout-system-inventory.md` — `checkout_sessions` table is used by
`checkout.ts` but no cleanup job was found.
**How to Resolve:** Read `services/queue-workers/src/` for a `checkout_sessions` cleanup cron.
If absent, file as a production-hygiene gap and schedule a `DELETE WHERE expires_at < now()`
cron.
**Effort:** 1 hour

---

**ID:** U025
**Unknown:** Does the checkout form support Indian regional address formats? The address field
is a single `<textarea>` for "House/Flat/Building" and free-text fields for city, state, and
pincode. There is no structured address format (door number, street, landmark, area), no
pincode-to-city autofill, and no state dropdown.
**Category:** Product
**Why It Matters:** Indian addresses often have multiple sub-fields (flat number, building name,
street, area, landmark). A single textarea field leads to inconsistent address capture and
increases delivery failures. The centralized checkout is an opportunity to restructure the
address form for India.
**Evidence of Gap:** `09-conversion-analysis.md §3` — "No Google Places, India Post PIN-to-
city lookup, or any address autocomplete integration exists." The pincode field is a free-text
6-digit input.
**How to Resolve:** Product decision: define the target address schema (structured vs. textarea)
and whether India Post / Google Places autofill is required for V1.
**Effort:** Product decision: 0.5 days. Implementation: 3–5 days (API integration).

---

**ID:** U026
**Unknown:** Does the Cashfree integration have a webhook receiver and a working verify loop?
Cashfree routes exist (`/payments/cashfree/order` and `/payments/cashfree/verify`) but the
storefront checkout UI does not expose Cashfree as a payment option. Whether the Cashfree
adapter is production-ready or a stub is not confirmed.
**Category:** Architecture
**Why It Matters:** Before Cashfree can be surfaced as an alternative to Razorpay (e.g. for
merchants who prefer lower Razorpay fees), the adapter's production readiness and webhook
support must be verified.
**Evidence of Gap:** `01-checkout-system-inventory.md §6` — "Cashfree: routes exist but not
surfaced in the storefront UI." `03-payment-architecture.md §1` — Cashfree listed as ACTIVE
but "not exposed in checkout-client.tsx V1 UI."
**How to Resolve:** Read `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts`
Cashfree order and verify handlers (lines ~700–820). Confirm whether the adapter calls real
Cashfree APIs and whether a webhook receiver exists.
**Effort:** 2 hours

---

**ID:** U027
**Unknown:** What happens when the Razorpay SDK fails to load (CDN unavailable or CSP block)?
The `razorpayLoaded` gate prevents the Pay button from being clickable, but there is no timeout
fallback or user-facing message explaining why the button is disabled.
**Category:** Product
**Why It Matters:** In India, CDN availability can be inconsistent on mobile networks. A
customer who has filled out their address and selected Razorpay as the payment method will see
a permanently disabled Pay button with no explanation. They may believe checkout is broken and
abandon.
**Evidence of Gap:** `01-checkout-system-inventory.md §6` — "Razorpay browser SDK is loaded
via `<Script>` at render time; a `razorpayLoaded` flag gates the Pay button." `09-conversion-
analysis.md §7` — no code-splitting or CDN failure fallback found.
**How to Resolve:** Add a `razorpayLoadTimeout` — if the SDK has not loaded within N seconds,
show an error message and suggest COD as an alternative. This is a low-effort UX improvement.
**Effort:** 2 hours

---

**ID:** U028
**Unknown:** Does the checkout page enforce any rate limit on order creation? A malicious actor
could spam `POST /api/orders` to exhaust Razorpay API credits, inflate usage meters, or
trigger excessive inventory-lock churn.
**Category:** Security
**Why It Matters:** Rate limiting on public checkout endpoints is standard security hygiene.
Without it, a bot could create thousands of pending orders, locking inventory and generating
fraudulent order records.
**Evidence of Gap:** `01-checkout-system-inventory.md §§2–3` — the BFF routes `/api/orders`
and `/api/shipping/rates` are public (unauthenticated) routes with no rate-limit middleware
visible in the route files read.
**How to Resolve:** Check `services/api-gateway/src/middleware/` for a rate-limit middleware
applied to storefront routes. Confirm whether Cloudflare Workers AI rate-limiting or Turnstile
is applied to the order creation path.
**Effort:** 2 hours

---

## Low-Priority Unknowns

---

**ID:** U029
**Unknown:** Is the success screen's "Track Your Order" link deep-linkable to the specific
order? The link navigates to `/store/{subdomain}/orders` (the orders list), not to a specific
order detail page. This means the customer must find their order in a list, which adds friction.
**Category:** Product
**Why It Matters:** Low severity. An order-specific deep link (`/store/{subdomain}/orders/{orderNumber}`)
would reduce post-purchase support volume. Not a blocker for centralization.
**Evidence of Gap:** `02-checkout-flow-audit.md §8` — "Track Your Order → `/store/{subdomain}/orders`".
No per-order URL is generated.
**How to Resolve:** Confirm whether a `/orders/{orderNumber}` detail route exists in
storefront-runtime. If it does: update the success screen link. If not: add it as a low-
priority UX improvement.
**Effort:** 1 hour (route audit) + 1 day (implementation if route absent)

---

**ID:** U030
**Unknown:** Is there a mechanism for merchants to add a custom "thank you" message or
redirect URL on the checkout success screen? The success screen content is hard-coded in
`checkout-client.tsx`. Some merchants may want to redirect to a custom landing page, show
loyalty earn confirmations, or display a post-purchase upsell.
**Category:** Product
**Why It Matters:** Low severity. Post-purchase customization is a standard commerce capability.
The extension design in doc 15 includes a `THANK_YOU_PAGE` slot and a `post_purchase` config
field. This is a Tier 3 extension (future scope).
**Evidence of Gap:** `15-checkout-extensions.md §5` — `post_purchase.redirect_url` is in the
proposed `checkout_extensions` config schema but not implemented.
**How to Resolve:** Defer to Tier 3 extension implementation. No immediate action needed.
**Effort:** 0 (deferred)

---

**ID:** U031
**Unknown:** Does the `storefront.checkouts.started` metric count unique checkout visits or
total navigations (including refreshes)? Merchant dashboard conversion rate calculations depend
on the semantics of this event.
**Category:** Product
**Why It Matters:** Low severity. If the metric double-counts refreshes, the displayed
conversion rate will be artificially low, misleading merchants.
**Evidence of Gap:** `09-conversion-analysis.md §1` — the emission point of
`storefront.checkouts.started` is not confirmed in the checkout-client code. Its deduplication
semantics are unknown.
**How to Resolve:** Once the emission point is found (see U009), confirm whether it guards
against double-counting with a session flag or deduplicated by session ID.
**Effort:** 1 hour

---

**ID:** U032
**Unknown:** Are there any accessibility (WCAG 2.1 AA) issues in the current checkout form?
The checkout is a 1,160-line monolithic component with no accessibility audit referenced in
prior research. Screen reader labels, keyboard navigation order, and error announcement
behaviour are unknown.
**Category:** Product
**Why It Matters:** Low severity for initial launch but required for compliance and broader
market coverage. An inaccessible checkout blocks users with disabilities.
**Evidence of Gap:** Prior research documents (01–16) contain no accessibility analysis.
**How to Resolve:** Run the accessibility audit skill on `checkout-client.tsx`.
**Effort:** 1 day

---

**ID:** U033
**Unknown:** What is the `@letbuyy/checkout-core` package intended to contain, and does it
have any existing source beyond a manifest reference? The storefront-runtime `runtime.manifest.json`
lists it as an allowed dependency, but no such package directory was confirmed in prior research.
**Category:** Architecture
**Why It Matters:** Low severity. The centralization plan (doc 12 §5) proposes moving form
validation, idempotency utilities, and `buildOrderPayload` into this package. If it does not
exist, it must be scaffolded before Phase 1 extraction begins.
**Evidence of Gap:** `12-centralized-checkout-platform.md §5` — "The storefront-runtime
manifest already declares `@letbuyy/checkout-core` as an allowed workspace package dependency.
This package does not currently exist as a deployed package."
**How to Resolve:** `ls packages/checkout-core` or grep `pnpm-workspace.yaml`. If absent,
scaffold as a TypeScript package before Phase 1 work.
**Effort:** 0.5 hours (check) + 0.5 days (scaffold if absent)

---

## Architecture Decisions Required

| Decision | Options | Tradeoffs | Recommendation | Who Decides |
|---|---|---|---|---|
| Checkout URL strategy | A: per-store subdomain `checkout.{store}.letbuyy.com`; B: path-based same origin `{store}.letbuyy.com/checkout`; C: central `checkout.letbuyy.com/{store}` | A = strong brand but wildcard cert complexity; B = no CORS change but shared deployment; C = full independence + A/B capability but cross-origin cart handoff required | Phase 1 = no change; Phase 2 = Option B; Phase 3 = Option C (see doc 12) | Product + ARB |
| Checkout session token issuer | Reuse identity-platform ES256 JWKS; OR introduce new HS256 checkout-specific secret; OR use the existing HMAC cart-handoff token as a session bearer | ES256 = strong, existing infrastructure; HS256 = simpler but shared-secret rotation risk; HMAC cart token = single-use, not suitable as a bearer | Introduce a new short-lived HS256 checkout session JWT scoped to `(site_id, cart_id)`, rotated per checkout session | ARB (security) |
| Inbound payment webhook receiver location | Add to api-gateway alongside existing routes; OR expand webhook-service to own the Razorpay receiver | Gateway = co-located with payment routes and internal confirm endpoint; webhook-service = isolated but requires cross-service call | Add to webhook-service (existing pattern); webhook-service calls `/storefront/internal/payments/confirm` | Engineering lead |
| Cart handoff protocol for Phase 1 | Continue using React context pass-through (no change); OR switch to HMAC-signed URL immediately | Context = zero migration risk but blocks central checkout; HMAC URL = enables future centralization but requires cart-client.tsx change | Implement HMAC URL generation in cart-client.tsx as Phase 1 preparation step; keep context as fallback | Engineering lead |
| Inventory reservation timeout | Keep current (no timeout — manual cancellation only); OR add a cron job that cancels `pending` orders older than N minutes | No timeout = risk of stock lock on abandoned payments; cron = automatic recovery but may cancel genuine slow-network payments | Add a 15-minute timeout cron that transitions `pending` Razorpay orders to `cancelled` and releases inventory; exempt COD orders from this timeout | Engineering lead + Product |
| COD rules for V1 launch | Ship with binary `cod_enabled` toggle (no value limit, no pincode restriction); OR add `cod_rules` config before launch | No rules = faster launch but higher RTO rates; rules = more production-ready but 3–5 additional days | Ship with binary toggle for V1 (COD risk scoring already exists); add `cod_rules` config in the sprint after launch | Product |
| GST invoice failure handling | Current: silent failure (log-only); OR move generation inside RPC (synchronous); OR add dead-letter retry queue | Silent = simple but leaves B2B buyers without invoices; RPC = atomic but slower order creation; DLQ = retry without blocking order creation | Add a DLQ entry on `waitUntil` catch and a reconciliation job that re-generates missing invoices for orders with `gstin` set | Engineering lead |

---

## Summary Table

| ID | Unknown | Category | Priority | Blocks | Resolution |
|---|---|---|---|---|---|
| U001 | Cart persistence strategy (localStorage vs server `carts` table) | Architecture | Critical | Centralization cart handoff protocol | Code read + product decision |
| U002 | Razorpay inbound webhook receiver existence and URL | Security / Operational | Critical | Revenue recovery for dropped verify calls | Code read `webhook-service/src/` |
| U003 | Checkout CSRF / session-fixation defence for central-origin checkout | Security | Critical | Phase 3 checkout.letbuyy.com session design | ARB decision on token design |
| U004 | Payment amount reconciliation process (server vs Razorpay capture) | Security / Operational | Critical | Confidence that amounts are not silently miscaptured | RPC SQL read + gap assessment |
| U005 | Guest order claim flow post-purchase | Product | Critical | Post-purchase account conversion design | Read storefront orders page |
| U006 | Checkout URL strategy decision | Architecture | Critical | All centralization work — CORS, cookies, Razorpay | Product + ARB decision |
| U007 | Inventory reservation timeout / release policy | Architecture / Operational | Critical | Stock availability under payment abandonment | Queue-workers cron read |
| U008 | Split payment: gift card + Razorpay/COD remainder behaviour | Product / Architecture | Critical | Gift card UI design and zero-amount Razorpay edge case | RPC SQL read + product decision |
| U009 | `storefront.checkouts.started` emission point | Product / Architecture | Critical | Metric continuity when checkout moves app | Repo grep |
| U010 | COD limit rules (per-store configurable vs absent) | Business / Operational | Critical | COD serviceability for V1 launch | Product decision |
| U011 | Shipping zone completeness and pincode filtering semantics | Operational | High | Shipping rate accuracy at address capture | `shipping.ts` read |
| U012 | Razorpay webhook events subscribed in webhook-service | Operational / Security | High | Payment recovery confidence | `webhook-service/src/` read |
| U013 | Refund SLA (auto-initiate vs manual provider_refund_id) | Operational / Business | High | RBI T+5 compliance and merchant UX | `returns.ts` read |
| U014 | Email template customisation per merchant | Product | High | White-label transactional emails | `order-confirmation-email.ts` read |
| U015 | Order notification channels for shipped/delivered status | Operational / Product | High | Customer communication completeness | Queue-workers domain event consumers read |
| U016 | Extension security sandbox formal review | Security | High | Opening third-party checkout extensions | Security review |
| U017 | Checkout session TTL and cleanup policy | Architecture / Security | High | Session expiry design and DB hygiene | `checkout.ts` read |
| U018 | Razorpay domain whitelist update for `checkout.letbuyy.com` | Operational | High | Phase 3 URL migration | Razorpay dashboard check |
| U019 | Post-commit deferral failure (GST invoice silent drop) | Operational / Architecture | High | B2B GST invoice reliability | `checkout-payment-routes.ts` lines 395–405 |
| U020 | `HR-MERCHANT-PSP-LIVE` blocker in `checkout.ts` | Architecture / Operational | High | Activating hosted checkout state machine | `checkout.ts` lines 560–590 read |
| U021 | `autoCreateCustomer()` idempotency | Architecture | Medium | Duplicate customer records | `auto-create/route.ts` read |
| U022 | Razorpay key validation at config save | Operational / Product | Medium | Early-fail on misconfigured keys | Gateway payment-config handler read |
| U023 | `pending_cod` status in hosted checkout state machine | Architecture | Medium | COD flow in centralized checkout | `checkout.ts` confirm step read |
| U024 | `checkout_sessions` table cleanup / cron | Operational | Medium | DB growth and query performance | Queue-workers cron read |
| U025 | Indian address format support | Product | Medium | Address capture accuracy | Product decision |
| U026 | Cashfree production readiness | Architecture | Medium | Multi-provider launch readiness | Cashfree adapter code read |
| U027 | Razorpay SDK CDN failure fallback UX | Product | Medium | Checkout abandonment on mobile | UX implementation |
| U028 | Rate limiting on public checkout endpoints | Security | Medium | Bot/spam order creation | Middleware audit |
| U029 | Order-specific deep link from success screen | Product | Low | Post-purchase UX | Storefront orders route audit |
| U030 | Merchant custom thank-you message / redirect | Product | Low | Post-purchase customisation | Deferred (Tier 3 extension) |
| U031 | `storefront.checkouts.started` deduplication semantics | Product | Low | Conversion rate accuracy | Follow-on from U009 |
| U032 | Checkout accessibility (WCAG 2.1 AA) | Product | Low | Compliance and inclusivity | Accessibility audit |
| U033 | `@letbuyy/checkout-core` package existence and scaffold | Architecture | Low | Phase 1 extraction | `ls packages/checkout-core` |
