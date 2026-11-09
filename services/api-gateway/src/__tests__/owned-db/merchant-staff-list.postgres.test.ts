import assert from 'node:assert/strict';
import test from 'node:test';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
const owned=requireOwnedDatabase();let sequence=0;
async function fixture(count=3) {
 const tenant=newSyntheticTenant('staff-list-'+(++sequence));seedSyntheticTenant(owned.psql,tenant);
 const owner=crypto.randomUUID(),email=`syn-list-owner-${owner}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true);
 UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';
 INSERT INTO employees(id,store_id,email,role,status,is_active,created_at)
 SELECT gen_random_uuid(),'${tenant.siteId}','syn-roster-'||n||'-${tenant.siteId}@example.invalid','viewer','invited',false,'2026-11-01T00:00:00Z'
 FROM generate_series(1,${count})n;`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
 const get=async(query='',actor=owner,actorEmail=email,bound?:string)=>gateway.request('/v1/employees?store_id='+tenant.siteId+query,{headers:await signedIdentityHeaders(actor,actorEmail,bound)});
 const ids=()=>owned.psql(`SELECT string_agg(id::text,',' ORDER BY created_at DESC,id DESC) FROM employees WHERE store_id='${tenant.siteId}'`).split(',').filter(Boolean);
 return {tenant,owner,email,gateway,get,ids};
}
test('positive owner roster excludes foreign/removed rows; foreign and bound credentials cannot borrow ownership',async()=>{
 const j=await fixture(),foreign=await fixture(2);const before=await j.get();assert.equal(before.status,200,before.text);assert.equal(before.json?.data.length,3);
 assert.deepEqual(new Set(before.json?.data.map((r:{id:string})=>r.id)),new Set(j.ids()));
 assert.equal((await j.get('',foreign.owner,foreign.email)).status,403);
 assert.equal((await j.get('',j.owner,j.email,foreign.tenant.siteId)).status,403);
 owned.psql(`UPDATE employees SET deleted_at=now() WHERE id='${j.ids()[0]}'`);
 const after=await j.get();assert.equal(after.status,200);assert.equal(after.json?.data.length,2);
});
test('explicit pages are bounded with exact metadata and stable UUID tie ordering',async()=>{
 const j=await fixture(3),ids=j.ids();
 const first=await j.get('&page=1&limit=2');assert.equal(first.status,200,first.text);assert.equal(first.json?.data.length,2);
 assert.deepEqual(first.json?.data.map((r:{id:string})=>r.id),ids.slice(0,2));
 assert.deepEqual(first.json?.meta,{page:1,per_page:2,total:3,total_pages:2,has_prev:false,has_next:true});
 const second=await j.get('&page=2&limit=2');assert.equal(second.status,200);assert.deepEqual(second.json?.data.map((r:{id:string})=>r.id),ids.slice(2));
 assert.deepEqual(second.json?.meta,{page:2,per_page:2,total:3,total_pages:2,has_prev:true,has_next:false});
});
test('default roster page never returns more than50rows',async()=>{
 const j=await fixture(53),r=await j.get();assert.equal(r.status,200,r.text);assert.equal(r.json?.data.length,50);assert.equal(r.json?.meta.total,53);
});
test('empty and beyond-end pages remain successful only with exact truthful totals',async()=>{
 for(const count of [0,3]){
 const j=await fixture(count),r=await j.get('&page=4&limit=2');assert.equal(r.status,200,r.text);assert.deepEqual(r.json?.data,[]);
 assert.deepEqual(r.json?.meta,{page:4,per_page:2,total:count,total_pages:Math.ceil(count/2),has_prev:true,has_next:false});}
});
test('malformed or excessive pagination and invalid store identifiers fail validation',async()=>{
 const j=await fixture();assert.equal((await j.get()).status,200);
 for(const q of ['&page=0','&page=NaN','&page=1.5','&page=10001','&limit=0','&limit=51','&limit=Infinity'])assert.equal((await j.get(q)).status,400,q);
 const r=await j.gateway.request('/v1/employees?store_id=invalid',{headers:await signedIdentityHeaders(j.owner,j.email)});assert.equal(r.status,400,r.text);
});
for(const column of ['store_id','deleted_at','other'])test('unavailable '+column+' schema returns sanitized unavailable, never empty success or a weaker retry',async()=>{
 const j=await fixture();assert.equal((await j.get()).status,200);
 const message=column==='other'?'synthetic private SQL detail':'column employees.'+column+' does not exist';let attempts=0;
 const tap=tapRest(owned.restUrl,async(call,forward)=>{
 if(call.resource==='employees'&&call.method==='GET'){attempts++;return new Response(JSON.stringify({code:'42703',message,details:'synthetic-private-detail'}),{status:400,headers:{'Content-Type':'application/json'}});}
 return forward();});
 try{const r=await j.get();assert.equal(r.status,503,r.text);assert.equal(r.json?.error.code,'STAFF_STATE_UNAVAILABLE');assert.doesNotMatch(r.text,/employees\.|synthetic.private|does not exist/);assert.equal(attempts,1);}
 finally{tap.restore();}
});
test('count acknowledgement failure cannot publish a fabricated complete roster',async()=>{
 const j=await fixture();assert.equal((await j.get()).status,200);
 const tap=tapRest(owned.restUrl,async(call,forward)=>{const r=await forward();if(call.resource!=='employees'||call.method!=='GET')return r;const headers=new Headers(r.headers);headers.delete('content-range');return new Response(await r.text(),{status:r.status,headers});});
 try{const r=await j.get();assert.equal(r.status,503,r.text);assert.equal(r.json?.error.code,'STAFF_STATE_UNAVAILABLE');}finally{tap.restore();}
});

test('beyond-end count outage cannot become empty success',async()=>{
 const j=await fixture();assert.equal((await j.get()).status,200);
 const tap=tapRest(owned.restUrl,async(call,forward)=>{
  const r=await forward();if(call.resource!=='employees'||call.method!=='HEAD')return r;
  const headers=new Headers(r.headers);headers.delete('content-range');return new Response(null,{status:r.status,headers});
 });
 try{const r=await j.get('&page=4&limit=2');assert.equal(r.status,503,r.text);assert.equal(r.json?.error.code,'STAFF_STATE_UNAVAILABLE');}finally{tap.restore();}
});

test('unscoped owner roster includes staff behind the second owned-site page without reading foreign sites',async()=>{
 const j=await fixture(),other=await fixture();
 owned.psql(`INSERT INTO sites(id,custom_user_id,name,store_name,subdomain,site_type)
 SELECT gen_random_uuid(),'${j.owner}','Synthetic owned '||n,'Synthetic owned '||n,'syn-owned-'||n||'-${j.owner}','store' FROM generate_series(1,51)n;`);
 const last=owned.psql(`SELECT id FROM sites WHERE custom_user_id='${j.owner}' ORDER BY id DESC LIMIT 1`),member=crypto.randomUUID();
 owned.psql(`INSERT INTO employees(id,store_id,email,role,status,is_active) VALUES('${member}','${last}','syn-tail-${member}@example.invalid','viewer','invited',false)`);
 const tap=tapRest(owned.restUrl,async(_call,forward)=>forward());
 try{
 const r=await j.gateway.request('/v1/employees',{headers:await signedIdentityHeaders(j.owner,j.email)});assert.equal(r.status,200,r.text);assert.equal(r.json?.meta.total,4);assert.equal(r.json?.data.length,4);assert(r.json?.data.some((row:{id:string})=>row.id===member));assert(r.json?.data.every((row:{store_id:string})=>row.store_id!==other.tenant.siteId));
 const pages=tap.calls.filter(c=>c.resource==='sites'&&c.search.get('select')==='id'&&c.search.get('or')?.includes(j.owner));assert.deepEqual(pages.map(c=>[c.search.get('offset'),c.search.get('limit')]),[['0','50'],['50','50']]);
 }finally{tap.restore();}
});
