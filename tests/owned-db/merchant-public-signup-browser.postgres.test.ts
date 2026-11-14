// Labelled local fixtures: synthetic accounts and public Turnstile test keys only.
// No seeded user, session, verified email, password or store. Resend HTTP is captured;
// this is provider-fixture acceptance, not real inbox delivery or hosted cookie proof.
import {tmpdir} from 'node:os';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer,type Server} from 'node:http';
import {exportJWK} from 'jose';
import {chromium,expect,type Page} from '@playwright/test';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
const owned=requireOwnedDatabase();
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
test('public signup selects real catalog plans and reads paid billing through production apps',{timeout:780_000},async()=>{
 const email=`syn-public-${crypto.randomUUID()}@example.invalid`,password='Synthetic-Public-Signup-42!';
 const subdomain='syn-signup-'+crypto.randomUUID().slice(0,8);
 assert.equal(owned.psql(`SELECT count(*) FROM users_custom WHERE email='${email}';`),'0');
 const identityPort=await freePort(),merchantPort=await freePort(),identityOrigin=`http://localhost:${identityPort}`,merchantOrigin=`http://localhost:${merchantPort}`;
 const providerSecret=crypto.randomUUID()+crypto.randomUUID();
 const supplierProfile={schema_version:1,policy_version:'D-SUB-TAX-INCLUSIVE-V1',profile_id:'synthetic-owned-only',profile_version:1,approval_status:'approved',approval_reference:'synthetic-approval-not-live',registration_status:'registered',supply_category:'domestic_taxable_saas',rate_bps:1800,supplier:{name:'Synthetic Platform Supplier',gstin:'27AAAAA0000A1Z5',state_code:'27',country:'IN',address:{line1:'Synthetic Supplier Address',city:'Mumbai',state:'Maharashtra',zip:'400001',country:'IN'}}};
 const keys=await newIdentityKeys(),gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'test',LETBUYY_SUBSCRIPTION_TAX_PROFILE:JSON.stringify(supplierProfile),RAZORPAY_KEY_ID:'synthetic-owned-public-key',RAZORPAY_KEY_SECRET:providerSecret,LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:'localhost',RESEND_API_KEY:'synthetic-owned-resend-capture'}));
 const orders=new Map<string,{id:string;amount:number;currency:string;receipt:string;notes:Record<string,string>}>(),payments=new Map<string,unknown>();
 const mail:{to:string[];subject:string;html:string}[]=[],originalFetch=globalThis.fetch;let failFirstMail=true;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.toString():input.url);
  if(url.origin==='https://api.razorpay.com'){
   const json=(data:unknown)=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
   if(url.pathname==='/v1/orders'&&init?.method==='POST'){
    const order={...JSON.parse(String(init.body)),id:'order_syn_signup_'+crypto.randomUUID()};orders.set(order.id,order);return json(order);
   }
   if(url.pathname==='/v1/orders')return json({items:[...orders.values()].filter(o=>o.receipt===url.searchParams.get('receipt'))});
   if(url.pathname.startsWith('/v1/payments/'))return json(payments.get(url.pathname.split('/').pop()!)||{});
   throw new Error('Unexpected captured payment-provider operation');
  }
  if(url.origin!=='https://api.resend.com')return originalFetch(input,init);
  assert.equal(url.pathname,'/emails');assert.equal(init?.method,'POST');
  mail.push(JSON.parse(String(init?.body)));if(failFirstMail){failFirstMail=false;return new Response(JSON.stringify({name:'application_error',message:'Synthetic email transport unavailable'}),{status:503,headers:{'Content-Type':'application/json'}});}return new Response(JSON.stringify({id:'synthetic-mail-'+crypto.randomUUID()}),{status:200,headers:{'Content-Type':'application/json'}});
 }) as typeof fetch;
 let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined;
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
  for(const app of [identity,merchant])app.stderr.on('data',d=>errors.push(d.toString().slice(0,600)));
  await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant)]);
  const catalogSnapshot=JSON.parse(readFileSync(new URL('../fixtures/public-store-pricing-2026-10-30.json',import.meta.url),'utf8'));
  const publicCatalog=await gateway.request('/v1/pricing');assert.equal(publicCatalog.status,200);
  assert.equal(publicCatalog.json?.data.plans.length,catalogSnapshot.plans.length);
  for(const expected of catalogSnapshot.plans){
   const actual=publicCatalog.json?.data.plans.find((p:{slug:string})=>p.slug===expected.slug);assert.ok(actual);
   assert.deepEqual([actual.name,actual.regular_inr,actual.founding_inr,actual.status,actual.purchasable,actual.features.length],
    [expected.name,expected.regular_rupees,expected.founding_rupees,expected.status,expected.purchasable,expected.feature_count]);
  }
  browser=await chromium.launch({headless:true});const context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(60_000);
  // Explicit payment SDK fixture; application auth, BFF, worker and database remain real.
  await context.route('https://checkout.razorpay.com/v1/checkout.js',route=>route.fulfill({contentType:'application/javascript',body:`window.Razorpay=class{constructor(options){window.__syntheticCheckout=options;}open(){window.__syntheticCheckoutOpen=true;}on(){}};`}));
  const signup=await page.goto(identityOrigin+'/signup');assert.equal(signup?.status(),200);
  const signupCopy=await page.locator('body').innerText();
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:30_000});
  await page.getByLabel('Email',{exact:true}).fill(email);
  const [unavailable]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/signup'&&r.request().method()==='POST'),page.getByRole('button',{name:'Continue',exact:true}).click()]);
  assert.equal(unavailable.status(),500,'provider failure must not be reported as successful delivery');
  assert.equal(owned.psql(`SELECT count(*) FROM users_custom WHERE email='${email}' AND email_verified=false AND password_hash IS NULL;`),'1');
  await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeEnabled();
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/);
  const [registered]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/signup'&&r.request().method()==='POST'),page.getByRole('button',{name:'Continue',exact:true}).click()]);
  assert.equal(registered.status(),200);const payload=await registered.json();assert.equal(payload.devOtp,undefined);assert.equal(payload.needsVerification,true);
  assert.equal(mail.length,2,'failed delivery then retry must use the actual provider adapter');assert.deepEqual([mail[1].to].flat(),[email]);
  const otp=mail[1].subject.match(/^(\d{6}) is your LetBuyy verification code$/)?.[1];assert.ok(otp,'OTP must come from the captured email');
  assert.equal(owned.psql(`SELECT email_verified FROM users_custom WHERE email='${email}';`),'f');
  async function authPost(path:string,body:Record<string,string>){return page!.evaluate(async({path,body})=>{
   const token=document.cookie.split('; ').find(v=>v.startsWith('letbuyy_csrf=')||v.startsWith('lb_csrf='))?.split('=').slice(1).join('=')||'';
   return (await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':decodeURIComponent(token)},body:JSON.stringify(body)})).status;
  },{path,body});}
  assert.equal(await authPost('/api/auth/set-password',{password,email,userId:crypto.randomUUID()}),403,'a caller-supplied identity cannot replace verified intent');
  async function enterOtp(code:string){for(let i=0;i<6;i++)await page!.getByLabel(`Digit ${i+1} of 6`,{exact:true}).fill(code[i]);}
  // The production form automatically submits on the sixth digit.
  const wrongReply=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/verify-otp'&&r.request().method()==='POST');
  await enterOtp(otp==='000000'?'111111':'000000');
  assert.equal((await wrongReply).status(),400);assert.equal(owned.psql(`SELECT email_verified FROM users_custom WHERE email='${email}';`),'f');
  await expect(page.getByLabel('Digit 1 of 6',{exact:true})).toHaveValue('');
  const validReply=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/verify-otp'&&r.request().method()==='POST');
  await enterOtp(otp);assert.equal((await validReply).status(),200);
  await page.getByLabel('Password',{exact:true}).fill(password);await page.getByLabel('Confirm password',{exact:true}).fill(password);
  const [secured]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/set-password'&&r.request().method()==='POST'),page.getByRole('button',{name:'Create account',exact:true}).click()]);assert.equal(secured.status(),200);
  await page.waitForURL(u=>u.pathname==='/onboarding');
  assert.equal(await authPost('/api/auth/verify-otp',{email,otp}),400,'successful OTP is single-use');
  assert.equal(await authPost('/api/auth/set-password',{password,email}),403,'successful password intent is single-use');
  await page.getByRole('button',{name:/Online Store/}).click();await page.getByLabel('Display Name',{exact:true}).fill('Synthetic Public Store');
  await page.getByLabel('Subdomain',{exact:true}).fill(subdomain);await expect(page.getByRole('button',{name:'Next',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByLabel('Industry',{exact:true}).selectOption('food');
  const [created]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/create-store'&&r.request().method()==='POST'),page.getByRole('button',{name:'Create My Site',exact:true}).click()]);assert.equal(created.status(),200);
  await page.waitForURL(u=>u.origin===merchantOrigin&&u.pathname===`/${subdomain}/access_account/checkout/select-plan`,{timeout:60_000});await expect(page.getByRole('region',{name:'Available plans'})).toBeVisible();
  const store=JSON.parse(owned.psql(`SELECT jsonb_build_object('count',count(*),'trial_days',max(EXTRACT(EPOCH FROM (trial_ends_at-trial_started_at))/86400),'theme',max(theme_id),'status',max(status))::text FROM sites WHERE custom_user_id=(SELECT id FROM users_custom WHERE email='${email}') AND subdomain='${subdomain}';`));assert.equal(store.count,1);assert.equal(store.trial_days,14,'existing persisted trial policy is preserved');assert.equal(store.status,'draft');
  const siteId=owned.psql(`SELECT id FROM sites WHERE subdomain='${subdomain}';`);
  const planCard=(name:string)=>page!.locator('article').filter({has:page!.getByRole('heading',{name,exact:true})});
  await expect(planCard('Launch').locator('.select-plan-price').first()).toHaveText('₹199');
  await expect(planCard('Growth').locator('.select-plan-price').first()).toHaveText('₹699');
  for(const name of ['Scale','Commerce OS'])await expect(planCard(name).getByRole('button',{name:'Coming soon',exact:true})).toBeDisabled();
  // Annual selection and its actual server-scoped quote, then monthly selection.
  await page.getByRole('button',{name:/^Annual/}).click();
  await planCard('Launch').getByRole('button',{name:'Choose plan',exact:true}).click();
  await page.waitForURL(u=>u.searchParams.get('plan')==='launch'&&u.searchParams.get('bp')==='YEARLY');
  await expect(page.getByRole('complementary',{name:'Order summary'})).toContainText('₹2,388');
  await page.goto(`${merchantOrigin}/${subdomain}/access_account/checkout/select-plan`);
  // A fresh signup must supply its own billing identity through the normal forms.
  await page.goto(`${merchantOrigin}/${subdomain}/settings/business`);
  await page.getByLabel('Legal business name',{exact:true}).fill('Synthetic Signup Billing Business');
  const [businessSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/settings')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save',exact:true}).click()]);assert.equal(businessSaved.status(),200);
  await page.goto(`${merchantOrigin}/${subdomain}/settings/general`);
  await page.getByLabel('Address line 1',{exact:true}).fill('Synthetic Local Billing Address');await page.getByLabel('City',{exact:true}).fill('Bengaluru');await page.getByLabel('State',{exact:true}).selectOption('Karnataka');await page.getByLabel('PIN code',{exact:true}).fill('560001');
  const [addressSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/settings')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save',exact:true}).click()]);assert.equal(addressSaved.status(),200);
  const billingProofs:{plan:string;amount_minor:number;invoice_count:number}[]=[];
  for(const [slug,name,amount]of [['launch','Launch',19900],['growth','Growth',69900]]as const){
   await page.goto(`${merchantOrigin}/${subdomain}/access_account/checkout/select-plan`);
   await planCard(name).getByRole('button',{name:'Choose plan',exact:true}).click();await page.waitForURL(u=>u.searchParams.get('plan')===slug&&u.searchParams.get('bp')==='MONTHLY');
   await expect(page.locator('.checkout-amount')).toContainText(`₹${amount/100}`);
   const subscribe=page.getByRole('button',{name:/Subscribe|Continue saved checkout/});
   const [createdOrder]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/subscribe'&&r.request().method()==='POST'),subscribe.click()]);assert.equal(createdOrder.status(),200,await createdOrder.text());
   await page.waitForFunction(()=>Boolean((globalThis as unknown as {__syntheticCheckoutOpen?:boolean}).__syntheticCheckoutOpen));
   const saved=await createdOrder.json();const order=orders.get(saved.razorpay_order_id);assert.ok(order);assert.equal(order.amount,amount);assert.equal(order.currency,'INR');
   const proof={razorpay_order_id:order.id,razorpay_payment_id:'pay_syn_signup_'+crypto.randomUUID(),razorpay_signature:''};proof.razorpay_signature=createHmac('sha256',providerSecret).update(order.id+'|'+proof.razorpay_payment_id).digest('hex');
   payments.set(proof.razorpay_payment_id,{id:proof.razorpay_payment_id,order_id:order.id,amount:order.amount,currency:'INR',status:'captured'});
   const verified=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/subscribe/verify'&&r.request().method()==='POST');
   await page.evaluate(p=>{void(globalThis as unknown as {__syntheticCheckout:{handler:(p:unknown)=>Promise<void>}}).__syntheticCheckout.handler(p)},proof);assert.equal((await verified).status(),200);
   await page.waitForURL(u=>u.pathname===`/${subdomain}/dashboard`);
   const invoice=JSON.parse(owned.psql(`SELECT jsonb_build_object('amount',amount,'gross',subscription_tax_snapshot->>'gross_minor','taxable',subscription_tax_snapshot->>'taxable_minor','tax',subscription_tax_snapshot->>'tax_minor') FROM billing_history WHERE site_id='${siteId}' AND payment_id='${proof.razorpay_payment_id}';`));
   assert.equal(Number(invoice.gross),amount);assert.equal(Number(invoice.taxable)+Number(invoice.tax),amount);
   await page.goto(`${merchantOrigin}/${subdomain}/settings/plan`);await expect(page.locator('.settings-plan-name')).toContainText(new RegExp(slug,'i'));await expect(page.locator('.settings-plan-price')).toContainText(new RegExp(`${amount/100}.*paid`));
   await page.goto(`${merchantOrigin}/${subdomain}/settings/billing`);await expect(page.getByText('Past bills',{exact:true})).toBeVisible();
   const result=await page.request.get(`${merchantOrigin}/api/stores/${subdomain}/billing`);assert.equal(result.status(),200);const billing=(await result.json()).data;
   assert.equal(billing.subscription.plan,slug);assert.equal(billing.upcoming.amount_minor,amount);assert.equal(billing.invoices.length,billingProofs.length+1);
   billingProofs.push({plan:slug,amount_minor:amount,invoice_count:billing.invoices.length});
  }
  // Real Growth intent must survive the UI/BFF/core instead of becoming Starter.
  await page.getByRole('button',{name:'Add payment method',exact:true}).last().click();
  const [mandateCreated]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===`/api/stores/${subdomain}/billing`&&r.request().method()==='POST'),page.getByRole('dialog').getByRole('button',{name:'Set up with Razorpay',exact:true}).click()]);
  assert.equal(mandateCreated.status(),201,await mandateCreated.text());
  const mandate=(await mandateCreated.json()).data.mandate;assert.equal(mandate.plan_slug,'growth');assert.equal(mandate.amount_minor,69900);assert.equal(mandate.provider_mode,'sandbox');
  await expect(page.getByText('Sandbox payment method created',{exact:true})).toBeVisible();
  await page.reload();await expect(page.locator('.billing-method-item')).toContainText('Growth');await expect(page.locator('.billing-method-item')).toContainText(/sandbox/i);
  await page.goto(`${merchantOrigin}/${subdomain}/settings/billing/profile`);
  await page.getByRole('button',{name:'Add payment method',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog').getByRole('button',{name:'Set up with Razorpay',exact:true})).toBeEnabled();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await page.goto(`${merchantOrigin}/${subdomain}/settings/billing`);await expect(page.locator('.billing-stat-value').first()).toHaveText('₹898.00');
  const billingScreenshot=`${tmpdir()}/letbuyy-signup-billing-${owned.runId}.png`;await page.screenshot({path:billingScreenshot,fullPage:true});
  await page.goto(`${merchantOrigin}/${subdomain}/settings/plan`);await page.getByRole('button',{name:'Cancel plan',exact:true}).click();
  const [cancelled]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/plan/cancel')&&r.request().method()==='POST'),page.getByRole('dialog').getByRole('button',{name:'Cancel plan',exact:true}).click()]);assert.equal(cancelled.status(),200);
  await page.reload();await expect(page.locator('.settings-plan-headline')).toContainText(/cancelled/i);
  const finalBilling=await page.request.get(`${merchantOrigin}/api/stores/${subdomain}/billing`);assert.equal(finalBilling.status(),200);const cancelledBilling=(await finalBilling.json()).data;assert.equal(cancelledBilling.invoices.length,2);
  assert.equal(cancelledBilling.upcoming.amount_minor,0,'cancelled subscription must not be presented as another scheduled charge');assert.equal(cancelledBilling.upcoming.due_date,null);
  await page.goto(`${merchantOrigin}/${subdomain}/settings/billing`);await expect(page.locator('.billing-upcoming-meta')).toContainText('Plan cancelled. No renewal is scheduled.');await expect(page.locator('.billing-stat-value').first()).toHaveText('₹898.00');await expect(page.locator('.billing-upcoming-amount')).toContainText('₹0.00');
  assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE store_id='${siteId}' AND status='active';`),'0');
  console.info('OWNED_SIGNUP_BILLING '+JSON.stringify({providerFixtureOnly:true,realLocalCatalogParity:true,seededAccount:false,signupToOnboarding:true,annualQuoteMinor:238800,billingProofs,mandate:{plan:mandate.plan_slug,amount_minor:mandate.amount_minor,mode:mandate.provider_mode},cancelledRetainsInvoices:true,billingScreenshot}));
  await page.goto(`${merchantOrigin}/${subdomain}/dashboard`);await expect(page.getByRole('heading',{name:'Setup checklist and store health',exact:true})).toBeVisible();
  const screenshot=`${tmpdir()}/letbuyy-public-signup-${owned.runId}.png`;await page.screenshot({path:screenshot,fullPage:true});
  console.info('OWNED_PUBLIC_SIGNUP '+JSON.stringify({providerFixtureOnly:true,seededAccount:false,normalSignup:true,wrongOtpDenied:true,normalPasswordAndOnboarding:true,emailFailureThenRetry:true,unboundPasswordDenied:true,otpReplayDenied:true,passwordReplayDenied:true,mailCount:mail.length,store,screenshot}));
  assert.doesNotMatch(signupCopy,/₹20|14 days free/,'signup must not advertise an unsupported trial/price combination');
 }catch(error){console.info('OWNED_PUBLIC_SIGNUP_FAILURE '+JSON.stringify({path:page?new URL(page.url()).pathname:null,calls:calls.slice(-15).map(({path,status})=>({path,status})),errors:errors.slice(-3).map(s=>s.replace(/https?:\/\/[^\s"<>]+/g,'[redacted-url]'))}));throw error;
 }finally{await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await gateway.settle();globalThis.fetch=originalFetch;if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}}
});
