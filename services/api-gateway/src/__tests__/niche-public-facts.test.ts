import assert from 'node:assert/strict';
import test from 'node:test';
import { toPublicProduct } from '../lib/public-product-view';

test('anonymous product serialization exposes only validated niche/apparel namespaces', () => {
  const product = toPublicProduct({
    id: 'fictional-product', cost_price: 123, sku: 'PRIVATE',
    metadata: { privateSupplier: 'NEVER_PUBLIC', toys: { ageBands: ['6-8'] }, food: { ingredients: 'Lentils' }, books: { kind: 'book', language: 'English' }, apparel: { fit: 'Relaxed' } },
  });
  const serialized = JSON.stringify(product);
  assert.doesNotMatch(serialized, /NEVER_PUBLIC|privateSupplier|cost_price|PRIVATE/);
  const metadata = product.metadata as Record<string, unknown>;
  assert.deepEqual(Object.keys(metadata).sort(), ['apparel', 'books', 'food', 'toys']);
});

test('malformed niche payloads fail closed without suppressing an unrelated valid namespace', () => {
  const product = toPublicProduct({ metadata: { furniture: { assembled: { width: -1, unit: 'cm' } }, electronics: { model: 'CG-7' } } });
  assert.deepEqual(Object.keys(product.metadata as Record<string, unknown>), ['electronics']);
});

test('variant facts retain enclosing durable identity while dropping private or malformed metadata', () => {
  const product = toPublicProduct({ variants: [
    { id: 'durable-250', sku: 'PRIVATE_SKU', metadata: { privateSupplier: 'SECRET', food: { netQuantity: { value: 250, unit: 'g' } }, books: { kind: 'book', language: 'English', format: 'paperback' } } },
    { id: 'durable-bad', metadata: { food: { netQuantity: { value: -1, unit: 'g' } } } },
  ] });
  const rows = product.variants as Array<Record<string, unknown>>;
  assert.equal(rows[0].id, 'durable-250');
  assert.deepEqual(Object.keys(rows[0].metadata as object).sort(), ['books', 'food']);
  assert.equal(rows[1].metadata, undefined);
  assert.doesNotMatch(JSON.stringify(product), /PRIVATE_SKU|SECRET|privateSupplier/);
});
