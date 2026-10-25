# 06 · Kindred — Gifts and occasions

**PROPOSED.** Working name, not a trademark-cleared product name. No implementation or publication is implied. Current ID: `summit`. Stable ID retained; proposal is a new, explicitly selected design version, never a silent rewrite of existing installations. Current Summit is the general fallback. Gifts must be explicit opt-in; unknown industries must continue to get a neutral foundation or an explicit choose-design flow. Do not auto-route every unknown merchant into gifts. The neutral foundation is infrastructure, not an eleventh marketed design.

## Merchant, customer and design thesis

**Bounded segment:** Ready-made, stocked gifts and curated sets sold as ordinary products. No guaranteed arrival date or complex build-a-box. The buyer's mission is: **Find a suitable gift by occasion, recipient and budget, then check contents and packaging.** Purchase uncertainty: Is it suitable, what arrives in the box, and can the merchant support my requested message? The merchant must provide a coherent category model and the niche facts below. A distinctive demo without those facts would overpromise the actual merchant experience.

**Primary journey:** Find a suitable gift by occasion, recipient and budget, then check contents and packaging. Home discovery → relevant collection → factual product evaluation → complete supported selection → canonical cart → hosted checkout. Anonymous discovery remains possible. Catalog data, availability, price and shipping remain server-authoritative.

## Sitemap and navigation

Header: **Occasions / For whom / Under a budget / Ready-made sets / Gift help**. Sitemap: Home → named category/collection → product; Search/results; Cart; merchant informational pages; customer account as existing utility; canonical hosted checkout. Supporting pages: **gift help; packaging information; shipping policy; returns for gift recipients if merchant policy allows**. Desktop category links are explicit, with labelled search/cart controls. Mobile menu is a reversible disclosure/drawer with Escape, focus return and nested category back navigation. Never make hover the only route to a category.

## Homepage composition

1. Occasion / recipient / budget entry panel.
2. Occasion tiles rather than a campaign hero.
3. Editor-curated gift combinations sold as listed.
4. Packaging and contents explanation.
5. Gift etiquette/help article.
6. Actual shipping and returns policy.

Each region has a distinct job. Removing an unsupported education block must leave useful category/product navigation, not a decorative blank panel. Do not seed shipping guarantees, discount urgency, fabricated ratings or safety/health claims.

## Collection, product cards and search

Occasion/recipient/budget finder rail beside a two-column curated gift gallery; mobile opens with one complete gift and smaller alternatives; suitability notes remain visible.

**Card contract:** 4:3 gift/set photograph; title; included items count when known; short merchant suitability note; INR price; packaging label only if supplied.

**Search/filter requirement:** Occasion, recipient preference, budget; recipient labels describe gifts, never inferred sensitive personal traits. Canonical query pagination, stable product links and a recoverable query state apply. Server facet support is a dependency; if unavailable, use explicit category navigation and honest basic search rather than inert facet controls. Display result count only when supplied. Empty results retain the query and applied filters, offer clear-one/clear-all, and link to a broader category.

## Product detail and cart

Open-box/closed-box media pair; what is included checklist; packaging choice only if a genuine SKU; gift note only after contract validation; purchase summary.

Use a shared server-cart adapter and its existing error model. Preserve selected variant/configuration in the line summary; do not merge semantically different configurations. Cart add has pending, confirmed and failed states. Keep the product context visible after error. Empty cart links to this design's meaningful discovery entry. Stock or price change is resolved by the server and explained before a checkout action continues. Configurable extras, notes or uploads are absent until their contracts work across cart, order and fulfillment.

## Mobile composition and states

Three independent discovery chips with an obvious skip-to-all; contents before CTA; gift note editable in cart only if end-to-end supported.

| State | Required behavior |
|---|---|
| Empty merchant catalog | Show honest merchant introduction/categories if present; explain no products; no demo items mixed with real inventory. |
| Missing image or facts | Stable aspect-ratio placeholder with meaningful text; absent critical fact is labelled, not synthesized. |
| Unavailable selection | Preserve named option, show availability text, disable submission for invalid SKU and offer valid alternatives. |
| Loading | Retain previous layout; labelled progress; reserve media size; pending mutation blocks duplicate submission. |
| Network/validation error | Error adjacent to action/field and status announcement; retry retains non-sensitive choices. |
| Keyboard/text zoom | Logical reading order, visible focus, no focus behind sticky bars, no truncated essential title or option. |

Niche acceptance: **Set Birthday and ₹1,000–₹2,000, then remove budget without losing occasion. A missing gift-message capability produces no interactive message field.** Also run the shared acceptance pack in [09](../09_ACCEPTANCE_AND_LIMITATIONS.md).

## Visual language, typography and interaction

Density: Curated medium; 64px / 28px sections; 10px media, 8px controls; 1200px content. Use the existing spacing/token mechanism; proposed values are an experience layer, not a second platform token authority. Images: 4:3 complete box and contents; 1:1 packaging detail. Decorative ribbons never substitute for included-items data. New web icons follow CODE-R7 using Lucide React in React islands. Liquid presentation should reuse the governed icon pipeline or labelled text until an approved compatible asset export is available; do not introduce another icon library or an unreviewed production icon set. Original schematic shapes in this research are placeholders, not production illustrations.

Heading/body: **Playfair Display / Lato**, already declared in the current experience font registry. Use only supplied weights (see registry), `display=swap`, and the established fallback stack. Proposed desktop scales: display 48–64/1.08; section 28–36/1.2; product title 28–36/1.2; body 16/1.55; support 14/1.45. Mobile: display 32–40, product title 26–30, body 16. Utility-heavy Circuit uses 14–16 for card facts, never tiny legal-size text. Long titles wrap naturally; two-line card visual clamping must preserve the full accessible name. INR values use locale formatting and tabular digits where supported.

Do not assume these Latin fonts cover Indian scripts. Preserve Unicode/graphemes, allow translation expansion, set language appropriately, use a tested system/script fallback, and verify Hindi plus the merchant's actual script before launch. The current Source Sans Pro registry name needs network/family verification against current Source Sans distribution; this research does not silently rename it. [Font and licensing boundary](../02_THEME_FAMILIES_AND_FOUNDATIONS.md).

Motion: Single chip/result transition and calm expansion; no forced carousel of occasions. Shared keyboard, reflow and reduced-motion rules remain consistent across the portfolio.

## Semantic color specification

| Role | Exact proposed value / pairing |
|---|---|
| canvas | `#FBF5F2` |
| surface | `#FFFFFF` |
| surface2 | `#F0E1DB` |
| text | `#352329` |
| muted | `#73545E` |
| border | `#8B6874` |
| action | `#793F56` |
| label | `#FFFFFF` |
| link | `#793F56` |
| focus | `#005FCC` |
| error | `#B42318` |
| errorSurface | `#FFF4F2` |
| warning | `#7A3E00` |
| warningSurface | `#FFF4CE` |
| success | `#166534` |
| successSurface | `#EDF8EF` |
| Secondary action | transparent on surface; `#793F56` text and border |
| Selected | `#793F56` fill / `#FFFFFF` label plus check and selected text |
| Promotional | `#F0E1DB` / `#352329`; no manufactured urgency |
| Disabled | surface2 with muted text; labelled unavailable and programmatic disabled state |

Focus: two-pixel visible ring with a contrasting offset/gutter on filled controls; test all adjacent backgrounds. A single ring color is not sufficient on arbitrary merchant images. Error, warning and success always include words/iconography, not color alone. These are proposed defaults, not approved platform-token changes.

| Pair | Ratio | Criterion used | Result |
|---|---:|---:|---|
| main text / canvas | 13.66:1 | 4.5:1 | pass |
| supporting / canvas | 6.16:1 | 4.5:1 | pass |
| label / action | 7.9:1 | 4.5:1 | pass |
| link / surface | 7.9:1 | 4.5:1 | pass |
| control border / surface | 4.85:1 | 3:1 | pass |
| focus / surface | 5.98:1 | 3:1 | pass |
| error / error surface | 6.1:1 | 4.5:1 | pass |
| warning / warning surface | 7.58:1 | 4.5:1 | pass |
| success / success surface | 6.54:1 | 4.5:1 | pass |
| supporting / surface2 | 5.22:1 | 4.5:1 | pass |

Computed with the WCAG relative-luminance formula for opaque sRGB pairs. This is a palette check, not a claim of complete accessibility. Image overlays, all component states and merchant overrides need rendered checks.

## Editor, reusable system and capability boundary

Required content fields: **occasion/recipient tags; complete set contents; packaging description; optional typed note constraints if supported; real shipping policy**. Use canonical shared domain contracts; typed niche schemas may validate approved metadata but a generic metadata field is not proof those facts reach Liquid.

Reuse header/footer/navigation, canonical `productDetail`, `productGrid`, category/rich-text/media primitives, option/quantity/cart islands and existing section registration. Proposed bounded extensions: **categoryGrid layout=occasion-finder; productGrid card=gift; productDetail layout=contents; optional note editor after C**. Keep one implementation per reusable pattern, selected by schema-validated settings. Domain-level classes: **D repurposing Summit generic fallback requires identity/version decision; C gift-message contract and persistence; D arrival claims and configurable bundles**. Full feature owner/data/security matrix: [07](../07_COMPONENT_AND_DATA_CAPABILITY_MAP.md).

Editor controls: content/media/focal point, named collection bindings, permitted card facts, supported layout choices, type scale limits and semantic palette values. Reordering/removing sections remains merchant-owned; required purchase/safety context must remain reachable. Show missing-content guidance without inserting fabricated data. Preview mobile and desktop with the same versioned document. Switching offers style-only, additive composition or reviewed full-design application; full-design removal/content-risk diff must be shown before application to an existing store. Draft save and public publish remain separate actions.

## Research rationale and original departure

Informed by [Studio](../shopify-theme-dossiers/studio.md) / [Craft](../shopify-theme-dossiers/craft.md) / [Savor](../shopify-theme-dossiers/savor.md). These references establish observed patterns, not proof that this proposal improves conversion. **Intentional departure:** Support suitability-led retrieval as a distinct mission; avoid personalization inputs for ordinary ready-made gifts.

Review original [desktop home](../visuals/wireframes/summit-home-desktop.svg), [mobile home](../visuals/wireframes/summit-home-mobile.svg), [collection](../visuals/wireframes/summit-collection-desktop.svg), and [product](../visuals/wireframes/summit-product-desktop.svg). [Gallery](../visuals/design-review.html) includes all six page/device views plus neutral comparisons. Schematics establish hierarchy and zones; they are not interactive production pages or final art direction.
