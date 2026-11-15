import {bindSyntheticRefundCredential}from './refund-credential-fixture';
// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Normal merchant password sign-in -> maintained web -> real Gateway/pooled DB.
// Verified synthetic accounts are fixture inputs, not provider/inbox proof.
import { tmpdir as ownedTmpDir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer,type Server} from 'node:http';
import {exportJWK} from 'jose';
import {chromium,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {STEP_SECRET,TOTP_SECRET,otp} from './merchant-stepup-fixture';
import {hashMerchantPassword} from '../../lib/merchant-password';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET} from './gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from './synthetic-tenant';
import {createLocalTurnstileProvider} from './local-turnstile-provider.fixture';
const owned=requireOwnedDatabase();
async function freePort(){const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as {port:number}).port;await new Promise<void>(resolve=>server.close(()=>resolve()));return port;}
async function ready(url:string,child:OwnedClientProcess){const end=Date.now()+360000;while(Date.now()<end){if(child.exitCode!==null||child.signalCode!==null)throw new Error('Owned app stopped before readiness');try{if((await fetch(url,{signal:AbortSignal.timeout(2000)})).status<500)return;}catch{/* bounded owned startup */}await new Promise(resolve=>setTimeout(resolve,200));}throw new Error('Owned app readiness timed out');}
async function signIn(page:Page,identity:string,merchant:string,email:string,password:string){
 await page.goto(identity+'/login');await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:30000});
 await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Continue with email',exact:true}).click();
 await page.getByLabel('Password',{exact:true}).fill(password);
 const [response]=await Promise.all([page.waitForResponse(reply=>reply.url().endsWith('/api/auth/login')&&reply.request().method()==='POST'),page.getByRole('button',{name:'Log in',exact:true}).click()]);
 assert.equal(response.status(),200);await page.waitForURL(url=>url.origin===merchant,{timeout:60000});
}
test('normal merchant recovers MFA setup and approval replies without leaking stale account state',{timeout:840000},async()=>{
 const site=newSyntheticTenant('loyalty-browser');seedSyntheticTenant(owned.psql,site);
 const owner=crypto.randomUUID(),email=`syn-loy-browser-${owner}@example.invalid`,password='Synthetic-loyalty-browser-pass-42';
 const otherSite=newSyntheticTenant('loyalty-other');seedSyntheticTenant(owned.psql,otherSite);
 const other=crypto.randomUUID(),otherEmail=`syn-loy-other-${other}@example.invalid`;
 const hash=await hashMerchantPassword(password);owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)VALUES('${owner}','${email}',true,'Synthetic Loyalty Owner','${hash}'),('${other}','${otherEmail}',true,'Synthetic Other Owner','${hash}');UPDATE sites SET custom_user_id='${owner}' WHERE id='${site.siteId}';UPDATE sites SET custom_user_id='${other}' WHERE id='${otherSite.siteId}';`);
 const identityPort=await freePort(),merchantPort=await freePort(),identityOrigin=`http://localhost:${identityPort}`,merchantOrigin=`http://localhost:${merchantPort}`;
 const proxy=await startOwnedPooledSqlProxy(owned),keys=await newIdentityKeys();
 const gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',STEP_UP_SIGNING_SECRET:STEP_SECRET,TOTP_ENCRYPTION_KEY:TOTP_SECRET,LETBUYY_IDENTITY_ISSUER:identityOrigin,RESEND_API_KEY:'synthetic-owned-auth-mail-capture',...proxy.env()}));
 let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined,browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined;
 let provider:Awaited<ReturnType<typeof createLocalTurnstileProvider>>|undefined;
 const calls:{path:string;status:number;key:string|null}[]=[],errors:string[]=[];
 let readOutage=true,loseEnroll=true,loseActivation=true,loseChallenge=true;
 let factorId='',secret='',lastEnrollKey='';
 const proofs=new Map<string,string>();let holdNextChallenge=false,challengeHeld=false,releaseHeld:(()=>void)|undefined;
 const keysSeen:Record<string,string[]>={};
 const originalFetch=globalThis.fetch;let deniedProviderCalls=0;
 const capturedMail:{subject:string;text:string}[]=[];
 globalThis.fetch=(async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.origin==='https://api.resend.com'){
  assert.equal(url.pathname,'/emails');assert.equal(init?.method,'POST');
  const message=JSON.parse(String(init?.body));
  assert.ok([message.to].flat().every((to:string)=>[email,otherEmail].includes(to)));
  capturedMail.push({subject:message.subject,text:message.text||''});
  return new Response(JSON.stringify({id:'synthetic-auth-mail-'+crypto.randomUUID()}),{status:200,headers:{'Content-Type':'application/json'}});
 }if(url.hostname==='api.razorpay.com'){deniedProviderCalls++;return new Response(JSON.stringify({error:{code:'SYNTHETIC_PROVIDER_NOT_APPROVED',description:'Synthetic provider refusal: external transactions are not authorized.'}}),{status:503,headers:{'Content-Type':'application/json'}});}return originalFetch(input,init);}) as typeof fetch;
 const evidence=`${ownedTmpDir()}/letbuyy-mfa-web-evidence-${owned.runId}`;mkdirSync(evidence,{recursive:true});
 try{
  provider=await createLocalTurnstileProvider(owned);
  bridge=createServer(async(req,res)=>{
   const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks).toString(),headers=new Headers();
   for(const [name,value]of Object.entries(req.headers))if(typeof value==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(name))headers.set(name,value);
   try{
    const path=(req.url??'/').split('?')[0];
    if(path==='/v1/2fa'&&req.method==='GET'&&readOutage){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'SYNTHETIC_LOYALTY_READ_OUTAGE',message:'Synthetic loyalty read outage. Retry loading.'}}));return;}
    const result=await gateway.request(req.url??'/',{method:req.method,headers,...(body?{body}:{})});calls.push({path,status:result.status,key:headers.get('X-Idempotency-Key')});
    if(req.method==='POST' && ['/v1/2fa/totp/enroll','/v1/2fa/totp/verify','/v1/security/step-up/challenges'].includes(path)){
     (keysSeen[path]??=[]).push(headers.get('X-Idempotency-Key')||'');
     if(result.status<300){
      if(path.endsWith('/enroll')){const d=result.json?.data as {factor:{id:string};secret:string};if(factorId&&lastEnrollKey===headers.get('X-Idempotency-Key')){assert.equal(d.factor.id,factorId);assert.equal(d.secret===secret,true,'retry changed the enrollment seed');}else{factorId=d.factor.id;secret=d.secret;lastEnrollKey=headers.get('X-Idempotency-Key')||'';}}
      if(path.endsWith('/challenges')){const d=result.json?.data as {step_up_token:string};const k=headers.get('X-Idempotency-Key')||'',prior=proofs.get(k);if(prior)assert.equal(d.step_up_token===prior,true,'retry reminted the approval');else proofs.set(k,d.step_up_token);}
      const lose=path.endsWith('/enroll')?loseEnroll:path.endsWith('/verify')?loseActivation:loseChallenge;
      if(lose){if(path.endsWith('/enroll'))loseEnroll=false;else if(path.endsWith('/verify'))loseActivation=false;else loseChallenge=false;
       res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'SYNTHETIC_COMMITTED_REPLY_LOSS',message:'The outcome is unknown. Retry the same request.'}}));return;}
     }
    }
    if(path==='/v1/security/step-up/challenges'&&result.status===201&&holdNextChallenge){holdNextChallenge=false;challengeHeld=true;await new Promise<void>(resolve=>{releaseHeld=resolve;});}
    res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);
   }catch{res.writeHead(500);res.end('{}');}
  });
  await new Promise<void>(resolve=>bridge!.listen(0,'127.0.0.1',resolve));const apiOrigin=`http://127.0.0.1:${(bridge.address() as {port:number}).port}`;
  const shared={INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,providerFixture:provider.profile,env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
   NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
  for(const app of [identity,merchant])app.stderr.on('data',data=>errors.push(data.toString().slice(0,800)));
  await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant)]);
  browser=await chromium.launch({headless:true});const context=await browser.newContext();await provider.attachBrowser(context,[identityOrigin,merchantOrigin]);page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
  await signIn(page,identityOrigin,merchantOrigin,email,password);
  const endpoint=`${merchantOrigin}/api/stores/${site.subdomain}/security`,securityPage=`${merchantOrigin}/${site.subdomain}/settings/security`;
  await page.goto(securityPage);
  await expect(page.getByRole('button',{name:'Retry loading security',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Set up authenticator app',exact:true})).toHaveCount(0);
  assert.equal(owned.psql(`SELECT count(*)FROM merchant_2fa_factors WHERE custom_user_id='${owner}';`),'0');
  readOutage=false;await page.getByRole('button',{name:'Retry loading security',exact:true}).click();
  await expect(page.getByText('2FA not configured',{exact:true})).toBeVisible();
  const [lostEnroll]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/security/two-factor/enroll')&&r.request().method()==='POST'),page.getByRole('button',{name:'Set up authenticator app',exact:true}).click()]);assert.equal(lostEnroll.status(),503);
  const enrollKey=lostEnroll.request().headers()['x-idempotency-key'];assert.ok(enrollKey);
  await page.reload();await expect(page.getByText('2FA not configured',{exact:true})).toBeVisible();
  const [retryEnroll]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/security/two-factor/enroll')&&r.request().method()==='POST'),page.getByRole('button',{name:'Set up authenticator app',exact:true}).click()]);assert.equal(retryEnroll.status(),201);
  assert.equal(retryEnroll.request().headers()['x-idempotency-key'],enrollKey);assert.ok(retryEnroll.headers()['cache-control'].includes('no-store'));
  await expect(page.getByLabel('Authenticator secret',{exact:true})).toBeVisible();
  await page.getByLabel('Confirm authenticator code',{exact:true}).fill(otp(secret));
  const [lostActivation]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/security/two-factor/verify')&&r.request().method()==='POST'),page.getByRole('button',{name:'Activate 2FA',exact:true}).click()]);assert.equal(lostActivation.status(),503);
  const activationKey=lostActivation.request().headers()['x-idempotency-key'];assert.ok(activationKey);
  assert.equal(owned.psql(`SELECT status FROM merchant_2fa_factors WHERE id='${factorId}';`),'active');
  await page.reload();await expect(page.getByText('Recover your activation result',{exact:true})).toBeVisible();
  await page.getByLabel('Confirm authenticator code',{exact:true}).fill(otp(secret));
  const [retryActivation]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/security/two-factor/verify')&&r.request().method()==='POST'),page.getByRole('button',{name:'Activate 2FA',exact:true}).click()]);assert.equal(retryActivation.status(),200);assert.equal(retryActivation.request().headers()['x-idempotency-key'],activationKey);
  await expect(page.getByText('Save your recovery codes',{exact:true})).toBeVisible();
  const recoveryCodes=await page.getByLabel('Recovery codes',{exact:true}).locator('span').allTextContents();assert.equal(recoveryCodes.length,8);
  await page.getByRole('button',{name:'I saved my recovery codes',exact:true}).click();await expect(page.getByText('Authenticator app active',{exact:true})).toBeVisible();
  const stored=await page.evaluate(()=>{const browser=globalThis as unknown as {sessionStorage:Record<string,string>;localStorage:Record<string,string>};return JSON.stringify({...browser.sessionStorage,...browser.localStorage});});assert.equal(stored.includes(secret),false);assert.equal(recoveryCodes.some(code=>stored.includes(code)),false);assert.equal(stored.includes('step_up_token'),false);
  await page.screenshot({path:evidence+'/active-authenticator.png',fullPage:true});
  // A real magic-link email must never bypass this enrolled authenticator.
  const csrfCookie=(await context.cookies(identityOrigin)).find(cookie=>cookie.name==='letbuyy_csrf');
  assert.ok(csrfCookie);
  const magicResponse=await context.request.post(identityOrigin+'/api/auth/send-magic',{
   headers:{Origin:identityOrigin,'X-CSRF-Token':decodeURIComponent(csrfCookie.value)},
   data:{email,turnstileToken:provider.issue()},
  });
  const magicSent=magicResponse.status();
  assert.equal(magicSent,200);
  const magicMail=[...capturedMail].reverse().find(message=>message.subject==='Your secure LetBuyy sign-in link');
  assert.ok(magicMail,'the canonical mail adapter must provide the link');
  const href=magicMail.text.match(/Sign in to LetBuyy: (\S+)/)?.[1];assert.ok(href);
  const link=new URL(href);assert.equal(link.origin,identityOrigin);assert.equal(link.pathname,'/api/auth/verify');
  const sessionCount=owned.psql(`SELECT count(*) FROM sessions WHERE user_id='${owner}';`);
  const fresh=await browser.newContext();await provider.attachBrowser(fresh,[identityOrigin,merchantOrigin]);
  try{
   const magicPage=await fresh.newPage();await magicPage.goto(href);
   const state=await fresh.request.get(identityOrigin+'/api/auth/session');
   assert.equal((await state.json()).authenticated,false,'magic link bypassed an enrolled Merchant authenticator');
   assert.equal(owned.psql(`SELECT count(*) FROM sessions WHERE user_id='${owner}';`),sessionCount,'a magic link must not persist a session before MFA');
   assert.equal(new URL(magicPage.url()).pathname,'/login');
  }finally{await fresh.close();}

  for(const origin of [undefined,'http://sibling.localhost']){
   const denied=await context.request.post(endpoint+'/two-factor/enroll',{headers:{'X-LetBuyy-Merchant-Context':owner,'X-Idempotency-Key':crypto.randomUUID(),...(origin?{Origin:origin}:{})},data:{}});assert.equal(denied.status(),403);
  }
  const noKey=await context.request.post(endpoint+'/two-factor/enroll',{headers:{Origin:merchantOrigin,'X-LetBuyy-Merchant-Context':owner},data:{}});assert.equal(noKey.status(),400);
  const order=seedSyntheticOrder(owned.psql,site),payment=crypto.randomUUID();
  owned.psql(`UPDATE orders SET payment_status='paid'WHERE id='${order.orderId}';INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,currency,provider_payment_id,idempotency_key)VALUES('${payment}','${site.siteId}','${order.orderId}','razorpay','sandbox','captured',10000,'INR','syn-pay-${payment}','syn-payment-${payment}');`);
  await bindSyntheticRefundCredential(owned,gateway,site.siteId,[payment]);
  await page.goto(`${merchantOrigin}/${site.subdomain}/orders`);await page.getByRole('button',{name:'Refund',exact:true}).first().click();await page.getByRole('spinbutton',{name:'Refund amount',exact:true}).fill('1');await page.getByRole('button',{name:'Verify and refund',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Verify identity',exact:true});await expect(dialog.getByLabel('Authenticator code',{exact:true})).toBeVisible();
  await dialog.getByLabel('Authenticator code',{exact:true}).fill(otp(secret));
  const [lostProof]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/security/step-up')&&r.request().method()==='POST'),dialog.getByRole('button',{name:'Approve Refund',exact:true}).click()]);assert.equal(lostProof.status(),503);
  const challengeKey=lostProof.request().headers()['x-idempotency-key'];await expect(dialog.getByText('The outcome is unknown. Retry the same request.',{exact:true})).toBeVisible();
  await dialog.getByLabel('Authenticator code',{exact:true}).fill(otp(secret));
  const [challenge,money]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/security/step-up')&&r.request().method()==='POST'),page.waitForResponse(r=>r.url().endsWith('/refund')&&r.request().method()==='POST'),dialog.getByRole('button',{name:'Approve Refund',exact:true}).click()]);
  assert.equal(challenge.status(),201);assert.equal(challenge.request().headers()['x-idempotency-key'],challengeKey);
  assert.equal(money.status(),202,'a synthetic provider refusal without a provider reference must need reconciliation');assert.equal((await money.json()).data.reconciliation,'operator_attention_required');assert.equal(deniedProviderCalls,1);
  await expect(page.getByText('The refund outcome needs reconciliation. Review the existing attempt before trying another refund.',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('Refund recorded',{exact:true})).toHaveCount(0);
  assert.equal(owned.psql(`SELECT count(*)FROM step_up_challenges WHERE site_id='${site.siteId}'AND idempotency_key='${challengeKey}';`),'1');
  assert.equal(owned.psql(`SELECT count(*)FROM ledger_transactions WHERE source_type='refund'AND site_id='${site.siteId}';`),'0');
  // Closing during a committed challenge cannot later dispatch a money command.
  holdNextChallenge=true;await page.getByRole('button',{name:'Verify and refund',exact:true}).click();
  await expect(dialog.getByLabel('Authenticator code',{exact:true})).toBeVisible();await dialog.getByLabel('Authenticator code',{exact:true}).fill(otp(secret));await dialog.getByRole('button',{name:'Approve Refund',exact:true}).click();
  await expect.poll(()=>challengeHeld,{timeout:15000}).toBe(true);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  const [cancelledReply]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/security/step-up')&&r.request().method()==='POST'),Promise.resolve().then(()=>releaseHeld!())]);assert.equal(cancelledReply.status(),201);
  await page.evaluate(()=>{const browser=globalThis as unknown as {requestAnimationFrame:(callback:()=>void)=>number};return new Promise<void>(resolve=>browser.requestAnimationFrame(()=>browser.requestAnimationFrame(()=>resolve())));});await expect(dialog).toHaveCount(0);
  assert.equal(calls.filter(call=>call.path==='/v1/payments/'+payment+'/refund').length,1,'a cancelled approval dispatched a new money command');assert.equal(deniedProviderCalls,1);
  // Authenticated recovery-code disable uses the existing canonical factor writer.
  await page.goto(securityPage);await page.getByRole('button',{name:'Disable 2FA',exact:true}).click();await page.getByRole('checkbox',{name:'Use a recovery code',exact:true}).check();await page.getByLabel('Recovery code',{exact:true}).fill(recoveryCodes[0]);
  const [disabled]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/security/two-factor/disable')&&r.request().method()==='POST'),page.getByRole('button',{name:'Confirm disable',exact:true}).click()]);assert.equal(disabled.status(),200);
  await expect(page.getByText('2FA not configured',{exact:true})).toBeVisible();assert.equal(owned.psql(`SELECT status FROM merchant_2fa_factors WHERE id='${factorId}';`),'disabled');
  const otherContext=await browser.newContext();await provider.attachBrowser(otherContext,[identityOrigin,merchantOrigin]);const otherPage=await otherContext.newPage();await signIn(otherPage,identityOrigin,merchantOrigin,otherEmail,password);
  await page.getByRole('button',{name:'Set up authenticator app',exact:true}).click();await expect(page.getByLabel('Authenticator secret',{exact:true})).toBeVisible();
  await context.addCookies(await otherContext.cookies(merchantOrigin));await page.getByLabel('Confirm authenticator code',{exact:true}).fill(otp(secret));
  const [stale]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/security/two-factor/verify')&&r.request().method()==='POST'),page.getByRole('button',{name:'Activate 2FA',exact:true}).click()]);assert.equal(stale.status(),409);assert.equal((await stale.json()).error.code,'SESSION_CONTEXT_CHANGED');
  await expect(page.getByText('Account or store access changed',{exact:true})).toBeVisible();await expect(page.getByLabel('Authenticator secret',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Recovery codes',{exact:true})).toHaveCount(0);
  assert.equal(owned.psql(`SELECT count(*)FROM merchant_2fa_factors WHERE custom_user_id='${other}';`),'0');
  for(const path of ['/two-factor','/two-factor/enroll','/step-up']){
   const denied=await otherContext.request.fetch(endpoint+path,{method:path==='/two-factor'?'GET':'POST',headers:{Origin:merchantOrigin,'X-LetBuyy-Merchant-Context':owner,'X-Idempotency-Key':enrollKey},...(path==='/two-factor'?{}:{data:{action:'refund.approve',idempotency_key:enrollKey,factor_id:factorId,code:otp(secret)}})});assert.equal(denied.status(),409);
  }
  for(const path of [`/orders/${order.orderId}/refund`,`/payouts/${crypto.randomUUID()}/settle`]){
   const denied=await otherContext.request.post(`${merchantOrigin}/api/stores/${site.subdomain}`+path,{headers:{Origin:merchantOrigin,'X-LetBuyy-Merchant-Context':owner,'X-Idempotency-Key':crypto.randomUUID()},data:{}});assert.equal(denied.status(),409);
  }
  writeFileSync(evidence+'/result.json',JSON.stringify({runId:owned.runId,normalSignIns:2,readOutageRefusesSetup:true,enrollmentLostReplyRecoveredAcrossReload:true,activationLostReplyRecoveredAcrossReload:true,recoveryCodesAcknowledged:8,challengeLostReplyRecoversOriginal:true,syntheticProviderRefusal:true,pendingRefundNotReportedAsComplete:true,cancelledApprovalCannotDispatch:true,externalProviderCalls:0,providerVerified:false,staleAccountDenied:true,secretsPersisted:false,calls},null,2)+'\n');
  console.info('OWNED_MERCHANT_MFA_BROWSER '+JSON.stringify({runId:owned.runId,evidence,normalSignIns:2,providerVerified:false}));await otherContext.close();await context.close();
  assert.ok(provider.counts.verified>=2);
  assert.equal(provider.counts.browserExternalRefused,0);
 }finally{releaseHeld?.();globalThis.fetch=originalFetch;await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await gateway.settle();await proxy.stop();if(bridge){bridge.closeAllConnections();await new Promise<void>(resolve=>bridge!.close(()=>resolve()));}await provider?.close();}
});
