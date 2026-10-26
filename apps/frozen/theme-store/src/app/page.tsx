import Link from 'next/link';
import { ArrowRight, Check, EmptyState, Palette, Search, ShieldCheck, Input, Button } from '@letbuyy/ui';
import ThemeCard from '@/components/theme-card';
import ThemeStyleGallery from '@/components/theme-style-gallery';
import { ThemeService } from '@/lib/theme-service';
import { normalizeThemeRecord } from '@/lib/theme-catalog';
import MarketplaceUnavailable from '@/components/marketplace-unavailable';
import MarketplaceHomeResources from '@/components/marketplace-home-resources';
import ThemeShowcase from '@/components/theme-showcase';
import MarketplaceArtwork from '@/components/marketplace-artwork';

const CATEGORIES = [
    { slug: 'store', label: 'Online stores' },
    { slug: 'portfolio', label: 'Portfolios' },
    { slug: 'landing', label: 'Landing pages' },
    { slug: 'resume', label: 'Resumes' },
    { slug: 'saas', label: 'SaaS' },
];

export default async function HomePage() {
    const [featuredResult, recentResult] = await Promise.all([
        ThemeService.listThemes({ sort: 'popular', limit: 8 }),
        ThemeService.listThemes({ sort: 'recent', limit: 4 }),
    ]);
    const featured = featuredResult.ok ? featuredResult.value.themes.map(normalizeThemeRecord) : [];
    const featuredIds = new Set(featured.map(theme => theme.id));
    const recent = recentResult.ok ? recentResult.value.themes.map(normalizeThemeRecord).filter(theme => !featuredIds.has(theme.id)) : [];

    return (
        <div className="marketplace marketplace-home">
            <ThemeShowcase />
            <section className="marketplace-hero">
                <div className="marketplace-container">
                    <p className="marketplace-eyebrow"><Palette size={16} aria-hidden="true" /> LetBuyy Theme Store</p>
                    <div className="marketplace-hero-layout">
                        <div>
                            <h1>Make your business <span>look like you.</span></h1>
                            <p className="marketplace-intro">Find a theme that fits your next chapter. Explore the design, try the demo, and make it your own with LetBuyy.</p>
                            <form action="/themes" method="get" className="marketplace-hero-search" role="search">
                                <label className="sr-only" htmlFor="home-theme-search">Search themes</label>
                                <Search size={20} aria-hidden="true" />
                                <Input unstyled id="home-theme-search" name="q" type="search" placeholder="Search themes, styles, or features" maxLength={80} />
                                <Button type="submit" size="sm">Search</Button>
                            </form>
                            <div className="marketplace-hero-actions">
                                <Link href="/themes" className="marketplace-action">Explore all themes <ArrowRight aria-hidden="true" /></Link>
                                <Link href="/themes?pricing=free" className="marketplace-text-link">Start with a free theme</Link>
                            </div>
                            <p className="marketplace-hero-note"><Check size={16} aria-hidden="true" /><span>Preview before you choose. Your products stay yours.</span></p>
                        </div>
                        <div className="marketplace-home-preview"><MarketplaceArtwork kind="library" /><p>Find your look. Make it your own.</p></div>
                    </div>
                    <nav className="marketplace-category-nav" aria-label="Browse theme categories">
                        <Link href="/themes" aria-current="page">All themes</Link>
                        {CATEGORIES.map(category => <Link key={category.slug} href={`/themes?category=${category.slug}`}>{category.label}</Link>)}
                    </nav>
                </div>
            </section>

            <section className="marketplace-section marketplace-container marketplace-featured-section" aria-labelledby="featured-themes-heading">
                <div className="marketplace-section-heading">
                    <div><p className="marketplace-eyebrow">Find your starting point</p><h2 id="featured-themes-heading">A theme. Your own point of view.</h2><p>Explore the published design, then discover a few directions for making it yours.</p></div>
                    <Link className="marketplace-text-link" href="/themes">View all themes <span aria-hidden="true">↗</span></Link>
                </div>
                {!featuredResult.ok ? <MarketplaceUnavailable /> : featured.length ? (
                    featured.length === 1 && featured[0].slug === 'letbuyy-core' ? <ThemeStyleGallery theme={featured[0]} /> : <div className="marketplace-theme-grid">{featured.map(theme => <ThemeCard key={theme.id} theme={theme} />)}</div>
                ) : <EmptyState kind="themes" title="New themes are on the way" body="There are no published themes to browse yet. Check back soon." primaryAction={<Link href="/themes" className="marketplace-action">Browse themes</Link>} />}
            </section>

            {recent.length > 0 && <section className="marketplace-section marketplace-container" aria-labelledby="recent-themes-heading">
                <div className="marketplace-section-heading"><div><h2 id="recent-themes-heading">Fresh perspectives</h2><p>The latest additions to the theme catalog.</p></div><Link href="/themes?sort=recent" className="marketplace-text-link">See what’s new ↗</Link></div>
                <div className="marketplace-theme-grid">{recent.map(theme => <ThemeCard key={theme.id} theme={theme} />)}</div>
            </section>}

            <MarketplaceHomeResources />

            <section className="marketplace-section marketplace-container">
                <div className="marketplace-callout"><p className="marketplace-eyebrow"><ShieldCheck size={16} aria-hidden="true" /> Your brand. Your storefront.</p><h2>A new look. The same business.</h2><p>Your products and orders belong to your store. Choose a design, then personalise it from your merchant workspace when you’re ready.</p><Link href="/themes" className="marketplace-action">Find your theme <ArrowRight aria-hidden="true" /></Link></div>
            </section>
        </div>
    );
}
