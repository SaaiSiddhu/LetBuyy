import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,chmodSync,symlinkSync,linkSync,rmSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {readPreservedPrivateFile,validatePreservedCapsule,validatePreservedTarget,preservedRoleSql,parsePreservedJson,capturePreservedRoleProfile,measurePreservedDatabase,preservedLogicalSequence,preservedLogicalTrigger,preservedTriggerInventory,PRESERVED_WITNESS_METHOD,checkpointPreservedDatabase,validatePreservedCutoverPermit,PRESERVED_RUNTIME07 as f,PRESERVED_THEME_SUITE} from '../../scripts/governance/owned-database-provision.mjs';
import {FIXTURE_LABEL,OWNER_PID_LABEL,RUN_ID_LABEL,ROLE_LABEL,DEFAULT_IMAGE,DEFAULT_REST_IMAGE,PRESERVATION_LABEL,PRESERVATION_VALUE} from '../../scripts/governance/executable-pg-fixture.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),h='a'.repeat(64),id='11111111-1111-1111-1111-111111111111';
const now=Date.parse('2026-10-25T01:00:00Z');
const expected={repoRoot:'/private/tmp/letbuyy-synthetic-source',now,suitePath:PRESERVED_THEME_SUITE,jobs:1,noReap:true};
function fixture(){
 const roles={definitions:['postgres','anon','authenticated','service_role','authenticator','app_tenant','supabase_admin'].map(name=>({name,login:name==='postgres'||name==='authenticator',superuser:name==='postgres',inherit:true,createRole:false,createDb:false,replication:false,bypassRls:name==='service_role',connectionLimit:-1,passwordHash:null,validUntil:null,settings:[]})),memberships:[]};
 return {version:1,kind:'preserved-runtime07',expiresAt:'2026-10-25T02:00:00Z',source:{resourceRunId:f.fixtureId,runnerPid:54685,container:'letbuyy-exec-54685-mvmssydy-fe81e9',database:'letbuyy_exec_theme_completion_razorpay_browser_manual_ts',volume:'letbuyy-exec-49ada80bc494-1-data',postgresImage:DEFAULT_IMAGE,restImage:DEFAULT_REST_IMAGE,imageId:'sha256:'+h,roleProfileSha256:sha(JSON.stringify(roles))},sourceBundle:{root:expected.repoRoot,manifestPath:expected.repoRoot+'/source.json',manifestSha256:h},archive:{path:'/private/tmp/letbuyy-runtime07-backups/fake.dump',bytes:9,sha256:h,format:'custom'},fence:{final:true,editorReturned:true,leaseId:'synthetic-lease',snapshotAt:'2026-10-25T00:59:00Z',lastAcceptedAt:'2026-10-25T00:58:00Z',receiptPath:'/private/tmp/letbuyy-runtime07-backups/fake-fence.json',receiptSha256:h,witnessSha256:h},application:{fixtureId:f.fixtureId,site:{siteId:f.siteId,subdomain:f.subdomain,locationId:f.locationId,tag:'threadline-ui'},ownerId:id,email:'syn-threadline-11111111@example.invalid',password:'SYNTHETIC_ONLY_NO_REAL_SECRET',products:[id],collections:[id],editorCatalog:{}},origins:{identityOrigin:f.identityOrigin,merchantOrigin:f.merchantOrigin,commerceOrigin:f.commerceOrigin,checkoutOrigin:f.checkoutOrigin,apiOrigin:f.apiOrigin,receiverOrigin:f.receiverOrigin,cookieDomain:f.cookieDomain,ports:{...f.ports}},roles,witness:{method:PRESERVED_WITNESS_METHOD,path:'/private/tmp/letbuyy-runtime07-backups/fake-witness.json',sha256:h,dataSha256:h,profileSha256:h,sequenceSha256:h,acceptedOrderIds:Array.from({length:7},(_,i)=>'11111111-1111-1111-1111-'+String(i+1).padStart(12,'0'))},qa:{mode:'refresh',oldSessionsPreserved:false,allowIssuerAndCookieRefresh:true,allowCheckoutRefresh:true,pendingIntentsReconciled:true,pendingIntentWitnessSha256:h,retainedBinding:null},tls:{certPath:'/private/tmp/letbuyy-runtime07-backups/fake-cert',certSha256:h,keyPath:'/private/tmp/letbuyy-runtime07-backups/fake-key',keySha256:h},provider:{csvPath:'/private/tmp/letbuyy-runtime07-backups/fake-csv',csvSha256:h,webhookSecretPath:'/private/tmp/letbuyy-runtime07-backups/fake-hmac',webhookSecretSha256:h}};
}
test('fixed application scope accepts only an explicit unexpired source capsule',()=>{
 assert.equal(validatePreservedCapsule(fixture(),expected).application.fixtureId,f.fixtureId);
 const mutants=[c=>c.extra=true,c=>c.expiresAt='2026-10-25T00:00:00Z',c=>c.source.resourceRunId='000000000001',c=>c.source.runnerPid=1,c=>c.source.volume='foreign',c=>c.source.imageId='latest',c=>c.sourceBundle.root='/tmp/foreign',c=>c.archive.path='/tmp/foreign.dump',c=>c.fence.final=false,c=>c.fence.editorReturned=false,c=>c.application.fixtureId='000000000001',c=>c.application.site.siteId=id,c=>c.origins.ports.identity=9001,c=>c.origins.identityOrigin='https://foreign.invalid',c=>c.roles.definitions[0].name='foreign',c=>c.witness.dataSha256='',c=>c.qa.oldSessionsPreserved=true,c=>c.qa.pendingIntentsReconciled=false,c=>c.qa.allowCheckoutRefresh=false,c=>c.tls.keySha256='bad'];
 for(const mutate of mutants){const c=fixture();mutate(c);assert.throws(()=>validatePreservedCapsule(c,expected));}
 for(const scope of [{jobs:2},{noReap:false},{suitePath:'another.test.ts'}])assert.throws(()=>validatePreservedCapsule(fixture(),{...expected,...scope}));
});
test('descriptor-bound private bytes refuse tampering, permissions, UID, symlink and hardlink',()=>{
 const root=mkdtempSync('/private/tmp/threadline-synthetic-private-');chmodSync(root,0o700);
 try{const path=join(root,'fake.json'),data=Buffer.from('{"synthetic":true}');writeFileSync(path,data,{mode:0o600});assert.deepEqual(readPreservedPrivateFile(path,{expectedSha256:sha(data)}),data);
 assert.throws(()=>readPreservedPrivateFile(path,{expectedSha256:h}));assert.throws(()=>readPreservedPrivateFile(path,{uid:process.getuid()+1}));assert.throws(()=>readPreservedPrivateFile(path,{maxBytes:1}));
 chmodSync(path,0o644);assert.throws(()=>readPreservedPrivateFile(path));chmodSync(path,0o600);symlinkSync(path,join(root,'symlink'));assert.throws(()=>readPreservedPrivateFile(join(root,'symlink')));linkSync(path,join(root,'hard'));assert.throws(()=>readPreservedPrivateFile(path));rmSync(join(root,'hard'));chmodSync(root,0o755);assert.throws(()=>readPreservedPrivateFile(path));
 }finally{rmSync(root,{recursive:true,force:true});}
 assert.throws(()=>parsePreservedJson(Buffer.from('secret SYNTHETIC malformed')),{message:'preserved fixture refused [PRIVATE_JSON]'});
});
test('restore target is a newly allocated owned network and volume, never the source',()=>{
 const saved={capsule:fixture()},cluster={runId:'000000000001',containerStarted:true,networkCreated:true,volumeCreated:true,name:'new-owned',volume:'new-volume',network:'new-network'};
 const inspect={State:{Running:true},Image:'sha256:'+h,Config:{Image:DEFAULT_IMAGE,Labels:{[FIXTURE_LABEL]:'1',[RUN_ID_LABEL]:cluster.runId,[OWNER_PID_LABEL]:'123',[ROLE_LABEL]:'postgres',[PRESERVATION_LABEL]:PRESERVATION_VALUE}},HostConfig:{},NetworkSettings:{Ports:{},Networks:{'new-network':{}}},Mounts:[{Type:'volume',Name:'new-volume',Destination:'/var/lib/postgresql/data'}]};
 const verify=(c=cluster,i=inspect)=>validatePreservedTarget(c,saved.capsule.source.database,saved,i,123);verify();
 for(const c of [{...cluster,runId:f.fixtureId},{...cluster,volume:saved.capsule.source.volume},{...cluster,networkCreated:false}])assert.throws(()=>verify(c));
 for(const mutate of [i=>i.Config.Labels[OWNER_PID_LABEL]='456',i=>delete i.Config.Labels[PRESERVATION_LABEL],i=>i.HostConfig.Privileged=true,i=>i.HostConfig.Binds=['/host:/data'],i=>i.NetworkSettings.Ports={'5432/tcp':[{}]},i=>i.Mounts[0].Name='foreign']){const i=structuredClone(inspect);mutate(i);assert.throws(()=>verify(cluster,i));}
 const sql=preservedRoleSql(saved,'a'.repeat(64));assert(sql.includes('PASSWORD NULL'));assert(!sql.includes('DROP ROLE'));assert.throws(()=>preservedRoleSql(saved,"x';DROP DATABASE postgres;"));
});
test('cutover binds all staged hashes and a short explicit Root permit',()=>{
 const saved={capsule:fixture(),capsuleSha256:h},binding={sha256:h},stages={identity:{path:'fake',sha256:h}},runId='000000000001';
 const permit={version:1,status:'ROOT_APPROVED_PRESERVED_RUNTIME07_CUTOVER',resourceRunId:runId,applicationFixtureId:f.fixtureId,siteId:f.siteId,capsuleSha256:h,archiveSha256:h,sourceManifestSha256:h,fenceReceiptSha256:h,witnessSha256:h,bindingSha256:h,stages,oldListenersRetired:true,noLaterAcceptedWork:true,expiresAt:'2026-10-25T01:05:00Z'};
 validatePreservedCutoverPermit(permit,saved,runId,binding,stages,now);
 for(const patch of [{oldListenersRetired:false},{noLaterAcceptedWork:false},{bindingSha256:'b'.repeat(64)},{expiresAt:'2026-10-25T02:00:00Z'},{stages:{}}])assert.throws(()=>validatePreservedCutoverPermit({...permit,...patch},saved,runId,binding,stages,now));
});
test('source contracts keep the ordinary guard intact and remove seeding from restore branch',()=>{
 const runner=readFileSync(new URL('../../scripts/governance/run-executable-suites.mjs',import.meta.url),'utf8');assert(runner.includes('checkpointPreservedDatabase'));assert(runner.includes("['rehearsal','serve']"));assert(runner.includes('!cluster.preservedSafeToCleanup'));
 const manual=readFileSync(new URL('../owned-db/theme-completion-razorpay-browser.manual.ts',import.meta.url),'utf8');assert(manual.indexOf("PHASE==='rehearsal'")<manual.indexOf('const file ='));assert(manual.includes('if (!preserved&&process.env.LETBUYY_THEME_COMPLETION_SHARED_PROPOSALS'));
});

test('capsule loader binds synthetic source, final fence, full archive bytes and pending-intent proof',async()=>{
 const {loadPreservedCapsule}=await import('../../scripts/governance/owned-database-provision.mjs');
 const root=mkdtempSync('/private/tmp/letbuyy-synthetic-capsule-');chmodSync(root,0o700);
 try{
  const c=fixture(),scope={...expected,repoRoot:root};c.sourceBundle.root=root;c.sourceBundle.manifestPath=join(root,'manifest.json');writeFileSync(join(root,'source.mjs'),'// synthetic only',{mode:0o600});const manifest=Buffer.from(JSON.stringify({files:[{path:'source.mjs',sha256:sha('// synthetic only')}]}));writeFileSync(c.sourceBundle.manifestPath,manifest,{mode:0o600});c.sourceBundle.manifestSha256=sha(manifest);
  const archive=Buffer.from('PGDMPfake');c.archive.bytes=archive.length;c.archive.sha256=sha(archive);
  const witness={method:PRESERVED_WITNESS_METHOD,dataSha256:h,profileSha256:h,sequenceSha256:h,acceptedOrderIds:c.witness.acceptedOrderIds,pendingIntentsReconciled:true,pendingIntentWitnessSha256:h},witnessBytes=Buffer.from(JSON.stringify(witness));c.witness.sha256=sha(witnessBytes);c.fence.witnessSha256=c.witness.sha256;
  const fence={status:'FINAL_EDITOR_WRITE_FENCE',leaseId:c.fence.leaseId,latestAcceptedAt:c.fence.lastAcceptedAt,archiveSha256:c.archive.sha256,witnessSha256:c.witness.sha256,applicationFixtureId:f.fixtureId,noLaterAcceptedWork:true,databaseWriteFenceConfirmed:true,providerCallbacksSettled:true};
  const paths=new Map([[c.archive.path,archive],[c.witness.path,witnessBytes]]),capsulePath='/private/tmp/letbuyy-runtime07-backups/fake-capsule.json';
  const readPrivate=(path,options={})=>{const bytes=paths.get(path);assert(bytes,'test never reads a real private file');if(options.expectedSha256)assert.equal(sha(bytes),options.expectedSha256);return bytes;};
  function load(){const fenceBytes=Buffer.from(JSON.stringify(fence));paths.set(c.fence.receiptPath,fenceBytes);c.fence.receiptSha256=sha(fenceBytes);const capsuleBytes=Buffer.from(JSON.stringify(c));paths.set(capsulePath,capsuleBytes);return loadPreservedCapsule(capsulePath,sha(capsuleBytes),scope,{readPrivate});}
  assert.equal(load().archive.toString(),'PGDMPfake');fence.noLaterAcceptedWork=false;assert.throws(load);fence.noLaterAcceptedWork=true;paths.set(c.archive.path,Buffer.from('PGDMPevil'));assert.throws(load);paths.set(c.archive.path,archive);writeFileSync(join(root,'source.mjs'),'changed');assert.throws(load);
 }finally{rmSync(root,{recursive:true,force:true});}
});


// Amendment02: real helpers with synthetic files/transport. Never inspect a live resource.
import * as checkpointFs from 'node:fs';
test('preserved02 logical sequence ignores only log_cnt and retains every logical/definition bit',()=>{
 const value={sequence:'public.synthetic_seq',last_value:'9007199254740993',is_called:true,log_cnt:'32',definition:{start:'1',increment:'1',min:'1',max:'9223372036854775807',cache:'1',cycle:false,type:'bigint',owner:'postgres',acl:null}};
 const logical=preservedLogicalSequence(value),fingerprint=v=>sha(JSON.stringify(preservedLogicalSequence(v)));
 assert.equal(logical.last_value,'9007199254740993');assert.equal(fingerprint(value),fingerprint({...value,log_cnt:'0'}));assert(!Object.hasOwn(logical,'log_cnt'));
 for(const patch of [{last_value:'9007199254740994'},{is_called:false}])assert.notEqual(fingerprint(value),fingerprint({...value,...patch}));
 for(const [key,changed]of Object.entries({start:'2',increment:'2',min:'0',max:'9223372036854775806',cache:'2',cycle:true,type:'integer',owner:'app_tenant',acl:'postgres=r/postgres'}))assert.notEqual(fingerprint(value),fingerprint({...value,definition:{...value.definition,[key]:changed}}));
 for(const mutate of [v=>delete v.last_value,v=>v.extra=true,v=>v.definition.extra=true,v=>v.last_value=9007199254740993,v=>v.last_value='9223372036854775808']){const v=structuredClone(value);mutate(v);assert.throws(()=>preservedLogicalSequence(v));}
});
function checkpointWorld(fail){
 const directory=mkdtempSync('/private/tmp/threadline-checkpoint-synthetic-');chmodSync(directory,0o700);const events=[],handles=new Map(),cluster={runId:'000000000002',name:'synthetic-pg',network:'synthetic-net',volume:'synthetic-volume',containerStarted:true,networkCreated:true,volumeCreated:true,preservedSafetyRequired:true},saved={capsuleSha256:h,capsule:{application:{fixtureId:f.fixtureId}}};
 const phase=path=>path===directory?'directory':path.endsWith('.roles.json')?'roles':path.endsWith('.json')?'receipt':'archive';
 const event=(part,operation)=>{assert.notEqual(cluster.preservedSafeToCleanup,true,'No early safety authorization');const name=part+'.'+operation;events.push(name);if(fail===name)throw Error('injected '+name);};
 const io={stat(path){event('directory','stat');return checkpointFs.lstatSync(path);},open(path,...args){const part=phase(path);event(part,'open');const fd=checkpointFs.openSync(path,...args);handles.set(fd,part);return fd;},write(fd,...args){event(handles.get(fd),'write');return checkpointFs.writeSync(fd,...args);},sync(fd){event(handles.get(fd),'sync');return checkpointFs.fsyncSync(fd);},close(fd){const part=handles.get(fd);checkpointFs.closeSync(fd);handles.delete(fd);event(part,'close');}};
 const witness={method:PRESERVED_WITNESS_METHOD,dataSha256:h,profileSha256:h,sequenceSha256:h,acceptedOrderIds:[id]};let reads=0,roleReads=0;
 const deps={directory,io,validateTarget(){event('target','validate');},roles:async()=>{roleReads++;return{definitions:fail==='roles.changed'&&roleReads>1?[{synthetic:'changed'}]:[],memberships:[]};},witness:async()=>{reads++;return fail==='witness.changed'&&reads>1?{...witness,dataSha256:'b'.repeat(64)}:witness;},archive:async emit=>emit(Buffer.from('PGDMPsynthetic-not-real-archive')),fullRead:async bytes=>{event('archive','fullRead');assert.equal(bytes.toString(),'PGDMPsynthetic-not-real-archive');}};
 return{cluster,saved,deps,events,directory,dispose(){for(const fd of handles.keys())try{checkpointFs.closeSync(fd);}catch{}rmSync(directory,{recursive:true,force:true});}};
}
import {runInNewContext as checkpointContext} from 'node:vm';
function recordedOwnerCleanup(cluster){
 const source=readFileSync(new URL('../../scripts/governance/run-executable-suites.mjs',import.meta.url),'utf8'),body=source.match(/^function removeClusters\(\) \{[\s\S]*?^\}/m)?.[0];assert(body);
 const calls=[],remove=kind=>name=>{calls.push({kind,name});return{kind,name,removed:true};};
 const invoke=checkpointContext(body+'\nremoveClusters;',{keepContainer:false,clusters:[cluster],cleanupOutcomes:[],removeContainer:remove('container'),removeNetwork:remove('network'),removeVolume:remove('volume')});invoke();return calls;
}
test('preserved02 checkpoint synchronizes and closes archive roles receipt and directory before cleanup',async()=>{
 const w=checkpointWorld();try{assert.deepEqual(recordedOwnerCleanup(w.cluster),[]);const receipt=await checkpointPreservedDatabase(w.cluster,'synthetic',w.saved,w.deps);assert.equal(w.cluster.preservedSafeToCleanup,true);assert.deepEqual(recordedOwnerCleanup(w.cluster).map(x=>x.kind),['container','network','volume']);assert.equal(receipt.bytes,31);for(const part of ['archive','roles','receipt','directory']){assert(w.events.includes(part+'.sync'));assert(w.events.indexOf(part+'.sync')<w.events.indexOf(part+'.close'));}assert.equal(w.events.at(-1),'directory.close');assert.equal(JSON.parse(readFileSync(receipt.path+'.json')).sha256,receipt.sha256);assert.equal(JSON.parse(readFileSync(receipt.rolesPath)).definitions.length,0);}finally{w.dispose();}
});
test('preserved02 every checkpoint open write sync close directory or witness failure retains unsafe state',async()=>{
 const failures=['directory.stat','target.validate',...['archive','roles','receipt'].flatMap(part=>['open','write','sync','close'].map(op=>part+'.'+op)),'archive.fullRead','directory.open','directory.sync','directory.close','witness.changed','roles.changed'];
 for(const fail of failures){const w=checkpointWorld(fail);try{const first=checkpointPreservedDatabase(w.cluster,'synthetic',w.saved,w.deps);assert.equal(first,checkpointPreservedDatabase(w.cluster,'synthetic',w.saved,w.deps));await assert.rejects(first);assert.notEqual(w.cluster.preservedSafeToCleanup,true,fail);assert.deepEqual(recordedOwnerCleanup(w.cluster),[],fail);}finally{w.dispose();}}
});


test('preserved02 trigger normalization ignores generated IDs but retains internal enforcement and exact user identity',()=>{
 const fk={physicalOid:'123',relation:'public.order_items',name:'RI_ConstraintTrigger_c_123',internal:true,constraint:{schema:'public',relation:'public.order_items',name:'order_items_order_fkey',type:'f',definition:'FOREIGN KEY (order_id) REFERENCES orders(id)'},referencedRelation:'public.orders',constraintIndex:'public.orders_pkey',function:'RI_FKey_check_ins()',eventType:5,deferrable:true,initiallyDeferred:false,enabled:'O',definition:'CREATE CONSTRAINT TRIGGER "RI_ConstraintTrigger_c_123" AFTER INSERT ON public.order_items FROM public.orders DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION "RI_FKey_check_ins"()',arguments:'',when:null,columns:null,oldTable:null,newTable:null,parent:null};
 const moved={...fk,physicalOid:'987',name:'RI_ConstraintTrigger_c_987',definition:fk.definition.replace('_123"','_987"')};
 assert.deepEqual(preservedLogicalTrigger(fk),preservedLogicalTrigger(moved));
 const fingerprint=rows=>sha(JSON.stringify(preservedTriggerInventory(rows)));
 for(const patch of [{enabled:'D'},{eventType:9},{function:'RI_FKey_check_upd()'},{referencedRelation:'public.foreign_orders'},{deferrable:false},{initiallyDeferred:true},{constraint:{...fk.constraint,name:'another_constraint'}},{constraintIndex:'public.other_index'},{arguments:'00'},{columns:['other']},{when:'false'},{parent:{relation:'public.other',name:'parent',internal:false,physicalOid:'456'}}])assert.notEqual(fingerprint([fk]),fingerprint([{...fk,...patch}]));
 assert.notEqual(fingerprint([fk]),fingerprint([]));assert.notEqual(fingerprint([fk]),fingerprint([fk,fk]));assert.throws(()=>preservedLogicalTrigger({...fk,physicalOid:'555'}));
 const user={...fk,internal:false,constraint:null,name:'user_trigger_123',definition:'CREATE TRIGGER user_trigger_123 AFTER INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION audit_order()'};
 assert.equal(preservedLogicalTrigger(user).name,user.name);assert.equal(preservedLogicalTrigger(user).definition,user.definition);assert.notEqual(fingerprint([user]),fingerprint([{...user,name:'user_trigger_987',definition:user.definition.replace('user_trigger_123','user_trigger_987')}]));
 assert.equal(fingerprint([fk,user]),fingerprint([user,moved]));
 const parent={relation:'public.parents',constraint:null,function:'audit()',eventType:5,name:'named_parent',internal:false,physicalOid:'456'};assert.notEqual(fingerprint([{...fk,parent}]),fingerprint([{...fk,parent:{...parent,name:'other_parent'}}]));const generatedParent={...parent,name:'generated_parent_456',internal:true};assert.equal(fingerprint([{...fk,parent:generatedParent}]),fingerprint([{...fk,parent:{...generatedParent,name:'generated_parent_789',physicalOid:'789'}}]));
});


test('preserved02 raw role reader uses PG16 global settings catalogue and retains unmasked hashes/null defaults',async()=>{
 const roles={definitions:[{name:'synthetic',passwordHash:'SYNTHETIC_UNMASKED_HASH',settings:[]}],memberships:[]};let actualSql;
 const result=await capturePreservedRoleProfile(async sql=>{actualSql=sql;return JSON.stringify(roles);});assert.deepEqual(result,roles);
 assert.match(actualSql,/FROM pg_authid a LEFT JOIN pg_db_role_setting s ON s\.setrole=a\.oid AND s\.setdatabase=0/);assert.match(actualSql,/'passwordHash',rolpassword/);assert.match(actualSql,/'settings',coalesce\(to_jsonb\(s\.setconfig\),'\[\]'\)/);assert(!actualSql.includes('FROM pg_roles'));assert(!actualSql.includes('rolconfig'));
 // Exercise the actual full profile SQL construction with synthetic catalogue replies.
 const tables=Array.from({length:101},(_,i)=>({schema:'public',name:'synthetic_'+i,kind:'r'})),queries=[];
 const witness=await measurePreservedDatabase(async sql=>{queries.push(sql);if(sql.includes("'schema',n.nspname,'name',c.relname,'kind'"))return JSON.stringify(tables);if(sql.includes("'schemas',(SELECT"))return JSON.stringify({triggers:[],roles:[{name:'synthetic',settings:null}]});if(sql.includes('FROM public.orders'))return JSON.stringify([id]);return'[]';});
 assert.equal(witness.method,PRESERVED_WITNESS_METHOD);const profile=queries.find(sql=>sql.includes("'schemas',(SELECT"));assert.match(profile,/FROM pg_authid a LEFT JOIN pg_db_role_setting s ON s\.setrole=a\.oid AND s\.setdatabase=0/);assert.match(profile,/'settings',s\.setconfig/);assert.match(profile,/coalesce\(rolpassword/);assert(!profile.includes('rolconfig'));
});
