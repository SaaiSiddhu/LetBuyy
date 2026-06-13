# RLS & Tenancy Map

Every tenant row is scoped by **`site_id`**. Isolation is enforced at two layers.

## Layer 1 — Postgres RLS
- Tenant tables `ENABLE` **and** `FORCE` row-level security (`rls-force-coverage-validator`).
- **No public `USING (true)`** policies on tenant tables (`no-public-using-true-validator`).
- Owner-read + service-all pattern (e.g. `gift_card_accounts_owner_read`, `*_service_all`); ledger/redemption tables are service-role-only (access flows through the gateway with ownership checks).
- No blanket service-role grants (`no-blanket-service-role-validator`).

## Layer 2 — Gateway ownership checks
- The gateway uses the service role (`getSupabaseAdmin`) but **only behind** `verifySiteOwnership` / `resolveTenantContextForOrder` on every mutating route.
- `route-ownership-validator` classifies the 129 app API routes; storefront/merchant routes are gateway-proxies that cannot touch the DB locally.

## On every new tenant table
1. Add RLS `ENABLE`+`FORCE` + a scoped policy in the migration.
2. Register it in `tenant-tables.registry`.
3. Access it via the gateway with an ownership check, never directly from an app.
4. Run `node scripts/validators/rls-force-coverage-validator.mjs`.
