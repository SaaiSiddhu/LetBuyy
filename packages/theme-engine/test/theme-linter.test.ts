// H4 tests — Theme Linter
//
// The ThemeLiquidSourceSchema (Zod) already rejects <script>, javascript:, etc. at parse time, so
// we CANNOT create a LiquidThemePackageBundle with forbidden content via LiquidThemePackageBundleSchema.parse().
// Instead, we clone the Urban Kicks fixture (already a valid parsed bundle) and replace `sections`
// directly on the plain object, then cast to LiquidThemePackageBundle.  This lets us test the
// linter's independent content-scan logic without fighting the Zod schema.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createUrbanKicksLiquidThemeBundleFixture, type LiquidThemePackageBundle, type ThemeLiquidSectionFile } from '../src/theme-bundle.ts';
import { lintThemeBundle } from '../src/theme-linter.ts';

// ---- helpers ----

type SectionMap = Record<string, ThemeLiquidSectionFile>;

const BASE_SECTION_SCHEMA = {
  name: 'Test Section',
  settings: [] as Array<{ id: string; type: string; label: string }>,
  blocks: [] as never[],
  presets: [] as never[],
  enabled_on: { templates: ['*' as const] },
  disabled_on: { templates: [] as never[] },
};

/**
 * Clone the Urban Kicks fixture, then override `sections` with the provided map.
 * The cast bypasses Zod so the linter can inspect content the schema would reject.
 */
function makeBundle(sections: SectionMap): LiquidThemePackageBundle {
  const base = createUrbanKicksLiquidThemeBundleFixture();
  return { ...base, sections } as unknown as LiquidThemePackageBundle;
}

function testSection(source: string, schemaOverride?: Partial<typeof BASE_SECTION_SCHEMA>): ThemeLiquidSectionFile {
  return {
    path: 'sections/test-section.liquid',
    source,
    schema: { ...BASE_SECTION_SCHEMA, ...schemaOverride },
  } as unknown as ThemeLiquidSectionFile;
}

// (1) Urban Kicks fixture — clean bundle, no error-level issues
test('theme-linter: Urban Kicks fixture has no error-level lint issues (clean bundle lints clean)', () => {
  const fixture = createUrbanKicksLiquidThemeBundleFixture();
  const issues = lintThemeBundle(fixture);
  const errors = issues.filter((i) => i.level === 'error');
  assert.equal(errors.length, 0, `Expected no error-level issues but got: ${errors.map((e) => e.message).join(', ')}`);
});

// (2) forbidden-tag: <script> in source triggers error
test('theme-linter: <script> tag in section source triggers forbidden-tag error', () => {
  const bundle = makeBundle({
    'test-section': testSection('<script>alert(1)</script>{% schema %}{}{% endschema %}'),
  });
  const issues = lintThemeBundle(bundle);
  const scriptIssue = issues.find((i) => i.rule === 'forbidden-tag' && i.message.includes('script'));
  assert.ok(scriptIssue, 'Expected a forbidden-tag issue for <script>');
  assert.equal(scriptIssue.level, 'error');
});

// (3) forbidden-attr (driven by the sanitizer FORBID_ATTR list — today: style)
test('theme-linter: inline style= attribute triggers forbidden-attr error', () => {
  const bundle = makeBundle({
    'test-section': testSection('<div style="color:red">{% schema %}{}{% endschema %}</div>'),
  });
  const issues = lintThemeBundle(bundle);
  const styleIssue = issues.find((i) => i.rule === 'forbidden-attr');
  assert.ok(styleIssue, 'Expected a forbidden-attr issue for style=');
  assert.equal(styleIssue.level, 'error');
});

// (4) forbidden-tag: <base> triggers forbidden-tag
test('theme-linter: <base> tag triggers forbidden-tag error', () => {
  const bundle = makeBundle({
    'test-section': testSection('<base href="x">{% schema %}{}{% endschema %}'),
  });
  const issues = lintThemeBundle(bundle);
  const baseIssue = issues.find((i) => i.rule === 'forbidden-tag' && i.message.includes('base'));
  assert.ok(baseIssue, 'Expected a forbidden-tag issue for <base>');
  assert.equal(baseIssue.level, 'error');
});

// (5) forbidden-tag: <embed> triggers forbidden-tag
test('theme-linter: <embed> tag triggers forbidden-tag error', () => {
  const bundle = makeBundle({
    'test-section': testSection('<embed src="x">{% schema %}{}{% endschema %}'),
  });
  const issues = lintThemeBundle(bundle);
  const embedIssue = issues.find((i) => i.rule === 'forbidden-tag' && i.message.includes('embed'));
  assert.ok(embedIssue, 'Expected a forbidden-tag issue for <embed>');
  assert.equal(embedIssue.level, 'error');
});

// (6) unknown-section-type: 'test-section' is not in BUILT_IN_SECTION_SCHEMAS or parity set
test('theme-linter: section type not in built-in or parity registry triggers unknown-section-type warn', () => {
  const bundle = makeBundle({
    'test-section': testSection(
      '<section data-section-id="{{ section.id }}">{% schema %}{}{% endschema %}</section>',
    ),
  });
  const issues = lintThemeBundle(bundle);
  const unknownIssue = issues.find((i) => i.rule === 'unknown-section-type');
  assert.ok(unknownIssue, 'Expected an unknown-section-type issue for "test-section"');
  assert.equal(unknownIssue.level, 'warn');
});

// (7) setting-referenced-not-in-schema
test('theme-linter: {{ section.settings.nonexistent }} triggers setting-referenced-not-in-schema warn', () => {
  const source = [
    '<h2>{{ section.settings.nonexistent }}</h2>',
    '{% schema %}',
    '{"name":"T","settings":[{"id":"title","type":"text","label":"T"}],"blocks":[],"presets":[],"enabled_on":{"templates":["*"]},"disabled_on":{"templates":[]}}',
    '{% endschema %}',
  ].join('\n');
  const bundle = makeBundle({
    'test-section': testSection(source, {
      name: 'T',
      settings: [{ id: 'title', type: 'text', label: 'T' }],
    }),
  });
  const issues = lintThemeBundle(bundle);
  const settingIssue = issues.find(
    (i) => i.rule === 'setting-referenced-not-in-schema' && i.message.includes('nonexistent'),
  );
  assert.ok(settingIssue, 'Expected a setting-referenced-not-in-schema issue for "nonexistent"');
  assert.equal(settingIssue.level, 'warn');
});
