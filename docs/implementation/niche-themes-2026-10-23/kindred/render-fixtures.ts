/** Static browser evidence: actual factory, app binder/mapper, Liquid and canonical page assembly. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog'
import { LiquidRenderer, DEFAULT_THEME_SETTINGS, type LiquidThemePackageBundle, type SectionModel } from '../../../../packages/theme-engine/src/index'
import type { ProductModel } from '../../../../packages/commerce-core/src/index'
import type { StoreModel } from '../../../../packages/tenant-core/src/index'
import { resolveCatalogDemoContent } from '../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch'
import { catalogDemoRoute, catalogDemoStoreId } from '../../../../apps/commerce/web/src/lib/theme-engine/catalog-demo-data'
import { buildSectionDataPlan } from '../../../../apps/commerce/web/src/lib/theme-engine/data-binding-engine'
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop'
import { assembleLiquidPageFromRenderResult } from '../../../../apps/commerce/web/src/lib/theme-engine/liquid-page-assembly'
import { KINDRED_DEMO_PRODUCTS, KINDRED_DEMO_DISCOVERY } from '../../../../apps/commerce/web/src/lib/demo/kindred-demo'
import type { StorefrontRouteContext } from '../../../../apps/commerce/web/src/lib/theme-engine/types'

const output = 'docs/implementation/niche-themes-2026-10-23/kindred'
const cssFile = 'apps/commerce/web/src/app/store/[subdomain]/liquid-theme.css'
const sources = [cssFile, 'packages/theme-engine/src/kindred-theme.ts', 'packages/theme-engine/src/kindred-styles.ts', 'packages/theme-engine/src/kindred-discovery.ts', 'packages/theme-engine/src/theme-renderer.ts', 'packages/theme-engine/src/first-party-theme-catalog.ts', 'packages/commerce-core/src/kindred-facts.ts', 'packages/commerce-core/src/product-fact-presentation.ts', 'apps/commerce/web/src/lib/demo/kindred-demo.ts', 'apps/commerce/web/src/lib/demo/catalog-demo-dispatch.ts', 'apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts', 'apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts', 'apps/commerce/web/src/lib/theme-engine/liquid-page-assembly.ts']
const missing: ProductModel = { id: '7b669c70-4199-4000-8000-000000000001', name: 'Gift set details not supplied', description: 'Synthetic missing-data fixture. Contents and photographs have not been supplied.', price: 690, currency: 'INR', images: [], stock: 0, isActive: true, variants: [], variantOptions: [] }
const invalidMedia: ProductModel = { ...structuredClone(KINDRED_DEMO_PRODUCTS[0]), gifts: { ...structuredClone(KINDRED_DEMO_PRODUCTS[0].gifts), mediaRoles: { openBox: 19, closedBox: 18 } } }
const scenes = [
    { file: 'home', key: 'index', route: '/' },
    { file: 'collection', key: 'collection', route: '/products' },
    { file: 'product', key: 'product', route: `/product/${KINDRED_DEMO_PRODUCTS[0].id}` },
    { file: 'desk-product', key: 'product', route: `/product/${KINDRED_DEMO_PRODUCTS[1].id}` },
    { file: 'missing-product', key: 'product', route: '/product/missing-fixture', model: missing },
    { file: 'invalid-media', key: 'product', route: '/product/invalid-media-fixture', model: invalidMedia },
    { file: 'empty-collection', key: 'collection', route: '/products', empty: true },
    { file: 'home-finder-presentation', key: 'index', route: '/', configured: true },
    { file: 'collection-filters-presentation', key: 'collection', route: '/products?occasion=birthday&recipient=friend&min_price=1000&max_price=2000', configured: true },
] as const

async function main() {
    fs.mkdirSync(path.join(output, 'rendered'), { recursive: true })
    fs.copyFileSync(cssFile, path.join(output, 'rendered/storefront.css'))
    const fonts = fs.readFileSync('docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/kindred-storybook/source/fonts.css', 'utf8').replaceAll('../assets/', '/fixture/')
    const contextCss = `body{margin:0}button,input,select{font:inherit}:root{--font-main:Lato,Arial,sans-serif;--font-heading:'Playfair Display',Georgia,serif;--radius:8px;--card-bg:#fffaf4;--card-text:#342c2c;--card-border:#c3b5b3;--input-bg:#fffaf4;--input-text:#342c2c;--input-border:#a99b98;--text:#342c2c;--text-secondary:#645858}`
    const files = []
    for (const scene of scenes) {
        const catalog = resolveCatalogDemoContent('letbuyy-summit', '2.0.0', { liquidBundle: createFirstPartyCatalogBundle('letbuyy-summit', { designVersion: '2.0.0' }) }, scene.route)
        assert.ok(catalog)
        const bundle = catalog.template.liquidBundle as LiquidThemePackageBundle
        const custom = 'model' in scene || 'empty' in scene
        const route: StorefrontRouteContext = custom ? { type: scene.key, path: scene.route, subdomain: 'kindred-browser', resourceId: 'model' in scene ? scene.model.id : undefined } : catalogDemoRoute(catalog)
        const sections: SectionModel[] = bundle.templates[scene.key].order.map((id, order) => { const item = bundle.templates[scene.key].sections[id]; return { id, order, type: item.type, settings: item.settings, isVisible: !item.disabled } })
        const templateConfig = { themeId: 'letbuyy-summit', themeSettings: DEFAULT_THEME_SETTINGS, sections }
        const store: StoreModel = { id: custom ? '11111111-1111-4111-8111-111111111111' : catalogDemoStoreId(catalog), sellerId: '22222222-2222-4222-8222-222222222222', name: 'Kindred', subdomain: route.subdomain, siteType: 'store', selectedProductIds: [], templateConfig, status: 'draft', createdAt: '2026-10-23T00:00:00Z' }
        const preloaded = 'model' in scene ? [scene.model, KINDRED_DEMO_PRODUCTS[1]] : 'empty' in scene ? [] : catalog.products
        const data = await buildSectionDataPlan({ store, sections, route, preloadedProducts: preloaded, ...(custom ? {} : { catalogDemo: catalog }) })
        const sectionProducts = Object.fromEntries([...data].map(([id, row]) => [id, (row.products ?? []).map(model => productToLiquidDrop(model)!)]))
        const primary = [...data.values()].find(row => row.product)?.product ?? preloaded[0]
        const collectionProducts = scene.key === 'product' ? [] : [...data.values()].find(row => row.products)?.products ?? []
        const result = await new LiquidRenderer().render({
            context: { storeId: store.id, subdomain: store.subdomain, path: route.path, searchParams: route.searchParams, previewMode: false, locale: 'en-IN' },
            storeTemplate: templateConfig,
            routeTemplate: { id: scene.key, type: scene.key, layoutKey: 'theme', sections }, liquidBundle: bundle, liquidTemplateKey: scene.key,
            liquidContext: {
                shop: { id: store.id, name: store.name, description: 'Fictional ready-made gifts sample', subdomain: store.subdomain, ...('configured' in scene ? KINDRED_DEMO_DISCOVERY : {}) },
                product: productToLiquidDrop(primary), section_products: sectionProducts,
                collection: { title: 'Ready-made gifts', products: collectionProducts.map(model => productToLiquidDrop(model)!), total: collectionProducts.length },
                collections: catalog.collections,
                linklists: { main_menu: { links: catalog.navigation.main.map(item => ({ title: item.label, url: item.href, links: [] })) } },
            },
        })
        assert.equal(result.status, 'rendered', JSON.stringify(result.warnings)); assert.deepEqual(result.warnings, []); assert.ok(result.liquid)
        const assembled = assembleLiquidPageFromRenderResult(result.liquid)
        const html = `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kindred actual Liquid · ${scene.file}</title><link rel="stylesheet" href="/fixture/storefront.css"><style>${fonts}${contextCss}</style><style>${assembled.headStyleText}</style></head><body><div data-theme-renderer="liquid">${assembled.html}</div></body></html>`
        fs.writeFileSync(path.join(output, 'rendered', `${scene.file}.html`), html)
        files.push({ scene: scene.file, file: `rendered/${scene.file}.html`, template: scene.key, binder: 'buildSectionDataPlan', dataSource: custom ? 'explicit bounded missing/invalid preloaded fixture' : 'trusted catalog demo dispatcher', presentationOnlyCapability: 'configured' in scene, warnings: result.warnings, bytes: Buffer.byteLength(html), sha256: createHash('sha256').update(html).digest('hex') })
    }
    fs.writeFileSync(path.join(output, 'render-fixtures.json'), JSON.stringify({ scope: 'Actual explicit v2 catalog factory and dispatcher → actual app section binder → public ProductModel mapper → LiquidRenderer → canonical app assembly + unchanged storefront CSS. Static presentation evidence, without Next routing, hydration, API query, identity, DB or purchase/lifecycle claims.', context: 'Only document margin/input-font reset, approved local fonts and existing app-layout CSS variable context. No repair stylesheet. Baseline gift capability remains absent; configured finder/filter scenes are explicitly presentation-only.', sources: sources.map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') })), files }, null, 2) + '\n')
    process.stdout.write(JSON.stringify({ scenes: files.length, warnings: files.flatMap(file => file.warnings) }) + '\n')
}
main().catch(error => { process.stderr.write(String(error.stack ?? error) + '\n'); process.exitCode = 1 })
