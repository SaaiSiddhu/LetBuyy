// In-process actual Liquid DOM -> FormData -> canonical query proof. No browser/SQL/network.
import assert from 'node:assert/strict';
import test,{after,before} from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {StorefrontDiscoveryQuerySchema,storefrontDiscoveryQueryFromEntries,type StorefrontDiscoveryQuery,type StorefrontDiscoveryFacet,type ProductModel} from '../../../../../packages/commerce-core/src/index';
import {readStorefrontDiscoveryPayload} from '../../../../../services/api-gateway/src/lib/storefront-discovery';
import {projectDiscoveryPage,validateDiscoveryProductPage,type StorefrontDiscoveryProductPage} from '../../../../../apps/commerce/web/src/lib/theme-engine/storefront-discovery';
import {resolveCatalogDemoContent} from '../../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch';
import {selectCatalogDemoProducts,catalogDemoRoute} from '../../../../../apps/commerce/web/src/lib/theme-engine/catalog-demo-data';
import {createFirstPartyCatalogBundle,LiquidRenderer,DEFAULT_THEME_SETTINGS} from '../../../../../packages/theme-engine/src/index';
const requireTheme=createRequire(new URL('../../../../../packages/theme-engine/package.json',import.meta.url));
const {JSDOM}:typeof import('jsdom')=requireTheme('jsdom');
const root=new URL('../../../../../',import.meta.url),out=new URL('./ui-facet-contract/',import.meta.url);mkdirSync(out,{recursive:true});
const storeId='11111111-1111-4111-8111-111111111111',productId='22222222-2222-4222-8222-222222222222';
const product:ProductModel={id:productId,name:'Synthetic authoritative product',description:'Contract fixture',price:999,currency:'INR',stock:5,images:[]};
type Spec={slug:string;owner:string;selected:Record<string,string|number|string[]>;choices:Record<string,string[]>};
const specs:Spec[]=[
 {slug:'letbuyy-bloom',owner:'playfield',selected:{age_band:'6-8',interest:'art'},choices:{age_band:['6-8','9-12'],interest:['art','building']}},
 {slug:'letbuyy-forge',owner:'circuit',selected:{electronics_kind:'hub',connector:['usb-c','hdmi'],power_input_w:100,pass_through_output_w:85,data_rate_mbps:5000,length_mm:100},choices:{electronics_kind:['hub','charger'],connector:['usb-c','hdmi'],power_input_w:['100'],pass_through_output_w:['85'],data_rate_mbps:['5000'],length_mm:['100']}},
 {slug:'letbuyy-refresh',owner:'pantry',selected:{pack_size:'g:250'},choices:{pack_size:['g:250','g:500']}},
 {slug:'letbuyy-craft',owner:'habitat',selected:{material:'Wood',finish:'Natural',max_width_cm:61,max_depth_cm:76.3},choices:{material:['Wood','Metal'],finish:['Natural','Black']}},
 {slug:'letbuyy-summit',owner:'kindred',selected:{occasion:'birthday',recipient:'friend',min_price:100,max_price:1500},choices:{occasion:['birthday','40th-birthday'],recipient:['friend','colleague']}},
 {slug:'letbuyy-nova',owner:'madeyours',selected:{personalization_method:'engrave'},choices:{personalization_method:['engrave','embroidery']}},
 {slug:'letbuyy-aura',owner:'dewdrop',selected:{routine_stage:'colour',format:'Tint',shade:'Rosewater'},choices:{routine_stage:['colour','care'],format:['Tint','Cream'],shade:['Rosewater','Clay']}},
 {slug:'letbuyy-ride',owner:'trailmark',selected:{activity:'badminton',equipment_type:'racket',length_value:67.5,length_unit:'cm'},choices:{activity:['badminton','tennis'],equipment_type:['racket','shuttles']}},
 {slug:'letbuyy-dawn',owner:'marginalia',selected:{books_kind:'book',books_author:'Asha',books_subject:'Fiction',books_language:'English',books_format:'paperback',books_ruling:'lined'},choices:{books_kind:['book','stationery'],books_subject:['Fiction','Design'],books_language:['English','Hindi'],books_format:['paperback','hardback'],books_ruling:['lined','grid']}},
];
const common={search:'Model guide',category:'Accessories',country_of_origin:'India',connector:['usb-c','hdmi'],sort:'price-desc',limit:1,page:2};
type Finding={check:string;message:string;selector?:string;fragment?:string};
type Row={slug:string;route:string;html:string;sourceHashes:Record<string,string>;query:StorefrontDiscoveryQuery;facets:StorefrontDiscoveryFacet[];forms:Array<{selector:string;entries:string[][]}>;findings:Finding[]};
const inputs=['docs/implementation/niche-themes-2026-10-23/circuit/discovery/ui-facet-contract.test.ts','database/supabase/migrations/386_storefront_discovery.sql','services/api-gateway/src/lib/storefront-discovery.ts','apps/commerce/web/src/lib/theme-engine/storefront-discovery.ts','packages/commerce-core/src/storefront-discovery.ts'];
const report={inputs:Object.fromEntries(inputs.map(path=>[path,createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex')])),fixtureContract:'Actual backend response reader and frontend page validator admit synthetic finite metadata. Facet values are lowercase and labels retain source values, as386 emits. Author substring and physical threshold/unit facets are omitted as in386. No local filter algorithm or SQL acceptance is claimed.',classification:'IN_PROCESS_UI_QUERY_CONTRACT_NOT_BROWSER_SQL_OR_INSTALLED_ACCEPTANCE',createdAt:new Date().toISOString(),networkCalls:0,rows:[] as Row[]};
const originalFetch=globalThis.fetch;
before(()=>{globalThis.fetch=async()=>{report.networkCalls++;throw new Error('No network is permitted in this contract suite');};});
after(()=>{globalThis.fetch=originalFetch;writeFileSync(new URL('report.json',out),JSON.stringify(report,null,2)+'\n');assert.equal(report.networkCalls,0);});
const hash=(path:string)=>createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex');
function backendPage(spec:Spec,query:StorefrontDiscoveryQuery,metadata=true):StorefrontDiscoveryProductPage{
 const facets=Object.entries(spec.choices).flatMap(([key,values])=>values.map(value=>({key,value:value.toLowerCase(),label:value,count:4}))) as StorefrontDiscoveryFacet[];
 // The actual 386 backend emits normalized options; it deliberately omits author substring
 // and physical thresholds from facet choices. No synthetic length-unit facet is invented.
 const envelope={data:[{id:productId,price:999}],count:6,facets,matches:[{product_id:productId,price:180,variant_ids:[]}]};
 const payload=readStorefrontDiscoveryPayload(envelope,query);
 return validateDiscoveryProductPage({data:[product],total:6,page:query.page,limit:query.limit,has_more:query.page*query.limit<6,...(metadata?{discovery:payload.discovery}:{})},query);
}
function parse(params:URLSearchParams){return StorefrontDiscoveryQuerySchema.safeParse(storefrontDiscoveryQueryFromEntries(params));}
function formParams(dom:InstanceType<typeof JSDOM>,form:HTMLFormElement){const params=new URLSearchParams();for(const[key,value]of new dom.window.FormData(form))if(typeof value==='string')params.append(key,value);return params;}
function selector(el:Element){return el.tagName.toLowerCase()+(el.className?'.'+String(el.className).trim().split(/\s+/).join('.'):el.getAttribute('aria-label')?`[aria-label="${el.getAttribute('aria-label')}"]`:'');}
function sameValue(actual:unknown,expected:unknown){return JSON.stringify(Array.isArray(actual)?[...actual].sort():actual)===JSON.stringify(Array.isArray(expected)?[...expected].sort():expected);}
async function render(spec:Spec,route:'collection'|'search',query:StorefrontDiscoveryQuery,metadata=true){
 const bundle=createFirstPartyCatalogBundle(spec.slug,{designVersion:'2.0.0'}),path=route==='search'?'/search':'/products',page=backendPage(spec,query,metadata),projection=projectDiscoveryPage(page,path,query);
 const drop={id:productId,title:product.name,price:product.price,currency:'INR',url:'/products/synthetic',images:[],available:true};
 const result=await new LiquidRenderer().render({context:{storeId,subdomain:'facet-contract',path,previewMode:false,locale:'en-IN',searchParams:query as unknown as Record<string,string>},storeTemplate:{themeId:spec.slug,themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},routeTemplate:{id:route,type:route,layoutKey:'theme',sections:[]},liquidBundle:bundle,liquidTemplateKey:route,liquidContext:{request:{path,query:projection.query},shop:{name:'Synthetic contract store',...projection.shop},collections:[],collection:{title:'Supplied collection',products:[drop],...projection.collection},products:[drop],search:{terms:query.search??'',results:[drop],results_count:page.total},section_products:Object.fromEntries(Object.keys(bundle.templates[route].sections).map(id=>[id,[drop]]))}});
 assert.equal(result.status,'rendered');assert.deepEqual(result.warnings,[]);
 return new JSDOM(result.liquid!.contentForLayout,{url:'https://shop.example.invalid'+path});
}
function finding(row:Row,check:string,message:string,element?:Element){row.findings.push({check,message,...(element?{selector:selector(element),fragment:element.outerHTML.slice(0,1600)}:{})});}
function assertChecks(row:Row,check:string){assert.deepEqual(row.findings.filter(f=>f.check===check),[],`${row.slug} ${row.route} ${check}; inspect ui-facet-contract/report.json and actual HTML`);}
for(const spec of specs)for(const route of ['collection','search'] as const){
 let dom:InstanceType<typeof JSDOM>,row:Row,query:StorefrontDiscoveryQuery;
 test(`${spec.slug} ${route}: actual supplied fields/choices and selected values submit canonical queries`,async()=>{
  query=StorefrontDiscoveryQuerySchema.parse({...common,...spec.selected});dom=await render(spec,route,query);
  const html=`${spec.owner}-${route}.html`;writeFileSync(new URL(html,out),dom.serialize());
  const paths=[`packages/theme-engine/src/${spec.owner}-theme.ts`,`packages/theme-engine/src/${spec.owner}-discovery.ts`,'apps/commerce/web/src/lib/theme-engine/storefront-discovery.ts','packages/commerce-core/src/storefront-discovery.ts'];
  row={slug:spec.slug,route,html,query,facets:backendPage(spec,query).discovery!.facets,sourceHashes:Object.fromEntries(paths.map(p=>[p,hash(p)])),forms:[],findings:[]};report.rows.push(row);
  const forms=Array.from(dom.window.document.forms);
  for(const form of forms){const params=formParams(dom,form);row.forms.push({selector:selector(form),entries:[...params]});const parsed=parse(params);if(!parsed.success)finding(row,'submission','Actual selected FormData is invalid: '+JSON.stringify(parsed.error.issues),form);}
  for(const[key,expected]of Object.entries(spec.selected)){
   const controls=Array.from(dom.window.document.querySelectorAll<HTMLInputElement|HTMLSelectElement>(`[name="${key}"]`)).filter(c=>c.type!=='hidden');
   if(!controls.length){finding(row,'submission',`Missing supplied ${key} control`);continue;}
   const owner=controls[0].form;if(!owner){finding(row,'submission',`Unowned ${key} control`,controls[0]);continue;}
   const submitted=parse(formParams(dom,owner));if(submitted.success&&!sameValue(submitted.data[key as keyof StorefrontDiscoveryQuery],expected))finding(row,'submission',`Selected ${key} changed: expected ${JSON.stringify(expected)}, got ${JSON.stringify(submitted.data[key as keyof StorefrontDiscoveryQuery])}`,owner);
   for(const value of spec.choices[key]??[String(expected)]){
    const clone=owner.cloneNode(true) as HTMLFormElement;const fields=Array.from(clone.querySelectorAll<HTMLInputElement|HTMLSelectElement>(`[name="${key}"]`)).filter(c=>c.type!=='hidden');
    let optionPresent=true;
    for(const field of fields){if(field.tagName==='SELECT'){const select=field as HTMLSelectElement;optionPresent=Array.from(select.options).some(o=>o.value===value);select.value=value;}else if(field.type==='checkbox'||field.type==='radio')(field as HTMLInputElement).checked=Array.isArray(expected)?expected.includes(field.value):field.value===value;else field.value=value;}
    if(!optionPresent){finding(row,'submission',`Supplied ${key}=${value} is missing from real options`,owner);continue;}
    const submittedChoice=parse(formParams(dom,clone));if(!submittedChoice.success)finding(row,'submission',`Choosing supplied ${key}=${value} yields an invalid canonical query`,clone);else if(!sameValue(submittedChoice.data[key as keyof StorefrontDiscoveryQuery],Array.isArray(expected)?expected:StorefrontDiscoveryQuerySchema.shape[key as keyof typeof StorefrontDiscoveryQuerySchema.shape].parse(value)))finding(row,'submission',`Choosing supplied ${key}=${value} does not submit that value`,clone);
   }
  }
  assertChecks(row,'submission');
 });
 test(`${spec.slug} ${route}: actual sort, independent clears and pagination preserve the full query`,()=>{
  assert.ok(dom&&row,'render completed');
  const controls=Array.from(dom.window.document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[name="sort"]')).filter(c=>c.type!=='hidden');
  if(!controls.length)finding(row,'navigation','No sort control');
  for(const control of controls){const form=control.form;if(!form)continue;const clone=form.cloneNode(true) as HTMLFormElement;const sort=clone.querySelector<HTMLInputElement|HTMLSelectElement>('[name="sort"]:not([type="hidden"])')!;sort.value='price-asc';const parsed=parse(formParams(dom,clone));
   if(!parsed.success){finding(row,'navigation','Sort FormData is invalid',clone);continue;}
   for(const[key,value]of Object.entries(query))if(!['page','sort'].includes(key)&&!sameValue(parsed.data[key as keyof StorefrontDiscoveryQuery],value))finding(row,'navigation',`Sort dropped/changed ${key}`,clone);
   if(parsed.data.page!==1)finding(row,'navigation','Sort did not reset page',clone);
  }
  const projected=projectDiscoveryPage(backendPage(spec,query),route==='search'?'/search':'/products',query);
  for(const filter of projected.collection.active_filters){
   const expectedUrl=new URL(filter.clear_url,'https://shop.example.invalid'),expected=parse(expectedUrl.searchParams);assert.ok(expected.success);
   let found=false;
   for(const link of dom.window.document.querySelectorAll<HTMLAnchorElement>('a[href]')){const candidate=new URL(link.href);if(candidate.searchParams.toString()===expectedUrl.searchParams.toString()){const parsed=parse(candidate.searchParams);if(parsed.success&&parsed.data.page===1)found=true;}}
   for(const form of Array.from(dom.window.document.forms)){const button=form.querySelector('button');if(!button||!/remove/i.test(button.textContent??''))continue;const params=formParams(dom,form);if(params.toString()===expectedUrl.searchParams.toString())found=true;else {const parsed=parse(params);if(parsed.success&&sameValue(parsed.data,expected.data))found=true;}}
   if(!found)finding(row,'navigation',`No actual independent clear preserves other values for ${filter.key}=${filter.value}`);
  }
  for(const targetPage of [1,3]){
   let found=false;for(const link of dom.window.document.querySelectorAll<HTMLAnchorElement>('a[href]')){const parsed=parse(new URL(link.href).searchParams);if(!parsed.success||parsed.data.page!==targetPage)continue;
    if(Object.entries(query).every(([key,value])=>key==='page'||sameValue(parsed.data[key as keyof StorefrontDiscoveryQuery],value)))found=true;
   }
   if(!found)finding(row,'navigation',`No actual page ${targetPage} link preserves every query value`);
  }
  assertChecks(row,'navigation');
 });
 test(`${spec.slug} ${route}: blank selections and absent/malformed capability never invent a niche request`,async()=>{
  const blankQuery=StorefrontDiscoveryQuerySchema.parse({search:common.search,category:common.category,country_of_origin:common.country_of_origin});
  const blank=await render(spec,route,blankQuery);
  for(const form of Array.from(blank.window.document.forms)){const parsed=parse(formParams(blank,form));if(!parsed.success)finding(row,'capability','Submitting initial/blank filter form produces invalid canonical query',form);}
  blank.window.close();
  const absent=await render(spec,route,blankQuery,false);
  for(const key of Object.keys(spec.selected))if(absent.window.document.querySelector(`[name="${key}"]:not([type="hidden"])`))finding(row,'capability',`Absent metadata advertises unsupported ${key}`,absent.window.document.querySelector(`[name="${key}"]`)!);
  absent.window.close();
  const valid=backendPage(spec,blankQuery),bad={...valid,discovery:{...valid.discovery,facets:[{key:'equipment_type',value:'not-supported',label:'Injected',count:1}]}};
  assert.throws(()=>validateDiscoveryProductPage(bad as StorefrontDiscoveryProductPage,blankQuery));
  assert.throws(()=>readStorefrontDiscoveryPayload({data:[],count:0,facets:null,matches:[]},blankQuery));
  assertChecks(row,'capability');dom.window.close();
 });
}

test('trusted nine-theme demos remain no-network and refuse unsupported niche facets rather than mimicking SQL',()=>{
 for(const spec of specs){const bundle=createFirstPartyCatalogBundle(spec.slug,{designVersion:'2.0.0'});const content=resolveCatalogDemoContent(spec.slug,'2.0.0',{themeId:spec.slug,liquidBundle:bundle},'/products');assert.ok(content,spec.slug);
  assert.doesNotThrow(()=>selectCatalogDemoProducts(content));assert.throws(()=>selectCatalogDemoProducts({...content}),/validated server dispatcher/i);
  const route=catalogDemoRoute(content);assert.throws(()=>selectCatalogDemoProducts(content,{...route,discoveryQuery:StorefrontDiscoveryQuerySchema.parse({connector:['usb-c','hdmi']})}),/unavailable|unsupported|clear/i,spec.slug);
 }
 assert.equal(report.networkCalls,0);
});
