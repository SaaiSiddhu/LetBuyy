// T1/W1 — no hardcoded root-absolute commerce path in any shipped section/block, plus a behavioral
// check that the header's cart link actually resolves through the store-prefixed routes drop.
//
// A "commerce path" here is any href/action/data-*-url attribute whose value starts with a single
// '/' (root-absolute) and is NOT one of the three paths proxy.ts intentionally reaches unprefixed:
//   - /api/*                (proxy.ts's middleware matcher excludes api/ entirely — reached directly)
//   - /contact               (proxy.ts matches req.nextUrl.pathname === '/contact' exactly)
//   - /store-access/password (proxy.ts matches req.nextUrl.pathname === '/store-access/password' exactly)
// Every other commerce link must come from the `routes` drop (store-prefixed) or the `store_url`
// filter (for merchant-typed relative paths in block/section settings), never a bare string literal.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

const ALLOWED_BARE_PATH_PREFIXES = [
  /^\/api\//,
  /^\/contact\b/,
  /^\/store-access\/password\b/,
];

// data-base-path values are already store-prefixed (`/store/{{ shop.subdomain }}`) at the
// SOURCE level via Liquid interpolation, not a bare literal — they don't match this regex at all
// (the regex requires a literal path segment immediately after the opening quote), but excluding
// the attribute name explicitly documents that these lines were checked, not skipped by accident.
const HARDCODED_PATH_PATTERN = /\b(?:href|action|data-search-url|data-logout-url)="(\/[^"{][^"]*)"/g;

function findHardcodedPaths(source: string): string[] {
  const hits: string[] = [];
  let match: RegExpExecArray | null;
  HARDCODED_PATH_PATTERN.lastIndex = 0;
  while ((match = HARDCODED_PATH_PATTERN.exec(source))) {
    const value = match[1];
    if (ALLOWED_BARE_PATH_PREFIXES.some((re) => re.test(value))) continue;
    hits.push(value);
  }
  // A bare href="/" (no characters between the slashes) isn't caught by the pattern above (it
  // requires >=1 char before the closing quote) — check it separately.
  if (/\bhref="\/"/.test(source)) hits.push('/');
  return hits;
}

test('T1/W1: no shipped section source contains a hardcoded root-absolute commerce path', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const offenders: string[] = [];
  for (const [key, section] of Object.entries(bundle.sections)) {
    for (const hit of findHardcodedPaths(section.source)) {
      offenders.push(`sections/${key}: ${hit}`);
    }
  }
  for (const [key, block] of Object.entries(bundle.blocks)) {
    for (const hit of findHardcodedPaths(block.source)) {
      offenders.push(`blocks/${key}: ${hit}`);
    }
  }
  assert.deepEqual(offenders, [], `hardcoded commerce paths found:\n${offenders.join('\n')}`);
});

test('T1/W1: layout/theme.liquid contains no hardcoded root-absolute commerce path', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const hits = findHardcodedPaths(bundle.layout.theme.source);
  assert.deepEqual(hits, [], `hardcoded commerce paths found in layout/theme.liquid:\n${hits.join('\n')}`);
});

test('T1/W1: header cart link resolves through routes.cart_url (store-prefixed), not a bare /cart', async () => {
  const result = await new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'snaz-test', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'index',
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const headerHtml = result.liquid?.header ?? result.liquid?.layoutHtml ?? '';
  assert.match(headerHtml, /href="\/store\/snaz-test\/cart"/, 'header cart link must be store-prefixed');
  assert.doesNotMatch(headerHtml, /href="\/cart"/, 'header cart link must not be bare /cart');
});

// Minimal bundle mirroring L17's renderRoutesTemplate pattern — isolates the store_url filter's
// contract (relative paths get store-prefixed; absolute/external/mailto/tel/anchor/empty pass
// through unchanged) from the default composition's own block content, which is out of this
// test's control (it comes from templates/header.json's merchant-editable preset data).
async function renderStoreUrlFilterProbe(value: string) {
  const { parseLiquidThemePackageBundle, THEME_LIQUID_BUNDLE_SCHEMA_VERSION, THEME_LIQUID_RENDERER_VERSION } = await import('../src/theme-bundle.ts');
  const testBundle = parseLiquidThemePackageBundle({
    schema_version: THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
    package: {
      slug: 'store-url-probe-bundle',
      name: 'Store URL Probe Bundle',
      version: '1.0.0',
      compatibility_range: `>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}`,
    },
    layout: { theme: { path: 'layout/theme.liquid', source: '{{ content_for_layout | raw }}' } },
    config: { settings_schema: { settings: {} }, settings_data: { current: {} } },
    templates: {
      index: {
        name: 'Store URL probe',
        sections: { 'store-url-probe': { type: 'store-url-probe', settings: {} } },
        order: ['store-url-probe'],
      },
    },
    sections: {
      'store-url-probe': {
        path: 'sections/store-url-probe.liquid',
        source: [
          `<div id="probe">{{ ${JSON.stringify(value)} | store_url }}</div>`,
          '{% schema %}{"name":"Store URL Probe","settings":[],"presets":[{"name":"Store URL Probe"}]}{% endschema %}',
        ].join('\n'),
        schema: { name: 'Store URL Probe', settings: [], presets: [{ name: 'Store URL Probe' }] },
      },
    },
    blocks: {},
    locales: {},
    renderer: { engine: 'liquid' as const, renderer_version: THEME_LIQUID_RENDERER_VERSION, liquid_ready: true as const, assets: {} },
  });

  const result = await new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'snaz-test', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'store-url-probe-bundle', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'index',
    liquidBundle: testBundle,
  });
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings?.join(', ')}`);
  return result.liquid?.layoutHtml ?? '';
}

test('T1/W1: store_url filter prefixes a merchant-typed relative path with the store base path', async () => {
  const html = await renderStoreUrlFilterProbe('/products');
  assert.match(html, /<div id="probe">\/store\/snaz-test\/products<\/div>/);
});

test('T1/W1: store_url filter passes an absolute/external URL through unchanged', async () => {
  const html = await renderStoreUrlFilterProbe('https://instagram.com/example');
  assert.match(html, /<div id="probe">https:\/\/instagram\.com\/example<\/div>/);
});

test('T1/W1: store_url filter passes mailto/tel/anchor values through unchanged', async () => {
  assert.match(await renderStoreUrlFilterProbe('mailto:hello@example.com'), /mailto:hello@example\.com/);
  assert.match(await renderStoreUrlFilterProbe('tel:+911234567890'), /tel:\+911234567890/);
  assert.match(await renderStoreUrlFilterProbe('#section'), /#section/);
});

test('T1/W1: store_url filter does not double-prefix an already-prefixed path', async () => {
  const html = await renderStoreUrlFilterProbe('/store/snaz-test/products');
  assert.match(html, /<div id="probe">\/store\/snaz-test\/products<\/div>/);
  assert.doesNotMatch(html, /\/store\/snaz-test\/store\/snaz-test/);
});
