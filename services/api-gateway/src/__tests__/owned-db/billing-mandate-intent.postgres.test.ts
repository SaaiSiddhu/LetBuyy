// Real worker/PostgREST/Postgres, disposable synthetic owners only.
// Mandates use the existing sandbox planner; no provider or bank authorisation.
import assert from 'node:assert/strict';
import test from 'node:test';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,tapRest,newBarrier} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
let sequence=0;
async function fixture(){
 const owner=crypto.randomUUID(),email=`syn-mandate-${owner}@example.invalid`,tenant=newSyntheticTenant('mandate-'+(++sequence));
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true);`);seedSyntheticTenant(owned.psql,tenant);
 owned.psql(`UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
 const post=async(body:Record<string,unknown>,actor={owner,email})=>gateway.request('/v1/billing/mandate',{method:'POST',headers:await signedIdentityHeaders(actor.owner,actor.email),body:JSON.stringify({store_id:tenant.siteId,plan_slug:'growth',billing_period:'monthly',idempotency_key:'syn-mandate-'+crypto.randomUUID(),...body})});
 const count=()=>Number(owned.psql(`SELECT count(*) FROM billing_mandates WHERE site_id='${tenant.siteId}';`));
 return {owner,email,tenant,gateway,post,count};
}
for(const [plan,minor]of [['launch',19900],['growth',69900]]as const)test(`sandbox mandate preserves ${plan} and the canonical founding amount`,async()=>{
 const f=await fixture(),key='syn-real-plan-'+crypto.randomUUID(),body={plan_slug:plan,idempotency_key:key};
 const first=await f.post(body);assert.equal(first.status,201,first.text);assert.equal(first.json?.data.mandate.plan_slug,plan);assert.equal(first.json?.data.mandate.amount_minor,minor);assert.equal(first.json?.data.mandate.provider_mode,'sandbox');
 const replay=await f.post(body);assert.equal(replay.status,200,replay.text);assert.equal(replay.json?.data.mandate.id,first.json?.data.mandate.id);assert.equal(f.count(),1);
});
test('missing, blank, unknown and upcoming plans never substitute Starter or create a mandate',async()=>{
 const f=await fixture();
 for(const plan_slug of [null,'','   ','unknown-synthetic-plan','scale','commerce_os']){
  const result=await f.post({plan_slug});assert.ok([400,404].includes(result.status),result.text);assert.equal(f.count(),0);
 }
});
test('a repeated mandate key cannot change its plan, billing period or payment instrument',async()=>{
 const f=await fixture(),idempotency_key='syn-intent-'+crypto.randomUUID(),body={idempotency_key,upi_vpa:'synthetic@upi'};
 const first=await f.post(body);assert.equal(first.status,201,first.text);
 for(const change of [{plan_slug:'launch'},{billing_period:'yearly'},{upi_vpa:'synthetic-other@upi'}]){
  const reply=await f.post({...body,...change});assert.equal(reply.status,409,'Changed intent must conflict: '+reply.text);assert.equal(f.count(),1);
 }
});
test('simultaneous retries recover one sandbox mandate without a duplicate or server error',async()=>{
 const f=await fixture(),body={idempotency_key:'syn-race-'+crypto.randomUUID()};
 const barrier=newBarrier(2),tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
  if(call.resource==='billing_mandates'&&call.method==='POST')await barrier.arrive();
  return forward();
 });
 let replies;
 try{replies=await Promise.all([f.post(body),f.post(body)]);}finally{tap.restore();}
 assert.ok(replies.every(r=>[200,201].includes(r.status)),replies.map(r=>r.text).join('\n'));
 assert.equal(replies[0].json?.data.mandate.id,replies[1].json?.data.mandate.id);assert.equal(f.count(),1);
});
test('another actor cannot create or replay a store mandate',async()=>{
 const f=await fixture(),idempotency_key='syn-owner-'+crypto.randomUUID();assert.equal((await f.post({idempotency_key})).status,201);
 const other=crypto.randomUUID(),email=`syn-mandate-other-${other}@example.invalid`;owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${other}','${email}',true);`);
 assert.equal((await f.post({idempotency_key},{owner:other,email})).status,403);assert.equal(f.count(),1);
});
