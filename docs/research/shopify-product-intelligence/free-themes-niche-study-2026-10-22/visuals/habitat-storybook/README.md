# Habitat — responsive furniture storybook

Design study 1.0 for `craft` / Habitat. Fifteen connected scenes are designed for desktop **1440×1000**, tablet **834×1112**, and mobile **390×844**, DPR 1. Delivered: **45 independently rendered PNGs and 15 additional comparison boards**, locally validated on 23 October 2026. Coordinator portfolio acceptance remains pending. Export completion and exact measurements are owned by `exports.json`, `responsive-audit.json` and `validation.json`; source creation alone does not establish completion. [Visual review](visual-review.json), [stress audit](stress-audit.json) and [browser review checks](review-audit.json) qualify the result.

Open [the visual storybook](index.html), [responsive presentation](prototype-index.html), [45-PNG ZIP](Habitat-45-mockups.zip), [reference comparisons](comparisons/index.html), and [neutral structure comparison](comparisons/neutral-structure.html).

This pack contains visual targets and local demonstration interactions. It is not an installed, integrated, published or deployed storefront. No API, credential, payment, order, account or merchant-state mutation is performed by the source. Implementation waits for the coordinator’s programme-wide mockup milestone dispatch.

## Buyer mission and design

Judge room fit, dimensions, material, finish, assembly and actual delivery conditions. Room navigation sits beside panoramic context. Collection cards use two large objects on desktop/tablet and one on mobile; measurements and named finishes appear under each object. The PDP places the room above object selection, then an accessible dimension schematic and text facts. Assembled size and package size are explicitly different. The continuation covers material care, access, service exclusions and independently purchasable related items.

The room index distinguishes Habitat from a generic editorial storefront. Furniture cards communicate space rather than garment sizes or product-benefit badges. The neutral comparison removes photography, theme branding, accent colors and display typography to expose those task/layout differences. No conversion or usability improvement has been measured.

The two home scenes form one homepage; scenes 04–06 are segments/states of one chair PDP. Standalone context bars do not prescribe repeated headers or new routes. Scene 06 includes an independent table preview; its actual production link must resolve the table’s own product ID. The small synthetic collection has two real fixture products, not repeated image clones pretending to be a larger catalog. Pagination honestly shows one page.

## Visual specification

Canvas `#F7F3EB`, surface `#FFFDFA`, secondary surface `#E9E2D5`, text `#302C25`, supporting text `#625C50`, control boundary `#7B7261`, action/link `#4E573E`, white action label, focus `#005FCC`, error `#B42318`, success `#166534`. Selection uses named text, an explicit state and a boundary; it never relies on a wood-color circle alone. These are experience-layer visual targets under existing storefront settings, not a new platform token authority.

Libre Baskerville 400/700 and Source Sans Pro 400/600 are locally bundled from the Google Fonts CSS response. The actual response still names Source Sans Pro; no silent substitution to Source Sans 3 was made. Four storefront font files plus the reused canonical variable Geist identity face eliminate export-time network reliance. Platform identity uses the existing locally bundled Geist Sans and current canonical LetBuyy branding. Indian scripts require a script-capable fallback; the stress sheet records the local Hindi fallback and does not certify every merchant language.

Desktop content max is 1320px with spacious sections. Body copy is 17px/1.5, support 14–16px; mobile main titles are 32–38px. Object cards use contain at 4:3; room media uses panoramic crops with the chair retained. Diagram geometry is original SVG, labelled schematic/not to scale, with identical numeric text facts. Breakpoints are 900px and 600px with an intermediate 1180px adjustment. No fixed/sticky purchase bar obscures long facts or focus. Gallery changes are manual. Reduced-motion CSS removes smooth scrolling.

## Fixture ledger

[fixtures.json](fixtures.json) owns the fictional catalog, account and arithmetic:

| Item | Selected variant | Quantity | Amount |
|---|---|---:|---:|
| Aara lounge chair | Natural teak, oatmeal cushion | 1 | ₹18,900 |
| Nila side table | Natural teak | 1 | ₹6,400 |
| Subtotal | | | ₹25,300 |
| Delivery, sample address-specific quote | | | ₹500 |
| Discount | | | ₹0 |
| Total | | | **₹25,800** |

Tax is included in fictional item prices; no actual GST rate or provider charge is asserted. Order HB-1042, date 18 October 2026, uses the same products/totals. Its preparing/payment-recorded state is a labelled sample. No dispatch event or delivery date is invented. Buyer Mira Rao, `mira@example.test`, and the Example Lane address are fictional. No real PII, credentials, signed preview tokens or bearer URLs are included.

Aara’s common assembled dimensions are 68 W × 78 D × 74 H cm, seat height 38cm. Natural teak is ₹18,900, package 72×82×78cm, weight 13.8kg. Smoked teak is ₹19,900, package 74×84×78cm, weight 14.2kg. The packaging differences are explicit fictional SKU facts, not inferred from a photo or assumed consequences of staining wood. Finish selection changes the variant image, price and package facts while common dimensions remain stable. Nila is 50cm diameter × 42cm height, package 56×56×48cm.

## Canonical boundaries and dependencies

Classes inherit the [shared capability map](../../07_COMPONENT_AND_DATA_CAPABILITY_MAP.md): A canonical primitive; B exists but not wired here; C bounded extension; D product/policy/provider contract; E outside initial scope. They describe source support, not end-to-end certification.

| Responsibility | Class / proposed implementation | Owner and acceptance |
|---|---|---|
| Room/category navigation, basic search and pagination | A; niche facet workflow C | Existing product query/navigation. Preserve query/filter state and server counts; no fake facets. |
| Dimension-bearing cards, assembled/package/seat dimensions and material/assembly | A merchant media/text; C typed furniture namespace and public hydration | `commerce-core`, shared domain contract, gateway public projection, canonical Liquid drop. Normalize units; validate bounds/unknowns; do not infer facts from images. |
| Finish fact inheritance | C | Common product facts plus validated variant overrides. Switch finish: common assembled dimensions stay fixed; package/weight/image/price update from the actual SKU. Wrong or missing facts remain unknown. |
| Filters by normalized max width/material/finish | C | Current paginated product-query owner, not reserved search-service. Server-supported keys/indexed bounds; remove one retains the others; pagination round-trips. Hide proposed facet controls until integrated. |
| Related table | A curated independent product links | Same-site public product IDs with independent prices/stock. No bundle, inventory coupling or extra quantity implied. |
| Cart quantity/remove, selection, retry and final totals | A; target integration B | Canonical server cart and existing islands. Preserve variant identity; reprice/revalidate stock; idempotency and error recovery. Prototype quantity changes are display demonstrations and do not recalculate fixture totals. |
| Delivery service/rate/policy | A/D | Canonical gateway shipping/checkout. Merchant supplies actual service conditions. The displayed ₹500 is a labelled quote fixture. No ETA is advertised without a trustworthy live server result. |
| Payment eligibility/retry | A canonical shared checkout; provider readiness D | Online-only sample eligibility. Actual server may return different methods or no supported method. Never hardcode COD/PSP; never turn payment initiation into paid status. |
| Identity and verification | A canonical identity; target styling B | `apps/platform/identity` sole issuer. Email/password registration remains canonical; explicit signed-in Continue confirms the destination; separate requested verification proves email ownership before linking older records. No fake OTP-only login, separate Habitat credential form or invented mandatory signup gate. Human verification remains service-controlled. |
| Profile, owned order detail and addresses | A/B | Existing buyer-account owners. Store-resolved order scope; canonical buyer address ownership; denied/expired sessions do not expose stale data. Address edits preserve data on validation failure. |
| Help, returns and claims | A supplied content; B any support-entry binding | Real merchant policy and permitted support route needed. The prototype support control is proposed; no return/refund eligibility or date is invented. |
| Exact artifact preview/editor/publish | A/B lifecycle; C artifact-specific preview | Existing `theme-engine`, editor and gateway instance/draft/release spine. Versioned selected artifact; preserve merchant documents and immutable releases. |
| AR, room planning, assembly scheduling, custom manufacturing | E | Excluded. No operational controls or new service/runtime. |

Every presentation-only filter, sort, cart, save, login, code, payment and support control remains **proposed until its canonical workflow is implemented and verified**. The local menu, finish and gallery demonstrations establish only prototype behavior. No separate editor, renderer runtime, auth authority, cart, checkout or order system is proposed. UI targets map into the existing Liquid package/document and schema-selected reusable facts/card layouts (THEME-R1–5, WIN-R4).

Credential scenes retain LetBuyy logo, platform brand-ink actions and an explicit Habitat destination. Account scenes return to Habitat identity. Checkout uses a canonical address → review/pay structure and only allowed data-branding semantics; no merchant CSS injection or payment logic. Source source-path references are an integration map, not authority or a claim of current complete support.

## Research and evidence limits

Read the Habitat [blueprint](../../letbuyy-design-blueprints/05-craft-habitat.md), the [portfolio](../../06_TEN_NICHE_PORTFOLIO.md), [cross-theme matrix](../../03_CROSS_THEME_DESIGN_MATRIX.md), [root cause](../../05_DIFFERENTIATION_ROOT_CAUSE_ANALYSIS.md), [content resilience](../../10_UX_PRINCIPLES_AND_CONTENT_RESILIENCE.md) and [implementation plan](../../08_IMPLEMENTATION_PLAN.md). Saved Shopify dossiers for [Dwell](../../shopify-theme-dossiers/dwell.md), [Craft](../../shopify-theme-dossiers/craft.md) and [Vessel](../../shopify-theme-dossiers/vessel.md) ground the reference study. The comparison HTML has dates, actual saved viewport/state, URLs, retained convention, original difference and contract. Current official listing pages were opened with the web tool; no remote Shopify page or owner store was mutated. Observations and expert design proposals are separated.

Four original generated bitmap assets—room, chair, table and smoked chair finish—are copied locally. [generation-prompts.json](generation-prompts.json) preserves full built-in image_gen prompts and output provenance. Chair/table studio images derive from the same original room reference. No CLI/API image generation was used. The LetBuyy logo and generated Lucide markup were reused from the approved existing Threadline assets; no fashion photography or layout source was copied. Reference screenshots remain research-only comparison evidence outside Habitat’s scene assets.

Threadline’s [actual implementation record](../../../../../implementation/threadline-2026-10-22/README.md) documents separate integration progress and limits. Its mockups and current source were treated as method references; no claim is made that its remaining checkout/browser/accessibility acceptance is complete or reusable as Habitat proof.

## Export and review

`source/build_storybook.py` builds 15 native-text scene documents from one system. `source/capture.mjs` renders each viewport in an isolated temporary headless Chromium profile with `chromiumSandbox:true` and blocked network. It measures actual inner viewport, DPR, document/scroll width, image readiness, font faces and screenshot dimensions. `source/package_storybook.py` creates 15 additional scaled review composites and a ZIP containing only the current 45 PNGs. Individual screens are never resized from desktop; only the clearly labelled boards use scaled copies.

The normal sandbox cannot launch Chromium’s macOS Mach bootstrap. The coordinator verified supported bounded sandbox escalation; no TLS bypass, user profile, IAB tab, database, app build output, container or existing port is touched. Capture scheduling belongs to the coordinator. Artifacts remain inside this theme-owned subtree.

The final `validation.json` must distinguish structural checks, representative visual review, stress observations and outstanding implementation/assistive/device proof. Text enlargement and Hindi content tests are local stress fixtures; they do not certify WCAG conformance. No screenshot establishes runtime performance, authentication safety, accurate carrier serviceability or completed payment.

Coordinator: Themes, `01a164a4-a342-76d3-ab33-65e021ed57db`. Habitat chat: `01a164ba-c402-7212-990d-ed4792274b37`. Owner coordination authorization was verified in the original attachment; the delegation message alone was not used as authorization. Only Habitat’s artifact subtree is written during this milestone. Continue with coordinator review corrections, then await the explicit implementation dispatch after all nine packs pass.

Identity baseline correction, 23 October 2026: read the coordinator’s updated IDENTITY_REFERENCE.md and current identity globals.css/layout.tsx plus tokens.ts. Credential primary is admin/light brandInk[800] `#2C2642` (white label), neutral canvas gray[125] `#F6F7F9`, text gray[900] `#111827`, supporting gray[500] `#6B7280`, and Geist Sans. The earlier historical purple instruction was superseded before any Habitat captures. Habitat’s olive storefront palette remains independent.

Prototype routing limit: room links other than Living are visual category-entry examples and currently lead to the covered Living collection reference. Production must bind each to its own actual merchant collection or omit unavailable categories. The password-recovery affordance is a proposed entry to the current canonical recovery route; it does not submit credentials or claim a completed recovery journey here.

Final local artifact result, 23 October 2026: 45/45 genuine PNGs, 15/15 boards, exact viewport triplets at DPR1, no captured page overflow or broken images, relevant fonts loaded, all local HTML links resolving, 45-entry current-byte ZIP integrity/hash parity, and fixture arithmetic passed. All15 scenes additionally rendered at320px without page overflow. The targeted200%text/Hindi/long-title/reduced-motion/missing-media and finish-state observations are recorded separately. `review-audit.json` proves the complete mobile quote precedes payment in DOM and geometry, zero order-row edit controls, and a read-only profile sign-in email. Browser slot2 was explicitly released after browser closure.

Saved-comparison limit: the Craft product capture has absent product photography. It supports recorded text/control placement, not an intentional blank-image design. No remote screenshot was repaired or altered to conceal that limit.

The first local artifact validator invocation correctly found that its own `validation.json` link did not yet resolve before the first report was written. The immediate rerun against the complete folder passed; no false initial-green claim is made. No production build or historical governance total is claimed as fresh evidence.
