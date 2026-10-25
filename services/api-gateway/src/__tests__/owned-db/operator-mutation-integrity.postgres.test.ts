// Real worker, fresh signed operator identity, owned PostgREST/Postgres. Service role bypasses RLS.
// Named trigger faults prove rollback; tapRest only holds concurrency or loses a committed response.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { before } from 'node:test';
import {setTimeout as pause} from 'node:timers/promises';
import { LetbuyyApiClient } from '@letbuyy/api-client';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, queryJson, tapRest, newBarrier, restJson } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const { psql } = owned;
const OPS = '/v1/operations/support';
const reason = 'Handling a synthetic queued request';
let gateway: Gateway;
const actor = { id: crypto.randomUUID(), email: `mutation-${crypto.randomUUID()}@example.invalid` };
before(async () => {
    psql(`INSERT INTO users_custom (id,email,email_verified) VALUES ('${actor.id}','${actor.email}',true);
        INSERT INTO employees (user_id,email,role,store_id,status,is_active) VALUES ('${actor.id}','${actor.email}','manager',NULL,'active',true);`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
});
async function send(path: string, body: unknown, key = crypto.randomUUID(), method = 'POST') {
    // Real limiter: a 15-point mutation consumes 750ms at its 20-point/s refill.
    await pause(800);
    const response = await gateway.request(`${OPS}${path}`, { method, headers: { ...await signedIdentityHeaders(actor.id, actor.email), 'Idempotency-Key': key }, body: JSON.stringify(body) });
    await gateway.settle();
    return response;
}
function count(table: string, predicate = 'true') { return Number(psql(`SELECT count(*) FROM ${table} WHERE ${predicate}`)); }
const input = () => ({ subject: `Synthetic mutation ${crypto.randomUUID()}`, body: 'A synthetic question', reason });

test('create retry returns the same receipt and creates one ticket, requester message, clocks and audit', async () => {
    const body = input(); const key = crypto.randomUUID();
    const first = await send('/tickets', body, key);
    const second = await send('/tickets', body, key);
    assert.equal(first.status, 201); assert.equal(second.status, 201);
    assert.deepEqual(second.json, first.json);
    const id = first.json!.data.ticket.id;
    assert.equal(count('support_tickets', `subject='${body.subject}'`), 1);
    assert.equal(count('ticket_messages', `ticket_id='${id}'`), 1);
    assert.equal(count('ticket_sla_clocks', `ticket_id='${id}'`), 2);
    assert.equal(count('audit_logs', `resource_id='${id}' AND action='support.ticket.create'`), 1);
});

test('mandatory audit failure rolls back creation; retry after repair succeeds once', async () => {
    const body = input(); const key = crypto.randomUUID();
    psql(`CREATE FUNCTION public.synthetic_mutation_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.action='support.ticket.create' THEN RAISE EXCEPTION 'synthetic mandatory audit fault'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER synthetic_mutation_fault BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.synthetic_mutation_fault();`);
    try {
        const failed = await send('/tickets', body, key);
        assert.equal(failed.status, 500);
        assert.equal(count('support_tickets', `subject='${body.subject}'`), 0);
    } finally { psql('DROP TRIGGER synthetic_mutation_fault ON public.audit_logs; DROP FUNCTION public.synthetic_mutation_fault();'); }
    assert.equal((await send('/tickets', body, key)).status, 201);
    assert.equal(count('support_tickets', `subject='${body.subject}'`), 1);
});

test('all seven actions replay exactly once, including internal notes, survey tokens, CSAT and macro creation', async () => {
    const created = await send('/tickets', input()); const id = created.json!.data.ticket.id;
    const steps: [string, Record<string, unknown>, string][] = [
        [`/tickets/${id}/messages`, { body: 'An internal synthetic note', visibility: 'internal', reason }, 'POST'],
        [`/tickets/${id}/assign`, { assignee_id: null, reason }, 'PATCH'],
        [`/tickets/${id}/escalate`, { target: 'trust_safety', reason }, 'POST'],
        [`/tickets/${id}/resolve`, { resolution_note: 'Synthetic resolution', reason }, 'POST'],
        [`/tickets/${id}/csat`, { score: 5, comment: 'Synthetic feedback', reason }, 'POST'],
        ['/macros', { name: `Synthetic macro ${crypto.randomUUID()}`, body: 'Synthetic answer', reason }, 'POST'],
    ];
    for (const [path, body, method] of steps) {
        const key = crypto.randomUUID();
        const first = await send(path, body, key, method); const retry = await send(path, body, key, method);
        assert.ok(first.status === 200 || first.status === 201, JSON.stringify(first.json));
        assert.equal(retry.status, first.status); assert.deepEqual(retry.json, first.json, path);
        const changed = await send(path, { ...body, reason: `${reason} changed` }, key, method);
        assert.equal(changed.status, 409, path);
        assert.equal(count('support_mutation_receipts', `actor_id='${actor.id}' AND idempotency_key='${key}'`), 1);
    }
    assert.equal(count('ticket_csat', `ticket_id='${id}'`), 1);
    assert.equal(count('ts_cases', `metadata->>'support_ticket_id'='${id}'`), 1);
    for (const action of ['internal_note', 'assign', 'escalate', 'resolve']) {
        assert.equal(count('audit_logs', `resource_id='${id}' AND action='support.ticket.${action}'`), 1);
    }
});

test('four concurrent duplicate creates commit one response; JSON object key order does not change payload identity', async () => {
    const body = input(); const key = crypto.randomUUID(); const barrier = newBarrier(4);
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'rpc/execute_operator_support_mutation') await barrier.arrive();
        return forward();
    });
    let responses;
    try { responses = await Promise.all(Array.from({ length: 4 }, () => send('/tickets', body, key))); }
    finally { tap.restore(); }
    for (const response of responses) { assert.equal(response.status, 201); assert.deepEqual(response.json, responses[0].json); }
    const reordered = { reason: body.reason, body: body.body, subject: body.subject };
    assert.deepEqual((await send('/tickets', reordered, key)).json, responses[0].json);
    assert.equal(count('support_tickets', `subject='${body.subject}'`), 1);
});

test('a lost committed response is recovered with the original key through a new worker instance', async () => {
    const body = input(); const key = crypto.randomUUID();
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        const response = await forward();
        if (call.resource === 'rpc/execute_operator_support_mutation') {
            assert.equal(response.status, 200);
            return restJson(503, { code: 'synthetic_lost_response', message: 'Synthetic lost response' });
        }
        return response;
    });
    try { assert.equal((await send('/tickets', body, key)).status, 500); }
    finally { tap.restore(); }
    const originalEnv = gateway.env;
    gateway = new Gateway(originalEnv);
    const recovered = await send('/tickets', body, key);
    assert.equal(recovered.status, 201);
    assert.equal(count('support_tickets', `subject='${body.subject}'`), 1);
});

test('fresh permission precedes cached replay; one actor never receives another actor receipt', async () => {
    const id = (await send('/tickets', input())).json!.data.ticket.id;
    const key = crypto.randomUUID(); const body = { assignee_id: null, reason };
    assert.equal((await send(`/tickets/${id}/assign`, body, key, 'PATCH')).status, 200);
    psql(`UPDATE employees SET role='support' WHERE user_id='${actor.id}';`);
    try { assert.equal((await send(`/tickets/${id}/assign`, body, key, 'PATCH')).status, 403); }
    finally { psql(`UPDATE employees SET role='manager' WHERE user_id='${actor.id}';`); }
    const otherId = crypto.randomUUID(); const email = `mutation-other-${otherId}@example.invalid`;
    psql(`INSERT INTO users_custom (id,email,email_verified) VALUES ('${otherId}','${email}',true);
        INSERT INTO employees (user_id,email,role,store_id,status,is_active) VALUES ('${otherId}','${email}','manager',NULL,'active',true);`);
    const response = await gateway.request(`${OPS}/tickets/${id}/assign`, { method: 'PATCH', headers: { ...await signedIdentityHeaders(otherId,email), 'Idempotency-Key': key }, body: JSON.stringify(body) });
    assert.equal(response.status, 200); assert.equal(response.json!.data.ticket.updated_by, otherId);
    assert.equal(count('support_mutation_receipts', `idempotency_key='${key}'`), 2);
});

test('missing, short, oversized or contradictory keys refuse before any mutation; legacy client header works', async () => {
    const body = input();
    const invalidKeys: Record<string, string>[] = [{}, { 'Idempotency-Key': 'short' }, { 'Idempotency-Key': 'x'.repeat(201) }, { 'Idempotency-Key': crypto.randomUUID(), 'X-Idempotency-Key': crypto.randomUUID() }];
    for (const headers of invalidKeys) {
        const response = await gateway.request(`${OPS}/tickets`, { method: 'POST', headers: { ...await signedIdentityHeaders(actor.id,actor.email), ...headers }, body: JSON.stringify(body) });
        assert.equal(response.status, 400); assert.equal(count('support_tickets', `subject='${body.subject}'`), 0);
    }
    const key = crypto.randomUUID();
    const request = () => gateway.request(`${OPS}/tickets`, { method: 'POST', headers: { ...signedHeaders, 'X-Idempotency-Key': key }, body: JSON.stringify(body) });
    let signedHeaders = await signedIdentityHeaders(actor.id, actor.email);
    const first = await request(); signedHeaders = await signedIdentityHeaders(actor.id, actor.email);
    const second = await request(); assert.equal(first.status, 201); assert.deepEqual(second.json, first.json);
});

test('case evidence failure rolls back ticket escalation, case, event, note, audit and receipt; same-key retry repairs it', async () => {
    const id = (await send('/tickets', input())).json!.data.ticket.id;
    const key = crypto.randomUUID(); const body = { target: 'trust_safety', reason };
    psql(`CREATE FUNCTION public.synthetic_case_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic evidence fault'; END $$;
        CREATE TRIGGER synthetic_case_fault BEFORE INSERT ON public.ts_evidence FOR EACH ROW EXECUTE FUNCTION public.synthetic_case_fault();`);
    try {
        assert.equal((await send(`/tickets/${id}/escalate`, body, key)).status, 500);
        assert.equal(psql(`SELECT status FROM support_tickets WHERE id='${id}'`), 'open');
        assert.equal(count('ts_cases', `metadata->>'support_ticket_id'='${id}'`), 0);
        assert.equal(count('support_mutation_receipts', `idempotency_key='${key}'`), 0);
        assert.equal(count('ticket_messages', `ticket_id='${id}'`), 1);
    } finally { psql('DROP TRIGGER synthetic_case_fault ON public.ts_evidence; DROP FUNCTION public.synthetic_case_fault();'); }
    assert.equal((await send(`/tickets/${id}/escalate`, body, key)).status, 200);
    assert.equal(count('ts_cases', `metadata->>'support_ticket_id'='${id}'`), 1);
});

test('receipt completion failure after every action rolls back all effects; each original key remains usable', async () => {
    const id = (await send('/tickets', input())).json!.data.ticket.id;
    await send(`/tickets/${id}/resolve`, { reason });
    const steps: [string, Record<string, unknown>, string][] = [
        ['/tickets', input(), 'POST'],
        [`/tickets/${id}/messages`, { body: 'Synthetic retry note', visibility: 'internal', reason }, 'POST'],
        [`/tickets/${id}/assign`, { assignee_id: null, reason }, 'PATCH'],
        [`/tickets/${id}/escalate`, { target: 'trust_safety', reason }, 'POST'],
        [`/tickets/${id}/resolve`, { reason }, 'POST'],
        [`/tickets/${id}/csat`, { score: 4, reason }, 'POST'],
        ['/macros', { name: `Synthetic receipt ${crypto.randomUUID()}`, body: 'Synthetic receipt answer', reason }, 'POST'],
    ];
    const snapshot = () => queryJson(psql, `SELECT jsonb_build_object(
        'ticket',(SELECT to_jsonb(t) FROM support_tickets t WHERE id='${id}'),
        'tickets',(SELECT count(*) FROM support_tickets),'messages',(SELECT count(*) FROM ticket_messages),
        'clocks',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM ticket_sla_clocks c WHERE ticket_id='${id}'),
        'csat',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM ticket_csat c WHERE ticket_id='${id}'),
        'macros',(SELECT count(*) FROM ticket_macros),'cases',(SELECT count(*) FROM ts_cases),
        'evidence',(SELECT count(*) FROM ts_evidence),'events',(SELECT count(*) FROM ts_case_events),
        'audit',(SELECT count(*) FROM audit_logs WHERE action LIKE 'support.%'));`);
    for (const [path, body, method] of steps) {
        const key = crypto.randomUUID(); const before = snapshot();
        psql(`CREATE FUNCTION public.synthetic_receipt_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic receipt completion fault'; END $$;
            CREATE TRIGGER synthetic_receipt_fault BEFORE UPDATE ON public.support_mutation_receipts FOR EACH ROW EXECUTE FUNCTION public.synthetic_receipt_fault();`);
        try {
            const failed = await send(path, body, key, method);
            assert.equal(failed.status, 500, path); assert.deepEqual(snapshot(), before, path);
            assert.equal(count('support_mutation_receipts', `idempotency_key='${key}'`), 0, path);
            assert.doesNotMatch(failed.text, /synthetic|receipt|SQLSTATE|PGRST|constraint/i);
        } finally { psql('DROP TRIGGER synthetic_receipt_fault ON public.support_mutation_receipts; DROP FUNCTION public.synthetic_receipt_fault();'); }
        const retry = await send(path, body, key, method);
        assert.ok(retry.status === 200 || retry.status === 201, retry.text);
        assert.deepEqual((await send(path, body, key, method)).json, retry.json);
    }
});

test('concurrent duplicates of every existing-ticket action and macro creation replay a single effect', async () => {
    const id = (await send('/tickets', input())).json!.data.ticket.id;
    const steps: [string, Record<string, unknown>, string][] = [
        [`/tickets/${id}/messages`, { body: 'Synthetic concurrent note', visibility: 'internal', reason }, 'POST'],
        [`/tickets/${id}/assign`, { assignee_id: null, reason }, 'PATCH'],
        [`/tickets/${id}/escalate`, { target: 'trust_safety', reason }, 'POST'],
        [`/tickets/${id}/resolve`, { reason }, 'POST'],
        [`/tickets/${id}/csat`, { score: 3, reason }, 'POST'],
        ['/macros', { name: `Synthetic concurrent ${crypto.randomUUID()}`, body: 'Synthetic concurrent answer', reason }, 'POST'],
    ];
    for (const [path, body, method] of steps) {
        const barrier = newBarrier(3); const key = crypto.randomUUID();
        const tap = tapRest(owned.restUrl, async (call, forward) => {
            if (call.resource === 'rpc/execute_operator_support_mutation') await barrier.arrive();
            return forward();
        });
        let responses;
        try { responses = await Promise.all(Array.from({ length: 3 }, () => send(path, body, key, method))); }
        finally { tap.restore(); }
        for (const response of responses) {
            assert.ok(response.status === 200 || response.status === 201, response.text);
            assert.deepEqual(response.json, responses[0].json, path);
        }
        assert.equal(count('support_mutation_receipts', `idempotency_key='${key}'`), 1);
    }
    assert.equal(count('ticket_csat', `ticket_id='${id}'`), 1);
    assert.equal(count('ts_cases', `metadata->>'support_ticket_id'='${id}'`), 1);
});

test('typed support client preserves a logical action key with fresh signed identity on each retry', async () => {
    // The client transport drives the real worker rather than returning a fabricated API response.
    const client = new LetbuyyApiClient({ baseUrl: 'https://gateway.test', fetch: async (url, init) => {
        await pause(800);
        const response = await gateway.request(new URL(String(url)).pathname, init);
        return new Response(response.text, { status: response.status, headers: response.headers });
    } });
    const payload = input(); const key = crypto.randomUUID();
    const first = await client.operations.createSupportTicket(payload, { idempotencyKey: key, headers: await signedIdentityHeaders(actor.id, actor.email) });
    const retry = await client.operations.createSupportTicket(payload, { idempotencyKey: key, headers: await signedIdentityHeaders(actor.id, actor.email) });
    assert.deepEqual(retry, first); assert.equal(count('support_tickets', `subject='${payload.subject}'`), 1);
});

test('backend-only functions and receipts deny API roles; paired rollback preserves canonical support rows', async () => {
    const signature = 'public.execute_operator_support_mutation(uuid,text,text,uuid,text,jsonb,text[],integer,integer)';
    const helper = 'public.link_support_trust_safety_case(uuid,uuid,text,text)';
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.equal(psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE') OR has_function_privilege('${role}','${helper}','EXECUTE');`), 'f', role);
        assert.equal(psql(`SELECT has_table_privilege('${role}','public.support_mutation_receipts','SELECT,INSERT,UPDATE,DELETE');`), 'f', role);
    }
    assert.equal(psql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE');`), 't');
    const id = (await send('/tickets', input())).json!.data.ticket.id;
    const before = psql(`SELECT to_jsonb(t) FROM support_tickets t WHERE id='${id}';`);
    const rollback = readFileSync(new URL('../../../../../database/supabase/rollback/265_operator_support_mutation_integrity.rollback.sql', import.meta.url),'utf8');
    const migration = readFileSync(new URL('../../../../../database/supabase/migrations/265_operator_support_mutation_integrity.sql', import.meta.url),'utf8');
    owned.script(rollback);
    assert.equal(psql(`SELECT to_regprocedure('${signature}') IS NULL AND to_regclass('public.support_mutation_receipts') IS NULL;`),'t');
    assert.equal(psql(`SELECT to_jsonb(t) FROM support_tickets t WHERE id='${id}';`),before);
    owned.script(migration);
    // PostgREST reload is asynchronous; prove re-application directly in the owned database.
    assert.equal(psql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE');`),'t');
});
