import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog';
import { buildLiquidThemePackagePersistencePayload, LiquidThemePackageBundleSchema } from '../../../../packages/theme-engine/src/theme-bundle';
import { assertImmutableCapture, assertProposalIntegrity, buildProposal, canonicalJson, readFrozenCatalog, readThreadlinePin, renderPromotionPair, ROOT, sha256, SLUGS, writeDryRun, type Artifact, type Capture, type Proposal } from './generate-release';

const proposal = buildProposal();
const first = proposal.artifacts[0];
function capture(): Capture { return { slug: first.slug, version: first.version, packageVersion: structuredClone(first.persistence.themePackageVersion), schemaManifest: structuredClone(first.persistence.schemaManifest), rendererManifest: structuredClone(first.persistence.rendererManifest) }; }
const frozenFile = 'database/supabase/migrations/382_threadline_catalog_v2.sql';
const originalThreadlineBytes = fs.readFileSync(path.join(ROOT, frozenFile));

function readDryRun(directory: string): Proposal {
  const stored = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8')) as Proposal['manifest'] & { manifestSha256: string };
  const { manifestSha256, ...manifest } = stored;
  const artifacts = manifest.artifacts.map(row => JSON.parse(fs.readFileSync(path.join(directory, row.file), 'utf8')) as Artifact);
  return { manifest, manifestSha256, artifacts };
}
function requireWireIntegrity(value: Proposal) {
  try { assertProposalIntegrity(value); }
  catch (error) { throw new Error(`Disk-loaded proposal integrity failed: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`); }
}
/** Recompute envelope hashes so negative tests reach the strict payload checks. */
function reseal(value: Proposal, index = 0) {
  const artifact = value.artifacts[index];
  const { bundleSha256: _bundleHash, payloadSha256: _payloadHash, ...body } = artifact;
  artifact.bundleSha256 = sha256(canonicalJson(artifact.document.liquidBundle));
  artifact.payloadSha256 = sha256(canonicalJson(body));
  Object.assign(value.manifest.artifacts[index], { bundleSha256: artifact.bundleSha256, payloadSha256: artifact.payloadSha256, fileSha256: sha256(canonicalJson(artifact) + '\n') });
  value.manifestSha256 = sha256(canonicalJson(value.manifest));
}

test('canonical JSON and repeated complete generation have deterministic exact bytes/hashes', () => {
  assert.equal(canonicalJson({ z: 2, nested: { b: 1, a: 0 }, a: [2, 1], absent: undefined }), canonicalJson({ a: [2, 1], nested: { a: 0, b: 1 }, z: 2 }));
  const second = buildProposal(); assert.equal(canonicalJson(second), canonicalJson(proposal)); assert.equal(second.manifestSha256, proposal.manifestSha256);
  for (const row of proposal.artifacts) assert.equal(sha256(canonicalJson(row) + '\n'), proposal.manifest.artifacts.find(item => item.slug === row.slug)!.fileSha256);
});
test('all nine packages have distinct content and exact frozen catalog identities, approved names/categories and order opt-in', () => {
  const frozen = readFrozenCatalog(); assert.equal(proposal.artifacts.length, 9); assert.equal(new Set(proposal.artifacts.map(row => row.bundleSha256)).size, 9);
  for (const row of proposal.artifacts) {
    assert.equal(row.id, frozen.get(row.slug)); assert.equal(row.version, '2.0.0');
    const bundle = LiquidThemePackageBundleSchema.parse(row.document.liquidBundle);
    assert.equal(bundle.package.slug, row.slug); assert.equal(bundle.package.name, row.name);
    assert.ok(bundle.sections['customer-order-detail'].source.includes('<!-- lb:niche-order-presentation:v1 -->'));
    assert.equal(canonicalJson(row.persistence), canonicalJson(buildLiquidThemePackagePersistencePayload(bundle)));
  }
});
test('default v1 builders and pinned Threadline bytes are unchanged and outside the nine promotion targets', () => {
  const before = [...SLUGS, 'letbuyy-sense'].map(slug => canonicalJson(createFirstPartyCatalogBundle(slug)));
  buildProposal();
  assert.deepEqual([...SLUGS, 'letbuyy-sense'].map(slug => canonicalJson(createFirstPartyCatalogBundle(slug))), before);
  assert.deepEqual(fs.readFileSync(path.join(ROOT, frozenFile)), originalThreadlineBytes);
  assert.equal(readThreadlinePin().bundleSha256, '61082be647eadae9b6e42002be241a82ba6c3627427568f6e64e2cf961c3742e');
  assert.ok(proposal.artifacts.every(row => row.slug !== 'letbuyy-sense' && row.id !== '7b669c70-0000-4000-8000-000000000002'));
  assert.ok(SLUGS.every(slug => createFirstPartyCatalogBundle(slug).package.version !== '2.0.0'));
});
test('an identical immutable same-version capture is accepted without mutation', () => {
  const value = capture(); const before = canonicalJson(value);
  assertImmutableCapture(first, value); assert.equal(canonicalJson(value), before);
  assert.equal(buildProposal(createFirstPartyCatalogBundle, [value]).manifest.suppliedCaptureCount, 1);
});
test('invalid capture, wrong identity/version, altered bundle and conflicting manifest aliases fail closed', () => {
  const malformed = capture(); malformed.packageVersion = { version: '2.0.0', package_manifest: { liquidBundle: {} } }; assert.throws(() => assertImmutableCapture(first, malformed));
  for (const key of ['slug', 'version'] as const) { const value = capture(); value[key] = 'different'; assert.throws(() => assertImmutableCapture(first, value)); }
  const changed = capture(); const version = changed.packageVersion as { package_manifest: { liquidBundle: { package: { description: string } } } };
  version.package_manifest.liquidBundle.package.description += 'changed'; assert.throws(() => assertImmutableCapture(first, changed));
  const alias = capture(); const metadata = alias.packageVersion as { package_manifest: Record<string, unknown> }; metadata.package_manifest.themeBundle = {};
  assert.throws(() => assertImmutableCapture(first, alias));
});
test('same-version status/schema/renderer differences and protected capture input are rejected', () => {
  const status = capture(); Object.assign(status.packageVersion as object, { release_status: 'revoked' }); assert.throws(() => assertImmutableCapture(first, status));
  const schema = capture(); schema.schemaManifest = {}; assert.throws(() => assertImmutableCapture(first, schema));
  const renderer = capture(); renderer.rendererManifest = {}; assert.throws(() => assertImmutableCapture(first, renderer));
  const foreign = capture(); foreign.slug = 'letbuyy-sense'; assert.throws(() => buildProposal(createFirstPartyCatalogBundle, [foreign]));
});
test('mismatched factory version/slug, invalid schema and changed default builders cannot generate a release', () => {
  for (const mutation of ['version', 'slug', 'schema'] as const) {
    assert.throws(() => buildProposal((slug, options) => {
      const bundle = createFirstPartyCatalogBundle(slug, options);
      if (options?.designVersion === '2.0.0' && slug === first.slug) {
        if (mutation === 'version') bundle.package.version = '3.0.0';
        if (mutation === 'slug') bundle.package.slug = 'different-theme';
        if (mutation === 'schema') Reflect.set(bundle, 'templates', {});
      }
      return bundle;
    }));
  }
  let counter = 0;
  assert.throws(() => buildProposal((slug, options) => {
    const bundle = createFirstPartyCatalogBundle(slug, options);
    if (!options) bundle.package.description += String(counter++);
    return bundle;
  }), /mutated a default/);
});
test('paired SQL appends/checks immutable captures, updates only catalog metadata/pointers and rolls back without deletion', () => {
  const { up, down } = renderPromotionPair(proposal);
  assert.match(up, /INSERT INTO public\.theme_package_versions/); assert.match(up, /ON CONFLICT\(theme_package_id,version\) DO NOTHING/);
  for (const kind of ['package version', 'schema manifest', 'renderer manifest']) assert.ok(up.includes(`Immutable ${kind} conflict`));
  assert.ok(up.includes('Ambiguous canonical package identity')); assert.ok(up.includes('p.deleted_at IS NOT NULL')); assert.ok(up.includes('Unexpected prior catalog version'));
  assert.doesNotMatch(up + down, /\bDELETE\s+FROM\b|\bUPDATE\s+public\.(theme_package_versions|theme_schema_manifests|theme_renderer_manifests|theme_instances|theme_releases|theme_instance_drafts|store_themes)\b/i);
  assert.doesNotMatch(up, /SET\s+(?:description|thumbnail_url|sort_order|is_active|price)\s*=/i);
  assert.match(down, /prior:=jsonb_populate_record/); assert.match(down, /refusing stale rollback/);
  assert.match(up, /END;\n\$promotion\$;/); assert.match(down, /END;\n\$rollback\$;/);
  assert.ok(up.includes(proposal.manifestSha256)); assert.ok(down.includes(proposal.manifestSha256));
  const promoted = JSON.parse(up.split('$liquidbundle$')[1]) as Array<{ id: string; slug: string }>;
  assert.deepEqual(promoted.map(row => row.slug), SLUGS); assert.deepEqual(promoted.map(row => row.id), proposal.artifacts.map(row => row.id));
  assert.equal(JSON.parse(down.split('$liquidbundle$')[1]).length, 9);
});
test('tampered manifest/artifact, missing or duplicated package and SQL literal termination are rejected', () => {
  const manifest = structuredClone(proposal); manifest.manifest.version = 'different'; assert.throws(() => renderPromotionPair(manifest));
  const artifact = structuredClone(proposal); artifact.artifacts[0].name = 'changed'; assert.throws(() => renderPromotionPair(artifact));
  const missing = structuredClone(proposal); missing.artifacts.pop(); assert.throws(() => renderPromotionPair(missing));
  const duplicate = structuredClone(proposal); duplicate.artifacts[1] = duplicate.artifacts[0]; assert.throws(() => renderPromotionPair(duplicate));
  const delimiter = buildProposal((slug, options) => { const bundle = createFirstPartyCatalogBundle(slug, options); if (options && slug === first.slug) bundle.package.description += '$liquidbundle$'; return bundle; });
  assert.throws(() => renderPromotionPair(delimiter), /quote delimiter/);
});
test('dry-run writes only immutable proposed JSON and never emits an applied 389 UP/DOWN', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'letbuyy-nine-release-'));
  const scan = path.join(ROOT, 'database/supabase/migrations'); const rollback = path.join(ROOT, 'database/supabase/rollback');
  const before = [fs.readdirSync(scan).filter(name => name.startsWith('389')), fs.readdirSync(rollback).filter(name => name.startsWith('389'))];
  try {
    const dir = writeDryRun(proposal, temporary); assert.equal(writeDryRun(proposal, temporary), dir);
    assert.equal(fs.readdirSync(dir).length, 10); assert.ok(fs.readdirSync(dir).every(name => name.endsWith('.json')));
    const file = path.join(dir, `${first.slug}-2.0.0.json`); fs.appendFileSync(file, 'tamper');
    assert.throws(() => writeDryRun(proposal, temporary), /Immutable proposal file differs/);
    const malformed = structuredClone(proposal); malformed.artifacts[0].name = 'changed';
    assert.throws(() => writeDryRun(malformed, temporary));
    assert.deepEqual([fs.readdirSync(scan).filter(name => name.startsWith('389')), fs.readdirSync(rollback).filter(name => name.startsWith('389'))], before);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('actual manifest and nine JSON files reload with strict integrity and byte-identical in-memory/disk SQL', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'letbuyy-nine-wire-'));
  try {
    const directory = writeDryRun(proposal, temporary);
    const loaded = readDryRun(directory);
    assert.equal(loaded.artifacts.length, 9);
    requireWireIntegrity(loaded);
    assert.equal(canonicalJson(loaded), canonicalJson(proposal));
    assert.deepEqual(renderPromotionPair(loaded), renderPromotionPair(proposal));
    for (const artifact of loaded.artifacts) {
      const rebuilt = buildLiquidThemePackagePersistencePayload(LiquidThemePackageBundleSchema.parse(artifact.document.liquidBundle));
      assert.deepEqual(artifact.persistence.rendererManifest.approved_renderer_keys, rebuilt.rendererManifest.approved_renderer_keys);
    }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('reloaded approved renderer key order and membership tampering fail even with resealed envelope hashes', () => {
  const loaded = JSON.parse(canonicalJson(proposal)) as Proposal;
  requireWireIntegrity(loaded);
  for (const mode of ['order', 'membership'] as const) {
    const altered = structuredClone(loaded);
    const keys = altered.artifacts[0].persistence.rendererManifest.approved_renderer_keys;
    assert.ok(keys.length > 2 && keys[1] !== keys[2]);
    if (mode === 'order') [keys[1], keys[2]] = [keys[2], keys[1]];
    else keys[1] = 'liquid.section.unapproved-fixture';
    reseal(altered);
    assert.throws(() => assertProposalIntegrity(altered));
    assert.throws(() => renderPromotionPair(altered));
    const saved = capture();
    saved.rendererManifest = altered.artifacts[0].persistence.rendererManifest;
    assert.throws(() => assertImmutableCapture(first, saved), /Immutable renderer manifest differs/);
  }
});

test('wire normalization preserves every factory template.order and rejects a resealed changed order', () => {
  const loaded = JSON.parse(canonicalJson(proposal)) as Proposal;
  requireWireIntegrity(loaded);
  for (const artifact of loaded.artifacts) {
    const raw = createFirstPartyCatalogBundle(artifact.slug, { designVersion: '2.0.0' });
    const normalized = LiquidThemePackageBundleSchema.parse(artifact.document.liquidBundle);
    assert.equal(canonicalJson(normalized), canonicalJson(raw));
    for (const [key, template] of Object.entries(raw.templates)) {
      assert.deepEqual(normalized.templates[key].order, template.order, `${artifact.slug}/${key}`);
    }
  }
  const altered = structuredClone(loaded);
  const bundle = LiquidThemePackageBundleSchema.parse(altered.artifacts[0].document.liquidBundle);
  const key = Object.keys(bundle.templates).find(name => bundle.templates[name].order.length > 1);
  assert.ok(key, 'Fixture needs an ordered multi-section template.');
  bundle.templates[key].order.reverse();
  altered.artifacts[0].document.liquidBundle = bundle;
  reseal(altered);
  assert.throws(() => assertProposalIntegrity(altered));
  assert.throws(() => renderPromotionPair(altered));
});
