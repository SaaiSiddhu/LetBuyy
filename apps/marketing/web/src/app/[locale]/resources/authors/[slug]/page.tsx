import { localizeMetadata } from '@/lib/i18n/metadata'
import { localizeArticleSummary } from '@/lib/i18n/article-summary'
import { localizeCategory, localizeAuthor } from '@/lib/i18n/resource-metadata'
import { getLocale } from '@/lib/i18n/locales'
import { createCopy } from '@/lib/i18n/copy'

import Copy from '@/components/i18n/Copy'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import Link from '@/components/i18n/LocaleLink'
import Image from 'next/image'
import { getEditorialScene } from '@/lib/resources/artwork'
import visualStyles from '@/components/resources/resource-list-visuals.module.css'
import ArticleCard from '@/components/resources/ArticleCard'
import { AUTHORS, RETIRED_AUTHOR_SLUGS } from '@/lib/resources/authors'
import { localePath } from '@/lib/i18n/routing'
import { getAuthorArticles } from '@/lib/resources/utils'
import { getCategory } from '@/lib/resources/categories'

export function generateStaticParams() {
  return AUTHORS.map(a => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { slug, locale: segment } = await params
  const locale = getLocale(segment)
  const sourceAuthor = AUTHORS.find(a => a.slug === slug)
  const author = sourceAuthor && localizeAuthor(sourceAuthor, locale.language.code)
  if (!author) return {}
  return localizeMetadata({
    title: author.name,
    description: author.bio,

  }, segment, `/resources/authors/${slug}`)
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { slug, locale: segment } = await params
  const locale = getLocale(segment)
  const t = createCopy(locale.language.code)
  if (RETIRED_AUTHOR_SLUGS.some(retired => retired === slug)) permanentRedirect(localePath(locale, '/resources/authors/letbuyy-team'))
  const sourceAuthor = AUTHORS.find(a => a.slug === slug)
  const author = sourceAuthor && localizeAuthor(sourceAuthor, locale.language.code)
  if (!author) notFound()

  const articles = getAuthorArticles(slug).map(a => localizeArticleSummary(a, locale.language.code))
  const articlesWithCats = articles.map(a => ({ article: a, category: localizeCategory(getCategory(a.category)!, locale.language.code) }))

  return (
    <div className="res-author-page">
      <div className="container" style={{ maxWidth: 900 }}>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
          <Link href="/resources" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}><Copy text={"Resources"} /></Link>
          <span>›</span>
          <span style={{ color: 'var(--text-primary)' }}><Copy text={"Authors"} /></span>
          <span>›</span>
          <span style={{ color: 'var(--text-primary)' }}>{author.name}</span>
        </nav>

        {/* Author hero */}
        <div className={visualStyles.subpageHeader}><div className="res-author-hero">
          <div className="res-author-hero-avatar">
            {author.name.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="res-author-hero-name">{author.name}</h1>
            <p className="res-author-hero-role">{author.role}</p>
            <p className="res-author-hero-bio">{author.bio}</p>
            <div className="res-author-hero-links">
              {author.twitter && (
                <a href={author.twitter} target="_blank" rel="noopener noreferrer" className="rc-author-social">
                  X / Twitter
                </a>
              )}
              {author.linkedin && (
                <a href={author.linkedin} target="_blank" rel="noopener noreferrer" className="rc-author-social">
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </div><Image src={getEditorialScene('learning').src} alt="" width={1536} height={1024} sizes="(max-width: 640px) 80vw, 240px" loading="eager" unoptimized /></div>

        {/* Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <p style={{ fontSize: 28, fontWeight: 750, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{articles.length}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}><Copy text={"Articles published"} /></p>
          </div>
        </div>

        {/* Articles grid */}
        <div className="res-section-header" style={{ marginBottom: 24 }}>
          <h2 className="res-section-title">{t('Articles by {name}', { name: author.name })}</h2>
        </div>
        <div className="res-grid-3">
          {articlesWithCats.map(({ article, category }) => (
            <ArticleCard key={article.slug} article={article} category={category} />
          ))}
        </div>

        {articles.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 15 }}><Copy text={"No articles published yet."} /></p>
          </div>
        )}
      </div>
    </div>
  )
}
