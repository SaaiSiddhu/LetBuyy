import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ArticleCard from '@/components/resources/ArticleCard'
import { CATEGORIES, getCategory } from '@/lib/resources/categories'
import {
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

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const cat = getCategory(category)
  if (!cat) notFound()

  const allArticles = getArticlesByCategory(category)
  const featuredInCat = allArticles.filter(a => a.featured)
  const featured = featuredInCat[0] ?? allArticles[0]
  const rest = allArticles.filter(a => a.slug !== featured?.slug)

  // Collect tags from this category
  const catTags = Array.from(new Set(allArticles.flatMap(a => a.tags))).slice(0, 10)

  // Other categories for browse row
  const otherCategories = CATEGORIES.filter(c => c.slug !== category).slice(0, 5)

  return (
    <>
      {/* Category Hero */}
      <section className="res-v3-cat-hero">
        <div className="container">
          {/* Breadcrumb */}
          <nav className="rc-article-breadcrumb" style={{ marginBottom: 20 }} aria-label="Breadcrumb">
            <Link href="/resources">Resources</Link>
            <span aria-hidden="true">›</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cat.label}</span>
          </nav>

          <div className="res-v3-cat-hero-inner">
            <div className="res-v3-cat-hero-left">
              <div className="res-v3-cat-hero-icon" style={{ background: cat.accent, color: cat.color }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <h1 className="res-v3-cat-hero-title" style={{ color: cat.color }}>{cat.label}</h1>
              <p className="res-v3-cat-hero-desc">{cat.description}</p>
              <div className="res-v3-cat-hero-stat">
                <strong style={{ color: cat.color }}>{allArticles.length}</strong>
                <span> articles in this category</span>
              </div>

              {/* Tag filters */}
              {catTags.length > 0 && (
                <div className="res-v3-cat-tags" role="list" aria-label="Filter by topic">
                  {catTags.map(tag => (
                    <Link key={tag} href={`/resources/tag/${tag}`} className="rc-tag" role="listitem">
                      #{tag}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Featured article */}
            {featured && (
              <div className="res-v3-cat-hero-right">
                <p className="res-v3-spotlight-label">Featured in {cat.label}</p>
                <ArticleCard article={featured} category={cat} featured />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* All articles grid */}
      {rest.length > 0 && (
        <section className="res-v3-section">
          <div className="container">
            <div className="res-section-header">
              <h2 className="res-section-title">All {cat.label} guides</h2>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{rest.length} article{rest.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="res-v3-grid">
              {rest.map(article => (
                <ArticleCard key={article.slug} article={article} category={cat} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Browse other categories */}
      <section className="res-v3-section res-v3-section-muted">
        <div className="container">
          <h2 className="res-section-title" style={{ marginBottom: 20 }}>Explore other topics</h2>
          <div className="res-v3-other-cats">
            {otherCategories.map(c => (
              <Link key={c.slug} href={`/resources/${c.slug}`} className="res-v3-other-cat">
                <span className="res-v3-other-cat-label" style={{ color: c.color }}>{c.label}</span>
                <span className="res-v3-other-cat-count">{getArticlesByCategory(c.slug).length} articles</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
