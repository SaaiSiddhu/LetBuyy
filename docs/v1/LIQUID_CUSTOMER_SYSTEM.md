# Liquid Customer System (V2) — Phases 2 & 8

**Type:** Research / design — no implementation. **Date:** 2026-06-16.
**Grounding:** real columns from `database/supabase/migrations/000_baseline.sql`; gateway contract from the storefront client surface; Shopify model from its documented Liquid `customer`/`address` objects (labelled).
Parent: [LIQUID_COMMERCE_ARCHITECTURE.md](LIQUID_COMMERCE_ARCHITECTURE.md).

---

## 1. Shopify customer architecture (reference)

Shopify exposes the logged-in shopper as the Liquid `customer` object, populated only on customer-account pages and `customer.*` routes:
- `customer`: `id, email, first_name, last_name, name, phone, accepts_marketing, tags, orders_count, total_spent, has_account, addresses[], addresses_count, default_address, last_order`.
- `address` (customer address): `id, first_name, last_name, name, company, address1, address2, city, province, province_code, zip, country, country_code, phone, default`.
- Auth: hosted `/account/login`, `/account/register`, `/account/reset` (new customer accounts are a hosted, non-Liquid surface; classic accounts use `customer_login_link`/forms posting to `/account`).
- Wishlist: **not native** in Shopify — implemented by apps via metafields/local storage.

**Takeaway:** Shopify keeps auth on a hosted surface and exposes a read-mostly `customer` drop to Liquid. LetBuyy can mirror this: hosted/island auth + a real `customer` drop.

---

## 2. LetBuyy customer — what exists / missing / React-only

### Backend (EXISTS — full CRUD via gateway)
| Capability | Gateway method | Source |
|---|---|---|
| Find/create (guest) | `findOrCreateCustomer` | `customer-service.ts:46` |
| Login (+ Turnstile) | `verifyCustomerPassword` | `customer-service.ts:148` |
| Status / by-email | `customerStatus`, `customerByEmail` | `:72-93` |
| Password reset | `requestCustomerPasswordReset`, `confirmCustomerPasswordReset` | `:99-129` |
| Profile update | `updateCustomerProfile` | client surface |
| Addresses CRUD | `customerAddresses`, `create/update/removeCustomerAddress` | `:` + client surface |
| Wishlist | `customerWishlist`, `add/remove/syncCustomerWishlist` | `:169-224` |
| Orders | `customerOrders` | `:230` |
| Session | customer HS256 cookie (`LETBUYY_CUSTOMER_SESSION_COOKIE`) | `api/client.ts:46-52` |

### Data (EXISTS — real tables)
- `store_customers` (`:12186`): `id, store_id, email, password_hash, full_name, phone, status(active|disabled|guest), total_orders, total_spent, addresses jsonb, tags[], notes, accepts_marketing, last_order_at, last_login_at, login_count`.
- `customer_addresses` (`:8869`): `id, store_id, customer_email, customer_phone, label(home|work|other), full_name, address_line1, address_line2, city, state, postal_code, country, landmark, is_default, gstin, state_code`.
- `customer_credentials` (source of truth for password — migration 111), `customer_sessions`.
- `customer_wishlists` (`:8914`): `id, customer_id, store_id, product_id, variant_id`.

### Liquid (MISSING)
- `customer: null` is **hardcoded** in the Liquid drop (`composition-engine.tsx:337`).
- No Liquid account/auth/wishlist sections; account routes are React (`account/{settings,addresses,orders,wishlist}/page.tsx`).
- Customer interactivity lives in React contexts (`customer-auth-context.tsx`, `wishlist-context.tsx`).

**Verdict:** backend + data are complete; **the entire customer surface is React-only at the presentation layer, and Liquid receives no customer data.**

---

## 3. Designed Liquid `customer` drop (India-aware, Shopify-aligned)

Built from `store_customers` + `customer_addresses` + `customer_wishlists` + `customerOrders`. Populated only on `customer`-authenticated routes (session cookie present); `null` for guests (as today).

```liquid
customer = {
  id,
  email,
  name,                 // store_customers.full_name
  phone,                // store_customers.phone
  accepts_marketing,    // store_customers.accepts_marketing
  tags: [...],          // store_customers.tags[]
  orders_count,         // store_customers.total_orders
  total_spent,          // store_customers.total_spent (minor-safe formatting via money filter)
  has_account,          // derived: customer_credentials present / has_password
  status,               // active|disabled|guest
  last_order_at,
  addresses: [ address ],          // from customer_addresses (store_id+customer_email)
  addresses_count,
  default_address: address,        // is_default = true
  orders: [ order_summary ],       // from customerOrders (see LIQUID_THEME_COMPLETION order model)
  wishlist: [ { product_id, variant_id } ]   // from customer_wishlists
}

address = {
  id,
  label,                // home|work|other
  name,                 // full_name
  address1,             // address_line1
  address2,             // address_line2
  city,
  province,             // state
  province_code,        // state_code (GST state code)
  zip,                  // postal_code
  country,              // country (default 'IN')
  country_code,
  phone,                // customer_phone
  landmark,             // India-specific
  gstin,                // India GST (B2B invoicing)
  is_default
}
```

**India deltas vs Shopify (intentional):** single `name` (not first/last), `zip`←`postal_code`/pincode, `province_code`←`state_code` (GST), plus `landmark` and `gstin`. These are required for GST invoicing and Indian addressing and must not be dropped.

---

## 4. Wishlist (Phase 8) — design

**Exists:** `customer_wishlists` table (customer-aware, `:8914`) + gateway `customerWishlist`/`add`/`remove`/`syncCustomerWishlist` (`customer-service.ts:169-224`) + React `wishlist-context.tsx` (local + sync). **Missing:** Liquid wishlist section + island + drop.

**Design:**
- Drop: `customer.wishlist` (above) + per-product `product.in_wishlist` (boolean, when customer present).
- Island: `lb-wishlist-toggle` custom element (same pattern as `lb-add-to-cart` in `liquid-hydration-islands.tsx:223`): optimistic local toggle (`wishlists`/local) + server sync to `addCustomerWishlistItem`/`removeCustomerWishlistItem` when authenticated; merges local→server on login (`syncCustomerWishlist`).
- Section: `wishlist` Liquid section rendering `customer.wishlist` product cards (reuse the `product-grid` card markup).
- Guest behavior: local-only wishlist (matches current React `wishlist-context` + Shopify app pattern), promoted to server on login.

---

## 5. Auth surface design (security-preserving)

Mirror Shopify: keep auth as a **controlled island**, not raw Liquid forms, to preserve Turnstile + rate-limit + the two-issuer HS256 customer session.
- `lb-customer-auth` island wrapping login/register/reset, posting to the existing gateway endpoints (`verifyCustomerPassword` with `turnstile_token`, `findOrCreateCustomer`, `request/confirmCustomerPasswordReset`).
- Session stays the HS256 customer cookie (`LETBUYY_CUSTOMER_SESSION_COOKIE`) set server-side; Liquid never sees the token, only the resolved `customer` drop.
- Account pages (`/account`, `/account/addresses`, `/account/orders`, `/account/wishlist`) become Liquid templates wired through the composition engine with `customer` populated server-side.

---

## 6. Build checklist (customer + wishlist)

| Item | Type | Depends on |
|---|---|---|
| `customer` drop builder (server-side, from session) | drop | session resolve in composition engine |
| `address` mapping (GST-aware) | drop | `customer_addresses` |
| `customer.orders` summary | drop | order model (see theme-completion doc) |
| `customer.wishlist` | drop | `customer_wishlists` |
| `product.in_wishlist` | drop | wishlist + product context |
| `lb-customer-auth` island | island | existing gateway auth endpoints |
| `lb-wishlist-toggle` island | island | wishlist endpoints |
| `account`, `account/addresses`, `account/orders`, `account/wishlist` Liquid templates + route wiring | template+route | composition engine route extension |
| Address form island (create/update/remove, GST validation) | island | address endpoints |

**No backend build required** — every endpoint and table already exists. This phase is drops + islands + route-wiring only.
