// Real worker + owned PostgREST/database. Reproduce the restored backend ACL
// outage without inherited tenant grants, then prove recovery and exact rollback.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const migration = readFileSync(new URL('../../../../../database/supabase/migrations/364_store_discovery_backend_grants.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../../../../../database/supabase/rollback/364_store_discovery_backend_grants.rollback.sql', import.meta.url), 'utf8');
const snapshot = () => owned.psql(`SELECT jsonb_object_agg(relname,relacl::text ORDER BY relname) FROM pg_class
    WHERE oid IN ('public.employees'::regclass,'public.runtime_telemetry_metrics'::regclass,'public.worker_request_logs'::regclass);`);
const unrelatedAuthority = () => owned.psql(`SELECT md5(jsonb_agg(jsonb_build_array(c.relname,
    c.relrowsecurity,c.relforcerowsecurity,a.grantee,a.grantor,a.privilege_type,a.is_grantable)
    ORDER BY c.relname,a.grantee,a.grantor,a.privilege_type)::text)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE n.nspname='public'
    AND NOT (a.grantee='service_role'::regrole AND
        ((c.relname='employees' AND a.privilege_type='SELECT')
        OR (c.relname IN ('runtime_telemetry_metrics','worker_request_logs') AND a.privilege_type='INSERT')));`);

test('missing employee read returns 503; explicit backend grants restore scoped discovery and roll back exactly', async () => {
    const tenant = newSyntheticTenant('store-grants');
    seedSyntheticTenant(owned.psql, tenant);
    const owner = crypto.randomUUID(), email = `syn-store-owner-${owner}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true);
        UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
    const other = newSyntheticTenant('other-store-grants');
    seedSyntheticTenant(owned.psql, other);
    const gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    const list = async () => gateway.request('/v1/stores?limit=50', { headers: await signedIdentityHeaders(owner, email) });

    owned.script(rollback);
    owned.script(`REVOKE app_tenant FROM service_role;
        REVOKE SELECT ON public.employees FROM service_role;
        REVOKE INSERT ON public.runtime_telemetry_metrics,public.worker_request_logs FROM service_role;`);
    const before = snapshot();
    const authorityBefore = unrelatedAuthority();
    try {
        const failed = await list();
        assert.equal(failed.status, 503, failed.text);
        assert.equal(failed.json?.error.code, 'STORE_LIST_UNAVAILABLE');
        assert.doesNotMatch(failed.text, /permission denied|employees/);

        owned.script(migration);
        const after = snapshot();
        assert.equal(unrelatedAuthority(), authorityBefore, 'client privileges, money fences and RLS must stay unchanged');
        const recovered = await list();
        assert.equal(recovered.status, 200, recovered.text);
        assert.equal(recovered.json?.meta.total, 1);
        assert.deepEqual(recovered.json?.data.map((row: { id: string }) => row.id), [tenant.siteId]);
        assert.equal(owned.psql(`SELECT has_table_privilege('service_role','public.runtime_telemetry_metrics','INSERT')
            AND has_table_privilege('service_role','public.worker_request_logs','INSERT');`), 't');
        for (const role of ['anon','authenticated','app_tenant']) {
            assert.equal(owned.psql(`SELECT has_function_privilege('${role}',
                'public.list_merchant_accessible_sites_v1(uuid,integer,integer,uuid)','EXECUTE');`), 'f');
        }
        owned.script(migration);
        assert.equal(snapshot(), after, 'reapplying must not change grants');
        owned.script(rollback);
        assert.equal(snapshot(), before, 'rollback must restore the exact prior ACL');
        assert.equal((await list()).status, 503, 'rollback control must reproduce the original failure');
        owned.script(migration);
        assert.equal((await list()).status, 200);
    } finally {
        owned.script('GRANT app_tenant TO service_role;');
    }
});

test('preexisting direct backend privileges survive migration and rollback unchanged', () => {
    owned.script(rollback);
    owned.script(`GRANT SELECT ON public.employees TO service_role;
        GRANT INSERT ON public.runtime_telemetry_metrics,public.worker_request_logs TO service_role;`);
    const before = snapshot();
    owned.script(migration);
    owned.script(rollback);
    assert.equal(snapshot(), before);
});
