import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog';
import { collectThemeTemplateValidationIssues, type ThemeTemplateValidationRuntime } from '../../../../packages/theme-engine/src/index';
import { LiquidThemePackageBundleSchema } from '../../../../packages/theme-engine/src/theme-bundle';
import { assertImmutableCapture, assertProposalIntegrity, buildProposal, canonicalJson,
  readAdmittedV200Artifacts, renderPromotionPair, sha256, SLUGS, writeDryRun, type Capture } from './generate-release';

const proposal = buildProposal();

test('nine 2.1.0 captures are deterministic, editor-valid, and bind the admitted predecessor', () => {
  const again = buildProposal();
  assert.equal(canonicalJson(again), canonicalJson(proposal));
  assertProposalIntegrity(proposal);
  assert.equal(proposal.artifacts.length, 9);
  assert.equal(new Set(proposal.artifacts.map(row => row.bundleSha256)).size, 9);
  const admitted = readAdmittedV200Artifacts();
  for (const row of proposal.artifacts) {
    assert.equal(row.version, '2.1.0');
    assert.equal(row.previousCatalogVersion, '2.0.0');
    assert.equal(row.previousArtifactSha256, admitted.payloadSha256[row.slug]);
    assert.equal(row.id, proposal.manifest.artifacts.find(item => item.slug === row.slug)?.id);
    const bundle = LiquidThemePackageBundleSchema.parse(row.document.liquidBundle);
    assert.equal(bundle.package.version_number, 5);
    const schema = row.persistence.schemaManifest;
    const runtime: ThemeTemplateValidationRuntime = {
      sectionSchemas: schema.section_schemas as ThemeTemplateValidationRuntime['sectionSchemas'],
      settingsSchema: schema.settings_schema as ThemeTemplateValidationRuntime['settingsSchema'],
    };
    assert.deepEqual(collectThemeTemplateValidationIssues({ templateConfig: row.document, runtime, themeSlug: row.slug }), []);
  }
});

test('generation preserves all default theme bytes and the excluded Threadline identity', () => {
  const slugs = [...SLUGS, 'letbuyy-sense'];
  const before = slugs.map(slug => canonicalJson(createFirstPartyCatalogBundle(slug)));
  buildProposal();
  assert.deepEqual(slugs.map(slug => canonicalJson(createFirstPartyCatalogBundle(slug))), before);
  assert.ok(proposal.artifacts.every(row => row.slug !== 'letbuyy-sense'));
});

test('same-version capture conflicts and malformed successor factories fail closed', () => {
  const first = proposal.artifacts[0];
  const capture: Capture = { slug: first.slug, version: first.version,
    packageVersion: structuredClone(first.persistence.themePackageVersion),
    schemaManifest: structuredClone(first.persistence.schemaManifest),
    rendererManifest: structuredClone(first.persistence.rendererManifest) };
  assertImmutableCapture(first, capture);
  const changed = structuredClone(capture);
  (changed.packageVersion as { package_manifest: { liquidBundle: { package: { description: string } } } })
    .package_manifest.liquidBundle.package.description += ' changed';
  assert.throws(() => assertImmutableCapture(first, changed), /Immutable bundle differs/);
  assert.throws(() => buildProposal((slug, options) => {
    const bundle = createFirstPartyCatalogBundle(slug, options);
    if (options?.customizationVersion && slug === first.slug) bundle.package.version = '2.0.0';
    return bundle;
  }));
  assert.throws(() => buildProposal((slug, options) => {
    const bundle = createFirstPartyCatalogBundle(slug, options);
    if (options?.customizationVersion && slug === first.slug) bundle.templates['list-collections'].sections['list-collections-grid'].settings = { subtitle: 'undeclared' };
    return bundle;
  }), /Editor-invalid successor package/);
});

test('paired SQL appends captures, binds 389 admission, and refuses stale rollback', () => {
  const { up, down } = renderPromotionPair(proposal);
  assert.match(up, /Unadmitted predecessor catalog/);
  assert.match(up, /nicheV2Promotion389,artifactSha256/);
  assert.match(up, /ON CONFLICT\(theme_package_id,version\) DO NOTHING/);
  assert.match(up, /Immutable package version conflict/);
  assert.match(up, /Immutable schema manifest conflict/);
  assert.match(up, /Immutable renderer manifest conflict/);
  assert.match(down, /refusing stale rollback/);
  assert.doesNotMatch(up + down, /\bDELETE\s+FROM\b|\bUPDATE\s+public\.(theme_package_versions|theme_schema_manifests|theme_renderer_manifests|theme_instances|theme_releases|theme_instance_drafts|store_themes)\b/i);
});

test('content-addressed dry run rejects altered artifact bytes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'letbuyy-v210-release-'));
  try {
    const stored = writeDryRun(proposal, directory);
    assert.equal(writeDryRun(proposal, directory), stored);
    const manifest = JSON.parse(fs.readFileSync(path.join(stored, 'manifest.json'), 'utf8'));
    assert.equal(manifest.manifestSha256, proposal.manifestSha256);
    const file = path.join(stored, proposal.manifest.artifacts[0].file);
    assert.equal(sha256(fs.readFileSync(file)), proposal.manifest.artifacts[0].fileSha256);
    fs.appendFileSync(file, ' ');
    assert.throws(() => writeDryRun(proposal, directory), /Immutable proposal file differs/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
