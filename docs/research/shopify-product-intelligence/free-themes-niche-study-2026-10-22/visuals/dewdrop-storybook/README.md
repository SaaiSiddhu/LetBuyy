# Dewdrop / aura — responsive care-shopping storybook

Milestone 1 design reference for the owner-authorized ten-theme programme. Design version 1 retains the stable `aura` preset identity; it does not update installed merchant themes or immutable releases. Execution within this chat: one agent, no subagents. The owner separately authorized the nine persistent theme chats and programme reporting.

[Open the visual storybook](index.html) · [Download 45 PNGs](Dewdrop-45-mockups.zip) · [Responsive presentation source](prototype-index.html) · [Research comparison](comparisons/side-by-side.html) · [Neutral structural comparison](comparisons/neutral-structure.html)

The buying mission is **find care by routine/use, inspect the named shade, read ingredients and directions, then purchase the correct SKU**. Routine stages are navigation, never a diagnostic questionnaire or a prescribed bundle. Each product is independently purchasable. No medical/safety/efficacy claims, certifications, ratings, before/after proof, urgency, delivery promise or inferred skin profile is introduced.

## Scope and source

This folder is a local, visual-only HTML/CSS presentation system. The source uses native text, original photography, semantic forms and Lucide SVG exports from the existing `lucide-react` dependency. No production renderer, API, auth system, database, checkout, account, order or payment was created or changed. No Shopify store mutation, purchase, subscription, publication or deployment occurred.

The programme's coordinator owns its hub and exit decision: chat `01a164a4-a342-76d3-ab33-65e021ed57db`. This chat is `01a164ba-ec9f-7073-8f2a-66878e99b008`. The original human authorization was read in `/Users/saai_mithra/.codex/attachments/3bbd3b8f-2a90-40e2-8d7f-ce02bd968d9e/Pasted text.txt`; that instruction authorizes task-scoped reports between programme chats. Production implementation waits for the coordinator's all-nine Milestone 1 completion dispatch.

Current baseline observed: `letbuyy/theme-release-performance-resume` at `85aac99043d8dc10469e12cbb810609a3b6f1b0d`, with extensive pre-existing tracked/untracked work. This chat writes only this Dewdrop subtree. Existing Threadline and merchant work, browser tabs and resources are preserved. No commit, branch mutation, build cleanup or source-wide governance result is claimed.

## Connected scene model

Scenes 01 + 02 are the opening and continuation of one homepage. Scenes 04 + 05 + 06 are the selection, facts and continuation regions/states of one PDP. Repeated context makes standalone images understandable; implementation must not create duplicate production routes or repeated page headers. Scenes 08/09 use the existing shared checkout; 10/11 use canonical LetBuyy credentials and the explicit signed-in Continue handoff; store account scenes return to Dewdrop.

`scenes.json` is the 15-scene index. `source/build.py`, `styles.css` and `interactions.js` are the editable source; `source/build-gallery.py` builds the gallery. `source/capture.cjs` independently renders each scene at desktop **1440×1000**, tablet **834×1112**, mobile **390×844**, all DPR 1, with full-page PNGs. Full-page height may exceed the viewport. Boards scale the three already captured originals only for comparison; the 45 individual images remain unscaled.

## Design system

Canvas `#FAF8F4`, white surface, stone `#EDE9E1`, text `#293229`, supporting text `#596754`, essential border `#74816C`, action/link `#3F5E51`, focus `#005FCC`, error `#B42318`. Success/warning/error include words. These are proposed storefront settings consistent with the blueprint, not a second platform token authority.

Cormorant Garamond 500/600 carries headings; Lato 400/700 carries UI/body. Local font assets and source URLs are recorded in `assets/font-provenance.json`. These families/weights exist in the inspected experience-font registry. Fonts are open-source Google Fonts: [Cormorant repository](https://github.com/CatharsisFonts/Cormorant), [Lato in Google Fonts](https://github.com/google/fonts/tree/main/ofl/lato). System/script fallback is retained; Latin fonts are not assumed to cover Devanagari. Identity uses LetBuyy’s existing logo, Geist font, neutral admin/light surfaces and brand-ink `#2C2642` action treatment, with the explicit Dewdrop destination.

Desktop uses a split use-focused opening, numbered shelves, a product gallery beside a purchase rail, and side-by-side summary/form regions. Tablet shelves become wider stacked product rows; the PDP keeps two functional columns and turns shades into named rows; account navigation becomes horizontal; checkout and cart summaries stack. Mobile uses a reversible menu, stacked hero/gallery, routine shelves as product rows, labelled shade radios and single-column forms. No fixed purchase region obscures focus. Motion is manual/minimal with a reduced-motion rule.

## Fictional fixture consistency

All names, addresses, products, ingredients, media, prices, stock, tax/shipping, payment and order states are synthetic. The reserved destination is `dewdrop.example.test`; buyer `asha@example.test`. The mock order is not an actual payment or fulfillment.

| Product | Format / quantity | Price |
|---|---|---:|
| Cloud Rinse | Gel cleanser / 150 ml | ₹640 |
| Daily Veil | Face cream / 50 g | ₹880 |
| Soft Colour | Lip tint / 6 ml | ₹520 |
| Palm Wash | Hand wash / 250 ml; image and ingredients not supplied | ₹460 |

Rosewater / RW01 (`tint-rosewater`) and Pink Clay / PC02 (`tint-pink-clay`) intentionally share display colour `#A36A65`. Native radio names, text, checked indication and distinct variant values disambiguate them. Terracotta / TC03 is unavailable; selection remains visible and the purchase action disables. The Rosewater photograph is a shared bottle reference, not proof of Pink Clay's actual swatch colour. Future real catalog media must follow selected variant identity.

Bag: one Rosewater tint ₹520 + one Cloud Rinse ₹640 = **₹1,160**. Checkout shipping fixture ₹60; tax included in prices; total **₹1,220**. Order DD-1042 on 18 October 2026 uses the same two lines and ₹1,220. `fixtures.json` stores minor-unit arithmetic. Checkout eligibility, pricing and stock remain server-authoritative during implementation.

Four original built-in `image_gen` assets are saved in `assets/`: hero, tint, cleanser and cream. Prompts, tool mode and original output paths are in `generation-prompts.json`. No CLI/API image generation was used, and no Shopify photography/copy/logo was incorporated into Dewdrop assets. The cream hero is a closed jar; its catalog image is the same fictional package shown open for texture, not a distinct SKU. Independent generated shots are illustrative product references, not manufacturing specifications.

## Actual support versus proposed controls

A = existing canonical primitive; B = existing capability needs target wiring/verification; C = bounded extension; D = material policy/provider decision; E = deferred/out of scope. See `capabilities.json` for owners and gates.

| Surface | Class / handoff |
|---|---|
| Product/price/media/ordinary variants; quantity/cart | A primitive; B end-to-end target binding. Use canonical product and server-cart owners. |
| Routine stage, net quantity, ingredient/direction/warning facts, named shade codes | C typed schema, merchant entry/readback and safe public Liquid projection. Generic metadata is insufficient. |
| Stage/format/shade filters, sorting, counts and pagination | A basic query/navigation; C niche query contract. The mockup displays proposed controls; hide them until real query-backed behavior is complete. |
| Related products | A explicit curated links; independently priced/stocked, no configurable bundle. |
| Shipping/payment | A/B canonical checkout and actual eligibility. Mock choices are fixture states, not provider readiness. No new provider or payment authority. |
| Buyer identity/profile/orders/addresses | A/B canonical owner; verify safe tenant-bound return, buyer ownership, registration and explicit Continue, edit persistence and direct order links. |
| Claim/certification/diagnosis/recommendation engine, subscriptions, health quiz | D/E excluded. No such control or claim appears. |

Only one PDP is illustrated fully. All product links retain a fixture product query but open the single visual reference PDP; they are not implemented product retrieval. Menu disclosure, same-colour radio navigation, shade availability, quantity and stage hiding are local demonstrations. Search, format/shade facets, sort, remove, retry, profile save, credential submission, address save/default and payment actions are visual proposals requiring canonical wiring. Quantity demos do not recalculate authoritative bag totals; the exported initial fixture remains quantity 1. No control should be advertised as operational based on this source.

Checkout keeps the canonical Address → Review & pay flow; only data-branding semantics (wordmark, palette/type) are proposed. No injected merchant CSS/executable code or custom checkout authority. Credentials remain on the canonical identity surface with a clear destination, never a theme-owned credential route. Checkout/profile screens do not grant merchant/operator privileges.

## Research and evidence limits

Read blueprint `08-aura-dewdrop.md`, shared research 03/05/06/07/08/09/10, and Sense/Pitch/Refresh dossiers. Four attributed side-by-side pairs compare Sense home/PDP and Pitch collection/PDP using the existing research's dated screenshots at 1440×1000 DPR1. The corresponding public primary pages were reopened read-only for text refresh; no new remote screenshot, transaction, full filter journey, conversion, performance or accessibility result is claimed. The comparison HTML labels crops and links full images. Neutral diagrams suppress branding, colour and photography to compare care's routine/shade/facts tasks with food's pack/allergen and fashion's fit/size tasks.

Threadline reference artifacts and representative full-size PDP/checkout images were inspected. `read_thread` initially rejected an oversized request; a one-turn read succeeded. Threadline's local implementation evidence records completed publication/recovery and separate checkout TLS and broader acceptance gaps; those are not Dewdrop verification or reasons to touch its resources.

## Verification and reproduction

The actual export records belong in `exports.json` and `responsive-audit.json`; extended checks in `stress-audit.json`; artifact checks in `validation.json`. These validate this visual pack. They do not certify working commerce, screen-reader conformance, production performance, installed themes or hosted delivery.

Use existing repository dependencies, no install or build. Run the source builders, then request a bounded headless capture slot from the coordinator (at most two processes). The installed Playwright Chromium needs supported macOS process escalation; launch with `chromiumSandbox:true`, no user profile, no TLS bypass and no shared browser control. Run `node source/capture.cjs` from this folder or its absolute path. It uses local file URLs and blocks HTTP(S) in the capture context. Then run `python3 source/validate.py` and the coordinator's read-only `verify_mockups.py --theme dewdrop`.

Identity source correction: `IDENTITY_REFERENCE.md` and current BuyerAuthorize/register source were read. Scene 11 uses email/password (minimum 8 characters), a configuration-dependent bot-check placeholder, and a labelled post-creation Continue to Dewdrop state. No mandatory full-name field, consent checkbox, verification link or automatic email dispatch is asserted. Separate optional email verification APIs are not the next mandatory BuyerAuthorize screen.

Full implementation acceptance remains: canonical package/install/editor/save/preview/publish/recovery chain; genuine product/facet/cart/order/account persistence; stock/price/idempotency/security cases; actual translated catalog; browser-native zoom and assistive technology; controlled accessibility/performance evidence. No Milestone 2 completion is claimed here.

Identity palette correction, 23 October 2026: current `globals.css` aliases and admin surface token mapping supersede the historical purple instruction. Identity source uses neutral `#F6F7F9`, white, `#111827`, `#6B7280`, brand-ink action `#2C2642`, links `#523F97`, focus `#6C54C4`, input border `#8F88A9`, and the existing local Geist font. Only identity exports/boards were refreshed; storefront care palette stays independent.

The latest visual review is `visual-review.json`. First-pass rejected evidence is labelled in `comparisons/correction-record.json`; only current `images/` exports enter the downloadable ZIP. The final mobile review places the full order summary before payment commitment, and profile sign-in email is read-only. The six affected exports, two boards and current ZIP were refreshed; final-semantic-checks.json and validation.json pass.

Final artifact result, 23 October 2026: **45 unique individual PNGs + 15 additional boards**, actual requested viewports at DPR 1, local fonts/images loaded, no page-level horizontal overflow in required or tested stress states, 529 local HTML links resolved, and ZIP bytes match current image files. The coordinator-owned audit script was run read-only for Dewdrop and passed. Its Pillow decode option is unavailable in the system Python; the theme validator separately checked all PNG signatures, chunk CRCs and IDAT decompression. This is structural artifact evidence plus scoped manual visual QA, not complete accessibility or production certification.
