import assert from 'node:assert/strict';
import test from 'node:test';
import { readOrderItemFactSnapshot, savedOrderOptions, orderItemFactsText } from './order-fact-readback';
import { savedFacts } from './order-facts.test-support';

test('saved apparel and options survive catalog mutation; old empty snapshots remain honestly empty', () => {
    const saved = { version: 1, facts: { apparel: { fit: 'Relaxed', fabric: 'Saved linen', care: 'Cold wash', unit: 'in', measurements: [{ size: 'M', chest: 40.5 }] } }, selected_options: [{ name: 'Color', value: 'Oat' }, { name: 'Size', value: 'M' }] };
    const item = { niche_snapshot: saved, product: { apparel: { fabric: 'CURRENT PRIVATE FABRIC' } } };
    const text = orderItemFactsText(item)!;
    assert.match(text, /Saved options\nColor: Oat\nSize: M/); assert.match(text, /Fabric: Saved linen/); assert.match(text, /Chest 40.5 in/);
    item.product.apparel.fabric = 'CHANGED TODAY'; Reflect.deleteProperty(item, 'product'); assert.equal(orderItemFactsText(item), text);
    assert.doesNotMatch(text, /CURRENT PRIVATE|CHANGED TODAY/);
    const legacy = { version: 1, facts: {}, selected_options: [{ name: 'Color', value: 'Oat' }, { name: 'Size', value: 'M' }] };
    const before = JSON.stringify(legacy); const old = orderItemFactsText({ niche_snapshot: legacy, product: { apparel: saved.facts.apparel } })!;
    assert.match(old, /Color: Oat/); assert.doesNotMatch(old, /Garment details|Saved linen|40.5/); assert.equal(JSON.stringify(legacy), before);
    assert.equal(orderItemFactsText({ niche_snapshot: { ...saved, facts: { apparel: { ...saved.facts.apparel, unit: 'm' } } } }), null);
});

test('approved canonical snapshot alone determines historical option and text presentation', () => {
    const saved = savedFacts();
    const item = { niche_snapshot: saved, variant: { Shade: 'Rosewater' }, product: { beauty: { ingredients: 'TODAY-PRIVATE' } } };
    assert.equal(savedOrderOptions(readOrderItemFactSnapshot(item)).Shade, 'Pink Clay');
    const text = orderItemFactsText(item)!;
    assert.match(text, /Saved options\nShade: Pink Clay/);
    for (const expected of ['PC02', 'Saved Pink Clay ingredients', 'Saved edition 2', '250 g', 'Asha']) assert.ok(text.includes(expected), expected);
    assert.doesNotMatch(text, /RW01|TODAY-PRIVATE/);
    item.product.beauty.ingredients = 'Changed today'; Reflect.deleteProperty(item, 'product');
    assert.equal(orderItemFactsText(item), text);
});
test('raw snapshot/private bags never substitute for an omitted or malformed approved field', () => {
    for (const item of [{ product_snapshot: { niche: savedFacts(), private_supplier: 'PRIVATE' } }, { niche_snapshot: { ...savedFacts(), private_supplier: 'PRIVATE' } }, { niche_snapshot: { version: 99, facts: {} } }, null]) {
        assert.equal(readOrderItemFactSnapshot(item), null); assert.equal(orderItemFactsText(item), null);
    }
    const duplicate = { ...savedFacts(), selected_options: [{ name: 'Shade', value: 'Pink Clay' }, { name: 'Shade', value: 'Rosewater' }] };
    assert.equal(readOrderItemFactSnapshot({ niche_snapshot: duplicate }), null);
});
test('legacy missing options remain unknown and supplied hostile strings stay scalar text for host escaping', () => {
    const saved = savedFacts(); const legacy = { ...saved }; delete legacy.selected_options;
    const text = orderItemFactsText({ niche_snapshot: legacy })!;
    assert.match(text, /Selected shade: Not recorded with this order/); assert.doesNotMatch(text, /PC02|RW01/);
    const attack = '<img src=x onerror="attack()">';
    const hostile = { ...saved, facts: { ...saved.facts, beauty: { ...saved.facts.beauty!, ingredients: attack } } };
    assert.ok(orderItemFactsText({ niche_snapshot: hostile })!.includes(attack));
    assert.ok(new TextEncoder().encode(orderItemFactsText({ niche_snapshot: hostile })!).byteLength <= 256 * 1024);
});
