// Current canonical readback through the production Gateway worker, its actual
// session/mount/dependency wiring, owned PostgREST and disposable PostgreSQL.
// Synthetic fixture setup is not normal browser sign-in or database-role RLS proof.
import assert from 'node:assert/strict';
import test, {afterEach} from 'node:test';
import {Gateway,buyerHeaders,gatewayEnv,newIdentityKeys,seedBuyerAccount} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';

const owned=requireOwnedDatabase();
const ROOT='/v1/storefront/buyer/support/tickets';
const gateways:Gateway[]=[];
afterEach(async()=>{await Promise.all(gateways.splice(0).map(g=>g.settle()));});
async function fixture(label:string){
 const keys=await newIdentityKeys(),gateway=new Gateway(gatewayEnv(owned,keys));gateways.push(gateway);
 const site=newSyntheticTenant(label);seedSyntheticTenant(owned.psql,site);
 const a=seedBuyerAccount(owned.psql,label+'-a'),b=seedBuyerAccount(owned.psql,label+'-b');
 const headersA=await buyerHeaders(keys,a.id,{epoch:1}),headersB=await buyerHeaders(keys,b.id,{epoch:1});
 function ticket(buyer:string,subject:string,extra=''){
  const id=crypto.randomUUID();owned.psql(`INSERT INTO support_tickets(id,ticket_ref,site_id,requester_type,requester_user_id,subject,channel,topic,status,created_at)VALUES('${id}','SYN-${id}','${site.siteId}','customer','${buyer}','${subject}','chat','general','open','2026-10-01T10:00:00Z');${extra}`);return id;
 }
 function message(id:string,body:string,visibility='public'){
  const messageId=crypto.randomUUID();owned.psql(`INSERT INTO ticket_messages(id,ticket_id,author_type,visibility,body)VALUES('${messageId}','${id}','agent','${visibility}','${body}');`);return messageId;
 }
 return {keys,gateway,site,a,b,headersA,headersB,ticket,message};
}
function records(result:Awaited<ReturnType<Gateway['request']>>){assert.equal(result.status,200,result.text);assert.equal(result.json?.success,true);assert.ok(Array.isArray(result.json?.data));return result.json!.data as Record<string,unknown>[];}

test('buyer A and B read only their recorded tickets and public messages through the production mount',async()=>{
 const f=await fixture('n6-support-owned'),ta=f.ticket(f.a.id,'Synthetic A ticket'),tb=f.ticket(f.b.id,'Synthetic B ticket');
 const publicId=f.message(ta,'Synthetic public reply');f.message(ta,'Synthetic internal note','internal');f.message(tb,'Synthetic B reply');
 const deleted=f.message(ta,'Synthetic deleted reply'),deletedTicket=f.ticket(f.a.id,'Synthetic deleted ticket'),merchantTicket=f.ticket(f.a.id,'Synthetic merchant ticket');
 owned.psql(`UPDATE ticket_messages SET deleted_at=now()WHERE id='${deleted}';UPDATE support_tickets SET deleted_at=now(),created_at=now()WHERE id='${deletedTicket}';UPDATE support_tickets SET requester_type='merchant'WHERE id='${merchantTicket}';`);
 assert.deepEqual(records(await f.gateway.request(ROOT,{headers:f.headersA})).map(t=>t.id),[ta]);
 assert.deepEqual(records(await f.gateway.request(ROOT,{headers:f.headersB})).map(t=>t.id),[tb]);
 const messages=records(await f.gateway.request(`${ROOT}/${ta}/messages`,{headers:f.headersA}));
 assert.deepEqual(messages.map(m=>m.id),[publicId]);assert.deepEqual(Object.keys(messages[0]).sort(),['author_type','body','created_at','id']);
 assert.equal(messages[0].body,'Synthetic public reply');
 for(const id of [ta,crypto.randomUUID()])assert.equal((await f.gateway.request(`${ROOT}/${id}/messages`,{headers:f.headersB})).status,404);
 assert.equal((await f.gateway.request(`${ROOT}/${ta}/messages`)).status,401);
 assert.equal((await f.gateway.request(`${ROOT}/invalid/messages`,{headers:f.headersA})).status,400);
});

test('readback exposes the actual latest50 ticket and first200 oldest public-message windows without private/deleted rows',async()=>{
 const f=await fixture('n6-support-bounds'),id=f.ticket(f.a.id,'Synthetic bounded ticket');
 owned.psql(`UPDATE support_tickets SET deleted_at=now()WHERE id='${id}';
  INSERT INTO support_tickets(ticket_ref,site_id,requester_type,requester_user_id,subject,channel,topic,status,created_at)
  SELECT 'SYN-'||gen_random_uuid()::text,'${f.site.siteId}','customer','${f.a.id}','Synthetic ticket '||i,'chat','general','open','2026-10-02T10:00:00Z'::timestamptz+i*interval '1 second'FROM generate_series(1,52)i;`);
 const tickets=records(await f.gateway.request(`${ROOT}?limit=50`,{headers:f.headersA}));assert.equal(tickets.length,50);assert.equal(tickets[0].subject,'Synthetic ticket 52');assert.equal(tickets[49].subject,'Synthetic ticket 3');
 const thread=String(tickets[0].id);
 owned.psql(`INSERT INTO ticket_messages(ticket_id,author_type,visibility,body,created_at)
 SELECT '${thread}','agent','public','Synthetic public '||i,'2026-10-03T10:00:00Z'::timestamptz+i*interval '1 second'FROM generate_series(1,201)i;
 INSERT INTO ticket_messages(ticket_id,author_type,visibility,body)VALUES('${thread}','agent','internal','Synthetic private note');`);
 const messages=records(await f.gateway.request(`${ROOT}/${thread}/messages`,{headers:f.headersA}));assert.equal(messages.length,200);assert.equal(messages[0].body,'Synthetic public 1');assert.equal(messages[199].body,'Synthetic public 200');
 assert.deepEqual(records(await f.gateway.request(ROOT,{headers:f.headersB})),[]);
});

test('wrong realm, expiry and current buyer epoch revocation deny list and thread reads',async()=>{
 const f=await fixture('n6-support-revoke'),id=f.ticket(f.a.id,'Synthetic revoked ticket');f.message(id,'Synthetic current reply');
 assert.equal(records(await f.gateway.request(`${ROOT}/${id}/messages`,{headers:f.headersA})).length,1);
 const wrong=await buyerHeaders(f.keys,f.a.id,{realm:'merchant',audience:'letbuyy:merchant-session',tokenUse:'merchant_session'});
 const expired=await buyerHeaders(f.keys,f.a.id,{epoch:1,expiresInSeconds:-60});
 for(const headers of [wrong,expired])for(const path of [ROOT,`${ROOT}/${id}/messages`])assert.equal((await f.gateway.request(path,{headers})).status,401);
 owned.psql(`UPDATE buyer_accounts SET session_epoch=2 WHERE id='${f.a.id}';`);
 for(const path of [ROOT,`${ROOT}/${id}/messages`])assert.equal((await f.gateway.request(path,{headers:f.headersA})).status,401);
 assert.equal(records(await f.gateway.request(ROOT,{headers:f.headersB})).length,0);
});

test('a real owned relation outage is an error and restored public readback recovers without changing ACL',async()=>{
 const f=await fixture('n6-support-outage'),id=f.ticket(f.a.id,'Synthetic outage ticket');f.message(id,'Synthetic recoverable reply');
 const acl=owned.psql("SELECT relacl::text FROM pg_class WHERE oid='public.ticket_messages'::regclass;");
 assert.equal(records(await f.gateway.request(`${ROOT}/${id}/messages`,{headers:f.headersA})).length,1);
 let renamed=false;
 try{
  owned.psql('ALTER TABLE public.ticket_messages RENAME TO n6_owned_ticket_messages_unavailable;');renamed=true;
  const response=await f.gateway.request(`${ROOT}/${id}/messages`,{headers:f.headersA});assert.equal(response.status,500);assert.equal(response.json?.success,false);assert.doesNotMatch(response.text,/Synthetic recoverable reply|n6_owned_ticket_messages_unavailable/);
 }finally{if(renamed)owned.psql('ALTER TABLE public.n6_owned_ticket_messages_unavailable RENAME TO ticket_messages;');}
 assert.equal(owned.psql("SELECT relacl::text FROM pg_class WHERE oid='public.ticket_messages'::regclass;"),acl);
 assert.equal(records(await f.gateway.request(`${ROOT}/${id}/messages`,{headers:f.headersA}))[0].body,'Synthetic recoverable reply');
});
