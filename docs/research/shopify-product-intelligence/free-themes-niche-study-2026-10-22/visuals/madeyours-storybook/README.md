# MadeYours — responsive design storybook

Milestone 1 design pack for `nova` / MadeYours, design version 1. **45 independently rendered PNGs, 15 additional three-device boards, one responsive source system.** Prepared 22–23 October 2026. These are visual targets with fictional fixtures. Production integration, persistence, publication, payments and fulfillment are not implemented or certified by these files.

Open the [visual gallery](index.html), [responsive source index](prototype-index.html), or [45-PNG ZIP](MadeYours-45-mockups.zip). Review [validation](validation.json), [viewport evidence](responsive-audit.json), [export hashes](exports.json), [A–E dependencies](capabilities.json), [fixtures](source/fixtures.json) and [asset provenance/prompts](generation-prompts.json).

## Buying task and differentiation

Choose a stocked base → specify permitted text → review the exact accepted configuration. Home explains that process; cards expose the personalization method and limit; the PDP becomes a configuration workspace. The written summary is authoritative. Every graphical preview is labelled illustrative.

This differs from Kindred’s occasion/recipient/budget selection of ready-made gifts and Threadline’s garment fit evaluation. The [neutral comparison](comparisons/neutral.html) removes brand, palette and photography to show the task structures. No gift-note workflow, uploads, proof approval, auto-bundle, wallet, new renderer or customization service is introduced.

The product-specific fixture permits **one line of 1–18 characters** on the walnut block, with A–Z/a–z, spaces, ASCII apostrophe and hyphen. Merchant-enabled scripts and methods require explicit validation, typeface/production capability and policy. Hindi UI expansion is tested separately; it does not imply Hindi engraving support. Unicode normalization, grapheme counting, case preservation, control-character rejection and safe escaping belong to the proposed server contract, not browser authority.

## Connected scenes

Scenes 01–02 form one homepage. Scenes 04–06 form one PDP and its states. Repeated context in standalone exports is for review, not duplicate production routes or repeated production headers.

| Scene | Task / state | Desktop | Tablet | Mobile | Board |
| 01-home-top | A considered base. Your words. | [PNG](images/01-home-top-desktop.png) | [PNG](images/01-home-top-tablet.png) | [PNG](images/01-home-top-mobile.png) | [PNG](boards/01-home-top.png) |
| 02-home-bottom | Two bases. Many meanings. | [PNG](images/02-home-bottom-desktop.png) | [PNG](images/02-home-bottom-tablet.png) | [PNG](images/02-home-bottom-mobile.png) | [PNG](boards/02-home-bottom.png) |
| 03-collection | Choose your base | [PNG](images/03-collection-desktop.png) | [PNG](images/03-collection-tablet.png) | [PNG](images/03-collection-mobile.png) | [PNG](boards/03-collection.png) |
| 04-product-main | First, choose your base. | [PNG](images/04-product-main-desktop.png) | [PNG](images/04-product-main-tablet.png) | [PNG](images/04-product-main-mobile.png) | [PNG](boards/04-product-main.png) |
| 05-product-specify | Make space for your words. | [PNG](images/05-product-specify-desktop.png) | [PNG](images/05-product-specify-tablet.png) | [PNG](images/05-product-specify-mobile.png) | [PNG](boards/05-product-specify.png) |
| 06-product-review | Check it. Make it yours. | [PNG](images/06-product-review-desktop.png) | [PNG](images/06-product-review-tablet.png) | [PNG](images/06-product-review-mobile.png) | [PNG](boards/06-product-review.png) |
| 07-cart | Your words, kept separate. | [PNG](images/07-cart-desktop.png) | [PNG](images/07-cart-tablet.png) | [PNG](images/07-cart-mobile.png) | [PNG](boards/07-cart.png) |
| 08-checkout-address | Where should it go? | [PNG](images/08-checkout-address-desktop.png) | [PNG](images/08-checkout-address-tablet.png) | [PNG](images/08-checkout-address-mobile.png) | [PNG](boards/08-checkout-address.png) |
| 09-checkout-review | One last look. | [PNG](images/09-checkout-review-desktop.png) | [PNG](images/09-checkout-review-tablet.png) | [PNG](images/09-checkout-review-mobile.png) | [PNG](boards/09-checkout-review.png) |
| 10-sign-in | Sign in to LetBuyy | [PNG](images/10-sign-in-desktop.png) | [PNG](images/10-sign-in-tablet.png) | [PNG](images/10-sign-in-mobile.png) | [PNG](boards/10-sign-in.png) |
| 11-sign-up | Create your LetBuyy account | [PNG](images/11-sign-up-desktop.png) | [PNG](images/11-sign-up-tablet.png) | [PNG](images/11-sign-up-mobile.png) | [PNG](boards/11-sign-up.png) |
| 12-profile | Hello, Asha. | [PNG](images/12-profile-desktop.png) | [PNG](images/12-profile-tablet.png) | [PNG](images/12-profile-mobile.png) | [PNG](boards/12-profile.png) |
| 13-orders | Your MadeYours orders. | [PNG](images/13-orders-desktop.png) | [PNG](images/13-orders-tablet.png) | [PNG](images/13-orders-mobile.png) | [PNG](boards/13-orders.png) |
| 14-order-detail | The words you ordered. | [PNG](images/14-order-detail-desktop.png) | [PNG](images/14-order-detail-tablet.png) | [PNG](images/14-order-detail-mobile.png) | [PNG](boards/14-order-detail.png) |
| 15-addresses | Your saved places. | [PNG](images/15-addresses-desktop.png) | [PNG](images/15-addresses-tablet.png) | [PNG](images/15-addresses-mobile.png) | [PNG](boards/15-addresses.png) |

Supplementary sources cover the independent notebook, explicit canonical signed-in Continue state, buyer password recovery, order-support instructions and address-add state. They do not replace a required scene or count toward the 45 PNGs.

## Visual system and assets

Canvas `#F5F6FC`, surface white, supporting surface `#E7EAF7`, text `#23243E`, supporting text `#595D7D`, action/link `#484B8B`, essential control border `#747999`, focus `#005FCC`, error `#B42318` on `#FFF4F2`, success `#166534` on `#EDF8EF`. Words and icons accompany status color. The blueprint’s opaque palette contrast calculations are a design reference, not complete accessibility certification.

MadeYours uses Inter; canonical credential screens use the current bundled Geist sans from identity layout.tsx. Identity colors snapshot admin/light token roles: primary/CTA `#2C2642`, hover `#362C58`, active `#181524`, links `#523F97`, input border `#8F88A9`, focus `#6C54C4`, neutral canvas `#F6F7F9`. This source-grounded correction supersedes the historical Threadline purple treatment. The Geist font and license are copied from the current governed UI assets.

Inter uses local official weights 400/500/600/700, `font-display: swap` and system/script fallback. The [original fetched stylesheet](assets/inter-license-source.css) and [OFL license](assets/Inter-OFL.txt) accompany the font files. Display hierarchy is 64px desktop home, 44px narrow home, 32–48px task headings and 14–16px task/body text. Essential input/control text is native browser text. The 1280px content width, 24/40/56px section rhythm and 8px controls are proposal values scoped to the research source, not a new platform token authority.

Three original built-in `image_gen` assets supply the hero, walnut block and notebook. They are reused coherently, with native text overlays only on explicitly illustrative preview stages. The prompts and exact generator output paths are saved. No CLI/API image-generation fallback was used. The canonical LetBuyy logo is used only for credential identity. Functional icons come from installed Lucide React via the preserved `generate-icons.mjs`; no second icon family or code-fabricated product photography is used.

The hero crops its studio still life; the base card/gallery contains the product within an intentional frame. A missing production image requires a stable ratio placeholder and product text, never synthesized factual photography. No fabricated ratings, urgency, certifications or delivery guarantees are present.

## Responsive evidence

Every scene rendered independently in isolated local Chromium through the existing `@playwright/test` dependency, at **1440×1000**, **834×1112**, and **390×844 CSS px**, **DPR 1**. PNG heights are full page and may exceed viewport height. Audit records include actual `innerWidth/innerHeight`, document and scroll width, screenshot dimensions, loaded font faces, image readiness and grid columns. Full-page screenshots are actual PNG encoding with current SHA-256 hashes; no screenshot was stretched into another device export.

Tablet hides the full navigation, retains a two-column base grid and uses a narrower split PDP; checkout stacks. Mobile stacks the hero, product cards and PDP, exposes one configuration step, changes account navigation to a compact row, reflows the order table into labelled rows and stacks address forms. The full configured checkout summary appears **before** payment controls on tablet/mobile. No sticky purchase bar obscures text or focus.

The [33 additional stress checks](comparisons/stress-audit.json) comprise all 15 scenes at 320px, all 15 at 200% text-only enlargement, and three Hindi UI-expansion samples. Reduced motion is active and recorded. Text enlargement doubles computed text sizes while preserving CSS viewport width; it is not a claim about every browser’s zoom algorithm. Hindi checks intentionally expand representative headings/labels, not a complete translated site or a native-language usability study. Screenshots are under `comparisons/stress/`; they are excluded from the 45-PNG ZIP.

Visual review caught a radio-label squeeze in the Hindi state despite a passing no-overflow check. The input sizing and option wrapping were corrected and all affected exports/evidence refreshed. [Extra evidence](comparisons/extra-audit.json) also records native menu keyboard open/Escape/focus return, the invalid field’s visible focus/description relationship, and summary-before-payment geometry. These are limited presentation checks; screen-reader, full keyboard journey, production performance and integrated accessibility remain later acceptance work.

## Fixtures and continuity

The small catalog contains a walnut Desk name block at **₹1,290** and an ivory/indigo Everyday notebook at **₹790**. The notebook is independently purchased and linked to its own supplementary product reference, not silently mapped to the block or bundled.

Cart and order use two configurations of the **same Walnut SKU**: **“Asha”** and **“Kabir”**, Sans, centered front engraving, quantity one each. Text surcharge is ₹0. Each remains a separate item. Merchandise is **₹2,580**, illustrative shipping **₹80**, total **₹2,660**. The included ₹405.76 tax is a fictional supplied quote component, not added again or offered as tax policy. Availability, prices, taxes, rates and payment eligibility must be server-authoritative in implementation.

The invalid `Asha ✦` edit preserves all six entered graphemes and shows the exact disallowed symbol. Its preview explicitly shows the previous valid “Asha”. The correction route reaches the reviewed “Asha” configuration. Cart’s failed “Kabir-Rae” edit retains that draft while the accepted line remains “Kabir”; checkout waits for resolve/cancel. Review/pay’s unknown result reconciles the original attempt before another commitment. The later owned order `MY-1042` depicts the same accepted item snapshots reaching the merchant, with production not started and no invented delivery estimate.

All names, `asha@example.test`, the Example Lane / Sample Nagar address, order and quote are fictional. No actual phone number, credentials, signed preview URL or bearer token is included. Prices and order statuses are visual fixtures, not real merchant/provider facts.

## Identity and checkout boundary

Scenes 10/11 follow the coordinator’s 23 October [identity source reference](../../../../../implementation/niche-theme-programme/IDENTITY_REFERENCE.md) and actual `apps/platform/identity/src/app/buyer/authorize/authorize-client.tsx`: email/password, signup minimum eight characters, configured bot check → identity session → explicit **Continue to MadeYours**, signed-in email disclosure and **Use a different account** → validated authorization redirect. Credential submission does not automatically return to the storefront. The authorization code is not a user-entered email verification code.

Separate verify-email APIs exist but are not inserted as the automatic next BuyerAuthorize page. The depicted password-recovery supplementary source follows `buyer/recover/page.tsx` conceptually; it sends nothing. No required marketing checkbox, new identity policy or separate theme issuer is invented. Actual browser signup/challenge/return still needs implementation acceptance.

Checkout is the shared hosted origin with permitted **data-only branding** (wordmark/color/font), not injected merchant CSS or theme-specific payment logic. Its quote and mock-provider labels are explicit. The online method and unavailable COD state are fixture eligibility, not unconditional production options. Account/order pages express MadeYours while retaining the one canonical buyer account and server-resolved storefront scope.

## Capability and implementation handoff

The full [A–E matrix](capabilities.json) records purpose, source, owner, support, missing contract, error/empty behavior, security, dependency and acceptance for every proposed feature. Principal dependencies:

- **A:** canonical catalog/variant/price primitives, basic navigation/search, hosted checkout and buyer account owners. This is source support, not new end-to-end certification.
- **B/C:** versioned nova composition, safe niche hydration, product-defined method/limit facts, real method/price facets and editor bindings.
- **C/D:** normalization and server validation, accepted configuration hash/version, distinct line identity, edit/reprice/idempotency, cart-bound checkout contents, immutable per-item order snapshot and merchant fulfillment readback; merchant production/change/returns policy where a decision is missing.
- **E:** file uploads, proof approval, automatic bundles and new operational systems.

The public configurator cannot launch until the C/D chain is proven. Do not claim completion by hiding configuration. Extend existing commerce-core/shared-types/checkout-core, gateway cart/checkout/order, Liquid/islands and merchant order views once the coordinator assigns shared owners. No production files, migrations, lockfiles, shared generators, programme indexes or other themes were changed by this chat. Keep the existing stable `nova` identity and version the new design; do not overwrite merchant drafts/releases.

Required future proof: permitted/disallowed/overlong/Unicode text; malicious markup; missing schema; two same-SKU configurations; edit/reprice; stale schema/stock; lost response and concurrent retries causing one effect; cart→signed checkout→immutable order→merchant readback; wrong-tenant/buyer denial; install/editor persistence/publication/recovery; real query facets; actual signup/consent return; assistive technology and performance. Mockups do not supply those proofs.

## Research comparison and limits

[Origin and Tinker side-by-side review](comparisons/index.html), [PNG](comparisons/research-side-by-side.png), [neutral structures](comparisons/neutral.html), [neutral PNG](comparisons/neutral-structure.png). Saved captures are dated 22 October 2026 with exact 1440×1000 and 390×844 DPR1 states. Current public home/product text was rechecked through the web tool; Tinker’s collection could not be retrieved, so no fresh collection behavior is claimed. Some saved reference media was unloaded, explicitly disclosed. No remote store was modified and no purchase was attempted.

Source-grounded research includes the Nova blueprint, shared matrix/root-cause/portfolio/capability/implementation/acceptance/UX records, relevant Origin/Tinker/Atelier dossiers, identity/admin chapters and the preserved Threadline storybook and implementation record. Threadline is a method/integration reference, not proof MadeYours works. These comparisons are expert hypotheses, not measured conversion or merchant usability outcomes.

## Reproduction and scope

Execution: one theme agent; no subagents or extra chats. The owner-authorized programme permits task-scoped reporting to Themes, verified from the original user attachment. Coordinator: `01a164a4-a342-76d3-ab33-65e021ed57db`; this chat: `01a164ba-e017-7b90-9053-efc5357459a6`. Source baseline: branch `letbuyy/theme-release-performance-resume`, HEAD `85aac990`; extensive existing unrelated changes were preserved.

Use `python3 source/build-storybook.py` after icon generation. `node source/capture.mjs` runs exact local exports, `--stress` checks reflow and `--identity` refreshes scenes 10/11 and `--corrections` refreshes 07/10/11 with merged audit records. Local Chromium requires the supported sandbox escalation on this macOS host, `chromiumSandbox:true`, and a coordinator capture slot. Never use a user profile or disable TLS checks. Packaging uses bundled Python/Pillow (`source/package-storybook.py`). `source/qa-extra.mjs` captures the comparison/reference evidence and limited keyboard checks. `source/validate-storybook.py` independently validates this artifact folder; the coordinator’s separate `verify_mockups.py --theme madeyours` audits it without writes outside this folder.

Browser slot 2 was explicitly released after final captures. No user/IAB/Threadline tab, database, container, shared port or production source was used. The storybook is ready for independent programme review. Milestone 2 waits for the coordinator’s all-nine milestone completion dispatch; no hosted deployment is claimed.

## Profile follow-up, 23 October 2026

Coordinator source review identified that the supported buyer profile edits are full name/phone, with sign-in email displayed as text. Scene 12 is corrected to retain name editing and show email as plain read-only text; no email-change verification flow is promised. This bounded follow-up refreshed only scene 12 device exports and its board/ZIP. All other 42 PNG and 14 board hashes are preserved. Rendered assertions pass at all three exact viewports; [correction proof](comparisons/profile-correction-proof.json) and [DOM audit](comparisons/profile-contract-audit.json) record the result. The read-only [implementation inventory](implementation-impact-inventory.md) records exact current owners, gaps and planned tests.
