import assert from 'node:assert/strict';
import test from 'node:test';
import { FurnitureFactsSchema, FurnitureVariantFactsSchema, furnitureLengthMm, readFurnitureFacts, resolveFurnitureFacts } from '../src/habitat-facts';

const common = { assembled: { unit: 'cm' as const, width: 68, depth: 78, height: 74 }, materials: ['Solid teak'], assembly: { status: 'assembled' as const } };
const natural = { package: { unit: 'cm' as const, width: 72, depth: 82, height: 78 }, finish: 'Natural teak' };
const smoked = { package: { unit: 'cm' as const, width: 74, depth: 84, height: 78 }, finish: 'Smoked teak' };
const facts = common;

test('furniture leaf validates supplied bounded facts and preserves honest omissions', () => {
  assert.deepEqual(FurnitureFactsSchema.parse({}), {});
  assert.equal(readFurnitureFacts({ supplierSecret: 'never public' }), null);
  assert.deepEqual(readFurnitureFacts({ supplierSecret: 'never public', furniture: facts }), FurnitureFactsSchema.parse(facts));
  assert.equal('supplierSecret' in (readFurnitureFacts({ furniture: facts, supplierSecret: 'private' }) ?? {}), false);
  for (const invalid of [{ delivery_date: 'tomorrow' }, { materials: ['x'.repeat(201)] }, { care: 'x'.repeat(2001) }, { assembled: { unit: 'guess', width: 68 } }, { assembled: { unit: 'cm', width: 0 } }, { assembled: { unit: 'cm', width: -2 } }, { assembled: { unit: 'cm', width: Infinity } }, { assembled: { unit: 'cm' } }, { package: { unit: 'cm', width: 100001 } }, { assembly: { status: 'certified' } }]) {
    assert.equal(FurnitureFactsSchema.safeParse(invalid).success, false, JSON.stringify(invalid));
    assert.equal(readFurnitureFacts({ furniture: invalid }), null);
  }
  assert.equal(readFurnitureFacts(Object.create({ furniture: facts })), null);
  assert.equal(readFurnitureFacts({ get furniture() { throw new Error('malformed metadata'); } }), null);
});
test("selected variant inline facts preserve common dimensions without mutation", () => {
  const copy = structuredClone(facts);
  const a = resolveFurnitureFacts(facts, natural); const b = resolveFurnitureFacts(facts, smoked);
  assert.deepEqual(a.assembled, b.assembled);
  assert.equal(a.package?.width, 72); assert.equal(b.package?.width, 74);
  assert.equal(b.finish, 'Smoked teak'); assert.equal('variant_id' in b, false);
  assert.deepEqual(facts, copy);
  assert.deepEqual(resolveFurnitureFacts(facts, { assembled: undefined }).assembled, facts.assembled);
  assert.deepEqual(resolveFurnitureFacts(facts, null).assembled, facts.assembled);
  const replaced = resolveFurnitureFacts(facts, { assembled: { unit: 'in', width: 27 } });
  assert.deepEqual(replaced.assembled, { unit: 'in', width: 27 });
});
test('inline variant facts reject identity/map/private keys; UUID belongs to enclosing DTO', () => {
  assert.equal(FurnitureVariantFactsSchema.safeParse(natural).success, true);
  for (const input of [{ ...natural, variant_id: '7b669c70-4400-4000-8000-000000000001' }, { sku: 'natural', ...natural }, { variant_facts: { natural } }, { private_cost: 99 }]) assert.equal(FurnitureVariantFactsSchema.safeParse(input).success, false);
  assert.equal(FurnitureFactsSchema.safeParse({ variant_facts: [] }).success, false);
});
test('supplied units normalize for comparisons and round furniture retains its diameter', () => {
  assert.equal(furnitureLengthMm(68, 'cm'), 680); assert.equal(furnitureLengthMm(680, 'mm'), 680); assert.equal(furnitureLengthMm(1, 'in'), 25.4);
  assert.deepEqual(FurnitureFactsSchema.parse({ assembled: { unit: 'cm', diameter: 50, height: 42 } }).assembled, { unit: 'cm', diameter: 50, height: 42 });
  assert.throws(() => furnitureLengthMm(NaN, 'cm')); assert.throws(() => furnitureLengthMm(-1, 'cm'));
});
