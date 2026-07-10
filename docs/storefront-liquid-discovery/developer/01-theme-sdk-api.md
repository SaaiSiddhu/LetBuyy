# Theme SDK API Reference

Package: `@letbuyy/theme-engine`
Entry: `packages/theme-engine/src/theme-sdk.ts`

The Theme SDK is a thin facade over existing internal functions. Every call delegates
to a real capability; there are no stubs. Six functions are exported:

---

## `validateTheme(input: unknown): ValidateThemeResult`

Validates a raw (potentially unknown-shape) value against the `LiquidThemePackageBundleSchema`
Zod schema, then enforces the schema_version compatibility gate (G4).

### Returns

```ts
interface ValidateThemeResult {
  ok: boolean;
  issues: string[];       // empty on success
  bundle?: LiquidThemePackageBundle;  // present only when ok === true
}
```

### Behaviour

1. Runs `collectLiquidThemePackageBundleIssues(input)` (Zod safeParse, no throw).
   Returns `{ok: false, issues}` on any Zod failure.
2. Calls `parseLiquidThemePackageBundle(input)` which:
   - Parses through Zod (throws `ZodError` on failure).
   - Throws `UnsupportedLiquidBundleSchemaVersionError` when `schema_version` is not in
     `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS`.
3. All errors are caught and returned as `{ok: false, issues: [message]}`.

### Example

```ts
import { validateTheme } from '@letbuyy/theme-engine';

const raw = JSON.parse(fs.readFileSync('my-bundle.json', 'utf8'));
const result = validateTheme(raw);
if (!result.ok) {
  console.error('Validation failed:', result.issues);
  process.exit(1);
}
console.log('Bundle is valid:', result.bundle!.package.slug);
```

---

## `compileTheme(config, options?): CompileThemeResult`

Compiles a `PortableThemeTemplateConfig` (the React section model) into a
`LiquidThemePackageBundle` that the `LiquidRenderer` can render.

Delegates to `compilePortableToLiquidBundle` in `portable-to-liquid.ts`.

### Signature

```ts
interface CompileThemeOptions {
  slug?: string;
  name?: string;
}

interface CompileThemeResult {
  bundle: LiquidThemePackageBundle;
  warnings: string[];
}

function compileTheme(
  config: PortableThemeTemplateConfig,
  options?: CompileThemeOptions,
): CompileThemeResult;
```

### Example

```ts
import { compileTheme } from '@letbuyy/theme-engine';

const result = compileTheme({
  themeId: 'my-theme',
  themeSettings: { primaryColor: '#1a1a1a' },
  sections: {
    template: [{ type: 'hero', settings: { heading: 'Welcome' }, isVisible: true }],
  },
});

console.log('Sections:', Object.keys(result.bundle.sections));
console.log('Warnings:', result.warnings);
```

---

## `lintTheme(bundle: LiquidThemePackageBundle): ThemeLintIssue[]`

Re-export of `lintThemeBundle` from `theme-linter.ts`. Scans every section source
for content the renderer's DOMPurify pass will reject (forbidden-tag, forbidden-style-attr)
and for structural issues (unknown-section-type, missing-schema-block, setting-referenced-not-in-schema).

### ThemeLintIssue

```ts
type ThemeLintRule =
  | 'unknown-section-type'       // warn — section not in registry (may be custom)
  | 'forbidden-tag'              // error — <script>, <embed>, <object>, <base>
  | 'forbidden-style-attr'       // error — inline style= attribute
  | 'missing-schema-block'       // error — no {% schema %} / {% endschema %}
  | 'setting-referenced-not-in-schema'; // warn — heuristic; false positives possible

interface ThemeLintIssue {
  level: 'error' | 'warn';
  rule: ThemeLintRule;
  sectionType: string;
  message: string;
}
```

### Deny-list source

`LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` from `theme-renderer.ts` is the single source
of truth. The linter never hardcodes what the renderer rejects.

Current deny-lists:
- `FORBID_TAGS`: `['base', 'embed', 'object', 'script']`
- `FORBID_ATTR`: `['style']`

---

## `renderPreview(bundle, opts?): Promise<ThemeRendererResult>`

Renders a preview of a `LiquidThemePackageBundle` using `LiquidRenderer` (the same renderer
used in the storefront). Returns a `ThemeRendererResult` whose `.status` is one of
`'rendered' | 'unsupported' | 'error'`.

**Environment requirement:** `LiquidRenderer` instantiates JSDOM. This function requires
a full Node.js environment with `jsdom` installed. It cannot run in edge or browser runtimes.

### Options

```ts
interface RenderPreviewOptions {
  templateKey?: string;  // e.g. 'index', 'product', 'collection' — default is index
  drops?: Record<string, unknown>;  // Liquid drop data (product, collection, etc.)
  locale?: string;  // e.g. 'en', 'hi' — default 'en'
}
```

### Result shape (from ThemeRendererResult)

```ts
{
  status: 'rendered' | 'unsupported' | 'error';
  engine: 'liquid';
  liquid?: {
    layoutHtml: string;
    contentForLayout: string;
    sections: LiquidRenderedSection[];
  };
  // error field present when status === 'error'
}
```

---

## `listSectionTypes(): readonly string[]`

Returns the deduplicated, alphabetically-sorted union of:
- 25 camelCase built-in React section types (e.g. `heroBanner`, `header`)
- kebab-case Liquid parity types from `THEME_LIQUID_PORTABLE_SECTION_PARITY` (e.g. `hero-banner`)
- kebab-case keys from `createLiquidParitySectionFiles()`

Returns at least 20 entries. All entries are non-empty strings.

---

## `getSectionSchema(type: string): SectionSchema | null`

Looks up the `SectionSchema` for a camelCase built-in section type (`BUILT_IN_SECTION_SCHEMAS`).
Returns `null` for unknown types (including kebab-case Liquid types, which carry their schema
inline in the section file's `{% schema %}` block).

```ts
const schema = getSectionSchema('header');
// => { type: 'header', name: 'Header', settings: [...], ... }

getSectionSchema('no-such-type');
// => null
```
