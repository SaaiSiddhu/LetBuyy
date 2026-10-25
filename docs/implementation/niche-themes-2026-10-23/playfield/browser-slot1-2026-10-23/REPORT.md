# Current CSS browser accessibility follow-up

2026-10-23. **PASS for the requested static browser scope:** 27 primary cases at measured 320, 768 and 1440px; 49 screenshots. R01's six controls pass visible-purpose review at all widths. R02's Circuit responsive/native focus and corrected browser accessible-name checks pass. Playfield positive/empty collection and search, native adult choices, Apply and independent clear recovery pass. No reproducible source defect was found in this scope; no production source was edited.

## Exact render and measurement profile

`render-current.ts` executes the public current v2 catalog factories, gateway discovery-envelope reader, app validated-page/projection, app product-drop mapper, LiquidRenderer and canonical assembly. `render-manifest.json` pins 25 source files, 78 rendered finite response pages, per-page bundle/CSS/HTML hashes and actual local font bytes. Current canonical bundle styles, the exact shared `liquid-theme.css`, the composition's Liquid wrapper and the actual layout CSS template are included. `layout-style.cjs` extracts and executes the layout's exact pure CSS template/initializers against default settings merged with each bundle's current settings; it performs no Next/service/DB read. Local font transport uses the frozen M1 bytes for the same families, without changing their originals. Full Next/global Tailwind compilation and hydration were not run.

One task-owned Chromium 148.0.7778.96 used viewport heights of 1000px, device scale 1 and reduced motion. Every request was restricted to the new task server on 127.0.0.1:43271. Native GET navigation resolves only to explicitly pre-rendered responses through the canonical query parser/URL function. The server contains no product-filter implementation or live API proxy. Habitat's physical-capability scene is the admitted synthetic390 shape and does not qualify real SQL.

The source-only checkpoints (nine-theme55 and Editor210) were inputs, not repeated here or promoted to browser evidence. Original M1 and all prior archives remain unchanged. Earlier bundle-only and incomplete-layout captures, selector corrections and native-select probes are preserved in clearly named subdirectories. They are harness investigations, not production failures or the final results.

## R01: six search controls, 18 measured cases — PASS

| Owner / route | Exact input selector | Visible purpose after entry at all three widths |
| --- | --- | --- |
| Circuit collection | `form.ct-search input[name="search"]` | Visible Search word on adjacent button; at320 it wraps below input without clipping |
| Circuit search | `form.ct-search input[name="search"]` | Same visible Search word and usable input/button |
| Habitat search | `[id="lb-search-input-search-box-default"]` | Visible magnifier on 44×44px button; white glyph on supplied primary color |
| Habitat search, physical-capability response | Same selector in separate physical scene | Same persistent magnifier and button; physical controls do not erase search purpose |
| MadeYours search | `[id="lb-search-input-search-box-default"]` | Persistent magnifier on 44×44px button |
| Playfield search | `[id="lb-search-input-search-box-default"]` | Persistent magnifier on 44×44px button, also after placeholder disappears |

Browser AX exposes a nonempty Search name in all18. The labels' actual clipped CSS is observed, but sr-only alone is not a defect. The contact sheet `r01-all-widths-contact.png` was visually reviewed; wide input/button excerpts are explicitly stitched with a black separator, and raw full-page PNGs remain authoritative. R01 is closed only for this visible-purpose/DOM/browser-AX scope, not real screen-reader speech.

## R02: Circuit collection/search × three widths — PASS

At320 and768, desktop facet inputs are display-hidden and browser AX-ignored. The closed native mobile details excludes its inner controls from AX and Tab order; its summary remains available. Enter opens it; two Enter presses on the summary open/close it and retain summary focus. At1440, the desktop panel is exposed and the mobile copy is AX-ignored and absent from Tab order.

Complete Tab traces use unique DOM node paths, avoiding early termination on repeated generic links. Initial/open trace counts are 28/37 at320,27/36 at768 and35/35 at1440 on each route. The open active panel order is summary (mobile), selected Hub radio, USB-C checkbox, HDMI checkbox, power100 radio, pass-through85 radio, data5000 radio, length100 radio, Apply filters, Clear filters. Each focused element is rendered, outside hidden/inert ancestors, with a visible2px outline. No inactive-panel visit occurred. Native checkbox Space and radio ArrowDown/ArrowUp toggle and restore; Apply and an independent power clear navigate by keyboard Enter and preserve the repeated connector pair.

48 nonempty facet-control browser AX names match the supplied labels/counts across these6 cases, e.g. `100 (4 matching products)` with native radio role. The count's `.lb-sr-only` helper is actually `position:absolute`,1×1px and `clip:rect(0px,0px,0px,0px)` in Chromium. This closes the earlier JSDOM cascade-layer measurement limitation for current browser CSS. The historical96-name count0/1/4 computation archive remains separate and untouched; count0/1 were not remeasured in this browser run.

## Playfield collection/search: positive + empty × three widths — PASS

Positive age6–8 and art native selects are reachable and accept actual keyboard typeahead plus Tab, then restore the supplied choice. Arrow-only native select behavior on this macOS headless platform was not assumed; preserved probes show why that earlier harness expectation was replaced. Apply is submitted with keyboard Enter, resets page1 and retains choices. Independent age and interest clear links each remove only the intended choice while retaining the other choice, country and limit.

Empty admitted responses supply no invented chooser, preserve active age3–5/music through hidden fields on Apply, and retain clear links. Each independent clear and clear-all issues a canonical native GET; the corresponding finite admitted response is rendered, including positive clear-all recovery. Complete focus traces and screenshots are retained in `browser-report.json`. The Playfield contact sheet and raw320 empty/positive pages were visually reviewed. All27 scenes have document/body widths within the viewport and zero broken images. There were zero page errors and zero attempted external requests.

## Release, limits and follow-on

The final owned process was25630. Chromium and server closed successfully in `finally` at13:32:34.755Z; independent `lsof -nP -iTCP:43271 -sTCP:LISTEN` returned exit1 and no listener. Export slot1 is released. Exact evidence and source/archive integrity are in `completion-receipt.json`.

**NOT_RUN:** live discovery SQL/measurement qualification, full Next/global pipeline, hydration, real screen-reader speech/device matrix, installed theme/editor lifecycle, cart/stock/order/COD and ledger behavior. The adjacent `../installed-fixture-preparation/LIFECYCLE_MATRIX.md` contains14 explicit future runtime cases aligned with Editor's existing14-product plan; all remain NOT_RUN pending single shared fixture allocation. No runtime UUID was invented.

The attempted coordinator status message was blocked by automatic approval review because direct human authorization to message Themes could not be verified. No retry or workaround was used; this complete local handoff is ready for review.
