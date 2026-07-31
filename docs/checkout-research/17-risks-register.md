# Checkout Platform — Risks Register

> Evidence-based. All findings drawn from prior research documents 01–16 and their cited
> source files. No code was modified. Risk IDs are stable — reference them in PRs and
> remediation tickets.
>
> Research date: 2026-06-18

---

## Risk Rating Framework

| Dimension | Values |
|---|---|
| **Severity** | CRITICAL / HIGH / MEDIUM / LOW |
| **Probability** | CERTAIN / LIKELY / POSSIBLE / UNLIKELY |
| **Risk Score** | Severity × Probability (4×4 = 16 max) |

| Severity weight | Probability weight |
|---|---|
| CRITICAL = 4 | CERTAIN = 4 |
| HIGH = 3 | LIKELY = 3 |
| MEDIUM = 2 | POSSIBLE = 2 |
| LOW = 1 | UNLIKELY = 1 |

Score range: 1 (LOW × UNLIKELY) → 16 (CRITICAL × CERTAIN).

---

## CRITICAL Risks

---

**Risk ID:** R001
**Category:** Payment
**Description:** Double-charge risk when a customer re-submits the checkout form after a network error or tab-focus restore. The idempotency key for the Razorpay order (`getIdempotencyKey('payment-razorpay')`) is stored in a `useRef` inside `CheckoutClient`. If the page is refreshed — or if the customer opens the checkout in a second tab — a new `crypto.randomUUID()` key is generated. Submitting payment from both contexts creates two separate Razorpay orders and two separate `create_checkout_order` DB rows, each with a distinct idempotency key. Both orders reserve inventory. Both can independently reach `confirm_order_payment_with_ledger`. The customer can be charged twice.
**Evidence:**
- `checkout-client.tsx` line 172: `useRef<Record<string, string>>({})` — idempotency keys live in component state, not `sessionStorage` or server-side session.
- `02-checkout-flow-audit.md §5`: "Idempotency keys scoped per checkout instance (`useRef` for idempotencyKeysRef, line 172) mean retrying with the same key on the same page load will replay the cached response."
- `12-centralized-checkout-platform.md §9`: "Idempotency keys lost on page refresh (stored in `useRef`)."
- `03-payment-architecture.md §5`: IdempotencyExecutionAdapter scopes uniqueness to `(siteId, key, scope)` — two different keys for the same logical purchase are treated as two independent transactions.
**Trigger:** Customer refreshes the page between clicking "Pay" and Razorpay modal completion; customer opens checkout in two browser tabs simultaneously; network error causes checkout component to remount.
**Impact:** Customer is charged twice for the same order. Two order rows are created in the DB. Inventory is over-reserved. Merchant receives two payments for one shipment. Customer files a chargeback. Platform reputation damage.
**Current Mitigation:** `assertProviderPaymentNotReplayed` in `checkout-payment-routes.ts` prevents the *same* `razorpay_payment_id` from being confirmed against two different orders. This prevents replay of a captured payment but does NOT prevent two separate payment captures with different payment IDs.
**Gap in Mitigation:** Idempotency keys are not persisted across page reloads. No server-side checkout session prevents the same customer from creating two independent checkout flows. No cart-level lock prevents concurrent order creation from the same cart.
**Recommendation:** (1) Move idempotency keys from `useRef` to `sessionStorage` (Phase 1 fix from `12-centralized-checkout-platform.md §8`). (2) Derive the idempotency key from the cart token (`lb_cart_token`) so the same cart always produces the same key. (3) Add a DB-level uniqueness constraint on `(site_id, cart_token, payment_method)` to `orders` table — reject second order creation from the same active cart. (4) On the gateway, lock the cart row `FOR UPDATE` during `create_checkout_order` to prevent concurrent submissions.
**Severity:** CRITICAL
**Probability:** POSSIBLE
**Score:** 8

---

**Risk ID:** R002
**Category:** Payment / Security
**Description:** Amount manipulation through client-declared totals reaching the Razorpay intent. While `checkout-payment-routes.ts` correctly re-reads `orders.total` from the DB and rejects `amountMinorUnits` mismatches with a 400 `AMOUNT_MISMATCH` response, the check is only performed when the client *sends* an `amountMinorUnits` field. If the client omits this optional field, the server uses the DB amount directly — which is correct behaviour. However, the client also computes `totalAmount` locally (line 249 of `checkout-client.tsx`: `cartTotal + effectiveDeliveryCharges - discountAmount`) and displays it in the "Pay ₹X" button. A forged request that posts `paymentMethod: 'cod'` with manipulated item quantities bypasses the Razorpay payment entirely and creates a COD order — COD orders skip the `amountMinorUnits` check entirely because there is no payment phase. The product prices are resolved server-side inside `create_checkout_order` RPC, but the *item list* (productId, variantId, quantity) comes from the client.
**Evidence:**
- `checkout-client.tsx` lines 338–364: `buildOrderPayload` sends `items: [{ productId, variantId, quantity }]` — quantity is client-declared.
- `02-checkout-flow-audit.md §1`: "No prices are sent by the client. Prices are computed server-side."
- `03-payment-architecture.md §5`: "Amount is re-fetched from `orders.total` and converted to minor units (`Math.round(total * 100)`) at line 474."
- `checkout-client.tsx` line 249: `totalAmount = cartTotal + effectiveDeliveryCharges - discountAmount` — client total used for display and button label; a crafted request can send quantity=9999 directly to `/api/orders`.
**Trigger:** Attacker sends a crafted `POST /api/orders` request with `quantity: 9999` for a ₹1 item, selecting COD payment. The RPC creates a ₹9,999 order at the correct DB price, with `payment_status: 'pending'`. The attacker collects the goods on COD without ever paying online.
**Impact:** A single COD order for maximum-quantity items can drain inventory and be abandoned at delivery, causing financial loss equal to the product cost. For high-value items this is direct fraud.
**Current Mitigation:** `create_checkout_order` RPC validates product existence and stock availability. The RPC uses DB prices, not client prices. Monthly order quota check (`plan_order_quota`) limits total order creation.
**Gap in Mitigation:** No per-order quantity cap is enforced server-side. No rate limit on `POST /api/orders` per customer identity (email/phone/IP). COD orders bypass all payment capture validation.
**Recommendation:** (1) Add a `max_quantity_per_item` guard in the `create_checkout_order` RPC (e.g. 50 units per line item, configurable per store). (2) Add rate limiting on `POST /api/orders` per IP and per email address in the gateway middleware. (3) For COD orders above a configurable value threshold, require risk assessment before confirming inventory reservation. The risk system (`order-risk.ts`) already computes a score on order creation — wire its HIGH-risk action to block COD acceptance rather than just requesting confirmation.
**Severity:** CRITICAL
**Probability:** POSSIBLE
**Score:** 8

---

**Risk ID:** R003
**Category:** Security / Payment
**Description:** Cart session hijacking through `lb_cart_token` theft from `localStorage`. The cart token is stored in `localStorage` under the key `lb_cart_token`. `localStorage` is accessible to any JavaScript running on the same origin — including any XSS payload, browser extension with host permissions, or third-party script loaded on the storefront page. An attacker who obtains the cart token can craft a `PATCH /api/storefront/{subdomain}/cart/{cartToken}` request to modify the cart contents (add items, change quantities) before checkout is initiated, or submit a `POST /api/orders` with the stolen session data.
**Evidence:**
- `cart-context.tsx` lines 111, 129: `localStorage.setItem(CART_TOKEN_STORAGE_KEY, ...)` and `localStorage.getItem(CART_TOKEN_STORAGE_KEY)`.
- `01-checkout-system-inventory.md §5`: "Cart state lives in `CartContext` (persisted to `localStorage` with keys `lb_cart` and `lb_cart_token`)."
- `04-checkout-ui-architecture.md §6`: "There are no cookies, URL params, or session-storage used for checkout state in the storefront-runtime client."
- `cart-routes.ts`: `PATCH /{subdomain}/cart/{cartToken}` — the cart token is the only authentication for cart modification; there is no session cookie or signed token binding the cart to the browser session.
**Trigger:** A reflected XSS vulnerability anywhere on the storefront reads `localStorage.lb_cart_token`. A malicious browser extension reads all `localStorage` on `*.letbuyy.com`. An attacker intercepts the cart token from browser devtools or a log.
**Impact:** Attacker adds expensive items to a victim's cart immediately before the victim reaches the payment step. The victim sees the inflated total only after the Razorpay modal opens. Server-authoritative pricing means the victim pays the correct inflated amount. For COD, the victim places an order for items they did not intend to purchase, leading to disputes.
**Current Mitigation:** The cart token is a UUID — it is not easily guessable. The `create_checkout_order` RPC re-validates product prices server-side.
**Gap in Mitigation:** The cart token provides no authenticated binding to the browser session. No HMAC-signed cart token or session cookie prevents token theft and reuse. The gateway's `cart-routes.ts` does not validate that the requestor's session matches the cart's `customer_id` or `buyer_email` for unauthenticated guests.
**Recommendation:** (1) For the hosted checkout path (`checkout.ts`), the HMAC-signed cart handoff URL already binds the cart to a specific session. Use this path for all production checkouts. (2) For the inline storefront checkout, add a short-lived signed cart claim token (HMAC of `cart_token + expires_at + site_id`) stored in `sessionStorage` rather than `localStorage`. (3) Add `SameSite=Strict` cookie-based session hint binding the browser session to the cart before checkout.
**Severity:** CRITICAL
**Probability:** POSSIBLE
**Score:** 8

---

**Risk ID:** R004
**Category:** Security / Multi-Tenancy
**Description:** RLS bypass risk on the internal payment routes. `POST /storefront/internal/payments/confirm` is protected only by `isInternalApiSecretRequest` which checks for a matching `INTERNAL_API_SECRET` header value. This is a shared secret across all workers and queue jobs in the platform. Any service with the `INTERNAL_API_SECRET` can call `confirm_order_payment_with_ledger` for any `orderId` across all tenants. If the internal API secret leaks (e.g. via a compromised queue-worker environment variable), an attacker can confirm payment for any pending order of any store without going through the Razorpay verification step.
**Evidence:**
- `internal-payment-routes.ts`: `POST /storefront/internal/payments/confirm` — body: `{ orderId, provider, providerPaymentId, idempotency_key }`.
- `01-checkout-system-inventory.md §3`: "The internal routes are gated by `isInternalApiSecretRequest` (INTERNAL_API_SECRET env var)."
- `03-payment-architecture.md §7`: "Internal payment routes (`internal-payment-routes.ts`) expose worker-to-gateway endpoints for programmatic payment confirmation... These are secured by `isInternalApiSecretRequest`."
- `CLAUDE.md security rules`: "Two issuers, never crossed: customer HS256 (`CUSTOMER_SESSION_SECRET`); merchant ES256 (`LETBUYY_IDENTITY_PUBLIC_JWKS`). Step-up (HMAC) gates refunds/payouts."
**Trigger:** `INTERNAL_API_SECRET` environment variable leaks via a misconfigured log aggregator, a compromised CI/CD secret, or a malicious insider. Attacker calls `POST /storefront/internal/payments/confirm` with any valid `orderId`.
**Impact:** Orders are fraudulently confirmed as paid without any real payment. Merchants dispatch goods. Platform ledger shows revenue that never materialised. GST invoices are generated for non-existent payments. Financial loss equals the total value of fraudulently confirmed orders.
**Current Mitigation:** `isInternalApiSecretRequest` gate. The `orderId` must correspond to a real `pending` order (the RPC validates order state before updating).
**Gap in Mitigation:** The `INTERNAL_API_SECRET` is a single shared credential — no rotation policy, no per-service scoping, no per-tenant scope enforcement on the internal endpoint. A compromised secret grants unlimited access to all tenants' payment confirmation.
**Recommendation:** (1) Scope the internal payment confirmation to include a `site_id` parameter that is cross-checked against the `orderId`'s `store_id` in the RPC. (2) Add per-tenant HMAC signing on the internal queue envelope (this is partially implemented via `signQueueTenantEnvelope` but verify it is enforced on the payment confirm path). (3) Implement secret rotation for `INTERNAL_API_SECRET` on a 90-day schedule. (4) Add structured audit logging on every call to internal payment routes.
**Severity:** CRITICAL
**Probability:** UNLIKELY
**Score:** 4

---

**Risk ID:** R005
**Category:** Security / Payment
**Description:** Razorpay key exposure risk. The merchant's `key_id` is returned in the `/payments/razorpay/order` API response and used to initialise the Razorpay browser SDK (`window.Razorpay({ key: data.keyId })`). While `key_id` alone cannot initiate charges (it is a public identifier), the `key_secret` — stored as `key_secret_ciphertext` using AES-GCM in the `sites.payment_settings` JSONB — is decrypted in the gateway process to create Razorpay orders. If the AES-GCM encryption key (`encryptionKey` derived from SHA-256 of a string — `store-payment-config.ts:37`) is weak or predictable, the `key_secret` can be recovered. Additionally, the payment settings page in `merchant-control-plane` (`settings/payments/page.tsx`) accepts `key_id` and `key_secret` in a `POST` form — the `key_secret` is submitted as a plain password input field. If HTTPS is not enforced end-to-end (which it is by default on Vercel, but could break in development or misconfigured reverse proxy), the secret transmits in plaintext.
**Evidence:**
- `store-payment-config.ts:37`: `encryptPaymentSecret(secret, encryptionKey)` — key is `SHA-256(encryptionKey_string)`. The string's entropy is environment-dependent.
- `03-payment-architecture.md §4`: "Encryption: AES-GCM with a 12-byte random IV; the key is derived from SHA-256 of the `encryptionKey` string. Ciphertext stored as `base64(iv):base64(ciphertext)`."
- `01-checkout-system-inventory.md §6`: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` in the gateway. Merchant-specific keys stored encrypted.
- `checkout-client.tsx:488`: `key: data.keyId` — `key_id` sent to browser.
**Trigger:** Weak `encryptionKey` env variable (short string, dictionary word, or reuse of another secret). Compromised Cloudflare Workers env variable. HTTPS misconfiguration in a staging environment that allows plaintext `POST /payment-config`.
**Impact:** Merchant's Razorpay `key_secret` is recovered. Attacker creates Razorpay orders in the merchant's account, potentially issuing refunds or fetching payment data. Merchant's Razorpay account is compromised.
**Current Mitigation:** AES-GCM encryption with random IV. `sanitizePaymentSettings()` masks `key_id` and omits `key_secret_ciphertext` from API responses. `key_secret` is never returned after the initial save.
**Gap in Mitigation:** The encryption strength depends entirely on the `encryptionKey` string's entropy. No key-length or entropy requirement is enforced. The AES-GCM key derivation uses SHA-256 of a string rather than a proper KDF (HKDF or PBKDF2 with salt).
**Recommendation:** (1) Replace `SHA-256(encryptionKey_string)` with a proper KDF: `HKDF(ikm=rawKey, salt=storeId, info='razorpay-key-secret', hash='SHA-256', length=32)`. (2) Enforce minimum 32-byte entropy on the `encryptionKey` environment variable at startup. (3) Add an integrity check: after decryption, validate that the `key_id` prefix matches (`rzp_test_` or `rzp_live_`) before using the decrypted secret.
**Severity:** CRITICAL
**Probability:** UNLIKELY
**Score:** 4

---

**Risk ID:** R006
**Category:** Payment / Security
**Description:** Payment replay attack — reusing a Razorpay `payment_id` to confirm a different order. An attacker who observes a legitimate `POST /payments/razorpay/verify` call (e.g. via MitM on a compromised network, or by owning the Razorpay account and extracting payment IDs from the Razorpay dashboard) could submit the same `razorpay_payment_id` against a second order before `assertProviderPaymentNotReplayed` records it. There is a race condition window between the HMAC verification step and the `confirm_order_payment_with_ledger` RPC's idempotency insert.
**Evidence:**
- `checkout-payment-routes.ts:617`: `assertProviderPaymentNotReplayed` — queries `payment_transactions` for existing `provider_payment_id`.
- `03-payment-architecture.md §2`: "Security: order.payment_id MUST match razorpay_order_id (cross-order replay prevention). `assertProviderPaymentNotReplayed` — check payment ID not already recorded for another order."
- `02-checkout-flow-audit.md §5`: "Idempotency on verify: if re-submitted with same key, idempotency.begin returns 'replay' and returns cached response." — this covers same-key replay but not same-payment-id different-key replay.
**Trigger:** An attacker owns multiple stores on LetBuyy. They successfully pay for an item on Store A (obtaining a real `razorpay_payment_id`). They immediately submit that same `payment_id` against a high-value order on Store B before Store A's confirmation has been committed. The race window is the time between the `assertProviderPaymentNotReplayed` read and the `confirm_order_payment_with_ledger` write.
**Impact:** A real payment from Store A is fraudulently reused to confirm a high-value order on Store B. The Store A order is also confirmed (the RPC writes both). Platform gets double revenue attribution but the actual payment amount only covers one order.
**Current Mitigation:** `assertProviderPaymentNotReplayed` throws `ConflictError` if `(gateway='razorpay', provider_payment_id)` already exists in `payment_transactions`. The `idempotency_keys` table provides per-scope replay prevention.
**Gap in Mitigation:** The `assertProviderPaymentNotReplayed` check is a read before write — not an atomic compare-and-insert. Under concurrent submission, two goroutines can both pass the read check before either writes. No `payment_transactions` unique constraint on `provider_payment_id` is confirmed in the code.
**Recommendation:** (1) Add a database-level `UNIQUE` constraint on `payment_transactions(gateway, provider_payment_id)` — this makes the check atomic. (2) Add `site_id` to the uniqueness scope check: a payment from Store A's Razorpay account cannot confirm an order belonging to Store B's `site_id`. (3) After HMAC verification, fetch the Razorpay payment object server-side to confirm the `amount` matches the order total before calling `confirm_order_payment_with_ledger` (currently done only for subscription payments via `fetchRazorpayPayment`).
**Severity:** CRITICAL
**Probability:** UNLIKELY
**Score:** 4

---

**Risk ID:** R007
**Category:** Fraud / Payment
**Description:** COD fraud through fake delivery confirmation. COD orders are created with `payment_status: 'pending'` and remain pending until the merchant manually marks the order as `delivered` (via `PATCH /v1/orders/:id` with `status: 'delivered'`). The COD reconciliation system (`cod-reconciliation.ts`) records physical collection and bank deposit, but the trigger for `status=delivered` is entirely merchant-controlled with no carrier verification. A malicious merchant could mark COD orders as delivered (triggering the `order.paid` domain event) before the physical delivery occurs, artificially inflating revenue metrics and potentially manipulating payout calculations.
**Evidence:**
- `07-order-platform-analysis.md §2`: "delivered: Merchant transitions via PATCH `/orders/:id` → `payment_status=paid`; `order.delivered` + `order.paid` events."
- `03-payment-architecture.md §3`: "COD orders are created with `payment_status='pending'` and flow to delivery. No payment is confirmed at order time. The payment is physically collected by the delivery agent and reconciled later."
- `cod-reconciliation.ts`: `POST /cod/reconciliation` — records physical collection; `status='collected'`; `collected_amount_minor` set by merchant API call. No third-party verification step.
**Trigger:** Merchant marks all COD orders as delivered immediately after creation. No actual delivery happens. Revenue appears confirmed in the ledger. Merchant uses this to manipulate platform metrics or subscription quotas.
**Current Mitigation:** `cod_reconciliation_entries` lifecycle (`pending → collected → reconciled`) requires separate reconciliation steps. The `reconcile_cod_remittance_with_ledger` RPC writes the canonical ledger entry only after bank deposit is recorded.
**Gap in Mitigation:** The merchant can call `PATCH /orders/:id` with `status: 'delivered'` at any time, which sets `payment_status=paid` and emits `order.paid`. This is disconnected from the COD reconciliation lifecycle. There is no gate requiring a COD reconciliation entry to be in `collected` or `reconciled` state before `delivered` is accepted.
**Recommendation:** (1) Add a guard in the `orders.ts` status transition handler: if `payment_method=cod` and `status` is being set to `delivered`, require either a matching `cod_reconciliation_entries` row with `status=collected` or an explicit override with step-up verification. (2) Add anomaly detection to LCIS: flag stores with COD delivery confirmation rate > 95% within 24 hours of order creation. (3) For the COD risk score >= HIGH path, require carrier tracking confirmation before allowing `delivered` transition.
**Severity:** CRITICAL
**Probability:** POSSIBLE
**Score:** 8

---

**Risk ID:** R008
**Category:** Performance / Payment
**Description:** Inventory race condition leading to oversell at checkout. The `create_checkout_order` RPC reserves inventory atomically. However, there is a window between the client-side cart-item quantity check and the server-side RPC execution. Multiple customers can add the last available unit to their carts simultaneously. When both reach checkout and call `POST /api/orders`, the first RPC call succeeds and reserves the unit; the second call should fail with 'insufficient stock'. The risk is: (a) if the RPC's `FOR UPDATE` lock contention causes timeouts under high concurrency, one reservation may silently fail without proper error propagation; (b) the shipping rate is fetched at checkout mount with `pincode: '000000'` — if the real pincode would trigger a COD serviceability block, the customer sees COD available until they submit, then faces an error at order creation.
**Evidence:**
- `02-checkout-flow-audit.md §4`: "The `create_checkout_order` RPC performs server-side validation: Products must exist and be active. Inventory is checked and reserved atomically."
- `02-checkout-flow-audit.md §6`: "`create_checkout_order` RPC throws with 'insufficient stock' message. Gateway converts to 400 response with ValidationError. Client: `result.success` is false → `showCheckoutError('Order creation failed. Please try again.')`. No stock-specific message surfaced to user in V1."
- `01-checkout-system-inventory.md §3`: `db.from('inventory_reservations').select(...)` — checkout.ts reads existing reservations. No explicit `FOR UPDATE` is visible in gateway-layer code (RPC handles locking internally).
- `08-shipping-platform-analysis.md §3`: "checkout-client.tsx:220–223 — shipping rates fetched with `pincode: '000000'` (hardcoded placeholder)."
**Trigger:** Flash sale or limited-stock product. Hundreds of concurrent buyers reach checkout simultaneously. The RPC handles locking but errors surface as a generic "Order creation failed" message that gives no stock-specific guidance. Buyers retry repeatedly, creating compounded load. COD availability shown incorrectly for pincodes that would fail serviceability.
**Impact:** Customers who had items in cart cannot complete checkout. Poor UX due to generic error message. Potential oversell if the RPC lock contention causes a timeout that is incorrectly treated as success. COD fraud risk if COD is shown as available for a pincode where it should be blocked but the serviceability check never runs.
**Current Mitigation:** The `create_checkout_order` RPC reserves inventory atomically inside a `SECURITY DEFINER` function. The gateway returns a 400 ValidationError on stock failure.
**Gap in Mitigation:** No stock-specific error message is surfaced to the customer. The pincode placeholder `'000000'` prevents real-time COD availability check before the order submission step. No cart-time stock check to warn customers before they reach payment.
**Recommendation:** (1) Parse the RPC error code/message in the gateway and return a typed error (`INSUFFICIENT_STOCK`, `COD_UNAVAILABLE`, `SHIPPING_UNAVAILABLE`) instead of a generic 400. (2) In `checkout-client.tsx`, map these typed errors to user-friendly messages. (3) Re-fetch shipping rates with the real pincode when the user fills the pincode field (not `'000000'`). (4) Add a pre-submission stock check for items in the cart before the order creation call.
**Severity:** CRITICAL
**Probability:** LIKELY
**Score:** 12

---

## HIGH Risks

---

**Risk ID:** R009
**Category:** Payment / Security
**Description:** No inbound Razorpay webhook receiver exists in the API gateway. If the customer's browser closes, crashes, or loses connectivity after the Razorpay modal succeeds but before the `POST /payments/razorpay/verify` call completes, the order remains `payment_status: 'pending'` indefinitely. There is no server-side mechanism to reconcile these orphaned orders. Razorpay fires a `payment.captured` webhook when a payment succeeds on their side — this webhook has no receiver in LetBuyy.
**Evidence:**
- `03-payment-architecture.md §7`: "There is no inbound Razorpay webhook receiver in the api-gateway routes. The payment verification flow is client-initiated... if the client tab is closed before `/payments/razorpay/verify` is called (e.g., network drop after Razorpay modal closes), the order stays in `pending` forever. No server-side reconciliation or provider-poll mechanism exists to recover these."
- `16-future-state-checkout.md Appendix A`: "No inbound Razorpay webhook receiver (03 §7, §10) → New `POST /v1/webhooks/razorpay` receiver in api-gateway; feeds `payment.failed` domain event."
**Trigger:** Network drop between Razorpay modal success and the verify API call. Razorpay's `payment.captured` webhook fires on their side but has no receiver on LetBuyy's side.
**Impact:** Customer is charged by Razorpay but their order stays `pending`. They do not receive an order confirmation. Merchant does not fulfil the order. Customer files a chargeback. Revenue is not recorded in the canonical ledger. Inventory reservation remains held indefinitely.
**Current Mitigation:** The `internal-payment-routes.ts` `POST /storefront/internal/payments/confirm` endpoint provides a programmatic confirmation path for queue workers — but no inbound Razorpay webhook processor populates this queue.
**Gap in Mitigation:** No inbound Razorpay webhook handler. No periodic reconciliation job that queries the Razorpay API for payments without a corresponding `payment_transactions` row.
**Recommendation:** (1) Implement `POST /v1/webhooks/razorpay` in the api-gateway that verifies the webhook signature using the `X-Razorpay-Signature` header and calls `POST /storefront/internal/payments/confirm` for `payment.captured` events. (2) Add a background reconciliation job in `queue-workers` that, every 15 minutes, queries Razorpay for all payments in the last hour and cross-checks against `payment_transactions` — any captured payment without a ledger entry triggers `confirm_order_payment_with_ledger`. (3) This is a **blocking requirement** before production launch with Razorpay live keys.
**Severity:** HIGH
**Probability:** LIKELY
**Score:** 9

---

**Risk ID:** R010
**Category:** Security / Multi-Tenancy
**Description:** Guest order enumeration via the storefront order lookup endpoint. `GET /api/orders/check?contact={emailOrPhone}&subdomain={subdomain}` returns `{ hasOrders: boolean, hasPassword: boolean }` without any authentication, rate limiting, or CAPTCHA. An attacker can enumerate whether any email or phone number has placed orders on any LetBuyy store by brute-forcing the `contact` parameter.
**Evidence:**
- `07-order-platform-analysis.md §10`: "`GET /api/orders/check?contact={emailOrPhone}&subdomain={subdomain}` — returns `{ hasOrders: boolean, hasPassword: boolean }`. Calls `getOrderContactSummary`. No authentication token required for the check."
- `01-checkout-system-inventory.md §1`: `apps/storefront-runtime/src/app/api/orders/check/route.ts` — "Order lookup by order number / email for guest order tracking."
- `09-conversion-analysis.md §3`: No rate limiting or bot protection on checkout flow is referenced in any of the prior research documents for storefront-facing BFF routes.
**Trigger:** Attacker sends automated requests to `GET /api/orders/check?contact=<email>&subdomain=<store>` across a list of known email addresses. Response reveals customer purchase history on the platform.
**Impact:** Attacker builds a list of LetBuyy customers and their store affiliations. Customer PII exposure. Competitive intelligence for phishing campaigns. Violation of India's DPDP Act (Digital Personal Data Protection Act) regarding unauthorised access to personal data.
**Current Mitigation:** The response only returns `hasOrders: boolean` and `hasPassword: boolean` — no order details are leaked. Subdomain is required, limiting mass enumeration across all stores to known subdomain lists.
**Gap in Mitigation:** No rate limiting on the `/api/orders/check` endpoint. No Turnstile CAPTCHA gate (Turnstile is used for registration/login per `CLAUDE.md` but not confirmed for this endpoint). No IP-based throttling.
**Recommendation:** (1) Add Cloudflare rate limiting on `GET /api/orders/check` — maximum 5 requests per IP per minute per subdomain. (2) Add Turnstile CAPTCHA gate: require a valid Turnstile token in the request header before processing the contact lookup. (3) Introduce a delay response (200ms minimum) to slow automated enumeration even if it bypasses rate limits.
**Severity:** HIGH
**Probability:** LIKELY
**Score:** 9

---

**Risk ID:** R011
**Category:** Payment
**Description:** Payment failure with no server-side recovery path. When Razorpay fires `payment.failed` in the browser, the checkout client sets `isProcessing(false)` and shows a generic error. The order already created (in `pending` state) is never automatically cancelled or cleaned up. The `record_order_payment_failure_with_ledger` RPC exists but is only called from `POST /storefront/internal/payments/failure` — a route that has no inbound webhook receiver to trigger it. Pending failed-payment orders accumulate indefinitely, holding inventory reservations.
**Evidence:**
- `02-checkout-flow-audit.md §6`: "The order is already created (step 6) before the Razorpay modal opens. If the user dismisses or payment fails, the order exists in DB with status 'pending' and payment_status 'pending'. There is no automatic cancellation from the client. Razorpay webhooks can trigger `record_order_payment_failure_with_ledger` via the webhook-service / internal payment routes."
- `03-payment-architecture.md §10`: "if the client tab is closed before `/payments/razorpay/verify` is called... the order stays in `pending` forever. No server-side reconciliation or provider-poll mechanism exists to recover these."
- `checkout-client.tsx` lines 534–537: `rzp.on('payment.failed', ...)` — client-only handler, no server call to release inventory.
**Trigger:** Customer payment fails (card declined, UPI timeout, bank error). Order created with inventory reserved. No automatic release occurs. The same product cannot be purchased by another customer until the reservation times out or is manually cleared.
**Impact:** Inventory remains locked for failed orders, causing apparent out-of-stock for other customers. Merchant sees phantom `pending` orders in their dashboard. Revenue reporting is distorted. For high-demand items, this can block legitimate purchases for extended periods.
**Current Mitigation:** Razorpay `ondismiss` handler resets `isProcessing` to `false`, allowing the customer to retry on the same page load. Same idempotency key is reused for the retry.
**Gap in Mitigation:** No server-side inventory release on payment failure. No automatic order cancellation timeout (e.g. cancel `pending` orders with no payment after 30 minutes). No `payment.failed` webhook receiver.
**Recommendation:** (1) Implement the missing Razorpay webhook receiver (R009) — include `payment.failed` handling that calls `record_order_payment_failure_with_ledger` with `p_release_inventory: true`. (2) Add a background job in `queue-workers` that scans for orders with `status=pending AND payment_method != 'cod' AND created_at < now() - interval '30 minutes'` and cancels them, releasing inventory. (3) On the client `payment.failed` handler, make a server call to notify the gateway of the failure so inventory can be released immediately.
**Severity:** HIGH
**Probability:** CERTAIN
**Score:** 12

---

**Risk ID:** R012
**Category:** Fraud / Payment
**Description:** COD reconciliation gap — no enforcement linking `cod_enabled` to pincode serviceability. The `shipping_serviceability_rules` table has a `cod_available` boolean per pincode that restricts COD, but this check is only applied when calling `GET /v1/shipping/serviceability/:pincode` or `POST /v1/shipping/rates`. The storefront checkout client fetches shipping rates at mount with `pincode: '000000'` — a placeholder — and never re-fetches serviceability after the customer enters their real pincode. As a result, COD can be shown as available and selected by the customer even for pincodes where COD is restricted at the carrier level.
**Evidence:**
- `08-shipping-platform-analysis.md §3`: "When the customer fills in their actual pincode, the store calls the same endpoint again with the real pincode. The checkout client re-fetches and auto-selects the first rate." — this only applies to shipping rates, not COD serviceability.
- `08-shipping-platform-analysis.md §6.2`: "COD availability by pincode: `cod_available` boolean on the rule row. `planShippingServiceability` returns `cod_available: false`... Default rules allow COD between ₹1 and ₹2,00,000 for any valid pincode."
- `checkout-client.tsx:220`: `pincode: '000000'` — hardcoded placeholder for initial rate fetch.
- `03-payment-architecture.md §3`: "There is no `cod_order_value_limit`, no pincode-based restriction table, and no serviceability check" at the payment-config level.
**Trigger:** Customer in a pincode where COD is restricted (e.g. high RTO zone with `cod_available: false` in `shipping_serviceability_rules`) selects COD, which is shown as available because the serviceability check never ran with the real pincode.
**Impact:** COD orders placed to restricted pincodes result in carrier non-collection, RTO (return-to-origin), and unreconciled COD liability. Merchant loses the product and incurs return shipping costs. Fraudulent COD orders in high-risk zones.
**Current Mitigation:** COD reconciliation system tracks the lifecycle and detects variance (`difference_amount_minor`). Risk scoring adds +25 for COD payment method.
**Gap in Mitigation:** COD pincode serviceability is never checked in the actual checkout flow with the customer's real pincode before order creation. The pincode `'000000'` never triggers a COD restriction even for stores that have set up such restrictions.
**Recommendation:** (1) On pincode field completion (blur/change), call `GET /v1/shipping/serviceability/{pincode}?store_id=` and update the `codEnabled` state based on the `cod_available` response. (2) If COD is not available for the entered pincode, hide the COD option in Step 2. (3) Add server-side validation in `create_checkout_order` RPC: if `payment_method=cod`, check `shipping_serviceability_rules` for the order's pincode and reject COD if `cod_available=false`.
**Severity:** HIGH
**Probability:** LIKELY
**Score:** 9

---

**Risk ID:** R013
**Category:** Security / Payment
**Description:** Shipping rate injection — client supplying a stale or foreign `shippingRateId` to reduce delivery charges. The `shippingRateId` is selected by the customer in the UI and sent to the gateway in the order creation payload. The gateway calls `resolveShippingRate(db, store.id, shippingRateId)` to look up the rate server-side. However, a customer could supply a `shippingRateId` from a different store (or a rate with `type=free`) that they have previously observed, and the cross-tenant validation relies entirely on the `site_id` match in the DB query.
**Evidence:**
- `08-shipping-platform-analysis.md §3`: "Server-side validation is performed in `lib/shipping-rate-resolver.ts`: checks whether the store has any active `shipping_rates`; if a `shippingRateId` is provided, fetches the row from `shipping_rates` matching `id + site_id + is_active + deleted_at IS NULL`. Throws if not found. Returns `{ id, amount }` where `amount = 0` for `type = 'free'`."
- `08-shipping-platform-analysis.md §3`: "SECURITY: callers must NEVER trust a client-supplied price for shipping."
- `02-checkout-flow-audit.md §1`: "The selected rate's `id` is passed as `shippingRateId` in the order payload."
**Trigger:** Customer supplies a `shippingRateId` UUID from a different store that has a free-shipping rate. The `id + site_id` check in `resolveShippingRate` correctly rejects this — but only if the UUID is genuinely foreign. A customer who has shopped at multiple stores on the same platform could supply a rate ID observed from a different checkout flow.
**Impact:** If the cross-tenant check fails (e.g. due to a bug in `resolveShippingRate`), the customer gets free shipping for a paid-shipping store. Revenue loss equal to the shipping charge per affected order.
**Current Mitigation:** `resolveShippingRate` matches on `id + site_id + is_active + deleted_at IS NULL` — this is a correct tenant-scoped lookup.
**Gap in Mitigation:** The current mitigation is correct but relies on a single function without a documented test for cross-tenant rate ID injection. No explicit test case was found in the research for this scenario.
**Recommendation:** (1) Add an integration test: attempt to use a shipping rate ID from Store A when creating an order for Store B — expect a rejection. (2) Add a gateway-level assert that the `shippingRateId` in the response to the client does not expose rate IDs from other stores. (3) Consider signing rate IDs with an HMAC including `site_id` so cross-store IDs are structurally invalid.
**Severity:** HIGH
**Probability:** UNLIKELY
**Score:** 3

---

**Risk ID:** R014
**Category:** Fraud / Security
**Description:** Coupon abuse — single-use coupon codes can be used multiple times before `usage_limit` is enforced, due to a race condition in the coupon validation and order creation flow. The client validates the coupon via `GET /api/coupons/validate` (advisory check), then includes the `coupon_code` in the order creation payload. The server applies the coupon inside `create_checkout_order` RPC. The race window is: multiple customers simultaneously validating the same single-use coupon code (`usage_limit: 1`) before any of them have completed order creation.
**Evidence:**
- `06-checkout-extensibility-analysis.md §1`: "The coupon is re-validated server-side during `create_checkout_order` RPC — if it expired between client validation and order creation, the RPC will fail or ignore it."
- `10-lcis-checkout-analysis.md §5`: "No usage count / redemption count available through the coupon list API" — the gap in visibility makes overuse harder to detect.
- `coupons.ts:90-98`: `bogo` type rejected; `percentage`, `fixed`, `free_shipping` supported.
- `02-checkout-flow-audit.md §6`: "coupon expired at checkout time: `/api/coupons/validate` returns `{ valid: false }`. The coupon is NOT applied... The coupon is re-validated server-side during `create_checkout_order` RPC."
**Trigger:** A single-use promotional coupon code is shared publicly. Hundreds of customers attempt to use it simultaneously. The RPC applies the coupon atomically but the `usage_limit` enforcement depends on the RPC's atomicity for `coupon_redemptions` inserts.
**Impact:** Coupon code used more times than the `usage_limit` allows, resulting in unexpected discount costs for the merchant. Financial loss equals discount amount × number of excess redemptions.
**Current Mitigation:** The `create_checkout_order` RPC handles coupon application and should enforce `usage_limit` atomically. Client-side validation is advisory only.
**Gap in Mitigation:** No `coupon_redemptions` aggregate endpoint to monitor real-time usage. No server-side `SELECT FOR UPDATE` on the coupon row is confirmed from the gateway code — the atomicity of `usage_limit` enforcement depends entirely on RPC implementation details not visible in the gateway layer.
**Recommendation:** (1) In the `create_checkout_order` RPC, enforce coupon `usage_limit` with a `SELECT ... FOR UPDATE SKIP LOCKED` on the `coupons` row and increment `usage_count` atomically. (2) Add `GET /v1/coupons/:id/usage` endpoint that returns `{ usage_count, usage_limit, remaining }` — enables LCIS and merchant dashboard to monitor coupon overuse in real time. (3) Add an alert: if a coupon's `usage_count` reaches `usage_limit`, disable it immediately and notify the merchant.
**Severity:** HIGH
**Probability:** POSSIBLE
**Score:** 6

---

**Risk ID:** R015
**Category:** Security / Operations
**Description:** Order status manipulation — the merchant can transition an order through invalid state machine paths via `PATCH /v1/orders/:id` due to insufficient validation of the current state before applying the requested transition. The `VALID_TRANSITIONS` map in `checkout-core` defines allowed transitions, but the gateway code in `orders.ts` must enforce these transitions correctly. A merchant with a compromised account could set `status: 'delivered'` on a `pending` (unpaid) order, triggering `payment_status=paid` and emitting `order.paid` events.
**Evidence:**
- `07-order-platform-analysis.md §2`: "Valid transitions from `planOrderStatusTransition` (checkout-core L1445–1470)" — transitions are defined in the package, not directly visible in the gateway route handler.
- `10-lcis-checkout-analysis.md §1`: "`update_order_status` — `PATCH /v1/orders/:id` — State-machine transition. Valid statuses: `delivered`, `shipped`, `cancelled`, `refunded`. Emits domain events."
- `07-order-platform-analysis.md §2`: "`delivered`: Merchant transitions via PATCH → `payment_status=paid`; `order.delivered` + `order.paid` events."
**Trigger:** Merchant account is compromised. Attacker calls `PATCH /v1/orders/:id` with `status: 'delivered'` on an order with `status: 'pending'` and `payment_status: 'pending'`. `payment_status` transitions to `paid` and `order.paid` is emitted without actual payment.
**Impact:** Fraudulent revenue recognition. GST invoice generated for non-existent payment. Order confirmation email sent to customer for an order that was never paid. Canonical ledger records a payment that never occurred.
**Current Mitigation:** `planOrderStatusTransition` enforces `VALID_TRANSITIONS` — only valid transitions are accepted. `verifySiteOwnership` ensures the requesting merchant owns the order.
**Gap in Mitigation:** Whether `planOrderStatusTransition` explicitly blocks `pending → delivered` is not confirmed from the gateway code. The research shows `delivered` as a valid target status without a clear guard against jumping from `pending` to `delivered` directly.
**Recommendation:** (1) Add explicit tests for all invalid transition paths: `pending → delivered`, `pending → shipped`, `pending → refunded`. (2) For transitions to `delivered`, add a guard: `payment_status` must be `paid` OR `payment_method=cod` (COD delivery payment is collected on delivery). (3) Add step-up verification (HMAC step-up token) for the `delivered` transition on high-value orders.
**Severity:** HIGH
**Probability:** UNLIKELY
**Score:** 3

---

**Risk ID:** R016
**Category:** Security / Operations
**Description:** Checkout settings stored but never consumed. The six merchant checkout configuration fields (`contact_method`, `customer_accounts`, `full_name`, `company_name`, `order_notes`, `tip_option`) are stored in `site_settings.checkout` via the merchant control plane, but the checkout server component (`page.tsx`) never reads or passes these to `CheckoutClient`. This creates a false sense of security: merchants believe they have disabled required accounts or set contact requirements, but these settings have no effect on the live checkout.
**Evidence:**
- `14-checkout-editor.md §1`: "Critical gap: All six settings are stored but none of them are consumed by `checkout-client.tsx` or `page.tsx`. The storefront checkout server component passes only `storeId`, `sellerId`, `subdomain`, `storeName`, `codEnabled`, `onlinePaymentEnabled` to the client — `site_settings.checkout` is never read at checkout time."
- `10-lcis-checkout-analysis.md §3`: "`customer_accounts`: Disabled / Optional / Required — Schema present; not consumed by storefront checkout."
- `04-checkout-ui-architecture.md §1`: Server component passes exactly five props — `site_settings.checkout` is not among them.
**Trigger:** Merchant sets `customer_accounts: required` expecting that guests cannot checkout. Guests successfully checkout without accounts because the setting is ignored. For a merchant who has set `order_notes: false` to prevent delivery instructions (perhaps for regulatory reasons), customers can still send arbitrary text if a future UI change exposes the `notes` field.
**Impact:** Merchant compliance expectations are violated (e.g. merchants who need GSTIN collection enabled or company name required for B2B will have these settings silently ignored). Merchant support burden when settings "don't work". Potential compliance violation for merchants who believe mandatory fields are enforced.
**Current Mitigation:** None — the settings are stored but dead.
**Gap in Mitigation:** Complete — no consumption path exists from the stored settings to the checkout UI.
**Recommendation:** (1) In `page.tsx`, read `store.siteSettings?.checkout` and pass as `checkoutConfig` prop to `CheckoutClient`. (2) In `CheckoutClient`, consume `checkoutConfig` to: show/hide the company name field, enforce contact method requirement, conditionally render the order notes textarea. This is a P0 fix per `14-checkout-editor.md §8`.
**Severity:** HIGH
**Probability:** CERTAIN
**Score:** 12

---

## MEDIUM Risks

---

**Risk ID:** R017
**Category:** Performance
**Description:** Checkout page performance degradation from monolithic client bundle. The entire 1,160-line `checkout-client.tsx` ships as a single `'use client'` component with no code splitting, no `Suspense` boundaries, and no streaming. Framer Motion is included in the checkout bundle for step transitions. The Razorpay SDK loads `afterInteractive` but the rest of the bundle is unoptimised. On mobile 4G connections in India, this can cause LCP (Largest Contentful Paint) significantly above 3 seconds.
**Evidence:**
- `09-conversion-analysis.md §7`: "No code-splitting, lazy imports, `Suspense`, or `preload`/`prefetch` directives are present in `checkout-client.tsx`... The checkout component is a monolithic client component loaded as a single bundle. Framer Motion is included for step transitions."
- `16-future-state-checkout.md §8`: "Current Estimate (V1) checkout page load: ~3–4s (monolithic client bundle, no code-splitting)."
**Trigger:** High mobile traffic to checkout on low-bandwidth connections (common in Tier 2/3 India cities).
**Impact:** Checkout abandonment due to slow load time. Every 100ms increase in checkout load time correlates with a measurable drop in conversion rate. For high-GMV merchants, even a 5% conversion drop represents significant revenue loss.
**Current Mitigation:** Next.js `<Script afterInteractive>` for Razorpay SDK. `next/image` for product thumbnails.
**Gap in Mitigation:** No code splitting, no streaming, no lazy loading of step 2 content (payment section) until step 1 is completed.
**Recommendation:** (1) Split the checkout into a `CheckoutStep1` and `CheckoutStep2` with `React.lazy` + `Suspense`. (2) Remove Framer Motion from the critical path — use CSS transitions for step animations. (3) Preload the Razorpay SDK during Step 1 address entry rather than waiting for the payment button press.
**Severity:** MEDIUM
**Probability:** LIKELY
**Score:** 6

---

**Risk ID:** R018
**Category:** Performance / UX
**Description:** Mobile UX degradation from missing pincode-based address autocomplete. The checkout form has six text fields for address entry with no autocomplete, no India Post pincode-to-city lookup, and no Google Places integration. On mobile, manual address entry is the primary abandonment cause for new customers. The current flow requires typing a full address, city, state, and pincode manually on a small keyboard.
**Evidence:**
- `09-conversion-analysis.md §8.3`: "No Google Places, India Post PIN-to-city lookup, or any address autocomplete integration exists in the checkout form. The pincode field is a free-text input with only a 6-digit numeric validation. City and state fields are also free-text with no lookup or auto-fill from pincode."
- `04-checkout-ui-architecture.md §3`: All address fields are free-text inputs with basic validation only.
- `16-future-state-checkout.md §4`: "Address entry is pincode-first. Entering a 6-digit pincode triggers an instant lookup that auto-fills city and state."
**Trigger:** New customer on mobile attempting checkout for the first time.
**Impact:** High address-step abandonment rate. Incorrect address entries leading to failed deliveries, RTO, and customer support escalations. Estimated abandonment uplift from pincode autocomplete: 15–25% based on India commerce benchmarks.
**Current Mitigation:** Saved address autofill for returning authenticated customers. 6-digit pincode validation.
**Gap in Mitigation:** No pincode → city/state auto-fill. No address autocomplete at all.
**Recommendation:** (1) On pincode field `blur`, call India Post's pincode API (or a cached lookup table) to auto-fill city and state. (2) Implement as a lightweight BFF route `/api/checkout/pincode/{pincode}` that returns `{ city, state, district }` from a cached pincode table. No external API dependency needed — India Post pincode data is publicly available.
**Severity:** MEDIUM
**Probability:** CERTAIN
**Score:** 8

---

**Risk ID:** R019
**Category:** Security
**Description:** Brand token injection XSS risk from `store_branding` endpoint. The `PUT /v1/stores/:storeId/branding` endpoint accepts `primary_color`, `accent_color`, `logo_url`, `tokens`, and `favicon_url` from authenticated merchants. These values are served back via `GET /v1/stores/:storeId/branding` (a public, unauthenticated endpoint) and can be injected into the checkout page as CSS variable values. A CSS injection in a `--primary` token (e.g. `; content: url('https://evil.com/steal.png')`) could exfiltrate data via CSS-based side channels.
**Evidence:**
- `11-mcp-checkout-analysis.md §1` (READY tools): "`update_checkout_branding`: `PUT /v1/stores/:storeId/branding` — `assertBrandingIsDataOnly` prevents script injection; `verifySiteOwnership` guard at L797. Upserts to `store_branding` table."
- `checkout.ts:791–813`: `assertBrandingIsDataOnly` is called — but the research does not confirm what CSS-injection patterns it blocks.
- `13-checkout-branding-platform.md §6`: "Invariants: No custom HTML or CSS may be injected into the Razorpay payment form."
- `14-checkout-editor.md §3`: "Custom CSS: Textarea (max 4000 chars) — HIGH — must be sandboxed to `.lb-checkout-wrapper` CSS scope."
**Trigger:** A compromised merchant account sets a malicious CSS value in `primary_color`. The value is served to all customers of that store via the public branding endpoint and injected into `:root` CSS variables.
**Impact:** CSS injection can be used for CSRF-style attacks, keylogging form fields (via CSS attribute selectors), or exfiltrating data. More commonly, a malicious merchant could set a `logo_url` pointing to an external image host to track checkout visitor IP addresses.
**Current Mitigation:** `assertBrandingIsDataOnly` in `checkout.ts`. `verifySiteOwnership` ensures only the store's merchant can update branding.
**Gap in Mitigation:** The implementation of `assertBrandingIsDataOnly` is not fully visible in the research. It is unclear whether it validates CSS hex patterns for color fields or allows arbitrary strings.
**Recommendation:** (1) Validate all color token fields against strict hex/rgb/rgba patterns (regex: `/^#[0-9a-fA-F]{3,8}$|^rgb\(\d+,\s*\d+,\s*\d+\)$/`). Reject any value that does not match. (2) Validate `logo_url` and `favicon_url` against an allowlist of trusted CDN hosts (e.g. `assets.letbuyy.com`, `res.cloudinary.com`). (3) Use `CSS.escape()` when injecting token values into the `:root` style block.
**Severity:** MEDIUM
**Probability:** POSSIBLE
**Score:** 4

---

**Risk ID:** R020
**Category:** Operational
**Description:** Shipping zone misconfiguration silently allows all rates for all pincodes. The shipping zone model supports `countries`, `states`, and `zip_codes` filters, but zone-to-checkout matching is not implemented in `POST /v1/shipping/rates` — all active rates for the store are returned regardless of which zone covers the customer's pincode. This means zone restrictions are stored but never enforced during checkout.
**Evidence:**
- `08-shipping-platform-analysis.md §8.5`: "Zone-to-checkout matching is not implemented — shipping zones hold a `countries`/`states`/`zip_codes` allowlist, but `POST /v1/shipping/rates` does not filter returned rates by which zone covers the customer's pincode or country. All active rates for the store are returned up to a limit of 10, regardless of zone assignment."
**Trigger:** Merchant creates a zone restricting express shipping to specific states. Customer in a non-covered state selects the express rate. The order is created with the express rate applied.
**Impact:** Merchants pay express carrier rates for shipments that should have been charged standard rates. COD rates shown in non-COD zones. Incorrect shipping cost charged to customers.
**Current Mitigation:** Server-side `resolveShippingRate` validates the selected rate ID against `site_id + is_active`. This prevents stale or foreign rates but does not enforce zone restrictions.
**Gap in Mitigation:** Zone coverage check (`zip_codes`, `states`, `countries`) is never applied during the checkout rate query.
**Recommendation:** (1) In `POST /v1/shipping/rates`, join `shipping_rates` with `shipping_zones` and filter by the customer's pincode (check against `zip_codes` array) and state (check against `states` array). (2) Only return rates from zones that cover the customer's location. (3) Add a UI indicator in the merchant shipping configuration showing which zone covers each pincode.
**Severity:** MEDIUM
**Probability:** LIKELY
**Score:** 6

---

**Risk ID:** R021
**Category:** Operational / Security
**Description:** Cart abandonment queue job is enqueued but never consumed. The `enqueueAbandonmentCheck()` function in `cart-routes.ts` writes a `cart.abandonment_check` job to `platform_queue_jobs`, but `platform-queue-consumer.ts` has no handler for this job type. The job queue fills with unprocessed abandonment check records. No recovery email or WhatsApp message is ever sent. Additionally, if the queue table grows unbounded, it may cause performance degradation on the `platform_queue_jobs` table.
**Evidence:**
- `09-conversion-analysis.md §2`: "The job is enqueued successfully; however, `services/queue-workers/src/platform-queue-consumer.ts` contains no handler for `job_type: 'cart.abandonment_check'`. Grep across all queue-worker source files returns zero matches for `abandonment_check`, `cart.abandoned`, or `abandoned`. The job is enqueued but never consumed — no recovery action is taken downstream."
- `09-conversion-analysis.md §2`: "The WhatsApp routes file (`whatsapp.ts`) includes `'abandoned_cart'` in a template key array and a `cart_abandonment` session type, indicating an intent to send WhatsApp recovery messages, but no automated trigger wires the enqueued job to this template."
**Trigger:** Any customer adds items to a cart and provides their email but does not complete checkout. The abandonment check job is enqueued. After 1 hour, no action is taken.
**Impact:** Zero cart abandonment recovery. The 3–5% recovery rate from abandonment emails represents significant unrealised revenue. Queue table accumulation may cause operational issues over time.
**Current Mitigation:** Cart is persisted to `localStorage` and the `carts` server table, so items are not lost.
**Gap in Mitigation:** No queue consumer for `cart.abandonment_check`. No email or WhatsApp recovery flow is wired end-to-end.
**Recommendation:** (1) Implement a `cart.abandonment_check` consumer in `queue-workers` that: reads the cart, checks if an order was subsequently placed, and if not, dispatches a recovery email via Resend and/or WhatsApp via the `abandoned_cart` template that already exists in `whatsapp.ts`. (2) Add a dead-letter queue or TTL policy on `platform_queue_jobs` to prevent unbounded growth of unprocessed jobs.
**Severity:** MEDIUM
**Probability:** CERTAIN
**Score:** 8

---

**Risk ID:** R022
**Category:** Security / Architecture
**Description:** Third-party extension security — the `extensionFunctions: []` stub and the gateway's `app_extension_registrations` endpoint create a future attack surface if extensions are added without a sandbox. Currently no extension runs, so the risk is speculative but must be addressed before any extension capability is opened. The `AppExtensionRegistrationSchema` supports `renderer: 'iframe' | 'web_component' | 'liquid_app_block'` and `source_url` — if a web_component extension is loaded without a Content-Security-Policy `sandbox` directive, it runs in the main checkout page context with full DOM access.
**Evidence:**
- `15-checkout-extensions.md §4`: "Third-party Extensions (Future — App Marketplace): sandboxed `<iframe>` at the declared slot, loaded from the app's `checkout_block_url`. The iframe receives a postMessage with a serialized, read-only CheckoutExtensionContext. Payment fields are never sent to iframe extensions."
- `06-checkout-extensibility-analysis.md §3`: "`extensionFunctions: []` in the order response is always an empty stub; no extension functions are ever registered or called."
- `15-checkout-extensions.md §6`: "Third-party iframe Sandbox Policy — `allow-forms` is NOT granted — forms inside iframes cannot POST to external servers."
**Trigger:** An extension is added using `renderer: 'web_component'` without proper CSP sandboxing. The web component runs in the main page context and can read form field values including email, phone, and address.
**Impact:** PII exfiltration from checkout forms. The web component could send customer contact details to an external server. This would constitute a DPDP Act violation.
**Current Mitigation:** No extensions are currently running. The design document (`15-checkout-extensions.md`) specifies strict iframe sandboxing.
**Gap in Mitigation:** The sandbox policy is a design intent, not yet implemented in code. The `AppExtensionRegistrationSchema` supports `web_component` renderer without enforced sandboxing.
**Recommendation:** (1) Before any extension is added: add a CSP header to the checkout page: `script-src 'self' https://checkout.razorpay.com; frame-src 'self' https://*.letbuyy.com;` (2) Disable `web_component` renderer type for checkout surface extensions — only `iframe` should be allowed. (3) Require extension review and signature verification before any `source_url` is loaded in checkout.
**Severity:** MEDIUM
**Probability:** UNLIKELY
**Score:** 2

---

## LOW Risks

---

**Risk ID:** R023
**Category:** Operational
**Description:** Monitoring gaps — zero checkout funnel events are emitted from `checkout-client.tsx`. The `DashboardClient.tsx` hardcodes "Not tracked" for both Visitors and Conversion Rate. The merchant has no visibility into where in the checkout funnel customers drop off. Payment failure counts, Razorpay modal dismiss rates, and step 1-to-2 conversion are all invisible. This prevents data-driven checkout improvements and masks payment provider issues.
**Evidence:**
- `09-conversion-analysis.md §1`: "No event is fired for any of the following checkout funnel stages... `checkout-client.tsx` — full file search for tracking calls returned zero results."
- `09-conversion-analysis.md §4`: "Dashboard explicitly acknowledges that conversion rate is uncomputed... Conversion — hard-coded string 'Not tracked'."
**Trigger:** Any time, continuously.
**Impact:** Inability to detect payment failures, conversion regressions, or UX issues. Slow response to production incidents. Merchant churn due to lack of analytics.
**Current Mitigation:** Server-side `storefront.checkouts.started` metric exists. Order counts and revenue are tracked.
**Gap in Mitigation:** Seven checkout funnel steps are entirely untracked.
**Recommendation:** Add `analytics` calls at each of the 7 checkout steps identified in `16-future-state-checkout.md §3`. Wire to Cloudflare Analytics Engine via the existing analytics infrastructure.
**Severity:** LOW
**Probability:** CERTAIN
**Score:** 4

---

**Risk ID:** R024
**Category:** Operational
**Description:** Analytics event loss for `cart.abandoned` domain event. The `emitCartEvent('cart.abandoned')` call in `cart-routes.ts` emits the event to `domain_events`, but there is no consumer that acts on this event for customer re-engagement. The WhatsApp `abandoned_cart` template exists but has no trigger. This is a parallel gap to R021 (queue consumer) focused on the domain event path.
**Evidence:**
- `09-conversion-analysis.md §3`: "`cart.abandoned` — Emitted as domain event + job enqueued, but no downstream consumer acts on it."
- `09-conversion-analysis.md §2`: "Neither the recovery email flow nor the WhatsApp `abandoned_cart` template is wired to the queue job."
**Trigger:** Cart abandonment occurs (customer leaves checkout after email capture).
**Impact:** Zero WhatsApp abandonment recovery messages. Lost revenue from recoverable checkouts. Estimated 3–8% recovery uplift from WhatsApp abandonment messages in Indian commerce.
**Current Mitigation:** Domain event is stored in `domain_events` table.
**Gap in Mitigation:** No consumer for `cart.abandoned` event. No WhatsApp trigger.
**Recommendation:** Wire `queue-workers` to consume `cart.abandoned` domain events and dispatch the existing `abandoned_cart` WhatsApp template. Require explicit merchant opt-in for WhatsApp marketing to comply with TRAI.
**Severity:** LOW
**Probability:** CERTAIN
**Score:** 4

---

**Risk ID:** R025
**Category:** UX / Operational
**Description:** Checkout form state lost on page reload. All checkout state (`formData`, `step`, `appliedCoupon`, `selectedRateId`, `paymentMethod`) is in React `useState` and is lost on browser refresh. The cart items survive (in `localStorage`) but the customer must re-enter their full name, address, email, phone, and re-select shipping and coupon. Idempotency keys in `useRef` are also lost, raising the R001 double-charge risk on retry after refresh.
**Evidence:**
- `09-conversion-analysis.md §8.7`: "The checkout form state (`formData`, `step`, `paymentMethod`, `appliedCoupon`) lives exclusively in React component state. A page reload returns the customer to an empty Step 1 form."
- `04-checkout-ui-architecture.md §6`: "All other checkout state is ephemeral — lost on page refresh."
**Trigger:** Network hiccup causes page reload during checkout. Customer accidentally refreshes the browser. Session restore on mobile (iOS Safari auto-reloads background tabs).
**Impact:** Increased abandonment from friction of re-entry. Risk of double-charge if idempotency keys are regenerated (R001). Customer frustration, support escalations.
**Current Mitigation:** Saved address autofill for authenticated customers reduces re-entry burden.
**Gap in Mitigation:** No `sessionStorage` persistence for checkout form state. No server-side checkout session that survives page reload.
**Recommendation:** (1) Persist `formData` and idempotency keys to `sessionStorage` on every state change. (2) Restore from `sessionStorage` on component mount. (3) This is Phase 1 of the centralized checkout migration plan (`12-centralized-checkout-platform.md §8`).
**Severity:** LOW
**Probability:** LIKELY
**Score:** 3

---

**Risk ID:** R026
**Category:** UX / Operational
**Description:** Session expiry edge case for long-form checkout. The Razorpay order created via `POST /payments/razorpay/order` has an expiry time set by Razorpay (typically 15 minutes). If a customer spends more than 15 minutes filling the checkout form before clicking "Pay" (common for users who pause to retrieve billing details or compare addresses), the Razorpay order will be expired when the modal opens. The gateway's `loadStorefrontPayableOrder` check validates the order is unpaid but does not check Razorpay's order expiry.
**Evidence:**
- `03-payment-architecture.md §2`: "The Razorpay order is created server-side with `amount = DB order.total * 100`... the client receives server-computed amount; the Razorpay SDK is initialized on client with these values."
- `02-checkout-flow-audit.md §1`: "Step 7: Phase 2 — Razorpay order: client calls `storefrontBrowserApiFetch(subdomain, '/payments/razorpay/order', ...)` — only called on 'Pay ₹X' button click, not on page load."
- `03-payment-architecture.md §10`: "No payment retries / partial-payment support: There is no retry logic for failed payment attempts. If `createIntent` fails, the idempotency claim is marked failed and the client must start over."
**Trigger:** Customer spends more than 15 minutes between clicking "Continue to Payment" (step 2) and clicking "Pay ₹X". The Razorpay order is created at "Pay" click, not earlier — so this is actually low risk in the current flow. The risk is if the Razorpay order creation is moved to step 2 entry in a future optimisation.
**Impact:** Payment modal opens but Razorpay returns an error about order expiry. Customer must retry from scratch. Confusing UX.
**Current Mitigation:** Razorpay order is created only at the "Pay ₹X" button click, not on checkout page load. This minimises the expiry window.
**Gap in Mitigation:** No explicit expiry check on the Razorpay order before opening the modal. Idempotency claim is marked `failed` on `createIntent` failure, requiring a fresh `crypto.randomUUID()` key — but the current implementation reuses the same `useRef` key, which would attempt to replay a failed claim.
**Recommendation:** (1) On `payment.failed` event from Razorpay, check if the failure reason is `ORDER_EXPIRED` and provide a clear user message with a "Retry Payment" button that creates a new Razorpay order. (2) Ensure idempotency claim `failed` status allows re-use with the same key after failure (the `idempotency.fail()` path must unlock the key for retry, not permanently block it).
**Severity:** LOW
**Probability:** POSSIBLE
**Score:** 2

---

## Risk Summary Matrix

| Risk ID | Category | Description | Severity | Probability | Score | Status |
|---|---|---|---|---|---|---|
| R001 | Payment | Double-charge from non-durable idempotency keys | CRITICAL | POSSIBLE | 8 | Open |
| R002 | Payment/Security | Amount manipulation via client item quantity on COD | CRITICAL | POSSIBLE | 8 | Open |
| R003 | Security/Payment | Cart session hijacking via localStorage token theft | CRITICAL | POSSIBLE | 8 | Open |
| R004 | Security/Multi-Tenancy | Internal payment routes protected by single shared secret | CRITICAL | UNLIKELY | 4 | Open |
| R005 | Security/Payment | Razorpay key_secret AES-GCM encryption weakness | CRITICAL | UNLIKELY | 4 | Open |
| R006 | Payment/Security | Payment replay attack — same payment_id on different order | CRITICAL | UNLIKELY | 4 | Open |
| R007 | Fraud/Payment | COD fraud via merchant-controlled delivery confirmation | CRITICAL | POSSIBLE | 8 | Open |
| R008 | Performance/Payment | Inventory race condition causing oversell at checkout | CRITICAL | LIKELY | 12 | Open |
| R009 | Payment/Security | No inbound Razorpay webhook receiver — orphaned payments | HIGH | LIKELY | 9 | Open |
| R010 | Security/Multi-Tenancy | Guest order enumeration via unauthenticated contact lookup | HIGH | LIKELY | 9 | Open |
| R011 | Payment | Payment failure leaves inventory reserved indefinitely | HIGH | CERTAIN | 12 | Open |
| R012 | Fraud/Payment | COD shown available for restricted pincodes (000000 placeholder) | HIGH | LIKELY | 9 | Open |
| R013 | Security/Payment | Shipping rate injection across tenants | HIGH | UNLIKELY | 3 | Partially mitigated |
| R014 | Fraud/Security | Coupon abuse — single-use codes redeemed multiple times | HIGH | POSSIBLE | 6 | Open |
| R015 | Security/Operations | Order status manipulation — invalid state transitions | HIGH | UNLIKELY | 3 | Open |
| R016 | Security/Operations | Checkout settings stored but never consumed | HIGH | CERTAIN | 12 | Open |
| R017 | Performance | Monolithic checkout bundle causes slow mobile load | MEDIUM | LIKELY | 6 | Open |
| R018 | Performance/UX | No pincode-based address autocomplete | MEDIUM | CERTAIN | 8 | Open |
| R019 | Security | Brand token CSS injection via store_branding endpoint | MEDIUM | POSSIBLE | 4 | Partially mitigated |
| R020 | Operational | Shipping zone restrictions not enforced in checkout | MEDIUM | LIKELY | 6 | Open |
| R021 | Operational/Security | Cart abandonment queue job enqueued but never consumed | MEDIUM | CERTAIN | 8 | Open |
| R022 | Security/Architecture | Third-party extension sandbox not enforced | MEDIUM | UNLIKELY | 2 | Design-only |
| R023 | Operational | Zero checkout funnel analytics events | LOW | CERTAIN | 4 | Open |
| R024 | Operational | cart.abandoned domain event has no consumer | LOW | CERTAIN | 4 | Open |
| R025 | UX/Operational | Checkout form state lost on page reload | LOW | LIKELY | 3 | Open |
| R026 | UX/Operational | Razorpay order expiry edge case in long sessions | LOW | POSSIBLE | 2 | Open |

---

## Top 5 Risks Requiring Immediate Attention

### Rank 1: R008 — Inventory Race Condition (Score 12, CRITICAL × LIKELY)

**Justification:** This is the highest-probability critical risk. Under any meaningful traffic load (flash sales, peak hours), concurrent checkout submissions for the same limited-stock item are near-certain. The generic "Order creation failed" error message provides no actionable guidance, causing customers to retry repeatedly, compounding server load. The hidden COD availability problem (placeholder pincode `'000000'`) means merchants are losing COD sales to customers in serviceable pincodes because COD availability is never accurately assessed. This is a revenue-impacting, customer-facing bug in the critical checkout path. **Fix estimate: 1–2 days (typed RPC error codes + error message surfacing + pincode re-fetch on field blur).**

### Rank 2 (tied): R011 — Payment Failure Inventory Lock (Score 12, HIGH × CERTAIN)

**Justification:** This risk is CERTAIN to materialise — payment failures occur in every production system. Every payment failure currently locks inventory for failed orders indefinitely. With no inbound Razorpay webhook receiver (R009) and no background cleanup job, these phantom orders accumulate. For popular items, even a handful of concurrent payment failures can create false out-of-stock conditions. This is compounded by the fact that the same customer cannot easily retry with a fresh Razorpay order if their idempotency key is already bound to the failed order. **Fix estimate: 1 day (background cleanup job) + 3 days (Razorpay webhook receiver, see R009).**

### Rank 3 (tied): R016 — Checkout Settings Never Consumed (Score 12, HIGH × CERTAIN)

**Justification:** This is CERTAIN and constitutes a direct merchant contract violation. Merchants pay for and configure `customer_accounts`, `contact_method`, and `order_notes` settings expecting them to take effect. None of them do. This is a trust-destroying bug for merchant retention: a merchant who sets `customer_accounts: required` for B2B compliance and discovers guests can still checkout will escalate immediately. **Fix estimate: 1 day (pass `checkoutConfig` from server component to `CheckoutClient` and consume the six settings).**

### Rank 4: R009 — No Inbound Razorpay Webhook Receiver (Score 9, HIGH × LIKELY)

**Justification:** This is a production launch blocker for Razorpay live mode. Razorpay's SLA requires merchants to handle `payment.captured` webhooks as the authoritative confirmation signal. The current client-initiated verify flow is not reliable under network failure conditions. Without a webhook receiver, any payment where the browser tab closes after Razorpay modal success results in an unrecovered pending order. This risk becomes CERTAIN once live Razorpay traffic volumes increase. **Fix estimate: 2–3 days (inbound webhook route + signature verification + `confirm_order_payment_with_ledger` call + HMAC secret setup).**

### Rank 5: R010 — Guest Order Enumeration (Score 9, HIGH × LIKELY)

**Justification:** The unauthenticated `GET /api/orders/check?contact=` endpoint is a straightforward PII enumeration target. Given India's DPDP Act (Digital Personal Data Protection Act 2023), an unauthorised disclosure of customer order data — even just whether an email has placed orders — constitutes a reportable incident. This endpoint requires no authentication and no rate limiting, making it a low-effort, high-impact target for data harvesting. **Fix estimate: 2 hours (add Cloudflare rate limiting + Turnstile token requirement to the BFF route).**

---

*Document: `/Users/saai_sidd/Git/Letbuyy_Store/docs/checkout-research/17-risks-register.md`*
*Sources: docs/checkout-research/01 through 16, services/api-gateway/src/routes/storefront/checkout-payment-routes.ts, checkout-client.tsx, payment-execution.adapter.ts, internal-payment-routes.ts, cod-reconciliation.ts, cart-routes.ts, shipping-rate-resolver.ts, store-payment-config.ts*
