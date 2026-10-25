# 05 · Habitat — Furniture and home

**PROPOSED.** Working name, not a trademark-cleared product name. No implementation or publication is implied. Current ID: `craft`. Stable ID retained; proposal is a new, explicitly selected design version, never a silent rewrite of existing installations.

## Merchant, customer and design thesis

**Bounded segment:** Stocked furniture and larger home objects; no interior-design service, custom manufacturing configurator or AR planner. The buyer's mission is: **Judge scale/material, confirm dimensions and understand actual delivery constraints.** Purchase uncertainty: Will it fit the room and access path, what is it made of, and how is delivery handled? The merchant must provide a coherent category model and the niche facts below. A distinctive demo without those facts would overpromise the actual merchant experience.

**Primary journey:** Judge scale/material, confirm dimensions and understand actual delivery constraints. Home discovery → relevant collection → factual product evaluation → complete supported selection → canonical cart → hosted checkout. Anonymous discovery remains possible. Catalog data, availability, price and shipping remain server-authoritative.

## Sitemap and navigation

Header: **Rooms / Furniture / Materials / Measurement guide / Delivery information**. Sitemap: Home → named category/collection → product; Search/results; Cart; merchant informational pages; customer account as existing utility; canonical hosted checkout. Supporting pages: **measurement guide; materials/care; assembly instructions; merchant delivery policy**. Desktop category links are explicit, with labelled search/cart controls. Mobile menu is a reversible disclosure/drawer with Escape, focus return and nested category back navigation. Never make hover the only route to a category.

## Homepage composition

1. Room index beside panoramic room story.
2. Room-specific curated selection.
3. Large 2-up furniture pieces.
4. Material swatches with text labels.
5. How to measure your space.
6. Maker story and delivery policy.

Each region has a distinct job. Removing an unsupported education block must leave useful category/product navigation, not a decorative blank panel. Do not seed shipping guarantees, discount urgency, fabricated ratings or safety/health claims.

## Collection, product cards and search

Room breadcrumb and horizontal category rail; 2 large desktop cards, 1 on mobile; dimension/finish facts beneath each object.

**Card contract:** 4:3 room/object pair; name; width × depth × height with units; finish; INR price. No misleading price from an unavailable finish.

**Search/filter requirement:** Room/type, maximum dimensions after normalized attributes, material, finish and price. Canonical query pagination, stable product links and a recoverable query state apply. Server facet support is a dependency; if unavailable, use explicit category navigation and honest basic search rather than inert facet controls. Display result count only when supplied. Empty results retain the query and applied filters, offer clear-one/clear-all, and link to a broader category.

## Product detail and cart

Panoramic room image above object detail; dimension diagram and finish choices adjacent to purchase; assembly/materials and actual shipping-policy link follow.

Use a shared server-cart adapter and its existing error model. Preserve selected variant/configuration in the line summary; do not merge semantically different configurations. Cart add has pending, confirmed and failed states. Keep the product context visible after error. Empty cart links to this design's meaningful discovery entry. Stock or price change is resolved by the server and explained before a checkout action continues. Configurable extras, notes or uploads are absent until their contracts work across cart, order and fulfillment.

## Mobile composition and states

Single-column room-to-object gallery; dimensions as actual text/table, not only a diagram; persistent access to finish/price after long gallery without covering content.

| State | Required behavior |
|---|---|
| Empty merchant catalog | Show honest merchant introduction/categories if present; explain no products; no demo items mixed with real inventory. |
| Missing image or facts | Stable aspect-ratio placeholder with meaningful text; absent critical fact is labelled, not synthesized. |
| Unavailable selection | Preserve named option, show availability text, disable submission for invalid SKU and offer valid alternatives. |
| Loading | Retain previous layout; labelled progress; reserve media size; pending mutation blocks duplicate submission. |
| Network/validation error | Error adjacent to action/field and status announcement; retry retains non-sensitive choices. |
| Keyboard/text zoom | Logical reading order, visible focus, no focus behind sticky bars, no truncated essential title or option. |

Niche acceptance: **Switch finish and preserve measured dimensions when common; variant-specific dimensions update correctly. No pincode delivery date is shown without a live server result.** Also run the shared acceptance pack in [09](../09_ACCEPTANCE_AND_LIMITATIONS.md).

## Visual language, typography and interaction

Density: Spacious, measured; 88px / 32px sections; 2px media radius, 6px controls; 1320px content. Use the existing spacing/token mechanism; proposed values are an experience layer, not a second platform token authority. Images: 4:3 cards, 16:9 rooms; keep the whole object visible; separate measured diagram with text equivalents. New web icons follow CODE-R7 using Lucide React in React islands. Liquid presentation should reuse the governed icon pipeline or labelled text until an approved compatible asset export is available; do not introduce another icon library or an unreviewed production icon set. Original schematic shapes in this research are placeholders, not production illustrations.

Heading/body: **Libre Baskerville / Source Sans Pro**, already declared in the current experience font registry. Use only supplied weights (see registry), `display=swap`, and the established fallback stack. Proposed desktop scales: display 48–64/1.08; section 28–36/1.2; product title 28–36/1.2; body 16/1.55; support 14/1.45. Mobile: display 32–40, product title 26–30, body 16. Utility-heavy Circuit uses 14–16 for card facts, never tiny legal-size text. Long titles wrap naturally; two-line card visual clamping must preserve the full accessible name. INR values use locale formatting and tabular digits where supported.

Do not assume these Latin fonts cover Indian scripts. Preserve Unicode/graphemes, allow translation expansion, set language appropriately, use a tested system/script fallback, and verify Hindi plus the merchant's actual script before launch. The current Source Sans Pro registry name needs network/family verification against current Source Sans distribution; this research does not silently rename it. [Font and licensing boundary](../02_THEME_FAMILIES_AND_FOUNDATIONS.md).

Motion: Manual gallery switching; no automatic parallax; material changes have an explicit selected label. Shared keyboard, reflow and reduced-motion rules remain consistent across the portfolio.

## Semantic color specification

| Role | Exact proposed value / pairing |
|---|---|
| canvas | `#F7F3EB` |
| surface | `#FFFDFA` |
| surface2 | `#E9E2D5` |
| text | `#302C25` |
| muted | `#625C50` |
| border | `#7B7261` |
| action | `#4E573E` |
| label | `#FFFFFF` |
| link | `#4E573E` |
| focus | `#005FCC` |
| error | `#B42318` |
| errorSurface | `#FFF4F2` |
| warning | `#7A3E00` |
| warningSurface | `#FFF4CE` |
| success | `#166534` |
| successSurface | `#EDF8EF` |
| Secondary action | transparent on surface; `#4E573E` text and border |
| Selected | `#4E573E` fill / `#FFFFFF` label plus check and selected text |
| Promotional | `#E9E2D5` / `#302C25`; no manufactured urgency |
| Disabled | surface2 with muted text; labelled unavailable and programmatic disabled state |

Focus: two-pixel visible ring with a contrasting offset/gutter on filled controls; test all adjacent backgrounds. A single ring color is not sufficient on arbitrary merchant images. Error, warning and success always include words/iconography, not color alone. These are proposed defaults, not approved platform-token changes.

| Pair | Ratio | Criterion used | Result |
|---|---:|---:|---|
| main text / canvas | 12.54:1 | 4.5:1 | pass |
| supporting / canvas | 5.99:1 | 4.5:1 | pass |
| label / action | 7.62:1 | 4.5:1 | pass |
| link / surface | 7.5:1 | 4.5:1 | pass |
| control border / surface | 4.68:1 | 3:1 | pass |
| focus / surface | 5.89:1 | 3:1 | pass |
| error / error surface | 6.1:1 | 4.5:1 | pass |
| warning / warning surface | 7.58:1 | 4.5:1 | pass |
| success / success surface | 6.54:1 | 4.5:1 | pass |
| supporting / surface2 | 5.15:1 | 4.5:1 | pass |

Computed with the WCAG relative-luminance formula for opaque sRGB pairs. This is a palette check, not a claim of complete accessibility. Image overlays, all component states and merchant overrides need rendered checks.

## Editor, reusable system and capability boundary

Required content fields: **width/depth/height and unit; assembled/package dimensions where supplied; finish/material; assembly text; shipping profile and policy link**. Use canonical shared domain contracts; typed niche schemas may validate approved metadata but a generic metadata field is not proof those facts reach Liquid.

Reuse header/footer/navigation, canonical `productDetail`, `productGrid`, category/rich-text/media primitives, option/quantity/cart islands and existing section registration. Proposed bounded extensions: **heroBanner layout=room-index; productGrid card=dimensions; productDetail layout=spatial; factsTable with unit formatting**. Keep one implementation per reusable pattern, selected by schema-validated settings. Domain-level classes: **C typed dimensions and facts hydration; D delivery-date promise requires validated operational contract; AR and service scheduling E**. Full feature owner/data/security matrix: [07](../07_COMPONENT_AND_DATA_CAPABILITY_MAP.md).

Editor controls: content/media/focal point, named collection bindings, permitted card facts, supported layout choices, type scale limits and semantic palette values. Reordering/removing sections remains merchant-owned; required purchase/safety context must remain reachable. Show missing-content guidance without inserting fabricated data. Preview mobile and desktop with the same versioned document. Switching offers style-only, additive composition or reviewed full-design application; full-design removal/content-risk diff must be shown before application to an existing store. Draft save and public publish remain separate actions.

## Research rationale and original departure

Informed by [Dwell](../shopify-theme-dossiers/dwell.md) / [Vessel](../shopify-theme-dossiers/vessel.md) / [Craft](../shopify-theme-dossiers/craft.md). These references establish observed patterns, not proof that this proposal improves conversion. **Intentional departure:** Make room fit and delivery uncertainty prominent rather than treating furniture as small tableware.

Review original [desktop home](../visuals/wireframes/craft-home-desktop.svg), [mobile home](../visuals/wireframes/craft-home-mobile.svg), [collection](../visuals/wireframes/craft-collection-desktop.svg), and [product](../visuals/wireframes/craft-product-desktop.svg). [Gallery](../visuals/design-review.html) includes all six page/device views plus neutral comparisons. Schematics establish hierarchy and zones; they are not interactive production pages or final art direction.
