// Actual worker, whole migrated DB and PostgREST. Explicit synthetic trusted
// Identity signing is a transport fixture; normal sign-in uses a separate browser.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {SignJWT} from 'jose';
import {createLetbuyyInternalAppHeaders,createLetbuyyPlatformSessionToken as mintLegacy} from '@letbuyy/auth-core';
import {verifyIdentityPlatformSession} from '@letbuyy/auth-core/platform-identity';
import {requireOwnedDatabase} from './owned-db-support';
import {Gateway,gatewayEnv,INTERNAL_SECRET,IDENTITY_ISSUER,tapRest,newBarrier} from './gateway-harness';
import {operatorIdentityKeys,createLetbuyyPlatformSessionToken} from './operator-identity-fixture';
const owned=requireOwnedDatabase(),signature='public.exchange_identity_console_magic_v1(uuid,text,uuid,timestamptz,timestamptz,uuid,text,timestamptz,timestamptz)';
async function fixture(){
 const label=crypto.randomUUID(),keys=await operatorIdentityKeys(label),bridge='synthetic-identity-bridge-'+crypto.randomUUID();
 const id=crypto.randomUUID(),email='syn-identity-operator-'+id+'@example.invalid';
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${id}','${email}',true);INSERT INTO super_admin_allowlist(user_id,email,full_name,is_active)VALUES('${id}','${email}','Synthetic operator',true);`);
 const env=gatewayEnv(owned,keys,{PLATFORM_CONSOLE_API_TOKEN:bridge}),gateway=new Gateway(env),now=Math.floor(Date.now()/1000),jti=crypto.randomUUID();
 const magic=await new SignJWT({realm:'platform',token_use:'platform_magic_link',email}).setProtectedHeader({alg:'ES256',typ:'JWT',kid:keys.kid}).setIssuer(IDENTITY_ISSUER).setAudience('letbuyy:platform-magic-link').setSubject(id).setIssuedAt(now).setExpirationTime(now+900).setJti(jti).sign(keys.privateKey);
 const mint=(mfa=false)=>createLetbuyyPlatformSessionToken({email,userId:id,mfaVerified:mfa},label);
 const token=await mint();
 async function headers(tokenValue=token){const plan=await createLetbuyyInternalAppHeaders({app:'accounts',secret:INTERNAL_SECRET});assert.ok(plan.ok&&plan.headers);return {...plan.headers,'X-Platform-Console-Session':tokenValue,'Content-Type':'application/json'};}
 const exchange=async(value=token,body:unknown={magic_token:magic},worker=gateway)=>worker.request('/v1/internal/identity/operator/exchange',{method:'POST',headers:await headers(value),body:JSON.stringify(body)});
 return {id,email,label,bridge,keys,env,gateway,now,jti,magic,token,mint,headers,exchange};
}
test('clean332 rollback/reapply preserves existing data and denies actual API/database roles',()=>{
 const before=owned.psql('SELECT (SELECT count(*) FROM sessions_v2),(SELECT count(*) FROM console_magic_link_consumptions),(SELECT count(*) FROM audit_logs);');
 for(const rel of ['rollback/332_identity_operator_session_exchange.rollback.sql','migrations/332_identity_operator_session_exchange.sql'])owned.script(readFileSync('database/supabase/'+rel,'utf8'));
 assert.equal(owned.psql('SELECT (SELECT count(*) FROM sessions_v2),(SELECT count(*) FROM console_magic_link_consumptions),(SELECT count(*) FROM audit_logs);'),before);
 for(const role of ['anon','authenticated','app_tenant']){
  assert.equal(owned.psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE');`),'f');
  assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.exchange_identity_console_magic_v1(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);`),/permission denied for function/);
 }
 assert.equal(owned.psql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE');`),'t');
 owned.script(readFileSync('database/supabase/migrations/332_identity_operator_session_exchange.sql','utf8'));
});
test('atomic exchange binds the exact signed actor and credential; exact retry recovers a lost reply without a second effect',async()=>{
 const f=await fixture(),first=await f.exchange();assert.equal(first.status,200,first.text);assert.equal(first.json?.data.actor_id,f.id);
 const retry=await f.exchange(f.token,undefined,new Gateway(f.env));assert.equal(retry.status,200,retry.text);
 assert.equal(owned.psql(`SELECT count(*) FROM console_magic_link_consumptions WHERE jti='${f.jti}' AND exchange_session_id='${first.json?.data.session_id}';`),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='platform_console_session.registered' AND actor_id='${f.id}';`),'1');
 const other=await f.mint();assert.equal((await f.exchange(other)).status,401);
 const p=await verifyIdentityPlatformSession(other,{issuer:IDENTITY_ISSUER,publicJwks:f.keys.jwks});assert.ok(p);
 assert.equal(owned.psql(`SELECT count(*) FROM sessions_v2 WHERE id='${p.sessionId}';`),'0');
});
test('two independently signed candidates racing for one magic link have exactly one durable winner',async()=>{
 const f=await fixture(),other=await f.mint(),barrier=newBarrier(2),tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{if(call.resource==='rpc/exchange_identity_console_magic_v1')await barrier.arrive();return forward();});
 try{const results=await Promise.all([f.exchange(),f.exchange(other,undefined,new Gateway(f.env))]);assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);}
 finally{tap.restore();}
 assert.equal(owned.psql(`SELECT count(*) FROM sessions_v2 s JOIN principals p ON p.id=s.principal_id WHERE p.legacy_user_id='${f.id}' AND s.realm='admin';`),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM console_magic_link_consumptions WHERE jti='${f.jti}';`),'1');
});
test('mandatory audit outage rolls back BOTH magic consumption and session state; exact insertion recovery permits one exchange',async()=>{
 const f=await fixture();owned.script(`CREATE FUNCTION public.synthetic_identity_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic identity audit outage';END$$;CREATE TRIGGER synthetic_identity_audit_fault BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.synthetic_identity_audit_fault();`);
 try{assert.equal((await f.exchange()).status,503);assert.equal(owned.psql(`SELECT count(*) FROM console_magic_link_consumptions WHERE jti='${f.jti}';`),'0');assert.equal(owned.psql(`SELECT count(*) FROM principals WHERE realm='admin' AND legacy_user_id='${f.id}';`),'0');}
 finally{owned.script('DROP TRIGGER synthetic_identity_audit_fault ON public.audit_logs;DROP FUNCTION public.synthetic_identity_audit_fault();');}
 assert.equal((await f.exchange()).status,200);
});
test('service bearer alone, malformed/cross-purpose credentials, other actors and elevated candidates cannot consume a magic proof',async()=>{
 const f=await fixture(),body=JSON.stringify({magic_token:f.magic});
 const legacy=await mintLegacy({email:f.email,userId:f.id,mfaVerified:false},'synthetic-shared-session-secret');
 for(const value of [f.magic,legacy!,await f.mint(true),f.token.slice(0,-4)+'xxxx'])assert.equal((await f.exchange(value)).status,401);
 const forged=await createLetbuyyPlatformSessionToken({email:f.email,userId:crypto.randomUUID(),mfaVerified:false},f.label);assert.equal((await f.exchange(forged)).status,401);
 const bridgeHeaders={Authorization:'Bearer '+f.bridge,'X-Platform-Console-Session':f.token,'Content-Type':'application/json'};
 for(const path of ['/v1/internal/identity/operator/exchange','/v1/internal/console/sessions/register','/v1/internal/console/sessions/mfa'])assert.equal((await f.gateway.request(path,{method:'POST',headers:bridgeHeaders,body:path.endsWith('exchange')?body:'{}'})).status,401);
 assert.equal((await f.gateway.request('/v1/internal/console/magic-link/consume',{method:'POST',headers:bridgeHeaders,body:JSON.stringify({jti:f.jti,email:f.email,expires_at:new Date((f.now+900)*1000).toISOString()})})).status,410);
 assert.equal(owned.psql(`SELECT count(*) FROM console_magic_link_consumptions WHERE jti='${f.jti}';`),'0');
 assert.equal(owned.psql(`SELECT count(*) FROM principals WHERE realm='admin' AND legacy_user_id='${f.id}';`),'0');
});
test('transport proofs are one-use across workers; fresh transport cannot reuse a Console body proof',async()=>{
 const f=await fixture(),headers=await f.headers(),jti=crypto.randomUUID(),body=JSON.stringify({jti});
 const first=await f.gateway.request('/v1/internal/identity/operator/bridge-claim',{method:'POST',headers,body});assert.equal(first.status,200,first.text);
 assert.equal((await new Gateway(f.env).request('/v1/internal/identity/operator/bridge-claim',{method:'POST',headers,body})).status,401);
 assert.equal((await f.gateway.request('/v1/internal/identity/operator/bridge-claim',{method:'POST',headers:await f.headers(),body})).status,401);
});
test('live operator removal refuses a still-signed exchange; revocation cannot be undone by exact retry or rollback',async()=>{
 const f=await fixture();owned.psql(`UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${f.id}';`);
 assert.equal((await f.exchange()).status,401);assert.equal(owned.psql(`SELECT count(*) FROM console_magic_link_consumptions WHERE jti='${f.jti}';`),'0');
 owned.psql(`UPDATE super_admin_allowlist SET is_active=true WHERE user_id='${f.id}';`);assert.equal((await f.exchange()).status,200);
 const revoke=await f.gateway.request('/v1/internal/console/sessions/revoke',{method:'POST',headers:{Authorization:'Bearer '+f.bridge,'X-Platform-Console-Session':f.token,'Content-Type':'application/json'},body:'{}'});assert.equal(revoke.status,200,revoke.text);
 assert.equal((await f.exchange()).status,401);
 assert.match(owned.psqlExpectError(readFileSync('database/supabase/rollback/332_identity_operator_session_exchange.rollback.sql','utf8')),/332 rollback refused/);
 assert.equal(owned.psql(`SELECT count(*) FROM console_magic_link_consumptions WHERE jti='${f.jti}';`),'1');
});

test('expired and malformed proofs refuse before consumption; signed email or actor mismatches grant nothing',async()=>{
 const f=await fixture();
 for(const body of [{},{magic_token:''},{magic_token:'x'.repeat(4097)},{magic_token:f.magic,email:f.email}])assert.equal((await f.exchange(f.token,body)).status,400);
 async function altered(overrides:Record<string,unknown>){return new SignJWT({iss:IDENTITY_ISSUER,aud:'letbuyy:platform-magic-link',realm:'platform',token_use:'platform_magic_link',email:f.email,sub:f.id,jti:f.jti,iat:f.now-10,exp:f.now+890,...overrides}).setProtectedHeader({alg:'ES256',typ:'JWT',kid:f.keys.kid}).sign(f.keys.privateKey);}
 for(const override of [{exp:f.now-1},{email:'other@example.invalid'},{sub:crypto.randomUUID()},{email:'not-an-email'},{aud:'letbuyy:platform-session'},{iat:Math.floor(Date.now()/1000)+60}])assert.equal((await f.exchange(f.token,{magic_token:await altered(override)})).status,401);
 assert.equal(owned.psql(`SELECT count(*) FROM console_magic_link_consumptions WHERE jti='${f.jti}';`),'0');
 assert.equal(owned.psql(`SELECT count(*) FROM principals WHERE realm='admin' AND legacy_user_id='${f.id}';`),'0');
});
test('distinct signed magic proofs for the same operator remain independent legitimate sign-in attempts',async()=>{
 const f=await fixture(),otherJti=crypto.randomUUID(),second=await f.mint();
 const magic=await new SignJWT({realm:'platform',token_use:'platform_magic_link',email:f.email}).setProtectedHeader({alg:'ES256',typ:'JWT',kid:f.keys.kid}).setIssuer(IDENTITY_ISSUER).setAudience('letbuyy:platform-magic-link').setSubject(f.id).setIssuedAt(f.now).setExpirationTime(f.now+900).setJti(otherJti).sign(f.keys.privateKey);
 assert.equal((await f.exchange()).status,200);assert.equal((await f.exchange(second,{magic_token:magic})).status,200);
 assert.equal(owned.psql(`SELECT count(*) FROM console_magic_link_consumptions WHERE jti IN ('${f.jti}','${otherJti}');`),'2');
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${f.id}' AND action='platform_console_session.registered';`),'2');
});
