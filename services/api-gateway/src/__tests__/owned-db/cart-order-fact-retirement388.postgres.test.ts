// Exact migration388 retirement cohort. Current-stack mounted checkout remains in cart-order-fact-snapshots.
import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { personalizationReviewFingerprint, readPersonalizationFacts, type ProductFactSnapshot, type PersonalizationCartDraft } from '@letbuyy/commerce-core';
import { acceptCartProductFacts } from '../../lib/cart-product-facts';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, type SyntheticTenant } from './synthetic-tenant';

const owned=requireOwnedDatabase(),{psql}=owned;
const site=newSyntheticTenant('snapshot-cart'),other=newSyntheticTenant('snapshot-other');
const actor=crypto.randomUUID(),email=`syn-snapshot-${actor}@example.invalid`;
const quote=(value:string)=>`'${value.replaceAll("'","''")}'`;
const json=(value:unknown)=>`${quote(JSON.stringify(value))}::jsonb`;
const facts={version:1,revision:1,methods:[{id:'engrave',label:'Front engraving',min_graphemes:1,max_graphemes:18,character_set:'unicode-letters',styles:[{id:'sans',label:'Sans'}],placements:[{id:'front',label:'Front'}]}]};
type Line={marketplace_listing_id?:string|null;id:string;product_id:string;variant_id:string|null;quantity:number;unit_price:number;line_total:number;product_version:number;configuration_fingerprint:string|null;snapshot_fingerprint:string;niche_snapshot:ProductFactSnapshot;personalization?:PersonalizationCartDraft};
type Cart={id:string;cart_token:string;store_id:string;updated_at:string;lines:Line[]};
function product(metadata:object={},stock=10,tenant:SyntheticTenant=site,images:string[]=[]){
 const id=crypto.randomUUID();psql(`INSERT INTO products(id,store_id,site_id,name,slug,price,sku,stock,is_active,status,metadata,images)
 VALUES('${id}','${tenant.siteId}','${tenant.siteId}','Synthetic snapshot product','syn-${id}',1290,'SYN-${id}',${stock},true,'active',${json(metadata)},ARRAY[${images.map(quote).join(',')}]::text[]);
 WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${tenant.siteId}',true)) SELECT public.set_inventory_level_available('${id}',NULL,'${tenant.locationId}',${stock},NULL) FROM _fixture_inventory_scope436;`);return id;
}
// SQL-only388 recovery controls cannot mount today's Gateway: its atomic cart
// transport requires395 and later. Prepare the retained row using the existing
// canonical fact acceptor, then exercise the real388 order/rollback functions.
// Full current HTTP/tenant/checkout behavior remains in cart-order-fact-snapshots.
function historicalSource(id:string):Record<string,unknown>{
 return JSON.parse(psql(`SELECT jsonb_build_object('id',p.id,'version',p.version,'metadata',p.metadata,'images',p.images,
  'variants',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'product_id',v.product_id,'metadata',v.metadata,
   'options',jsonb_strip_nulls(jsonb_build_object(coalesce(n.names[1],'Option 1'),v.option1,coalesce(n.names[2],'Option 2'),v.option2,coalesce(n.names[3],'Option 3'),v.option3)))),'[]'::jsonb)
   FROM product_variants v WHERE v.product_id=p.id),
  'inventory',(SELECT coalesce(jsonb_agg(jsonb_build_object('variant_id',i.variant_id,'available',greatest(i.available-i.reserved,0))),'[]'::jsonb)
   FROM inventory_levels i JOIN inventory_locations l ON l.id=i.location_id WHERE i.product_id=p.id AND i.store_id=p.store_id AND i.deleted_at IS NULL AND l.status='active' AND l.deleted_at IS NULL))
 FROM products p LEFT JOIN LATERAL(SELECT array_agg(name ORDER BY position,id)names FROM product_options WHERE product_id=p.id)n ON true
 WHERE p.id='${id}' AND p.store_id='${site.siteId}';`)) as Record<string,unknown>;
}
async function draft(id:string,text='Asha'):Promise<PersonalizationCartDraft>{
 const source=historicalSource(id),personalization=readPersonalizationFacts(source.metadata);assert.ok(personalization);
 return {facts_revision:personalization.revision,review_fingerprint:await personalizationReviewFingerprint({product_id:id,variant_id:null,product_version:source.version,facts:personalization}),method_id:'engrave',style_id:'sans',placement_id:'front',text};
}
function input(id:string,personalization?:PersonalizationCartDraft,quantity=1,variant_id?:string){return {product_id:id,variant_id:variant_id??null,quantity,...(personalization?{personalization}:{})};}
async function historicalCart(inputs:ReturnType<typeof input>[]):Promise<Cart>{
 const lines=[];
 for(const item of inputs){
  const accepted=await acceptCartProductFacts(historicalSource(item.product_id),item.variant_id,item.personalization);assert.ok('prepared'in accepted,JSON.stringify(accepted));
  assert.ok(accepted.available>=item.quantity,'positive historical fixture has real available stock');
  lines.push({id:crypto.randomUUID(),...item,marketplace_listing_id:null,unit_price:1290,line_total:1290*item.quantity,
   niche_snapshot:accepted.prepared.snapshot,product_version:accepted.prepared.product_version,
   configuration_fingerprint:accepted.prepared.configuration_fingerprint,snapshot_fingerprint:accepted.prepared.snapshot_fingerprint,catalog_source:accepted.catalog_source});
 }
 const id=crypto.randomUUID(),token=crypto.randomUUID();
 psql(`INSERT INTO carts(id,store_id,session_id,items,status,fact_acceptance_version)VALUES('${id}','${site.siteId}','${token}',${json(lines)},'active',1);`);
 const stored=JSON.parse(psql(`SELECT jsonb_build_object('id',id,'store_id',store_id,'cart_token',session_id,'updated_at',updated_at,'lines',items)FROM carts WHERE id='${id}';`)) as Cart;
 assert.equal(stored.lines.length,inputs.length);assert.equal(stored.store_id,site.siteId);return stored;
}
function items(cart:Cart){return cart.lines.map(line=>({product_id:line.product_id,variant_id:line.variant_id,quantity:line.quantity,...(line.marketplace_listing_id?{marketplace_listing_id:line.marketplace_listing_id}:{}),cart_fact_ref:{cart_id:cart.id,cart_token:cart.cart_token,line_id:line.id,product_version:line.product_version,configuration_fingerprint:line.configuration_fingerprint,snapshot_fingerprint:line.snapshot_fingerprint}}));}
function orderSql(lines:unknown,key=crypto.randomUUID(),tenant=site){return `SELECT public.create_checkout_order(p_store_id=>'${tenant.siteId}'::uuid,p_customer_name=>'Synthetic snapshot buyer',p_customer_email=>'syn-snapshot@example.invalid',p_customer_phone=>'9000000099',p_shipping_address=>'{}'::jsonb,p_items=>${json(lines)},p_payment_method=>'cod',p_idempotency_key=>'${key}',p_request_id=>'snapshot-${key}') ->> 'id';`;}
before(()=>{
 for(const tenant of[site,other])seedSyntheticTenant(psql,tenant);
 psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true);UPDATE sites SET custom_user_id='${actor}' WHERE id='${site.siteId}';`);
});

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
test('388 paired DOWN restores predecessor bodies and ACL deltas, reapply recovers identical live contracts',()=>{
 const installed=privilegeProfile();
 const forward386=readFileSync(new URL('../../../../../database/supabase/migrations/386_storefront_discovery.sql',import.meta.url),'utf8');
 const rollback386=readFileSync(new URL('../../../../../database/supabase/rollback/386_storefront_discovery.rollback.sql',import.meta.url),'utf8');
 assert.equal(createHash('sha256').update(forward386).digest('hex'),'33c2849f93fc594902e5017f00ab3141780bd06f856ce67f4a21aa77e87da81d');
 assert.equal(createHash('sha256').update(rollback386).digest('hex'),'00e99215bc715adbc20a1d59384c17bf676045976d3de6e94f591dec13ab95cf');
 assert.match(owned.psqlScriptExpectError(rollback386),/388|dependencies/);assert.equal(privilegeProfile(),installed);
 owned.script(migration('rollback'));
 assert.equal(psql(`SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='carts' AND column_name='fact_acceptance_version';`),'0');
 assert.equal(psql(`SELECT count(*) FROM migration_privilege_journal WHERE migration='388';`),'0');
 // Exercise a named owner-issued column grant, including grant option, that table-only oracles miss.
 psql(`GRANT UPDATE(items) ON public.carts TO authenticated WITH GRANT OPTION;`);
 const beforeUp=privilegeProfile();
 const unwrapped=migration('migrations').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
 const lower='public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text)';
 const mutants=[
  `CREATE ROLE syn_snapshot_unknown NOLOGIN NOBYPASSRLS;GRANT SELECT,UPDATE ON public.carts TO syn_snapshot_unknown;`,
  `CREATE ROLE syn_snapshot_unknown NOLOGIN NOBYPASSRLS;GRANT UPDATE(items) ON public.carts TO syn_snapshot_unknown;`,
  `CREATE ROLE syn_snapshot_unknown NOLOGIN NOBYPASSRLS;GRANT EXECUTE ON FUNCTION ${lower} TO syn_snapshot_unknown;`,
  `GRANT UPDATE(items) ON public.carts TO service_role WITH GRANT OPTION;SET LOCAL ROLE service_role;GRANT UPDATE(items) ON public.carts TO anon;RESET ROLE;`,
  `CREATE ROLE syn_snapshot_unknown NOLOGIN NOBYPASSRLS;GRANT service_role TO syn_snapshot_unknown;`,
 ];
 for(const setup of mutants){
  assert.match(owned.psqlScriptExpectError(`BEGIN;${setup}\n${unwrapped}\nROLLBACK;`),/388 refuses unrecognized/);
  assert.equal(privilegeProfile(),beforeUp,'failed admission must roll back every catalog delta');
 }
 owned.script(migration('migrations'));
 owned.script(migration('rollback'));
 assert.equal(privilegeProfile(),beforeUp,'immediate DOWN must exactly recover pre-UP ACLs, columns, grantors, options, owners, memberships and effective access');
 owned.script(migration('migrations'));
 assert.equal(psql(`SELECT has_any_column_privilege('authenticated','public.carts','UPDATE');`),'f');
});

function archiveProduct(id:string){psql(`UPDATE products SET status='archived',is_active=false WHERE id='${id}';`);}
test('DOWN refuses sellable variant-only facts and named options without active carts; supported retirement preserves history',async()=>{
 for(const metadata of[{food:{netQuantity:{value:250,unit:'g'}}},{furniture:{assembled:{width:12,unit:'cm'}}},{books:{kind:'book',language:'English',format:'paperback'}},{}]){
  const id=product({},4),variant=crypto.randomUUID();
  psql(`INSERT INTO product_options(product_id,name,position,values) VALUES('${id}','Pack name',0,'["Single"]');INSERT INTO product_variants(id,product_id,title,price,inventory_qty,option1,metadata) VALUES('${variant}','${id}','Synthetic variant-only capability',1290,4,'Single',${json(metadata)});WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${site.siteId}',true)) SELECT public.set_inventory_level_available('${id}','${variant}','${site.locationId}',4,NULL) FROM _fixture_inventory_scope436;`);
  assert.equal(psql(`SELECT count(*) FROM carts WHERE store_id='${site.siteId}' AND status='active' AND fact_acceptance_version=1;`),'0');
  assert.match(owned.psqlScriptExpectError(migration('rollback')),/388 rollback requires/);
  const accepted=await historicalCart([input(id,undefined,1,variant)]);
  const order=psql(orderSql(items(accepted))),history=psql(`SELECT product_snapshot FROM order_items WHERE order_id='${order}';`);
  await archiveProduct(id);owned.script(migration('rollback'));
  assert.equal(psql(`SELECT product_snapshot FROM order_items WHERE order_id='${order}';`),history);
  owned.script(migration('migrations'));
 }
});

test('rollback refuses active accepted capabilities and preserves recorded history instead of silently downgrading',async()=>{
 const id=product({personalization:facts});await historicalCart([input(id,await draft(id))]);
 const before=privilegeProfile();assert.match(owned.psqlScriptExpectError(migration('rollback')),/388 rollback requires/);assert.equal(privilegeProfile(),before);
});
