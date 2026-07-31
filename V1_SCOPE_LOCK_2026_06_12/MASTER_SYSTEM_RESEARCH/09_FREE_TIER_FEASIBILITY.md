# 09 — FREE-TIER FEASIBILITY

**Architecture-bounded analysis.** The repo proves the *architecture* and the *bindings*; it does not contain runtime traffic or a billing plan, so merchant-capacity numbers are engineering estimates grounded in published platform limits + the repo's design (stateless Workers, Hyperdrive-pooled Postgres, KV+ISR cache, queue fanout). Treat thresholds as order-of-magnitude, not guarantees.

## Can LetBuyy run on free / $5 tiers?

| Merchants | Verdict | Binding constraint |
|---|---|---|
| **10** | ✅ **Yes**, on near-free | Supabase Free (500MB/60-conn) + Workers Free + Resend Free + Vercel; Hyperdrive keeps connections low. Comfortable. |
| **100** | 🟡 **Borderline** | Supabase Free DB size (500MB) and connection pressure become the first limit; Resend Free send cap (~3k/mo) is hit by lifecycle emails; Vercel commercial licensing. → move to **Supabase Pro $25 + Workers Paid $5 + Resend paid** ≈ **$30–50/mo**. |
| **500** | 🟡 **Paid-tier required** | Supabase Pro (8GB) + connection scaling via Hyperdrive; Workers Paid; Resend volume tier; R2 egress. ≈ **$50–150/mo**. |
| **1000** | 🟢 **Yes on modest paid** | Same shape scaled; the single-region Postgres write capacity is the thing to watch (orders/ledger), not the app tier. ≈ **$150–400/mo** depending on order volume. |

## First three bottlenecks (in order)

1. **Supabase Free tier** — 500MB DB + ~60 pooled connections + inactivity pause. With 237 tables and a write-hot ledger/outbox, DB *size* and *connection* limits bite before app compute does. Hyperdrive mitigates connections; DB size forces Pro by ~100 merchants. **First bottleneck.**
2. **Resend Free send volume** — lifecycle emails (order confirm/shipped/cancelled/refunded) per order quickly exceed the free monthly cap; needs a paid Resend plan as order volume grows. **Second.**
3. **Cloudflare Workers Free req/day + CPU** — 100k req/day and 10ms CPU. The stateless gateway is efficient and ISR/KV-cached reads offload most storefront traffic, so this bites later than Supabase — the **$5 Workers Paid** plan removes it cheaply. **Third.**

## Why the architecture is free-tier-friendly

ISR (`revalidate=60`) + the 3-tier KV cache absorb storefront read traffic at the edge (cheap), Hyperdrive pools Postgres connections (the usual free-tier killer), and async work is queued (smooths spikes). So **reads are cheap and cacheable; the cost scales with writes (orders), not with merchant count** — which is exactly what you want for a 0%-commission, India-first launch.

**Verdict:** **10 merchants free; ~100 merchants on ~$30–50/mo; 1000 merchants on a few-hundred/mo.** The first wall is Supabase DB size/connections, not the app. None of this requires architecture change for V1 scale.
