'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AppCard } from '@/components/AppCard';
import { logger } from '@/lib/logger';
import { MarketplaceUnavailable } from '@/components/MarketplaceUnavailable';
import { RequestAppPanel } from '@/components/RequestAppPanel';
import { getAppPriceDisplay, getAppRating, getCategoryName, getDeveloperName, sanitizeMarketplaceSearchQuery } from '@/lib/marketplace-display';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { Button, Input, ListChecks, MaterialIcon, Search, X, type MaterialIconName } from '@letbuyy/ui';
import type { MarketplaceApp, MarketplaceAppCategory, MarketplaceAppFeatureGroup } from '@letbuyy/shared-types';

const PAGE_SIZE = 20;

const PRICING_FILTERS = [
    { value: '', label: 'All' },
    { value: 'free', label: 'Free' },
    { value: 'freemium', label: 'Freemium' },
    { value: 'paid', label: 'Paid' },
    { value: 'usage', label: 'Usage' },
] as const;

const RATING_FILTERS = [
    { value: '', label: 'Any rating' },
    { value: '4', label: '4+ stars' },
    { value: '3', label: '3+ stars' },
] as const;

function normalizeSort(value: string | null): string {
    return ['popular', 'rating', 'recent', 'name'].includes(value || '') ? String(value) : 'popular';
}

function normalizePricing(value: string | null): string {
    return ['free', 'freemium', 'paid', 'usage'].includes(value || '') ? String(value) : '';
}

function normalizeRating(value: string | null): string {
    return ['4', '3'].includes(value || '') ? String(value) : '';
}

function normalizePage(value: string | null): number {
    const parsed = Number.parseInt(value || '1', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeFeatureHandles(values: string[]): string[] {
    return Array.from(new Set(values.flatMap((value) => value.split(','))
        .map((value) => value.trim().toLowerCase())
        .filter((value) => /^[a-z0-9][a-z0-9-]{1,120}$/.test(value)))).slice(0, 24);
}

function paginationPages(page: number, totalPages: number): Array<number | 'ellipsis'> {
    const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
    if (page <= 4) {
        pages.add(2);
        pages.add(3);
        pages.add(4);
    }
    if (page >= totalPages - 3) {
        pages.add(totalPages - 1);
        pages.add(totalPages - 2);
        pages.add(totalPages - 3);
    }

    const sorted = Array.from(pages)
        .filter((item) => item >= 1 && item <= totalPages)
        .sort((a, b) => a - b);

    const tokens: Array<number | 'ellipsis'> = [];
    for (const item of sorted) {
        const previous = tokens[tokens.length - 1];
        if (typeof previous === 'number' && item - previous > 1) tokens.push('ellipsis');
        tokens.push(item);
    }
    return tokens;
}

function recordDiscoveryEvent(input: {
    event_type: 'search' | 'zero_results' | 'app_click';
    app_id?: string;
    search_query?: string;
    result_count?: number;
    metadata?: Record<string, unknown>;
}) {
    void fetch('/api/apps/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        keepalive: true,
    }).catch(() => undefined);
}

function SearchContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = sanitizeMarketplaceSearchQuery(searchParams.get('q') || '');
    const [query, setQuery] = useState(initialQuery);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(searchParams.get('category'));
    const [sortBy, setSortBy] = useState(normalizeSort(searchParams.get('sort')));
    const [pricing, setPricing] = useState(normalizePricing(searchParams.get('pricing')));
    const [rating, setRating] = useState(normalizeRating(searchParams.get('rating')));
    const [featureHandles, setFeatureHandles] = useState(() => normalizeFeatureHandles([
        ...searchParams.getAll('feature_handles'),
        ...searchParams.getAll('feature_handles[]'),
    ]));
    const [page, setPage] = useState(normalizePage(searchParams.get('page')));
    const [categories, setCategories] = useState<MarketplaceAppCategory[]>([]);
    const [featureGroups, setFeatureGroups] = useState<MarketplaceAppFeatureGroup[]>([]);
    const [results, setResults] = useState<MarketplaceApp[]>([]);
    const [compareApps, setCompareApps] = useState<MarketplaceApp[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [errored, setErrored] = useState(false);

    useEffect(() => {
        let mounted = true;
        fetch('/api/apps/search?kind=categories')
            .then((res) => res.ok ? res.json() : null)
            .then((data: { categories?: MarketplaceAppCategory[] } | null) => {
                if (mounted) setCategories(data?.categories || []);
            })
            .catch(() => {
                if (mounted) setCategories([]);
            });
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!selectedCategory) {
            setFeatureGroups([]);
            return;
        }

        let mounted = true;
        const params = new URLSearchParams({ kind: 'feature_facets', category: selectedCategory });
        for (const handle of featureHandles) params.append('feature_handles[]', handle);
        fetch(`/api/apps/search?${params}`)
            .then((res) => res.ok ? res.json() : null)
            .then((data: { feature_groups?: MarketplaceAppFeatureGroup[] } | null) => {
                if (mounted) setFeatureGroups(data?.feature_groups || []);
            })
            .catch(() => {
                if (mounted) setFeatureGroups([]);
            });

        return () => {
            mounted = false;
        };
    }, [featureHandles, selectedCategory]);

    const fetchApps = useCallback(async (signal: AbortSignal) => {
        setLoading(true);
        setErrored(false);
        const safeQuery = sanitizeMarketplaceSearchQuery(query);
        try {
            const params = new URLSearchParams();
            if (safeQuery) params.set('q', safeQuery);
            if (selectedCategory) params.set('category', selectedCategory);
            if (sortBy) params.set('sort', sortBy);
            if (pricing) params.set('pricing', pricing);
            if (rating) params.set('rating_min', rating);
            for (const handle of featureHandles) params.append('feature_handles[]', handle);
            params.set('limit', String(PAGE_SIZE));
            params.set('offset', String((page - 1) * PAGE_SIZE));

            const endpoint = safeQuery ? `/api/apps/search?${params}` : `/api/apps?${params}`;
            const res = await fetch(endpoint, { signal });
            if (!res.ok) {
                setErrored(true);
                setResults([]);
                setTotal(0);
                return;
            }
            const data = await res.json() as { apps?: MarketplaceApp[]; results?: MarketplaceApp[]; total?: number };
            if (signal.aborted) return;

            const apps = data.apps || data.results || [];

            setResults(apps);
            setTotal(typeof data.total === 'number' ? data.total : apps.length);
            if (safeQuery) {
                recordDiscoveryEvent({
                    event_type: apps.length === 0 ? 'zero_results' : 'search',
                    search_query: safeQuery,
                    result_count: typeof data.total === 'number' ? data.total : apps.length,
                    metadata: { category: selectedCategory, sort: sortBy, pricing, rating, page, feature_handles: featureHandles },
                });
            }
        } catch (err) {
            if (signal.aborted) return;
            logger.error('search page failed to fetch apps', { error: err instanceof Error ? err.message : String(err) });
            setErrored(true);
            setResults([]);
            setTotal(0);
        } finally {
            if (!signal.aborted) setLoading(false);
        }
    }, [featureHandles, page, pricing, query, rating, selectedCategory, sortBy]);

    useEffect(() => {
        const controller = new AbortController();
        const debounce = window.setTimeout(() => fetchApps(controller.signal), 300);
        return () => {
            controller.abort();
            window.clearTimeout(debounce);
        };
    }, [fetchApps]);

    useEffect(() => {
        const safeQuery = sanitizeMarketplaceSearchQuery(query);
        const params = new URLSearchParams();
        if (safeQuery) params.set('q', safeQuery);
        if (selectedCategory) params.set('category', selectedCategory);
        if (sortBy !== 'popular') params.set('sort', sortBy);
        if (pricing) params.set('pricing', pricing);
        if (rating) params.set('rating', rating);
        for (const handle of featureHandles) params.append('feature_handles[]', handle);
        if (page > 1) params.set('page', String(page));
        const next = params.toString() ? `/search?${params}` : '/search';
        router.replace(next, { scroll: false });
    }, [featureHandles, page, pricing, query, rating, router, selectedCategory, sortBy]);

    const retryFetch = useCallback(() => {
        const controller = new AbortController();
        void fetchApps(controller.signal);
    }, [fetchApps]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const pageTokens = paginationPages(page, totalPages);

    const toggleCompare = useCallback((app: MarketplaceApp) => {
        setCompareApps((current) => {
            if (current.some((item) => item.id === app.id)) {
                return current.filter((item) => item.id !== app.id);
            }
            return [...current, app].slice(0, 3);
        });
    }, []);

    const toggleFeatureHandle = useCallback((handle: string) => {
        setFeatureHandles((current) => {
            if (current.includes(handle)) return current.filter((item) => item !== handle);
            return [...current, handle].slice(0, 24);
        });
        setPage(1);
    }, []);

    return (
        <>
            <Header />
            <main className="appstore-main">
                <div className="search-page-header">
                    <div className="appstore-search appstore-search--page">
                        <Search size={18} />
                        <Input
                            unstyled
                            type="text"
                            placeholder="Search apps, integrations, categories..."
                            value={query}
                            onChange={(e) => {
                                setQuery(sanitizeMarketplaceSearchQuery(e.target.value));
                                setPage(1);
                            }}
                            autoFocus
                            className="search-page-input"
                        />
                    </div>
                </div>

                <div className="search-page">
                    {/* Sidebar filters */}
                    <aside className="search-sidebar">
                        <div className="search-filter-group">
                            <h3>Category</h3>
                            <Button
                                unstyled
                                type="button"
                                className={`search-filter-option ${!selectedCategory ? 'active' : ''}`}
                                onClick={() => {
                                    setSelectedCategory(null);
                                    setFeatureHandles([]);
                                    setPage(1);
                                }}
                            >
                                All categories
                            </Button>
                            {categories.map(cat => (
                                <Button
                                    unstyled
                                    type="button"
                                    key={cat.slug}
                                    className={`search-filter-option ${selectedCategory === cat.slug ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedCategory(cat.slug);
                                        setFeatureHandles([]);
                                        setPage(1);
                                    }}
                                >
                                    <MaterialIcon name={(cat.icon ?? 'category') as MaterialIconName} className="inline-icon" />
                                    {cat.name}
                                </Button>
                            ))}
                        </div>

                        {featureGroups.length > 0 ? (
                            featureGroups.map((group) => {
                                const visibleTags = (group.tags || []).filter((tag) => Number(tag.count || 0) > 0 || featureHandles.includes(tag.handle));
                                if (visibleTags.length === 0) return null;
                                return (
                                    <div key={group.id} className="search-filter-group">
                                        <h3>{group.label}</h3>
                                        {visibleTags.map((tag) => (
                                            <Button
                                                unstyled
                                                type="button"
                                                key={tag.handle}
                                                className={`search-filter-option ${featureHandles.includes(tag.handle) ? 'active' : ''}`}
                                                aria-pressed={featureHandles.includes(tag.handle)}
                                                onClick={() => toggleFeatureHandle(tag.handle)}
                                            >
                                                <span>{tag.label}</span>
                                                <span className="search-filter-count">{Number(tag.count || 0).toLocaleString('en-IN')}</span>
                                            </Button>
                                        ))}
                                    </div>
                                );
                            })
                        ) : null}

                        <div className="search-filter-group">
                            <h3>Pricing</h3>
                            {PRICING_FILTERS.map((option) => (
                                <Button
                                    unstyled
                                    type="button"
                                    key={option.value || 'all-pricing'}
                                    className={`search-filter-option ${pricing === option.value ? 'active' : ''}`}
                                    onClick={() => {
                                        setPricing(option.value);
                                        setPage(1);
                                    }}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>

                        <div className="search-filter-group">
                            <h3>Rating</h3>
                            {RATING_FILTERS.map((option) => (
                                <Button
                                    unstyled
                                    type="button"
                                    key={option.value || 'any-rating'}
                                    className={`search-filter-option ${rating === option.value ? 'active' : ''}`}
                                    onClick={() => {
                                        setRating(option.value);
                                        setPage(1);
                                    }}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </aside>

                    {/* Results */}
                    <div className="search-results">
                        <div className="search-results-header">
                            <span className="search-results-count">
                                {loading ? 'Searching...' : errored ? 'Could not load apps' : `${total.toLocaleString('en-IN')} ${total === 1 ? 'app' : 'apps'} found`}
                                {!errored && query && ` for "${query}"`}
                            </span>
                            <div className="browse-sort-links" aria-label="Sort search results">
                                {[
                                    { value: 'popular', label: 'Most popular' },
                                    { value: 'rating', label: 'Top rated' },
                                    { value: 'recent', label: 'Newest' },
                                    { value: 'name', label: 'A to Z' },
                                ].map((option) => (
                                    <Button
                                        unstyled
                                        key={option.value}
                                        type="button"
                                        className={sortBy === option.value ? 'active' : undefined}
                                        aria-pressed={sortBy === option.value}
                                        onClick={() => {
                                            setSortBy(option.value);
                                            setPage(1);
                                        }}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div className="app-card-grid">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="skeleton search-result-skeleton" />
                                ))}
                            </div>
                        ) : errored ? (
                            <MarketplaceUnavailable onRetry={retryFetch} />
                        ) : (
                            <div className="browse-result-list">
                                {results.map((app) => (
                                    <div key={app.id} className="compare-card-wrap">
                                        <Button
                                            unstyled
                                            type="button"
                                            className={`compare-toggle${compareApps.some((item) => item.id === app.id) ? ' active' : ''}`}
                                            onClick={() => toggleCompare(app)}
                                            disabled={!compareApps.some((item) => item.id === app.id) && compareApps.length >= 3}
                                        >
                                            <ListChecks size={13} aria-hidden="true" />
                                            {compareApps.some((item) => item.id === app.id) ? 'Added' : 'Compare'}
                                        </Button>
                                        <AppCard
                                            app={app}
                                            variant="row"
                                            onClick={() => recordDiscoveryEvent({
                                                event_type: 'app_click',
                                                app_id: app.id,
                                                search_query: sanitizeMarketplaceSearchQuery(query) || undefined,
                                                result_count: total,
                                                metadata: { category: selectedCategory, sort: sortBy, pricing, rating, page, feature_handles: featureHandles },
                                            })}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {!loading && !errored && results.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <Search size={32} aria-hidden="true" />
                                </div>
                                <h3>No apps found</h3>
                                <p>Try &quot;reviews&quot;, &quot;shipping&quot;, &quot;analytics&quot;, or browse Products, Orders, and Marketing categories.</p>
                                <RequestAppPanel query={query} categorySlug={selectedCategory} compact />
                            </div>
                        )}

                        {!loading && !errored && total > PAGE_SIZE && (
                            <nav className="marketplace-pagination marketplace-pagination--numbered" aria-label="Search result pagination">
                                <Button unstyled type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                                    Previous
                                </Button>
                                <ol className="marketplace-pagination__pages">
                                    {pageTokens.map((token, index) => (
                                        token === 'ellipsis' ? (
                                            <li key={`ellipsis-${index}`} className="marketplace-pagination__ellipsis" aria-hidden="true">...</li>
                                        ) : (
                                            <li key={token}>
                                                <Button
                                                    unstyled
                                                    type="button"
                                                    className={page === token ? 'active' : undefined}
                                                    aria-current={page === token ? 'page' : undefined}
                                                    onClick={() => setPage(token)}
                                                >
                                                    {token}
                                                </Button>
                                            </li>
                                        )
                                    ))}
                                </ol>
                                <Button unstyled type="button" disabled={page * PAGE_SIZE >= total} onClick={() => setPage((current) => current + 1)}>
                                    Next
                                </Button>
                            </nav>
                        )}

                        {compareApps.length > 0 && (
                            <section className="compare-tray" aria-label="Compare selected apps">
                                <div className="compare-tray__header">
                                    <div>
                                        <strong>Compare apps</strong>
                                        <span>{compareApps.length}/3 selected</span>
                                    </div>
                                    <Button unstyled type="button" onClick={() => setCompareApps([])}>
                                        Clear
                                    </Button>
                                </div>
                                <div className="compare-tray__grid">
                                    {compareApps.map((app) => {
                                        const price = getAppPriceDisplay(app);
                                        return (
                                            <article key={app.id} className="compare-tray__item">
                                                <div className="compare-tray__item-header">
                                                    <h3>{app.name}</h3>
                                                    <Button unstyled type="button" aria-label={`Remove ${app.name} from compare`} onClick={() => toggleCompare(app)}>
                                                        <X size={14} aria-hidden="true" />
                                                    </Button>
                                                </div>
                                                <dl>
                                                    <div>
                                                        <dt>Category</dt>
                                                        <dd>{getCategoryName(app)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>Developer</dt>
                                                        <dd>{getDeveloperName(app)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>Rating</dt>
                                                        <dd>{getAppRating(app).toFixed(1)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>Pricing</dt>
                                                        <dd>{price.label}</dd>
                                                    </div>
                                                </dl>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SearchContent />
        </Suspense>
    );
}
