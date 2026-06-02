import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { HeroSection } from '@/components/HeroSection';
import { AppCard } from '@/components/AppCard';
import { CategoryGroupGrid } from '@/components/CategoryGrid';
import { AppService } from '@/lib/app-service';
import { Clock, Flame, LayoutGrid, Star } from '@letbuyy/ui';
import Link from 'next/link';

export default async function MarketplacePage() {
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
                {featured && <HeroSection app={featured} />}

                {/* Staff Picks */}
                <section className="appstore-section appstore-section--delay-1">
                    <div className="appstore-section-header">
                        <h2 className="appstore-section-title">
                            <Star size={20} aria-hidden="true" /> Staff Picks
                        </h2>
                        <Link href="/collections/staff-picks" className="appstore-section-link">
                            View all →
                        </Link>
                    </div>
                    <div className="app-card-grid">
                        {staffPickApps.map((app) => (
                            <AppCard key={app.id} app={app} />
                        ))}
                    </div>
                </section>

                {/* Trending This Week */}
                <section className="appstore-section appstore-section--delay-2">
                    <div className="appstore-section-header">
                        <h2 className="appstore-section-title">
                            <Flame size={20} aria-hidden="true" /> Trending This Week
                        </h2>
                        <Link href="/search?sort=trending" className="appstore-section-link">
                            View all →
                        </Link>
                    </div>
                    <div className="app-card-grid">
                        {trending.apps.map((app) => (
                            <AppCard key={app.id} app={app} />
                        ))}
                    </div>
                </section>

                {/* Browse by Category */}
                <section className="appstore-section appstore-section--delay-3">
                    <div className="appstore-section-header">
                        <h2 className="appstore-section-title">
                            <LayoutGrid size={20} aria-hidden="true" /> Browse by Category
                        </h2>
                        <Link href="/categories" className="appstore-section-link">
                            View all →
                        </Link>
                    </div>
                    <CategoryGroupGrid />
                </section>

                {/* Recently Added */}
                <section className="appstore-section appstore-section--delay-4">
                    <div className="appstore-section-header">
                        <h2 className="appstore-section-title">
                            <Clock size={20} aria-hidden="true" /> Recently Added
                        </h2>
                        <Link href="/search?sort=recent" className="appstore-section-link">
                            View all →
                        </Link>
                    </div>
                    <div className="app-card-grid">
                        {recent.apps.map((app) => (
                            <AppCard key={app.id} app={app} />
                        ))}
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}
