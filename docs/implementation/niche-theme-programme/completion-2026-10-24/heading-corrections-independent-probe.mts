import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { LiquidThemePackageBundle } from '../../../../packages/theme-engine/src/theme-bundle';

const root = new URL('../../../../', import.meta.url);
const req = createRequire(import.meta.url);
const load = (path: string) => req(fileURLToPath(new URL(path, root)));
const { LiquidRenderer } = load('packages/theme-engine/src/theme-renderer.ts');
const { DEFAULT_THEME_SETTINGS } = load('packages/theme-engine/src/theme-settings.ts');
const { createLetbuyyCoreLiquidThemeBundleFixture } = load('packages/theme-engine/src/theme-bundle-core.ts');
const pantryPath = 'docs/implementation/niche-themes-2026-10-23/pantry/completion-2026-10-24/applied-private-heading-20261024-01/src/pantry-theme.ts';
const circuitPath = 'docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/private-heading-successor/packages/theme-engine/src/first-party-theme-catalog.ts';
const pantry = load(pantryPath).createPantryTheme;
const pantryBefore = load('packages/theme-engine/src/pantry-theme.ts').createPantryTheme;
const circuit = load(circuitPath).createFirstPartyCatalogBundle;
const circuitBefore = load('packages/theme-engine/src/first-party-theme-catalog.ts').createFirstPartyCatalogBundle;
const checks: { name: string; result: string }[] = [];
const sha = (path: string) => createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex');
async function render(bundle: LiquidThemePackageBundle, template: string, collectionTitle = 'Real titled collection') {
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'source-review-only', path: '/', previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: template, type: template === 'customers/order' ? 'customer_order' : template, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: template,
    liquidContext: { shop: { name: 'Synthetic source review' }, collection: { title: collectionTitle, products: [], total: 0, pagination: { page: 1 } }, buyer: { id: 'unpersisted-source-only' }, order: { id: 'unpersisted-source-only', number: 'REVIEW-101', status: 'pending', line_items: [], total: 0, currency: 'INR' } },
  });
  assert.equal(result.status, 'rendered');
  assert.deepEqual(result.warnings, []);
  return { body: result.liquid.contentForLayout, style: result.liquid.headStyleText };
}
function instance(bundle: LiquidThemePackageBundle, template: string, type: string) {
  const row = Object.values(bundle.templates[template].sections).find(item => item.type === type);
  assert.ok(row);
  return row;
}
async function check(name: string, fn: () => Promise<void>) { await fn(); checks.push({ name, result: 'PASS_SOURCE_RENDER_ONLY' }); }
const savedMain = [sha('packages/theme-engine/src/pantry-theme.ts'), sha('packages/theme-engine/src/first-party-theme-catalog.ts')];
function pantryCollection() {
  const b: LiquidThemePackageBundle = pantry(createLetbuyyCoreLiquidThemeBundleFixture());
  // This is an available addable section, not the default collection composition.
  // Exercise its actual schema/source in the same existing section slot as the owner test.
  const slot = b.templates.collection.sections['pantry-results'];
  assert.ok(slot);
  slot.type = 'collection-product-list';
  return b;
}
await check('Pantry explicit heading works on a real titled collection and clear restores its title', async () => {
  const b = pantryCollection();
  const row = instance(b, 'collection', 'collection-product-list');
  row.settings = { ...row.settings, showHeading: true, title: 'Independent rice heading' };
  assert.match((await render(b, 'collection')).body, /<h2>Independent rice heading<\/h2>/);
  row.settings.title = '';
  assert.match((await render(b, 'collection')).body, /<h2>Real titled collection<\/h2>/);
});
await check('Pantry default collection/search body and styles preserve existing output', async () => {
  for (const key of ['collection', 'search']) assert.deepEqual(await render(pantry(createLetbuyyCoreLiquidThemeBundleFixture()), key), await render(pantryBefore(createLetbuyyCoreLiquidThemeBundleFixture()), key));
});
await check('Pantry hostile heading remains escaped', async () => {
  const b = pantryCollection();
  instance(b, 'collection', 'collection-product-list').settings = { showHeading: true, title: '<img src=x onerror=reviewAttack()>' };
  const html = (await render(b, 'collection')).body;
  assert.match(html, /&lt;img src=x onerror=reviewAttack\(\)&gt;/);
  assert.ok(!html.includes('<img src=x onerror=reviewAttack()>'));
});
const nextCircuit = () => circuit('letbuyy-forge', { designVersion: '2.0.0', circuitVersion: '2.0.1' });
await check('Circuit explicit collection heading works and clear restores exact default output', async () => {
  const b = nextCircuit(), row = instance(b, 'collection', 'collection-product-list');
  row.settings.title = 'Independent accessory heading';
  assert.match((await render(b, 'collection')).body, /<h2>Independent accessory heading<\/h2>/);
  row.settings.title = '';
  assert.deepEqual(await render(b, 'collection'), await render(circuitBefore('letbuyy-forge', { designVersion: '2.0.0' }), 'collection'));
});
await check('Circuit order heading keeps authoritative number and escapes merchant input', async () => {
  const b = nextCircuit(), row = instance(b, 'customers/order', 'customer-order-detail');
  row.settings.heading = '<img src=x onerror=reviewAttack()>';
  const html = (await render(b, 'customers/order')).body;
  assert.match(html, /&lt;img src=x onerror=reviewAttack\(\)&gt; #REVIEW-101/);
  assert.ok(!html.includes('<img src=x onerror=reviewAttack()>'));
});
await check('Circuit frozen default catalogue remains byte-equivalent and Main bases unchanged', async () => {
  assert.deepEqual(circuit('letbuyy-forge', { designVersion: '2.0.0' }), circuitBefore('letbuyy-forge', { designVersion: '2.0.0' }));
  assert.deepEqual([sha('packages/theme-engine/src/pantry-theme.ts'), sha('packages/theme-engine/src/first-party-theme-catalog.ts')], savedMain);
});
const result = { recordedAt: new Date().toISOString(), classification: 'INDEPENDENT_SOURCE_RENDER_REVIEW_NOT_INSTALLED_ACCEPTANCE', checks, inputs: [pantryPath, circuitPath].map(path => ({ path, sha256: sha(path) })), mainUnchanged: true, browser: false, database: false, providerCalls: 0, certification: false };
writeFileSync(new URL('heading-corrections-independent-review.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
