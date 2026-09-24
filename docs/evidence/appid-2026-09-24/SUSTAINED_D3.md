# SUSTAINED-D3 — marketplace cross-store buyer order visibility

Branch `letbuyy/sustained-d3-marketplace-order-visibility`, base `0dee2bd` (develop, includes
merged SUSTAINED-B/C). A bounded slice of the owner's SUSTAINED-D directive.

## What was missing

`buyer_order_links` (migration 255, APPID-P3) already records every order a buyer has proven
ownership of, across every store — `order_id, buyer_account_id, site_id, link_basis, linked_at` —
with an index (`buyer_order_links_buyer_idx (buyer_account_id, linked_at DESC)`) clearly built for
"list this buyer's orders, newest first". Grepping every route file for it found exactly two
consumers: `listBuyerReturnRequests` (returns, `buyer-realm-wiring.ts`) and the operator surface
(`routes/operations/buyer-links.ts`). No buyer-facing order-list route existed.

Checked, not assumed: `buyer_accounts` (migration 223) carries only `id, email, password_hash,
email_verified, status, created_at, updated_at` — no `full_name`/`phone`. No `buyer_addresses`
table exists anywhere in the schema. D1 (canonical profile fields) and D2 (a buyer address book)
both need a migration and are explicitly out of scope for this slice, which needed none.

## What this adds

`GET /buyer/orders`, marketplace realm, `requireBuyerSession`-gated. `listBuyerOrdersFromDatabase`
(`buyer-order-routes.ts`) is the ownership walk: verified session → `buyer_account_id` →
`buyer_order_links` → `orders` + `sites`, reading `orders`/`sites` only for ids the link table
already named for **this** buyer, each with its own explicit tenant-guard predicate (`orders`:
`site_id`; `sites`: `id`, in the guard's own allowlist for that table) — never trusted on `id`
alone, the same discipline APPID-FIX2 established. `buyer_order_links` is the **only** ownership
source: never `customer_email`, never `store_customers`, never a legacy-unverified link — which is
what the directive's D3 hazards (contact-string-only inference, unverified-link access) name, and
this route has no code path that could do either. Cursor pagination reuses the existing
`encodeListCursor`/`decodeListCursor`/`cursorPaginated` helpers `routes/orders.ts` already uses,
keyed on `linked_at`.

The route takes its query as an injected dependency (`registerBuyerOrderRoutes`), mirroring
`buyer-return-routes.ts`'s DI pattern exactly; production wiring supplies
`listBuyerOrdersFromDatabase` directly — the same function tests exercise is the one that runs
live, never a re-approximation.

Untouched, deliberately: the storefront's own per-store order history (`GET
/storefront/customer/orders`) — already correctly store-session-scoped, a different (legacy,
transitional per D-ONE-IDENTITY) model this slice does not touch.

## Proof

`services/api-gateway/src/__tests__/buyer-order-routes.test.ts`, two layers:

1. **The route**, through real signed buyer-session JWTs (the `buyer-return-routes.test.ts`
   harness): refuses without a session; the buyer id comes from the verified token, never a query
   parameter (tried explicitly); a merchant-realm token is refused; `limit` is bounded to 50,
   defaults to 20, an invalid value falls back to the default; the response carries
   `orders`/`next_cursor`/`has_more`, and a cursor round-trips to the exact `before` value the next
   call receives.
2. **The query**, through the real tenant-guarded client against a fake PostgREST (the
   `product-tenant-guard.test.ts` technique — a query the guard would refuse fails here exactly as
   it would live): a buyer linked at two different stores sees both orders, correctly attributed
   to each store's name; buyer B's order never appears in buyer A's list and vice versa (explicit
   two-way check); a buyer with zero links gets `[]` with **no** `orders`/`sites` read even
   attempted; every `orders`/`sites` read carries its own `site_id`/`id` predicate; a cursor page
   excludes the already-returned row and `hasMore` reflects reality; a negative control proves the
   guard itself refuses an unscoped `orders` read independent of this route's own logic.

**Real revert-and-watch**, not just a currently-passing suite: removed `.in('site_id', siteIds)`
from the orders read (the exact class of regression APPID-FIX2 fixed elsewhere) — 5 of the 6
query-layer tests failed immediately (the guard rejecting the now-unscoped `orders` query breaks
every downstream assertion); the 5 route-layer tests, which use injected fakes rather than the
real query, correctly kept passing, showing the failure was specific to the real implementation,
not a broken test harness. Restored; 11/11 pass again, diff clean.

## Validation run

- `npx tsc --noEmit -p services/api-gateway/tsconfig.json`: clean.
- `pnpm run test:unit:gateway`: **1082 tests, 1071 pass, 0 fail, 9 skipped, 2 todo** — +22 over the
  SUSTAINED-B/C tip (exactly this phase's 11+11 new tests), 0 regressions.
- `pnpm run test:contracts`: 319/319, unchanged.
- `node scripts/validate-governance.mjs --lane=gate --plan`: clean.
- `branch-dispositions-validator`: same single pre-existing, unrelated hard failure as every prior
  phase this session (`letbuyy/pay4-late-capture-after-release` not an ancestor in this shallow
  clone), nothing new.
- Not run standalone in this phase: repo-wide `pnpm run lint`/`pnpm run typecheck` (turbo) and the
  full gate — this phase's diff is two new/changed gateway files plus a test file, already covered
  precisely by the package-scoped `tsc` and `test:unit:gateway` runs above; SUSTAINED-B/C's own
  validation run already established the ambient baseline this phase does not touch.

## Not done (this slice's own explicit boundary)

D1 (canonical profile: needs `buyer_accounts` columns + a migration), D2 (address book: needs a
new table + RLS + a migration), D4 (account-page cache-header audit), D5 (client/mobile UI wiring
to this new endpoint), D6 (session lifecycle beyond what already existed — `/buyer/sessions/revoke`
predates this phase). Each is its own bounded piece of SUSTAINED-D, not started here.
