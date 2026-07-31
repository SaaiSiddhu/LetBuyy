# Centralized Checkout Platform Design

> Evidence-based architecture design. No code was modified. All findings drawn from direct
> file reads of source and prior research documents.
>
> Key governance constraint (CLAUDE.md line 34): `apps/checkout` is an **explicitly deprecated
> runtime alias**. Any centralized checkout runtime must use a different root, such as
> `apps/checkout-platform` or `services/checkout-runtime` (the latter is reserved but not
> implemented per CLAUDE.md line 19).

---

## 1. The Problem: Why Centralize?

### Current State

Checkout is a 1,160-line `'use client'` component (`CheckoutClient`) embedded directly inside
`apps/storefront-runtime` at the path
`apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx`.
It is served under the route `/store/{subdomain}/checkout` by the storefront-runtime Next.js app.

### Coupling Evidence

**1. Cart context coupling (storefront-runtime-specific)**

`checkout-client.tsx` line 3 imports `useCart` from `@/context/cart-context`. That context is
declared inside `apps/storefront-runtime/src/context/cart-context.tsx`. There is no package
boundary. Checkout cannot run outside storefront-runtime without this context or a replacement.

**2. API proxy coupling (storefront-runtime same-origin requirement)**

The checkout client calls five storefront-runtime Next.js API routes directly:
- `POST /api/orders` (storefront-runtime `/api/orders/route.ts`)
- `POST /api/shipping/rates` (storefront-runtime `/api/shipping/rates/route.ts`)
- `GET /api/coupons/validate` (storefront-runtime `/api/coupons/validate/route.ts`)
- `GET /api/customer/addresses` (storefront-runtime `/api/customer/addresses/route.ts`)
- `POST /api/customer/auto-create` (storefront-runtime `/api/customer/auto-create/route.ts`)

These are same-origin proxy routes that exist inside the storefront-runtime app. A checkout
served from a different origin cannot hit `/api/*` — those paths are local to the storefront
deployment. The `storefrontBrowserApiFetch` helper (`@/lib/api/browser-client`) constructs
`/api/storefront/{subdomain}{path}` for Razorpay flows, also same-origin.

**3. CSS token coupling**

`checkout-client.tsx` uses semantic token classes (`card-theme`, `input-theme`, `text-theme`,
`bg-surface`, `bg-surface-hover`, `text-theme-secondary`, `text-theme-muted`, `border-card`)
that are defined in the storefront-runtime global CSS/Tailwind config. A standalone checkout app
would need to bundle or replicate this design-token stylesheet from `@letbuyy/ui`.

**4. Component coupling**

`checkout-client.tsx` line 18 imports `StorefrontEmptyState` from
`@/components/storefront/storefront-states` — an internal storefront-runtime component.

**5. Asset coupling**

Razorpay modal `image` field is hardcoded to `/logo.png` (line 490 of checkout-client.tsx),
a root-relative path valid only within the storefront-runtime static asset tree.

### What These Couplings Prevent

| Capability | Blocked By |
|---|---|
| Deploy checkout independently without touching storefront | Same-origin API proxy coupling (#2) |
| Upgrade checkout UI without storefront redeploy | All five couplings above |
| Apply store brand colors to checkout | No dynamic brand data passed by `page.tsx` (only `storeName`, payment flags) |
| Show dynamic store logo in Razorpay modal | Hardcoded `/logo.png` (#5) |
| A/B test checkout versions | No versioning surface; single monolithic component |
| Add checkout-specific security headers or CSP | Shared with storefront deployment |
| Extend checkout with plugins/merchant config | 1,160-line monolith with no composition points |
| Run checkout under a distinct subdomain | Same-origin constraint; cookie scope issues |

---

## 2. Vision: apps/checkout-platform

The governance constraint is firm: `apps/checkout` is a deprecated alias (CLAUDE.md line 34).
The correct new root is `apps/checkout-platform` (or the reserved
`services/checkout-runtime` once ARB approves scope with real source, tests, and deployment
config). This document uses `apps/checkout-platform` throughout.

### Target Topology

```
storefront-runtime  ({store}.letbuyy.com/store/{subdomain})
      │
      │  1. Cart "Proceed to Checkout" → generates signed handoff token
      │  2. redirect (or fetch) → checkout-platform
      ▼
apps/checkout-platform  (checkout.letbuyy.com/{store})
      │
      │  All API calls via gateway (no storefront BFF dependency)
      ▼
api-gateway  (services/api-gateway, Hono)
      │   /v1/checkout/{sessionId}/*        (hosted checkout state machine — checkout.ts)
      │   /v1/storefront/{subdomain}/orders  (create order)
      │   /v1/storefront/{subdomain}/payments/razorpay/*
      │   /v1/storefront/{subdomain}/shipping/rates
      │   /v1/storefront/{subdomain}/coupons/validate
      │   /v1/customer/{customerId}/addresses
      ▼
Canonical Ledger (Postgres RPCs)
      create_checkout_order
      attach_order_payment_reference_with_ledger
      confirm_order_payment_with_ledger
      record_order_payment_failure_with_ledger
```

The `services/api-gateway/src/routes/checkout.ts` already implements a hosted checkout session
state machine (`contact → delivery → payment_intent → completed | failed`) with HMAC-signed
cart handoff verification (cart-routes.ts `GET /:subdomain/cart/:cartToken/checkout-url`).
This path is structurally complete but blocked in live mode
(`HR-MERCHANT-PSP-LIVE` comment at line 573 of checkout.ts). Centralizing checkout would
activate this path as the primary flow.

---

## 3. URL Architecture

### Current URL

```
{store}.letbuyy.com/store/{subdomain}/checkout
```

This is a path under the storefront-runtime Next.js app. The domain is the store's public
domain (`{subdomain}.letbuyy.com` or custom domain via proxy.ts). Checkout shares the same
origin, cookie scope, and Vercel deployment as the rest of the storefront.

### Target Options

#### Option A: `checkout.{store}.letbuyy.com`

Per-store subdomain for checkout.

| Dimension | Assessment |
|---|---|
| SEO | `noIndex: true` is already set on the checkout page. Checkout has no SEO value; subdomain isolation is neutral. |
| Branding | The browser address bar shows the store's own checkout subdomain — strong brand signal. |
| Security | Fully isolated cookie scope. Cross-store replay attacks are blocked at the cookie layer. CSP and `frame-ancestors` scoped per store. |
| CORS | Storefront and checkout are different origins. The gateway already enforces CORS for the storefront; a new `checkout.{store}.letbuyy.com` origin must be added to the gateway allowlist. |
| Multi-tenancy | Requires a wildcard certificate `*.{store}.letbuyy.com` or per-store cert provisioning. Significant infrastructure complexity at scale. |
| Deployment | Not compatible with a single Vercel project for checkout-platform; would require per-store Vercel project or custom routing. Not recommended. |

**Verdict: High complexity. Not recommended for V1.**

#### Option B: `{store}.letbuyy.com/checkout` (path-based, same storefront)

Keep checkout under the storefront domain but at `/checkout` (no `/store/{subdomain}` prefix).

| Dimension | Assessment |
|---|---|
| SEO | `noIndex` already set. No SEO impact. |
| Branding | URL shows the store's own domain — clean, expected by shoppers. |
| Security | Same cookie scope as storefront. Easier session sharing. No new CORS origin. |
| CORS | No new origin; all gateway calls remain same-site. |
| Cart handoff | Cart state already in storefront localStorage; no cross-origin handoff needed. |
| Deployment independence | The checkout pages would live in a separate Next.js app but be served under the same subdomain via path routing (Vercel rewrites or proxy). This is achievable but requires proxy coordination. |
| Multi-tenancy | Handled by the existing `{subdomain}.letbuyy.com` custom domain routing in `src/proxy.ts`. |

**Verdict: Good balance of branding, security, and operational simplicity. Recommended for
a phased approach where URL does not change initially.**

#### Option C: `checkout.letbuyy.com/{store}` (central with store routing)

All stores share a single `checkout.letbuyy.com` origin, with the store identified by path.

| Dimension | Assessment |
|---|---|
| SEO | `noIndex` set. No SEO impact from the domain change. |
| Branding | Address bar shows `checkout.letbuyy.com` — platform-branded, not store-branded. Weaker store identity signal. |
| Security | Single cookie domain for all stores. Must use `site_id` in JWT claims to enforce tenant isolation — the checkout session token is the isolation boundary, not the cookie domain. |
| CORS | Single origin. Gateway CORS allowlist has one entry for all checkout. Simpler. |
| Cart handoff | Cross-origin from storefront. Requires HMAC-signed cart token URL (already built in `cart-routes.ts`). |
| Deployment | Single Vercel project for `checkout.letbuyy.com`. Easiest to deploy, version, and patch independently. |
| Razorpay | Razorpay modal `referrer` domain changes to `checkout.letbuyy.com`; the gateway does not restrict by referrer, but Razorpay account domain whitelisting may need updating. |
| Independent deployment | Fully decoupled from storefront-runtime. Checkout deploys, patches, and versions without any storefront change. |

**Verdict: Best for independent deployment, security patching, and A/B testing checkout
versions. Recommended as the long-term target. Requires HMAC cart handoff (already built).**

### Recommendation Summary

| Phase | URL | Rationale |
|---|---|---|
| Phase 1 (extract) | `{store}.letbuyy.com/store/{subdomain}/checkout` (no change) | Zero URL migration risk; users see nothing different |
| Phase 2 (standalone) | `{store}.letbuyy.com/checkout` | Simpler URL; same origin; no cart handoff protocol needed |
| Phase 3 (fully central) | `checkout.letbuyy.com/{store}` | Full deployment independence; single Vercel project; A/B capable |

---

## 4. Session and Auth Architecture

### Current Session Model

There is no checkout session in the current implementation. Checkout state is entirely
in-browser React `useState` (step, formData, appliedCoupon, selectedRateId, etc.). Cart state
is in `localStorage` (`lb_cart` and `lb_cart_token`). State is lost on page refresh.

An idempotency key is generated via `crypto.randomUUID()` and held in a `useRef` — it is
scoped to the component mount lifetime (lost on refresh).

### How Checkout Knows the Store

Currently: the `page.tsx` server component calls `StoreService.getStoreBySubdomain(subdomain)`
and passes `storeId`, `sellerId`, `subdomain`, `storeName`, `codEnabled`,
`onlinePaymentEnabled` as React props. The subdomain comes from the Next.js route param
`[subdomain]`.

In a central checkout (`checkout.letbuyy.com/{store}`), the store is identified by:
- The `{store}` path segment (subdomain string), OR
- The HMAC-signed checkout session token created by `cart-routes.ts`
  `GET /:subdomain/cart/:cartToken/checkout-url`, which encodes `site_id`, `cart_id`,
  `cart_token`, and `expires_at`.

### Checkout Session Token Design

The gateway's `checkout.ts` already persists checkout sessions to the `checkout_sessions`
table with a state machine. A minimal checkout session token for the platform should contain:

```json
{
  "session_id": "cs_01JXA...",
  "site_id": "uuid-of-the-store",
  "subdomain": "acme-store",
  "cart_token": "cart-uuid",
  "customer": {
    "email": "shopper@example.com",
    "name": "Jane Doe",
    "phone": "9876543210"
  },
  "delivery": {
    "address": "123 MG Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560001",
    "shipping_rate_id": "rate-uuid"
  },
  "coupon_code": "SAVE10",
  "payment_method": "razorpay",
  "stage": "delivery",
  "expires_at": "2026-06-18T14:00:00Z",
  "idempotency_key": "checkout-order-razorpay-uuid"
}
```

This session is persisted server-side in the `checkout_sessions` table (already exists).
The `session_id` is the URL path segment for the checkout pages, enabling refresh-safe state
(the current implementation is NOT refresh-safe).

### Cart Handoff Protocol

The HMAC-signed cart handoff URL is already built in
`services/api-gateway/src/routes/storefront/cart-routes.ts`:
- Route: `GET /v1/storefront/:subdomain/cart/:cartToken/checkout-url`
- Payload: `site_id`, `cart_id`, `cart_token`, `expires_at`
- Signing: HMAC-SHA256 (`CHECKOUT_HANDOFF_SECRET` env var)
- Gateway verification: `checkout.ts` verifies signature on session initiation

For same-origin (Options A/B), this signed URL is a progressive enhancement — the storefront
can pass the `cartToken` via cookie or query param within the same domain. For Option C
(central checkout), the HMAC-signed URL is required to prevent cross-site cart injection.

**Cart handoff sequence for central checkout:**

```
1. Shopper clicks "Proceed to Checkout" on storefront
2. storefront-runtime calls:
     GET /api/storefront/{subdomain}/cart/{cartToken}/checkout-url
     (storefront BFF → gateway cart-routes.ts)
3. Gateway generates HMAC-signed URL:
     checkout.letbuyy.com/{subdomain}?
       cart_id=...&cart_token=...&site_id=...&expires_at=...&signature=...
4. Browser redirects to checkout.letbuyy.com
5. checkout-platform verifies signature via gateway:
     POST /v1/checkout/{cartId}/contact  (initiates session)
6. Gateway verifies HMAC, loads cart from `carts` table,
   creates checkout_sessions row, returns session_id
7. checkout-platform renders checkout using session_id
```

---

## 5. Component Boundaries

### What Stays in storefront-runtime

These components have no checkout logic and belong to the catalog/cart experience:

| Component | File | Reason to Stay |
|---|---|---|
| Cart drawer | `src/components/cart/cart-drawer.tsx` | Part of product browse UX |
| Cart page | `src/app/store/[subdomain]/cart/cart-client.tsx` | Pre-checkout cart review |
| Mini-cart / Add to Cart | Product pages, collection pages | Catalog interaction, not checkout |
| "Proceed to Checkout" button | `cart-client.tsx` line 170 | Transition point; generates handoff URL |
| Cart context | `src/context/cart-context.tsx` | Manages storefront-side cart state |

### What Moves to apps/checkout-platform

These components implement the purchase commitment flow:

| Component | Current Location | Notes |
|---|---|---|
| Checkout form (step 1: address) | `checkout-client.tsx` lines 675–896 | Contact info, address, shipping rate selector |
| Payment selection (step 2) | `checkout-client.tsx` lines 899–1042 | Razorpay, COD, payment method radio |
| Order placement logic | `checkout-client.tsx` lines 413–550 | `createCheckoutOrder`, `handlePayment`, `handleCODOrder` |
| Inline success screen | `checkout-client.tsx` lines 553–601 | Should become a navigable route with server-rendered order details |
| Checkout page server component | `src/app/store/[subdomain]/checkout/page.tsx` | Becomes the checkout-platform entry server component |
| Coupon validation UI | `checkout-client.tsx` lines 366–411 | The API call should move to checkout-platform's own BFF |
| Shipping rate selection UI | `checkout-client.tsx` lines 820–887 | Should re-fetch with real pincode after address entry |
| Saved address autofill | `checkout-client.tsx` lines 192–205 | Auth-gated; checkout-platform needs its own customer session |
| Order confirmation (success) page | `success/page.tsx` (currently a stub) | Should be a real confirmation page in checkout-platform |
| Stale return stubs | `paypal-return/page.tsx`, `success/page.tsx` | Move to checkout-platform or retire when LB-2 is implemented |

### Shared Package: @letbuyy/checkout-core

The storefront-runtime manifest (`runtime.manifest.json`) already declares
`@letbuyy/checkout-core` as an allowed workspace package dependency. This package does not
currently exist as a deployed package but its name signals the intended abstraction layer.
The checkout-platform app should consume shared checkout primitives (form validation,
order payload builders, idempotency key utilities) from `@letbuyy/checkout-core` rather
than duplicating logic.

---

## 6. API Gateway Boundaries

The gateway already has a clean boundary between storefront BFF routes and the hosted
checkout state machine. The table below formalizes route ownership by consuming app.

| Route Group | Pattern | Owner (caller) |
|---|---|---|
| Server-side cart | `/v1/storefront/{subdomain}/cart/*` | storefront-runtime |
| Cart checkout-url (handoff) | `/v1/storefront/{subdomain}/cart/{token}/checkout-url` | storefront-runtime (generates URL for checkout-platform) |
| Coupon validation | `/v1/storefront/{subdomain}/coupons/validate` | checkout-platform (currently storefront-runtime BFF) |
| Shipping rates | `/v1/shipping/rates` | checkout-platform (currently storefront-runtime BFF) |
| Customer addresses | `/v1/customer/{id}/addresses` | checkout-platform (auth-gated) |
| Create order | `/v1/storefront/{subdomain}/orders` | checkout-platform (currently storefront-runtime BFF `/api/orders`) |
| Razorpay payment intent | `/v1/storefront/{subdomain}/payments/razorpay/order` | checkout-platform |
| Razorpay verify | `/v1/storefront/{subdomain}/payments/razorpay/verify` | checkout-platform |
| Hosted checkout state machine | `/v1/checkout/{cartId}/*` | checkout-platform (activate this path) |
| Store branding | `/v1/stores/{storeId}/branding` | checkout-platform (GET, for brand tokens) |
| Internal payment confirm | `/v1/storefront/internal/payments/confirm` | webhook-service only (no client access) |
| Internal payment failure | `/v1/storefront/internal/payments/failure` | webhook-service only (no client access) |
| Order management (CRUD) | `/v1/orders/*` | merchant-control-plane |
| Order read (shopper) | `/v1/storefront/{subdomain}/orders/{id}` | storefront-runtime (order history, tracking) |

### BFF Routes in apps/checkout-platform

The checkout-platform app would own its own set of Next.js API routes (same pattern as
storefront-runtime BFF), keeping the browser calling same-origin `/api/*`:

| BFF Route | Proxies To |
|---|---|
| `POST /api/checkout/orders` | `POST /v1/storefront/{subdomain}/orders` |
| `POST /api/checkout/payments/razorpay/order` | `POST /v1/storefront/{subdomain}/payments/razorpay/order` |
| `POST /api/checkout/payments/razorpay/verify` | `POST /v1/storefront/{subdomain}/payments/razorpay/verify` |
| `GET /api/checkout/shipping/rates` | `POST /v1/shipping/rates` |
| `GET /api/checkout/coupons/validate` | `GET /v1/storefront/{subdomain}/coupons/validate` |
| `GET /api/checkout/customer/addresses` | `GET /v1/customer/{id}/addresses` |
| `POST /api/checkout/customer/auto-create` | `POST /v1/storefront/{subdomain}/customers/auto-create` |
| `GET /api/checkout/session/{sessionId}` | `GET /v1/checkout/{cartId}` |
| `GET /api/checkout/store/branding` | `GET /v1/stores/{storeId}/branding` |

---

## 7. Upgrade and Deployment Independence

### How Centralization Enables Independent Deployment

**Independent deployment:**
`apps/checkout-platform` is a separate Vercel project with its own `vercel.json`,
environment variables, and deployment pipeline. A security patch to the Razorpay integration
(e.g. a signature verification hardening) can be deployed to `apps/checkout-platform`
without touching `apps/storefront-runtime`. Currently both live in the same deployment.

**Independent versioning and A/B testing:**
The checkout-platform can expose versioned checkout flows:
- `checkout.letbuyy.com/{store}/v1` — current two-step flow
- `checkout.letbuyy.com/{store}/v2` — three-step flow with saved-address step

The gateway already supports the hosted checkout state machine which could power a
different step sequence without touching the storefront.

**Independent security headers:**
The current checkout shares CSP, `X-Frame-Options`, and other headers with the storefront.
A centralized checkout-platform can set stricter CSP specifically for the payment flow
(e.g. `script-src 'self' https://checkout.razorpay.com` without the catalog's media CDN
domains).

**Independent feature flags:**
Merchant checkout configuration (from `apps/merchant-control-plane/src/app/[store]/settings/checkout/page.tsx`)
controls `contact_method`, `customer_accounts`, `full_name`, `company_name`, `order_notes`,
`tip_option`. These settings are loaded from `GET /v1/stores/{storeId}/settings` and can be
consumed by the checkout-platform at session initialization, enabling per-merchant checkout
customization without storefront involvement.

**Independent scaling:**
During peak traffic, the checkout-platform can be scaled independently of the storefront.
The canonical ledger RPCs (`create_checkout_order`, `confirm_order_payment_with_ledger`)
are already idempotency-safe and can handle concurrent checkout attempts from a scaled
checkout-platform fleet.

---

## 8. Migration Path

### Phase 1: Component Extraction (no URL change, no new app)

**Goal:** Decouple the checkout component from storefront-runtime internal dependencies.
**URL change:** None. Checkout remains at `/store/{subdomain}/checkout`.
**Deployment change:** None. Still inside storefront-runtime.

Steps:
1. Create `packages/checkout-core` workspace package. Move form validation, idempotency
   key utilities, and `buildOrderPayload` function into this package.
2. Remove `@/context/cart-context` import from `checkout-client.tsx`. Inject cart state
   as props (`items`, `cartTotal`, `clearCart`, `cartToken`) from `page.tsx`.
3. Remove `@/components/storefront/storefront-states` import. Implement a generic
   `<CheckoutEmptyState>` in `packages/checkout-core`.
4. Replace `@/lib/api/browser-client` imports with configurable API client injected via
   context or props.
5. Make `logoUrl` and `brandColor` props in `CheckoutClient` instead of hardcoded
   `/logo.png` and `var(--primary, rgb(99 102 241))`. Fetch from
   `GET /v1/stores/{storeId}/branding` in the server component.
6. Persist idempotency keys in `sessionStorage` instead of `useRef` (survives refresh).

**Minimum viable first step:** Items 2 and 6. Decoupling `useCart` and making idempotency
keys refresh-safe are the highest-value changes with the lowest risk. Item 2 also breaks
the internal context import, which is the primary barrier to extracting the component.

**Validation:** Run `node scripts/validate-governance.mjs` after moving any package
boundaries.

---

### Phase 2: Standalone Checkout App (URL stays at store domain)

**Goal:** Deploy checkout as a separate Next.js app while keeping it under the store's domain.
**URL:** `{store}.letbuyy.com/checkout` (no `/store/{subdomain}` prefix).
**Deployment:** New Vercel project for `apps/checkout-platform`. Proxy rewrites in
`apps/storefront-runtime/next.config.ts` forward `/checkout` paths to checkout-platform.

Steps:
1. Scaffold `apps/checkout-platform` as a Next.js app with a runtime manifest
   (`runtimeCategory: "next-app"`, `actorType: ["shopper"]`).
2. Move checkout pages and BFF API routes from storefront-runtime into checkout-platform.
3. Add checkout-platform BFF routes (section 6 above) — these replace the storefront-runtime
   `/api/orders`, `/api/shipping/rates`, `/api/coupons/validate` proxy routes for checkout.
4. Add `NEXT_PUBLIC_GATEWAY_URL` env var to checkout-platform pointing to the gateway.
5. Configure `apps/storefront-runtime/next.config.ts` rewrites:
   ```js
   { source: '/checkout/:path*', destination: 'https://checkout.letbuyy.com/{store}/:path*' }
   ```
6. Update cart-client.tsx: the "Proceed to Checkout" link becomes a call to generate an
   HMAC-signed handoff URL, then a redirect, instead of a plain Next.js `<Link>`.
7. Activate the gateway hosted checkout state machine (`/v1/checkout/*`) by removing the
   `HR-MERCHANT-PSP-LIVE` block or routing live Razorpay merchants through it.

**Cookie strategy:** At this phase checkout is still served under `{store}.letbuyy.com`
(via proxy rewrite). Customer session cookies scoped to the store domain work transparently.

---

### Phase 3: Fully Central Checkout (checkout.letbuyy.com/{store})

**Goal:** Complete deployment independence. Single checkout.letbuyy.com Vercel project.
**URL:** `checkout.letbuyy.com/{store}/checkout/{sessionId}`
**Cart handoff:** HMAC-signed handoff URL (already built in `cart-routes.ts`).

Steps:
1. Update storefront cart-client.tsx to call `GET /api/storefront/{subdomain}/cart/{token}/checkout-url`
   and redirect the browser to the returned `checkout.letbuyy.com` URL.
2. Configure `checkout.letbuyy.com` as a separate Vercel project domain.
3. Update gateway CORS allowlist to include `checkout.letbuyy.com`.
4. Razorpay account: add `checkout.letbuyy.com` to the list of allowed referrer domains.
5. Customer auth cookie strategy: Issue a short-lived checkout session JWT signed by
   the identity-platform (`LETBUYY_IDENTITY_PUBLIC_JWKS` public key). The checkout
   session token (section 4 above) carries `site_id`, ensuring tenant isolation even
   though all stores share the `checkout.letbuyy.com` cookie domain. The checkout
   session JWT is a different token from the customer HS256 token — they serve different
   auth purposes.
6. Add `checkout.letbuyy.com` to the `Content-Security-Policy` `frame-ancestors` directive
   in the storefront-runtime headers if any embedded checkout flow is used.

---

## 9. Known V1 Limitations Addressed by Centralization

The following V1 limitations documented in prior research are resolved by centralization:

| V1 Limitation | Resolution |
|---|---|
| Shipping rate uses `pincode: '000000'` placeholder at mount (checkout-client.tsx line 222) | checkout-platform re-fetches rates after the address step completes (pincode is available); phase 2 of the state machine naturally separates address capture from rate fetch |
| Inline success screen with no URL change (URL stays at `/store/{subdomain}/checkout`) | checkout-platform implements a dedicated `/checkout/{sessionId}/success` route with server-rendered order confirmation |
| Idempotency keys lost on page refresh (stored in `useRef`) | Phase 1 fix: store in `sessionStorage`; Phase 2 fix: derive from `checkout_sessions.id` |
| No stock-specific error message for out-of-stock failures | checkout-platform can inspect the RPC error code and surface a specific "item out of stock" message |
| Success screen uses hardcoded Tailwind slate colors, not token-backed | checkout-platform uses `@letbuyy/ui` tokens throughout; success screen gets `brandColor` prop |
| Store logo hardcoded to `/logo.png` | checkout-platform fetches `logoUrl` from `GET /v1/stores/{storeId}/branding` |
| COD-only merchant sees Razorpay payment option disabled with no clear explanation | checkout-platform can render a cleaner "COD only" payment screen without the hidden radio UI |
| Two checkout state machines exist (client useState + gateway checkout.ts) and neither is the primary | checkout-platform activates the gateway state machine as the canonical backend; client state becomes a view of the session |

---

## 10. Governance and Topology Constraints

Before any work begins, the following governance requirements apply:

1. **`apps/checkout` is forbidden.** CLAUDE.md line 34 lists it as a deprecated runtime alias.
   Use `apps/checkout-platform` or `services/checkout-runtime` (requires ARB scope approval
   to move from reserved/manifest-only to real implementation per CLAUDE.md line 19).

2. **New runtime manifest required.** Every new app root needs a `runtime.manifest.json`
   following the schema at `config/runtime/runtime-manifest.schema.json`. The storefront-runtime
   manifest shows the required shape. The new manifest must declare:
   - `actorType: ["shopper"]`
   - `runtimeCategory: "next-app"`
   - `allowedDependencies` (include `@letbuyy/checkout-core`, `@letbuyy/ui`, `@letbuyy/api-client`)
   - `forbiddenDependencies` must include `apps/*`, `services/*`

3. **Run governance validation.** After any topology change:
   ```
   node scripts/validate-governance.mjs
   ```

4. **Two-lane merge rule.** The CLAUDE.md constitution requires the two-lane remediation
   setup for concurrent work. Checkout extraction is lane-sized work; it should not be merged
   on the same lane as other active changes.

5. **ARB required for payment/OAuth/RLS changes.** The Phase 3 JWT strategy and CORS
   allowlist changes touch auth and security. These require ARB approval before merge.

6. **No direct money table access.** The canonical-ledger-only validator forbids
   `.from(money_table).insert/update` in TypeScript. checkout-platform must call RPCs
   via `db.rpc` through the gateway — it must never hold a Supabase service-role key.
   All payment operations go through the gateway's execution adapters.

7. **`@letbuyy/checkout-core` package.** The storefront-runtime manifest already declares
   this as an allowed dependency. The package must be created before checkout-platform
   imports from it.
