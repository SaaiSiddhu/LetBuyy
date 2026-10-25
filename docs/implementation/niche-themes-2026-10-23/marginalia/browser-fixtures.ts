/** Coordinator-granted isolated browser inputs. Real binder/mapper/renderer, guarded live services. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import ts from 'typescript';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, getDefaultStorefrontThemeTemplate, LiquidRenderer } from '@letbuyy/theme-engine';
import { resolveCatalogDemoContent } from '../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch';
import { catalogDemoRoute, catalogDemoStoreId, catalogDemoSubdomain } from '../../../../apps/commerce/web/src/lib/theme-engine/catalog-demo-data';
import { resolveStorefrontTemplate } from '../../../../apps/commerce/web/src/lib/theme-engine/template-resolver';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { assembleLiquidPageFromRenderResult } from '../../../../apps/commerce/web/src/lib/theme-engine/liquid-page-assembly';
import type { StoreModel } from '@letbuyy/tenant-core';
import type { ProductModel } from '@letbuyy/commerce-core';

const root = path.resolve('docs/implementation/niche-themes-2026-10-23/marginalia');
const out = path.join(root, 'browser-rendered');
let liveEffects = 0;
const forbidden = () => { liveEffects++; throw new Error('No live service/API/database allowed in isolated evidence.'); };
function actualModule<T>(file: string, mocks: Record<string, unknown>): T {
  const absolute = path.resolve(file), localRequire = createRequire(absolute);
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((id: string) => Object.hasOwn(mocks, id) ? mocks[id] : localRequire(id), module, module.exports);
  return module.exports as T;
}
const { StoreService } = actualModule<typeof import('../../../../apps/commerce/web/src/lib/store-service')>('apps/commerce/web/src/lib/store-service.ts', { './api/client': { createStorefrontApiClient: forbidden, storefrontReadInit: forbidden } });
const { buildSectionDataPlan } = actualModule<typeof import('../../../../apps/commerce/web/src/lib/theme-engine/data-binding-engine')>('apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts', { '@/lib/product-service': { ProductService: new Proxy({}, { get: () => forbidden }) } });
// Extract unchanged pure compositor helpers rather than importing its server-only dependencies.
const compositionPath = 'apps/commerce/web/src/lib/theme-engine/composition-engine.tsx';
const compositionSource = fs.readFileSync(compositionPath, 'utf8');
const compositionAST = ts.createSourceFile(compositionPath, compositionSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helperNames = ['collectLiquidProducts', 'navPageToLink', 'navToLinklists'];
const helperText = compositionAST.statements.filter(node => ts.isFunctionDeclaration(node) && helperNames.includes(node.name?.text || '')).map(node => node.getText(compositionAST)).join('\n');
const helperCode = ts.transpileModule(helperText, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const helpers = new Function('productToLiquidDrop', `${helperCode};return {collectLiquidProducts,navToLinklists}`)(productToLiquidDrop) as {
  collectLiquidProducts: (data: Awaited<ReturnType<typeof buildSectionDataPlan>>, basePath: string) => Record<string, unknown>[];
  navToLinklists: (navigation: StoreModel['navigation'], currentPath: string) => Record<string, unknown>;
};

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const factory = createFirstPartyCatalogBundle('letbuyy-dawn', { designVersion: '2.0.0' });
  const template = { ...getDefaultStorefrontThemeTemplate('letbuyy-dawn'), themeId: 'letbuyy-dawn', config: factory.config, liquidBundle: factory, liquidRenderingCanary: true, themeSettings: { ...DEFAULT_THEME_SETTINGS, ...factory.config.settings_data.current, fontFamily: factory.config.settings_data.current.bodyFontFamily } };
  const source = resolveCatalogDemoContent('letbuyy-dawn', '2.0.0', template as unknown as Record<string, unknown>)!;
  assert.ok(source); assert.ok(source.collectionProductIds);
  const bookId = source.products[0].id, paperId = source.products[2].id;
  const stressMissing: ProductModel = { id: 'missing', name: 'A title without supplied details', description: '', images: [], variants: [], variantOptions: [], stock: 0, isActive: true, price: 300, currency: 'INR' };
  const english = { ...structuredClone(source.products[0]), name: 'A long title about books, cities and noticing the world around us — '.repeat(4), description: 'Long English title stress fixture; not a real product.' };
  const hindi = { ...structuredClone(source.products[0]), name: 'शहर, किताबें और हमारे आसपास की दुनिया को देखने का एक नया तरीका — '.repeat(4), description: 'हिंदी शीर्षक का परीक्षण। यह एक काल्पनिक नमूना है।' };
  const scenes: Array<{ name: string; route: string; stress?: ProductModel }> = [
    { name: 'home', route: '/' }, { name: 'collection', route: '/products' }, { name: 'book', route: `/product/${bookId}` },
    { name: 'stationery', route: `/product/${paperId}` }, { name: 'empty', route: '/collections/reading-soon' },
    { name: 'essays', route: '/collections/essays' }, { name: 'missing', route: '/product/missing', stress: stressMissing },
    { name: 'long-english', route: `/product/${bookId}`, stress: english }, { name: 'long-hindi', route: `/product/${bookId}`, stress: hindi },
  ];
  const files = [];
  const fonts = fs.readFileSync('docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/marginalia-storybook/assets/fonts.css', 'utf8').replace(/url\((['"]?)([a-z-]+\.(?:ttf|woff2))\1\)/g, "url('/fixture-fonts/$2')");
  for (const scene of scenes) {
    const context = resolveCatalogDemoContent('letbuyy-dawn', '2.0.0', template as unknown as Record<string, unknown>, scene.route)!;
    const normalized = StoreService.getCatalogThemePreview(context.template, context.name);
    const store: StoreModel = { ...normalized, id: catalogDemoStoreId(context), subdomain: catalogDemoSubdomain(context), name: context.name, logoUrl: undefined, navigation: context.navigation, selectedProductIds: context.products.map(product => product.id) };
    const route = scene.stress ? { ...catalogDemoRoute(context), type: 'product' as const, resourceId: scene.stress.id } : catalogDemoRoute(context);
    const plan = resolveStorefrontTemplate(store, route);
    const data = scene.stress ? await buildSectionDataPlan({ store, route, sections: plan.template.sections, preloadedProducts: [scene.stress] }) : await buildSectionDataPlan({ store, route, sections: plan.template.sections, catalogDemo: context });
    const products = helpers.collectLiquidProducts(data, '');
    const product = products.find(item => item.id === route.resourceId) || products[0] || null;
    const collectionMeta = Array.from(data.values()).find(item => item.collection)?.collection;
    const title = collectionMeta?.title || 'Books and paper';
    const result = await new LiquidRenderer().render({
      context: { storeId: store.id, subdomain: store.subdomain, path: route.path, previewMode: false, locale: 'en-IN', searchParams: route.searchParams },
      storeTemplate: store.templateConfig, routeTemplate: plan.template, liquidBundle: plan.liquidBundle, liquidTemplateKey: plan.liquidTemplateKey,
      liquidContext: { shop: { id: store.id, name: 'Marginalia', subdomain: store.subdomain, policies: [] }, product, collection: { title, products, total: products.length }, collections: context.collections.map(item => ({ ...item, image: item.image_url })), section_products: Object.fromEntries(Array.from(data.entries()).map(([id, value]) => [id, (value.products || []).map(item => productToLiquidDrop(item, ''))])), linklists: helpers.navToLinklists(store.navigation, route.path), cart: { item_count: null, total: null, items: [], currency: 'INR' } },
    });
    assert.equal(result.status, 'rendered', scene.name); assert.deepEqual(result.warnings, [], scene.name); assert.ok(result.liquid);
    if (scene.name === 'home') assert.equal(data.get('marginalia-reading')?.products?.length, 2);
    if (route.type === 'product') assert.equal(data.get('product-related')?.products?.length, 0, 'A blank selected related shelf cannot broaden to the catalog before renderer defaults.');
    if (scene.name === 'empty') { assert.equal(products.length, 0); assert.match(result.liquid.contentForLayout, /No products found/); }
    if (scene.name === 'essays') assert.deepEqual(products.map(item => item.id), source.collectionProductIds![source.collections[0].id]);
    if (scene.name === 'missing') assert.match(result.liquid.contentForLayout, /Detailed product facts have not been supplied/);
    const assembled = assembleLiquidPageFromRenderResult(result.liquid);
    const html = `<!doctype html><html lang="${scene.name === 'long-hindi' ? 'hi' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Marginalia actual bound Liquid · ${scene.name}</title><style>${fonts}body{margin:0}button,input,select{font:inherit}</style><style>${assembled.headStyleText}</style><script src="/navigation.js" defer></script></head><body><div data-theme-renderer="liquid">${assembled.html}</div></body></html>`;
    fs.writeFileSync(path.join(out, `${scene.name}.html`), html);
    files.push({ scene: scene.name, file: `browser-rendered/${scene.name}.html`, products: products.map(item => item.id), resourceCounts: Object.fromEntries(Array.from(data.entries()).map(([id, value]) => [id, value.products?.length ?? 0])), bytes: Buffer.byteLength(html), mode: scene.stress ? 'authorized synthetic preloaded product through actual binder, no service calls' : 'trusted public v2 catalog context through actual binder' });
  }
  const islandPath = 'apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx';
  const islandSource = fs.readFileSync(islandPath, 'utf8');
  const ast = ts.createSourceFile(islandPath, islandSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const navClass = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'LbMobileNavElement');
  assert.ok(navClass);
  const picker = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'LbVariantPickerElement');
  assert.ok(picker);
  const nativeHelpers = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ['selectedVariantsFrom', 'formatCartMoney'].includes(node.name?.text || '')).map(node => node.getText(ast)).join('\n');
  const carrierPath = 'apps/commerce/web/src/lib/theme-engine/variant-options-carrier.ts';
  const carrierAST = ts.createSourceFile(carrierPath, fs.readFileSync(carrierPath, 'utf8'), ts.ScriptTarget.Latest, true);
  const carrier = carrierAST.statements.filter(node => ts.isFunctionDeclaration(node) && ['readOptions', 'parsePickerVariants'].includes(node.name?.text || '')).map(node => node.getText(carrierAST).replace(/^export\s+/, '')).join('\n');
  const navJS = ts.transpileModule(`const LiquidIslandBase = HTMLElement;const VARIANT_CHANGED_EVENT = 'letbuyy:variant:changed';\n${carrier}\n${nativeHelpers}\n${navClass.getText(ast)}\n${picker.getText(ast)}\ncustomElements.define('lb-mobile-nav', LbMobileNavElement);customElements.define('lb-variant-picker', LbVariantPickerElement);`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  fs.writeFileSync(path.join(out, 'navigation.js'), navJS);
  assert.equal(liveEffects, 0);
  const sourceHashes = Object.fromEntries(['packages/theme-engine/src/marginalia-theme.ts','packages/theme-engine/src/marginalia-styles.ts','packages/theme-engine/src/marginalia-discovery.ts','packages/theme-engine/src/theme-renderer.ts','packages/theme-engine/src/first-party-theme-catalog.ts','apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts','apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts','apps/commerce/web/src/lib/theme-engine/liquid-page-assembly.ts','apps/commerce/web/src/lib/store-service.ts','apps/commerce/web/src/lib/demo/marginalia-demo.ts',compositionPath,islandPath].map(file => [file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  fs.writeFileSync(path.join(root, 'browser-fixtures.json'), JSON.stringify({ generatedAt: new Date().toISOString(), sourceHashes, source: 'Public v2 dispatcher → actual StoreService normalization/template resolver → actual buildSectionDataPlan with forbidden live services → actual product mapper/compositor collection/nav helpers → LiquidRenderer → canonical page assembly.', liveServiceEffects: liveEffects, files, navRuntime: { source: islandPath, sourceSha256: crypto.createHash('sha256').update(islandSource).digest('hex'), method: 'Unmodified LbMobileNavElement and LbVariantPickerElement plus their pure canonical helpers/carrier parser AST transpiled in isolation with native HTMLElement base. No cart/customer/purchase islands registered.' }, fonts: 'Local copies of the registered Libre Baskerville and Source Sans 3 font files from preserved M1. Actual glyph use/fallback checked in Chromium; app font network delivery not certified.' }, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ scenes: files.length, liveServiceEffects: liveEffects }) + '\n');
}
main().catch(error => { process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1; });
