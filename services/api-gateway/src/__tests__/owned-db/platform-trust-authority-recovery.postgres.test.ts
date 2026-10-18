import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const migration = readFileSync('database/supabase/migrations/319_protect_trust_mutation_authority.sql', 'utf8');
const rollback = readFileSync('database/supabase/rollback/319_protect_trust_mutation_authority.rollback.sql', 'utf8');
const names = ['ts_policies', 'ts_cases', 'ts_case_events', 'ts_evidence', 'ts_appeals', 'ts_takedowns'];
const sqlNames = names.map(name => "'public." + name + "'").join(',');
const sqlOids = names.map(name => "'public." + name + "'::regclass").join(',');
const journal = () => owned.psql("SELECT jsonb_agg(to_jsonb(j) ORDER BY object_signature,grantee,privilege,action) FROM migration_privilege_journal j WHERE migration='319';");
const otherJournal = () => owned.psql("SELECT jsonb_agg(to_jsonb(j) ORDER BY migration,object_signature,grantee,privilege,action) FROM migration_privilege_journal j WHERE migration<>'319';");
const acl = () => owned.psql(`SELECT jsonb_agg(to_jsonb(x) ORDER BY table_name,column_name,grantee,grantor,privilege_type,is_grantable) FROM (
    SELECT c.relname table_name,''::text column_name,a.* FROM pg_class c
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid IN(${sqlOids})
    UNION ALL SELECT t.relname,c.attname,a.* FROM pg_attribute c JOIN pg_class t ON t.oid=c.attrelid
      CROSS JOIN LATERAL aclexplode(c.attacl) a WHERE c.attrelid IN(${sqlOids}) AND c.attnum>0 AND NOT c.attisdropped) x;`);
const readsAndBackend = () => owned.psql(`SELECT jsonb_agg(jsonb_build_array(r,t,has_table_privilege(r,t,'SELECT'),
    CASE WHEN r='service_role' THEN has_table_privilege(r,t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') ELSE NULL END) ORDER BY r,t)
    FROM unnest(ARRAY['anon','authenticated','app_tenant','service_role'])r CROSS JOIN unnest(ARRAY[${sqlNames}])t;`);
after(() => { owned.script(migration); });

test('concurrent319 reapply conserves every journal entry, ACL, read and backend permission', async () => {
    const saved = journal(), permissions = acl(), reads = readsAndBackend(), unrelated = otherJournal();
    await Promise.all([owned.psqlAsync(migration), owned.psqlAsync(migration)]);
    assert.equal(journal(), saved); assert.equal(acl(), permissions); assert.equal(readsAndBackend(), reads); assert.equal(otherJournal(), unrelated);
    assert.equal(owned.psql("SELECT count(*) FROM migration_privilege_journal WHERE migration='319' AND privilege='TABLE MUTATION FENCE';"), '6');
});
test('clean paired recovery restores the original mutation privileges exactly and closes them again', () => {
    const fixed = acl(), reads = readsAndBackend(), unrelated = otherJournal();
    owned.script(rollback); owned.script(rollback);
    assert.equal(owned.psql("SELECT has_table_privilege('app_tenant','public.ts_takedowns','UPDATE');"), 't');
    const original = acl(); owned.script(migration);
    assert.equal(acl(), fixed); assert.equal(readsAndBackend(), reads); assert.equal(otherJournal(), unrelated);
    owned.script(rollback); assert.equal(acl(), original); owned.script(migration); assert.equal(acl(), fixed);
});
test('PUBLIC and column grant options recover without changing tenant reads or backend authority', () => {
    owned.script(rollback);
    owned.script(`GRANT DELETE ON ts_takedowns TO PUBLIC; GRANT UPDATE(status) ON ts_cases TO app_tenant WITH GRANT OPTION;
        GRANT INSERT(title) ON ts_policies TO authenticated WITH GRANT OPTION;`);
    const original = acl(), reads = readsAndBackend();
    try {
        owned.script(migration); assert.equal(readsAndBackend(), reads);
        assert.equal(owned.psql("SELECT has_table_privilege('app_tenant','public.ts_takedowns','UPDATE');"), 'f');
        owned.script(rollback); assert.equal(acl(), original);
    } finally {
        owned.script(`REVOKE DELETE ON ts_takedowns FROM PUBLIC; REVOKE UPDATE(status) ON ts_cases FROM app_tenant;
            REVOKE INSERT(title) ON ts_policies FROM authenticated;`);
        owned.script(migration);
    }
});
test('retained safety cases refuse privilege reopening atomically', () => {
    const saved = journal(), permissions = acl();
    assert.match(owned.psqlExpectError(`BEGIN; INSERT INTO ts_cases(subject_type,subject_id,category,title)
        VALUES('custom','synthetic-retained-case','other','Synthetic retained safety evidence'); ${rollback}`), /rollback319 refuses retained/);
    assert.equal(journal(), saved); assert.equal(acl(), permissions);
});
test('schema, function-body, journal and new privilege drift are refused without changing authority', () => {
    const saved = journal(), permissions = acl();
    const drifts = [
        'ALTER TABLE ts_takedowns ADD COLUMN synthetic_319_drift text;',
        'ALTER TABLE ts_cases OWNER TO service_role;',
        "DELETE FROM migration_privilege_journal WHERE migration='319' AND object_signature='public.ts_cases' AND privilege='TABLE MUTATION FENCE';",
        'GRANT UPDATE(status) ON ts_cases TO app_tenant;',
        'ALTER FUNCTION lock_trust_review_case_v1() VOLATILE;',
    ];
    for (const drift of drifts) for (const source of [migration, rollback]) {
        // VOLATILE is already the trigger default; change its body-related
        // execution property instead so the fingerprint must actually differ.
        const actual = drift.includes(' VOLATILE;') ? drift.replace(' VOLATILE;', ' STABLE;') : drift;
        assert.match(owned.psqlExpectError('BEGIN;' + actual + source), /migration319 refuses/);
        assert.equal(journal(), saved); assert.equal(acl(), permissions);
    }
});
test('earlier trust schema rollback cannot erase the source beneath319’s journal', () => {
    const saved = journal(), permissions = acl();
    for (const name of ['317_trust_site_status_ownership', '318_session_bound_trust_reinstatement']) {
        assert.match(owned.psqlExpectError(readFileSync('database/supabase/rollback/' + name + '.rollback.sql', 'utf8')), /reverse migration319/);
    }
    assert.equal(journal(), saved); assert.equal(acl(), permissions);
});
