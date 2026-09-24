# Product edit, delete and bulk action satisfy the tenant query guard (APPID-FIX2, 2026-09-24)

What APPID-FIX2 changed and proved, on branch `letbuyy/appid-fix2-product-tenant-guard` (base
`41af1cd9`, the verified `origin/develop` candidate F-HANDOFF-1 left). This is the "next bounded
task" `docs/evidence/appid-2026-09-24/CLOUD_HANDOFF.md` §8 named. Working environment: the Claude
Code Cloud container, not the Mac primary checkout `CLOUD_HANDOFF.md` was written from — there is no
Mac primary here, and the local `develop` ref was stale (`41212f67`) versus the verified
`origin/develop` candidate and was fast-forwarded to it (non-destructively) before this worktree was
cut. Docker and the Flutter SDK are not installed in this container; every claim below says so where
it applies. Nothing here is merged into `develop`, promoted, or deployed.

## What was wrong, measured on `develop` (`41af1cd9`)

`getOwnedProduct` (`services/api-gateway/src/execution/product-execution.adapter.ts`), used by both
`updateProduct` and `softDelete`, looked a product up by `.eq('id', productId)` alone — no
`site_id`/`store_id` predicate anywhere in the chain — then checked ownership on the row it got back.
The tenant query guard (`createTenantGuardedSupabaseClient`, `tenant/tenant-scoped.ts`) refuses **any**
query against a tenant-registered table (`products`: registered scope columns `site_id`, `store_id`)
that never references one of its own scope columns, so the lookup threw "Tenant table products
requires a tenant/owner predicate before execution" and `PATCH`/`DELETE /v1/products/:id` 500'd —
**even after** the staff-permission check (APPID-P5b's `ownedProductStoreId`, which already used the
correct scoped shape) had already resolved and cleared the product's real store. This is exactly the
gap `docs/evidence/appid-2026-09-24/P5B_STAFF_PATHS.md` "Found, not fixed here" recorded: P5b's own
PATCH/DELETE tests proved only that the staff check receives the product's store; they passed while
the adapter call after it failed.

Auditing every `.from('products')` call in the same file (not just the two CLOUD_HANDOFF.md §8
named) for the same defect class found three more, all reachable through the real `products` router:

1. `updateProduct`'s write (`.update(...).eq('id', productId)`) and its refresh-select
   (`.select().eq('id', productId)`), both unscoped, reached whenever `getOwnedProduct` had not
   already 500'd for another reason.
2. `softDelete`'s write, the same shape.
3. `refreshProductVariantJsonbCache`'s write (`.update({variants}).eq('id', productId)`), called
   unconditionally by `createProduct` after every product creation and by `updateProduct` whenever a
   variant update is present — meaning product **creation itself** hit the guard, not only edit and
   delete.
4. `bulkAction`'s ownership-check select (`.in('id', productIds)` alone) and the write that followed
   it (`.in('id', ownedProducts.map(...))` alone) — `POST /products/bulk`.

`ownedProductStoreId` (added by APPID-P5b for the staff check) already used the correct shape:
`.eq('id', productId).in('store_id', storeIds)`, resolving the caller's own store ids from `sites`
first. This phase generalises that one already-correct pattern to every other product-by-id lookup in
the file, via a shared `resolveOwnedStoreIds` helper, rather than inventing a second one.

## What it does now

- `getOwnedProduct` resolves the caller's own store ids first (`resolveOwnedStoreIds`, the same query
  `ownedProductStoreId` already used: `sites` filtered by `custom_user_id`/`user_id` ownership, and by
  `sessionStoreId` when the session names one), then selects the product by
  `.eq('id', productId).in('store_id', storeIds)`. A product id alone can no longer name a row outside
  the caller's own stores, and the query is scoped before it ever reaches the database, not merely
  checked afterward.
- `updateProduct`'s write and refresh-select, `softDelete`'s write, and
  `refreshProductVariantJsonbCache`'s write each add `.eq('store_id', ownedProduct.store_id)` (or
  `input.store_id` for `createProduct`'s call), the store already established by the caller
  `getOwnedProduct`/`createProduct` resolved.
- `bulkAction` resolves `ownedStoreIds` (the caller-declared `store_id` when the route supplies one, or
  every store the caller owns otherwise — the same `resolveOwnedStoreIds` helper) before its ownership
  select, and scopes both that select and its write by `.in('store_id', ownedStoreIds)`.
- The guard itself (`tenant/tenant-scoped.ts`) is unchanged. Every fix is an added predicate; none is a
  relaxed check.

## Proof

Through the real `products` router, the real `ProductExecutionAdapter` and the real tenant-guarded
client — a fake PostgREST on `globalThis.fetch`, the same harness `staff-paths-fail-closed.test.ts`
established, so a query the guard would refuse fails here exactly as it would live, and every filter
the gateway sends is applied to the in-memory rows as PostgREST would apply it
(`services/api-gateway/src/__tests__/product-tenant-guard.test.ts`):

1. **Success.** The owner of store A `PATCH`es product P of A: 200, the response and the underlying
   row both carry the new name. Deletes it: 200, `deleted: true`, the row carries `deleted_at` and
   `is_active: false`. Every write PostgREST received for the product carried a `store_id=` predicate.
2. **Cross-tenant denial.** The owner of store B sends the same `PATCH`/`DELETE` for A's product P:
   403 or 404 both times, P is byte-identical to before (deep-equal check on the in-memory row) after
   each attempt, and zero `PATCH` requests against `products` were ever sent for a caller who owns
   none of the named products.
3. **Bulk, the same two shapes.** `POST /products/bulk` with `{store_id: A, product_ids: [P1, P2]}` as
   A's owner: 200, `affected: 2`, both rows `is_active: false`, every write store-scoped. The same
   request from B naming P1 (A's): 403/404, A's products byte-identical, zero mutating requests.
4. **Negative control**, independent of the adapter: the exact pre-fix shape — `.eq('id', productId)`
   alone against `products`, through the real guarded client, no fake PostgREST involved since the
   guard rejects before any fetch — is still refused with "Tenant table products requires a
   tenant/owner predicate before execution". The fixed shape (`.eq('id', ...).in('store_id', [...])`)
   is not refused by the guard (the call then fails on the network, against an intentionally
   unreachable host — a different, expected failure, never the guard's message). If a future change
   drops the store predicate again, this is what catches it, not a test that happens to still pass.
5. **Revert-and-watch**, the actual proof that 3 is real and not a coincidence of test wording:
   `git revert --no-commit` on the fix commit (`a586e3ae`), tests 1 and both bulk tests then fail with
   `500` and the body `{"error":{"code":"INTERNAL_ERROR","message":"Tenant table products requires a
   tenant/owner predicate before execution"}}` — the exact guard error, not a different failure mode.
   The single-product cross-tenant test (item 2) still passes on the reverted tree, because that path
   never reaches the broken code: `ownedProductStoreId` (P5b's, untouched by this phase) already
   returns 404 for a caller who owns no matching product before `getOwnedProduct` is ever called. The
   bulk cross-tenant test, by contrast, *does* fail on the revert — with the same 500/guard message,
   not a 403/404 — because `bulkAction`'s pre-fix ownership select had no such earlier gate. `git
   revert --abort` restored the fix; the full test file was re-run green afterward (5/5).
6. `products.test.ts` and `tenant-isolation.test.ts` each asserted, by source-text regex, that
   `getOwnedProduct` called `assertStoreOwnership` on the row it had fetched — true of the broken
   implementation this phase replaces. Both are updated to assert the fixed, scoped shape instead.

## Validation run (this phase's own commits, not CLOUD_HANDOFF.md §7's numbers)

CLOUD_HANDOFF.md §7 gate evidence was measured at `d80cd7e8` (a tree identical to merge `5b782b05`)
and its CI at `41212f67`. Neither is this phase's SHA and neither is repeated here as if it were.

- **Clean baseline**, before any implementation change, claim commit only (`c3ccfaa`, this container):
  `gate.sh --baseline` — `failed=3`: `lint` (customer-web, the same 38-error set CLOUD_HANDOFF.md §7
  names), `validators:sweep` 111/114 (`environment`, `stale-artifact` — both attributed in
  `CLOUD_HANDOFF.md` §7 and `hazards.md`; `branch-dispositions` is new to this container: its log
  shows only shallow-clone advisories for pre-APPID-2026-09-24 SHAs this clone never fetched, plus one
  genuine, pre-existing, unrelated finding — `letbuyy/pay4-late-capture-after-release` recorded
  `MERGED_DEVELOP` but its SHA is not an ancestor of `develop` in this shallow clone; not this phase's
  branch or files), `tests:governance` (the `environment` validator's one offender, same as §7).
  `test:unit:gateway`: **1055 tests, 1044 pass, 0 fail, 9 skipped, 2 todo** — exit 0.
  (A first baseline attempt was contaminated by implementation edits made concurrently while it ran in
  the background — `test:unit:gateway` read 1 failure there. Discarded; the number above is from a
  `git stash` of every phase file, re-run start to finish with nothing else touched, then the stash
  popped back.)
- **`npx tsc --noEmit -p services/api-gateway/tsconfig.json`**: clean, no errors, after the fix.
- **`pnpm run test:unit:gateway`** after both commits: **1058 tests, 1047 pass, 0 fail, 9 skipped, 2
  todo** — exit 0. Exactly +3 tests/+3 passes over the clean baseline for the first pass, then +2 more
  once the bulk tests were added (final count above already includes them) — 0 regressions anywhere
  else in the suite.
- `product-tenant-guard.test.ts` alone: 5/5 (run via `npx tsx --test` from the repository root, the
  exact invocation `services/api-gateway/package.json`'s own `test:unit` script uses — running it from
  inside the package directory instead reproducibly breaks `hono/factory`'s `createMiddleware` import
  under this Node/tsx combination; not a code defect, an invocation artifact, worked around by using
  the real script's own command).
- **Full gate** (`gate.sh --full`) at the final commit (`a682fdf`): `failed=8` lanes — `lint`,
  `validators:sweep` (111/114), `tests:governance`, `tests:security+auth`, `ui:validate`, `tests:all`,
  `test:@letbuyy/customer-web`, `test:@letbuyy/merchant-web`. `flutter` SKIPPED (not on PATH, recorded
  below, not silently passed). **`--full` runs 21 lanes; `--baseline` runs 8 — the two modes are not
  directly count-comparable**, so each of the 8 is attributed by name, not by a cross-mode total:
  `lint`, `validators:sweep` and `tests:governance` are the same three lanes (same first-failure lines)
  as this phase's own clean `--baseline` above, run on this exact container before any implementation
  change — not caused by this phase. The other five (`tests:security+auth`, `ui:validate`, `tests:all`,
  `test:@letbuyy/customer-web`, `test:@letbuyy/merchant-web`) were not in the `--baseline` lane set, but
  are the same five `CLOUD_HANDOFF.md` §7 already named as the ambient set at `c2064968`/`d80cd7e8`,
  with the same first-failure lines (`customer-web`'s is the same `theme-localization.test.mjs`
  CLOUD_HANDOFF.md §3 gap 8 already named; `merchant-web`'s is the same custom-CSS validation gap
  CLOUD_HANDOFF.md §3 gap 5 already named; `tests:security+auth`'s "customer-web signs server-only
  legacy customer lookups" and `tests:all`'s "WS12 G6 migrated REST endpoints..." are unrelated to
  `products` or this phase's files). **None of the 8 names a file this phase touched or an assertion
  this phase added.** `test:unit:gateway`, `test:contracts`, `typecheck` and `tests:ci` are green.

## Infrastructure-blocked in this container (reported, not silently skipped)

- **Docker is not running** (`docker info` fails). Every suite that needs the ephemeral Postgres
  helper — `test:governance`'s real-DB assertions, `test:behavioral`, `test:foundation:wave*`,
  `gate.sh --real-db`, and `merchant-tenant-predicate.test.ts`-style raw `app_tenant` RLS probes — did
  not run. The acceptance criterion "a raw probe as `app_tenant` with B's GUC reads zero rows of A and
  mutates none" is proven at the tenant-guard and application layers above (items 2–5), not at the
  Postgres RLS layer, because that layer needs a database this container does not have. RLS itself is
  unchanged by this phase — no migration, no policy edit — so the existing FORCE RLS posture on
  `products` is exactly what it was before.
- **The Flutter SDK is not installed.** `gate.sh --mobile`/`--flutter-build` did not run. This phase
  touches no Flutter/Dart source, so this is expected to be a no-op, not verified here.
- **CI on GitHub** was not triggered (nothing pushed).

## Not done / out of scope (CLOUD_HANDOFF.md §8)

- The tenant query guard still counts `filter` with **any** operator on a scope column as scoping (a
  `neq` would pass) — unchanged, named out of scope.
- Operator sign-in (APPID-P5a) — unchanged, named out of scope.
- The guard's other known gaps (§3 items 2–8 of `CLOUD_HANDOFF.md`) — unchanged, not this phase's.
