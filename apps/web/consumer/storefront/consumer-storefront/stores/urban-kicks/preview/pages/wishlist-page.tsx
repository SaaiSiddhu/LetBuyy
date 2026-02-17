'use client';

import PreviewShell from '../components/preview-shell';
import { MOCK_PRODUCTS, formatPrice } from '../lib/mock-data';
import { usePreviewWishlist } from '../context/wishlist-context';
import { useCart } from '@/context/cart-context';
import { Heart, ShoppingBag, Star, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// ============================================================
// WISHLIST PAGE — Shows saved products with remove + add-to-cart
// ============================================================

export default function WishlistPage() {
    const { items, toggleWishlist, isInWishlist } = usePreviewWishlist();
    const { addToCart } = useCart();

    const wishlistedProducts = MOCK_PRODUCTS.filter(p => items.includes(p.id));

    return (
        <PreviewShell>
            {/* Page Header */}
            <div className="bg-gradient-to-b from-pink-50 to-white py-12 px-4">
                <div className="max-w-screen-xl mx-auto">
                    <div className="flex items-center gap-3 mb-2">
                        <Heart size={24} className="text-red-500 fill-red-500" />
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">My Wishlist</h1>
                    </div>
                    <p className="text-gray-500 text-sm md:text-base">
                        {wishlistedProducts.length === 0
                            ? 'Save items you love for later'
                            : `${wishlistedProducts.length} item${wishlistedProducts.length !== 1 ? 's' : ''} saved`
                        }
                    </p>
                </div>
            </div>

            <div className="max-w-screen-xl mx-auto px-4 py-8">
                {wishlistedProducts.length === 0 ? (
                    // Empty State
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Heart size={32} className="text-gray-300" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight mb-2">Your wishlist is empty</h2>
                        <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
                            Tap the heart icon on any product to save it here. Your wishlist is stored locally and will persist across visits.
                        </p>
                        <Link
                            href="/theme-preview/urban-kicks/shop"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-black/90 transition-colors"
                        >
                            Browse Shop
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                ) : (
                    // Product Grid
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                        {wishlistedProducts.map(product => (
                            <div key={product.id} className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300">
                                {/* Image */}
                                <Link href={`/theme-preview/urban-kicks/product/${product.id}`}>
                                    <div className="relative bg-gray-50 overflow-hidden aspect-square">
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
                                            {product.compareAtPrice && (
                                                <span className="bg-green-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-lg">
                                                    {Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}% OFF
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Link>

                                {/* Info + Actions */}
                                <div className="p-3 md:p-4">
                                    <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-1">{product.category}</p>
                                    <Link href={`/theme-preview/urban-kicks/product/${product.id}`}>
                                        <h3 className="font-semibold text-sm md:text-base leading-tight mb-1.5 line-clamp-1 hover:underline">{product.name}</h3>
                                    </Link>
                                    {product.rating && (
                                        <div className="flex items-center gap-1 mb-2">
                                            <Star size={12} className="fill-yellow-400 text-yellow-400" />
                                            <span className="text-xs font-medium">{product.rating}</span>
                                            <span className="text-xs text-gray-400">({product.reviewCount})</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="font-bold text-sm md:text-base">{formatPrice(product.price)}</span>
                                        {product.compareAtPrice && (
                                            <span className="text-xs text-gray-400 line-through">{formatPrice(product.compareAtPrice)}</span>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => addToCart(product)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-black text-white rounded-lg text-xs font-semibold hover:bg-black/90 transition-colors"
                                        >
                                            <ShoppingBag size={13} />
                                            Add to Cart
                                        </button>
                                        <button
                                            onClick={() => toggleWishlist(product.id)}
                                            className="p-2 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors group/heart"
                                            aria-label="Remove from wishlist"
                                        >
                                            <Heart size={14} className="fill-red-500 text-red-500 group-hover/heart:fill-transparent group-hover/heart:text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </PreviewShell>
    );
}
