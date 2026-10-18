# Phase 2 — exact-origin buyer sign-out protection

Date: 4 October 2026 (Asia/Kolkata)

## Outcome

The shared buyer-session mutation guard now rejects requests whose Fetch Metadata identifies
cross-site or same-site traffic and compares any supplied `Origin` to the framework request's
exact origin, including scheme and port. A host match with an HTTP/HTTPS scheme mismatch no longer
passes. The guard is used by the buyer link-flow POST, buyer sign-out and mutating buyer-data BFFs.

Buyer logout now sets `Cache-Control: no-store` for rejected requests, JSON success, and form
redirect responses. It clears only the host-bound storefront buyer-session cookie after the
same-origin guard accepts the request. The account-session endpoint at identity-platform remains
separate and is not revoked by store-level logout.

## Verification

| Check | Result |
|---|---|
| Flow, buyer-link start, buyer-logout tests | 7/7 passed: same-origin acceptance, sibling same-site denial, scheme/port mismatch denial, cookie preserved on rejection, cookie cleared on accepted logout, no-store headers and safe form return |
| `pnpm --filter @letbuyy/customer-web typecheck` | Passed |
| `git diff --check` | Passed |

## Limits

This is local route/helper evidence. No browser CSRF probe, production proxy/header configuration,
hosted cookie behavior, or deployed request was exercised. Phase 2 identity retirement and other
staff/operator/privacy acceptance remain open.
