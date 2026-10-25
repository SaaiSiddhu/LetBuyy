// Synthetic owned settings and buyer checkout; no external provider transaction.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,tapRest} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
let fixtureIndex=0;
async function fixture(t:{after(fn:()=>Promise<void>):void}){
 const ordinal=++fixtureIndex;
 const sites=[newSyntheticTenant('w2-ship-'+ordinal+'-a'),newSyntheticTenant('w2-ship-'+ordinal+'-b')],actors=[randomUUID(),randomUUID()];
 for(let i=0;i<2;i++){seedSyntheticTenant(owned.psql,sites[i],{gst:true});owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actors[i]}','syn-config-${actors[i]}@example.invalid',true);UPDATE sites SET custom_user_id='${actors[i]}',tax_inclusive=false WHERE id='${sites[i].siteId}';`);}
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));t.after(()=>gateway.settle());
 const request=async(path:string,method='GET',body?:unknown,actor=0,bound=true,key=randomUUID())=>gateway.request('/v1/shipping-tax'+path,{method,headers:{...await signedIdentityHeaders(actors[actor],`syn-config-${actors[actor]}@example.invalid`,bound?sites[actor].siteId:undefined),...(!bound?{'X-Store-ID':sites[actor].siteId}:{}),'Idempotency-Key':key},...(body?{body:JSON.stringify(body)}:{})});
 const seedRate=(index=0)=>{const zone=randomUUID(),rate=randomUUID(),site=sites[index].siteId;owned.psql(`INSERT INTO shipping_zones(id,store_id,site_id,name,countries,states,zip_codes,cod_enabled)VALUES('${zone}','${site}','${site}','Synthetic zone',ARRAY['IN'],ARRAY['Karnataka','29'],ARRAY['560001'],true);INSERT INTO shipping_rates(id,zone_id,site_id,name,type,price,is_active,cod_enabled)VALUES('${rate}','${zone}','${site}','Synthetic delivery','flat',20,true,true);`);return{zone,rate};};
 return{sites,actors,gateway,request,seedRate};
}
test('saved shipping rates reload through the mounted scoped list without other-store data',async t=>{
 const f=await fixture(t),a=f.seedRate(),b=f.seedRate(1);
 const read=await f.request('/shipping?store_id='+f.sites[0].siteId);assert.equal(read.status,200,read.text);assert.deepEqual(read.json!.data.map((r:any)=>r.id),[a.rate]);assert.ok(!read.text.includes(b.rate));
 assert.equal((await f.request('/shipping?store_id='+f.sites[0].siteId,'GET',undefined,1)).status,403);
});
test('zone/rate CRUD preserves postal, weight and zero-day settings and refuses foreign edits',async t=>{
 const f=await fixture(t);
 const z=await f.request('/shipping/zones','POST',{store_id:f.sites[0].siteId,name:'Configured zone',countries:['IN'],states:['Karnataka','29'],zip_codes:['560001']});assert.equal(z.status,201,z.text);const zone=z.json!.data.id;assert.deepEqual(z.json!.data.zip_codes,['560001']);
 const r=await f.request('/shipping','POST',{zone_id:zone,name:'Configured rate',type:'weight_based',price:30,min_weight_grams:100,max_weight_grams:1000,estimated_days_min:0,estimated_days_max:1});assert.equal(r.status,201,r.text);const rate=r.json!.data.id;assert.equal(r.json!.data.min_weight_grams,100);assert.equal(r.json!.data.max_weight_grams,1000);assert.equal(r.json!.data.estimated_days_min,0);
 const ez=await f.request('/shipping/zones/'+zone,'PATCH',{name:'Edited zone',zip_codes:['560001','560002']},0,false);assert.equal(ez.status,200,ez.text);assert.deepEqual(ez.json!.data.zip_codes,['560001','560002']);
 const er=await f.request('/shipping/'+rate,'PATCH',{price:35},0,false);assert.equal(er.status,200,er.text);
 assert.equal((await f.request('/shipping/'+rate,'PATCH',{price:1},1,false)).status,403);assert.equal(owned.psql(`SELECT price::text FROM shipping_rates WHERE id='${rate}';`),'35.00');
 assert.equal((await f.request('/shipping/'+rate,'PATCH',{price:-1})).status,400);
 assert.equal((await f.request('/shipping/'+rate,'DELETE',undefined,1)).status,403);
 assert.equal((await f.request('/shipping/'+rate,'DELETE',undefined,0,false)).status,200);assert.equal((await f.request('/shipping/zones/'+zone,'DELETE',undefined,0,false)).status,200);
});
test('country/state tax settings round-trip and reject foreign and stale owner authority',async t=>{
 const f=await fixture(t);const made=await f.request('/taxes','POST',{store_id:f.sites[0].siteId,name:'Synthetic country rate',rate:18,country:'IN'});assert.equal(made.status,201,made.text);const id=made.json!.data.id;assert.equal(made.json!.data.state,null);
 assert.equal((await f.request('/taxes','POST',{store_id:f.sites[0].siteId,name:'Invalid null create',rate:18,country:'IN',state:null})).status,400);
 const state=await f.request('/taxes/'+id,'PATCH',{state:'29'},0,false);assert.equal(state.status,200,state.text);assert.equal(state.json!.data.state,'29');
 const cleared=await f.request('/taxes/'+id,'PATCH',{state:null},0,false);assert.equal(cleared.status,200,cleared.text);assert.equal(cleared.json!.data.state,null);
 assert.equal((await f.request('/taxes/'+id,'PATCH',{rate:-1})).status,400);assert.equal((await f.request('/taxes/'+id,'DELETE',undefined,1,false)).status,403);
 owned.psql(`UPDATE sites SET custom_user_id='${f.actors[1]}' WHERE id='${f.sites[0].siteId}';`);try{assert.equal((await f.request('/taxes/'+id,'PATCH',{rate:1})).status,403);}finally{owned.psql(`UPDATE sites SET custom_user_id='${f.actors[0]}' WHERE id='${f.sites[0].siteId}';`);}
 assert.equal(Number(owned.psql(`SELECT rate FROM tax_rates WHERE id='${id}';`)),0.18);assert.equal((await f.request('/taxes/'+id,'DELETE',undefined,0,false)).status,200);
});
test('configured merchant shipping and tax reach canonical COD totals with one order per intent',async t=>{
 const f=await fixture(t),site=f.sites[0];
 const z=await f.request('/shipping/zones','POST',{store_id:site.siteId,name:'Checkout zone',countries:['IN'],states:['Karnataka','29'],zip_codes:['560001']});assert.equal(z.status,201,z.text);
 const r=await f.request('/shipping','POST',{zone_id:z.json!.data.id,name:'Checkout delivery',type:'flat',price:20});assert.equal(r.status,201,r.text);const rate=r.json!.data.id;
 const tax=await f.request('/taxes','POST',{store_id:site.siteId,name:'Synthetic configured tax',rate:18,country:'IN',is_shipping:false});assert.equal(tax.status,201,tax.text);
 const product=randomUUID();owned.psql(`INSERT INTO products(id,store_id,site_id,name,price,stock,sku,is_active,status)VALUES('${product}','${site.siteId}','${site.siteId}','Synthetic configured product',199,25,'SYN-${product}',true,'active');INSERT INTO inventory_levels(id,store_id,product_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity)VALUES(gen_random_uuid(),'${site.siteId}','${product}','${site.locationId}',25,0,0,25,0,25);`);
 const quote=await f.gateway.request(`/v1/storefront/${site.subdomain}/shipping-rates?pincode=560001&state=Karnataka&state_code=29&subtotal_minor=19900`);assert.equal(quote.status,200,quote.text);assert.equal(quote.json!.data.rates[0].id,rate);assert.equal(quote.json!.data.rates[0].amount_minor,2000);assert.equal(quote.json!.data.serviceability.carrier_confirmed,false);
 const outside=await f.gateway.request(`/v1/storefront/${site.subdomain}/shipping-rates?pincode=600001&state=Karnataka&state_code=29&subtotal_minor=19900`);assert.equal(outside.status,200,outside.text);assert.deepEqual(outside.json!.data.rates,[]);
 const key=randomUUID();const body={customer:{name:'Synthetic buyer',email:`syn-w2-${key}@example.invalid`,phone:'9000000088',address:{address:'Fixture Road',city:'Bengaluru',state:'Karnataka',stateCode:'29',pincode:'560001'}},items:[{productId:product,variantId:null,quantity:1}],shippingRateId:rate,shippingAmountMinor:2000,paymentMethod:'cod',deliveryOption:'standard',idempotencyKey:key};
 const create=()=>f.gateway.request(`/v1/storefront/${site.subdomain}/orders`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});
 const order=await create();assert.equal(order.status,201,order.text);const id=order.json!.data.order.id;assert.equal((await create()).json!.data.order.id,id);
 assert.equal(owned.psql(`SELECT (subtotal*100)::bigint||'|'||(shipping_cost*100)::bigint||'|'||(tax*100)::bigint||'|'||(total*100)::bigint FROM orders WHERE id='${id}';`),'19900|2000|3582|25482');assert.equal(owned.psql(`SELECT count(*) FROM orders WHERE customer_email='${body.customer.email}';`),'1');
 console.log('W2_CONFIG_CHECKOUT_PASS',JSON.stringify({merchantConfiguration:true,destinationFence:true,subtotalMinor:19900,shippingMinor:2000,taxMinor:3582,totalMinor:25482,orderReplaySame:true,providerPayment:false}));
});

test('revoked owner cannot replay a saved settings response through the HTTP idempotency receipt', async t => {
 const f=await fixture(t), key=randomUUID(), body={store_id:f.sites[0].siteId,name:'Synthetic replay tax',rate:18,country:'IN'};
 const created=await f.request('/taxes','POST',body,0,true,key); assert.equal(created.status,201,created.text);
 owned.psql(`UPDATE sites SET custom_user_id='${f.actors[1]}' WHERE id='${f.sites[0].siteId}';`);
 const replay=await f.request('/taxes','POST',body,0,true,key); assert.equal(replay.status,403,replay.text);
 assert.equal(owned.psql(`SELECT count(*) FROM tax_rates WHERE store_id='${f.sites[0].siteId}' AND name='Synthetic replay tax';`),'1');
});
test('missing settings schema is unavailable rather than empty and the same read recovers', async t => {
 const f=await fixture(t); f.seedRate(); let missing=true;
 const tap=tapRest(owned.restUrl,async(call,forward)=>missing&&['shipping_rates','tax_rates'].includes(call.resource)&&call.method==='GET'
  ?new Response(JSON.stringify({code:'PGRST205',message:`Could not find ${call.resource} in the schema cache`}),{status:404,headers:{'content-type':'application/json'}}):forward());
 try {
  for(const path of ['/shipping','/taxes'])assert.equal((await f.request(path+'?store_id='+f.sites[0].siteId)).status,503);
  missing=false;const recovered=await f.request('/shipping?store_id='+f.sites[0].siteId);assert.equal(recovered.status,200,recovered.text);assert.equal(recovered.json!.data.length,1);
 } finally {tap.restore();}
});
