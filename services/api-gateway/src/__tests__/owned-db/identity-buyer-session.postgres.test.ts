// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// N1.3: actual Identity Next routes -> actual Gateway worker -> owned PostgREST/PostgreSQL.
// Development Turnstile bypass is declared only for this local route fixture. It is not provider,
// inbox, browser or device acceptance. No session token is injected into Identity.
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import {createHash} from 'node:crypto';
import test,{before,after} from 'node:test';
import bcrypt from 'bcryptjs';
import {exportJWK,generateKeyPair} from 'jose';
import {LETBUYY_BUYER_SESSION_COOKIE,LETBUYY_BUYER_SESSION_HEADER,LETBUYY_BUYER_SESSION_TTL_SECONDS} from '@letbuyy/auth-core';
import {Gateway,gatewayEnv,newIdentityKeys,seedBuyerAccount,INTERNAL_SECRET,type IdentityKeys} from './gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from './owned-db-support';

const owned=requireOwnedDatabase();
const buyer=seedBuyerAccount(owned.psql,'identity-session');
const password='Synthetic-password-42';
const csrf='synthetic-csrf-session-route-guard-42';
let pendingReset:{code:string;challenge_id:string}|undefined;
let pendingGrant:{grant_type:string;code:string;code_verifier:string;client_id:string;redirect_uri:string}|undefined;
let keys:IdentityKeys,gateway:Gateway,adapter:Server,identity:OwnedClientProcess|undefined,origin:string,apiOrigin:string;
const requests:string[]=[];
async function startIdentity(privateJwk?:string) {
 const portServer=createServer();await new Promise<void>(resolve=>portServer.listen(0,'127.0.0.1',resolve));
 const port=(portServer.address() as {port:number}).port;await new Promise<void>(resolve=>portServer.close(()=>resolve()));
 origin=`http://localhost:${port}`;
 identity=startOwnedClientRuntime(owned,'identity-next',{port,env:{NODE_ENV:'development',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'true',
  LETBUYY_API_URL:apiOrigin+'/v1',INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_IDENTITY_ISSUER:'https://accounts.letbuyy.test',
  ...(privateJwk?{LETBUYY_IDENTITY_PRIVATE_JWK:privateJwk}:{})}});
 const deadline=Date.now()+45_000;
 while(Date.now()<deadline) {
  if(identity.exitCode!==null||identity.signalCode!==null)throw new Error('owned Identity stopped before readiness');
  try {const response=await fetch(origin+'/api/buyer/login',{method:'GET',signal:AbortSignal.timeout(2000)});if(response.status===405)return;}catch{/* compiling */}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw new Error('owned Identity login route did not become ready');
}
async function post(path:string,body:unknown,cookie='') {
 const response=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,
  Cookie:`letbuyy_csrf=${csrf}${cookie?'; '+cookie:''}`,Origin:origin},body:JSON.stringify(body),signal:AbortSignal.timeout(25_000)});
 return {status:response.status,body:await response.json() as {buyer?:{id:string};error?:string;access_token?:string},cookies:(response.headers as Headers & {getSetCookie():string[]}).getSetCookie()};
}
const buyerCookie=(cookies:string[])=>cookies.find(value=>value.startsWith(LETBUYY_BUYER_SESSION_COOKIE+'='))?.split(';')[0]??'';
const tokenOf=(cookie:string)=>decodeURIComponent(cookie.slice(cookie.indexOf('=')+1));
const challenge=()=>JSON.parse(owned.script(`SET ROLE service_role; SELECT public.start_buyer_email_challenge('${buyer.id}'::uuid,'reset_password')::text;`));
before(async()=>{
 keys=await newIdentityKeys();gateway=new Gateway(gatewayEnv(owned,keys));
 const hash=await bcrypt.hash(password,4);owned.psql(`UPDATE buyer_accounts SET password_hash='${hash}' WHERE id='${buyer.id}';`);
 adapter=createServer(async(request,response)=>{
  requests.push((request.method??'GET')+' '+request.url);const chunks:Buffer[]=[];for await(const chunk of request)chunks.push(Buffer.from(chunk));
  const headers=new Headers();for(const[name,value]of Object.entries(request.headers))if(typeof value==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(name))headers.set(name,value);
  try {
   const body=Buffer.concat(chunks).toString();const result=await gateway.request(request.url??'/',{method:request.method,headers,...(body?{body}:{})});
   response.writeHead(result.status,Object.fromEntries(result.headers.entries()));response.end(result.text);
  } catch {response.writeHead(500);response.end('{}');}
 });
 await new Promise<void>(resolve=>adapter.listen(0,'127.0.0.1',resolve));apiOrigin=`http://127.0.0.1:${(adapter.address() as {port:number}).port}`;
 await startIdentity();
});
after(async()=>{
 await stopOwnedClientRuntime(identity);await gateway?.settle();
 if(adapter){adapter.closeAllConnections();await new Promise<void>(resolve=>adapter.close(()=>resolve()));}
});

test('missing issuer cannot report successful buyer login',{timeout:60_000},async()=>{
 const result=await post('/api/buyer/login',{email:buyer.email,password,turnstileToken:'dev-bypass-token'});
 assert.equal(result.status,503);assert.equal(buyerCookie(result.cookies),'');assert.equal(result.body.buyer,undefined);
});
test('missing issuer cannot create an account and report registration success',{timeout:60_000},async()=>{
 const email='syn-new-'+crypto.randomUUID()+'@example.invalid';
 const result=await post('/api/buyer/register',{email,password,turnstileToken:'dev-bypass-token'});
 assert.equal(result.status,503);assert.equal(buyerCookie(result.cookies),'');
 assert.equal(owned.psql(`SELECT count(*) FROM buyer_accounts WHERE email='${email}';`),'0');
});
test('missing issuer leaves reset code/password/epoch untouched for a safe retry',{timeout:60_000},async()=>{
 const code=challenge();assert.equal(code.outcome,'started');pendingReset=code;
 const before=owned.psql(`SELECT password_hash||'|'||session_epoch FROM buyer_accounts WHERE id='${buyer.id}';`);
 const result=await post('/api/buyer/recover/confirm',{email:buyer.email,code:code.code,password:'Synthetic-reset-42'});
 assert.equal(result.status,503);assert.equal(buyerCookie(result.cookies),'');
 assert.equal(owned.psql(`SELECT password_hash||'|'||session_epoch FROM buyer_accounts WHERE id='${buyer.id}';`),before);
 assert.equal(owned.psql(`SELECT consumed_at IS NULL FROM buyer_email_challenges WHERE id='${code.challenge_id}';`),'t');
});
test('missing issuer must not burn a valid PKCE grant',{timeout:60_000},async()=>{
 const verifier='e'.repeat(43),challenge=createHash('sha256').update(verifier).digest('base64url');
 const issued=JSON.parse(owned.script(`SET ROLE service_role; SELECT public.issue_buyer_authorization_code('${buyer.id}'::uuid,'letbuyy-marketplace-app','com.letbuyy.letbuyy:/oauth/callback',NULL,'${challenge}')::text;`));
 assert.equal(issued.outcome,'issued');pendingGrant={grant_type:'authorization_code',code:issued.code,code_verifier:verifier,client_id:'letbuyy-marketplace-app',redirect_uri:'com.letbuyy.letbuyy:/oauth/callback'};
 const result=await post('/api/buyer/oauth/token',pendingGrant);assert.equal(result.status,503);assert.equal(result.body.access_token,undefined);
 assert.equal(owned.psql(`SELECT redeemed_at IS NULL FROM buyer_authorization_codes WHERE buyer_account_id='${buyer.id}';`),'t');
});
test('configured Identity issues a host-only session accepted by actual Gateway, then revokes all copies',{timeout:90_000},async()=>{
 await stopOwnedClientRuntime(identity);identity=undefined;
 const hash=await bcrypt.hash(password,4);owned.psql(`UPDATE buyer_accounts SET password_hash='${hash}' WHERE id='${buyer.id}';`);
 await startIdentity(JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}));
 const result=await post('/api/buyer/login',{email:buyer.email,password,turnstileToken:'dev-bypass-token'});
 assert.equal(result.status,200);const cookie=buyerCookie(result.cookies);assert.ok(cookie);
 const set=result.cookies.find(value=>value.startsWith(LETBUYY_BUYER_SESSION_COOKIE+'='))!;
 assert.match(set,/HttpOnly/);assert.match(set,/SameSite=lax/i);assert.match(set,new RegExp(`Max-Age=${LETBUYY_BUYER_SESSION_TTL_SECONDS}`));assert.doesNotMatch(set,/Domain=/i);
 const token=tokenOf(cookie);
 const profile=await gateway.request('/v1/storefront/buyer/profile',{headers:{[LETBUYY_BUYER_SESSION_HEADER]:token}});
 assert.equal(profile.status,200,profile.text);
 assert.ok(pendingGrant);const redeemed=await post('/api/buyer/oauth/token',pendingGrant);assert.equal(redeemed.status,200);assert.ok(redeemed.body.access_token);
 const redeemedProfile=await gateway.request('/v1/storefront/buyer/profile',{headers:{[LETBUYY_BUYER_SESSION_HEADER]:redeemed.body.access_token}});assert.equal(redeemedProfile.status,200);
 const revoked=await post('/api/buyer/sign-out-everywhere',{},cookie);assert.equal(revoked.status,200);
 const ended=await gateway.request('/v1/storefront/buyer/profile',{headers:{[LETBUYY_BUYER_SESSION_HEADER]:token}});assert.equal(ended.status,401);
 assert.ok(requests.some(path=>path.includes('/storefront/buyer/verify-credentials')),'actual credential verification reached Gateway');
 assert.ok(Number(owned.psql('SELECT count(*) FROM internal_auth_replay_claims'))>0,'actual Identity calls used durable307 replay claims');
});
test('password recovery reissues at the advanced epoch and cannot redeem the reset twice',{timeout:60_000},async()=>{
 assert.ok(pendingReset);const code=pendingReset;
 const previous=await post('/api/buyer/login',{email:buyer.email,password,turnstileToken:'dev-bypass-token'});assert.equal(previous.status,200);const previousToken=tokenOf(buyerCookie(previous.cookies));
 const epoch=Number(owned.psql(`SELECT session_epoch FROM buyer_accounts WHERE id='${buyer.id}';`));
 const attempts=await Promise.all([0,1].map(()=>post('/api/buyer/recover/confirm',{email:buyer.email,code:code.code,password:'Synthetic-reset-42'})));
 assert.deepEqual(attempts.map(row=>row.status).sort(),[200,400]);const result=attempts.find(row=>row.status===200)!;
 assert.equal(result.status,200);const cookie=buyerCookie(result.cookies);assert.ok(cookie);
 assert.equal(Number(owned.psql(`SELECT session_epoch FROM buyer_accounts WHERE id='${buyer.id}';`)),epoch+1);
 const profile=await gateway.request('/v1/storefront/buyer/profile',{headers:{[LETBUYY_BUYER_SESSION_HEADER]:tokenOf(cookie)}});assert.equal(profile.status,200,profile.text);
 const old=await gateway.request('/v1/storefront/buyer/profile',{headers:{[LETBUYY_BUYER_SESSION_HEADER]:previousToken}});assert.equal(old.status,401);
 const replay=await post('/api/buyer/recover/confirm',{email:buyer.email,code:code.code,password:'Synthetic-reset-again-42'});assert.equal(replay.status,400);assert.equal(buyerCookie(replay.cookies),'');
});

test('configured registration creates one account/session and repeated registration cannot create another',{timeout:60_000},async()=>{
 const email='syn-registered-'+crypto.randomUUID()+'@example.invalid';
 const result=await post('/api/buyer/register',{email,password,turnstileToken:'dev-bypass-token'});
 assert.equal(result.status,201);const cookie=buyerCookie(result.cookies);assert.ok(cookie);assert.ok(result.body.buyer?.id);assert.notEqual(result.body.buyer.id,buyer.id);
 assert.equal(owned.psql(`SELECT count(*) FROM buyer_accounts WHERE email='${email}' AND id='${result.body.buyer.id}';`),'1');
 const profile=await gateway.request('/v1/storefront/buyer/profile',{headers:{[LETBUYY_BUYER_SESSION_HEADER]:tokenOf(cookie)}});assert.equal(profile.status,200,profile.text);
 const repeated=await post('/api/buyer/register',{email,password,turnstileToken:'dev-bypass-token'});assert.equal(repeated.status,409);assert.equal(buyerCookie(repeated.cookies),'');
 assert.equal(owned.psql(`SELECT count(*) FROM buyer_accounts WHERE email='${email}';`),'1');
});
test('public-only or wrong-curve signing material refuses before account creation',{timeout:120_000},async()=>{
 const wrongCurve=await generateKeyPair('ES384',{extractable:true});
 const publicJwk=JSON.parse(keys.jwks).keys[0];
 for(const jwk of [publicJwk,{...await exportJWK(wrongCurve.privateKey),alg:'ES256',kid:'synthetic-wrong-curve'}]) {
  await stopOwnedClientRuntime(identity);identity=undefined;await startIdentity(JSON.stringify(jwk));
  const email='syn-invalid-key-'+crypto.randomUUID()+'@example.invalid';
  const result=await post('/api/buyer/register',{email,password,turnstileToken:'dev-bypass-token'});
  assert.equal(result.status,503);assert.equal(buyerCookie(result.cookies),'');assert.equal(result.body.buyer,undefined);
  assert.equal(owned.psql(`SELECT count(*) FROM buyer_accounts WHERE email='${email}';`),'0');
 }
});
