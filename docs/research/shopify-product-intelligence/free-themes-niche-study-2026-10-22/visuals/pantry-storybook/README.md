# Pantry · 45-image responsive storybook

Pantry is the proposed shelf-stable food design under stable preset identity `refresh`. This pack is an editable visual reference, not an installed, published or deployed storefront. It follows the owner’s ten-theme programme; only this theme’s artifact folder was changed. All product, price, account, address, order, quote and availability content is fictional.

- [Navigable storybook](index.html)
- [45-PNG ZIP](Pantry-45-mockups.zip)
- [Responsive source index](prototype-index.html)
- [Research comparisons](comparisons/index.html) and [original neutral structures](comparisons/neutral-structure.html)
- [Scene registry](scenes.json), [fixtures](fixtures.json), [A–E capability handoff](capabilities.json)
- [Viewport evidence](responsive-audit.json), [exports](exports.json), [validation](validation.json), [asset provenance](generation-prompts.json)

## Design and buying mission

Understand the ingredients/allergens and choose the correct net quantity and pack count. A compact seasonal feature gives way to shelf shortcuts and contained package rows. Net quantity and price stay adjacent. The desktop PDP has three zones: package, ingredients/allergen facts, and purchase panel. Tablet puts purchase beside package/facts; mobile puts the allergen summary before the purchase action. There is no fixed purchase bar hiding warnings.

The source scenes 01+02 are one homepage. Scenes 04+05+06 are one product page and its continuations. Their repeated context supports standalone story images; it does not prescribe duplicate production routes or repeated production headers. The account scenes return to Pantry identity; credential screens remain LetBuyy’s sole buyer identity. Checkout carries only permitted data-branding semantics and canonical address → review/pay structure.

## Connected fifteen-scene journey

| # | Scene | Essential task |
|---|---|---|
| 01 | Home top | Compact seasonal feature, shelves, first product rows |
| 02 | Home bottom | Ingredient education, independent recipe/product links, service information/footer |
| 03 | Collection/search | Shelf groups, quantity/value rows, proposed facets/sort, bounded pagination |
| 04 | PDP selection | Ingredients/allergens beside named pack selection and quantity |
| 05 | PDP decision support | Supplied food facts, unknown allergens/nutrition, storage/preparation |
| 06 | PDP continuation | Independent related rice and policy/support context |
| 07 | Cart | Correct packs/net quantity, remove/update, retained quantity after failure |
| 08 | Shared checkout address | Contact, address, sample rate and full summary |
| 09 | Shared checkout review/pay | Full quote before commitment, eligible mock methods and retry |
| 10 | Canonical sign-in | LetBuyy credentials, explicit Pantry destination, session expiry |
| 11 | Canonical create account | Email/password, security verification and explicit account-sharing continuation |
| 12 | Profile | Supported name editing, overview and tenant-scoped navigation |
| 13 | Orders | Owned history, quantities, totals, status and pagination |
| 14 | Order detail | Immutable selected SKU/pack facts, totals, mock status, support |
| 15 | Saved addresses | Default/list, representative add/edit, PIN validation and retained input |

## Fixture arithmetic and honesty

Split red lentils SKU `P-LENT-250`: 250 g net per pack, ₹180 including tax, ₹72/100 g. Two packs = **500 g net and ₹360**. The 500 g option is explicitly unavailable and cannot be submitted. Basmati rice SKU `P-RICE-1K`: 1 kg net, ₹220 including tax, ₹22/100 g. Cart: three packs, 1.5 kg total net, ₹580 item subtotal. The sample shipping quote is ₹60; no additional tax; total **₹640**. Order `PN-1048` uses those exact lines and totals.

Allergens for the lentils are **not supplied**. The pack is not described as allergen-free. Nutrition/batch/expiry details are not fabricated. No reviews, urgency, dietary/health/certification badge, delivery guarantee, subscription, restaurant or cold-chain capability is invented. Photography is original synthetic packaging; authoritative factual labels are native HTML. Fictional buyer `mira@example.test` and domain `pantry.example.test` are reserved fixtures. No credentials, private preview tokens, actual orders or real payments are used.

## Visual system

Inter weights 400/500/600/700, supplied locally with its OFL license; Arial/system and Devanagari fallback. Canvas `#FCF8EF`, surface `#FFFFFF`, secondary `#EEE8D8`; main text `#262A1D`, supporting text `#5A624A`, essential boundary `#707858`. Primary/link `#36533D` with white text; focus `#005FCC` with visible offset. Error `#B42318` on `#FFF4F2`; warning `#7A3E00` on `#FFF4CE`; success `#166534` on `#EDF8EF`. Selected controls have fill plus check/radio/text; unavailable controls are labelled and disabled. Neutral lines are decorative, distinct from essential input borders. Identity uses the current LetBuyy logo and current canonical admin/light brand-ink action family (`#2C2642` primary, `#523F97` links, `#8F88A9` input boundary, `#F6F7F9` page).

Content max 1240 px; 6 px controls, 8 px hero corner; desktop 48 px display/32 px section/16 px body, narrow 36/28/16. Product media contain the whole pouch at approximately square ratio; lifestyle still life uses controlled landscape crop. 1100/900/600/350 px breakpoints reflow the source. No autoplay, carousel or fabricated scarcity motion. Reduced motion disables smooth scroll; quantity is a server-confirmed state in implementation, not a visual counter authority.

These CSS choices are proposed theme settings/layout defaults within the existing storefront mechanism, not a second platform token source. Lucide icons are rendered from the repository’s installed `lucide-react` exports. The original three generated photographs are reused purposefully across the journey. [Prompts and provenance](generation-prompts.json).

## Research and source boundaries

Direction follows [Pantry blueprint](../../letbuyy-design-blueprints/04-refresh-pantry.md), shared [capability map](../../07_COMPONENT_AND_DATA_CAPABILITY_MAP.md), [content resilience](../../10_UX_PRINCIPLES_AND_CONTENT_RESILIENCE.md) and [acceptance limits](../../09_ACCEPTANCE_AND_LIMITATIONS.md). Savor’s named pack choices and Crave’s ingredient/preparation content informed two attributable comparisons. Saved 22 October 2026 screenshots are compared with Pantry at matching widths; their differing capture heights are explicit. The web tool could read Crave’s product text with cached freshness limits; Savor fresh open was unavailable. No checkout/cart success or conversion claim is inferred. Shopify assets are confined to linked research evidence and never copied into Pantry assets or source. See [comparison register](comparisons/references.json).

The Threadline 45-image pack informed the coherent source/native-text/export method, not Pantry’s layout or palette. Its current integration evidence identifies fixes and unresolved checkout/browser limits; none are counted as Pantry implementation. Current identity source `apps/platform/identity/src/app/buyer/authorize/authorize-client.tsx` and buyer register route show email/password, configured bot verification and explicit Continue authorization. Scene 11 does not invent a mandatory OTP/email challenge. Profile/orders/addresses remain canonical buyers/store relationships.

## Implementation handoff

[capabilities.json](capabilities.json) classifies each feature A–E. Food metadata is not automatically public Liquid data. Structured food facts, variant net quantity and server unit-price derivation are **C** extensions. Shelf-list/ingredients layouts need bounded schema/editor/Liquid consumption. Facets/counts/sort shown in scene 03 are **proposed** until actual server queries work. Hide unsupported controls in a production package. Native source links use representative scenes; implementation must bind real product/recipe/category identities, actual quotes, allowed methods, ownership and persistence. The HTML source itself makes no API request and performs no commerce/account effect.

The coordinator owns shared schema/catalog/editor/renderer/discovery/checkout/identity changes. One owner must implement each shared dependency once. Stable `refresh` identity and prior merchant releases must remain intact through intentional versioning. No production source, lockfile, database, shared generator or another theme’s folder was changed here. Milestone 2 awaits the coordinator’s programme-wide Milestone 1 completion dispatch.

## Verification scope

Each scene is independently rendered at desktop 1440×1000, tablet 834×1112 and mobile 390×844 CSS px, DPR1, with full-page PNG height allowed to exceed the viewport. [Audit](responsive-audit.json) records actual inner width/height, document/scroll widths, font faces and image readiness; [exports](exports.json) records PNG dimensions. Additional 320 px, text-only 200% expansion, reduced-motion and Hindi title checks are recorded separately and do not inflate the 45-image count. Boards are presentation composites, never substituted for responsive exports.

Artifact validation covers PNG signatures/decoding/dimensions, exact scene/device coverage, hashes/duplicate detection, ZIP bytes, local links, fonts/images/overflow, fixture arithmetic, and scope. Full-size representative screens are inspected in addition to the machine checks. These are visual artifact checks, not working keyboard/cart/auth/payment/ownership acceptance, accessibility certification, production performance or hosted deployment. Real canonical install → editor → publish → commerce/account and recovery tests remain Milestone 2 work.

Execution: one theme agent; no subagents or extra chats. Shared user/IAB tabs, ports, containers and merchant state were untouched. Capture uses fresh isolated headless contexts. The supported sandbox escalation is needed for macOS Chromium bootstrap; it does not bypass TLS or reuse a user browser profile.

Identity palette baseline (23 October 2026): `apps/platform/identity/src/app/globals.css` admin/light semantic aliases plus `packages/typescript/ui/src/tokens.ts` `adminSurfaceIdentity.light`. The earlier purple mockup reference was superseded. Scene 11 includes the separately labelled signed-in **Continue to Pantry / Use a different account** state after account creation; this remains visual-only.

Supplemental evidence counts are **47 render records**: all 15 scenes at 320 px plus eight representative scenes each for text expansion, Hindi expansion, missing-media mode and reduced motion. Missing-media injection applies to home/collection/PDP; five credential/checkout/address captures have no selected product-media target and are explicitly marked not applicable for that branch. All 47 still record their actual overflow/image-loading state. Hindi is a local expansion fixture, not a verified complete translation.

Final artifact result, 23 October 2026: **45 distinct PNGs / 15 boards / 45 current ZIP entries**; actual viewport/DPR, font/image readiness, no-overflow, signatures/decoding, 572 local links, fixture arithmetic and byte-identical ZIP content passed. The programme validator was also run locally by this theme agent ([result](coordinator-validator-local-run.json)); this is not the coordinator’s independent visual acceptance. [Visual review findings and corrections](visual-review.json) are resolved, including immutable order rows. [42 unchanged image hashes](scene14-unchanged-42.json) record the final bounded scene14 correction.
