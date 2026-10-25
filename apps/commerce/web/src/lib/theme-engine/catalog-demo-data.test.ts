import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderToReadableStream, renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, getDefaultStorefrontThemeTemplate } from '@letbuyy/theme-engine';
import { resolveCatalogDemoContent, type CatalogDemoContent } from '../demo/catalog-demo-dispatch';
import { assertCatalogDemoContext, assertCatalogDemoScope, catalogDemoPage, catalogDemoReadOnlyHtml, catalogDemoRoute, catalogDemoStoreId, catalogDemoSubdomain, selectCatalogDemoProducts } from './catalog-demo-data';
import { resolveStorefrontTemplate } from './template-resolver';
import type { StoreModel } from '@letbuyy/tenant-core';
import type { SectionRenderData } from './types';

function fixture(path='/',slug='letbuyy-sense') {
    const bundle=createFirstPartyCatalogBundle(slug,{designVersion:'2.0.0'});
    const template={...getDefaultStorefrontThemeTemplate(),themeId:slug,liquidBundle:bundle,liquidRenderingCanary:true,themeSettings:DEFAULT_THEME_SETTINGS};
    const context=resolveCatalogDemoContent(slug,'2.0.0',template as unknown as Record<string,unknown>,path)!;
    const { StoreService } = actualModule('../store-service.ts', { './api/client': { createStorefrontApiClient: () => { throw new Error('No fixture service reads'); } } }) as typeof import('../store-service');
    const normalized = StoreService.getCatalogThemePreview(context.template, context.name);
    const store:StoreModel={...normalized,id:catalogDemoStoreId(context),subdomain:catalogDemoSubdomain(context),name:context.name,logoUrl:undefined,navigation:context.navigation,selectedProductIds:context.products.map(p=>p.id)};
    return {context,store,route:catalogDemoRoute(context)};
}
function actualModule(name:string,mocks:Record<string,unknown>) {
    const file=new URL(name,import.meta.url), requireLocal=createRequire(file);
    const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    const compiledModule={exports:{}};
    new Function('require','module','exports',code)((id:string)=>Object.hasOwn(mocks,id)?mocks[id]:requireLocal(id),compiledModule,compiledModule.exports);
    return compiledModule.exports;
}
test('only dispatcher-created context is accepted; tenant/route/JSON authority fails closed',()=>{
    const {context,store,route}=fixture();
    assert.doesNotThrow(()=>assertCatalogDemoScope(context,store.id,route));
    assert.throws(()=>assertCatalogDemoContext(JSON.parse(JSON.stringify(context)) as CatalogDemoContent),/validated server dispatcher/);
    assert.throws(()=>assertCatalogDemoScope(context,'real-merchant-id',route),/render scope/);
    assert.throws(()=>assertCatalogDemoScope(context,store.id,{...route,subdomain:'another-store'}),/render scope/);
    assert.throws(()=>assertCatalogDemoScope(context,store.id,{...route,path:'/private'}),/render scope/);
    assert.equal(catalogDemoRoute(fixture('/product/missing').context).type,'not_found');
    assert.equal(catalogDemoRoute(fixture('/collections/missing').context).type,'not_found');
    assert.equal(catalogDemoRoute(fixture('/pages/missing').context).type,'not_found');
});
test('sample search, sort, paging and collection membership come only from this immutable fixture source',()=>{
    const all=fixture('/products?sort=price-desc&limit=1&page=2');
    const selected=selectCatalogDemoProducts(all.context);
    assert.equal(selected.products.length,1);assert.equal(selected.products[0].price,3290);assert.equal(selected.pagination.total,3);assert.equal(selected.pagination.has_more,true);
    const search=fixture('/search?q=linen');assert.equal(selectCatalogDemoProducts(search.context).products.length,1);
    const empty=fixture('/search?q=unknownsample');assert.equal(selectCatalogDemoProducts(empty.context).pagination.total,0);
    const firstCollection=fixture();
    const group=fixture(`/collections/${firstCollection.context.collections[1].id}`);
    assert.equal(selectCatalogDemoProducts(group.context).products[0].name,'Tailored Straight Trouser');
    const cleanse=fixture(`/collections/${fixture('/','letbuyy-aura').context.collections[0].id}`,'letbuyy-aura');
    assert.deepEqual(selectCatalogDemoProducts(cleanse.context).products.map(product=>product.id),cleanse.context.collectionProductIds![cleanse.context.collections[0].id]);
    assert.equal(selectCatalogDemoProducts(cleanse.context).pagination.total,2);
});
test('read-only HTML removes custom-element activation and live form controls, scopes links before hydration',async()=>{
    const {context}=fixture();
    const html=await catalogDemoReadOnlyHtml('<lb-cart-drawer data-sync-url="/api/cart"><button>Open</button></lb-cart-drawer><lb-add-to-cart><button data-lb-add-to-cart>Add</button></lb-add-to-cart><form method="post" action="/api/account"><input name="email"><button>Send</button></form><a href="/product/exact?variant=medium#facts">Product</a><a href="https://provider.example.invalid/pay">Provider</a>',context);
    assert.doesNotMatch(html,/<lb-/);assert.match(html,/data-catalog-demo-inert="lb-cart-drawer"/);assert.match(html,/disabled=""/);assert.doesNotMatch(html,/action=/);assert.match(html,/inert=""/);assert.match(html,/demo_path=%2Fproduct%2Fexact/);assert.match(html,/version=2.0.0/);assert.match(html,/href="#demo-link-unavailable"/);
});
test('real canonical data builder makes zero service calls for catalog product and bound collection; live path positive control remains wired',async()=>{
    let calls=0;
    const service=new Proxy({}, {get:()=>async()=>{calls++;throw new Error('live service spy');}});
    const {buildSectionDataPlan}=actualModule('./data-binding-engine.ts',{'@/lib/product-service':{ProductService:service}}) as typeof import('./data-binding-engine');
    const base=fixture();const exact=base.context.products[1];const f=fixture(`/product/${exact.id}`);
    const plan=resolveStorefrontTemplate(f.store,f.route);
    const data=await buildSectionDataPlan({store:f.store,route:f.route,sections:plan.template.sections,catalogDemo:f.context});
    assert.ok([...data.values()].some(value=>value.product?.id===exact.id));assert.equal(calls,0);
    const boundSections=plan.template.sections.map(section=>({...section,settings:{...section.settings,collectionId:f.context.collections[0].id}}));
    const bound=await buildSectionDataPlan({store:f.store,route:f.route,sections:boundSections,catalogDemo:f.context});
    assert.ok([...bound.values()].some(value=>value.products?.length===1 && value.products[0].id===f.context.products[0].id));assert.equal(calls,0);
    const collectionFixture=fixture(`/collections/${f.context.collections[1].id}`);
    const collectionPlan=resolveStorefrontTemplate(collectionFixture.store,collectionFixture.route);
    const collectionData=await buildSectionDataPlan({store:collectionFixture.store,route:collectionFixture.route,sections:collectionPlan.template.sections,catalogDemo:collectionFixture.context});
    const renderedProducts=[...collectionData.values()].flatMap(value=>value.products || []);
    assert.ok(renderedProducts.length);assert.ok(renderedProducts.every(product=>product.id===exact.id),'default section bindings cannot broaden collection membership');
    await assert.rejects(buildSectionDataPlan({store:f.store,route:f.route,sections:plan.template.sections}),/live service spy/);assert.ok(calls>0,'positive control proves the service spy is live');
});
test('canonical Liquid compositor renders fixture products/search/content without gateway, cookies, account, policies or island/provider effects',async()=>{
    let effects=0;
    const forbidden=()=>{effects++;throw new Error('live dependency spy');};
    const service=new Proxy({}, {get:()=>forbidden});
    const {default:Compositor}=actualModule('./composition-engine.tsx',{
        'next/headers':{headers:forbidden},'@/lib/product-service':{ProductService:service},'@/lib/content-service':{ContentService:service},
        '@/lib/customer-drop':{getStorefrontCustomerDrop:forbidden},'@/lib/buyer-order-drop':{getStorefrontBuyerAccountDrop:forbidden,getStorefrontBuyerOrderDrop:forbidden,getStorefrontBuyerWishlistDrop:forbidden},
        '@/lib/api/client':{createStorefrontApiClient:forbidden,storefrontReadInit:forbidden},'./collection-discovery':{loadCollectionDiscovery:forbidden},
        './liquid-hydration-islands':{default:forbidden},'./renderer-registry':{renderRegisteredSection:forbidden},'./product-origin-filter':{StorefrontProductOriginFilter:forbidden},
    }) as typeof import('./composition-engine');
    const {buildSectionDataPlan}=actualModule('./data-binding-engine.ts',{'@/lib/product-service':{ProductService:service}}) as typeof import('./data-binding-engine');
    for(const path of ['/','/products','/search?q=linen','/pages/about','/policies/shipping','/blog','/blog/product-details','/cart','/account']){
        const f=fixture(path),plan=resolveStorefrontTemplate(f.store,f.route);
        const data:Map<string,SectionRenderData>=await buildSectionDataPlan({store:f.store,route:f.route,sections:plan.template.sections,catalogDemo:f.context});
        const result=await Compositor({store:f.store,plan,sectionData:data,catalogDemo:f.context,liquidPage:catalogDemoPage(f.context,f.route)});
        const html=renderToStaticMarkup(result);
        if(path==='/account') assert.match(html,/sample store could not render/,path);
        else assert.match(html,/data-theme-renderer="liquid"/,path);
        assert.doesNotMatch(html,/<lb-/);assert.equal(effects,0,path);
    }
    const f=fixture(),plan=resolveStorefrontTemplate(f.store,f.route);
    await assert.rejects(Compositor({store:f.store,plan,sectionData:new Map()}),/live dependency spy/);
    assert.ok(effects>0,'live storefront positive control reaches the guarded request context');
});

test('public PreviewContent bypasses private token/query reads and never mounts live cart, customer, wishlist or editor providers',async()=>{
    let effects=0;const forbidden=()=>{effects++;throw new Error('live preview effect');};
    const service=new Proxy({},{get:()=>forbidden});
    const api={createStorefrontApiClient:forbidden,storefrontReadInit:forbidden};
    const {StoreService}=actualModule('../store-service.ts',{'./api/client':{createStorefrontApiClient:forbidden,storefrontReadInit:forbidden}}) as typeof import('../store-service');
    const methods=new Proxy(StoreService,{get(target,key){return key==='getCatalogThemePreview'?target.getCatalogThemePreview:forbidden;}});
    const composition=actualModule('./composition-engine.tsx',{
        'next/headers':{headers:forbidden},'@/lib/product-service':{ProductService:service},'@/lib/content-service':{ContentService:service},
        '@/lib/customer-drop':{getStorefrontCustomerDrop:forbidden},'@/lib/buyer-order-drop':{getStorefrontBuyerAccountDrop:forbidden,getStorefrontBuyerOrderDrop:forbidden,getStorefrontBuyerWishlistDrop:forbidden},
        '@/lib/api/client':api,'./collection-discovery':{loadCollectionDiscovery:forbidden},
        './liquid-hydration-islands':{default:forbidden},'./renderer-registry':{renderRegisteredSection:forbidden},'./product-origin-filter':{StorefrontProductOriginFilter:forbidden},
    }) as typeof import('./composition-engine');
    const {default:Preview}=actualModule('../../app/preview/preview-content.tsx',{
        '@/lib/store-service':{StoreService:methods},'@/lib/product-service':{ProductService:service},
        '@/lib/content-service':{ContentService:service},'@/lib/api/client':api,
        '@/lib/theme-preview-server':{resolveThemePreviewToken:forbidden},'@/context/cart-context':{CartProvider:forbidden},
        '@/context/customer-auth-context':{CustomerAuthProvider:forbidden},'@/context/wishlist-context':{WishlistProvider:forbidden},
        '@/lib/theme-engine/collection-discovery':{loadCollectionDiscovery:forbidden},
        '@/lib/theme-engine/data-binding-engine':actualModule('./data-binding-engine.ts',{'@/lib/product-service':{ProductService:new Proxy({},{get:()=>forbidden})}}),
        './storefront-preview-bridge':{__esModule:true,default:forbidden},
        '@/lib/theme-engine/composition-engine':{__esModule:true,...composition},
        '../store/[subdomain]/liquid-theme.css':{},
    }) as typeof import('../../app/preview/preview-content');
    const f=fixture();
    const originalFetch=globalThis.fetch;
    globalThis.fetch=forbidden;
    try {
        const renderErrors:unknown[]=[];
        const stream=await renderToReadableStream(await Preview({catalogDemo:f.context,searchParams:Promise.resolve({subdomain:'victim-store',theme_preview_token:'untrusted-query-token',engine:'react'})}),{onError(error){renderErrors.push(error);}});
        await stream.allReady;
        const html=await new Response(stream).text();
        assert.deepEqual(renderErrors,[]);assert.match(html,/data-theme-renderer="liquid"/);assert.match(html,/data-catalog-demo-read-only="true"/);
        assert.ok(html.includes(f.context.products[0].name),'positive fixture content proves the actual builder and Liquid compositor rendered');
        assert.doesNotMatch(html,/<lb-|victim-store|untrusted-query-token|sample page is not ready|sample store could not render/);assert.equal(effects,0);
        await assert.rejects(Preview({catalogDemo:JSON.parse(JSON.stringify(f.context)) as CatalogDemoContent}),/validated server dispatcher/);
        assert.equal(effects,0,'a forged JSON context is rejected before any live dependency');
        await assert.rejects(Preview({searchParams:Promise.resolve({subdomain:'victim-store',theme_preview_token:'untrusted-query-token'})}),/live preview effect/);
        assert.ok(effects>0,'private preview positive control still requires its normal verified resolution');
    } finally { globalThis.fetch=originalFetch; }
});
