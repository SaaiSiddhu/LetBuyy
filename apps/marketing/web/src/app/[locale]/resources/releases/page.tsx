import { localizeMetadata } from '@/lib/i18n/metadata'
import Copy from '@/components/i18n/Copy'
import { createCopy } from '@/lib/i18n/copy'
import { getLocale } from '@/lib/i18n/locales'
import type { Metadata } from 'next'
import Link from '@/components/i18n/LocaleLink'
import Image from 'next/image'
import { RELEASE_ARTWORK } from '@/lib/resources/changelog-presentation'
import visualStyles from '@/components/resources/resource-list-visuals.module.css'
import { CHANGELOG } from '@/lib/resources/changelog'

const sourceMetadata: Metadata = {
  title: 'Platform Releases — LetBuyy',
  description: 'Major releases, new features, and platform milestones for the LetBuyy commerce platform.',
  alternates: { canonical: '/resources/releases' },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    return localizeMetadata(sourceMetadata, (await params).locale, "/resources/releases")
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

export default async function ReleasesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = getLocale((await params).locale)
  const t = createCopy(locale.language.code)

  return (
    <div className="res-releases-page">
      <div className="container" style={{ maxWidth: 860 }}>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
          <Link href="/resources" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}><Copy text={"Resources"} /></Link>
          <span>›</span>
          <span style={{ color: 'var(--text-primary)' }}><Copy text={"Releases"} /></span>
        </nav>

        <div className={visualStyles.subpageHeader}><div className="res-releases-hero">
          <h1><Copy text={"Platform Releases"} /></h1>
          <p><Copy text={"Major milestones and platform-level changes. For granular patch notes, see the"} />{' '}<Link href="/resources/changelog" style={{ color: 'var(--primary)' }}><Copy text={"Changelog"} /></Link>.</p>
        </div><Image src="/illustrations/resources/changelog-journal-v1.webp" alt="" width={1536} height={1024} sizes="(max-width: 640px) 80vw, 240px" loading="eager" unoptimized /></div>

        {CHANGELOG.map(entry => {
          const extra = HIGHLIGHTS[entry.version]
          return (
            <div key={entry.version} className="res-release-entry">
              <div className="res-release-meta">
                <span className="res-release-version">{entry.version}</span>
                <span className="res-release-date">{new Date(entry.date).toLocaleDateString(locale.hreflang, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className={`rc-cl-tag ${TAG_STYLES[entry.tag] ?? 'rc-cl-tag-feature'}`}>
                  {t(entry.tag)}
                </span>
              </div>
              <div className="res-release-body">
                {RELEASE_ARTWORK[entry.version] && <Image src={RELEASE_ARTWORK[entry.version].src} alt="" width={RELEASE_ARTWORK[entry.version].width} height={RELEASE_ARTWORK[entry.version].height} sizes="260px" loading="eager" unoptimized className={visualStyles.releaseArtwork} />}
                <h3>{t(entry.title)}</h3>
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
                            background: item.type === 'fix' ? 'var(--lb-color-info)'
                              : item.type === 'improvement' ? 'var(--lb-color-success)'
                              : 'var(--primary)',
                          }}
                        />
                        <span>{t(item.text)}</span>
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
            <Copy text={"Looking for patch-level changes?"} /></p>
          <Link href="/resources/changelog" style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
            <Copy text={"View full changelog →"} /></Link>
        </div>
      </div>
    </div>
  )
}
