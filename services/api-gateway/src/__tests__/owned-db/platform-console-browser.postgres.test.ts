// Actual Identity/Console forms, TOTP, durable sessions and PostgreSQL.
import { tmpdir as ownedTmpDir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { expect } from '@playwright/test';
import { LETBUYY_PLATFORM_SESSION_COOKIE } from '@letbuyy/auth-core';
import { requireOwnedDatabase } from './owned-db-support';
import { withConsoleBrowser, consoleBrowserTotp } from './console-browser-fixture';
const owned = requireOwnedDatabase();
test('normal local Console magic-link/TOTP forms bind a durable session, survive restart and deny logout replay', { timeout: 300_000 }, async () => {
    await withConsoleBrowser(owned, async ({origin, browser, actors, login, calls}) => {
        const actor=actors[0];
        let {context,page}=await login(actor,{stopAtMfa:true});
        const pageErrors:string[]=[];
        page.on('pageerror',error=>pageErrors.push(error.message));
        const code = consoleBrowserTotp(actor.factor);
        await page.getByLabel('Authenticator code', { exact: true }).fill(code === '000000' ? '111111' : '000000');
        await page.getByRole('button', { name: 'Verify', exact: true }).click();
        await expect(page.getByText('Enter a valid authenticator code.', { exact: true })).toBeVisible();
        const acceptedCode=consoleBrowserTotp(actor.factor);
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
        await page.screenshot({path:`${ownedTmpDir()}/letbuyy-console-overview-${owned.runId}.png`,fullPage:true});
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
        const state = await context.storageState(); await page.goto('about:blank'); await context.close();
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
        await page.goto('about:blank'); await context.close();
        const replay = await browser.newContext({ storageState: state });
        assert.equal((await replay.request.get(origin + '/api/founding/export')).status(), 401, 'a real formerly valid cookie is denied after logout');
        const replayPage = await replay.newPage(); await replayPage.goto(origin + '/dashboard');
        assert.equal(new URL(replayPage.url()).pathname, '/login');
        await replayPage.goto('about:blank'); await replay.close();
        assert.equal(owned.psql(`SELECT count(*) FROM sessions_v2 s JOIN principals p ON p.id=s.principal_id
            WHERE p.realm='admin' AND p.legacy_user_id='${actor.id}' AND s.status='active';`), '0');
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${actor.id}' AND action='platform_console_session.registered';`), '2');
        assert.ok(calls.some(call => call.path === '/v1/internal/console/sessions/revoke' && call.status === 200));
        assert.deepEqual(pageErrors, []);
        console.info('OWNED_CONSOLE_BROWSER ' + JSON.stringify({ localDevelopmentOnly: true, actualTotp: true,
            gatewayCalls: calls.length, durableSessions: 2, activeAfterLogout: 0, logoutOutageAndRecovery: true, aggregateReadsAndOutageRecovery:true,durableMfaReplayDenied:true,
            providerDelivery: 'pending', injectedPositiveCredentials: false }));
    }, {makerRole:'super'});
});
