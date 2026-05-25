'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AppCard } from '@/components/AppCard';
import { APP_CATEGORIES } from '@/lib/constants/categories';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { Search } from 'lucide-react';

function SearchContent() {
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('q') || '';
    const [query, setQuery] = useState(initialQuery);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState('popular');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchApps = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (query) params.set('search', query);
            if (selectedCategory) params.set('category', selectedCategory);
            if (sortBy) params.set('sort', sortBy);
            params.set('limit', '20');

            const endpoint = query ? `/api/apps/search?q=${encodeURIComponent(query)}&${params}` : `/api/apps?${params}`;
            const res = await fetch(endpoint);
            const data = await res.json();

            let apps = data.apps || data.results || [];

            // Client-side sort (in case API doesn't fully sort)
            if (sortBy === 'rating') apps = [...apps].sort((a: any, b: any) => (b.rating_avg || b.avg_rating || 0) - (a.rating_avg || a.avg_rating || 0));
            if (sortBy === 'recent') apps = [...apps].sort((a: any, b: any) =>
                new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime()
            );
            if (sortBy === 'popular') apps = [...apps].sort((a: any, b: any) => (b.install_count || 0) - (a.install_count || 0));

            if (selectedCategory) {
                apps = apps.filter((a: any) => a.category_id === selectedCategory || a.app_categories?.slug === selectedCategory);
            }

            setResults(apps);
        } catch (err) {
            console.error('Failed to fetch apps:', err);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [query, selectedCategory, sortBy]);

    useEffect(() => {
        const debounce = setTimeout(fetchApps, 300);
        return () => clearTimeout(debounce);
    }, [fetchApps]);

    return (
        <>
            <Header />
            <main className="appstore-main">
                {/* Search bar */}
                <div style={{ marginBottom: 32 }}>
                    <div className="appstore-search" style={{ maxWidth: 600, padding: '12px 20px' }}>
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search apps, integrations, categories..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                            style={{ fontSize: 15 }}
                        />
                    </div>
                </div>

                <div className="search-page">
                    {/* Sidebar filters */}
                    <aside className="search-sidebar">
                        <div className="search-filter-group">
                            <h3>Category</h3>
                            <div
                                className={`search-filter-option ${!selectedCategory ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(null)}
                            >
                                All categories
                            </div>
                            {APP_CATEGORIES.slice(0, 15).map(cat => (
                                <div
                                    key={cat.slug}
                                    className={`search-filter-option ${selectedCategory === cat.slug ? 'active' : ''}`}
                                    onClick={() => setSelectedCategory(cat.slug)}
                                >
                                    {cat.icon} {cat.name}
                                </div>
                            ))}
                        </div>

                        <div className="search-filter-group">
                            <h3>Pricing</h3>
                            <div className="search-filter-option active">All</div>
                            <div className="search-filter-option">Free</div>
                            <div className="search-filter-option">Freemium</div>
                            <div className="search-filter-option">Paid</div>
                        </div>

                        <div className="search-filter-group">
                            <h3>Rating</h3>
                            <div className="search-filter-option">4+ stars</div>
                            <div className="search-filter-option">3+ stars</div>
                        </div>
                    </aside>

                    {/* Results */}
                    <div className="search-results">
                        <div className="search-results-header">
                            <span className="search-results-count">
                                {loading ? 'Searching...' : `${results.length} ${results.length === 1 ? 'app' : 'apps'} found`}
                                {query && ` for "${query}"`}
                            </span>
                            <select
                                className="search-sort-select"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="popular">Most Popular</option>
                                <option value="rating">Top Rated</option>
                                <option value="recent">Newest</option>
                            </select>
                        </div>

                        {loading ? (
                            <div className="app-card-grid">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} style={{
                                        height: 200, borderRadius: 16,
                                        background: 'var(--bg-tertiary)',
                                        animation: 'pulse 1.5s ease-in-out infinite',
                                    }} />
                                ))}
                            </div>
                        ) : (
                            <div className="app-card-grid">
                                {results.map((app: any) => (
                                    <AppCard key={app.id} app={app} />
                                ))}
                            </div>
                        )}

                        {!loading && results.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon">🔍</div>
                                <h3>No apps found</h3>
                                <p>Try different keywords or browse our categories.</p>
                            </div>
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
