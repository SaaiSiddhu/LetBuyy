# Legacy store-customer address default atomicity — 5 October 2026

Working checkout: `LetBuyy-phase2`, branch `letbuyy/phase2-shared-buyer-identity`,
HEAD `0862687a`. This is a Phase 2 compatibility-path correction; the canonical
cross-store `buyer_addresses` table and migration 266 remain separate and
unchanged.

## Change

The legacy signed store-customer `/customer/addresses` routes previously cleared
all defaults in one PostgREST request and then inserted or updated the chosen
address in another. An insert/update error or an address ID owned by another
customer could therefore leave the caller with no default. Concurrent creates
could set more than one. The merchant `/customers/:email/addresses` create and
update API had the same split-write pattern.

Migration 286 adds the backend-only `mutate_store_customer_address` function.
It serializes supported mutations by normalized `(store_id, customer_email)`,
rechecks and locks the active `store_customers` row for signed-session calls,
checks the update target inside the transaction, allowlists writable address
fields, and commits the default switch and address insert/update together. The
legacy storefront session route and merchant customer API now call that writer.
The previous default is unchanged when a target is foreign, the session account
is disabled between route lookup and mutation, or the row write fails. A paired
rollback removes the function. No existing rows were edited and no
duplicate-default cleanup or hosted migration was attempted.

## Verification and limits

- API Gateway TypeScript check: passed.
- Focused Gateway buyer-address, buyer-profile, session-compatibility and
  tenant-isolation contracts: 27/27 passed.
- Migration replay-safety tests: 4/4 passed; migration-safety validator passed.
- Commerce web UI contract test: passed; legacy delete failures retain the
  address card and display the server error, while canonical buyer saves use
  the buyer address API and leave the form open with the failure visible.
- Commerce web full test suite: 947/947 passed, including the new address UI
  contract test.
- `git diff --check`: passed.
- Added an owned Gateway/Postgres suite with failure-preservation, foreign-row
  denial, active-account recheck, synchronized concurrent-create, backend-only
  grant and rollback/reapply parity cases. The runner started no database tests
  (0 executed): `docker info` reports no real Docker daemon.

The owned real-worker/database behavior, rollback/reapply parity and normal
legacy-account browser journey remain unverified; the JSDOM UI contract test
is not a live-browser or database-backed journey. The existing merchant merge
operation still moves address email values in a broader multi-record workflow;
its duplicate-default policy needs a separate review before claiming a
table-wide one-default invariant. No production or hosted database changed.

Phase 2 and the eleven-phase goal remain active.

## 5 October correction — owned-worker acceptance and runner name repair

The first elevated owned-suite attempt uncovered a shared runner defect: the
suite runner generated a valid PostgreSQL database name with a suffix longer
than the ownership guard's hard-coded maximum, so the guard rejected the
runner's own database before executing tests. The runner and guard now share
one name contract, preserve the distinctive suite-name tail, and fit the full
identifier within PostgreSQL's 63-character limit. The existing
`synthetic-tenant` helper also limits tenant tags to 20 characters; this suite
now uses `addr-atomicity`.

| Check | Result |
|---|---|
| Owned-fixture guard regression | 14/14 passed, including the long database-name case and fail-closed controls |
| Owned Gateway/Postgres address suite | 5/5 passed; `storefront-customer-address-atomicity.postgres.test.ts`; owned run `33e0d03fe5fa`; [sanitized runner report](P2_LEGACY_STORE_CUSTOMER_ADDRESS_OWNED_DATABASE_RUN.json) |
| Cleanup | Database and REST sidecar removed; zero cleanup failures; no remaining labelled containers, networks or volumes |
| API Gateway TypeScript | Passed |
| Migration safety validator and `git diff --check` | Passed |

The earlier zero-test Docker preflight note above is superseded for this suite.
The owned run used only the repository's labelled disposable cluster. It did
not apply the migration to restored or hosted data. The normal UI is covered
by the Commerce JSDOM regression and 947/947 Commerce test suite recorded
above; that is not a real-browser address journey. The merchant customer-merge
workflow remains outside this writer's atomicity guarantee.

Next F2.1 transition work is to stop Commerce issuing the second, legacy
HS256 storefront session and carry the Gateway-issued session through the
first-party BFF. That changes the current storefront session duration from
Commerce's seven days to Gateway's thirty minutes unless Gateway is explicitly
configured otherwise. The duration choice has been asked of the owner; no
session behavior changes until it is answered. Preserve both formats and the
dual verifier meanwhile.

## 5 October correction — normal legacy address form verified in Chromium

The earlier database acceptance did not cover the account form. Chromium found
that GET requests worked but a normal same-origin POST was rejected by the
Gateway CSRF middleware: the server-side BFF forwarded the signed customer
session but did not attach the server-origin signature required for its
Gateway request. The address BFF now checks the trusted same-origin request
context for POST/PUT/DELETE, and the base Gateway address endpoint plus its
UUID-only mutation route are included in the Commerce server-signing allowlist.
Cross-site writes receive 403 before
the Gateway; browser requests still require the legacy store-customer session,
and the Gateway continues enforcing its CSRF boundary for direct unsigned
writes.

The normal `/store/[subdomain]/account/addresses` page was exercised after a
real local password-reset redemption issued the synthetic legacy session. The
browser rejected attacker-origin POST, PUT and DELETE requests, then submitted
and edited the address through the same-origin Next BFF, real Gateway worker
and owned Postgres, selected “Set as default address,” and read the saved
address back. SQL readback checked the customer/store binding, full name,
updated street, city, state, PIN code and default flag. The owned
`storefront-customer-profile.postgres` suite passes **12/12** with no failures,
skips, cancellations or TODOs (run `833f57d8788e`); the
[sanitized runner report](P2_LEGACY_ADDRESS_FORM_BROWSER_OWNED_RUN_2026-10-05.json)
confirms ownership verification and complete cleanup. The focused origin and
exact signing-path tests pass **11/11**. The already-locked Identity
`tailwindcss@4.1.18` package required a temporary local link for this worktree;
the link was verified, used for the run, and removed without changing manifests
or lockfiles.

The runner recorded 1,836 REST-proxy forwards, zero refused requests and two
upstream connection errors; its report preserves those counts. Gateway logs
show the address list/create/update requests returned 200/201/200, and the
suite's only logged application 500 is the separately asserted trigger-injected
buyer-support rollback control.

This is local browser/Gateway/Postgres acceptance using synthetic accounts. It
does not verify a hosted domain or production migration. The broader merchant
customer-merge workflow remains outside migration 286's address mutation
transaction and still needs separate review before claiming a table-wide
one-default invariant. Phase 2 and the eleven-phase goal remain active.
