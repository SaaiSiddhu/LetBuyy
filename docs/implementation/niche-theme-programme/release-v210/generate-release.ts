/** Offline distribution tooling. Reuses Threadline's document/persistence flow; never applies SQL. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../../../../packages/theme-engine/src/first-party-theme-catalog';
import { buildLiquidThemePackagePersistencePayload, LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from '../../../../packages/theme-engine/src/theme-bundle';
import { collectThemeTemplateValidationIssues, type ThemeTemplateValidationRuntime } from '../../../../packages/theme-engine/src/index';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export const RELEASE_ROOT = path.join(ROOT, 'docs/implementation/niche-theme-programme/release-v210');
export const MIGRATION = 432;
export const VERSION = '2.1.0';
const catalogPath = 'database/supabase/migrations/372_first_party_theme_catalog.sql';
const threadlinePath = 'database/supabase/migrations/382_threadline_catalog_v2.sql';
const admittedV200ManifestPath = 'docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/manifest.json';
const admittedV200ManifestSha256 = '81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f';
const orderMarker = '<!-- lb:niche-order-presentation:v1 -->';
const rollbackKey = 'nicheV210Promotion432';
const sqlDelimiter = '$liquidbundle$';
const expected = {
  'letbuyy-forge': ['7b669c70-0000-4000-8000-000000000001', 'Circuit', 'electronics'],
  'letbuyy-aura': ['7b669c70-0000-4000-8000-000000000003', 'Dewdrop', 'beauty'],
  'letbuyy-craft': ['7b669c70-0000-4000-8000-000000000004', 'Habitat', 'furniture'],
  'letbuyy-refresh': ['7b669c70-0000-4000-8000-000000000005', 'Pantry', 'food'],
  'letbuyy-ride': ['7b669c70-0000-4000-8000-000000000006', 'Trailmark', 'sports'],
  'letbuyy-dawn': ['7b669c70-0000-4000-8000-000000000007', 'Marginalia', 'books'],
  'letbuyy-bloom': ['7b669c70-0000-4000-8000-000000000008', 'Playfield', 'toys'],
  'letbuyy-nova': ['7b669c70-0000-4000-8000-000000000009', 'MadeYours', 'personalized'],
  'letbuyy-summit': ['7b669c70-0000-4000-8000-000000000010', 'Kindred', 'gifts'],
} as const;
export const SLUGS = Object.keys(expected).sort() as Array<keyof typeof expected>;
type Persistence = ReturnType<typeof buildLiquidThemePackagePersistencePayload>;
type Factory = (slug: string, options?: { customizationVersion?: '2.1.0' }) => LiquidThemePackageBundle;
export type Artifact = {
  id: string; slug: string; presetId: string; name: string; category: string; version: string; previousCatalogVersion: string;
  previousArtifactSha256: string;
  bundleSha256: string; payloadSha256: string;
  document: Record<string, unknown>; persistence: Persistence;
};
export type Capture = { slug: string; version: string; packageVersion: unknown; schemaManifest: unknown; rendererManifest: unknown };

/** Same semantic JSON equality used by the canonical registry; deterministic bytes for distribution. */
export function canonicalJson(input: unknown): string {
  const data: unknown = JSON.parse(JSON.stringify(input));
  const sort = (value: unknown): unknown => Array.isArray(value) ? value.map(sort)
    : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, sort(child)])) : value;
  return JSON.stringify(sort(data));
}
export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const hashFile = (file: string) => sha256(fs.readFileSync(path.join(ROOT, file)));

export function readFrozenCatalog() {
  const sql = fs.readFileSync(path.join(ROOT, catalogPath), 'utf8');
  const match = sql.match(/\$listings\$(\[[\s\S]*?\])\$listings\$/); assert.ok(match, 'Frozen 372 listings unavailable.');
  const rows: unknown = JSON.parse(match[1]); assert.ok(Array.isArray(rows));
  const identities = new Map<string, string>();
  for (const row of rows) {
    assert.ok(row && typeof row === 'object' && 'slug' in row && 'id' in row && typeof row.slug === 'string' && typeof row.id === 'string');
    assert.ok(!identities.has(row.slug), 'Duplicate frozen identity.'); identities.set(row.slug, row.id);
  }
  assert.equal(identities.size, 10);
  for (const slug of SLUGS) assert.equal(identities.get(slug), expected[slug][0], `Frozen identity mismatch: ${slug}`);
  return identities;
}
export function readThreadlinePin() {
  const sql = fs.readFileSync(path.join(ROOT, threadlinePath), 'utf8');
  const payload = sql.match(/\$liquidbundle\$([\s\S]*?)\$liquidbundle\$::jsonb/); assert.ok(payload);
  const artifact: unknown = JSON.parse(payload[1]);
  assert.ok(artifact && typeof artifact === 'object' && 'document' in artifact);
  const document = artifact.document;
  assert.ok(document && typeof document === 'object' && 'liquidBundle' in document);
  const bundle = LiquidThemePackageBundleSchema.parse(document.liquidBundle);
  const digest = sql.match(/Canonical Liquid package SHA-256: ([a-f0-9]{64})/)?.[1];
  assert.equal(bundle.package.slug, 'letbuyy-sense'); assert.equal(bundle.package.version, '2.0.0');
  assert.equal(sha256(JSON.stringify(bundle)), digest, 'Pinned Threadline bytes differ from migration 382.');
  return { path: threadlinePath, fileSha256: hashFile(threadlinePath), bundleSha256: digest!, rawBundleJsonSha256: sha256(JSON.stringify(document.liquidBundle)), payloadSha256: sha256(payload[1]), excludedFromPromotion: true };
}
export function readAdmittedV200Artifacts() {
  const admitted = JSON.parse(fs.readFileSync(path.join(ROOT, admittedV200ManifestPath), 'utf8')) as {
    manifestSha256: string; artifacts: Array<{ slug: string; payloadSha256: string }>;
  };
  assert.equal(admitted.manifestSha256, admittedV200ManifestSha256);
  const { manifestSha256: _digest, ...body } = admitted;
  assert.equal(sha256(canonicalJson(body)), admittedV200ManifestSha256);
  assert.deepEqual(admitted.artifacts.map(row => row.slug), SLUGS);
  return { path: admittedV200ManifestPath, fileSha256: hashFile(admittedV200ManifestPath),
    payloadSha256: Object.fromEntries(admitted.artifacts.map(row => [row.slug, row.payloadSha256])) };
}

/** Exact local factory/payload dependency closure, with type-only imports excluded. */
export function sourceHashes() {
  const visited = new Set<string>();
  function visit(relative: string) {
    if (visited.has(relative)) return;
    visited.add(relative);
    const text = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    const ast = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true);
    for (const node of ast.statements) {
      if (!ts.isImportDeclaration(node) || node.importClause?.isTypeOnly || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && !node.importClause.name && node.importClause.namedBindings.elements.every(element => element.isTypeOnly)) continue;
      const id = node.moduleSpecifier.text;
      if (!id.startsWith('.')) continue;
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(relative), id));
      const next = [base, base + '.ts', base + '.tsx', base + '/index.ts'].find(file => fs.existsSync(path.join(ROOT, file)) && fs.statSync(path.join(ROOT, file)).isFile());
      assert.ok(next, `Unresolved freeze dependency: ${relative} → ${id}`); visit(next);
    }
  }
  visit('packages/theme-engine/src/first-party-theme-catalog.ts');
  visit('packages/theme-engine/src/theme-bundle.ts');
  visited.add('pnpm-lock.yaml'); visited.add('packages/theme-engine/package.json');
  visited.add(admittedV200ManifestPath);
  visited.add('docs/implementation/niche-theme-programme/release-v210/generate-release.ts');
  return Object.fromEntries([...visited].sort().map(file => [file, hashFile(file)]));
}

export function assertImmutableCapture(artifact: Artifact, capture: Capture) {
  assert.equal(capture.slug, artifact.slug, 'Capture slug mismatch.');
  assert.equal(capture.version, artifact.version, 'Capture version mismatch.');
  assert.ok(capture.packageVersion && typeof capture.packageVersion === 'object');
  const record = capture.packageVersion as Record<string, unknown>;
  assert.equal(record.version, VERSION); assert.ok(record.package_manifest && typeof record.package_manifest === 'object');
  const manifest = record.package_manifest as Record<string, unknown>;
  const bundle = LiquidThemePackageBundleSchema.parse(manifest.liquidBundle);
  assert.equal(bundle.package.slug, artifact.slug); assert.equal(bundle.package.version, VERSION);
  assert.equal(canonicalJson(bundle), canonicalJson(artifact.document.liquidBundle), 'Immutable bundle differs; publish a new version.');
  assert.equal(canonicalJson(capture.packageVersion), canonicalJson(artifact.persistence.themePackageVersion), 'Immutable version metadata/capture differs.');
  assert.equal(canonicalJson(capture.schemaManifest), canonicalJson(artifact.persistence.schemaManifest), 'Immutable schema manifest differs.');
  assert.equal(canonicalJson(capture.rendererManifest), canonicalJson(artifact.persistence.rendererManifest), 'Immutable renderer manifest differs.');
}

export function buildProposal(factory: Factory = createFirstPartyCatalogBundle, captures: Capture[] = []) {
  const before = sourceHashes(); const frozenCatalogSha256 = hashFile(catalogPath); const identities = readFrozenCatalog(); const threadline = readThreadlinePin();
  const admittedV200 = readAdmittedV200Artifacts();
  const defaultBundles: Record<string, LiquidThemePackageBundle> = Object.fromEntries([...SLUGS, 'letbuyy-sense'].map(slug => [slug, factory(slug)]));
  const defaultBefore = Object.fromEntries(Object.entries(defaultBundles).map(([slug, bundle]) => [slug, canonicalJson(bundle)]));
  const listings = firstPartyThemeListings({ designVersion: '2.0.0' });
  const artifacts: Artifact[] = SLUGS.map(slug => {
    const listing = listings.find(row => row.slug === slug); assert.ok(listing);
    assert.equal(listing.id, identities.get(slug)); assert.equal(listing.name, expected[slug][1]); assert.equal(listing.category, expected[slug][2]);
    const validatedBundle = LiquidThemePackageBundleSchema.parse(factory(slug, { customizationVersion: VERSION }));
    // Derive captures from the same JSON object-key order that distribution will load.
    // Canonical JSON preserves semantic arrays, including every template.order.
    const bundle = JSON.parse(canonicalJson(validatedBundle)) as LiquidThemePackageBundle;
    assert.equal(bundle.package.slug, slug); assert.equal(bundle.package.version, VERSION); assert.equal(bundle.package.version_number, 5);
    assert.equal(bundle.package.name, listing.name); assert.equal(bundle.renderer.engine, 'liquid');
    assert.equal(bundle.package.release_status, 'published'); assert.equal(bundle.package.status, 'active');
    assert.equal(bundle.package.price, 0); assert.equal(bundle.package.pricing_type, 'free');
    for (const key of Object.keys(defaultBundles[slug].templates)) assert.ok(bundle.templates[key], `Canonical journey template missing: ${slug}/${key}`);
    assert.ok(bundle.sections['customer-order-detail'].source.includes(orderMarker), 'V2 must include the approved order-snapshot presentation.');
    const persistence = buildLiquidThemePackagePersistencePayload(bundle);
    const document = { themeId: slug, experienceId: listing.presetId, rendererEngine: 'liquid', liquidRenderingCanary: true, themeSettings: bundle.config.settings_data.current, liquidBundle: bundle, templates: bundle.templates, sections: {} };
    const runtime: ThemeTemplateValidationRuntime = { sectionSchemas: persistence.schemaManifest.section_schemas as ThemeTemplateValidationRuntime['sectionSchemas'],
      settingsSchema: persistence.schemaManifest.settings_schema as ThemeTemplateValidationRuntime['settingsSchema'] };
    assert.deepEqual(collectThemeTemplateValidationIssues({ templateConfig: document, runtime, themeSlug: slug }), [], `Editor-invalid successor package: ${slug}`);
    const body = { id: listing.id, slug, presetId: listing.presetId, name: listing.name, category: listing.category, version: VERSION,
      previousCatalogVersion: '2.0.0', previousArtifactSha256: admittedV200.payloadSha256[slug], document, persistence };
    const artifact = { ...body, bundleSha256: sha256(canonicalJson(bundle)), payloadSha256: sha256(canonicalJson(body)) };
    for (const capture of captures.filter(row => row.slug === slug)) assertImmutableCapture(artifact, capture);
    return artifact;
  });
  for (const capture of captures) assert.ok(SLUGS.some(slug => slug === capture.slug), 'Foreign/protected capture input.');
  assert.equal(new Set(artifacts.map(row => row.bundleSha256)).size, 9);
  assert.deepEqual(Object.fromEntries([...SLUGS, 'letbuyy-sense'].map(slug => [slug, canonicalJson(factory(slug))])), defaultBefore, 'Factory mutated a default-v1/Threadline package.');
  assert.deepEqual(sourceHashes(), before, 'Factory sources changed during proposal generation.');
  assert.equal(hashFile(catalogPath), frozenCatalogSha256, 'Frozen catalog changed during proposal generation.');
  assert.deepEqual(readThreadlinePin(), threadline, 'Pinned Threadline artifact changed during generation.');
  const manifest = { status: 'PROPOSED_NOT_FROZEN', migration: MIGRATION, version: VERSION, sourceHashes: before,
    protected: { threadline, admittedV200, frozenCatalog: { path: catalogPath, sha256: frozenCatalogSha256 }, defaultFactorySha256: Object.fromEntries(Object.entries(defaultBefore).map(([slug, json]) => [slug, sha256(json)])) },
    existingDatabaseCapturesChecked: false, suppliedCaptureCount: captures.length,
    artifacts: artifacts.map(row => ({ id: row.id, slug: row.slug, name: row.name, category: row.category, version: row.version, previousCatalogVersion: row.previousCatalogVersion, bundleSha256: row.bundleSha256, payloadSha256: row.payloadSha256, file: `${row.slug}-${VERSION}.json`, fileSha256: sha256(canonicalJson(row) + '\n') })) };
  return { manifest, manifestSha256: sha256(canonicalJson(manifest)), artifacts };
}
export type Proposal = ReturnType<typeof buildProposal>;

const catalogColumns = ['name', 'category', 'version', 'default_template', 'section_schemas', 'block_schemas', 'settings_schema', 'renderer_manifest', 'schema_version', 'renderer_version', 'config'];
export function assertProposalIntegrity(proposal: Proposal) {
  assert.equal(proposal.manifestSha256, sha256(canonicalJson(proposal.manifest)), 'Manifest hash mismatch.');
  assert.deepEqual(proposal.artifacts.map(row => row.slug), SLUGS, 'Promotion requires the exact ordered nine identities.');
  assert.deepEqual(proposal.manifest.artifacts.map(row => row.slug), SLUGS);
  for (const artifact of proposal.artifacts) {
    const expectedRow = proposal.manifest.artifacts.find(row => row.slug === artifact.slug); assert.ok(expectedRow);
    assert.equal(sha256(canonicalJson(artifact) + '\n'), expectedRow.fileSha256, 'Artifact bytes changed after manifest.');
    assert.equal(artifact.id, expected[artifact.slug as keyof typeof expected]?.[0]);
    assert.equal(artifact.name, expected[artifact.slug as keyof typeof expected]?.[1]);
    assert.equal(artifact.category, expected[artifact.slug as keyof typeof expected]?.[2]);
    assert.equal(artifact.version, VERSION); assert.ok(artifact.previousCatalogVersion && artifact.previousCatalogVersion !== VERSION);
    assert.equal(artifact.previousArtifactSha256, readAdmittedV200Artifacts().payloadSha256[artifact.slug]);
    const bundle = LiquidThemePackageBundleSchema.parse(artifact.document.liquidBundle);
    assert.equal(bundle.package.slug, artifact.slug); assert.equal(bundle.package.version, VERSION);
    assert.equal(artifact.bundleSha256, sha256(canonicalJson(bundle)));
    assert.equal(canonicalJson(artifact.persistence), canonicalJson(buildLiquidThemePackagePersistencePayload(bundle)));
    const { bundleSha256: _bundleHash, payloadSha256: _payloadHash, ...body } = artifact;
    assert.equal(artifact.payloadSha256, sha256(canonicalJson(body)));
  }
}
/** Pure SQL proposal only. No SQL path is written or database connection opened. */
export function renderPromotionPair(proposal: Proposal) {
  assertProposalIntegrity(proposal);
  const payload = canonicalJson(proposal.artifacts); assert.ok(!payload.includes(sqlDelimiter), 'Reserved SQL quote delimiter in theme artifact.');
  const snapshot = `jsonb_build_object(${catalogColumns.flatMap(key => [`'${key}'`, `t.${key}`]).join(',')})`;
  const up = `-- Proposed migration 432; emit into migration scan only after coordinator accepts the final manifest.
-- Manifest SHA-256: ${proposal.manifestSha256}. No installed instance/draft/release is rewritten.
BEGIN;
DO $promotion$
DECLARE item jsonb; t public.themes; p public.theme_packages; v public.theme_package_versions;
 s public.theme_schema_manifests; r public.theme_renderer_manifests; body jsonb; prior jsonb;
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements(${sqlDelimiter}${payload}${sqlDelimiter}::jsonb) LOOP
  SELECT * INTO STRICT t FROM public.themes WHERE id=(item->>'id')::uuid AND slug=item->>'slug'
   AND owned_by_site_id IS NULL AND NOT is_site_private FOR UPDATE;
  IF t.version IS NULL OR t.version NOT IN (item->>'previousCatalogVersion',item->>'version') THEN
   RAISE EXCEPTION 'Unexpected prior catalog version: %',t.slug; END IF;
  IF t.version=item->>'previousCatalogVersion' AND t.config#>>'{nicheV2Promotion389,artifactSha256}' IS DISTINCT FROM item->>'previousArtifactSha256' THEN
   RAISE EXCEPTION 'Unadmitted predecessor catalog: %',t.slug; END IF;
  IF t.version='2.1.0' AND t.default_template IS DISTINCT FROM item->'document' THEN
   RAISE EXCEPTION 'Immutable catalog version conflict: %',t.slug; END IF;
  IF (SELECT count(*) FROM public.theme_packages WHERE slug=t.slug OR legacy_theme_id=t.id)>1 THEN
   RAISE EXCEPTION 'Ambiguous canonical package identity: %',t.slug; END IF;
  body:=item#>'{persistence,themePackage}';
  INSERT INTO public.theme_packages(slug,name,description,author_name,site_types,status,pricing_type,price,currency,marketplace_metadata,legacy_theme_id)
   SELECT x.slug,x.name,x.description,x.author_name,x.site_types,x.status,x.pricing_type,x.price,x.currency,x.marketplace_metadata,t.id
   FROM jsonb_populate_record(NULL::public.theme_packages,body) x
   WHERE NOT EXISTS(SELECT 1 FROM public.theme_packages WHERE slug=t.slug OR legacy_theme_id=t.id)
   ON CONFLICT(slug) DO NOTHING;
  SELECT * INTO STRICT p FROM public.theme_packages WHERE slug=t.slug OR legacy_theme_id=t.id FOR UPDATE;
  IF p.slug<>t.slug OR (p.legacy_theme_id IS NOT NULL AND p.legacy_theme_id<>t.id) OR p.deleted_at IS NOT NULL OR p.status<>'active' THEN
   RAISE EXCEPTION 'Canonical package unavailable: %',t.slug; END IF;
  body:=item#>'{persistence,themePackageVersion}';
  INSERT INTO public.theme_package_versions(theme_package_id,version,version_number,release_status,renderer_version,schema_version,compatibility_range,package_manifest,checksum,published_at)
   SELECT p.id,x.version,x.version_number,x.release_status,x.renderer_version,x.schema_version,x.compatibility_range,x.package_manifest,x.checksum,now()
   FROM jsonb_populate_record(NULL::public.theme_package_versions,body) x ON CONFLICT(theme_package_id,version) DO NOTHING;
  SELECT * INTO STRICT v FROM public.theme_package_versions WHERE theme_package_id=p.id AND version=item->>'version' FOR UPDATE;
  IF v.deleted_at IS NOT NULL OR (to_jsonb(v)-ARRAY['id','theme_package_id','published_at','created_by','created_at','updated_at','deleted_at'])
    IS DISTINCT FROM (body||jsonb_build_object('checksum',body->'checksum')) THEN
   RAISE EXCEPTION 'Immutable package version conflict: %',t.slug; END IF;
  body:=item#>'{persistence,schemaManifest}';
  INSERT INTO public.theme_schema_manifests(theme_package_version_id,manifest_version,schema_manifest,section_schemas,block_schemas,settings_schema,template_schema,layout_schema,validation_rules)
   SELECT v.id,x.manifest_version,x.schema_manifest,x.section_schemas,x.block_schemas,x.settings_schema,x.template_schema,x.layout_schema,x.validation_rules
   FROM jsonb_populate_record(NULL::public.theme_schema_manifests,body) x ON CONFLICT(theme_package_version_id) DO NOTHING;
  SELECT * INTO STRICT s FROM public.theme_schema_manifests WHERE theme_package_version_id=v.id FOR UPDATE;
  IF (to_jsonb(s)-ARRAY['id','theme_package_version_id','created_at','updated_at']) IS DISTINCT FROM body THEN
   RAISE EXCEPTION 'Immutable schema manifest conflict: %',t.slug; END IF;
  body:=item#>'{persistence,rendererManifest}';
  INSERT INTO public.theme_renderer_manifests(theme_package_version_id,renderer_manifest,approved_renderer_keys,asset_manifest,performance_budget)
   SELECT v.id,x.renderer_manifest,x.approved_renderer_keys,x.asset_manifest,x.performance_budget
   FROM jsonb_populate_record(NULL::public.theme_renderer_manifests,body) x ON CONFLICT(theme_package_version_id) DO NOTHING;
  SELECT * INTO STRICT r FROM public.theme_renderer_manifests WHERE theme_package_version_id=v.id FOR UPDATE;
  IF (to_jsonb(r)-ARRAY['id','theme_package_version_id','created_at','updated_at']) IS DISTINCT FROM body THEN
   RAISE EXCEPTION 'Immutable renderer manifest conflict: %',t.slug; END IF;
  IF t.config ? '${rollbackKey}' AND t.config#>>'{${rollbackKey},artifactSha256}' IS DISTINCT FROM item->>'payloadSha256' THEN
   RAISE EXCEPTION 'Conflicting promotion checkpoint: %',t.slug; END IF;
  IF t.version=item->>'version' AND t.name=item->>'name' AND t.category=item->>'category'
   AND t.default_template=item->'document' AND t.section_schemas=item#>'{persistence,schemaManifest,section_schemas}'
   AND t.block_schemas=item#>'{persistence,schemaManifest,block_schemas}' AND t.settings_schema=item#>'{persistence,schemaManifest,settings_schema}'
   AND t.renderer_manifest=item#>'{document,liquidBundle,renderer}' THEN CONTINUE; END IF;
  prior:=coalesce(t.config#>'{${rollbackKey},previous}',${snapshot});
  UPDATE public.themes SET name=item->>'name',category=item->>'category',version=item->>'version',default_template=item->'document',
   section_schemas=item#>'{persistence,schemaManifest,section_schemas}',block_schemas=item#>'{persistence,schemaManifest,block_schemas}',settings_schema=item#>'{persistence,schemaManifest,settings_schema}',
   renderer_manifest=item#>'{document,liquidBundle,renderer}',schema_version=v.schema_version,renderer_version=v.renderer_version,
   config=coalesce(t.config,'{}'::jsonb)||jsonb_build_object('designVersion',item->>'version','${rollbackKey}',jsonb_build_object('artifactSha256',item->>'payloadSha256','previous',prior)),updated_at=now() WHERE id=t.id;
 END LOOP;
END;
$promotion$;
COMMIT;
`;
  const identities = canonicalJson(proposal.artifacts.map(row => ({ id: row.id, slug: row.slug, payloadSha256: row.payloadSha256 })));
  const down = `-- Restore prior catalog pointers/approved metadata only. Captures and installations remain recoverable.
-- Paired with manifest SHA-256: ${proposal.manifestSha256}.
BEGIN;
DO $rollback$
DECLARE item jsonb; t public.themes; prior public.themes; saved jsonb;
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements(${sqlDelimiter}${identities}${sqlDelimiter}::jsonb) LOOP
  SELECT * INTO STRICT t FROM public.themes WHERE id=(item->>'id')::uuid AND slug=item->>'slug'
   AND owned_by_site_id IS NULL AND NOT is_site_private FOR UPDATE;
  saved:=t.config#>'{${rollbackKey},previous}'; IF saved IS NULL THEN CONTINUE; END IF;
  IF t.version<>'2.1.0' OR t.config#>>'{${rollbackKey},artifactSha256}' IS DISTINCT FROM item->>'payloadSha256' THEN
   RAISE EXCEPTION 'Catalog changed after promotion; refusing stale rollback: %',t.slug; END IF;
  prior:=jsonb_populate_record(NULL::public.themes,saved);
  UPDATE public.themes SET ${catalogColumns.map(key => `${key}=prior.${key}`).join(',')},updated_at=now() WHERE id=t.id;
 END LOOP;
END;
$rollback$;
COMMIT;
`;
  return { up, down };
}

/** Content-addressed proposed artifacts; equal files are reused, differing bytes never overwritten. */
export function writeDryRun(proposal: Proposal, destination = RELEASE_ROOT) {
  assertProposalIntegrity(proposal);
  const directory = path.join(destination, 'proposals', proposal.manifestSha256); fs.mkdirSync(directory, { recursive: true });
  const writeImmutable = (name: string, text: string) => {
    const file = path.join(directory, name);
    if (fs.existsSync(file)) assert.equal(fs.readFileSync(file, 'utf8'), text, `Immutable proposal file differs: ${name}`);
    else fs.writeFileSync(file, text, { flag: 'wx' });
  };
  for (const artifact of proposal.artifacts) writeImmutable(`${artifact.slug}-${VERSION}.json`, canonicalJson(artifact) + '\n');
  writeImmutable('manifest.json', canonicalJson({ ...proposal.manifest, manifestSha256: proposal.manifestSha256 }) + '\n');
  return directory;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every(value => value === '--dry-run'), 'Only offline --dry-run is supported. SQL emission/application is not implemented.');
  const proposal = buildProposal(); const directory = writeDryRun(proposal);
  process.stdout.write(JSON.stringify({ status: proposal.manifest.status, migrationReserved: MIGRATION, artifacts: proposal.artifacts.length, manifestSha256: proposal.manifestSha256, directory, sqlWritten: false, databaseTouched: false }) + '\n');
}
