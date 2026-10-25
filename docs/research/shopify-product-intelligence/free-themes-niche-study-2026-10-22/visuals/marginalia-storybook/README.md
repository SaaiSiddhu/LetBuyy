# Marginalia — responsive design storybook

**Milestone 1 pack ready: 45 PNGs +15 additional boards; artifact checks and author visual review passed. Coordinator portfolio acceptance pending.**

**Design reference v1, prepared 22–23 October 2026 (Asia/Kolkata).** Stable preset identity `dawn`. Proposed explicitly selected package version; existing installations/releases must remain unchanged. Milestone 1 only. No production theme, API, identity, schema or editor changes are included.

[Open the 45-image gallery](index.html) · [Download the 45 PNGs](Marginalia-45-mockups.zip) · [Editable responsive sources](prototype-index.html) · [Research comparisons](comparisons/index.html) · [Neutral task comparison](comparisons/neutral-structure.html)

## Shopping direction

Find a title, author or subject; identify the correct binding, language and edition before purchase. The homepage starts with search and a subject index. Catalog entries use narrow, uncropped covers and bibliographic rows. The product page gives edition selection its own hierarchy, followed by synopsis, an original permitted text excerpt and exact bibliography. Stationery uses paper weight, dimensions, ruling, page/sheet count and included contents rather than book fields. The neutral structure retains these differences without brand, color or photography.

This is a coherent presentation source, not another storefront runtime. Scenes 01 and 02 are the two parts of one homepage; 04–06 belong to one PDP and its continuation. Their repeated headers/context make standalone references legible; implementation must not introduce duplicate home/PDP routes or headers.

## Fifteen connected scenes

| # | Scene | Desktop | Tablet | Mobile | Board |
| --- | --- | --- | --- | --- | --- |
| 01 | Home: search and subjects | [PNG](images/01-home-top-desktop.png) | [PNG](images/01-home-top-tablet.png) | [PNG](images/01-home-top-mobile.png) | [PNG](boards/01-home-top.png) |
| 02 | Home: reading table and paper | [PNG](images/02-home-bottom-desktop.png) | [PNG](images/02-home-bottom-tablet.png) | [PNG](images/02-home-bottom-mobile.png) | [PNG](boards/02-home-bottom.png) |
| 03 | Edition-aware books collection | [PNG](images/03-collection-desktop.png) | [PNG](images/03-collection-tablet.png) | [PNG](images/03-collection-mobile.png) | [PNG](boards/03-collection.png) |
| 04 | PDP: edition and purchase | [PNG](images/04-product-main-desktop.png) | [PNG](images/04-product-main-tablet.png) | [PNG](images/04-product-main-mobile.png) | [PNG](boards/04-product-main.png) |
| 05 | PDP: excerpt and bibliography | [PNG](images/05-product-facts-desktop.png) | [PNG](images/05-product-facts-tablet.png) | [PNG](images/05-product-facts-mobile.png) | [PNG](boards/05-product-facts.png) |
| 06 | PDP: stationery and policies | [PNG](images/06-product-continuation-desktop.png) | [PNG](images/06-product-continuation-tablet.png) | [PNG](images/06-product-continuation-mobile.png) | [PNG](boards/06-product-continuation.png) |
| 07 | Cart and recovery | [PNG](images/07-cart-desktop.png) | [PNG](images/07-cart-tablet.png) | [PNG](images/07-cart-mobile.png) | [PNG](boards/07-cart.png) |
| 08 | Shared checkout: address | [PNG](images/08-checkout-address-desktop.png) | [PNG](images/08-checkout-address-tablet.png) | [PNG](images/08-checkout-address-mobile.png) | [PNG](boards/08-checkout-address.png) |
| 09 | Shared checkout: review and retry | [PNG](images/09-checkout-review-desktop.png) | [PNG](images/09-checkout-review-tablet.png) | [PNG](images/09-checkout-review-mobile.png) | [PNG](boards/09-checkout-review.png) |
| 10 | LetBuyy buyer sign-in | [PNG](images/10-sign-in-desktop.png) | [PNG](images/10-sign-in-tablet.png) | [PNG](images/10-sign-in-mobile.png) | [PNG](boards/10-sign-in.png) |
| 11 | LetBuyy create account and Continue | [PNG](images/11-sign-up-desktop.png) | [PNG](images/11-sign-up-tablet.png) | [PNG](images/11-sign-up-mobile.png) | [PNG](boards/11-sign-up.png) |
| 12 | Profile overview and name editing | [PNG](images/12-profile-desktop.png) | [PNG](images/12-profile-tablet.png) | [PNG](images/12-profile-mobile.png) | [PNG](boards/12-profile.png) |
| 13 | Owned store order history | [PNG](images/13-orders-desktop.png) | [PNG](images/13-orders-tablet.png) | [PNG](images/13-orders-mobile.png) | [PNG](boards/13-orders.png) |
| 14 | Owned order detail | [PNG](images/14-order-detail-desktop.png) | [PNG](images/14-order-detail-tablet.png) | [PNG](images/14-order-detail-mobile.png) | [PNG](boards/14-order-detail.png) |
| 15 | Addresses, validation and default | [PNG](images/15-addresses-desktop.png) | [PNG](images/15-addresses-tablet.png) | [PNG](images/15-addresses-mobile.png) | [PNG](boards/15-addresses.png) |

## Source, fixtures and provenance

`source/build.py` writes the fifteen HTML pages from one presentation system; `source/styles.css` governs their responsive geometry and semantic roles. `source/interactions.js` demonstrates native mobile menu dismissal, disclosure and local edition styling. These are visual controls; they do not persist data, query APIs, send credentials, create a cart or authorize payment. The bag/order scenes remain the named fixed paperback fixture. Secondary product/author links often lead to the representative PDP/collection; production must bind actual resource IDs and URLs. Filters/sort, quantities, cart retry, payment, profile and address saves are proposed appearances that require canonical integration. No prototype state is transaction evidence. Scene08 deliberately shows a missing-phone validation state and disabled Continue; the canonical client requires a valid phone. Scene09 represents the later valid review state without exposing a phone value. No phone number is fabricated or submitted.

[Fixture registry](source/fixtures.json): one English first-edition paperback at ₹480 plus two A5 blank notebooks at ₹320 each gives **₹1,120 subtotal**. Example shipping ₹60 gives **₹1,180 total**. The ₹68.57 included-tax line is part of that fixture, never added again; it does not set production tax policy. MG-1042 uses the same line items and totals. Mock payment/fulfillment status is labelled. All identity/address/order records are fictional, with `reader@example.test`; no credentials, codes, bearer links or actual PII are present.

Three original built-in imagegen assets are reused consistently: two fictional covers and one notebook photograph. [Exact prompts and source paths](generation-prompts.json) preserve provenance. No CLI/API fallback was used. Cover type is decorative original product art; essential title/author/edition information is crisp native text beside it. The notebook photo illustrates the same item open and closed; each unit contains **one** notebook and excludes the pencil. Paper weight is supplied fixture data, not inferred from the image. The excerpt is original prose authored for this pack, not a quotation from a real book. No ISBN was supplied, so the interface omits that optional field.

Lucide SVGs are the same installed Lucide React renderings used by the permitted reference pack, not a new icon family. LetBuyy’s light-header logo is copied from `apps/platform/identity/public/icons/letbuyy-logo-light.svg`. The white-wordmark dark-header asset was rejected before capture. Font files are local copies from Google Fonts, with `font-display:swap`; provider URLs are recorded in `assets/font-provider.css` / `source/font-downloads.json`. Libre Baskerville 400/700 and Source Sans 3 400/600/700 are used. **Explicit font difference:** the blueprint calls its body registry `Source Sans Pro`; this local pack uses the current downloadable `Source Sans 3` distribution. Production must reconcile the existing font registry explicitly, not silently rename it. No shared font registry was edited. System script fallback is used for Hindi stress tests; other merchant languages still require their own glyph and content review.

## Design specification

| Role | Value |
| --- | --- |
| Canvas / surface / secondary surface | `#FAF6EA` / `#FFFFFF` / `#EDE5D1` |
| Text / supporting text | `#30291E` / `#6B5C45` |
| Action / action label | `#744A26` / white |
| Essential boundary / decorative divider | `#867354` / `#B9AB90` |
| Focus | `#005FCC`, 2px ring with 4px offset |
| Error / error surface | `#B42318` / `#FFF4F2` plus words |
| Success | `#166534` plus text/icon |
| Warning / warning surface | `#7A3E00` / `#FFF4CE` plus text/icon |
| Selected | Explicit radio/check and essential border; selected edition text remains visible |
| Disabled | Secondary surface + labelled unavailable/disabled control |
| Density | 1240px desktop content; 56/36/28/20px responsive gutters; 24–64px section rhythm |
| Typography | Desktop display 46–52px; section 29–36px; product 38px; mobile display 31–37px; body 16–17px; readable facts 14–17px |
| Imagery | Books 2:3 contain; stationery 1:1 contain; excerpt native text; no artwork crops |
| Motion | No autoplay/automatic page turning; reduced-motion rule disables smooth scroll |

These are theme presentation defaults only, subordinate to the current `@letbuyy/ui` token authority and validated storefront settings mechanism. Credential pages use current canonical LetBuyy admin/light identity colors: primary brandInk800 `#2C2642`, link brandInk500 `#523F97`, focus brandInk400 `#6C54C4`, with neutral surfaces. Identity body font is the same local Geist Sans binary as `apps/platform/identity/src/app/layout.tsx`, copied from `packages/typescript/ui/assets/fonts/geist-sans-latin.woff2`. Source baseline: `apps/platform/identity/src/app/globals.css` and `packages/typescript/ui/src/tokens.ts` adminSurfaceIdentity, observed 23 October 2026. Historical bright-purple reference styling is superseded. Checkout is a reference for the existing data-only branding contract: merchant name/palette/declared font mapping only, no arbitrary CSS or executable merchant input. Dark-mode production conformance is not certified by this light-mode pack.

Tablet retains bibliography context, converts result prices to the text column and stacks checkout summary. Review/pay uses a single DOM summary before payment; tablet/mobile place the full quote and total before payment choices and the commitment button. Mobile prioritizes search, uses a reversible menu, stacks subject discovery and purchase sections, preserves cover/text result rows, switches profile navigation to a wrapped row, and uses single-column forms. Nothing is a shrunk desktop export.

## Capability handoff — A–E

Classes match the shared research ledger: A existing canonical primitive, B exists but target wiring incomplete, C bounded extension, D content/policy decision, E deferred/outside scope. They are source support assessments, not production certification.

| Capability / scenes | Class | Required owner and implementation gate |
| --- | --- | --- |
| Versioned Marginalia composition, install/editor/preview/release | B/C | `theme-engine` + existing theme execution. Explicit version, bibliographic list/reading layout enum, unchanged saved instances/releases. Prove exact install → saved draft → preview → immutable release. |
| Title/price/media/variants and server stock | A | Canonical shared-types/commerce-core/cart; preserve selected edition SKU through cart/order and stock race. |
| Author/subject/language/format/edition/pages/publisher/dimensions | C | commerce-core bounded book facts + merchant editor + explicit allowlisted public Liquid projection. Generic metadata alone is insufficient. Unknown optional fields omitted; no guessed ISBN. |
| Subject/author/language/format sorting/facets | A basic search; C niche facets | Existing gateway paginated query owner. Real URL round-trip, result counts and indexed bounded filters before controls ship; hide unavailable facets. |
| Notebook gsm/size/pages/sheets/ruling/binding/contents | C | Same validated niche facts/projection owner. Distinguish units, verify 96 pages = 48 sheets, and do not infer ink compatibility. |
| Excerpt and author/editorial content | A text primitive; C bounded excerpt layout; D rights | Merchant supplies permission and content. Original fixtures are permitted here. Sanitization/escaping, text limits, safe reading layout; no scanned-page/digital reader. |
| Related items | A bindings; B target wiring | Independent product links/prices only. No automatic bundle or combined stock promise. |
| Cart/quote/hosted checkout/payment eligibility | A/B | Existing cart/checkout-core/gateway. Server total, stock, tax, shipping, eligible Razorpay/COD, idempotency; mock badge. No theme-owned payment logic. |
| Buyer sign-in/register/explicit Continue | A | Sole identity-platform buyer authorize flow, safe return/PKCE. Current email/password with signup min8; configured bot check. Sign-in/register creates session; only explicit Continue authorizes return. |
| Separate optional email verification | A API; B UI | Separate six-digit verify-email APIs exist; not represented as mandatory next signup screen. No automatic email/verification link invented. |
| Profile/orders/addresses | A/B | Existing canonical buyer account owners and store scope. Preserve address book vs immutable order snapshot; verified ownership, never email-only authorization. Mockup forms do not prove persistence. |
| Merchant policies/shipping/delivery | A policy/rate primitives; D merchant facts | Bind published merchant policies and actual server eligibility. No guaranteed dispatch/delivery claim; no estimated date supplied in fixtures. |
| Reviews / ratings | B, omitted | Only publish actual moderated data if later wired. No fabricated ratings in this pack. |
| Digital DRM/course marketplace, uploads, third-party checkout extensions | E, excluded | Outside bounded print/stationery mission; no implementation proposed. |

[Additional state sheet](source/states.html) covers empty catalogue, zero query matches, missing media/critical edition facts, loading and failed retrieval. These are extra visual states, outside the required 45 images.

## Verification and limits

[Actual viewport audit](responsive-audit.json), [export manifest](exports.json), [artifact validation](validation.json), [stress audit](comparisons/stress-audit.json) and the actual PNGs are the evidence. Board files are additional and do not count toward 45. Source links, genuine PNG signatures/dimensions/decoding, current ZIP bytes, arithmetic, image/font readiness and overflow are checked by the pack scripts and coordinator audit.

The completed local audit covers45 exact-viewport exports,30 extra stress records (15at320px,8at200%text,5Hindi/reduced-motion,2combined180-character+200%tests),11explicit contrast pairs, and local menu/disclosure/validation probes. [English long-title capture](comparisons/03-collection-180char-en-text200.png) and [Hindi long-title capture](comparisons/04-product-main-180char-hi-text200.png) preserve actual390px screenshot width. Enlarged-text headers may wrap the wordmark; essential shopping content stays in the page. No universal accessibility conformance is claimed.

The production lifecycle, real query-backed filters, checkout payment, credential submission, account persistence, full assistive-technology accessibility, physical touch ergonomics and production performance remain implementation acceptance. This artifact's font/image readiness does not certify production font delivery. Visual-only error states are not provider failures actually exercised. No runtime build, destructive validator, database, production mutation, push or deployment was performed to produce this pack.

Read the programme’s identity correction at `docs/implementation/niche-theme-programme/IDENTITY_REFERENCE.md` and the actual `apps/platform/identity/src/app/buyer/authorize/authorize-client.tsx`. Scene 11 intentionally shows account creation followed by an explicit labelled Continue state; the OAuth authorization code is not an email verification code. Scene 12's verified-email badge is a fictional existing-account state, not a registration prerequisite. Its email field is read-only; Save name edits only the supported display-name field, without implying an email-change workflow.

Source-derived governance checks that can clean shared build outputs are not run from the dirty shared checkout. The coordinator owns programme-wide governance/snapshot qualification. This pack's scope is solely its assigned research subtree, with independent artifact validation; it does not claim a fresh production governance pass.

Execution mode: single agent within this chat. No subagents or extra chats created. The owner-authorized coordinator communication is verified against the original human attachment recorded by the programme hub. All unrelated Threadline, merchant, other-theme, runtime and database work is preserved. Implementation awaits the coordinator's Milestone 1 completion dispatch for all nine packs.

## Rebuild the local artifact

From this repository's existing environment:

```sh
/Users/saai_mithra/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/marginalia-storybook/source/build.py
node docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/marginalia-storybook/source/capture.cjs full
/Users/saai_mithra/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/marginalia-storybook/source/package.py
```

Headless capture uses the existing root `@playwright/test`, `chromiumSandbox:true`, a fresh profile, and local files only. macOS requires the bounded supported sandbox escalation for Chromium launch. Reserve the programme capture slot first; no user browser state or Threadline tab is involved. Source/profile/device captures are reproducible; no runtime package installation is required.

Starting checkout: `/Volumes/Projects/LetBuyy`, branch `letbuyy/theme-release-performance-resume`, HEAD `85aac99043d8dc10469e12cbb810609a3b6f1b0d`. This is the observed source baseline, not a clean-worktree claim. Relevant governing constraints are Constitution ART-14/17/18/20 and Amendment 3, plus AGENTS THEME-R1–6, WIN-R4, CODE-R6/7, UI-R4/6 and DOC-R3. Saved Shopify findings and the Threadline implementation README are dated evidence; the latter remains acceptance-open. Existing Threadline temporary resources, runtime ports, browser tabs and fixture files were not used.
