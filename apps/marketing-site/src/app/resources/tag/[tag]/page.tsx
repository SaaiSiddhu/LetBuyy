import type { Metadata } from 'next'
import Link from 'next/link'
import ArticleCard from '@/components/resources/ArticleCard'
import { getCategory } from '@/lib/resources/categories'
import { getArticlesByTag, getAllTags, generateStaticTagParams } from '@/lib/resources/utils'

export function generateStaticParams() {
  return generateStaticTagParams()
}

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params
  return {
    title: `#${tag} — Resources`,
    description: `All LetBuyy resource articles tagged with #${tag}.`,
    alternates: { canonical: `/resources/tag/${tag}` },
  }
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params
  const articles = getArticlesByTag(tag)
  const topTags = getAllTags().slice(0, 20)

  return (
    <div className="container" style={{ paddingTop: 64, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <Link href="/resources" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 16 }}>
          ← Resources
        </Link>
        <div className="res-hero-label" style={{ marginBottom: 12 }}>Tag</div>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 750, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 8 }}>
          #{tag}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{articles.length} {articles.length === 1 ? 'article' : 'articles'}</p>
      </div>

      {/* Articles */}
      {articles.length > 0 ? (
        <div className="res-grid-3" style={{ marginBottom: 64 }}>
          {articles.map(article => {
            const cat = getCategory(article.category)!
            return <ArticleCard key={article.slug} article={article} category={cat} />
          })}
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 64 }}>No articles found for this tag.</p>
      )}

      {/* Other tags */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 32 }}>
        <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 16 }}>
          Browse tags
        </p>
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
