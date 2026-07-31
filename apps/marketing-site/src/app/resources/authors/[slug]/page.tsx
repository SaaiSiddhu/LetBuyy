import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ArticleCard from '@/components/resources/ArticleCard'
import { AUTHORS, getAuthor } from '@/lib/resources/authors'
import { getAuthorArticles, formatDate } from '@/lib/resources/utils'
import { getCategory } from '@/lib/resources/categories'

export function generateStaticParams() {
  return AUTHORS.map(a => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const author = AUTHORS.find(a => a.slug === slug)
  if (!author) return {}
  return {
    title: `${author.name} — LetBuyy Resources`,
    description: author.bio,
    alternates: { canonical: `/resources/authors/${slug}` },
  }
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const author = AUTHORS.find(a => a.slug === slug)
  if (!author) notFound()

  const articles = getAuthorArticles(slug)
  const articlesWithCats = articles.map(a => ({ article: a, category: getCategory(a.category)! }))

  return (
    <div className="res-author-page">
      <div className="container" style={{ maxWidth: 900 }}>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
          <Link href="/resources" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Resources</Link>
          <span>›</span>
          <span style={{ color: 'var(--text-primary)' }}>Authors</span>
          <span>›</span>
          <span style={{ color: 'var(--text-primary)' }}>{author.name}</span>
        </nav>

        {/* Author hero */}
        <div className="res-author-hero">
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
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <p style={{ fontSize: 28, fontWeight: 750, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{articles.length}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Articles published</p>
          </div>
        </div>

        {/* Articles grid */}
        <div className="res-section-header" style={{ marginBottom: 24 }}>
          <h2 className="res-section-title">Articles by {author.name}</h2>
        </div>
        <div className="res-grid-3">
          {articlesWithCats.map(({ article, category }) => (
            <ArticleCard key={article.slug} article={article} category={category} />
          ))}
        </div>

        {articles.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 15 }}>No articles published yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
