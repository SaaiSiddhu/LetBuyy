import assert from 'node:assert/strict';
import test from 'node:test';
import { createFirstPartyCatalogBundle } from '../src/first-party-theme-catalog';
import { createPantryThemeV201 } from '../src/pantry-theme-v201';
import { createTrailmarkThemeV201 } from '../src/trailmark-theme-v201';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../src/theme-document';
import type { LiquidThemePackageBundle } from '../src/theme-bundle';

type Page = 'collection' | 'search' | 'customers/order';
const cases = [
  { name: 'Pantry', slug: 'letbuyy-refresh', options: { pantryVersion: '2.0.1' as const }, heading: 'title', factory: createPantryThemeV201 },
  { name: 'Trailmark', slug: 'letbuyy-ride', options: { trailmarkVersion: '2.0.1' as const }, heading: 'headingOverride', factory: createTrailmarkThemeV201 },
];
const order = { number: 'RECORDED-1042', status: 'pending', currency: 'INR', total: 180000,
  line_items: [{ title: 'Recorded product', quantity: 1, line_price: 180000, niche_facts_text: 'Recorded fact: 26.5 in / 80 g' }] };

function settings(bundle: LiquidThemePackageBundle, page: Page) {
  const type = page === 'customers/order' ? 'customer-order-detail' : 'collection-product-list';
  let entry = Object.values(bundle.templates[page].sections).find(section => section.type === type);
  // Pantry's approved collection uses a product grid by default. Exercise its
  // separately addable results section without relabeling a default instance.
  if (!entry && page !== 'customers/order') {
    assert.ok(bundle.sections[type], 'the installed package must declare the addable section');
    const id = 'source-only-added-results';
    entry = { type, settings: {}, blocks: {}, block_order: [], disabled: false };
    bundle.templates[page].sections[id] = entry;
    bundle.templates[page].order.push(id);
  }
  assert.ok(entry, `${page} must retain its canonical section`);
  return entry.settings;
}

async function render(bundle: LiquidThemePackageBundle, page: Page, collectionTitle = 'Actual collection') {
  const before = JSON.stringify(order);
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'successor-source-only', path: `/${page}`, previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: page, type: page === 'customers/order' ? 'customer_order' : page, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: page,
    liquidContext: { shop: { name: 'Source-only merchant' }, collection: { title: collectionTitle, products: [], total: 0 }, buyer: { id: 'unpersisted-source-only' }, order },
  });
  assert.equal(result.status, 'rendered');
  assert.deepEqual(result.warnings, []);
  assert.equal(JSON.stringify(order), before, 'presentation cannot rewrite accepted order facts');
  return { html: result.liquid!.contentForLayout, styles: result.liquid!.headStyleText };
}

for (const item of cases) {
  const original = () => createFirstPartyCatalogBundle(item.slug, { designVersion: '2.0.0' });
  const successor = () => createFirstPartyCatalogBundle(item.slug, { designVersion: '2.0.0', ...item.options });

  test(`${item.name}: explicit successor selection preserves defaults, identity and unrelated selectors`, () => {
    const base = original(), before = JSON.stringify(base), next = item.factory(base);
    assert.equal(JSON.stringify(base), before);
    assert.equal(base.package.version, '2.0.0');
    assert.equal(next.package.version, '2.0.1');
    assert.equal(next.package.version_number, 3);
    assert.equal(next.package.slug, base.package.slug);
    assert.deepEqual(item.factory(next), next);
    assert.deepEqual(next, successor());
    assert.deepEqual(fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(next)))), next);
    assert.deepEqual(createFirstPartyCatalogBundle(item.slug, item.options), createFirstPartyCatalogBundle(item.slug), 'legacy entry never silently opts in');
    assert.deepEqual(createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0', ...item.options }), createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0' }));
  });

  for (const page of ['collection', 'search'] as const) {
    test(`${item.name} ${page}: unchanged defaults and explicit heading edits render and survive document roundtrip`, async () => {
      assert.deepEqual(await render(successor(), page), await render(original(), page));
      const next = successor(), fields = settings(next, page);
      fields[item.heading] = 'Merchant-selected heading';
      if (item.name === 'Pantry') fields.showHeading = true;
      const saved = fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(next))));
      const output = await render(saved, page);
      assert.ok(output.html.includes('Merchant-selected heading'));
      assert.notDeepEqual(output, await render(original(), page));
      fields[item.heading] = '<script>untrusted</script>';
      const hostile = await render(next, page);
      assert.ok(hostile.html.includes('&lt;script&gt;untrusted&lt;/script&gt;'));
      assert.ok(!hostile.html.includes('<script>untrusted</script>'));
    });

    test(`${item.name} ${page}: clearing an override restores the supported collection fallback`, async () => {
      const next = successor(), fields = settings(next, page);
      fields[item.heading] = '';
      if (item.name === 'Pantry') fields.showHeading = true;
      const output = await render(next, page);
      assert.ok(output.html.includes('Actual collection'));
      if (item.name === 'Pantry') {
        fields.showHeading = false;
        const sameSectionBaseline = original();
        settings(sameSectionBaseline, page);
        assert.deepEqual(await render(next, page), await render(sameSectionBaseline, page));
      }
    });
  }

  test(`${item.name}: order copy changes preserve authoritative number and accepted facts; blank defaults and hostile text stay safe`, async () => {
    assert.deepEqual(await render(successor(), 'customers/order'), await render(original(), 'customers/order'));
    const next = successor(), fields = settings(next, 'customers/order');
    fields.heading = 'Your recorded purchase';
    const output = await render(next, 'customers/order');
    assert.ok(output.html.includes('Your recorded purchase'));
    assert.ok(output.html.includes('#RECORDED-1042'));
    assert.ok(output.html.includes('Recorded fact: 26.5 in / 80 g'));
    fields.heading = '';
    assert.deepEqual(await render(next, 'customers/order'), await render(original(), 'customers/order'));
    fields.heading = '<img src=x onerror=alert(1)>';
    const hostile = await render(next, 'customers/order');
    assert.ok(hostile.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!hostile.html.includes('<img src=x onerror=alert(1)>'));
    assert.ok(hostile.html.includes('#RECORDED-1042'));
  });
}
