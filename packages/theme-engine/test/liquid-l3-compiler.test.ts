// L3 — Theme Compiler (Full Liquid V1). Executable: compiles a portable template_config to a Liquid
// bundle, proves the compiled bundle renders the edited sections, and that merchant strings are escaped.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  LiquidThemePackageBundleSchema,
  compilePortableToLiquidBundle,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

// Mirrors the urban-kicks portable default_template (seed) the editor would persist.
const PORTABLE = {
  themeId: 'urban-kicks',
  themeSettings: { primaryColor: '#8B5CF6', accentColor: '#F59E0B', surfaceColor: '#F8FAFC' },
  sections: {
    header: { type: 'header', settings: { storeName: 'Urban Kicks', showSearch: true, showCart: true } },
    template: [
      { id: 'hero-1', type: 'heroBanner', settings: { heading: 'Urban Kicks', subtitle: 'Streetwear' }, isVisible: true },
      { id: 'categories-1', type: 'categoryGrid', settings: { title: 'Shop by category' }, isVisible: true },
      { id: 'products-1', type: 'productGrid', settings: { title: 'Featured drops' }, isVisible: true },
      { id: 'trust-1', type: 'trustBadges', settings: { title: 'Confident checkout' }, isVisible: true },
    ],
    footer: { type: 'footer', settings: { copyrightText: 'Urban Kicks' } },
  },
};

function renderBundle(bundle) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle,
  });
}

test('L3: compiler maps portable section types -> liquid types and validates the bundle', () => {
  const { bundle, warnings } = compilePortableToLiquidBundle(PORTABLE);
  assert.equal(LiquidThemePackageBundleSchema.safeParse(bundle).success, true);
  assert.equal(bundle.renderer.engine, 'liquid');
  assert.deepEqual(bundle.templates.index.order, ['hero-1', 'categories-1', 'products-1', 'trust-1']);
  assert.equal(bundle.templates.index.sections['hero-1'].type, 'hero-banner');
  assert.equal(bundle.templates.index.sections['categories-1'].type, 'category-grid');
  assert.equal(bundle.templates.index.sections['products-1'].type, 'product-grid');
  assert.equal(bundle.templates.index.sections['trust-1'].type, 'trust-badges');
  assert.equal(bundle.templates.header.sections['header-default'].type, 'header');
  assert.equal(bundle.templates.footer.sections['footer-default'].type, 'footer');
  // settings carried through
  assert.equal(bundle.templates.index.sections['hero-1'].settings.heading, 'Urban Kicks');
  assert.deepEqual(warnings, []);
});

test('L3: round-trip — the compiled bundle renders the edited sections', async () => {
  const { bundle } = compilePortableToLiquidBundle(PORTABLE);
  const result = await renderBundle(bundle);
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  // the edited hero heading appears, and the section types resolved to styled lb-* sections (L2)
  assert.match(html, /Urban Kicks/);
  assert.match(html, /lb-hero-banner|data-section-id/);
});

test('L3: invisible + unmapped sections are dropped; never emits an invalid bundle', () => {
  const { bundle, warnings } = compilePortableToLiquidBundle({
    sections: {
      template: [
        { id: 'keep', type: 'heroBanner', settings: {}, isVisible: true },
        { id: 'hidden', type: 'productGrid', settings: {}, isVisible: false },
        { id: 'bogus', type: 'totallyUnknownSection', settings: {} },
      ],
    },
  });
  assert.equal(LiquidThemePackageBundleSchema.safeParse(bundle).success, true);
  assert.deepEqual(bundle.templates.index.order, ['keep']);
  assert.ok(warnings.some((w) => /Unmapped/.test(w)));
});

test('L3: empty / garbage input compiles to a valid bundle without throwing', () => {
  for (const input of [{}, { sections: {} }, { sections: { template: [] } }, { sections: { template: [{ type: 123 }, null] } }]) {
    const { bundle, warnings } = compilePortableToLiquidBundle(input);
    assert.equal(LiquidThemePackageBundleSchema.safeParse(bundle).success, true, `valid for ${JSON.stringify(input)}`);
    assert.ok(warnings.some((w) => /No mappable sections/.test(w)));
  }
});

test('L3: merchant-authored strings are escaped, not raw-injected (security)', async () => {
  const { bundle } = compilePortableToLiquidBundle({
    sections: {
      template: [{ id: 'x', type: 'heroBanner', settings: { heading: '<script>alert(1)</script><img src=x onerror=alert(2)>' }, isVisible: true }],
    },
  });
  const result = await renderBundle(bundle);
  const html = result.liquid?.layoutHtml ?? '';
  // No LIVE injection: no real <script> tag, no <img> carrying an event handler.
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img[^>]*onerror=/i);
  // Proof it was rendered as escaped inert text (settings are escaped, never raw-injected).
  assert.match(html, /&lt;(script|img)/i);
});
