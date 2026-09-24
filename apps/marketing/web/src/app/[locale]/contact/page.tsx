import type { Metadata } from 'next'
import Link from '@/components/i18n/LocaleLink'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ContactForm from '@/components/contact/ContactForm'
import TicketLookup from '@/components/contact/TicketLookup'
import { CONTACT_TOPICS } from '@letbuyy/shared-types'
import {
    getAccountsUrl,
    getDeveloperPortalUrl,
    getMarketingSiteUrl,
    getSupportEmail,
} from '@/lib/public-urls'

export const metadata: Metadata = {
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

/** The promise, stated once and taken straight from the catalog the form uses. */
const fastestPromise = Math.min(...CONTACT_TOPICS.map((topic) => topic.responseHours))

const assurances = [
    {
        title: 'A ticket, not a void',
        body: 'Every message gets a reference like LB-2608-000142, emailed to you and trackable on this page.',
    },
    {
        title: 'Published response times',
        body: `Each topic carries its own promise — as fast as ${fastestPromise} working hours for payments and trust-and-safety.`,
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
    },
    {
        title: 'Developer docs',
        note: 'API keys, webhooks, themes and app extensions.',
        action: getDeveloperPortalUrl('/docs'),
        actionLabel: 'Read the docs',
        external: true,
    },
    {
        title: 'Guides & help articles',
        note: 'Most setup questions are already answered in writing.',
        action: '/resources',
        actionLabel: 'Browse the library',
        external: false,
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
            <main className="ctc">
                <script
                    type="application/ld+json"
                    // Serialised from a literal above — no submitted data reaches this.
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                />

                {/* ── Hero ──────────────────────────────────────────────── */}
                <section className="ctc-hero">
                    <div className="ctc-hero-glow" aria-hidden="true" />
                    <div className="container ctc-hero-inner">
                        <span className="ctc-eyebrow">Contact</span>
                        <h1 className="ctc-title">
                            Talk to the people
                            <br />
                            who built it.
                        </h1>
                        <p className="ctc-intro">
                            LetBuyy is made in India, for Indian sellers. Tell us what you need below
                            and it goes straight to the team that owns it — with a ticket reference
                            and a response time we publish rather than hide.
                        </p>

                        <ul className="ctc-assurances">
                            {assurances.map((item) => (
                                <li key={item.title} className="ctc-assurance">
                                    <span className="ctc-assurance-tick" aria-hidden="true">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg>
                                    </span>
                                    <span>
                                        <strong>{item.title}</strong>
                                        <span>{item.body}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* ── The form, with a brand rail beside it ─────────────── */}
                <section className="ctc-body">
                    <div className="container ctc-layout">
                        <aside className="ctc-aside">
                            <div className="ctc-aside-card">
                                <span className="ctc-aside-label">Response promise</span>
                                <ul className="ctc-sla-list">
                                    {CONTACT_TOPICS.slice(0, 6).map((topic) => (
                                        <li key={topic.id}>
                                            <span>{topic.label}</span>
                                            <span className="ctc-sla-value">{topic.responseHours}h</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="ctc-aside-note">
                                    Working hours, Monday to Saturday. Marking a message urgent
                                    shortens the promise — it never lengthens it.
                                </p>
                            </div>

                            <div className="ctc-aside-card ctc-aside-card-quiet">
                                <span className="ctc-aside-label">Prefer email?</span>
                                <a className="ctc-aside-mail" href={`mailto:${supportEmail}`}>
                                    {supportEmail}
                                </a>
                                <p className="ctc-aside-note">
                                    Writing in directly works too — you will still get a ticket
                                    reference back.
                                </p>
                            </div>

                            <TicketLookup />
                        </aside>

                        <div className="ctc-form-wrap">
                            <ContactForm />
                        </div>
                    </div>
                </section>

                {/* ── Faster routes ─────────────────────────────────────── */}
                <section className="ctc-direct">
                    <div className="container">
                        <h2 className="ctc-section-title">Or skip the queue entirely</h2>
                        <p className="ctc-section-sub">
                            Some things are faster to do than to ask about.
                        </p>
                        <div className="ctc-grid">
                            {directChannels.map((channel) => (
                                <div key={channel.title} className="ctc-card">
                                    <h3 className="ctc-card-title">{channel.title}</h3>
                                    <p className="ctc-card-note">{channel.note}</p>
                                    {channel.external ? (
                                        <a
                                            href={channel.action}
                                            className="ctc-card-action"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {channel.actionLabel}
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M5 12h14M12 5l7 7-7 7" />
                                            </svg>
                                        </a>
                                    ) : (
                                        <Link href={channel.action} className="ctc-card-action">
                                            {channel.actionLabel}
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M5 12h14M12 5l7 7-7 7" />
                                            </svg>
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
                            Reporting abuse, a counterfeit listing or a security issue? Choose{' '}
                            <strong>Trust &amp; safety</strong> above — it carries our fastest
                            response time. For data and privacy requests under the DPDP Act, see the{' '}
                            <Link href="/legal/privacy">privacy notice</Link> or pick{' '}
                            <strong>Data &amp; privacy</strong> in the form.
                        </p>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
