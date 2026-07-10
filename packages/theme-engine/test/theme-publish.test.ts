// K4 tests — Theme Publish Manifest Builder
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildThemePublishManifest } from '../src/theme-publish.ts';
import {
  createMinimalLiquidThemeBundleFixture,
  createUrbanKicksLiquidThemeBundleFixture,
  THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
} from '../src/theme-bundle.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core.ts';

const SHA256_HEX = /^[0-9a-f]{64}$/;

// ---- Determinism ----

test('theme-publish: buildThemePublishManifest is deterministic (identical output on repeated calls)', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const m1 = buildThemePublishManifest(bundle);
  const m2 = buildThemePublishManifest(bundle);
  assert.deepEqual(m1, m2);
});

test('theme-publish: minimal fixture manifest is deterministic', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const m1 = buildThemePublishManifest(bundle);
  const m2 = buildThemePublishManifest(bundle);
  assert.deepEqual(m1, m2);
});

// ---- Identity fields ----

test('theme-publish: slug matches bundle.package.slug', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.equal(manifest.slug, bundle.package.slug);
});

test('theme-publish: name matches bundle.package.name', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.equal(manifest.name, bundle.package.name);
});

test('theme-publish: version matches bundle.package.version', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.equal(manifest.version, bundle.package.version);
});

test('theme-publish: schema_version matches bundle.schema_version', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.equal(manifest.schema_version, THEME_LIQUID_BUNDLE_SCHEMA_VERSION);
});

test('theme-publish: compatibility_range matches bundle.package.compatibility_range', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.equal(manifest.compatibility_range, bundle.package.compatibility_range);
});

// ---- Content fingerprint ----

test('theme-publish: contentHash is a valid SHA-256 hex string', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.ok(SHA256_HEX.test(manifest.contentHash), `contentHash "${manifest.contentHash}" is not a valid SHA-256`);
});

test('theme-publish: files array is non-empty and has valid checksums', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.ok(manifest.files.length > 0, 'Expected at least one file');
  for (const f of manifest.files) {
    assert.ok(f.path.length > 0, 'File path must not be empty');
    assert.ok(SHA256_HEX.test(f.checksum), `File checksum "${f.checksum}" is not a valid SHA-256`);
    assert.ok(typeof f.sizeBytes === 'number' && f.sizeBytes >= 0, 'sizeBytes must be non-negative');
  }
});

test('theme-publish: checksums record keys match file paths', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  const filePaths = new Set(manifest.files.map((f) => f.path));
  const checksumPaths = new Set(Object.keys(manifest.checksums));
  assert.deepEqual(filePaths, checksumPaths);
});

// ---- Provenance ----

test('theme-publish: provenance.engine is "liquid" for Liquid bundles', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.equal(manifest.provenance.engine, 'liquid');
});

test('theme-publish: provenance.renderer_version is a non-empty string', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.ok(manifest.provenance.renderer_version.length > 0);
});

// ---- Summary stats ----

test('theme-publish: schema_verified is true for a valid bundle', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.equal(manifest.schema_verified, true);
});

test('theme-publish: section_count matches Object.keys(bundle.sections).length', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.equal(manifest.section_count, Object.keys(bundle.sections).length);
});

test('theme-publish: block_count matches Object.keys(bundle.blocks).length', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.equal(manifest.block_count, Object.keys(bundle.blocks).length);
});

test('theme-publish: exported_file_count matches files.length', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.equal(manifest.exported_file_count, manifest.files.length);
});

test('theme-publish: lint_issue_count is a non-negative integer', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.ok(Number.isInteger(manifest.lint_issue_count), 'lint_issue_count must be an integer');
  assert.ok(manifest.lint_issue_count >= 0, 'lint_issue_count must be >= 0');
});

// ---- Cross-fixture consistency ----

test('theme-publish: different bundles produce different contentHashes', () => {
  const bundle1 = createMinimalLiquidThemeBundleFixture();
  const bundle2 = createUrbanKicksLiquidThemeBundleFixture();
  const m1 = buildThemePublishManifest(bundle1);
  const m2 = buildThemePublishManifest(bundle2);
  assert.notEqual(m1.contentHash, m2.contentHash, 'Different bundles should have different contentHashes');
});

test('theme-publish: Letbuyy Core manifest has schema_verified=true', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);
  assert.equal(manifest.schema_verified, true);
});

test('theme-publish: manifest has all required fields', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const manifest = buildThemePublishManifest(bundle);

  const requiredFields: Array<keyof typeof manifest> = [
    'slug', 'name', 'version', 'schema_version', 'compatibility_range',
    'contentHash', 'files', 'checksums', 'provenance',
    'lint_issue_count', 'schema_verified', 'section_count', 'block_count', 'exported_file_count',
  ];
  for (const field of requiredFields) {
    assert.ok(field in manifest, `Missing required field: ${field}`);
  }
});
