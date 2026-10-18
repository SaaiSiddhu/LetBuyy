import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,writeFileSync,chmodSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {preparedTransactionArgs} from '../../scripts/governance/executable-pg-fixture.mjs';
const moduleUrl=new URL('../../scripts/governance/executable-pg-fixture.mjs',import.meta.url).href;
const fixtureArgs={name:'letbuyy-exec-prepared-recording',database:'synthetic_prepared',network:'synthetic_net',volume:'synthetic_volume',runId:'synthetic-run'};
function run(value,{plain=false,disableJit=false}={}) {
    const dir=mkdtempSync(join(tmpdir(),'n9-346-prepared-recording-')),log=join(dir,'argv.json');
    const fake=join(dir,'docker');
    writeFileSync(fake,`#!${process.execPath}\nimport {writeFileSync} from 'node:fs';writeFileSync(process.env.N9_ARGV_FILE,JSON.stringify(process.argv.slice(2)));process.stdout.write('synthetic-container-id\\n');\n`);chmodSync(fake,0o755);
    const env={...process.env,PATH:dir+':'+process.env.PATH,N9_ARGV_FILE:log,LETBUYY_EXECUTABLE_PG_IMAGE:'postgres:16-alpine'};
    delete env.LETBUYY_EXECUTABLE_PREPARED_TRANSACTIONS;if(value!==undefined)env.LETBUYY_EXECUTABLE_PREPARED_TRANSACTIONS=value;
    const result=spawnSync(process.execPath,['--input-type=module','-e',`import {startCluster} from ${JSON.stringify(moduleUrl)};startCluster(${JSON.stringify({...fixtureArgs,plain,disableJit})});`],{env,encoding:'utf8',timeout:10000});
    return {pid:result.pid,status:result.status,stderr:result.stderr,args:existsSync(log)?JSON.parse(readFileSync(log,'utf8')):[]};
}
test('bounded opt-in is literal-only; missing retains default',()=>{
    assert.deepEqual(preparedTransactionArgs({}),[]);assert.deepEqual(preparedTransactionArgs({LETBUYY_EXECUTABLE_PREPARED_TRANSACTIONS:'2'}),['-c','max_prepared_transactions=2']);
    for(const value of ['', '0','1','02','3','-1','true','2\n',2,null])assert.throws(()=>preparedTransactionArgs({LETBUYY_EXECUTABLE_PREPARED_TRANSACTIONS:value}),/exactly 2/);
});
test('recording-only Docker argv adds only bounded server flags after image; caps/labels/mounts identical',()=>{
    const baseline=run(undefined),enabled=run('2');assert.equal(baseline.status,0,baseline.stderr);assert.equal(enabled.status,0,enabled.stderr);
    assert.ok(baseline.args.includes('com.letbuyy.executable-fixture.owner-pid='+baseline.pid));assert.ok(enabled.args.includes('com.letbuyy.executable-fixture.owner-pid='+enabled.pid));
    const normalize=args=>args.map(value=>value.startsWith('com.letbuyy.executable-fixture.owner-pid=')?'com.letbuyy.executable-fixture.owner-pid=<validated-child-pid>':value);
    assert.deepEqual(normalize(enabled.args),[...normalize(baseline.args),'-c','max_prepared_transactions=2']);assert.equal(baseline.args.at(-1),'postgres:16-alpine');
    for(const [flag,value] of [['--pull','never'],['--memory','1g'],['--memory-swap','1g'],['--cpus','2'],['--pids-limit','512']])assert.equal(enabled.args[enabled.args.indexOf(flag)+1],value);
    assert.ok(enabled.args.includes('com.letbuyy.executable-fixture.run-id=synthetic-run'));assert.ok(enabled.args.includes('type=volume,source=synthetic_volume,target=/var/lib/postgresql/data'));
});
test('unknown configuration and shim mode fail before recording any Docker call',()=>{
    const invalid=run('3');assert.notEqual(invalid.status,0);assert.deepEqual(invalid.args,[]);
    const shim=run('2',{plain:true});assert.notEqual(shim.status,0);assert.deepEqual(shim.args,[]);
});

test('owned catalog proof can disable LLVM compilation without changing limits, identity or SQL semantics',()=>{
    const ordinary=run('2'),bounded=run('2',{disableJit:true});
    assert.equal(ordinary.status,0,ordinary.stderr);assert.equal(bounded.status,0,bounded.stderr);
    const normalize=args=>args.map(v=>v.startsWith('com.letbuyy.executable-fixture.owner-pid=')?'com.letbuyy.executable-fixture.owner-pid=<child>':v);
    assert.deepEqual(normalize(bounded.args),[...normalize(ordinary.args),'-c','jit=off']);
    const invalid=run('2',{disableJit:'arbitrary-server-option'});assert.notEqual(invalid.status,0);assert.deepEqual(invalid.args,[]);
});
