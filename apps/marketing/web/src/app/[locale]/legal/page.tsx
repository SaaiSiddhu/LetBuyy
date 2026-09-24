import type { Metadata } from 'next'
import Link from '@/components/i18n/LocaleLink'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import LegalStatusBanner from '@/components/legal/LegalStatusBanner'
import { GROUP_ORDER, LEGAL_DOCUMENTS, getDocumentsByGroup, readingMinutes } from '@/lib/legal/documents'
import { AUDIENCE_LABEL, GROUP_META } from '@/lib/legal/types'
import { LEGAL_REVISION_DATE } from '@/lib/legal/entity'
import { formatLegalDate } from '@/lib/legal/format'
import { getSupportEmail } from '@/lib/public-urls'

export const metadata: Metadata = {
    title: 'Legal',
    description:
        'LetBuyy legal library — terms of service, privacy, refunds, shipping, payouts, data processing, sub-processors, security, and grievance redressal for Indian merchants and shoppers.',
    alternates: { canonical: '/legal' },
}

export default function LegalHubPage() {
    const supportEmail = getSupportEmail()

    return (
        <>
            <Header />
            <main className="lgl-hub">
                <section className="lgl-masthead">
                    <div className="container">
                        <div className="lgl-masthead-grid">
                            <div className="lgl-masthead-lead">
                                <h1 className="lgl-masthead-title">Legal</h1>
                                <p className="lgl-masthead-intro">
                                    Every agreement, policy and disclosure that governs LetBuyy — written to be
                                    read, not to be survived. One page per subject, plain language at the top of
                                    each, and the exact clause underneath.
                                </p>
                            </div>

                            {/* Same borderless fact list the document head uses —
                                label over value, held apart by space. */}
                            <dl className="lgl-facts">
                                <div>
                                    <dt>Documents</dt>
                                    <dd>{LEGAL_DOCUMENTS.length}</dd>
                                </div>
                                <div>
                                    <dt>Revised</dt>
                                    <dd>{formatLegalDate(LEGAL_REVISION_DATE)}</dd>
                                </div>
                                <div>
                                    <dt>Jurisdiction</dt>
                                    <dd>India</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </section>

                <LegalStatusBanner />

                <section className="lgl-shelves">
                    <div className="container">
                        {GROUP_ORDER.map((group, groupIndex) => {
                            const documents = getDocumentsByGroup(group)
                            const meta = GROUP_META[group]

                            return (
                                <section key={group} className="lgl-shelf" aria-labelledby={`shelf-${group}`}>
                                    <header className="lgl-shelf-head">
                                        <span className="lgl-shelf-index" aria-hidden="true">
                                            {String(groupIndex + 1).padStart(2, '0')}
                                        </span>
                                        <div className="lgl-shelf-titles">
                                            <h2 id={`shelf-${group}`} className="lgl-shelf-title">
                                                {meta.label}
                                            </h2>
                                            <p className="lgl-shelf-blurb">{meta.blurb}</p>
                                        </div>
                                        <span className="lgl-shelf-count">{documents.length}</span>
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
                                                            {AUDIENCE_LABEL[doc.audience]}
                                                        </span>
                                                        <span className="lgl-row-stat">
                                                            {doc.clauses.length} clauses
                                                        </span>
                                                        <span className="lgl-row-stat">
                                                            {readingMinutes(doc)} min
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
                                <h2 className="lgl-ask-title">Can&rsquo;t find what you need?</h2>
                                <p className="lgl-ask-note">
                                    If a policy does not answer your question, ask us rather than guessing. We
                                    would rather write a clearer clause than argue about an unclear one.
                                </p>
                            </div>
                            <div className="lgl-ask-actions">
                                <a href={`mailto:${supportEmail}`} className="lgl-ask-primary">
                                    {supportEmail}
                                </a>
                                <Link href="/legal/grievance" className="lgl-ask-secondary">
                                    File a grievance
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
