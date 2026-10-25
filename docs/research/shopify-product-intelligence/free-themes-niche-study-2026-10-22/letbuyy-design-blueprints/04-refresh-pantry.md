# 04 · Pantry — Food and pantry

**PROPOSED.** Working name, not a trademark-cleared product name. No implementation or publication is implied. Current ID: `refresh`. Stable ID retained; proposal is a new, explicitly selected design version, never a silent rewrite of existing installations.

## Merchant, customer and design thesis

**Bounded segment:** Shelf-stable packaged food and ingredients; no restaurant ordering, cold-chain promise, rapid local delivery or subscription. The buyer's mission is: **Identify ingredients and allergens, choose pack quantity, buy known staples efficiently.** Purchase uncertainty: Contents, allergens, value per quantity, storage and preparation. The merchant must provide a coherent category model and the niche facts below. A distinctive demo without those facts would overpromise the actual merchant experience.

**Primary journey:** Identify ingredients and allergens, choose pack quantity, buy known staples efficiently. Home discovery → relevant collection → factual product evaluation → complete supported selection → canonical cart → hosted checkout. Anonymous discovery remains possible. Catalog data, availability, price and shipping remain server-authoritative.

## Sitemap and navigation

Header: **Search / Pantry shelves / Dietary information / Recipes / About**. Sitemap: Home → named category/collection → product; Search/results; Cart; merchant informational pages; customer account as existing utility; canonical hosted checkout. Supporting pages: **ingredient information; storage guide; shipping policy; recipe pages**. Desktop category links are explicit, with labelled search/cart controls. Mobile menu is a reversible disclosure/drawer with Escape, focus return and nested category back navigation. Never make hover the only route to a category.

## Homepage composition

1. Compact seasonal feature and shelf shortcuts.
2. Shop pantry staples in labelled rows.
3. Ingredient-first featured product.
4. Recipe-to-product links.
5. Pack-size value explanation without fake discounts.
6. Merchant origin and storage guidance.

Each region has a distinct job. Removing an unsupported education block must leave useful category/product navigation, not a decorative blank panel. Do not seed shipping guarantees, discount urgency, fabricated ratings or safety/health claims.

## Collection, product cards and search

Grouped shelf/list rows with package image, net quantity, price and explicit option entry; desktop can show 2 rows abreast, mobile one list.

**Card contract:** Square pack image; item; net weight/volume; sale price; unit price only with valid units; dietary tags only supplied facts; one-tap add only for one available SKU.

**Search/filter requirement:** Product shelf, supplied dietary tags, price; dietary tags are not medical advice or a guarantee against cross-contact. Canonical query pagination, stable product links and a recoverable query state apply. Server facet support is a dependency; if unavailable, use explicit category navigation and honest basic search rather than inert facet controls. Display result count only when supplied. Empty results retain the query and applied filters, offer clear-one/clear-all, and link to a broader category.

## Product detail and cart

Three zones: package/food image; ingredient/allergen information; pack-size and quantity purchase panel. Nutrition/storage/recipe information follows.

Use a shared server-cart adapter and its existing error model. Preserve selected variant/configuration in the line summary; do not merge semantically different configurations. Cart add has pending, confirmed and failed states. Keep the product context visible after error. Empty cart links to this design's meaningful discovery entry. Stock or price change is resolved by the server and explained before a checkout action continues. Configurable extras, notes or uploads are absent until their contracts work across cart, order and fulfillment.

## Mobile composition and states

Allergen summary visible before CTA; compact pack-size choices; no bottom overlay hiding warnings; quantity changes announce server result.

| State | Required behavior |
|---|---|
| Empty merchant catalog | Show honest merchant introduction/categories if present; explain no products; no demo items mixed with real inventory. |
| Missing image or facts | Stable aspect-ratio placeholder with meaningful text; absent critical fact is labelled, not synthesized. |
| Unavailable selection | Preserve named option, show availability text, disable submission for invalid SKU and offer valid alternatives. |
| Loading | Retain previous layout; labelled progress; reserve media size; pending mutation blocks duplicate submission. |
| Network/validation error | Error adjacent to action/field and status announcement; retry retains non-sensitive choices. |
| Keyboard/text zoom | Logical reading order, visible focus, no focus behind sticky bars, no truncated essential title or option. |

Niche acceptance: **Choose 2 × 250g and see pack count, total net quantity and server price. Missing allergen data says not supplied; no allergen-free badge is invented.** Also run the shared acceptance pack in [09](../09_ACCEPTANCE_AND_LIMITATIONS.md).

## Visual language, typography and interaction

Density: Readable shelf density; 56px / 24px sections; 6px radius; 1240px content. Use the existing spacing/token mechanism; proposed values are an experience layer, not a second platform token authority. Images: 1:1 whole package; 4:3 prepared-food context labelled serving suggestion where appropriate. New web icons follow CODE-R7 using Lucide React in React islands. Liquid presentation should reuse the governed icon pipeline or labelled text until an approved compatible asset export is available; do not introduce another icon library or an unreviewed production icon set. Original schematic shapes in this research are placeholders, not production illustrations.

Heading/body: **Inter / Inter**, already declared in the current experience font registry. Use only supplied weights (see registry), `display=swap`, and the established fallback stack. Proposed desktop scales: display 48–64/1.08; section 28–36/1.2; product title 28–36/1.2; body 16/1.55; support 14/1.45. Mobile: display 32–40, product title 26–30, body 16. Utility-heavy Circuit uses 14–16 for card facts, never tiny legal-size text. Long titles wrap naturally; two-line card visual clamping must preserve the full accessible name. INR values use locale formatting and tabular digits where supported.

Do not assume these Latin fonts cover Indian scripts. Preserve Unicode/graphemes, allow translation expansion, set language appropriately, use a tested system/script fallback, and verify Hindi plus the merchant's actual script before launch. The current Source Sans Pro registry name needs network/family verification against current Source Sans distribution; this research does not silently rename it. [Font and licensing boundary](../02_THEME_FAMILIES_AND_FOUNDATIONS.md).

Motion: Quantity confirmation and collapsible nutrition panel only; never animate a scarcity countdown. Shared keyboard, reflow and reduced-motion rules remain consistent across the portfolio.

## Semantic color specification

| Role | Exact proposed value / pairing |
|---|---|
| canvas | `#FCF8EF` |
| surface | `#FFFFFF` |
| surface2 | `#EEE8D8` |
| text | `#262A1D` |
| muted | `#5A624A` |
| border | `#707858` |
| action | `#36533D` |
| label | `#FFFFFF` |
| link | `#36533D` |
| focus | `#005FCC` |
| error | `#B42318` |
| errorSurface | `#FFF4F2` |
| warning | `#7A3E00` |
| warningSurface | `#FFF4CE` |
| success | `#166534` |
| successSurface | `#EDF8EF` |
| Secondary action | transparent on surface; `#36533D` text and border |
| Selected | `#36533D` fill / `#FFFFFF` label plus check and selected text |
| Promotional | `#EEE8D8` / `#262A1D`; no manufactured urgency |
| Disabled | surface2 with muted text; labelled unavailable and programmatic disabled state |

Focus: two-pixel visible ring with a contrasting offset/gutter on filled controls; test all adjacent backgrounds. A single ring color is not sufficient on arbitrary merchant images. Error, warning and success always include words/iconography, not color alone. These are proposed defaults, not approved platform-token changes.

| Pair | Ratio | Criterion used | Result |
|---|---:|---:|---|
| main text / canvas | 13.84:1 | 4.5:1 | pass |
| supporting / canvas | 6.04:1 | 4.5:1 | pass |
| label / action | 8.53:1 | 4.5:1 | pass |
| link / surface | 8.53:1 | 4.5:1 | pass |
| control border / surface | 4.65:1 | 3:1 | pass |
| focus / surface | 5.98:1 | 3:1 | pass |
| error / error surface | 6.1:1 | 4.5:1 | pass |
| warning / warning surface | 7.58:1 | 4.5:1 | pass |
| success / success surface | 6.54:1 | 4.5:1 | pass |
| supporting / surface2 | 5.23:1 | 4.5:1 | pass |

Computed with the WCAG relative-luminance formula for opaque sRGB pairs. This is a palette check, not a claim of complete accessibility. Image overlays, all component states and merchant overrides need rendered checks.

## Editor, reusable system and capability boundary

Required content fields: **ingredients; allergen statement and source; net quantity/unit; pack count; storage; nutrition text if supplied; shelf-life policy rather than invented current expiry date**. Use canonical shared domain contracts; typed niche schemas may validate approved metadata but a generic metadata field is not proof those facts reach Liquid.

Reuse header/footer/navigation, canonical `productDetail`, `productGrid`, category/rich-text/media primitives, option/quantity/cart islands and existing section registration. Proposed bounded extensions: **productGrid layout=shelf-list card=pantry; productDetail layout=ingredients; unitPrice display primitive; richText recipe links**. Keep one implementation per reusable pattern, selected by schema-validated settings. Domain-level classes: **C structured net-quantity and ingredient hydration; B base quantity controls; C server-authoritative unit-price derivation; D perishable operations excluded**. Full feature owner/data/security matrix: [07](../07_COMPONENT_AND_DATA_CAPABILITY_MAP.md).

Editor controls: content/media/focal point, named collection bindings, permitted card facts, supported layout choices, type scale limits and semantic palette values. Reordering/removing sections remains merchant-owned; required purchase/safety context must remain reachable. Show missing-content guidance without inserting fabricated data. Preview mobile and desktop with the same versioned document. Switching offers style-only, additive composition or reviewed full-design application; full-design removal/content-risk diff must be shown before application to an existing store. Draft save and public publish remain separate actions.

## Research rationale and original departure

Informed by [Savor](../shopify-theme-dossiers/savor.md) / [Crave](../shopify-theme-dossiers/crave.md) / [Taste](../shopify-theme-dossiers/taste.md). These references establish observed patterns, not proof that this proposal improves conversion. **Intentional departure:** Put ingredients and pack information ahead of decorative storytelling; keep stocked pantry commerce bounded.

Review original [desktop home](../visuals/wireframes/refresh-home-desktop.svg), [mobile home](../visuals/wireframes/refresh-home-mobile.svg), [collection](../visuals/wireframes/refresh-collection-desktop.svg), and [product](../visuals/wireframes/refresh-product-desktop.svg). [Gallery](../visuals/design-review.html) includes all six page/device views plus neutral comparisons. Schematics establish hierarchy and zones; they are not interactive production pages or final art direction.
