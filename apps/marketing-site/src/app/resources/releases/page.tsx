import type { Metadata } from 'next'
import Link from 'next/link'
import { CHANGELOG } from '@/lib/resources/changelog'
import { formatDate } from '@/lib/resources/utils'

export const metadata: Metadata = {
  title: 'Platform Releases — LetBuyy',
  description: 'Major releases, new features, and platform milestones for the LetBuyy commerce platform.',
  alternates: { canonical: '/resources/releases' },
}

const TAG_STYLES: Record<string, string> = {
  feature: 'rc-cl-tag-feature',
  fix: 'rc-cl-tag-fix',
  improvement: 'rc-cl-tag-improvement',
  security: 'rc-cl-tag-security',
  breaking: 'rc-cl-tag-breaking',
}

const HIGHLIGHTS: Record<string, { title: string; items: string[] }[]> = {
  'v2.8.0': [
    {
      title: 'AI-Powered Commerce Intelligence',
      items: [
        'Predictive restocking alerts with 14-day demand forecasting',
        'Automated pricing recommendations based on competitor signals',
        'Customer churn prediction with 85%+ accuracy',
        'Natural-language search across your product catalog',
      ],
    },
  ],
  'v2.7.0': [
    {
      title: 'Razorpay International & UPI Turbo',
      items: [
        'Accept cards from 100+ countries with automatic currency conversion',
        'UPI Turbo — pre-authenticated, sub-second payments for repeat buyers',
        'Payment retry intelligence with smart routing fallback',
        'Real-time webhook delivery with guaranteed ordering',
      ],
    },
  ],
  'v2.6.0': [
    {
      title: 'Commerce OS Dashboard',
      items: [
        'Unified merchant dashboard replacing 7 separate panels',
        'Real-time revenue, orders, and inventory in one view',
        'Mobile-first design — fully functional on 360px screens',
        'Keyboard shortcuts for power users',
      ],
    },
  ],
}

export default function ReleasesPage() {
  const major = CHANGELOG.filter(e => e.tag === 'feature' || e.version.match(/v\d+\.\d+\.0$/))

  return (
    <div className="res-releases-page">
      <div className="container" style={{ maxWidth: 860 }}>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
          <Link href="/resources" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Resources</Link>
          <span>›</span>
          <span style={{ color: 'var(--text-primary)' }}>Releases</span>
        </nav>

        <div className="res-releases-hero">
          <h1>Platform Releases</h1>
          <p>Major milestones and platform-level changes. For granular patch notes, see the <Link href="/resources/changelog" style={{ color: 'var(--primary)' }}>Changelog</Link>.</p>
        </div>

        {CHANGELOG.map(entry => {
          const extra = HIGHLIGHTS[entry.version]
          return (
            <div key={entry.version} className="res-release-entry">
              <div className="res-release-meta">
                <span className="res-release-version">{entry.version}</span>
                <span className="res-release-date">{formatDate(entry.date)}</span>
                <span className={`rc-cl-tag ${TAG_STYLES[entry.tag] ?? 'rc-cl-tag-feature'}`}>
                  {entry.tag}
                </span>
              </div>
              <div className="res-release-body">
                <h3>{entry.title}</h3>
                {extra ? (
                  extra.map(section => (
                    <div key={section.title}>
                      <p>{section.title}</p>
                      <div className="res-release-highlights">
                        {section.items.map((item, i) => (
                          <div key={i} className="res-release-highlight">
                            <div className="res-release-highlight-dot" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="res-release-highlights">
                    {entry.items.map((item, i) => (
                      <div key={i} className="res-release-highlight">
                        <div
                          className="res-release-highlight-dot"
                          style={{
                            background: item.type === 'fix' ? 'var(--accent-blue)'
                              : item.type === 'improvement' ? 'rgb(20,184,166)'
                              : 'var(--primary)',
                          }}
                        />
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <div style={{ paddingTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Looking for patch-level changes?
          </p>
          <Link href="/resources/changelog" style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
            View full changelog →
          </Link>
        </div>
      </div>
    </div>
  )
}
