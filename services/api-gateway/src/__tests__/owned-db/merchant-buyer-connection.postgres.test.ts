// Owned synthetic accounts only. Real Worker -> signed internal boundary -> PostgREST -> PostgreSQL.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test,{before,after} from 'node:test';
import {createLetbuyyInternalAppHeaders,createLetbuyyInternalSessionHeaders,LETBUYY_BUYER_SESSION_HEADER} from '@letbuyy/auth-core';
import {Gateway,gatewayEnv,newIdentityKeys,mintSession,INTERNAL_SECRET,type IdentityKeys} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
const owned=requireOwnedDatabase(),hash=(s:string)=>createHash('sha256').update(s).digest('hex');
let gateway:Gateway,keys:IdentityKeys;
const codes=new Map<string,string>(),originalInfo=console.info;
before(async()=>{
 keys=await newIdentityKeys();gateway=new Gateway(gatewayEnv(owned,keys));
 console.info=(...args:unknown[])=>{try{const v=JSON.parse(String(args[0]));if(v.reason==='local_buyer_email_code'&&v.purpose==='connect_merchant'){codes.set(v.to,v.code);return;}}catch{/* ordinary structured logs */}originalInfo(...args)};
});
after(async()=>{console.info=originalInfo;await gateway.settle()});
async function appHeaders(token?:string){
 const a=await createLetbuyyInternalAppHeaders({app:'accounts',secret:INTERNAL_SECRET});assert.ok(a.ok&&a.headers);
 const h:Record<string,string>={...a.headers,'Content-Type':'application/json'};
 if(token){const s=await createLetbuyyInternalSessionHeaders(token,INTERNAL_SECRET);assert.ok(s.ok&&s.headers);Object.assign(h,s.headers)}
 return h;
}
async function setup(existing:'none'|'verified'|'unverified'|'disabled'='none'){
 const user=crypto.randomUUID(),session=crypto.randomUUID(),email=`syn-connection-${user}@example.invalid`,buyer=crypto.randomUUID();
 const token=await mintSession(keys,user,{realm:'merchant',tokenUse:'merchant_session',audience:'letbuyy:merchant-session'});
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${user}','${email}',true,'Synthetic Merchant');
 INSERT INTO sessions(id,user_id,token,expires_at) VALUES('${session}','${user}','${token}',now()+interval '1 hour');`);
 if(existing!=='none')owned.psql(`INSERT INTO buyer_accounts(id,email,email_verified,status,password_hash) VALUES('${buyer}','${email}',${existing==='verified'},'${existing==='disabled'?'disabled':'active'}','synthetic-retained-password-hash');`);
 const verifier=hash(randomBytes(32).toString('hex')),requestHash=hash('synthetic-state-pkce-'+user);
 const start=await gateway.request('/v1/auth/custom/buyer-connections/start',{method:'POST',headers:await appHeaders(),body:JSON.stringify({merchant_session_token:token,verifier_hash:verifier,request_hash:requestHash})});
 const id=start.json?.data?.intent_id as string|undefined;
 return {user,session,email,buyer,token,verifier,requestHash,start,id,code:codes.get(email)||''};
}
async function confirm(f:Awaited<ReturnType<typeof setup>>,extra:Record<string,unknown>={}){
 return gateway.request('/v1/auth/custom/buyer-connections/confirm',{method:'POST',headers:await appHeaders(),body:JSON.stringify({intent_id:f.id,verifier_hash:f.verifier,request_hash:f.requestHash,code:f.code,consent:true,...extra})});
}
test('positive control: inbox proof plus explicit consent creates a verified buyer without a copied password or merchant roles',async()=>{
 const f=await setup();assert.equal(f.start.status,200,f.start.text);assert.match(f.code,/^\d{6}$/);assert.ok(!f.start.text.includes(f.code));
 assert.equal(owned.psql(`SELECT count(*) FROM buyer_accounts WHERE email='${f.email}';`),'0','start is not account creation');
 const result=await confirm(f);assert.equal(result.status,200,result.text);const buyer=result.json?.data?.buyer;assert.ok(buyer?.id);assert.equal(buyer.email,f.email);
 assert.equal(owned.psql(`SELECT email_verified::text||':'||(password_hash IS NULL)::text FROM buyer_accounts WHERE id='${buyer.id}';`),'true:true');
 assert.equal(owned.psql(`SELECT (revoked_at IS NOT NULL)::text FROM sessions WHERE id='${f.session}';`),'true','temporary Merchant session is revoked');
 assert.ok(!/password|role|token/.test(JSON.stringify(buyer)));
 assert.equal((await confirm(f)).status,401,'durable replay denied');
});
test('an existing buyer is connected only with a fresh inbox proof and explicit consent; password is retained',async()=>{
 const f=await setup('verified');assert.equal(f.start.status,200);
 assert.equal((await confirm(f,{consent:false})).status,401);
 assert.equal((await confirm(f,{code:'000000'===f.code?'999999':'000000'})).status,401);
 const result=await confirm(f);assert.equal(result.status,200,result.text);assert.equal(result.json?.data?.buyer.id,f.buyer);
 assert.equal(owned.psql(`SELECT password_hash FROM buyer_accounts WHERE id='${f.buyer}';`),'synthetic-retained-password-hash');
});
test('an unverified pre-registration is superseded after inbox proof, advancing its session epoch',async()=>{
 const f=await setup('unverified');assert.equal((await confirm(f)).status,200);assert.equal(owned.psql(`SELECT email_verified::text||':'||session_epoch::text FROM buyer_accounts WHERE id='${f.buyer}';`),'true:2');
});
test('wrong verifier, request binding and unknown intent do not create or connect a buyer',async()=>{
 const f=await setup();for(const extra of [{verifier_hash:hash('wrong-browser')},{request_hash:hash('wrong-store-pkce')},{intent_id:crypto.randomUUID()}])assert.equal((await confirm(f,extra)).status,401);
 assert.equal(owned.psql(`SELECT count(*) FROM buyer_accounts WHERE email='${f.email}';`),'0');assert.equal((await confirm(f)).status,200);
});
test('a code allows five wrong attempts and is durably locked',async()=>{
 const f=await setup(),bad=f.code==='000000'?'999999':'000000';for(let n=0;n<5;n++)assert.equal((await confirm(f,{code:bad})).status,401);
 assert.equal((await confirm(f)).status,401);assert.equal(owned.psql(`SELECT attempts::text||':'||outcome FROM merchant_buyer_connection_intents WHERE id='${f.id}';`),'5:locked');
});
test('expired, revoked-session and changed-email proofs are refused',async()=>{
 for(const scenario of ['expired','revoked','email']){
  const f=await setup();if(scenario==='expired')owned.psql(`UPDATE merchant_buyer_connection_intents SET expires_at=now()-interval '1 second' WHERE id='${f.id}';`);
  if(scenario==='revoked')owned.psql(`UPDATE sessions SET revoked_at=now() WHERE id='${f.session}';`);
  if(scenario==='email')owned.psql(`UPDATE users_custom SET email='changed-${f.email}' WHERE id='${f.user}';`);
  assert.equal((await confirm(f)).status,401);assert.equal(owned.psql(`SELECT count(*) FROM buyer_accounts WHERE email='${f.email}';`),'0');
 }
});
test('disabled buyers and buyer identities created or changed during proof cannot be claimed',async()=>{
 const disabled=await setup('disabled');assert.equal(disabled.start.status,401);
 const f=await setup();owned.psql(`INSERT INTO buyer_accounts(email,email_verified) VALUES('${f.email}',true);`);assert.equal((await confirm(f)).status,401);
 const changed=await setup('verified');owned.psql(`UPDATE buyer_accounts SET email='changed-${changed.email}' WHERE id='${changed.buyer}';`);assert.equal((await confirm(changed)).status,401);
});
test('cancellation consumes the intent and revokes only its temporary Merchant session',async()=>{
 const f=await setup();const result=await gateway.request('/v1/auth/custom/buyer-connections/cancel',{method:'POST',headers:await appHeaders(),body:JSON.stringify({intent_id:f.id,verifier_hash:f.verifier,request_hash:f.requestHash})});
 assert.equal(result.status,200);assert.equal((await confirm(f)).status,401);assert.equal(owned.psql(`SELECT outcome FROM merchant_buyer_connection_intents WHERE id='${f.id}';`),'cancelled');
});
test('concurrent confirmation commits one connection and one completion audit',async()=>{
 const f=await setup();const results=await Promise.all([confirm(f),confirm(f)]);assert.deepEqual(results.map(v=>v.status).sort(),[200,401]);
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='buyer.merchant_connection.completed' AND metadata->>'intent_id'='${f.id}';`),'1');
});
test('public callers, unsigned session forwarding and Merchant-as-buyer remain denied',async()=>{
 const f=await setup();const body=JSON.stringify({verifier_hash:hash('untrusted'),request_hash:hash('untrusted-request')});
 assert.equal((await gateway.request('/v1/auth/custom/buyer-connections/start',{method:'POST',headers:{'Content-Type':'application/json'},body})).status,401);
 assert.equal((await gateway.request('/v1/auth/custom/buyer-connections/start',{method:'POST',headers:await appHeaders(),body})).status,401);
 assert.equal((await gateway.request('/v1/storefront/buyer/me',{headers:{[LETBUYY_BUYER_SESSION_HEADER]:f.token}})).status,401);
});
test('inverse tenancy: tenant, authenticated and anon roles cannot read intent capabilities or call the RPCs',()=>{
 for(const role of ['app_tenant','authenticated','anon']){
  assert.throws(()=>owned.script(`BEGIN; SET LOCAL ROLE ${role}; SELECT * FROM public.merchant_buyer_connection_intents; ROLLBACK;`),/permission denied/);
  assert.throws(()=>owned.script(`BEGIN; SET LOCAL ROLE ${role}; SELECT public.start_merchant_buyer_connection(gen_random_uuid(),repeat('a',64),repeat('b',64)); ROLLBACK;`),/permission denied/);
 }
});

async function recoveryFixture(){
 const user=crypto.randomUUID(),email=`syn-recovery-${user}@example.invalid`,token=randomBytes(32).toString('hex');
 const session=crypto.randomUUID();
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,password_hash) VALUES('${user}','${email}',true,'synthetic-old-hash');
 INSERT INTO verification_tokens(user_id,email,token,type,expires_at) VALUES('${user}','${email}','${token}','password_reset',now()+interval '15 minutes');
 INSERT INTO sessions(id,user_id,token,expires_at) VALUES('${session}','${user}','synthetic-${session}',now()+interval '1 hour');`);
 return {user,email,token,session};
}
async function resetPassword(token:string,extra:Record<string,unknown>={}){
 return gateway.request('/v1/auth/custom/users/set-password',{method:'POST',headers:await appHeaders(),body:JSON.stringify({purpose:'password_reset',token,password:'Synthetic!New-Password42',...extra})});
}
test('Merchant recovery commits password, token, session revocation and audit together; replay is denied',async()=>{
 const f=await recoveryFixture();const result=await resetPassword(f.token);assert.equal(result.status,200,result.text);
 assert.equal(result.json?.data?.id,f.user);assert.ok(!result.text.includes('password'));
 assert.equal(owned.psql(`SELECT (password_hash<>'synthetic-old-hash')::text FROM users_custom WHERE id='${f.user}';`),'true');
 assert.equal(owned.psql(`SELECT used::text FROM verification_tokens WHERE token='${f.token}';`),'true');
 assert.equal(owned.psql(`SELECT revoked_reason FROM sessions WHERE id='${f.session}';`),'password_reset');
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='auth.password_reset.completed' AND actor_id='${f.user}';`),'1');
 assert.equal((await resetPassword(f.token)).status,400);
});
test('Merchant recovery concurrent requests commit exactly once',async()=>{
 const f=await recoveryFixture();const result=await Promise.all([resetPassword(f.token),resetPassword(f.token)]);
 assert.deepEqual(result.map(r=>r.status).sort(),[200,400]);
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='auth.password_reset.completed' AND actor_id='${f.user}';`),'1');
});
test('Merchant recovery storage failure rolls back every write and preserves the link for retry',async()=>{
 const f=await recoveryFixture();
 owned.script(`CREATE FUNCTION public.synthetic_fail_recovery_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.action='auth.password_reset.completed' THEN RAISE EXCEPTION 'synthetic_recovery_fault'; END IF; RETURN NEW; END; $$;
 CREATE TRIGGER synthetic_recovery_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.synthetic_fail_recovery_audit();`);
 try{
  const result=await resetPassword(f.token);assert.equal(result.status,503);assert.ok(!result.text.includes('synthetic_recovery_fault'));
  assert.equal(owned.psql(`SELECT password_hash FROM users_custom WHERE id='${f.user}';`),'synthetic-old-hash');
  assert.equal(owned.psql(`SELECT used::text FROM verification_tokens WHERE token='${f.token}';`),'false');
  assert.equal(owned.psql(`SELECT (revoked_at IS NULL)::text FROM sessions WHERE id='${f.session}';`),'true');
 }finally{owned.script('DROP TRIGGER synthetic_recovery_audit ON audit_logs; DROP FUNCTION public.synthetic_fail_recovery_audit();')}
 assert.equal((await resetPassword(f.token)).status,200);
});
test('Merchant recovery cannot redirect a capability to another user or a reassigned email',async()=>{
 const f=await recoveryFixture();assert.equal((await resetPassword(f.token,{user_id:crypto.randomUUID()})).status,400);
 owned.psql(`UPDATE users_custom SET email='changed-${f.email}' WHERE id='${f.user}';
 INSERT INTO users_custom(email,email_verified,password_hash) VALUES('${f.email}',true,'synthetic-other-user-hash');`);
 assert.equal((await resetPassword(f.token)).status,400);
 assert.equal(owned.psql(`SELECT password_hash FROM users_custom WHERE email='${f.email}';`),'synthetic-other-user-hash');
 assert.equal(owned.psql(`SELECT password_hash FROM users_custom WHERE id='${f.user}';`),'synthetic-old-hash');
});
test('Merchant recovery rejects expired, used, wrong-purpose, missing-principal and unverified capabilities',async()=>{
 for(const scenario of ['expired','used','purpose','principal','unverified']){
  const f=await recoveryFixture();
  if(scenario==='expired')owned.psql(`UPDATE verification_tokens SET expires_at=now()-interval '1 second' WHERE token='${f.token}';`);
  if(scenario==='used')owned.psql(`UPDATE verification_tokens SET used=true WHERE token='${f.token}';`);
  if(scenario==='purpose')owned.psql(`UPDATE verification_tokens SET type='magic_link' WHERE token='${f.token}';`);
  if(scenario==='principal')owned.psql(`UPDATE verification_tokens SET user_id=NULL WHERE token='${f.token}';`);
  if(scenario==='unverified')owned.psql(`UPDATE users_custom SET email_verified=false WHERE id='${f.user}';`);
  assert.equal((await resetPassword(f.token)).status,400,scenario);
  assert.equal(owned.psql(`SELECT password_hash FROM users_custom WHERE id='${f.user}';`),'synthetic-old-hash');
 }
});
test('Merchant recovery RPC is not executable by public, buyer or tenant database roles',()=>{
 for(const role of ['app_tenant','authenticated','anon'])assert.throws(()=>owned.script(`BEGIN; SET LOCAL ROLE ${role}; SELECT public.complete_merchant_password_reset(repeat('a',64),'synthetic-hash'); ROLLBACK;`),/permission denied/);
});

test('rollback revokes unfinished capabilities and preserves history; a forward replay can be applied',()=>{
 const count=owned.psql('SELECT count(*) FROM merchant_buyer_connection_intents;');
 owned.script(readFileSync(new URL('../../../../../database/supabase/rollback/399_verified_merchant_buyer_connection.rollback.sql',import.meta.url),'utf8'));
 assert.equal(owned.psql('SELECT count(*) FROM merchant_buyer_connection_intents_399_archive;'),count);
 assert.equal(owned.psql('SELECT count(*) FROM merchant_buyer_connection_intents_399_archive WHERE consumed_at IS NULL;'),'0');
 owned.script(readFileSync(new URL('../../../../../database/supabase/migrations/399_verified_merchant_buyer_connection.sql',import.meta.url),'utf8'));
 assert.equal(owned.psql('SELECT count(*) FROM merchant_buyer_connection_intents;'),'0');
});
