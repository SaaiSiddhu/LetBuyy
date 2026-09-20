# Phase L — Final V1 Certification

**HEAD `ae383bb8`. Read-only. Evidence-backed. No assumptions.**

## Scores

| Domain | Score /100 | Basis (file:line evidence in the phase docs) |
|---|---|---|
| Architecture | 88 | modular monolith; trust boundaries enforced; single-region write ceiling by design |
| Security | 82 | no live hole; fail-closed secrets; webhooks verified; −shared internal secret, rate-limit gaps, no alerting |
| Money & Ledger | 90 | refund/payout/ledger invariants preserved; gift-card split-brain fixed (mig 173); −shipping-drop, GST-on-mutable-column |
| Tenant Isolation | 92 | 0 ownership gaps in 87 routes; RLS forced; app_tenant RT-1..9 red-team test |
| Customer Journey | 65 | front door works (Next 16 proxy.ts); Razorpay hardened; −LB-8, shipping-drop, gift-card UX, COD email |
| Merchant Journey | 70 | full product→order→fulfill→refund→payout loop; −teams owner-only, KYC no review surface, payouts not KYC-gated |
| Deployment | 40 | gated pipeline excellent but **never run**; never pushed/provisioned |
| Infrastructure | 55 | design 90, provisioning 0, **no external alerting/paging** |
| Scale | 85 (V1) / 35 (100k checkout) | reads edge-cached; writes single-region |
| **OVERALL (codebase)** | **~74** | strong, money-sound, ~85% V1 code-complete |
| **PRODUCTION READINESS** | **~15** | unshipped + unprovisioned + 3 code defects + no paging |

## Can it run 100 beta merchants with real money today?

**No.** Three independent, proven reasons:

1. **Never shipped.** `origin/main` is **217 commits behind** HEAD; the production pipeline (`production-deploy.yml`) has never run. Zero production deploys.
2. **Never provisioned.** ~40 production secrets are unset (`release-preflight` hard-fails); the live Razorpay/Razorpay-Route/Resend/Turnstile/identity-JWK rails are explicit human seams (`EXECUTABLE_HUMAN_REQUIRED.md`), all fail-closed.
3. **3 verified code defects + 1 ops gap** block a clean buyer/merchant experience: LB-8 (broken announcement bar), shipping-rate drop (revenue leak), LB-11 (unredeemable gift cards in UI), and **no external alerting** (a checkout/payment 5xx pages nobody — `incident-command.ts:94–128` is dry-run only).

## What is genuinely solid (certified sound)

Money spine (canonical append-only double-entry ledger, idempotent step-up-gated refunds/payouts, Razorpay-Route-only payout rail, gift-card redemption fixed); asymmetric sole-issuer identity (no HMAC merchant-session forgery path, `/auth/switch` takeover fixed, real HMAC step-up); fail-closed tenant isolation (0 ownership gaps, RLS+GUC, tenant-guarded service client); verified webhooks (incl. PayPal); resilient queues (circuit breaker + dead-letter). None of these blocks launch.

## Verdict

# NOT READY

For 100 beta merchants + real payments/orders/refunds/payouts **today**. This is an unshipped, unprovisioned, money-sound platform with three small storefront defects and no production paging — **not** an architecture problem.

**Path to READY FOR PILOT (~3–4 weeks):** fix LB-8 + shipping-drop + LB-11 (~3–5 dev-days) → decide KYC-gates-payout → wire external alerting → **push (HR-B1A)** + provision the 9 human seams → gated staging→production with G4 smoke probes → pilot 5–10 merchants (COD + Razorpay test-to-live). See `PRODUCTION_PLAN.md`.

The strongest evidence in this certification is a retraction: an earlier "S0 storefronts-unreachable" finding was a **false positive** (Next 16 renamed `middleware.ts`→`proxy.ts`). Certified against code, not narrative.
