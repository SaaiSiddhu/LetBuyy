import { notFound } from 'next/navigation'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { localizeArticleSummary } from '@/lib/i18n/article-summary'
import { localizeCategory } from '@/lib/i18n/resource-metadata'
import { getLocale } from '@/lib/i18n/locales'
import { createCopy } from '@/lib/i18n/copy'

import Copy from '@/components/i18n/Copy'
import type { Metadata } from 'next'
import Link from '@/components/i18n/LocaleLink'
import Image from 'next/image'
import { getArticleArtwork, getEditorialScene } from '@/lib/resources/artwork'
import visualStyles from '@/components/resources/resource-list-visuals.module.css'
import ArticleCard from '@/components/resources/ArticleCard'
import { getCategory } from '@/lib/resources/categories'
import { getArticlesByTag, getAllTags, generateStaticTagParams } from '@/lib/resources/utils'

export const dynamicParams = false

export function generateStaticParams() {
  return generateStaticTagParams()
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tag: string }> }): Promise<Metadata> {
  const { tag, locale: segment } = await params
  if (!getAllTags().some(entry => entry.tag === tag)) notFound()
  const locale = getLocale(segment)
  const t = createCopy(locale.language.code)
  return localizeMetadata({
    title: `#${tag} — ${t('Resources')}`,
    description: t('All LetBuyy resource articles tagged with #{tag}.', { tag }),

  }, segment, `/resources/tag/${tag}`)
}

export default async function TagPage({ params }: { params: Promise<{ locale: string; tag: string }> }) {
  const { tag, locale: segment } = await params
  if (!getAllTags().some(entry => entry.tag === tag)) notFound()
  const locale = getLocale(segment)
  const t = createCopy(locale.language.code)
  const articles = getArticlesByTag(tag).map(a => localizeArticleSummary(a, locale.language.code))
  const topTags = getAllTags().slice(0, 20)

  return (
    <div className="container" style={{ paddingTop: 64, paddingBottom: 80 }}>
      {/* Header */}
      <div className={visualStyles.subpageHeader} style={{ marginBottom: 40 }}><div>
        <Link href="/resources" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 16 }}>
          ← {t('Resources')}
        </Link>
        <div className="res-hero-label" style={{ marginBottom: 12 }}><Copy text={"Tag"} /></div>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 750, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 8 }}>
          #{tag}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{articles.length} {t(articles.length === 1 ? 'article' : 'articles')}</p>
      </div><Image src={(getArticleArtwork(articles[0]?.slug ?? '') ?? getEditorialScene('learning')).src} alt="" width={1536} height={1024} sizes="(max-width: 640px) 80vw, 240px" loading="eager" unoptimized /></div>

      {/* Articles */}
      {articles.length > 0 ? (
        <div className="res-grid-3" style={{ marginBottom: 64 }}>
          {articles.map(article => {
            const cat = localizeCategory(getCategory(article.category)!, locale.language.code)
            return <ArticleCard key={article.slug} article={article} category={cat} />
          })}
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 64 }}><Copy text={"No articles found for this tag."} /></p>
      )}

      {/* Other tags */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 32 }}>
        <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 16 }}>
          <Copy text={"Browse tags"} /></p>
        <div className="rc-tags-cloud">
          {topTags.map(({ tag: t, count }) => (
            <Link key={t} href={`/resources/tag/${t}`} className={`rc-tag${t === tag ? ' active' : ''}`}>
              #{t} <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 2 }}>{count}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
