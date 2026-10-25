import assert from 'node:assert/strict';
import test from 'node:test';
import { GiftFactsSchema, readGiftFacts, validateGiftMediaRoles, rebindGiftMediaRoles } from '../src/kindred-facts';

const facts = { occasions: ['birthday'], recipients: ['friend'], contents: [{ label: 'Ceramic mug', quantity: 1, detail: '300 ml' }], mediaRoles: { openBox: 0, closedBox: 1 } };
test('gift facts preserve bounded merchant data through the deliberate namespace', () => {
  const result = readGiftFacts({ gifts: facts, privateSupplier: 'NEVER_PUBLIC' });
  assert.deepEqual(result, { schemaVersion: 1, ...facts });
  assert.equal('privateSupplier' in result!, false);
  assert.equal(readGiftFacts({ apparel: facts }), null);
});
test('unknown, incomplete and unsafe shapes never become invented gift contents', () => {
  for (const value of [null, [], {}, { gifts: {} }, { gifts: [] }, { gifts: { contents: [] } }, { gifts: { contents: [{ label: 'Mug', quantity: -1 }] } }, { gifts: { ...facts, message: 'Unsupported' } }, { gifts: { ...facts, price: 100 } }, { gifts: { ...facts, contents: [{ label: 'Mug', quantity: 1, private: true }] } }]) assert.equal(readGiftFacts(value), null);
  assert.equal(readGiftFacts(Object.create({ gifts: facts })), null);
  assert.equal(readGiftFacts({ gifts: Object.create(facts) }), null);
  const accessor = Object.defineProperty({}, 'gifts', { get() { throw new Error('Do not invoke metadata accessors.'); } });
  assert.equal(readGiftFacts(accessor), null);
  assert.deepEqual(readGiftFacts({ gifts: { suitabilityNote: 'For a quiet morning.' } }), { schemaVersion: 1, suitabilityNote: 'For a quiet morning.' });
});
test('facts bound counts, aggregate size, category keys, duplicate contents and media roles', () => {
  for (const value of [
    { ...facts, occasions: ['Birthday'] }, { ...facts, occasions: ['birthday', 'birthday'] },
    { ...facts, recipients: Array.from({ length: 13 }, (_, i) => `recipient-${i}`) },
    { ...facts, suitabilityNote: 'x'.repeat(501) },
    { ...facts, contents: [{ label: 'Mug', quantity: 1.5 }] },
    { ...facts, contents: [{ label: 'Mug', quantity: 101 }] },
    { ...facts, contents: [{ label: 'Mug', quantity: 1 }, { label: 'mug', quantity: 1 }] },
    { ...facts, contents: Array.from({ length: 31 }, (_, i) => ({ label: `Item ${i}`, quantity: 1 })) },
    { ...facts, contents: Array.from({ length: 15 }, (_, i) => ({ label: `Item ${i}`, quantity: 1, detail: 'x'.repeat(1000), care: 'y'.repeat(1000) })) },
    { ...facts, mediaRoles: { openBox: 20 } }, { ...facts, mediaRoles: { openBox: -1 } },
    { ...facts, mediaRoles: { openBox: 1, closedBox: 1 } }, { ...facts, mediaRoles: {} },
    { ...facts, mediaRoles: { openBox: 0, remoteUrl: 'https://example.test' } },
  ]) assert.equal(GiftFactsSchema.safeParse(value).success, false, JSON.stringify(value).slice(0, 100));
});
test('literal markup is merchant text, not execution; Unicode facts and quantities remain exact', () => {
  const result = GiftFactsSchema.parse({ contents: [{ label: '<script>not executable</script>', quantity: 2, detail: 'मित्र के लिए' }] });
  assert.equal(result.contents![0].quantity, 2);
  assert.equal(result.contents![0].detail, 'मित्र के लिए');
});

test('supplied media roles validate against the effective image list, with missing facts allowed', () => {
  const parsed = GiftFactsSchema.parse(facts);
  assert.equal(validateGiftMediaRoles(parsed, ['open.webp', 'closed.webp']), true);
  assert.equal(validateGiftMediaRoles(parsed, ['open.webp']), false);
  assert.equal(validateGiftMediaRoles(parsed, ['open.webp', '']), false);
  assert.equal(validateGiftMediaRoles({ ...parsed, mediaRoles: { openBox: 19 } }, ['open.webp', 'closed.webp']), false);
  assert.equal(validateGiftMediaRoles({ ...parsed, mediaRoles: { openBox: -1 } }, ['open.webp']), false);
  assert.equal(validateGiftMediaRoles({ ...parsed, mediaRoles: { openBox: 0.5 } }, ['open.webp']), false);
  assert.equal(validateGiftMediaRoles(GiftFactsSchema.parse({ suitabilityNote: 'For a quiet day.' }), []), true);
  assert.equal(validateGiftMediaRoles(null, []), true);
  assert.equal(validateGiftMediaRoles(undefined, []), true);
});

test('image-only edits rebind exact reordered URLs and clear replaced photographs without mutating inputs', () => {
  const parsed = GiftFactsSchema.parse(facts);
  const oldImages = ['open.webp', 'closed.webp', 'detail.webp'];
  const reordered = ['detail.webp', 'closed.webp', 'open.webp'];
  const before = structuredClone({ parsed, oldImages, reordered });
  const rebound = rebindGiftMediaRoles(parsed, oldImages, reordered)!;
  assert.deepEqual(rebound.mediaRoles, { openBox: 2, closedBox: 1 });
  assert.deepEqual(rebound.contents, parsed.contents);
  assert.equal(validateGiftMediaRoles(rebound, reordered), true);
  assert.notEqual(rebound, parsed);
  assert.notEqual(rebound.contents, parsed.contents);
  assert.deepEqual({ parsed, oldImages, reordered }, before);
  assert.deepEqual(rebindGiftMediaRoles(parsed, oldImages, ['replacement.webp', 'closed.webp'])!.mediaRoles, { closedBox: 1 });
});

test('removed, invalid and ambiguous image references clear only roles that cannot be proven', () => {
  const parsed = GiftFactsSchema.parse(facts);
  assert.deepEqual(rebindGiftMediaRoles(parsed, ['open.webp', 'closed.webp'], ['open.webp', 'open.webp', 'closed.webp'])!.mediaRoles, { closedBox: 2 });
  assert.deepEqual(rebindGiftMediaRoles({ ...parsed, mediaRoles: { openBox: 19, closedBox: 1 } }, ['open.webp', 'closed.webp'], ['closed.webp'])!.mediaRoles, { closedBox: 0 });
  const cleared = rebindGiftMediaRoles(parsed, ['open.webp', 'closed.webp'], ['replacement.webp'])!;
  assert.equal('mediaRoles' in cleared, false);
  assert.deepEqual(cleared.contents, parsed.contents);
  const rolesOnly = GiftFactsSchema.parse({ mediaRoles: { openBox: 0, closedBox: 1 } });
  assert.equal(rebindGiftMediaRoles(rolesOnly, ['same.webp', 'same.webp'], ['same.webp']), null);
  assert.equal(rebindGiftMediaRoles(rolesOnly, ['open.webp', 'closed.webp'], []), null);
});

test('empty media-only facts become null while other valid gift facts remain fresh objects', () => {
  const noRoles = GiftFactsSchema.parse({ suitabilityNote: 'For a quiet day.' });
  assert.deepEqual(rebindGiftMediaRoles(noRoles, [], []), noRoles);
  assert.notEqual(rebindGiftMediaRoles(noRoles, [], []), noRoles);
  assert.equal(rebindGiftMediaRoles(GiftFactsSchema.parse({ mediaRoles: { openBox: 0 } }), ['open.webp'], ['different.webp']), null);
  assert.equal(rebindGiftMediaRoles(null, [], []), null);
  assert.equal(rebindGiftMediaRoles(undefined, [], []), null);
});
