# 06 — Authentication and Identity Map

## 1. Every authentication system found

| # | Population | System | Provider / mechanism | Identity table | Login methods | Session | Roles / permissions | Evidence |
|---|---|---|---|---|---|---|---|---|
| A1 | Merchants and staff | S1 identity-platform | own issuer; ES256 or EdDSA private JWK (`LETBUYY_IDENTITY_PRIVATE_JWK`), JWKS published; `realm: 'merchant'` | `users_custom` (email, password_hash, auth_provider) | email + password, email OTP signup, magic link (flag), passkey (flag) | asymmetric JWT cookie; refresh via `refresh_tokens` (159); JTI sweeper | ownership via `sites.custom_user_id`; `employees.permissions.granted[]`; staff RBAC `dryrun` default | `apps/identity-platform/src/lib/auth/identity-issued-session.ts:16-61`, `services/api-gateway/src/lib/identity-session-verifier.ts` |
| A2 | Marketplace buyers | S1 identity-platform | same key, `realm: 'buyer'`, audience `BUYER_SESSION_AUDIENCE`, **no site claim** | `buyer_accounts` | email + password (Turnstile, rate limit) | asymmetric JWT | none beyond buyer | `identity-issued-session.ts:80-125`, `api/buyer/{register,login}` |
| A3 | Storefront customers (per store) | S1 gateway | **HS256** with `CUSTOMER_SESSION_SECRET` (verification key = forgery key; recorded deviation) | `store_customers` + `customer_credentials` | email + password per store | HS256 token | none | `middleware/customer-session.ts:56-61` |
| A4 | Platform operators | S1 `admin_web` | console magic link + TOTP; **production path refuses** (`magic_link_delivery_not_configured`) | allowed-email list (`PLATFORM_CONSOLE_ALLOWED_EMAILS`) | magic link | console session cookie (`PLATFORM_CONSOLE_SESSION_SECRET`) | all-or-nothing | `apps/admin_web/src/app/api/console-auth/login/route.ts:27-29` |
| A5 | Service-to-service | S1 | `INTERNAL_API_SECRET` (+ `_PREVIOUS`), IP allowlist, HMAC session headers (`@letbuyy/auth-core`), queue tenant envelope HMAC | — | — | — | — | `middleware/internal-perimeter.ts`, webhook-service |
| B1 | Marketplace customers (live) | S2 Firebase Auth | Firebase Auth (project `letbuy-y`) | Firestore `users` keyed by Firebase UID | email + password, Google sign-in, email OTP via callables (`sendEmailVerificationOTP`, `verifyEmailOTPAndLogin/Signup`) | Firebase ID token / refresh | client-side; rules by `request.auth.uid` | `packages/dart/marketplace_services/lib/src/auth_service.dart` |
| B2 | Sellers, admins (retired apps) | S2 Cloud Functions | seller OTP/password callables, admin OTP + TOTP | Firestore `sellers`, `admins` | OTP, password | Firebase | seller tiers, admin flags | `firebase_bridge/src/{sellerAuth,adminAuth,adminTOTP}.ts` |
| C1 | Customers, riders, store operators, sellers, admins | S3 Supabase Auth | phone/email OTP through Edge Functions (`auth-otp-request`, `auth-otp-verify`, `auth-refresh`); gateway verifies session, **parses `payload.user.id` incorrectly** | `app.profiles` (id = `auth.users.id`) + `app.user_roles` (role, scope_city_id, scope_store_id) | OTP | Supabase access/refresh | `app.user_role` enum: customer, rider, store_operator, seller, admin, super_admin | `workers/api-gateway/src/middleware/auth.ts:44-54`, `000002_identity_and_access.sql` |
| C2 | Service hop | S3 | Edge Functions trust `x-user-id` / `x-user-role` headers set by the gateway; no per-hop secret | — | — | — | — | `supabase/functions/_shared/worker_context.ts:9-20` |

## 2. Identity IDs in circulation

| ID space | Where it appears | Collision risk |
|---|---|---|
| `users_custom.id` (uuid) | `sites.custom_user_id`, `employees`, actor ids on inventory/orders | none internally |
| `buyer_accounts.id` (uuid) | `buyer_store_customers`, loyalty, notifications, returns, purchases (`p_buyer_account_id`) | none internally |
| `store_customers.id` (uuid, per site) | orders (by email), addresses, wishlists | same person appears once per store by design |
| Firebase UID (string) | Firestore `users/{uid}`, `orders.userId`, `addresses`, `wishlists`, `reviews`, `loyalty`, Storage paths `users/<uid>/…` | **must be mapped, never reused as a uuid**; no `firebase_uid` column exists in S1 today |
| Supabase `auth.users.id` (uuid, S3) | `app.profiles.id`, every S3 table | S3 has no live data known; mapping only if data exists |
| Google account subject | via Firebase Auth provider data | needed if Google sign-in is kept |

## 3. Canonical identity model (target)

One **LetBuyy Account** per human, issued by `apps/identity-platform`, with realms that express *which trust domain a session is for*, and memberships that express *what the person may do where*.

```text
identity_principal (one per human)
  ├── credentials: phone (+OTP), email (+password/OTP), Google (federated), passkey (flag)
  ├── legacy mappings: firebase_uid, supabase_auth_id (S3, if any), google_sub
  └── realm sessions (separate audiences, separate cookies/tokens, same asymmetric key)
        ├── buyer      → buyer_accounts (platform-wide; no tenant claim)   — exists
        ├── merchant   → users_custom → sites (tenant claim via ownership/membership) — exists
        ├── operator   → platform operator membership                       — NEW (replaces console magic link)
        └── workforce  → location/rider memberships (cashier, picker, custodian, rider, sales associate) — NEW

memberships (server-controlled, scoped)
  org_memberships(principal, org, role_ids)            — exists as DDL (159), to wire
  location_memberships(principal, fulfilment_node, capabilities) — NEW
  rider_profiles(principal, city/zone scope, status)   — NEW (ported from S3 logistics)
```

Rules the model must keep:

- A buyer token never carries a `site_id`; a buyer is not a tenant (already true, `identity-issued-session.ts:86-90`).
- A merchant session grants access to a site only through ownership or a membership row; a location id supplied by a client is never trusted (Agrimore ADR-0004 §5, adopted).
- Realm privileges never cross: buyer ≠ merchant ≠ operator ≠ workforce, even for the same principal. One person may hold several memberships without platform-wide authority.
- No shared symmetric secret across trust domains: the HS256 store-customer session (A3) collapses onto the buyer realm; the console magic link (A4) is replaced by an operator realm issued by identity-platform; S3's header-trust hop (C2) is not adopted.
- Phone number + OTP becomes the primary buyer credential (target shape in `decisions.md` §4); the SMS provider is a founder choice.

## 4. Identity mapping for migration

| Legacy identity | Canonical target | Mapping record | Method |
|---|---|---|---|
| Firebase customer UID | `buyer_accounts.id` (new uuid) | `identity_legacy_links(firebase_uid, buyer_account_id, verified_at, method)` — NEW table | import users with email + `email_verified`; password hashes from Firebase (scrypt with project parameters) can be imported via Firebase's hash export if the algorithm is honoured, otherwise force reset; Google-linked users re-link on first login |
| Firebase seller UID | `users_custom.id` | same table, `realm = 'merchant'` | sellers are re-contracted (0% fee decision); most are already S1 merchants or new |
| Per-store `store_customers` | linked to a `buyer_account` | `buyer_store_customers` (exists) | link on verified email match with consent prompt |
| S3 `auth.users.id` | `buyer_accounts` / workforce | `identity_legacy_links` | only if S3 ever held real users (unknown) |

ID collision policy: never write a Firebase UID into a uuid column; never reuse an S3 uuid as a S1 uuid without the link table; never merge two accounts on email alone without a verification step.

## 5. Per-app authentication after unification

| App | Realm | Notes |
|---|---|---|
| Unified customer app (renamed `customer_app`) and any marketplace web | buyer | phone OTP + email + Google; FCM token registered against the buyer principal |
| Storefronts (`customer_web`) | buyer (site-linked) | per-store login remains as a compatibility path until linked accounts are the default |
| `merchant_web`, `merchant_app` | merchant + workforce memberships | Store Ops and POS modes gated by location membership capabilities |
| Delivery partner app | workforce (rider) | separate app; rider profile and shift state |
| Operator console (mode or `admin_web`) | operator | MFA required; production-capable |
| Workers and functions | service | internal HMAC / secrets, never a user realm |

## 6. What exists, what is missing

| Capability | State |
|---|---|
| Asymmetric issuer, JWKS, merchant + buyer realms | exists (S1) |
| Turnstile + rate limiting on auth routes | exists (S1) |
| Refresh tokens, JTI replay sweeper | exists (S1) |
| Phone OTP | missing (S1 has email OTP only; S2 has none; S3 has Supabase OTP) |
| Google sign-in on the canonical issuer | missing (S2 has it via Firebase) |
| Operator realm usable in production | missing |
| Workforce / location memberships | missing (S3 role enum + DDL 159 are the starting points) |
| Legacy identity link table | missing |
| Step-up for refunds, payouts, bank changes with real cryptography | present in routes (`STEP_UP_SIGNING_SECRET`, `2fa`), not re-verified |
