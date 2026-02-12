'use client';

import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import ThemeCard from '@/components/theme-card';
import { MOCK_THEMES } from '@/lib/theme-data';
import { cn } from '@/lib/utils';

const CATEGORY_PILLS = [
    { value: 'all', label: 'All Themes' },
    { value: 'store', label: '🛒 Store' },
    { value: 'portfolio', label: '🎨 Portfolio' },
    { value: 'resume', label: '📄 Resume' },
    { value: 'landing', label: '🚀 Landing' },
];

const PRICING_OPTIONS = [
    { value: 'all', label: 'All Prices' },
    { value: 'free', label: 'Free' },
    { value: 'paid', label: 'Paid' },
];

const SORT_OPTIONS = [
    { value: 'popular', label: 'Most Popular' },
    { value: 'newest', label: 'Newest' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'price_low', label: 'Price: Low → High' },
    { value: 'price_high', label: 'Price: High → Low' },
];

export default function GalleryPage() {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [pricing, setPricing] = useState('all');
    const [sort, setSort] = useState('popular');

    const filteredThemes = useMemo(() => {
        let themes = [...MOCK_THEMES];

        // Category filter
        if (category !== 'all') {
            themes = themes.filter(t => t.category === category);
        }

        // Pricing filter
        if (pricing === 'free') {
            themes = themes.filter(t => t.letbuyy_pricing_type === 'free');
        } else if (pricing === 'paid') {
            themes = themes.filter(t => t.letbuyy_pricing_type !== 'free');
        }

        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            themes = themes.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.tags.some(tag => tag.includes(q)) ||
                t.category.includes(q)
            );
        }

        // Sort
        switch (sort) {
            case 'newest':
                themes.sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
                break;
            case 'rating':
                themes.sort((a, b) => b.rating - a.rating);
                break;
            case 'price_low':
                themes.sort((a, b) => a.letbuyy_price_usd - b.letbuyy_price_usd);
                break;
            case 'price_high':
                themes.sort((a, b) => b.letbuyy_price_usd - a.letbuyy_price_usd);
                break;
            default:
                themes.sort((a, b) => b.install_count - a.install_count);
        }

        return themes;
    }, [search, category, pricing, sort]);

    const activeFilters = [category !== 'all', pricing !== 'all', search.trim()].filter(Boolean).length;

    return (
        <div className="container-main py-10 md:py-16">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-2">Theme Gallery</h1>
                <p className="text-text-muted">
                    Showing <strong className="text-text-heading">{filteredThemes.length}</strong> themes
                </p>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-subtle" />
                <input
                    type="text"
                    placeholder="Search themes by name, category, or tag..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-12 pr-10 py-3.5 rounded-xl bg-bg-card border border-border text-text-heading placeholder-text-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-heading"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
                {CATEGORY_PILLS.map(pill => (
                    <button
                        key={pill.value}
                        onClick={() => setCategory(pill.value)}
                        className={cn(
                            'px-4 py-2 rounded-full text-sm font-medium transition-all',
                            category === pill.value
                                ? 'bg-primary text-white shadow-md shadow-primary/25'
                                : 'bg-surface text-text-muted hover:text-text-heading hover:bg-surface-hover'
                        )}
                    >
                        {pill.label}
                    </button>
                ))}
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap items-center gap-3 mb-8">
                {/* Pricing Filter */}
                <select
                    value={pricing}
                    onChange={e => setPricing(e.target.value)}
                    className="px-4 py-2 rounded-lg bg-bg-card border border-border text-text-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                >
                    {PRICING_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                {/* Sort */}
                <select
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                    className="px-4 py-2 rounded-lg bg-bg-card border border-border text-text-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                >
                    {SORT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                {/* Active filter count */}
                {activeFilters > 0 && (
                    <button
                        onClick={() => { setCategory('all'); setPricing('all'); setSearch(''); }}
                        className="ml-auto text-xs text-text-subtle hover:text-error flex items-center gap-1 transition-colors"
                    >
                        <X className="w-3 h-3" />
                        Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
                    </button>
                )}
            </div>

            {/* Theme Grid */}
            {filteredThemes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredThemes.map(theme => (
                        <ThemeCard key={theme.id} theme={theme} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
                        <Search className="w-7 h-7 text-text-subtle" />
                    </div>
                    <h3 className="text-lg font-semibold text-text-heading mb-2">No themes found</h3>
                    <p className="text-sm text-text-muted mb-4">
                        Try adjusting your filters or searching for something else.
                    </p>
                    <button
                        onClick={() => { setCategory('all'); setPricing('all'); setSearch(''); }}
                        className="btn-secondary text-sm"
                    >
                        Clear all filters
                    </button>
                </div>
            )}
        </div>
    );
}
