import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
const forward=readFileSync('database/supabase/migrations/337_unique_order_references.sql','utf8');
const rollback=readFileSync('database/supabase/rollback/337_unique_order_references.rollback.sql','utf8');
const guard=rollback.match(/DO \$guard\$[\s\S]*?END \$guard\$;/)![0];
const snapshot=()=>owned.psql(`SELECT md5(p.prosrc||p.proconfig::text||coalesce(p.proacl::text,''))FROM pg_proc p WHERE p.oid='public.generate_order_number()'::regprocedure;`);
test('an unallocated337 can roll back and reapply while changed trigger ABI is refused',()=>{
 const before=snapshot();assert.match(owned.psqlExpectError(`BEGIN;CREATE FUNCTION generate_order_number(text)RETURNS integer LANGUAGE sql AS $$SELECT 1$$;${guard}`),/rollback337 refuses changed reference trigger ABI/);
 assert.equal(snapshot(),before);owned.script(rollback);assert.equal(owned.psql(`SELECT to_regclass('public.order_reference_number_v1')IS NULL;`),'t');owned.script(forward);assert.equal(snapshot(),before);
});
test('initial allocation advances past restored numeric history without changing existing references',()=>{
 owned.script(rollback);const f=newSyntheticTenant('ref-history');seedSyntheticTenant(owned.psql,f);const id=crypto.randomUUID();
 owned.psql(`INSERT INTO orders(id,store_id,site_id,order_number,customer_email,shipping_address,items,subtotal,total)VALUES('${id}','${f.siteId}','${f.siteId}','SYN-${id}','syn-history@example.invalid','{}','[]',1,1);
 UPDATE orders SET order_number='ORD-20000101-90000'WHERE id='${id}';`);
 owned.script(forward);const next=crypto.randomUUID();const ref=owned.psql(`INSERT INTO orders(id,store_id,site_id,order_number,customer_email,shipping_address,items,subtotal,total)VALUES('${next}','${f.siteId}','${f.siteId}','SYN-${next}','syn-history-next@example.invalid','{}','[]',1,1)RETURNING order_number;`);
 assert.match(ref,/ORD-[0-9]{8}-90001/);assert.equal(owned.psql(`SELECT order_number FROM orders WHERE id='${id}';`),'ORD-20000101-90000');
 assert.match(owned.psqlExpectError(rollback),/rollback337 refuses allocated order references/);assert.equal(owned.psql(`SELECT order_number FROM orders WHERE id='${next}';`),ref.split('\n')[0]);
});
