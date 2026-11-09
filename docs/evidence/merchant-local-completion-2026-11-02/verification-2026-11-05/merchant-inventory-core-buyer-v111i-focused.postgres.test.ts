// Source111 additional inventory acceptance; an explicitly labelled missing-level negative product is inserted only after the normal commerce journey.
// Labelled local fixtures: synthetic accounts and public Turnstile test keys only.
// No seeded user, session, verified email, password or store. Resend HTTP is captured;
// this is provider-fixture acceptance, not real inbox delivery or hosted cookie proof.
import {resolveCatalogDemoContent} from '../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch';
import {tmpdir} from 'node:os';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer,request as forwardHttpRequest,type Server} from 'node:http';
import {createServer as createHttpsServer,type Server as HttpsServer} from 'node:https';
import {NativeGateway} from '../../../../tests/helpers/native-owned-gateway';
import {DEFAULT_STOREFRONT_DOMAIN} from '@letbuyy/shared-types';
import {hashStoreAccessPassword} from '../../../../services/api-gateway/src/lib/store-access-password';
import {exportJWK} from 'jose';
import {chromium,expect,type Page} from '@playwright/test';
import {gatewayEnv,newIdentityKeys,INTERNAL_SECRET,signedIdentityHeaders} from '../../../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {expectBuyerHandoff} from '../../../../services/api-gateway/src/__tests__/owned-db/buyer-handoff-browser';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,startOwnedPooledSqlProxy,createOwnedCheckoutTlsCertificate,type OwnedClientProcess} from '../../../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {createLocalTurnstileProvider,LOCAL_TURNSTILE_SECRET} from '../../../../tests/fixtures/local-turnstile-provider';
const owned=requireOwnedDatabase();
async function freePort() {
    const s = createServer(); await new Promise<void>(r => s.listen(0,'127.0.0.1',r));
    const p = (s.address() as {port:number}).port; await new Promise<void>(r=>s.close(()=>r())); return p;
}
async function ready(origin:string, child:OwnedClientProcess, label:string) {
    const deadline = Date.now()+600_000;
    while(Date.now()<deadline) {
        if(child.exitCode!==null || child.signalCode!==null) throw new Error('Owned app stopped before readiness');
        try { if((await fetch(origin,{signal:AbortSignal.timeout(2000)})).status<500)return; } catch { /* owned build/start */ }
        await new Promise(r=>setTimeout(r,200));
    }
    throw new Error('Owned '+label+' production build did not become ready within the bounded cold-start allowance');
}

test('fresh merchant publishes frozen Core then actual zero and unknown stock remain distinct without unsafe cart writes',{timeout:1500_000},async()=>{
 const email=`syn-public-${crypto.randomUUID()}@example.invalid`,password=crypto.randomUUID()+String.fromCharCode(65,97,49,33);
 const subdomain='syn-signup-'+crypto.randomUUID().slice(0,8);
 assert.equal(owned.psql(`SELECT count(*) FROM users_custom WHERE email='${email}';`),'0');
 const identityPort=await freePort(),merchantPort=await freePort(),commercePort=await freePort();
 const identityOrigin=`http://localhost:${identityPort}`,merchantOrigin=`http://localhost:${merchantPort}`,commerceHttpOrigin=`http://localhost:${commercePort}`;
 const keys=await newIdentityKeys(),pooled=await startOwnedPooledSqlProxy(owned),visitorSigningKey=crypto.randomUUID()+crypto.randomUUID();
 const challenge=await createLocalTurnstileProvider(owned);
 const mail:{to:string[];subject:string;html:string;text:string}[]=[];let failFirstMail=true;
 const capture=async(request:Request)=>{assert.equal(new URL(request.url).pathname,'/emails');assert.equal(request.method,'POST');mail.push(await request.json() as typeof mail[number]);
  if(failFirstMail){failFirstMail=false;return new Response(JSON.stringify({name:'application_error',message:'Synthetic email transport unavailable'}),{status:503,headers:{'Content-Type':'application/json'}});}
  return new Response(JSON.stringify({id:'synthetic-mail-'+crypto.randomUUID()}),{status:200,headers:{'Content-Type':'application/json'}});};
 let gateway:NativeGateway|undefined,tls:HttpsServer|undefined,commerce:OwnedClientProcess|undefined,stage='build';console.info('OWNED_NATIVE_STAGE build');
 let commerceOrigin='',checkoutOrigin='',tlsSpki='',collectionListUnavailable=false,storeReadUnavailable=false,productReadUnavailable=false,legacyBootstrapResponse=false,unsupportedBootstrapResponse=false,unsupportedProjectionReplies=0,passwordVerifyUnavailable=false;
 let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined;
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined,buyerDiagnostic:Page|undefined;
 const calls:{path:string;status:number;key?:string;bytes:number;ms:number;navigationLocation?:string}[]=[],errors:string[]=[];
 try{
  bridge=createServer(async(req,res)=>{
   const began=performance.now(),requestUrl=new URL(req.url??'/', 'http://owned.test');
   if(storeReadUnavailable&&requestUrl.pathname===`/v1/storefront/${subdomain}`||productReadUnavailable&&requestUrl.pathname.startsWith(`/v1/storefront/${subdomain}/products/`)){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({success:false,error:{code:'SYNTHETIC_READ_OUTAGE',message:'Synthetic mandatory reader unavailable'}}));return;}
   if(passwordVerifyUnavailable&&requestUrl.pathname==='/v1/internal/store-access/verify'){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({success:false,error:{code:'SYNTHETIC_VERIFY_OUTAGE',message:'Synthetic password verifier unavailable'}}));return;}
   if(collectionListUnavailable && req.url?.split('?')[0]===`/v1/storefront/${subdomain}/collections`){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({success:false,error:{code:'SYNTHETIC_COLLECTION_OUTAGE',message:'Synthetic collection transport unavailable'}}));return;}
   const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks),headers=new Headers();
   for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   if(legacyBootstrapResponse&&requestUrl.pathname===`/v1/storefront/${subdomain}`)requestUrl.searchParams.delete('projection');
   try{const result=await gateway!.dispatch(requestUrl.pathname+requestUrl.search,{method:req.method,headers,...(body.length?{body}:{})});
    if(new URL(req.url??'/', 'http://owned.test').searchParams.has('search')){const data=await result.clone().json() as {data?:unknown[]};console.info('OWNED_SEARCH_RESPONSE '+JSON.stringify({status:result.status,count:Array.isArray(data.data)?data.data.length:null}));}let responseBytes=Buffer.from(await result.arrayBuffer());if(unsupportedBootstrapResponse&&result.ok&&requestUrl.pathname===`/v1/storefront/${subdomain}`){const payload=JSON.parse(responseBytes.toString());assert.ok(payload.data);payload.data.projection='synthetic-future-version';responseBytes=Buffer.from(JSON.stringify(payload));unsupportedProjectionReplies++;}calls.push({path:requestUrl.pathname,status:result.status,key:headers.get('X-Idempotency-Key')||undefined,bytes:responseBytes.length,ms:Math.round((performance.now()-began)*100)/100,...(requestUrl.pathname.endsWith('/navigation')?{navigationLocation:requestUrl.searchParams.get('location')??''}:{})});const replyHeaders=Object.fromEntries(result.headers.entries());if(unsupportedBootstrapResponse&&result.ok&&requestUrl.pathname===`/v1/storefront/${subdomain}`){delete replyHeaders['transfer-encoding'];replyHeaders['content-length']=String(responseBytes.length);}res.writeHead(result.status,replyHeaders);res.end(responseBytes);
   }catch{res.writeHead(500);res.end('{}');}
  });
  await new Promise<void>(r=>bridge!.listen(0,'127.0.0.1',r));const apiOrigin=`http://127.0.0.1:${(bridge.address() as {port:number}).port}`;
  const cert=createOwnedCheckoutTlsCertificate(owned);tlsSpki=cert.spki;
  tls=createHttpsServer({key:cert.key,cert:cert.cert},(req,res)=>{
   const host=req.headers.host||'',hostname=host.replace(/:\d+$/,'');
   const isApi=hostname==='api.localhost';
   if(!isApi&&hostname!=='checkout.localhost'&&hostname!==DEFAULT_STOREFRONT_DOMAIN&&hostname!==`${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`){res.writeHead(421);res.end();return;}
   const upstream=forwardHttpRequest({hostname:'127.0.0.1',port:isApi?Number(new URL(apiOrigin).port):commercePort,path:req.url,method:req.method,headers:{...req.headers,host,'x-forwarded-host':host,'x-forwarded-proto':'https'}},reply=>{res.writeHead(reply.statusCode||502,reply.headers);reply.pipe(res);});
   upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});req.on('aborted',()=>upstream.destroy());res.on('close',()=>upstream.destroy());req.pipe(upstream);
  });
  await new Promise<void>(r=>tls!.listen(0,'127.0.0.1',r));const tlsPort=(tls.address() as {port:number}).port;
  commerceOrigin=`https://${DEFAULT_STOREFRONT_DOMAIN}:${tlsPort}`;checkoutOrigin=`https://checkout.localhost:${tlsPort}`;
  const env={...gatewayEnv(owned,keys,{...pooled.env(),STORE_ACCESS_SIGNING_KEY:visitorSigningKey,PREVIEW_SIGNING_KEY:visitorSigningKey,ENVIRONMENT:'test',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:DEFAULT_STOREFRONT_DOMAIN,
   RESEND_API_KEY:'synthetic-owned-resend-capture',CHECKOUT_ORIGIN:checkoutOrigin,CHECKOUT_SIGNING_SECRET:crypto.randomUUID()+crypto.randomUUID(),UPLOAD_PUBLIC_BASE_URL:`https://api.localhost:${tlsPort}/assets`})};
  console.info('OWNED_SQL_PROTOCOL_TARGET '+JSON.stringify({binding:'HYPERDRIVE-shaped',origin:'owned PostgreSQL wire',managedHyperdrive:false}));
  gateway=await NativeGateway.create(env,capture);
  const shared={STORE_ACCESS_SIGNING_KEY:visitorSigningKey,PREVIEW_SIGNING_KEY:visitorSigningKey,CHECKOUT_ORIGIN:checkoutOrigin,NEXT_PUBLIC_STOREFRONT_URL:commerceOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:DEFAULT_STOREFRONT_DOMAIN,LETBUYY_INTERNAL_API_SECRET:INTERNAL_SECRET,INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,hostMode:'canonical-storefront-loopback',providerFixture:challenge.profile,env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
   NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:LOCAL_TURNSTILE_SECRET,LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,hostMode:'canonical-storefront-loopback',env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
  commerce=startOwnedClientRuntime(owned,'commerce-next-production',{port:commercePort,hostMode:'canonical-storefront-loopback',env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1',LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'}});
  for(const[label,app]of [['identity',identity],['merchant',merchant],['commerce',commerce]]as const){
   app.stderr.on('data',d=>errors.push(d.toString().slice(0,600)));
   // Production builds are distinct from serving latency. Retain only bounded
   // compiler-stage diagnostics; never dump runtime environment or bearer URLs.
   let stages=0;app.stdout.on('data',data=>{for(const line of data.toString().split('\n'))if(stages<20&&/Next\.js|Creating|Compiled|Collecting|Generating|Finalizing|Ready in|Starting|Failed to compile/.test(line)){stages++;console.info('OWNED_NATIVE_BUILD '+JSON.stringify({app:label,stage:line.replace(/https?:\/\/[^\s"<>]+/g,'[redacted-url]').slice(0,200)}));}});
  }
  await Promise.all([ready(identityOrigin+'/login',identity,'identity'),ready(merchantOrigin,merchant,'merchant'),ready(commerceHttpOrigin+'/api/buyer-auth/session',commerce,'commerce')]);
  browser=await chromium.launch({headless:true,args:[`--ignore-certificate-errors-spki-list=${tlsSpki}`,'--no-proxy-server',`--host-resolver-rules=MAP *.${DEFAULT_STOREFRONT_DOMAIN}:443 127.0.0.1:${tlsPort}, MAP *.${DEFAULT_STOREFRONT_DOMAIN} 127.0.0.1, MAP ${DEFAULT_STOREFRONT_DOMAIN} 127.0.0.1, MAP checkout.localhost 127.0.0.1, MAP api.localhost 127.0.0.1`]});
  const makeContext=async(javaScriptEnabled=true)=>{
   const context=await browser!.newContext({javaScriptEnabled});await challenge.attachBrowser(context,[identityOrigin,merchantOrigin,commerceHttpOrigin]);
   // The existing canonical-host resolver and TLS proxy above map only these
   // exact fixture origins to owned loopback. No remote provider/SDK is allowed.
   const localTlsOrigins=new Set([commerceOrigin,checkoutOrigin,`https://api.localhost:${tlsPort}`,`https://${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}:${tlsPort}`,`https://${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`]);
   await context.route(url=>localTlsOrigins.has(url.origin),route=>route.continue());return context;
  };
  const context=await makeContext();page=await context.newPage();page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(60_000);  stage='native-signup';console.info('OWNED_NATIVE_STAGE native-signup');const signup=await page.goto(identityOrigin+'/signup');assert.equal(signup?.status(),200);
  const signupCopy=await page.locator('body').innerText();
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:30_000});
  await page.getByLabel('Email',{exact:true}).fill(email);
  const [unavailable]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/signup'&&r.request().method()==='POST'),page.getByRole('button',{name:'Continue',exact:true}).click()]);
  assert.equal(unavailable.status(),500,'provider failure must not be reported as successful delivery');
  assert.equal(owned.psql(`SELECT count(*) FROM users_custom WHERE email='${email}' AND email_verified=false AND password_hash IS NULL;`),'1');
  await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeEnabled();
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/);
  const [registered]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/signup'&&r.request().method()==='POST'),page.getByRole('button',{name:'Continue',exact:true}).click()]);
  assert.equal(registered.status(),200);const payload=await registered.json();assert.equal(Object.hasOwn(payload,'devOtp'),false);assert.equal(payload.needsVerification,true);
  assert.equal(mail.length,2,'failed delivery then retry must use the actual provider adapter');assert.deepEqual([mail[1].to].flat(),[email]);
  assert.equal(mail[1].subject,'Your LetBuyy verification code');
  const otp=mail[1].text.match(/Your verification code is (\d{6})\./)?.[1];assert.ok(otp,'OTP must come from the captured email body');
  assert.match(mail[1].html,new RegExp('>'+otp+'</p>'),'the branded HTML carries the same delivered code');
  assert.equal(owned.psql(`SELECT email_verified FROM users_custom WHERE email='${email}';`),'f');
  async function authPost(path:string,body:Record<string,string>){return page!.evaluate(async({path,body})=>{
   const token=document.cookie.split('; ').find(v=>v.startsWith('letbuyy_csrf=')||v.startsWith('lb_csrf='))?.split('=').slice(1).join('=')||'';
   return (await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':decodeURIComponent(token)},body:JSON.stringify(body)})).status;
  },{path,body});}
  assert.equal(await authPost('/api/auth/set-password',{password,email,userId:crypto.randomUUID()}),403,'a caller-supplied identity cannot replace verified intent');
  async function enterOtp(code:string){await page!.getByLabel('Email verification code',{exact:true}).fill(code);await page!.getByRole('button',{name:'Verify',exact:true}).click();}
  // The current shared code input supports paste/autofill and explicit verification.
  const wrongReply=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/verify-otp'&&r.request().method()==='POST');
  await enterOtp(otp==='000000'?'111111':'000000');
  assert.equal((await wrongReply).status(),400);assert.equal(owned.psql(`SELECT email_verified FROM users_custom WHERE email='${email}';`),'f');
  await expect(page.getByLabel('Email verification code',{exact:true})).toHaveValue('');
  const validReply=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/verify-otp'&&r.request().method()==='POST');
  await enterOtp(otp);assert.equal((await validReply).status(),200);
  await page.getByLabel('Password',{exact:true}).fill(password);await page.getByLabel('Confirm password',{exact:true}).fill(password);
  const [secured]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/set-password'&&r.request().method()==='POST'),page.getByRole('button',{name:'Create account',exact:true}).click()]);assert.equal(secured.status(),200);
  await page.waitForURL(u=>u.pathname==='/onboarding');
  assert.equal(await authPost('/api/auth/verify-otp',{email,otp}),400,'successful OTP is single-use');
  assert.equal(await authPost('/api/auth/set-password',{password,email}),403,'successful password intent is single-use');
  stage='native-onboarding';console.info('OWNED_NATIVE_STAGE native-onboarding');await page.getByRole('button',{name:/Online Store/}).click();await page.getByLabel('Display Name',{exact:true}).fill('Synthetic Public Store');
  await page.getByLabel('Subdomain',{exact:true}).fill(subdomain);await expect(page.getByRole('button',{name:'Next',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByLabel('Industry',{exact:true}).selectOption('food');
  const [created]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/create-store'&&r.request().method()==='POST'),page.getByRole('button',{name:'Create My Site',exact:true}).click()]);assert.equal(created.status(),200);
  await page.waitForURL(u=>u.origin===merchantOrigin&&u.pathname===`/${subdomain}/access_account/checkout/select-plan`,{timeout:60_000});await expect(page.getByRole('region',{name:'Available plans'})).toBeVisible();
  const store=JSON.parse(owned.psql(`SELECT jsonb_build_object('count',count(*),'trial_days',max(EXTRACT(EPOCH FROM (trial_ends_at-trial_started_at))/86400),'theme',max(theme_id),'status',max(status))::text FROM sites WHERE custom_user_id=(SELECT id FROM users_custom WHERE email='${email}') AND subdomain='${subdomain}';`));assert.equal(store.count,1);assert.equal(store.trial_days,14,'existing persisted trial policy is preserved');assert.equal(store.status,'draft');
  await page.goto(`${merchantOrigin}/${subdomain}/dashboard`);await expect(page.getByRole('heading',{level:1,name:/Synthetic Public Store/})).toBeVisible();
  await expect(page.getByRole('complementary',{name:'Storefront publication status'})).toContainText('Draft — not visible to visitors');
  const siteId=owned.psql(`SELECT id FROM sites WHERE subdomain='${subdomain}';`),productName='Synthetic Native Variant Product';
  assert.equal(store.theme,'letbuyy-forge','Circuit remains the approved new-store default');
  assert.equal(owned.psql(`SELECT template_config->'liquidBundle'->'package'->>'slug' FROM sites WHERE id='${siteId}';`),'letbuyy-forge');
  await expect(page.locator('body')).toContainText(`${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`);
  stage='product-create';console.info('OWNED_NATIVE_STAGE product-create');await page.goto(`${merchantOrigin}/${subdomain}/products/new`);
  await page.getByLabel('Title',{exact:true}).fill(productName);await page.getByLabel('Price',{exact:true}).fill('199');await page.getByLabel('Quantity',{exact:true}).fill('0');await page.getByLabel('Product status',{exact:true}).selectOption('active');
  const png=readFileSync(new URL('../../../../tests/fixtures/week1-synthetic-product.png',import.meta.url));
  const uploaded=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/upload')&&r.request().method()==='POST');
  await page.locator('input[type="file"]').setInputFiles({name:'synthetic-core-product.png',mimeType:'image/png',buffer:png});
  const upload=await uploaded;assert.equal(upload.status(),201);const imageUrl=(await upload.json()).data.url;
  await expect(page.locator(`img[src="${imageUrl}"]`)).toBeVisible();await expect.poll(()=>page!.locator(`img[src="${imageUrl}"]`).evaluate(n=>(n as HTMLImageElement).naturalWidth)).toBe(320);
  const raw=await gateway.dispatch(new URL(imageUrl).pathname,{method:'GET'});assert.equal(raw.status,200);assert.deepEqual(Buffer.from(await raw.arrayBuffer()),png);
  await page.getByRole('button',{name:'Add option',exact:true}).click();await page.getByPlaceholder('Option name (Size, Color, Material)').fill('Size');await page.getByRole('button',{name:'Done',exact:true}).click();
  for(const value of ['Small','Large']){await page.getByPlaceholder('Add value',{exact:true}).fill(value);await page.getByRole('button',{name:'Add value',exact:true}).click();}
  for(const [title,price,stock]of [['Small','199','3'],['Large','249','4']]){await page.getByLabel(`Price for ${title}`,{exact:true}).fill(price);await page.getByLabel(`Stock for ${title}`,{exact:true}).fill(stock);await page.getByLabel(`SKU for ${title}`,{exact:true}).fill('SYN-CORE-'+title);}
  console.info('NATIVE_PRODUCT_SAVE_ACTIONS '+JSON.stringify(await page.getByRole('button').evaluateAll(nodes=>nodes.filter(n=>/^(Save product|Create product)$/.test(n.textContent?.trim()||'')).map(n=>({text:n.textContent,disabled:(n as HTMLButtonElement).disabled,visible:!!n.getClientRects().length})))));
  const [saved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/products')&&r.request().method()==='POST'),page.getByRole('button',{name:'Create product',exact:true}).click()]);assert.equal(saved.status(),201);
  const productId=owned.psql(`SELECT id FROM products WHERE store_id='${siteId}' AND name='${productName}';`);assert.match(productId,/^[a-f0-9-]{36}$/);assert.equal(owned.psql(`SELECT count(*) FROM product_variants WHERE product_id='${productId}';`),'2');
  await page.goto(`${merchantOrigin}/${subdomain}/products/${productId}`);await expect(page.getByLabel('Title',{exact:true})).toHaveValue(productName);await expect(page.getByLabel('Stock for Small',{exact:true})).toHaveValue('3');
  stage='merchant-manual-collection';console.info('OWNED_NATIVE_STAGE merchant-manual-collection');const collectionTitle='Synthetic Native Collection';
  await page.goto(`${merchantOrigin}/${subdomain}/products/collections`);await page.getByRole('button',{name:'New collection',exact:true}).click();await page.getByLabel('Collection title',{exact:true}).fill(collectionTitle);
  const [collectionCreated]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/collections')&&r.request().method()==='POST'),page.locator('section').filter({has:page.getByRole('heading',{name:'Create collection',exact:true})}).getByRole('button',{name:'Create collection',exact:true}).click()]);assert.equal(collectionCreated.status(),201);
  const collectionId=owned.psql(`SELECT id FROM collections WHERE store_id='${siteId}' AND title='${collectionTitle}';`);assert.match(collectionId,/^[a-f0-9-]{36}$/);
  await page.getByRole('row').filter({hasText:collectionTitle}).getByRole('button',{name:'Manage products',exact:true}).click();await page.getByRole('checkbox',{name:productName,exact:true}).check();
  const [membersSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith(`/collections/${collectionId}/products`)&&r.request().method()==='PUT'),page.getByRole('button',{name:'Save products',exact:true}).click()]);assert.equal(membersSaved.status(),200);
  assert.equal(owned.psql(`SELECT count(*) FROM collection_products WHERE collection_id='${collectionId}' AND product_id='${productId}';`),'1');
  await page.goto(`${merchantOrigin}/${subdomain}/products/collections`);
  for(let index=1;index<=25;index++){
   const title='ZZZ Synthetic Browse '+String(index).padStart(2,'0');await page.getByRole('button',{name:'New collection',exact:true}).click();const createPanel=page.locator('section').filter({has:page.getByRole('heading',{name:'Create collection',exact:true})});await createPanel.getByLabel('Collection title',{exact:true}).fill(title);
   const [createdExtra]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/collections')&&r.request().method()==='POST'),createPanel.getByRole('button',{name:'Create collection',exact:true}).click()]);assert.equal(createdExtra.status(),201);
   await expect(createPanel).toHaveCount(0);
  }
  assert.equal(owned.psql(`SELECT count(*) FROM collections WHERE store_id='${siteId}' AND is_active AND deleted_at IS NULL;`),'26','all pagination collections were created by normal merchant UI');
  stage='native-search-index-scheduler';console.info('OWNED_NATIVE_STAGE native-search-index-scheduler');
  assert.ok(Number(owned.psql(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${productId}' AND event_type IN('product.created','product.updated');`))>0,'normal product commands produced durable events');
  await gateway.runScheduled();
  assert.equal(owned.psql(`SELECT count(*) FROM search_documents WHERE site_id='${siteId}' AND object_type='product' AND object_id='${productId}' AND status='active' AND deleted_at IS NULL;`),'1','actual scheduler indexed the real merchant product');
  assert.ok(Number(owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE site_id='${siteId}' AND queue_name='search-indexing' AND status='succeeded';`))>0,'nonzero search queue work completed');
  stage='shipping-config';console.info('OWNED_NATIVE_STAGE shipping-config');await page.goto(`${merchantOrigin}/${subdomain}/settings/shipping`);await page.getByRole('button',{name:'Add zone',exact:true}).first().click();await page.getByLabel('Zone name',{exact:true}).fill('Synthetic native zone');
  await expect(page.getByLabel('Countries',{exact:true})).toHaveValue('India');
  await expect(page.getByLabel('Countries',{exact:true})).toBeDisabled();
  const [zoneSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/shipping/zones')&&r.request().method()==='POST'),page.getByRole('button',{name:'Add zone',exact:true}).last().click()]);assert.equal(zoneSaved.status(),200,'the existing Merchant zone boundary returns its successful JSON envelope');
  assert.equal(owned.psql(`SELECT countries::text FROM shipping_zones WHERE store_id='${siteId}' AND name='Synthetic native zone' AND deleted_at IS NULL;`),'{India}','normal zone creation retains the supported India coverage');
  await page.getByRole('button',{name:'Add rate',exact:true}).click();await page.getByLabel('Rate name',{exact:true}).fill('Synthetic native delivery');await page.getByLabel('Price (₹, 0 for free)',{exact:true}).fill('20');
  const [rateSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/shipping/rates')&&r.request().method()==='POST'),page.getByRole('button',{name:'Add rate',exact:true}).last().click()]);assert.equal(rateSaved.status(),201);
  stage='merged-theme-workspace';console.info('OWNED_NATIVE_STAGE merged-theme-workspace');await page.goto(`${merchantOrigin}/${subdomain}/online-store/themes`);
  await expect(page.getByRole('region',{name:'Discover themes',exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Discover themes',exact:true}).locator('article[aria-label$=" theme"]')).toHaveCount(5);
  // This journey qualifies the retained Core compatibility package, not the
  // new-store default. Grant only a labelled synthetic upload entitlement and
  // install the real bundle through the normal file input; no store/theme SQL seed.
  const rawInventoryPreflight=crypto.randomUUID();
  owned.psql(`BEGIN;INSERT INTO products(id,store_id,name,price,stock,is_active,status)VALUES('${rawInventoryPreflight}','${siteId}','Synthetic inventory fault preflight',125,99,true,'active');DO $check$BEGIN IF(SELECT catalog_available_quantity(p)FROM products p WHERE p.id='${rawInventoryPreflight}')IS NOT NULL THEN RAISE EXCEPTION 'Synthetic missing inventory did not remain unknown';END IF;END$check$;ROLLBACK;`);
  const syntheticUploadSubscription=crypto.randomUUID();
  owned.psql(`INSERT INTO subscriptions(id,user_id,store_id,plan,status) VALUES('${syntheticUploadSubscription}',(SELECT id FROM users_custom WHERE email='${email}'),'${siteId}','enterprise','active');`);
  // Qualify the eventual exact-row withdrawal before the long browser journey.
  // Rollback preserves this explicit upload fixture for the theme checks.
  owned.psql(`BEGIN;DELETE FROM subscriptions WHERE id='${syntheticUploadSubscription}'AND store_id='${siteId}';DO $check$DECLARE e jsonb;BEGIN e:=resolve_site_entitlements('${siteId}');IF e->>'plan'IS DISTINCT FROM 'launch'OR NOT(e->'limits'?'products')OR(e#>'{limits,products}'<>'null'::jsonb AND coalesce((e#>>'{limits,products}')::numeric,0)<=1) THEN RAISE EXCEPTION 'Synthetic upload fixture cannot restore persisted Launch trial';END IF;END$check$;ROLLBACK;`);

  const coreBundle=owned.psql(`SELECT (default_template->'liquidBundle')::text FROM themes WHERE slug='letbuyy-core';`);
  const [coreImport]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/themes/install'&&r.request().method()==='POST'),page.locator('input[type="file"][accept*="json"]').setInputFiles({name:'owned-core-compatibility.json',mimeType:'application/json',buffer:Buffer.from(coreBundle)})]);
  assert.equal(coreImport.status(),200);const coreSlug=(await coreImport.json()).uploaded.theme.slug as string;
  assert.ok(coreSlug.startsWith('private-'+siteId+'-'));
  assert.equal(owned.psql(`SELECT theme_id FROM sites WHERE id='${siteId}';`),'letbuyy-forge','import cannot replace the live design');
  await page.goto(`${merchantOrigin}/${subdomain}/online-store/themes/${coreSlug}/editor`);
  stage='core-editor-publish';console.info('OWNED_NATIVE_STAGE core-editor-publish');await expect(page.getByRole('tree',{name:'Theme sections',exact:true})).toBeVisible();
  await page.getByRole('tree',{name:'Theme sections',exact:true}).getByRole('treeitem').filter({hasText:/Hero/}).first().click();const marker='Synthetic Native Core Ready';
  const draftReply=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/editor/draft')&&r.request().method()==='POST'&&Boolean(r.request().postData()?.includes(marker)));await page.getByLabel('Heading',{exact:true}).fill(marker);assert.equal((await draftReply).status(),200);
  await expect(page.frameLocator('iframe.te-preview-iframe').locator('[data-letbuyy-preview-route="true"]')).toBeVisible({timeout:90_000});
  const previewSrc=await page.locator('iframe.te-preview-iframe').getAttribute('src');assert.ok(previewSrc);
  const capability=new URL(previewSrc,merchantOrigin).searchParams.get('theme_preview_token');assert.ok(capability);
  const previewCollectionsPath=`/v1/storefront/${subdomain}/theme-preview?resource=collections&token=`;
  const privateCollections=await gateway.dispatch(previewCollectionsPath+encodeURIComponent(capability),{});assert.equal(privateCollections.status,200);assert.equal(privateCollections.headers.get('cache-control'),'private, no-store');
  const privateBody=await privateCollections.json() as {data:{id:string}[]};assert.equal(privateBody.data.length,24);assert.ok(privateBody.data.some(c=>c.id===collectionId));
  assert.equal((await gateway.dispatch(previewCollectionsPath+'synthetic-invalid-capability',{})).status,404);
  const privateBrowse=await gateway.dispatch(previewCollectionsPath+encodeURIComponent(capability)+'&browse=1',{});assert.equal(privateBrowse.status,200);
  const privatePage=await privateBrowse.json() as {data:{items:{id:string}[];nextCursor:string}};assert.equal(privatePage.data.items.length,24);assert.ok(privatePage.data.nextCursor);
  const privateNext=await gateway.dispatch(previewCollectionsPath+encodeURIComponent(capability)+'&browse=1&after='+privatePage.data.nextCursor,{});assert.equal(privateNext.status,200);assert.equal(((await privateNext.json()) as {data:{items:unknown[]}}).data.items.length,2);

  assert.equal((await gateway.dispatch(`/v1/storefront/${subdomain}/collections`,{})).status,404,'draft collections are never public');
  assert.equal(owned.psql(`SELECT published FROM sites WHERE id='${siteId}';`),'f','the owner preview does not open the public store');
  const draftContext=await makeContext(),draftVisitor=await draftContext.newPage();const draftResponse=await draftVisitor.goto(`https://${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}:${tlsPort}`);assert.equal(draftResponse?.status(),401);await draftContext.close();
  await expect(page.frameLocator('iframe.te-preview-iframe').locator('[data-letbuyy-preview-route="true"]')).toContainText(marker,{timeout:30_000});await expect(page.frameLocator('iframe.te-preview-iframe').getByText('Discover our latest products.',{exact:true})).toBeVisible();await expect(page.frameLocator('iframe.te-preview-iframe').getByText('Free shipping on fresh drops this week.',{exact:true})).toHaveCount(0);await expect(page.locator('.te-preview-url')).toHaveText(`${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`);
  const previewFrame=page.frameLocator('iframe.te-preview-iframe'),editorViewportMeasurements=[];
  for(const [device,expectedWidth] of [['Desktop',1440],['Tablet',820],['Mobile',390],['Desktop',1440]] as const){
   await page.getByRole('group',{name:'Preview device',exact:true}).getByRole('button',{name:device,exact:true}).click();
   await expect(previewFrame.locator('[data-theme-renderer="liquid"][data-editor-mode="true"]')).toBeVisible();
   await expect.poll(()=>previewFrame.locator('body').evaluate(()=>window.innerWidth)).toBe(expectedWidth);
   await expect(previewFrame.locator('.lb-header')).toHaveCount(1);await expect(previewFrame.locator('.lb-footer')).toHaveCount(1);
   await expect(previewFrame.getByRole('heading',{name:marker,exact:true})).toBeVisible();
   assert.equal(await previewFrame.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+1),true);
   const measured=await page.locator('iframe.te-preview-iframe').evaluate(el=>({displayWidth:el.getBoundingClientRect().width,cssWidth:getComputedStyle(el).width,transform:getComputedStyle(el).transform}));editorViewportMeasurements.push({device,expectedWidth,...measured});
  }
  const previewPrimary=await previewFrame.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--primary').trim());
  console.info('OWNED_CORE_PREVIEW_VIEWPORTS '+JSON.stringify({actualLiquid:true,singleHeaderFooter:true,editorViewportMeasurements}));
  const screenshot=`${tmpdir()}/letbuyy-native-core-${owned.runId}.png`;await page.screenshot({path:screenshot,fullPage:true});
  await expect(page.getByRole('button',{name:'Save',exact:true}).first()).toBeDisabled();const [published]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===`/api/themes/${coreSlug}/editor`&&r.request().method()==='PUT'),page.getByRole('button',{name:'Publish',exact:true}).click()]);assert.equal(published.status(),200);
  assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${siteId}';`),'published');
  stage='public-tenant-storefront';console.info('OWNED_NATIVE_STAGE public-tenant-storefront');const buyerContext=await makeContext(),buyer=await buyerContext.newPage();buyerDiagnostic=buyer;buyer.setDefaultTimeout(30_000);buyer.setDefaultNavigationTimeout(60_000);
  const tenantOrigin=`https://${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}:${tlsPort}`;
  // The real buyer contract pins non-local callbacks to canonical HTTPS443;
  // Chromium maps that exact owned host to this fixture's TLS listener.
  const tenantCallbackOrigin=`https://${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`;
  const home=await buyer.goto(tenantOrigin);assert.equal(home?.status(),200);await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]')).toBeVisible();await expect(buyer.getByRole('heading',{level:1}).first()).toHaveText(marker);await expect(buyer.getByText('Discover our latest products.',{exact:true})).toBeVisible();await expect(buyer.getByText('Free shipping on fresh drops this week.',{exact:true})).toHaveCount(0);
  assert.equal(await buyer.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--primary').trim()),previewPrimary,'private and published Core use the same resolved primary token');
  const publicScreenshot=`${tmpdir()}/letbuyy-native-core-store-${owned.runId}.png`;await buyer.screenshot({path:publicScreenshot,fullPage:true});
  stage='buyer-positive-inventory';console.info('OWNED_NATIVE_STAGE buyer-positive-inventory');
  assert.equal(owned.psql(`SELECT stock FROM products WHERE id='${productId}'`),'0','normal variant creation preserves base edit quantity');
  const publicProduct=await gateway.dispatch(`/v1/storefront/${subdomain}/products/${productId}`,{method:'GET'});assert.equal(publicProduct.status,200);const publicProjection=(await publicProduct.json()).data;
  assert.equal(publicProjection.stock,0);assert.equal(publicProjection.catalog_available_quantity,7);
  await buyer.goto(`${tenantOrigin}/product/${productId}`);await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]')).toBeVisible();
  const offerFrom=async(target:Page)=>target.locator('script[type="application/ld+json"]').evaluateAll(nodes=>nodes.flatMap(n=>{try{const v=JSON.parse(n.textContent||'null');return Array.isArray(v)?v:[v];}catch{return[];}}).find(v=>v?.['@type']==='Product')?.offers);
  assert.equal((await offerFrom(buyer)).availability,'https://schema.org/InStock');
  await buyer.waitForFunction(()=>Boolean(customElements.get('lb-variant-picker')));await buyer.getByRole('button',{name:'Small',exact:true}).click();await expect(buyer.getByRole('button',{name:'Buy now',exact:true})).toBeEnabled();
  await buyer.goto(tenantOrigin);
  await buyerContext.close();
  stage='buyer-zero-unknown-inventory';console.info('OWNED_NATIVE_STAGE buyer-zero-unknown-inventory');
  // Retire only this fixture's explicit upload grant after all theme operations.
  // It is not a paid subscription or a product quota grant. Restore saved trial.
  assert.equal(owned.psql(`WITH removed AS(DELETE FROM subscriptions WHERE id='${syntheticUploadSubscription}'AND store_id='${siteId}'AND plan='enterprise'RETURNING id)SELECT id FROM removed`),syntheticUploadSubscription);
  const restoredTrial=JSON.parse(owned.psql(`SELECT resolve_site_entitlements('${siteId}')`));assert.equal(restoredTrial.plan,'launch');assert.ok(Object.hasOwn(restoredTrial.limits,'products'));assert.ok(restoredTrial.limits.products===null||Number(restoredTrial.limits.products)>1);
  const ownerForInventory=owned.psql(`SELECT custom_user_id FROM sites WHERE id='${siteId}'`);
  const zeroCreated=await gateway.dispatch('/v1/products',{method:'POST',headers:{...await signedIdentityHeaders(ownerForInventory,email,siteId),'X-Store-ID':siteId,'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({store_id:siteId,name:'Synthetic confirmed zero inventory',price:125,stock:0,images:[],is_active:true,status:'active'})});assert.equal(zeroCreated.status,201,await zeroCreated.clone().text());const zeroId=(await zeroCreated.json()).data.id;
  // Explicit negative fault only: this extra synthetic product deliberately has
  // no authoritative inventory row. Main signup/store/product remain unseeded.
  const unknownId=crypto.randomUUID();owned.psql(`INSERT INTO products(id,store_id,name,price,stock,is_active,status)VALUES('${unknownId}','${siteId}','Synthetic unknown inventory fault',125,99,true,'active')`);
  const unknownPublic=await gateway.dispatch(`/v1/storefront/${subdomain}/products/${unknownId}`,{method:'GET'});assert.equal(unknownPublic.status,200);const unknownProjection=(await unknownPublic.json()).data;assert.equal(unknownProjection.stock,99);assert.equal(unknownProjection.catalog_available_quantity,null);
  const inventoryProofs=[];
  for(const [id,label,availability]of [[zeroId,'zero','https://schema.org/OutOfStock'],[unknownId,'unknown',undefined]] as const){
   const noJs=await makeContext(false),ssr=await noJs.newPage();buyerDiagnostic=ssr;await ssr.goto(`${tenantOrigin}/product/${id}`);await expect(ssr.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]')).toBeVisible();
   await expect(ssr.locator('.lb-product-detail [data-lb-add-to-cart]')).toBeDisabled();await expect(ssr.locator('.lb-product-detail [data-lb-add-to-cart]')).toHaveText(label==='unknown'?'Stock unavailable':'Sold out');await expect(ssr.getByRole('button',{name:'Buy now',exact:true})).toBeDisabled();
   const offer=await offerFrom(ssr);assert.ok(offer);assert.equal(offer.availability,availability);if(label==='unknown')assert.equal(Object.hasOwn(offer,'availability'),false);
   const screenshot=`${tmpdir()}/letbuyy-buyer-inventory-${owned.runId}-${label}.png`;await ssr.screenshot({path:screenshot,fullPage:true});
   await noJs.close();
   const hydrated=await makeContext(),ip=await hydrated.newPage();buyerDiagnostic=ip;let mutations=0;ip.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'&&(/\/cart(?:\/|$)/.test(u.pathname)||u.pathname==='/api/checkout-handoff'))mutations++;});
   await ip.goto(`${tenantOrigin}/product/${id}`);await ip.waitForFunction(()=>Boolean(customElements.get('lb-add-to-cart')));await expect(ip.locator('.lb-product-detail [data-lb-add-to-cart]')).toBeDisabled();
   if(label==='unknown'){
    await expect(ip.locator('.lb-product-detail lb-add-to-cart')).toHaveAttribute('data-inventory-known','false');
    await ip.locator('.lb-product-detail [data-lb-add-to-cart]').evaluate(button=>{(button as HTMLButtonElement).disabled=false;(button as HTMLButtonElement).click();});await ip.waitForTimeout(50);await expect(ip.locator('.lb-product-detail [data-lb-add-to-cart-status]')).toHaveText('Product unavailable');
    assert.equal(mutations,0);assert.equal(await ip.evaluate(()=>localStorage.getItem('lb_cart')),null);
    await ip.goto(`${tenantOrigin}/products?search=Synthetic%20unknown%20inventory%20fault`);const cards=ip.locator(`.lb-product-card`).filter({has:ip.locator(`lb-add-to-cart[data-product-id="${unknownId}"]`)});const cardCount=await cards.count();assert.ok(cardCount>0);assert.ok(await cards.filter({visible:true}).count()>0);for(let index=0;index<cardCount;index++){const card=cards.nth(index);await expect(card.locator('[data-lb-add-to-cart]')).toBeDisabled();await expect(card.locator('[data-lb-add-to-cart]')).toHaveText('Stock unavailable');await expect(card).not.toContainText('Sold out');}
   }
   inventoryProofs.push({label,serverRendered:true,javaScriptDisabledVerified:true,hydrationVerified:true,offerAvailability:availability??'omitted',unknownCartWrites:mutations,screenshot});await hydrated.close();
  }
  console.info('OWNED_BUYER_INVENTORY '+JSON.stringify({run_id:owned.runId,baseEditQuantity:0,liveVariantQuantity:7,positiveLiquidAndOffer:true,positiveVariantSelection:true,immutableInstalledTheme:true,syntheticUploadGrantWithdrawn:true,persistedLaunchTrialRestored:true,inventoryProofs,providerFixtureOnly:true}));
 }catch(error){console.info('OWNED_NATIVE_CORE_UI_FAILURE '+JSON.stringify({stage,alerts:page?await page.locator('[role=alert]').allTextContents():[],invalid:page?await page.locator(':invalid').evaluateAll(nodes=>nodes.map(node=>({tag:node.tagName,id:node.id,name:node.getAttribute('name'),message:(node as HTMLInputElement).validationMessage}))):[]}));console.info('OWNED_NATIVE_CORE_FAILURE '+JSON.stringify({stage,path:page?new URL(page.url()).pathname:null,buyer:buyerDiagnostic?{host:new URL(buyerDiagnostic.url()).host,path:new URL(buyerDiagnostic.url()).pathname}:null,storeState:owned.psql(`SELECT coalesce(jsonb_agg(jsonb_build_object('status',status,'published',published,'accessMode',access_mode,'theme',theme_id))::text,'[]') FROM sites WHERE subdomain='${subdomain}';`),calls:calls.slice(-15).map(({path,status})=>({path:path.replace(/ct_[A-Za-z0-9_-]+/g,'[redacted-cart-token]'),status})),errors:errors.slice(-3).map(s=>s.replace(/https?:\/\/[^\s"<>]+/g,'[redacted-url]'))}));throw new Error((error instanceof Error?error.message:String(error)).replace(/https?:\/\/[^\s"<>]+/g,'[redacted-url]'));
 }finally{console.info('OWNED_NATIVE_LOCAL_CHALLENGE '+JSON.stringify(challenge.counts));await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await stopOwnedClientRuntime(commerce);await gateway?.settle();await pooled.stop();if(tls){tls.closeAllConnections();await new Promise<void>(r=>tls!.close(()=>r()));}if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}await challenge.close();}
});
