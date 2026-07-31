# 08 — INFRASTRUCTURE AUDIT

**HEAD `cd5905be` · code-verified from `wrangler.toml`, `vercel.json`, env templates, workflows.** Architecture facts are repo-proven; capacity/cost are marked as architecture-bounded estimates grounded in published platform limits (the repo does not contain runtime metrics or the billing plan).

## Current architecture (repo-proven)

| Layer | Tech | Evidence |
|---|---|---|
| Buyer/merchant/admin apps | **Vercel** (Next.js SSR/ISR) — 5 apps each with `vercel.json` | `apps/*/vercel.json`; storefront `revalidate = 60` (ISR) |
| Commerce monolith | **Cloudflare Worker** `api-gateway` (Hono) | `services/api-gateway/wrangler.toml`, `main=src/index.ts`, compat 2026-05-25, custom domain `api.letbuyy.com` |
| DB access | **Supabase Postgres** via **Cloudflare Hyperdrive** + pooled SQL | `binding = "HYPERDRIVE"`, `STOREFRONT_POOLED_SQL = "on"` |
| Cache | **Cloudflare KV** (`CACHE` binding) + ISR | `binding = "CACHE"`; 3-tier KV-versioned cache (Constitution ART-18) |
| Object storage | **Cloudflare R2** (`R2_BUCKET`) | media uploads |
| Async | **5 Cloudflare Queues** (event/analytics/search/notification/runtime) → `queue-workers` | producers in api-gateway; consumers with dead-letter queues + circuit breaker (3 fail→60s) + claim/drain budget 25 |
| Webhooks | `webhook-service` Worker (service binding) | Razorpay/Stripe sig-verified |
| Mobile API | `mobile-bff` Worker | V2-serving |
| Email | **Resend** | `RESEND_API_KEY` (fail-closed; `missing-resend-secret` skip), `RESEND_FROM_EMAIL` |
| Auth challenge | **Turnstile** | fails closed without live keys |
| CI/CD | **GitHub Actions** (12 workflows) | gated production-deploy on push to `main` |
| DNS | `letbuyy.com` zone (Terraform `infrastructure/dns/letbuyy_com.tf`) | not yet provisioned (human seam) |

This is a **stateless-edge-compute + pooled-Postgres + queue-fanout + edge-cache** design — the correct shape for cheap horizontal read scale.

## Actual vs expected limits (architecture-bounded)

- **Cloudflare Workers:** stateless, auto-scale horizontally. Free = 100k req/day + 10ms CPU; **Workers Paid ($5/mo)** = 10M req + 50ms CPU (and higher). The gateway is per-request stateless → scales with the plan, not with merchant count.
- **Hyperdrive:** pools + caches Postgres connections at the edge → **this is the lever that lets many Workers share few Supabase connections** (Supabase's hardest free-tier limit). Repo-proven binding.
- **Supabase:** Free = ~60 max connections (pooled), 500MB DB, 5GB egress, pauses on inactivity; Pro ($25) = 8GB DB + no pause + more connections. With 237 tables and a write-hot ledger, **Supabase tier is the first real ceiling** (see 09/10).
- **KV/R2/Queues:** generous free tiers; queues have free-tier message caps; R2 has free egress.
- **Vercel:** Free (Hobby) is non-commercial + limited; **a commercial launch needs Vercel Pro ($20/mo)** for the 5 apps (or self-host). This is a licensing reality, not a capacity one.

## Provisioning readiness

**0% provisioned.** No live DNS, no production secrets (32 enumerated: Razorpay live, Resend, Turnstile, identity JWK, step-up/customer-session secrets), no production Supabase project, never pushed to origin. The pipeline (gated gate→preflight→migrate→staging-E2E→backup→deploy→smoke) is built but has never run.

**Verdict:** the infrastructure *design* is production-grade and cost-efficient (~90% designed); the infrastructure *provisioning* is at zero. The architecture is the right one for a free/cheap-tier India launch; the work is provisioning + the push, not redesign.
