import assert from 'node:assert/strict';
import test from 'node:test';
import { runMoneyLedgerReconciliation } from '../src/money-ledger-reconciliation';
import worker from '../src/index';

const id = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const timestamp = '2026-10-16T00:00:00+00:00';
const env = { SUPABASE_URL: 'https://owned-reconciliation.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-unit-only', MONEY_LEDGER_RECONCILIATION_BATCH_LIMIT: '2' };
function batch(key: string, limit: number) {
  const counts = { checked: 2, verified: 2, mismatches: 0, failed: 0 };
  return {
    version: 1, request_id: key, pass_id: id(100), revision: 1, pass_started_at: timestamp,
    pass_completed_at: null as string | null, pass_completed: false, status: 'partial', limit, replayed: false,
    ...counts, pass_counts: { ...counts }, cursor: { created_at: timestamp, site_id: id(2) }, watermark: { created_at: timestamp, site_id: id(7) },
    results: [1, 2].map(n => ({ site_id: id(n), label: 'Synthetic site ' + n, status: 'verified', variance_minor: 0 as unknown, failure_code: null as string | null, attempted_at: timestamp })),
  };
}
type Batch = ReturnType<typeof batch>;
async function withReply(transform: (reply: Batch) => unknown, action: (requests: Array<{ p_request_key: string; p_limit: number }>) => Promise<void>) {
  const original = globalThis.fetch, requests: Array<{ p_request_key: string; p_limit: number }> = [];
  globalThis.fetch = (async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, env.SUPABASE_URL);
    if (url.pathname !== '/rest/v1/rpc/run_money_ledger_reconciliation_batch_v1') return Response.json([]);
    const body = JSON.parse(String(init?.body)) as { p_request_key: string; p_limit: number };
    requests.push(body);
    return Response.json(transform(batch(body.p_request_key, body.p_limit)));
  }) as typeof fetch;
  try { await action(requests); } finally { globalThis.fetch = original; }
}

test('bounded canonical reconciliation batch preserves pass/cursor/request identity', async () => {
  await withReply(reply => reply, async requests => {
    const result = await runMoneyLedgerReconciliation(env, { requestId: 'unit-canonical-batch' });
    assert.equal(result.status, 'partial'); assert.equal(result.verified, 2);
    assert.equal(result.pass_completed, false); assert.equal(result.cursor.site_id, id(2));
    assert.deepEqual(requests, [{ p_request_key: 'unit-canonical-batch', p_limit: 2 }]);
  });
});

test('exact integer string variance stays exact; failures carry null rather than zero', async () => {
  await withReply(reply => {
    reply.results[1].status = 'mismatch'; reply.results[1].variance_minor = '9007199254740991';
    reply.verified = 1; reply.mismatches = 1; reply.pass_counts = { checked: 2, verified: 1, mismatches: 1, failed: 0 }; reply.status = 'mismatch';
    return reply;
  }, async () => {
    const result = await runMoneyLedgerReconciliation(env, { requestId: 'unit-exact-paise' });
    assert.equal(result.results[1].variance_minor, Number.MAX_SAFE_INTEGER); assert.equal(result.status, 'mismatch');
  });
  await withReply(reply => {
    reply.results[1].status = 'failed'; reply.results[1].variance_minor = null; reply.results[1].failure_code = 'P0001';
    reply.verified = 1; reply.failed = 1; reply.pass_counts = { checked: 2, verified: 1, mismatches: 0, failed: 1 }; reply.status = 'failed';
    return reply;
  }, async () => {
    const result = await runMoneyLedgerReconciliation(env, { requestId: 'unit-durable-failure' });
    assert.equal(result.results[1].variance_minor, null); assert.equal(result.failed, 1); assert.equal(result.verified, 1);
  });
});

test('malformed, unknown and unsafe paise never become verified zero', async t => {
  for (const value of [null, undefined, '', true, false, 'bad', '1.2', '1e3', ' 0 ', '9007199254740992', 9007199254740992, 0.2, {}, []]) {
    await t.test('reject ' + JSON.stringify(value), async () => {
      await withReply(reply => { reply.results[0].variance_minor = value; return reply; }, async () => {
        await assert.rejects(runMoneyLedgerReconciliation(env, { requestId: 'unit-bad-paise' }), /Invalid money ledger reconciliation batch response/);
      });
    });
  }
});

test('canonical reply requires consistent status, identities, bounded counts and known outcomes', async t => {
  const mutations: Array<[string, (reply: Batch) => unknown]> = [
    ['null reply', () => null], ['array reply', () => []], ['empty reply', () => ({})],
    ['unknown version', reply => ({ ...reply, version: 99 })],
    ['wrong request', reply => ({ ...reply, request_id: 'another-request' })],
    ['wrong bound', reply => ({ ...reply, limit: 501 })],
    ['unsafe revision', reply => ({ ...reply, revision: 9007199254740992 })],
    ['wrong total', reply => ({ ...reply, checked: 1 })],
    ['unknown overall status', reply => ({ ...reply, status: 'completed' })],
    ['uncompleted success', reply => ({ ...reply, status: 'pass_completed' })],
    ['missing completion time', reply => ({ ...reply, pass_completed: true, status: 'pass_completed' })],
    ['incomplete pass total', reply => ({ ...reply, pass_counts: { checked: 0, verified: 0, mismatches: 0, failed: 0 } })],
    ['unknown row status', reply => { reply.results[0].status = 'unknown'; return reply; }],
    ['verified nonzero', reply => { reply.results[0].variance_minor = 1; return reply; }],
    ['mismatch zero', reply => { reply.results[0].status = 'mismatch'; return reply; }],
    ['duplicate tenant', reply => { reply.results[1].site_id = reply.results[0].site_id; return reply; }],
    ['failed fabricated zero', reply => { reply.results[0].status = 'failed'; reply.results[0].failure_code = 'P0001'; return reply; }],
    ['missing cursor half', reply => ({ ...reply, cursor: { created_at: timestamp, site_id: null } })],
  ];
  for (const [name, mutate] of mutations) await t.test(name, async () => {
    await withReply(mutate, async () => {
      await assert.rejects(runMoneyLedgerReconciliation(env, { requestId: 'unit-invalid-reply' }), /Invalid money ledger reconciliation batch response/);
    });
  });
});

test('actual scheduled caller keeps one event key and reports partial/completed/mismatch/failure truthfully', async t => {
  for (const status of ['partial', 'pass_completed', 'mismatch', 'failed']) await t.test(status, async () => {
    const logs: Array<{ route?: string; status?: string }> = [], priorInfo = console.info, priorError = console.error;
    console.info = console.error = value => { try { logs.push(JSON.parse(String(value))); } catch { /* auxiliary jobs */ } };
    try {
      await withReply(reply => {
        reply.status = status;
        if (status === 'pass_completed') { reply.pass_completed = true; reply.pass_completed_at = timestamp; }
        if (status === 'mismatch') { reply.results[1].status = 'mismatch'; reply.results[1].variance_minor = -123; reply.verified = 1; reply.mismatches = 1; reply.pass_counts = { checked: 2, verified: 1, mismatches: 1, failed: 0 }; }
        if (status === 'failed') { reply.results[1].status = 'failed'; reply.results[1].variance_minor = null; reply.results[1].failure_code = 'P0001'; reply.verified = 1; reply.failed = 1; reply.pass_counts = { checked: 2, verified: 1, mismatches: 0, failed: 1 }; }
        return reply;
      }, async requests => {
        for (let delivery = 0; delivery < 2; delivery++) {
          const pending: Promise<unknown>[] = [];
          await worker.scheduled({ cron: '*/15 * * * *', scheduledTime: 1700000000000, noRetry() {} },
            { ...env, ENVIRONMENT: 'development' } as never,
            { waitUntil(p: Promise<unknown>) { pending.push(p); }, passThroughOnException() {} } as never);
          await Promise.all(pending);
        }
        assert.equal(requests.length, 2); assert.equal(requests[0].p_request_key, requests[1].p_request_key);
        assert.ok(requests[0].p_request_key.endsWith(':1700000000000'));
        assert.deepEqual(logs.filter(log => log.route === 'scheduled.money_ledger_reconciliation').map(log => log.status), [status, status]);
      });
    } finally { console.info = priorInfo; console.error = priorError; }
  });
});
