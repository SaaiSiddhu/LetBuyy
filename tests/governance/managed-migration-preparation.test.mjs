import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync,spawnSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';

test('offline preparation binds exact committed source and refuses dirty, ambiguous or unacknowledged input',()=>{
    const workspace=mkdtempSync(join(tmpdir(),'letbuyy-managed-artifact-test-')),repo=join(workspace,'source');
    mkdirSync(repo);
    const paths=['scripts/supabase/prepare-managed-migrations.mjs','scripts/supabase/managed-migration-artifact.mjs',
        'scripts/governance/managed-catalog-fence.mjs','scripts/governance/definer-role-closure.mjs',
        'database/supabase/deploy/managed-migration-admission-v1.sql','database/supabase/migrations/353_approved_platform_job_recovery.sql'];
    const git=args=>execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    try {
        for(const path of paths) {mkdirSync(dirname(join(repo,path)),{recursive:true});copyFileSync(path,join(repo,path));}
        git(['init','-q']);git(['config','user.name','Synthetic Fixture']);git(['config','user.email','synthetic@example.invalid']);
        git(['add','--',...paths]);git(['-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false','commit','-qm','synthetic migration artifact fixture']);
        const revision=git(['rev-parse','HEAD']),out=join(workspace,'prepared');
        const run=(overrides=[])=>spawnSync(process.execPath,['scripts/supabase/prepare-managed-migrations.mjs',
            '--revision',revision,'--from','353','--through','353','--out',out,...overrides],{cwd:repo,encoding:'utf8'});
        const missing=run();assert.notEqual(missing.status,0);assert.match(missing.stderr,/acknowledgement/);assert.equal(existsSync(out),false);
        const prepared=run(['--ack-trusted-admin-maintenance']);assert.equal(prepared.status,0,prepared.stderr);
        const result=JSON.parse(prepared.stdout),manifest=JSON.parse(readFileSync(join(out,'manifest.json'),'utf8'));
        const sql=readFileSync(join(out,'artifact.sql'),'utf8');
        assert.equal(result.executed,false);assert.equal(result.migrations,1);assert.equal(manifest.sourceRevision,revision);
        assert.equal(manifest.batchSha256,createHash('sha256').update(sql).digest('hex'));
        assert.equal(manifest.migrations[0].sourceSha256,createHash('sha256').update(readFileSync(paths.at(-1))).digest('hex'));
        assert.equal(Object.keys(manifest.adapterHashes).length,5);
        assert.equal(statSync(join(out,'artifact.sql')).mode&0o777,0o600);
        assert.equal(manifest.preparationOnly,true);assert.equal(manifest.requiresFreshBackupRestoreRehearsalAndStagingAcceptance,true);
        const duplicate=run(['--ack-trusted-admin-maintenance']);assert.notEqual(duplicate.status,0,'never overwrite an existing artifact');
        assert.equal(readFileSync(join(out,'artifact.sql'),'utf8'),sql);
        writeFileSync(join(repo,'unreviewed.sql'),'SELECT 1;');
        const dirty=run(['--ack-trusted-admin-maintenance']);assert.notEqual(dirty.status,0);assert.match(dirty.stderr,/clean tracked and untracked/);
        rmSync(join(repo,'unreviewed.sql'));
        const mismatched=run(['--ack-trusted-admin-maintenance','--revision','0'.repeat(40)]);assert.notEqual(mismatched.status,0);assert.match(mismatched.stderr,/current checkout HEAD/);
        const ambiguous=run(['--ack-trusted-admin-maintenance','--names',join(workspace,'unread-names.json')]);
        assert.notEqual(ambiguous.status,0);assert.match(ambiguous.stderr,/names file or a range/);
        const inside=run(['--ack-trusted-admin-maintenance','--out',join(repo,'artifact')]);
        assert.notEqual(inside.status,0);assert.match(inside.stderr,/outside the source checkout/);assert.equal(existsSync(join(repo,'artifact')),false);
    } finally {rmSync(workspace,{recursive:true,force:true});}
});
