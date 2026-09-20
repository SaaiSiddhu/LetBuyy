# Beta Plan (Closed Beta → Pilot → 100 Merchants)

**HEAD `ae383bb8`. After Launch Plan exit criteria are met.**

## Stage 1 — Closed beta (5 merchants, ~2 weeks)
- Hand-onboard 5 friendly merchants (owner-operated; teams deferred).
- COD live + Razorpay live; manual fulfillment; email-only notifications.
- Daily money reconciliation review (console dual-approver); watch the alert sink.
- Pilot issue register with **P0 freeze protocol** (any money/auth/tenancy defect → halt).
- Success gate: 5 merchants live, ≥1 real order + refund + payout each (after Route), zero money/auth incidents.

## Stage 2 — Pilot (10–25 merchants, ~3–4 weeks)
- Resolve S2 hardening items before widening: KYC review surface, teams acceptance (or formal defer), GST immutable persist, per-identity limiters.
- Add COD + shipped emails.
- Load-test checkout to find the real concurrent-checkout ceiling; size Hyperdrive pool.
- Success gate: 25 merchants, payout cycle proven, support volume manageable, no P0/P1 open.

## Stage 3 — 100 merchants (~$30–50/mo infra)
- Supabase Pro + Workers Paid + Resend paid.
- Continuous queue consumers (retire the 15-min cron drain).
- DLQ-depth + circuit-open alerts; observability dashboards mature.
- Capacity wall to watch: Supabase connections/size (first), Resend volume (second).
- Success gate: 100 merchants, p95 checkout latency within target, alerting proven under real load.

## Out of beta scope (V2/ARB)
Liquid migration, app marketplace, mobile shopper/operator apps, multi-region writes, 100k-concurrent-checkout.
