/** Task-owned static-response export. No app build, database, seed or production mutation. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { StorefrontDiscoveryQuerySchema, storefrontDiscoveryQueryFromEntries, type StorefrontDiscoveryQuery, type StorefrontDiscoveryFacet } from '../../../../../packages/commerce-core/src/index';
import { createFirstPartyCatalogBundle, LiquidRenderer, DEFAULT_THEME_SETTINGS } from '../../../../../packages/theme-engine/src/index';
import { resolveCatalogDemoContent } from '../../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch';
import { catalogDemoStoreId } from '../../../../../apps/commerce/web/src/lib/theme-engine/catalog-demo-data';
import { productToLiquidDrop } from '../../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { readStorefrontDiscoveryPayload } from '../../../../../services/api-gateway/src/lib/storefront-discovery';
import { projectDiscoveryPage, validateDiscoveryProductPage } from '../../../../../apps/commerce/web/src/lib/theme-engine/storefront-discovery';
import { assembleLiquidPageFromRenderResult } from '../../../../../apps/commerce/web/src/lib/theme-engine/liquid-page-assembly';
import { KINDRED_DEMO_PRODUCTS } from '../../../../../apps/commerce/web/src/lib/demo/kindred-demo';

const port = Number(process.argv[2]); assert.equal(port, 43275, 'Only allocated Kindred slot2 port43275');
const out = 'docs/implementation/niche-themes-2026-10-23/kindred/responsive-shopping-2026-10-23';
const css = 'apps/commerce/web/src/app/store/[subdomain]/liquid-theme.css';
const assets = 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/kindred-storybook/assets';
const sources = [css, 'packages/theme-engine/src/kindred-theme.ts', 'packages/theme-engine/src/kindred-discovery.ts', 'packages/theme-engine/src/kindred-styles.ts',
  'packages/theme-engine/src/theme-renderer.ts', 'packages/theme-engine/src/first-party-theme-catalog.ts', 'packages/commerce-core/src/storefront-discovery.ts',
  'apps/commerce/web/src/lib/theme-engine/storefront-discovery.ts', 'services/api-gateway/src/lib/storefront-discovery.ts',
  'apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts', 'apps/commerce/web/src/lib/theme-engine/liquid-page-assembly.ts',
  'apps/commerce/web/src/lib/demo/kindred-demo.ts', 'apps/commerce/web/src/lib/demo/catalog-demo-dispatch.ts'];
const digest = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const sourceHashes = sources.map(file => ({ file, sha256: digest(fs.readFileSync(file)) }));
const preservationFiles = fs.readdirSync('docs/implementation/niche-themes-2026-10-23/kindred/narrow-screenshots').filter(file => file.endsWith('.png')).map(file => 'docs/implementation/niche-themes-2026-10-23/kindred/narrow-screenshots/' + file);
const frozenPath = 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/kindred-storybook/frozen-visual-manifest.json';
const frozen = JSON.parse(fs.readFileSync(frozenPath, 'utf8'));
const preserve = [...preservationFiles, ...Object.keys(frozen.files).map(file => path.join(path.dirname(frozenPath), file))].map(file => ({ file, sha256: digest(fs.readFileSync(file)) }));
fs.mkdirSync(path.join(out, 'renders'), { recursive: true }); fs.copyFileSync(css, path.join(out, 'storefront.css'));
const fonts = fs.readFileSync(path.join(path.dirname(frozenPath), 'source/fonts.css'), 'utf8').replaceAll('../assets/', '/fixture/');
const contextCss = `body{margin:0}button,input,select{font:inherit}:root{--font-main:Lato,Arial,sans-serif;--font-heading:'Playfair Display',Georgia,serif;--radius:8px;--card-bg:#fffaf4;--card-text:#342c2c;--card-border:#c3b5b3;--input-bg:#fffaf4;--input-text:#342c2c;--input-border:#a99b98;--text:#342c2c;--text-secondary:#645858}`;
const states = ['filters', 'cross-query', 'empty', 'long-labels'] as const;
type State = typeof states[number];
const initial: Record<State, StorefrontDiscoveryQuery> = {
  filters: StorefrontDiscoveryQuerySchema.parse({ occasion: 'birthday', recipient: 'friend', min_price: 1000, max_price: 2000, limit: 1 }),
  'cross-query': StorefrontDiscoveryQuerySchema.parse({ occasion: 'birthday', recipient: 'friend', min_price: 1000, max_price: 2000, connector: ['usb-c', 'hdmi'], country_of_origin: 'India', category: 'Ready-made gifts', search: 'gift', sort: 'price-desc', limit: 1, page: 2 }),
  empty: StorefrontDiscoveryQuerySchema.parse({ occasion: 'retirement', recipient: 'friend', min_price: 1000, max_price: 2000, limit: 1 }),
  'long-labels': StorefrontDiscoveryQuerySchema.parse({ occasion: 'birthday', recipient: 'friend', min_price: 1000, max_price: 2000, limit: 1 }),
};
const fixture = { createdAt: new Date().toISOString(), scope: 'Current v2 factory/trusted demo + real mapper + admitted response reader/projection + Liquid/CSS/assembly; bounded synthetic static responses, not live query/filter correctness or installed acceptance.', sourceHashes, preservedFiles: preserve, widths: [320, 768, 1440], initial, renders: [] as Array<Record<string, unknown>>, requests: [] as Array<Record<string, unknown>>, pid: process.pid, port, fetchCalls: 0, resources: 'running' };
fs.writeFileSync(path.join(out, 'fixture-manifest.json'), JSON.stringify(fixture, null, 2) + '\n');
globalThis.fetch = async () => { fixture.fetchCalls++; throw new Error('No network data source is admitted to this static exporter.'); };

async function render(state: State, key: 'collection' | 'search', pathname: string, query: StorefrontDiscoveryQuery) {
  const catalog = resolveCatalogDemoContent('letbuyy-summit', '2.0.0', { liquidBundle: createFirstPartyCatalogBundle('letbuyy-summit', { designVersion: '2.0.0' }) }, key === 'search' ? '/search' : '/products'); assert.ok(catalog);
  const bundle = catalog.template.liquidBundle!;
  // Finite admitted fixture responses, using only existing canonical demonstration IDs/facts.
  // Unrelated connector filters and an unsupported occasion have explicit zero-result fixtures.
  let models = query.connector || query.occasion === 'retirement' ? [] : [...KINDRED_DEMO_PRODUCTS];
  if (query.recipient === 'family') models = models.slice(0, 1);
  if (['name', 'price-asc'].includes(query.sort)) models = [...models].reverse();
  const total = models.length, pageRows = models.slice((query.page - 1) * query.limit, query.page * query.limit);
  const facets: StorefrontDiscoveryFacet[] = total ? [
    { key: 'occasion', value: 'birthday', label: state === 'long-labels' ? 'जन्मदिन — A thoughtfully chosen celebration for someone whose everyday matters <img src=x onerror=bad()>' : 'Birthday', count: total },
    { key: 'occasion', value: 'thank-you', label: 'Thank you', count: total },
    { key: 'recipient', value: 'friend', label: state === 'long-labels' ? 'A friend — बहुत लंबे व्यापारी द्वारा दिए गए नाम और विवरण "quoted" <script>inert</script>' : 'A friend', count: total },
    { key: 'recipient', value: 'family', label: 'Family', count: 1 },
  ] : [];
  const payload = readStorefrontDiscoveryPayload({ data: pageRows.map(item => ({ id: item.id, price: item.price })), count: total, facets,
    matches: pageRows.map(item => ({ product_id: item.id, price: item.price, variant_ids: item.variants.map(variant => variant.id) })) }, query);
  const page = validateDiscoveryProductPage({ data: pageRows, total, page: query.page, limit: query.limit, has_more: query.page * query.limit < total, discovery: payload.discovery }, query);
  const projected = projectDiscoveryPage(page, pathname, query);
  const products = pageRows.map(model => productToLiquidDrop(model)!);
  const subdomain = `kindred-qa-${state}`;
  const result = await new LiquidRenderer().render({ context: { storeId: catalogDemoStoreId(catalog), subdomain, path: pathname, searchParams: query as unknown as Record<string, string>, previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, routeTemplate: { id: key, type: key, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key, liquidContext: { request: { path: pathname, query: projected.query },
      shop: { id: catalogDemoStoreId(catalog), subdomain, name: state === 'long-labels' ? 'Kindred उपहार और Thoughtfully Selected Everyday Celebrations' : 'Kindred', ...projected.shop },
      collection: { title: state === 'long-labels' ? 'Thoughtfully chosen gifts for very long merchant collection names — प्रियजनों के लिए उपहार' : 'Ready-made gifts', products, ...projected.collection },
      collections: catalog.collections, search: { terms: query.search ?? '', results: products, results_count: total },
      section_products: Object.fromEntries(Object.keys(bundle.templates[key].sections).map(id => [id, products])),
      linklists: { main_menu: { links: catalog.navigation.main.map(item => ({ title: item.label, url: item.href, links: [] })) } },
    } });
  assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []); assert.ok(result.liquid);
  const assembled = assembleLiquidPageFromRenderResult(result.liquid);
  const html = `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kindred supplementary shopping QA</title><link rel="stylesheet" href="/fixture/storefront.css"><style>${fonts}${contextCss}</style><style>${assembled.headStyleText}</style></head><body><div data-theme-renderer="liquid">${assembled.html}</div></body></html>`;
  const file = `${key}-${state}-${digest(JSON.stringify(query)).slice(0, 12)}.html`; fs.writeFileSync(path.join(out, 'renders', file), html);
  fixture.renders.push({ state, key, query, file: 'renders/' + file, total, ids: pageRows.map(item => item.id), htmlSha256: digest(html) });
  return html;
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`), pathname = url.pathname;
    if (pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const asset = pathname === '/fixture/storefront.css' ? path.join(out, 'storefront.css')
      : /^\/fixture\/(font-[0-4]\.ttf|identity-geist-sans-latin\.woff2)$/.test(pathname) ? path.join(assets, path.basename(pathname))
      : /^\/theme-assets\/kindred\/v2\/[a-z0-9-]+\.webp$/.test(pathname) ? path.join('apps/commerce/web/public/theme-assets/kindred/v2', path.basename(pathname)) : null;
    if (asset && fs.existsSync(asset)) { res.writeHead(200, { 'Content-Type': asset.endsWith('.css') ? 'text/css' : asset.endsWith('.webp') ? 'image/webp' : 'font/ttf', 'Cache-Control': 'no-store' }); fs.createReadStream(asset).pipe(res); return; }
    const match = pathname.match(/^\/store\/kindred-qa-(filters|cross-query|empty|long-labels)\/(products|search)$/);
    if (!match) { res.writeHead(404).end(); return; }
    const parsed = StorefrontDiscoveryQuerySchema.safeParse(storefrontDiscoveryQueryFromEntries(url.searchParams));
    fixture.requests.push({ pathname, entries: [...url.searchParams], accepted: parsed.success });
    if (!parsed.success) { res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ code: 'INVALID_QUERY', issues: parsed.error.issues })); return; }
    const html = await render(match[1] as State, match[2] === 'search' ? 'search' : 'collection', pathname, parsed.data);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(html);
  } catch (error) { fixture.requests.push({ error: String(error) }); res.writeHead(500).end('Static fixture render failed; see task-owned log.'); console.error(error); }
});
server.listen(port, '127.0.0.1', () => console.info(JSON.stringify({ owner: 'Kindred', slot: 2, port, pid: process.pid })));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => {
  fixture.resources = 'server_closed';
  const drift = sourceHashes.filter(row => digest(fs.readFileSync(row.file)) !== row.sha256);
  const changedPreviousEvidence = preserve.filter(row => digest(fs.readFileSync(row.file)) !== row.sha256);
  fs.writeFileSync(path.join(out, 'fixture-manifest.json'), JSON.stringify({ ...fixture, closedAt: new Date().toISOString(), sourceDrift: drift, changedPreviousEvidence }, null, 2) + '\n');
  process.exit(0);
}));
