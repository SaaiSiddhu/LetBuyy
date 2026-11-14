import assert from 'node:assert/strict'
import test from 'node:test'
import { ARTICLES } from '../../apps/marketing/web/src/lib/resources/articles'
import { articleSourceText, localizeArticleContent } from '../../apps/marketing/web/src/lib/i18n/article-content'
import { resourceHeadingId } from '../../apps/marketing/web/src/lib/resources/headings'

const source = ARTICLES.find(article => article.slug === 'how-to-start-an-online-store-india')!
const existingStepTwoAnchor = 'validate-demand-in-the-locations-you-can-serve-interview-potential-customers-and-compare-alternatives-neither-a-city-tier-nor-a-category-label-establishes-demand-or-a-predictable-growth-window'

for (const language of ['en', 'hi', 'ta']) {
    test(`${language}: online-store planning steps include registration and retain the existing deep link`, () => {
        const article = language === 'en' ? source : localizeArticleContent(source, language).article
        const headings = article.body.filter(block => block.type === 'h2')
        assert.deepEqual(headings.map(block => Number(block.text.match(/\d+/u)?.[0])), [1, 2, 3, 4, 5, 6, 7])
        assert.equal(headings[1].id ?? resourceHeadingId(headings[1].text), existingStepTwoAnchor)
    })
}

test('guides do not restore the unsupported category, discount-conversion or fulfilment rankings', () => {
    for (const article of ARTICLES) {
        assert.doesNotMatch(articleSourceText(article).join('\n'), /best-performing Indian (?:D2C stores|brands)|converts significantly better/u, article.slug)
    }
})
