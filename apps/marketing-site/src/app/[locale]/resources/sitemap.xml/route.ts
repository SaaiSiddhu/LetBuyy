import { ARTICLES } from '@/lib/resources/articles'
import { CATEGORIES } from '@/lib/resources/categories'
import { getAllTags } from '@/lib/resources/utils'
import { getMarketingSiteUrl } from '@/lib/public-urls'

export const dynamic = 'force-static'

export async function GET() {
  const siteUrl = getMarketingSiteUrl()
  const now = new Date().toISOString().split('T')[0]

  const staticUrls = [
    { url: `${siteUrl}/resources`, priority: '1.0', changefreq: 'daily' },
    { url: `${siteUrl}/resources/changelog`, priority: '0.8', changefreq: 'weekly' },
    { url: `${siteUrl}/resources/search`, priority: '0.6', changefreq: 'weekly' },
    ...CATEGORIES.map(cat => ({
      url: `${siteUrl}/resources/${cat.slug}`,
      priority: '0.8',
      changefreq: 'weekly',
    })),
    ...getAllTags().map(({ tag }) => ({
      url: `${siteUrl}/resources/tag/${tag}`,
      priority: '0.5',
      changefreq: 'weekly',
    })),
    ...ARTICLES.map(a => ({
      url: `${siteUrl}/resources/${a.category}/${a.slug}`,
      lastmod: a.updatedAt,
      priority: a.featured ? '0.9' : '0.7',
      changefreq: 'monthly',
    })),
  ]

  const urls = staticUrls
    .map(entry => {
      const lm = (entry as { lastmod?: string }).lastmod ?? now
      return `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${lm}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
