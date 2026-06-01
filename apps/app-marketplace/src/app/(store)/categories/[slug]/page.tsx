import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AppCard } from '@/components/AppCard';
import { APP_CATEGORIES } from '@/lib/constants/categories';
import { AppService } from '@/lib/app-service';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface CategoryPageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps) {
    const { slug } = await params;
    const category = APP_CATEGORIES.find(c => c.slug === slug);
    if (!category) return { title: 'Category Not Found' };
    return {
        title: `${category.name} Apps — LetBuyy App Store`,
        description: `Browse ${category.name} apps for your LetBuyy store.`,
    };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
    const { slug } = await params;
    const category = APP_CATEGORIES.find(c => c.slug === slug);
    if (!category) notFound();

    const { apps: displayApps, total } = await AppService.listApps({ category: slug, limit: 20 });

    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="appstore-section">
                    {/* Breadcrumb */}
                    <div style={{ fontSize: 13, color: 'var(--text-hint)', marginBottom: 16 }}>
                        <Link href="/" style={{ color: 'var(--text-hint)', textDecoration: 'none' }}>Home</Link>
                        {' › '}
                        <Link href="/categories" style={{ color: 'var(--text-hint)', textDecoration: 'none' }}>Categories</Link>
                        {' › '}
                        <span style={{ color: 'var(--text-primary)' }}>{category.name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <span style={{ fontSize: 32 }}>{category.icon}</span>
                        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {category.name}
                        </h1>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 28 }}>
                        {total} apps available
                    </p>

                    {/* Sort bar */}
                    <div className="search-results-header">
                        <span className="search-results-count">
                            Showing {displayApps.length} apps
                        </span>
                        <select className="search-sort-select">
                            <option>Most popular</option>
                            <option>Top rated</option>
                            <option>Newest</option>
                            <option>A-Z</option>
                        </select>
                    </div>

                    <div className="app-card-grid">
                        {displayApps.map((app) => (
                            <AppCard key={app.id} app={app} />
                        ))}
                    </div>

                    {displayApps.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-state-icon">📦</div>
                            <h3>No apps yet</h3>
                            <p>There are no apps in this category yet. Check back soon!</p>
                        </div>
                    )}
                </section>
            </main>
            <Footer />
        </>
    );
}
