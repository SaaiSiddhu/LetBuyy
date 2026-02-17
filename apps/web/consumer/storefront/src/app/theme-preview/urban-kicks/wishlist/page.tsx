'use client';

import PreviewShell from '../_components/preview-shell';
import { MOCK_PRODUCTS, formatPrice } from '../_lib/mock-data';
import { usePreviewWishlist } from '../_context/wishlist-context';
import { useCart } from '@/context/cart-context';
import { Heart, ShoppingBag, Star, Sparkles, ArrowRight, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// ============================================================
// WISHLIST PAGE — Compact, enhanced wishlist with no footer
// ============================================================

export default function WishlistPage() {
    const { items, toggleWishlist } = usePreviewWishlist();
    const { addToCart } = useCart();
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

    const wishlistedProducts = MOCK_PRODUCTS.filter(p => items.includes(p.id));

    const handleAddToCart = (product: typeof MOCK_PRODUCTS[0]) => {
        addToCart(product);
        setAddedIds(prev => new Set(prev).add(product.id));
        setTimeout(() => {
            setAddedIds(prev => {
                const next = new Set(prev);
                next.delete(product.id);
                return next;
            });
        }, 1500);
    };

    return (
        <PreviewShell hideFooter showWatermark>
            {/* Compact Header */}
            <div className="px-4 pt-6 pb-4 max-w-screen-xl mx-auto">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
                            <Heart size={16} className="text-red-500 fill-red-500" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight leading-tight">Wishlist</h1>
                            <p className="text-[11px] text-gray-400">
                                {wishlistedProducts.length === 0
                                    ? 'No saved items'
                                    : `${wishlistedProducts.length} item${wishlistedProducts.length !== 1 ? 's' : ''}`
                                }
                            </p>
                        </div>
                    </div>
                    {wishlistedProducts.length > 0 && (
                        <Link
                            href="/theme-preview/urban-kicks/shop"
                            className="text-xs text-gray-400 hover:text-black transition-colors font-medium"
                        >
                            Continue Shopping →
                        </Link>
                    )}
                </div>
            </div>

            <div className="max-w-screen-xl mx-auto px-4 pb-8">
                {wishlistedProducts.length === 0 ? (
                    /* ── Empty State ── */
                    <div className="text-center py-24">
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <Heart size={24} className="text-gray-300" />
                        </div>
                        <h2 className="text-base font-bold tracking-tight mb-1.5">Nothing saved yet</h2>
                        <p className="text-gray-400 text-xs max-w-xs mx-auto mb-5 leading-relaxed">
                            Tap the heart icon on any product to save it here for later.
                        </p>
                        <Link
                            href="/theme-preview/urban-kicks/shop"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-xs font-semibold hover:bg-black/90 transition-colors"
                        >
                            Browse Shop
                            <ArrowRight size={14} />
                        </Link>
                    </div>
                ) : (
                    /* ── Product List — compact horizontal cards ── */
                    <div className="space-y-2.5">
                        {wishlistedProducts.map(product => {
                            const discount = product.compareAtPrice
                                ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
                                : 0;
                            const justAdded = addedIds.has(product.id);

                            return (
                                <div
                                    key={product.id}
                                    className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-2.5 hover:shadow-md transition-all duration-200 group"
                                >
                                    {/* Thumbnail */}
                                    <Link
                                        href={`/theme-preview/urban-kicks/product/${product.id}`}
                                        className="relative w-20 h-20 sm:w-24 sm:h-24 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0"
                                    >
                                        <img
                                            src={product.images?.[0] || ''}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                        {/* Badge stack */}
                                        {(product.isNew || discount > 0) && (
                                            <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                                                {product.isNew && (
                                                    <span className="flex items-center gap-0.5 bg-black text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase leading-none">
                                                        <Sparkles size={7} /> New
                                                    </span>
                                                )}
                                                {discount > 0 && (
                                                    <span className="bg-green-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded leading-none">
                                                        -{discount}%
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </Link>

                                    {/* Product Info */}
                                    <div className="flex-1 min-w-0 py-0.5">
                                        <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">{product.category}</p>
                                        <Link href={`/theme-preview/urban-kicks/product/${product.id}`}>
                                            <h3 className="font-semibold text-[13px] leading-tight mt-0.5 truncate hover:underline">{product.name}</h3>
                                        </Link>
                                        {product.rating && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <Star size={10} className="fill-yellow-400 text-yellow-400" />
                                                <span className="text-[10px] font-medium">{product.rating}</span>
                                                <span className="text-[10px] text-gray-300">({product.reviewCount})</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="font-bold text-sm">{formatPrice(product.price)}</span>
                                            {product.compareAtPrice && (
                                                <span className="text-[10px] text-gray-400 line-through">{formatPrice(product.compareAtPrice)}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions — stacked vertically */}
                                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                                        <button
                                            onClick={() => handleAddToCart(product)}
                                            className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${justAdded
                                                ? 'bg-green-600 text-white'
                                                : 'bg-black text-white hover:bg-black/80'
                                                }`}
                                        >
                                            <ShoppingBag size={12} />
                                            {justAdded ? 'Added!' : 'Add'}
                                        </button>
                                        <button
                                            onClick={() => toggleWishlist(product.id)}
                                            className="flex items-center justify-center gap-1 px-3 py-2 border border-gray-200 rounded-xl text-[11px] font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all"
                                        >
                                            <X size={11} />
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Bottom CTA */}
                        <div className="pt-4 flex items-center justify-center">
                            <Link
                                href="/theme-preview/urban-kicks/shop"
                                className="text-xs text-gray-400 hover:text-black transition-colors font-medium flex items-center gap-1"
                            >
                                Discover more products <ArrowRight size={12} />
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </PreviewShell>
    );
}
