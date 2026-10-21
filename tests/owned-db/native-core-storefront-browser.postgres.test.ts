// Labelled local fixtures: synthetic accounts and public Turnstile test keys only.
// No seeded user, session, verified email, password or store. Resend HTTP is captured;
// this is provider-fixture acceptance, not real inbox delivery or hosted cookie proof.
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer,request as forwardHttpRequest,type Server} from 'node:http';
import {createServer as createHttpsServer,type Server as HttpsServer} from 'node:https';
import {createRequire,builtinModules} from 'node:module';
import {Miniflare} from 'miniflare';
import {DEFAULT_STOREFRONT_DOMAIN} from '@letbuyy/shared-types';
import {exportJWK} from 'jose';
import {chromium,expect,type Page} from '@playwright/test';
import {gatewayEnv,newIdentityKeys,INTERNAL_SECRET,nextClientAddress} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
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
class NativeGateway {
 private constructor(readonly mf:Miniflare){}
 static async create(env:Record<string,unknown>,capture:(request:Request)=>Promise<Response>){
  const req=createRequire(new URL('../../services/api-gateway/package.json',import.meta.url));
  const compiler=createRequire(req.resolve('wrangler'))('esbuild') as {build(options:unknown):Promise<{outputFiles?:{text:string}[]}>};
  const result=await compiler.build({entryPoints:[new URL('../../services/api-gateway/src/index.ts',import.meta.url).pathname],absWorkingDir:new URL('../..',import.meta.url).pathname,
   bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',tsconfig:'services/api-gateway/tsconfig.json',external:['cloudflare:*','node:*'],conditions:['workerd','worker','browser'],logLevel:'silent',
   banner:{js:"import { createRequire as nativeCreateRequire } from 'node:module'; const require = nativeCreateRequire('file:///letbuyy-owned-gateway.mjs');"},
   plugins:[{name:'native-node-builtins',setup(build:{onResolve(options:{filter:RegExp},handler:(args:{path:string})=>{path:string;external:true}|undefined):void}){const native=new Set(builtinModules);build.onResolve({filter:/^[a-z][\w/]*$/},args=>native.has(args.path)?{path:'node:'+args.path,external:true}:undefined);}}]});
  assert.equal(result.outputFiles?.length,1);const restOrigin=new URL(String(env.SUPABASE_URL)).origin;
  const mf=new Miniflare({modules:true,script:result.outputFiles![0].text,compatibilityDate:'2026-05-25',compatibilityFlags:['nodejs_compat'],cf:false,
   durableObjects:{RUNTIME_COORDINATOR:{className:'LetbuyyRuntimeDurableObject',useSQLite:true}},durableObjectsPersist:false,r2Buckets:['REEL_ORIGINALS_BUCKET','R2_BUCKET'],r2Persist:false,bindings:env as never,
   outboundService:async(request:Request)=>{const url=new URL(request.url);if(url.origin==='https://api.resend.com')return await capture(request) as never;
    assert.equal(url.origin,restOrigin,'native Gateway may reach only its owned REST service or the explicit email fixture');
    return await fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers.entries()),body:['GET','HEAD'].includes(request.method)?undefined:request.body,duplex:'half',redirect:'error'} as RequestInit) as never;}});
  try{await mf.ready;return new NativeGateway(mf);}catch(error){await mf.dispose();throw error;}
 }
 async dispatch(path:string,init:RequestInit){const headers=new Headers(init.headers);headers.set('CF-Connecting-IP',nextClientAddress());return this.mf.dispatchFetch('https://gateway.test'+path,{...init,headers} as never);}
 async settle(){await this.mf.dispose();}
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
 let gateway:NativeGateway|undefined,tls:HttpsServer|undefined,commerce:OwnedClientProcess|undefined,stage='build';
 let commerceOrigin='',checkoutOrigin='',tlsSpki='';
 let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined;
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined,buyerDiagnostic:Page|undefined;
 const calls:{path:string;status:number;key?:string}[]=[],errors:string[]=[];
 try{
  bridge=createServer(async(req,res)=>{
   const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks),headers=new Headers();
   for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   try{const result=await gateway!.dispatch(req.url??'/',{method:req.method,headers,...(body.length?{body}:{})});
    calls.push({path:(req.url??'/').split('?')[0],status:result.status,key:headers.get('X-Idempotency-Key')||undefined});res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(Buffer.from(await result.arrayBuffer()));
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
   RESEND_API_KEY:'synthetic-owned-resend-capture',CHECKOUT_ORIGIN:checkoutOrigin,CHECKOUT_SIGNING_SECRET:crypto.randomUUID()+crypto.randomUUID(),UPLOAD_PUBLIC_BASE_URL:`https://api.localhost:${tlsPort}/assets`}),DATABASE_URL:pooled.env().HYPERDRIVE.connectionString};delete (env as Record<string,unknown>).HYPERDRIVE;
  gateway=await NativeGateway.create(env,capture);
  const shared={CHECKOUT_ORIGIN:checkoutOrigin,NEXT_PUBLIC_STOREFRONT_URL:commerceOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:DEFAULT_STOREFRONT_DOMAIN,LETBUYY_INTERNAL_API_SECRET:INTERNAL_SECRET,INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,hostMode:'canonical-storefront-loopback',env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
   NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,hostMode:'canonical-storefront-loopback',env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
  commerce=startOwnedClientRuntime(owned,'commerce-next-production',{port:commercePort,hostMode:'canonical-storefront-loopback',env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1',LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'}});
  for(const app of [identity,merchant,commerce])app.stderr.on('data',d=>errors.push(d.toString().slice(0,600)));
  await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant),ready(commerceHttpOrigin+'/api/buyer-auth/session',commerce)]);
  browser=await chromium.launch({headless:true,args:[`--ignore-certificate-errors-spki-list=${tlsSpki}`,'--no-proxy-server',`--host-resolver-rules=MAP *.${DEFAULT_STOREFRONT_DOMAIN} 127.0.0.1, MAP ${DEFAULT_STOREFRONT_DOMAIN} 127.0.0.1, MAP checkout.localhost 127.0.0.1, MAP api.localhost 127.0.0.1`]});const context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(60_000);  stage='native-signup';const signup=await page.goto(identityOrigin+'/signup');assert.equal(signup?.status(),200);
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
  stage='native-onboarding';await page.getByRole('button',{name:/Online Store/}).click();await page.getByLabel('Display Name',{exact:true}).fill('Synthetic Public Store');
  await page.getByLabel('Subdomain',{exact:true}).fill(subdomain);await expect(page.getByRole('button',{name:'Next',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByLabel('Industry',{exact:true}).selectOption('food');
  const [created]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/create-store'&&r.request().method()==='POST'),page.getByRole('button',{name:'Create My Site',exact:true}).click()]);assert.equal(created.status(),200);
  await page.waitForURL(u=>u.origin===merchantOrigin&&u.pathname===`/${subdomain}/access_account/checkout/select-plan`,{timeout:60_000});await expect(page.getByRole('region',{name:'Available plans'})).toBeVisible();
  const store=JSON.parse(owned.psql(`SELECT jsonb_build_object('count',count(*),'trial_days',max(EXTRACT(EPOCH FROM (trial_ends_at-trial_started_at))/86400),'theme',max(theme_id),'status',max(status))::text FROM sites WHERE custom_user_id=(SELECT id FROM users_custom WHERE email='${email}') AND subdomain='${subdomain}';`));assert.equal(store.count,1);assert.equal(store.trial_days,14,'existing persisted trial policy is preserved');assert.equal(store.status,'draft');
  await page.goto(`${merchantOrigin}/${subdomain}/dashboard`);await expect(page.getByRole('heading',{name:'Where do you want to start?',exact:true})).toBeVisible();
  const siteId=owned.psql(`SELECT id FROM sites WHERE subdomain='${subdomain}';`),productName='Synthetic Native Variant Product';
  assert.equal(store.theme,'letbuyy-core');assert.equal(owned.psql(`SELECT template_config->'liquidBundle'->'package'->>'slug' FROM sites WHERE id='${siteId}';`),'letbuyy-core-liquid');
  await expect(page.locator('body')).toContainText(`${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`);
  stage='product-create';await page.goto(`${merchantOrigin}/${subdomain}/products/new`);
  await page.getByLabel('Title',{exact:true}).fill(productName);await page.getByLabel('Price',{exact:true}).fill('199');await page.getByLabel('Product status',{exact:true}).selectOption('active');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  const uploaded=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/upload')&&r.request().method()==='POST');
  await page.locator('input[type="file"]').setInputFiles({name:'synthetic-core-product.png',mimeType:'image/png',buffer:png});
  const upload=await uploaded;assert.equal(upload.status(),201);const imageUrl=(await upload.json()).data.url;
  await expect(page.locator(`img[src="${imageUrl}"]`)).toBeVisible();await expect.poll(()=>page!.locator(`img[src="${imageUrl}"]`).evaluate(n=>(n as HTMLImageElement).naturalWidth)).toBe(1);
  const raw=await gateway.dispatch(new URL(imageUrl).pathname,{method:'GET'});assert.equal(raw.status,200);assert.deepEqual(Buffer.from(await raw.arrayBuffer()),png);
  await page.getByRole('button',{name:'Add option',exact:true}).click();await page.getByPlaceholder('Option name (Size, Color, Material)').fill('Size');await page.getByRole('button',{name:'Done',exact:true}).click();
  for(const value of ['Small','Large']){await page.getByPlaceholder('Add value',{exact:true}).fill(value);await page.getByRole('button',{name:'Add value',exact:true}).click();}
  for(const [title,price,stock]of [['Small','199','3'],['Large','249','4']]){await page.getByLabel(`Price for ${title}`,{exact:true}).fill(price);await page.getByLabel(`Stock for ${title}`,{exact:true}).fill(stock);await page.getByLabel(`SKU for ${title}`,{exact:true}).fill('SYN-CORE-'+title);}
  const [saved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/products')&&r.request().method()==='POST'),page.getByRole('button',{name:'Save product',exact:true}).click()]);assert.equal(saved.status(),201);
  const productId=owned.psql(`SELECT id FROM products WHERE store_id='${siteId}' AND name='${productName}';`);assert.match(productId,/^[a-f0-9-]{36}$/);assert.equal(owned.psql(`SELECT count(*) FROM product_variants WHERE product_id='${productId}';`),'2');
  await page.goto(`${merchantOrigin}/${subdomain}/products/${productId}`);await expect(page.getByLabel('Title',{exact:true})).toHaveValue(productName);await expect(page.getByLabel('Stock for Small',{exact:true})).toHaveValue('3');
  stage='shipping-config';await page.goto(`${merchantOrigin}/${subdomain}/settings/shipping`);await page.getByRole('button',{name:'Add zone',exact:true}).first().click();await page.getByLabel('Zone name',{exact:true}).fill('Synthetic native zone');await page.getByLabel('Countries',{exact:true}).fill('IN');
  await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/shipping/zones')&&r.request().method()==='POST'),page.getByRole('button',{name:'Add zone',exact:true}).last().click()]);
  await page.getByRole('button',{name:'Add rate',exact:true}).click();await page.getByLabel('Rate name',{exact:true}).fill('Synthetic native delivery');await page.getByLabel('Price (₹, 0 for free)',{exact:true}).fill('20');
  const [rateSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/shipping/rates')&&r.request().method()==='POST'),page.getByRole('button',{name:'Add rate',exact:true}).last().click()]);assert.equal(rateSaved.status(),201);
  stage='core-editor-publish';await page.goto(`${merchantOrigin}/${subdomain}/online-store/themes/letbuyy-core/editor`);await expect(page.getByRole('tree',{name:'Template sections',exact:true})).toBeVisible();
  await page.getByRole('tree',{name:'Template sections',exact:true}).getByRole('treeitem').filter({hasText:/Hero/}).first().click();const marker='Synthetic Native Core Ready';
  const draftReply=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/editor/draft')&&r.request().method()==='POST'&&Boolean(r.request().postData()?.includes(marker)));await page.getByLabel('Heading',{exact:true}).fill(marker);assert.equal((await draftReply).status(),200);
  await expect(page.frameLocator('iframe.te-preview-iframe').locator('[data-letbuyy-preview-route="true"]')).toBeVisible({timeout:90_000});
  assert.equal(owned.psql(`SELECT published FROM sites WHERE id='${siteId}';`),'f','the owner preview does not open the public store');
  const draftContext=await browser.newContext(),draftVisitor=await draftContext.newPage();const draftResponse=await draftVisitor.goto(`https://${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}:${tlsPort}`);assert.equal(draftResponse?.status(),401);await draftContext.close();
  await expect(page.frameLocator('iframe.te-preview-iframe').locator('[data-letbuyy-preview-route="true"]')).toContainText(marker,{timeout:30_000});await expect(page.locator('.te-preview-url')).toHaveText(`${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`);
  const screenshot=`${tmpdir()}/letbuyy-native-core-${owned.runId}.png`;await page.screenshot({path:screenshot,fullPage:true});
  await expect(page.getByRole('button',{name:'Save',exact:true}).first()).toBeDisabled();const [published]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/themes/letbuyy-core/editor'&&r.request().method()==='PUT'),page.getByRole('button',{name:'Publish',exact:true}).click()]);assert.equal(published.status(),200);
  assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${siteId}';`),'published');
  stage='public-tenant-storefront';const buyerContext=await browser.newContext(),buyer=await buyerContext.newPage();buyerDiagnostic=buyer;buyer.setDefaultTimeout(30_000);buyer.setDefaultNavigationTimeout(60_000);
  const tenantOrigin=`https://${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}:${tlsPort}`;const home=await buyer.goto(tenantOrigin);assert.equal(home?.status(),200);await expect(buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]')).toBeVisible();await expect(buyer.getByRole('heading',{level:1}).first()).toHaveText(marker);await expect(buyer.getByText('Discover our latest products.',{exact:true})).toBeVisible();await expect(buyer.getByText('Free shipping on fresh drops this week.',{exact:true})).toHaveCount(0);
  const publicScreenshot=`${tmpdir()}/letbuyy-native-core-store-${owned.runId}.png`;await buyer.screenshot({path:publicScreenshot,fullPage:true});
  stage='ten-core-presets';const presets=[];
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
   for(const width of [1280,360]){
    await buyer.setViewportSize({width,height:900});const document=await buyer.goto(tenantOrigin,{waitUntil:'networkidle'});assert.equal(document?.status(),200);assert.match(document!.headers()['cache-control']||'',/no-store/);
    const rendered=buyer.locator('[data-theme-renderer="liquid"][data-editor-mode="false"]');await expect(rendered).toBeVisible();assert.equal(await rendered.evaluate(el=>getComputedStyle(el).getPropertyValue('--primary').trim()),reference.primaryColor);
    assert.equal(await buyer.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+1),true);
   }
   presets.push({name,applied:true,reloaded:true,published:true,exactStoredValues:true,widths:[1280,360],renderedPrimary:true});
  }
  await buyer.setViewportSize({width:1280,height:900});
  await buyer.getByRole('button',{name:'Choose options',exact:true}).first().click();await buyer.waitForURL(url=>url.pathname===`/product/${productId}`);assert.equal(await buyer.evaluate(()=>JSON.parse(localStorage.getItem('lb_cart')||'[]').length),0,'variant card opens the picker without adding an unspecified product');await buyer.goto(tenantOrigin);
  await buyer.getByRole('link',{name:'Catalog',exact:true}).click();await buyer.locator(`a[href="/product/${productId}"]`).filter({hasText:productName}).first().click();await expect(buyer.locator(`img[src="${imageUrl}"]`).first()).toBeVisible();
  await buyer.waitForFunction(()=>Boolean(customElements.get('lb-add-to-cart')&&customElements.get('lb-variant-picker')));await expect(buyer.getByRole('button',{name:'Buy now',exact:true})).toBeDisabled();await buyer.getByRole('button',{name:'Large',exact:true}).click();await expect(buyer.getByRole('button',{name:'Buy now',exact:true})).toBeEnabled();stage='customer-handoff';console.info('OWNED_NATIVE_CORE_PRESETS '+JSON.stringify({nativeWorkerd:true,nativeR2:true,presets,publicScreenshot}));const [handoff]=await Promise.all([buyer.waitForResponse(r=>new URL(r.url()).pathname==='/api/checkout-handoff'&&r.request().method()==='POST'),buyer.getByRole('button',{name:'Buy now',exact:true}).click()]);assert.equal(handoff.status(),200,'configured hosted checkout handoff');await buyer.waitForURL(u=>u.hostname==='checkout.localhost'&&u.pathname==='/checkout');
  stage='customer-cod-order';await buyer.getByPlaceholder('John Doe').fill('Synthetic Native Buyer');await buyer.getByPlaceholder('9876543210').fill('9000000099');await buyer.getByPlaceholder('john@example.com').fill('syn-native-buyer@example.invalid');await buyer.getByPlaceholder('House/Flat No, Street, Landmark...').fill('Synthetic Native Road');await buyer.getByPlaceholder('Bengaluru').fill('Bengaluru');await buyer.locator('select').first().selectOption('29');await buyer.getByPlaceholder('560001').fill('560001');
  await buyer.getByRole('button',{name:/Synthetic native delivery/}).click();await buyer.getByRole('button',{name:'Continue to Payment',exact:true}).click();await buyer.getByRole('radio',{name:/Cash on Delivery \(COD\)/}).check();await buyer.getByRole('button',{name:'Confirm COD order',exact:true}).click();await expect(buyer.getByRole('heading',{name:'Order Confirmed!',exact:true})).toBeVisible();
  const orders=JSON.parse(owned.psql(`SELECT coalesce(json_agg(json_build_object('id',id,'method',payment_method,'total',(total*100)::bigint)), '[]'::json) FROM orders WHERE site_id='${siteId}';`));assert.equal(orders.length,1);assert.equal(orders[0].method,'cod');assert.equal(orders[0].total,26900);
  assert.equal(owned.psql(`SELECT count(*) FROM order_items WHERE order_id='${orders[0].id}' AND variant_id=(SELECT id::text FROM product_variants WHERE product_id='${productId}' AND title='Large');`),'1');
  assert.equal(owned.psql(`SELECT (amount*100)::bigint FROM order_shipping_lines WHERE order_id='${orders[0].id}';`),'2000');
  assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE store_id='${siteId}' AND aggregate_id='${orders[0].id}' AND event_type='order.paid';`),'0','unpaid COD must not be announced as paid');
  const orderScreenshot=`${tmpdir()}/letbuyy-native-core-order-${owned.runId}.png`;await buyer.screenshot({path:orderScreenshot,fullPage:true});await buyerContext.close();
  stage='merchant-order-readback';await page.goto(`${merchantOrigin}/${subdomain}/orders`);await expect(page.getByText('Synthetic Native Buyer',{exact:true}).filter({visible:true}).first()).toBeVisible({timeout:30_000});
  stage='merchant-domain-labels';await page.goto(`${merchantOrigin}/${subdomain}/settings/domains`);await expect(page.locator('.domains-row-domain').filter({hasText:`${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`})).toBeVisible();
  await page.goto(`${merchantOrigin}/${subdomain}/online-store/preferences`);await expect(page.getByLabel('Homepage title',{exact:true})).toBeVisible();await expect(page.locator('p').filter({hasText:new RegExp(`^${subdomain}\\.${DEFAULT_STOREFRONT_DOMAIN.replaceAll('.','\\.')}$`)})).toBeVisible();
  await page.getByLabel('Homepage title',{exact:true}).fill('Synthetic Core Search Listing');const [seoSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/settings')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save changes',exact:true}).click()]);assert.equal(seoSaved.status(),200);
  await page.goto(`${merchantOrigin}/${subdomain}/settings/general`);await expect(page.locator('.settings-general-seo-preview-url')).toHaveText(`${subdomain}.${DEFAULT_STOREFRONT_DOMAIN}`);await expect(page.locator('.settings-general-seo-preview-title')).toHaveText('Synthetic Core Search Listing');
  console.info('OWNED_NATIVE_CORE '+JSON.stringify({nativeWorkerd:true,nativeR2:true,seededAccount:false,seededStore:false,seededProduct:false,productionApps:3,providerFixtureOnly:true,store,productVariants:2,uploadedExactPng:true,normalEditorPublish:true,unpublishedPreviewVerified:true,merchantDomainLabelsVerified:true,preferencesSeoReadback:true,anonymousDraftDenied:true,presets,realTenantTlsHost:true,customerOrders:orders.length,codTotalMinor:orders[0].total,screenshot,publicScreenshot,orderScreenshot}));
  assert.doesNotMatch(signupCopy,/₹20|14 days free/);
 }catch(error){console.info('OWNED_NATIVE_CORE_FAILURE '+JSON.stringify({stage,path:page?new URL(page.url()).pathname:null,buyer:buyerDiagnostic?{host:new URL(buyerDiagnostic.url()).host,path:new URL(buyerDiagnostic.url()).pathname}:null,storeState:owned.psql(`SELECT coalesce(jsonb_agg(jsonb_build_object('status',status,'published',published,'accessMode',access_mode,'theme',theme_id))::text,'[]') FROM sites WHERE subdomain='${subdomain}';`),calls:calls.slice(-15).map(({path,status})=>({path:path.replace(/ct_[A-Za-z0-9_-]+/g,'[redacted-cart-token]'),status})),errors:errors.slice(-3).map(s=>s.replace(/https?:\/\/[^\s"<>]+/g,'[redacted-url]'))}));throw new Error((error instanceof Error?error.message:String(error)).replace(/https?:\/\/[^\s"<>]+/g,'[redacted-url]'));
 }finally{await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await stopOwnedClientRuntime(commerce);await gateway?.settle();await pooled.stop();if(tls){tls.closeAllConnections();await new Promise<void>(r=>tls!.close(()=>r()));}if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}}
});
