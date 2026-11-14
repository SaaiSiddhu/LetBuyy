import { localizeMetadata } from '@/lib/i18n/metadata'
import { localizeArticleSummary } from '@/lib/i18n/article-summary'
import { localizeCategory } from '@/lib/i18n/resource-metadata'
import { getLocale } from '@/lib/i18n/locales'
import { createCopy } from '@/lib/i18n/copy'

import Copy from '@/components/i18n/Copy'
import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowRight } from '@letbuyy/ui'
import Link from '@/components/i18n/LocaleLink'
import type { Article } from '@/lib/resources/types'
import { CATEGORIES, getCategory } from '@/lib/resources/categories'
import { categoryIconNode } from '@/lib/resources/category-icons'
import { getArticleArtwork } from '@/lib/resources/artwork'
import styles from './category-illustrated.module.css'
import {
  AUTHORS,
  getArticlesByCategory,
  generateStaticCategoryParams,
} from '@/lib/resources/utils'

export function generateStaticParams() {
  return generateStaticCategoryParams()
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; category: string }> }): Promise<Metadata> {
  const { category, locale: segment } = await params
  const locale = getLocale(segment)
  const sourceCategory = getCategory(category)
  const cat = sourceCategory && localizeCategory(sourceCategory, locale.language.code)
  if (!cat) return {}
  return localizeMetadata({
    title: cat.label,
    description: cat.description,

  }, segment, `/resources/${cat.slug}`)
}

/**
 * Each category reads differently, so each gets its own list rhythm rather
 * than the same card grid with the colour swapped:
 *   curriculum — ordered, foundational (Ecommerce)
 *   magazine   — one lead plus a ruled column (Growth)
 *   ledger     — reference rows, mono meta (Payments)
 *   pipeline   — numbered process stages (Operations)
 *   showcase   — bold two-up panels (AI Commerce)
 *   docs       — monospace index (Developers)
 */
const CATEGORY_VARIANT: Record<string, string> = {
  ecommerce: 'curriculum',
  growth: 'magazine',
  payments: 'ledger',
  operations: 'pipeline',
  'ai-commerce': 'showcase',
  developers: 'docs',
}

const VARIANT_HEADING: Record<string, string> = {
  curriculum: 'Read in order',
  magazine: 'Latest playbooks',
  ledger: 'Reference library',
  pipeline: 'The operations run',
  showcase: 'What you can build',
  docs: 'Index',
}

function authorName(slug: string) {
  return AUTHORS.find(a => a.slug === slug)?.name ?? 'LetBuyy Team'
}

function GuideArtwork({ slug, hero = false }: { slug: string; hero?: boolean }) {
  const art = getArticleArtwork(slug)
  if (!art) return null
  return <span className={hero ? styles.heroArt : styles.guideArt} aria-hidden="true"><Image src={hero ? art.src : art.thumbnailSrc} alt="" width={art.width} height={art.height} sizes={hero ? '(max-width: 760px) 90vw, 440px' : '(max-width: 600px) 100px, 180px'} loading="eager" unoptimized /></span>
}

function ArticleList({
  variant,
  articles,
}: {
  variant: string
  articles: Article[]
}) {
  const href = (a: Article) => `/resources/${a.category}/${a.slug}`

  if (variant === 'curriculum') {
    return (
      <ol className="cat-curriculum">
        {articles.map((a, i) => (
          <li key={a.slug}>
            <Link href={href(a)} className="cat-cur-item">
              <GuideArtwork slug={a.slug} />
              <span className="cat-cur-body">
                <span className={styles.guideIndex}><Copy text={"GUIDE"} />{' '}{String(i + 1).padStart(2, '0')}</span>
                <span className="cat-cur-title">{a.title}</span>
                <span className="cat-cur-sub">{a.subtitle}</span>
              </span>
              <span className="cat-cur-time">{a.readingTime}m</span>
            </Link>
          </li>
        ))}
      </ol>
    )
  }

  if (variant === 'magazine') {
    const [lead, ...others] = articles
    return (
      <div className="cat-magazine">
        {lead && (
          <Link href={href(lead)} className="cat-mag-lead">
            <GuideArtwork slug={lead.slug} />
            <span className="cat-mag-kicker"><Copy text={"Editor’s pick"} /></span>
            <span className="cat-mag-title">{lead.title}</span>
            <span className="cat-mag-sub">{lead.subtitle}</span>
            <span className="cat-mag-meta">{authorName(lead.author)} · {lead.readingTime} <Copy text={"min"} /></span>
          </Link>
        )}
        <ol className="cat-mag-list">
          {others.map(a => (
            <li key={a.slug}>
              <Link href={href(a)} className="cat-mag-item">
                <GuideArtwork slug={a.slug} />
                <span className="cat-mag-item-title">{a.title}</span>
                <span className="cat-mag-item-meta">{authorName(a.author)} · {a.readingTime} <Copy text={"min"} /></span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  if (variant === 'ledger') {
    return (
      <div className="cat-ledger">
        <div className="cat-ledger-head" aria-hidden="true">
          <span><Copy text={"Guide"} /></span>
          <span><Copy text={"Updated"} /></span>
          <span><Copy text={"Read"} /></span>
        </div>
        <ol className="cat-ledger-list">
          {articles.map(a => (
            <li key={a.slug}>
              <Link href={href(a)} className="cat-ledger-row">
                <span className="cat-ledger-title">
                  <GuideArtwork slug={a.slug} />
                  {a.title}
                  <span className="cat-ledger-sub">{a.subtitle}</span>
                </span>
                <time className="cat-ledger-level" dateTime={a.updatedAt}>
                  {new Date(a.updatedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </time>
                <span className="cat-ledger-time">{a.readingTime} <Copy text={"min"} /></span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  if (variant === 'pipeline') {
    return (
      <ol className="cat-pipeline">
        {articles.map((a, i) => (
          <li key={a.slug} className="cat-pipe-stage">
            <span className="cat-pipe-marker" aria-hidden="true">
              <span className="cat-pipe-dot" />
              {i < articles.length - 1 && <span className="cat-pipe-line" />}
            </span>
            <Link href={href(a)} className="cat-pipe-card">
              <GuideArtwork slug={a.slug} />
              <span className="cat-pipe-step"><Copy text={"Stage"} />{' '}{i + 1}</span>
              <span className="cat-pipe-title">{a.title}</span>
              <span className="cat-pipe-sub">{a.subtitle}</span>
              <span className="cat-pipe-time">{a.readingTime} <Copy text={"min read"} /></span>
            </Link>
          </li>
        ))}
      </ol>
    )
  }

  if (variant === 'showcase') {
    return (
      <div className={styles.aiGrid}>
        {articles.map((a, index) => {
          const art = getArticleArtwork(a.slug)
          return <Link key={a.slug} href={href(a)} className={styles.aiCard} data-ai-guide={a.slug}>
            <span className={styles.aiMedia} aria-hidden="true">
              {art && <Image src={art.src} alt="" width={art.width} height={art.height} sizes="(max-width: 760px) 90vw, 520px" loading="eager" unoptimized />}
            </span>
            <span className={styles.aiCopy}>
              <span className={styles.aiMeta}><span><Copy text={"GUIDE"} />{' '}{String(index + 1).padStart(2, '0')}</span><span>{a.readingTime} <Copy text={"min read"} /></span></span>
              <span className={styles.aiTitle}>{a.title}</span>
              <span className={styles.aiDescription}>{a.subtitle}</span>
              <span className={styles.aiRead}><Copy text={"Read the guide"} /><ArrowRight size={17} aria-hidden="true" /></span>
            </span>
          </Link>
        })}
      </div>
    )
  }

  // docs
  return (
    <ol className="cat-docs">
      {articles.map(a => (
        <li key={a.slug}>
          <Link href={href(a)} className="cat-docs-row">
            <GuideArtwork slug={a.slug} />
            <span className="cat-docs-title">{a.title}</span>
            <span className="cat-docs-meta">{a.readingTime} <Copy text={"min"} /></span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

export default async function CategoryPage({ params }: { params: Promise<{ locale: string; category: string }> }) {
  const { category, locale: segment } = await params
  const locale = getLocale(segment)
  const t = createCopy(locale.language.code)
  const sourceCategory = getCategory(category)
  const cat = sourceCategory && localizeCategory(sourceCategory, locale.language.code)
  if (!cat) notFound()

  const allArticles = getArticlesByCategory(category).map(a => localizeArticleSummary(a, locale.language.code))
  const catTags = Array.from(new Set(allArticles.flatMap(a => a.tags))).slice(0, 8)
  const otherCategories = CATEGORIES.filter(c => c.slug !== category).slice(0, 5).map(c => localizeCategory(c, locale.language.code))

  const variant = CATEGORY_VARIANT[cat.slug] ?? 'docs'

  return (
    <div className={`cat-page cat-v-${variant} ${styles.page}`} style={{ '--cat-accent': cat.color } as React.CSSProperties}>

      <section className="cat-hero">
        <div className="container">
          <nav className="cat-crumb" aria-label="Breadcrumb">
            <Link href="/resources"><Copy text={"Resources"} /></Link>
            <span aria-hidden="true">›</span>
            <span>{cat.label}</span>
          </nav>

          <div className={styles.heroLayout}>
          <div className="cat-hero-main">
            <span className="cat-hero-icon" aria-hidden="true">
              {categoryIconNode(cat.icon)}
            </span>
            <h1 className="cat-hero-title">{cat.label}</h1>
            <p className="cat-hero-desc">{cat.description}</p>
            <p className="cat-hero-count">
              {t('{count} guides', { count: allArticles.length })}
            </p>
          </div>
          {allArticles[0] && <GuideArtwork slug={allArticles[0].slug} hero />}
          </div>

          {catTags.length > 0 && (
            <div className="cat-hero-tags">
              {catTags.map(tag => (
                <Link key={tag} href={`/resources/tag/${tag}`} className="cat-hero-tag">#{tag}</Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="cat-body">
        <div className="container">
          <h2 className="cat-section-title">{t(VARIANT_HEADING[variant])}</h2>
          <ArticleList variant={variant} articles={allArticles} />
        </div>
      </section>

      <section className="cat-more">
        <div className="container">
          <h2 className="cat-section-title"><Copy text={"Other topics"} /></h2>
          <div className="cat-more-row">
            {otherCategories.map(c => (
              <Link
                key={c.slug}
                href={`/resources/${c.slug}`}
                className="cat-more-item"
                style={{ '--cat-accent': c.color } as React.CSSProperties}
              >
                <span className="cat-more-label">{c.label}</span>
                <span className="cat-more-count">{getArticlesByCategory(c.slug).length}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
