/** Cross-package render contract, not a persistence or browser acceptance test. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ToyFactsSchema, ToyVariantFactsSchema, resolveToyFacts } from '../../../../packages/commerce-core/src/playfield-facts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../packages/theme-engine/src/theme-bundle-core';
import { createPlayfieldTheme } from '../../../../packages/theme-engine/src/playfield-theme';
import { LiquidRenderer } from '../../../../packages/theme-engine/src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/theme-settings';

const fixture = JSON.parse(readFileSync(new URL('./playfield-variant-create-fixtures.json', import.meta.url), 'utf8'));
for (const [index, variant] of fixture.variants.entries()) test(`canonical inline toy fixture ${index + 1} resolves and renders its own accepted facts`, async () => {
  assert.equal('id' in variant, false, 'Server persistence supplies the durable variant ID');
  const common = ToyFactsSchema.parse(fixture.productMetadata.toys);
  const inline = ToyVariantFactsSchema.parse(variant.metadata.toys);
  const toys = resolveToyFacts(common, inline)!;
  assert.ok(toys);
  const bundle = createPlayfieldTheme(createLetbuyyCoreLiquidThemeBundleFixture());
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'playfield-render-fixture', path: '/product/render-fixture', previewMode: true, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-bloom', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: 'product',
    // This test has no selected variant identity: it verifies the resolved fact view only.
    liquidContext: { shop: { name: 'Fictional render fixture' }, product: { title: variant.title, price: 1290, currency: 'INR', images: [], options: [], variants: [], available: true, toys } },
  });
  assert.equal(result.status, 'rendered');
  assert.deepEqual(result.warnings, []);
  const html = result.liquid!.contentForLayout;
  if (index === 0) {
    assert.match(html, /15 items in total/);
    assert.match(html, /Length 24 cm · Width 19 cm · Height 1.5 cm/);
    assert.match(html, /Length 5 cm · Width 5 cm · Height 0.6 cm/);
    assert.match(html, /Sample blue finish/);
    assert.match(html, /Read the sample kit information/);
  } else if (index === 1) {
    assert.match(html, /Age information not supplied/);
    assert.match(html, /Contents have not been supplied/);
    assert.match(html, /Dimensions have not been supplied/);
    assert.doesNotMatch(html, /15 items in total|Read the sample kit information|Each tile|Length 24 cm/);
  } else {
    assert.match(html, /9-12 years/);
    assert.match(html, /36 items in total/);
    assert.match(html, /<strong>A5 sheet<\/strong>/);
    assert.doesNotMatch(html, /15 items in total|6–8 years|Each tile|Height 1.5 cm|Read the sample kit information/);
  }
});
