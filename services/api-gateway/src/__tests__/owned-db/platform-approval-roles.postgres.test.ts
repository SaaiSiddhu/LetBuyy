// Actual PostgreSQL roles, no service-role/RLS substitution. Approval authority
// is backend-owned even when a tenant already owns the referenced merchant.
import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { readFileSync } from 'node:fs';
import { requireOwnedDatabase, requireOwnedHistoricalSqlDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
let sql: ReturnType<typeof requireOwnedHistoricalSqlDatabase> = owned;
const protocolRollback = readFileSync('database/supabase/rollback/315_session_bound_sensitive_approvals.rollback.sql', 'utf8');
const tenant = newSyntheticTenant('approval-role');
const maker = crypto.randomUUID(), checker = crypto.randomUUID(), approval = crypto.randomUUID();
before(() => {
    seedSyntheticTenant(owned.psql, tenant);
    owned.psql(`INSERT INTO sensitive_action_approvals(id,site_id,action,resource_type,resource_id,maker_actor_id,checker_actor_id,status,reason)
        VALUES('${approval}','${tenant.siteId}','refund.approve','order','synthetic-order','${maker}','${checker}','approved','Synthetic role-boundary fixture');`);
});
const operations = {
    SELECT: `SELECT id FROM public.sensitive_action_approvals WHERE site_id='${tenant.siteId}';`,
    INSERT: `INSERT INTO public.sensitive_action_approvals(site_id,action,resource_type,resource_id,maker_actor_id,checker_actor_id,status,reason)
        VALUES('${tenant.siteId}','refund.approve','order','forged','${maker}','${checker}','approved','Synthetic unauthorized consent');`,
    UPDATE: `UPDATE public.sensitive_action_approvals SET status='rejected' WHERE id='${approval}' AND site_id='${tenant.siteId}';`,
    DELETE: `DELETE FROM public.sensitive_action_approvals WHERE id='${approval}' AND site_id='${tenant.siteId}';`,
};
for (const role of ['anon', 'authenticated', 'app_tenant']) {
    test(`${role} cannot read or manufacture platform approval authority with a valid site GUC`, () => {
        const denied = Object.entries(operations).map(([operation, sql]) => {
            const error = owned.psqlExpectError(`BEGIN; SET LOCAL ROLE ${role};
                SELECT set_config('app.site_id','${tenant.siteId}',true); ${sql} ROLLBACK;`);
            return { operation, denied: /permission denied/.test(error) };
        });
        console.info('OWNED_APPROVAL_TABLE_ROLE ' + JSON.stringify({ role, operations: denied }));
        assert.ok(denied.every(result => result.denied), `${role} has direct approval authority: ${JSON.stringify(denied)}`);
    });
}
test('the backend retains approval access and denied role probes preserve the original record', () => {
    const result = owned.script(`BEGIN; SET LOCAL ROLE service_role;
        SELECT status FROM sensitive_action_approvals WHERE id='${approval}' AND site_id='${tenant.siteId}'; COMMIT;`);
    assert.equal(result, 'approved');
    assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE site_id='${tenant.siteId}';`), '1');
});

const migration = readFileSync('database/supabase/migrations/313_protect_sensitive_approval_authority.sql', 'utf8');
const rollback = readFileSync('database/supabase/rollback/313_protect_sensitive_approval_authority.rollback.sql', 'utf8');
const journal = () => sql.psql(`SELECT jsonb_agg(to_jsonb(j) ORDER BY object_signature,grantee,privilege,action)
    FROM public.migration_privilege_journal j WHERE migration='313';`);
const otherJournal = () => sql.psql(`SELECT jsonb_agg(to_jsonb(j) ORDER BY migration,object_signature,grantee,privilege,action)
    FROM public.migration_privilege_journal j WHERE migration<>'313';`);
const rows = () => sql.psql('SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.sensitive_action_approvals a;');
const acl = () => sql.psql(`SELECT jsonb_agg(to_jsonb(x) ORDER BY column_name,grantee,grantor,privilege_type,is_grantable)
    FROM (
      SELECT ''::text column_name,a.grantee,a.grantor,a.privilege_type,a.is_grantable FROM pg_class c
        CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.sensitive_action_approvals'::regclass
      UNION ALL
      SELECT c.attname,a.grantee,a.grantor,a.privilege_type,a.is_grantable FROM pg_attribute c
        CROSS JOIN LATERAL aclexplode(c.attacl) a WHERE c.attrelid='public.sensitive_action_approvals'::regclass
          AND c.attnum>0 AND NOT c.attisdropped
    ) x;`);

test('313 refuses the current protocol schema; its exact 315 predecessor supports reviewed recovery', () => {
    const current = owned.psql('SELECT row_to_json(a) FROM sensitive_action_approvals a LIMIT 1;');
    assert.match(owned.psqlExpectError(rollback), /313 refuses/);
    assert.equal(owned.psql('SELECT row_to_json(a) FROM sensitive_action_approvals a LIMIT 1;'), current);
    sql = requireOwnedHistoricalSqlDatabase(315);
    seedSyntheticTenant(sql.psql, tenant);
    sql.psql(`INSERT INTO sensitive_action_approvals(id,site_id,action,resource_type,resource_id,maker_actor_id,checker_actor_id,status,reason)
        VALUES('${approval}','${tenant.siteId}','refund.approve','order','synthetic-order','${maker}','${checker}','approved','Synthetic historical recovery fixture');`);
    assert.match(sql.psqlExpectError(rollback), /313 refuses/);
    sql.script(protocolRollback);
});

test('concurrent migration reapply preserves the original journal, rows and closed ACL', async () => {
    const saved = journal(), records = rows(), permissions = acl(), unrelated = otherJournal();
    await Promise.all([sql.psqlAsync(migration), sql.psqlAsync(migration)]);
    assert.equal(journal(), saved); assert.equal(rows(), records); assert.equal(acl(), permissions); assert.equal(otherJournal(), unrelated);
});

test('paired recovery restores actual PUBLIC/table/column/grant-option privileges exactly without changing data', () => {
    const records = rows(), unrelated = otherJournal();
    sql.script(rollback);
    // A deliberately different prior privilege profile in this owned database:
    // redundant PUBLIC and named column grants must both survive exact recovery.
    sql.script(`REVOKE ALL PRIVILEGES ON public.sensitive_action_approvals FROM PUBLIC,anon,authenticated,app_tenant;
        GRANT SELECT ON public.sensitive_action_approvals TO PUBLIC;
        GRANT DELETE ON public.sensitive_action_approvals TO app_tenant WITH GRANT OPTION;
        GRANT SELECT(id) ON public.sensitive_action_approvals TO anon WITH GRANT OPTION;
        GRANT INSERT(metadata) ON public.sensitive_action_approvals TO authenticated;
        GRANT UPDATE(status) ON public.sensitive_action_approvals TO app_tenant WITH GRANT OPTION;`);
    const before = acl();
    try {
        sql.script(migration);
        for (const role of ['anon', 'authenticated', 'app_tenant']) {
            assert.equal(sql.psql(`SELECT has_table_privilege('${role}','public.sensitive_action_approvals','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                OR has_any_column_privilege('${role}','public.sensitive_action_approvals','SELECT,INSERT,UPDATE,REFERENCES');`), 'f');
        }
        sql.script(rollback);
        assert.equal(acl(), before, 'all exact grantors, grant options and column privileges recover');
        assert.equal(rows(), records); assert.equal(otherJournal(), unrelated);
    } finally {
        if (sql.psql("SELECT count(*) FROM public.migration_privilege_journal WHERE migration='313';") === '0') sql.script(migration);
    }
});

test('reapply and rollback refuse replaced/schema-changed objects or an unrecorded privilege change before any restoration', () => {
    const saved = journal(), records = rows(), permissions = acl();
    for (const source of [migration, rollback]) {
        assert.match(sql.psqlExpectError(`BEGIN; ALTER TABLE public.sensitive_action_approvals ADD COLUMN synthetic_313_change integer; ${source}`), /313 refuses/);
        assert.equal(journal(), saved); assert.equal(rows(), records); assert.equal(acl(), permissions);
        assert.match(sql.psqlExpectError(`BEGIN; ALTER TABLE public.sensitive_action_approvals RENAME TO synthetic_313_original;
            CREATE TABLE public.sensitive_action_approvals (LIKE public.synthetic_313_original INCLUDING ALL); ${source}`), /313 refuses/);
        assert.equal(journal(), saved); assert.equal(rows(), records); assert.equal(acl(), permissions);
        assert.match(sql.psqlExpectError(`BEGIN; GRANT SELECT ON public.sensitive_action_approvals TO anon; ${source}`), /313 refuses/);
        assert.equal(journal(), saved); assert.equal(rows(), records); assert.equal(acl(), permissions);
    }
});
