import Link from '@/components/i18n/LocaleLink'
import type { Article, Category } from '@/lib/resources/types'

interface Props {
  articles: Array<{ article: Article; category: Category }>
}

export default function RecommendedArticles({ articles }: Props) {
  if (articles.length === 0) return null

  return (
    <section className="arc-rec-section" aria-label="Recommended reading">
      <p className="arc-rec-eyebrow">Keep reading</p>
      <h2 className="arc-rec-heading">Recommended for you</h2>
      <div className="arc-rec-grid">
        {articles.map(({ article, category }) => (
          <Link
            key={article.slug}
            href={`/resources/${article.category}/${article.slug}`}
            className="arc-rec-card"
          >
            <div className="arc-rec-top">
              <span className="arc-rec-cat" style={{ color: category.color }}>{category.label}</span>
            </div>
            <p className="arc-rec-title">{article.title}</p>
            <p className="arc-rec-desc">{article.subtitle}</p>
            <div className="arc-rec-footer">
              <span className="arc-rec-time">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                {article.readingTime} min read
              </span>
              <svg className="arc-rec-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
