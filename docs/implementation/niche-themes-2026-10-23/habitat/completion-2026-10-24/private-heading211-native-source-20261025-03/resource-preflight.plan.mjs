// PREPARED ONLY. NOT EXECUTED. Later Root-only, separately admitted read-only
// Docker image/resource preflight. Never launches native or writes admission.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifySource} from './preflight-source.mjs';
import {sha,root,here} from './inventory.mjs';

assert.equal(process.argv.length,3,'One separately issued Root resource grant path required');
const grant=JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'));
assert.equal(grant.status,'ROOT_HEADING211_ONE600S_RESOURCE_PREFLIGHT_GRANTED');
assert.equal(grant.owner,'01a164ba-c402-7212-990d-ed4792274b37');
assert.equal(grant.allocator,'01a16ce5-e5ba-7191-ab2c-a1b76947d2b5');
assert.equal(grant.privateRoot,root);assert.equal(grant.maxNativeCohorts,1);assert.equal(grant.wallSeconds,600);
assert.equal(grant.jobs,1);assert.equal(grant.noReap,true);assert.equal(grant.preparedTransactions,2);assert.equal(grant.throughMigration,null);
assert.equal(grant.priorReservedNativePairCleared,true);assert.equal(grant.protectedRuntime07Touched,false);
assert(Date.now()<Date.parse(grant.expiresAt),'Expired resource preflight grant');
assert.equal(sha(readFileSync(resolve(grant.priorReservationRelease.path))),grant.priorReservationRelease.sha256);
const source=verifySource();assert.equal(source.inventorySha256,grant.inventorySha256);
const inventory=JSON.parse(readFileSync(join(here,'SOURCE_VENDOR_TOOL_INVENTORY.json'),'utf8'));
const cli=inventory.tools.find(x=>x.kind==='future-docker-cli-not-executed').path;
function docker(args){
 const result=spawnSync(cli,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10_000,maxBuffer:1024*1024});
 assert.equal(result.status,0,'Read-only Docker preflight failed: '+args[0]);return result.stdout.trim();
}
const context=docker(['context','show']);assert.equal(context,grant.daemon.context,'Root admitted Docker context');
const daemonId=docker(['info','--format','{{.ID}}']);assert.equal(daemonId,grant.daemon.id,'Root admitted Docker daemon identity');
const serverVersion=docker(['info','--format','{{.ServerVersion}}']);assert(serverVersion.length>0);
assert.equal(grant.images.length,2);
const images=grant.images.map(image=>{
 assert(['postgres','postgrest'].includes(image.role));assert(/^sha256:[a-f0-9]{64}$/.test(image.id));
 const actual=docker(['image','inspect','--format','{{.Id}}',image.reference]);assert.equal(actual,image.id,'Actual image content must match Root grant');return {...image,observedId:actual};
});assert.equal(new Set(images.map(x=>x.role)).size,2);
const labeled=docker(['ps','-a','--filter','label=com.letbuyy.executable-fixture=1','--format','{{json .Names}}']);
console.log(JSON.stringify({status:'ROOT_ADMITTED_READONLY_RESOURCE_PREFLIGHT_PASS_NATIVE_NOT_STARTED',source,context,daemonId,serverVersion,images,existingFixtureNames:labeled.split('\n').filter(Boolean).map(x=>JSON.parse(x)),createdResources:0,nativeStarted:false,admissionWritten:false,protectedRuntime07Touched:false}));
