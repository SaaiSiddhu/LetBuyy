import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
import {loadNativeAuthSourceFreeze,readNativeAuthHistoricalSource,NATIVE_AUTH_FREEZE_MANIFEST} from '../../scripts/governance/native-auth-source-freeze.mjs';
import {sqlStatements} from '../../scripts/governance/definer-role-closure.mjs';
const source=fileURLToPath(new URL('../..',import.meta.url));
const declaration=readFileSync(join(source,NATIVE_AUTH_FREEZE_MANIFEST));
const manifest=JSON.parse(declaration);
test('native418 keeps every original business statement and adds only the approved ACL attestations',()=>{
    for(const [path,extra] of [[manifest.nativeMigration,3],['database/supabase/rollback/418_merchant_accounts_mobile_handoff.rollback.sql',1]]) {
        const before=execFileSync('git',['show',manifest.sourceCandidateRevision+':'+path],{cwd:source,encoding:'utf8'});
        const after=readFileSync(join(source,path),'utf8');
        const normalize=sql=>sqlStatements(sql).map(statement=>statement.map(token=>[token.kind,token.value]));
        const original=normalize(before),current=normalize(after),added=[];
        let cursor=0;
        for(const statement of current)if(JSON.stringify(statement)===JSON.stringify(original[cursor]))cursor++;else added.push(statement);
        assert.equal(cursor,original.length,'every original statement, including complete function bodies and native DDL, survives unchanged');
        assert.equal(added.length,extra,'only the finite approved attestations are additional SQL');
        assert.equal(added[0][0][1],'do');
        assert.ok(added[0].some(([kind,value])=>kind==='body'&&value.includes('418 native auth ACL')));
        for(const statement of added.slice(1)) {
            assert.equal(statement[0][1],'revoke');
            assert.ok(statement.some(([,value])=>['issue_gst_invoice','issue_gift_card'].includes(value)));
        }
    }
});
function fixture(run) {
    const root=mkdtempSync(join(tmpdir(),'native418-source-freeze-'));
    const write=(path,bytes)=>{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),bytes);};
    write(NATIVE_AUTH_FREEZE_MANIFEST,declaration);
    for(const entry of manifest.files)write(entry.preservedPath,readFileSync(join(source,entry.preservedPath)));
    write(manifest.nativeMigration,readFileSync(join(source,manifest.nativeMigration)));
    write('database/supabase/rollback/418_merchant_accounts_mobile_handoff.rollback.sql',readFileSync(join(source,'database/supabase/rollback/418_merchant_accounts_mobile_handoff.rollback.sql')));
    for(let n=73;n<=414;n++)write(`database/supabase/migrations/${n===414?'414_gift_card_issue_replay_integrity':String(n)+'_synthetic'}.sql`,'-- synthetic sequence only\n');
    try{return run(root,write);}finally{rmSync(root,{recursive:true,force:true});}
}
test('exact approved source freeze preserves all six SQL files and historical fixture lookup',()=>fixture(root=>{
    assert.equal(loadNativeAuthSourceFreeze(root).decisionId,manifest.decisionId);
    for(const entry of manifest.files)assert.equal(readNativeAuthHistoricalSource(root,entry.kind,entry.name),readFileSync(join(source,entry.preservedPath),'utf8'));
    assert.throws(()=>readNativeAuthHistoricalSource(root,'migrations','419_unknown.sql'),/Unknown held/);
    assert.throws(()=>readNativeAuthHistoricalSource(root,'migrations','../outside.sql'),/Invalid historical/);
}));
for(const mutation of ['changed declaration','changed preserved forward','missing DOWN','linked preservation','contradictory active migration','unreconciled future migration','undeclared preserved SQL'])test(mutation+' refuses the source freeze',()=>fixture((root,write)=>{
    const first=manifest.files[0],down=manifest.files.find(entry=>entry.kind==='rollback');
    if(mutation==='changed declaration')write(NATIVE_AUTH_FREEZE_MANIFEST,JSON.stringify({...manifest,gap:{after:414,before:419,heldVersions:[415,416,417,418]}}));
    if(mutation==='changed preserved forward')write(first.preservedPath,readFileSync(join(root,first.preservedPath),'utf8')+'\n-- changed\n');
    if(mutation==='missing DOWN')rmSync(join(root,down.preservedPath));
    if(mutation==='linked preservation'){rmSync(join(root,first.preservedPath));symlinkSync(join(source,first.preservedPath),join(root,first.preservedPath));}
    if(mutation==='contradictory active migration')write(first.originalPath,readFileSync(join(source,first.preservedPath)));
    if(mutation==='unreconciled future migration')write('database/supabase/migrations/419_unreviewed.sql','SELECT 1;');
    if(mutation==='undeclared preserved SQL')write('docs/implementation/native-signin-source-preservation/migrations/419_unreviewed.sql','SELECT 1;');
    assert.throws(()=>loadNativeAuthSourceFreeze(root));
}));
test('active runtime code cannot load preservation evidence',()=>fixture((root,write)=>{
    write('services/api-gateway/src/invalid.ts',"readFileSync('docs/implementation/native-signin-source-preservation/migrations/415_atomic_warehouse_commands.sql');");
    for(const args of [['init','-q'],['add','.']])assert.equal(spawnSync('git',args,{cwd:root}).status,0);
    const result=spawnSync(process.execPath,[join(source,'scripts/validators/sequential-migration-validator.mjs')],{cwd:root,encoding:'utf8',timeout:30_000});
    assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/Active code must not import/);
}));
test('real sequence validator accepts only the exact declared gap and still rejects an unrelated missing version',()=>fixture(root=>{
    const git=args=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
    git(['init','-q']);git(['add','.']);
    const run=()=>spawnSync(process.execPath,[join(source,'scripts/validators/sequential-migration-validator.mjs')],{cwd:root,encoding:'utf8',timeout:30_000});
    const positive=run();assert.equal(positive.status,0,positive.stderr+positive.stdout);
    rmSync(join(root,'database/supabase/migrations/412_synthetic.sql'));git(['add','-u']);
    const negative=run();assert.notEqual(negative.status,0);assert.match(negative.stdout+negative.stderr,/Migration sequence gap/);
}));
