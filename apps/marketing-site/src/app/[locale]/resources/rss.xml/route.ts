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

export async function GET() {
  const siteUrl = getMarketingSiteUrl()
  const sorted = [...ARTICLES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  const items = sorted
    .slice(0, 50)
    .map(article => {
      const author = getAuthor(article.author)
      const cat = getCategory(article.category)
      const url = `${siteUrl}/resources/${article.category}/${article.slug}`
      return `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(article.description)}</description>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <author>${escapeXml(author.name)}</author>
      <category>${escapeXml(cat?.label ?? article.category)}</category>
      ${article.tags.map(t => `<tag>${escapeXml(t)}</tag>`).join('\n      ')}
    </item>`
    })
    .join('')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>LetBuyy Resources</title>
    <link>${siteUrl}/resources</link>
    <description>Commerce guides, tutorials, and platform updates for Indian merchants on LetBuyy.</description>
    <language>en-in</language>
    <atom:link href="${siteUrl}/resources/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${siteUrl}/icons/letbuyy-logo-512.png</url>
      <title>LetBuyy Resources</title>
      <link>${siteUrl}/resources</link>
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
