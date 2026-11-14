import assert from 'node:assert/strict'
import test from 'node:test'
import { ARTICLES } from '../../apps/marketing/web/src/lib/resources/articles'
import { localizeArticleContent } from '../../apps/marketing/web/src/lib/i18n/article-content'
import { resourceHeadingId } from '../../apps/marketing/web/src/lib/resources/headings'

const source = ARTICLES.find(article => article.slug === 'building-first-letbuyy-store')!
const anchors = ['1-create-your-account', '4-add-your-first-product', '3-select-a-theme', '5-configure-payments', '8-publish-and-test']
for (const language of ['en', 'hi', 'ta']) {
    test(`${language}: first-store steps follow reading order without breaking existing section links`, () => {
        const article = language === 'en' ? source : localizeArticleContent(source, language).article
        const headings = article.body.filter(block => block.type === 'h2')
        assert.deepEqual(headings.map(block => Number(block.text.match(/^(\d+)\./)?.[1])), [1, 2, 3, 4, 5])
        assert.deepEqual(headings.map(block => block.id ?? resourceHeadingId(block.text)), anchors)
    })
}
