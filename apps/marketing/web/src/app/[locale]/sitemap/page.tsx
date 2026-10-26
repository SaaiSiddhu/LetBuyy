import { localizeMetadata } from '@/lib/i18n/metadata'
import Copy from '@/components/i18n/Copy'
import { createCopy } from '@/lib/i18n/copy'
import { getLocale } from '@/lib/i18n/locales'
import { localizeLegalContent } from '@/lib/i18n/legal-content'
import type { Metadata } from 'next'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight, BookOpen, FileText } from '@letbuyy/ui'
import Link from '@/components/i18n/LocaleLink'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { CATEGORIES } from '@/lib/resources/categories'
import { getArticlesByCategory } from '@/lib/resources/utils'
import { getPlatformNavigationLinks, getPlatformSitemapUrls } from '@/lib/platform-links'
import { LEGAL_DOCUMENTS } from '@/lib/legal/documents'
import { getEditorialScene, getLearningPathArtwork } from '@/lib/resources/artwork'
import styles from './sitemap.module.css'

const sourceMetadata: Metadata = {
    title: 'LetBuyy Sitemap',
    description: 'Public sitemap for LetBuyy, including guides, themes, apps, developer docs, pricing, and account entry points.',
    alternates: {
        canonical: '/sitemap',
    },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    return localizeMetadata(sourceMetadata, (await params).locale, "/sitemap")
}


export default async function SitemapPage({ params }: { params: Promise<{ locale: string }> }) {
    const locale = getLocale((await params).locale)
    const t = createCopy(locale.language.code)
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
        { href: '/contact', label: 'Contact', note: 'Support and sales' },
        { href: '/support', label: 'Support centre', note: 'Guides, contact and ticket lookup' },
    ]

    /* Built from the category data so a new topic appears here automatically. */
    const guides = [
        { href: '/resources', label: 'All guides', note: 'Resource library' },
        ...CATEGORIES.map(cat => ({
            href: `/resources/${cat.slug}`,
            label: cat.label,
            note: t('{count} guides', { count: getArticlesByCategory(cat.slug).length }),
        })),
        { href: '/resources/changelog', label: 'Changelog', note: 'Release history' },
        { href: '/resources/releases', label: 'Releases', note: 'Version notes' },
        { href: '/resources/search', label: 'Search', note: 'Find a guide' },
    ]

    /* Generated from the library so a new policy is indexed without a second edit. */
    const legal = [
        { href: '/legal', label: 'Legal library', note: t('{count} documents', { count: LEGAL_DOCUMENTS.length }) },
        ...LEGAL_DOCUMENTS.map(source => localizeLegalContent(source, locale.language.code).document).map(doc => ({
            href: `/legal/${doc.slug}`,
            label: doc.shortTitle,
            note: doc.purpose,
        })),
    ]

    const groups = [
        { id: 'start-here', title: 'Start here', description: 'The essentials, from exploring plans to getting help.', artwork: getLearningPathArtwork('start-selling-online')!.thumbnailSrc, items: startHere },
        { id: 'guides', title: 'Guides & resources', description: 'Practical reading for every part of running a store.', artwork: getEditorialScene('learning').thumbnailSrc, items: guides },
        { id: 'platform', title: 'Platform', description: 'Guides and account entry points across LetBuyy.', artwork: '/illustrations/surfaces/surface-apps-v1.webp', items: crossProperty.map(link => ({ href: link.href, label: link.label, note: link.description })) },
        { id: 'legal', title: 'Legal', description: 'Policies, responsibilities and trust information.', artwork: '/illustrations/support/grievance-care-studio-v1.webp', items: legal },
    ]
    const totalLinks = groups.reduce((total, group) => total + group.items.length, 0)

    return (
        <>
            <Header />
            <main className={styles.page}>
                <header className={styles.hero}>
                    <div className={`container ${styles.heroLayout}`}>
                        <div>
                        <p className={styles.eyebrow}><BookOpen size={16} aria-hidden="true" /><Copy text={"THE PUBLIC DIRECTORY"} /></p>
                        <h1><Copy text={"Every page"} /><br /><span><Copy text={"on LetBuyy."} /></span></h1>
                        <p className={styles.intro}>
                            <Copy text={"A complete, crawlable index of the LetBuyy marketing site, guide library and connected platform properties."} /></p>
                        <dl className={styles.facts}><div><dt><Copy text={"Directory links"} /></dt><dd>{totalLinks}</dd></div><div><dt><Copy text={"Sections"} /></dt><dd>{groups.length}</dd></div><div><dt><Copy text={"XML feeds"} /></dt><dd>{sitemapUrls.length}</dd></div></dl>
                        <a href="#directory-sections" className={styles.heroAction}><Copy text={"Explore the directory"} /><ArrowRight size={17} aria-hidden="true" /></a>
                        </div>
                        <div className={styles.heroArt} aria-hidden="true"><Image src="/illustrations/sitemap-directory-studio-v1.webp" alt="" width={1536} height={1024} sizes="(max-width: 760px) 90vw, 500px" loading="eager" unoptimized /></div>
                    </div>
                </header>
                <div className="container">
                    <nav className={styles.jumpNav} aria-label="Jump to a sitemap section">{groups.map((group, index) => <a key={group.id} href={`#${group.id}`} className={styles.jumpLink}><Image src={group.artwork} alt="" width={100} height={80} sizes="72px" loading="eager" unoptimized /><span><small>0{index + 1}</small><strong>{t(group.title)}</strong><span>{group.items.length} <Copy text={"links"} /></span></span><ArrowRight size={16} aria-hidden="true" /></a>)}</nav>
                    <div id="directory-sections" className={styles.directory}>
                        {groups.map((group, index) => <section key={group.id} id={group.id} className={styles.group} aria-labelledby={`${group.id}-title`}>
                            <header className={styles.groupHead}><span className={styles.groupIndex}>0{index + 1}</span><Image src={group.artwork} alt="" width={160} height={110} sizes="160px" loading="eager" unoptimized /><h2 id={`${group.id}-title`}>{t(group.title)}<span>{group.items.length}</span></h2><p>{t(group.description)}</p></header>
                            <ul className={styles.list}>{group.items.map(item => <li key={item.href}><Link href={item.href} className={styles.link} data-directory-link><span><strong>{t(item.label)}</strong><span>{t(item.note)}</span></span>{item.href.startsWith('http') ? <ArrowUpRight size={17} aria-label="Another LetBuyy property" /> : <ArrowRight size={17} aria-hidden="true" />}</Link></li>)}</ul>
                        </section>)}
                    </div>
                </div>
                <section className={styles.machine} aria-labelledby="machine-readable-title">
                    <div className="container">
                        <div className={styles.machineHead}><FileText size={24} aria-hidden="true" /><div><p className={styles.eyebrow}><Copy text={"FOR INDEXING TOOLS"} /></p><h2 id="machine-readable-title"><Copy text={"Machine-readable"} /><span>{sitemapUrls.length + 1}</span></h2></div></div>
                        <p className={styles.machineNote}>
                            <Copy text={"For crawlers and indexing tools."} /></p>
                        <ul className={styles.feeds}>
                            {sitemapUrls.map(href => (
                                <li key={href}>
                                    <Link href={href} className={styles.feed} data-directory-feed><span>{href}</span><ArrowUpRight size={16} aria-hidden="true" /></Link>
                                </li>
                            ))}
                            <li>
                                <Link href="/robots.txt" className={styles.feed} data-directory-feed><span>/robots.txt</span><ArrowRight size={16} aria-hidden="true" /></Link>
                            </li>
                        </ul>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
