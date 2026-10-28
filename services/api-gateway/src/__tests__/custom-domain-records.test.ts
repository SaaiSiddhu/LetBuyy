import assert from 'node:assert/strict';
import test from 'node:test';
import { readCustomDomainHealth } from '../lib/custom-domain-health';

const domain = 'store.synthetic.example.com';
const token = 'synthetic-domain-ownership';
const env = {
    VERCEL_API_TOKEN: 'synthetic-unit-only',
    VERCEL_STOREFRONT_PROJECT_ID: 'synthetic-commerce',
    CUSTOM_DOMAIN_CNAME_TARGET: 'connect.synthetic.invalid',
};

for (const verified of [true, false]) {
    test(`domain records describe only the connected hostname; provider verified=${verified}`, async () => {
        const original = globalThis.fetch;
        const methods: string[] = [];
        globalThis.fetch = async (input, init) => {
            const url = new URL(String(input));
            methods.push(init?.method ?? 'GET');
            if (url.hostname === 'api.vercel.com') {
                return Response.json(url.pathname.endsWith('/config')
                    ? { configuredBy: 'CNAME', misconfigured: false }
                    : { name: domain, verified });
            }
            assert.ok(['cloudflare-dns.com', 'dns.google'].includes(url.hostname));
            const name = url.searchParams.get('name');
            const type = url.searchParams.get('type');
            const answer = type === 'CNAME' && name === domain ? env.CUSTOM_DOMAIN_CNAME_TARGET
                : type === 'TXT' && name === `_letbuyy-challenge.${domain}` ? token : null;
            return Response.json({ Status: 0, Answer: answer ? [{ data: `"${answer}"` }] : [] });
        };
        try {
            const health = await readCustomDomainHealth(env, {
                siteId: '11111111-1111-4111-8111-111111111111', domain,
                status: 'verifying', verificationToken: token,
            });
            assert.deepEqual(health.records.map(record => [record.type, record.host, record.value]), [
                ['TXT', `_letbuyy-challenge.${domain}`, token],
                ['CNAME', domain, env.CUSTOM_DOMAIN_CNAME_TARGET],
            ], 'do not suggest an unrelated apex ALIAS or a fabricated DNS record');
            assert.ok(health.records.every(record => record.status === 'verified'));
            assert.equal(health.txt_verified, true);
            assert.equal(health.cname_verified, true);
            assert.equal(health.ssl_active, verified, 'removing advice cannot bypass provider verification');
            assert.equal(health.status, verified ? 'active' : 'verifying');
            assert.ok(methods.length > 0 && methods.every(method => method === 'GET'), 'health must not write DNS or provider ownership');
        } finally { globalThis.fetch = original; }
    });
}
