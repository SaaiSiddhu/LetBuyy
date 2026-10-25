# 03 · Circuit — Electronics and gadgets

**PROPOSED.** Working name, not a trademark-cleared product name. No implementation or publication is implied. Current ID: `forge`. Stable ID retained; proposal is a new, explicitly selected design version, never a silent rewrite of existing installations.

## Merchant, customer and design thesis

**Bounded segment:** Consumer accessories and small electronics sold as stocked products; exclude installation booking, financing and service subscriptions. The buyer's mission is: **Retrieve the right model, verify compatibility and compare a few factual specifications.** Purchase uncertainty: Will it work with my device, what is included, and what exactly does this model support? The merchant must provide a coherent category model and the niche facts below. A distinctive demo without those facts would overpromise the actual merchant experience.

**Primary journey:** Retrieve the right model, verify compatibility and compare a few factual specifications. Home discovery → relevant collection → factual product evaluation → complete supported selection → canonical cart → hosted checkout. Anonymous discovery remains possible. Catalog data, availability, price and shipping remain server-authoritative.

## Sitemap and navigation

Header: **Persistent search / Devices / Accessories / Compatibility guide / Support**. Sitemap: Home → named category/collection → product; Search/results; Cart; merchant informational pages; customer account as existing utility; canonical hosted checkout. Supporting pages: **compatibility guide and merchant support policy; no default warranty guarantee**. Desktop category links are explicit, with labelled search/cart controls. Mobile menu is a reversible disclosure/drawer with Escape, focus return and nested category back navigation. Never make hover the only route to a category.

## Homepage composition

1. Search and category rail before campaign.
2. Task shortcuts: charge, connect, listen.
3. Compact featured-device matrix.
4. Compatibility explainer.
5. New products with key specs.
6. Actual merchant support and returns.

Each region has a distinct job. Removing an unsupported education block must leave useful category/product navigation, not a decorative blank panel. Do not seed shipping guarantees, discount urgency, fabricated ratings or safety/health claims.

## Collection, product cards and search

Persistent desktop facet rail and dense 4-column spec cards; mobile compact list with filter sheet; 2–3 item compare tray only after contract delivery.

**Card contract:** 1:1 contained product; manufacturer/model; 2 typed key specifications; INR price; stock label; compare checkbox only when working.

**Search/filter requirement:** Type, brand, connector, model compatibility and price; normalize units and treat unknown values explicitly. Canonical query pagination, stable product links and a recoverable query state apply. Server facet support is a dependency; if unavailable, use explicit category navigation and honest basic search rather than inert facet controls. Display result count only when supplied. Empty results retain the query and applied filters, offer clear-one/clear-all, and link to a broader category.

## Product detail and cart

Thumbnail column and contained product diagram; model/variant selector; compatibility status tied to an explicit reference; CTA; full-width specification table below.

Use a shared server-cart adapter and its existing error model. Preserve selected variant/configuration in the line summary; do not merge semantically different configurations. Cart add has pending, confirmed and failed states. Keep the product context visible after error. Empty cart links to this design's meaningful discovery entry. Stock or price change is resolved by the server and explained before a checkout action continues. Configurable extras, notes or uploads are absent until their contracts work across cart, order and fulfillment.

## Mobile composition and states

Search remains reachable; list rows prioritize model and two specs; comparison becomes a labelled horizontal table with row headers and no hidden products.

| State | Required behavior |
|---|---|
| Empty merchant catalog | Show honest merchant introduction/categories if present; explain no products; no demo items mixed with real inventory. |
| Missing image or facts | Stable aspect-ratio placeholder with meaningful text; absent critical fact is labelled, not synthesized. |
| Unavailable selection | Preserve named option, show availability text, disable submission for invalid SKU and offer valid alternatives. |
| Loading | Retain previous layout; labelled progress; reserve media size; pending mutation blocks duplicate submission. |
| Network/validation error | Error adjacent to action/field and status announcement; retry retains non-sensitive choices. |
| Keyboard/text zoom | Logical reading order, visible focus, no focus behind sticky bars, no truncated essential title or option. |

Niche acceptance: **Compare two USB chargers; unlike units are normalized or marked incomparable. Missing compatibility says unconfirmed; it never asserts fits all.** Also run the shared acceptance pack in [09](../09_ACCEPTANCE_AND_LIMITATIONS.md).

## Visual language, typography and interaction

Density: Compact functional; 48px / 24px sections; 4px radius, tabular numerals; 1360px content. Use the existing spacing/token mechanism; proposed values are an experience layer, not a second platform token authority. Images: 1:1 contain, never crop ports; 16:9 annotated feature images with equivalent text. New web icons follow CODE-R7 using Lucide React in React islands. Liquid presentation should reuse the governed icon pipeline or labelled text until an approved compatible asset export is available; do not introduce another icon library or an unreviewed production icon set. Original schematic shapes in this research are placeholders, not production illustrations.

Heading/body: **Inter / Inter**, already declared in the current experience font registry. Use only supplied weights (see registry), `display=swap`, and the established fallback stack. Proposed desktop scales: display 48–64/1.08; section 28–36/1.2; product title 28–36/1.2; body 16/1.55; support 14/1.45. Mobile: display 32–40, product title 26–30, body 16. Utility-heavy Circuit uses 14–16 for card facts, never tiny legal-size text. Long titles wrap naturally; two-line card visual clamping must preserve the full accessible name. INR values use locale formatting and tabular digits where supported.

Do not assume these Latin fonts cover Indian scripts. Preserve Unicode/graphemes, allow translation expansion, set language appropriately, use a tested system/script fallback, and verify Hindi plus the merchant's actual script before launch. The current Source Sans Pro registry name needs network/family verification against current Source Sans distribution; this research does not silently rename it. [Font and licensing boundary](../02_THEME_FAMILIES_AND_FOUNDATIONS.md).

Motion: Immediate state feedback and subtle table updates; no rotating specification carousels. Shared keyboard, reflow and reduced-motion rules remain consistent across the portfolio.

## Semantic color specification

| Role | Exact proposed value / pairing |
|---|---|
| canvas | `#F5F7FA` |
| surface | `#FFFFFF` |
| surface2 | `#E7EDF5` |
| text | `#142236` |
| muted | `#4C5B70` |
| border | `#67768B` |
| action | `#17476E` |
| label | `#FFFFFF` |
| link | `#17476E` |
| focus | `#005FCC` |
| error | `#B42318` |
| errorSurface | `#FFF4F2` |
| warning | `#7A3E00` |
| warningSurface | `#FFF4CE` |
| success | `#166534` |
| successSurface | `#EDF8EF` |
| Secondary action | transparent on surface; `#17476E` text and border |
| Selected | `#17476E` fill / `#FFFFFF` label plus check and selected text |
| Promotional | `#E7EDF5` / `#142236`; no manufactured urgency |
| Disabled | surface2 with muted text; labelled unavailable and programmatic disabled state |

Focus: two-pixel visible ring with a contrasting offset/gutter on filled controls; test all adjacent backgrounds. A single ring color is not sufficient on arbitrary merchant images. Error, warning and success always include words/iconography, not color alone. These are proposed defaults, not approved platform-token changes.

| Pair | Ratio | Criterion used | Result |
|---|---:|---:|---|
| main text / canvas | 14.92:1 | 4.5:1 | pass |
| supporting / canvas | 6.44:1 | 4.5:1 | pass |
| label / action | 9.71:1 | 4.5:1 | pass |
| link / surface | 9.71:1 | 4.5:1 | pass |
| control border / surface | 4.62:1 | 3:1 | pass |
| focus / surface | 5.98:1 | 3:1 | pass |
| error / error surface | 6.1:1 | 4.5:1 | pass |
| warning / warning surface | 7.58:1 | 4.5:1 | pass |
| success / success surface | 6.54:1 | 4.5:1 | pass |
| supporting / surface2 | 5.87:1 | 4.5:1 | pass |

Computed with the WCAG relative-luminance formula for opaque sRGB pairs. This is a palette check, not a claim of complete accessibility. Image overlays, all component states and merchant overrides need rendered checks.

## Editor, reusable system and capability boundary

Required content fields: **brand/model; connector; compatible device models with reference/source; power units; dimensions; supported warranty text supplied by merchant**. Use canonical shared domain contracts; typed niche schemas may validate approved metadata but a generic metadata field is not proof those facts reach Liquid.

Reuse header/footer/navigation, canonical `productDetail`, `productGrid`, category/rich-text/media primitives, option/quantity/cart islands and existing section registration. Proposed bounded extensions: **productGrid card=specs with list/grid density; productDetail layout=technical; reusable factsTable; bounded comparison module**. Keep one implementation per reusable pattern, selected by schema-validated settings. Domain-level classes: **C typed unit-aware attributes and compare query; D compatibility statement ownership; optional compare deferred until real normalized data exists**. Full feature owner/data/security matrix: [07](../07_COMPONENT_AND_DATA_CAPABILITY_MAP.md).

Editor controls: content/media/focal point, named collection bindings, permitted card facts, supported layout choices, type scale limits and semantic palette values. Reordering/removing sections remains merchant-owned; required purchase/safety context must remain reachable. Show missing-content guidance without inserting fabricated data. Preview mobile and desktop with the same versioned document. Switching offers style-only, additive composition or reviewed full-design application; full-design removal/content-risk diff must be shown before application to an existing store. Draft save and public publish remain separate actions.

## Research rationale and original departure

Informed by [Trade](../shopify-theme-dossiers/trade.md) / [Tinker](../shopify-theme-dossiers/tinker.md) / [Horizon](../shopify-theme-dossiers/horizon.md). These references establish observed patterns, not proof that this proposal improves conversion. **Intentional departure:** Use a search/specification hierarchy instead of a lifestyle image as the principal retrieval tool.

Review original [desktop home](../visuals/wireframes/forge-home-desktop.svg), [mobile home](../visuals/wireframes/forge-home-mobile.svg), [collection](../visuals/wireframes/forge-collection-desktop.svg), and [product](../visuals/wireframes/forge-product-desktop.svg). [Gallery](../visuals/design-review.html) includes all six page/device views plus neutral comparisons. Schematics establish hierarchy and zones; they are not interactive production pages or final art direction.
