import { localizeMetadata } from '@/lib/i18n/metadata'
import type { Metadata } from 'next'
import Link from '@/components/i18n/LocaleLink'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import LegalStatusBanner from '@/components/legal/LegalStatusBanner'
import { GROUP_ORDER, LEGAL_DOCUMENTS, getDocumentsByGroup, readingMinutes } from '@/lib/legal/documents'
import { LEGAL_REVISION_DATE } from '@/lib/legal/entity'
import { formatLegalDate } from '@/lib/legal/format'
import { getSupportEmail } from '@/lib/public-urls'
import legalStyles from '@/components/legal/legal-layout.module.css'
import { getDictionaryForSegment, getLocale } from '@/lib/i18n'
import { localizeLegalContent } from '@/lib/i18n/legal-content'

const sourceMetadata: Metadata = {
    title: 'Legal',
    description:
        'LetBuyy legal library — terms of service, privacy, refunds, shipping, payouts, data processing, sub-processors, security, and grievance redressal for Indian merchants and shoppers.',
    alternates: { canonical: '/legal' },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    return localizeMetadata(sourceMetadata, (await params).locale, "/legal")
}


export default async function LegalHubPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale: segment } = await params
    const locale = getLocale(segment)
    const dict = getDictionaryForSegment(segment)
    const supportEmail = getSupportEmail()

    return (
        <>
            <Header />
            <main className={`lgl-hub ${legalStyles.hub}`}>
                <section className="lgl-masthead">
                    <div className="container">
                        <div className="lgl-masthead-grid">
                            <div className="lgl-masthead-lead">
                                <h1 className="lgl-masthead-title">{dict.legal.title}</h1>
                                <p className="lgl-masthead-intro">
                                    {dict.legal.intro}
                                </p>
                            </div>

                            {/* Same borderless fact list the document head uses —
                                label over value, held apart by space. */}
                            <dl className="lgl-facts">
                                <div>
                                    <dt>{dict.legal.documents}</dt>
                                    <dd>{LEGAL_DOCUMENTS.length}</dd>
                                </div>
                                <div>
                                    <dt>{dict.legal.revised}</dt>
                                    <dd>{formatLegalDate(LEGAL_REVISION_DATE, locale.hreflang)}</dd>
                                </div>
                                <div>
                                    <dt>{dict.legal.jurisdiction}</dt>
                                    <dd>{dict.legal.india}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </section>

                <LegalStatusBanner dict={dict} locale={locale.hreflang} />

                <section className="lgl-shelves">
                    <div className="container">
                        {GROUP_ORDER.map((group, groupIndex) => {
                            const documents = getDocumentsByGroup(group).map(source => ({ ...localizeLegalContent(source, locale.language.code).document, minutes: readingMinutes(source) }))

                            return (
                                <section key={group} className="lgl-shelf" aria-labelledby={`shelf-${group}`}>
                                    <header className="lgl-shelf-head">
                                        <span className="lgl-shelf-index" aria-hidden="true">
                                            {String(groupIndex + 1).padStart(2, '0')}
                                        </span>
                                        <div className="lgl-shelf-titles">
                                            <h2 id={`shelf-${group}`} className="lgl-shelf-title">
                                                {dict.legal[group]}
                                            </h2>
                                            <p className="lgl-shelf-blurb">{dict.legal.groupBlurbs[group]}</p>
                                        </div>
                                        <span className="lgl-shelf-count">{documents.length} {dict.legal.documents}</span>
                                    </header>

                                    <ul className="lgl-rows">
                                        {documents.map(doc => (
                                            <li key={doc.slug}>
                                                <Link href={`/legal/${doc.slug}`} className="lgl-row">
                                                    <span className="lgl-row-title">{doc.title}</span>
                                                    <span className="lgl-row-purpose">{doc.purpose}</span>
                                                    {/* Audience reads as the first fact in the metadata
                                                        line, not as a coloured badge — it is information,
                                                        and a badge made it look like a status. */}
                                                    <span className="lgl-row-meta">
                                                        <span className="lgl-row-stat is-audience">
                                                            {dict.legal[doc.audience]}
                                                        </span>
                                                        <span className="lgl-row-stat">
                                                            {doc.clauses.length} {dict.legal.clauses}
                                                        </span>
                                                        <span className="lgl-row-stat">
                                                            {doc.minutes} {dict.legal.minutes}
                                                        </span>
                                                    </span>
                                                    <span className="lgl-row-arrow" aria-hidden="true">
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M5 12h14M12 5l7 7-7 7" />
                                                        </svg>
                                                    </span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )
                        })}
                    </div>
                </section>

                <section className="lgl-ask">
                    <div className="container">
                        {/* Panel inside the container, not a band across it — the
                            band relied on a rule to separate itself from the list. */}
                        <div className="lgl-ask-inner">
                            <div className="lgl-ask-copy">
                                <h2 className="lgl-ask-title">{dict.legal.cannotFind}</h2>
                                <p className="lgl-ask-note">
                                    {dict.legal.cannotFindNote}
                                </p>
                            </div>
                            <div className="lgl-ask-actions">
                                <a href={`mailto:${supportEmail}`} className="lgl-ask-primary">
                                    {supportEmail}
                                </a>
                                <Link href="/legal/grievance" className="lgl-ask-secondary">
                                    {dict.legal.fileGrievance}
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
