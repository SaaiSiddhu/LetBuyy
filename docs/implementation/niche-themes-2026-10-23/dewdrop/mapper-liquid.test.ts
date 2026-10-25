import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from '../../../../packages/theme-engine/node_modules/jsdom';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../../../../packages/theme-engine/src/first-party-theme-catalog';
import { LiquidRenderer } from '../../../../packages/theme-engine/src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/theme-settings';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { DEWDROP_DEMO_PRODUCTS } from '../../../../apps/commerce/web/src/lib/demo/dewdrop-demo';
import type { ProductModel } from '../../../../packages/commerce-core/src/index';
async function render(key: 'collection'|'product', models: ProductModel[] = DEWDROP_DEMO_PRODUCTS) {
  const products = models.map(p => productToLiquidDrop(p, '/store/dewdrop-test')!);
  return new LiquidRenderer().render({
    context: { storeId:'11111111-1111-4111-8111-111111111111',subdomain:'dewdrop-test',path:'/products',previewMode:true,locale:'en-IN' },
    storeTemplate:{themeId:'letbuyy-aura',themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},
    routeTemplate:{id:key,type:key,layoutKey:'theme',sections:[]},
    liquidBundle:createFirstPartyCatalogBundle('letbuyy-aura',{designVersion:'2.0.0'}),liquidTemplateKey:key,
    liquidContext:{shop:{name:'Synthetic Dewdrop'},product:products[2] ?? products[0],collection:{products},section_products:{'aura-routine-shelves-collection':products,'aura-independent-products':[]}},
  });
}
test('explicit catalog v2 preserves Aura identity and leaves default v1 captures on their existing path',()=>{
  assert.equal(createFirstPartyCatalogBundle('letbuyy-aura',{designVersion:'2.0.0'}).package.version,'2.0.0');
  assert.notEqual(createFirstPartyCatalogBundle('letbuyy-aura').package.version,'2.0.0');
  assert.equal(firstPartyThemeListings({designVersion:'2.0.0'}).find(t=>t.presetId==='aura')?.id,'7b669c70-0000-4000-8000-000000000003');
});
test('actual app mapper and unchanged depth-four Liquid renderer preserve card scalars and PDP shade identities',async()=>{
  const drop=productToLiquidDrop(DEWDROP_DEMO_PRODUCTS[2])!; const beauty=drop.beauty as {shadeCount:number;netQuantityLabel:string};
  assert.equal(beauty.shadeCount,3);assert.equal(beauty.netQuantityLabel,'6 ml');
  for(const key of ['collection','product'] as const){const r=await render(key);assert.equal(r.status,'rendered',JSON.stringify(r.warnings));assert.deepEqual(r.warnings,[]);const h=r.liquid!.contentForLayout;
    assert.match(h,/6 ml/);assert.match(h,/INR 520\.00/);
    if(key==='collection'){assert.match(h,/3 named shades/);assert.match(h,new RegExp(`/store/dewdrop-test/product/${DEWDROP_DEMO_PRODUCTS[2].id}`));}
    else{const d=new JSDOM(h).window.document;const picker=d.querySelector('lb-variant-picker')!;assert.deepEqual(JSON.parse(picker.getAttribute('data-variants')!).map((v:{id:string})=>v.id),DEWDROP_DEMO_PRODUCTS[2].variants!.map(v=>v.id));assert.deepEqual([...picker.querySelectorAll('[data-lb-variant-option]')].map(b=>b.getAttribute('data-variant-value')),['Rosewater','Pink Clay','Terracotta']);assert.match(h,/Ingredients for Rosewater · RW01/);assert.match(h,/Ingredients for Pink Clay · PC02/);}
  }
});
test('missing and malicious facts remain honest or escaped through the actual app mapper',async()=>{
  const missing=await render('product',[DEWDROP_DEMO_PRODUCTS[3]]);assert.equal(missing.status,'rendered');assert.match(missing.liquid!.contentForLayout,/Ingredient list not supplied/);assert.match(missing.liquid!.contentForLayout,/Product image not supplied/);
  const attack='<img src=x onerror="attack()"><script>attack()</script>';
  const p={...DEWDROP_DEMO_PRODUCTS[2],name:attack,beauty:{...DEWDROP_DEMO_PRODUCTS[2].beauty!,ingredients:attack,directions:attack}};
  const r=await render('product',[p]);assert.equal(r.status,'rendered');const doc=new JSDOM(r.liquid!.contentForLayout).window.document;assert.equal(doc.querySelector('script,[onerror],img[src="x"]'),null);assert.match(r.liquid!.contentForLayout,/&lt;img/);
});
