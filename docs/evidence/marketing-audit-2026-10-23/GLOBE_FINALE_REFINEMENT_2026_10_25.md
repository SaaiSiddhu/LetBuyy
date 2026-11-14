# Globe finale refinement — 25 October 2026

User request: improve the closing LetBuyy text after the globe animation, change its color and use the store logo where useful.

Implemented in `apps/marketing/web/src/components/CommerceGlobeCanvas.tsx` and its existing `.cg-closing-*` rules in `src/app/globals.css`:

- One native, responsive brand wordmark replaces the live Lottie lettering. The previous text animation component and JSON are retained as unused assets; they no longer load in this scene.
- Reuse the transparent, native SVG storefront mark at `/icons/letbuyy-store-mark-v3.svg`.
- Theme-aware neutral “Let”, blue–violet “Buyy”, a restrained readable subtitle, and a short accent rule. No duplicate title pseudo-element or repeating text shimmer.
- Preserve the existing clock, seven-letter reveal, delayed localized subtitle, particle exit, pause/resume, completion and reduced-motion handling.

Verification:

- Production Next.js build: passed (`/tmp/letbuyy-finale-build.log`).
- Typecheck, targeted ESLint, stylesheet lint: passed (`/tmp/letbuyy-finale-{types,eslint,css}.log`).
- Existing globe, finale and retained Lottie asset tests: 20 passed (`/tmp/letbuyy-finale-tests.log`). The two retained asset tests do not certify the new scene composition.
- Standalone design-system and token-source validators passed (`/tmp/letbuyy-finale-{design-system,token-source}.log`).
- Generated production HTML checked for English, Tamil and Hindi: one wordmark, seven letters, the SVG mark, translated subtitle, no Lottie ending layer.
- Native font metric check: LetBuyy fits within the available width at 320, 360, 390, 768, 900 and 1440px scene widths.
- Inspected a local vector composition preview at desktop/mobile proportions (`/tmp/letbuyy-finale-preview.png`). This is a design rendering, not a browser screenshot.

Limit: live browser layout, keyboard and motion review were not available because Work settings disable local browser use. No deployment. Local development server restarted on port 9006.

## Intro corner seams — 26 October 2026

Owner screenshots showed rectangular background boundaries around the intro/finale. Reproduced in the live 1280×720 browser: the two offset radial gradients on `.cg-closing-title::before` retain nonzero alpha at their rectangular bounds. Added intersecting horizontal/vertical alpha masks that feather only the outer 5% of this decorative glow layer. The central 90% keeps the exact existing gradient. No scene clipping, foreground artwork, type, geometry, clock, globe maps, particles, letter reveals, pause/resume or animation source changed.

Verified the completed finale at 1280×720 in both themes and a temporary same-origin iframe at 390×844 and 768×1024. Mobile/tablet checks retain seven letters and completion state; tablet has zero horizontal overflow. Saved actual browser screenshots `globe-finale-soft-edges-desktop-2026-10-26.jpg` and `globe-finale-soft-edges-phone-2026-10-26.jpg`. These are CSS viewport checks, not physical-device certification. Strict stylesheet lint, existing globe/finale/retained-Lottie unit group (20 tests), production build/TypeScript (497 generated pages), and whitespace validation pass. The retained Lottie tests do not certify the native ending composition. Temporary fixture/tab removed. Preview restarted on port 9006 after finding no running listener. No commit, push or deployment.
