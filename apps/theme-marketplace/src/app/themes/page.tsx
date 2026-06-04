import Link from 'next/link';
import type { Theme, ThemeCategory, ThemePricingType, ThemeSearchFilters } from '@letbuyy/theme-engine';
import { Card, EmptyState, Page, PageContent, PageHeader, Search, Section, X } from '@letbuyy/ui';
import ThemeCard from '@/components/theme-card';
import ThemeUploadPanel from '@/components/theme-upload-panel';
import { ThemeService } from '@/lib/theme-service';
import { CATEGORY_LABELS } from '@/lib/utils';

type SearchParamValue = string | string[] | undefined;
type ThemesPageSearchParams = Record<string, SearchParamValue>;
type PricingFilter = 'all' | 'free' | 'paid' | 'one_time' | 'subscription';

const CATEGORY_OPTIONS: Array<{ value: 'all' | ThemeCategory; label: string; description: string }> = [
    { value: 'all', label: 'All themes', description: 'Every storefront, portfolio, resume, and landing page template.' },
    { value: 'store', label: 'Store', description: 'Commerce-ready themes for catalogs, carts, and checkout.' },
    { value: 'portfolio', label: 'Portfolio', description: 'Visual case studies and creator showcases.' },
    { value: 'resume', label: 'Resume', description: 'Profiles, CVs, and professional proof pages.' },
    { value: 'landing', label: 'Landing', description: 'Launch, lead capture, and campaign layouts.' },
    { value: 'saas', label: 'SaaS', description: 'Product-led software and subscription pages.' },
];

const PRICING_OPTIONS: Array<{ value: PricingFilter; label: string; description: string }> = [
    { value: 'all', label: 'All prices', description: 'Free, one-time, and subscription themes.' },
    { value: 'free', label: 'Free', description: 'No marketplace purchase required.' },
    { value: 'paid', label: 'Paid', description: 'Commercial themes with purchase flow.' },
];

const SORT_OPTIONS: Array<{ value: NonNullable<ThemeSearchFilters['sort']>; label: string }> = [
    { value: 'popular', label: 'Most popular' },
    { value: 'rating', label: 'Highest rated' },
    { value: 'recent', label: 'Recently published' },
    { value: 'name', label: 'Name A-Z' },
    { value: 'price_low', label: 'Price: low to high' },
    { value: 'price_high', label: 'Price: high to low' },
];

const CATEGORY_PREVIEW_FALLBACK: Record<ThemeCategory, string> = {
    store: '/previews/store.png',
    portfolio: '/previews/portfolio.png',
    resume: '/previews/resume.png',
    landing: '/previews/landing.png',
    saas: '/previews/landing.png',
};

function firstParam(value: SearchParamValue): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
}

function trimSearch(value: SearchParamValue): string {
    return (firstParam(value) ?? '').trim().slice(0, 80);
}

function normalizeCategory(value: SearchParamValue): 'all' | ThemeCategory {
    const category = firstParam(value);
    return CATEGORY_OPTIONS.some((option) => option.value === category) ? category as 'all' | ThemeCategory : 'all';
}

function normalizePricing(value: SearchParamValue): PricingFilter {
    const pricing = firstParam(value);
    return PRICING_OPTIONS.some((option) => option.value === pricing) || pricing === 'one_time' || pricing === 'subscription'
        ? pricing as PricingFilter
        : 'all';
}

function normalizeSort(value: SearchParamValue): NonNullable<ThemeSearchFilters['sort']> {
    const sort = firstParam(value);
    if (sort === 'newest') return 'recent';
    return SORT_OPTIONS.some((option) => option.value === sort) ? sort as NonNullable<ThemeSearchFilters['sort']> : 'popular';
}

function pricingForService(pricing: PricingFilter): string | undefined {
    if (pricing === 'all') return undefined;
    if (pricing === 'paid') return 'one_time';
    return pricing;
}

function buildThemesHref(
    filters: { query: string; category: 'all' | ThemeCategory; pricing: PricingFilter; sort: NonNullable<ThemeSearchFilters['sort']> },
    updates: Partial<{ query: string; category: 'all' | ThemeCategory; pricing: PricingFilter; sort: NonNullable<ThemeSearchFilters['sort']> }>,
) {
    const next = { ...filters, ...updates };
    const params = new URLSearchParams();

    if (next.query) params.set('q', next.query);
    if (next.category !== 'all') params.set('category', next.category);
    if (next.pricing !== 'all') params.set('pricing', next.pricing);
    if (next.sort !== 'popular') params.set('sort', next.sort);

    const query = params.toString();
    return query ? `/themes?${query}` : '/themes';
}

function stringValue(record: Record<string, unknown>, key: string, fallback = ''): string {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(record: Record<string, unknown>, key: string, fallback = 0): number {
    const value = record[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringArrayValue(record: Record<string, unknown>, key: string): string[] {
    const value = record[key];
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function recordValue(record: Record<string, unknown>, key: string): Record<string, unknown> {
    const value = record[key];
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function colorPresetValue(record: Record<string, unknown>): Theme['color_presets'] {
    const value = record.color_presets;
    if (!Array.isArray(value)) return [];

    return value.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const preset = item as Record<string, unknown>;
        const name = typeof preset.name === 'string' ? preset.name : '';
        const colors = preset.colors && typeof preset.colors === 'object' && !Array.isArray(preset.colors)
            ? Object.fromEntries(
                Object.entries(preset.colors as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
            )
            : {};

        return name ? [{ name, colors }] : [];
    });
}

function normalizeThemeRecord(record: Record<string, unknown>): Theme {
    const category = normalizeCategory(record.category as SearchParamValue);
    const themeCategory: ThemeCategory = category === 'all' ? 'store' : category;
    const slug = stringValue(record, 'slug', stringValue(record, 'id', 'theme'));
    const pricingType = stringValue(record, 'letbuyy_pricing_type', 'free') as ThemePricingType;
    const thumbnail = stringValue(record, 'thumbnail_url', CATEGORY_PREVIEW_FALLBACK[themeCategory]);

    return {
        id: stringValue(record, 'id', slug),
        slug,
        name: stringValue(record, 'name', 'Untitled theme'),
        description: stringValue(record, 'description', 'Theme catalog details are not available yet.'),
        long_description: stringValue(record, 'long_description', stringValue(record, 'description')),
        category: themeCategory,
        industry: stringArrayValue(record, 'industry'),
        theme_preset_id: stringValue(record, 'theme_preset_id'),
        version: stringValue(record, 'version', '1.0.0'),
        is_active: record.is_active === undefined ? true : Boolean(record.is_active),
        letbuyy_pricing_type: ['free', 'one_time', 'subscription'].includes(pricingType) ? pricingType : 'free',
        letbuyy_price_usd: numberValue(record, 'letbuyy_price_usd'),
        letbuyy_price_inr: numberValue(record, 'letbuyy_price_inr'),
        wordpress_price_usd: numberValue(record, 'wordpress_price_usd'),
        shopify_price_usd: numberValue(record, 'shopify_price_usd'),
        html_price_usd: numberValue(record, 'html_price_usd'),
        react_price_usd: numberValue(record, 'react_price_usd'),
        thumbnail_url: thumbnail,
        preview_url: stringValue(record, 'preview_url', thumbnail),
        screenshots: stringArrayValue(record, 'screenshots'),
        demo_url: stringValue(record, 'demo_url'),
        customizable_sections: recordValue(record, 'customizable_sections'),
        color_presets: colorPresetValue(record),
        font_options: stringArrayValue(record, 'font_options'),
        author_id: stringValue(record, 'author_id') || null,
        author_name: stringValue(record, 'author_name', 'LetBuyy'),
        tags: stringArrayValue(record, 'tags'),
        features: stringArrayValue(record, 'features'),
        supported_platforms: stringArrayValue(record, 'supported_platforms'),
        rating: numberValue(record, 'rating'),
        review_count: numberValue(record, 'review_count'),
        install_count: numberValue(record, 'install_count'),
        download_count: numberValue(record, 'download_count'),
        purchase_count: numberValue(record, 'purchase_count'),
        published_at: stringValue(record, 'published_at') || null,
        created_at: stringValue(record, 'created_at'),
        updated_at: stringValue(record, 'updated_at'),
    };
}

function getActiveFilterSummary(category: 'all' | ThemeCategory, pricing: PricingFilter, query: string) {
    const filters = [
        category !== 'all' ? CATEGORY_LABELS[category]?.label ?? category : null,
        pricing !== 'all' ? PRICING_OPTIONS.find((option) => option.value === pricing)?.label ?? pricing : null,
        query ? `Search: ${query}` : null,
    ].filter((item): item is string => Boolean(item));

    return filters.length ? filters.join(' / ') : 'All themes';
}

export default async function ThemesPage({
    searchParams,
}: {
    searchParams?: Promise<ThemesPageSearchParams>;
}) {
    const params = await searchParams;
    const query = trimSearch(params?.q ?? params?.search);
    const category = normalizeCategory(params?.category);
    const pricing = normalizePricing(params?.pricing ?? params?.pricingType);
    const sort = normalizeSort(params?.sort);
    const filters = { query, category, pricing, sort };

    const result = await ThemeService.listThemes({
        category: category === 'all' ? undefined : category,
        pricingType: pricingForService(pricing),
        search: query || undefined,
        sort,
        limit: 30,
    });
    const themes = result.themes.map(normalizeThemeRecord);
    const activeFilterCount = [category !== 'all', pricing !== 'all', query.length > 0].filter(Boolean).length;

    return (
        <Page className="theme-marketplace-page">
            <PageHeader
                title="Theme Gallery"
                eyebrow="Theme marketplace"
                description="Browse governed LetBuyy themes by category, pricing, and launch intent."
                identity="themes"
                showEyebrow
                showDescription
                primaryAction={{ label: 'View pricing', href: '/pricing' }}
                secondaryActions={[{ label: 'Dashboard', href: '/dashboard' }]}
            />

            <PageContent>
                <div className="grid gap-[var(--lb-density-section-gap)] lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
                    <aside className="flex flex-col gap-[var(--lb-density-section-gap)]" aria-label="Theme filters">
                        <Card layout="stack" className="theme-filter-rail gap-[var(--lb-space-4)] p-[var(--lb-density-card-padding)]">
                            <div>
                                <p className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                    Search and filter
                                </p>
                                <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                    URL-backed filters keep marketplace reviews and QA reproducible.
                                </p>
                            </div>

                            <form action="/themes" method="get" className="flex flex-col gap-[var(--lb-space-2)]">
                                <label htmlFor="theme-search" className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                    Search themes
                                </label>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-[var(--lb-space-3)] top-1/2 h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] -translate-y-1/2 text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                                    <input
                                        id="theme-search"
                                        name="q"
                                        type="search"
                                        defaultValue={query}
                                        placeholder="Search by name or tag"
                                        className="h-[var(--lb-density-input-height)] w-full rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] pl-[calc(var(--lb-space-6)+var(--lb-space-1))] pr-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] outline-none transition-colors placeholder:text-[color:var(--lb-color-text-muted)] focus:border-[var(--lb-component-input-focus-border)] focus:ring-2 focus:ring-[var(--lb-color-focus-ring)]"
                                    />
                                </div>
                                {category !== 'all' && <input type="hidden" name="category" value={category} />}
                                {pricing !== 'all' && <input type="hidden" name="pricing" value={pricing} />}
                                {sort !== 'popular' && <input type="hidden" name="sort" value={sort} />}
                                <button
                                    type="submit"
                                    className="inline-flex h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-primary-text)] transition-colors hover:bg-[var(--lb-component-button-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    Apply search
                                </button>
                            </form>

                            <div className="space-y-[var(--lb-space-2)]">
                                <p className="m-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                    Category
                                </p>
                                <div className="flex flex-col gap-[var(--lb-space-2)]">
                                    {CATEGORY_OPTIONS.map((option) => (
                                        <Link
                                            key={option.value}
                                            href={buildThemesHref(filters, { category: option.value })}
                                            aria-current={category === option.value ? 'page' : undefined}
                                            className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-small)] leading-[var(--lb-line-height-small)] text-[color:var(--lb-color-text)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] aria-[current=page]:border-[var(--lb-color-primary)] aria-[current=page]:bg-[var(--lb-color-primary-soft)]"
                                        >
                                            <span className="block font-[var(--lb-font-weight-semibold)]">{option.label}</span>
                                            <span className="block text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                                                {option.description}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-[var(--lb-space-2)]">
                                <p className="m-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                    Pricing
                                </p>
                                <div className="grid gap-[var(--lb-space-2)]">
                                    {PRICING_OPTIONS.map((option) => (
                                        <Link
                                            key={option.value}
                                            href={buildThemesHref(filters, { pricing: option.value })}
                                            aria-current={pricing === option.value ? 'page' : undefined}
                                            className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-small)] text-[color:var(--lb-color-text)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] aria-[current=page]:border-[var(--lb-color-primary)] aria-[current=page]:bg-[var(--lb-color-primary-soft)]"
                                        >
                                            <span className="block font-[var(--lb-font-weight-semibold)]">{option.label}</span>
                                            <span className="block text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                                                {option.description}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            <form action="/themes" method="get" className="flex flex-col gap-[var(--lb-space-2)]">
                                <label htmlFor="theme-sort" className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                    Sort
                                </label>
                                {query && <input type="hidden" name="q" value={query} />}
                                {category !== 'all' && <input type="hidden" name="category" value={category} />}
                                {pricing !== 'all' && <input type="hidden" name="pricing" value={pricing} />}
                                <select
                                    id="theme-sort"
                                    name="sort"
                                    defaultValue={sort}
                                    className="h-[var(--lb-density-input-height)] w-full rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] outline-none focus:border-[var(--lb-component-input-focus-border)] focus:ring-2 focus:ring-[var(--lb-color-focus-ring)]"
                                >
                                    {SORT_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="submit"
                                    className="inline-flex h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)] transition-colors hover:bg-[var(--lb-component-button-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    Apply sort
                                </button>
                            </form>

                            {activeFilterCount > 0 && (
                                <Link
                                    href="/themes"
                                    className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    <X className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
                                </Link>
                            )}
                        </Card>

                        <ThemeUploadPanel />
                    </aside>

                    <Section
                        title={activeFilterCount > 0 ? 'Filtered theme results' : 'Theme directory'}
                        description={`${result.total} theme${result.total === 1 ? '' : 's'} found. ${getActiveFilterSummary(category, pricing, query)}.`}
                    >
                        {themes.length > 0 ? (
                            <div className="grid grid-cols-1 gap-[var(--lb-space-4)] md:grid-cols-2 xl:grid-cols-3">
                                {themes.map((theme) => (
                                    <ThemeCard key={theme.id} theme={theme} />
                                ))}
                            </div>
                        ) : (
                            <Card className="flex min-h-[360px] items-center justify-center p-[var(--lb-density-card-padding)]">
                                <EmptyState
                                    kind="themes"
                                    title="Theme catalog data is not available yet"
                                    body="The marketplace is ready to render theme rows from the existing catalog API. Seed or connect theme data to populate this directory."
                                    primaryAction={(
                                        <Link
                                            href="/themes"
                                            className="inline-flex h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-primary-text)] transition-colors hover:bg-[var(--lb-component-button-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                        >
                                            Clear filters
                                        </Link>
                                    )}
                                    secondaryAction={(
                                        <Link
                                            href="/pricing"
                                            className="inline-flex h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)] transition-colors hover:bg-[var(--lb-component-button-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                        >
                                            View pricing
                                        </Link>
                                    )}
                                />
                            </Card>
                        )}
                    </Section>
                </div>
            </PageContent>
        </Page>
    );
}
