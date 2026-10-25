# Circuit — responsive electronics storybook

Milestone 1 design reference, prepared 22–23 October 2026. Stable preset identity: **forge**. This pack is an original proposed design, not a published theme or an alternate storefront runtime. Package versioning and integration begin only after the coordinator dispatches the programme’s mockup-gate completion.

Local result: **45 current individual PNGs + 15 current boards**, all required artifact checks passed. The final profile correction refreshed only three images; the other 42 hashes were preserved. Coordinator visual/portfolio acceptance remains pending.

## Review

- [Navigable image storybook](index.html)
- [45 individual PNGs](Circuit-45-mockups.zip)
- [Editable responsive source index](prototype-index.html) and [supplementary recovery states](source/recovery-states.html)
- [Research and neutral comparisons](comparisons/index.html)
- [Capability/dependency map](capabilities.json)
- [Fixtures](fixtures.json), [prompts and image provenance](generation-prompts.json)
- [Actual viewport audit](responsive-audit.json), [exports](exports.json), [stress probes](stress-audit.json), [validation](validation.json), [visual review](visual-review.json)

Required matrix: 15 scenes, independently rendered at 1440 × 1000, 834 × 1112 and 390 × 844 CSS pixels, DPR 1. Full-page PNG heights may exceed the viewport. Fifteen separate boards display the independently rendered images at a common 50% review scale; boards never count as individual exports. Final measured counts and checks are owned by `validation.json`, not this prose.

## Shopping mission and structure

Retrieve the correct model and verify its connections, requirements, contents and factual specifications. Circuit leads with search and Charge / Connect / Listen / Work categories, followed by a compact featured model. It uses a desktop facet rail, four-column specification cards, two-column tablet cards and compact mobile result rows. A model-led PDP puts named choices and an explicit compatibility state beside contained device imagery. A full specifications table and a static model reference follow. No interactive compare tray is advertised.

These structures differ from fashion’s portrait/outfit/fit journey and books’ title/author/edition rows and reading column. The [neutral structural comparison](comparisons/neutral-structures.html) removes color, brand and photography and describes that difference. The abstract book comparator comes from the shared blueprint; it is not a substitute for Marginalia’s actual pack.

## Fifteen connected scenes

| # | Scene | Principal state |
|---|---|---|
| 01 | Home top | Search/category before featured CG-7 model |
| 02 | Home bottom | Technical product matrix, compatibility education, service/footer |
| 03 | Collection | Model/spec cards, proposed typed facets, sort and pagination |
| 04 | PDP selection | CG-7 / Graphite, unavailable Silver, compatibility unconfirmed |
| 05 | PDP decision support | Host requirements, specification units, static model reference |
| 06 | PDP continuation | Actual fixture box contents, limits/policy, independent related products |
| 07 | Cart | Correct SKU summaries, quantity/removal, retained last confirmed values after error |
| 08 | Shared checkout address | Contact/address, eligible fixture rate and summary |
| 09 | Shared checkout review/pay | Complete summary before payment, mock eligibility, recoverable provider-window failure |
| 10 | Buyer sign-in | Canonical LetBuyy identity with explicit Circuit destination |
| 11 | Buyer create account | Actual email/password + configured bot check; explicit signed-in Continue state |
| 12 | Profile | Store context, identity details and representative display-name editing |
| 13 | Orders | Authenticated buyer’s Circuit order list |
| 14 | Owned order | Exact variants, quantities, totals, status and support context |
| 15 | Addresses | Default state and representative edit with invalid PIN retained |

Only the CG-7 PDP is fully illustrated. CG-5, charger and cable links lead to their clearly named reference blocks in the local source; implementation must use each product’s actual stable identity and route. Sign-in and registration are alternative account states; the populated owned-order fixture is not evidence that new registration links orders by email.

Scenes 01–02 describe one homepage. Scenes 04–06 describe one PDP and its states. Consolidated [homepage](source/home-complete.html) and [PDP](source/product-complete.html) references demonstrate the single-header route composition. Repeated headers and product-context strips orient standalone story images; production must not duplicate those routes or headers.

## Visual specification

The source uses the existing Circuit blueprint’s experience layer: canvas `#F5F7FA`, surface `#FFFFFF`, secondary `#E7EDF5`, text `#142236`, support `#4C5B70`, essential border `#67768B`, primary/link `#17476E`, focus `#005FCC`, error `#B42318`, warning `#7A3E00`, success `#166534`. Status surfaces use the blueprint’s corresponding pale colors and explicit words/icons. The local presentation variables do not create a production token authority; implementation must map to governed theme settings.

Inter 400/500/600/700/800 is stored locally with [font provenance](assets/font-provenance.json). Body is 16px, card facts 14px on desktop and at least 13px on mobile; secondary identifiers are smaller but essential model/title/price remains readable. Desktop title scale is 44–48px; mobile 30–32px. Controls use visible focus, named text, 48px principal actions and a 4px control radius. Content width is capped at 1328px with 40px desktop / 24px tablet / 16px mobile outer gutters. Breakpoints at 1100/900/640/359px reflow layouts, rather than scaling a desktop canvas.

Product imagery is 1:1 contained; no ports or plug pins are intentionally cropped. Four original fictional device photographs were made with built-in `image_gen`: CG-7 hub, CG-5 hub, CH-65 charger and CL-100 cable. Full prompts, generated originals, final paths and inspection notes are preserved. No CLI/API generation fallback, Shopify photography, real product logos or copied commerce copy was used. Lucide SVGs are rendered from the installed `lucide-react` package by `source/generate-icons.cjs`; the LetBuyy logo comes from the current identity app.

No autoplay, rotating specs or sticky purchase overlay is used. Reduced motion disables animation/transition behavior. This is a light-mode reference pack; production theme/controller mode support still requires implementation qualification.

## Fictional data and arithmetic

Nodeworks is a fictional manufacturer label. CG-7 / Graphite (`NW-CG7-GR`) costs ₹3,490. CL-100 / 1m / Graphite (`NW-CL100-1M-GR`) costs ₹690. One of each gives ₹4,180 subtotal, ₹80 fixture shipping, ₹0 discount and **₹4,260 total**. Prices are tax-inclusive in the fixture, with no added tax line. Production tax/rate/totals must come from the canonical server quote. CG-5 is ₹2,490 and CH-65 is ₹1,890; they are independently priced products, never an automatic bundle.

Fictional buyer Mira Rao uses `mira@example.test` and a clearly synthetic Sample Lane address. `circuit.example.test` is a reserved example-domain fixture. Order CIR-1024 uses the same two lines, total and address. Its mock payment-recorded/confirmed state represents a later successful fixture outcome, separate from scene 09’s retry illustration; no payment or order was actually made. No real identifiers, credentials, verification codes or signed URLs are included.

CG-7’s merchant fact sheet reference `NW-CG7-F1` is fictional and dated 22 October 2026. Its host requirements are explicitly separate from any device-model compatibility claim. No device model is verified, so the status is **unconfirmed**. 5 Gb/s is shown as 5,000 Mb/s for the model reference; 0.10m becomes 100mm. Power input and laptop pass-through output remain separate: CG-5’s 65W input cannot fill its missing pass-through output. Missing or different measurements stay not supplied/incomparable.

Generated photographs illustrate fictional hardware. Text facts are the fixture source of truth; images are not technical evidence. Real merchants must provide current facts, rights-cleared device media, references and applicable policies. No ratings, urgency, certification, safety, warranty period or delivery promise is fabricated.

## Shared authority and proposed controls

Checkout remains the canonical hosted commerce checkout. Branding is limited to permitted data semantics, not arbitrary merchant CSS, a new checkout service or theme-owned payment logic. Razorpay and COD shown in scene 09 are eligible only in the fictional mock quote; implementation must consume actual eligibility, revalidate stock/address/rate/price, and retain idempotent retry.

Credential screens follow `apps/platform/identity/src/app/globals.css` and `packages/typescript/ui/src/tokens.ts` admin/light mappings observed 23 October 2026. They retain LetBuyy branding and the current admin/light brand-ink action treatment (`#2C2642`, hover `#362C58`, link `#523F97`, focus `#6C54C4`). The current mounted `BuyerAuthorize` flow takes email/password, supports a configured bot check, establishes an identity-issued session, then requires explicit **Continue to Circuit**. Scene 11 depicts that next state and **Use a different account**. It does not invent automatic email delivery, a verification link, mandatory code entry, a required consent checkbox or a rule that an unverified buyer cannot sign in. Separate optional verification APIs are not the next automatic BuyerAuthorize screen. The authority is `identity-platform`; store pages do not mint sessions or inherit merchant privileges.

All data mutations and discovery controls in this pack are **proposed visual targets**. Buttons display an explanatory local feedback message instead of performing commerce. The account/profile/address/order views are fictional references, not evidence of persistence. Existing canonical primitives are A/B; electronics typed facts, public projection, unit semantics and facets are C; merchant claim/source responsibility is D. Interactive comparison is deferred pending C/D delivery. Financing, installation booking, service subscriptions, automatic compatibility detection and a universal warranty are excluded. Exact owners and executable acceptance conditions are in [capabilities.json](capabilities.json).

## Research provenance and limits

At least two relevant saved Shopify references are compared side-by-side: [Trade collection](https://theme-trade-demo.myshopify.com/collections/all) for regular information density and [Tinker home](https://theme-tinker-demo.myshopify.com/) for task categories. Saved primary/public captures are dated 22 October 2026 at 1440 × 1000, DPR 1. Current web extraction confirmed public vocabulary separately; it does not create fresh visual evidence. Each comparison identifies the observed state, retained convention, original difference, required contract and limits. Shopify images remain research evidence links, not Circuit theme assets.

This is expert design work. No conversion uplift, complete accessibility conformance, merchant usability study, production performance, provider integration, live publication or deployment is claimed.

## Reproduce and inspect

`source/build-storybook.py` emits the fifteen HTML scenes and fixtures from one maintained presentation system. `source/styles.css` owns responsive layout. `source/interactions.js` implements only local visual-reference feedback, password visibility, a reversible mobile menu and neutral mode. The gallery is independently navigable.

```sh
python3 source/build-storybook.py
node source/capture.cjs --sample
node source/capture.cjs
node source/build-boards.cjs
python3 source/build-gallery.py
python3 source/validate-storybook.py
```

Run from this folder with the existing repository/runtime dependencies. Capture requires a coordinator resource slot and the supported sandbox escalation for macOS browser bootstrap. It launches a fresh isolated headless Chromium with `chromiumSandbox:true`, file-based pages and no shared/user profile or IAB tab. No local server, database, user cookies, TLS bypass or dependency install is needed. The browser closes only its own process/context.

Validation records actual inner viewport, DPR, document/scroll width, image readiness, loaded font faces, grid columns, native screenshot dimensions and current hashes. Separate local probes cover 320px, 200% root text sizing, reduced motion and Hindi expansion. These probes do not replace full browser zoom, screen-reader or merchant-language acceptance. The final visual review identifies full-size images actually inspected.

## Ownership and next gate

Circuit chat `01a164ba-a97f-7d80-9430-57924218664b` owns only this subtree during mockups. Coordinator Themes `01a164a4-a342-76d3-ab33-65e021ed57db` owns programme-wide indexes, shared dependencies and milestone acceptance. Human communication authorization was verified in the full original attachment supplied by the coordinator. The shared dirty checkout and Threadline work are preserved; no production source, database, lockfile, shared generator or another theme’s artifacts were changed.

After local artifact/visual QA, the coordinator reviews the pack and portfolio. Implementation waits for the explicit programme dispatch after all nine packs pass, then completes the existing Liquid/theme/editor/checkout/identity/account owners. No additional approval gate or architecture expansion is invented by this design pack.
