# Merchant Trust Scorecard (Phase 13)

Would a merchant trust *installing apps* from LetBuyy today? Scored across the signals merchants actually use. Parent: [Master Audit](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md).

## Score: 41 / 100

| Dimension | Weight | Score | Notes |
|---|---|---|---|
| Catalog credibility (are there real, vetted apps?) | 20 | 3/20 | **Empty catalog**; homepage admits no rows. Nothing to trust because nothing is there. |
| Trust badges (meaningful?) | 12 | 3/12 | "Built for LetBuyy" hard-coded on every app — meaningless. "Verified" maps to `app_developers.verified` (real) but rarely set. |
| Reviews & ratings | 14 | 8/14 | **Verified-install-only** reviews are a real strength; but no write UI, no histogram, no replies, no moderation, and no reviews exist yet. |
| Permissions transparency | 12 | 8/12 | Clear scope list (label + code) in consent modal and detail; but no per-scope rationale, no data-handling disclosure, all-or-nothing. |
| Pricing clarity | 10 | 5/10 | Detail shows plans/trial; but submission only captures monthly, `usage_based` is rejected by DB, billing terms aren't shown at install. |
| Safe install/uninstall | 12 | 9/12 | Idempotent install, scope normalization, confirm-dialog uninstall with data-loss warning. Strong. Iframe sandbox combo is a risk. |
| Developer accountability | 8 | 3/8 | Developer card + website/support email; `tax_id` collected but not verified; no profile depth, no support SLA. |
| Security signals | 8 | 2/8 | GDPR webhooks exist server-side (good) but aren't surfaced; no security/compliance disclosure on listings; search-injection risk. |
| Honesty of states | 4 | 4/4 | Honest outage + empty states instead of fake data. Genuinely good. |

## What earns trust today
- Verified-install-only reviews.
- Explicit, retryable outage state; honest empty catalog copy.
- Clear permission disclosure and a strong uninstall confirmation with data-loss warning.

## What destroys trust today
- **An empty store.** A merchant who arrives finds no apps to install.
- **A trust badge on every app that means nothing** — once noticed, it poisons every other signal.
- **Pricing promises the product can't keep** (usage_based rejected; 15% vs 20% commission visible to anyone comparing the developer page to behavior).
- **No quality signals**: no real "last updated," no install trend, no support responsiveness, no editorial vetting visible.

## To reach a trustworthy 75+
1. Seed a curated launch catalog of real, working apps.
2. Make "Built for LetBuyy" an **earned** badge with published criteria and annual re-review.
3. Ship the **review write UI** + histogram + developer replies + moderation.
4. Add **data-handling disclosures** and surface the compliance posture on listings.
5. Show **billing terms at install** and fix the commission/pricing contradictions.
6. Verify developer identity (GSTIN/KYC) before granting payouts and show a verified-developer signal that's actually gated.
