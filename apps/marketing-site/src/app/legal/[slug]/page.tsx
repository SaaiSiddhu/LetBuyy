import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import LegalStatusBanner from '@/components/legal/LegalStatusBanner'
import LegalContents from '@/components/legal/LegalContents'
import GrievanceOfficerCard from '@/components/legal/GrievanceOfficerCard'
import {
    LEGAL_DOCUMENTS,
    getAdjacentDocuments,
    getLegalDocument,
    readingMinutes,
} from '@/lib/legal/documents'
import { AUDIENCE_LABEL, GROUP_META } from '@/lib/legal/types'
import { LEGAL_REVISION_DATE } from '@/lib/legal/entity'
import { clauseNumber, formatLegalDate } from '@/lib/legal/format'
import { getSupportEmail } from '@/lib/public-urls'

export function generateStaticParams() {
    return LEGAL_DOCUMENTS.map(doc => ({ slug: doc.slug }))
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>
}): Promise<Metadata> {
    const { slug } = await params
    const doc = getLegalDocument(slug)
    if (!doc) return {}

    return {
        title: doc.title,
        description: doc.purpose,
        alternates: { canonical: `/legal/${doc.slug}` },
    }
}

export default async function LegalDocumentPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const doc = getLegalDocument(slug)
    if (!doc) notFound()

    const { previous, next } = getAdjacentDocuments(doc.slug)
    const supportEmail = getSupportEmail()

    return (
        <>
            <Header />
            <main className="lgl-doc">
                <nav className="lgl-crumbs" aria-label="Breadcrumb">
                    <div className="container lgl-crumbs-inner">
                        <Link href="/legal">Legal</Link>
                        <span aria-hidden="true">/</span>
                        <span className="lgl-crumbs-group">{GROUP_META[doc.group].label}</span>
                        <span aria-hidden="true">/</span>
                        <span className="lgl-crumbs-current">{doc.shortTitle}</span>
                    </div>
                </nav>

                <header className="lgl-doc-head">
                    <div className="container">
                        <h1 className="lgl-doc-title">{doc.title}</h1>
                        <p className="lgl-doc-purpose">{doc.purpose}</p>

                        <dl className="lgl-facts">
                            <div>
                                <dt>Applies to</dt>
                                <dd>{AUDIENCE_LABEL[doc.audience]}</dd>
                            </div>
                            <div>
                                <dt>Clauses</dt>
                                <dd>{doc.clauses.length}</dd>
                            </div>
                            <div>
                                <dt>Reading time</dt>
                                <dd>{readingMinutes(doc)} min</dd>
                            </div>
                            <div>
                                <dt>Revised</dt>
                                <dd>{formatLegalDate(LEGAL_REVISION_DATE)}</dd>
                            </div>
                        </dl>
                    </div>
                </header>

                <LegalStatusBanner />

                <div className="container lgl-doc-body">
                    <LegalContents clauses={doc.clauses} />

                    <article className="lgl-doc-main">
                        <section className="lgl-brief" aria-labelledby="lgl-brief-title">
                            <h2 id="lgl-brief-title" className="lgl-brief-title">
                                In short
                            </h2>
                            <ul className="lgl-brief-list">
                                {doc.summary.map(line => (
                                    <li key={line}>{line}</li>
                                ))}
                            </ul>
                            <p className="lgl-brief-caveat">
                                This summary is written to be understood. The clauses below are what actually
                                applies — where the two differ, the clauses govern.
                            </p>
                        </section>

                        {doc.slug === 'grievance' && <GrievanceOfficerCard />}

                        <ol className="lgl-clauses">
                            {doc.clauses.map((clause, index) => (
                                <li key={clause.id} id={clause.id} className="lgl-clause">
                                    <span className="lgl-clause-num" aria-hidden="true">
                                        {clauseNumber(index)}
                                    </span>
                                    <div className="lgl-clause-body">
                                        <h2 className="lgl-clause-heading">{clause.heading}</h2>
                                        {clause.body.map(paragraph => (
                                            <p key={paragraph} className="lgl-clause-p">
                                                {paragraph}
                                            </p>
                                        ))}

                                        {clause.list && (
                                            <ul className="lgl-clause-list">
                                                {clause.list.map(item => (
                                                    <li key={item}>{item}</li>
                                                ))}
                                            </ul>
                                        )}

                                        {clause.note && (
                                            <p className="lgl-clause-note">
                                                <span className="lgl-clause-note-label">Note</span>
                                                {clause.note}
                                            </p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ol>

                        <section className="lgl-doc-contact">
                            <h2 className="lgl-doc-contact-title">Questions about this document</h2>
                            <p>
                                Write to <a href={`mailto:${supportEmail}`}>{supportEmail}</a> and quote the
                                clause number. For a complaint rather than a question, use the{' '}
                                <Link href="/legal/grievance">grievance process</Link>.
                            </p>
                        </section>

                        <nav className="lgl-pager" aria-label="Other legal documents">
                            {previous ? (
                                <Link href={`/legal/${previous.slug}`} className="lgl-pager-link is-prev">
                                    <span className="lgl-pager-dir">Previous</span>
                                    <span className="lgl-pager-title">{previous.title}</span>
                                </Link>
                            ) : (
                                <span />
                            )}
                            {next && (
                                <Link href={`/legal/${next.slug}`} className="lgl-pager-link is-next">
                                    <span className="lgl-pager-dir">Next</span>
                                    <span className="lgl-pager-title">{next.title}</span>
                                </Link>
                            )}
                        </nav>
                    </article>
                </div>
            </main>
            <Footer />
        </>
    )
}
