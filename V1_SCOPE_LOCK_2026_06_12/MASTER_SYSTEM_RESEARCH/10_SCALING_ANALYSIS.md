# 10 — SCALING ANALYSIS (100K concurrent users)

**Architecture-bounded analysis.** The repo proves the architecture; it cannot prove a runtime concurrency ceiling. What follows is engineering reasoning from the repo's design + published platform behavior, with the layers ordered by where they break.

## What breaks first → last at 100k concurrent

| Rank | Layer | Behavior at 100k concurrent | Why |
|---|---|---|---|
| **1 (breaks first)** | **Supabase Postgres — WRITES** | The bottleneck. Checkout→order→ledger(double-entry trigger)→inventory-reservation is a multi-statement transaction on a **single regional Postgres**. Write IOPS + lock contention on hot rows (inventory, ledger) cap concurrent checkouts well below 100k. | One region (Constitution; multi-region is a frozen seam). Reads scale; writes don't. |
| 2 | **Inventory reservation contention** | Row-locked reservation RPCs serialize on popular SKUs → checkout latency/timeouts under a flash crowd. | Correctness-over-throughput design (intended). |
| 3 | **Postgres connections** | Even with **Hyperdrive** pooling, a write storm exhausts the pool. | Hyperdrive caps the blast radius but not the DB itself. |
| 4 | **Checkout origin + Razorpay** | The hosted checkout origin + Razorpay rate limits gate payment throughput. | External PSP limits. |
| 5 | **Queues / email** | Async (events/analytics/search/email) backpressures gracefully (circuit breaker, dead-letter, claim budget 25) — degrades, doesn't fail. | Designed for backpressure. |
| **last (well-cached)** | **Reads: storefront/products/collections** | ISR (`revalidate=60`) + 3-tier KV cache + Workers serve read traffic at the edge; 100k concurrent *browsers* is absorbable. | Stateless edge + cache. |

## The headline

**Reads survive 100k concurrent; writes (checkout/orders/ledger/inventory) do not** — the single-region Postgres write path is the ceiling. This is a deliberate architecture trade (one region, correctness-first money), not a bug.

## Required changes to actually serve 100k *concurrent checkouts* (not V1 scope)

These are V2+/post-PMF and several are **constitutionally frozen** (would need ARB):
- **DB write scale:** read replicas (reads), partition/shard hot write tables further, queue-based checkout (accept→async-reserve), or a higher Postgres tier. Multi-region write is frozen.
- **Inventory:** optimistic/queued reservation instead of pessimistic row locks for flash-sale SKUs.
- **Checkout:** the reserve-with-TTL design already helps; add admission control / queue for flash crowds.
- **Cost at that scale:** dedicated Postgres (compute-optimized), Workers Paid at volume, Resend volume tier, R2 egress — i.e. thousands/mo, not tens. The repo contains no cost data for this; treat as planning, not fact.

## What does NOT need changing

The stateless Worker + Hyperdrive + KV/ISR + queue design is the right foundation and scales reads horizontally without redesign. The money/identity/tenancy invariants are scale-neutral.

**Verdict:** for **V1 (10–1000 merchants, normal traffic)** the architecture is comfortably sufficient. **100k *concurrent checkouts*** is out of V1 scope and bounded by the single-region Postgres write path — a known, deliberate trade requiring ARB-gated V2 work to lift. Do not promise 100k concurrent checkout on V1; do expect 100k concurrent *browsing* to be fine.
