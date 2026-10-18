// Normal local Console forms/TOTP -> real Gateway/PostgREST/PostgreSQL. The
// named transport fault happens only after the actual atomic money effect.
// No provider message, positive cookie injection or synthetic success response.
import assert from 'node:assert/strict';
import test from 'node:test';
import { expect } from '@playwright/test';
import { tapRest } from './gateway-harness';
import { withConsoleBrowser } from './console-browser-fixture';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned=requireOwnedDatabase();
test('normal finance admin and independent super admin review the exact money break and safely recover a lost committed execution reply', { timeout:300_000 },async()=>{
    const tenant=newSyntheticTenant('money-browser'); seedSyntheticTenant(owned.psql,tenant);
    owned.psql(`INSERT INTO money_ledger_site_reconciliations(site_id,status,wallet_available_minor,ledger_merchant_payable_minor,variance_minor)
        VALUES('${tenant.siteId}','mismatch',500,0,-500);`);
    await withConsoleBrowser(owned,async({origin,actors:[maker,checker],login,calls,loseNextMoneyExecutionReply})=>{
        const a=await login(maker), b=await login(checker);
        for(const path of ['/approvals','/approvals/' + crypto.randomUUID(),'/money-reconciliation?site_id='+tenant.siteId]) {
            await a.context.request.get(origin+path,{maxRedirects:0});
        }
        await Promise.all([a.page.waitForLoadState('networkidle'),b.page.waitForLoadState('networkidle')]);
        for(const operation of ['request-money','decision','execute']) {
            const denied=await a.context.request.post(origin+'/api/approvals/'+operation,{headers:{Origin:'https://hostile-store.letbuyy.com'},form:{site_id:tenant.siteId},maxRedirects:0});
            assert.equal(denied.status(),403);
        }
        const outage=tapRest(owned.restUrl,async(call,forward)=>call.resource==='money_ledger_site_reconciliations'&&call.method==='GET'
            ?new Response(JSON.stringify({code:'42P01',message:'Synthetic private financial storage failure'}),{status:500,headers:{'content-type':'application/json'}}):forward());
        try {
            await a.page.goto(origin+'/money-reconciliation?site_id='+tenant.siteId);
            await expect(a.page.getByText('Unavailable',{exact:true})).toHaveCount(3);
            await expect(a.page.getByText('The break queue is unavailable. Retry this review.',{exact:true})).toBeVisible();
            await expect(a.page.getByText('Synthetic private financial storage failure',{exact:true})).toHaveCount(0);
        } finally {outage.restore();}
        await a.page.goto(origin+'/money-reconciliation?site_id='+tenant.siteId);
        await expect(a.page.getByRole('heading',{name:'Ledger Reconciliation',exact:true})).toBeVisible();
        const form=a.page.locator('form').filter({has:a.page.locator(`input[name="site_id"][value="${tenant.siteId}"]`)});
        await expect(form).toHaveAttribute('data-enhanced', 'true');
        await form.locator('select[name="resolution"]').selectOption('provider_explained');
        await form.getByLabel('Provider reference (optional)',{exact:true}).fill('synthetic-provider-review-evidence');
        await form.getByLabel('Review reason',{exact:true}).fill('Synthetic independently reviewed provider explanation');
        await form.getByRole('button',{name:'Request resolution approval',exact:true}).click();
        await a.page.waitForURL(url=>/^\/approvals\/[0-9a-f-]{36}$/.test(url.pathname));
        const id=new URL(a.page.url()).pathname.split('/').at(-1)!;
        await expect(a.page.getByText('provider_explained',{exact:true})).toBeVisible();
        await expect(a.page.getByText('synthetic-provider-review-evidence',{exact:true})).toBeVisible();
        assert.equal(owned.psql(`SELECT count(*) FROM money_ledger_site_reconciliations WHERE site_id='${tenant.siteId}' AND metadata ? 'operator_resolution';`),'0');
        await b.page.goto(origin+'/approvals/'+id);
        await expect(b.page.locator('form').filter({ has: b.page.getByRole('button', { name: 'Approve this request', exact: true }) })).toHaveAttribute('data-enhanced', 'true');
        await expect(b.page.getByText('provider_explained',{exact:true})).toBeVisible();
        await b.page.getByLabel('I reviewed this money break, resolution and reason.',{exact:true}).check();
        await b.page.getByRole('button',{name:'Approve this request',exact:true}).click();
        await expect(b.page.getByRole('button',{name:'Approve this request',exact:true})).toHaveCount(0);
        assert.equal(owned.psql(`SELECT checker_actor_id FROM sensitive_action_approvals WHERE id='${id}';`),checker.id);
        assert.equal(owned.psql(`SELECT count(*) FROM money_ledger_site_reconciliations WHERE site_id='${tenant.siteId}' AND metadata ? 'operator_resolution';`),'0');
        await a.page.reload();
        await expect(a.page.locator('form').filter({ has: a.page.getByRole('button', { name: 'Execute approved action', exact: true }) })).toHaveAttribute('data-enhanced', 'true');
        const execute=a.page.locator('form').filter({has:a.page.getByRole('button',{name:'Execute approved action',exact:true})});
        loseNextMoneyExecutionReply();
        await execute.getByRole('button',{name:'Execute approved action',exact:true}).click();
        await expect(execute.getByRole('alert')).toContainText('Retry the same form');
        assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE id='${id}' AND consumed_at IS NOT NULL;`),'1');
        const [submitted]=await Promise.all([
            a.page.waitForRequest(request=>request.method()==='POST'&&new URL(request.url()).pathname==='/api/approvals/execute'),
            execute.getByRole('button',{name:'Execute approved action',exact:true}).click(),
        ]);
        await expect(a.page.getByText(/Executed at /)).toBeVisible();
        const headers=await submitted.allHeaders();
        for(const key of ['cookie','host','connection','content-length','accept-encoding','transfer-encoding'])delete headers[key];
        const body=submitted.postDataBuffer(); assert.ok(body);
        const retry=await a.context.request.post(submitted.url(),{headers,data:body,maxRedirects:0});
        assert.equal(retry.status(),200); assert.equal((await retry.json()).redirect_to,'/approvals/'+id);
        assert.equal(owned.psql(`SELECT status FROM money_ledger_site_reconciliations WHERE site_id='${tenant.siteId}';`),'mismatch','review does not falsely clear a money break');
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${tenant.siteId}' AND action='money_ledger.breaks.resolve';`),'1');
        assert.equal(owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${tenant.siteId}';`),'0','manual review never invents money');
        assert.ok(calls.some(c=>c.path.endsWith('/money/reconciliation/'+tenant.siteId+'/resolve')&&c.status===200));
        console.info('OWNED_MONEY_CONSENT_BROWSER '+JSON.stringify({localDevelopmentOnly:true,normalDistinctTotpSignIns:2,
            financeAdmin:maker.kind,independentActiveSuperAdmin:true,postCommitExecutionReplyRecovered:true,oneEffectAudit:true,
            zeroLedgerMutations:true,wrongOriginDenied:true,projectionOutageVisibleAndRecovered:true,gatewayCalls:calls.length,emailDelivery:'pending'}));
        await a.context.close(); await b.context.close();
    },{makerRole:'admin'});
});
