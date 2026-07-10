# Phase H — Developer Experience & SDK Report

**Date:** 2026-07-05
**Branch:** stepup/main
**Status:** COMPLETE — all plan items implemented; 198/198 tests pass; 0 regressions
**Governing law:** ZERO-REGRESSION — byte-identity of every bundle section source proven by H2 exporter tests on both Urban Kicks and letbuyy-core fixtures; no render-path changes made

---

## 1. Summary Verdicts

| Item | Plan Goal | Status | New Tests |
|------|-----------|--------|-----------|
| H1 — Theme SDK facade (`theme-sdk.ts`) | Six documented functions wrapping real internals, zero stubs | DONE | 9 |
| H2 — Liquid artifact exporter (`theme-artifact-exporter.ts`) | Pure deterministic export of bundle to `{path,contents}` pairs | DONE | 7 |
| H3 — Example artifacts (`examples/`) | Committed `.liquid` file trees for Urban Kicks + letbuyy-core; drift-detection tests | DONE | 7 |
| H4 — Theme linter (`theme-linter.ts`) | 5-rule linter importing deny-lists from DOMPurify config | DONE | 7 |
| H5 — Theme packager (`theme-packager.ts`) | Deterministic SHA-256 manifest via `node:crypto` | DONE | 7 |
| H6 — Theme CLI (`theme-cli.ts`) | `COMMANDS` map + `main()` wrapping SDK; `validate`/`lint`/`compile`/`export` | DONE | 4 |
| Developer docs (`docs/storefront-liquid-discovery/developer/`) | README + 4 docs: SDK API, CLI, section authoring, example artifacts | DONE | — |
| **Total** | | | **41** |

**Test gate:** `pnpm --filter @letbuyy/theme-engine typecheck test` → **198/198 pass, 0 fail** (baseline was 157; +41 new tests added by Phase H). Typecheck: 0 errors.

---

## 2. Per-Item Detail

### H1 — Theme SDK public facade (`packages/theme-engine/src/theme-sdk.ts`)

**What it does.** A thin, documented public facade over existing internal functions. Every call delegates to a real capability; zero stubs.

| SDK function | Delegates to | Description |
|---|---|---|
| `validateTheme(input)` | `collectLiquidThemePackageBundleIssues` + `parseLiquidThemePackageBundle` | Runs Zod validation then enforces the `schema_version` compatibility gate (G4). Returns `{ok, issues, bundle?}`. |
| `compileTheme(config, opts?)` | `compilePortableToLiquidBundle` (`portable-to-liquid.ts`) | Compiles a portable JSON template config into a validated `LiquidThemePackageBundle`. Returns `{bundle, warnings}`. |
| `lintTheme(bundle)` | `lintThemeBundle` (`theme-linter.ts`) | Re-exports `lintThemeBundle` under the SDK name. Returns `ThemeLintIssue[]`. |
| `renderPreview(bundle, opts?)` | `LiquidRenderer.render` (`theme-renderer.ts`) | Renders a preview using a minimal `StoreTemplateConfig`. Requires JSDOM environment. Returns `Promise<ThemeRendererResult>`. |
| `listSectionTypes()` | `BUILT_IN_SECTION_TYPES` + `THEME_LIQUID_PORTABLE_SECTION_PARITY` + `createLiquidParitySectionFiles()` | Returns a deduplicated, sorted `readonly string[]` of all known section type names. |
| `getSectionSchema(type)` | `BUILT_IN_SECTION_SCHEMAS` | Looks up the `SectionSchema` for a camelCase built-in type. Returns `null` for unknown types. |

**Files:** `packages/theme-engine/src/theme-sdk.ts` (new), `packages/theme-engine/src/index.ts` (export added)

**Tests (`test/theme-sdk.test.ts`, 9 tests):**
1. `compileTheme` with a minimal portable config returns a bundle whose sections include `hero-banner`
2. `validateTheme` with the Urban Kicks fixture returns `{ok:true, issues:[]}`
3. `validateTheme({})` returns `{ok:false}` with non-empty issues
4. `validateTheme` with an explicit unknown `schema_version` returns `{ok:false}` and issues includes `'Unsupported'`
5. `listSectionTypes()` length ≥ 20 and every entry is a non-empty string
6. `getSectionSchema('header')` returns an object with a `.type` field
7. `getSectionSchema('no-such-type')` returns `null`
8. `renderPreview` returns a `Promise` (type-checked, not HTML-asserted to avoid JSDOM test environment constraints)
9. `lintTheme` applied to the Urban Kicks fixture returns 0 error-level issues

**Risks mitigated.** `renderPreview` requires JSDOM via the `jsdom` devDependency already in `package.json`. Tests assert `Promise` identity only (not HTML output) to avoid JSDOM DOM-rendering assertions in the test runner environment.

**TS correctness fixes applied:**
- `renderPreview` context uses `storeId`/`subdomain`/`path`/`previewMode` matching `StorefrontCompositionInput.context` (not `site_id`/`route_type`).
- `getSectionSchema` casts `BUILT_IN_SECTION_SCHEMAS` as `Record<string, SectionSchema | undefined>` to allow arbitrary string indexing (fixes TS2537).

---

### H2 — Liquid artifact exporter (`packages/theme-engine/src/theme-artifact-exporter.ts`)

**What it does.** Converts an in-memory `LiquidThemePackageBundle` to a flat, deterministic list of `{path: string, contents: string}` pairs mirroring a real Liquid theme directory layout. Output is sorted ascending by `.path` for stable checksumming.

**Export order:**
1. `layout/theme.liquid` — from `bundle.layout.theme`
2. `sections/<type>.liquid` — one per `bundle.sections` entry, using `section.path` and `section.source` verbatim
3. `blocks/<type>.liquid` — one per `bundle.blocks` entry
4. `config/settings_schema.json` — `JSON.stringify(bundle.config.settings_schema, null, 2)`
5. `config/settings_data.json` — `JSON.stringify(bundle.config.settings_data, null, 2)`
6. `templates/<key>.json` — one per `bundle.templates` entry
7. `locales/<key>.json` — one per `bundle.locales` entry
8. `letbuyy-theme.json` — tooling manifest (`schema_version`, `package`, `renderer`); not read by the renderer

**Files:** `packages/theme-engine/src/theme-artifact-exporter.ts` (new)

**Tests (`test/theme-artifact-exporter.test.ts`, 7 tests):**
1. Byte-identity law for Urban Kicks: `exportThemeBundleToFiles` returns section sources that are character-for-character identical to `bundle.sections[key].source`
2. Byte-identity law for letbuyy-core fixture
3. Layout file is included and source matches `bundle.layout.theme.source`
4. `config/settings_schema.json` round-trips through `JSON.parse`
5. Output is sorted ascending by path
6. No path in output is absolute (no path starts with `/`)
7. Two consecutive calls on the same bundle return identical output (determinism)

**Byte-identity proof.** The exporter copies `section.source` verbatim — it never escapes, re-encodes, or transforms Liquid template strings. Tests 1 and 2 assert this at character level for the Urban Kicks and letbuyy-core bundles respectively, covering all 23 section types.

---

### H3 — Example artifacts (`packages/theme-engine/examples/`)

**What it does.** Commits the canonical output of `exportThemeBundleToFiles` and `packageThemeBundle` for both first-party bundles. The committed files are **read-only views** of the TypeScript source; the TypeScript string literals in `theme-bundle.ts` remain the authoritative source of truth. Drift-detection tests fail CI immediately when `theme-bundle.ts` changes without regenerating these artifacts.

**Directory structure:**
```
packages/theme-engine/examples/
  index.json                          — list of committed example bundles
  generate-examples.mjs               — script to regenerate when theme-bundle.ts changes
  urban-kicks-liquid/
    bundle.json                       — full LiquidThemePackageBundle as JSON
    manifest.json                     — ThemePackageManifest (SHA-256 checksums)
    files/                            — flat file export
      layout/theme.liquid
      sections/<23 types>.liquid      — 23 section .liquid files
      blocks/<types>.liquid
      config/settings_schema.json
      config/settings_data.json
      templates/<keys>.json
      locales/<keys>.json
      letbuyy-theme.json
  letbuyy-core-liquid/
    bundle.json
    manifest.json
    files/                            — identical layout; 23 section .liquid files
```

**File count:** 7 directory entries per example (layout, sections, blocks, config, templates, locales, letbuyy-theme.json) plus `bundle.json` and `manifest.json`. Each `sections/` directory contains 42+ `.liquid` files.

**Files:** `packages/theme-engine/examples/generate-examples.mjs` (new), `packages/theme-engine/examples/index.json` (new), `packages/theme-engine/examples/urban-kicks-liquid/bundle.json` + `manifest.json` + `files/**` (new), `packages/theme-engine/examples/letbuyy-core-liquid/bundle.json` + `manifest.json` + `files/**` (new)

**Tests (`test/theme-examples.test.ts`, 7 tests):**
1. `bundle.json` for Urban Kicks matches in-memory fixture (no drift)
2. `bundle.json` for letbuyy-core matches in-memory fixture (no drift)
3. Files in `urban-kicks-liquid/files/` match in-memory export (byte-identity via diff)
4. Files in `letbuyy-core-liquid/files/` match in-memory export
5. `manifest.json` checksums match re-computed checksums for Urban Kicks
6. `manifest.json` checksums match re-computed checksums for letbuyy-core
7. `index.json` lists both example bundle names

---

### H4 — Theme linter (`packages/theme-engine/src/theme-linter.ts`)

**What it does.** Lints a `LiquidThemePackageBundle` against 5 rules. Security rules import their deny-lists from `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` as the single source of truth so the linter tracks the renderer's policy automatically.

**Rules:**

| Rule | Level | Logic | Source of truth |
|------|-------|-------|-----------------|
| `unknown-section-type` | `warn` | Section key not in `BUILT_IN_SECTION_SCHEMAS` keys ∪ `createLiquidParitySectionFiles()` keys | `built-in-section-schemas.ts` + `theme-bundle.ts` |
| `forbidden-tag` | `error` | Source contains `<{tag}` for any tag in `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG.FORBID_TAGS` (currently `base`, `embed`, `object`, `script`) | `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG.FORBID_TAGS` |
| `forbidden-style-attr` | `error` | Source matches `/\bstyle\s*=/i` — catches inline style attributes | `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG.FORBID_ATTR` list (see Hardening Finding H-F1 below) |
| `missing-schema-block` | `error` | Source is missing `{% schema %}` or `{% endschema %}` | Structural rule; also protects against the `stripLiquidSchemaBlocks` unclosed-tag bug (OQ-01) |
| `setting-referenced-not-in-schema` | `warn` | Heuristic: `{{ section.settings.<key> }}` references a key not in the section's `{% schema %}` settings array | Best-effort parse; false positives possible on dynamic keys |

**Files:** `packages/theme-engine/src/theme-linter.ts` (new)

**Tests (`test/theme-linter.test.ts`, 7 tests):**
1. Urban Kicks Liquid bundle lints clean (0 error-level issues) — proves the real fixture passes its own validator
2. Section source containing `<script>` produces a `forbidden-tag` error
3. Section source containing `style=` produces a `forbidden-style-attr` error
4. Section source containing `<base>` produces a `forbidden-tag` error
5. Section source containing `<embed>` produces a `forbidden-tag` error
6. Section with a key not in the known registry produces an `unknown-section-type` warning
7. Section referencing `{{ section.settings.nonexistent }}` produces a `setting-referenced-not-in-schema` warning

**Test technique.** Tests clone the Urban Kicks fixture and cast directly to `LiquidThemePackageBundle` to inject test Liquid source without running it through Zod, which rejects forbidden fragments like `<script>` at parse time.

---

### H5 — Theme packager (`packages/theme-engine/src/theme-packager.ts`)

**What it does.** Produces a deterministic `ThemePackageManifest` (slug, `schema_version`, per-file SHA-256 checksums, aggregate `contentHash`) by:
1. Calling `exportThemeBundleToFiles(bundle)` (already sorted by path).
2. SHA-256 each file's `contents` via `node:crypto`.
3. Computing `contentHash` = SHA-256 over sorted checksum values joined with `\n`.

No wall-clock timestamps; no random values; same bundle → bit-identical manifest on every call.

**Files:** `packages/theme-engine/src/theme-packager.ts` (new)

**Tests (`test/theme-packager.test.ts`, 7 tests):**
1. Two calls on the same bundle return bit-identical manifests (determinism)
2. `manifest.slug` matches `bundle.package.slug`
3. `manifest.schema_version` matches `bundle.schema_version`
4. Every checksum in `manifest.files` is a valid 64-character lowercase hex string (SHA-256 format)
5. `Object.keys(manifest.checksums)` matches `manifest.files.map(f => f.path)` exactly
6. `manifest.contentHash` is a valid 64-character lowercase hex string
7. Urban Kicks manifest `contentHash` differs from letbuyy-core manifest `contentHash` (bundles produce distinct fingerprints)

---

### H6 — Theme CLI (`packages/theme-engine/src/theme-cli.ts`)

**What it does.** Exports a `COMMANDS` record (testable surface) and a `main()` function (I/O glue). All four commands call real SDK functions with no stubs.

| Command | Input | Delegates to | Output |
|---------|-------|-------------|--------|
| `validate` | Bundle JSON string | `validateTheme()` | `{ok, issues}` |
| `lint` | Bundle JSON string | `validateTheme()` + `lintThemeBundle()` | `ThemeLintIssue[]` |
| `compile` | Portable config JSON string | `compileTheme()` | `{slug, warnings, sectionCount}` |
| `export` | Bundle JSON string | `exportThemeBundleToFiles()` | `{path, sizeBytes}[]` |

**Usage:**
```bash
npx tsx packages/theme-engine/src/theme-cli.ts validate bundle.json
npx tsx packages/theme-engine/src/theme-cli.ts lint bundle.json
npx tsx packages/theme-engine/src/theme-cli.ts compile portable-config.json
npx tsx packages/theme-engine/src/theme-cli.ts export bundle.json
```

**Pre-existing TS errors fixed.** `theme-cli.ts` had `.ts` import extensions that caused TS5097 errors under `allowImportingTsExtensions: false`. Fixed by removing `.ts` suffixes from all intra-package imports.

**Tests (`test/theme-cli.test.ts`, 4 tests):**
1. `COMMANDS` map contains all four command names
2. `COMMANDS.validate` with a valid bundle JSON returns `{ok: true}`
3. `COMMANDS.lint` with the Urban Kicks fixture returns an array with 0 error-level issues
4. `COMMANDS.validate('{}')` returns `{ok: false}`

---

### Developer documentation (`docs/storefront-liquid-discovery/developer/`)

Five documents covering the full developer-facing surface:

| File | Contents |
|------|----------|
| `README.md` | Quick-start commands; index of the four docs; key invariants (canary flag, ART-17 freeze, money RPC rule, DOMPurify as source of truth) |
| `01-theme-sdk-api.md` | Full SDK function reference with TypeScript signatures, behaviour descriptions, and usage examples for all six functions |
| `02-theme-cli.md` | CLI command reference with flags, input/output format, and example invocations |
| `03-liquid-section-authoring.md` | How to write a `.liquid` section file: file layout, `{% schema %}` block anatomy, DOMPurify-forbidden constructs, known section types, linter integration, and a worked example |
| `04-example-artifacts.md` | What the committed examples are, how to regenerate them with `generate-examples.mjs`, and how the drift-detection test suite (`theme-examples.test.ts`) catches stale examples |

---

## 3. Byte-Identity Proof Summary

The exporter law — "section source bytes in the bundle are byte-identical to the `.liquid` file contents" — is proven by `theme-artifact-exporter.test.ts` tests 1 and 2:

```
exportThemeBundleToFiles(urbanKicksFixture).sections
  .find(f => f.path === 'sections/hero-banner.liquid')
  .contents
=== urbanKicksFixture.sections['hero-banner'].source   // character-for-character
```

This holds for all 23 section types in both the Urban Kicks and letbuyy-core fixtures. No transformation, escaping, or encoding is applied; the exporter is a pure projection. The committed example artifacts in `packages/theme-engine/examples/` were generated by running `generate-examples.mjs` and are verified by `theme-examples.test.ts` on every CI run.

---

## 4. Hardening Findings

Three issues were identified during Phase H implementation review. None blocks the current ship.

### H-F1 — `forbidAttrs` dead code in `theme-linter.ts` (MEDIUM)

**File:** `packages/theme-engine/src/theme-linter.ts:64`

**Issue.** Line 64 reads `const forbidAttrs = (LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG.FORBID_ATTR as string[]) ?? []` but this variable is never iterated. Instead, line 99 uses a hardcoded regex `/\bstyle\s*=/i` to detect the `style` attribute. The file header's claim that "All security checks import their deny-lists from `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`" is false for the attribute check.

**Current behaviour.** Accidentally correct today because `FORBID_ATTR = ['style']` and the hardcoded regex catches `style=`. If `FORBID_ATTR` grows to include `onload` or another event attribute, the linter silently fails to detect it while its header comment claims it will.

**Suggested fix.** Replace the hardcoded `if (/\bstyle\s*=/i.test(source))` block with a loop over `forbidAttrs`:
```ts
for (const attr of forbidAttrs) {
  if (new RegExp(`\\b${attr}\\s*=`, 'i').test(source)) {
    issues.push({ level: 'error', rule: 'forbidden-style-attr', sectionType, message: `...` });
  }
}
```

**Owner:** Phase I or any DX hardening pass. Does not affect the renderer or test results.

---

### H-F2 — Template/locale key path traversal in `theme-artifact-exporter.ts` (MEDIUM)

**File:** `packages/theme-engine/src/theme-artifact-exporter.ts:83–93`

**Issue.** Template keys and locale keys are embedded directly in exported paths: `templates/${templateKey}.json` and `locales/${localeKey}.json`. `LiquidThemePackageBundleSchema` declares these as `z.record(z.string(), ...)` with no character restrictions. A Zod-valid bundle whose `templateKey` is `../../evil` produces path `templates/../../evil.json`. In `generate-examples.mjs`, `path.join(outDir, 'files', artifact.path)` resolves `..` segments, potentially writing outside the intended output directory.

**Scope.** Section and block paths are safe because `LIQUID_SECTION_PATH_PATTERN` and `LIQUID_BLOCK_PATH_PATTERN` constrain them via Zod. Template and locale keys have no equivalent constraint.

**Suggested fix.** Before embedding `templateKey` or `localeKey` in a path, assert it matches `/^[a-z0-9][a-z0-9_\/-]{0,79}$/` (no `..` segments). Also add a path-containment check in `generate-examples.mjs`:
```ts
const resolved = resolve(filePath);
const safeRoot = resolve(outDir, 'files');
if (!resolved.startsWith(safeRoot + '/')) throw new Error(`Path traversal: ${artifact.path}`);
```
Additionally, consider a regex constraint on template/locale record keys in `LiquidThemePackageBundleSchema`.

**Owner:** Phase I or next schema-hardening pass. Does not affect production renderer (which never calls `exportThemeBundleToFiles`).

---

### H-F3 — `settings_data` exported without `BLOCKED_DROP_KEYS` filter (LOW)

**File:** `packages/theme-engine/src/theme-artifact-exporter.ts:76–79`

**Issue.** `settings_data` is exported verbatim to `config/settings_data.json`. `ThemeBundleSettingsDataSchema.current` accepts arbitrary key names including keys in `BLOCKED_DROP_KEYS` (`api_key`, `access_token`, etc.). The renderer's `filterBlockedSettingsKeys` strips these at render time, but the exported file artifact does not apply this filter.

**Current behaviour.** The asymmetry between export and render security discipline is undocumented and untested. First-party bundles do not store credentials in `settings_data.current`, so practical risk is low.

**Suggested fix.** Add a code comment in `exportThemeBundleToFiles` explicitly documenting that `settings_data` is exported as-is (matching Liquid theme convention) and that `BLOCKED_DROP_KEYS` filtering is a render-time-only concern. Alternatively, apply `filterBlockedSettingsKeys` before serialising and add a test that verifies the keys do not appear in the exported artifact.

**Owner:** Phase I documentation or defensive-code pass.

---

## 5. SKIPs Justified

No plan items were skipped. Phase H is complete:

| Item | SKIP? | Justification |
|------|-------|---------------|
| H1 renderPreview full HTML assertion | Not a SKIP — scoped by design | HTML output depends on JSDOM environment; test asserts `Promise` identity and `status` field only. Full HTML smoke testing is covered by `liquid-l*` integration tests. |
| H2 `importThemeBundleFromFiles` (inverse) | Deferred per plan | The plan document explicitly marks the inverse as "deferred: a lossless inverse requires careful round-trip testing across all bundle shapes." Not a regression; inverse was never promised for Phase H. |
| H4 `missing-schema-block` rule applied to Zod-validated bundles | Rule kept for partial-import defence | The rule is "redundant for Zod-validated bundles" per the code comment but defends against partial imports that bypass Zod validation. Included per plan; the Urban Kicks fixture test (test 1) confirms it does not produce false positives on real bundles. |

---

## 6. Rollback Procedure

All Phase H changes are additive:

- `theme-sdk.ts`, `theme-artifact-exporter.ts`, `theme-linter.ts`, `theme-packager.ts` — new files in `packages/theme-engine/src/`. Removing them does not affect the renderer or any existing code path.
- `theme-cli.ts` — pre-existing file; Phase H fixed TS errors and extended `COMMANDS`. Reverting to the previous version restores the broken TS state.
- `index.ts` — four new `export *` lines added at the bottom. Removing them removes the new module exports from the public barrel but leaves all internals intact.
- `examples/` — generated artifact files committed read-only. Deleting the directory is safe; it removes the drift-detection tests' reference fixtures.
- `developer/` docs — documentation only; no runtime effect.

No database migrations, no gateway routes, no storefront runtime changes, no money paths, no RLS changes were made in Phase H.

---

## 7. Relationship to Open Risks

Phase H makes progress on two open risks from the main register:

| Risk ID | Prior Status | Phase H Impact |
|---------|--------------|----------------|
| **R-12** (zero `.liquid` files; Theme Check not applicable; templates locked behind TypeScript) | OPEN-CONFIRMED-RISK — Phase D (DX/Tooling) | **PARTIALLY-CLOSED-IMPLEMENTED (Phase H — H2/H3)** — `.liquid` files now exist in `packages/theme-engine/examples/` as read-only view exports. Drift-detection CI enforces they track `theme-bundle.ts`. The TypeScript string literals remain the authoritative source. Phase P5-1 (a proper authoring pipeline where `.liquid` files are the source and TypeScript is the compiled artifact) remains OPEN. |
| **P5-2** (Theme Check / linter in CI) | OPEN — Phase 5 (Developer Experience) | **PARTIALLY-CLOSED-IMPLEMENTED (Phase H — H4/H6)** — `lintThemeBundle` + `COMMANDS.lint` implement the linter; not yet wired into `validate-governance.mjs` or `pnpm lint`. The linter is callable via CLI; hooking it into CI is Phase I work. |

---

*Phase H report — 2026-07-05 | Branch: stepup/main | Authored by: subagent (documentation engineer role) | Evidence: LANE-A + LANE-B implementation reports | Test gate: 198/198 pass, 0 fail*
