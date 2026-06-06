# Shopify Theme Store — Benchmark & Comparison (Phase 2)

**Purpose:** establish what a credible theme marketplace looks like, then map LetBuyy against it.
**Shopify facts below are web-verified (2025–2026).** LetBuyy facts carry `file:line` evidence from `apps/theme-marketplace`.

## Shopify Theme Store — verified baseline

| Area | Shopify Theme Store (2025–2026) |
|---|---|
| Catalog size | ~800+ themes (free + paid) |
| Free themes | ~12–24 first-party free themes (Dawn/Horizon family + industry presets) |
| Paid price range | $100–$500 one-time, most $180–$490; third-party themes from ~$20 |
| Purchase model | One-time purchase per theme; immediate full source access |
| Try before you buy | Yes — any theme can be tried free in your own store, all settings testable, before purchase |
| Refunds | Theme purchases are **final / non-refundable** (you get the source on purchase); try-before-you-buy mitigates risk |
| Reviews & ratings | Star ratings + written merchant reviews on each listing |
| Discovery | Search; faceted by industry (up to 2 of 20 categories) and **catalog size** (4 tiers); curated collections; trust-ranked |
| Demo | Live demo/preview per theme + preset previews |
| Developer revenue share | **15%** on theme earnings (since Jan 1, 2025) + 2.9% processing fee |
| Submission | Partner account → listing (assets, presets, `/listings` folder) → submit for review |
| Review process | **5-stage** manual review by Shopify's theme review team; rejection or "changes requested" by email |
| Code requirements | Must be built on Shopify's **Skeleton** theme or **fully original** code; Dawn/Horizon-derived themes ineligible for new submissions |
| Updates | Developers must maintain/resubmit; merchants notified of updates |
| Support | Per-developer support required (support contact + response-time expectations; support during trial) |

Sources: see "Sources" at end.

## Head-to-head

| Capability | Shopify | LetBuyy (evidence) | Gap |
|---|---|---|---|
| Theme discovery | Search + industry/catalog facets + curation | Catalog list real; **search/layout/price/industry filters inert** (`themes/page.tsx:516-521,448-450,364-366`); navbar search non-functional (`navbar.tsx:124-201`) | CRITICAL |
| Catalog depth | ~800+ | **1 seeded** (`seeds/urban-kicks-theme.sql`) | CRITICAL |
| Categories | Industry (20) + catalog size (4) | 5 fixed: store/portfolio/resume/landing/saas (`theme-engine:950`); industries unseeded | MAJOR |
| Preview / demo | Try-before-you-buy live | **Disabled** "Preview in your store" (`[slug]/page.tsx:470-512`); `previewSession` API exists but unused (`api-client:1490`) | CRITICAL |
| Purchases | One-time, taxed, receipted, final-sale | Razorpay/INR only; Stripe disabled (`checkout/page.tsx:366-374`); tax "Calculated by provider" (`:472`); success page leaks placeholder (`success/page.tsx:65`) | CRITICAL |
| Reviews | Stars + written reviews | **None** — type only (`theme-engine:1021-1033`); no API/UI/submission | CRITICAL |
| Ratings | Per-listing | Bare number rendered; `review_count` shown with no reviews (`[slug]/page.tsx:515-543`) | CRITICAL |
| Documentation | Per-theme docs/setup | Footer "Documentation/API/Changelog" all `#` (`footer.tsx:11-16`) | MAJOR |
| Support | Per-developer SLA | "24/7 support" claimed (`page.tsx:33`); Support/Contact `#` | MAJOR |
| Updates | Maintained + notified | "Update Available" badge with **no update action** (`installations/page.tsx:11-14`) | MAJOR |
| Publishing | Listing builder + 5-stage review | **Upload one JSON file** (`theme-upload-panel.tsx`); no review state surfaced | CRITICAL |
| Review process | 5 documented stages, written feedback | None visible in marketplace; ops queue lives elsewhere (`api-client:1179-1182`) | CRITICAL |
| Developer revenue | 15% rev-share, payouts | **None** in app; price fields exist but no author pricing/payout UI | CRITICAL |
| Theme analytics | Performance + install signals | None for merchant or developer | MAJOR |
| Legal / refunds | Full legal + final-sale policy | All Legal links `#` (`footer.tsx:23-28`); "30-day money-back" promised (`pricing.tsx:75-77`) with no refund flow | CRITICAL |
| Visual craft | Functional/utilitarian | **Premium, art-directed** (`page.tsx`, `theme-card.tsx`) | LetBuyy wins |

## Where LetBuyy is genuinely better than Shopify
- **Listing aesthetics.** Cards, hero, and detail page are more visually refined than Shopify's grid.
- **Cross-platform price framing.** The data model carries WordPress/Shopify/HTML/React price points (`theme-engine:967-970`), enabling a "buy here vs. elsewhere" story Shopify can't tell — though it's only shown when seeded (`[slug]/page.tsx:154-161`).
- **Broader site types.** Portfolio/resume/landing/SaaS themes, not just commerce — a wider TAM than a pure store theme shop.
- **Explicit outage UX.** A first-class "temporarily unavailable / try again" state instead of an empty grid (`marketplace-unavailable.tsx`).

## Where LetBuyy must reach parity before it can call itself a marketplace
1. A populated catalog with real demos and previews.
2. Reviews/ratings with verified-purchase.
3. A developer program: listing builder, documented review, revenue share, payouts, analytics.
4. Trustworthy checkout: real receipts/licenses, taxes, refunds, and (for "global") a non-INR rail.
5. Legal/support pages and honest marketing copy.

## Sources
- [Revenue share for Shopify Theme Store developers](https://shopify.dev/docs/storefronts/themes/store/revenue-share)
- [Submitting a theme to the Shopify Theme Store](https://shopify.dev/docs/storefronts/themes/store/review-process/submit-theme)
- [Updated Shopify Theme Store Requirements and Submission Process – Effective May 15, 2025](https://shopify.dev/changelog/updated-shopify-theme-store-requirements-and-submission-process-effective-may-15-2025)
- [Theme Store requirements](https://shopify.dev/docs/storefronts/themes/store/requirements)
- [Enhancing discovery and trust: Shopify theme updates (2024)](https://www.shopify.com/partners/blog/theme-store-updates)
- [Ecommerce Website Templates — Shopify Theme Store](https://themes.shopify.com/themes)
- [Shopify Theme Price: How Much Should You Really Pay?](https://omnithemes.com/blog/shopify-design/shopify-theme-price/)
- [Shopify Help Center — refund policy for plans/subscriptions](https://help.shopify.com/en/manual/your-account/manage-billing/refund-policy-subscriptions)
