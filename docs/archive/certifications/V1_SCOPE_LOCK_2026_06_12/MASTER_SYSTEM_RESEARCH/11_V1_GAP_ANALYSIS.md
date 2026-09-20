# 11 — V1 GAP ANALYSIS

**HEAD `c7c82847` · code-verified.** V1 scope = web-only, React urban-kicks theme, India/INR, Razorpay+COD, manual fulfillment, email-only, 0% commission, owner-only merchants, staffed console. Ranked by launch-criticality.

## CRITICAL (blocks launch)

| Gap | Type | Status |
|---|---|---|
| **Push to origin + first deploy** | human/ops | origin 211 behind HEAD; never deployed. *The* gating act. |
| **Production secrets (32)** | human/ops | Razorpay live, Resend, Turnstile, identity JWK, step-up/customer-session — all unprovisioned; live flows fail-closed. |
| **DNS + wildcard `*.letbuyy.com`** | human/ops | storefront subdomains unreachable without it. |
| **Production Supabase + apply migrations** | human/ops | no prod DB. |

## HIGH (broken/visible defects — fix before pilot)

| Gap | Type | Status |
|---|---|---|
| **LB-8 announcement bar renderer** | code | missing → broken placeholder on every storefront. |
| **LB-11 hide gift cards + dead links** | code | unredeemable codes still issuable; dead marketplace links. |
| **Legal: ToS/Privacy/DPDP + pricing truth** | human/legal | required for real merchants. |
| **Razorpay Route onboarding (payouts)** | human/ops | real merchant payouts blocked. |
| **Resend live (also unblocks emails)** | human/ops | lifecycle emails no-op until set. |

## MEDIUM (verify/finish — recently implemented, confirm correctness)

| Gap | Type | Status |
|---|---|---|
| **LB-9 appearance bridge** | code (new) | storefront now reads `site_settings` (2 hits) — verify it reaches `:root` + custom_css sanitized. |
| **LB-10 lifecycle emails** | code (new) | order_cancelled/refunded now present (4 hits) — verify dispatch + idempotency. |
| **LB-12 shopper register** | code (new) | register route exists — verify not-exists precondition + session mint + issuer model. |
| **Storefront search wiring** | code | trigram + SEARCH_QUEUE exist; storefront query path thin. |
| **Analytics revenueByMonth** | code | hardcoded; ship with banner or S-fix. |
| **KYC review queue** | code/ops | build (~3d) or ops-manual, only if payouts gate on KYC. |

## LOW (V1.1 / cosmetic)

Merchant staff/teams (acceptance page + role gates), console force-refund, impersonation consumer, support-ticket standalone queue, Liquid migration (entire — post-V1), mobile merchant app (V2), section image-upload widget, footer-menu edit UI.

## Summary count

- **Critical: 4** (all human/ops — the push + provisioning).
- **High: 5** (2 code: LB-8, LB-11; 3 human: legal, Route, Resend).
- **Medium: 6** (3 freshly-coded to verify, 3 small).
- The remaining code work is **small and closing** (LB-8 + LB-11 + verify LB-9/10/12); the dominant blocker class is **human/ops provisioning + the push**, not engineering.
