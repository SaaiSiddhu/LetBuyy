import type { Metadata } from 'next'
import Link from '@/components/i18n/LocaleLink'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import {
    getAccountsUrl,
    getDeveloperPortalUrl,
    getSupportEmail,
} from '@/lib/public-urls'

export const metadata: Metadata = {
    title: 'Contact LetBuyy',
    description:
        'Get in touch with LetBuyy — merchant support, sales enquiries, developer help, and account access for Indian sellers.',
    alternates: { canonical: '/contact' },
}

export default function ContactPage() {
    const supportEmail = getSupportEmail()

    const channels = [
        {
            title: 'Merchant support',
            note: 'Questions about your store, orders, payments or GST.',
            action: `mailto:${supportEmail}`,
            actionLabel: supportEmail,
            external: true,
        },
        {
            title: 'Sales',
            note: 'Pricing, migration from another platform, or a larger catalogue.',
            action: `mailto:${supportEmail}`,
            actionLabel: supportEmail,
            external: true,
        },
        {
            title: 'Developers',
            note: 'API keys, webhooks, apps and theme development.',
            action: getDeveloperPortalUrl('/docs'),
            actionLabel: 'Developer docs',
            external: true,
        },
        {
            title: 'Account access',
            note: 'Trouble signing in to an existing store.',
            action: getAccountsUrl('/login'),
            actionLabel: 'Merchant login',
            external: true,
        },
    ]

    return (
        <>
            <Header />
            <main className="ctc">
                <section className="ctc-hero">
                    <div className="container">
                        <h1 className="ctc-title">Talk to us</h1>
                        <p className="ctc-intro">
                            LetBuyy is built in India, for Indian sellers. Whichever route you take below
                            reaches a person — we answer in English and Hindi.
                        </p>
                    </div>
                </section>

                <section className="ctc-body">
                    <div className="container ctc-grid">
                        {channels.map(channel => (
                            <div key={channel.title} className="ctc-card">
                                <h2 className="ctc-card-title">{channel.title}</h2>
                                <p className="ctc-card-note">{channel.note}</p>
                                <a
                                    href={channel.action}
                                    className="ctc-card-action"
                                    {...(channel.action.startsWith('http')
                                        ? { target: '_blank', rel: 'noopener noreferrer' }
                                        : {})}
                                >
                                    {channel.actionLabel}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </a>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="ctc-foot">
                    <div className="container">
                        <p className="ctc-foot-note">
                            Looking for something else? Try the{' '}
                            <Link href="/resources">guide library</Link>, the{' '}
                            <Link href="/pricing">pricing page</Link>, or the{' '}
                            <Link href="/sitemap">full site index</Link>.
                        </p>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
