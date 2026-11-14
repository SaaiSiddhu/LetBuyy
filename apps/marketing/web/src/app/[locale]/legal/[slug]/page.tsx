import { localizeMetadata } from '@/lib/i18n/metadata'
import type { Metadata } from 'next'
import Link from '@/components/i18n/LocaleLink'
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
import { LEGAL_REVISION_DATE } from '@/lib/legal/entity'
import { clauseNumber, formatLegalDate } from '@/lib/legal/format'
import { getSupportEmail } from '@/lib/public-urls'
import { getLocale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n'
import UntranslatedNotice from '@/components/i18n/UntranslatedNotice'
import { ArrowRight, ShieldCheck, CreditCard, KeyRound } from '@letbuyy/ui'
import SupportIllustration from '@/components/support/SupportIllustration'
import supportStyles from '@/components/support/support-experience.module.css'
import legalStyles from '@/components/legal/legal-layout.module.css'
import { localizeLegalContent } from '@/lib/i18n/legal-content'

/* Only the slug — the locale segment is supplied by the parent [locale]
   layout's generateStaticParams, and Next takes the cross product. */
export function generateStaticParams() {
    return LEGAL_DOCUMENTS.map(doc => ({ slug: doc.slug }))
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
    const { locale: segment, slug } = await params
    const source = getLegalDocument(slug)
    if (!source) return {}

    const locale = getLocale(segment)
    const { document: doc } = localizeLegalContent(source, locale.language.code)

    return localizeMetadata({
        title: doc.title,
        description: doc.purpose,
    }, segment, `/legal/${doc.slug}`)
}

export default async function LegalDocumentPage({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>
}) {
    const { locale: segment, slug } = await params
    const source = getLegalDocument(slug)
    if (!source) notFound()

    const locale = getLocale(segment)
    const dict = getDictionary(locale)
    const { document: doc, translated } = localizeLegalContent(source, locale.language.code)
    const contentLang = translated ? locale.language.bcp47 : 'en'

    const { previous, next } = getAdjacentDocuments(doc.slug)
    const supportEmail = getSupportEmail()
    const isGrievance = doc.slug === 'grievance'
    const isSecurity = doc.slug === 'security'
    const isIllustrated = isGrievance || isSecurity

    return (
        <>
            <Header />
            <main className={`lgl-doc ${legalStyles.document}${isIllustrated ? ` ${supportStyles.page}` : ''}`}>
                <nav className="lgl-crumbs" aria-label="Breadcrumb">
                    <div className="container lgl-crumbs-inner">
                        <Link href="/legal">{dict.legal.title}</Link>
                        <span aria-hidden="true">/</span>
                        <span className="lgl-crumbs-group">{dict.legal[doc.group]}</span>
                        <span aria-hidden="true">/</span>
                        <span className="lgl-crumbs-current" lang={contentLang}>{doc.shortTitle}</span>
                    </div>
                </nav>

                <header className="lgl-doc-head">
                    <div className={`container${isIllustrated ? ` ${supportStyles.hero}` : ''}`}>
                        <div>
                        <h1 className="lgl-doc-title" lang={contentLang}>{doc.title}</h1>
                        <p className="lgl-doc-purpose" lang={contentLang}>{doc.purpose}</p>

                        <dl className="lgl-facts">
                            <div>
                                <dt>{dict.legal.appliesTo}</dt>
                                <dd>{dict.legal[doc.audience]}</dd>
                            </div>
                            <div>
                                <dt>{dict.legal.clauses}</dt>
                                <dd>{doc.clauses.length}</dd>
                            </div>
                            <div>
                                <dt>{dict.legal.readingTime}</dt>
                                <dd>{readingMinutes(source)} {dict.legal.minutes}</dd>
                            </div>
                            <div>
                                <dt>{dict.legal.revised}</dt>
                                <dd>{formatLegalDate(LEGAL_REVISION_DATE, locale.hreflang)}</dd>
                            </div>
                        </dl>
                        {isGrievance && <div className={supportStyles.actions}><a href="#how" className={supportStyles.primary}>{dict.legal.howToRaise}<ArrowRight size={16} aria-hidden="true" /></a><Link href="/support" className={supportStyles.textLink}>{dict.legal.getSupport}<ArrowRight size={16} aria-hidden="true" /></Link></div>}
                        {isSecurity && <div className={supportStyles.actions}><a href="#reporting" className={supportStyles.primary}>{dict.legal.reportVulnerability}<ArrowRight size={16} aria-hidden="true" /></a><Link href="/support" className={supportStyles.textLink}>{dict.legal.supportCentre}<ArrowRight size={16} aria-hidden="true" /></Link></div>}
                        </div>
                        {isGrievance && <SupportIllustration kind="grievance" />}
                        {isSecurity && <SupportIllustration kind="security" />}
                    </div>
                </header>

                <LegalStatusBanner dict={dict} locale={locale.hreflang} />

                <div className="container lgl-doc-body">
                    <LegalContents clauses={doc.clauses} />

                    <article className="lgl-doc-main">
                        {translated ? <aside className="i18n-notice" role="note"><div className="i18n-notice-text"><strong>{dict.legal.translationTitle}</strong><p>{dict.legal.translationBody} <a href={`/in/legal/${doc.slug}`}>{dict.legal.viewEnglish}</a></p></div></aside> : <UntranslatedNotice locale={locale} dict={dict} variant="legal" />}

                        {isSecurity && <nav className={supportStyles.securityTopics} aria-label={doc.title}>
                            {[{ id: 'isolation', Icon: ShieldCheck }, { id: 'money', Icon: CreditCard }, { id: 'auth', Icon: KeyRound }].map(({ id, Icon }) => <a href={`#${id}`} key={id}><Icon size={24} strokeWidth={1.6} aria-hidden="true" /><span>{doc.clauses.find(clause => clause.id === id)?.heading}</span><ArrowRight size={16} aria-hidden="true" /></a>)}
                        </nav>}

                        <section className="lgl-brief" aria-labelledby="lgl-brief-title">
                            <h2 id="lgl-brief-title" className="lgl-brief-title">
                                {dict.legal.inShort}
                            </h2>
                            <ul className="lgl-brief-list" lang={contentLang}>
                                {doc.summary.map(line => (
                                    <li key={line}>{line}</li>
                                ))}
                            </ul>
                            <p className="lgl-brief-caveat">
                                {dict.legal.inShortCaveat}
                            </p>
                        </section>

                        {doc.slug === 'grievance' && <GrievanceOfficerCard dict={dict} />}

                        <ol className="lgl-clauses" lang={contentLang}>
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
                                                <span className="lgl-clause-note-label">{dict.legal.note}</span>
                                                {clause.note}
                                            </p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ol>

                        <section className="lgl-doc-contact">
                            <h2 className="lgl-doc-contact-title">{dict.legal.questionsTitle}</h2>
                            <p>
                                {dict.legal.contactBefore} <a href={`mailto:${supportEmail}`}>{supportEmail}</a> {dict.legal.contactAfter}{' '}
                                <Link href="/legal/grievance">{dict.legal.grievanceProcess}</Link>.
                            </p>
                        </section>

                        <nav className="lgl-pager" aria-label={dict.legal.otherDocuments}>
                            {previous ? (
                                <Link href={`/legal/${previous.slug}`} className="lgl-pager-link is-prev">
                                    <span className="lgl-pager-dir">{dict.legal.previous}</span>
                                    <span className="lgl-pager-title">{localizeLegalContent(previous, locale.language.code).document.title}</span>
                                </Link>
                            ) : (
                                <span />
                            )}
                            {next && (
                                <Link href={`/legal/${next.slug}`} className="lgl-pager-link is-next">
                                    <span className="lgl-pager-dir">{dict.legal.next}</span>
                                    <span className="lgl-pager-title">{localizeLegalContent(next, locale.language.code).document.title}</span>
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
