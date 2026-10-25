/** In-process historical contract: no DB, HTTP receipt, purchase or catalog lookup. */
import assert from 'node:assert/strict';
import test, { before, after, afterEach } from 'node:test';
import { createRequire } from 'node:module';
import { prepareProductFactSnapshot, ProductFactSnapshotSchema, type ProductFactSnapshotSource, type ProductFactSnapshot } from '../../../../packages/commerce-core/src/index';
import { normalizeOrderItemRecord } from '../../../../packages/checkout-core/src/index';
import { mapOrderDetailDrop } from '../../../../apps/commerce/web/src/lib/customer-drop';
import { orderItemFactsText, savedOrderOptions } from '../../../../apps/commerce/web/src/lib/order-fact-readback';
import { createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog';
import { DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/theme-settings';
import { LiquidRenderer } from '../../../../packages/theme-engine/src/theme-renderer';

const requireEngine = createRequire(new URL('../../../../packages/theme-engine/package.json', import.meta.url));
const { JSDOM } = requireEngine('jsdom') as { JSDOM: new (html: string) => { window: { document: Document } } };
const id = (suffix: string) => `7b669c70-4100-4000-8000-${suffix.padStart(12, '0')}`;
const variantId = (suffix: string) => `7b669c70-4200-4000-8000-${suffix.padStart(12, '0')}`;
const hostile = '<img src=x onerror="attack()"><script>attack()</script>';
const originalFetch = globalThis.fetch;
let externalReads = 0;
before(() => { globalThis.fetch = async () => { externalReads++; throw new Error('Historical contract attempted an HTTP/current-catalog lookup'); }; });
after(() => { globalThis.fetch = originalFetch; });
afterEach(() => { assert.equal(externalReads, 0, 'Pure historical mapping/rendering must not fetch current data'); });
function furnitureSource(): ProductFactSnapshotSource {
    return { product_id: id('1'), product_version: 37, has_variants: true,
        product_metadata: { private_supplier: 'PRIVATE-SUPPLIER', furniture: { assembled: { unit: 'cm', width: 68, depth: 78, height: 74 }, package: { unit: 'cm', width: 70, depth: 80, height: 76 }, materials: ['Common teak'], care: 'Common care.' } },
        selected_variant: { id: variantId('2'), product_id: id('1'), options: { Finish: 'Smoked teak', 'Seat size': 'Compact', 'आकार': 'छोटा' }, metadata: { furniture: { assembled: { unit: 'in', width: 27 }, package: { unit: 'mm', width: 740, height: 780 }, weight: { value: 14.2, unit: 'kg' }, materials: ['Saved oak'], finish: 'Smoked teak', assembly: { status: 'required', tools: 'Saved hex key' }, care: hostile } } },
    };
}
async function prepare(source: ProductFactSnapshotSource) {
    const prepared = await prepareProductFactSnapshot(source);
    assert.ok(prepared.ok, JSON.stringify(prepared));
    assert.equal(Object.isFrozen(prepared.snapshot), true); assert.equal(Object.isFrozen(prepared.snapshot.facts), true);
    assert.deepEqual(ProductFactSnapshotSchema.parse(prepared.snapshot), prepared.snapshot);
    return prepared;
}
function line(snapshot: ProductFactSnapshot | undefined, productId = id('1'), selectedId = variantId('2'), title = 'Saved Aara lounge chair', quantity = 2, price = 19900) {
    const persisted = { product_id: productId, variant_id: selectedId, title, quantity, unit_price: price, total: quantity * price, product_snapshot: { name: title, ...(snapshot ? { niche: snapshot } : {}), private_supplier: 'PRIVATE-SUPPLIER' } };
    const normalized = normalizeOrderItemRecord(persisted);
    Object.defineProperty(normalized, 'product', { get() { throw new Error('Historical mapping attempted a current product lookup'); } });
    return normalized;
}
function receipt(items: ReturnType<typeof normalizeOrderItemRecord>[]) {
    return { id: '7b669c70-4500-4000-8000-000000000001', order_number: 'HIST-1001', status: 'pending_cod', payment_status: 'pending', payment_method: 'cod', currency: 'INR', created_at: '2026-10-22T12:00:00Z',
        subtotal: 39800, shipping_cost: 250, tax: 720, discount: 500, total: 40270, items };
}
async function renderOrder(order: ReturnType<typeof mapOrderDetailDrop>) {
    const bundle = createFirstPartyCatalogBundle('letbuyy-craft', { designVersion: '2.0.0' });
    const result = await new LiquidRenderer().render({ context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'habitat-history-fixture', path: `/account/orders/${order.id}`, previewMode: false, locale: 'en-IN' },
        storeTemplate: { themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        routeTemplate: { id: 'customers/order', type: 'customer_order', layoutKey: 'theme', sections: [] },
        liquidBundle: bundle, liquidTemplateKey: 'customers/order', liquidContext: { shop: { name: 'Historical Habitat fixture' }, buyer: { email: 'owned-buyer@example.test' }, order } });
    assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []); assert.ok(result.liquid);
    return { html: result.liquid.contentForLayout, document: new JSDOM(result.liquid.contentForLayout).window.document };
}

test('selected furniture snapshot traverses normalizer, actual customer/order mapper and real v2 order Liquid without unit/option/money drift', async () => {
    const prepared = await prepare(furnitureSource());
    assert.deepEqual(prepared.snapshot.facts.furniture!.assembled, { unit: 'in', width: 27 });
    assert.deepEqual(prepared.snapshot.facts.furniture!.package, { unit: 'mm', width: 740, height: 780 });
    const item = line(prepared.snapshot), order = mapOrderDetailDrop(receipt([item]));
    assert.equal(item.unit_price, 19900); assert.equal(item.total, 39800); assert.equal(item.quantity, 2);
    assert.equal(order.line_items[0].price, 1990000); assert.equal(order.line_items[0].line_price, 3980000);
    assert.deepEqual([order.subtotal, order.shipping_total, order.tax_total, order.discount_total, order.total], [3980000, 25000, 72000, 50000, 4027000]);
    assert.equal(order.status, 'pending_cod'); assert.equal(order.payment_status, 'pending');
    assert.equal(order.line_items[0].title, 'Saved Aara lounge chair');
    const options = { Finish: 'Smoked teak', 'Seat size': 'Compact', 'आकार': 'छोटा' };
    assert.deepEqual(savedOrderOptions(item.niche_snapshot!), options);
    const text = order.line_items[0].niche_facts_text!;
    for (const expected of ['Width 27 in', 'Width 740 mm', 'Height 780 mm', '14.2 kg', 'Saved oak', 'Saved hex key', hostile]) assert.ok(text.includes(expected), expected);
    assert.doesNotMatch(text, /Width 68 cm|Depth 78 cm|Depth 80 cm|PRIVATE-SUPPLIER/);
    const rendered = await renderOrder(order);
    assert.ok(rendered.document.querySelector('.lb-order-facts__text')!.textContent!.includes(hostile));
    assert.equal(rendered.document.querySelector('.lb-order-facts img,.lb-order-facts script,.lb-order-facts [onerror]'), null);
    assert.match(rendered.document.body.textContent!, /40,270\.00/);
    assert.ok(rendered.document.body.textContent!.includes('Seat size: Compact'), 'The full Liquid history must retain the supplied option name with a space');
    assert.ok(rendered.document.body.textContent!.includes('आकार: छोटा'), 'The full Liquid history must retain the supplied Unicode option name');
    assert.deepEqual(order.line_items[0].variant, options, 'Actual mapper must project the saved exact option names, not today’s catalog or a title guess');
});

test('saved food quantity remains per pack and named beauty choices use the exact saved option key', async () => {
    const food = await prepare({ product_id: id('20'), product_version: 5, has_variants: true, product_metadata: { food: { netQuantity: { value: 1000, unit: 'g' }, ingredients: 'Saved food ingredients' } }, selected_variant: { id: variantId('20'), product_id: id('20'), options: { 'Pack size': '250 g' }, metadata: { food: { netQuantity: { value: 250, unit: 'g' } } } } });
    const beauty = await prepare({ product_id: id('30'), product_version: 7, has_variants: true, product_metadata: { beauty: { format: 'Lip colour', shadeOptionName: 'Shade name', shades: [{ value: 'Pink Clay', code: 'PC02', ingredients: 'Saved Pink Clay ingredients' }, { value: 'Rosewater', code: 'RW01', ingredients: 'Other shade' }] } }, selected_variant: { id: variantId('30'), product_id: id('30'), options: { 'Shade name': 'Pink Clay' }, metadata: {} } });
    const items = [line(food.snapshot, id('20'), variantId('20'), 'Saved pantry pack', 3, 180), line(beauty.snapshot, id('30'), variantId('30'), 'Saved lip colour', 1, 640)];
    const order = mapOrderDetailDrop({ ...receipt(items), subtotal: 1180, shipping_cost: 0, tax: 0, discount: 0, total: 1180 });
    assert.equal(items[0].quantity, 3); assert.equal(items[0].niche_snapshot!.facts.food!.netQuantity!.value, 250);
    assert.match(order.line_items[0].niche_facts_text!, /Per-item net quantity: 250 g/);
    assert.doesNotMatch(order.line_items[0].niche_facts_text!, /750 g|1000 g/);
    assert.match(order.line_items[1].niche_facts_text!, /Selected shade: Pink Clay/); assert.match(order.line_items[1].niche_facts_text!, /Shade code: PC02/);
    assert.doesNotMatch(order.line_items[1].niche_facts_text!, /RW01|Other shade/);
    const rendered = await renderOrder(order);
    for (const expected of ['250 g', 'Pink Clay', 'PC02', 'Saved Pink Clay ingredients']) assert.ok(rendered.document.body.textContent!.includes(expected), expected);
    assert.deepEqual(order.line_items[0].variant, { 'Pack size': '250 g' });
    assert.deepEqual(order.line_items[1].variant, { 'Shade name': 'Pink Clay' });
});

test('legacy or malformed saved facts remain unknown without raw/current-product fallback or money/status changes', async () => {
    const valid = (await prepare(furnitureSource())).snapshot;
    for (const malformed of [undefined, { version: 99, facts: valid.facts }, { ...valid, selected_options: [{ name: 'Finish', value: 'A' }, { name: 'Finish', value: 'B' }] }]) {
        const normalized = normalizeOrderItemRecord({ product_id: id('1'), title: 'Historical legacy piece', quantity: 2, unit_price: 19900, total: 39800, product_snapshot: { niche: malformed, furniture: { care: 'RAW-PRIVATE-FALLBACK' } } });
        assert.equal('niche_snapshot' in normalized, false);
        const order = mapOrderDetailDrop(receipt([normalized]));
        assert.equal(order.line_items[0].niche_facts_text, null); assert.equal(order.line_items[0].variant, null);
        assert.equal(order.line_items[0].line_price, 3980000); assert.equal(order.total, 4027000); assert.equal(order.status, 'pending_cod');
        const rendered = await renderOrder(order);
        assert.match(rendered.document.body.textContent!, /Product details were not recorded with this order/);
        assert.doesNotMatch(rendered.document.body.textContent!, /RAW-PRIVATE-FALLBACK|Saved oak|Smoked teak/);
    }
});

test('a valid older beauty snapshot without saved options keeps its facts but never chooses the first shade', async () => {
    const prepared = await prepare({ product_id: id('31'), product_version: 7, has_variants: true,
        product_metadata: { beauty: { format: 'Saved lip colour', shadeOptionName: 'Shade name', shades: [{ value: 'Pink Clay', code: 'PC02' }, { value: 'Rosewater', code: 'RW01' }] } },
        selected_variant: { id: variantId('31'), product_id: id('31'), options: { 'Shade name': 'Rosewater' }, metadata: {} } });
    const legacy: ProductFactSnapshot = JSON.parse(JSON.stringify(prepared.snapshot)); delete legacy.selected_options;
    assert.equal(ProductFactSnapshotSchema.safeParse(legacy).success, true);
    const item = line(legacy, id('31'), variantId('31'), 'Older saved lip colour', 1, 640);
    const order = mapOrderDetailDrop({ ...receipt([item]), subtotal: 640, shipping_cost: 0, tax: 0, discount: 0, total: 640 });
    assert.equal(order.line_items[0].variant, null);
    assert.match(order.line_items[0].niche_facts_text!, /Product format: Saved lip colour/);
    assert.match(order.line_items[0].niche_facts_text!, /Selected shade: Not recorded with this order/);
    assert.doesNotMatch(order.line_items[0].niche_facts_text!, /PC02|RW01/);
    const rendered = await renderOrder(order);
    assert.match(rendered.document.body.textContent!, /Selected shade: Not recorded with this order/);
    assert.doesNotMatch(rendered.document.body.textContent!, /PC02|RW01/);
});

test('serialized historical snapshot remains unchanged after current facts/options change and catalog deletion', async () => {
    const source = furnitureSource(), prepared = await prepare(source);
    const stored = JSON.parse(JSON.stringify(prepared.snapshot));
    const before = mapOrderDetailDrop(receipt([line(stored)])); const renderedBefore = await renderOrder(before);
    assert.match(renderedBefore.document.body.textContent!, /Saved oak/);
    source.product_metadata = { furniture: { care: 'TODAY-CHANGED', assembled: { unit: 'mm', width: 99999 } } };
    source.selected_variant!.metadata = { furniture: { care: 'TODAY-VARIANT' } };
    source.selected_variant!.options = { Finish: 'TODAY-FINISH' };
    Reflect.deleteProperty(source, 'product_metadata'); source.selected_variant = null;
    const after = mapOrderDetailDrop(receipt([line(stored)])); const renderedAfter = await renderOrder(after);
    assert.deepEqual(after, before); assert.equal(renderedAfter.html, renderedBefore.html);
    assert.equal(orderItemFactsText(line(stored)), before.line_items[0].niche_facts_text);
    assert.doesNotMatch(renderedAfter.document.body.textContent!, /TODAY-CHANGED|TODAY-VARIANT|TODAY-FINISH/);
    assert.equal(prepared.snapshot.facts.furniture!.care, hostile);
});
