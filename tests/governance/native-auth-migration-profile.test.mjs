import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {listMigrations} from '../../scripts/governance/owned-database-provision.mjs';
import {nativeAuthMigrationEntries,parseNativeAuthMigrationProfile} from '../../scripts/governance/native-auth-migration-profile.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
const names=listMigrations(root);
const hash=value=>createHash('sha256').update(value).digest('hex');

test('production native418 qualification leaves unrelated migrations absent and the default lane complete',()=>{
    const before=listMigrations(root);
    const entries=nativeAuthMigrationEntries(root,names,'native-auth-production-413-418');
    assert.deepEqual(entries.map(e=>e.name),names.filter(name=>parseInt(name,10)<=413||parseInt(name,10)===418));
    assert.equal(entries.filter(e=>parseInt(e.name,10)>413).length,1);
    assert.deepEqual(listMigrations(root),before);
    for(const version of [414,415,416,417])assert.ok(before.some(name=>parseInt(name,10)===version),'complete source lane retains '+version);
});
test('staging qualification reproduces both hash-pinned historical identities without changing canonical files',()=>{
    const registry=JSON.parse(readFileSync(new URL('../../config/supabase/history-aliases.json',import.meta.url),'utf8'));
    const entries=nativeAuthMigrationEntries(root,names,'native-auth-staging-415-418');
    assert.deepEqual(entries.filter(e=>parseInt(e.name,10)>413).map(e=>e.name),[...registry.aliases.map(a=>a.recorded_name),'418_merchant_accounts_mobile_handoff.sql']);
    for(const alias of registry.aliases){
        const entry=entries.find(e=>e.name===alias.recorded_name);
        assert.equal(hash(entry.source),alias.recorded_source_sha256);
        assert.equal(entry.canonicalName,alias.canonical_name);
        assert.equal(hash(readFileSync(new URL('../../database/supabase/migrations/'+alias.canonical_name,import.meta.url))),alias.canonical_source_sha256);
    }
});
test('unknown profiles and missing native migration fail closed',()=>{
    assert.equal(parseNativeAuthMigrationProfile(undefined),undefined);
    for(const profile of ['',null,418,'production','native-auth-production-413-419'])assert.throws(()=>parseNativeAuthMigrationProfile(profile));
    assert.throws(()=>nativeAuthMigrationEntries(root,names.filter(name=>!name.startsWith('418_')),'native-auth-production-413-418'),/418/);
});
test('profile CLI refuses an implicit suite inventory, plain-Postgres suite, and combined ceiling before creating resources',()=>{
    for(const args of [
        [],
        ['--suite','tests/executable/definer-function-api-roles-postgres.test.mjs'],
        ['--suite','services/api-gateway/src/__tests__/owned-db/merchant-mobile-auth.postgres.test.ts','--through-migration','413'],
        ['--suite','services/api-gateway/src/__tests__/owned-db/payment-credential-history.postgres.test.ts'],
    ]) {
        const result=spawnSync(process.execPath,['scripts/governance/run-executable-suites.mjs','--migration-profile','native-auth-production-413-418',...args,'--list'],{cwd:root,encoding:'utf8',timeout:30_000});
        assert.notEqual(result.status,0,result.stdout);
        assert.match(result.stderr,/explicit finite|only to owned|cannot be combined|Historical retirement/);
    }
});
