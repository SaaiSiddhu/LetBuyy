import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AppCard } from '@/components/AppCard';
import { createAppMarketplaceApiClient } from '@/lib/api/client';
import { BadgeCheck, ExternalLink, Store } from '@letbuyy/ui';

interface DeveloperProfilePageProps {
    params: Promise<{ slug: string }>;
}

async function getDeveloperProfile(slug: string) {
    const api = await createAppMarketplaceApiClient({ requireSession: false });
    return api.appStore.developerProfile(slug).catch(() => null);
}

function developerDescription(developer: unknown): string | null {
    const description = developer && typeof developer === 'object' && 'description' in developer
        ? (developer as { description?: unknown }).description
        : null;
    return typeof description === 'string' && description.trim()
        ? description.trim()
        : null;
}

export async function generateMetadata({ params }: DeveloperProfilePageProps) {
    const { slug } = await params;
    const profile = await getDeveloperProfile(slug);
    const name = profile?.developer.company_name || slug;
    const description = profile ? developerDescription(profile.developer) : null;
    return {
        title: `${name} — LetBuyy App Store Developer`,
        description: description || `Apps published by ${name} on the LetBuyy App Store.`,
    };
}

export default async function DeveloperProfilePage({ params }: DeveloperProfilePageProps) {
    const { slug } = await params;
    const profile = await getDeveloperProfile(slug);
    const description = profile ? developerDescription(profile.developer) : null;

    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="appstore-section developer-profile-page">
                    {profile ? (
                        <>
                            <div className="developer-profile-hero">
                                <div className="developer-profile-logo" aria-hidden="true">
                                    {profile.developer.logo_url ? (
                                        <Image src={profile.developer.logo_url} alt="" width={96} height={96} sizes="48px" />
                                    ) : (
                                        <Store size={24} aria-hidden="true" />
                                    )}
                                </div>
                                <div>
                                    <div className="marketplace-badge-row">
                                        {profile.developer.verified && (
                                            <span className="marketplace-badge marketplace-badge--info">
                                                <BadgeCheck size={12} aria-hidden="true" />
                                                Verified developer
                                            </span>
                                        )}
                                        <span className="marketplace-badge marketplace-badge--neutral">
                                            {profile.apps.length} published {profile.apps.length === 1 ? 'app' : 'apps'}
                                        </span>
                                    </div>
                                    <h1 className="marketplace-page-title">{profile.developer.company_name}</h1>
                                    <p className="marketplace-page-subtitle">
                                        {description || 'This developer has not added a company description yet.'}
                                    </p>
                                    <div className="developer-profile-links">
                                        {profile.developer.website_url && (
                                            <a href={profile.developer.website_url} target="_blank" rel="noreferrer">
                                                Website
                                                <ExternalLink size={13} aria-hidden="true" />
                                            </a>
                                        )}
                                        {profile.developer.support_email && (
                                            <a href={`mailto:${profile.developer.support_email}`}>
                                                Support
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="marketplace-section-header">
                                <h2>Apps by {profile.developer.company_name}</h2>
                                <p>{profile.apps.length.toLocaleString('en-IN')} published {profile.apps.length === 1 ? 'app' : 'apps'} for LetBuyy merchants.</p>
                            </div>
                            {profile.apps.length > 0 ? (
                                <div className="app-grid">
                                    {profile.apps.map((app) => (
                                        <AppCard key={app.id} app={app} />
                                    ))}
                                </div>
                            ) : (
                                <div className="app-review-empty">
                                    <div className="app-review-empty__icon">
                                        <Store size={20} aria-hidden="true" />
                                    </div>
                                    <h2>No published apps</h2>
                                    <p>This developer has no published marketplace apps right now.</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="app-review-empty">
                            <div className="app-review-empty__icon">
                                <Store size={20} aria-hidden="true" />
                            </div>
                            <h1>Developer profile unavailable</h1>
                            <p>This public developer profile is not available.</p>
                            <Link href="/" className="dev-portal-cta">
                                Browse apps
                            </Link>
                        </div>
                    )}
                </section>
            </main>
            <Footer />
        </>
    );
}
