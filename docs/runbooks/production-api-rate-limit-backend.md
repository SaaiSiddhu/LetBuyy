# Production API — rate-limit backend and the `/v1` 503 incident

**Status:** PARTIALLY RESOLVED — production `/v1` data routes serve real data but return
intermittent `503 RATE_LIMIT_UNAVAILABLE`. Upstash Redis is required to close this out.
**Date:** 2026-08-01
**Affected runtime:** `services/api-gateway` (Cloudflare Worker `letbuyy-api`, `api.letbuyy.com`)

## Symptom

`https://api.letbuyy.com/v1/health` returned `200` with `environment: "production"`, while every
`/v1` **data** route returned:

```
HTTP 503 {"error":{"code":"RATE_LIMIT_UNAVAILABLE","message":"Rate limiting infrastructure is unavailable"}}
```

The marketing pricing section therefore rendered its honest "Pricing is temporarily unavailable"
state, because `/api/founding-pricing` could not reach a working gateway.

## Root cause

Two independent facts combine:

1. **The Worker was deployed without its environment.** The top-level `wrangler.toml` block has no
   routes and no KV/D1/Hyperdrive bindings — the production configuration lives entirely under
   `[env.production]`. A plain `wrangler deploy` produces a routeless worker, which is why
   `api.letbuyy.com` was NXDOMAIN. **Production MUST be deployed with `wrangler deploy --env production`.**
   Because `[env.production]` overrides `name` back to `letbuyy-api`, it is the same Worker, so
   secrets are shared between the two deploy forms.

2. **The query-cost limiter has no production KV auto-enable.** In
   `src/middleware/rateLimit.ts`, `checkRateLimitKeys` (fixed-window) selects its fallback as
   `Boolean(env.CACHE) && (isProduction || kvRateLimitFallbackEnabled(env))`, but
   `checkQueryCostRateLimitKey` uses `Boolean(env.CACHE) && kvRateLimitFallbackEnabled(env)` —
   **no `isProduction ||`**. With no Upstash Redis and the flag unset, it correctly fails **closed**
   in production. `queryCostRateLimit` is mounted globally (`api.use('/*', …)`), so this affects
   every `/v1` route. Staging is unaffected only because `isProductionRuntime()` is false there and
   it degrades to the in-memory limiter — so **staging passing is not evidence production will pass.**

## Current mitigation (temporary, founder-approved 2026-08-01)

`RATE_LIMIT_KV_FALLBACK = "on"` was added to `[env.production.vars]`. This is **configuration only** —
the limiter code is unchanged and rate limiting remains fully enforced (see
`src/__tests__/rate-limit-query-cost-backend.test.ts`, which asserts that requests beyond capacity
are still refused).

### Why this is not sufficient

Cloudflare KV permits roughly **one write per second per key**, and the query-cost limiter writes on
every request. Unauthenticated requests are keyed by `CF-Connecting-IP`
(`defaultQueryCostKey`). The marketing site calls the gateway **server-side** from its
`/api/founding-pricing` route, so the gateway observes **Vercel's egress IP** rather than the
visitor's — every visitor's pricing fetch collapses onto a **single rate-limit key**, and therefore a
single KV key.

Measured on production 2026-08-01 after enabling the flag:

| Test | Result |
|---|---|
| 8 sequential requests | 8 × `200` |
| 120-request burst (single IP) | 100 × `200`, 20 × `503` |
| 10 requests, 1s apart | `200 503 503 503 503 200 503 200 200 200` |

Exceeding the limit yields `503 RATE_LIMIT_UNAVAILABLE` rather than the intended `429`, because KV
write contention trips the `queryCostKvUnavailableUntil` backoff. KV is structurally unsuited to a
single-hot-key path.

## Required fix

Provision Upstash Redis (atomic `INCR`, no per-key write-rate ceiling) and set the two secrets on the
production Worker. **Never** place these in `wrangler.toml`, source, or CI logs:

```
wrangler secret put UPSTASH_REDIS_REST_URL --env production
wrangler secret put UPSTASH_REDIS_REST_TOKEN --env production
```

Then redeploy with `wrangler deploy --env production` and re-run the verification above. Once Redis is
live, remove `RATE_LIMIT_KV_FALLBACK` from `[env.production.vars]`.

Neither production nor staging currently has these secrets, and no Upstash credential exists in the
27 configured GitHub Actions secrets.

## Verification commands

The local macOS resolver negative-caches `NXDOMAIN` for minutes after Wrangler creates a custom
domain. Verify with an authoritative resolver, not `host`:

```
dig +short @1.1.1.1 api.letbuyy.com
```

```
curl -s --resolve "api.letbuyy.com:443:$(dig +short @1.1.1.1 api.letbuyy.com | head -1)" https://api.letbuyy.com/v1/pricing
```

## Rollback

`wrangler rollback --env production` (previous version `cd89c406-2e13-43dc-a6fe-1793e2cf22a5`).
Note that rolling back restores **constant** `503` on `/v1` data routes, which is strictly worse than
the current intermittent behavior.
