import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { AppCard } from '@/components/AppCard';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { MarketplaceBreadcrumbs } from '@/components/MarketplaceBreadcrumbs';
import { MarketplacePagination } from '@/components/MarketplacePagination';
import { MarketplaceUnavailable } from '@/components/MarketplaceUnavailable';
import { APP_CATEGORIES } from '@/lib/constants/categories';
import { AppService, type AppFilters } from '@/lib/app-service';
import { Badge, EmptyState } from '@letbuyy/ui';
import type { MarketplaceAppFeatureGroup } from '@letbuyy/shared-types';

interface CategoryAllPageProps {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 20;
const SORT_OPTIONS: Array<{ value: NonNullable<AppFilters['sort']>; label: string }> = [
    { value: 'popular', label: 'Popularity' },
    { value: 'rating', label: 'Rating' },
    { value: 'recent', label: 'Newest' },
    { value: 'name', label: 'A to Z' },
];

const PRICING_OPTIONS = [
    { value: '', label: 'All pricing' },
    { value: 'free', label: 'Free' },
    { value: 'freemium', label: 'Free plan available' },
    { value: 'paid', label: 'Paid' },
    { value: 'usage', label: 'Usage-based' },
];

const RATING_OPTIONS = [
    { value: '', label: 'Any rating' },
    { value: '4', label: '4 stars and up' },
    { value: '3', label: '3 stars and up' },
];

function firstParam(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
}

function normalizePage(value: string | string[] | undefined): number {
    const page = Number.parseInt(firstParam(value) || '1', 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
}

function normalizeSort(value: string | string[] | undefined): NonNullable<AppFilters['sort']> {
    const sort = firstParam(value);
    return SORT_OPTIONS.some((option) => option.value === sort) ? sort as NonNullable<AppFilters['sort']> : 'popular';
}

function normalizePricing(value: string | string[] | undefined): string {
    const pricing = firstParam(value);
    return PRICING_OPTIONS.some((option) => option.value === pricing) ? pricing : '';
}

function normalizeRating(value: string | string[] | undefined): string {
    const rating = firstParam(value);
    return RATING_OPTIONS.some((option) => option.value === rating) ? rating : '';
}

function normalizeProgram(value: string | string[] | undefined): 'built-for-letbuyy' | '' {
    return firstParam(value) === 'built-for-letbuyy' ? 'built-for-letbuyy' : '';
}

function normalizeFeatureHandles(...values: Array<string | string[] | undefined>): string[] {
    return Array.from(new Set(values.flatMap((value) => {
        if (Array.isArray(value)) return value;
        return value ? value.split(',') : [];
    }).map((value) => value.trim().toLowerCase()).filter((value) => /^[a-z0-9][a-z0-9-]{1,120}$/.test(value)))).slice(0, 24);
}

type QueryValue = string | number | string[] | undefined;

function hrefWith(basePath: string, query: Record<string, QueryValue>, updates: Record<string, QueryValue>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...query, ...updates })) {
        if (value === undefined || value === '') continue;
        if (key === 'page' && Number(value) <= 1) continue;
        if (Array.isArray(value)) {
            for (const item of value) {
                if (item) params.append(key, item);
            }
            continue;
        }
        params.set(key, String(value));
    }
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
}

function FilterLink({
    active,
    children,
    href,
}: {
    active: boolean;
    children: ReactNode;
    href: string;
}) {
    return (
        <Link href={href} className={`browse-filter-link ${active ? 'active' : ''}`} aria-current={active ? 'true' : undefined}>
            {children}
        </Link>
    );
}

function FeatureFacetSections({
    basePath,
    featureHandles,
    groups,
    query,
}: {
    basePath: string;
    featureHandles: string[];
    groups: MarketplaceAppFeatureGroup[];
    query: Record<string, QueryValue>;
}) {
    if (groups.length === 0) return null;

    return (
        <>
            {groups.map((group) => {
                const visibleTags = (group.tags || []).filter((tag) => Number(tag.count || 0) > 0 || featureHandles.includes(tag.handle));
                if (visibleTags.length === 0) return null;

                return (
                    <section key={group.id}>
                        <h2>{group.label}</h2>
                        {visibleTags.map((tag) => {
                            const active = featureHandles.includes(tag.handle);
                            const nextHandles = active
                                ? featureHandles.filter((handle) => handle !== tag.handle)
                                : [...featureHandles, tag.handle];
                            return (
                                <FilterLink
                                    key={tag.handle}
                                    active={active}
                                    href={hrefWith(basePath, query, { 'feature_handles[]': nextHandles, page: 1 })}
                                >
                                    <span>{tag.label}</span>
                                    <span className="browse-filter-count">{Number(tag.count || 0).toLocaleString('en-IN')}</span>
                                </FilterLink>
                            );
                        })}
                    </section>
                );
            })}
        </>
    );
}

export async function generateMetadata({ params }: CategoryAllPageProps) {
    const { slug } = await params;
    const categories = await AppService.getCategoriesWithFallback();
    const category = categories.find((item) => item.slug === slug) || APP_CATEGORIES.find((item) => item.slug === slug);
    if (!category) return { title: 'Category Not Found' };

    return {
        title: `Best ${category.name} Apps For 2026 — LetBuyy App Store`,
        description: `Compare and filter ${category.name} apps for LetBuyy stores.`,
    };
}

export default async function CategoryAllPage({ params, searchParams }: CategoryAllPageProps) {
    const { slug } = await params;
    const resolvedSearchParams = await searchParams;
    const categories = await AppService.getCategoriesWithFallback();
    const category = categories.find((item) => item.slug === slug) || APP_CATEGORIES.find((item) => item.slug === slug);
    if (!category) notFound();

    const page = normalizePage(resolvedSearchParams?.page);
    const sort = normalizeSort(resolvedSearchParams?.sort);
    const pricing = normalizePricing(resolvedSearchParams?.pricing);
    const rating = normalizeRating(resolvedSearchParams?.rating_min || resolvedSearchParams?.rating);
    const program = normalizeProgram(resolvedSearchParams?.program);
    const featureHandles = normalizeFeatureHandles(
        resolvedSearchParams?.feature_handles,
        resolvedSearchParams?.['feature_handles[]'],
        resolvedSearchParams?.feature,
    );
    const basePath = `/categories/${slug}/all`;
    const query = {
        sort: sort === 'popular' ? undefined : sort,
        pricing: pricing || undefined,
        rating_min: rating || undefined,
        program: program || undefined,
        'feature_handles[]': featureHandles,
    };

    const [result, builtForCountResult, featureGroups] = await Promise.all([
        AppService.listApps({
            builtForLetbuyy: program === 'built-for-letbuyy',
            category: slug,
            featureHandles,
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
            pricingModel: pricing || undefined,
            ratingMin: rating || undefined,
            sort,
        }),
        AppService.listApps({
            builtForLetbuyy: true,
            category: slug,
            limit: 1,
            offset: 0,
            sort: 'popular',
        }),
        AppService.getCategoryFeatureFacets(slug, featureHandles),
    ]);

    const apps = result.ok ? result.value.apps : [];
    const total = result.ok ? result.value.total : 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const builtForCount = builtForCountResult.ok ? builtForCountResult.value.total : 0;

    return (
        <>
            <Header />
            <main className="appstore-main browse-page">
                <MarketplaceBreadcrumbs
                    items={[
                        { label: 'Home', href: '/' },
                        { label: 'Categories', href: '/categories' },
                        { label: category.name, href: `/categories/${slug}` },
                        { label: 'All apps' },
                    ]}
                />

                <header className="browse-heading">
                    <div>
                        <p className="marketplace-eyebrow">{category.group || 'Category'}</p>
                        <h1>{category.name} apps</h1>
                        <p>{total.toLocaleString('en-IN')} {total === 1 ? 'app' : 'apps'} match the current filters.</p>
                    </div>
                    {program === 'built-for-letbuyy' ? (
                        <Badge variant="success" label="Built for LetBuyy" />
                    ) : null}
                </header>

                <div className="browse-layout">
                    <aside className="browse-filter-rail" aria-label="Browse filters">
                        {builtForCount > 0 ? (
                            <section>
                                <h2>Programs</h2>
                                <FilterLink
                                    active={program === ''}
                                    href={hrefWith(basePath, query, { program: undefined, page: 1 })}
                                >
                                    All programs
                                </FilterLink>
                                <FilterLink
                                    active={program === 'built-for-letbuyy'}
                                    href={hrefWith(basePath, query, { program: 'built-for-letbuyy', page: 1 })}
                                >
                                    Built for LetBuyy
                                </FilterLink>
                            </section>
                        ) : null}

                        <FeatureFacetSections
                            basePath={basePath}
                            featureHandles={featureHandles}
                            groups={featureGroups}
                            query={query}
                        />

                        <section>
                            <h2>Pricing</h2>
                            {PRICING_OPTIONS.map((option) => (
                                <FilterLink
                                    key={option.value || 'all-pricing'}
                                    active={pricing === option.value}
                                    href={hrefWith(basePath, query, { pricing: option.value || undefined, page: 1 })}
                                >
                                    {option.label}
                                </FilterLink>
                            ))}
                        </section>

                        <section>
                            <h2>Rating</h2>
                            {RATING_OPTIONS.map((option) => (
                                <FilterLink
                                    key={option.value || 'any-rating'}
                                    active={rating === option.value}
                                    href={hrefWith(basePath, query, { rating_min: option.value || undefined, page: 1 })}
                                >
                                    {option.label}
                                </FilterLink>
                            ))}
                        </section>
                    </aside>

                    <section className="browse-results" aria-labelledby="browse-results-title">
                        <div className="browse-results__toolbar">
                            <h2 id="browse-results-title">{total.toLocaleString('en-IN')} results</h2>
                            <div className="browse-sort-links" aria-label="Sort results">
                                {SORT_OPTIONS.map((option) => (
                                    <Link
                                        key={option.value}
                                        href={hrefWith(basePath, query, { sort: option.value === 'popular' ? undefined : option.value, page: 1 })}
                                        className={sort === option.value ? 'active' : undefined}
                                        aria-current={sort === option.value ? 'true' : undefined}
                                    >
                                        {option.label}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {!result.ok ? (
                            <MarketplaceUnavailable />
                        ) : apps.length > 0 ? (
                            <>
                                <div className="browse-result-list">
                                    {apps.map((app) => (
                                        <AppCard key={app.id} app={app} variant="row" />
                                    ))}
                                </div>
                                <MarketplacePagination
                                    basePath={basePath}
                                    currentPage={page}
                                    query={query}
                                    totalPages={totalPages}
                                />
                            </>
                        ) : (
                            <EmptyState
                                kind="apps"
                                title="No apps match these filters"
                                body="Try clearing a filter or return to the category landing page to browse broader recommendations."
                            />
                        )}
                    </section>
                </div>
            </main>
            <Footer />
        </>
    );
}
