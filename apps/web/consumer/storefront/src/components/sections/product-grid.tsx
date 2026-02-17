'use client';

import { motion } from 'framer-motion';
import { SectionModel, ProductModel, ProductGridSettings, ThemeSettings, DEFAULT_THEME_SETTINGS } from '@/types/store';
import { ShoppingBag, Heart } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCart } from '@/context/cart-context';
import { useState } from 'react';

interface Props {
    section: SectionModel;
    products: ProductModel[];
    theme?: ThemeSettings;
}

export default function ProductGrid({ section, products, theme }: Props) {
    const settings = section.settings as Partial<ProductGridSettings>;
    const params = useParams();
    const subdomain = params.subdomain as string;
    const { addToCart } = useCart();
    const [wishlist, setWishlist] = useState<Set<string>>(new Set());

    const colors = theme || DEFAULT_THEME_SETTINGS;
    const title = settings.title || 'Our Products';
    const showPrice = settings.showPrice !== false;
    const showAddToCart = settings.showAddToCart !== false;

    // Fixed: 2 columns x 3 rows = 6 products
    const displayProducts = products.slice(0, 6);

    // Helper to create rgba from hex
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Alternating card backgrounds: primary (0,1) then secondary (2,3) then repeat
    const getCardBgColor = (index: number) => {
        const colorIndex = Math.floor(index / 2) % 2;
        return colorIndex === 0
            ? hexToRgba(colors.primaryColor, 0.15)
            : hexToRgba(colors.secondaryColor, 0.15);
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

    return (
        <section id="products" className="py-8 md:py-10" style={{ backgroundColor: colors.backgroundColor }}>
            <div className="max-w-screen-xl mx-auto px-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg md:text-xl font-bold" style={{ color: colors.textColor }}>
                        {title}
                    </h2>
                    <Link
                        href={`/shop`}
                        className="text-sm font-semibold hover:underline"
                        style={{ color: colors.secondaryColor }}
                    >
                        View All →
                    </Link>
                </div>

                {/* 2x3 Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {displayProducts.map((product, i) => {
                        const discount = getDiscount(product);
                        const isWishlisted = wishlist.has(product.id);

                        return (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.03 }}
                            >
                                <Link href={`/theme-preview/urban-kicks/product/${product.id}`} className="group block">
                                    <div
                                        className="card-theme overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                                        style={{ borderRadius: `${colors.borderRadius}px` }}
                                    >
                                        {/* Image with theme-colored background */}
                                        <div
                                            className="relative aspect-square overflow-hidden"
                                            style={{ backgroundColor: getCardBgColor(i) }}
                                        >
                                            <img
                                                src={product.images[0]}
                                                alt={product.name}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                            {discount > 0 && (
                                                <span
                                                    className="absolute top-2 left-2 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-lg bg-black"
                                                >
                                                    {discount}% OFF
                                                </span>
                                            )}
                                            {/* Heart icon - uses primaryColor */}
                                            <button
                                                onClick={(e) => toggleWishlist(e, product.id)}
                                                className="absolute top-1.5 right-1.5 p-1.5 rounded-full transition-all card-theme"
                                                style={{
                                                    color: isWishlisted ? colors.primaryColor : colors.primaryColor,
                                                    opacity: isWishlisted ? 1 : undefined
                                                }}
                                            >
                                                <Heart size={12} fill={isWishlisted ? 'currentColor' : 'none'} />
                                            </button>
                                            {showAddToCart && (
                                                <button
                                                    onClick={(e) => handleQuickAdd(e, product)}
                                                    className="absolute bottom-1.5 left-1.5 right-1.5 py-1.5 text-white text-xs font-semibold rounded transition-opacity flex items-center justify-center gap-1"
                                                    style={{ backgroundColor: colors.primaryColor }}
                                                >
                                                    <ShoppingBag size={11} /> Add
                                                </button>
                                            )}
                                        </div>
                                        {/* Info */}
                                        <div className="p-2">
                                            {/* Category label - uses primaryColor */}
                                            {product.category && (
                                                <span
                                                    className="text-[9px] font-bold uppercase tracking-wide"
                                                    style={{ color: hexToRgba(colors.primaryColor, 0.6) }}
                                                >
                                                    {product.category}
                                                </span>
                                            )}
                                            <h3 className="text-xs font-medium truncate" style={{ color: colors.textColor }}>
                                                {product.name}
                                            </h3>
                                            {showPrice && (
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
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>

                {products.length === 0 && (
                    <div className="text-center py-10 border border-dashed rounded-lg" style={{ borderColor: `${colors.primaryColor}30` }}>
                        <ShoppingBag size={28} className="mx-auto mb-2" style={{ color: `${colors.primaryColor}50` }} />
                        <p className="text-theme-muted text-sm">No products found.</p>
                    </div>
                )}
            </div>
        </section>
    );
}
