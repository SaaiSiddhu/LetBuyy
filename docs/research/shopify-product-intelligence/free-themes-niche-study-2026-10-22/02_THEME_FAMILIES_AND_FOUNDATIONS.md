# Families, foundations and what may be transferred

## Evidenced shared family

**DOCUMENTED:** Fabric, Dwell, Savor, Atelier, Pitch, Tinker, Ritual, Heritage, Horizon and Vessel identify themselves as part of the Horizon collection in current official listing copy. They currently disclose version 4.3.0. Their demos show a repeated product-grid density control, named option controls, compact purchase patterns and mobile drawer conventions, yet can produce very different opening compositions. Shared family is not an assertion that all files or every behavior are identical.

The other 13 entries disclose version 16.1.0. Their visible reusable patterns include regular collection grids, conventional filter/sort controls, media-first PDPs and cart pages/drawers. “Earlier section-theme cohort” in this collection is a descriptive grouping, not a verified code-inheritance tree. No source repository diff was performed, and coincident version numbers do not prove a common engine.

Shopify's theme architecture separates layouts, templates, sections, blocks and assets/configuration. That explains why the same foundation can host distinct compositions without separate applications. This is a technical model from [official theme architecture](https://shopify.dev/docs/storefronts/themes/architecture), not evidence of private backend architecture.

## Observed design clusters, not ancestry claims

| Design approach | Examples | Distinction that survives some neutralization |
|---|---|---|
| Campaign/editorial apparel | Fabric, Colorblock, Ritual | Full media versus color panels versus typographic capsule and cutout categories. |
| Curated object/material story | Atelier, Dwell, Vessel, Craft, Heritage | Product scale, room context, provenance and gallery/detail orientation. |
| Food/care education | Savor, Crave, Taste, Sense, Pitch, Refresh | Pack choice, recipe or ingredient framing, benefit panels, typography/section rhythm. |
| Tiny curated/direct catalog | Origin, Spotlight, Horizon | Homepage product options versus immediate catalog versus minimal hero/grid. |
| Retrieval/creator/operational | Trade, Studio, Publisher, Tinker | Bulk quantity rows, artist-based collections, publication context, task-based objects. |

A photograph can make two regular grids feel unrelated; that effect disappears under neutral treatment. Conversely, Trade's quantity table and Origin's two-product direct selection remain different even without their photography. A unique homepage does not automatically imply a unique collection or product model. LetBuyy must differentiate all three where the purchasing task warrants it.

## What remains shared in LetBuyy

One Liquid compiler/renderer and sandbox, one versioned document model, common navigation/option/quantity/cart islands, one server-authoritative price/stock path, tenant/permission checks, shared editor controls and hosted checkout. Niche variation belongs in ordered composition, schema-supported layout/card/fact variants, bindings and an experience palette. Do not add ten React renderer forks or a new token authority. Existing React compatibility surfaces are not a mandate to extend them for new niche sections.

The platform/editor purple identity is a different axis from a merchant's storefront palette. Keep platform chrome stable while storefront defaults use the niche palettes. Merchant colors are still subject to semantic-state/contrast checks; business statuses never depend on color alone.

## Typography availability and licensing

The current `experience-fonts.ts` registry includes Inter, Playfair Display, Cormorant Garamond, Libre Baskerville, Lato and Source Sans Pro. The storefront layout emits its Google Fonts stylesheet with `display=swap`. This is source integration, not a successful network/font-file readback from a deployed merchant store.

The proposed families have open font distributions. Opened license records identify SIL OFL 1.1 for [Inter](https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt), [Playfair Display](https://github.com/google/fonts/blob/main/ofl/playfairdisplay/OFL.txt), [Cormorant Garamond](https://github.com/google/fonts/blob/main/ofl/cormorantgaramond/OFL.txt), [Libre Baskerville](https://github.com/google/fonts/blob/main/ofl/librebaskerville/OFL.txt), [Lato](https://raw.githubusercontent.com/google/fonts/main/ofl/lato/OFL.txt) and the current [Source Sans 3 distribution](https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/OFL.txt). The legacy Source Sans Pro registry name must be checked against the exact Google-served family or mapped through an approved compatibility update. Do not treat Source Sans 3's license file as a binary identity proof for an old cached Pro file.

Before packaging/self-hosting, pin actual font binaries and their accompanying license/copyright files, verify supported weights and retain required notices. This research downloads no font assets. Use supplied system/serif fallbacks on blocked font requests, verify INR and wrapping, and test actual Indian-language glyph coverage rather than assuming Latin display faces cover them.
