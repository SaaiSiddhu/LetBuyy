# Marginalia bound Liquid browser review

The final scoped browser audit passes: **45 full-page PNGs**, comprising **41 measured cases and four additional interaction states**. Actual source hashes are pinned in `browser-fixtures.json`. They matched all 12 recorded files at capture verification. Subsequent shared integration changed catalog registration, added bounded fact-carrier JSON to the app mapper and updated selected-variant hydration; those paths are recorded in `browser-review.json`. The coordinator confirms the carrier/hydration transfer to Pantry and requests no full recapture while integration remains active. The captured snapshot passes; current shared-source acceptance remains open until that integration is revalidated. M1's accepted storybook and its 45 exports were preserved.

## Actual chain and coverage

The fixture uses the explicit public v2 factory and its real settings, trusted catalog dispatcher, actual StoreService normalization/template resolver and `buildSectionDataPlan`, actual app product mapper and unchanged compositor product/navigation helpers, `LiquidRenderer`, and canonical page assembly. Live service dependencies are guarded; **zero API/database effects occurred**.

- Home, all products, book PDP, stationery PDP, missing-facts PDP, intentionally empty Reading soon collection and named Essays collection at **1440×1000, 834×1112, 390×844 and 320×844**, DPR 1: 28 cases.
- Five mobile pages at text size 200%: five cases.
- Long English and Hindi titles at 390/320, normal and text size 200%: eight cases.
- Native Description disclosure and three selected edition states: four further PNGs.

`browser-captures/` contains raw screenshots. `browser-review/` has four derived viewport boards plus readable detail crops; representative full-size home, collection, book, missing, empty, stationery and long-Hindi outputs were visually reviewed. Measurements cover the full document, not just the board crops.

## Demonstrated results

- **Zero** document/body overflow, visible-element overflow, out-of-viewport text ranges, broken images, script errors, failed requests or measured interactive targets below 44×44 CSS px in the 41 measured cases.
- Chromium CDP reports real **Libre Baskerville** heading glyphs, **Source Sans 3** body glyphs and Source Sans 3 Bold currency/price glyphs. Hindi uses the explicitly observed **Kohinoor Devanagari** system fallback, with Libre Baskerville punctuation. Times fallback is rejected by the capture script's font gate.
- Sampled default text contrast: muted facts/attribution **5.99:1**, main foreground **13.30:1**, primary button text **7.64:1**. The active control fill contrasts **7.07:1** against its adjacent canvas; option border contrast against the canvas is **4.23:1**. These samples do not certify every arbitrary merchant colour choice.
- The closed mobile navigation is hidden and cannot receive focus. Eight actual Tab steps stay outside it. Opening moves focus inside; Tab/Shift+Tab stay trapped; Escape closes it and restores focus to Menu. Native Description toggles from the keyboard with a visible 2px focus outline. Reduced motion is exercised.
- The unchanged canonical variant picker selects the three sample editions and updates displayed prices to **₹480 / ₹780 / ₹460**. The Hindi edition reports unavailable and disables purchase controls. This uses the real picker class/parser and canonical carrier; no cart/purchase class is registered and no order is attempted.
- The real binder selects exactly two Essays records and zero Reading soon records. Selected resource defaults are materialized before binding, so a blank selected related shelf cannot silently substitute the whole catalog. Missing facts are stated explicitly and an empty description does not create an empty disclosure.

## Source fixes and retained diagnostics

Owned theme fixes include correct body/display semantic font variables, mobile closed-panel visibility/focus exclusion, 44px chrome/navigation/breadcrumb/card-title targets, long-text wrapping, distinct square stationery media, omission of empty descriptions and enforcement of selected resource policy on instances before binding. The editor chat repaired shared font-token serialization; this chat did not edit the global renderer.

The initial fixture incorrectly supplied generic default appearance over the v2 package; the harness now uses the actual factory settings. The genuine unquoted Source Sans 3 token defect and initial closed-nav/target failures remain recorded in clearly superseded preflight/diagnostic JSON and images. Snapshot acceptance refers only to `browser-validation.json` and its captured source hashes. Later shared catalog/carrier/hydration changes do not rewrite those hashes or inherit an unearned current-source browser pass.

## Resource release and remaining gates

The owned fresh Chromium context/browser and localhost server were closed. Port **127.0.0.1:43277** had no listener at release verification, and the coordinator received explicit slot 1 release. No shared IAB, user profile, database fixture, full build or other chat's resource was used.

Local font files are the preserved M1 copies of the registered families. This demonstrates actual glyph use with isolated font delivery, rather than certifying the application's font network delivery. Only the unchanged canonical nav/picker classes and their pure helpers are transpiled in isolation; cart/customer/order hydration and the full app are outside this audit. Merchant variant save/conflict/version/readback, immutable accepted order facts, installed-release/publish/reload/rollback/reapply and live book query capability remain shared integration gates. The scoped browser pass is not a whole-journey completion claim.

The next shared acceptance step is a semantic output review and focused actual integrated PDP carrier/hydration validation after the coordinator supplies a stable checkpoint and any required resource lease. No browser/server is currently allocated.

A subsequent shared checkpoint passes five focused tests through the actual exported hydration registration. The selected-edition review records exact measurements/price/availability, stale-fact clearing, section scoping and reconnect, plus preserved targeted SSR semantics. Later shared hash drift is separately recorded. This is JSDOM behavior evidence; the new generated facts panel still awaits actual browser layout/focus/glyph measurement. See `selected-edition-review.md`.

Final shared checkpoint update: the five affected actual-registration edition cases now pass against the explicitly released Pantry source hashes, stable throughout the run. The initial 54-test suite is preserved separately; no additional browser capture was performed. See `selected-edition-review.md`.
