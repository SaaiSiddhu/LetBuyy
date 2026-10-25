# Kindred · ready-made gifts and occasions

Milestone 1 visual reference, design version 1.2 · identity/profile corrections 23 October 2026 (original pack 22 October 2026) (Asia/Kolkata). **45 independently rendered PNGs, 15 additional device boards, editable responsive HTML/CSS, original gift imagery and a current-image ZIP.** This is a proposed explicitly selected Summit design version. No installed theme, release, application, database, live identity, provider or merchant state was changed.

Open [the storybook](index.html), [responsive source index](prototype-index.html), [45-PNG ZIP](Kindred-45-mockups.zip), [research comparisons](comparisons/index.html), [neutral task structure](comparisons/neutral.html), [recovery states](comparisons/states.html), [actual export measurements](responsive-audit.json) and [artifact validation](validation.json).

## Direction and connected journey

Kindred helps a buyer **find a ready-made gift by occasion, recipient and budget, then verify exactly what arrives**. Its opening is a gift finder, followed by an occasion index. The collection places independent query choices beside a small curated gallery. Cards expose count, suitability copy, price and the supplied packaging label. The product centers an open/closed box pair, a countable contents list and real packaging SKUs. It offers no build-a-box, gift-message or personalized-production control.

The 15 scene IDs and intent are in [scenes.json](scenes.json). Scenes 01/02 are two review boundaries of **one homepage**. Scenes 04/05/06 are selection, contents and continuation of **one PDP**, using product anchors/states in implementation. Repeated standalone screenshot headers are context, not duplicate production headers or routes. The second catalog product is an independent related-set reference; its source links reuse the illustrated continuation rather than claiming a second fully designed PDP.

Gift discovery differs from Playfield’s age/activity/physical suitability and MadeYours’ validated production input. This is a ready-made catalog: recipient is a merchant-authored suitability label, not inferred personal profiling. The [original neutral study](comparisons/neutral-structure-desktop.png) removes branding, photography, decorative type and color. Portfolio-wide pairwise judgment remains coordinator-owned; no user-study or conversion result is claimed.

## Fictional fixture contract

| Product / option | SKU | INR | Fixed contents |
| --- | --- | ---: | --- |
| Little Pause · Blush gift box / ivory ribbon | KP-BLUSH-01 | ₹1,790 | 1 ivory 300 ml ceramic mug, 1 sage A5 96-page lined notebook, 1 brass black-ink ballpoint pen |
| Little Pause · Kraft gift box / no ribbon | KP-KRAFT-01 | ₹1,590 | Same three contents; packaging is an actual variant |
| Little Pause · Moss gift box / unavailable | KP-MOSS-01 | ₹1,790 | Unavailable named option; cannot submit |
| Desk Companion · Kraft gift box / no ribbon | KD-KRAFT-01 | ₹1,290 | 1 terracotta A5 notebook, 1 brass pen, 1 off-white cotton pouch |

The captured cart has **one KP-BLUSH-01 + one KD-KRAFT-01 = ₹3,080**, fictional shipping ₹80, **total ₹3,160**. Applicable taxes are included in the item prices; no additional tax or platform transaction fee is introduced. Checkout and order #KD-1042 use the same exact lines, quantities, packaging and totals. Payment/fulfillment surfaces are explicitly mock fixtures. A processing/paid mock order is a visual example, not a transaction result. No delivery estimate, scarcity, rating, certification, health claim or merchant policy is fabricated.

Asha Sample, `asha@example.test`, `kindred.example.test`, `hello@kindred.example.test` and 12 Example Lane are fictional/reserved-domain fixtures. No phone number, password, bearer URL, private preview token or real PII is stored. Address edit intentionally shows invalid PIN `5600` while the saved default remains `560001`.

## Visual specification

- **Canvas/surfaces:** warm ivory `#FFFAF4`, white, paper `#F2E7DF`, blush `#EED9D4`. Main text `#342C2C`, support `#6C5B59`, essential input boundary `#8A716B`, separators `#CBBAB4`.
- **Action/link/selected:** plum `#662E42` on white or ivory; white action text. Focus `#005FCC`; error `#A32323`; success text `#33513D` on sage. Unavailable options keep their names and a disabled radio plus explicit text. Color never carries selection or status alone.
- **Typography:** Playfair Display 400/500 and Lato 400/700. The local pinned font files make exports reproducible. Display 56/1.08 desktop, 43/1.08 mobile; body 16/1.55; support generally 13–15. Compact metadata 11–12 is supplementary. Heading/body fallback stacks include serif/sans script fallbacks. Canonical identity uses the current platform admin/light brand-ink roles, local Geist Sans body/headings and LetBuyy credential branding.
- **Composition:** 1200px content, 58–64px desktop sections, 35–42px mobile sections, 24–32px card gaps, 6px controls/9px media corners. These are design-reference values for the existing experience settings/token mechanism, not a competing production token authority.
- **Media:** original 4:3 full-object imagery, fixed space, meaningful alt text. Main gift/box imagery uses `contain`, so included objects cannot be clipped. No autoplay, motion carousel or sticky action bar is used.
- **Responsive:** desktop finder beside media and two-column collection; tablet navigation condenses, collection becomes one large card per row and content rails narrow; mobile puts introductory context, full set image, finder, facts and selection in a readable sequence. Mobile checkout shows the full order summary before payment/commitment. Account navigation becomes a two-column utility grid; address editing stacks below the saved address.

## Canonical boundaries and A–E dependencies

A = supported canonical primitive; B = existing but target wiring/evidence still needed; C = bounded extension; D = merchant/policy/provider decision; E = excluded/deferred. These are source support classifications, not deployment certification.

| Capability | Class / status | Implementation dependency and acceptance |
| --- | --- | --- |
| Versioned Kindred composition under `summit` | B/C, proposed | Canonical catalog/document builder, install/editor/release. Explicit opt-in; preserve existing Summit instances and **neutral unknown-industry fallback**. Never remap unknown merchants to gifts. |
| Product/media/price/options/availability | A | Bind real product and variant IDs through existing public exports and cart islands; server reprices/rechecks stock. |
| Occasion × recipient × budget discovery | C, proposed | Bounded gift taxonomy, allowlisted paginated query and safe Liquid hydration. Removing budget must retain occasion/recipient and browser query/back state. No inert production facets. |
| Fixed contents / suitability facts | C, proposed | Merchant entry, bounded validated gift namespace, sanitized projection into Liquid. Missing critical facts stay unknown. Image alone never establishes contents. |
| Packaging | A/B, fixture modeled as ordinary SKU | Keep packaging variant identity and price through cart, checkout, immutable order and merchant readback. No arbitrary surcharge/checkout field. |
| Gift messages | C/D, excluded from initial design | Needs typed scope/limits/encoding, persistence, retention and fulfillment readback. **No interactive message field exists anywhere in the pack.** |
| Build-a-box, personalization, uploads, recipient-return workflow | E / not offered | No parallel bundle engine, custom production contract or invented recipient authority. |
| Shared cart/checkout/payment | A/B | Existing server cart/quote, hosted checkout, eligible provider adapter, idempotency and data-only branding. The presentation source is not a separate cart or payment authority. |
| Buyer identity / registration | A, source inspected | `apps/platform/identity/src/app/buyer/authorize/authorize-client.tsx`: email+password, minimum 8 characters for registration, successful identity session, then explicit Continue to Kindred/email disclosure and Use a different account. Configured bot checks remain configuration-dependent; no completed challenge is impersonated. No merchant signup or inferred privilege. |
| Buyer email verification | A endpoints / optional separate UI, not depicted | Existing signed-in email-code endpoints: 6 digits, 10 minutes/5 wrong attempts; verify before linking prior customer records/orders. These separate APIs are optional and are **not an automatic mandatory next BuyerAuthorize page**. Scene11 instead depicts successful account creation followed by explicit Continue to Kindred / Use a different account. No automatic email, verification link or unverified sign-in restriction is asserted. |
| Profile / addresses / owned orders | A/B | Existing buyer data owners; reverify exact version/session/site isolation. Mock edit feedback is not persistence. |
| Shipping/returns/support terms | A content / D merchant policy | Actual server shipping result and merchant policy bindings before advertised commitments. No assumed arrival/refund entitlement. |

Canonical authorities remain Liquid/theme-engine, sole identity-platform, server cart/checkout/order, one ledger and tenant boundary. See AUTH-R1, WIN-R3/R4, THEME-R1/3/4, CODE-R6, CHK-R3 and IDN-R1. No architecture expansion or governance amendment is proposed.

## Prototype behavior versus implementation

The source provides native menu disclosure with Escape/focus return, independent filter chip clearing, variant-state illustration, local quantity arithmetic, field validation/retry feedback and navigable scene links. It sends no network mutation. Product links share one illustrated PDP; pagination is one real fixture page with unavailable previous/next controls. Query filters describe the two supplied synthetic gifts, not a real query service. Variant changes and cart/order source fixtures are not persisted between scenes; the captured journey consistently uses Blush. Local quantity/removal/status controls are **illustrative**, and deliberately never claim a server save. All must bind the canonical contracts above before advertised as working.

## Research and provenance

Read the shared study README, design matrix, root-cause analysis, niche portfolio, capability map, implementation plan, acceptance/limitations, UX resilience principles, Kindred blueprint and Craft/Taste dossiers. Identity/admin context comes from the identity-onboarding identity/login and surface/navigation chapters. The current Threadline storybook and implementation README informed method and integration boundaries. A `read_thread` call recovered its oversized recent turn; source records were used for bounded current claims. The original owner mandate is `/Users/saai_mithra/.codex/attachments/3bbd3b8f-2a90-40e2-8d7f-ce02bd968d9e/Pasted text.txt`; reporting authorization was verified there.

At least two saved primary/public Shopify references are visually inspected and attributed in [references.json](comparisons/references.json), with original side-by-side boards. The current public text was re-accessed on 22 October; search-tool crawl freshness varies and is not a fresh interactive browser claim. Taste’s saved PDP has incomplete main-image loading, recorded as a limitation. No Shopify photography, copy, logo or full composition is used in Kindred UI.

Three original product images were generated through **built-in image_gen**, then copied into `assets/` with complete [generation prompts](generation-prompts.json). The closed box is an illustrative exterior, not photographic proof of manufacturing dimensions. Fonts are pinned from Google Fonts with URLs/hashes in [font provenance](assets/font-provenance.json). Lucide SVGs were rendered from the existing `lucide-react` public exports using React server markup. LetBuyy’s existing logo is reused solely on canonical credential scenes. No separate icon library or copied commercial photos were added.

## Verification and limits

[Exports](exports.json) and [responsive audits](responsive-audit.json) record actual inner viewports **1440×1000**, **834×1112**, **390×844**, DPR1, scroll/document widths, image readiness, font faces and errors. Screenshots are independent full-page PNG renders; their height may exceed the viewport. Boards alone scale images for review. Additional [stress evidence](comparisons/stress-audit.json) covers all scenes at 320px, five high-risk scenes at 200% text sizing, Hindi content expansion, reduced motion and the two niche acceptance checks. Text sizing uses computed font doubling, not browser page zoom. Hindi review establishes local reflow, not linguistic review or every script’s glyph quality.

Full accessibility conformance, screen-reader behavior, real backend/persistence, exhaustive text zoom, dark appearance, production performance, provider/sandbox order completion, hosted deployment and production acceptance remain **unverified**. The original extra state sheet specifies honest empty/loading/missing/error recovery behavior. A polished screenshot is not proof of any of those contracts.

Only this assigned subtree was edited. The checkout was already dirty; no clean-production-diff assertion is made. Governance/build cleanup gates were not run in the shared checkout, following the coordinator’s `CAPTURE_AND_REVIEW.md` resource instruction. Artifact validation is fresh and separate; implementation gates belong to the eventual integrated source owner. No historical governance total is reused as a fresh result.

Reproduce with existing dependencies: `python3 source/build.py`; use the bundled Python with Pillow for `source/package.py` and `source/validate.py`; run `node source/capture.mjs` in a coordinator-approved isolated headless slot with `chromiumSandbox:true`. No dependency install, user browser profile, IAB tab, certificate bypass, production service or shared port is required.

Execution: one agent in this chat, no subagents/additional chats. Coordinator Themes `01a164a4-a342-76d3-ab33-65e021ed57db` owns programme records and the milestone exit. Production implementation waits for that dispatch after all nine packs pass; this folder remains available for review corrections.

## Identity review correction · 23 October 2026

Following the coordinator’s current `IDENTITY_REFERENCE.md`, scenes10/11 now label the post-sign-in/post-creation state and visibly show **Continue to Kindred**, the signed-in email disclosure and **Use a different account**. Scene11’s heading is **Create your LetBuyy account**. The earlier “Next: verify your email” panel was removed: email verification is a separate optional contract, not the next mandatory BuyerAuthorize state. OAuth authorization codes are not user-entered email verification codes. No identity production source or provider setting changed. Canonical credential colors were also refreshed from current admin/light tokens: primary `#2C2642`, hover `#362C58`, active `#181524`, page `#F6F7F9`, white surfaces, text `#111827`, subdued `#6B7280`, input boundary `#8F88A9`, focus `#6C54C4`; local Geist Sans follows identity layout.tsx. The old historical purple/Lato credential treatment is superseded. Only the six affected PNGs, their two boards, current ZIP, gallery metadata, audit evidence and handoff were refreshed; product imagery and unrelated exports remain unchanged.

## Profile review correction · 23 October 2026

Scene12 now displays the sign-in email as plain read-only text and preserves full-name editing. The unsupported email-change field and verification promise were removed. Current `LbCustomerSettingsElement.renderBuyer()` in `liquid-hydration-islands.tsx` displays email text; the buyer profile PATCH path accepts name/phone updates, not email changes. Three affected device exports, one board, the overview/current ZIP and audit evidence were refreshed under the coordinator’s concrete review exception. The other42PNG bytes are verified unchanged in profile-correction.json. The v1.1 frozen visual manifest is retained as history; this does not change production identity or profile behavior.
