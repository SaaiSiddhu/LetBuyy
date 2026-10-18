// Real worker/database and actual enrollment/challenge API; signed merchant
// transport is a fixture, not normal browser sign-in or provider delivery proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync}from 'node:fs';
import {signSensitiveActionStepUp}from '../../lib/security-controls';
import {createHmac} from 'node:crypto';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,tapRest,restJson,newBarrier} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
const STEP='synthetic-merchant-step-up-signing-at-least-32-bytes';
const TOTP='synthetic-merchant-totp-encryption-at-least-32-bytes';
async function fixture(){
 const f=newSyntheticTenant('mfa-'+crypto.randomUUID().slice(0,8));seedSyntheticTenant(owned.psql,f);
 const owner=crypto.randomUUID(),email=`syn-mfa-${owner}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','${email}',true);UPDATE sites SET custom_user_id='${owner}'WHERE id='${f.siteId}';`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{STEP_UP_SIGNING_SECRET:STEP,TOTP_ENCRYPTION_KEY:TOTP}));
 const call=async(method:string,path:string,body?:Record<string,unknown>,options:{key?:string;headers?:Record<string,string>}={})=>gateway.request('/v1'+path,{method,headers:{...await signedIdentityHeaders(owner,email,f.siteId),'X-Idempotency-Key':options.key??String(body?.idempotency_key??crypto.randomUUID()),...options.headers},body:body?JSON.stringify(body):undefined});
 return{...f,owner,email,gateway,call};
}
// Independent reference client, never a stubbed validator. Secret stays in this
// owned process and is never printed or saved to continuity/evidence output.
function otp(secret:string,at=Date.now()){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const ch of secret.replace(/=/g,'').toUpperCase())bits+=alphabet.indexOf(ch).toString(2).padStart(5,'0');
 const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(at/30000)));
 const digest=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),o=digest[digest.length-1]&15;
 return String((digest.readUInt32BE(o)&0x7fffffff)%1000000).padStart(6,'0');
}
const explain=(r:{status:number;json:any})=>`HTTP${r.status} ${r.json?.error?.code??''}`;
test('actual enrollment, activation and challenge issuance produce a usable refund proof',async()=>{
 const f=await fixture(),enrolled=await f.call('POST','/2fa/totp/enroll');assert.equal(enrolled.status,201,explain(enrolled));
 const factor=enrolled.json?.data.factor.id,secret=enrolled.json?.data.secret;assert.equal(typeof secret,'string');
 const verified=await f.call('POST','/2fa/totp/verify',{factor_id:factor,code:otp(secret)});assert.equal(verified.status,200,explain(verified));
 const challenge=await f.call('POST','/security/step-up/challenges',{store_id:f.siteId,action:'refund.approve',factor_id:factor,code:otp(secret),idempotency_key:crypto.randomUUID()});assert.equal(challenge.status,201,explain(challenge));
 assert.equal(typeof challenge.json?.data.step_up_token,'string');assert.equal(challenge.json?.data.challenge.action,'refund.approve');
 const order=crypto.randomUUID(),ret=crypto.randomUUID(),refund=crypto.randomUUID();
 owned.psql(`INSERT INTO orders(id,store_id,site_id,customer_email,shipping_address,items,subtotal,total,payment_status)VALUES('${order}','${f.siteId}','${f.siteId}','syn-refund@example.invalid','{}','[]',100,100,'paid');
 INSERT INTO returns(id,site_id,order_id,status,refund_method,idempotency_key)VALUES('${ret}','${f.siteId}','${order}','received','manual','syn-${ret}');
 INSERT INTO refunds(id,site_id,order_id,return_id,amount,status,refund_method,provider,idempotency_key)VALUES('${refund}','${f.siteId}','${order}','${ret}',100,'pending','manual','bank_transfer','syn-${refund}');`);
 const complete=await f.call('POST','/returns/'+ret+'/refund/complete',{refund_id:refund,idempotency_key:crypto.randomUUID()},{headers:{'X-Step-Up-Token':challenge.json?.data.step_up_token,'X-Step-Up-Verified-At':challenge.json?.data.verified_at}});
 assert.equal(complete.status,200,explain(complete));assert.equal(owned.psql(`SELECT count(*)FROM ledger_transactions WHERE site_id='${f.siteId}'AND source_type='refund'AND source_id='refund:${refund}';`),'1');
});
test('generic request receipts do not retain plaintext enrollment secrets or recovery codes',async()=>{
 const f=await fixture(),key=crypto.randomUUID(),response=await f.call('POST','/2fa/totp/enroll',undefined,{key});assert.equal(response.status,201,explain(response));
 const leaked=owned.psql(`SELECT count(*)FROM idempotency_keys WHERE site_id='${f.siteId}'AND key='${key}'AND(response_body#>'{data,secret}'IS NOT NULL OR response_body#>'{data,otpauth_uri}'IS NOT NULL OR response_body#>'{data,recovery_codes}'IS NOT NULL);`);
 assert.equal(leaked,'0','credential material must not be persisted in generic HTTP response receipts');
});
test('a different merchant cannot replay another actor’s enrollment receipt with a forged selection hint',async()=>{
 const a=await fixture(),b=await fixture(),key=crypto.randomUUID(),first=await a.call('POST','/2fa/totp/enroll',undefined,{key});assert.equal(first.status,201,explain(first));
 const other=await b.call('POST','/2fa/totp/enroll',undefined,{key,headers:{'X-Store-ID':a.siteId}});
 const leaked=other.json?.data?.secret===first.json?.data?.secret;assert.equal(leaked,false,`cross-actor cached secret disclosure; HTTP${other.status}`);
 if(other.status===201){assert.equal(other.json?.data?.factor.custom_user_id,b.owner);assert.notEqual(other.json?.data?.factor.id,first.json?.data?.factor.id);}else assert.ok([400,401,403,404,409].includes(other.status),explain(other));
});
test('pending erasure policy keeps the legacy merchant customer request in review without deleting contact data',async()=>{
 const f=await fixture(),customer=crypto.randomUUID(),email=`syn-customer-${customer}@example.invalid`;
 owned.psql(`INSERT INTO store_customers(id,store_id,email,full_name)VALUES('${customer}','${f.siteId}','${email}','Synthetic retained customer');`);
 const factor=await pending(f);assert.equal((await f.call('POST','/2fa/totp/verify',{factor_id:factor.id,code:otp(factor.secret)})).status,200);
 const challenge=await f.call('POST','/security/step-up/challenges',{store_id:f.siteId,action:'customer.dsr.erase',factor_id:factor.id,code:otp(factor.secret),idempotency_key:crypto.randomUUID()});assert.equal(challenge.status,201,explain(challenge));
 const proof={token:challenge.json?.data.step_up_token,verifiedAt:challenge.json?.data.verified_at};
 const result=await f.call('POST','/security/dsr/erase',{store_id:f.siteId,email,reason:'Synthetic privacy review request',idempotency_key:crypto.randomUUID()},{headers:{'X-Step-Up-Token':proof.token,'X-Step-Up-Verified-At':proof.verifiedAt}});
 assert.equal(owned.psql(`SELECT count(*)FROM store_customers WHERE id='${customer}'AND email='${email}'AND deleted_at IS NULL;`),'1',`unapproved erasure changed customer data; HTTP${result.status}`);
 assert.equal(result.status,202,explain(result));assert.equal(result.json?.data.erased,false);
});

async function pending(f:Awaited<ReturnType<typeof fixture>>){
 const r=await f.call('POST','/2fa/totp/enroll');assert.equal(r.status,201,explain(r));return{id:String(r.json?.data.factor.id),secret:String(r.json?.data.secret)};
}
const factorState=(id:string)=>owned.psql(`SELECT status FROM merchant_2fa_factors WHERE id='${id}';`);
test('an already active factor cannot rotate recovery codes under a new verification key',async()=>{
 const f=await fixture(),p=await pending(f);assert.equal((await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)})).status,200);
 const before=owned.psql(`SELECT md5(recovery_code_hashes::text)FROM merchant_2fa_factors WHERE id='${p.id}';`);
 const again=await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)});
 assert.equal(again.status,409,explain(again));assert.equal(owned.psql(`SELECT md5(recovery_code_hashes::text)FROM merchant_2fa_factors WHERE id='${p.id}';`),before);
});
for(const mode of ['enroll-after-activate','verify-after-disable','disable-after-activate']as const)test('factor race '+mode+' preserves the committed security state',async()=>{
 const f=await fixture(),p=await pending(f);let held=false;
 const tap=tapRest(owned.restUrl,async(call,forward)=>{
  if(!held&&((call.resource==='merchant_2fa_factors'&&call.method==='PATCH')||call.resource==='rpc/execute_merchant_totp_command_v1')){
   held=true;
   const nested=mode==='verify-after-disable'?await f.call('POST','/2fa/disable',{factor_id:p.id}):await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)});
   assert.equal(nested.status,200,explain(nested));
  }
  return forward();
 });
 try{
  const result=mode==='enroll-after-activate'?await f.call('POST','/2fa/totp/enroll'):mode==='verify-after-disable'?await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)}):await f.call('POST','/2fa/disable',{factor_id:p.id});
  assert.equal(held,true);assert.equal(factorState(p.id),mode==='verify-after-disable'?'disabled':'active',`stale factor transition won; HTTP${result.status}`);
  assert.ok([404,409].includes(result.status),explain(result));
 }finally{tap.restore();}
});

test('pending enrollment retries reuse one actor-bound seed and old setup keys cannot disclose an active seed',async()=>{
 const f=await fixture(),key=crypto.randomUUID(),one=await f.call('POST','/2fa/totp/enroll',undefined,{key});assert.equal(one.status,201,explain(one));
 for(const retryKey of [key,crypto.randomUUID()]){const retry=await f.call('POST','/2fa/totp/enroll',undefined,{key:retryKey});assert.equal(retry.status,201,explain(retry));assert.equal(retry.json?.data.secret===one.json?.data.secret,true,'pending seed must remain stable');assert.equal(retry.json?.data.factor.id,one.json?.data.factor.id);}
 assert.equal((await f.call('POST','/2fa/totp/verify',{factor_id:one.json?.data.factor.id,code:otp(one.json?.data.secret)})).status,200);
 const old=await f.call('POST','/2fa/totp/enroll',undefined,{key});assert.equal(old.status,409,explain(old));assert.equal(old.json?.data?.secret,undefined);
});
test('committed activation reply loss recovers the same encrypted recovery codes without rotating them',async()=>{
 const f=await fixture(),p=await pending(f),key=crypto.randomUUID();let lost=false;
 const tap=tapRest(owned.restUrl,async(call,forward)=>{const response=await forward();if(!lost&&call.resource==='rpc/execute_merchant_totp_command_v1'&&(call.json as {p_command?:string})?.p_command==='verify'){lost=true;return restJson(503,{message:'synthetic-activation-committed-reply-lost'});}return response;});
 try{const failed=await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)},{key});assert.equal(failed.status,503,explain(failed));assert.equal(factorState(p.id),'active');}finally{tap.restore();}
 const before=owned.psql(`SELECT md5(recovery_code_hashes::text)FROM merchant_2fa_factors WHERE id='${p.id}';`);
 const retry=await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)},{key});assert.equal(retry.status,200,explain(retry));assert.equal(retry.json?.data.recovery_codes.length,8);
 const replay=await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)},{key});assert.equal(replay.status,200,explain(replay));assert.equal(JSON.stringify(retry.json?.data.recovery_codes)===JSON.stringify(replay.json?.data.recovery_codes),true,'same command must return original encrypted result');
 assert.equal(owned.psql(`SELECT md5(recovery_code_hashes::text)FROM merchant_2fa_factors WHERE id='${p.id}';`),before);
 assert.equal(owned.psql(`SELECT count(*)FROM merchant_totp_commands_v1 WHERE actor_id='${f.owner}'AND command='verify'AND result_ciphertext IS NOT NULL;`),'1');
 assert.equal(owned.psql(`SELECT count(*)FROM idempotency_keys WHERE site_id='${f.siteId}'AND scope LIKE 'http:POST:/2fa/%';`),'0');
 assert.match(retry.headers.get('cache-control')||'',/(?:^|,\s*)no-store(?:,|$)/);assert.equal(owned.psql(`SELECT count(*)FROM audit_logs WHERE actor_id='${f.owner}'AND action='merchant.totp.verify';`),'1');
});
for(const mode of ['same-key','different-keys']as const)test('concurrent '+mode+' activation commits exactly one recovery-code set',async()=>{
 const f=await fixture(),p=await pending(f),key=crypto.randomUUID(),barrier=newBarrier(2);
 const tap=tapRest(owned.restUrl,async(call,forward)=>{if(call.resource==='rpc/execute_merchant_totp_command_v1')await barrier.arrive();return forward();});
 try{const results=await Promise.all([key,mode==='same-key'?key:crypto.randomUUID()].map(k=>f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)},{key:k})));
 assert.equal(results.filter(r=>r.status===200).length,mode==='same-key'?2:1);assert.ok(results.every(r=>[200,409].includes(r.status)));if(mode==='same-key')assert.equal(JSON.stringify(results[0].json?.data.recovery_codes)===JSON.stringify(results[1].json?.data.recovery_codes),true,'concurrent replay must share the encrypted result');
 assert.equal(owned.psql(`SELECT count(*)FROM merchant_totp_commands_v1 WHERE actor_id='${f.owner}'AND command='verify';`),'1');assert.equal(factorState(p.id),'active');
 }finally{tap.restore();}
});
test('recovery codes support an owned disable, deny invalid and foreign proofs, and never reactivate the disabled factor',async()=>{
 const f=await fixture(),other=await fixture(),p=await pending(f),active=await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)});assert.equal(active.status,200,explain(active));const code=active.json?.data.recovery_codes[0];
 const invalid=await f.call('POST','/2fa/disable',{factor_id:p.id,recovery_code:'INVALID-RECOVERY-CODE'});assert.equal(invalid.status,409,explain(invalid));assert.equal(factorState(p.id),'active');
 const foreign=await other.call('POST','/2fa/disable',{factor_id:p.id,recovery_code:code});assert.equal(foreign.status,404,explain(foreign));assert.equal(factorState(p.id),'active');
 const key=crypto.randomUUID(),done=await f.call('POST','/2fa/disable',{factor_id:p.id,recovery_code:code},{key});assert.equal(done.status,200,explain(done));assert.equal(factorState(p.id),'disabled');
 const retry=await f.call('POST','/2fa/disable',{factor_id:p.id},{key});assert.equal(retry.status,200,explain(retry));assert.equal(owned.psql(`SELECT cardinality(recovery_code_hashes)FROM merchant_2fa_factors WHERE id='${p.id}';`),'0');
 assert.equal((await f.call('POST','/2fa/disable',{factor_id:p.id,recovery_code:code})).status,404);
 assert.equal((await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)})).status,404);
});
test('expired or disabled activation receipts cannot redisclose recovery credentials',async()=>{
 const f=await fixture(),p=await pending(f),key=crypto.randomUUID();assert.equal((await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)},{key})).status,200);
 owned.psql(`UPDATE merchant_totp_commands_v1 SET created_at=clock_timestamp()-interval '11 minutes'WHERE actor_id='${f.owner}'AND command_key='${key}';`);
 const expired=await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)},{key});assert.equal(expired.status,409,explain(expired));assert.equal(expired.json?.data?.recovery_codes,undefined);
 assert.equal((await f.call('POST','/2fa/disable',{factor_id:p.id,code:otp(p.secret)})).status,200);
 const disabled=await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)},{key});assert.equal(disabled.status,404,explain(disabled));assert.equal(disabled.json?.data?.recovery_codes,undefined);
});
test('a named receipt write failure rolls activation and audit back so a retry can finish',async()=>{
 const f=await fixture(),p=await pending(f),key=crypto.randomUUID(),name='syn_mfa_'+crypto.randomUUID().replaceAll('-','');
 owned.psql(`CREATE FUNCTION public.${name}()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic-factor-receipt-failure';END$$;CREATE TRIGGER ${name} BEFORE INSERT ON merchant_totp_commands_v1 FOR EACH ROW WHEN(NEW.actor_id='${f.owner}'AND NEW.command='verify')EXECUTE FUNCTION public.${name}();`);
 try{const failed=await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)},{key});assert.equal(failed.status,503,explain(failed));assert.equal(factorState(p.id),'pending');assert.equal(owned.psql(`SELECT count(*)FROM audit_logs WHERE actor_id='${f.owner}'AND action='merchant.totp.verify';`),'0');}
 finally{owned.psql(`DROP TRIGGER ${name} ON merchant_totp_commands_v1;DROP FUNCTION public.${name}();`);}
 assert.equal((await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)},{key})).status,200);
});
test('credential commands require bounded keys and reject changed command intent for an existing key',async()=>{
 const f=await fixture();for(const key of ['', 'short', 'x'.repeat(201)]){const r=await f.call('POST','/2fa/totp/enroll',undefined,{key});assert.equal(r.status,400,explain(r));}
 const key=crypto.randomUUID(),p=await f.call('POST','/2fa/totp/enroll',undefined,{key});assert.equal(p.status,201,explain(p));
 const changed=await f.call('POST','/2fa/totp/verify',{factor_id:p.json?.data.factor.id,code:otp(p.json?.data.secret)},{key});assert.equal(changed.status,409,explain(changed));assert.equal(factorState(p.json?.data.factor.id),'pending');
});
test('actual untrusted database roles cannot execute credential commands or read private receipts and factors',()=>{
 assert.equal(owned.psql(`SELECT count(*)FROM pg_class WHERE oid IN('merchant_2fa_factors'::regclass,'merchant_totp_commands_v1'::regclass)AND relrowsecurity AND relforcerowsecurity;`),'2');
 for(const role of ['anon','authenticated','app_tenant']){
  assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT execute_merchant_totp_command_v1(NULL,'enroll','synthetic-role-test','{}');`),/permission denied for function/);
  assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT * FROM merchant_totp_commands_v1;`),/permission denied/);
  assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT * FROM merchant_2fa_factors;`),/permission denied/);
  assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT request_merchant_erasure_review_v1(NULL,NULL,'syn@example.invalid','synthetic reason','synthetic-role-test',NULL);`),/permission denied for function/);
 }
 assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE service_role;UPDATE merchant_2fa_factors SET status='disabled';`),/permission denied/);
 assert.equal(owned.script(`BEGIN;SET LOCAL ROLE service_role;SELECT (execute_merchant_totp_command_v1(NULL,'enroll','synthetic-role-test','{}')->>'accepted')::boolean;COMMIT;`).trim(),'f');
});
test('retirement removes only legacy credential HTTP bodies and is idempotent without copying secrets into audit',async()=>{
 const f=await fixture(),ids=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
 for(const [i,path]of ['/2fa/totp/enroll','/2fa/totp/verify','/products'].entries())owned.psql(`INSERT INTO idempotency_keys(id,site_id,key,scope,request_hash,response_body,response_hash,status,status_code,expires_at)VALUES('${ids[i]}','${f.siteId}','syn-${ids[i]}','http:POST:${path}','syn-request-hash','{"data":{"secret":"SYNTHETIC-RETIRE-ME","recovery_codes":["SYNTHETIC-RETIRE-ME"]}}','syn-old-hash','completed',200,clock_timestamp()+interval '1 day');`);
 assert.equal(owned.script(`BEGIN;SET LOCAL ROLE service_role;SELECT retire_merchant_totp_http_credentials_v1();COMMIT;`).trim(),'2');assert.equal(owned.psql(`SELECT retire_merchant_totp_http_credentials_v1();`),'0');
 for(const id of ids.slice(0,2)){assert.equal(owned.psql(`SELECT status||'|'||status_code||'|'||request_hash||'|'||(response_hash IS NULL)::text||'|'||(response_body#>'{data,secret}'IS NULL)::text FROM idempotency_keys WHERE id='${id}';`),'failed|409|syn-request-hash|true|true');}
 assert.equal(owned.psql(`SELECT count(*)FROM audit_logs WHERE resource_id IN('${ids[0]}','${ids[1]}')AND metadata::text NOT LIKE '%SYNTHETIC-RETIRE-ME%'AND old_values IS NULL;`),'2');assert.equal(owned.psql(`SELECT status FROM idempotency_keys WHERE id='${ids[2]}';`),'completed');
});

// Remaining intake race tests use synthetic MAC proof only. The positive above
// independently completes real enrollment/activation/challenge API issuance.
async function review(f:Awaited<ReturnType<typeof fixture>>,key:string,email='syn-review@example.invalid',reason='Synthetic erasure review request'){
 const proof=await signSensitiveActionStepUp({action:'customer.dsr.erase',actorId:f.owner,siteId:f.siteId,challengeId:'syn-review-'+crypto.randomUUID(),signingSecret:STEP});
 return f.call('POST','/security/dsr/erase',{store_id:f.siteId,email,reason,idempotency_key:key},{headers:{'X-Step-Up-Token':proof.token,'X-Step-Up-Verified-At':proof.verifiedAt}});
}
test('erasure review retries bind actor, site and intent and preserve one open audited request',async()=>{
 const f=await fixture(),key=crypto.randomUUID(),first=await review(f,key);assert.equal(first.status,202,explain(first));const id=first.json?.data.request_id;
 const again=await review(f,key);assert.equal(again.status,202,explain(again));assert.equal(again.json?.data.request_id,id);assert.equal(again.json?.data.erased,false);assert.equal(again.json?.data.status,'open');
 assert.equal((await review(f,key,'syn-changed@example.invalid')).status,409);
 assert.equal(owned.psql(`SELECT count(*)FROM audit_logs WHERE resource_id='${id}'AND action='customer.erasure.review_requested';`),'1');assert.equal(owned.psql(`SELECT count(*)FROM outbox_events WHERE aggregate_id='${id}'AND event_type='customer.dsr_requested';`),'1');
 assert.equal(owned.psql(`SELECT status||'|'||(fulfilled_at IS NULL)::text||'|'||(metadata->>'erasure_authorized')FROM data_subject_requests WHERE id='${id}';`),'open|true|false');
});
test('review intake rechecks ownership under its database lock before saving a request',async()=>{
 const f=await fixture(),other=await fixture();let revoked=false;
 const tap=tapRest(owned.restUrl,async(call,forward)=>{if(!revoked&&call.resource==='rpc/request_merchant_erasure_review_v1'){revoked=true;owned.psql(`UPDATE sites SET custom_user_id='${other.owner}'WHERE id='${f.siteId}';`);}return forward();});
 try{const result=await review(f,crypto.randomUUID());assert.equal(result.status,404,explain(result));assert.equal(revoked,true);assert.equal(owned.psql(`SELECT count(*)FROM data_subject_requests WHERE site_id='${f.siteId}';`),'0');}finally{tap.restore();}
});
test('review request and audit roll back on an outbox write fault, then a committed lost reply retries safely',async()=>{
 const f=await fixture(),key=crypto.randomUUID(),name='syn_dsr_'+crypto.randomUUID().replaceAll('-','');
 owned.psql(`CREATE FUNCTION public.${name}()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic-review-event-fault';END$$;CREATE TRIGGER ${name} BEFORE INSERT ON outbox_events FOR EACH ROW WHEN(NEW.site_id='${f.siteId}'AND NEW.event_type='customer.dsr_requested')EXECUTE FUNCTION public.${name}();`);
 try{const r=await review(f,key);assert.equal(r.status,503,explain(r));assert.equal(owned.psql(`SELECT count(*)FROM data_subject_requests WHERE site_id='${f.siteId}';`),'0');assert.equal(owned.psql(`SELECT count(*)FROM audit_logs WHERE actor_id='${f.owner}'AND action='customer.erasure.review_requested';`),'0');}
 finally{owned.psql(`DROP TRIGGER ${name} ON outbox_events;DROP FUNCTION public.${name}();`);}
 let lost=false;const tap=tapRest(owned.restUrl,async(call,forward)=>{const r=await forward();if(!lost&&call.resource==='rpc/request_merchant_erasure_review_v1'){lost=true;return restJson(503,{message:'synthetic-review-committed-reply-lost'});}return r;});
 try{assert.equal((await review(f,key)).status,503);}finally{tap.restore();}
 const retry=await review(f,key);assert.equal(retry.status,202,explain(retry));assert.equal(owned.psql(`SELECT count(*)FROM data_subject_requests WHERE site_id='${f.siteId}';`),'1');
});
test('legacy erasure history is refused for review without relabeling it or deleting customer data',async()=>{
 const f=await fixture(),key=crypto.randomUUID(),id=crypto.randomUUID();owned.psql(`INSERT INTO data_subject_requests(id,site_id,request_type,subject_type,subject_email,source,status,due_at,idempotency_key,reason,actor_type,actor_id)VALUES('${id}','${f.siteId}','erasure','customer','syn-review@example.invalid','manual','fulfilled',clock_timestamp(),'${key}','Synthetic legacy history','system','${f.owner}');`);
 const r=await review(f,key);assert.equal(r.status,409,explain(r));assert.equal(r.json?.error.code,'DSR_LEGACY_REVIEW_REQUIRED');assert.equal(owned.psql(`SELECT status FROM data_subject_requests WHERE id='${id}';`),'fulfilled');
});
test('rollback refuses credential and review histories while preserving their definitions',async()=>{
 const f=await fixture();await pending(f);assert.equal((await review(f,crypto.randomUUID())).status,202);
 for(const [n,file]of [[338,'merchant_totp_authority'],[339,'merchant_erasure_review_intake']]as const){
  const script=readFileSync(`database/supabase/rollback/${n}_${file}.rollback.sql`,'utf8');assert.match(owned.psqlExpectError(script),/refuses.*history/);
 }
 assert.equal(owned.psql(`SELECT to_regprocedure('public.execute_merchant_totp_command_v1(uuid,text,text,jsonb)')IS NOT NULL;`),'t');
});

test('previously issued merchant recovery-code format remains usable for one owned disable',async()=>{
 const f=await fixture(),p=await pending(f);assert.equal((await f.call('POST','/2fa/totp/verify',{factor_id:p.id,code:otp(p.secret)})).status,200);
 owned.psql(`UPDATE merchant_2fa_factors SET recovery_code_hashes=ARRAY[encode(extensions.digest('${p.id}:ABCDE-12345','sha256'),'hex')]WHERE id='${p.id}';`);
 const result=await f.call('POST','/2fa/disable',{factor_id:p.id,recovery_code:'abcde-12345'});assert.equal(result.status,200,explain(result));assert.equal(factorState(p.id),'disabled');
});
