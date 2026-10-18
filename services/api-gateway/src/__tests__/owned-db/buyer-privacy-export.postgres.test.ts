// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Actual Gateway/PostgREST/PostgreSQL. Explicit synthetic trusted-issuer API
// credentials and local KMS are separate from normal Identity/browser proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import bcrypt from 'bcryptjs';
import {createLetbuyyInternalAppHeaders,LETBUYY_BUYER_SESSION_HEADER} from '@letbuyy/auth-core';
import {Gateway,gatewayEnv,newIdentityKeys,seedBuyerAccount,buyerHeaders,INTERNAL_SECRET,tapRest,newBarrier} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from './synthetic-tenant';
const owned=requireOwnedDatabase();
const root='/v1/storefront/buyer/privacy-requests';
type Meta={export_id:string;request_id:string;expires_at:string;single_use:boolean};
async function fixture(run:(j:Awaited<ReturnType<typeof setup>>)=>Promise<void>){const j=await setup();try{await run(j);}finally{j.trace.restore();await j.gateway.settle();}}
async function setup(){
 const keys=await newIdentityKeys(),env=gatewayEnv(owned,keys,{LETBUYY_KMS_MODE:'sandbox',LETBUYY_KMS_SANDBOX_SECRET:'synthetic-owned-export-'+crypto.randomUUID()}),gateway=new Gateway(env);
 const buyer=seedBuyerAccount(owned.psql,'privacy-export'),other=seedBuyerAccount(owned.psql,'privacy-other'),password='Synthetic-privacy-export-password-42';
 const hash=await bcrypt.hash(password,10);owned.psql(`UPDATE buyer_accounts SET password_hash='${hash}',full_name='Synthetic export buyer' WHERE id IN ('${buyer.id}','${other.id}');`);
 const headers=await buyerHeaders(keys,buyer.id),otherHeaders=await buyerHeaders(keys,other.id);
 const trace=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{const response=await forward();if(call.resource.startsWith('rpc/')&&!response.ok){const error=await response.clone().json() as {code?:string;message?:string};console.info('OWNED_BUYER_EXPORT_RPC_DIAGNOSTIC '+JSON.stringify({rpc:call.resource,code:error.code,message:error.message?.replace(/\$2[abxy]\$[^\s"']+/g,'[redacted-password-hash]')}));}return response;});
 const intake=await gateway.request(root,{method:'POST',headers,body:JSON.stringify({type:'access',notes:'Synthetic accepted restricted export request'})});assert.equal(intake.status,201,intake.text);const ticket=intake.json!.data.id as string,key=crypto.randomUUID();
 async function prepare(body:Record<string,unknown>={},credential=headers){const app=await createLetbuyyInternalAppHeaders({app:'accounts',secret:INTERNAL_SECRET});assert.ok(app.ok&&app.headers);return gateway.request(root+'/'+ticket+'/export',{method:'POST',headers:{...credential,...app.headers},body:JSON.stringify({password,request_key:key,...body})});}
 async function ready(body:Record<string,unknown>={}){const r=await prepare(body);assert.equal(r.status,201,r.text);return r.json!.data as Meta;}
 async function download(meta:Meta,credential=headers,worker=gateway){return worker.request(root+'/'+ticket+'/exports/'+meta.export_id+'/download',{method:'POST',headers:credential,body:'{}'});}
 const artifacts=()=>Number(owned.psql(`SELECT count(*) FROM customer_dsr_exports WHERE buyer_account_id='${buyer.id}';`));
 const audits=(action:string)=>Number(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${buyer.id}' AND action='buyer.privacy.${action}';`));
 const status=()=>owned.psql(`SELECT status||'|'||coalesce(metadata->>'fulfillment_outcome','none') FROM support_tickets WHERE id='${ticket}';`);
 return {keys,env,gateway,buyer,other,password,hash,headers,otherHeaders,trace,ticket,key,prepare,ready,download,artifacts,audits,status};
}
test('staff invitation FORCE RLS clean rollback/reapply and retained-credential refusal preserve policies and grants',()=>{
 const path=(rel:string)=>readFileSync(new URL('../../../../../database/supabase/'+rel,import.meta.url),'utf8'),before=owned.psql("SELECT relacl::text FROM pg_class WHERE oid='employee_invites'::regclass;");
 owned.script(path('rollback/331_staff_invitation_force_rls.rollback.sql'));assert.equal(owned.psql("SELECT relforcerowsecurity FROM pg_class WHERE oid='employee_invites'::regclass;"),'f');
 owned.script(path('migrations/331_staff_invitation_force_rls.sql'));assert.equal(owned.psql("SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='employee_invites'::regclass;"),'t');
 const id=crypto.randomUUID();owned.psql(`INSERT INTO employee_invites(id,email,role,token,expires_at) VALUES('${id}','syn-force-proof@example.invalid','support','synthetic-owned-retained-invitation',now()+interval '1 day');`);
 try{assert.match(owned.psqlExpectError(path('rollback/331_staff_invitation_force_rls.rollback.sql')),/refuses retained staff invitation evidence/);owned.script(path('migrations/331_staff_invitation_force_rls.sql'));assert.equal(owned.psql(`SELECT count(*) FROM employee_invites WHERE id='${id}';`),'1');}finally{owned.psql(`DELETE FROM employee_invites WHERE id='${id}';`);}
 assert.equal(owned.psql("SELECT relacl::text FROM pg_class WHERE oid='employee_invites'::regclass;"),before);
});
test('clean paired330 rollback/reapply restores original scopes and all private RPC ACLs',()=>{
 const path=(rel:string)=>readFileSync(new URL('../../../../../database/supabase/'+rel,import.meta.url),'utf8');
 owned.script(path('rollback/330_verified_buyer_privacy_exports.rollback.sql'));
 assert.equal(owned.psql("SELECT attnotnull FROM pg_attribute WHERE attrelid='customer_dsr_exports'::regclass AND attname='site_id';"),'t');
 assert.equal(owned.psql("SELECT to_regprocedure('public.access_buyer_export_v1(text,uuid,integer,text,uuid,uuid,text)') IS NULL;"),'t');
 owned.script(path('migrations/330_verified_buyer_privacy_exports.sql'));
 for(const role of ['anon','authenticated','app_tenant'])assert.equal(owned.psql(`SELECT has_function_privilege('${role}','public.begin_buyer_export_proof_v1(uuid,integer,text,uuid,uuid)','EXECUTE');`),'f');
});
test('current own password prepares encrypted metadata; normal download releases exactly the accepted own fields and no other buyer, agent note or security material',()=>fixture(async j=>{
 for(const b of [j.buyer,j.other])owned.psql(`INSERT INTO buyer_addresses(buyer_account_id,full_name,phone,address_line1,city,state,postal_code,country) VALUES('${b.id}','Synthetic recipient','9999999999','${b.id===j.buyer.id?'Canonical own address':'Never export other address'}','Synthetic city','Synthetic state','600001','IN');`);
 const site=newSyntheticTenant('export-orders');seedSyntheticTenant(owned.psql,site);
 for(const b of [j.buyer,j.other]){const order=seedSyntheticOrder(owned.psql,site);owned.psql(`UPDATE orders SET notes='Never export merchant notes',payment_id='syn-private-payment' WHERE id='${order.orderId}';INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis) VALUES('${order.orderId}','${b.id}','${site.siteId}','authenticated_checkout');`);}
 owned.psql(`INSERT INTO ticket_messages(ticket_id,author_type,visibility,body) VALUES('${j.ticket}','agent','internal','Never export internal agent reasoning');`);
 const prepared=await j.prepare();assert.equal(prepared.status,201,prepared.text);const meta=prepared.json!.data as Meta;assert.equal(meta.request_id,j.ticket);assert.equal(meta.single_use,true);assert.ok(Date.parse(meta.expires_at)>Date.now()&&Date.parse(meta.expires_at)<=Date.now()+600000);assert.equal(prepared.json!.data.payload,undefined);assert.match(prepared.headers.get('cache-control')??'',/no-store/);
 const sealed=owned.psql(`SELECT encrypted_payload FROM customer_dsr_exports WHERE id='${meta.export_id}';`);assert.doesNotMatch(sealed,/Canonical own address|Synthetic export buyer|password_hash/);assert.equal(j.status(),'open|none');
 const result=await j.download(meta);assert.equal(result.status,200,result.text);assert.match(result.headers.get('content-disposition')??'',/attachment/);assert.match(result.headers.get('cache-control')??'',/no-store/);
 const data=JSON.parse(result.text);assert.equal(data.buyerAccountId,j.buyer.id);assert.equal(data.requestId,j.ticket);assert.equal(data.complete,true);assert.equal(data.sections.profile[0].email,j.buyer.email);assert.equal(data.sections.addresses.length,1);assert.equal(data.sections.addresses[0].phone,'9999999999');assert.equal(data.sections.orders.length,1);assert.deepEqual(data.sections.authored_requests[0].authored_messages,['Synthetic accepted restricted export request']);
 assert.doesNotMatch(result.text,/Never export|password_hash|session_epoch|source_digest|encrypted_payload|syn-private-payment/);assert.equal(j.status(),'resolved|fulfilled');assert.equal(j.audits('export_prepared'),1);assert.equal(j.audits('export_released'),1);
 assert.equal((await j.download(meta)).status,410);assert.equal(j.audits('export_released'),1);
}));
test('Identity signature, valid own buyer, exact input and canonical realm are mandatory before proof or export writes',()=>fixture(async j=>{
 const path=root+'/'+j.ticket+'/export';assert.equal((await j.gateway.request(path,{method:'POST',headers:j.headers,body:JSON.stringify({password:j.password,request_key:j.key})})).status,401);
 assert.equal((await j.prepare({buyer_account_id:j.other.id})).status,400);
 assert.equal((await j.prepare({},j.otherHeaders)).status,404);
 for(const h of [await buyerHeaders(j.keys,j.buyer.id,{epoch:2}),await buyerHeaders(j.keys,j.buyer.id,{expiresInSeconds:-60}),await buyerHeaders(j.keys,j.buyer.id,{audience:'letbuyy:merchant-session',tokenUse:'merchant_session'})])assert.equal((await j.prepare({},h)).status,401);
 assert.equal(j.artifacts(),0);assert.equal(j.status(),'open|none');assert.equal(owned.psql(`SELECT count(*) FROM step_up_challenges WHERE buyer_account_id='${j.buyer.id}';`),'0');
}));
test('five wrong own-password attempts share durable account quota across sessions; none prepares or fulfills data',()=>fixture(async j=>{
 for(let n=0;n<5;n++){const h=n%2?await buyerHeaders(j.keys,j.buyer.id):j.headers;assert.equal((await j.prepare({password:'Synthetic-wrong-password',request_key:crypto.randomUUID()},h)).status,401);}
 const blocked=await j.prepare();assert.equal(blocked.status,429,blocked.text);assert.equal(j.artifacts(),0);assert.equal(j.status(),'open|none');assert.equal(j.audits('export_prepared'),0);
}));
test('another buyer, copied URL, forged fields and a different legitimate sign-in cannot read or consume the grant',()=>fixture(async j=>{
 const meta=await j.ready();assert.equal((await j.download(meta,j.otherHeaders)).status,404);assert.equal((await j.download(meta,{})).status,401);assert.equal((await j.download(meta,await buyerHeaders(j.keys,j.buyer.id))).status,403);
 const list=await j.gateway.request(root+'/'+j.ticket+'/exports',{headers:j.otherHeaders});assert.equal(list.status,404);
 assert.equal((await j.gateway.request(root+'/'+j.ticket+'/exports/'+meta.export_id+'/download',{headers:j.headers})).status,401,'GET/prefetch is never the download capability');
 assert.equal(j.status(),'open|none');assert.equal(j.audits('export_released'),0);assert.equal((await j.download(meta)).status,200);
}));
test('same-key concurrent prepare returns one immutable encrypted artifact and audit',()=>fixture(async j=>{
 const barrier=newBarrier(2),tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{if(call.resource==='rpc/snapshot_buyer_export_v1')await barrier.arrive();return forward();});
 let replies;try{replies=await Promise.all([j.prepare(),j.prepare()]);}finally{tap.restore();}
 assert.deepEqual(replies.map(r=>r.status).sort(),[200,201],replies.map(r=>r.text).join(' '));assert.equal(replies[0].json!.data.export_id,replies[1].json!.data.export_id);assert.equal(j.artifacts(),1);assert.equal(j.audits('export_prepared'),1);
}));
test('two concurrent releases have exactly one winner; a post-commit retry never returns the bytes twice',()=>fixture(async j=>{
 const meta=await j.ready(),barrier=newBarrier(2),tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{if(call.resource==='rpc/access_buyer_export_v1'&&(call.json as any)?.p_operation==='consume')await barrier.arrive();return forward();});
 let replies;try{replies=await Promise.all([j.download(meta),j.download(meta,j.headers,new Gateway(j.env))]);}finally{tap.restore();}
 assert.deepEqual(replies.map(r=>r.status).sort(),[200,410],replies.map(r=>r.text).join(' '));assert.equal(j.audits('export_released'),1);assert.equal((await j.download(meta)).status,410);
}));
test('saved metadata recovers a lost prepare reply without rebuilding the payload or extending expiry; a new sign-in cannot reuse the request key',()=>fixture(async j=>{
 const meta=await j.ready(),before=owned.psql(`SELECT encrypted_payload||'|'||payload_digest||'|'||expires_at FROM customer_dsr_exports WHERE id='${meta.export_id}';`);
 const retry=await j.prepare();assert.equal(retry.status,200,retry.text);assert.equal(retry.json!.data.export_id,meta.export_id);assert.equal(retry.json!.data.replayed,true);
 assert.equal(owned.psql(`SELECT encrypted_payload||'|'||payload_digest||'|'||expires_at FROM customer_dsr_exports WHERE id='${meta.export_id}';`),before);
 assert.equal((await j.prepare({},await buyerHeaders(j.keys,j.buyer.id))).status,409);assert.equal(j.artifacts(),1);assert.equal(j.audits('export_prepared'),1);
}));
test('password or epoch change invalidates an existing release; a new proof is required',()=>fixture(async j=>{
 const meta=await j.ready();owned.psql(`UPDATE buyer_accounts SET password_hash='${await bcrypt.hash('Synthetic-replacement-password',10)}' WHERE id='${j.buyer.id}';`);assert.equal((await j.download(meta)).status,409);assert.equal(j.audits('export_released'),0);
 owned.psql(`UPDATE buyer_accounts SET session_epoch=2 WHERE id='${j.buyer.id}';`);assert.equal((await j.download(meta)).status,401);assert.equal((await j.download(meta,await buyerHeaders(j.keys,j.buyer.id,{epoch:2}))).status,403);assert.equal(j.status(),'open|none');
}));
for(const stage of ['snapshot_buyer_export_v1','save_buyer_export_v1'])test('password replacement immediately before '+stage+' refuses stale successful verification',()=>fixture(async j=>{
 let changed=false;const replacement=await bcrypt.hash('Synthetic-racing-replacement-password',10);
 const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{if(!changed&&call.resource==='rpc/'+stage){changed=true;owned.psql(`UPDATE buyer_accounts SET password_hash='${replacement}' WHERE id='${j.buyer.id}';`);}return forward();});
 try{const r=await j.prepare();assert.equal(changed,true);assert.equal(r.status,409,r.text);assert.equal(j.artifacts(),0);assert.equal(j.audits('export_prepared'),0);assert.equal(j.status(),'open|none');}finally{tap.restore();}
}));
for(const fault of ['password','epoch','grant expiry','proof expired'])test('release rechecks '+fault+' after successful inspect and decryption',()=>fixture(async j=>{
 const meta=await j.ready(),replacement=await bcrypt.hash('Synthetic-racing-release-password',10);let changed=false;
 const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
  if(!changed&&call.resource==='rpc/access_buyer_export_v1'&&(call.json as any)?.p_operation==='consume'){
   changed=true;
   if(fault==='password')owned.psql(`UPDATE buyer_accounts SET password_hash='${replacement}' WHERE id='${j.buyer.id}';`);
   if(fault==='epoch')owned.psql(`UPDATE buyer_accounts SET session_epoch=session_epoch+1 WHERE id='${j.buyer.id}';`);
   if(fault==='grant expiry')owned.psql(`UPDATE customer_dsr_exports SET buyer_verified_at=clock_timestamp()-interval '11 minutes',expires_at=clock_timestamp()-interval '1 minute' WHERE id='${meta.export_id}';`);
   if(fault==='proof expired')owned.psql(`UPDATE step_up_challenges SET status='expired' WHERE buyer_account_id='${j.buyer.id}';`);
  }return forward();
 });
 try{const r=await j.download(meta);assert.equal(changed,true);assert.equal(r.status,fault==='epoch'?401:fault==='grant expiry'?410:409,r.text);assert.equal(j.audits('export_released'),0);assert.equal(j.status(),'open|none');assert.equal(owned.psql(`SELECT status FROM customer_dsr_exports WHERE id='${meta.export_id}';`),'ready');}finally{tap.restore();}
}));
for(const stage of ['begin','snapshot'])test('an explicitly expired proof with a future timestamp is never revived at '+stage,()=>fixture(async j=>{
 if(stage==='begin'){
  assert.equal((await j.prepare({password:'Synthetic-wrong-password'})).status,401);
  owned.psql(`UPDATE step_up_challenges SET status='expired' WHERE buyer_account_id='${j.buyer.id}';`);
 }
 let changed=false;const tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{if(stage==='snapshot'&&!changed&&call.resource==='rpc/snapshot_buyer_export_v1'){changed=true;owned.psql(`UPDATE step_up_challenges SET status='expired' WHERE buyer_account_id='${j.buyer.id}';`);}return forward();});
 try{const r=await j.prepare();assert.equal(r.status,410,r.text);assert.equal(j.artifacts(),0);assert.equal(j.audits('export_prepared'),0);assert.equal(j.status(),'open|none');assert.equal(owned.psql(`SELECT status FROM step_up_challenges WHERE buyer_account_id='${j.buyer.id}';`),'expired');}finally{tap.restore();}
}));
test('expired verification and grant refuse release and read back expired without falsely fulfilling the request',()=>fixture(async j=>{
 const meta=await j.ready();owned.psql(`UPDATE customer_dsr_exports SET buyer_verified_at=now()-interval '11 minutes',expires_at=now()-interval '1 minute' WHERE id='${meta.export_id}';`);
 assert.equal((await j.download(meta)).status,410);const read=await j.gateway.request(root+'/'+j.ticket+'/exports',{headers:j.headers});assert.equal(read.status,200,read.text);assert.equal(read.json!.data.items[0].status,'expired');assert.equal(j.status(),'open|none');assert.equal(j.audits('export_released'),0);
}));
test('key outage and damaged encrypted bytes preserve a recoverable unconsumed grant',()=>fixture(async j=>{
 const meta=await j.ready(),secret=j.env.LETBUYY_KMS_SANDBOX_SECRET,raw=owned.psql(`SELECT encrypted_payload FROM customer_dsr_exports WHERE id='${meta.export_id}';`);
 j.env.LETBUYY_KMS_SANDBOX_SECRET='synthetic-wrong-decryption-key';assert.equal((await j.download(meta)).status,503);j.env.LETBUYY_KMS_SANDBOX_SECRET=secret;
 owned.psql(`UPDATE customer_dsr_exports SET encrypted_payload='synthetic-unreadable-envelope' WHERE id='${meta.export_id}';`);assert.equal((await j.download(meta)).status,503);owned.psql(`UPDATE customer_dsr_exports SET encrypted_payload='${raw}' WHERE id='${meta.export_id}';`);
 assert.equal(j.status(),'open|none');assert.equal(j.audits('export_released'),0);assert.equal((await j.download(meta)).status,200);
}));
test('missing live KMS refuses before password quota or export effects',()=>fixture(async j=>{
 j.env.LETBUYY_KMS_MODE='live';j.env.LETBUYY_KMS_KEY_ID=undefined;assert.equal((await j.prepare()).status,503);assert.equal(j.artifacts(),0);assert.equal(owned.psql(`SELECT count(*) FROM step_up_challenges WHERE buyer_account_id='${j.buyer.id}';`),'0');assert.equal(j.status(),'open|none');
}));
for(const action of ['export_prepared','export_released'])test('mandatory '+action+' audit failure rolls back its effect and permits exact recovery',()=>fixture(async j=>{
 let meta:Meta|undefined;if(action==='export_released')meta=await j.ready();const name='owned_export_fault_'+j.buyer.id.replaceAll('-','');
 owned.psql(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.actor_id='${j.buyer.id}' AND NEW.action='buyer.privacy.${action}' THEN RAISE EXCEPTION 'Synthetic owned mandatory export audit fault';END IF;RETURN NEW;END$$;CREATE TRIGGER ${name} BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION ${name}();`);
 try{const refused=meta?await j.download(meta):await j.prepare();assert.equal(refused.status,503,refused.text);assert.equal(j.status(),'open|none');assert.equal(j.audits(action),0);assert.equal(j.artifacts(),meta?1:0);}finally{owned.psql(`DROP TRIGGER ${name} ON audit_logs;DROP FUNCTION ${name}();`);}
 if(meta)assert.equal((await j.download(meta)).status,200);else assert.equal((await j.prepare()).status,201);assert.equal(j.audits(action),1);
}));
test('bounded snapshot refuses excess data without truncation or fulfillment',()=>fixture(async j=>{
 owned.psql(`INSERT INTO buyer_addresses(buyer_account_id,full_name,address_line1,city,state,postal_code) SELECT '${j.buyer.id}','Synthetic recipient','Synthetic address '||n,'Synthetic city','Synthetic state','600001' FROM generate_series(1,201)n;`);
 const result=await j.prepare();assert.equal(result.status,413,result.text);assert.equal(j.artifacts(),0);assert.equal(j.status(),'open|none');assert.equal(j.audits('export_prepared'),0);
}));
test('ordinary database roles cannot read private proof or encrypted global artifacts, invoke RPCs, or forge fulfillment',()=>fixture(async j=>{
 const meta=await j.ready(),before=owned.psql(`SELECT status||'|'||metadata::text FROM customer_dsr_exports WHERE id='${meta.export_id}';`);
 for(const role of ['anon','authenticated','app_tenant']){
  assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT begin_buyer_export_proof_v1('${j.buyer.id}',1,'${'a'.repeat(64)}','${j.ticket}','${crypto.randomUUID()}');`),/permission denied for function/);
  for(const table of ['step_up_challenges','customer_dsr_exports']){
   try{assert.equal(owned.script(`SET ROLE ${role};SELECT count(*) FROM ${table} WHERE buyer_account_id='${j.buyer.id}';`),'0');}catch(e){assert.match(String(e),/permission denied/);}
  }
  try{owned.script(`SET ROLE ${role};UPDATE customer_dsr_exports SET status='delivered',released_at=clock_timestamp() WHERE id='${meta.export_id}';`);}catch(e){assert.match(String(e),/permission denied|row-level security/);}
 }
 assert.equal(owned.psql(`SELECT status||'|'||metadata::text FROM customer_dsr_exports WHERE id='${meta.export_id}';`),before);assert.equal(j.status(),'open|none');
}));
test('retained proof and artifact refuse rollback; idempotent reapply preserves ciphertext, expiry, source and consumed state',()=>fixture(async j=>{
 const meta=await j.ready(),before=owned.psql(`SELECT to_jsonb(e)::text FROM customer_dsr_exports e WHERE id='${meta.export_id}';`),path=(rel:string)=>readFileSync(new URL('../../../../../database/supabase/'+rel,import.meta.url),'utf8');
 assert.match(owned.psqlExpectError(path('rollback/330_verified_buyer_privacy_exports.rollback.sql')),/refuses retained buyer export or verification evidence/);
 owned.script(path('migrations/330_verified_buyer_privacy_exports.sql'));assert.equal(owned.psql(`SELECT to_jsonb(e)::text FROM customer_dsr_exports e WHERE id='${meta.export_id}';`),before);assert.equal((await j.download(meta)).status,200);
}));
