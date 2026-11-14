
import Copy from '@/components/i18n/Copy'
import Link from '@/components/i18n/LocaleLink'
import type { Article } from '@/lib/resources/types'
import { getCategory } from '@/lib/resources/categories'

interface Props {
  prev: Article | null
  next: Article | null
}

export default function PrevNextArticle({ prev, next }: Props) {
  if (!prev && !next) return null

  const prevCat = prev ? getCategory(prev.category) : null
  const nextCat = next ? getCategory(next.category) : null

  return (
    <nav className="arc-pn-section" aria-label="Article navigation">
      <div className="arc-pn-grid">
        {prev && prevCat ? (
          <Link href={`/resources/${prev.category}/${prev.slug}`} className="arc-pn-card">
            <div className="arc-pn-dir">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <Copy text={"Previous"} /></div>
            <p className="arc-pn-cat" style={{ color: `color-mix(in srgb, ${prevCat.color} 35%, var(--lb-color-text))` }}><Copy text={prevCat.label} /></p>
            <p className="arc-pn-title">{prev.title}</p>
            <p className="arc-pn-meta">{prev.readingTime} <Copy text={"min read"} /></p>
          </Link>
        ) : (
          <div />
        )}

        {next && nextCat ? (
          <Link href={`/resources/${next.category}/${next.slug}`} className="arc-pn-card arc-pn-next-card">
            <div className="arc-pn-dir">
              <Copy text={"Next"} /><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
            <p className="arc-pn-cat" style={{ color: `color-mix(in srgb, ${nextCat.color} 35%, var(--lb-color-text))` }}><Copy text={nextCat.label} /></p>
            <p className="arc-pn-title">{next.title}</p>
            <p className="arc-pn-meta">{next.readingTime} <Copy text={"min read"} /></p>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </nav>
  )
}
