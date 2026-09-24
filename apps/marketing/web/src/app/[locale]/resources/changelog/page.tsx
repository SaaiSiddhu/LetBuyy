import type { Metadata } from 'next'
import Link from '@/components/i18n/LocaleLink'
import { CHANGELOG } from '@/lib/resources/changelog'
import { formatDate } from '@/lib/resources/utils'

export const metadata: Metadata = {
  title: 'Changelog — LetBuyy',
  description: 'Product updates, new features, bug fixes, and improvements to the LetBuyy platform.',
  alternates: { canonical: '/resources/changelog' },
}

const TAG_LABELS: Record<string, string> = {
  feature: 'New',
  fix: 'Fixes',
  improvement: 'Improved',
  security: 'Security',
  breaking: 'Breaking',
}

/** Diff-style markers — added, changed, fixed. Reads like a real release note. */
const ITEM_SIGN: Record<string, string> = {
  feature: '+',
  improvement: '~',
  fix: '✓',
}

export default function ChangelogPage() {
  const latest = CHANGELOG[0]

  return (
    <div className="clg-page">
      <div className="container">

        <header className="clg-head">
          <Link href="/resources" className="clg-back">← Resources</Link>
          <h1 className="clg-title">Changelog</h1>
          <p className="clg-sub">
            Every release, newest first. LetBuyy is in private beta — expect this list to move quickly.
          </p>
        </header>

        {/* Standing facts, derived from the log rather than written by hand */}
        <div className="clg-summary">
          <dl className="clg-facts">
            <div className="clg-fact">
              <dt>Releases</dt>
              <dd>{CHANGELOG.length}</dd>
            </div>
            <div className="clg-fact">
              <dt>Latest</dt>
              <dd className="clg-fact-mono">v{latest.version}</dd>
            </div>
            <div className="clg-fact">
              <dt>Shipped</dt>
              <dd>{formatDate(latest.date)}</dd>
            </div>
          </dl>
          <Link href="/resources/rss.xml" className="clg-rss">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
              <circle cx="5" cy="19" r="1" fill="currentColor" />
            </svg>
            RSS
          </Link>
        </div>

        <ol className="clg-list">
          {CHANGELOG.map((entry, index) => (
            <li
              key={entry.version}
              className={`clg-entry clg-tag-${entry.tag}${index === 0 ? ' is-latest' : ''}`}
            >
              <div className="clg-stamp">
                <span className="clg-version">v{entry.version}</span>
                <time className="clg-date" dateTime={entry.date}>{formatDate(entry.date)}</time>
                <span className="clg-tag">{TAG_LABELS[entry.tag]}</span>
                {index === 0 && <span className="clg-latest">Latest</span>}
              </div>

              <div className="clg-body">
                <h2 className="clg-entry-title">{entry.title}</h2>
                <ul className="clg-items">
                  {entry.items.map((item, i) => (
                    <li key={i} className={`clg-item clg-item-${item.type}`}>
                      <span className="clg-sign" aria-hidden="true">{ITEM_SIGN[item.type]}</span>
                      <span className="clg-item-text">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>

        <p className="clg-foot">
          That is the whole history so far — nine releases since the private beta opened.
        </p>
      </div>
    </div>
  )
}
