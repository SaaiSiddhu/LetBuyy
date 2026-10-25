import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../src/first-party-theme-catalog';
import { LiquidThemePackageBundleSchema, buildLiquidThemePackagePersistencePayload, type LiquidThemePackageBundle } from '../src/theme-bundle';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../src/theme-document';

const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const frozenDefaultCatalogHashes = {
  "letbuyy-forge": {
    "legacy": "7d83a19e92dd3943751e77a3a1181373ae39f0141a89b41e949a47e3301f463d",
    "v200": "cadab65d5351e1d5f8506d3620df481700ff38ae7e23c19f7282d1f31be79b46"
  },
  "letbuyy-sense": {
    "legacy": "61082be647eadae9b6e42002be241a82ba6c3627427568f6e64e2cf961c3742e",
    "v200": "61082be647eadae9b6e42002be241a82ba6c3627427568f6e64e2cf961c3742e"
  },
  "letbuyy-aura": {
    "legacy": "a8f5c97ac1a95745a40bcde495e2c9a6d601ee434b8e9f41c7a5a4cdb4bed127",
    "v200": "e1f8ee24971241d472ec34e50b855fdb94cea769cdde777bd119ba3c1d17619c"
  },
  "letbuyy-craft": {
    "legacy": "22870a2aa9020051c2019f3a46aed1d45e4e351f24611d62f47fb59c93050867",
    "v200": "4e068c69808b5cb82b8caaabbb9197580c425c1edc43b298fb667959ab050497"
  },
  "letbuyy-refresh": {
    "legacy": "57ac510a46f9912cc1c9693b643a6facc5d83b00e92318a389f11d665f71fa54",
    "v200": "6b05ab842f55dd6fcc7b99991a5e5160a5214e4417aedd46c343e94a3041a718"
  },
  "letbuyy-ride": {
    "legacy": "58aa537e78fcdaa00bba549891befe53d01408427c55e4d692960420512a1c1e",
    "v200": "127a261320b208ec845277abe51c176921767934988f98a2ce73188bfa95c224"
  },
  "letbuyy-dawn": {
    "legacy": "1917340805bf4559a0f77e5dda01b18d942855e4fdd3786af324c4c0f8883209",
    "v200": "d98a0388e3775d4f00dec8c992316af74d8255fd993cc08fc47032b7b4a8aee0"
  },
  "letbuyy-bloom": {
    "legacy": "9872b5c037acd9312293de09fcd135001b188b41a5e46d42ba5b4b59e5de3d59",
    "v200": "eb21c6b0e48b40cb11b5f3ba1e45f6f2ec8c50667175e82c8edb6bbe36299efc"
  },
  "letbuyy-nova": {
    "legacy": "c4d3d6738d0600191364fb25cf25d892b6eb54279a2754dac230391d0a31e450",
    "v200": "a06efcb494f2d8b47d901b57388743de7a1bece20afe818255e8c03ae60597f8"
  },
  "letbuyy-summit": {
    "legacy": "c09a6c9d5088034bcb8b2fe79b1ac2452f53904c04a27c7a4164cc52104b1c13",
    "v200": "4702e911bbc5d90b9ec46b9ff3d902249d7411b699e0a0c81283a713f91c1655"
  }
};
const mainBundle = createFirstPartyCatalogBundle;
const original = () => createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0' });
// Extra explicit option is deliberately ignored by the RED pre-correction source.
const successor = () => createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0', circuitVersion: '2.0.1' } as Parameters<typeof createFirstPartyCatalogBundle>[1]);
function configured(bundle: LiquidThemePackageBundle, key: string, field: string, value: string) {
  const next = structuredClone(bundle);
  const type = key === 'customers/order' ? 'customer-order-detail' : 'collection-product-list';
  const instance = Object.values(next.templates[key].sections).find(s => s.type === type)!;
  instance.settings[field] = value;
  return next;
}
async function render(bundle: LiquidThemePackageBundle, key: 'collection' | 'search' | 'customers/order') {
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'circuit-private-successor', path: key === 'customers/order' ? '/account/orders/source-only' : `/${key}`, previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-forge', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key === 'customers/order' ? 'customer_order' : key, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Synthetic source-only Circuit' }, collection: { title: 'Accessories', products: [], total: 0, pagination: { page: 1 } }, buyer: { id: 'synthetic-source-only' }, order: { id: 'synthetic-unpersisted', number: 'SOURCE-101', status: 'pending', line_items: [{ title: 'Synthetic hub', quantity: 1, line_price: 120000, currency: 'INR', niche_facts_text: 'Model: Synthetic H1\nPower output maximum: 45 W' }], total: 120000, currency: 'INR' } },
  });
  assert.equal(result.status, 'rendered');
  assert.deepEqual(result.warnings, []);
  const value = { html: result.liquid!.contentForLayout, style: result.liquid!.headStyleText };
  return value;
}

test('Circuit successor selection is explicit; package identity is stable and version advances', () => {
  const next = successor();
  assert.equal(next.package.slug, 'letbuyy-forge');
  assert.equal(next.package.name, 'Circuit');
  assert.equal(next.package.version, '2.0.1');
  assert.equal(next.package.version_number, 3);
  assert.equal(original().package.version, '2.0.0');
});

test('all ten default 2.0.0 and legacy catalog outputs remain exactly equal to current Main', () => {
  for (const listing of firstPartyThemeListings({ designVersion: '2.0.0' })) {
    assert.equal(sha(createFirstPartyCatalogBundle(listing.slug, { designVersion: '2.0.0' })), frozenDefaultCatalogHashes[listing.slug as keyof typeof frozenDefaultCatalogHashes].v200, listing.slug);
    assert.equal(sha(createFirstPartyCatalogBundle(listing.slug)), frozenDefaultCatalogHashes[listing.slug as keyof typeof frozenDefaultCatalogHashes].legacy, `${listing.slug} legacy`);
  }
});

test('Circuit explicit option does not change another theme or opt a legacy package into v2', () => {
  for (const slug of ['letbuyy-sense', 'letbuyy-bloom', 'letbuyy-nova']) assert.deepEqual(createFirstPartyCatalogBundle(slug, { designVersion: '2.0.0', circuitVersion: '2.0.1' } as Parameters<typeof createFirstPartyCatalogBundle>[1]), mainBundle(slug, { designVersion: '2.0.0' }));
  assert.deepEqual(createFirstPartyCatalogBundle('letbuyy-forge', { circuitVersion: '2.0.1' } as Parameters<typeof createFirstPartyCatalogBundle>[1]), mainBundle('letbuyy-forge'));
});

test('actual successor schema/manifest and JSON document roundtrip preserve explicit heading edits', () => {
  let next = configured(successor(), 'collection', 'title', 'Collection title');
  next = configured(next, 'search', 'title', 'Search title');
  next = configured(next, 'customers/order', 'heading', 'Your purchase');
  assert.ok(LiquidThemePackageBundleSchema.safeParse(next).success);
  const manifest = buildLiquidThemePackagePersistencePayload(next).schemaManifest;
  const schemas = manifest.section_schemas as Record<string, { settings_schema: Record<string, { type: string; default?: unknown }> }>;
  assert.equal(schemas['collection-product-list'].settings_schema.title.type, 'text');
  assert.equal(schemas['collection-product-list'].settings_schema.title.default, '');
  assert.equal(schemas['customer-order-detail'].settings_schema.heading.type, 'text');
  assert.deepEqual(fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(next)))), next);
});

for (const key of ['collection', 'search'] as const) {
  test(`${key}: editing the declared title changes actual Liquid heading output`, async () => {
    const alpha = await render(configured(successor(), key, 'title', 'CIRCUIT_ALPHA'), key);
    const beta = await render(configured(successor(), key, 'title', 'CIRCUIT_BETA'), key);
    assert.ok(alpha.html.includes('<h2>CIRCUIT_ALPHA</h2>'));
    assert.ok(beta.html.includes('<h2>CIRCUIT_BETA</h2>'));
    assert.notEqual(alpha.html, beta.html);
  });
  test(`${key}: clearing removes only the optional heading and restores exact default HTML/styles`, async () => {
    const fresh = await render(successor(), key);
    const cleared = await render(configured(successor(), key, 'title', ''), key);
    assert.deepEqual(cleared, fresh);
    assert.deepEqual(fresh, await render(original(), key));
  });
  test(`${key}: merchant heading markup is escaped as text`, async () => {
    const value = await render(configured(successor(), key, 'title', '<script>CIRCUIT_UNTRUSTED</script>'), key);
    assert.ok(value.html.includes('&lt;script&gt;CIRCUIT_UNTRUSTED&lt;/script&gt;'));
    assert.ok(!value.html.includes('<script>CIRCUIT_UNTRUSTED'));
  });
}

test('order: declared heading edits render with the authoritative order number retained', async () => {
  const alpha = await render(configured(successor(), 'customers/order', 'heading', 'CIRCUIT_RECEIPT_ALPHA'), 'customers/order');
  const beta = await render(configured(successor(), 'customers/order', 'heading', 'CIRCUIT_RECEIPT_BETA'), 'customers/order');
  assert.ok(alpha.html.includes('<h1>CIRCUIT_RECEIPT_ALPHA #SOURCE-101</h1>'));
  assert.ok(beta.html.includes('<h1>CIRCUIT_RECEIPT_BETA #SOURCE-101</h1>'));
  assert.notEqual(alpha.html, beta.html);
});

test('order: clear falls back to Order; default HTML/styles and immutable saved facts stay unchanged', async () => {
  const old = await render(original(), 'customers/order');
  const fresh = await render(successor(), 'customers/order');
  const cleared = await render(configured(successor(), 'customers/order', 'heading', ''), 'customers/order');
  assert.deepEqual(fresh, old);
  assert.deepEqual(cleared, old);
  assert.ok(fresh.html.includes('Synthetic H1') && fresh.html.includes('45 W'));
});

test('order: merchant heading markup is escaped without changing the order number', async () => {
  const value = await render(configured(successor(), 'customers/order', 'heading', '<img src=x onerror=alert(1)>'), 'customers/order');
  assert.ok(value.html.includes('&lt;img src=x onerror=alert(1)&gt; #SOURCE-101'));
  assert.ok(!value.html.includes('<img src="x"'));
});

test('only package version and the two Circuit section outputs differ; electronics facts and styles unchanged', () => {
  const next = successor(), base = original(), rest = structuredClone(next);
  rest.package = base.package;
  rest.sections['collection-product-list'] = base.sections['collection-product-list'];
  rest.sections['customer-order-detail'] = base.sections['customer-order-detail'];
  assert.deepEqual(rest, base);
  assert.deepEqual(next.sections['product-detail'], base.sections['product-detail']);
  assert.deepEqual(next.layout, base.layout);
  assert.ok(next.sections['customer-order-detail'].source.includes('lb:niche-order-presentation:v1'));
});

test('new successor factory is idempotent and does not mutate its frozen input', async () => {
  const { createCircuitThemeV201 } = await import('../src/circuit-theme-v201');
  const base = original(), before = JSON.stringify(base), next = createCircuitThemeV201(base);
  assert.equal(JSON.stringify(base), before);
  assert.deepEqual(createCircuitThemeV201(next), next);
});
