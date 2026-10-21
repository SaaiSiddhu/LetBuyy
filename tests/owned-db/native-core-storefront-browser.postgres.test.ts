// Labelled local fixtures: synthetic accounts and public Turnstile test keys only.
// No seeded user, session, verified email, password or store. Resend HTTP is captured;
// this is provider-fixture acceptance, not real inbox delivery or hosted cookie proof.
import {tmpdir} from 'node:os';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer,request as forwardHttpRequest,type Server} from 'node:http';
import {createServer as createHttpsServer,type Server as HttpsServer} from 'node:https';
import {NativeGateway} from '../helpers/native-owned-gateway';
import {DEFAULT_STOREFRONT_DOMAIN} from '@letbuyy/shared-types';
import {exportJWK} from 'jose';
import {chromium,expect,type Page} from '@playwright/test';
import {gatewayEnv,newIdentityKeys,INTERNAL_SECRET} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,startOwnedPooledSqlProxy,createOwnedCheckoutTlsCertificate,type OwnedClientProcess} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
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

test('fresh merchant builds and publishes Core Liquid then a customer orders a real variant',{timeout:1000_000},async()=>{
 const email=`syn-public-${crypto.randomUUID()}@example.invalid`,password='Synthetic-Public-Signup-42!';
 const subdomain='syn-signup-'+crypto.randomUUID().slice(0,8);
 assert.equal(owned.psql(`SELECT count(*) FROM users_custom WHERE email='${email}';`),'0');
 const identityPort=await freePort(),merchantPort=await freePort(),commercePort=await freePort();
 const identityOrigin=`http://localhost:${identityPort}`,merchantOrigin=`http://localhost:${merchantPort}`,commerceHttpOrigin=`http://localhost:${commercePort}`;
 const keys=await newIdentityKeys(),pooled=await startOwnedPooledSqlProxy(owned);
 const mail:{to:string[];subject:string;html:string}[]=[];let failFirstMail=true;
 const capture=async(request:Request)=>{assert.equal(new URL(request.url).pathname,'/emails');assert.equal(request.method,'POST');mail.push(await request.json() as typeof mail[number]);
  if(failFirstMail){failFirstMail=false;return new Response(JSON.stringify({name:'application_error',message:'Synthetic email transport unavailable'}),{status:503,headers:{'Content-Type':'application/json'}});}
  return new Response(JSON.stringify({id:'synthetic-mail-'+crypto.randomUUID()}),{status:200,headers:{'Content-Type':'application/json'}});};
 let gateway:NativeGateway|undefined,tls:HttpsServer|undefined,commerce:OwnedClientProcess|undefined,stage='build';console.info('OWNED_NATIVE_STAGE build');
 let commerceOrigin='',checkoutOrigin='',tlsSpki='',collectionListUnavailable=false,storeReadUnavailable=false,productReadUnavailable=false,legacyBootstrapResponse=false,unsupportedBootstrapResponse=false,unsupportedProjectionReplies=0;
 let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined;
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined,buyerDiagnostic:Page|undefined;
 const calls:{path:string;status:number;key?:string;bytes:number;ms:number;navigationLocation?:string}[]=[],errors:string[]=[];
 try{
  bridge=createServer(async(req,res)=>{
   const began=performance.now(),requestUrl=new URL(req.url??'/', 'http://owned.test');
   if(storeReadUnavailable&&requestUrl.pathname===`/v1/storefront/${subdomain}`||productReadUnavailable&&requestUrl.pathname.startsWith(`/v1/storefront/${subdomain}/products/`)){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({success:false,error:{code:'SYNTHETIC_READ_OUTAGE',message:'Synthetic mandatory reader unavailable'}}));return;}
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
  const env={...gatewayEnv(owned,keys,{...pooled.env(),ENVIRONMENT:'test',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:DEFAULT_STOREFRONT_DOMAIN,
   RESEND_API_KEY:'synthetic-owned-resend-capture',CHECKOUT_ORIGIN:checkoutOrigin,CHECKOUT_SIGNING_SECRET:crypto.randomUUID()+crypto.randomUUID(),UPLOAD_PUBLIC_BASE_URL:`https://api.localhost:${tlsPort}/assets`})};
  console.info('OWNED_SQL_PROTOCOL_TARGET '+JSON.stringify({binding:'HYPERDRIVE-shaped',origin:'owned PostgreSQL wire',managedHyperdrive:false}));
  gateway=await NativeGateway.create(env,capture);
  const shared={CHECKOUT_ORIGIN:checkoutOrigin,NEXT_PUBLIC_STOREFRONT_URL:commerceOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:DEFAULT_STOREFRONT_DOMAIN,LETBUYY_INTERNAL_API_SECRET:INTERNAL_SECRET,INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,hostMode:'canonical-storefront-loopback',env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
   NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,hostMode:'canonical-storefront-loopback',env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
  commerce=startOwnedClientRuntime(owned,'commerce-next-production',{port:commercePort,hostMode:'canonical-storefront-loopback',env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1',LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'}});
  for(const app of [identity,merchant,commerce])app.stderr.on('data',d=>errors.push(d.toString().slice(0,600)));
  await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant),ready(commerceHttpOrigin+'/api/buyer-auth/session',commerce)]);
  browser=await chromium.launch({headless:true,args:[`--ignore-certificate-errors-spki-list=${tlsSpki}`,'--no-proxy-server',`--host-resolver-rules=MAP *.${DEFAULT_STOREFRONT_DOMAIN}:443 127.0.0.1:${tlsPort}, MAP *.${DEFAULT_STOREFRONT_DOMAIN} 127.0.0.1, MAP ${DEFAULT_STOREFRONT_DOMAIN} 127.0.0.1, MAP checkout.localhost 127.0.0.1, MAP api.localhost 127.0.0.1`]});const context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(60_000);  stage='native-signup';console.info('OWNED_NATIVE_STAGE native-signup');const signup=await page.goto(identityOrigin+'/signup');assert.equal(signup?.status(),200);
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
  stage='native-onboarding';console.info('OWNED_NATIVE_STAGE native-onboarding');await page.getByRole('button',{name:/Online Store/}).click();await page.getByLabel('Display Name',{exact:true}).fill('Synthetic Public Store');
  await page.getByLabel('Subdomain',{exact:true}).fill(subdomain);await expect(page.getByRole('button',{name:'Next',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByLabel('Industry',{exact:true}).selectOption('food');
  const [created]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/create-store'&&r.request().method()==='POST'),page.getByRole('button',{name:'Create My Site',exact:true}).click()]);assert.equal(created.status(),200);
  await page.waitForURL(u=>u.origin===merchantOrigin&&u.pathname===`/${subdomain}/access_account/checkout/select-plan`,{timeout:60_000});await expect(page.getByRole('region',{name:'Available plans'})).toBeVisible();
  const store=JSON.parse(owned.psql(`SELECT jsonb_build_object('count',count(*),'trial_days',max(EXTRACT(EPOCH FROM (trial_ends_at-trial_started_at))/86400),'theme',max(theme_id),'status',max(status))::text FROM sites WHERE custom_user_id=(SELECT id FROM users_custom WHERE email='${email}') AND subdomain='${subdomain}';`));assert.equal(store.count,1);assert.equal(store.trial_days,14,'existing persisted trial policy is preserved');assert.equal(store.status,'draft');
  await page.goto(`${merchantOrigin}/${subdomain}/dashboard`);await expect(page.getByRole('heading',{name:'Where do you want to start?',exact:true})).toBeVisible();
  const siteId=owned.psql(`SELECT id FROM sites WHERE subdomain='${subdomain}';`),productName='Synthetic Native Variant Product';
  assert.equal(store.theme,'letbuyy-core');assert.equal(owned.psql(`SELECT template_config->'liquidBundle'->'package'->>'slug' FROM sites WHERE id='${siteId}';`),'letbuyy-core-liquid');
  await expect(page.locator('body')).toContainText(`${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`);
  stage='product-create';console.info('OWNED_NATIVE_STAGE product-create');await page.goto(`${merchantOrigin}/${subdomain}/products/new`);
  await page.getByLabel('Title',{exact:true}).fill(productName);await page.getByLabel('Price',{exact:true}).fill('199');await page.getByLabel('Product status',{exact:true}).selectOption('active');
  const png=readFileSync(new URL('../fixtures/week1-synthetic-product.png',import.meta.url));
  const uploaded=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/upload')&&r.request().method()==='POST');
  await page.locator('input[type="file"]').setInputFiles({name:'synthetic-core-product.png',mimeType:'image/png',buffer:png});
  const upload=await uploaded;assert.equal(upload.status(),201);const imageUrl=(await upload.json()).data.url;
  await expect(page.locator(`img[src="${imageUrl}"]`)).toBeVisible();await expect.poll(()=>page!.locator(`img[src="${imageUrl}"]`).evaluate(n=>(n as HTMLImageElement).naturalWidth)).toBe(320);
  const raw=await gateway.dispatch(new URL(imageUrl).pathname,{method:'GET'});assert.equal(raw.status,200);assert.deepEqual(Buffer.from(await raw.arrayBuffer()),png);
  await page.getByRole('button',{name:'Add option',exact:true}).click();await page.getByPlaceholder('Option name (Size, Color, Material)').fill('Size');await page.getByRole('button',{name:'Done',exact:true}).click();
  for(const value of ['Small','Large']){await page.getByPlaceholder('Add value',{exact:true}).fill(value);await page.getByRole('button',{name:'Add value',exact:true}).click();}
  for(const [title,price,stock]of [['Small','199','3'],['Large','249','4']]){await page.getByLabel(`Price for ${title}`,{exact:true}).fill(price);await page.getByLabel(`Stock for ${title}`,{exact:true}).fill(stock);await page.getByLabel(`SKU for ${title}`,{exact:true}).fill('SYN-CORE-'+title);}
  const [saved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/products')&&r.request().method()==='POST'),page.getByRole('button',{name:'Save product',exact:true}).click()]);assert.equal(saved.status(),201);
  const productId=owned.psql(`SELECT id FROM products WHERE store_id='${siteId}' AND name='${productName}';`);assert.match(productId,/^[a-f0-9-]{36}$/);assert.equal(owned.psql(`SELECT count(*) FROM product_variants WHERE product_id='${productId}';`),'2');
  await page.goto(`${merchantOrigin}/${subdomain}/products/${productId}`);await expect(page.getByLabel('Title',{exact:true})).toHaveValue(productName);await expect(page.getByLabel('Stock for Small',{exact:true})).toHaveValue('3');
  stage='merchant-manual-collection';console.info('OWNED_NATIVE_STAGE merchant-manual-collection');const collectionTitle='Synthetic Native Collection';
  await page.goto(`${merchantOrigin}/${subdomain}/products/collections`);await page.getByRole('button',{name:'New collection',exact:true}).click();await page.getByLabel('Title',{exact:true}).fill(collectionTitle);
  const [collectionCreated]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/collections')&&r.request().method()==='POST'),page.getByRole('button',{name:'Create collection',exact:true}).first().click()]);assert.equal(collectionCreated.status(),201);
  const collectionId=owned.psql(`SELECT id FROM collections WHERE store_id='${siteId}' AND title='${collectionTitle}';`);assert.match(collectionId,/^[a-f0-9-]{36}$/);
  await page.getByRole('row').filter({hasText:collectionTitle}).getByRole('button',{name:'Manage products',exact:true}).click();await page.getByRole('checkbox',{name:productName,exact:true}).check();
  const [membersSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith(`/collections/${collectionId}/products`)&&r.request().method()==='PUT'),page.getByRole('button',{name:'Save products',exact:true}).click()]);assert.equal(membersSaved.status(),200);
  assert.equal(owned.psql(`SELECT count(*) FROM collection_products WHERE collection_id='${collectionId}' AND product_id='${productId}';`),'1');
  await page.goto(`${merchantOrigin}/${subdomain}/products/collections`);
  for(let index=1;index<=25;index++){
   const title='ZZZ Synthetic Browse '+String(index).padStart(2,'0');await page.getByRole('button',{name:'New collection',exact:true}).click();const createPanel=page.locator('section').filter({has:page.getByRole('heading',{name:'New collection',exact:true})});await createPanel.getByLabel('Title',{exact:true}).fill(title);
   const [createdExtra]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/collections')&&r.request().method()==='POST'),createPanel.getByRole('button',{name:'Create collection',exact:true}).click()]);assert.equal(createdExtra.status(),201);
   await expect(createPanel).toHaveCount(0);
  }
  assert.equal(owned.psql(`SELECT count(*) FROM collections WHERE store_id='${siteId}' AND is_active AND deleted_at IS NULL;`),'26','all pagination collections were created by normal merchant UI');
  stage='native-search-index-scheduler';console.info('OWNED_NATIVE_STAGE native-search-index-scheduler');
  assert.ok(Number(owned.psql(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${productId}' AND event_type IN('product.created','product.updated');`))>0,'normal product commands produced durable events');
  await gateway.runScheduled();
  assert.equal(owned.psql(`SELECT count(*) FROM search_documents WHERE site_id='${siteId}' AND object_type='product' AND object_id='${productId}' AND status='active' AND deleted_at IS NULL;`),'1','actual scheduler indexed the real merchant product');
  assert.ok(Number(owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE site_id='${siteId}' AND queue_name='search-indexing' AND status='succeeded';`))>0,'nonzero search queue work completed');
  stage='shipping-config';console.info('OWNED_NATIVE_STAGE shipping-config');await page.goto(`${merchantOrigin}/${subdomain}/settings/shipping`);await page.getByRole('button',{name:'Add zone',exact:true}).first().click();await page.getByLabel('Zone name',{exact:true}).fill('Synthetic native zone');await page.getByLabel('Countries',{exact:true}).fill('IN');
  await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/shipping/zones')&&r.request().method()==='POST'),page.getByRole('button',{name:'Add zone',exact:true}).last().click()]);
  await page.getByRole('button',{name:'Add rate',exact:true}).click();await page.getByLabel('Rate name',{exact:true}).fill('Synthetic native delivery');await page.getByLabel('Price (₹, 0 for free)',{exact:true}).fill('20');
  const [rateSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/shipping/rates')&&r.request().method()==='POST'),page.getByRole('button',{name:'Add rate',exact:true}).last().click()]);assert.equal(rateSaved.status(),201);
  stage='core-editor-publish';console.info('OWNED_NATIVE_STAGE core-editor-publish');await page.goto(`${merchantOrigin}/${subdomain}/online-store/themes/letbuyy-core/editor`);await expect(page.getByRole('tree',{name:'Template sections',exact:true})).toBeVisible();
  await page.getByRole('tree',{name:'Template sections',exact:true}).getByRole('treeitem').filter({hasText:/Hero/}).first().click();const marker='Synthetic Native Core Ready';
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
  const draftContext=await browser.newContext(),draftVisitor=await draftContext.newPage();const draftResponse=await draftVisitor.goto(`https://${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}:${tlsPort}`);assert.equal(draftResponse?.status(),401);await draftContext.close();
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
  await expect(page.getByRole('button',{name:'Save',exact:true}).first()).toBeDisabled();const [published]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/themes/letbuyy-core/editor'&&r.request().method()==='PUT'),page.getByRole('button',{name:'Publish',exact:true}).click()]);assert.equal(published.status(),200);
  assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${siteId}';`),'published');
  stage='public-tenant-storefront';console.info('OWNED_NATIVE_STAGE public-tenant-storefront');const buyerContext=await browser.newContext(),buyer=await buyerContext.newPage();buyerDiagnostic=buyer;buyer.setDefaultTimeout(30_000);buyer.setDefaultNavigationTimeout(60_000);
  const tenantOrigin=`https://${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}:${tlsPort}`;const home=await buyer.goto(tenantOrigin);assert.equal(home?.status(),200);await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]')).toBeVisible();await expect(buyer.getByRole('heading',{level:1}).first()).toHaveText(marker);await expect(buyer.getByText('Discover our latest products.',{exact:true})).toBeVisible();await expect(buyer.getByText('Free shipping on fresh drops this week.',{exact:true})).toHaveCount(0);
  assert.equal(await buyer.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--primary').trim()),previewPrimary,'private and published Core use the same resolved primary token');
  const publicScreenshot=`${tmpdir()}/letbuyy-native-core-store-${owned.runId}.png`;await buyer.screenshot({path:publicScreenshot,fullPage:true});
  stage='public-read-profile';console.info('OWNED_NATIVE_STAGE public-read-profile');
  const profileEditorUrl=page.url();await page.goto('about:blank');await buyer.waitForLoadState('networkidle');
  const readProfiles=[];
  for(const [kind,path]of [['home',''],['product',`/product/${productId}`],['collection-index','/collections']] as const){
   for(let sample=0;sample<3;sample++){
    await buyer.waitForLoadState('networkidle');const startIndex=calls.length,began=performance.now();
    const document=await buyer.goto(`${tenantOrigin}${path}`,{waitUntil:'domcontentloaded'});assert.equal(document?.status(),200);
    await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]')).toBeVisible();
    if(kind==='home')await expect(buyer.getByRole('heading',{level:1,name:marker,exact:true})).toBeVisible();
    if(kind==='product'){await expect(buyer.getByRole('heading',{level:1,name:productName,exact:true})).toBeVisible();await expect(buyer.getByRole('button',{name:'Add to cart',exact:true})).toBeDisabled();}
    if(kind==='collection-index')await expect(buyer.locator('.lb-category-grid a').filter({visible:true})).toHaveCount(24);
    const usefulReadyMs=Math.round((performance.now()-began)*100)/100;
    const timing=await buyer.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;return{ttfbMs:n.responseStart-n.startTime,responseEndMs:n.responseEnd-n.startTime,domContentLoadedMs:n.domContentLoadedEventEnd-n.startTime,decodedDocumentBytes:n.decodedBodySize};});
    await buyer.waitForLoadState('networkidle');
    const reads=calls.slice(startIndex).filter(call=>call.path===`/v1/storefront/${subdomain}`||call.path.startsWith(`/v1/storefront/${subdomain}/`));
    const counts:Record<string,number>={};for(const call of reads){const key=call.path.replace(subdomain,':store').replace(productId,':product')+(call.navigationLocation?'?location='+call.navigationLocation:'');counts[key]=(counts[key]??0)+1;}
    const navigationReads=reads.filter(call=>call.path.endsWith('/navigation')).length;
    const skuReads=reads.filter(call=>call.path===`/v1/storefront/${subdomain}/products/${productId}`).length;
    const catalogReads=reads.filter(call=>call.path===`/v1/storefront/${subdomain}/products`).length;
    const failures=reads.filter(call=>call.status>=400).map(call=>({status:call.status,path:call.path.replace(subdomain,':store').replace(productId,':product')}));
    assert.deepEqual(failures,[]);
    assert.ok(navigationReads<=3,`${kind} repeats public menu readers: ${JSON.stringify(counts)}`);
    assert.equal(counts['/v1/storefront/:store'],1,`${kind} needs one current public bootstrap per new document`);
    assert.equal(counts['/v1/storefront/:store/status'],1,`${kind} needs one current status read per new document`);
    if(kind==='product')assert.equal(skuReads,1,'metadata/page share one public SKU read in this render');
    if(kind==='product'||kind==='collection-index')assert.equal(catalogReads,0,'Liquid chrome must not fetch an unused catalog');
    readProfiles.push({kind,sample,usefulReadyMs,...timing,upstreamReads:reads.length,upstreamResponseBytes:reads.reduce((sum,call)=>sum+call.bytes,0),navigationReads,skuReads,catalogReads,counts,upstreamWallDurationsMs:reads.map(call=>call.ms),failures});
   }
  }
  console.info('OWNED_CORE_READ_PROFILE '+JSON.stringify({boundary:'production builds/native Worker/owned PostgreSQL; anonymous full-document useful DOM, then bounded settled request capture',samples:readProfiles}));
  // Fetch the script as a resource, not a document: rendering the generic404
  // document legitimately prefetches its Continue shopping Link into a new RSC request.
  const resourceStart=calls.length;const resourceStatus=await buyer.evaluate(async()=>{
   const result=await fetch('/_vercel/speed-insights/script.js',{cache:'no-store'});await result.arrayBuffer();return result.status;
  });
  assert.equal(resourceStatus,404,'owned Next server has no Vercel platform script');
  assert.equal(calls.slice(resourceStart).filter(call=>call.path.includes(`/storefront/${subdomain}`)).length,0,'missing platform assets must not render a tenant or load its catalog');
  console.info('OWNED_PLATFORM_RESOURCE '+JSON.stringify({missingPlatformAsset404:true,tenantBusinessReads:0}));
  for(const resource of ['store','product'] as const){
   storeReadUnavailable=resource==='store';productReadUnavailable=resource==='product';await buyer.goto(`${tenantOrigin}/product/${productId}`);await expect(buyer.getByRole('heading',{name:'Something went wrong',exact:true})).toBeVisible();
   storeReadUnavailable=false;productReadUnavailable=false;await buyer.getByRole('button',{name:'Try again',exact:true}).click();await expect(buyer.getByRole('heading',{level:1,name:productName,exact:true})).toBeVisible();await buyer.waitForLoadState('networkidle');
  }
  console.info('OWNED_CORE_READ_RECOVERY '+JSON.stringify({bootstrap503Unavailable:true,sku503Unavailable:true,nextRequestRecovers:true,falseNotFound:false}));
  // Real Cache API proof uses the native Worker, not an in-memory fake. Cache
  // puts are waitUntil work: poll for an actual HIT before changing publication.
  async function bootstrap(compact:boolean){
   const reply=await gateway!.dispatch(`/v1/storefront/${subdomain}${compact?'?projection=render-v1':''}`,{});
   const body=await reply.json() as {data?:Record<string,any>};
   return {status:reply.status,cache:reply.headers.get('x-storefront-cache'),control:reply.headers.get('cache-control'),data:body.data};
  }
  async function assertCurrentBootstrapCache(){
   const expected=JSON.parse(owned.psql(`SELECT row_to_json(r) FROM (SELECT current_theme_release_id AS id,storefront_release_version AS version FROM sites WHERE id='${siteId}') r;`));
   for(const compact of [false,true]){
    let result=await bootstrap(compact);assert.equal(result.status,200);
    await expect.poll(async()=>{result=await bootstrap(compact);return result.cache;},{timeout:10_000,intervals:[50,100,250]}).toBe('HIT');
    assert.equal(result.control,'no-store');assert.equal(result.data!.current_theme_release.id,expected.id);assert.equal(result.data!.current_theme_release.release_version,expected.version);
    assert.equal(result.data!.projection,compact?'render-v1':undefined);
    assert.equal('release_config'in result.data!.current_theme_release,!compact);
    const canonical=JSON.parse(owned.psql(`SELECT template_snapshot FROM theme_releases WHERE id='${expected.id}';`));
    assert.deepEqual(result.data!.template_config,canonical);
   }
  }
  await assertCurrentBootstrapCache();
  // The owned-only visibility mutation tests warm cache retirement independently
  // of the normal merchant publication journey below; no restored store is used.
  owned.psql(`UPDATE sites SET published=false WHERE id='${siteId}';`);
  for(const compact of [false,true])assert.equal((await bootstrap(compact)).status,404);
  owned.psql(`UPDATE sites SET published=true WHERE id='${siteId}';`);await assertCurrentBootstrapCache();
  legacyBootstrapResponse=true;await buyer.goto(`${tenantOrigin}/product/${productId}`,{waitUntil:'networkidle'});await expect(buyer.getByRole('heading',{level:1,name:productName,exact:true})).toBeVisible();
  await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]')).toBeVisible();legacyBootstrapResponse=false;
  console.info('OWNED_COMPACT_BOOTSTRAP_CACHE '+JSON.stringify({nativeCacheHits:true,legacyAndCompactSeparated:true,warmUnpublished404:true,legacyResponseConsumer:true}));
  // Named response-version fault after a real successful API read. It is not a
  // transport failure: the consumer must reject the unknown model, then recover.
  unsupportedBootstrapResponse=true;await buyer.goto(`${tenantOrigin}/product/${productId}`);
  await expect(buyer.getByRole('heading',{name:'Something went wrong',exact:true})).toBeVisible();
  assert.ok(unsupportedProjectionReplies>0,'the successful HTTP body must actually carry the unsupported version');
  unsupportedBootstrapResponse=false;await buyer.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(buyer.getByRole('heading',{level:1,name:productName,exact:true})).toBeVisible();
  console.info('OWNED_COMPACT_VERSION_REFUSAL '+JSON.stringify({altered200Responses:unsupportedProjectionReplies,unknownVersionUnavailable:true,nextRequestRecovers:true}));

  await page.goto(profileEditorUrl);await expect(page.getByRole('button',{name:'Experiences',exact:true})).toBeVisible();
  stage='ten-core-presets';console.info('OWNED_NATIVE_STAGE ten-core-presets');const presets=[];
  for(const name of ['Forge','Sense','Aura','Craft','Refresh','Ride','Dawn','Bloom','Nova','Summit']){
   await page.getByRole('button',{name:'Experiences',exact:true}).click();const apply=page.getByRole('button',{name:'Apply '+name,exact:true});
   if(await apply.count()){
    const [savedPreset]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/editor/draft')&&r.request().method()==='POST'),apply.click()]);assert.equal(savedPreset.status(),200);await expect(page.getByRole('button',{name:'Save',exact:true}).first()).toBeDisabled();
   }
   await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Experiences',exact:true}).click();await expect(page.getByRole('button',{name:'Applied',exact:true})).toHaveCount(1);
   const [presetPublish]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/themes/letbuyy-core/editor'&&r.request().method()==='PUT'),page.getByRole('button',{name:'Publish',exact:true}).click()]);assert.equal(presetPublish.status(),200);
   const reference=JSON.parse(owned.psql(`SELECT default_template->'liquidBundle'->'config'->'settings_data'->'presets'->'${name}' FROM themes WHERE slug='letbuyy-core';`));
   const release=JSON.parse(owned.psql(`SELECT r.template_snapshot->'themeSettings' FROM theme_releases r JOIN sites s ON s.current_theme_release_id=r.id WHERE s.id='${siteId}';`));
   for(const[key,value]of Object.entries(reference))assert.deepEqual(release[key],value,'published preset '+name+'/'+key);
   await assertCurrentBootstrapCache();
   for(const width of [1280,360]){
    await buyer.setViewportSize({width,height:900});const document=await buyer.goto(tenantOrigin,{waitUntil:'networkidle'});assert.equal(document?.status(),200);assert.match(document!.headers()['cache-control']||'',/no-store/);
    const rendered=buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]');await expect(rendered).toBeVisible();assert.equal(await rendered.evaluate(el=>getComputedStyle(el).getPropertyValue('--primary').trim()),reference.primaryColor);
    assert.equal(await buyer.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+1),true);
   }
   presets.push({name,applied:true,reloaded:true,published:true,exactStoredValues:true,widths:[1280,360],renderedPrimary:true});
  }
  await buyer.setViewportSize({width:1280,height:900});
  stage='shopper-collection-search';console.info('OWNED_NATIVE_STAGE shopper-collection-search');
  await buyer.goto(tenantOrigin);
  const collectionCard=buyer.locator('.lb-category-grid').getByRole('link',{name:collectionTitle,exact:true});
  await expect(collectionCard).toBeVisible();await expect(collectionCard).toHaveAttribute('href',`/store/${subdomain}/collections/${collectionId}`);
  await expect(buyer.locator('.lb-category-grid').getByRole('link',{name:'All Products',exact:true})).toHaveCount(0);
  await collectionCard.click();await expect(buyer.getByRole('heading',{level:1,name:collectionTitle,exact:true})).toBeVisible();await expect(buyer.locator(`a[href="/product/${productId}"]`).filter({hasText:productName}).first()).toBeVisible();
  await buyer.goto(`${tenantOrigin}/collections`);
  const indexLinks=buyer.locator('.lb-category-grid a').filter({visible:true});await expect(indexLinks).toHaveCount(24);
  const firstIds=await indexLinks.evaluateAll(links=>links.map(link=>link.getAttribute('href')));const collectionScreenshot=`${tmpdir()}/letbuyy-native-collections-${owned.runId}.png`;await buyer.screenshot({path:collectionScreenshot,fullPage:true});
  const pager=buyer.getByRole('navigation',{name:'Collection pages',exact:true});await expect(pager.getByRole('link',{name:'Next collections',exact:true})).toBeVisible();
  const pagerPlacement=await buyer.evaluate(()=>({pager:document.querySelector('.lb-collection-pagination')!.getBoundingClientRect().bottom,footer:document.querySelector('.lb-footer')!.getBoundingClientRect().top}));assert.ok(pagerPlacement.pager<=pagerPlacement.footer,'pagination precedes footer');
  await pager.getByRole('link',{name:'Next collections',exact:true}).click();await expect(indexLinks).toHaveCount(2);
  const secondIds=await indexLinks.evaluateAll(links=>links.map(link=>link.getAttribute('href')));assert.equal(new Set([...firstIds,...secondIds]).size,26);await expect(pager.getByRole('link',{name:'Next collections',exact:true})).toHaveCount(0);
  await pager.getByRole('link',{name:'Previous collections',exact:true}).click();await expect(indexLinks).toHaveCount(24);assert.deepEqual(await indexLinks.evaluateAll(links=>links.map(link=>link.getAttribute('href'))),firstIds);
  let indexCard=buyer.locator('.lb-category-grid').getByRole('link',{name:collectionTitle,exact:true});if(!await indexCard.count()){await pager.getByRole('link',{name:'Next collections',exact:true}).click();}
  await expect(indexCard).toBeVisible();await indexCard.click();await expect(buyer.getByRole('heading',{level:1,name:collectionTitle,exact:true})).toBeVisible();
  console.info('OWNED_COLLECTION_INDEX '+JSON.stringify({indexCardVisible:true,actualDetailOpened:true,collectionScreenshot,normalMerchantCollections:26,pages:[24,2],previousPageRestored:true,paginationBeforeFooter:true}));
  collectionListUnavailable=true;await buyer.goto(tenantOrigin);
  await expect(buyer.getByRole('heading',{name:'Something went wrong',exact:true})).toBeVisible();
  await expect(buyer.getByText('No collections yet',{exact:true})).toHaveCount(0);
  collectionListUnavailable=false;await buyer.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(buyer.locator('.lb-category-grid').getByRole('link',{name:collectionTitle,exact:true})).toBeVisible();
  console.info('OWNED_COLLECTION_DISCOVERY_RECOVERY '+JSON.stringify({actualHomepageCard:true,collectionDetailProducts:true,unavailableNotEmpty:true,normalRetryRestored:true}));
  let searchScreenshot='';
  for(const width of [1280,360]){await buyer.setViewportSize({width,height:900});await buyer.goto(`${tenantOrigin}/search`);await buyer.locator('.lb-search').getByRole('searchbox',{name:'Search products',exact:true}).fill('Synthetic Native Variant');
   const submit=buyer.locator('.lb-search').getByRole('button',{name:'Search',exact:true});await expect(submit).toBeVisible();const area=await submit.boundingBox();assert.ok(area&&area.width>=44&&area.height>=44,'search has an actual usable hit area');
   await Promise.all([buyer.waitForURL(u=>u.searchParams.get('search')==='Synthetic Native Variant'),submit.click()]);await buyer.waitForLoadState('networkidle');console.info('OWNED_SEARCH_DOM '+JSON.stringify({path:new URL(buyer.url()).pathname,query:new URL(buyer.url()).searchParams.get('search'),text:(await buyer.locator('body').innerText()).slice(0,2500),products:await buyer.locator('a[href*="/product/"]').evaluateAll(els=>els.map(el=>({href:el.getAttribute('href'),text:el.textContent?.trim()})))}));await expect(buyer.locator(`a[href$="/product/${productId}"]`).filter({hasText:productName}).first()).toBeVisible();assert.equal(await buyer.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+1),true);
   const filterPlacement=await buyer.evaluate(()=>({filter:document.querySelector('.lb-collection-filter')!.getBoundingClientRect().top,header:document.querySelector('.lb-header')!.getBoundingClientRect().bottom}));assert.ok(filterPlacement.filter>=filterPlacement.header,'origin filter follows storefront header');
   if(width===360){searchScreenshot=`${tmpdir()}/letbuyy-native-core-search-${owned.runId}.png`;await buyer.screenshot({path:searchScreenshot,fullPage:true});}
  }
  await buyer.setViewportSize({width:1280,height:900});await buyer.goto(tenantOrigin);
  await buyer.getByRole('button',{name:'Choose options',exact:true}).first().click();await buyer.waitForURL(url=>url.pathname===`/product/${productId}`);assert.equal(await buyer.evaluate(()=>JSON.parse(localStorage.getItem('lb_cart')||'[]').length),0,'variant card opens the picker without adding an unspecified product');await buyer.goto(tenantOrigin);
  await buyer.getByRole('link',{name:'Catalog',exact:true}).click();await buyer.locator(`a[href="/product/${productId}"]`).filter({hasText:productName}).first().click();await expect(buyer.locator(`img[src="${imageUrl}"]`).first()).toBeVisible();
  await buyer.waitForFunction(()=>Boolean(customElements.get('lb-add-to-cart')&&customElements.get('lb-variant-picker')));await expect(buyer.getByRole('button',{name:'Buy now',exact:true})).toBeDisabled();await buyer.getByRole('button',{name:'Large',exact:true}).click();await expect(buyer.getByRole('button',{name:'Buy now',exact:true})).toBeEnabled();stage='customer-handoff';console.info('OWNED_NATIVE_STAGE customer-handoff');console.info('OWNED_NATIVE_CORE_PRESETS '+JSON.stringify({nativeWorkerd:true,nativeR2:true,presets,publicScreenshot}));const [handoff]=await Promise.all([buyer.waitForResponse(r=>new URL(r.url()).pathname==='/api/checkout-handoff'&&r.request().method()==='POST'),buyer.getByRole('button',{name:'Buy now',exact:true}).click()]);assert.equal(handoff.status(),200,'configured hosted checkout handoff');await buyer.waitForURL(u=>u.hostname==='checkout.localhost'&&u.pathname==='/checkout');
  stage='customer-cod-order';console.info('OWNED_NATIVE_STAGE customer-cod-order');await buyer.getByPlaceholder('John Doe').fill('Synthetic Native Buyer');await buyer.getByPlaceholder('9876543210').fill('9000000099');await buyer.getByPlaceholder('john@example.com').fill('syn-native-buyer@example.invalid');await buyer.getByPlaceholder('House/Flat No, Street, Landmark...').fill('Synthetic Native Road');await buyer.getByPlaceholder('Bengaluru').fill('Bengaluru');await buyer.locator('select').first().selectOption('29');await buyer.getByPlaceholder('560001').fill('560001');
  await buyer.getByRole('button',{name:/Synthetic native delivery/}).click();await buyer.getByRole('button',{name:'Continue to Payment',exact:true}).click();await buyer.getByRole('radio',{name:/Cash on Delivery \(COD\)/}).check();await buyer.getByRole('button',{name:'Confirm COD order',exact:true}).click();await expect(buyer.getByRole('heading',{name:'Order Confirmed!',exact:true})).toBeVisible();
  const orders=JSON.parse(owned.psql(`SELECT coalesce(json_agg(json_build_object('id',id,'method',payment_method,'total',(total*100)::bigint)), '[]'::json) FROM orders WHERE site_id='${siteId}';`));assert.equal(orders.length,1);assert.equal(orders[0].method,'cod');assert.equal(orders[0].total,26900);
  assert.equal(owned.psql(`SELECT count(*) FROM order_items WHERE order_id='${orders[0].id}' AND variant_id=(SELECT id::text FROM product_variants WHERE product_id='${productId}' AND title='Large');`),'1');
  assert.equal(owned.psql(`SELECT (amount*100)::bigint FROM order_shipping_lines WHERE order_id='${orders[0].id}';`),'2000');
  assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE store_id='${siteId}' AND aggregate_id='${orders[0].id}' AND event_type='order.paid';`),'0','unpaid COD must not be announced as paid');
  const orderScreenshot=`${tmpdir()}/letbuyy-native-core-order-${owned.runId}.png`;await buyer.screenshot({path:orderScreenshot,fullPage:true});await buyerContext.close();
  stage='canonical-buyer-registration';console.info('OWNED_NATIVE_STAGE canonical-buyer-registration');const accountContext=await browser.newContext(),accountPage=await accountContext.newPage();buyerDiagnostic=accountPage;accountPage.setDefaultTimeout(30_000);accountPage.setDefaultNavigationTimeout(60_000);accountPage.on('requestfailed',r=>{const u=new URL(r.url());if(u.hostname===`${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`)console.info('OWNED_BUYER_NAV_FAILURE '+JSON.stringify({host:u.host,path:u.pathname,error:r.failure()?.errorText}));});
  await accountPage.goto(`${tenantOrigin}/customers/login`);await accountPage.getByRole('link',{name:'Continue with LetBuyy',exact:true}).click();await expect(accountPage.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();await accountPage.getByRole('link',{name:'Create an account',exact:true}).click();
  await expect(accountPage.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:90_000});const accountEmail=`syn-core-account-${crypto.randomUUID()}@example.invalid`;await accountPage.getByLabel('Email',{exact:true}).fill(accountEmail);await accountPage.getByLabel('Password',{exact:true}).fill(password);
  const [accountCreated]=await Promise.all([accountPage.waitForResponse(r=>new URL(r.url()).pathname==='/api/buyer/register'&&r.request().method()==='POST'),accountPage.getByRole('button',{name:'Create account',exact:true}).click()]);assert.equal(accountCreated.status(),201);
  await accountPage.getByRole('button',{name:'Continue to Synthetic Public Store',exact:true}).click();await accountPage.waitForURL(u=>u.hostname===`${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`&&['/account',`/store/${subdomain}/account`].includes(u.pathname));await accountPage.waitForLoadState('networkidle');console.info('OWNED_BUYER_ACCOUNT_SECTIONS '+JSON.stringify(await accountPage.locator('.lb-account').evaluateAll(els=>els.map(el=>({section:el.getAttribute('data-section-id'),visible:el.getBoundingClientRect().height>0,hiddenAncestor:Boolean(el.closest('[hidden]'))})))));const accountView=accountPage.locator('.lb-account').filter({visible:true});await expect(accountView,'exactly one visible account section').toHaveCount(1);await expect(accountView.getByText(`Signed in to LetBuyy as ${accountEmail}`,{exact:true})).toBeVisible();
  const accountReady=async()=>{await accountPage.waitForLoadState('networkidle');await expect(accountPage.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]').filter({visible:true})).toHaveCount(1);};
  const accountScreenshot=`${tmpdir()}/letbuyy-native-core-account-${owned.runId}.png`;await accountPage.screenshot({path:accountScreenshot,fullPage:true});
  stage='canonical-buyer-profile';console.info('OWNED_NATIVE_STAGE canonical-buyer-profile');await accountView.getByRole('link',{name:'Settings',exact:true}).click();await accountReady();await accountPage.getByLabel('Full name',{exact:true}).filter({visible:true}).fill('Synthetic Core Account');const [profileSaved]=await Promise.all([accountPage.waitForResponse(r=>new URL(r.url()).pathname==='/api/buyer/profile'&&r.request().method()==='PATCH'),accountPage.getByRole('button',{name:'Save profile',exact:true}).click()]);assert.equal(profileSaved.status(),200);await accountPage.reload();await accountReady();await expect(accountPage.getByLabel('Full name',{exact:true}).filter({visible:true})).toHaveValue('Synthetic Core Account');
  stage='canonical-buyer-address';console.info('OWNED_NATIVE_STAGE canonical-buyer-address');await accountPage.setViewportSize({width:360,height:900});await accountPage.goto(`${tenantOrigin}/account/addresses`);await accountReady();await accountPage.getByRole('button',{name:'+ Add address',exact:true}).click();for(const[label,value]of [['Full name','Synthetic Core Account'],['Address line 1','Synthetic Account Road'],['City','Bengaluru'],['State','Karnataka'],['PIN Code','560001']])await accountPage.getByLabel(label,{exact:true}).filter({visible:true}).fill(value);
  const [addressSaved]=await Promise.all([accountPage.waitForResponse(r=>new URL(r.url()).pathname==='/api/buyer/addresses'&&r.request().method()==='POST'),accountPage.getByRole('button',{name:'Save address',exact:true}).click()]);assert.equal(addressSaved.status(),201);const addressId=owned.psql(`SELECT id FROM buyer_addresses WHERE buyer_account_id=(SELECT id FROM buyer_accounts WHERE email='${accountEmail}') AND address_line1='Synthetic Account Road';`);assert.match(addressId,/^[a-f0-9-]{36}$/);await accountPage.reload();await accountReady();await expect(accountPage.getByText('Synthetic Account Road',{exact:false}).filter({visible:true}).first()).toBeVisible();
  for(const action of await accountPage.locator('.lb-address-card__actions button,.lb-addresses__add-btn').all()){const area=await action.boundingBox();assert.ok(area&&area.width>=44&&area.height>=44,'address actions have44px hit areas');}
  const actions=await accountPage.locator('.lb-address-card__actions button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));assert.ok(actions[0].right+4<=actions[1].left||actions[0].bottom+4<=actions[1].top,'address actions are visibly separated');
  await accountPage.locator('.lb-address-card__actions').getByRole('button',{name:'Edit',exact:true}).focus();await accountPage.keyboard.press('Tab');
  if(await accountPage.locator('[data-lb-addr-default]:focus').count()) await accountPage.keyboard.press('Tab');
  const focus=await accountPage.evaluate(()=>({deleteFocused:document.activeElement?.hasAttribute('data-lb-addr-delete'),outline:document.activeElement?getComputedStyle(document.activeElement).outlineStyle:'',width:document.activeElement?getComputedStyle(document.activeElement).outlineWidth:''}));assert.deepEqual(focus,{deleteFocused:true,outline:'solid',width:'2px'});
  assert.equal(await accountPage.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+1),true);
  const buyerAId=owned.psql(`SELECT id FROM buyer_accounts WHERE email='${accountEmail}';`);
  stage='canonical-buyer-address-edit';console.info('OWNED_NATIVE_STAGE canonical-buyer-address-edit');await accountPage.locator('.lb-address-card').filter({hasText:'Synthetic Account Road'}).getByRole('button',{name:'Edit',exact:true}).click();await accountPage.getByLabel('Address line 1',{exact:true}).filter({visible:true}).fill('Synthetic Edited Account Road');
  const [addressEdited]=await Promise.all([accountPage.waitForResponse(r=>new URL(r.url()).pathname===`/api/buyer/addresses/${addressId}`&&r.request().method()==='PATCH'),accountPage.getByRole('button',{name:'Update address',exact:true}).click()]);assert.equal(addressEdited.status(),200);await expect(accountPage.getByText('Synthetic Edited Account Road',{exact:true}).filter({visible:true})).toBeVisible();
  stage='canonical-buyer-address-default';console.info('OWNED_NATIVE_STAGE canonical-buyer-address-default');await accountPage.getByRole('button',{name:'+ Add address',exact:true}).click();for(const[label,value]of [['Full name','Synthetic Core Account'],['Address line 1','Synthetic Second Account Road'],['City','Bengaluru'],['State','Karnataka'],['PIN Code','560001']])await accountPage.getByLabel(label,{exact:true}).filter({visible:true}).fill(value);
  const [secondSaved]=await Promise.all([accountPage.waitForResponse(r=>new URL(r.url()).pathname==='/api/buyer/addresses'&&r.request().method()==='POST'),accountPage.getByRole('button',{name:'Save address',exact:true}).click()]);assert.equal(secondSaved.status(),201);const secondAddressId=owned.psql(`SELECT id FROM buyer_addresses WHERE buyer_account_id='${buyerAId}' AND address_line1='Synthetic Second Account Road';`);assert.match(secondAddressId,/^[a-f0-9-]{36}$/);const secondCard=accountPage.locator('.lb-address-card').filter({hasText:'Synthetic Second Account Road'});await expect(secondCard).toBeVisible();
  const [defaultSaved]=await Promise.all([accountPage.waitForResponse(r=>new URL(r.url()).pathname===`/api/buyer/addresses/${secondAddressId}`&&r.request().method()==='PATCH'),secondCard.getByRole('button',{name:'Set default',exact:true}).click()]);assert.equal(defaultSaved.status(),200);await expect(secondCard.locator('.lb-address-card__default-badge')).toBeVisible();
  stage='canonical-buyer-address-delete';console.info('OWNED_NATIVE_STAGE canonical-buyer-address-delete');const [addressDeleted]=await Promise.all([accountPage.waitForResponse(r=>new URL(r.url()).pathname===`/api/buyer/addresses/${addressId}`&&r.request().method()==='DELETE'),accountPage.locator('.lb-address-card').filter({hasText:'Synthetic Edited Account Road'}).getByRole('button',{name:'Delete',exact:true}).click()]);assert.equal(addressDeleted.status(),200);await accountPage.reload();await accountReady();await expect(accountPage.getByText('Synthetic Edited Account Road',{exact:true})).toHaveCount(0);await expect(secondCard.locator('.lb-address-card__default-badge')).toBeVisible();
  const addressScreenshot=`${tmpdir()}/letbuyy-native-core-address-${owned.runId}.png`;await accountPage.screenshot({path:addressScreenshot,fullPage:true});
  stage='canonical-buyer-stale-address';console.info('OWNED_NATIVE_STAGE canonical-buyer-stale-address');await accountPage.getByRole('button',{name:'+ Add address',exact:true}).click();for(const[label,value]of [['Full name','Synthetic Stale Account'],['Address line 1','Synthetic Must Not Persist'],['City','Bengaluru'],['State','Karnataka'],['PIN Code','560001']])await accountPage.getByLabel(label,{exact:true}).filter({visible:true}).fill(value);
  const addressSnapshot=()=>owned.psql("SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id)::text,'[]') FROM buyer_addresses a;"),beforeAccountSwitch=addressSnapshot();
  const switchedPage=await accountContext.newPage();switchedPage.setDefaultTimeout(30_000);switchedPage.setDefaultNavigationTimeout(60_000);await switchedPage.goto(`${tenantOrigin}/customers/login`);await switchedPage.getByRole('link',{name:'Continue with LetBuyy',exact:true}).click();await switchedPage.getByRole('button',{name:'Use a different account',exact:true}).click();await expect(switchedPage.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();await switchedPage.getByRole('link',{name:'Create an account',exact:true}).click();await expect(switchedPage.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:90_000});
  const secondEmail=`syn-core-switch-${crypto.randomUUID()}@example.invalid`;await switchedPage.getByLabel('Email',{exact:true}).fill(secondEmail);await switchedPage.getByLabel('Password',{exact:true}).fill(password);const [secondBuyerCreated]=await Promise.all([switchedPage.waitForResponse(r=>new URL(r.url()).pathname==='/api/buyer/register'&&r.request().method()==='POST'),switchedPage.getByRole('button',{name:'Create account',exact:true}).click()]);assert.equal(secondBuyerCreated.status(),201);await switchedPage.getByRole('button',{name:'Continue to Synthetic Public Store',exact:true}).click();await switchedPage.waitForURL(u=>u.hostname===`${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`&&['/account',`/store/${subdomain}/account`].includes(u.pathname));await switchedPage.waitForLoadState('networkidle');await expect(switchedPage.locator('.lb-account__hello').filter({visible:true})).toHaveText(`Signed in to LetBuyy as ${secondEmail}`);await switchedPage.close();
  const [staleRefused]=await Promise.all([accountPage.waitForResponse(r=>new URL(r.url()).pathname==='/api/buyer/addresses'&&r.request().method()==='POST'),accountPage.getByRole('button',{name:'Save address',exact:true}).click()]);assert.equal(staleRefused.request().headers()['x-letbuyy-expected-buyer-id'],buyerAId);assert.equal(staleRefused.status(),409);assert.equal(addressSnapshot(),beforeAccountSwitch,'normal cross-tab account switch cannot write under the new principal');await expect(accountPage.getByText('Your account changed. Reload before saving.',{exact:true})).toBeVisible();await accountPage.reload();await accountReady();await expect(accountPage.getByText('No saved addresses yet.',{exact:true}).filter({visible:true})).toBeVisible();
  stage='canonical-buyer-order-privacy';console.info('OWNED_NATIVE_STAGE canonical-buyer-order-privacy');await accountPage.goto(`${tenantOrigin}/account/orders`);await accountReady();await expect(accountPage.getByText('No orders yet.',{exact:true}).filter({visible:true})).toBeVisible();await accountPage.goto(`${tenantOrigin}/account/orders/${orders[0].id}`);await accountReady();await expect(accountPage.getByText('Order not found.',{exact:true}).filter({visible:true})).toBeVisible();
  await accountPage.goto(`${tenantOrigin}/account/wishlist`);await accountReady();await expect(accountPage.getByText('Connect your verified store account in',{exact:false}).filter({visible:true})).toBeVisible();await accountContext.close();
  stage='merchant-order-readback';console.info('OWNED_NATIVE_STAGE merchant-order-readback');await page.goto(`${merchantOrigin}/${subdomain}/orders`);await expect(page.getByText('Synthetic Native Buyer',{exact:true}).filter({visible:true}).first()).toBeVisible({timeout:30_000});
  stage='merchant-domain-labels';console.info('OWNED_NATIVE_STAGE merchant-domain-labels');await page.goto(`${merchantOrigin}/${subdomain}/settings/domains`);await expect(page.locator('.domains-row-domain').filter({hasText:`${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`})).toBeVisible();
  await page.goto(`${merchantOrigin}/${subdomain}/online-store/preferences`);await expect(page.getByLabel('Homepage title',{exact:true})).toBeVisible();await expect(page.locator('p').filter({hasText:new RegExp(`^${subdomain}\\.${DEFAULT_STOREFRONT_DOMAIN.replaceAll('.','\\.')}$`)})).toBeVisible();
  await page.getByLabel('Homepage title',{exact:true}).fill('Synthetic Core Search Listing');const [seoSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/settings')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save changes',exact:true}).click()]);assert.equal(seoSaved.status(),200);
  await page.goto(`${merchantOrigin}/${subdomain}/settings/general`);await expect(page.locator('.settings-general-seo-preview-url')).toHaveText(`${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`);await expect(page.locator('.settings-general-seo-preview-title')).toHaveText('Synthetic Core Search Listing');
  console.info('OWNED_NATIVE_CORE '+JSON.stringify({nativeWorkerd:true,nativeR2:true,seededAccount:false,seededStore:false,seededProduct:false,productionApps:3,providerFixtureOnly:true,store,productVariants:2,uploadedExactPng:true,imageDimensions:[320,320],normalEditorPublish:true,unpublishedPreviewVerified:true,merchantDomainLabelsVerified:true,preferencesSeoReadback:true,anonymousDraftDenied:true,presets,realTenantTlsHost:true,actualScheduledSearchIndex:true,manualCollectionShopperVerified:true,searchSubmissionVerified:true,canonicalBuyerProfileAddressVerified:true,buyerAddressCrudVerified:true,staleAccountWriteDenied:true,canonicalBuyers:2,unrelatedOrderDenied:true,searchScreenshot,accountScreenshot,addressScreenshot,customerOrders:orders.length,codTotalMinor:orders[0].total,screenshot,publicScreenshot,orderScreenshot}));
  assert.doesNotMatch(signupCopy,/₹20|14 days free/);
 }catch(error){console.info('OWNED_NATIVE_CORE_FAILURE '+JSON.stringify({stage,path:page?new URL(page.url()).pathname:null,buyer:buyerDiagnostic?{host:new URL(buyerDiagnostic.url()).host,path:new URL(buyerDiagnostic.url()).pathname}:null,storeState:owned.psql(`SELECT coalesce(jsonb_agg(jsonb_build_object('status',status,'published',published,'accessMode',access_mode,'theme',theme_id))::text,'[]') FROM sites WHERE subdomain='${subdomain}';`),calls:calls.slice(-15).map(({path,status})=>({path:path.replace(/ct_[A-Za-z0-9_-]+/g,'[redacted-cart-token]'),status})),errors:errors.slice(-3).map(s=>s.replace(/https?:\/\/[^\s"<>]+/g,'[redacted-url]'))}));throw new Error((error instanceof Error?error.message:String(error)).replace(/https?:\/\/[^\s"<>]+/g,'[redacted-url]'));
 }finally{await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await stopOwnedClientRuntime(commerce);await gateway?.settle();await pooled.stop();if(tls){tls.closeAllConnections();await new Promise<void>(r=>tls!.close(()=>r()));}if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}}
});
