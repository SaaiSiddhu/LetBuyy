import type { Metadata } from 'next'
import Link from 'next/link'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { getPlatformNavigationLinks, getPlatformSitemapUrls } from '@/lib/platform-links'

export const metadata: Metadata = {
    title: 'LetBuyy Sitemap',
    description: 'Public sitemap for LetBuyy, including themes, apps, developer docs, pricing, and account entry points.',
    alternates: {
        canonical: '/sitemap',
    },
}

export default function SitemapPage() {
    const navigationLinks = getPlatformNavigationLinks()
    const sitemapUrls = getPlatformSitemapUrls()

    return (
        <>
            <Header />
            <main className="sitemap-page">
                <section className="sitemap-hero" aria-labelledby="sitemap-title">
                    <div className="container">
                        <p className="section-eyebrow">Public sitemap</p>
                        <h1 id="sitemap-title" className="sitemap-title">
                            LetBuyy platform links
                        </h1>
                        <p className="sitemap-intro">
                            The main crawlable entry points for LetBuyy commerce, themes, app marketplace, developer docs, and merchant account access.
                        </p>
                    </div>
                </section>

                <section className="sitemap-directory" aria-label="LetBuyy public navigation">
                    <div className="container sitemap-directory-grid">
                        {navigationLinks.map((link) => (
                            <article key={link.label} className="sitemap-directory-card">
                                <h2>{link.label}</h2>
                                <p>{link.description}</p>
                                <Link href={link.href}>Open {link.label}</Link>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="sitemap-xml-list" aria-labelledby="sitemap-xml-title">
                    <div className="container">
                        <h2 id="sitemap-xml-title">XML sitemaps</h2>
                        <ul>
                            {sitemapUrls.map((href) => (
                                <li key={href}>
                                    <Link href={href}>{href}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
