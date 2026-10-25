import assert from 'node:assert/strict';
import test from 'node:test';
import { ToyFactsSchema, ToyVariantFactsSchema, readToyFacts, resolveToyFacts } from '../src/playfield-facts';

test('variant facts are a bounded inline payload without duplicate variant identity or destructive defaults', () => {
  assert.deepEqual(ToyVariantFactsSchema.parse({ materials: 'Paper' }), { materials: 'Paper' });
  assert.deepEqual(ToyVariantFactsSchema.parse({ contents: [], dimensions: null }), { contents: [], dimensions: null });
  assert.equal(ToyVariantFactsSchema.safeParse({ variant_id: 'invented', materials: 'Paper' }).success, false);
  assert.equal(ToyVariantFactsSchema.safeParse({ contentsComplete: true }).success, false);
  assert.equal(ToyVariantFactsSchema.safeParse({ ageBands: ['6-8', '6-8'] }).success, false);
  assert.equal(ToyVariantFactsSchema.safeParse({ contents: [{ quantity: 12, label: 'Tiles' }], contentsComplete: true }).success, true);
});

test('the public metadata reader ignores inherited properties and does not execute an accessor', () => {
  let invoked = false;
  const accessor = Object.defineProperty({}, 'toys', { get: () => { invoked = true; return { ageBands: ['6-8'] }; } });
  assert.equal(readToyFacts(accessor), null);
  assert.equal(invoked, false);
  assert.equal(readToyFacts(Object.create({ toys: { ageBands: ['6-8'] } })), null);
});

test('additional dimensions identify the measured part and remain bounded', () => {
  assert.equal(ToyFactsSchema.safeParse({ additionalDimensions: [{ width: 5, unit: 'cm' }] }).success, false);
  assert.equal(ToyFactsSchema.safeParse({ additionalDimensions: Array.from({ length: 21 }, () => ({ label: 'Tile', width: 5, unit: 'cm' })) }).success, false);
  assert.equal(ToyFactsSchema.parse({ additionalDimensions: [{ label: 'Each tile', length: 5, width: 5, height: 0.6, unit: 'cm' }] }).additionalDimensions[0].label, 'Each tile');
});

test('selected editions inherit explicitly, replace whole contents and clear facts without leaking a prior edition', () => {
  const common = ToyFactsSchema.parse({ ageBands: ['6-8'], ageStatement: '6–8 years', contents: [{ label: 'tiles', quantity: 12 }, { label: 'cards', quantity: 2 }, { label: 'tray', quantity: 1 }], contentsComplete: true, dimensions: { label: 'Tray', length: 24, width: 19, height: 1.5, unit: 'cm' }, additionalDimensions: [{ label: 'Each tile', length: 5, width: 5, height: 0.6, unit: 'cm' }], materials: 'Wood', warnings: [{ text: 'Read the kit information.', sourceLabel: 'Merchant fixture' }] });
  const baseline = structuredClone(common);
  const inherited = resolveToyFacts(common, { finish: 'Blue sample finish' })!;
  assert.equal(inherited.contents.reduce((total, item) => total + item.quantity, 0), 15);
  assert.equal(inherited.dimensions?.label, 'Tray');
  assert.equal(inherited.additionalDimensions[0].height, 0.6);
  assert.equal(inherited.finish, 'Blue sample finish');
  const cleared = resolveToyFacts(common, { contents: [], dimensions: null, additionalDimensions: [], warnings: [], ageBands: [] })!;
  assert.deepEqual(cleared.contents, []);
  assert.equal(cleared.contentsComplete, false);
  assert.equal(cleared.dimensions, null);
  assert.deepEqual(cleared.additionalDimensions, []);
  assert.deepEqual(cleared.warnings, []);
  assert.deepEqual(cleared.ageBands, []);
  assert.equal(cleared.ageStatement, undefined);
  const different = resolveToyFacts(common, { ageBands: ['9-12'], contents: [{ label: 'paper sheets', quantity: 36 }], dimensions: { label: 'A5 sheet', length: 21, width: 14.8, unit: 'cm' }, additionalDimensions: [], materials: 'Paper' })!;
  assert.equal(different.contents.length, 1);
  assert.equal(different.contents[0].quantity, 36);
  assert.equal(different.contentsComplete, false);
  assert.equal(different.dimensions?.height, undefined);
  assert.equal(different.ageStatement, undefined);
  assert.equal(resolveToyFacts(common, { contents: [{ label: 'bad', quantity: -1 }] }), null);
  assert.deepEqual(common, baseline);
});

const facts = { ageBands: ['6-8'], interests: ['art'], contents: [{ label: 'Tiles', quantity: 12 }],
  contentsComplete: true, dimensions: { length: 24, width: 19, height: 1.5, unit: 'cm' },
  warnings: [{ text: 'Small parts.', sourceLabel: 'Merchant label' }] };
test('toy facts preserve merchant values and project only the toys namespace', () => {
  const result = readToyFacts({ toys: facts, supplierSecret: 'private' });
  assert.deepEqual(result, ToyFactsSchema.parse(facts));
  assert.equal(result?.ageBands[0], '6-8');
  assert.equal(result?.dimensions?.width, 19);
  assert.equal(JSON.stringify(result).includes('private'), false);
});
test('unknown and invalid historic facts stay unknown', () => {
  for (const input of [null, [], 4, {}, { toys: {} }, { toys: { ageBands: ['baby'] } }, { toys: { certified: true } }])
    assert.equal(readToyFacts(input), null);
  assert.deepEqual(readToyFacts({ toys: { materials: 'Wood' } })?.ageBands, []);
  assert.equal(readToyFacts({ toys: { interests: ['art'] } })?.dimensions, undefined);
});
test('facts reject unbounded, nonfinite, duplicate and unsupported input', () => {
  for (const patch of [
    { contents: [{ label: 'Tiles', quantity: -1 }] }, { contents: [{ label: 'Tiles', quantity: 1.5 }] },
    { dimensions: { width: Infinity, unit: 'cm' } }, { dimensions: { width: 0, unit: 'cm' } },
    { dimensions: { unit: 'cm' } }, { dimensions: { width: 4, unit: 'inch' } },
    { materials: 'x'.repeat(2001) }, { ageBands: ['6-8', '6-8'] }, { interests: ['art', 'art'] },
    { interests: ['<script>'] }, { contents: [], contentsComplete: true },
    { warnings: [{ text: 'Warning without source' }] }, { warnings: [{ text: 'Text', sourceLabel: 'Label', certified: true }] },
  ]) assert.equal(ToyFactsSchema.safeParse({ ...facts, ...patch }).success, false, JSON.stringify(patch));
});
test('plain merchant text is data; renderer must escape it rather than asserting safety', () => {
  const input = { materials: '<img src=x onerror=alert(1)>', warnings: [{ text: '<script>bad</script>', sourceLabel: 'Merchant' }] };
  assert.equal(readToyFacts({ toys: input })?.materials, input.materials);
  assert.equal(ToyFactsSchema.safeParse({ ...input, platformCertified: true }).success, false);
});
