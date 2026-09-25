# SUSTAINED-I — custom CSS: real end-to-end proof (workstream 6)

Closes the verification gap SUSTAINED-G2 left open: G2 proved the *renderer* correctly emits a
merchant's custom CSS given `storeTemplate.customCss`, but never proved a *saved merchant setting*
actually reaches that point through `store-service.ts`'s real loading code, nor exercised a real
browser's computed style, nor a cross-store negative control. This phase does all three.

## Technique — the real production code, not a re-implementation

`apps/commerce/web/src/lib/store-service.ts` imports `server-only`, which throws when loaded under
plain Node — the reason SUSTAINED-G2 could not unit-test `mapSupabaseToStore` directly and instead
relied on renderer-level tests. This phase found the actual fix: `server-only`'s own `package.json`
declares a conditional export —

```json
"exports": { ".": { "react-server": "./empty.js", "default": "./index.js" } }
```

— `empty.js` is a genuine no-op; it is the exact file Next.js's own RSC bundler resolves to when
compiling Server Components. Running plain Node with `--conditions=react-server` activates the same
export condition, so `store-service.ts` loads and runs for real, unmodified, un-stubbed. The only
thing faked is the network boundary (`globalThis.fetch`, returning a synthetic worker payload shaped
exactly like the real gateway's), the same "fake the network boundary, run real code" technique this
whole session has used since APPID-FIX2's fake-PostgREST harness. The verification script is
preserved at `docs/evidence/appid-2026-09-24/sustained-i-custom-css-e2e-script.mjs`.

## What it proves, and how

Two synthetic stores, `demo-store-a` (saves `.lb-hero-banner { color: rebeccapurple; background:
hotpink; }`) and `demo-store-b` (saves nothing), plus `demo-store-hostile` (a style-tag-breakout +
inline-`<script>` payload). Each store's worker payload is loaded through the real
`StoreService.getStoreBySubdomain()` → real `mapSupabaseToStore()` → `StoreModel.templateConfig
.customCss`, then rendered through the real `LiquidRenderer` (the same class SUSTAINED-G2 wired),
then served over a local HTTP server and opened in real Chromium (`/opt/pw-browsers/chromium`).

1. **Loading-layer proof, before any rendering**: `storeA.templateConfig.customCss` equals exactly
   what store A saved; `storeB.templateConfig.customCss` is `undefined` — store B never receives a
   value it never saved, at the loading layer itself, before the renderer is even involved.
2. **Real visual effect (`getComputedStyle`, not a string match)**: store A's `.lb-hero-banner`
   element resolves to `color: rgb(102, 51, 153)` (rebeccapurple) and `background-color: rgb(255,
   105, 180)` (hotpink) in a real, running browser — the CSS genuinely took effect, not merely
   present as text in the HTML source.
3. **Cross-store negative control**: store B's *same* element resolves to the theme's default
   `rgb(31, 41, 55)` text color and a transparent background — neither of store A's values appear
   anywhere on store B's rendered page — and store B's page carries zero `[data-lb-custom-css]`
   elements at all (no custom-CSS `<style>` tag exists on the page, not merely an empty one).
4. **Hostile-payload scope/security check, in the real DOM**: `demo-store-hostile`'s saved value
   attempts a `</style><script>window.__XSS__=1</script><style>` breakout. After the real browser
   loads the real rendered page, `window.__XSS__` is `undefined` (the script never executed) and no
   `<script>` element containing the payload text exists anywhere in the live DOM — the existing
   `validateAndScopeCustomCss`/DOMPurify pipeline (already unit-tested by `custom-css-sanitizer
   .test.ts`) holds under a real render + real browser parse, not only a string-based test harness.

## Result

```
storeA.templateConfig.customCss = ".lb-hero-banner { color: rebeccapurple; background: hotpink; }"
storeB.templateConfig.customCss = undefined
storeHostile.templateConfig.customCss = "</style><script>window.__XSS__=1</script><style>.hero{color:red}"
TEST1 store A computed color: rgb(102, 51, 153) background: rgb(255, 105, 180)
TEST2 store B computed color: rgb(31, 41, 55) background: rgba(0, 0, 0, 0)
TEST3 window.__XSS__ after loading hostile payload: undefined
ALL CUSTOM-CSS E2E CHECKS PASSED
```

**Verdict**: `D-CUSTOMCSS-E2E = VERIFIED_REPOSITORY_FACT`. The SUSTAINED-G2 wiring is proven correct
end to end — real loading code, real render, real browser, real cross-store isolation, real
hostile-input handling. This closes the specific gap the owner named; it does not re-open or repeat
G2's own already-passing renderer-level tests.
