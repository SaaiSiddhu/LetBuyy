import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyCloudflareTurnstile } from '../src/turnstile';

test('Siteverify fails closed before network for empty, oversized and unconfigured tokens', async () => {
    const fetcher = (() => { throw new Error('must not send'); }) as typeof fetch;
    for (const token of ['', ' ', 'x'.repeat(2049)]) {
        assert.deepEqual(await verifyCloudflareTurnstile({ token, secret: 'fixture', fetcher }), { success: false, reason: 'invalid' });
    }
    assert.deepEqual(await verifyCloudflareTurnstile({ token: 'fixture', secret: '', fetcher }), { success: false, reason: 'unavailable' });
});

test('Siteverify accepts only a successful validated provider response and never retries consumed tokens', async () => {
    for (const body of [{ success: true }, { success: false, 'error-codes': ['timeout-or-duplicate'] }, { success: 'true' }, null]) {
        let calls = 0;
        const fetcher = (async (url, request) => {
            calls++;
            assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
            const sent = new URLSearchParams(request?.body as URLSearchParams);
            assert.equal(sent.get('response'), 'fixture-token');
            assert.equal(sent.get('remoteip'), '203.0.113.4');
            return Response.json(body);
        }) as typeof fetch;
        const result = await verifyCloudflareTurnstile({ token: 'fixture-token', secret: 'fixture-secret', remoteIp: '203.0.113.4', fetcher });
        assert.equal(result.success, body?.success === true);
        assert.equal(calls, 1);
    }
});

test('provider HTTP, malformed data, network and deadline failures cannot authorize an action', async () => {
    for (const fetcher of [
        async () => new Response('', { status: 503 }),
        async () => new Response('invalid JSON'),
        async () => { throw new Error('network'); },
    ]) {
        assert.deepEqual(await verifyCloudflareTurnstile({ token: 'fixture', secret: 'fixture', fetcher: fetcher as typeof fetch }), { success: false, reason: 'unavailable' });
    }
    let aborted = false;
    const fetcher = ((_url, request) => new Promise(() => { request?.signal?.addEventListener('abort', () => { aborted = true; }); })) as typeof fetch;
    const result = await verifyCloudflareTurnstile({ token: 'fixture', secret: 'fixture', fetcher, timeoutMs: 10 });
    assert.deepEqual(result, { success: false, reason: 'unavailable' });
    assert.equal(aborted, true);
});
