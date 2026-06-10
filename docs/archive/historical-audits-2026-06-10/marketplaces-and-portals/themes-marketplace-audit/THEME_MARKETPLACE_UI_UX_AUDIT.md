# Theme Marketplace UI / UX Audit (Phase 5)

**Method:** every page and component in `apps/theme-marketplace/src` was read. Ratings are 1–10 for the marketplace as a *product surface* (not raw visual polish, which is consistently high).

## Per-page ratings

| Page / surface | Visual | UX / function | Notes |
|---|---|---|---|
| Home `/` | 9 | 4 | Stunning hero; but hardcoded "50+/10K+" stats (`page.tsx:7-12`) over live "0 themes" category counts (`:339`); faux-browser cards imply previews that don't exist (`:301-327`) |
| Catalog `/themes` | 8 | 4 | Strong filter rail, URL-addressable; **layout/price/industry filters inert** with self-admitting warnings (`:516-521,448-450,364-366`); empty state says "catalog data is not available yet" (`:582-585`) |
| Detail `/themes/[slug]` | 9 | 4 | Cinematic gallery; **Preview & Save disabled** (`:470-512`); no reviews list; "Marketplace proof" shows counts with no content (`:515-543`) |
| Pricing `/pricing` | 8 | 3 | Clean cards/FAQ; Pro CTA → broken `/checkout?plan=pro` (`:34`); Unlimited CTA `#` (`:54`); promises "30-day money-back" (`:75-77`) with no refund flow |
| Checkout `/checkout` | 7 | 3 | Tidy order summary; Stripe disabled (`:366-374`); coupon always rejects (`:212-218`); INR-only |
| Success `/checkout/success` | 6 | 2 | **Leaks `[SKIP - NEEDS BACKEND]`** to customers (`:65`); all order fields "pending provider confirmation" |
| Install `/install` | 7 | 6 | Clear store picker + good toasts; but destructive ("styling will be replaced", `:145-147`) with no preview/rollback |
| Dashboard `/dashboard` | 8 | 6 | Real counts; clean; sequential API calls (`:9-12`) |
| Purchases | 8 | 4 | Good list; **Download button dead** (`:83-86`) |
| Installations | 8 | 4 | Good list; **"Customize" → public detail page** (`:133-139`); "Update Available" with no action |
| Downloads | 7 | 2 | **Fake sizes + dead buttons** (`:25-28,84-101`) |
| Settings | 8 | 1 | **Persists nothing; hardcoded identity** (`:14-17,38-48`) |
| Navbar | 9 | 4 | Beautiful; **⌘K doesn't search** (`:124-201`); **notification bell hits missing endpoint** (`:322`); never shows real user (`layout.tsx:100`) |
| Footer | 7 | 2 | ~15 dead `#` links incl. all Legal/Support (`:11-28`) |

## What Shopify does better (UX)
1. **Honest affordances.** Shopify doesn't render buttons it can't fulfill. LetBuyy renders many decorative controls (preview, save, search, coupon, downloads, notifications) that imply capabilities it lacks. In a trust product, a dead control is worse than an absent one.
2. **Preview-first detail pages.** Shopify leads with a live demo; LetBuyy leads with a disabled preview button.
3. **Reviews inline.** Shopify shows ratings + written reviews on the listing; LetBuyy shows a rating number with no reviews.
4. **Coherent pricing.** Shopify has one model (one-time per theme). LetBuyy mixes per-theme checkout with Free/Pro/Unlimited subscriptions that don't connect.
5. **Working discovery.** Every Shopify facet filters; several LetBuyy facets don't.

## What LetBuyy does better (UX)
1. **Aesthetic clarity & hierarchy.** Cleaner typography, better empty-state visuals, cohesive dark theme.
2. **Explicit outage state.** "Temporarily unavailable / try again" beats a blank grid (`marketplace-unavailable.tsx`).
3. **URL-addressable filters.** Good for sharing/QA/repro (`themes/page.tsx:115-133`).
4. **Skeleton loading.** Thoughtful skeletons (`loading.tsx`, `checkout` skeleton).

## Friction & trust-reducers (ranked)
1. Decorative controls that don't work (preview/save/search/coupon/downloads/notifications).
2. `[SKIP - NEEDS BACKEND]` visible at the most trust-sensitive moment (post-payment).
3. Hero metrics contradicted by live "0 themes" on the same screen.
4. Dead Legal/Support/Refund links.
5. "Customize" that doesn't customize; "Download" that doesn't download; "Save" that doesn't save.
6. Mixed currency/pricing-model signals.

## Highest-leverage UX fixes
- Remove or wire every decorative control; never ship a dead button in a payments/trust product.
- Wire `previewSession` into the detail page and theme cards (the API already exists).
- Replace hardcoded hero stats with live, real numbers — or remove them until the catalog is real.
- Make all filters back real API params, or hide the ones that don't.
- Lead the detail page with a live demo and a reviews section.
