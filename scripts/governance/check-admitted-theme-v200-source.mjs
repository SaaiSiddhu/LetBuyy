#!/usr/bin/env node
// Forensic reproduction only. The admitted release and active theme factory
// remain unchanged; this script runs their historical sources in a temp copy.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const recoveryPath = 'docs/implementation/niche-theme-programme/release-v2/recovered-admitted-source/recovery-manifest.json';
const sha = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(join(root, path));
const canonical = value => {
  const sort = input => Array.isArray(input) ? input.map(sort)
    : input && typeof input === 'object'
      ? Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sort(item)]))
      : input;
  return JSON.stringify(sort(JSON.parse(JSON.stringify(value))));
};

const recovery = JSON.parse(read(recoveryPath));
assert.equal(recovery.status, 'FORENSIC_RECOVERY_NOT_ACTIVE_SOURCE');
const manifest = JSON.parse(read(recovery.admissionManifest));
const historical = new Map();
for (const row of recovery.entries) historical.set(row.admittedPath, row.recoveredPath);
for (const row of recovery.existingSnapshots) historical.set(row.admittedPath, row.snapshotPath);
for (const [path, archived] of historical) {
  const bytes = read(archived);
  assert.equal(sha(bytes), manifest.sourceHashes[path], `admitted source bytes changed: ${path}`);
}
const themeSources = [...historical].filter(([path]) => path.startsWith('packages/theme-engine/src/'));
assert.equal(themeSources.length, 20, 'the nine 2.0.0 theme factories need all 20 original source files');

const temporary = mkdtempSync(join(tmpdir(), 'letbuyy-admitted-v200-'));
try {
  const packageRoot = join(temporary, 'packages/theme-engine');
  mkdirSync(packageRoot, { recursive: true });
  cpSync(join(root, 'packages/theme-engine/src'), join(packageRoot, 'src'), { recursive: true });
  cpSync(join(root, 'packages/theme-engine/package.json'), join(packageRoot, 'package.json'));
  symlinkSync(join(root, 'node_modules'), join(temporary, 'node_modules'), 'dir');
  symlinkSync(join(root, 'packages/theme-engine/node_modules'), join(packageRoot, 'node_modules'), 'dir');
  for (const [path, archived] of themeSources) writeFileSync(join(temporary, path), read(archived));
  const { createFirstPartyCatalogBundle } = await import(pathToFileURL(join(packageRoot, 'src/first-party-theme-catalog.ts')).href);
  const defaultResults = Object.entries(manifest.protected.defaultFactorySha256).map(([slug, expected]) => ({
    slug, match: sha(canonical(createFirstPartyCatalogBundle(slug))) === expected,
  }));
  const directory = dirname(join(root, recovery.admissionManifest));
  const v200Results = manifest.artifacts.map(row => {
    const artifact = JSON.parse(readFileSync(join(directory, row.file), 'utf8'));
    return { slug: row.slug, match: sha(canonical(createFirstPartyCatalogBundle(row.slug, { designVersion: '2.0.0' }))) === artifact.bundleSha256 };
  });
  const result = {
    status: 'HISTORICAL_FACTORY_PARITY_ONLY',
    archivedOriginalsVerified: historical.size,
    themeSourcesInIsolatedFactory: themeSources.length,
    frozenDefaults: { match: defaultResults.filter(row => row.match).length, total: defaultResults.length },
    admittedV200: { match: v200Results.filter(row => row.match).length, total: v200Results.length },
    mismatches: [...defaultResults, ...v200Results].filter(row => !row.match).map(row => row.slug),
  };
  console.info(JSON.stringify(result));
  assert.equal(result.frozenDefaults.match, 10);
  assert.equal(result.admittedV200.match, 9);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
