// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Proposed normal Identity -> maintained product UI/BFF -> Gateway -> owned DB proof.
// Official Turnstile test transport is not production anti-bot/inbox acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer,type Server} from 'node:http';
import {exportJWK} from 'jose';
import {chromium,expect,type Page} from '@playwright/test';
import {hashMerchantPassword} from '../../services/api-gateway/src/lib/merchant-password';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET,tapRest,restJson} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned=requireOwnedDatabase();
async function port(){const s=createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const p=(s.address() as {port:number}).port;await new Promise<void>(r=>s.close(()=>r()));return p;}
async function ready(url:string,child:OwnedClientProcess){
 const end=Date.now()+300000;
 while(Date.now()<end){if(child.exitCode!==null||child.signalCode!==null)throw new Error('Owned app exited before readiness');
  try{if((await fetch(url,{signal:AbortSignal.timeout(2000)})).status<500)return;}catch{}
  await new Promise(r=>setTimeout(r,200));
 }throw new Error('Owned app readiness timeout');
}
async function login(page:Page,identity:string,merchant:string,email:string,password:string){
 await page.goto(identity+'/login');await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:30000});
 await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Continue with email',exact:true}).click();
 await page.getByLabel('Password',{exact:true}).fill(password);
 const [r]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST'),page.getByRole('button',{name:'Log in',exact:true}).click()]);
 assert.equal(r.status(),200);await page.waitForURL(u=>u.origin===merchant,{timeout:60000});
}
test('normal product creation preserves persisted restrictions and actionable refusal through the maintained BFF',{timeout:1050000},async t=>{
 const site=newSyntheticTenant('ent-web-'+crypto.randomUUID().slice(0,6));seedSyntheticTenant(owned.psql,site);
 const owner=crypto.randomUUID(),email='syn-ent-web-'+owner+'@example.invalid',password='Synthetic-entitlement-browser-42',hash=await hashMerchantPassword(password),restriction=crypto.randomUUID();
 owned.psql("INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES('"+owner+"','"+email+"',true,'Synthetic Entitlement Owner','"+hash+"'); UPDATE sites SET custom_user_id='"+owner+"' WHERE id='"+site.siteId+"'; INSERT INTO site_entitlement_overrides(id,site_id,limits,reason) VALUES('"+restriction+"','"+site.siteId+"','{\"products\":0}'::jsonb,'Synthetic explicit creation restriction');");
 const state=()=>JSON.parse(owned.psql("SELECT jsonb_build_object('products',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM products p WHERE store_id='"+site.siteId+"'),'inventory',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM inventory_levels i WHERE store_id='"+site.siteId+"'),'meters',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM site_usage_meters m WHERE site_id='"+site.siteId+"'),'usage',(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM usage_meter_entries u WHERE site_id='"+site.siteId+"'));"));
 const ip=await port();let mp=await port();for(let i=0;mp===ip&&i<5;i++)mp=await port();assert.notEqual(mp,ip);
 const identityOrigin='http://localhost:'+ip,merchantOrigin='http://localhost:'+mp,keys=await newIdentityKeys();
 const gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin}));
 const originalFetch=globalThis.fetch,external:string[]=[],browserProvider:string[]=[];
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)){external.push(u.hostname);throw new Error('Owned entitlement browser forbids external Gateway transport');}
  return originalFetch(input,init);
 }) as typeof fetch;
 let unavailable=false,faults=0;
 const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
  if(unavailable&&call.resource==='rpc/resolve_site_entitlements'){faults++;return restJson(503,{code:'PGRST202',message:'Could not find public.resolve_site_entitlements in the schema cache'});}
  return forward();
 });
 let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined,browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try{
  bridge=createServer(async(req,res)=>{
   const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString(),headers=new Headers();
   for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   try{const result=await gateway.request(req.url||'/',{method:req.method,headers,...(body?{body}:{})});res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);}
   catch{res.writeHead(500);res.end('{}');}
  });await new Promise<void>(r=>bridge!.listen(0,'127.0.0.1',r));
  const api='http://127.0.0.1:'+(bridge.address() as {port:number}).port;
  const shared={INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:ip,env:{...shared,LETBUYY_API_URL:api+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:mp,env:{...shared,LETBUYY_API_BASE_URL:api+'/v1'}});
  await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant)]);
  browser=await chromium.launch({headless:true});const context=await browser.newContext();
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(['localhost','127.0.0.1','challenges.cloudflare.com'].includes(u.hostname))return route.continue();if(/razorpay|cashfree|resend/.test(u.hostname))browserProvider.push(u.hostname);return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(60000);
  await login(page,identityOrigin,merchantOrigin,email,password);
  const target=merchantOrigin+'/'+site.subdomain+'/products/new',endpoint='/api/stores/'+site.subdomain+'/products';
  await page.goto(target);await page.getByLabel('Title',{exact:true}).fill('Synthetic Restricted Product');await page.getByLabel('Price',{exact:true}).fill('199');
  const save=async()=>{const [r]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===endpoint&&r.request().method()==='POST'),page.getByRole('button',{name:'Save product',exact:true}).click()]);return r;};
  const before=state();
  await t.test('current persisted zero limit refuses normal UI/BFF creation403 with no effects',async()=>{
   const r=await save();assert.equal(r.status(),403,await r.text());assert.match(await r.text(),/Product limit reached/);
   await expect(page.getByText('Product needs attention',{exact:true})).toBeVisible();assert.equal(new URL(page.url()).pathname,new URL(target).pathname);
   assert.deepEqual(state(),before);
  });
  await t.test('named resolver outage refuses normal UI/BFF creation503 with actionable failure and no effects',async()=>{
   unavailable=true;const r=await save();assert.equal(r.status(),503,await r.text());assert.match(await r.text(),/ENTITLEMENT_AUTHORITY_UNAVAILABLE/);
   assert.ok(faults>0);await expect(page.getByText('Product needs attention',{exact:true})).toBeVisible();
   await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Synthetic Restricted Product');assert.deepEqual(state(),before);
  });
  await t.test('restored persisted authority permits a new normal retry and exactly one product',async()=>{
   unavailable=false;owned.psql("UPDATE site_entitlement_overrides SET limits='{\"products\":2}'::jsonb WHERE id='"+restriction+"';");
   const r=await save();assert.equal(r.status(),201,await r.text());await page.waitForURL(u=>u.pathname==='/'+site.subdomain+'/products');
   const after=state();assert.equal(after.products.length,1);assert.equal(after.products[0].name,'Synthetic Restricted Product');assert.equal(after.products[0].store_id,site.siteId);
  });
  assert.deepEqual(external,[]);assert.deepEqual(browserProvider,[]);
  console.info('N2_ENTITLEMENT_NORMAL_BROWSER '+JSON.stringify({normalIdentity:true,maintainedUI:true,subtests:3,paymentOrEmailProviderRequests:0,externalGatewayRequests:0}));
 }finally{
  await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await gateway.settle();tap.restore();globalThis.fetch=originalFetch;
  if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}
 }
});

