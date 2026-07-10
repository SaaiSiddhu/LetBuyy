// H5 tests — Theme Packager
import assert from 'node:assert/strict';
import test from 'node:test';
import { createUrbanKicksLiquidThemeBundleFixture } from '../src/theme-bundle.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core.ts';
import { packageThemeBundle } from '../src/theme-packager.ts';

const SHA256_HEX = /^[0-9a-f]{64}$/;

// (1) Determinism: two calls with same fixture produce deep-equal output
test('theme-packager: packageThemeBundle is deterministic (identical output on repeated calls)', () => {
  const fixture = createUrbanKicksLiquidThemeBundleFixture();
  const m1 = packageThemeBundle(fixture);
  const m2 = packageThemeBundle(fixture);
  assert.deepEqual(m1, m2);
});

// (2) slug matches bundle package slug
test('theme-packager: manifest slug equals bundle.package.slug', () => {
  const fixture = createUrbanKicksLiquidThemeBundleFixture();
  const m = packageThemeBundle(fixture);
  assert.equal(m.slug, fixture.package.slug);
});

// (3) schema_version matches bundle schema_version
test('theme-packager: manifest schema_version equals bundle.schema_version', () => {
  const fixture = createUrbanKicksLiquidThemeBundleFixture();
  const m = packageThemeBundle(fixture);
  assert.equal(m.schema_version, fixture.schema_version);
});

// (4) files array is non-empty and every entry has a valid SHA-256 hex checksum
test('theme-packager: all file entries have non-empty paths and valid SHA-256 checksums', () => {
  const fixture = createUrbanKicksLiquidThemeBundleFixture();
  const m = packageThemeBundle(fixture);
  assert.ok(m.files.length > 0, 'Expected at least one file in the manifest');
  for (const f of m.files) {
    assert.ok(f.path.length > 0, 'File path must not be empty');
    assert.ok(SHA256_HEX.test(f.checksum), `Checksum "${f.checksum}" is not a valid SHA-256 hex string`);
    assert.ok(typeof f.sizeBytes === 'number' && f.sizeBytes >= 0, 'sizeBytes must be a non-negative number');
  }
});

// (5) checksums record keys equal the .path values in the files array
test('theme-packager: checksums record keys match file paths', () => {
  const fixture = createUrbanKicksLiquidThemeBundleFixture();
  const m = packageThemeBundle(fixture);
  const filePaths = new Set(m.files.map((f) => f.path));
  const checksumPaths = new Set(Object.keys(m.checksums));
  assert.deepEqual(filePaths, checksumPaths, 'checksums record keys must equal the set of file paths');
});

// (6) contentHash is a non-empty hex string
test('theme-packager: contentHash is a non-empty hex string', () => {
  const fixture = createUrbanKicksLiquidThemeBundleFixture();
  const m = packageThemeBundle(fixture);
  assert.ok(m.contentHash.length > 0, 'contentHash must be non-empty');
  assert.ok(/^[0-9a-f]+$/.test(m.contentHash), `contentHash "${m.contentHash}" must be hex`);
});

// (7) Urban Kicks and Letbuyy Core produce different contentHash values
test('theme-packager: Urban Kicks and Letbuyy Core produce different contentHash values', () => {
  const ukManifest = packageThemeBundle(createUrbanKicksLiquidThemeBundleFixture());
  const coreManifest = packageThemeBundle(createLetbuyyCoreLiquidThemeBundleFixture());
  assert.notEqual(
    ukManifest.contentHash,
    coreManifest.contentHash,
    'Different bundles must produce different contentHash values',
  );
});
