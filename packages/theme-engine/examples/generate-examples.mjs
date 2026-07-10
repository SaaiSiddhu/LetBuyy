#!/usr/bin/env node
// H3 — Theme Example Generator
//
// Writes committed example artifacts for:
//   - Urban Kicks (first-party Liquid storefront theme)
//   - LetBuyy Core (neutral-branded alias of Urban Kicks)
//
// Usage (run from repo root):
//   node packages/theme-engine/examples/generate-examples.mjs
//
// Or from the package directory:
//   node examples/generate-examples.mjs
//
// HONESTY CONTRACT: this script calls REAL SDK functions — createUrbanKicksLiquidThemeBundleFixture(),
// createLetbuyyCoreLiquidThemeBundleFixture(), and exportThemeBundleToFiles() — and writes their
// exact output to disk. The committed output IS the canonical fixture; tests compare against it for
// drift detection.
//
// Re-run this script whenever the fixture or exporter changes, then commit the updated output.

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..');

// Load the SDK via tsx register so we can import TypeScript sources directly.
// tsx must be available in devDependencies or globally.
const require = createRequire(import.meta.url);

// We use dynamic import so tsx register activates first.
// tsx needs to be invoked via --import or via the tsx binary; since we're
// running under `node examples/generate-examples.mjs` we need tsx/esm register.
// The package.json bin script (if added) should use `tsx examples/generate-examples.mjs`.
// When run as `node --import tsx/esm examples/generate-examples.mjs` it works fine.
// When run without tsx we fall back to built dist if available.

let createUrbanKicksLiquidThemeBundleFixture;
let createLetbuyyCoreLiquidThemeBundleFixture;
let exportThemeBundleToFiles;
let packageThemeBundle;

try {
  // Try TypeScript source (tsx environment)
  const bundleModule = await import('../src/theme-bundle.ts');
  const coreModule = await import('../src/theme-bundle-core.ts');
  const exporterModule = await import('../src/theme-artifact-exporter.ts');
  const packagerModule = await import('../src/theme-packager.ts');

  createUrbanKicksLiquidThemeBundleFixture = bundleModule.createUrbanKicksLiquidThemeBundleFixture;
  createLetbuyyCoreLiquidThemeBundleFixture = coreModule.createLetbuyyCoreLiquidThemeBundleFixture;
  exportThemeBundleToFiles = exporterModule.exportThemeBundleToFiles;
  packageThemeBundle = packagerModule.packageThemeBundle;
} catch {
  // Fallback: try compiled dist/index.js
  const dist = await import('../dist/index.js');
  createUrbanKicksLiquidThemeBundleFixture = dist.createUrbanKicksLiquidThemeBundleFixture;
  createLetbuyyCoreLiquidThemeBundleFixture = dist.createLetbuyyCoreLiquidThemeBundleFixture;
  exportThemeBundleToFiles = dist.exportThemeBundleToFiles;
  packageThemeBundle = dist.packageThemeBundle;
}

// ---- Write a bundle's file artifacts to examples/<slug>/ ----

function writeBundle(bundle) {
  const slug = bundle.package.slug;
  const outDir = join(packageRoot, 'examples', slug);

  // Write the raw bundle JSON (the source of truth)
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'bundle.json'),
    JSON.stringify(bundle, null, 2) + '\n',
    'utf8',
  );

  // Write each file artifact
  const artifacts = exportThemeBundleToFiles(bundle);
  for (const artifact of artifacts) {
    const filePath = join(outDir, 'files', artifact.path);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, artifact.contents, 'utf8');
  }

  // Write the package manifest
  const manifest = packageThemeBundle(bundle);
  writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );

  console.log(`[generate-examples] wrote ${artifacts.length + 2} files for "${slug}" → examples/${slug}/`);
  return { slug, artifactCount: artifacts.length, contentHash: manifest.contentHash };
}

// ---- Main ----

const ukBundle = createUrbanKicksLiquidThemeBundleFixture();
const coreBundle = createLetbuyyCoreLiquidThemeBundleFixture();

const results = [
  writeBundle(ukBundle),
  writeBundle(coreBundle),
];

// Write a top-level index.json for quick discovery
writeFileSync(
  join(packageRoot, 'examples', 'index.json'),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      bundles: results,
    },
    null,
    2,
  ) + '\n',
  'utf8',
);

console.log('[generate-examples] done — index.json written');
