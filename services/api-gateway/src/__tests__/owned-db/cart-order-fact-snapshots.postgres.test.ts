//388: real Worker/cart/product writer and canonical order RPC on positively owned disposable PostgreSQL.
import assert from 'node:assert/strict';
import test, { before, after, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { personalizationReviewFingerprint, readProductFactSnapshot, type ProductFactSnapshot, type PersonalizationCartDraft } from '@letbuyy/commerce-core';
import { loadCartFactSources } from '../../lib/cart-product-facts';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { canonicalCheckoutCartBinding } from '@letbuyy/checkout-core';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, type SyntheticTenant } from './synthetic-tenant';

const owned=requireOwnedDatabase(),{psql,psqlExpectError}=owned;
const site=newSyntheticTenant('snapshot-cart'),other=newSyntheticTenant('snapshot-other');
const actor=crypto.randomUUID(),email=`syn-snapshot-${actor}@example.invalid`;
let gateway:Gateway,proxy:OwnedPooledSqlProxy;
const quote=(value:string)=>`'${value.replaceAll("'","''")}'`;
const json=(value:unknown)=>`${quote(JSON.stringify(value))}::jsonb`;
const facts={version:1,revision:1,methods:[{id:'engrave',label:'Front engraving',min_graphemes:1,max_graphemes:18,character_set:'unicode-letters',styles:[{id:'sans',label:'Sans'}],placements:[{id:'front',label:'Front'}]}]};
type Line={marketplace_listing_id?:string|null;id:string;product_id:string;variant_id:string|null;quantity:number;unit_price:number;line_total:number;product_version:number;configuration_fingerprint:string|null;snapshot_fingerprint:string;niche_snapshot:ProductFactSnapshot;personalization?:PersonalizationCartDraft};
type Cart={id:string;cart_token:string;store_id:string;updated_at:string;lines:Line[]};
function data<T>(response:{status:number;text:string;json:unknown}):T { const payload=response.json as {data?:T};assert.ok(payload?.data,response.text);return payload.data; }
function product(metadata:object={},stock=10,tenant:SyntheticTenant=site,images:string[]=[]){
 const id=crypto.randomUUID();psql(`INSERT INTO products(id,store_id,site_id,name,slug,price,sku,stock,is_active,status,metadata,images)
 VALUES('${id}','${tenant.siteId}','${tenant.siteId}','Synthetic snapshot product','syn-${id}',1290,'SYN-${id}',${stock},true,'active',${json(metadata)},ARRAY[${images.map(quote).join(',')}]::text[]);
 WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${tenant.siteId}',true)) SELECT public.set_inventory_level_available('${id}',NULL,'${tenant.locationId}',${stock},NULL) FROM _fixture_inventory_scope436;`);return id;
}
const version=(id:string)=>Number(psql(`SELECT version FROM products WHERE id='${id}';`));
async function draft(id:string,text='Asha',variant_id:string|null=null):Promise<PersonalizationCartDraft>{
 const response=await gateway.request(`/v1/storefront/${site.subdomain}/products/${id}/personalization-review${variant_id?`?variant_id=${variant_id}`:''}`);
 assert.equal(response.status,200,response.text);
 const context=data<{facts_revision:number;review_fingerprint:string}>(response);
 return {facts_revision:context.facts_revision,review_fingerprint:context.review_fingerprint,method_id:'engrave',style_id:'sans',placement_id:'front',text};
}
function input(id:string,personalization?:PersonalizationCartDraft,quantity=1,variant_id?:string){return {product_id:id,variant_id:variant_id??null,quantity,properties:{},...(personalization?{personalization}:{})};}
async function cart(lines:object[],existing?:Cart,tenant=site){return gateway.request(`/v1/storefront/${tenant.subdomain}/cart${existing?`/${existing.cart_token}`:''}`,{method:existing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines,coupon_codes:[],...(existing?{expected_updated_at:existing.updated_at}:{})})});}
function items(cart:Cart){return cart.lines.map(line=>({product_id:line.product_id,variant_id:line.variant_id,quantity:line.quantity,...(line.marketplace_listing_id?{marketplace_listing_id:line.marketplace_listing_id}:{}),cart_fact_ref:{cart_id:cart.id,cart_token:cart.cart_token,line_id:line.id,product_version:line.product_version,configuration_fingerprint:line.configuration_fingerprint,snapshot_fingerprint:line.snapshot_fingerprint}}));}
function orderSql(lines:unknown,key=crypto.randomUUID(),tenant=site){return `SELECT public.create_checkout_order(p_store_id=>'${tenant.siteId}'::uuid,p_customer_name=>'Synthetic snapshot buyer',p_customer_email=>'syn-snapshot@example.invalid',p_customer_phone=>'9000000099',p_shipping_address=>'{}'::jsonb,p_items=>${json(lines)},p_payment_method=>'cod',p_idempotency_key=>'${key}',p_request_id=>'snapshot-${key}') ->> 'id';`;}
async function patch(id:string,metadata:object,expected=version(id),key=crypto.randomUUID()){
 return gateway.request(`/v1/products/${id}`,{method:'PATCH',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'X-Store-ID':site.siteId,'X-Idempotency-Key':key},body:JSON.stringify({metadata,version:expected,idempotency_key:key})});
}
function effects(id:string){return psql(`SELECT jsonb_build_object('orders',(SELECT count(*) FROM order_items WHERE product_id='${id}'),'levels',(SELECT jsonb_agg(to_jsonb(il) ORDER BY id) FROM inventory_levels il WHERE product_id='${id}'),'reservations',(SELECT count(*) FROM inventory_reservations WHERE product_id='${id}'));`);}
before(async()=>{
 for(const tenant of[site,other])seedSyntheticTenant(psql,tenant);
 psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true);UPDATE sites SET custom_user_id='${actor}' WHERE id='${site.siteId}';`);
 proxy=await startOwnedPooledSqlProxy(owned);
 gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{...proxy.env(),CHECKOUT_SIGNING_SECRET:'synthetic-snapshot-fixture-secret'}));
});
afterEach(async()=>{await gateway.settle();});
after(async()=>{await closePooledSqlClients();await proxy?.stop();});

function migration(kind:'migrations'|'rollback'){return readFileSync(new URL(`../../../../../database/supabase/${kind}/388_cart_order_fact_snapshots${kind==='rollback'?'.rollback':''}.sql`,import.meta.url),'utf8');}
function privilegeProfile(){return psql(`SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'body',p.prosrc,'owner',p.proowner,'config',p.proconfig,
   'acl',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)) ORDER BY p.proname)
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN
   ('create_order_with_inventory_reservations','apply_product_edit_v1','create_checkout_order','create_checkout_order_for_buyer','create_marketplace_checkout_order','create_marketplace_checkout_order_with_delivery_rate','create_storefront_checkout_order_with_delivery_rate')),
 'carts',(SELECT jsonb_build_object('owner',c.relowner,'acl',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable) FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a)) FROM pg_class c WHERE c.oid='public.carts'::regclass),
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',col.attname,'acl',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable) FROM aclexplode(col.attacl) a)) ORDER BY col.attname) FROM pg_attribute col WHERE col.attrelid='public.carts'::regclass AND col.attnum>0 AND NOT col.attisdropped),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM pg_auth_members m),
 'effective',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'super',r.rolsuper,'inherit',r.rolinherit,'bypass',r.rolbypassrls,
   'cart_write',has_table_privilege(r.oid,'public.carts','INSERT,UPDATE,DELETE,TRUNCATE'),'column_write',has_any_column_privilege(r.oid,'public.carts','INSERT,UPDATE'),
   'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,has_function_privilege(r.oid,p.oid,'EXECUTE')) ORDER BY p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('create_order_with_inventory_reservations','create_checkout_order','create_marketplace_checkout_order'))) ORDER BY r.rolname) FROM pg_roles r));`);}
test('private cart acceptance query has a real positive tenant control before public-route denial tests',async()=>{
 const id=product({},2);const loaded=await loadCartFactSources(gateway.env,site.siteId,'synthetic-private-positive',[id]);
 assert.equal(loaded.get(id)?.id,id);assert.equal(Number(loaded.get(id)?.version),version(id));
 const foreign=await loadCartFactSources(gateway.env,other.siteId,'synthetic-private-negative',[id]);assert.equal(foreign.size,0);
});


async function archiveProduct(id:string){const key=crypto.randomUUID();const response=await gateway.request(`/v1/products/${id}`,{method:'PATCH',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'X-Store-ID':site.siteId,'X-Idempotency-Key':key},body:JSON.stringify({status:'archived',is_active:false,version:version(id),idempotency_key:key})});assert.equal(response.status,200,response.text);}

test('real read-only review producer returns only current variant-bound facts/echo and never creates a cart',async()=>{
 const id=product({personalization:facts,private_supplier_token:'NEVER_PUBLIC'},2),variant=crypto.randomUUID(),empty=crypto.randomUUID();
 psql(`INSERT INTO product_options(product_id,name,position,values) VALUES('${id}','Finish',0,'["Walnut","Oak"]');INSERT INTO product_variants(id,product_id,title,price,inventory_qty,option1) VALUES('${variant}','${id}','Walnut',1290,2,'Walnut'),('${empty}','${id}','Oak',1290,0,'Oak');WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${site.siteId}',true)) SELECT public.set_inventory_level_available('${id}','${variant}','${site.locationId}',2,NULL) FROM _fixture_inventory_scope436;WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${site.siteId}',true)) SELECT public.set_inventory_level_available('${id}','${empty}','${site.locationId}',0,NULL) FROM _fixture_inventory_scope436;`);
 const before=psql(`SELECT count(*) FROM carts WHERE store_id='${site.siteId}';`);
 const path=`/v1/storefront/${site.subdomain}/products/${id}/personalization-review`;
 const response=await gateway.request(`${path}?variant_id=${variant}`);assert.equal(response.status,200,response.text);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const context=data<{product_id:string;variant_id:string;facts:unknown;facts_revision:number;review_fingerprint:string}>(response);
 assert.deepEqual(Object.keys(context).sort(),['product_id','variant_id','facts','facts_revision','review_fingerprint'].sort());assert.equal(context.product_id,id);assert.equal(context.variant_id,variant);
 assert.equal(context.review_fingerprint,await personalizationReviewFingerprint({product_id:id,variant_id:variant,product_version:version(id),facts}));
 assert.equal(response.text.includes('NEVER_PUBLIC'),false);assert.equal(response.text.includes('product_version'),false);
 for(const [query,status]of[['',409],[`?variant_id=${empty}`,409],[`?variant_id=${crypto.randomUUID()}`,404],[`?variant_id=${variant}&variant_id=${variant}`,400],[`?variant_id=${variant}&unit_price=1`,400]] as const)assert.equal((await gateway.request(path+query)).status,status,query);
 assert.equal((await gateway.request(`/v1/storefront/${other.subdomain}/products/${id}/personalization-review?variant_id=${variant}`)).status,404);
 const edited=await patch(id,{personalization:{...facts,revision:2}});assert.equal(edited.status,200,edited.text);
 const fresh=await gateway.request(`${path}?variant_id=${variant}`);assert.equal(fresh.status,200,fresh.text);assert.notEqual(data<{review_fingerprint:string}>(fresh).review_fingerprint,context.review_fingerprint);
 assert.equal(psql(`SELECT count(*) FROM carts WHERE store_id='${site.siteId}';`),before);
});

test('canonical real cart merges only equal reviewed configurations; distinct names share one variant stock cap',async()=>{
 const id=product({personalization:facts},4),a=await draft(id),b=await draft(id,'Kabir');
 const response=await cart([input(id,a),input(id,a),input(id,b)]);assert.equal(response.status,201,response.text);
 const accepted=data<Cart>(response);assert.equal(accepted.lines.length,2);assert.deepEqual(accepted.lines.map(line=>line.quantity).sort(),[1,2]);
 assert.equal(new Set(accepted.lines.map(line=>line.id)).size,2);assert.deepEqual(accepted.lines.map(line=>line.niche_snapshot.personalization?.text).sort(),['Asha','Kabir']);
 assert.equal(JSON.stringify(accepted).includes('catalog_source'),false);assert.equal(psql(`SELECT fact_acceptance_version FROM carts WHERE id='${accepted.id}';`),'1');
 const before=psql(`SELECT items FROM carts WHERE id='${accepted.id}';`);
 const capped=await cart([input(id,a,3),input(id,b,2)],accepted);assert.equal(capped.status,409,capped.text);
 assert.equal(psql(`SELECT items FROM carts WHERE id='${accepted.id}';`),before);
 const invalid=await cart([input(id,{...a,text:'Asha ✦'})],accepted);assert.equal(invalid.status,409,invalid.text);
 assert.equal(psql(`SELECT items FROM carts WHERE id='${accepted.id}';`),before);
});

test('stale revision, removed capability, old digest and forged buyer authority cannot replace the accepted cart',async()=>{
 const id=product({personalization:facts}),a=await draft(id);const response=await cart([input(id,a)]);assert.equal(response.status,201,response.text);const accepted=data<Cart>(response);
 const before=psql(`SELECT items FROM carts WHERE id='${accepted.id}';`);
 for(const bad of[{...a,review_fingerprint:'0'.repeat(64)},{...a,facts_revision:2},{...a,accepted:true},{...a,text:'Jose\u0301'}]){
  const response=await cart([input(id,bad)],accepted);assert.ok(response.status>=400,response.text);assert.equal(psql(`SELECT items FROM carts WHERE id='${accepted.id}';`),before);
 }
 const changed=await patch(id,{personalization:{...facts,revision:2}});assert.equal(changed.status,200,changed.text);
 const stale=await cart([input(id,a)],accepted);assert.equal(stale.status,409,stale.text);assert.equal(psql(`SELECT items FROM carts WHERE id='${accepted.id}';`),before);
 const removed=await patch(id,{});assert.equal(removed.status,200,removed.text);
 assert.equal((await cart([input(id,a)],accepted)).status,409);
});

test('all raw Data API cart write grants including column writes are closed; legitimate route reaccepts every old line',async()=>{
 const id=product({personalization:facts}),a=await draft(id);const response=await cart([input(id,a)]);assert.equal(response.status,201,response.text);const accepted=data<Cart>(response);
 const before=psql(`SELECT items FROM carts WHERE id='${accepted.id}';`);
 assert.equal(psql(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND p.prosrc ~* '(INSERT[[:space:]]+INTO|UPDATE|DELETE[[:space:]]+FROM)[[:space:]]+(public[.])?carts([[:space:](]|$)' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('app_tenant',p.oid,'EXECUTE'));`),'0','old literal cart writers cannot remain callable by raw clients');
 for(const role of['anon','authenticated','app_tenant']){
  assert.match(psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT set_config('app.site_id','${site.siteId}',true);UPDATE public.carts SET items='[]'::jsonb WHERE id='${accepted.id}';COMMIT;`),/permission denied/);
  assert.equal(psql(`SELECT has_table_privilege('${role}','public.carts','INSERT,UPDATE,DELETE,TRUNCATE') OR has_any_column_privilege('${role}','public.carts','INSERT,UPDATE');`),'f');
  assert.match(psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};${orderSql(items(accepted))}COMMIT;`),/permission denied/);
 }
 assert.equal(psql(`SELECT items FROM carts WHERE id='${accepted.id}';`),before);
 // Emulate an old, caller-writable row. The new marker defaults0 and cannot be promoted by a mixed invalid draft.
 const old=crypto.randomUUID(),token=`ct_${crypto.randomUUID()}`;
 psql(`INSERT INTO carts(id,store_id,session_id,items,status) VALUES('${old}','${site.siteId}','${token}',${json([{...accepted.lines[0],niche_snapshot:{version:1,facts:{},personalization:{text:'FORGED'}}}])},'active');`);
 const restoredRead=await gateway.request('/v1/storefront/'+site.subdomain+'/cart/'+token);
 assert.equal(restoredRead.status,200,restoredRead.text);
 const existing=data<Cart>(restoredRead);
 assert.match(psqlExpectError(orderSql(items(existing))),/CART_FACT_REFERENCE_INVALID/);
 assert.equal((await cart([input(id,a),input(id,{...a,text:'✦'})],existing)).status,409);
 assert.equal(psql(`SELECT fact_acceptance_version FROM carts WHERE id='${old}';`),'0');
 const renewed=await cart([input(id,a)],existing);assert.equal(renewed.status,200,renewed.text);
 assert.equal(psql(`SELECT fact_acceptance_version FROM carts WHERE id='${old}';`),'1');
});

test('foreign tenant, token, line ID, quantity, digest and direct snapshot forgery fail without order or stock effects',async()=>{
 const id=product({personalization:facts}),response=await cart([input(id,await draft(id))]);assert.equal(response.status,201,response.text);const accepted=data<Cart>(response);
 const original=items(accepted),before=effects(id);
 const mutations=[{...original[0],niche:{version:1,facts:{}}},{...original[0],quantity:2},
  ...['cart_token','line_id','snapshot_fingerprint'].map(field=>({...original[0],cart_fact_ref:{...original[0].cart_fact_ref,[field]:'forged'}}))];
 for(const value of mutations){assert.match(psqlExpectError(orderSql([value])),/CART_FACT/);assert.equal(effects(id),before);}
 assert.match(psqlExpectError(orderSql(original,crypto.randomUUID(),other)),/product not found|CART_FACT/);assert.equal(effects(id),before);
 assert.match(psqlExpectError(orderSql([{product_id:id,quantity:1}])),/CART_FACT_REFERENCE_REQUIRED/);
 const foreign=await cart([input(id,await draft(id))],undefined,other);assert.equal(foreign.status,404,foreign.text);
});

test('same locked product/variant/options/facts observation is mandatory at order commit',async()=>{
 for(const change of['version','facts','options'] as const){
  const id=product({personalization:facts}),response=await cart([input(id,await draft(id))]);assert.equal(response.status,201,response.text);const accepted=data<Cart>(response),before=effects(id);
  if(change==='version')psql(`UPDATE products SET version=version+1 WHERE id='${id}';`);
  if(change==='facts')psql(`UPDATE products SET metadata=jsonb_set(metadata,'{personalization,methods,0,label}','"Different meaning"') WHERE id='${id}';`);
  if(change==='options')psql(`INSERT INTO product_options(product_id,name,position,values) VALUES('${id}','Added option',0,'["New"]');UPDATE products SET version=version+1 WHERE id='${id}';`);
  assert.match(psqlExpectError(orderSql(items(accepted))),/CART_FACTS_CHANGED/);assert.equal(effects(id),before);
 }
});

test('one canonical order transaction freezes exact personalization, options and saved gift image identity; retries have one effect',async()=>{
 const images=['https://example.invalid/open.webp','https://example.invalid/closed.webp'];
 const id=product({personalization:facts,gifts:{contents:[{label:'Notebook',quantity:1}],mediaRoles:{openBox:0,closedBox:1}}},6,site,images);
 const response=await cart([input(id,await draft(id,'आशा José')),input(id,await draft(id,'Kabir'))]);assert.equal(response.status,201,response.text);const accepted=data<Cart>(response),key=crypto.randomUUID(),acceptedRevision=version(id);
 const [first,second]=await Promise.all([owned.psqlAsync(orderSql(items(accepted),key)),owned.psqlAsync(orderSql(items(accepted),key))]);assert.equal(first,second);
 const saved=JSON.parse(psql(`SELECT jsonb_agg(product_snapshot ORDER BY product_snapshot->'niche'->'personalization'->>'text') FROM order_items WHERE order_id='${first}';`)) as Array<{niche:unknown;images:string[]}>;
 assert.equal(saved.length,2);assert.deepEqual(saved.map(row=>readProductFactSnapshot(row.niche)?.personalization?.text).sort(),['Kabir','आशा José'].sort());assert.deepEqual(saved[0].images,images);
 assert.equal(psql(`SELECT count(*) FROM order_items WHERE order_id='${first}';`),'2');
 assert(version(id)>acceptedRevision,'Canonical stock/cache writes still advance the catalog revision; they cannot suppress stale-editor protection');
 assert.equal(psql(`SELECT bool_and((product_snapshot->>'product_version')::bigint=${acceptedRevision})FROM order_items WHERE order_id='${first}';`),'t','Both accepted configurations retain the same pre-effect revision');
 assert.equal(psql(`SELECT available||'|'||reserved FROM inventory_levels WHERE product_id='${id}'AND variant_id IS NULL AND location_id='${site.locationId}';`),'4|0','Two distinct configurations consume exactly two of the six physical units');
 assert.equal(psql(`SELECT stock FROM products WHERE id='${id}';`),'4','The buyer-visible cache reflects final stock after both lines');
 const before=JSON.stringify(saved);psql(`UPDATE products SET metadata='{}',images=ARRAY['https://example.invalid/changed.webp'],version=version+1 WHERE id='${id}';`);
 assert.equal(psql(orderSql(items(accepted),key)),first,'receipt replay returns original even after catalog edits');
 assert.equal(JSON.stringify(JSON.parse(psql(`SELECT jsonb_agg(product_snapshot ORDER BY product_snapshot->'niche'->'personalization'->>'text') FROM order_items WHERE order_id='${first}';`))),before);
 assert.match(psqlExpectError(`UPDATE order_items SET product_snapshot='{}' WHERE order_id='${first}';`),/immutable|snapshot|locked/i);
 const leaked=psql(`SELECT coalesce(jsonb_agg(payload)::text,'') FROM outbox_events WHERE aggregate_id='${first}';`);assert.equal(leaked.includes('आशा'),false);assert.equal(leaked.includes('Kabir'),false);
});

test('revision changes are monotonic under the real parent writer, with exact retry winning over later invalid current state',async()=>{
 const id=product({personalization:facts});
 const changed={...facts,methods:[{...facts.methods[0],label:'Changed engraving'}]};
 const unchanged=await patch(id,{personalization:facts});assert.equal(unchanged.status,200,unchanged.text);
 const bad=await patch(id,{personalization:changed});assert.equal(bad.status,409,bad.text);
 const key=crypto.randomUUID(),expected=version(id),metadata={personalization:{...changed,revision:2}};
 const first=await patch(id,metadata,expected,key);assert.equal(first.status,200,first.text);
 const decrease=await patch(id,{personalization:facts});assert.equal(decrease.status,409,decrease.text);
 const later=await patch(id,{personalization:{...changed,revision:3}});assert.equal(later.status,200,later.text);
 const replay=await patch(id,metadata,expected,key);assert.equal(replay.status,200,replay.text);assert.deepEqual(data(first),data(replay));
 const current=version(id),results=await Promise.all([patch(id,{personalization:{...changed,revision:4}},current),patch(id,{personalization:{...changed,revision:5}},current)]);
 assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
});

test('configuration and full fact digests affect existing signed cart binding; quantity remains independently bound',async()=>{
 const id=product({personalization:facts}),response=await cart([input(id,await draft(id))]);assert.equal(response.status,201,response.text);const accepted=data<Cart>(response);
 const binding={siteId:site.siteId,cartId:accepted.id,cartToken:accepted.cart_token,channel:'web',expiresAt:'2030-01-01T00:00:00Z',lines:accepted.lines};
 const original=canonicalCheckoutCartBinding(binding);
 for(const changed of[{...accepted.lines[0],configuration_fingerprint:'0'.repeat(64)},{...accepted.lines[0],snapshot_fingerprint:'0'.repeat(64)},{...accepted.lines[0],quantity:2}])assert.notEqual(canonicalCheckoutCartBinding({...binding,lines:[changed]}),original);
 const empty=product({},3);psql(`INSERT INTO product_variants(id,product_id,title,price,inventory_qty) VALUES(gen_random_uuid(),'${empty}','Legacy bare SKU',1290,0);`);assert.match(psql(orderSql([{product_id:empty,quantity:1}])),/^[0-9a-f-]{36}$/,'old non-niche caller still uses canonical pricing/stock writer');
});

test('exact named beauty options with spaces and Hindi are captured from durable relational UUID, never inferred from a label',async()=>{
 const id=product({beauty:{routineStage:'colour',format:'Tint',shadeOptionName:'Shade name',shades:[{value:'Rose 02'},{value:'Amber 04'}]}}),variant=crypto.randomUUID();
 psql(`INSERT INTO product_options(product_id,name,position,values) VALUES('${id}','Shade name',0,'["Rose 02","Amber 04"]'),('${id}','पैक आकार',1,'["दो इकाइयाँ"]');
 INSERT INTO product_variants(id,product_id,title,price,inventory_qty,option1,option2,metadata) VALUES('${variant}','${id}','Uninformative title',1290,3,'Rose 02','दो इकाइयाँ','{}');
 WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${site.siteId}',true)) SELECT public.set_inventory_level_available('${id}','${variant}','${site.locationId}',3,NULL) FROM _fixture_inventory_scope436;`);
 const response=await cart([input(id,undefined,1,variant)]);assert.equal(response.status,201,response.text);const accepted=data<Cart>(response);
 assert.deepEqual(accepted.lines[0].niche_snapshot.selected_options,[{name:'Shade name',value:'Rose 02'},{name:'पैक आकार',value:'दो इकाइयाँ'}]);
 const order=psql(orderSql(items(accepted)));
 const saved=JSON.parse(psql(`SELECT product_snapshot->'niche' FROM order_items WHERE order_id='${order}';`));
 const newer=await cart([input(id,undefined,1,variant)]);assert.equal(newer.status,201,newer.text);const active=data<Cart>(newer);
 psql(`UPDATE product_variants SET option1='Amber 04' WHERE id='${variant}';UPDATE product_options SET name='Renamed' WHERE product_id='${id}' AND name='Shade name';`);
 assert.deepEqual(readProductFactSnapshot(saved)?.selected_options,[{name:'Shade name',value:'Rose 02'},{name:'पैक आकार',value:'दो इकाइयाँ'}]);
 assert.match(psqlExpectError(orderSql(items(active))),/CART_FACTS_CHANGED/);
});

test('actual hosted checkout confirmation carries only persisted cart reference and preserves private immutable snapshot',async()=>{
 const id=product({personalization:facts}),response=await cart([input(id,await draft(id))]);assert.equal(response.status,201,response.text);const accepted=data<Cart>(response);
 const zone=crypto.randomUUID(),rate=crypto.randomUUID();
 psql(`INSERT INTO shipping_zones(id,store_id,site_id,name,countries,states,zip_codes,cod_enabled) VALUES('${zone}','${site.siteId}','${site.siteId}','Synthetic snapshot zone',ARRAY['IN'],ARRAY['Karnataka','29'],ARRAY['560001'],true);
 INSERT INTO shipping_rates(id,zone_id,site_id,name,type,price,is_active,cod_enabled) VALUES('${rate}','${zone}','${site.siteId}','Synthetic snapshot delivery','flat',20,true,true);`);
 const handoff=await gateway.request(`/v1/storefront/${site.subdomain}/cart/${accepted.cart_token}/checkout-url`,{method:'POST'});assert.equal(handoff.status,200,handoff.text);
 const query=new URL(data<{checkout_url:string}>(handoff).checkout_url).searchParams.toString();
 const post=async(step:string,body:unknown)=>{
  if(step==='delivery'){
   const delivery=body as {shipping_address:{country:string;state:string;state_code:string;zip:string};shipping_quote:{shipping_rate_id:string}};
   const {country,state,state_code,zip}=delivery.shipping_address;
   const reviewed=await gateway.request(`/v1/checkout/${accepted.id}/quote?${query}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shipping_address:{country,state,state_code,zip},shipping_rate_id:delivery.shipping_quote.shipping_rate_id})});
   assert.equal(reviewed.status,200,reviewed.text);
   body={...delivery,expected_quote_fingerprint:reviewed.json!.data.quote.fingerprint};
  }
  return gateway.request(`/v1/checkout/${accepted.id}/${step}?${query}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 };
 const contact=await post('contact',{idempotency_key:`snapshot-contact-${accepted.id}`,email:'syn-snapshot@example.invalid',name:'Synthetic snapshot buyer'});assert.equal(contact.status,200,contact.text);
 const delivery=await post('delivery',{idempotency_key:`snapshot-delivery-${accepted.id}`,shipping_method:'standard',cod_requested:true,shipping_address:{line1:'Synthetic fixture road',city:'Bengaluru',state:'Karnataka',state_code:'29',zip:'560001',country:'IN'},shipping_quote:{shipping_rate_id:rate,expected_shipping_amount:20}});assert.equal(delivery.status,200,delivery.text);
 const intent=await post('payment-intent',{idempotency_key:`snapshot-intent-${accepted.id}`,provider:'cod',mode:'sandbox',tokenize:false,metadata:{channel:'web'}});assert.equal(intent.status,201,intent.text);
 const key=`snapshot-confirm-${accepted.id}`;
 const first=await post('confirm',{idempotency_key:key});assert.equal(first.status,200,first.text);
 const order=data<{order:{id:string}}>(first).order.id;
 assert.equal(JSON.parse(psql(`SELECT product_snapshot->'niche' FROM order_items WHERE order_id='${order}';`)).personalization.text,'Asha');
 const retry=await post('confirm',{idempotency_key:key});assert.equal(retry.status,200,retry.text);assert.equal(data<{order:{id:string}}>(retry).order.id,order);
 assert.equal(psql(`SELECT count(*) FROM order_items WHERE order_id='${order}';`),'1');
});


test('direct tenant product RPC cannot bypass strict capability validation or same-revision meaning guard',async()=>{
 const id=product({personalization:facts}),before=psql(`SELECT to_jsonb(p) FROM products p WHERE id='${id}';`);
 const raw=(personalization:unknown)=>`BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id','${site.siteId}',true);SELECT set_config('app.actor_id','${actor}',true);SELECT public.apply_product_edit_v1('${site.siteId}','${id}','${actor}',${version(id)},'${crypto.randomUUID()}',${json({fields:{metadata:{personalization}}})});COMMIT;`;
 const changed={...facts,methods:[{...facts.methods[0],label:'Unauthorized same-revision meaning'}]};
 assert.match(psqlExpectError(raw(changed)),/PRODUCT_PERSONALIZATION_REVISION_REQUIRED/);
 assert.match(psqlExpectError(raw({...facts,revision:0})),/PRODUCT_PERSONALIZATION_INVALID/);
 assert.match(psqlExpectError(raw({...facts,methods:[{...facts.methods[0],min_graphemes:30,max_graphemes:1}]})),/PRODUCT_PERSONALIZATION_INVALID/);
 assert.equal(psql(`SELECT to_jsonb(p) FROM products p WHERE id='${id}';`),before);
 const legacy=product({personalization:{...facts,revision:'1'}});
 const repaired=await patch(legacy,{personalization:facts});assert.equal(repaired.status,200,repaired.text);
});

test('order waits for a real concurrent catalog lock and then rejects the stale cart without any inventory effect',async()=>{
 const id=product({personalization:facts}),response=await cart([input(id,await draft(id))]);assert.equal(response.status,201,response.text);const accepted=data<Cart>(response),before=effects(id);
 const label=`snapshot-race-${crypto.randomUUID().slice(0,8)}`;
 const edit=owned.psqlAsync(`SET application_name='${label}';BEGIN;UPDATE products SET version=version+1 WHERE id='${id}';SELECT pg_sleep(2);COMMIT;`);
 let locked=false;
 for(let n=0;n<20;n++){
  locked=psql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='${label}' AND wait_event='PgSleep');`)==='t';
  if(locked)break;await new Promise(resolve=>setTimeout(resolve,10));
 }
 if(!locked)await edit;
 assert.equal(locked,true,'positive control proves the competing transaction holds its catalog change');
 const order=owned.psqlAsync(orderSql(items(accepted)));
 const outcome=await Promise.allSettled([edit,order]);assert.equal(outcome[0].status,'fulfilled');assert.equal(outcome[1].status,'rejected');
 if(outcome[1].status==='rejected')assert.match(String(outcome[1].reason),/CART_FACTS_CHANGED/);
 assert.equal(effects(id),before);
});

const categoryId=crypto.randomUUID(),reviewerId=crypto.randomUUID();
function approveListing(id:string){
 const listing=crypto.randomUUID();
 psql(`INSERT INTO marketplace_categories(id,slug,name,is_active) VALUES('${categoryId}','snapshot-${categoryId}','Synthetic snapshot category',true) ON CONFLICT DO NOTHING;
 INSERT INTO channel_listings(id,site_id,product_id,channel,marketplace_category_id,visibility) VALUES('${listing}','${site.siteId}','${id}','marketplace','${categoryId}','public');
 BEGIN;SELECT set_config('app.site_id','${site.siteId}',true);SELECT * FROM transition_channel_listing('${site.siteId}','${listing}','pending_review','merchant',NULL,NULL,'snapshot-submit-${listing}');COMMIT;`);
 const v=Number(psql(`SELECT version FROM channel_listings WHERE id='${listing}';`));
 psql(`SELECT * FROM claim_marketplace_listing_review('${site.siteId}','${listing}','${reviewerId}','Synthetic snapshot approval fixture','snapshot-claim-${listing}',${v});SELECT * FROM transition_channel_listing('${site.siteId}','${listing}','approved','operator','${reviewerId}','Synthetic approved snapshot fixture','snapshot-approve-${listing}');`);
 return listing;
}
function marketSql(lines:unknown,key=crypto.randomUUID()){return orderSql(lines,key).replace('public.create_checkout_order(','public.create_marketplace_checkout_order(');}
async function marketCart(lines:object[],existing?:Cart){return gateway.request(`/v1/storefront/${site.subdomain}/marketplace-cart`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines,coupon_codes:[],...(existing?{cart_token:existing.cart_token}:{})})});}

test('approved marketplace same-variant configurations merge equally, remain distinct, share stock and recover captured intent',async()=>{
 const id=product({personalization:facts},6),variant=crypto.randomUUID();
 psql(`INSERT INTO product_options(product_id,name,position,values) VALUES('${id}','Wood',0,'["Walnut"]');INSERT INTO product_variants(id,product_id,title,price,inventory_qty,option1,metadata) VALUES('${variant}','${id}','Walnut',1290,6,'Walnut','{}');WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${site.siteId}',true)) SELECT public.set_inventory_level_available('${id}','${variant}','${site.locationId}',6,NULL) FROM _fixture_inventory_scope436;`);
 const listing=approveListing(id),a=await draft(id,'Asha',variant),b=await draft(id,'Kabir',variant);
 const line=(personalization:PersonalizationCartDraft,quantity=1)=>({...input(id,personalization,quantity,variant),marketplace_listing_id:listing});
 const overflow=await marketCart([line(a,4),line(b,3)]);assert.equal(overflow.status,409,overflow.text);
 const response=await marketCart([line(a),line(a),line(b)]);assert.equal(response.status,201,response.text);const accepted=data<Cart>(response);
 assert.equal(accepted.lines.length,2);assert.deepEqual(accepted.lines.map(line=>line.quantity).sort(),[1,2]);
 const key=crypto.randomUUID(),request=items(accepted);
 const [one,two]=await Promise.all([owned.psqlAsync(marketSql(request,key)),owned.psqlAsync(marketSql(request,key))]);assert.equal(one,two);
 const saved=JSON.parse(psql(`SELECT jsonb_agg(jsonb_build_object('text',product_snapshot->'niche'->'personalization'->>'text','quantity',quantity,'listing',marketplace_listing_id) ORDER BY quantity) FROM order_items WHERE order_id='${one}';`)) as Array<{text:string;quantity:number;listing:string}>;
 assert.deepEqual(saved,[{text:'Kabir',quantity:1,listing},{text:'Asha',quantity:2,listing}]);
 assert.equal(psql(`SELECT available FROM inventory_levels WHERE product_id='${id}' AND variant_id='${variant}';`),'3');
 assert.equal(psql(`SELECT status FROM carts WHERE id='${accepted.id}';`),'converted');
 assert.match(psqlExpectError(marketSql(request)),/CART_FACT_REFERENCE_INVALID/,'a new key cannot consume the same cart again');
 const changed=structuredClone(request);changed[0].cart_fact_ref.snapshot_fingerprint='0'.repeat(64);
 assert.match(psqlExpectError(marketSql(changed,key)),/CART_FACT_RECEIPT_CONFLICT/);
 psql(`UPDATE products SET metadata='{}',version=version+1 WHERE id='${id}';`);
 assert.equal(psql(marketSql(request,key)),one,'captured retry uses historical identities even after approval/catalog invalidation');
 assert.equal(psql(`SELECT count(*) FROM order_items WHERE order_id='${one}';`),'2');
});

test('two actual canonical marketplace calls acquire inventory before product SHARE and each commit one non-niche purchase',async()=>{
 const id=product({},5),listing=approveListing(id),request=[{product_id:id,variant_id:null,quantity:1,marketplace_listing_id:listing}];
 const firstKey=crypto.randomUUID(),secondKey=crypto.randomUUID();
 const label=`snapshot-market-lock-${crypto.randomUUID().slice(0,8)}`;
 const hold=owned.psqlAsync(`SET application_name='${label}';BEGIN;SELECT id FROM inventory_levels WHERE product_id='${id}' FOR UPDATE;SELECT pg_sleep(4);COMMIT;`);
 let holding=false;for(let n=0;n<30;n++){holding=psql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='${label}' AND wait_event='PgSleep');`)==='t';if(holding)break;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.equal(holding,true,'positive control establishes the inventory barrier');
 const calls=[owned.psqlAsync(`SET application_name='${label}-a';${marketSql(request,firstKey)}`),owned.psqlAsync(`SET application_name='${label}-b';${marketSql(request,secondKey)}`)];
 let waiting=false;for(let n=0;n<30;n++){waiting=psql(`SELECT count(*) FROM pg_stat_activity WHERE application_name IN('${label}-a','${label}-b') AND wait_event_type='Lock';`)==='2';if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.equal(waiting,true,'both actual marketplace calls wait behind inventory');
 assert.doesNotThrow(()=>psql(`BEGIN;SELECT id FROM products WHERE id='${id}' FOR UPDATE NOWAIT;ROLLBACK;`),'neither blocked checkout may already hold the product SHARE lock');
 await hold;const results=(await Promise.all(calls)).map(output=>output.trim().split('\n').at(-1)!);
 assert.equal(new Set(results).size,2);for(const order of results)assert.match(order,/^[0-9a-f-]{36}$/);
 assert.equal(psql(marketSql(request,firstKey)),results[0]);assert.equal(psql(marketSql(request,secondKey)),results[1]);
 assert.equal(psql(`SELECT count(*) FROM order_items WHERE product_id='${id}';`),'2');
 assert.equal(psql(`SELECT available FROM inventory_levels WHERE product_id='${id}' AND variant_id IS NULL;`),'3');
 assert.equal(psql(`SELECT count(*) FROM inventory_reservations WHERE product_id='${id}' AND status='active';`),'0');
});

test('same cart with two confirmation keys has one atomic effect; changed configured intent cannot reuse its receipt',async()=>{
 const id=product({personalization:facts},4),response=await cart([input(id,await draft(id))]);assert.equal(response.status,201,response.text);const accepted=data<Cart>(response),request=items(accepted);
 const keys=[crypto.randomUUID(),crypto.randomUUID()];const results=await Promise.allSettled(keys.map(key=>owned.psqlAsync(orderSql(request,key))));
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected').length,1);
 const winner=results.findIndex(result=>result.status==='fulfilled');const order=results[winner];assert.equal(order.status,'fulfilled');if(order.status!=='fulfilled')return;
 assert.equal(psql(orderSql(request,keys[winner])),order.value);
 const changed=structuredClone(request);changed[0].cart_fact_ref.configuration_fingerprint='0'.repeat(64);
 assert.match(psqlExpectError(orderSql(changed,keys[winner])),/CART_FACT_RECEIPT_CONFLICT/);
 assert.equal(psql(`SELECT count(*) FROM order_items WHERE product_id='${id}';`),'1');assert.equal(psql(`SELECT available FROM inventory_levels WHERE product_id='${id}' AND variant_id IS NULL;`),'3');
});

test('two configured marketplace carts have no deadlock or partial effect; stale loser completes once after deliberate re-review',async()=>{
 const id=product({personalization:facts},5),listing=approveListing(id);
 const responses=await Promise.all(['Asha','Kabir'].map(async text=>marketCart([{...input(id,await draft(id,text)),marketplace_listing_id:listing}])));
 for(const response of responses)assert.equal(response.status,201,response.text);const carts=responses.map(response=>data<Cart>(response)),keys=[crypto.randomUUID(),crypto.randomUUID()];
 const outcomes=await Promise.allSettled(carts.map((accepted,i)=>owned.psqlAsync(marketSql(items(accepted),keys[i]))));
 assert.equal(outcomes.filter(outcome=>outcome.status==='fulfilled').length,1);const loser=outcomes.findIndex(outcome=>outcome.status==='rejected');assert.ok(loser>=0);
 const failed=outcomes[loser];if(failed.status==='rejected')assert.match(String(failed.reason),/CART_FACTS_CHANGED/);
 assert.equal(psql(`SELECT count(*) FROM order_items WHERE product_id='${id}';`),'1');assert.equal(psql(`SELECT count(*) FROM inventory_reservations WHERE product_id='${id}' AND status='active';`),'0');
 const text=loser===0?'Asha':'Kabir',renewed=await marketCart([{...input(id,await draft(id,text)),marketplace_listing_id:listing}],carts[loser]);assert.equal(renewed.status,200,renewed.text);
 const accepted=data<Cart>(renewed),order=psql(marketSql(items(accepted),keys[loser]));assert.match(order,/^[0-9a-f-]{36}$/);assert.equal(psql(marketSql(items(accepted),keys[loser])),order);
 assert.equal(psql(`SELECT count(*) FROM order_items WHERE product_id='${id}';`),'2');assert.equal(psql(`SELECT available FROM inventory_levels WHERE product_id='${id}' AND variant_id IS NULL;`),'3');
});

test('actual approved marketplace hosted confirmation carries both same-SKU instructions through delivery wrapper and exact replay',async()=>{
 const id=product({personalization:facts},4),listing=approveListing(id);
 const response=await marketCart([{...input(id,await draft(id)),marketplace_listing_id:listing},{...input(id,await draft(id,'Kabir')),marketplace_listing_id:listing}]);assert.equal(response.status,201,response.text);const accepted=data<Cart>(response);
 const zone=crypto.randomUUID(),rate=crypto.randomUUID();
 psql(`INSERT INTO shipping_zones(id,store_id,site_id,name,countries,states,zip_codes,cod_enabled) VALUES('${zone}','${site.siteId}','${site.siteId}','Synthetic marketplace snapshot zone',ARRAY['IN'],ARRAY['Karnataka','29'],ARRAY['560001'],true);INSERT INTO shipping_rates(id,zone_id,site_id,name,type,price,is_active,cod_enabled) VALUES('${rate}','${zone}','${site.siteId}','Synthetic marketplace delivery','flat',20,true,true);`);
 const handoff=await gateway.request(`/v1/storefront/${site.subdomain}/cart/${accepted.cart_token}/checkout-url`,{method:'POST'});assert.equal(handoff.status,200,handoff.text);
 const query=new URL(data<{checkout_url:string}>(handoff).checkout_url).searchParams.toString();
 const post=async(step:string,body:unknown)=>{
  if(step==='delivery'){
   const delivery=body as {shipping_address:{country:string;state:string;state_code:string;zip:string};shipping_quote:{shipping_rate_id:string}};
   const {country,state,state_code,zip}=delivery.shipping_address;
   const reviewed=await gateway.request(`/v1/checkout/${accepted.id}/quote?${query}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shipping_address:{country,state,state_code,zip},shipping_rate_id:delivery.shipping_quote.shipping_rate_id})});
   assert.equal(reviewed.status,200,reviewed.text);
   body={...delivery,expected_quote_fingerprint:reviewed.json!.data.quote.fingerprint};
  }
  return gateway.request(`/v1/checkout/${accepted.id}/${step}?${query}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 };
 const contact=await post('contact',{idempotency_key:`market-snapshot-contact-${accepted.id}`,email:'syn-market-snapshot@example.invalid',name:'Synthetic marketplace snapshot buyer'});assert.equal(contact.status,200,contact.text);
 const delivery=await post('delivery',{idempotency_key:`market-snapshot-delivery-${accepted.id}`,shipping_method:'standard',cod_requested:true,shipping_address:{line1:'Synthetic fixture road',city:'Bengaluru',state:'Karnataka',state_code:'29',zip:'560001',country:'IN'},shipping_quote:{shipping_rate_id:rate,expected_shipping_amount:20}});assert.equal(delivery.status,200,delivery.text);
 const intent=await post('payment-intent',{idempotency_key:`market-snapshot-intent-${accepted.id}`,provider:'cod',mode:'sandbox',tokenize:false,metadata:{channel:'web'}});assert.equal(intent.status,201,intent.text);
 const key=`market-snapshot-confirm-${accepted.id}`,first=await post('confirm',{idempotency_key:key});assert.equal(first.status,200,first.text);const order=data<{order:{id:string}}>(first).order.id;
 const texts=JSON.parse(psql(`SELECT jsonb_agg(product_snapshot->'niche'->'personalization'->>'text' ORDER BY product_snapshot->'niche'->'personalization'->>'text') FROM order_items WHERE order_id='${order}';`));assert.deepEqual(texts,['Asha','Kabir']);
 const retry=await post('confirm',{idempotency_key:key});assert.equal(retry.status,200,retry.text);assert.equal(data<{order:{id:string}}>(retry).order.id,order);
 const newKey=await post('confirm',{idempotency_key:`${key}-different`});assert.ok([200,409].includes(newKey.status),newKey.text);if(newKey.status===200)assert.equal(data<{order:{id:string}}>(newKey).order.id,order);
 assert.equal(psql(`SELECT count(*) FROM order_items WHERE product_id='${id}';`),'2');assert.equal(psql(`SELECT available FROM inventory_levels WHERE product_id='${id}' AND variant_id IS NULL;`),'2');
});

test('a fault after transactional cart consumption rolls back cart, order, inventory and ledger work before exact retry',async()=>{
 const id=product({personalization:facts},3),response=await cart([input(id,await draft(id))]);assert.equal(response.status,201,response.text);const accepted=data<Cart>(response),request=items(accepted),key=crypto.randomUUID();
 const beforeEffects=effects(id),beforeCart=psql(`SELECT to_jsonb(c) FROM carts c WHERE id='${accepted.id}';`);
 const fault=`BEGIN;CREATE FUNCTION pg_temp.synthetic_after_cart_claim() RETURNS trigger LANGUAGE plpgsql AS $fault$ BEGIN IF NEW.event_type='checkout.completed' AND NEW.store_id='${site.siteId}'::uuid THEN RAISE EXCEPTION 'SYNTHETIC_AFTER_CART_CLAIM';END IF;RETURN NEW;END;$fault$;CREATE TRIGGER syn_snapshot_after_claim BEFORE INSERT ON public.outbox_events FOR EACH ROW EXECUTE FUNCTION pg_temp.synthetic_after_cart_claim();${orderSql(request,key)}ROLLBACK;`;
 assert.match(owned.psqlScriptExpectError(fault),/SYNTHETIC_AFTER_CART_CLAIM/);
 assert.equal(effects(id),beforeEffects);assert.equal(psql(`SELECT to_jsonb(c) FROM carts c WHERE id='${accepted.id}';`),beforeCart);
 const order=psql(orderSql(request,key));assert.match(order,/^[0-9a-f-]{36}$/);assert.equal(psql(orderSql(request,key)),order);
 assert.equal(psql(`SELECT count(*) FROM order_items WHERE product_id='${id}';`),'1');assert.equal(psql(`SELECT status FROM carts WHERE id='${accepted.id}';`),'converted');
});
test('retiring migration388 refuses the current tax writer without changing privileges or recorded facts',()=>{
 const before=privilegeProfile();assert.match(owned.psqlScriptExpectError(migration('rollback')),/388 refuses changed predecessor/);assert.equal(privilegeProfile(),before);
});
