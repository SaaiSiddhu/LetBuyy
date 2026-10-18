// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// N1.3: normal Chromium UI -> Identity issuer -> Commerce PKCE callback -> actual Gateway/ownedDB.
// Cloudflare's official test keys exercise real widget/Siteverify transport. They cannot prove
// production anti-bot behavior. No app dev auth bypass, token injection, fake API or route interception.
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import test from 'node:test';
import {exportJWK} from 'jose';
import {chromium,expect,type Page} from '@playwright/test';
import {LETBUYY_BUYER_SESSION_COOKIE} from '@letbuyy/auth-core';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET} from './gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';

const owned=requireOwnedDatabase();
const stores=[newSyntheticTenant('browser-session-a'),newSyntheticTenant('browser-session-b')];
const TEST_SITE_KEY='1x00000000000000000000AA';
const TEST_SECRET_KEY='1x0000000000000000000000000000000AA';
async function port() {
 const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const value=(server.address() as {port:number}).port;await new Promise<void>(resolve=>server.close(()=>resolve()));return value;
}
async function ready(origin:string,path:string,process:OwnedClientProcess) {
 const deadline=Date.now()+240_000;
 while(Date.now()<deadline) {
  if(process.exitCode!==null||process.signalCode!==null)throw new Error('owned browser runtime stopped before readiness');
  try {const res=await fetch(origin+path,{signal:AbortSignal.timeout(2500)});if(res.status<500)return;}catch{/* real Next compilation */}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw new Error('owned browser runtime did not become ready');
}

test('built Commerce and Identity support normal registration/consent/PKCE, account Links, profile/address, restart and two-buyer isolation across real boundaries',{timeout:540_000},async()=>{
 for(const store of stores)seedSyntheticTenant(owned.psql,store);
 const keys=await newIdentityKeys();const identityPort=await port(),commercePort=await port();
 const identityOrigin=`http://localhost:${identityPort}`;
 const storeOrigin=`http://${stores[0].subdomain}.localhost:${commercePort}`;
 const otherOrigin=`http://${stores[1].subdomain}.localhost:${commercePort}`;
 const gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:'localhost'}));
 const calls:{path:string;status:number}[]=[];
 let adapter:Server|undefined,identity:OwnedClientProcess|undefined,commerce:OwnedClientProcess|undefined;
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 let page:Page|undefined;const failures:string[]=[];const nextErrors:string[]=[];const nextRequests:string[]=[];const navigationResponses:unknown[]=[];const consoleErrors:string[]=[];
 try {
  adapter=createServer(async(request,response)=>{
   const chunks:Buffer[]=[];for await(const chunk of request)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks).toString();
   const headers=new Headers();for(const[name,value]of Object.entries(request.headers))if(typeof value==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(name))headers.set(name,value);
   try {const result=await gateway.request(request.url??'/',{method:request.method,headers,...(body?{body}:{})});
    calls.push({path:request.url??'/',status:result.status});response.writeHead(result.status,Object.fromEntries(result.headers.entries()));response.end(result.text);
   }catch{response.writeHead(500);response.end('{}');}
  });
  await new Promise<void>(resolve=>adapter!.listen(0,'127.0.0.1',resolve));const apiOrigin=`http://127.0.0.1:${(adapter.address() as {port:number}).port}`;
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,env:{NODE_ENV:'production',LETBUYY_API_URL:apiOrigin+'/v1',INTERNAL_API_SECRET:INTERNAL_SECRET,
   LETBUYY_IDENTITY_ISSUER:identityOrigin,LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),
   NEXT_PUBLIC_TURNSTILE_SITE_KEY:TEST_SITE_KEY,TURNSTILE_SECRET_KEY:TEST_SECRET_KEY,LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'}});
  await ready(identityOrigin,'/api/buyer/login',identity);
  commerce=startOwnedClientRuntime(owned,'commerce-next-production',{port:commercePort,env:{LETBUYY_API_BASE_URL:apiOrigin+'/v1',NEXT_PUBLIC_API_URL:apiOrigin+'/v1',
   NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,INTERNAL_API_SECRET:INTERNAL_SECRET}});
  commerce.stdout.on('data',data=>{for(const line of data.toString().split('\n'))if(/(?:GET|POST|Compil)/.test(line))nextRequests.push(line.replace(/\?[^\s]+/g,'?redacted').slice(0,400));});
  commerce.stderr.on('data',data=>nextErrors.push(data.toString().slice(0,800)));
  await ready(`http://localhost:${commercePort}`,'/api/buyer-auth/session',commerce);
  browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP *.localhost 127.0.0.1']});
  let context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(20_000);page.setDefaultNavigationTimeout(60_000);
  page.on('pageerror',error=>consoleErrors.push(error.message));
  page.on('requestfailed',request=>failures.push(new URL(request.url()).origin+new URL(request.url()).pathname+': '+request.failure()?.errorText));
  page.on('response',response=>{const url=new URL(response.url());if(url.pathname.includes('/account'))navigationResponses.push({path:url.pathname,rsc:url.searchParams.has('_rsc'),status:response.status(),type:response.headers()['content-type'],redirect:response.headers().location});if(response.status()>=400)failures.push(String(response.status())+' '+new URL(response.url()).origin+new URL(response.url()).pathname);});
  const email='syn-browser-'+crypto.randomUUID()+'@example.invalid',password='Synthetic-browser-pass-42';
  await page.goto(storeOrigin+'/customers/login');
  await page.getByRole('link',{name:'Continue with LetBuyy',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Create an account',exact:true}).click();
  // The real widget success proves this newly navigated page has hydrated before typing.
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:20_000});
  await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
  const createAccount=page.getByRole('button',{name:'Create account',exact:true});
  await expect(createAccount).toBeEnabled({timeout:20_000});
  const [registered]=await Promise.all([page.waitForResponse(res=>res.url().endsWith('/api/buyer/register')&&res.request().method()==='POST'),createAccount.click()]);assert.equal(registered.status(),201);
  await expect(page.getByText(email,{exact:true})).toBeVisible();
  assert.equal(new URL(page.url()).origin,identityOrigin,'registration waits for explicit buyer consent');
  assert.equal(owned.psql(`SELECT count(*) FROM buyer_accounts WHERE email='${email}';`),'1');
  const buyerId=owned.psql(`SELECT id FROM buyer_accounts WHERE email='${email}';`);
  await page.getByRole('button',{name:`Continue to Synthetic ${stores[0].tag}`,exact:true}).click();
  await page.waitForURL(url=>url.origin===storeOrigin&&url.pathname.endsWith('/account/orders'),{timeout:30_000});
  await page.locator('aside').getByRole('link',{name:'Settings',exact:true}).click();
  await page.waitForURL(url=>url.origin===storeOrigin&&url.pathname.endsWith('/account/settings'));
  const session=await context.request.get(storeOrigin+'/api/buyer-auth/session');assert.equal(session.status(),200);assert.equal((await session.json()).buyer.id,buyerId);
  const cookies=await context.cookies();const storeCookie=cookies.find(cookie=>cookie.name==='__Host-lb_store_buyer');assert.ok(storeCookie);
  assert.equal(storeCookie.domain,stores[0].subdomain+'.localhost');assert.equal(storeCookie.httpOnly,true);assert.equal(storeCookie.secure,true);assert.equal(storeCookie.sameSite,'Lax');
  assert.equal(cookies.filter(cookie=>cookie.name==='__Host-lb_buyer_auth').length,0,'PKCE flow cookie is cleared');
  assert.equal((await context.cookies(otherOrigin)).some(cookie=>cookie.name==='__Host-lb_store_buyer'),false,'a sibling store never receives this credential');
  assert.equal((await (await context.request.get(otherOrigin+'/api/buyer-auth/session')).json()).buyer,null);
  await expect(page.getByLabel('Full name',{exact:true})).toBeVisible({timeout:30_000});await page.getByLabel('Full name',{exact:true}).fill('Synthetic Browser Profile');
  await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect.poll(()=>owned.psql(`SELECT full_name FROM buyer_accounts WHERE id='${buyerId}';`)).toBe('Synthetic Browser Profile');
  const state=await context.storageState();await context.close();context=await browser.newContext({storageState:state});page=await context.newPage();
  page.on('pageerror',error=>consoleErrors.push(error.message));
  await page.goto(storeOrigin+'/account/settings');await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Synthetic Browser Profile');
  await page.locator('aside').getByRole('link',{name:'Addresses',exact:true}).click();
  await page.waitForURL(url=>url.pathname.endsWith('/account/addresses'));
  await page.getByRole('button',{name:'Add Address',exact:true}).click();
  await expect(page.getByRole('heading',{name:'New Address',exact:true})).toBeVisible();
  for(const [placeholder,value] of [['Full Name *','Synthetic Browser Profile'],['Address Line 1 *','123 Browser A Street'],['City *','Bengaluru'],['State *','Karnataka'],['PIN Code *','560001']]) {
   await page.getByPlaceholder(placeholder,{exact:true}).fill(value);
  }
  await page.getByLabel('Set as default address',{exact:true}).check();
  const [addressSaved]=await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/buyer/addresses')&&response.request().method()==='POST'),page.getByRole('button',{name:'Save Address',exact:true}).click()]);
  assert.equal(addressSaved.status(),201);
  await expect(page.getByText('123 Browser A Street',{exact:true})).toBeVisible();
  assert.equal(owned.psql(`SELECT count(*) FROM buyer_addresses WHERE buyer_account_id='${buyerId}' AND address_line1='123 Browser A Street' AND is_default;`),'1');
  await page.locator('aside').getByRole('link',{name:'Settings',exact:true}).click();
  await page.waitForURL(url=>url.pathname.endsWith('/account/settings'));
  await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Synthetic Browser Profile');
  // Sign-out is submitted by the account UI; Identity's separate realm cookie survives.
  const logoutButton=page.getByRole('button',{name:'Sign out of LetBuyy at this store',exact:true});
  const [logout]=await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/buyer-auth/logout')&&response.request().method()==='POST'),logoutButton.click()]);assert.equal(logout.status(),200);
  await expect.poll(async()=> (await context.cookies(storeOrigin)).some(cookie=>cookie.name==='__Host-lb_store_buyer')).toBe(false);
  assert.equal((await (await context.request.get(storeOrigin+'/api/buyer-auth/session')).json()).buyer,null);
  assert.ok((await context.cookies(identityOrigin)).some(cookie=>cookie.name===LETBUYY_BUYER_SESSION_COOKIE));
  // The same browser retains its real Identity cookie and local storage. A
  // different buyer must explicitly choose a different account, never inherit A.
  const emailB='syn-browser-b-'+crypto.randomUUID()+'@example.invalid';
  await page.goto(storeOrigin+'/customers/login');
  await page.getByRole('link',{name:'Continue with LetBuyy',exact:true}).click();
  const [identityLogout]=await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/buyer/logout')&&response.request().method()==='POST'),page.getByRole('button',{name:'Use a different account',exact:true}).click()]);
  assert.equal(identityLogout.status(),200,'the normal account-switch action must actually sign out of Identity');
  await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible({timeout:30_000});
  await page.getByRole('link',{name:'Create an account',exact:true}).click();
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:20_000});
  await page.getByLabel('Email',{exact:true}).fill(emailB);await page.getByLabel('Password',{exact:true}).fill(password);
  const [registeredB]=await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/buyer/register')&&response.request().method()==='POST'),page.getByRole('button',{name:'Create account',exact:true}).click()]);assert.equal(registeredB.status(),201);
  await expect(page.getByText(emailB,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:`Continue to Synthetic ${stores[0].tag}`,exact:true}).click();
  await page.waitForURL(url=>url.origin===storeOrigin&&url.pathname.endsWith('/account/orders'),{timeout:30_000});
  const buyerB=owned.psql(`SELECT id FROM buyer_accounts WHERE email='${emailB}';`);assert.notEqual(buyerB,buyerId);
  assert.equal((await (await context.request.get(storeOrigin+'/api/buyer-auth/session')).json()).buyer.id,buyerB);
  await page.locator('aside').getByRole('link',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('');
  await page.getByLabel('Full name',{exact:true}).fill('Synthetic Browser B');await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect.poll(()=>owned.psql(`SELECT full_name FROM buyer_accounts WHERE id='${buyerB}';`)).toBe('Synthetic Browser B');
  await page.locator('aside').getByRole('link',{name:'Addresses',exact:true}).click();
  await expect(page.getByRole('heading',{name:'No saved addresses',exact:true})).toBeVisible();
  await expect(page.getByText('123 Browser A Street',{exact:true})).toHaveCount(0);
  assert.deepEqual((await (await context.request.get(storeOrigin+'/api/buyer/addresses')).json()).addresses,[]);
  assert.equal(owned.psql(`SELECT count(*) FROM buyer_addresses WHERE buyer_account_id='${buyerB}';`),'0');
  assert.equal(owned.psql(`SELECT full_name FROM buyer_accounts WHERE id='${buyerId}';`),'Synthetic Browser Profile');
  assert.equal(calls.filter(call=>call.path==='/v1/storefront/buyer/register'&&call.status===201).length,2);
  assert.ok(calls.filter(call=>call.path==='/v1/storefront/buyer/authorization-codes/redeem'&&call.status===200).length>=2);
  assert.deepEqual(consoleErrors,[],'normal sign-in UI has no uncaught page error');
  await context.close();
 }catch(error){
  console.info(JSON.stringify({diagnostic:'normal_browser_failure',url:page?new URL(page.url()).origin+new URL(page.url()).pathname:null,text:await page?.locator('body').innerText().catch(()=>''),frames:page?.frames().map(frame=>{try{const url=new URL(frame.url());return url.origin+url.pathname;}catch{return 'initial-frame';}}),networkFailures:failures,navigationResponses,nextRequests:nextRequests.slice(-20),gatewayCalls:calls.slice(-15),nextErrors:nextErrors.slice(-8),consoleErrors,inputLengths:await page?.locator('input').evaluateAll(nodes=>nodes.map(node=>({name:(node as {name:string;type:string;value:string}).name,type:(node as {name:string;type:string;value:string}).type,length:(node as {name:string;type:string;value:string}).value.length}))).catch(()=>[])}));
  await page?.screenshot({path:`/private/tmp/letbuyy-n1-browser-${owned.runId}.png`}).catch(()=>undefined);throw error;
 }finally{
  await browser?.close();await stopOwnedClientRuntime(commerce);await stopOwnedClientRuntime(identity);await gateway.settle();
  if(adapter){adapter.closeAllConnections();await new Promise<void>(resolve=>adapter!.close(()=>resolve()));}
 }
});
