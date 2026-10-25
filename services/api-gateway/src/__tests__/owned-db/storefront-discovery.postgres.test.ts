// Complete owned schema + proposed386 upgrade + actual mounted Worker. No developer stack.
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {PRODUCT_NICHE_FACT_SCHEMAS,VARIANT_NICHE_FACT_SCHEMAS,StorefrontDiscoveryQuerySchema} from '@letbuyy/commerce-core';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,tapRest,type RestTap} from './gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,type SyntheticTenant} from './synthetic-tenant';

const owned=requireOwnedDatabase();let gateway:Gateway,proxy:OwnedPooledSqlProxy,tap:RestTap;let discoveryOutage=false;
const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
const json=(value:unknown)=>quote(JSON.stringify(value))+'::jsonb';
const root=new URL('../../../../../',import.meta.url);
const source=(name:string,draft:string)=>readFileSync(new URL(existsSync(new URL(name,root))?name:`docs/implementation/niche-themes-2026-10-23/circuit/discovery/${draft}`,root),'utf8');
const up=()=>source('database/supabase/migrations/386_storefront_discovery.sql','386.draft.sql');
const down=()=>source('database/supabase/rollback/386_storefront_discovery.rollback.sql','386.rollback.draft.sql');
before(async()=>{
 if(owned.psql("SELECT to_regprocedure('public.browse_storefront_products_v1(uuid,jsonb,uuid[])') IS NOT NULL;")!=='t')owned.script(up());
 proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));tap=tapRest(owned.restUrl,async(call,forward)=>discoveryOutage&&call.resource==='rpc/browse_storefront_products_v1'?Response.json({message:'Synthetic discovery outage',code:'XX000'},{status:500}):forward());
});
after(async()=>{await gateway?.settle();tap?.restore();await closePooledSqlClients();await proxy?.stop();});
function tenant(tag:string){const value=newSyntheticTenant(tag);seedSyntheticTenant(owned.psql,value);return value;}
function product(site:SyntheticTenant,name:string,metadata:unknown={},price=999,category='Synthetic discovery'){
 const id=randomUUID();owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,category,country_of_origin,metadata) VALUES(${quote(id)},${quote(site.siteId)},${quote(site.siteId)},${quote(name)},${quote('syn-'+id)},${price},5,true,'active',${quote(category)},'India',${json(metadata)});`);return id;
}
function options(id:string,names:string[]){for(const[index,name]of names.entries())owned.psql(`INSERT INTO product_options(product_id,name,position,values)VALUES(${quote(id)},${quote(name)},${index},'[]');`);}
function variant(site:SyntheticTenant,id:string,price:number,metadata:unknown={},values:string[]=[],stock=3){
 const key=randomUUID();owned.psql(`INSERT INTO product_variants(id,product_id,title,sku,price,inventory_qty,option1,option2,option3,metadata)VALUES(${quote(key)},${quote(id)},'Synthetic variant',${quote('PRIVATE-SKU-'+key)},${price},${stock},${values[0]?quote(values[0]):'NULL'},${values[1]?quote(values[1]):'NULL'},${values[2]?quote(values[2]):'NULL'},${json(metadata)});SELECT public.set_inventory_level_available(${quote(id)},${quote(key)},${quote(site.locationId)},${stock},NULL);`);return key;
}
function browse(site:SyntheticTenant,query:Record<string,unknown>={},ids?:string[]){const parsed=StorefrontDiscoveryQuerySchema.parse(query);return JSON.parse(owned.psql(`SELECT public.browse_storefront_products_v1(${quote(site.siteId)},${json(parsed)},${ids?`ARRAY[${ids.map(quote).join(',')}]::uuid[]`:'NULL'});`));}
const values={
 toys:{ageBands:['6-8'],interests:['art']},electronics:{kind:'hub',power_input_w:100,pass_through_output_w:85,data_rate_mbps:5000,connectors:[{kind:'usb-c',role:'host',count:1}]},
 food:{netQuantity:{value:250,unit:'g'}},furniture:{assembled:{width:61,depth:76.2,unit:'cm'},materials:['Wood'],finish:'Natural'},
 gifts:{occasions:['birthday'],recipients:['friend']},personalization:{version:1,revision:1,methods:[{id:'engrave',label:'Engrave',min_graphemes:1,max_graphemes:12,character_set:'latin-name',styles:[{id:'sans',label:'Sans'}],placements:[{id:'front',label:'Front'}]}]},
 beauty:{routineStage:'colour',format:'Tint',shadeOptionName:'Shade',shades:[{value:'Rosewater'},{value:'Clay'}]},
 sports:{activity:'badminton',equipmentType:'racket',length:{value:67.5,unit:'cm'}},books:{kind:'book',authors:['Asha Rao'],subjects:['Fiction'],language:'English',format:'paperback'},
};

test('static PostgreSQL guards agree with all nine canonical leaves and reject whole malformed namespaces without cast failures',()=>{
 for(const[namespace,schema]of Object.entries(PRODUCT_NICHE_FACT_SCHEMAS)){
  const value=values[namespace as keyof typeof values];assert.equal(schema.safeParse(value).success,true,namespace);
  for(const candidate of[value,{...value,private_key:'NEVER_PUBLIC'},null,[],{...value,schemaVersion:'invalid'}]){
   const expected=schema.safeParse(candidate).success;
   assert.equal(owned.psql(`SELECT public.storefront_discovery_facts_valid_v1(${json(candidate)},${quote(namespace)},false);`),expected?'t':'f',`${namespace}:${JSON.stringify(candidate)}`);
  }
 }
 for(const[namespace,schema]of Object.entries(VARIANT_NICHE_FACT_SCHEMAS)){
  for(const candidate of[{},values[namespace as keyof typeof values],{...values[namespace as keyof typeof values],private_key:'NEVER_PUBLIC'},null,[]])
   assert.equal(owned.psql(`SELECT public.storefront_discovery_facts_valid_v1(${json(candidate)},${quote(namespace)},true);`),schema.safeParse(candidate).success?'t':'f',`variant:${namespace}:${JSON.stringify(candidate)}`);
 }
 for(const query of[{page:0},{limit:101},{sort:'price; DROP'},{power_input_w:'bad'},{connector:['usb-c','usb-c']},{length_unit:'mm'},{min_price:20,max_price:10},{pack_size:'g:9999999999'},{unknown:'x'}])
  assert.match(owned.psqlExpectError(`SELECT public.browse_storefront_products_v1('${randomUUID()}',${json(query)});`),/Invalid storefront discovery query/);
 const invalid=[['toys',{...values.toys,ageBands:['6-8','6-8']}],['toys',{...values.toys,contentsComplete:true,contents:[]}],['electronics',{...values.electronics,power_input_w:65}],['electronics',{...values.electronics,connectors:'bad'}],['electronics',{...values.electronics,compatible_devices:[{manufacturer:'A',model:'all devices',reference:'X',source_date:'2026-02-30'}]}],['furniture',{assembled:{unit:'cm'}}],['gifts',{...values.gifts,recipients:['friend','friend']}],['personalization',{...values.personalization,methods:[{...values.personalization.methods[0],min_graphemes:20,max_graphemes:2}]}],['beauty',{...values.beauty,shades:[{value:'Rosewater'},{value:'Rosewater'}]}],['books',{kind:'book',isbn:'9780000000000'}],['books',{kind:'stationery',page_count:30,sheet_count:20}]] as const;
 for(const[namespace,value]of invalid)assert.equal(owned.psql(`SELECT public.storefront_discovery_facts_valid_v1(${json(value)},${quote(namespace)},false);`),'f',namespace);
 assert.equal(owned.psql(`SELECT public.storefront_discovery_utf16_length_v1('अA😀');`),'4');
 assert.equal(owned.psql(`SELECT public.storefront_discovery_date_v1('2026-02-30');`),'f');
});

test('one AVAILABLE canonical variant must satisfy size, color, price and food pack together; product quantity never fills a missing variant fact',()=>{
 const site=tenant('disco-same'),id=product(site,'Synthetic combined',{food:{netQuantity:{value:999,unit:'g'}}});options(id,['Size','Color']);
 const small=variant(site,id,180,{food:{netQuantity:{value:250,unit:'g'}}},['M','Red']),large=variant(site,id,340,{food:{netQuantity:{value:500,unit:'g'}}},['L','Blue']);
 variant(site,id,100,{food:{netQuantity:{value:500,unit:'g'}}},['M','Blue'],0);variant(site,id,200,{},['XL','Green']);
 for(const query of[{size:'M',color:'Blue'},{size:'M',pack_size:'g:500'},{color:'Blue',max_price:200},{pack_size:'g:999'}])assert.equal(browse(site,query).count,0,JSON.stringify(query));
 const result=browse(site,{pack_size:'g:500',max_price:400,color:'Blue'});assert.equal(result.count,1);assert.equal(result.data[0].price,999);
 assert.deepEqual(result.matches,[{product_id:id,price:340,variant_ids:[large]}]);assert.notEqual(small,large);
 const simple=product(site,'Synthetic no variants',{food:{netQuantity:{value:250,unit:'g'}}},180);
 assert.deepEqual(browse(site,{pack_size:'g:250',max_price:200},[simple]).matches,[{product_id:simple,price:180,variant_ids:[]}]);
});

test('variant toy ranges/interests resolve together and explicit empty overrides never inherit a different age',()=>{
 const site=tenant('disco-toys'),id=product(site,'Synthetic toys',{toys:values.toys});
 variant(site,id,100,{toys:{ageBands:['3-5'],interests:['art']}});variant(site,id,200,{toys:{ageBands:['9-12'],interests:['building']}});variant(site,id,150,{toys:{ageBands:[],interests:[]}});
 assert.equal(browse(site,{age_band:'3-5',interest:'building'}).count,0);assert.equal(browse(site,{age_band:'6-8'}).count,0);assert.equal(browse(site,{age_band:'3-5',interest:'art',max_price:150}).count,1);
});

test('furniture dimension groups keep their own units and combined dimensions/material/finish use one variant',()=>{
 const site=tenant('disco-room'),id=product(site,'Synthetic furniture',{furniture:values.furniture});
 const a=variant(site,id,200,{furniture:{assembled:{width:24,depth:30,unit:'in'},materials:['Wood'],finish:'Natural'}});
 variant(site,id,100,{furniture:{assembled:{width:70,depth:60,unit:'cm'},materials:['Metal'],finish:'Black'}});
 assert.equal(browse(site,{max_width_cm:61,max_depth_cm:61}).count,0);assert.equal(browse(site,{material:'Wood',finish:'Black'}).count,0);
 assert.deepEqual(browse(site,{max_width_cm:61,max_depth_cm:76.3,material:'wood',finish:'natural'}).matches[0].variant_ids,[a]);
});

test('book edition language/format/price and sports physical length use exact available variant witnesses',()=>{
 const site=tenant('disco-edition'),book=product(site,'Synthetic print',{books:values.books});
 variant(site,book,200,{books:{kind:'book',language:'English',format:'paperback'}});
 const hindi=variant(site,book,450,{books:{kind:'book',language:'Hindi',format:'hardback'}});
 assert.equal(browse(site,{books_language:'English',books_format:'hardback'}).count,0);assert.equal(browse(site,{books_language:'Hindi',max_price:300}).count,0);
 assert.deepEqual(browse(site,{books_language:'Hindi',books_format:'hardback',books_author:'Asha',books_subject:'Fiction'}).matches[0].variant_ids,[hindi]);
 const equipment=product(site,'Synthetic racket',{sports:values.sports});const metric=variant(site,equipment,200,{sports:{length:{value:675,unit:'mm'}}});variant(site,equipment,150,{sports:{length:{value:27,unit:'in'}}});
 assert.equal(browse(site,{activity:'badminton',length_value:67.5,length_unit:'cm',max_price:180}).count,0);
 assert.deepEqual(browse(site,{activity:'badminton',equipment_type:'racket',length_value:.675,length_unit:'m'}).matches[0].variant_ids,[metric]);
});

test('beauty shade is the actual named option on the same available variant and invalid references never become claims',()=>{
 const site=tenant('disco-shade'),id=product(site,'Synthetic tint',{beauty:values.beauty});options(id,['Shade']);
 const rose=variant(site,id,200,{},['Rosewater']);variant(site,id,100,{},['Clay'],0);
 assert.equal(browse(site,{shade:'Clay'}).count,0);assert.equal(browse(site,{shade:'Rosewater',max_price:150}).count,0);
 assert.deepEqual(browse(site,{shade:'Rosewater',routine_stage:'colour',format:'Tint'}).matches[0].variant_ids,[rose]);
});

test('electronics units stay physically distinct; gifts and personalization use real validated merchant references',()=>{
 const site=tenant('disco-facts'),hub=product(site,'Synthetic hub',{electronics:values.electronics}),gift=product(site,'Synthetic gift',{gifts:values.gifts},1490),custom=product(site,'Synthetic custom',{personalization:values.personalization});
 assert.equal(browse(site,{power_output_w:100}).count,0);assert.equal(browse(site,{power_capacity_w:100}).count,0);
 assert.equal(browse(site,{electronics_kind:'hub',connector:['usb-c','hdmi'],power_input_w:100,pass_through_output_w:85,data_rate_mbps:5000}).data[0].id,hub);
 assert.equal(browse(site,{occasion:'birthday',recipient:'friend',max_price:1500}).data[0].id,gift);assert.equal(browse(site,{occasion:'birthday',recipient:'colleague'}).count,0);
 assert.equal(browse(site,{personalization_method:'engrave'}).data[0].id,custom);
 const bad=product(site,'Synthetic invalid',{electronics:{...values.electronics,data_rate_mbps:'5000 Mb/s'}});assert.equal(browse(site,{electronics_kind:'hub'},[bad]).count,0);
});

test('counts, matched-price order, stable ID ties, past-end pages and real facets describe the full scoped population',()=>{
 const site=tenant('disco-pages'),foreign=tenant('disco-foreign'),category='Synthetic ties';
 const ids=Array.from({length:5},()=>product(site,'Same title',{food:{netQuantity:{value:250,unit:'g'}}},180,category)).sort();product(foreign,'Same title',{food:{netQuantity:{value:250,unit:'g'}}},1,category);
 const first=browse(site,{category,pack_size:'g:250',limit:2,sort:'price-asc'}),second=browse(site,{category,pack_size:'g:250',limit:2,page:2,sort:'price-asc'}),past=browse(site,{category,pack_size:'g:250',limit:2,page:99,sort:'price-asc'});
 assert.deepEqual(first.data.map((row:{id:string})=>row.id),ids.slice(0,2));assert.deepEqual(second.data.map((row:{id:string})=>row.id),ids.slice(2,4));assert.equal(past.data.length,0);
 for(const result of[first,second,past]){assert.equal(result.count,5);assert.equal(result.facets.find((row:{key:string})=>row.key==='pack_size').count,5);}
});

test('invoker roles fail closed and collection scope never exposes another store or inactive memberships',()=>{
 const a=tenant('disco-rls-a'),b=tenant('disco-rls-b'),id=product(a,'Synthetic own'),foreign=product(b,'Synthetic foreign'),collection=randomUUID();
 owned.psql(`INSERT INTO collections(id,store_id,title,is_active)VALUES(${quote(collection)},${quote(a.siteId)},'Synthetic scoped',true);INSERT INTO collection_products(collection_id,product_id,position)VALUES(${quote(collection)},${quote(id)},0);`);
 assert.equal(browse(a,{collection_id:collection}).count,1);assert.equal(browse(b,{collection_id:collection}).count,0);assert.equal(browse(a,{},[foreign]).count,0);
 assert.match(owned.psqlExpectError(`SET ROLE anon;SELECT public.browse_storefront_products_v1(${quote(a.siteId)});`),/permission denied/);
 const profiles=JSON.parse(readFileSync(new URL('docs/implementation/niche-themes-2026-10-23/circuit/discovery/function-profiles.json',root),'utf8')) as Array<{signature:string}>;
 const grants=profiles.map(row=>`GRANT EXECUTE ON FUNCTION ${row.signature} TO app_tenant;`).join('');
 const read=(scope:string,store:string)=>owned.psql(`BEGIN;${grants}SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id',${quote(scope)},true);SELECT public.browse_storefront_products_v1(${quote(store)})->>'count';ROLLBACK;`).split('\n').filter(line=>/^\d+$/.test(line)).at(-1);
 assert.equal(read(a.siteId,a.siteId),'1','positive RLS control before denial');assert.equal(read(a.siteId,b.siteId),'0');assert.equal(read('',a.siteId),'0');
});

test('real mounted products/collection/preview reader uses one neutral RPC, safe metadata, validated input and honest outage',async()=>{
 const site=tenant('disco-http'),id=product(site,'Synthetic HTTP',{food:{netQuantity:{value:250,unit:'g'}}},180);
 const start=tap.calls.length,result=await gateway.request(`/v1/storefront/${site.subdomain}/products?pack_size=g:250&max_price=200`);
 assert.equal(result.status,200,result.text);assert.equal(result.json?.data[0].id,id);assert.equal(result.json?.discovery.matches[0].price,180);
 assert.doesNotMatch(result.text,/PRIVATE-SKU|private_key|signing_secret/);
 assert.equal(tap.calls.slice(start).filter(call=>call.resource==='rpc/browse_storefront_products_v1'||call.resource==='browse_storefront_products_v1').length,1);
 assert.equal((await gateway.request(`/v1/storefront/${site.subdomain}/products?pack_size=kg:1`)).status,400);
 assert.equal((await gateway.request(`/v1/storefront/${site.subdomain}/products?sort=price%3BDROP`)).status,400);
 const collection=randomUUID();owned.psql(`INSERT INTO collections(id,store_id,title,is_active)VALUES(${quote(collection)},${quote(site.siteId)},'Synthetic selected',true);INSERT INTO collection_products(collection_id,product_id,position)VALUES(${quote(collection)},${quote(id)},0);`);
 const collectionPage=await gateway.request(`/v1/storefront/${site.subdomain}/collections/${collection}?pack_size=g:250`);
 assert.equal(collectionPage.status,200,collectionPage.text);assert.equal(collectionPage.json?.data.products[0].id,id);assert.equal(collectionPage.json?.data.discovery.matches[0].price,180);
 const byStore=await gateway.request(`/v1/storefront/store/${site.siteId}/products?pack_size=g:250`);assert.equal(byStore.status,200,byStore.text);assert.equal(byStore.json?.discovery.matches[0].product_id,id);
 const actor=randomUUID(),email=`discovery-${actor}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES(${quote(actor)},${quote(email)},true);UPDATE sites SET custom_user_id=${quote(actor)},theme_id='letbuyy-core',published=false,status='draft' WHERE id=${quote(site.siteId)};`);
 const merchant=async(path:string,method='GET',body?:unknown)=>gateway.request(path,{method,headers:await signedIdentityHeaders(actor,email,site.siteId),...(body?{body:JSON.stringify(body)}:{})});
 const theme='/v1/themes/letbuyy-core',editor=await merchant(`${theme}/editor?store_id=${site.siteId}`);assert.equal(editor.status,200,editor.text);
 const saved=await merchant(theme+'/editor/draft','PUT',{store_id:site.siteId,template_config:{themeId:'letbuyy-core',sections:{header:{id:'header',type:'header',settings:{},blocks:[]},template:[]}},base_version:editor.json!.data.version,idempotency_key:'synthetic-discovery-draft'});assert.equal(saved.status,200,saved.text);
 const session=await merchant(theme+'/preview-session','POST',{store_id:site.siteId,ttl_seconds:900});assert.equal(session.status,201,session.text);
 const preview=`/v1/storefront/${site.subdomain}/theme-preview?resource=products&pagination=1&collection_id=${collection}&pack_size=g:250&token=${encodeURIComponent(String(session.json!.data.preview_token))}`;
 const privatePage=await gateway.request(preview);assert.equal(privatePage.status,200,privatePage.text);assert.equal(privatePage.json?.data[0].id,id);assert.equal(privatePage.json?.discovery.matches[0].price,180);assert.match(privatePage.headers.get('cache-control')??'',/private.*no-store/);
 assert.equal((await gateway.request(`/v1/storefront/${site.subdomain}/products?pack_size=g:250`)).status,404);
 assert.equal((await gateway.request(preview.replace(/token=[^&]+/,'token=forged'))).status,404);
 discoveryOutage=true;try{const failure=await gateway.request(preview);assert.equal(failure.status,500,failure.text);assert.doesNotMatch(failure.text,/XX000|Synthetic discovery outage/);}finally{discoveryOutage=false;}

});

test('386 DOWN refuses profile drift, restores exact383 and preserves data; forward replay restores the one new reader',()=>{
 const before=owned.psql(`SELECT md5(coalesce(string_agg(to_jsonb(p)::text,'' ORDER BY id),'')) FROM products p;`);
 owned.psql('ALTER TABLE public.carts ADD COLUMN fact_acceptance_version smallint;');
 assert.match(owned.psqlScriptExpectError(down()),/refuses active migration388 dependencies/);
 owned.psql('ALTER TABLE public.carts DROP COLUMN fact_acceptance_version;');
 owned.psql('GRANT EXECUTE ON FUNCTION public.browse_storefront_products_v1(uuid,jsonb,uuid[]) TO authenticated;');
 assert.match(owned.psqlScriptExpectError(down()),/profile changed/);owned.psql('REVOKE EXECUTE ON FUNCTION public.browse_storefront_products_v1(uuid,jsonb,uuid[]) FROM authenticated;');
 owned.script(down());assert.equal(owned.psql("SELECT to_regprocedure('public.browse_storefront_products_v1(uuid,jsonb,uuid[])') IS NULL;"),'t');
 const old=readFileSync(new URL('database/supabase/migrations/383_storefront_apparel_discovery.sql',root),'utf8').split('$function$')[1];
 assert.equal(owned.psql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.browse_storefront_apparel_v1(uuid,integer,integer,text,text,numeric,numeric,text,text,text,uuid,boolean,text)'::regprocedure;"),createHash('md5').update(old).digest('hex'));
 assert.equal(owned.psql(`SELECT md5(coalesce(string_agg(to_jsonb(p)::text,'' ORDER BY id),'')) FROM products p;`),before);
 owned.script(up());assert.equal(owned.psql("SELECT to_regprocedure('public.browse_storefront_products_v1(uuid,jsonb,uuid[])') IS NOT NULL;"),'t');
});
