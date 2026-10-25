// PREPARED ONLY. Later read-only acceptance of the real canonical parent report.
// Does not import the native test or touch Docker/database resources.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync,realpathSync,readlinkSync} from 'node:fs';
import {join,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {sha,root,here} from './inventory.mjs';
assert.equal(process.argv.length,4,'Actual canonical parent result JSON and raw suite log required');
const parent=JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'));
const inventory=JSON.parse(readFileSync(join(here,'SOURCE_VENDOR_TOOL_INVENTORY.json'),'utf8'));
assert.match(parent.runId,/^[a-f0-9]{12}$/);assert.notEqual(parent.runId,'49ada80bc494');
assert.equal(parent.jobs,1);assert.deepEqual(parent.reaped,[]);assert.equal(parent.suites,1);assert.equal(parent.gatewayDbSuites,1);
assert.equal(parent.failedSuites,0);assert.equal(parent.assertionsFailed,0);assert.equal(parent.cancelled,0);assert.equal(parent.skipped,0);assert.equal(parent.todo,0);
assert(parent.wallSeconds<=600,'One-cohort wall budget exceeded; retain failure and cleanup evidence');
assert(parent.tests>0&&parent.assertionsPassed>0);assert.equal(parent.cleanup.failures.length,0);
assert(Object.values(parent.cleanup.remaining).every(x=>Array.isArray(x)&&x.length===0),'Every owned resource family must be empty');
assert.equal(parent.results.length,1);const result=parent.results[0];
assert.equal(result.path,'services/api-gateway/src/__tests__/owned-db/five-theme211-distribution-qualification.manual.ts');
assert.equal(result.code,0);assert.equal(result.timedOut,false);assert.equal(result.hasSummary,true);assert.equal(result.strayProcessesStopped,false);
assert.equal(result.ownership,'verified before start');
assert.equal(result.cleanup.rest,true);assert.equal(result.cleanup.database,true);
assert.equal(result.migrations.throughMigration,null);
assert.deepEqual(result.migrations.applied,inventory.migrations.ordered,'Actual applied322 order/name/prefix/hash must equal expected full current profile');
const expectedProofs=['phase1-positive-current-profile-and-installed-history','phase2-five-package-up-conservation','phase2b-positive211-installed-work','phase3-strict-up-replay','phase4-transactional-refusal-controls','phase5-readback-raw-before-assertions','phase5-paired-down','phase6-strict-down-replay','phase7-final-up-replay-and-captured-definitions','phase8-final-security-source-and-full-conservation'];
const log=readFileSync(resolve(process.argv[3]),'utf8'),proofs=new Map();
for(const match of log.matchAll(/FIVE211_QUALIFICATION_PROVENANCE (\{[^\n]+\})/g)){
 const ref=JSON.parse(match[1]),path=resolve(ref.path);
 assert(path.startsWith(join(resolve(tmpdir()),'letbuyy-five211-qualification-'+parent.runId+'-')),'Actual owned proof-directory identity');
 const bytes=readFileSync(path);assert.equal(sha(bytes),ref.sha256);const proof=JSON.parse(bytes);
 assert.equal(proof.runId,parent.runId);assert(expectedProofs.includes(proof.name)||/^readback-2\.1\.[01]-letbuyy-(craft|dawn|nova|summit|sense)$/.test(proof.name));assert.equal(basename(path),proof.name+'.json');assert(!proofs.has(proof.name),'Duplicate native phase proof');proofs.set(proof.name,proof.value);
}
assert.deepEqual([...proofs.keys()].filter(name=>expectedProofs.includes(name)),expectedProofs,'Every ordered real phase proof must exist; missing phases remain NOT_RUN');
assert.equal(proofs.get(expectedProofs[0]).controls.length,5);assert.equal(proofs.get(expectedProofs[2]).controls.length,5);
assert.equal(proofs.get(expectedProofs[4]).controls,84);assert.equal(proofs.get(expectedProofs[4]).nestedCheckpointCases,68);assert.equal(proofs.get(expectedProofs[4]).noAcceptedMutation,true);
assert.equal([...proofs.keys()].filter(name=>name.startsWith('readback-')).length,10);
for(const [name,record] of proofs)if(name.startsWith('readback-')){assert.equal(record.fixtureKind,'DIRECT_CANONICAL_LIQUID_DTO_NOT_ORDER_CREATION');assert.equal(record.savedLabelsRetained,true);}
const requests=proofs.get(expectedProofs[5]).requests;assert.equal(requests.length,10);assert.equal(new Set(requests.map(x=>x.requestId)).size,10);assert.equal(new Set(requests.map(x=>x.traceId)).size,10);assert(requests.every(x=>x.status===200));
const readback=proofs.get(expectedProofs[6]);assert.equal(readback.priorMetadataRestored,true);assert.equal(readback.capturesInstalledWorkAndOrdersRetained,true);assert.equal(readback.attributed.length,2);assert(readback.attributed.every(x=>x.newRows===10&&x.retainedRows>0));
assert.equal(proofs.get(expectedProofs[8]).exactFive211Definitions,true);assert.equal(proofs.get(expectedProofs[9]).sourcePinsExact,true);assert.equal(proofs.get(expectedProofs[9]).allPhaseProofsRetained,true);
for(const file of inventory.files){assert.equal(sha(readFileSync(file.path)),file.sha256,'Post-run input drift '+file.path);assert.equal(realpathSync(file.path),file.realPath);assert.equal(lstatSync(file.path).mode&0o777,file.mode);}
for(const link of inventory.workspaceLinks){assert.equal(readlinkSync(join(root,link.path)),link.target);assert.equal(realpathSync(join(root,link.path)),link.realPath);}
console.log(JSON.stringify({status:'REAL_PARENT_NATIVE_RESULT_AND_INPUT_ACCEPTANCE_PASS',runId:parent.runId,migrations:322,maximum:393,ceiling:null,inputFiles:inventory.files.length,phaseArtifacts:proofs.size,refusalCases:84,cleanupVerified:true,fullThemeCertified:false,original26CreditAdded:0}));
