# Liquid guide enhancement and shared artwork loading — 25 October 2026

Owner requested missing recommendation/cover images fixed, illustrations inside the Liquid guide, and improved typography. Used the explicitly invoked web-ui-ux-system skill and existing project illustration assets. No article data, prose, code, routes, or platform behavior was removed or rewritten.

`ResourceArticleArtwork` now uses eager, direct delivery of the existing optimized WebP assets for both covers and recommendations. Theme hero/section images use the same reliable local delivery. This completes the earlier theme-preview fix at the shared resource-artwork boundary, avoiding the stalled lazy/Next optimizer request seen in the owner's browser.

The Liquid guide has a scoped illustrated layout using the existing ArticleBody renderer: template/output examples, six object-reference cards, a theme-layer diagram, and two premium section illustrations. Existing cover artwork is reused. Heading scale and spacing are more compact; mobile body text is 16px and code is 14px using canonical tokens and existing Inter/monospace families. The five original chapter IDs, reading controls, author details, related content and code examples remain. Only the Liquid guide receives its new reading style.

Fresh verification:

- Compared all 23 original text/code/list/callout items to the rendered article: none missing. Both original code blocks retained exactly; no duplicate IDs, one main landmark.
- Browser widths 320, 390 and 1280: no horizontal overflow. Verified 16px mobile paragraph text and 14px code. Architecture anchor lands approximately 160px below the viewport top, clear of navigation. Both in-body image assets are loaded.
- Fresh theme-guide visit: all three recommendation images report complete and nonzero natural width, direct WebP source, and eager loading. Liquid cover also reports loaded from its direct source.
- Targeted ESLint: exit 0, one existing unused getDifficultyLabel warning in the article route. Marketing typecheck and CSS stylelint: exit 0.
- Existing federation/marketing suites: 4 + 56 tests pass, no failures (`/tmp/letbuyy-liquid-enhancement-tests.log`).
- Relevant governance checks: design-system and single-token-source validators both pass. The design-system ratchet excludes marketing from its drift counts; marketing CSS is checked separately with stylelint. Earlier full-suite result remains 110 pass / 4 unrelated failures; it was not rerun because its cleanup removes active dev dependencies/build output.
- Production build: exit 0 (`/tmp/letbuyy-liquid-enhancement-build.log`). Marketing preview briefly stopped for the build and restarted on its existing port 9006; no package install or dependency changes were needed.

Screenshots in this directory: `liquid-enhanced-desktop.jpg`, `liquid-enhanced-syntax-mobile.jpg`, `liquid-enhanced-section-artwork.jpg`. No newly generated bitmap assets. Temporary verification browser tabs are closed and viewport overrides reset before handoff. No push or deployment.
