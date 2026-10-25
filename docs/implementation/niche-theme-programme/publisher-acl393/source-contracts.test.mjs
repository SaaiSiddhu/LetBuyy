// Permanent pure source/security contracts. Never import the registrar or obtain an owned database.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {discoverGatewayDatabaseSuites,isGatewayDatabaseSuite} from '../../../../scripts/governance/test-suite-catalog.mjs';
import {assertNoTruncatedCaseCondition} from './case-operand-repair/if-then-boundary.mjs';
import './http-attribution-repair/http-request-delta.test.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
const root=new URL('../../../../',import.meta.url),folder='docs/implementation/niche-theme-programme/publisher-acl393/';
const suitePath='services/api-gateway/src/__tests__/owned-db/theme-publisher-acl.postgres.test.ts';
const manualPath='services/api-gateway/src/__tests__/owned-db/theme-publisher-acl-qualification.manual.ts';
const corePath='services/api-gateway/src/__tests__/owned-db/publisher-acl-proof.ts';
const upPath='database/supabase/migrations/393_theme_publisher_tenant_execute.sql',downPath='database/supabase/rollback/393_theme_publisher_tenant_execute.rollback.sql';
const read=p=>readFileSync(new URL(p,root),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
const source=read(suitePath),manual=read(manualPath),core=read(corePath),up=read(upPath),down=read(downPath);
const historical=read(folder+'source-emission/theme-publisher-acl.postgres.test.ts.before.snapshot');
const astFor=(path,text)=>ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
const ast=astFor(corePath,core),oldAst=astFor(suitePath,historical);
function nodes(tree,predicate){const found=[];function walk(n){if(predicate(n))found.push(n);ts.forEachChild(n,walk);}walk(tree);return found;}
const calls=(tree,name)=>nodes(tree,n=>ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text===name);
const fn=(tree,name)=>{const found=nodes(tree,n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.equal(found.length,1,name);return found[0].getText(tree);};
const candidate=direction=>read(folder+'case-operand-repair/v2/393_publisher_tenant_execute.'+direction+'.candidate.sql');
const withoutFirstLine=s=>s.slice(s.indexOf('\n')+1);

test('emitted393 UP/DOWN preserve every qualified byte after the single provenance header line',()=>{
 assert.equal(withoutFirstLine(up),withoutFirstLine(candidate('up')));assert.equal(withoutFirstLine(down),withoutFirstLine(candidate('down')));
 assert.equal(sha(historical),'e71b15856e4868d28f249d8debf7f758de31cf61715bd10c0844ce79c2bc66b2');
 for(const sql of [up,down]){assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);assertNoTruncatedCaseCondition(sql);}
});
test('pair changes only the fixed direct tenant ACL and preserves all qualified profile/fence/dependency refusal guards',()=>{
 const signature='public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)';
 assert(up.includes(`REVOKE EXECUTE ON FUNCTION ${signature} FROM app_tenant RESTRICT;`));assert(down.includes(`GRANT EXECUTE ON FUNCTION ${signature} TO app_tenant;`));
 assert.equal((up.match(/REVOKE EXECUTE ON FUNCTION/g)||[]).length,1);assert.equal((down.match(/GRANT EXECUTE ON FUNCTION/g)||[]).length,1);
 for(const sql of [up,down]){
  assert(!/CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|ROLE|TABLE|POLICY)|ALTER\s+(?:ROLE|POLICY|DEFAULT\s+PRIVILEGES)|ON\s+ALL\s+FUNCTIONS|UPDATE\s+pg_catalog|CASCADE/i.test(sql));
  for(const witness of ["session_user<>current_user","session_replication_role')<>'origin'",'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED','56a6b7b15e8a7ec159341fe0331ac593','old_dependencies IS DISTINCT FROM expected_dependencies','unknown grantor, ACL or effective privileges','refuses inherited tenant EXECUTE',"(to_jsonb(old_row)-'proacl') IS DISTINCT FROM (to_jsonb(new_row)-'proacl')",'old_acl_without_tenant IS DISTINCT FROM new_acl_without_tenant','old_dependencies IS DISTINCT FROM new_dependencies'])assert(sql.includes(witness),witness);
 }
});
test('current CI automatically discovers the permanent suite and excludes the explicit manual qualifier without a catalog bypass',()=>{
 const discovered=discoverGatewayDatabaseSuites(fileURLToPath(root));assert.equal(discovered.filter(p=>p===suitePath).length,1);assert(!discovered.includes(manualPath));assert(isGatewayDatabaseSuite(suitePath));assert(!isGatewayDatabaseSuite(manualPath));
 const runner=read('scripts/governance/run-executable-suites.mjs');assert(runner.includes("const kindOf = (suite) => forcedKind ??"));assert(runner.includes("['postgres', 'gateway-db'].includes(forcedKind)"));
});
test('old Playfield qualification is byte-exact archived/manual evidence and is excluded from automatic current CI',()=>{
 const path='services/api-gateway/src/__tests__/owned-db/playfield201-promotion-qualification.manual.ts';
 const archived=read(folder+'source-emission/playfield201-promotion.postgres.test.ts.aa26.snapshot');
 assert.equal(sha(read(path)),'aa26dd41b09cbbb188b413b385acf80ad6e21f4e23bbdf789ebff68a8bc42782');assert.equal(read(path),archived);
 const discovered=discoverGatewayDatabaseSuites(fileURLToPath(root));assert(!discovered.includes(path));assert(!isGatewayDatabaseSuite(path));
 for(const current of ['services/api-gateway/src/__tests__/owned-db/theme-install-version.postgres.test.ts','services/api-gateway/src/__tests__/owned-db/threadline-lifecycle.postgres.test.ts'])assert(discovered.includes(current));
});
test('permanent entry uses the ordinary owned guard and canonical SQL with a hardened baseline, independent of release grants/counts',()=>{
 assert(source.includes("import {requireOwnedDatabase} from './owned-db-support'"));assert(source.includes('owned:requireOwnedDatabase()'));assert(source.includes('entryTenantExecute:false'));assert(source.includes(upPath)&&source.includes(downPath));
 for(const text of [source,core])assert(!/admittedInputs|admission\.json|source-input-closure|sourceMigrationMaximum|paths\.length,321|z\.literal\(392\)|readdirSync/.test(text));
 assert(source.includes("assert.equal(read(upPath),up"));assert(source.includes("assert.equal(read(downPath),down"));
 for(const text of [source,core,manual])assert(!/\.skip\(|\.todo\(|\.only\(|\.dev\.vars|DISABLE\s+(?:TRIGGER|ROW)|UPDATE\s+pg_catalog|DELETE\s+FROM\s+pg_catalog/.test(text));
});
test('manual and permanent entries share one proven registrar and the complete ordered seven-phase proof',()=>{
 for(const text of [source,manual]){assert(text.includes("import {registerPublisherAclProof} from './publisher-acl-proof'"));assert.equal((text.match(/\nregisterPublisherAclProof\(/g)||[]).length,1);}
 const stages=calls(ast,'stage');assert.equal(stages.length,7);stages.forEach((s,i)=>assert(s.arguments[0].text.startsWith(`${i+1} `)));assert.equal(calls(ast,'test').length,1);
 for(const [path,text] of [[suitePath,source],[manualPath,manual],[corePath,core]])assert.equal(astFor(path,text).parseDiagnostics.length,0);
});
test('all qualified security/state/request functions and phase1/3/4/5/6 bodies are exact in the shared proof',()=>{
 for(const name of ['parseOwnRowCount','candidateErrorContext','applyCandidate','publisher','businessState','httpSnapshot','unrelatedCatalog','snapshot','profile','withoutTenant','dependencyCount','request','assertTenantDenied'])assert.equal(fn(ast,name),fn(oldAst,name),name);
 const before=calls(oldAst,'stage'),after=calls(ast,'stage');for(const i of [0,2,3,4,5])assert.equal(after[i].getText(ast),before[i].getText(oldAst),'phase '+(i+1));
});
test('hardened current entry requires UP/replay to be fully inert and finishes exact after the deliberate isolated historical inverse',()=>{
 const stages=calls(ast,'stage'),second=stages[1].getText(ast),sixth=stages[5].getText(ast),last=stages[6].getText(ast);
 assert(core.includes('profile(entry.publisher,inputs.entryTenantExecute)'));assert(second.includes('dependencyCount(before.publisher),inputs.entryTenantExecute?1:0'));assert(second.includes('if(!inputs.entryTenantExecute)assert.deepEqual(afterState,before)'));assert(second.includes('assert.deepEqual(replay,afterState)'));
 for(const witness of ["applyCandidate('DOWN',inputs.down)",'profile(historical.publisher,true)',"applyCandidate('UP',inputs.up)",'assert.deepEqual(snapshot(),hardened)','assertTenantDenied()','No app_tenant publisher or updater invocation'])assert(sixth.includes(witness));
 for(const witness of ['profile(final.publisher,false)','inputs.verifySource()','dependencyCount(final.publisher),0','selectedSqlInputsExact:true'])assert(last.includes(witness));
});
test('all six mounted retry/CAS/denial checks retain full snapshots, single-request attribution, original statuses and private draft assertions',()=>{
 const phase=calls(ast,'stage')[3].getText(ast);assert.equal((phase.match(/await noDomainEffects\('/g)||[]).length,6);
 for(const label of ['save-retry','stale-save','publish-retry','rollback-retry','stale-rollback','foreign-rollback'])assert(phase.includes("noDomainEffects('"+label+"'"));
 for(const witness of ['before=httpSnapshot()','afterState=httpSnapshot()','http-no-domain-effects-before-assertion','assertHttpNoDomainEffects(before,afterState,expected)','http-no-domain-effects-attributed',"errorCode:null,siteId:null",'data(saveRetry).replayed,true','assert.deepEqual(draftState(),privateBefore)',')).status,409',')).status,403'])assert(phase.includes(witness),witness);
 assert(!phase.includes('businessState(),state'));
});
test('historical manual qualifier fails closed on the consumed grant before the ordinary owned guard',()=>{
 assert(manual.includes("const suitePath='"+manualPath+"'"));assert(manual.indexOf('const inputs=admittedInputs();')<manual.indexOf('owned:requireOwnedDatabase()'));
 const prefix=manual.slice(manual.indexOf('const root='),manual.indexOf('const inputs=admittedInputs();'));
 assert(!/requireOwnedDatabase|owned\./.test(prefix));const js=ts.transpileModule(prefix.replace("new URL('../../../../../',import.meta.url)",`new URL(${JSON.stringify(root.href)})`)+'\nreturn admittedInputs();',{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
 const {z}=createRequire(new URL('services/api-gateway/package.json',root))('zod');const closed=read(folder+'native-runs/04/03-admission.json.before.snapshot');
 const evaluate=new Function('assert','readFileSync','readdirSync','createHash','z',js);
 assert.throws(()=>evaluate(assert,()=>closed,()=>{throw new Error('must reject before directory access');},createHash,z),{name:'ZodError'});
});
// Compile only the parser declaration; never evaluate/import the owned registrar.
const parserJs=ts.transpileModule(fn(ast,'parseOwnRowCount'),{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
const parseCount=new Function('assert',parserJs+'\nreturn parseOwnRowCount;')(assert);
const tagged=count=>'BEGIN\nSET\n'+JSON.stringify({marker:'ACL393_OWN_ROW_COUNT',count})+'\nROLLBACK\n';
test('own-row parser reads typed positive1 between command tags',()=>{assert.equal(parseCount(tagged(1)),1);});
test('own-row parser rejects zero or malformed/untyped counts',()=>{for(const count of [0,'1',null,1.5,2])assert.throws(()=>parseCount(tagged(count)));});
test('own-row parser rejects missing malformed or duplicate markers',()=>{for(const output of ['BEGIN\nSET\n1\nROLLBACK\n','{"count":1}\n','{"marker":"ACL393_OWN_ROW_COUNT","count":1\n',tagged(1)+tagged(1)])assert.throws(()=>parseCount(output));});
