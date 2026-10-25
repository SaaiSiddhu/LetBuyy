import assert from 'node:assert/strict';
import test from 'node:test';
import { createFirstPartyCatalogBundle } from '../src/first-party-theme-catalog';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import type { LiquidThemePackageBundle } from '../src/theme-bundle';
import { withConfiguredOrderHeading, CONFIGURED_ORDER_HEADING_SOURCE } from '../src/niche-order-presentation';

const subjects = [
  { slug: 'letbuyy-forge', options: { circuitVersion: '2.0.1' as const } },
  { slug: 'letbuyy-refresh', options: { pantryVersion: '2.0.1' as const } },
  { slug: 'letbuyy-ride', options: { trailmarkVersion: '2.0.1' as const } },
];
const order = { number: 'SAVED-1042', status: 'pending', currency: 'INR', total: 180000,
  line_items: [{ title: 'Accepted product', quantity: 1, line_price: 180000, niche_facts_text: 'Recorded facts: 26.5 in / 80 g' }] };

async function rendered(bundle: LiquidThemePackageBundle) {
  const before = JSON.stringify(order);
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'order-heading-source-only', path: '/account/orders/source-only', previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'customers/order', type: 'customer_order', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: 'customers/order',
    liquidContext: { shop: { name: 'Source-only merchant' }, buyer: { id: 'unpersisted-source-only' }, order },
  });
  assert.equal(result.status, 'rendered');
  assert.deepEqual(result.warnings, []);
  assert.equal(JSON.stringify(order), before);
  return { html: result.liquid!.contentForLayout, styles: result.liquid!.headStyleText };
}

for (const subject of subjects) {
  test(`${subject.slug}: blank and whitespace order heading restore the default without changing number/facts`, async () => {
    const bundle = createFirstPartyCatalogBundle(subject.slug, { designVersion: '2.0.0', ...subject.options });
    const entry = Object.values(bundle.templates['customers/order'].sections).find(section => section.type === 'customer-order-detail');
    assert.ok(entry);
    const original = await rendered(bundle);
    for (const value of ['', '  \n\t  ']) {
      entry.settings.heading = value;
      assert.deepEqual(await rendered(bundle), original);
    }
    entry.settings.heading = '  Your purchase  ';
    const custom = await rendered(bundle);
    assert.ok(custom.html.includes('<h1>Your purchase #SAVED-1042</h1>'));
    assert.ok(custom.html.includes('Recorded facts: 26.5 in / 80 g'));
    entry.settings.heading = '<script>untrusted</script>';
    const hostile = await rendered(bundle);
    assert.ok(hostile.html.includes('&lt;script&gt;untrusted&lt;/script&gt; #SAVED-1042'));
    assert.ok(!hostile.html.includes('<script>untrusted</script>'));
  });
}

test('shared opt-in helper is immutable/idempotent and changes only the canonical heading outlet', () => {
  const base = createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0' });
  const before = structuredClone(base), next = withConfiguredOrderHeading(base);
  assert.deepEqual(base, before);
  assert.deepEqual(withConfiguredOrderHeading(next), next);
  assert.notEqual(next, base);
  assert.equal(next.package.version, '2.0.0', 'only the owning successor factory advances version');
  assert.ok(next.sections['customer-order-detail'].source.includes(CONFIGURED_ORDER_HEADING_SOURCE));
  next.sections['customer-order-detail'].source = base.sections['customer-order-detail'].source;
  assert.deepEqual(next, base, 'all settings, order content, facts, styles and identities remain intact');
});

test('shared opt-in helper rejects unknown package, wrong field and missing/duplicate order outlets', () => {
  const original = () => createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0' });
  const foreign = original(); foreign.package.slug = 'third-party-unapproved';
  assert.throws(() => withConfiguredOrderHeading(foreign), /known first-party/);
  const version = original(); version.package.version = '9.9.9';
  assert.throws(() => withConfiguredOrderHeading(version), /known first-party/);
  const field = original();
  field.sections['customer-order-detail'].schema.settings.find(setting => setting.id === 'heading')!.type = 'number';
  assert.throws(() => withConfiguredOrderHeading(field), /canonical text heading/);
  const missing = original(); missing.sections['customer-order-detail'].source = '<h1>Unbound order</h1>';
  assert.throws(() => withConfiguredOrderHeading(missing), /exact canonical order identity/);
  const duplicate = original(); duplicate.sections['customer-order-detail'].source += '<h1>Order #{{ order.number }}</h1>';
  assert.throws(() => withConfiguredOrderHeading(duplicate), /exact canonical order identity/);
});
