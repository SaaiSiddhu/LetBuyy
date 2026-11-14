import assert from 'node:assert/strict'
import test from 'node:test'
import { AUTHORS, RETIRED_AUTHOR_SLUGS, getAuthor } from '../../apps/marketing/web/src/lib/resources/authors'
import { ARTICLES } from '../../apps/marketing/web/src/lib/resources/articles'
import { CHANGELOG } from '../../apps/marketing/web/src/lib/resources/changelog'
import { articleSourceText, localizeArticleContent } from '../../apps/marketing/web/src/lib/i18n/article-content'
import { getMarketingSiteUrl, getAccountsUrl } from '../../apps/marketing/web/src/lib/public-urls'
import { getLocale } from '../../apps/marketing/web/src/lib/i18n/locales'
import { localePath } from '../../apps/marketing/web/src/lib/i18n/routing'

test('published attribution resolves to the publisher, without unsupported person credentials', () => {
    assert.equal(AUTHORS.length, 1)
    assert.equal(AUTHORS[0].name, 'LetBuyy')
    assert.equal(RETIRED_AUTHOR_SLUGS.length, 4)
    for (const article of ARTICLES) {
        assert.equal(article.author, 'letbuyy-team')
        assert.equal(getAuthor(article.author), AUTHORS[0])
    }
    assert.doesNotMatch(JSON.stringify(AUTHORS), /Priya|Arjun|Neha|Ravi|GST consultant|200 Indian|Meesho|Nykaa|best commerce/)
})

test('contextual links resolve to real articles and preserve each language', () => {
    for (const source of ARTICLES) for (const language of ['en', 'hi', 'ta']) {
        const article = language === 'en' ? source : localizeArticleContent(source, language).article
        const links = article.body.flatMap(block => block.type === 'p' ? block.references ?? [] : []).filter(link => link.href.startsWith('/'))
        assert.ok(links.length >= 1, source.slug)
        for (const link of links) {
            const target = ARTICLES.find(candidate => `/resources/${candidate.category}/${candidate.slug}` === link.href)
            assert.ok(target, `${source.slug}: ${link.href}`)
            assert.notEqual(target.slug, source.slug)
            const title = language === 'en' ? target.title : localizeArticleContent(target, language).article.title
            assert.equal(link.label, title)
            const locale = getLocale(language === 'en' ? 'in' : `in-${language}`)
            assert.ok(localePath(locale, link.href).startsWith(`/${locale.segment}/resources/`))
        }
    }
})

test('changing a link label invalidates its source-locked translation instead of mixing languages', () => {
    const source = structuredClone(ARTICLES[0])
    const block = source.body.find(block => block.type === 'p' && block.references?.length)
    assert.ok(block?.type === 'p' && block.references)
    block.references[0].label += ' changed'
    assert.throws(() => localizeArticleContent(source, 'hi'), /Outdated or incomplete/)
})

test('removed expert and unsupported marketplace/AI promises stay out of article copy', () => {
    for (const article of ARTICLES) {
        assert.doesNotMatch(articleSourceText(article).join(' '), /40\+ India-ready|trained on India-specific|Switch to AI mode once you have|review time: 5–10|forecast demand, detect fraudulent|unlimited warehouse|Every LetBuyy theme is a Liquid theme|all Indian payment methods/)
    }
    assert.match(ARTICLES.find(a => a.slug === 'introduction-to-apps')!.body.map(b => 'text' in b ? b.text : '').join(' '), /deferred/)
    assert.equal(CHANGELOG.length, 0, 'no unverified publication history should be advertised')
})

function withOriginEnvironment(run: () => void) {
    const names = ['NEXT_PUBLIC_MARKETING_URL', 'NEXT_PUBLIC_ACCOUNTS_URL', 'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'NODE_ENV']
    const env: Record<string, string | undefined> = process.env
    const saved = Object.fromEntries(names.map(name => [name, env[name]]))
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    try { for (const name of names) delete env[name]; run() }
    finally {
        for (const name of names) { if (saved[name] === undefined) delete env[name]; else env[name] = saved[name] }
        if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow)
        else Reflect.deleteProperty(globalThis, 'window')
    }
}

test('missing canonical configuration cannot inherit a preview or browser request host', () => withOriginEnvironment(() => {
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_URL = 'unapproved-preview.example.invalid'
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'unapproved-project.example.invalid'
    const server = getMarketingSiteUrl('/in/pricing')
    for (const origin of ['http://localhost:9006', 'https://unapproved-preview.example.invalid', 'https://www.letbuyy.com']) {
        Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: new URL(origin) } })
        assert.equal(getMarketingSiteUrl('/in/pricing'), server)
    }
    assert.equal(server, 'https://www.letbuyy.com/in/pricing')
}))

test('explicit canonical origins normalize consistently and malformed or credentialed values fail closed', () => withOriginEnvironment(() => {
    process.env.NEXT_PUBLIC_MARKETING_URL = 'http://127.0.0.1:9038/'
    assert.equal(getMarketingSiteUrl('/in'), 'http://127.0.0.1:9038/in')
    for (const origin of ['https://user@example.invalid', 'https://', 'file:///tmp/site']) {
        process.env.NEXT_PUBLIC_MARKETING_URL = origin
        assert.throws(() => getMarketingSiteUrl(), /NEXT_PUBLIC_MARKETING_URL/)
    }
}))

test('development account fallback points to the identity runtime before and after hydration', () => withOriginEnvironment(() => {
    const env: Record<string, string | undefined> = process.env
    env.NODE_ENV = 'development'
    const server = getAccountsUrl('/signup')
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: new URL('http://localhost:9006') } })
    assert.equal(getAccountsUrl('/signup'), server)
    assert.equal(new URL(server).port, '9002')
}))
