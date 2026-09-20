# 10 — Vendor Limits and Costs (primary sources, accessed 2026-08-16)

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> Audited commit `5af69e0c080503765dec361eae2128ba860cf529` · branch `stepup/main` · 2026-08-16.

---

## 0. Conclusion first

1. **The single largest line item in the stack as currently configured is not compute, not the database, and not bandwidth — it is Cloudflare KV write charges from the rate limiter.** Every rate-limited `/v1` request performs 1 KV read + 1 KV **write** (`services/api-gateway/src/middleware/rateLimit.ts:321-325, 618-623`, `VERIFIED-SOURCE`). KV writes bill at **$5.00 per million** (`https://developers.cloudflare.com/kv/platform/pricing/`). At Band A that is **$22,995/month**. The documented remedy — Upstash Fixed 250 MB, unlimited commands — is **$10/month**. Ratio: **2,300×**.
2. **At every band above the governed envelope, the largest *vendor* cost is Vercel egress and edge requests, and caching does not reduce it.** Band B moves 1 PB/month: **$199,795 on Vercel bom1** ($0.20/GB after 1 TB), **$80,693 on AWS ap-south-1** (tiered from $0.1093/GB), **$0 on Cloudflare Workers/R2** ("No additional charges for data transfer (egress) or throughput"). Nothing else in this model has a spread of that size.
3. **Fixing the storefront cache saves far less on the Vercel bill than intuition suggests, and far more on Cloudflare and Supabase.** At Band A, hit ratio 0% → 99% moves Vercel by 3% ($31,800 → $30,783) because 97% of that bill is edge requests + egress; it moves Cloudflare by **5.5×** and Supabase from *not sizeable on the published ladder* to **$308/month**.
4. **Three limits bind below or at the governed envelope and are transcribed here as HARD from vendor text:** KV **1 write/second/key → HTTP 429**; KV **60-second-or-more** eventual consistency; Vercel **1,000 concurrent executions per 10 seconds per region → 503 `FUNCTION_THROTTLED`**, rejected not queued.
5. **Supabase vertical scaling is not a connection ladder.** Direct connections move **60 → 500** across $10 → $3,730/month and plateau at 500 from 12XL up; Supavisor client slots move 200 → 12,000. You buy cores, RAM and IOPS — not concurrency.
6. **AWS's floor bills whether or not anyone visits.** The minimum credible 2-AZ HA stack in ap-south-1 is **$333.60/month** ($393.65 with 18% IGST) before a single request; with a non-burstable `db.m6g.large` it is **$558.79** ($659.37). The managed stack's floor is **~$50–60/month**. On egress-plus-floor arithmetic alone the crossover is at **≈5.3 TB/month ≈ 10.6 M page views/month — essentially the top of Band G** — but that comparison excludes CloudFront (unpriced here) and excludes rebuilding RLS, auth, storage and realtime in application code.
7. **AWS is not a Cloudflare Bandwidth Alliance partner.** Fronting an AWS ap-south-1 origin with Cloudflare yields **zero** egress relief; every cache miss pays the full Mumbai rate, and NAT adds $0.056/GB on top.
8. **Indian GST is additive to every USD figure below.** Cloudflare has been GST-registered in India **since 2023-10-01** and bills by billing address; the rate it applies is **not stated on its tax page**. Vercel began collecting VAT/GST on invoices issued **on or after 2026-04-01**; rate not published. Supabase's indirect-tax rollout ran **2026-05-01 → 2026-06-30** and does not name India. Only **AWS India (AISPL)** publishes a number: **18% IGST** (9% CGST + 9% SGST in Delhi), invoiced in INR.

---

## 1. How to read this document

### 1.1 Provenance

Every value in §2–§4 was fetched from the vendor's own documentation or price list on **2026-08-16** and is transcribed from `evidence/21-vendor-digest.md`, which carries an independent fact-check pass per area. **No value here is from model memory.** Where the fact-check corrected a value, the corrected value is used and the correction is recorded in §1.4.

Evidence states used in this document:

| State | Applies to |
|---|---|
| `REFERENCE-ONLY` | A vendor's own published limit or price. The vendor asserted it on the date shown. It is not a contract, and it is not a measurement of LetBuyy. |
| `VERIFIED-SOURCE` / `VERIFIED-CONFIG` | LetBuyy implementation facts used as cost-model inputs, cited to `path:line` at this SHA. |
| `INFERRED` | Arithmetic over a vendor limit and a counted implementation cost. Falsifiable by the measurement named alongside. |
| `UNKNOWN` | Not published. The page that would settle it is named. |
| `HUMAN-REQUIRED` | Needs a quote, a support ticket, or a tax adviser. |

> **`VERIFIED-LIVE` appears zero times.** No provider account, invoice, dashboard, or database was accessed. **Nothing here establishes what LetBuyy is actually being billed, what tier it is actually on, or what is actually deployed** — see `04_LIVE_DEPLOYMENT_TRUTH.md`, items L-16 (actual Supabase compute tier), L-30/L-31 (actual secret state), L-34 (actual attached domain count). Every cost figure in §5 is a *model*, not an invoice.

### 1.2 Limit classes

| Class | Meaning |
|---|---|
| `HARD` | Vendor documents it as non-adjustable. Design around it. |
| `SOFT` | Adjustable via a documented limit-increase request. |
| `DEFAULT` | Configurable by the customer within a hard ceiling. |
| `NEGOTIABLE` | Plan-gated or contract-gated; price often unpublished. |
| `UNKNOWN` | No figure published. Absence of a documented cap is **not** a guarantee of no cap. |

### 1.3 Two widely-repeated figures that are REFUTED by current vendor text

| Claim in circulation | Verdict | Basis |
|---|---|---|
| Cloudflare Workers Free has a **burst limit of 1,000 requests/minute**, error 1015 / HTTP 429 | **REFUTED as current vendor text.** No "Burst rate" heading exists on the limits page; literal string searches for `burst`, `1,000 requests per minute` and `1015` all return nothing; the workers.dev routing page carries no rate-limit statement. A stale/removed limit surfacing from a search index. | `https://developers.cloudflare.com/workers/platform/limits/` |
| Cloudflare Turnstile caps **siteverify at 1 million/month** | **REFUTED.** The current plans page states "Unlimited challenges (traffic or verification requests)" on **both** Free and Enterprise. | `https://developers.cloudflare.com/turnstile/plans/` |

For Workers the correct planning posture is **`UNKNOWN`-by-design, not guaranteed-unlimited**: Cloudflare publishes no RPS or burst ceiling and no per-account concurrency figure. Do not model Free as burst-unlimited.

### 1.4 Corrections applied from the independent fact-check

| # | Subject | Claimed | **Corrected value used here** |
|---|---|---|---|
| 1 | R2 max object size | 5 TiB | **4.995 TiB** — footnote: "5 GiB less than 5 TiB" |
| 2 | R2 max single-part upload | 5 GiB | **4.995 GiB** — footnote: "5 MiB less than 5 GiB" |
| 3 | Supabase Nano tier | "Free plan only", implied $0 | **Nano can persist on a paid plan after a Free upgrade and is then billed at the Micro rate (~$10/mo), not $0.** A cost model assuming $0 understates. |
| 4 | Supabase per-size "Max IOPS / Max throughput" | Attainable ceilings | **Compute-side ceilings, not reachable on the default gp3 disk.** gp3 maxes at 16,000 IOPS / 1,000 MB/s / 16 TB; anything above needs io2 (1,000 IOPS per GB of disk) at extra cost. 8XL/12XL/16XL figures (40k/50k/80k IOPS) are unreachable on gp3. |
| 5 | `SET LOCAL` safety under transaction pooling | Cited to `pgbouncer.org/config.html` | **Conclusion correct, citation corrected.** The load-bearing proof is PostgreSQL's own `SET` page. `pgbouncer.org/features.html` lists "SET/RESET: Never" for transaction pooling — that refers to **session-level** `SET`; anyone re-deriving from the PgBouncer citation alone reaches the opposite conclusion. |
| 6 | Razorpay settlement "working days" | Excludes Sundays and 2nd/4th Saturdays | **Vendor docs say only "Working days do not include the bank holidays."** The weekend rule appears only in Razorpay marketing articles, not product docs. |
| 7 | Razorpay international settlement | T+7 default | **Not a documented default.** "as per applicable law(s)… view your settlement cycle on the Razorpay Dashboard". T+7 occurs only inside a worked example. |
| 8 | Razorpay HTTP 429 | Documented on `/docs/errors/common/` | **That page shows `BAD_REQUEST_ERROR` / "Too many requests" with no HTTP status.** 429 is documented on the Understand-Razorpay-APIs / pagination page. Core finding (no numeric limit published anywhere) confirmed. |
| 9 | Workers "startup CPU time" | 400 ms in some sources | **1 second, labelled "Worker startup time" on the current page.** The 400 ms figure is not current. |
| 10 | Cloudflare Error 1102 | CPU exhaustion | **1102 is shared with the memory limit** ("Exceeded Memory"); 1102 alone does not disambiguate CPU vs memory. Logpush outcome string for CPU is `exceededCpu`. |
| 11 | WhatsApp messaging tier 2 | 1,000 | **2,000.** The 1,000 figure is stale. |
| 12 | Supabase ARM cores | Cited to compute-and-disk page | True, but that page says only "2-core (shared)"; **ARM is supported by `supabase.com/pricing`.** |
| 13 | AWS Fargate 6-vCPU quota | `HARD` | **`SOFT`** — adjustable (L-3032A538) and auto-raised by AWS based on observed usage. |

### 1.5 Two unresolved vendor-doc conflicts

| Conflict | Positions | Planning number used |
|---|---|---|
| Vercel function regions on Pro | Region page (updated 2026-07-15): **5**. Fluid-compute page (2026-07-01): **"Up to 3"**. | Not load-bearing here (LetBuyy is single-region `bom1`). Verify before any multi-region plan. |
| Vercel domain-add rate limit | Multi-tenant limits page: **100 requests/hour/team**. Master rate-limit table: **"Domains creation per hour: 120"** and **"per minute: 100"**. | **~100/hour** |
| Supabase Team-plan SLA | Pricing page advertises "Priority email support & SLAs" for Team; `supabase.com/sla` scopes itself to "Enterprise Customers specified in an Order Form". | **No SLA below Enterprise.** `HUMAN-REQUIRED` to settle in writing. |

---

## 2. The load-bearing limits

These are the ones that decide LetBuyy's architecture. Each is transcribed verbatim-in-substance from the vendor page named.

| # | Limit | Value | Class | Why it is load-bearing here | URL |
|---|---|---|---|---|---|
| **L1** | **KV writes to the same key** | **1 per second; exceeding throws HTTP 429** — "Writes made to the same key within 1 second will cause rate limiting (429) errors to be thrown." Identical on Free and Paid. | `HARD` | LetBuyy routes production rate limiting to KV (`wrangler.toml` `RATE_LIMIT_KV_FALLBACK="on"`, `VERIFIED-CONFIG`) with a non-atomic read-then-write per request (`rateLimit.ts:321-325`, `VERIFIED-SOURCE`). Binds at ~2 concurrent requests sharing a key. | `kv/api/write-key-value-pairs/` |
| **L2** | **KV eventual consistency** | **"up to 60 seconds or more"** in other network locations. Negative caching also delays propagation. `cacheTtl` default 60 s, **minimum 30 s**. | `HARD` | Prices, inventory, gift-card balances, GST rates and session state must never be read from KV on the money path. A cache-version key breaks on a merchant's second save within one second. | `kv/concepts/how-kv-works/` |
| **L3** | **Hyperdrive origin connections** | **~100 per configuration (Paid)**, ~20 (Free). "Hyperdrive automatically manages the connection pool properties for you, including limiting the total number of connections to your origin database." Max 25 configs on Paid. | `SOFT` | Decouples Worker concurrency from Postgres connection count entirely — the single most favourable number in the stack. Production declares `[[env.production.hyperdrive]] id = 9e08563f…` (`VERIFIED-CONFIG`). | `hyperdrive/platform/limits/` |
| **L4** | **Hyperdrive cache does not invalidate on write** | "Hyperdrive **does not purge or invalidate** cached read query results when your application writes to your database." `max_age` default 60 s + `stale_while_revalidate` 15 s. | `HARD` | Any read that must reflect a write (cart, inventory, order status, auth) needs a **second `--caching-disabled` binding**. One cached binding for everything is a money bug. | `hyperdrive/configuration/query-caching/` |
| **L5** | **Hyperdrive / PgBouncer unsupported Postgres features** | Hyperdrive: **no** `PREPARE`/`DISCARD`/`DEALLOCATE`/`EXECUTE`, **no advisory locks**, **no `LISTEN`/`NOTIFY`**. PgBouncer transaction mode: SET/RESET, LISTEN, PREPARE/DEALLOCATE, temp tables, **session-level advisory locks** = "Never". Supavisor transaction mode "does not support prepared statements". | `HARD` | **Any inventory or checkout design reaching for a session-level advisory lock fails on both poolers.** Hot-SKU contention must be solved with row locks, optimistic version columns or sharded counters. | `hyperdrive/reference/supported-databases-and-features/`, `pgbouncer.org/features.html` |
| **L6** | **Supabase direct connections across the whole ladder** | **60 → 500**, plateauing at **500 from 12XL upward** (480 at 4XL, 490 at 8XL). Supavisor client slots 200 → 12,000. | `HARD` per tier | Scaling up buys cores, RAM and IOPS — essentially **not** backends. Beyond ~500 the only levers are pooling discipline, shorter transactions, and read replicas (Never-Build item 4). | `supabase.com/docs/guides/platform/compute-and-disk` |
| **L7** | **Supavisor client slots per tier** | Large **800**, XL **1,000**, 2XL **1,500**, 4XL **3,000**, 8XL **6,000**, 12XL **9,000**, 16XL **12,000**. Hard-coded per compute size; Supavisor and PgBouncer each get the tier's limit independently. | `HARD` | Little's Law: 2,000 req/s × 20 ms hold = 40 slots; 2,000 req/s × 400 ms hold = **800 slots = exactly the Large ceiling**. Latency degradation converts directly into connection exhaustion. | same |
| **L8** | **`SET LOCAL` is SAFE; `set_config(…, FALSE)` leaks the tenant** | PgBouncer transaction mode: "Server is released back to pool after transaction finishes." PostgreSQL: "The effects of SET LOCAL last only till the end of the current transaction, whether committed or not." **But** `server_reset_query` (`DISCARD ALL`) "is not used" in transaction pooling — so a session-scoped `SET` **persists on the pooled backend and is inherited by the next client**. | `HARD` | This is the exact cross-tenant exposure the `ART-08` tenancy work exists to prevent, reachable by changing `TRUE` → `FALSE`. Two silent traps: rolling back to an earlier savepoint clears the GUC; a `SECURITY DEFINER` function with its own `SET` clause discards the caller's `SET LOCAL` at exit. | `postgresql.org/docs/17/sql-set.html` + `pgbouncer.org/config.html` |
| **L9** | **Supabase disk-full → read-only** | Autoscale at **90%** utilisation, **+50%**, capped 200 GB/expansion and **4 modifications per rolling 24 h**. On full: project "will enter read-only mode", clients get `cannot execute INSERT in a read-only transaction`; clears only **below 95%**. | `HARD` | A **platform-wide write outage across every tenant at once**. Disk size includes WAL and system logs. One merchant's bulk import, or a lagging replica's WAL, can trigger it. | `supabase.com/docs/guides/platform/database-size` |
| **L10** | **Vercel burst governor** | **1,000 concurrent executions per 10 seconds, per region**; scaling "may take several minutes during traffic surges"; excess returns **503 `FUNCTION_THROTTLED`** — **no queueing documented**. The 30,000 ceiling is irrelevant by comparison. | `HARD` | A Diwali sale going 0 → 5,000 concurrent in 30 s has 3 × 1,000 = 3,000 slots; the rest is rejected. `07` §3.3 establishes ~100% of storefront traffic currently reaches a function, so there is no CDN buffer in front of this. | `vercel.com/docs/functions/concurrency-scaling` |
| **L11** | **Vercel domain provisioning rate** | **100 additions/hour/team**; **50 verifications/hour/team**; 100 removals/hour. Count limits are generous (Pro soft limit 100,000/project) and raisable; the **rate** limits are not documented as raisable. | `SOFT` (count) / `HARD`-in-practice (rate) | 10,000 merchant apex domains = ~100 h to add + ~200 h to verify = **8+ days**, zero retries. The `*.letbuyy.com` wildcard consumes exactly **one** slot, so subdomain tenancy is free and instant. | `vercel.com/docs/platforms/multi-tenant-platforms/limits` |
| **L12** | **Vercel ISR revalidation does not cross domains** | "On-demand revalidation applies to the domain and deployment where you trigger it, and **doesn't affect subdomains or other deployments**." Where it does apply, all regions converge **within 300 ms**. | `HARD` | LetBuyy serves `{store}.letbuyy.com` **and** custom domains from one project. Purging `shopA.letbuyy.com` does **not** purge `shopA.com`. The risk is **scope, not latency**. | `vercel.com/docs/incremental-static-regeneration` |
| **L13** | **Cloudflare Queues: at-least-once and unordered** | "Queues provides at least once delivery"; "Queues does **not** guarantee that messages will be delivered to a consumer in the same order in which they are published." No FIFO mode, no exactly-once option. Batches are all-or-nothing on retry by default. | `HARD` | Already satisfied by LetBuyy's mandatory `idempotency_key` + `ON CONFLICT` discipline. State machines must be **order-independent**, not merely idempotent. One poison message re-delivers up to 99 processed siblings unless per-message ack is used. | `queues/reference/delivery-guarantees/`, `…/how-queues-works/` |
| **L14** | **Durable Object per-object ceiling** | "An individual Object has a **soft limit of 1,000 requests per second**"; Rules page: ~500–1,000 rps for simple operations. Overload: "will, after attempting to queue them, return an overloaded error to the caller." Remedy: `Required DOs = total rps / per-DO capacity`. | `SOFT` | The correct KV-limiter replacement, **provided it is sharded by `idFromName(site_id)` from the outset**. LetBuyy already declares an unused `RUNTIME_COORDINATOR` namespace in production (`evidence/04-…`). Promoting that single object into a global limiter would serialise everything. | `durable-objects/reference/faq/` |
| **L15** | **No India data-residency anywhere in the Cloudflare stack** | Durable Object location hints: `apac`, `apac-ne`, `apac-se` only — **no India hint**, best-effort, and "Durable Objects do not currently change locations after they are created." Jurisdictions: **EU / US / FedRAMP only**. Customer Metadata Boundary: **US or EU only**. Regional Services *does* list India but is Enterprise-only and publicly unpriced. | `HARD` | A per-merchant DO created by a first request from outside India is pinned outside India permanently. If a DPDP/RBI localisation requirement lands, this is a **product gap, not a config change**. | `durable-objects/reference/data-location/`, `data-localization/region-support/` |

---

## 3. Limit tables

### 3.1 Cloudflare Workers

| Subject | Metric | Value | Plan/tier | Class | Conf. |
|---|---|---|---|---|---|
| Workers | Requests/day | 100,000/day (Free, hard cutoff, Error 1027, resets midnight UTC, per-route fail-open/fail-closed choice); **No limit** (Paid) | Free / Paid | `HARD` | high |
| Workers | Requests/second, burst | **No published limit** — "There is no general limit on requests per second." | both | `UNKNOWN` | medium |
| Workers | Per-account concurrency | **Not published.** No concurrency row exists. | both | `UNKNOWN` | high |
| Workers | CPU/HTTP invocation | 10 ms (Free); **5 min max on Paid, default 30 s**, via `limits.cpu_ms` up to 300,000 | Free / Paid | `DEFAULT` | high |
| Workers | CPU/cron invocation | 10 ms (Free); 30 s (<1 h interval), 15 min (≥1 h) | Paid | `HARD` | high |
| Workers | **CPU exhaustion behaviour** | **Error 1102 "Worker exceeded resource limits" returned to the client**; dashboard "Exceeded CPU Time Limits"; Logpush `exceededCpu`. Terminated, not throttled or queued. **No graceful degradation.** 1102 is shared with the memory limit. | all | `HARD` | high |
| Workers | Wall-clock duration | HTTP: no limit while the client is connected. Cron / DO alarm / queue consumer: 15 min. **Duration is not billed.** | both | `HARD` | high |
| Workers | Memory per isolate | **128 MB** — not raised by Paid | both | `HARD` | high |
| Workers | Startup time | **1 second** for top-level module evaluation | both | `HARD` | high |
| Workers | Subrequests/invocation | 50 (Free, hard); 10,000 (Paid), adjustable "up to 10M" | Free / Paid | `DEFAULT` | high |
| Workers | Internal-service subrequests (KV/R2/D1/service bindings) | 1,000 (Free); matches configured limit, default 10,000 (Paid) | Free / Paid | `DEFAULT` | high |
| Workers | **Simultaneous open outbound connections** | **6 per invocation**, identical Free and Paid, not raisable | both | `HARD` | high |
| Workers | Script size | 3 MB gz (Free) / 10 MB gz (Paid); 64 MB uncompressed | Free / Paid | `HARD` | high |
| Workers | Env vars per Worker | 64 (Free) / 128 (Paid); 5 KB each | Free / Paid | `HARD` | high |
| Workers | Workers per account | 100 (Free) / 500 (Paid) | Free / Paid | `SOFT` | high |
| Workers | Cold start | No millisecond figure published; qualitative only | all | `UNKNOWN` | high |
| Smart Placement | Eligibility | "may take up to 15 minutes to analyze"; requires "consistent traffic… from multiple locations"; **no numeric threshold**; fetch handlers only | — | `UNKNOWN` | high |

Production declares `[env.production.placement] mode = "smart"` (`services/api-gateway/wrangler.toml`, `VERIFIED-CONFIG`).

### 3.2 Cloudflare Queues

| Subject | Metric | Value | Class |
|---|---|---|---|
| Queues | Per-queue throughput | **5,000 messages/second** (≈432 M/day); overage → "Too Many Requests" | `HARD` |
| Queues | Queues per account | 10,000 — the sharding headroom | `HARD` |
| Queues | Per-queue backlog | **25 GB** (≈25 M messages at 1 KB); overage → "Storage Limit Exceeded" | `HARD` |
| Queues | Concurrent consumer invocations | **250** (`max_concurrency` 1–250); autoscaling on by default; will not scale up if `max_concurrency=1` or the consumer errors | `HARD` ceiling / `DEFAULT` value |
| Queues | Batch | ≤100 messages; `max_batch_timeout` ≤60 s; `sendBatch` ≤100 msgs or 256 KB | `HARD` |
| Queues | Message size | **128 KB** (incl. ~100 B metadata); **billed in 64 KB units**, so >64 KB costs 2× per action | `HARD` |
| Queues | Retries | ≤100 (ceiling); per-queue `max_retries` default 3. **Every retry bills as a read.** | `HARD` / `DEFAULT` |
| Queues | **Dead Letter Queue** | **"Without a DLQ configured, messages that reach the retry limit are deleted permanently."** DLQ messages with no active consumer are deleted after **4 days**. | `HARD` |
| Queues | Retention | ≤14 days (Paid); fixed 24 h (Free) | `DEFAULT` |
| Queues | Consumer duration | 15 min wall-clock (hard); CPU default 30 s → 5 min | `DEFAULT` |

> Silent permanent loss without a DLQ is unacceptable on a money path. Every money-adjacent queue needs an explicit DLQ **and the DLQ needs a consumer.** Drain rate = `max_concurrency × batch_size / batch_duration`; at 250 × 100 / 5 s = 5,000 msg/s (matching ingest), but at 100 ms of Postgres RPC per message processed serially a 100-message batch takes 10 s and drain halves to 2,500 msg/s.

### 3.3 Cloudflare Hyperdrive

| Subject | Metric | Value | Class |
|---|---|---|---|
| Hyperdrive | Pooling mode | **Transaction mode only.** "the client that executes the query communicates through a single connection for the duration of a transaction." | `HARD` |
| Hyperdrive | Origin connections per config | **~20 (Free) / ~100 (Paid)**; docs caveat that actual counts "may occasionally exceed" the stated limit | `SOFT` |
| Hyperdrive | Configs per account | 10 (Free) / **25 (Paid)** | `SOFT` |
| Hyperdrive | Pool placement | "in one or more regions closest to your origin database"; **20–30 ms** per query from a distant region vs **1–3 ms** local. Region not documented as user-selectable. | `HARD` |
| Hyperdrive | Query cache | `max_age` default **60 s**, `stale_while_revalidate` **15 s**, `max_age` max **3,600 s**. Only read-only queries using IMMUTABLE functions are cached; `NOW()`, `CURRENT_DATE`, `RANDOM()` are never cached. **No write invalidation** (L4). | `DEFAULT` |
| Hyperdrive | Timing | Max query 60 s; connect timeout 15 s; idle timeout 10 min; max cached response 50 MB | `HARD` |
| Hyperdrive | Supported | PostgreSQL 9.0–17.x; TLS `require`/`verify-ca`/`verify-full`; insecure blocked. **Unsupported:** SQL-level prepared-statement management, advisory locks, `LISTEN`/`NOTIFY`. | `HARD` |
| Hyperdrive + Supabase | Vendor guidance | **"you should use the Direct connection connection string rather than the pooled connection strings"** and **"use a driver like node-postgres (pg) or Postgres.js… instead of the Supabase JavaScript client."** | `HARD` |

> **Consequence for LetBuyy, `INFERRED` over `VERIFIED-SOURCE`.** The canonical money path is `db.rpc` through `supabase-js` / `getSupabaseAdmin` (115 files) — PostgREST over HTTPS — which **does not traverse Hyperdrive** and receives none of this pooling or caching. Storefront reads *do* traverse it: `STOREFRONT_POOLED_SQL = "on"` (`wrangler.toml`, `VERIFIED-CONFIG`) with `max: options.maxConnections ?? 5` per isolate (`packages/infrastructure/pooled-sql-adapter/index.ts:52`, `VERIFIED-SOURCE`). So the stack runs **two different data paths with two different connection ceilings**, and only one of them is the one Cloudflare documents. Resolving which path carries which traffic is a prerequisite before any connection arithmetic is trusted — see `07` §3.4.

### 3.4 Cloudflare Workers KV

| Subject | Metric | Value | Class |
|---|---|---|---|
| KV | **Writes to the same key** | **1/second → HTTP 429.** Identical Free and Paid. Not documented as raisable. | `HARD` |
| KV | Consistency | "up to 60 seconds **or more**"; negative caching also delays propagation | `HARD` |
| KV | `cacheTtl` | min **30 s**, default 60 s, max `Number.MAX_SAFE_INTEGER` | `DEFAULT` |
| KV | Value / key / metadata size | 25 MiB / 512 B / 1,024 B | `HARD` |
| KV | Namespaces per account | **1,000** — caps a namespace-per-tenant design at 1,000 merchants; no limit-increase notice on the page | `HARD` |
| KV | Operations per Worker invocation | **1,000, shared with R2 and other external subrequests** | `HARD` |
| KV | `list()` per call | 1,000 keys (also the max); check `list_complete`, not an empty array | `HARD` |
| KV | Free daily caps | 100,000 reads/day; 1,000 writes/day; 1,000 deletes/day; 1,000 lists/day — **separate buckets**, reset 00:00 UTC | `HARD` |
| KV | Vendor guidance | For "read-heavy, highly cacheable workloads". **Not for** "applications where you need support for atomic operations or where values must be read and written in a single transaction", nor for updating the same key "tens or hundreds of times per second". | — |

### 3.5 Cloudflare R2

| Subject | Metric | Value | Class |
|---|---|---|---|
| R2 | Max object size | **4.995 TiB** *(corrected — table says 5 TiB, footnote says "5 GiB less than 5 TiB")* | `HARD` |
| R2 | Max single-part upload | **4.995 GiB** *(corrected)*; multipart 4.995 TiB; **10,000 parts max** | `HARD` |
| R2 | **Concurrent writes to the same key** | **1/second → HTTP 429.** Mirrors KV. Object *reads* are not documented as rate-limited. | `HARD` |
| R2 | Per-bucket / per-prefix object request rate | **Not published.** Only: bucket *management* ops 50/s; `r2.dev` throttles at "hundreds of requests/second"; REST API 1,200 per 5 min account-wide. **Do not assume S3-style 3,500 PUT / 5,500 GET per prefix.** | `UNKNOWN` |
| R2 | Buckets per account | 1,000,000 — bucket-per-merchant is viable | `HARD` |
| R2 | Custom domains per bucket | **100** — the binding constraint if merchants want their own media domain on a shared bucket | `HARD` |
| R2 | Key length / metadata | 1,024 B / 8,192 B; objects and data per bucket unlimited | `HARD` |
| R2 | **Egress** | **$0** — "Egressing directly from R2, including via the Workers API, S3 API, and r2.dev domains does not incur data transfer (egress) charges and is free." Both storage classes. | `HARD` |
| R2 | Infrequent Access | 30-day minimum billed duration; **$0.01/GB retrieval fee**; Class A/B ops cost 2–2.5× Standard | `HARD` |
| R2 | Lifecycle rules | 1,000 per bucket | `HARD` |
| R2 | Billing rounding | "Cloudflare rounds up your usage to the next billing unit." | `HARD` |
| Images | Source file size / dimensions / megapixels / formats | **Not published.** `/images/platform/limits/` returns 404. **Do not assume any cap.** | `UNKNOWN` |
| Images + R2 | Source authorisation | R2 origin must be added under Images → Transformations → **Sources**; **adding a root domain does NOT authorise its subdomains** — a direct footgun for `{store}.letbuyy.com` and per-merchant custom domains | `DEFAULT` |

Production declares `R2_BUCKET = letbuyy-media-production` and `ASSET_PUBLIC_BASE_URL = "https://cdn.letbuyy.com"` (`wrangler.toml`, `VERIFIED-CONFIG`).

### 3.6 Cloudflare D1

| Subject | Metric | Value | Class |
|---|---|---|---|
| D1 | Max database size | **10 GB** (Paid) / 500 MB (Free). No release note through 2026-08-16 raises it. | `HARD` |
| D1 | Databases / storage per account | 50,000 databases; 1 TB (Paid, raised from 250 GB on 2025-07-01) | `HARD` |
| D1 | **Write throughput** | **Not published anywhere.** Architecturally SQLite on a single primary Durable Object with one open write transaction at a time. Only defensible planning number: **the ~1,000 rps single-DO soft limit**. | `UNKNOWN` |
| D1 | Concurrency | 1,000 queries/invocation (Paid) / 50 (Free); **6 simultaneous D1 connections per invocation**; 30 s max query; 100 KB statement; 100 bound params; 100 columns/table; 2 MB row | `HARD` |
| D1 | Interactive transactions | **None.** No `BEGIN TRANSACTION`. | `HARD` |
| D1 | Read replication | **Public beta** (2025-04-10), no GA found. One replica per region incl. APAC (no India region). Free. Sequential consistency only via the Sessions API + bookmarks; **Sessions is binding-only, not REST**. Scales reads only. Disabling takes up to 24 h. | `DEFAULT` |
| D1 | Backups | Time Travel, always on, **any minute within 30 days** (Paid) / 7 days (Free), no extra cost. Restore is destructive and in-place. | `HARD` |
| D1 | India jurisdiction | Per-database jurisdiction announced 2025-11-05 but **options not enumerated**; DO jurisdiction list (EU/US/FedRAMP) has no India entry. | `UNKNOWN` |

> Production declares `RUNTIME_DB` (`database_id 76d197a5-d1cf-48a3-a363-4201ed1ca490`). `evidence/04-…` establishes **two references in the entire codebase** — a type declaration and a `Boolean()` presence check. **D1 stores nothing**; it is not a second data authority, and it is not a cost line beyond its own existence.

### 3.7 Cloudflare Durable Objects

| Subject | Metric | Value | Class |
|---|---|---|---|
| DO | **Requests/second per single object** | **~1,000 soft limit**; ~500–1,000 for simple ops. Single-threaded, cooperatively multi-tasked. | `SOFT` |
| DO | Overload behaviour | Requests **queue first (latency), then return an overloaded error**. Not graceful. | `HARD` |
| DO | Sharding | `Required DOs = total rps / per-DO capacity`. Object count unlimited. **"A common mistake is using a Durable Object for global rate limiting or global counters."** | `SOFT` |
| DO | Storage per object | 10 GB (SQLite backend); per account unlimited (Paid) / 5 GB (Free) | `HARD` |
| DO | Backend | **SQLite is the recommended and effectively only backend for new namespaces.** KV-backed namespaces can no longer be created without an existing one. | `HARD` |
| DO | SQL/KV sizes | key+value ≤2 MB; 100 columns/table; 100 KB statement; 100 bound params; 50 B LIKE/GLOB pattern | `HARD` |
| DO | CPU / connections | 30 s default CPU per request (→5 min), reset by each incoming request; >30 s between requests raises eviction risk. **6 simultaneous outgoing connections.** | `DEFAULT` |
| DO | Classes per account | 500 (Paid) / 100 (Free) — instances unlimited | `SOFT` |
| DO | Alarms | **One alarm per object at a time.** At-least-once, exponential backoff from 2 s, ≤6 retries, 15 min handler wall time. Alarm invocations are billable requests. | `HARD` |
| DO | WebSockets | Hibernation removes duration charges while idle; received message ≤32 MiB. **Max concurrent connections per object: not documented.** | `HARD` / `UNKNOWN` |
| DO | Global uniqueness caveat | Uniqueness holds **while the object is touching storage**; after an event, if execution takes time without accessing storage, "some other instance of the same Durable Object ID will have been created elsewhere." Code rollouts are eventually consistent — newer Workers may call older DO versions. | `HARD` |
| DO | Idle-eviction timeout | Not published (only "up to 15 minutes per connection" for objects holding outbound connections). **The main uncertainty in the GB-s cost model.** | `UNKNOWN` |

### 3.8 Cloudflare platform (WAF, bots, SLA, India)

| Subject | Metric | Value | Class |
|---|---|---|---|
| Rate limiting rules | Count | Free **1**, Pro **2**, Business **5**, Enterprise **100** | `HARD` |
| Rate limiting rules | Counting characteristics | Free/Pro **IP only**; Business IP + IP-with-NAT; **Enterprise Advanced Rate Limiting** adds Query, Host, **Headers, Cookie, ASN, Country, Path, JA3/JA4, JSON field, Body, Form input, Custom** | `HARD` |
| Rate limiting rules | Period / mitigation timeout | Free 10 s / 10 s; Pro ≤1 min / ≤1 h; Business ≤10 min / ≤1 day; Enterprise ≤65,535 s / ≤1 day | `HARD` |
| Rate limiting rules | Min/max requests-per-period thresholds | **Not published per plan** | `UNKNOWN` |
| WAF managed rules | Availability | Free ruleset only on Free; Cloudflare Managed + OWASP from Pro; **Sensitive Data Detection Enterprise-only** | `HARD` |
| Bots | Availability | Bot Fight Mode (Free, cannot be skipped/bypassed — a documented false-positive risk for payment-processor and monitoring callbacks); Super Bot Fight Mode included Pro/Business/Enterprise; Bot Management = Enterprise add-on, **price unpublished** | `NEGOTIABLE` |
| SLA | Uptime | Free: none. Pro: none. **Business: 100% with 1× service credits. Enterprise: 100% with 10×/25×.** Credits are the remedy, not a technical guarantee; claims within 5 business days. No product-specific Workers/Queues/Hyperdrive SLA was found. | `NEGOTIABLE` |
| Network | India PoPs | ~2 dozen Indian cities within "348 cities · 8 regions". **No user-selectable ap-south Workers region** — placement is nearest-eyeball or Smart Placement near the origin. | `UNKNOWN` (city list medium confidence) |
| Billing | India GST | **"Cloudflare Inc. is registered for Goods and Services Tax (GST) purposes in India as of October 1st, 2023."** Tax collected by billing address. **Rate not stated.** GSTIN **cannot be applied retroactively** — it applies only to future invoices and may take a full billing period to appear. Indian cards require RBI-mandated 3D Secure to be saved. | `HARD` (registration) / `UNKNOWN` (rate) |

> **Per-tenant rate limiting (per `site_id`, per store subdomain, per customer cookie) requires header/cookie/JSON-field/path counting — Enterprise Advanced Rate Limiting only.** Business gives 5 rules and custom counting expressions but only IP-family counting characteristics, which cannot express per-merchant fairness. For a platform whose login, OTP and checkout endpoints are the abuse surface, **security tiering forces a plan upgrade earlier than cost does.**

### 3.9 Vercel platform

| Subject | Metric | Value | Plan | Class |
|---|---|---|---|---|
| Functions | Concurrency ceiling | 30,000 (Hobby, Pro); 100,000 — stated elsewhere as "100,000+" (Enterprise, extended concurrency purchasable) | — | `NEGOTIABLE` |
| Functions | **Burst ramp** | **1,000 concurrent per 10 s per region**; "may take several minutes" | all | `HARD` |
| Functions | Exhaustion | **503 `FUNCTION_THROTTLED`**, no queueing documented | all | `HARD` |
| Functions | Memory / vCPU | 2 GB / 1 vCPU default and max (Hobby); 2 GB / 1 vCPU default, **4 GB / 2 vCPU max** (Pro/Ent) | — | `HARD` |
| Functions | Max duration (Node/Fluid) | 300 s default & max (Hobby); 300 s default, **800 s max**, 1800 s extended (beta, per-function) (Pro/Ent). Timeout → 504 `FUNCTION_INVOCATION_TIMEOUT`. | — | `HARD` |
| Functions | Edge runtime | Must begin responding within **25 s**; may stream up to **300 s** | all | `HARD` |
| Functions | **Payload** | **4.5 MB** request *or* response → 413 `FUNCTION_PAYLOAD_TOO_LARGE`. Bulk product/CSV import must bypass functions. | all | `HARD` |
| Functions | **File descriptors** | **1,024 shared across all concurrent executions on an instance**, including the runtime's own. Includes TCP sockets and DB connections. | all | `HARD` |
| Functions | Bundle | 250 MB uncompressed (AWS-enforced); 5 GB with Large Functions + Fluid + Active CPU | all | `HARD` |
| Functions | Regions | Hobby single; **Pro 5** *(conflicts with "Up to 3" on the Fluid page)*; Enterprise all. Deploying to more regions than the plan allows **fails before the build step**. | — | `HARD` |
| Functions | Cross-region failover | **Enterprise only** (`functionFailoverRegions`, ≤4). AZ redundancy within a region is default on all plans. **On Pro, a `bom1` outage is a total storefront outage.** | Ent | `HARD` |
| Regions | Mumbai | **`bom1` = ap-south-1**, one of 20 compute-capable regions behind ~126 PoPs. New projects default to `iad1`. | all | `DEFAULT` |
| Domains | Per project | Hobby 50; Pro unlimited (abuse soft limit **100,000**); Enterprise soft limit 1,000,000. "flexible and can be increased upon request." | — | `SOFT` |
| Domains | Wildcard | Supported on all plans; requires Vercel nameservers for wildcard SSL. **A wildcard consumes exactly one domain slot.** | all | `HARD` |
| Multi-tenant | Preview URLs, custom SSL upload | **Enterprise only** on every plan row | Ent | `HARD` |
| ISR | Revalidation scope | Domain + deployment only; **does not affect subdomains or other deployments** | all | `HARD` |
| ISR | Purge propagation | "all caches across all regions update **within 300ms**"; HTML and data payloads purged atomically | all | `HARD` |
| ISR | Storage | **"There is no limit on storage for ISR."** Evicted if unaccessed for **31 days**. Scoped per deployment — each new deployment gets a fresh cache. | all | `HARD` |
| ISR | Unit size | **1 read unit = 8 KB read; 1 write unit = 8 KB written.** CDN cache reads/writes are free. **"When revalidation runs and the content hasn't changed from the previous version, no ISR write units are incurred."** | all | `HARD` |
| ISR | Cache region | Fixed **at build time** from the project's default Function region; with multiple regions the most cost-optimal wins (`iad1` always wins if present). **Pinning `bom1` pins ISR to bom1's higher rates.** | all | `DEFAULT` |
| ISR | Failed revalidation | Stale content continues to be served; 30-second retry TTL | all | `HARD` |
| CDN | **Request collapsing** | N concurrent requests to the same uncached path collapse to **one function invocation per region** (documented example: 1,000 → 1). Also applies to STALE/SWR revalidation. **ISR and Image Optimization only — NOT dynamic routes.** Per-region, so up to 20 invocations globally. | all, default on | `DEFAULT` |
| Runtime Cache | Limits | Item 2 MB; 128 tags/item; tag ≤256 B. Regional, ephemeral, LRU. **Total storage limit not published.** | all | `HARD` / `UNKNOWN` |
| Image Optimization | Limits | Transformed image ≤10 MB; source ≤8192×8192; source must be jpeg/png/webp/avif. **Transformations bill on every cache MISS and STALE.** | all | `HARD` |
| Builds | Time per deployment | **45 minutes on Hobby, Pro AND Enterprise** — not raisable on any plan | all | `HARD` |
| Builds | Concurrency / machines | Pro up to 500 concurrent (3 without on-demand); Elastic 4–30 vCPU default for new paid teams | — | `SOFT` |
| Deployments | Rate | Pro 6,000/day, 450/h, 120/5 min | — | `SOFT` |
| Platform | Routes per deployment | 2,048 (Hobby/Pro) — counts every rewrite, redirect, header rule **and Next-generated dynamic route** | — | `SOFT` |
| Proxied requests | Timeout | **120 s** → `ROUTER_EXTERNAL_TARGET_ERROR`. Relevant if a Next app rewrites to `services/api-gateway`. | all | `HARD` |
| Logs | Retention | **1 hour (Hobby), 1 day (Pro), 3 days (Enterprise).** Build logs indefinite. **1 day is thin for payment-incident forensics** — Drains at $0.50/GB are the alternative. | — | `HARD` |
| Middleware / proxy | CPU | ≤50 ms **average** net CPU. In Next 16 middleware is renamed **proxy**, runs **nodejs only**, and the edge runtime is not supported in proxy. | all | `SOFT` |
| SLA | Uptime | **99.99% Enterprise only**, "commercially reasonable effort". Credits 10%/25%/50%; aggregate capped at **50% of the month's fee**; 30-day written claim. Excludes API/CLI and Beta products. **No SLA on Hobby or Pro.** | Ent | `NEGOTIABLE` |
| Status | Observed | All systems operational 2026-08-16; CDN 99.99% over 90 days; most regional DCs 100%. **Observed history, not a guarantee. `bom1`'s individual figure was not captured.** | — | `UNKNOWN` |

### 3.10 Next.js 16 caching semantics

Repo pins **`next@16.1.6`** (`apps/storefront-runtime/package.json:29`, `VERIFIED-SOURCE`); nextjs.org currently documents 16.3.1. Everything attributed to 16.0.0 below is safe on 16.1.6.

| Subject | Value | Class |
|---|---|---|
| `fetch` default | **"By default, fetch requests are not cached."** Opt in with `cache: 'force-cache'`. Route defaults `dynamic='auto'`, `revalidate=false`. | `DEFAULT` |
| `cacheComponents` | Introduced 16.0.0, **not enabled by default**. Unifies and replaces `ppr`, `useCache`, `dynamicIO`. Requires the Node runtime. | `DEFAULT` |
| **PPR** | `experimental.ppr` and `experimental_ppr` are **REMOVED in 16**. "cacheComponents implements Partial Prerendering (PPR) as the default behavior in the App Router." **PPR is available only via `cacheComponents`.** | `HARD` |
| `cacheLife` presets | `default` 5min/15min/never · `seconds` 30s/1s/1min · `minutes` 5min/1min/1h · `hours` 5min/1h/1day · `days` 5min/1day/1week · `weeks` 5min/1week/30days · `max` 5min/30days/1year. Client router enforces a **30-second minimum stale time**. | `DEFAULT` |
| `revalidateTag` | Now `revalidateTag(tag, profile)` — **second argument required**, single-arg deprecated. Tag ≤256 chars. Server Functions and Route Handlers only. **Invalidation is lazy** — "fresh data is only fetched when pages using that tag are next visited", so it does not trigger a revalidation storm. | `HARD` |
| `updateTag` | **Server Actions only** (throws in Route Handlers). Immediately expires; the next request waits for fresh data. **The correct primitive for read-your-own-writes after a price/inventory mutation.** | `HARD` |
| `'use cache'` on serverless | With the default in-memory handler, "cache entries typically don't persist across requests… or during revalidation." **Cache key includes the build/deployment ID — nothing survives a deploy.** `'use cache: remote'` maps to Vercel Runtime Cache and bills at those rates plus a network round trip. | `HARD` |
| Runtime requirements | Node ≥20.9.0, TS ≥5.1.0, Chrome/Edge/Firefox 111+, Safari 16.4+. **Turbopack is the default for `next dev` AND `next build`; a project with a custom webpack config FAILS `next build` unless run with `--webpack`.** | `HARD` |
| `next/image` defaults | `minimumCacheTTL` **60 s → 4 hours (14400 s)**; `qualities` narrowed to `[75]`; `16` removed from default `imageSizes`; `maximumRedirects` default 3. **The 4-hour TTL materially reduces Vercel Image Transformation charges versus Next 15.** | `DEFAULT` |
| Tag propagation latency | **Next.js publishes none.** The 300 ms figure is Vercel's **ISR** purge guarantee; whether it covers Data Cache / Runtime Cache tag invalidation is not stated. | `UNKNOWN` |

> **Applied to this repo (`VERIFIED-SOURCE`).** No LetBuyy app sets `cacheComponents`, so PPR is off repo-wide and the apps are on the previous model (route-segment config + fetch cache). `revalidateTag` appears **zero times** across `apps/`, `services/`, `packages/` — so the `tags` argument passed by `storefrontReadInit` is inert. Both `apps/storefront-runtime/next.config.ts` and `apps/merchant-control-plane/next.config.ts` carry custom webpack configs, which under Next 16's Turbopack default is a build-failure condition unless `--webpack` is passed — **verify the CI build command explicitly.**

### 3.11 Supabase compute ladder

Prices are the **compute add-on per project**, additional to the organization plan fee. Direct connections and pooler client slots are **hard-coded per size**.

| Size | vCPU / RAM | Direct conns | Supavisor clients | Baseline → max IOPS | Baseline → max MB/s | Max DB | Repl. slots | $/hr | ~$/mo |
|---|---|---|---|---|---|---|---|---|---|
| Nano | shared / 0.5 GB | 60 | 200 | 250 → 11,800 | 5 → 261 | 500 MB | 5 | $0 (Free) | **$0 on Free; billed at Micro rate on a paid plan** *(corrected)* |
| Micro | 2-core shared / 1 GB | 60 | 200 | 500 → 11,800 | 11 → 261 | 10 GB | 5 | 0.01344 | ~10 |
| Small | 2-core shared / 2 GB | 90 | 400 | 1,000 → 11,800 | 22 → 261 | 50 GB | 5 | 0.0206 | ~15 |
| Medium | 2-core shared / 4 GB | 120 | 600 | 2,000 → 11,800 | 43 → 261 | 100 GB | 5 | 0.0822 | ~60 |
| **Large** | **2-core DEDICATED** / 8 GB | 160 | 800 | 3,600 → 20,000 | 79 → 594 | 200 GB | 8 | 0.1517 | ~110–111 |
| XL | 4-core / 16 GB | 240 | 1,000 | 6,000 → 20,000 | 149 → 594 | 500 GB | 24 | 0.2877 | ~210 |
| 2XL | 8-core / 32 GB | 380 | 1,500 | 12,000 → 20,000 | 297 → 594 | 1 TB | 80 | 0.562 | ~410 |
| 4XL | 16-core / 64 GB | **480** | 3,000 | 20,000 → 20,000 | 594 | 2 TB | 80 | 1.32 | ~960 |
| 8XL | 32-core / 128 GB | **490** | 6,000 | 40,000 † | 1,188 † | 4 TB | 80 | 2.562 | ~1,870 |
| 12XL | 48-core / 192 GB | **500** | 9,000 | 50,000 † | 1,781 † | 6 TB | 80 | 3.836 | ~2,800 |
| 16XL | 64-core / 256 GB | **500** | 12,000 | 80,000 † | 2,375 † | 10 TB | 80 | 5.12 | ~3,730 |

† *(corrected)* **Compute-side ceilings, not reachable on the default gp3 disk** (gp3 max 16,000 IOPS / 1,000 MB/s / 16 TB). Anything above requires **io2**, which scales at 1,000 IOPS per GB of disk, at additional cost. Above 16XL: "Instances larger than 16XL require contacting sales" (`NEGOTIABLE`).

`HARD`, all rows. Source: `https://supabase.com/docs/guides/platform/compute-and-disk`, accessed 2026-08-16.

> **The non-linearity that matters.** Direct connections move **60 → 500** across the whole ladder and plateau; pooler clients move **200 → 12,000**. Large is the first **dedicated-core** tier — the first size with predictable latency. `max_connections` is configurable via the CLI but Supabase's own guidance is not to: each direct connection is a forked OS process consuming memory that would otherwise be Postgres cache, and hard-coding it stops it tracking compute resizes. **Supavisor's max pooler clients cannot be raised at all without upgrading compute.**

### 3.12 Supavisor / PgBouncer / PostgreSQL 17

| Subject | Value | Class |
|---|---|---|
| Supavisor ports | **Transaction mode = 6543** ("ideal for serverless or edge functions"); **session mode = 5432** ("only recommended as an alternative to a Direct Connection when connecting from an IPv4-only network"). Supavisor is IPv4-only on every tier. | `HARD` |
| Supavisor prepared statements | **"Transaction mode does not support prepared statements. To avoid errors, turn off prepared statements for your connection library."** | `HARD` |
| Supavisor pool size | Shared across ports 5432 and 6543. Guidance: with heavy PostgREST use, **do not raise pool size past 40% of Database Max Connections**. Pool is per database/role/mode combination; **Supabase Storage also consumes a pool**. **The numeric default is not published.** | `DEFAULT` / `UNKNOWN` |
| Dedicated Pooler (PgBouncer) | Paid plans; co-located with Postgres; IPv6 (or IPv4 with the add-on); **transaction mode only**; **consumes the project's own compute**. Max-pooler-client limits apply **independently per pooler**. | `HARD` |
| PgBouncer transaction mode | "Server is released back to pool **after transaction finishes**" (contrast statement mode: "after query finishes"). | `HARD` |
| **`server_reset_query` in transaction pooling** | **"When transaction pooling is used, the server_reset_query is not used, because in that mode, clients must not use any session-based features."** → a session-scoped `set_config(…, FALSE)` or bare `SET` **persists on the pooled backend and leaks to the next client**. | `HARD` |
| PgBouncer feature map (transaction pooling) | **Never:** SET/RESET (session-level), LISTEN, PREPARE/DEALLOCATE, PRESERVE/DELETE ROWS temp tables, LOAD, **session-level advisory locks**. **Yes:** NOTIFY, WITHOUT HOLD cursors, protocol-level prepared plans. | `HARD` |
| PostgreSQL `SET LOCAL` | "The effects of SET LOCAL last only till the end of the current transaction, whether committed or not." `set_config` "provides equivalent functionality." **Traps:** (a) rolling back to a savepoint earlier than the command **cancels** it; (b) `SET LOCAL` inside a function that has its own `SET` clause **disappears at function exit**; (c) outside a transaction block it "emits a warning and otherwise has no effect". | `HARD` |
| PostgREST reference implementation | Wraps each request `START TRANSACTION; <settings>; <query>; END;` with transaction-scoped settings written via `set_config(…, true)`. **This is exactly LetBuyy's planned pattern, running behind a transaction-mode pooler at high concurrency — strong corroboration that the pattern is production-safe.** | `HARD` |
| Postgres process model | "it starts ('forks') a new process for each connection." **Architectural root cause of the connection ceiling — not a tunable.** | `HARD` |
| `max_connections` | Default typically 100; **settable only at server start** (a restart = a downtime event); PostgreSQL sizes shared memory directly from it. `superuser_reserved_connections` 3. | `DEFAULT` |
| Memory | `work_mem` 4 MB default and is **per operation**: "several running sessions could be doing such operations concurrently. Therefore, the total memory used could be many times the value of work_mem." `shared_buffers` 128 MB default; guidance 25% of RAM, "unlikely that… more than 40% of RAM… will work better". | `DEFAULT` |
| **RLS evaluation order** | Policy expressions are **"evaluated for each row prior to any conditions or functions coming from the user's query"** — except leakproof functions. Referential-integrity checks always bypass RLS. Table owners bypass unless `FORCE ROW LEVEL SECURITY`. | `HARD` |
| RLS cross-table cost | Consulting other tables in a policy "can create race conditions that could allow information leakage" and "heavy concurrent use of row share locks on the referenced table could pose a performance problem". **A policy that joins to `sites` takes a row share lock on `sites` on every query across all tenants — on a table merchants also update.** | `HARD` |
| Supabase RLS optimisations | Index policy columns (**99.94%** improvement in Supabase's own benchmark); wrap functions as `(select …)` to force a cached initPlan (**94.97–99.993%**); `TO authenticated` (**99.78%**); minimise joins (**up to 99.78%**); duplicate the filter client-side (**94.74%**). | `SOFT` |
| `FOR UPDATE` | Blocks other writers/lockers **until the current transaction ends**, and the waiter blocks for the **full remaining duration** of the holder's transaction. **`SELECT FOR UPDATE` is a WRITE — it marks rows and consumes IOPS**, even when nothing is ultimately updated. `FOR NO KEY UPDATE` is the weaker lock that does not block FK checks. | `HARD` |
| Autovacuum defaults | `scale_factor` **0.2** (+50 tuple threshold), 3 max workers, 1 min naptime, `analyze_scale_factor` 0.1, `freeze_max_age` 200 M. **A 50 M-row orders table waits for ~10 M dead tuples before vacuuming.** | `DEFAULT` |
| Vacuum blockers | Long-running open transactions (`pg_stat_activity.backend_xmin`), old prepared transactions (`pg_prepared_xacts`), **old replication slots (`pg_replication_slots`)**. **A lagging read replica holds back `xmin` on the PRIMARY, blocks reclamation, and grows primary disk — feeding the disk-full read-only cliff (L9).** | `HARD` |
| Partitioning rule of thumb | "a rule of thumb is that the size of the table should exceed the physical memory of the database server." **On Large (8 GB) ≈ 8 M orders at ~1 KB/row; on 4XL (64 GB) ≈ 64 M.** | `SOFT` |
| Partition count | Planner handles "up to a few thousand partitions"; "each partition requires its metadata to be loaded into the local memory of each session that touches it"; "Never just assume that more partitions are better." **Decisive against partition-per-tenant: 10,000 merchants = 10,000 partitions.** Partition by `created_at` RANGE, never by tenant. | `SOFT` |
| Structural limits | Relation 32 TB; columns/table 1,600; field 1 GB; relations/database 1,431,650,303; columns/index 32; partition keys 32; identifier 63 B; query parameters 65,535. **No table-size threshold at which operations "degrade" is published** — degradation is documented indirectly via the partitioning rule of thumb. | `HARD` |

### 3.13 Supabase disk, backups, replicas, egress, regions

| Subject | Value | Class |
|---|---|---|
| Disk autoscale | At **90%** utilisation, **+50%**, ≤200 GB per expansion, **4 modifications per rolling 24 h**. Disk can only increase. Includes **WAL and system log files**. | `HARD` |
| **Disk full** | **Read-only mode**; `cannot execute INSERT in a read-only transaction`; clears only **below 95%**. | `HARD` |
| Disk maxima | gp3: 16 TB / 16,000 IOPS (at ≥32 GB disk) / 125–1,000 MB/s. io2: 60 TB / 80,000 IOPS (at ≥80 GB disk); throughput scales with IOPS. Pro/Team max disk **60 TB**. Effective IOPS = min(disk-type max, compute-size max). | `HARD` |
| Backups | Free: **none** ("regularly export their data using the Supabase CLI db dump"). Pro **7 days**, Team **14**, Enterprise **up to 30**. | `HARD` |
| PITR | Add-on, retention **7 / 14 / 28 days**; requires **≥ Small compute**; **RPO ≈ 2 minutes**. **RTO is not published as a number** — only "correlates with database size". | `HARD` / `UNKNOWN` (RTO) |
| Read replicas | Run at **the same compute size as the primary**; disk is **1.25× the primary's** (WAL archives); inherit provisioned IOPS, throughput and IPv4. **Not covered by the Spend Cap; Compute Credits do not apply.** Read-only. **Asynchronous — read-after-write is NOT guaranteed**, so unsafe for order-confirmation or payment-status reads. Cross-region supported. **Max replica count and which plans support them are not published.** | `HARD` / `UNKNOWN` |
| Regions | **ap-south-1 (Mumbai) available.** Only AWS regions listed. "General regions aren't yet supported for read replicas or management via the API." | `HARD` |
| Egress | **Unified quota** across Database, Auth, Storage, Edge Functions, Realtime **and Supavisor** — "Data sent to the client when using the shared connection pooler". Cached and uncached have independent quotas. Free 5 GB / 5 GB; Pro & Team **250 GB / 250 GB**. **Every row returned to a Cloudflare Worker over Supavisor is billable egress.** | `SOFT` |
| Realtime | Free 200 peak connections / 2 M messages; Pro & Team **500 peak connections** / 5 M messages. **500 included peak connections is very low for a storefront opening a channel per active shopper.** | `SOFT` |
| Billing unit | **Per organization**, not per project. `$10` Compute Credits **per organization per month**, reset monthly, do not accumulate — a staging + prod setup gets **one** $10 credit total. Compute is billed by the hour, **partial hours billed in full**. Pro's Spend Cap is on by default; **Read Replicas and Disk IOPS Hours are explicitly excluded from it.** | `DEFAULT` |
| SLA | **Enterprise only.** 99.9% monthly; credits 10/15/20/30%; **capped at 20% of total annual fees**. Excludes scheduled maintenance, third-party vendors (AWS, Cloudflare), customer misconfiguration. **A payments platform with a canonical ledger on Pro or Team has zero contractual availability commitment.** | `NEGOTIABLE` |
| Hosted Postgres major version | **Not published for hosted.** Confirmed for self-hosted only ("ships with Postgres 17 by default"). PG14 support ended 2026-07-01. All PostgreSQL research here is against v17 docs on that basis. | `UNKNOWN` |
| Indirect tax | "Supabase is rolling out sales tax… and VAT, GST, and other indirect taxes… where required by law", **2026-05-01 → 2026-06-30**. **India is not named.** All invoices in USD. | `UNKNOWN` |

### 3.14 AWS ap-south-1 (Mumbai) — the alternative stack

Prices from the AWS Price List Bulk API (`pricing.us-east-1.amazonaws.com`), the machine-readable source behind the pricing pages; the HTML pages render regional tables in JavaScript and could not be scraped for Mumbai rates. Publication dates: ELB 2026-07-20, ECS/Fargate 2026-07-07, RDS 2026-08-12, ElastiCache 2026-08-13, CloudWatch 2026-08-06, Data Transfer 2026-07-20, **SQS 2025-08-28 (notably older — re-verify)**; NAT Gateway rows effective 2026-08-01.

| Subject | Metric | Value | Class |
|---|---|---|---|
| ALB | **1 LCU =** | 25 new connections/s **OR** 3,000 active connections/min (1,500 with mTLS) **OR** 1 GB/hour processed **OR** 1,000 rule evaluations/s — **billed only on the highest-consuming dimension** | `HARD` |
| ALB | Auto-scaling rate | **Not published.** AWS documents the remedy (capacity reservation), not the rate. | `UNKNOWN` |
| ALB | Capacity reservation | **Minimum 100 LCU** = 100 × $0.008 × 730 = **$584/month**; fulfilment "typically within a few minutes, but can take up to a few hours"; **decreases limited to twice per day**; reserved regionally and spread evenly across AZs. **Cannot be used reactively during a flash sale.** Regional reservation quota starts at **0** and must be raised first. | `HARD` |
| ALB | SLA | 99.99% multi-AZ / 99.9% single-AZ; credits 10/30/100% | `HARD` |
| Fargate | **On-Demand vCPU quota** | **6 vCPUs per Region** — ≈12 tasks at 0.5 vCPU. *(corrected: `SOFT`, adjustable L-3032A538, auto-raised on observed usage.)* **The single hardest launch-day blocker.** | `SOFT` |
| Fargate | Launch rates (ap-south-1) | Sustained **20 tasks/s**, burst **100 tasks**; **500 tasks per service per minute — explicitly NOT adjustable**. Regions launched after 2025-05-20 default to 5/s. | `SOFT` / `HARD` |
| ECS | Tasks & services | 5,000 tasks/service, 5,000 services/cluster; **1,000 tasks/service with service discovery**. `RunTask` API 20 calls/s (≤10 tasks per call). | `HARD` |
| Fargate | Cold start | **Not published.** ECS best practices say only that `awsvpc` mode "adds an overhead of several seconds" for ENI provisioning; measure `StartedAt` yourself. | `UNKNOWN` |
| RDS | Instances per account | **20 in ap-south-1** (40 elsewhere). Subnet groups, parameter groups, security groups, reserved instances also 20 vs 50/40/25. **Mumbai is quota-disadvantaged.** | `SOFT` |
| RDS / Aurora | `max_connections` | `LEAST({DBInstanceClassMemory/9531392}, 5000)`; range 6–262143. `DBInstanceClassMemory` is **less** than nominal GiB (OS + RDS overhead subtracted). Upper bounds on nominal memory: 4 GiB→~450, 8 GiB→~901, 16 GiB→~1,802, 32 GiB→~3,604, 64 GiB→capped 5,000. | `DEFAULT` |
| Aurora Serverless v2 | `max_connections` by **maximum** ACU | 1→189, 4→823, 8→1,669, 16→3,360, 32+→5,000. **Static parameter — changing max ACU requires a reboot.** | `DEFAULT` |
| Aurora Serverless v2 | Scale-to-zero conflict | **Capped at 2,000 connections whenever minimum capacity is 0 or 0.5 ACU.** "consider using a minimum ACU setting of 1 or higher." **Scale-to-zero and high connection counts are mutually exclusive.** | `HARD` |
| Aurora Serverless v2 | ACU / scaling | 1 ACU ≈ 2 GiB + proportional CPU/network; range 0–256 ACU; increments as small as 0.5. **Absolute scaling rate not published** — "The higher the current capacity, the faster it can scale up." Scale-down deliberately slower. **A very low minimum makes spike response slow — `min 0.5` is a false economy for spiky commerce traffic.** | `UNKNOWN` |
| RDS Multi-AZ | Failover | **"typically 60–120 seconds"**; DNS-record based (set JVM DNS TTL ≤60 s). **An OS patch during the maintenance window triggers a failover — a routine 1–2 minute write outage on a schedule.** | `SOFT` |
| RDS Multi-AZ | Standby reads | **"You can't use a standby replica to serve read traffic."** You pay 2× for pure insurance. Read scale-out needs separate replicas (≤15) or a Multi-AZ DB cluster whose storage is priced at 1.5× Multi-AZ. | `HARD` |
| Aurora | Failover | With ≥1 replica: "typically restored in less than 60 seconds, and often less than 30 seconds". **With no replica: the primary is recreated, "typically takes less than 10 minutes".** Aurora HA is only real if you pay for a second instance. | `SOFT` |
| RDS Proxy | Value & quotas | Pools/shares connections, sheds load rather than overwhelming the DB, "reduce failover times by up to 66% for Aurora Multi-AZ" (66% of 30–60 s is still a 10–20 s write outage). 20 proxies/account/Region; 200 secrets/proxy; default endpoint spans **2 AZs**; one proxy → one DB instance; for non-Aurora RDS it can attach only to the **writer**. | `SOFT` |
| RDS Proxy (PostgreSQL) | **Pinning** | **"Any statement with a text size greater than 16 KB causes the proxy to pin the session to the current connection."** No session-pinning filters for PostgreSQL; no `CancelRequest`; no streaming replication; protocol v3 only. **A design built on large `SECURITY DEFINER` RPC bodies can silently lose most of the multiplexing benefit — measure statement text sizes before assuming the proxy works.** | `HARD` |
| RDS gp3 | Baseline | **20–399 GiB: 3,000 IOPS / 125 MiB/s, and no additional IOPS or throughput can be provisioned.** 400–65,536 GiB: 12,000 IOPS / 500 MiB/s baseline, provisionable to 64,000 IOPS / 4,000 MiB/s. **Below 400 GiB you are hard-capped at 3,000 IOPS no matter what you pay.** | `HARD` |
| RDS io2 Block Express | Range | 1,000–256,000 IOPS; 16,000 MiB/s; 100–65,536 GiB; IOPS:GiB ratio 0.5–1,000. Max IOPS reachable at 256 GiB. | `HARD` |
| RDS | Storage quota | 100,000 GB total per Region (adjustable). Aurora exempt: **128 TiB per cluster**. Read replicas 15 per primary (not adjustable for Aurora). | `SOFT` |
| RDS | SLA | Multi-AZ instance/cluster **99.95%**; single instance 99.5%. Credits 10/25/100%. **The SLA's own definitions cover RDS engines only — Aurora is NOT covered by it.** "Unavailable" requires **all** connection requests to fail for a full 1-minute interval. | `HARD` |
| Aurora | SLA | Multi-AZ cluster (2+ AZs) **99.99%**; single-AZ 99.9%. **The 99.99% tier requires instances in 2+ AZs — you must pay for a reader to earn the headline number.** | `HARD` |
| ElastiCache | Quotas | 300 nodes/Region; 90 nodes/Valkey cluster; **40 serverless caches/Region** | `DEFAULT` |
| ElastiCache Serverless | Throughput | **30,000 ECPUs/s on an empty cache** (90,000 with Read-from-Replica); **30,000 ECPUs/s per slot**. Valkey 8.0 "can double the supported RPS every 2-3 minutes, reaching 5M RPS per cache from zero in under 13 minutes". **A hot key — one viral store's catalogue — hits the per-slot limit while the cache-wide limit sits idle.** | `HARD` |
| ElastiCache Serverless | Pre-scaling | **Set the minimum ECPUs/s at least 60 minutes before the peak event.** Once it lands you are metered at it even when idle. | `HARD` |
| ElastiCache Serverless | Min metered storage | **100 MB for Valkey** (1 GB for Memcached/Redis OSS) → $3.94/month floor. ECPU = 1 per KB transferred. No data-transfer charge in/out of the node. | `HARD` |
| SQS | Message limits | ≤1 MiB; retention default 4 days, **max 14 days (HARD — a poison backlog older than 14 days is silently lost)**; visibility default 30 s, max 12 h; ≤10 per batch. | `DEFAULT` |
| SQS FIFO high-throughput | **ap-south-1 ceiling** | **9,000 TPS non-batched / 90,000 msg/s batched** — versus **70,000 / 700,000** in us-east-1/us-west-2/eu-west-1. **Mumbai is a second-tier region, ~8× less headroom.** Per-order FIFO ordering must shard across many `MessageGroupId`s. | `SOFT` |
| SQS FIFO standard | Throughput | 300 TPS per partition per API action; 3,000 msg/s with batching. Scales with distinct `MessageGroupId`s. | `HARD` |
| SQS standard | Throughput | "very high, nearly unlimited number of API calls per second" — **no published number; not the bottleneck.** | `SOFT` |
| Public IPv4 | Charge | **$0.005/hour whether in use or idle.** An internet-facing ALB across 2 AZs holds ≥2 addresses = **$7.30/month before any traffic.** | `HARD` |
| Cross-AZ transfer | Directionality | **$0.01/GB in each direction** ⇒ effectively $0.02/GB round trip for every Fargate↔RDS/ElastiCache byte crossing an AZ. Same-AZ between these services is free; ALB→target over private IPs in the same VPC is free. **PrivateLink, NAT and Transit Gateway charges stack on top.** | `HARD` |
| **Cloudflare Bandwidth Alliance** | **AWS participation** | **No.** Named partners are Alibaba, Zenlayer, Cherry Servers, Oracle, Tencent Cloud. **Putting Cloudflare in front of an AWS ap-south-1 origin gives ZERO reduction in AWS egress** — every cache miss and dynamic response pays $0.1093/GB out of Mumbai, plus $0.056/GB if routed via NAT ($0.1653/GB combined). | `HARD` |
| Support | Lineup | **Basic, Business Support+, Enterprise, Unified Operations.** Business Support+ is "Minimum recommended plan for production workloads by AWS". Developer Support is no longer listed on the plans page (legacy SKUs still exist in the Price List API). | `HARD` |
| Support | Response targets | Business/mission-critical down <30 min; production down <1 h; production impaired <4 h; system impaired <12 h; general <24 h. **"every reasonable effort" — best-effort, not contractual.** 30-day minimum commitment. | `SOFT` |
| **AWS India (AISPL)** | **GST** | **18% IGST** for customers outside Delhi; **9% CGST + 9% SGST** in Delhi. **Invoices denominated in INR.** GSTIN must be recorded on the payer **and every linked account** to claim input tax credit. | `HARD` |

### 3.15 Providers

| Subject | Metric | Value | Class |
|---|---|---|---|
| **Razorpay PG** | **API rate limit** | **UNKNOWN — no numeric requests/second or requests/minute figure is published anywhere.** HTTP 429 is the documented signal *(on the Understand-Razorpay-APIs/pagination page, not the errors page — corrected)*. Increases are "reviewed case-by-case" via Support. **LetBuyy cannot compute a checkout-throughput ceiling for its own payment path from documentation.** | `SOFT`, unpublished baseline |
| Razorpay webhooks | Response budget | **2xx within 5 seconds**, else "the session is marked timeout". Forces ack-then-enqueue. | `HARD` |
| Razorpay webhooks | Retries | **Exponential backoff for 24 hours after the event creation timestamp.** Exact retry count and intervals not published. | `HARD` |
| **Razorpay webhooks** | **Auto-disable** | **"If the webhooks continue to fail for 24 hours, the webhook is disabled."** Manual dashboard re-enable required. **The highest-severity failure mode in the stack:** Razorpay stops calling, so error rates drop to zero — which looks like recovery — while payments capture and orders never confirm. Replay is eligible only for events under 15 days old **that were enabled at event time**. | `HARD` |
| Razorpay webhooks | Semantics | **At-least-once; duplicates via `x-razorpay-event-id`; ordering explicitly NOT guaranteed** — "you may not always receive the webhooks in order". State machines must be order-independent, not just idempotent. | `HARD` |
| Razorpay webhooks | Signature | **HMAC-SHA256 over the RAW body**, `X-Razorpay-Signature`. "Do not parse or cast the webhook request body." **Keep the previous secret valid ≥24 h on rotation** to cover in-flight retries. | `HARD` |
| Razorpay Refunds | Idempotency | `X-Refund-Idempotency`; key ≥10 chars, `[A-Za-z0-9_-]`; different payload → `BAD_REQUEST`; concurrent duplicate → **409 Conflict** (retryable). Normal and Instant both. **Key expiry/retention period undocumented.** | `HARD` |
| Razorpay Payouts | Idempotency | `X-Payout-Idempotency`, **mandatory since 2025-03-15**. Retrying with a **fresh** key while the first is still processing **creates two payouts**. | `HARD` |
| Razorpay Orders | Idempotency | **UNKNOWN — no dedicated header documented.** The `receipt` field is the conventional workaround but Razorpay does not document it as a guarantee. | `UNKNOWN` |
| RazorpayX Payouts | Throughput | **5–10 TPS (guidance).** The **only** published TPS figure anywhere in Razorpay's docs — **and it does not apply to the Payment Gateway APIs used at checkout.** | `SOFT` |
| Razorpay Settlements | Cycle | **Domestic T+2 working days** from capture. *(corrected)* **"Working days do not include the bank holidays"** — the Sundays/2nd-and-4th-Saturdays detail is not in the product docs. *(corrected)* **International is merchant-specific — "as per applicable law(s)… view your settlement cycle on the Razorpay Dashboard"; T+7 is not a documented default.** Instant Settlements (T+0) requires a Support request. | `NEGOTIABLE` |
| Razorpay Refunds | Customer timing | Normal **5–7 working days**; Instant "almost immediately". Batch refunds process after 70 minutes. | `DEFAULT` |
| Razorpay Route | Limits | **No published caps** on transfers per payment, linked accounts, or transfer amount. Transfers carry `on_hold` + `on_hold_until` — **the platform CAN hold funds**. **A Linked Account's settlement schedule can only be equal to or LONGER than the parent's** — a parent on T+2 cannot give a merchant T+1. | `DEFAULT` / `UNKNOWN` |
| Razorpay OAuth | Merchant-of-record model | Token-based delegated access on the merchant's **own** Razorpay account. **Each merchant's rate limit, settlement cycle, risk posture and KYC are the merchant's, not the platform's** — isolating per-merchant blast radius, but LetBuyy cannot centrally raise or observe limits. | `DEFAULT` |
| Razorpay | SLA | **No uptime commitment published**; status page is JS-rendered. Any SLA lives in the merchant agreement. | `UNKNOWN` |
| **Upstash Redis** | Commands/second | **10,000/s (Free through Fixed 50GB); 16,000/s (Fixed 100GB, 500GB).** The binding throughput ceiling for any Upstash-backed limiter or session store. | `HARD` |
| Upstash | Max request size | 10 MB (Free, PAYG, lower Fixed tiers) → 100 MB (Fixed 500GB). **Max concurrent connections not published** (moot for HTTP/REST clients from Workers). | `HARD` / `UNKNOWN` |
| Upstash | India | **ap-south-1 (Mumbai) available** as primary and read region. | `DEFAULT` |
| Upstash Global | Consistency | **Eventually consistent**; writes return after the primary processes, replication is async. **NOT safe as a strongly-consistent distributed lock or a strict cross-region rate-limit counter.** | `HARD` |
| Upstash Global | Replication billing | **"the replications are counted as commands"** — one primary + one read region **doubles** the command cost of writes. Rate limiting is write-heavy, so **read regions multiply cost without helping.** | `HARD` |
| Upstash Ratelimit SDK | Algorithms | Fixed window (bursts leak at boundaries), sliding window (**"only an approximation"**), token bucket (**not supported multi-region**). All use fixed time boundaries, so `reset` is the start of the next window, not an exact reset. | `HARD` |
| **Upstash Ratelimit SDK** | **Failure mode** | **Fails OPEN — "allow by default" if Redis does not resolve in time.** During an Upstash incident, or when the command ceiling is hit and calls time out, rate limiting **silently disappears exactly when the system is under most load.** Should be an explicit per-endpoint decision: fail-open for browsing, **fail-CLOSED for registration/login/OTP/refund.** | `DEFAULT` |
| Upstash | SLA | **99.99% only with the Prod Pack add-on ($200/month per database) or Enterprise.** Not included on Free, PAYG or Fixed. 99.99% still permits ~4 m 23 s/month. | `NEGOTIABLE` |
| **Turnstile** | Verification requests | **"Unlimited challenges (traffic or verification requests)" on BOTH Free and Enterprise.** *(refutes the widely-repeated 1 M/month claim.)* **Turnstile is not a throughput constraint.** | `HARD` |
| Turnstile | Widgets / hostnames | Free **20 widgets × 10 hostnames = 200 distinct hostnames**; Enterprise unlimited widgets × **200 hostnames each**. Error 10405 at the cap. Secret rotation leaves the previous secret valid **2 hours** when `invalidate_immediately` is false. | `SOFT` / `HARD` |
| Turnstile | **Wildcard/subdomain behaviour** | **UNKNOWN — whether one hostname entry covers all `*.letbuyy.com` subdomains is not established. This single unknown moves the multi-tenant scaling wall by two orders of magnitude** and should be resolved before any Enterprise conversation. | `UNKNOWN` |
| **Shiprocket** | Rate limits, 429 behaviour | **UNKNOWN.** `apidocs.shiprocket.in` is a JS-rendered SPA returning only a page title to HTTP fetch. **Do not assume any figure.** | `UNKNOWN` |
| Shiprocket | Webhook contract | **UNKNOWN** — retry schedule, payload structure, and **critically whether any signature verification exists**. **Until confirmed, Shiprocket webhooks must NOT be trusted to mutate order state**; verify by calling back to the API. | `UNKNOWN` |
| Shiprocket | Serviceability | `GET https://apiv2.shiprocket.in/v1/external/courier/serviceability/`. **Rate/quota limits UNKNOWN. No public status page, no SLA.** Called on every PIN-code entry at checkout — the highest-volume call in the fulfilment path, and a throttle there degrades **checkout**, not just fulfilment. | `UNKNOWN` |
| **Resend** | API rate limit | **10 requests/second per team**, shared across all API keys → 429. **The tightest documented throughput number in the entire stack.** "can be increased for trusted senders by request". Which headers communicate remaining quota is not documented. | `SOFT` |
| Resend | Volume & domains | Free 3,000/month **and 100/day**, 1 domain. Pro 50k–100k/month, **10 domains**, no daily cap. Scale 100k–2.5M/month, 1,000 domains. 30-day retention on all but Enterprise. **The 10-domain Pro cap supports only 10 merchants sending from their own domains — Scale is forced at merchant 11 regardless of volume.** | `HARD` |
| Resend webhooks | Retries | Six retries at **5 s, 5 min, 30 min, 2 h, 5 h, 10 h**. At-least-once; ordering NOT guaranteed (sort by `created_at`). Svix signatures; `svix-id` for dedupe. **Receiver timeout not documented. No uptime SLA retrieved.** | `HARD` |
| **WhatsApp** | Pricing model | **Per-message since 2025-07-01**, charged only when a **template** message is delivered; rate by template category and recipient country code. | `HARD` |
| WhatsApp | **Free classes** | Non-template messages inside an open customer service window (since 2024-11-01); **utility templates delivered inside an open window (since 2025-07-01)**; service messages; the 72-hour free entry-point window. **Order-status utility templates sent while the window is open are FREE — driving customers to message first converts the highest-volume category to zero marginal cost.** | `HARD` |
| WhatsApp | Customer service window | Opens on a user message; **24 hours rolling from the user's LAST message**. | `HARD` |
| WhatsApp | **India INR rates** | **UNKNOWN — published only in downloadable CSV/PDF rate cards and an interactive selector, neither machine-fetchable.** India took a **higher marketing rate on 2026-01-01** and a **higher authentication-international rate on 2026-04-01**; India was not among the 2026-07-01 changes. **Do not use any third-party blog figure.** | `UNKNOWN` |
| **WhatsApp** | **INR billing mandate** | **India-domiciled businesses must migrate all WABAs to INR by 2026-12-31. From 2027-01-01 Meta will no longer deliver messages from non-INR WABAs of eligible customers.** Migration APIs available since 2026-06-01. **~4.5 months from the audit date; the failure mode is total message-delivery failure. This is a launch-blocker item, not backlog.** | `HARD` |
| WhatsApp | Messaging tiers | **250 / 2,000 / 10,000 / 100,000 / Unlimited** unique customers per rolling 24 h *(2,000 — corrected from the stale 1,000)*. Beyond 2,000, escalation is automatic but requires high quality **and using ≥50% of the current limit in the previous 7 days**; increases take effect within 6 hours. **Tiers cannot be pre-scaled — capacity must be earned over weeks of graduated real traffic.** Downgrade criteria are not documented. | `SOFT` |
| WhatsApp Cloud API | Throughput | **80 messages/second per business phone number** (288,000/hour); upgrades available, ceilings unpublished. **Per-recipient throttle: 1 message per 6 seconds to the same user** (~10/min). | `SOFT` / `HARD` |
| WhatsApp | Volume tiers | Apply **only to utility and authentication** — marketing gets none. Aggregated at the **business portfolio level** per market-category pair. **Pooling all merchants' utility sends under one portfolio reaches discounts far faster than per-merchant WABAs.** | `HARD` |
| WhatsApp | Auth-international rate | Triggered above **750K messages** outside service windows in a moving 30 days to unique users in eligible countries, with 30 days' notice. **"always charged the domestic rate for your primary business location"** — an India-based LetBuyy sending to Indian users pays the India **domestic** rate. | `HARD` |
| WhatsApp | **Quality rating** | **UNKNOWN — the documentation page returned HTTP 404 on 2026-08-16.** A HIGH rating is confirmed to gate tier escalation, but level definitions, the flagged state, downgrade mechanics and recovery are unestablished. **Decisive for a shared-WABA multi-tenant design, where one merchant's spam degrades every merchant's rating.** | `UNKNOWN` |

> **Provider failure-mode rule the numbers support:** only Razorpay belongs on the synchronous checkout path. Upstash, Turnstile, Shiprocket, Resend and WhatsApp should each be cached, queued, or gracefully degradable — **four of the six have undocumented limits, fail-open behaviour, or no SLA at all.** COD must stay free of any Razorpay dependency; it is the single best availability hedge in an India-first market.

---

## 4. Pricing

> **All prices are USD list, GST-EXCLUSIVE, as published on 2026-08-16.** No currency conversion is performed anywhere in this document; converting to INR requires citing a specific rate and date. No negotiated or enterprise discount is assumed anywhere.
>
> **Indian GST.** Cloudflare has been **GST-registered in India since 2023-10-01** and collects by billing address — **the rate it applies is not stated on its tax page**, and a GSTIN **cannot be applied retroactively to already-issued invoices**, so it must be on the billing profile *before* the cycle. Vercel began collecting VAT/GST on invoices issued **on or after 2026-04-01**; rate not published. Supabase's rollout ran 2026-05-01 → 2026-06-30 and **does not name India**. Only **AWS India (AISPL)** publishes a rate: **18% IGST**, invoiced in INR. Whether reverse charge on import of services applies instead, for any of the three managed vendors, is `HUMAN-REQUIRED` — an Indian tax adviser, not a docs page.

### 4.1 Cloudflare

| Line item | Price (USD) | Unit | Included |
|---|---|---|---|
| Workers Paid — account minimum | **5.00** | per account/month | **10 M requests + 30 M CPU-ms/month**; covers Workers, Pages Functions, KV, Hyperdrive, Durable Objects |
| Workers — additional requests | 0.30 | per additional million | 10 M/month |
| Workers — additional CPU time | 0.02 | per additional million CPU-ms | 30 M CPU-ms/month |
| Workers — duration, egress, bandwidth | **0.00** | — | **Unlimited: "No additional charges for data transfer (egress) or throughput (bandwidth)"** |
| Workers Static Assets | **0.00** | — | "Free and unlimited" on both plans |
| Queues — operations | 0.40 | per million ops (**1 op = each 64 KB written, read, or deleted**) | 1 M ops/month |
| Queues — vendor's own example | 35.60 | 1 M messages/day × 30 days (write+read+delete) | 90 M ops − 1 M free = 89 M billed |
| **Hyperdrive** | **0.00** | — | **Included with the Workers plan.** Paid: unlimited queries, ~100 origin connections/config, 25 configs |
| KV — keys read | 0.50 | per million | 10 M/month |
| **KV — keys written** | **5.00** | **per million** | **1 M/month** |
| KV — keys deleted / list requests | 5.00 each | per million | 1 M/month each |
| KV — stored data | 0.50 | per GB-month | 1 GB |
| R2 — Standard storage | 0.015 | per GB-month | 10 GB-month |
| R2 — Infrequent Access storage | 0.01 | per GB-month | none |
| R2 — Class A ops (Standard) | 4.50 | per million | 1 M/month |
| R2 — Class B ops (Standard) | 0.36 | per million | 10 M/month |
| R2 — Class A / B (Infrequent Access) | 9.00 / 0.90 | per million | none |
| R2 — IA data retrieval | 0.01 | per GB | none |
| **R2 — egress** | **0.00** | per GB | **Unlimited free via Workers API, S3 API and r2.dev** |
| D1 — rows read / written / storage | 0.001 / **1.00** / 0.75 | per million / per million / per GB-month | 25 B rows / 50 M rows / 5 GB — **a 1,000× read-write asymmetry** |
| Durable Objects — requests | 0.15 | per million (**WebSocket messages billed 20:1**) | 1 M/month |
| Durable Objects — duration | 12.50 | per million GB-s (**measured at 128 MB = 0.128 GB-s per wall-second**) | **400,000 GB-s/month ≈ 36 always-on object-days** |
| DO (SQLite) — rows read / written / storage | 0.001 / 1.00 / 0.20 | per million / per million / per GB-month | 25 B / 50 M / 5 GB-month |
| Images — transformations | 0.50 | per 1,000 **unique** transformations/month (unique = source × parameter set, per calendar month) | 5,000/month |
| Images — stored / delivered | 5.00 / 1.00 | per 100,000 stored / delivered per month | none |
| Pro plan (per domain) | 20.00 annual / 25.00 monthly | per month | 2 rate-limit rules (IP-only, ≤1 min), SBFM, WAF managed rulesets. **No SLA.** |
| Business plan (per domain) | 200.00 annual / 250.00 monthly | per month | 5 rate-limit rules with custom counting expressions, **100% uptime SLA (1× credits)**, 200 MB body |
| Enterprise | **UNKNOWN** ("Custom", billed annually) | per year | 100 rate-limit rules, Advanced Rate Limiting counting, Sensitive Data Detection, Bot Management eligibility, DLS eligibility |
| Data Localization Suite / Bot Management / Smart Placement | **UNKNOWN** — no public price on any page (Smart Placement documents **no** charge, which is not the same as a published $0) | — | — |

**Cost shapes worth internalising.** Requests are nearly free — 100 M requests/month = (100 − 10) × $0.30 = **$27**. CPU dominates: at 15 ms mean CPU, 100 M requests = 1,500 M CPU-ms → **$29.40**; at 60 ms → **$119.40**; at 200 ms → **$399**. Cost is roughly linear in CPU per render. **Durable Object duration scales with the number of simultaneously resident objects, not request count**: one permanently resident object consumes 2,592,000 s × 0.128 = 331,776 GB-s — inside the free allowance; two cost $3.29/month. **Image transformations are the hidden line**: 10,000 merchants × 1,000 SKUs × 4 render sizes = 40 M unique transformations = **~$19,997/month**, and canonicalising parameter strings (`width=200` vs `w=200` are separate billable transformations) is the lever.

### 4.2 Vercel (Mumbai `bom1` rates)

| Line item | Price (USD) | Unit | Included on Pro |
|---|---|---|---|
| Pro platform fee | **20.00** | per month | 1 deploying seat, **$20 usage credit**, 1 TB Fast Data Transfer, 10 M Edge Requests, 1 h Edge Request CPU Duration; unlimited free Viewer seats |
| Active CPU — bom1 | 0.140 | per CPU-hour | none (drawn against credit) |
| Provisioned Memory — bom1 | 0.0116 | per GB-hour | none |
| Function Invocations | 0.60 | per 1,000,000 (non-regional) | none |
| **Fast Data Transfer — bom1** | **0.20** | **per GB** | **first 1 TB** |
| **Edge Requests — bom1** | **2.20** | **per 1,000,000** | **first 10,000,000** |
| Fast Origin Transfer — bom1 | 0.25 | per GB | none |
| **ISR Writes — bom1** | **4.40** | per 1,000,000 write units (**1 unit = 8 KB**) | none |
| ISR Reads — bom1 | 0.44 | per 1,000,000 read units | none |
| Runtime Cache writes / reads — bom1 | 4.40 / 0.44 | per million units | not stated |
| Edge Request additional CPU duration — bom1 | 0.33 | per CPU-hour | 1 h/cycle; **first 10 ms of each CDN request free** |
| Image Optimization transformation — bom1 | 0.0527 | per 1,000 transformations | none |
| Image cache reads / writes — bom1 | 0.44 / 4.40 | per million 8 KB units | none |
| Builds — Elastic | 0.0035 | per CPU-minute | none |
| Firewall rate-limit / OWASP — bom1 | 0.55 / 0.88 | per million requests | none |
| Drains (log/event export) | 0.50 | per GB | none |
| Observability Plus | 1.20 | per million tracked events | none |
| Pro add-ons | SAML SSO 300 · **HIPAA BAA 350** · Advanced Deployment Protection 150 · Static IPs 100/project · Speed Insights 10/project | per month | none |
| Indian GST | **UNKNOWN** — "depends on your billing address and applicable tax regulations" | — | — |

### 4.3 Supabase

| Line item | Price (USD) | Unit | Included |
|---|---|---|---|
| Free plan | 0 | per org/month | 500 MB DB, 5 GB + 5 GB egress, 1 GB storage, 50k MAU, **NO backups**, paused after 1 week idle, 2 active projects |
| **Pro plan** | **25** | per org/month | $10 compute credits, 8 GB disk/project, 250 GB + 250 GB egress, 100 GB storage, 100k MAU, **7-day backups**, 7-day logs, **no SLA**. Spend Cap on by default. |
| Team plan | 599 | per org/month | Same usage inclusions **plus** 14-day backups, 28-day logs, SOC2 & ISO 27001, "priority email support & SLAs" *(conflicts with the SLA document — see §1.5)* |
| Enterprise | **UNKNOWN** (custom) | — | 24×7×365 support, uptime SLAs, up to 30-day backups, BYO Cloud |
| Compute add-on | see §3.11 ladder — $0.01344/hr (Micro) → $5.12/hr (16XL) | per project per hour, **partial hours billed in full** | offset by $10 org credits |
| Disk — gp3 | **0.125** | per GB-month ($0.000171/GB-hr) | **8 GB on Pro and Team** |
| Disk — io2 | 0.195 | per GB-month | **0 GB — billed from the first byte** |
| **Provisioned IOPS — gp3** | **0.024** | per IOPS per month | **3,000 included on Pro and Team** |
| Provisioned IOPS — io2 | 0.119 | per IOPS per month | none |
| Provisioned throughput — gp3 | 0.095 | per MB/s per month | 125 MB/s baseline |
| PITR 7 / 14 / 28 days | **100 / 200 / 400** | per project per month | none; requires ≥ Small compute |
| Egress uncached / cached | 0.09 / 0.03 | per GB | 250 GB each on Pro and Team |
| File storage | 0.0213 | per GB-month | 100 GB |
| MAU (Auth) | 0.00325 | per MAU | 100,000 |
| Edge Function invocations | 2.00 | per million | 2 M |
| Realtime connections / messages | 10 per 1,000 / 2.50 per million | peak connections / messages | 500 / 5 M |
| **Read Replica** | compute at the primary's size **+** disk at **1.25×** primary × $0.125 **+** inherited IOPS **+** inherited throughput **+** optional IPv4 | per replica per month | **none — Compute Credits do not apply and replicas are not covered by the Spend Cap** |
| IPv4 address | 4 | per project per month | none (projects are IPv6 by default; Supavisor is IPv4-only at no charge) |
| Custom domain | 10 | per domain per project per month | none |
| Log Drains | 60 per drain + 0.20 per million events + 0.09 per GB egress | per month | none |
| Compute Credits | **−10** | **per ORGANIZATION per month** — reset monthly, do not accumulate | all paid plans |
| Indian GST | **UNKNOWN** — India not named in the tax rollout | — | — |

**Two cost shapes.** (a) **Provisioned IOPS can exceed compute.** 20,000 gp3 IOPS = **$408/month**, more than a Large instance — and IOPS Hours are **explicitly excluded from the Spend Cap**, as are Read Replicas. (b) **A same-size read replica roughly doubles the database bill** and **cannot serve read-after-write**, so it is useless for order confirmation and viable only for merchant analytics.

### 4.4 AWS ap-south-1

| Line item | Price (USD) | Unit |
|---|---|---|
| **ALB** | 0.0239 per ALB-hour **+** 0.008 per used LCU-hour | hourly |
| NLB (alternative) | 0.0239 per NLB-hour + 0.006 per LCU-hour | hourly |
| Fargate x86 | 0.04256 per vCPU-hr **+** 0.004655 per GB-hr | hourly |
| **Fargate ARM (Graviton)** | **0.02383** per vCPU-hr **+** 0.00261 per GB-hr — **~44% cheaper on vCPU** | hourly |
| **NAT Gateway** | **0.056 per hour AND 0.056 per GB processed** | hourly + per GB |
| Public IPv4 | 0.005 per address-hour (in-use **and** idle) | hourly |
| VPC interface endpoint (PrivateLink) | 0.013 per endpoint-hour + 0.010/GB (first 1 PB) | hourly + per GB |
| RDS PostgreSQL `db.t4g.medium` | 0.084 Single-AZ / **0.167 Multi-AZ** | per instance-hour |
| RDS `db.m6g.large` / `db.m7g.large` | 0.226 / 0.240 Single-AZ; **0.452 / 0.479 Multi-AZ** | per instance-hour |
| RDS `db.r7g.large / xlarge / 2xlarge / 4xlarge / 8xlarge` | 0.272 / 0.544 / 1.088 / 2.176 / 4.352 Single-AZ; **0.544 / 1.088 / 2.176 / 4.352 / 8.704 Multi-AZ** | per instance-hour |
| RDS gp3 storage | 0.131 Single-AZ / **0.262 Multi-AZ** / 0.393 Multi-AZ readable standbys | per GB-month |
| RDS gp3 provisioned IOPS / throughput | 0.023 / 0.091 Single-AZ; 0.046 / 0.182 Multi-AZ | per IOPS-month / per MiBps-month |
| RDS io1/io2 storage + IOPS | 0.131 / 0.105 Single-AZ; 0.262 / 0.209 Multi-AZ | per GB-month / per IOPS-month |
| RDS backup beyond free | 0.095 | per GB-month (free up to 100% of provisioned storage) |
| Aurora PostgreSQL `db.r7g.large / 2xlarge / 4xlarge / 8xlarge` | 0.314 / 1.254 / 2.509 / 5.017 standard; 0.408 / 1.630 / 3.262 / 6.522 I/O-Optimized | per instance-hour |
| Aurora storage / I/O | 0.11 (standard) or 0.248 (I/O-Opt) per GB-month; **0.22 per million I/O requests** (standard only) | — |
| Aurora Serverless v2 | 0.18 standard / 0.24 I/O-Optimized | per ACU-hour |
| **RDS Proxy** | **0.017 per vCPU-hour (2-vCPU minimum)** or 0.023 per ACU-hour (**8-ACU minimum** on Serverless v2 — **a scale-to-zero Aurora cluster still pays ~$134/month for its proxy**) | hourly |
| ElastiCache Valkey nodes `t4g.micro / m7g.large / r7g.xlarge` | 0.0160 / 0.1312 / 0.3592 | per node-hour |
| **ElastiCache Serverless Valkey** | 0.054 per GB-hour stored + 0.0015 per million ECPUs (**100 MB minimum = $3.94/month**) | — |
| SQS standard / FIFO | 0.40 / 0.50 per million requests (tiered down to 0.32 / 0.42) | **first 1 M/month free, aggregated across all regions** |
| **CloudWatch Logs** | **0.67 per GB ingested** (0.335 Infrequent Access) + 0.03 per GB-month stored + 0.0067 per GB scanned | first 5 GB each free |
| CloudWatch metrics / alarms | 0.30 per custom metric (first 10k) · 0.10 per standard alarm | 10 metrics, 10 alarms, 1 M API requests free |
| **Data transfer OUT to internet** | **0.1093** (first 10 TB) · 0.085 (next 40 TB) · 0.082 (next 100 TB) · 0.080 (over 150 TB) | per GB; **only 100 GB/month free, globally across all services** |
| **Cross-AZ transfer** | **0.010 in each direction** | per GB |
| **Business Support+** | **the greater of $29/month/account OR 9% of charges ≤$10k, 7% $10k–80k, 5% $80k–250k, 3% >$250k** | per month |
| **India GST (AISPL)** | **18% IGST** (9% CGST + 9% SGST in Delhi), invoiced in INR | on everything above |

### 4.5 Providers

| Line item | Price | Unit | Included |
|---|---|---|---|
| **Upstash Fixed 250MB** | **$10** (+$5 per read region) | per month | **unlimited commands** (10,000 cmd/s ceiling) |
| Upstash Fixed 1GB / 5GB / 10GB / 50GB / 100GB / 500GB | $20 / $100 / $200 / $400 / $800 / $1,500 | per month | unlimited commands |
| Upstash Pay-as-you-go | $0.20 | per 100,000 commands | 1 GB storage, 200 GB bandwidth free |
| Upstash Prod Pack (unlocks the 99.99% SLA) | $200 | **per database** per month | not included on any base plan |
| Turnstile Free / Enterprise | $0 / Contact Sales (**no public price**) | per month | unlimited challenges + verification requests on both |
| Resend Free / Pro 50K / Pro 100K / Scale | $0 / $20 / $35 / $90–$1,150 | per month | 3,000 (100/day) / 50k / 100k / 100k–2.5M emails |
| WhatsApp templates (India, INR) | **UNKNOWN** | per delivered template message by category | free inside an open service window; utility templates free inside the window since 2025-07-01 |
| Razorpay MDR / Instant Settlement fees | **UNKNOWN — not researched in this pass** (`https://razorpay.com/pricing/`). **Indian GST applies to Razorpay fees.** | — | — |

> **The crossover that matters most in this table:** Upstash Pay-as-you-go at $0.20/100k commands versus **Fixed 250MB at $10/month with unlimited commands** breaks even at **~5 M commands/month**. Any real traffic belongs on a Fixed tier. Keep the primary in ap-south-1 and add **no** read regions for a rate-limit database — replication is billed as commands and rate limiting is write-heavy, so read regions double cost while providing no benefit.

---

## 5. Cost model

> **Every figure in §5 is `INFERRED`** — arithmetic over a published vendor rate (§4) and a counted implementation cost (`VERIFIED-SOURCE` / `VERIFIED-CONFIG`). **No invoice, dashboard, or usage meter was consulted.** The falsifying measurement is named for each dominant input in §5.11.

### 5.1 Method

**Time base.** 30-day month = 2,592,000 seconds; hourly components at 730 hours.

**Band → monthly volume.** `06_10M_WORKLOAD_DEFINITION.md` §3.1 gives 1.5% conversion and 6 page views/session, so:

```
page views/month = orders/month × (1 / 0.015) × 6 = orders/month × 400
```

This reproduces Band G exactly (30,000 × 400 = 12 M = the 400,000/day in `06` §5). Orders/month at Bands A and B use `06`'s own peak-to-average implication (Band B "orders/month equivalent ~5M" against a 19 orders/s peak ⇒ peak/avg ≈ 10).

| Band | Definition | Orders/month | Page views/month | Peak origin RPS (`06`) |
|---|---|---|---|---|
| **G** | Governed envelope: 10,000 merchants, 30,000 orders/month (Constitution §6) | 30,000 | 12,000,000 | ~7–20 |
| **A** | 100,000 simultaneously online | 500,000 | 200,000,000 | 1,787 (30% uncacheable) |
| **B** | 1,000,000 simultaneously online | 5,000,000 | 2,000,000,000 | 17,867 (30% uncacheable) |

**Merchant count is held at 10,000 across all three bands** — the constitutional envelope. Bands A and B would in reality imply more merchants; holding it constant isolates the traffic variable and makes the per-merchant row comparable.

### 5.2 Implementation-derived cost inputs

| Input | Value | Source | State |
|---|---|---|---|
| Gateway fetches per storefront render, **as configured** | **~22** (against ~8 distinct URLs) — a random `X-Request-ID: crypto.randomUUID()` per fetch enters both the Next 16 Data Cache key and the request-memoisation key, so neither dedupes | `apps/storefront-runtime/src/lib/api/client.ts:45` | `VERIFIED-SOURCE` |
| Gateway fetches per storefront render, **fixed** | **8** distinct URLs | same, by removal | `INFERRED` |
| Storefront HTML Full Route Cache (ISR) | **Unreachable.** `await resolveThemePreviewToken(subdomain)` in the tenant layout reads a cookie, forcing the whole subtree dynamic; `cacheComponents` is unset so PPR is off. Every `export const revalidate` beneath is inert for HTML. | `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:76` → `src/lib/theme-preview-server.ts:12`; `next.config.ts` (no `experimental` block) | `VERIFIED-SOURCE` |
| Per-request gateway call that caching **cannot** remove | `proxy.ts` fetches `/v1/internal/store-access/resolve` with `cache: 'no-store'` on every storefront request. **The proxy runs ahead of the CDN, so a CDN hit does not remove this call.** | `apps/storefront-runtime/src/proxy.ts:118-122` | `VERIFIED-SOURCE` |
| KV operations per rate-limited request | **1 read + 1 write**, non-atomic read-modify-write, both in the fixed-window and query-cost limiters | `services/api-gateway/src/middleware/rateLimit.ts:321-325, 618-623`; `wrangler.toml` `RATE_LIMIT_KV_FALLBACK="on"` | `VERIFIED-SOURCE` + `VERIFIED-CONFIG` |
| Telemetry DB writes per API request | **1 `runtime_telemetry_metrics` row, unconditionally**, plus 1 `worker_request_logs` row (2% sampled for anonymous storefront GET/HEAD, unsampled otherwise) | `services/api-gateway/src/middleware/observability.ts:265-302`; `wrangler.toml` `REQUEST_LOG_SAMPLE_RATE = "0.02"` | `VERIFIED-SOURCE` + `VERIFIED-CONFIG` |
| Telemetry retention | **None.** `worker_request_logs`, `runtime_telemetry_metrics`, `operation_metrics` are plain heap tables; retention is defined only on shadow partitioned copies. | discovery digest, verdict **CONFIRMED** | `VERIFIED-SOURCE` |
| Worker storefront cache | `caches.default` + KV versioning, `STOREFRONT_CACHE="on"` in all envs. **No request coalescing, no serve-stale path** — every concurrent miss on a cold key runs the full producer. | `services/api-gateway/src/lib/storefront-cache.ts:121-129`; `wrangler.toml` | `VERIFIED-SOURCE` + `VERIFIED-CONFIG` |
| Media origin | `ASSET_PUBLIC_BASE_URL = "https://cdn.letbuyy.com"`, `R2_BUCKET = letbuyy-media-production` | `wrangler.toml` | `VERIFIED-CONFIG` |

**Modelled inputs that are not measured** (each linear, each falsifiable):

| Input | Value used | Why | Falsified by |
|---|---|---|---|
| Edge Requests per page view | **25** | Vercel publishes **no** per-pageview figure; its own usage walkthrough is "for illustrative purposes only". 25 is the digest's working figure. | Vercel Usage dashboard Edge Requests chart ÷ known pageviews |
| Vercel data transfer per page view | **0.5 MB** (HTML + RSC + JS; media egresses R2 free) | Media is on `cdn.letbuyy.com`/R2 per config, so the digest's 1.5 MB all-through-Vercel figure overstates. Sensitivity in §5.9. | Vercel Fast Data Transfer ÷ pageviews |
| Active CPU / wall per render | **as-configured 100 ms / 1,000 ms; fixed 40 ms / 400 ms**; in-function concurrency 10 | Anchored to the digest's checkout-shaped example (40 ms / 400 ms) scaled by the **verified** 2.5–3× fetch amplification | Vercel Observability Active CPU and duration |
| Gateway Worker CPU per request | **10 ms** | No measurement exists; `07` §3.1 concludes Workers CPU is not a ceiling at any modelled band | Cloudflare Workers CPU-time analytics |
| Telemetry row size | **500 bytes** | `runtime_telemetry_metrics` carries a `dimensions` JSON blob. Range 200 B – 1 KB. | `pg_total_relation_size` ÷ row count |
| DB bytes returned per gateway request | **2 KB** | Supabase egress is a unified quota that **includes Supavisor traffic** | Supabase egress line ÷ request count |
| Postgres CPU per storefront read | **1 ms** ⇒ `QPS_ceiling ≈ cores / 0.001` | Derived from the digest's Large-tier arithmetic (2 dedicated cores, ~20 ms per money RPC ⇒ ~100 orders/s) | `pg_stat_statements.mean_exec_time` |
| Queries per gateway request | **2.5** | `06` §3.3 | `pg_stat_statements` calls ÷ request count |

### 5.3 Scenario definitions

| Scenario | Cache | Rate limiter | Telemetry | ISR |
|---|---|---|---|---|
| **AS-CONFIGURED** | HTML hit 0%, 22 fetches/render | **Cloudflare KV** (1 write/request) | 1 row/request into PostgreSQL | unreachable ⇒ **$0 ISR** |
| **CACHE-FIXED ONLY** | HTML hit 90%, 8 fetches/miss | Cloudflare KV | PostgreSQL | reachable |
| **FIXED-ALL** | HTML hit 90%, 8 fetches/miss | **Upstash Fixed 250MB ($10) or sharded Durable Objects** | **Analytics Engine** (`RUNTIME_TELEMETRY` binding already declared in production) | reachable, **deterministic render ⇒ no write units** |

**Derived request volumes.**

```
Vercel function invocations   = page_views × (1 − hit_ratio)
Gateway (Worker) requests     = page_views × [ (1 − hit_ratio) × fetches_per_render + 1 ]
                                                                    └─ proxy.ts no-store call, always 1
```

| Band | Scenario | Invocations/mo | Gateway requests/mo |
|---|---|---|---|
| G | AS-CONFIGURED | 12,000,000 | **276,000,000** |
| G | FIXED (h=0.9, F=8) | 1,200,000 | **21,600,000** |
| A | AS-CONFIGURED | 200,000,000 | **4,600,000,000** |
| A | FIXED | 20,000,000 | **360,000,000** |
| B | AS-CONFIGURED | 2,000,000,000 | **46,000,000,000** |
| B | FIXED | 200,000,000 | **3,600,000,000** |

### 5.4 Band G — the governed envelope (10,000 merchants, 30,000 orders/month)

**Cloudflare** — formulas: `requests = (R_M − 10) × $0.30`; `CPU = (10 × R_M − 30) × $0.02`; `KV reads = (R_M − 10) × $0.50`; `KV writes = (R_M − 1) × $5.00`; `queues = (orders × 30 / 1e6 − 1) × $0.40`; `R2 storage = (10,000 merchants × 2 GB − 10) × $0.015`.

| Line | AS-CONFIGURED (R = 276 M) | FIXED-ALL (R = 21.6 M) |
|---|---|---|
| Workers Paid base | $5.00 | $5.00 |
| Worker requests | (276−10) × 0.30 = **$79.80** | (21.6−10) × 0.30 = **$3.48** |
| Worker CPU @10 ms | (2,760−30) × 0.02 = **$54.60** | (216−30) × 0.02 = **$3.72** |
| KV reads (limiter) | (276−10) × 0.50 = **$133.00** | — |
| **KV writes (limiter)** | (276−1) × 5.00 = **$1,375.00** | — |
| Rate-limit backend | — | Upstash Fixed 250MB = **$10.00** |
| Queues (30k orders × 30 ops = 0.9 M) | $0 (inside 1 M) | $0 |
| R2 storage (20 TB) | (20,000−10) × 0.015 = **$299.85** | $299.85 |
| R2 Class B (1 origin fetch/pageview) | (12−10) × 0.36 = $0.72 | $0.72 |
| Hyperdrive, D1, DO | $0 | $0 |
| **Cloudflare total** | **$1,947.97** | **$322.77** |

**Vercel** — `invocations × $0.60/M`; `ActiveCPU_h × $0.140`; `instance_h × 2 GB × $0.0116`; `(ER_M − 10) × $2.20`; `(GB − 1,024) × $0.20`.

| Line | AS-CONFIGURED | FIXED-ALL |
|---|---|---|
| Invocations | 12 M × 0.60/M = $7.20 | 1.2 M × 0.60/M = $0.72 |
| Active CPU | 12 M × 0.1 s = 333.3 h × 0.140 = $46.67 | 1.2 M × 0.04 s = 13.3 h × 0.140 = $1.87 |
| Provisioned memory | 12 M × 1.0 s ÷ 10 = 333.3 h × 2 × 0.0116 = $7.73 | 13.3 h × 2 × 0.0116 = $0.31 |
| **Edge Requests** (12 M × 25 = 300 M) | (300−10) × 2.20 = **$638.00** | **$638.00** (unchanged) |
| **Fast Data Transfer** (12 M × 0.5 MB = 6,000 GB) | (6,000−1,024) × 0.20 = **$995.20** | **$995.20** (unchanged) |
| ISR writes | **$0** (ISR unreachable) | $0 if the render is deterministic; **$316.80** if not (§5.9) |
| ISR reads | $0 | 1.2 M misses × 6 units × 0.44/M = $3.17 |
| Platform fee − usage credit | +$20.00 − $20.00 | +$20.00 − $20.00 |
| **Vercel total** | **$1,694.80** | **$1,639.27** (deterministic) / **$1,956.07** (non-deterministic) |

> **Read that table twice.** Fixing the cache changes the Vercel bill by **3%** at Band G, and *raises* it if the render is non-deterministic. **$1,633 of the $1,695 is Edge Requests plus egress, neither of which the cache hit ratio moves.** The cache fix pays for itself on the Cloudflare and Supabase lines, not the Vercel line.

**Supabase** (Pro, Large, PITR 7-day, IPv4, pre-provisioned disk):

| Line | AS-CONFIGURED | FIXED-ALL |
|---|---|---|
| Pro plan | $25.00 | $25.00 |
| Large compute (0.1517 × 730) | $110.74 | $110.74 |
| Disk | telemetry 276 M rows × 500 B = **138 GB/month, no retention** ⇒ 500 GB provisioned: (500−8) × 0.125 = **$61.50** | telemetry on Analytics Engine ⇒ 100 GB: (100−8) × 0.125 = **$11.50** |
| Provisioned IOPS | 106 rows/s avg × 3 write IOPS = 318; **peak ×10 = 3,180 > the 3,000 gp3 baseline** ⇒ 6,000 IOPS: 3,000 × 0.024 = **$72.00** | inside the 3,000 baseline = **$0** |
| PITR 7-day | $100.00 | $100.00 |
| IPv4 | $4.00 | $4.00 |
| Egress (2 KB/request) | 552 GB → (552−250) × 0.09 = **$27.18** | 43 GB — inside the 250 GB allowance = **$0** |
| Compute credits | −$10.00 | −$10.00 |
| **Supabase total** | **$390.42** | **$241.24** |

**Band G totals (USD, GST-exclusive):**

| Scenario | Cloudflare | Vercel | Supabase | **Total/month** |
|---|---|---|---|---|
| **AS-CONFIGURED** | $1,948 | $1,695 | $390 | **$4,033** |
| **CACHE-FIXED ONLY** | $422 | $1,956 | $254 | **$2,632** |
| **FIXED-ALL** | $323 | $1,639 | $241 | **$2,203** |

**Delta: $1,830/month (45%) at the governed envelope**, of which **$1,375 is the KV rate limiter alone** — replaceable with a $10/month Upstash tier that the deploy pipeline already has release-blocking preconditions for (`production-deploy.yml:76-77, 111-112, 327-328`, `VERIFIED-CONFIG`).

### 5.5 Band A (100,000 concurrent online) and Band B (1,000,000)

| Line | **Band A** AS-CONFIGURED | **Band A** FIXED-ALL | **Band B** AS-CONFIGURED | **Band B** FIXED-ALL |
|---|---|---|---|---|
| Worker requests | (4,600−10)×0.30 = $1,377.00 | (360−10)×0.30 = $105.00 | (46,000−10)×0.30 = $13,797.00 | (3,600−10)×0.30 = $1,077.00 |
| Worker CPU | $919.40 | $71.40 | $9,199.40 | $719.40 |
| KV reads | $2,295.00 | — | $22,995.00 | — |
| **KV writes** | **$22,995.00** | — | **$229,995.00** | — |
| Rate-limit backend | — | Upstash $10.00 | — | **sharded DO** $539.85 req + $53.06 duration |
| Queues | $5.60 | $5.60 | $59.60 | $59.60 |
| R2 storage + Class B | $368.25 | $368.25 | $1,016.25 | $1,016.25 |
| **Cloudflare total** | **$27,965** | **$565** | **$277,067** | **$3,470** |
| Vercel invocations + CPU + memory | $1,026.67 | $48.27 | $10,266.67 | $482.67 |
| **Vercel Edge Requests** | **$10,978.00** | **$10,978.00** | **$109,978.00** | **$109,978.00** |
| **Vercel Fast Data Transfer** | **$19,795.20** | **$19,795.20** | **$199,795.20** | **$199,795.20** |
| Vercel ISR reads | $0 | $52.80 | $0 | $528.00 |
| **Vercel total** | **$31,800** | **$30,874** | **$320,040** | **$310,784** |
| Supabase compute | **16XL $3,730** — 4,437 QPS avg, **44,375 peak** ⇒ ≥45 cores | XL $210 — 3,472 QPS peak | **not sizeable: 17,747 telemetry rows/s** | 16XL $3,730 — 34,722 QPS peak |
| Supabase disk / IOPS / PITR / plan / IPv4 / egress | $61.50 / $0 / $100 / $25 / $4 / $805.50 | $61.50 / $72 / $100 / $25 / $4 / $42.30 | — | $255 / $408 / $400 / $599 / $4 / $625.50 |
| **Supabase total** | **$4,716** | **$505** | **NOT SERVEABLE** | **$6,022** |
| **BAND TOTAL** | **$72,824** *(and DB-infeasible at peak)* | **$31,873** | **≥$597,107 and infeasible** | **$320,276** |

Two structural readings:

> **Band A.** The single largest line in the entire as-configured bill is **KV rate-limiter writes at $22,995/month** — larger than Vercel egress, larger than the database, larger than everything else on Cloudflare combined. The vendor-documented replacement is **$10/month**. Separately, **at 4,600 M gateway requests/month the telemetry design writes 1,775 PostgreSQL rows/second on average and 17,750/second at peak** — that is not a tier problem, it is a design problem: `07` Finding C-7 puts telemetry ahead of commerce in the write budget, and the arithmetic here agrees.

> **Band B.** After the fixes, **97% of the bill is Vercel Edge Requests + Fast Data Transfer ($309,773 of $320,276)**, and **neither is reduced by caching** — a CDN hit still bills an Edge Request, and the bytes still egress. The comparison is stark: the same 1 PB/month costs **$199,795 on Vercel bom1**, **$80,693 on AWS ap-south-1** (tiered), and **$0 on Cloudflare Workers / R2**. **The cost question at Band B is not "which stack" — it is "which vendor do the bytes leave from".**

### 5.6 Unit economics

| Metric | Band G AS-CONF. | Band G FIXED | Band A AS-CONF. | Band A FIXED | Band B FIXED |
|---|---|---|---|---|---|
| Monthly fixed (plan fees + always-on: Workers $5, Vercel Pro $20, Supabase plan + compute + PITR + IPv4 − credits, R2 storage) | ~$730 | ~$730 | ~$4,360 | ~$640 | ~$5,289 |
| Monthly variable (everything metered by traffic) | ~$3,303 | ~$1,473 | ~$68,464 | ~$31,233 | ~$314,987 |
| **Total/month** | **$4,033** | **$2,203** | **$72,824** | **$31,873** | **$320,276** |
| **Cost per 1,000 page views** | $0.336 | $0.184 | $0.364 | $0.159 | $0.160 |
| **Cost per 1,000 gateway requests** | $0.0146 | $0.102 | $0.0158 | $0.0885 | $0.0890 |
| **Cost per order** | **$0.134** | **$0.0734** | **$0.146** | **$0.0637** | **$0.0640** |
| **Cost per active merchant/month** (10,000) | $0.403 | $0.220 | $7.28 | $3.19 | $32.03 |

Two notes on reading these. **Cost per 1,000 gateway requests rises after the fix** — that is correct and not a defect: the fix removes ~92% of the requests while the fixed and egress-driven costs stay, so the remaining requests each carry more overhead. **Cost per order and cost per 1,000 page views are the honest efficiency metrics**, and both roughly halve. Per-order cost is essentially flat from Band A to Band B (**$0.064**), which says the stack is linear in traffic once the three defects are removed — there is no cost cliff between 100k and 1M concurrent users, only a vendor-choice question about egress.

### 5.7 Where the money actually goes (Band A, as configured)

| Rank | Line | $/month | Share | Removable by |
|---|---|---|---|---|
| 1 | **Cloudflare KV rate-limiter writes** | $22,995 | 32% | **$10/month Upstash Fixed 250MB, or sharded Durable Objects** |
| 2 | Vercel Fast Data Transfer | $19,795 | 27% | Serving bytes from Cloudflare (egress $0). **Not** by caching. |
| 3 | Vercel Edge Requests | $10,978 | 15% | Same. **Not** by caching. |
| 4 | Supabase compute forced to 16XL | $3,730 | 5% | Routing telemetry to the already-declared `RUNTIME_TELEMETRY` Analytics Engine dataset |
| 5 | KV rate-limiter reads | $2,295 | 3% | Same as #1 |
| 6 | Worker requests + CPU | $2,296 | 3% | Cache fix (12.8× fewer gateway calls) |
| 7 | Vercel invocations + CPU + memory | $1,027 | 1% | Cache fix |
| 8 | Supabase egress | $806 | 1% | Cache fix (fewer queries ⇒ fewer rows over Supavisor) |
| — | R2 storage + ops, queues, disk, PITR, plans | $8,902 | 12% | — |

**The three highest-value cost actions are all `Implementation`-class** per `07` §4 — none needs an ARB decision, a new runtime, or a constitutional amendment:

1. Replace the KV rate-limit backend → removes **$25,290/month at Band A** for **$10/month**.
2. Route telemetry to Analytics Engine (binding already in `wrangler.toml`) → removes the forced compute tier and the unbounded disk growth.
3. Fix the three cache defects → removes ~92% of gateway requests and their downstream database load.

### 5.8 Sensitivity (i): cache hit ratio

Band A, **FIXED-ALL** apart from the hit ratio. `h` = storefront HTML cache hit ratio; `F` = gateway fetches per miss render.

| `h` | `F` | Gateway req/mo | Cloudflare | Vercel | Supabase | **Total** | Δ vs today |
|---|---|---|---|---|---|---|---|
| **0%** | **22** *(today)* | 4,600 M | $2,675 | $31,800 | $4,716 (16XL) | **$39,191** | — |
| 0% | 8 *(remove the random request-ID only)* | 1,800 M | $1,275 | $31,256 | $2,352 (8XL) | **$34,883** | −11% |
| 50% | 8 | 1,000 M | $875 | $31,279 | $1,302 (4XL) | **$33,456** | −15% |
| 90% | 8 | 360 M | $555 | $30,874 | $433 (XL) | **$31,862** | −19% |
| 99% | 8 | 216 M | $484 | $30,783 | $308 (Large) | **$31,575** | −19% |

> **The honest conclusion is uncomfortable: cache hit ratio is not primarily a cost lever on this stack — it is a capacity and correctness lever.** Total spend moves only **19%** across 0% → 99% hit, because Vercel Edge Requests and egress ($30,773) are invariant to it. What *does* move: **Cloudflare falls 5.5×**, and **Supabase falls from a forced 16XL to a Large — an 12× compute reduction and, per `07` Finding C-2/C-9, the difference between "not serveable" and "comfortable."** Spend the cache work for capacity, not for the invoice.

**A material uncertainty in the modelled `h = 0`.** `07` §3.3 states the effective storefront hit ratio is "approximately zero". My own reading of source **partially contradicts that for HTML at the CDN layer**: `apps/storefront-runtime/next.config.ts:124-126` sets `Cache-Control: public, max-age=300, stale-while-revalidate=3600` on `source: '/:path*'`, and Next 16 does **not** override a user-set Cache-Control (`send-payload.js` only sets its own header `if (cacheControl && !res.getHeader('Cache-Control'))`). So what is provably zero is the **Next Full Route Cache (ISR)** and the **Next Data Cache**; the **Vercel Edge Network hit ratio is `UNKNOWN`**, because whether Vercel stores a function response carrying `public, max-age=300` with no `s-maxage` is provider behaviour that cannot be established without live access. Two consequences: (a) the AS-CONFIGURED Vercel invocation count may be lower than modelled, so **Band G/A Vercel totals are an upper bound on invocations and a firm figure on Edge Requests and egress**; (b) **if that directive *is* honoured, per-request HTML that varies on the theme-preview cookie is marked publicly cacheable for 300 s with no `Vary: Cookie`** — which would let a shared cache serve one merchant's draft theme render to the public. That is a correctness question for `08`, not a cost question, but it is settled by the same one-line observation. Falsified by: request the same product page twice and read `x-vercel-cache`.

### 5.9 Sensitivity (ii): telemetry and log volume

**PostgreSQL side.** `r` = telemetry rows written per gateway request. At Band A FIXED (360 M gateway requests/month):

| `r` | Rows/month | Rows/s avg → peak | Write IOPS at peak (×3) | Provisioned IOPS cost | Disk added/month @500 B | Disk cost at month 12 |
|---|---|---|---|---|---|---|
| **2** (unsampled path today) | 720 M | 278 → 2,780 | 8,340 | (9,000−3,000) × 0.024 = **$144** | 360 GB | 4.3 TB × $0.125 = **$540/mo** |
| **1** (`runtime_telemetry_metrics` only) | 360 M | 139 → 1,390 | 4,170 | (5,000−3,000) × 0.024 = **$48** | 180 GB | 2.2 TB = **$270/mo** |
| 0.02 (sampled like `worker_request_logs`) | 7.2 M | 2.8 → 28 | 84 | $0 | 3.6 GB | 43 GB = **$5.40/mo** |
| **0** (Analytics Engine) | 0 | — | — | **$0** | 0 | **$0** — Analytics Engine pricing is `UNKNOWN`; see §6 |

At Band A **as configured** (4,600 M gateway requests, `r`=1) the same arithmetic gives **2,300 GB/month of telemetry into tables with no retention policy** — **27.6 TB after twelve months, which exceeds gp3's 16 TB maximum and forces io2 at $0.195/GB-month ≈ $5,382/month for telemetry disk alone.** Row size is the dominant uncertainty: at 200 B this is 920 GB/month, at 1 KB it is 4,600 GB/month.

**Log-export side**, same volume, 1 KB of log per request:

| Destination | Rate | Band A FIXED (360 M req) | Band A AS-CONFIGURED (4,600 M req) |
|---|---|---|---|
| Vercel Drains | $0.50/GB | $180 | $2,300 |
| Supabase Log Drains | $60/drain + $0.20/M events + $0.09/GB | $132 | $1,392 |
| **AWS CloudWatch Logs** | **$0.67/GB ingest + $0.03/GB-month storage** | **$241 + storage** | **$3,082 + storage** |

> **Two operational traps in that table.** Vercel Pro retains runtime logs for **1 day** — thin for payment-incident forensics, so Drains are not optional at any real volume. CloudWatch's default retention is **never expire**, which silently converts a one-time $0.67/GB ingest into a perpetual $0.03/GB-month liability; explicit retention configuration is a launch item on the AWS path.

### 5.10 The AWS ap-south-1 alternative, and its floor

**The floor is the whole point.** These components bill at 730 h/month whether or not a single request arrives:

| Always-on component | Rate | $/month |
|---|---|---|
| ALB hours | $0.0239/h | 17.45 |
| 2 × public IPv4 (2-AZ internet-facing ALB) | $0.005/h each | 7.30 |
| **2 × NAT Gateway (hours only)** | $0.056/h each | **81.76** |
| 2 × Fargate ARM tasks (0.5 vCPU / 1 GiB) | — | 21.22 |
| **RDS PostgreSQL `db.t4g.medium` Multi-AZ** | $0.167/h | **121.91** |
| 100 GB gp3 Multi-AZ | $0.262/GB-mo | 26.20 |
| RDS Proxy at its 2-vCPU minimum | $0.017/vCPU-h | 24.82 |
| ElastiCache Serverless Valkey at its 100 MB minimum | $0.054/GB-h | 3.94 |
| **Business Support+** | greater of $29 or 9% | **29.00** |
| **FLOOR** | | **$333.60** → **$393.65 with 18% IGST** |
| Same floor with a non-burstable `db.m6g.large` Multi-AZ ($329.96) | | **$558.79** → **$659.37 with IGST** |
| Optional: 100-LCU ALB capacity reservation for a festival sale | 100 × $0.008 × 730 | **+$584.00**, must be reserved hours ahead, **decreasable only twice per day** |

**NAT gateways are 27% of that floor and buy nothing but outbound reachability.** Replacing them with VPC interface endpoints costs $9.49/month per endpoint per AZ and only wins below ~4 endpoints with no third-party outbound calls — but LetBuyy calls Razorpay, Resend, Shiprocket and Turnstile, so NAT stays.

**Traffic-loaded AWS estimates** (on-demand, no Reserved Instances or Savings Plans — the largest unexploited lever, deliberately not assumed):

| | Band G (30k orders, 6 TB egress) | Band A (500k orders, 100 TB egress) | Band B (5M orders, 1 PB egress) |
|---|---|---|---|
| Always-on compute/data floor | $512.65 (`m6g.large` variant) | **$6,332.83** (digest-sized 100× stack: `db.r7g.4xlarge` Multi-AZ $3,176.96, 2 TB gp3 Multi-AZ $524, one `r7g.2xlarge` replica $794.24, RDS Proxy $198.56, 2× `cache.r7g.xlarge` $524.43, 20 Fargate tasks $424.13, ALB + 100-LCU reservation $601.45, NAT $81.76, IPv4 $7.30) | not sized here — `UNKNOWN` |
| **Internet egress** | 5,900 GB × $0.1093 = **$644.87** | 10 TB@0.1093 + 40 TB@0.085 + 50 TB@0.082 = **$8,593** | + 850 TB@0.080 = **$80,693** |
| NAT data processing | ~$28 | $112 | scales with outbound |
| Cross-AZ (Fargate↔RDS, both directions) | $20 | $40 | scales |
| CloudWatch (50 metrics, 30 alarms, logs) | $31.40 | $335 | scales |
| SQS | $0 (inside 1 M free) | $5.60 | $59.60 |
| Subtotal | $1,236.92 | $15,418.43 | — |
| Business Support+ (9%) | $111.32 | $1,387.66 | — |
| **AWS total** | **$1,348** → **$1,591 with 18% IGST** | **$16,806** → **$19,831 with IGST** | egress line alone **$80,693** |
| **Managed stack, FIXED-ALL, same band** | **$2,203** | **$31,873** | **$320,276** |

**Three things that estimate excludes and must not be forgotten.**

1. **No CDN.** There is no CloudFront line above. A commerce storefront needs one, and it is unpriced here — `UNKNOWN`, and material at every band.
2. **No labour.** The digest's own summary of the AWS delta is blunt: VPC/subnet/route-table/security-group design across 2+ AZs, NAT HA, a Service Quotas backlog (Fargate 6 vCPU, **RDS instances 20 in ap-south-1 vs 40 elsewhere**, RDS Proxy 20), engine and OS patching with scheduled failover windows, RDS Proxy pinning analysis, ECS autoscaling policy tuning, image build/ECR/blue-green pipeline, backup and restore drills, explicit CloudWatch retention, IAM/Secrets Manager/KMS, egress and cross-AZ cost attribution, a paid support contract AWS itself calls the minimum for production — **and, largest of all, rebuilding in application code everything Supabase provides natively: RLS-enforced data access, auth, storage, realtime.** None of that appears in a price list.
3. **Availability is not equivalent.** RDS Multi-AZ fails over in **60–120 s** with a standby that **cannot serve reads** (2× cost for pure insurance) and takes that outage during every OS patch window; single-instance Aurora has a **~10-minute RTO**. The RDS SLA is 99.95% and **its own definitions do not cover Aurora**; Aurora's 99.99% requires paying for a reader.

### 5.11 Crossover

| Regime | Cheaper stack | Margin |
|---|---|---|
| **Zero to very low traffic** (which per `04` L-25 may be today's actual state — the Constitution records zero production merchants) | **Managed**, decisively | Managed floor ≈ **$50–60/month** (Workers $5 + Vercel Pro $20 + Supabase Pro $25 with Micro covered by credits) vs AWS **$333.60–$558.79** before GST. **~6–10×.** |
| **Band G** (~12 M page views, ~6 TB egress) | AWS on this arithmetic ($1,591 with IGST vs $2,203) — **but the AWS figure has no CDN in it**, and the gap is smaller than the excluded items | Within noise. **Not a decision-grade margin.** |
| **Band A and above** | AWS on egress rate alone ($0.1093 tiered vs $0.20) — **and Cloudflare beats both at $0.00** | AWS ≈ 40% of Vercel's egress; Cloudflare ≈ 0% |

**The egress-and-floor crossover, solved explicitly.** Let `GB` be monthly egress. Managed marginal egress is `max(0, GB − 1,024) × $0.20`; AWS is `(GB − 100) × $0.1093` on top of a floor roughly $289 above the managed floor:

```
289 + 0.1093 × (GB − 100)  =  0.20 × (GB − 1,024)
289 − 10.93 + 204.80       =  0.0907 × GB
GB ≈ 5,324
```

⇒ **≈5.3 TB/month of egress ≈ 10.6 M page views/month at 0.5 MB — essentially the top of the governed envelope.** Below that, managed wins on the floor; above it, AWS wins on the per-GB rate. **But this arithmetic omits CloudFront, omits the labour, and applies only against Vercel** — and it is decisively answered by a third option: **Cloudflare charges $0 for egress from Workers and R2, and AWS is not a Bandwidth Alliance partner, so no amount of Cloudflare in front of AWS recovers that.**

> **The decision the numbers actually support** is not "migrate to AWS". It is: **(1) replace the KV rate-limit backend; (2) move telemetry off PostgreSQL; (3) fix the three cache defects; and then (4) ask a single, separate, `HUMAN-REQUIRED` question — should storefront byte delivery sit behind Vercel's $0.20/GB + $2.20/M-edge-request meter, or behind Cloudflare's $0.00?** Items 1–3 are `Implementation`-class per `07` §4 and remove ~56% of the Band G bill and ~56% of the Band A bill. Item 4 is worth **$199,795/month at Band B** and is an architecture decision for the ARB, not an engineering ticket — it changes where `storefront-runtime` runs.

---

## 6. What this document could not establish

Every row names the single artefact that would settle it. Nothing below is estimated.

### 6.1 Pricing and tax

| # | Unknown | Settled by |
|---|---|---|
| U-1 | **The Indian GST rate Cloudflare applies**, and whether reverse charge applies to a GST-registered Indian business customer. Registration since 2023-10-01 is confirmed; the rate is not stated (unlike Cloudflare's Singapore entry, which states 9%). | `billing@cloudflare.com`, or an actual invoice with an Indian billing address |
| U-2 | **The Indian GST rate Vercel applies.** `vercel.com/docs/pricing/taxes` says only "depends on your billing address and applicable tax regulations". | An invoice issued after 2026-04-01 to an Indian address, or `tax@vercel.com` |
| U-3 | **Whether Supabase charges Indian GST at all**, and at what rate. India is not named in the tax-rollout document. | Supabase billing support in writing, or an invoice with a GSTIN entered as Tax ID **plus an Indian tax adviser on reverse charge for import of services** |
| U-4 | **Cloudflare Enterprise, Bot Management, and Data Localization Suite pricing** — all published only as "Custom"/"Contact Sales". **Turnstile Enterprise** likewise. | An account-team quote. **No discount should be assumed.** |
| U-5 | **Cloudflare Analytics Engine pricing** — the recommended telemetry destination in §5.9, and its cost is not in this research pass. | `developers.cloudflare.com/analytics/analytics-engine/pricing/` or the Workers pricing page |
| U-6 | **Whether Smart Placement carries any charge** (production sets `mode = "smart"`). The docs page states no price; absence of a price is not a published $0. | A Smart Placement row on the Workers pricing page, or an invoice line |
| U-7 | **Razorpay MDR by payment method and Instant Settlement fees** — not researched in this pass. Indian GST applies on top. | `https://razorpay.com/pricing/` |
| U-8 | **WhatsApp India per-message INR rates** (marketing / utility / authentication). Published only in downloadable CSV/PDF rate cards and an interactive selector. | Download "INR rates (CSV)" and "Rates and Volume tiers (PDF)" from the Meta pricing page, or the selector at `whatsappbusiness.com/products/platform-pricing` (cards stated effective 2026-07-01). **Do not use a blog figure.** |
| U-9 | **AWS Reserved Instance / Savings Plan depths in ap-south-1** for RDS, ElastiCache and Fargate. Everything in §5.10 is on-demand. **Typically the largest single lever on an always-on stack.** | The same price lists under `TermType=Reserved` |
| U-10 | **Whether AISPL applies 18% GST to AWS Support charges** at the same rate as service charges. | AWS India tax documentation or an invoice |
| U-11 | **ap-south-1 Fargate Spot pricing** — no Spot SKU rows in the ECS ap-south-1 price list. (Inappropriate for checkout-path tasks regardless.) | `aws.amazon.com/fargate/pricing/` with the Mumbai region selector |
| U-12 | The **ap-south-1 SQS price list was published 2025-08-28**, ~11 months older than every other list retrieved. | `aws.amazon.com/sqs/pricing/` with the Mumbai selector, before committing SQS rates |

### 6.2 Limits that would change the capacity model

| # | Unknown | Settled by |
|---|---|---|
| U-20 | **Workers per-account concurrency cap** — no row exists on the limits page. | A Cloudflare account-team or Enterprise contract statement, or a Limit Increase Request response |
| U-21 | **Workers cold-start latency in milliseconds** — docs are qualitative only. | Measuring p99 first-request latency on a deployed Worker. **No vendor guarantee exists.** |
| U-22 | **Whether Hyperdrive's ~100 origin connections is a global per-config total or per-region**, and whether the pool region is user-selectable / guaranteed near ap-south-1. Docs say actual counts "may occasionally exceed" the limit. | `pg_stat_activity` on the origin under sustained load, or Cloudflare support |
| U-23 | **Where Hyperdrive's query cache physically lives** (edge-local vs regional vs colocated) — determines whether the 60 s staleness window is per-PoP or global. | Cloudflare docs or support |
| U-24 | **D1 write throughput** — no writes/second figure is published anywhere. | A D1 throughput page or SLO. Until then the only defensible number is the ~1,000 rps single-DO soft limit. |
| U-25 | **R2 per-bucket / per-prefix object request rate limits** — not published. | A new row on the R2 limits page, or written confirmation. **Do not assume S3-style per-prefix figures.** |
| U-26 | **Cloudflare Images source limits** — file size, dimensions, megapixels, animated-image caps, input formats. `/images/platform/limits/` returns 404. | The Images API reference or a restored limits page |
| U-27 | **Max concurrent WebSocket connections per Durable Object**, and the **exact idle-eviction timeout** for an object holding no outbound connections — the main uncertainty in the DO duration cost model. | Cloudflare docs or support |
| U-28 | **Whether the KV 1-write/s/key limit or the 1,000-namespace limit is raisable.** Neither row carries a limit-increase notice. | Cloudflare support |
| U-29 | **Vercel Edge Requests generated by one Next 16 page load** — the model's 25 is an assumption; Vercel's own walkthrough is explicitly illustrative. **Linear multiplier on the largest Vercel line.** | The Edge Requests chart in Vercel Usage against a known pageview count |
| U-30 | **Whether ISR read/write units are counted on the compressed or uncompressed payload.** Docs mention "automatic compression of ISR writes" without saying. **Changes the ISR write estimate by a large factor.** | Vercel support, or ISR Observability write units vs known payload sizes |
| U-31 | **Scope of Vercel's 30,000 concurrency ceiling** (per project, per team, or per function), and whether it is raisable on Pro. | Vercel support |
| U-32 | **Whether Vercel's 300 ms global purge guarantee covers Data Cache / Runtime Cache tag invalidation**, or only ISR HTML and data payloads. | Vercel support, or measurement across two regions |
| U-33 | **Total storage of a Vercel Runtime Cache before LRU eviction** — "a fixed storage limit" is stated, the number is not. | Runtime Cache section of Observability, or support |
| U-34 | **Whether `'use cache: remote'` / `'use cache: private'` / `partialPrefetching` exist in 16.1.6 specifically**, and the per-link server-invocation cost of Partial Prefetching (a direct invocation-billing multiplier). | `node_modules/next/dist/docs/` in the installed package |
| U-35 | **Supabase default Supavisor pool size** (numeric), and **how many connection slots Supabase's own services consume** (PostgREST, Auth, Storage, Realtime, reserved) — so the count actually available to the application pooler is unknown at every tier. | Dashboard → Database → Connection pooling, or `pg_stat_activity` grouped by `usename` / `application_name` |
| U-36 | **Whether Supavisor (as opposed to PgBouncer) holds a server connection for an entire multi-statement transaction.** PgBouncer states it explicitly; Supabase's Supavisor wording is looser. **The `SET LOCAL` safety conclusion rests on per-transaction pinning.** | The Supavisor repository README/source, or `BEGIN; set_config(...,true); SELECT current_setting(...); COMMIT;` under concurrency on port 6543 |
| U-37 | **Max read replicas per project, which plans support them, and the replication-lag p50/p99** (same- or cross-region). None published. | The Add Replica dialog, or an Enterprise Order Form |
| U-38 | **RTO for PITR or a daily-backup restore.** Only "correlates with database size" and RPO ≈ 2 min are published. **For a payments ledger the restore duration at a given DB size is the number that matters.** | Supabase support in writing, or a rehearsed restore drill on a branch/clone |
| U-39 | **Whether Supabase applies non-default `autovacuum`, `work_mem`, `shared_buffers` or `statement_timeout` per compute size.** All PostgreSQL values here are upstream v17 defaults. | `select name, setting, source from pg_settings where source != 'default';` |
| U-40 | **The gp3 IOPS-to-disk-size ratio rule** on Supabase (16,000 IOPS "at 32 GB", io2 1,000 IOPS/GB imply one, but the formula is not published). | The disk configuration UI, which rejects invalid combinations |
| U-41 | **AWS Fargate task launch-to-healthy latency**, **ALB autonomous scale-up rate**, **Aurora Serverless v2 resume-from-zero latency and absolute ACU/s scaling rate**, **ElastiCache Serverless max storage per cache**. All four: AWS publishes no number. | AWS support, or your own instrumented benchmark. **Accept no blog figure as a vendor guarantee.** |
| U-42 | **Razorpay's configured API rate limit for this account** — not discoverable from documentation at any tier. | Razorpay Support, in writing. **This is a capacity input, not a curiosity: without it LetBuyy cannot compute a checkout-throughput ceiling for its own payment path.** |
| U-43 | **Razorpay Orders API idempotency** (whether duplicate `POST /v1/orders` with the same `receipt` is deduplicated), the **refund idempotency key expiry**, and **Route limits** (max transfers per payment, max linked accounts, max transfer amount, max `on_hold` duration, and whether held funds sit with Razorpay or the platform for regulatory purposes). | `razorpay.com/docs/api/orders/create/` plus Razorpay Support |
| U-44 | **Turnstile wildcard/subdomain hostname behaviour** — whether one entry covers all `*.letbuyy.com`. **The highest-value open question in the provider set: it moves the multi-tenant wall from ~100 merchants to effectively unbounded for subdomain tenants.** | The Turnstile widget-configuration and hostname-management docs |
| U-45 | **Shiprocket: everything.** Rate limits, 429 behaviour, webhook retry schedule, payload structure, and **whether any signature verification mechanism exists at all**. No status page, no SLA. | Load `apidocs.shiprocket.in` in a real browser, inspect the Postman collection at `postman.com/shiprocketdev`, or raise a support ticket |
| U-46 | **WhatsApp quality-rating mechanics** — the documentation URL returned **HTTP 404** on 2026-08-16. Level definitions, low-rating triggers, the flagged state, downgrade mechanics and recovery are all unestablished, and **on a shared WABA one merchant's spam degrades every merchant's rating.** Also unpublished: tier **downgrade** criteria, the upgraded Cloud API throughput ceiling above 80 msg/s, and template approval SLA / appeal mechanics. | The current quality-rating page under `developers.facebook.com/documentation/business-messaging/whatsapp/` |
| U-47 | **Resend:** expected webhook receiver timeout, which headers communicate remaining rate-limit quota, any uptime SLA percentage, and intermediate Scale-tier prices between $90 and $1,150 (**do not interpolate**). | `resend.com/pricing` volume selector; Resend support |
| U-48 | **Upstash max concurrent connections per plan** (largely moot for HTTP/REST clients from Workers). | `upstash.com/docs/redis/troubleshooting/max_concurrent_connections` |

### 6.3 The gap that no vendor page can close

Everything above is a *vendor* unknown. The larger unknown is on LetBuyy's side and is enumerated in `04_LIVE_DEPLOYMENT_TRUTH.md`: **which tier is actually provisioned, which secrets are actually set, how many domains are actually attached, and whether any traffic exists at all.** Specifically for this document:

| From `04` | Why it blocks a cost answer |
|---|---|
| **L-16** — actual Supabase compute tier, connection ceiling, disk, IOPS | §5 assumes Large/XL/16XL by derivation. The real tier is one dashboard read. |
| **L-22** — actual KV write rate | The single largest modelled cost line. Cloudflare KV analytics settles it. |
| **L-31** — whether `UPSTASH_REDIS_REST_URL` is set (name only) | Decides whether the $22,995 KV line exists at all. The adversarial pass corrected this to **`S2 / VERIFIED-CONFIG`**: the wrangler comment and the 2026-08-01 runbook assert KV; `production-deploy.yml` makes the Upstash secrets **release-blocking** and writes them to the Worker. **Both are simultaneously true if the gated pipeline never completes.** `rateLimit.ts:850, 912` short-circuit to Redis *before* consulting `kvRateLimitFallbackEnabled`, so if Upstash is present both KV paths are unreachable dead code. **`HUMAN-REQUIRED`: only an operator with GitHub and Cloudflare access can say which backend production runs.** |
| **L-34** — how many custom domains are attached | Drives the Vercel domain-provisioning ceiling (L11) and Turnstile's hostname wall |
| **L-25** — whether any production traffic exists | If the Constitution's "zero production merchants" still holds, **every figure in §5 is prospective**, and the correct posture is to fix the foundation before traffic — materially cheaper than after |

---

## 7. Source ledger

All accessed **2026-08-16**. "Class" is the dominant limit class of what the page established.

### 7.1 Cloudflare

| URL | Established | Class |
|---|---|---|
| `developers.cloudflare.com/workers/platform/limits/` | Requests/day, CPU time, memory 128 MB, startup 1 s, subrequests, **6 simultaneous connections**, script size, env vars, Workers/account, Error 1102 behaviour; **absence** of any RPS/burst/concurrency row | HARD / UNKNOWN |
| `developers.cloudflare.com/workers/platform/pricing/` | $5 base, 10 M requests + 30 M CPU-ms included, $0.30/M requests, $0.02/M CPU-ms, **$0 duration/egress/bandwidth**, free unlimited static assets | — |
| `developers.cloudflare.com/workers/reference/how-workers-works/` | Cold-start posture is qualitative only | UNKNOWN |
| `developers.cloudflare.com/changelog/post/2025-03-25-higher-cpu-limits/` | Corroborates 5 min / 300,000 ms max, 30 s default | HARD |
| `developers.cloudflare.com/workers/configuration/smart-placement/` | 15-minute analysis window; no numeric eligibility threshold; no documented charge | UNKNOWN |
| `developers.cloudflare.com/queues/platform/limits/` | 5,000 msg/s per queue, 25 GB backlog, 128 KB message, 100/batch, 60 s wait, 100 retries, 10,000 queues, retention | HARD |
| `developers.cloudflare.com/queues/platform/pricing/` | $0.40/M ops; op = each 64 KB written/read/deleted; the 1 M msg/day = $35.60 example | — |
| `developers.cloudflare.com/queues/configuration/consumer-concurrency/` | 250 concurrent consumers; autoscaling behaviour | HARD |
| `developers.cloudflare.com/queues/configuration/dead-letter-queues/` | **No DLQ ⇒ permanent deletion**; DLQ without a consumer ⇒ 4-day retention | HARD |
| `developers.cloudflare.com/queues/reference/delivery-guarantees/` · `…/how-queues-works/` | **At-least-once, explicitly unordered**, all-or-nothing batch retry | HARD |
| `developers.cloudflare.com/hyperdrive/configuration/how-hyperdrive-works/` | Transaction-mode pooling; pool placed near the origin; 20–30 ms vs 1–3 ms | HARD |
| `developers.cloudflare.com/hyperdrive/platform/limits/` | **~100 origin connections/config (Paid)**, 25 configs, 60 s query, 15 s connect, 10 min idle, 50 MB cached response | SOFT / HARD |
| `developers.cloudflare.com/hyperdrive/platform/pricing/` | Included at no additional charge on Workers Paid | — |
| `developers.cloudflare.com/hyperdrive/configuration/query-caching/` | 60 s `max_age`, 15 s SWR, 3,600 s max; **no write invalidation**; IMMUTABLE-only caching | DEFAULT / HARD |
| `developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/` | PG 9.0–17.x; **no advisory locks, no LISTEN/NOTIFY, no SQL-level prepared statements** | HARD |
| `…/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/` | **Use the Direct connection string and a real Postgres driver, not `supabase-js`** | HARD |
| `developers.cloudflare.com/kv/api/write-key-value-pairs/` | **1 write/second/same key → HTTP 429** | HARD |
| `developers.cloudflare.com/kv/concepts/how-kv-works/` | **"up to 60 seconds or more"**; negative caching delays propagation; what KV is and is not for | HARD |
| `developers.cloudflare.com/kv/api/read-key-value-pairs/` · `…/api/list-keys/` | `cacheTtl` min 30 / default 60; `list()` 1,000 keys, use `list_complete` | DEFAULT / HARD |
| `developers.cloudflare.com/kv/platform/limits/` · `…/pricing/` | 25 MiB value, 512 B key, **1,000 namespaces**, 1,000 ops/invocation shared with R2; reads $0.50/M, **writes/deletes/lists $5.00/M**, storage $0.50/GB-mo | HARD / — |
| `developers.cloudflare.com/r2/reference/limits/` | **4.995 TiB object, 4.995 GiB single-part** *(footnote-corrected)*, 10,000 parts, **1/s same-key writes**, 1 M buckets, 100 custom domains/bucket; **no published per-prefix rate** | HARD / UNKNOWN |
| `developers.cloudflare.com/r2/pricing/` | $0.015/GB-mo, Class A $4.50/M, Class B $0.36/M, **$0 egress**, Class A/B classification, round-up billing | — |
| `developers.cloudflare.com/r2/buckets/storage-classes/` · `…/object-lifecycles/` | IA 30-day minimum, $0.01/GB retrieval, 2–2.5× ops; 1,000 lifecycle rules/bucket | HARD |
| `developers.cloudflare.com/images/optimization/features/` · `…/transformations/sources/` · `…/images/pricing/` | Source limits **absent (404 on the limits page)**; R2 origin must be added under Sources and **a root domain does not authorise subdomains**; $0.50/1,000 unique transformations | UNKNOWN / DEFAULT |
| `developers.cloudflare.com/d1/platform/limits/` · `…/pricing/` | **10 GB/database**, 50,000 databases, 1 TB/account, 1,000 queries/invocation, 6 connections, **no published write throughput**; rows read $0.001/M vs written $1.00/M | HARD / UNKNOWN |
| `developers.cloudflare.com/d1/best-practices/read-replication/` · `…/reference/time-travel/` | Public beta, one replica per region, Sessions API binding-only; Time Travel 30-day PITR at no cost | DEFAULT / HARD |
| `developers.cloudflare.com/workers/platform/storage-options/` | D1 positioning: "horizontal scale out across multiple, smaller (10 GB) databases, such as per-user, per-tenant" | HARD |
| `developers.cloudflare.com/durable-objects/reference/faq/` | **~1,000 rps soft limit per object**; overload returns an error after queueing | SOFT |
| `developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/` | `Required DOs = total rps / per-DO capacity`; **"A common mistake is using a Durable Object for global rate limiting or global counters."** | SOFT |
| `developers.cloudflare.com/durable-objects/platform/limits/` · `…/pricing/` | 10 GB/object, 2 MB key+value, 500 classes, 30 s CPU, 6 connections; $0.15/M requests, **$12.50/M GB-s with 400,000 GB-s included** | HARD / — |
| `developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/` | **SQLite is the recommended and effectively only backend for new namespaces** | HARD |
| `developers.cloudflare.com/durable-objects/api/alarms/` · `…/best-practices/websockets/` | One alarm per object; ≤6 retries; hibernation removes duration charges; 32 MiB message | HARD |
| `developers.cloudflare.com/durable-objects/reference/data-location/` | **No India location hint; jurisdictions EU/US/FedRAMP only; objects never move after creation** | HARD |
| `developers.cloudflare.com/durable-objects/platform/known-issues/` | Global uniqueness holds only while touching storage; rollouts are eventually consistent | HARD |
| `developers.cloudflare.com/data-localization/region-support/` · `/data-localization/` | India **is** a Regional Services region; **CMB is US or EU only**; Enterprise-only add-on, **price unpublished** | NEGOTIABLE |
| `www.cloudflare.com/network/` | 348 cities, ~2 dozen Indian cities; **no user-selectable ap-south Workers region** | UNKNOWN |
| `developers.cloudflare.com/waf/rate-limiting-rules/` | Rules 1/2/5/100; **per-tenant counting characteristics are Enterprise-only**; periods and mitigation timeouts | HARD |
| `developers.cloudflare.com/waf/managed-rules/` · `…/bots/get-started/super-bot-fight-mode/` | Managed rulesets by plan, **Sensitive Data Detection Enterprise-only**; SBFM included Pro+, Bot Management price unpublished | HARD / NEGOTIABLE |
| `www.cloudflare.com/business-sla/` · `www.cloudflare.com/plans/` | 100% SLA from Business ($200 annual / $250 monthly per domain), credits formula; Pro $20/$25; Enterprise "Custom" | NEGOTIABLE |
| `developers.cloudflare.com/billing/understand/sales-tax/` | **GST-registered in India since 2023-10-01**, billed by billing address, **rate not stated**, GSTIN not retroactive | HARD / UNKNOWN |
| `developers.cloudflare.com/turnstile/plans/` | **Unlimited challenges and verification requests on Free and Enterprise**; 20 widgets × 10 hostnames (Free); 200 hostnames/widget (Enterprise) | HARD / SOFT |
| `www.cloudflare.com/bandwidth-alliance/` | **AWS is not a participating provider** | HARD |

### 7.2 Vercel and Next.js

| URL | Established | Class |
|---|---|---|
| `vercel.com/docs/functions/concurrency-scaling` | 30,000 / 100,000 ceilings; **1,000 concurrent per 10 s per region**; 503 `FUNCTION_THROTTLED`, no queueing | HARD |
| `vercel.com/docs/errors/function_throttled` | Corroborates 503; documents mitigation, not queueing or retry | HARD |
| `vercel.com/docs/functions/limitations` | 2 GB/1 vCPU → 4 GB/2 vCPU; 300/800/1800 s; edge 25 s + 300 s; **4.5 MB payload**; **1,024 file descriptors**; 250 MB bundle | HARD |
| `vercel.com/docs/functions/configuring-functions/region` | Regions per plan (**5 — conflicts with the Fluid page's 3**); failover Enterprise-only | HARD |
| `vercel.com/docs/regions` | **`bom1` = ap-south-1, Mumbai**; 20 compute regions, ~126 PoPs; new projects default `iad1` | DEFAULT |
| `vercel.com/docs/limits` | Domains per project; deployments/day; 2,048 routes/deployment; 45-minute build; 120 s proxied-request timeout; **log retention 1 h / 1 day / 3 days**; Global Config and Drains pricing | SOFT / HARD |
| `vercel.com/docs/platforms/multi-tenant-platforms/limits` | **100 domain additions/hour, 50 verifications/hour**; wildcard on all plans consuming one slot; multi-tenant preview URLs and custom SSL Enterprise-only | SOFT / HARD |
| `vercel.com/docs/incremental-static-regeneration` | **Revalidation does not cross domains or subdomains**; **300 ms global purge**; failed-revalidation behaviour | HARD |
| `vercel.com/docs/incremental-static-regeneration/request-collapsing` | Automatic request collapsing, **ISR and Image Optimization only, per region** | DEFAULT |
| `vercel.com/docs/incremental-static-regeneration/limits-and-pricing` | No storage limit, 31-day eviction, **8 KB units**, build-time region pinning, **"no ISR write units are incurred" when content is unchanged** | HARD |
| `vercel.com/docs/caching/runtime-cache` | 2 MB item, 128 tags, 256 B tag; **total storage limit unpublished** | HARD / UNKNOWN |
| `vercel.com/docs/image-optimization/limits-and-pricing` | 10 MB output, 8192×8192 source, format list; bills on MISS and STALE | HARD |
| `vercel.com/docs/builds/managing-builds` · `vercel.com/docs/limits/fair-use-guidelines` | Build concurrency and machines; **middleware ≤50 ms average CPU** | SOFT |
| `vercel.com/docs/manage-cdn-usage` | First 10 ms of each CDN request free; metered in 10 ms increments | DEFAULT |
| `vercel.com/legal/sla` | **99.99% Enterprise only**; credit tiers; **capped at 50% of the monthly fee**; excludes API/CLI and Beta | NEGOTIABLE |
| `www.vercel-status.com/` | Observed 90-day CDN uptime 99.99%; **`bom1` row not captured** | UNKNOWN |
| `vercel.com/docs/plans/pro-plan` · `vercel.com/pricing` | Pro $20 + $20 credit + 1 TB + 10 M edge requests + 1 h edge CPU; Hobby inclusions; add-on prices | — |
| `vercel.com/docs/functions/usage-and-pricing` · `vercel.com/docs/pricing/regional-pricing/bom1` | **All bom1 rates used in §5**: Active CPU $0.140, memory $0.0116, invocations $0.60/M, transfer $0.20/GB, edge requests $2.20/M, **ISR writes $4.40/M**, ISR reads $0.44/M, image and firewall rates | — |
| `vercel.com/docs/pricing/taxes` | VAT/GST added as a separate line from 2026-04-01; **rate not published** | UNKNOWN |
| `nextjs.org/docs/app/guides/caching-without-cache-components` | **"By default, fetch requests are not cached"**; route defaults | DEFAULT |
| `nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents` | Introduced 16.0.0, off by default; **PPR is available only through it** | DEFAULT / HARD |
| `nextjs.org/docs/app/api-reference/functions/cacheLife` · `…/revalidateTag` · `…/updateTag` | Preset profiles; two-argument `revalidateTag` with lazy invalidation; `updateTag` Server-Actions-only immediate expiry; 256-char tags | DEFAULT / HARD |
| `nextjs.org/docs/app/api-reference/directives/use-cache` | In-memory handler does not persist on serverless; **cache key includes the deployment ID** | HARD |
| `nextjs.org/docs/app/guides/upgrading/version-16` | Node ≥20.9; **Turbopack default for `next build`, fails with a webpack config unless `--webpack`**; `minimumCacheTTL` 60 s → 4 h | HARD / DEFAULT |

### 7.3 Supabase, PgBouncer, PostgreSQL, PostgREST

| URL | Established | Class |
|---|---|---|
| `supabase.com/docs/guides/platform/compute-and-disk` | The full 11-row compute ladder: cores, RAM, **direct connections 60→500**, **pooler clients 200→12,000**, IOPS, throughput, max DB, replication slots; gp3/io2 constraints | HARD |
| `supabase.com/pricing` | Plan fees $0 / $25 / $599 / custom; ARM cores; egress, storage, MAU, Realtime, Edge Function, custom-domain, log-drain, branching, MFA, SSO, image-transformation prices | — |
| `supabase.com/docs/guides/platform/manage-your-usage/compute` | Hourly compute rates, **partial hours billed in full**, **$10 credits per organization**, Spend Cap exclusions | DEFAULT |
| `…/manage-your-usage/disk-size` · `…/disk-iops` · `…/disk-throughput` | gp3 $0.125/GB-mo with 8 GB included; io2 $0.195 from the first byte; **IOPS $0.024 above 3,000**; throughput $0.095/MB/s | — |
| `supabase.com/docs/guides/platform/database-size` | **Autoscale at 90%, +50%, 4 modifications/24 h; disk-full ⇒ read-only, clears below 95%**; gp3/io2 maxima; 60 TB Pro/Team ceiling | HARD |
| `supabase.com/docs/guides/platform/backups` | Free none / Pro 7 / Team 14 / Enterprise 30 days; **PITR $100/$200/$400, requires ≥Small, RPO ≈ 2 min, RTO unpublished** | HARD |
| `…/manage-your-usage/read-replicas` | Same compute size, **1.25× disk**, excluded from Spend Cap and Compute Credits, **async ⇒ no read-after-write**, cross-region, load balancer; IPv4 $4 | HARD |
| `…/manage-your-usage/egress` | **Unified quota including Supavisor traffic**; $0.09 uncached / $0.03 cached above 250 GB | SOFT |
| `supabase.com/docs/guides/database/connecting-to-postgres` | Ports 6543 / 5432; **transaction mode does not support prepared statements**; Dedicated Pooler is transaction-mode-only and consumes project compute | HARD |
| `supabase.com/docs/guides/database/connection-management` | Pool shared across ports; **≤40% of max connections when PostgREST is in use**; **numeric default unpublished** | DEFAULT / UNKNOWN |
| `supabase.com/docs/guides/database/postgres/row-level-security` | Five documented RLS optimisations with **99.9%+** measured improvements | SOFT |
| `supabase.com/docs/guides/platform/regions` | **ap-south-1 (Mumbai) available**; AWS regions only | HARD |
| `supabase.com/sla` | **99.9%, Enterprise Order Forms only**; credits capped at 20% of annual fees | NEGOTIABLE |
| `supabase.com/docs/guides/troubleshooting/how-to-change-max-database-connections-_BQ8P5` | `max_connections` is CLI-configurable but hard-codes away from compute-size tracking | DEFAULT |
| `supabase.com/docs/guides/platform/billing-faq` | All invoices in USD; **indirect-tax rollout 2026-05-01 → 2026-06-30; India not named** | UNKNOWN |
| `supabase.com/docs/guides/self-hosting/postgres-upgrade-17` | Self-hosted ships PG 17 — **the hosted default remains unestablished** | UNKNOWN |
| `www.pgbouncer.org/config.html` | Transaction mode: **"Server is released back to pool after transaction finishes"**; **`server_reset_query` "is not used"** in transaction pooling | HARD |
| `www.pgbouncer.org/features.html` | Feature map: SET/RESET, LISTEN, PREPARE/DEALLOCATE, temp tables, **session advisory locks = "Never"** in transaction pooling | HARD |
| `www.postgresql.org/docs/17/sql-set.html` | **The load-bearing `SET LOCAL` proof** *(corrected citation)*; savepoint and function-`SET`-clause traps; warning if used outside a transaction | HARD |
| `…/17/tutorial-arch.html` · `…/runtime-config-connection.html` · `…/runtime-config-resource.html` | One process per connection; `max_connections` restart-only; `work_mem` multiplication; `shared_buffers` guidance | HARD / DEFAULT |
| `…/17/ddl-rowsecurity.html` | **Policies evaluated per row before user quals**; cross-table policy row-share-lock cost | HARD |
| `…/17/explicit-locking.html` | `FOR UPDATE` blocks for the holder's full transaction; **`SELECT FOR UPDATE` causes disk writes**; `FOR NO KEY UPDATE` | HARD |
| `…/17/runtime-config-autovacuum.html` · `…/routine-vacuuming.html` | 0.2 scale factor and worker defaults; **replication slots hold back `xmin` on the primary** | DEFAULT / HARD |
| `…/17/ddl-partitioning.html` · `…/17/limits.html` | Partition when the table exceeds physical memory; "up to a few thousand partitions"; 32 TB relation, 1,600 columns | SOFT / HARD |
| `docs.postgrest.org/en/v12/references/transactions.html` | PostgREST's own per-request `START TRANSACTION` + `set_config(…, true)` pattern — **reference implementation of LetBuyy's planned design at high concurrency** | HARD |

### 7.4 AWS ap-south-1

| URL | Established | Class |
|---|---|---|
| `aws.amazon.com/elasticloadbalancing/pricing/` | **LCU definition** (25 conn/s, 3,000 active/min, 1 GB/h, 1,000 rule evals/s; billed on the highest dimension) | HARD |
| `docs.aws.amazon.com/elasticloadbalancing/latest/application/capacity-unit-reservation.html` | ALB auto-scales; **no published scale rate**; **100-LCU minimum reservation** | UNKNOWN / HARD |
| `…/application/request-capacity-unit-reservation.html` | Fulfilment "minutes to hours"; **decrease twice per day**; regional, evenly distributed across AZs | SOFT / HARD |
| `aws.amazon.com/elasticloadbalancing/sla/` | 99.99% multi-AZ / 99.9% single-AZ; credit tiers | HARD |
| `docs.aws.amazon.com/general/latest/gr/ecs-service.html` | **Fargate 6-vCPU quota** *(SOFT — adjustable and auto-raised)*, ap-south-1 launch rates 20/s and 100 burst, **500 tasks/service/minute not adjustable**, 5,000 tasks/service, 5,000 services/cluster | SOFT / HARD |
| `docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/deployment.html` | **No published Fargate cold-start figure**; `awsvpc` adds "several seconds" | UNKNOWN |
| `docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Limits.html` | **20 RDS instances in ap-south-1** vs 40 elsewhere; `max_connections` formula; 100,000 GB storage quota | SOFT / DEFAULT |
| `…/AuroraUserGuide/AuroraPostgreSQL.Managing.html` · `…/aurora-serverless-v2.setting-capacity.html` · `…/aurora-serverless-v2.how-it-works.html` | Aurora `max_connections`; **ACU→connections table; 2,000 cap when min ACU is 0 or 0.5**; ACU definition; **no absolute scaling rate** | DEFAULT / HARD / UNKNOWN |
| `…/UserGuide/Concepts.MultiAZ.Failover.html` · `…/Concepts.MultiAZSingleStandby.html` | **60–120 s failover**, DNS-based; **standby cannot serve reads** | SOFT / HARD |
| `…/AuroraUserGuide/Concepts.AuroraHighAvailability.html` | <60 s with a replica; **~10 min with none**; RDS Proxy cuts failover "up to 66%" | SOFT |
| `docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html` | Proxy quotas; **16 KB statement ⇒ session pinning; no PostgreSQL pinning filters; no CancelRequest** | SOFT / HARD |
| `…/UserGuide/CHAP_Storage.html` | **gp3 below 400 GiB is hard-capped at 3,000 IOPS**; 400 GiB+ baselines; io2 Block Express range and ratio | HARD |
| `aws.amazon.com/rds/sla/` · `aws.amazon.com/rds/aurora/sla/` | RDS Multi-AZ 99.95% (**definitions exclude Aurora**); Aurora Multi-AZ 99.99% requires 2+ AZs | HARD |
| `docs.aws.amazon.com/AmazonElastiCache/latest/dg/quota-limits.html` · `…/Scaling-serverless.html` | Node and serverless-cache quotas; **30,000 ECPUs/s cache-wide and per slot**; **60-minute pre-scaling lead time** | DEFAULT / HARD |
| `aws.amazon.com/elasticache/pricing/` | **100 MB Valkey minimum metered storage**; ECPU = 1 per KB | HARD |
| `docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html` | 1 MiB message, **14-day maximum retention**, visibility timeouts; **ap-south-1 FIFO 9,000/90,000 vs us-east-1 70,000/700,000** | DEFAULT / SOFT |
| `aws.amazon.com/vpc/pricing/` | Public IPv4 **$0.005/h in-use and idle**; ELB and NAT named as examples | HARD |
| `aws.amazon.com/ec2/pricing/on-demand/` | **Cross-AZ $0.01/GB in each direction**; PrivateLink/NAT/Transit Gateway charges stack | HARD |
| `aws.amazon.com/premiumsupport/plans/` · `…/pricing/` | Basic / **Business Support+ (AWS's stated production minimum)** / Enterprise / Unified Operations; response targets; **greater of $29 or 9/7/5/3%** | HARD / SOFT |
| `aws.amazon.com/tax-help/india/` | **18% IGST (9%+9% in Delhi), INR invoices, GSTIN on payer and every linked account** | HARD |
| `pricing.us-east-1.amazonaws.com/offers/v1.0/aws/{AWSELB,AmazonECS,AmazonEC2,AmazonVPC,AmazonRDS,AmazonElastiCache,AWSQueueService,AmazonCloudWatch,AWSDataTransfer}/current/ap-south-1/` | **Every ap-south-1 rate used in §5.10.** Publication dates: ELB 2026-07-20, ECS 2026-07-07, RDS 2026-08-12, ElastiCache 2026-08-13, CloudWatch 2026-08-06, Data Transfer 2026-07-20, **SQS 2025-08-28 (stale — re-verify)**; NAT rows effective 2026-08-01. The HTML pricing pages render regional tables in JavaScript and surfaced only us-east-1 figures. | — |

### 7.5 Providers

| URL | Established | Class |
|---|---|---|
| `razorpay.com/docs/errors/common/` | `BAD_REQUEST_ERROR` / "Too many requests"; **no numeric rate limit**; *(does **not** carry the HTTP 429 attribution — corrected)* | SOFT |
| `razorpay.com/docs/api/pagination/` | **HTTP 429 is documented here**; a request Rate Limiter exists; **no numeric threshold anywhere** | SOFT |
| `razorpay.com/docs/webhooks/best-practices/` | **5 s response budget; 24 h exponential backoff; auto-disable after 24 h of failure; at-least-once; ordering not guaranteed; `x-razorpay-event-id`** | HARD |
| `razorpay.com/docs/webhooks/validate-test/` | HMAC-SHA256 over the raw body in `X-Razorpay-Signature`; do not parse before verifying | HARD |
| `razorpay.com/docs/api/refunds/normal-refunds-idempotent/` | `X-Refund-Idempotency`, ≥10 chars, BAD_REQUEST on payload change, **409 on concurrent duplicate** | HARD |
| `razorpay.com/docs/api/x/payout-idempotency/` (+ `/make-request/`) | `X-Payout-Idempotency` **mandatory since 2025-03-15**; a fresh key on an in-flight payout creates two payouts | HARD |
| `razorpay.com/docs/api/orders/` | **No idempotency header documented** — "idempoten" does not appear on the page | UNKNOWN |
| `razorpay.com/docs/x/payouts/best-practices/` | **5–10 TPS guidance — the only TPS figure in Razorpay's docs, and it is not the Payment Gateway** | SOFT |
| `razorpay.com/docs/payments/settlements/` | **Domestic T+2 working days; "Working days do not include the bank holidays"; international is merchant-specific** *(both corrected)* | NEGOTIABLE |
| `razorpay.com/docs/payments/refunds/` | Normal 5–7 working days; Instant near-immediate; batch after 70 minutes | DEFAULT |
| `razorpay.com/docs/webhooks/route/` | Route splits, `on_hold`/`on_hold_until`, **linked-account cycle ≥ parent's**; **no published caps** | DEFAULT / UNKNOWN |
| `razorpay.com/docs/oauth/` | Merchant-of-record delegated model; **limits, settlement and KYC belong to the merchant, not the platform** | DEFAULT |
| `upstash.com/docs/redis/overall/pricing` | **10,000 cmd/s (16,000 on the largest tiers)**; PAYG $0.20/100k; **Fixed tiers with unlimited commands from $10** | HARD / — |
| `upstash.com/docs/redis/features/globaldatabase` | **ap-south-1 available**; eventual consistency; **replication billed as commands** | DEFAULT / HARD |
| `upstash.com/docs/redis/sdks/ratelimit-ts/algorithms` · `…/overview` | Three algorithms with stated accuracy caveats; **fails OPEN on timeout by default** | HARD / DEFAULT |
| `upstash.com/docs/common/help/sla` | **99.99% only with Prod Pack ($200/database/month) or Enterprise** | NEGOTIABLE |
| `upstash.com/docs/redis/troubleshooting/max_request_size_exceeded` | 10 MB request size on Free/PAYG | HARD |
| `developers.cloudflare.com/turnstile/plans/` · `…/concepts/widget/` | Unlimited verification; widget and hostname caps; **wildcard/subdomain behaviour not established** | HARD / UNKNOWN |
| `apidocs.shiprocket.in/` · `www.shiprocket.in/developers/` | **Nothing.** JS-rendered SPA returning only a page title. Serviceability endpoint shape from search summaries. **No status page, no SLA.** | UNKNOWN |
| `resend.com/docs/api-reference/introduction` | **10 requests/second per team**, shared across API keys, raisable for trusted senders | SOFT |
| `resend.com/pricing` | Free 3,000/month **and 100/day**, 1 domain; Pro 10 domains; **Scale forced at merchant 11** | HARD |
| `resend.com/docs/dashboard/webhooks/introduction` | Six retries at 5 s / 5 min / 30 min / 2 h / 5 h / 10 h; at-least-once; Svix signatures | HARD |
| `developers.facebook.com/documentation/business-messaging/whatsapp/pricing` | **Per-message since 2025-07-01**; free classes incl. **utility templates inside an open window**; 24 h rolling service window; **India INR rates not machine-fetchable**; volume tiers utility/auth only, portfolio-aggregated | HARD / UNKNOWN |
| `…/whatsapp/pricing/authentication-international-rates/` | 750K/30-day threshold, 30 days' notice; **domestic rate always applies for the primary business location** | HARD |
| `developers.facebook.com/docs/whatsapp/messaging-limits` | **250 / 2,000 / 10,000 / 100,000 / Unlimited** *(2,000 corrected)*; escalation needs ≥50% utilisation over 7 days; **tiers cannot be pre-scaled** | SOFT |
| `developers.facebook.com/docs/whatsapp/cloud-api/overview` | **80 msg/s per business phone number**; **1 message per 6 s to the same user** | SOFT / HARD |
| `developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/` · `…/whatsapp/changelog` | India higher marketing rate 2026-01-01, higher auth-international 2026-04-01; **INR migration mandatory by 2026-12-31, delivery stops 2027-01-01** | HARD |
| `developers.facebook.com/docs/whatsapp/overview/quality-rating` | **HTTP 404 on 2026-08-16 — the page has moved. Quality-rating mechanics are unestablished.** | UNKNOWN |

---

## 8. Cross-references

| Question | Document |
|---|---|
| What law constrains the choices priced here (Never-Build list, single region, one PostgreSQL, envelope) | `02_GOVERNED_ARCHITECTURE.md` |
| Why nothing here is `VERIFIED-LIVE`, and the read-only probes that would change that | `04_LIVE_DEPLOYMENT_TRUTH.md` |
| Where the band definitions, conversion rates and page-view arithmetic come from | `06_10M_WORKLOAD_DEFINITION.md` |
| Which of these limits binds first, in what order, and at what fix class | `07_CAPACITY_MODEL.md` |
| The measurements that would falsify §5 | `07_CAPACITY_MODEL.md` §6 and `13_TEST_AND_LOAD_VALIDATION.md` |
| Evidence states, the verification ladder, and the packet index | `01_EVIDENCE_METHOD_AND_INDEX.md` |
