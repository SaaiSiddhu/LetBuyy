// Normal local owner sign-in -> compiled Merchant -> canonical Gateway -> owned
// PostgreSQL -> public bootstrap. Provider simulation is explicit and loopback-only.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { exportJWK } from 'jose';
import { chromium, expect, type Browser } from '@playwright/test';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { hashMerchantPassword } from '../../services/api-gateway/src/lib/merchant-password';
import { Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase, listOwnedMerchantProfileSourcePaths, startOwnedPooledSqlProxy, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import { createLocalTurnstileProvider, LOCAL_TURNSTILE_SECRET } from '../fixtures/local-turnstile-provider';
import { createOwnedProviderFetch } from '../../scripts/governance/owned-provider-network.mjs';
import { validateOwnedNextDirectoryReceipt } from '../../scripts/governance/owned-next-directory.mjs';

const owned = requireOwnedDatabase();
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function sourceSnapshot() {
    const paths = listOwnedMerchantProfileSourcePaths();
    return paths.filter(path => {
        const marker = /^apps\/(?:merchant\/web|platform\/identity)\/\.next-session-runtime-(\d+)-((?:identity|merchant)-next-production)\.owner\.json$/.exec(path);
        if (!marker) return true;
        validateOwnedNextDirectoryReceipt(JSON.parse(readFileSync(path, 'utf8')), {
            root: process.cwd(), kind: marker[2], runId: owned.runId, supervisorPid: Number(marker[1]), parentPid: process.pid,
        });
        return false;
    }).map(path => ({ path, sha256: existsSync(path) ? sha(readFileSync(path)) : null }));
}
async function freePort() {
    const server = createServer();
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    const port = (server.address() as { port: number }).port;
    await new Promise<void>(done => server.close(() => done()));
    return port;
}
async function ready(origin: string, child: OwnedClientProcess) {
    const until = Date.now() + 360_000;
    while (Date.now() < until) {
        if (child.exitCode !== null) throw new Error('Owned profile browser runtime stopped');
        try { if ((await fetch(origin, { redirect: 'manual', signal: AbortSignal.timeout(2000) })).status < 500) return; } catch { /* bounded local readiness */ }
        await new Promise(done => setTimeout(done, 200));
    }
    throw new Error('Owned profile browser runtime readiness timed out');
}

test('normal Preferences enforces canonical SEO length, persists through General and serves only public metadata', { timeout: 900_000 }, async () => {
    const root = join(tmpdir(), 'letbuyy-profile-browser-' + owned.runId);
    mkdirSync(root, { mode: 0o700 });
    const source = sourceSnapshot(), sourceHash = sha(JSON.stringify(source));
    writeFileSync(join(root, 'source-snapshot.json'), JSON.stringify(source) + '\n', { mode: 0o600, flag: 'wx' });
    const tenant = newSyntheticTenant('profile-browser'), actor = randomUUID();
    const email = `syn-profile-browser-${actor}@example.invalid`, password = randomUUID() + randomUUID();
    seedSyntheticTenant(owned.psql, tenant);
    const hash = await hashMerchantPassword(password);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES('${actor}','${email}',true,'Synthetic Profile Owner','${hash}');
        UPDATE sites SET custom_user_id='${actor}',business_profile='{"email":"synthetic-private-contact@example.invalid"}'::jsonb,
            invoice_address='{"attention":"Retained synthetic invoice attention"}'::jsonb WHERE id='${tenant.siteId}';`);
    const identityOrigin = 'http://localhost:' + await freePort(), merchantOrigin = 'http://localhost:' + await freePort();
    const provider = await createLocalTurnstileProvider(owned), originalFetch = globalThis.fetch;
    globalThis.fetch = createOwnedProviderFetch(originalFetch, provider.profile);
    const proxy = await startOwnedPooledSqlProxy(owned), keys = await newIdentityKeys();
    const gateway = new Gateway(gatewayEnv(owned, keys, { ...proxy.env(), ENVIRONMENT: 'local', LETBUYY_IDENTITY_ISSUER: identityOrigin, NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost' }));
    let bridge: Server | undefined, identity: OwnedClientProcess | undefined, merchant: OwnedClientProcess | undefined, browser: Browser | undefined;
    try {
        bridge = createServer(async (req, res) => {
            try {
                const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
                const body = Buffer.concat(chunks).toString(), headers = new Headers();
                for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string' && !['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding'].includes(name)) headers.set(name, value);
                const result = await gateway.request(req.url || '/', { method: req.method, headers, ...(body ? { body } : {}) });
                res.writeHead(result.status, Object.fromEntries(result.headers.entries())); res.end(result.text);
            } catch { res.writeHead(500); res.end('{"error":{"code":"OWNED_BRIDGE_UNAVAILABLE"}}'); }
        });
        await new Promise<void>(done => bridge!.listen(0, '127.0.0.1', done));
        const apiOrigin = 'http://127.0.0.1:' + (bridge.address() as { port: number }).port;
        const shared = { INTERNAL_API_SECRET: INTERNAL_SECRET, NEXT_PUBLIC_ACCOUNTS_URL: identityOrigin, NEXT_PUBLIC_ADMIN_URL: merchantOrigin };
        identity = startOwnedClientRuntime(owned, 'identity-next-production', { port: Number(new URL(identityOrigin).port), providerFixture: provider.profile, env: {
            ...shared, LETBUYY_API_URL: apiOrigin + '/v1', LETBUYY_IDENTITY_ISSUER: identityOrigin,
            LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({ ...await exportJWK(keys.privateKey), alg: 'ES256', kid: keys.kid }),
            ACCOUNTS_COOKIE_SECRET: randomUUID() + randomUUID(), COOKIE_DOMAIN: '', NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: LOCAL_TURNSTILE_SECRET,
            LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', RESEND_API_KEY: '', LETBUYY_EMAIL_API_KEY: '',
        } });
        merchant = startOwnedClientRuntime(owned, 'merchant-next-production', { port: Number(new URL(merchantOrigin).port), env: { ...shared, LETBUYY_API_BASE_URL: apiOrigin + '/v1' } });
        await Promise.all([ready(identityOrigin + '/login', identity), ready(merchantOrigin, merchant)]);
        browser = await chromium.launch({ headless: true }); const context = await browser.newContext();
        await provider.attachBrowser(context, [identityOrigin, merchantOrigin]);
        const page = await context.newPage(); page.setDefaultTimeout(30_000); page.setDefaultNavigationTimeout(90_000);
        await page.goto(identityOrigin + '/login'); await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/);
        await page.getByLabel('Email', { exact: true }).fill(email); await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
        await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Log in', exact: true }).click();
        await page.waitForURL(url => url.origin === merchantOrigin);
        await page.goto(`${merchantOrigin}/${tenant.subdomain}/online-store/preferences`);
        const description = page.getByRole('textbox', { name: 'Meta description', exact: true });
        await expect(description).toBeVisible();
        const longDescription = 'Synthetic SEO description ' + 'd'.repeat(200), expectedDescription = longDescription.slice(0, 160);
        await page.getByRole('textbox', { name: 'Homepage title', exact: true }).fill('Synthetic canonical SEO boundary');
        await description.fill(longDescription); await expect(description).toHaveValue(expectedDescription);
        await expect(page.getByText('160 of 160 characters used', { exact: true })).toBeVisible();
        const settingsPath = `/api/stores/${tenant.subdomain}/settings`;
        const [saved] = await Promise.all([page.waitForResponse(response => new URL(response.url()).pathname === settingsPath && response.request().method() === 'PATCH'), page.getByRole('button', { name: 'Save changes', exact: true }).click()]);
        assert.equal(saved.status(), 200, await saved.text()); await expect(page.getByText('Preferences saved', { exact: true })).toBeVisible();
        await page.screenshot({ path: join(root, 'preferences-canonical-boundary.png'), fullPage: true });
        const stored = JSON.parse(owned.psql(`SELECT json_build_object('version',version,'meta_title',meta_title,'meta_description',meta_description) FROM sites WHERE id='${tenant.siteId}'`));
        assert.equal(stored.meta_description, expectedDescription);
        const denied = await context.request.patch(merchantOrigin + settingsPath, { headers: { Origin: merchantOrigin, 'X-LetBuyy-Merchant-Context': actor, 'X-Idempotency-Key': randomUUID() }, data: { version: stored.version, seo_description: expectedDescription + 'x' } });
        assert.equal(denied.status(), 400); assert.equal(Number(owned.psql(`SELECT version FROM sites WHERE id='${tenant.siteId}'`)), stored.version);
        await page.goto(`${merchantOrigin}/${tenant.subdomain}/settings/general`);
        await expect(page.getByRole('textbox', { name: 'SEO title', exact: true })).toHaveValue(stored.meta_title);
        await expect(page.getByRole('textbox', { name: 'SEO description', exact: true })).toHaveValue(expectedDescription);
        await page.getByRole('textbox', { name: 'SEO description', exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(root, 'general-canonical-seo-readback.png'), fullPage: true });
        await page.getByRole('textbox', { name: 'Store name', exact: true }).fill('Synthetic General write roundtrip');
        const [generalSaved] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === settingsPath && response.request().method() === 'PATCH'),
            page.getByRole('button', { name: 'Save changes', exact: true }).click(),
        ]);
        assert.equal(generalSaved.status(), 200, await generalSaved.text());
        await expect(page.getByText('Settings saved', { exact: true })).toBeVisible();
        const generalWrite = JSON.parse(owned.psql(`SELECT json_build_object('version',version,'name',name,'invoice_address',invoice_address) FROM sites WHERE id='${tenant.siteId}'`));
        assert.equal(generalWrite.version, stored.version + 1);
        assert.equal(generalWrite.name, 'Synthetic General write roundtrip');
        assert.equal(generalWrite.invoice_address.attention, 'Retained synthetic invoice attention');
        const publicRead = await gateway.request(`/v1/storefront/${tenant.subdomain}?projection=render-v1`);
        assert.equal(publicRead.status, 200, publicRead.text);
        assert.equal(publicRead.json?.data.meta_title, stored.meta_title); assert.equal(publicRead.json?.data.meta_description, expectedDescription);
        assert(!publicRead.text.includes('synthetic-private-contact@example.invalid'));
        assert.equal(Object.hasOwn(publicRead.json!.data, 'business_profile'), false);
        assert.equal(sha(JSON.stringify(sourceSnapshot())), sourceHash, 'qualified source must remain unchanged');
        const report = { run_id: owned.runId, source_sha256: sourceHash, root, persisted_synthetic: stored, general_write: generalWrite, normal_sign_in: true, browser_textarea_input_bounded: true, forged_overlong_request_denied_without_effect: true, general_readback: true, retained_invoice_attention: true, public_bootstrap_metadata: true, private_contact_absent_from_public: true, provider_counts: provider.counts,
            scope: 'Compiled normal owner Preferences/General and public Gateway metadata; no buyer HTML renderer, native new artifact, hosted/provider/release or full-feature acceptance.' };
        writeFileSync(join(root, 'browser-verified.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
        console.info('OWNED_PROFILE_BROWSER ' + JSON.stringify(report));
    } finally {
        await browser?.close(); await stopOwnedClientRuntime(merchant); await stopOwnedClientRuntime(identity); await gateway.settle();
        await closePooledSqlClients(); await proxy.stop(); await provider.close(); globalThis.fetch = originalFetch;
        if (bridge) { bridge.closeAllConnections(); await new Promise<void>(done => bridge!.close(() => done())); }
    }
});
