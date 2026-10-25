/** Real factory → app bindings/mapper → Liquid → canonical assembly. No hydrated commerce. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, LiquidRenderer, LiquidThemePackageBundleSchema, type SectionModel } from '@letbuyy/theme-engine';
import { ToyFactsSchema, resolveToyFacts, type ProductModel } from '@letbuyy/commerce-core';
import { buildSectionDataPlan } from '../../../../apps/commerce/web/src/lib/theme-engine/data-binding-engine';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { assembleLiquidPageFromRenderResult } from '../../../../apps/commerce/web/src/lib/theme-engine/liquid-page-assembly';
import { getUrbanKicksDemoStore } from '../../../../apps/commerce/web/src/lib/demo/urban-kicks-demo';
import { PLAYFIELD_DEMO_PRODUCTS, PLAYFIELD_DEMO_NAVIGATION, withPlayfieldDemoContent } from '../../../../apps/commerce/web/src/lib/demo/playfield-demo';

const output = new URL('./actual-liquid/', import.meta.url);
const basePath = '/store/playfield-review';
const store = { ...getUrbanKicksDemoStore(), subdomain: 'playfield-review', selectedProductIds: [] };
const models = structuredClone(PLAYFIELD_DEMO_PRODUCTS);
const missing: ProductModel = { ...models[3], toys: null };
const cleared: ProductModel = { ...models[0], name: 'Pattern Studio · unknown sample edition', toys: resolveToyFacts(models[0].toys, { ageBands: [], contents: [], dimensions: null, additionalDimensions: [], materials: '', warnings: [] }) };
const different: ProductModel = { ...models[1], name: 'Paper Play · larger sample edition', toys: ToyFactsSchema.parse({ ageBands: ['9-12'], ageStatement: '9–12 years', interests: ['art'], contents: [{ quantity: 36, label: 'A5 paper sheets' }], contentsComplete: true, dimensions: { label: 'Each A5 sheet', length: 21, width: 14.8, unit: 'cm' }, materials: 'Coloured paper. Fictional sample product.' }) };
const scenes: { name: string; key: 'index' | 'collection' | 'product'; products: ProductModel[]; locale?: string; long?: boolean; query?: Record<string, string> }[] = [
  { name: 'home', key: 'index', products: models },
  { name: 'collection', key: 'collection', products: models.slice(0, 2), query: { age_band: '6-8', interest: 'art' } },
  { name: 'collection-all', key: 'collection', products: models },
  { name: 'product', key: 'product', products: models },
  { name: 'missing', key: 'product', products: [missing] },
  { name: 'edition-cleared', key: 'product', products: [cleared] },
  { name: 'edition-different', key: 'product', products: [different] },
  { name: 'empty', key: 'collection', products: [] },
  { name: 'long-copy', key: 'index', products: models, long: true },
  { name: 'hindi', key: 'index', products: models, locale: 'hi-IN', long: true },
];
const fontCss = [400, 500, 600, 700, 800].map((weight, index) => `@font-face{font-family:Inter;font-style:normal;font-weight:${weight};font-display:swap;src:url('/qa-font/inter-${index}.ttf') format('truetype')}`).join('\n');
async function main() {
  mkdirSync(output, { recursive: true });
  const records = [];
  for (const scene of scenes) {
    const bundle = LiquidThemePackageBundleSchema.parse(withPlayfieldDemoContent({ liquidBundle: createFirstPartyCatalogBundle('letbuyy-bloom', { designVersion: '2.0.0' }) }).liquidBundle);
    if (scene.long) Object.assign(bundle.templates.index.sections['playfield-hero-banner'].settings, scene.locale ? { heading: 'हर छोटी जिज्ञासा के लिए कुछ नया बनाएं और फिर से शुरुआत करें।', subheading: 'उम्र और रुचि के अनुसार गतिविधि चुनें। सामग्री और माप की जानकारी खरीदने से पहले पढ़ें।' } : { heading: 'Make a little room for the next wonderfully unexpected afternoon of curious ideas.', subheading: 'Choose a merchant-recommended age and an interest, then read the complete supplied product information before choosing an activity.' });
    const template = bundle.templates[scene.key];
    const sections: SectionModel[] = template.order.map((id, order) => ({ id, type: template.sections[id].type, settings: template.sections[id].settings, rendererKey: `liquid.section.${template.sections[id].type}`, isVisible: true, order }));
    const route = { type: scene.key, path: scene.key === 'index' ? basePath : scene.key === 'collection' ? `${basePath}/products` : `${basePath}/product/${scene.products[0]?.id}`, subdomain: 'playfield-review', searchParams: scene.query };
    const plan = await buildSectionDataPlan({ store, sections, route, preloadedProducts: scene.products });
    const products = scene.products.map(product => productToLiquidDrop(product, basePath)!);
    const result = await new LiquidRenderer().render({
      context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'playfield-review', path: route.path, previewMode: false, locale: scene.locale ?? 'en-IN', searchParams: scene.query },
      storeTemplate: { themeId: 'letbuyy-bloom', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, routeTemplate: { id: scene.key, type: scene.key, layoutKey: 'theme', sections: [] },
      liquidBundle: bundle, liquidTemplateKey: scene.key,
      liquidContext: { shop: { name: 'Playfield', email: 'sample@example.test' }, product: products[0], collection: { title: scene.key === 'collection' ? 'Find their next activity.' : '', products, total: products.length }, linklists: { main_menu: { links: PLAYFIELD_DEMO_NAVIGATION.main!.map(link => ({ title: link.label, url: link.href.replace('/store/urban-kicks-demo', basePath), active: false })) } }, section_products: Object.fromEntries(Array.from(plan.entries()).map(([id, data]) => [id, (data.products ?? []).map(product => productToLiquidDrop(product, basePath))])) },
    });
    if (result.status !== 'rendered' || result.warnings.length || !result.liquid) throw new Error(`${scene.name}: ${JSON.stringify(result.warnings)}`);
    const assembled = assembleLiquidPageFromRenderResult(result.liquid);
    const html = `<!doctype html><html lang="${scene.locale ?? 'en-IN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Playfield actual Liquid · ${scene.name}</title><style data-qa-offline-fonts>${fontCss}</style><style data-app-document-reset>body{margin:0}</style><style data-actual-assembled-theme>${assembled.headStyleText}</style></head><body>${assembled.html}</body></html>`;
    writeFileSync(new URL(`${scene.name}.html`, output), html);
    records.push({ name: scene.name, template: scene.key, locale: scene.locale ?? 'en-IN', warnings: result.warnings, bindings: [...plan.keys()], bytes: Buffer.byteLength(html) });
  }
  writeFileSync(new URL('../render-review.json', output), JSON.stringify({ pipeline: 'explicit v2 catalog factory → real buildSectionDataPlan with bounded preloaded synthetic products → real productToLiquidDrop → LiquidRenderer → assembleLiquidPageFromRenderResult', scope: 'Isolated renderer-only review; supplied edition fixtures are resolved canonical DTOs, not a live variant interaction. No hydration/API/DB/publish/transactions/lifecycle or production performance claim.', fonts: 'Approved M1 Inter bytes served locally, no source art changes. Hindi uses platform fallback where Inter lacks glyphs; production font delivery remains separate.', scenes: records }, null, 2) + '\n');
  process.stdout.write(`Rendered ${records.length} Playfield review scenes.\n`);
}
main().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
