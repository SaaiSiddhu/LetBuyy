# 09 · Trailmark — Sports and outdoor equipment

**PROPOSED.** Working name, not a trademark-cleared product name. No implementation or publication is implied. Current ID: `ride`. Stable ID retained; proposal is a new, explicitly selected design version, never a silent rewrite of existing installations.

## Merchant, customer and design thesis

**Bounded segment:** Recreational accessories, clothing and non-safety-critical equipment. Exclude regulated/safety-critical gear fitting and activity booking. The buyer's mission is: **Find equipment for an activity and verify relevant size, conditions and compatibility.** Purchase uncertainty: Suitability for my activity, the fit/model, and actual conditions of use. The merchant must provide a coherent category model and the niche facts below. A distinctive demo without those facts would overpromise the actual merchant experience.

**Primary journey:** Find equipment for an activity and verify relevant size, conditions and compatibility. Home discovery → relevant collection → factual product evaluation → complete supported selection → canonical cart → hosted checkout. Anonymous discovery remains possible. Catalog data, availability, price and shipping remain server-authoritative.

## Sitemap and navigation

Header: **Activities / Equipment / Clothing / Guides / Support**. Sitemap: Home → named category/collection → product; Search/results; Cart; merchant informational pages; customer account as existing utility; canonical hosted checkout. Supporting pages: **selection guide; size guide by category; care; merchant support policy**. Desktop category links are explicit, with labelled search/cart controls. Mobile menu is a reversible disclosure/drawer with Escape, focus return and nested category back navigation. Never make hover the only route to a category.

## Homepage composition

1. Activity selector in a dark masthead.
2. Three activity pathways with equipment counts.
3. Performance facts over a restrained action image.
4. Equipment collection with specs.
5. How to choose guide.
6. Care and merchant support.

Each region has a distinct job. Removing an unsupported education block must leave useful category/product navigation, not a decorative blank panel. Do not seed shipping guarantees, discount urgency, fabricated ratings or safety/health claims.

## Collection, product cards and search

Activity breadcrumb, discipline/type sidebar and 3-column factual cards; mobile activity chips and compact equipment rows.

**Card contract:** 4:3 whole equipment; name; intended activity; 2 relevant facts with units; INR price. Apparel card switches to actual sizes, not generic performance claims.

**Search/filter requirement:** Activity, type, measured size and supplied compatibility; size schemas differ by equipment category. Canonical query pagination, stable product links and a recoverable query state apply. Server facet support is a dependency; if unavailable, use explicit category navigation and honest basic search rather than inert facet controls. Display result count only when supplied. Empty results retain the query and applied filters, offer clear-one/clear-all, and link to a broader category.

## Product detail and cart

Action/context image plus technical diagram; activity-fit facts panel; named model/size; CTA; comparison/spec table and care below.

Use a shared server-cart adapter and its existing error model. Preserve selected variant/configuration in the line summary; do not merge semantically different configurations. Cart add has pending, confirmed and failed states. Keep the product context visible after error. Empty cart links to this design's meaningful discovery entry. Stock or price change is resolved by the server and explained before a checkout action continues. Configurable extras, notes or uploads are absent until their contracts work across cart, order and fulfillment.

## Mobile composition and states

Activity context stays in breadcrumb; gallery then model/size and relevant facts before CTA; no permanent full-screen action video.

| State | Required behavior |
|---|---|
| Empty merchant catalog | Show honest merchant introduction/categories if present; explain no products; no demo items mixed with real inventory. |
| Missing image or facts | Stable aspect-ratio placeholder with meaningful text; absent critical fact is labelled, not synthesized. |
| Unavailable selection | Preserve named option, show availability text, disable submission for invalid SKU and offer valid alternatives. |
| Loading | Retain previous layout; labelled progress; reserve media size; pending mutation blocks duplicate submission. |
| Network/validation error | Error adjacent to action/field and status announcement; retry retains non-sensitive choices. |
| Keyboard/text zoom | Logical reading order, visible focus, no focus behind sticky bars, no truncated essential title or option. |

Niche acceptance: **Switch from clothing to equipment; clothing sizes disappear and measured equipment attributes appear. An unknown compatibility field never becomes universal.** Also run the shared acceptance pack in [09](../09_ACCEPTANCE_AND_LIMITATIONS.md).

## Visual language, typography and interaction

Density: Purposeful medium-compact; dark masthead, light reading area; 56px / 24px sections; 4px radius; 1320px content. Use the existing spacing/token mechanism; proposed values are an experience layer, not a second platform token authority. Images: 4:3 whole equipment; 16:9 activity story; technical detail on plain background with units. New web icons follow CODE-R7 using Lucide React in React islands. Liquid presentation should reuse the governed icon pipeline or labelled text until an approved compatible asset export is available; do not introduce another icon library or an unreviewed production icon set. Original schematic shapes in this research are placeholders, not production illustrations.

Heading/body: **Inter / Inter**, already declared in the current experience font registry. Use only supplied weights (see registry), `display=swap`, and the established fallback stack. Proposed desktop scales: display 48–64/1.08; section 28–36/1.2; product title 28–36/1.2; body 16/1.55; support 14/1.45. Mobile: display 32–40, product title 26–30, body 16. Utility-heavy Circuit uses 14–16 for card facts, never tiny legal-size text. Long titles wrap naturally; two-line card visual clamping must preserve the full accessible name. INR values use locale formatting and tabular digits where supported.

Do not assume these Latin fonts cover Indian scripts. Preserve Unicode/graphemes, allow translation expansion, set language appropriately, use a tested system/script fallback, and verify Hindi plus the merchant's actual script before launch. The current Source Sans Pro registry name needs network/family verification against current Source Sans distribution; this research does not silently rename it. [Font and licensing boundary](../02_THEME_FAMILIES_AND_FOUNDATIONS.md).

Motion: Activity category change and selected model feedback; pause/avoid autoplay action clips. Shared keyboard, reflow and reduced-motion rules remain consistent across the portfolio.

## Semantic color specification

| Role | Exact proposed value / pairing |
|---|---|
| canvas | `#F5F6F1` |
| surface | `#FFFFFF` |
| surface2 | `#E5E9DD` |
| text | `#222B22` |
| muted | `#53604C` |
| border | `#708064` |
| action | `#314E3B` |
| label | `#FFFFFF` |
| link | `#314E3B` |
| focus | `#005FCC` |
| error | `#B42318` |
| errorSurface | `#FFF4F2` |
| warning | `#7A3E00` |
| warningSurface | `#FFF4CE` |
| success | `#166534` |
| successSurface | `#EDF8EF` |
| Secondary action | transparent on surface; `#314E3B` text and border |
| Selected | `#314E3B` fill / `#FFFFFF` label plus check and selected text |
| Inverse masthead | `#222B22` / `#FFFFFF`; white text contrast 14.62:1 |
| Promotional | `#E5E9DD` / `#222B22`; no manufactured urgency |
| Disabled | surface2 with muted text; labelled unavailable and programmatic disabled state |

Focus: two-pixel visible ring with a contrasting offset/gutter on filled controls; test all adjacent backgrounds. A single ring color is not sufficient on arbitrary merchant images. Error, warning and success always include words/iconography, not color alone. These are proposed defaults, not approved platform-token changes.

| Pair | Ratio | Criterion used | Result |
|---|---:|---:|---|
| main text / canvas | 13.46:1 | 4.5:1 | pass |
| supporting / canvas | 6.15:1 | 4.5:1 | pass |
| label / action | 9.2:1 | 4.5:1 | pass |
| link / surface | 9.2:1 | 4.5:1 | pass |
| control border / surface | 4.23:1 | 3:1 | pass |
| focus / surface | 5.98:1 | 3:1 | pass |
| error / error surface | 6.1:1 | 4.5:1 | pass |
| warning / warning surface | 7.58:1 | 4.5:1 | pass |
| success / success surface | 6.54:1 | 4.5:1 | pass |
| supporting / surface2 | 5.41:1 | 4.5:1 | pass |

Computed with the WCAG relative-luminance formula for opaque sRGB pairs. This is a palette check, not a claim of complete accessibility. Image overlays, all component states and merchant overrides need rendered checks.

## Editor, reusable system and capability boundary

Required content fields: **activity; category-specific size data; compatibility reference; dimensions/weight; supplied use-condition text; care**. Use canonical shared domain contracts; typed niche schemas may validate approved metadata but a generic metadata field is not proof those facts reach Liquid.

Reuse header/footer/navigation, canonical `productDetail`, `productGrid`, category/rich-text/media primitives, option/quantity/cart islands and existing section registration. Proposed bounded extensions: **categoryGrid layout=activity-paths; productGrid card=equipment; productDetail layout=performance; shared factsTable with category-specific groups**. Keep one implementation per reusable pattern, selected by schema-validated settings. Domain-level classes: **C category-specific attributes and option facets; D safety-critical products explicitly excluded; no false testing/certification badges**. Full feature owner/data/security matrix: [07](../07_COMPONENT_AND_DATA_CAPABILITY_MAP.md).

Editor controls: content/media/focal point, named collection bindings, permitted card facts, supported layout choices, type scale limits and semantic palette values. Reordering/removing sections remains merchant-owned; required purchase/safety context must remain reachable. Show missing-content guidance without inserting fabricated data. Preview mobile and desktop with the same versioned document. Switching offers style-only, additive composition or reviewed full-design application; full-design removal/content-risk diff must be shown before application to an existing store. Draft save and public publish remain separate actions.

## Research rationale and original departure

Informed by [Ride](../shopify-theme-dossiers/ride.md) / [Heritage](../shopify-theme-dossiers/heritage.md) / [Tinker](../shopify-theme-dossiers/tinker.md). These references establish observed patterns, not proof that this proposal improves conversion. **Intentional departure:** Separate sporting equipment decisions from an apparel lookbook; retain readable light specification sections.

Review original [desktop home](../visuals/wireframes/ride-home-desktop.svg), [mobile home](../visuals/wireframes/ride-home-mobile.svg), [collection](../visuals/wireframes/ride-collection-desktop.svg), and [product](../visuals/wireframes/ride-product-desktop.svg). [Gallery](../visuals/design-review.html) includes all six page/device views plus neutral comparisons. Schematics establish hierarchy and zones; they are not interactive production pages or final art direction.
