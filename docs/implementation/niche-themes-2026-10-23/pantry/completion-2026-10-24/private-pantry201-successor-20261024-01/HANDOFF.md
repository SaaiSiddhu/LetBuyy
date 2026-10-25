# Pantry 2.0.1 private successor — source qualified

Status: **APPLIED_PRIVATE**, not Main/catalogue/runtime admitted. This packet implements the next bounded source slice for PANTRY-COMP-DECLARED-01 and02. It retains the previous13-test applied private packet and its independent review; those tests were not rerun or rewritten.

## Actual implementation

`src/pantry-theme-v201.ts` is the applied successor factory. It wraps the exact previously qualified collection/search correction in explicit2.0.1, version_number3. Captured2.0.0 factory/styles/discovery remain unchanged.

- Collection rows retain the existing Heading descriptor/default and template values. `showHeading` is an explicit toggle defaultfalse. Enabled custom text overrides a nonblank collection title; explicit clear/whitespace falls back to the canonical collection title; omission retains the original schema default. Default visuals stay unchanged.
- The inherited order Heading now supplies the label prefix. `order.number` remains the separate authoritative suffix. Blank/whitespace falls back to `Order`; text is escaped through the existing renderer/sanitizer.
- Canonical `withNicheOrderPresentation` runs while the bundle is still supported2.0.0, **before** the version bump. Saved facts and their unrecorded fallback remain intact; neither the facts marker nor its style is duplicated on repeated application.
- An existing Pantry2.0.0 document is cloned, without running the defaults factory again. Existing template/config/block values and resource identities survive. A valid2.0.1 input is validated and cloned idempotently; a malformed same-version contract is refused. A stale checksum is removed when advancing the version.
- The prior applied row correction can be supplied directly and is reused byte-for-byte, rather than adding another toggle/body.

`src/first-party-theme-catalog.proposed.ts` is a **private proposed catalogue overlay only**. Root remains the Main catalogue writer. The proposal adds an import, `pantryVersion?: '2.0.1'`, and a refresh-only opt-in branch inside the existing designVersion2.0.0 distribution path. Without that option, all ten existing2.0.0 and legacy results remain exactly equal to Main. Other themes and Playfield's existing2.0.1 selector are unaffected.

The three patches have separate purposes:

| Artifact | Proposed Main destination/scope |
| --- | --- |
| successor-source.patch | New `packages/theme-engine/src/pantry-theme-v201.ts` only |
| catalogue-proposed.patch | Three bounded import/option/dispatch edits in Root-owned `first-party-theme-catalog.ts` |
| candidate.patch | Combined review/apply-check artifact; never applied to Main here |

Materialized imports point to pinned read-only canonical sources because these files live in the evidence folder. Canonical-import snapshots and patches restore the intended package-relative imports; no duplicate renderer, editor or business authority was introduced.

## Actual validation

New focused cohort:

```sh
PANTRY_201_EPOCH=<new finite epoch> node --import tsx --test --test-concurrency=1 docs/implementation/niche-themes-2026-10-23/pantry/completion-2026-10-24/private-pantry201-successor-20261024-01/successor.test.mts
```

The same final test source produces **14 tests:4 PASS/10 expected FAIL** against the unchanged private baseline, exit1 (`red-final.tap`), then **14 PASS/0 FAIL/0 skipped/0 cancelled**, exit0, against the applied successor (`green02.tap`). The20 final Liquid render observations are subcoverage, not20 lifecycle cases.

The cohort covers explicit version/default dispatch, stable identity, scoped option isolation, existing merchant values, input immutability, idempotence, malformed-version/source rejection, exact reuse of the earlier row correction, actual schema manifests, JSON/document/portable roundtrip, populated collection/search overrides, clear/omission behavior, order prefix/number/saved facts, unrecorded facts without current-product fallback, hostile markup/Unicode, and byte-identical default collection/search/order HTML/styles. The all-ten comparisons are a focused check of the newly changed catalogue dispatch, not reruns of those themes' journeys.

Scoped strict no-emit typecheck of the new private wrapper and proposed catalogue: **exit0**, with empty stdout/stderr. `git apply --check candidate.patch`: **exit0**, without applying it.

The first green attempt was13PASS/1FAIL because the test inspector read `Document.textContent`, which is null, after the missing-facts UI had correctly rendered. The inspector now reads the document body. The failed epoch is preserved; the production assertions were not weakened. A new final baseline RED and final GREEN use the same corrected test source.

## Exact source boundary

| Boundary | SHA256 |
| --- | --- |
| Main Pantry2.0.0 factory | `9c440d32f146b8155ba78f522da52979fd09a0f3d32c4b25e5c3e289ef390925` |
| Main catalogue base | `48e8126f5681d91fb1780b521bd5d53c4bf933156ca2b97c64932d95e0800605` |
| Applied private2.0.1 factory | `dd6097bcbc5ba0ea760ee91b5b66a91600e6c3bd04e40af8ed62774f93c0f845` |
| Canonical-import successor source | `a36fd4fe59da895b4f48e08e3b2882bc8a5e0fc99c0d57487a476e17219f38bf` |

`BASE_INPUTS.json`, `VALIDATION.json` and `SUCCESSOR_MANIFEST.json` pin the exact private sources, proposed patches, tests, logs and relevant canonical inputs. All32 old private-packet artifact hashes, the admitted frozen2.0.0 package and99 M1 freeze entries still match. Main/private base hashes were checked again before sealing.

`HUMAN_AUTHORITY.json` records the actual read_thread user-message checks: the named ten-theme completion mandate and the later explicit resume of Themes and Editor. That corrects the earlier pending-resume assumption; it does not create a browser/runtime grant.

## Remaining admission

Root/independent review must admit these exact source and proposed catalogue bytes, then decide the append-only2.0.1 version/capture/catalogue lineage and coherent candidate gates. No catalogue migration, immutable release capture, Main source application, native/database/browser/provider run or app restart occurred here.

Normal installed editor Save/fullreload/private preview/publish/public readback, real Pantry P09–P12 (including exact P12 stale-cart evidence), expanded identity/quality coverage and an actual per-theme Razorpay Test Mode purchase remain open. The synthetic order used by source tests was never persisted and is not a Pantry primary order. No full theme or installed acceptance is claimed.
