import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AppCard } from '@/components/AppCard';
import { AppService } from '@/lib/app-service';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const COLLECTIONS: Record<string, { name: string; description: string; icon: string; sort?: 'popular' | 'rating' | 'recent' }> = {
    'staff-picks': {
        name: 'Staff Picks',
        description: 'Hand-picked by the LetBuyy team for quality and reliability.',
        icon: '⭐',
        sort: 'rating',
    },
    'trending': {
        name: 'Trending This Week',
        description: 'The most installed and talked-about apps right now.',
        icon: '🔥',
        sort: 'popular',
    },
    'made-in-india': {
        name: 'Made in India',
        description: 'Apps built by Indian developers, optimized for Indian merchants.',
        icon: '🇮🇳',
        sort: 'recent',
    },
};

interface CollectionPageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CollectionPageProps) {
    const { slug } = await params;
    const collection = COLLECTIONS[slug];
    if (!collection) return { title: 'Collection Not Found' };
    return {
        title: `${collection.name} — LetBuyy App Store`,
        description: collection.description,
    };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
    const { slug } = await params;
    const collection = COLLECTIONS[slug];
    if (!collection) notFound();

    const { apps: displayApps } = await AppService.listApps({
        sort: collection.sort || 'popular',
        limit: 12,
    });

    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="appstore-section">
                    <div style={{ fontSize: 13, color: 'var(--text-hint)', marginBottom: 16 }}>
                        <Link href="/" style={{ color: 'var(--text-hint)', textDecoration: 'none' }}>Home</Link>
                        {' › '}
                        <span style={{ color: 'var(--text-primary)' }}>{collection.name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <span style={{ fontSize: 32 }}>{collection.icon}</span>
                        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {collection.name}
                        </h1>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 28 }}>
                        {collection.description}
                    </p>

                    <div className="app-card-grid">
                        {displayApps.map((app) => (
                            <AppCard key={app.id} app={app} />
                        ))}
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}
