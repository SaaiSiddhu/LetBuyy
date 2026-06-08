import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AppCard } from '@/components/AppCard';
import { MarketplaceUnavailable } from '@/components/MarketplaceUnavailable';
import { SectionHeader, ValueProp } from '@/components/MarketplaceEditorial';
import { AppService } from '@/lib/app-service';
import {
    getAppRating,
    getDeveloperName,
    getInstallCount,
    getLastUpdatedDate,
    getReviewCount,
    isBuiltForLetbuyy,
} from '@/lib/marketplace-display';
import type { MarketplaceApp } from '@letbuyy/shared-types';
import {
    Button,
    ChevronRight,
    EmptyState,
    Page,
    PageContent,
    Search,
    ShieldCheck,
    Star,
} from '@letbuyy/ui';

export const revalidate = 300;

function appScore(app: MarketplaceApp): number {
    return (getInstallCount(app) * 2) + (getReviewCount(app) * 8) + (getAppRating(app) * 100);
}

function uniqueApps(appGroups: MarketplaceApp[][]): MarketplaceApp[] {
    const apps = new Map<string, MarketplaceApp>();

    for (const group of appGroups) {
        for (const app of group) {
            if (app.id && !apps.has(app.id)) {
                apps.set(app.id, app);
            }
        }
    }

    return Array.from(apps.values());
}

function exactRail(apps: MarketplaceApp[], count: number): MarketplaceApp[] {
    return apps.length >= count ? apps.slice(0, count) : [];
}

function byPopularity(apps: MarketplaceApp[]): MarketplaceApp[] {
    return [...apps].sort((a, b) => appScore(b) - appScore(a));
}

function byRecency(apps: MarketplaceApp[]): MarketplaceApp[] {
    return [...apps].sort((a, b) => {
        const bDate = getLastUpdatedDate(b)?.getTime() ?? 0;
        const aDate = getLastUpdatedDate(a)?.getTime() ?? 0;
        return bDate - aDate;
    });
}

function isFirstPartyApp(app: MarketplaceApp): boolean {
    return getDeveloperName(app).toLowerCase().includes('letbuyy');
}

function AppRail({
    actionHref,
    actionLabel,
    apps,
    eyebrow,
    minCards = 6,
    title,
}: {
    actionHref?: string;
    actionLabel?: string;
    apps: MarketplaceApp[];
    eyebrow?: string;
    minCards?: number;
    title: string;
}) {
    const railApps = exactRail(apps, minCards);
    if (railApps.length === 0) return null;

    return (
        <section className="appstore-home-section" aria-labelledby={`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title`}>
            <SectionHeader
                eyebrow={eyebrow}
                title={title}
                actionHref={actionHref}
                actionLabel={actionLabel}
            />
            <div className="appstore-home-card-grid">
                {railApps.map((app) => (
                    <AppCard key={app.id} app={app} />
                ))}
            </div>
        </section>
    );
}

function EditorialSlot({
    body,
    title,
}: {
    body: string;
    title: string;
}) {
    return (
        <section className="appstore-home-section" aria-labelledby={`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-slot-title`}>
            <div className="appstore-home-editorial-slot">
                <EmptyState kind="apps" title={title} body={body} />
            </div>
        </section>
    );
}

function FeaturedApp({ app }: { app: MarketplaceApp | null }) {
    if (!app) {
        return (
            <EditorialSlot
                title="Featured app story not published yet"
                body="A featured-app editorial slot is available, but no approved featured story is published in this environment."
            />
        );
    }

    return (
        <section className="appstore-home-section" aria-labelledby="featured-app-title">
            <SectionHeader eyebrow="Featured app" title="In focus this week" />
            <article className="appstore-home-featured-app">
                <div className="appstore-home-featured-app__copy">
                    <p className="marketplace-eyebrow">Featured app</p>
                    <h3 id="featured-app-title">{app.name}</h3>
                    <p>{app.tagline || 'A marketplace app for LetBuyy merchants.'}</p>
                    <Link href={`/apps/${app.slug}`} className="appstore-home-featured-app__link">
                        View app
                        <ChevronRight size={18} aria-hidden="true" />
                    </Link>
                </div>
                <AppCard app={app} />
            </article>
        </section>
    );
}

function MarketplaceHero({ apps }: { apps: MarketplaceApp[] }) {
    return (
        <section className="appstore-home-hero" aria-labelledby="appstore-home-hero-title">
            <div className="appstore-home-hero__inner">
                <div className="appstore-home-hero__copy">
                    <p className="appstore-home-hero__eyebrow">LetBuyy App Store</p>
                    <h1 id="appstore-home-hero-title">Get the best apps for your business with Built for LetBuyy</h1>
                    <p className="appstore-home-hero__subtitle">
                        Find commerce apps for marketing, operations, reviews, invoices, checkout, and storefront growth.
                    </p>
                    <div className="appstore-home-hero__actions">
                        <Button asChild>
                            <Link href="/search">
                                Browse apps
                                <Search size={16} aria-hidden="true" />
                            </Link>
                        </Button>
                        <Button asChild variant="secondary">
                            <Link href="/collections">
                                View collections
                                <ChevronRight size={16} aria-hidden="true" />
                            </Link>
                        </Button>
                    </div>
                </div>

                {apps.length >= 3 ? (
                    <div className="appstore-home-hero__apps" aria-label="Popular apps">
                        {apps.slice(0, 6).map((app) => (
                            <Link key={app.id} href={`/apps/${app.slug}`} className="appstore-home-hero-app" aria-label={app.name}>
                                <span className={`appstore-home-hero-app__icon app-icon-tone-${appScore(app) % 6}`} aria-hidden="true">
                                    {app.name.trim().charAt(0).toUpperCase() || 'A'}
                                </span>
                                <span className="appstore-home-hero-app__content">
                                    <strong>{app.name}</strong>
                                    <span className="appstore-home-hero-app__meta">
                                        <Star size={14} fill="currentColor" stroke="currentColor" aria-hidden="true" />
                                        {getAppRating(app).toFixed(1)}
                                        <span aria-hidden="true">•</span>
                                        {getReviewCount(app).toLocaleString('en-IN')} reviews
                                    </span>
                                    <span className="appstore-home-hero-app__tagline">{app.tagline || getDeveloperName(app)}</span>
                                    {isBuiltForLetbuyy(app) ? (
                                        <span className="appstore-home-hero-app__badge">
                                            <ShieldCheck size={13} aria-hidden="true" />
                                            Built for LetBuyy
                                        </span>
                                    ) : null}
                                </span>
                            </Link>
                        ))}
                    </div>
                ) : null}
            </div>
        </section>
    );
}

function AppAdvantage() {
    const props = [
        {
            icon: ShieldCheck,
            title: 'Quality gates',
            body: 'Badges and placement surfaces render from real review and award data only.',
        },
        {
            icon: Star,
            title: 'Review clarity',
            body: 'Ratings stay paired with review counts so merchants can judge confidence quickly.',
        },
        {
            icon: Search,
            title: 'Focused discovery',
            body: 'Category, search, and collection paths keep merchants close to the apps that fit their store.',
        },
    ];

    return (
        <section className="appstore-home-section appstore-home-section--advantage" aria-labelledby="app-advantage-title">
            <SectionHeader eyebrow="LetBuyy app advantage" title="Choose apps with clearer signals" />
            <div className="appstore-home-value-grid">
                {props.map((item) => (
                    <ValueProp key={item.title} icon={item.icon} title={item.title} body={item.body} />
                ))}
            </div>
        </section>
    );
}

function AddAppCta() {
    return (
        <section className="appstore-home-cta" aria-labelledby="add-app-title">
            <div>
                <p className="marketplace-eyebrow">For partners</p>
                <h2 id="add-app-title">Want to add an app?</h2>
                <p>Build for LetBuyy merchants and submit your app for marketplace review.</p>
            </div>
            <Button asChild>
                <Link href="/developers/register">
                    Start partner registration
                    <ChevronRight size={16} aria-hidden="true" />
                </Link>
            </Button>
        </section>
    );
}

export default async function MarketplacePage() {
    const catalogResult = await AppService.listApps({ sort: 'popular', limit: 48, offset: 0 });
    const catalogApps = catalogResult.ok ? catalogResult.value.apps : [];
    const featuredApps = await AppService.getFeaturedApps(8);
    const newThisWeekApps = await AppService.getNewThisWeekApps(8);
    const allApps = uniqueApps([featuredApps, newThisWeekApps, catalogApps]);

    const builtForLetbuyyApps = byPopularity(allApps.filter(isBuiltForLetbuyy));
    const popularApps = byPopularity(allApps);
    const spotlightApps = byRecency(uniqueApps([newThisWeekApps, catalogApps]));
    const firstPartyApps = byPopularity(allApps.filter(isFirstPartyApp));
    const featuredApp = featuredApps[0] ?? null;

    return (
        <>
            <Header />
            <MarketplaceHero apps={popularApps} />
            <Page className="appstore-main appstore-main--home">
                <PageContent>
                    {!catalogResult.ok ? (
                        <section className="appstore-home-section">
                            <MarketplaceUnavailable />
                        </section>
                    ) : null}

                    <AppRail
                        eyebrow="Recommended"
                        title="Built for LetBuyy apps"
                        apps={builtForLetbuyyApps}
                        actionHref="/search?program=built-for-letbuyy"
                        actionLabel="View all"
                    />

                    <AppRail
                        eyebrow="Popular"
                        title="Popular with merchants across LetBuyy"
                        apps={popularApps}
                        actionHref="/search?sort=popular"
                        actionLabel="Browse popular apps"
                    />

                    <EditorialSlot
                        title="Editorial story not published yet"
                        body="The story slot is ready for approved marketplace editorial content. It stays empty until a real story is published."
                    />

                    <AppRail
                        eyebrow="Spotlight"
                        title="In the spotlight"
                        apps={spotlightApps}
                        minCards={4}
                        actionHref="/search?sort=recent"
                        actionLabel="See newer apps"
                    />

                    <FeaturedApp app={featuredApp} />

                    <EditorialSlot
                        title="Merchant tech-stack stories not published yet"
                        body="Merchant story callouts require approved editorial copy and media. The slot renders this empty state until that content exists."
                    />

                    <AppRail
                        eyebrow="Made by LetBuyy"
                        title="Made by LetBuyy"
                        apps={firstPartyApps}
                        minCards={3}
                        actionHref="/search?q=LetBuyy"
                        actionLabel="View first-party apps"
                    />

                    <AppAdvantage />
                    <AddAppCta />
                </PageContent>
            </Page>
            <Footer />
        </>
    );
}
