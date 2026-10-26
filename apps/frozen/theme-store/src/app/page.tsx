import Link from 'next/link';
import { ArrowRight, EmptyState, ShieldCheck } from '@letbuyy/ui';
import ThemeCard from '@/components/theme-card';
import ThemeStyleGallery from '@/components/theme-style-gallery';
import { ThemeService } from '@/lib/theme-service';
import { normalizeThemeRecord } from '@/lib/theme-catalog';
import MarketplaceUnavailable from '@/components/marketplace-unavailable';
import MarketplaceHomeResources from '@/components/marketplace-home-resources';
import MarketplaceHero from '@/components/marketplace-hero';

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
            <MarketplaceHero />

            <div className="marketplace-home-band marketplace-home-band-featured"><section className="marketplace-section marketplace-container marketplace-featured-section" aria-labelledby="featured-themes-heading">
                <div className="marketplace-section-heading">
                    <div><p className="marketplace-eyebrow">Find your starting point</p><h2 id="featured-themes-heading">Find your store’s look.</h2><p>Explore the published preset and a few mobile layout studies.</p></div>
                    <Link className="marketplace-text-link" href="/themes">View all themes <span aria-hidden="true">↗</span></Link>
                </div>
                {!featuredResult.ok ? <MarketplaceUnavailable /> : featured.length ? (
                    featured.length === 1 && featured[0].slug === 'letbuyy-core' ? <ThemeStyleGallery theme={featured[0]} /> : <div className="marketplace-theme-grid">{featured.map(theme => <ThemeCard key={theme.id} theme={theme} />)}</div>
                ) : <EmptyState kind="themes" title="New themes are on the way" body="There are no published themes to browse yet. Check back soon." primaryAction={<Link href="/themes" className="marketplace-action">Browse themes</Link>} />}
            </section></div>

            {recent.length > 0 && <div className="marketplace-home-band marketplace-home-band-recent"><section className="marketplace-section marketplace-container" aria-labelledby="recent-themes-heading">
                <div className="marketplace-section-heading"><div><h2 id="recent-themes-heading">Fresh perspectives</h2><p>The latest additions to the theme catalog.</p></div><Link href="/themes?sort=recent" className="marketplace-text-link">See what’s new ↗</Link></div>
                <div className="marketplace-theme-grid">{recent.map(theme => <ThemeCard key={theme.id} theme={theme} />)}</div>
            </section></div>}

            <MarketplaceHomeResources />

            <div className="marketplace-home-band marketplace-home-band-callout"><section className="marketplace-section marketplace-container">
                <div className="marketplace-callout"><p className="marketplace-eyebrow"><ShieldCheck size={16} aria-hidden="true" /> Your brand. Your storefront.</p><h2>A new look. The same business.</h2><p>Your products and orders belong to your store. Choose a design, then personalise it from your merchant workspace when you’re ready.</p><Link href="/themes" className="marketplace-action">Find your theme <ArrowRight aria-hidden="true" /></Link></div>
            </section></div>
        </div>
    );
}
