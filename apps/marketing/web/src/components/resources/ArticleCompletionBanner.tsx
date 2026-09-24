import Link from '@/components/i18n/LocaleLink'
import type { Article } from '@/lib/resources/types'

interface Props {
  next: Article | null
}

export default function ArticleCompletionBanner({ next }: Props) {
  return (
    <div className="arc-completion-banner" role="complementary" aria-label="Article complete">
      <div className="arc-completion-left">
        <div className="arc-completion-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <div>
          <p className="arc-completion-badge">Article complete</p>
          <p className="arc-completion-title">
            {next ? `Up next: ${next.title}` : 'Keep exploring'}
          </p>
          <p className="arc-completion-sub">
            {next
              ? `${next.readingTime} min read`
              : 'Browse more resources on the LetBuyy platform'}
          </p>
        </div>
      </div>

      {next ? (
        <Link
          href={`/resources/${next.category}/${next.slug}`}
          className="arc-completion-cta"
        >
          Continue learning
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      ) : (
        <Link href="/resources" className="arc-completion-cta">
          Browse resources
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  )
}
