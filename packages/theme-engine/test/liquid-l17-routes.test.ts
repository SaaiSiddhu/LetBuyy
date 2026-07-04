// L17 — Routes Drop Parity (Phase E, LANE-A, E6).
// Extends buildLiquidScope() routes object with Shopify-convention account URLs.
// All new URLs are backed by existing storefront-runtime pages or API routes:
//   account_url: /store/[subdomain]/account/page.tsx (existing)
//   account_login_url: /store/[subdomain]/customers/login/page.tsx (created in E8/LANE-B)
//   account_register_url: /store/[subdomain]/customers/register (existing)
//   account_logout_url: POST /api/customer/logout (existing — POST only; must be used in a form, not a GET href)
//   all_products_collection_url: /store/[subdomain]/products/page.tsx (existing)
// Existing routes root_url, cart_url, search_url are preserved unchanged.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

// Helper: render a simple inline template (index) and inspect the rendered output
// by injecting a routes-dump into the spotlight section via an inline Liquid expression.
// We use a dedicated test fixture that renders a single section using the index template.
// Instead of modifying the bundle, we pass a test through a known section and inspect scope
// by rendering via a template that references routes variables.

async function renderRoutesTemplate(routeKey: string) {
  // Render the index template and grab the scope via the spotlight section which renders
  // {{ section.settings.heading }}. Instead, we render a custom simple template using
  // the bundle's existing sections to get the routes drop into scope.
  // The simplest approach: render with the index template; use a search-box section which
  // binds {{ routes.search_url }}. But we need to test ALL new route keys.
  // Strategy: build a short inline Liquid section source that dumps the routes object,
  // then render via the renderer's test route.
  // Since we cannot add ad-hoc section files (LANE-A scope), we verify the scope by
  // rendering the header template and checking existing link hrefs, plus validate the
  // routes object directly by inspecting the scope via a test helper section.
  //
  // Practical approach: create a minimal bundle fixture with a routes-dump section
  // that echos each route into the HTML, then render it.
  const { parseLiquidThemePackageBundle, THEME_LIQUID_BUNDLE_SCHEMA_VERSION, THEME_LIQUID_RENDERER_VERSION } = await import('../src/theme-bundle.ts');
  const testBundle = parseLiquidThemePackageBundle({
    schema_version: THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
    package: {
      slug: 'routes-test-bundle',
      name: 'Routes Test Bundle',
      version: '1.0.0',
      compatibility_range: `>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}`,
    },
    layout: {
      theme: {
        path: 'layout/theme.liquid',
        source: '{{ content_for_layout | raw }}',
      },
    },
    config: {
      settings_schema: { settings: {} },
      settings_data: { current: {} },
    },
    templates: {
      [routeKey]: {
        name: 'Routes test',
        sections: {
          'routes-dump': {
            type: 'routes-dump',
            settings: {},
          },
        },
        order: ['routes-dump'],
      },
    },
    sections: {
      'routes-dump': {
        path: 'sections/routes-dump.liquid',
        source: [
          '<div id="routes-test">',
          'root:{{ routes.root_url }}',
          'cart:{{ routes.cart_url }}',
          'search:{{ routes.search_url }}',
          'account:{{ routes.account_url }}',
          'login:{{ routes.account_login_url }}',
          'register:{{ routes.account_register_url }}',
          'logout:{{ routes.account_logout_url }}',
          'products:{{ routes.all_products_collection_url }}',
          '</div>',
          '{% schema %}{"name":"Routes Dump","settings":[],"presets":[{"name":"Routes Dump"}]}{% endschema %}',
        ].join('\n'),
        schema: {
          name: 'Routes Dump',
          settings: [],
          presets: [{ name: 'Routes Dump' }],
        },
      },
    },
    blocks: {},
    locales: {},
    renderer: {
      engine: 'liquid' as const,
      renderer_version: THEME_LIQUID_RENDERER_VERSION,
      liquid_ready: true as const,
      assets: {},
    },
  });

  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'routes-test-bundle', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: routeKey, type: routeKey, layoutKey: 'theme', sections: [] },
    liquidTemplateKey: routeKey,
    liquidBundle: testBundle,
  });
}

test('L17(a): routes.account_url renders /account', async () => {
  const result = await renderRoutesTemplate('index');
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /account:\/account/, 'account_url must be /account');
});

test('L17(b): routes.account_login_url renders /customers/login', async () => {
  const result = await renderRoutesTemplate('index');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /login:\/customers\/login/, 'account_login_url must be /customers/login');
});

test('L17(c): routes.account_register_url renders /customers/register', async () => {
  const result = await renderRoutesTemplate('index');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /register:\/customers\/register/, 'account_register_url must be /customers/register');
});

test('L17(d): routes.account_logout_url renders /api/customer/logout', async () => {
  const result = await renderRoutesTemplate('index');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /logout:\/api\/customer\/logout/, 'account_logout_url must be /api/customer/logout');
});

test('L17(e): routes.all_products_collection_url renders /products', async () => {
  const result = await renderRoutesTemplate('index');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /products:\/products/, 'all_products_collection_url must be /products');
});

test('L17(f): existing routes root_url, cart_url, search_url are still present and correct', async () => {
  const result = await renderRoutesTemplate('index');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /root:\//,   'root_url must be /');
  assert.match(html, /cart:\/cart/, 'cart_url must be /cart');
  assert.match(html, /search:\/search/, 'search_url must be /search');
});
