import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTrailmarkTheme } from '../../../../packages/theme-engine/src/trailmark-theme';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../packages/theme-engine/src/theme-bundle-core';
import { SportsFactsSchema, SportsVariantFactsSchema } from '../../../../packages/commerce-core/src/trailmark-facts';
import { LiquidRenderer } from '../../../../packages/theme-engine/src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/theme-settings';
const require = createRequire(new URL('../../../../package.json', import.meta.url));
const requireEngine = createRequire(new URL('../../../../packages/theme-engine/package.json', import.meta.url));
const { JSDOM } = requireEngine('jsdom') as { JSDOM: new (html: string) => { window: Window & typeof globalThis } };
const demo = require('./apps/commerce/web/src/lib/demo/trailmark-demo.ts') as typeof import('../../../../apps/commerce/web/src/lib/demo/trailmark-demo');
const { productToLiquidDrop } = require('./apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts') as typeof import('../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop');
const { resolveCatalogDemoRoute } = require('./apps/commerce/web/src/lib/demo/catalog-demo-route.ts') as typeof import('../../../../apps/commerce/web/src/lib/demo/catalog-demo-route');
const { resolveCatalogDemoContent, resolveCatalogDemoCollection } = require('./apps/commerce/web/src/lib/demo/catalog-demo-dispatch.ts') as typeof import('../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch');
const { parsePickerVariants } = require('./apps/commerce/web/src/lib/theme-engine/variant-options-carrier.ts') as typeof import('../../../../apps/commerce/web/src/lib/theme-engine/variant-options-carrier');
const products = demo.TRAILMARK_DEMO_PRODUCTS;
assert.equal(products.length, 3);
assert.deepEqual(products.map(p => p.price), [2490,490,690]);
const productIds=new Set(products.map(product=>product.id));
for(const collection of demo.TRAILMARK_DEMO_COLLECTIONS){
  const membership=demo.TRAILMARK_DEMO_COLLECTION_PRODUCT_IDS[collection.id];
  assert.ok(Array.isArray(membership));assert.equal(membership.length,collection.product_count);
  assert.equal(new Set(membership).size,membership.length);assert.ok(membership.every(id=>productIds.has(id)));
  assert.equal(resolveCatalogDemoRoute('/collections/'+collection.handle).resourceSlug,collection.handle);
  assert.equal(resolveCatalogDemoRoute('/collections/'+collection.id).resourceSlug,collection.id);
}
for(const product of products){
  const facts = (product as unknown as Record<string, unknown>).sports;
  assert.equal(SportsFactsSchema.safeParse(facts).success,true);
  for(const variant of product.variants ?? []){const facts=(variant as unknown as Record<string,unknown>).sports;if(facts!==undefined)assert.equal(SportsVariantFactsSchema.safeParse(facts).success,true);}
  for(const src of product.images)assert.equal(existsSync(resolve('apps/commerce/web/public',src.slice(1))),true);
}
assert.equal(products[0].variants?.[1].stock,0);
assert.equal(products[0].variants?.[0].options['Grip circumference'],'84 mm');
const bundle=createTrailmarkTheme(createLetbuyyCoreLiquidThemeBundleFixture());const before=structuredClone(bundle);
const catalog=resolveCatalogDemoContent('letbuyy-ride','2.0.0',{liquidBundle:bundle})!;
assert.ok(catalog);
assert.deepEqual(catalog.collectionProductIds,demo.TRAILMARK_DEMO_COLLECTION_PRODUCT_IDS);
assert.notEqual(catalog.collectionProductIds,demo.TRAILMARK_DEMO_COLLECTION_PRODUCT_IDS);
const supplied=catalog;
for(const collection of demo.TRAILMARK_DEMO_COLLECTIONS){
  const expected=demo.TRAILMARK_DEMO_COLLECTION_PRODUCT_IDS[collection.id];
  for(const identity of [collection.id,collection.handle])assert.deepEqual(resolveCatalogDemoCollection(supplied,identity)?.map(product=>product.id),expected);
}
const firstCollection=demo.TRAILMARK_DEMO_COLLECTIONS[0].id;
assert.deepEqual(resolveCatalogDemoCollection({...supplied,collectionProductIds:{[firstCollection]:[]}},firstCollection),[]);
assert.equal(resolveCatalogDemoCollection({...supplied,collectionProductIds:{[firstCollection]:['foreign-product']}},firstCollection),null);
assert.equal(resolveCatalogDemoCollection({...supplied,collectionProductIds:{}},firstCollection),null);
assert.equal(resolveCatalogDemoCollection({...supplied,collectionProductIds:undefined},firstCollection),null);
assert.equal(resolveCatalogDemoCollection(supplied,'unknown-collection'),null);
const output=demo.withTrailmarkDemoContent({liquidBundle:bundle});assert.deepEqual(bundle,before);
assert.equal((output.liquidBundle as typeof bundle).templates.index.sections['ride-hero-index'].settings.image,'/theme-assets/trailmark/v2/activity.webp');
assert.throws(()=>demo.withTrailmarkDemoContent({liquidBundle:createLetbuyyCoreLiquidThemeBundleFixture()}),/matching versioned package/);
const assets=JSON.parse(readFileSync(new URL('./asset-provenance.json',import.meta.url),'utf8')) as {assets:Array<{bytes:number;width:number}>};
assert.equal(assets.assets.length,5);assert.ok(assets.assets.every(a=>a.bytes<=220000&&a.width<=1600));
async function verifyProjection() {
const drops = products.map(product => productToLiquidDrop(product)!);
assert.deepEqual(drops[0].sports_display, {length:'68 cm',weight:'88 g'});
assert.deepEqual((drops[0].variants as Array<Record<string,unknown>>).map(row=>row.sports_display),[
  {length:'68 cm',weight:'88 g',grip:'84 mm'},
  {length:'68 cm',weight:'88 g',grip:'88 mm'},
]);
assert.deepEqual(drops[2].sports_display,{dimensions:'72 × 24 cm'});
async function render(key:string, product:Record<string,unknown>, productList=drops){
  return new LiquidRenderer().render({
    context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'trailmark-test',path:'/'+key,previewMode:true,locale:'en-IN'},
    storeTemplate:{themeId:'letbuyy-ride',themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},
    routeTemplate:{id:key,type:key==='index'?'index':key==='product'?'product':'collection',layoutKey:'theme',sections:[]},
    liquidBundle:bundle,liquidTemplateKey:key,
    liquidContext:{shop:{name:'Synthetic Trailmark'},product,collection:{title:'Court time',products:productList},section_products:{'ride-equipment-index':productList}},
  });
}
for(const key of ['index','collection','search']){
  const result=await render(key,drops[0]);assert.equal(result.status,'rendered');assert.deepEqual(result.warnings,[]);
  const html=result.liquid!.contentForLayout;
  assert.match(html,/68 cm length/);assert.match(html,/88 g/);assert.match(html,/72 × 24 cm/);
}
const pdp=await render('product',drops[0]);assert.equal(pdp.status,'rendered');
assert.match(pdp.liquid!.contentForLayout,/Grip circumference: 84 mm/);assert.match(pdp.liquid!.contentForLayout,/Grip circumference: 88 mm/);
const pickerDom=new JSDOM(pdp.liquid!.contentForLayout);
const picker=pickerDom.window.document.querySelector('lb-variant-picker');assert.ok(picker);
const pickerVariants=parsePickerVariants(picker.getAttribute('data-variants')??undefined);
assert.deepEqual(pickerVariants.map(variant=>({id:variant.id,options:{...variant.options},stock:variant.stock})),products[0].variants!.map(variant=>({id:variant.id,options:variant.options,stock:variant.stock})));
pickerDom.window.close();
const invalid=productToLiquidDrop({...products[0],sports:{...products[0].sports,length:{value:68,unit:'garment-size'}},sports_display:{length:'Invented display'},private_supplier_cost:42} as unknown as typeof products[number])!;
assert.equal(invalid.sports,undefined);assert.equal(invalid.sports_display,undefined);assert.equal(invalid.private_supplier_cost,undefined);
const invalidHtml=(await render('collection',invalid,[invalid])).liquid!.contentForLayout;
assert.doesNotMatch(invalidHtml,/Invented display|68 cm length|garment-size/);
console.log(JSON.stringify({products:3,validatedSportsNamespaces:true,variantFactsInline:true,unavailableGripRetained:true,allLocalAssetsExist:true,demoPackageGuard:true,inputUnchanged:true,assetBudget:true,canonicalAppProjection:true,actualLiquidCards:true,actualVariantDisplay:true,invalidFactsFailClosed:true,explicitCollectionMembership:true,actualCollectionResolverPositiveAndNegative:true,canonicalPickerIdentityOptionsAndStock:true}));
}
verifyProjection().catch(error => { console.error(error); process.exitCode=1; });
