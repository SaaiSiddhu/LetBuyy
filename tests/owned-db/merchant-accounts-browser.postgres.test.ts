// Real Accounts production artifact -> mounted Gateway -> disposable Postgres.
// Synthetic email provider acceptance is intercepted; this is NOT inbox/device proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, type Server } from 'node:http';
import { createHmac } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, type Page } from '@playwright/test';
import { exportJWK } from 'jose';
import { merchantNativeChallenge, merchantNativeHash, parseMerchantNativeCallback } from '@letbuyy/auth-core';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import mobileBff from '../../services/mobile-bff/src/index';
import { Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase, startOwnedClientRuntime, stopOwnedClientRuntime, startOwnedPooledSqlProxy, type OwnedClientProcess } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { hashMerchantPassword } from '../../services/api-gateway/src/lib/merchant-password';
import { encryptTextAesGcm } from '../../services/api-gateway/src/lib/crypto';

const owned = requireOwnedDatabase();
const PASSWORD = 'Synthetic-Accounts-Password-42!'; // Local synthetic example fixture; no real credential.
const TOTP_KEY = 'synthetic-accounts-totp-encryption-at-least-32-bytes';
const TOTP_SEED = 'JBSWY3DPEHPK3PXP';
const secret = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
async function freePort() { const server = createServer(); await new Promise<void>(done => server.listen(0, '127.0.0.1', done)); const port = (server.address() as { port: number }).port; await new Promise<void>(done => server.close(() => done())); return port; }
async function ready(origin: string, child: OwnedClientProcess) {
    const deadline = Date.now() + 360000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) throw new Error('Owned Accounts artifact stopped before readiness');
        try { if ((await fetch(origin + '/login', { signal: AbortSignal.timeout(2000) })).status < 500) return; } catch { /* bounded startup */ }
        await new Promise(done => setTimeout(done, 250));
    }
    throw new Error('Owned Accounts artifact did not become ready');
}
function otp(seed = TOTP_SEED) {
    let bits = ''; for (const character of seed) bits += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(character).toString(2).padStart(5, '0');
    const bytes: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
    const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
    const digest = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
    return String((digest.readUInt32BE(digest[digest.length - 1] & 15) & 0x7fffffff) % 1000000).padStart(6, '0');
}

test('shared Accounts login/signup, MFA, SSO consent, outage retry and draft creation finish the native handoff', { timeout: 900000 }, async () => {
    const actor = crypto.randomUUID(), email = `syn-accounts-${actor}@example.invalid`, plainActor = crypto.randomUUID(), plainEmail = `syn-accounts-${plainActor}@example.invalid`;
    const factor = crypto.randomUUID(), hash = await hashMerchantPassword(PASSWORD), encrypted = await encryptTextAesGcm(TOTP_KEY, TOTP_SEED);
    const recovery = 'SYNTHETIC-RECOVERY-42', recoveryHash = await merchantNativeHash(`${factor}:${recovery}`);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,password_hash) VALUES('${actor}','${email}',true,'${hash}'),('${plainActor}','${plainEmail}',true,'${hash}');
      INSERT INTO merchant_2fa_factors(id,custom_user_id,status,secret_ciphertext,enrolled_at,recovery_code_hashes) VALUES('${factor}','${actor}','active','${encrypted}',now()-interval '1 day',ARRAY['${recoveryHash}']);`);
    const port = await freePort(), origin = `http://localhost:${port}`, keys = await newIdentityKeys(), proxy = await startOwnedPooledSqlProxy(owned);
    const gateway = new Gateway(gatewayEnv(owned, keys, { ...proxy.env(), ENVIRONMENT: 'local', APP_ENV: 'development', LETBUYY_IDENTITY_ISSUER: origin, TOTP_ENCRYPTION_KEY: TOTP_KEY, RESEND_API_KEY: 'synthetic-accounts-mail-provider-key' }));
    let bridge: Server | undefined, runtime: OwnedClientProcess | undefined, browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    let lookupUnavailable = false, storesUnavailable = false, loseCreate = false;
    const mail: { to: string; subject: string; text: string }[] = [], paths: string[] = [];
    const completions = new WeakMap<Page, { status: number; callback?: string }[]>();
    const approvals = new WeakMap<Page, { status: number; redirectTo?: string }[]>();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.origin === 'https://api.resend.com' && url.pathname === '/emails') {
            const data = JSON.parse(String(init?.body || (input instanceof Request ? await input.clone().text() : '{}'))) as { to: string | string[]; subject: string; text: string };
            const recipients = Array.isArray(data.to) ? data.to : [data.to];
            assert.ok(recipients.every(recipient => recipient.endsWith('@example.invalid')), 'fixture refuses real recipients');
            recipients.forEach(to => mail.push({ to, subject: data.subject, text: data.text }));
            return new Response(JSON.stringify({ id: 'synthetic-accepted-' + crypto.randomUUID() }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return originalFetch(input, init);
    }) as typeof fetch;
    try {
        bridge = createServer(async (request, response) => {
            const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
            const body = Buffer.concat(chunks).toString(), headers = new Headers();
            for (const [name, value] of Object.entries(request.headers)) if (typeof value === 'string' && !['host','connection','content-length','transfer-encoding','accept-encoding'].includes(name)) headers.set(name, value);
            const path = (request.url || '/').split('?')[0]; paths.push(path);
            try {
                if ((lookupUnavailable && path === '/v1/auth/custom/users/by-email') || (storesUnavailable && path === '/v1/stores' && request.method === 'GET')) {
                    response.writeHead(503, { 'Content-Type': 'application/json' }); response.end('{"error":{"code":"SYNTHETIC_UNAVAILABLE","message":"Retry loading your account"}}'); return;
                }
                const result = await gateway.request(request.url || '/', { method: request.method, headers, ...(body ? { body } : {}) });
                if (loseCreate && path === '/v1/stores' && request.method === 'POST' && result.status === 201) {
                    loseCreate = false; response.writeHead(503, { 'Content-Type': 'application/json' }); response.end('{"error":{"code":"SYNTHETIC_RESPONSE_LOST","message":"The result is unknown. Retry your saved setup."}}'); return;
                }
                response.writeHead(result.status, Object.fromEntries(result.headers.entries())); response.end(result.text);
            } catch { response.writeHead(500); response.end('{}'); }
        });
        await new Promise<void>(done => bridge!.listen(0, '127.0.0.1', done));
        const api = `http://127.0.0.1:${(bridge.address() as { port: number }).port}/v1`;
        runtime = startOwnedClientRuntime(owned, 'identity-next-production', { port, env: {
            APP_ENV: 'development', NEXT_PUBLIC_ENV: 'development', INTERNAL_API_SECRET: INTERNAL_SECRET, LETBUYY_API_URL: api,
            NEXT_PUBLIC_API_URL: api, NEXT_PUBLIC_ACCOUNTS_URL: origin, NEXT_PUBLIC_ADMIN_URL: origin, LETBUYY_IDENTITY_ISSUER: origin,
            LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({ ...await exportJWK(keys.privateKey), alg: 'ES256', kid: keys.kid }),
            ACCOUNTS_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID(), COOKIE_DOMAIN: '', LETBUYY_MERCHANT_MOBILE_AUTH_ENABLED: 'true',
            NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA', // Local synthetic example fixture; no real credential.
            LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false',
        } });
        await ready(origin, runtime);
        browser = await chromium.launch({ headless: true });
        async function contextPage() {
            const context = await browser!.newContext({ viewport: { width: 390, height: 844 } });
            const page = await context.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
            completions.set(page, []);
            approvals.set(page, []);
            await page.route('**/api/auth/mobile/approve', async route => {
                const response = await route.fetch();
                const payload = await response.json();
                approvals.get(page)!.push({ status: response.status(), redirectTo: payload.redirectTo });
                await route.fulfill({ response });
            });
            await page.route('**/api/auth/mobile/complete', async route => {
                const response = await route.fetch();
                const payload = await response.json();
                completions.get(page)!.push({ status: response.status(), callback: payload.callback });
                await route.fulfill({ response });
            });
            // The OS callback target is observed without contacting any developer's local app.
            await page.route('http://localhost:54351/merchant/auth/callback**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Synthetic OS callback captured.</p>' }));
            return { context, page };
        }
        async function begin(purpose = 'login', token?: string) {
            const state = secret(), verifier = secret();
            const response = await fetch(origin + '/api/auth/mobile/requests', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ clientId: 'merchant_android', callbackId: 'android_https', environment: 'development', purpose, state, challenge: await merchantNativeChallenge(verifier) }) });
            assert.equal(response.status, 201, 'Accounts must register a valid first-party request');
            const data = await response.json() as { requestId: string; authorizationUrl: string };
            return { ...data, state, verifier };
        }
        async function completed(page: Page, action: () => Promise<unknown>) {
            completions.set(page, []);
            const [response] = await Promise.all([
                page.waitForResponse(reply => reply.url().endsWith('/api/auth/mobile/complete') && reply.request().method() === 'POST'),
                action(),
            ]);
            assert.equal(response.status(), 200, 'terminal Accounts journey must invoke automatic native completion');
            const captured = completions.get(page)!.at(-1);
            assert.equal(captured?.status, 200); assert.equal(typeof captured?.callback, 'string');
            //The API response precedes the browser's automatic OS navigation.
            //Observe that completed navigation before starting another flow on
            //the same page, so a previous return cannot preempt the next bind.
            try { await page.waitForURL(url => url.href === captured!.callback, { timeout: 60000 }); }
            catch { throw new Error('The successful native completion did not reach its registered synthetic OS callback.'); }
            return captured!.callback!;
        }
        async function confirmAccount(page: Page, expectedRedirect: '/mobile/return' | '/onboarding') {
            approvals.set(page, []);
            const button = page.getByRole('button', { name: 'Continue with this account', exact: true });
            await expect(button).toBeEnabled();
            const [response] = await Promise.all([
                page.waitForResponse(reply => reply.url().endsWith('/api/auth/mobile/approve') && reply.request().method() === 'POST', { timeout: 15000 }),
                button.click(),
            ]);
            assert.equal(response.status(), 200, 'explicit account confirmation must approve the current bound flow');
            const captured = approvals.get(page)!.at(-1);
            assert.equal(captured?.status, 200);
            assert.equal(captured?.redirectTo, expectedRedirect, 'approval must retain the original native purpose');
        }
        async function redeem(flow: Awaited<ReturnType<typeof begin>>, callback: string) {
            const parsed = parseMerchantNativeCallback(callback, { redirectUri: 'http://localhost:54351/merchant/auth/callback', requestId: flow.requestId, state: flow.state });
            assert.ok(parsed, 'exact native callback and state must validate');
            const body = { requestId: flow.requestId, clientId: 'merchant_android', callbackId: 'android_https', environment: 'development', state: flow.state, verifier: flow.verifier, code: parsed.code };
            const response = await fetch(origin + '/api/auth/mobile/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            assert.equal(response.status, 200, 'one-use code must produce an independently registered native session');
            assert.match(response.headers.get('Cache-Control') || '', /no-store/);
            const result = await response.json() as { token: string; userId: string; siteId?: string };
            const inspect = await fetch(origin + '/api/auth/session', { headers: { Authorization: 'Bearer ' + result.token } });
            assert.equal(inspect.status, 200); assert.equal((await inspect.json() as { user: { id: string } }).user.id, result.userId);
            const replay = await fetch(origin + '/api/auth/mobile/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            assert.equal(replay.status, 400, 'a used code cannot create another session');
            return result;
        }
        async function emailStep(page: Page, value: string) {
            await page.getByLabel('Email', { exact: true }).fill(value);
            await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
        }
        async function humanReady(page: Page) { await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 45000 }); }
        async function nativeStores(token: string) {
            const response = await mobileBff.fetch(new Request('https://bff.example.invalid/v1/stores?limit=50', { headers: { Authorization: 'Bearer ' + token } }), {
                INTERNAL_API_SECRET: INTERNAL_SECRET, API_GATEWAY_SERVICE: { fetch: async (request: Request) => {
                    assert.equal(request.headers.get('Authorization'), null); assert.equal(request.headers.get('Cookie'), null);
                    const url = new URL(request.url), result = await gateway.request(url.pathname + url.search, { method: request.method, headers: request.headers });
                    return new Response(result.text, { status: result.status, headers: result.headers });
                } },
            } as never);
            assert.equal(response.status, 200); return (await response.json() as { data: { id: string }[] }).data;
        }

        // Existing account, lookup outage, wrong password, enrolled MFA, automatic return.
        const first = await contextPage(), login = await begin();
        await first.page.goto(login.authorizationUrl); await first.page.waitForURL(url => url.pathname === '/login');
        await first.page.screenshot({ path: join(tmpdir(), 'letbuyy-accounts-login-review.png'), fullPage: true });
        lookupUnavailable = true; await emailStep(first.page, email); await expect(first.page.getByRole('alert').filter({ hasText: /\S/ })).toBeVisible();
        assert.equal(new URL(first.page.url()).pathname, '/login');
        lookupUnavailable = false; await emailStep(first.page, email); await first.page.getByLabel('Password', { exact: true }).fill('Incorrect-Synthetic-42!'); await humanReady(first.page);
        await first.page.getByRole('button', { name: 'Log in', exact: true }).click(); await expect(first.page.getByRole('alert').filter({ hasText: /\S/ })).toBeVisible();
        assert.equal(new URL(first.page.url()).pathname, '/login');
        await first.page.getByLabel('Password', { exact: true }).fill(PASSWORD); await humanReady(first.page);
        await first.page.getByRole('button', { name: 'Log in', exact: true }).click(); await expect(first.page.getByLabel('Authenticator code', { exact: true })).toBeVisible();
        assert.equal(owned.psql(`SELECT count(*) FROM sessions WHERE user_id='${actor}';`), '0', 'no Merchant session before MFA proof');
        await first.page.getByLabel('Authenticator code', { exact: true }).fill(otp()); await humanReady(first.page);
        const nativeCallback = await completed(first.page, () => first.page.getByRole('button', { name: 'Log in', exact: true }).click());
        const native = await redeem(login, nativeCallback); assert.equal(native.userId, actor); assert.deepEqual(await nativeStores(native.token), []);
        const sourceCookie = (await first.context.cookies(origin)).find(cookie => cookie.name === 'lb_session');
        assert.ok(sourceCookie && sourceCookie.value !== native.token, 'browser session stays in its cookie; native receives its own session');

        // Native signup: email proof -> canonical password -> automatic return, no implicit site.
        const second = await contextPage(), signup = await begin('signup'), signupEmail = `syn-signup-${crypto.randomUUID()}@example.invalid`;
        await second.page.goto(signup.authorizationUrl); await second.page.waitForURL(url => url.pathname === '/signup');
        await expect(second.page.locator('input[type=password]')).toHaveCount(0);
        await second.page.getByLabel('Email', { exact: true }).fill(signupEmail); await humanReady(second.page);
        await second.page.getByRole('button', { name: 'Continue', exact: true }).click();
        await expect(second.page.getByLabel('Email verification code')).toBeVisible();
        const signupOtp = owned.psql(`SELECT token FROM verification_tokens WHERE email='${signupEmail}' AND type='email_verify' AND used=false ORDER BY created_at DESC LIMIT 1;`);
        assert.match(signupOtp, /^\d{6}$/); assert.ok(mail.some(item => item.to === signupEmail && item.text.includes(signupOtp) && !item.subject.includes(signupOtp)));
        await second.page.getByLabel('Email verification code').fill(signupOtp); await second.page.getByRole('button', { name: 'Verify', exact: true }).click();
        await second.page.getByLabel('Password', { exact: true }).fill(PASSWORD); await second.page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
        const signupCallback = await completed(second.page, () => second.page.getByRole('button', { name: 'Create account', exact: true }).click());
        const registered = await redeem(signup, signupCallback); assert.deepEqual(await nativeStores(registered.token), []);

        // Shared browser SSO cannot authorize a new native device merely by visiting GET.
        const sso = await begin(); await second.page.goto(sso.authorizationUrl);
        await expect(second.page.getByRole('button', { name: 'Continue with this account', exact: true })).toBeVisible();
        assert.equal(owned.psql(`SELECT approved_at IS NULL FROM merchant_mobile_requests WHERE id='${sso.requestId}';`), 't');
        const denial = second.page.waitForResponse(response => response.url().endsWith('/api/auth/mobile/complete'));
        await second.page.goto(origin + '/mobile/return'); assert.equal((await denial).status(), 400);
        assert.equal(owned.psql(`SELECT code_hash IS NULL FROM merchant_mobile_requests WHERE id='${sso.requestId}';`), 't');
        await second.page.goto(origin + '/mobile');
        await redeem(sso, await completed(second.page, () => confirmAccount(second.page, '/mobile/return')));

        // Web sign-in keeps a verified identity when discovery fails; zero stores is a distinct result.
        const web = await contextPage(); storesUnavailable = true;
        await web.page.goto(origin + '/login'); await emailStep(web.page, plainEmail); await web.page.getByLabel('Password', { exact: true }).fill(PASSWORD); await humanReady(web.page);
        await web.page.getByRole('button', { name: 'Log in', exact: true }).click(); await web.page.waitForURL(url => url.pathname === '/select');
        await expect(web.page.getByRole('heading', { name: 'Unable to load your stores' })).toBeVisible();
        assert.equal(owned.psql(`SELECT count(*) FROM sites WHERE custom_user_id='${plainActor}';`), '0');
        storesUnavailable = false; await web.page.getByRole('button', { name: 'Retry', exact: true }).click(); await web.page.waitForURL(url => url.pathname === '/onboarding');
        await web.page.goto(origin + '/security'); await expect(web.page.getByText('Authenticator app not configured', { exact: true })).toBeVisible();

        // Hosted native creation uses the SAME web draft. A lost commit reply recovers one draft site.
        const normal = await begin(); await web.page.goto(normal.authorizationUrl);
        const plainNative = await redeem(normal, await completed(web.page, () => confirmAccount(web.page, '/mobile/return')));
        const creation = await begin('create_store', plainNative.token); await web.page.goto(creation.authorizationUrl);
        await confirmAccount(web.page, '/onboarding');
        await web.page.waitForURL(url => url.pathname === '/onboarding');
        await web.page.getByRole('button', { name: /Online Store/ }).click();
        const slug = 'syn-accounts-' + crypto.randomUUID().slice(0, 8);
        await web.page.getByLabel('Display Name', { exact: true }).fill('Synthetic Accounts Store');
        await web.page.getByLabel('Subdomain', { exact: true }).fill(slug);
        await expect(web.page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
        await web.page.getByRole('button', { name: 'Next', exact: true }).click(); loseCreate = true;
        await web.page.getByRole('button', { name: 'Create My Site', exact: true }).click(); await expect(web.page.getByRole('alert').filter({ hasText: /\S/ })).toBeVisible();
        assert.equal(owned.psql(`SELECT count(*) FROM sites WHERE custom_user_id='${plainActor}';`), '1');
        assert.equal(owned.psql(`SELECT s.store_creation_idempotency_key='accounts-store:'||a.user_id||':'||a.id FROM sites s JOIN onboarding_attempts a ON a.user_id=s.custom_user_id AND a.requested_subdomain=s.subdomain WHERE s.custom_user_id='${plainActor}' AND a.status='in_progress';`), 't', 'lost-response recovery must bind the site to the original saved attempt');
        const creationCallback = await completed(web.page, () => web.page.reload());
        const created = await redeem(creation, creationCallback); assert.ok(created.siteId);
        assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${created.siteId}';`), 'draft');
        assert.equal(owned.psql(`SELECT count(*) FROM sites WHERE custom_user_id='${plainActor}';`), '1');
        assert.ok((await nativeStores(created.token)).some(site => site.id === created.siteId));
        assert.equal(paths.some(path => /\/stores\/[^/]+\/publish/.test(path)), false, 'account/store completion must not publish');

        // Recovery in the original authorization browser retains the native continuation,
        // revokes the old sessions and still requires the enrolled second factor.
        const reset = await contextPage(), resetFlow = await begin();
        await reset.page.goto(resetFlow.authorizationUrl); await reset.page.waitForURL(url => url.pathname === '/login');
        await reset.page.goto(origin + '/forgot-password'); await reset.page.getByLabel('Email', { exact: true }).fill(email); await humanReady(reset.page);
        await reset.page.getByRole('button', { name: 'Send reset link', exact: true }).click(); await reset.page.waitForURL(url => url.pathname === '/check-email');
        const resetToken = owned.psql(`SELECT token FROM verification_tokens WHERE email='${email}' AND type='password_reset' AND used=false ORDER BY created_at DESC LIMIT 1;`);
        assert.ok(resetToken && mail.some(item => item.to === email && item.text.includes(resetToken)));
        const changedPassword = PASSWORD + '-changed';
        await reset.page.goto(origin + '/reset-password?token=' + encodeURIComponent(resetToken));
        await reset.page.getByLabel('New password', { exact: true }).fill(changedPassword); await reset.page.getByLabel('Confirm password', { exact: true }).fill(changedPassword);
        await reset.page.getByRole('button', { name: 'Reset password', exact: true }).click(); await reset.page.waitForURL(url => url.pathname === '/login');
        assert.equal(owned.psql(`SELECT count(*) FROM sessions WHERE user_id='${actor}' AND revoked_at IS NULL;`), '0');
        await emailStep(reset.page, email); await reset.page.getByLabel('Password', { exact: true }).fill(changedPassword); await humanReady(reset.page);
        await reset.page.getByRole('button', { name: 'Log in', exact: true }).click(); await expect(reset.page.getByLabel('Authenticator code', { exact: true })).toBeVisible();
        await reset.page.getByRole('button', { name: 'Use a recovery code', exact: true }).click(); await reset.page.getByLabel('Recovery code', { exact: true }).fill(recovery); await humanReady(reset.page);
        const recovered = await redeem(resetFlow, await completed(reset.page, () => reset.page.getByRole('button', { name: 'Log in', exact: true }).click()));
        assert.equal(recovered.userId, actor); assert.equal(owned.psql(`SELECT cardinality(recovery_code_hashes) FROM merchant_2fa_factors WHERE id='${factor}';`), '0');

        // Account-owned MFA management and global logout also work without a site.
        await second.page.goto(origin + '/security'); await second.page.getByRole('button', { name: 'Set up authenticator app', exact: true }).click();
        const enrolledSecret = await second.page.getByLabel('Authenticator secret').innerText();
        await second.page.getByLabel('Authenticator code', { exact: true }).fill(otp(enrolledSecret));
        await second.page.getByRole('button', { name: 'Activate authenticator', exact: true }).click();
        await expect(second.page.getByText('Authenticator app active', { exact: true })).toBeVisible();
        const backup = (await second.page.getByLabel('Recovery codes').locator('p').allTextContents())[0]; assert.ok(backup);
        await second.page.getByRole('button', { name: 'I saved my recovery codes', exact: true }).click();
        await second.page.getByLabel('Recovery code (if your authenticator is unavailable)', { exact: true }).fill(backup);
        await second.page.getByRole('button', { name: 'Disable authenticator', exact: true }).click(); await expect(second.page.getByText('Authenticator app not configured', { exact: true })).toBeVisible();
        await second.page.getByLabel('Current password', { exact: true }).fill(PASSWORD); await second.page.getByRole('button', { name: 'Sign out all sessions', exact: true }).click();
        await expect(second.page.getByRole('status')).toContainText('All account sessions were signed out');
        assert.equal(owned.psql(`SELECT count(*) FROM sessions WHERE user_id='${registered.userId}' AND revoked_at IS NULL;`), '0');
        await first.context.close(); await second.context.close(); await web.context.close(); await reset.context.close();
    } finally {
        globalThis.fetch = originalFetch;
        await browser?.close(); await stopOwnedClientRuntime(runtime);
        await new Promise<void>(done => { if (bridge) bridge.close(() => done()); else done(); });
        await gateway.settle(); await closePooledSqlClients(); await proxy.stop();
    }
});
