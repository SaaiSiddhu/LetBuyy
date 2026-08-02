import type { Metadata } from 'next'
import Link from 'next/link'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { CATEGORIES } from '@/lib/resources/categories'
import { getArticlesByCategory } from '@/lib/resources/utils'
import { getPlatformNavigationLinks, getPlatformSitemapUrls } from '@/lib/platform-links'

export const metadata: Metadata = {
    title: 'LetBuyy Sitemap',
    description: 'Public sitemap for LetBuyy, including guides, themes, apps, developer docs, pricing, and account entry points.',
    alternates: {
        canonical: '/sitemap',
    },
}

export default function SitemapPage() {
    const platformLinks = getPlatformNavigationLinks()
    const sitemapUrls = getPlatformSitemapUrls()

    /* Cross-property destinations only — the marketing pages they duplicate
       (home, pricing) are listed under "Start here" instead. */
    const crossProperty = platformLinks.filter(
        link => link.label !== 'LetBuyy' && link.label !== 'Pricing',
    )

    const startHere = [
        { href: '/', label: 'Home', note: 'Platform overview' },
        { href: '/pricing', label: 'Pricing', note: 'Plans and commission' },
        { href: '/create', label: 'Start a store', note: 'Claim your subdomain' },
        { href: '/signup', label: 'Create account', note: 'Merchant sign-up' },
    ]

    /* Built from the category data so a new topic appears here automatically. */
    const guides = [
        { href: '/resources', label: 'All guides', note: 'Resource library' },
        ...CATEGORIES.map(cat => ({
            href: `/resources/${cat.slug}`,
            label: cat.label,
            note: `${getArticlesByCategory(cat.slug).length} guides`,
        })),
        { href: '/resources/changelog', label: 'Changelog', note: 'Release history' },
        { href: '/resources/releases', label: 'Releases', note: 'Version notes' },
        { href: '/resources/search', label: 'Search', note: 'Find a guide' },
    ]

    const totalPages = startHere.length + guides.length + crossProperty.length

    return (
        <>
            <Header />
            <main className="smap">
                <section className="smap-hero">
                    <div className="container">
                        <h1 className="smap-title">Every page on LetBuyy</h1>
                        <p className="smap-intro">
                            A complete, crawlable index of the LetBuyy marketing site, guide library and
                            connected platform properties.
                        </p>
                        <p className="smap-count">
                            <strong>{totalPages}</strong> pages · <strong>3</strong> sections ·{' '}
                            <strong>{sitemapUrls.length}</strong> XML feeds
                        </p>
                    </div>
                </section>

                <section className="smap-index">
                    <div className="container smap-columns">

                        <section className="smap-group">
                            <h2 className="smap-group-title">
                                Start here
                                <span className="smap-group-count">{startHere.length}</span>
                            </h2>
                            <ul className="smap-list">
                                {startHere.map(item => (
                                    <li key={item.href}>
                                        <Link href={item.href} className="smap-link">
                                            <span className="smap-link-label">{item.label}</span>
                                            <span className="smap-link-note">{item.note}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="smap-group smap-group-wide">
                            <h2 className="smap-group-title">
                                Guides &amp; resources
                                <span className="smap-group-count">{guides.length}</span>
                            </h2>
                            <ul className="smap-list">
                                {guides.map(item => (
                                    <li key={item.href}>
                                        <Link href={item.href} className="smap-link">
                                            <span className="smap-link-label">{item.label}</span>
                                            <span className="smap-link-note">{item.note}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="smap-group">
                            <h2 className="smap-group-title">
                                Platform
                                <span className="smap-group-count">{crossProperty.length}</span>
                            </h2>
                            <ul className="smap-list">
                                {crossProperty.map(link => (
                                    <li key={link.label}>
                                        <Link href={link.href} className="smap-link">
                                            <span className="smap-link-label">
                                                {link.label}
                                                <span className="smap-ext" aria-label="opens another LetBuyy property">↗</span>
                                            </span>
                                            <span className="smap-link-note">{link.description}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>

                    </div>
                </section>

                <section className="smap-machine">
                    <div className="container">
                        <h2 className="smap-group-title">
                            Machine-readable
                            <span className="smap-group-count">{sitemapUrls.length + 1}</span>
                        </h2>
                        <p className="smap-machine-note">
                            For crawlers and indexing tools.
                        </p>
                        <ul className="smap-feeds">
                            {sitemapUrls.map(href => (
                                <li key={href}>
                                    <Link href={href} className="smap-feed">{href}</Link>
                                </li>
                            ))}
                            <li>
                                <Link href="/robots.txt" className="smap-feed">/robots.txt</Link>
                            </li>
                        </ul>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
