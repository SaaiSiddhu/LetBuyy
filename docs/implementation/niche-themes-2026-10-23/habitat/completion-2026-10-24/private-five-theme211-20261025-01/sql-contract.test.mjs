// Exact emitted-SQL bindings and source predicate model only. No PostgreSQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {join} from 'node:path';
const root='/private/tmp/letbuyy-five-theme211-prep-20261025-01';
const directory=join(root,'docs/implementation/niche-theme-programme/completion-2026-10-24/five-theme211-integration01');
const read=name=>readFileSync(join(directory,name),'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
const up=read('UNNUMBERED_sense211.up.proposal.sql'),down=read('UNNUMBERED_sense211.down.proposal.sql');
const manifest=JSON.parse(read('SENSE211_DISTRIBUTION_PROPOSAL.json')),joint=JSON.parse(read('FIVE211_JOINT_MANIFEST.json'));
const payload=sql=>sql.match(/\$sense211\$([\s\S]*?)\$sense211\$::jsonb/)?.[1];
const items=JSON.parse(payload(up)),item=items[0];
const source=read('generate-sense211-proposal.ts');
const ts=createRequire(join(root,'package.json'))('typescript');
const ast=ts.createSourceFile('generator.ts',source,ts.ScriptTarget.Latest,true);
let bindings;
for(const statement of ast.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(declaration.name.getText(ast)==='priorFieldPaths'){
 const object=declaration.initializer.expression;
 assert(ts.isObjectLiteralExpression(object));bindings=Object.fromEntries(object.properties.map(p=>[p.name.getText(ast),p.initializer.elements.map(x=>x.text)]));
}
const expected={name:['name'],category:['category'],version:['previousVersion'],default_template:['previousDocument'],section_schemas:['previousPersistence','schemaManifest','section_schemas'],block_schemas:['previousPersistence','schemaManifest','block_schemas'],settings_schema:['previousPersistence','schemaManifest','settings_schema'],renderer_manifest:['previousDocument','liquidBundle','renderer'],schema_version:['previousPersistence','themePackageVersion','schema_version'],renderer_version:['previousPersistence','themePackageVersion','renderer_version']};
const value=path=>path.reduce((x,key)=>x[key],item);
const columns=[...Object.keys(expected),'config'];
const originalConfig={firstPartyCustomization210:{payloadSha256:manifest.previousPromotionPayloadSha256},merchantMetadata:{keep:['nested',0,false]}};
const prior=()=>Object.fromEntries([...Object.entries(bindings).map(([field,path])=>[field,structuredClone(value(path))]),['config',structuredClone(originalConfig)]]);
const journal=p=>({payloadSha256:manifest.payloadSha256,previous:p});
const current=p=>({...structuredClone(p.config),firstPartySense211:journal(p)});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function accepts(p,c){
 if(!object(c)||!object(c.firstPartySense211)||!object(p))return false;
 if(JSON.stringify(Object.keys(p).sort())!==JSON.stringify(columns.slice().sort()))return false;
 if(JSON.stringify(Object.keys(c.firstPartySense211).sort())!==JSON.stringify(['payloadSha256','previous']))return false;
 if(c.firstPartySense211.payloadSha256!==manifest.payloadSha256)return false;
 for(const [field,path] of Object.entries(bindings))try{assert.deepEqual(p[field],value(path));}catch{return false;}
 if(!object(p.config)||Object.hasOwn(p.config,'firstPartySense211')||p.config.firstPartyCustomization210?.payloadSha256!==manifest.previousPromotionPayloadSha256)return false;
 const outer=structuredClone(c);delete outer.firstPartySense211;
 try{assert.deepEqual(outer,p.config);return true;}catch{return false;}
}
test('one emitted Sense-only payload, exact prior210/version6 and paired byte hashes',()=>{
 assert.equal(items.length,1);assert.equal(item.slug,'letbuyy-sense');assert.equal(item.id,'7b669c70-0000-4000-8000-000000000002');assert.equal(item.previousVersion,'2.1.0');assert.equal(item.persistence.themePackageVersion.version_number,6);
 assert.equal(payload(up),payload(down));assert.equal(sha(payload(up)),manifest.payloadSha256);
 for(const file of manifest.files)assert.equal(sha(read(file.path)),file.sha256);
});
test('all ten deterministic restored fields have exact emitted guards in both directions',()=>{
 assert.deepEqual(bindings,expected);
 for(const sql of [up,down])for(const [field,path] of Object.entries(bindings))assert(sql.includes(`prior->'${field}' IS DISTINCT FROM item#>'{${path.join(',')}}'`),field);
});
test('valid original merchant config stays exact without default reconstruction',()=>{const p=prior();assert(accepts(p,current(p)));assert.deepEqual(p.config,originalConfig);});
for(const field of Object.keys(expected))test('source predicate model refuses forged saved '+field,()=>{const p=prior(),c=current(p);p[field]={forged:true};c.firstPartySense211.previous=p;assert.equal(accepts(p,c),false);});
test('strict prior/journal shapes refuse missing/extra/null/array checkpoints',()=>{
 for(const mutate of [p=>{delete p.name;},p=>{p.extra='forged';}]){const p=prior();mutate(p);assert.equal(accepts(p,current(p)),false);}
 for(const p of [null,[]])assert.equal(accepts(p,{firstPartySense211:journal(p)}),false);
 const p=prior(),c=current(p);c.firstPartySense211.extra=true;assert.equal(accepts(p,c),false);
 for(const sql of [up,down]){assert(sql.includes("jsonb_typeof(prior) IS DISTINCT FROM 'object'"));assert(sql.includes("ARRAY['payloadSha256','previous']::text[]"));assert(sql.includes('jsonb_object_keys(prior)'));}
});
test('original-config drift, nested checkpoint and wrong promotion hash are refused',()=>{
 const p=prior(),c=current(p);p.config.merchantMetadata.keep.push('forged');assert.equal(accepts(p,c),false);
 const nested=prior();nested.config.firstPartySense211={};assert.equal(accepts(nested,current(nested)),false);
 const stale=prior();stale.config.firstPartyCustomization210.payloadSha256='0'.repeat(64);assert.equal(accepts(stale,current(stale)),false);
 for(const sql of [up,down])assert(sql.includes("(t.config-'firstPartySense211') IS DISTINCT FROM prior->'config'"));
});
test('joint manifest only references four immutable heading payloads plus new Sense',()=>{
 const path=join(root,'docs/implementation/niche-theme-programme/completion-2026-10-24/order-heading211-integration01/DISTRIBUTION_PROPOSAL.json');
 const bytes=readFileSync(path);assert.equal(sha(bytes),'54856b0d11e824ba97c058290041fa776f14435dc0183859ca90ab899c57a32d');assert.equal(joint.heading.sha256,sha(bytes));assert.equal(joint.heading.payloadSha256,'da476dc47ce16d55cd3a7ee05170e9618860febd844c7fcb83aaf349d00806b9');assert.equal(joint.heading.artifacts.length,4);assert.equal(joint.sense.artifacts.length,1);assert.equal(joint.sense.payloadSha256,manifest.payloadSha256);
 for(const [path,digest] of Object.entries(joint.sourceInputs))assert.equal(sha(readFileSync(join(root,path))),digest,'Actual joint source binding '+path);
 for(const file of joint.heading.files)assert.equal(sha(readFileSync(join(root,'docs/implementation/niche-theme-programme/completion-2026-10-24/order-heading211-integration01',file.path))),file.sha256);
});
test('paired source restores all11 metadata fields and never deletes captures/installed data or changes authority',()=>{
 const stripped=[up,down].map(sql=>sql.replace(payload(sql),'PAYLOAD'));
 assert(down.includes('jsonb_populate_record(NULL::public.themes,prior)'));
 for(const field of columns)assert(down.includes(field+'=restored.'+field));
 for(const sql of stripped)assert.doesNotMatch(sql,/\b(DROP|TRUNCATE|GRANT|REVOKE|ALTER|DELETE)\b/i);
 assert(up.includes("t.version IS DISTINCT FROM '2.1.0' AND t.version IS DISTINCT FROM '2.1.1'"));
 assert(up.includes('IS NOT TRUE'));assert(down.includes('IS NOT TRUE'));
 assert(down.includes("body||jsonb_build_object('checksum',body->'checksum')"));
 assert.doesNotMatch(stripped.join('\n'),/UPDATE\s+public\.(theme_instances|theme_editor_drafts|theme_releases|orders|theme_package_versions|theme_schema_manifests|theme_renderer_manifests)/i);
});
