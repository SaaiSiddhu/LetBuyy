// Preparation only until a corrected proposal is explicitly admitted and the
// coordinator allocates a fresh owned DB slot. No fallback proposal or skips.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import { StorefrontDiscoveryQuerySchema } from '@letbuyy/commerce-core';
import {
  assertImmutableCapture, assertProposalIntegrity, canonicalJson, readFrozenCatalog,
  readThreadlinePin, renderPromotionPair, sha256, SLUGS, type Artifact, type Proposal,
} from '../../../../../docs/implementation/niche-theme-programme/release-v2/generate-release';
import { readStorefrontDiscoveryPayload } from '../../lib/storefront-discovery';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const root = new URL('../../../../../', import.meta.url);
const docs = 'docs/implementation/threadline-2026-10-22/promotion-qualification/';
const measurementDocs = 'docs/implementation/threadline-2026-10-22/measurement-discovery/';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const admissionSchema = z.object({
  status: z.literal('ROOT_ACCEPTED_CORRECTED_PROPOSAL'),
  manifestSha256: hash, manifestFileSha256: hash,
  generatorSha256: hash, promotionUpSha256: hash, promotionDownSha256: hash,
  rootReceiptPath: z.string().regex(/^docs\/implementation\/niche-theme-programme\/[a-zA-Z0-9_./-]+\.json$/),
  rootReceiptSha256: hash,
}).strict();
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const q = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const json = (value: unknown) => q(JSON.stringify(value)) + '::jsonb';
const record = (value: unknown): Record<string, unknown> => {
  assert(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
};
const parse = (sql: string): unknown => JSON.parse(owned.scriptLarge(sql));
const allSlugs = [...SLUGS, 'letbuyy-sense'];
const slugList = allSlugs.map(q).join(',');
const discoverySignature = 'public.browse_storefront_products_v1(uuid,jsonb,uuid[])';
const baselineBody = '9af9d5e2e51052a874ffad94fc8088d6';
const expandedBody = '95cda4d15f36172c5457ad5045600cde';
const measurementUp = read(measurementDocs + '390_measurement_discovery.up.draft.sql');
const measurementDown = read(measurementDocs + '390_measurement_discovery.down.draft.sql');
assert.equal(sha256(measurementUp), '6e5eb5e50cecd43acc9a663dd79c505db6c7bfdbe4e559b34d998065f88e9027');
assert.equal(sha256(measurementDown), '1aca479d735539ec3d92974da0eed7b8e48e83e874d8612ea78dba7acc91cb7a');
let gateway: Gateway, proxy: OwnedPooledSqlProxy, evidenceDirectory: string;
after(async () => { await gateway?.settle(); await closePooledSqlClients(); await proxy?.stop(); });

function loadAdmittedProposal() {
  const input: unknown = JSON.parse(read(docs + 'admission.json'));
  const result = admissionSchema.safeParse(input);
  assert(result.success, 'ROOT_ACCEPTED_CORRECTED_PROPOSAL with all exact pins is required; no PROPOSAL.json/old candidate fallback');
  const admission = result.data;
  assert.equal(admission.rootReceiptPath, 'docs/implementation/niche-theme-programme/release-v2-final-admission.json');
  assert.equal(admission.rootReceiptSha256, '6e026f1adc4be82414e174a92e125d846aad4fab9119d48841350db14f22b1b6');
  assert(!admission.rootReceiptPath.split('/').includes('..'));
  const receipt = read(admission.rootReceiptPath);
  assert.equal(sha256(receipt), admission.rootReceiptSha256, 'root admission receipt changed');
  const approved = record(JSON.parse(receipt));
  assert.equal(approved.status, 'ACCEPTED_FOR_PAIRED_EMISSION_AND_OWNED_DB_QUALIFICATION');
  assert.equal(approved.migration, 389); assert.equal(approved.version, '2.0.0'); assert.equal(approved.artifactCount, 9);
  assert.equal(record(approved.manifest).manifestSha256, admission.manifestSha256);
  assert.equal(record(approved.manifest).fileSha256, admission.manifestFileSha256);
  assert.equal(record(approved.generator).sha256, admission.generatorSha256);
  assert.equal(record(record(approved.sql).up).sha256, admission.promotionUpSha256);
  assert.equal(record(record(approved.sql).down).sha256, admission.promotionDownSha256);
  assert.equal(record(record(approved.measurement390).up).sha256, sha256(measurementUp));
  assert.equal(record(record(approved.measurement390).down).sha256, sha256(measurementDown));
  assert.equal(sha256(read('docs/implementation/niche-theme-programme/release-v2/generate-release.ts')), admission.generatorSha256);
  const directory = `docs/implementation/niche-theme-programme/release-v2/proposals/${admission.manifestSha256}/`;
  const manifestBytes = read(directory + 'manifest.json');
  assert.equal(sha256(manifestBytes), admission.manifestFileSha256);
  const { manifestSha256, ...manifest } = JSON.parse(manifestBytes) as Proposal['manifest'] & { manifestSha256: string };
  assert.equal(manifestSha256, admission.manifestSha256);
  const artifacts = manifest.artifacts.map(row => {
    assert.equal(row.file, `${row.slug}-2.0.0.json`, 'artifact must remain inside the admitted content-addressed directory');
    const bytes = read(directory + row.file);
    assert.equal(sha256(bytes), row.fileSha256, `actual on-disk artifact changed: ${row.slug}`);
    const artifact = JSON.parse(bytes) as Artifact;
    assert.equal(bytes, canonicalJson(artifact) + '\n');
    return artifact;
  });
  const proposal: Proposal = { manifest, manifestSha256, artifacts };
  assertProposalIntegrity(proposal); // Canonical payload checks, never factory regeneration.
  for (const [path, digest] of Object.entries(manifest.sourceHashes)) {
    assert(!path.startsWith('/') && !path.split('/').includes('..'));
    assert.equal(sha256(read(path)), digest, `admitted helper/source changed: ${path}`);
  }
  const pair = renderPromotionPair(proposal);
  assert.equal(sha256(pair.up), admission.promotionUpSha256);
  assert.equal(sha256(pair.down), admission.promotionDownSha256);
  for (const [directoryName, expected] of [['migrations',pair.up],['rollback',pair.down]] as const) {
    const directoryPath = `database/supabase/${directoryName}/`;
    const files = readdirSync(new URL(directoryPath, root)).filter(name => /^389_.*\.sql$/.test(name));
    assert.equal(files.length, 1, 'the accepted pair must be emitted exactly once before native qualification');
    assert.equal(read(directoryPath + files[0]), expected, 'actual migration scan bytes differ from admitted rendered pair');
  }
  assert.deepEqual(readThreadlinePin(), manifest.protected.threadline);
  assert.equal(readThreadlinePin().bundleSha256, '61082be647eadae9b6e42002be241a82ba6c3627427568f6e64e2cf961c3742e');
  return { admission, proposal, pair };
}

function proof(name: string, value: unknown) {
  const bytes = JSON.stringify(value, null, 2) + '\n';
  const path = join(evidenceDirectory, name + '.json');
  writeFileSync(path, bytes, { mode: 0o600, flag: 'wx' });
  console.info('NICHE389_PROVENANCE', JSON.stringify({ path, sha256: sha256(bytes) }));
}
function tableDigest(tables: readonly string[]) {
  for (const table of tables) assert.match(table, /^[a-z_]+$/);
  return owned.psql(`SELECT md5(jsonb_build_object(${tables.flatMap(table => [q(table), `(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM public.${table} x)`]).join(',')})::text);`);
}
const captures = () => tableDigest(['theme_packages', 'theme_package_versions', 'theme_schema_manifests', 'theme_renderer_manifests']);
const merchants = () => tableDigest(['sites', 'store_themes', 'theme_instances', 'theme_instance_drafts', 'theme_editor_drafts', 'theme_draft_patches', 'theme_releases', 'idempotency_keys']);
const fullState = () => tableDigest(['themes', 'theme_packages', 'theme_package_versions', 'theme_schema_manifests', 'theme_renderer_manifests', 'sites', 'store_themes', 'theme_instances', 'theme_instance_drafts', 'theme_editor_drafts', 'theme_releases', 'idempotency_keys']);
const catalog = () => parse(`SELECT jsonb_agg(to_jsonb(t)-'updated_at' ORDER BY slug) FROM themes t WHERE slug IN(${slugList});`) as Array<Record<string, unknown>>;
const threadline = () => owned.psql(`SELECT md5(to_jsonb(t)::text) FROM themes t WHERE slug='letbuyy-sense';`);
const bodyHash = () => owned.psql(`SELECT md5(prosrc) FROM pg_proc WHERE oid=${q(discoverySignature)}::regprocedure;`);
function discoveryProfile() {
  return owned.psql(`SELECT md5(jsonb_agg(jsonb_build_object('row',to_jsonb(p),'definition',pg_get_functiondef(p.oid),'comment',obj_description(p.oid,'pg_proc'),
    'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid),
    'sharedDependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_shdepend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.dbid=(SELECT oid FROM pg_database WHERE datname=current_database()))) ORDER BY p.proname)::text)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND(p.proname LIKE 'storefront_discovery_%_v1' OR p.proname IN('browse_storefront_products_v1','browse_storefront_apparel_v1'));`);
}
function provenance(artifact: Artifact) {
  return record(parse(`SELECT jsonb_build_object('catalog',to_jsonb(t),'packages',coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('versions',coalesce((SELECT jsonb_agg(to_jsonb(v)||jsonb_build_object(
    'schema_capture',(SELECT to_jsonb(s) FROM theme_schema_manifests s WHERE s.theme_package_version_id=v.id),
    'renderer_capture',(SELECT to_jsonb(r) FROM theme_renderer_manifests r WHERE r.theme_package_version_id=v.id)) ORDER BY v.id) FROM theme_package_versions v WHERE v.theme_package_id=p.id),'[]'))) FROM theme_packages p WHERE p.slug=t.slug OR p.legacy_theme_id=t.id),'[]'))
    FROM themes t WHERE t.id=${q(artifact.id)} AND t.slug=${q(artifact.slug)};`));
}
function assertCapture(artifact: Artifact) {
  const rows = provenance(artifact), packages = rows.packages;
  assert(Array.isArray(packages)); assert.equal(packages.length, 1, 'one canonical package identity');
  const pkg = record(packages[0]);
  assert.equal(pkg.slug, artifact.slug); assert.equal(pkg.legacy_theme_id, artifact.id);
  assert.equal(pkg.status, 'active'); assert.equal(pkg.deleted_at, null);
  assert(Array.isArray(pkg.versions));
  const versions = pkg.versions.map(record).filter(row => row.version === artifact.version);
  assert.equal(versions.length, 1, 'one exact v2 capture');
  const version = versions[0], schema = record(version.schema_capture), renderer = record(version.renderer_capture);
  const omit = (row: Record<string, unknown>, keys: string[]) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));
  assert.equal(version.deleted_at, null);
  assertImmutableCapture(artifact, {
    slug: artifact.slug, version: artifact.version,
    packageVersion: omit(version, ['id','theme_package_id','published_at','created_by','created_at','updated_at','deleted_at','schema_capture','renderer_capture']),
    schemaManifest: omit(schema, ['id','theme_package_version_id','created_at','updated_at']),
    rendererManifest: omit(renderer, ['id','theme_package_version_id','created_at','updated_at']),
  });
  const row = record(rows.catalog);
  assert.equal(row.id, artifact.id); assert.equal(row.slug, artifact.slug);
  assert.equal(row.name, artifact.name); assert.equal(row.category, artifact.category); assert.equal(row.version, artifact.version);
  assert.equal(row.schema_version, version.schema_version); assert.equal(row.renderer_version, version.renderer_version);
  assert.equal(row.owned_by_site_id, null); assert.equal(row.is_site_private, false);
  assert.equal(row.theme_preset_id, artifact.presetId);
  assert.equal(record(row.config).preset_id, artifact.presetId);
  assert.equal(canonicalJson(row.default_template), canonicalJson(artifact.document));
  assert.equal(canonicalJson(row.settings_schema), canonicalJson(artifact.persistence.schemaManifest.settings_schema));
  assert.equal(canonicalJson(row.section_schemas), canonicalJson(artifact.persistence.schemaManifest.section_schemas));
  assert.equal(canonicalJson(row.block_schemas), canonicalJson(artifact.persistence.schemaManifest.block_schemas));
  assert.equal(canonicalJson(row.renderer_manifest), canonicalJson(record(artifact.document.liquidBundle).renderer));
  return { packageId: String(pkg.id), versionId: String(version.id), rows };
}

// Negative probes keep the admitted DDL body intact and change only its outer
// transaction wrapper. Both accepted and refused probes are always rolled back.
function refusal(mutation: string, script: string, expected: RegExp) {
  assert.equal(script.match(/^BEGIN;$/gm)?.length, 1); assert.equal(script.match(/^COMMIT;$/gm)?.length, 1);
  const inner = script.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
  const before = fullState(), profile = discoveryProfile();
  const error = owned.psqlScriptExpectError(`BEGIN;${mutation}\n${inner}\nROLLBACK;`);
  assert.match(error, expected, 'specific real refusal, not an unrelated setup error');
  assert.equal(fullState(), before, 'refused whole proposal/mutant leaves exact catalog/captures/merchant state');
  assert.equal(discoveryProfile(), profile);
}

test('admitted disk-loaded nine-theme389 promotion composes with exact390 and preserves immutable merchant history', async t => {
  const stage = async (name: string, work: () => void | Promise<void>) => {
    let passed = false;
    await t.test(name, async () => { await work(); passed = true; });
    assert(passed, `Stopped dependent qualification after failed phase: ${name}`);
  };
  const { admission, proposal, pair } = loadAdmittedProposal();
  evidenceDirectory = mkdtempSync(join(tmpdir(), `letbuyy-niche389-${owned.runId}-`));
  assert.equal(owned.psql("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='carts' AND column_name='fact_acceptance_version');"), 't', 'reviewed388 baseline is required');
  const frozenIds = readFrozenCatalog(), initialRows = catalog(); assert.equal(initialRows.length, 10);
  for (const row of initialRows) assert.equal(row.id, frozenIds.get(String(row.slug)));
  const initialThreadline = threadline();
  const protectedSql = read('database/supabase/migrations/382_threadline_catalog_v2.sql');
  const protectedPayload = record(JSON.parse(protectedSql.match(/\$liquidbundle\$([\s\S]*?)\$liquidbundle\$::jsonb/)![1]));
  assert.equal(canonicalJson(record(initialRows.find(row => row.slug === 'letbuyy-sense')).default_template), canonicalJson(protectedPayload.document));
  const entryBody = bodyHash(); assert([baselineBody, expandedBody].includes(entryBody), 'unknown discovery state refuses before DDL');
  const promoted = proposal.artifacts.map(artifact => {
    const row = initialRows.find(row => row.slug === artifact.slug); assert(row);
    if (row.version === artifact.previousCatalogVersion) return false;
    assert.equal(row.version, artifact.version, 'mixed/unknown catalog version');
    assertCapture(artifact);
    assert.equal(record(record(row.config).nicheV2Promotion389).artifactSha256, artifact.payloadSha256);
    return true;
  });
  assert(promoted.every(Boolean) || promoted.every(value => !value), 'partially applied389 is not a valid regression entry');
  const latestEntry = promoted.every(Boolean);
  assert(latestEntry || entryBody === baselineBody, '390 without admitted389 is not a reviewed entry');
  proof('entry', { runId: owned.runId, manifestSha256: admission.manifestSha256, mode: latestEntry ? 'LATEST_EXACT389_OR389_390_REGRESSION' : 'THROUGH388_QUALIFICATION', body: entryBody, catalog: initialRows, captureDigest: captures(), merchantDigest: merchants() });
  if (entryBody === expandedBody) owned.script(measurementDown);
  if (latestEntry) owned.scriptLarge(pair.down);
  assert.equal(bodyHash(), baselineBody);
  for (const artifact of proposal.artifacts) assert.equal(catalog().find(row => row.slug === artifact.slug)?.version, artifact.previousCatalogVersion);

  const a = newSyntheticTenant('niche389-a'), b = newSyntheticTenant('niche389-b');
  seedSyntheticTenant(owned.psql, a); seedSyntheticTenant(owned.psql, b);
  const owner = randomUUID(), foreign = randomUUID(), email = `promotion-${owner}@example.invalid`, otherEmail = `promotion-${foreign}@example.invalid`;
  owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES(${q(owner)},${q(email)},true),(${q(foreign)},${q(otherEmail)},true);
    UPDATE sites SET custom_user_id=${q(owner)},theme_id='letbuyy-core' WHERE id=${q(a.siteId)};
    UPDATE sites SET custom_user_id=${q(foreign)},theme_id='letbuyy-core' WHERE id=${q(b.siteId)};
    INSERT INTO subscriptions(user_id,store_id,plan,status) VALUES(${q(owner)},${q(a.siteId)},'enterprise','active'),(${q(foreign)},${q(b.siteId)},'enterprise','active');`);
  proxy = await startOwnedPooledSqlProxy(owned); gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), proxy.env()));
  const request = async (path: string, method = 'GET', value?: unknown, other = false) => {
    const response = await gateway.request(path, { method, headers: await signedIdentityHeaders(other ? foreign : owner, other ? otherEmail : email, other ? b.siteId : a.siteId), ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
    await gateway.settle(); return response;
  };
  const data = (response: Awaited<ReturnType<typeof request>>) => record(response.json?.data);
  // Materialize actual prior contracts through their real reader. The resulting
  // package IDs must survive promotion; never seed replacement capture rows.
  for (const slug of allSlugs) {
    const response = await request(`/v1/themes/${slug}/schema`); assert.equal(response.status, 200, response.text);
  }
  const protectedVersion = record(parse(`SELECT to_jsonb(v) FROM theme_packages p JOIN theme_package_versions v ON v.theme_package_id=p.id
    WHERE p.slug='letbuyy-sense' AND v.version='2.0.0' AND v.deleted_at IS NULL;`));
  assert.equal(protectedVersion.release_status, 'published');
  assert.equal(canonicalJson(record(protectedVersion.package_manifest).liquidBundle), canonicalJson(record(protectedPayload.document).liquidBundle));
  const beforeCatalog = catalog(), prior = proposal.artifacts.map(provenance);
  proof('prior-before-promotion-and-install', prior);
  const priorPackageIds = new Map(prior.map(row => { const pkg = record((row.packages as unknown[])[0]); return [String(record(row.catalog).slug), String(pkg.id)]; }));
  const stableIdentity = initialRows.map(row => ({ id: row.id, slug: row.slug, preset: row.theme_preset_id, alias: record(row.config).preset_id }));
  const canonicalId = (slug: string) => q(priorPackageIds.get(slug)!);

  await stage('389 applies/replays exact disk artifacts and captures real provenance before any installation', () => {
    const beforeMerchants = merchants(), profile = discoveryProfile();
    owned.scriptLarge(pair.up); assert.equal(merchants(), beforeMerchants); assert.equal(discoveryProfile(), profile);
    for (const artifact of proposal.artifacts) assert.equal(assertCapture(artifact).packageId, priorPackageIds.get(artifact.slug));
    assert.deepEqual(catalog().map(row => ({ id: row.id, slug: row.slug, preset: row.theme_preset_id, alias: record(row.config).preset_id })), stableIdentity);
    assert.equal(threadline(), initialThreadline);
    const after = fullState(); owned.scriptLarge(pair.up); assert.equal(fullState(), after, 'UP replay is a true no-op');
    proof('promoted-before-install', proposal.artifacts.map(artifact => assertCapture(artifact).rows));
  });

  await stage('all nine install/load/unchanged wire-save/reload/retry/publish use exact immutable versions', async () => {
    const immutable = captures();
    const ownB = await request(`/v1/themes?store_id=${b.siteId}`, 'GET', undefined, true); assert.equal(ownB.status, 200, ownB.text);
    for (const artifact of proposal.artifacts) {
      const selected = assertCapture(artifact), selection = { store_id: a.siteId, expected_version: artifact.version, expected_package_id: selected.packageId, expected_package_version_id: selected.versionId };
      const base = `/v1/themes/${artifact.slug}`, liveBefore = owned.psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE id=${q(a.siteId)};`);
      const added = await request(base + '/install', 'POST', selection); assert.equal(added.status, 201, added.text);
      assert.equal(data(added).installed_version, artifact.version); assert.equal(data(added).theme_package_version_id, selected.versionId); assert.equal(data(added).theme_package_id, selected.packageId);
      assert.equal(owned.psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE id=${q(a.siteId)};`), liveBefore, 'Add does not publish');
      const loaded = await request(base + `/editor?store_id=${a.siteId}`); assert.equal(loaded.status, 200, loaded.text);
      const initial = data(loaded), config = record(JSON.parse(JSON.stringify(initial.template_config)));
      assert.equal(canonicalJson(config.liquidBundle), canonicalJson(artifact.document.liquidBundle));
      const parsedBundle = LiquidThemePackageBundleSchema.parse(config.liquidBundle); assert.equal(parsedBundle.package.slug, artifact.slug);
      assert.equal(canonicalJson(record(initial.schemas).sections), canonicalJson(artifact.persistence.schemaManifest.section_schemas));
      assert.equal(canonicalJson(record(initial.schemas).settings), canonicalJson(artifact.persistence.schemaManifest.settings_schema));
      assert.equal(canonicalJson(record(initial.schemas).blocks), canonicalJson(artifact.persistence.schemaManifest.block_schemas));
      assert.equal(canonicalJson(record(initial.schemas).templates), canonicalJson(artifact.persistence.schemaManifest.template_schema));
      assert.equal(canonicalJson(record(initial.schemas).layouts), canonicalJson(artifact.persistence.schemaManifest.layout_schema));
      assert.equal(canonicalJson(initial.renderer_manifest), canonicalJson(artifact.persistence.rendererManifest.renderer_manifest));
      assert.equal(canonicalJson(initial.approved_renderer_keys), canonicalJson(artifact.persistence.rendererManifest.approved_renderer_keys));
      assert.equal(record(initial.theme).theme_package_id, selected.packageId); assert.equal(record(initial.theme).theme_package_version_id, selected.versionId);
      const intent = { store_id: a.siteId, template_key: 'index', template_config: config, base_version: initial.version, idempotency_key: `native389-wire-${artifact.slug}` };
      const saved = await request(base + '/editor/draft', 'PUT', intent); assert.equal(saved.status, 200, saved.text);
      const reloaded = await request(base + `/editor?store_id=${a.siteId}`); assert.equal(reloaded.status, 200, reloaded.text);
      assert.equal(canonicalJson(data(reloaded).template_config), canonicalJson(config));
      const savedState = merchants();
      const retry = await request(base + '/editor/draft', 'PUT', intent); assert.equal(retry.status, 200, retry.text); assert.equal(data(retry).replayed, true); assert.equal(merchants(), savedState);
      const repeatedAdd = await request(base + '/install', 'POST', selection); assert.equal(repeatedAdd.status, 201, repeatedAdd.text); assert.equal(data(repeatedAdd).already_installed, true);
      assert.equal(data(repeatedAdd).theme_instance_id, data(added).theme_instance_id); assert.equal(data(repeatedAdd).theme_package_version_id, selected.versionId); assert.equal(data(repeatedAdd).installed_version, artifact.version); assert.equal(merchants(), savedState);
      const unknown = structuredClone(config); record(unknown.themeSettings).__synthetic_unknown_389 = true;
      record(record(record(unknown.liquidBundle).config).settings_data).current = { ...record(record(record(record(unknown.liquidBundle).config).settings_data).current), __synthetic_unknown_389: true };
      const denied = await request(base + '/editor/draft', 'PUT', { ...intent, template_config: unknown, base_version: data(saved).version, idempotency_key: randomUUID() });
      assert.equal(denied.status, 400, denied.text); assert.equal(merchants(), savedState);
      for (const patch of [{ expected_version: '9.0.0' }, { expected_package_id: randomUUID() }, { expected_package_version_id: randomUUID() }]) {
        const conflict = await request(base + '/install', 'POST', { ...selection, ...patch }); assert.equal(conflict.status, 409, conflict.text); assert.equal(merchants(), savedState);
      }
      const foreignInstall = await request(base + '/install', 'POST', selection, true); assert.equal(foreignInstall.status, 403, foreignInstall.text); assert.equal(merchants(), savedState);
      const foreignSave = await request(base + '/editor/draft', 'PUT', { ...intent, base_version: data(saved).version, idempotency_key: randomUUID() }, true);
      assert([403,404].includes(foreignSave.status), foreignSave.text); assert.equal(merchants(), savedState);
      const published = await request(base + '/publish', 'POST', { store_id: a.siteId, base_version: data(saved).version, idempotency_key: randomUUID(), make_store_live: true });
      assert.equal(published.status, 200, published.text);
      const release = record(parse(`SELECT to_jsonb(r) FROM sites s JOIN theme_releases r ON r.id=s.current_theme_release_id WHERE s.id=${q(a.siteId)};`));
      assert.equal(release.theme_package_version_id, selected.versionId);
      const releasedBundle = LiquidThemePackageBundleSchema.parse(record(release.template_snapshot).liquidBundle);
      assert.equal(releasedBundle.package.version, '2.0.0');
      assert.equal(canonicalJson(releasedBundle), canonicalJson(config.liquidBundle));
      assert.equal(captures(), immutable, 'load/save/retry/publish never rewrites immutable captures');
    }
    assert.equal(threadline(), initialThreadline);
  });

  await stage('immutable version/schema/renderer, ambiguity, revoked status and stale rollback refuse atomically', () => {
    const artifact = proposal.artifacts.at(-1)!;
    // Shadow the mutable package lookup only inside a rollback transaction;
    // original immutable versions/captures are never updated/deleted as mutants.
    const newPackage = randomUUID();
    const shadow = `UPDATE theme_packages SET slug=${q('synthetic-shadow-' + newPackage)},legacy_theme_id=NULL WHERE id=${canonicalId(artifact.slug)};
      INSERT INTO theme_packages(id,slug,name,legacy_theme_id,status) VALUES(${q(newPackage)},${q(artifact.slug)},'Synthetic conflict package',${q(artifact.id)},'active');`;
    const insertVersion = (body: unknown) => `INSERT INTO theme_package_versions(theme_package_id,version,version_number,release_status,renderer_version,schema_version,compatibility_range,package_manifest,checksum,published_at)
      SELECT ${q(newPackage)},x.version,x.version_number,x.release_status,x.renderer_version,x.schema_version,x.compatibility_range,x.package_manifest,x.checksum,now() FROM jsonb_populate_record(NULL::theme_package_versions,${json(body)}) x;`;
    const version = artifact.persistence.themePackageVersion;
    refusal(shadow + insertVersion({ ...version, checksum: 'synthetic-immutable-conflict' }), pair.up, /Immutable package version conflict/);
    refusal(shadow + insertVersion({ ...version, release_status: 'revoked' }), pair.up, /Immutable package version conflict/);
    const schema = artifact.persistence.schemaManifest;
    const insertSchema = (body: unknown) => `INSERT INTO theme_schema_manifests(theme_package_version_id,manifest_version,schema_manifest,section_schemas,block_schemas,settings_schema,template_schema,layout_schema,validation_rules)
      SELECT v.id,x.manifest_version,x.schema_manifest,x.section_schemas,x.block_schemas,x.settings_schema,x.template_schema,x.layout_schema,x.validation_rules FROM theme_package_versions v CROSS JOIN jsonb_populate_record(NULL::theme_schema_manifests,${json(body)}) x WHERE v.theme_package_id=${q(newPackage)};`;
    refusal(shadow + insertVersion(version) + insertSchema({ ...schema, manifest_version: 'synthetic-conflict' }), pair.up, /Immutable schema manifest conflict/);
    const renderer = { ...artifact.persistence.rendererManifest, approved_renderer_keys: ['synthetic-unapproved-renderer'] };
    const rendererMutation = `INSERT INTO theme_renderer_manifests(theme_package_version_id,renderer_manifest,approved_renderer_keys,asset_manifest,performance_budget)
      SELECT v.id,x.renderer_manifest,x.approved_renderer_keys,x.asset_manifest,x.performance_budget FROM theme_package_versions v CROSS JOIN jsonb_populate_record(NULL::theme_renderer_manifests,${json(renderer)}) x WHERE v.theme_package_id=${q(newPackage)};`;
    refusal(shadow + insertVersion(version) + insertSchema(schema) + rendererMutation, pair.up, /Immutable renderer manifest conflict/);
    refusal(`UPDATE theme_packages SET legacy_theme_id=NULL WHERE id=${canonicalId(artifact.slug)};INSERT INTO theme_packages(slug,name,legacy_theme_id) VALUES(${q('synthetic-ambiguous-' + randomUUID())},'Synthetic alias ambiguity',${q(artifact.id)});`, pair.up, /Ambiguous canonical package identity/);
    refusal(`UPDATE theme_packages SET status='disabled' WHERE id=${canonicalId(artifact.slug)};`, pair.up, /Canonical package unavailable/);
    refusal(`UPDATE themes SET default_template=default_template||'{"synthetic_unknown":true}'::jsonb WHERE id=${q(artifact.id)};`, pair.up, /Immutable catalog version conflict/);
    refusal(`UPDATE themes SET config=jsonb_set(config,'{nicheV2Promotion389,artifactSha256}','"synthetic-stale"') WHERE id=${q(artifact.id)};`, pair.down, /refusing stale rollback/);
  });

  await stage('390 measurement semantics/profile survive389 DOWN; ordered DOWN/UP restores both exact winners', async () => {
    const equipment = randomUUID(), furniture = randomUUID(), split = randomUUID();
    for (const [id, name, metadata] of [[equipment, 'Synthetic admitted equipment', { sports: { activity: 'badminton', equipmentType: 'racket', length: { value: 25.4, unit: 'cm' } } }], [furniture, 'Synthetic admitted furniture', { furniture: { assembled: { width: 24, depth: 30, unit: 'in' }, materials: ['Wood'], finish: 'Natural' } }], [split, 'Synthetic split furniture', {}]] as const)
      owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,metadata) VALUES(${q(id)},${q(a.siteId)},${q(a.siteId)},${q(name)},${q('syn-' + id)},100,5,true,'active',${json(metadata)});`);
    for (const metadata of [{ furniture: { assembled: { width: 20, unit: 'cm' } } }, { furniture: { assembled: { depth: 20, unit: 'cm' } } }]) {
      const id = randomUUID(); owned.psql(`INSERT INTO product_variants(id,product_id,title,sku,price,inventory_qty,metadata) VALUES(${q(id)},${q(split)},'Synthetic split axis',${q('SYN-' + id)},100,3,${json(metadata)});SELECT set_inventory_level_available(${q(split)},${q(id)},${q(a.locationId)},3,NULL);`);
    }
    const queries = [{}, { length_value: 25.4, length_unit: 'cm' }, { max_width_cm: 60.96 }, { max_depth_cm: 76.2 }, { max_width_cm: 20, max_depth_cm: 20 }, { max_width_cm: 60.9599 }, { page: 10000, limit: 1 }];
    const browse = (value: Record<string, unknown>) => {
      const query = StorefrontDiscoveryQuerySchema.parse(value);
      return readStorefrontDiscoveryPayload(parse(`SELECT public.browse_storefront_products_v1(${q(a.siteId)},${json(query)});`), query);
    };
    const oldProfile = discoveryProfile(), oldResults = queries.map(browse), immutable = captures(), merchantState = merchants();
    assert.equal(bodyHash(), baselineBody); owned.script(measurementUp); assert.equal(bodyHash(), expandedBody);
    const upgradedProfile = discoveryProfile(), upgradedResults = queries.map(browse);
    assert.equal(upgradedResults[1].count, 1); assert.equal(upgradedResults[1].discovery.measurement_capabilities?.equipment_length.available, true);
    assert.equal(upgradedResults[2].discovery.measurement_capabilities?.max_width_cm.available, true);
    assert.equal(upgradedResults[3].discovery.measurement_capabilities?.max_depth_cm.available, true);
    assert.equal(upgradedResults[4].count, 0, 'independent split axes never imply a same-variant joint fit');
    for (const query of queries.slice(1,4)) {
      const params = new URLSearchParams(Object.entries(query).map(([key,value]): [string,string] => [key,String(value)]));
      const response = await gateway.request(`/v1/storefront/${a.subdomain}/products?${params}`); assert.equal(response.status, 200, response.text);
      assert.equal(canonicalJson(response.json?.discovery), canonicalJson(browse(query).discovery));
    }
    await gateway.settle();
    owned.scriptLarge(pair.down); assert.equal(discoveryProfile(), upgradedProfile); assert.deepEqual(queries.map(browse), upgradedResults);
    assert.equal(captures(), immutable); assert.equal(merchants(), merchantState); assert.deepEqual(catalog(), beforeCatalog); assert.equal(threadline(), initialThreadline);
    const afterDown = fullState(); owned.scriptLarge(pair.down); assert.equal(fullState(), afterDown, 'DOWN replay preserves captured data');
    owned.scriptLarge(pair.up); for (const artifact of proposal.artifacts) assertCapture(artifact);
    assert.equal(discoveryProfile(), upgradedProfile); assert.deepEqual(queries.map(browse), upgradedResults);
    owned.script(measurementDown); assert.equal(bodyHash(), baselineBody); assert.equal(discoveryProfile(), oldProfile); assert.deepEqual(queries.map(browse), oldResults);
    owned.script(measurementUp); assert.equal(bodyHash(), expandedBody); assert.equal(discoveryProfile(), upgradedProfile); assert.deepEqual(queries.map(browse), upgradedResults);
    assert.equal(captures(), immutable); assert.equal(merchants(), merchantState); assert.equal(threadline(), initialThreadline);
    proof('qualified-composition', { runId: owned.runId, manifestSha256: proposal.manifestSha256, oldProfile, upgradedProfile, upgradedResults, protectedThreadline: readThreadlinePin(), immutableCaptureDigest: immutable, merchantDigest: merchantState, entryMode: latestEntry ? 'latest-regression' : 'through388' });
  });
  console.info('NICHE389_390_OWNED_QUALIFICATION', JSON.stringify({ runId: owned.runId, manifestSha256: proposal.manifestSha256, artifacts: proposal.artifacts.length, entry: latestEntry ? 'latest-regression' : 'through388', evidenceDirectory, scope: 'native SQL and real mounted gateway; no browser/provider acceptance' }));
});
