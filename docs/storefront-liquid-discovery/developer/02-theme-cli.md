# Theme CLI Reference

Source: `packages/theme-engine/src/theme-cli.ts`
Bin entry: `letbuyy-theme` (configured in `package.json`)

The CLI wraps the real SDK functions. Every command is backed by production code — no
stub or pretend implementations.

## Usage

```bash
# Via npx tsx (recommended during development)
npx tsx packages/theme-engine/src/theme-cli.ts <command> <input-file.json>

# Via bin (if tsx is globally available and the package is linked)
letbuyy-theme <command> <input-file.json>
```

## Commands

### `validate <bundle.json>`

Parses and validates a `LiquidThemePackageBundle` JSON file through the Zod schema
and the schema_version compatibility gate.

Output:
```json
{ "ok": true, "issues": [] }
```
or:
```json
{ "ok": false, "issues": ["Unsupported Liquid bundle schema_version ..."] }
```

Delegates to: `validateTheme()` in `theme-sdk.ts`.

### `lint <bundle.json>`

Validates the bundle first. If validation fails, returns the validation issues
formatted as lint errors. If valid, runs `lintThemeBundle()` and returns all issues.

Output (array of `ThemeLintIssue` objects):
```json
[
  {
    "rule": "forbidden-tag",
    "level": "error",
    "sectionType": "hero-banner",
    "message": "Section \"hero-banner\" contains forbidden tag \"<script>\"..."
  }
]
```

An empty array means no lint issues.

Delegates to: `validateTheme()` + `lintTheme()` in `theme-sdk.ts`.

### `compile <portable-config.json>`

Compiles a `PortableThemeTemplateConfig` JSON file into a `LiquidThemePackageBundle`
and outputs a summary.

Input shape:
```json
{
  "themeId": "my-theme",
  "themeSettings": { "primaryColor": "#1a1a1a" },
  "sections": {
    "template": [{ "type": "hero", "settings": { "heading": "Hello" }, "isVisible": true }]
  }
}
```

Output:
```json
{
  "slug": "my-theme",
  "warnings": [],
  "sectionCount": 1
}
```

Delegates to: `compileTheme()` in `theme-sdk.ts`.

### `export <bundle.json>`

Validates the bundle, then exports its file tree and returns a list of `{path, sizeBytes}`
descriptors (file contents are omitted from stdout for brevity).

Output:
```json
[
  { "path": "layout/theme.liquid", "sizeBytes": 412 },
  { "path": "sections/hero-banner.liquid", "sizeBytes": 1024 },
  ...
]
```

To write the files to disk, use the generator script:
```bash
node --import tsx/esm packages/theme-engine/examples/generate-examples.mjs
```

Delegates to: `validateTheme()` + `exportThemeBundleToFiles()`.

## COMMANDS map (testable surface)

`theme-cli.ts` also exports a `COMMANDS` map that test files import directly:

```ts
import { COMMANDS } from '../src/theme-cli.ts';

const result = await COMMANDS.validate(JSON.stringify(myBundle));
// => { ok: true, issues: [] }
```

This avoids subprocess spawning in tests and makes every command exercisable in-process.

## Exit codes

| Exit code | Meaning |
|-----------|---------|
| 0 | Command ran successfully (validate/lint may still report issues in the output) |
| 1 | Usage error, input file not found, or unhandled command error |
