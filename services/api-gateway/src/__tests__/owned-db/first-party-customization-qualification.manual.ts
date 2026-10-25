// Explicit-only native qualification; never discovers or emits a migration.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { LiquidThemePackageBundleSchema, qualifiedFirstPartyInlineChildParents } from '@letbuyy/theme-engine';
import { requireOwnedDatabase } from './owned-db-support';
const owned=requireOwnedDatabase();
const directory='docs/implementation/niche-theme-programme/completion-2026-10-24/child-customization-integration01/';
const read=(path:string)=>readFileSync(resolve(path),'utf8'),hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const admission=z.object({status:z.literal('ROOT_ONE_FRESH_CUSTOMIZATION_NATIVE_QUALIFICATION'),sourceFiles:z.array(z.object({path:z.string(),sha256:z.string()})).min(100),proposalUpSha256:z.string(),proposalDownSha256:z.string()}).parse(JSON.parse(read(directory+'NATIVE_ADMISSION.json')));
for(const file of admission.sourceFiles)assert.equal(hash(read(file.path)),file.sha256,file.path);
const up=read(directory+'customization210.up.proposal.sql'),down=read(directory+'customization210.down.proposal.sql');
assert.equal(hash(up),admission.proposalUpSha256);assert.equal(hash(down),admission.proposalDownSha256);
const oldUp=read('docs/implementation/niche-theme-programme/release-playfield201/proposals394/f5f54a8009732ff71ba248e1f3356f58441e8b2340225c47b19e5ac386ac790e/394_playfield_catalog_201.up.draft.sql');
assert.equal(hash(oldUp),'7d3c4991c84c128cfba8aff096c04a0288d9142a144c97dddac8d0072633aa1e');
const evidence=mkdtempSync(join(tmpdir(),'letbuyy-customization-qualification-'+owned.runId+'-'));
const q=(value:string)=>"'"+value.replaceAll("'","''")+"'",ident=(value:string)=>'"'+value.replaceAll('"','""')+'"';
function proof(name:string,value:unknown){const bytes=JSON.stringify({runId:owned.runId,name,value},null,2)+'\n',path=join(evidence,name+'.json');writeFileSync(path,bytes,{mode:0o600,flag:'wx'});console.info('CUSTOMIZATION_QUALIFICATION_PROVENANCE',JSON.stringify({path,sha256:hash(bytes)}));}
function tables(){
 const names=z.array(z.string()).parse(JSON.parse(owned.psql("SELECT jsonb_agg(c.relname ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p');")));
 const raw=owned.scriptLarge('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL jit=off;'+names.map(name=>`SELECT jsonb_build_object('table',${q(name)},'count',count(*),'hash',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]')::text,'UTF8')),'hex')) FROM public.${ident(name)} x;`).join('\n')+'COMMIT;');
 const rows=raw.split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>z.object({table:z.string(),count:z.number(),hash:z.string()}).parse(JSON.parse(line)));assert.deepEqual(rows.map(row=>row.table),names);return rows;
}
const captureNames=['theme_packages','theme_package_versions','theme_schema_manifests','theme_renderer_manifests'];
const snapshot=(table:string,predicate='true')=>owned.scriptLarge(`SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.${ident(table)} x WHERE ${predicate};`);
const targets="slug LIKE 'letbuyy-%' AND id::text LIKE '7b669c70-%'";
const managed=['name','category','version','default_template','section_schemas','block_schemas','settings_schema','renderer_manifest','schema_version','renderer_version','config','updated_at'];
const immutableThemeColumns=()=>owned.scriptLarge(`SELECT jsonb_agg(to_jsonb(t)-ARRAY[${managed.map(q).join(',')}] ORDER BY id) FROM themes t;`);
const catalogManaged=()=>owned.scriptLarge(`SELECT jsonb_agg(to_jsonb(t)-'updated_at' ORDER BY id) FROM themes t;`);

test('all10 exact customization captures, catalog replay, paired DOWN and replay preserve every other public row',()=>{
 owned.scriptLarge(oldUp);const baseline=tables(),priorCatalog=catalogManaged(),priorUnmanaged=immutableThemeColumns();
 const captureBefore=Object.fromEntries(captureNames.map(name=>[name,JSON.parse(snapshot(name)) as Array<{id:string}>]));
 const ids=Object.fromEntries(captureNames.map(name=>[name,captureBefore[name].map(row=>row.id)]));
 proof('before',{tables:baseline,unmanagedThemeColumns:priorUnmanaged});
 owned.scriptLarge(up);const promoted=tables();
 assert.deepEqual(promoted.filter(row=>!['themes',...captureNames].includes(row.table)),baseline.filter(row=>!['themes',...captureNames].includes(row.table)));
 assert.equal(immutableThemeColumns(),priorUnmanaged);
 for(const name of captureNames){assert.deepEqual(JSON.parse(snapshot(name,`id=ANY(ARRAY[${ids[name].map(q).join(',')}]::uuid[])`)),captureBefore[name]);assert.equal(promoted.find(row=>row.table===name)!.count,baseline.find(row=>row.table===name)!.count+(name==='theme_packages'?1:11));}
 const slugs=z.array(z.string()).length(10).parse(JSON.parse(owned.psql(`SELECT jsonb_agg(t.slug ORDER BY t.slug) FROM themes t WHERE ${targets} AND version='2.1.0';`)));
 assert.equal(owned.psql("SELECT count(*) FROM theme_packages WHERE slug='letbuyy-sense';"),'1');
 assert.equal(owned.psql("SELECT count(*) FROM theme_package_versions v JOIN theme_packages p ON p.id=v.theme_package_id WHERE p.slug='letbuyy-sense' AND v.version='2.0.0' AND v.release_status='published' AND v.deleted_at IS NULL;"),'1');
 const captured=slugs.map(slug=>({slug,bundle:JSON.parse(owned.scriptLarge(`SELECT default_template->'liquidBundle' FROM themes WHERE slug=${q(slug)} AND ${targets};`)) as unknown}));
 let qualifiedContexts=0;
 for(const row of captured){const bundle=LiquidThemePackageBundleSchema.parse(row.bundle);assert.equal(bundle.package.slug,row.slug);assert.equal(bundle.package.version,'2.1.0');assert.equal(bundle.package.version_number,5);for(const sectionType of Object.keys(bundle.sections))qualifiedContexts+=qualifiedFirstPartyInlineChildParents(bundle,sectionType).length;}
 assert.equal(qualifiedContexts,103);proof('up',{tables:promoted,qualifiedContexts,versions:captured.map(row=>({slug:row.slug,version:'2.1.0'}))});
 owned.scriptLarge(up);assert.deepEqual(tables(),promoted,'UP replay must be a real no-op');
 const capturesAfter=Object.fromEntries(captureNames.map(name=>[name,snapshot(name)]));
 owned.scriptLarge(down);assert.equal(catalogManaged(),priorCatalog);assert.equal(immutableThemeColumns(),priorUnmanaged);
 const restored=tables();for(const name of captureNames)assert.equal(snapshot(name),capturesAfter[name]);
 assert.deepEqual(restored.filter(row=>row.table!=='themes'),promoted.filter(row=>row.table!=='themes'));
 owned.scriptLarge(down);assert.deepEqual(tables(),restored,'DOWN replay must be a real no-op');proof('paired-down',{tables:restored,priorCatalogRestored:true,capturesRetained:true});
 owned.scriptLarge(up);assert.equal(immutableThemeColumns(),priorUnmanaged);for(const name of captureNames)assert.equal(snapshot(name),capturesAfter[name]);
 const replayed=tables();owned.scriptLarge(up);assert.deepEqual(tables(),replayed);proof('final-up-replay',{tables:replayed,sourcePinsRechecked:true});
 for(const file of admission.sourceFiles)assert.equal(hash(read(file.path)),file.sha256,file.path);
});
