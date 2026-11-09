import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync}from 'node:fs';
import {requireOwnedDatabase}from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant}from './synthetic-tenant';
const owned=requireOwnedDatabase(),site=newSyntheticTenant('category-backfill');
const source=(dir:string,name:string)=>readFileSync(new URL(`../../../../../database/supabase/${dir}/${name}`,import.meta.url),'utf8');
test('migration433 preserves each retained exact product label and every original product byte',()=>{
 owned.script(source('rollback','433_product_category_commands.rollback.sql'));
 seedSyntheticTenant(owned.psql,site);
 const labels=[' Synthetic retained cotton ','Synthetic %_ label','தமிழ் வகை','Synthetic %_ label'];
 for(const label of labels){const id=crypto.randomUUID();owned.psql(`INSERT INTO products(id,store_id,name,price,category,is_active)VALUES('${id}','${site.siteId}','Synthetic retained category product',10,'${label}',true);`);}
 const snapshot=()=>owned.psql(`SELECT jsonb_agg(to_jsonb(p)ORDER BY p.id)::text FROM products p WHERE store_id='${site.siteId}'`),before=snapshot();
 owned.script(source('migrations','433_product_category_commands.sql'));
 assert.equal(snapshot(),before,'Backfill never rewrites retained product fields or timestamps.');
 const categories=JSON.parse(owned.psql(`SELECT jsonb_agg(jsonb_build_object('name',name,'slug',slug)ORDER BY name)FROM product_categories WHERE store_id='${site.siteId}'AND deleted_at IS NULL`))as Array<{name:string;slug:string}>;
 assert.deepEqual(categories.map(c=>c.name).sort(),[...new Set(labels)].sort());assert.equal(new Set(categories.map(c=>c.slug)).size,3);
 for(const category of categories)assert.match(category.slug,/^[a-z0-9]+(-[a-z0-9]+)*$/);
 assert.match(owned.psqlScriptExpectError(source('rollback','433_product_category_commands.rollback.sql')),/rollback433 refuses retained category history/);
 assert.equal(snapshot(),before);
});
