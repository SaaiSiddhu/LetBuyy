// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Normal subscription browser journey through Identity, Merchant BFF and real Gateway/ownedDB.
// Existing verified synthetic accounts are fixture inputs, not proof of email/inbox delivery.
// Official Turnstile test keys exercise the widget/Siteverify transport, not production anti-bot.
import { tmpdir as ownedTmpDir } from 'node:os';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
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

test('normal merchant checkout survives lost create response, reload, dismissal and failed activation',{timeout:780_000},async()=>{
 const tenant=newSyntheticTenant('subscription-browser');seedSyntheticTenant(owned.psql,tenant);
 const ownerId=crypto.randomUUID(),password='Synthetic-subscription-browser-pass-42',ownerEmail=`syn-sub-browser-${ownerId}@example.invalid`;
 const hash=await hashMerchantPassword(password),providerSecret='synthetic-subscription-browser-provider-secret';
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES('${ownerId}','${ownerEmail}',true,'Synthetic Subscriber','${hash}');
 UPDATE sites SET custom_user_id='${ownerId}',legal_name=NULL,theme_id='letbuyy-core' WHERE id='${tenant.siteId}';`);
const profile={schema_version:1,policy_version:'D-SUB-TAX-INCLUSIVE-V1',profile_id:'synthetic-owned-only',profile_version:1,
 approval_status:'approved',approval_reference:'synthetic-approval-not-live',registration_status:'registered',supply_category:'domestic_taxable_saas',rate_bps:1800,
 supplier:{name:'Synthetic Platform Supplier',gstin:'27AAAAA0000A1Z5',state_code:'27',country:'IN',
 address:{line1:'Synthetic Supplier Address',city:'Mumbai',state:'Maharashtra',zip:'400001',country:'IN'}}};

 const identityPort=await freePort(),merchantPort=await freePort(),commercePort=await freePort(),commerceOrigin=`http://localhost:${commercePort}`,identityOrigin=`http://localhost:${identityPort}`,merchantOrigin=`http://localhost:${merchantPort}`;
 const keys=await newIdentityKeys(),gateway=new Gateway(gatewayEnv(owned,keys,{LETBUYY_SUBSCRIPTION_TAX_PROFILE:JSON.stringify(profile),ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:'localhost',
  RAZORPAY_KEY_ID:'synthetic-browser-public-provider-key',RAZORPAY_KEY_SECRET:providerSecret}));
 const orders=new Map<string,{id:string;amount:number;currency:string;receipt:string;notes:Record<string,string>}>(),payments=new Map<string,unknown>();
 let createCount=0,loseCreate=true;const originalFetch=globalThis.fetch;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.toString():input.url);
  if(url.origin!=='https://api.razorpay.com')return originalFetch(input,init);
  const json=(v:unknown)=>new Response(JSON.stringify(v),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.pathname==='/v1/orders'&&init?.method==='POST'){
   const raw=JSON.parse(String(init.body)),row={...raw,id:'order_syn_browser_'+crypto.randomUUID()};orders.set(row.id,row);createCount++;
   if(loseCreate){loseCreate=false;throw new Error('Synthetic lost create response');}return json(row);
  }
  if(url.pathname==='/v1/orders')return json({items:[...orders.values()].filter(o=>o.receipt===url.searchParams.get('receipt'))});
  if(url.pathname.startsWith('/v1/payments/'))return json(payments.get(url.pathname.split('/').pop()!)||{error:{description:'Synthetic missing payment'}});
  throw new Error('Unexpected synthetic provider path '+url.pathname);
 }) as typeof fetch;
 let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined,commerce:OwnedClientProcess|undefined;
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined;
 const calls:{path:string;status:number;key?:string}[]=[],errors:string[]=[];
 try{
  bridge=createServer(async(req,res)=>{
   const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString(),headers=new Headers();
   for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   try{const result=await gateway.request(req.url??'/',{method:req.method,headers,...(body?{body}:{})});
    calls.push({path:(req.url??'/').split('?')[0],status:result.status,key:headers.get('X-Idempotency-Key')||undefined});res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);
   }catch{res.writeHead(500);res.end('{}');}
  });
  await new Promise<void>(r=>bridge!.listen(0,'127.0.0.1',r));const apiOrigin=`http://127.0.0.1:${(bridge.address() as {port:number}).port}`;
  const shared={INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
   NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
  commerce=startOwnedClientRuntime(owned,'commerce-next-production',{port:commercePort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1',NEXT_PUBLIC_STORE_ROOT_DOMAIN:'localhost',NEXT_PUBLIC_STOREFRONT_URL:commerceOrigin,LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'}});
  for(const app of [identity,merchant,commerce])app.stderr.on('data',d=>errors.push(d.toString().slice(0,600)));
  await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant),ready(commerceOrigin+'/api/buyer-auth/session',commerce)]);
  browser=await chromium.launch({headless:true});const context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(60_000);
  // Explicit provider SDK fixture only. Normal app, session, proxy and DB are real.
  await context.route('https://checkout.razorpay.com/v1/checkout.js',route=>route.fulfill({contentType:'application/javascript',body:`window.Razorpay=class{
   constructor(options){window.__syntheticCheckout=options;}open(){window.__syntheticCheckoutOpen=true;}on(){}};`}));
  await signIn(page,identityOrigin,ownerEmail,password,merchantOrigin);
  const paymentSetup=page.locator(`a[href="/${tenant.subdomain}/settings/payments"]`).first();
  await expect(paymentSetup).toBeVisible();await paymentSetup.click();await page.waitForURL(u=>u.pathname===`/${tenant.subdomain}/settings/payments`);
  await page.goto(`${merchantOrigin}/${tenant.subdomain}/dashboard`);
  await expect(page.getByRole('link',{name:'Select a plan',exact:true})).toHaveAttribute('href',`/${tenant.subdomain}/access_account/checkout/select-plan`);
  await page.getByRole('link',{name:'Select a plan',exact:true}).click();
  await page.waitForURL(u=>u.pathname.endsWith('/access_account/checkout/select-plan'));
  await expect(page.getByText('All plans include a 7-day free trial. Cancel anytime.',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Start free trial',exact:true})).toHaveCount(0);
  await page.goto(`${merchantOrigin}/${tenant.subdomain}/settings/business`);
  await page.getByLabel('Legal business name',{exact:true}).fill('Synthetic Browser Business');
  const [savedIdentity]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/settings')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save',exact:true}).click()]);
  assert.equal(savedIdentity.status(),200,'business identity is saved through the real form: '+await savedIdentity.text());
  await page.reload();await expect(page.getByLabel('Legal business name',{exact:true})).toHaveValue('Synthetic Browser Business');
  assert.equal(owned.psql(`SELECT legal_name FROM sites WHERE id='${tenant.siteId}';`),'Synthetic Browser Business');
  await page.goto(`${merchantOrigin}/${tenant.subdomain}/settings/general`);
  await page.getByLabel('Address line 1',{exact:true}).fill('Synthetic Buyer Address');
  await page.getByLabel('City',{exact:true}).fill('Bengaluru');
  await page.getByLabel('State',{exact:true}).selectOption('Karnataka');
  await page.getByLabel('PIN code',{exact:true}).fill('560001');
  await page.getByLabel('SEO title',{exact:true}).fill('Synthetic saved store title');
  await page.getByLabel('SEO description',{exact:true}).fill('Synthetic saved store description');
  const [savedProfile]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/settings')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save',exact:true}).click()]);
  assert.equal(savedProfile.status(),200,'normal General settings save must succeed: '+await savedProfile.text());
  assert.equal(owned.psql(`SELECT invoice_address->>'state_code' FROM sites WHERE id='${tenant.siteId}';`),'29','the state selected in the real form is available to an unregistered subscription recipient');
  assert.equal(owned.psql(`SELECT gstin IS NULL FROM sites WHERE id='${tenant.siteId}';`),'t');
  await page.reload();await expect(page.getByLabel('State',{exact:true})).toHaveValue('Karnataka');
  await expect(page.getByLabel('SEO title',{exact:true})).toHaveValue('Synthetic saved store title');
  assert.equal(owned.psql(`SELECT meta_title||'|'||meta_description FROM sites WHERE id='${tenant.siteId}';`),'Synthetic saved store title|Synthetic saved store description');
  const profileScreenshot=`${ownedTmpDir()}/letbuyy-billing-profile-${owned.runId}.png`;await page.screenshot({path:profileScreenshot,fullPage:true});
  // A fresh real storefront render consumes the same saved canonical metadata.
  const storePage=await context.newPage();await storePage.goto(`${commerceOrigin}/store/${tenant.subdomain}`);
  await expect(storePage).toHaveTitle(/Synthetic saved store title/);await expect(storePage.locator('head meta[name="description"]')).toHaveAttribute('content','Synthetic saved store description');
  const seoScreenshot=`${ownedTmpDir()}/letbuyy-billing-seo-${owned.runId}.png`;await storePage.screenshot({path:seoScreenshot,fullPage:true});await storePage.close();

  await page.goto(`${merchantOrigin}/${tenant.subdomain}/access_account/checkout/select-plan`);
  const growthCard=page.locator('article').filter({has:page.getByRole('heading',{name:'Growth',exact:true})});
  await growthCard.getByRole('button',{name:'Choose plan',exact:true}).click();
  await page.waitForURL(u=>u.pathname===`/${tenant.subdomain}/access_account/checkout/checkout`&&u.searchParams.get('plan')==='growth');
  await expect(page.getByRole('complementary',{name:'Order summary'})).toContainText('₹699');const subscribe=page.getByRole('button',{name:/Subscribe|Continue saved checkout/});
  const [lost]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/subscribe')&&r.request().method()==='POST'),subscribe.click()]);assert.equal(lost.status(),503);
  await expect(page.locator('.checkout-error[role="alert"]')).toContainText('reconciliation');assert.equal(createCount,1);
  await page.reload();
  const [recovered]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/subscribe')&&r.request().method()==='POST'),subscribe.click()]);assert.equal(recovered.status(),200);
  await page.waitForFunction(()=>Boolean((globalThis as unknown as {__syntheticCheckoutOpen?:boolean}).__syntheticCheckoutOpen));
  await page.evaluate(()=>{(globalThis as unknown as {__syntheticCheckout:{modal:{ondismiss:()=>void}}}).__syntheticCheckout.modal.ondismiss();});
  await expect(subscribe).toBeEnabled();assert.equal(createCount,1);
  const order=[...orders.values()][0];assert.ok(order);
  const proof={razorpay_order_id:order.id,razorpay_payment_id:'pay_syn_browser_'+crypto.randomUUID(),razorpay_signature:''};
  proof.razorpay_signature=createHmac('sha256',providerSecret).update(order.id+'|'+proof.razorpay_payment_id).digest('hex');
  payments.set(proof.razorpay_payment_id,{id:proof.razorpay_payment_id,order_id:order.id,amount:order.amount,currency:order.currency,status:'captured'});
  owned.psql(`CREATE FUNCTION syn_checkout_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='merchant_subscription.activated' AND NEW.metadata->>'site_id'='${tenant.siteId}' THEN RAISE EXCEPTION 'synthetic-checkout-audit-fault';END IF;RETURN NEW;END $$;
  CREATE TRIGGER syn_checkout_audit_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION syn_checkout_audit_fault();`);
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/subscribe')&&r.request().method()==='POST'),subscribe.click()]);
  const failedVerification=page.waitForResponse(r=>r.url().endsWith('/api/subscribe/verify')&&r.request().method()==='POST');
  await page.evaluate(p=>{void (globalThis as unknown as {__syntheticCheckout:{handler:(p:unknown)=>Promise<void>}}).__syntheticCheckout.handler(p);},proof);
  assert.equal((await failedVerification).status(),503);await expect(page.locator('.checkout-error[role="alert"]')).toContainText('unavailable');
  assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${proof.razorpay_payment_id}';`),'0');
  owned.psql('DROP TRIGGER syn_checkout_audit_fault ON audit_logs;DROP FUNCTION syn_checkout_audit_fault();');
  await page.reload();await subscribe.click();
  await page.waitForFunction(()=>Boolean((globalThis as unknown as {__syntheticCheckoutOpen?:boolean}).__syntheticCheckoutOpen));
  const verified=page.waitForResponse(r=>r.url().endsWith('/api/subscribe/verify')&&r.request().method()==='POST');
  await page.evaluate(p=>{void (globalThis as unknown as {__syntheticCheckout:{handler:(p:unknown)=>Promise<void>}}).__syntheticCheckout.handler(p);},proof);
  assert.equal((await verified).status(),200);await page.waitForURL(u=>u.pathname===`/${tenant.subdomain}/dashboard`,{timeout:60_000});
  assert.equal(createCount,1);assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='${proof.razorpay_payment_id}';`),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE site_id='${tenant.siteId}';`),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='merchant_subscription.activated' AND metadata->>'site_id'='${tenant.siteId}';`),'1');
  const createCalls=calls.filter(c=>c.path==='/v1/payments/subscription/order');assert.equal(new Set(createCalls.map(c=>c.key)).size,1);assert.ok(createCalls.every(c=>c.key?.startsWith('subscription-checkout:')));
  const verifyCalls=calls.filter(c=>c.path==='/v1/payments/subscription/verify');assert.equal(new Set(verifyCalls.map(c=>c.key)).size,1);
  assert.equal(await page.evaluate(()=>Object.keys((globalThis as unknown as {localStorage:Record<string,string>}).localStorage).filter(k=>k.startsWith('letbuyy:subscription-checkout:v1:')).length),0);
  assert.equal(owned.psql(`SELECT (subscription_tax_snapshot->'recipient'->>'state_code')||'|'||coalesce(subscription_tax_snapshot->'recipient'->>'gstin','NULL')||'|'||(subscription_tax_snapshot->>'gross_minor')||'|'||(subscription_tax_snapshot->>'tax_minor') FROM billing_history WHERE site_id='${tenant.siteId}';`),'29|NULL|69900|10663');
  await page.goto(`${merchantOrigin}/${tenant.subdomain}/settings/plan`);await expect(page.locator('.settings-plan-name')).toContainText(/growth/i);await expect(page.locator('.settings-plan-price')).toContainText(/699.*paid/);
  await page.getByRole('button',{name:'Cancel plan',exact:true}).click();
  const [cancelled]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/plan/cancel')&&r.request().method()==='POST'),page.getByRole('dialog').getByRole('button',{name:'Cancel plan',exact:true}).click()]);
  assert.equal(cancelled.status(),200);await expect(page.locator('.settings-plan-name')).toContainText(/growth/i);await expect(page.getByRole('button',{name:'Cancel plan',exact:true})).toHaveCount(0);
  await page.reload();await expect(page.locator('.settings-plan-name')).toContainText(/growth/i);await expect(page.locator('.settings-plan-headline')).toContainText(/cancelled/i);
  assert.equal(owned.psql(`SELECT status FROM subscriptions WHERE razorpay_payment_id='${proof.razorpay_payment_id}';`),'cancelled');
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE site_id='${tenant.siteId}';`),'1');
  await page.screenshot({path:`${ownedTmpDir()}/letbuyy-subscription-browser-${owned.runId}.png`});
  await page.goto(`${merchantOrigin}/${tenant.subdomain}/access_account/checkout/select-plan`);await expect(page.getByRole('button',{name:'Current plan',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Choose plan',exact:true}).first()).toBeEnabled();await expect(page.locator('.select-plan-title')).not.toContainText(/trial/i);
  console.info('OWNED_SUBSCRIPTION_BROWSER '+JSON.stringify({providerFixtureOnly:true,unregisteredProfileFromRealForm:true,businessIdentityFromRealForm:true,seededLegalName:false,normalTrialPlanNavigation:true,actualPlanCardChosen:true,canonicalSeoFreshRender:true,cancelReadbackRetainsReceipt:true,profileScreenshot,seoScreenshot,providerCreates:createCount,normalCreateStatuses:createCalls.map(c=>c.status),normalVerifyStatuses:verifyCalls.map(c=>c.status),paidSubscriptions:1,paidInvoices:1}));
 }catch(error){console.info('OWNED_SUBSCRIPTION_BROWSER_FAILURE '+JSON.stringify({path:page?new URL(page.url()).pathname:null,text:await page?.locator('body').innerText().catch(()=>''),calls:calls.slice(-20).map(({path,status})=>({path,status})),errors:errors.slice(-5)}));throw error;
 }finally{await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await stopOwnedClientRuntime(commerce);await gateway.settle();globalThis.fetch=originalFetch;
  if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}}
});
