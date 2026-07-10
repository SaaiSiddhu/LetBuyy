// H1 tests — Theme SDK public facade
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileTheme,
  validateTheme,
  lintTheme,
  renderPreview,
  listSectionTypes,
  getSectionSchema,
} from '../src/theme-sdk.ts';
import { createUrbanKicksLiquidThemeBundleFixture } from '../src/theme-bundle.ts';

// (1) compileTheme — returns a bundle whose sections include 'hero-banner'
test('theme-sdk: compileTheme with a minimal portable config returns a bundle with a hero-banner section', () => {
  const result = compileTheme({
    themeId: 'test-theme',
    themeSettings: {
      primaryColor: '#000',
    },
    sections: {
      template: [{ type: 'hero', settings: { heading: 'Hello' }, isVisible: true }],
    },
  });
  assert.ok(result.bundle, 'Expected bundle in result');
  assert.ok(result.bundle.sections['hero-banner'], 'Expected hero-banner section in compiled bundle');
  assert.ok(Array.isArray(result.warnings), 'Expected warnings to be an array');
});

// (2) validateTheme — Urban Kicks fixture is valid
test('theme-sdk: validateTheme with Urban Kicks fixture returns {ok: true, issues: []}', () => {
  const fixture = createUrbanKicksLiquidThemeBundleFixture();
  const result = validateTheme(fixture);
  assert.equal(result.ok, true, `Expected ok=true but got issues: ${result.issues.join(', ')}`);
  assert.deepEqual(result.issues, []);
  assert.ok(result.bundle, 'Expected bundle to be present on success');
});

// (3) validateTheme — empty object is invalid
test('theme-sdk: validateTheme with {} returns {ok: false} with non-empty issues', () => {
  const result = validateTheme({});
  assert.equal(result.ok, false);
  assert.ok(result.issues.length > 0, 'Expected at least one issue string');
});

// (4) validateTheme — explicit unknown schema_version triggers version gate
test('theme-sdk: validateTheme with unknown schema_version returns {ok: false} with "Unsupported" in issues', () => {
  const fixture = createUrbanKicksLiquidThemeBundleFixture();
  const tampered = { ...fixture, schema_version: '9999-future-version' };
  const result = validateTheme(tampered);
  assert.equal(result.ok, false, 'Expected ok=false for unknown schema_version');
  const hasUnsupportedMsg = result.issues.some((i) => i.includes('Unsupported'));
  assert.ok(hasUnsupportedMsg, `Expected an "Unsupported" message in issues but got: ${result.issues.join('; ')}`);
});

// (5) listSectionTypes — length >= 20 and all entries are non-empty strings
test('theme-sdk: listSectionTypes returns >= 20 entries, all non-empty strings', () => {
  const types = listSectionTypes();
  assert.ok(types.length >= 20, `Expected >= 20 section types but got ${types.length}`);
  for (const t of types) {
    assert.ok(typeof t === 'string' && t.length > 0, `Expected non-empty string but got: ${JSON.stringify(t)}`);
  }
});

// (6) getSectionSchema — 'header' returns an object with a .type field
test('theme-sdk: getSectionSchema("header") returns an object with a .type field', () => {
  const schema = getSectionSchema('header');
  assert.ok(schema !== null, 'Expected a schema for "header"');
  assert.ok(typeof schema === 'object', 'Expected schema to be an object');
  assert.ok('type' in schema, 'Expected schema to have a .type field');
});

// (7) getSectionSchema — unknown type returns null
test('theme-sdk: getSectionSchema("no-such-type") returns null', () => {
  const schema = getSectionSchema('no-such-type');
  assert.equal(schema, null);
});

// renderPreview type-check: returns a Promise (runtime shape verified without asserting HTML)
test('theme-sdk: renderPreview returns a Promise that resolves to an object with .status and .engine', async () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const promise = renderPreview(bundle, { templateKey: 'index' });
  assert.ok(promise instanceof Promise, 'Expected renderPreview to return a Promise');
  const result = await promise;
  assert.ok(result !== null && typeof result === 'object', 'Expected a result object');
  assert.ok('status' in result, 'Expected result.status to be present');
  assert.ok('engine' in result && result.engine === 'liquid', 'Expected result.engine === "liquid"');
});

// lintTheme is the same as lintThemeBundle — verify it is callable
test('theme-sdk: lintTheme(Urban Kicks) returns an array with no error-level issues', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const issues = lintTheme(bundle);
  assert.ok(Array.isArray(issues), 'Expected issues to be an array');
  const errors = issues.filter((i) => i.level === 'error');
  assert.equal(errors.length, 0, `Expected no error-level issues but got: ${errors.map((e) => e.message).join(', ')}`);
});
