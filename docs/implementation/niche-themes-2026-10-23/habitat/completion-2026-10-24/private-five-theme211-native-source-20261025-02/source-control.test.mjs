// Pure selected source predicates only: never import the native leaf/Worker/runner.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
const root='/private/tmp/letbuyy-five-theme211-native-source-20261025-02';
const native='services/api-gateway/src/__tests__/owned-db/five-theme211-distribution-qualification.manual.ts';
const source=readFileSync(join(root,native),'utf8');
const ts=createRequire(join(root,'package.json'))('typescript');
const tree=ts.createSourceFile(native,source,ts.ScriptTarget.Latest,true);assert.equal(tree.parseDiagnostics.length,0);
const nodes=[];function visit(node){nodes.push(node);ts.forEachChild(node,visit);}visit(tree);
function predicate(name){const node=nodes.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert(node);const js=ts.transpileModule(node.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;return new Function('assert',js+';return '+name)(assert);}
const shape=predicate('validateAdmissionShape'),telemetry=predicate('assertReadbackTelemetry'),transactionBody=predicate('transactionBody');
function model(){const start=Date.now();return {status:'ROOT_ONE_FRESH_FIVE_THEME211_NATIVE',expiresAt:new Date(start+590000).toISOString(),wholeParentStartedAt:new Date(start).toISOString(),wholeParentDeadlineAt:new Date(start+600000).toISOString(),sourceClosurePath:'SOURCE_ONLY_MODEL',sourceClosureSha256:'a'.repeat(64),sourceFiles:Array.from({length:1000},(_,i)=>({path:'source-only/model-'+i+'.ts',sha256:'b'.repeat(64)})),protocolPath:'SOURCE_ONLY_PROTOCOL_MODEL',protocolSha256:'c'.repeat(64),preflightReceiptPath:'SOURCE_ONLY_UNEXECUTED_RESOURCE_MODEL',preflightReceiptSha256:'d'.repeat(64),cohortWallSeconds:600,maxAttempts:1,effectBudget:'TEN_SITES_INSTALLS_DRAFTS_RELEASES_FIVE_RPC_HISTORY_SETUP_ONLY'};}
test('pure admission SHAPE positive control is not a real file/resource admission',()=>assert.doesNotThrow(()=>shape(model())));
const bad={wrongStatus:x=>{x.status='SOURCE_ONLY';},expired:x=>{x.expiresAt='2020-01-01T00:00:00Z';},wrongBudget:x=>{x.cohortWallSeconds=601;},multipleAttempts:x=>{x.maxAttempts=2;},wrongEffect:x=>{x.effectBudget='UNBOUNDED';},longParentDeadline:x=>{x.wholeParentDeadlineAt=new Date(Date.parse(x.wholeParentStartedAt)+601000).toISOString();},emptyClosure:x=>{x.sourceFiles=[];},duplicateSource:x=>{x.sourceFiles[1]=x.sourceFiles[0];},parentEscape:x=>{x.sourceFiles[0].path='../foreign.ts';},absoluteSource:x=>{x.sourceFiles[0].path='/foreign.ts';},environmentDeclaration:x=>{x.sourceFiles[0].path='config/private.env.example';},corruptPin:x=>{x.sourceFiles[0].sha256='wrong';},unexpectedField:x=>{x.unapproved=true;},extraEntryField:x=>{x.sourceFiles[0].extra=true;}};
for(const [name,mutate]of Object.entries(bad))test('pure admission shape refuses '+name,()=>{const x=model();mutate(x);assert.throws(()=>shape(x));});
test('all runtime application imports are deferred after builtin admission/input checks',()=>{
 for(const node of tree.statements.filter(ts.isImportDeclaration))assert(node.moduleSpecifier.text.startsWith('node:'));
 const admitted=source.indexOf('validateAdmissionShape(rawAdmission)'),sourcePins=source.indexOf('for(const file of rawAdmission.sourceFiles)'),firstImport=source.indexOf("await import('./owned-db-support')");assert(admitted>0&&sourcePins>admitted&&firstImport>sourcePins);
 assert(source.includes("assert.notEqual(owned.runId,'49ada80bc494'"));assert(source.includes('Date.now()<Date.parse(admission.wholeParentDeadlineAt)'));
});
test('actual combined UP/DOWN constructors have one outer transaction and both immutable payloads',()=>{
 const variables=nodes.filter(ts.isVariableDeclaration),up=variables.find(n=>n.name.getText(tree)==='up'),down=variables.find(n=>n.name.getText(tree)==='down');
 const directory='docs/implementation/niche-theme-programme/completion-2026-10-24/five-theme211-integration01/',heading='docs/implementation/niche-theme-programme/completion-2026-10-24/order-heading211-integration01/';
 const evaluate=node=>new Function('read','transactionBody','directory','headingDirectory','return '+node.initializer.getText(tree))(path=>readFileSync(join(root,path),'utf8'),transactionBody,directory,heading);
 for(const sql of [evaluate(up),evaluate(down)]){assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);assert(sql.includes('$heading211$')&&sql.includes('$sense211$'));assert.equal((sql.match(/DO \$(promotion|rollback)\$/g)||[]).length,2);}
});
test('prepared refusal matrix has84 real future transactions, no executed native controls',()=>{
 const declaration=nodes.find(n=>ts.isVariableDeclaration&&ts.isVariableDeclaration(n)&&n.name.getText(tree)==='corruptions');assert(declaration);
 const expression=ts.transpileModule('const value='+declaration.initializer.getText(tree)+';return value;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const corruptions=new Function('target',expression)({checkpoint:'SOURCE_ONLY_MODEL'});assert.equal(corruptions.length,17);
 const targetLoop=nodes.find(n=>ts.isForOfStatement(n)&&n.initializer.getText(tree).includes('target of')===false&&n.initializer.getText(tree).includes('target')&&ts.isArrayLiteralExpression(n.expression)&&n.expression.elements.length===2);assert(targetLoop);
 const calls=[];function walk(n){if(ts.isCallExpression(n)&&n.expression.getText(tree)==='refuse')calls.push(n);ts.forEachChild(n,walk);}walk(targetLoop.statement);
 assert.equal(calls.length,9);assert.equal(((calls.length-1)+corruptions.length*2)*2,84);assert(source.includes('nestedCheckpointCases:68'));
});
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const request=n=>({requestId:uuid(1000+n),traceId:uuid(2000+n),route:'/v1/themes/:slug/editor',status:200,actorId:uuid(3000+n),siteId:null,runtimeName:'api-gateway',ipAddress:'192.0.2.211',userAgent:'five211-native-readback'});
const stamp='2026-10-25T01:00:00.000Z';
function rows(r,n){return {log:{id:uuid(100+n),site_id:null,request_id:r.requestId,trace_id:r.traceId,method:'GET',path:r.route,route:r.route,status_code:200,latency_ms:1,user_id:r.actorId,auth_source:'internal-sso',ip_address:r.ipAddress,user_agent:r.userAgent,error_code:null,metadata:{country:null,colo:null,request_log_sample_reason:'authenticated',request_log_sample_rate:1},created_by:r.actorId,updated_by:r.actorId,created_at:stamp,updated_at:stamp,deleted_at:null},metric:{id:uuid(200+n),metric_name:'letbuyy.runtime.request',metric_value:1,unit:'count',runtime_name:'api-gateway',site_id:null,dimensions:{route:r.route,method:'GET',status_code:200,status_class:'2xx',latency_ms:1,server_error_count:0,client_error_count:0,success_count:1,auth_source:'internal-sso',country:null,colo:null},request_id:r.requestId,correlation_id:r.requestId,trace_id:r.traceId,recorded_at:stamp,created_by:null,updated_by:null,created_at:stamp,updated_at:stamp,deleted_at:null}};}
const families=['worker_request_logs','runtime_telemetry_metrics'].map(base=>({base,parent:base+'_partitioned',leaves:[base+'_partitioned_default']}));
function mirrors(logs,metrics){return Object.fromEntries(families.flatMap(f=>[f.base,f.parent,...f.leaves].map(name=>[name,structuredClone(f.base==='worker_request_logs'?logs:metrics)])));}
function fixture(){const requests=Array.from({length:10},(_,i)=>request(i)),old=rows(request(99),99),fresh=requests.map(rows);return {requests,before:mirrors([old.log],[old.metric]),after:mirrors([old.log,...fresh.map(x=>x.log)],[old.metric,...fresh.map(x=>x.metric)])};}
test('actual pure telemetry reconciler accepts exactly10 attributed reads and retains old complete mirrors',()=>{const x=fixture();assert.deepEqual(telemetry(x.before,x.after,x.requests,families).map(x=>x.newRows),[10,10]);});
for(const mode of ['changedOld','wrongActor','unattributed','missingLeaf'])test('actual telemetry predicate refuses '+mode,()=>{const x=fixture();let logs=x.after.worker_request_logs,metrics=x.after.runtime_telemetry_metrics;if(mode==='changedOld')logs[0].latency_ms=2;if(mode==='wrongActor')logs[1].user_id=uuid(9999);if(mode==='unattributed')metrics.push(rows(request(88),88).metric);x.after=mirrors(logs,metrics);if(mode==='missingLeaf')x.after.worker_request_logs_partitioned_default.pop();assert.throws(()=>telemetry(x.before,x.after,x.requests,families));});
