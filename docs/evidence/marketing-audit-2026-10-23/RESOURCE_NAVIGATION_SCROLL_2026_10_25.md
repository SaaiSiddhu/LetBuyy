# Resource article navigation scroll — 2026-10-25

Request: prevent the new article heading from being covered by the sticky Resources navigation after switching articles.

## Reproduction

At 390 × 844, clicking the Liquid guide's reading-dock Next link from scroll Y 2532 opened the custom-integrations guide at Y 153. The heading began at viewport Y 66 while the pinned category bar ended at Y 89, obscuring its first line. Next's page scroll targets the changing page inside the persistent Resources shell.

## Change

Added `ResourcesScrollRestoration` to the existing Resources layout. A pathname change resets to the document top after Next's scroll-and-focus step, using instant scrolling to override the global smooth-scroll rule. Initial loads, hash targets, and browser Back/Forward retain their existing restoration behavior. No article content or navigation destinations changed.

## Verification

- Mobile 390 × 844: reading-dock Next from the Liquid guide opens the next guide at Y 0, heading Y 219 and navigation bottom Y 153.
- Mobile: Previous article card opens the Liquid guide at Y 0; browser Back restores its original reading position at Y 2532.
- Mobile: Next from the reported India online-store guide opens Product Page Optimization at Y 0; Previous returns to the India guide at Y 0, heading Y 225 below navigation bottom Y 153.
- Mobile contents: Step 3 jump lands at Y 95.9 below navigation bottom Y 89.
- Desktop 1280 × 900: reading-dock Next opens Product Page Optimization at Y 0, heading Y 215 below navigation bottom Y 113.
- Browser Back after the desktop transition restores the saved Y 3887.5 reading position.
- Marketing typecheck and targeted ESLint: passed.
- Existing marketing test command: all 4 federation boundary tests and 56 marketing tests passed. Log: `/tmp/letbuyy-resources-scroll-tests.log`.
- No CSS changes; full repository governance/build was not rerun for this scoped scroll correction.

Screenshots: `resource-navigation-heading-fixed-mobile.jpg`, `resource-navigation-heading-fixed-desktop.jpg`.
