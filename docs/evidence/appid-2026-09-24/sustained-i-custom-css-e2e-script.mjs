// SUSTAINED-I workstream 6 — real end-to-end proof that a synthetic merchant's saved custom_css
// travels through store loading (mapSupabaseToStore, the REAL function, via StoreService) into the
// Liquid render (the REAL LiquidRenderer) into a REAL Chromium tab, with:
//   1. a computed-style check (the CSS actually took visual effect, not just present as text)
//   2. a cross-store negative control (store B never gets store A's CSS)
//   3. a hostile-payload scope/security check (no breakout, no script execution) in the real DOM
//
// Loads apps/commerce/web/src/lib/store-service.ts FOR REAL under the react-server export
// condition (server-only's own conditional export, the same condition Next.js's RSC compiler
// activates) so mapSupabaseToStore -- the actual production code, not a re-implementation -- runs.
// The only thing faked is the network boundary (global fetch), the same technique this session's
// tenant-guard tests used against a fake PostgREST.
import http from 'node:http';
import { chromium } from '@playwright/test';

const ROOT = '/home/user/letbuyy-sustained-i';

function workerStorePayload(subdomain, customCss) {
  return {
    id: `11111111-1111-4111-8111-${subdomain === 'demo-store-a' ? 'aaaaaaaaaaaa' : 'bbbbbbbbbbbb'}`,
    name: subdomain === 'demo-store-a' ? 'Demo Store A' : 'Demo Store B',
    subdomain,
    status: 'published',
    theme_id: 'urban-kicks-liquid',
    locale: 'en-IN',
    site_settings: customCss !== undefined ? { custom_css: customCss } : {},
    template_config: {},
    created_at: '2026-01-01T00:00:00Z',
  };
}

async function loadRealStoreService() {
  // tsx/cjs registers the TS loader; --conditions=react-server is passed via NODE_OPTIONS since
  // this file itself runs under plain `node`, not a child process we control the flags of directly.
  const mod = await import('/home/user/letbuyy-sustained-i/apps/commerce/web/src/lib/store-service.ts');
  return mod.StoreService;
}

async function main() {
  // Fake the network boundary: any /storefront/<handle> read returns that store's synthetic
  // payload; any /storefront/<handle>/navigation/* returns an empty nav bundle. Real store-service
  // code (fetchWorkerStore, fetchWorkerNavigationBundle, mapSupabaseToStore) runs unmodified.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = new URL(String(url));
    if (u.pathname.includes('/navigation')) {
      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    const handle = u.pathname.split('/').filter(Boolean).pop();
    const customCss = handle === 'demo-store-a'
      ? '.lb-hero-banner { color: rebeccapurple; background: hotpink; }'
      : handle === 'demo-store-b'
        ? undefined // store B has NO custom CSS saved -- the cross-store negative control
        : handle === 'demo-store-hostile'
          ? '</style><script>window.__XSS__=1</script><style>.hero{color:red}'
          : undefined;
    return new Response(JSON.stringify({ success: true, data: workerStorePayload(handle, customCss) }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const StoreService = await loadRealStoreService();

  const storeA = await StoreService.getStoreBySubdomain('demo-store-a');
  const storeB = await StoreService.getStoreBySubdomain('demo-store-b');
  const storeHostile = await StoreService.getStoreBySubdomain('demo-store-hostile');
  globalThis.fetch = originalFetch;

  console.log('storeA.templateConfig.customCss =', JSON.stringify(storeA.templateConfig.customCss));
  console.log('storeB.templateConfig.customCss =', JSON.stringify(storeB.templateConfig.customCss));
  console.log('storeHostile.templateConfig.customCss =', JSON.stringify(storeHostile.templateConfig.customCss));

  if (storeA.templateConfig.customCss !== '.lb-hero-banner { color: rebeccapurple; background: hotpink; }') {
    throw new Error('FAIL: store A did not receive its own saved custom_css through the real mapSupabaseToStore bridge');
  }
  if (storeB.templateConfig.customCss !== undefined) {
    throw new Error('FAIL: store B (no saved custom_css) got a customCss value it never saved -- cross-store leak in the loading layer itself');
  }

  // Now render each store's page through the REAL LiquidRenderer, using each store's own
  // templateConfig.customCss exactly as commerce/web's real render path does.
  const { LiquidRenderer, createUrbanKicksLiquidThemeBundleFixture, DEFAULT_THEME_SETTINGS } =
    await import(`${ROOT}/packages/theme-engine/src/index.ts`);

  async function renderStore(store) {
    const renderer = new LiquidRenderer();
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const result = await renderer.render({
      context: { storeId: store.id, subdomain: store.subdomain, path: '/', previewMode: true, locale: 'en' },
      storeTemplate: { storeId: store.id, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [], customCss: store.templateConfig.customCss },
      routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
      liquidBundle: bundle,
    });
    if (result.status !== 'rendered') throw new Error(`render failed for ${store.subdomain}: ${JSON.stringify(result.warnings)}`);
    return result.liquid.layoutHtml;
  }

  const htmlA = await renderStore(storeA);
  const htmlB = await renderStore(storeB);
  const htmlHostile = await renderStore(storeHostile);

  // Serve each store's REAL rendered HTML at its own path -- simulating separate store origins the
  // way the real deployment does (one subdomain per store).
  const server = http.createServer((req, res) => {
    const path = req.url;
    res.writeHead(200, { 'content-type': 'text/html' });
    if (path === '/store-a') return res.end(htmlA);
    if (path === '/store-b') return res.end(htmlB);
    if (path === '/store-hostile') return res.end(htmlHostile);
    res.end('not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  try {
    const page = await browser.newPage();

    // --- Test 1: store A's custom CSS took real visual effect (computed style, not text match) ---
    await page.goto(`${base}/store-a`);
    const heroA = page.locator('.lb-hero-banner').first();
    const colorA = await heroA.evaluate((el) => getComputedStyle(el).color);
    const bgA = await heroA.evaluate((el) => getComputedStyle(el).backgroundColor);
    console.log('TEST1 store A computed color:', colorA, 'background:', bgA);
    // rebeccapurple = rgb(102, 51, 153); hotpink = rgb(255, 105, 180)
    if (colorA !== 'rgb(102, 51, 153)') throw new Error(`TEST1 FAILED: store A's .hero color did not take real effect, got ${colorA}`);
    if (bgA !== 'rgb(255, 105, 180)') throw new Error(`TEST1 FAILED: store A's .hero background did not take real effect, got ${bgA}`);

    // --- Test 2: cross-store negative control -- store B (no saved CSS) shows NONE of store A's styling ---
    await page.goto(`${base}/store-b`);
    const heroB = page.locator('.lb-hero-banner').first();
    const colorB = await heroB.evaluate((el) => getComputedStyle(el).color);
    const bgB = await heroB.evaluate((el) => getComputedStyle(el).backgroundColor);
    console.log('TEST2 store B computed color:', colorB, 'background:', bgB);
    if (colorB === 'rgb(102, 51, 153)') throw new Error('TEST2 FAILED: store B leaked store A\'s custom CSS color');
    if (bgB === 'rgb(255, 105, 180)') throw new Error('TEST2 FAILED: store B leaked store A\'s custom CSS background');
    const hasCustomCssTagB = await page.locator('[data-lb-custom-css]').count();
    if (hasCustomCssTagB !== 0) throw new Error('TEST2 FAILED: store B rendered a custom-CSS style tag despite never saving one');

    // --- Test 3: a hostile payload (style-tag breakout attempt + inline <script>) never executes
    // or breaks scope in the real, rendered DOM ---
    await page.goto(`${base}/store-hostile`, { waitUntil: 'load' });
    const xssFlag = await page.evaluate(() => window.__XSS__);
    console.log('TEST3 window.__XSS__ after loading hostile payload:', xssFlag);
    if (xssFlag === 1) throw new Error('TEST3 FAILED: hostile custom CSS payload executed a script in the real browser');
    const scriptTags = await page.locator('script:has-text("__XSS__")').count();
    if (scriptTags !== 0) throw new Error('TEST3 FAILED: the injected <script> tag survived sanitization into the real DOM');

    console.log('ALL CUSTOM-CSS E2E CHECKS PASSED');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
