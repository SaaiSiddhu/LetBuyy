import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Article } from '@/lib/resources/types'
import { CATEGORIES, getCategory } from '@/lib/resources/categories'
import { categoryIconNode } from '@/lib/resources/category-icons'
import {
  AUTHORS,
  getArticlesByCategory,
  generateStaticCategoryParams,
} from '@/lib/resources/utils'

export function generateStaticParams() {
  return generateStaticCategoryParams()
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params
  const cat = getCategory(category)
  if (!cat) return {}
  return {
    title: `${cat.label} — LetBuyy Resources`,
    description: cat.description,
    alternates: { canonical: `/resources/${cat.slug}` },
  }
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
              <span className="cat-cur-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <span className="cat-cur-body">
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
            <span className="cat-mag-kicker">Editor’s pick</span>
            <span className="cat-mag-title">{lead.title}</span>
            <span className="cat-mag-sub">{lead.subtitle}</span>
            <span className="cat-mag-meta">{authorName(lead.author)} · {lead.readingTime} min</span>
          </Link>
        )}
        <ol className="cat-mag-list">
          {others.map(a => (
            <li key={a.slug}>
              <Link href={href(a)} className="cat-mag-item">
                <span className="cat-mag-item-title">{a.title}</span>
                <span className="cat-mag-item-meta">{authorName(a.author)} · {a.readingTime} min</span>
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
          <span>Guide</span>
          <span>Updated</span>
          <span>Read</span>
        </div>
        <ol className="cat-ledger-list">
          {articles.map(a => (
            <li key={a.slug}>
              <Link href={href(a)} className="cat-ledger-row">
                <span className="cat-ledger-title">
                  {a.title}
                  <span className="cat-ledger-sub">{a.subtitle}</span>
                </span>
                <time className="cat-ledger-level" dateTime={a.updatedAt}>
                  {new Date(a.updatedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </time>
                <span className="cat-ledger-time">{a.readingTime} min</span>
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
              <span className="cat-pipe-step">Stage {i + 1}</span>
              <span className="cat-pipe-title">{a.title}</span>
              <span className="cat-pipe-sub">{a.subtitle}</span>
              <span className="cat-pipe-time">{a.readingTime} min read</span>
            </Link>
          </li>
        ))}
      </ol>
    )
  }

  if (variant === 'showcase') {
    return (
      <div className="cat-showcase">
        {articles.map(a => (
          <Link key={a.slug} href={href(a)} className="cat-show-card">
            <span className="cat-show-glow" aria-hidden="true" />
            <span className="cat-show-title">{a.title}</span>
            <span className="cat-show-sub">{a.subtitle}</span>
            <span className="cat-show-cta">
              Read
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    )
  }

  // docs
  return (
    <ol className="cat-docs">
      {articles.map((a, i) => (
        <li key={a.slug}>
          <Link href={href(a)} className="cat-docs-row">
            <span className="cat-docs-idx" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <span className="cat-docs-title">{a.title}</span>
            <span className="cat-docs-meta">{a.readingTime} min</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const cat = getCategory(category)
  if (!cat) notFound()

  const allArticles = getArticlesByCategory(category)
  const catTags = Array.from(new Set(allArticles.flatMap(a => a.tags))).slice(0, 8)
  const otherCategories = CATEGORIES.filter(c => c.slug !== category).slice(0, 5)

  const variant = CATEGORY_VARIANT[cat.slug] ?? 'docs'

  return (
    <div className={`cat-page cat-v-${variant}`} style={{ '--cat-accent': cat.color } as React.CSSProperties}>

      <section className="cat-hero">
        <div className="container">
          <nav className="cat-crumb" aria-label="Breadcrumb">
            <Link href="/resources">Resources</Link>
            <span aria-hidden="true">›</span>
            <span>{cat.label}</span>
          </nav>

          <div className="cat-hero-main">
            <span className="cat-hero-icon" aria-hidden="true">
              {categoryIconNode(cat.icon)}
            </span>
            <h1 className="cat-hero-title">{cat.label}</h1>
            <p className="cat-hero-desc">{cat.description}</p>
            <p className="cat-hero-count">
              {allArticles.length} guide{allArticles.length !== 1 ? 's' : ''}
            </p>
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
          <h2 className="cat-section-title">{VARIANT_HEADING[variant]}</h2>
          <ArticleList variant={variant} articles={allArticles} />
        </div>
      </section>

      <section className="cat-more">
        <div className="container">
          <h2 className="cat-section-title">Other topics</h2>
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
