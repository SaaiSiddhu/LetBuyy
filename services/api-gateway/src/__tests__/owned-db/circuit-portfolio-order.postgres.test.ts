// Real worker, isolated full-schema PostgreSQL and PostgREST; no hosted data.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {requireOwnedDatabase} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys} from './gateway-harness';
const owned=requireOwnedDatabase();
const forward=readFileSync(new URL('../../../../../database/supabase/migrations/397_circuit_portfolio_order.sql',import.meta.url),'utf8');
const rollback=readFileSync(new URL('../../../../../database/supabase/rollback/397_circuit_portfolio_order.rollback.sql',import.meta.url),'utf8');
test('Circuit portfolio order survives popularity differences and idempotent apply; rollback restores ranks without touching tenant or package data',async()=>{
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
 const conserved=()=>owned.psql(`SELECT md5(jsonb_build_object('sites',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY id),'[]') FROM sites s),'versions',(SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY id),'[]') FROM theme_package_versions v),'catalog',(SELECT jsonb_agg(to_jsonb(t)-'sort_order'-'updated_at'-'config'||jsonb_build_object('config',coalesce(t.config,'{}')-'circuitPortfolioOrder397') ORDER BY id) FROM themes t))::text);`);
 // Install counts are deliberately different; the portfolio must not falsify popularity.
 owned.psql(`UPDATE themes SET install_count=CASE slug WHEN 'letbuyy-sense' THEN 7 ELSE 2 END WHERE slug IN ('letbuyy-forge','letbuyy-sense');`);
 const before=conserved();
 const read=async(sort:string)=>{const response=await gateway.request('/v1/themes?sort='+sort+'&limit=50');assert.equal(response.status,200,response.text);return response.json!.data as Array<{slug:string;install_count:number}>;};
 try {
  owned.script(rollback);
  assert.equal((await read('portfolio'))[0].slug,'letbuyy-sense','negative control reproduces the historical rank0 before Circuit100');
  const previous=owned.psql(`SELECT jsonb_agg(jsonb_build_array(slug,sort_order) ORDER BY slug) FROM themes WHERE slug IN ('letbuyy-forge','letbuyy-sense');`);
  owned.script(forward);owned.script(forward);
  const catalog=await read('portfolio');assert.equal(catalog.length,10);assert.equal(catalog[0].slug,'letbuyy-forge');
  assert.equal((await read('popular'))[0].slug,'letbuyy-sense','real popularity is preserved');
  assert.equal(conserved(),before,'tenant data, immutable packages and all other catalog fields are conserved');
  owned.script(rollback);
  assert.equal(owned.psql(`SELECT jsonb_agg(jsonb_build_array(slug,sort_order) ORDER BY slug) FROM themes WHERE slug IN ('letbuyy-forge','letbuyy-sense');`),previous);
  assert.equal(conserved(),before);owned.script(rollback);assert.equal(conserved(),before,'rollback is repeatable');
  owned.script(forward);assert.equal((await read('portfolio'))[0].slug,'letbuyy-forge');
 } finally {await gateway.settle();}
});
