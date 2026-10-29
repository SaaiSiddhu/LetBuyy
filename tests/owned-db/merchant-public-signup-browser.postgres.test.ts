// Labelled local fixtures: synthetic accounts and public Turnstile test keys only.
// No seeded user, session, verified email, password or store. Resend HTTP is captured;
// this is provider-fixture acceptance, not real inbox delivery or hosted cookie proof.
import {tmpdir} from 'node:os';
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
test('public signup creates its account and first store through production apps',{timeout:780_000},async()=>{
 const email=`syn-public-${crypto.randomUUID()}@example.invalid`,password='Synthetic-Public-Signup-42!';
 const subdomain='syn-signup-'+crypto.randomUUID().slice(0,8);
 assert.equal(owned.psql(`SELECT count(*) FROM users_custom WHERE email='${email}';`),'0');
 const identityPort=await freePort(),merchantPort=await freePort(),identityOrigin=`http://localhost:${identityPort}`,merchantOrigin=`http://localhost:${merchantPort}`;
 const keys=await newIdentityKeys(),gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'test',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:'localhost',RESEND_API_KEY:'synthetic-owned-resend-capture'}));
 const mail:{to:string[];subject:string;html:string;text:string}[]=[],originalFetch=globalThis.fetch;let failFirstMail=true;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.toString():input.url);
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
  browser=await chromium.launch({headless:true});const context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(60_000);  const signup=await page.goto(identityOrigin+'/signup');assert.equal(signup?.status(),200);
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
  assert.equal(mail[1].subject,'Your LetBuyy verification code');
  const otp=mail[1].text.match(/Your verification code is (\d{6})\./)?.[1];assert.ok(otp,'OTP must come from the captured email body');
  assert.match(mail[1].html,new RegExp('>'+otp+'</p>'),'the branded HTML carries the same delivered code');
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
  const store=JSON.parse(owned.psql(`SELECT jsonb_build_object('count',count(*),'trial_days',max(EXTRACT(EPOCH FROM (trial_ends_at-trial_started_at))/86400),'theme',max(theme_id),'status',max(status))::text FROM sites WHERE custom_user_id=(SELECT id FROM users_custom WHERE email='${email}') AND subdomain='${subdomain}';`));assert.equal(store.count,1);assert.equal(store.trial_days,14,'existing persisted trial policy is preserved');assert.equal(store.status,'draft');assert.equal(store.theme,'letbuyy-forge','normal onboarding must honor the Circuit starting default');
  await page.goto(`${merchantOrigin}/${subdomain}/dashboard`);await expect(page.getByRole('heading',{name:'Where do you want to start?',exact:true})).toBeVisible();
  const screenshot=`${tmpdir()}/letbuyy-public-signup-${owned.runId}.png`;await page.screenshot({path:screenshot,fullPage:true});
  console.info('OWNED_PUBLIC_SIGNUP '+JSON.stringify({providerFixtureOnly:true,seededAccount:false,normalSignup:true,wrongOtpDenied:true,normalPasswordAndOnboarding:true,emailFailureThenRetry:true,unboundPasswordDenied:true,otpReplayDenied:true,passwordReplayDenied:true,mailCount:mail.length,store,screenshot}));
  assert.doesNotMatch(signupCopy,/₹20|14 days free/,'signup must not advertise an unsupported trial/price combination');
 }catch(error){console.info('OWNED_PUBLIC_SIGNUP_FAILURE '+JSON.stringify({path:page?new URL(page.url()).pathname:null,calls:calls.slice(-15).map(({path,status})=>({path,status})),errors:errors.slice(-3).map(s=>s.replace(/https?:\/\/[^\s"<>]+/g,'[redacted-url]'))}));throw error;
 }finally{await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await gateway.settle();globalThis.fetch=originalFetch;if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}}
});
