// Isolated local read-projection prototype; current application source remains103.
import assert from 'node:assert/strict';
import test,{before,after}from'node:test';
import {readFileSync}from'node:fs';
import {closePooledSqlClients}from'@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders}from '../../../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy}from '../../../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant}from '../../../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned=requireOwnedDatabase(),site=newSyntheticTenant('avail-prototype'),other=newSyntheticTenant('availability-foreign');
const actor=crypto.randomUUID(),email=`syn-availability-${actor}@example.invalid`;let gateway:Gateway,proxy:OwnedPooledSqlProxy,product:string;
before(async()=>{
 for(const t of[site,other])seedSyntheticTenant(owned.psql,t);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true);UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}';`);
 proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
 const key=crypto.randomUUID(),r=await gateway.request('/v1/products',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'X-Store-ID':site.siteId,'X-Idempotency-Key':key},body:JSON.stringify({store_id:site.siteId,name:'Synthetic variant availability',price:125,stock:0,images:[],product_options:[{name:'Code',position:0,values:['M','L']}],variants:[{title:'M',stock:3,options:{Code:'M'}},{title:'L',stock:4,options:{Code:'L'}}]})});assert.equal(r.status,201,r.text);product=r.json!.data.id;
 owned.psql(readFileSync(new URL('./catalog-availability-read-candidate.sql',import.meta.url),'utf8'));
});
after(async()=>{await gateway?.settle();await closePooledSqlClients();await proxy?.stop();});
async function read(params:Record<string,string>={}){const q=new URLSearchParams({select:'id,stock,catalog_available_quantity',store_id:'eq.'+site.siteId,id:'eq.'+product,...params});const env=owned.restEnv();return fetch(owned.restUrl+'/rest/v1/products?'+q,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}});}
test('computed field uses actual variant inventory while preserving base stock and works in PostgREST predicates/order',async()=>{
 let r=await read();for(let i=0;!r.ok&&i<30;i++){await new Promise(r=>setTimeout(r,100));r=await read();}assert.equal(r.status,200,await r.clone().text());assert.deepEqual(await r.json(),[{id:product,stock:0,catalog_available_quantity:7}]);
 for(const filter of['eq.7','gt.0']){const r=await read({catalog_available_quantity:filter,order:'catalog_available_quantity.desc,id.asc'});assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).length,1);}
 const none=await read({catalog_available_quantity:'lte.0'});assert.equal(none.status,200);assert.deepEqual(await none.json(),[]);
});
test('invoker function obeys positive/wrong/unset RLS context and has no public/buyer execute grant',()=>{
 const composite=`jsonb_populate_record(NULL::public.products,'{"id":"${product}","store_id":"${site.siteId}"}'::jsonb)`;
 for(const [context,expected]of[[site.siteId,'7'],[other.siteId,'unknown'],['','unknown']]){
 owned.psql(`BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id','${context}',true);DO $check$BEGIN IF coalesce(public.catalog_available_quantity(${composite})::text,'unknown') IS DISTINCT FROM '${expected}' THEN RAISE EXCEPTION 'computed read RLS result differs';END IF;END$check$;ROLLBACK;`);
 }
 assert.equal(owned.psql(`SELECT has_function_privilege('anon','public.catalog_available_quantity(public.products)','EXECUTE')OR has_function_privilege('authenticated','public.catalog_available_quantity(public.products)','EXECUTE');`),'f');
});
test('missing authoritative inventory is unknown rather than the parent cache quantity',async()=>{
 const id=crypto.randomUUID();owned.psql(`INSERT INTO products(id,store_id,name,price,stock)VALUES('${id}','${site.siteId}','Synthetic missing level',125,99);`);const r=await read({id:'eq.'+id});assert.equal(r.status,200);assert.deepEqual(await r.json(),[{id,stock:99,catalog_available_quantity:null}]);
});
