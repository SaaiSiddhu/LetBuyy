# Customers Audit

**Date:** 2026-06-19  
**LCIS Domains:** `authentication` (10 tables, 2 RPCs), `identity` (8 tables, 1 RPC)  
**Evidence:** `services/api-gateway/src/routes/customers.ts` (1,487 lines), `apps/storefront-runtime/src/app/api/customer/`, `apps/storefront-runtime/src/components/account/account-bottom-sheet.tsx`

---

## Completion Score: **78%**

*Dragged down by LB-12 (broken registration) and missing password reset.*

---

## Sub-System Audit

### Registration
**Score: 45%** ← **CRITICAL BLOCKER (LB-12)**

**What exists:**
- `findOrCreateCustomer` backend function: `apps/storefront-runtime/src/app/api/customer/auto-create/route.ts:17`
- `customer_credentials` table with proper schema
- Email verification infrastructure
- Backend registration logic is sound

**What is broken:**
- The "Create Account" button in `account-bottom-sheet.tsx:128` calls `setPassword()` with **no resetToken**
- `customer-auth-context.tsx:145-147` and `set-password/route.ts:35` both require a resetToken and reject requests without one
- Email-not-found dead-ends at line `account-bottom-sheet.tsx:372-413` — user is told "place an order, account auto-created" with no explicit register path
- Result: **a new customer cannot create an account from the storefront**

**What's needed (per LB-12 strategy):**
- Add explicit register branch reusing `findOrCreateCustomer`
- Fix resetToken mismatch
- ~1–2 dev-days

**Evidence:** `ACTUAL_STATE.md` — "LB-12: Shopper registration — Missing + a broken button"; `account-bottom-sheet.tsx:372-413`

---

### Login
**Score: 95%**

**What exists:**
- Email + password login: `apps/storefront-runtime/src/app/api/customer/login/route.ts`
- Session creation with HS256 JWT (`CUSTOMER_SESSION_SECRET`)
- Session cookie management
- Customer ↔ Merchant session separation (enforced)
- Turnstile bot protection on login form
- Rate limiting on login
- Customer session route: `apps/storefront-runtime/src/app/api/customer/session/route.ts`
- Check email: `apps/storefront-runtime/src/app/api/customer/check/route.ts`
- Logout: `apps/storefront-runtime/src/app/api/customer/logout/route.ts`

**Evidence:** `customers.ts:1487 lines`, authentication domain LCIS

---

### Accounts
**Score: 88%**

**What exists:**
- Account page: `apps/storefront-runtime/src/app/store/[subdomain]/account/page.tsx`
- Account chrome: `account-chrome-client.tsx`
- Account layout with navigation
- Profile viewing and updating: `apps/storefront-runtime/src/app/api/customer/profile/route.ts`
- Settings page: `account/settings/settings-client.tsx`

**Evidence:** Multiple account pages in storefront-runtime, profile API route

---

### Addresses
**Score: 90%**

**What exists:**
- Customer addresses: `apps/storefront-runtime/src/app/store/[subdomain]/account/addresses/page.tsx`
- Addresses client: `addresses-client.tsx`
- Address CRUD API: `apps/storefront-runtime/src/app/api/customer/addresses/route.ts`
- Default address selection
- Address used in checkout prefill

**Evidence:** `customer/addresses/route.ts`, `addresses-client.tsx`

---

### Wishlist
**Score: 88%**

**What exists:**
- `wishlists` + `customer_wishlists` tables
- Wishlist page: `apps/storefront-runtime/src/app/store/[subdomain]/account/wishlist/page.tsx`
- Wishlist client: `wishlist-client.tsx`
- Wishlist API: `apps/storefront-runtime/src/app/api/customer/wishlist/route.ts`
- Wishlist sync: `apps/storefront-runtime/src/app/api/customer/wishlist/sync/route.ts`

**Evidence:** `customer/wishlist/route.ts`, wishlist tables in storefront domain

---

### Orders (Customer View)
**Score: 90%**

**What exists:**
- Customer orders list: `apps/storefront-runtime/src/app/store/[subdomain]/account/orders/page.tsx`
- Customer order detail: `apps/storefront-runtime/src/app/store/[subdomain]/account/orders/[id]/page.tsx`
- Orders API: `apps/storefront-runtime/src/app/api/customer/orders/route.ts`
- Guest order lookup: `apps/storefront-runtime/src/app/store/[subdomain]/orders/page.tsx`
- Order status visible to customer
- Shipment tracking information (if tracking added to shipment)

**Evidence:** `customer/orders/route.ts`, account orders pages

---

### Settings
**Score: 85%**

**What exists:**
- Customer settings page: `account/settings/settings-client.tsx`
- Profile update (name, phone)
- Email change (may be limited due to credential binding)
- Notification preferences

**Evidence:** `settings-client.tsx`, `customer/profile/route.ts`

---

### Password Reset
**Score: 55%**

**What exists:**
- `auth_password_set_intents` table — token storage for password resets
- `set-password` route exists: `apps/storefront-runtime/src/app/api/customer/set-password/route.ts`
- "Forgot password" flow infrastructure in identity-platform
- `orders/set-password/route.ts` — post-order account creation path

**What is broken/missing:**
- The set-password route rejects requests without a valid resetToken (line 35)
- The registration flow never generates a resetToken to send to email
- Password reset email triggering path unverified end-to-end
- Dependency on LB-12 fix (registration and password reset share the same token flow)

**Evidence:** `set-password/route.ts:35`, `ACTUAL_STATE.md` LB-12 analysis

---

## Blockers

| # | Blocker | Severity | Impact |
|---|---|---|---|
| LB-12 | Shopper registration broken (dead button) | 🔴 Critical | Customers cannot create accounts from storefront |
| LB-10 | No account-related lifecycle emails | 🟠 Medium | No welcome email, order notifications partial |
| H7 | Turnstile live keys | Human seam | Login/registration fail closed in production |

---

## Launch Readiness

**Customers is NOT launch-ready due to LB-12.** A customer who tries to create an account hits a dead button. Auto-creation on order placement works, but explicit registration is broken.

**After LB-12 fix (~1–2 dev-days):** Customers would be 90%+ ready.

**Recommended V1.0.0 scope:** Login + fixed registration + addresses + wishlist + orders + settings.

**Delay to V1.1:** Social login, saved payment methods, loyalty/rewards, referral tracking.
