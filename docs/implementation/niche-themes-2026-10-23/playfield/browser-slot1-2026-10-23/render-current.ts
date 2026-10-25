/** Current canonical factories/CSS → admitted finite discovery responses → Liquid/real assembly.
 * Static browser fixture only; no backend/SQL or hydrated commerce acceptance. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import layoutStyle from './layout-style.cjs';
import {createFirstPartyCatalogBundle,LiquidRenderer,DEFAULT_THEME_SETTINGS} from '@letbuyy/theme-engine';
import {StorefrontDiscoveryQuerySchema,storefrontDiscoveryUrl,storefrontDiscoveryQueryFromEntries,type ProductModel,type StorefrontDiscoveryQuery,type StorefrontDiscoveryFacet} from '@letbuyy/commerce-core';
import {readStorefrontDiscoveryPayload} from '../../../../../services/api-gateway/src/lib/storefront-discovery';
import {validateDiscoveryProductPage,projectDiscoveryPage} from '../../../../../apps/commerce/web/src/lib/theme-engine/storefront-discovery';
import {productToLiquidDrop} from '../../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import {assembleLiquidPageFromRenderResult} from '../../../../../apps/commerce/web/src/lib/theme-engine/liquid-page-assembly';
import {PLAYFIELD_DEMO_PRODUCTS} from '../../../../../apps/commerce/web/src/lib/demo/playfield-demo';
const root=new URL('../../../../../',import.meta.url),output=new URL('./',import.meta.url),htmlDir=new URL('rendered/',output);mkdirSync(htmlDir,{recursive:true});
const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const readJson=(path:string)=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const checkpoint='docs/implementation/niche-themes-2026-10-23/circuit/discovery/ui-facet-contract/green-55-after390-consumers-accessible-counts/';
const oracle=readJson(checkpoint+'report.json');
const sourcePaths=[...['playfield','circuit','habitat','madeyours'].flatMap(name=>[`packages/theme-engine/src/${name}-theme.ts`,`packages/theme-engine/src/${name}-discovery.ts`,`packages/theme-engine/src/${name}-styles.ts`]),'packages/theme-engine/src/first-party-theme-catalog.ts','packages/theme-engine/src/theme-bundle.ts','packages/theme-engine/src/theme-bundle-core.ts','packages/theme-engine/src/theme-renderer.ts','packages/commerce-core/src/storefront-discovery.ts','services/api-gateway/src/lib/storefront-discovery.ts','apps/commerce/web/src/lib/theme-engine/storefront-discovery.ts','apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts','apps/commerce/web/src/lib/theme-engine/liquid-page-assembly.ts','apps/commerce/web/src/lib/demo/playfield-demo.ts','apps/commerce/web/src/app/store/[subdomain]/liquid-theme.css','apps/commerce/web/src/lib/theme-engine/composition-engine.tsx','apps/commerce/web/src/app/store/[subdomain]/layout.tsx'];
const runtimeCss=readFileSync(new URL('apps/commerce/web/src/app/store/[subdomain]/liquid-theme.css',root),'utf8');
const sources=sourcePaths.map(path=>({path,sha256:sha(readFileSync(new URL(path,root)))}));
const fonts=[...['400','500','600','700'].map(weight=>({family:'Inter',weight:Number(weight),path:`docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/madeyours-storybook/assets/inter-${weight}.ttf`})),{family:'Inter',weight:800,path:'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/playfield-storybook/assets/inter-4.ttf'},...['400','700'].map(weight=>({family:'Libre Baskerville',weight:Number(weight),path:`docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/habitat-storybook/assets/fonts/libre-baskerville-${weight}.ttf`})),...['400','600'].map(weight=>({family:'Source Sans Pro',weight:Number(weight),path:`docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/habitat-storybook/assets/fonts/source-sans-pro-${weight}.ttf`}))].map((font,index)=>({...font,url:`/qa-font/${index}.ttf`,sha256:sha(readFileSync(new URL(font.path,root)))}));
const fontCss=fonts.map(font=>`@font-face{font-family:"${font.family}";font-style:normal;font-weight:${font.weight};font-display:swap;src:url('${font.url}') format('truetype')}`).join('\n');
type Case={name:string;owner:string;slug:string;route:'collection'|'search';base:string;query:StorefrontDiscoveryQuery;products:ProductModel[];facets:StorefrontDiscoveryFacet[];total:number;measurements?:unknown;primary?:boolean;purpose?:string};
const generic:ProductModel={id:'22222222-2222-4222-8222-222222222222',name:'Synthetic authoritative product',description:'Static browser contract fixture; no real record.',price:999,currency:'INR',stock:5,images:[]};
const cases:Case[]=[];const routes:Record<string,string>={};const rendered:Record<string,unknown>[]=[];
for(const owner of ['circuit','habitat','madeyours'])for(const route of owner==='circuit'?['collection','search'] as const:['search'] as const){
 const slug=owner==='circuit'?'letbuyy-forge':owner==='habitat'?'letbuyy-craft':'letbuyy-nova';
 const row=oracle.rows.find((row:{slug:string;route:string})=>row.slug===slug&&row.route===route);
 cases.push({name:`${owner}-${route}`,owner,slug,route,base:`/store/browser-${owner}`,query:StorefrontDiscoveryQuerySchema.parse(row.query),products:[generic],facets:row.facets,total:6,primary:true,purpose:'Current canonical CSS, admitted finite oracle fixture; not live SQL.'});
 if(owner==='habitat')cases.push({name:'habitat-search-physical',owner,slug,route,base:'/store/browser-habitat-physical',query:StorefrontDiscoveryQuerySchema.parse(row.query),products:[generic],facets:row.facets,total:6,measurements:row.syntheticPhysicalCapability.measurement_capabilities,primary:true,purpose:'Admitted390 capability response shape only; not real SQL qualification.'});
}
const toyFacets:StorefrontDiscoveryFacet[]=[{key:'age_band',value:'6-8',label:'6–8 years',count:1},{key:'age_band',value:'9-12',label:'9–12 years',count:1},{key:'interest',value:'art',label:'Art and making',count:1},{key:'interest',value:'building',label:'Building',count:1}];
for(const route of ['collection','search'] as const){
 const query=StorefrontDiscoveryQuerySchema.parse({page:2,limit:1,country_of_origin:'India',category:'Activities',sort:'name',age_band:'6-8',interest:'art'});
 cases.push({name:`playfield-${route}`,owner:'playfield',slug:'letbuyy-bloom',route,base:'/store/browser-playfield',query,products:[structuredClone(PLAYFIELD_DEMO_PRODUCTS[0])],facets:toyFacets,total:4,primary:true,purpose:'Positive finite adult-selection/browser form fixture, not live discovery SQL.'});
 const empty=StorefrontDiscoveryQuerySchema.parse({...query,page:1,age_band:'3-5',interest:'music'});
 cases.push({name:`playfield-${route}-empty`,owner:'playfield',slug:'letbuyy-bloom',route,base:'/store/browser-playfield',query:empty,products:[],facets:[],total:0,primary:true,purpose:'Explicit finite empty response, not a local filter algorithm.'});
}
function signature(path:string,query:unknown){return storefrontDiscoveryUrl(path,query);}
function projected(input:Case){
 const data=input.products;
 const payload=readStorefrontDiscoveryPayload({data:data.map(product=>({id:product.id,price:product.price})),count:input.total,facets:input.facets,matches:data.map(product=>({product_id:product.id,price:product.price,variant_ids:[]})),...(input.measurements?{measurement_capabilities:input.measurements}:{})},input.query);
 const page=validateDiscoveryProductPage({data,total:input.total,page:input.query.page,limit:input.query.limit,has_more:input.query.page*input.query.limit<input.total,discovery:payload.discovery},input.query);
 const path=input.base+(input.route==='collection'?'/products':'/search');return {page,projection:projectDiscoveryPage(page,path,input.query),path};
}
// Add only explicitly precomputed GET recovery pages. No dynamic filtering or invented SQL.
for(const input of [...cases]){
 const {projection,path}=projected(input);
 const targets=[storefrontDiscoveryUrl(path,input.query,{page:1}),projection.collection.clear_filters_url,...projection.collection.active_filters.map(filter=>filter.clear_url)];
 for(const [index,target]of targets.entries()){
  const url=new URL(target,'https://static.invalid');const query=StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(url.searchParams));
  let products=input.products,facets=input.facets,total=input.total;
  if(input.owner==='playfield'&&input.total===0){
   if(query.interest==='music'){products=[];facets=[];total=0;}
   else if(query.age_band==='3-5'){products=[structuredClone(PLAYFIELD_DEMO_PRODUCTS[2])];facets=[{key:'age_band',value:'3-5',label:'3–5 years',count:1},{key:'interest',value:'building',label:'Building',count:1}];total=1;}
   else {products=[structuredClone(PLAYFIELD_DEMO_PRODUCTS[0])];facets=toyFacets;total=4;}
  }
  cases.push({...input,name:`${input.name}-recovery-${index}`,query,products,facets,total,primary:false,purpose:'Pre-rendered admitted response for native GET recovery; no runtime filter implementation.'});
 }
}
async function main(){
for(const input of cases){
 const {page,projection,path}=projected(input);const key=signature(path,input.query);
 if(routes[key])continue;
 const bundle=createFirstPartyCatalogBundle(input.slug,{designVersion:'2.0.0'});
 const settings={...DEFAULT_THEME_SETTINGS,...bundle.config.settings_data.current,fontFamily:bundle.config.settings_data.current.bodyFontFamily??DEFAULT_THEME_SETTINGS.fontFamily};
 const layoutCss=layoutStyle(new URL(root).pathname,settings);
 const drops=page.data.map(product=>productToLiquidDrop(product,input.base)!);
 const result=await new LiquidRenderer().render({context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:`browser-${input.owner}`,path,previewMode:false,locale:'en-IN',searchParams:Object.fromEntries(Object.entries(input.query).filter(([,value])=>value!==undefined&&!Array.isArray(value)).map(([key,value])=>[key,String(value)]))},storeTemplate:{themeId:input.slug,themeSettings:settings,sections:[]},routeTemplate:{id:input.route,type:input.route,layoutKey:'theme',sections:[]},liquidBundle:bundle,liquidTemplateKey:input.route,liquidContext:{request:{path,query:projection.query},shop:{name:`${input.owner} isolated browser review`,...projection.shop},collection:{title:'Supplied collection',...projection.collection,products:drops},products:drops,search:{terms:input.query.search??'',results:drops,results_count:page.total},section_products:Object.fromEntries(Object.keys(bundle.templates[input.route].sections).map(id=>[id,drops]))}});
 if(result.status!=='rendered'||result.warnings.length||!result.liquid)throw Error(input.name+': '+result.warnings.join(','));
 const assembled=assembleLiquidPageFromRenderResult(result.liquid);
 const html=`<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${input.name} · isolated browser review</title><style data-offline-font-transport>${fontCss}</style><style data-app-document-reset>body{margin:0}</style><style data-current-store-layout>${layoutCss}</style><style data-current-storefront-runtime>${runtimeCss}</style><style data-current-canonical-bundle>${assembled.headStyleText}</style></head><body><div data-theme-renderer="liquid">${assembled.html}</div></body></html>`;
 const file=`${input.name}.html`;writeFileSync(new URL(file,htmlDir),html);routes[key]=file;
 rendered.push({name:input.name,owner:input.owner,slug:input.slug,route:input.route,primary:input.primary??false,path,query:input.query,url:key,file,sha256:sha(html),bundleSha256:sha(JSON.stringify(bundle)),layoutCssSha256:sha(layoutCss),runtimeCssSha256:sha(runtimeCss),bundleCssSha256:sha(assembled.headStyleText),purpose:input.purpose,metadata:projection.collection});
}
for(const source of sources)if(sha(readFileSync(new URL(source.path,root)))!==source.sha256)throw Error('Source drift: '+source.path);
writeFileSync(new URL('render-manifest.json',output),JSON.stringify({scope:'Current factories/real bundle CSS + exact shared storefront CSS/actual Liquid and canonical assembly wrapper; finite admitted discovery fixtures. No hydration, live API, SQL or commerce.',slot:1,port:43271,sources,fonts,primaryScenes:rendered.filter(row=>row.primary).map(row=>row.name),routes,rendered,metadataCheckpoint:checkpoint,offlineFontTransport:'Frozen M1 bytes for the SAME current font families. No font family/CSS edits; only deterministic local font transport.',productionSourceEdited:false},null,2)+'\n');
process.stdout.write(JSON.stringify({primary:rendered.filter(row=>row.primary).length,rendered:rendered.length,port:43271})+'\n');

}
main().catch(error=>{process.stderr.write(String(error)+"\n");process.exitCode=1;});
