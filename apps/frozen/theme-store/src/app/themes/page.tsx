import MarketplaceArtwork from '@/components/marketplace-artwork';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Theme, ThemeCategory, ThemePricingType, ThemeSearchFilters } from '@letbuyy/theme-engine';
import { Button, Card, EmptyState, Input, Page, PageContent, Section, X } from '@letbuyy/ui';
import ThemeCard from '@/components/theme-card';
import CatalogFilterPanel from '@/components/catalog-filter-panel';
import { ThemeService } from '@/lib/theme-service';
import MarketplaceUnavailable from '@/components/marketplace-unavailable';
import { CATEGORY_LABELS } from '@/lib/utils';

type SearchParamValue = string | string[] | undefined;
type ThemesPageSearchParams = Record<string, SearchParamValue>;
type PricingFilter = 'all' | 'free' | 'paid' | 'one_time' | 'subscription';

const PAGE_LIMIT = 30;

interface NormalizedFilters {
    query: string;
    category: 'all' | ThemeCategory;
    pricing: PricingFilter;
    sort: NonNullable<ThemeSearchFilters['sort']>;
    industry: string;
    layout: string;
    tag: string;
    feature: string;
    priceMin?: number;
    priceMax?: number;
    offset: number;
}

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
    { value: 'trending', label: 'Trending' },
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
    saas: '/previews/saas-console-card.png',
};

const LAYOUT_OPTIONS = ['standard', 'grid', 'compact', 'editorial', 'gallery', 'document', 'single-page', 'campaign', 'splash', 'product', 'startup'];

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

function normalizeIndustry(value: SearchParamValue): string {
    return (firstParam(value) ?? '').trim().toLowerCase().replace(/[^a-z0-9 -]/g, '').slice(0, 60);
}

function normalizeFacet(value: SearchParamValue): string {
    return (firstParam(value) ?? '').trim().toLowerCase().replace(/[^a-z0-9 -]/g, '').slice(0, 80);
}

function normalizePrice(value: SearchParamValue): number | undefined {
    const raw = firstParam(value)?.trim();
    if (!raw) return undefined;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric < 0) return undefined;
    return Math.floor(numeric);
}

function normalizeOffset(value: SearchParamValue): number {
    const numeric = Number(firstParam(value) ?? 0);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return Math.floor(numeric);
}

function pricingForService(pricing: PricingFilter): string | undefined {
    if (pricing === 'all') return undefined;
    if (pricing === 'paid') return 'one_time';
    return pricing;
}

function buildThemesHref(
    filters: NormalizedFilters,
    updates: Partial<NormalizedFilters>,
) {
    const next = { ...filters, ...updates };
    const params = new URLSearchParams();

    if (next.query) params.set('q', next.query);
    if (next.category !== 'all') params.set('category', next.category);
    if (next.pricing !== 'all') params.set('pricing', next.pricing);
    if (next.industry) params.set('industry', next.industry);
    if (next.layout) params.set('layout', next.layout);
    if (next.tag) params.set('tag', next.tag);
    if (next.feature) params.set('feature', next.feature);
    if (next.priceMin !== undefined) params.set('price_min', String(next.priceMin));
    if (next.priceMax !== undefined) params.set('price_max', String(next.priceMax));
    if (next.sort !== 'popular') params.set('sort', next.sort);
    if (next.offset > 0) params.set('offset', String(next.offset));

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
        rating: numberValue(record, 'rating_avg', numberValue(record, 'rating')),
        review_count: numberValue(record, 'review_count'),
        install_count: numberValue(record, 'install_count'),
        download_count: numberValue(record, 'download_count'),
        purchase_count: numberValue(record, 'purchase_count'),
        published_at: stringValue(record, 'published_at') || null,
        created_at: stringValue(record, 'created_at'),
        updated_at: stringValue(record, 'updated_at'),
    };
}

function getActiveFilterSummary(filters: NormalizedFilters) {
    const activeLabels = [
        filters.category !== 'all' ? CATEGORY_LABELS[filters.category]?.label ?? filters.category : null,
        filters.pricing !== 'all' ? PRICING_OPTIONS.find((option) => option.value === filters.pricing)?.label ?? filters.pricing : null,
        filters.industry ? `Industry: ${filters.industry}` : null,
        filters.layout ? `Layout: ${filters.layout}` : null,
        filters.tag ? `Tag: ${filters.tag}` : null,
        filters.feature ? `Feature: ${filters.feature}` : null,
        filters.priceMin !== undefined ? `Min: Rs ${filters.priceMin.toLocaleString('en-IN')}` : null,
        filters.priceMax !== undefined ? `Max: Rs ${filters.priceMax.toLocaleString('en-IN')}` : null,
        filters.query ? `Search: ${filters.query}` : null,
    ].filter((item): item is string => Boolean(item));

    return activeLabels.length ? activeLabels.join(' / ') : 'All themes';
}

function buildThemeSearchSuggestions(themes: Theme[]): string[] {
    const suggestions = new Map<string, string>();

    const addSuggestion = (value: string | undefined) => {
        const label = value?.trim();
        if (!label) return;
        const key = label.toLowerCase();
        if (!suggestions.has(key)) {
            suggestions.set(key, label.slice(0, 80));
        }
    };

    themes.forEach((theme) => {
        addSuggestion(theme.name);
        addSuggestion(theme.author_name);
        addSuggestion(CATEGORY_LABELS[theme.category]?.label ?? theme.category);
        theme.tags.forEach(addSuggestion);
        theme.industry.forEach(addSuggestion);
    });

    return Array.from(suggestions.values()).slice(0, 12);
}

function formStringValue(value: FormDataEntryValue | null): string {
    return typeof value === 'string' ? value.trim() : '';
}

async function createSavedSearchAction(formData: FormData) {
    'use server';

    const name = formStringValue(formData.get('name')) || 'Theme search';
    const query = Object.fromEntries(
        ['q', 'category', 'pricing', 'industry', 'layout', 'tag', 'feature', 'price_min', 'price_max', 'sort']
            .map((key) => [key, formStringValue(formData.get(key))] as const)
            .filter(([, value]) => value.length > 0),
    );
    const currentHref = formStringValue(formData.get('current_href')) || '/themes';

    try {
        await ThemeService.createSavedSearch({
            name,
            query,
            alerts_enabled: formData.get('alerts_enabled') === 'on',
        });
    } catch {
        redirect(`${currentHref}${currentHref.includes('?') ? '&' : '?'}saved_search=auth`);
    }

    redirect(`${currentHref}${currentHref.includes('?') ? '&' : '?'}saved_search=created`);
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
    const industry = normalizeIndustry(params?.industry);
    const layout = normalizeFacet(params?.layout);
    const tag = normalizeFacet(params?.tag);
    const feature = normalizeFacet(params?.feature);
    const priceMin = normalizePrice(params?.price_min);
    const priceMax = normalizePrice(params?.price_max);
    const offset = normalizeOffset(params?.offset);
    const filters: NormalizedFilters = { query, category, pricing, sort, industry, layout, tag, feature, priceMin, priceMax, offset };
    const [industries, suggestions, result] = await Promise.all([
        ThemeService.getIndustries(),
        ThemeService.getThemeSuggestions(query),
        ThemeService.listThemes({
            category: category === 'all' ? undefined : category,
            pricingType: pricingForService(pricing),
            industry: industry || undefined,
            layout: layout || undefined,
            tag: tag || undefined,
            feature: feature || undefined,
            priceMin,
            priceMax,
            search: query || undefined,
            sort,
            limit: PAGE_LIMIT,
            offset,
        }),
    ]);
    const industryOptions = industries;
    const themesUnavailable = !result.ok;
    const themeTotal = result.ok ? result.value.total : 0;
    const currentLimit = result.ok ? result.value.limit : PAGE_LIMIT;
    const themes = result.ok ? result.value.themes.map(normalizeThemeRecord) : [];
    const activeFilterCount = [
        category !== 'all',
        pricing !== 'all',
        industry.length > 0,
        layout.length > 0,
        tag.length > 0,
        feature.length > 0,
        priceMin !== undefined,
        priceMax !== undefined,
        query.length > 0,
    ].filter(Boolean).length;
    const searchSuggestions = query
        ? Array.from(new Set([...suggestions.themes, ...suggestions.tags, ...suggestions.industries, ...suggestions.features])).slice(0, 12)
        : buildThemeSearchSuggestions(themes);
    const pageStart = themes.length > 0 ? offset + 1 : 0;
    const pageEnd = offset + themes.length;
    const hasPreviousPage = offset > 0;
    const hasNextPage = !themesUnavailable && pageEnd < themeTotal;
    const previousOffset = Math.max(offset - currentLimit, 0);
    const nextOffset = offset + currentLimit;
    const currentPage = Math.floor(offset / currentLimit) + 1;
    const totalPages = currentLimit > 0 ? Math.max(1, Math.ceil(themeTotal / currentLimit)) : 1;
    const pageNumbers = Array.from(
        new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages].filter((page) => page >= 1 && page <= totalPages)),
    );
    const currentHref = buildThemesHref(filters, { offset });

    return (
        <Page className="theme-marketplace-page marketplace">
            <header className="marketplace-browse-header marketplace-container marketplace-catalog-masthead"><div>
                <p className="marketplace-eyebrow">LetBuyy Theme Store</p>
                <div className="marketplace-browse-heading"><h1>{query ? `Themes for “${query}”` : 'Find a look that feels like you.'}</h1><Link href="/themes/compare" className="marketplace-text-link">Compare themes</Link></div>
                <p>Explore the designs. Find your fit. Make it yours.</p></div><MarketplaceArtwork kind="discover" priority />
            </header>

            <PageContent>
                <div className="marketplace-catalog-grid">
                    <div>
                        <CatalogFilterPanel values={filters} industries={industryOptions} categories={CATEGORY_OPTIONS} pricing={PRICING_OPTIONS} layouts={LAYOUT_OPTIONS} sorting={SORT_OPTIONS} activeCount={activeFilterCount} />
                        <details className="marketplace-saved-search"><summary>Save this search</summary>
                        <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                            <div>
                                <p className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                    Save this search
                                </p>
                                <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                    Persist the current filters to your marketplace account.
                                </p>
                            </div>
                            <form action={createSavedSearchAction} className="grid gap-[var(--lb-space-2)]">
                                <Input unstyled type="hidden" name="current_href" value={currentHref} />
                                {query && <Input unstyled type="hidden" name="q" value={query} />}
                                {category !== 'all' && <Input unstyled type="hidden" name="category" value={category} />}
                                {pricing !== 'all' && <Input unstyled type="hidden" name="pricing" value={pricing} />}
                                {industry && <Input unstyled type="hidden" name="industry" value={industry} />}
                                {layout && <Input unstyled type="hidden" name="layout" value={layout} />}
                                {tag && <Input unstyled type="hidden" name="tag" value={tag} />}
                                {feature && <Input unstyled type="hidden" name="feature" value={feature} />}
                                {priceMin !== undefined && <Input unstyled type="hidden" name="price_min" value={String(priceMin)} />}
                                {priceMax !== undefined && <Input unstyled type="hidden" name="price_max" value={String(priceMax)} />}
                                {sort !== 'popular' && <Input unstyled type="hidden" name="sort" value={sort} />}
                                <label htmlFor="saved-search-name" className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]">
                                    Name
                                    <Input unstyled
                                        id="saved-search-name"
                                        name="name"
                                        defaultValue={activeFilterCount > 0 ? getActiveFilterSummary(filters).slice(0, 80) : 'All theme search'}
                                        minLength={2}
                                        maxLength={120}
                                        className="h-[var(--lb-density-input-height)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]"
                                    />
                                </label>
                                <label className="flex items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]">
                                    <Input unstyled name="alerts_enabled" type="checkbox" className="h-4 w-4" />
                                    Enable account alerts when provider notifications are configured
                                </label>
                                <Button unstyled
                                    type="submit"
                                    className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)] transition-colors hover:bg-[var(--lb-component-button-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    Save search
                                </Button>
                            </form>
                        </Card>
                        </details>
                        {firstParam(params?.saved_search) === 'created' && <p role="status">Saved search created.</p>}
                        {firstParam(params?.saved_search) === 'auth' && <p role="status">Sign in before saving this search.</p>}
                    </div>
                    <Section
                        title={activeFilterCount > 0 ? 'Your search results' : 'All themes'}
                        description={`${themeTotal} theme${themeTotal === 1 ? '' : 's'} found. ${getActiveFilterSummary(filters)}.`}
                    >
                        {activeFilterCount > 0 && <nav className="marketplace-active-filters" aria-label="Applied filters">
                            {[
                                [filters.query, 'Search', {query:''}],
                                [filters.category !== 'all' ? filters.category : '', 'Website type', {category:'all'}],
                                [filters.pricing !== 'all' ? filters.pricing : '', 'Price', {pricing:'all'}],
                                [filters.industry, 'Industry', {industry:''}],
                                [filters.layout, 'Layout', {layout:''}],
                                [filters.feature, 'Feature', {feature:''}],
                                [filters.tag, 'Style', {tag:''}],
                                [filters.priceMin !== undefined ? `₹${filters.priceMin}` : '', 'Minimum', {priceMin:undefined}],
                                [filters.priceMax !== undefined ? `₹${filters.priceMax}` : '', 'Maximum', {priceMax:undefined}],
                            ].filter(([value])=>Boolean(value)).map(([value,label,update])=><Link key={String(label)} href={buildThemesHref(filters,{...(update as Partial<NormalizedFilters>),offset:0})} aria-label={`Remove ${label} filter: ${value}`}>{String(label)}: {String(value)} <X size={12} aria-hidden="true" /></Link>)}
                            <Link href="/themes">Clear all</Link>
                        </nav>}
                        {query && searchSuggestions.length > 0 && <p className="marketplace-search-related">Related: {searchSuggestions.slice(0,4).map(suggestion=><Link key={suggestion} href={buildThemesHref(filters,{query:suggestion,offset:0})}>{suggestion}</Link>)}</p>}
                        {themesUnavailable ? (
                            <MarketplaceUnavailable />
                        ) : themes.length > 0 ? (
                            <div className="space-y-[var(--lb-space-4)]">
                                <div className="marketplace-theme-grid">
                                    {themes.map((theme) => (
                                        <ThemeCard key={theme.id} theme={theme} />
                                    ))}
                                </div>
                                <div className="flex flex-col gap-[var(--lb-space-3)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-3)] sm:flex-row sm:items-center sm:justify-between">
                                    <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        Showing {pageStart}-{pageEnd} of {themeTotal} themes.
                                    </p>
                                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                        {hasPreviousPage && (
                                            <Link
                                                href={buildThemesHref(filters, { offset: previousOffset })}
                                                className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)] transition-colors hover:bg-[var(--lb-component-button-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                            >
                                                Previous
                                            </Link>
                                        )}
                                        {pageNumbers.map((page) => (
                                            <Link
                                                key={page}
                                                href={buildThemesHref(filters, { offset: (page - 1) * currentLimit })}
                                                aria-current={page === currentPage ? 'page' : undefined}
                                                className="inline-flex min-h-[var(--lb-density-button-height)] min-w-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)] transition-colors hover:bg-[var(--lb-component-button-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] aria-[current=page]:border-[var(--lb-color-primary)] aria-[current=page]:bg-[var(--lb-color-primary-soft)]"
                                            >
                                                {page}
                                            </Link>
                                        ))}
                                        {hasNextPage && (
                                            <Link
                                                href={buildThemesHref(filters, { offset: nextOffset })}
                                                className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-primary-text)] transition-colors hover:bg-[var(--lb-component-button-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                            >
                                                Next
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <Card className="flex min-h-[360px] items-center justify-center p-[var(--lb-density-card-padding)]">
                                <EmptyState
                                    kind="themes"
                                    title="No themes match these filters"
                                    body="Clear filters or broaden the search to see more marketplace themes."
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
