/** Owned static evidence: actual public dispatcher/binder/mapper/renderer/assembly, no live effects. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { createFirstPartyCatalogBundle, LiquidRenderer } from '../../../../packages/theme-engine/src/index';
import { resolveCatalogDemoContent } from '../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch';
import { catalogDemoRoute, catalogDemoStoreId, catalogDemoSubdomain } from '../../../../apps/commerce/web/src/lib/theme-engine/catalog-demo-data';
import { resolveStorefrontTemplate } from '../../../../apps/commerce/web/src/lib/theme-engine/template-resolver';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { assembleLiquidPageFromRenderResult } from '../../../../apps/commerce/web/src/lib/theme-engine/liquid-page-assembly';
import type { ProductModel } from '../../../../packages/commerce-core/src/index';
import type { StoreModel } from '../../../../packages/tenant-core/src/index';
const root = path.resolve('docs/implementation/niche-themes-2026-10-23/pantry');
const out = path.join(root, 'browser-rendered');
let liveEffects = 0;
const forbidden = () => { liveEffects++; throw new Error('No live service, API or database is allowed in this owned static review.'); };
function actualModule<T>(file: string, mocks: Record<string, unknown>): T {
  const absolute = path.resolve(file), localRequire = createRequire(absolute);
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((id: string) => Object.hasOwn(mocks, id) ? mocks[id] : localRequire(id), module, module.exports);
  return module.exports as T;
}
const { StoreService } = actualModule<typeof import('../../../../apps/commerce/web/src/lib/store-service')>('apps/commerce/web/src/lib/store-service.ts', { './api/client': { createStorefrontApiClient: forbidden, storefrontReadInit: forbidden } });
const { buildSectionDataPlan } = actualModule<typeof import('../../../../apps/commerce/web/src/lib/theme-engine/data-binding-engine')>('apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts', { '@/lib/product-service': { ProductService: new Proxy({}, { get: () => forbidden }) }, '@/lib/demo/urban-kicks-demo': { URBAN_KICKS_DEMO_SUBDOMAIN: 'urban-kicks-demo' } });
const compositionPath = 'apps/commerce/web/src/lib/theme-engine/composition-engine.tsx';
const compositionSource = fs.readFileSync(compositionPath, 'utf8');
const compositionAST = ts.createSourceFile(compositionPath, compositionSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helpersText = compositionAST.statements.filter(node => ts.isFunctionDeclaration(node) && ['collectLiquidProducts','navPageToLink','navToLinklists'].includes(node.name?.text || '')).map(node => node.getText(compositionAST)).join('\n');
const helpersCode = ts.transpileModule(helpersText, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const helpers = new Function('productToLiquidDrop', `${helpersCode};return {collectLiquidProducts,navToLinklists}`)(productToLiquidDrop) as { collectLiquidProducts: (data: Awaited<ReturnType<typeof buildSectionDataPlan>>, basePath: string) => Record<string, unknown>[]; navToLinklists: (navigation: StoreModel['navigation'], currentPath: string) => Record<string, unknown> };
const sourceFiles = ['packages/theme-engine/src/pantry-theme.ts','packages/theme-engine/src/pantry-styles.ts','packages/theme-engine/src/pantry-discovery.ts','packages/theme-engine/src/theme-renderer.ts','packages/theme-engine/src/first-party-theme-catalog.ts','packages/commerce-core/src/product-fact-presentation.ts','apps/commerce/web/src/lib/demo/pantry-demo.ts','apps/commerce/web/src/lib/demo/catalog-demo-dispatch.ts','apps/commerce/web/src/lib/theme-engine/catalog-demo-data.ts','apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts','apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts',compositionPath,'apps/commerce/web/src/lib/theme-engine/liquid-page-assembly.ts','apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx','apps/commerce/web/src/app/store/[subdomain]/liquid-theme.css'];

async function main() {
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync('apps/commerce/web/src/app/store/[subdomain]/liquid-theme.css', path.join(out, 'storefront.css'));
  const bundle = createFirstPartyCatalogBundle('letbuyy-refresh', { designVersion: '2.0.0' });
  const template = { themeId: 'letbuyy-refresh', experienceId: 'refresh', rendererEngine: 'liquid', liquidBundle: bundle, liquidRenderingCanary: true, themeSettings: bundle.config.settings_data.current, templates: bundle.templates, sections: {} };
  const source = resolveCatalogDemoContent('letbuyy-refresh', '2.0.0', template)!; assert.ok(source?.collectionProductIds);
  const lentils = source.products[0], rice = source.products[1];
  const missingFood = structuredClone(lentils); delete missingFood.food; missingFood.variants = missingFood.variants?.map(variant => { const next = { ...variant, metadata: {} }; delete next.food; return next; });
  const missingVariant = structuredClone(lentils); missingVariant.food = { ...missingVariant.food!, netQuantity: { value: 999, unit: 'ml' } }; missingVariant.variants![1] = { ...missingVariant.variants![1], food: undefined, metadata: {} };
  const soldOut = structuredClone(lentils); soldOut.stock = 0; soldOut.variants?.forEach(variant => { variant.stock = 0; });
  const hindi = structuredClone(lentils); hindi.name = 'रोज़मर्रा की रसोई के लिए लाल मसूर की दाल — सामग्री, पैक का शुद्ध वज़न और भंडारण की जानकारी ध्यान से पढ़ें'; hindi.description = 'यह एक काल्पनिक नमूना उत्पाद है। पैक चुनने से पहले सामग्री और आपूर्ति की गई जानकारी जाँचें।';
  const scenes: Array<{ name: string; route: string; model?: ProductModel; hindi?: boolean }> = [
    { name: 'home', route: '/' }, { name: 'collection', route: '/products' }, { name: 'pulses', route: '/collections/pulses-lentils' }, { name: 'rice-shelf', route: '/collections/rice-grains' },
    { name: 'product', route: `/product/${lentils.id}` }, { name: 'rice', route: `/product/${rice.id}` },
    { name: 'unknown-food', route: `/product/${lentils.id}`, model: missingFood }, { name: 'missing-variant', route: `/product/${lentils.id}`, model: missingVariant },
    { name: 'sold-out', route: `/product/${lentils.id}`, model: soldOut }, { name: 'hindi', route: `/product/${lentils.id}`, model: hindi, hindi: true },
  ];
  const fontCss = [400,500,600,700].map(weight => `@font-face{font-family:Inter;src:url('/fixture-fonts/inter-${weight}.ttf') format('truetype');font-style:normal;font-weight:${weight};font-display:swap}`).join('');
  const files = [];
  for (const scene of scenes) {
    const context = resolveCatalogDemoContent('letbuyy-refresh','2.0.0',template,scene.route)!;
    const normalized = StoreService.getCatalogThemePreview(context.template, context.name);
    const store: StoreModel = { ...normalized, id: catalogDemoStoreId(context), subdomain: catalogDemoSubdomain(context), name: 'Pantry', logoUrl: undefined, navigation: context.navigation, selectedProductIds: context.products.map(product => product.id) };
    const route = catalogDemoRoute(context); const plan = resolveStorefrontTemplate(store, route);
    assert.equal(plan.rendererEngine, 'liquid');
    const data = scene.model ? await buildSectionDataPlan({ store, sections: plan.template.sections, route, preloadedProducts: [scene.model, rice] }) : await buildSectionDataPlan({ store, sections: plan.template.sections, route, catalogDemo: context });
    const products = helpers.collectLiquidProducts(data,''); const primary = products.find(item => item.id === route.resourceId) || products[0] || null;
    const collectionMeta = [...data.values()].find(item => item.collection)?.collection;
    const ts = store.templateConfig.themeSettings;
    assert.equal(ts.primaryColor.toLowerCase(), '#36533d');
    const layoutContext = `body{margin:0}button,input,select{font:inherit}:root{--text:${ts.textColor};--text-secondary:rgba(0,0,0,.6);--font-main:Inter,system-ui,sans-serif;--font-heading:Inter,system-ui,sans-serif;--radius:${ts.borderRadius}px;--card-bg:rgb(255 255 255);--card-text:rgb(17 24 39);--card-border:rgb(229 231 235);--input-bg:rgb(249 250 251);--input-text:${ts.textColor};--input-border:rgb(229 231 235);--border-color:rgba(0,0,0,.1)}`;
    const result = await new LiquidRenderer().render({ context: { storeId: store.id, subdomain: store.subdomain, path: route.path, previewMode: false, locale: scene.hindi ? 'hi-IN' : 'en-IN', searchParams: route.searchParams }, storeTemplate: store.templateConfig, routeTemplate: plan.template, liquidBundle: plan.liquidBundle, liquidTemplateKey: plan.liquidTemplateKey,
      liquidContext: { shop: { id: store.id, name: 'Pantry', subdomain: store.subdomain, policies: [] }, product: primary, collection: { title: collectionMeta?.title || 'Everyday staples', products, total: products.length }, collections: context.collections.map(item => ({ ...item, image: item.image_url })), section_products: Object.fromEntries([...data.entries()].map(([id,item]) => [id,(item.products || []).map(model => productToLiquidDrop(model,''))])), linklists: helpers.navToLinklists(store.navigation,route.path), cart: { item_count:null,total:null,items:[],currency:'INR' } } });
    assert.equal(result.status,'rendered',scene.name); assert.deepEqual(result.warnings,[],scene.name); assert.ok(result.liquid);
    if (scene.name==='pulses') assert.deepEqual(products.map(p=>p.id),[lentils.id]);
    if (scene.name==='rice-shelf') assert.deepEqual(products.map(p=>p.id),[rice.id]);
    if (scene.name==='unknown-food') assert.match(result.liquid.contentForLayout,/Not supplied by the merchant/);
    if (scene.name==='missing-variant') { assert.doesNotMatch(result.liquid.contentForLayout,/999/); assert.match(result.liquid.contentForLayout,/net quantity not supplied/); }
    const assembled = assembleLiquidPageFromRenderResult(result.liquid);
    const html = `<!doctype html><html lang="${scene.hindi?'hi':'en-IN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Pantry actual Liquid — ${scene.name}</title><link rel="stylesheet" href="/storefront.css"><style>${fontCss}${layoutContext}</style><style>${assembled.headStyleText}</style><script src="/navigation.js" defer></script></head><body><div data-theme-renderer="liquid">${assembled.html}</div></body></html>`;
    fs.writeFileSync(path.join(out,scene.name+'.html'),html);
    files.push({ scene:scene.name, route:route.path, mode:scene.model?'explicit synthetic stress through actual preloaded binder':'trusted public v2 dispatcher through actual binder', products:products.map(p=>p.id), bytes:Buffer.byteLength(html), sha256:createHash('sha256').update(html).digest('hex') });
  }
  const navPath='apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx'; const navSource=fs.readFileSync(navPath,'utf8'); const ast=ts.createSourceFile(navPath,navSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX); const nav=ast.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='LbMobileNavElement'); assert.ok(nav);
  fs.writeFileSync(path.join(out,'navigation.js'),ts.transpileModule(`const LiquidIslandBase=HTMLElement;\n${nav.getText(ast)}\ncustomElements.define('lb-mobile-nav',LbMobileNavElement);`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText);
  assert.equal(liveEffects,0);
  fs.writeFileSync(path.join(root,'browser-fixtures.json'),JSON.stringify({ scope:'Actual explicit v2 factory → trusted dispatcher → actual StoreService/template resolver → actual section binder → actual mapper/compositor helpers → LiquidRenderer → canonical assembly and unchanged app storefront CSS. Isolated native navigation class only; no cart/variant/purchase hydration, public read-only conversion, Next/API/DB/order claim.', context:'Only app document margin/input-font reset, source-equivalent light layout variables and approved M1 local Inter bytes; no repair stylesheet. Hindi is a text/glyph stress fixture, not completed translation. Product/common quantities never inherited into missing variants.', liveServiceEffects:liveEffects, files, sourceFiles:sourceFiles.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})), navSourceSha256:createHash('sha256').update(navSource).digest('hex')},null,2)+'\n');
  process.stdout.write(JSON.stringify({scenes:files.length,liveServiceEffects:liveEffects})+'\n');
}
main().catch(error=>{process.stderr.write(String(error.stack||error)+'\n');process.exitCode=1;});
