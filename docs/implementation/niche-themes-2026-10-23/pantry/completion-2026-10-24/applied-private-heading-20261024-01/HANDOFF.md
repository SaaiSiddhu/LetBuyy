# Applied private Pantry heading repair

**APPLIED_PRIVATE / SOURCE_QUALIFIED.** This is a successor source candidate for PANTRY-COMP-DECLARED-01. It is not applied to Main, admitted to a catalogue/version, installed or published. No new app or runtime was created.

The implementation is the actual copied factory at `src/pantry-theme.ts`. The tests load that file directly through the existing tsx loader. They do not substitute a Liquid string in memory for the implementation. `MATERIALIZATION.json` records the three relative-import rebindings to pinned, read-only canonical schema/style/discovery modules. `source.patch` removes those location-only rebindings and shows the production-equivalent one-line change.

## Behavior and default preservation

The existing Heading descriptor, its `Everyday staples` schema default, saved `Results` search-template value and every existing template/config value stay unchanged. The old renderer ignored that heading. Simply rendering it unconditionally would add a default heading and change the approved composition.

The candidate adds a canonical **Show heading** toggle, default **false**. When enabled, a nonblank Heading renders as escaped h2 text in the existing row container and takes precedence over the supplied collection title. Explicit blank/whitespace Heading falls back to the current canonical collection title; if both are blank, no empty heading is emitted. Omission retains the existing schema default, as the canonical renderer already specifies. Explicit false and legacy instances without the new toggle keep their previous display.

This is an explicit merchant visibility choice, with no magic default-value comparison, private dirty flag or second resource authority. Products, named collection context, server pagination URLs, empty guidance, food facts and all other sections retain their canonical behavior. Normal editor wiring/persistence remains a separate admission check.

## Actual qualification

Command:

```sh
node --import tsx --test --test-concurrency=1 docs/implementation/niche-themes-2026-10-23/pantry/completion-2026-10-24/applied-private-heading-20261024-01/heading.test.mts
```

- Same final test source against unchanged materialized baseline: **13 tests,4 PASS,9 expected FAIL,0 skipped/cancelled**, exit1 (`red-sealed.tap`).
- Against applied private source: **13 tests,13 PASS,0 FAIL/skipped/cancelled**, exit0 (`green-sealed.tap`).
- Actual schema parsing/manifest validation, JSON wire, ThemeDocument roundtrip and portable compile preserve enabled edits and explicitfalse. An unknown-field negative control remains rejected.
- Populated search and collection A/B headings change even when the canonical collection title is nonblank. Empty states, explicit clearing, omission, missing fallback, hostile markup and Hindi/Tamil are exercised through actual LiquidRenderer and sanitizer.
- Default body and style output are byte-identical for home/PDP/collection/search × populated/empty: eight default comparisons. Exact hashes appear among37 source-render observations; those observations are not37 tests or lifecycle passes.
- Existing Main factory hash, admitted frozen2.0.0 package and all99 M1 freeze entries match. `git apply --check source.patch` exits0 without applying it.

The first two test launches failed during harness initialization (wrong validation import, then a CJS/ESM named-export mismatch); both are preserved. An intermediate11PASS/1FAIL run exposed a test expectation that conflated omitted and explicitly cleared values. The final suite separates those states and retains the canonical default contract. No product failure or skip was hidden.

## Exact identities

| Input/output | SHA256 |
| --- | --- |
| Main factory base | `9c440d32f146b8155ba78f522da52979fd09a0f3d32c4b25e5c3e289ef390925` |
| Applied private factory | `00e8661dc205ed0c5d9d6e47e6b5b4f1354f1d1ac95c0aee18cb6b3b64cd1995` |
| Applied factory with canonical imports restored | `ec6349c353a90d971012f8783990f5d0fed428e2696465d0778c505da3b6ca64` |
| Final test source | `8fefebc997e28a87a89e5f1b230a4fd657a6fec9cb7b2f038fb2b4a764438bf5` |

`VALIDATION.json` links exact commands, counts, hashes, canonical direct inputs and the observed loaded private module. Its9 CJS-cache entries are an observed subset, not a complete ESM/runtime containment proof. `APPLIED_MANIFEST.json` seals this finite private packet.

## Admission still required

The inherited2.0.0 version literal remains a source locator. This candidate is **not distributable** under frozen2.0.0, and no new version/capture/migration/catalogue artifact was emitted. The allocator must select and admit the successor version and coherent schema/package lineage, then review the normal editor control and installed Save/fullreload/private preview/publish/public readback.

`DELTA_COVERAGE.json` records the new toggle's required, unexecuted installed coverage. Original P00–P12 and all281 current completion obligations retain their existing results; this source suite grants no installed/runtime/provider PASS. No checkout correction or inventory audit was repeated, and no browser, database, provider, user draft, order or inventory was touched.
