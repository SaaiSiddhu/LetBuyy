import { localizeMetadata } from '@/lib/i18n/metadata'
import Copy from '@/components/i18n/Copy'
import { getLocale } from '@/lib/i18n/locales'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from '@/components/i18n/LocaleLink'
import { ArrowLeft, ArrowRight, BookOpen } from '@letbuyy/ui'
import ChangelogReleases from '@/components/resources/ChangelogReleases'
import styles from '@/components/resources/changelog.module.css'
import { CHANGELOG } from '@/lib/resources/changelog'

const sourceMetadata: Metadata = {
  title: 'Changelog',
  description: 'Product updates, new features, bug fixes, and improvements to the LetBuyy platform.',
  alternates: { canonical: '/resources/changelog' },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    return localizeMetadata({ ...sourceMetadata, ...(!CHANGELOG.length ? { robots: { index: false, follow: true } } : {}) }, (await params).locale, "/resources/changelog")
}


export default async function ChangelogPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = getLocale((await params).locale)
  const latest = CHANGELOG[0]
  return (
    <div className={styles.page}>
      <div className="container">
        <Link href="/resources" className={styles.back}><ArrowLeft size={16} aria-hidden="true" /><Copy text={"Resources"} /></Link>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}><BookOpen size={16} aria-hidden="true" /><Copy text={"A PRODUCT IN PROGRESS"} /></p>
            <h1><Copy text={"Changelog"} /><span><Copy text={"Every update."} /><br /><Copy text={"A little more possibility."} /></span></h1>
            <p className={styles.intro}><Copy text={"No verified public release notes are published here yet. Contact support to confirm current feature availability."} /></p>
            <div className={styles.actions}><a href="#release-history" className={styles.jump}><Copy text={"Explore the updates"} /><ArrowRight size={16} aria-hidden="true" /></a><Link href="/resources/rss.xml" className={styles.rss}><Copy text={"Follow via RSS"} /><ArrowRight size={15} aria-hidden="true" /></Link></div>
          </div>
          <figure className={styles.heroArt}><Image src="/illustrations/resources/changelog-journal-v1.webp" alt="An open release journal beside illustrated interface layers and a small parcel." width={1536} height={1024} sizes="(max-width: 760px) 90vw, 520px" loading="eager" unoptimized /><figcaption><Copy text={"Thoughtful changes, recorded along the way. Concept illustration."} /></figcaption></figure>
        </header>
        <dl className={styles.summary}>
          <div><dt><Copy text={"Releases so far"} /></dt><dd>{CHANGELOG.length}</dd></div>
          <div><dt><Copy text={"Latest version"} /></dt><dd>{latest ? `v${latest.version}` : '—'}</dd></div>
          <div><dt><Copy text={"Latest release"} /></dt><dd>{latest ? new Date(latest.date).toLocaleDateString(locale.hreflang, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</dd></div>
        </dl>
        {CHANGELOG.length ? <ChangelogReleases entries={CHANGELOG} /> : <p id="release-history"><Copy text="No verified public release notes are published here yet. Contact support to confirm current feature availability." /></p>}
      </div>
    </div>
  )
}
