'use client';

import { motion } from 'framer-motion';
import { DEFAULT_THEME_SETTINGS } from '@letbuyy/theme-engine';
import type { SectionModel, ThemeSettings } from '@letbuyy/theme-engine';
import type { ProductModel } from '@letbuyy/commerce-core';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button, ChevronLeft, ChevronRight, ShoppingBag, Heart, Star } from '@letbuyy/ui';
import { useState, useRef } from 'react';
import { useCart } from '@/context/cart-context';
import { StorefrontEmptyState } from '@/components/storefront/storefront-states';

const productImageFallback = '/images/banners/new-arrivals-1.png';

interface Props {
    section: SectionModel;
    products: ProductModel[];
    theme?: ThemeSettings;
}

export default function FeaturedProducts({ section, products, theme }: Props) {
    const settings = section.settings;
    const params = useParams();
    const subdomain = params.subdomain as string;
    const basePath = subdomain ? `/store/${subdomain}` : '';
    const scrollRef = useRef<HTMLDivElement>(null);
    const { addToCart } = useCart();
    const [wishlist, setWishlist] = useState<Set<string>>(new Set());

    const colors = theme || DEFAULT_THEME_SETTINGS;
    const title = typeof settings.title === 'string' && settings.title.trim().length > 0
        ? settings.title
        : 'Featured';

    // Fixed: 4 products only, horizontal scroll
    const displayProducts = products.slice(0, 4);

    // Helper to create rgba from hex
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Alternating card backgrounds: primary (0,1) then secondary (2,3)
    const getCardBgColor = (index: number) => {
        const colorIndex = Math.floor(index / 2) % 2;
        return colorIndex === 0
            ? hexToRgba(colors.primaryColor, 0.15)
            : hexToRgba(colors.secondaryColor, 0.15);
    };

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -180 : 180,
                behavior: 'smooth',
            });
        }
    };

    const handleQuickAdd = (e: React.MouseEvent, product: ProductModel) => {
        e.preventDefault();
        e.stopPropagation();
        addToCart(product);
    };

    const toggleWishlist = (e: React.MouseEvent, productId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setWishlist(prev => {
            const next = new Set(prev);
            if (next.has(productId)) next.delete(productId);
            else next.add(productId);
            return next;
        });
    };

    const getDiscount = (product: ProductModel) => {
        if (product.compareAtPrice && product.compareAtPrice > product.price) {
            return Math.round((1 - product.price / product.compareAtPrice) * 100);
        }
        return 0;
    };

    if (products.length === 0) {
        return (
            <section className="py-8 md:py-10 overflow-hidden" style={{ backgroundColor: colors.backgroundColor }}>
                <div className="max-w-screen-xl mx-auto px-4">
                    <StorefrontEmptyState
                        icon={<ShoppingBag size={28} aria-hidden="true" />}
                        title="No featured products"
                        body="Featured products added to this store will appear here."
                    />
                </div>
            </section>
        );
    }

    return (
        <section className="py-8 md:py-10 overflow-hidden" style={{ backgroundColor: colors.backgroundColor }}>
            <div className="max-w-screen-xl mx-auto px-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span
                            className="flex h-7 w-7 items-center justify-center rounded"
                            style={{ backgroundColor: colors.primaryColor, color: 'rgb(255 255 255)' }}
                        >
                            <Star size={14} fill="currentColor" />
                        </span>
                        <h2 className="text-lg md:text-xl font-bold" style={{ color: colors.textColor }}>
                            {title}
                        </h2>
                    </div>
                    <div className="flex gap-1">
                        <Button unstyled
                            onClick={() => scroll('left')}
                            className="flex h-11 w-11 items-center justify-center rounded-full border hover:bg-surface-hover"
                            style={{ borderColor: hexToRgba(colors.primaryColor, 0.3) }}
                        >
                            <ChevronLeft size={16} style={{ color: colors.primaryColor }} />
                        </Button>
                        <Button unstyled
                            onClick={() => scroll('right')}
                            className="flex h-11 w-11 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: colors.primaryColor }}
                        >
                            <ChevronRight size={16} />
                        </Button>
                    </div>
                </div>

                {/* Horizontal Scroll - 4 products */}
                <div
                    ref={scrollRef}
                    className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4"
                    style={{ scrollSnapType: 'x mandatory' }}
                >
                    {displayProducts.map((product, i) => {
                        const discount = getDiscount(product);
                        const isWishlisted = wishlist.has(product.id);

                        return (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="w-[76vw] max-w-[220px] flex-shrink-0 sm:w-[180px]"
                                style={{ scrollSnapAlign: 'start' }}
                            >
                                <Link href={`${basePath}/product/${product.id}`}>
                                    <div className="group">
                                        <div
                                            className="storefront-product-card card-theme overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                                            style={{ borderRadius: `${colors.borderRadius}px` }}
                                        >
                                            {/* Image with theme-colored background */}
                                            <div
                                                className="storefront-product-card__media relative aspect-square overflow-hidden"
                                                style={{ backgroundColor: getCardBgColor(i) }}
                                            >
                                                <Image
                                                    src={product.images[0] || productImageFallback}
                                                    alt={product.name}
                                                    fill
                                                    sizes="(max-width: 640px) 76vw, 180px"
                                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                                    unoptimized
                                                />
                                                {discount > 0 && (
                                                    <span
                                                        className="absolute top-1.5 left-1.5 text-white text-[9px] font-bold px-1.5 py-0.5 rounded"
                                                        style={{ backgroundColor: colors.accentColor || colors.primaryColor }}
                                                    >
                                                        {discount}%
                                                    </span>
                                                )}
                                                {/* Heart icon - uses primaryColor */}
                                                <Button unstyled
                                                    onClick={(e) => toggleWishlist(e, product.id)}
                                                    className="absolute top-2 right-2 flex h-11 w-11 items-center justify-center rounded-full transition-all card-theme"
                                                    style={{ color: colors.primaryColor }}
                                                >
                                                    <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
                                                </Button>
                                                <Button unstyled
                                                    onClick={(e) => handleQuickAdd(e, product)}
                                                    className="absolute bottom-2 left-2 right-2 flex min-h-11 items-center justify-center gap-2 rounded text-sm font-semibold text-white opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                                                    style={{ backgroundColor: colors.primaryColor }}
                                                >
                                                    <ShoppingBag size={16} /> Add
                                                </Button>
                                            </div>
                                            <div className="storefront-product-card__body p-3">
                                                {/* Category label - uses primaryColor */}
                                                {product.category && (
                                                    <span
                                                        className="storefront-product-card__category text-xs font-bold uppercase tracking-wide"
                                                        style={{ color: hexToRgba(colors.primaryColor, 0.6) }}
                                                    >
                                                        {product.category}
                                                    </span>
                                                )}
                                                <h3 className="storefront-product-card__title text-sm font-medium truncate" style={{ color: colors.textColor }}>
                                                    {product.name}
                                                </h3>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="text-sm font-bold" style={{ color: colors.primaryColor }}>
                                                        ₹{product.price.toLocaleString('en-IN')}
                                                    </span>
                                                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                                                        <span className="text-[10px] text-theme-muted line-through">
                                                            ₹{product.compareAtPrice.toLocaleString('en-IN')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
