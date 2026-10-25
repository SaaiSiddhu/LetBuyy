# 02 · Playfield — Kids and toys

**PROPOSED.** Working name, not a trademark-cleared product name. No implementation or publication is implied. Current ID: `bloom`. Stable ID retained; proposal is a new, explicitly selected design version, never a silent rewrite of existing installations. Current Bloom targets pets; moving its new-catalog positioning to toys requires an explicit product decision. Preserve old pet instances and their releases; do not relabel their niche retroactively.

## Merchant, customer and design thesis

**Bounded segment:** Adult purchasers of physical toys, puzzles and creative kits; no child accounts, behavioral profiling or age-targeted advertising. The buyer's mission is: **Choose an age-appropriate, interesting gift or activity and understand its contents.** Purchase uncertainty: Suitability, physical scale, included pieces, and merchant-stated warnings. The merchant must provide a coherent category model and the niche facts below. A distinctive demo without those facts would overpromise the actual merchant experience.

**Primary journey:** Choose an age-appropriate, interesting gift or activity and understand its contents. Home discovery → relevant collection → factual product evaluation → complete supported selection → canonical cart → hosted checkout. Anonymous discovery remains possible. Catalog data, availability, price and shipping remain server-authoritative.

## Sitemap and navigation

Header: **Shop by age / Interests / Toys / Creative kits / Product information**. Sitemap: Home → named category/collection → product; Search/results; Cart; merchant informational pages; customer account as existing utility; canonical hosted checkout. Supporting pages: **product information and safety-source page; care/replacement policy; adult contact**. Desktop category links are explicit, with labelled search/cart controls. Mobile menu is a reversible disclosure/drawer with Escape, focus return and nested category back navigation. Never make hover the only route to a category.

## Homepage composition

1. Adult-facing age and interest chooser.
2. Asymmetric play/activity bento.
3. Age-labelled popular kits.
4. What is included comparison strip.
5. Materials and care information.
6. Play ideas linked to products.

Each region has a distinct job. Removing an unsupported education block must leave useful category/product navigation, not a decorative blank panel. Do not seed shipping guarantees, discount urgency, fabricated ratings or safety/health claims.

## Collection, product cards and search

Age/interest summary followed by explicit age-band groups and contents-rich cards; mobile uses age-group headings and toy fact rows; no forced quiz.

**Card contract:** 1:1 full toy image; product name; merchant-stated age range; pieces/size when supplied; INR price. Badges never imply certification.

**Search/filter requirement:** Merchant age bands, interest, product type, price; unknown age stays labelled information not supplied. Canonical query pagination, stable product links and a recoverable query state apply. Server facet support is a dependency; if unavailable, use explicit category navigation and honest basic search rather than inert facet controls. Display result count only when supplied. Empty results retain the query and applied filters, offer clear-one/clear-all, and link to a broader category.

## Product detail and cart

Image and contents gallery; adjacent age-range and supervision facts; purchase strip; full-width included-pieces diagram and factual material/dimension panel.

Use a shared server-cart adapter and its existing error model. Preserve selected variant/configuration in the line summary; do not merge semantically different configurations. Cart add has pending, confirmed and failed states. Keep the product context visible after error. Empty cart links to this design's meaningful discovery entry. Stock or price change is resolved by the server and explained before a checkout action continues. Configurable extras, notes or uploads are absent until their contracts work across cart, order and fulfillment.

## Mobile composition and states

Two explicit choices age and interest; large tap targets; no bouncing decorative controls; facts before purchase.

| State | Required behavior |
|---|---|
| Empty merchant catalog | Show honest merchant introduction/categories if present; explain no products; no demo items mixed with real inventory. |
| Missing image or facts | Stable aspect-ratio placeholder with meaningful text; absent critical fact is labelled, not synthesized. |
| Unavailable selection | Preserve named option, show availability text, disable submission for invalid SKU and offer valid alternatives. |
| Loading | Retain previous layout; labelled progress; reserve media size; pending mutation blocks duplicate submission. |
| Network/validation error | Error adjacent to action/field and status announcement; retry retains non-sensitive choices. |
| Keyboard/text zoom | Logical reading order, visible focus, no focus behind sticky bars, no truncated essential title or option. |

Niche acceptance: **Filter age 6–8 then art; remove one chip and retain the other. A product with missing age data never receives a fabricated age badge.** Also run the shared acceptance pack in [09](../09_ACCEPTANCE_AND_LIMITATIONS.md).

## Visual language, typography and interaction

Density: Friendly medium density; 64px / 28px section gaps; 16px media radius, 8px utilities; 1200px content. Use the existing spacing/token mechanism; proposed values are an experience layer, not a second platform token authority. Images: 1:1 cards contain the whole object; 4:3 play photos; provide scale reference as actual merchant content. New web icons follow CODE-R7 using Lucide React in React islands. Liquid presentation should reuse the governed icon pipeline or labelled text until an approved compatible asset export is available; do not introduce another icon library or an unreviewed production icon set. Original schematic shapes in this research are placeholders, not production illustrations.

Heading/body: **Inter / Inter**, already declared in the current experience font registry. Use only supplied weights (see registry), `display=swap`, and the established fallback stack. Proposed desktop scales: display 48–64/1.08; section 28–36/1.2; product title 28–36/1.2; body 16/1.55; support 14/1.45. Mobile: display 32–40, product title 26–30, body 16. Utility-heavy Circuit uses 14–16 for card facts, never tiny legal-size text. Long titles wrap naturally; two-line card visual clamping must preserve the full accessible name. INR values use locale formatting and tabular digits where supported.

Do not assume these Latin fonts cover Indian scripts. Preserve Unicode/graphemes, allow translation expansion, set language appropriately, use a tested system/script fallback, and verify Hindi plus the merchant's actual script before launch. The current Source Sans Pro registry name needs network/family verification against current Source Sans distribution; this research does not silently rename it. [Font and licensing boundary](../02_THEME_FAMILIES_AND_FOUNDATIONS.md).

Motion: One user-initiated panel expansion; static decorative shapes; reduced motion removes transitions. Shared keyboard, reflow and reduced-motion rules remain consistent across the portfolio.

## Semantic color specification

| Role | Exact proposed value / pairing |
|---|---|
| canvas | `#FFF9EE` |
| surface | `#FFFFFF` |
| surface2 | `#F3E6C8` |
| text | `#29251D` |
| muted | `#655A43` |
| border | `#7A6A4D` |
| action | `#1D5C54` |
| label | `#FFFFFF` |
| link | `#1D5C54` |
| focus | `#005FCC` |
| error | `#B42318` |
| errorSurface | `#FFF4F2` |
| warning | `#7A3E00` |
| warningSurface | `#FFF4CE` |
| success | `#166534` |
| successSurface | `#EDF8EF` |
| Secondary action | transparent on surface; `#1D5C54` text and border |
| Selected | `#1D5C54` fill / `#FFFFFF` label plus check and selected text |
| Promotional | `#F3E6C8` / `#29251D`; no manufactured urgency |
| Disabled | surface2 with muted text; labelled unavailable and programmatic disabled state |

Focus: two-pixel visible ring with a contrasting offset/gutter on filled controls; test all adjacent backgrounds. A single ring color is not sufficient on arbitrary merchant images. Error, warning and success always include words/iconography, not color alone. These are proposed defaults, not approved platform-token changes.

| Pair | Ratio | Criterion used | Result |
|---|---:|---:|---|
| main text / canvas | 14.55:1 | 4.5:1 | pass |
| supporting / canvas | 6.47:1 | 4.5:1 | pass |
| label / action | 7.75:1 | 4.5:1 | pass |
| link / surface | 7.75:1 | 4.5:1 | pass |
| control border / surface | 5.25:1 | 3:1 | pass |
| focus / surface | 5.98:1 | 3:1 | pass |
| error / error surface | 6.1:1 | 4.5:1 | pass |
| warning / warning surface | 7.58:1 | 4.5:1 | pass |
| success / success surface | 6.54:1 | 4.5:1 | pass |
| supporting / surface2 | 5.48:1 | 4.5:1 | pass |

Computed with the WCAG relative-luminance formula for opaque sRGB pairs. This is a palette check, not a claim of complete accessibility. Image overlays, all component states and merchant overrides need rendered checks.

## Editor, reusable system and capability boundary

Required content fields: **merchant age recommendation; interests taxonomy; contents/piece count; dimensions; materials; exact warning text and source; care**. Use canonical shared domain contracts; typed niche schemas may validate approved metadata but a generic metadata field is not proof those facts reach Liquid.

Reuse header/footer/navigation, canonical `productDetail`, `productGrid`, category/rich-text/media primitives, option/quantity/cart islands and existing section registration. Proposed bounded extensions: **categoryGrid layout=guided-bento; productGrid card=toy-facts; productDetail layout=contents; facts block**. Keep one implementation per reusable pattern, selected by schema-validated settings. Domain-level classes: **C typed toy facts and bounded facets; D merchant policy for warning sourcing. No platform safety certification.**. Full feature owner/data/security matrix: [07](../07_COMPONENT_AND_DATA_CAPABILITY_MAP.md).

Editor controls: content/media/focal point, named collection bindings, permitted card facts, supported layout choices, type scale limits and semantic palette values. Reordering/removing sections remains merchant-owned; required purchase/safety context must remain reachable. Show missing-content guidance without inserting fabricated data. Preview mobile and desktop with the same versioned document. Switching offers style-only, additive composition or reviewed full-design application; full-design removal/content-risk diff must be shown before application to an existing store. Draft save and public publish remain separate actions.

## Research rationale and original departure

Informed by [Tinker](../shopify-theme-dossiers/tinker.md) / [Crave](../shopify-theme-dossiers/crave.md) / [Colorblock](../shopify-theme-dossiers/colorblock.md). These references establish observed patterns, not proof that this proposal improves conversion. **Intentional departure:** Use play categories and practical contents facts rather than treating toys as a saturated apparel catalog.

Review original [desktop home](../visuals/wireframes/bloom-home-desktop.svg), [mobile home](../visuals/wireframes/bloom-home-mobile.svg), [collection](../visuals/wireframes/bloom-collection-desktop.svg), and [product](../visuals/wireframes/bloom-product-desktop.svg). [Gallery](../visuals/design-review.html) includes all six page/device views plus neutral comparisons. Schematics establish hierarchy and zones; they are not interactive production pages or final art direction.
