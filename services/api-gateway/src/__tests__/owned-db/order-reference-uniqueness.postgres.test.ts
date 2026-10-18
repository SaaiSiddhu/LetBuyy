// Actual existing orders trigger. Seeding PostgreSQL's PRNG makes the old
// four-digit collision deterministic; no trigger/function is mocked or disabled.
import assert from 'node:assert/strict';
import test from 'node:test';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
function fixture(){const f=newSyntheticTenant('ord-ref-'+crypto.randomUUID().slice(0,8));seedSyntheticTenant(owned.psql,f);return f;}
function insertion(site:string,id=crypto.randomUUID()){
 return `INSERT INTO orders(id,store_id,site_id,order_number,customer_email,shipping_address,items,subtotal,total)VALUES('${id}','${site}','${site}','SYN-${id}','syn-order-${id}@example.invalid','{}','[]',1,1)RETURNING order_number;`;
}
test('two real order inserts succeed even when the PostgreSQL random stream repeats',()=>{
 const f=fixture();assert.doesNotThrow(()=>owned.psql(`SELECT setseed(0.25);${insertion(f.siteId)}SELECT setseed(0.25);${insertion(f.siteId)}`));
 assert.equal(owned.psql(`SELECT count(*)||'|'||count(DISTINCT order_number)FROM orders WHERE store_id='${f.siteId}';`),'2|2');
});

test('concurrent inserts across tenants reserve globally unique references',async()=>{
 const a=fixture(),b=fixture();const refs=await Promise.all(Array.from({length:24},(_,i)=>owned.psqlAsync(insertion(i%2?a.siteId:b.siteId))));
 const numbers=refs.flatMap(s=>s.split('\n').filter(x=>/^ORD-[0-9]{8}-[0-9]+$/.test(x)));assert.equal(numbers.length,24);assert.equal(new Set(numbers).size,24);
 for(const ref of numbers)assert.match(ref,/^ORD-[0-9]{8}-[0-9]{5,}$/);
});
test('rolled-back order transactions do not recycle reserved references',()=>{
 const f=fixture(),aborted=owned.psql('BEGIN;'+insertion(f.siteId)+'ROLLBACK;').match(/ORD-[0-9]{8}-[0-9]+/)![0];
 const next=owned.psql(insertion(f.siteId)).match(/ORD-[0-9]{8}-[0-9]+/)![0];assert.notEqual(next,aborted);assert.ok(BigInt(next.split('-').at(-1)!)>BigInt(aborted.split('-').at(-1)!));
 assert.equal(owned.psql(`SELECT count(*)FROM orders WHERE store_id='${f.siteId}';`),'1');
});
test('ordinary roles cannot rewind the sequence and public roles cannot consume it',()=>{
 for(const role of ['app_tenant','service_role'])assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT setval('public.order_reference_number_v1',10000,false);`),/permission denied for sequence/);
 for(const role of ['anon','authenticated'])assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT nextval('public.order_reference_number_v1');`),/permission denied for sequence/);
 const f=fixture();const ref=owned.psql('SET ROLE service_role;'+insertion(f.siteId));assert.match(ref,/ORD-[0-9]{8}-[0-9]{5,}/);
});
test('bigint exhaustion fails instead of wrapping or truncating a reference',()=>{
 const f=fixture();owned.psql(`SELECT setval('public.order_reference_number_v1',9223372036854775807,false);`);
 assert.match(owned.psql(insertion(f.siteId)),/ORD-[0-9]{8}-9223372036854775807/);
 assert.match(owned.psqlExpectError(insertion(f.siteId)),/reached maximum value of sequence/);
 assert.equal(owned.psql(`SELECT count(*)FROM orders WHERE store_id='${f.siteId}';`),'1');
});
