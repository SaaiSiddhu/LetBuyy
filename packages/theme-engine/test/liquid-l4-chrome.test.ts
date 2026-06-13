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
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('L4: renderer emits Liquid header chrome with the store name + nav links', async () => {
  const result = await render();
  assert.equal(result.status, 'rendered');
  const header = result.liquid?.header ?? '';
  assert.match(header, /class="lb-header"/);
  assert.match(header, /Urban Kicks/);     // header storeName setting
  assert.match(header, /Products/);        // nav link block
  assert.match(header, /Collections/);     // nav link block
});

test('L4: renderer emits Liquid footer chrome', async () => {
  const result = await render();
  const footer = result.liquid?.footer ?? '';
  assert.match(footer, /class="lb-footer"/);
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
