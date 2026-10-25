import assert from 'node:assert/strict'
import test from 'node:test'
import { getLocale } from '../../apps/marketing/web/src/lib/i18n/locales'
import { switchLocaleHref } from '../../apps/marketing/web/src/lib/i18n/routing'
import { getDictionary } from '../../apps/marketing/web/src/lib/i18n'

for (const segment of ['in', 'in-hi', 'in-ta']) {
    const locale = getLocale(segment)
    test(`${segment}: language switching retains ticket context and clause anchor`, () => {
        assert.equal(switchLocaleHref(locale, '/in/contact', '?ticket=LB-2608-000142&source=email', '#ticket-status'), `/${segment}/contact?ticket=LB-2608-000142&source=email#ticket-status`)
        assert.equal(switchLocaleHref(locale, '/in-ta/legal/refunds', '', '#timing'), `/${segment}/legal/refunds#timing`)
    })
    test(`${segment}: explicit locale query parameters follow the selected language`, () => {
        assert.equal(switchLocaleHref(locale, '/in/resources/search', '?country=in&lang=en&q=gst'), `/${segment}/resources/search?country=in&lang=${locale.language.code}&q=gst`)
    })
    test(`${segment}: shared footer destinations have nonempty translated labels`, () => {
        const dict = getDictionary(locale)
        for (const value of Object.values(dict.footer.links)) assert.ok(value.trim())
        assert.ok(dict.footer.links.themeGuide)
        assert.ok(dict.footer.links.appGuide)
        assert.ok(dict.footer.links.supportCentre)
    })
}
