# MISSED_FINDINGS — what the master verdict did not catch

Adversarial pass across DB/infra, security/identity, and money/commerce. **26 net-new findings**, then the **refutations** (including three stale CRITICALs the platform has actually fixed). Every line is `path[:line]`-anchored.

## New findings — ranked

| ID | Finding | Evidence | Severity | Domain |
|---|---|---|--:|---|
| N-1 | **Spendable merchant balance is read from the mutable, freely-UPDATE-able `wallet_ledger_entries` single-entry table — not the append-only canonical ledger.** The crown-jewel ledger is bypassed as the source of truth. | `routes/wallet.ts:66-92`; canonical summary is informational `:95-118` | **CRITICAL** | Money |
| N-2 | **Payout release has no `FOR UPDATE` row-lock and no balance check** before calling the real transfer; concurrent settles both initiate before a wallet unique-index (23505) aborts the loser — a live double-send guarded only by an unhandled DB error. | `routes/payouts.ts:505-521,468-503` | **CRITICAL** | Money |
| N-3 | **Refunds post nothing to the canonical ledger** (`refund_clearing` dead); partial refund voids the remaining capture state. | `routes/payments.ts:763-855,773,796` | **CRITICAL** | Money |
| N-4 | **Reconciliation can never detect a break** — imbalances are auto-plugged into a `reserve` account so postings are always “balanced.” | `packages/billing-core/src/index.ts:558,601-615` | **HIGH** | Money |
| N-5 | **Platform fee + GST are double-booked** into `platform_revenue`/`gst_payable` across settlement and commission on the same orders. | `routes/payouts.ts:404-426` + `routes/commission.ts:288-342` | **HIGH** | Money |
| N-6 | **Money width = 32-bit `integer`** on `payout_statements` + `wallet_ledger_entries`; overflow at ₹21,474,836/row, reachable by one mid-tier merchant. | `migrations/119_mobile_money_ledgers.sql:16-19,52` | **CRITICAL** | Money/DB |
| N-7 | **The “money” test suite regex-matches source and executes no money logic** — money is “tested” by grep. | `services/api-gateway/src/__tests__/money.test.ts:5-60` | **HIGH** | Money/QA |
| N-8 | **Maker-checker guards the wrong (orphan) `payouts` table; the live `payout_statements` release path has no dual-control** — directly violating Executable-Architecture-V1 Appendix B #15. | `migrations/151:126-129` vs `routes/payouts.ts:464-521` | **HIGH** | Money/Sec |
| N-9 | **COD reconciliation never posts to the canonical ledger** and credits *deposited* (not *expected*) amounts; `short`/`over` mis-credit. | `routes/cod-reconciliation.ts:305-326,395-403` | **HIGH** | Money |
| N-10 | **Internal `X-LetBuyy-Internal-*` identity headers are forgeable by anyone holding the shared secret on a publicly reachable gateway** (no mTLS/IP-allowlist); total impersonation, no MFA, audit blamed on victim. | `middleware/auth.ts:96-128` + `wrangler.toml:212-215` | **CRITICAL** | Security |
| N-11 | **One secret, ≥4 crypto purposes, unrotated** (`INTERNAL_API_SECRET \|\| AUTH_SECRET` also signs cookies, app-OAuth tokens, encrypts TOTP seeds). | `auth-core:447-452`; `cookies.ts:13`; `two-factor.ts:54-58` | **HIGH** | Security |
| N-12 | **Rate limiting fails OPEN** when neither Redis nor KV is present in prod (one throttled warn, all requests pass) — brute-force/checkout-abuse controls silently vanish. | `middleware/rateLimit.ts:884-888`; `production-deploy.yml:77` | **HIGH** | Security/Infra |
| N-13 | **Hyperdrive is bound in `wrangler.toml` but `connectionString` is never called** — the advertised connection pooling does not exist; every Worker hits Supabase REST/HTTP. | `packages/infrastructure/supabase-adapter/index.ts:34-38`; grep `connectionString`=0 | **HIGH** | Infra/Scale |
| N-14 | **GraphQL, App Extensions, and Liquid are `false` in production** — three advertised capabilities are off; the Liquid theme-render path and app-block injection are not live. | `services/api-gateway/wrangler.toml:239-241` | **HIGH** | Platform/Theme |
| N-15 | **Outbox drain is structurally capped at ~4,800 events/day** (96 cron fires × 50) — above ~200 orders/hr the outbox backlogs permanently; `order.paid`→WhatsApp/notifications lag without bound. | `wrangler.toml` cron `*/15`; `index.ts:855` | **CRITICAL** | Infra/Scale |
| N-16 | **`products` lacks a composite `(site_id, status, created_at)` index** — every storefront product listing is a partition/seq scan at 1k+ merchants. | `migrations/000_baseline.sql:18056-18070` | **HIGH** | DB/Scale |
| N-17 | **Customer storefront has no CSRF tokens** (SameSite=Lax only) — state-changing customer routes are CSRF-exposed; only platform CSRF was previously audited. | `apps/storefront-runtime/src/lib/session.ts:113` | **MEDIUM** | Security |
| N-18 | **Account-enumeration oracle** — reset/intent flows return 404 “User not found”, leaking which emails are registered. | `routes/auth.ts:779,809,818,922,941` | **MEDIUM** | Security |
| N-19 | **Internal-header replay window ~10 min, no nonce/jti**; CSRF auto-bypassed for that path. | `auth-core:562-570`; `middleware/security.ts:263-266` | **MEDIUM** | Security |
| N-20 | **In-memory circuit breakers** (module-scope `Map`) reset on Worker isolate recycle → false safety under DB instability. | `services/queue-workers/src/platform-queue-consumer.ts:183` | **MEDIUM** | Infra |
| N-21 | **`lb_session` is scoped to parent domain `.letbuyy.store`** → one stolen cookie is valid across every platform sub-app (SSO blast radius). | `apps/identity-platform/src/lib/auth/cookies.ts:58-67` | **MEDIUM** | Security |
| N-22 | **Settlement crosses the money boundary as a float multiply** (`amount * rate`) before integer coercion — rounding-leak surface. | `routes/payouts.ts:101-103` | **MEDIUM** | Money |
| N-23 | **No RTO/RPO defined; no R2/KV backup or lifecycle/GDPR-erasure path** — only Postgres pre-migration dumps. | `infrastructure/cloudflare/storage.tf`; `docs/runbooks/infra-recovery.md` | **MEDIUM** | DR |
| N-24 | **Ledger tenancy GUC `app.site_id` is app-supplied and not set on the general service-role REST path** — RLS keyed on `current_site_id()` can’t scope it. | `migrations/139:8-21`; `supabase-adapter/index.ts:34-38` | **MEDIUM** | DB/Sec |
| N-25 | **Some RLS policies are affirmatively open** (`USING (true)`) rather than merely bypassed. | `migrations` (e.g. wishlists/form_submissions `USING(true)`) | **MEDIUM** | Security |
| N-26 | **30-day opaque session bearer, no idle timeout, no rotation** (carries nothing for the realm migration to inherit). | `auth-core:127`; `routes/auth.ts:171-174` | **MEDIUM** | Identity |

## Refutations & stale-CRITICAL clearances (the challenge also *cleared* things)

| Prior claim | Verdict | Evidence |
|---|---|---|
| “Fabricated payouts” = the #1 risk | **DOWNGRADED to P2 “not wired.”** Sandbox-default moves no money; the real P0s are N-1/N-2/N-3. | `routes/payouts.ts:116` (sandbox default) |
| “RLS entirely inert” | **PARTIAL.** App path bypasses RLS, but financial tables have scoped `authenticated` policies for direct-SDK access. | `migrations/119:196-216` |
| Internal HMAC trust = a “strength” (F19) | **REVERSED to CRITICAL** (N-10). | `auth-core:447-452` |
| Rate-limit “503 when Redis absent” | **SUPERSEDED** — it now fails *open* (worse direction). | `middleware/rateLimit.ts:884-888` |
| Durable Object as scale bottleneck | **REFUTED** — health-only, 0 product mutations. | `durable/runtime-coordinator.ts:19-36` |
| Internal-payment routes fail-open (older audit) | **FIXED** — now fail-closed. | `internal-payment-routes.ts:73-74`; `internal-secret.ts:11-15` |
| “Replay any Razorpay signature to self-activate a plan” | **MITIGATED** — real capture re-check; the scary in-code comment is stale. | `routes/payments.ts:1101-1118` |
| “Secrets committed in `all.env`” | **NOT REPRODUCIBLE** in this tree (gitignored/absent). | `.gitignore:90-91` |

## The corrected money P0 set (the headline the master verdict buried)
Even after a real PA is wired, money is unsafe until: **(N-1)** balance reads move to the canonical ledger, **(N-2)** payout release gets row-lock + balance check + idempotency, **(N-3)** refunds post to the ledger, **(N-4)** reconciliation stops auto-plugging, **(N-5)** revenue double-booking is removed, **(N-8)** maker-checker moves to the live `payout_statements` path, **(N-6)** money columns become `bigint`. These are correctness defects, not “mock-by-default.”
