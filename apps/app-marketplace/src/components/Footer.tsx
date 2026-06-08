import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, Globe } from '@letbuyy/ui';
import { getAccountsUrl, getAdminUrl, getMarketingUrl, getSupportEmail, getThemeMarketplaceUrl } from '@/lib/site-url';

const footerColumns = [
    {
        title: 'App categories',
        links: [
            { label: 'Sales channels', href: '/categories/social-media' },
            { label: 'Finding products', href: '/categories/sourcing' },
            { label: 'Selling products', href: '/categories/subscriptions' },
            { label: 'Orders and shipping', href: '/categories/shipping' },
            { label: 'Store design', href: '/categories/page-builders' },
            { label: 'Marketing and conversion', href: '/categories/email-marketing' },
            { label: 'Store management', href: '/categories/analytics' },
        ],
    },
    {
        title: 'Top categories',
        links: [
            { label: 'Dropshipping', href: '/categories/dropshipping' },
            { label: 'Marketplaces', href: '/search?q=marketplaces' },
            { label: 'Product reviews', href: '/search?q=product%20reviews' },
            { label: 'Upsell and bundles', href: '/search?q=upsell%20bundles' },
            { label: 'Email marketing', href: '/categories/email-marketing' },
            { label: 'SEO', href: '/categories/seo' },
            { label: 'Shipping', href: '/categories/shipping' },
            { label: 'Currency and translation', href: '/search?q=currency%20translation' },
        ],
    },
    {
        title: 'Resources',
        links: [
            { label: 'Developer docs', href: '/developers/docs' },
            { label: 'API documentation', href: '/developers/docs/api-reference' },
            { label: 'Review requirements', href: '/developers/review-requirements' },
            { label: 'Developer portal', href: '/developers' },
            { label: 'Partner directory', href: '/partners' },
            { label: 'Support', href: 'support' },
        ],
    },
    {
        title: 'LetBuyy',
        links: [
            { label: 'About', href: 'marketing' },
            { label: 'Admin', href: 'admin' },
            { label: 'Themes', href: 'themes' },
            { label: 'Partners', href: '/partners' },
            { label: 'Developers', href: '/developers' },
            { label: 'Service status', href: 'support' },
        ],
    },
];

const advantageItems = [
    {
        title: 'Apps for every store workflow',
        body: 'Extend reviews, marketing, fulfillment, invoices, bundles, sourcing, and operations without rebuilding your store.',
    },
    {
        title: 'Reviewed before merchants install',
        body: 'Listings are checked for app scopes, billing clarity, data handling, support paths, and merchant-facing setup.',
    },
    {
        title: 'Recommendations for real growth',
        body: 'Find apps by category, compatibility, install context, and the workflows merchants need next.',
    },
];

function FooterLink({ href, label }: { href: string; label: string }) {
    if (href.startsWith('http') || href.startsWith('mailto:')) {
        return (
            <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>
                {label}
            </a>
        );
    }

    return <Link href={href}>{label}</Link>;
}

export function Footer() {
    const marketingUrl = getMarketingUrl();
    const accountsUrl = getAccountsUrl();
    const adminUrl = getAdminUrl();
    const themeMarketplaceUrl = getThemeMarketplaceUrl();
    const supportEmail = getSupportEmail();
    const resolvedColumns = footerColumns.map((column) => ({
        ...column,
        links: column.links.flatMap((link) => {
            if (link.href === 'marketing') return { ...link, href: marketingUrl };
            if (link.href === 'admin') return { ...link, href: adminUrl };
            if (link.href === 'themes') return { ...link, href: themeMarketplaceUrl };
            if (link.href === 'support') {
                return supportEmail ? { ...link, href: `mailto:${supportEmail}` } : [];
            }
            return link;
        }),
    }));

    return (
        <>
            <section className="appstore-advantage" aria-labelledby="appstore-advantage-title">
                <div className="appstore-advantage__inner">
                    <div className="appstore-advantage__left">
                        <div className="appstore-advantage__intro">
                            <h2 id="appstore-advantage-title">The LetBuyy app advantage</h2>
                            <p>LetBuyy covers the core store workflows. For everything specialized, there are marketplace apps.</p>
                        </div>
                        <a href={adminUrl} target="_blank" rel="noreferrer" className="appstore-advantage__button">
                            Start your free trial
                        </a>
                    </div>

                    <div className="appstore-advantage__list">
                        {advantageItems.map((item) => (
                            <article key={item.title} className="appstore-advantage__item">
                                <h3>{item.title}</h3>
                                <p>{item.body}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="appstore-footer">
                <div className="appstore-footer-cta">
                    <h2>Want to add an app?</h2>
                    <Link href="/developers/register" className="appstore-footer-cta__button">
                        Build for LetBuyy
                    </Link>
                </div>

                <div className="appstore-footer-inner">
                    <Link href="/" className="appstore-footer-mark" aria-label="LetBuyy App Store home">
                        <Image src="/icons/letbuyy-mark.svg" alt="" width={84} height={84} />
                    </Link>

                    <nav className="appstore-footer-links" aria-label="Footer navigation">
                        {resolvedColumns.map((column) => (
                            <div key={column.title} className="appstore-footer-col">
                                <h3>{column.title}</h3>
                                {column.links.map((link) => (
                                    <FooterLink key={`${column.title}-${link.label}`} href={link.href} label={link.label} />
                                ))}
                            </div>
                        ))}
                    </nav>
                </div>

                <div className="appstore-footer-bottom">
                    <div className="appstore-footer-legal">
                        <a href={accountsUrl} target="_blank" rel="noreferrer">Developer login</a>
                        <a href={`${marketingUrl}/terms`} target="_blank" rel="noreferrer">Terms of service</a>
                        <a href={`${marketingUrl}/privacy`} target="_blank" rel="noreferrer">Privacy policy</a>
                        <Link href="/sitemap.xml">Sitemap</Link>
                        <a href={`${marketingUrl}/privacy`} target="_blank" rel="noreferrer" className="appstore-footer-privacy">
                            Your privacy choices
                            <span aria-hidden="true">✓×</span>
                        </a>
                    </div>

                    <div className="appstore-footer-language" aria-label="Language selector">
                        <Globe size={28} aria-hidden="true" />
                        <span>English</span>
                        <ChevronDown size={18} aria-hidden="true" />
                    </div>
                </div>
            </footer>
        </>
    );
}
