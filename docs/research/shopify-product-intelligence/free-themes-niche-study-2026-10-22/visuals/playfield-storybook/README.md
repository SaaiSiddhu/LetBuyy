# Playfield — responsive visual storybook v1

Playfield helps an **adult buyer choose a toy or activity by age and interest, then understand the included pieces and physical scale**. This pack targets the owner-authorized toys direction for stable preset `bloom`. It is a design reference, not an installed, published or transaction-tested theme.

[Open the navigable gallery](index.html) · [45-PNG download](Playfield-45-mockups.zip) · [Editable responsive presentation](prototype-index.html) · [Research and neutral comparisons](comparisons/index.html)

Final artifact QA completed **23 October 2026 (Asia/Kolkata)**; research and fictional order date remain 22 October.

## Scene coverage

The fifteen scenes each render separately at desktop **1440 × 1000**, tablet **834 × 1112**, and mobile **390 × 844** CSS pixels, DPR 1. Full-page PNG height can exceed the viewport. Fifteen additional boards show the three devices together; they are not counted among the 45 screens. Exact captured dimensions, loaded font faces, image readiness and scroll width are in [responsive-audit.json](responsive-audit.json) and [exports.json](exports.json). Final artifact checks are in [validation.json](validation.json).

| Scene | Shopping task | Source |
|---|---|---|
| 01 Home opening | Two-choice adult age/interest finder; activity bento; age entries | [Source](source/01-home-top.html) |
| 02 Home continuation | Age-labelled products; countable kit contents; care and help | [Source](source/02-home-bottom.html) |
| 03 Activities | Age AND interest composition; clear-one preserves the other; unknown-age example | [Source](source/03-collection.html) |
| 04 PDP selection | Whole-object media, option availability, warning before purchase | [Source](source/04-product-main.html) |
| 05 PDP contents | 12 tiles + 2 cards + 1 tray; dimensions with text equivalent; absent finish fact | [Source](source/05-product-contents.html) |
| 06 PDP continuation | Activity context, care, real-policy dependency, independent related product | [Source](source/06-product-continuation.html) |
| 07 Cart | Garden/Colour mix options, quantity/remove, subtotal and shipping boundary | [Source](source/07-cart.html) |
| 08 Checkout address | Canonical shared contact/address/shipping and full quote | [Source](source/08-checkout-address.html) |
| 09 Checkout review/pay | Every line and amount before pay; eligible-method fixture; retry state | [Source](source/09-checkout-review.html) |
| 10 Sign in | LetBuyy credential identity with explicit Playfield destination | [Source](source/10-sign-in.html) |
| 11 Create account | LetBuyy account creation and subsequent explicit Continue state | [Source](source/11-sign-up.html) |
| 12 Profile | Playfield account navigation, profile editing and last-order link | [Source](source/12-profile.html) |
| 13 Orders | Owned-order identity, date, payment and processing state | [Source](source/13-orders.html) |
| 14 Owned order | Same variants and totals, fulfillment distinction, actual tracking absence | [Source](source/14-order-detail.html) |
| 15 Addresses | Saved default plus edit/PIN-validation state; retained existing record | [Source](source/15-addresses.html) |

Scenes 01–02 form one homepage; 04–06 form one PDP. Standalone exports repeat context for review. They do not prescribe duplicate production routes or headers. Scene 11 combines account creation and an explicitly labelled subsequent signed-in Continue panel; the real identity flow displays these states sequentially. Scene 15 combines saved address and representative failed edit. The local gallery presents these states without calling a service.

## Design system

Canvas `#FFF9EE`, surface `#FFFFFF`, supporting surface `#F3E6C8`, main text `#29251D`, supporting text `#655A43`, action/selected `#1D5C54`, essential control boundary `#7A6A4D`, focus `#005FCC`, error `#B42318` on `#FFF4F2`, warning `#7A3E00` on `#FFF4CE`. Coral and sage are merchandising surfaces, not status signals. Status always has text. These are blueprint-derived experience values in a visual reference; production uses the canonical settings/token mechanism, not a second platform token authority.

The39 storefront/checkout/account views use Inter400/500/600/700/800; the6 canonical credential views use the exact locally copied Geist variable font from the current identity layout. Inter is locally supplied with its OFL license for consistent exports. Body is 16px; prominent product/home headings reflow by breakpoint. Storefront content width is 1200px with flexible gutters. Controls are generally 44–50px high. Media uses square contain for full products, 3:2 activity context, no text burnt into images. Corners are 16px on media and 7–10px on utilities. No autoplay or decorative animation. Reduced motion removes smooth scrolling.

Desktop home puts the adult finder beside the heading and follows it with an asymmetric activity bento. Tablet keeps the finder legible and restructures product detail into a full-width gallery with a thumbnail rail, followed by the purchase region. Mobile has a reversible menu, stacked finder and bento, full-width contents-rich cards, facts adjacent to selection, stacked dimension information and account navigation in a row. Mobile/tablet checkout review moves the entire order summary before payment controls. No sticky action conceals warnings or focus.

## Fictional fixtures and provenance

All products, options, prices, stock, facts, age recommendations, warnings, dates, customer/address/order details and quote outcomes are **fictional design data**. They establish no real suitability, certification, material truth, tax policy, delivery commitment or paid order. No children are depicted; no child accounts or profiling are proposed. Merchant product facts remain adult-facing.

[Fixtures](source/fixtures.json): Pattern Studio Garden, ₹1,290 × 1; Paper Play Colour mix/A5, ₹490 × 1. Subtotal ₹1,780; sample shipping ₹80; total ₹1,860. Taxes are included in the fictional prices; no tax rate is invented. Order `PLF-1026`, dated 22 October 2026, uses the same items, options and total. Payment received is a labelled fictional order state; fulfillment remains processing/not dispatched. `mira@example.test`, `help@example.test` and the Example Lane address are test data. No phone, real credential or signed URL is included.

Pattern Studio contains exactly 12 tiles, 2 idea cards and 1 tray (15 pieces). Tray outside dimensions 24cm length × 19cm width × 1.5cm height; tile 5 × 5 × 0.6cm. Dimensions are supplied fixture facts; photographs are not measurement evidence. The activity photo was generated from the product reference. Paper Play's folded examples are activity inspiration, not extra included contents. Sheet count is fixture data, not visually proven by the stack. Product imagery is original built-in imagegen, with [full prompts and provenance](generation-prompts.json). Lucide SVGs come from the installed governed `lucide-react` package. LetBuyy's canonical logo is retained on credential pages.

## Capability handoff — proposed controls require canonical integration

Classes follow the shared research: **A** canonical supported primitive; **B** existing but target wiring/evidence incomplete; **C** bounded extension; **D** product/policy/provider decision; **E** deferred/outside scope. Source-level support does not mean deployed readiness.

| Capability | Class / existing owner | Required before advertising it as working |
|---|---|---|
| Versioned Playfield composition, bento and toy-fact cards | B/C · theme-engine / existing Liquid / schema/editor | New version through catalog→Add→draft→preview→publish→release readback; schema-selected layouts, no renderer fork |
| Name, price, media, options, quantity and availability | A · shared-types / commerce-core / cart island | Bind actual product/SKU; preserve Garden vs Ocean; disabled Sunrise must reflect server stock; reprice/check inventory |
| Merchant age recommendation, interests, contents, unit dimensions, material, warning source | C · commerce-core + product edit/public adapter | Bounded validated toy namespace, merchant edit/readback, allowlisted public Liquid projection; unknown does not become an age or certification badge |
| Age + interest + sort/pagination | C · existing paginated gateway product query | AND-composed allowlisted query, stable URLs/back, honest counts, independent clear-one; local fixture interaction is not server proof |
| Contents diagram and text equivalent | A/C · productDetail/facts/media | Merchant facts drive diagram and text consistently, selected-variant override rules; no image-derived measurements |
| Warnings, materials and actual policies | A/C/D · merchant content + domain rules | Explicit source/edition, absent critical fact; verify policy links and ownership; no fabricated safety guarantee |
| Related Paper Play | A · bound public same-site product list | Independent actual product route, price and stock; no bundle/coupled inventory |
| Cart and shared checkout | A/B · checkout-core + gateway / hosted checkout | Actual server quote, stock/error recovery, idempotency, eligible methods, provider result; no theme-owned payment logic |
| Buyer identity, profile, owned order history/detail, addresses | A/B · identity-platform + canonical buyer/customer owners | Exact current registration/verification method, safe site return, owned-record access, profile/address persistence, session-expiry and denial paths |
| Reviews/ratings | B · existing moderated review owner | Omitted until real published feedback is available; no fake score |
| Certification, child profile, recommendations from child behavior, advanced bundles | E | Excluded from this design; no implied workflow |

Presentation controls are proposals. The only locally exercised commerce-like interaction is fixture filtering; it never reads a server catalog. Option buttons, quantities, cart updates, form saves, credentials and retry payment still need canonical wiring. The corrected identity scenes follow the mounted BuyerAuthorize contract: email/password and a configured bot challenge, then an identity session, then explicit Continue to Playfield or Use a different account. Registration says at least eight password characters. No automatic verification email/link or mandatory verification-before-sign-in is implied; separate optional six-digit email-verification APIs are not this OAuth return step. The profile’s verified-email badge is a fictional existing-account state, not a claimed default after registration. The gallery's product links intentionally share one reference PDP; production must route each actual product independently. `mailto:help@example.test` illustrates a support destination, not an operational mailbox.

Checkout carries only the permitted wordmark/palette/font data through the existing branding contract. It does not accept arbitrary merchant CSS or create payment authority. Sign-in/create-account remain visibly LetBuyy; account pages return to the merchant's Playfield presentation.

## Versioned Bloom transition

The owner explicitly included Playfield/toys in the programme. That authorizes this design pack, not an in-place rewrite of pet-oriented Bloom data. Preserve the existing `bloom` identity and all pet package versions, instances, saved drafts and immutable releases. Introduce a new explicitly chosen toys design/package version with niche/content requirements and truthful preview; exact semver is allocated by the coordinator after checking the current registry. No automatic migration/recommendation change for existing pet merchants. Settings-only, additive and full-design application retain the current reviewed-diff and recovery semantics. A pet→toy full-design selection needs explicit merchant choice and visible content-risk diff. The pack makes no registry/source mutation.

## Research and evidence limits

Read [blueprint 02](../../letbuyy-design-blueprints/02-bloom-playfield.md), shared portfolio/capability/resilience documents, and Tinker/Crave/Colorblock dossiers. Two comparison cases use saved dated public evidence and current read-only text verification: [Tinker puzzle](https://theme-tinker-demo.myshopify.com/products/craighill-venn-puzzle-stainless-steel) and [Crave home](https://theme-crave-demo.myshopify.com/). See [attributed side-by-side comparisons](comparisons/index.html) and [source register](comparisons/references.json). Tinker's saved first desktop product image is unloaded; the blank area is an evidence limitation, not an intentional layout finding. Reference screenshots are comparative research, never production imagery. The original neutral diagrams suppress photography, branding and accent color to show the age/interest→contents distinction from occasion/budget gift discovery and campaign-led merchandising.

The artifact validation proves rendered files and bounded presentation behavior. It does not certify a production theme, WCAG conformance, conversion impact, merchant usability, provider readiness or performance. Required later proof: complete canonical installation/editor/release chain, typed data and real facet behavior, correct SKU/cart/order readback, identity/owned-account recovery, Liquid sandbox/tenant security, assistive technology, actual merchant language and performance on an agreed device/network.

Only this Playfield subtree was authored. Shared checkout/source was already dirty; it was preserved. No application/service/package/database/lockfile, old research, programme index, shared generator, user tab, test store, container or port was changed. Milestone 2 awaits the coordinator's programme-wide completion dispatch.

## Reproduce the artifacts

Use existing repository dependencies and Python 3.12+ (the bundled Python has Pillow). From the repository root:

```sh
<bundled-python> docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/playfield-storybook/source/build-storybook.py
node docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/playfield-storybook/source/capture.mjs
<bundled-python> docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/playfield-storybook/source/package-storybook.py
python3 docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/playfield-storybook/source/build-gallery.py
```

Capture uses a fresh isolated Chromium context with `chromiumSandbox:true`, no existing browser profile, no TLS bypass, no server or production calls. macOS requires the supported sandbox escalation for headless launch. Coordinate the bounded capture slot before running. Never copy a historical governance count or clean the dirty shared checkout to satisfy artifact QA.

## Identity correction — 23 October 2026

Scenes 10/11 now follow the coordinator’s [current identity reference](../../../../../implementation/niche-theme-programme/IDENTITY_REFERENCE.md) and the directly inspected `apps/platform/identity/src/app/buyer/authorize/authorize-client.tsx` and buyer-register route. Successful registration returns an identity-issued session; only explicit Continue calls the OAuth authorization endpoint. An OAuth authorization code is not user email verification. No unsupported required consent checkbox was added. A dashed bot-check note marks configuration-dependent UI and never depicts a passed challenge.

The credential typeface is canonical Geist (identity layout.tsx, locally copied under its OFL license). The credential palette projects current identity admin/light semantics: primary `#2C2642`, primary text/secondary `#523F97`, page `#F6F7F9`, surface `#FFFFFF`, main text `#111827`, subdued `#6B7280`, border `#E5E7EB`, input boundary `#8F88A9`, focus `#6C54C4`. Source: identity `globals.css` aliases and `packages/typescript/ui/src/tokens.ts` adminSurfaceIdentity.light. This supersedes the historical purple credential treatment. The scoped [identity stylesheet](source/identity.css) loads only in these two scenes; storefront/checkout colors and the other 39 PNGs are preserved. See [correction evidence](identity-correction.json) for the final hash/recapture result.
