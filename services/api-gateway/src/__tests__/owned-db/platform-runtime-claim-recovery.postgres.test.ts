import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase(), signature = 'public.claim_operational_control_command(text,integer)';
const migration = readFileSync('database/supabase/migrations/320_protect_global_runtime_claim_authority.sql', 'utf8');
const rollback = readFileSync('database/supabase/rollback/320_protect_global_runtime_claim_authority.rollback.sql', 'utf8');
const journal = () => owned.psql("SELECT jsonb_agg(to_jsonb(j) ORDER BY object_signature,grantee,privilege,action) FROM migration_privilege_journal j WHERE migration='320';");
const otherJournal = () => owned.psql("SELECT jsonb_agg(to_jsonb(j) ORDER BY migration,object_signature,grantee,privilege,action) FROM migration_privilege_journal j WHERE migration<>'320';");
const acl = () => owned.psql(`SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
    'grantor',pg_get_userbyid(a.grantor),'grantable',a.is_grantable) ORDER BY a.grantee,a.grantor,a.is_grantable)
    FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid='${signature}'::regprocedure;`);
const definition = () => owned.psql(`SELECT pg_get_userbyid(proowner)||':'||pg_get_functiondef(oid) FROM pg_proc WHERE oid='${signature}'::regprocedure;`);
after(() => { owned.script(migration); });

test('concurrent320 reapply preserves exact ACL, body/owner, private journal and unrelated evidence', async () => {
    const saved = journal(), permissions = acl(), body = definition(), unrelated = otherJournal();
    await Promise.all([owned.psqlAsync(migration), owned.psqlAsync(migration)]);
    assert.equal(journal(), saved); assert.equal(acl(), permissions); assert.equal(definition(), body); assert.equal(otherJournal(), unrelated);
});
test('ordinary roles cannot execute global claims while the real backend remains callable', () => {
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.match(owned.psqlExpectError(`BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('app.site_id','${crypto.randomUUID()}',true);
            SELECT count(*) FROM public.claim_operational_control_command('synthetic-denied-role',1); ROLLBACK;`), /permission denied/);
    }
    assert.equal(owned.script("BEGIN; SET LOCAL ROLE service_role; SELECT count(*) FROM public.claim_operational_control_command('synthetic-owned-backend',1); COMMIT;"), '0');
});
test('clean paired rollback restores prior global claim grants and reapply closes them without changing the function', () => {
    const fixed = acl(), body = definition(), unrelated = otherJournal();
    owned.script(rollback); owned.script(rollback);
    assert.equal(owned.psql(`SELECT has_function_privilege('app_tenant','${signature}','EXECUTE');`), 't');
    const original = acl(); owned.script(migration); assert.equal(acl(), fixed); assert.equal(definition(), body);
    owned.script(rollback); assert.equal(acl(), original); owned.script(migration);
    assert.equal(acl(), fixed); assert.equal(otherJournal(), unrelated);
});
test('PUBLIC-inherited backend execution and grant options survive exact paired recovery', () => {
    owned.script(rollback); const original = JSON.parse(acl()) as { grantee: string; grantable: boolean }[];
    owned.script(`REVOKE EXECUTE ON FUNCTION ${signature} FROM service_role,app_tenant;
        GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC; GRANT EXECUTE ON FUNCTION ${signature} TO app_tenant WITH GRANT OPTION;`);
    const before = acl();
    try {
        owned.script(migration);
        assert.equal(owned.psql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE');`), 't');
        assert.equal(owned.psql(`SELECT has_function_privilege('app_tenant','${signature}','EXECUTE');`), 'f');
        owned.script(rollback); assert.equal(acl(), before);
    } finally {
        owned.script(rollback);
        owned.script(`REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC,anon,authenticated,app_tenant,service_role;` + original.map(row =>
            `GRANT EXECUTE ON FUNCTION ${signature} TO ${row.grantee === 'PUBLIC' ? 'PUBLIC' : '"' + row.grantee.replaceAll('"','""') + '"'}${row.grantable ? ' WITH GRANT OPTION' : ''};`).join('\n'));
        owned.script(migration);
    }
});
test('new grants and changed identity/body/owner/journal refuse both reapply and rollback atomically', () => {
    const saved = journal(), permissions = acl(), body = definition();
    const ddl = owned.psql(`SELECT pg_get_functiondef('${signature}'::regprocedure);`);
    for (const drift of [`ALTER FUNCTION ${signature} STABLE;`, `ALTER FUNCTION ${signature} OWNER TO service_role;`,
        `DROP FUNCTION ${signature}; ${ddl};`, `GRANT EXECUTE ON FUNCTION ${signature} TO app_tenant;`,
        "DELETE FROM migration_privilege_journal WHERE migration='320' AND privilege='FUNCTION EXECUTION FENCE';",
        "DELETE FROM migration_privilege_journal WHERE migration='320';"]) {
        for (const source of [migration, rollback]) {
            assert.match(owned.psqlExpectError('BEGIN;' + drift + source), /migration320 refuses/);
            assert.equal(journal(), saved); assert.equal(acl(), permissions); assert.equal(definition(), body);
        }
    }
});
test('retained command records refuse reopening tenant claims without changing data or privilege evidence', () => {
    const saved = journal(), permissions = acl(), id = 'syn-retained-' + crypto.randomUUID();
    assert.match(owned.psqlExpectError(`BEGIN; INSERT INTO runtime_control_commands(command_id,operation,target_type,target_id,reason,correlation_id)
        VALUES('${id}','invalidate-cache','cache','synthetic-cache','Synthetic retained command','${id}'); ${rollback}`), /rollback320 refuses retained/);
    assert.equal(journal(), saved); assert.equal(acl(), permissions);
    assert.equal(owned.psql(`SELECT count(*) FROM runtime_control_commands WHERE command_id='${id}';`), '0');
});
