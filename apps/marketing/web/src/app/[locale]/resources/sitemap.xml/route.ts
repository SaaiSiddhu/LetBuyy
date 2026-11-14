import sitemap from '@/app/sitemap'
import { getLocale } from '@/lib/i18n/locales'
import { getMarketingSiteUrl } from '@/lib/public-urls'
import { localePath } from '@/lib/i18n/routing'

export const dynamic = 'force-static'

function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/** Compatibility feed: a view of the canonical sitemap, not another URL registry. */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const locale = getLocale((await params).locale)
  const prefix = getMarketingSiteUrl(localePath(locale, '/resources'))
  const entries = sitemap().filter(entry => entry.url === prefix || entry.url.startsWith(`${prefix}/`))
  const urls = entries.map(entry => `<url><loc>${xml(entry.url)}</loc>${entry.lastModified ? `<lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>` : ''}${Object.entries(entry.alternates?.languages ?? {}).map(([language, href]) => `<xhtml:link rel="alternate" hreflang="${xml(language)}" href="${xml(String(href))}"/>`).join('')}</url>`).join('')
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  })
}
