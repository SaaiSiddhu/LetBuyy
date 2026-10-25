import assert from 'node:assert/strict';
import test from 'node:test';
import { mapOrderDetailDrop, mapOrderDrop } from './customer-drop';

test('the actual order drop adapts server rupees into Liquid minor units without changing the receipt', () => {
    const receipt = { id: 'synthetic-order', status: 'pending_cod', currency: 'INR', subtotal: 2490, discount: 0, tax: 448.2, shipping_cost: 20, total: 2958.2, items: [{ name: 'Linen shirt', price: 2490, quantity: 1, total: 2490 }] };
    const original = structuredClone(receipt);
    const drop = mapOrderDetailDrop(receipt);
    assert.equal(drop.subtotal, 249000);
    assert.equal(drop.tax_total, 44820);
    assert.equal(drop.shipping_total, 2000);
    assert.equal(drop.total, 295820);
    assert.equal(drop.line_items[0].price, 249000);
    assert.equal(drop.line_items[0].line_price, 249000);
    assert.equal(mapOrderDrop(receipt).total, drop.total, 'list and detail share one presentation unit contract');
    assert.deepEqual(receipt, original, 'presentation adaptation cannot mutate the server receipt');
});

test('pending COD and unknown order states never imply completed fulfillment', () => {
    const timeline = (status: string) => mapOrderDetailDrop({ status, subtotal: 0, discount: 0, tax: 0, shipping_cost: 0, total: 0 }).timeline;
    assert.deepEqual(timeline('pending_cod').filter(step => step.reached).map(step => step.label), ['Pending']);
    for (const status of ['cancelled', 'pending_payment', 'unrecognized']) assert.equal(timeline(status).some(step => step.reached), false);
    assert.equal(timeline('delivered').every(step => step.reached), true);
});

test('decimal receipts retain paise and non-finite values cannot reach Liquid money formatting', () => {
    const receipt = { total: '0.29', tax: '448.20', subtotal: 0, discount: 0, shipping_cost: 0, items: [{ unit_price: '49.90', total: '99.80', quantity: 2 }] };
    const drop = mapOrderDetailDrop(receipt);
    assert.equal(drop.total, 29);
    assert.equal(drop.tax_total, 44820);
    assert.equal(drop.subtotal, 0);
    assert.equal(drop.line_items[0].price, 4990);
    assert.equal(drop.line_items[0].line_price, 9980);
    assert.throws(() => mapOrderDetailDrop({ ...receipt, subtotal: Infinity }), /amount is unavailable/);
    for (const total of [null, undefined, '', 'unknown', NaN]) assert.throws(() => mapOrderDrop({ total }), /amount is unavailable/);
});

test('the surviving legacy customer receipt shape uses the same money projection', () => {
    const receipt = { id: 'synthetic-legacy-order', number: 'SYN-1', status: 'confirmed', currency: 'INR', subtotal: '149.90', discount: 0, tax: 0, shipping_cost: 0, total: '149.90', items: [{ name: 'Stationery fixture', price: '74.95', quantity: 2 }] };
    assert.equal(mapOrderDrop(receipt).total, 14990);
    assert.equal(mapOrderDetailDrop(receipt).line_items[0].line_price, 14990);
});
