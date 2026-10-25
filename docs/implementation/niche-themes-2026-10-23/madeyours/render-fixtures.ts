/** Owned static browser evidence; actual factory, dispatcher, binder, mapper, renderer and assembly. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { createFirstPartyCatalogBundle, LiquidRenderer, DEFAULT_THEME_SETTINGS, type LiquidThemePackageBundle, type SectionModel } from '../../../../packages/theme-engine/src/index'
import type { ProductModel } from '../../../../packages/commerce-core/src/index'
import type { StoreModel } from '../../../../packages/tenant-core/src/index'
import { resolveCatalogDemoContent } from '../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch'
import { catalogDemoRoute, catalogDemoStoreId } from '../../../../apps/commerce/web/src/lib/theme-engine/catalog-demo-data'
import { buildSectionDataPlan } from '../../../../apps/commerce/web/src/lib/theme-engine/data-binding-engine'
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop'
import { assembleLiquidPageFromRenderResult } from '../../../../apps/commerce/web/src/lib/theme-engine/liquid-page-assembly'
import { MADEYOURS_DEMO_PRODUCTS } from '../../../../apps/commerce/web/src/lib/demo/madeyours-demo'
import type { StorefrontRouteContext } from '../../../../apps/commerce/web/src/lib/theme-engine/types'

const output = 'docs/implementation/niche-themes-2026-10-23/madeyours'
const cssFile = 'apps/commerce/web/src/app/store/[subdomain]/liquid-theme.css'
const sources = [cssFile, 'packages/theme-engine/src/madeyours-theme.ts', 'packages/theme-engine/src/madeyours-styles.ts', 'packages/theme-engine/src/madeyours-discovery.ts', 'packages/theme-engine/src/theme-renderer.ts', 'packages/theme-engine/src/first-party-theme-catalog.ts', 'packages/commerce-core/src/madeyours-facts.ts', 'packages/commerce-core/src/product-fact-presentation.ts', 'apps/commerce/web/src/lib/demo/madeyours-demo.ts', 'apps/commerce/web/src/lib/demo/catalog-demo-dispatch.ts', 'apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts', 'apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts', 'apps/commerce/web/src/lib/theme-engine/liquid-page-assembly.ts', 'apps/commerce/web/src/lib/theme-engine/madeyours-personalization.ts']
const missing: ProductModel = { id: '7b669c70-9999-4000-8000-000000000001', name: 'Personalization details not supplied', description: 'Synthetic missing-data fixture. Product imagery, supported methods and production information are unavailable.', price: 1290, currency: 'INR', images: [], stock: 0, isActive: true, variants: [], variantOptions: [] }
const unicode = structuredClone(MADEYOURS_DEMO_PRODUCTS[0]); unicode.personalization.methods[0].character_set = 'unicode-letters'; unicode.name = 'Unicode letter capability sample'
const unavailable = structuredClone(MADEYOURS_DEMO_PRODUCTS[0]); unavailable.stock = 0; unavailable.variants?.forEach(variant => { variant.stock = 0 })
const scenes = [
  { file: 'home', key: 'index', route: '/' },
  { file: 'collection', key: 'collection', route: '/products' },
  { file: 'product', key: 'product', route: `/product/${MADEYOURS_DEMO_PRODUCTS[0].id}` },
  { file: 'notebook', key: 'product', route: `/product/${MADEYOURS_DEMO_PRODUCTS[1].id}` },
  { file: 'missing', key: 'product', route: `/product/${missing.id}`, model: missing },
  { file: 'unicode', key: 'product', route: `/product/${unicode.id}`, model: unicode },
  { file: 'unavailable', key: 'product', route: `/product/${unavailable.id}`, model: unavailable },
  { file: 'empty', key: 'collection', route: '/products', empty: true },
] as const

async function main() {
  fs.mkdirSync(path.join(output, 'rendered'), { recursive: true })
  fs.copyFileSync(cssFile, path.join(output, 'rendered/storefront.css'))
  const requireRoot = createRequire(path.resolve('package.json'))
  const requireTool = createRequire(requireRoot.resolve('tsx'))
  const esbuild = requireTool('esbuild') as { build(options: Record<string, unknown>): Promise<unknown> }
  await esbuild.build({ entryPoints: [path.join(output, 'personalization-browser.ts')], outfile: path.join(output, 'rendered/helper.js'), bundle: true, platform: 'browser', format: 'iife', target: 'es2022', minify: false })
  const fonts = [400, 500, 600, 700].map(weight => `@font-face{font-family:Inter;src:url('/fixture/inter-${weight}.ttf') format('truetype');font-style:normal;font-weight:${weight};font-display:swap}`).join('')
  const contextCss = `body{margin:0}button,input,select{font:inherit}:root{--font-main:Inter,Arial,sans-serif;--font-heading:Inter,Arial,sans-serif;--radius:8px;--card-bg:#fff;--card-text:#23243e;--card-border:#747999;--input-bg:#fff;--input-text:#23243e;--input-border:#747999;--text:#23243e;--text-secondary:#595d7d}`
  const files = []
  for (const scene of scenes) {
    const catalog = resolveCatalogDemoContent('letbuyy-nova', '2.0.0', { liquidBundle: createFirstPartyCatalogBundle('letbuyy-nova', { designVersion: '2.0.0' }) }, scene.route)
    assert.ok(catalog)
    const bundle = catalog.template.liquidBundle as LiquidThemePackageBundle
    const custom = 'model' in scene || 'empty' in scene
    const route: StorefrontRouteContext = custom ? { type: scene.key, path: scene.route, subdomain: 'madeyours-browser', resourceId: 'model' in scene ? scene.model.id : undefined } : catalogDemoRoute(catalog)
    const sections: SectionModel[] = bundle.templates[scene.key].order.map((id, order) => { const item = bundle.templates[scene.key].sections[id]; return { id, order, type: item.type, settings: item.settings, isVisible: !item.disabled } })
    const templateConfig = { themeId: 'letbuyy-nova', themeSettings: DEFAULT_THEME_SETTINGS, sections }
    const store: StoreModel = { id: custom ? '11111111-1111-4111-8111-111111111111' : catalogDemoStoreId(catalog), sellerId: '22222222-2222-4222-8222-222222222222', name: 'MadeYours', subdomain: route.subdomain, siteType: 'store', selectedProductIds: [], templateConfig, status: 'draft', createdAt: '2026-10-23T00:00:00Z' }
    const preloaded = 'model' in scene ? [scene.model, MADEYOURS_DEMO_PRODUCTS[1]] : 'empty' in scene ? [] : catalog.products
    const data = await buildSectionDataPlan({ store, sections, route, preloadedProducts: preloaded, ...(custom ? {} : { catalogDemo: catalog }) })
    const primary = [...data.values()].find(row => row.product)?.product ?? preloaded[0]
    const collectionProducts = scene.key === 'product' ? [] : [...data.values()].find(row => row.products)?.products ?? []
    const result = await new LiquidRenderer().render({
      context: { storeId: store.id, subdomain: store.subdomain, path: route.path, searchParams: route.searchParams, previewMode: false, locale: 'en-IN' }, storeTemplate: templateConfig,
      routeTemplate: { id: scene.key, type: scene.key, layoutKey: 'theme', sections }, liquidBundle: bundle, liquidTemplateKey: scene.key,
      liquidContext: { shop: { id: store.id, name: store.name, subdomain: store.subdomain }, product: productToLiquidDrop(primary), section_products: Object.fromEntries([...data].map(([id, row]) => [id, (row.products ?? []).map(model => productToLiquidDrop(model)!)])), collection: { title: 'Choose your base', products: collectionProducts.map(model => productToLiquidDrop(model)!), total: collectionProducts.length }, collections: catalog.collections.map(item => ({ id: item.id, title: item.title, handle: 'handle' in item ? item.handle : item.id, image: item.image_url })), linklists: { main_menu: { links: (catalog.navigation.main ?? []).map(item => ({ title: item.label, url: item.href, links: [] })) } } },
    })
    assert.equal(result.status, 'rendered', JSON.stringify(result.warnings)); assert.deepEqual(result.warnings, []); assert.ok(result.liquid)
    const assembled = assembleLiquidPageFromRenderResult(result.liquid)
    const html = `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MadeYours actual Liquid · ${scene.file}</title><link rel="stylesheet" href="/fixture/storefront.css"><style>${fonts}${contextCss}</style><style>${assembled.headStyleText}</style><script src="/fixture/helper.js" defer></script></head><body data-fixture-base-available="${primary?.stock ? 'true' : 'false'}"><div data-theme-renderer="liquid">${assembled.html}</div></body></html>`
    fs.writeFileSync(path.join(output, 'rendered', `${scene.file}.html`), html)
    files.push({ scene: scene.file, file: `rendered/${scene.file}.html`, template: scene.key, customFixture: custom, binder: 'buildSectionDataPlan', productId: primary?.id ?? null, sectionProductIds: Object.fromEntries([...data].map(([id, row]) => [id, (row.products ?? []).map(model => model.id)])), bytes: Buffer.byteLength(html), sha256: createHash('sha256').update(html).digest('hex') })
  }
  fs.writeFileSync(path.join(output, 'render-fixtures.json'), JSON.stringify({ scope: 'Actual explicit v2 factory and trusted demo dispatcher → actual app section binder → public product mapper → LiquidRenderer → canonical assembly and unchanged storefront CSS. Owned helper is bound for no-network UI only; synthetic base eligibility is not canonical variant/cart hydration. No Next routing, auth, API, DB, order or purchase claim.', context: 'Only margin/input-font reset, approved local Inter assets and existing app layout variable context. No repair stylesheet. Hindi expansion is UI stress; it does not expand the Latin-name product capability.', sources: sources.map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') })), files }, null, 2) + '\n')
  process.stdout.write(JSON.stringify({ scenes: files.length }) + '\n')
}
main().catch(error => { process.stderr.write(String(error.stack ?? error) + '\n'); process.exitCode = 1 })
