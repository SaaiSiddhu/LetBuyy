// Actual full worker -> PostgREST -> owned PostgreSQL. Positive independent
// consent must pass alongside denial cases; blocking every action is not proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Gateway, tapRest } from './gateway-harness';
import { consoleFixture } from './console-session-fixture';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
let sequence = 0;

async function journey(kind: 'super' | 'lead' | 'viewer' = 'lead') {
    const fixture = await consoleFixture(owned), maker = await fixture.actor(kind), checker = await fixture.actor('super');
    const tenant = newSyntheticTenant('consent-' + (++sequence)); seedSyntheticTenant(owned.psql, tenant);
    const reason = 'Synthetic exact independent approval evidence';
    const intent = { action: 'merchant.suspend', resource_id: tenant.siteId, reason, request_key: crypto.randomUUID() };
    const create = (body = intent) => fixture.gateway.request('/v1/internal/console/approvals', { method: 'POST', headers: maker.headers, body: JSON.stringify(body) });
    const decide = (id: string, hash: string, decision = 'approve', headers: Record<string, string> = checker.headers) =>
        fixture.gateway.request(`/v1/internal/console/approvals/${id}/decision`, { method: 'POST', headers, body: JSON.stringify({ decision, payload_hash: hash }) });
    const apply = (id: string, overrides: Record<string, unknown> = {}, headers: Record<string, string> = maker.headers, site = tenant.siteId, worker = fixture.gateway) =>
        worker.request(`/v1/internal/console/merchants/${site}/moderation`, { method: 'POST', headers,
            body: JSON.stringify({ actor_id: maker.id, action: 'suspend', reason, approval_id: id, ...overrides }) });
    const count = () => owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${tenant.siteId}' AND action='merchant.suspend';`);
    return { ...fixture, maker, checker, tenant, reason, intent, create, decide, apply, count };
}
async function requested(j: Awaited<ReturnType<typeof journey>>) {
    const response = await j.create(); assert.equal(response.status, 201, response.text); return response.json!.data.approval;
}
async function approved(j: Awaited<ReturnType<typeof journey>>) {
    const a = await requested(j), result = await j.decide(a.id, a.payload_hash);
    assert.equal(result.status, 200, result.text); return a;
}
function unchanged(j: Awaited<ReturnType<typeof journey>>) {
    assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${j.tenant.siteId}';`), 'published'); assert.equal(j.count(), '0');
}

test('a permitted lead requests, a distinct active super admin consents, and exact merchant suspension commits once with its audit', async () => {
    const { gateway, actor } = await consoleFixture(owned);
    const maker = await actor('lead'), checker = await actor('super');
    const tenant = newSyntheticTenant('consent-allowed'); seedSyntheticTenant(owned.psql, tenant);
    const reason = 'Synthetic merchant policy enforcement evidence';
    const request = { action: 'merchant.suspend', resource_id: tenant.siteId, reason, request_key: crypto.randomUUID() };
    const created = await gateway.request('/v1/internal/console/approvals', { method: 'POST', headers: maker.headers, body: JSON.stringify(request) });
    assert.equal(created.status, 201, created.text);
    const approval = created.json?.data?.approval;
    assert.ok(approval?.id && approval?.payload_hash);
    assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${tenant.siteId}';`), 'published', 'request creates no suspension');
    const consent = await gateway.request(`/v1/internal/console/approvals/${approval.id}/decision`, {
        method: 'POST', headers: checker.headers, body: JSON.stringify({ decision: 'approve', payload_hash: approval.payload_hash }),
    });
    assert.equal(consent.status, 200, consent.text);
    assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${tenant.siteId}';`), 'published', 'consent alone creates no suspension');
    const apply = () => gateway.request(`/v1/internal/console/merchants/${tenant.siteId}/moderation`, {
        method: 'POST', headers: maker.headers,
        body: JSON.stringify({ actor_id: maker.id, action: 'suspend', reason, approval_id: approval.id }),
    });
    const applied = await apply(); assert.equal(applied.status, 200, applied.text);
    assert.equal(applied.json?.data?.site?.status, 'suspended');
    const replay = await apply(); assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.json?.data?.replayed, true);
    assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${tenant.siteId}';`), 'suspended');
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${tenant.siteId}' AND action='merchant.suspend';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE id='${approval.id}' AND maker_actor_id='${maker.id}'
        AND checker_actor_id='${checker.id}' AND status='approved' AND consumed_at IS NOT NULL;`), '1');
});

test('ordinary reviewers lack merchant:suspend; request identity/scopes cannot be supplied in JSON', async () => {
    const j = await journey('viewer');
    assert.equal((await j.create()).status, 403); unchanged(j);
    const injected = await j.gateway.request('/v1/internal/console/approvals', { method: 'POST', headers: j.maker.headers,
        body: JSON.stringify({ ...j.intent, role: 'super_admin', scopes: ['merchant:suspend'], actor_id: j.checker.id }) });
    assert.equal(injected.status, 400); unchanged(j);
});

test('self approval, ordinary lead consent and a real pre-MFA super-admin session are denied', async () => {
    const j = await journey('super'), a = await requested(j), lead = await j.actor('lead'), preMfa = await j.actor('super', false);
    assert.equal((await j.decide(a.id, a.payload_hash, 'approve', j.maker.headers)).status, 403);
    assert.equal((await j.decide(a.id, a.payload_hash, 'approve', lead.headers)).status, 403);
    assert.equal((await j.decide(a.id, a.payload_hash, 'approve', preMfa.headers)).status, 428);
    assert.equal(owned.psql(`SELECT status FROM sensitive_action_approvals WHERE id='${a.id}';`), 'pending'); unchanged(j);
});

test('the exact reviewed hash, action, reason, target and requester must all match before effects', async () => {
    const j = await journey(), a = await requested(j);
    assert.equal((await j.decide(a.id, '0'.repeat(64))).status, 409);
    assert.equal((await j.decide(a.id, a.payload_hash)).status, 200);
    const rival = newSyntheticTenant('consent-rival'); seedSyntheticTenant(owned.psql, rival);
    for (const body of [{ action: 'restore' }, { reason: 'A different unauthorized explanation' }, { actor_id: j.checker.id }]) {
        assert.ok([403, 409].includes((await j.apply(a.id, body)).status)); unchanged(j);
    }
    assert.equal((await j.apply(a.id, {}, j.maker.headers, rival.siteId)).status, 409);
    assert.equal((await j.apply(a.id, { actor_id: j.checker.id }, j.checker.headers)).status, 403);
    assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${rival.siteId}';`), 'published'); unchanged(j);
});

test('request retries preserve intent and return the same record; changed reason conflicts', async () => {
    const j = await journey(), responses = await Promise.all([j.create(), j.create()]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
    assert.equal(responses[0].json?.data.approval.id, responses[1].json?.data.approval.id);
    assert.equal((await j.create({ ...j.intent, reason: 'Different request intent on the same key' })).status, 409);
    assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE maker_actor_id='${j.maker.id}' AND request_key='${j.intent.request_key}';`), '1'); unchanged(j);
});

test('two eligible approvers racing cannot replace the winning independent consent', async () => {
    const j = await journey(), a = await requested(j), other = await j.actor('super');
    const results = await Promise.all([j.decide(a.id, a.payload_hash), j.decide(a.id, a.payload_hash, 'approve', other.headers)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${a.id}' AND action='sensitive_action.approved';`), '1');
    assert.equal((await j.apply(a.id)).status, 200); assert.equal(j.count(), '1');
});

test('two worker instances racing execute one atomic effect and return the stored receipt', async () => {
    const j = await journey(), a = await approved(j), second = new Gateway(j.env);
    const results = await Promise.all([j.apply(a.id), j.apply(a.id, {}, j.maker.headers, j.tenant.siteId, second)]);
    assert.deepEqual(results.map(r => r.status), [200, 200]);
    assert.deepEqual(results.map(r => r.json?.data.replayed).sort(), [false, true]); assert.equal(j.count(), '1');
});

test('a revoked/re-added approver and a new requester session cannot reuse an old approval', async () => {
    const j = await journey(), a = await approved(j);
    owned.psql(`UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${j.checker.id}';
        UPDATE super_admin_allowlist SET is_active=true WHERE user_id='${j.checker.id}';`);
    assert.equal((await j.apply(a.id)).status, 428); unchanged(j);
    const fresh = await j.reauthenticate(j.maker);
    assert.equal((await j.apply(a.id)).status, 401);
    assert.equal((await j.apply(a.id, {}, fresh.headers)).status, 403); unchanged(j);
});

test('revocation committed after Gateway scope resolution but before SQL effects is enforced', async () => {
    const j = await journey(), a = await approved(j); let changed = false;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'rpc/execute_console_merchant_moderation_v1' && !changed) {
            changed = true; owned.psql(`UPDATE employees SET role='viewer' WHERE user_id='${j.maker.id}' AND store_id IS NULL;`);
        }
        return forward();
    });
    try { assert.equal((await j.apply(a.id)).status, 401); }
    finally { tap.restore(); }
    assert.equal(changed, true); unchanged(j);
});

test('a named role definition change revokes only the affected session before execution', async () => {
    const j = await journey('viewer'), role = crypto.randomUUID();
    owned.psql(`INSERT INTO employee_roles(id,name,display_name,permissions) VALUES('${role}','syn-${role}','Synthetic protected scope','["merchant:suspend"]');
        UPDATE employees SET role_id='${role}' WHERE user_id='${j.maker.id}';`);
    Object.assign(j.maker, await j.signIn(j.maker));
    const a = await approved(j);
    owned.psql(`UPDATE employee_roles SET permissions='[]'::jsonb WHERE id='${role}';`);
    assert.equal((await j.apply(a.id)).status, 401); unchanged(j);
    assert.equal((await j.gateway.request('/v1/internal/console/sessions/current', { headers: j.checker.headers })).status, 200,
        'an unrelated super admin session is preserved');
});

test('an aged MFA cannot request; independent consent shortens to its real remaining window and then expires', async () => {
    const j = await journey(), stale = await j.seedAgedSession(j.maker, 601);
    assert.equal((await j.gateway.request('/v1/internal/console/approvals', { method: 'POST', headers: stale.headers, body: JSON.stringify(j.intent) })).status, 428);
    const agedChecker = await j.seedAgedSession(j.checker, 595), a = await requested(j);
    const consent = await j.decide(a.id, a.payload_hash, 'approve', agedChecker.headers);
    assert.equal(consent.status, 200, consent.text);
    const expiry = Date.parse(consent.json!.data.approval.expires_at);
    assert.ok(expiry < Date.parse(a.expires_at) && expiry - Date.now() <= 5_000);
    await new Promise(resolve => setTimeout(resolve, Math.max(0, expiry - Date.now()) + 100));
    const denied = await j.apply(a.id);
    assert.equal(denied.status, 428); assert.equal(denied.json?.error?.code, 'APPROVAL_EXPIRED_OR_REVOKED'); unchanged(j);
});

test('a mandatory audit outage rolls back site state and consumption, then the same approval recovers once', async () => {
    const j = await journey(), a = await approved(j);
    owned.script(`CREATE FUNCTION public.synthetic_audit_insertion_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic mandatory audit outage';END$$;CREATE TRIGGER synthetic_audit_insertion_fault BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.synthetic_audit_insertion_fault();`);
    try {
        assert.equal((await j.apply(a.id)).status, 503);
        assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${j.tenant.siteId}';`), 'published');
        assert.equal(owned.psql(`SELECT consumed_at IS NULL AND result IS NULL FROM sensitive_action_approvals WHERE id='${a.id}';`), 't');
    } finally { owned.script('DROP TRIGGER synthetic_audit_insertion_fault ON public.audit_logs;DROP FUNCTION public.synthetic_audit_insertion_fault();'); }
    assert.equal((await j.apply(a.id)).status, 200); assert.equal((await j.apply(a.id)).status, 200); assert.equal(j.count(), '1');
});

test('a receipt-write fault rolls back the preceding site mutation and mandatory audit', async () => {
    const j = await journey(), a = await approved(j);
    owned.script(`CREATE FUNCTION public.synthetic_approval_receipt_fault() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.id='${a.id}'::uuid AND NEW.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'synthetic receipt outage'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER synthetic_approval_receipt_fault BEFORE UPDATE ON sensitive_action_approvals
        FOR EACH ROW EXECUTE FUNCTION public.synthetic_approval_receipt_fault();`);
    try { assert.equal((await j.apply(a.id)).status, 503); unchanged(j); }
    finally { owned.script('DROP TRIGGER synthetic_approval_receipt_fault ON sensitive_action_approvals; DROP FUNCTION public.synthetic_approval_receipt_fault();'); }
    assert.equal((await j.apply(a.id)).status, 200); assert.equal(j.count(), '1');
});

test('rejection and requester cancellation never authorize effects', async () => {
    for (const decision of ['reject', 'cancel']) {
        const j = await journey(), a = await requested(j);
        const headers = decision === 'cancel' ? j.maker.headers : j.checker.headers;
        assert.equal((await j.decide(a.id, a.payload_hash, decision, headers)).status, 200);
        assert.equal((await j.decide(a.id, a.payload_hash, decision, headers)).status, 200);
        assert.equal((await j.apply(a.id)).status, 428); unchanged(j);
    }
});

test('ownership-filtered reads do not expose another lead request; changed merchant state requires a new request', async () => {
    const j = await journey(), a = await approved(j), other = await j.actor('lead');
    assert.equal((await j.gateway.request('/v1/internal/console/approvals/' + a.id, { headers: other.headers })).status, 404);
    const own = await j.gateway.request('/v1/internal/console/approvals', { headers: other.headers });
    assert.equal(own.status, 200); assert.deepEqual(own.json?.data.approvals, []);
    owned.psql(`UPDATE sites SET name='Synthetic changed merchant' WHERE id='${j.tenant.siteId}';`);
    assert.equal((await j.apply(a.id)).status, 409); unchanged(j);
});

test('intent and consumed receipts are immutable, and retained consent blocks destructive rollback', async () => {
    const j = await journey(), a = await approved(j);
    for (const sql of [ `UPDATE sensitive_action_approvals SET reason='Synthetic tampered reason' WHERE id='${a.id}';`,
        `UPDATE sensitive_action_approvals SET payload='{}'::jsonb WHERE id='${a.id}';`, `DELETE FROM sensitive_action_approvals WHERE id='${a.id}';` ]) {
        assert.match(owned.psqlExpectError(sql), /immutable|retained/);
    }
    assert.equal((await j.apply(a.id)).status, 200);
    assert.match(owned.psqlExpectError(`UPDATE sensitive_action_approvals SET result='{}'::jsonb WHERE id='${a.id}';`), /immutable/);
    const before = owned.psql(`SELECT to_jsonb(a)::text FROM sensitive_action_approvals a WHERE id='${a.id}';`);
    assert.match(owned.psqlExpectError(readFileSync('database/supabase/rollback/315_session_bound_sensitive_approvals.rollback.sql', 'utf8')), /refuses retained/);
    assert.equal(owned.psql(`SELECT to_jsonb(a)::text FROM sensitive_action_approvals a WHERE id='${a.id}';`), before);
    assert.match(owned.psqlExpectError(readFileSync('database/supabase/migrations/315_session_bound_sensitive_approvals.sql','utf8')),/refuses later trust/);
    const migration = readFileSync('database/supabase/migrations/318_session_bound_trust_reinstatement.sql', 'utf8');
    await Promise.all([owned.psqlAsync(migration), owned.psqlAsync(migration)]);
    assert.equal(owned.psql(`SELECT to_jsonb(a)::text FROM sensitive_action_approvals a WHERE id='${a.id}';`), before);
});

test('restore needs its own independently approved intent and cannot republish a draft', async () => {
    const j = await journey(), suspension = await approved(j);
    assert.equal((await j.apply(suspension.id)).status, 200);
    assert.equal((await j.apply(suspension.id, { action: 'restore' })).status, 409);
    const requestedRestore = await j.create({ ...j.intent, action: 'merchant.restore', request_key: crypto.randomUUID() });
    assert.equal(requestedRestore.status, 201, requestedRestore.text);
    const restore = requestedRestore.json!.data.approval;
    assert.equal((await j.decide(restore.id, restore.payload_hash)).status, 200);
    assert.equal((await j.apply(restore.id, { action: 'restore' })).status, 200);
    assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${j.tenant.siteId}';`), 'published');
    assert.equal(owned.psql(`SELECT published FROM sites WHERE id='${j.tenant.siteId}';`),'t','manual restoration republishes the reviewed merchant');
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${j.tenant.siteId}' AND action='merchant.restore';`), '1');
    owned.psql(`UPDATE sites SET status='draft',published=false WHERE id='${j.tenant.siteId}';`);
    assert.equal((await j.create({ ...j.intent, action: 'merchant.restore', request_key: crypto.randomUUID() })).status, 409);
});

test('a global role grant deletion revokes the old cookie and removes the permission after new sign-in', async () => {
    const j = await journey('viewer'), grant = crypto.randomUUID();
    owned.psql(`INSERT INTO employee_permissions(id,role,permission) VALUES('${grant}','viewer','merchant:suspend');`);
    Object.assign(j.maker, await j.signIn(j.maker));
    const a = await approved(j);
    owned.psql(`DELETE FROM employee_permissions WHERE id='${grant}';`);
    assert.equal((await j.apply(a.id)).status, 401); unchanged(j);
    Object.assign(j.maker, await j.signIn(j.maker));
    assert.equal((await j.create({ ...j.intent, request_key: crypto.randomUUID() })).status, 403); unchanged(j);
});

test('break-glass scope changes cannot leave a stale protected-action grant alive', async () => {
    const j = await journey('viewer'), grantor = await j.actor('lead'), grant = crypto.randomUUID();
    const employee = owned.psql(`SELECT id FROM employees WHERE user_id='${j.maker.id}' AND store_id IS NULL;`);
    const grantedBy = owned.psql(`SELECT id FROM employees WHERE user_id='${grantor.id}' AND store_id IS NULL;`);
    owned.psql(`INSERT INTO break_glass_grants(id,employee_id,scope,reason,granted_by,expires_at)
        VALUES('${grant}','${employee}','merchant:suspend','Synthetic temporary scope grant','${grantedBy}',now()+interval '1 hour');`);
    Object.assign(j.maker, await j.signIn(j.maker));
    const a = await approved(j);
    assert.equal(owned.psql(`SELECT used_at IS NOT NULL FROM break_glass_grants WHERE id='${grant}';`), 't');
    owned.psql(`UPDATE break_glass_grants SET scope='merchant:view' WHERE id='${grant}';`);
    assert.equal((await j.apply(a.id)).status, 401); unchanged(j);
    Object.assign(j.maker, await j.signIn(j.maker));
    assert.equal((await j.create({ ...j.intent, request_key: crypto.randomUUID() })).status, 403); unchanged(j);
});

test('actual ordinary roles cannot invoke any protocol helper or forge approval through a valid store context', async () => {
    const j = await journey(), a = await requested(j);
    const names = ['console_permission_snapshot_v1','revoke_console_permission_sessions_v1','console_approval_payload_hash_v1',
        'protect_sensitive_approval_v1','console_approval_view_v1','create_console_approval_v1','decide_console_approval_v1',
        'execute_console_merchant_moderation_v1','read_console_approvals_v1'];
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.equal(owned.psql(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname IN (${names.map(name => "'" + name + "'").join(',')}) AND has_function_privilege('${role}',p.oid,'EXECUTE');`), '0');
        const prefix = `BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('app.site_id','${j.tenant.siteId}',true);
            SELECT set_config('request.jwt.claims','{"sub":"${j.maker.id}"}',true);`;
        assert.match(owned.psqlExpectError(prefix + `SELECT public.execute_console_merchant_moderation_v1(NULL,NULL,NULL,'${a.id}','${j.tenant.siteId}','suspend','Synthetic forced effect'); ROLLBACK;`), /permission denied/);
        assert.match(owned.psqlExpectError(prefix + `UPDATE sensitive_action_approvals SET status='approved' WHERE id='${a.id}'; ROLLBACK;`), /permission denied/);
    }
    unchanged(j);
});

test('Merchant 360 reads only the named site risk under live PII/risk scopes and audits the actual actor', async () => {
    const j = await journey(), viewer = await j.actor('viewer'), risk = crypto.randomUUID(), foreignRisk = crypto.randomUUID();
    const other = newSyntheticTenant('risk-foreign'); seedSyntheticTenant(owned.psql, other);
    owned.psql(`INSERT INTO risk_scores(id,site_id,entity_type,entity_id,score,band) VALUES
        ('${risk}',NULL,'site','${j.tenant.siteId}',12,'low'),('${foreignRisk}',NULL,'site','${other.siteId}',99,'high');`);
    const path = `/v1/internal/console/merchants/${j.tenant.siteId}/overview?actor_id=${j.checker.id}`;
    const read = await j.gateway.request(path, { headers: j.maker.headers });
    assert.equal(read.status, 200, read.text);
    assert.equal(read.json?.data.trust.risk_score.id, risk);
    assert.notEqual(read.json?.data.trust.risk_score.id, foreignRisk);
    assert.equal((await j.gateway.request(path, { headers: viewer.headers })).status, 403);
    const serviceOnly = { ...j.maker.headers }; delete (serviceOnly as Record<string, string>)['X-Platform-Console-Session'];
    assert.equal((await j.gateway.request(path, { headers: serviceOnly })).status, 401);
    assert.equal(owned.psql(`SELECT actor_id FROM audit_logs WHERE resource_id='${j.tenant.siteId}' AND action='merchant.view' ORDER BY created_at DESC LIMIT 1;`), j.maker.id,
        'a typed actor query cannot forge sensitive-read attribution');
});
