# Pitch — current free-theme dossier

Research: 22 October 2026. This is a comparative expert inspection, not user testing or a certification.

## Positioning and evidence boundary

**DOCUMENTED:** [Official listing](https://themes.shopify.com/themes/pitch/presets/pitch); developer Shopify; free catalog entry; version 4.3.0, dated 9 October 2026. Family: Horizon collection — explicitly identified in listing copy. Available catalog preset inspected: `pitch`; no alternate preset was verified. The listing's industry cross-links are discovery links, not an exclusive niche constraint. [Listing capture](../evidence/pitch-listing.json) separates overview, feature marketing and release text.

**OBSERVED / INFERRED:** The demo presents **bold contemporary skincare** through a **brand manifesto and benefit framing** approach. Merchant fit and customer intent are inferred from catalog/content; demo pricing is not proof of the merchants who will succeed with it. The catalog-size assumptions below concern the inspected sample, not a platform limit.

## Information architecture and homepage

Primary observed entry vocabulary: **Shop / About / Contact**. Search/cart are utility entries rather than the main editorial message. Footer link groups and subscription content are recorded in [route text](../evidence/pitch-route-summary.json); forms were not submitted. Desktop and mobile navigation differ in available width; mobile hides the full category row behind the menu where provided. Captured opened menu.

Ordered synthesis of the homepage: **Oversized graphic hero → bold benefit panels → products → ingredient/brand story**. This is a functional zone sequence, not an exhaustive inventory of every block. The [full-page desktop capture](../evidence/pitch-home-desktop.jpg) includes below-fold content; the [comparison sheet](../visuals/inspection-sheets/pitch.jpg) intentionally crops to the opening viewport. Photography and demo copy contribute to identity and can be changed independently of template structure.

## Collection and cards

Split collection banner combines context and media, followed by regular product grid. Card density refers to the opening captured arrangement and can vary with merchant configuration, content and width. Filters, sorting, count and pagination are recorded as visible affordances; their entire combination space was not tested. The collection [desktop state](../evidence/pitch-collection-desktop.json) contains the measured controls and geometry where a separate route was available.

## Product, cart and mobile purchase sequence

Cleanser layout combines factual benefit modules, product media, compact quantity and pill purchase control; no radio variant in selected fixture. Observed option-group text: No extra option fieldset in selected fixture; see controls and supplementary probes.. Product-image alt text and available stock labels are content, not validated certification. On narrow screens the sequence must be judged from [mobile product evidence](../evidence/pitch-product-mobile.jpg), not an editor's device frame. Gallery/detail ordering in that capture is the observed state; sticky behavior during arbitrary scroll positions is not exhaustively verified.

Captured empty-cart entry. No purchase, checkout commitment or order was made. Empty-cart presentation is established; successful cart mutation, discount application, checkout, payment and fulfillment are **untested**. Related-product regions may load after the first capture; a visible placeholder is not proof recommendations completed.

## Visual system and measurement

Liter; hot orange hero, soft purple and brown panels; large graphic headings. Computed body font declaration: `Liter, sans-serif`; first substantial heading declaration: `Liter, sans-serif`. These are computed CSS family lists, not a network/font-file audit. Recorded body background: `rgb(255, 250, 247)`. [Geometry/style JSON](../evidence/pitch-home-desktop.json) and, where present, product role measurements preserve individual sizes, spacing, borders and radii. A page background is not an entire semantic palette.

Actual comparison conditions: desktop **1440 × 1000 CSS px**, mobile **390 × 844**, DPR **1**. Native storefront viewports were used for final captures. No claim is made that a screenshot establishes keyboard, screen-reader, reduced-motion or performance compliance. Hover/focus and all timing stages remain incompletely tested.

## Tradeoffs and transferable lessons

Large brand lettering can delay concrete product identification; benefits need substantiation and readable contrast. This is an expert hypothesis about fit/friction, not demonstrated conversion impact. The opening screenshot may show images still loading; compare mobile and role measurements before treating a blank frame as intended design.

**LetBuyy implication:** Transfer modular ingredient/benefit explanation with evidence; reserve a compact product summary for functional discovery. Shared add-to-cart, stock and hosted checkout contracts remain shared. Borrow a task-support principle; do not reproduce Shopify assets, copy, private behavior or an entire composition. Listed app/B2B capabilities are not automatically present in LetBuyy.

## Route and review register

- [Homepage](https://theme-pitch-demo.myshopify.com/) — desktop full-page capture and mobile viewport.
- [Observed collection entry](https://theme-pitch-demo.myshopify.com/collections/skincare) — desktop and mobile captures.
- [Selected product](https://theme-pitch-demo.myshopify.com/products/soft-cleanse?variant=49913031360807) — desktop and mobile; option scope limited to this fixture.
- [Measurement and state records](../evidence/pitch-route-summary.json).

Review scope: all opening comparison panels visually reviewed; below-fold text/section ordering inspected from current rendered DOM and full-page captures. Not every pixel, carousel slide, policy page or responsive breakpoint was manually examined. Consult [coverage](../evidence/coverage-matrix.json) for supplementary probes and exact omissions.

## Supplementary information-page observation

Opened the observed [Sign up for our newsletter](https://theme-pitch-demo.myshopify.com/pages/contact) at desktop width. Substantial recorded headings: Contact / Join the club. [Rendered text/geometry](../evidence/pitch-editorial-desktop.json), [full-page capture](../evidence/pitch-editorial-desktop.jpg). This establishes page entry/content inspection only; form submission, every accordion and all article links were untested. This route is the contact/newsletter form; it is not evidence of a full editorial story.
