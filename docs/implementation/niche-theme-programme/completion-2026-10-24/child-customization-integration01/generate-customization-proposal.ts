// Offline distribution adapter. No DB connection or canonical migration emission.
// Reuses the existing first-party catalog and its four canonical capture tables.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../../../../../packages/theme-engine/src/first-party-theme-catalog';
import { buildLiquidThemePackagePersistencePayload, LiquidThemePackageBundleSchema } from '../../../../../packages/theme-engine/src/theme-bundle';
import { canonicalJson, sourceHashes } from '../../release-v2/generate-release';

const directory=resolve('docs/implementation/niche-theme-programme/completion-2026-10-24/child-customization-integration01');
const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const before=sourceHashes();
const artifacts=firstPartyThemeListings({designVersion:'2.0.0'}).map(listing=>{
    const bundle=createFirstPartyCatalogBundle(listing.slug,{customizationVersion:'2.1.0'});
    const document={themeId:listing.slug,experienceId:listing.presetId,rendererEngine:'liquid',liquidRenderingCanary:true,
        themeSettings:bundle.config.settings_data.current,liquidBundle:bundle,templates:bundle.templates,sections:{}};
    const prior = listing.slug === 'letbuyy-sense' ? LiquidThemePackageBundleSchema.parse(JSON.parse(readFileSync('database/supabase/migrations/382_threadline_catalog_v2.sql', 'utf8').match(/\$liquidbundle\$([\s\S]*?)\$liquidbundle\$::jsonb/)![1]).document.liquidBundle) : undefined;
    return {previousBundle: prior, previousPersistence: prior ? buildLiquidThemePackagePersistencePayload(prior) : undefined, id:listing.id,slug:listing.slug,name:listing.name,category:listing.category,version:'2.1.0',
        previousVersion:listing.slug==='letbuyy-bloom'?'2.0.1':'2.0.0',document,
        persistence:buildLiquidThemePackagePersistencePayload(bundle)};
});
const payload=canonicalJson(artifacts), delimiter='$customization210$';assert(!payload.includes(delimiter));
const columns=['name','category','version','default_template','section_schemas','block_schemas','settings_schema','renderer_manifest','schema_version','renderer_version','config'];
const snapshot=`jsonb_build_object(${columns.flatMap(key=>["'"+key+"'",'t.'+key]).join(',')})`;
const checkpoint='firstPartyCustomization210';
const up=`-- UNNUMBERED PROPOSAL. Explicit2.1.0 revision; no installed draft/release rewrite.
BEGIN;
DO $promotion$
DECLARE item jsonb; t public.themes; p public.theme_packages; v public.theme_package_versions;
 s public.theme_schema_manifests; r public.theme_renderer_manifests; body jsonb; prior jsonb; old_version public.theme_package_versions; captured jsonb;
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements(${delimiter}${payload}${delimiter}::jsonb) LOOP
  SELECT * INTO STRICT t FROM public.themes WHERE id=(item->>'id')::uuid AND slug=item->>'slug' AND owned_by_site_id IS NULL AND NOT is_site_private FOR UPDATE;
  IF t.version NOT IN (item->>'previousVersion',item->>'version') OR t.is_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'Customization prior catalog conflict: %',t.slug; END IF;
  IF (SELECT count(*) FROM public.theme_packages WHERE slug=t.slug OR legacy_theme_id=t.id)>1 THEN RAISE EXCEPTION 'Customization package identity conflict'; END IF;
  body:=item#>'{persistence,themePackage}';
  INSERT INTO public.theme_packages(slug,name,description,author_name,site_types,status,pricing_type,price,currency,marketplace_metadata,legacy_theme_id)
   SELECT x.slug,x.name,x.description,x.author_name,x.site_types,x.status,x.pricing_type,x.price,x.currency,x.marketplace_metadata,t.id FROM jsonb_populate_record(NULL::public.theme_packages,body) x
   WHERE t.slug='letbuyy-sense' AND t.default_template->'liquidBundle'=item->'previousBundle' AND NOT EXISTS(SELECT 1 FROM public.theme_packages WHERE slug=t.slug OR legacy_theme_id=t.id) ON CONFLICT(slug) DO NOTHING;
  SELECT * INTO STRICT p FROM public.theme_packages WHERE (slug=t.slug OR legacy_theme_id=t.id) AND deleted_at IS NULL AND status='active' FOR UPDATE;
  IF p.slug<>t.slug OR (p.legacy_theme_id IS NOT NULL AND p.legacy_theme_id<>t.id) THEN RAISE EXCEPTION 'Customization canonical package identity conflict'; END IF;
  FOR captured IN SELECT value FROM jsonb_array_elements(CASE WHEN item ? 'previousPersistence' THEN jsonb_build_array(item->'previousPersistence',item->'persistence') ELSE jsonb_build_array(item->'persistence') END) LOOP
  body:=captured->'themePackageVersion';
  INSERT INTO public.theme_package_versions(theme_package_id,version,version_number,release_status,renderer_version,schema_version,compatibility_range,package_manifest,checksum,published_at)
   SELECT p.id,x.version,x.version_number,x.release_status,x.renderer_version,x.schema_version,x.compatibility_range,x.package_manifest,x.checksum,now()
   FROM jsonb_populate_record(NULL::public.theme_package_versions,body) x ON CONFLICT(theme_package_id,version) DO NOTHING;
  SELECT * INTO STRICT v FROM public.theme_package_versions WHERE theme_package_id=p.id AND version=body->>'version' FOR UPDATE;
  IF v.deleted_at IS NOT NULL OR (to_jsonb(v)-ARRAY['id','theme_package_id','published_at','created_by','created_at','updated_at','deleted_at']) IS DISTINCT FROM (body||jsonb_build_object('checksum',body->'checksum')) THEN RAISE EXCEPTION 'Immutable customization version conflict'; END IF;
  body:=captured->'schemaManifest';
  INSERT INTO public.theme_schema_manifests(theme_package_version_id,manifest_version,schema_manifest,section_schemas,block_schemas,settings_schema,template_schema,layout_schema,validation_rules)
   SELECT v.id,x.manifest_version,x.schema_manifest,x.section_schemas,x.block_schemas,x.settings_schema,x.template_schema,x.layout_schema,x.validation_rules
   FROM jsonb_populate_record(NULL::public.theme_schema_manifests,body) x ON CONFLICT(theme_package_version_id) DO NOTHING;
  SELECT * INTO STRICT s FROM public.theme_schema_manifests WHERE theme_package_version_id=v.id FOR UPDATE;
  IF (to_jsonb(s)-ARRAY['id','theme_package_version_id','created_at','updated_at']) IS DISTINCT FROM body THEN RAISE EXCEPTION 'Immutable customization schema conflict'; END IF;
  body:=captured->'rendererManifest';
  INSERT INTO public.theme_renderer_manifests(theme_package_version_id,renderer_manifest,approved_renderer_keys,asset_manifest,performance_budget)
   SELECT v.id,x.renderer_manifest,x.approved_renderer_keys,x.asset_manifest,x.performance_budget FROM jsonb_populate_record(NULL::public.theme_renderer_manifests,body) x ON CONFLICT(theme_package_version_id) DO NOTHING;
  SELECT * INTO STRICT r FROM public.theme_renderer_manifests WHERE theme_package_version_id=v.id FOR UPDATE;
  IF (to_jsonb(r)-ARRAY['id','theme_package_version_id','created_at','updated_at']) IS DISTINCT FROM body THEN RAISE EXCEPTION 'Immutable customization renderer conflict'; END IF;
  END LOOP;
  IF t.version=item->>'previousVersion' THEN
   SELECT * INTO STRICT old_version FROM public.theme_package_versions WHERE theme_package_id=p.id AND version=t.version AND deleted_at IS NULL AND release_status='published';
   IF t.default_template->'liquidBundle' IS DISTINCT FROM old_version.package_manifest->'liquidBundle' THEN RAISE EXCEPTION 'Prior catalog differs from its immutable capture'; END IF;
  END IF;
  IF t.version=item->>'version' THEN
   IF t.default_template IS DISTINCT FROM item->'document' OR t.section_schemas IS DISTINCT FROM item#>'{persistence,schemaManifest,section_schemas}' OR t.block_schemas IS DISTINCT FROM item#>'{persistence,schemaManifest,block_schemas}' OR t.settings_schema IS DISTINCT FROM item#>'{persistence,schemaManifest,settings_schema}' OR t.renderer_manifest IS DISTINCT FROM item#>'{document,liquidBundle,renderer}' OR t.name IS DISTINCT FROM item->>'name' OR t.category IS DISTINCT FROM item->>'category' OR t.schema_version IS DISTINCT FROM v.schema_version OR t.renderer_version IS DISTINCT FROM v.renderer_version OR t.config#>>'{${checkpoint},payloadSha256}' IS DISTINCT FROM '${sha(payload)}' THEN RAISE EXCEPTION 'Customization replay conflict'; END IF;
   CONTINUE;
  END IF;
  IF t.config ? '${checkpoint}' AND t.config#>>'{${checkpoint},payloadSha256}' IS DISTINCT FROM '${sha(payload)}' THEN RAISE EXCEPTION 'Customization checkpoint conflict'; END IF;
  prior:=coalesce(t.config#>'{${checkpoint},previous}',${snapshot});
  UPDATE public.themes SET name=item->>'name',category=item->>'category',version=item->>'version',default_template=item->'document',
   section_schemas=item#>'{persistence,schemaManifest,section_schemas}',block_schemas=item#>'{persistence,schemaManifest,block_schemas}',settings_schema=item#>'{persistence,schemaManifest,settings_schema}',renderer_manifest=item#>'{document,liquidBundle,renderer}',schema_version=v.schema_version,renderer_version=v.renderer_version,
   config=coalesce(t.config,'{}')||jsonb_build_object('${checkpoint}',jsonb_build_object('payloadSha256','${sha(payload)}','previous',prior)),updated_at=now() WHERE id=t.id;
 END LOOP;
END;
$promotion$;
COMMIT;
`;
const identities=canonicalJson(artifacts.map(({id,slug})=>({id,slug})));
const down=`-- Paired DOWN restores prior catalog metadata, retaining immutable captures and installed work.
BEGIN;
DO $rollback$
DECLARE item jsonb; t public.themes; prior public.themes; saved jsonb;
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements(${delimiter}${identities}${delimiter}::jsonb) LOOP
  SELECT * INTO STRICT t FROM public.themes WHERE id=(item->>'id')::uuid AND slug=item->>'slug' AND owned_by_site_id IS NULL AND NOT is_site_private FOR UPDATE;
  saved:=t.config#>'{${checkpoint},previous}'; IF saved IS NULL THEN CONTINUE; END IF;
  IF t.version<>'2.1.0' OR t.config#>>'{${checkpoint},payloadSha256}' IS DISTINCT FROM '${sha(payload)}' THEN RAISE EXCEPTION 'Customization stale rollback conflict'; END IF;
  prior:=jsonb_populate_record(NULL::public.themes,saved);
  UPDATE public.themes SET ${columns.map(key=>key+'=prior.'+key).join(',')},updated_at=now() WHERE id=t.id;
 END LOOP;
END;
$rollback$;
COMMIT;
`;
assert.deepEqual(sourceHashes(),before);
const outputs={'customization210.up.proposal.sql':up,'customization210.down.proposal.sql':down};
for(const [name,bytes]of Object.entries(outputs))writeFileSync(resolve(directory,name),bytes,{flag:'wx'});
writeFileSync(resolve(directory,'DISTRIBUTION_PROPOSAL.json'),JSON.stringify({status:'UNNUMBERED_SOURCE_QUALIFIED_NATIVE_PENDING',version:'2.1.0',sourceHashes:before,payloadSha256:sha(payload),artifacts:artifacts.map(a=>({slug:a.slug,version:a.version,prior:a.previousVersion,bundleSha256:sha(canonicalJson(a.document.liquidBundle))})),files:Object.entries(outputs).map(([name,bytes])=>({path:name,sha256:sha(bytes),bytes:Buffer.byteLength(bytes)})),generatorSha256:sha(readFileSync(resolve(directory,'generate-customization-proposal.ts'))),canonicalMigrationsEmitted:false},null,2)+'\n',{flag:'wx'});
console.info(JSON.stringify({artifacts:artifacts.length,payloadBytes:Buffer.byteLength(payload),nativeExecuted:false}));
