# Launch Plan

**HEAD `587dc988`. From current state to first real order. ~3–4 weeks, gated by ops + 3 code fixes, not architecture.**

## Week 0 — Code freeze prep (parallel, ~3–5 dev-days)
- Fix LB-8 (announcement renderer), shipping-drop (forward `shippingRateId`), LB-11 (gift-card nav + redemption UI or hide).
- Wire one external alert sink (sev2 off dry-run).
- KYC decision: gate payouts? + console review surface if yes.
- Add `/contacts` + storefront-contact rate-limit/Turnstile.
- Keep gate green after each change. Tag `v1.0.0-rc`.

## Week 1 — The push + provisioning kickoff
- **HR-B1A:** push `stepup/main`→`main` under branch protection (single canonical executor).
- Start the two long poles **now**: Razorpay live + Route onboarding; Resend domain auth (DNS).
- Provision ~40 secrets; create prod Supabase; DNS zone + wildcard.

## Week 2 — Staging proof
- Gated **staging** deploy; run E2E (browse→cart→checkout→refund) with `LETBUYY_E2E_REQUIRE_REAL_STACK=1`.
- G4 probes: account-takeover-deny, anonymous-order-deny, `commission_bps=0`.
- Rollback drill on staging.

## Week 3 — Production go-live
- Gated **production** deploy (encrypted backup → migrate → workers → apps → smoke).
- Verify observability dashboards + the alert sink fires.
- First real order ceremony (COD then Razorpay test→live), verify money invariants I1/I5.

## Exit criteria → pilot
All S0+S1 blockers closed; staging E2E green; G4 probes pass; alert sink verified; one real COD + one real Razorpay order + one real refund completed. → proceed to `BETA_PLAN.md`.
