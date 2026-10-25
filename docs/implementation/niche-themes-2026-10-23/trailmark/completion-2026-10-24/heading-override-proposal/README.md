# Private Trailmark normal-heading correction — TM-G09

Implemented in `/private/tmp/trailmark-heading-override-20261024-01`, with **one private leaf changed**. Main/released source is unchanged. This is a source proposal, not an admitted package or installed result.

The current collection section labels `title` as Heading but renders `collection.title | default: section.settings.title`. A real named collection therefore hides any edit to that field. The shared Phase0 review raised this expression for Threadline; this proposal fixes Trailmark's independently owned leaf only.

The diff introduces a blank-by-default `headingOverride` text field. A nonblank value controls the real collection/search H1; otherwise the exact existing title/fallback behavior remains. The old field is honestly labelled Fallback heading, preserving existing stored values and normal default visuals. No product/query/title truth, authorization, stock, identity, CSS or shared renderer is changed. The current canonical output escaping is retained.

Eight focused tests use the actual canonical LiquidRenderer, persistence schema adapter and ThemeDocument/JSON roundtrip. Baseline RED: **5 PASS / 3 FAIL**. Initial patch: **7 PASS / 1 FAIL**, finding redundant escaping. Final correction: **8 PASS / 0 FAIL / 0 skipped**. `harness-initial.tap` also preserves the first dependency-resolution failure; it is not a product test failure. There was no dependency install or application runtime.

Tests cover normal collection and search custom headings, absent/cleared override, empty-data fallback, stored legacy fallback, hostile text escaping, actual field descriptor exposure, canonical persistence roundtrip, base purity, all-other-section/template/config/package conservation and no hotpatch of an existing2.0.0 bundle. They do not prove installed merchant editing, preview/publication, current fixture security, provider behavior or final acceptance.

`RESULT.json` pins all ten copied base inputs, the one changed private file, canonical helper/lock inputs, diff, tests and every initial/final receipt. The private source retains baseline metadata for comparison; **changed bytes must never be published as2.0.0**. No version number, catalogue/migration slot or update-path authority is allocated here. The allocator must review the exact patch, assign/admit a compatible new version and qualify its normal update path before any shared source write or installation.

Reproduce the preserved candidate with the command in `RESULT.json`. If recreating it, first verify the pinned base hashes, copy only that source closure, apply `source.diff` to the private leaf and use the existing theme-engine dependency view. Do not apply the diff to Main or an installed bundle merely to run the test.
