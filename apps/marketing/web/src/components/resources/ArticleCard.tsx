
import Copy from '@/components/i18n/Copy'
import Link from '@/components/i18n/LocaleLink'
import type { Article, Category } from '@/lib/resources/types'
import { getAuthor } from '@/lib/resources/authors'
import { getArticleDifficulty, formatDate } from '@/lib/resources/utils'
import ResourceArticleArtwork from './ResourceArticleArtwork'
import styles from './resource-list-visuals.module.css'

interface Props {
  article: Article
  category: Category
  compact?: boolean
  featured?: boolean
}

const DIFFICULTY_LABEL = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
} as const

const DIFFICULTY_CLASS = {
  beginner: 'rc-badge-beginner',
  intermediate: 'rc-badge-intermediate',
  advanced: 'rc-badge-advanced',
} as const

export default function ArticleCard({ article, category, compact = false, featured = false }: Props) {
  const author = getAuthor(article.author)
  const difficulty = getArticleDifficulty(article.slug)

  if (compact) {
    return (
      <Link href={`/resources/${article.category}/${article.slug}`} className="rc-card-compact">
        <div className="rc-card-compact-color" style={{ background: category.color }} />
        <div className={styles.compactArtwork}><ResourceArticleArtwork slug={article.slug} thumbnail /></div>
        <div className="rc-card-compact-body">
          <span className="rc-card-compact-cat" style={{ color: category.color }}><Copy text={category.label} /></span>
          <p className="rc-card-compact-title">{article.title}</p>
          <div className="rc-card-compact-meta">
            <span>{article.readingTime} <Copy text={"min"} /></span>
            {difficulty && <span className={`rc-badge-diff ${DIFFICULTY_CLASS[difficulty]}`}><Copy text={DIFFICULTY_LABEL[difficulty]} /></span>}
          </div>
        </div>
      </Link>
    )
  }

  if (featured) {
    return (
      <Link href={`/resources/${article.category}/${article.slug}`} className="rc-card-featured">
        <div className="rc-card-featured-accent" style={{ background: category.color }} />
        <div className="rc-card-featured-body">
          <div className={styles.cardArtwork}><ResourceArticleArtwork slug={article.slug} thumbnail /></div>
          <div className="rc-card-featured-top">
            <span className="rc-card-chip" style={{ background: category.accent, color: category.color }}>
              {category.label}
            </span>
            {difficulty && (
              <span className={`rc-badge-diff ${DIFFICULTY_CLASS[difficulty]}`}>{DIFFICULTY_LABEL[difficulty]}</span>
            )}
            <span className="rc-card-badge"><Copy text={"Featured"} /></span>
          </div>
          <h3 className="rc-card-featured-title">{article.title}</h3>
          <p className="rc-card-featured-subtitle">{article.subtitle}</p>
          <div className="rc-card-featured-footer">
            <div className="rc-card-author-row">
              <div className="rc-author-avatar rc-author-avatar-sm">{author.name.charAt(0)}</div>
              <span className="rc-card-author-name">{author.name}</span>
            </div>
            <div className="rc-card-meta">
              <span>{formatDate(article.publishedAt)}</span>
              <span className="rc-card-meta-dot" />
              <span>{article.readingTime} <Copy text={"min read"} /></span>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/resources/${article.category}/${article.slug}`} className="rc-card-v3">
      <div className="rc-card-v3-top-bar" style={{ background: category.color }} />
      <div className="rc-card-v3-body">
        <div className={styles.cardArtwork}><ResourceArticleArtwork slug={article.slug} thumbnail /></div>
        <div className="rc-card-v3-chips">
          <span className="rc-card-chip" style={{ background: category.accent, color: category.color }}>
            {category.label}
          </span>
          {difficulty && (
            <span className={`rc-badge-diff ${DIFFICULTY_CLASS[difficulty]}`}>{DIFFICULTY_LABEL[difficulty]}</span>
          )}
          {article.featured && <span className="rc-card-badge"><Copy text={"Featured"} /></span>}
        </div>
        <h3 className="rc-card-v3-title">{article.title}</h3>
        <p className="rc-card-v3-subtitle">{article.subtitle}</p>
        <div className="rc-card-v3-footer">
          <div className="rc-card-author-row">
            <div className="rc-author-avatar rc-author-avatar-xs">{author.name.charAt(0)}</div>
            <span className="rc-card-author-name">{author.name}</span>
          </div>
          <div className="rc-card-meta">
            <span>{article.readingTime} <Copy text={"min read"} /></span>
          </div>
        </div>
      </div>
    </Link>
  )
}
