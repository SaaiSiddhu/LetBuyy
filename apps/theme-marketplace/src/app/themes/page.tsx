'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import type { ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Upload, X } from 'lucide-react';
import ThemeCard from '@/components/theme-card';
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

function GalleryContent() {
    const searchParams = useSearchParams();
    const initialCategory = searchParams.get('category') || 'all';

    const [search, setSearch] = useState('');
    const [category, setCategory] = useState(initialCategory);
    const [pricing, setPricing] = useState('all');
    const [sort, setSort] = useState('popular');
    const [themes, setThemes] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);

    const fetchThemes = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (category !== 'all') params.set('category', category);
            if (pricing === 'free') params.set('pricingType', 'free');
            if (pricing === 'paid') params.set('pricingType', 'one_time');
            if (search.trim()) params.set('search', search.trim());
            params.set('sort', sort === 'newest' ? 'recent' : sort);
            params.set('limit', '30');

            const res = await fetch(`/api/themes?${params}`);
            const data = await res.json();

            setThemes(data.themes || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to fetch themes:', err);
            setThemes([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [search, category, pricing, sort]);

    useEffect(() => {
        const debounce = setTimeout(fetchThemes, 300);
        return () => clearTimeout(debounce);
    }, [fetchThemes]);

    const handleBundleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || uploading) return;

        setUploading(true);
        setUploadStatus(null);

        try {
            const bundle = JSON.parse(await file.text()) as unknown;
            if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
                throw new Error('Theme package must be a JSON object');
            }

            const res = await fetch('/api/themes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bundle }),
            });
            const payload = await res.json().catch(() => null) as Record<string, unknown> | null;

            if (!res.ok) {
                const errorValue = payload?.error;
                const message = typeof errorValue === 'string'
                    ? errorValue
                    : errorValue && typeof errorValue === 'object' && typeof (errorValue as Record<string, unknown>).message === 'string'
                        ? String((errorValue as Record<string, unknown>).message)
                        : 'Theme package upload failed';
                throw new Error(message);
            }

            const theme = payload?.theme && typeof payload.theme === 'object'
                ? payload.theme as Record<string, unknown>
                : {};
            setUploadStatus(`Uploaded ${typeof theme.name === 'string' ? theme.name : 'theme package'}`);
            await fetchThemes();
        } catch (err) {
            setUploadStatus(err instanceof Error ? err.message : 'Theme package upload failed');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const activeFilters = [category !== 'all', pricing !== 'all', search.trim()].filter(Boolean).length;

    return (
        <div className="container-main py-10 md:py-16">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-2">Theme Gallery</h1>
                <p className="text-text-muted">
                    {loading ? 'Loading...' : <>Showing <strong className="text-text-heading">{total}</strong> themes</>}
                </p>
            </div>

            <div className="mb-8 rounded-xl border border-border bg-bg-card p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-base font-semibold text-text-heading">Upload theme package</h2>
                    <p className="text-sm text-text-muted">Portable JSON-contract themes are validated by the Commerce API.</p>
                    {uploadStatus && (
                        <p className="text-xs text-primary-light mt-2">{uploadStatus}</p>
                    )}
                </div>
                <label className={cn('btn-secondary text-sm inline-flex items-center justify-center gap-2 cursor-pointer', uploading && 'opacity-70 pointer-events-none')}>
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Uploading' : 'Upload JSON'}
                    <input
                        type="file"
                        accept="application/json,.json"
                        className="sr-only"
                        disabled={uploading}
                        onChange={handleBundleUpload}
                    />
                </label>
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
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} style={{
                            height: 280, borderRadius: 16,
                            background: 'var(--bg-card, #1a1a2e)',
                            animation: 'pulse 1.5s ease-in-out infinite',
                        }} />
                    ))}
                </div>
            ) : themes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {themes.map((theme: any) => (
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

export default function GalleryPage() {
    return (
        <Suspense fallback={<div className="container-main py-20 text-center text-text-muted">Loading gallery...</div>}>
            <GalleryContent />
        </Suspense>
    );
}
