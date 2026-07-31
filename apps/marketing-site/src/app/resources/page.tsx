import type { Metadata } from 'next'
import Link from 'next/link'
import ArticleCard from '@/components/resources/ArticleCard'
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

const STATS = [
  { value: `${ARTICLES.length}+`, label: 'Guides' },
  { value: `${LEARNING_PATHS.length}`, label: 'Learning paths' },
  { value: `${AUTHORS.length}`, label: 'Expert authors' },
  { value: '35,000+', label: 'Merchants learning' },
]

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
        <div className="container">
          <div className="res-v3-hero-inner">

            {/* Left: editorial heading + stats + search */}
            <div className="res-v3-hero-left">
              <div className="res-v3-hero-eyebrow">
                <span className="res-v3-hero-dot" aria-hidden="true" />
                Merchant Education Platform
              </div>
              <h1 className="res-v3-hero-heading">
                Everything you need to<br />
                <span className="res-v3-hero-accent">build and scale</span><br />
                your Indian store.
              </h1>
              <p className="res-v3-hero-sub">
                Guides, playbooks, and tutorials built for Indian merchants — covering GST, UPI, COD, D2C growth, and commerce automation.
              </p>

              {/* Inline search */}
              <Link href="/resources/search" className="res-v3-hero-search" aria-label="Search resources">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <span className="res-v3-hero-search-placeholder">Search guides, topics, categories…</span>
                <kbd className="res-v3-hero-kbd">⌘K</kbd>
              </Link>

              {/* Stats row */}
              <div className="res-v3-stats">
                {STATS.map(s => (
                  <div key={s.label} className="res-v3-stat">
                    <span className="res-v3-stat-value">{s.value}</span>
                    <span className="res-v3-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: featured article spotlight */}
            {featured && featuredCat && (
              <div className="res-v3-hero-right">
                <p className="res-v3-spotlight-label">Featured guide</p>
                <Link href={`/resources/${featured.category}/${featured.slug}`} className="res-v3-spotlight-card">
                  <div className="res-v3-spotlight-accent" style={{ background: featuredCat.color }} />
                  <div className="res-v3-spotlight-body">
                    <span className="rc-card-chip" style={{ background: featuredCat.accent, color: featuredCat.color }}>
                      {featuredCat.label}
                    </span>
                    <h2 className="res-v3-spotlight-title">{featured.title}</h2>
                    <p className="res-v3-spotlight-sub">{featured.subtitle}</p>
                    <div className="res-v3-spotlight-footer">
                      <div className="rc-card-author-row">
                        <div className="rc-author-avatar rc-author-avatar-xs">
                          {AUTHORS.find(a => a.slug === featured.author)?.name.charAt(0) ?? 'L'}
                        </div>
                        <span className="rc-card-author-name">
                          {AUTHORS.find(a => a.slug === featured.author)?.name}
                        </span>
                      </div>
                      <span className="res-v3-spotlight-time">{featured.readingTime} min read</span>
                    </div>
                  </div>
                </Link>

                {/* Trending tags */}
                <div className="res-v3-trending-tags">
                  <span className="res-v3-trending-label">Trending:</span>
                  {['upi', 'gst', 'cod', 'd2c', 'inventory', 'shopify'].map(tag => (
                    <Link key={tag} href={`/resources/tag/${tag}`} className="rc-tag">#{tag}</Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── LEARNING PATHS CAROUSEL ────────────────────────────────────── */}
      <section className="res-v3-section">
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
            <div className="res-v3-paths-scroll">
              {LEARNING_PATHS.map(path => {
                const articlesInPath = ARTICLES.filter(a => path.articleSlugs.includes(a.slug))
                const totalMinutes = articlesInPath.reduce((sum, a) => sum + a.readingTime, 0)
                return (
                  <div key={path.slug} className="res-v3-path-card" style={{ borderColor: `${path.color}40` }}>
                    <div className="res-v3-path-card-header" style={{ background: path.accent }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className={`res-path-level ${LEVEL_CLASS[path.level]}`}>
                          {LEVEL_LABELS[path.level]}
                        </span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={path.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.8 }}>
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                      </div>
                      {/* Progress track placeholder */}
                      <div className="res-v3-path-progress">
                        <div className="res-v3-path-progress-fill" style={{ width: '0%', background: path.color }} />
                      </div>
                    </div>
                    <div className="res-v3-path-card-body">
                      <h3 className="res-v3-path-title" style={{ color: path.color }}>{path.title}</h3>
                      <p className="res-v3-path-desc">{path.description}</p>
                      <div className="res-v3-path-meta">
                        <span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                          </svg>
                          {articlesInPath.length} articles
                        </span>
                        <span className="rc-card-meta-dot" aria-hidden="true" />
                        <span>~{totalMinutes} min total</span>
                      </div>
                      <div className="res-v3-path-articles">
                        {articlesInPath.slice(0, 4).map((a, i) => (
                          <Link key={a.slug} href={`/resources/${a.category}/${a.slug}`} className="res-v3-path-article">
                            <span className="res-v3-path-article-num" style={{ color: path.color }}>{i + 1}</span>
                            <span className="res-v3-path-article-title">{a.title}</span>
                            <span className="res-v3-path-article-time">{a.readingTime}m</span>
                          </Link>
                        ))}
                        {articlesInPath.length > 4 && (
                          <span className="res-v3-path-more">+{articlesInPath.length - 4} more articles</span>
                        )}
                      </div>
                    </div>
                  </div>
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
                <div key={catSlug} className="res-v3-hub">
                  <div className="res-v3-hub-header">
                    <div className="res-v3-hub-icon" style={{ background: cat.accent, color: cat.color }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="res-v3-hub-title" style={{ color: cat.color }}>{cat.label}</h3>
                      <p className="res-v3-hub-count">{getArticlesByCategory(catSlug).length} articles</p>
                    </div>
                  </div>
                  <p className="res-v3-hub-desc">{cat.description}</p>
                  <div className="res-v3-hub-articles">
                    {articles.map(a => (
                      <Link key={a.slug} href={`/resources/${a.category}/${a.slug}`} className="res-v3-hub-article">
                        <span className="res-v3-hub-article-title">{a.title}</span>
                        <span className="res-v3-hub-article-time">{a.readingTime}m</span>
                      </Link>
                    ))}
                  </div>
                  <Link href={`/resources/${catSlug}`} className="res-v3-hub-cta" style={{ color: cat.color }}>
                    See all {cat.label} guides
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
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

          <div className="res-v3-latest-grid">
            {/* First 2: featured large */}
            {latest.slice(0, 2).map(article => {
              const cat = getCategory(article.category)!
              return <ArticleCard key={article.slug} article={article} category={cat} featured />
            })}
            {/* Next 4: standard */}
            {latest.slice(2, 6).map(article => {
              const cat = getCategory(article.category)!
              return <ArticleCard key={article.slug} article={article} category={cat} />
            })}
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
              <Link href="/resources/newsletter" className="res-v3-newsletter-btn">
                Subscribe to newsletter
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <p className="res-v3-newsletter-hint">Choose topics: Growth · Payments · Operations · AI</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
