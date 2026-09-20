# Production Plan

**HEAD `ae383bb8`. The definitive path to production. Verdict: NOT READY today; READY FOR PILOT after the gate below.**

## The gate to production (must all be true)
| # | Gate | Owner | Evidence when done |
|---|---|---|---|
| 1 | LB-8 fixed | eng | announcement bar renders on default theme |
| 2 | Shipping-drop fixed | eng | `shippingRateId` reaches gateway; rate card charged |
| 3 | LB-11 resolved | eng | gift cards hidden or redeemable end-to-end |
| 4 | External alerting live | eng/ops | sev2 incident pages a human (not dry-run) |
| 5 | KYC-payout policy decided | product | payout gates on KYC OR documented exception |
| 6 | `/contacts` abuse closed | eng | limiter + Turnstile |
| 7 | HR-B1A push done | human | `origin/main == HEAD`, branch protection on |
| 8 | ~40 secrets provisioned | human | `release-preflight` passes |
| 9 | Prod Supabase + migrations | human | gated migrate succeeded w/ backup |
| 10 | DNS + wildcard | human | `*.letbuyy.com` resolves |
| 11 | Razorpay live + Route | human | test + live order + payout |
| 12 | Resend domain auth | human | email delivers (SPF/DKIM/DMARC pass) |
| 13 | Identity ES256 keypair | human | merchant login works in prod |
| 14 | Staging E2E + G4 probes green | eng | CI artifacts |
| 15 | Rollback drilled | ops | restore verified on staging |
| 16 | Legal: ToS/Privacy/DPDP | legal | pages live, links fixed |

## Sequencing (critical path)
`Fix 1–6 (parallel, ~1 wk)` → `Push (7)` → `Provision 8–13 in parallel (~2–3 wk; Razorpay Route + Resend are long poles)` → `Staging proof 14–15` → `Production deploy` → `Pilot (BETA_PLAN Stage 1)`.

## What does NOT block production (explicitly out of V1)
Liquid renderer (React urban-kicks is V1), app marketplace, developer/theme marketplaces, mobile shopper/operator apps, multi-region, 100k-concurrent-checkout, merchant teams (deferrable to V1.1), advanced search.

## Final certification verdict
**NOT READY** for 100 beta merchants + real money today (unshipped, unprovisioned, 3 code defects, no paging). **READY FOR PILOT** once gates 1–16 close (~3–4 weeks). The platform is architecturally sound and money/identity/tenancy-certified; the remaining work is operational + three small fixes — not redesign.

*Correction of record: the earlier "S0 — LB-1 routing regression / storefronts unreachable" was a false positive. Next.js 16 renamed the middleware entry to `proxy.ts`; LB-1 is satisfied. Certified against code at HEAD `ae383bb8`.*
