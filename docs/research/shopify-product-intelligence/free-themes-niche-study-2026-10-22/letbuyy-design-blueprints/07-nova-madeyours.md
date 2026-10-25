# 07 · MadeYours — Personalized and made-to-order products

**PROPOSED.** Working name, not a trademark-cleared product name. No implementation or publication is implied. Current ID: `nova`. Stable ID retained; proposal is a new, explicitly selected design version, never a silent rewrite of existing installations.

## Merchant, customer and design thesis

**Bounded segment:** Initial proposal: stocked base objects with bounded text personalization only. Launch blocked until server validation and order persistence are proven. The buyer's mission is: **Choose a base, enter permitted text, review exactly what will be produced, and confirm constraints.** Purchase uncertainty: What will be made, what characters fit, how price changes and whether it can be corrected before ordering. The merchant must provide a coherent category model and the niche facts below. A distinctive demo without those facts would overpromise the actual merchant experience.

**Primary journey:** Choose a base, enter permitted text, review exactly what will be produced, and confirm constraints. Home discovery → relevant collection → factual product evaluation → complete supported selection → canonical cart → hosted checkout. Anonymous discovery remains possible. Catalog data, availability, price and shipping remain server-authoritative.

## Sitemap and navigation

Header: **Choose a base / How personalization works / Examples / Production policy / Help**. Sitemap: Home → named category/collection → product; Search/results; Cart; merchant informational pages; customer account as existing utility; canonical hosted checkout. Supporting pages: **personalization constraints; production time policy; cancellation/returns policy; help**. Desktop category links are explicit, with labelled search/cart controls. Mobile menu is a reversible disclosure/drawer with Escape, focus return and nested category back navigation. Never make hover the only route to a category.

## Homepage composition

1. Process-led three steps: choose, specify, review.
2. Base-product category tiles.
3. Annotated text examples with limitations.
4. What can and cannot be customized.
5. Production and returns policy.
6. Maker process.

Each region has a distinct job. Removing an unsupported education block must leave useful category/product navigation, not a decorative blank panel. Do not seed shipping guarantees, discount urgency, fabricated ratings or safety/health claims.

## Collection, product cards and search

Base-product catalog with personalization area and supported limits on cards; no fake live customization overlay.

**Card contract:** 1:1 base image; name; personalization method; maximum characters from contract; base/total price distinctions only if server-defined.

**Search/filter requirement:** Base product, supported method, price; filter cannot advertise unsupported uploads or logo printing. Canonical query pagination, stable product links and a recoverable query state apply. Server facet support is a dependency; if unavailable, use explicit category navigation and honest basic search rather than inert facet controls. Display result count only when supplied. Empty results retain the query and applied filters, offer clear-one/clear-all, and link to a broader category.

## Product detail and cart

Workspace layout: base preview left, step form right; base variant → text → review. Plain text summary is authoritative; graphical preview is explicitly illustrative. Cart contains immutable validated configuration snapshot.

Use a shared server-cart adapter and its existing error model. Preserve selected variant/configuration in the line summary; do not merge semantically different configurations. Cart add has pending, confirmed and failed states. Keep the product context visible after error. Empty cart links to this design's meaningful discovery entry. Stock or price change is resolved by the server and explained before a checkout action continues. Configurable extras, notes or uploads are absent until their contracts work across cart, order and fulfillment.

## Mobile composition and states

One visible step at a time with back/edit, retained inputs and review screen; errors near field and summary; no forced account or hidden auto-submit.

| State | Required behavior |
|---|---|
| Empty merchant catalog | Show honest merchant introduction/categories if present; explain no products; no demo items mixed with real inventory. |
| Missing image or facts | Stable aspect-ratio placeholder with meaningful text; absent critical fact is labelled, not synthesized. |
| Unavailable selection | Preserve named option, show availability text, disable submission for invalid SKU and offer valid alternatives. |
| Loading | Retain previous layout; labelled progress; reserve media size; pending mutation blocks duplicate submission. |
| Network/validation error | Error adjacent to action/field and status announcement; retry retains non-sensitive choices. |
| Keyboard/text zoom | Logical reading order, visible focus, no focus behind sticky bars, no truncated essential title or option. |

Niche acceptance: **Enter a disallowed character and see a precise recoverable error. Edit text in cart and revalidate price; two different configurations do not merge into one line. Retry produces one order effect.** Also run the shared acceptance pack in [09](../09_ACCEPTANCE_AND_LIMITATIONS.md).

## Visual language, typography and interaction

Density: Form workspace; 48px / 24px sections; 8px controls, 4px preview; 1280px content. Use the existing spacing/token mechanism; proposed values are an experience layer, not a second platform token authority. Images: 1:1 base product, 4:3 preview stage; preserve printable placement proportion, provide the same configuration as text. New web icons follow CODE-R7 using Lucide React in React islands. Liquid presentation should reuse the governed icon pipeline or labelled text until an approved compatible asset export is available; do not introduce another icon library or an unreviewed production icon set. Original schematic shapes in this research are placeholders, not production illustrations.

Heading/body: **Inter / Inter**, already declared in the current experience font registry. Use only supplied weights (see registry), `display=swap`, and the established fallback stack. Proposed desktop scales: display 48–64/1.08; section 28–36/1.2; product title 28–36/1.2; body 16/1.55; support 14/1.45. Mobile: display 32–40, product title 26–30, body 16. Utility-heavy Circuit uses 14–16 for card facts, never tiny legal-size text. Long titles wrap naturally; two-line card visual clamping must preserve the full accessible name. INR values use locale formatting and tabular digits where supported.

Do not assume these Latin fonts cover Indian scripts. Preserve Unicode/graphemes, allow translation expansion, set language appropriately, use a tested system/script fallback, and verify Hindi plus the merchant's actual script before launch. The current Source Sans Pro registry name needs network/family verification against current Source Sans distribution; this research does not silently rename it. [Font and licensing boundary](../02_THEME_FAMILIES_AND_FOUNDATIONS.md).

Motion: Step progress and validation feedback only; preview changes after deliberate input; honor reduced motion. Shared keyboard, reflow and reduced-motion rules remain consistent across the portfolio.

## Semantic color specification

| Role | Exact proposed value / pairing |
|---|---|
| canvas | `#F5F6FC` |
| surface | `#FFFFFF` |
| surface2 | `#E7EAF7` |
| text | `#23243E` |
| muted | `#595D7D` |
| border | `#747999` |
| action | `#484B8B` |
| label | `#FFFFFF` |
| link | `#484B8B` |
| focus | `#005FCC` |
| error | `#B42318` |
| errorSurface | `#FFF4F2` |
| warning | `#7A3E00` |
| warningSurface | `#FFF4CE` |
| success | `#166534` |
| successSurface | `#EDF8EF` |
| Secondary action | transparent on surface; `#484B8B` text and border |
| Selected | `#484B8B` fill / `#FFFFFF` label plus check and selected text |
| Promotional | `#E7EAF7` / `#23243E`; no manufactured urgency |
| Disabled | surface2 with muted text; labelled unavailable and programmatic disabled state |

Focus: two-pixel visible ring with a contrasting offset/gutter on filled controls; test all adjacent backgrounds. A single ring color is not sufficient on arbitrary merchant images. Error, warning and success always include words/iconography, not color alone. These are proposed defaults, not approved platform-token changes.

| Pair | Ratio | Criterion used | Result |
|---|---:|---:|---|
| main text / canvas | 13.97:1 | 4.5:1 | pass |
| supporting / canvas | 5.92:1 | 4.5:1 | pass |
| label / action | 7.91:1 | 4.5:1 | pass |
| link / surface | 7.91:1 | 4.5:1 | pass |
| control border / surface | 4.25:1 | 3:1 | pass |
| focus / surface | 5.98:1 | 3:1 | pass |
| error / error surface | 6.1:1 | 4.5:1 | pass |
| warning / warning surface | 7.58:1 | 4.5:1 | pass |
| success / success surface | 6.54:1 | 4.5:1 | pass |
| supporting / surface2 | 5.33:1 | 4.5:1 | pass |

Computed with the WCAG relative-luminance formula for opaque sRGB pairs. This is a palette check, not a claim of complete accessibility. Image overlays, all component states and merchant overrides need rendered checks.

## Editor, reusable system and capability boundary

Required content fields: **allowed characters; normalized length/grapheme rules; safe text bounds; placement/method; production policy; server price consequences; configuration version**. Use canonical shared domain contracts; typed niche schemas may validate approved metadata but a generic metadata field is not proof those facts reach Liquid.

Reuse header/footer/navigation, canonical `productDetail`, `productGrid`, category/rich-text/media primitives, option/quantity/cart islands and existing section registration. Proposed bounded extensions: **productDetail layout=configurator; typed customization schema, preview and review blocks integrated into canonical cart island; no new renderer**. Keep one implementation per reusable pattern, selected by schema-validated settings. Domain-level classes: **C/D end-to-end configuration validation, order snapshot and merchant fulfillment visibility; E file uploads/proof approvals for initial release; text escaping and abuse limits mandatory**. Full feature owner/data/security matrix: [07](../07_COMPONENT_AND_DATA_CAPABILITY_MAP.md).

Editor controls: content/media/focal point, named collection bindings, permitted card facts, supported layout choices, type scale limits and semantic palette values. Reordering/removing sections remains merchant-owned; required purchase/safety context must remain reachable. Show missing-content guidance without inserting fabricated data. Preview mobile and desktop with the same versioned document. Switching offers style-only, additive composition or reviewed full-design application; full-design removal/content-risk diff must be shown before application to an existing store. Draft save and public publish remain separate actions.

## Research rationale and original departure

Informed by [Origin](../shopify-theme-dossiers/origin.md) / [Tinker](../shopify-theme-dossiers/tinker.md) / [Atelier](../shopify-theme-dossiers/atelier.md). These references establish observed patterns, not proof that this proposal improves conversion. **Intentional departure:** Make configuration constraints the primary architecture. Existing generic line properties do not justify a simulated personalization service.

Review original [desktop home](../visuals/wireframes/nova-home-desktop.svg), [mobile home](../visuals/wireframes/nova-home-mobile.svg), [collection](../visuals/wireframes/nova-collection-desktop.svg), and [product](../visuals/wireframes/nova-product-desktop.svg). [Gallery](../visuals/design-review.html) includes all six page/device views plus neutral comparisons. Schematics establish hierarchy and zones; they are not interactive production pages or final art direction.
