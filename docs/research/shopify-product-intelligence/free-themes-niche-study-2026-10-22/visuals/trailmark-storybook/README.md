# Trailmark / Ride — responsive equipment storybook

Design target v1, prepared 22–23 October 2026. **Mockups only.** The canonical `ride` identity is retained. No application, service, package, migration, existing release or merchant state was changed by this work. Implementation waits for the coordinator’s Milestone 1 completion dispatch.

[Open the 15-scene gallery](index.html), [responsive source index](prototype-index.html), [download 45 PNGs](Trailmark-45-mockups.zip), [research and neutral comparisons](comparisons/index.html), [validation](validation.json).

The buyer mission is to find recreational equipment for an activity and confirm category-specific measurements, use conditions and any supplied compatibility. Initial scope excludes safety-critical gear, activity bookings and implied professional fitting. Trailmark is a proposed working name, not a trademark-clearance claim.

The design uses a dark activity masthead, three activity pathways, factual equipment cards and light specification areas. Mobile cards become compact rows; the PDP becomes gallery → exact equipment option → key measurements → purchase → full facts. Clothing and equipment have different attribute models. Unknown replacement-grip or sleeve compatibility stays unconfirmed.

## Scene continuity

| Scene | Task | Canonical destination model |
|---|---|---|
| 01 home top | Activity entry, navigation and CTA | One homepage, opening |
| 02 home bottom | Factual merchandising, selection guide, support and footer | Same homepage, continuation |
| 03 collection | Badminton search, categories, facets, sort and page state | Existing collection/query path |
| 04 PDP selection | Whole equipment, context, INR price, grip option, stock and add | One Rally 68 product, selection |
| 05 PDP facts | Dimensions, material, conditions and unknown compatibility | Same product, specification section |
| 06 PDP continuation | Independent accessories, care, policy and no-review state | Same product, continuation |
| 07 cart | Exact variants, quantities, subtotal and update failure recovery | Canonical server cart |
| 08 checkout address | Contact, address, mock shipping quote and summary | Shared hosted LetBuyy checkout |
| 09 review/pay | Complete summary, eligible-method fixture and payment retry | Same shared checkout |
| 10 sign-in | LetBuyy email/password entry, bot-check boundary and named return | Canonical buyer identity |
| 11 registration | Email/password creation and explicit signed-in Continue state | Canonical buyer registration/verification |
| 12 profile | Supported name edit, account navigation and scoped preference | Buyer account at this shop |
| 13 orders | Owned shop orders and pagination shape | Buyer order history |
| 14 order detail | Immutable equipment variant, amounts and truthful status | Owned order detail |
| 15 addresses | Default/other records, edit entry, add form and PIN error | Buyer address book |

Standalone headers/context help review each image; home and PDP fragments do not propose duplicate production routes. Supplementary product-facts pages give related shuttles and sleeve their own distinct references, rather than silently opening the racket. Additional `source/attribute-model.html` shows equipment/clothing switching, empty-result recovery, loading and missing-fact treatment. Those extra screens do not count toward 45.

## Fictional data and arithmetic

The catalog has three products: Rally 68 racket ₹2,490, Court Nylon 3 shuttles ₹490 per tube of 3, and Court single-racket sleeve ₹690. The racket is 68 cm long and 88 g unstrung, with Forest / grip circumference 84 mm selected; 88 mm is unavailable. Measurements are invented demonstration content, not derived from generated photography or real product testing.

Cart/order TM-1042: 1 × ₹2,490 + 2 × ₹490 = **₹3,470**. The two shuttle tubes contain 6 shuttles. Mock standard shipping ₹90 + discount ₹0 produces **₹3,560**. Applicable tax is included; no invented statutory tax calculation or delivery promise is asserted. The cart labels shipping as pending, then checkout displays the complete fictional quote. The sleeve is an independently linked product and is never included automatically.

`demo.buyer@example.test`, `trailmark.example.test`, Demo Buyer and the Sample/Example addresses are fictional fixtures. No credentials, live customer records or signed links are stored. The prototype does not call commerce, identity or payment endpoints.

## Visual and responsive specification

Inter 400/600/800 is stored locally with its OFL license. Functional symbols come from the existing Lucide React 0.562.0 package and are exported to static SVG markup for this presentation; that is not a new production icon pipeline. Five original images were made through built-in `image_gen`, copied to `assets/` and visually inspected. [Exact prompts and provenance](generation-prompts.json).

The proposed merchant experience palette follows the blueprint: canvas `#F5F6F1`, white surface, `#E5E9DD` secondary surface, `#222B22` text/dark masthead, `#53604C` supporting text, `#708064` essential boundary, `#314E3B` primary action, `#005FCC` focus, and labelled error/warning/success treatments. This is a presentation specification, not a competing platform token authority. Implementation must map it through the governed storefront settings and existing tokens.

Desktop content width is capped at 1320px, with medium density and 4px control corners. Display type uses 44–68px, 34–48px major headings, 16px body and 12–14px supporting labels. Whole equipment uses contained 4:3 images; lifestyle uses deliberate cover crops. No essential factual value is inferred from a crop.

Desktop 1440×1000, tablet 834×1112 and mobile 390×844 render independently at DPR 1. Full-page PNGs can exceed viewport height. Tablet stacks the PDP and checkout while retaining a two-column result area; mobile stacks forms, changes cards to rows, exposes a menu and keeps all purchase facts in flow. No sticky region covers content. Reduced motion disables transitions/smooth scrolling. Source has focus indicators, semantic labels and a reversible menu; this is not a completed assistive-technology audit.

## Capability and implementation boundary

Every presented interaction remains a design target until its canonical implementation passes. The [capability handoff](capabilities.json) separates A supported primitives, B wiring, C bounded extensions, D product/provider decisions and E deferred capabilities. Source research support does not mean a deployed end-to-end certification.

The main shared C dependency is an equipment namespace: category-specific activity, dimensions with units, mass, grip circumference, contents, supplied conditions/care and explicit unknown compatibility. It needs validation, merchant edit/readback, deliberate public projection, Liquid facts rendering and genuine paginated filters. Generic metadata alone does not complete that path. Do not apply clothing’s S/M/L to racket measurements. No comparison engine or universal compatibility matcher is proposed.

Product, quantity, stock, cart, checkout, orders and account operations must reuse their existing owners. Shared checkout takes permitted branding data only, never theme CSS or a second payment authority. Canonical identity uses the current email/password buyer entry with configured Turnstile, then explicit Continue to Trailmark. This was checked against `BuyerAuthorize`, the buyer register route and `buyer-email-code.ts` on 23 October: registration has an 8-character minimum; successful session creation leads to an explicit Continue to Trailmark / use another account state. OAuth authorization codes are not email-verification codes. A separate six-digit email verification API exists, but it is not an automatic mandatory next BuyerAuthorize page. The older Shopify passwordless convention is not imposed on LetBuyy.

## Research attribution and evidence limits

The Ride and Tinker saved dossiers/captures dated 22 October support the comparisons. Ride supplies activity-led discovery conventions; Tinker supplies concise object measurements. The comparison files state URLs, actual saved 1440×1000 DPR1 viewport, observed state, retained convention, original difference and required contract. The Tinker saved product has an unloaded gallery; no intended blank-media design is inferred. Read-only web retrieval refreshed Ride’s [official listing](https://themes.shopify.com/themes/ride/presets/ride) and [fins collection](https://theme-ride-demo.myshopify.com/collections/fins); Tinker’s selected page was unavailable through that tool, so its claims remain saved-evidence claims.

Three original neutral comparisons remove branding, accent colors and photography to compare equipment task hierarchy with the existing apparel direction. They are labelled structural abstractions, not altered remote screenshots. No Shopify photography, logo or copy is used in Trailmark storefront source. No Shopify account, installation, purchase or store setting was mutated.

## Reproduce and verify

`python3 source/build.py` regenerates the scene HTML from one presentation builder, `styles.css`, `prototype.js`, icons and fixtures. `python3 source/comparisons.py` regenerates attributable comparison pages. The existing root Playwright dependency supplies `source/capture.mjs`; it launches a separate headless Chrome process with a temporary profile and `chromiumSandbox:true`, uses local file URLs, measures the actual content viewport and exports true PNGs. It never attaches to an existing browser or bypasses TLS. macOS needs the supported bounded sandbox escalation for that launch.

The coordinator schedules at most two full export processes at a time. After a granted slot, run `node source/capture.mjs`; package with the bundled Python/Pillow runtime using `source/package.py`; run `source/validate.py`. The source scripts live entirely in this theme’s assigned folder. No dependency install or shared generator change is needed.

Final export, overflow, font/image readiness, stress, PNG/ZIP integrity, local links and arithmetic evidence is recorded in `responsive-audit.json`, `exports.json`, `comparisons/stress-audit.json` and `validation.json`. Manual visual review is separate. Screen-reader behavior, full WCAG conformance, real server/provider work, merchant lifecycle persistence, cross-buyer denial and actual performance remain implementation acceptance. The shared dirty checkout’s production build/governance gates are not run for this design-only pack, following the coordinator’s ownership instructions.

Owner mandate: original attachment `3bbd3b8f-2a90-40e2-8d7f-ce02bd968d9e/Pasted text.txt`; coordinator Themes `01a164a4-a342-76d3-ab33-65e021ed57db`; this chat `01a164ba-f650-7f00-beea-90431a510973`. Only `visuals/trailmark-storybook/` was authored here. The existing Threadline and other programme work is preserved.

## Final mockup evidence

The pack contains **45 independently rendered PNGs and 15 additional three-device boards**. Exact measured viewports are 1440×1000, 834×1112 and 390×844 at DPR 1. All 45 have loaded Inter, decoded imagery and no measured horizontal page overflow. The 22 extra stress records cover all 15 scenes at 320px plus 200% text on product/checkout/addresses, Hindi expansion, a long title and missing-image recovery; final measured overflow is zero. Eight bounded local presentation checks passed, including mobile menu Escape/focus return, summary-before-payment at 390/834, read-only profile email/order rows and reduced motion.

All 15 boards and one or more full-size representatives per scene were visually inspected. The initial zoom, missing-media and payment-order findings were corrected and the exports/boards/ZIP refreshed. [Self visual review](visual-review.json) records scope and limits; coordinator independent review remains separate.
