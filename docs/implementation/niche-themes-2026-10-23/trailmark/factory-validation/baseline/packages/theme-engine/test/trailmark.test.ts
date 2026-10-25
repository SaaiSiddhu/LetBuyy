import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createTrailmarkTheme, TRAILMARK_CATALOG_ID } from '../src/trailmark-theme';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { fromThemeDocumentV2, toThemeDocumentV2 } from '../src/theme-document';
import { TRAILMARK_CSS } from '../src/trailmark-styles';

// Public display contract fixture; the owned app harness verifies real projection from raw facts.
const equipment = { id: 'racket', title: 'Rally68 badminton racket', price: 2490, currency: 'INR', url: '/product/racket', images: ['/theme-assets/trailmark/v2/racket.webp'], featured_image: '/theme-assets/trailmark/v2/racket.webp', available: true, options: [{ name: 'Grip circumference', values: ['84 mm', '88 mm'] }], variants: [{ id: '7b669c70-8400-4000-8000-000000000001', title: 'Forest /84 mm', options: { 'Grip circumference': '84 mm' }, available: true, sports_display: { length: '68 cm', weight: '88 g', grip: '84 mm' }, sports: { gripCircumference: { value: 84, unit: 'mm' } } }, { id: '7b669c70-8400-4000-8000-000000000002', title: 'Forest /88 mm', available: false, sports_display: { length: '68 cm', weight: '88 g', grip: '88 mm' }, sports: { gripCircumference: { value: 88, unit: 'mm' } } }], sports_display: { length: '68 cm', weight: '88 g' }, sports: { version: 1, activity: 'Badminton', equipmentType: 'racket', length: { value: 68, unit: 'cm' }, weight: { value: 88, unit: 'g' }, material: '<script>private-executable</script> Aluminium', contents: ['1 strung racket'], conditions: '<img src=x onerror=alert(1)> Dry court use', care: 'Store dry', compatibility: { status: 'unconfirmed' } } };
async function render(key: string, b = createTrailmarkTheme(createLetbuyyCoreLiquidThemeBundleFixture()), product: Record<string, unknown> = equipment, extras: Record<string, unknown> = {}, previewMode = true) {
  return new LiquidRenderer().render({ context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'trailmark-test', path: key === 'index' ? '/' : '/'+key, previewMode, locale: 'en-IN' }, storeTemplate: { themeId: 'letbuyy-ride', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, routeTemplate: { id: key, type: key === 'index' ? 'index' : key === 'product' ? 'product' : 'collection', layoutKey: 'theme', sections: [] }, liquidBundle: b, liquidTemplateKey: key, liquidContext: { shop: { name: 'Synthetic Trailmark' }, product, collection: { title: 'Court time', products: [product] }, section_products: { 'ride-equipment-index': [product] }, ...extras } });
}

test('versioned factory is pure, retains stable ride identity and preserves v1/template functions', () => {
  const base = createLetbuyyCoreLiquidThemeBundleFixture();const before = structuredClone(base);const b = createTrailmarkTheme(base);
  assert.deepEqual(base, before);assert.equal(b.package.slug, 'letbuyy-ride');assert.equal(b.package.version, '2.0.0');assert.equal(TRAILMARK_CATALOG_ID, '7b669c70-0000-4000-8000-000000000006');
  assert.deepEqual(b.templates.index.order.map(id => b.templates.index.sections[id].type), ['hero-banner','category-grid','product-grid','about-section','trust-badges']);
  for (const key of ['cart','customers/account','customers/orders','customers/order','customers/addresses','policy','page','not_found','password']) assert.deepEqual(b.templates[key], before.templates[key]);
  assert.doesNotMatch(b.sections['customer-login'].source, /tm-theme/);assert.doesNotMatch(b.sections['customer-register'].source, /tm-theme/);
  assert.deepEqual(fromThemeDocumentV2(toThemeDocumentV2(b)), b);
});
test('real Liquid index and collection render actual identity and measured equipment cards', async () => {
  for (const key of ['index','collection','search']) {const r = await render(key);assert.equal(r.status, 'rendered');assert.deepEqual(r.warnings, []);assert.match(r.liquid!.contentForLayout, /Rally68 badminton racket/);assert.match(r.liquid!.contentForLayout, /68 cm length/);assert.match(r.liquid!.contentForLayout, /88 g/);assert.match(r.liquid!.headStyleText!, /tm-discovery/);assert.doesNotMatch(r.liquid!.contentForLayout, /New season essentials|Monsoon-ready|up to30%|Guaranteed|certified/);}
});
test('canonical variant/cart/gallery islands survive; variant facts are labelled by their own identity', async () => {
  const r = await render('product');assert.equal(r.status, 'rendered');const out=r.liquid!.contentForLayout;
  for (const name of ['lb-product-gallery','lb-variant-picker','lb-add-to-cart','data-lb-add-to-cart-status']) assert.ok(out.includes(name));
  assert.match(out,/Measurements for Forest \/84 mm/);assert.match(out,/Grip circumference:84 mm|Grip circumference: 84 mm/);assert.match(out,/Measurements for Forest \/88 mm/);assert.match(out,/Compatibility: unconfirmed/);
  assert.doesNotMatch(out,/<script\b|<img[^>]*onerror=|<img src="?x/);assert.doesNotMatch(out,/data-lb-buy-now/);assert.match(out,/1 strung racket/);
});
test('clothing switches to apparel measurements; equipment never receives garment size headings', async () => {
  const clothing={...equipment,sports:null,apparel:{fit:'Relaxed',unit:'cm',measurements:[{size:'M',chest:104,length:70}],fabric:'Cotton',care:'Cold wash'},variants:[],options:[{name:'Size',values:['S','M','L']}]};
  const outfit=await render('product',undefined,clothing);assert.match(outfit.liquid!.contentForLayout,/Garment size/);assert.match(outfit.liquid!.contentForLayout,/104/);assert.doesNotMatch(outfit.liquid!.contentForLayout,/Grip circumference:|Merchant-supplied equipment facts/);
  assert.doesNotMatch((await render('product')).liquid!.contentForLayout,/Garment size/);
});
test('missing media/facts and empty catalog remain useful without invented stock or compatibility', async () => {
  const empty={id:'empty',title:'Unspecified equipment',price:0,currency:'INR',url:'/product/empty',images:[],options:[],variants:[],available:false};
  const pdp=await render('product',undefined,empty);assert.match(pdp.liquid!.contentForLayout,/measurements and use conditions have not been supplied/);assert.doesNotMatch(pdp.liquid!.contentForLayout,/68 cm|84 mm|universal|Free shipping/);assert.match(pdp.liquid!.contentForLayout,/disabled/);
  const catalog=await render('collection',undefined,empty,{collection:{products:[],total:0}});assert.match(catalog.liquid!.contentForLayout,/No matching equipment/);assert.doesNotMatch(catalog.liquid!.contentForLayout,/Rally68/);
});
test('equipment facets stay absent until the canonical server explicitly supplies capability/options', async () => {
  const initial=(await render('collection')).liquid!.contentForLayout;assert.match(initial,/name="search"/);assert.doesNotMatch(initial,/name="activity"|name="equipment_type"|name="length_value"|name="size"/);
  const active=await render('collection',undefined,equipment,{collection:{products:[equipment],sports_filters_enabled:true,sports_facets:{activities:['Badminton'],equipment_types:['racket'],length_units:['cm']},active_filters:[{label:'Length68 cm',clear_url:'/collection?activity=Badminton'}],pagination:{page:1,next_url:'/collection?activity=Badminton&page=2'}}});
  assert.match(active.liquid!.contentForLayout,/name="activity"/);assert.match(active.liquid!.contentForLayout,/name="length_unit"/);assert.match(active.liquid!.contentForLayout,/activity=Badminton/);assert.doesNotMatch(active.liquid!.contentForLayout,/name="size"/);
});
test('merchant settings save/readback changes actual rendered content and media', async () => {
  const b=createTrailmarkTheme(createLetbuyyCoreLiquidThemeBundleFixture());const d=toThemeDocumentV2(b);const hero=d.templates.find(t=>t.key==='index')!.sections.find(s=>s.type==='hero-banner')!;hero.settings.heading='Merchant court guide';hero.settings.image='/theme-assets/trailmark/v2/activity.webp';hero.settings.imageAlt='A fictional outdoor game';const saved=fromThemeDocumentV2(d);const out=(await render('index',saved)).liquid!.contentForLayout;assert.match(out,/Merchant court guide/);assert.match(out,/activity.webp/);assert.match(out,/A fictional outdoor game/);assert.doesNotMatch((await render('index',b)).liquid!.contentForLayout,/Merchant court guide/);
});
test('portable CSS parses with scoped rules and valid narrow-grid declarations', () => {
  const dom = new JSDOM('<!doctype html><style>'+TRAILMARK_CSS+'</style>');
  const rules = Array.from(dom.window.document.styleSheets[0].cssRules);
  assert.ok(rules.length > 20);
  for (const rule of rules) {
    if ('selectorText' in rule) assert.ok(String(rule.selectorText).startsWith('.tm-theme'));
  }
  const narrow = rules.find(rule => rule.cssText.startsWith('@media (max-width:360px)') || rule.cssText.startsWith('@media(max-width:360px)'));
  assert.ok(narrow && 'cssRules' in narrow);
  const gridRule = Array.from((narrow as CSSMediaRule).cssRules).find(rule => 'selectorText' in rule && rule.selectorText === '.tm-theme .tm-card') as CSSStyleRule;
  assert.equal(gridRule.style.getPropertyValue('grid-template-columns'), '100px minmax(0,1fr)');
  dom.window.close();
});
test('reapplying the factory does not duplicate schemas/styles on its own versioned package', () => {
  const b = createTrailmarkTheme(createLetbuyyCoreLiquidThemeBundleFixture());
  assert.deepEqual(createTrailmarkTheme(b), b);
});
test('editor preview identifies the actual inline navigation anchor; public output omits block metadata', async () => {
  const bundle=createTrailmarkTheme(createLetbuyyCoreLiquidThemeBundleFixture());
  const header=Object.values(bundle.templates.header.sections).find(section=>section.type==='header')!;
  header.blocks={'trailmark-nav-probe':{type:'link',settings:{label:'Measured equipment',href:'/products'}}};
  header.block_order=['trailmark-nav-probe'];
  const preview=await render('index',bundle);assert.equal(preview.status,'rendered');assert.deepEqual(preview.warnings,[]);
  const previewDom=new JSDOM(preview.liquid!.header);
  const anchor=previewDom.window.document.querySelector('[data-block-id="trailmark-nav-probe"]');
  assert.equal(anchor?.tagName,'A');assert.equal(anchor?.textContent,'Measured equipment');
  assert.ok(anchor?.parentElement?.classList.contains('lb-header__nav-links'));
  const live=await render('index',bundle,equipment,{},false);assert.equal(live.status,'rendered');
  const liveDom=new JSDOM(live.liquid!.header);assert.equal(liveDom.window.document.querySelector('[data-block-id]'),null);
  assert.match(liveDom.window.document.body.textContent!,/Measured equipment/);
  previewDom.window.close();liveDom.window.close();
});
