import assert from 'node:assert/strict'
import test from 'node:test'
import sitemap from '../../apps/marketing/web/src/app/sitemap'
import { ARTICLES } from '../../apps/marketing/web/src/lib/resources/articles'

test('XML advertises indexable landing pages and every guide, excluding the HTML utility directory', () => {
    const paths = new Set(sitemap().map(entry => new URL(entry.url).pathname))
    for (const locale of ['in', 'in-hi', 'in-ta']) {
        assert.equal(paths.has(`/${locale}/sitemap`), false)
        for (const suffix of ['', '/pricing', '/resources']) assert.ok(paths.has(`/${locale}${suffix}`))
        for (const article of ARTICLES) assert.ok(paths.has(`/${locale}/resources/${article.category}/${article.slug}`), article.slug)
    }
})
