import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {compileManagedMigration,compileManagedMigrationBatch,compileManagedJournalBatch} from '../../scripts/supabase/managed-migration-artifact.mjs';
import {verifiedManagedCatalogFences} from '../../scripts/governance/managed-catalog-fence.mjs';
import {sqlStatements} from '../../scripts/governance/definer-role-closure.mjs';

const name='353_approved_platform_job_recovery.sql';
const source=readFileSync('database/supabase/migrations/'+name,'utf8');
const admission=readFileSync('database/supabase/deploy/managed-migration-admission-v1.sql','utf8');
const digest=text=>createHash('sha256').update(text).digest('hex');

test('managed artifact preserves business SQL and identifies its different safety contract',()=>{
    const compiled=compileManagedMigration(source,name),fences=verifiedManagedCatalogFences(source);
    assert.equal(fences.length,1);
    assert.equal(compiled.receipt.adaptedFences,1);
    assert.equal(compiled.receipt.nativeCatalogExclusion,false);
    assert.equal(compiled.receipt.applicationTableLocks,true);
    assert.equal(compiled.receipt.sourceSha256,digest(source));
    assert.equal(compiled.receipt.executedSha256,digest(compiled.sql));
    assert.notEqual(compiled.receipt.sourceSha256,compiled.receipt.executedSha256);
    assert.equal(compiled.receipt.admissionSha256,digest(admission));
    assert.equal(compiled.sql.split(admission).length-1,2,'admission and pre-commit postcondition');
    const originalWithoutFences=source.slice(0,fences[0].from)+source.slice(fences[0].to);
    assert.equal(compiled.sql.replaceAll(admission,'').replace(/\n(?=COMMIT;\s*$)/,''),originalWithoutFences);
    assert.equal(readFileSync('database/supabase/migrations/'+name,'utf8'),source);
});

test('every existing reviewed admission block compiles without editing its source',()=>{
    let forward=0,rollback=0;
    for(const folder of ['migrations','rollback'])for(const file of readdirSync('database/supabase/'+folder)) {
        if(!file.endsWith('.sql'))continue;
        const text=readFileSync('database/supabase/'+folder+'/'+file,'utf8');
        if(!text.includes('DO $managed_catalog_fence$'))continue;
        const artifact=compileManagedMigration(text,file);
        assert.ok(artifact.receipt.adaptedFences>0,file);
        assert.doesNotMatch(artifact.sql,/PERFORM letbuyy_maintenance\.lock_catalogs_v1\(\)/);
        if(folder==='migrations')forward++;else rollback++;
    }
    assert.equal(forward,22);assert.equal(rollback,31);
});

for(const [before,after] of [
    ['AND r.rolsuper','AND true'],
    ['l.pid=pg_catalog.pg_backend_pid()','true'],
    ['PERFORM letbuyy_maintenance.lock_catalogs_v1();','RETURN; PERFORM letbuyy_maintenance.lock_catalogs_v1();'],
    ['IN SHARE ROW EXCLUSIVE MODE;','IN ACCESS SHARE MODE;'],
])test('unknown original fence refuses adaptation: '+before,()=>{
    assert.ok(source.includes(before));
    assert.throws(()=>compileManagedMigration(source.replace(before,after),name),/Unreviewed catalog-admission block/);
});

test('extra native catalog locks and incomplete transaction frames cannot enter an artifact',()=>{
    assert.throws(()=>compileManagedMigration(source.replace('BEGIN;','BEGIN; LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;'),name),/Unreviewed/);
    for(const changed of [source.replace('BEGIN;',''),source.replace('COMMIT;','ROLLBACK;'),source+'SELECT 1;',source.replace('COMMIT;','COMMIT; BEGIN; COMMIT;')]) {
        assert.throws(()=>compileManagedMigration(changed,name),/exactly one complete transaction/);
    }
});

test('an unchanged migration keeps the same source/executed hash and claims no application lock',()=>{
    const sql='BEGIN; SELECT 1; COMMIT;';
    const artifact=compileManagedMigration(sql,'000_synthetic_historical_baseline.sql');
    assert.equal(artifact.sql,sql);assert.equal(artifact.receipt.adaptedFences,0);
    assert.equal(artifact.receipt.sourceSha256,artifact.receipt.executedSha256);
    assert.equal(artifact.receipt.applicationTableLocks,false);
});

test('all current post-352 migrations receive admission and postconditions, including unwrapped refreshes',()=>{
    for(const file of readdirSync('database/supabase/migrations')) {
        if(!file.endsWith('.sql')||Number(file.slice(0,3))<353)continue;
        const text=readFileSync('database/supabase/migrations/'+file,'utf8');
        const artifact=compileManagedMigration(text,file);
        assert.equal(artifact.receipt.applicationTableLocks,true,file);
        assert.equal(artifact.sql.split(admission).length-1,2,file);
    }
});

test('388 records its one finite provider-role admission edit and refuses a changed original check',()=>{
    const file='388_cart_order_fact_snapshots.sql',text=readFileSync('database/supabase/migrations/'+file,'utf8');
    const artifact=compileManagedMigration(text,file);
    assert.equal(artifact.receipt.adaptedRoleChecks.length,1);
    assert.notEqual(artifact.receipt.adaptedRoleChecks[0].sourceSha256,artifact.receipt.adaptedRoleChecks[0].executedSha256);
    assert.throws(()=>compileManagedMigration(text.replace("pg_has_role(r.oid,'app_tenant','MEMBER')","false"),file),/Unreviewed backend-role admission/);
});

test('361 accepts only the exact provider CLI membership in both forward and rollback artifacts',()=>{
    for(const [folder,file] of [['migrations','361_collection_membership.sql'],['rollback','361_collection_membership.rollback.sql']]) {
        const text=readFileSync('database/supabase/'+folder+'/'+file,'utf8');
        const artifact=compileManagedMigration(text,file);
        assert.equal(artifact.receipt.adaptedRoleChecks.length,1);
        assert.match(artifact.sql,/member\.rolname='cli_login_postgres'/);
        assert.match(artifact.sql,/m\.grantor=to_regrole\('supabase_admin'\) AND NOT m\.admin_option AND NOT m\.inherit_option AND m\.set_option/);
        assert.throws(()=>compileManagedMigration(text.replace("OR member.rolname IN('anon','authenticated','service_role','app_tenant','authenticator')","OR true"),file),/Unreviewed backend-role admission/);
    }
});

test('batch records its exact bytes and one backend lease across historical commits',()=>{
    const artifact=compileManagedMigrationBatch([{name,source}],randomUUID());
    assert.equal(artifact.manifest.batchSha256,digest(artifact.sql));
    assert.equal(artifact.manifest.requiresSingleBackend,true);
    assert.equal(artifact.manifest.privilegedAdministratorDdlExcludedOperationally,true);
    assert.ok(artifact.sql.indexOf('pg_try_advisory_lock')<artifact.sql.indexOf('BEGIN;'));
    assert.ok(artifact.sql.indexOf('pg_advisory_unlock')>artifact.sql.lastIndexOf('COMMIT;'));
    assert.equal(artifact.manifest.migrations[0].sourceSha256,digest(source));
    assert.throws(()=>compileManagedMigrationBatch([{name,source},{name,source}],randomUUID()),/Duplicate/);
    assert.throws(()=>compileManagedMigrationBatch([{name,source}],"x'; SELECT 1; --"),/fresh maintenance UUID/);
    assert.throws(()=>compileManagedMigration(source,'../'+name),/canonical migration basename/);
});

test('journal requires observed history and exact direction, preserving actual executed bytes',()=>{
    const entries=[{name,source}],window=randomUUID(),history='a'.repeat(64);
    const artifact=compileManagedJournalBatch(entries,window,{expectedHistorySha256:history});
    assert.equal(artifact.manifest.batchSha256,digest(artifact.sql));
    assert.equal(artifact.manifest.journaled,true);
    assert.equal(artifact.manifest.migrations[0].sourceSha256,digest(source));
    assert.equal(artifact.manifest.migrations[0].executedSha256,digest(compileManagedMigration(source,name).sql));
    assert.match(artifact.sql,/LETBUYY_MANAGED_HISTORY_SNAPSHOT_CHANGED/);
    assert.match(artifact.sql,/INSERT INTO supabase_migrations.schema_migrations/);
    const insert=sqlStatements(artifact.sql).find(s=>s[0]?.value==='insert');
    assert.ok(insert.some(t=>t.kind==='string'&&t.value===compileManagedMigration(source,name).sql),'SQL in the journal is byte-identical after quoting, including dollar replacement patterns');
    assert.throws(()=>compileManagedJournalBatch(entries,window,{expectedHistorySha256:'x'}),/observed migration-history/);
    assert.throws(()=>compileManagedJournalBatch(entries,window,{expectedHistorySha256:history,direction:'down'}),/direction/);
    assert.throws(()=>compileManagedJournalBatch([{name:'353_synthetic.rollback.sql',source}],window,{expectedHistorySha256:history,direction:'down'}),/exact original forward/);
    assert.throws(()=>compileManagedJournalBatch([...entries,{name:'353_synthetic.sql',source}],window,{expectedHistorySha256:history}),/Duplicate migration history/);
    const unwrapped=compileManagedJournalBatch([{name:'000_synthetic.sql',source:'SELECT 1;'}],window,{expectedHistorySha256:history});
    assert.match(unwrapped.sql,/BEGIN;\nLOCK TABLE supabase_migrations/);
});
