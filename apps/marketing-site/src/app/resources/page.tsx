import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BarChart3,
  Code2,
  IndianRupee,
  Package,
  Rocket,
  ShoppingBag,
  Sparkles,
  type LucideIcon,
} from '@letbuyy/ui'
import NewsletterInline from '@/components/resources/NewsletterInline'
import { getCategory } from '@/lib/resources/categories'
import {
  CATEGORIES,
  ARTICLES,
  LEARNING_PATHS,
  AUTHORS,
  getFeaturedArticles,
  getLatestArticles,
  getTrendingArticles,
  getArticlesByCategory,
} from '@/lib/resources/utils'

export const metadata: Metadata = {
  title: 'Resources — Commerce guides for Indian merchants',
  description: 'Guides, playbooks, tutorials, and platform updates for 35,000+ Indian ecommerce merchants and developers.',
  alternates: { canonical: '/resources' },
}

const LEVEL_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }
const LEVEL_CLASS = { beginner: 'res-path-level-beginner', intermediate: 'res-path-level-intermediate', advanced: 'res-path-level-advanced' }

/* Each category already declares its own icon — map the name to the component
   so the hubs stop rendering one identical glyph for everything. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  ShoppingBag,
  // @letbuyy/ui does not re-export TrendingUp; BarChart3 is the nearest
  // exported equivalent for the Growth category.
  TrendingUp: BarChart3,
  IndianRupee,
  Package,
  Sparkles,
  Code2,
  Rocket,
}

// Category hub order — show these 4 prominently, rest as compact
const HUB_CATEGORIES = ['ecommerce', 'payments', 'growth', 'operations']

export default function ResourcesPage() {
  const featured = getFeaturedArticles(1)[0]
  const featuredCat = featured ? getCategory(featured.category) : null
  const trending = getTrendingArticles(3)
  const latest = getLatestArticles(6)

  return (
    <>
      {/* ── HERO V3 ────────────────────────────────────────────────────── */}
      <section className="res-v3-hero">
        <div className="res-hero-aurora" aria-hidden="true" />
        <div className="container res-hero-inner">

          <div className="res-v3-hero-eyebrow">
            <span className="res-v3-hero-dot" aria-hidden="true" />
            Merchant Education Platform
          </div>

          <h1 className="res-v3-hero-heading">
            Everything you need to{' '}
            <span className="res-v3-hero-accent">build and scale</span>{' '}
            your Indian store.
          </h1>

          <p className="res-v3-hero-sub">
            Guides, playbooks, and tutorials built for Indian merchants — covering GST, UPI, COD,
            D2C growth, and commerce automation.
          </p>

          {/* Full-width search — the primary entry point to the library */}
          <Link href="/resources/search" className="res-hero-search" aria-label="Search resources">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <span className="res-hero-search-placeholder">Search guides, topics, categories…</span>
            <kbd className="res-v3-hero-kbd">⌘K</kbd>
          </Link>

          <div className="res-hero-tags">
            <span className="res-v3-trending-label">Popular</span>
            {['upi', 'gst', 'cod', 'd2c', 'inventory', 'shopify'].map(tag => (
              <Link key={tag} href={`/resources/tag/${tag}`} className="rc-tag">#{tag}</Link>
            ))}
          </div>

        </div>
      </section>

      {/* ── FEATURED GUIDE ─────────────────────────────────────────────── */}
      {featured && featuredCat && (
        <section className="res-featured-band">
          <div className="container">
            <div className="res-section-header">
              <div>
                <h2 className="res-section-title">Featured guide</h2>
                <p className="res-section-sub">Start here if you are new to selling online</p>
              </div>
            </div>
            <Link
              href={`/resources/${featured.category}/${featured.slug}`}
              className="res-featured-card"
              style={{ '--feat-accent': featuredCat.color } as React.CSSProperties}
            >
              <span className="res-featured-glow" aria-hidden="true" />

              <div className="res-featured-main">
                <div className="res-featured-kicker">
                  <span className="res-featured-tag">{featuredCat.label}</span>
                  <span className="res-featured-sep" aria-hidden="true" />
                  <span className="res-featured-time">{featured.readingTime} min read</span>
                </div>

                <h3 className="res-featured-title">{featured.title}</h3>
                <p className="res-featured-sub">{featured.subtitle}</p>

                <div className="res-featured-byline">
                  <span className="res-featured-avatar" aria-hidden="true">
                    {AUTHORS.find(a => a.slug === featured.author)?.name.charAt(0) ?? 'L'}
                  </span>
                  <span className="res-featured-author">
                    {AUTHORS.find(a => a.slug === featured.author)?.name}
                  </span>
                </div>
              </div>

              <span className="res-featured-cta">
                Read guide
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          </div>
        </section>
      )}

      {/* ── LEARNING PATHS CAROUSEL ────────────────────────────────────── */}
      <section className="res-v3-section" id="learning-paths">
        <div className="container">
          <div className="res-section-header">
            <div>
              <h2 className="res-section-title">Learning paths</h2>
              <p className="res-section-sub">Structured journeys from zero to expert</p>
            </div>
          </div>
        </div>
        <div className="res-v3-paths-scroll-wrap">
          <div className="container">
            <div className="res-v3-paths-grid">
              {LEARNING_PATHS.map(path => {
                const articlesInPath = ARTICLES.filter(a => path.articleSlugs.includes(a.slug))
                const totalMinutes = articlesInPath.reduce((sum, a) => sum + a.readingTime, 0)
                return (
                  <article
                    key={path.slug}
                    className="res-path-card"
                    style={{ '--path-accent': path.color } as React.CSSProperties}
                  >
                    <span className="res-path-glow" aria-hidden="true" />

                    <div className="res-path-top">
                      <span className={`res-path-level ${LEVEL_CLASS[path.level]}`}>
                        {LEVEL_LABELS[path.level]}
                      </span>
                      <span className="res-path-count">{articlesInPath.length} steps</span>
                    </div>

                    <h3 className="res-path-title">{path.title}</h3>
                    <p className="res-path-desc">{path.description}</p>

                    {/* The steps are drawn as a connected route — the card shows
                        the journey rather than just listing its articles. */}
                    <ol className="res-path-track">
                      {articlesInPath.slice(0, 4).map((a, i) => (
                        <li key={a.slug} className="res-path-step">
                          <span className="res-path-node" aria-hidden="true">{i + 1}</span>
                          <Link href={`/resources/${a.category}/${a.slug}`} className="res-path-step-link">
                            <span className="res-path-step-title">{a.title}</span>
                            <span className="res-path-step-time">{a.readingTime}m</span>
                          </Link>
                        </li>
                      ))}
                      {articlesInPath.length > 4 && (
                        <li className="res-path-step is-rest">
                          <span className="res-path-node is-rest" aria-hidden="true">
                            +{articlesInPath.length - 4}
                          </span>
                          <span className="res-path-rest-text">
                            {articlesInPath.length - 4} more in this path
                          </span>
                        </li>
                      )}
                    </ol>

                    <div className="res-path-foot">
                      <span className="res-path-total">~{totalMinutes} min total</span>
                      {articlesInPath[0] && (
                        <Link
                          href={`/resources/${articlesInPath[0].category}/${articlesInPath[0].slug}`}
                          className="res-path-cta"
                        >
                          Start path
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── TRENDING ──────────────────────────────────────────────────── */}
      {trending.length > 0 && (
        <section className="res-v3-section res-v3-section-muted">
          <div className="container">
            <div className="res-section-header">
              <div>
                <h2 className="res-section-title">Trending now</h2>
                <p className="res-section-sub">Most read by Indian merchants this week</p>
              </div>
            </div>
            <div className="res-v3-trending-grid">
              {trending.map((article, i) => {
                const cat = getCategory(article.category)!
                return (
                  <Link key={article.slug} href={`/resources/${article.category}/${article.slug}`} className="res-v3-trending-item">
                    <span className="res-v3-trending-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                    <div className="res-v3-trending-body">
                      <div className="res-v3-trending-meta">
                        <span style={{ color: cat.color, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{cat.label}</span>
                        <span className="rc-card-meta-dot" aria-hidden="true" />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{article.readingTime} min read</span>
                      </div>
                      <p className="res-v3-trending-title">{article.title}</p>
                    </div>
                    <svg className="res-v3-trending-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── CATEGORY HUBS ────────────────────────────────────────────── */}
      <section className="res-v3-section">
        <div className="container">
          <div className="res-section-header">
            <div>
              <h2 className="res-section-title">Browse by topic</h2>
              <p className="res-section-sub">Deep-dive into what matters most to your business</p>
            </div>
          </div>
          <div className="res-v3-hubs-grid">
            {HUB_CATEGORIES.map(catSlug => {
              const cat = CATEGORIES.find(c => c.slug === catSlug)!
              const articles = getArticlesByCategory(catSlug).slice(0, 3)
              return (
                <article
                  key={catSlug}
                  className="res-hub"
                  style={{ '--hub-accent': cat.color } as React.CSSProperties}
                >
                  {/* Left rail carries the identity, right column is the index —
                      a directory entry, not a sequence. */}
                  <div className="res-hub-rail">
                    <span className="res-hub-icon" aria-hidden="true">
                      {(() => {
                        const Icon = CATEGORY_ICONS[cat.icon] ?? ShoppingBag
                        return <Icon width={20} height={20} strokeWidth={1.75} />
                      })()}
                    </span>
                    <h3 className="res-hub-title">{cat.label}</h3>
                    <p className="res-hub-count">
                      {getArticlesByCategory(catSlug).length} guides
                    </p>
                    <p className="res-hub-desc">{cat.description}</p>
                    <Link href={`/resources/${catSlug}`} className="res-hub-cta">
                      See all
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>

                  <ol className="res-hub-index">
                    {articles.map((a, i) => (
                      <li key={a.slug}>
                        <Link href={`/resources/${a.category}/${a.slug}`} className="res-hub-entry">
                          <span className="res-hub-entry-num" aria-hidden="true">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="res-hub-entry-title">{a.title}</span>
                          <span className="res-hub-entry-time">{a.readingTime}m</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </article>
              )
            })}
          </div>

          {/* Remaining categories as compact chips */}
          <div className="res-v3-cat-chips">
            {CATEGORIES.filter(c => !HUB_CATEGORIES.includes(c.slug)).map(cat => (
              <Link key={cat.slug} href={`/resources/${cat.slug}`} className="res-v3-cat-chip" style={{ borderColor: `${cat.color}30`, color: cat.color }}>
                <span>{cat.label}</span>
                <span className="res-v3-cat-chip-count">{getArticlesByCategory(cat.slug).length}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── LATEST ARTICLES — editorial 2+4 layout ───────────────────── */}
      <section className="res-v3-section res-v3-section-muted">
        <div className="container">
          <div className="res-section-header">
            <div>
              <h2 className="res-section-title">Latest articles</h2>
              <p className="res-section-sub">Fresh from the LetBuyy editorial team</p>
            </div>
            <Link href="/resources/search" className="res-section-link">Browse all →</Link>
          </div>

          {/* Front-page rhythm: one lead story, the rest as a ruled column —
              deliberately not a grid of uniform cards. */}
          <div className="res-wire">
            {latest.slice(0, 1).map(article => {
              const cat = getCategory(article.category)!
              const author = AUTHORS.find(a => a.slug === article.author)
              return (
                <Link
                  key={article.slug}
                  href={`/resources/${article.category}/${article.slug}`}
                  className="res-wire-lead"
                  style={{ '--wire-accent': cat.color } as React.CSSProperties}
                >
                  <span className="res-wire-dateline">
                    <span className="res-wire-cat">{cat.label}</span>
                    <span className="res-wire-rule" aria-hidden="true" />
                    <time dateTime={article.publishedAt}>
                      {new Date(article.publishedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </time>
                  </span>

                  <h3 className="res-wire-lead-title">{article.title}</h3>
                  <p className="res-wire-lead-sub">{article.subtitle}</p>

                  <span className="res-wire-byline">
                    <span className="res-wire-avatar" aria-hidden="true">
                      {author?.name.charAt(0) ?? 'L'}
                    </span>
                    <span className="res-wire-author">{author?.name}</span>
                    <span className="res-wire-dot" aria-hidden="true" />
                    <span className="res-wire-time">{article.readingTime} min read</span>
                  </span>
                </Link>
              )
            })}

            <ol className="res-wire-list">
              {latest.slice(1, 6).map(article => {
                const cat = getCategory(article.category)!
                const author = AUTHORS.find(a => a.slug === article.author)
                return (
                  <li key={article.slug}>
                    <Link
                      href={`/resources/${article.category}/${article.slug}`}
                      className="res-wire-item"
                      style={{ '--wire-accent': cat.color } as React.CSSProperties}
                    >
                      <span className="res-wire-item-cat">{cat.label}</span>
                      <span className="res-wire-item-title">{article.title}</span>
                      <span className="res-wire-item-meta">
                        {author?.name}
                        <span className="res-wire-dot" aria-hidden="true" />
                        {article.readingTime} min
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* ── NEWSLETTER ────────────────────────────────────────────────── */}
      <section className="res-v3-section">
        <div className="container">
          <div className="res-v3-newsletter">
            <div className="res-v3-newsletter-left">
              <div className="res-v3-newsletter-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div>
                <h2 className="res-v3-newsletter-title">Commerce insights, weekly</h2>
                <p className="res-v3-newsletter-sub">35,000+ Indian merchants · No spam · Unsubscribe anytime</p>
              </div>
            </div>
            <div className="res-v3-newsletter-right">
              <NewsletterInline />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
