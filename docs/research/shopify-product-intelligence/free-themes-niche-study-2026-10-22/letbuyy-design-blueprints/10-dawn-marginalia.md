# 10 · Marginalia — Books, stationery and creative supplies

**PROPOSED.** Working name, not a trademark-cleared product name. No implementation or publication is implied. Current ID: `dawn`. Stable ID retained; proposal is a new, explicitly selected design version, never a silent rewrite of existing installations.

## Merchant, customer and design thesis

**Bounded segment:** Print books plus a small stationery range. Initial retrieval centered on author/genre/format; no marketplace, digital DRM or course platform. The buyer's mission is: **Retrieve a known title or explore a subject, check edition/format, and inspect a permitted excerpt.** Purchase uncertainty: Correct title/edition, language and physical format; paper and dimensions for stationery. The merchant must provide a coherent category model and the niche facts below. A distinctive demo without those facts would overpromise the actual merchant experience.

**Primary journey:** Retrieve a known title or explore a subject, check edition/format, and inspect a permitted excerpt. Home discovery → relevant collection → factual product evaluation → complete supported selection → canonical cart → hosted checkout. Anonymous discovery remains possible. Catalog data, availability, price and shipping remain server-authoritative.

## Sitemap and navigation

Header: **Prominent search / Books / Authors / Subjects / Stationery / Journal**. Sitemap: Home → named category/collection → product; Search/results; Cart; merchant informational pages; customer account as existing utility; canonical hosted checkout. Supporting pages: **author pages; excerpt rights policy; stationery guide; store information**. Desktop category links are explicit, with labelled search/cart controls. Mobile menu is a reversible disclosure/drawer with Escape, focus return and nested category back navigation. Never make hover the only route to a category.

## Homepage composition

1. Search-led opening and subject index.
2. Editorial pick as cover plus text excerpt.
3. Horizontal subject shelves with visible all links.
4. Author spotlight with books.
5. Stationery by use.
6. Shop/journal information.

Each region has a distinct job. Removing an unsupported education block must leave useful category/product navigation, not a decorative blank panel. Do not seed shipping guarantees, discount urgency, fabricated ratings or safety/health claims.

## Collection, product cards and search

Left subject/format index on desktop; list rows of narrow covers and bibliographic text; mobile cover/text rows with filter sheet.

**Card contract:** 2:3 uncropped cover; title; author; format/language; INR price. Stationery uses a separate 1:1 image and paper/size facts.

**Search/filter requirement:** Subject, author, format, language, price; stationery facets appear only in its collection. Canonical query pagination, stable product links and a recoverable query state apply. Server facet support is a dependency; if unavailable, use explicit category navigation and honest basic search rather than inert facet controls. Display result count only when supplied. Empty results retain the query and applied filters, offer clear-one/clear-all, and link to a broader category.

## Product detail and cart

Narrow cover column and bibliographic purchase summary; synopsis and permitted excerpt in reading column; edition/format selector explicit; full bibliographic table below.

Use a shared server-cart adapter and its existing error model. Preserve selected variant/configuration in the line summary; do not merge semantically different configurations. Cart add has pending, confirmed and failed states. Keep the product context visible after error. Empty cart links to this design's meaningful discovery entry. Stock or price change is resolved by the server and explained before a checkout action continues. Configurable extras, notes or uploads are absent until their contracts work across cart, order and fulfillment.

## Mobile composition and states

Visible search and subject shortcut; cover/text rows rather than a giant hero; long titles wrap without losing author/format.

| State | Required behavior |
|---|---|
| Empty merchant catalog | Show honest merchant introduction/categories if present; explain no products; no demo items mixed with real inventory. |
| Missing image or facts | Stable aspect-ratio placeholder with meaningful text; absent critical fact is labelled, not synthesized. |
| Unavailable selection | Preserve named option, show availability text, disable submission for invalid SKU and offer valid alternatives. |
| Loading | Retain previous layout; labelled progress; reserve media size; pending mutation blocks duplicate submission. |
| Network/validation error | Error adjacent to action/field and status announcement; retry retains non-sensitive choices. |
| Keyboard/text zoom | Logical reading order, visible focus, no focus behind sticky bars, no truncated essential title or option. |

Niche acceptance: **Two editions with the same title remain distinguishable by author, language and format. Missing ISBN is omitted; long titles remain readable at 200% text zoom.** Also run the shared acceptance pack in [09](../09_ACCEPTANCE_AND_LIMITATIONS.md).

## Visual language, typography and interaction

Density: Text-rich but legible; 56px / 24px sections; 2px covers, 4px controls; 1240px content; 65-character reading column. Use the existing spacing/token mechanism; proposed values are an experience layer, not a second platform token authority. Images: 2:3 cover contain; no artwork crop; 1:1 stationery objects; excerpt as text rather than inaccessible scanned image. New web icons follow CODE-R7 using Lucide React in React islands. Liquid presentation should reuse the governed icon pipeline or labelled text until an approved compatible asset export is available; do not introduce another icon library or an unreviewed production icon set. Original schematic shapes in this research are placeholders, not production illustrations.

Heading/body: **Libre Baskerville / Source Sans Pro**, already declared in the current experience font registry. Use only supplied weights (see registry), `display=swap`, and the established fallback stack. Proposed desktop scales: display 48–64/1.08; section 28–36/1.2; product title 28–36/1.2; body 16/1.55; support 14/1.45. Mobile: display 32–40, product title 26–30, body 16. Utility-heavy Circuit uses 14–16 for card facts, never tiny legal-size text. Long titles wrap naturally; two-line card visual clamping must preserve the full accessible name. INR values use locale formatting and tabular digits where supported.

Do not assume these Latin fonts cover Indian scripts. Preserve Unicode/graphemes, allow translation expansion, set language appropriately, use a tested system/script fallback, and verify Hindi plus the merchant's actual script before launch. The current Source Sans Pro registry name needs network/family verification against current Source Sans distribution; this research does not silently rename it. [Font and licensing boundary](../02_THEME_FAMILIES_AND_FOUNDATIONS.md).

Motion: Shelf scrolling remains optional; next/previous buttons and all-items links; no automatic page turning. Shared keyboard, reflow and reduced-motion rules remain consistent across the portfolio.

## Semantic color specification

| Role | Exact proposed value / pairing |
|---|---|
| canvas | `#FAF6EA` |
| surface | `#FFFFFF` |
| surface2 | `#EDE5D1` |
| text | `#30291E` |
| muted | `#6B5C45` |
| border | `#867354` |
| action | `#744A26` |
| label | `#FFFFFF` |
| link | `#744A26` |
| focus | `#005FCC` |
| error | `#B42318` |
| errorSurface | `#FFF4F2` |
| warning | `#7A3E00` |
| warningSurface | `#FFF4CE` |
| success | `#166534` |
| successSurface | `#EDF8EF` |
| Secondary action | transparent on surface; `#744A26` text and border |
| Selected | `#744A26` fill / `#FFFFFF` label plus check and selected text |
| Promotional | `#EDE5D1` / `#30291E`; no manufactured urgency |
| Disabled | surface2 with muted text; labelled unavailable and programmatic disabled state |

Focus: two-pixel visible ring with a contrasting offset/gutter on filled controls; test all adjacent backgrounds. A single ring color is not sufficient on arbitrary merchant images. Error, warning and success always include words/iconography, not color alone. These are proposed defaults, not approved platform-token changes.

| Pair | Ratio | Criterion used | Result |
|---|---:|---:|---|
| main text / canvas | 13.3:1 | 4.5:1 | pass |
| supporting / canvas | 5.99:1 | 4.5:1 | pass |
| label / action | 7.64:1 | 4.5:1 | pass |
| link / surface | 7.64:1 | 4.5:1 | pass |
| control border / surface | 4.57:1 | 3:1 | pass |
| focus / surface | 5.98:1 | 3:1 | pass |
| error / error surface | 6.1:1 | 4.5:1 | pass |
| warning / warning surface | 7.58:1 | 4.5:1 | pass |
| success / success surface | 6.54:1 | 4.5:1 | pass |
| supporting / surface2 | 5.16:1 | 4.5:1 | pass |

Computed with the WCAG relative-luminance formula for opaque sRGB pairs. This is a palette check, not a claim of complete accessibility. Image overlays, all component states and merchant overrides need rendered checks.

## Editor, reusable system and capability boundary

Required content fields: **author; genre/subject; format; language; publisher; edition/ISBN where supplied; pages; excerpt permission; stationery paper weight/size**. Use canonical shared domain contracts; typed niche schemas may validate approved metadata but a generic metadata field is not proof those facts reach Liquid.

Reuse header/footer/navigation, canonical `productDetail`, `productGrid`, category/rich-text/media primitives, option/quantity/cart islands and existing section registration. Proposed bounded extensions: **productGrid layout=bibliographic-list card=book; productDetail layout=reading; category index; sanitized excerpt block**. Keep one implementation per reusable pattern, selected by schema-validated settings. Domain-level classes: **C typed bibliographic fields/search facets; D excerpt permission and content rights; no unauthorized digital reader**. Full feature owner/data/security matrix: [07](../07_COMPONENT_AND_DATA_CAPABILITY_MAP.md).

Editor controls: content/media/focal point, named collection bindings, permitted card facts, supported layout choices, type scale limits and semantic palette values. Reordering/removing sections remains merchant-owned; required purchase/safety context must remain reachable. Show missing-content guidance without inserting fabricated data. Preview mobile and desktop with the same versioned document. Switching offers style-only, additive composition or reviewed full-design application; full-design removal/content-risk diff must be shown before application to an existing store. Draft save and public publish remain separate actions.

## Research rationale and original departure

Informed by [Publisher](../shopify-theme-dossiers/publisher.md) / [Studio](../shopify-theme-dossiers/studio.md) / [Spotlight](../shopify-theme-dossiers/spotlight.md). These references establish observed patterns, not proof that this proposal improves conversion. **Intentional departure:** Use bibliography and retrieval structure rather than a fashion grid with book-cover photography.

Review original [desktop home](../visuals/wireframes/dawn-home-desktop.svg), [mobile home](../visuals/wireframes/dawn-home-mobile.svg), [collection](../visuals/wireframes/dawn-collection-desktop.svg), and [product](../visuals/wireframes/dawn-product-desktop.svg). [Gallery](../visuals/design-review.html) includes all six page/device views plus neutral comparisons. Schematics establish hierarchy and zones; they are not interactive production pages or final art direction.
