import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { createKindredTheme, KINDRED_CATALOG_ID } from '../src/kindred-theme';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../src/theme-document';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';

const product = { id: '7b669c70-4100-4000-8000-000000000001', title: 'Little Pause set', price: 1790, currency: 'INR', url: '/product/real-gift-id', featured_image: '/theme-assets/kindred/v2/little-pause-open.webp', images: ['/theme-assets/kindred/v2/little-pause-open.webp', '/theme-assets/kindred/v2/little-pause-closed.webp'], available: true, options: [{ name: 'Packaging', values: ['Blush gift box', 'Kraft gift box', 'Moss gift box'] }], option_summaries: [{ name: 'Packaging', summary: 'Blush gift box, Kraft gift box, Moss gift box' }], variants: [{ id: 'real-blush-uuid', name: 'Blush gift box', stock: 5, price: 1790, options: { Packaging: 'Blush gift box' } }, { id: 'real-moss-uuid', name: 'Moss gift box', stock: 0, price: 1790, options: { Packaging: 'Moss gift box' } }], gifts: { schemaVersion: 1, itemCount: 3, occasions: ['birthday'], recipients: ['friend'], suitabilityNote: 'For a quiet morning.', contents: [{ label: 'Ceramic mug', quantity: 1, detail: '300 ml', care: 'Hand wash.' }, { label: 'Notebook', quantity: 1 }, { label: 'Brass pen', quantity: 1 }], mediaRoles: { openBox: 0, closedBox: 1 } } };
const shop = { id: '11111111-1111-4111-8111-111111111111', name: 'Synthetic Kindred', subdomain: 'kindred-test', gift_discovery_enabled: true, gift_occasions: [{ value: 'birthday', label: 'Birthday' }], gift_recipients: [{ value: 'friend', label: 'A friend' }] };
async function render(key: string, options: { bundle?: ReturnType<typeof createKindredTheme>; product?: unknown; products?: unknown[]; query?: Record<string,string>; capability?: boolean; collection?: Record<string,unknown> } = {}) {
 const bundle = options.bundle ?? createKindredTheme(createLetbuyyCoreLiquidThemeBundleFixture());
 const item = Object.hasOwn(options, 'product') ? options.product : product;
 const products = options.products ?? (item ? [item] : []);
 return new LiquidRenderer().render({ context: { storeId: shop.id, subdomain: shop.subdomain, path: key === 'index' ? '/' : '/products', previewMode: true, locale: 'en-IN', searchParams: options.query }, storeTemplate: { themeId: 'letbuyy-summit', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, routeTemplate: { id: key, type: key === 'product' ? 'product' : key === 'index' ? 'index' : 'collection', layoutKey: 'theme', sections: [] }, liquidBundle: bundle, liquidTemplateKey: key, liquidContext: { shop: { ...shop, gift_discovery_enabled: options.capability !== false }, product: item, collection: { title: 'Birthday gifts', products, total: products.length, discovery_query_fields: Object.entries(options.query ?? {}).filter(([key]) => key !== 'page').map(([key,value]) => ({key,value})), pagination: { page: 1, next_url: '/products?occasion=birthday&recipient=friend&page=2' }, ...options.collection }, collections: [{ id: 'birthday-collection', title: 'Birthday', handle: 'birthday', description: 'Mark another year.' }], section_products: Object.fromEntries(Object.keys(bundle.templates.index.sections).map(id => [id, products]).concat(Object.keys(bundle.templates.product.sections).map(id => [id, products]))) } });
}
const content = (result: Awaited<ReturnType<typeof render>>) => { assert.equal(result.status, 'rendered', JSON.stringify(result.warnings)); return result.liquid!.contentForLayout; };

test('pure versioned Kindred factory preserves Core input, stable identity and all retained routes', () => {
 const base = createLetbuyyCoreLiquidThemeBundleFixture();const before=structuredClone(base);const bundle=createKindredTheme(base);
 assert.deepEqual(base,before);assert.equal(base.package.version,'1.0.0');assert.equal(bundle.package.version,'2.0.0');assert.equal(bundle.package.slug,'letbuyy-summit');assert.equal(KINDRED_CATALOG_ID,'7b669c70-0000-4000-8000-000000000010');
 assert.deepEqual(Object.keys(bundle.templates).sort(),Object.keys(base.templates).sort());
 assert.equal(base.templates['list-collections'].sections['list-collections-grid'].settings.subtitle,'Browse every collection in the store.');
 assert.deepEqual(bundle.templates['list-collections'].sections['list-collections-grid'].settings,{title:'All collections'});
 for(const key of ['cart','customers/account','customers/orders','customers/order','customers/addresses','customers/settings','policy','page','contact','password','not_found']) assert.deepEqual(bundle.templates[key],base.templates[key],key);
 assert.deepEqual(bundle.templates.index.order.map(id=>bundle.templates.index.sections[id].type),['hero-banner','category-grid','product-grid','about-section','trust-badges']);
 assert.notDeepEqual(bundle.templates.index.order,base.templates.index.order);assert.deepEqual(fromThemeDocumentV2(toThemeDocumentV2(bundle)),bundle);
 const inline = Object.values(bundle.sections).filter(file => /\{%\s*for\s+block\s+in\s+section\.blocks\s*%\}\s*</.test(file.source));
 assert.ok(inline.length > 0);
 for (const file of inline) assert.doesNotMatch(file.source, /\{%\s*for\s+block\s+in\s+section\.blocks\s*%\}\s*<[a-z][a-z0-9-]*(?![a-z0-9-])(?=\s|>)(?!\s+\{\{ block\.editor_attributes \| raw \}\})/i, file.path);
});
test('real Liquid output carries gift identity/facts, contents and canonical variant/cart controls', async () => {
 for(const key of ['index','collection','product']){
  const result=await render(key);const html=content(result);assert.deepEqual(result.warnings,[]);assert.match(result.liquid!.headStyleText!,/\.kr-intro/);
  assert.match(html,/Little Pause set/);assert.doesNotMatch(html,/Urban Kicks|free shipping|guaranteed arrival|gift message|build.a.box/i);
  if(key==='product'){assert.match(html,/1 × Ceramic mug/);assert.match(html,/300 ml/);assert.match(html,/Hand wash/);assert.match(html,/Open box/);assert.match(html,/Closed box/);assert.match(html,/lb-variant-picker/);assert.match(html,/real-blush-uuid/);assert.match(html,/Moss gift box/);assert.match(html,/data-lb-add-to-cart/);assert.ok(html.indexOf('What’s included')<html.indexOf('data-lb-add-to-cart'));}
  else{assert.match(html,/3 included items/);assert.match(html,/href="\/product\/real-gift-id"/);}
 }
});
test('budget bounds use independent supplied clear URLs while preserving other choices and resetting page',async()=>{
 const html=content(await render('collection',{query:{occasion:'birthday',recipient:'friend',min_price:'1000',max_price:'2000',search:'pause',sort:'price-asc',page:'8'},collection:{active_filters:[{key:'min_price',value:'1000',label:'Minimum price: 1000',clear_url:'/products?occasion=birthday&recipient=friend&max_price=2000&search=pause&sort=price-asc'},{key:'max_price',value:'2000',label:'Maximum price: 2000',clear_url:'/products?occasion=birthday&recipient=friend&min_price=1000&search=pause&sort=price-asc'}]}}));
 const dom=new JSDOM(html,{url:'https://shop.example.invalid/products'});
 try{for(const[key,other]of[['min_price','max_price'],['max_price','min_price']]){const link=dom.window.document.querySelector<HTMLAnchorElement>(`[data-kindred-clear="${key}"]`);assert.ok(link);const params=new URL(link.href).searchParams;assert.equal(params.has(key),false);assert.equal(params.has(other),true);assert.equal(params.get('occasion'),'birthday');assert.equal(params.get('recipient'),'friend');assert.equal(params.get('search'),'pause');assert.equal(params.get('sort'),'price-asc');assert.equal(params.has('page'),false);}assert.match(html,/<option value="birthday" selected/);}finally{dom.window.close();}
});
test('missing query capability offers real basic search, not operational fake facets',async()=>{
 const home=content(await render('index',{capability:false}));assert.match(home,/name="search"/);assert.doesNotMatch(home,/name="occasion"|name="recipient"|name="min_price"/);
 const collection=content(await render('collection',{capability:false}));assert.match(collection,/Gift filters have not been configured/);assert.doesNotMatch(collection,/name="occasion"/);
});
test('missing/empty facts and media stay unknown, and empty catalogs have honest recovery',async()=>{
 const plain={...product,gifts:undefined,images:[],featured_image:null};const html=content(await render('product',{product:plain}));assert.match(html,/merchant has not supplied a contents list/);assert.doesNotMatch(html,/<figcaption>Open box|<figcaption>Closed box/);
 const empty=content(await render('collection',{product:null,products:[]}));assert.match(empty,/No matching products/);assert.doesNotMatch(empty,/Little Pause|3 included items/);
 const missingMedia={...product,gifts:{...product.gifts,mediaRoles:{openBox:19,closedBox:18}}};const missing=content(await render('product',{product:missingMedia}));assert.doesNotMatch(missing,/<figcaption>Open box|<figcaption>Closed box/);
});
test('merchant product/fact/query content is escaped; no executable output or manufactured claims',async()=>{
 const malicious={...product,title:'<script>alert(1)</script>',gifts:{...product.gifts,suitabilityNote:'<img src=x onerror=alert(2)>',contents:[{label:'<script>bad</script>',quantity:1,detail:'<img src=x onerror=alert(3)>'}]}};
 for(const key of ['collection','product']){const html=content(await render(key,{product:malicious,query:{occasion:'"><script>bad()</script>'}}));assert.doesNotMatch(html,/<script|<img[^>]*onerror=/i);assert.match(html,/&lt;script&gt;/);}
});
test('actual editor settings/resource choices change output and survive the document spine',async()=>{
 const initial=createKindredTheme(createLetbuyyCoreLiquidThemeBundleFixture());const doc=toThemeDocumentV2(initial);const hero=doc.templates.find(t=>t.key==='index')!.sections.find(s=>s.type==='hero-banner')!;hero.settings.heading='Merchant gift direction';hero.settings.image='/theme-assets/kindred/v2/little-pause-open.webp';hero.settings.imageAlt='Actual chosen photograph';
 const modified=fromThemeDocumentV2(doc);const html=content(await render('index',{bundle:modified}));assert.match(html,/Merchant gift direction/);assert.match(html,/Actual chosen photograph/);assert.doesNotMatch(content(await render('index',{bundle:initial})),/Actual chosen photograph/);
 const productDoc=toThemeDocumentV2(initial);productDoc.templates.find(t=>t.key==='product')!.sections.find(s=>s.type==='product-detail')!.settings.showGiftContents=false;assert.doesNotMatch(content(await render('product',{bundle:fromThemeDocumentV2(productDoc)})),/id="gift-contents"/);
});
test('responsive scoped rules reflow product/gallery/finder and respect reduced motion',()=>{
 const css=createKindredTheme(createLetbuyyCoreLiquidThemeBundleFixture()).layout.theme.source;
 assert.match(css,/@media\(max-width:40rem\)/);assert.match(css,/\.kr-grid\{grid-template-columns:1fr/);assert.match(css,/object-fit:contain/);assert.match(css,/prefers-reduced-motion:reduce/);assert.doesNotMatch(css,/\.auth-page|\.auth-card|body\{overflow/);
 assert.match(css,/@media\(max-width:23rem\)/);assert.match(css,/\.lb-product-detail__gallery-image\[hidden\]\{display:none\}/);
});
