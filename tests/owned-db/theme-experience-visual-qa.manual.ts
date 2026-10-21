// Explicit, bounded CUA-driven visual QA harness. Never auto-discovered by the DB
// acceptance lane. All identities/data/processes belong to this disposable run.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { exportJWK } from 'jose';
import { hashMerchantPassword } from '../../services/api-gateway/src/lib/merchant-password';
import { Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
async function freePort() { const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const port = (server.address() as {
    port: number;
}).port; await new Promise<void>(resolve => server.close(() => resolve())); return port; }
test('owned CUA visual QA servers load the real identity, merchant and commerce applications', { timeout: 3600000 }, async () => {
    const owned = requireOwnedDatabase(), tenant = newSyntheticTenant('theme-visual');
    seedSyntheticTenant(owned.psql, tenant);
    const actor = crypto.randomUUID(), email = `synthetic-theme-${actor}@example.invalid`, password = crypto.randomUUID() + '-Aa42';
    const hash = await hashMerchantPassword(password);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES('${actor}','${email}',true,'Synthetic Theme Designer','${hash}');UPDATE sites SET custom_user_id='${actor}',theme_id='letbuyy-core',status='draft',published=false WHERE id='${tenant.siteId}';INSERT INTO subscriptions(user_id,store_id,plan,status) VALUES('${actor}','${tenant.siteId}','enterprise','active');`);
    const keys = await newIdentityKeys(), identityPort = await freePort(), merchantPort = await freePort(), commercePort = await freePort();
    const identityOrigin = `http://localhost:${identityPort}`, merchantOrigin = `http://localhost:${merchantPort}`, commerceOrigin = `http://localhost:${commercePort}`;
    const gateway = new Gateway(gatewayEnv(owned, keys, { ENVIRONMENT: 'local', LETBUYY_IDENTITY_ISSUER: identityOrigin, NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost', PREVIEW_SIGNING_KEY: crypto.randomUUID() + crypto.randomUUID(), STORE_ACCESS_SIGNING_KEY: crypto.randomUUID() + crypto.randomUUID() }));
    const bridge = createServer(async (req, res) => { const began = Date.now(); try {
        const chunks: Buffer[] = [];
        for await (const chunk of req)
            chunks.push(Buffer.from(chunk));
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers))
            if (typeof value === 'string' && !['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding'].includes(name))
                headers.set(name, value);
        const body = Buffer.concat(chunks).toString();
        const result = await gateway.request(req.url || '/', { method: req.method, headers, ...(body ? { body } : {}) });
        appendFileSync('/private/tmp/theme-qa-request-timing.log', JSON.stringify({ run: owned.runId, method: req.method, path: (req.url || '/').split('?')[0], status: result.status, ms: Date.now() - began }) + '\n');
        res.writeHead(result.status, Object.fromEntries(result.headers.entries()));
        res.end(result.text);
    }
    catch {
        res.writeHead(500);
        res.end('{}');
    } });
    await new Promise<void>(resolve => bridge.listen(0, '127.0.0.1', resolve));
    const apiOrigin = `http://127.0.0.1:${(bridge.address() as {
        port: number;
    }).port}`;
    const clients: OwnedClientProcess[] = [];
    async function ready(url: string, child: OwnedClientProcess) { const deadline = Date.now() + 600000; child.stdout.on('data', () => { }); child.stderr.on('data', chunk => { const text = String(chunk); if (/Error:|Failed|error TS|error -/.test(text))
        appendFileSync('/private/tmp/theme-qa-build-errors.log', text.replace(/eyJ[\w.-]+/g, '[REDACTED]').slice(0, 1500)); }); while (true) {
        assert.equal(child.exitCode, null);
        try {
            if ((await fetch(url, { signal: AbortSignal.timeout(3000) })).status < 500)
                break;
        }
        catch { }
        if (Date.now() > deadline)
            throw new Error('Owned production build/start timed out');
        await new Promise(resolve => setTimeout(resolve, 300));
    } }
    const common = { INTERNAL_API_SECRET: INTERNAL_SECRET, LETBUYY_INTERNAL_API_SECRET: INTERNAL_SECRET, NEXT_PUBLIC_ACCOUNTS_URL: identityOrigin, NEXT_PUBLIC_ADMIN_URL: merchantOrigin, NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost', LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false' };
    try {
        clients.push(startOwnedClientRuntime(owned, 'identity-next-production', { port: identityPort, env: { ...common, LETBUYY_API_URL: apiOrigin + '/v1', LETBUYY_IDENTITY_ISSUER: identityOrigin, LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({ ...await exportJWK(keys.privateKey), alg: 'ES256', kid: keys.kid }), ACCOUNTS_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID(), COOKIE_DOMAIN: '', NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA', RESEND_API_KEY: '', LETBUYY_EMAIL_API_KEY: '' } }));
        await ready(identityOrigin + '/login', clients[0]);
        clients.push(startOwnedClientRuntime(owned, 'merchant-next-production', { port: merchantPort, env: { ...common, LETBUYY_API_BASE_URL: apiOrigin + '/v1', NEXT_PUBLIC_STOREFRONT_URL: commerceOrigin } }));
        await ready(merchantOrigin, clients[1]);
        clients.push(startOwnedClientRuntime(owned, 'commerce-next-production', { port: commercePort, env: { ...common, LETBUYY_API_BASE_URL: apiOrigin + '/v1', LETBUYY_API_URL: apiOrigin + '/v1', NEXT_PUBLIC_API_BASE_URL: apiOrigin + '/v1', NEXT_PUBLIC_API_URL: apiOrigin + '/v1', PREVIEW_SIGNING_KEY: String(gateway.env.PREVIEW_SIGNING_KEY || ''), STORE_ACCESS_SIGNING_KEY: String(gateway.env.STORE_ACCESS_SIGNING_KEY || '') } }));
        for (const child of clients) {
            child.stdout.on('data', () => { });
            child.stderr.on('data', () => { });
        }
        await ready(commerceOrigin + '/preview/coming-soon', clients[2]);
        const finish = `/private/tmp/theme-qa-finish-${owned.runId}`;
        const info = { runId: owned.runId, merchantUrl: `${merchantOrigin}/${tenant.subdomain}/online-store/themes`, marketplaceUrl: `${merchantOrigin}/${tenant.subdomain}/online-store/themes/marketplace`, identityOrigin, commerceOrigin, subdomain: tenant.subdomain, email, password, finish };
        writeFileSync('/private/tmp/letbuyy-theme-qa.json', JSON.stringify(info));
        console.info('THEME_QA_READY', JSON.stringify({ merchantOrigin, identityOrigin, commerceOrigin, finish }));
        const until = Date.now() + 2400000;
        while (!existsSync(finish)) {
            if (Date.now() > until)
                throw new Error('Bounded manual QA window expired');
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        const summary = JSON.parse(owned.psql(`SELECT jsonb_build_object('installed',(SELECT count(*) FROM theme_instances WHERE store_id=s.id),'theme',theme_id,'published',published,'accessMode',access_mode,'headingSaved',position('Designed for your everyday' in template_config::text)>0,'drafts',(SELECT count(*) FROM theme_instance_drafts WHERE store_id=s.id)) FROM sites s WHERE id='${tenant.siteId}';`));
        mkdirSync('artifacts/theme-experience-2026-10-21', { recursive: true });
        writeFileSync('artifacts/theme-experience-2026-10-21/visual-qa-state.json', JSON.stringify(summary, null, 2));
        assert.ok(summary.installed > 0, 'CUA journey added a real theme');
        assert.equal(summary.published, true, 'CUA journey published its saved theme');
        assert.equal(summary.headingSaved, true, 'saved heading survived publication');
    }
    finally {
        await Promise.allSettled(clients.map(child => stopOwnedClientRuntime(child)));
        await gateway.settle();
        await new Promise<void>(resolve => { bridge.close(() => resolve()); bridge.closeAllConnections(); });
    }
});
