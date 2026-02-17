'use client';

import { MOCK_PRODUCTS, CATEGORIES, formatPrice } from '../lib/mock-data';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, ArrowRight, Clock, TrendingUp, Star } from 'lucide-react';
import Link from 'next/link';

// ============================================================
// SEARCH OVERLAY — Fullscreen search with instant results
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
        // Check individual words
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
                // Navigation handled by link click
            }
        }
    };

    if (!open) return null;

    const popularSearches = ['Sneakers', 'Hoodie', 'Jordan', 'New Arrivals', 'Sale'];

    return (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-2xl mx-auto mt-16 sm:mt-24 bg-white rounded-2xl shadow-2xl overflow-hidden animate-search-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                    <Search size={20} className="text-gray-400 flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setHighlightIndex(-1); }}
                        onKeyDown={handleKeyDown}
                        placeholder="Search products, categories..."
                        className="flex-1 text-base outline-none placeholder-gray-400"
                        autoComplete="off"
                    />
                    {query && (
                        <button onClick={() => setQuery('')} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                            <X size={16} className="text-gray-400" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="text-sm text-gray-400 hover:text-gray-600 font-medium pl-3 border-l border-gray-200"
                    >
                        ESC
                    </button>
                </div>

                {/* Results Area */}
                <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto p-4">
                    {query.length < 2 ? (
                        // Empty state — show recent + popular
                        <div className="space-y-6">
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
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-full text-sm text-gray-600 transition-colors"
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
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-full text-sm text-gray-600 transition-colors"
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
                        <div className="text-center py-12">
                            <Search size={32} className="mx-auto text-gray-200 mb-3" />
                            <p className="text-gray-500 font-medium">No results for &quot;{query}&quot;</p>
                            <p className="text-sm text-gray-400 mt-1">Try a different search term or browse categories</p>
                        </div>
                    ) : (
                        // Results
                        <div className="space-y-4">
                            {/* Product Results */}
                            {results.products.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                                        Products ({results.products.length})
                                    </p>
                                    <div className="space-y-1">
                                        {results.products.map((product, idx) => (
                                            <Link
                                                key={product.id}
                                                href={`/theme-preview/urban-kicks/product/${product.id}`}
                                                onClick={() => { saveSearch(query); onClose(); }}
                                                className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${highlightIndex === idx ? 'bg-gray-100' : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div className="w-12 h-12 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                                                    <img
                                                        src={product.images?.[0] || ''}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{product.name}</p>
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
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                                        Categories ({results.categories.length})
                                    </p>
                                    <div className="space-y-1">
                                        {results.categories.map((cat, idx) => (
                                            <Link
                                                key={cat.name}
                                                href={`/theme-preview/urban-kicks/shop?category=${cat.name}`}
                                                onClick={() => { saveSearch(query); onClose(); }}
                                                className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${highlightIndex === results.products.length + idx ? 'bg-gray-100' : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
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
                    from { opacity: 0; transform: translateY(-10px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-search-in { animation: search-in 0.2s ease-out; }
            `}</style>
        </div>
    );
}
