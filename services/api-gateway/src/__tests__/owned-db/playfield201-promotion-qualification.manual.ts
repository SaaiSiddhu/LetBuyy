// Candidate393 only, on an admitted fresh default-LATEST392 owned database.
// Real mounted merchant identity/tenant guards, RPCs, constraints and triggers; not an RLS proof.
// No app imports, browser, active fixture, migration emitter or alternate release writer.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { Hono } from 'hono';
import type { Env } from '../../index';
import { authMiddleware } from '../../middleware/auth';
import { resolveOwnedStoreScope } from '../../lib/tenant-context';
import { withTenantTx,bindOwnedTenantActor,publishThemeReleaseInTenantTx,TenantPublicationContextError } from '../../lib/tenant-transaction';
import { LiquidThemePackageBundleSchema, buildLiquidThemePackagePersistencePayload, LiquidRenderer, DEFAULT_THEME_SETTINGS } from '@letbuyy/theme-engine';
import { ToyFactsSchema, resolveToyFacts } from '@letbuyy/commerce-core';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest, newBarrier } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant, type SyntheticTenant } from './synthetic-tenant';

const root = new URL('../../../../../', import.meta.url);
const docs = 'docs/implementation/niche-theme-programme/release-playfield201/';
const proposalDirectory = docs + 'proposals/6bd27e70ca6f0a2169a15c3fe850d07bebb948a276002a483f730ac1f690885c/';
const suitePath = 'services/api-gateway/src/__tests__/owned-db/playfield201-promotion.postgres.test.ts';
const rootProposalPath = 'docs/implementation/niche-theme-programme/playfield201-proposal-admission.json';
const rootProposalSha = 'fafc7990283a89725841ce672b3136e034d33c72bc5ba66729beaf019d520a51';
const manifestSha = '6bd27e70ca6f0a2169a15c3fe850d07bebb948a276002a483f730ac1f690885c';
const slug = 'letbuyy-bloom', themeId = '7b669c70-0000-4000-8000-000000000008';
const read = (file: string) => readFileSync(new URL(file, root), 'utf8');
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const record = (value: unknown): Record<string, unknown> => {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value)); return value as Record<string, unknown>;
};
const canonical = (value: unknown): string => {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, sort(x)])) : v;
  return JSON.stringify(sort(value));
};
const q = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const json = (value: unknown) => q(canonical(value)) + '::jsonb';
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const admissionSchema = z.object({
  status: z.literal('ROOT_PLAYFIELD201_NATIVE_SOURCE_ADMITTED_FOR_ONE_DEFAULT_LATEST392_CANDIDATE393'),
  recordedAt: z.string().optional(), suitePath: z.literal(suitePath), suiteSha256: digestSchema,
  rootProposalPath: z.literal(rootProposalPath), rootProposalSha256: z.literal(rootProposalSha),
  manifestSha256: z.literal(manifestSha), sourceMigrationMaximum: z.literal(392), migrationCeiling: z.null(),
  candidateMigration: z.literal(393), candidateOutsideMigrationScan: z.literal(true),
  inputClosurePath: z.literal(docs + 'native-qualification/source-input-closure.json'), inputClosureSha256: digestSchema,
  nativeLease: z.literal('GRANTED_ONE_FRESH_DEFAULT_LATEST392_JOBS1_NO_REAP_PREPARED2_600S'),
}).strict();

/** File/admission checks execute before even obtaining the owned DB handle. No factory regeneration. */
function admittedInputs() {
  const admission = admissionSchema.parse(JSON.parse(read(docs + 'native-qualification/admission.json')));
  assert.equal(sha(read(suitePath)), admission.suiteSha256);
  assert.equal(sha(read(rootProposalPath)), rootProposalSha);
  const approved = record(JSON.parse(read(rootProposalPath)));
  assert.equal(approved.status, 'ROOT_PLAYFIELD201_IMMUTABLE_PROPOSAL_ADMITTED_NATIVE_TEST_SOURCE_NEXT');
  assert.equal(approved.manifestSha256, manifestSha); assert.equal(approved.sourceMigrationMaximum, 392);
  const files = z.array(z.object({ path: z.string(), sha256: digestSchema, bytes: z.number().int().positive() }).strict()).parse(approved.files);
  assert.equal(files.length, 5); assert.equal(new Set(files.map(f => f.path)).size, 5);
  for (const file of files) { assert(file.path.startsWith(proposalDirectory)); assert(!file.path.includes('..')); assert.equal(sha(read(file.path)), file.sha256); assert.equal(Buffer.byteLength(read(file.path)), file.bytes); }
  assert.equal(sha(read(proposalDirectory + 'manifest.json')), '3908686ae847a493df721538bdc47afd69f1e9fbe72dfd8edda710621b130928');
  const manifest = record(JSON.parse(read(proposalDirectory + 'manifest.json')));
  const { manifestSha256: actualManifestSha, ...manifestBody } = manifest;
  assert.equal(actualManifestSha, manifestSha); assert.equal(sha(canonical(manifestBody)), manifestSha);
  assert.equal(manifest.rawFactorySha256, '91dd7e6239aefa6a341dfc04ba5d8cc79d8136f1c4d46b48fda66799ecbbe9d7');
  const sources = z.record(z.string(), digestSchema).parse(manifest.sourceHashes); assert.equal(Object.keys(sources).length, 61);
  for (const [file, hash] of Object.entries(sources)) { assert(!file.includes('..')); assert(!/liquid-hydration-islands|variant-selection-url/.test(file)); assert.equal(sha(read(file)), hash); }
  assert.equal(sha(read(admission.inputClosurePath)), admission.inputClosureSha256);
  const closure = z.object({ files: z.array(z.object({ path: z.string(), sha256: digestSchema }).strict()) }).passthrough().parse(JSON.parse(read(admission.inputClosurePath)));
  assert(closure.files.some(f => f.path === suitePath));
  for (const file of closure.files) { assert(!file.path.includes('..')); assert(!/liquid-hydration-islands|variant-selection-url/.test(file.path)); assert.equal(sha(read(file.path)), file.sha256); }
  const migrations = readdirSync(new URL('database/supabase/migrations/', root)).filter(p => p.endsWith('.sql'));
  assert.equal(migrations.length, 321); assert.equal(Math.max(...migrations.map(p => Number(p.match(/^\d+/)?.[0]))), 392);
  assert(!migrations.some(p => p.startsWith('393_'))); assert(!readdirSync(new URL('database/supabase/rollback/', root)).some(p => p.startsWith('393_')));
  const artifact = record(JSON.parse(read(proposalDirectory + 'letbuyy-bloom-2.0.1.json')));
  const bundle = LiquidThemePackageBundleSchema.parse(record(artifact.document).liquidBundle);
  assert.equal(bundle.package.slug, slug); assert.equal(bundle.package.version, '2.0.1'); assert.equal(bundle.package.version_number, 3);
  assert.equal(sha(canonical(bundle)), '63fdb0ebefb7312d0a227f64aa8b53a239ef3430aab9c12946909e4c7f08ffeb');
  assert.equal(canonical(artifact.persistence), canonical(buildLiquidThemePackagePersistencePayload(bundle)));
  const previousFile = String(record(manifest.previous).file), previous = record(JSON.parse(read(previousFile)));
  assert.equal(sha(read(previousFile)), record(manifest.previous).fileSha256);
  const oldBundle = LiquidThemePackageBundleSchema.parse(record(previous.document).liquidBundle);
  assert.equal(oldBundle.package.version, '2.0.0');
  assert.equal(bundle.layout.theme.source, oldBundle.layout.theme.source);
  assert.equal(bundle.sections['customer-order-detail'].source, oldBundle.sections['customer-order-detail'].source);
  const up = read(proposalDirectory + '393_playfield_catalog_201.up.draft.sql'), down = read(proposalDirectory + '393_playfield_catalog_201.down.draft.sql');
  for (const sql of [up, down]) {
    const match = sql.match(/\$playfield201payload\$([\s\S]*?)\$playfield201payload\$::jsonb/); assert(match);
    const payload = record(JSON.parse(match[1])); assert.equal(canonical(payload.previous), canonical(previous)); assert.equal(canonical(payload.next), canonical(artifact));
  }
  return { admission, artifact, previous, bundle, oldBundle, up, down, sourceCount: closure.files.length };
}

const inputs = admittedInputs();
const owned = requireOwnedDatabase();
let gateway: Gateway | undefined, proxy: OwnedPooledSqlProxy | undefined, tap: ReturnType<typeof tapRest> | undefined;
after(async () => { tap?.restore(); await gateway?.settle(); await closePooledSqlClients(); await proxy?.stop(); });
const evidenceDirectory = mkdtempSync(join(tmpdir(), `letbuyy-playfield393-${owned.runId}-`));
let proofSequence = 0;
function proof(name: string, value: unknown) {
  const bytes = JSON.stringify({ runId: owned.runId, sequence: ++proofSequence, name, manifestSha256: manifestSha, suiteSha256: inputs.admission.suiteSha256, value }, null, 2) + '\n';
  const file = join(evidenceDirectory, `${String(proofSequence).padStart(3, '0')}-${name}.json`);
  writeFileSync(file, bytes, { mode: 0o600, flag: 'wx' }); console.info('PLAYFIELD393_PROVENANCE', JSON.stringify({ path: file, sha256: sha(bytes) }));
}
const parse = (sql: string): unknown => JSON.parse(owned.scriptLarge(sql));
const captures = ['theme_packages','theme_package_versions','theme_schema_manifests','theme_renderer_manifests'];
const merchantTables = ['users_custom','subscriptions','sites','store_themes','theme_instances','theme_instance_drafts','theme_editor_drafts','theme_draft_patches','theme_releases','theme_preview_sessions','storefront_cache_tags','idempotency_keys','audit_activity_events','outbox_events','products','product_variants','product_options','inventory_levels','collections','collection_products','orders','order_items','carts'];
function digest(tables: readonly string[]) {
  assert(tables.every(t => /^[a-z_]+$/.test(t)));
  return owned.psql(`SELECT encode(sha256(convert_to(jsonb_build_object(${tables.flatMap(t => [q(t), `(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]') FROM public.${t} x)`]).join(',')})::text,'UTF8')),'hex');`);
}
const fullState = () => digest(['themes', ...captures, ...merchantTables]);
function captureRows() {
  return record(parse(`SELECT jsonb_build_object(${captures.flatMap(t => [q(t), `(SELECT coalesce(jsonb_object_agg(id::text,encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex')),'{}') FROM public.${t} x)`]).join(',')});`));
}
function preservesRows(before: Record<string, unknown>, afterRows: Record<string, unknown>) {
  for (const [table, rows] of Object.entries(before)) for (const [id, hash] of Object.entries(record(rows))) assert.equal(record(afterRows[table])[id], hash, `immutable row ${table}/${id}`);
}
function functionProfiles() {
  return parse(`SELECT jsonb_agg(jsonb_build_object('row',to_jsonb(p),'comment',obj_description(p.oid,'pg_proc'),
    'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid),
    'sharedDependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_shdepend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.dbid=(SELECT oid FROM pg_database WHERE datname=current_database())),
    'roles',(SELECT jsonb_object_agg(r,has_function_privilege(r,p.oid,'EXECUTE')) FROM unnest(ARRAY['anon','authenticated','app_tenant','authenticator','service_role','postgres']) r)) ORDER BY p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND(p.proname LIKE 'storefront_discovery_%_v1' OR p.proname IN('browse_storefront_products_v1','browse_storefront_apparel_v1','mutate_owned_theme_draft_v1'));`);
}
function catalogRow() { return record(parse(`SELECT to_jsonb(t) FROM public.themes t WHERE id=${q(themeId)};`)); }
function otherCatalog() { return owned.psql(`SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text,'UTF8')),'hex') FROM themes t WHERE id<>${q(themeId)};`); }
const managedKeys = ['name','category','version','default_template','section_schemas','block_schemas','settings_schema','renderer_manifest','schema_version','renderer_version','config'];
const managed = (row: Record<string, unknown>) => Object.fromEntries(managedKeys.map(k => [k, row[k]]));
const nonManaged = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([k]) => ![...managedKeys,'updated_at','install_count'].includes(k)));
function selected(version: string) {
  const row = record(parse(`SELECT jsonb_build_object('packageId',p.id,'versionId',v.id,'version',v.version,'record',to_jsonb(v),'schema',(SELECT to_jsonb(s) FROM theme_schema_manifests s WHERE s.theme_package_version_id=v.id),'renderer',(SELECT to_jsonb(r) FROM theme_renderer_manifests r WHERE r.theme_package_version_id=v.id))
    FROM theme_packages p JOIN theme_package_versions v ON v.theme_package_id=p.id WHERE p.slug=${q(slug)} AND v.version=${q(version)} AND p.deleted_at IS NULL AND v.deleted_at IS NULL;`));
  assert.equal(row.version, version); z.string().uuid().parse(row.packageId); z.string().uuid().parse(row.versionId); return row;
}
function assertCapture(version: string, artifact: Record<string, unknown>) {
  const row = selected(version), payload = record(artifact.persistence), v = record(row.record);
  const omit = (value: Record<string, unknown>, keys: string[]) => Object.fromEntries(Object.entries(value).filter(([k]) => !keys.includes(k)));
  assert.equal(canonical(omit(v,['id','theme_package_id','published_at','created_by','created_at','updated_at','deleted_at'])), canonical({ ...record(payload.themePackageVersion), checksum: record(payload.themePackageVersion).checksum ?? null }));
  assert.equal(canonical(omit(record(row.schema),['id','theme_package_version_id','created_at','updated_at'])), canonical(payload.schemaManifest));
  assert.equal(canonical(omit(record(row.renderer),['id','theme_package_version_id','created_at','updated_at'])), canonical(payload.rendererManifest));
  return row;
}
function transactionBody(sql: string) {
  assert.equal((sql.match(/^BEGIN;$/gm) || []).length, 1); assert.equal((sql.match(/^COMMIT;$/gm) || []).length, 1);
  return sql.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
}

test('Playfield393: full append-only catalog promotion, exact selected installation/update, denial, Liquid and rollback qualification', async t => {
  const entryProfiles = functionProfiles(); assert(Array.isArray(entryProfiles)); assert.equal(entryProfiles.length, 14);
  assert.equal(owned.psql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb)'::regprocedure;"), 'f14f2252157119e56f6614decef4c4aa');
  assert.equal(owned.psql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.browse_storefront_products_v1(uuid,jsonb,uuid[])'::regprocedure;"), 'bdaec8db8f836e94294e4bdd9c449346');
  for(const name of ['mutate_owned_theme_draft_v1','browse_storefront_products_v1']){
    const row=entryProfiles.map(record).find(p=>record(p.row).proname===name);assert(row);const roles=record(row.roles);assert.equal(roles.service_role,true);
    for(const role of ['anon','authenticated','app_tenant','authenticator']){
      assert.equal(roles[role],false);
      const call=name==='browse_storefront_products_v1'?"public.browse_storefront_products_v1(NULL::uuid,'{}'::jsonb,NULL::uuid[])":"public.mutate_owned_theme_draft_v1(NULL::uuid,NULL::uuid,NULL::text,'index',0,'synthetic393-denied','save')";
      assert.match(owned.psqlScriptExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT ${call};ROLLBACK;`),/permission denied for function/);
    }
  }
  const tenants = [newSyntheticTenant('pf393-old'),newSyntheticTenant('pf393-new'),newSyntheticTenant('pf393-foreign'),newSyntheticTenant('pf393-down'),newSyntheticTenant('pf393-fault')];
  const actor = randomUUID(), foreignActor = randomUUID(), email = `pf393-${actor}@example.invalid`, foreignEmail = `pf393-${foreignActor}@example.invalid`;
  for (const site of tenants) seedSyntheticTenant(owned.psql, site);
  owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES(${q(actor)},${q(email)},true),(${q(foreignActor)},${q(foreignEmail)},true);`);
  for (const site of tenants) owned.psql(`UPDATE sites SET custom_user_id=${q(site===tenants[2]?foreignActor:actor)},theme_id='letbuyy-core',status='draft',published=false WHERE id=${q(site.siteId)};
    INSERT INTO subscriptions(user_id,store_id,plan,status) VALUES(${q(site===tenants[2]?foreignActor:actor)},${q(site.siteId)},'enterprise','active');`);
  const [oldSite,newSite,foreignSite,downSite,faultSite] = tenants;
  proxy = await startOwnedPooledSqlProxy(owned); gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), proxy.env()));
  // Context bootstrap only: real signed verifier + live canonical resolver; all commerce acceptance still uses Gateway.
  // This in-memory middleware invocation is not credited as an update-route or browser-auth acceptance test.
  const resolvedScope=async(site:SyntheticTenant,foreign=false)=>{
    const result:{scope?:Awaited<ReturnType<typeof resolveOwnedStoreScope>>}={};
    const context=new Hono<{Bindings:Env}>();context.use(authMiddleware);context.get('/owned-scope',async c=>{result.scope=await resolveOwnedStoreScope(c,site.siteId);return c.json({ok:true});});
    const response=await context.request('https://owned.example.invalid/owned-scope',
      {headers:await signedIdentityHeaders(foreign?foreignActor:actor,foreign?foreignEmail:email,site.siteId)},gateway!.env);
    assert.equal(response.status,200);assert(result.scope);return result.scope;
  };
  const publisherProfile=()=>parse(`SELECT jsonb_build_object('row',to_jsonb(p),'defaults',pg_get_expr(p.proargdefaults,0),
    'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid),
    'sharedDependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_shdepend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.dbid=(SELECT oid FROM pg_database WHERE datname=current_database())),
    'comment',obj_description(p.oid,'pg_proc'),'tenant_execute',has_function_privilege('app_tenant',p.oid,'EXECUTE'))
    FROM pg_proc p WHERE p.oid='public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)'::regprocedure;`);
  const entryPublisher=publisherProfile();assert.equal(record(entryPublisher).tenant_execute,false);
  const request = async (site: SyntheticTenant, path: string, method='GET', body?: unknown, asForeign=false) => {
    await new Promise<void>(resolve => setImmediate(resolve));
    const response = await gateway!.request(path,{ method,headers:await signedIdentityHeaders(asForeign?foreignActor:actor,asForeign?foreignEmail:email,asForeign?foreignSite.siteId:site.siteId),...(body===undefined?{}:{body:JSON.stringify(body)}) });
    await gateway!.settle();
    const redacted=(value:unknown):unknown=>Array.isArray(value)?value.map(redacted):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,/token|secret|cookie|authorization/i.test(key)?'[REDACTED]':redacted(v)])):value;
    const url=new URL(path,'https://owned.example.invalid');
    proof('mounted-api',{siteId:site.siteId,actor:asForeign?'foreign':'owner',method,path:url.pathname,queryKeys:[...url.searchParams.keys()],request:redacted(body??null),status:response.status,response:redacted(response.json),requestId:response.headers.get('x-request-id')});
    return response;
  };
  type Response = Awaited<ReturnType<typeof request>>;
  const data = (r: Response) => record(r.json?.data);
  const base = `/v1/themes/${slug}`;
  const install = (site: SyntheticTenant, choice: Record<string, unknown>, asForeign=false) => request(site,base+'/install','POST',{store_id:site.siteId,expected_version:choice.version,expected_package_id:choice.packageId,expected_package_version_id:choice.versionId},asForeign);
  const load = async (site: SyntheticTenant) => { const r=await request(site,base+`/editor?store_id=${site.siteId}`);assert.equal(r.status,200,r.text);return data(r); };
  const save = (site: SyntheticTenant, config: unknown, version: unknown, key=randomUUID()) => request(site,base+'/editor/draft','PUT',{store_id:site.siteId,template_key:'index',template_config:config,base_version:version,idempotency_key:key});
  const publish = (site: SyntheticTenant, version: unknown) => request(site,base+'/publish','POST',{store_id:site.siteId,base_version:version,idempotency_key:randomUUID(),make_store_live:true});
  const release = (site: SyntheticTenant) => record(parse(`SELECT to_jsonb(r) FROM sites s JOIN theme_releases r ON r.id=s.current_theme_release_id WHERE s.id=${q(site.siteId)};`));
  const privateDrafts = (site: SyntheticTenant) => owned.psql(`SELECT encode(sha256(convert_to(jsonb_build_object('instanceDrafts',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM theme_instance_drafts d WHERE store_id=${q(site.siteId)}),'editorDrafts',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM theme_editor_drafts d WHERE store_id=${q(site.siteId)}),'patches',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM theme_draft_patches d WHERE store_id=${q(site.siteId)}))::text,'UTF8')),'hex');`);
  const setHeading = (config: Record<string, unknown>, text: string) => {
    const page=record(record(config.templates).index),sections=record(page.sections);
    const section=Object.values(sections).map(record).find(v=>typeof record(v.settings).heading==='string');assert(section);record(section.settings).heading=text;
  };
  let oldChoice: Record<string, unknown>, newChoice: Record<string, unknown>, priorCatalog: Record<string, unknown>, baselineOther='', baselineCaptures: Record<string, unknown>, protectedDraft='', publishedOld: Record<string, unknown>;
  const constraintNames = z.array(z.string()).parse(parse("SELECT jsonb_agg(conname ORDER BY conname) FROM pg_constraint WHERE connamespace='public'::regnamespace;"));
  const immutableProtectors = z.array(z.string()).parse(parse("SELECT coalesce(jsonb_agg(name ORDER BY name),'[]') FROM (SELECT DISTINCT p.proname AS name FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE NOT t.tgisinternal AND t.tgrelid IN('public.theme_package_versions'::regclass,'public.theme_schema_manifests'::regclass,'public.theme_renderer_manifests'::regclass)) x;"));
  const refusalRecords: Array<Record<string, unknown>> = [];
  const refusal = (label: string, setup: string, candidate: string, expected: RegExp) => {
    const before=fullState(),error=owned.psqlScriptExpectError(`BEGIN;${setup}\n${transactionBody(candidate)}\nROLLBACK;`);
    assert.equal(fullState(),before,'refusal transaction conserves complete state');
    if(expected.test(error))refusalRecords.push({label,class:'393_GUARD_REFUSAL',message:error.slice(0,500)});
    else {
      const constraint=constraintNames.find(n=>error.includes('"'+n+'"'));
      const protector=immutableProtectors.find(n=>error.includes(n)&&/immutable|published|read.only/i.test(error));
      assert(constraint||protector,`Not the expected393guard or a real named constraint/protector: ${error.slice(0,600)}`);
      refusalRecords.push({label,class:constraint?'EXISTING_CONSTRAINT_DENIAL_BEFORE393_NOT_GUARD_CREDIT':'EXISTING_IMMUTABLE_TRIGGER_DENIAL_BEFORE393_NOT_GUARD_CREDIT',constraint:constraint??null,protector:protector??null});
    }
  };
  const stats = (cause: string, requireInstallTimestamp=false) => {
    const row=catalogRow();assert.equal(canonical(nonManaged(row)),canonical(nonManaged(priorCatalog)));
    const s=record(parse(`SELECT jsonb_build_object('activeCount',count(*) FILTER(WHERE is_active),'latest',max(updated_at)) FROM store_themes WHERE theme_id=${q(themeId)};`));
    assert.equal(row.install_count,s.activeCount,'real native active-install counter');
    if(requireInstallTimestamp)assert.equal(row.updated_at,s.latest,'actual install trigger timestamp, not arbitrary normalization');
    proof('catalog-statistics',{cause,rowUpdatedAt:row.updated_at,activeCount:s.activeCount,libraryLatest:s.latest,exactInstallTimestampAsserted:requireInstallTimestamp});
  };
  const migrate = (sql: string, expectedVersion: string) => {
    const merchants=digest(merchantTables),oldRows=captureRows(),beforeClock=owned.psql('SELECT clock_timestamp()::text;');
    owned.scriptLarge(sql);const afterClock=owned.psql('SELECT clock_timestamp()::text;');
    assert.equal(digest(merchantTables),merchants);preservesRows(oldRows,captureRows());assert.equal(canonical(functionProfiles()),canonical(entryProfiles));assert.equal(otherCatalog(),baselineOther);
    assert.equal(catalogRow().version,expectedVersion);assert.equal(owned.psql(`SELECT updated_at BETWEEN ${q(beforeClock)}::timestamptz AND ${q(afterClock)}::timestamptz FROM themes WHERE id=${q(themeId)};`),'t');stats('migration-'+expectedVersion);
  };
  const stage = async (name: string, work: () => unknown | Promise<unknown>) => {let passed=false;await t.test(name,async()=>{await work();assert.equal(canonical(functionProfiles()),canonical(entryProfiles));if(baselineOther)assert.equal(otherCatalog(),baselineOther);passed=true;});assert(passed,`Stopped after failed phase: ${name}`);};

  await stage('1 baseline exact392 profiles and immutable200 install/save/publish/private-draft history',async()=>{
    const oldManifest=record(JSON.parse(read('docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/manifest.json')));
    assert(Array.isArray(oldManifest.artifacts));for(const item of oldManifest.artifacts){const a=record(item);const r=await request(oldSite,`/v1/themes/${String(a.slug)}/schema`);assert.equal(r.status,200,r.text);}
    assert.equal((await request(oldSite,'/v1/themes/letbuyy-sense/schema')).status,200);
    const foreignPositive=await request(foreignSite,`/v1/themes?store_id=${foreignSite.siteId}`,'GET',undefined,true);assert.equal(foreignPositive.status,200,foreignPositive.text);
    oldChoice=assertCapture('2.0.0',inputs.previous);priorCatalog=catalogRow();assert.equal(priorCatalog.version,'2.0.0');baselineOther=otherCatalog();baselineCaptures=captureRows();
    assert.equal((await install(oldSite,oldChoice)).status,201);stats('baseline200-install',true);
    const loaded=await load(oldSite),config=structuredClone(record(loaded.template_config));setHeading(config,'Synthetic393 published A');
    const saved=await save(oldSite,config,loaded.version);assert.equal(saved.status,200,saved.text);assert.equal((await publish(oldSite,data(saved).version)).status,200);publishedOld=release(oldSite);
    assert.equal(LiquidThemePackageBundleSchema.parse(record(publishedOld.template_snapshot).liquidBundle).package.version,'2.0.0');
    const next=await load(oldSite),draft=structuredClone(record(next.template_config));setHeading(draft,'Synthetic393 private B');const draftKey=randomUUID(),savedB=await save(oldSite,draft,next.version,draftKey);assert.equal(savedB.status,200,savedB.text);
    const draftState=fullState(),draftRetry=await save(oldSite,draft,next.version,draftKey);assert.equal(draftRetry.status,200,draftRetry.text);assert.equal(data(draftRetry).replayed,true);assert.equal(fullState(),draftState);
    assert.equal((await save(oldSite,draft,loaded.version)).status,409);assert.equal(fullState(),draftState);
    const changedDraft=structuredClone(draft);setHeading(changedDraft,'Synthetic393 key conflict');assert.equal((await save(oldSite,changedDraft,next.version,draftKey)).status,409);assert.equal(fullState(),draftState);
    protectedDraft=privateDrafts(oldSite);const publicRead=await gateway!.request(`/v1/storefront/${oldSite.subdomain}?projection=render-v1`);assert.equal(publicRead.status,200,publicRead.text);assert.match(publicRead.text,/Synthetic393 published A/);assert.doesNotMatch(publicRead.text,/Synthetic393 private B/);
    const preview=await request(oldSite,base+'/preview-session','POST',{store_id:oldSite.siteId,template_key:'index',ttl_seconds:900});assert.equal(preview.status,201,preview.text);const token=z.string().min(1).parse(data(preview).preview_token);
    const ownPreview=await gateway!.request(`/v1/storefront/${oldSite.subdomain}/theme-preview?token=${encodeURIComponent(token)}`);assert.equal(ownPreview.status,200,ownPreview.text);assert.match(ownPreview.text,/Synthetic393 private B/);
    const foreignAdded=await install(foreignSite,oldChoice,true);assert.equal(foreignAdded.status,201,foreignAdded.text);stats('foreign-positive200-install',true);
    const foreignPreview=await request(foreignSite,base+'/preview-session','POST',{store_id:foreignSite.siteId,template_key:'index',ttl_seconds:900},true);assert.equal(foreignPreview.status,201,foreignPreview.text);const foreignToken=z.string().min(1).parse(data(foreignPreview).preview_token);
    assert.equal((await gateway!.request(`/v1/storefront/${foreignSite.subdomain}/theme-preview?token=${encodeURIComponent(foreignToken)}`)).status,200,'foreign preview positive control before cross-token denial');
    assert.equal((await gateway!.request(`/v1/storefront/${foreignSite.subdomain}/theme-preview?token=${encodeURIComponent(token)}`)).status,404);
    assert.equal((await gateway!.request(`/v1/storefront/${oldSite.subdomain}/theme-preview?token=${encodeURIComponent(foreignToken)}`)).status,404);
    preservesRows(baselineCaptures,captureRows());proof('baseline',{profiles:entryProfiles,priorCatalog,oldChoice,protectedDraft,publishedRelease:publishedOld,captures:baselineCaptures,sourceCount:inputs.sourceCount});
  });

  await stage('2 append-only393 UP/replay changes one catalog and appends exactly one immutable triple',()=>{
    const before=captureRows();migrate(inputs.up,'2.0.1');newChoice=assertCapture('2.0.1',inputs.artifact);assert.equal(newChoice.packageId,oldChoice.packageId);preservesRows(before,captureRows());
    const afterRows=captureRows();for(const table of captures)assert.equal(Object.keys(record(afterRows[table])).length-Object.keys(record(before[table])).length,table==='theme_packages'?0:1);
    assert.equal(privateDrafts(oldSite),protectedDraft);assert.equal(canonical(release(oldSite)),canonical(publishedOld));
    const state=fullState();owned.scriptLarge(inputs.up);assert.equal(fullState(),state,'UP replay true no-op');proof('up-and-replay',{newChoice,captureRows:afterRows,merchantDigest:digest(merchantTables),replayState:state});
  });

  await stage('3 real selected201 Add is concurrent/idempotent/private and exact wrong-version/foreign requests deny',async()=>{
    const schema=await request(newSite,base+'/schema');assert.equal(schema.status,200,schema.text);const advertised=record(data(schema).theme);assert.equal(advertised.theme_package_id,newChoice.packageId);assert.equal(advertised.theme_package_version_id,newChoice.versionId);
    const siteBefore=owned.psql(`SELECT to_jsonb(s)::text FROM sites s WHERE id=${q(newSite.siteId)};`),barrier=newBarrier(3);
    tap=tapRest(owned.restUrl,async(call,forward)=>{if(call.resource==='rpc/install_owned_theme_v1'&&record(call.json).p_site===newSite.siteId)await barrier.arrive();return forward();});
    let responses: Response[];try{responses=await Promise.all([install(newSite,newChoice),install(newSite,newChoice),install(newSite,newChoice)]);}finally{tap.restore();tap=undefined;}
    const ids=new Set<string>();for(const r of responses){assert.equal(r.status,201,r.text);assert.equal(data(r).theme_package_version_id,newChoice.versionId);assert.equal(data(r).installed_version,'2.0.1');ids.add(String(data(r).theme_instance_id));}assert.equal(ids.size,1);
    assert.equal(owned.psql(`SELECT to_jsonb(s)::text FROM sites s WHERE id=${q(newSite.siteId)};`),siteBefore);stats('201-concurrent-install',true);
    const stable=fullState();const repeated=await install(newSite,newChoice);assert.equal(repeated.status,201,repeated.text);assert.equal(data(repeated).already_installed,true);assert.equal(fullState(),stable);
    for(const patch of [{version:'2.0.0'},{packageId:randomUUID()},{versionId:randomUUID()}]){assert.equal((await install(newSite,{...newChoice,...patch})).status,409);assert.equal(fullState(),stable);}
    assert.equal((await install(newSite,newChoice,true)).status,403);assert.equal(fullState(),stable);
    assert.equal((await install(oldSite,newChoice)).status,409,'Add cannot silently upgrade an existing200 instance');assert.equal(privateDrafts(oldSite),protectedDraft);assert.equal(canonical(release(oldSite)),canonical(publishedOld));
    const loaded=await load(newSite);assert.equal(LiquidThemePackageBundleSchema.parse(record(loaded.template_config).liquidBundle).package.version,'2.0.1');
    proof('selected201-add',{instanceIds:[...ids],choice:newChoice,oldPrivateDraft:protectedDraft,oldReleaseId:publishedOld.id});
  });

  await stage('4 real update-preview and confirmed update preserve merchant content/private history; CAS/isolation/retry prove one effect',async()=>{
    const ownScope=await resolvedScope(oldSite),otherScope=await resolvedScope(foreignSite,true);
    let backendPid=0;
    const roleProof=async()=>withTenantTx(gateway!.env,ownScope.tenant,async tx=>{
      await bindOwnedTenantActor(tx,ownScope);
      const ctx=await tx.unsafe("SELECT current_user::text AS role,current_setting('app.site_id',true) AS site_id,pg_backend_pid() AS pid");
      assert.equal(ctx[0].role,'app_tenant');assert.equal(ctx[0].site_id,oldSite.siteId);backendPid=Number(ctx[0].pid);
      assert.equal((await tx.unsafe('SELECT id FROM sites WHERE id=$1::uuid',[oldSite.siteId])).length,1,'positive own-row control first');
      assert.equal((await tx.unsafe('SELECT id FROM sites')).length,1,'missing predicate still exposes only the positively verified tenant row');
      assert.equal((await tx.unsafe('SELECT id FROM sites WHERE id=$1::uuid',[foreignSite.siteId])).length,0,'actual RLS foreign-site denial');
      await tx.unsafe('SELECT set_config($1,$2,true)',['app.site_id','']);assert.equal((await tx.unsafe('SELECT id FROM sites')).length,0,'unset GUC is fail closed');
    });
    await roleProof();
    const directState=fullState();await assert.rejects(()=>withTenantTx(gateway!.env,ownScope.tenant,async tx=>{
      await bindOwnedTenantActor(tx,ownScope);await tx.unsafe('SELECT * FROM public.publish_theme_release(NULL::uuid,NULL::text,NULL::jsonb)');
    }),/permission denied/);assert.equal(fullState(),directState,'app_tenant direct publisher EXECUTE remains denied');
    for(const forged of [false,true]){
      await assert.rejects(()=>withTenantTx(gateway!.env,ownScope.tenant,async tx=>{
        await bindOwnedTenantActor(tx,ownScope);if(forged)await tx.unsafe('SELECT set_config($1,$2,true)',['app.site_id',foreignSite.siteId]);
        await publishThemeReleaseInTenantTx(tx,forged?ownScope:otherScope,{themeSlug:slug,releaseConfig:{liquidBundle:inputs.bundle},targetPackageVersionId:String(newChoice.versionId),priorReleaseId:String(publishedOld.id),requestHash:'a'.repeat(64),makeStoreLive:true});
      }));assert.equal(fullState(),directState,'forged scope/GUC has zero effects');
    }
    await assert.rejects(()=>withTenantTx(gateway!.env,ownScope.tenant,async tx=>{
      await bindOwnedTenantActor(tx,ownScope);
      await tx.unsafe('UPDATE public.theme_instances SET theme_package_version_id=$2::uuid WHERE store_id=$1::uuid AND theme_slug=$3',[oldSite.siteId,String(newChoice.versionId),slug]);
      await tx.unsafe('CREATE TEMP TABLE themes(id uuid,slug text) ON COMMIT DROP');
      await publishThemeReleaseInTenantTx(tx,ownScope,{themeSlug:slug,releaseConfig:{liquidBundle:inputs.bundle},targetPackageVersionId:String(newChoice.versionId),priorReleaseId:String(publishedOld.id),requestHash:'a'.repeat(64),makeStoreLive:true});
      assert.fail('temporary-table shadow must refuse before privilege use');
    }),TenantPublicationContextError);assert.equal(fullState(),directState,'temporary shadow refusal rolls back staged pin and all effects');
    const previewPath=base+`/update-preview?store_id=${oldSite.siteId}&target_package_version_id=${String(newChoice.versionId)}`;
    const before=fullState(),preview=await request(oldSite,previewPath);assert.equal(preview.status,200,preview.text);assert.equal(fullState(),before,'diff preview read-only');
    const diff=record(preview.json),hash=z.string().regex(/^[a-f0-9]{64}$/).parse(diff.diff_hash);
    const intent={store_id:oldSite.siteId,target_package_version_id:newChoice.versionId,confirm_diff_hash:hash,idempotency_key:randomUUID(),make_store_live:true};
    assert.equal((await request(oldSite,base+'/update','POST',{...intent,confirm_diff_hash:'0'.repeat(64)})).status,409);assert.equal(fullState(),before);
    assert.equal((await request(oldSite,previewPath,'GET',undefined,true)).status,403);assert.equal((await request(oldSite,base+'/update','POST',intent,true)).status,403);assert.equal(fullState(),before);
    const otherVersion=owned.psql(`SELECT v.id::text FROM theme_packages p JOIN theme_package_versions v ON v.theme_package_id=p.id WHERE p.slug<>${q(slug)} AND p.status='active' AND p.deleted_at IS NULL AND v.deleted_at IS NULL AND v.release_status='published' ORDER BY p.slug,v.version_number DESC LIMIT 1;`);z.string().uuid().parse(otherVersion);
    assert.equal((await request(oldSite,base+`/update-preview?store_id=${oldSite.siteId}&target_package_version_id=${otherVersion}`)).status,422,'an actual published version from another package cannot be a Playfield update target');assert.equal(fullState(),before);
    // Valid immutable fixture captures, inserted in their final unavailable state. No protected capture mutation.
    for(const unavailable of ['revoked','deleted'] as const){
      const versionId=randomUUID(),bundle=structuredClone(inputs.bundle);
      bundle.package.version=unavailable==='revoked'?'2.0.2':'2.0.3';bundle.package.version_number=unavailable==='revoked'?4:5;
      bundle.package.release_status=unavailable==='revoked'?'revoked':'published';
      const payload=buildLiquidThemePackagePersistencePayload(LiquidThemePackageBundleSchema.parse(bundle));
      owned.scriptLarge(`BEGIN;
        INSERT INTO theme_package_versions(id,theme_package_id,version,version_number,release_status,renderer_version,schema_version,compatibility_range,package_manifest,checksum,deleted_at)
        SELECT ${q(versionId)},${q(String(oldChoice.packageId))},v.version,v.version_number,v.release_status,v.renderer_version,v.schema_version,v.compatibility_range,v.package_manifest,v.checksum,${unavailable==='deleted'?'clock_timestamp()':'NULL'}
        FROM jsonb_populate_record(NULL::theme_package_versions,${json(payload.themePackageVersion)}) v;
        INSERT INTO theme_schema_manifests(theme_package_version_id,manifest_version,schema_manifest,section_schemas,block_schemas,settings_schema,template_schema,layout_schema,validation_rules)
        SELECT ${q(versionId)},s.manifest_version,s.schema_manifest,s.section_schemas,s.block_schemas,s.settings_schema,s.template_schema,s.layout_schema,s.validation_rules FROM jsonb_populate_record(NULL::theme_schema_manifests,${json(payload.schemaManifest)}) s;
        INSERT INTO theme_renderer_manifests(theme_package_version_id,renderer_manifest,approved_renderer_keys,asset_manifest,performance_budget)
        SELECT ${q(versionId)},r.renderer_manifest,r.approved_renderer_keys,r.asset_manifest,r.performance_budget FROM jsonb_populate_record(NULL::theme_renderer_manifests,${json(payload.rendererManifest)}) r;
        COMMIT;`);
      const immutableState=fullState(),denied=await request(oldSite,base+`/update-preview?store_id=${oldSite.siteId}&target_package_version_id=${versionId}`);
      assert.equal(denied.status,404,denied.text);assert.equal(fullState(),immutableState,`${unavailable} target read is denied without effects`);
      const postDenied=await request(oldSite,base+'/update','POST',{...intent,target_package_version_id:versionId,idempotency_key:randomUUID()});
      assert.equal(postDenied.status,404,postDenied.text);assert.equal(fullState(),immutableState);
      proof('unavailable-target',{kind:unavailable,versionId,persistedTriple:true,previewStatus:denied.status,postStatus:postDenied.status,noEffects:true});
    }
    for(const fault of ['outbox','audit','enrichment']){
      const key=randomUUID(),state=fullState();
      const table=fault==='outbox'?'outbox_events':fault==='audit'?'audit_activity_events':'theme_releases';
      const event=fault==='enrichment'?'UPDATE':'INSERT';
      const predicate=fault==='outbox'?"NEW.event_type='theme.release.published'":fault==='audit'?"NEW.action='theme.publish.capability_used'":`NEW.idempotency_key=${q(key)}`;
      owned.script(`CREATE FUNCTION public.synthetic_pf393_update_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.store_id=${q(oldSite.siteId)}::uuid AND ${predicate} THEN RAISE EXCEPTION 'SYNTHETIC393_UPDATE_PRIVATE';END IF;RETURN NEW;END $$;
        CREATE TRIGGER synthetic_pf393_update_fault BEFORE ${event} ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.synthetic_pf393_update_fault();`);
      try{const failed=await request(oldSite,base+'/update','POST',{...intent,idempotency_key:key});assert.equal(failed.status,500,failed.text);assert.equal(record(failed.json?.error).code,'INTERNAL_ERROR');assert.doesNotMatch(failed.text,/SYNTHETIC393_UPDATE_PRIVATE|PL\/pgSQL/);assert.equal(fullState(),state,`${fault} fault rolls pin/release/cache/audit/outbox/receipt back`);
        if(fault==='outbox'){
          await assert.rejects(()=>withTenantTx(gateway!.env,ownScope.tenant,async tx=>{
            await bindOwnedTenantActor(tx,ownScope);
            await tx.unsafe('UPDATE theme_instances SET theme_package_version_id=$2::uuid WHERE store_id=$1::uuid AND theme_slug=$3',[oldSite.siteId,String(newChoice.versionId),slug]);
            let refused=false;try{await publishThemeReleaseInTenantTx(tx,ownScope,{themeSlug:slug,releaseConfig:{liquidBundle:inputs.bundle},targetPackageVersionId:String(newChoice.versionId),priorReleaseId:String(publishedOld.id),requestHash:'a'.repeat(64),makeStoreLive:true});}
            catch{refused=true;const ctx=await tx.unsafe("SELECT current_user::text AS role,current_setting('app.site_id',true) AS site_id,pg_backend_pid() AS pid");assert.equal(ctx[0].role,'app_tenant');assert.equal(ctx[0].site_id,oldSite.siteId);assert.equal(Number(ctx[0].pid),backendPid);}assert(refused,'fault must fire');
            // Even a swallowed helper exception must poison the outer commit.
          }));assert.equal(fullState(),state);
        }
      }finally{owned.script(`DROP TRIGGER synthetic_pf393_update_fault ON public.${table};DROP FUNCTION public.synthetic_pf393_update_fault();`);}
      const originalPid=backendPid;await roleProof();assert.equal(backendPid,originalPid,'same sequential direct pool backend safely reused after rollback');
      assert.equal(canonical(publisherProfile()),canonical(entryPublisher));proof('tenant-update-fault',{fault,state,backendPid,exactRollback:true,publisherProfileUnchanged:true});
    }
    const historyPayload=(row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).filter(([key])=>!['is_current','release_status','updated_at'].includes(key)));
    const oldReleaseHash=sha(canonical(historyPayload(publishedOld))),draftBefore=privateDrafts(oldSite),updateClockBefore=owned.psql('SELECT clock_timestamp()::text;');
    const updateBarrier=newBarrier(3);let arrivals=0;
    tap=tapRest(owned.restUrl,async(call,forward)=>{if(call.resource==='sites'&&arrivals<3){arrivals++;await updateBarrier.arrive();}return forward();});
    let updates:Response[];try{updates=await Promise.all([request(oldSite,base+'/update','POST',intent),request(oldSite,base+'/update','POST',intent),request(oldSite,base+'/update','POST',intent)]);}finally{tap.restore();tap=undefined;}
    assert.equal(arrivals,3);for(const response of updates){assert.equal(response.status,200,response.text);}assert.equal(new Set(updates.map(r=>record(r.json).release_id)).size,1);assert.equal(updates.filter(r=>record(r.json).idempotent===false).length,1,'concurrent exact intent has one publication');
    const updated=updates.find(r=>record(r.json).idempotent===false)!;const updateClockAfter=owned.psql('SELECT clock_timestamp()::text;');
    const result=record(updated.json),current=release(oldSite);assert.equal(current.id,result.release_id);assert.equal(current.theme_package_version_id,newChoice.versionId);
    const updatedBundle=LiquidThemePackageBundleSchema.parse(record(current.template_snapshot).liquidBundle);assert.equal(updatedBundle.package.version,'2.0.1');assert.equal(privateDrafts(oldSite),draftBefore,'version update preserves unpublished draft B');
    assert.equal(owned.psql(`SELECT count(*) FROM audit_activity_events WHERE store_id=${q(oldSite.siteId)} AND action='theme.publish.capability_used' AND resource_id=${q(String(current.id))};`),'1','mandatory capability audit in the same publication transaction');
    const capabilityAudit=record(parse(`SELECT to_jsonb(a) FROM audit_activity_events a WHERE store_id=${q(oldSite.siteId)} AND action='theme.publish.capability_used' AND resource_id=${q(String(current.id))};`));
    assert.equal(capabilityAudit.actor_id,ownScope.customUser.id);assert.equal(record(capabilityAudit.metadata).reason,'theme.version_update.publish');
    assert.equal(record(capabilityAudit.metadata).prior_release_id,publishedOld.id);assert.equal(record(capabilityAudit.metadata).prior_package_version_id,oldChoice.versionId);
    assert.equal(record(capabilityAudit.metadata).target_package_version_id,newChoice.versionId);assert.match(String(record(capabilityAudit.metadata).request_hash),/^[a-f0-9]{64}$/);
    const prior=record(parse(`SELECT to_jsonb(r) FROM theme_releases r WHERE id=${q(String(publishedOld.id))};`));assert.equal(sha(canonical(historyPayload(prior))),oldReleaseHash,'every immutable old release field retained');assert.equal(prior.is_current,false);assert.equal(prior.release_status,'superseded');assert.equal(owned.psql(`SELECT updated_at BETWEEN ${q(updateClockBefore)}::timestamptz AND ${q(updateClockAfter)}::timestamptz FROM theme_releases WHERE id=${q(String(publishedOld.id))};`),'t','only known release lifecycle fields change within actual publication transaction');
    assert.match(canonical(current.template_snapshot),/Synthetic393 published A/);assert.doesNotMatch(canonical(current.template_snapshot),/Synthetic393 private B/);
    const committed=fullState(),retry=await request(oldSite,base+'/update','POST',intent);assert.equal(retry.status,200,retry.text);assert.equal(record(retry.json).release_id,current.id);assert.equal(record(retry.json).idempotent,true);assert.equal(fullState(),committed);
    assert.equal((await request(oldSite,base+'/update','POST',{...intent,idempotency_key:randomUUID()})).status,409,'a new key cannot apply a stale reviewed baseline');assert.equal(fullState(),committed);
    const changedKey=await request(oldSite,base+'/update','POST',{...intent,confirm_diff_hash:'f'.repeat(64)});assert.equal(changedKey.status,409);assert.equal(fullState(),committed);
    const unknown=await request(oldSite,base+`/update-preview?store_id=${oldSite.siteId}&target_package_version_id=${randomUUID()}`);assert.equal(unknown.status,404);assert.equal(fullState(),committed);
    const downgrade=await request(oldSite,base+`/update-preview?store_id=${oldSite.siteId}&target_package_version_id=${String(oldChoice.versionId)}`);assert.equal(downgrade.status,422);assert.equal(fullState(),committed);
    await roleProof();assert.equal(canonical(publisherProfile()),canonical(entryPublisher));
    proof('normal-confirmed-update',{diffHash:hash,releaseId:current.id,versionId:current.theme_package_version_id,oldReleaseHash,privateDraftDigest:draftBefore,retrySameRelease:true});
  });

  await stage('5 real393 guards and existing constraint denials stay distinct; late install fault has zero effects',async()=>{
    const packageId=String(newChoice.packageId),oldPayload=record(inputs.previous.persistence),newPayload=record(inputs.artifact.persistence);
    const insertVersion=(id:string,body:unknown)=>`INSERT INTO theme_package_versions(theme_package_id,version,version_number,release_status,renderer_version,schema_version,compatibility_range,package_manifest,checksum,published_at) SELECT ${q(id)},x.version,x.version_number,x.release_status,x.renderer_version,x.schema_version,x.compatibility_range,x.package_manifest,x.checksum,now() FROM jsonb_populate_record(NULL::theme_package_versions,${json(body)}) x;`;
    const insertSchema=(id:string,version:string,body:unknown)=>`INSERT INTO theme_schema_manifests(theme_package_version_id,manifest_version,schema_manifest,section_schemas,block_schemas,settings_schema,template_schema,layout_schema,validation_rules) SELECT v.id,x.manifest_version,x.schema_manifest,x.section_schemas,x.block_schemas,x.settings_schema,x.template_schema,x.layout_schema,x.validation_rules FROM theme_package_versions v CROSS JOIN jsonb_populate_record(NULL::theme_schema_manifests,${json(body)}) x WHERE v.theme_package_id=${q(id)} AND v.version=${q(version)};`;
    const insertRenderer=(id:string,version:string,body:unknown)=>`INSERT INTO theme_renderer_manifests(theme_package_version_id,renderer_manifest,approved_renderer_keys,asset_manifest,performance_budget) SELECT v.id,x.renderer_manifest,x.approved_renderer_keys,x.asset_manifest,x.performance_budget FROM theme_package_versions v CROSS JOIN jsonb_populate_record(NULL::theme_renderer_manifests,${json(body)}) x WHERE v.theme_package_id=${q(id)} AND v.version=${q(version)};`;
    const shadowId=randomUUID(),shadow=`UPDATE theme_packages SET slug=${q('synthetic393-shadow-'+shadowId)},legacy_theme_id=NULL WHERE id=${q(packageId)};INSERT INTO theme_packages(id,slug,name,description,author_name,site_types,status,pricing_type,price,currency,marketplace_metadata,legacy_theme_id) SELECT ${q(shadowId)},x.slug,x.name,x.description,x.author_name,x.site_types,x.status,x.pricing_type,x.price,x.currency,x.marketplace_metadata,${q(themeId)} FROM jsonb_populate_record(NULL::theme_packages,${json(oldPayload.themePackage)}) x;`;
    const oldTriple=insertVersion(shadowId,oldPayload.themePackageVersion)+insertSchema(shadowId,'2.0.0',oldPayload.schemaManifest)+insertRenderer(shadowId,'2.0.0',oldPayload.rendererManifest);
    refusal('missing-prior200',shadow,inputs.up,/393 immutable version conflict/);
    refusal('version-conflict',shadow+oldTriple+insertVersion(shadowId,{...record(newPayload.themePackageVersion),checksum:'0'.repeat(64)}),inputs.up,/393 immutable version conflict/);
    refusal('schema-conflict',shadow+oldTriple+insertVersion(shadowId,newPayload.themePackageVersion)+insertSchema(shadowId,'2.0.1',{...record(newPayload.schemaManifest),validation_rules:{...record(record(newPayload.schemaManifest).validation_rules),app_blocks_require_section_app_block_support:false}}),inputs.up,/393 immutable schema conflict/);
    refusal('renderer-conflict',shadow+oldTriple+insertVersion(shadowId,newPayload.themePackageVersion)+insertSchema(shadowId,'2.0.1',newPayload.schemaManifest)+insertRenderer(shadowId,'2.0.1',{...record(newPayload.rendererManifest),performance_budget:{maxRenderTimeMs:10000}}),inputs.up,/393 immutable renderer conflict/);
    refusal('ambiguous-package',`UPDATE theme_packages SET legacy_theme_id=NULL WHERE id=${q(packageId)};INSERT INTO theme_packages(slug,name,legacy_theme_id) VALUES(${q('synthetic393-alias-'+randomUUID())},'Synthetic alias',${q(themeId)});`,inputs.up,/393 ambiguous canonical package/);
    refusal('disabled-package',`UPDATE theme_packages SET status='disabled' WHERE id=${q(packageId)};`,inputs.up,/393 package unavailable/);
    refusal('revoked201-or-real-immutable-constraint',`UPDATE theme_package_versions SET release_status='revoked' WHERE id=${q(String(newChoice.versionId))};`,inputs.up,/393 immutable version conflict/);
    refusal('changed-catalog',`UPDATE themes SET name='Synthetic393 changed' WHERE id=${q(themeId)};`,inputs.down,/393 catalog changed after promotion/);
    refusal('corrupt-checkpoint',`UPDATE themes SET config=jsonb_set(config,'{playfield201Promotion393,previousSha256}',${json('0'.repeat(64))}) WHERE id=${q(themeId)};`,inputs.down,/393 stale or corrupted rollback checkpoint/);
    const before=fullState(),duplicateError=owned.psqlScriptExpectError(`BEGIN;${insertVersion(packageId,newPayload.themePackageVersion)}ROLLBACK;`);assert(constraintNames.some(n=>duplicateError.includes('"'+n+'"')),'actual named uniqueness/DB constraint denial');assert.equal(fullState(),before);refusalRecords.push({label:'duplicate-version',class:'EXISTING_CONSTRAINT_DENIAL_NOT393_GUARD',message:duplicateError.slice(0,500)});
    const faultBefore=fullState();owned.script(`CREATE FUNCTION public.synthetic_pf393_outbox_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.store_id=${q(faultSite.siteId)}::uuid AND NEW.event_type='theme.installed' THEN RAISE EXCEPTION 'SYNTHETIC393_LATE_OUTBOX';END IF;RETURN NEW;END $$;CREATE TRIGGER synthetic_pf393_outbox_fault BEFORE INSERT ON public.outbox_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_pf393_outbox_fault();`);
    try {const failed=await install(faultSite,newChoice);assert.equal(failed.status,503,failed.text);assert.doesNotMatch(failed.text,/SYNTHETIC393_LATE_OUTBOX|SQLSTATE|PL\/pgSQL/);assert.equal(fullState(),faultBefore);}finally{owned.script('DROP TRIGGER synthetic_pf393_outbox_fault ON public.outbox_events;DROP FUNCTION public.synthetic_pf393_outbox_fault();');}
    proof('refusals-and-atomicity',{refusals:refusalRecords,lateFaultZeroEffects:true,state:fullState()});
  });

  await stage('6 actual persisted201 Liquid retains23 templates/order facts and safe canonical toy rendering without app imports',async()=>{
    const row=assertCapture('2.0.1',inputs.artifact),persisted=LiquidThemePackageBundleSchema.parse(record(record(row.record).package_manifest).liquidBundle);
    assert.equal(canonical(persisted),canonical(inputs.bundle));assert.equal(Object.keys(persisted.templates).length,23);assert.equal(Object.keys(persisted.templates).filter(k=>!['header','footer'].includes(k)).length,21);
    assert.equal(persisted.layout.theme.source,inputs.oldBundle.layout.theme.source);assert.equal(persisted.sections['customer-order-detail'].source,inputs.oldBundle.sections['customer-order-detail'].source);
    const facts=ToyFactsSchema.parse({ageBands:['3-5'],materials:'Paper',contents:[{label:'Synthetic sheets',quantity:36}],contentsComplete:true,dimensions:{width:21,height:29.7,unit:'cm'}});assert(resolveToyFacts(facts,{}));
    const common={context:{storeId:newSite.siteId,subdomain:newSite.subdomain,path:'/product/synthetic',previewMode:false,locale:'en-IN'},storeTemplate:{themeId:slug,themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},liquidBundle:persisted};
    const start=performance.now(),product=await new LiquidRenderer().render({...common,liquidTemplateKey:'product',liquidContext:{shop:{name:'Synthetic393'},product:{id:randomUUID(),title:'Synthetic paper product',price:10000,available:true,options:[],toys:facts}}});assert.equal(product.status,'rendered');assert.match(product.liquid!.contentForLayout,/Synthetic sheets|Paper/);
    const attack='{{ 7 | times: 7 }}<script>synthetic393()</script><img src=x onerror="synthetic393()">',order=await new LiquidRenderer().render({...common,liquidTemplateKey:'customers/order',liquidContext:{buyer:{email:'synthetic393@example.invalid'},order:{number:'SYN393',status:'paid',currency:'INR',total:52000,line_items:[{title:'Synthetic saved item',quantity:1,line_price:52000,niche_facts_text:attack}],timeline:[]}}});
    assert.equal(order.status,'rendered');assert.match(order.liquid!.contentForLayout,/lb-order-facts__text/);assert.match(order.liquid!.contentForLayout,/\{\{ 7 \| times: 7 \}\}/);assert.match(order.liquid!.contentForLayout,/&lt;script&gt;/);assert.doesNotMatch(order.liquid!.contentForLayout,/<script\b|<img\b[^>]*\bonerror\s*=/i);assert.match(order.liquid!.headStyleText!,/white-space:pre-wrap/);assert(performance.now()-start<10000,'bounded native fixture render budget, not production performance');
    const publicRead=await gateway!.request(`/v1/storefront/${oldSite.subdomain}?projection=render-v1`);assert.equal(publicRead.status,200,publicRead.text);assert.doesNotMatch(publicRead.text,/Synthetic393 private B/);preservesRows(baselineCaptures,captureRows());proof('persisted-liquid',{versionId:row.versionId,templateCount:23,rootBundleSha256:sha(canonical(persisted)),renderedProductSha256:sha(product.liquid!.contentForLayout),renderedOrderSha256:sha(order.liquid!.contentForLayout),browserAcceptance:false});
  });

  await stage('7 strict DOWN/replay restores prior catalog; fresh API must select200 despite retained201 captures',async()=>{
    const merchants=digest(merchantTables),captured=captureRows();migrate(inputs.down,'2.0.0');assert.equal(canonical(managed(catalogRow())),canonical(managed(priorCatalog)));assert.equal(digest(merchantTables),merchants);assert.equal(canonical(captureRows()),canonical(captured));
    const downState=fullState();owned.scriptLarge(inputs.down);assert.equal(fullState(),downState,'DOWN replay no-op');
    const schema=await request(downSite,base+'/schema');assert.equal(schema.status,200,schema.text);const advertised=record(data(schema).theme);assert.equal(catalogRow().version,'2.0.0');assert.equal(advertised.theme_package_version_id,oldChoice.versionId,'retained201 capture must not win actual fresh schema API selection');
    const liveBefore=owned.psql(`SELECT to_jsonb(s)::text FROM sites s WHERE id=${q(downSite.siteId)};`),added=await install(downSite,oldChoice);assert.equal(added.status,201,added.text);assert.equal(data(added).installed_version,'2.0.0');assert.equal(data(added).theme_package_version_id,oldChoice.versionId);assert.equal(owned.psql(`SELECT to_jsonb(s)::text FROM sites s WHERE id=${q(downSite.siteId)};`),liveBefore);stats('postDOWN-fresh200-install',true);
    const loaded=await load(downSite);assert.equal(LiquidThemePackageBundleSchema.parse(record(loaded.template_config).liquidBundle).package.version,'2.0.0');const unchanged=fullState();assert.equal((await install(downSite,newChoice)).status,409);assert.equal(fullState(),unchanged);
    assert.equal(selected('2.0.1').versionId,newChoice.versionId);assert.equal(privateDrafts(oldSite),protectedDraft);assert.equal(LiquidThemePackageBundleSchema.parse(record(release(oldSite).template_snapshot).liquidBundle).package.version,'2.0.1');
    assert.equal(owned.psql(`SELECT theme_package_version_id::text FROM theme_instances WHERE store_id=${q(newSite.siteId)} AND theme_slug=${q(slug)} AND deleted_at IS NULL;`),newChoice.versionId);proof('down-and-fresh-api-selection',{advertised,installedVersion:data(added).installed_version,selectedVersionId:data(added).theme_package_version_id,retained201VersionId:newChoice.versionId,privateDraft:protectedDraft});
  });

  await stage('8 final UP/replay conserves prior/new histories and exact391392 profiles; source pins remain bound',()=>{
    migrate(inputs.up,'2.0.1');assertCapture('2.0.0',inputs.previous);assertCapture('2.0.1',inputs.artifact);preservesRows(baselineCaptures,captureRows());assert.equal(privateDrafts(oldSite),protectedDraft);
    assert.equal(owned.psql(`SELECT theme_package_version_id::text FROM theme_instances WHERE store_id=${q(downSite.siteId)} AND theme_slug=${q(slug)} AND deleted_at IS NULL;`),oldChoice.versionId);
    const state=fullState();owned.scriptLarge(inputs.up);assert.equal(fullState(),state);admittedInputs();
    proof('final-restoration',{profiles:entryProfiles,allCurrentProfilesExact:true,captureRows:captureRows(),merchantDigest:digest(merchantTables),fullState:state,versionIds:{old:oldChoice.versionId,next:newChoice.versionId},refusalRecords,sourcePinsRechecked:true,sourceMigrationMaximum:392,candidateMigration:393});
  });
  console.info('PLAYFIELD393_OWNED_QUALIFICATION',JSON.stringify({runId:owned.runId,evidenceDirectory,manifestSha256:manifestSha,phases:8,scope:'native SQL/real mounted API/persisted Liquid only; browser and post-cart runtime gates separate'}));
});
