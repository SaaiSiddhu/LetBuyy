/** Presentation fixtures from the real Liquid renderer; no app server, API or lifecycle claim. */
import fs from 'node:fs';
import { assembleLiquidPageFromRenderResult } from '../../../../apps/commerce/web/src/lib/theme-engine/liquid-page-assembly';
import path from 'node:path';
import { createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { LiquidRenderer } from '../../../../packages/theme-engine/src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/theme-settings';
import { DEWDROP_DEMO_PRODUCTS, DEWDROP_DEMO_COLLECTIONS, withDewdropDemoContent } from '../../../../apps/commerce/web/src/lib/demo/dewdrop-demo';
import type { LiquidThemePackageBundle } from '../../../../packages/theme-engine/src/theme-bundle';
async function main() {
const evidence = 'docs/implementation/niche-themes-2026-10-23/dewdrop';
const base = createFirstPartyCatalogBundle('letbuyy-aura', { designVersion: '2.0.0' });
const bundle = withDewdropDemoContent({ liquidBundle: base }).liquidBundle as LiquidThemePackageBundle;
const products = DEWDROP_DEMO_PRODUCTS.map(p => productToLiquidDrop(p, '/store/dewdrop-test')!);
const files = [];
fs.mkdirSync(path.join(evidence, 'rendered'), { recursive: true });
for (const [key, file, item] of [['index', 'home', products[2]], ['collection', 'collection', products[2]], ['product', 'product', products[2]], ['product', 'missing-product', products[3]]] as const) {
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'dewdrop-test', path: key === 'collection' ? '/products' : '/', previewMode: true, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-aura', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key === 'index' ? 'index' : key === 'product' ? 'product' : 'collection', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Dewdrop', description: 'Fictional sample catalog' }, product: item, collection: { title: 'Your care shelf', products }, collections: DEWDROP_DEMO_COLLECTIONS, section_products: { 'aura-routine-shelves-index': products, 'aura-routine-shelves-collection': products, 'aura-independent-products': products.slice(0,2) }, linklists: { main_menu: { links: [{ title: 'Your routine', url: '/products' }, { title: 'Named shades', url: `/store/dewdrop-test/product/${products[2].id}` }] } } },
  });
  if (result.status !== 'rendered' || result.warnings.length || !result.liquid) throw new Error(JSON.stringify({ key, status: result.status, warnings: result.warnings }));
  const assembled = assembleLiquidPageFromRenderResult(result.liquid);
  const document = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dewdrop renderer fixture</title><style>body{margin:0}button,input,select{font:inherit}</style><style>${assembled.headStyleText}</style></head><body><div data-theme-renderer="liquid">${assembled.html}</div></body></html>`;
  fs.writeFileSync(path.join(evidence, 'rendered', `${file}.html`), document);
  files.push({ file: `rendered/${file}.html`, engine: result.engine, status: result.status, warnings: result.warnings, bytes: Buffer.byteLength(document) });
}
fs.writeFileSync(path.join(evidence, 'render-fixtures.json'), JSON.stringify({ scope: 'Actual Liquid renderer plus canonical assembleLiquidPageFromRenderResult; documented fixture body-margin/input-font reset only; actual app productToLiquidDrop and explicit v2 catalog dispatch; not HTTP integration or hydrated purchase evidence.', files }, null, 2) + '\n');
console.log(JSON.stringify(files));

}
main().catch(error => { console.error(error); process.exitCode = 1; });
