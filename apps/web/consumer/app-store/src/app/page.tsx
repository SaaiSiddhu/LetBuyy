import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { HeroSection } from '@/components/HeroSection';
import { AppCard } from '@/components/AppCard';
import { CategoryGroupGrid } from '@/components/CategoryGrid';
import { AppService } from '@/lib/app-service';
import Link from 'next/link';

export default async function MarketplacePage() {
    // Fetch all sections in parallel from Supabase
    const [staffPicks, trending, recent] = await Promise.all([
        AppService.listApps({ sort: 'rating', limit: 4 }),
        AppService.listApps({ sort: 'popular', limit: 4 }),
        AppService.listApps({ sort: 'recent', limit: 4 }),
    ]);

    const featured = staffPicks.apps[0] || null;
    const staffPickApps = staffPicks.apps;

    return (
        <>
            <Header />
            <main className="appstore-main">
                {/* Hero — Featured App */}
                {featured && <HeroSection app={featured as any} />}

                {/* Staff Picks */}
                <section className="appstore-section" style={{ animationDelay: '0.1s' }}>
                    <div className="appstore-section-header">
                        <h2 className="appstore-section-title">⭐ Staff Picks</h2>
                        <Link href="/collections/staff-picks" className="appstore-section-link">
                            View all →
                        </Link>
                    </div>
                    <div className="app-card-grid">
                        {staffPickApps.map((app: any) => (
                            <AppCard key={app.id} app={app} />
                        ))}
                    </div>
                </section>

                {/* Trending This Week */}
                <section className="appstore-section" style={{ animationDelay: '0.2s' }}>
                    <div className="appstore-section-header">
                        <h2 className="appstore-section-title">🔥 Trending This Week</h2>
                        <Link href="/search?sort=trending" className="appstore-section-link">
                            View all →
                        </Link>
                    </div>
                    <div className="app-card-grid">
                        {trending.apps.map((app: any) => (
                            <AppCard key={app.id} app={app} />
                        ))}
                    </div>
                </section>

                {/* Browse by Category */}
                <section className="appstore-section" style={{ animationDelay: '0.3s' }}>
                    <div className="appstore-section-header">
                        <h2 className="appstore-section-title">📂 Browse by Category</h2>
                        <Link href="/categories" className="appstore-section-link">
                            View all →
                        </Link>
                    </div>
                    <CategoryGroupGrid />
                </section>

                {/* Recently Added */}
                <section className="appstore-section" style={{ animationDelay: '0.4s' }}>
                    <div className="appstore-section-header">
                        <h2 className="appstore-section-title">🆕 Recently Added</h2>
                        <Link href="/search?sort=recent" className="appstore-section-link">
                            View all →
                        </Link>
                    </div>
                    <div className="app-card-grid">
                        {recent.apps.map((app: any) => (
                            <AppCard key={app.id} app={app} />
                        ))}
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}
