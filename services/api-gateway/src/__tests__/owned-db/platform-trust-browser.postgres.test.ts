// Normal maintained Console -> durable MFA session -> real worker/RPC/owned DB.
// Local sign-in links prove no provider email delivery; no positive cookie injection.
import assert from 'node:assert/strict';
import test from 'node:test';
import { expect } from '@playwright/test';
import { withConsoleBrowser } from './console-browser-fixture';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
test('a normal lead enforces a site case, obtains independent super-admin consent and retries exact reinstatement safely', { timeout: 300_000 }, async () => {
    const tenant = newSyntheticTenant('trust-browser'); seedSyntheticTenant(owned.psql, tenant);
    const caseId = crypto.randomUUID(), title = 'Synthetic browser site safety case';
    owned.psql(`UPDATE sites SET published=true WHERE id='${tenant.siteId}';
        INSERT INTO ts_cases(id,site_id,subject_type,subject_id,category,severity,status,title)
        VALUES('${caseId}','${tenant.siteId}','site','${tenant.siteId}','fraud','high','open','${title}');`);
    await withConsoleBrowser(owned, async ({ origin, actors: [maker, checker], login, calls, loseNextApprovalReply }) => {
        const a = await login(maker), b = await login(checker);
        for (const path of ['/approvals', '/approvals/' + crypto.randomUUID(), '/trust-safety', '/trust-safety/' + caseId]) {
            await a.context.request.get(origin + path, { maxRedirects: 0 });
        }
        await Promise.all([a.page.waitForLoadState('networkidle'), b.page.waitForLoadState('networkidle')]);
        for (const operation of ['request-trust', 'enforce-trust']) {
            const before = calls.length;
            const denied = await a.context.request.post(origin + '/api/approvals/' + operation, {
                headers: { Origin: 'https://hostile-store.letbuyy.com' }, form: { case_id: caseId }, maxRedirects: 0 });
            assert.equal(denied.status(), 403); assert.equal(calls.length, before);
        }
        await a.page.goto(origin + '/trust-safety');
        await a.page.getByRole('link', { name: title, exact: true }).click();
        await expect(a.page.locator('form').filter({ has: a.page.getByRole('button', { name: 'Suspend site for this case', exact: true }) })).toHaveAttribute('data-enhanced', 'true');
        await a.page.getByLabel('Suspension reason', { exact: true }).fill('Synthetic visible evidence requires suspension');
        await a.page.getByRole('button', { name: 'Suspend site for this case', exact: true }).click();
        await expect(a.page.getByRole('heading', { name: 'Request reinstatement', exact: true })).toBeVisible();
        assert.equal(owned.psql(`SELECT status||':'||published FROM sites WHERE id='${tenant.siteId}';`), 'suspended:false');
        const form = a.page.locator('form').filter({ has: a.page.getByRole('button', { name: 'Request independent reinstatement', exact: true }) });
        // Native forms remain usable before hydration. This named fault proves
        // the enhanced form's in-place retry, so wait for that actual handler.
        await expect(form).toHaveAttribute('data-enhanced', 'true');
        await form.getByLabel('Reinstatement reason', { exact: true }).fill('Synthetic independent review permits reinstatement');
        await form.getByLabel('Additional reinstatement notes', { exact: true }).fill('Synthetic reviewed case notes');
        const key = await form.locator('input[name="request_key"]').inputValue();
        loseNextApprovalReply();
        await form.getByRole('button', { name: 'Request independent reinstatement', exact: true }).click();
        await expect(form.getByRole('alert')).toContainText('Retry the same form');
        await expect(form.locator('input[name="request_key"]')).toHaveValue(key);
        await expect(form.getByLabel('Additional reinstatement notes', { exact: true })).toHaveValue('Synthetic reviewed case notes');
        assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE request_key='${key}';`), '1');
        await form.getByRole('button', { name: 'Request independent reinstatement', exact: true }).click();
        await a.page.waitForURL(url => /^\/approvals\/[0-9a-f-]{36}$/.test(url.pathname));
        const id = new URL(a.page.url()).pathname.split('/').at(-1)!;
        await expect(a.page.getByRole('button', { name: 'Approve this request', exact: true })).toHaveCount(0);
        await b.page.goto(origin + '/approvals/' + id);
        await expect(b.page.locator('form').filter({ has: b.page.getByRole('button', { name: 'Approve this request', exact: true }) })).toHaveAttribute('data-enhanced', 'true');
        await expect(b.page.getByText(title, { exact: false })).toBeVisible();
        await expect(b.page.getByText('Synthetic reviewed case notes', { exact: false })).toBeVisible();
        await b.page.getByLabel('I reviewed this case, evidence, restrictions, reason and notes.', { exact: true }).check();
        await b.page.getByRole('button', { name: 'Approve this request', exact: true }).click();
        await expect(b.page.getByRole('button', { name: 'Approve this request', exact: true })).toHaveCount(0);
        assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${tenant.siteId}';`), 'suspended', 'consent alone cannot reinstate');
        await a.page.reload();
        await expect(a.page.locator('form').filter({ has: a.page.getByRole('button', { name: 'Execute approved action', exact: true }) })).toHaveAttribute('data-enhanced', 'true');
        const [submitted] = await Promise.all([
            a.page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === '/api/approvals/execute'),
            a.page.getByRole('button', { name: 'Execute approved action', exact: true }).click(),
        ]);
        await expect(a.page.getByText(/Executed at /)).toBeVisible();
        await expect(a.page.getByText(/Site restoration outcome: owned_site_status_restored/)).toBeVisible();
        assert.equal(owned.psql(`SELECT status||':'||published FROM sites WHERE id='${tenant.siteId}';`), 'published:true');
        const headers = await submitted.allHeaders(), body = submitted.postDataBuffer(); assert.ok(body);
        for (const name of ['cookie', 'host', 'connection', 'content-length', 'accept-encoding', 'transfer-encoding']) delete headers[name];
        const retry = await a.context.request.post(submitted.url(), { headers, data: body, maxRedirects: 0 });
        assert.equal(retry.status(), 200);
        delete headers.accept;
        assert.equal((await a.context.request.post(submitted.url(), { headers, data: body, maxRedirects: 0 })).status(), 303);
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${caseId}' AND action='trust_safety.case.reinstate';`), '1');
        assert.equal(owned.psql(`SELECT count(*) FROM ts_case_events WHERE case_id='${caseId}' AND event_type='reinstated';`), '1');
        assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE id='${id}' AND maker_actor_id='${maker.id}' AND checker_actor_id='${checker.id}' AND consumed_at IS NOT NULL;`), '1');
        console.info('OWNED_CONSOLE_TRUST_BROWSER ' + JSON.stringify({ gatewayCalls: calls.length, independentNormalActors: 2,
            distinctTotpFactors: true, lostCommittedRequestRecovered: true, jsonAndNativeRetry: true,
            sitePublicationRestored: true, effectAudits: 1, injectedPositiveCredentials: false, providerDelivery: 'pending' }));
        await a.context.close(); await b.context.close();
    });
});
