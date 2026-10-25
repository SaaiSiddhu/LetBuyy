# Read-only filter accessibility findings

One consolidated Circuit option-name ambiguity was found in the accepted immutable checkpoint. There were no observed name/ID/group/button-type/native-value or static tabindex failures outside that issue in this bounded inventory. Two review groups remain separate from confirmed findings. This is not WCAG certification or browser/AT acceptance.

## Pinned scope

Archive: `docs/implementation/niche-themes-2026-10-23/circuit/discovery/ui-facet-contract/green-55-before390/`. Receipt SHA256: `27b75e544285a88fbfe5b05f598c70f60e3ccdbb06f20af5b39ba5d0a6bc0f8c`; report SHA256: `a74af10946985b5b33bdec42fd0eb1db1054de15c8f3b46ab5696da361db875c`. The archived receipt records 55/55 functional checks, zero network and no source drift. This review did not rerun or change that oracle. Exact 24 HTML hashes are in [inputs.json](/Volumes/Projects/LetBuyy/docs/implementation/niche-themes-2026-10-23/playfield/accessibility-review/inputs.json).

Coverage is 18 primary collection/search artifacts plus 4 explicitly synthetic physical-capability cases and 2 stationery cases: 37 forms, 177 data-entry controls, 37 explicit-type buttons, 24 named native choice groups, 8 resolved ID references and 502 DOM focus candidates. Primary-only coverage is 28 forms and 136 data-entry controls. Tool versions: JSDOM 29.1.1, dom-accessibility-api 0.5.16.

| Owner | Primary HTML | Supplemental HTML | Forms | Controls | Confirmed issue | Review candidates |
|---|---:|---:|---:|---:|---|---|
| Playfield | 2 | 0 | 3 | 9 | None observed | R01 |
| Circuit | 2 | 0 | 8 | 56 | FILTER-A11Y-001 | R01, R02 |
| Pantry | 2 | 0 | 2 | 10 | None observed | Browser/AT limits only |
| Habitat | 2 | 2 | 6 | 22 | None observed | R01 |
| Kindred | 2 | 0 | 3 | 11 | None observed | Browser/AT limits only |
| MadeYours | 2 | 0 | 3 | 9 | None observed | R01 |
| Dewdrop | 2 | 0 | 2 | 10 | None observed | Browser/AT limits only |
| Trailmark | 2 | 2 | 6 | 20 | None observed | Browser/AT limits only |
| Marginalia | 2 | 2 | 4 | 30 | None observed | Browser/AT limits only |

## FILTER-A11Y-001 · P2 · Circuit: distinguish result counts from option values

Applies to both circuit-collection.html and circuit-search.html, in desktop and mobile facet forms: 32 affected radio/checkbox options, consolidated into one owner issue. The Power input (W) group contains this actual markup:

```html
<label><input type="radio" name="power_input_w" value="100" checked="">100<span>4</span></label>
```

The artifact name model returns **1004** for the 100 W choice with 4 matches. Other examples are 85→854,5000→50004 and usb-c→usb-c4. The group legend is correct, but the unlabelled count has no semantic separator from the option. The exact browser/AT spacing remains unverified because final CSS is not part of these HTML files; the missing count cue is directly visible in the markup.

Representative exact selectors, each resolving once per Circuit artifact:

- `aside.ct-desktop-facets input[name="power_input_w"][value="100"]`
- `details.ct-mobile-facets input[name="power_input_w"][value="100"]`

Owner correction: keep the value/units clear, and label or describe the result count distinctly. Preserve native inputs, group legends, query names/values and responsive instance identity. Any added description IDs need distinct desktop/mobile scope. Verify computed names and then the unchanged functional oracle; verify actual speech with final CSS later. Full selectors, names, excerpts and artifact hashes for all 32 controls are in [findings.json](/Volumes/Projects/LetBuyy/docs/implementation/niche-themes-2026-10-23/playfield/accessibility-review/findings.json). [W3C form grouping](https://www.w3.org/WAI/tutorials/forms/grouping/) supports retaining group context alongside individual option names.

## R01 · Visible search-purpose review; not a confirmed failure

These 6 controls have valid computed names and correctly associated intentionally sr-only labels. Their supplied value hides the placeholder. The final rendered purpose may be clear from surrounding Search text/icons; confirm that before deciding whether a persistent visible label is needed. Do not count these as six automatic failures.

| Affected owner | Artifact | Selector | Computed name |
|---|---|---|---|
| Circuit | circuit-collection.html | `[id="ct-search-forge-discovery-collection"]` | Search products, models and connectors |
| Circuit | circuit-search.html | `[id="ct-search-forge-discovery-search"]` | Search products, models and connectors |
| Habitat | habitat-search-synthetic-physical-capability.html | `[id="lb-search-input-search-box-default"]` | Search products |
| Habitat | habitat-search.html | `[id="lb-search-input-search-box-default"]` | Search products |
| MadeYours | madeyours-search.html | `[id="lb-search-input-search-box-default"]` | Search products |
| Playfield | playfield-search.html | `[id="lb-search-input-search-box-default"]` | Search products |

Circuit owns its ct-search control. The repeated data-lb-search-form cases originate in the shared inherited search-box composition and need coordinator/shared-engine triage if changed; avoid parallel per-theme patches. Visible instructions and programmatic names are different checks. [W3C labels/instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html).

## R02 · Circuit responsive focus review; not an observed failure

Inspect `aside.ct-desktop-facets`, `details.ct-mobile-facets` and its direct `summary` at actual desktop/mobile widths. Both forms are in the archive; native closed-details descendants are excluded from the initial focus-candidate sequence. CSS-dependent exposure, opening/closing focus and native radio arrow-key traversal need browser/AT testing. No positive tabindex, unnamed group or duplicate ID was observed. Static source order is not a Tab-key acceptance result. [W3C focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html).

## Native numeric/unit recovery observations

Only the two Trailmark **synthetic physical capability** artifacts expose the length pair. In `form.tm-length-form`, the 67.5 cm supplied pair is natively valid. Clearing either member produces valueMissing on the missing required member; clearing both rejects the length submission. This is expected for that separate Apply length form. Unrelated search/sort is in another valid form. The keyboard-focusable `a.tm-clear-length` is named **Clear equipment length**, and the following visible paragraph says to choose the measurement and unit together. No native recovery trap was established. Browser error focus/announcement and association of that nearby instruction still need the later pass.

The four physical artifacts do **not** prove real backend 390 capability or SQL acceptance. Habitat's supplied physical thresholds are natively valid in its two synthetic cases; primary fallback artifacts do not expose those numeric controls. The two stationery artifacts expose a labelled, selected Ruling control; no name/association defect was observed there.

## Observed passes and limits

No empty individual/action name, duplicate ID, broken/ambiguous ID reference, missing present choice-group name, implicit button type, invalid supplied native value, positive tabindex or focus candidate under aria-hidden was found. Wrapping labels are valid native associations; controls without IDs are not automatically defects. Repeated IDs in different standalone artifact documents are not same-document duplicates.

These are contentForLayout snapshots, with no assembled header/footer, actual theme CSS/layout, hydration or assistive technology. The 502 records are DOM focus candidates, not proven browser tab stops. Native radio traversal, actual keyboard order, visual labels, focus visibility/obscuring, responsive hiding, error announcements and installed lifecycle behavior remain unqualified. No source, red baseline, immutable archive, oracle, build, browser, database or migration was modified or started.
