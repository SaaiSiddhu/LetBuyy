/** Cross-boundary evidence runner: real facts projection, Liquid rendering and page assembly.
 * No app server, API/DB write, hydrated purchase or install/publish lifecycle claim.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog';
import { LiquidRenderer } from '../../../../packages/theme-engine/src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/theme-settings';
import { LiquidThemePackageBundleSchema } from '../../../../packages/theme-engine/src/theme-bundle';
import { assembleLiquidPageFromRenderResult } from '../../../../apps/commerce/web/src/lib/theme-engine/liquid-page-assembly';
import { HABITAT_DEMO_PRODUCTS, HABITAT_DEMO_COLLECTIONS, withHabitatDemoContent } from '../../../../apps/commerce/web/src/lib/demo/habitat-demo';

async function main() {
  const evidence = path.resolve('docs/implementation/niche-themes-2026-10-23/habitat');
  const factory = createFirstPartyCatalogBundle('letbuyy-craft', { designVersion: '2.0.0' });
  const bundle = LiquidThemePackageBundleSchema.parse(withHabitatDemoContent({ liquidBundle: factory }).liquidBundle);
  const products = HABITAT_DEMO_PRODUCTS.map(product => productToLiquidDrop(product)!);
  const overrideModel = structuredClone(HABITAT_DEMO_PRODUCTS[0]);
  overrideModel.variants![1].furniture = { ...overrideModel.variants![1].furniture, assembled: { unit: 'in', width: 27 }, package: { unit: 'mm', width: 740, height: 780 }, materials: ['Variant-only oak'], assembly: { status: 'required', instructions: 'Variant-only assembly instruction.', tools: 'Supplied hex key' }, care: 'Variant-only care instruction.' };
  const override = productToLiquidDrop(overrideModel)!;
  const missing = { id: 'missing-furniture', title: 'Piece without supplied facts', description: 'No furniture facts or photograph were supplied.', price: 1200, currency: 'INR', url: '/product/missing-furniture', featured_image: null, images: [], stock: 0, available: false, options: [], variants: [] };
  const invalid = { ...missing, title: 'Invalid historic facts omitted', ...productToLiquidDrop({ ...HABITAT_DEMO_PRODUCTS[0], furniture: { assembled: { unit: 'cm', width: -2 } } }) };
  const files = [];
  fs.mkdirSync(path.join(evidence, 'rendered'), { recursive: true });
  for (const [key, file, item] of [['index', 'home', products[0]], ['collection', 'collection', products[0]], ['product', 'product', products[0]], ['product', 'round-product', products[1]], ['product', 'missing-product', missing], ['product', 'invalid-product', invalid], ['product', 'variant-overrides', override], ['index', 'faq', products[0]]] as const) {
    const sceneBundle = structuredClone(bundle);
    if (file === 'faq') {
      sceneBundle.templates.index.sections['habitat-measurement-guide'].settings.title = 'Plan your access route.';
      sceneBundle.templates.index.sections['habitat-owned-faq'] = { type: 'faq-accordion', settings: { title: 'Measurements and access', allowMultipleOpen: true }, blocks: {
        first: { type: 'faq-item', settings: { question: 'Will this fit my doorway?', answer: 'Compare supplied package measurements with your measured access route. No fit is guaranteed.' }, blocks: {}, block_order: [], disabled: false },
        second: { type: 'faq-item', settings: { question: 'Is there a delivery date?', answer: 'A delivery date is unavailable unless checkout supplies an actual service result.' }, blocks: {}, block_order: [], disabled: false },
      }, block_order: ['first', 'second'], disabled: false };
      sceneBundle.templates.index.order.push('habitat-owned-faq');
    }
    const result = await new LiquidRenderer().render({
      context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'habitat-owned-evidence', path: key === 'collection' ? '/collections/living-room' : key === 'product' ? String(item.url) : '/', previewMode: true, locale: 'en-IN', searchParams: key === 'collection' ? { material: 'teak', sort: 'display_order' } : {} },
      storeTemplate: { themeId: 'letbuyy-craft', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
      routeTemplate: { id: key, type: key, layoutKey: 'theme', sections: [] },
      liquidBundle: sceneBundle, liquidTemplateKey: key,
      liquidContext: {
        shop: { name: 'Habitat', description: 'Fictional sample furniture catalog', policies: [] }, product: item,
        collection: { title: 'Living room', description: 'A chair and table, each sold separately.', products, total: products.length, furniture_filters_available: true },
        collections: HABITAT_DEMO_COLLECTIONS,
        section_products: { 'habitat-living-objects': products, 'habitat-collection-objects': products, 'habitat-related-objects': products.slice(1) },
        linklists: { main_menu: { links: [{ title: 'Rooms', url: '/collections' }, { title: 'Furniture', url: '/products' }, { title: 'Measure your space', url: `${products[0].url}#habitat-dimensions-habitat-product-selection` }] } },
      },
    });
    assert.equal(result.status, 'rendered', file); assert.deepEqual(result.warnings, [], file); assert.ok(result.liquid);
    const html = result.liquid.contentForLayout;
    assert.doesNotMatch(html, /private_cost/);
    if (file === 'product') {
      for (const text of ['68 W × 78 D × 74 H cm', '72 W × 82 D × 78 H cm', '74 W × 84 D × 78 H cm', '14.2 kg', '38 cm']) assert.ok(html.includes(text), text);
    }
    if (file === 'faq') { assert.match(html, /Plan your access route/); assert.match(html, /data-block-id="first"/); assert.match(html, /data-block-id="second"/); }
    if (file === 'collection') assert.match(html, /class="hab-card-facts">68 W × 78 D × 74 H cm/);
    if (file === 'round-product') assert.match(html, /50 Ø × 42 H cm/);
    if (file === 'variant-overrides') for (const text of ['Variant-only oak', 'Assembly required', 'Variant-only assembly instruction.', 'Supplied hex key', 'Variant-only care instruction.', '27 W in', '740 W × 780 H mm']) assert.ok(html.includes(text), text);
    if (file === 'missing-product' || file === 'invalid-product') {
      assert.match(html, /Assembled dimensions not supplied/); assert.doesNotMatch(html, /-2 cm|Arrives assembled|hab-dimension-box/);
    }
    const assembled = assembleLiquidPageFromRenderResult(result.liquid);
    const fixtureFonts = `@font-face{font-family:'Libre Baskerville';font-weight:400;font-display:swap;src:url('/fixture-fonts/libre-baskerville-400.ttf')}@font-face{font-family:'Libre Baskerville';font-weight:700;font-display:swap;src:url('/fixture-fonts/libre-baskerville-700.ttf')}@font-face{font-family:'Source Sans Pro';font-weight:400;font-display:swap;src:url('/fixture-fonts/source-sans-pro-400.ttf')}@font-face{font-family:'Source Sans Pro';font-weight:600;font-display:swap;src:url('/fixture-fonts/source-sans-pro-600.ttf')}`;
    const document = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Habitat · actual Liquid evidence</title><style>${fixtureFonts}body{margin:0}button,input,select{font:inherit}</style><style>${assembled.headStyleText}</style></head><body><div data-theme-renderer="liquid">${assembled.html}</div></body></html>`;
    fs.writeFileSync(path.join(evidence, 'rendered', `${file}.html`), document);
    files.push({ file: `rendered/${file}.html`, engine: result.engine, status: result.status, warnings: result.warnings, bytes: Buffer.byteLength(document) });
  }
  fs.writeFileSync(path.join(evidence, 'render-fixtures.json'), JSON.stringify({ generatedAt: new Date().toISOString(), scope: 'Actual app productToLiquidDrop (canonical facts presentation) → LiquidRenderer → canonical page assembly. Fictional typed preview data; minimal body margin/input font reset and local copies of approved fonts for isolated rendering. Production font delivery is a separate app check. No hydrated app or HTTP persistence/lifecycle claim.', files, assertions: ['common dimensions', 'two distinct canonical-identity variant package/weight views', 'collection scalar display', 'round footprint', 'missing/invalid omission', 'private sibling omission'] }, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ fixtures: files.length, assertions: 'passed' }) + '\n');
}
main().catch(error => { process.stderr.write(String(error) + '\n'); process.exitCode = 1; });
