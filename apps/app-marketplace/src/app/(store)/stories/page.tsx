import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { StoryCard } from '@/components/MarketplaceEditorial';
import { AppService } from '@/lib/app-service';
import { EmptyState } from '@letbuyy/ui';

export const metadata = {
    title: 'App Stories — LetBuyy App Store',
    description: 'Editorial app stories and curated merchant workflows from the LetBuyy App Store.',
};

export const revalidate = 300;

function isStoryCollection(collection: { curation_type?: string | null; status?: string | null }) {
    const type = (collection.curation_type || '').toLowerCase();
    return collection.status === 'published' && (type.includes('story') || type.includes('editorial') || type.includes('guide'));
}

export default async function StoriesPage() {
    const collections = await AppService.getCollections();
    const stories = collections.filter(isStoryCollection);

    return (
        <>
            <Header />
            <main className="appstore-main stories-page">
                <header className="marketplace-page-header">
                    <p className="marketplace-eyebrow">Stories</p>
                    <h1 className="marketplace-page-title">App stories</h1>
                    <p className="marketplace-page-subtitle">Published editorial stories and merchant workflow collections.</p>
                </header>

                {stories.length > 0 ? (
                    <div className="stories-grid">
                        {stories.map((story) => (
                            <StoryCard
                                key={story.id}
                                eyebrow={story.curation_type || 'Story'}
                                href={`/stories/${story.slug}`}
                                title={story.name}
                                ctaLabel="Read story"
                            />
                        ))}
                    </div>
                ) : (
                    <section className="category-editorial-slot">
                        <EmptyState
                            kind="apps"
                            title="No app stories published yet"
                            body="The story index is ready, but no approved editorial stories are published in this environment."
                        />
                    </section>
                )}
            </main>
            <Footer />
        </>
    );
}
