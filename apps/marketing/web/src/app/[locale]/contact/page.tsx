import { localizeMetadata } from '@/lib/i18n/metadata'
import Copy from '@/components/i18n/Copy'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from '@/components/i18n/LocaleLink'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SupportIllustration from '@/components/support/SupportIllustration'
import supportStyles from '@/components/support/support-experience.module.css'
import { ArrowRight, Check, Clock, Mail } from '@letbuyy/ui'
import ContactForm from '@/components/contact/ContactForm'
import TicketLookup from '@/components/contact/TicketLookup'
import { CONTACT_TOPICS } from '@letbuyy/shared-types'
import {
    getAccountsUrl,
    getDeveloperPortalUrl,
    getMarketingSiteUrl,
    getSupportEmail,
} from '@/lib/public-urls'

const sourceMetadata: Metadata = {
    title: 'Contact LetBuyy',
    description:
        'Talk to LetBuyy — merchant support, sales, payments, GST, developer help and partnerships. Every message gets a ticket reference and a named team, with response times published up front.',
    alternates: { canonical: '/contact' },
    openGraph: {
        title: 'Contact LetBuyy',
        description:
            'One form, thirteen teams, published response times. Every message gets a ticket reference you can track.',
        url: '/contact',
    },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    return localizeMetadata(sourceMetadata, (await params).locale, "/contact")
}


/** The promise, stated once and taken straight from the catalog the form uses. */
const fastestPromise = Math.min(...CONTACT_TOPICS.map((topic) => topic.responseHours))

const assurances = [
    {
        title: 'A ticket, not a void',
        body: 'Every message gets a reference like LB-2608-000142, emailed to you and trackable on this page.',
    },
    {
        title: 'Published response times',
        body: 'Each topic carries its own promise — as fast as {hours} working hours for payments and trust-and-safety.',
    },
    {
        title: 'A person, in your language',
        body: 'We answer in English, Hindi and Tamil. Say which you prefer and that is what you will get.',
    },
]

const directChannels = [
    {
        title: 'Merchant login',
        note: 'Already selling with us and just need to get in?',
        action: getAccountsUrl('/login'),
        actionLabel: 'Sign in to your store',
        external: true,
        illustration: '/illustrations/resources/thumbnails/guide-first-store-v1.webp',
    },
    {
        title: 'Developer docs',
        note: 'API keys, webhooks, themes and app extensions.',
        action: getDeveloperPortalUrl('/docs'),
        actionLabel: 'Read the docs',
        external: true,
        illustration: '/illustrations/resources/thumbnails/developer-api-studio-v1.webp',
    },
    {
        title: 'Guides & help articles',
        note: 'Most setup questions are already answered in writing.',
        action: '/resources',
        actionLabel: 'Browse the library',
        external: false,
        illustration: '/illustrations/resources/thumbnails/reading-learning-journey-v1.webp',
    },
]

export default function ContactPage() {
    const supportEmail = getSupportEmail()
    const siteUrl = getMarketingSiteUrl()

    /* ContactPage structured data. It is what lets a search engine show the
       support email and the languages we answer in directly in the result,
       rather than making someone click through to find them. */
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: 'Contact LetBuyy',
        url: `${siteUrl}/in/contact`,
        mainEntity: {
            '@type': 'Organization',
            name: 'LetBuyy',
            url: siteUrl,
            email: supportEmail,
            contactPoint: CONTACT_TOPICS.filter((topic) =>
                ['sales', 'support', 'payments', 'trust_safety'].includes(topic.id),
            ).map((topic) => ({
                '@type': 'ContactPoint',
                contactType: topic.label,
                email: supportEmail,
                availableLanguage: ['English', 'Hindi', 'Tamil'],
                areaServed: 'IN',
            })),
        },
    }

    return (
        <>
            <Header />
            <main className={`ctc ${supportStyles.contact}`}>
                <script
                    type="application/ld+json"
                    // Serialised from a literal above — no submitted data reaches this.
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                />

                {/* ── Hero ──────────────────────────────────────────────── */}
                <section className="ctc-hero">
                    <div className="ctc-hero-glow" aria-hidden="true" />
                    <div className="container ctc-hero-inner">
                        <div>
                        <span className="ctc-eyebrow"><Copy text={"Contact"} /></span>
                        <h1 className="ctc-title">
                            <Copy text={"Talk to the people"} /><br />
                            <Copy text={"who built it."} /></h1>
                        <p className="ctc-intro">
                            <Copy text={"LetBuyy is made in India, for Indian sellers. Tell us what you need below and it goes straight to the team that owns it — with a ticket reference and a response time we publish rather than hide."} /></p>

                        <ul className="ctc-assurances">
                            {assurances.map((item) => (
                                <li key={item.title} className="ctc-assurance">
                                    <span className="ctc-assurance-tick" aria-hidden="true">
                                        <Check size={13} strokeWidth={3} />
                                    </span>
                                    <span>
                                        <strong><Copy text={item.title} /></strong>
                                        <span><Copy text={item.body} values={{ hours: fastestPromise }} /></span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <div className={supportStyles.actions}><a href="#contact-form" className={supportStyles.primary}><Copy text={"Send a message"} /><ArrowRight size={16} aria-hidden="true" /></a><Link href="/support" className={supportStyles.textLink}><Copy text={"Visit the support centre"} /><ArrowRight size={16} aria-hidden="true" /></Link></div>
                        </div>
                        <SupportIllustration kind="contact" />
                    </div>
                </section>

                {/* ── The form, with a brand rail beside it ─────────────── */}
                <section className="ctc-body">
                    <div className={`container ${supportStyles.formHeading}`}><h2><Copy text={"Tell us what you need."} /></h2><p><Copy text={"Choose a topic and send your message to the relevant team."} /></p></div>
                    <div className="container ctc-layout">
                        <aside className="ctc-aside">
                            <div className="ctc-aside-card">
                                <div className={supportStyles.asideHeading}><div><Clock size={22} strokeWidth={1.6} aria-hidden="true" /><h2 className="ctc-aside-label"><Copy text={"Response promise"} /></h2></div><Image src="/illustrations/support/support-care-studio-v1.webp" alt="" width={1536} height={1024} sizes="100px" loading="eager" unoptimized /></div>
                                <ul className="ctc-sla-list">
                                    {CONTACT_TOPICS.slice(0, 6).map((topic) => (
                                        <li key={topic.id}>
                                            <span><Copy text={topic.label} /></span>
                                            <span className="ctc-sla-value">{topic.responseHours}h</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="ctc-aside-note">
                                    <Copy text={"Working hours, Monday to Saturday. Marking a message urgent shortens the promise — it never lengthens it."} /></p>
                            </div>

                            <div className="ctc-aside-card ctc-aside-card-quiet">
                                <div className={supportStyles.asideHeading}><div><Mail size={22} strokeWidth={1.6} aria-hidden="true" /><h2 className="ctc-aside-label"><Copy text={"Prefer email?"} /></h2></div><Image src="/illustrations/resources/section-newsletter-v1.webp" alt="" width={1536} height={1024} sizes="100px" loading="eager" unoptimized /></div>
                                <a className="ctc-aside-mail" href={`mailto:${supportEmail}`}>
                                    {supportEmail}
                                </a>
                                <p className="ctc-aside-note">
                                    <Copy text={"Writing in directly works too — you will still get a ticket reference back."} /></p>
                            </div>

                            <div id="ticket-status" className={supportStyles.anchor}><TicketLookup /></div>
                        </aside>

                        <div className={`ctc-form-wrap ${supportStyles.anchor}`} id="contact-form">
                            <ContactForm />
                        </div>
                    </div>
                </section>

                {/* ── Faster routes ─────────────────────────────────────── */}
                <section className="ctc-direct">
                    <div className="container">
                        <h2 className="ctc-section-title"><Copy text={"Or skip the queue entirely"} /></h2>
                        <p className="ctc-section-sub">
                            <Copy text={"Some things are faster to do than to ask about."} /></p>
                        <div className="ctc-grid">
                            {directChannels.map((channel) => (
                                <div key={channel.title} className="ctc-card">
                                    <div className={supportStyles.directArt} aria-hidden="true"><Image src={channel.illustration} alt="" width={1536} height={1024} sizes="(max-width: 720px) 80vw, 320px" loading="eager" unoptimized /></div>
                                    <h3 className="ctc-card-title"><Copy text={channel.title} /></h3>
                                    <p className="ctc-card-note"><Copy text={channel.note} /></p>
                                    {channel.external ? (
                                        <a
                                            href={channel.action}
                                            className="ctc-card-action"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Copy text={channel.actionLabel} />
                                            <ArrowRight size={16} aria-hidden="true" />
                                        </a>
                                    ) : (
                                        <Link href={channel.action} className="ctc-card-action">
                                            <Copy text={channel.actionLabel} />
                                            <ArrowRight size={16} aria-hidden="true" />
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="ctc-foot">
                    <div className="container">
                        <p className="ctc-foot-note">
                            <Copy text={"Reporting abuse, a counterfeit listing or a security issue? Choose"} />{' '}
                            <strong><Copy text={"Trust & safety"} /></strong> <Copy text={"above — it carries our fastest response time. For data and privacy requests under the DPDP Act, see the"} />{' '}
                            <Link href="/legal/privacy"><Copy text={"privacy notice"} /></Link> <Copy text={"or pick"} />{' '}
                            <strong><Copy text={"Data & privacy"} /></strong> <Copy text={"in the form."} /></p>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
