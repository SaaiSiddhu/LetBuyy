# Phase J — Scale Audit

**HEAD `ae383bb8`. Architecture-bounded (the repo proves design, not a runtime ceiling).**

## By merchant count
| Scale | Verdict | Basis |
|---|---|---|
| 100 merchants | ✅ ~$30–50/mo | Supabase Pro + Workers Paid + Resend paid; Hyperdrive pooling; first wall = DB connections/size |
| 1,000 merchants | ✅ few-hundred/mo | same architecture; watch single-region write capacity (orders/ledger) |
| 10,000 merchants | ⚠️ needs tuning | dedicated Postgres tier, read replicas for reporting, queue throughput raise; no redesign |

## By concurrent users
| Concurrency | Reads | Writes (checkout/ledger/inventory) |
|---|---|---|
| 1k | ✅ | ✅ |
| 10k | ✅ (ISR+KV edge) | ✅ with headroom |
| 100k | ✅ browsing absorbable | ❌ single-region Postgres write path is the ceiling |

## Bottleneck ranking (breaks first → last)
1. **Supabase Postgres WRITES** — checkout→order→ledger(double-entry trigger)→inventory-reservation is a multi-statement txn on one regional Postgres via Hyperdrive (`tenant-transaction.ts:20–24`, `maxConnections:3`, `PRIMARY_REGION=ap-south-1`). Row-lock contention on hot SKUs/ledger caps concurrent checkouts well below 100k.
2. **Inventory reservation contention** — `FOR UPDATE` reservation RPCs serialize on popular SKUs (correctness-over-throughput, intended).
3. **Postgres connections** — Hyperdrive caps blast radius, not the DB itself.
4. **Checkout origin + Razorpay** — external PSP rate limits.
5. **Queues / email** — backpressure gracefully (circuit breaker, DLQ, claim budget 25); degrade, not fail. Prod queue drain on a 15-min cron (`wrangler.toml:233`).
6. **(last) Reads** — ISR `revalidate=60` + KV + edge Workers; 100k concurrent browsers absorbable.

## Bottlenecks by layer
- **Database:** the ceiling (single region, write-serialized money path). Multi-region write is constitutionally frozen → ARB-gated V2.
- **Queues:** throttled for free-tier (25/batch, cron drain) — raise limits + continuous consumers for volume.
- **Email:** Resend volume tier.
- **Storage/Bandwidth:** R2 + edge cache scale; R2 egress is the cost lever at high scale.
- **Workers:** free req/day is an early wall; Workers Paid removes it.

**Verdict: comfortably sufficient for V1 (10–1,000 merchants, normal traffic). 100k *concurrent checkouts* is out of V1 scope and bounded by the single-region write path — a deliberate trade, not a bug. Do not promise 100k concurrent checkout; 100k concurrent browsing is fine.**
