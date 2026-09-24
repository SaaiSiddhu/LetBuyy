import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { AppService } from '@/lib/app-service';
import { MarketplaceUnavailable } from '@/components/MarketplaceUnavailable';
import { ArrowRight, LayoutGrid } from '@letbuyy/ui';

export const metadata = {
    title: 'Collections - LetBuyy App Store',
    description: 'Browse curated app collections from the LetBuyy marketplace.',
};

export const revalidate = 300;

export default async function CollectionsPage() {
    const collections = await AppService.getCollections();

    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="appstore-section">
                    <div className="marketplace-page-header">
                        <h1 className="marketplace-page-title">App Collections</h1>
                        <p className="marketplace-page-subtitle">Curated sets of apps for common merchant workflows.</p>
                    </div>

                    {collections.length === 0 ? (
                        <MarketplaceUnavailable
                            title="No collections published yet"
                            body="Published marketplace collections will appear here when the app catalog has curated sets available."
                        />
                    ) : (
                        <div className="marketplace-collection-grid">
                            {collections.map((collection) => (
                                <Link key={collection.id} href={`/collections/${collection.slug}`} className="marketplace-collection-card">
                                    <div className="marketplace-collection-card__icon">
                                        <LayoutGrid size={18} aria-hidden="true" />
                                    </div>
                                    <div>
                                        <h2>{collection.name}</h2>
                                        <p>{collection.description || 'Curated marketplace collection.'}</p>
                                        <span>
                                            {(collection.count || 0).toLocaleString('en-IN')} {(collection.count || 0) === 1 ? 'app' : 'apps'}
                                            <ArrowRight size={14} aria-hidden="true" />
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </main>
            <Footer />
        </>
    );
}
