# Merchant Growth Journey redesign — 24 October 2026

The owner explicitly requested replacement of the journey system and its unprofessional-looking photos. This supersedes the earlier timeline/scroll-preview presentation, not the separately approved closing growth CTA.

## Implemented

Replaced the five long scroll sections, sticky dashboard previews and mobile accordion with one visitor-controlled five-chapter walkthrough. The same five stages and module order survive: Launch Store → First Order → Scale Operations → Build Brand → Enterprise. All five selectors remain visible, using short labels on narrow phones. A single selected chapter pairs a purposeful retail illustration with customer-friendly copy and three concrete tasks. Desktop uses an illustration/copy split and three task columns; phones place smaller artwork beside the heading, full-width description below and tasks in one column. Content determines height; there are no viewport-sized timeline gaps.

The five real tab/tabpanel relationships have a single selected and tabbable tab, hidden inactive panels, arrow-key wrapping and Home/End support. Previous/next buttons move to adjacent stages, stop at endpoints and return focus to the newly selected tab. There is no automatic stage switching, hover selection, forced scroll, sticky observer or animation frame polling. Transitions are brief and respect reduced motion. The existing growth card, its full copy, branded storefront, background, four highlights and CTA destinations were copied unchanged into the redesigned component. Section position and #merchant-journey anchor remain unchanged. Capability-map carousel behavior is unrelated and untouched.

The former sample dashboards and their fabricated activity metrics were replaced by practical task explanations; no merchant data is presented as live. Tools remain qualified by plan/setup, with payment, shipping and live email provider requirements stated. No backend, auth, money, runtime or schema behavior changed.

## Artwork

Reused the approved LetBuyy storefront for Launch Store. Built-in image_gen produced four coordinated transparent, tactile retail illustrations for the remaining stages: a first-order packing arrangement; an organised stockroom/scanner; thoughtful brand packaging; and multiple retail counters with a shared stockroom/tablet. They replace the human merchant photographs. Full prompts, saved generation sources, intended sizes and decorative semantics are in `apps/marketing/web/public/illustrations/journey/stage-artwork-manifest.json`.

Each shipped WebP is 640×640 with alpha 0–255. Bytes: first order 72,054; scale 82,178; brand 81,462; enterprise 78,566. Total new image payload 314,260 bytes, loaded lazily only for the active chapter. Original generated PNGs and prior photographs remain retained; old photo paths have no runtime references in MerchantJourney. Source images and representative encoded artwork were inspected. Sharp was used only to resize and encode, preserving alpha.

## Validation

TypeScript, focused ESLint, strict CSS lint and whitespace checks pass. All 30 marketing/federation tests pass, including three new keyboard-navigation regressions covering both wrap directions, Home/End, and ignoring reading/scroll keys. Production build passes with all 494 pages. Built HTML has five tabs, five corresponding panels and one selected tab; it references the approved illustration and preserved closing card, with no former journey photo paths.

Before removing the obsolete mock-preview stylesheet block, source inspection found 269 former preview/timeline class names with no remaining references outside the old stylesheet. Removed 2,170 lines of those unused styles and the superseded timeline layout; subsequent CSS lint and production build pass. Unrelated dirty repository work was preserved.

The local browser tool still reports local access disabled in Work settings. Consequently native tab focus, pointer/touch behavior, layout at actual device widths, text zoom, light/dark contrast and composed visual finish have not been browser verified. Pure keyboard-index tests do not certify the rendered tab widget. No new website screenshot is claimed; prior timeline screenshots/evidence describe the superseded UI. Preview remains running on port 9006. No commit, push or deployment was performed.


## Mobile card compaction — 26 October 2026, 09:07 feedback

Compacted only the <=767px chapter presentation: 12px inset, smaller tabs and artwork beside the headline, full-width description, tighter task spacing and footer. Preserved all five stages, fifteen tasks and navigation; navigation targets remain at least 44px. The image sizes hint follows the 72px mobile artwork slot. At 429px width the workspace decreases from 693.29px to 494.30px (29%). At 390×844, each of the five selected stages measures the same 496.88px and exposes three tasks. No fixed-height clipping or internal scroll area was introduced; the narrowest 320px phone naturally wraps to a taller 587px card.

Browser checks used a temporary same-origin iframe at 320×568, 375×667, 390×844, 430×932, 640×960 and 1280×800: zero horizontal document overflow, mobile tab targets at least 55px, all five selections working. These are browser CSS viewport checks, not physical-device certification. Screenshot: journey-mobile-compact-2026-10-26.jpg. Raw readings: mobile-card-compaction-checks-2026-10-26.json. The fixture and its browser tab were removed. Production build/TypeScript (497 pages), strict CSS lint, focused MerchantJourney ESLint, all 184 current tests and whitespace validation pass. No commit, push or deployment.
