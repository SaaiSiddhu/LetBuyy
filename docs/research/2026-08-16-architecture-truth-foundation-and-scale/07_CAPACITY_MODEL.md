# 07 — Capacity Model and Bottleneck Order

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> Audited commit `5af69e0c080503765dec361eae2128ba860cf529` · branch `stepup/main` · 2026-08-16.
>
> Inputs: implementation facts from `03_CURRENT_ARCHITECTURE_AS_BUILT.md` (`VERIFIED-SOURCE` / `VERIFIED-CONFIG`), vendor limits from `10_VENDOR_LIMITS_AND_COSTS.md` (primary-source, accessed 2026-08-16), workload bands from `06_10M_WORKLOAD_DEFINITION.md`.
>
> **No load test was run.** Every throughput figure here is arithmetic over a documented vendor limit and a counted implementation cost. Each is falsifiable by a named measurement in `13_TEST_AND_LOAD_VALIDATION.md`.

---

## 1. The headline result

The founder's question was "can the foundation reach 10 million concurrent users?" The capacity model returns a more urgent answer first:

> **Four independent ceilings bind at or below Band G — the platform's own ratified 10,000-merchant / 30,000-orders-per-month envelope. The 10M question cannot be meaningfully asked until they are cleared, because the system as currently configured cannot serve the scale it is already governed for.**

| # | Ceiling | Binds at | vs Band G (peak ~20 origin RPS, 1,000 orders/day) |
|---|---|---|---|
| **1** | **KV rate-limiter: 1 write/second/key (HTTP 429), then isolate-global backoff → 503 on every `/v1` route** | **~1–2 req/s per rate-limit key** | **BELOW** — binds at essentially zero load |
| **2** | **Storefront serves no cached HTML and no cached fetches; uncacheable share ≈ 100%** | every request reaches origin | **BELOW** — removes the model's dominant lever |
| **3** | **Every API request writes 1–2 PostgreSQL rows of telemetry** | DB write load ∝ total requests, not orders | **AT** — telemetry becomes the dominant write load |
| **4** | **Outbox relay capped at 4,800 events/day** | ~600–800 orders/day | **AT/BELOW** — backlog grows unbounded at envelope top |

This is good news framed uncomfortably. Every one of the four is a **configuration or application-level defect with a bounded fix**, none requires a topology change, and none requires a constitutional amendment. The foundation's *shape* is sound; its *settings* are not.

---

## 2. Implementation-derived cost inputs

These replace the `[SRC]` cells in the `06` traffic-mix matrix. Each is counted from source.

| Input | Measured value | Source | State |
|---|---|---|---|
| Telemetry DB writes per API request | **1 `runtime_telemetry_metrics` row, always** + 1 `worker_request_logs` row (2% sampled for anonymous storefront GET/HEAD, unsampled otherwise) | `middleware/observability.ts:265-302,338-381`; `wrangler.toml:61` | `VERIFIED-SOURCE` |
| KV operations per rate-limited request | **1 read + 1 write**, non-atomic read-modify-write | `middleware/rateLimit.ts:321-325, 618-623` | `VERIFIED-SOURCE` |
| Storefront HTML cache | **None reachable.** A cookie read in `store/[subdomain]/layout.tsx:76` forces the whole subtree dynamic; every `export const revalidate` beneath it is inert; `cacheComponents` is off so PPR is off | `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:76`; `lib/theme-preview-server.ts:12`; `next.config.ts` (no `experimental` block) | `VERIFIED-SOURCE` |
| Next fetch Data Cache | **Defeated.** A fresh `X-Request-ID: crypto.randomUUID()` on every server-side gateway fetch enters both the Data Cache key and the request-memoisation key in Next 16.1.6 | `apps/storefront-runtime/src/lib/api/client.ts:45` | `VERIFIED-SOURCE` |
| Worker-side storefront cache | Cache API, **no request coalescing, no serve-stale path** — every concurrent miss on a cold key runs the full origin producer | `services/api-gateway/src/lib/storefront-cache.ts:121-129` | `VERIFIED-SOURCE` |
| Outbox relay throughput | 50 events × 96 ticks/day = **4,800/day**; RPC hard-caps at `LEAST(GREATEST(p_limit,1),100)` | `wrangler.toml:236`; `index.ts:945-947`; `000_baseline.sql:756` | `VERIFIED-CONFIG` |
| DB role on the live path | **`service_role` (BYPASSRLS) for all gateway traffic**; `withTenantTx`/`app_tenant` has no non-test caller | `lib/supabase.ts:13-14`; `lib/tenant-context.ts:67` | `VERIFIED-SOURCE` |
| Queue tenant fairness | **None.** All four claim functions order strictly by arrival time with no `site_id` term and no per-site cap | `000_baseline.sql:754, 822, 966`; `141_…:323` | `VERIFIED-SOURCE` |

---

## 3. Component capacity budgets

### 3.1 Cloudflare Workers (api-gateway, queue-workers, mobile-bff, webhook-service)

| Property | Value | Class | Consequence |
|---|---|---|---|
| Requests/sec | No documented general limit | `UNKNOWN` | Not the bottleneck |
| CPU per invocation | 30 s default on Paid, 5 min ceiling | `DEFAULT` | Ample |
| Memory | 128 MB (not raised by Paid) | `HARD` | Matters for Liquid rendering of large themes |
| Subrequests | 10,000 (configurable) | `DEFAULT` | Ample |
| Simultaneous outbound connections | **6 per invocation** | `HARD` | Caps fan-out per request — relevant to `mobile-bff` composites |
| Behaviour on CPU exhaustion | **Error 1102, client-visible error page** — terminated, not throttled or queued | `HARD` | No graceful degradation. A pathological theme render becomes a hard 1102 for that buyer |

**Verdict: Workers compute is not a ceiling at any band this study models.** The Worker tier is the healthiest layer in the stack.

### 3.2 Cloudflare KV — **the first bottleneck**

| Property | Value | Class |
|---|---|---|
| **Writes to the same key** | **1 per second; exceeding throws HTTP 429** | **HARD** |
| Eventual consistency window | "up to 60 seconds or more" | `HARD` |
| `cacheTtl` | default 60 s, minimum 30 s | `DEFAULT` |
| Pricing | reads $0.50/M (10 M/mo included); **writes/deletes/lists $5.00/M** | — |

Cloudflare's own guidance states KV "is not ideal for applications where you need support for atomic operations or where values must be read and written in a single transaction," and is unsuited to write-heavy workloads updating the same key "tens or hundreds of times per second."

**LetBuyy routes production rate limiting to exactly this backend.**

#### The arithmetic

```
Rate-limit key cardinality: per identity (IP / site_id / route class)
Cost per limited request:   1 KV read + 1 KV WRITE
Vendor ceiling:             1 write/second/key  →  HTTP 429 on the 2nd write in the same second

⇒ Sustainable rate per key ≈ 1 req/s.
⇒ The 2nd concurrent request against the same key in the same second gets a KV 429.
```

Then the failure **amplifies**:

```
KV 429 → limiter throws → isolate-global backoff (rateLimit.ts:42,627; 60 s or 10 min per :577-583)
       → every non-exempt /v1 route on that isolate returns 503 RATE_LIMIT_UNAVAILABLE
         (rateLimit.ts:1078-1088) — a 503, not a 429
```

> **Finding C-1 (first-order capacity; security severity S1 per `findings.json`).** The production rate limiter is built on a store whose vendor explicitly documents a **1-write-per-second-per-key hard limit returning HTTP 429**, and the code's failure path converts that vendor 429 into an **isolate-wide 60-second-to-10-minute outage of every `/v1` data route**. This is a self-inflicted denial of service that triggers at roughly **two concurrent requests sharing a rate-limit key** — orders of magnitude below Band G, let alone any 10M scenario. Evidence: `VERIFIED-SOURCE` (code) + `VERIFIED-CONFIG` (flag) + primary-source vendor limit. The team's own committed comment anticipates the quota problem but identifies the *daily write allowance* as the risk; **the per-key-per-second limit is the sharper and more immediate one, and it is not mentioned.**

**Secondary KV correctness finding.** The 60-second eventual-consistency window means anything read from KV can be a minute stale across PoPs. Prices, inventory counts, gift-card balances, and GST rates must therefore **never** be read from KV on the money path. Cache-version keys are also unsafe: a merchant who saves twice within one second (bulk import, theme publish, a double-clicked Save) triggers a 429 on the version bump — a **two-request** failure, not a load failure.

**The fix is already provisioned.** Cloudflare's documented remedy is a **sharded Durable Object** (soft ceiling ~1,000 rps per object; `Required DOs = total_rps / per-DO capacity`, keyed by `idFromName`) or Cloudflare's native Rate Limiting binding. LetBuyy already declares an unused Durable Object namespace in production (`RUNTIME_COORDINATOR`, see `evidence/04-…`). The correct rate-limit backend is infrastructure the platform is already paying for and not using.

> ⚠️ **The one thing not to do:** promote the *existing single* `RUNTIME_COORDINATOR` object into a global limiter. A singleton DO serialises everything addressed to it. The design must be sharded by identity from the outset.

### 3.3 The storefront cache — the lever that is currently switched off

`06` §6 established that reducing the uncacheable fraction is worth up to **8×**, versus ≤1.15× for cache-hit tuning. The measured uncacheable fraction is:

| Cache layer | Designed role | Actual state |
|---|---|---|
| Vercel/Next **Full Route Cache** (ISR) | Serve storefront HTML from CDN | **Unreachable** — a cookie read in the tenant layout forces dynamic rendering for the entire subtree |
| Next **Data Cache** (fetch) | Cache gateway responses | **Defeated** — a random `X-Request-ID` per fetch makes every key unique |
| Next **request memoisation** | Dedupe within one render | **Defeated** — same cause |
| Worker **Cache API** (`cachedJson`) | Edge cache with SWR | Present, but **no request coalescing and no serve-stale path**; `stale-while-revalidate=300` is emitted as a header string only and drives no background refresh |
| Cloudflare **KV versioned cache** | 3-tier tenant cache (DOC 03 calls this "the audited strong point") | Present, but subject to the 1-write/s/key and 60 s consistency constraints above |

> **Finding C-2 (first-order capacity; component security severities S2 each).** The storefront's effective cache hit ratio on HTML and on gateway data fetches is **approximately zero**, from three independent and individually trivial causes. Every buyer page view therefore executes a Vercel function, which calls the gateway, which queries PostgreSQL, which also writes telemetry rows. `06`'s base-case model assumed a 30% uncacheable share; **the measured value is ~100%**, which multiplies modelled origin load by roughly **3.3× at Band C and correspondingly at every band.**
>
> Conversely — and this is the most actionable finding in the packet — **fixing three small things (move the cookie read out of the layout or wrap it in a Suspense boundary, drop the random request-ID from the cache key, add request coalescing to `cachedJson`) recovers the single largest capacity lever available, at zero infrastructure cost and zero constitutional risk.**

**Cache-stampede status.** Vercel *does* provide automatic request collapsing (N concurrent requests to an uncached or STALE path collapse to one function invocation per region), which would materially help — but only for paths that are cacheable, and currently none are. The Worker-side `cachedJson` has no equivalent.

**Multi-tenant invalidation defect.** Vercel documents that on-demand ISR revalidation "applies to the domain and deployment where you trigger it, and doesn't affect subdomains or other deployments." LetBuyy serves `{store}.letbuyy.com` **and** custom domains from one project. Purging `shopA.letbuyy.com` therefore does **not** purge `shopA.com`. Any future ISR adoption must fan the revalidate call across every domain a tenant owns. Where revalidation does apply, all regions converge within 300 ms — so the risk is **scope, not latency**.

### 3.4 PostgreSQL / Supabase

| Property | Value | Class |
|---|---|---|
| **Direct connections across the entire compute ladder** | **60 → 500, plateauing at 500 from 12XL upward** | `HARD` |
| Supavisor pooler client slots | 200 → 12,000 across the ladder | `HARD` per tier |
| Large tier (~$111/mo) | 2 dedicated cores, 160 `max_connections`, ~64 usable pooled server connections after PostgREST/Auth/Storage/Realtime | `HARD` |
| Disk autoscale | at 90% utilisation, +50%, **max 4 modifications per rolling 24 h** | `HARD` |
| **Disk full** | project enters **read-only mode**; `cannot execute INSERT in a read-only transaction`; clears only below 95% | `HARD` |
| IOPS | gp3 includes 3,000; $0.024 per provisioned IOPS/month (20,000 IOPS ⇒ $408/mo) | — |
| PITR | add-on $100 / $200 / $400 per month for 7 / 14 / 28-day retention; requires ≥ Small compute; **RPO ≈ 2 minutes** | — |

#### Transaction throughput

```
throughput = pool_size / mean_txn_duration
Large tier, ~64 usable server connections:
    10 ms simple txn  → 6,400 txn/s   (theoretical; CPU binds first at 2 cores)
    50 ms money RPC   → 1,280 txn/s
```

**CPU binds before connections.** Large has 2 dedicated cores and PostgreSQL forks one backend process per connection, so only ~2 queries execute *genuinely* concurrently regardless of 64 open connections.

> **Finding C-3.** The vertical-scaling ladder is **not** a connection ladder. Direct connections move 60 → 500 across a price range spanning $10 → $3,730/month and plateau at 500. Anyone planning to scale LetBuyy by "buying a bigger database" must understand they are buying **cores, RAM, and IOPS — not concurrency.** Beyond ~500 direct connections the only levers are pooling discipline, shorter transactions, and (constitutionally forbidden today) read replicas.

#### Little's Law on the pooler — the real failure mode

```
clients_needed = arrival_rate × mean_hold_time

2,000 req/s ×  20 ms =    40 slots   (comfortable)
2,000 req/s × 400 ms =   800 slots   (exactly the Large-tier ceiling)
```

> **Finding C-4.** Latency degradation converts **directly** into connection exhaustion. A single slow RPC that pushes mean hold time from 20 ms to 400 ms consumes the entire Large-tier pooler allowance at the same request rate. This is the classic cascade: one slow query → pool exhaustion → every tenant's checkout fails. It is also why the telemetry write-per-request (§3.5) is dangerous well before it is expensive.

#### Two correctness findings for the tenancy work that has not yet shipped

Both matter because `ART-08`'s `app_tenant` + per-transaction GUC design is currently **DDL-real and runtime-dead** (`03`, `05`). When it is wired, these govern whether it is safe:

1. **`SET LOCAL` under transaction-mode pooling is SAFE.** PgBouncer documents that in transaction mode "Server is released back to pool after transaction finishes" — the backend is held for the *whole transaction* — and PostgreSQL documents that "The effects of `SET LOCAL` last only till the end of the current transaction." Therefore `set_config(name, value, TRUE)` inside an explicit `BEGIN…COMMIT` (or inside a function's implicit transaction) is correct under Supavisor transaction mode. **The planned design is sound.**

2. **`set_config(..., FALSE)` or a bare `SET` would be a cross-tenant data leak.** PgBouncer documents that `server_reset_query` (`DISCARD ALL`) **is not used** in transaction pooling. A session-scoped tenant GUC would therefore **persist on the pooled backend and be inherited by the next client**. This is not a performance footnote — it is the exact cross-tenant exposure the tenancy work exists to prevent, reachable by a one-character mistake (`TRUE` → `FALSE`).

> **Finding C-5 (design-critical).** Also note that transaction-mode pooling **never** supports session-level advisory locks, `PREPARE`/`DEALLOCATE`, `LISTEN`, or temp tables, and Supavisor does not support prepared statements. Cloudflare's Hyperdrive independently does not support advisory locks or `LISTEN`/`NOTIFY`. **Any inventory or checkout design that reaches for a session-level advisory lock will fail on both poolers.** Hot-SKU contention must be solved with row locks, optimistic version columns, or sharded counters — not advisory locks.

#### Hyperdrive

| Property | Value |
|---|---|
| Origin connections maintained | **~100 per Hyperdrive configuration** (Paid), independent of Worker isolate count |
| Query cache | `max_age` default 60 s, `stale_while_revalidate` 15 s, `max_age` up to 3,600 s |
| **Write invalidation** | **None** — "does not purge or invalidate cached read query results when your application writes to your database" |
| Cost | included at no extra cost on Workers Paid |
| Cloudflare's Supabase guidance | use the **Direct** connection string, not Supavisor's pooled strings; use a real Postgres driver, not `supabase-js` |

> **Finding C-6.** Hyperdrive's ~100 origin connections is the single most favourable number in the stack: it decouples Worker concurrency from PostgreSQL connection count entirely. It is also the reason the Workers tier is not a bottleneck. **But its query cache does not invalidate on write** — so any read that must reflect a write (cart, inventory, order status, auth) requires a second `--caching-disabled` binding. Using one cached binding for everything would be a money bug.
>
> Note a live tension: Cloudflare recommends the **Direct** connection string (which draws on the 60→500 direct-connection budget), while Supabase's own scaling story is Supavisor (200→12,000 client slots). The current data-access layer uses neither — it uses the **PostgREST/`supabase-js` REST path**, which is a third option that Cloudflare's guidance explicitly advises against. Resolving this is a prerequisite for the tenancy work, because **PostgREST cannot issue `SET LOCAL ROLE`** — which is very likely the real reason `app_tenant` has no callers.

### 3.5 Observability as a load source

> **Finding C-7.** The observability middleware is mounted globally (`index.ts:655`) and **unconditionally inserts one `runtime_telemetry_metrics` row per request**, plus one `worker_request_logs` row for everything except anonymous storefront GET/HEAD (sampled at 2%).
>
> Consequence: **PostgreSQL write load scales with total request volume, not with commerce volume.** At Band A (100k online, ~1,787 origin RPS) that is ~1,787 telemetry inserts/second against a database whose Large tier sustains ~1,280 money-RPC transactions/second in total. **Telemetry would consume the entire write budget and then some, before a single order is placed.**
>
> This is the cheapest major fix in the packet: telemetry belongs in the already-declared and unused `RUNTIME_TELEMETRY` Analytics Engine dataset, not in the transactional database. The binding exists in production config today.

### 3.6 Queues and the outbox

| Property | Value | Class |
|---|---|---|
| Messages/second per queue | 5,000 | `HARD` |
| Concurrent consumer invocations | 250 | `HARD` |
| Batch | ≤100 messages, ≤60 s wait, ≤128 KB/message | `HARD` |
| Retries | ≤100; **without a DLQ, exhausted messages are deleted permanently** | `HARD` |
| Delivery | **at-least-once, explicitly unordered** | `HARD` |
| Pricing | $0.40/M operations; an operation = each 64 KB written, read, **or** deleted ⇒ ~3 ops per small message lifecycle, +1 read per retry | — |

**The outbox relay, not the queue, is the constraint:**

```
Relay throughput = 50 events/tick × 96 ticks/day (cron */15) = 4,800 events/day
Band G demand    = 1,000 orders/day × ~6–8 events/order      = 6,000–8,000 events/day

⇒ Deficit of 1,200–3,200 events/day AT THE TOP OF THE GOVERNED ENVELOPE.
⇒ outbox_events grows monotonically; event latency rises without bound past the 15-minute tick.
```

> **Finding C-8a — the write amplification behind it.** Migration `131:112-141` leaves **five `AFTER INSERT OR UPDATE OR DELETE … FOR EACH ROW` mirror triggers ENABLED** on the live hot tables `worker_request_logs`, `runtime_telemetry_metrics`, `outbox_events`, `platform_queue_jobs`, and `webhook_deliveries`. Each executes `mirror_hot_table_partition_shadow()` per row.
>
> **Every outbox write, every queue-job write, every webhook-delivery write, and — compounding §3.5 — every telemetry write is therefore doubled at the database.** The kill switch at `131:58` has zero callers, and migration `179`'s own header records that this shadow write once *"broke EVERY outbox write."*
>
> This is simultaneously a capacity finding and an `ART-23` constitutional violation (the Constitution requires the partition mirror **disabled**), and `scripts/validators/migration-safety-validator.mjs:132-141` **mandates** the surrounding machinery. See `15_ARB_AMENDMENT_PACKET.md` §4.2 — **it needs remediation, not an amendment.** Disabling the five triggers is the single highest-leverage database write reduction available, and it costs one migration.

> **Finding C-8.** The automatic outbox relay is under-provisioned **for the platform's own ratified target**, by roughly 1.3–1.7×. The fix is configuration (raise the cron frequency and/or the per-tick limit toward the RPC's 100-row cap, or move relay to a queue consumer), not architecture. Note the RPC hard-caps at 100 rows per claim, so the per-tick ceiling is 100 × 96 = 9,600/day without a cron change — meaning **the current setting uses half the available headroom.**

**Tenant fairness.** All four claim functions (`claim_outbox_events`, `claim_platform_queue_jobs`, `claim_webhook_deliveries`, `expire_inventory_reservations`) order strictly by arrival time with no `site_id` term and no per-site cap. One merchant's bulk import or flash sale starves every other merchant's order confirmations. At Band E this is the dominant tenant-visible failure.

### 3.7 Vercel

| Property | Value | Class |
|---|---|---|
| Concurrency ceiling | 30,000 (Hobby/Pro), 100,000 (Enterprise) | `HARD` |
| **Burst governor** | **1,000 concurrent executions per 10 seconds per region**; scaling "may take several minutes"; excess returns **503 `FUNCTION_THROTTLED`** — rejected, not queued | **HARD** |
| Payload | 4.5 MB request/response (`413 FUNCTION_PAYLOAD_TOO_LARGE`) | `HARD` |
| Custom domains per project | Pro "unlimited", abuse soft limit 100,000 | `SOFT` |
| **Domain provisioning rate** | **100 additions/hour/team; 50 verifications/hour/team** | `HARD` |
| Mumbai (bom1) compute | $0.140/Active-CPU-hour, $0.0116/GB-hr, $0.60/M invocations | — |
| ISR cache (bom1) | $4.40/M write units, $0.44/M read units (8 KB units); region fixed at build time | — |
| Stampede protection | **Automatic request collapsing** per region | — |

> **Finding C-9.** The 30,000 concurrency ceiling is irrelevant; the governor is **1,000 concurrent per 10 seconds per region**. A Diwali sale going 0 → 5,000 concurrent in 30 seconds has only 3 × 1,000 = 3,000 slots and the excess is **rejected with 503**. Because §3.3 established that ~100% of storefront traffic currently reaches a function, LetBuyy has no CDN buffer between a traffic spike and this governor. **Fixing the cache (C-2) is also the fix for this.**

> **Finding C-10 (business-timeline risk).** Custom-domain onboarding is capped at **100 additions/hour** and **50 verifications/hour** per team. Onboarding 10,000 merchant apex domains takes ~100 hours of continuous API calls to add and ~200 hours to verify — **over 8 days end-to-end, assuming zero retries.** The `*.letbuyy.com` wildcard consumes exactly one domain slot, so subdomain tenancy is free and instant; only merchant-supplied apex domains hit this wall. This is a `HUMAN-REQUIRED` commercial conversation with Vercel, not an engineering fix, and it should happen **before** custom domains are marketed as same-day.

---

## 4. The bottleneck order

Ranked by the load at which each binds. **The first four bind at or below the platform's own governed envelope.**

| Rank | Bottleneck | Binds at | Layer | Fix class | Constitutional authority |
|---|---|---|---|---|---|
| 1 | KV rate-limiter 1 write/s/key → 429 → isolate-wide 503 | **~2 concurrent req/key** | Cloudflare KV | Replace backend (sharded DO or CF Rate Limiting binding) | **Implementation** |
| 2 | No storefront HTML/fetch cache (~100% uncacheable) | every request | Next/Vercel + Worker | 3 small application fixes | **Implementation** |
| 3 | Telemetry writes 1–2 Postgres rows per request | ~request rate | PostgreSQL | Route to Analytics Engine (binding already exists) | **Implementation** |
| 4 | Outbox relay 4,800 events/day | ~600–800 orders/day | cron config | Raise cron/limit | **Implementation** |
| 5 | Vercel burst 1,000 concurrent/10 s/region → 503 | flash-sale onset | Vercel | Cache (same fix as #2) | Implementation |
| 6 | Hot-SKU row-lock serialisation (~1/lock-hold-time) | single-tenant flash sale | PostgreSQL | Admission control / sharded counters | Implementation |
| 7 | No tenant fairness in any claim path | one hot tenant | PostgreSQL | Per-site cap in claim RPCs | Implementation |
| 8 | Supavisor client slots (Large = 800) | ~2,000 req/s at 400 ms hold | Supabase | Shorter txns, bigger tier | Implementation |
| 9 | Direct connections plateau at 500 | ~Band B | Supabase | **Read replicas** | **Constitutional amendment** (§6 forbids read-replica-now) |
| 10 | Vercel domain provisioning 100/hour | 10k custom domains | Vercel | Commercial negotiation | `HUMAN-REQUIRED` |
| 11 | Single-primary write ceiling | ~Band C/D | PostgreSQL | Partitioning / sharding | **Constitutional amendment** |

> **Ranks 1–8 are all Class-C implementation work inside already-canonical systems.** Not one of them requires an ARB decision, a new runtime, a new service, or an amendment. This is the central practical conclusion of the capacity study.

---

## 5. Band-by-band verdict

| Band | Origin RPS (model) | Verdict **as currently configured** | Verdict **after ranks 1–8 are fixed** |
|---|---|---|---|
| **G** — governed envelope (10k merchants, 30k orders/mo) | ~7–20 | ❌ **NOT SERVED** — ranks 1–4 all bind at or below this | ✅ **Comfortable**, with large headroom |
| **A** — 100k online | ~1,787 (measured cache ⇒ ~5,300) | ❌ Not close | ✅ **Likely served** on one Large/XL PostgreSQL; needs a load test to confirm |
| **B** — 1M online | ~17,867 | ❌ | ⚠️ **Boundary.** Connection plateau (rank 9) and CPU bind. Read replicas — an amendment — become the first genuine topology question |
| **C** — 10M online | ~178,667 (or ~31,000 at 5% uncacheable) | ❌ | ❌ Requires ranks 9 + 11: read replicas **and** partitioning. **Constitutional amendment required** |
| **D** — 10M active | ~508,000 | ❌ | ❌ Exceeds single-PostgreSQL feasibility under any tuning. Effectively a new Constitution |
| **E** — hot-SKU skew | modest aggregate | ❌ | ⚠️ Needs rank 6 + rank 7 explicitly. **Occurs first in practice** and needs no amendment |

> **Finding C-11 — the answer to the founder's question.** Band C (10M simultaneously online) is reachable **only** with read replicas and partitioning, both of which the Constitution currently forbids (§6, Never-Build items 3 and 4) and both of which would require a Class-A amendment at a named, measured trigger. **But that conversation is premature by two orders of magnitude.** The system does not currently serve Band G. Fixing ranks 1–8 — all implementation-class, none requiring ARB approval — plausibly carries the platform to **Band A, roughly 100× its own ratified envelope**, which at the base-case conversion is on the order of **5 million orders per month**. That is very likely more headroom than the business needs for years.

---

## 6. Falsification

| Model claim | Falsifying measurement |
|---|---|
| KV limiter binds at ~2 concurrent req/key | Fire 10 concurrent requests sharing one rate-limit key against staging; observe 429s and the subsequent `503 RATE_LIMIT_UNAVAILABLE` window |
| Storefront cache hit ratio ≈ 0 | Request the same product page twice; inspect `x-vercel-cache` and Worker cache headers; count gateway invocations |
| Telemetry ≈ 1–2 DB writes/request | `pg_stat_statements` for `runtime_telemetry_metrics` / `worker_request_logs` inserts vs total request count |
| Outbox deficit at Band G | Synthesise 1,000 orders/day; measure `outbox_events` unrelayed depth over 72 h |
| Connection plateau | Load test at fixed RPS while stepping mean transaction duration; observe pool wait time |
| Hot-SKU ceiling ≈ 1/lock-hold | N concurrent reserves on one SKU; measure achieved throughput |
| Vercel burst 503s | Ramp 0 → 5,000 concurrent in 30 s against a staging deployment; count `FUNCTION_THROTTLED` |

Until these run, every figure above is `INFERRED` over `VERIFIED-SOURCE` inputs and documented vendor limits, and must be cited as such.
