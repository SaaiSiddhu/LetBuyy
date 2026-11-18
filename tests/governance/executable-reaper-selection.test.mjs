import { NODE_CLI_SHEBANG } from '../helpers/node-cli-shim.mjs';
// Recording-only controls. This file never invokes the real Docker executable.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {reapStaleClusters,parseReapRunIds,FIXTURE_LABEL,OWNER_PID_LABEL,RUN_ID_LABEL,ROLE_LABEL,DEFAULT_IMAGE} from '../../scripts/governance/executable-pg-fixture.mjs';
const OWN='a12345678901',OTHER='b12345678902',DEAD=123456789,LIVE=123456788;
const NOW=Date.parse('2026-10-18T00:00:00Z');
function world() {
    const calls=[],probes=[],records=new Map();let next=1;
    function add(kind,runId=OWN,changes={}) {
        const id=(next++).toString(16).padStart(64,'0'),name=`letbuyy-exec-reaper-${kind}-${next}`;
        const labels={[FIXTURE_LABEL]:'1',[OWNER_PID_LABEL]:String(DEAD),[RUN_ID_LABEL]:runId,[ROLE_LABEL]:kind==='container'?'postgres':kind};
        const item={Id:id,Name:kind==='container'?'/'+name:name,Created:new Date(NOW-3600000).toISOString(),CreatedAt:new Date(NOW-3600000).toISOString(),Labels:labels,Config:{Labels:labels,Image:DEFAULT_IMAGE},HostConfig:{Privileged:false,NetworkMode:'none',Binds:[]},Mounts:[],...changes};
        records.set(kind==='volume'?name:id,{kind,item});return item;
    }
    let forceForeign=false,relabelOnSecond=false,removeFails=false,discoveryFails=false,missingReply;const inspections=new Map();
    const find=(kind,id)=>[...records.values()].find(r=>r.kind===kind&&(r.item.Id===id||r.item.Name.replace(/^\//,'')===id));
    const docker=args=>{
        calls.push(args);
        const kind=args[0]==='ps'?'container':args[0]==='rm'?'container':args[0];
        if(args.includes('ls')||args[0]==='ps') {
            if(discoveryFails)return {status:1,stdout:'',stderr:'unavailable'};
            const scope=args.find(a=>a.startsWith(`label=${RUN_ID_LABEL}=`))?.split('=').at(-1);
            assert.ok(scope,'discovery must carry an exact run label');assert.ok(args.includes(`label=${FIXTURE_LABEL}=1`));
            const items=[...records.values()].filter(r=>r.kind===kind&&(forceForeign||r.item.Labels[RUN_ID_LABEL]===scope)&&r.item.Labels[FIXTURE_LABEL]==='1');
            return {status:0,stdout:items.map(r=>kind==='volume'?r.item.Name:r.item.Id).join('\n')};
        }
        if(args.includes('inspect')) {
            const id=args.at(-1),record=find(kind,id);if(!record)return missingReply?.(kind,id)??{status:1,stdout:'',stderr:`No such ${kind}: ${id}`};
            const count=(inspections.get(id)??0)+1;inspections.set(id,count);
            if(relabelOnSecond&&count>=2)record.item.Labels[RUN_ID_LABEL]=OTHER;
            return {status:0,stdout:JSON.stringify([record.item])};
        }
        if(args.includes('rm')||args[0]==='rm') {
            if(removeFails)return {status:1,stdout:'',stderr:'removal refused'};
            const record=find(kind,args.at(-1));if(record)records.delete(kind==='volume'?record.item.Name:record.item.Id);
            return {status:0,stdout:''};
        }
        throw Error('Unexpected recording command '+args.join(' '));
    };
    return {calls,probes,records,add,deps:{docker,now:()=>NOW,processAlive:pid=>{probes.push(pid);return pid===LIVE;}},set forceForeign(v){forceForeign=v;},set relabelOnSecond(v){relabelOnSecond=v;},set removeFails(v){removeFails=v;},set discoveryFails(v){discoveryFails=v;},set missingReply(v){missingReply=v;}};
}
const reap=w=>reapStaleClusters({runIds:[OWN],minAgeSeconds:0,detail:true},w.deps);

test('invalid or empty explicit scope fails before any discovery or deletion',()=>{
    for(const value of [[],null,'',new Set([OWN]),['*'],[''],[' '+OWN],[OWN.toUpperCase()],[123],Array(33).fill(OWN)]){
        const w=world();assert.throws(()=>reapStaleClusters({runIds:value},w.deps));assert.deepEqual(w.calls,[]);
    }
    const w=world();assert.throws(()=>reapStaleClusters({runIds:[OWN],minAgeSeconds:-1},w.deps));assert.deepEqual(w.calls,[]);
});
test('CLI selectors cannot silently fall back to global discovery',()=>{
    assert.deepEqual(parseReapRunIds(['--reap-only','--reap-run-id',OWN]),[OWN]);
    assert.deepEqual(parseReapRunIds(['--reap-only','--reap-run-id',OWN,'--reap-run-id',OWN]),[OWN]);
    for(const args of [['--reap-only','--reap-run-id'],['--reap-only','--reap-run-id','--no-reap'],['--reap-only','--reap-run-id='+OWN],['--reap-run-id',OWN],['--reap-only','--no-reap']])assert.throws(()=>parseReapRunIds(args));
    assert.equal(parseReapRunIds(['--no-reap']),undefined);
});
test('own dead resources are selected before discovery, removed in dependency order and verified absent',()=>{
    const w=world();for(const kind of ['container','network','volume'])w.add(kind);
    const result=reap(w);assert.equal(result.containers.length,1);assert.equal(result.networks.length,1);assert.equal(result.volumes.length,1);assert.deepEqual(result.failures,[]);assert.equal(w.records.size,0);
    const removes=w.calls.filter(a=>a[0]==='rm'||a[1]==='rm');assert.deepEqual(removes.map(a=>a[0]==='rm'?'container':a[0]),['container','network','volume']);
    assert.match(removes[0].at(-1),/^[0-9a-f]{64}$/);assert.match(removes[1].at(-1),/^[0-9a-f]{64}$/);assert.ok(!removes[0].includes('-v'),'run selection cannot implicitly delete unselected anonymous volumes');
});
test('foreign dead runs and unlabeled resources are neither inspected nor removed',()=>{
    const w=world(),foreign=w.add('container',OTHER),plain=w.add('container');plain.Labels[FIXTURE_LABEL]='0';w.add('container');
    assert.equal(reap(w).containers.length,1);assert.equal(w.records.size,2);
    assert.ok(!w.calls.some(a=>a.includes(foreign.Id)||a.includes(plain.Id)));
});
test('even a dishonest filtered listing cannot authorize a foreign run',()=>{
    const w=world();w.add('container',OTHER);w.forceForeign=true;assert.deepEqual(reap(w).containers,[]);assert.equal(w.records.size,1);assert.deepEqual(w.probes,[]);
});
test('valid selected live-owner resource is retained by the process liveness guard',()=>{
    const w=world(),item=w.add('container');item.Labels[OWNER_PID_LABEL]=String(LIVE);assert.deepEqual(reap(w).containers,[]);assert.deepEqual(w.probes,[LIVE]);
});
test('malformed owner PID, unknown liveness and future or young timestamps fail closed',()=>{
    for(const pid of ['','0','1','-2','1e3','2147483648',String(process.pid)]){const w=world();w.add('container').Labels[OWNER_PID_LABEL]=pid;assert.deepEqual(reap(w).containers,[]);}
    for(const date of ['invalid',new Date(NOW+1000).toISOString()]){const w=world();w.add('container').Created=date;assert.deepEqual(reap(w).containers,[]);}
    const w=world();w.add('container').Created=new Date(NOW-1000).toISOString();assert.deepEqual(reapStaleClusters({runIds:[OWN],minAgeSeconds:120,detail:true},w.deps).containers,[]);
    const unknown=world();unknown.add('container');unknown.deps.processAlive=()=>{throw Error('EPERM');};assert.deepEqual(reap(unknown).containers,[]);
});
test('every scoped container label, name, image and isolation condition is required',()=>{
    const mutations=[i=>{delete i.Labels[RUN_ID_LABEL];},i=>{i.Labels[ROLE_LABEL]='other';},i=>{i.Name='/supabase_db_protected';},i=>{i.Config.Image='supabase/postgres:16';},i=>{i.Config.Image='other:16';},i=>{i.HostConfig.Privileged=true;},i=>{i.HostConfig.NetworkMode='host';},i=>{i.HostConfig.Binds=['/private:/data'];},i=>{i.Mounts=[{Type:'bind'}];},i=>{i.Labels['com.supabase.project']='shared';}];
    for(const change of mutations){const w=world(),item=w.add('container');change(item);assert.deepEqual(reap(w).containers,[]);assert.equal(w.records.size,1);}
});
test('network and volume roles, names, run labels and owners are independently checked',()=>{
    for(const kind of ['network','volume'])for(const change of [i=>{i.Labels[ROLE_LABEL]='postgres';},i=>{i.Name='shared-resource';},i=>{i.Labels[OWNER_PID_LABEL]=String(LIVE);},i=>{i.Labels[RUN_ID_LABEL]=OTHER;}]){const w=world(),item=w.add(kind);change(item);assert.equal(reap(w)[kind==='network'?'networks':'volumes'].length,0);assert.equal(w.records.size,1);}
});
test('selection is revalidated immediately before deletion',()=>{
    const w=world();w.add('container');w.relabelOnSecond=true;assert.deepEqual(reap(w).containers,[]);assert.equal(w.records.size,1);assert.ok(!w.calls.some(a=>a[0]==='rm'));
});
test('Docker discovery/removal errors remain explicit failures rather than false cleanup',()=>{
    for(const field of ['discoveryFails','removeFails']){const w=world();w.add('container');w[field]=true;const result=reap(w);assert.ok(result.failures.length);assert.equal(w.records.size,1);}
});
test('proposed CLI validates scopes and publishes a new ownership receipt before any Docker probe',()=>{
    const source=readFileSync(new URL('../../scripts/governance/run-executable-suites.mjs',import.meta.url),'utf8');
    assert.ok(source.indexOf('const reapRunIds = parseReapRunIds(args)')>=0);
    assert.ok(source.indexOf('const reapRunIds = parseReapRunIds(args)')<source.indexOf("realDaemon = docker(['info']"));
    assert.ok(source.indexOf('writeFileSync(path, JSON.stringify({ runId, runnerPid: process.pid')<source.indexOf("realDaemon = docker(['info']"));
    assert.match(source,/flag: 'wx', mode: 0o600/);
});

// A PATH recording stub, never the system Docker binary, exercises actual CLI ordering.
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
function recordedCli(args,prepare=()=>{}) {
    const dir=mkdtempSync(join(tmpdir(),'letbuyy-reap-cli-'));
    const trace=join(dir,'calls.jsonl'),receipt=join(dir,'receipt.json');
    writeFileSync(join(dir,'docker'),`${NODE_CLI_SHEBANG}const fs=require('node:fs');fs.appendFileSync(process.env.REAP_TEST_TRACE,JSON.stringify({args:process.argv.slice(2),receiptExists:fs.existsSync(process.env.REAP_TEST_RECEIPT)})+'\\n');process.exit(93);\n`,{mode:0o755});
    try {
        prepare({dir,receipt});
        const run=spawnSync(process.execPath,[fileURLToPath(new URL('../../scripts/governance/run-executable-suites.mjs',import.meta.url)),...args({dir,receipt})],{encoding:'utf8',env:{...process.env,PATH:dir+':'+process.env.PATH,REAP_TEST_TRACE:trace,REAP_TEST_RECEIPT:receipt},timeout:15000});
        return {run,calls:existsSync(trace)?readFileSync(trace,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[],receipt:existsSync(receipt)?readFileSync(receipt,'utf8'):null};
    }finally{rmSync(dir,{recursive:true,force:true});}
}
test('actual proposed CLI rejects malformed explicit scopes before the recording Docker is invoked',()=>{
    for(const options of [['--reap-only','--reap-run-id'],['--reap-only','--reap-run-id','*'],['--reap-only','--reap-run-id='+OWN],['--reap-only','--no-reap'],['--no-reap','--reap-run-id',OWN]]){
        const {run,calls}=recordedCli(()=>options);assert.equal(run.status,70,run.stderr);assert.match(run.stderr,/reap-run-id|cannot be combined/);assert.deepEqual(calls,[]);
    }
});
test('actual proposed CLI publishes its ownership receipt before every recording Docker call',()=>{
    const result=recordedCli(({dir,receipt})=>['--suite',join(dir,'a.test.mjs'),'--no-reap','--json','--run-receipt',receipt],({dir})=>writeFileSync(join(dir,'a.test.mjs'),"import test from 'node:test';test('unit',()=>{});"));
    assert.equal(result.run.status,70,result.run.stderr);assert.ok(result.calls.length);assert.ok(result.calls.every(c=>c.receiptExists));
    const receipt=JSON.parse(result.receipt);assert.equal(receipt.runnerPid,result.run.pid);assert.match(receipt.runId,/^[0-9a-f]{12}$/);
});
test('an existing receipt is never overwritten and prevents all recording Docker calls',()=>{
    const result=recordedCli(({dir,receipt})=>['--suite',join(dir,'a.test.mjs'),'--no-reap','--run-receipt',receipt],({dir,receipt})=>{writeFileSync(join(dir,'a.test.mjs'),"import test from 'node:test';test('unit',()=>{});");writeFileSync(receipt,'preserved-original');});
    assert.equal(result.run.status,70);assert.deepEqual(result.calls,[]);assert.equal(result.receipt,'preserved-original');
});

import {runInNewContext} from 'node:vm';
import {mkdirSync,renameSync} from 'node:fs';
import {basename} from 'node:path';
function journalWorld({inspectFailure=false,foreignAllocation=false,volumeLabels=null,volumeInspectFailure=false}={}) {
    const dir=mkdtempSync(join(tmpdir(),'letbuyy-case-journal-')),caseDir=join(dir,'case'),journals=join(dir,'journals');mkdirSync(caseDir);
    const calls=[],spawnCalls=[];let item,volumePresent=false,replaceVolume=false,failInspect=inspectFailure,failVolumeInspect=volumeInspectFailure,currentVolumeLabels=volumeLabels,plannedBeforeCreate=false,plannedBeforeSpawn=false;
    const journal=join(journals,'case.ownership.json'),read=()=>JSON.parse(readFileSync(journal,'utf8'));
    const docker=args=>{
        calls.push(args);
        if(args[0]==='run'){
            const plan=read().containers.at(-1);plannedBeforeCreate=!!plan?.allocation&&!plan.id;
            const name=args[args.indexOf('--name')+1],allocation=args.find(a=>a.startsWith('com.letbuyy.lifecycle-test-allocation='))?.split('=').at(-1);
            item={Id:'c'.repeat(64),Name:'/'+name,Config:{Image:DEFAULT_IMAGE,Labels:{'com.letbuyy.lifecycle-test-allocation':foreignAllocation?'foreign':allocation}},Mounts:[{Type:'volume',Name:'d'.repeat(64)}]};volumePresent=true;
            return {status:0,stdout:item.Id};
        }
        if(args[0]==='container'&&args[1]==='inspect'){
            if(failInspect){failInspect=false;throw Error('controlled inspect failure');}
            return item?{status:0,stdout:JSON.stringify([item])}:{status:1,stdout:'',stderr:'No such container'};
        }
        if(args[0]==='rm'){assert.equal(args.at(-1),item.Id);assert.ok(!args.includes('-v'));item=undefined;return {status:0,stdout:''};}
        if(args[0]==='volume'&&args[1]==='inspect') {
            if(failVolumeInspect){failVolumeInspect=false;return {status:93,stdout:'',stderr:'controlled anonymous volume inspect failure'};}
            return volumePresent?{status:0,stdout:JSON.stringify([{Name:'d'.repeat(64),CreatedAt:replaceVolume?'2026-10-18T01:00:00Z':'2026-10-18T00:00:00Z',Driver:'local',Scope:'local',Labels:currentVolumeLabels,Options:null}])}:{status:1,stdout:'',stderr:'No such volume'};
        }
        if(args[0]==='volume'&&args[1]==='rm'){assert.equal(args.at(-1),'d'.repeat(64));volumePresent=false;return {status:0,stdout:''};}
        if(args[0]==='ps'||args.includes('ls')){assert.ok(args.includes(`label=${RUN_ID_LABEL}=${OWN}`));return {status:0,stdout:''};}
        throw Error('Unexpected case recording call '+args.join(' '));
    };
    const spawnSync=(command,args)=>{
        spawnCalls.push(args);
        if(args.includes('--reap-only')){assert.ok(args.includes('--reap-run-id'));assert.ok(args.includes(OWN));return {status:0,stdout:'{}',pid:DEAD};}
        const plan=read().runners.at(-1);plannedBeforeSpawn=!!plan?.receipt&&plan.pid===null;
        assert.ok(args.includes('--no-reap'));writeFileSync(plan.receipt,JSON.stringify({runId:OWN,runnerPid:DEAD,containerBase:'letbuyy-exec-recording'}));return {status:0,pid:DEAD,stdout:'{}'};
    };
    const source=readFileSync(new URL('./executable-runner-lifecycle.test.mjs',import.meta.url),'utf8');
    const helper=source.match(/^function lifecycleCase\(dir\) \{[\s\S]*?^\}/m)[0];
    const make=runInNewContext(helper+'\nlifecycleCase;',{assert,join,basename,mkdirSync,writeFileSync,readFileSync,renameSync,docker,spawnSync,spawn:()=>{throw Error('async spawn not used in recording control');},until:async predicate=>{assert.ok(predicate());},newRunId:()=>OWN,POSTGRES_LIMITS:{memory:'1g',cpus:'2',pids:'512'},DEFAULT_IMAGE,RUN_ID_LABEL,RUN_ID_PATTERN:/^[0-9a-f]{12}$/,runner:'/recording-only/runner.mjs',repoRoot:'/recording-only',process:{pid:654321,env:{LETBUYY_LIFECYCLE_RECEIPTS_DIR:journals}}});
    const owned=make(caseDir);
    return {owned,calls,spawnCalls,read,dir,caseDir,journals,set replaceVolume(value){replaceVolume=value;},set volumeLabels(value){currentVolumeLabels=value;},reapedContainer:()=>{item=undefined;},get plannedBeforeCreate(){return plannedBeforeCreate;},get plannedBeforeSpawn(){return plannedBeforeSpawn;},dispose:()=>rmSync(dir,{recursive:true,force:true})};
}
test('recording seams require explicit scope and cannot accidentally enter the legacy real-Docker path',()=>{
    const w=world();assert.throws(()=>reapStaleClusters({},w.deps),/explicit.*scope/);assert.deepEqual(w.calls,[]);
});
test('allocation nonce is journaled before create and CID before the first fallible inspect',async()=>{
    const w=journalWorld({inspectFailure:true});
    try{
        assert.throws(()=>w.owned.sleeper('letbuyy-exec-recorded',[]),/controlled inspect failure/);
        assert.ok(w.plannedBeforeCreate);const entry=w.read().containers[0];assert.equal(entry.id,'c'.repeat(64));assert.equal(entry.creationAcknowledged,true);assert.equal(entry.mountsVerified,false);
        await w.owned.cleanup();assert.equal(w.read().status,'cleaned');
    }finally{w.dispose();}
});
test('case cleanup uses exact captured IDs and persists outside the disposable suite directory',async()=>{
    const w=journalWorld();
    try{
        w.owned.sleeper('letbuyy-exec-recorded',[]);await w.owned.cleanup();rmSync(w.caseDir,{recursive:true,force:true});
        assert.equal(w.read().status,'cleaned');assert.equal(w.read().containers[0].volumes[0].Name,'d'.repeat(64));assert.ok(w.calls.some(args=>args[0]==='volume'&&args[1]==='rm'&&args.at(-1)==='d'.repeat(64)));
        assert.ok(w.calls.some(args=>args[0]==='rm'&&args.at(-1)==='c'.repeat(64)));
        assert.ok(!w.calls.find(args=>args[0]==='run').some(arg=>arg.startsWith(FIXTURE_LABEL+'=')),'unlabeled control still lacks canonical fixture ownership label');
    }finally{w.dispose();}
});
test('same name or changed allocation token never authorizes case cleanup',async()=>{
    const w=journalWorld({foreignAllocation:true});
    try{
        assert.throws(()=>w.owned.sleeper('letbuyy-exec-recorded',[]),/matching name alone/);
        await assert.rejects(w.owned.cleanup());assert.equal(w.read().status,'cleanup_failed');assert.ok(!w.calls.some(args=>args[0]==='rm'));
    }finally{w.dispose();}
});
test('runner receipt path is persisted before spawn, then only its generated run ID is selected',async()=>{
    const w=journalWorld();
    try{
        w.owned.sync(['--suite','recording-only']);assert.ok(w.plannedBeforeSpawn);assert.equal(w.read().runners[0].pid,DEAD);
        await w.owned.cleanup();assert.equal(w.read().status,'cleaned');
        assert.ok(w.spawnCalls.some(args=>args.includes('--reap-only')&&args.includes(OWN)));
    }finally{w.dispose();}
});
test('case cleanup is idempotent for concurrent finally callers',async()=>{
    const w=journalWorld();
    try{
        w.owned.sleeper('letbuyy-exec-recorded',[]);const first=w.owned.cleanup(),second=w.owned.cleanup();assert.equal(first,second);await Promise.all([first,second]);
        assert.equal(w.calls.filter(args=>args[0]==='rm').length,1);assert.equal(w.read().status,'cleaned');
    }finally{w.dispose();}
});


test('generated runner receipts and observed run identities survive removal of the disposable suite directory',async()=>{
    const w=journalWorld();
    try{
        w.owned.sync(['--suite','recording-only']);await w.owned.cleanup();rmSync(w.caseDir,{recursive:true,force:true});
        const record=w.read().runners[0];assert.equal(record.runId,OWN);assert.equal(record.containerBase,'letbuyy-exec-recording');
        assert.ok(record.receipt.startsWith(w.journals+'/'));assert.equal(JSON.parse(readFileSync(record.receipt,'utf8')).runId,OWN);
        assert.equal(w.read().status,'cleaned');
    }finally{w.dispose();}
});
test('changed captured anonymous volume metadata remains red and never authorizes deletion',async()=>{
    const w=journalWorld();
    try{
        w.owned.sleeper('letbuyy-exec-recorded',[]);w.replaceVolume=true;
        await assert.rejects(w.owned.cleanup());assert.equal(w.read().status,'cleanup_failed');
        assert.ok(!w.calls.some(args=>args[0]==='volume'&&args[1]==='rm'));
        assert.ok(!w.calls.some(args=>args[0]==='rm'),'do not discard container evidence after mount identity drift');
    }finally{w.dispose();}
});


test('after selected reaping removes a direct fixture, finally still revalidates and removes its captured anonymous volume',async()=>{
    const w=journalWorld();
    try{
        w.owned.sleeper('letbuyy-exec-recorded',[]);w.reapedContainer();await w.owned.cleanup();
        assert.equal(w.read().status,'cleaned');assert.ok(!w.calls.some(args=>args[0]==='rm'));
        assert.ok(w.calls.some(args=>args[0]==='volume'&&args[1]==='rm'&&args.at(-1)==='d'.repeat(64)));
    }finally{w.dispose();}
});


const builtinAnonymousVolumeLabel={'com.docker.volume.anonymous':''};
test('direct fixture cleanup accepts empty labels or the exact Docker built-in anonymous label and preserves the full snapshot',async()=>{
    for(const labels of [null,{},builtinAnonymousVolumeLabel]) {
        const w=journalWorld({volumeLabels:labels});
        try {
            assert.equal(w.owned.sleeper('letbuyy-exec-recorded',[]).status,0);
            assert.deepEqual(w.read().containers[0].volumes[0].Labels,labels??{});
            await w.owned.cleanup();assert.equal(w.read().status,'cleaned');
            assert.deepEqual(w.read().containers[0].volumes[0].Labels,labels??{});
            assert.ok(w.calls.some(args=>args[0]==='volume'&&args[1]==='rm'&&args.at(-1)==='d'.repeat(64)));
        }finally{w.dispose();}
    }
});
test('unknown anonymous-volume labels, nonempty built-in values and changed labels never authorize cleanup',async()=>{
    for(const labels of [{'com.docker.volume.anonymous':'foreign'},{'com.docker.volume.anonymous':'',foreign:'value'},{foreign:''},[],false,'unknown']) {
        const w=journalWorld({volumeLabels:labels});
        try {
            assert.throws(()=>w.owned.sleeper('letbuyy-exec-recorded',[]));
            await assert.rejects(w.owned.cleanup());assert.equal(w.read().status,'cleanup_failed');
            assert.ok(!w.calls.some(args=>args[0]==='rm'||args[0]==='volume'&&args[1]==='rm'));
        }finally{w.dispose();}
    }
    const w=journalWorld({volumeLabels:builtinAnonymousVolumeLabel});
    try {
        w.owned.sleeper('letbuyy-exec-recorded',[]);w.volumeLabels={...builtinAnonymousVolumeLabel,foreign:'changed'};
        await assert.rejects(w.owned.cleanup());assert.equal(w.read().status,'cleanup_failed');
        assert.deepEqual(w.read().containers[0].volumes[0].Labels,builtinAnonymousVolumeLabel);
        assert.ok(!w.calls.some(args=>args[0]==='rm'||args[0]==='volume'&&args[1]==='rm'));
    }finally{w.dispose();}
});
test('a change between two individually allowed label shapes is still captured-identity drift',async()=>{
    for(const [before,after] of [[{},builtinAnonymousVolumeLabel],[builtinAnonymousVolumeLabel,{}]]) {
        const w=journalWorld({volumeLabels:before});
        try {
            w.owned.sleeper('letbuyy-exec-recorded',[]);w.volumeLabels=after;
            await assert.rejects(w.owned.cleanup());assert.equal(w.read().status,'cleanup_failed');
            assert.deepEqual(w.read().containers[0].volumes[0].Labels,before);
            assert.ok(!w.calls.some(args=>args[0]==='rm'||args[0]==='volume'&&args[1]==='rm'));
        }finally{w.dispose();}
    }
});
test('an acknowledged fixture with the built-in label recovers exact cleanup after an anonymous-volume inspect fault',async()=>{
    const w=journalWorld({volumeLabels:builtinAnonymousVolumeLabel,volumeInspectFailure:true});
    try {
        assert.throws(()=>w.owned.sleeper('letbuyy-exec-recorded',[]),/own anonymous volume inspection must succeed/);
        const entry=w.read().containers[0];assert.equal(entry.id,'c'.repeat(64));assert.equal(entry.creationAcknowledged,true);assert.equal(entry.mountsVerified,false);
        await w.owned.cleanup();assert.equal(w.read().status,'cleaned');
        assert.deepEqual(w.read().containers[0].volumes[0].Labels,builtinAnonymousVolumeLabel);
        assert.ok(w.calls.some(args=>args[0]==='rm'&&args.at(-1)==='c'.repeat(64)&&!args.includes('-v')));
        assert.ok(w.calls.some(args=>args[0]==='volume'&&args[1]==='rm'&&args.at(-1)==='d'.repeat(64)));
    }finally{w.dispose();}
});


test('scoped network removal recognizes the exact Docker missing-network response for the requested immutable ID',()=>{
    for(const ending of ['', '\n', '\r\n']) {
        const w=world(),network=w.add('network');
        w.missingReply=(kind,id)=>{assert.equal(kind,'network');assert.equal(id,network.Id);return {status:1,stdout:'[]',stderr:`Error response from daemon: network ${id} not found${ending}`};};
        const result=reap(w);assert.deepEqual(result.networks,[network.Name]);assert.deepEqual(result.failures,[]);assert.equal(w.records.size,0);
    }
});
test('different network handles, denied access, unavailable daemons and extra error text never prove absence',()=>{
    const messages=[
        id=>`Error response from daemon: network ${id.slice(0,-1)}f not found`,
        id=>`Error response from daemon: network ${id.slice(0,12)} not found`,
        id=>`prefix Error response from daemon: network ${id} not found`,
        id=>`Error response from daemon: network ${id} not found; permission denied`,
        id=>`Error response from daemon: network ${id} not found\npermission denied`,
        id=>`Error response from daemon: network ${id} not found\n\n`,
        ()=> 'permission denied while trying to connect to the Docker daemon socket',
        ()=> 'Cannot connect to the Docker daemon. Is the docker daemon running?',
    ];
    for(const message of messages) {
        const w=world();w.add('network');w.missingReply=(_,id)=>({status:1,stdout:'[]',stderr:message(id)});
        const result=reap(w);assert.deepEqual(result.networks,[]);assert.equal(result.failures.length,1,'removal absence must remain unverified');
    }
});
test('the Docker network-specific missing format cannot verify a container or volume removal',()=>{
    for(const kind of ['container','volume']) {
        const w=world();w.add(kind);w.missingReply=(_,id)=>({status:1,stdout:'[]',stderr:`Error response from daemon: network ${id} not found`});
        const result=reap(w);assert.deepEqual(result[kind==='container'?'containers':'volumes'],[]);assert.equal(result.failures.length,1);
    }
});
test('known missing text in stdout, success warnings or nonstandard exit status are not the exact Docker absence response',()=>{
    for(const reply of [
        id=>({status:1,stdout:`Error response from daemon: network ${id} not found`,stderr:''}),
        id=>({status:0,stdout:'[]',stderr:`Error response from daemon: network ${id} not found`}),
        id=>({status:2,stdout:'[]',stderr:`Error response from daemon: network ${id} not found`}),
        id=>({status:null,stdout:'[]',stderr:`Error response from daemon: network ${id} not found`}),
    ]) {
        const w=world();w.add('network');w.missingReply=(_,id)=>reply(id);
        const result=reap(w);assert.deepEqual(result.networks,[]);assert.equal(result.failures.length,1);
    }
});
