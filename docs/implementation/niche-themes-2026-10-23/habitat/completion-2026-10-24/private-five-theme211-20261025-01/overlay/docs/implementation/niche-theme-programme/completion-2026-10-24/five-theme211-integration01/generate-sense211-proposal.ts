// Offline ONE Sense-package distribution proposal. Never connects to a database,
// emits a numbered migration, modifies a previous capture or starts a runtime.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFirstPartyCatalogBundle,firstPartyThemeListings} from '../../../../../packages/theme-engine/src/first-party-theme-catalog';
import {buildLiquidThemePackagePersistencePayload} from '../../../../../packages/theme-engine/src/theme-bundle';
import {canonicalJson,sourceHashes,sha256} from '../../release-v2/generate-release';

const directory=dirname(fileURLToPath(import.meta.url));
const previousDirectory=resolve(directory,'../child-customization-integration01');
const previousProposal=JSON.parse(readFileSync(resolve(previousDirectory,'DISTRIBUTION_PROPOSAL.json'),'utf8')) as {
 payloadSha256:string;artifacts:Array<{slug:string;version:string;bundleSha256:string}>;
};
assert.equal(previousProposal.payloadSha256,'cf10d8f413585425416d7555a2c786fe6b41d9e43b7add32f02043cf69d466bb');
const sourceBefore=sourceHashes();
const slugs=['letbuyy-sense'];
const artifacts=firstPartyThemeListings({designVersion:'2.0.0'}).filter(row=>slugs.includes(row.slug)).map(listing=>{
 const previous=createFirstPartyCatalogBundle(listing.slug,{customizationVersion:'2.1.0'});
 const bundle=createFirstPartyCatalogBundle(listing.slug,{customizationVersion:'2.1.1'});
 assert.equal(sha256(canonicalJson(previous)),previousProposal.artifacts.find(row=>row.slug===listing.slug&&row.version==='2.1.0')?.bundleSha256,'Previous capture must be the exact qualified210');
 const document=(input:typeof bundle)=>({themeId:listing.slug,experienceId:listing.presetId,rendererEngine:'liquid',liquidRenderingCanary:true,themeSettings:input.config.settings_data.current,liquidBundle:input,templates:input.templates,sections:{}});
 return {id:listing.id,slug:listing.slug,name:listing.name,category:listing.category,version:'2.1.1',previousVersion:'2.1.0',
  previousDocument:document(previous),previousPersistence:buildLiquidThemePackagePersistencePayload(previous),
  document:document(bundle),persistence:buildLiquidThemePackagePersistencePayload(bundle)};
});
assert.deepEqual(artifacts.map(row=>row.slug).sort(),slugs);
const payload=canonicalJson(artifacts),payloadSha256=sha256(payload),delimiter='$sense211$';assert.ok(!payload.includes(delimiter));
const checkpoint='firstPartySense211';
const columns=['name','category','version','default_template','section_schemas','block_schemas','settings_schema','renderer_manifest','schema_version','renderer_version','config'];
const snapshot=`jsonb_build_object(${columns.flatMap(key=>["'"+key+"'",'t.'+key]).join(',')})`;
// Every deterministic field restored by DOWN has one immutable210 binding.
// Config remains the exact valid pre-promotion object, compared with the
// current outer config; it is never rebuilt from a package default.
const priorFieldPaths = {
 name:['name'], category:['category'], version:['previousVersion'],
 default_template:['previousDocument'],
 section_schemas:['previousPersistence','schemaManifest','section_schemas'],
 block_schemas:['previousPersistence','schemaManifest','block_schemas'],
 settings_schema:['previousPersistence','schemaManifest','settings_schema'],
 renderer_manifest:['previousDocument','liquidBundle','renderer'],
 schema_version:['previousPersistence','themePackageVersion','schema_version'],
 renderer_version:['previousPersistence','themePackageVersion','renderer_version'],
} as const;
assert.deepEqual(Object.keys(priorFieldPaths).sort(),columns.filter(key=>key!=='config').sort(),'DOWN fields must all be bound');
const priorFieldGuards=Object.entries(priorFieldPaths).map(([field,path])=>`prior->'${field}' IS DISTINCT FROM item#>'{${path.join(',')}}'`).join('\n OR ');
const priorKeyArray=`ARRAY[${[...columns].sort().map(key=>"'"+key+"'").join(',')}]::text[]`;

const captureColumns="ARRAY['id','theme_package_id','published_at','created_by','created_at','updated_at','deleted_at']";
function captureChecks(prefix:string,variable:string){return `
 body:=item#>'{${prefix},themePackageVersion}';
 SELECT * INTO STRICT ${variable} FROM public.theme_package_versions WHERE theme_package_id=p.id AND version=body->>'version' FOR UPDATE;
 IF ${variable}.deleted_at IS NOT NULL OR (to_jsonb(${variable})-${captureColumns}) IS DISTINCT FROM (body||jsonb_build_object('checksum',body->'checksum')) THEN RAISE EXCEPTION 'Immutable sense211 ${prefix} version conflict'; END IF;
 body:=item#>'{${prefix},schemaManifest}';
 SELECT * INTO STRICT s FROM public.theme_schema_manifests WHERE theme_package_version_id=${variable}.id FOR UPDATE;
 IF (to_jsonb(s)-ARRAY['id','theme_package_version_id','created_at','updated_at']) IS DISTINCT FROM body THEN RAISE EXCEPTION 'Immutable sense211 ${prefix} schema conflict'; END IF;
 body:=item#>'{${prefix},rendererManifest}';
 SELECT * INTO STRICT r FROM public.theme_renderer_manifests WHERE theme_package_version_id=${variable}.id FOR UPDATE;
 IF (to_jsonb(r)-ARRAY['id','theme_package_version_id','created_at','updated_at']) IS DISTINCT FROM body THEN RAISE EXCEPTION 'Immutable sense211 ${prefix} renderer conflict'; END IF;`;}
function catalogMatches(document:string,persistence:string,version:string){return `(
 t.version='${version}' AND t.name IS NOT DISTINCT FROM item->>'name' AND t.category IS NOT DISTINCT FROM item->>'category'
 AND t.default_template IS NOT DISTINCT FROM item->'${document}'
 AND t.section_schemas IS NOT DISTINCT FROM item#>'{${persistence},schemaManifest,section_schemas}'
 AND t.block_schemas IS NOT DISTINCT FROM item#>'{${persistence},schemaManifest,block_schemas}'
 AND t.settings_schema IS NOT DISTINCT FROM item#>'{${persistence},schemaManifest,settings_schema}'
 AND t.renderer_manifest IS NOT DISTINCT FROM item#>'{${document},liquidBundle,renderer}'
 AND t.schema_version IS NOT DISTINCT FROM item#>>'{${persistence},themePackageVersion,schema_version}'
 AND t.renderer_version IS NOT DISTINCT FROM item#>>'{${persistence},themePackageVersion,renderer_version}')`;}
const priorMatches=catalogMatches('previousDocument','previousPersistence','2.1.0');
const currentMatches=catalogMatches('document','persistence','2.1.1');
const identity=`
 SELECT * INTO STRICT t FROM public.themes WHERE id=(item->>'id')::uuid AND slug=item->>'slug' AND owned_by_site_id IS NULL AND NOT is_site_private FOR UPDATE;
 IF t.is_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'Sense211 inactive catalog conflict'; END IF;
 IF (SELECT count(*) FROM public.theme_packages WHERE slug=t.slug OR legacy_theme_id=t.id)<>1 THEN RAISE EXCEPTION 'Sense211 package identity conflict'; END IF;
 SELECT * INTO STRICT p FROM public.theme_packages WHERE (slug=t.slug OR legacy_theme_id=t.id) AND deleted_at IS NULL AND status='active' FOR UPDATE;
 IF p.slug<>t.slug OR p.legacy_theme_id IS DISTINCT FROM t.id THEN RAISE EXCEPTION 'Sense211 canonical package identity conflict'; END IF;`;
const checkpointGuard=`
 prior:=t.config#>'{${checkpoint},previous}';
 IF jsonb_typeof(t.config) IS DISTINCT FROM 'object' OR jsonb_typeof(t.config->'${checkpoint}') IS DISTINCT FROM 'object'
 OR jsonb_typeof(prior) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Sense211 checkpoint or replay conflict'; END IF;
 IF ARRAY(SELECT key FROM jsonb_object_keys(prior) AS k(key) ORDER BY key) IS DISTINCT FROM ${priorKeyArray}
 OR ARRAY(SELECT key FROM jsonb_object_keys(t.config->'${checkpoint}') AS k(key) ORDER BY key) IS DISTINCT FROM ARRAY['payloadSha256','previous']::text[]
 OR t.config#>>'{${checkpoint},payloadSha256}' IS DISTINCT FROM '${payloadSha256}'
 OR ${priorFieldGuards}
 OR jsonb_typeof(prior->'config') IS DISTINCT FROM 'object' OR (prior->'config') ? '${checkpoint}'
 OR prior#>>'{config,firstPartyCustomization210,payloadSha256}' IS DISTINCT FROM '${previousProposal.payloadSha256}'
 OR (t.config-'${checkpoint}') IS DISTINCT FROM prior->'config'
 THEN RAISE EXCEPTION 'Sense211 checkpoint or replay conflict'; END IF;`;

const declarations=`item jsonb; t public.themes; p public.theme_packages; v public.theme_package_versions; old_version public.theme_package_versions; s public.theme_schema_manifests; r public.theme_renderer_manifests; body jsonb; prior jsonb; restored public.themes;`;
const up=`-- UNNUMBERED PRIVATE PROPOSAL: one explicit Sense2.1.1 package only. No installed work or prior captures are rewritten.
BEGIN;
DO $promotion$
DECLARE ${declarations}
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements(${delimiter}${payload}${delimiter}::jsonb) LOOP
 ${identity}
 IF t.version IS DISTINCT FROM '2.1.0' AND t.version IS DISTINCT FROM '2.1.1' THEN RAISE EXCEPTION 'Sense211 stale prior catalog version'; END IF;
 ${captureChecks('previousPersistence','old_version')}
 IF t.version='2.1.0' THEN
  IF (${priorMatches}) IS NOT TRUE OR t.config ? '${checkpoint}' OR t.config#>>'{firstPartyCustomization210,payloadSha256}' IS DISTINCT FROM '${previousProposal.payloadSha256}' THEN RAISE EXCEPTION 'Sense211 prior catalog differs from exact captured210'; END IF;
 END IF;
 body:=item#>'{persistence,themePackageVersion}';
 INSERT INTO public.theme_package_versions(theme_package_id,version,version_number,release_status,renderer_version,schema_version,compatibility_range,package_manifest,checksum,published_at)
 SELECT p.id,x.version,x.version_number,x.release_status,x.renderer_version,x.schema_version,x.compatibility_range,x.package_manifest,x.checksum,now()
 FROM jsonb_populate_record(NULL::public.theme_package_versions,body) x ON CONFLICT(theme_package_id,version) DO NOTHING;
 SELECT * INTO STRICT v FROM public.theme_package_versions WHERE theme_package_id=p.id AND version='2.1.1' FOR UPDATE;
 body:=item#>'{persistence,schemaManifest}';
 INSERT INTO public.theme_schema_manifests(theme_package_version_id,manifest_version,schema_manifest,section_schemas,block_schemas,settings_schema,template_schema,layout_schema,validation_rules)
 SELECT v.id,x.manifest_version,x.schema_manifest,x.section_schemas,x.block_schemas,x.settings_schema,x.template_schema,x.layout_schema,x.validation_rules FROM jsonb_populate_record(NULL::public.theme_schema_manifests,body) x ON CONFLICT(theme_package_version_id) DO NOTHING;
 body:=item#>'{persistence,rendererManifest}';
 INSERT INTO public.theme_renderer_manifests(theme_package_version_id,renderer_manifest,approved_renderer_keys,asset_manifest,performance_budget)
 SELECT v.id,x.renderer_manifest,x.approved_renderer_keys,x.asset_manifest,x.performance_budget FROM jsonb_populate_record(NULL::public.theme_renderer_manifests,body) x ON CONFLICT(theme_package_version_id) DO NOTHING;
 ${captureChecks('persistence','v')}
 IF t.version='2.1.1' THEN
  IF (${currentMatches}) IS NOT TRUE THEN RAISE EXCEPTION 'Sense211 catalog replay conflict'; END IF;
  ${checkpointGuard}
  CONTINUE;
 END IF;
 prior:=${snapshot};
 UPDATE public.themes SET name=item->>'name',category=item->>'category',version='2.1.1',default_template=item->'document',
 section_schemas=item#>'{persistence,schemaManifest,section_schemas}',block_schemas=item#>'{persistence,schemaManifest,block_schemas}',settings_schema=item#>'{persistence,schemaManifest,settings_schema}',renderer_manifest=item#>'{document,liquidBundle,renderer}',schema_version=v.schema_version,renderer_version=v.renderer_version,
 config=t.config||jsonb_build_object('${checkpoint}',jsonb_build_object('payloadSha256','${payloadSha256}','previous',prior)),updated_at=now() WHERE id=t.id;
 END LOOP;
END;
$promotion$;
COMMIT;
`;
const down=`-- Paired private DOWN restores exact prior210 metadata, retaining211 captures and every installed draft/release/order/history row.
BEGIN;
DO $rollback$
DECLARE ${declarations}
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements(${delimiter}${payload}${delimiter}::jsonb) LOOP
 ${identity}
 ${captureChecks('previousPersistence','old_version')}
 IF NOT (t.config ? '${checkpoint}') THEN
  IF (${priorMatches}) IS NOT TRUE OR t.config#>>'{firstPartyCustomization210,payloadSha256}' IS DISTINCT FROM '${previousProposal.payloadSha256}' THEN RAISE EXCEPTION 'Sense211 rollback missing checkpoint or conflicting prior'; END IF;
  CONTINUE;
 END IF;
 IF (${currentMatches}) IS NOT TRUE THEN RAISE EXCEPTION 'Sense211 stale rollback conflict'; END IF;
 ${captureChecks('persistence','v')}
 ${checkpointGuard}
 restored:=jsonb_populate_record(NULL::public.themes,prior);
 UPDATE public.themes SET ${columns.map(key=>key+'=restored.'+key).join(',')},updated_at=now() WHERE id=t.id;
 END LOOP;
END;
$rollback$;
COMMIT;
`;
assert.deepEqual(sourceHashes(),sourceBefore,'All source inputs unchanged during offline generation');
const outputs={'UNNUMBERED_sense211.up.proposal.sql':up,'UNNUMBERED_sense211.down.proposal.sql':down};
for(const [name,bytes] of Object.entries(outputs))writeFileSync(resolve(directory,name),bytes,{flag:'wx'});
writeFileSync(resolve(directory,'SENSE211_DISTRIBUTION_PROPOSAL.json'),JSON.stringify({recordedAt:new Date().toISOString(),status:'PRIVATE_SOURCE_PREPARED_NOT_NATIVE_ADMITTED',version:'2.1.1',versionNumber:6,affectedSlugs:slugs,previousVersion:'2.1.0',previousPromotionPayloadSha256:previousProposal.payloadSha256,payloadSha256,sourceHashes:sourceBefore,artifacts:artifacts.map(row=>({id:row.id,slug:row.slug,version:row.version,prior:row.previousVersion,bundleSha256:sha256(canonicalJson(row.document.liquidBundle)),previousBundleSha256:sha256(canonicalJson(row.previousDocument.liquidBundle))})),files:Object.entries(outputs).map(([path,bytes])=>({path,sha256:sha256(bytes),bytes:Buffer.byteLength(bytes)})),generatorSha256:sha256(readFileSync(fileURLToPath(import.meta.url))),nativeExecuted:false,canonicalMigrationsEmitted:false,mainOrRuntimeMutated:false},null,2)+'\n',{flag:'wx'});
console.info(JSON.stringify({artifacts:artifacts.length,payloadBytes:Buffer.byteLength(payload),nativeExecuted:false,canonicalMigrationsEmitted:false}));

const headingPath=resolve(directory,'../order-heading211-integration01/DISTRIBUTION_PROPOSAL.json');
const headingBytes=readFileSync(headingPath),heading=JSON.parse(headingBytes.toString('utf8'));
assert.equal(sha256(headingBytes),'54856b0d11e824ba97c058290041fa776f14435dc0183859ca90ab899c57a32d');
assert.equal(heading.payloadSha256,'da476dc47ce16d55cd3a7ee05170e9618860febd844c7fcb83aaf349d00806b9');
writeFileSync(resolve(directory,'FIVE211_JOINT_MANIFEST.json'),JSON.stringify({status:'PRIVATE_SOURCE_PROPOSAL_ONLY_NOT_NATIVE_OR_INTEGRATED',order:['qualified393/full322','existing qualified201 captures','qualified child210 capture','immutable four-heading211 payload','new Sense-only211 payload'],heading:{path:'../order-heading211-integration01/DISTRIBUTION_PROPOSAL.json',sha256:sha256(headingBytes),payloadSha256:heading.payloadSha256,artifacts:heading.artifacts,files:heading.files},sense:{path:'SENSE211_DISTRIBUTION_PROPOSAL.json',payloadSha256,files:Object.entries(outputs).map(([path,bytes])=>({path,sha256:sha256(bytes)})),artifacts:artifacts.map(row=>({id:row.id,slug:row.slug,bundleSha256:sha256(canonicalJson(row.document.liquidBundle)),previousBundleSha256:sha256(canonicalJson(row.previousDocument.liquidBundle))}))},sourceHashes:sourceBefore,sourceInputs:Object.fromEntries(['packages/theme-engine/src/first-party-theme-catalog.ts','packages/theme-engine/src/niche-order-presentation.ts','packages/theme-engine/src/theme-bundle.ts','packages/theme-engine/test/first-party-five-theme-v211.test.ts','docs/implementation/niche-theme-programme/completion-2026-10-24/five-theme211-integration01/generate-sense211-proposal.ts'].map(path=>[path,sha256(readFileSync(resolve(directory,'../../../../../',path)))])),nativeExecuted:false,MainApplied:false},null,2)+'\n',{flag:'wx'});
