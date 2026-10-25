/** Offline, one-release distribution adapter. Reuses the canonical factory and persistence builder; never applies SQL. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog';
import { buildLiquidThemePackagePersistencePayload, LiquidThemePackageBundleSchema } from '../../../../packages/theme-engine/src/theme-bundle';
import { canonicalJson, sha256, sourceHashes as factorySourceHashes, type Artifact } from '../release-v2/generate-release';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export const RELEASE = path.dirname(fileURLToPath(import.meta.url));
export const SLUG = 'letbuyy-bloom';
export const ID = '7b669c70-0000-4000-8000-000000000008';
export const VERSION = '2.0.1';
export const MIGRATION = 393;
const admissionPath = 'docs/implementation/niche-theme-programme/playfield201-source-admission.json';
const admissionSha = 'c7eeecfc5474a89a928e974a5c1332122d6efb0424cd15ad7126ae7e365e5f75';
const revisedAdmissionPath = 'docs/implementation/niche-theme-programme/playfield201-order-url-interim-admission.json';
const revisedAdmissionSha = 'c8420182d002cf4a5584656e3a43c3e542705d4f69eb131738de9225c326225d';
const revisedBuilderReviewPath = 'docs/implementation/niche-theme-programme/playfield201-independent-revised-builder-review.json';
const revisedBuilderReviewSha = 'a5f868c08db43c5e2678f5045c928e96f9a1ac040e5dded7e68a42abf450e480';
const approvedRawBuilderSha = '91dd7e6239aefa6a341dfc04ba5d8cc79d8136f1c4d46b48fda66799ecbbe9d7';
const revisedOrderSources = {
  'packages/theme-engine/src/niche-order-presentation.ts': '6c5f89356bab085cc8a3a359c5caad4503dc8442176df0b8a1558b849d651ac3',
  'packages/theme-engine/test/niche-order-presentation.test.ts': '20cef99b2deea24bb02b0c08ecfe7224eb3e8fe90b2a30c09c06afc88502eb19',
};
const previousDirectory = 'docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f';
const checkpoint = 'playfield201Promotion393';
const delimiter = '$playfield201payload$';
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const hashFile = (relative: string) => sha256(fs.readFileSync(path.join(ROOT, relative)));
const own = 'docs/implementation/niche-theme-programme/release-playfield201/';
type RootAdmission = { status: string; ownerRelease: { path: string; sha256: string }; sourceFiles: Array<{ path: string; sha256: string }> };

export function differences(a: unknown, b: unknown, prefix = ''): string[] {
  if (canonicalJson(a) === canonicalJson(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const aa = a as Record<string, unknown>, bb = b as Record<string, unknown>;
    return [...new Set([...Object.keys(aa), ...Object.keys(bb)])].sort().flatMap(key =>
      Object.hasOwn(aa, key) && Object.hasOwn(bb, key) ? differences(aa[key], bb[key], `${prefix}/${key}`) : [`${prefix}/${key}`]);
  }
  return [prefix];
}

export function buildProposal() {
  assert.equal(hashFile(admissionPath), admissionSha, 'Root source admission changed.');
  const admission = JSON.parse(read(admissionPath)) as RootAdmission;
  assert.equal(admission.status, 'ROOT_PLAYFIELD_201_SOURCE_ADMITTED_DISTRIBUTION_AND_BROWSER_PENDING');
  assert.equal(admission.sourceFiles.length, 7);
  for (const row of admission.sourceFiles) assert.equal(hashFile(row.path), row.sha256, `Unadmitted source: ${row.path}`);
  assert.equal(hashFile(admission.ownerRelease.path), admission.ownerRelease.sha256);
  // The original c8/73 receipt is historical. Only this later exact Root admission authorizes repaired91.
  assert.equal(hashFile(revisedAdmissionPath), revisedAdmissionSha, 'Repaired source admission changed.');
  const revised = JSON.parse(read(revisedAdmissionPath)) as { status: string; newRawBuilderSha256: string; oldC8StillNotPromotable: boolean };
  assert.equal(revised.status, 'ROOT_PLAYFIELD201_ORDER_AND_URL_SOURCE_INTERIM_ADMITTED_FINAL_POST_CART_GATE_PENDING');
  assert.equal(revised.newRawBuilderSha256, approvedRawBuilderSha); assert.equal(revised.oldC8StillNotPromotable, true);
  assert.equal(hashFile(revisedBuilderReviewPath), revisedBuilderReviewSha);
  for (const [relative, hash] of Object.entries(revisedOrderSources)) assert.equal(hashFile(relative), hash);
  const sourceHashes = { ...factorySourceHashes(), ...Object.fromEntries(admission.sourceFiles.map(row => [row.path, row.sha256])),
    [admissionPath]: admissionSha, [admission.ownerRelease.path]: admission.ownerRelease.sha256,
    [revisedAdmissionPath]: revisedAdmissionSha, [revisedBuilderReviewPath]: revisedBuilderReviewSha, ...revisedOrderSources,
    [own + 'generate-playfield201.ts']: hashFile(own + 'generate-playfield201.ts'),
    [own + 'generate-playfield201.test.ts']: hashFile(own + 'generate-playfield201.test.ts'),
    [own + 'tsconfig.proposal.json']: hashFile(own + 'tsconfig.proposal.json') };
  assert(!Object.hasOwn(sourceHashes, 'apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx'), 'Moving URL-restoration source is outside this capture.');
  const previousManifest = JSON.parse(read(previousDirectory + '/manifest.json')) as { artifacts: Array<{ slug: string; file: string; fileSha256: string }> };
  assert.equal(hashFile(previousDirectory + '/manifest.json'), 'c0e8d5b7338a70a797a2acc24976700a146f8df4f9a3716d55fab4c03e8cf515');
  for (const row of previousManifest.artifacts) {
    assert.equal(hashFile(previousDirectory + '/' + row.file), row.fileSha256);
    const artifact = JSON.parse(read(previousDirectory + '/' + row.file)) as Artifact;
    assert.equal(canonicalJson(createFirstPartyCatalogBundle(row.slug, { designVersion: '2.0.0' })), canonicalJson(artifact.document.liquidBundle), 'A historical v2 artifact changed.');
  }
  const previous = JSON.parse(read(previousDirectory + '/letbuyy-bloom-2.0.0.json')) as Artifact;
  assert.equal(previous.id, ID); assert.equal(previous.slug, SLUG); assert.equal(previous.version, '2.0.0');
  const historical = JSON.parse(read('docs/implementation/niche-themes-2026-10-23/playfield/v201-source-repair-2026-10-23/after-bundle-hashes.json')) as {
    previousOutputs: Array<{ slug: string; designVersion: string; sha256: string }>;
  };
  assert.equal(historical.previousOutputs.length, 20);
  for (const row of historical.previousOutputs) {
    const output = createFirstPartyCatalogBundle(row.slug, row.designVersion === '2.0.0' ? { designVersion: '2.0.0' } : {});
    assert.equal(sha256(JSON.stringify(output)), row.sha256, 'A default/historical builder output changed.');
  }
  const raw = createFirstPartyCatalogBundle(SLUG, { designVersion: '2.0.0', playfieldVersion: VERSION });
  const rawFactorySha256 = sha256(JSON.stringify(raw));
  assert.equal(rawFactorySha256, approvedRawBuilderSha);
  const bundle = LiquidThemePackageBundleSchema.parse(JSON.parse(canonicalJson(raw)));
  assert.equal(bundle.package.version_number, 3); assert.equal(bundle.package.status, 'active');
  assert.equal(bundle.package.release_status, 'published'); assert.equal(bundle.renderer.engine, 'liquid');
  const persistence = buildLiquidThemePackagePersistencePayload(bundle);
  const document = { themeId: SLUG, experienceId: 'bloom', rendererEngine: 'liquid', liquidRenderingCanary: true,
    themeSettings: bundle.config.settings_data.current, liquidBundle: bundle, templates: bundle.templates, sections: {} };
  const body = { id: ID, slug: SLUG, presetId: 'bloom', name: 'Playfield', category: 'toys', version: VERSION, previousCatalogVersion: '2.0.0', document, persistence };
  const artifact: Artifact = { ...body, bundleSha256: sha256(canonicalJson(bundle)), payloadSha256: sha256(canonicalJson(body)) };
  const semanticDifferencePaths = differences(previous.document.liquidBundle, bundle);
  assert.deepEqual(semanticDifferencePaths, ['/package/version', '/package/version_number', '/sections/product-detail/source']);
  for (const [relative, hash] of Object.entries(sourceHashes)) assert.equal(hashFile(relative), hash, 'Source moved during capture.');
  const manifest = { status: 'PROPOSAL_ONLY_NOT_EMITTED_NOT_DATABASE_QUALIFIED', migration: MIGRATION, slug: SLUG, id: ID, version: VERSION,
    sourceHashes, rawFactorySha256, semanticDifferencePaths, historicalBuilderOutputsPreserved: 20, previousNineArtifactFilesPreserved: 9,
    revisedSourceAdmission: { path: revisedAdmissionPath, sha256: revisedAdmissionSha },
    qualificationScope: 'Stable Liquid/catalog factory and declared source inputs only; final combined post-cart runtime gate remains pending. No moving hydration/cart bytes are frozen or qualified here.',
    previous: { file: previousDirectory + '/letbuyy-bloom-2.0.0.json', fileSha256: hashFile(previousDirectory + '/letbuyy-bloom-2.0.0.json'), payloadSha256: previous.payloadSha256 },
    artifact: { file: SLUG + '-2.0.1.json', fileSha256: sha256(canonicalJson(artifact) + '\n'), bundleSha256: artifact.bundleSha256, payloadSha256: artifact.payloadSha256 },
    persistedDatabaseCapturesChecked: false, movingHydrationSourceExcluded: true,
    scope: 'Append one version/schema/renderer capture to existing Playfield package; move only catalog metadata; never upgrade instances/drafts/releases implicitly.' };
  return { manifest, manifestSha256: sha256(canonicalJson(manifest)), artifact, previous };
}
export type Proposal = ReturnType<typeof buildProposal>;

export function assertProposal(proposal: Proposal) {
  assert.equal(proposal.manifestSha256, sha256(canonicalJson(proposal.manifest)));
  const a = proposal.artifact;
  assert.equal(a.id, ID); assert.equal(a.slug, SLUG); assert.equal(a.version, VERSION); assert.equal(a.previousCatalogVersion, '2.0.0');
  assert.equal(sha256(canonicalJson(a) + '\n'), proposal.manifest.artifact.fileSha256);
  assert.equal(sha256(canonicalJson(proposal.previous) + '\n'), proposal.manifest.previous.fileSha256);
  const bundle = LiquidThemePackageBundleSchema.parse(a.document.liquidBundle);
  assert.equal(bundle.package.slug, SLUG); assert.equal(bundle.package.version, VERSION); assert.equal(bundle.package.version_number, 3);
  assert.equal(a.bundleSha256, sha256(canonicalJson(bundle)));
  assert.equal(canonicalJson(a.persistence), canonicalJson(buildLiquidThemePackagePersistencePayload(bundle)));
  const { bundleSha256: _bundle, payloadSha256: _payload, ...body } = a;
  assert.equal(a.payloadSha256, sha256(canonicalJson(body)));
}

const columns = ['name','category','version','default_template','section_schemas','block_schemas','settings_schema','renderer_manifest','schema_version','renderer_version'];
const currentManaged = `jsonb_build_object(${columns.flatMap(key => [`'${key}'`, `t.${key}`]).join(',')})`;
const expectedManaged = (value: string) => `jsonb_build_object('name',${value}->'name','category',${value}->'category','version',${value}->'version','default_template',${value}->'document','section_schemas',${value}#>'{persistence,schemaManifest,section_schemas}','block_schemas',${value}#>'{persistence,schemaManifest,block_schemas}','settings_schema',${value}#>'{persistence,schemaManifest,settings_schema}','renderer_manifest',${value}#>'{document,liquidBundle,renderer}','schema_version',${value}#>'{persistence,themePackageVersion,schema_version}','renderer_version',${value}#>'{persistence,themePackageVersion,renderer_version}')`;

/** Same four canonical capture tables as389. Existing captures are checked, never repaired or deleted. */
function captureSql(insertNew: boolean) {
  return `
 FOR captured IN SELECT value FROM jsonb_array_elements(jsonb_build_array(old_item,new_item)) LOOP
  body:=captured#>'{persistence,themePackageVersion}';
  ${insertNew ? `IF captured->>'version'='2.0.1' THEN
   INSERT INTO public.theme_package_versions(theme_package_id,version,version_number,release_status,renderer_version,schema_version,compatibility_range,package_manifest,checksum,published_at)
    SELECT p.id,x.version,x.version_number,x.release_status,x.renderer_version,x.schema_version,x.compatibility_range,x.package_manifest,x.checksum,now()
    FROM jsonb_populate_record(NULL::public.theme_package_versions,body) x ON CONFLICT(theme_package_id,version) DO NOTHING;
  END IF;` : ''}
  SELECT * INTO v FROM public.theme_package_versions WHERE theme_package_id=p.id AND version=captured->>'version' FOR UPDATE;
  ${insertNew ? '' : `IF NOT FOUND AND captured->>'version'='2.0.1' AND saved IS NULL THEN CONTINUE; END IF;`}
  IF v.id IS NULL OR v.deleted_at IS NOT NULL OR (to_jsonb(v)-ARRAY['id','theme_package_id','published_at','created_by','created_at','updated_at','deleted_at'])
    IS DISTINCT FROM (body||jsonb_build_object('checksum',body->'checksum')) THEN RAISE EXCEPTION '393 immutable version conflict'; END IF;
  body:=captured#>'{persistence,schemaManifest}';
  ${insertNew ? `IF captured->>'version'='2.0.1' THEN
   INSERT INTO public.theme_schema_manifests(theme_package_version_id,manifest_version,schema_manifest,section_schemas,block_schemas,settings_schema,template_schema,layout_schema,validation_rules)
    SELECT v.id,x.manifest_version,x.schema_manifest,x.section_schemas,x.block_schemas,x.settings_schema,x.template_schema,x.layout_schema,x.validation_rules
    FROM jsonb_populate_record(NULL::public.theme_schema_manifests,body) x ON CONFLICT(theme_package_version_id) DO NOTHING;
  END IF;` : ''}
  SELECT * INTO s FROM public.theme_schema_manifests WHERE theme_package_version_id=v.id FOR UPDATE;
  IF s.id IS NULL OR (to_jsonb(s)-ARRAY['id','theme_package_version_id','created_at','updated_at']) IS DISTINCT FROM body THEN RAISE EXCEPTION '393 immutable schema conflict'; END IF;
  body:=captured#>'{persistence,rendererManifest}';
  ${insertNew ? `IF captured->>'version'='2.0.1' THEN
   INSERT INTO public.theme_renderer_manifests(theme_package_version_id,renderer_manifest,approved_renderer_keys,asset_manifest,performance_budget)
    SELECT v.id,x.renderer_manifest,x.approved_renderer_keys,x.asset_manifest,x.performance_budget
    FROM jsonb_populate_record(NULL::public.theme_renderer_manifests,body) x ON CONFLICT(theme_package_version_id) DO NOTHING;
  END IF;` : ''}
  SELECT * INTO r FROM public.theme_renderer_manifests WHERE theme_package_version_id=v.id FOR UPDATE;
  IF r.id IS NULL OR (to_jsonb(r)-ARRAY['id','theme_package_version_id','created_at','updated_at']) IS DISTINCT FROM body THEN RAISE EXCEPTION '393 immutable renderer conflict'; END IF;
 END LOOP;`;
}

export function renderPair(proposal: Proposal) {
  assertProposal(proposal);
  const payload = canonicalJson({ previous: proposal.previous, next: proposal.artifact });
  assert(!payload.includes(delimiter), 'Reserved SQL delimiter in artifact.');
  const start = `-- PROPOSED393 ONLY. NOT in migration scan. Manifest ${proposal.manifestSha256}.
BEGIN;
DO $promotion393$
DECLARE payload jsonb:=${delimiter}${payload}${delimiter}::jsonb; old_item jsonb;new_item jsonb;captured jsonb;body jsonb;saved jsonb;prior jsonb;expected_config jsonb;
 t public.themes;p public.theme_packages;v public.theme_package_versions;s public.theme_schema_manifests;r public.theme_renderer_manifests;
BEGIN
 old_item:=payload->'previous';new_item:=payload->'next';
 SELECT * INTO STRICT t FROM public.themes WHERE id='${ID}'::uuid AND slug='${SLUG}' AND owned_by_site_id IS NULL AND NOT is_site_private FOR UPDATE;
 IF t.is_active IS NOT TRUE THEN RAISE EXCEPTION '393 catalog unavailable'; END IF;
 IF (SELECT count(*) FROM public.theme_packages WHERE slug=t.slug OR legacy_theme_id=t.id)<>1 THEN RAISE EXCEPTION '393 ambiguous canonical package'; END IF;
 SELECT * INTO STRICT p FROM public.theme_packages WHERE slug=t.slug OR legacy_theme_id=t.id FOR UPDATE;
 IF p.slug<>t.slug OR (p.legacy_theme_id IS NOT NULL AND p.legacy_theme_id<>t.id) OR p.deleted_at IS NOT NULL OR p.status<>'active' THEN RAISE EXCEPTION '393 package unavailable'; END IF;
 IF (to_jsonb(p)-ARRAY['id','legacy_theme_id','created_by','created_at','updated_at','deleted_at']) IS DISTINCT FROM old_item#>'{persistence,themePackage}' THEN RAISE EXCEPTION '393 package metadata conflict'; END IF;
 saved:=t.config#>'{${checkpoint},previous}';
`;
  const guardSaved = `
 IF saved IS NULL OR t.config#>>'{${checkpoint},artifactSha256}' IS DISTINCT FROM new_item->>'payloadSha256'
  OR t.config#>>'{${checkpoint},previousArtifactSha256}' IS DISTINCT FROM old_item->>'payloadSha256'
  OR t.config#>>'{${checkpoint},previousSha256}' IS DISTINCT FROM encode(sha256(convert_to(saved::text,'UTF8')),'hex')
  OR (saved-'config') IS DISTINCT FROM ${expectedManaged('old_item')} THEN RAISE EXCEPTION '393 stale or corrupted rollback checkpoint'; END IF;
 expected_config:=coalesce(saved->'config','{}'::jsonb)||jsonb_build_object('designVersion','2.0.1','${checkpoint}',t.config->'${checkpoint}');
 IF ${currentManaged} IS DISTINCT FROM ${expectedManaged('new_item')} OR t.config IS DISTINCT FROM expected_config THEN RAISE EXCEPTION '393 catalog changed after promotion'; END IF;
`;
  const up = start + `
 IF t.version='2.0.0' THEN
  IF t.config ? '${checkpoint}' OR ${currentManaged} IS DISTINCT FROM ${expectedManaged('old_item')}
   OR t.config#>>'{nicheV2Promotion389,artifactSha256}' IS DISTINCT FROM old_item->>'payloadSha256' THEN RAISE EXCEPTION '393 unexpected prior catalog'; END IF;
 ELSIF t.version='2.0.1' THEN ${guardSaved}
 ELSE RAISE EXCEPTION '393 unexpected catalog version'; END IF;
` + captureSql(true) + `
 IF t.version='2.0.1' THEN RETURN; END IF;
 prior:=${currentManaged}||jsonb_build_object('config',t.config);
 UPDATE public.themes SET name=new_item->>'name',category=new_item->>'category',version='2.0.1',default_template=new_item->'document',
 section_schemas=new_item#>'{persistence,schemaManifest,section_schemas}',block_schemas=new_item#>'{persistence,schemaManifest,block_schemas}',settings_schema=new_item#>'{persistence,schemaManifest,settings_schema}',
 renderer_manifest=new_item#>'{document,liquidBundle,renderer}',schema_version=new_item#>>'{persistence,themePackageVersion,schema_version}',renderer_version=new_item#>>'{persistence,themePackageVersion,renderer_version}',
 config=coalesce(t.config,'{}'::jsonb)||jsonb_build_object('designVersion','2.0.1','${checkpoint}',jsonb_build_object('artifactSha256',new_item->>'payloadSha256','previousArtifactSha256',old_item->>'payloadSha256','previousSha256',encode(sha256(convert_to(prior::text,'UTF8')),'hex'),'previous',prior)),updated_at=now()
 WHERE id=t.id;
END;
$promotion393$;
COMMIT;
`;
  const down = start + `
 IF saved IS NULL THEN
  IF t.config ? '${checkpoint}' OR ${currentManaged} IS DISTINCT FROM ${expectedManaged('old_item')}
   OR t.config#>>'{nicheV2Promotion389,artifactSha256}' IS DISTINCT FROM old_item->>'payloadSha256' THEN RAISE EXCEPTION '393 unexpected unpromoted catalog'; END IF;
 ELSE ${guardSaved} END IF;
` + captureSql(false) + `
 IF saved IS NULL THEN RETURN; END IF;
 SELECT * INTO t FROM jsonb_populate_record(t,saved);
 UPDATE public.themes SET ${columns.map(key => `${key}=t.${key}`).join(',')},config=t.config,updated_at=now() WHERE id='${ID}'::uuid;
END;
$promotion393$;
COMMIT;
`;
  return { up, down };
}

export function writeProposal(proposal: Proposal, destination = RELEASE) {
  assertProposal(proposal);
  const directory = path.join(destination, 'proposals', proposal.manifestSha256);
  fs.mkdirSync(directory, { recursive: true });
  const pair = renderPair(proposal);
  const files: Record<string, string> = { [SLUG + '-2.0.1.json']: canonicalJson(proposal.artifact) + '\n',
    'manifest.json': canonicalJson({ ...proposal.manifest, manifestSha256: proposal.manifestSha256 }) + '\n',
    'semantic-diff.json': canonicalJson({ previous: '2.0.0', next: VERSION, paths: proposal.manifest.semanticDifferencePaths }) + '\n',
    '393_playfield_catalog_201.up.draft.sql': pair.up, '393_playfield_catalog_201.down.draft.sql': pair.down };
  for (const [name, bytes] of Object.entries(files)) {
    const file = path.join(directory, name);
    if (fs.existsSync(file)) assert.equal(fs.readFileSync(file, 'utf8'), bytes, 'Immutable proposal differs.');
    else fs.writeFileSync(file, bytes, { flag: 'wx' });
  }
  return directory;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['--proposal-only'], 'Only offline proposal capture is supported; no migration emission/application.');
  const proposal = buildProposal(); const directory = writeProposal(proposal);
  process.stdout.write(JSON.stringify({ manifestSha256: proposal.manifestSha256, directory, sourceMaxRequiredForNativeEntry: 392, proposedMigration: MIGRATION, sqlEmittedIntoScan: false, databaseTouched: false }) + '\n');
}
