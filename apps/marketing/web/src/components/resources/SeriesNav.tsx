
import Copy from '@/components/i18n/Copy'
import Link from '@/components/i18n/LocaleLink'
import type { Article } from '@/lib/resources/types'

interface Props {
  seriesArticles: Article[]
  currentSlug: string
}

export default function SeriesNav({ seriesArticles, currentSlug }: Props) {
  if (seriesArticles.length < 2) return null

  const currentIdx = seriesArticles.findIndex(a => a.slug === currentSlug)
  const progress = ((currentIdx + 1) / seriesArticles.length) * 100

  return (
    <div className="rc-series-nav" role="navigation" aria-label="Series navigation">
      <div className="rc-series-header">
        <div className="rc-series-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 6h16M4 10h16M4 14h10M4 18h6" />
          </svg>
          <Copy text={"Series ·"} />{' '}{currentIdx + 1} <Copy text={"of"} />{' '}{seriesArticles.length}
        </div>
        <div className="rc-series-progress-bar" role="progressbar" aria-valuenow={currentIdx + 1} aria-valuemin={1} aria-valuemax={seriesArticles.length}>
          <div className="rc-series-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <ol className="rc-series-list">
        {seriesArticles.map((article, i) => {
          const isCurrent = article.slug === currentSlug
          const isDone = i < currentIdx
          return (
            <li key={article.slug} className={`rc-series-item${isCurrent ? ' current' : isDone ? ' done' : ''}`}>
              <div className="rc-series-step" aria-hidden="true">
                {isDone ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              {isCurrent ? (
                <span className="rc-series-current-title">{article.title}</span>
              ) : (
                <Link href={`/resources/${article.category}/${article.slug}`} className="rc-series-link">
                  {article.title}
                  <span className="rc-series-link-meta">{article.readingTime} <Copy text={"min"} /></span>
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
