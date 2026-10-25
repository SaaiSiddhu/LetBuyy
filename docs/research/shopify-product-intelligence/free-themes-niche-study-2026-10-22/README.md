# Shopify free themes → ten distinct LetBuyy storefront designs

Research date: **22 October 2026**. Status: **research + proposed designs, no production implementation**.

The owner's concern is reproducible in current source: all ten catalog bundles share the same primary templates, and the same-catalog experiment renders identical main HTML for home, collection and product. Separate composition definitions exist, but the inspected catalog/install/onboarding paths do not apply them as full designs. This is strong source evidence; a particular merchant's persisted release was not inspected.

Shopify's 23 current free demos differ through merchandising, navigation, page composition, gallery/selection patterns and information density while sharing foundations. They are not automatically one industry each or flawless UX examples. Ten explicitly identify Horizon collection membership.

## Review first

- [Findings and root cause](05_DIFFERENTIATION_ROOT_CAUSE_ANALYSIS.md)
- [Ten-niche portfolio, pairwise review and merchant selection journey](06_TEN_NICHE_PORTFOLIO.md)
- [Original visual gallery — all page/device and neutral structures](visuals/design-review.html)
- [Threadline detailed UI storybook — 45 responsive PNGs and 15 comparison boards](visuals/threadline-storybook/index.html), [download](visuals/threadline-storybook/Threadline-45-mockups.zip) and [design handoff](visuals/threadline-storybook/README.md)
- [Desktop comparison export](visuals/home-desktop-comparison.jpg) and [navigation/cart structures](visuals/navigation-and-cart.svg)
- [Complete phased implementation plan](08_IMPLEMENTATION_PLAN.md)
- [Capability contracts and dependencies](07_COMPONENT_AND_DATA_CAPABILITY_MAP.md)

## Research collection

1. [Scope, method and evidence limits](00_SCOPE_METHOD_AND_EVIDENCE.md)
2. [Current free-theme census and 23 dossiers](01_CURRENT_FREE_THEME_CENSUS.md)
3. [Families, shared foundations and typography](02_THEME_FAMILIES_AND_FOUNDATIONS.md)
4. [Cross-theme design matrix](03_CROSS_THEME_DESIGN_MATRIX.md)
5. [Current ten-preset source/render audit](04_LETBUYY_EXISTING_TEN_AUDIT.md)
6. [UX principles and content resilience](10_UX_PRINCIPLES_AND_CONTENT_RESILIENCE.md)
7. [Acceptance and incomplete branches](09_ACCEPTANCE_AND_LIMITATIONS.md)
8. [Evidence ledger](evidence/claim-ledger.json), [coverage](evidence/coverage-matrix.json), [manifest](evidence/manifest.json) and [validation](evidence/research-validation.json)

## Ten target designs

| Design | Niche / principal distinction |
|---|---|
| Threadline | Fashion: outfit context and fit/size evaluation. |
| Playfield | Toys: adult age/interest discovery and contents facts. |
| Circuit | Electronics: search, model compatibility and specifications. |
| Pantry | Food: shelf rows, ingredients/allergens and pack quantity. |
| Habitat | Furniture: room context, dimensions and material/finish. |
| Kindred | Gifts: occasion/recipient/budget discovery and box contents. |
| MadeYours | Personalization: specify, validate, review and persist configuration. |
| Dewdrop | Beauty: use/routine, ingredients and named shades. |
| Trailmark | Sports: activity pathways and equipment-specific fit/specs. |
| Marginalia | Books/stationery: title/author/subject retrieval and edition facts. |

Bloom pet→toys and Summit generic→gifts need explicit version/identity decisions; existing merchant designs must be preserved. MadeYours requires end-to-end configuration/order work before launch. The first implementation slice should prove two distinct artifacts through catalog → install → editor → preview → release readback → published storefront before expanding all ten.

This collection contains original schematic proposals, current public-browser evidence and a source-derived synthetic experiment. It does not claim all Shopify interactions, accessibility conformance, conversion outcomes, non-empty carts or live LetBuyy publication were verified. [Exact limitations](09_ACCEPTANCE_AND_LIMITATIONS.md).
