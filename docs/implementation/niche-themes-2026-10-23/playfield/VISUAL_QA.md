# Playfield actual Liquid responsive review

Final result: **49/49 cases pass**, with zero keyboard failures. The owned headless Chromium and localhost server were closed, port 43273 had no listener, and slot 2 was explicitly released to the coordinator. No shared IAB, user tab or unrelated process was used or closed.

The reviewed pipeline is explicit-v2 catalog factory → real `buildSectionDataPlan` with a bounded synthetic preloaded catalog → actual `productToLiquidDrop` → `LiquidRenderer` → `assembleLiquidPageFromRenderResult`. The renderer ran under Node's `react-server` condition to respect the app's `server-only` boundary. No import guard was disabled.

Ten scenes—home, age/interest collection, all products, product details, missing facts/media, cleared edition, different measured edition, empty collection, long English and Hindi copy—were checked at 1440/834/390/320 px. Nine additional home/collection/PDP cases doubled each element's computed font size and line height at 834/390/320 px. This changes the actual pixel text sizes rather than only the root rem size.

Each case checked document and body scroll width, visible element bounds, individual text Range bounds, decoded images, loaded fonts, scoped computed text contrast and 44 px visible interactive targets. Closed mobile navigation had no visible or tabbable descendants; 22 native Tab presses produced visible focused page controls with at least 2 px outlines. A BODY record denotes the browser's tab-cycle boundary, not a focusable control.

The final audit found no overflow, broken image, scoped text-contrast failure or undersized target. Original local Inter weights 400/500/600/700/800 were declared from approved frozen M1 font bytes; observed loaded weights were 400/600/700/800. Hindi used the platform glyph fallback. External network requests were blocked. Production font delivery/performance and cross-platform glyph coverage remain separate checks.

Forty normal screenshots and three mobile text2x screenshots are SHA-256 listed in `visual-audit.json`. `actual-liquid-review/review-contact-sheet.png` is a derived inspection board from final captures, not new artwork. Representative desktop/mobile/PDP/missing/Hindi/text2x/edition screenshots were visually reviewed. M1 source, 45 approved PNGs, 15 boards and original asset bytes remain unchanged.

## Findings repaired in owned source

- Closed off-canvas mobile navigation was still visible to layout/keyboard traversal. Playfield now hides it through the existing `lb-mobile-nav[data-open]` state below the canonical breakpoint.
- Header links/icons and PDP breadcrumb links were below 44 px. Scoped targets now meet the threshold and retain visible focus.
- Unstyled inherited links showed browser-default blue; scoped link roles now follow Playfield's palette.
- A blank announcement link label generated a zero-size focus stop because Liquid treats empty strings as truthy. The owned factory now requires nonblank label **and** destination.
- Actual editor-preview FAQ roots expose distinct stable block IDs for identical labels; public mode has no block identity attributes. The annotation is `{{ block.editor_attributes | raw }}` on each existing root, without extra block wrappers.

## Limits

These are static assembled Liquid fixtures. Edition differences are separately supplied, canonically resolved DTOs, **not** a live picker interaction. Static navigation inspection proves closed-state visibility/tabbing, not hydrated opening, escape/focus return or server authorization. Cart/gallery/variant elements retain the canonical islands but no client islands were hydrated. No API, DB, checkout, payment, inventory transaction, live publish/rollback, merchant save or performance certification is implied. Those acceptance gates remain with the coordinated integration work.

```sh
TSX_TSCONFIG_PATH=apps/commerce/web/tsconfig.json node --conditions=react-server --import tsx docs/implementation/niche-themes-2026-10-23/playfield/playfield-render-review.ts
# Requires a fresh coordinator browser-slot grant; script closes its own resources.
node docs/implementation/niche-themes-2026-10-23/playfield/playfield-capture-review.cjs
```
