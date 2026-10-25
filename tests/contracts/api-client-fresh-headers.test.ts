import assert from 'node:assert/strict';
import test from 'node:test';
import { createLetbuyyApiClient } from '../../packages/typescript/api-client/src/index';

test('retries retain the business intent but receive fresh credentials, including derived and concurrent clients', async () => {
    let sequence = 0;
    const calls: Array<{ credential: string | null; key: string | null }> = [];
    const client = createLetbuyyApiClient({
        baseUrl: 'https://api.example.invalid',
        getHeaders: async () => ({ 'X-Fresh-Credential': String(++sequence) }),
        fetch: async (_url, init) => {
            const headers = new Headers(init?.headers);
            calls.push({ credential: headers.get('X-Fresh-Credential'), key: headers.get('X-Idempotency-Key') });
            return Response.json({ success: true });
        },
    });
    await Promise.all([client.request('/intent', { method: 'POST', idempotencyKey: 'same-business-intent' }), client.request('/intent', { method: 'POST', idempotencyKey: 'same-business-intent' }), client.withOptions({}).request('/intent', { method: 'POST', idempotencyKey: 'same-business-intent' })]);
    assert.equal(new Set(calls.map(call => call.credential)).size, 3);
    assert.deepEqual(calls.map(call => call.key), Array(3).fill('same-business-intent'));
});

test('a credential preparation failure makes no transport call and does not fall back to static identity', async () => {
    let calls = 0;
    const client = createLetbuyyApiClient({ baseUrl: 'https://api.example.invalid', headers: { 'X-Fresh-Credential': 'stale' },
        getHeaders: async () => { throw new Error('Current identity unavailable'); },
        fetch: async () => { calls++; return Response.json({ success: true }); },
    });
    await assert.rejects(client.health(), /Current identity unavailable/);
    assert.equal(calls, 0);
});
