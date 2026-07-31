# Payment Architecture

Research date: 2026-06-18
Sources: `services/api-gateway/src/routes/payments.ts`, `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts`, `services/api-gateway/src/routes/storefront/internal-payment-routes.ts`, `services/api-gateway/src/execution/payment-execution.adapter.ts`, `services/api-gateway/src/lib/payment-route-support.ts`, `services/api-gateway/src/lib/store-payment-config.ts`, `services/api-gateway/src/schemas/payment.schema.ts`, `services/api-gateway/src/routes/cod-reconciliation.ts`, `apps/merchant-control-plane/src/app/api/stores/[store]/payment-config/route.ts`

---

## 1. Payment Providers Supported

| Provider | Status | Evidence |
|---|---|---|
| Razorpay | ACTIVE — primary provider | `checkout-payment-routes.ts:22` imports `createRazorpayPaymentProvider`; order+verify routes at lines 449 and 569; `payments.ts:12` imports `createRazorpayOrder`, `fetchRazorpayPayment`; `payment.schema.ts:3` lists it in `V1PaymentProviderSchema` |
| COD (Cash on Delivery) | ACTIVE | `checkout-payment-routes.ts:56` — `paymentMethod: 'razorpay' \| 'stripe' \| 'paypal' \| 'cashfree' \| 'cod'`; `cod-reconciliation.ts` is a full reconciliation sub-system; `store-payment-config.ts:94` defaults `cod_enabled: true` |
| Cashfree | ACTIVE — routes implemented | `checkout-payment-routes.ts:21` imports `createCashfreePaymentProvider`; order+verify routes at lines 700 and 820; `payment.schema.ts:3` includes `cashfree` in `V1PaymentProviderSchema` |
| Stripe | PARTIAL — checkout session only, no verify loop | `checkout-payment-routes.ts:23` imports `createStripePaymentProvider`; storefront route at line 945 creates a hosted checkout session and redirects; no storefront verify callback route (Stripe uses redirect-based flow); `payments.ts:1249` has a separate merchant-auth version |
| PayPal | ACTIVE — order+capture implemented | `checkout-payment-routes.ts:20` imports `createPayPalPaymentProvider`; order route at line 1050, capture route at line 1152; `PAYPAL_CLIENT_ID/SECRET` and `PAYPAL_WEBHOOK_ID` env vars used (line 202–211) |
| UPI | SCHEMA STUB ONLY | `payment.schema.ts:3` — `V1PaymentProviderSchema` enumerates `'upi'`; no route handler exists for a UPI-specific flow; UPI likely surfaces inside Razorpay/Cashfree checkout widgets as a payment method on the client side |
| Netbanking / Wallet | NONE | No routes, no adapter imports, no schema enum values |

---

## 2. Razorpay Integration Architecture

### Order Creation Flow

```
Client checkout form
  → POST /storefront/:subdomain/payments/razorpay/order
      (checkout-payment-routes.ts:449)
  → paymentService.loadStorefrontPayableOrder(orderId, storeId)
      — fetches order from DB, validates not-paid, positive INR total
  → idempotency.begin(...)
      — scope: storefront.payment.razorpay.order:<orderId>
  → createRazorpayPaymentProvider({ keyId, keySecret }).createIntent({ storeId, orderId, amount, idempotencyKey })
      — calls Razorpay API: POST /v1/orders
      — amount is always server-derived from DB order.total * 100
  → paymentService.attachPaymentReference(orderId, 'razorpay', providerOrderId)
      — RPC: attach_order_payment_reference_with_ledger (writes orders.payment_id = razorpay_order_id)
  → Response: { keyId, razorpayOrderId, amount, currency }
      — client receives server-computed amount; the Razorpay SDK is initialized on client with these values
```

Amount is re-fetched from `orders.total` and converted to minor units (`Math.round(total * 100)`) at line 474. If the client sends `amountMinorUnits` and it does not match the server-computed value, the route returns 400 `AMOUNT_MISMATCH` (lines 483–489).

### Payment Verification Flow

```
Client receives Razorpay callback: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
  → POST /storefront/:subdomain/payments/razorpay/verify
      (checkout-payment-routes.ts:569)
  → loadStorefrontPayableOrder (re-validate not paid)
  → idempotency.begin(...)
  → SECURITY CHECK 1: order.payment_id === razorpay_order_id
      — if null or mismatch → 409 PAYMENT_REFERENCE_MISMATCH (line 617)
      — ensures the order was bound to a server-created Razorpay order first
  → assertProviderPaymentNotReplayed(...)
      — queries payment_transactions by (gateway=razorpay, provider_payment_id)
      — throws ConflictError if razorpay_payment_id already recorded for different order
  → createRazorpayPaymentProvider.verify({ providerOrderId, providerPaymentId, signature })
      — server-side HMAC-SHA256: payload = razorpay_order_id + "|" + razorpay_payment_id
      — verification handled inside razorpay-adapter (calls timingSafeEqualHex internally)
  → On failure → 400 PAYMENT_SIGNATURE_INVALID (line 655)
  → paymentService.confirmPayment(...)
      — RPC: confirm_order_payment_with_ledger
  → emitStorefrontOrderPaidEvent(...)
```

The legacy merchant-owned route `POST /payments/razorpay/verify` (payments.ts:1144) uses the same HMAC approach but calls `crypto.subtle` directly inline (lines 1192–1207), with `timingSafeEqualHex` for constant-time comparison.

### Razorpay Order Object

Fields stored/returned after `attachPaymentReference`:
- `orders.payment_id` — set to Razorpay's `order_id` string (e.g., `order_XXXXX`) via `attach_order_payment_reference_with_ledger` RPC
- `amount` — server-computed minor units (paise), never client-declared
- `currency` — always `'INR'`; non-INR orders are rejected at `orderAmountMinorUnits` (line 156–164)
- `receipt` — set to internal `orderId`
- `notes.order_id` / `notes.idempotency_key` — passed to Razorpay for traceability

For the V1 session-based flow (`payments.ts:108`), additional fields are stored in the `payments` table: `provider_order_id`, `provider_session_id`, `status`, `amount_minor`, `credential_id`, `client_action`, `expires_at`, `metadata`.

### Client-Side Integration

`apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx` (lines 21–23, 101, 136–137, 161, 446, 459, 466):
- `razorpayLoaded` state is tracked (line 161); the Razorpay JS SDK is loaded dynamically (line 446 checks `!razorpayLoaded` before proceeding)
- On "Pay Now" click, client calls `createCheckoutOrder('razorpay')` (line 459) then hits `/payments/razorpay/order` (line 466)
- Server returns `keyId`, `razorpayOrderId`, `amount`, `currency`
- Client opens the Razorpay modal, receives the callback, then POSTs to `/payments/razorpay/verify`
- `ProviderOrderMethod` type (line 101) is narrowed to `'razorpay' | 'cod'` — Cashfree/Stripe/PayPal have routes but the storefront client only exposes razorpay and COD in its modal logic at the time of this reading

---

## 3. COD (Cash on Delivery) Architecture

### COD Flow

```
Client selects COD at checkout
  → POST /storefront/:subdomain/orders (paymentMethod: 'cod')
      (checkout-payment-routes.ts:251)
  → OrderExecutionAdapter.createOrder(command, tenant)
      — RPC: create_checkout_order (passes payment_method='cod')
      — RPC sets order.payment_method='cod', order.payment_status='pending'
      — No online payment intent created; no provider call
  → Response: { orderId, orderNumber, status: 'pending' }
```

COD orders are created with `payment_status='pending'` and flow to delivery. No payment is confirmed at order time. The payment is physically collected by the delivery agent and reconciled later via the COD reconciliation sub-system.

### COD Reconciliation

`cod-reconciliation.ts` implements a full lifecycle for tracking COD cash:

**Endpoints:**
- `GET /cod/reconciliation?store_id=...&status=...&limit=...` — list entries with summary
- `POST /cod/reconciliation` — record physical collection against a COD order; sets `status='collected'`, stores `collected_amount_minor`
- `POST /cod/reconciliation/:id/reconcile` — record bank deposit; calls `db.rpc('reconcile_cod_remittance_with_ledger', {...})` to create canonical ledger entry

**Lifecycle states:** `pending → collected → reconciled`; also `short`, `over`, `reversed` for variance tracking

**`cod_reconciliation_entries` table fields:**
- `expected_amount_minor` — from order total at creation time
- `collected_amount_minor` — recorded when delivery agent marks collected
- `deposited_amount_minor` — recorded at bank remittance
- `difference_amount_minor` — variance (over/short)
- `canonical_ledger_transaction_id` — FK to ledger; written by `reconcile_cod_remittance_with_ledger` RPC

`ensureEntriesForCodOrders` (line 166) auto-creates missing `cod_reconciliation_entries` rows by scanning all `payment_method='cod'` orders on any GET or POST, so entries self-heal if created before the reconciliation system existed.

### COD Constraints

No per-store order-value limits or pincode restrictions are implemented at the API layer. The only store-level COD gate is the binary `sites.cod_enabled` boolean column (`store-payment-config.ts:86`, `94`). There is no `cod_order_value_limit`, no pincode-based restriction table, and no serviceability check. This is a gap for production India COD operations where carriers typically impose pincode serviceable lists.

---

## 4. Payment Configuration System

### Per-Store Payment Config

`store-payment-config.ts` defines the `PaymentSettings` type:

```typescript
type PaymentSettings = {
    mode?: 'shared' | 'ownAccount';      // 'shared' = platform keys; 'ownAccount' = merchant keys
    gateways?: string[];                  // defaults to ['razorpay']
    razorpay?: {
        key_id?: string;
        key_secret_ciphertext?: string;   // AES-GCM encrypted merchant secret
        test_mode?: boolean;
        verified?: boolean;
        connected_at?: string;
        updated_at?: string;
    };
};
```

`paymentConfigProviderMode()` (line 72): returns `'live'` only when `online_payment_enabled !== false` AND `key_secret_ciphertext` is present AND `test_mode === false`. Otherwise `'sandbox'`.

`defaultPaymentConfig()` (line 90): `online_payment_enabled: true`, `cod_enabled: true`, `provider_mode: 'sandbox'`, `payment_settings: { mode: 'shared', gateways: ['razorpay'], razorpay: null }`.

Encryption: `encryptPaymentSecret(secret, encryptionKey)` (line 37) uses `AES-GCM` with a 12-byte random IV; the key is derived from SHA-256 of the `encryptionKey` string. Ciphertext stored as `base64(iv):base64(ciphertext)`.

`sanitizePaymentSettings()` (line 53): masks `key_id` to `rzp_live_XXXX...yyyy` format and omits `key_secret_ciphertext` from API responses.

### Payment Config DB

The config lives on the `sites` table:
- `sites.online_payment_enabled` — boolean toggle
- `sites.cod_enabled` — boolean toggle
- `sites.payment_settings` — JSONB column holding the `PaymentSettings` object

V1 payment sessions also use the `payment_credentials` table (queried in `activeMerchantPaymentCredential`, `payment-route-support.ts:98`) with columns `site_id`, `provider`, `mode`, `status`, `deleted_at`.

### Payment Config API

`apps/merchant-control-plane/src/app/api/stores/[store]/payment-config/route.ts`:
- `GET` — proxies to `createMerchantApiClient().stores.paymentConfig.get(storeId)` → returns sanitized payment settings
- `POST` — proxies to `stores.paymentConfig.save(storeId, { key_id, key_secret, test_mode })` → stores encrypted credentials

---

## 5. Security Architecture

### HMAC Verification

**Storefront Razorpay verify** (`checkout-payment-routes.ts:639`):
The verification is delegated to `createRazorpayPaymentProvider(...).verify({ signature, providerOrderId, providerPaymentId })` inside `@letbuyy/infrastructure/razorpay-adapter`. The adapter calls `timingSafeEqualHex` internally.

**Merchant subscription verify** (`payments.ts:904–913`):
```typescript
const expected = await hmacSha256Hex(
    c.env.RAZORPAY_KEY_SECRET,
    razorpayBillingSignaturePayload({ orderId, subscriptionId, paymentId })
);
if (!timingSafeEqualHex(expected, body.razorpay_signature)) { ... }
```

**Legacy merchant Razorpay verify** (`payments.ts:1192–1206`):
```typescript
const key = await crypto.subtle.importKey('raw', encoder.encode(c.env.RAZORPAY_KEY_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const payload = `${body.razorpay_order_id}|${body.razorpay_payment_id}`;
const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
const expectedSig = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
if (!timingSafeEqualHex(expectedSig, body.razorpay_signature)) { ... }
```

`timingSafeEqualHex` is defined in `services/api-gateway/src/lib/crypto.ts` and is the only comparison used for signature verification across the codebase — direct string equality is never used.

### Amount Authority

Amounts are always server-authoritative:

1. `loadStorefrontPayableOrder` (payment-execution.adapter.ts:28) fetches `orders.total` from DB.
2. `orderAmountMinorUnits` (checkout-payment-routes.ts:152) converts `total * 100` on the server.
3. If the client submits `amountMinorUnits` and it differs from the server value, the route returns 400 `AMOUNT_MISMATCH` (checkout-payment-routes.ts:484).
4. The Razorpay order is created with the server-computed amount. After HMAC verification, `confirmPayment` calls `confirm_order_payment_with_ledger` which re-reads the amount from the DB, not from the HTTP request.
5. For subscription payments, `payments.ts:966–987` performs a server-side Razorpay API call (`fetchRazorpayPayment`) to verify `capturedAmount >= amountPaid` — the server does not trust the client-submitted payment data.

### Idempotency

All payment-mutating routes use `IdempotencyExecutionAdapter`:
- Each operation begins with `idempotency.begin({ siteId, key, scope, requestBody })` which issues a DB-level idempotency claim.
- `claim.kind === 'replay'` short-circuits and returns the stored response body if the same `(siteId, key, scope)` triple was already completed.
- On failure, `idempotency.fail(claim.id)` marks the claim failed so the same key can be retried.
- On success, `idempotency.complete(...)` stores the response body.
- Provider-level replay is also prevented by `assertProviderPaymentNotReplayed` which queries `payment_transactions` for existing `provider_payment_id` records (payment-route-support.ts:226–258).

---

## 6. Canonical Ledger Integration

### RPCs Called During Payment

| RPC | When Called | Source Location | Key Arguments |
|---|---|---|---|
| `create_checkout_order` | Order creation (all payment methods incl. COD) | `order-execution.adapter.ts:158` | customer, items, payment_method, shipping, tax, coupon, gift_card_code |
| `attach_order_payment_reference_with_ledger` | After provider order created (Razorpay, Cashfree, Stripe, PayPal) | `payment-execution.adapter.ts:70` | p_order_id, p_provider, p_provider_order_id, p_idempotency_key |
| `confirm_order_payment_with_ledger` | After HMAC/provider verify succeeds | `payment-execution.adapter.ts:94` | p_order_id, p_provider, p_provider_payment_id, p_provider_order_id, p_provider_event_id, p_idempotency_key |
| `record_order_payment_failure_with_ledger` | On payment failure/cancellation via internal endpoint | `payment-execution.adapter.ts:122` | p_order_id, p_provider, p_provider_event_id, p_payment_status, p_order_status, p_release_inventory |
| `post_settlement_ledger_transaction` | On V1 payment capture, V1 payment refund | `payment-route-support.ts:185` | p_site_id, p_source_type, p_source_id, p_idempotency_key, p_lines (double-entry), p_metadata |
| `reconcile_cod_remittance_with_ledger` | On COD bank deposit reconciliation | `cod-reconciliation.ts:290` | p_site_id, p_entry_id, p_deposited_amount_minor, p_idempotency_key |
| `complete_order_refund` | On return/refund approval | `returns.ts:279` | p_refund_id, p_provider_refund_id |

### Why Server-Authoritative

The canonical architecture prevents amount manipulation at multiple layers:
1. The Razorpay order is created server-side with `amount = DB order.total * 100` — the client never chooses the amount.
2. The client sends `razorpay_order_id` back; the server checks `orders.payment_id === razorpay_order_id` to confirm it created that order.
3. HMAC verification proves Razorpay signed `(razorpay_order_id, razorpay_payment_id)` — it does NOT prove the amount, which is why step 1 and step 2 are both required.
4. For subscriptions, a server-side Razorpay API fetch (`fetchRazorpayPayment`) confirms `capturedAmount >= plan price` before activation.
5. Ledger entries are written exclusively by `SECURITY DEFINER` Postgres RPCs, never by `.from(table).insert/update` in TypeScript.

---

## 7. Webhook Architecture

### Payment Webhooks

There is no inbound Razorpay webhook receiver in the api-gateway routes. The payment verification flow is client-initiated (the client receives the Razorpay modal callback and POSTs to `/payments/razorpay/verify`). There is no `POST /webhooks/razorpay` or `POST /v1/storefront/webhooks/razorpay` handler in any of the route files.

The internal payment routes (`internal-payment-routes.ts`) expose worker-to-gateway endpoints for programmatic payment confirmation (`POST /storefront/internal/payments/confirm`), failure (`/failure`), and event (`/event`) marking. These are secured by `isInternalApiSecretRequest` and are designed for queue workers or webhook processors to call back into the gateway — but no inbound Razorpay webhook handler populating these is currently found in the repository routes.

Outbound webhooks (merchant-subscribed) exist via `webhook_subscriptions` and are dispatched by `services/webhook-service`. The `operations.ts` route at line 145 provides `POST /webhook-deliveries/dispatch` which proxies to the webhook-service Worker binding. PayPal env includes `PAYPAL_WEBHOOK_ID` (`checkout-payment-routes.ts:210`) suggesting webhook signature validation is wired in the PayPal adapter, but there is no inbound PayPal webhook receiver route either.

### COD Webhooks

No COD-specific webhooks exist. COD collection and reconciliation are merchant-pull (API calls from the merchant mobile app or control plane), not event-pushed.

---

## 8. Payment Status Flow

```
Order Created (payment_method=razorpay/cashfree/paypal/stripe)
  orders.payment_status = 'pending'
  orders.status = 'pending'
  ↓
Provider Order Created (attachPaymentReference)
  orders.payment_id = <razorpay_order_id | cashfree_order_id | paypal_order_id | stripe_session_id>
  ↓
Customer completes payment on provider UI
  ↓
Verification / Capture
  → confirm_order_payment_with_ledger RPC called
  orders.payment_status = 'paid'
  orders.status = 'confirmed'
  payment_transactions row inserted (canonical ledger)
  ↓
Order Fulfilled → 'delivered'

Failure path:
  record_order_payment_failure_with_ledger
  orders.payment_status = 'failed'
  orders.status = 'cancelled'
  inventory released if p_release_inventory = true

COD path:
  orders.payment_status = 'pending' (stays pending until physical collection)
  cod_reconciliation_entries.status: pending → collected → reconciled
  reconcile_cod_remittance_with_ledger writes ledger entry on deposit

V1 Session path (payments.ts):
  payments.status: pending/authorized → captured → refunded/voided
  payments.capture_ledger_transaction_id set on capture
  payments.refund_ledger_transaction_id set on refund
```

DB columns involved: `orders.payment_status`, `orders.payment_method`, `orders.payment_id`, `orders.status`, `payment_transactions.gateway`, `payment_transactions.provider_payment_id`, `payments.status` (V1 only), `cod_reconciliation_entries.status`.

---

## 9. Refund Architecture

**Return-based refunds** (`returns.ts`):
1. Merchant creates a return via `POST /returns` (sets `returns.status='pending'`).
2. Merchant approves refund via `POST /returns/:id/refund/complete`:
   - Validates step-up token is not required in this route (unlike V1 `/payments/:id/refund`)
   - Calls `db.rpc('complete_order_refund', { p_refund_id, p_provider_refund_id })` (line 279)
   - `complete_order_refund` is a SECURITY DEFINER RPC that writes the canonical ledger entry and updates `refunds.status = 'refunded'`
3. The `refunds` table stores `provider_refund_id`, `amount`, `currency`, `status`.

**V1 session refunds** (`payments.ts:467`):
1. `POST /payments/:id/refund` — requires a captured payment session.
2. Step-up verification is enforced: `verifySensitiveActionStepUp(action='refund.approve', ...)` with HMAC-signed step-up token (line 497–507).
3. For Razorpay payments without a manual `provider_refund_id`: calls `createRazorpayPaymentProvider.refund(...)` to trigger the refund at Razorpay, obtains `providerRefundId` (lines 533–559).
4. Non-Razorpay providers must supply `provider_refund_id` manually (line 493).
5. Calls `postPaymentLedger(db, buildPaymentRefundLedgerPosting(...))` → RPC `post_settlement_ledger_transaction`.
6. Updates `payments.status` to `'refunded'` (full) or keeps `'captured'` (partial), increments `payments.refunded_amount_minor`.
7. Emits `payment.refunded` domain event.
8. Over-refund guard: `cumulativeRefundMinor > payment.amount_minor` → 409 ConflictError (line 488).

---

## 10. Missing Payment Capabilities

**No inbound webhook receiver for any provider:** Razorpay, Cashfree, PayPal, and Stripe all support provider-pushed webhook events (payment captured, payment failed, refund completed). None of these have inbound receiver routes. The only way payment state is confirmed is via client-initiated verify calls. This means if the client tab is closed before `/payments/razorpay/verify` is called (e.g., network drop after Razorpay modal closes), the order stays in `pending` forever. No server-side reconciliation or provider-poll mechanism exists to recover these.

**Stripe lacks a verify/capture loop:** The storefront Stripe flow (`checkout-payment-routes.ts:945`) creates a hosted checkout session and redirects the customer. There is no `/payments/stripe/verify` or `/payments/stripe/success` webhook handler to confirm the payment and call `confirmPayment`. Stripe is effectively unusable for end-to-end order confirmation without an inbound webhook.

**UPI is schema-only:** `V1PaymentProviderSchema` enumerates `'upi'` but no UPI order-creation or verification route exists in the gateway. UPI transactions go through Razorpay or Cashfree payment modals (where the customer selects UPI as the method) but there is no standalone UPI-direct flow.

**COD has no pincode serviceability or value limits:** For India operations, COD is typically restricted by pincode serviceability (carrier-dependent) and order value ceilings. Neither restriction is implemented. `cod_enabled` is the only store-level gate.

**No payment retries / partial-payment support:** There is no retry logic for failed payment attempts. If `createIntent` fails, the idempotency claim is marked failed and the client must start over. No partial-payment (split-payment across multiple instruments) is supported.

**PayPal currency limitation:** `orderAmountMinorUnits` (checkout-payment-routes.ts:152) hard-rejects non-INR orders with `PAYMENT_CURRENCY_UNSUPPORTED`. PayPal natively supports multi-currency; this check means PayPal is only usable for INR-denominated stores, limiting its utility since PayPal is primarily used for USD/international transactions.

**No tokenized payment (save card) in storefront path:** The V1 session schema has `tokenize: boolean` (payment.schema.ts:13), but the storefront Razorpay flow does not pass a tokenization request. Saved cards / recurring payment tokens are not surfaced at checkout.

**Cashfree `CHECKOUT_POSTCOMMIT_DEFERRAL` is on by default:** The `isCheckoutPostCommitDeferralEnabled` flag (`checkout-payment-routes.ts:143`) defaults to `'on'`. Post-commit work (inventory confirmation emails, etc.) is deferred to `waitUntil` — if the Worker is recycled or a transient error occurs, post-commit failures are only logged and not retried (`catch` at line 399 logs an error but does not re-enqueue).
