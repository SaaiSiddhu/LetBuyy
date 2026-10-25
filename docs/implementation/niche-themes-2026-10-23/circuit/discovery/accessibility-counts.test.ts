// Actual Liquid/JSDOM accessible-name proof. No browser, AT, SQL or network claim.
import assert from 'node:assert/strict';
import test,{after,before} from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCircuitTheme,createLetbuyyCoreLiquidThemeBundleFixture,LiquidRenderer,DEFAULT_THEME_SETTINGS} from '../../../../../packages/theme-engine/src/index';
import {StorefrontDiscoveryQuerySchema,storefrontDiscoveryQueryFromEntries,type StorefrontDiscoveryFacet,type StorefrontDiscoveryQuery,type ProductModel} from '../../../../../packages/commerce-core/src/index';
import {readStorefrontDiscoveryPayload} from '../../../../../services/api-gateway/src/lib/storefront-discovery';
import {projectDiscoveryPage,validateDiscoveryProductPage} from '../../../../../apps/commerce/web/src/lib/theme-engine/storefront-discovery';
const root=new URL('../../../../../',import.meta.url),out=new URL('./accessibility-counts/',import.meta.url);
const uiRequire=createRequire(new URL('packages/typescript/ui/package.json',root));
const {JSDOM}:typeof import('jsdom')=uiRequire('jsdom');
const nameRequire=createRequire(uiRequire.resolve('@testing-library/dom'));
const {computeAccessibleName,computeAccessibleDescription,getRole}=nameRequire('dom-accessibility-api') as {computeAccessibleName:(element:Element,options?:{computedStyleSupportsPseudoElements:boolean})=>string;computeAccessibleDescription:(element:Element)=>string;getRole:(element:Element)=>string|null};
const archive=new URL('./ui-facet-contract/green-55-before390/report.json',import.meta.url);
const baseline=JSON.parse(readFileSync(archive,'utf8')) as {rows:Array<{slug:string;route:string;query:StorefrontDiscoveryQuery;facets:StorefrontDiscoveryFacet[]}>};
const paths=['packages/theme-engine/src/circuit-discovery.ts','packages/theme-engine/src/circuit-theme.ts','packages/theme-engine/src/circuit-styles.ts','docs/implementation/niche-themes-2026-10-23/circuit/discovery/accessibility-counts.test.ts'];
const hash=(path:string)=>createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex');
const report={classification:'IN_PROCESS_LIQUID_ACCESSIBLE_NAME_AND_FORM_CONTRACT_NOT_BROWSER_AT_OR_SQL',sourceHashes:Object.fromEntries(paths.map(path=>[path,hash(path)])),networkCalls:0,choices:[] as Array<{route:string;count:number;form:number;key:string;value:string;sourceLabel:string;accessibleName:string;accessibleDescription:string;role:string|null}>};
const originalFetch=globalThis.fetch;
before(()=>{globalThis.fetch=async()=>{report.networkCalls++;throw new Error('Network forbidden');};});
after(()=>{globalThis.fetch=originalFetch;writeFileSync(new URL('report.json',out),JSON.stringify(report,null,2)+'\n');assert.equal(report.networkCalls,0);for(const path of paths)assert.equal(hash(path),report.sourceHashes[path]);});
async function render(route:'collection'|'search',count:number){
 const source=baseline.rows.find(row=>row.slug==='letbuyy-forge'&&row.route===route)!;assert.ok(source);
 const query=StorefrontDiscoveryQuerySchema.parse(source.query),facets=source.facets.map(facet=>({...facet,count}));
 const id='22222222-2222-4222-8222-222222222222',product:ProductModel={id,name:'Synthetic count fixture',description:'',price:999,currency:'INR',images:[],stock:5};
 const parsed=readStorefrontDiscoveryPayload({data:[{id,price:999}],count:6,facets,matches:[{product_id:id,price:180,variant_ids:[]}]},query);
 const page=validateDiscoveryProductPage({data:[product],total:6,page:query.page,limit:query.limit,has_more:true,discovery:parsed.discovery},query),path=route==='search'?'/search':'/products';
 const projection=projectDiscoveryPage(page,path,query),bundle=createCircuitTheme(createLetbuyyCoreLiquidThemeBundleFixture());
 const result=await new LiquidRenderer().render({context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'count-contract',path,previewMode:false,locale:'en-IN'},storeTemplate:{themeId:'letbuyy-forge',themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},routeTemplate:{id:route,type:route,layoutKey:'theme',sections:[]},liquidBundle:bundle,liquidTemplateKey:route,liquidContext:{request:{path,query},shop:{name:'Count fixture',...projection.shop},collections:[],collection:{title:'Supplied collection',products:[],...projection.collection},search:{terms:query.search,results:[],results_count:6}}});
 assert.equal(result.status,'rendered');assert.deepEqual(result.warnings,[]);
 const html=`<!doctype html><html><head><style>${result.liquid!.headStyleText??''}</style></head><body>${result.liquid!.contentForLayout}</body></html>`;writeFileSync(new URL(`${route}-count-${count}.html`,out),html);
 return {dom:new JSDOM(html,{url:'https://shop.example.invalid'+path}),facets,query};
}
for(const route of ['collection','search'] as const)for(const count of [4,1,0])test(`${route} desktop/mobile: exact source labels and meaningful ${count}-product counts remain accessible`,async()=>{
 const {dom,facets,query}=await render(route,count),forms=Array.from(dom.window.document.querySelectorAll<HTMLFormElement>('.ct-facets'));assert.equal(forms.length,2);
 assert.match(dom.window.document.querySelector('style')!.textContent!,/\.lb-sr-only\s*\{/,'use the existing clipped helper, not display:none text');
 for(const[index,form]of forms.entries()){
  for(const fieldset of form.querySelectorAll('fieldset')){const legend=fieldset.querySelector('legend')?.textContent?.trim();assert.ok(legend);assert.equal(getRole(fieldset),'group');assert.equal(computeAccessibleName(fieldset,{computedStyleSupportsPseudoElements:false}),legend);}
  for(const any of form.querySelectorAll<HTMLInputElement>('input[type=radio][value=""]'))assert.equal(computeAccessibleName(any,{computedStyleSupportsPseudoElements:false}),'Any');
  const choices=Array.from(form.querySelectorAll<HTMLInputElement>('input[type=radio],input[type=checkbox]')).filter(input=>input.value!=='');assert.equal(choices.length,facets.length);
  for(const input of choices){const facet=facets.find(facet=>facet.key===input.name&&facet.value===input.value)!;assert.ok(facet);const name=computeAccessibleName(input,{computedStyleSupportsPseudoElements:false}),description=computeAccessibleDescription(input);const text=`(${count} matching product${count===1?'':'s'})`;
   assert.equal(name,`${facet.label} ${text}`);assert.equal(getRole(input),input.name==='connector'?'checkbox':'radio');
   const label=input.closest('label')!,visual=label.querySelector('span[aria-hidden=true]')!,meaning=label.querySelector('.lb-sr-only')!;assert.equal(visual.textContent,String(count));assert.equal(meaning.textContent?.trim(),text);assert.equal(meaning.hasAttribute('aria-hidden'),false);assert.equal(input.hasAttribute('aria-label'),false);
   report.choices.push({route,count,form:index,key:input.name,value:input.value,sourceLabel:facet.label,accessibleName:name,accessibleDescription:description,role:getRole(input)});
  }
  const params=new URLSearchParams();for(const[key,value]of new dom.window.FormData(form))if(typeof value==='string')params.append(key,value);
  const submitted=StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(params));for(const[key,value]of Object.entries(query))if(key!=='page')assert.deepEqual(submitted[key as keyof StorefrontDiscoveryQuery],value,key);assert.equal(submitted.page,1);
 }
 dom.window.close();
});
