# Staff paths fail closed; a store's staff never hold platform scopes (APPID-P5b, 2026-09-24)

What APPID-P5b changed and proved, on branch `letbuyy/appid-p5b-staff-paths-fail-closed` (`89807b34`
platform RBAC, `c1c70937` merchant staff check, `0de12c8e` staff roles and keys, `617b3f66` the product
routes' store). Gate results are in the phase's `EXECUTION_LEDGER.md` row; deployment is E-19 in
`EXTERNAL_ACTIONS.md`. Nothing here is deployed. It comes before APPID-P5a (operator sign-in) because
operator sign-in would otherwise have taken its eligibility from the platform RBAC as it was.

## What was wrong, measured on `develop` (`c8aaac28`) and a local database through 259

1. **The platform RBAC counted a merchant's store staff as the platform's own.** `middleware/rbac.ts`
   read `employees` by user alone. The same table holds every merchant's store staff (`store_id` →
   `sites`), and the platform tier followed the row's role: a store `editor` held the platform operator
   tier (`merchant:pii`, `risk:decide` among them), a store `admin` the whole admin tier. A store owner
   could also add any scope through the row's permissions JSON, which `planEmployeeUpdate` copied as
   given. Today this is reachable only with the internal API secret, because the operator routes accept
   only the internal identity signature; APPID-P5a's operator sign-in would have made it reachable.
   No code creates platform staff rows: the only writer is the merchant route, which always sets
   `store_id`. The internal console listed and granted scopes on every row as an "internal employee".
2. **The merchant staff check never checked anything.** `middleware/staff-permission.ts` was a dry run
   in every environment (`MERCHANT_STAFF_RBAC_MODE` is set nowhere), allowed on any lookup error or
   missing context, and read grants from `employees.site_id`, a column that does not exist.

## What it does now

- **Platform scopes** come only from the super admin allowlist or an `employees` row with no store
  (`platformEmployeeRows`). A failed lookup refuses. The console's employee list, count and scope grants,
  and the operations RBAC routes, see only platform staff; a store row is a 404 there. These reads now
  pass the tenant query guard, which refused several of them before (the console list returned 500).
- **The merchant staff check** enforces in production always, and a dry run can be asked for outside
  production only. The store owner passes. Anyone else needs an active staff row at this store
  (`employees.store_id`) holding the key. No store, no user, or a session bound to another store is a
  403; a failed lookup is a 503. Every route that calls it already checks ownership of the store it
  names, so no owner is blocked by it; product edit and delete now give it the product's own store.
- **A store owner** can give their staff only the store roles and permission keys the merchant app
  offers; anything else is a 400.

## Found, not fixed here

- **Product edit and delete by id fail on `develop`.** The product adapter's own lookup and writes by
  product id alone are refused by the tenant query guard ("Tenant table products requires a tenant/owner
  predicate before execution"), so `PATCH` and `DELETE /v1/products/:id`, which merchant web calls,
  return 500 before and after this phase. Reproduced with `develop`'s own route, adapter and staff check.
  It is the next phase.
- The tenant query guard counts `filter` with ANY operator on a scope column as scoping (a `neq` would
  pass). This phase uses `filter('store_id', 'is', null)`, which is the exact predicate; tightening the
  guard's operator check is left for a guard change of its own.
- `verifySiteOwnership` reports a failed read as "not the owner". The staff check no longer relies on it.

## Evidence

| Claim | Check | Result |
|---|---|---|
| A store row confers no platform scope; platform staff and the super admin do | `staff-paths-fail-closed.test.ts` through the real guarded client, and through the real `authMiddleware` and `requirePermission` on an operator route (a store admin gets `PERMISSION_SCOPE_DENIED`, nothing is read) | passes; plants (store filter removed, lookup error read as "none") fail it |
| The staff check fails closed | same file: owner, grant here, grant elsewhere, no store, no user, another store's session, `sites` or `employees` unavailable (503), dry run outside production only, "off" gone | 9 of 9; plants (`site_id` again, allow on error, dry run by default, dry run in production, no session check, missing context allowed) each fail it |
| Product edit and delete give the check the product's store | same file, PATCH and DELETE through the real products router | plants (either route back to the session store) each fail it |
| Store owners write only store roles and keys | `packages/auth-core/test/store-staff-plans.test.ts` | 3 of 3; plants (any role, any permissions) fail it |
| Nothing else broke | gateway unit suite; contracts; governance; launch (the staff-guard contract now pins the fail-closed shape) | 1044 passed, 2 todo, 0 failed; 319 of 319; 280 of 280; launch failures only the ones on `develop` |

## Not done

- The newer store membership model (`site_memberships`, `site_roles`) is not consulted by the staff
  check. Every route that calls it is owner-only today, so no member is affected; when a member path is
  added, the check must read memberships too.
- Operator sign-in, MFA and step-up: APPID-P5a.
