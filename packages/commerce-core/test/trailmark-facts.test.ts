import assert from 'node:assert/strict';
import test from 'node:test';
import { SportsFactsSchema, SportsVariantFactsSchema, readSportsFacts, resolveSportsMeasurements } from '../src/trailmark-facts';
const variantId = '7b669c70-8400-4000-8000-000000000001';
const base = { activity: 'Badminton', equipmentType: 'racket', length: { value: 68, unit: 'cm' }, weight: { value: 88, unit: 'g' } };

test('sports namespace returns only bounded merchant-authored facts', () => {
  const result = readSportsFacts({ privateSupplierCost: 900, sports: base });
  assert.equal(result?.activity, 'Badminton');
  assert.equal(result?.version, 1);
  assert.deepEqual(result?.length, { value: 68, unit: 'cm' });
  assert.equal(result?.compatibility, undefined);
  assert.equal(JSON.stringify(result).includes('privateSupplierCost'), false);
});
test('missing, malformed, extra, unsafe-scope and unbounded fields fail closed', () => {
  for (const value of [null, [], {}, { sports: null }, { sports: [] }, { sports: { ...base, size: 'M' } }, { sports: { ...base, equipmentType: 'climbing-harness' } }, { sports: { ...base, activity: '' } }, { sports: { ...base, care: 'x'.repeat(2001) } }, { sports: { ...base, length: { value: -1, unit: 'cm' } } }, { sports: { ...base, length: { value: Infinity, unit: 'cm' } } }, { sports: { ...base, weight: { value: 88, unit: 'lb' } } }]) assert.equal(readSportsFacts(value), null);
});
test('unknown compatibility stays absent or explicitly unconfirmed; supplied claims need reference', () => {
  assert.equal(SportsFactsSchema.parse({ ...base, compatibility: { status: 'unconfirmed' } }).compatibility?.status, 'unconfirmed');
  assert.equal(SportsFactsSchema.safeParse({ ...base, compatibility: { status: 'merchant-supplied' } }).success, false);
  assert.equal(SportsFactsSchema.safeParse({ ...base, compatibility: { status: 'universal' } }).success, false);
});
test('canonical inline variant facts carry no duplicate identity or correlation map', () => {
  const facts = SportsFactsSchema.parse(base);
  const variant = SportsVariantFactsSchema.parse({ gripCircumference: { value: 84, unit: 'mm' } });
  assert.equal(resolveSportsMeasurements(facts, variant).gripCircumference?.value, 84);
  assert.equal(resolveSportsMeasurements(facts).gripCircumference, undefined);
  assert.equal(resolveSportsMeasurements(facts, variant).length?.value, 68);
  assert.equal(SportsVariantFactsSchema.safeParse({ variantId, ...variant }).success, false);
  assert.equal(SportsVariantFactsSchema.safeParse({}).success, false);
  assert.equal(SportsFactsSchema.safeParse({ ...base, variantMeasurements: [{ variantId, ...variant }] }).success, false);
});
test('selected canonical variant overrides common measurements without changing common facts', () => {
  const facts = SportsFactsSchema.parse(base);
  const variant = SportsVariantFactsSchema.parse({ length: { value: 66, unit: 'cm' } });
  assert.equal(resolveSportsMeasurements(facts, variant).length?.value, 66);
  assert.equal(facts.length?.value, 68);
});
test("reader does not execute metadata getters or inherit another object's sports namespace", () => {
  assert.equal(readSportsFacts(Object.create({ sports: base })), null);
  assert.equal(readSportsFacts(Object.defineProperty({}, 'sports', { get() { throw new Error('private accessor'); } })), null);
});
