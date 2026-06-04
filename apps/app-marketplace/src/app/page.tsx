import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AppCard } from '@/components/AppCard';
import { AppService, type AppFilters } from '@/lib/app-service';
import { APP_CATEGORIES } from '@/lib/constants/categories';
import {
    Card,
    EmptyState,
    LayoutGrid,
    MaterialIcon,
    Page,
    PageContent,
    PageHeader,
    Search,
    Section,
    Sparkles,
    Star,
    type MaterialIconName,
} from '@letbuyy/ui';

type MarketplacePageSearchParams = Promise<{
    q?: string | string[];
    category?: string | string[];
    sort?: string | string[];
}>;

const SORT_OPTIONS: Array<{ value: NonNullable<AppFilters['sort']>; label: string }> = [
    { value: 'popular', label: 'Most popular' },
    { value: 'rating', label: 'Top rated' },
    { value: 'recent', label: 'Newest' },
    { value: 'name', label: 'A to Z' },
];

const HIGHLIGHT_CATEGORIES = APP_CATEGORIES.slice(0, 12);

function firstParam(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
}

function normalizeQuery(value: string | string[] | undefined): string {
    return firstParam(value).trim().slice(0, 80);
}

function normalizeCategory(value: string | string[] | undefined): string | undefined {
    const category = firstParam(value);
    return APP_CATEGORIES.some((item) => item.slug === category) ? category : undefined;
}

function normalizeSort(value: string | string[] | undefined): NonNullable<AppFilters['sort']> {
    const sort = firstParam(value);
    return SORT_OPTIONS.some((option) => option.value === sort) ? (sort as NonNullable<AppFilters['sort']>) : 'popular';
}

function getCategoryName(slug: string | undefined): string {
    if (!slug) return 'All categories';
    return APP_CATEGORIES.find((category) => category.slug === slug)?.name ?? 'All categories';
}

function buildMarketplaceHref({
    q,
    category,
    sort,
}: {
    q?: string;
    category?: string;
    sort?: NonNullable<AppFilters['sort']>;
}): string {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (sort && sort !== 'popular') params.set('sort', sort);
    const query = params.toString();
    return query ? `/?${query}` : '/';
}

export default async function MarketplacePage({
    searchParams,
}: {
    searchParams?: MarketplacePageSearchParams;
}) {
    const params = await searchParams;
    const query = normalizeQuery(params?.q);
    const category = normalizeCategory(params?.category);
    const sort = normalizeSort(params?.sort);
    const hasActiveFilters = Boolean(query || category || sort !== 'popular');

    const catalog = query
        ? await AppService.searchApps(query, category, 24)
        : await AppService.listApps({ category, sort, limit: 24 });

    const resultCount = catalog.total || catalog.apps.length;
    const activeCategoryLabel = getCategoryName(category);
    const resultSummary = `${resultCount.toLocaleString('en-IN')} ${resultCount === 1 ? 'app' : 'apps'}`;

    return (
        <>
            <Header />
            <Page className="appstore-main">
                <PageHeader
                    title="LetBuyy App Store"
                    description="Find vetted apps for product sourcing, checkout, shipping, marketing, analytics, and store operations."
                    eyebrow="Marketplace"
                    identity="apps"
                    showDescription
                    showEyebrow
                    primaryAction={{
                        label: 'Browse categories',
                        href: '/categories',
                        icon: <LayoutGrid size={16} aria-hidden="true" />,
                    }}
                    secondaryActions={[
                        {
                            label: 'Developer portal',
                            href: '/developers',
                            icon: <Sparkles size={16} aria-hidden="true" />,
                        },
                    ]}
                />

                <PageContent>
                    <Card>
                        <Section
                            title="Search and filter apps"
                            description="Use URL-backed filters to keep marketplace discovery shareable and deterministic."
                        >
                            <form
                                action="/"
                                className="grid gap-[var(--lb-space-3)] md:grid-cols-[minmax(0,1.6fr)_minmax(180px,0.7fr)_minmax(160px,0.6fr)_auto] md:items-end"
                            >
                                <label className="grid min-w-0 gap-[var(--lb-space-1)]">
                                    <span className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        Search
                                    </span>
                                    <span className="flex h-[var(--lb-density-button-height-large)] min-w-0 items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[color:var(--lb-color-text)] focus-within:border-[var(--lb-color-primary)] focus-within:ring-2 focus-within:ring-[var(--lb-color-focus-ring)]">
                                        <Search size={16} aria-hidden="true" />
                                        <input
                                            name="q"
                                            defaultValue={query}
                                            placeholder="Search apps, integrations, categories..."
                                            className="min-w-0 flex-1 border-0 bg-transparent text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] outline-none placeholder:text-[color:var(--lb-color-text-muted)]"
                                        />
                                    </span>
                                </label>

                                <label className="grid min-w-0 gap-[var(--lb-space-1)]">
                                    <span className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        Category
                                    </span>
                                    <select
                                        name="category"
                                        defaultValue={category ?? ''}
                                        className="h-[var(--lb-density-button-height-large)] min-w-0 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)] outline-none focus:border-[var(--lb-color-primary)] focus:ring-2 focus:ring-[var(--lb-color-focus-ring)]"
                                    >
                                        <option value="">All categories</option>
                                        {APP_CATEGORIES.map((item) => (
                                            <option key={item.slug} value={item.slug}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="grid min-w-0 gap-[var(--lb-space-1)]">
                                    <span className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        Sort
                                    </span>
                                    <select
                                        name="sort"
                                        defaultValue={sort}
                                        className="h-[var(--lb-density-button-height-large)] min-w-0 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)] outline-none focus:border-[var(--lb-color-primary)] focus:ring-2 focus:ring-[var(--lb-color-focus-ring)]"
                                    >
                                        {SORT_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <button
                                    type="submit"
                                    className="inline-flex h-[var(--lb-density-button-height-large)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-component-button-primary-text)] hover:bg-[var(--lb-component-button-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    <Search size={16} aria-hidden="true" />
                                    Apply
                                </button>
                            </form>

                            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]" aria-label="Category quick filters">
                                <Link
                                    href={buildMarketplaceHref({ q: query, sort })}
                                    className={`inline-flex min-h-[var(--lb-density-pill-height)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border px-[var(--lb-space-3)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-badge)] ${!category ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]' : 'border-[var(--lb-color-border)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)]'}`}
                                >
                                    All categories
                                </Link>
                                {HIGHLIGHT_CATEGORIES.map((item) => {
                                    const active = item.slug === category;
                                    return (
                                        <Link
                                            key={item.slug}
                                            href={buildMarketplaceHref({ q: query, category: item.slug, sort })}
                                            className={`inline-flex min-h-[var(--lb-density-pill-height)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border px-[var(--lb-space-3)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-badge)] ${active ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]' : 'border-[var(--lb-color-border)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)]'}`}
                                        >
                                            <MaterialIcon name={(item.icon ?? 'category') as MaterialIconName} className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        </Section>
                    </Card>

                    <Card>
                        <Section
                            title={hasActiveFilters ? 'Filtered app results' : 'App directory'}
                            description={`${resultSummary} shown for ${activeCategoryLabel}${query ? ` matching "${query}"` : ''}.`}
                            action={
                                hasActiveFilters ? (
                                    <Link
                                        href="/"
                                        className="inline-flex h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)] hover:bg-[var(--lb-component-button-secondary-hover)]"
                                    >
                                        Clear filters
                                    </Link>
                                ) : (
                                    <span className="inline-flex min-h-[var(--lb-density-pill-height)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]">
                                        <Star size={14} aria-hidden="true" />
                                        Sorted by {SORT_OPTIONS.find((option) => option.value === sort)?.label}
                                    </span>
                                )
                            }
                        >
                            {catalog.apps.length > 0 ? (
                                <div className="grid gap-[var(--lb-density-card-gap)] md:grid-cols-2 xl:grid-cols-3">
                                    {catalog.apps.map((app) => (
                                        <AppCard key={app.id} app={app} />
                                    ))}
                                </div>
                            ) : (
                                <EmptyState
                                    kind="apps"
                                    title={hasActiveFilters ? 'No matching apps yet' : 'App catalog data is not available yet'}
                                    body={
                                        hasActiveFilters
                                            ? 'Try clearing filters or choosing another category. Live marketplace results will appear here when the app catalog API has data for this view.'
                                            : 'The marketplace shell is ready, but the app catalog API returned no rows in this environment.'
                                    }
                                />
                            )}
                        </Section>
                    </Card>
                </PageContent>
            </Page>
            <Footer />
        </>
    );
}
