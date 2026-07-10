// H3 tests — Theme Example Drift Detection
//
// These tests enforce that the committed example files under examples/<slug>/
// remain byte-identical to what the live fixture + exporter produce.
//
// When a fixture or exporter change is intentional, re-run:
//   node --import tsx/esm packages/theme-engine/examples/generate-examples.mjs
// then commit the updated output.
//
// Three invariants:
//   1. bundle.json drift — the committed JSON equals the live fixture output
//   2. file artifact drift — every exported file matches the committed file under files/
//   3. manifest.json drift — the committed manifest matches the live packager output

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createUrbanKicksLiquidThemeBundleFixture } from '../src/theme-bundle.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core.ts';
import { exportThemeBundleToFiles } from '../src/theme-artifact-exporter.ts';
import { packageThemeBundle } from '../src/theme-packager.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesRoot = join(__dirname, '..', 'examples');

// ---- helpers ----

function committedText(slug: string, relPath: string): string {
  const absPath = join(examplesRoot, slug, relPath);
  assert.ok(
    existsSync(absPath),
    `Committed example file missing: examples/${slug}/${relPath}\n`
      + `Run: node --import tsx/esm packages/theme-engine/examples/generate-examples.mjs`,
  );
  return readFileSync(absPath, 'utf8');
}

function committedJson(slug: string, relPath: string): unknown {
  return JSON.parse(committedText(slug, relPath));
}

// ---- Urban Kicks drift tests ----

const UK_SLUG = 'urban-kicks-liquid';

test('theme-examples: Urban Kicks bundle.json is byte-identical to live createUrbanKicksLiquidThemeBundleFixture()', () => {
  const live = createUrbanKicksLiquidThemeBundleFixture();
  const committed = committedJson(UK_SLUG, 'bundle.json');
  assert.deepEqual(
    committed,
    live,
    `examples/${UK_SLUG}/bundle.json has drifted from the live fixture. Re-run generate-examples.mjs.`,
  );
});

test('theme-examples: Urban Kicks exported file artifacts match committed files/', () => {
  const live = createUrbanKicksLiquidThemeBundleFixture();
  const liveArtifacts = exportThemeBundleToFiles(live);

  for (const artifact of liveArtifacts) {
    const committed = committedText(UK_SLUG, `files/${artifact.path}`);
    assert.equal(
      artifact.contents,
      committed,
      `Drift detected in examples/${UK_SLUG}/files/${artifact.path}. Re-run generate-examples.mjs.`,
    );
  }
});

test('theme-examples: Urban Kicks manifest.json matches live packageThemeBundle() output', () => {
  const live = createUrbanKicksLiquidThemeBundleFixture();
  const liveManifest = packageThemeBundle(live);
  const committedManifest = committedJson(UK_SLUG, 'manifest.json');
  assert.deepEqual(
    committedManifest,
    liveManifest,
    `examples/${UK_SLUG}/manifest.json has drifted. Re-run generate-examples.mjs.`,
  );
});

// ---- LetBuyy Core drift tests ----

const CORE_SLUG = 'letbuyy-core-liquid';

test('theme-examples: LetBuyy Core bundle.json is byte-identical to live createLetbuyyCoreLiquidThemeBundleFixture()', () => {
  const live = createLetbuyyCoreLiquidThemeBundleFixture();
  const committed = committedJson(CORE_SLUG, 'bundle.json');
  assert.deepEqual(
    committed,
    live,
    `examples/${CORE_SLUG}/bundle.json has drifted from the live fixture. Re-run generate-examples.mjs.`,
  );
});

test('theme-examples: LetBuyy Core exported file artifacts match committed files/', () => {
  const live = createLetbuyyCoreLiquidThemeBundleFixture();
  const liveArtifacts = exportThemeBundleToFiles(live);

  for (const artifact of liveArtifacts) {
    const committed = committedText(CORE_SLUG, `files/${artifact.path}`);
    assert.equal(
      artifact.contents,
      committed,
      `Drift detected in examples/${CORE_SLUG}/files/${artifact.path}. Re-run generate-examples.mjs.`,
    );
  }
});

test('theme-examples: LetBuyy Core manifest.json matches live packageThemeBundle() output', () => {
  const live = createLetbuyyCoreLiquidThemeBundleFixture();
  const liveManifest = packageThemeBundle(live);
  const committedManifest = committedJson(CORE_SLUG, 'manifest.json');
  assert.deepEqual(
    committedManifest,
    liveManifest,
    `examples/${CORE_SLUG}/manifest.json has drifted. Re-run generate-examples.mjs.`,
  );
});

// ---- index.json well-formedness ----

test('theme-examples: index.json is valid JSON and contains entries for both bundles', () => {
  const index = committedJson('', 'index.json') as { bundles: Array<{ slug: string }> };
  const slugs = new Set(index.bundles.map((b) => b.slug));
  assert.ok(slugs.has(UK_SLUG), `index.json must contain "${UK_SLUG}"`);
  assert.ok(slugs.has(CORE_SLUG), `index.json must contain "${CORE_SLUG}"`);
});
