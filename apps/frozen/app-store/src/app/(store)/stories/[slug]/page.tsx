import { notFound } from 'next/navigation';
import { AppCard } from '@/components/AppCard';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { MarketplaceBreadcrumbs } from '@/components/MarketplaceBreadcrumbs';
import { MarketplaceCollectionSections } from '@/components/MarketplaceCollectionSections';
import { AppService } from '@/lib/app-service';
import { EmptyState } from '@letbuyy/ui';

interface StoryPageProps {
    params: Promise<{ slug: string }>;
}

function isStoryCollection(collection: { curation_type?: string | null; status?: string | null }) {
    const type = (collection.curation_type || '').toLowerCase();
    return collection.status === 'published' && (type.includes('story') || type.includes('editorial') || type.includes('guide'));
}

export async function generateMetadata({ params }: StoryPageProps) {
    const { slug } = await params;
    const story = await AppService.getCollection(slug);
    if (!story || !isStoryCollection(story)) return { title: 'Story Not Found' };

    return {
        title: `${story.name} — LetBuyy App Store`,
        description: story.description || `App story from the LetBuyy App Store.`,
    };
}

export default async function StoryPage({ params }: StoryPageProps) {
    const { slug } = await params;
    const story = await AppService.getCollection(slug);
    if (!story || !isStoryCollection(story)) notFound();

    const apps = story.apps || [];

    return (
        <>
            <Header />
            <main className="appstore-main story-detail-page">
                <MarketplaceBreadcrumbs
                    items={[
                        { label: 'Home', href: '/' },
                        { label: 'Stories', href: '/stories' },
                        { label: story.name },
                    ]}
                />

                <header className="story-detail-hero">
                    <p className="marketplace-eyebrow">{story.curation_type || 'Story'}</p>
                    <h1>{story.name}</h1>
                    <p>{story.description || 'This story has not added approved body copy yet.'}</p>
                    {story.disclosure ? (
                        <div className="marketplace-banner marketplace-banner--info">
                            <strong>Curation note</strong>
                            <span>{story.disclosure}</span>
                        </div>
                    ) : null}
                </header>

                <MarketplaceCollectionSections
                    sections={story.sections}
                    emptyTitle="Story body not published yet"
                    emptyBody="The editorial body slot is available, but approved story sections and media are not published in this environment."
                />

                <section className="marketplace-card marketplace-section">
                    <div className="marketplace-section-header">
                        <h2>Apps in this story</h2>
                        <p>Only active app callouts from the real collection membership are shown.</p>
                    </div>
                    {apps.length > 0 ? (
                        <div className="appstore-home-card-grid">
                            {apps.map((app) => (
                                <AppCard key={app.id} app={app} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            kind="apps"
                            title="No app callouts yet"
                            body="This published story does not currently include active app listings."
                        />
                    )}
                </section>
            </main>
            <Footer />
        </>
    );
}
