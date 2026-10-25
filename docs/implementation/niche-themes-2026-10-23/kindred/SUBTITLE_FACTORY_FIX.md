# Fresh Kindred collection-grid defaults

23 October 2026. The actual gateway `buildBundleTemplateConfig` and matching manifest validator reproduced the unsupported inherited `subtitle` before editor normalization and after JSON serialization. Every one of the 21 editable template flows saw that invalid shared template instance. The before-fix witness is `editor-source-roundtrip-before.json` / `.log`.

The Kindred occasion grid never renders that copy. `createKindredTheme` now removes exactly `templates.list-collections.sections.list-collections-grid.settings.subtitle` from its fresh cloned Core default. It retains `title: 'All collections'`, the existing section schema and rendering, and all buyer templates. The Core input is unchanged. This is no runtime cleanup of merchant documents, and no normalizer, index, registry or unknown-key validator was changed.

The complete fresh bundle JSON differs by that one setting: restoring the deleted copy reproduces the exact before-fix bundle SHA-256 `83798321b00dd5e255017ea336ad63e0192511f720217e74be67e174516f522e`. The corrected bundle JSON hash is `390488d591b3735be6af341039ef1dd98a0a86c47be033d616bc4be9bf474900`.

| Changed source | New SHA-256 |
| --- | --- |
| `packages/theme-engine/src/kindred-theme.ts` | `643581f20c99ee39717a6db888309da0d3e5579c63a663ef5d583f5b829d6669` |
| `packages/theme-engine/test/kindred.test.ts` | `4a4a9875324b10dc92234a7751ff9aab514e4ced0605df5fd6c58176b7fc7a48` |
| Owned `kindred-editor-source-roundtrip.mjs` harness | `f108e32bf9da3762fbd884fe19bf682c49b61a04f418254d8fea0c9a76260abb` |

Verification:

- The owned harness extracts the **actual** gateway builder and merchant normalization/draft helpers by TypeScript AST, then invokes the public engine manifest validator and portable compiler. No package imports an app/service. Baseline and all **21 editable template flows pass** before/after JSON-wire serialization, retaining compiled header/footer IDs. `editor-source-roundtrip.json` / `.log` pin all participating helper sources.
- Its independent negative control restores `subtitle` and still fails that exact manifest error both before/after JSON. Strict unknown-key validation remains active.
- Actual Liquid rendering of list-collections produces identical layout HTML, content, header, footer and head CSS with/without the unused inherited setting. The first parity assertion also compared renderer section-settings diagnostics, which correctly differ by the removed field; that harness-only failure is retained in `editor-render-parity-internal-metadata.log`. The final assertion compares every actual buyer output field exactly, verifies real collection/title copy, and passes.
- Kindred's **8 theme tests pass**, including the added base-preservation and fresh list-default assertions. Theme-engine package typecheck passes. See `theme-tests-subtitle-fix.log` and `theme-engine-typecheck-subtitle-fix.log`.
- Install/artifact validation passes, deterministic 74 files /115,616 bytes, content hash `516224ac2fa87c2b57ff36dd24ed1de84501e9449be573eb0d93a09d7229c7f3`. The same20 inherited warnings remain, with zero new warnings. See `artifact-contract.json`.
- All **91 frozen M1 files are unchanged**. No database, build, server or browser resource was started. No installed/published/persisted editor acceptance is claimed.

Reproduce from the repository root:

```sh
node --import tsx docs/implementation/niche-themes-2026-10-23/kindred/kindred-editor-source-roundtrip.mjs
node --import tsx --test packages/theme-engine/test/kindred.test.ts
pnpm --filter @letbuyy/theme-engine typecheck
```

This owned source gate is ready for the coordinator's389 regeneration. Source hashes and the one-field bundle comparison are in `subtitle-fix-source-manifest.json`. The separate388 follow-up remains pending MadeYours' new source pin. Cross-chat delivery remains blocked by the prior automatic approval decision; these local handoff artifacts are complete.
