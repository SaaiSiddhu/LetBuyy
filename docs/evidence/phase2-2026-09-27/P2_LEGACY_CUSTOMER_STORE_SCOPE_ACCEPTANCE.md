# Phase 2 — legacy customer reset destination and storefront-session scope

Date: 4 October 2026 (Asia/Kolkata)

## Findings and changes

The public Gateway password-reset request accepted `reset_url` from its JSON body and placed the
one-time reset token in that URL before sending the email. The Gateway now resolves a requested
URL's host through the canonical storefront host resolver and accepts it only when the resolved
site ID matches the target customer's `store_id`. Unknown hosts, another store's host, remote HTTP,
URLs with userinfo or fragments, and malformed URLs fall back to the configured reset destination.
HTTPS is required outside `.localhost` development.

The Commerce legacy customer session helper previously verified a signed cookie but did not compare
its signed `storeId` with the storefront serving the current request. Session issuance and every
subsequent `getSession()` read now resolve the request's forwarded storefront host and require the
resolved site ID to match the session's store ID. Resolver errors and unknown hosts fail closed.

## Verification

| Check | Result |
|---|---|
| Gateway reset-URL policy tests | 4/4 passed: same-store HTTPS, wrong-store fallback, malformed/insecure/credential/fragment rejection, and local HTTP exception |
| Commerce buyer-session/origin/checkout focused tests | 13/13 passed, including same-store session acceptance and wrong-store/unresolved/resolver-failure denial |
| Commerce TypeScript check | Passed |
| Gateway TypeScript check | Passed |
| `git diff --check` | Passed |
| Gateway customer-engagement security suite | Not executed: the test runner could not create its required Unix-domain socket in this sandbox (`listen EPERM`); no assertion result is claimed |

## Limits

This proves local helper behavior and type integration. No real reset email, browser cookie, live
storefront resolver, owned-database route execution, hosted origin or deployed session was exercised.
No password or session was migrated or revoked in a hosted environment. Phase 2 and the eleven-phase
goal remain open.

## 4 October correction — legacy login CSRF

The transitional `/api/customer/login` route also supports plain HTML form submissions, so a
cross-origin page could attempt login-CSRF and install a store-customer session in the visitor's
browser. The route now checks the exact request origin and Fetch Metadata before parsing either
form or JSON bodies or calling the Gateway. Cross-site, sibling-store same-site and same-host
scheme-mismatch requests are denied with a no-store 403 and no cookie. Route and shared-flow tests
pass 5/5; Commerce typecheck and `git diff --check` pass. No real-browser probe was run.

## 4 October correction — complete the transitional password-reset path

The store-customer settings form previously asked for a current and new password but called the
reset-confirmation endpoint without its required email, store ID or one-time token, so the visible
action could never succeed. It now requests a reset link using the signed-in store customer's email
and store ID. A new store-specific reset page accepts the Gateway email's `email`, `token` and
`store_id` query values, derives tenant authority from the resolved storefront route, refuses a
conflicting store marker, removes the bearer token from browser history after capture, and submits
the new password to the same-origin BFF. Completion creates the existing transitional store-customer
session; it does not link or claim a canonical buyer account.

The BFF now rejects cross-origin requests before parsing bodies, resolves the current storefront
from the forwarded host, and requires the caller's store ID to match for both reset initiation and
confirmation. It also checks the returned customer belongs to that resolved store, bounds passwords
to 8–128 characters, avoids logging token-bearing request/provider errors, and marks all responses
`no-store`. Reset-link requests remain generic in the UI because Gateway acceptance does not prove
that an email provider is configured or that delivery occurred.

| Check | Result |
|---|---|
| Password-reset BFF tests | 2/2 passed: cross-origin/sibling-store posts are rejected before lookup; unknown host/store resolution is denied |
| Commerce TypeScript check | Passed |
| Focused ESLint | Passed for the new API route, test and reset page |
| `git diff --check` | Passed |

No real reset email, browser journey, provider delivery, database redemption or hosted storefront was
exercised. The new local path is implemented and typed; live delivery and existing one-time-token
Gateway behavior remain separately unverified. Phase 2 and the eleven-phase goal remain open.

## 4 October correction — bind legacy login to the current storefront before authentication

The login BFF checked the submitted `storeId` only after calling Gateway password verification:
Commerce session creation later rejected a different-store profile, but the upstream login attempt
and its login telemetry had already happened. The BFF now resolves the current forwarded host and
refuses missing, unresolved, resolver-failure or mismatched store IDs before calling the password
endpoint. JSON callers receive a generic no-store 403; Liquid form callers return to sign-in with a
generic failure state. Cross-origin requests are still rejected even earlier.

| Check | Result |
|---|---|
| Login and store-scope focused tests | 5/5 passed: CSRF denial, same-store resolver positive control, host/store mismatch before Gateway call, unresolved/resolver-failure refusal, and scheme mismatch |
| Commerce TypeScript check | Passed |
| Focused ESLint | Passed |
| `git diff --check` | Passed |

No live Gateway login, browser, account, or hosted tenant resolver was exercised. The test's
positive control covers the shared host-to-store resolver predicate; the mismatched route test
proves that the password endpoint is not called. Existing store-only login and symmetric issuers
remain transitional.

## 4 October correction — make reset-token consumption atomic

The reset-confirmation route previously selected a live reset credential, then
issued two separate REST writes: one changed the customer's password and the
other consumed the credential. Two concurrent confirmations could both pass
the initial lookup and each report success. An owned-Postgres regression test
barrier synchronized two real-worker requests at the credential read and
reproduced two successful confirmations against the old implementation (red
run `0ac0c98ebf7e`).

Migration 269 adds `confirm_customer_password_reset`, a service-role-only
Postgres function with a fixed `search_path`. It locks the one-time credential
and active, non-deleted customer, updates the password and consumes the token
in the same transaction, and returns only the customer fields needed to issue
the existing transitional session. A paired rollback is recorded. The Gateway
now hashes the presented token and new password before invoking this function;
losing or invalid submissions receive the generic invalid-token response and
cannot issue another session. Reset initiation also excludes soft-deleted
customers. No migration was applied outside disposable owned test databases.

| Check | Result |
|---|---|
| Focused real-worker owned-Postgres reset suite | 3/3 passed, including concurrent single-winner consumption, injected second-write failure with full rollback and successful same-token retry, and service-role-only execute privileges; run `e37d0b917b46` |
| Full disposable owned-Postgres lane | 132/132 passed across 22 suites, zero failures/skips/TODOs; run `117976696129` (before the focused suite gained its third privilege assertion) |
| Gateway unit suite | 1,357 passed, zero failed, one existing `LB-BIL-002` TODO |
| API Gateway typecheck | Passed |
| Migration safety validation | `pnpm run validate:migrations` passed |
| Root shared contracts | `pnpm run test:contracts` passed 322/322 |
| `git diff --check` | Passed after evidence update |

This supersedes the earlier statement above that database redemption remained
unverified: the reset-confirmation worker path now has owned-database evidence.
It does not establish real email delivery, browser completion, provider
delivery, hosted behavior, or retirement of the legacy session issuer. Phase 2
and the eleven-phase goal remain open.

## 4 October continuation — malformed session-cookie handling and local consumer census

A source census traced Gateway session verification to the mounted required-session
routes (wishlist, orders, activity, profile and addresses), optional review identity,
and the Storefront GraphQL customer/order fields. Commerce reads the same host-only
cookie on the server and forwards it to Gateway; its legacy shopper session helper
checks the token's store against the resolved storefront. The Gateway currently
accepts both its newer HS256 session format and the transitional Commerce shopper
format under the customer-session secret. The deployed use of either format remains
unknown, so neither verifier is retired.

The census exposed a malformed-cookie edge: `decodeURIComponent` threw on an invalid
percent escape, turning an unauthenticated request into HTTP 500 before normal token
verification. The failure reproduced in the Gateway middleware test (4 pass, 1 fail;
malformed cookie returned 500 instead of 401). Cookie parsing now treats malformed
encoding as an absent credential, allowing fail-closed verification and permitting a
valid explicit `X-LetBuyy-Customer-Session` header to be considered. An owned-worker
regression was also added, but its runner could not execute because `docker info`
reported that no real Docker daemon answers; no owned-worker result is claimed.

| Check | Result |
|---|---|
| Gateway session middleware regression | 5/5 passed: both token formats, telemetry failure behavior, malformed-cookie 401 and valid-header positive control |
| API Gateway typecheck | Passed |
| Owned-worker customer profile suite | Not executed: runner preflight found no answering Docker daemon; no database assertion result claimed |
| `git diff --check` | Passed |

The malformed cookie no longer raises a parsing exception in the focused middleware
path. Re-run the existing owned-worker route suite when the owned Docker lane is
available. This is local application-level evidence only; browser, hosted telemetry,
provider and deployed session behavior remain unverified.
