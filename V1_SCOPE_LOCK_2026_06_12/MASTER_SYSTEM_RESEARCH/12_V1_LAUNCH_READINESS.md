# 12 — V1 LAUNCH READINESS

**HEAD `cd5905be` · code-verified. Evidence-only answers.**

## Can LetBuyy launch tomorrow?

**No.** Three proven, independent reasons: (1) it has never been pushed to `origin/main` (211 commits behind) or deployed — zero production deploys have fired; (2) 4 critical human/ops seams are unprovisioned (push, 32 secrets, DNS, prod Supabase); (3) two visible code defects remain (LB-8 broken announcement bar, LB-11 unredeemable gift cards). "Tomorrow" is impossible because the deploy + provisioning alone take days.

## Can it support 10 merchants?

**Yes — once deployed + provisioned.** The code spine (browse→cart→checkout→fulfill→refund→payout) is complete and gate-green; infra on near-free tiers (Supabase Free + Workers + Hyperdrive) comfortably holds 10 merchants. Gated only by the push + provisioning + the 2 code fixes + legal.

## Can it support 100 merchants?

**Yes, on ~$30–50/mo** (Supabase Pro + Workers Paid + Resend paid). No architecture change needed; the first wall is Supabase DB size/connections (mitigated by Hyperdrive) and Resend send volume. See `09_FREE_TIER_FEASIBILITY.md`.

## Can it support 1000 merchants?

**Yes, on a few-hundred/mo paid tiers**, same architecture scaled. The thing to watch is single-region Postgres write capacity (orders/ledger) under aggregate order volume — fine for 1000 normal merchants, not for 100k concurrent checkouts.

## What breaks first?

- **At launch:** nothing technical — the blocker is the **un-pushed/un-provisioned** state, not capacity.
- **As merchants grow:** **Supabase Free tier** (DB size/connections) is the first capacity wall (~100 merchants), then Resend send volume, then Workers free req/day.
- **Under a traffic spike:** **Postgres writes** (checkout/order/ledger/inventory) — reads are edge-cached and fine.

## Readiness posture

The platform is a **strong, gate-green, money/identity/tenancy-sound product that is finished-enough but un-shipped.** It is ~3–4 weeks from a real 5–10 merchant pilot — gated by the human push + provisioning + two small code fixes — not by architecture. See `13_FINAL_EXECUTIVE_SUMMARY.md` for the scored readiness and the exact path.
