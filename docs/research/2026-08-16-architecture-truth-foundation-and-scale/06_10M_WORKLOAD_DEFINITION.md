# 06 — Defining "10 Million Concurrent Users" as a Measurable Workload

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> Subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, root `AGENTS.md`, local `AGENTS.md`, and `LETBUYY_CANONICAL_SYSTEMS.md`. Nothing in this document changes the ratified scale envelope (100 → 1,000 → 10,000 merchants). It defines a *hypothetical* workload precisely enough to be tested, so that the ARB can reason about it rather than react to a slogan.
>
> Audited commit `5af69e0c080503765dec361eae2128ba860cf529` · branch `stepup/main` · 2026-08-16.

---

## 0. Why this document exists before any architecture discussion

"10 million concurrent users" is not an engineering requirement. It is ten different requirements wearing the same words, and they differ from each other by **four orders of magnitude** in the infrastructure they imply. Designing against the phrase without resolving it is the single most expensive mistake available here: it produces a distributed system sized for a workload nobody has specified, at a cost nobody has budgeted, to solve a bottleneck nobody has measured.

The rule applied throughout: **no capacity claim without a formula, an input, and a stated assumption.** Where an input is not knowable from the repository, it appears in the Unknown Input Register (§2) rather than being quietly invented.

---

## 1. The ten meanings, separated

Each row is a genuinely different engineering target. The "implied peak origin RPS" column uses the traffic model in §3 and is derived, not asserted.

| # | Reading of "10M users" | Class | What it primarily stresses | Implied peak **origin** dynamic RPS (order of magnitude) | Verdict as a design target |
|---|---|---|---|---|---|
| **S1** | 10M **registered accounts** (cumulative) | Stock | Storage, index size, backup/restore time, GDPR/DPDP erasure throughput | ~0 (it is not a request rate at all) | Cheap. A stock of 10M rows is unremarkable for one PostgreSQL. |
| **S2** | 10M **monthly active users** | Flow (monthly) | Nothing, by itself | ~10² | Modest. MAU without a concurrency figure says almost nothing. |
| **S3** | 10M **daily active users** | Flow (daily) | Read path, cache hit ratio, catalog serving | ~10³ | Demanding but tractable. **This is the most plausible business reading.** |
| **S4** | 10M **visitors within one peak hour** | Flow (hourly burst) | Burst absorption, cold-cache behaviour, autoscale latency | ~10⁴ | Hard. A flash-sale shape. |
| **S5** | 10M **simultaneously online sessions, mostly idle** | Concurrency (sessions) | Session storage, cache hit ratio, connection budget | ~10⁵ | Very hard. Dominated by the *uncacheable* fraction. |
| **S6** | 10M **simultaneous long-lived connections** (WebSocket/SSE) | Concurrency (sockets) | Connection state, memory, edge socket capacity | ~0 steady RPS, but 10M held sockets | Different problem entirely. LetBuyy holds no long-lived connections today. |
| **S7** | 10M **concurrently active shoppers issuing requests** | Concurrency (active) | Everything, simultaneously | ~10⁶ | Extreme. Above India's largest e-commerce peak. |
| **S8** | 10M **concurrent in-flight HTTP requests** | Concurrency (in-flight) | Thread/isolate/connection exhaustion everywhere | 10⁷–10⁸ (see §3.5) | Effectively unbounded. Almost certainly a misstatement. |
| **S9** | **10M requests per minute** (166,667 RPS) | Rate | Edge and origin compute | ~10⁴ after cache | Hard but a real, nameable target. |
| **S10** | **10M requests per second** | Rate | Everything | 10⁶–10⁷ | Among the largest applications on earth. Not a LetBuyy target. |

### 1.1 The reading the founder most likely means

Business ambition normally expresses itself as *audience*, not as *request rate*. When a founder says "10 million concurrent users," the underlying business statement is usually **S3 (10M daily active users)** or **S5 (10M simultaneously online)** — "a platform that a very large fraction of India shops on."

This matters because S3 and S5 differ by roughly **100× in origin load** while describing what a non-engineer would call the same success. The whole of §3 exists to make that difference explicit.

### 1.2 The market reality check (state this to the founder before any architecture conversation)

India has on the order of 900M internet users. Under **S7**, 10M *concurrently active* shoppers would be roughly **1.1% of every internet user in India shopping on LetBuyy at the same instant.** Publicly reported peak concurrency for India's largest sale events sits in the low millions across the entire market. So:

- **S3 (10M DAU)** describes LetBuyy becoming a top-tier Indian commerce platform. Ambitious, coherent, and reachable in principle.
- **S7/S10** describe LetBuyy being **larger at peak than the current Indian e-commerce market combined.** That is a market-share hypothesis, not an architecture requirement — and it should be decided by the founder as a business question before a single line of infrastructure is designed against it.

`HUMAN-REQUIRED` — **Decision D-1: which scenario is the target?** No architecture recommendation in this packet is valid without it. Everything downstream is modelled across S3, S5, and S7 so that the answer can be supplied late.

---

## 2. Unknown Input Register

These values cannot be derived from the repository. Each is `HUMAN-REQUIRED` unless marked otherwise. The low/base/high columns are **assumptions for sensitivity analysis only** — they are industry-shaped placeholders, explicitly **not** LetBuyy facts, and must not be cited as such.

### 2.1 Merchant-side inputs

| # | Input | Low | Base | High | Notes |
|---|---|---|---|---|---|
| M-1 | Merchants on platform | 10,000 | 100,000 | 1,000,000 | Governed envelope caps this at 10,000. Anything above is out of envelope by constitutional rule. |
| M-2 | Merchants receiving traffic at peak | 5% | 15% | 40% | Long-tail commerce is extremely skewed. |
| M-3 | Products per merchant (median / p99) | 20 / 500 | 60 / 2,000 | 200 / 20,000 | Drives catalog cardinality and cache footprint. |
| M-4 | Variants per product | 1 | 3 | 12 | |
| M-5 | Images per product / avg bytes | 2 / 120 KB | 4 / 250 KB | 10 / 600 KB | Drives R2 storage and transformation cost. |
| M-6 | Merchant admin sessions concurrent at peak | 0.5% of M-1 | 2% of M-1 | 8% of M-1 | Admin traffic is uncacheable and query-heavy. |
| M-7 | Share of stores on custom domains | 5% | 20% | 60% | Drives the Vercel/CF domain-count ceiling — a hard platform limit, see `10_VENDOR_LIMITS_AND_COSTS.md`. |

### 2.2 Buyer-side inputs

| # | Input | Low | Base | High | Notes |
|---|---|---|---|---|---|
| B-1 | Registered buyers | 1M | 20M | 200M | Storage/erasure driver (S1). |
| B-2 | DAU / MAU ratio | 0.08 | 0.15 | 0.30 | |
| B-3 | Sessions per active user per day | 1.1 | 1.3 | 2.0 | |
| B-4 | Page views per session | 3 | 6 | 14 | |
| B-5 | Session duration (min) | 1.5 | 4 | 12 | Sets the online-concurrency ↔ DAU conversion. |
| B-6 | User actions per online-minute | 0.3 | 0.8 | 2.5 | The single most sensitive input for S5. |
| B-7 | Dynamic requests per page view | 2 | 4 | 8 | Excludes static assets. Must be measured, see §3.2. |
| B-8 | Logged-in buyer share | 10% | 30% | 70% | Logged-in ⇒ personalised ⇒ **uncacheable**. Dominant cost driver. |
| B-9 | Browse→cart rate | 3% | 8% | 18% | |
| B-10 | Cart→checkout rate | 25% | 40% | 60% | |
| B-11 | Session→order conversion | 0.5% | 1.5% | 4% | Indian long-tail D2C is at the low end. |
| B-12 | Peak-to-average multiplier (daily) | 2.5× | 4× | 8× | Indian evening peak (20:00–23:00 IST). |
| B-13 | Flash-sale multiplier over daily peak | 3× | 10× | 60× | Single-tenant hotspot, see Band E. |
| B-14 | Bot / crawler share of storefront traffic | 10% | 30% | 60% | Frequently underestimated; hits cold cache keys hardest. |

### 2.3 Payment / fulfilment inputs

| # | Input | Low | Base | High |
|---|---|---|---|---|
| P-1 | COD share of orders | 20% | 45% | 70% |
| P-2 | UPI share of prepaid | 50% | 75% | 90% |
| P-3 | Provider calls per prepaid order | 2 | 3 | 5 |
| P-4 | Webhook deliveries per order (incl. retries) | 1.2 | 2.5 | 8 |
| P-5 | Refund rate | 1% | 4% | 12% |
| P-6 | RTO rate on COD | 8% | 20% | 40% |

### 2.4 Operational / commercial inputs

| # | Input | Status |
|---|---|---|
| O-1 | Target SLOs per surface (p50/p95/p99, availability) | `HUMAN-REQUIRED` — none defined in repository. See `09_FAILURE_MODES_RECOVERY.md`. |
| O-2 | Error budget policy | `HUMAN-REQUIRED` — absent. |
| O-3 | RTO / RPO | `HUMAN-REQUIRED` — see `config/runtime/database-recovery-policy.json` for declared policy; no exercised proof. |
| O-4 | Monthly infrastructure budget ceiling | `HUMAN-REQUIRED` — determines which options in `11_ARCHITECTURE_OPTIONS.md` are even admissible. |
| O-5 | Engineering headcount and on-call roster | `HUMAN-REQUIRED` — **this constrains architecture more than any technical limit.** A 3-service estate and a 20-service estate need different teams, not different diagrams. |
| O-6 | Acceptable staleness per data class | `HUMAN-REQUIRED` — see §4. Catalog may tolerate 60s; inventory count may not; price must not. |
| O-7 | Data-residency obligation | `HUMAN-REQUIRED` + `LEGAL-REVIEW-REQUIRED` — see `08_SECURITY_PRIVACY_COMPLIANCE.md`. |

---

## 3. The workload equations

All formulas below are stated with units. `→` marks a derived value.

### 3.1 From audience to action rate

```
concurrent_online_sessions  =  DAU × (session_duration_min / minutes_active_per_day)
                                   × peak_concentration_factor

user_action_rate (actions/s) =  concurrent_online_sessions × actions_per_online_minute / 60
```

`minutes_active_per_day` is the window over which a day's sessions are spread. For Indian commerce the effective window is ~6 h of meaningful traffic with a 3 h evening peak; use 360 min with `peak_concentration_factor ≈ 2.2` for the peak hour.

### 3.2 From actions to requests

```
total_request_rate      =  user_action_rate × requests_per_action
dynamic_request_rate    =  user_action_rate × dynamic_requests_per_action   [B-7]
static_request_rate     =  total_request_rate − dynamic_request_rate

origin_request_rate     =  dynamic_request_rate × (1 − effective_cache_hit_ratio)
```

**The critical decomposition** — a single blended hit ratio hides the real driver:

```
origin_request_rate  =  cacheable_rate   × (1 − hit_ratio_cacheable)
                      + uncacheable_rate × 1.0
```

Where `uncacheable_rate` covers: logged-in personalised responses, cart reads/writes, checkout steps, inventory counts, merchant admin, and anything varying by buyer. **As uncacheable share rises, the cache stops mattering.** §5 quantifies this; it is the dominant sensitivity in the entire model.

### 3.3 From requests to database load

```
db_query_rate (QPS)   =  Σ over routes ( route_origin_RPS × mean_db_queries_per_route )
db_txn_rate  (TPS)    =  Σ over mutations ( mutation_RPS × txns_per_mutation )

concurrent_db_txns    =  db_txn_rate × mean_txn_duration_s          [Little's Law]
concurrent_db_queries =  db_query_rate × mean_query_duration_s      [Little's Law]

required_pooled_conns =  concurrent_db_queries / target_conn_utilisation
                         (target_conn_utilisation ≈ 0.7 to leave headroom for p99 tails)
```

`mean_db_queries_per_route` is **implementation-determined** and must be read from source, not assumed — see `07_CAPACITY_MODEL.md`, which populates it from the flow traces in `03_CURRENT_ARCHITECTURE_AS_BUILT.md`.

### 3.4 From orders to downstream fanout

```
order_rate (orders/s)  =  session_rate × session_to_order_conversion            [B-11]
payment_provider_rate  =  order_rate × prepaid_share × calls_per_order × retry_amplification
outbox_event_rate      =  Σ ( domain_mutation_TPS × events_per_mutation )
queue_delivery_rate    =  outbox_event_rate × mean_fanout × retry_amplification
notification_rate      =  order_rate × messages_per_order_lifecycle
```

`retry_amplification` is **not** 1. For at-least-once queue delivery with `max_retries = R` and a failure rate `f`:

```
retry_amplification ≈ 1 + f + f² + … ≈ 1/(1−f)   for f < 1, capped at (1 + R)
```

A 10% handler failure rate with `R = 3` gives ~1.11× steady-state but **4× during an incident** — which is exactly when the downstream dependency is already struggling. Retry storms are a *correlated* load, not an independent one.

### 3.5 Little's Law applied to the "concurrent requests" reading (S8)

```
L = λ × W    ⇒    λ = L / W
```

| Held requests `L` | Mean latency `W` | Implied arrival rate `λ` |
|---|---|---|
| 10,000,000 | 100 ms | **100,000,000 RPS** |
| 10,000,000 | 1 s | 10,000,000 RPS |
| 10,000,000 | 30 s (long-poll) | 333,000 RPS |

**Conclusion:** S8 at normal web latencies is not a coherent target — it implies 100M RPS. If someone genuinely means "10M concurrent," they almost always mean **held sessions (S5)** or **held sockets (S6)**, not in-flight requests. Record this and move on.

### 3.6 Bytes and growth

```
egress_bytes_per_s   =  Σ ( request_rate_class × mean_response_bytes_class )
daily_data_growth    =  Σ ( record_rate × bytes_per_record × (1 + index_overhead) )
```

`index_overhead` for a well-indexed OLTP table is commonly 0.5–1.5×; the ledger, being append-only with several lookup indexes, sits at the high end.

---

## 4. Traffic mix matrix (the model)

Cells marked `[SRC]` must be populated from source measurement in `07_CAPACITY_MODEL.md` — they are implementation facts, not assumptions.

| Class | Share of actions | Cacheable | Target hit % | Origin CPU | DB reads | DB writes | Lock/txn | Provider calls | Queue events | Freshness need | Idempotent? | Degradation strategy |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Static asset | ~60% of *requests* | Yes | 99%+ | none | 0 | 0 | — | 0 | 0 | immutable (hashed) | n/a | serve stale |
| Storefront HTML | 20% | Yes (per-tenant) | 85–95% | `[SRC]` | `[SRC]` | 0 | none | 0 | 0 | 30–300 s | n/a | serve stale |
| Catalog API (list/detail) | 25% | Yes | 90–97% | `[SRC]` | `[SRC]` | 0 | none | 0 | 0 | 30–300 s | n/a | serve stale |
| Search | 5% | Partly | 40–70% | `[SRC]` | `[SRC]` | 0 | none | 0 | 0 | 60 s | n/a | degrade to category browse |
| Buyer session verify | 15% | No (per-user) | 0% | `[SRC]` | `[SRC]` | 0 | none | 0 | 0 | immediate | n/a | **must not fail open** |
| Cart read | 8% | No | 0% | `[SRC]` | `[SRC]` | 0 | none | 0 | 0 | immediate | n/a | none |
| Cart mutation | 4% | No | 0% | `[SRC]` | `[SRC]` | `[SRC]` | row | 0 | 0 | immediate | required | queue/retry |
| Shipping quote | 1.5% | Partly (pincode×zone) | 60–90% | `[SRC]` | `[SRC]` | 0 | none | 0–1 | 0 | 1 h | n/a | fall back to flat rate |
| Checkout step | 1.5% | No | 0% | `[SRC]` | `[SRC]` | `[SRC]` | row | 0 | 0 | immediate | required | **none — must work** |
| Inventory reserve | 1% | No | 0% | `[SRC]` | `[SRC]` | `[SRC]` | **row lock, hot SKU** | 0 | 0 | immediate | required | **none — correctness-critical** |
| Payment initiate | 0.8% | No | 0% | `[SRC]` | `[SRC]` | `[SRC]` | row | 1 | 0–1 | immediate | required | none |
| Payment verify | 0.8% | No | 0% | `[SRC]` | `[SRC]` | `[SRC]` | row | 0–1 | 1+ | immediate | **required** | none |
| Provider webhook | 1–3% | No | 0% | `[SRC]` | `[SRC]` | `[SRC]` | row | 0 | 1+ | seconds | **required** | 200-then-queue |
| Order status | 3% | Short TTL | 50–80% | `[SRC]` | `[SRC]` | 0 | none | 0 | 0 | 30 s | n/a | serve stale |
| Merchant dashboard | 2% | No | 0% | `[SRC]` | `[SRC]` (**N+1 risk**) | 0 | none | 0 | 0 | 60 s | n/a | degrade widgets |
| Product mutation | 0.5% | No | 0% | `[SRC]` | `[SRC]` | `[SRC]` | row | 0 | 1 | immediate | required | queue |
| Theme publish | 0.05% | No | 0% | `[SRC]` | `[SRC]` | `[SRC]` | row | 0 | 1 | immediate | required | queue |
| Media upload | 0.2% | No | 0% | `[SRC]` | `[SRC]` | `[SRC]` | none | 1 (R2) | 1 | immediate | required | reject with retry |
| Analytics ingest | 2% | No | 0% | `[SRC]` | 0 | `[SRC]` | none | 0 | 1 | minutes | best-effort | **shed first** |
| Notification fanout | derived | No | 0% | `[SRC]` | `[SRC]` | `[SRC]` | none | 1 | — | minutes | required | queue + backoff |

**Reading of the matrix:** the rows that *cannot* be cached, *cannot* be sharded by tenant without care, and *cannot* be shed — buyer session verify, cart, checkout, inventory reserve, payment verify, webhook — are collectively a small share of *actions* but essentially **all** of the correctness risk and a large share of origin load at scale. Capacity work should target exactly these rows; caching work targets the rest.

---

## 5. Capacity bands

All bands use base-case inputs from §2 unless stated. Derivations use §3. **These are model outputs, not measurements**; `07_CAPACITY_MODEL.md` tests them against the implementation.

### Band G — the current governed envelope (constitutional)

| Parameter | Value | Derivation |
|---|---|---|
| Merchants | 10,000 | Constitution §6 |
| Orders / month | 30,000 | Constitution §6 |
| Orders / day | 1,000 | 30,000 / 30 |
| Sessions / day @ 1.5% conversion | 66,667 | 1,000 / 0.015 |
| Page views / day @ 6/session | 400,000 | |
| Avg page views/s | 4.6 | 400,000 / 86,400 |
| **Peak page views/s** @ 4× | **18.5** | |
| Peak dynamic RPS @ 4/action | 74 | |
| **Peak origin RPS** @ 90% blended hit | **~7–20** | Range reflects uncacheable share 10–25% |
| **Peak order rate** | **0.046 /s** (1 order / 22 s) | |
| Peak DB write TPS | < 1 | |

> **Finding W-1.** At the top of the *ratified* envelope, LetBuyy's peak origin load is on the order of **tens of requests per second and one order every twenty seconds.** This is not a scaling problem. It is comfortably inside a single small PostgreSQL instance and a single Worker. Any architecture work justified as "we need it for scale" at this envelope is, by arithmetic, justified by something else — usually correctness, which is the honest and better reason. Evidence state: `INFERRED` from constitutional inputs; the arithmetic is deterministic.

### Band A — 100k simultaneously online, browse-heavy (S5 ÷ 100)

| Parameter | Value |
|---|---|
| Concurrent online sessions | 100,000 |
| Action rate @ 0.8/min | 1,333 /s |
| Dynamic RPS @ 4 | 5,333 |
| Origin RPS @ 70% cacheable, 95% hit, 30% uncacheable | **1,787** |
| Origin RPS if uncacheable share drops to 10% | **720** |
| Est. DB QPS @ 2.5 queries/origin-req | ~4,500 |
| Concurrent DB queries @ 2 ms | ~9 |
| Required pooled connections @ 0.7 util | **~13** |
| Orders/s (peak) | ~1.9 |

**Verdict:** comfortably within one well-tuned PostgreSQL. Approximately **100×** the governed envelope, and still not a topology problem.

### Band B — 1M simultaneously online, browse-heavy

| Parameter | Value |
|---|---|
| Concurrent online sessions | 1,000,000 |
| Action rate | 13,333 /s |
| Dynamic RPS | 53,333 |
| Origin RPS @ 30% uncacheable | **17,867** |
| Origin RPS @ 10% uncacheable | **7,200** |
| DB QPS @ 2.5 | ~45,000 |
| Concurrent DB queries @ 2 ms | ~90 |
| Required pooled connections | **~129** |
| Orders/s (peak) | ~19 |
| Orders/month equivalent | ~5M (**167× the envelope**) |

**Verdict:** the **first genuinely hard band.** ~45k QPS on a single PostgreSQL is achievable only with a large instance, disciplined indexing, and a high cache hit ratio; p99 latency and lock behaviour become the constraint before raw CPU does. This is where read-scaling (Option 2) earns its evaluation.

### Band C — 10M simultaneously online, browse-heavy (**S5, the headline reading**)

| Parameter | Value |
|---|---|
| Concurrent online sessions | 10,000,000 |
| Action rate @ 0.8/min | 133,333 /s |
| Dynamic RPS @ 4 | 533,333 |
| Origin RPS @ 30% uncacheable, 95% hit on rest | **178,667** |
| Origin RPS @ 10% uncacheable, 97% hit on rest | **57,333** |
| Origin RPS @ 5% uncacheable, 99% hit on rest | **30,933** |
| DB QPS @ 2.5 (30% uncacheable case) | ~447,000 |
| Concurrent DB queries @ 2 ms | ~894 |
| **Required pooled connections** | **~1,277** |
| Orders/s (peak) | ~190 |
| Orders/month equivalent | ~49M (**1,640× the envelope**) |

> **Finding W-2.** Band C's binding constraint is **not** order throughput — 190 orders/s is large but not exotic. It is (a) the **uncacheable request rate**, and (b) the **PostgreSQL connection and query budget** that follows from it. Moving uncacheable share from 30% → 5% cuts origin load by **5.8×** and is dramatically cheaper than any topology change. **Cache architecture, not service decomposition, is the first-order lever at this band.**

### Band D — 10M concurrently *active* request-generating shoppers (**S7**)

| Parameter | Value |
|---|---|
| Concurrent active users | 10,000,000 |
| Action rate @ 6/min (one action / 10 s) | 1,000,000 /s |
| Dynamic RPS @ 4 | 4,000,000 |
| Origin RPS @ 10% uncacheable, 97% hit | **~508,000** |
| DB QPS @ 2.5 | ~1,270,000 |
| Required pooled connections @ 2 ms | **~3,630** |
| Orders/s (peak) @ 1.5% of a much larger session rate | 10³ order of magnitude |

**Verdict:** Band D cannot be served by a single PostgreSQL under any tuning. It is the first band that genuinely requires horizontal data partitioning — i.e. the first band where a constitutional amendment is *technically* forced rather than merely requested. It is also, per §1.2, a band that implies market dominance.

### Band E — single-tenant flash-sale hotspot (**skew, not volume**)

The dangerous band, and the one most likely to actually occur first.

| Parameter | Value |
|---|---|
| Platform-wide load | Band A (modest) |
| One merchant's share of traffic | 70–95% |
| Concurrent buyers on that one store | 50,000–500,000 |
| Buyers contending for **one hot SKU** | 10,000+ |
| Inventory reserve attempts/s on one row | 500–5,000 |

> **Finding W-3.** A single-row `UPDATE … FOR UPDATE` on one inventory row **serialises**. Regardless of instance size, the ceiling is `1 / lock_hold_time`. At a 2 ms hold, that is ~500 reserves/s **for that SKU** — and every waiter occupies a connection while queued, so a hot SKU can exhaust the *global* connection pool and take down unrelated tenants. **This is a correctness-and-isolation problem that appears far below Band B, and it is not solved by adding capacity.** Mitigations (queue-at-the-door, per-SKU sharded counters, admission control, reservation batching) belong in `12_TRIGGER_BASED_EVOLUTION.md`. Evidence state: `INFERRED` — the actual lock hold time must be measured; see `07_CAPACITY_MODEL.md`.

### Band F — webhook retry storm concurrent with checkout peak

| Parameter | Value |
|---|---|
| Baseline webhook rate | order_rate × P-4 |
| Provider recovers after a 15-min outage | Entire backlog delivered in minutes |
| Amplification | Up to `(1 + max_retries)` × backlog compression factor |

The failure mode: the payment provider's own recovery delivers a compressed backlog **while** checkout traffic is peaking, so the write path is hit twice simultaneously. Because webhook handlers write to the same tables as checkout, this is a *correlated* load. Any capacity plan that models webhooks as independent background load is wrong.

---

## 6. Sensitivity analysis — what actually moves the number

Origin RPS at Band C (10M online), varying the two dominant inputs. All other inputs at base.

| Uncacheable share ↓ / Hit ratio on cacheable → | 90% | 95% | 97% | 99% |
|---|---|---|---|---|
| **40%** | 245,333 | 229,333 | 222,933 | 216,533 |
| **30%** | 197,333 | 178,667 | 171,200 | 163,733 |
| **20%** | 149,333 | 128,000 | 119,467 | 110,933 |
| **10%** | 101,333 | 77,333 | 67,733 | 58,133 |
| **5%** | 77,333 | 51,967 | 41,813 | 31,660 |

**Read the columns, then the rows.** Improving cache hit ratio from 90% → 99% at a 40% uncacheable share buys **12%**. Reducing uncacheable share from 40% → 5% at a fixed 95% hit ratio buys **77%**. 

> **Finding W-4.** The highest-leverage capacity investment available to LetBuyy is **reducing the uncacheable fraction of storefront traffic** — i.e. making logged-in and personalised pages cacheable (edge-side composition, deferred personalisation, cacheable shells with client-hydrated islands). This is an application-architecture change, costs no new infrastructure, requires no constitutional amendment, and is worth more than an order of magnitude of hardware. It should be the first item in `14_FOUNDATION_ACTION_REGISTER.md` that is capacity-motivated.

### 6.1 Second-order sensitivities, ranked

| Rank | Input | Effect on Band C origin load | Notes |
|---|---|---|---|
| 1 | Uncacheable share (B-8 driven) | up to **8×** | See above. |
| 2 | `dynamic_requests_per_action` (B-7) | **linear** | Halving chatty client fetches halves origin load. Measured, not assumed. |
| 3 | `actions_per_online_minute` (B-6) | **linear** | Definitional — this is what "concurrent" means. Must be pinned by the founder. |
| 4 | `db_queries_per_route` | **linear on DB** | N+1 elimination is pure profit. |
| 5 | Cache hit ratio on cacheable | ≤ 1.15× | Real but secondary once (1) is fixed. |
| 6 | Peak-to-average multiplier (B-12) | linear on **peak** | Drives provisioning, not steady-state cost. |
| 7 | Bot share (B-14) | linear, and hits **cold** keys | Bot management is a capacity lever, not only a security one. |

---

## 7. What this document establishes

1. **"10M concurrent users" spans four orders of magnitude** across readings S1–S10 and cannot be used as a requirement until the founder selects one (`Decision D-1`).
2. **The governed envelope (Band G) implies ~20 origin RPS and one order per 22 seconds.** No topology change is arithmetically justifiable at that band.
3. **Band A (100k online) — roughly 100× the envelope — is still comfortably a single-PostgreSQL workload.** This is the most important finding for a founder worried about the foundation: the current shape has a great deal of headroom above its own ratified target.
4. **Band B (1M online) is the first genuinely hard band**, constrained by connection count and query rate, not by order volume.
5. **Band C (10M online) is dominated by the uncacheable fraction**, and is 1,640× the ratified envelope in order terms.
6. **Band D (10M active) exceeds single-PostgreSQL feasibility** under any tuning and would force a constitutional amendment on technical grounds.
7. **Band E (hot-SKU skew) bites far earlier than any volume band** and is a correctness/isolation problem that capacity cannot fix.
8. **The dominant lever is application-level cacheability, not infrastructure topology** — worth up to 8× versus ≤1.15× for cache-hit tuning.

---

## 8. Falsification criteria

Every number above is a model output. Each is falsifiable by a specific measurement, listed in `13_TEST_AND_LOAD_VALIDATION.md`:

| Claim | Falsified by |
|---|---|
| `dynamic_requests_per_action ≈ 4` | Real browser trace of a storefront session; count non-static requests. |
| `db_queries_per_route` values | Query-count instrumentation on each route under a synthetic session. |
| `mean_txn_duration ≈ 2 ms` | `pg_stat_statements` mean_exec_time on the checkout/reserve statements. |
| Hot-SKU serialisation ceiling | Contention test: N concurrent reserves on one SKU, measure achieved throughput. |
| Uncacheable share | Production (or staging) cache-hit telemetry by route class — **not currently emitted**; see `04_LIVE_DEPLOYMENT_TRUTH.md`. |
| Connection requirement | Load test at fixed RPS, observe pool wait time and active backends. |

Until those measurements exist, every band figure in this document is `INFERRED` and must be labelled as such wherever it is cited.
