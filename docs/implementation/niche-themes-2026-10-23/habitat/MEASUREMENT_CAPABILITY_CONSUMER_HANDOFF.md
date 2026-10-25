# Habitat canonical measurement capability consumer

**Owned consumer implemented and source frozen.** This supersedes the earlier synthetic positive-numeric-facet presentation path. It consumes the released shared transport/projection contract; it does not implement or qualify migration390 SQL.

The optional whole `collection.measurement_capabilities` object is admitted by the canonical reader/validator. When present it requires all three strict members: `equipment_length { available, allowed_units }`, `max_width_cm { available }`, and `max_depth_cm { available }`. Habitat reads the two exact axis members directly. There is no `furniture_dimensions` alias, generated unit list or numeric facet inference.

Under the existing merchant `showDimensionFilters` toggle, width and depth each require their own `available == true`. A supported dimension can render without material/finish facets, while material/finish choices retain their supplied merchant labels and normalized values. Categorical or synthetic numeric facets, applied values and the aggregate furniture flag never enable numeric controls.

The controls retain maximum **assembled** width/depth labels in centimetres, the canonical 1,000,000 upper bound, `step="any"` and unrounded query values. Actual matching remains the existing server `assembled_axis_mm <= threshold_cm × 10`; the form does not implement a second matcher or promise access/fit. Unsupported, absent or merchant-disabled dimensions retain active values as hidden query carriers and independently clearable server links. Only actual visible controls replace their corresponding hidden carrier.

## Verified in process

The actual released backend payload reader → frontend page validator/projector → explicit Habitat2.0.0 bundle → Liquid → JSDOM FormData/URLSearchParams → canonical parser path passes **16 discovery cases** across collection and search, alongside **13 theme regressions**: 29 passed, zero failed/skipped. Both theme-engine and focused evidence no-emit typechecks pass.

- Independent width-only, depth-only and both capabilities with no categorical facets; no duplicate scalar controls/carriers; assembled/cm labels, fractional values, clear values and canonical rejection of zero/over-limit input.
- Absent and false capabilities remain hidden even with positive synthetic numeric facets; merchant-disabled controls preserve active query values despite true capabilities.
- Zero-total false capabilities preserve exact active axes in apply/sort and expose each real clear link, retaining other axes, all unrelated filters and repeated connectors while resetting page to1.
- A positive matched cohort with an empty/past-end page retains both controls. Malformed/null/partial/wrong-type/unknown-key/alias capability payloads fail before Liquid, as does any available capability on a zero-total page.
- Existing exact supplied selected/unselected material/finish labels, explicit unmatched-current fallback, newest sort, all canonical unrelated fields, repeated connectors, independent clears, clear-all and pagination remain covered.

Evidence: `measurement-capability-consumer.tap`, `measurement-consumer-theme-typecheck.log`, `measurement-consumer-evidence-typecheck.log`, and `measurement-consumer-source-manifest.json`. The receipt pins the three changed owned source/test inputs, unchanged factory, and actual read-only shared reader/schema/projection inputs. Exact hashes were sent to the coordinator for final source gates.

```sh
TSX_TSCONFIG_PATH=apps/commerce/web/tsconfig.json node --conditions=react-server --import tsx --test packages/theme-engine/test/habitat.test.ts docs/implementation/niche-themes-2026-10-23/habitat/discovery-form-roundtrip.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false --composite false --rootDir . -p packages/theme-engine/tsconfig.json
node node_modules/typescript/bin/tsc -p docs/implementation/niche-themes-2026-10-23/habitat/tsconfig.finish-evidence.json
```

Total passing owned cases across the preserved existing suites: **62**. Earlier historical-order tests and browser evidence were preserved without re-running them. This slice edited only `habitat-discovery.ts`, the focused Habitat tests and owned docs. No factory/shared schema/reader/projection/SQL edits, DB/build/browser or HTTP purchase run occurred. Real390 candidate computation, security/rollback and composed installed-theme acceptance remain shared qualifications; injected admitted response metadata in these tests does not prove SQL emits it.
