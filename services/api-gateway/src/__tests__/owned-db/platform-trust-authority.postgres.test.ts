// The platform's enforcement authority must remain private even when a
// merchant has a valid own-site database role/GUC and can read its case.
import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { consoleFixture } from './console-session-fixture';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase(), tenant = newSyntheticTenant('trust-authz');
const caseId = crypto.randomUUID(); let takedown: string;
before(async () => {
    seedSyntheticTenant(owned.psql, tenant);
    owned.psql(`UPDATE sites SET published=true WHERE id='${tenant.siteId}';
        INSERT INTO ts_cases(id,site_id,subject_type,subject_id,category,status,title)
        VALUES('${caseId}','${tenant.siteId}','site','${tenant.siteId}','fraud','open','Synthetic private enforcement authority');`);
    const fixture = await consoleFixture(owned), actor = await fixture.actor('lead');
    const result = await fixture.gateway.request(`/v1/internal/console/trust-safety/cases/${caseId}/enforce`, {
        method: 'POST', headers: actor.headers,
        body: JSON.stringify({ action: 'suspend_site', reason: 'Synthetic actual platform restriction', idempotency_key: crypto.randomUUID(), notify_subject: false }),
    });
    assert.equal(result.status, 200, result.text); takedown = result.json!.data.takedown.id;
});
test('a valid own-site app_tenant cannot reverse a platform hold then republish the restricted site', () => {
    const denied = owned.psqlExpectError(`BEGIN; SET LOCAL ROLE app_tenant;
        SELECT set_config('app.site_id','${tenant.siteId}',true);
        UPDATE ts_takedowns SET status='reversed' WHERE id='${takedown}';
        UPDATE sites SET status='published',published=true WHERE id='${tenant.siteId}';
        SELECT status||':'||published FROM sites WHERE id='${tenant.siteId}'; ROLLBACK;`);
    assert.match(denied, /permission denied/);
    assert.equal(owned.psql(`SELECT status FROM ts_takedowns WHERE id='${takedown}';`), 'active');
    assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${tenant.siteId}';`), 'suspended');
});
test('ordinary roles have no direct table or column mutation authority over platform safety records', () => {
    const tables = ['ts_policies', 'ts_cases', 'ts_case_events', 'ts_evidence', 'ts_appeals', 'ts_takedowns'];
    const exposed = JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(jsonb_build_object('role',r,'table',t)),'[]')
        FROM unnest(ARRAY['anon','authenticated','app_tenant'])r CROSS JOIN unnest(ARRAY[${tables.map(name => "'public." + name + "'").join(',')}])t
        WHERE has_table_privilege(r,t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(r,t,'INSERT,UPDATE,REFERENCES');`));
    assert.deepEqual(exposed, [], 'tenant visibility must never imply platform mutation authority');
});
