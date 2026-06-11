import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import app, { extractMobileSessionToken, verifyMobileTurnstileToken } from '../src/index';

test('extracts lb_session from bearer authorization first', () => {
  const request = new Request('https://mobile-bff.test/v1/products', {
    headers: {
      Authorization: 'Bearer bearer-session',
      Cookie: 'lb_session=cookie-session',
      'X-LetBuyy-Session-Token': 'header-session',
    },
  });

  assert.equal(extractMobileSessionToken(request), 'bearer-session');
});

test('extracts lb_session from explicit mobile header', () => {
  const request = new Request('https://mobile-bff.test/v1/products', {
    headers: {
      Cookie: 'lb_session=cookie-session',
      'X-LetBuyy-Session-Token': 'header-session',
    },
  });

  assert.equal(extractMobileSessionToken(request), 'header-session');
});

test('extracts lb_session from cookie fallback', () => {
  const request = new Request('https://mobile-bff.test/v1/products', {
    headers: {
      Cookie: 'other=value; lb_session=cookie-session',
    },
  });

  assert.equal(extractMobileSessionToken(request), 'cookie-session');
});

test('allowlist includes merchant domain management surfaces', () => {
  const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

  for (const prefix of ['/v1/custom', '/v1/store-access', '/v1/domains']) {
    assert.match(source, new RegExp(`'${prefix}'`));
  }
});

test('mobile dashboard composites analytics and payout gateway calls', async () => {
  const seen: string[] = [];
  const dataByPath: Record<string, unknown> = {
    '/v1/analytics/dashboard': { summary: { revenue: { value: 1200 }, orders: { value: 3 } } },
    '/v1/analytics/orders': { breakdown: { paid: 2, pending: 1 } },
    '/v1/analytics/revenue': { chart: [{ date: '2026-06-10', revenue: 1200, orders: 3 }] },
    '/v1/analytics/top-products': [{ id: 'prod_1', name: 'Kurta', revenue: 1200 }],
    '/v1/analytics/traffic-sources': { sources: [{ label: 'Direct', value: 10 }] },
    '/v1/payouts/summary': { provider_mode: 'sandbox', next_payout: null },
  };
  const env = {
    INTERNAL_API_SECRET: 'mobile-bff-test-secret',
    API_GATEWAY_SERVICE: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        seen.push(`${url.pathname}?${url.searchParams.toString()}`);
        assert.equal(request.headers.get('X-Client'), 'mobile-bff-composite');
        assert.equal(request.headers.get('X-LetBuyy-Internal-Session-Token'), 'a'.repeat(32));
        return new Response(JSON.stringify({ success: true, data: dataByPath[url.pathname] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  };

  const response = await app.fetch(
    new Request('https://mobile-bff.test/v1/mobile/dashboard?store_id=11111111-1111-4111-8111-111111111111&period=7d', {
      headers: { Authorization: `Bearer ${'a'.repeat(32)}` },
    }),
    env,
  );
  const payload = await response.json() as {
    success?: boolean;
    data?: { provider_mode?: string; analytics?: Record<string, unknown>; payout_summary?: Record<string, unknown> };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data?.provider_mode, 'sandbox');
  assert.deepEqual(payload.data?.analytics?.dashboard, dataByPath['/v1/analytics/dashboard']);
  assert.deepEqual(payload.data?.payout_summary, dataByPath['/v1/payouts/summary']);
  assert.equal(seen.length, 6);
  assert.ok(seen.some((path) => path.startsWith('/v1/analytics/dashboard?')));
  assert.ok(seen.some((path) => path.startsWith('/v1/payouts/summary?')));
});

test('mobile Turnstile verification fails closed without a configured secret', async () => {
  const result = await verifyMobileTurnstileToken({
    token: 'turnstile-response-token',
    env: { TURNSTILE_SECRET_KEY: 'SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_SECRET' },
  });

  assert.deepEqual(result, {
    ok: false,
    status: 'unavailable',
    code: 'TURNSTILE_NOT_CONFIGURED',
  });
});

test('mobile Turnstile verification uses Cloudflare siteverify response', async () => {
  const requests: Array<{ url: string; body: string }> = [];
  const fetcher: typeof fetch = async (url, init) => {
    requests.push({
      url: String(url),
      body: init?.body?.toString() || '',
    });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await verifyMobileTurnstileToken({
    token: 'turnstile-response-token',
    remoteIp: '203.0.113.10',
    env: {
      TURNSTILE_SECRET_KEY: 'secret_test_key',
      INTERNAL_API_SECRET: 'internal-proof-secret',
    },
    fetcher,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'verified');
  assert.match(result.proofToken || '', /^lb-mobile-turnstile-v1\./);
  assert.ok(result.proofExpiresAt);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
  assert.match(requests[0].body, /response=turnstile-response-token/);
  assert.match(requests[0].body, /remoteip=203\.0\.113\.10/);
});

test('mobile Turnstile verification fails closed when proof signing secret is absent', async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await verifyMobileTurnstileToken({
    token: 'turnstile-response-token',
    env: {
      TURNSTILE_SECRET_KEY: 'secret_test_key',
      INTERNAL_API_SECRET: 'SKIP_NEEDS_HUMAN_INTERNAL_SECRET',
    },
    fetcher,
  });

  assert.deepEqual(result, {
    ok: false,
    status: 'unavailable',
    code: 'TURNSTILE_PROOF_SECRET_NOT_CONFIGURED',
  });
});
