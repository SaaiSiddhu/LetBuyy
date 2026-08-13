'use client'

import { useState } from 'react'
import Link from '@/components/i18n/LocaleLink'
import type { Article, Author, Category } from '@/lib/resources/types'

interface Props {
  author: Author
  article: Article
  related: Array<{ article: Article; category: Category }>
  category: Category
  authorArticleCount: number
  authorTopics: string[]
}

const NEWSLETTER_FEATURES = [
  'AI Commerce insights',
  'India growth playbooks',
  'Platform feature updates',
  'Conversion rate tactics',
]

export default function ArticleSidebar({ author, related, authorArticleCount, authorTopics }: Props) {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    if (email) setSubscribed(true)
  }

  return (
    <div className="arc-sidebar">

      {/* ── Author card ── */}
      <div className="arc-sidebar-block">
        <div className="arc-author-top">
          <div className="arc-author-avatar-xl" aria-hidden="true">
            {author.name.charAt(0)}
          </div>
          <div>
            <p className="arc-author-nm">{author.name}</p>
            <p className="arc-author-rl">{author.role}</p>
          </div>
        </div>

        <p className="arc-author-bio">{author.bio}</p>

        {/* Inline facts rather than boxed tiles — two numbers do not need panels */}
        <p className="arc-author-facts">
          <strong>{authorArticleCount}</strong> articles
          <span className="arc-author-facts-sep" aria-hidden="true" />
          <strong>{authorTopics.length}</strong> topics
        </p>

        {authorTopics.length > 0 && (
          <div className="arc-author-topics-row">
            {authorTopics.map(t => (
              <span key={t} className="arc-author-topic">{t}</span>
            ))}
          </div>
        )}

        <div className="arc-author-links">
          {/* The mark is the wordmark — a text label beside it just reads twice */}
          {author.twitter && (
            <a href={author.twitter} target="_blank" rel="noopener noreferrer" className="arc-author-soc" aria-label={`${author.name} on X`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          )}
          {author.linkedin && (
            <a href={author.linkedin} target="_blank" rel="noopener noreferrer" className="arc-author-soc">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn
            </a>
          )}
        </div>

        <Link href={`/resources/authors/${author.slug}`} className="arc-author-all">
          All articles by {author.name.split(' ')[0]}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* ── Newsletter card ── */}
      <div className="arc-nl-card">
        <div className="arc-nl-badge">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Weekly Newsletter
        </div>
        <p className="arc-nl-sub-count">35,000+ merchants subscribed</p>
        <p className="arc-nl-title">Commerce Insights Weekly</p>
        <div className="arc-nl-features">
          {NEWSLETTER_FEATURES.map(f => (
            <div key={f} className="arc-nl-feat">
              <svg className="arc-nl-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {f}
            </div>
          ))}
        </div>

        {subscribed ? (
          <p className="arc-nl-success">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            You&apos;re in! Check your inbox.
          </p>
        ) : (
          <>
            <form onSubmit={handleSubscribe}>
              <input
                type="email"
                className="arc-nl-input"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                aria-label="Email address for newsletter"
              />
              <button type="submit" className="arc-nl-btn">Subscribe free</button>
            </form>
            <p className="arc-nl-hint">No spam. Unsubscribe anytime.</p>
          </>
        )}
      </div>

      {/* ── Related articles ── */}
      {related.length > 0 && (
        <div className="arc-sidebar-block">
          <p className="arc-related-hd">Related guides</p>
          {related.map(({ article: a, category: c }) => (
            <Link key={a.slug} href={`/resources/${a.category}/${a.slug}`} className="arc-rel-item">
              <p className="arc-rel-cat" style={{ color: c.color }}>{c.label}</p>
              <p className="arc-rel-title">{a.title}</p>
              <p className="arc-rel-meta">{a.readingTime} min read</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
