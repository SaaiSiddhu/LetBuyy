import assert from 'node:assert/strict'
import test from 'node:test'
import { getLocale } from '../../apps/marketing/web/src/lib/i18n/locales'
import { localePath } from '../../apps/marketing/web/src/lib/i18n/routing'

for (const segment of ['in', 'in-hi', 'in-ta']) {
    const locale = getLocale(segment)
    test(`${segment}: preserves reader language, query and fragment in page links`, () => {
        assert.equal(localePath(locale, '/pricing'), `/${segment}/pricing`)
        assert.equal(localePath(locale, '/resources/search?q=gst#results'), `/${segment}/resources/search?q=gst#results`)
        assert.equal(localePath(locale, '/#capabilities'), `/${segment}#capabilities`)
        assert.equal(localePath(locale, `/${segment}/resources`), `/${segment}/resources`)
    })
    test(`${segment}: root metadata/assets remain unprefixed and resource feeds stay localized`, () => {
        for (const path of ['/robots.txt', '/sitemap.xml', '/assets/legal/privacy-choices.svg', '/api/founding-pricing']) {
            assert.equal(localePath(locale, path), path)
        }
        assert.equal(localePath(locale, `/${segment}/resources/rss.xml`), `/${segment}/resources/rss.xml`)
        assert.equal(localePath(locale, 'https://accounts.letbuyy.com/signup'), 'https://accounts.letbuyy.com/signup')
        assert.equal(localePath(locale, '#pricing'), '#pricing')
    })
}
