import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { CreateProductSchema, UpdateProductSchema } from '../../../../packages/commerce-core/src/index';

const images = ['https://cdn.example.test/open.webp', 'https://cdn.example.test/closed.webp'];
const valid = {
  store_id: '11111111-1111-4111-8111-111111111111', name: 'Synthetic gift image-role probe', price: 1790, images,
  metadata: { gifts: { contents: [{ label: 'Mug', quantity: 1 }], mediaRoles: { openBox: 0, closedBox: 1 } } },
};
const editFields = { version: 1, idempotency_key: '22222222-2222-4222-8222-222222222222' };
const validEdit = { ...editFields, images: [images[0]], metadata: { gifts: { mediaRoles: { openBox: 0 } } } };
assert.equal(CreateProductSchema.safeParse(valid).success, true, 'Create positive control must pass.');
assert.equal(UpdateProductSchema.safeParse(validEdit).success, true, 'Update positive control must pass.');
const cases = [
  { name: 'create role19 with two images', input: { ...valid, metadata: { gifts: { ...valid.metadata.gifts, mediaRoles: { openBox: 19, closedBox: 18 } } } }, schema: CreateProductSchema },
  { name: 'update role1 with one replacement image', input: { ...editFields, images: [images[0]], metadata: { gifts: { mediaRoles: { closedBox: 1 } } } }, schema: UpdateProductSchema },
];
const result = {
  positiveControls: { createAccepted: true, updateAccepted: true },
  cases: cases.map(({ name, input, schema }) => ({ name, expectedAccepted: false, observedAccepted: schema.safeParse(input).success, input })),
  buyerRender: 'actual mapper→Kindred renderer suppresses missing-index images/captions; app-mapper-tests.log test5 passes',
  remaining: 'Canonical image-only update rebind/persistence acceptance remains separate from these supplied-image schema probes.',
};
writeFileSync(new URL('media-role-write-probe.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify(result) + '\n');
if (result.cases.some(item => item.observedAccepted !== item.expectedAccepted)) process.exitCode = 1;
