// Owned synthetic tenant, normal password login and real production-built web
// forms. No auth bypass, response stubs, provider money or shared database.
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportJWK } from 'jose';
import { chromium, expect } from '@playwright/test';
import { hashMerchantPassword } from '../../lib/merchant-password';
import { Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET } from './gateway-harness';
import { requireOwnedDatabase, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
const owned = requireOwnedDatabase();
async function freePort() {
    const server = createServer(); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    await new Promise<void>(r => server.close(() => r())); return port;
}
async function ready(url: string, child: OwnedClientProcess) {
    const deadline = Date.now() + 600_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) throw new Error('Owned production app stopped before readiness');
        try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status < 500) return; } catch { /* starting/building */ }
        await new Promise(r => setTimeout(r, 250));
    }
    throw new Error('Owned production app readiness timed out');
}
test('merchant shipping and tax forms persist through scoped web proxies and reload after normal login', { timeout: 900_000 }, async () => {
    const site = newSyntheticTenant('w2-settings-ui'); seedSyntheticTenant(owned.psql, site, { gst: true });
    const actor = randomUUID(), email = `syn-settings-${actor}@example.invalid`, password = randomUUID() + randomUUID();
    const hash = await hashMerchantPassword(password);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES('${actor}','${email}',true,'Synthetic Settings Owner','${hash}'); UPDATE sites SET custom_user_id='${actor}',tax_inclusive=false WHERE id='${site.siteId}';`);
    const keys = await newIdentityKeys(), identityPort = await freePort(), merchantPort = await freePort();
    const identityOrigin = `http://localhost:${identityPort}`, merchantOrigin = `http://localhost:${merchantPort}`;
    const gateway = new Gateway(gatewayEnv(owned, keys, { ENVIRONMENT: 'local', LETBUYY_IDENTITY_ISSUER: identityOrigin }));
    let bridge: Server | undefined, identity: OwnedClientProcess | undefined, merchant: OwnedClientProcess | undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    const artifacts = join(tmpdir(), `letbuyy-w2-settings-${owned.runId}`); mkdirSync(artifacts, { recursive: true });
    const receipts: Array<{ path: string; method: string; status: number }> = [];
    let stage = 'start';
    try {
        bridge = createServer(async (req, res) => {
            const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const body = Buffer.concat(chunks).toString(), headers = new Headers();
            for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string' && !['host','connection','content-length','transfer-encoding','accept-encoding'].includes(name)) headers.set(name, value);
            try {
                const result = await gateway.request(req.url || '/', { method: req.method, headers, ...(body ? { body } : {}) });
                res.writeHead(result.status, Object.fromEntries(result.headers.entries())); res.end(result.text);
            } catch { res.writeHead(500); res.end('{}'); }
        });
        await new Promise<void>(r => bridge!.listen(0, '127.0.0.1', r));
        const apiOrigin = `http://127.0.0.1:${(bridge.address() as { port: number }).port}`;
        const common = { INTERNAL_API_SECRET: INTERNAL_SECRET, NEXT_PUBLIC_ACCOUNTS_URL: identityOrigin, NEXT_PUBLIC_ADMIN_URL: merchantOrigin,
            LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false' };
        identity = startOwnedClientRuntime(owned, 'identity-next-production', { port: identityPort, env: { ...common,
            LETBUYY_API_URL: apiOrigin + '/v1', LETBUYY_IDENTITY_ISSUER: identityOrigin,
            LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({ ...await exportJWK(keys.privateKey), alg: 'ES256', kid: keys.kid }),
            ACCOUNTS_COOKIE_SECRET: randomUUID() + randomUUID(), COOKIE_DOMAIN: '',
            NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
            RESEND_API_KEY: '', LETBUYY_EMAIL_API_KEY: '' } });
        merchant = startOwnedClientRuntime(owned, 'merchant-next-production', { port: merchantPort, env: { ...common, LETBUYY_API_BASE_URL: apiOrigin + '/v1', NEXT_PUBLIC_STOREFRONT_URL: merchantOrigin } });
        // Capture only build stage diagnostics, never the generated signing key or login body.
        for (const [label, child] of [['identity', identity], ['merchant', merchant]] as const) {
            const stream = (data: Buffer) => { const text = data.toString(); if (/error|failed|compiled|ready|generat|checking/i.test(text)) console.log('W2_BUILD', label, text.replace(/https?:\/\/\S+/g, '[url]').slice(0, 600)); };
            child.stdout.on('data', stream); child.stderr.on('data', stream);
        }
        await Promise.all([ready(identityOrigin + '/login', identity), ready(merchantOrigin, merchant)]);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        const page = await context.newPage(); page.setDefaultTimeout(30_000); page.setDefaultNavigationTimeout(60_000);
        page.on('response', response => {
            const url = new URL(response.url()); if (url.origin === merchantOrigin && /\/api\/stores\/.*\/(shipping|taxes)/.test(url.pathname)) receipts.push({ path: url.pathname, method: response.request().method(), status: response.status() });
        });
        stage = 'password-login'; await page.goto(identityOrigin + '/login');
        await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 30_000 });
        await page.getByLabel('Email', { exact: true }).fill(email); await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
        await page.getByLabel('Password', { exact: true }).fill(password);
        const [login] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/login' && r.request().method() === 'POST'), page.getByRole('button', { name: 'Log in', exact: true }).click()]);
        assert.equal(login.status(), 200);
        await page.waitForURL(url => url.origin === merchantOrigin && url.pathname === `/${site.subdomain}/dashboard`);
        // A real authenticated cookie must not let a foreign page write settings.
        // Exercise every mounted verb before any fixture row can be changed.
        stage = 'settings-origin-refusal';
        const originChecks = [
            ['shipping/profiles', 'POST'], ['shipping/profiles/' + randomUUID(), 'PATCH'],
            ['shipping/zones', 'POST'], ['shipping/zones/' + randomUUID(), 'PATCH'],
            ['shipping/zones/' + randomUUID(), 'DELETE'], ['shipping/rates', 'POST'],
            ['shipping/rates/' + randomUUID(), 'PATCH'], ['shipping/rates/' + randomUUID(), 'DELETE'],
            ['taxes', 'POST'], ['taxes', 'PATCH'], ['taxes/' + randomUUID(), 'PATCH'],
            ['taxes/' + randomUUID(), 'DELETE'],
        ] as const;
        for (const [path, method] of originChecks) {
            for (const headers of [{ origin: 'https://foreign.example.invalid' }, {}] as Record<string, string>[]) {
                const denied = await context.request.fetch(`${merchantOrigin}/api/stores/${site.subdomain}/${path}`, {
                    method, headers, data: {},
                });
                assert.equal(denied.status(), 403, `${method} ${path} must reject a foreign or missing Origin`);
                assert.equal((await denied.json()).error.code, 'FORBIDDEN_ORIGIN');
            }
        }
        assert.equal(owned.psql(`SELECT (SELECT count(*) FROM shipping_profiles WHERE site_id='${site.siteId}')+(SELECT count(*) FROM shipping_zones WHERE site_id='${site.siteId}')+(SELECT count(*) FROM tax_rates WHERE store_id='${site.siteId}');`), '0');
        const save = async (path: RegExp, method: string, action: () => Promise<unknown>) => {
            const [response] = await Promise.all([page.waitForResponse(r => path.test(new URL(r.url()).pathname) && r.request().method() === method), action()]);
            assert.ok(response.ok(), `settings mutation ${method} failed: ${response.status()}`);
            return response.json();
        };
        stage = 'country-tax-create'; await page.goto(`${merchantOrigin}/${site.subdomain}/settings/taxes`);
        await page.getByRole('button', { name: 'Add tax rate', exact: true }).first().click();
        await page.getByLabel('Tax name', { exact: true }).fill('Synthetic browser tax'); await page.getByLabel('Rate (%)', { exact: true }).fill('18');
        const created = await save(/\/taxes$/, 'POST', () => page.getByRole('button', { name: 'Add rate', exact: true }).first().click());
        const taxId = created.data.id;
        assert.equal(created.data.rate, 18, 'Merchant transport uses percentage points');
        assert.equal(Number(owned.psql(`SELECT rate FROM tax_rates WHERE id='${taxId}';`)), 0.18,
            '18% entered in the actual browser must persist once as a 0.18 fraction');
        assert.equal(owned.psql(`SELECT coalesce(state,'NULL') FROM tax_rates WHERE id='${taxId}';`), 'NULL');
        await expect(page.getByRole('heading', { name: 'Synthetic browser tax', exact: true })).toBeVisible();
        const product = randomUUID();
        owned.psql(`INSERT INTO products(id,store_id,name,sku,price,is_active) VALUES('${product}','${site.siteId}','Synthetic UI tax product','SYN-${product}',100,true);`);
        const effective = JSON.parse(owned.psql(`SELECT quote_storefront_checkout_totals('${site.siteId}',
            '[{"product_id":"${product}","quantity":1}]','{"country":"IN","state":"Karnataka","state_code":"29","zip":"560001"}',NULL,NULL,NULL);`));
        assert.equal(effective.tax_minor,1800,'actual browser entry results in 18% on a ₹100 database quote');
        assert.equal(effective.total_minor,11800);
        stage = 'state-tax-edit'; await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByLabel('Destination state', { exact: true }).selectOption('29');
        await save(/\/taxes\/[^/]+$/, 'PATCH', () => page.getByRole('button', { name: 'Update rate', exact: true }).first().click());
        await page.reload(); await expect(page.getByText('IN / 29', { exact: true })).toBeVisible();
        assert.equal(Number(owned.psql(`SELECT rate FROM tax_rates WHERE id='${taxId}';`)), 0.18,
            'editing a different field must preserve the effective rate');
        stage = 'state-tax-clear'; await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByLabel('Destination state', { exact: true }).selectOption('');
        await save(/\/taxes\/[^/]+$/, 'PATCH', () => page.getByRole('button', { name: 'Update rate', exact: true }).first().click());
        await page.reload(); await expect(page.getByRole('heading', { name: 'Synthetic browser tax', exact: true })).toBeVisible();
        assert.equal(owned.psql(`SELECT coalesce(state,'NULL') FROM tax_rates WHERE id='${taxId}';`), 'NULL');
        await page.screenshot({ path: join(artifacts, 'tax-cleared-reload.png'), fullPage: true });
        stage = 'shipping-zone-create'; await page.goto(`${merchantOrigin}/${site.subdomain}/settings/shipping`);
        stage = 'shipping-profile-create';
        await page.getByRole('button',{name:'Add profile',exact:true}).click();
        await page.getByLabel('Profile name',{exact:true}).fill('Synthetic browser profile');
        await page.getByLabel('Handling charge (₹)',{exact:true}).fill('5');
        const profile=await save(/\/shipping\/profiles$/,'POST',()=>page.getByRole('button',{name:'Save profile',exact:true}).click());
        await expect(page.getByRole('heading',{name:'Synthetic browser profile',exact:true})).toBeVisible();
        assert.equal(profile.data.is_default,true);assert.equal(profile.data.handling_fee_minor,500);
        stage = 'shipping-zone-create';
        await page.getByRole('button', { name: 'Add zone', exact: true }).first().click(); await page.getByLabel('Zone name', { exact: true }).fill('Synthetic browser zone');
        await page.getByLabel('Shipping profile',{exact:true}).selectOption(profile.data.id);
        const zone = await save(/\/shipping\/zones$/, 'POST', () => page.getByRole('button', { name: 'Add zone', exact: true }).last().click());
        const zoneId = zone.data.id; assert.equal(zone.data.profile_id,profile.data.id); await expect(page.getByRole('heading', { name: 'Synthetic browser zone', exact: true })).toBeVisible();
        stage = 'shipping-rate-create'; await page.getByRole('button', { name: 'Add rate', exact: true }).click(); await page.getByLabel('Rate name', { exact: true }).fill('Synthetic browser delivery'); await page.getByLabel('Price (₹, 0 for free)', { exact: true }).fill('20');
        const rate = await save(/\/shipping\/rates$/, 'POST', () => page.getByRole('button', { name: 'Add rate', exact: true }).last().click());
        const rateId = rate.data.id;
        assert.equal(owned.psql(`SELECT name FROM shipping_rates WHERE id='${rateId}' AND site_id='${site.siteId}';`), 'Synthetic browser delivery');
        await page.reload(); await expect(page.getByText('Synthetic browser delivery', { exact: true })).toBeVisible();
        stage = 'shipping-rate-edit';
        await page.getByRole('button', { name: 'Edit rate', exact: true }).click();
        await page.getByLabel('Minimum order (₹)', { exact: true }).fill('100');
        await page.getByLabel('Maximum order (₹)', { exact: true }).fill('500');
        await page.getByLabel('Earliest delivery (days)', { exact: true }).fill('0');
        await page.getByLabel('Latest delivery (days)', { exact: true }).fill('1');
        await save(/\/shipping\/rates\/[^/]+$/, 'PATCH', () => page.getByRole('button', { name: 'Save rate', exact: true }).click());
        await page.reload();
        assert.equal(owned.psql(`SELECT min_order_amount::text||':'||estimated_days_min::text||':'||estimated_days_max::text FROM shipping_rates WHERE id='${rateId}' AND site_id='${site.siteId}';`), '100.00:0:1');
        stage = 'shipping-zone-edit'; await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByLabel('Zone name', { exact: true }).fill('Synthetic browser zone edited');
        await save(/\/shipping\/zones\/[^/]+$/, 'PATCH', () => page.getByRole('button', { name: 'Update zone', exact: true }).first().click());
        await page.reload(); await expect(page.getByRole('heading', { name: 'Synthetic browser zone edited', exact: true })).toBeVisible();
        assert.equal(owned.psql(`SELECT price::text FROM shipping_rates WHERE id='${rateId}' AND site_id='${site.siteId}';`), '20.00');
        await page.screenshot({ path: join(artifacts, 'shipping-rate-reload.png'), fullPage: true });
        stage = 'shipping-delete';
        await save(/\/shipping\/rates\/[^/]+$/, 'DELETE', () => page.getByRole('button', { name: 'Remove', exact: true }).click());
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await save(/\/shipping\/zones\/[^/]+$/, 'DELETE', () => page.getByRole('button', { name: 'Delete zone', exact: true }).click());
        await page.reload(); await expect(page.getByRole('heading', { name: 'Synthetic browser zone edited', exact: true })).toHaveCount(0);
        stage = 'tax-delete'; await page.goto(`${merchantOrigin}/${site.subdomain}/settings/taxes`);
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await save(/\/taxes\/[^/]+$/, 'DELETE', () => page.getByRole('button', { name: 'Delete rate', exact: true }).click());
        await page.reload(); await expect(page.getByRole('heading', { name: 'Synthetic browser tax', exact: true })).toHaveCount(0);
        assert.equal(owned.psql(`SELECT (SELECT count(*) FROM tax_rates WHERE id='${taxId}')+(SELECT count(*) FROM shipping_rates WHERE id='${rateId}')+(SELECT count(*) FROM shipping_zones WHERE id='${zoneId}');`), '0');
        assert.equal(receipts.filter(r => r.status >= 400).length, 0, 'all observed settings responses succeeded');
        const receipt = { productionBuild: true, normalPasswordLogin: true, seededAccountAndStore: true, taxCreateBlankState: true, stateEditClearReload: true, zoneCreateEditReload: true, rateCreateReload: true, settingsDeleteReload: true, receipts, artifacts, providerPayment: false };
        writeFileSync(join(artifacts, 'receipt.json'), JSON.stringify(receipt, null, 2));
        console.log('W2_SETTINGS_BROWSER_PASS', JSON.stringify(receipt));
    } catch (error) {
        if (browser) {
            const page = browser.contexts()[0]?.pages()[0];
            if (page) { await page.screenshot({ path: join(artifacts, 'failure.png'), fullPage: true }); writeFileSync(join(artifacts, 'failure-body.txt'), await page.locator('body').innerText()); }
        }
        console.error('W2_SETTINGS_BROWSER_FAILURE', JSON.stringify({ stage, message: String(error).replace(/https?:\/\/\S+/g, '[url]'), receipts, artifacts })); throw error;
    } finally {
        await browser?.close(); if (merchant) await stopOwnedClientRuntime(merchant); if (identity) await stopOwnedClientRuntime(identity);
        if (bridge) await new Promise<void>(r => bridge!.close(() => r())); await gateway.settle();
    }
});
