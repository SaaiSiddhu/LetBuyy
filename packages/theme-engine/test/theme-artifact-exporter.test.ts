// H2 tests — Theme Artifact Exporter
import assert from 'node:assert/strict';
import test from 'node:test';
import { createUrbanKicksLiquidThemeBundleFixture } from '../src/theme-bundle.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core.ts';
import { exportThemeBundleToFiles, UnsafeThemeArtifactPathError } from '../src/theme-artifact-exporter.ts';

// Helper: get artifact by path (throws if missing)
function artifact(artifacts: ReturnType<typeof exportThemeBundleToFiles>, path: string) {
  const a = artifacts.find((f) => f.path === path);
  assert.ok(a, `Expected artifact at path "${path}"`);
  return a;
}

// (1) BYTE-IDENTITY — section sources in exported artifacts exactly match bundle.sections[*].source
test('theme-artifact-exporter: section artifact contents are byte-identical to bundle section sources (Urban Kicks)', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const artifacts = exportThemeBundleToFiles(bundle);

  for (const [, section] of Object.entries(bundle.sections)) {
    const a = artifact(artifacts, section.path);
    assert.equal(
      a.contents,
      section.source,
      `Byte-identity check failed for section at path "${section.path}"`,
    );
  }
});

// (2) BYTE-IDENTITY — layout source matches
test('theme-artifact-exporter: layout/theme.liquid contents are byte-identical to bundle.layout.theme.source', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const artifacts = exportThemeBundleToFiles(bundle);
  const a = artifact(artifacts, bundle.layout.theme.path);
  assert.equal(a.contents, bundle.layout.theme.source);
});

// (3) config/settings_schema.json round-trips through JSON.parse
test('theme-artifact-exporter: config/settings_schema.json round-trips through JSON.parse', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const artifacts = exportThemeBundleToFiles(bundle);
  const a = artifact(artifacts, 'config/settings_schema.json');
  const parsed = JSON.parse(a.contents);
  assert.deepEqual(parsed, bundle.config.settings_schema);
});

// (4) output is sorted ascending by .path
test('theme-artifact-exporter: output files are sorted ascending by path', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const artifacts = exportThemeBundleToFiles(bundle);
  for (let i = 1; i < artifacts.length; i++) {
    assert.ok(
      artifacts[i - 1].path <= artifacts[i].path,
      `Files not sorted: "${artifacts[i - 1].path}" should come before "${artifacts[i].path}"`,
    );
  }
});

// (5) no artifact path starts with '/' or contains '..'
test('theme-artifact-exporter: no artifact path starts with / or contains ..', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const artifacts = exportThemeBundleToFiles(bundle);
  for (const a of artifacts) {
    assert.ok(!a.path.startsWith('/'), `Path "${a.path}" must not start with /`);
    assert.ok(!a.path.includes('..'), `Path "${a.path}" must not contain ..`);
  }
});

test('theme-artifact-exporter: a bundle with a traversal template key is rejected fail-closed', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  // Inject a malicious template key that would escape the theme directory when composed into a path.
  const poisoned = {
    ...bundle,
    templates: { ...bundle.templates, '../../etc/evil': bundle.templates.index },
  };
  assert.throws(
    () => exportThemeBundleToFiles(poisoned as typeof bundle),
    (err: unknown) => err instanceof UnsafeThemeArtifactPathError,
  );
});

// (6) calling exportThemeBundleToFiles twice with the same bundle returns identical output
test('theme-artifact-exporter: two calls with same bundle produce identical output (determinism)', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const first = exportThemeBundleToFiles(bundle);
  const second = exportThemeBundleToFiles(bundle);
  assert.deepEqual(first, second, 'exportThemeBundleToFiles must be deterministic');
});

// (7) BYTE-IDENTITY — Letbuyy Core fixture
test('theme-artifact-exporter: section artifact contents are byte-identical to bundle section sources (Letbuyy Core)', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const artifacts = exportThemeBundleToFiles(bundle);

  for (const [, section] of Object.entries(bundle.sections)) {
    const a = artifact(artifacts, section.path);
    assert.equal(
      a.contents,
      section.source,
      `Byte-identity check failed for Letbuyy Core section at path "${section.path}"`,
    );
  }
});
