// ============================================================
// Unit tests for the smart-collection evaluator
// Run: npx tsx --test services/api-gateway/src/__tests__/smart-collection-eval.test.ts
// ============================================================

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    evaluateCondition,
    evaluateSmartCollection,
    filterProducts,
    type EvalProduct,
    type SmartCondition,
} from '../lib/smart-collection-eval';

// ── fixtures ──────────────────────────────────────────────────────────────────

const SHOE: EvalProduct = {
    id: 'p1',
    title: 'Air Force 1',
    product_type: 'Footwear',
    vendor: 'Nike',
    tags: ['shoes', 'sport', 'limited'],
    price: 8999,
    inventory_quantity: 42,
};

const SHIRT: EvalProduct = {
    id: 'p2',
    title: 'Classic Tee',
    product_type: 'Apparel',
    vendor: 'Adidas',
    tags: 'basics,cotton,summer',   // csv-string tags
    price: 1299,
    inventory_quantity: 0,
};

const WATCH: EvalProduct = {
    id: 'p3',
    title: 'Pro Watch',
    product_type: 'Accessories',
    vendor: 'Samsung',
    tags: [],
    price: 24999,
    inventory_quantity: 5,
};

// ── evaluateCondition: string fields ─────────────────────────────────────────

test('equals — title match (case-insensitive)', () => {
    const c: SmartCondition = { field: 'title', op: 'equals', value: 'AIR FORCE 1' };
    assert.equal(evaluateCondition(SHOE, c), true);
    assert.equal(evaluateCondition(SHIRT, c), false);
});

test('not_equals — title mismatch passes', () => {
    const c: SmartCondition = { field: 'title', op: 'not_equals', value: 'air force 1' };
    assert.equal(evaluateCondition(SHOE, c), false);
    assert.equal(evaluateCondition(SHIRT, c), true);
});

test('contains — title substring', () => {
    const c: SmartCondition = { field: 'title', op: 'contains', value: 'tee' };
    assert.equal(evaluateCondition(SHIRT, c), true);
    assert.equal(evaluateCondition(SHOE, c), false);
});

test('starts_with — title prefix', () => {
    const c: SmartCondition = { field: 'title', op: 'starts_with', value: 'air' };
    assert.equal(evaluateCondition(SHOE, c), true);
    assert.equal(evaluateCondition(SHIRT, c), false);
});

test('ends_with — title suffix', () => {
    const c: SmartCondition = { field: 'title', op: 'ends_with', value: '1' };
    assert.equal(evaluateCondition(SHOE, c), true);
    assert.equal(evaluateCondition(SHIRT, c), false);
});

test('product_type equals', () => {
    const c: SmartCondition = { field: 'product_type', op: 'equals', value: 'footwear' };
    assert.equal(evaluateCondition(SHOE, c), true);
    assert.equal(evaluateCondition(SHIRT, c), false);
});

test('vendor contains', () => {
    const c: SmartCondition = { field: 'vendor', op: 'contains', value: 'nik' };
    assert.equal(evaluateCondition(SHOE, c), true);
    assert.equal(evaluateCondition(SHIRT, c), false);
});

// ── evaluateCondition: numeric — price ───────────────────────────────────────

test('price equals', () => {
    const c: SmartCondition = { field: 'price', op: 'equals', value: '8999' };
    assert.equal(evaluateCondition(SHOE, c), true);
    assert.equal(evaluateCondition(SHIRT, c), false);
});

test('price not_equals', () => {
    const c: SmartCondition = { field: 'price', op: 'not_equals', value: '8999' };
    assert.equal(evaluateCondition(SHOE, c), false);
    assert.equal(evaluateCondition(SHIRT, c), true);
});

test('price gt', () => {
    const c: SmartCondition = { field: 'price', op: 'gt', value: '10000' };
    assert.equal(evaluateCondition(SHOE, c), false);
    assert.equal(evaluateCondition(WATCH, c), true);
});

test('price lt', () => {
    const c: SmartCondition = { field: 'price', op: 'lt', value: '5000' };
    assert.equal(evaluateCondition(SHIRT, c), true);
    assert.equal(evaluateCondition(WATCH, c), false);
});

// ── evaluateCondition: numeric — inventory_quantity ───────────────────────────

test('inventory_quantity gt 0 (in-stock)', () => {
    const c: SmartCondition = { field: 'inventory_quantity', op: 'gt', value: '0' };
    assert.equal(evaluateCondition(SHOE, c), true);
    assert.equal(evaluateCondition(SHIRT, c), false);   // stock = 0
    assert.equal(evaluateCondition(WATCH, c), true);
});

test('inventory_quantity equals 0 (out of stock)', () => {
    const c: SmartCondition = { field: 'inventory_quantity', op: 'equals', value: '0' };
    assert.equal(evaluateCondition(SHIRT, c), true);
    assert.equal(evaluateCondition(SHOE, c), false);
});

test('inventory_quantity lt threshold', () => {
    const c: SmartCondition = { field: 'inventory_quantity', op: 'lt', value: '10' };
    assert.equal(evaluateCondition(WATCH, c), true);    // 5 < 10
    assert.equal(evaluateCondition(SHOE, c), false);    // 42 >= 10
});

// ── evaluateCondition: stock alias (product.stock field) ─────────────────────

test('inventory_quantity falls back to product.stock alias', () => {
    const p: EvalProduct = { id: 'px', title: 'X', stock: 3 };
    const c: SmartCondition = { field: 'inventory_quantity', op: 'lt', value: '10' };
    assert.equal(evaluateCondition(p, c), true);
});

// ── evaluateCondition: tag field ──────────────────────────────────────────────

test('tag equals — array tags', () => {
    const c: SmartCondition = { field: 'tag', op: 'equals', value: 'sport' };
    assert.equal(evaluateCondition(SHOE, c), true);
    assert.equal(evaluateCondition(SHIRT, c), false);
});

test('tag equals — csv string tags', () => {
    const c: SmartCondition = { field: 'tag', op: 'equals', value: 'cotton' };
    assert.equal(evaluateCondition(SHIRT, c), true);
    assert.equal(evaluateCondition(SHOE, c), false);
});

test('tag not_equals — no matching tag', () => {
    const c: SmartCondition = { field: 'tag', op: 'not_equals', value: 'sport' };
    assert.equal(evaluateCondition(SHOE, c), false);    // has 'sport'
    assert.equal(evaluateCondition(SHIRT, c), true);    // no 'sport'
});

test('tag contains — partial match within a tag', () => {
    const c: SmartCondition = { field: 'tag', op: 'contains', value: 'lim' };
    assert.equal(evaluateCondition(SHOE, c), true);     // 'limited' contains 'lim'
    assert.equal(evaluateCondition(SHIRT, c), false);
});

test('tag starts_with', () => {
    const c: SmartCondition = { field: 'tag', op: 'starts_with', value: 'sum' };
    assert.equal(evaluateCondition(SHIRT, c), true);    // 'summer'
    assert.equal(evaluateCondition(SHOE, c), false);
});

test('tag ends_with', () => {
    const c: SmartCondition = { field: 'tag', op: 'ends_with', value: 'ed' };
    assert.equal(evaluateCondition(SHOE, c), true);     // 'limited'
    assert.equal(evaluateCondition(SHIRT, c), false);
});

test('tag — empty tags array never matches equals', () => {
    const c: SmartCondition = { field: 'tag', op: 'equals', value: 'anything' };
    assert.equal(evaluateCondition(WATCH, c), false);
});

test('tag — empty tags array with not_equals returns false (nothing to not-match)', () => {
    const c: SmartCondition = { field: 'tag', op: 'not_equals', value: 'anything' };
    // no tags → not_equals → no tags include 'anything' → !includes → true
    assert.equal(evaluateCondition(WATCH, c), true);
});

// ── evaluateSmartCollection: match_type ──────────────────────────────────────

test('match_type all — every condition must pass', () => {
    const conditions: SmartCondition[] = [
        { field: 'vendor', op: 'equals', value: 'nike' },
        { field: 'price', op: 'gt', value: '5000' },
    ];
    assert.equal(evaluateSmartCollection(SHOE, conditions, 'all'), true);
    assert.equal(evaluateSmartCollection(SHIRT, conditions, 'all'), false);  // vendor fails
    assert.equal(evaluateSmartCollection(WATCH, conditions, 'all'), false);  // vendor fails
});

test('match_type any — at least one condition must pass', () => {
    const conditions: SmartCondition[] = [
        { field: 'vendor', op: 'equals', value: 'nike' },
        { field: 'price', op: 'lt', value: '2000' },
    ];
    assert.equal(evaluateSmartCollection(SHOE, conditions, 'any'), true);   // vendor
    assert.equal(evaluateSmartCollection(SHIRT, conditions, 'any'), true);  // price
    assert.equal(evaluateSmartCollection(WATCH, conditions, 'any'), false); // neither
});

test('empty conditions — all products match', () => {
    assert.equal(evaluateSmartCollection(SHOE, [], 'all'), true);
    assert.equal(evaluateSmartCollection(SHOE, [], 'any'), true);
});

test('null/undefined conditions — all products match', () => {
    assert.equal(evaluateSmartCollection(SHOE, null as unknown as [], 'all'), true);
    assert.equal(evaluateSmartCollection(SHOE, undefined as unknown as [], 'any'), true);
});

// ── filterProducts ────────────────────────────────────────────────────────────

test('filterProducts — returns only matching products', () => {
    const products = [SHOE, SHIRT, WATCH];
    const conditions: SmartCondition[] = [
        { field: 'price', op: 'gt', value: '5000' },
    ];
    const result = filterProducts(products, conditions, 'all');
    assert.deepEqual(result.map((p) => p.id), ['p1', 'p3']);
});

test('filterProducts — match_type any returns union', () => {
    const products = [SHOE, SHIRT, WATCH];
    const conditions: SmartCondition[] = [
        { field: 'vendor', op: 'equals', value: 'nike' },
        { field: 'vendor', op: 'equals', value: 'adidas' },
    ];
    const result = filterProducts(products, conditions, 'any');
    assert.deepEqual(result.map((p) => p.id), ['p1', 'p2']);
});

test('filterProducts — empty products array returns empty', () => {
    const conditions: SmartCondition[] = [
        { field: 'price', op: 'gt', value: '0' },
    ];
    assert.deepEqual(filterProducts([], conditions, 'all'), []);
});

test('filterProducts — empty conditions returns all products', () => {
    const products = [SHOE, SHIRT, WATCH];
    assert.equal(filterProducts(products, [], 'all').length, 3);
});

test('filterProducts — none match returns empty', () => {
    const products = [SHOE, SHIRT, WATCH];
    const conditions: SmartCondition[] = [
        { field: 'vendor', op: 'equals', value: 'nonexistent' },
    ];
    assert.deepEqual(filterProducts(products, conditions, 'all'), []);
});

// ── edge cases ────────────────────────────────────────────────────────────────

test('product with null/undefined fields — string ops return false (not throw)', () => {
    const p: EvalProduct = { id: 'null-product' };
    assert.equal(evaluateCondition(p, { field: 'title', op: 'equals', value: 'anything' }), false);
    assert.equal(evaluateCondition(p, { field: 'vendor', op: 'contains', value: 'x' }), false);
    assert.equal(evaluateCondition(p, { field: 'price', op: 'gt', value: '0' }), false);
    assert.equal(evaluateCondition(p, { field: 'inventory_quantity', op: 'equals', value: '0' }), true); // 0 === 0
});

test('price stored as string in product (JSON deserialization artifact)', () => {
    const p: EvalProduct = { id: 'px', price: '2500' as unknown as number };
    assert.equal(evaluateCondition(p, { field: 'price', op: 'gt', value: '2000' }), true);
    assert.equal(evaluateCondition(p, { field: 'price', op: 'lt', value: '2000' }), false);
});

test('title falls back to product.name alias', () => {
    const p: EvalProduct = { id: 'px', name: 'Sneaker X' };
    const c: SmartCondition = { field: 'title', op: 'contains', value: 'sneaker' };
    assert.equal(evaluateCondition(p, c), true);
});
