// Real worker/PostgREST/PostgreSQL. Synthetic reconciliation projection rows
// represent pre-existing breaks; no provider movement or accounting entry is
// invented. The tests drive the actual operator mutation and its mandatory audit.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { InternalSensitiveApprovalSchema } from '@letbuyy/shared-types';
import { consoleFixture } from './console-session-fixture';
import { Gateway, tapRest } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase(); let sequence = 0;
async function journey(kind: 'super' | 'lead' | 'viewer' = 'super') {
    const f = await consoleFixture(owned), maker = await f.actor(kind), checker = await f.actor('super');
    const tenant = newSyntheticTenant('money-consent-' + (++sequence)); seedSyntheticTenant(owned.psql, tenant);
    owned.psql(`INSERT INTO money_ledger_site_reconciliations(site_id,status,wallet_available_minor,ledger_merchant_payable_minor,variance_minor)
        VALUES('${tenant.siteId}','mismatch',500,0,-500);`);
    const body = { actor_id: maker.id, actor_email: maker.email, secondary_approver_id: checker.id,
        reason: 'Synthetic independently reviewed money break', resolution: 'acknowledge_suspense', provider_reference: 'synthetic-review-reference' };
    const apply = (headers: Record<string,string> = maker.headers, extra: Record<string,unknown> = {}, siteId = tenant.siteId, worker = f.gateway) => worker.request(`/v1/internal/console/money/reconciliation/${siteId}/resolve`, {
        method: 'POST', headers, body: JSON.stringify({ ...body, ...extra }) });
    const unchanged = () => {
        assert.equal(owned.psql(`SELECT count(*) FROM money_ledger_site_reconciliations WHERE site_id='${tenant.siteId}' AND metadata ? 'operator_resolution';`), '0');
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${tenant.siteId}' AND action='money_ledger.breaks.resolve';`), '0');
    };
    const intent = { action: 'money.reconciliation.resolve', resource_id: tenant.siteId, reason: body.reason,
        request_key: crypto.randomUUID(), payload: { resolution: body.resolution, provider_reference: body.provider_reference,
            suspense_ledger_transaction_id: null } };
    const create = (value: Record<string,unknown> = intent, headers: Record<string,string> = maker.headers) => f.gateway.request('/v1/internal/console/approvals', {
        method: 'POST', headers, body: JSON.stringify(value) });
    const decide = (id: string, hash: string, headers: Record<string,string> = checker.headers) => f.gateway.request('/v1/internal/console/approvals/' + id + '/decision', {
        method: 'POST', headers, body: JSON.stringify({ decision: 'approve', payload_hash: hash }) });
    return { ...f, maker, checker, tenant, body, intent, create, decide, apply, unchanged };
}
test('money break resolution refuses an eligible typed approver UUID without actual consent', async () => {
    const j = await journey(), response = await j.apply();
    console.info('OWNED_MONEY_TYPED_ID ' + JSON.stringify({ response: response.status,
        resolutionRows: owned.psql(`SELECT count(*) FROM money_ledger_site_reconciliations WHERE site_id='${j.tenant.siteId}' AND metadata ? 'operator_resolution';`) }));
    assert.ok([403,428].includes(response.status), response.text); j.unchanged();
});
test('a Console bridge and supplied actor fields do not replace the actual human session', async () => {
    const j = await journey(), headers: Record<string,string> = { ...j.maker.headers }; delete headers['X-Platform-Console-Session'];
    const response = await j.apply(headers);
    assert.ok([401,403].includes(response.status), response.text); j.unchanged();
});
test('the accepted developer/app ecosystem remains frozen without any activation flag', async () => {
    const j = await journey(); assert.equal(j.env.FEATURE_APP_PLATFORM, undefined);
    for (const path of [`/v1/operations/developers/${crypto.randomUUID()}/moderate`,
        `/v1/operations/developers/${crypto.randomUUID()}/payouts/${crypto.randomUUID()}/release`]) {
        const response = await j.gateway.request(path, { method: 'POST', headers: j.maker.headers, body: JSON.stringify(j.body) });
        assert.equal(response.status,404,response.text); assert.equal(response.json?.error?.code,'APP_PLATFORM_DISABLED');
    }
    j.unchanged();
});

// Expanded current-protocol proof follows the retained three-failure baseline.

async function requested(j: Awaited<ReturnType<typeof journey>>, intent: Record<string,unknown> = j.intent) {
    const response = await j.create(intent); assert.equal(response.status,201,response.text);
    return InternalSensitiveApprovalSchema.parse(response.json?.data.approval);
}
async function approved(j: Awaited<ReturnType<typeof journey>>, intent: Record<string,unknown> = j.intent) {
    const a = await requested(j,intent); assert.equal((await j.decide(a.id,a.payload_hash)).status,200); j.unchanged(); return a;
}
for (const resolution of ['acknowledge_suspense','provider_explained','request_recheck']) {
    test(`independent money consent atomically executes ${resolution} without inventing a journal adjustment`, async () => {
        const j = await journey(), intent = { ...j.intent, payload: { ...j.intent.payload, resolution } }, a = await approved(j,intent);
        const journalCount = owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${j.tenant.siteId}';`);
        const response = await j.apply(j.maker.headers,{ approval_id: a.id, resolution }); assert.equal(response.status,200,response.text);
        assert.equal(response.json?.data.replayed,false);
        assert.equal(response.json?.data.resolution.actor_id,j.maker.id); assert.equal(response.json?.data.resolution.secondary_approver_id,j.checker.id);
        assert.equal(response.json?.data.reconciliation.status,resolution === 'request_recheck' ? 'verified' : 'mismatch');
        assert.equal(owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${j.tenant.siteId}';`),journalCount);
        assert.equal((await j.apply(j.maker.headers,{ approval_id: a.id, resolution })).json?.data.replayed,true);
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${j.tenant.siteId}' AND action IN ('money_ledger.breaks.resolve','money_ledger.reconciliation.recheck_requested');`),'1');
        assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE id='${a.id}' AND consumed_at IS NOT NULL;`),'1');
    });
}
test('limited reviewers/leads cannot resolve money without the named canonical scope or supply their own role', async () => {
    const j = await journey('lead'); assert.equal((await j.create()).status,403); j.unchanged();
    assert.equal((await j.create({ ...j.intent, role: 'super_admin', scopes: ['money:reconcile'] })).status,400);
    const viewer = await j.actor('viewer'); assert.equal((await j.create(j.intent,viewer.headers)).status,403);
});
test('exact resolution, reason, provider reference, site and requester are bound to the independently reviewed payload', async () => {
    const j = await journey(), a = await approved(j), other = newSyntheticTenant('money-wrong-site'); seedSyntheticTenant(owned.psql,other);
    for (const extra of [{ reason: 'Different unreviewed explanation' },{ resolution: 'request_recheck' },{ provider_reference: 'different-provider-evidence' },{ actor_id: j.checker.id }]) {
        assert.ok([403,409].includes((await j.apply(j.maker.headers,{ approval_id: a.id, ...extra })).status)); j.unchanged();
    }
    assert.equal((await j.apply(j.maker.headers,{ approval_id: a.id },other.siteId)).status,409); j.unchanged();
    assert.equal((await j.apply(j.checker.headers,{ approval_id: a.id })).status,403); j.unchanged();
});
test('self, ordinary checker and unreviewed hashes cannot create independent money consent', async () => {
    const j = await journey(), a = await requested(j), lead = await j.actor('lead');
    assert.equal((await j.decide(a.id,a.payload_hash,j.maker.headers)).status,403);
    assert.equal((await j.decide(a.id,a.payload_hash,lead.headers)).status,403);
    assert.equal((await j.decide(a.id,'0'.repeat(64))).status,409);
    assert.equal((await j.apply(j.maker.headers,{ approval_id: a.id })).status,428); j.unchanged();
});
test('concurrent creation and separate-worker execution return one request and one atomic money effect', async () => {
    const j = await journey(), created = await Promise.all([j.create(),j.create()]);
    assert.deepEqual(created.map(r=>r.status).sort(),[200,201]);
    const a = InternalSensitiveApprovalSchema.parse(created[0].json?.data.approval);
    assert.equal(created[1].json?.data.approval.id,a.id);
    assert.equal((await j.create({ ...j.intent, payload: { ...j.intent.payload, resolution: 'request_recheck' } })).status,409);
    assert.equal((await j.decide(a.id,a.payload_hash)).status,200);
    const second = new Gateway(j.env), results = await Promise.all([j.apply(j.maker.headers,{ approval_id: a.id }),j.apply(j.maker.headers,{ approval_id: a.id },j.tenant.siteId,second)]);
    assert.deepEqual(results.map(r=>r.status),[200,200]); assert.deepEqual(results.map(r=>r.json?.data.replayed).sort(),[false,true]);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${j.tenant.siteId}' AND action='money_ledger.breaks.resolve';`),'1');
});
test('a failed mandatory audit rolls back annotation and receipt, then recovers on the same approval', async () => {
    const j = await journey(), a = await approved(j);
    owned.psql('ALTER TABLE audit_logs RENAME TO audit_logs_money_fault;');
    try { assert.equal((await j.apply(j.maker.headers,{ approval_id: a.id })).status,503);
        assert.equal(owned.psql(`SELECT count(*) FROM money_ledger_site_reconciliations WHERE site_id='${j.tenant.siteId}' AND metadata ? 'operator_resolution';`),'0');
        assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE id='${a.id}' AND consumed_at IS NOT NULL;`),'0');
    } finally { owned.psql('ALTER TABLE audit_logs_money_fault RENAME TO audit_logs;'); }
    assert.equal((await j.apply(j.maker.headers,{ approval_id: a.id })).status,200);
});
test('revoked checker membership cannot revive old money consent after re-addition', async () => {
    const j = await journey(), a = await approved(j);
    owned.psql(`UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${j.checker.id}';`);
    assert.equal((await j.apply(j.maker.headers,{ approval_id: a.id })).status,428); j.unchanged();
    owned.psql(`UPDATE super_admin_allowlist SET is_active=true WHERE user_id='${j.checker.id}';`);
    assert.equal((await j.apply(j.maker.headers,{ approval_id: a.id })).status,428); j.unchanged();
});
test('a refreshed maker session and a changed projection require a new independently reviewed request', async () => {
    const j = await journey(), a = await approved(j), fresh = await j.signIn(j.maker);
    assert.equal((await j.apply(fresh.headers,{ approval_id: a.id })).status,403); j.unchanged();
    const k = await journey(), b = await approved(k);
    owned.psql(`UPDATE money_ledger_site_reconciliations SET variance_minor=-501 WHERE site_id='${k.tenant.siteId}';`);
    assert.equal((await k.apply(k.maker.headers,{ approval_id: b.id })).status,409); k.unchanged();
});
test('unknown journal references and already-verified rows cannot become money-review evidence', async () => {
    const j = await journey();
    assert.equal((await j.create({ ...j.intent,payload:{ ...j.intent.payload,suspense_ledger_transaction_id:crypto.randomUUID() } })).status,409); j.unchanged();
    owned.psql(`SELECT refresh_money_ledger_site_reconciliation('${j.tenant.siteId}');`);
    assert.equal((await j.create()).status,409); j.unchanged();
});
test('the paginated money read uses actual live financial scope and audits the actual human actor', async () => {
    const j = await journey(), r = await j.gateway.request(`/v1/internal/console/money/reconciliation?status=mismatch&site_id=${j.tenant.siteId}&reason=Synthetic%20review&actor_id=${j.checker.id}`, { headers:j.maker.headers });
    assert.equal(r.status,200,r.text); assert.equal(r.json?.data.length,1); assert.equal(r.json?.data[0].site_id,j.tenant.siteId);
    assert.equal(owned.psql(`SELECT actor_id FROM audit_logs WHERE action='money_ledger.breaks.read' AND resource_id='${j.tenant.siteId}';`),j.maker.id);
    const staff=await j.actor('lead');
    const read=await j.gateway.request(`/v1/internal/console/money/reconciliation?site_id=${j.tenant.siteId}`,{ headers:staff.headers });
    assert.equal(read.status,200,read.text);
    assert.equal(owned.psql(`SELECT actor_type FROM audit_logs WHERE action='money_ledger.reconciliation.read' AND actor_id='${staff.id}' AND resource_id='${j.tenant.siteId}';`),'employee');
    const headers: Record<string,string>={...j.maker.headers}; delete headers['X-Platform-Console-Session'];
    assert.equal((await j.gateway.request('/v1/internal/console/money/reconciliation',{ headers })).status,401);
});
test('actual ordinary database roles cannot call either money authority even with a valid site context', async () => {
    const j = await journey();
    for (const role of ['anon','authenticated','app_tenant']) for (const signature of [
        'public.create_console_money_approval_v1(uuid,text,text,uuid,text,uuid,jsonb)',
        'public.execute_console_money_resolution_v1(uuid,text,text,uuid,uuid,text,jsonb)']) {
        assert.equal(owned.psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE');`),'f');
        const fn=signature.split('(')[0];
        const args=fn.includes('create_') ? `NULL::uuid,NULL::text,NULL::text,'${j.tenant.siteId}'::uuid,NULL::text,NULL::uuid,'{}'::jsonb` : `NULL::uuid,NULL::text,NULL::text,NULL::uuid,'${j.tenant.siteId}'::uuid,NULL::text,'{}'::jsonb`;
        assert.match(owned.psqlExpectError(`BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('app.site_id','${j.tenant.siteId}',true); SELECT ${fn}(${args}); ROLLBACK;`),/permission denied/);
    }
});
test('money evidence prevents destructive rollback and survives concurrent forward reapply', async () => {
    const j = await journey(), a = await approved(j); assert.equal((await j.apply(j.maker.headers,{ approval_id:a.id })).status,200);
    const before=owned.psql(`SELECT to_jsonb(a)::text FROM sensitive_action_approvals a WHERE id='${a.id}';`);
    assert.match(owned.psqlExpectError(readFileSync('database/supabase/rollback/316_session_bound_money_resolution.rollback.sql','utf8')),/refuses retained/);
    const migration=readFileSync('database/supabase/migrations/316_session_bound_money_resolution.sql','utf8');
    await Promise.all([owned.psqlAsync(migration),owned.psqlAsync(migration)]);
    assert.equal(owned.psql(`SELECT to_jsonb(a)::text FROM sensitive_action_approvals a WHERE id='${a.id}';`),before);
});

test('failure to save the money consumption receipt rolls back its annotation and audit before retry', async () => {
    const j=await journey(), a=await approved(j);
    owned.psql(`CREATE FUNCTION public.synthetic_money_receipt_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.id='${a.id}' AND NEW.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'Synthetic receipt unavailable'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER synthetic_money_receipt_fault BEFORE UPDATE ON sensitive_action_approvals FOR EACH ROW EXECUTE FUNCTION synthetic_money_receipt_fault();`);
    try { assert.equal((await j.apply(j.maker.headers,{ approval_id:a.id })).status,503); j.unchanged();
        assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE id='${a.id}' AND consumed_at IS NOT NULL;`),'0');
    } finally { owned.psql('DROP TRIGGER synthetic_money_receipt_fault ON sensitive_action_approvals; DROP FUNCTION synthetic_money_receipt_fault();'); }
    assert.equal((await j.apply(j.maker.headers,{ approval_id:a.id })).status,200);
});
test('money execution refuses the actual remaining checker MFA window after consent expires', async () => {
    const j=await journey(), a=await requested(j), aged=await j.seedAgedSession(j.checker,595);
    assert.equal((await j.decide(a.id,a.payload_hash,aged.headers)).status,200);
    await owned.psqlAsync('SELECT pg_sleep(6);');
    assert.equal((await j.apply(j.maker.headers,{ approval_id:a.id })).status,428); j.unchanged();
});
test('a named money permission works, and removing it between Gateway resolution and SQL effect denies all writes', async () => {
    const j=await journey('lead');
    owned.psql(`UPDATE employees SET permissions='["money:reconcile"]'::jsonb WHERE user_id='${j.maker.id}' AND store_id IS NULL;`);
    const fresh=await j.signIn(j.maker), r=await j.create(j.intent,fresh.headers); assert.equal(r.status,201,r.text);
    const a=InternalSensitiveApprovalSchema.parse(r.json?.data.approval); assert.equal((await j.decide(a.id,a.payload_hash)).status,200);
    const tap=tapRest(owned.restUrl,async(call,forward)=>{
        if(call.resource==='rpc/execute_console_money_resolution_v1') owned.psql(`UPDATE employees SET permissions='[]'::jsonb WHERE user_id='${j.maker.id}' AND store_id IS NULL;`);
        return forward();
    });
    try { assert.ok([401,403].includes((await j.apply(fresh.headers,{ approval_id:a.id })).status)); j.unchanged(); }
    finally { tap.restore(); }
});

test('a money-projection read outage fails closed without an empty success or raw storage details',async()=>{
    const j=await journey(), tap=tapRest(owned.restUrl,async(call,forward)=>call.resource==='money_ledger_site_reconciliations'&&call.method==='GET'
        ?new Response(JSON.stringify({code:'42P01',message:'Synthetic private storage detail: relation missing'}),{status:500,headers:{'content-type':'application/json'}}):forward());
    try {
        const response=await j.gateway.request(`/v1/internal/console/money/reconciliation?site_id=${j.tenant.siteId}`,{headers:j.maker.headers});
        assert.equal(response.status,503,response.text); assert.notEqual(response.json?.success,true);
        assert.doesNotMatch(response.text,/Synthetic private storage detail/);
    } finally {tap.restore();}
});
