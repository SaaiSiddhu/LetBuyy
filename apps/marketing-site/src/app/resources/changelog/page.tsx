import type { Metadata } from 'next'
import Link from 'next/link'
import { CHANGELOG } from '@/lib/resources/changelog'
import { formatDate } from '@/lib/resources/utils'

export const metadata: Metadata = {
  title: 'Changelog — LetBuyy',
  description: 'Product updates, new features, bug fixes, and improvements to the LetBuyy platform.',
  alternates: { canonical: '/resources/changelog' },
}

const TAG_LABELS: Record<string, string> = {
  feature: 'New Feature',
  fix: 'Bug Fix',
  improvement: 'Improvement',
  security: 'Security',
  breaking: 'Breaking Change',
}

export default function ChangelogPage() {
  return (
    <div className="container" style={{ paddingTop: 64, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <Link href="/resources" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 20 }}>
          ← Resources
        </Link>
        <div className="res-hero-label" style={{ marginBottom: 12 }}>Platform</div>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 750, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 12 }}>
          Changelog
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 520 }}>
          What&apos;s new in LetBuyy — features, fixes, and platform improvements, reverse-chronologically.
        </p>
      </div>

      {/* RSS link */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 48, paddingBottom: 32, borderBottom: '1px solid var(--border-subtle)' }}>
        <Link
          href="/resources/rss.xml"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', padding: '5px 12px', border: '1px solid var(--border-subtle)', borderRadius: 6 }}
        >
          ⊕ RSS Feed
        </Link>
      </div>

      {/* Entries */}
      {CHANGELOG.map(entry => (
        <div key={entry.version} className="rc-cl-entry">
          {/* Meta */}
          <div className="rc-cl-meta">
            <span className="rc-cl-version">v{entry.version}</span>
            <span className="rc-cl-date">{formatDate(entry.date)}</span>
            <span className={`rc-cl-tag rc-cl-tag-${entry.tag}`}>
              {TAG_LABELS[entry.tag]}
            </span>
          </div>

          {/* Content */}
          <div className="rc-cl-content">
            <h3>{entry.title}</h3>
            <div className="rc-cl-items">
              {entry.items.map((item, i) => (
                <div key={i} className="rc-cl-item">
                  <span className={`rc-cl-item-dot rc-cl-item-dot-${item.type}`} />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
