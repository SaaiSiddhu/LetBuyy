import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptedPersonalizationSchema, PersonalizationFactsSchema, countPersonalizationGraphemes, personalizationFingerprintInput, readPersonalizationFacts, reviewPersonalization, updatePersonalizationDraft, type PersonalizationDraft, type PersonalizationFacts } from '../src/madeyours-facts';

const facts: PersonalizationFacts = { version: 1, revision: 1, methods: [{ id: 'engraving', label: 'Front engraving', min_graphemes: 1, max_graphemes: 18, character_set: 'latin-name', styles: [{ id: 'sans', label: 'Sans' }, { id: 'serif', label: 'Serif' }], placements: [{ id: 'front-center', label: 'Centered on the front' }] }] };
const draft: PersonalizationDraft = { method_id: 'engraving', style_id: 'sans', placement_id: 'front-center', text: 'Asha' };

test('public projection returns only a strict, bounded personalization namespace', () => {
  assert.deepEqual(readPersonalizationFacts({ personalization: facts, private_supplier_token: 'never-public' }), facts);
  for (const input of [null, [], {}, { personalization: {} }, { personalization: { ...facts, file_upload: true } }, Object.create({ personalization: facts })]) assert.equal(readPersonalizationFacts(input), null);
  assert.equal(JSON.stringify(readPersonalizationFacts({ personalization: facts, token: 'secret' })).includes('secret'), false);
});
test('rejects duplicate identifiers, unbounded arrays, invalid limits and extra nested fields', () => {
  const method = facts.methods[0];
  for (const candidate of [{ ...facts, methods: [method, method] }, { ...facts, revision: 0 }, { ...facts, methods: [] }, { ...facts, methods: [{ ...method, max_graphemes: 81 }] }, { ...facts, methods: [{ ...method, min_graphemes: 20 }] }, { ...facts, methods: [{ ...method, styles: [method.styles[0], method.styles[0]] }] }, { ...facts, methods: [{ ...method, placements: Array(9).fill(method.placements[0]) }] }, { ...facts, methods: [{ ...method, price: 0 }] }, { ...facts, methods: [{ ...method, character_set: 'arbitrary-regex' }] }]) assert.equal(PersonalizationFactsSchema.safeParse(candidate).success, false);
});
test('revalidates against current catalog method/style/placement without accepting client price or labels', () => {
  for (const override of [{ method_id: 'unknown' }, { style_id: 'unknown' }, { placement_id: 'unknown' }, { price: 0 }, { text: 'Asha', accepted: true }, { method: { label: 'fake' } }]) assert.equal(reviewPersonalization(facts, { ...draft, ...override }).valid, false);
  const result = reviewPersonalization(facts, draft);
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.deepEqual(result.accepted, { version: 1, facts_revision: 1, method: { id: 'engraving', label: 'Front engraving' }, style: { id: 'sans', label: 'Sans' }, placement: { id: 'front-center', label: 'Centered on the front' }, text: 'Asha' });
    assert.equal(AcceptedPersonalizationSchema.safeParse(result.accepted).success, true);
  }
});
test('valid boundary text is echoed exactly: no trimming, case folding or punctuation substitution', () => {
  for (const value of ['A', 'A'.repeat(18), ' Asha ', "O'Neil", 'Anne-Marie', 'asha', 'ASHA', 'A  B']) {
    const result = reviewPersonalization(facts, { ...draft, text: value });
    assert.equal(result.valid, true, value);
    if (result.valid) assert.equal(result.accepted.text, value);
  }
  for (const value of ['', 'A'.repeat(19), '   ', '---', 'Asha ✦', 'Kabir9', 'Asha\n', 'Asha\u200b', '\u202eAsha', '<img src=x onerror=alert(1)>', '{{ secret }}', '\ud800']) assert.equal(reviewPersonalization(facts, { ...draft, text: value }).valid, false, value);
});
test('Unicode policy is explicit and NFC changes require review rather than silent normalization', () => {
  const unicodeFacts = { ...facts, methods: [{ ...facts.methods[0], character_set: 'unicode-letters' }] };
  const decomposed = reviewPersonalization(unicodeFacts, { ...draft, text: 'Jose\u0301' });
  assert.equal(decomposed.valid, false);
  if (!decomposed.valid) assert.deepEqual(decomposed.issues.find(issue => issue.code === 'NORMALIZE_TEXT')?.suggested_text, 'José');
  assert.equal(reviewPersonalization(unicodeFacts, { ...draft, text: 'José' }).valid, true);
  assert.equal(reviewPersonalization(facts, { ...draft, text: 'José' }).valid, false);
  assert.equal(reviewPersonalization(unicodeFacts, { ...draft, text: 'आशा' }).valid, true);
  assert.equal(countPersonalizationGraphemes('e\u0301'), 1);
  assert.equal(countPersonalizationGraphemes('👩‍👩‍👧‍👦'), 1);
  assert.equal(reviewPersonalization(unicodeFacts, { ...draft, text: '👩‍👩‍👧‍👦' }).valid, false);
});
test('invalid edit retains exact draft and last valid illustration; catalog revision invalidates stale illustration', () => {
  const initial = updatePersonalizationDraft(facts, draft);
  const edited = updatePersonalizationDraft(facts, { ...draft, text: 'Asha ✦' }, initial);
  assert.equal(edited.draft.text, 'Asha ✦');
  assert.equal(edited.review.valid, false);
  assert.equal(edited.lastValidPreview?.text, 'Asha');
  assert.equal(updatePersonalizationDraft({ ...facts, revision: 2 }, edited.draft, edited).lastValidPreview, null);
  const fixed = updatePersonalizationDraft(facts, { ...draft, text: 'Kabir' }, edited);
  assert.equal(fixed.review.valid, true);
  assert.equal(fixed.lastValidPreview?.text, 'Kabir');
  assert.equal(draft.text, 'Asha');
});
test('fingerprint input is deterministic and distinguishes same SKU configurations and revisions', () => {
  const a = reviewPersonalization(facts, draft);
  assert.equal(a.valid, true);
  if (!a.valid) return;
  assert.equal(a.fingerprintInput, '[1,1,"engraving","sans","front-center","Asha"]');
  assert.equal(personalizationFingerprintInput(structuredClone(a.accepted)), a.fingerprintInput);
  for (const candidate of [{ ...draft, text: 'Kabir' }, { ...draft, style_id: 'serif' }, { ...draft, text: ' Asha' }]) {
    const b = reviewPersonalization(facts, candidate);
    assert.equal(b.valid, true);
    if (b.valid) assert.notEqual(a.fingerprintInput, b.fingerprintInput);
  }
  const revised = reviewPersonalization({ ...facts, revision: 2 }, draft);
  if (revised.valid) assert.notEqual(a.fingerprintInput, revised.fingerprintInput);
});
test('long and malformed inputs fail before becoming accepted snapshots', () => {
  assert.equal(reviewPersonalization(facts, { ...draft, text: 'A'.repeat(1001) }).valid, false);
  for (const candidate of [null, [], 'Asha', { ...draft, text: 123 }, { ...draft, __unknown: 'x' }]) assert.equal(reviewPersonalization(facts, candidate).valid, false);
  assert.equal(AcceptedPersonalizationSchema.safeParse({ version: 1, facts_revision: 1, method: { id: 'x', label: 'X' }, style: { id: 'x', label: 'X' }, placement: { id: 'x', label: 'X' }, text: 'A\n' }).success, false);
});
