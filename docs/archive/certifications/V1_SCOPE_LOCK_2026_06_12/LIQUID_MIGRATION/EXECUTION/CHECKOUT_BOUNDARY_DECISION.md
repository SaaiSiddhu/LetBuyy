# CHECKOUT_BOUNDARY_DECISION.md

**Status:** FROZEN DECISION · **Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · **Authority:** Constitution §234 / ART (hosted checkout) + ART-17/18. Code-cited; repository truth.

## Decision (frozen)

> **Storefront = Liquid. Checkout Origin = a separate runtime (`checkout.letbuyy.com`).** The Liquid migration delivers the storefront *and the cart that mints a signed handoff to checkout*. It does **NOT** rewrite, port, or absorb the checkout origin. Checkout is **out of scope** for both the Liquid migration and the React storefront removal.

## Current checkout architecture (verified)

- **Separate origin:** `CHECKOUT_ORIGIN = "https://checkout.letbuyy.com"` (production `services/api-gateway/wrangler.toml:273`; staging `checkout-staging.letbuyy.com` `:63,154`; `config/env/production.env.template:135`). It is its own deployable runtime, not a storefront route.
- **Signed cart handoff:** the cart mints a one-time signed URL — `GET /:subdomain/cart/:cartToken/checkout-url` (`services/api-gateway/src/routes/storefront/cart-routes.ts:528`) computes `signature = hmacSha256Hex(secret, signaturePayload)` (`:566`) over the canonical cart contents and returns a URL to `CHECKOUT_ORIGIN` with the `signature` query param (`:574`). Crypto via `../../lib/crypto` (`hmacSha256Hex`/`sha256Hex`).
- **Constitution §234:** "A hosted `checkout.letbuyy.com` origin (contact → delivery → payment → confirm) is built and deployed, consuming a **cart-bound signed handoff** (a hash of sorted line items + coupons + subtotal inside the HMAC). The public order-create is gated behind the signed handoff. … The checkout-session state machine stays canonical in the monolith; **the client React cart is a thin view.**"
- **Server authority:** the cart is re-priced server-side (`cart-routes.ts hydrateCartLines`); order creation is gated behind the signed handoff in the gateway (`checkout-payment-routes.ts`); the canonical double-entry ledger owns money.

## Why checkout is outside storefront rendering

1. **Security isolation (PCI/payment surface).** Payment capture (Razorpay/COD) must run on a hardened, separately-deployed origin with its own CSP/headers — not inside a themeable, merchant-authored render surface where Liquid/sections are user-influenced. Mixing a payment form into a Liquid theme would expose the money path to theme-author content.
2. **Server-authoritative money.** The checkout-session state machine and order-create are canonical in `api-gateway`; the storefront (React or Liquid) is "a thin view" (§234). Rendering engine choice is irrelevant to where money truth lives.
3. **Tamper-proof handoff.** The HMAC-signed cart handoff guarantees the checkout origin trusts only server-verified cart contents — independent of how the storefront rendered.

## Why checkout is NOT part of React storefront removal

- The React storefront removal (L17) deletes the **render layer** (sections, bespoke pages, contexts). The checkout origin is **not a storefront render artifact** — it is a separate runtime consuming a signed handoff.
- Shopify precedent: `checkout.liquid` was deprecated; checkout is not a Liquid surface there either. "Full Liquid storefront" has never meant "Liquid checkout."
- Therefore `checkout/checkout-client.tsx` + `checkout/page.tsx` are classified **KEEP-PERMANENT** in `LIQUID_COMPLETION_REACT_EXTRACTION_MAP.md` — never deleted by the Liquid program.

## Future checkout ownership

Checkout remains owned by the **money/checkout domain** (`api-gateway` checkout-session state machine + the `checkout.letbuyy.com` origin). Any future checkout change is a separate, money-domain-governed initiative — not a theme/render initiative. The Liquid program has **zero** checkout deliverables beyond consuming the existing handoff from the Liquid cart (L8).

## Boundaries

| Surface | Owner | Engine | In Liquid scope? |
|---|---|---|---|
| Storefront render (home…tracking) | theme/render | **Liquid** | YES (L4-L13) |
| Cart (page + state + handoff mint) | storefront + cart-routes | Liquid view over `cart-routes.ts` | YES (L8) — render only |
| Checkout origin (contact→pay→confirm) | money/checkout | separate runtime | **NO** |
| Order-create / payment capture | money domain | api-gateway + Razorpay | **NO** |
| Canonical ledger | money domain | api-gateway | **NO** |

## Validation rules

- A validator/contract MUST assert the Liquid cart hands off via the signed `/cart/:token/checkout-url` and never computes or trusts client-side totals (server re-pricing only). The L14 parity matrix's **checkout-handoff dimension** is the proof.
- No Liquid template, section, or island may embed a payment form, capture card data, or post to a payment provider directly. Any such fragment is forbidden by `ThemeLiquidSourceSchema` (no `<script>`, no `javascript:`) and must be a parity red cell.
- The `CHECKOUT_ORIGIN` env contract must remain a separate origin (cloudflare-topology/environment validators).

## Deletion rules

- `checkout/checkout-client.tsx`, `checkout/page.tsx`, `checkout/success`, `checkout/paypal-return`, and `/api/orders`/`/api/payments/*` proxies are **KEEP-PERMANENT**. L17 MUST NOT delete them.
- Deleting or rewriting the checkout origin is **out of scope** and **forbidden** for the Liquid program.

## Allowed vs Forbidden (explicit)

- ✅ **Allowed:** Liquid storefront → cart (Liquid) → **signed checkout handoff** → `checkout.letbuyy.com` (unchanged).
- ⛔ **Forbidden:** Rewriting, porting, or absorbing checkout into the Liquid migration; rendering checkout via Liquid; deleting the checkout React origin during React storefront removal; moving order-create/payment/ledger into the render layer.

## Constitutional anchor

§234 (hosted checkout origin + signed handoff), ART-17 (React deleted-or-frozen at hardening wave — render layer only), R-15 (one canonical renderer — applies to the *storefront* renderer, not checkout). This decision is consistent with all three and is hereby frozen for the Liquid Completion Era.
