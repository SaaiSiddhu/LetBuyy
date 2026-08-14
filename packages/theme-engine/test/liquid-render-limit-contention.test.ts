// Regression guard for the concurrent-render starvation that made the product, collection and search
// templates emit an empty shell.
//
// LiquidJS `renderLimit` is a WALL-CLOCK budget measured from the start of parseAndRender, not a CPU
// budget. renderLiquidSections renders sections concurrently (Promise.all) and sanitizeRenderedHtml
// runs jsdom + DOMPurify synchronously, so a trivially fast section could be aborted with
// "template render limit exceeded" purely because a sibling blocked the event loop while its clock ran.
// The symptom was a rendered page whose item containers were empty, and — because the trip point
// depends on machine speed and load — it read as flaky rather than broken.
//
// These tests fail if the budget is tightened back to a value that cannot absorb sibling contention,
// and if a section that renders fine in isolation is dropped by the concurrent pipeline.

import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

const PRODUCT = {
  id: 'prod_42',
  title: 'Apex Runner',
  description: 'Featherlight street runner.',
  price: 749900,
  currency: 'INR',
  url: '/product/prod_42',
  images: ['https://cdn.example/apex-1.jpg', 'https://cdn.example/apex-2.jpg'],
};

async function renderProduct() {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/product/prod_42', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'product',
    liquidContext: { product: PRODUCT },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

describe('liquid render-limit contention', () => {
  test('every section of the product template renders — none is dropped as a section error', async () => {
    const result = await renderProduct();
    assert.equal(result.status, 'rendered');

    const sections = result.liquid?.sections ?? [];
    assert.ok(sections.length > 0, 'product template must render at least one section');

    const errored = sections.filter((s) => s.isError);
    assert.deepEqual(
      errored.map((s) => `${s.id} (${s.type})`),
      [],
      'no section may be replaced by an lb:section-error placeholder',
    );
  });

  test('the product-detail section reaches the output rather than an error comment', async () => {
    const result = await renderProduct();
    const html = result.liquid?.contentForLayout ?? '';
    assert.ok(
      !html.includes('lb:section-error'),
      'contentForLayout must not contain a section-error placeholder',
    );
    // The binding that the empty-shell symptom hid: without it the page renders chrome and no product.
    assert.match(html, /Apex Runner/);
  });

  test('the render budget can absorb sibling contention on the concurrent path', async () => {
    // Renders that are individually trivial (~3ms) were aborted at a 250ms wall-clock budget once
    // siblings blocked the event loop. Running several concurrently reproduces that pressure; all of
    // them must still complete. This is the property a tightened budget would break.
    const results = await Promise.all([renderProduct(), renderProduct(), renderProduct(), renderProduct()]);
    for (const [index, result] of results.entries()) {
      assert.equal(result.status, 'rendered', `concurrent render ${index} must succeed`);
      assert.ok(
        !(result.liquid?.contentForLayout ?? '').includes('lb:section-error'),
        `concurrent render ${index} must not drop a section`,
      );
    }
  });
});
