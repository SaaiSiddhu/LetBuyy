# Merchant Trust Scorecard (Phase 12)

**Question:** would a merchant trust buying a theme here? **Score: 2.4 / 10.** The brand and visuals inspire trust; the moment a merchant probes a real action, trust collapses.

## Scoring

| Trust dimension | Weight | Score /10 | Evidence |
|---|---:|---:|---|
| Branding & visual credibility | 10% | 9 | Premium, cohesive (`page.tsx`, `theme-card.tsx`, `globals.css`) |
| Catalog credibility (real inventory) | 15% | 1 | 1 theme; "50+/10K+" hardcoded over live "0 themes" (`page.tsx:7-12,339`) |
| Quality signals (reviews/ratings) | 15% | 1 | No reviews; ratings are bare/0.0 (`[slug]:515-543`) |
| Preview / try-before-buy | 12% | 1 | Disabled (`[slug]:470-512`) |
| Developer identity / vetting | 8% | 1 | Author = plain text; no profiles/verification |
| Documentation & support | 10% | 1 | Docs/Support/Contact all `#`; "24/7" unfounded (`footer.tsx:11-22`, `page.tsx:33`) |
| Checkout integrity | 12% | 2 | Stripe disabled vs. advertised; success leaks `[SKIP - NEEDS BACKEND]` (`success:65`) |
| Legal & policies | 8% | 1 | Terms/Privacy/Refund/License all `#` (`footer.tsx:23-28`) |
| Pricing clarity | 5% | 3 | Two unconnected models; Pro CTA broken (`pricing:34`/`checkout:172`) |
| Post-purchase / dashboard reliability | 5% | 3 | Real counts, but Download/Customize/Update dead |
| **Weighted total** | 100% | **2.4** | |

## What builds trust today
- The look and feel: a merchant's first impression is "this is a polished, modern store."
- The explicit outage state ("temporarily unavailable / try again") signals operational maturity (`marketplace-unavailable.tsx`).
- The detail page's information architecture (gallery, features, color presets, theme info) is reassuring *when* a theme is seeded.

## What destroys trust (in the order a merchant hits it)
1. **Hero vs. reality:** "50+ Premium Themes / 10K+ Active Installs / 4.8" above category cards reading "0 themes."
2. **No reviews/ratings:** nothing to corroborate quality; rating numbers with no reviews behind them.
3. **No preview:** can't try before buying; the button is visibly disabled.
4. **No legal/support:** Terms, Privacy, Refund, License, Support, Contact all dead — a payments product with no policies.
5. **Checkout:** advertised Stripe is disabled; coupon always fails; and after paying, the success page literally says the backend isn't done.
6. **Dead dashboard actions:** Download/Customize/Update look live, aren't.

## Trust repair priorities (highest leverage first)
1. Remove every false metric and unverified claim; never contradict reality on screen.
2. Publish Terms, Privacy, Refund, and License pages; provide a real support/contact path.
3. Delete the `[SKIP - NEEDS BACKEND]` success line; ship a truthful receipt/license/pending state.
4. Wire preview (`previewSession`) and add a reviews/ratings system with verified-purchase.
5. Seed a real catalog; only then turn on social proof (installs, ratings, "X stores use this").
6. Make Stripe claim match reality, or enable it; fix or remove the coupon field.
