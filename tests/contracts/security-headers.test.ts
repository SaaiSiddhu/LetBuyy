import assert from 'node:assert/strict';
import { test } from 'node:test';

const nextConfigModules = [
  ['app-marketplace', '../../apps/app-marketplace/next.config.ts'],
  ['developer-portal', '../../apps/developer-portal/next.config.ts'],
  ['identity-platform', '../../apps/identity-platform/next.config.ts'],
  ['marketing-site', '../../apps/marketing-site/next.config.ts'],
  ['merchant-control-plane', '../../apps/merchant-control-plane/next.config.ts'],
  ['platform-console', '../../apps/platform-console/next.config.ts'],
  ['platform-operations-portal', '../../apps/platform-operations-portal/next.config.ts'],
  ['storefront-runtime', '../../apps/storefront-runtime/next.config.ts'],
  ['theme-marketplace', '../../apps/theme-marketplace/next.config.ts'],
] as const;

function headerMap(headers: Array<{ key: string; value: string }>): Map<string, string> {
  return new Map(headers.map((header) => [header.key.toLowerCase(), header.value]));
}

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
    assert.match(headers.get('referrer-policy') || '', /strict-origin-when-cross-origin/, `${appName} must emit referrer policy`);
    assert.match(headers.get('permissions-policy') || '', /camera=\(\)/, `${appName} must emit permissions policy`);
    assert.match(csp, /default-src 'self'/, `${appName} CSP must include default-src`);
    assert.match(csp, /script-src /, `${appName} CSP must include script-src`);
    assert.match(csp, /frame-ancestors /, `${appName} CSP must include frame-ancestors`);
  }
});
