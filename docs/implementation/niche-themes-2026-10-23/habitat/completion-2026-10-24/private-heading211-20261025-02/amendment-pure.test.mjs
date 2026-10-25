// Bounded source predicates/synthetic telemetry only. Native modules, owned DB,
// Worker, provider, browser and the earlier61 suites are never executed here.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import ts from 'typescript';
const root='/private/tmp/letbuyy-order-heading211-prep-20261025-02';
const dir=root+'/docs/implementation/niche-theme-programme/completion-2026-10-24/order-heading211-integration01/';
const generator=readFileSync(dir+'generate-order-heading211-proposal.ts','utf8');
const up=readFileSync(dir+'heading211.up.proposal.sql','utf8'),down=readFileSync(dir+'heading211.down.proposal.sql','utf8');
const manifest=JSON.parse(readFileSync(dir+'DISTRIBUTION_PROPOSAL.json','utf8'));
const artifacts=JSON.parse(up.match(/\$heading211\$([\s\S]*?)\$heading211\$::jsonb/)[1]);
const source=ts.createSourceFile('generator.ts',generator,ts.ScriptTarget.Latest,true);
function variable(name){for(const node of source.statements)if(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(source)===name))return node.getText(source);assert.fail(name);}
const declarations=ts.transpileModule(variable('priorFieldPaths')+'\n'+variable('columns'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const {paths,columns}=new Function(declarations+';return {paths:priorFieldPaths,columns};')();
const expectedPaths={name:['name'],category:['category'],version:['previousVersion'],default_template:['previousDocument'],section_schemas:['previousPersistence','schemaManifest','section_schemas'],block_schemas:['previousPersistence','schemaManifest','block_schemas'],settings_schema:['previousPersistence','schemaManifest','settings_schema'],renderer_manifest:['previousDocument','liquidBundle','renderer'],schema_version:['previousPersistence','themePackageVersion','schema_version'],renderer_version:['previousPersistence','themePackageVersion','renderer_version']};
const key='firstPartyOrderHeading211',previousHash=manifest.previousPromotionPayloadSha256;
const expected=(item,path)=>path.reduce((value,k)=>value?.[k],item);
function fixture(){const item=artifacts[0],config={firstPartyCustomization210:{payloadSha256:previousHash},preservedUnknownSetting:{value:'keep'}};const prior={...Object.fromEntries(Object.entries(expectedPaths).map(([field,path])=>[field,structuredClone(expected(item,path))])),config};return {item,current:{...structuredClone(config),[key]:{payloadSha256:manifest.payloadSha256,previous:prior}}};}
// Exact finite JSON predicate model, checked against each emitted SQL binding.
// This deliberately does not claim PostgreSQL/PLpgSQL execution.
function modelAccepts({item,current}){
 const journal=current?.[key],prior=journal?.previous;
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 if(!object(current)||!object(journal)||!object(prior))return false;
 if(!isDeepStrictEqual(Object.keys(prior).sort(),[...columns].sort())||!isDeepStrictEqual(Object.keys(journal).sort(),['payloadSha256','previous']))return false;
 if(journal.payloadSha256!==manifest.payloadSha256)return false;
 if(Object.entries(paths).some(([field,path])=>!isDeepStrictEqual(prior[field],expected(item,path))))return false;
 if(!object(prior.config)||Object.hasOwn(prior.config,key)||prior.config.firstPartyCustomization210?.payloadSha256!==previousHash)return false;
 const outer={...current};delete outer[key];return isDeepStrictEqual(outer,prior.config);
}
test('every deterministic DOWN field is independently mapped and emitted in both SQL guards',()=>{
 assert.deepEqual(paths,expectedPaths);assert.deepEqual(Object.keys(paths).sort(),columns.filter(k=>k!=='config').sort());
 for(const[field,path]of Object.entries(expectedPaths))for(const text of [up,down])assert.ok(text.includes(`prior->'${field}' IS DISTINCT FROM item#>'{${path.join(',')}}'`),field);
 for(const text of [up,down]){assert.ok(text.includes('jsonb_object_keys(prior)'));assert.ok(text.includes("(t.config-'firstPartyOrderHeading211') IS DISTINCT FROM prior->'config'"));}
});
test('valid full prior metadata/config including unknown preserved settings stays accepted',()=>assert.equal(modelAccepts(fixture()),true));
for(const field of Object.keys(expectedPaths))test(`saved prior ${field} corruption is refused while immutable payload/current source stay exact`,()=>{const x=fixture();x.current[key].previous[field]=['section_schemas','block_schemas','settings_schema','renderer_manifest','default_template'].includes(field)?{forged211:true}:'forged211';assert.equal(modelAccepts(x),false);});
test('missing/extra prior fields, extra journal fields and wrong prior type refuse',()=>{for(const mode of ['missing','extra','journal','null']){const x=fixture();if(mode==='missing')delete x.current[key].previous.name;if(mode==='extra')x.current[key].previous.unapproved=true;if(mode==='journal')x.current[key].unapproved=true;if(mode==='null')x.current[key].previous=null;assert.equal(modelAccepts(x),false,mode);}});
test('nested prior config tampering and post-promotion config drift both refuse',()=>{const a=fixture();a.current[key].previous.config.preservedUnknownSetting.value='forged';assert.equal(modelAccepts(a),false);const b=fixture();b.current.preservedUnknownSetting.value='new-current';assert.equal(modelAccepts(b),false);});
test('nested previous document tampering refuses before jsonb_populate_record restoration',()=>{const x=fixture();x.current[key].previous.default_template.liquidBundle.package.name='forged';assert.equal(modelAccepts(x),false);});
test('native source prepares every nested field refusal for both replay and DOWN without immutable row mutation',()=>{
 const text=readFileSync(root+'/services/api-gateway/src/__tests__/owned-db/first-party-order-heading211-qualification.manual.ts','utf8');
 assert.ok(text.includes("for(const corruption of corruptions)for(const [direction,script]of [['replay',up],['DOWN',down]])"));
 for(const field of ['name','category','version','schema_version','renderer_version','section_schemas','block_schemas','settings_schema','renderer_manifest'])assert.ok(text.includes("'"+field+"'"));
 assert.ok(text.includes('nested-default-document')&&text.includes('nested-original-config'));assert.ok(!/UPDATE theme_package_versions SET/.test(text));
});

const nativeText=readFileSync(root+'/services/api-gateway/src/__tests__/owned-db/first-party-order-heading211-qualification.manual.ts','utf8');
const native=ts.createSourceFile('native.ts',nativeText,ts.ScriptTarget.Latest,true);
const fn=native.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='assertReadbackTelemetry');assert.ok(fn);
const javascript=ts.transpileModule(fn.getText(native),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const attribute=new Function('assert',javascript+';return assertReadbackTelemetry;')(assert);
const families=['worker_request_logs','runtime_telemetry_metrics'].map(base=>({base,parent:base+'_partitioned',leaves:[base+'_partitioned_2026_10',base+'_partitioned_default']}));
function telemetryFixture(){
 const requests=Array.from({length:4},()=>({requestId:randomUUID(),traceId:randomUUID(),route:'/v1/themes/:slug/editor',status:200,actorId:randomUUID(),siteId:null,runtimeName:'api-gateway',ipAddress:'192.0.2.211',userAgent:'heading211-native-readback'}));
 const make=(base,r)=>{const audit={id:randomUUID(),site_id:r.siteId,request_id:r.requestId,trace_id:r.traceId,created_by:base==='worker_request_logs'?r.actorId:null,updated_by:base==='worker_request_logs'?r.actorId:null,created_at:'2026-10-25T00:00:00Z',updated_at:'2026-10-25T00:00:00Z',deleted_at:null};return base==='worker_request_logs'?{...audit,method:'GET',path:r.route,route:r.route,status_code:200,latency_ms:3,user_id:r.actorId,auth_source:'internal-sso',ip_address:r.ipAddress,user_agent:r.userAgent,error_code:null,metadata:{country:null,colo:null,request_log_sample_reason:'authenticated',request_log_sample_rate:1}}:{...audit,metric_name:'letbuyy.runtime.request',metric_value:1,unit:'count',runtime_name:r.runtimeName,correlation_id:r.requestId,recorded_at:'2026-10-25T00:00:00Z',dimensions:{route:r.route,method:'GET',status_code:200,status_class:'2xx',latency_ms:3,server_error_count:0,client_error_count:0,success_count:1,auth_source:'internal-sso',country:null,colo:null}};};
 const before={},after={};for(const family of families){const old=make(family.base,{...requests[0],requestId:randomUUID(),traceId:randomUUID()}),added=requests.map(r=>make(family.base,r));before[family.base]=[old];before[family.parent]=[structuredClone(old)];before[family.leaves[0]]=[];before[family.leaves[1]]=[structuredClone(old)];after[family.base]=[structuredClone(old),...added];after[family.parent]=structuredClone(after[family.base]);after[family.leaves[0]]=structuredClone(added);after[family.leaves[1]]=[structuredClone(old)];}return{requests,before,after};
}
function changeNew(x,base,fn){const f=families.find(f=>f.base===base);for(const name of [f.base,f.parent,...f.leaves])for(const row of x.after[name])if(row.request_id===x.requests[0].requestId)fn(row);}
test('actual native telemetry reconciler accepts four exact appends and preserves pre-existing rows/mirrors',()=>{const x=telemetryFixture();assert.deepEqual(attribute(x.before,x.after,x.requests,families).map(r=>[r.retainedRows,r.newRows]),[[1,4],[1,4]]);});
const failures={
 'mutated old operational row':x=>{const f=families[0];for(const name of [f.base,f.parent,f.leaves[1]])x.after[name].find(r=>r.request_id===x.before[f.base][0].request_id).metadata={forged:true};},
 'removed old operational row':x=>{const f=families[0];for(const name of [f.base,f.parent,f.leaves[1]])x.after[name]=x.after[name].filter(r=>r.id!==x.before[f.base][0].id);},
 'unattributed extra row':x=>{const f=families[0],row={...structuredClone(x.after[f.base][1]),id:randomUUID(),request_id:randomUUID()};for(const name of [f.base,f.parent,f.leaves[0]])x.after[name].push(structuredClone(row));},
 'wrong request':x=>changeNew(x,'worker_request_logs',r=>{r.request_id=randomUUID();}),
 'wrong trace':x=>changeNew(x,'worker_request_logs',r=>{r.trace_id='foreign-trace';}),
 'wrong actor':x=>changeNew(x,'worker_request_logs',r=>{r.user_id=randomUUID();}),
 'wrong site':x=>changeNew(x,'runtime_telemetry_metrics',r=>{r.site_id=randomUUID();}),
 'wrong route dimension':x=>changeNew(x,'runtime_telemetry_metrics',r=>{r.dimensions.route='/foreign';}),
 'wrong sample metadata':x=>changeNew(x,'worker_request_logs',r=>{r.metadata.request_log_sample_reason='omitted';}),
 'negative latency':x=>changeNew(x,'worker_request_logs',r=>{r.latency_ms=-1;}),
 'parent mirror mismatch':x=>{x.after[families[0].parent].pop();},
 'leaf mirror mismatch':x=>{x.after[families[1].leaves[0]].pop();},
 'extra unsupported field':x=>changeNew(x,'worker_request_logs',r=>{r.unapproved=true;}),
 'duplicate request attribution':x=>{x.requests[1].requestId=x.requests[0].requestId;},
};
for(const[name,mutate]of Object.entries(failures))test('telemetry refuses '+name,()=>{const x=telemetryFixture();mutate(x);assert.throws(()=>attribute(x.before,x.after,x.requests,families));});
