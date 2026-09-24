import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppCard } from '@/components/AppCard';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { MarketplaceBreadcrumbs } from '@/components/MarketplaceBreadcrumbs';
import { MarketplaceUnavailable } from '@/components/MarketplaceUnavailable';
import { RequestAppPanel } from '@/components/RequestAppPanel';
import { SectionHeader, VideoHero } from '@/components/MarketplaceEditorial';
import { APP_CATEGORIES } from '@/lib/constants/categories';
import { AppService } from '@/lib/app-service';
import { getAppRating, getInstallCount, getReviewCount } from '@/lib/marketplace-display';
import type { MarketplaceApp, MarketplaceAppCategory } from '@letbuyy/shared-types';
import {
    Button,
    ChevronRight,
    EmptyState,
    MaterialIcon,
    Package,
    type MaterialIconName,
} from '@letbuyy/ui';

interface CategoryPageProps {
    params: Promise<{ slug: string }>;
}

export const revalidate = 300;

function appScore(app: MarketplaceApp): number {
    return (getInstallCount(app) * 2) + (getReviewCount(app) * 8) + (getAppRating(app) * 100);
}

function byPopularity(apps: MarketplaceApp[]): MarketplaceApp[] {
    return [...apps].sort((a, b) => appScore(b) - appScore(a));
}

function exactRail(apps: MarketplaceApp[], count: number): MarketplaceApp[] {
    return apps.length >= count ? apps.slice(0, count) : [];
}

function categoryIntro(category: MarketplaceAppCategory): string {
    return (
        category.description ||
        category.seo_description ||
        category.buyer_guidance ||
        `Explore ${category.name.toLowerCase()} apps for LetBuyy merchants.`
    );
}

function groupSiblings(category: MarketplaceAppCategory, categories: MarketplaceAppCategory[]) {
    if (!category.group) return [];
    return categories
        .filter((item) => item.group === category.group && item.slug !== category.slug)
        .filter((item) => item.count === undefined || item.count === null || item.count > 0)
        .slice(0, 6);
}

async function getSubcategorySections(categories: MarketplaceAppCategory[]) {
    const sections = await Promise.all(
        categories.map(async (category) => {
            const result = await AppService.listApps({ category: category.slug, sort: 'popular', limit: 3, offset: 0 });
            if (!result.ok || result.value.apps.length === 0) return null;
            return {
                category,
                apps: result.value.apps,
                total: result.value.total,
            };
        }),
    );

    return sections.filter(Boolean) as Array<{
        apps: MarketplaceApp[];
        category: MarketplaceAppCategory;
        total: number;
    }>;
}

function HonestEditorialSlot({
    body,
    title,
}: {
    body: string;
    title: string;
}) {
    return (
        <section className="category-editorial-slot" aria-label={title}>
            <EmptyState kind="apps" title={title} body={body} />
        </section>
    );
}

export async function generateMetadata({ params }: CategoryPageProps) {
    const { slug } = await params;
    const liveCategories = await AppService.getCategories();
    const category = liveCategories.find((item) => item.slug === slug) || APP_CATEGORIES.find((item) => item.slug === slug);
    if (!category) return { title: 'Category Not Found' };

    return {
        title: category.seo_title || `Best ${category.name} Apps For 2026 — LetBuyy App Store`,
        description: category.seo_description || `Browse ${category.name} apps for LetBuyy stores.`,
    };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
    const { slug } = await params;
    const liveCategories = await AppService.getCategoriesWithFallback();
    const category = liveCategories.find((item) => item.slug === slug) || APP_CATEGORIES.find((item) => item.slug === slug);
    if (!category) notFound();

    const [listResult, sponsoredResult] = await Promise.all([
        AppService.listApps({ category: slug, sort: 'popular', limit: 24, offset: 0 }),
        AppService.listApps({ category: slug, sort: 'popular', featured: true, limit: 4, offset: 0 }),
    ]);
    const displayApps = listResult.ok ? byPopularity(listResult.value.apps) : [];
    const total = listResult.ok ? listResult.value.total : 0;
    const recommendedApps = exactRail(displayApps, 6);
    const sponsoredApps = sponsoredResult.ok ? exactRail(sponsoredResult.value.apps, 2) : [];
    const siblingCategories = groupSiblings(category, liveCategories);
    const subcategorySections = await getSubcategorySections(siblingCategories);

    return (
        <>
            <Header />
            <main className="appstore-main category-landing">
                <MarketplaceBreadcrumbs
                    items={[
                        { label: 'Home', href: '/' },
                        { label: 'Categories', href: '/categories' },
                        { label: category.name },
                    ]}
                />

                <section className="category-hero" aria-labelledby="category-hero-title">
                    <div className="category-hero__copy">
                        <div className="marketplace-title-row">
                            <MaterialIcon
                                name={(category.icon ?? 'category') as MaterialIconName}
                                className="category-page-icon"
                            />
                            <p className="marketplace-eyebrow">{category.group || 'App category'}</p>
                        </div>
                        <h1 id="category-hero-title">{category.name} apps</h1>
                        <p>{categoryIntro(category)}</p>
                        {siblingCategories.length > 0 ? (
                            <div className="category-pill-row" aria-label={`${category.name} related categories`}>
                                {siblingCategories.map((item) => (
                                    <Link key={item.slug} href={`/categories/${item.slug}`}>
                                        {item.name}
                                    </Link>
                                ))}
                            </div>
                        ) : null}
                        <div className="category-hero__actions">
                            <Button asChild>
                                <Link href={`/categories/${slug}/all`}>
                                    View all {total.toLocaleString('en-IN')} apps
                                    <ChevronRight size={16} aria-hidden="true" />
                                </Link>
                            </Button>
                            <Button asChild variant="secondary">
                                <Link href={`/search?category=${slug}`}>
                                    Search this category
                                </Link>
                            </Button>
                        </div>
                    </div>
                    <VideoHero>
                        <div className="category-hero__media-copy">
                            <span>{total.toLocaleString('en-IN')}</span>
                            <strong>{total === 1 ? 'app available' : 'apps available'}</strong>
                        </div>
                    </VideoHero>
                </section>

                {!listResult.ok ? (
                    <section className="appstore-home-section">
                        <MarketplaceUnavailable />
                    </section>
                ) : null}

                {sponsoredApps.length > 0 ? (
                    <section className="appstore-home-section" aria-labelledby="sponsored-apps-title">
                        <SectionHeader
                            eyebrow="Sponsored"
                            title="Sponsored apps"
                            body="Labeled placements render only when real featured/sponsored data is present."
                        />
                        <div className="category-sponsored-grid">
                            {sponsoredApps.map((app) => (
                                <AppCard key={app.id} app={app} />
                            ))}
                        </div>
                    </section>
                ) : null}

                {recommendedApps.length > 0 ? (
                    <section className="appstore-home-section" aria-labelledby="recommended-category-apps-title">
                        <SectionHeader
                            eyebrow="Recommended"
                            title={`Recommended ${category.name} apps`}
                            actionHref={`/categories/${slug}/all`}
                            actionLabel="See all"
                        />
                        <div className="appstore-home-card-grid">
                            {recommendedApps.map((app) => (
                                <AppCard key={app.id} app={app} />
                            ))}
                        </div>
                    </section>
                ) : listResult.ok ? (
                    <section className="category-empty-state">
                        <EmptyState
                            kind="apps"
                            title={`No ${category.name.toLowerCase()} apps yet`}
                            body="This category is available, but the live marketplace catalog does not have enough published apps for a recommendation rail yet."
                        />
                        <RequestAppPanel categorySlug={slug} compact />
                    </section>
                ) : null}

                {subcategorySections.map((section) => (
                    <section key={section.category.slug} className="appstore-home-section" aria-labelledby={`${section.category.slug}-section-title`}>
                        <SectionHeader
                            title={section.category.name}
                            body={categoryIntro(section.category)}
                            actionHref={`/categories/${section.category.slug}/all`}
                            actionLabel={`See ${section.total.toLocaleString('en-IN')} apps`}
                        />
                        <div className="category-subsection-grid">
                            {section.apps.map((app) => (
                                <AppCard key={app.id} app={app} />
                            ))}
                        </div>
                    </section>
                ))}

                <HonestEditorialSlot
                    title="Merchant tech-stack story not published yet"
                    body="This category has a merchant story slot, but no approved story or media is published yet."
                />

                <HonestEditorialSlot
                    title="Merchant testimonial not published yet"
                    body="Testimonials require approved merchant attribution and referenced app data, so this slot stays empty until real content exists."
                />

                <HonestEditorialSlot
                    title="Category how-tos not published yet"
                    body="Guide, blog, and video cards will appear here after approved editorial stories are published."
                />

                <section className="category-cta" aria-labelledby="category-cta-title">
                    <div>
                        <Package size={32} aria-hidden="true" />
                        <h2 id="category-cta-title">Need a specific {category.name.toLowerCase()} app?</h2>
                        <p>Tell us what you need and we will route the request through the marketplace app request workflow.</p>
                    </div>
                    <RequestAppPanel categorySlug={slug} compact />
                </section>
            </main>
            <Footer />
        </>
    );
}
