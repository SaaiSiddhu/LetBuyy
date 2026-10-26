# Reader, homepage and navigation refinement — 26 October 2026

Owner steering, accumulated while work was active: improve every reading section's fonts/design; repair desktop homepage alignment; shorten the mobile footer; reduce purple/neon styling and improve text colors; remove header Start for free; compact and highlight the theme section; then use a Shopify-inspired preset gallery with a distinctive LetBuyy presentation. Strict UI-only scope, in existing isolated `codex/theme-marketplace-20261026` worktree, base `12e748708`.

Execution mode: SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO
Background agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO

## Implementation

- Shared article contents: native closed-by-default details on mobile, sticky contents navigation on desktop, real anchor links and retained directory/back links. The two responsive views have no duplicated target IDs. Clearer numbered guide sections, compact outcome summary, bounded64ch reader, intentional paragraph spacing, 16px body role and 20–24px headings. Legal section titles/body/status/versions remain unchanged. About, pricing, contact and support reading blocks share the same article typography.
- Font and color: bind the existing canonical display-font variable to the already bundled OFL-licensed Geist Sans asset; use it in marketplace content. Keep the existing body binding for navigation. Neutral text links and surface borders, restrained primary accents, no purple hero wash. Direct semantic heading colors fix the owner-observed white-on-light headings caused by root-scoped compatibility aliases. No new token source, font download provider or shared-package edits.
- Desktop homepage: meaningful two-column hero with photographic device preview, supporting note beside its related actions, aligned gutters and compact category tabs. Mobile keeps the content column without an extra illustration block. Animation sizing/controls remain unchanged.
- Footer: compact desktop columns and four native collapsed mobile groups, with retained navigation destinations, always available legal/privacy links, privacy-choice modal and support contact. Privacy clearing behavior is unchanged.
- Header: remove Start for free/signup CTA from both desktop and mobile only, per explicit later request; keep search, menus, login, library/logout and theme control. This supersedes the earlier instruction to leave header presentation unchanged for these two links.
- Theme section: a compact featured-card variant remains available; latest homepage steering uses the new preset-style gallery for the actual Core listing. Four scroll-snap preview cards use native radio selection, a small selection marker, captions and a details/action row. This is original frontend composition using existing sample photography, not copied Shopify assets.

## Preset honesty and scope

Read the existing theme metadata via GET: Core1.0.0 has `theme_preset_id=letbuyy-core-default`, no color presets/screenshots, and no customisable-section metadata in that response. The shared theme-engine source also states its ten Experiences now back independently discoverable themes; these must not be presented as ten ready Core presets. The gallery therefore distinguishes **one published preset** from **three illustrative style studies**. Selecting a study changes only local UI; it links to the customization guide. The actual default retains the real Core details route. No apply/install/save/publish action or backend architecture was added. Studies have no invented prices, reviews, merchant claims or stock availability.

## Verification

Package68 tests pass (source contracts24 + UI/API/session/render44). New regressions cover compact native contents, retained article anchors, collapsed footer groups/legal/privacy access, featured-card actions and honest preset/study distinction. Typecheck, production build, app lint (zero errors/seven existing warnings), changed CSS stylelint, design-system invariants/ratchet and whitespace checks pass. Existing auth/session/payment-related regression assertions remain intact.

Read-only HTTP audit covers42 public routes, all seven guides/ten legal documents and their anchors/review labels, nine protected canonical sign-in redirects, and static/optimized sample photos. Focused checks cover no header signup links, four closed footer groups, closed mobile reader contents, gallery controls and delivered responsive CSS. Browser/device/keyboard/zoom visual acceptance remains deferred under the owner's automated-only preference; a render/build/HTTP result does not certify exact visual layout or WCAG conformance.

Backend/API/client/services/database/config/marketing source is untouched. Root layout's only change is the display font asset binding; authentication logic is unchanged. Footer storage function and account return-URL behavior remain unchanged. No merge, push, deployment or external mutation occurred. Local preview: http://localhost:9005/.

Logs: `/private/tmp/letbuyy-reading-{build,types,tests,lint,css,design}.log`; HTTP result `/private/tmp/letbuyy-website-art-http-checks.json`; post-commit quick gate `/private/tmp/letbuyy-reading-close-20261026/`.

## Owner refinement: larger portrait mobile gallery

The owner found the gallery too rectangular/small, with a large blank/details area below, and requested a more mobile-oriented premium composition. Reworked the gallery into9:17 portrait frames with restrained device chrome and responsive76vw cards (capped320px) on narrow screens, leaving the following card partially visible. Wider screens retain larger portrait cards. Study typography scales inside the mobile frame. The published default still uses its actual listing image; it is not represented as a newly captured mobile screenshot. Studies remain explicitly illustrative.

Removed the image-covering Selected pill, heavy selection glow, repeated selected-title/description panel and full-width CTA. Selection uses the native radio state and a small caption dot; a compact toolbar provides a live page counter, real details/customization destination, and previous/next buttons. Buttons select and scroll only the horizontal track, respect reduced motion, and disable at the ends. The native horizontal scrollbar is hidden in favor of these controls and touch/keyboard access. Fieldset/legend remain semantic, with the scroll track inside the fieldset. Mobile section and following-journey padding are tightened. No preset, install or backend behavior changed.

Latest package68 tests, typecheck/build, app lint (same seven existing warnings), CSS stylelint, design-system ratchet and whitespace checks pass. Render regression now verifies portrait-frame markup, end-state previous-button disablement and absence of the former badge/details block. Focused HTTP checks verify the rebuilt homepage/card count/pager/links and delivered portrait/responsive/scrollbar CSS. Actual device appearance, touch scroll, focus and animated scrolling remain unverified under the standing automated-only preference. Logs: `/private/tmp/letbuyy-mobile-gallery-{tests,types,build,lint,css,design}.log`; post-commit gate `/private/tmp/letbuyy-mobile-gallery-close-20261026/`.

## Mobile catalog density and homepage section tones — 2026-10-26

Execution mode: SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO
Background agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO

Owner requested a smaller mobile catalog introduction, then clearer homepage section differentiation. Shorten catalog title/description/placeholder and Compare text (retain its full accessible label). Below48rem use a compact title/compare grid with safe wrapping for long queries, smaller heading/support copy, less page/header/tab spacing and a tighter search shell. Keep a16px semantic search input and canonical touch targets; hide only the redundant submit arrow. Desktop sizing remains unchanged; shared catalog copy is shorter. Search names, query values, hidden filters, category links and compare destination are preserved.

Add full-width homepage bands around existing aligned section containers: a softly lit accent gallery, base-tone journey/FAQ, stronger neutral resources/recent area and accent-tinted closing band, with visible semantic dividers. Hero uses the semantic surface tone. Backgrounds derive from current theme tokens rather than fixed black/white values; content/card layouts, gallery interaction, responsive widths, routes and data remain intact. No scroll scripting or animation added. Scope is the theme marketplace homepage, not the marketing landing page.

The first neutral blend reduced light-mode subdued-text contrast below4.5, so band supporting text now uses an80% text blend and the gallery eyebrow uses the primary-text role. Canonical token arithmetic checks of the featured gradient endpoints/resources backgrounds give supporting-text contrast6.84–11.21 and accent-text5.02(light)/8.22(dark). These are bounded sRGB colour calculations, not a browser accessibility certification.

Verification: package76 tests pass, typecheck/build/stylelint/design-system invariants and ratchet/whitespace pass; app lint has zero errors/seven existing warnings. Read-only HTTP confirms five active homepage bands, compact intro/search/compare, preserved query/free filter across three catalog variants, served responsive rules/gradient and Wi-Fi200. The initial served-CSS check assumed source media syntax/property order; compiled output lowers the media query and reorders declarations, so the probe was corrected to the delivered syntax. Browser/mobile visual acceptance remains deferred per owner instruction. No backend, schema, auth, shared package, marketing source or configuration change.

Logs: `/private/tmp/letbuyy-catalog-compact-{tests,types,lint,css,design,build}.log`, `/private/tmp/letbuyy-catalog-compact-http.json`, `/private/tmp/letbuyy-catalog-compact-contrast.json`; post-commit quick gate `/private/tmp/letbuyy-catalog-compact-close-20261026/`.
