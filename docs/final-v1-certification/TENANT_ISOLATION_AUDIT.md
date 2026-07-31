# Phase C — Tenant Isolation Audit

**HEAD `587dc988`. Score: 92/100. 87 route files audited; 0 genuine ownership-bypass gaps.**

## Enforcement primitives
- `verifySiteOwnership` (`lib/auth-user.ts:40`) — checks `sites.custom_user_id/user_id == caller`.
- `resolveOwnedStoreScope` / `resolveTenantContextForOwnedSite` / `resolveTenantContextForOrder` (`lib/tenant-context.ts:220–258`) — all funnel through `buildOwnedTenantContext` → `verifySiteOwnership`, throw `ForbiddenError`.
- **DB layer:** every service-role query passes `createTenantGuardedSupabaseClient` (`lib/supabase.ts:14`); the Proxy (`tenant/tenant-scoped.ts:79–124`) rejects any registry-table query lacking a tenant/owner predicate **before execution**.
- **RLS:** forced in 18 migrations (139–156, 164); migration 164 installs `app_tenant` (`NOLOGIN NOBYPASSRLS`) GUC-reading FORCE policies + an executable **RT-1..RT-9** Postgres red-team test proving raw-REST callers can't forge tenant rows or self-add super-admins.

## Route ownership table (representative; full audit = 0 gaps)

| Route class | Ownership check | Status |
|---|---|---|
| `products/*`, `orders/:id`, `coupons/:id`, `collections/:id`, `payouts/:id`, `returns/:id`, `metafields/*` | resolve row → verify `store_id`/`site_id` owner | PASS |
| `payments/:id/refund`, `payouts/:id/settle` | `verifySiteOwnership` + **step-up** | PASS |
| `settlements/*` | rejects path-vs-query store mismatch | PASS |
| `app-api.ts` (app token) | binds every query to token `storeId`, rejects mismatch | PASS |
| `admin.ts`, `operations/*` | `requireRoleCategory('ops')` + `requireSuperAdmin` | PASS |
| `internal-*` | `internalPerimeter` + constant-time `INTERNAL_API_SECRET` | PASS |
| `contacts.ts POST /`, `themes` browse, `storefront/*` public | public by design (published-store scoped) | PASS |
| `custom-domains decision` | platform-console token (not owner) — intentional T&S | PASS (by design) |

## Minor notes (not isolation breaks)
- `[Low] notifications.ts:368–381` — `/notifications/send` (store-owner-gated) can target an arbitrary `actor_id` for in-app channel; content is merchant-authored. Tighten to validate actor∈store.
- `[Low] storefront/public-routes.ts:284` — `/storefront/directory` lists `draft` stores (non-PII allowlist: name/logo/status). Minor info-disclosure, no PII/owner email.

## −8 deduction
Per-request merchant authz rests on the shared `INTERNAL_API_SECRET` transport + opaque DB session (`merchant-session.ts:62–96`), not per-request ES256 verification; with `INTERNAL_AUTH_LEGACY_ACCEPT` defaulting ON, a leak of that one secret has fleet-wide blast radius. Isolation logic is correct; the deduction is secret blast-radius.
