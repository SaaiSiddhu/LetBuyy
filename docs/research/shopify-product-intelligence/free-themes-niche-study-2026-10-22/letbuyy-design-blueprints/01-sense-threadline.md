# 01 · Threadline — Fashion and apparel

**PROPOSED.** Working name, not a trademark-cleared product name. No implementation or publication is implied. Current ID: `sense`. Stable ID retained; proposal is a new, explicitly selected design version, never a silent rewrite of existing installations.

## Merchant, customer and design thesis

**Bounded segment:** Independent adult apparel labels; 20–200 styles with size/color variants. No rental or bespoke tailoring. The buyer's mission is: **Find an outfit, judge silhouette and fit, choose an available size.** Purchase uncertainty: Whether it fits, how it hangs, and whether a color/size is available. The merchant must provide a coherent category model and the niche facts below. A distinctive demo without those facts would overpromise the actual merchant experience.

**Primary journey:** Find an outfit, judge silhouette and fit, choose an available size. Home discovery → relevant collection → factual product evaluation → complete supported selection → canonical cart → hosted checkout. Anonymous discovery remains possible. Catalog data, availability, price and shipping remain server-authoritative.

## Sitemap and navigation

Header: **New / Clothing / Collections / Fit guide / About**. Sitemap: Home → named category/collection → product; Search/results; Cart; merchant informational pages; customer account as existing utility; canonical hosted checkout. Supporting pages: **size-guide page and inline garment measurement table; returns policy**. Desktop category links are explicit, with labelled search/cart controls. Mobile menu is a reversible disclosure/drawer with Escape, focus return and nested category back navigation. Never make hover the only route to a category.

## Homepage composition

1. Editorial outfit spread with two category entries.
2. Shop silhouettes: straight, relaxed, fitted.
3. New arrivals in portrait cards.
4. One outfit, separately priced products.
5. Fabric and care editorial.
6. Merchant service policies.

Each region has a distinct job. Removing an unsupported education block must leave useful category/product navigation, not a decorative blank panel. Do not seed shipping guarantees, discount urgency, fabricated ratings or safety/health claims.

## Collection, product cards and search

Portrait 3-column desktop / 2-column mobile grid; compact size/color controls above products; preserve selected size when returning from a PDP.

**Card contract:** 3:4 garment/model image; name; INR price; actual color count; available size entry. No automatic quick add for unresolved sizes.

**Search/filter requirement:** Category, size, color, price; size facet must mean a purchasable variant, not a product tag alone. Canonical query pagination, stable product links and a recoverable query state apply. Server facet support is a dependency; if unavailable, use explicit category navigation and honest basic search rather than inert facet controls. Display result count only when supplied. Empty results retain the query and applied filters, offer clear-one/clear-all, and link to a broader category.

## Product detail and cart

Two-column outfit/detail gallery with a persistent desktop fit rail. Name → price → named color → size buttons → size-guide disclosure → add. Measurements and model context precede care and related outfits.

Use a shared server-cart adapter and its existing error model. Preserve selected variant/configuration in the line summary; do not merge semantically different configurations. Cart add has pending, confirmed and failed states. Keep the product context visible after error. Empty cart links to this design's meaningful discovery entry. Stock or price change is resolved by the server and explained before a checkout action continues. Configurable extras, notes or uploads are absent until their contracts work across cart, order and fulfillment.

## Mobile composition and states

Gallery then name/price then size/fit and CTA; 2-column catalog; optional compact CTA only after a valid size exists, with no focus occlusion.

| State | Required behavior |
|---|---|
| Empty merchant catalog | Show honest merchant introduction/categories if present; explain no products; no demo items mixed with real inventory. |
| Missing image or facts | Stable aspect-ratio placeholder with meaningful text; absent critical fact is labelled, not synthesized. |
| Unavailable selection | Preserve named option, show availability text, disable submission for invalid SKU and offer valid alternatives. |
| Loading | Retain previous layout; labelled progress; reserve media size; pending mutation blocks duplicate submission. |
| Network/validation error | Error adjacent to action/field and status announcement; retry retains non-sensitive choices. |
| Keyboard/text zoom | Logical reading order, visible focus, no focus behind sticky bars, no truncated essential title or option. |

Niche acceptance: **Choose M; navigate to fit guide and back; retain M. Unavailable M remains labelled and cannot submit; a stock race returns an inline server error without losing color.** Also run the shared acceptance pack in [09](../09_ACCEPTANCE_AND_LIMITATIONS.md).

## Visual language, typography and interaction

Density: Editorial/airy; 80px desktop section gaps, 32px mobile; 8px radius on utilities, square media; 1280px content. Use the existing spacing/token mechanism; proposed values are an experience layer, not a second platform token authority. Images: 3:4 cards; 4:5 gallery; no face/hem crop unless merchant focal point explicitly supplied. New web icons follow CODE-R7 using Lucide React in React islands. Liquid presentation should reuse the governed icon pipeline or labelled text until an approved compatible asset export is available; do not introduce another icon library or an unreviewed production icon set. Original schematic shapes in this research are placeholders, not production illustrations.

Heading/body: **Playfair Display / Inter**, already declared in the current experience font registry. Use only supplied weights (see registry), `display=swap`, and the established fallback stack. Proposed desktop scales: display 48–64/1.08; section 28–36/1.2; product title 28–36/1.2; body 16/1.55; support 14/1.45. Mobile: display 32–40, product title 26–30, body 16. Utility-heavy Circuit uses 14–16 for card facts, never tiny legal-size text. Long titles wrap naturally; two-line card visual clamping must preserve the full accessible name. INR values use locale formatting and tabular digits where supported.

Do not assume these Latin fonts cover Indian scripts. Preserve Unicode/graphemes, allow translation expansion, set language appropriately, use a tested system/script fallback, and verify Hindi plus the merchant's actual script before launch. The current Source Sans Pro registry name needs network/family verification against current Source Sans distribution; this research does not silently rename it. [Font and licensing boundary](../02_THEME_FAMILIES_AND_FOUNDATIONS.md).

Motion: Crossfade supplementary image only on hover/focus equivalence; no autoplay lookbook. Shared keyboard, reflow and reduced-motion rules remain consistent across the portfolio.

## Semantic color specification

| Role | Exact proposed value / pairing |
|---|---|
| canvas | `#FAF7F2` |
| surface | `#FFFFFF` |
| surface2 | `#EFE7DC` |
| text | `#241E1A` |
| muted | `#65574C` |
| border | `#766657` |
| action | `#713F35` |
| label | `#FFFFFF` |
| link | `#713F35` |
| focus | `#005FCC` |
| error | `#B42318` |
| errorSurface | `#FFF4F2` |
| warning | `#7A3E00` |
| warningSurface | `#FFF4CE` |
| success | `#166534` |
| successSurface | `#EDF8EF` |
| Secondary action | transparent on surface; `#713F35` text and border |
| Selected | `#713F35` fill / `#FFFFFF` label plus check and selected text |
| Promotional | `#EFE7DC` / `#241E1A`; no manufactured urgency |
| Disabled | surface2 with muted text; labelled unavailable and programmatic disabled state |

Focus: two-pixel visible ring with a contrasting offset/gutter on filled controls; test all adjacent backgrounds. A single ring color is not sufficient on arbitrary merchant images. Error, warning and success always include words/iconography, not color alone. These are proposed defaults, not approved platform-token changes.

| Pair | Ratio | Criterion used | Result |
|---|---:|---:|---|
| main text / canvas | 15.41:1 | 4.5:1 | pass |
| supporting / canvas | 6.5:1 | 4.5:1 | pass |
| label / action | 8.52:1 | 4.5:1 | pass |
| link / surface | 8.52:1 | 4.5:1 | pass |
| control border / surface | 5.51:1 | 3:1 | pass |
| focus / surface | 5.98:1 | 3:1 | pass |
| error / error surface | 6.1:1 | 4.5:1 | pass |
| warning / warning surface | 7.58:1 | 4.5:1 | pass |
| success / success surface | 6.54:1 | 4.5:1 | pass |
| supporting / surface2 | 5.67:1 | 4.5:1 | pass |

Computed with the WCAG relative-luminance formula for opaque sRGB pairs. This is a palette check, not a claim of complete accessibility. Image overlays, all component states and merchant overrides need rendered checks.

## Editor, reusable system and capability boundary

Required content fields: **garment measurements with units; fit description; model measurements only with consent; fabric; care; color labels; actual option inventory**. Use canonical shared domain contracts; typed niche schemas may validate approved metadata but a generic metadata field is not proof those facts reach Liquid.

Reuse header/footer/navigation, canonical `productDetail`, `productGrid`, category/rich-text/media primitives, option/quantity/cart islands and existing section registration. Proposed bounded extensions: **productDetail layout=fit; productGrid card=apparel; existing categoryGrid for silhouettes; bounded outfit-links block, each product separately priced**. Keep one implementation per reusable pattern, selected by schema-validated settings. Domain-level classes: **C structured fit content and option-aware facet query; D separately priced outfit attribution if merchant requests it; no automated size recommendation**. Full feature owner/data/security matrix: [07](../07_COMPONENT_AND_DATA_CAPABILITY_MAP.md).

Editor controls: content/media/focal point, named collection bindings, permitted card facts, supported layout choices, type scale limits and semantic palette values. Reordering/removing sections remains merchant-owned; required purchase/safety context must remain reachable. Show missing-content guidance without inserting fabricated data. Preview mobile and desktop with the same versioned document. Switching offers style-only, additive composition or reviewed full-design application; full-design removal/content-risk diff must be shown before application to an existing store. Draft save and public publish remain separate actions.

## Research rationale and original departure

Informed by [Fabric](../shopify-theme-dossiers/fabric.md) / [Ritual](../shopify-theme-dossiers/ritual.md) / [Dawn](../shopify-theme-dossiers/dawn.md). These references establish observed patterns, not proof that this proposal improves conversion. **Intentional departure:** Replace oversized brand-wordmark openings with immediately named garment categories and measurable fit support.

Review original [desktop home](../visuals/wireframes/sense-home-desktop.svg), [mobile home](../visuals/wireframes/sense-home-mobile.svg), [collection](../visuals/wireframes/sense-collection-desktop.svg), and [product](../visuals/wireframes/sense-product-desktop.svg). [Gallery](../visuals/design-review.html) includes all six page/device views plus neutral comparisons. Schematics establish hierarchy and zones; they are not interactive production pages or final art direction.
