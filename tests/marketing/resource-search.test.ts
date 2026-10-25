import assert from 'node:assert/strict'
import test from 'node:test'
import { ARTICLES, searchArticles as searchFromCatalog } from '../../apps/marketing/web/src/lib/resources/articles'
import { searchArticles as searchFromUtilities } from '../../apps/marketing/web/src/lib/resources/utils'
import {
  filterResourceArticles,
  getResourceResultPage,
  matchResourceArticles,
  readResourceSearch,
  RESOURCE_READING_LENGTHS,
  RESOURCE_SUGGESTIONS,
} from '../../apps/marketing/web/src/lib/resources/resource-search'

const state = (query = '') => readResourceSearch(new URLSearchParams(query))

test('multiword queries match terms across guide fields and ignore extra whitespace/case', () => {
  const matches = matchResourceArticles(ARTICLES, '  UPI   PAYMENTS  ')
  assert.ok(matches.length > 0)
  assert.deepEqual(matches, matchResourceArticles(ARTICLES, 'payments upi'))
  assert.deepEqual(matchResourceArticles(ARTICLES, 'UPI zzz-no-existing-word'), [])
  assert.deepEqual(searchFromCatalog('payments upi'), searchFromUtilities('payments upi'))
})

test('every displayed search suggestion returns an actual guide', () => {
  for (const query of RESOURCE_SUGGESTIONS) {
    assert.ok(matchResourceArticles(ARTICLES, query).length > 0, query)
  }
})

test('category-only browsing returns guides without requiring a query', () => {
  const matches = filterResourceArticles(ARTICLES, state('category=payments'))
  assert.equal(matches.length, 5)
  assert.ok(matches.every(article => article.category === 'payments'))
  const combined = filterResourceArticles(ARTICLES, state('q=upi&category=payments&length=medium'))
  assert.ok(combined.length > 0)
  assert.ok(combined.every(article => article.category === 'payments' && article.readingTime >= 6 && article.readingTime <= 10))
})

test('blank and whitespace-only searches browse the catalogue consistently', () => {
  assert.deepEqual(filterResourceArticles(ARTICLES, state()), ARTICLES)
  assert.deepEqual(filterResourceArticles(ARTICLES, state('q=+++')), ARTICLES)
  assert.deepEqual(matchResourceArticles(ARTICLES, '   '), [])
})

test('reading-time filters form disjoint ranges at five and ten minutes', () => {
  const fixture = [4, 5, 6, 9, 10, 11].map(readingTime => ({ ...ARTICLES[0], slug: `read-${readingTime}`, readingTime }))
  const partitions = RESOURCE_READING_LENGTHS.map(length => filterResourceArticles(fixture, state(`length=${length.value}`)).map(article => article.readingTime))
  assert.deepEqual(partitions, [[4, 5], [6, 9, 10], [11]])
  assert.equal(new Set(partitions.flat()).size, fixture.length)
})

test('deep-linked criteria parse and invalid filter/page values safely fall back', () => {
  assert.deepEqual(state('q=GST+invoices&category=payments&length=medium&page=2'), { query: 'GST invoices', category: 'payments', length: 'medium', page: 2 })
  for (const page of ['-1', '0', 'Infinity', 'abc', '2.5', '99999999999']) {
    assert.deepEqual(state(`category=bad&length=bad&page=${page}`), { query: '', category: '', length: '', page: 1 })
  }
})

test('pagination exposes each matching guide exactly once and clamps stale pages', () => {
  const all = filterResourceArticles(ARTICLES, state())
  const pages = Array.from({ length: getResourceResultPage(all, 1).pageCount }, (_, i) => getResourceResultPage(all, i + 1))
  assert.deepEqual(pages.flatMap(page => page.articles), all)
  assert.equal(getResourceResultPage(all, 999).page, pages.length)
  assert.equal(getResourceResultPage(all, 999).articles.length, 5)
})

test('empty results produce a valid empty page without fabricated guides', () => {
  const empty = filterResourceArticles(ARTICLES, state('q=zzznomatchingguide&category=growth&length=short'))
  assert.deepEqual(empty, [])
  assert.deepEqual(getResourceResultPage(empty, 10), { page: 1, pageCount: 1, start: 0, articles: [] })
})
