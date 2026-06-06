# Theme Content Gap Analysis (Phase 6)

**Method:** every title, subtitle, description, card, empty state, and error state in `apps/theme-marketplace/src` was read and classified. The marketplace's copy is well-written and confident — which is the problem: it confidently asserts capabilities and metrics that the code does not deliver.

## A. Fake / unverifiable metrics

| Claim | Where | Reality |
|---|---|---|
| "50+ Premium Themes" | `page.tsx:8` (STATS) | 1 theme seeded (`seeds/urban-kicks-theme.sql`) |
| "10K+ Active Installs" | `page.tsx:9` | Hardcoded; no install data; `install_count` unseeded |
| "4.8 Avg Rating" | `page.tsx:10` | Hardcoded; no reviews exist |
| "Categories: 4" | `page.tsx:11` | Catalog defines **5** categories (`theme-engine:950`) |
| "Discover 50+ professionally designed themes" | `layout.tsx:41` (SEO) | Same as above; ships in `<meta>` and OG |
| "Join thousands of businesses…" | `page.tsx:424` | No evidence; aspirational |
| Per-theme "X installs", `review_count` | `theme-card.tsx:108-121`, `[slug]:528-540` | Render real fields but catalog is unseeded → 0/empty |

The acute problem: the hero "50+ Premium Themes" sits directly above category cards that compute **real** counts from the API and render "0 themes" (`page.tsx:45-50,339`). The page contradicts itself on first paint.

## B. Unverified capability claims (marketing vs. code)

| Claim | Where | Code reality |
|---|---|---|
| "Stripe & Razorpay integrated… Indian and global transactions" | `page.tsx:25` | Stripe button **disabled / "Not configured"** (`checkout/page.tsx:366-374`); Razorpay/INR only |
| "One-click install — live in under 60 seconds" | `page.tsx:22` | Install needs a pre-existing store; replaces storefront; no preview |
| "Fully Customizable… live visual editor" | `page.tsx:23` | No editor in this app; "Customize" links to public detail page (`installations:133-139`) |
| "Export to WordPress, Shopify, HTML, or standalone React" | `page.tsx:26` | Downloads page buttons are **dead**; sizes hardcoded (`downloads:25-28,84-101`) |
| "24/7 support" | `page.tsx:33`; pricing FAQ | No support surface; Support/Contact links `#` |
| "30-day money-back guarantee. No questions asked." | `pricing.tsx:75-77` | No refund workflow (`orders.refund` exists in API, unused) |
| "Every theme is fully responsive and tested on all major mobile devices" | `pricing.tsx:79-81` | No evidence/tests surfaced |
| "Clean TypeScript code, well-documented APIs" | `page.tsx:27` | Docs/API footer links are `#` |

## C. Visible developer placeholders (shipped to users)

| Placeholder | Where | Severity |
|---|---|---|
| "**[SKIP - NEEDS BACKEND]** Receipt, license, and payment confirmation require the payment provider settlement endpoint." | `checkout/success/page.tsx:65` | P0 — shown after real payment |
| "Layout and numeric price filters need backend support before they change API results." | `themes/page.tsx:518-520` | P1 — admits filters are fake |
| "Autocomplete suggestions need seeded theme catalog rows from the existing theme API." | `themes/page.tsx:364-366` | P1 |
| "Industry filters need seeded theme industry data." | `themes/page.tsx:448-450` | P1 |
| "Store-scoped preview sessions and a direct save-to-library endpoint are not exposed by the theme marketplace API yet." | `[slug]/page.tsx:510-512` | P1 |
| "Feature bullets need seeded marketplace theme metadata…" | `[slug]/page.tsx:400-402` | P2 |
| "Theme catalog data is not available yet." (empty states) | `themes/page.tsx:584`, `[slug]:245` | P2 (honest, but signals pre-launch) |

These are candid engineering notes — appropriate in a backlog, not in production UI a merchant or developer sees.

## D. Missing content (should exist, doesn't)
- **Legal:** Terms of Service, Privacy Policy, Refund Policy, License Agreement — all `#` (`footer.tsx:23-28`).
- **Support:** Support, Contact, About, Blog — all `#` (`footer.tsx:17-22`).
- **Developer docs:** Documentation, Theme Development, API Reference, Changelog — all `#` (`footer.tsx:11-16`).
- **Per-theme:** changelog/release notes, setup guide, support contact, license terms, compatibility, performance/accessibility notes, author bio.
- **Reviews:** no review content anywhere.

## E. Tone / professionalism
Copy quality is high and consistent (confident, modern, benefit-led). The issue is **accuracy**, not craft. Two systemic fixes:
1. **Truth-in-metrics:** never hardcode counts/ratings; derive from data or omit. Remove "50+/10K+/4.8" until real.
2. **Capability honesty:** every benefit bullet must map to a working feature, or be cut. Move all "[SKIP/NEEDS BACKEND]/needs seeded data" strings out of shipped UI.

## Recommended copy actions (highest leverage)
- Replace hero STATS with live values or remove the stat bar.
- Delete the Stripe/global, 24/7-support, one-click-60s, multi-platform-export, and 30-day-refund claims until each is real.
- Remove the `[SKIP - NEEDS BACKEND]` success-page line immediately; show a truthful pending/receipt state.
- Convert the four "needs backend/seeded data" filter warnings into either working filters or hidden controls.
