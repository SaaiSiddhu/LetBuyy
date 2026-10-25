/** Isolated visual fixture. Real factory/bindings/mapper/renderer/assembly; no hydrated commerce. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, LiquidRenderer, LiquidThemePackageBundleSchema, type SectionModel } from '@letbuyy/theme-engine';
import { buildSectionDataPlan } from '../../../../apps/commerce/web/src/lib/theme-engine/data-binding-engine';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { assembleLiquidPageFromRenderResult } from '../../../../apps/commerce/web/src/lib/theme-engine/liquid-page-assembly';
import { getUrbanKicksDemoStore } from '../../../../apps/commerce/web/src/lib/demo/urban-kicks-demo';
import { CIRCUIT_DEMO_PRODUCTS, CIRCUIT_DEMO_COLLECTIONS, circuitDemoNavigation, withCircuitDemoContent } from '../../../../apps/commerce/web/src/lib/demo/circuit-demo';
import type { ProductModel } from '@letbuyy/commerce-core';

const out = new URL('./actual-liquid/', import.meta.url);mkdirSync(out, { recursive: true });
const basePath = '/store/circuit-review';
const store = { ...getUrbanKicksDemoStore(), subdomain: 'circuit-review', selectedProductIds: [] };
const navigation = circuitDemoNavigation(basePath);
const models = structuredClone(CIRCUIT_DEMO_PRODUCTS);
const missing: ProductModel = { ...models[0], images: [], electronics: null };
const invalid = { ...missing, electronics: { power_input_w: 65, pass_through_output_w: 85, api_key: 'private-sentinel' }, electronics_video_summary: 'forged' } as unknown as ProductModel;
const scenes = [
  { name: 'home', key: 'index', products: models },
  { name: 'collection', key: 'collection', products: models },
  { name: 'product', key: 'product', products: models },
  { name: 'missing', key: 'product', products: [missing] },
  { name: 'empty', key: 'collection', products: [] },
  { name: 'invalid', key: 'product', products: [invalid] },
] as const;
const fontCss = [400, 500, 600, 700, 800].map((weight, i) => `@font-face{font-family:Inter;font-style:normal;font-weight:${weight};font-display:swap;src:url('/qa-font/inter-${i}.ttf') format('truetype')}`).join('\n');
const records: Array<{ scene: string; key: string; warnings: string[]; bytes: number }> = [];
async function main() {
for (const scene of scenes) {
  const configured = withCircuitDemoContent({ liquidBundle: createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0' }) });
  const bundle = LiquidThemePackageBundleSchema.parse(configured.liquidBundle);
  const template = bundle.templates[scene.key];
  const sections: SectionModel[] = template.order.map((id, order) => ({ id, type: template.sections[id].type, settings: template.sections[id].settings, rendererKey: `liquid.section.${template.sections[id].type}`, isVisible: true, order }));
  const route = { type: scene.key, path: scene.key === 'index' ? basePath : `${basePath}/products`, subdomain: 'circuit-review' };
  const plan = await buildSectionDataPlan({ store, sections, route, preloadedProducts: [...scene.products] });
  const products = scene.products.map(item => productToLiquidDrop(item, basePath)!);
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'circuit-review', path: route.path, previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-forge', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, routeTemplate: { id: scene.key, type: scene.key, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: scene.key,
    liquidContext: { shop: { name: 'Circuit', email: 'support@example.test' }, product: products[0], collections: CIRCUIT_DEMO_COLLECTIONS, collection: { title: 'Accessories', products, total: products.length, pagination: { page: 1, pages: 1 } }, linklists: { main_menu: { links: navigation.main!.map(row => ({ title: row.label, url: row.href, active: false })) } }, section_products: Object.fromEntries(Array.from(plan.entries()).map(([id, data]) => [id, (data.products ?? []).map(item => productToLiquidDrop(item, basePath))])) },
  });
  if (result.status !== 'rendered' || result.warnings.length) throw new Error(`${scene.name}: ${JSON.stringify(result.warnings)}`);
  const assembled = assembleLiquidPageFromRenderResult(result.liquid!);
  const html = `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Circuit actual Liquid · ${scene.name}</title><style data-qa-offline-fonts>${fontCss}</style><style data-app-document-reset>body{margin:0}</style><style data-actual-assembled-theme>${assembled.headStyleText}</style></head><body>${assembled.html}</body></html>`;
  writeFileSync(new URL(`${scene.name}.html`, out), html);
  records.push({ scene: scene.name, key: scene.key, warnings: result.warnings, bytes: Buffer.byteLength(html) });
}
writeFileSync(new URL('../render-review.json', out), JSON.stringify({ purpose: 'Isolated actual Liquid visual review, not a live storefront or hydrated commerce test', pipeline: 'public explicit v2 catalog → real app bounded data binding → real app product mapper → LiquidRenderer → real page assembly', fontDelivery: 'Approved M1 Inter font bytes served locally for deterministic offline review; production canonical Google Fonts delivery remains a separate integration/performance gate', scenes: records }, null, 2) + '\n');
}
main().catch(error => { process.stderr.write(String(error));process.exitCode = 1; });
