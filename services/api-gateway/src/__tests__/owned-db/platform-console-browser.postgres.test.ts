// Local development journey only. The app visibly labels its local magic link
// "No email was sent"; this is not provider delivery or production-login proof.
// Chromium uses normal forms and actual TOTP, with no cookie/token/API injection
// for the positive journey. Restart/replay uses only that journey's real state.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import test from 'node:test';
import { chromium, expect, type Page } from '@playwright/test';
import { LETBUYY_PLATFORM_SESSION_COOKIE } from '@letbuyy/auth-core';
import { Gateway, gatewayEnv, newIdentityKeys } from './gateway-harness';
import { requireOwnedDatabase, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from './owned-db-support';

const owned = requireOwnedDatabase();
const secret = 'synthetic-owned-console-browser-session-secret';
const bridge = 'synthetic-owned-console-browser-bridge';
const factor = 'JBSWY3DPEHPK3PXP'; // Public synthetic test factor, never a real operator secret.
function totp() {
    const bits = [...factor].map(letter => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(letter).toString(2).padStart(5, '0')).join('');
    const key = Buffer.from(bits.match(/.{8}/g)!.map(byte => parseInt(byte, 2)));
    const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
    const hash = createHmac('sha1', key).update(counter).digest();
    return ((hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}
async function availablePort() {
    const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const value = (server.address() as { port: number }).port;
    await new Promise<void>(resolve => server.close(() => resolve())); return value;
}

test('normal local Console magic-link/TOTP forms bind a durable session, survive restart and deny logout replay', { timeout: 300_000 }, async () => {
    const actor = { id: crypto.randomUUID(), email: `syn-browser-console-${crypto.randomUUID()}@example.invalid` };
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor.id}','${actor.email}',true);
        INSERT INTO super_admin_allowlist(user_id,email,full_name,is_active)
        VALUES('${actor.id}','${actor.email}','Synthetic Console browser operator',true);`);
    const gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), {
        PLATFORM_CONSOLE_API_TOKEN: bridge, PLATFORM_CONSOLE_SESSION_SECRET: secret,
    }));
    const calls: { path: string; status: number }[] = [], diagnostics: string[] = [], pageErrors: string[] = [];
    let adapter: Server | undefined, app: OwnedClientProcess | undefined, page: Page | undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
        adapter = createServer(async (request, response) => {
            const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
            const body = Buffer.concat(chunks).toString(), headers = new Headers();
            for (const [name, value] of Object.entries(request.headers)) if (typeof value === 'string'
                && !['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding'].includes(name)) headers.set(name, value);
            try {
                const result = await gateway.request(request.url ?? '/', { method: request.method, headers, ...(body ? { body } : {}) });
                calls.push({ path: (request.url ?? '/').split('?')[0], status: result.status });
                response.writeHead(result.status, Object.fromEntries(result.headers.entries())); response.end(result.text);
            } catch { response.writeHead(500); response.end('{}'); }
        });
        await new Promise<void>(resolve => adapter!.listen(0, '127.0.0.1', resolve));
        const api = `http://127.0.0.1:${(adapter.address() as { port: number }).port}/v1`;
        const port = await availablePort(), origin = `http://localhost:${port}`;
        app = startOwnedClientRuntime(owned, 'console-next', { port, env: {
            PLATFORM_CONSOLE_API_BASE_URL: api, PLATFORM_CONSOLE_API_TOKEN: bridge, PLATFORM_CONSOLE_SESSION_SECRET: secret,
            PLATFORM_CONSOLE_ALLOWED_EMAILS: actor.email, PLATFORM_CONSOLE_TOTP_SECRETS: JSON.stringify({ [actor.email]: factor }),
            LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false',
        } });
        // Drain and retain only sanitized diagnostics; callback URLs carry credentials.
        for (const stream of [app.stdout, app.stderr]) stream.on('data', data => {
            diagnostics.push(data.toString().replace(/\?[^\s]+/g, '?redacted').slice(0, 800));
        });
        const deadline = Date.now() + 120_000;
        let ready = false;
        while (Date.now() < deadline) {
            if (app.exitCode !== null || app.signalCode !== null) throw new Error('owned Console stopped before readiness');
            try { if ((await fetch(origin + '/login', { signal: AbortSignal.timeout(2500) })).status === 200) { ready = true; break; } } catch { /* first compilation */ }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.ok(ready, 'owned Console must become ready');
        browser = await chromium.launch({ headless: true });
        let context = await browser.newContext(); page = await context.newPage(); page.setDefaultTimeout(30_000);
        page.on('pageerror', error => pageErrors.push(error.message));
        await page.goto(origin + '/login');
        await page.getByLabel('Email', { exact: true }).fill(actor.email);
        await page.getByRole('button', { name: 'Send magic link', exact: true }).click();
        await expect(page.getByText('Local development magic link generated. No email was sent.', { exact: true })).toBeVisible();
        await page.getByRole('link', { name: 'Open local development magic link', exact: true }).click();
        await page.waitForURL(url => url.pathname === '/mfa');
        const code = totp();
        await page.getByLabel('Authenticator code', { exact: true }).fill(code === '000000' ? '111111' : '000000');
        await page.getByRole('button', { name: 'Verify', exact: true }).click();
        await expect(page.getByText('Enter a valid authenticator code.', { exact: true })).toBeVisible();
        const acceptedCode=totp();
        await page.getByLabel('Authenticator code', { exact: true }).fill(acceptedCode);
        await page.getByRole('button', { name: 'Verify', exact: true }).click();
        await page.waitForURL(url => url.pathname === '/dashboard');
        await expect(page.getByText(actor.email, { exact: true })).toBeVisible();
        for(const path of ['/v1/internal/console/summary','/v1/internal/console/analytics'])
            assert.ok(calls.some(call=>call.path===path&&call.status===200),'normal authenticated dashboard reads '+path);
        await expect(page.getByText('Summary API unavailable', {exact:true})).toHaveCount(0);
        await expect(page.getByText('Launch counter API unavailable', {exact:true})).toHaveCount(0);
        await expect(page.getByRole('article').filter({has:page.getByText('New signups',{exact:true})}).getByText(owned.psql("SELECT count(*) FROM users_custom WHERE created_at>=now()-interval '30 days';"),{exact:true})).toBeVisible();
        await expect(page.getByRole('article').filter({has:page.getByText('MRR',{exact:true})}).getByText('Unavailable',{exact:true})).toBeVisible();
        await page.screenshot({path:`/private/tmp/letbuyy-console-overview-${owned.runId}.png`,fullPage:true});
        const overviewSignature='public.read_console_overview_v1(uuid,text,text,text)';
        const overviewAcl=()=>owned.psql(`SELECT proacl::text FROM pg_proc WHERE oid='${overviewSignature}'::regprocedure;`);
        const overviewPermissions=overviewAcl();owned.psql(`REVOKE EXECUTE ON FUNCTION ${overviewSignature} FROM service_role;`);
        try {
            await page.reload();await expect(page.getByText('Summary API unavailable',{exact:true})).toBeVisible();
            await expect(page.getByText('Launch counter API unavailable',{exact:true})).toBeVisible();
        } finally {owned.psql(`GRANT EXECUTE ON FUNCTION ${overviewSignature} TO service_role;`);}
        assert.equal(overviewAcl(),overviewPermissions);await page.reload();
        await expect(page.getByText('Summary API unavailable',{exact:true})).toHaveCount(0);
        await expect(page.getByText('Launch counter API unavailable',{exact:true})).toHaveCount(0);
        assert.ok(Number(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action IN('console.summary.read','console.analytics.read');`))>=4);
        // Same real code through the normal step-up form must not mint another
        // elevated session, even though factor matching itself is now stateless.
        const beforeReplay=(await context.cookies(origin)).find(cookie=>cookie.name===LETBUYY_PLATFORM_SESSION_COOKIE)?.value;
        await page.goto(origin+'/mfa?step_up=1&return_to=%2Fdashboard');
        await page.getByLabel('Authenticator code',{exact:true}).fill(acceptedCode);
        await page.getByRole('button',{name:'Verify',exact:true}).click();
        await expect(page.getByText('Enter a valid authenticator code.',{exact:true})).toBeVisible();
        assert.equal((await context.cookies(origin)).find(cookie=>cookie.name===LETBUYY_PLATFORM_SESSION_COOKIE)?.value,beforeReplay);
        await page.goto(origin+'/dashboard');
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action='platform_console_mfa.verified';`),'1');
        const cookies = await context.cookies(origin);
        const session = cookies.find(cookie => cookie.name === LETBUYY_PLATFORM_SESSION_COOKIE);
        assert.ok(session?.httpOnly); assert.equal(session.sameSite, 'Strict');
        const state = await context.storageState(); await context.close();
        context = await browser.newContext({ storageState: state }); page = await context.newPage(); page.setDefaultTimeout(30_000);
        page.on('pageerror', error => pageErrors.push(error.message));
        await page.goto(origin + '/dashboard'); await expect(page.getByText(actor.email, { exact: true })).toBeVisible();
        const signature = 'public.transition_console_session_v1(text,uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text)';
        const acl = () => owned.psql(`SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)
            ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable) FROM pg_proc p CROSS JOIN LATERAL
            aclexplode(p.proacl) a WHERE p.oid='${signature}'::regprocedure;`);
        const permissions = acl();
        owned.psql(`REVOKE EXECUTE ON FUNCTION ${signature} FROM service_role;`);
        try {
            await page.getByRole('button', { name: 'Logout', exact: true }).click();
            await page.waitForURL(url => url.pathname === '/login' && url.searchParams.get('error') === 'logout_unavailable');
            await expect(page.getByText('Sign-out could not be saved. Retry sign-out when service is restored.', { exact: true })).toBeVisible();
            assert.ok((await context.cookies(origin)).some(cookie => cookie.name === LETBUYY_PLATFORM_SESSION_COOKIE),
                'an unavailable durable logout cannot silently discard the credential and report success');
            assert.equal(owned.psql(`SELECT count(*) FROM sessions_v2 s JOIN principals p ON p.id=s.principal_id
                WHERE p.realm='admin' AND p.legacy_user_id='${actor.id}' AND s.status='active';`), '1');
        } finally { owned.psql(`GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`); }
        assert.equal(acl(), permissions, 'restore the exact RPC privilege profile');
        await page.goto(origin + '/dashboard'); await expect(page.getByText(actor.email, { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Logout', exact: true }).click();
        await page.waitForURL(url => url.pathname === '/login' && url.searchParams.get('loggedOut') === '1');
        await expect(page.getByText('Signed out.', { exact: true })).toBeVisible();
        assert.equal((await context.cookies(origin)).some(cookie => cookie.name === LETBUYY_PLATFORM_SESSION_COOKIE), false);
        await context.close();
        const replay = await browser.newContext({ storageState: state });
        assert.equal((await replay.request.get(origin + '/api/founding/export')).status(), 401, 'a real formerly valid cookie is denied after logout');
        const replayPage = await replay.newPage(); await replayPage.goto(origin + '/dashboard');
        assert.equal(new URL(replayPage.url()).pathname, '/login');
        await replay.close();
        assert.equal(owned.psql(`SELECT count(*) FROM sessions_v2 s JOIN principals p ON p.id=s.principal_id
            WHERE p.realm='admin' AND p.legacy_user_id='${actor.id}' AND s.status='active';`), '0');
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action='platform_console_session.registered';`), '2');
        assert.ok(calls.some(call => call.path === '/v1/internal/console/sessions/revoke' && call.status === 200));
        assert.deepEqual(pageErrors, []);
        console.info('OWNED_CONSOLE_BROWSER ' + JSON.stringify({ localDevelopmentOnly: true, actualTotp: true,
            gatewayCalls: calls.length, durableSessions: 2, activeAfterLogout: 0, logoutOutageAndRecovery: true, aggregateReadsAndOutageRecovery:true,durableMfaReplayDenied:true,
            providerDelivery: 'pending', injectedPositiveCredentials: false }));
    } catch (error) {
        console.info('OWNED_CONSOLE_BROWSER_FAILURE ' + JSON.stringify({ path: page ? new URL(page.url()).pathname : null,
            text: await page?.locator('body').innerText().catch(() => ''), calls: calls.slice(-12), diagnostics: diagnostics.slice(-10), pageErrors }));
        await page?.screenshot({ path: `/private/tmp/letbuyy-console-browser-${owned.runId}.png` }).catch(() => undefined);
        throw error;
    } finally {
        await browser?.close(); await stopOwnedClientRuntime(app); await gateway.settle();
        if (adapter) { adapter.closeAllConnections(); await new Promise<void>(resolve => adapter!.close(() => resolve())); }
    }
});
