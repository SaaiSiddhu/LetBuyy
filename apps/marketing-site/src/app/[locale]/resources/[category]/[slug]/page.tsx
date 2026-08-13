import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LOCALES, getLocale } from '@/lib/i18n/locales'
import { buildAlternates } from '@/lib/i18n/routing'
import { getDictionary } from '@/lib/i18n'
import { getMarketingSiteUrl } from '@/lib/public-urls'
import UntranslatedNotice from '@/components/i18n/UntranslatedNotice'
import Link from '@/components/i18n/LocaleLink'
import ReadingProgress from '@/components/resources/ReadingProgress'
import TableOfContents from '@/components/resources/TableOfContents'
import ArticleDock from '@/components/resources/ArticleDock'
import ArticleBody from '@/components/resources/ArticleBody'
import ArticleSidebar from '@/components/resources/ArticleSidebar'
import CopyLinkButton from '@/components/resources/CopyLinkButton'
import BookmarkButton from '@/components/resources/BookmarkButton'
import SeriesNav from '@/components/resources/SeriesNav'
import PrevNextArticle from '@/components/resources/PrevNextArticle'
import RecommendedArticles from '@/components/resources/RecommendedArticles'
import PostArticleNewsletter from '@/components/resources/PostArticleNewsletter'
import ArticleCompletionBanner from '@/components/resources/ArticleCompletionBanner'
import { getCategory } from '@/lib/resources/categories'
import { getAuthor } from '@/lib/resources/authors'
import {
  getArticleBySlug,
  getRelatedArticles,
  getAuthorArticles,
  generateStaticArticleParams,
  formatDate,
  getPrevNextInCategory,
  getSeriesArticles,
  getArticlesByCategory,
} from '@/lib/resources/utils'
import type { ContentBlock } from '@/lib/resources/types'

export function generateStaticParams() {
  return generateStaticArticleParams()
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string; slug: string }>
}): Promise<Metadata> {
  const { locale: localeSegment, category, slug } = await params
  const article = getArticleBySlug(category, slug)
  if (!article) return {}
  const author = getAuthor(article.author)
  return {
    title: article.title,
    description: article.description,
    authors: [{ name: author.name }],
    alternates: (() => {
      const alt = buildAlternates(getMarketingSiteUrl(), `/resources/${category}/${slug}`, LOCALES)
      return { canonical: alt.canonicalOf(getLocale(localeSegment)), languages: alt.languages }
    })(),
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.description,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [author.name],
    },
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function extractHeadings(body: ContentBlock[]) {
  return body
    .filter((b): b is { type: 'h2' | 'h3'; text: string } => b.type === 'h2' || b.type === 'h3')
    .map(b => ({ id: slugify(b.text), text: b.text, level: (b.type === 'h2' ? 2 : 3) as 2 | 3 }))
}

function getDifficultyLabel(diff: string | null) {
  if (!diff) return null
  return diff.charAt(0).toUpperCase() + diff.slice(1)
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; category: string; slug: string }>
}) {
  const { locale: localeSegment, category, slug } = await params
  const article = getArticleBySlug(category, slug)
  if (!article) notFound()

  const locale = getLocale(localeSegment)
  const dict = getDictionary(locale)

  const cat = getCategory(category)!
  const author = getAuthor(article.author)
  const headings = extractHeadings(article.body)

  // Related + recommended
  const related = getRelatedArticles(article.relatedSlugs ?? [], article.slug)
  const relatedWithCats = related.map(r => ({ article: r, category: getCategory(r.category)! }))

  // Recommended = related first, fill with same-category articles
  const catArticles = getArticlesByCategory(category).filter(a => a.slug !== slug)
  const recommendedSlugs = new Set(related.map(a => a.slug))
  const extra = catArticles.filter(a => !recommendedSlugs.has(a.slug))
  const recommendedPool = [...related, ...extra].slice(0, 3)
  const recommended = recommendedPool.map(a => ({ article: a, category: getCategory(a.category)! }))

  // Prev/Next
  const { prev, next } = getPrevNextInCategory(category, slug)

  // Series
  const seriesArticles = article.seriesSlug ? getSeriesArticles(article.seriesSlug) : []

  // Author stats
  const authorArticles = getAuthorArticles(article.author)
  const authorArticleCount = authorArticles.length
  const authorTopics = Array.from(new Set(authorArticles.map(a => getCategory(a.category)?.label).filter(Boolean) as string[])).slice(0, 4)

  // Structured data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { '@type': 'Person', name: author.name, jobTitle: author.role },
    publisher: {
      '@type': 'Organization',
      name: 'LetBuyy',
      logo: { '@type': 'ImageObject', url: '/icons/letbuyy-logo-512.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `/resources/${category}/${slug}` },
  }

  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Resources', item: '/resources' },
      { '@type': 'ListItem', position: 2, name: cat.label, item: `/resources/${category}` },
      { '@type': 'ListItem', position: 3, name: article.title },
    ],
  }

  return (
    <>
      {/* One script per entity, each a top-level JSON-LD object. Consumers
          commonly read `parsed["@context"]` directly, which is undefined when
          several entities share one array-wrapped block. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbData).replace(/</g, '\\u003c'),
        }}
      />

      {/* GPU-accelerated progress bar */}
      <ReadingProgress />

      {/* ════ THREE-COLUMN ARTICLE SHELL ════ */}
      <div className="arc-container">
        <div className="arc-layout">

          {/* ── Left: sticky TOC (desktop) ── */}
          <div className="arc-left" aria-hidden="true">
            <TableOfContents
              headings={headings}
              readingTime={article.readingTime}
              updatedAt={article.updatedAt}
            />
          </div>

          {/* ── Center: article ── */}
          <main className="arc-center">

            {/* Article header */}
            <header className="arc-header">
              {/* Eyebrow: breadcrumb + category chip */}
              <div className="arc-eyebrow">
                <nav className="arc-breadcrumb" aria-label="Breadcrumb">
                  <Link href="/resources">Resources</Link>
                  <span className="arc-breadcrumb-sep" aria-hidden="true">›</span>
                  <Link href={`/resources/${category}`} style={{ color: cat.color }}>{cat.label}</Link>
                </nav>
                {/* No category chip here — the breadcrumb above already names it */}
                {article.featured && <span className="arc-flag">Featured</span>}
              </div>

              <h1 className="arc-title">{article.title}</h1>
              <p className="arc-lead">{article.subtitle}</p>

              {/* Byline: one compact block, plain text rather than pills */}
              <div className="arc-byline">
                <div className="arc-author-row">
                  <div className="arc-author-avatar-lg" aria-hidden="true">
                    {author.name.charAt(0)}
                  </div>
                  <div className="arc-byline-text">
                    <p className="arc-byline-primary">
                      {author.name}
                      <span className="arc-byline-sep" aria-hidden="true" />
                      <span className="arc-byline-role">{author.role}</span>
                    </p>
                    <p className="arc-byline-secondary">
                      <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
                      <span className="arc-byline-sep" aria-hidden="true" />
                      {article.readingTime} min read
                      {article.updatedAt !== article.publishedAt && (
                        <>
                          <span className="arc-byline-sep" aria-hidden="true" />
                          Updated {formatDate(article.updatedAt)}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="arc-actions-row">
                  <CopyLinkButton />
                  <BookmarkButton slug={slug} title={article.title} category={category} />
                </div>
              </div>

              {/* Tags — quiet text links, no chrome */}
              {article.tags.length > 0 && (
                <div className="arc-tags-row">
                  {article.tags.map(tag => (
                    <Link key={tag} href={`/resources/tag/${tag}`} className="arc-tag">
                      #{tag}
                    </Link>
                  ))}
                </div>
              )}
            </header>

            {/* Series navigation */}
            {seriesArticles.length > 0 && (
              <SeriesNav seriesArticles={seriesArticles} currentSlug={slug} />
            )}

            {/* Article body */}
            <UntranslatedNotice locale={locale} dict={dict} variant="article" />

            <ArticleBody body={article.body} />

            {/* Completion banner */}
            <ArticleCompletionBanner next={next} />

          </main>

          {/* ── Right: sticky sidebar (desktop) ── */}
          <div className="arc-right">
            <ArticleSidebar
              author={author}
              article={article}
              related={relatedWithCats}
              category={cat}
              authorArticleCount={authorArticleCount}
              authorTopics={authorTopics}
            />
          </div>
        </div>
      </div>

      {/* ════ POST-ARTICLE ZONE ════ */}
      <div className="arc-post-zone">
        <div className="arc-post-container">

          {/* Prev / Next */}
          <PrevNextArticle prev={prev} next={next} />

          {/* Recommended articles */}
          <RecommendedArticles articles={recommended} />

          {/* Newsletter */}
          <PostArticleNewsletter />

        </div>
      </div>

      {/* Floating reading dock — progress, contents, actions, next */}
      <ArticleDock
        headings={headings}
        next={next ? { slug: next.slug, title: next.title, category: next.category } : null}
      />
    </>
  )
}
