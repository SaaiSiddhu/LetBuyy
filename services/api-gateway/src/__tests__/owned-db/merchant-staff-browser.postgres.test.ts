// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Normal browser password sign-in through Identity, Merchant BFF and real Gateway/ownedDB.
// Existing verified synthetic accounts are fixture inputs, not proof of email/inbox delivery.
// Official Turnstile test keys exercise the widget/Siteverify transport, not production anti-bot.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, type Server } from 'node:http';
import { exportJWK } from 'jose';
import { chromium, expect, type Page } from '@playwright/test';
import { hashMerchantPassword } from '../../lib/merchant-password';
import { Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET, tapRest } from './gateway-harness';
import { requireOwnedDatabase, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
const owned = requireOwnedDatabase();
async function freePort() {
    const s = createServer(); await new Promise<void>(r => s.listen(0,'127.0.0.1',r));
    const p = (s.address() as {port:number}).port; await new Promise<void>(r=>s.close(()=>r())); return p;
}
async function ready(origin:string, child:OwnedClientProcess) {
    const deadline = Date.now()+300_000;
    while(Date.now()<deadline) {
        if(child.exitCode!==null || child.signalCode!==null) throw new Error('Owned app stopped before readiness');
        try { if((await fetch(origin,{signal:AbortSignal.timeout(2000)})).status<500)return; } catch { /* owned build/start */ }
        await new Promise(r=>setTimeout(r,200));
    }
    throw new Error('Owned app did not become ready');
}
async function signIn(page:Page, origin:string, email:string, password:string, merchantOrigin:string) {
    await page.goto(origin+'/login');
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:30_000});
    await page.getByLabel('Email',{exact:true}).fill(email);
    await page.getByRole('button',{name:'Continue with email',exact:true}).click();
    await page.getByLabel('Password',{exact:true}).fill(password);
    const [login] = await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST'),
        page.getByRole('button',{name:'Log in',exact:true}).click()]);
    assert.equal(login.status(),200,'Normal password sign-in must succeed before navigating to Merchant');
    await page.waitForURL(url=>url.origin===merchantOrigin,{timeout:60_000});
}

test('normal owner and staff sign in; ambiguous creation retries once, live downgrade/removal revoke access, origin denials write nothing',
 {timeout:780_000},async()=>{
    const tenant = newSyntheticTenant('staff-browser'); seedSyntheticTenant(owned.psql,tenant);
    const ownerId=crypto.randomUUID(),staffId=crypto.randomUUID(),password='Synthetic-staff-browser-pass-42';
    const ownerEmail=`syn-browser-owner-${ownerId}@example.invalid`,staffEmail=`syn-browser-staff-${staffId}@example.invalid`;
    const passwordHash=await hashMerchantPassword(password);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES
      ('${ownerId}','${ownerEmail}',true,'Synthetic Owner','${passwordHash}'),('${staffId}','${staffEmail}',true,'Synthetic Staff','${passwordHash}');
      UPDATE sites SET custom_user_id='${ownerId}' WHERE id='${tenant.siteId}';`);
    const identityPort=await freePort(),merchantPort=await freePort();
    const identityOrigin=`http://localhost:${identityPort}`,merchantOrigin=`http://localhost:${merchantPort}`;
    const keys=await newIdentityKeys(),gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin}));
    let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined;
    let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined;
    const calls:{path:string;status:number}[]=[],errors:string[]=[];
    let loseCreateReply=true,seatPolicyUnavailable=true;
    const tap=tapRest(owned.restUrl,async(call,forward)=>{
        if(seatPolicyUnavailable && call.resource==='rpc/merchant_staff_policy_snapshot_v1') {
            return new Response(JSON.stringify({code:'SYNTHETIC_SEAT_POLICY_OUTAGE',message:'Synthetic seat policy outage'}),{status:503,headers:{'content-type':'application/json'}});
        }
        const response=await forward();
        if(loseCreateReply && call.resource==='rpc/mutate_merchant_staff_v1' && (call.json as any)?.p_operation==='create' && response.ok) {
            await response.arrayBuffer();
            return new Response(JSON.stringify({code:'SYNTHETIC_COMMITTED_REPLY_LOSS',message:'Synthetic committed reply loss'}),{status:503,headers:{'content-type':'application/json'}});
        }
        return response;
    });
    try {
        bridge=createServer(async(req,res)=>{
            const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString();
            const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
            try {const result=await gateway.request(req.url??'/',{method:req.method,headers,...(body?{body}:{})});
                calls.push({path:(req.url??'/').split('?')[0],status:result.status});res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);
            }catch {res.writeHead(500);res.end('{}');}
        });
        await new Promise<void>(r=>bridge!.listen(0,'127.0.0.1',r));
        const apiOrigin=`http://127.0.0.1:${(bridge.address() as {port:number}).port}`;
        const shared={INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
        identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,env:{...shared,
            LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
            LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),
            ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
            NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',
            LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
        identity.stderr.on('data',d=>errors.push(d.toString().slice(0,700)));
        merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
        merchant.stderr.on('data',d=>errors.push(d.toString().slice(0,700)));
        await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant)]);
        browser=await chromium.launch({headless:true});
        const owner=await browser.newContext();page=await owner.newPage();page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(60_000);
        await signIn(page,identityOrigin,ownerEmail,password,merchantOrigin);
        await page.goto(`${merchantOrigin}/${tenant.subdomain}/settings/users`);
        await expect(page.getByRole('heading',{name:'Users and permissions',exact:true})).toBeVisible();
        await expect(page.getByText('Staff plan is unavailable',{exact:true})).toBeVisible();
        await expect(page.getByRole('button',{name:'Add staff',exact:true}).first()).toBeDisabled();
        seatPolicyUnavailable=false;
        await page.getByRole('button',{name:'Reload staff plan',exact:true}).click();
        await expect(page.getByRole('button',{name:'Add staff',exact:true}).first()).toBeEnabled();
        const endpoint=`${merchantOrigin}/api/stores/${tenant.subdomain}/users`;
        // Cookies come from the real login. A sibling origin must not consume those cookies for a staff mutation.
        for(const origin of [undefined,'http://sibling.localhost']) {
            const denied=await owner.request.post(endpoint,{headers:{...(origin?{Origin:origin}:{}),'X-Idempotency-Key':crypto.randomUUID()},
                data:{email:staffEmail,role:'editor'}});
            assert.equal(denied.status(),403);
        }
        assert.equal(owned.psql(`SELECT count(*) FROM employees WHERE store_id='${tenant.siteId}';`),'0');
        await page.getByRole('button',{name:'Add staff',exact:true}).first().click();
        await page.getByLabel('Email address',{exact:true}).fill(staffEmail);
        await page.getByLabel('Full name (optional)',{exact:true}).fill('Synthetic Browser Staff');
        const add=page.getByRole('button',{name:'Add verified account directly',exact:true});
        const [ambiguous]=await Promise.all([page.waitForResponse(r=>r.url()===endpoint&&r.request().method()==='POST'),add.click()]);
        assert.equal(ambiguous.status(),503);
        assert.equal(owned.psql(`SELECT count(*) FROM employees WHERE store_id='${tenant.siteId}';`),'1','effect committed despite lost reply');
        const key=ambiguous.request().headers()['x-idempotency-key'];assert.ok(key);
        loseCreateReply=false;
        const [retried]=await Promise.all([page.waitForResponse(r=>r.url()===endpoint&&r.request().method()==='POST'),add.click()]);
        assert.equal(retried.status(),200,await retried.text());assert.equal(retried.request().headers()['x-idempotency-key'],key);
        await expect(page.getByText('Synthetic Browser Staff',{exact:true})).toBeVisible();
        const employeeId=owned.psql(`SELECT id FROM employees WHERE store_id='${tenant.siteId}';`);
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='employee.created' AND resource_id='${employeeId}';`),'1');
        assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${tenant.siteId}' AND scope LIKE 'merchant-staff-v1:%';`),'1');
        const staff=await browser.newContext(),staffPage=await staff.newPage();staffPage.setDefaultTimeout(30_000);
        await signIn(staffPage,identityOrigin,staffEmail,password,merchantOrigin);
        await staffPage.goto(`${merchantOrigin}/${tenant.subdomain}/products`);
        const read=await staff.request.get(`${merchantOrigin}/api/stores/${tenant.subdomain}/products`);assert.equal(read.status(),200,await read.text());
        const [downgraded]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/users/'+employeeId)&&r.request().method()==='PATCH'),
            page.getByRole('combobox',{name:`Role for ${staffEmail}`,exact:true}).selectOption('viewer')]);
        assert.equal(downgraded.status(),200,await downgraded.text());
        await expect(page.getByRole('combobox',{name:`Role for ${staffEmail}`,exact:true})).toHaveValue('viewer');
        const refusedWrite=await staff.request.post(`${merchantOrigin}/api/stores/${tenant.subdomain}/products`,
            {data:{name:'Synthetic forbidden product',price:100,stock:1}});
        assert.equal(refusedWrite.status(),403,await refusedWrite.text());
        assert.equal((await staff.request.get(`${merchantOrigin}/api/stores/${tenant.subdomain}/products`)).status(),200);
        await page.getByRole('button',{name:`Remove ${staffEmail}`,exact:true}).click();
        const [removed]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/users/'+employeeId)&&r.request().method()==='DELETE'),
            page.getByRole('button',{name:'Remove staff',exact:true}).click()]);
        assert.equal(removed.status(),200,await removed.text());
        const deniedAfter=await staff.request.get(`${merchantOrigin}/api/stores/${tenant.subdomain}/products`);
        assert.ok([403,404].includes(deniedAfter.status()),await deniedAfter.text());
        assert.equal(owned.psql(`SELECT status||'|'||is_active FROM employees WHERE id='${employeeId}';`),'removed|false');
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='employee.removed' AND resource_id='${employeeId}';`),'1');
        await staff.close();await owner.close();
    } catch(error) {
        console.info(JSON.stringify({diagnostic:'staff_browser_failure',path:page?new URL(page.url()).pathname:null,
            visible:await page?.locator('body').innerText().catch(()=>''),gatewayCalls:calls.slice(-20),appErrors:errors.slice(-10)}));
        await page?.screenshot({path:`/private/tmp/letbuyy-staff-browser-${owned.runId}.png`}).catch(()=>{});throw error;
    } finally {
        tap.restore();await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await gateway.settle();
        if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}
    }
});
