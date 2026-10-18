// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Normal Identity password login, maintained Next UI/proxies and real Gateway,
// owned pooled SQL/PostgREST. Seed captures and intercepted transfer responses are
// synthetic local evidence, never approved provider/bank settlement evidence.
import { tmpdir as ownedTmpDir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, type Server } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { exportJWK } from 'jose';
import { createLetbuyyInternalSessionHeaders } from '@letbuyy/auth-core';
import { chromium, expect as playwrightExpect, type Page, type BrowserContext, type Response as PlaywrightResponse } from '@playwright/test';
import { STEP_SECRET, TOTP_SECRET, otp } from './merchant-stepup-fixture';
import { hashMerchantPassword } from '../../lib/merchant-password';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, INTERNAL_SECRET } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, seedSyntheticOrder, type SyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const expect = playwrightExpect.configure({ timeout: 45000 });
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
async function portFree(port: number) {
    const server = createServer();
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    await new Promise<void>(resolve => server.close(() => resolve()));
}
async function ready(url: string, app: OwnedClientProcess) {
    const end = Date.now() + 360000;
    while (Date.now() < end) {
        if (app.exitCode !== null || app.signalCode !== null) throw new Error('Owned Next runtime stopped before readiness');
        try { if ((await fetch(url, { signal: AbortSignal.timeout(3000) })).status < 500) return; } catch { /* bounded owned startup */ }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('Owned Next readiness timed out');
}
async function signIn(page: Page, identity: string, merchant: string, email: string, password: string) {
    await page.goto(identity + '/login');
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 45000 });
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
    await page.getByLabel('Password', { exact: true }).fill(password);
    const [response] = await Promise.all([
        page.waitForResponse(reply => reply.url().endsWith('/api/auth/login') && reply.request().method() === 'POST'),
        page.getByRole('button', { name: 'Log in', exact: true }).click(),
    ]);
    assert.equal(response.status(), 200);
    await page.waitForURL(url => url.origin === merchant, { timeout: 90000 });
}
function seededStatement(site: SyntheticTenant, owner: string, suffix: string) {
    const order = seedSyntheticOrder(owned.psql, site), payment = crypto.randomUUID();
    const reference = 'syn-browser-capture-' + payment;
    const amount = Number(owned.psql(`SELECT round(total*100)::bigint FROM orders WHERE id='${order.orderId}';`));
    owned.psql(`UPDATE orders SET payment_status='paid' WHERE id='${order.orderId}';
      INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,currency,provider_payment_id,idempotency_key)
      VALUES('${payment}','${site.siteId}','${order.orderId}','razorpay','sandbox','captured',${amount},'INR','${reference}','syn-capture-${payment}');
      SET ROLE service_role;
      SELECT post_settlement_ledger_transaction('${site.siteId}','payment_capture','${reference}','capture:${reference}',
        '[{"account_code":"pa_clearing","side":"debit","amount_minor":${amount}},{"account_code":"merchant_payable","side":"credit","amount_minor":${amount}}]',
        '{"compatibility_table":"payments","payment_id":"${payment}","order_id":"${order.orderId}","provider_payment_id":"${reference}"}',NULL);
      RESET ROLE;`);
    const number = 'SYN-PAYOUT-BROWSER-' + suffix;
    const orderNumber = owned.psql(`SELECT order_number FROM orders WHERE id='${order.orderId}';`);
    const metadata = JSON.stringify({ source_order_ids: [order.orderId], source_order_numbers: [orderNumber], commission_bps: 0, gst_bps: 0, synthetic_fixture: true });
    const id = owned.psql(`SET ROLE service_role;
      SELECT create_payout_statement_with_effects('${site.siteId}',${quote(number)},'razorpay_route','sandbox','razorpay_route',
        ${amount},0,0,${amount},NULL,NULL,CURRENT_DATE,'syn-statement-${crypto.randomUUID()}',ARRAY['${order.orderId}'::uuid],NULL,${quote(metadata)}::jsonb,'${owner}');
      RESET ROLE;`).split('\n').find(line => /^[0-9a-f-]{36}$/.test(line))!;
    assert.match(id, /^[0-9a-f-]{36}$/);
    return { id, number, amount, orderId: order.orderId };
}

test('normal merchant statement browser flow keeps fresh MFA, current context, durable retries and truthful readback', { timeout: 1050000 }, async () => {
    for (const port of [54770, 54771, 54772]) await portFree(port);
    const site = newSyntheticTenant('n7-browser'), otherSite = newSyntheticTenant('n7-other');
    seedSyntheticTenant(owned.psql, site); seedSyntheticTenant(owned.psql, otherSite);
    const owner = crypto.randomUUID(), other = crypto.randomUUID();
    const email = `syn-n7-${owner}@example.invalid`, otherEmail = `syn-n7-${other}@example.invalid`;
    const password = 'Synthetic-N7-browser-password-42', passwordHash = await hashMerchantPassword(password);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES
      ('${owner}','${email}',true,'Synthetic Statement Owner',${quote(passwordHash)}),
      ('${other}','${otherEmail}',true,'Synthetic Other Statement Owner',${quote(passwordHash)});
      UPDATE sites SET custom_user_id='${owner}' WHERE id='${site.siteId}';
      UPDATE sites SET custom_user_id='${other}' WHERE id='${otherSite.siteId}';`);
    const primary = seededStatement(site, owner, 'PRIMARY');
    const pending = seededStatement(site, owner, 'CONTEXT');
    const foreign = seededStatement(otherSite, other, 'FOREIGN');
    const identityOrigin = 'http://localhost:54770', merchantOrigin = 'http://localhost:54771';
    const proxy = await startOwnedPooledSqlProxy(owned), keys = await newIdentityKeys();
    const gateway = new Gateway(gatewayEnv(owned, keys, { ENVIRONMENT: 'local', STEP_UP_SIGNING_SECRET: STEP_SECRET,
        TOTP_ENCRYPTION_KEY: TOTP_SECRET, LETBUYY_IDENTITY_ISSUER: identityOrigin, ...proxy.env(),
        RAZORPAY_KEY_ID: 'rzp_test_synthetic_n7', RAZORPAY_ROUTE_KEY_SECRET: 'synthetic-n7-no-external-provider-secret',
        RAZORPAY_ROUTE_ACCOUNT_ID: 'acc_synthetic_n7', RAZORPAY_ROUTE_MODE: 'sandbox', RAZORPAY_ROUTE_PROVIDER_ENABLED: 'false' }));
    const evidence = process.env.LETBUYY_N7_BROWSER_EVIDENCE_DIR || `${ownedTmpDir()}/letbuyy-n7-browser-${owned.runId}`;
    mkdirSync(evidence, { recursive: true });
    const stages: string[] = [], calls: Array<{ path: string; status: number; key: string | null; errorCode?: string }> = [];
    const stage = (name: string) => { stages.push(name); writeFileSync(evidence + '/stages.json', JSON.stringify({ runId: owned.runId, stages }) + '\n'); console.info('N7_BROWSER_STAGE ' + name); };
    const transfers: Array<{ key: string; body: string }> = [];
    // Preparation only: AFTER cases require a fresh root source review, never a
    // provider-sandbox verdict. Only this existing named transfer seam is fake.
    const recoveryCases = new Map<string, ReturnType<typeof seededStatement> & {
        loseReply: boolean; transfers: Array<{ key: string; body: string }>;
    }>();
    const forwardedSessions = new Map<string, Headers>();
    const directChecks: Array<{ label: string; status: number }> = [];
    const challenges: Array<{ key: string; actor: string; site: string }> = [];
    let factorId = '', secret = '', listOutage = true, loseReply = true, holdChallenge = false, challengeHeld = false;
    let releaseChallenge: (() => void) | undefined;
    let bridge: Server | undefined, identity: OwnedClientProcess | undefined, merchant: OwnedClientProcess | undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined, context: BrowserContext | undefined, otherContext: BrowserContext | undefined;
    const originalFetch = globalThis.fetch;
    const providerCreatedAt = Math.floor(Date.now() / 1000);
    globalThis.fetch = (async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.hostname === 'api.razorpay.com') {
            assert.equal(url.pathname, '/v1/transfers');
            const body = String(init?.body), parsed = JSON.parse(body);
            const recovery = recoveryCases.get(String(parsed.notes.statement_id));
            if (recovery) {
                assert.equal(parsed.amount, recovery.amount);
                recovery.transfers.push({ key: new Headers(init?.headers).get('X-Transfer-Idempotency') || '', body });
                return Response.json({ id: 'trf_synthetic_n7_' + recovery.id.replaceAll('-', ''), status: recovery.transfers.length === 1 ? 'created' : 'processed', created_at: providerCreatedAt });
            }
            assert.equal(parsed.notes.statement_id, primary.id);
            assert.equal(parsed.amount, primary.amount);
            transfers.push({ key: new Headers(init?.headers).get('X-Transfer-Idempotency') || '', body });
            return Response.json({ id: 'trf_synthetic_n7_' + primary.id.replaceAll('-', ''), status: transfers.length < 3 ? 'created' : 'processed', created_at: providerCreatedAt });
        }
        return originalFetch(input, init);
    }) as typeof fetch;
    try {
        bridge = createServer(async (req, res) => {
            const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const body = Buffer.concat(chunks).toString(), headers = new Headers();
            for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string' && !['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding'].includes(name)) headers.set(name, value);
            const path = (req.url || '/').split('?')[0];
            try {
                if (path === '/v1/payouts' && req.method === 'GET' && listOutage) {
                    res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'SYNTHETIC_READ_OUTAGE', message: 'Synthetic statement read unavailable. Retry loading.' } })); return;
                }
                const selectedStore = new URL(req.url || '/', 'http://owned.local').searchParams.get('store_id');
                if (path === '/v1/payouts' && req.method === 'GET' && selectedStore) forwardedSessions.set(selectedStore, new Headers(headers));
                const result = await gateway.request(req.url || '/', { method: req.method, headers, ...(body ? { body } : {}) });
                calls.push({ path, status: result.status, key: headers.get('X-Idempotency-Key'), ...(result.status >= 400 ? { errorCode: String(result.json?.error?.code || '') } : {}) });
                if (path === '/v1/2fa/totp/enroll' && result.status === 201) { factorId = String(result.json?.data.factor.id); secret = String(result.json?.data.secret); }
                if (path === '/v1/security/step-up/challenges' && result.status === 201) {
                    const claim = JSON.parse(body); challenges.push({ key: claim.idempotency_key, actor: owner, site: claim.store_id });
                    if (holdChallenge) { holdChallenge = false; challengeHeld = true; await new Promise<void>(resolve => { releaseChallenge = resolve; }); }
                }
                if (path === `/v1/payouts/${primary.id}/settle` && result.status === 200 && result.json?.data.status === 'processing' && loseReply) {
                    loseReply = false; res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'SYNTHETIC_COMMITTED_REPLY_LOSS', message: 'Synthetic committed reply lost. Retry the same request.' } })); return;
                }
                const recovery = [...recoveryCases.values()].find(item => path === `/v1/payouts/${item.id}/settle`);
                if (recovery?.loseReply && result.status === 200 && result.json?.data.status === 'processing') {
                    recovery.loseReply = false;
                    res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'SYNTHETIC_COMMITTED_REPLY_LOSS', message: 'Synthetic committed reply lost. Retry the same request.' } })); return;
                }
                res.writeHead(result.status, Object.fromEntries(result.headers.entries())); res.end(result.text);
            } catch (cause) {
                console.info('N7_BRIDGE_FAILURE ' + (cause instanceof Error ? cause.name : 'unknown'));
                res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'SYNTHETIC_BRIDGE_FAILURE' } }));
            }
        });
        await new Promise<void>(resolve => bridge!.listen(54772, '127.0.0.1', resolve));
        const api = 'http://127.0.0.1:54772/v1';
        const shared = { INTERNAL_API_SECRET: INTERNAL_SECRET, NEXT_PUBLIC_ACCOUNTS_URL: identityOrigin, NEXT_PUBLIC_ADMIN_URL: merchantOrigin };
        identity = startOwnedClientRuntime(owned, 'identity-next', { port: 54770, env: { ...shared, LETBUYY_API_URL: api, LETBUYY_IDENTITY_ISSUER: identityOrigin,
            LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({ ...await exportJWK(keys.privateKey), alg: 'ES256', kid: keys.kid }), ACCOUNTS_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID(), COOKIE_DOMAIN: '',
            NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
            LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', RESEND_API_KEY: '', LETBUYY_EMAIL_API_KEY: '' } });
        merchant = startOwnedClientRuntime(owned, 'merchant-next', { port: 54771, env: { ...shared, LETBUYY_API_BASE_URL: api } });
        for (const [name, app] of [['identity', identity], ['merchant', merchant]] as const) {
            app.stdout.on('data', data => writeFileSync(evidence + '/' + name + '.stdout.log', String(data), { flag: 'a' }));
            app.stderr.on('data', data => writeFileSync(evidence + '/' + name + '.stderr.log', String(data), { flag: 'a' }));
        }
        stage('owned_next_starting');
        await ready(identityOrigin + '/login', identity); await ready(merchantOrigin, merchant);
        browser = await chromium.launch({ headless: true }); context = await browser.newContext();
        const page = await context.newPage(); page.setDefaultTimeout(45000); page.setDefaultNavigationTimeout(90000);
        await signIn(page, identityOrigin, merchantOrigin, email, password); stage('normal_owner_password_login');
        await page.getByRole('button', { name: 'Toggle Money section', exact: true }).click();
        await page.getByRole('link', { name: 'Payouts', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Payouts', exact: true })).toBeVisible();
        await expect(page.getByText('Synthetic statement read unavailable. Retry loading.', { exact: true })).toBeVisible();
        const unavailableRead = await context.request.get(`${merchantOrigin}/api/stores/${site.subdomain}/payouts`);
        assert.equal(unavailableRead.status(), 503); assert.match(unavailableRead.headers()['cache-control'] || '', /private.*no-store/);
        listOutage = false;
        const [read] = await Promise.all([page.waitForResponse(r => r.url().includes(`/api/stores/${site.subdomain}/payouts`) && r.request().method() === 'GET'), page.getByRole('button', { name: 'Retry', exact: true }).click()]);
        assert.equal(read.status(), 200); assert.match(read.headers()['cache-control'] || '', /no-store/);
        await expect(page.getByText(primary.number, { exact: true })).toBeVisible();
        await expect(page.getByText(foreign.number, { exact: true })).toHaveCount(0);
        await expect(page.locator('[data-provider-mode="sandbox"]')).toHaveCount(2); stage('normal_statement_navigation_and_retry');
        const readback = await context.request.get(`${merchantOrigin}/api/stores/${site.subdomain}/payouts`);
        const rows = (await readback.json()).data.payouts as Array<{ id: string; status: string; site_id: string }>;
        assert.ok(rows.some(row => row.id === primary.id && row.status === 'pending' && row.site_id === site.siteId));
        assert.ok(forwardedSessions.has(site.siteId), 'normal Next list forwarded its verified session and selected site');
        const session = new Headers(forwardedSessions.get(site.siteId)); session.set('X-Store-ID', site.siteId);
        const direct = async (label: string, path: string, headers: Headers | Record<string, string>, body?: { idempotency_key: string }) => {
            const fresh = new Headers(headers), token = fresh.get('X-LetBuyy-Internal-Session-Token');
            if (token) {
                // Session transport JTIs are single use. Re-sign the actual normal
                // login token exactly as Next does, rather than replaying its headers.
                const plan = await createLetbuyyInternalSessionHeaders(token, INTERNAL_SECRET);
                assert.ok(plan.ok && plan.headers);
                for (const [name, value] of Object.entries(plan.headers)) fresh.set(name, value);
            }
            const reply = await gateway.request(path, { headers: fresh, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
            directChecks.push({ label, status: reply.status });
            return reply;
        };
        const detail = await direct('normal-session-detail', `/v1/payouts/${primary.id}`, session);
        assert.equal(detail.status, 200, detail.text); assert.equal(detail.json?.data.id, primary.id);
        const noSelection = new Headers(session); noSelection.delete('X-Store-ID');
        assert.equal((await direct('missing-store-hint', `/v1/payouts/${primary.id}`, noSelection)).status, 403);
        const foreignSelection = new Headers(session); foreignSelection.set('X-Store-ID', otherSite.siteId);
        assert.equal((await direct('foreign-store-hint', `/v1/payouts/${foreign.id}`, foreignSelection)).status, 403);
        assert.equal((await direct('foreign-statement-id', `/v1/payouts/${foreign.id}`, session)).status, 404);
        const signed = await signedIdentityHeaders(owner, email, site.siteId);
        assert.equal((await direct('signed-store-precedes-header', `/v1/payouts/${primary.id}`, { ...signed, 'X-Store-ID': otherSite.siteId })).status, 200);
        assert.equal((await direct('normal-session-settle-requires-proof', `/v1/payouts/${primary.id}/settle`, session, { idempotency_key: crypto.randomUUID() })).status, 428);
        assert.equal((await direct('foreign-store-settle', `/v1/payouts/${foreign.id}/settle`, foreignSelection, { idempotency_key: crypto.randomUUID() })).status, 403);
        assert.equal((await direct('foreign-statement-settle', `/v1/payouts/${foreign.id}/settle`, session, { idempotency_key: crypto.randomUUID() })).status, 404);
        assert.equal(transfers.length, 0); stage('direct_session_detail_and_selection_authority');
        await page.goto(`${merchantOrigin}/${site.subdomain}/settings/security`);
        await page.getByRole('button', { name: 'Set up authenticator app', exact: true }).click();
        await expect(page.getByLabel('Authenticator secret', { exact: true })).toBeVisible(); assert.ok(secret && factorId);
        const ownerFactor = factorId, ownerSecret = secret;
        await page.getByLabel('Confirm authenticator code', { exact: true }).fill(otp(ownerSecret));
        await page.getByRole('button', { name: 'Activate 2FA', exact: true }).click();
        await page.getByRole('button', { name: 'I saved my recovery codes', exact: true }).click();
        await expect(page.getByText('Authenticator app active', { exact: true })).toBeVisible();
        assert.equal(owned.psql(`SELECT status FROM merchant_2fa_factors WHERE id='${ownerFactor}';`), 'active');
        stage('normal_owner_mfa_enrollment');
        otherContext = await browser.newContext(); const otherPage = await otherContext.newPage();
        await signIn(otherPage, identityOrigin, merchantOrigin, otherEmail, password);
        const otherEndpoint = `${merchantOrigin}/api/stores/${otherSite.subdomain}/security`;
        const otherHeaders = { Origin: merchantOrigin, 'X-LetBuyy-Merchant-Context': other, 'X-Idempotency-Key': crypto.randomUUID() };
        const enrolled = await otherContext.request.post(otherEndpoint + '/two-factor/enroll', { headers: otherHeaders, data: {} }); assert.equal(enrolled.status(), 201);
        const otherFactor = (await enrolled.json()).data as { factor: { id: string }; secret: string };
        const activated = await otherContext.request.post(otherEndpoint + '/two-factor/verify', { headers: { ...otherHeaders, 'X-Idempotency-Key': crypto.randomUUID() }, data: { factor_id: otherFactor.factor.id, code: otp(otherFactor.secret) } }); assert.equal(activated.status(), 200);
        const otherList = await otherContext.request.get(`${merchantOrigin}/api/stores/${otherSite.subdomain}/payouts`); assert.equal(otherList.status(), 200);
        const otherSession = new Headers(forwardedSessions.get(otherSite.siteId)); otherSession.set('X-Store-ID', site.siteId);
        assert.equal((await direct('other-actor-selected-owner-site', `/v1/payouts/${primary.id}/settle`, otherSession, { idempotency_key: crypto.randomUUID() })).status, 403);
        const currentHeaders = { Origin: merchantOrigin, 'X-LetBuyy-Merchant-Context': owner, 'X-Idempotency-Key': crypto.randomUUID() };
        const wrongKey = crypto.randomUUID();
        const wrongFactor = await context.request.post(`${merchantOrigin}/api/stores/${site.subdomain}/security/step-up`, { headers: { ...currentHeaders, 'X-Idempotency-Key': wrongKey }, data: { action: 'payout.release', factor_id: otherFactor.factor.id, code: otp(otherFactor.secret), idempotency_key: wrongKey } });
        assert.equal(wrongFactor.status(), 428); assert.equal((await wrongFactor.json()).error.code, 'STEP_UP_FACTOR_REQUIRED');
        const wrongStore = await context.request.get(`${merchantOrigin}/api/stores/${otherSite.subdomain}/payouts`); assert.equal(wrongStore.status(), 404);
        assert.match(wrongStore.headers()['cache-control'] || '', /private.*no-store/);
        const staleActor = await context.request.post(`${merchantOrigin}/api/stores/${site.subdomain}/payouts/${pending.id}/settle`, { headers: { ...currentHeaders, 'X-LetBuyy-Merchant-Context': other }, data: { idempotency_key: currentHeaders['X-Idempotency-Key'] } }); assert.equal(staleActor.status(), 409);
        assert.equal(transfers.length, 0); stage('wrong_factor_store_and_actor_denials');
        await page.goto(`${merchantOrigin}/${site.subdomain}/dashboard`);
        await page.getByRole('button', { name: 'Toggle Money section', exact: true }).click();
        await page.getByRole('link', { name: 'Payouts', exact: true }).click();
        // The statement card is identified by its own exact statement number.
        const card = page.getByText(primary.number, { exact: true }).locator('..').locator('..');
        const dialog = page.getByRole('dialog', { name: 'Verify identity', exact: true });
        const release = async (label: string) => {
            await card.getByRole('button', { name: label, exact: true }).click();
            await dialog.getByLabel('Authenticator code', { exact: true }).fill(otp(ownerSecret));
            const [challenge, result] = await Promise.all([
                page.waitForResponse(r => r.url().endsWith('/security/step-up') && r.request().method() === 'POST'),
                page.waitForResponse(r => r.url().endsWith(`/payouts/${primary.id}/settle`) && r.request().method() === 'POST'),
                dialog.getByRole('button', { name: 'Release Payout', exact: true }).click(),
            ]);
            assert.equal(challenge.status(), 201);
            const request = result.request();
            assert.equal(request.headers()['x-letbuyy-merchant-context'], owner);
            assert.equal(request.headers()['x-idempotency-key'], request.postDataJSON().idempotency_key);
            assert.match(result.headers()['cache-control'] || '', /no-store/);
            return { challenge, result };
        };
        const unavailable = await release('Release'); assert.equal(unavailable.result.status(), 503, (await unavailable.result.text()).slice(0, 800));
        await expect(page.getByText('Release recorded', { exact: true })).toHaveCount(0);
        assert.equal(owned.psql(`SELECT status FROM payout_statements WHERE id='${primary.id}';`), 'pending'); assert.equal(transfers.length, 0);
        Object.assign(gateway.env, { RAZORPAY_ROUTE_PROVIDER_ENABLED: 'true' });
        const lost = await release('Release'); assert.equal(lost.result.status(), 503);
        assert.equal(owned.psql(`SELECT status FROM payout_statements WHERE id='${primary.id}';`), 'processing'); assert.equal(transfers.length, 1);
        await expect(page.getByText('Synthetic committed reply lost. Retry the same request.', { exact: true }).first()).toBeVisible();
        const processing = await release('Release'); assert.equal(processing.result.status(), 200);
        await expect(page.getByText('Release remains unconfirmed. Retry uses the same request.', { exact: true })).toBeVisible();
        await expect(card.getByRole('button', { name: 'Retry release', exact: true })).toBeVisible();
        await expect(page.getByText('Release recorded', { exact: true })).toHaveCount(0);
        const released = await release('Retry release'); assert.equal(released.result.status(), 200);
        await expect(page.getByText('The statement records this payout as released.', { exact: true })).toBeVisible();
        assert.equal((await released.result.json()).data.status, 'released');
        const commandKeys = [unavailable, lost, processing, released].map(item => item.result.request().headers()['x-idempotency-key']);
        assert.equal(new Set(commandKeys).size, 1); assert.equal(new Set(transfers.map(item => item.key)).size, 1); assert.equal(new Set(transfers.map(item => item.body)).size, 1);
        assert.equal(new Set(challenges.slice(-4).map(item => item.key)).size, 4, 'each dialog retry requires a fresh persisted challenge');
        assert.equal(owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}' AND source_type='payout' AND source_id='${primary.id}';`), '1');
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${owner}' AND action='merchant.payout_release.authorized';`), '1');
        assert.equal(owned.psql(`SELECT status FROM payout_statements WHERE id='${primary.id}';`), 'released');
        // A full normal page reload must read the committed statement, beyond a
        // successful command toast or in-memory optimistic presentation.
        await page.reload();
        await expect(card.getByLabel('Release recorded in the statement', { exact: true })).toBeVisible();
        await expect(card.getByRole('button', { name: 'Release', exact: true })).toHaveCount(0);
        await page.screenshot({ path: evidence + '/statement-release-recorded.png', fullPage: true }); stage('synthetic_transfer_lost_reply_retry_and_canonical_readback');
        const pendingCard = page.getByText(pending.number, { exact: true }).locator('..').locator('..');
        await pendingCard.getByRole('button', { name: 'Release', exact: true }).click();
        await dialog.getByLabel('Authenticator code', { exact: true }).fill(otp(ownerSecret));
        holdChallenge = true; await dialog.getByRole('button', { name: 'Release Payout', exact: true }).click();
        await expect.poll(() => challengeHeld, { timeout: 30000 }).toBe(true);
        // Retain the genuinely signed-in owner's current cookie in RAM for the
        // appended recovery cases. This is not a persistent-profile restart.
        const recoveryOwnerCookies = await context.cookies();
        await context.addCookies(await otherContext.cookies(merchantOrigin));
        const [staleMoney] = await Promise.all([
            page.waitForResponse(r => r.url().endsWith(`/payouts/${pending.id}/settle`) && r.request().method() === 'POST'),
            Promise.resolve().then(() => releaseChallenge!()),
        ]);
        assert.equal(staleMoney.status(), 409); assert.equal((await staleMoney.json()).error.code, 'SESSION_CONTEXT_CHANGED');
        assert.equal(owned.psql(`SELECT status FROM payout_statements WHERE id='${pending.id}';`), 'pending'); assert.equal(transfers.length, 3);
        await page.reload(); await expect(page.getByText(primary.number, { exact: true })).toHaveCount(0);
        stage('normal_session_switch_denies_late_money_command');
        // AFTER PREPARATION ONLY: the prior frozen BEFORE source actually
        // proved K2/409 in all four cases. These changed recovery expectations
        // require root source/diff/hash review before any actual AFTER run.
        const recoveryAfter: Array<Record<string, unknown>> = [];
        for (const initialOutcome of ['processing-response', 'committed-response-loss'] as const) {
            for (const lifecycle of ['page-reload', 'fresh-tab'] as const) {
                const statement = seededStatement(site, owner, `RECOVERY-${initialOutcome}-${lifecycle}`);
                const recovery = { ...statement, loseReply: initialOutcome === 'committed-response-loss', transfers: [] as Array<{ key: string; body: string }> };
                recoveryCases.set(statement.id, recovery);
                const recoveryContext: BrowserContext = await browser.newContext();
                try {
                    await recoveryContext.addCookies(recoveryOwnerCookies);
                    let recoveryPage: Page = await recoveryContext.newPage();
                    const open = async (): Promise<void> => {
                        recoveryPage.setDefaultTimeout(45000); recoveryPage.setDefaultNavigationTimeout(90000);
                        await recoveryPage.goto(`${merchantOrigin}/${site.subdomain}/payouts`);
                        await expect(recoveryPage.getByText(statement.number, { exact: true })).toBeVisible();
                    };
                    await open();
                    const submit = async (): Promise<PlaywrightResponse> => {
                        const recoveryCard = recoveryPage.getByText(statement.number, { exact: true }).locator('..').locator('..');
                        const button = recoveryCard.getByRole('button', { name: /^(Release|Retry release)$/ });
                        await button.click();
                        const verification = recoveryPage.getByRole('dialog', { name: 'Verify identity', exact: true });
                        await verification.getByLabel('Authenticator code', { exact: true }).fill(otp(ownerSecret));
                        const [challenge, result] = await Promise.all([
                            recoveryPage.waitForResponse(r => r.url().endsWith('/security/step-up') && r.request().method() === 'POST'),
                            recoveryPage.waitForResponse(r => r.url().endsWith(`/payouts/${statement.id}/settle`) && r.request().method() === 'POST'),
                            verification.getByRole('button', { name: 'Release Payout', exact: true }).click(),
                        ]);
                        assert.equal(challenge.status(), 201, 'real fresh current-owner MFA is required each time');
                        assert.equal(result.request().headers()['x-letbuyy-merchant-context'], owner);
                        assert.equal(result.request().headers()['x-idempotency-key'], result.request().postDataJSON().idempotency_key);
                        assert.match(result.headers()['cache-control'] || '', /no-store/);
                        return result;
                    };
                    const first = await submit();
                    assert.equal(first.status(), initialOutcome === 'committed-response-loss' ? 503 : 200);
                    const firstKey = first.request().postDataJSON().idempotency_key as string;
                    assert.ok(firstKey); assert.equal(recovery.transfers.length, 1);
                    // The existing adapter hashes the tenant/statement/command
                    // tuple to the provider's 36-character key limit.
                    const transferMaterial = `letbuyy:razorpay-route:direct-transfer:${site.siteId}:${statement.id}:${firstKey}`;
                    const expectedTransferKey = 'lb_' + Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(transferMaterial))).toString('hex').slice(0, 32);
                    assert.equal(recovery.transfers[0].key, expectedTransferKey);
                    assert.equal(owned.psql(`SELECT status||':'||release_idempotency_key||':'||release_claimed_by FROM payout_statements WHERE id='${statement.id}';`), `processing:${firstKey}:${owner}`);
                    await expect(recoveryPage.getByText('Release recorded', { exact: true })).toHaveCount(0);
                    if (lifecycle === 'page-reload') await recoveryPage.reload();
                    else { await recoveryPage.close(); recoveryPage = await recoveryContext.newPage(); await open(); }
                    const recoveryCard = recoveryPage.getByText(statement.number, { exact: true }).locator('..').locator('..');
                    await expect(recoveryCard.getByLabel('Release remains unconfirmed', { exact: true })).toBeVisible();
                    const retry = await submit();
                    const retryKey = retry.request().postDataJSON().idempotency_key as string;
                    assert.equal(retryKey, firstKey, 'recovery must use the current owned original processing claim');
                    assert.equal(retry.status(), 200);
                    assert.equal((await retry.json()).data.status, 'released');
                    assert.equal(new Set(challenges.slice(-2).map(item => item.key)).size, 2);
                    assert.equal(recovery.transfers.length, 2, 'the synthetic provider advances one original transfer on its same immutable request');
                    assert.equal(new Set(recovery.transfers.map(item => item.key)).size, 1);
                    assert.equal(new Set(recovery.transfers.map(item => item.body)).size, 1);
                    assert.equal(recovery.transfers[1].key, expectedTransferKey);
                    assert.equal(owned.psql(`SELECT status||':'||release_idempotency_key||':'||release_claimed_by FROM payout_statements WHERE id='${statement.id}';`), `released:${firstKey}:${owner}`);
                    assert.equal(owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}' AND source_type='payout' AND source_id='${statement.id}';`), '1');
                    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${owner}' AND resource_id='${statement.id}' AND action='merchant.payout_release.authorized';`), '1');
                    await expect(recoveryCard.getByLabel('Release recorded in the statement', { exact: true })).toBeVisible();
                    // Preserve the existing released-state replay behavior with
                    // the genuine current session and the same completed body.
                    // The normal UI obtains fresh real MFA for the processing
                    // retry above; no synthetic approval substitutes for it.
                    const replay = await recoveryContext.request.post(`${merchantOrigin}/api/stores/${site.subdomain}/payouts/${statement.id}/settle`, {
                        headers: { Origin: merchantOrigin, 'Content-Type': 'application/json', 'X-LetBuyy-Merchant-Context': owner, 'X-Idempotency-Key': firstKey },
                        data: retry.request().postDataJSON(),
                    });
                    assert.equal(replay.status(), 200); assert.equal((await replay.json()).data.status, 'released');
                    assert.equal(recovery.transfers.length, 2, 'released replay must not issue another provider request');
                    await recoveryPage.reload();
                    await expect(recoveryCard.getByLabel('Release recorded in the statement', { exact: true })).toBeVisible();
                    await expect(recoveryCard.getByRole('button', { name: /^(Release|Retry release)$/ })).toHaveCount(0);
                    assert.equal(owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}' AND source_type='payout' AND source_id='${statement.id}';`), '1');
                    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${owner}' AND resource_id='${statement.id}' AND action='merchant.payout_release.authorized';`), '1');
                    recoveryAfter.push({ initialOutcome, lifecycle, sameCommandKey: true, retryStatus: retry.status(), freshRealChallenges: 2, syntheticTransferResponses: 2, providerLogicalKeys: 1, canonicalPayoutJournals: 1, authorizationAudits: 1, releasedReplayStatus: replay.status(), matchingTerminalReadback: true, providerSandboxVerified: false, externalTransferRequests: 0 });
                    writeFileSync(evidence + '/command-recovery-after.json', JSON.stringify({ runId: owned.runId, verdict: 'original processing command recovered; synthetic transfer only', cases: recoveryAfter }, null, 2) + '\n');
                } finally { await recoveryContext.close(); }
            }
        }
        assert.equal(recoveryAfter.length, 4); stage('processing_command_recovered_across_page_lifetime');
        const result = { runId: owned.runId, normalSignIns: 2, realMfaEnrollment: true, readFailureRetry: true,
            wrongFactorDenied: true, wrongStoreDenied: true, staleActorDenied: true, lateSessionSwitchDenied: true,
            sameMoneyKey: true, freshChallengePerRetry: true, syntheticTransferResponses: transfers.length,
            externalTransferRequests: 0, providerSandboxVerified: false, bankVerified: false,
            canonicalPayoutJournals: 1, directChecks, calls, stages, recoveryAfter };
        writeFileSync(evidence + '/result.json', JSON.stringify(result, null, 2) + '\n');
        console.info('OWNED_N7_BROWSER ' + JSON.stringify({ runId: owned.runId, evidence, providerSandboxVerified: false }));
    } catch (cause) {
        writeFileSync(evidence + '/failure.json', JSON.stringify({ runId: owned.runId, stages, calls, directChecks,
            error: cause instanceof Error ? { name: cause.name, message: cause.message.slice(0, 2400) } : { name: 'unknown' } }, null, 2) + '\n');
        // Omit failure screenshots: any auth stage may contain credentials.
        // Keep structured diagnostics and the explicit safe success capture.
        throw cause;
    } finally {
        releaseChallenge?.(); globalThis.fetch = originalFetch;
        await otherContext?.close(); await context?.close(); await browser?.close();
        await stopOwnedClientRuntime(merchant); await stopOwnedClientRuntime(identity);
        await gateway.settle(); await proxy.stop();
        if (bridge) { bridge.closeAllConnections(); await new Promise<void>(resolve => bridge!.close(() => resolve())); }
    }
});
