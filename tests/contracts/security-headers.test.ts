import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContentSecurityPolicy } from '../../config/security/next-security-headers';

test('local verification CSP is explicit, loopback-only and absent from hosted policies', () => {
  const keys = ['NEXT_PUBLIC_ENV', 'NEXT_PUBLIC_ACCOUNTS_URL'] as const;
  const prior = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const origin = 'http://127.0.0.1:54359';
  const sdk = origin + '/fixtures/turnstile/api.js';
  try {
    for (const [environment, accounts, script, allowed] of [
      ['development', 'http://localhost:54351', sdk, true],
      ['development', 'http://127.0.0.1:54351', sdk, true],
      ['staging', 'http://localhost:54351', sdk, false],
      ['production', 'http://localhost:54351', sdk, false],
      ['development', 'https://accounts.letbuyy.com', sdk, false],
      ['development', 'http://outside.example:54351', sdk, false],
      ['development', 'http://localhost:54351/other', sdk, false],
      ['development', 'http://localhost:54351', sdk + '?other=1', false],
      ['development', 'http://localhost:54351', origin + '/arbitrary.js', false],
      ['development', 'http://localhost:54351', 'http://outside.example:54359/fixtures/turnstile/api.js', false],
    ] as const) {
      process.env.NEXT_PUBLIC_ENV = environment;
      process.env.NEXT_PUBLIC_ACCOUNTS_URL = accounts;
      assert.equal(createContentSecurityPolicy().includes(origin), false);
      const policy = createContentSecurityPolicy({ localVerificationSdkUrl: script });
      for (const name of ['script-src', 'connect-src']) {
        const source = policy.split('; ').find(value => value.startsWith(name + ' ')) || '';
        assert.equal(source.includes(origin), allowed);
      }
      for (const name of ['frame-src', 'form-action', 'img-src']) {
        assert.equal((policy.split('; ').find(value => value.startsWith(name + ' ')) || '').includes(origin), false);
      }
      assert.equal(policy.includes('https://challenges.cloudflare.com'), true);
    }
  } finally {
    for (const key of keys) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
  }
});

const nextConfigModules = [
  ['app-marketplace', '../../apps/frozen/app-store/next.config.ts'],
  ['developer-portal', '../../apps/frozen/developer-portal/next.config.ts'],
  ['identity-platform', '../../apps/platform/identity/next.config.ts'],
  ['marketing-site', '../../apps/marketing/web/next.config.ts'],
  ['merchant-web', '../../apps/merchant/web/next.config.ts'],
  ['admin-web', '../../apps/internal/console/next.config.ts'],
  ['platform-operations-portal', '../../apps/frozen/operations-portal/next.config.ts'],
  ['customer-web', '../../apps/commerce/web/next.config.ts'],
  ['theme-marketplace', '../../apps/frozen/theme-store/next.config.ts'],
] as const;

function headerMap(headers: Array<{ key: string; value: string }>): Map<string, string> {
  return new Map(headers.map((header) => [header.key.toLowerCase(), header.value]));
}

test('an approved provider gains frame permission only, and malformed or wildcard frame sources fail closed', () => {
  const origin = 'https://app-frame.example.invalid';
  const policy = createContentSecurityPolicy({ frameSources: [origin, 'https://*.bad.example.invalid', 'http://insecure.example.invalid', 'https://user:secret@bad.example.invalid', 'https://bad.example.invalid/path', "'unsafe-inline'"] });
  const directives = new Map(policy.split('; ').map(value => { const [key, ...sources] = value.split(' '); return [key, sources]; }));
  assert.ok(directives.get('frame-src')?.includes(origin));
  for (const [name, sources] of directives) if (name !== 'frame-src') assert.ok(!sources.includes(origin), name);
  assert.doesNotMatch(policy, /bad\.example\.invalid|insecure\.example\.invalid/);
  assert.ok(!createContentSecurityPolicy().includes(origin), 'unset configuration must not allow arbitrary app frames');
});

test('every Next app emits shared HSTS and CSP security headers', async () => {
  for (const [appName, modulePath] of nextConfigModules) {
    const config = (await import(modulePath)).default;
    assert.equal(typeof config.headers, 'function', `${appName} must define headers()`);

    const entries = await config.headers();
    const allHeaders = entries.flatMap((entry: { headers?: Array<{ key: string; value: string }> }) => entry.headers || []);
    const headers = headerMap(allHeaders);
    const csp = headers.get('content-security-policy') || headers.get('content-security-policy-report-only') || '';

    assert.match(headers.get('strict-transport-security') || '', /max-age=31536000/, `${appName} must emit HSTS`);
    assert.match(headers.get('x-content-type-options') || '', /^nosniff$/, `${appName} must emit nosniff`);
    assert.equal(headers.get('referrer-policy'), appName === 'identity-platform' ? 'no-referrer' : 'strict-origin-when-cross-origin', `${appName} must emit its exact referrer policy`);
    assert.match(headers.get('permissions-policy') || '', /camera=\(\)/, `${appName} must emit permissions policy`);
    assert.match(csp, /default-src 'self'/, `${appName} CSP must include default-src`);
    assert.match(csp, /script-src /, `${appName} CSP must include script-src`);
    assert.match(csp, /frame-ancestors /, `${appName} CSP must include frame-ancestors`);
  }
});

test('Razorpay form redirects are an exact API-origin opt-in, with local-only forms as default', () => {
  const directive = (value: string) => value.split('; ').find(entry => entry.startsWith('form-action '));
  assert.equal(directive(createContentSecurityPolicy()), "form-action 'self'");
  assert.equal(directive(createContentSecurityPolicy({ razorpayCheckoutForms: true })), "form-action 'self' https://api.razorpay.com");
  assert.equal(directive(createContentSecurityPolicy({ razorpayCheckoutForms: false })), "form-action 'self'");
});

test('Merchant direct KYC upload permits only its configured Mumbai bucket in connect-src', async () => {
  const bucket = 'letbuyy-kyc-mumbai-synthetic';
  const origin = `https://${bucket}.s3.ap-south-1.amazonaws.com`;
  const prior = process.env.KYC_INDIA_BUCKET;
  try {
    process.env.KYC_INDIA_BUCKET = bucket;
    const config = (await import('../../apps/merchant/web/next.config')).default;
    const entries = await config.headers!();
    const csp = entries.flatMap(entry => entry.headers)
      .find(header => header.key === 'Content-Security-Policy')?.value || '';
    const directives = new Map(csp.split('; ').map(value => { const [key, ...sources] = value.split(' '); return [key, sources]; }));
    assert.ok(directives.get('connect-src')?.includes(origin));
    for (const [name, sources] of directives) if (name !== 'connect-src') assert.ok(!sources.includes(origin), name);
    assert.ok(!directives.get('connect-src')?.includes('https://*.s3.ap-south-1.amazonaws.com'));
    assert.doesNotMatch(csp, /s3\.us-east-1\.amazonaws\.com/);
  } finally {
    if (prior === undefined) delete process.env.KYC_INDIA_BUCKET;
    else process.env.KYC_INDIA_BUCKET = prior;
  }
  assert.ok(!createContentSecurityPolicy().includes(origin));
  assert.ok(!createContentSecurityPolicy({ indiaUploadS3Bucket: 'bucket.s3.us-east-1.amazonaws.com' }).includes('us-east-1.amazonaws.com'));
});

test('only the configured hosted checkout entry point opts in to Razorpay forms', async () => {
  const config = (await import('../../apps/commerce/web/next.config')).default;
  const entries = await config.headers!();
  const optedIn = entries.filter(entry => entry.headers.some(header => header.key === 'Content-Security-Policy' && header.value.includes("form-action 'self' https://api.razorpay.com")));
  assert.equal(optedIn.length, 1);
  assert.equal(optedIn[0].source, '/checkout');
  assert.equal(optedIn[0].has?.length, 1);
  const host = optedIn[0].has![0];
  assert.equal(host.type, 'host');
  const pattern = new RegExp(`^(?:${host.value})$`);
  const expected = new URL(process.env.CHECKOUT_ORIGIN || 'https://checkout.letbuyy.com').hostname;
  assert.equal(pattern.test(expected), true);
  assert.equal(pattern.test('attacker.example'), false);
  assert.equal(pattern.test(`${expected}.attacker.example`), false);
  assert.equal(pattern.test('store.letbuyy.com'), false);
  const ordinary = entries.find(entry => entry.source.startsWith('/((?!api/'))!;
  assert(ordinary.headers.some(header => header.key === 'Content-Security-Policy' && header.value.split('; ').includes("form-action 'self'")));
});
