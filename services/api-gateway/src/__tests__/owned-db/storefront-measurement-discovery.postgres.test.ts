import {assertReviewedSourceHash} from './consolidation-source-review.mjs';
// PREPARED, NOT EXECUTED: root must allocate a fresh reviewed through388 owned
// template. This suite never applies389 and only applies the exact pinned DOCS390
// draft below, after proving baseline source/profile/roles. No developer stack.
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { StorefrontDiscoveryQuerySchema, StorefrontDiscoveryMetadataSchema, PRODUCT_NICHE_FACT_SCHEMAS, VARIANT_NICHE_FACT_SCHEMAS } from '@letbuyy/commerce-core';
import { readStorefrontDiscoveryPayload } from '../../lib/storefront-discovery';
import { Gateway, gatewayEnv, newIdentityKeys, tapRest, type RestTap } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, type SyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const root = new URL('../../../../../', import.meta.url);
const docs = 'docs/implementation/threadline-2026-10-22/measurement-discovery/';
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const evidence = JSON.parse(read(docs + 'source-evidence.json')) as {
 baselineProsrcMd5: string; proposedProsrcMd5: string; drafts: Array<{ path: string; sha256: string }>;
};
const up = read(docs + '390_measurement_discovery.up.draft.sql');
const down = read(docs + '390_measurement_discovery.down.draft.sql');
const signature = 'public.browse_storefront_products_v1(uuid,jsonb,uuid[])';
const q = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const json = (value: unknown) => q(JSON.stringify(value)) + '::jsonb';
let proxy: OwnedPooledSqlProxy, gateway: Gateway, tap: RestTap;
let baselineCatalog: string, baselineData: string;
let malformedTransport=false;
const site = newSyntheticTenant('measurement390'), foreign = newSyntheticTenant('measurement390-other');
const ids: Record<string, string> = {};
const variants: Record<string, string> = {};
const fullLength = { available: true, allowed_units: ['mm','cm','m','in'] };
const noLength = { available: false, allowed_units: [] };
const noCapabilities = { equipment_length: noLength, max_width_cm: { available: false }, max_depth_cm: { available: false } };
function product(name: string, metadata: unknown, stock = 5, tenant = site) {
 const id = randomUUID();
 owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,category,country_of_origin,metadata) VALUES(${q(id)},${q(tenant.siteId)},${q(tenant.siteId)},${q('Synthetic '+name)},${q('syn-'+id)},999,${stock},true,'active','Synthetic measurement','India',${json(metadata)});`);
 return id;
}
function variant(productId: string, metadata: unknown, price = 200, stock = 3, size?: string) {
 const id = randomUUID();
 owned.psql(`INSERT INTO product_variants(id,product_id,title,sku,price,inventory_qty,option1,metadata) VALUES(${q(id)},${q(productId)},'Synthetic measurement variant',${q('SYN-'+id)},${price},${stock},${size?q(size):'NULL'},${json(metadata)}); WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${site.siteId}',true)) SELECT public.set_inventory_level_available(${q(productId)},${q(id)},${q(site.locationId)},${stock},NULL) FROM _fixture_inventory_scope436;`);
 return id;
}
function browse(query: Record<string, unknown> = {}, selected?: string[], tenant = site) {
 const parsed = StorefrontDiscoveryQuerySchema.parse(query);
 const raw: unknown = JSON.parse(owned.psql(`SELECT public.browse_storefront_products_v1(${q(tenant.siteId)},${json(parsed)},${selected?`ARRAY[${selected.map(q).join(',')}]::uuid[]`:'NULL'});`));
 return { raw: raw as Record<string, unknown>, ...readStorefrontDiscoveryPayload(raw, parsed) };
}
function caps(result: ReturnType<typeof browse>) {
 const value = result.discovery.measurement_capabilities; assert.ok(value, 'actual390 RPC must supply the complete capability object'); return value;
}
function withoutCapability(result: ReturnType<typeof browse>) { const value = { ...result.raw }; delete value.measurement_capabilities; return value; }
function bodyHash() { return owned.psql(`SELECT md5(prosrc) FROM pg_proc WHERE oid=${q(signature)}::regprocedure;`); }
function catalog() {
 return owned.psql(`SELECT coalesce(jsonb_agg(jsonb_build_object('row',to_jsonb(p),'definition',pg_get_functiondef(p.oid),'comment',obj_description(p.oid,'pg_proc'),
 'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid),
 'sharedDependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_shdepend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.dbid=(SELECT oid FROM pg_database WHERE datname=current_database()))) ORDER BY p.proname),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND(p.proname LIKE 'storefront_discovery_%_v1' OR p.proname IN('browse_storefront_products_v1','browse_storefront_apparel_v1'));`);
}
function data() {
 return owned.psql(`SELECT jsonb_build_object('products',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM products p),'variants',(SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM product_variants v),'options',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM product_options o),'inventory',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM inventory_levels i));`);
}
function positiveRoles() {
 for (const role of ['anon','authenticated','app_tenant','authenticator']) assert.equal(owned.psql(`SELECT has_function_privilege(${q(role)},${q(signature)},'EXECUTE');`),'f',role+' baseline effective denial');
 assert.equal(owned.psql(`SELECT has_function_privilege('service_role',${q(signature)},'EXECUTE');`),'t');
 assert.equal(owned.psql(`SELECT has_function_privilege(pg_get_userbyid(proowner),oid,'EXECUTE') FROM pg_proc WHERE oid=${q(signature)}::regprocedure;`),'t');
 const query=json(StorefrontDiscoveryQuerySchema.parse({}));
 assert.equal(owned.psql(`BEGIN;SET LOCAL ROLE service_role;SELECT public.browse_storefront_products_v1(${q(site.siteId)},${query})->>'count';ROLLBACK;`).split('\n').filter(line=>/^\d+$/.test(line)).at(-1),String(browse().count),'service-role actual positive browse');
 assert(browse().count > 0, 'owner actual positive browse');
}
function admissionRefuses(script: string) {
 const snapshot = catalog(), rows = data();
 assert.match(owned.psqlScriptExpectError(script),/discovery function profile changed|DRAFT390 refuses/);
 assert.equal(catalog(),snapshot,'failed admission leaves exact post-mutant catalog untouched');
 assert.equal(data(),rows,'failed admission writes no business rows');
}
function aclMutant(script: string, grantorOnly: boolean) {
 positiveRoles();
 const original=owned.psql(`SELECT proacl::text FROM pg_proc WHERE oid=${q(signature)}::regprocedure;`);assert(original);
 try {
  if(grantorOnly)owned.psql(`UPDATE pg_proc p SET proacl=(SELECT array_agg(makeaclitem(a.grantee,CASE WHEN a.grantee='service_role'::regrole THEN 'anon'::regrole::oid ELSE a.grantor END,a.privilege_type,a.is_grantable) ORDER BY a.grantee,a.grantor) FROM aclexplode(p.proacl) a) WHERE p.oid=${q(signature)}::regprocedure;`);
  else owned.psql(`GRANT EXECUTE ON FUNCTION ${signature} TO anon;`);
  admissionRefuses(script);
 } finally {
  // A native GRANT also creates pg_shdepend ACL dependencies: undo it through
  // native REVOKE. A raw proacl-only restore would leave catalog drift behind.
  if(grantorOnly)owned.psql(`UPDATE pg_proc SET proacl=${q(original)}::aclitem[] WHERE oid=${q(signature)}::regprocedure;`);
  else owned.psql(`REVOKE EXECUTE ON FUNCTION ${signature} FROM anon;`);
 }
 assert.equal(owned.psql(`SELECT proacl::text FROM pg_proc WHERE oid=${q(signature)}::regprocedure;`),original,'mutant cleanup restores exact raw ACL');
 positiveRoles();
}
function inheritedMutant(script: string, role: 'app_tenant' | 'authenticator') {
 positiveRoles();
 const edges=(roleId:string,member:string)=>JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]') FROM pg_auth_members m WHERE roleid=${q(roleId)}::regrole AND member=${q(member)}::regrole;`)) as Array<{grantor:number;admin_option:boolean;inherit_option:boolean;set_option:boolean}>;
 const membership=edges('service_role',role);
 // D4 makes service_role a member of app_tenant. Temporarily remove that
 // opposite edge in this disposable cluster so the native mutant is not an
 // impossible circular grant; restore both edges/options in finally.
 const reverse=role==='app_tenant'?edges(role,'service_role'):[];
 for(const group of [membership,reverse]){
  assert(group.length<=1,'existing single canonical membership edge');
  for(const row of group)assert.equal(owned.psql(`SELECT ${row.grantor}=(SELECT oid FROM pg_roles WHERE rolname=current_user);`),'t','restore only fixture-owner granted membership');
 }
 const restore=(roleId:string,member:string,rows:typeof membership)=>{for(const row of rows)owned.psql(`GRANT ${roleId} TO ${member} WITH ADMIN ${row.admin_option?'TRUE':'FALSE'}, INHERIT ${row.inherit_option?'TRUE':'FALSE'}, SET ${row.set_option?'TRUE':'FALSE'};`);};
 const acl=owned.psql(`SELECT proacl::text FROM pg_proc WHERE oid=${q(signature)}::regprocedure;`);
 try {
  if(reverse.length)owned.psql('REVOKE app_tenant FROM service_role;');
  owned.psql(`GRANT service_role TO ${role} WITH INHERIT TRUE;`);
  assert.equal(owned.psql(`SELECT has_function_privilege(${q(role)},${q(signature)},'EXECUTE');`),'t','effective inherited privilege mutant is real');
  assert.equal(owned.psql(`SELECT proacl::text FROM pg_proc WHERE oid=${q(signature)}::regprocedure;`),acl,'function ACL stayed canonical');
  admissionRefuses(script);
 } finally {
  owned.psql(`REVOKE service_role FROM ${role};`);
  restore('service_role',role,membership);
  if(role==='app_tenant')restore(role,'service_role',reverse);
 }
 const restored=JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]') FROM pg_auth_members m WHERE roleid='service_role'::regrole AND member=${q(role)}::regrole;`)) as Array<Record<string,unknown>>;
 // Membership OID is necessarily new after revoke/regrant; all authority fields must match.
 const authority=(rows:Array<Record<string,unknown>>)=>rows.map(({oid: _oid,...row})=>row);
 assert.deepEqual(authority(restored),authority(membership));
 if(role==='app_tenant')assert.deepEqual(authority(edges(role,'service_role')),authority(reverse));
 positiveRoles();
}
const sports=(value:number,unit:string)=>({sports:{activity:'badminton',equipmentType:'racket',length:{value,unit}}});
const sportsVariant=(value:number,unit:string)=>({sports:VARIANT_NICHE_FACT_SCHEMAS.sports.parse({length:{value,unit}})});
const furniture=(value:Record<string,unknown>)=>({furniture:value});
const parityQueries: Array<Record<string,unknown>>=[{}, {limit:1,page:2,sort:'price-asc'}, {search:'Synthetic',category:'Synthetic measurement',country_of_origin:'India'}, {length_value:25.4,length_unit:'cm'}, {max_width_cm:60.96}, {max_depth_cm:76.3}, {material:'Wood',finish:'Natural'}, {min_price:100,max_price:1000}, {sort:'newest'}, {limit:1,page:10000}, {age_band:'3-5',interest:'art'}, {connector:['usb-c','hdmi']}, {pack_size:'g:250'}, {occasion:'birthday',recipient:'friend'}, {personalization_method:'engrave'}, {routine_stage:'care',format:'Cream'}, {books_language:'English',books_author:'Asha'}];
let parity: Array<unknown>;
before(async()=>{
 for(const [name,contents]of [['390_measurement_discovery.up.draft.sql',up],['390_measurement_discovery.down.draft.sql',down]]) {
  const pin=evidence.drafts.find(row=>row.path===name);assert(pin);assert.equal(createHash('sha256').update(contents).digest('hex'),pin.sha256);
 }
 assert.equal(bodyHash(),evidence.baselineProsrcMd5,'requires exact qualified386 function; no auto-repair/downgrade');
 assert.equal(owned.psql("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='carts' AND column_name='fact_acceptance_version');"),'t','requires reviewed through388 baseline');
 seedSyntheticTenant(owned.psql,site);seedSyntheticTenant(owned.psql,foreign);
 ids.mm=product('equipment mm',sports(254,'mm'));ids.cm=product('equipment cm',sports(25.4,'cm'));ids.in=product('equipment in',sports(10,'in'));ids.huge=product('equipment huge',sports(100000,'m'));
 ids.width=product('width only',furniture({assembled:{width:60.96,unit:'cm'}}));ids.depth=product('depth only',furniture({assembled:{depth:60.96,unit:'cm'}}));ids.noAxis=product('non assembled axes',furniture({package:{width:40,depth:50,unit:'cm'},seat_height:{value:20,unit:'in'},assembled:{height:70,diameter:80,unit:'cm'},materials:['Wood']}));
 ids.sold=product('sold measured',sports(254,'mm'),0);ids.invalid=product('invalid measurement',{sports:{activity:'badminton',equipmentType:'racket',length:{value:'254',unit:'mm'}},furniture:{assembled:{width:0,unit:'cm'}}});ids.other=product('other store measured',sports(254,'mm'),5,foreign);
 ids.variants=product('combined equipment',sports(675,'mm'));owned.psql(`INSERT INTO product_options(product_id,name,position,values)VALUES(${q(ids.variants)},'Size',0,'["S","M"]');`);variants.small=variant(ids.variants,sportsVariant(675,'mm'),500,3,'S');variants.medium=variant(ids.variants,sportsVariant(700,'mm'),1000,3,'M');
 ids.atomic=product('atomic furniture',furniture({assembled:{width:100,depth:50,unit:'cm'}}));variants.atomic=variant(ids.atomic,furniture({assembled:{width:20,unit:'in'}}));
 ids.split=product('split axes',{});variants.width=variant(ids.split,furniture({assembled:{width:20,unit:'cm'}}));variants.depth=variant(ids.split,furniture({assembled:{depth:20,unit:'cm'}}));
 ids.invalidOverride=product('invalid selected override',{...sports(254,'mm'),...furniture({assembled:{width:40,depth:50,unit:'cm'}})});variant(ids.invalidOverride,{sports:{length:{value:0,unit:'mm'}},furniture:{assembled:{width:40,unit:'invalid'}}});
 ids.tiny=product('rounded zero',{...sports(.00001,'mm'),...furniture({assembled:{width:.00001,depth:.00001,unit:'mm'}})});
 ids.soldVariant=product('only sold variant measured',{sports:{activity:'badminton',equipmentType:'racket'},furniture:{}});variant(ids.soldVariant,{sports:{length:{value:254,unit:'mm'}},furniture:{assembled:{width:40,depth:50,unit:'cm'}}},100,0);variant(ids.soldVariant,{sports:{weight:{value:100,unit:'g'}},furniture:{}},200,3);
 ids.widthMm=product('width mm equivalent',furniture({assembled:{width:609.6,unit:'mm'}}));ids.widthIn=product('width inch equivalent',furniture({assembled:{width:24,unit:'in'}}));
 ids.room=product('room witnesses',{});variants.roomA=variant(ids.room,furniture({assembled:{width:24,depth:30,unit:'in'},materials:['Wood'],finish:'Natural'}),200);variants.roomB=variant(ids.room,furniture({assembled:{width:70,depth:60,unit:'cm'},materials:['Metal'],finish:'Black'}),100);
 const otherFacts={
  toys:{ageBands:['3-5'],interests:['art']},
  electronics:{kind:'hub',power_input_w:100,pass_through_output_w:85,connectors:[{kind:'usb-c',role:'host',count:1}]},
  food:{netQuantity:{value:250,unit:'g'}},gifts:{occasions:['birthday'],recipients:['friend']},
  personalization:{version:1,revision:1,methods:[{id:'engrave',label:'Engrave',min_graphemes:1,max_graphemes:12,character_set:'latin-name',styles:[{id:'sans',label:'Sans'}],placements:[{id:'front',label:'Front'}]}]},
  beauty:{routineStage:'care',format:'Cream'},books:{kind:'book',authors:['Asha Rao'],subjects:['Fiction'],language:'English',format:'paperback'},
 };
 for(const [namespace,value] of Object.entries(otherFacts)){
  const schema=PRODUCT_NICHE_FACT_SCHEMAS[namespace as keyof typeof PRODUCT_NICHE_FACT_SCHEMAS];assert(schema.safeParse(value).success,'canonical parity fixture '+namespace);product('parity '+namespace,{[namespace]:value});
 }
 positiveRoles();baselineCatalog=catalog();baselineData=data();parity=parityQueries.map(query=>withoutCapability(browse(query)));
 assert(browse().discovery.measurement_capabilities===undefined,'old386 object absent accepted by released reader');
 // Mutants prove admission before either leg, rather than preserving bad initial ACLs.
 aclMutant(up,false);aclMutant(up,true);for(const role of ['app_tenant','authenticator'] as const)inheritedMutant(up,role);
 assert.equal(catalog(),baselineCatalog);assert.equal(data(),baselineData);
 try { owned.script(up); } catch(error) {
  // Execute the same replacement inside a failing DO transaction for a field
  // diagnostic only. The raised exception rolls back every catalog change;
  // neither the reviewed migration guard nor its source pins are modified.
  const replacement=up.match(/EXECUTE \$replacement\$([\s\S]+?)\$replacement\$;/)?.[1];assert(replacement);
  const before=catalog();
  const snapshot=`SELECT jsonb_build_object('row',to_jsonb(p)-'prosrc','comment',obj_description(p.oid,'pg_proc'),
   'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid),
   'sharedDependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_shdepend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.dbid=(SELECT oid FROM pg_database WHERE datname=current_database())))
   FROM pg_proc p WHERE p.oid=${q(signature)}::regprocedure;`;
  const output=owned.psql(`BEGIN;${snapshot}DO $diagnostic$ BEGIN EXECUTE $replacement$${replacement}$replacement$;END $diagnostic$;${snapshot}ROLLBACK;`);
  const snapshots=output.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line) as Record<string,unknown>);assert.equal(snapshots.length,2);
  const changed=Object.fromEntries(Object.entries(snapshots[0]).flatMap(([key,value])=>JSON.stringify(value)===JSON.stringify(snapshots[1][key])?[]:[[key,{before:value,after:snapshots[1][key]}]]));
  const rows=snapshots.map(value=>value.row as Record<string,unknown>);
  if(changed.row)changed.row={before:Object.fromEntries(Object.entries(rows[0]).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(rows[1][key]))),after:Object.fromEntries(Object.entries(rows[1]).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(rows[0][key])))};
  assert.equal(catalog(),before,'explicit BEGIN/ROLLBACK diagnostic conserves exact catalog');
  console.info('DIAGNOSTIC390',JSON.stringify(changed));throw error;
 }
 proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));tap=tapRest(owned.restUrl,async(call,forward)=>{
  if(malformedTransport&&['rpc/browse_storefront_products_v1','browse_storefront_products_v1'].includes(call.resource)){
   const response=await forward();const payload:unknown=await response.json();assert(payload&&typeof payload==='object'&&!Array.isArray(payload));
   return Response.json({...payload,measurement_capabilities:{equipment_length:noLength}},{status:200});
  }
  return forward();
 });
});
after(async()=>{await gateway?.settle();tap?.restore();await closePooledSqlClients();await proxy?.stop();});

test('real SQL equivalents, query-unit bounds and full strict metadata use available witnesses',()=>{
 for(const [value,unit]of [[254,'mm'],[25.4,'cm'],[.254,'m'],[10,'in']] as const){const result=browse({length_value:value,length_unit:unit},[ids.mm,ids.cm,ids.in]);assert.equal(result.count,3);assert.deepEqual(caps(result).equipment_length,fullLength);}
 assert.deepEqual(caps(browse({},[ids.huge])).equipment_length,{available:true,allowed_units:['m']});
 assert.deepEqual(caps(browse({},[ids.sold,ids.invalid,ids.invalidOverride,ids.tiny,ids.soldVariant])),noCapabilities);
 assert.deepEqual(caps(browse({},[ids.other])),noCapabilities);
});
test('equipment options/price/length stay on one available canonical variant',()=>{
 assert.equal(browse({size:'M',length_value:675,length_unit:'mm'},[ids.variants]).count,0);
 assert.deepEqual(caps(browse({size:'M',length_value:675,length_unit:'mm'},[ids.variants])),noCapabilities);
 const positive=browse({size:'M',length_value:700,length_unit:'mm',min_price:1000},[ids.variants]);assert.equal(positive.count,1,'real positive same-variant control');
 assert.deepEqual(positive.discovery.matches[0].variant_ids,[variants.medium]);assert.deepEqual(caps(positive).equipment_length,fullLength);
});
test('assembled width/depth are independent, threshold precision is unchanged and no other geometry fills an axis',()=>{
 assert.deepEqual(caps(browse({},[ids.width])),{equipment_length:noLength,max_width_cm:{available:true},max_depth_cm:{available:false}});
 assert.deepEqual(caps(browse({},[ids.depth])),{equipment_length:noLength,max_width_cm:{available:false},max_depth_cm:{available:true}});
 assert.deepEqual(caps(browse({},[ids.noAxis])),noCapabilities);
 assert.equal(browse({max_width_cm:60.96},[ids.width,ids.widthMm,ids.widthIn]).count,3);assert.equal(browse({max_width_cm:60.9599},[ids.width,ids.widthMm,ids.widthIn]).count,0);
 assert.deepEqual(caps(browse({max_width_cm:60.9599},[ids.width])),noCapabilities);
 assert.equal(caps(browse({},[ids.atomic])).max_width_cm.available,true);assert.equal(caps(browse({},[ids.atomic])).max_depth_cm.available,false);
});
test('independent controls do not manufacture a joint variant fit or cross-variant material/finish match',()=>{
 assert.equal(caps(browse({},[ids.split])).max_width_cm.available,true);assert.equal(caps(browse({},[ids.split])).max_depth_cm.available,true);
 assert.equal(browse({max_width_cm:61,max_depth_cm:61},[ids.split]).count,0);assert.deepEqual(caps(browse({max_width_cm:61,max_depth_cm:61},[ids.split])),noCapabilities);
 assert.equal(browse({max_width_cm:61,max_depth_cm:61},[ids.room]).count,0);assert.equal(browse({material:'Wood',finish:'Black'},[ids.room]).count,0);
 assert.deepEqual(browse({max_width_cm:61,max_depth_cm:76.3,material:'Wood',finish:'Natural'},[ids.room]).discovery.matches[0].variant_ids,[variants.roomA]);
});
test('capabilities cover scoped fully matched cohort before pagination and active empty result is false',()=>{
 const first=browse({limit:1,sort:'price-asc'}),past=browse({page:10000,limit:1,sort:'price-asc'});assert.equal(past.data.length,0);assert.deepEqual(caps(past),caps(first));
 assert.deepEqual(caps(browse({search:'does-not-match-any-owned-product'})),noCapabilities);
 assert.deepEqual(caps(browse({length_value:888,length_unit:'cm'})),noCapabilities);
});
test('every preexisting raw result field and business row remains exact across390',()=>{
 assert.deepEqual(parityQueries.map(query=>withoutCapability(browse(query))),parity);assert.equal(data(),baselineData);
});
test('actual mounted worker forwards equipment and each furniture axis through canonical reader with one RPC per query',async()=>{
 for(const query of [{length_value:25.4,length_unit:'cm'},{max_width_cm:60.96},{max_depth_cm:60.96},{max_width_cm:61,max_depth_cm:76.3,material:'Wood',finish:'Natural'}]) {
  const expected=browse(query);assert(expected.count>0,'real SQL positive cohort before HTTP');
  const params=new URLSearchParams(Object.entries(query).map(([key,value]): [string,string]=>[key,String(value)]));
  const start=tap.calls.length,response=await gateway.request(`/v1/storefront/${site.subdomain}/products?${params}`);
  assert.equal(response.status,200,response.text);const metadata=StorefrontDiscoveryMetadataSchema.parse(response.json?.discovery);
  assert.deepEqual(metadata,expected.discovery,'full actual metadata/variant witnesses survive mounted worker transport');
  assert.doesNotMatch(JSON.stringify(response.json),/_equipment_length_mm|_width_mm|_depth_mm/,'private normalized measurements are not exposed');
  assert.equal(tap.calls.slice(start).filter(call=>call.resource==='rpc/browse_storefront_products_v1'||call.resource==='browse_storefront_products_v1').length,1);
 }
});
test('mounted worker rejects a malformed partial capability response after a real positive control',async()=>{
 const path=`/v1/storefront/${site.subdomain}/products?max_width_cm=60.96`;
 const good=await gateway.request(path);assert.equal(good.status,200,good.text);
 malformedTransport=true;
 try {const failed=await gateway.request(path);assert.equal(failed.status,500,failed.text);assert.doesNotMatch(failed.text,/ZodError|measurement_capabilities.*required|schema|stack/i);}
 finally {malformedTransport=false;}
});

test('bounded actual SQL perf smoke reports work and constant-size capability, not production performance',()=>{
 const explain=JSON.parse(owned.psql(`EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT public.browse_storefront_products_v1(${q(site.siteId)},'{"page":1,"limit":1}'::jsonb);`)) as Array<Record<string,unknown>>;
 const milliseconds=Number(explain[0]['Execution Time']);assert(Number.isFinite(milliseconds)&&milliseconds>=0&&milliseconds<10000);
 assert(Buffer.byteLength(JSON.stringify(caps(browse())))<=256,'fixed3 leaves/4 units bounded, no witness-sized payload');
 console.info('MEASUREMENT390_OWNED_PERF',JSON.stringify({executionMs:milliseconds,capabilityBytes:Buffer.byteLength(JSON.stringify(caps(browse()))),scope:'finite fixture function-call smoke; no internal plan/production benchmark claim'}));
});
test('both legs reject ACL/grantor/inherited-role drift and UP/DOWN/UP restores exact baseline/profile/data',()=>{
 assert.equal(bodyHash(),evidence.proposedProsrcMd5);const upgraded=catalog();
 aclMutant(down,false);aclMutant(down,true);for(const role of ['app_tenant','authenticator'] as const)inheritedMutant(down,role);
 assert.equal(catalog(),upgraded);assert.equal(data(),baselineData);
 const repeated=catalog();assert.match(owned.psqlScriptExpectError(up),/profile changed/);assert.equal(catalog(),repeated);
 owned.script(down);assert.equal(bodyHash(),evidence.baselineProsrcMd5);assert.equal(catalog(),baselineCatalog);assert.equal(data(),baselineData);
 assert.deepEqual(parityQueries.map(query=>withoutCapability(browse(query))),parity);
 const old=catalog();assert.match(owned.psqlScriptExpectError(down),/profile changed/);assert.equal(catalog(),old);
 owned.script(up);assert.equal(bodyHash(),evidence.proposedProsrcMd5);assert.equal(catalog(),upgraded);assert.equal(data(),baselineData);positiveRoles();
});
