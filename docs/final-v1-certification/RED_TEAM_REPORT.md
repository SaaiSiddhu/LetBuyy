# Phase K — Red-Team Attack Review

**HEAD `587dc988`. Adversarial. Each vector: attempted → result.**

| Attack | Result | Evidence |
|---|---|---|
| **Tenant escape** (forge `site_id`, read other store) | **BLOCKED** | every route resolves row→verifies owner; `createTenantGuardedSupabaseClient` rejects untenanted queries (`tenant-scoped.ts:88–93`); RLS forced + RT-1..9 test |
| **Privilege escalation** (non-owner → merchant data) | **BLOCKED** | `buildOwnedTenantContext:192–195` throws before any write; `/auth/switch` requires target ∈ signed cookie (`:69–81`) |
| **Auth bypass** (HS256-forge a merchant session) | **BLOCKED** | verifier rejects non-asymmetric alg twice (`identity-session-verifier.ts:57–59,95–97`); d3 test proves it |
| **Payment abuse** (tamper amount / replay provider id) | **BLOCKED** | server-authoritative totals in RPC; `assertProviderPaymentNotReplayed` + reference-match + amount guard (`checkout-payment-routes.ts:617–661`) |
| **Refund abuse** (over-refund / un-stepped) | **BLOCKED** | over-refund guard `payments.ts:476–484`; step-up 428 before provider |
| **Coupon abuse** (enumerate codes) | **PARTIAL** | `public-routes.ts:373,858` validate has no limiter → brute-force discovery feasible (Med) |
| **Gift-card abuse** (double-spend / forge) | **BLOCKED** | `FOR UPDATE` + ledger-projection balance + SHA-256 hash (mig 170/173); no mutable decrement |
| **Webhook abuse** (spoof PSP callback) | **BLOCKED** | HMAC verify + `timingSafeEqual` + dedupe all providers (`webhook-service:677–696`) |
| **Queue poisoning** (malformed/replayed job) | **BLOCKED** | HMAC tenant envelope; dead-letter after max retries; circuit breaker opens after 3 failures |
| **Rate-limit bypass** (rotate IP → credential-stuff / email-bomb) | **EXPLOITABLE** | global bucket is **per-IP only**; `/contacts:56` has no limiter+no Turnstile and sends owner email → email-bomb (High); checkout steps unthrottled (High) |
| **Email-bomb owner via lead form** | **EXPLOITABLE** | `contacts.ts:56` enqueues owner notification per request (High) |
| **Secret blast-radius** (one internal secret → fleet) | **LATENT** | shared `INTERNAL_API_SECRET`, `INTERNAL_AUTH_LEGACY_ACCEPT` ON → leak forges internal headers across ~10 runtimes (Med, pending keyring) |
| **DB-layer public write** (anon) | **MOSTLY BLOCKED** | RLS REVOKE from anon (mig 163); **except** 4 frozen marketplace tables with `USING(true)` no-`TO` (mig `100:133–155`) — no PII/money, no anon route writes them (Med, latent) |
| **Gate evasion** (ship a feature change that weakens a guard) | **DEMONSTRATED** | commit `56fecb4f` edited `lb1-storefront-middleware.test.mjs` in the same commit it deleted `middleware.ts` — here the change was *legitimate* (Next 16 migration), but it proves the gate can be moved in lockstep with code (R1) |

## Highest-value attacker targets (ranked)
1. **Contact/lead form email-bombing** (`contacts.ts:56`) — trivial, no auth, amplifies to owner inbox + email quota. **Fix: add limiter + Turnstile.**
2. **Distributed credential-stuffing** — per-IP-only bucket; add per-identity/per-account limiter on customer login fallback paths.
3. **Coupon-code enumeration** — add limiter to validate endpoints.
4. **Internal-secret compromise** — provision per-caller keyring, flip legacy-accept off.

**No money, identity, or tenant-isolation break was achievable.** The exploitable surface is abuse/DoS (rate-limit gaps) and latent blast-radius, not data theft or fund movement.
