/** Fictional regression data only. No new merchant catalog seed or variant identity authority. */
import { FurnitureFactsSchema, FurnitureVariantFactsSchema, type ProductModel } from '../../../../packages/commerce-core/src/index';
import { HABITAT_DEMO_PRODUCTS } from '../../../../apps/commerce/web/src/lib/demo/habitat-demo';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { resolveStorefrontTemplate } from '../../../../apps/commerce/web/src/lib/theme-engine/template-resolver';
import { createHabitatTheme } from '../../../../packages/theme-engine/src/habitat-theme';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../packages/theme-engine/src/theme-bundle-core';
import { DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/theme-settings';
import { LiquidRenderer } from '../../../../packages/theme-engine/src/theme-renderer';
import type { StoreModel } from '../../../../packages/tenant-core/src/index';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export function furnitureFinishFixture(): ProductModel {
    const product = structuredClone(HABITAT_DEMO_PRODUCTS[0]);
    product.furniture = FurnitureFactsSchema.parse({ ...product.furniture,
        package: { unit: 'cm', width: 70, depth: 80, height: 76 }, weight: { value: 12, unit: 'kg' }, care: 'Product common care.',
    });
    product.variantOptions = [{ name: 'Finish', values: ['Natural teak', 'Smoked teak'] }, { name: 'Size', values: ['Standard', 'Compact'] }];
    product.variants = [
        { ...product.variants![0], options: { Finish: 'Natural teak', Size: 'Standard' }, furniture: FurnitureVariantFactsSchema.parse({
            finish: 'Natural teak', package: { unit: 'cm', width: 72, depth: 82, height: 78 }, weight: { value: 13.8, unit: 'kg' },
        }) },
        { ...product.variants![1], stock: 0, options: { Finish: 'Smoked teak', Size: 'Compact' }, furniture: FurnitureVariantFactsSchema.parse({
            finish: 'Smoked teak', assembled: { unit: 'in', width: 27 }, package: { unit: 'mm', width: 740, height: 780 },
            weight: { value: 14.2, unit: 'kg' }, materials: ['Variant-only oak'],
            assembly: { status: 'required', instructions: 'Variant assembly instruction.', tools: 'Supplied hex key' }, care: 'Variant-only care.',
        }) },
    ];
    return product;
}

export function furnitureUnknownFixture(): ProductModel {
    const product = furnitureFinishFixture();
    product.id = '7b669c70-4100-4000-8000-000000000099';
    product.name = 'Regression piece without furniture facts'; delete product.furniture;
    product.variantOptions = [{ name: 'Finish', values: ['Unspecified finish'] }];
    product.variants = [{ id: '7b669c70-4200-4000-8000-000000000099', product_id: product.id, title: 'Unspecified finish', name: 'Unspecified finish', price: 1200, stock: 2, options: { Finish: 'Unspecified finish' } }];
    return product;
}

export async function renderBoundFurniture(product: ProductModel) {
    const bundle = createHabitatTheme(createLetbuyyCoreLiquidThemeBundleFixture());
    const store: StoreModel = { id: '11111111-1111-4111-8111-111111111111', sellerId: '22222222-2222-4222-8222-222222222222', name: 'Owned furniture fixture', subdomain: 'habitat-finish-fixture', siteType: 'store', status: 'draft', selectedProductIds: [product.id], createdAt: '2026-10-23T00:00:00Z',
        templateConfig: { themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [], liquidBundle: bundle, liquidRenderingCanary: true } };
    const route = { type: 'product' as const, path: `/product/${product.id}`, subdomain: store.subdomain, resourceId: product.id };
    const plan = resolveStorefrontTemplate(store, route);
    const file = new URL('../../../../apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts', import.meta.url);
    const requireLocal = createRequire(file), appSrc = new URL('../../../../apps/commerce/web/src/', import.meta.url);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    let calls = 0;
    const service = new Proxy({}, { get: () => async () => { calls++; throw new Error('Unexpected furniture fixture service call'); } });
    const compiled = { exports: {} };
    new Function('require', 'module', 'exports', code)((id: string) => id === '@/lib/product-service' ? { ProductService: service } : requireLocal(id.startsWith('@/') ? fileURLToPath(new URL(id.slice(2), appSrc)) : id), compiled, compiled.exports);
    const { buildSectionDataPlan } = compiled.exports as typeof import('../../../../apps/commerce/web/src/lib/theme-engine/data-binding-engine');
    const data = await buildSectionDataPlan({ store, route, sections: plan.template.sections, preloadedProducts: [product] });
    const bound = data.get('habitat-product-selection')?.product;
    if (!bound || bound.id !== product.id || calls) throw new Error('Canonical bound product fixture mismatch');
    const drop = productToLiquidDrop(bound)!;
    const result = await new LiquidRenderer().render({ context: { storeId: store.id, subdomain: store.subdomain, path: route.path, previewMode: false, locale: 'en-IN' }, storeTemplate: store.templateConfig, routeTemplate: plan.template,
        liquidBundle: plan.liquidBundle, liquidTemplateKey: plan.liquidTemplateKey,
        liquidContext: { shop: { name: store.name }, product: drop, collection: { products: [] }, collections: [], section_products: Object.fromEntries([...data].map(([id, entry]) => [id, (entry.products ?? []).map(item => productToLiquidDrop(item)!)])) } });
    if (result.status !== 'rendered' || result.warnings.length || !result.liquid) throw new Error(JSON.stringify({ status: result.status, warnings: result.warnings }));
    return { result, drop, bound, serviceCalls: calls };
}
