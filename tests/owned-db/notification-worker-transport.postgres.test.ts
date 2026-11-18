import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { Miniflare, createFetchMock } from 'miniflare';
import { createNotificationRequestHeaders, NOTIFICATION_REQUEST_PATH } from '@letbuyy/auth-core';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant, seedSyntheticOrder } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import { OutboxExecutionAdapter } from '../../services/api-gateway/src/execution/outbox-execution.adapter';
import { consumeNotificationJobs, type PlatformQueueConsumerEnv } from '../../services/queue-workers/src/platform-queue-consumer';
import { createNotificationRpcClient } from '../../services/queue-workers/src/notification-transport';

const owned = requireOwnedDatabase(), db = createSupabaseServiceClient(owned.restEnv());
let gateway: Gateway, coordinator: Miniflare;
before(async () => {
  const entry = fileURLToPath(new URL('../../services/api-gateway/src/durable/runtime-coordinator.ts', import.meta.url));
  const script = buildSync({ stdin: { contents: `export {LetbuyyRuntimeDurableObject} from ${JSON.stringify(entry)};export default {fetch(){return new Response('owned coordinator')}};`,
    resolveDir: fileURLToPath(new URL('../../', import.meta.url)), sourcefile: 'owned-notification-admission.ts' }, bundle: true, write: false,
    platform: 'browser', format: 'esm', target: 'es2022', conditions: ['workerd', 'browser'], external: ['node:*'], logLevel: 'silent' }).outputFiles[0].text;
  const network = createFetchMock(); network.disableNetConnect();
  coordinator = new Miniflare({ modules: true, script, compatibilityDate: '2026-05-25', compatibilityFlags: ['nodejs_compat'], cf: false,
    fetchMock: network, durableObjects: { RUNTIME_COORDINATOR: 'LetbuyyRuntimeDurableObject' }, durableObjectsPersist: false,
    bindings: { ENVIRONMENT: 'production', DEPLOYMENT_ENV: 'production' } });
  gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), { RUNTIME_COORDINATOR: await coordinator.getDurableObjectNamespace('RUNTIME_COORDINATOR'),
    ENVIRONMENT: 'production', APP_ENV: 'production', DEPLOYMENT_ENV: 'production', NODE_ENV: 'production',
    FEATURE_AI_CREDIT_PURCHASE: 'false', AI_CREDIT_PURCHASE_MODE: 'sandbox', AI_CREDIT_PURCHASE_PROVIDER: 'letbuyy_sandbox' }));
});
after(async () => { await gateway?.settle(); await coordinator?.dispose(); });
const workerId = () => 'synthetic-notification-' + randomUUID();
let sequence = 0;
const requests: string[] = [];
const queueEnv = {
  ENVIRONMENT: 'production', APP_ENV: 'production', INTERNAL_API_SECRET: INTERNAL_SECRET,
  RESEND_API_KEY: 're_synthetic_notification_provider_only', RESEND_FROM_EMAIL: 'noreply@letbuyy.com',
  API_GATEWAY_SERVICE: { fetch: async (input: string | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const body = await request.text(); requests.push(JSON.parse(body).operation);
    const reply = await gateway.request(new URL(request.url).pathname, { method: request.method, headers: request.headers, body });
    return new Response(reply.text, { status: reply.status, headers: reply.headers });
  } },
} as unknown as PlatformQueueConsumerEnv;
async function fixture() {
  const tenant = newSyntheticTenant('notif-transport-' + (++sequence)); seedSyntheticTenant(owned.psql, tenant);
  const { orderId } = seedSyntheticOrder(owned.psql, tenant);
  await new OutboxExecutionAdapter(db).dispatchOrderEmails(tenant.siteId, orderId);
  return { tenant, orderId };
}
async function signed(value: unknown, headersOverride?: Headers) {
  const body = JSON.stringify(value);
  const headers = headersOverride ?? new Headers(await createNotificationRequestHeaders({ secret: INTERNAL_SECRET, environment: 'production',
    method: 'POST', url: 'https://gateway.test' + NOTIFICATION_REQUEST_PATH, body: new TextEncoder().encode(body) }));
  return gateway.request(NOTIFICATION_REQUEST_PATH, { method: 'POST', headers, body });
}
async function provider<T>(reply: (request: Request) => Promise<Response>, work: () => Promise<T>) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    return new URL(request.url).hostname === 'api.resend.com' ? reply(request) : original(input, init);
  };
  try { return await work(); } finally { globalThis.fetch = original; await gateway.settle(); }
}
function jobId(orderId: string) {
  return owned.psql(`SELECT j.id FROM platform_queue_jobs j JOIN outbox_events e ON e.id=j.outbox_event_id WHERE e.aggregate_id='${orderId}' AND j.job_type='order.lifecycle_email_queued' ORDER BY j.created_at DESC LIMIT 1;`);
}

test('real worker requires signed bytes and a durable fresh nonce; arbitrary RPC, money and forged requests write nothing', async () => {
  const value = { operation: 'recover', worker_id: workerId(), payload: {} }, body = JSON.stringify(value);
  const headers = new Headers(await createNotificationRequestHeaders({ secret: INTERNAL_SECRET, environment: 'production', method: 'POST',
    url: 'https://gateway.test' + NOTIFICATION_REQUEST_PATH, body: new TextEncoder().encode(body) }));
  assert.equal((await signed(value, headers)).status, 200, 'positive control through real global middleware and PostgREST');
  assert.equal((await signed(value, headers)).status, 401, 'a valid signature cannot replay');
  assert.equal((await signed({ ...value, worker_id: workerId() }, headers)).status, 401, 'body substitution cannot reuse a signature');
  assert.equal((await gateway.request(NOTIFICATION_REQUEST_PATH, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } })).status, 401);
  for (const operation of ['execute_sql', 'claim_platform_queue_jobs', 'payment-events', 'recover_loyalty_refund_job_v1']) {
    assert.equal((await signed({ ...value, operation })).status, 401);
  }
  const old = new Headers(await createNotificationRequestHeaders({ secret: INTERNAL_SECRET, environment: 'production', method: 'POST',
    url: 'https://gateway.test' + NOTIFICATION_REQUEST_PATH, body: new TextEncoder().encode(body), nowMs: Date.now() - 121000 }));
  assert.equal((await signed(value, old)).status, 401);
});

test('Queue without any database credential sends the committed coupon receipt through the real monolith then ACKs its exact job', async () => {
  const f = await fixture();
  owned.script(`UPDATE orders SET status='shipped',subtotal=2,discount=1,coupon_discount=1,coupon_code='OFF50',total=1 WHERE id='${f.orderId}';`);
  await new OutboxExecutionAdapter(db).dispatchOrderEmails(f.tenant.siteId, f.orderId);
  const calls: Array<{ key: string | null; text: string }> = [];
  await provider(async request => {
    const body = await request.json() as { text: string };
    calls.push({ key: request.headers.get('Idempotency-Key'), text: body.text });
    assert.equal(owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE id='${jobId(f.orderId)}' AND status='succeeded';`), '0', 'provider precedes job ACK');
    return Response.json({ id: 'synthetic-mail-' + calls.length });
  }, async () => {
    assert.equal('SUPABASE_URL' in queueEnv, false); assert.equal('SUPABASE_SERVICE_ROLE_KEY' in queueEnv, false);
    const result = await consumeNotificationJobs(queueEnv, workerId());
    assert.equal(result[0].failed, 0); assert.ok(result[0].succeeded >= 2);
    const count = calls.length; await consumeNotificationJobs(queueEnv, workerId()); assert.equal(calls.length, count, 'completed jobs never resend');
  });
  assert.ok(calls.some(x => /Coupon \(OFF50\): −INR 1.00/.test(x.text) && /Final total: INR 1.00/.test(x.text)));
  assert.equal(owned.psql(`SELECT status FROM platform_queue_jobs WHERE id='${jobId(f.orderId)}';`), 'succeeded');
  assert.ok(requests.includes('order-seal') && requests.includes('order-receipt') && requests.includes('complete'));
  assert.ok(requests.every(x => !/payment|loyalty|ledger/.test(x)));
});

test('bounded claim ignores financial and unknown jobs; exact lease/source checks reject stale, foreign and premature ACKs', async () => {
  const f = await fixture(), id = jobId(f.orderId), worker = workerId(), proxy = createNotificationRpcClient(queueEnv, worker);
  assert.ifError((await proxy.rpc('claim_platform_queue_jobs', { p_queue_name: 'notification-jobs', p_worker_id: worker, p_limit: 25, p_lock_seconds: 120 })).error);
  assert.ok((await proxy.rpc('complete_platform_queue_job', { p_job_id: id, p_worker_id: worker, p_result: { processed: true } })).error, 'a sender cannot ACK an order before its delivery receipt');
  assert.ok((await signed({ operation: 'order-delivery', worker_id: workerId(), job_id: id, payload: {} })).status === 409);
  const other = newSyntheticTenant('notification-foreign'); seedSyntheticTenant(owned.psql, other);
  owned.script(`UPDATE platform_queue_jobs SET site_id='${other.siteId}' WHERE id='${id}';`);
  assert.equal((await signed({ operation: 'order-delivery', worker_id: worker, job_id: id, payload: {} })).status, 503, 'the canonical source join denies a forged site');
  owned.script(`UPDATE platform_queue_jobs SET site_id='${f.tenant.siteId}',locked_at=now()-interval '3 minutes' WHERE id='${id}';`);
  assert.equal((await signed({ operation: 'order-delivery', worker_id: worker, job_id: id, payload: {} })).status, 409);
  assert.match(owned.psqlExpectError(`SELECT notification_worker_operation_v1('claim','${worker}',NULL,'{}');`), /Invalid notification claim/);
  for (const role of ['anon', 'authenticated', 'app_tenant']) assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT notification_worker_operation_v1('recover','${worker}',NULL,'{}');`), /permission denied/);
  // Unsupported notification and payment jobs are isolated synthetic controls.
  for (const [queue, kind] of [['notification-jobs', 'synthetic.unsupported'], ['payment-events', 'order.lifecycle_email_queued']]) {
    const control = randomUUID(); owned.script(`INSERT INTO platform_queue_jobs(id,event_id,queue_name,site_id,job_type,status,payload,idempotency_key) VALUES('${control}','${randomUUID()}','${queue}','${f.tenant.siteId}','${kind}','queued','{}','synthetic-control-${control}');`);
    const result = await signed({ operation: 'claim', worker_id: workerId(), payload: { limit: 25 } }); assert.equal(result.status, 200);
    assert.equal(owned.psql(`SELECT status FROM platform_queue_jobs WHERE id='${control}';`), 'queued');
  }
});

test('provider outage retries one frozen body/key through the signed transport, and rollback preserves all durable rows', async () => {
  // Recover prior expired fixture leases through the reviewed operation first.
  await signed({ operation: 'recover', worker_id: workerId(), payload: {} });
  const f = await fixture(), observed: Array<{ key: string | null; body: string }> = []; let accepted = false;
  await provider(async request => {
    observed.push({ key: request.headers.get('Idempotency-Key'), body: await request.text() });
    return accepted ? Response.json({ id: 'synthetic-provider-retry' }) : Response.json({ message: 'Synthetic provider outage' }, { status: 503 });
  }, async () => {
    const first = await consumeNotificationJobs(queueEnv, workerId()); assert.ok(first[0].failed > 0);
    owned.script(`UPDATE platform_queue_jobs SET available_at=now() WHERE id='${jobId(f.orderId)}';`);
    accepted = true; const retry = await consumeNotificationJobs(queueEnv, workerId()); assert.equal(retry[0].failed, 0);
  });
  const sameIntent = observed.filter(x => x.key === observed.at(-1)?.key); assert.equal(sameIntent.length, 2); assert.equal(sameIntent[0].body, sameIntent[1].body);
  await fixture();
  await signed({ operation: 'claim', worker_id: workerId(), payload: { limit: 25 } });
  const rollback = readFileSync('database/supabase/rollback/403_notification_worker_operations.rollback.sql', 'utf8');
  assert.match(owned.psqlExpectError(rollback), /403 rollback requires active notification leases to drain/);
  const before = owned.psql(`SELECT md5(coalesce(string_agg(to_jsonb(e)::text,'|' ORDER BY id),'')) FROM email_logs e;`);
  owned.script(`UPDATE platform_queue_jobs SET locked_at=now()-interval '3 minutes' WHERE queue_name='notification-jobs' AND status='running';`);
  owned.script(rollback);
  owned.script(readFileSync('database/supabase/migrations/403_notification_worker_operations.sql', 'utf8'));
  assert.equal(owned.psql(`SELECT md5(coalesce(string_agg(to_jsonb(e)::text,'|' ORDER BY id),'')) FROM email_logs e;`), before);
  await gateway.settle();
});
