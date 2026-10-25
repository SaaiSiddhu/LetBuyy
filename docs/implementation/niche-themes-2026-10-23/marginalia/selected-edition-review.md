# Marginalia selected-edition integration checkpoint

The focused integration harness uses the **actual exported `registerLiquidHydrationIslands` entry**, the actual app mapper, explicit Marginalia v2 factory, `LiquidRenderer` and canonical page assembly. It does not extract a picker class or substitute the controller. The registered native picker creates the shared `VariantFactsController` and receives normal option-button clicks and change events.

```sh
TSX_TSCONFIG_PATH=apps/commerce/web/tsconfig.json NODE_PATH=./packages/theme-engine/node_modules node --import tsx --test --test-concurrency=1 docs/implementation/niche-themes-2026-10-23/marginalia/selected-edition-hydration.test.ts
```

Five tests pass in JSDOM. `selected-edition-tests.tap` records the result; `selected-edition-validation.json` pins this newer integration's source hashes separately from the historical browser capture. `selected-edition-dom/` contains inspectable post-selection DOM snapshots, not browser screenshots or pixel measurements.

## Exact demonstrated behavior

- The three actual sample editions retain their durable UUIDs, show **140 × 216 / 156 × 234 / 140 × 216 mm**, English paperback / English hardback / Hindi paperback, and **₹480 / ₹780 / ₹460**. Hindi is unavailable and both purchase actions remain disabled.
- The live selected panel exposes author, language, format, edition and dimensions from the validated bounded `facts_json` carrier. These are the shared contract's book fields. Pages, publisher/year and ISBN remain in the unchanged per-edition server-rendered comparison when supplied; this harness does not claim the live carrier includes those fields.
- A partial selection has no selected facts. A nonexistent Hindi/hardback combination clears the prior edition's facts and disables purchase. Returning to the unavailable Hindi/paperback edition displays that exact edition's facts. Resetting the picker clears facts again. Spaced and Hindi option names survive the actual carrier and click path.
- Removing the next edition's optional dimensions cannot reuse the previous edition's measurement. Hostile author text stays text; no image, script or event attribute appears in the selected panel. Unrelated private metadata is absent.
- Two product sections with identical option labels and different UUIDs/measurements update independently. Two disconnect/reconnect cycles remove the generated panel, preserve the static no-JS comparison, and recreate exactly one panel for the retained selected UUID.
- Targeted current SSR semantics equal the captured version: common bibliography, all edition-comparison rows, option markup, price markup and reading excerpt. After removing only the newly added display-only `facts_json` field, every original edition carrier row is unchanged.

The test installs a rejecting fetch guard and records **zero calls**. It makes no cart, checkout, identity, order, persistence, API or database operation. The initial test expectation was corrected from two-decimal currency formatting to the existing canonical picker's whole-rupee display; production formatting was not changed.

## Shared hook contract and remaining browser acceptance

The shared helper is `VariantFactsController(section, productId, currency, variants, productOnly = false)`, with `update(variant, state)` and `dispose()`. The normal integration entry is `registerLiquidHydrationIslands`; the picker owns selection and purchase availability. The display-only facts panel is `[data-lb-selected-variant-facts]`, scoped by its nearest canonical `[data-section-id]`, with `data-product-id`, current `data-variant-id` and `data-selection-state`. Its status uses `role="status"`, `aria-live="polite"` and `aria-atomic="true"`.

This closes the focused DOM/behavior checkpoint after Pantry's shared handoff. A real browser still needs to measure this newly generated panel at 320/390px and 200% text, including long English/Hindi facts, keyboard selection, focus visibility, live status, wrapping and adjacent content/target bounds. That run requires a coordinator resource allocation. No browser/server was launched, and no full 45-image recapture was requested or performed. The prior capture and its source hashes remain intact.

Parent variant persistence/readback, immutable accepted order facts and full commerce/release acceptance remain separate gates.

After the passing test checkpoint, the mapper, carrier and controller source hashes changed again. These paths are listed in `selected-edition-validation.json`; the original passing hashes were preserved, and the coordinator was notified. Final checkpoint confirmation remains pending.

## Final shared delta review before the allocated five-case rerun

The mapper retains its own-data public variant allowlist and resolves the same canonical books facts. It now constructs variant carriers before the product carrier, prioritizing selected-variant facts under the existing aggregate byte limit. The parser retains the same strict bounded `facts_json` display shape and book keys; malformed display facts cannot discard a valid enclosing UUID/options record. The controller keeps the same constructor/update/dispose hooks and section ownership. The existing renderer JSON filter escapes literal `<`, `>` and `&` without adding a second picker carrier or changing a base bundle. These changes warrant the five affected actual-registration cases, including hostile text and selection cleanup. The harness checks source hashes before and after the run to reject concurrent mutation.

The initial passing 54-suite and five-case checkpoint, including all nine source hashes and DOM snapshots, is preserved under `selected-edition-checkpoints/initial-54/`. Final source release is still awaited; no extra tests or browser capture were run while the source owner finishes its checkpoint.

## Final released shared checkpoint

The coordinator released `pantry/selected-variant-source-release.json` and authorized only the five affected actual hydration cases. All five pass against the final mapper/parser/controller hashes, with stable before/after source checks. The last refinements restore original optional-host UUID/state attributes on disposal and remove an unconsumed alternate carrier; books continue using the same existing picker plus bounded `facts_json`. The initial 54-test checkpoint and all 45 historical browser images remain preserved. No browser/server or full-suite rerun was performed. `selected-edition-validation.json` pins the final shared release and the new passing hashes.
