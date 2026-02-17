'use client';

import { MOCK_PRODUCTS, CATEGORIES, formatPrice } from '../_lib/mock-data';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, ArrowRight, Clock, TrendingUp, Star } from 'lucide-react';
import Link from 'next/link';

// ============================================================
// SEARCH OVERLAY — Fullscreen search page with instant results
// Matches against MOCK_PRODUCTS by name, description, category
// ============================================================

const RECENT_KEY = 'uk_recent_searches';
const MAX_RECENT = 5;

interface SearchOverlayProps {
    open: boolean;
    onClose: () => void;
}

export default function SearchOverlay({ open, onClose }: SearchOverlayProps) {
    const [query, setQuery] = useState('');
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    // Load recent searches
    useEffect(() => {
        try {
            const stored = localStorage.getItem(RECENT_KEY);
            if (stored) setRecentSearches(JSON.parse(stored));
        } catch { /* ignore */ }
    }, []);

    // Auto-focus on open
    useEffect(() => {
        if (open) {
            setQuery('');
            setHighlightIndex(-1);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    // Fuzzy match function
    const matchScore = useCallback((text: string, q: string): number => {
        const lower = text.toLowerCase();
        const qLower = q.toLowerCase();
        if (lower === qLower) return 100;
        if (lower.startsWith(qLower)) return 80;
        if (lower.includes(qLower)) return 60;
        const words = qLower.split(/\s+/);
        const matched = words.filter(w => lower.includes(w)).length;
        return matched > 0 ? (matched / words.length) * 40 : 0;
    }, []);

    // Search results
    const results = useMemo(() => {
        if (query.length < 2) return { products: [], categories: [] };

        const scored = MOCK_PRODUCTS.map(product => {
            const nameScore = matchScore(product.name, query);
            const descScore = matchScore(product.description || '', query) * 0.5;
            const catScore = matchScore(product.category || '', query) * 0.3;
            return { product, score: Math.max(nameScore, descScore, catScore) };
        })
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 6);

        const matchedCategories = CATEGORIES
            .filter(c => c !== 'All' && c.toLowerCase().includes(query.toLowerCase()))
            .map(c => ({
                name: c,
                count: MOCK_PRODUCTS.filter(p => p.category === c).length,
            }));

        return { products: scored.map(s => s.product), categories: matchedCategories };
    }, [query, matchScore]);

    const totalResults = results.products.length + results.categories.length;

    // Save search to recent
    const saveSearch = (term: string) => {
        const trimmed = term.trim();
        if (!trimmed) return;
        const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, MAX_RECENT);
        setRecentSearches(updated);
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    };

    const clearRecent = () => {
        setRecentSearches([]);
        localStorage.removeItem(RECENT_KEY);
    };

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(i => Math.min(i + 1, totalResults - 1));
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(i => Math.max(i - 1, -1));
        }
        if (e.key === 'Enter' && highlightIndex >= 0) {
            e.preventDefault();
            if (highlightIndex < results.products.length) {
                saveSearch(query);
                onClose();
            }
        }
    };

    if (!open) return null;

    const popularSearches = ['Sneakers', 'Hoodie', 'Jordan', 'New Arrivals', 'Sale'];

    return (
        <>
            {/* Backdrop — click to close */}
            <div className="fixed inset-0 z-[89] bg-black/40 animate-search-backdrop" onClick={onClose} />

            {/* Centering wrapper — fullscreen on mobile, centered dialog on desktop */}
            <div className="search-dialog-wrapper fixed inset-0 z-[90]">
                <div className="search-dialog-card bg-white flex flex-col animate-search-in">
                    {/* Search Bar */}
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-white md:rounded-t-2xl">
                        <Search size={18} className="text-gray-400 flex-shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setHighlightIndex(-1); }}
                            onKeyDown={handleKeyDown}
                            placeholder="Search"
                            className="flex-1 text-sm outline-none placeholder-gray-400 bg-transparent"
                            autoComplete="off"
                        />
                        {query && (
                            <button onClick={() => setQuery('')} className="p-0.5 rounded-md hover:bg-gray-100 transition-colors">
                                <X size={14} className="text-gray-400" />
                            </button>
                        )}
                        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 ml-1">
                            <X size={18} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Results Area — scrollable */}
                    <div ref={resultsRef} className="flex-1 overflow-y-auto px-5 py-4 md:rounded-b-2xl">
                        <div className="max-w-2xl mx-auto">
                            {query.length < 2 ? (
                                // Empty state — show recent + popular
                                <div className="space-y-8">
                                    {recentSearches.length > 0 && (
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Recent Searches</p>
                                                <button onClick={clearRecent} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {recentSearches.map((term) => (
                                                    <button
                                                        key={term}
                                                        onClick={() => { setQuery(term); saveSearch(term); }}
                                                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-full text-sm text-gray-600 transition-colors"
                                                    >
                                                        <Clock size={12} className="text-gray-400" />
                                                        {term}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Popular Searches</p>
                                        <div className="flex flex-wrap gap-2">
                                            {popularSearches.map((term) => (
                                                <button
                                                    key={term}
                                                    onClick={() => { setQuery(term); saveSearch(term); }}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-full text-sm text-gray-600 transition-colors"
                                                >
                                                    <TrendingUp size={12} className="text-gray-400" />
                                                    {term}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Categories</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {CATEGORIES.filter(c => c !== 'All').map((cat) => (
                                                <Link
                                                    key={cat}
                                                    href={`/theme-preview/urban-kicks/shop?category=${cat}`}
                                                    onClick={onClose}
                                                    className="px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-medium text-center transition-colors"
                                                >
                                                    {cat}
                                                    <span className="block text-xs text-gray-400 mt-0.5">
                                                        {MOCK_PRODUCTS.filter(p => p.category === cat).length} items
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : totalResults === 0 ? (
                                // No results
                                <div className="text-center py-20">
                                    <Search size={40} className="mx-auto text-gray-200 mb-4" />
                                    <p className="text-gray-500 font-medium text-base">No results for &quot;{query}&quot;</p>
                                    <p className="text-sm text-gray-400 mt-1">Try a different search term or browse categories</p>
                                </div>
                            ) : (
                                // Results
                                <div className="space-y-6">
                                    {/* Product Results */}
                                    {results.products.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                                                Products ({results.products.length})
                                            </p>
                                            <div className="space-y-1">
                                                {results.products.map((product, idx) => (
                                                    <Link
                                                        key={product.id}
                                                        href={`/theme-preview/urban-kicks/product/${product.id}`}
                                                        onClick={() => { saveSearch(query); onClose(); }}
                                                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${highlightIndex === idx ? 'bg-gray-100' : 'hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <div className="w-14 h-14 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0">
                                                            <img
                                                                src={product.images?.[0] || ''}
                                                                alt={product.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold truncate">{product.name}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-xs text-gray-400">{product.category}</span>
                                                                {product.rating && (
                                                                    <>
                                                                        <span className="text-gray-200">·</span>
                                                                        <span className="flex items-center gap-0.5 text-xs text-gray-400">
                                                                            <Star size={10} className="fill-yellow-400 text-yellow-400" />
                                                                            {product.rating}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <p className="text-sm font-bold">{formatPrice(product.price)}</p>
                                                            {product.compareAtPrice && (
                                                                <p className="text-xs text-gray-400 line-through">{formatPrice(product.compareAtPrice)}</p>
                                                            )}
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Category Results */}
                                    {results.categories.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                                                Categories ({results.categories.length})
                                            </p>
                                            <div className="space-y-1">
                                                {results.categories.map((cat, idx) => (
                                                    <Link
                                                        key={cat.name}
                                                        href={`/theme-preview/urban-kicks/shop?category=${cat.name}`}
                                                        onClick={() => { saveSearch(query); onClose(); }}
                                                        className={`flex items-center justify-between p-3 rounded-xl transition-colors ${highlightIndex === results.products.length + idx ? 'bg-gray-100' : 'hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                                                                <Search size={14} className="text-gray-400" />
                                                            </div>
                                                            <span className="text-sm font-medium">{cat.name}</span>
                                                            <span className="text-xs text-gray-400">({cat.count} products)</span>
                                                        </div>
                                                        <ArrowRight size={14} className="text-gray-300" />
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* View All */}
                                    <Link
                                        href={`/theme-preview/urban-kicks/shop?q=${encodeURIComponent(query)}`}
                                        onClick={() => { saveSearch(query); onClose(); }}
                                        className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-500 hover:text-black transition-colors"
                                    >
                                        View all results for &quot;{query}&quot;
                                        <ArrowRight size={14} />
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    <style>{`
                        @keyframes search-in {
                            from { opacity: 0; transform: translateY(-8px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        @keyframes search-backdrop {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        .animate-search-in { animation: search-in 0.2s ease-out; }
                        .animate-search-backdrop { animation: search-backdrop 0.2s ease-out; }
                        @media (max-width: 767px) {
                            .animate-search-in {
                                transform: none !important;
                            }
                        }
                    `}
                    </style>
                </div>
            </div>
        </>
    );
}
