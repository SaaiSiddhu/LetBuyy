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

test('normal owner invitation, wrong-account recovery, verified staff consent, live downgrade and removal',{timeout:780_000},async()=>{
 const tenant=newSyntheticTenant('invite-browser');seedSyntheticTenant(owned.psql,tenant);
 const ownerId=crypto.randomUUID(),staffId=crypto.randomUUID(),password='Synthetic-invite-browser-pass-42';
 const ownerEmail=`syn-owner-${ownerId}@example.invalid`,staffEmail=`syn-invited-${staffId}@example.invalid`;
 const hash=await hashMerchantPassword(password);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES
 ('${ownerId}','${ownerEmail}',true,'Synthetic Inviter','${hash}'),('${staffId}','${staffEmail}',true,'Synthetic Invitee','${hash}');
 UPDATE sites SET custom_user_id='${ownerId}' WHERE id='${tenant.siteId}';`);
 const identityPort=await freePort(),merchantPort=await freePort(),identityOrigin=`http://localhost:${identityPort}`,merchantOrigin=`http://localhost:${merchantPort}`;
 const keys=await newIdentityKeys(),gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,
  NEXT_PUBLIC_ADMIN_URL:merchantOrigin,STAFF_INVITATION_SIGNING_SECRET:crypto.randomUUID()+crypto.randomUUID()}));
 let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined;
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined,staffPage:Page|undefined;
 const calls:{path:string;status:number}[]=[],errors:string[]=[];
 const redact=(text:string)=>text.replace(/lb-staff-invite-v1\.[a-f0-9-]+\.[a-f0-9]+/gi,'[redacted-invitation]');
 try {
  bridge=createServer(async(req,res)=>{
   const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString();
   const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   try {const result=await gateway.request(req.url??'/',{method:req.method,headers,...(body?{body}:{})});
    calls.push({path:(req.url??'/').split('?')[0],status:result.status});res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);
   }catch {res.writeHead(500);res.end('{}');}
  });
  await new Promise<void>(r=>bridge!.listen(0,'127.0.0.1',r));const apiOrigin=`http://127.0.0.1:${(bridge.address() as {port:number}).port}`;
  const shared={INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),
   ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',
   TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
  for(const app of [identity,merchant])app.stderr.on('data',d=>errors.push(redact(d.toString()).slice(0,700)));
  await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant)]);
  browser=await chromium.launch({headless:true});const owner=await browser.newContext();page=await owner.newPage();page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(60_000);
  await signIn(page,identityOrigin,ownerEmail,password,merchantOrigin);
  await page.goto(`${merchantOrigin}/${tenant.subdomain}/settings/users`);
  await page.getByRole('button',{name:'Add staff',exact:true}).first().click();
  await page.getByLabel('Email address',{exact:true}).fill(staffEmail);
  await page.getByLabel('Full name (optional)',{exact:true}).fill('Synthetic Invited Staff');
  const [created]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/users')&&r.request().method()==='POST'),page.getByRole('button',{name:'Send staff invitation',exact:true}).click()]);
  assert.equal(created.status(),200);
  await expect(page.getByLabel('Invitation link',{exact:true})).toBeVisible();
  const link=await page.getByLabel('Invitation link',{exact:true}).inputValue();
  const id=owned.psql(`SELECT id FROM employees WHERE store_id='${tenant.siteId}';`);
  assert.equal(owned.psql(`SELECT status||'|'||coalesce(user_id::text,'unlinked') FROM employees WHERE id='${id}';`),'invited|unlinked');
  const staff=await browser.newContext();staffPage=await staff.newPage();staffPage.setDefaultTimeout(30_000);staffPage.setDefaultNavigationTimeout(60_000);
  // First use the wrong real account, then switch through the existing Identity logout/login UI.
  await signIn(staffPage,identityOrigin,ownerEmail,password,merchantOrigin);
  await staffPage.goto(link);await expect(staffPage.getByText('Invitation unavailable',{exact:true})).toBeVisible();
  await staffPage.getByRole('button',{name:'Use a different account',exact:true}).click();
  await staffPage.waitForURL(u=>u.origin===identityOrigin,{timeout:30_000});
  const savedAccount=staffPage.getByRole('link',{name:'Use a different account',exact:true});
  // Saved accounts load after the session check; assert and await the actual picker.
  await expect(savedAccount).toBeVisible();await savedAccount.click();
  await expect(staffPage.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:30_000});
  await staffPage.getByLabel('Email',{exact:true}).fill(staffEmail);
  await staffPage.getByRole('button',{name:'Continue with email',exact:true}).click();
  await staffPage.getByLabel('Password',{exact:true}).fill(password);
  const [login]=await Promise.all([staffPage.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST'),staffPage.getByRole('button',{name:'Log in',exact:true}).click()]);
  assert.equal(login.status(),200);await staffPage.waitForURL(u=>u.origin===merchantOrigin&&u.pathname==='/accept-invite',{timeout:60_000});
  await expect(staffPage.getByText('Requested access:',{exact:true})).toBeVisible();
  await expect(staffPage.getByText('Manage products & collections',{exact:true})).toBeVisible();
  const before=await staff.request.get(`${merchantOrigin}/api/stores/${tenant.subdomain}/products`);assert.ok([403,404].includes(before.status()));
  const [accepted]=await Promise.all([staffPage.waitForResponse(r=>r.url().endsWith('/api/employees/accept-invite')&&r.request().postDataJSON()?.action==='accept'),
   staffPage.getByRole('button',{name:'Accept staff invitation',exact:true}).click()]);
  assert.equal(accepted.status(),200);await staffPage.waitForURL(u=>u.pathname===`/${tenant.subdomain}/dashboard`,{timeout:60_000});
  assert.equal(owned.psql(`SELECT status||'|'||user_id::text FROM employees WHERE id='${id}';`),'active|'+staffId);
  assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='employee.invite.accepted' AND resource_id='${id}';`),'1');
  assert.equal((await staff.request.get(`${merchantOrigin}/api/stores/${tenant.subdomain}/products`)).status(),200);
  // Acceptance changed the member version; the owner reloads current state before a new change.
  await page.reload();
  const [downgraded]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/users/'+id)&&r.request().method()==='PATCH'),
   page.getByRole('combobox',{name:`Role for ${staffEmail}`,exact:true}).selectOption('viewer')]);assert.equal(downgraded.status(),200);
  await expect(page.getByRole('combobox',{name:`Role for ${staffEmail}`,exact:true})).toHaveValue('viewer');
  const write=await staff.request.post(`${merchantOrigin}/api/stores/${tenant.subdomain}/products`,{data:{name:'Synthetic denied product',price:100,stock:1}});assert.equal(write.status(),403);
  await page.getByRole('button',{name:`Remove ${staffEmail}`,exact:true}).click();
  const [removed]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/users/'+id)&&r.request().method()==='DELETE'),page.getByRole('button',{name:'Remove staff',exact:true}).click()]);assert.equal(removed.status(),200);
  const after=await staff.request.get(`${merchantOrigin}/api/stores/${tenant.subdomain}/products`);assert.ok([403,404].includes(after.status()));
  await staff.close();await owner.close();
 }catch(error){
  console.info(JSON.stringify({diagnostic:'staff_invitation_browser_failure',ownerPath:page?new URL(page.url()).pathname:null,staffPath:staffPage?new URL(staffPage.url()).pathname:null,
   ownerText:redact(await page?.locator('body').innerText().catch(()=> '') || ''),staffText:redact(await staffPage?.locator('body').innerText().catch(()=> '') || ''),gatewayCalls:calls.slice(-25),errors:errors.slice(-10)}));
  await page?.screenshot({path:`/private/tmp/letbuyy-invitation-owner-${owned.runId}.png`,mask:[page.getByLabel('Invitation link',{exact:true})]}).catch(()=>{});throw error;
 }finally{await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await gateway.settle();
  if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}}
});
