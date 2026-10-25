import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createLetbuyyApiClient } from '@letbuyy/api-client';
import { StorefrontDiscoveryQuerySchema, STOREFRONT_DISCOVERY_QUERY_KEYS, storefrontDiscoveryQueryFromEntries, type StorefrontDiscoveryQuery, type StorefrontDiscoveryMetadata } from '@letbuyy/commerce-core';
import { createFirstPartyCatalogBundle, getDefaultStorefrontThemeTemplate, DEFAULT_THEME_SETTINGS, LiquidRenderer } from '@letbuyy/theme-engine';
import { ThemeLiquidSectionSchema } from '@letbuyy/theme-engine/theme-bundle';
import { discoveryRouteQuery, scalarDiscoveryQuery } from './discovery-route-query';
import { projectDiscoveryPage, routeDiscoveryQuery, type StorefrontDiscoveryProductPage } from './storefront-discovery';
import { resolveStorefrontTemplate } from './template-resolver';
import { resolveCatalogDemoContent } from '../demo/catalog-demo-dispatch';
import { catalogDemoRoute, catalogDemoStoreId, catalogDemoSubdomain, selectCatalogDemoProducts } from './catalog-demo-data';
import { TRAILMARK_DEMO_COLLECTION_PRODUCT_IDS, TRAILMARK_DEMO_COLLECTIONS } from '../demo/trailmark-demo';
import type { StorefrontRouteContext } from './types';
Object.assign(globalThis,{React});

const storeId='11111111-1111-4111-8111-111111111111';
const collectionId='22222222-2222-4222-8222-222222222222';
const productId='33333333-3333-4333-8333-333333333333';
const variantId='44444444-4444-4444-8444-444444444444';
const rawProduct={id:productId,name:'Authoritative page product',description:'Synthetic transport fixture',price:999,currency:'INR',stock:4,images:[],metadata:{sports:{activity:'Badminton',equipmentType:'racket',length:{value:68,unit:'cm'}}},variants:[{id:variantId,title:'84 mm',price:150,inventory_qty:4,option1:'84 mm'}],product_options:[{name:'Grip circumference',position:0,values:['84 mm']}]};
const facetRows:StorefrontDiscoveryMetadata['facets']=[
    {key:'age_band',value:'6-8',label:'Merchant age recommendation',count:1},{key:'interest',value:'making',label:'Merchant making interest',count:1},
    {key:'connector',value:'usb-c',label:'USB C supplied',count:1},{key:'pack_size',value:'g:250',label:'250 g supplied',count:1},
    {key:'material',value:'Wood',label:'Wood supplied',count:1},{key:'occasion',value:'birthday',label:'Birthday supplied',count:1},{key:'recipient',value:'friend',label:'Friend supplied',count:1},
    {key:'personalization_method',value:'embroidery',label:'Embroidery supplied',count:1},{key:'routine_stage',value:'care',label:'Care supplied',count:1},
    {key:'activity',value:'Badminton',label:'Badminton supplied',count:1},{key:'equipment_type',value:'racket',label:'Racket supplied',count:1},{key:'length_unit',value:'cm',label:'Centimetres supplied',count:1},
    {key:'books_kind',value:'book',label:'Book supplied',count:1},
];
function actualModule<T>(name:string,mocks:Record<string,unknown>):T {
    const file=new URL(name,import.meta.url),requireLocal=createRequire(file);
    const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    const compiled:{exports:unknown}={exports:{}};
    new Function('require','module','exports',code)((id:string)=>Object.hasOwn(mocks,id)?mocks[id]:requireLocal(id),compiled,compiled.exports);
    return compiled.exports as T;
}
function fixture(slug='letbuyy-ride') {
    const bundle=createFirstPartyCatalogBundle(slug,{designVersion:'2.0.0'});
    const template={...getDefaultStorefrontThemeTemplate(),themeId:slug,liquidBundle:bundle,liquidRenderingCanary:true,themeSettings:DEFAULT_THEME_SETTINGS};
    const {StoreService}=actualModule<typeof import('../store-service')>('../store-service.ts',{'./api/client':{createStorefrontApiClient:()=>{throw new Error('No fixture store service');}}});
    const preview=resolveCatalogDemoContent(slug,'2.0.0',template)!;
    const store={...StoreService.getCatalogThemePreview(preview.template,'Discovery fixture'),id:storeId,subdomain:'discovery-test',selectedProductIds:[]};
    const route:StorefrontRouteContext={type:'collection',path:'/store/discovery-test/products',subdomain:'discovery-test',resourceSlug:'all-products'};
    return{store,route,bundle,template:preview.template};
}
function serviceHarness(options:{metadata?:boolean;empty?:boolean;fail?:boolean;failProducts?:boolean;status?:number;total?:number;responseCollectionId?:string;facets?:StorefrontDiscoveryMetadata['facets']}={}) {
    const calls:Array<{url:URL;init:RequestInit|undefined;defaults:RequestInit}>=[];
    const createClient=(defaults:RequestInit={})=>createLetbuyyApiClient({baseUrl:'https://gateway.example.invalid',fetch:async(input,init)=>{
        const url=new URL(String(input));calls.push({url,init,defaults});
        if(options.fail)throw new Error('private capability URL '+url);
        if(options.status)return new Response(JSON.stringify({success:false,error:{code:'UNAVAILABLE',message:'Private transport '+url}}),{status:options.status,headers:{'content-type':'application/json'}});
        const collection={id:options.responseCollectionId??collectionId,title:'Exact supplied collection',description:'Current summary',image_url:null};
        if(url.searchParams.get('resource')==='collections')return new Response(JSON.stringify({success:true,data:collection}),{headers:{'content-type':'application/json'}});
        if(options.failProducts)throw new Error('private product capability URL '+url);
        const query=StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(url.searchParams,['token','resource','pagination','ids']));
        const named=url.pathname.includes('/collections/');if(named)query.collection_id=collectionId;
        const data=options.empty||query.page>1?[]:[rawProduct];const total=options.total??1;
        const discovery={query,facets:options.facets??facetRows,matches:data.map(product=>({product_id:product.id,price:150,variant_ids:[variantId]}))};
        const body=named?{success:true,data:{collection,products:data,total,...(options.metadata===false?{}:{discovery})}}:{success:true,data,meta:{total,page:query.page,per_page:query.limit,has_next:query.page*query.limit<total},...(options.metadata===false?{}:{discovery})};
        return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
    }});
    const module=actualModule<typeof import('../product-service')>('../product-service.ts',{'./api/client':{createStorefrontApiClient:createClient,storefrontReadInit:()=>({})}});
    return{...module,calls,createClient};
}
function binder(service:typeof import('../product-service')['ProductService']) {
    return actualModule<typeof import('./data-binding-engine')>('./data-binding-engine.ts',{'@/lib/product-service':{ProductService:service}}).buildSectionDataPlan;
}
function compositor() {
    const forbidden=()=>{throw new Error('Unexpected live compositor effect');};
    return actualModule<typeof import('./composition-engine')>('./composition-engine.tsx',{
        'next/headers':{headers:forbidden},'@/lib/content-service':{ContentService:{listPolicies:async()=>[]}},
        '@/lib/customer-drop':{getStorefrontCustomerDrop:async()=>null},'@/lib/buyer-order-drop':{getStorefrontBuyerAccountDrop:forbidden,getStorefrontBuyerOrderDrop:forbidden,getStorefrontBuyerWishlistDrop:async()=>({authenticated:false,linked:false,productIds:[],products:[]})},
        '@/lib/api/client':{createStorefrontApiClient:forbidden,storefrontReadInit:forbidden},'./collection-discovery':{loadCollectionDiscovery:forbidden},
        '@/lib/product-service':{ProductService:new Proxy({},{get:()=>forbidden})},
        './liquid-hydration-islands':{default:()=>null},'./renderer-registry':{renderRegisteredSection:forbidden},'./product-origin-filter':{StorefrontProductOriginFilter:()=>null},
    });
}

test('canonical route parser retains all query keys and repeated connectors; invalid scalar repeats/unknowns fail explicitly',()=>{
    const values=new URLSearchParams('search=hub&category=Desk&country_of_origin=IN&page=2&limit=1&sort=price-asc&connector=usb-c&connector=hdmi&activity=Badminton&length_value=68&length_unit=cm&theme_preview_token=private');
    const parsed=discoveryRouteQuery(values);assert.deepEqual(parsed.connector,['usb-c','hdmi']);assert.equal(parsed.country_of_origin,'IN');assert.equal(parsed.page,2);assert.equal(parsed.limit,1);
    assert.equal(Object.hasOwn(parsed,'theme_preview_token'),false);assert.equal(Object.hasOwn(scalarDiscoveryQuery(parsed),'connector'),false);
    for(const input of [new URLSearchParams('page=1&page=2'),{search:['one','two']},{unknown_filter:'x'},{length_value:'68'},{power_output_w:'NaN'},{theme_preview_token:['one','two']},{theme_preview_token:'x'.repeat(201)}])assert.throws(()=>discoveryRouteQuery(input),/Check the product filter/);
    assert.equal(discoveryRouteQuery({q:'hub'}).search,'hub');assert.throws(()=>discoveryRouteQuery({q:'hub',search:'different'}));
    assert.ok(STOREFRONT_DISCOVERY_QUERY_KEYS.includes('books_ruling'));
});

test('actual ProductService→SDK forwards arrays/all niche values and preserves response metadata and persisted price',async()=>{
    const h=serviceHarness();const query=discoveryRouteQuery({search:'hub',category:'Desk',country_of_origin:'IN',connector:['usb-c','hdmi'],age_band:'6-8',pack_size:'g:250',material:'Wood',occasion:'birthday',personalization_method:'embroidery',routine_stage:'care',activity:'Badminton',books_kind:'book',limit:'2'});
    const page=await h.ProductService.getProductPage('discovery-test',query);
    assert.deepEqual(h.calls[0].url.searchParams.getAll('connector'),['usb-c','hdmi']);
    for(const key of STOREFRONT_DISCOVERY_QUERY_KEYS){const value=query[key];if(value!==undefined&&!Array.isArray(value))assert.equal(h.calls[0].url.searchParams.get(key),String(value),key);}
    assert.equal(page.data[0].price,999);assert.equal(page.discovery?.matches[0].price,150);assert.deepEqual(page.discovery?.matches[0].variant_ids,[variantId]);assert.deepEqual(page.discovery?.facets,facetRows);
});

test('signed discovery uses only token-scoped no-store endpoint; failure never retries public or retains capability',async()=>{
    const h=serviceHarness();await h.ProductService.getProductPage('private-store',discoveryRouteQuery({collection_id:collectionId,connector:['usb-c','hdmi']}),'signed-private-capability');
    assert.match(h.calls[0].url.pathname,/private-store\/theme-preview$/);assert.equal(h.calls[0].url.searchParams.get('token'),'signed-private-capability');assert.equal(h.calls[0].url.searchParams.get('collection_id'),collectionId);assert.equal(h.calls[0].defaults.cache,'no-store');assert.equal(h.calls.length,1);
    const failed=serviceHarness({fail:true});await assert.rejects(failed.ProductService.getProductPage('private-store',{},'signed-private-capability'),error=>{assert.doesNotMatch(String(error)+(error instanceof Error?String(error.cause):''),/signed-private-capability/);return true;});assert.equal(failed.calls.length,1);assert.match(failed.calls[0].url.pathname,/theme-preview$/);
});

test('binder preserves exact empty/past-end pages and page metadata, never selected-product/catalog fallback',async()=>{
    const f=fixture();const h=serviceHarness({empty:true,total:4});const build=binder(h.ProductService);
    const route={...f.route,discoveryQuery:discoveryRouteQuery({page:'9',limit:'2',connector:['usb-c','hdmi']})};
    const plan=resolveStorefrontTemplate({...f.store,selectedProductIds:[productId]},route);
    const data=await build({store:{...f.store,selectedProductIds:[productId]},route,sections:plan.template.sections});
    assert.equal(h.calls.length,1);for(const row of data.values()){assert.deepEqual(row.products,[]);assert.equal(row.pagination?.total,4);assert.equal(row.pagination?.page,9);}
    const direct=await build({store:f.store,route:f.route,sections:plan.template.sections,preloadedProducts:[]});for(const row of direct.values())assert.deepEqual(row.products,[]);assert.equal(h.calls.length,1);
});

test('missing capability stays hidden, selected unsupported niche filters and malformed responses fail closed',async()=>{
    const h=serviceHarness({metadata:false});const query=discoveryRouteQuery({size:'M'});const page=await h.ProductService.getProductPage('discovery-test',query);
    const drop=projectDiscoveryPage(page,'/products',query);assert.equal(drop.collection.capabilities.discovery,false);assert.equal(drop.collection.capabilities.toys_filters,false);assert.deepEqual(drop.collection.toy_facets.age_bands,[]);assert.equal(drop.shop.gift_discovery_enabled,false);
    await assert.rejects(h.ProductService.getProductPage('discovery-test',{age_band:'6-8'}),/filters are unavailable/);
    const malformed=serviceHarness({facets:[{key:'age_band',value:'unsupported-age',label:'Invalid supplied age',count:1}]});await assert.rejects(malformed.ProductService.getProductPage('discovery-test',{}),/catalogue read failed/);
    const failing=serviceHarness({fail:true});const f=fixture();await assert.rejects(binder(failing.ProductService)({store:f.store,route:f.route,sections:resolveStorefrontTemplate(f.store,f.route).template.sections}),/catalogue read failed/);assert.equal(failing.calls.length,1);
});

test('same response builds real facets/counts, array-preserving pagination and paired length/individual filter clearing',async()=>{
    const h=serviceHarness({total:5,facets:facetRows.map(row=>({...row,count:4}))});const query=discoveryRouteQuery({search:'hub',category:'Desk',country_of_origin:'IN',connector:['usb-c','hdmi'],length_value:'68',length_unit:'cm',limit:'1'});const page=await h.ProductService.getProductPage('discovery-test',query);
    const drop=projectDiscoveryPage(page,'/products',query);const next=new URL(drop.collection.pagination.next_url!,'https://shop.invalid');assert.deepEqual(next.searchParams.getAll('connector'),['hdmi','usb-c']);for(const key of ['search','category','country_of_origin','length_value','length_unit','limit'])assert.equal(next.searchParams.get(key),String(query[key as keyof StorefrontDiscoveryQuery]));
    const remove=drop.collection.active_filters.find(filter=>filter.key==='connector'&&filter.value==='usb-c')!;assert.deepEqual(new URL(remove.clear_url,'https://shop.invalid').searchParams.getAll('connector'),['hdmi']);
    const length=drop.collection.active_filters.find(filter=>filter.key==='length_value')!;const clear=new URL(length.clear_url,'https://shop.invalid');assert.equal(clear.searchParams.has('length_unit'),false);assert.equal(clear.searchParams.has('length_value'),false);assert.equal(clear.searchParams.get('country_of_origin'),'IN');
    assert.equal(drop.collection.pagination.total,5);assert.equal(drop.collection.capabilities.toys_age_band,true);assert.equal(drop.collection.toy_facets.age_bands[0].count,4,'facet count comes from the full matching scope, not the one-row page');
});

test('actual binder→compositor consumes one page for collection/search and exposes matching witnesses without replacing price',async()=>{
    for(const type of ['collection','search'] as const){const f=fixture(),h=serviceHarness({total:3});const query=discoveryRouteQuery({search:'racket',connector:['usb-c','hdmi'],limit:'1'});const route={...f.route,type,discoveryQuery:query,searchParams:scalarDiscoveryQuery(query)};const plan=resolveStorefrontTemplate(f.store,route);const data=await binder(h.ProductService)({store:f.store,route,sections:plan.template.sections});
        const context=await compositor().buildLiquidCommerceContext({store:f.store,plan,sectionData:data,customer:null,buyerWishlist:{authenticated:false,buyerId:null,linked:false,unavailable:false,storeAccountUnavailable:false,productIds:[],products:[]},productBasePath:'',discoveredCollections:[]});
        const collection=context.collection as Record<string,unknown>;const products=collection.products as Array<Record<string,unknown>>;assert.equal(products[0].price,999);assert.equal(products[0].matching_price,150);assert.deepEqual(products[0].matching_variant_ids,[variantId]);assert.equal(collection.total,3);assert.equal(h.calls.length,1);
        if(type==='search')assert.equal((context.search as Record<string,unknown>).results_count,3);
        assert.deepEqual((context.request?.query as StorefrontDiscoveryQuery).connector,['usb-c','hdmi']);assert.doesNotMatch(JSON.stringify(context),/signed-private-capability/);
    }
});

test('actual nine Liquid collection sections and depth4 preserve supplied toy row values/labels/count/selection',async()=>{
    for(const slug of ['letbuyy-bloom','letbuyy-forge','letbuyy-refresh','letbuyy-craft','letbuyy-summit','letbuyy-nova','letbuyy-aura','letbuyy-ride','letbuyy-dawn']){
        const f=fixture(slug),h=serviceHarness();const query=discoveryRouteQuery({age_band:'6-8',interest:'making'});const route={...f.route,discoveryQuery:query,searchParams:scalarDiscoveryQuery(query)};const plan=resolveStorefrontTemplate(f.store,route);const data=await binder(h.ProductService)({store:f.store,route,sections:plan.template.sections});
        const context=await compositor().buildLiquidCommerceContext({store:f.store,plan,sectionData:data,customer:null,buyerWishlist:{authenticated:false,buyerId:null,linked:false,unavailable:false,storeAccountUnavailable:false,productIds:[],products:[]},productBasePath:'/store/discovery-test',discoveredCollections:[]});
        const bundle=structuredClone(f.bundle);const proofSchema=ThemeLiquidSectionSchema.parse({name:'Test depth proof',settings:[],blocks:[],presets:[]});bundle.sections['facet-proof']={path:'sections/facet-proof.liquid',schema:proofSchema,source:'<output>{% for row in collection.toy_facets.age_bands %}{{ row.value }}|{{ row.label }}|{{ row.count }}|{{ row.selected }}{% endfor %}/{% for row in collection.toy_facets.interests %}{{ row.value }}|{{ row.label }}|{{ row.count }}|{{ row.selected }}{% endfor %}</output>'+`{% schema %}${JSON.stringify(proofSchema)}{% endschema %}`};bundle.templates.collection.sections['facet-proof']={type:'facet-proof',settings:{},blocks:{},block_order:[],disabled:false};bundle.templates.collection.order.push('facet-proof');
        const result=await new LiquidRenderer().render({context:{storeId,subdomain:f.store.subdomain,path:route.path,previewMode:false,locale:'en-IN'},storeTemplate:{themeId:slug,themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},routeTemplate:{id:'collection',type:'collection',layoutKey:'theme',sections:[]},liquidBundle:bundle,liquidTemplateKey:'collection',liquidContext:context});
        assert.equal(result.status,'rendered',slug);assert.deepEqual(result.warnings,[],slug);assert.match(result.liquid!.contentForLayout,/Authoritative page product/,slug);assert.match(result.liquid!.contentForLayout,/6-8\|Merchant age recommendation\|1\|true/,slug);assert.match(result.liquid!.contentForLayout,/making\|Merchant making interest\|1\|true/,slug);
    }
});

test('trusted demo stays no-network with exact/intentional-empty membership; typed unsupported arrays cannot broaden it',async()=>{
    const f=fixture();const context=resolveCatalogDemoContent('letbuyy-ride','2.0.0',f.template,'/collections/'+ '7b669c70-8620-4000-8000-000000000002')!;
    const store={...f.store,id:catalogDemoStoreId(context),subdomain:catalogDemoSubdomain(context)};const route=catalogDemoRoute(context);let calls=0;const service=new Proxy({},{get:()=>async()=>{calls++;throw new Error('Forbidden demo network');}});
    const build=binder(service as typeof import('../product-service')['ProductService']);const plan=resolveStorefrontTemplate(store,route);const data=await build({store,route,sections:plan.template.sections,catalogDemo:context});assert.equal(calls,0);assert.ok([...data.values()].every(row=>row.products?.length===1&&row.products[0].id===context.products[0].id));
    const unsupported=resolveCatalogDemoContent('letbuyy-ride','2.0.0',f.template,'/products?connector=usb-c&connector=hdmi')!;const unsupportedRoute=catalogDemoRoute(unsupported);assert.throws(()=>selectCatalogDemoProducts(unsupported,unsupportedRoute),/filters are unavailable/);assert.equal(calls,0);
    // Mutate only this test process's source fixture before the trusted dispatcher clones it.
    // The original export is restored immediately; no source file or merchant data is changed.
    const emptyId=TRAILMARK_DEMO_COLLECTIONS[0].id,previous=TRAILMARK_DEMO_COLLECTION_PRODUCT_IDS[emptyId];
    TRAILMARK_DEMO_COLLECTION_PRODUCT_IDS[emptyId]=[];
    let empty:ReturnType<typeof resolveCatalogDemoContent>;
    try{empty=resolveCatalogDemoContent('letbuyy-ride','2.0.0',f.template,'/collections/'+emptyId);}finally{TRAILMARK_DEMO_COLLECTION_PRODUCT_IDS[emptyId]=previous;}
    assert.ok(empty);const emptyRoute=catalogDemoRoute(empty),emptyStore={...store,id:catalogDemoStoreId(empty),subdomain:catalogDemoSubdomain(empty)};
    const emptyPlan=resolveStorefrontTemplate(emptyStore,emptyRoute);const emptyData=await build({store:emptyStore,route:emptyRoute,sections:emptyPlan.template.sections,catalogDemo:empty});
    assert.ok([...emptyData.values()].every(row=>row.products?.length===0));assert.equal(selectCatalogDemoProducts(empty).pagination.total,0);assert.equal(calls,0);
    await assert.rejects(build({store:f.store,route:f.route,sections:plan.template.sections}),/Forbidden demo network/);assert.equal(calls,1);
});

test('Editor scalar selected collection survives dedicated typed query and conflicts fail closed',()=>{
    const route:StorefrontRouteContext={type:'collection',path:'/products',subdomain:'owned',searchParams:{collection_id:collectionId},discoveryQuery:discoveryRouteQuery({connector:['usb-c','hdmi']})};assert.equal(routeDiscoveryQuery(route).collection_id,collectionId);assert.deepEqual(routeDiscoveryQuery(route).connector,['usb-c','hdmi']);
    assert.throws(()=>routeDiscoveryQuery({...route,discoveryQuery:discoveryRouteQuery({collection_id:productId})}),/selected collection/);
});

test('actual named collection loader uses exact response scope; private summary then SAME signed product page, with no public retry',async()=>{
    const load=(h:ReturnType<typeof serviceHarness>)=>actualModule<typeof import('./collection-discovery')>('./collection-discovery.ts',{'server-only':{},'@/lib/api/client':{createStorefrontApiClient:h.createClient},'@/lib/product-service':{ProductService:h.ProductService,mapStorefrontProduct:h.mapStorefrontProduct}}).loadNamedCollectionProductPage;
    const query=discoveryRouteQuery({connector:['usb-c','hdmi'],search:'hub',limit:'2'});
    const publicApi=serviceHarness();const publicPage=await load(publicApi)('owned',collectionId,query);
    assert.equal(publicPage?.collection.id,collectionId);assert.equal(publicPage?.page.discovery?.query.collection_id,collectionId);assert.equal(publicPage?.page.data[0].price,999);assert.equal(publicApi.calls.length,1);assert.deepEqual(publicApi.calls[0].url.searchParams.getAll('connector'),['usb-c','hdmi']);
    const privateApi=serviceHarness();const privatePage=await load(privateApi)('private-owned',collectionId,query,'signed-private-capability');
    assert.equal(privatePage?.page.discovery?.query.collection_id,collectionId);assert.equal(privateApi.calls.length,2);for(const call of privateApi.calls){assert.match(call.url.pathname,/private-owned\/theme-preview$/);assert.equal(call.url.searchParams.get('token'),'signed-private-capability');assert.equal(call.defaults.cache,'no-store');}
    assert.equal(privateApi.calls[1].url.searchParams.get('resource'),'products');assert.equal(privateApi.calls[1].url.searchParams.get('collection_id'),collectionId);
    const failed=serviceHarness({failProducts:true});await assert.rejects(load(failed)('private-owned',collectionId,query,'signed-private-capability'),error=>{assert.doesNotMatch(String(error),/signed-private-capability/);return true;});assert.equal(failed.calls.length,2);assert.ok(failed.calls.every(call=>call.url.pathname.endsWith('/theme-preview')));
    const missing=serviceHarness({status:404});assert.equal(await load(missing)('owned',collectionId,query),null);assert.equal(missing.calls.length,1);
    const wrongScope=serviceHarness({responseCollectionId:productId});await assert.rejects(load(wrongScope)('owned',collectionId,query),/Check the product filter/);
    const conflict=serviceHarness();await assert.rejects(load(conflict)('owned',collectionId,{collection_id:productId}),/Check the product filter/);assert.equal(conflict.calls.length,1);
});

type RouteModule = {
    default: (props: {params: Promise<{subdomain:string;slug:string}>;searchParams?: Promise<Record<string,string|string[]|undefined>>}) => Promise<React.ReactNode>;
    generateMetadata: (props: {params: Promise<{subdomain:string;slug:string}>;searchParams?: Promise<Record<string,string|string[]|undefined>>}) => Promise<unknown>;
};
function routeHarness(name:string,h:ReturnType<typeof serviceHarness>,options:{token?:string;missingPrivateStore?:boolean}={}) {
    const f=fixture(),storeReads:string[]=[];
    const Collection=actualModule<typeof import('./collection-discovery')>('./collection-discovery.ts',{'server-only':{},'@/lib/api/client':{createStorefrontApiClient:h.createClient},'@/lib/product-service':{ProductService:h.ProductService,mapStorefrontProduct:h.mapStorefrontProduct}});
    const Composition=()=>null;
    const module=actualModule<RouteModule>(name,{
        '@/lib/store-service':{StoreService:{getStoreBySubdomain:async()=>{storeReads.push('public');return f.store;},getPreviewStoreBySubdomain:async()=>{storeReads.push('private');return options.missingPrivateStore?null:f.store;}}},
        'next/navigation':{notFound:()=>{throw new Error('NOT_FOUND');}},
        '@/lib/theme-preview-server':{resolveThemePreviewToken:async()=>options.token??''},
        '@/lib/theme-engine/data-binding-engine':{buildSectionDataPlan:binder(h.ProductService)},
        '@/lib/theme-engine/collection-discovery':Collection,
        '@/lib/theme-engine/composition-engine':{__esModule:true,default:Composition},
        '@/lib/seo':{buildStoreMetadata:()=>({title:'Scoped metadata'}),buildStoreJsonLd:()=>({}),buildBreadcrumbJsonLd:()=>({})},
    });
    const props={params:Promise.resolve({subdomain:f.store.subdomain,slug:collectionId}),searchParams:Promise.resolve({search:'racket',connector:['usb-c','hdmi'],limit:'1',theme_preview_token:options.token})};
    const find=(node:React.ReactNode):Record<string,unknown>|undefined=>{
        if(!React.isValidElement<Record<string,unknown>>(node))return undefined;
        if(node.type===Composition)return node.props;
        return React.Children.toArray(node.props.children as React.ReactNode).map(find).find(Boolean);
    };
    return{module,props,find,storeReads};
}

test('actual products/shop/search/named route adapters retain multivalues through binder→SDK and preserve exact response page',async()=>{
    for(const name of ['../../app/store/[subdomain]/products/page.tsx','../../app/store/[subdomain]/shop/page.tsx','../../app/store/[subdomain]/search/page.tsx','../../app/store/[subdomain]/collections/[slug]/page.tsx']){
        const h=serviceHarness(),route=routeHarness(name,h);const props=route.find(await route.module.default(route.props));assert.ok(props,name);
        const plan=props.plan as ReturnType<typeof resolveStorefrontTemplate>;assert.deepEqual(plan.route.discoveryQuery?.connector,['usb-c','hdmi'],name);
        assert.ok(h.calls.length>0,name);for(const call of h.calls)assert.deepEqual(call.url.searchParams.getAll('connector'),['usb-c','hdmi'],name);
        assert.equal(h.calls.length,1,'named route preloads SAME page without a second binder fetch');assert.deepEqual(route.storeReads,['public']);
        const data=props.sectionData as Map<string,import('./types').SectionRenderData>;assert.ok([...data.values()].some(row=>row.products?.[0].id===productId),name);
    }
});

test('actual signed route bodies and metadata retain private store authority; absent private store never falls back public',async()=>{
    for(const name of ['../../app/store/[subdomain]/products/page.tsx','../../app/store/[subdomain]/shop/page.tsx','../../app/store/[subdomain]/search/page.tsx','../../app/store/[subdomain]/collections/[slug]/page.tsx']){
        const h=serviceHarness(),route=routeHarness(name,h,{token:'signed-private-capability'});
        assert.ok(route.find(await route.module.default(route.props)),name);await route.module.generateMetadata(route.props);
        assert.ok(route.storeReads.length>=2,name);assert.ok(route.storeReads.every(read=>read==='private'),name);
        for(const call of h.calls){assert.match(call.url.pathname,/theme-preview$/,name);assert.equal(call.url.searchParams.get('token'),'signed-private-capability');assert.equal(call.defaults.cache,'no-store');}
        const unavailable=routeHarness(name,serviceHarness(),{token:'signed-private-capability',missingPrivateStore:true});await assert.rejects(unavailable.module.default(unavailable.props),/NOT_FOUND/,name);assert.deepEqual(unavailable.storeReads,['private'],name);
    }
});

test('toy individual capabilities require supplied options, never selected query defaults or zero-count synthetic rows',async()=>{
    const query=discoveryRouteQuery({age_band:'6-8',interest:'making'});
    for(const supplied of [[],facetRows.filter(row=>row.key==='age_band'),facetRows.filter(row=>row.key==='interest')]){
        const h=serviceHarness({facets:supplied}),page=await h.ProductService.getProductPage('owned',query),drop=projectDiscoveryPage(page,'/products',query);
        assert.equal(drop.collection.capabilities.discovery,true);assert.equal(drop.collection.capabilities.toys_age_band,supplied.some(row=>row.key==='age_band'));assert.equal(drop.collection.capabilities.toys_interest,supplied.some(row=>row.key==='interest'));assert.equal(drop.collection.capabilities.toys_filters,supplied.length>0);
        assert.deepEqual(drop.collection.toy_facets.age_bands.map(row=>row.value),supplied.filter(row=>row.key==='age_band').map(row=>row.value));assert.deepEqual(drop.collection.toy_facets.interests.map(row=>row.value),supplied.filter(row=>row.key==='interest').map(row=>row.value));
        assert.equal(drop.collection.active_filters.length,2,'selected filters remain clearable even when options are absent');
    }
});
