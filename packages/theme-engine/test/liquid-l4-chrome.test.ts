// L4 — Liquid Chrome (Full Liquid V1). The LiquidRenderer now renders the header/footer templates so a
// Liquid page can wear Liquid chrome (not React). Nav links bind from the header template's link blocks.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

async function render() {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    // T1: header/footer storeName no longer hardcodes the theme's own brand — it falls back to the
    // real merchant shop.name when the merchant hasn't set a custom section storeName. Pass a real
    // shop name here so this test exercises that fallback rather than a fabricated theme brand string.
    // T6/W0: the fixture no longer ships example `link` blocks (see theme-bundle.ts's header-default/
    // footer-default), so linklists.main_menu — now the shipped default nav source, not a mutated
    // override — is supplied here to exercise the actual default rendering path.
    liquidContext: {
      shop: { name: 'Local Kicks Test Store' },
      linklists: { main_menu: { handle: 'main_menu', title: 'Main Menu', links: [
        { title: 'Products', url: '/products', active: false, links: [] },
        { title: 'Collections', url: '/collections/new-arrivals', active: false, links: [] },
      ] } },
    },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('L4: renderer emits Liquid header chrome with the store name + nav links', async () => {
  const result = await render();
  assert.equal(result.status, 'rendered');
  const header = result.liquid?.header ?? '';
  assert.match(header, /class="lb-header"/);
  assert.match(header, /Local Kicks Test Store/);     // header storeName falls back to shop.name
  assert.match(header, /Products/);        // nav link, from linklists.main_menu (the shipped default)
  assert.match(header, /Collections/);     // nav link, from linklists.main_menu (the shipped default)
});

test('L4: renderer emits Liquid footer chrome', async () => {
  const result = await render();
  const footer = result.liquid?.footer ?? '';
  assert.match(footer, /class="lb-footer"/);
});

test('L4: a legacy platform email never masks opted-in merchant contact', async () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  bundle.templates.footer.sections['footer-default'].settings.contactEmail = 'help@letbuyy.com';
  const result = await new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidContext: { shop: { name: 'Local Kicks', contact_email: 'merchant@example.invalid' } },
    liquidBundle: bundle,
  });
  const footer = result.liquid?.footer ?? '';
  assert.match(footer, /mailto:merchant@example\.invalid/);
  assert.doesNotMatch(footer, /help@letbuyy\.com/);
});

test('L4: a persisted older Liquid footer binds opted-in contact without overriding an explicit merchant address', async () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const schema = bundle.sections.footer.source.slice(bundle.sections.footer.source.indexOf('{% schema %}'));
  bundle.sections.footer.source = `<footer class="lb-footer">
    {% if section.settings.contactEmail != blank %}<a href="mailto:{{ section.settings.contactEmail }}">{{ section.settings.contactEmail }}</a>{% endif %}
    {% if section.settings.contactPhone != blank %}<a href="tel:{{ section.settings.contactPhone }}">{{ section.settings.contactPhone }}</a>{% endif %}
  </footer>\n${schema}`;
  bundle.templates.footer.sections['footer-default'].settings = {};
  const renderFooter = async (shop: Record<string, unknown>) => (await new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidContext: { shop }, liquidBundle: bundle,
  })).liquid?.footer ?? '';
  assert.match(await renderFooter({ name: 'Local Kicks', contact_email: 'merchant@example.invalid', contact_phone: '+919876543210' }),
    /mailto:merchant@example\.invalid/);
  assert.doesNotMatch(await renderFooter({ name: 'Local Kicks' }), /mailto:|tel:/);
  bundle.templates.footer.sections['footer-default'].settings.contactEmail = 'custom@example.invalid';
  const overridden = await renderFooter({ name: 'Local Kicks', contact_email: 'merchant@example.invalid' });
  assert.match(overridden, /mailto:custom@example\.invalid/);
  assert.doesNotMatch(overridden, /merchant@example\.invalid/);
});

test('L4: chrome is sanitized (no active content leaks through header/footer)', async () => {
  const result = await render();
  const chrome = `${result.liquid?.header ?? ''}${result.liquid?.footer ?? ''}`;
  assert.doesNotMatch(chrome, /<script/i);
  assert.doesNotMatch(chrome, /\son\w+=/i); // no event handlers
});

test('L4: nav link URLs are validated (no javascript: scheme survives)', async () => {
  // Craft a hostile nav href via the header template block; the renderer must not emit a live js: link.
  const base = createUrbanKicksLiquidThemeBundleFixture();
  base.templates.header.sections['header-default'].blocks['evil'] = {
    type: 'link',
    settings: { label: 'Bad', href: 'javascript:alert(1)' },
  };
  base.templates.header.sections['header-default'].block_order = [
    ...base.templates.header.sections['header-default'].block_order,
    'evil',
  ];
  const result = await new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: base,
  });
  const header = result.liquid?.header ?? '';
  assert.doesNotMatch(header, /href="javascript:/i);
});

test('T1: header/footer brand text is the merchant shop name, never the theme brand', async () => {
  // Regression guard: the default composition used to hardcode storeName: 'Urban Kicks' on both
  // header-default and footer-default, so every merchant's storefront literally displayed the
  // theme's own name instead of their own — confirmed live on the `snaz` test store, whose header
  // showed "LetBuyy Core" (the neutral-branded theme alias) rather than "Snaz". storeName now has
  // no composed default at all; the section body falls back to the real shop.name drop.
  const result = await new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'snaz', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidContext: { shop: { name: 'Snaz' } },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
  const chrome = `${result.liquid?.header ?? ''}${result.liquid?.footer ?? ''}`;
  assert.match(chrome, /Snaz/, 'the merchant shop name must appear in header/footer chrome');
  assert.doesNotMatch(chrome, /Urban Kicks/, 'the theme brand name must never leak into merchant-facing chrome');
  assert.doesNotMatch(chrome, /LetBuyy Core/, 'the neutral theme alias must never leak into merchant-facing chrome either');
});
