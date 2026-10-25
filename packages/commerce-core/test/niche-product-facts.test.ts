import assert from 'node:assert/strict';
import test from 'node:test';
import { ProductMetadataSchema, readProductNicheFacts } from '../src/index';

export const validNicheMetadata = {
  toys: { ageBands: ['6-8'], interests: ['art'] },
  electronics: { manufacturer: 'Fictional Works', model: 'CG-7', kind: 'hub' },
  food: { ingredients: 'Lentils', netQuantity: { value: 250, unit: 'g' } },
  furniture: { assembled: { unit: 'cm', width: 68 } },
  gifts: { occasions: ['thank-you'] },
  personalization: { version: 1, revision: 1, methods: [{ id: 'engrave', label: 'Engrave', min_graphemes: 1, max_graphemes: 18, character_set: 'latin-name', styles: [{ id: 'sans', label: 'Sans' }], placements: [{ id: 'front', label: 'Front' }] }] },
  beauty: { routineStage: 'care', directions: 'Merchant-supplied directions.' },
  sports: { activity: 'badminton', equipmentType: 'racket' },
  books: { kind: 'book', language: 'English', format: 'paperback' },
};

test('all nine facts namespaces validate on the existing metadata owner and project independently', () => {
  const input = { ...validNicheMetadata, privateSupplier: 'NOT_PUBLIC' };
  assert.equal(ProductMetadataSchema.safeParse(input).success, true);
  const projected = readProductNicheFacts(input);
  assert.deepEqual(Object.keys(projected).sort(), Object.keys(validNicheMetadata).sort());
  assert.equal(projected.food?.netQuantity?.value, 250);
  assert.equal('privateSupplier' in projected, false);
  assert.equal(ProductMetadataSchema.parse(input).privateSupplier, 'NOT_PUBLIC');
});

test('invalid namespace fails merchant writes and cannot contaminate valid public facts', () => {
  const input = { toys: { ...validNicheMetadata.toys, certifiedSafe: true }, food: validNicheMetadata.food };
  assert.equal(ProductMetadataSchema.safeParse(input).success, false);
  const projected = readProductNicheFacts(input);
  assert.equal(projected.toys, undefined);
  assert.equal(projected.food?.netQuantity?.unit, 'g');
});

test('anonymous facts projection neither invokes accessors nor inherits sibling metadata', () => {
  let invoked = false;
  const input = Object.create({ books: validNicheMetadata.books });
  Object.defineProperty(input, 'toys', { get() { invoked = true; throw new Error('must not run'); } });
  assert.deepEqual(readProductNicheFacts(input), {});
  assert.equal(invoked, false);
});
