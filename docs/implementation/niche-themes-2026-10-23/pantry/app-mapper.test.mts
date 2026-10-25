import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { createPantryTheme } from '../../../../packages/theme-engine/src/pantry-theme.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../packages/theme-engine/src/theme-bundle-core.ts';
import { LiquidRenderer } from '../../../../packages/theme-engine/src/theme-renderer.ts';
import { DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/theme-settings.ts';
const require = createRequire(import.meta.url);
const engineRequire = createRequire(new URL('../../../../packages/theme-engine/package.json', import.meta.url));
const { JSDOM } = engineRequire('jsdom') as { JSDOM: new (html: string) => { window: { document: Document } } };
const { productToLiquidDrop } = require('../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts') as typeof import('../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop');
const { PANTRY_DEMO_PRODUCTS } = require('../../../../apps/commerce/web/src/lib/demo/pantry-demo.ts') as typeof import('../../../../apps/commerce/web/src/lib/demo/pantry-demo');
async function render(key: 'product' | 'collection', products: Record<string, unknown>[]) {
  return new LiquidRenderer().render({context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'pantry-mapper',path:'/',previewMode:true,locale:'en-IN'},storeTemplate:{themeId:'letbuyy-refresh',themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},routeTemplate:{id:key,type:key,layoutKey:'theme',sections:[]},liquidBundle:createPantryTheme(createLetbuyyCoreLiquidThemeBundleFixture()),liquidTemplateKey:key,liquidContext:{shop:{name:'Synthetic Pantry'},product:products[0],collection:{title:'Pantry shelves',products}}});
}
test('actual app mapper derives unvarianted net contents and integer value for real Liquid PDP', async () => {
  const rice=productToLiquidDrop(PANTRY_DEMO_PRODUCTS[1],'/store/pantry-mapper')!;
  assert.equal(rice.has_options,false);assert.equal((rice.food as Record<string,unknown>).netQuantityValue,1000);assert.equal((rice.food as Record<string,unknown>).unitPriceMinor,2200);
  const r=await render('product',[rice]);assert.equal(r.status,'rendered');assert.match(r.liquid!.contentForLayout,/1000 g net per pack/);assert.match(r.liquid!.contentForLayout,/22\.00/);
});
test('actual mapper→Liquid variant quantity is strict and missing variant never inherits product pack', async () => {
  const raw=structuredClone(PANTRY_DEMO_PRODUCTS[0]);
  raw.food={...raw.food!,netQuantity:{value:999,unit:'ml'}};
  raw.variants![1]={...raw.variants![1],food:undefined,metadata:{}};
  const drop=productToLiquidDrop(raw)!;const variants=drop.variants as Record<string,unknown>[];
  assert.equal((variants[0].food as Record<string,unknown>).netQuantityValue,250);assert.equal((variants[0].food as Record<string,unknown>).unitPriceMinor,7200);assert.equal(variants[1].food,undefined);
  assert.equal((drop.food as Record<string,unknown>).netQuantityValue,undefined);
  const r=await render('product',[drop]);assert.equal(r.status,'rendered');const doc=new JSDOM(r.liquid!.contentForLayout).window.document;
  const rows=[...doc.querySelectorAll('.pn-pack-options li')];assert.match(rows[0].textContent!,/250 g net per pack/);assert.match(rows[0].textContent!,/72\.00/);assert.match(rows[1].textContent!,/net quantity not supplied/);assert.doesNotMatch(rows[1].textContent!,/999|ml|72\.00/);
});
test('actual mapper scalar option cue survives collection-depth scrub alongside unvarianted pack value', async () => {
  const products=PANTRY_DEMO_PRODUCTS.map(p=>productToLiquidDrop(p)!);assert.equal(products[0].has_options,true);
  const r=await render('collection',products);assert.equal(r.status,'rendered');const cards=[...new JSDOM(r.liquid!.contentForLayout).window.document.querySelectorAll('.pn-card')];assert.equal(cards.length,2);
  assert.match(cards[0].textContent!,/Choose a pack to check its net quantity/);assert.doesNotMatch(cards[0].textContent!,/Net quantity not supplied|72\.00/);assert.match(cards[1].textContent!,/1000 g net per pack/);assert.match(cards[1].textContent!,/22\.00/);
});
