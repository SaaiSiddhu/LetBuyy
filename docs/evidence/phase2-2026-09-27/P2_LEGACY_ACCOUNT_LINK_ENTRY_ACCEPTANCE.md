# P2 — legacy account connection from storefront sign-in

Date: 4 October 2026 (Asia/Kolkata)  
Checkout: `LetBuyy-phase2`, branch `letbuyy/phase2-shared-buyer-identity`  
Scope: make the existing verified LetBuyy/store-customer relationship flow reachable to a customer who has not yet created a legacy store session.

## Finding and change

Before this change, the explicit “Connect this store account” action was available in Account Settings only after the customer had already authenticated with the store-specific password session. A legacy customer who reached the sign-in page could choose LetBuyy sign-in, but could not request the connection operation from that entry point.

The shared Liquid customer-login section now presents a separate same-origin POST to `/api/buyer-auth/start`, sets `intent=link_store_customer`, and returns to that store's account page. The existing PKCE flow and callback perform the actual link: the canonical buyer session must be verified for the current host/site and the existing relationship operation requires the same verified email. The browser cannot submit either buyer or store-customer IDs. The old password form remains available as a transition bridge; this change does not retire its issuer.

The HTML sanitizer removes the `name="action"` field from rendered Liquid markup to prevent DOM clobbering. The new form uses the non-clobbering `intent` field, and the BFF accepts that field alongside `action` for compatibility with existing React/account callers. Testing rendered output first caught this integration issue; the form now survives sanitization with its field and store-specific return path.

## Verification

| Check | Result |
|---|---|
| Liquid sign-in render and example-drift tests | 14/14 passed, including the rendered sanitized link form and both regenerated example packages |
| Buyer-auth start/callback tests | 3/3 passed: same-origin requirement, compatibility `action`, sanitizer-safe `intent`, state and callback link contract |
| Storefront SSR contracts | 14/14 passed |
| Full Theme Engine suite | 1,874/1,874 passed across 57 suites |
| Theme-engine TypeScript | Passed |
| Commerce web TypeScript | Passed |
| Focused ESLint for buyer-auth start route/test | Passed |
| `git diff --check` | Passed |

## Limits

No real browser, email verification delivery, identity provider, live store relationship database, custom-domain session, hosted Gateway or deployment was exercised. Existing callback coverage uses controlled provider/Gateway responses; it proves local wiring, not a real PKCE sign-in. No automatic email match or historical-order claim was added. Phase 2 and the eleven-phase goal remain active.

## 4 October continuation — React storefront login surface

The dedicated `/customers/login` route now renders a customer-auth surface when the storefront
uses the React engine, which has no registered customer-login section renderer. It keeps the
store-scoped password API and Turnstile widget, adds a generic password-reset request, and exposes
both canonical LetBuyy sign-in and the explicit same-origin `intent=link_store_customer` flow. The
Liquid engine continues to render its theme-provided login section. The route is force-dynamic so
query feedback cannot be served from a shared page cache.

Commerce web TypeScript passes. Focused ESLint for the page and component passes. Buyer-auth start,
legacy login host/CSRF, and password-reset BFF tests pass 7/7 using Node's TSX import loader. A
first direct TSX CLI attempt could not create its IPC Unix socket in the sandbox; using
`node --import tsx` ran the same focused tests successfully. `git diff --check` passes. Browser
rendering and real identity-provider or reset-email journeys remain unverified.

## 4 October continuation — clear the linked browser's legacy session

After the callback receives a successful response from the existing verified-email buyer/store
link transaction, it now expires the host-only `lb_customer_session` cookie in that browser. This
avoids continuing to send both the transitional store-customer identity and the canonical buyer
identity on later requests from the linked browser. An unverified, conflicting, failed, or
unavailable link does not clear the store session; ordinary LetBuyy sign-in does not clear it
either. The change does not revoke stateless legacy cookies in other browsers/devices; those remain
accepted until their existing expiry, so deployed-use observation and server-side revocation remain
unresolved.

| Check | Result |
|---|---|
| Buyer-auth callback/start/logout tests | 7/7 passed; success clears the legacy cookie and conflict preserves it |
| Commerce web TypeScript | Passed |
| Focused callback ESLint | Passed |
| `git diff --check` | Passed |

The local storefront was not running on port 9000 and the local Supabase port was not listening, so
no browser or database journey was claimed. The callback regression tests use controlled provider
and Gateway responses; they prove response-cookie behavior, not a deployed identity flow.

## 4 October continuation — verified existing-account link through the real worker

The buyer/store relationship route now has owned-Postgres production-worker coverage in
`storefront-buyer-link.postgres.test.ts`. This closes the earlier gap between fake route dependency
tests and direct SQL-function tests. The production route receives a cryptographically signed,
site-bound storefront-buyer session, derives the buyer from the token, calls the real migration-255
link RPC, and reads the resulting relationship and audit row from the isolated database.

| Journey | Result |
|---|---|
| Verified buyer upgrades the matching legacy-unverified relationship | **200**; the same edge becomes `verified_email`, an audit row is recorded, and no order link is created. |
| Repeated verified link | **200**; one relationship remains. |
| Unverified buyer | **403 EMAIL_UNVERIFIED**; no store-customer or link row is created, and the refusal is audited. |
| Record already linked to another buyer | **409 LINK_CONFLICT**; existing owner remains unchanged and its ID is not disclosed. |
| Storefront session names a sibling store in query or body | **401**; no customer or link row is created. |
| Two first-time link requests reach the real RPC together | Both succeed and converge to one store-customer row, one verified link, and one success audit. |

The owned suite passes **5/5**, and the existing route-level buyer-link unit suite passes **21/21**;
Gateway typecheck and `git diff --check` pass. This proves the worker, service-role database
transaction, tenant/session guards, conflict behavior and concurrent linking in the local owned
lane. The signed buyer credential is generated by the test harness, and the email state is seeded;
no actual identity-platform sign-in, verification email, storefront browser, hosted database or
deployment is claimed. Linking a store relationship remains separate from historical-order claims.
The canonical PKCE callback's real-provider journey and hosted account recovery remain open.

## 4 October follow-up — real Identity callback harness added, pending owned run

The Next runtime integration harness now contains a conditional path through the actual Identity
authorization and token routes and Commerce callback, followed by the existing Gateway link and
session-read routes. Its initial buyer session is seeded from the disposable identity key; therefore
the intended evidence covers PKCE, the real token issuer and the verified link boundary, but not
buyer credential/OTP entry. The package and component suites pass, while the separate combined
owned-database test could not provision because this Mac session had no answering Docker daemon.
The identity-to-link route path is not accepted as end-to-end until that suite runs successfully.

The app-to-app segment has since been executed independently: real Commerce and Identity Next.js
routes completed PKCE authorization, one-time token redemption, ES256 storefront session issuance,
successful callback cookie switch, canonical buyer session read, sibling-store refusal and replay
refusal (**10/10 smoke checks**). The Gateway behind this run was an explicitly controlled HTTP
double, so the database relationship/audit/concurrency acceptance above remains separate and the
combined actual-worker journey is still pending the unavailable owned Docker runtime. See the
[session transition record](P2_CUSTOMER_SESSION_RETIREMENT.md) for exact boundaries.
