// Separate preflight tool ONLY. No runner import/spawn, native import, database or metadata write.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkCompleteInventory as checkInventory} from './check-complete-inventory.v4.mjs';
const here=dirname(fileURLToPath(import.meta.url)),candidate=dirname(here),index=JSON.parse(readFileSync(candidate+'/candidate-index.json','utf8')),main=index.mainRoot;
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
try{
 const grantPath=process.argv[2];assert(grantPath,'Explicit NEW Root execution-grant path required; no default/fallback');
 const old=read(join(main,'docs/implementation/niche-theme-programme/release-playfield201/catalog394-qualification/native-runs/02/execution-grant.json'));assert.notEqual(sha(read(grantPath)),sha(old),'Attempt01 grant is consumed; a NEW Root execution grant is required');
 const inventoryPath=here+'/source-input-closure.v4.json',graph=json(here+'/literal-import-graph.v4.json'),inventory=json(inventoryPath),checked=checkInventory(inventory,graph),g=json(grantPath);
 assert.equal(g.status,'ROOT_GRANTED_ONE_CATALOG394_QUALIFIER_ON_FRESH_DEFAULT393');assert(Date.parse(g.expiresAt)>Date.now(),'Fresh grant expired');assert.equal(g.sourceFiles,inventory.files.length);assert.equal(g.expectedPhases,8);assert.equal(g.expectedTAP,9);assert.equal(g.migrationMaximum,393);assert.equal(g.migrationCount,322);assert.equal(g.migrationCeiling,null);assert.equal(g.candidateMigration,394);assert.equal(g.sandboxPermissions,'require_escalated');
 const admission=json(join(main,g.admissionPath));assert.equal(sha(read(join(main,g.admissionPath))),g.admissionSHA);assert.equal(sha(read(join(main,g.proposalAdmissionPath))),g.proposalAdmissionSHA);
 assert.equal(admission.status,'ROOT_PLAYFIELD201_NATIVE_SOURCE_ADMITTED_FOR_ONE_DEFAULT_LATEST393_CANDIDATE394');assert.equal(admission.suitePath,index.suitePath);assert.equal(admission.suiteSha256,index.suiteSha256);assert.equal(sha(read(join(main,index.suitePath))),index.suiteSha256);
 assert.equal(admission.inputClosureSha256,sha(read(inventoryPath)),'Active admission must name reviewedV4 runtime inventory');assert.equal(sha(read(join(main,admission.inputClosurePath))),sha(read(inventoryPath)),'Actual Main inventory must be the newly reviewedV4 bytes');
 assert.equal(admission.rootProposalSha256,g.proposalAdmissionSHA);assert.equal(admission.sourceMigrationMaximum,393);assert.equal(admission.sourceMigrationCount,322);assert.equal(admission.candidateMigration,394);assert.equal(admission.migrationCeiling,null);assert.equal(admission.nativeLease,'GRANTED_ONE_FRESH_DEFAULT_LATEST393_JOBS1_NO_REAP_PREPARED2_600S');
 assert.equal(admission.frozenBuilderPath,'docs/implementation/niche-theme-programme/release-playfield201/catalog394-qualification/private03/frozen-builder-inputs.json');assert.equal(sha(read(join(main,admission.frozenBuilderPath))),admission.frozenBuilderSha256);const archive=json(join(main,admission.frozenBuilderPath));assert.equal(archive.files.length,61);for(const f of archive.files)assert.equal(sha(read(join(main,f.archivePath))),f.sha256);
 const proposal=json(join(main,g.proposalAdmissionPath));assert.equal(proposal.status,'ROOT_PLAYFIELD201_CATALOG394_PROPOSAL_ADMITTED_NATIVE_TEST_SOURCE_NEXT');for(const f of proposal.files)assert.equal(sha(read(join(main,f.path))),f.sha256);
 for(const dir of ['database/supabase/migrations','database/supabase/rollback','database/supabase/deploy','database/supabase/bootstrap']){
  const actual=existsSync(join(main,dir))?readdirSync(join(main,dir),{recursive:true}).filter(p=>/\.(?:sql|json)$/.test(p)).map(p=>dir+'/'+p).sort():[];
  const expected=inventory.files.filter(f=>f.path.startsWith(dir+'/')&&/\.(?:sql|json)$/.test(f.path)).map(f=>f.path).sort();assert.deepEqual(actual,expected,'Full SQL/bootstrap set mismatch: '+dir);
 }
 assert.equal(g.argv[0],'node');assert.equal(g.argv[1],'scripts/governance/run-executable-suites.mjs');const value=key=>{assert.equal(g.argv.filter(x=>x===key).length,1);return g.argv[g.argv.indexOf(key)+1];};
 assert.equal(value('--suite'),index.suitePath);assert.equal(value('--kind'),'gateway-db');assert.equal(value('--jobs'),'1');assert.equal(value('--prepared-transactions'),'2');assert.equal(value('--timeout'),'600');assert(g.argv.includes('--no-reap'));assert(!g.argv.some(x=>/migration-ceiling|through-migration|keep-container|reap-only/.test(x)));
 process.stdout.write(JSON.stringify({...checked,status:'NEW_ROOT_GRANT_AND_V4_RUNTIME_PREFLIGHT_PASS_NO_RUNNER_STARTED',executionGrantSHA:sha(read(grantPath)),admissionSHA:g.admissionSHA,sourceClosureSHA:sha(read(inventoryPath)),allSqlAndBootstrapSetsExact:true,runnerStarted:false,instruction:'This tool ends here. Inspect exit0 in its separate tool result; only then issue the exact Root argv in a NEW tool call with require_escalated.'})+'\n');
}catch(error){process.stderr.write((error instanceof Error?error.stack:String(error))+'\n');process.exitCode=1;}
