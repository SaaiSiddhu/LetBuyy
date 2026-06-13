# Theme Engine Map

`packages/theme-engine` — renders storefronts. Two engines behind a common interface.

| Piece | Role |
|-------|------|
| `JsonContractThemeRenderer` | the **default** React-section render path (live). |
| `LiquidRenderer` | Liquid render path — **default OFF**, canary-gated (`resolveThemeLiquidRenderingEnabled`). |
| `sanitizeRenderedHtml` | server-side DOMPurify over rendered HTML. |
| `theme-bundle.ts` / `portable-to-liquid.ts` | bundle schema + portable→Liquid compiler. |

## Hard rules
- **Sanitizer locked** — `FORBID_ATTR:['style']`, `FORBID_TAGS:['base','embed','object','script']`, `outputEscape:'escape'`. Never relaxed (`theme-governance`).
- **jsdom is server-only** — `import(/* webpackIgnore: true */ 'jsdom')` + `serverExternalPackages` keep it out of client bundles (otherwise `next build` breaks).
- **ART-17** — no crowning React, no new React-per-section after the freeze, no flipping the Liquid default without the parity/security/perf gate, no deleting React before the hardening-wave data decision. `no-new-react-sections-validator`.
- **Appearance bridge** — merchant `site_settings` (snake_case) maps into camelCase theme tokens; merchant appearance wins the merge.

## Render flow
storefront route → `store-service` resolves the store + theme settings → renderer produces sections (+ chrome) → sanitized HTML → React hydration islands for interactivity.
