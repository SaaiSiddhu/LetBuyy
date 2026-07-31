# Phase A — Architecture Audit

**HEAD `587dc988`. Score: 88/100.**

## Inventory (live counts)

- **Apps: 10** — production: `storefront-runtime`, `merchant-control-plane`, `identity-platform`, `platform-console`, `marketing-site`, `mobile/merchant-app`. Frozen/reserved: `app-marketplace`, `developer-portal`, `theme-marketplace`, `platform-operations-portal`.
- **Services: 10** — implemented: `api-gateway`, `mobile-bff`, `webhook-service`, `queue-workers`. Reserved (manifest-only): `checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`.
- **Packages: 20** — incl. `@letbuyy/api-client`, `auth-core`, `tenant-core`, `checkout-core`, `notification-core`, `theme-engine`, `ui`, `infrastructure/*` adapters.
- **API-gateway routes: 59 top-level files (~87 incl. `operations/*`, `app-store/*`, `storefront/*` sub-routers). Migrations: 103. Governance validators: 111.**

## Topology & data flow

Thin Next.js views (Vercel) → **`api-gateway`** (Hono on Cloudflare Workers, Node runtime) owns all commerce write-truth → **Supabase Postgres** (single region `ap-south-1`) via **Hyperdrive** pooling. Async via **5 Cloudflare Queues** → `queue-workers` (circuit breaker + dead-letter). Inbound PSP callbacks → `webhook-service` (HMAC-verified). Storefront host-routing is Next 16 **`proxy.ts`** (not `middleware.ts`).

```
{store}.letbuyy.com / custom domain ──proxy.ts──▶ /store/[subdomain] (ISR + KV)
   merchant UI ─┐                                     │  next.config rewrite /api/storefront/* 
   identity   ──┼─@letbuyy/api-client──▶  api-gateway (/v1, Hono) ──Hyperdrive──▶ Supabase (RLS+GUC)
   console    ─┘                              │  └─ SECURITY DEFINER money RPCs ─▶ canonical ledger
                                         5 Queues ─▶ queue-workers ─▶ Resend / search / analytics
   Razorpay ─▶ webhook-service (HMAC) ─▶ gateway internal endpoints
```

## Trust boundaries (all enforced)

1. **Network edge** — `proxy.ts` host resolution; gateway `/v1` behind `authMiddleware`; public routers (`/checkout`, `/storefront`, `/contacts`, `/app-store`) mounted before auth by design.
2. **Identity** — two issuers never crossed: merchant **ES256/EdDSA** (identity-platform, JWKS-verified at gateway, `identity-session-verifier.ts:42–109`, no HMAC fallback) vs customer **HS256** (`auth-core/customer-session.ts`). Step-up HMAC gates refunds/payouts.
3. **Tenant** — RLS forced + GUC; every service-role query passes through `createTenantGuardedSupabaseClient` (`lib/supabase.ts:14`) which rejects untenanted registry-table queries (`tenant/tenant-scoped.ts:88–93`).
4. **Money** — mutations only via SECURITY DEFINER RPCs (`canonical-ledger-only-validator`); append-only double-entry ledger (migration 139).
5. **Internal service-to-service** — HMAC `INTERNAL_API_SECRET` (+ per-caller keyring B7, legacy-accept currently ON).

## Ownership boundaries

Route-ownership lockstep: new app API routes are gateway proxies; apps never write the DB locally. Verified — `apps/*/src` contains no service-role Supabase client.

## What earns 88 (not higher)

−4 single-region Postgres write path is the deliberate scale ceiling (multi-region constitutionally frozen). −3 single shared `INTERNAL_API_SECRET` across ~10 runtimes is the effective per-request merchant trust root (ES256 verified only at session *creation*, re-verified per request only as an opaque DB session). −3 no external alerting wired (collection-only observability) and one validator gap (a guard test was edited alongside a feature change — see Red-Team R1). Architecture is genuinely production-grade; the deductions are blast-radius and operability, not correctness.
