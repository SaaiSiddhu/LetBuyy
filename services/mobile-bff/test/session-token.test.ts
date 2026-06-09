import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractMobileSessionToken, verifyMobileTurnstileToken } from '../src/index';

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
    env: { TURNSTILE_SECRET_KEY: 'secret_test_key' },
    fetcher,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'verified');
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
  assert.match(requests[0].body, /response=turnstile-response-token/);
  assert.match(requests[0].body, /remoteip=203\.0\.113\.10/);
});
