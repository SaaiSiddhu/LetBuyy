'use client';

import PreviewShell from '../components/preview-shell';
import { MOCK_PRODUCTS, CATEGORIES, formatPrice } from '../lib/mock-data';
import { useCart } from '@/context/cart-context';
import { useState, useMemo } from 'react';
import {
    SlidersHorizontal, ChevronDown, ShoppingBag, Heart, Star,
    Grid3X3, LayoutList, Sparkles
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest';

export default function ShopPage() {
    const [category, setCategory] = useState<string>('All');
    const [sort, setSort] = useState<SortOption>('featured');
    const [view, setView] = useState<'grid' | 'list'>('grid');
    const [sortOpen, setSortOpen] = useState(false);
    const { addToCart } = useCart();

    const filtered = useMemo(() => {
        let items = category === 'All' ? [...MOCK_PRODUCTS] : MOCK_PRODUCTS.filter(p => p.category === category);

        switch (sort) {
            case 'price-asc': items.sort((a, b) => a.price - b.price); break;
            case 'price-desc': items.sort((a, b) => b.price - a.price); break;
            case 'rating': items.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
            case 'newest': items = items.filter(p => p.isNew).concat(items.filter(p => !p.isNew)); break;
            default: break;
        }
        return items;
    }, [category, sort]);

    const SORT_LABELS: Record<SortOption, string> = {
        featured: 'Featured', 'price-asc': 'Price: Low → High',
        'price-desc': 'Price: High → Low', rating: 'Top Rated', newest: 'Newest First',
    };

    return (
        <PreviewShell>
            {/* Page Header */}
            <div className="bg-black text-white py-12 px-4">
                <div className="max-w-screen-xl mx-auto">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Shop All</h1>
                    <p className="text-white/60 text-sm md:text-base">
                        {MOCK_PRODUCTS.length} products across sneakers, apparel & accessories
                    </p>
                </div>
            </div>

            <div className="max-w-screen-xl mx-auto px-4 py-8">
                {/* Filters Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                    {/* Category Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategory(cat)}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${category === cat
                                    ? 'bg-black text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {cat}
                                {cat !== 'All' && (
                                    <span className="ml-1.5 text-xs opacity-60">
                                        ({MOCK_PRODUCTS.filter(p => p.category === cat).length})
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                        {/* Sort Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setSortOpen(!sortOpen)}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                            >
                                <SlidersHorizontal size={14} />
                                {SORT_LABELS[sort]}
                                <ChevronDown size={14} className={`transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {sortOpen && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                                    {Object.entries(SORT_LABELS).map(([key, label]) => (
                                        <button
                                            key={key}
                                            onClick={() => { setSort(key as SortOption); setSortOpen(false); }}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${sort === key ? 'bg-black text-white' : 'hover:bg-gray-50'
                                                }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* View Toggle */}
                        <div className="hidden sm:flex items-center border border-gray-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setView('grid')}
                                className={`p-2 transition-colors ${view === 'grid' ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
                            >
                                <Grid3X3 size={16} />
                            </button>
                            <button
                                onClick={() => setView('list')}
                                className={`p-2 transition-colors ${view === 'list' ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
                            >
                                <LayoutList size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Product Grid */}
                <div className={view === 'grid'
                    ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6'
                    : 'space-y-4'
                }>
                    {filtered.map(product => (
                        <Link
                            href={`/theme-preview/urban-kicks/product/${product.id}`}
                            key={product.id}
                            className={`group block bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 ${view === 'list' ? 'flex gap-4' : ''
                                }`}
                        >
                            {/* Image */}
                            <div className={`relative bg-gray-50 overflow-hidden ${view === 'list' ? 'w-32 h-32 flex-shrink-0' : 'aspect-square'}`}>
                                <img
                                    src={product.images?.[0] || ''}
                                    alt={product.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                {/* Badges */}
                                <div className="absolute top-2 left-2 flex flex-col gap-1.5">
                                    {product.isNew && (
                                        <span className="flex items-center gap-1 bg-black text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-lg uppercase">
                                            <Sparkles size={11} /> New
                                        </span>
                                    )}
                                    {product.isTrending && (
                                        <span className="bg-red-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-lg uppercase">
                                            Trending
                                        </span>
                                    )}
                                    {product.compareAtPrice && (
                                        <span className="bg-green-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-lg">
                                            {Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}% OFF
                                        </span>
                                    )}
                                </div>
                                {/* Actions on hover */}
                                <div className="absolute bottom-2 right-2 flex gap-1.5 transition-opacity">
                                    <button onClick={(e) => e.preventDefault()} className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors">
                                        <Heart size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.preventDefault(); addToCart(product); }}
                                        className="p-2 bg-black text-white rounded-full shadow-md hover:bg-black/80 transition-colors"
                                    >
                                        <ShoppingBag size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="p-3 md:p-4">
                                <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-1">{product.category}</p>
                                <h3 className="font-semibold text-sm md:text-base leading-tight mb-1.5 line-clamp-1">{product.name}</h3>
                                {view === 'list' && (
                                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{product.description}</p>
                                )}
                                {product.rating && (
                                    <div className="flex items-center gap-1 mb-2">
                                        <Star size={12} className="fill-yellow-400 text-yellow-400" />
                                        <span className="text-xs font-medium">{product.rating}</span>
                                        <span className="text-xs text-gray-400">({product.reviewCount})</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm md:text-base">{formatPrice(product.price)}</span>
                                    {product.compareAtPrice && (
                                        <span className="text-xs text-gray-400 line-through">{formatPrice(product.compareAtPrice)}</span>
                                    )}
                                </div>
                                {product.stock && product.stock <= 5 && (
                                    <p className="text-xs text-red-500 font-medium mt-1.5">Only {product.stock} left!</p>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div className="text-center py-20">
                        <p className="text-gray-400 text-lg">No products found in this category</p>
                    </div>
                )}
            </div>
        </PreviewShell>
    );
}
