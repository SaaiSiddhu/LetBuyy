import { getLocale } from '@/lib/i18n/locales'
import { localePath } from '@/lib/i18n/routing'
import { localizeArticleContent } from '@/lib/i18n/article-content'
import { createCopy } from '@/lib/i18n/copy'
import { BRAND_ASSETS } from '@/lib/brand-assets'
import { ARTICLES } from '@/lib/resources/articles'
import { getAuthor } from '@/lib/resources/authors'
import { getCategory } from '@/lib/resources/categories'
import { getMarketingSiteUrl } from '@/lib/public-urls'

export const dynamic = 'force-static'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const locale = getLocale((await params).locale)
  const t = createCopy(locale.language.code)
  const resourceUrl = getMarketingSiteUrl(localePath(locale, '/resources'))
  const feedUrl = getMarketingSiteUrl(localePath(locale, '/resources/rss.xml'))
  const siteUrl = getMarketingSiteUrl()
  const sorted = [...ARTICLES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  const items = sorted
    .slice(0, 50)
    .map(source => {
      const { article } = localizeArticleContent(source, locale.language.code)
      const author = getAuthor(article.author)
      const cat = getCategory(article.category)
      const url = getMarketingSiteUrl(localePath(locale, `/resources/${article.category}/${article.slug}`))
      return `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="false">${escapeXml(`${siteUrl}/resources/${article.category}/${article.slug}`)}${locale.language.code === 'en' ? '' : `#${locale.language.code}`}</guid>
      <description>${escapeXml(article.description)}</description>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <dc:creator>${escapeXml(author.name)}</dc:creator>
      <category>${escapeXml(cat?.label ?? article.category)}</category>
      ${article.tags.map(t => `<category>${escapeXml(t)}</category>`).join('\n      ')}
    </item>`
    })
    .join('')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>LetBuyy ${escapeXml(t('Resources'))}</title>
    <link>${resourceUrl}</link>
    <description>${escapeXml(t('Practical guides for starting, running, and growing an online business in India. Explore store setup, payments, operations, and more.'))}</description>
    <language>${locale.hreflang}</language>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <image>
      <url>${siteUrl}${BRAND_ASSETS.raster}</url>
      <title>LetBuyy ${escapeXml(t('Resources'))}</title>
      <link>${resourceUrl}</link>
    </image>${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
