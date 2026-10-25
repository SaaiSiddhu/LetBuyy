# LetBuyy existing ten-preset audit

**MEASURED:** the current catalog builder produces one shared template set and one shared source-file set across all ten identities. Rendering the same synthetic catalog produces identical **main HTML per page type** for homepage, collection and product, across all ten presets. All 30 render calls returned `rendered`. Settings and layout-level styles can differ; this is not a claim that every complete HTML byte or painted pixel is identical.

Reproduce without a database:

```sh
node --import tsx docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/evidence/audit-presets.mts
```

This writes only this research collection's fixtures/results. The script does not publish or query a merchant store. [Machine results](evidence/current-presets-audit.json), [HTML fixture index](visuals/current-source-fixtures.html) and [browser fixture log](evidence/source-fixture-browser-review.json).

## Actual common templates

- Homepage: banner-carousel → hero-banner → category-grid → featured-products → product-grid → video-hero → spotlight → testimonials → newsletter-signup.
- Collection: collection-banner → collection-filter → collection-product-list.
- Product: product-detail → featured-products.
- Bundle contains 23 template keys, including shared utility/customer routes. The experiment covers the three primary page types, not all 23 routes.

## Per-identity differences and non-differences

| ID | Current niche | Heading / body registry | Primary / accent / canvas | Declared home composition | Measured shipped structure |
|---|---|---|---|---|---|
| forge | electronics | Inter / Inter | #1E3A5F / #00B4D8 / #FFFFFF | announcementBar → heroBanner → categoryGrid → trustBadges → featuredProducts → productGrid → newsletter | Same Core home/collection/PDP; no niche interaction delta in compared main HTML |
| sense | fashion | Playfair Display / Inter | #1A1A2E / #E63946 / #FFFFFF | announcementBar → heroBanner → categoryGrid → featuredProducts → testimonials → newsletter | Same Core home/collection/PDP; no niche interaction delta in compared main HTML |
| aura | beauty | Cormorant Garamond / Lato | #C2798B / #D4AF7A / #FFFFFF | announcementBar → heroBanner → categoryGrid → featuredProducts → trustBadges → testimonials → newsletter | Same Core home/collection/PDP; no niche interaction delta in compared main HTML |
| craft | furniture | Libre Baskerville / Source Sans Pro | #3E2723 / #8D6E63 / #FFFFFF | announcementBar → heroBanner → categoryGrid → trustBadges → featuredProducts → aboutSection → testimonials → faqAccordion → newsletter | Same Core home/collection/PDP; no niche interaction delta in compared main HTML |
| refresh | food | Inter / Inter | #2D6A4F / #F4A261 / #FFFFFF | announcementBar → heroBanner → trustBadges → categoryGrid → featuredProducts → productGrid → newsletter | Same Core home/collection/PDP; no niche interaction delta in compared main HTML |
| ride | sports | Inter / Inter | #FF4D00 / #FFD100 / #FFFFFF | announcementBar → heroBanner → categoryGrid → featuredProducts → productGrid → trustBadges → newsletter | Same Core home/collection/PDP; no niche interaction delta in compared main HTML |
| dawn | books | Libre Baskerville / Source Sans Pro | #3B4F6B / #C0832B / #FFFFFF | announcementBar → heroBanner → categoryGrid → featuredProducts → productGrid → aboutSection → newsletter | Same Core home/collection/PDP; no niche interaction delta in compared main HTML |
| bloom | pet | Inter / Inter | #E07B39 / #4CAF73 / #FFFFFF | announcementBar → heroBanner → categoryGrid → featuredProducts → trustBadges → productGrid → newsletter | Same Core home/collection/PDP; no niche interaction delta in compared main HTML |
| nova | General | Inter / Inter | #8B5CF6 / #F59E0B / #FFFFFF | announcementBar → heroBanner → categoryGrid → featuredProducts → productGrid → ctaSection → newsletter | Same Core home/collection/PDP; no niche interaction delta in compared main HTML |
| summit | general | Inter / Inter | #00B3B3 / #A4E500 / #FFFFFF | announcementBar → heroBanner → categoryGrid → featuredProducts → productGrid → newsletter | Same Core home/collection/PDP; no niche interaction delta in compared main HTML |

The declared arrays are authored intent. They are not the arrays in `createFirstPartyCatalogBundle`'s rendered templates. Even after they are applied, section ordering alone will not supply a fit workflow, normalized electronics specs or product-specific allergen data.

## Composition application experiment

| Preset | Full design adds/removes | Full content-risk count | Additive adds/removes | Missing registered section types |
|---|---:|---:|---:|---|
| forge | 5 / 7 | 7 | 5 / 0 | 0 |
| sense | 3 / 6 | 6 | 3 / 0 | 0 |
| aura | 7 / 7 | 7 | 7 / 0 | 0 |
| craft | 9 / 7 | 7 | 9 / 0 | 0 |
| refresh | 5 / 6 | 6 | 5 / 0 | 0 |
| ride | 4 / 6 | 6 | 4 / 0 | 0 |
| dawn | 5 / 6 | 6 | 5 / 0 | 0 |
| bloom | 5 / 6 | 6 | 5 / 0 | 0 |
| nova | 6 / 6 | 6 | 6 / 0 | 0 |
| summit | 2 / 6 | 6 | 2 / 0 | 0 |

All currently declared composition types resolve in this experiment. A previous claim that absent section registrations explain today's sameness would be stale. Full-design mode can remove six or seven starter sections and reports content risk; it must not be applied automatically to existing merchant documents. Additive mode retains unmatched sections and reports no removals in this fixture, but still needs review for duplicate/awkward arrangement. Style-only does not create a niche journey.

## Interaction, typography and evidence boundary

The compared bundles use the same underlying product/quantity/cart/search behavior. Token differences include color, font and radius; they do not change the compared main section markup. The source font registry and storefront layout already integrate stylesheet loading. Actual loaded font binaries in a deployed merchant store were not measured; the standalone fixture does not emulate the complete Next font/data pipeline.

Thumbnails generated by the current catalog script share one SVG composition, a clothing-like silhouette and the same campaign message. The thumbnails therefore do not substantiate ten niche layouts. Source-derived screenshots reproduce shared content and arrangement; synthetic data cannot establish all variant, stock or merchant-specific states.

**Confidence:** high for deterministic builder/template/main-HTML equality and bounded source trace; medium for the explanation of the owner's live experience; unresolved for persisted database catalog rows, actual merchant drafts/releases and deployed editor/storefront parity. Source validation did not inspect or mutate those records.

## Source boundaries

- [packages/theme-engine/src/first-party-theme-catalog.ts](../../../../packages/theme-engine/src/first-party-theme-catalog.ts)
- [packages/theme-engine/src/theme-presets.ts](../../../../packages/theme-engine/src/theme-presets.ts)
- [packages/theme-engine/src/experience-compositions.ts](../../../../packages/theme-engine/src/experience-compositions.ts)
- [packages/theme-engine/src/experience-apply.ts](../../../../packages/theme-engine/src/experience-apply.ts)
- [packages/theme-engine/src/theme-bundle-core.ts](../../../../packages/theme-engine/src/theme-bundle-core.ts)
- [packages/theme-engine/src/theme-bundle.ts](../../../../packages/theme-engine/src/theme-bundle.ts)
- [packages/theme-engine/src/experience-fonts.ts](../../../../packages/theme-engine/src/experience-fonts.ts)
- [apps/commerce/web/src/app/store/[subdomain]/layout.tsx](../../../../apps/commerce/web/src/app/store/[subdomain]/layout.tsx)
