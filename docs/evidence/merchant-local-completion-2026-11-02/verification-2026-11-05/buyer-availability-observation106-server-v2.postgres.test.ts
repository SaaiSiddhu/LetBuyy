// Observation only: prove the current published API/model/Liquid availability mismatch.
import assert from 'node:assert/strict';
import test from 'node:test';
import {writeFileSync}from'node:fs';
import {closePooledSqlClients}from'@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders}from '../../../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy}from '../../../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant}from '../../../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {mapStorefrontProduct}from '../../../../apps/commerce/web/src/lib/product-service';
import {productToLiquidDrop}from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
const owned=requireOwnedDatabase();
test('record actual published API to canonical buyer model and Liquid availability',async()=>{
 const tenant=newSyntheticTenant('buyer-stock'),actor=crypto.randomUUID(),email=`syn-buyer-stock-${actor}@example.invalid`;seedSyntheticTenant(owned.psql,tenant);owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true);UPDATE sites SET custom_user_id='${actor}'WHERE id='${tenant.siteId}';`);
 const proxy=await startOwnedPooledSqlProxy(owned);const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
 try{
  const r=await gateway.request('/v1/products',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,tenant.siteId),'X-Store-ID':tenant.siteId,'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({store_id:tenant.siteId,name:'Synthetic published availability',price:125,stock:0,is_active:true,status:'active',images:[],product_options:[{name:'Code',position:0,values:['M','L']}],variants:[{title:'M',stock:3,options:{Code:'M'}},{title:'L',stock:4,options:{Code:'L'}}]})});assert.equal(r.status,201,r.text);
  const product=r.json!.data.id;const read=await gateway.request('/v1/storefront/'+tenant.subdomain+'/products/'+product);assert.equal(read.status,200,read.text);const raw=read.json!.data;assert.equal(raw.id,product);
  const model=mapStorefrontProduct(raw),drop=productToLiquidDrop(model);assert.ok(drop);
  const actual=Number(owned.psql(`SELECT catalog_available_quantity(p)FROM products p WHERE id='${product}'`));assert.equal(actual,7);assert.equal(raw.stock,0);assert.equal(model.stock,0);assert.equal(drop.available,false);
  const observation={run_id:owned.runId,scope:'Real published Gateway/owned PostgreSQL to existing exported buyer mapper/Liquid drop; observation is a defect reproduction, not an acceptance pass',expected_available_quantity:actual,public_base_stock:raw.stock,public_projection_quantity:raw.catalog_available_quantity??null,model_stock:model.stock,liquid_available:drop.available,live_variant_quantities:model.variants?.map(v=>v.stock),status:'CONFIRMED_BUYER_AVAILABILITY_MISMATCH'};
  writeFileSync('docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05/buyer-availability-observation106.json',JSON.stringify(observation,null,2)+'\n',{flag:'wx',mode:0o600});
 }finally{await gateway.settle();await closePooledSqlClients();await proxy.stop();}
});
