import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claimOwnedNextDirectory, ownedNextDirectoryName, removeOwnedNextDirectory, validateOwnedNextDirectoryReceipt } from '../../scripts/governance/owned-next-directory.mjs';

function fixture(t) {
    const root=realpathSync(mkdtempSync(join(tmpdir(),'letbuyy-next-directory-')));
    const app=join(root,'apps/commerce/web');mkdirSync(app,{recursive:true});
    t.after(()=>rmSync(root,{recursive:true,force:true}));
    const owner={root,kind:'commerce-next',runId:'a1b2c3d4e5f6',supervisorPid:123456,parentPid:234567};
    const directory=join(app,'.next-session-runtime-123456-commerce-next');
    return {root,app,owner,directory,marker:`${directory}.owner.json`};
}

test('owned Next cleanup survives build replacement, removes nested output and is idempotent',t=>{
    const f=fixture(t),receipt=claimOwnedNextDirectory(f.owner);
    assert.equal(ownedNextDirectoryName(receipt),'.next-session-runtime-123456-commerce-next');
    assert.deepEqual(validateOwnedNextDirectoryReceipt(receipt,f.owner),receipt);
    // A real Next build removes/recreates its own output. Its adjacent proof stays.
    rmSync(f.directory,{recursive:true});mkdirSync(join(f.directory,'cache'),{recursive:true});
    writeFileSync(join(f.directory,'cache','build'),'disposable output');
    assert.equal(removeOwnedNextDirectory(receipt),true);
    assert.equal(existsSync(f.directory),false);assert.equal(existsSync(f.marker),false);
    assert.equal(removeOwnedNextDirectory(receipt),false);
});

test('owned Next allocation never reuses an existing directory or ownership marker',t=>{
    const f=fixture(t);mkdirSync(f.directory);writeFileSync(join(f.directory,'foreign'),'keep');
    assert.throws(()=>claimOwnedNextDirectory(f.owner),/existing/);
    assert.equal(readFileSync(join(f.directory,'foreign'),'utf8'),'keep');assert.equal(existsSync(f.marker),false);
    rmSync(f.directory,{recursive:true});writeFileSync(f.marker,'foreign',{mode:0o600});
    assert.throws(()=>claimOwnedNextDirectory(f.owner),/EEXIST/);
    assert.equal(readFileSync(f.marker,'utf8'),'foreign');assert.equal(existsSync(f.directory),false);
});

test('changed, missing or publicly readable Next ownership proof preserves output',t=>{
    const f=fixture(t),receipt=claimOwnedNextDirectory(f.owner);
    writeFileSync(f.marker,JSON.stringify({...receipt,runId:'ffffffffffff'}));
    assert.throws(()=>removeOwnedNextDirectory(receipt),/replaced/);assert.ok(existsSync(f.directory));
    writeFileSync(f.marker,JSON.stringify(receipt));chmodSync(f.marker,0o644);
    assert.throws(()=>removeOwnedNextDirectory(receipt),/private ownership/);assert.ok(existsSync(f.directory));
    rmSync(f.marker);
    assert.throws(()=>removeOwnedNextDirectory(receipt),/private ownership/);assert.ok(existsSync(f.directory));
});

test('Next cleanup refuses symlink replacement and preserves its target',t=>{
    const f=fixture(t),receipt=claimOwnedNextDirectory(f.owner),foreign=join(f.root,'foreign');
    mkdirSync(foreign);writeFileSync(join(foreign,'keep'),'untouched');
    rmSync(f.directory,{recursive:true});symlinkSync(foreign,f.directory,'dir');
    assert.throws(()=>removeOwnedNextDirectory(receipt),/replaced Next directory/);
    assert.equal(readFileSync(join(foreign,'keep'),'utf8'),'untouched');
    rmSync(f.directory);mkdirSync(f.directory);rmSync(f.marker);symlinkSync(join(foreign,'keep'),f.marker);
    assert.throws(()=>removeOwnedNextDirectory(receipt),/private ownership/);
    assert.equal(readFileSync(join(foreign,'keep'),'utf8'),'untouched');
});

test('Next receipts reject unsupported kinds, path injection and another supervisor binding',t=>{
    const f=fixture(t);
    for(const kind of ['../../foreign','console-next-production','lifecycle-probe','__proto__']) {
        assert.throws(()=>claimOwnedNextDirectory({...f.owner,kind}),/invalid/);
    }
    const receipt=claimOwnedNextDirectory(f.owner);
    for(const patch of [{supervisorPid:999999},{parentPid:999999},{runId:'ffffffffffff'},{kind:'identity-next'}]) {
        assert.throws(()=>validateOwnedNextDirectoryReceipt(receipt,{...f.owner,...patch}),/registered supervisor/);
    }
    assert.throws(()=>removeOwnedNextDirectory({...receipt,supervisorPid:'../../foreign'}),/invalid/);
    assert.ok(existsSync(f.directory));removeOwnedNextDirectory(receipt);
});
