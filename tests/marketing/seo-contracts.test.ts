import assert from 'node:assert/strict'
import test from 'node:test'
import { localizeMetadata } from '../../apps/marketing/web/src/lib/i18n/metadata'
import { ARTICLES } from '../../apps/marketing/web/src/lib/resources/articles'
import { articleSourceText, localizeArticleContent } from '../../apps/marketing/web/src/lib/i18n/article-content'
import { getPlatformSitemapUrls } from '../../apps/marketing/web/src/lib/platform-links'

for (const segment of ['in', 'in-hi', 'in-ta']) {
    test(`${segment}: independent page identities survive metadata inheritance`, () => {
        const metadata = localizeMetadata({ title: 'Payments', description: 'Payment guide' }, segment, '/resources/payments')
        const canonical = String(metadata.alternates?.canonical)
        assert.ok(canonical.endsWith(`/${segment}/resources/payments`))
        assert.equal(metadata.openGraph?.url, canonical)
        assert.equal(metadata.openGraph?.locale, segment === 'in' ? 'en_IN' : segment === 'in-hi' ? 'hi_IN' : 'ta_IN')
        assert.deepEqual(metadata.title, { absolute: segment === 'in' ? 'Payments | LetBuyy' : segment === 'in-hi' ? 'भुगतान | LetBuyy' : 'பணப்பரிவர்த்தனை | LetBuyy' })
        assert.ok(metadata.openGraph?.images)
        const fullTitle = localizeMetadata({ title: 'LetBuyy Pricing' }, segment, '/pricing').title
        assert.equal((JSON.stringify(fullTitle).match(/LetBuyy/g) ?? []).length, 1)
    })
}

test('robots feed declarations belong to this active marketing property', () => {
    const urls = getPlatformSitemapUrls()
    assert.equal(urls.length, 1)
    assert.ok(urls[0].endsWith('/sitemap.xml'))
    assert.doesNotMatch(urls[0], /\b(themes|apps|developer)\./)
})

test('the review article no longer promises an unverified conversion uplift in any locale', () => {
    const source = ARTICLES.find(article => article.slug === 'how-product-reviews-increase-conversion')!
    for (const language of ['en', 'hi', 'ta']) {
        const article = language === 'en' ? source : localizeArticleContent(source, language).article
        const text = articleSourceText(article).join(' ')
        assert.doesNotMatch(text, /270%|4\.6%|1\.7%/)
    }
})

test('the tax guide removes blanket thresholds and rate tables and includes traceable sources', () => {
    const article = ARTICLES.find(article => article.slug === 'gst-for-ecommerce-india')!
    assert.equal(article.body.some(block => block.type === 'table'), false)
    assert.doesNotMatch(articleSourceText(article).join(' '), /Mandatory regardless of turnover|Apparel above ₹1,000|at 1% of your taxable sales/)
    const links = article.body.flatMap(block => block.type === 'p' ? block.references ?? [] : [])
    assert.ok(links.some(link => link.href.includes('gst-ct-34-2023.pdf')))
    assert.ok(links.some(link => link.href.includes('PRID=2087659')))
})
