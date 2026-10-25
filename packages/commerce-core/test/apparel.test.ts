import assert from 'node:assert/strict';
import test from 'node:test';
import { ApparelFactsSchema, ProductMetadataSchema, readApparelFacts } from '../src/apparel';

test('garment facts validate bounded units, measurements and unique sizes', () => {
  const facts = { fit: 'Relaxed', unit: 'cm', measurements: [{ size: 'M', chest: 102 }] };
  assert.equal(ApparelFactsSchema.parse(facts).measurements[0].chest, 102);
  assert.equal(ApparelFactsSchema.safeParse({ ...facts, unit: 'guess' }).success, false);
  assert.equal(ApparelFactsSchema.safeParse({ ...facts, measurements: [{ size: 'M', chest: -1 }] }).success, false);
  assert.equal(ApparelFactsSchema.safeParse({ ...facts, measurements: [{ size: 'M' }, { size: 'm' }] }).success, false);
  assert.equal(ProductMetadataSchema.safeParse({ apparel: { ...facts, secret: true } }).success, false);
  assert.equal(readApparelFacts({ private: 'hidden' }), null);
});
