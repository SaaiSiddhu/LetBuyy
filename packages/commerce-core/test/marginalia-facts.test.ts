import assert from 'node:assert/strict';
import test from 'node:test';
import { BooksFactsSchema, BooksVariantFactsSchema, readBooksFacts, mergeBooksVariantFacts } from '../src/marginalia-facts';
test('book facts preserve supplied bibliography and omit absent ISBN', () => {
  const facts = BooksFactsSchema.parse({ kind: 'book', authors: ['Mira Sen'], language: 'English', format: 'paperback', edition: 'First', pages: 208 });
  assert.equal('isbn' in facts, false); assert.equal(facts.kind, 'book');
});
test('ISBN normalizes only a valid supplied identifier', () => {
  const facts = BooksFactsSchema.parse({ kind: 'book', isbn: '978-0-306-40615-7' });
  assert.equal(facts.kind === 'book' && facts.isbn, '9780306406157');
  assert.equal(BooksFactsSchema.safeParse({ kind: 'book', isbn: '9780306406158' }).success, false);
  assert.equal(BooksFactsSchema.safeParse({ kind: 'book', isbn: '' }).success, false);
  assert.equal(BooksFactsSchema.safeParse({ kind: 'book', isbn: '0000000000000' }).success, false);
});
test('stationery units/counts remain factual and distinct from bibliography', () => {
  assert.equal(BooksFactsSchema.safeParse({ kind: 'stationery', paper_gsm: 100, dimensions_mm: { width: 148, height: 210 }, page_count: 96, sheet_count: 48, ruling: 'blank' }).success, true);
  for (const facts of [{ kind: 'stationery', page_count: 96, sheet_count: 96 }, { kind: 'stationery', paper_gsm: Infinity }, { kind: 'stationery', dimensions_mm: { width: -1, height: 210 } }, { kind: 'stationery', authors: ['invented'] }]) assert.equal(BooksFactsSchema.safeParse(facts).success, false);
});
test('strict bounds reject extra/private fields and unbounded input', () => {
  for (const facts of [{ kind: 'book', private_cost: 20 }, { kind: 'book', subjects: Array(17).fill('subject') }, { kind: 'book', language: 'x'.repeat(81) }, { kind: 'book', pages: 0 }, { kind: 'ebook' }]) assert.equal(BooksFactsSchema.safeParse(facts).success, false);
});
test('excerpt requires a declared permission and attribution; no guessed rights', () => {
  assert.equal(BooksFactsSchema.safeParse({ kind: 'book', excerpt: { text: 'Original text' } }).success, false);
  assert.equal(BooksFactsSchema.safeParse({ kind: 'book', excerpt: { text: 'Original text', permission: 'merchant_owned', attribution: 'Sample publisher' } }).success, true);
});
test('reader fails closed for absent, inherited, invalid and accessor facts and excludes private metadata', () => {
  for (const metadata of [null, [], {}, { books: { kind: 'book', pages: -1 } }, Object.create({ books: { kind: 'book' } }), Object.defineProperty({}, 'books', { get() { throw Error('do not execute'); } })]) assert.equal(readBooksFacts(metadata), null);
  assert.deepEqual(readBooksFacts({ books: { kind: 'book', language: 'Hindi' }, internal_token: 'private' }), { kind: 'book', language: 'Hindi' });
});
test('inline canonical variant facts distinguish editions without a second ID map', () => {
  const facts = BooksFactsSchema.parse({ kind: 'book', authors: ['Mira Sen'], language: 'English', format: 'paperback' });
  const selected = mergeBooksVariantFacts(facts, { kind: 'book', language: 'Hindi', format: 'hardback', edition: 'Translated edition' });
  assert.equal(selected?.kind === 'book' && selected.language, 'Hindi');
  assert.equal(selected?.kind === 'book' && selected.format, 'hardback');
  assert.equal(mergeBooksVariantFacts(facts, undefined), null);
  assert.equal(mergeBooksVariantFacts(facts, { kind: 'stationery', ruling: 'lined' }), null);
  assert.equal(BooksVariantFactsSchema.safeParse({ kind: 'book', language: 'Hindi', format: 'hardback', variant_id: 'client-made' }).success, false);
  assert.equal(BooksFactsSchema.safeParse({ ...facts, variant_facts: [] }).success, false);
  assert.equal(BooksVariantFactsSchema.safeParse({ kind: 'stationery', page_count: 50, sheet_count: 50 }).success, false);
});
test('unknown facts remain absent and text is not silently rewritten as a claim', () => {
  assert.deepEqual(readBooksFacts({ books: { kind: 'book' } }), { kind: 'book' });
  assert.equal(readBooksFacts({ books: { kind: 'book', authors: ['<script>alert(1)</script>'] } })?.kind, 'book');
});
