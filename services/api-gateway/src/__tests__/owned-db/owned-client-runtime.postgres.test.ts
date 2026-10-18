// N1.1: actual owned fixture -> controlled supervisor -> real synthetic processes.
// Negative scopes, graceful/forced stop, supervisor loss and owner death must clean descendants.
import assert from 'node:assert/strict';
import test from 'node:test';
import { requireOwnedDatabase, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from './owned-db-support';

const owned = requireOwnedDatabase();
const alive = (pid:number) => { try { process.kill(pid,0); return true; } catch { return false; } };
const delay = (ms:number) => new Promise(resolve => setTimeout(resolve,ms));
async function gone(pid:number) {
    const end=Date.now()+12000;
    while (alive(pid) && Date.now()<end) await delay(50);
    assert.equal(alive(pid),false,`owned process ${pid} did not stop`);
}
function outputOf(child:OwnedClientProcess) {
    const output={stdout:'',stderr:'',child};
    child.stdout.on('data',chunk => { output.stdout=(output.stdout+chunk.toString()).slice(-12000); });
    child.stderr.on('data',chunk => { output.stderr=(output.stderr+chunk.toString()).slice(-12000); });
    return output;
}
async function waitFor(output:{stdout:string;stderr:string;child:OwnedClientProcess}, expression:RegExp) {
    const end=Date.now()+20000;
    while (!expression.test(output.stdout) && Date.now()<end) {
        if (output.child.exitCode!==null || output.child.signalCode!==null) assert.fail(output.stderr || 'owned client stopped before its positive control');
        await delay(50);
    }
    assert.match(output.stdout,expression,output.stderr);
    return output.stdout;
}

test('unapproved command, forged database handle and invalid port refuse before launch',() => {
    assert.throws(() => startOwnedClientRuntime(owned,'arbitrary-command' as never,{env:{}}),/unapproved/);
    assert.throws(() => startOwnedClientRuntime({...owned},'lifecycle-probe',{env:{}}),/verified database handle/);
    assert.throws(() => startOwnedClientRuntime(owned,'commerce-next',{port:0,env:{}}),/invalid local Next port/);
    assert.throws(() => startOwnedClientRuntime(owned,'commerce-next-production',{port:0,env:{}}),/invalid local Next port/);
    assert.throws(() => startOwnedClientRuntime(owned,'identity-next-production',{port:0,env:{}}),/invalid local Next port/);
    assert.throws(() => startOwnedClientRuntime(owned,'console-next',{port:0,env:{}}),/invalid local Next port/);
    assert.throws(() => startOwnedClientRuntime(owned,'lifecycle-probe',{env:{NODE_OPTIONS:'--require synthetic-unapproved-loader'}}),/loader overrides/);
});

test('a hosted API override is refused; explicit database overrides cannot escape the verified fixture',async () => {
    for (const [kind, variable] of [
        ['lifecycle-probe','LETBUYY_API_URL'], ['commerce-next-production','LETBUYY_API_URL'],
        ['identity-next-production','LETBUYY_API_URL'], ['console-next','LETBUYY_API_URL'],
        ['console-next','PLATFORM_CONSOLE_API_BASE_URL'],
    ] as const) {
        const invalid=startOwnedClientRuntime(owned,kind,{port:32123,env:{[variable]:'https://unowned.example.invalid/v1'}});
        const refused=outputOf(invalid);
        try {
            const code=await new Promise(resolve => invalid.once('close',resolve));
            assert.equal(code,70,refused.stderr);
            assert.ok(refused.stderr.includes(`requires a loopback ${variable}`),refused.stderr);
            assert.equal(refused.stdout,'','the client and production build must never start');
        } finally { await stopOwnedClientRuntime(invalid); }
    }
    process.env.LETBUYY_RUNTIME_AMBIENT_CREDENTIAL='synthetic-do-not-inherit';
    const child=startOwnedClientRuntime(owned,'lifecycle-probe',{env:{SUPABASE_URL:'https://unowned.example.invalid'}});
    const output=outputOf(child);
    let pid=0;
    try {
        const text=await waitFor(output,/"probePid":\d+/);
        const probe=JSON.parse(text.trim());pid=probe.probePid;
        assert.equal(probe.databaseUrlMatches,true);
        assert.equal(probe.ambientCredentialAbsent,true);
        assert.equal(alive(pid),true,'positive control: the owned process is running');
    } finally { delete process.env.LETBUYY_RUNTIME_AMBIENT_CREDENTIAL;await stopOwnedClientRuntime(child); }
    await gone(pid);
});

test('forced termination and a killed supervisor leave no owned client process',async () => {
    for (const killSupervisor of [false,true]) {
        const child=startOwnedClientRuntime(owned,'lifecycle-probe',{env:{LETBUYY_RUNTIME_PROBE_HOLD:'1'}});
        const output=outputOf(child);
        let pid=0;
        try {
            const text=await waitFor(output,/"probePid":\d+/);pid=JSON.parse(text.trim()).probePid;
            assert.equal(alive(pid),true);
            // IPC is emitted before probe output; this deliberately kills only the
            // supervisor created by this helper, testing its owner's fallback.
            if (killSupervisor) child.kill('SIGKILL');
        } finally { await stopOwnedClientRuntime(child); }
        await gone(pid);
    }
});

test('an abruptly killed owner is detected by its nested supervisor, which removes the descendant',async () => {
    const owner=startOwnedClientRuntime(owned,'lifecycle-probe',{env:{LETBUYY_RUNTIME_PROBE_NESTED:'1'}});
    const output=outputOf(owner);
    let nestedPid=0;
    let nestedSupervisor=0;
    try {
        const text=await waitFor(output,/NESTED_SUPERVISOR:\d+[\s\S]*"probePid":\d+/);
        nestedSupervisor=Number(text.match(/NESTED_SUPERVISOR:(\d+)/)![1]);
        nestedPid=JSON.parse(text.split('\n').find(line=>line.startsWith('{'))!).probePid;
        const ownerPid=await new Promise<number>(resolve => {
            // The owner startup message may already have arrived; expose its
            // exact child pid in the probe's output rather than guessing by name.
            const match=output.stdout.match(/OWNER_PID:(\d+)/);
            if (match) resolve(Number(match[1]));
            else owner.on('message',message => { const m=message as {type?:string;pid?:number};if(m.type==='owned-client-started'&&m.pid)resolve(m.pid); });
        });
        assert.equal(alive(nestedPid),true);
        process.kill(ownerPid,'SIGKILL');
        await gone(nestedPid);await gone(nestedSupervisor);
    } finally { await stopOwnedClientRuntime(owner); }
});
