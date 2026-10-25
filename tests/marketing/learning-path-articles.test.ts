import assert from 'node:assert/strict'
import test from 'node:test'
import { LEARNING_PATHS } from '../../apps/marketing/web/src/lib/resources/learning-paths'
import { getLearningPathArticles } from '../../apps/marketing/web/src/lib/resources/learning-path-articles'

test('every published reading plan resolves all guides in its intended sequence', () => {
  for (const path of LEARNING_PATHS) {
    const articles = getLearningPathArticles(path)
    assert.deepEqual(articles.map(article => article.slug), path.articleSlugs, path.slug)
    assert.ok(articles.every(article => article.readingTime > 0))
  }
})

test('First 100 Orders starts with acquisition before conversion work', () => {
  const path = LEARNING_PATHS.find(path => path.slug === 'first-100-orders')!
  const articles = getLearningPathArticles(path)
  assert.equal(articles[0].slug, 'first-100-orders-guide')
  assert.equal(articles[3].slug, 'reducing-cart-abandonment')
})
