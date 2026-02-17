'use client';

import PreviewShell from '../_components/preview-shell';
import { MOCK_PRODUCTS, formatPrice } from '../_lib/mock-data';
import { useCart } from '@/context/cart-context';
import { usePreviewWishlist } from '../_context/wishlist-context';
import { ShoppingBag, Heart, Star, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

/* ───── Carousel Banner Slides ───── */
const BANNER_SLIDES = [
    {
        image: '/images/banners/new-arrivals-1.png',
        title: 'Fresh Drops',
        subtitle: 'The latest sneakers just hit the shelves',
        cta: 'Shop Now',
        accent: 'from-purple-600/80',
    },
    {
        image: '/images/banners/new-arrivals-2.png',
        title: 'New Season',
        subtitle: 'Premium streetwear for the bold & fearless',
        cta: 'Explore',
        accent: 'from-black/70',
    },
    {
        image: '/images/banners/new-arrivals-3.png',
        title: 'Just Landed',
        subtitle: 'Limited edition colorways — grab yours',
        cta: 'View Collection',
        accent: 'from-orange-600/70',
    },
];

export default function NewArrivalsPage() {
    const { addToCart } = useCart();
    const { isInWishlist, toggleWishlist } = usePreviewWishlist();
    const [current, setCurrent] = useState(0);

    const newProducts = MOCK_PRODUCTS.filter(p => p.isNew);

    /* Auto-advance every 5 seconds */
    const next = useCallback(() => setCurrent(i => (i + 1) % BANNER_SLIDES.length), []);
    const prev = useCallback(() => setCurrent(i => (i - 1 + BANNER_SLIDES.length) % BANNER_SLIDES.length), []);

    useEffect(() => {
        const timer = setInterval(next, 5000);
        return () => clearInterval(timer);
    }, [next]);

    return (
        <PreviewShell>
            {/* ─── Hero Carousel Banner ─── */}
            <div className="relative w-full overflow-hidden bg-black" style={{ height: 'clamp(220px, 35vw, 420px)' }}>
                {/* Slides */}
                {BANNER_SLIDES.map((slide, idx) => (
                    <div
                        key={idx}
                        className="absolute inset-0 transition-all duration-700 ease-in-out"
                        style={{
                            opacity: idx === current ? 1 : 0,
                            transform: idx === current ? 'scale(1)' : 'scale(1.05)',
                        }}
                    >
                        <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
                        {/* Gradient overlay */}
                        <div className={`absolute inset-0 bg-gradient-to-r ${slide.accent} to-transparent`} />
                        {/* Text overlay */}
                        <div className="absolute inset-0 flex items-center">
                            <div className="max-w-screen-xl mx-auto px-6 md:px-10 w-full">
                                <span className="inline-flex items-center gap-1.5 text-yellow-400 text-xs font-bold uppercase tracking-widest mb-2">
                                    <Sparkles size={14} /> New Arrivals
                                </span>
                                <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-none mb-3">
                                    {slide.title}
                                </h2>
                                <p className="text-white/70 text-sm md:text-base max-w-md mb-5">{slide.subtitle}</p>
                                <Link
                                    href="#products"
                                    className="inline-flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full text-sm font-bold hover:bg-gray-100 transition-colors"
                                >
                                    {slide.cta} →
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Nav arrows */}
                <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors z-10">
                    <ChevronLeft size={20} />
                </button>
                <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors z-10">
                    <ChevronRight size={20} />
                </button>

                {/* Dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {BANNER_SLIDES.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrent(idx)}
                            className={`h-2 rounded-full transition-all duration-300 ${idx === current ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/70'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* ─── Products Grid ─── */}
            <div id="products" className="max-w-screen-xl mx-auto px-4 py-8">
                {newProducts.length === 0 ? (
                    <div className="text-center py-20">
                        <Sparkles size={48} className="mx-auto text-gray-300 mb-4" />
                        <h2 className="text-xl font-semibold mb-2">No new arrivals right now</h2>
                        <p className="text-gray-500 mb-6">Check back soon for fresh drops!</p>
                        <Link
                            href="/theme-preview/urban-kicks/shop"
                            className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full font-medium hover:bg-black/80 transition-colors"
                        >
                            Browse All Products
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                        {newProducts.map(product => (
                            <Link
                                href={`/theme-preview/urban-kicks/product/${product.id}`}
                                key={product.id}
                                className="group block bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300"
                            >
                                {/* Image */}
                                <div className="relative bg-gray-50 overflow-hidden aspect-square">
                                    <img
                                        src={product.images?.[0] || ''}
                                        alt={product.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    {/* Badges */}
                                    <div className="absolute top-2 left-2 flex flex-col gap-1.5">
                                        <span className="flex items-center gap-1 bg-black text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-lg uppercase">
                                            <Sparkles size={11} /> New
                                        </span>
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
                                    {/* Actions */}
                                    <div className="absolute bottom-2 right-2 flex gap-1.5 transition-opacity z-10">
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(product.id); }}
                                            className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors"
                                        >
                                            <Heart size={14} className={isInWishlist(product.id) ? 'fill-red-500 text-red-500' : ''} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(product); }}
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
                )}
            </div>
        </PreviewShell>
    );
}
