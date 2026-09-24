import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AppCard } from '@/components/AppCard';
import { AppService } from '@/lib/app-service';
import { MarketplaceUnavailable } from '@/components/MarketplaceUnavailable';
import { MarketplaceBreadcrumbs } from '@/components/MarketplaceBreadcrumbs';
import { MarketplaceCollectionSections } from '@/components/MarketplaceCollectionSections';
import { LayoutGrid } from '@letbuyy/ui';
import { notFound } from 'next/navigation';

interface CollectionPageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CollectionPageProps) {
    const { slug } = await params;
    const collection = await AppService.getCollection(slug);
    if (!collection) return { title: 'Collection Not Found' };
    return {
        title: `${collection.name} - LetBuyy App Store`,
        description: collection.description || `Apps in the ${collection.name} collection.`,
    };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
    const { slug } = await params;
    const collection = await AppService.getCollection(slug);
    if (!collection) notFound();
    const apps = collection.apps || [];

    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="appstore-section">
                    <MarketplaceBreadcrumbs
                        items={[
                            { label: 'Home', href: '/' },
                            { label: 'Collections', href: '/collections' },
                            { label: collection.name },
                        ]}
                    />

                    <div className="marketplace-title-row">
                        <LayoutGrid size={32} aria-hidden="true" />
                        <h1>{collection.name}</h1>
                    </div>
                    <p className="marketplace-page-subtitle marketplace-section-intro">
                        {collection.description || 'Curated marketplace collection.'}
                    </p>
                    {collection.disclosure && (
                        <div className="marketplace-banner marketplace-banner--info">
                            <strong>Curation note</strong>
                            <span>{collection.disclosure}</span>
                        </div>
                    )}

                    <MarketplaceCollectionSections
                        sections={collection.sections}
                        emptyTitle="Collection body not published yet"
                        emptyBody="The collection body type is available, but approved editorial sections are not published in this environment."
                    />

                    {apps.length === 0 ? (
                        <MarketplaceUnavailable
                            title="No apps in this collection yet"
                            body="This collection is published, but it does not currently contain active app listings."
                        />
                    ) : (
                        <div className="app-card-grid">
                            {apps.map((app) => (
                                <AppCard key={app.id} app={app} />
                            ))}
                        </div>
                    )}
                </section>
            </main>
            <Footer />
        </>
    );
}
