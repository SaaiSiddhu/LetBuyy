import assert from 'node:assert/strict';
import test from 'node:test';
import { toPublicProduct } from '../lib/public-product-view';

test('public garment projection exposes the validated namespace without unrelated merchant metadata', () => {
  const result = toPublicProduct({ id: 'synthetic-shirt', metadata: { internalSupplier: 'PRIVATE', apparel: { fit: 'Relaxed', measurements: [{ size: 'M', chest: 102 }] } }, cost_price: 500 });
  assert.equal((result.metadata as { apparel: { fit: string } }).apparel.fit, 'Relaxed');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|cost_price|internalSupplier/);
  assert.deepEqual(toPublicProduct({ metadata: { apparel: { unit: 'invalid' } } }).metadata, {});
});
