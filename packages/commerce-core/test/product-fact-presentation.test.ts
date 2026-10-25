import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProductFactPresentation, buildVariantFactPresentation, ProductVariantMetadataSchema } from '../src/index';
import { validNicheMetadata } from './niche-product-facts.test';

test('derived card scalars come from valid raw namespaces and never merchant display hints', () => {
  const output = buildProductFactPresentation({ facts: {
    ...validNicheMetadata,
    gifts: { contents: [{ label: 'Notebook', quantity: 2 }, { label: 'Pen', quantity: 1 }] },
    beauty: { netQuantity: { value: 30, unit: 'ml' }, shades: [{ value: 'Rose' }, { value: 'Clay' }] },
    privateSupplier: 'SECRET', furniture_display: { package: 'fabricated' },
  }, priceMinor: 18000, hasOptions: true });
  assert.equal((output.gifts as Record<string, unknown>).itemCount, 3);
  assert.equal((output.food as Record<string, unknown>).unitPriceMinor, 7200);
  assert.equal((output.beauty as Record<string, unknown>).shadeCount, 2);
  assert.equal((output.beauty as Record<string, unknown>).netQuantityLabel, '30 ml');
  assert.equal((output.toys_card as Record<string, unknown>).ageLabel, 'Ages 6–8');
  assert.equal((output.furniture_display as Record<string, unknown>).assembled, '68 W cm');
  assert.doesNotMatch(JSON.stringify(output), /SECRET|fabricated/);
});

test('variant food does not inherit a product pack or infer quantity from title or shipping weight', () => {
  const common = { food: { netQuantity: { value: 999, unit: 'ml' } } };
  const product = buildProductFactPresentation({ facts: common, priceMinor: 18000, hasVariants: true });
  assert.equal((product.food as Record<string, unknown>).netQuantityValue, undefined);
  assert.equal(buildVariantFactPresentation({}, common, 18000).food, undefined);
  const known = buildVariantFactPresentation({ food: { netQuantity: { value: 250, unit: 'g' } } }, common, 18000);
  assert.equal((known.food as Record<string, unknown>).netQuantityValue, 250);
  assert.equal((known.food as Record<string, unknown>).unitPriceMinor, 7200);
  assert.equal(buildVariantFactPresentation({ food: { netQuantity: { value: -1, unit: 'g' } } }, common).food, undefined);
});

test('inline metadata is strict and resolves edition inheritance without mixing measurement groups', () => {
  assert.equal(ProductVariantMetadataSchema.safeParse({ food: { netQuantity: { value: 250, unit: 'g' }, variant_id: 'fake' } }).success, false);
  assert.equal(ProductVariantMetadataSchema.safeParse({ privateSupplier: 'forbidden' }).success, false);
  assert.equal(ProductVariantMetadataSchema.safeParse({ food: null }).success, true);
  const common = { toys: { ageBands: ['6-8'], ageStatement: 'Common age', contents: [{ label: 'Cards', quantity: 15 }], contentsComplete: true }, furniture: { package: { width: 72, depth: 82, height: 78, unit: 'cm' } } };
  const output = buildVariantFactPresentation({ toys: { ageBands: ['9-12'], contents: [] }, furniture: { package: { width: 30, unit: 'in' } } }, common);
  assert.equal((output.toys_card as Record<string, unknown>).ageLabel, 'Ages 9–12');
  assert.equal((output.toys_card as Record<string, unknown>).contentsLabel, undefined);
  assert.equal((output.furniture_display as Record<string, unknown>).package, '30 W in');
  assert.equal(common.toys.contents.length, 1);
});

test('personalization remains exact inert JSON; summaries are scalars at collection depth', () => {
  const facts = structuredClone(validNicheMetadata.personalization);
  facts.methods[0].label = '<b>Engrave & review</b>';
  const output = buildProductFactPresentation({ facts: { personalization: facts } });
  const json = output.personalization_json as string;
  assert.doesNotMatch(json, /[<>&]/);
  assert.deepEqual(JSON.parse(json), facts);
  assert.equal((output.personalization as Record<string, unknown>).methodSummary, '<b>Engrave & review</b> · 1–18');
});
