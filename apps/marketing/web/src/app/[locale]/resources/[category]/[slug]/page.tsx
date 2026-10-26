import { createCopy } from '@/lib/i18n/copy'
import { localizeCategory, localizeAuthor } from '@/lib/i18n/resource-metadata'

import Copy from '@/components/i18n/Copy'
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
import ResourceArticleArtwork from '@/components/resources/ResourceArticleArtwork'
import ArticleVisualOverview from '@/components/resources/ArticleVisualOverview'
import { getArticleArtwork } from '@/lib/resources/artwork'
import { getReadingTopics } from '@/lib/resources/reading-visuals'
import { getSectionVisuals } from '@/lib/resources/section-visuals'
import LiquidGuide from '@/components/resources/LiquidGuide'
import liquidGuideStyles from '@/components/resources/liquid-guide.module.css'
import { ThemeGuideHero, ThemeGuideContent } from '@/components/resources/ThemeGuide'
import themeGuideStyles from '@/components/resources/theme-guide.module.css'
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
  getPrevNextInCategory,
  getSeriesArticles,
  getArticlesByCategory,
} from '@/lib/resources/utils'
import type { ContentBlock } from '@/lib/resources/types'
import { localizeArticleContent } from '@/lib/i18n/article-content'
import { resourceHeadingId } from '@/lib/resources/headings'

export function generateStaticParams() {
  return generateStaticArticleParams()
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string; slug: string }>
}): Promise<Metadata> {
  const { locale: localeSegment, category, slug } = await params
  const sourceArticle = getArticleBySlug(category, slug)
  if (!sourceArticle) return {}
  const { article } = localizeArticleContent(sourceArticle, getLocale(localeSegment).language.code)
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

function extractHeadings(body: ContentBlock[]) {
  return body
    .filter((b): b is Extract<ContentBlock, { type: 'h2' | 'h3' }> => b.type === 'h2' || b.type === 'h3')
    .map(b => ({ id: b.id ?? resourceHeadingId(b.text), text: b.text, level: (b.type === 'h2' ? 2 : 3) as 2 | 3 }))
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; category: string; slug: string }>
}) {
  const { locale: localeSegment, category, slug } = await params
  const sourceArticle = getArticleBySlug(category, slug)
  if (!sourceArticle) notFound()

  const locale = getLocale(localeSegment)
  const dict = getDictionary(locale)
  const t = createCopy(locale.language.code)
  const { article, translated } = localizeArticleContent(sourceArticle, locale.language.code)

  const cat = localizeCategory(getCategory(category)!, locale.language.code)
  const author = localizeAuthor(getAuthor(article.author), locale.language.code)
  const headings = extractHeadings(article.body)
  const isThemeGuide = category === 'platform' && slug === 'how-themes-work'
  const isLiquidGuide = category === 'developers' && slug === 'liquid-theming-guide'
  const artwork = getArticleArtwork(slug)
  const readingTopics = getReadingTopics(article)
  const ArticleContainer = isThemeGuide || isLiquidGuide ? 'article' : 'main'

  // Related + recommended
  const related = getRelatedArticles(article.relatedSlugs ?? [], article.slug).map(a => localizeArticleContent(a, locale.language.code).article)
  const relatedWithCats = related.map(r => ({ article: r, category: localizeCategory(getCategory(r.category)!, locale.language.code) }))

  // Recommended = related first, fill with same-category articles
  const catArticles = getArticlesByCategory(category).filter(a => a.slug !== slug).map(a => localizeArticleContent(a, locale.language.code).article)
  const recommendedSlugs = new Set(related.map(a => a.slug))
  const extra = catArticles.filter(a => !recommendedSlugs.has(a.slug))
  const recommendedPool = [...related, ...extra].slice(0, 3)
  const recommended = recommendedPool.map(a => ({ article: a, category: localizeCategory(getCategory(a.category)!, locale.language.code) }))

  // Prev/Next
  const adjacent = getPrevNextInCategory(category, slug)
  const prev = adjacent.prev ? localizeArticleContent(adjacent.prev, locale.language.code).article : null
  const next = adjacent.next ? localizeArticleContent(adjacent.next, locale.language.code).article : null

  // Series
  const seriesArticles = article.seriesSlug ? getSeriesArticles(article.seriesSlug).map(a => localizeArticleContent(a, locale.language.code).article) : []

  // Author stats
  const authorArticles = getAuthorArticles(article.author)
  const authorArticleCount = authorArticles.length
  const authorTopics = Array.from(new Set(authorArticles.map(a => t(getCategory(a.category)?.label ?? '')).filter(Boolean) as string[])).slice(0, 4)

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
      <div className={`arc-container${isThemeGuide ? ` ${themeGuideStyles.guide}` : isLiquidGuide ? ` ${liquidGuideStyles.guide}` : ''}`}>
        <div className="arc-layout">

          {/* ── Left: sticky TOC (desktop) ── */}
          <div className="arc-left">
            <TableOfContents
              headings={headings}
              readingTime={article.readingTime}
              updatedAt={article.updatedAt}
            />
          </div>

          {/* ── Center: article ── */}
          <ArticleContainer className="arc-center" lang={translated ? locale.language.bcp47 : 'en'}>

            {/* Article header */}
            <header className="arc-header">
              {/* Eyebrow: breadcrumb + category chip */}
              <div className="arc-eyebrow">
                <nav className="arc-breadcrumb" aria-label="Breadcrumb">
                  <Link href="/resources"><Copy text={"Resources"} /></Link>
                  <span className="arc-breadcrumb-sep" aria-hidden="true">›</span>
                  <Link href={`/resources/${category}`} style={{ color: cat.color }}>{cat.label}</Link>
                </nav>
                {/* No category chip here — the breadcrumb above already names it */}
                {article.featured && <span className="arc-flag"><Copy text={"Featured"} /></span>}
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
                      <time dateTime={article.publishedAt}>{new Date(article.publishedAt).toLocaleDateString(locale.hreflang, { day: 'numeric', month: 'short', year: 'numeric' })}</time>
                      <span className="arc-byline-sep" aria-hidden="true" />
                      {article.readingTime} <Copy text={"min read"} />{article.updatedAt !== article.publishedAt && (
                        <>
                          <span className="arc-byline-sep" aria-hidden="true" />
                          <Copy text={"Updated"} />{' '}{new Date(article.updatedAt).toLocaleDateString(locale.hreflang, { day: 'numeric', month: 'short', year: 'numeric' })}
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
              {isThemeGuide && <ThemeGuideHero />}
              {isLiquidGuide && <ResourceArticleArtwork slug={slug} />}
              {!isThemeGuide && !isLiquidGuide && artwork && <ArticleVisualOverview key={slug} artwork={artwork} topics={readingTopics} />}
            </header>

            {/* Series navigation */}
            {seriesArticles.length > 0 && (
              <SeriesNav seriesArticles={seriesArticles} currentSlug={slug} />
            )}

            {/* Article body */}
            {!translated && <UntranslatedNotice locale={locale} dict={dict} variant="article" />}

            {isThemeGuide ? <ThemeGuideContent body={article.body} /> : isLiquidGuide ? <LiquidGuide body={article.body} /> : <ArticleBody body={article.body} visuals={getSectionVisuals(sourceArticle)} />}

            {/* Completion banner */}
            <ArticleCompletionBanner next={next} />

          </ArticleContainer>

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
