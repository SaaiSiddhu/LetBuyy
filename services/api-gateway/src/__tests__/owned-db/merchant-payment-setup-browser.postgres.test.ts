// Normal Identity login -> maintained Merchant Settings/BFF -> real Worker -> owned PostgreSQL.
// Only Razorpay verification is intercepted; no real provider credentials or payments are used.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { exportJWK } from 'jose';
import { chromium, expect as playwrightExpect } from '@playwright/test';
import { hashMerchantPassword } from '../../lib/merchant-password';
import { Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET } from './gateway-harness';
import { requireOwnedDatabase, allocateOwnedLoopbackPorts, startOwnedPooledSqlProxy, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
const owned = requireOwnedDatabase();
const expect = playwrightExpect.configure({ timeout: 45000 });
async function ready(url: string, app: OwnedClientProcess) {
    const end = Date.now() + 360000;
    while (Date.now() < end) {
        if (app.exitCode !== null || app.signalCode !== null) throw new Error('Owned Next stopped before readiness');
        try { if ((await fetch(url, { signal: AbortSignal.timeout(3000) })).status < 500) return; } catch { /* bounded startup */ }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('Owned Next readiness timed out');
}
test('normal merchant payment setup has truthful readiness, independent methods and safe failure recovery', { timeout: 900000 }, async () => {
    const site = newSyntheticTenant('pay-browser'); seedSyntheticTenant(owned.psql, site);
    const owner = crypto.randomUUID(), email = `syn-payment-${owner}@example.invalid`, password = crypto.randomUUID() + '!Aa4';
    const hash = await hashMerchantPassword(password);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES('${owner}','${email}',true,'Synthetic Payment Owner','${hash}');
      UPDATE sites SET custom_user_id='${owner}',online_payment_enabled=false,cod_enabled=true WHERE id='${site.siteId}';`);
    const [identityPort, merchantPort] = await allocateOwnedLoopbackPorts(owned, 2);
    const identityOrigin = `http://localhost:${identityPort}`, merchantOrigin = `http://localhost:${merchantPort}`;
    const proxy = await startOwnedPooledSqlProxy(owned), keys = await newIdentityKeys();
    const gateway = new Gateway(gatewayEnv(owned, keys, { ENVIRONMENT: 'local', LETBUYY_IDENTITY_ISSUER: identityOrigin,
        PAYMENT_CONFIG_ENCRYPTION_KEY: crypto.randomUUID(), ...proxy.env() }));
    const evidence = `${tmpdir()}/letbuyy-payments-browser-${owned.runId}`; mkdirSync(evidence, { recursive: true });
    let identity: OwnedClientProcess | undefined, merchant: OwnedClientProcess | undefined, bridge: Server | undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    let providerStatus = 200, readOutage = false, loseReply = false, providerCalls = 0;
    const stages: string[] = []; const stage = (value: string) => { stages.push(value); console.info('PAYMENT_SETUP_STAGE ' + value); };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.hostname === 'api.razorpay.com') {
            assert.equal(url.pathname, '/v1/payments'); providerCalls += 1;
            return Response.json({ entity: 'collection', items: [] }, { status: providerStatus });
        }
        return originalFetch(input, init);
    }) as typeof fetch;
    try {
        bridge = createServer(async (req, res) => {
            const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const body = Buffer.concat(chunks).toString(), headers = new Headers();
            for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string' && !['host','connection','content-length','transfer-encoding','accept-encoding'].includes(name)) headers.set(name, value);
            const path = (req.url || '/').split('?')[0];
            try {
                if (path.endsWith('/payment-config') && req.method === 'GET' && readOutage) {
                    res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'Synthetic payment read unavailable.' } })); return;
                }
                const reply = await gateway.request(req.url || '/', { method: req.method, headers, ...(body ? { body } : {}) });
                if (path.endsWith('/payment-config') && req.method === 'POST' && reply.status === 200 && loseReply) {
                    loseReply = false; res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'Synthetic saved response lost. Retry the same request.' } })); return;
                }
                res.writeHead(reply.status, Object.fromEntries(reply.headers.entries())); res.end(reply.text);
            } catch { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'Owned bridge failed.' } })); }
        });
        await new Promise<void>((resolve, reject) => { bridge!.once('error', reject); bridge!.listen(0, '127.0.0.1', resolve); });
        const address = bridge.address();
        assert.ok(address && typeof address !== 'string');
        const api = `http://127.0.0.1:${address.port}/v1`;
        const shared = { INTERNAL_API_SECRET: INTERNAL_SECRET, NEXT_PUBLIC_ACCOUNTS_URL: identityOrigin, NEXT_PUBLIC_ADMIN_URL: merchantOrigin, NEXT_PUBLIC_API_URL: api, LETBUYY_API_URL: api, LETBUYY_IDENTITY_ISSUER: identityOrigin };
        identity = startOwnedClientRuntime(owned, 'identity-next', { port: identityPort, env: { ...shared, NEXT_PUBLIC_APP_URL: identityOrigin,
            LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({ ...await exportJWK(keys.privateKey), alg: 'ES256', kid: keys.kid }), ACCOUNTS_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID(), COOKIE_DOMAIN: '',
            NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
            LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', RESEND_API_KEY: '', LETBUYY_EMAIL_API_KEY: '' } });
        merchant = startOwnedClientRuntime(owned, 'merchant-next-production', { port: merchantPort, env: { ...shared, LETBUYY_API_BASE_URL: api } });
        for (const [name, app] of [['identity', identity], ['merchant', merchant]] as const) {
            app.stdout.on('data', data => writeFileSync(`${evidence}/${name}.stdout.log`, String(data), { flag: 'a' }));
            app.stderr.on('data', data => writeFileSync(`${evidence}/${name}.stderr.log`, String(data), { flag: 'a' }));
        }
        await ready(identityOrigin + '/login', identity); await ready(merchantOrigin, merchant);
        browser = await chromium.launch({ headless: true }); const context = await browser.newContext(); const page = await context.newPage();
        page.setDefaultTimeout(45000); page.setDefaultNavigationTimeout(90000);
        await page.goto(identityOrigin + '/login'); await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/);
        await page.getByLabel('Email', { exact: true }).fill(email); await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
        await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Log in', exact: true }).click();
        await page.waitForURL(url => url.origin === merchantOrigin, { timeout: 90000 }); stage('normal_login');
        await page.goto(`${merchantOrigin}/${site.subdomain}/settings/payments`);
        await expect(page.getByRole('heading', { name: 'Choose how you accept payments' })).toBeVisible();
        await expect(page.getByRole('radio', { name: /LetBuyy Payments/ })).toBeDisabled();
        const online = page.getByRole('switch', { name: 'Online payments', exact: true });
        const cod = page.getByRole('switch', { name: 'Cash on delivery', exact: true });
        await expect(online).toBeDisabled(); await expect(cod).toBeChecked(); stage('unconfigured_is_unavailable');
        const keyId = ['rzp','test',crypto.randomUUID().replaceAll('-', '')].join('_'); const secret = crypto.randomUUID().replaceAll('-', '');
        await page.getByLabel('Razorpay test key ID', { exact: true }).fill(keyId); await page.getByLabel('Razorpay test key secret', { exact: true }).fill(secret);
        loseReply = true;
        await page.getByRole('button', { name: 'Verify and save test credentials', exact: true }).click();
        await expect(page.getByText('Synthetic saved response lost. Retry the same request.', { exact: true })).toBeVisible();
        assert.equal(providerCalls, 1);
        await page.getByRole('button', { name: 'Verify and save test credentials', exact: true }).click();
        await expect(page.getByLabel('Razorpay test key secret', { exact: true })).toHaveValue(''); assert.equal(providerCalls, 1, 'same committed save replays without a second provider verification');
        await expect(online).toBeEnabled(); await expect(online).not.toBeChecked(); await expect(cod).toBeChecked(); stage('credential_save_recovered_without_activation');
        await online.click(); await expect(online).toBeChecked(); await page.reload(); await expect(online).toBeChecked();
        assert.equal(owned.psql(`SELECT online_payment_enabled FROM sites WHERE id='${site.siteId}';`), 't'); stage('explicit_online_persisted');
        await page.getByText('Replace test credentials', { exact: true }).click();
        await page.getByLabel('Razorpay test key ID', { exact: true }).fill(keyId); await page.getByLabel('Razorpay test key secret', { exact: true }).fill(crypto.randomUUID().replaceAll('-', ''));
        providerStatus = 401; await page.getByRole('button', { name: 'Verify and save test credentials', exact: true }).click();
        await expect(page.getByText('Razorpay did not verify these credentials. Your saved connection is unchanged.', { exact: true })).toBeVisible();
        assert.equal(owned.psql(`SELECT online_payment_enabled FROM sites WHERE id='${site.siteId}';`), 't'); stage('failed_replacement_preserves_connection');
        // Clear synthetic secret before any visual evidence.
        await page.getByLabel('Razorpay test key secret', { exact: true }).fill(''); await page.getByLabel('Razorpay test key ID', { exact: true }).fill('');
        readOutage = true; await page.getByRole('button', { name: 'Reload saved settings', exact: true }).click();
        await expect(page.getByText('Synthetic payment read unavailable.', { exact: true })).toBeVisible(); await expect(cod).toBeDisabled(); stage('read_failure_blocks_stale_controls');
        readOutage = false; await page.getByRole('button', { name: 'Retry', exact: true }).click(); await expect(cod).toBeEnabled();
        for (const scheme of ['light', 'dark'] as const) {
            if (await page.locator('html').getAttribute('data-theme') !== scheme) {
                await page.getByRole('button', { name: 'Toggle payment settings theme', exact: true }).click();
            }
            await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
            await expect(page.locator('[data-letbuyy-surface="admin"]').first()).toHaveAttribute('data-letbuyy-theme', scheme);
            await page.setViewportSize({ width: 390, height: 844 });
            assert.equal(await page.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth'), true, 'narrow screen has no horizontal overflow');
            await page.screenshot({ path: `${evidence}/${scheme}-mobile.png`, fullPage: true });
        }
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.evaluate('document.documentElement.style.zoom = "2"');
        assert.equal(await page.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth'), true, '200 percent zoom has no horizontal overflow');
        await page.getByRole('button', { name: 'Toggle payment settings theme', exact: true }).focus();
        await page.keyboard.press('Space');
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
        stage('real_theme_toggle_keyboard_mobile_and_zoom');
        writeFileSync(`${evidence}/result.json`, JSON.stringify({ runId: owned.runId, stages, providerCalls, realProviderCalls: 0, bankVerified: false, hostedVerified: false }, null, 2));
        console.info('PAYMENT_SETUP_EVIDENCE ' + evidence);
    } finally {
        globalThis.fetch = originalFetch; await browser?.close(); await stopOwnedClientRuntime(merchant); await stopOwnedClientRuntime(identity);
        await gateway.settle(); await proxy.stop();
        if (bridge) { bridge.closeAllConnections(); await new Promise<void>(resolve => bridge!.close(() => resolve())); }
    }
});
