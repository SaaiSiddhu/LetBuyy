# One shared theme data-roundtrip harness

Use this entry point instead of cloning the Circuit serializer test for each theme. It tests **source data preservation**, not actual UI actions, resource ownership, installation, publication, buyer identity, payment or certification. The original Circuit46 test and its sealed result remain unchanged.

## Core entry point

`theme-data-contract.mjs` exports:

```js
runThemeDataContract({
  bundle,                    // actual supplied package; never mutated
  expectedIdentity: {
    slug, version,           // independently supplied admitted identity, both required
    bundleSha256,            // strongly recommended here; required by the serial CLI
  },
  templateKey,               // explicit actual existing source fixture template
  adapters,                  // actual canonical functions, listed below
  fixtures: {
    resourceFixture: { value, provenance },
    fieldValues: { /* e.g. 'theme/headingFontFamily': an approved family */ },
    fieldValue,              // optional source-backed value factory for additional types
    protectedSectionTypes,   // optional extra protected seams, not permission bypasses
  },
  emit: (name, value) => {},  // caller writes only to its fresh owned evidence directory
});
```

The function asserts actual slug/version **before any adapter runs**. It checks the optional package hash against the actual caller input, then uses a canonical parsed clone. A misspelled/unrecognized successor option returning2.0.0 cannot satisfy expected2.0.1. Never derive the expected version from the factory's return value to hide a fallback.

Return value includes source-only case results, exact edited/read-only/informational field sets, input identity/hashes and limitations. Any `fail>0` is a failed source gate. Failed cases retain their data; unsupported mutable field types throw a concrete fixture error instead of being silently skipped. Read-only/informational descriptors are reported separately.

The adapters are the actual canonical functions:

- `parseBundle`, `describeBundle` returning the supplied package's exact `{sectionSchemas, settingsSchema}`, and `buildEditorConfig` from the registry.
- Actual editor `normalizeSettingsSchema`, `normalizeEditorState`, `buildDraftConfig`, `createSectionFromSchema`, `createBlockFromSchema`.
- `collectValidationIssues`, `compile`, `toDocument`, `fromDocument`, `isAppBlockType` from the engine.

`canonical-adapters.mjs` supplies these once from actual source paths. It imports the declared engine module, extracts the real pure editor/registry declaration closures, and records raw snapshots and extraction hashes. It does not mount or reimplement the editor. If a canonical helper changes or disappears, stop and rebind this one adapter centrally; do not add theme-local replacement serializers.

## Serial CLI and input contract

From the repository root, using existing installed tooling:

```sh
node --import tsx \
  docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/shared-roundtrip-harness/run.mjs \
  --input=/absolute/path/to/admitted-inputs.json \
  --output=/absolute/path/to/a-fresh-owned-result-folder
```

The manifest is one object, or `{ "themes": [oneObjectPerAdmittedTheme] }` with at most10 entries. Each object supplies:

```js
{
  expectedIdentity: { slug, version, bundleSha256 },
  bundleFactory: { module, export, args },
  adapters: { domainModule, editorPage, registryAdapter, tokenPackage },
  sourcePins: [{ path, sha256 }],
  templateKey,
  fixtures: { resourceFixture: { value, provenance }, fieldValues },
}
```

Paths are relative to `--root` (the current repository directory by default). Use the actual admitted factory export/options, exact expected package identity/hash and source pins, not a guessed theme version. Source pins are verified before and after each input. A source change refuses the gate; there is no automatic retry. The runner creates a separate `<slug>__<version>/` output for each identity and refuses an existing result directory. It runs inputs serially, does no installation/build/database/browser/provider work, preserves failures and exits nonzero on any failed/refused input.

`verify-circuit.input.json` is a **working frozen source example**, not a current ten-theme input manifest or installed-package admission. It deliberately uses the sealed Circuit source package and actual editor snapshots that supported the original run. The caller's admitted inputs determine all other themes' versions and definitions. Do not alter those example pins and call it the same run.

## What is checked

Every supplied nonfrozen section and its declared flat block types gets source fixture states for edit, hidden/reordered, shown, removal and re-add. Actual section/block settings, UUIDs, ordering and visibility must survive the real save builder, JSON wire, matching schema validator, existing-bundle compiler and document roundtrip. Re-add creates fresh IDs. Header/footer section identities remain pinned. Unrelated templates remain unchanged. Global values, including false/zero where valid, are checked too.

Real declared per-block `limit` is respected. Fixtures generate only flat structures, below nesting depth limits, and use only actual section block declarations/effective descriptors. This is **not** the shared editor action/permission/limit suite. The harness does not decide which UI actions are reachable or permitted on a template. The caller's fixture template must exist explicitly; index-source tests do not establish all-template rendered context acceptance.

App block types are identified by the canonical engine helper and are never generated. Existing app instances cause refusal without deleting them. `app-block-slot` remains an uninstantiated protected seam. Additional caller-provided seams can be kept protected without making unsupported features silently N/A.

**Missing `allowed_child_types` is not encoded as unsupported.** The harness does not infer child permissions or generate a child-availability matrix. It preserves exact definition metadata through the canonical document roundtrip. Canonical absence/unrestricted, empty-list and explicit-list semantics remain with the shared Editor/engine owner; its action suite must test those semantics. Flat-only generation here is a scope boundary, not a claim that nesting is forbidden.

Resource UUIDs carry an explicit provenance label. Synthetic UUIDs prove value retention only. Real owned/foreign/deleted resource binding, media, controls, save acknowledgment, reload, undo/redo, recovery, preview, publish/public readback and every buyer/payment journey still need their admitted execution.

## Verification and preservation

The reusable extraction was verified once on the same sealed Circuit input:46PASS/0FAIL, with96 source pins exact before/after and the caller bundle unchanged. This revalidates the refactored harness; it is **not another46 unique lifecycle cases**. Five actual guard tests pass for expected identity, wrong/missing identity before adapters, ignored successor fallback, changed package hash, and distinct absent/empty/list child metadata preservation.

See `verification-circuit-01/summary.json`, `identity-guards.tap` and `HANDOFF.json`. Original `module-wire-20261024-01/` source, TAP and artifacts were independently rehashed without rewriting them. No Main/shared package, promoted bundle, M1, current app, draft, data or runtime is changed by this handoff. Other owners/shared integrator should consume this entry point once per admitted input, with their own identity/output scope, instead of writing another generic serializer test.
