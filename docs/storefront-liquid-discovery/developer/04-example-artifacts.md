# Example Artifacts and Drift Detection

## Overview

`packages/theme-engine/examples/` contains committed on-disk representations of the
first-party themes. These artifacts are generated from the live TypeScript fixtures
and serve two purposes:

1. **Reference implementation** — a human-readable directory tree of what a real
   `LiquidThemePackageBundle` looks like when exported to disk.
2. **Drift detection** — the test suite compares live fixture output against these
   committed files. If a fixture or exporter changes, the tests fail and remind you
   to regenerate.

## Directory structure

```
packages/theme-engine/examples/
  index.json                           <- top-level index (slug, artifact count, contentHash)
  urban-kicks-liquid/
    bundle.json                        <- raw LiquidThemePackageBundle JSON
    manifest.json                      <- ThemePackageManifest (SHA-256 checksums + contentHash)
    files/
      layout/theme.liquid
      sections/hero-banner.liquid
      sections/header.liquid
      ...                              <- 23 section + block files
      config/settings_schema.json
      config/settings_data.json
      templates/index.json
      ...
      locales/en.default.json
      letbuyy-theme.json
  letbuyy-core-liquid/
    bundle.json
    manifest.json
    files/
      ...                              <- same structure, neutral-branded
```

## Generating (or regenerating) the examples

```bash
# From the repo root
node --import tsx/esm packages/theme-engine/examples/generate-examples.mjs
```

This overwrites all files under `examples/urban-kicks-liquid/` and `examples/letbuyy-core-liquid/`
with the current fixture + exporter output. Commit the result.

The script delegates to:
- `createUrbanKicksLiquidThemeBundleFixture()` — the canonical first-party bundle
- `createLetbuyyCoreLiquidThemeBundleFixture()` — the neutral-branded Core alias
- `exportThemeBundleToFiles(bundle)` — flat file list, sorted by path
- `packageThemeBundle(bundle)` — SHA-256 manifest

## Drift-detection tests

`test/theme-examples.test.ts` enforces that the committed files remain byte-identical
to what the live functions produce. It runs as part of the normal test suite:

```bash
pnpm --filter=theme-engine test
```

Three invariants are checked per bundle:

| Test | What it checks |
|------|---------------|
| `bundle.json drift` | `bundle.json` equals `JSON.stringify(liveFixture())` |
| `files/ drift` | Every file in `exportThemeBundleToFiles()` matches its committed counterpart |
| `manifest.json drift` | `manifest.json` equals `JSON.stringify(packageThemeBundle(liveFixture()))` |

Plus one index test:

| Test | What it checks |
|------|---------------|
| `index.json` | Valid JSON containing entries for both bundle slugs |

### When tests fail

```
AssertionError: examples/urban-kicks-liquid/bundle.json has drifted from the live fixture. Re-run generate-examples.mjs.
```

This means the fixture or exporter changed but the committed examples were not regenerated.
Regenerate and commit:

```bash
node --import tsx/esm packages/theme-engine/examples/generate-examples.mjs
git add packages/theme-engine/examples/
git commit -m "chore(theme-engine): regenerate example artifacts"
```

## manifest.json format

```json
{
  "slug": "urban-kicks-liquid",
  "schema_version": "2025-06-01",
  "files": [
    {
      "path": "config/settings_data.json",
      "checksum": "a3b4c5...",
      "sizeBytes": 312
    },
    ...
  ],
  "checksums": {
    "config/settings_data.json": "a3b4c5...",
    ...
  },
  "contentHash": "d8e9f0..."
}
```

`contentHash` is SHA-256 over the sorted checksum values joined with newlines.
Different bundles always produce different `contentHash` values (verified by the packager test).

## Zero-regression law

The TS fixtures (`createUrbanKicksLiquidThemeBundleFixture`, `createLetbuyyCoreLiquidThemeBundleFixture`)
are the source of truth. The `.liquid` artifacts in `examples/` are read-only views.
Editing the `.liquid` files directly has no effect on the renderer. To change a section, update
the fixture in `theme-bundle.ts` or `theme-bundle-core.ts`, then regenerate.
