// Explicit-only real Razorpay sandbox check; never auto-discovered or a live-payment gate.
// Credentials come from the authorized private file, never from source or an ambient database.
// Identity, store, supplier and billing details are synthetic owned fixtures.
// Genuine Checkout and mock-bank responses flow through normal application handlers.
// Public Turnstile test fixtures do not establish production anti-bot or inbox delivery.
import { tmpdir as ownedTmpDir } from 'node:os';
import assert from 'node:assert/strict';
import {openSync, fstatSync, readFileSync, closeSync, constants, writeFileSync} from 'node:fs';
import test from 'node:test';
import { createServer, request as forwardHttpRequest, type Server } from 'node:http';
import {createServer as createHttpsServer, type Server as HttpsServer} from 'node:https';
import { exportJWK } from 'jose';
import { chromium, expect, type Page } from '@playwright/test';
import { hashMerchantPassword } from '../../services/api-gateway/src/lib/merchant-password';
import { Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET, tapRest } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase, startOwnedClientRuntime, stopOwnedClientRuntime, createOwnedCheckoutTlsCertificate, type OwnedClientProcess } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned = requireOwnedDatabase();

const credentialFile=process.env.LETBUYY_RAZORPAY_SANDBOX_FILE;
assert(process.env.LETBUYY_RAZORPAY_SANDBOX_RUN==='1' && credentialFile?.startsWith('/private/tmp/'),'Explicit private sandbox fixture required');
const credentialFd=openSync(credentialFile!,constants.O_RDONLY|constants.O_NOFOLLOW);
let credentials:{keyId:string;keySecret:string};
try{const stat=fstatSync(credentialFd);assert(stat.isFile()&&stat.uid===process.getuid?.()&&(stat.mode&0o777)===0o600&&stat.size<4096);
 credentials=JSON.parse(readFileSync(credentialFd,'utf8'));}finally{closeSync(credentialFd);}
assert(/^rzp_test_[A-Za-z0-9]+$/.test(credentials!.keyId)&&credentials!.keySecret.length>=16,'Only test credentials are allowed');

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


async function completeRazorpayTestBank(page:Page, completion:'subscription'|'collection'='subscription'){
 const frame=page.frameLocator('iframe.razorpay-checkout-frame');
 await expect(frame.locator('body')).toBeVisible({timeout:45_000});
 const save=async(stage:string)=>{
  const path=`/private/tmp/letbuyy-real-razorpay-${owned.runId}-${stage}.txt`;
  writeFileSync(path,await frame.locator('body').innerText().catch(()=>''),{mode:0o600});
  await page.screenshot({path:`/private/tmp/letbuyy-real-razorpay-${owned.runId}-${stage}.png`});
  console.info('REAL_SANDBOX_MODAL '+JSON.stringify({stage,diagnostic:path}));
 };
 try{
 await expect(frame.getByText(/Netbanking|Net Banking/i).first()).toBeVisible({timeout:45_000});
 const contact=frame.getByTestId('contact-overlay-container');
 if(await contact.isVisible()){
  const phone=contact.locator('input[type="tel"]').first();
  if(await phone.isVisible())await phone.fill('9000000088');
  await contact.getByRole('button',{name:/Continue/i}).click();
 }
 await save('opened');
 const netbank=frame.getByText(/Netbanking|Net Banking/i).first();
 await netbank.click({timeout:20_000});
 await save('netbanking');
 const popup=page.context().waitForEvent('page',{timeout:30_000}).catch(()=>null);
 await frame.getByText('Bank of Baroda - Retail Banking',{exact:true}).first().click({timeout:20_000});
 const bank=await popup;
 if(bank){await bank.waitForURL(u=>u.origin==='https://api.razorpay.com'&&u.pathname.startsWith('/v1/gateway/mock'),{timeout:30_000});
  assert.equal(new URL(bank.url()).origin,'https://api.razorpay.com');
  assert(new URL(bank.url()).pathname.startsWith('/v1/gateway/mock'),'Only the simulated provider bank is permitted');
  writeFileSync(`/private/tmp/letbuyy-real-razorpay-${owned.runId}-bank.txt`,await bank.locator('body').innerText(),{mode:0o600});
  await bank.getByRole('button',{name:/Success/i}).click({timeout:30_000});
 }else{
  for(const target of page.frames()){
   const success=target.getByRole('button',{name:/Success/i});
   if(await success.isVisible()){await success.click();return;}
  }
  await save('bank-unavailable');throw new Error('Razorpay test bank did not present its Success control');
 }
 }catch(error){
  await save('failure');
  if(process.env.LETBUYY_RAZORPAY_SANDBOX_DEBUG!=='1')throw error;
  console.info('REAL_SANDBOX_ASSISTED_BROWSER_READY');
  // An agent may operate the genuine provider UI through this owned browser.
  // No synthetic callback, HMAC or payment status is accepted here.
  if(completion==='subscription')await page.waitForURL(u=>u.pathname.endsWith('/dashboard'),{timeout:180_000});
  else await page.getByRole('heading',{name:'Order Confirmed!',exact:true}).waitFor({timeout:180_000});
 }
}

test('real Razorpay sandbox verifies a plan purchase and managed storefront collection',{timeout:780_000},async()=>{
 const tenant=newSyntheticTenant('subscription-browser');seedSyntheticTenant(owned.psql,tenant);
 const ownerId=crypto.randomUUID(),password='Synthetic-Only-'+crypto.randomUUID(),ownerEmail=`syn-sub-browser-${ownerId}@example.invalid`;
 const hash=await hashMerchantPassword(password),providerSecret=credentials.keySecret;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES('${ownerId}','${ownerEmail}',true,'Synthetic Subscriber','${hash}');
 UPDATE sites SET custom_user_id='${ownerId}',legal_name=NULL,theme_id='letbuyy-core' WHERE id='${tenant.siteId}';`);
const profile={schema_version:1,policy_version:'D-SUB-TAX-INCLUSIVE-V1',profile_id:'synthetic-owned-only',profile_version:1,
 approval_status:'approved',approval_reference:'synthetic-approval-not-live',registration_status:'registered',supply_category:'domestic_taxable_saas',rate_bps:1800,
 supplier:{name:'Synthetic Platform Supplier',gstin:'27AAAAA0000A1Z5',state_code:'27',country:'IN',
 address:{line1:'Synthetic Supplier Address',city:'Mumbai',state:'Maharashtra',zip:'400001',country:'IN'}}};

 const identityPort=await freePort(),merchantPort=await freePort(),commercePort=await freePort(),commerceOrigin=`http://localhost:${commercePort}`,identityOrigin=`http://localhost:${identityPort}`,merchantOrigin=`http://localhost:${merchantPort}`;
 const tlsPort=await freePort(),checkoutOrigin=`https://checkout.localhost:${tlsPort}`;
 const visitorSigning=crypto.randomUUID()+crypto.randomUUID();
 const keys=await newIdentityKeys(),gateway=new Gateway(gatewayEnv(owned,keys,{LETBUYY_SUBSCRIPTION_TAX_PROFILE:JSON.stringify(profile),ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:'localhost',
  CHECKOUT_ORIGIN:checkoutOrigin,CHECKOUT_SIGNING_SECRET:crypto.randomUUID()+crypto.randomUUID(),
  PREVIEW_SIGNING_KEY:visitorSigning,STORE_ACCESS_SIGNING_KEY:visitorSigning,CUSTOMER_SESSION_SECRET:visitorSigning,
  LETBUYY_PAYMENT_MODE:'sandbox',LETBUYY_RAZORPAY_MODE:'sandbox',LETBUYY_MANAGED_PAYMENTS_MODE:'sandbox',PAYMENT_CONFIG_ENCRYPTION_KEY:crypto.randomUUID(),
  RAZORPAY_KEY_ID:credentials.keyId,RAZORPAY_KEY_SECRET:providerSecret}));
 const originalFetch=globalThis.fetch;
 let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined,commerce:OwnedClientProcess|undefined;
 let tls:HttpsServer|undefined;
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
  const cert=createOwnedCheckoutTlsCertificate(owned);
  tls=createHttpsServer({key:cert.key,cert:cert.cert},(req,res)=>{
   const host=req.headers.host||'';
   if(host!==`checkout.localhost:${tlsPort}`){res.writeHead(421);res.end();return;}
   const upstream=forwardHttpRequest({hostname:'127.0.0.1',port:commercePort,path:req.url,method:req.method,
    headers:{...req.headers,host,'x-forwarded-host':host,'x-forwarded-proto':'https'}},reply=>{res.writeHead(reply.statusCode||502,reply.headers);reply.pipe(res);});
   upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});req.on('aborted',()=>upstream.destroy());res.on('close',()=>upstream.destroy());req.pipe(upstream);
  });
  await new Promise<void>(r=>tls!.listen(tlsPort,'127.0.0.1',r));
  const shared={INTERNAL_API_SECRET:INTERNAL_SECRET,PREVIEW_SIGNING_KEY:visitorSigning,STORE_ACCESS_SIGNING_KEY:visitorSigning,CUSTOMER_SESSION_SECRET:visitorSigning,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
   NEXT_PUBLIC_TURNSTILE_SITE_KEY:['1x00000000000000000000','AA'].join(''),TURNSTILE_SECRET_KEY:['1x0000000000000000000000000000000','AA'].join(''),LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
  commerce=startOwnedClientRuntime(owned,'commerce-next-production',{port:commercePort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1',CHECKOUT_ORIGIN:checkoutOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:'localhost',NEXT_PUBLIC_STOREFRONT_URL:commerceOrigin,LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'}});
  for(const app of [identity,merchant,commerce])app.stderr.on('data',d=>errors.push(d.toString().slice(0,600)));
  await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant),ready(commerceOrigin+'/api/buyer-auth/session',commerce)]);
  const debugPort=await freePort();
  browser=await chromium.launch({headless:true,args:[`--ignore-certificate-errors-spki-list=${cert.spki}`,
    ...(process.env.LETBUYY_RAZORPAY_SANDBOX_DEBUG==='1'?[`--remote-debugging-port=${debugPort}`]:[])]});
  const context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(60_000);
  if(process.env.LETBUYY_RAZORPAY_SANDBOX_DEBUG==='1')writeFileSync('/private/tmp/letbuyy-managed-real-debug.json',JSON.stringify({runId:owned.runId,port:debugPort}),{mode:0o600});
  await signIn(page,identityOrigin,ownerEmail,password,merchantOrigin);
  const paymentSetup=page.locator(`a[href="/${tenant.subdomain}/settings/payments"]`).first();
  await expect(paymentSetup).toBeVisible();await paymentSetup.click();await page.waitForURL(u=>u.pathname===`/${tenant.subdomain}/settings/payments`);
  const [managedSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/payment-config')&&r.request().method()==='POST'),
    page.getByRole('button',{name:'Use LetBuyy test payments',exact:true}).click()]);
  assert.equal(managedSaved.status(),200,await managedSaved.text());
  await expect(page.getByRole('button',{name:'LetBuyy test payments connected',exact:true})).toBeDisabled();
  const [onlineEnabled]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/payment-config')&&r.request().method()==='PATCH'),
    page.getByRole('switch',{name:'Online payments',exact:true}).click()]);
  assert.equal(onlineEnabled.status(),200,await onlineEnabled.text());
  assert.equal(owned.psql(`SELECT payment_settings->>'mode' FROM sites WHERE id='${tenant.siteId}';`),'managedSandbox');
  await page.screenshot({path:`${ownedTmpDir()}/letbuyy-managed-settings-${owned.runId}.png`,fullPage:true});
  await page.goto(`${merchantOrigin}/${tenant.subdomain}/dashboard`);
  await expect(page.getByRole('link',{name:'View plans',exact:true})).toHaveAttribute('href',`/${tenant.subdomain}/access_account/checkout/select-plan`);
  await page.getByRole('link',{name:'View plans',exact:true}).click();
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
  await expect(page.getByRole('complementary',{name:'Order summary'})).toContainText('₹699');const subscribe=page.getByRole('button',{name:/Subscribe|Continue saved checkout|Continue to payment/});

  await page.getByLabel('Full name',{exact:true}).fill('Synthetic Razorpay Tester');
  await page.getByLabel('Phone number',{exact:true}).fill('9000000088');
  const [created]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/subscribe')&&r.request().method()==='POST'),subscribe.click()]);
  assert.equal(created.status(),200,'Actual sandbox order must be created by the normal billing endpoint');
  await completeRazorpayTestBank(page);
  await page.waitForURL(u=>u.pathname===`/${tenant.subdomain}/dashboard`,{timeout:90_000});
  assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE store_id='${tenant.siteId}' AND razorpay_payment_id IS NOT NULL;`),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE site_id='${tenant.siteId}' AND payment_status='paid';`),'1');
  console.info('REAL_RAZORPAY_SANDBOX_SUBSCRIPTION '+JSON.stringify({providerFixture:false,testMode:true,normalBrowser:true,subscriptionActivated:true}));

  const product=crypto.randomUUID(),zone=crypto.randomUUID(),rate=crypto.randomUUID(),cart=crypto.randomUUID(),token='ct_'+crypto.randomUUID().replaceAll('-','');
  owned.psql(`INSERT INTO products(id,store_id,name,price,sku,is_active) VALUES('${product}','${tenant.siteId}','Synthetic managed test product',1,'SYN-${product}',true);
   INSERT INTO inventory_levels(id,store_id,product_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity)
   VALUES(gen_random_uuid(),'${tenant.siteId}','${product}','${tenant.locationId}',25,0,0,25,0,25);
   INSERT INTO shipping_zones(id,store_id,site_id,name,countries,states,zip_codes,cod_enabled)
   VALUES('${zone}','${tenant.siteId}','${tenant.siteId}','Synthetic test delivery',ARRAY['IN'],ARRAY['Karnataka','29'],ARRAY['560001'],false);
   INSERT INTO shipping_rates(id,zone_id,site_id,name,type,price,is_active,cod_enabled)
   VALUES('${rate}','${zone}','${tenant.siteId}','Managed test delivery','flat',0,true,false);
   INSERT INTO carts(id,store_id,session_id,items,status,channel,expires_at)
   VALUES('${cart}','${tenant.siteId}','${token}',
    '[{"id":"${product}","product_id":"${product}","variant_id":null,"title":"Synthetic managed test product","sku":"SYN-${product}","quantity":1,"unit_price":1,"currency":"INR","properties":{},"line_total":1}]'::jsonb,'active','web',now()+interval '1 day');`);
  const buyer=await context.newPage(),storefrontOrigin=`http://${tenant.subdomain}.localhost:${commercePort}`;
  await buyer.addInitScript(({token,product,origin})=>{
   if(location.origin!==origin)return;
   localStorage.setItem('lb_cart_token',token);localStorage.setItem('lb_cart',JSON.stringify([
    {id:product,name:'Synthetic managed test product',price:1,currency:'INR',images:[],stock:25,quantity:1}]));
  },{token,product,origin:storefrontOrigin});
  await buyer.goto(storefrontOrigin+'/checkout');await buyer.waitForURL(/checkout\.localhost/);
  await buyer.getByPlaceholder('John Doe').fill('Synthetic Managed Buyer');
  await buyer.getByPlaceholder('9876543210').fill('9000000088');
  await buyer.getByPlaceholder('john@example.com').fill('synthetic-managed-buyer@example.invalid');
  await buyer.getByPlaceholder('House/Flat No, Street, Landmark...').fill('Synthetic Buyer Road');
  await buyer.getByPlaceholder('Bengaluru').fill('Bengaluru');await buyer.locator('select').first().selectOption('29');
  await buyer.getByPlaceholder('560001').fill('560001');
  await buyer.getByRole('button',{name:/Managed test delivery/}).click();
  await buyer.getByRole('button',{name:'Continue to Payment',exact:true}).click();
  await buyer.getByRole('radio',{name:/Pay Online \(Razorpay\)/}).check();
  await buyer.getByRole('button',{name:/Pay ₹/}).click();
  await completeRazorpayTestBank(buyer,'collection');
  await buyer.getByRole('heading',{name:'Order Confirmed!',exact:true}).waitFor({timeout:90_000});
  const order=JSON.parse(owned.psql(`SELECT json_build_object('id',id,'paid',payment_status,'total_minor',(total*100)::bigint) FROM orders WHERE store_id='${tenant.siteId}' AND customer_email='synthetic-managed-buyer@example.invalid';`));
  assert.equal(order.paid,'paid');assert.equal(Number(order.total_minor),100);
  assert.equal(owned.psql(`SELECT count(*) FROM payment_transactions WHERE order_id='${order.id}' AND status='captured';`),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${tenant.siteId}' AND source_type='payment_capture';`),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE store_id='${tenant.siteId}' AND aggregate_id='${order.id}' AND event_type='order.paid';`),'1');
  await buyer.screenshot({path:`/private/tmp/letbuyy-real-managed-collection-${owned.runId}.png`,fullPage:true});
  console.info('REAL_RAZORPAY_SANDBOX_COLLECTION '+JSON.stringify({providerFixture:false,testMode:true,normalBrowser:true,capturedMinor:100,paidOrders:1,captureJournals:1}));
 }catch(error){console.info('REAL_SANDBOX_FAILURE '+JSON.stringify({path:page?new URL(page.url()).pathname:null,calls:calls.slice(-12).map(({path,status})=>({path,status})),errors:errors.slice(-3)}));throw error;
 }finally{await browser?.close();if(tls?.listening)await new Promise<void>(r=>{tls!.close(()=>r());tls!.closeAllConnections();});await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await stopOwnedClientRuntime(commerce);await gateway.settle();globalThis.fetch=originalFetch;
  if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}}
});
