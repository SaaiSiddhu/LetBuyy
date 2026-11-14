import assert from 'node:assert/strict';
import test from 'node:test';
import { consoleFixture } from './console-session-fixture';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const paths = ['/v1/internal/console/stores', '/v1/internal/console/subscriptions'];

test('permitted MFA operators can page platform directories and store search remains server-scoped', async () => {
    const f = await consoleFixture(owned), actor = await f.actor('viewer');
    const a = newSyntheticTenant('directory-a'), b = newSyntheticTenant('directory-b');
    seedSyntheticTenant(owned.psql, a); seedSyntheticTenant(owned.psql, b);
    const subscriptionId = crypto.randomUUID();
    owned.psql(`INSERT INTO subscriptions(id,user_id,store_id,plan,status,amount_paid) VALUES('${subscriptionId}','${actor.id}','${a.siteId}','free','active',0);`);
    const subscriptions = await f.gateway.request(paths[1] + '?q=free&limit=1', { headers: actor.headers });
    assert.equal(subscriptions.status, 200, subscriptions.text);
    assert.equal(subscriptions.json?.data[0].id, subscriptionId);
    for (const path of paths) {
        const result = await f.gateway.request(path + '?limit=1', { headers: actor.headers });
        assert.equal(result.status, 200, result.text);
        assert.ok(result.json?.data.length <= 1);
        assert.equal(result.json?.meta.per_page, 1);
        assert.doesNotMatch(result.text, /cookie_sha256|session_id/);
        assert.equal((await f.gateway.request(path + '?limit=101', { headers: actor.headers })).status, 400);
    }
    const result = await f.gateway.request(paths[0] + '?q=' + a.subdomain, { headers: actor.headers });
    assert.equal(result.status, 200, result.text);
    assert.deepEqual(result.json?.data.map((row: { id: string }) => row.id), [a.siteId]);
    const empty = await f.gateway.request(paths[0] + '?q=synthetic-no-matching-store', { headers: actor.headers });
    assert.equal(empty.status, 200, empty.text); assert.deepEqual(empty.json?.data, []);
});

test('bridge-only, pre-MFA, wrong bridge and revoked membership cannot enumerate directories', async () => {
    const f = await consoleFixture(owned), actor = await f.actor(), pending = await f.actor('super', false);
    for (const path of paths) {
        const bridgeOnly = { ...actor.headers }; delete (bridgeOnly as Record<string, string>)['X-Platform-Console-Session'];
        assert.equal((await f.gateway.request(path, { headers: bridgeOnly })).status, 401);
        assert.equal((await f.gateway.request(path, { headers: pending.headers })).status, 428);
        assert.equal((await f.gateway.request(path, { headers: { ...actor.headers, Authorization: 'Bearer wrong' } })).status, 401);
    }
    owned.psql(`UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${actor.id}';`);
    for (const path of paths) assert.equal((await f.gateway.request(path, { headers: actor.headers })).status, 401);
});

test('live role changes remove executive directory permission and logout rejects retained cookies', async () => {
    const f = await consoleFixture(owned), viewer = await f.actor('viewer'), lead = await f.actor('lead');
    assert.equal((await f.gateway.request(paths[1], { headers: lead.headers })).status, 403);
    assert.equal((await f.gateway.request(paths[1], { headers: viewer.headers })).status, 200);
    owned.psql(`UPDATE employees SET role='support' WHERE user_id='${viewer.id}' AND store_id IS NULL;`);
    assert.equal((await f.gateway.request(paths[1], { headers: viewer.headers })).status, 401);
    assert.equal((await f.gateway.request(paths[0], { headers: viewer.headers })).status, 401);
    const current = await f.actor();
    assert.equal((await f.gateway.request('/v1/internal/console/sessions/revoke', { method: 'POST', headers: current.headers, body: '{}' })).status, 200);
    for (const path of paths) assert.equal((await f.gateway.request(path, { headers: current.headers })).status, 401);
});

test('founding allocations are a bounded authorized page with validated search', async () => {
    const f = await consoleFixture(owned), actor = await f.actor('viewer');
    const tenant = newSyntheticTenant('founding-directory'); seedSyntheticTenant(owned.psql, tenant);
    owned.psql(`INSERT INTO founding_merchant_allocations(site_id,founding_number,allocation_source,plan_slug,locked_launch_price,locked_growth_price,locked_monthly_price)
        SELECT '${tenant.siteId}',coalesce(max(founding_number),0)+1,'PUBLIC','launch',19900,69900,19900 FROM founding_merchant_allocations;`);
    const path = '/v1/internal/founding/allocations';
    const result = await f.gateway.request(path + '?limit=1&search=' + tenant.siteId, { headers: actor.headers });
    assert.equal(result.status, 200, result.text);
    assert.equal(result.json?.data.allocations.length, 1); assert.equal(result.json?.data.allocations[0].site_id, tenant.siteId);
    assert.equal(result.json?.data.per_page, 1);
    for (const query of ['limit=0', 'limit=501', 'limit=NaN', 'search=invalid-site-id', 'page=-1']) {
        assert.equal((await f.gateway.request(path + '?' + query, { headers: actor.headers })).status, 400);
    }
    const bridgeOnly = { ...actor.headers }; delete (bridgeOnly as Record<string, string>)['X-Platform-Console-Session'];
    assert.equal((await f.gateway.request(path, { headers: bridgeOnly })).status, 401);
    assert.equal((await f.gateway.request(path, { headers: { ...actor.headers, Authorization: 'Bearer wrong' } })).status, 401);
    assert.equal((await f.gateway.request(path, { headers: { ...actor.headers, Authorization: actor.headers.Authorization.slice(7) } })).status, 401);
});

test('compliance totals cover more than the former row cap while responses remain small and sensitive reads have real attribution', async () => {
    const f = await consoleFixture(owned), actor = await f.actor('viewer');
    const a = newSyntheticTenant('compliance-a'), b = newSyntheticTenant('compliance-b');
    seedSyntheticTenant(owned.psql, a); seedSyntheticTenant(owned.psql, b);
    owned.psql(`INSERT INTO data_subject_requests(site_id,request_type,subject_type,subject_email,source,status,due_at,reason,actor_type)
        SELECT CASE WHEN n%2=0 THEN '${a.siteId}'::uuid ELSE '${b.siteId}'::uuid END,'access','customer',
        'syn-compliance-'||n||'@example.invalid','manual','open',clock_timestamp()-interval '1 day','Synthetic request fixture','system' FROM generate_series(1,10005) n;`);
    const path = '/v1/internal/console/compliance';
    const overview = await f.gateway.request(path + '/overview', { headers: actor.headers });
    assert.equal(overview.status, 200, overview.text);
    assert.equal(overview.json?.data.totals.total, Number(owned.psql('SELECT count(*) FROM data_subject_requests WHERE deleted_at IS NULL;')));
    assert.equal(overview.json?.data.latest_requests.length, 10);
    assert.ok(overview.text.length < 15000); assert.doesNotMatch(overview.text, /syn-compliance-.*@example/);
    const forged = crypto.randomUUID();
    const list = await f.gateway.request(path + '/data-requests?limit=1&site_id=' + a.siteId + '&actor_id=' + forged + '&actor_email=forged@example.invalid', { headers: actor.headers });
    assert.equal(list.status, 200, list.text); assert.equal(list.json?.data.length, 1);
    assert.equal(list.json?.data[0].site_id, a.siteId);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND actor_type='employee' AND action='data_subject_request.list';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${forged}';`), '0');
    const bridgeOnly = { ...actor.headers }; delete (bridgeOnly as Record<string, string>)['X-Platform-Console-Session'];
    for (const suffix of ['/overview', '/data-requests']) {
        assert.equal((await f.gateway.request(path + suffix, { headers: bridgeOnly })).status, 401);
    }
    assert.equal((await f.gateway.request(path + '/data-requests?limit=101', { headers: actor.headers })).status, 400);
});

test('a failed compliance read audit cannot return sensitive data as a successful read', async () => {
    const f = await consoleFixture(owned), actor = await f.actor();
    owned.psql(`CREATE FUNCTION syn_compliance_read_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.action='data_subject_request.list' AND NEW.actor_id='${actor.id}' THEN RAISE EXCEPTION 'synthetic-private-audit-fault';END IF;RETURN NEW;END $$;
        CREATE TRIGGER syn_compliance_read_audit_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION syn_compliance_read_audit_fault();`);
    try {
        const result = await f.gateway.request('/v1/internal/console/compliance/data-requests', { headers: actor.headers });
        assert.equal(result.status, 500, result.text); assert.equal(result.json?.data, undefined);
        assert.doesNotMatch(result.text, /synthetic-private-audit-fault|subject_email/);
    } finally { owned.psql('DROP TRIGGER syn_compliance_read_audit_fault ON audit_logs;DROP FUNCTION syn_compliance_read_audit_fault();'); }
    assert.equal((await f.gateway.request('/v1/internal/console/compliance/data-requests', { headers: actor.headers })).status, 200);
});

test('merchant profile search needs current PII permission and returns only matching bounded sites', async () => {
    const f = await consoleFixture(owned), actor = await f.actor(), viewer = await f.actor('viewer');
    const tenant = newSyntheticTenant('merchant-search'); seedSyntheticTenant(owned.psql, tenant);
    const path = '/v1/internal/console/merchants/search?q=' + tenant.subdomain;
    assert.equal((await f.gateway.request(path, { headers: viewer.headers })).status, 403);
    const result = await f.gateway.request(path + '&limit=1', { headers: actor.headers });
    assert.equal(result.status, 200, result.text);
    assert.deepEqual(result.json?.data.results.map((row: { id: string }) => row.id), [tenant.siteId]);
    assert.equal((await f.gateway.request(path + '&limit=101', { headers: actor.headers })).status, 400);
});
