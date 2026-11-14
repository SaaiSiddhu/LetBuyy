import { resourceHeadingId } from '../../apps/marketing/web/src/lib/resources/headings'
import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { ARTICLES } from '../../apps/marketing/web/src/lib/resources/articles'
import { getArticleArtwork, getLearningPathArtwork } from '../../apps/marketing/web/src/lib/resources/artwork'
import { getReadingTopics } from '../../apps/marketing/web/src/lib/resources/reading-visuals'
import { CHANGELOG } from '../../apps/marketing/web/src/lib/resources/changelog'
import { RELEASE_ARTWORK, RELEASE_LABELS } from '../../apps/marketing/web/src/lib/resources/changelog-presentation'
import { getSectionVisuals } from '../../apps/marketing/web/src/lib/resources/section-visuals'
import { LEARNING_PATHS } from '../../apps/marketing/web/src/lib/resources/learning-paths'

test('every published reading page has a real local illustration with an alternative', () => {
  for (const article of ARTICLES) {
    const artwork = getArticleArtwork(article.slug)
    assert.ok(artwork, article.slug)
    assert.ok(artwork.alt.length > 20, article.slug)
    const file = resolve('apps/marketing/web/public', artwork.src.slice(1))
    assert.ok(existsSync(file), `${article.slug}: ${artwork.src}`)
    assert.ok(statSync(file).size > 1000, `${article.slug}: image is empty`)
    assert.ok(statSync(resolve('apps/marketing/web/public', artwork.thumbnailSrc.slice(1))).size > 1000, `${article.slug}: missing thumbnail`)
  }
  assert.equal(getArticleArtwork('unpublished-guide'), undefined)
})

test('each reading plan has an illustration and every standard article has two valid section scenes', () => {
  for (const path of LEARNING_PATHS) {
    const artwork = getLearningPathArtwork(path.slug)
    assert.ok(artwork, path.slug)
    assert.ok(existsSync(resolve('apps/marketing/web/public', artwork.thumbnailSrc.slice(1))))
  }
  for (const article of ARTICLES) {
    const visuals = getSectionVisuals(article)
    if (['how-themes-work', 'liquid-theming-guide'].includes(article.slug)) {
      assert.equal(Object.keys(visuals).length, 0, 'bespoke guides retain their own visual compositions')
      continue
    }
    assert.equal(Object.keys(visuals).length, 2, article.slug)
    const headings = article.body.filter(block => block.type === 'h2').map(block => block.id ?? resourceHeadingId(block.text))
    for (const [target, visual] of Object.entries(visuals)) {
      assert.ok(headings.includes(target), `${article.slug}: missing section ${target}`)
      assert.ok(statSync(resolve('apps/marketing/web/public', visual.src.slice(1))).size > 1000)
      assert.ok(visual.alt && visual.caption && visual.label)
    }
  }
})

test('visual topics resolve to unique existing article sections and source excerpts', () => {
  for (const article of ARTICLES) {
    const topics = getReadingTopics(article)
    const headings = article.body.filter(block => block.type === 'h2').map(block => block.text)
    assert.ok(topics.length >= 2 && topics.length <= 3, article.slug)
    assert.equal(new Set(topics.map(topic => topic.targetId)).size, topics.length, article.slug)
    for (const topic of topics) {
      assert.ok(headings.includes(topic.heading), `${article.slug}: ${topic.heading}`)
      assert.ok(topic.targetId.length > 0)
      assert.ok(topic.excerpt.length > 0)
    }
  }
})

test('payment comparison keeps UPI, COD and the combined strategy distinct', () => {
  const article = ARTICLES.find(article => article.slug === 'upi-vs-cod-india')!
  assert.deepEqual(getReadingTopics(article).map(topic => topic.targetId), [
    'upi-the-dominant-force', 'cod-the-trust-bridge', 'the-optimal-payment-mix-strategy',
  ])
})

test('AI guides have distinct high-resolution editorial art instead of a repeated scene', () => {
  const guides = ARTICLES.filter(article => article.category === 'ai-commerce')
  const artworks = guides.map(article => getArticleArtwork(article.slug)!)
  assert.equal(new Set(artworks.map(art => art.src)).size, guides.length)
  assert.ok(artworks.every(art => art.width >= 1536 && art.height >= 1024))
  assert.ok(artworks.every(art => !art.src.includes('capabilities/ai-scene')))
})

test('developer guide cards use distinct subject artwork, including API, webhooks and integrations', () => {
  const guides = ARTICLES.filter(article => article.category === 'developers')
  const artworks = guides.map(article => getArticleArtwork(article.slug)!)
  assert.equal(new Set(artworks.map(art => art.src)).size, guides.length)
  assert.equal(new Set(artworks.map(art => art.thumbnailSrc)).size, guides.length)
})

test('release illustrations and filter labels cover the entire published history', () => {
  for (const release of CHANGELOG) {
    const artwork = RELEASE_ARTWORK[release.version]
    assert.ok(artwork, release.version)
    assert.ok(RELEASE_LABELS[release.tag], release.tag)
    assert.ok(statSync(resolve('apps/marketing/web/public', artwork.src.slice(1))).size > 1000)
  }
})
