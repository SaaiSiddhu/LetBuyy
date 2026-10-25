import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { withNicheOrderPresentation } from '../src/niche-order-presentation';
import { createFirstPartyCatalogBundle } from '../src/first-party-theme-catalog';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';

// Local contract input only: no catalogue edit or emitted release/capture.
function proposed() { const bundle = createFirstPartyCatalogBundle('letbuyy-sense', { customizationVersion: '2.1.0' }); bundle.package.version = '2.1.1'; bundle.package.version_number = 6; return bundle; }
async function render(text?: string) {
    const bundle = withNicheOrderPresentation(proposed());
    return new LiquidRenderer().render({ context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'synthetic-apparel-history', path: '/account/orders/saved', previewMode: false, locale: 'en-IN' },
        storeTemplate: { themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, liquidBundle: bundle, liquidTemplateKey: 'customers/order',
        liquidContext: { buyer: { email: 'synthetic@example.invalid' }, order: { number: 'SAVED-1', status: 'paid', currency: 'INR', total: 251000, line_items: [{ title: 'Saved linen shirt', quantity: 1, line_price: 249000, niche_facts_text: text }], timeline: [] } } });
}
test('Sense200/201/210 and wrong successor pairs retain identical bytes and object identity', () => {
    const old = [createFirstPartyCatalogBundle('letbuyy-sense'), createFirstPartyCatalogBundle('letbuyy-sense', { threadlineVersion: '2.0.1' }), createFirstPartyCatalogBundle('letbuyy-sense', { customizationVersion: '2.1.0' })];
    for (const [version, version_number] of [['2.0.0', 3], ['2.0.1', 4], ['2.1.1', 5], ['2.1.0', 6], ['2.1.2', 6]] as const) { const bundle = proposed(); bundle.package.version = version; bundle.package.version_number = version_number; old.push(bundle); }
    const third = proposed(); third.package.slug = 'third-party'; old.push(third);
    for (const bundle of old) { const before = JSON.stringify(bundle); assert.equal(withNicheOrderPresentation(bundle), bundle); assert.equal(JSON.stringify(bundle), before); }
});
test('only explicit Sense211/version6 gets the existing canonical outlet, pure and idempotent', () => {
    const input = proposed(), before = JSON.stringify(input), output = withNicheOrderPresentation(input);
    assert.equal(JSON.stringify(input), before); assert.notEqual(output, input); assert.equal(withNicheOrderPresentation(output), output);
    assert.match(output.sections['customer-order-detail'].source, /item.niche_facts_text/);
    assert.deepEqual(output.templates, input.templates); assert.deepEqual(output.config, input.config); assert.deepEqual(output.blocks, input.blocks);
    for (const key of Object.keys(input.sections).filter(key => key !== 'customer-order-detail')) assert.deepEqual(output.sections[key], input.sections[key], key);
});
test('actual Liquid displays saved options and garment text as escaped scalar without changing money', async () => {
    const text = 'Saved options\nColor: Oat\nSize: M\n\nGarment details\nFabric: 100% linen\nSize M: Chest 102 cm\n<script>attack()</script><img src=x onerror="attack()">';
    const result = await render(text); assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []);
    const document = new JSDOM(result.liquid!.contentForLayout).window.document;
    assert.equal(document.querySelector('.lb-order-facts__text')?.textContent, text); assert.equal(document.querySelector('script,img,[onerror]'), null);
    assert.match(document.body.textContent!, /SAVED-1/); assert.match(document.body.textContent!, /2,490\.00/); assert.match(document.body.textContent!, /2,510\.00/);
});
test('missing legacy facts keep the existing honest unavailable message', async () => {
    const result = await render(); assert.equal(result.status, 'rendered'); const document = new JSDOM(result.liquid!.contentForLayout).window.document;
    assert.equal(document.querySelector('.lb-order-facts'), null); assert.match(document.body.textContent!, /Product details were not recorded with this order/);
});
test('missing canonical line outlet refuses a successor without rewriting unrelated markup', () => { const input = proposed(); input.sections['customer-order-detail'].source = '<section>Unrelated</section>'; assert.throws(() => withNicheOrderPresentation(input), /canonical order line loop/); });
