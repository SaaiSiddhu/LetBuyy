import assert from 'node:assert/strict';
import test from 'node:test';
import { expect } from '@playwright/test';
import { withConsoleBrowser } from './console-browser-fixture';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
test('two normal local operator sign-ins request, independently approve, execute and safely retry merchant suspension', { timeout: 300_000 }, async () => {
    const tenant = newSyntheticTenant('browser-consent'); seedSyntheticTenant(owned.psql, tenant);
    await withConsoleBrowser(owned, async ({ origin, actors: [maker, checker], login, calls, loseNextApprovalReply }) => {
        const a = await login(maker), b = await login(checker);
        // The unauthenticated proxy deliberately redirects before compiling
        // protected pages. Warm them using the real cookie just acquired by
        // normal login, then let Next dev's observed HMR reload finish before
        // either operator begins a protected action. This performs no mutation.
        for (const path of ['/approvals', '/approvals/' + crypto.randomUUID()]) {
            await a.context.request.get(origin + path, { maxRedirects: 0 });
        }
        await Promise.all([a.page.waitForLoadState('networkidle'), b.page.waitForLoadState('networkidle')]);
        for (const headers of [{}, { origin: 'https://evil-store.letbuyy.com' }] as Record<string, string>[]) {
            const mutations = () => calls.filter(call => /\/approvals(?:\/|$)|\/moderation$/.test(call.path)).length;
            const before = mutations();
            const denied = await a.context.request.post(origin + '/api/approvals/request', { headers, form: { action: 'suspend', merchant_id: tenant.siteId }, maxRedirects: 0 });
            assert.equal(denied.status(), 403, 'native approval handler rejects missing and sibling Origin');
            assert.equal(mutations(), before, 'origin denial makes no protected approval or moderation call');
        }
        await a.page.goto(origin + '/merchants/' + tenant.siteId);
        const form = a.page.locator('form').filter({ has: a.page.getByRole('button', { name: 'Request independent approval', exact: true }) });
        await expect(form).toHaveAttribute('data-enhanced', 'true');
        await form.locator('select[name="action"]').selectOption('suspend');
        await form.locator('textarea[name="reason"]').fill('Synthetic independently reviewed merchant suspension');
        const requestKey = await form.locator('input[name="request_key"]').inputValue();
        loseNextApprovalReply();
        await form.getByRole('button', { name: 'Request independent approval', exact: true }).click();
        await expect(form.getByRole('alert')).toContainText('Retry the same form');
        await expect(form.locator('input[name="request_key"]')).toHaveValue(requestKey);
        await expect(form.locator('textarea[name="reason"]')).toHaveValue('Synthetic independently reviewed merchant suspension');
        assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE request_key='${requestKey}';`), '1', 'lost reply occurs after the actual request committed');
        await form.getByRole('button', { name: 'Request independent approval', exact: true }).click();
        await a.page.waitForURL(url => /^\/approvals\/[0-9a-f-]{36}$/.test(url.pathname));
        const id = new URL(a.page.url()).pathname.split('/').at(-1)!;
        await expect(a.page.getByRole('button', { name: 'Approve this request', exact: true })).toHaveCount(0);
        await expect(a.page.getByText('A different active platform super admin must decide this request.', { exact: true })).toBeVisible();
        assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${tenant.siteId}';`), 'published');
        await b.page.goto(origin + '/approvals/' + id);
        await expect(b.page.locator('form').filter({ has: b.page.getByRole('button', { name: 'Approve this request', exact: true }) })).toHaveAttribute('data-enhanced', 'true');
        await b.page.getByLabel('I reviewed this merchant, action and reason.', { exact: true }).check();
        await b.page.getByRole('button', { name: 'Approve this request', exact: true }).click();
        await expect(b.page.getByRole('button', { name: 'Approve this request', exact: true })).toHaveCount(0);
        assert.equal(owned.psql(`SELECT checker_actor_id FROM sensitive_action_approvals WHERE id='${id}';`), checker.id);
        assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${tenant.siteId}';`), 'published', 'normal checker consent alone does not execute');
        await a.page.reload();
        await expect(a.page.locator('form').filter({ has: a.page.getByRole('button', { name: 'Execute approved action', exact: true }) })).toHaveAttribute('data-enhanced', 'true');
        const execute = a.page.locator('form').filter({ has: a.page.getByRole('button', { name: 'Execute approved action', exact: true }) });
        // Retry the actual observed form packet with this browser's
        // current cookie, not an invented action token or alternative API.
        const [submitted] = await Promise.all([
            a.page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === '/api/approvals/execute'),
            execute.getByRole('button', { name: 'Execute approved action', exact: true }).click(),
        ]);
        await expect(a.page.getByText(/Executed at /)).toBeVisible();
        assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${tenant.siteId}';`), 'suspended');
        const retryHeaders = await submitted.allHeaders();
        for (const name of ['cookie', 'host', 'connection', 'content-length', 'accept-encoding', 'transfer-encoding']) delete retryHeaders[name];
        const retryBody = submitted.postDataBuffer(); assert.ok(retryBody);
        const retry = await a.context.request.post(submitted.url(), { headers: retryHeaders, data: retryBody, maxRedirects: 0 });
        assert.equal(retry.status(), 200, 'retry uses the same observed form request and current real browser cookie');
        assert.equal((await retry.json()).redirect_to, '/approvals/' + id);
        delete retryHeaders.accept;
        const nativeRetry = await a.context.request.post(submitted.url(), { headers: retryHeaders, data: retryBody, maxRedirects: 0 });
        assert.equal(nativeRetry.status(), 303, 'ordinary native form fallback also safely retries the same packet');
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${tenant.siteId}' AND action='merchant.suspend';`), '1');
        assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals a JOIN sessions_v2 s ON s.id=a.approver_session_id
            JOIN principals p ON p.id=s.principal_id WHERE a.id='${id}' AND a.maker_actor_id='${maker.id}' AND a.checker_actor_id='${checker.id}'
            AND p.legacy_user_id='${checker.id}' AND a.consumed_at IS NOT NULL;`), '1');
        assert.ok(calls.some(call => call.path.endsWith('/approvals/' + id + '/decision') && call.status === 200));
        console.info('OWNED_CONSOLE_CONSENT_BROWSER ' + JSON.stringify({ localDevelopmentOnly: true, independentlyAuthenticatedActors: 2,
            actualDistinctTotpFactors: true, gatewayCalls: calls.length, effectAudits: 1, sameFormRetry: true, lostPostCommitReplyRecovered: true, nativeFallbackRetry: true,
            injectedPositiveCredentials: false, emailDelivery: 'pending' }));
        await a.context.close(); await b.context.close();
    });
});
