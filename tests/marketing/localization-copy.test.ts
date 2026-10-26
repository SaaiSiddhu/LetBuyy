import assert from 'node:assert/strict'
import test from 'node:test'
import { COPY } from '../../apps/marketing/web/src/lib/i18n/copy-catalog'
import { translateCopy } from '../../apps/marketing/web/src/lib/i18n/copy'
import { ARTICLES } from '../../apps/marketing/web/src/lib/resources/articles'
import { localizeArticleContent } from '../../apps/marketing/web/src/lib/i18n/article-content'
import { localizeArticleSummary } from '../../apps/marketing/web/src/lib/i18n/article-summary'
import { CATEGORIES } from '../../apps/marketing/web/src/lib/resources/categories'
import { AUTHORS } from '../../apps/marketing/web/src/lib/resources/authors'
import { CHANGELOG } from '../../apps/marketing/web/src/lib/resources/changelog'
import { CONTACT_TOPICS, CONTACT_URGENCIES, CONTACT_RELATIONSHIPS, CONTACT_BUSINESS_TYPES, CONTACT_CURRENT_CHANNELS, CONTACT_ORDER_BANDS, CONTACT_GMV_BANDS, CONTACT_TIMELINES, CONTACT_TIME_WINDOWS, CONTACT_HEARD_ABOUT, INDIA_STATES } from '../../packages/shared-types/src/contact'

const variables = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()

test('every presentation message has two nonempty translations and preserves interpolation variables', () => {
    for (const [source, values] of Object.entries(COPY)) {
        assert.equal(values.length, 2, source)
        for (const translated of values) {
            assert.ok(translated.trim(), source)
            assert.deepEqual(variables(translated), variables(source), source)
        }
    }
})

test('all listing summaries agree with the full source-locked article translations', () => {
    for (const language of ['hi', 'ta']) for (const source of ARTICLES) {
        const full = localizeArticleContent(source, language).article
        const summary = localizeArticleSummary(source, language)
        for (const key of ['title', 'subtitle', 'description'] as const) assert.equal(summary[key], full[key], `${language}/${source.slug}/${key}`)
        assert.equal(summary.slug, source.slug)
        assert.equal(summary.category, source.category)
        assert.deepEqual(summary.tags, source.tags)
    }
})

test('category, author and release copy have complete presentation translations', () => {
    const messages = [
        ...CATEGORIES.flatMap(category => [category.label, category.description]),
        ...AUTHORS.flatMap(author => [author.role, author.bio]),
        ...CHANGELOG.flatMap(release => [release.title, ...release.items.map(item => item.text)]),
    ]
    for (const source of messages) assert.ok(COPY[source], source)
})

test('conditional contact options have translations without changing canonical submission values', () => {
    const messages = [
        ...CONTACT_TOPICS.flatMap(topic => [topic.label, topic.description, ...topic.subjects.map(subject => subject.label)]),
        ...CONTACT_URGENCIES.flatMap(level => [level.label, level.description]),
        ...CONTACT_RELATIONSHIPS.map(entry => entry.label), ...CONTACT_TIMELINES.map(entry => entry.label), ...CONTACT_TIME_WINDOWS.map(entry => entry.label),
        ...CONTACT_BUSINESS_TYPES, ...CONTACT_CURRENT_CHANNELS, ...CONTACT_ORDER_BANDS, ...CONTACT_GMV_BANDS, ...CONTACT_HEARD_ABOUT, ...INDIA_STATES,
    ]
    const names = new Set(['Instagram', 'WhatsApp', 'Shopify', 'WooCommerce', 'YouTube', 'X (Twitter)', 'LinkedIn'])
    for (const source of messages) assert.ok(COPY[source] || names.has(source), source)
    for (const language of ['hi', 'ta']) for (const topic of CONTACT_TOPICS) {
        const option = { value: topic.id, label: translateCopy(language, topic.label) }
        assert.equal(option.value, topic.id)
        assert.notEqual(option.label, topic.label)
    }
})

test('interpolation preserves runtime values and English remains the source language', () => {
    assert.equal(translateCopy('en', 'Page {page} of {count}', { page: 2, count: 8 }), 'Page 2 of 8')
    assert.equal(translateCopy('hi', 'Page {page} of {count}', { page: 2, count: 8 }), '8 में से पेज 2')
    assert.equal(translateCopy('ta', 'Page {page} of {count}', { page: 2, count: 8 }), '8இல் பக்கம் 2')
    assert.equal(translateCopy('hi', 'pay_MkT91xYz'), 'pay_MkT91xYz')
})
