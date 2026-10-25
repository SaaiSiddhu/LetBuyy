import assert from 'node:assert/strict'
import test from 'node:test'
import { ARTICLES } from '../../apps/marketing/web/src/lib/resources/articles'
import { articleSourceText, localizeArticleContent } from '../../apps/marketing/web/src/lib/i18n/article-content'
import { resourceHeadingId } from '../../apps/marketing/web/src/lib/resources/headings'

for (const source of ARTICLES) {
    for (const language of ['hi', 'ta']) {
        test(`${language}/${source.slug}: translated blocks preserve anchors, shape and source authority`, () => {
            const before = JSON.stringify(source)
            const result = localizeArticleContent(source, language)
            assert.equal(result.translated, true)
            assert.notEqual(result.article.title, source.title)
            assert.equal(articleSourceText(result.article).length, articleSourceText(source).length)
            assert.deepEqual(result.article.tags, source.tags)
            assert.equal(result.article.body.length, source.body.length)
            source.body.forEach((block, index) => {
                const localized = result.article.body[index]
                assert.equal(localized.type, block.type)
                if ((block.type === 'h2' || block.type === 'h3') && (localized.type === 'h2' || localized.type === 'h3')) assert.equal(localized.id, block.id ?? resourceHeadingId(block.text))
                if (block.type === 'code' && block.lang !== 'text') assert.deepEqual(localized, block)
                if (block.type === 'table' && localized.type === 'table') assert.deepEqual(localized.rows.map(row => row.length), block.rows.map(row => row.length))
            })
            assert.equal(JSON.stringify(source), before)
        })
    }
}

test('a revised source paragraph cannot silently receive an outdated article translation', () => {
    const source = structuredClone(ARTICLES.find(article => article.slug === 'upi-vs-cod-india')!)
    source.subtitle += ' Revised.'
    assert.throws(() => localizeArticleContent(source, 'hi'), /Outdated or incomplete/)
})
