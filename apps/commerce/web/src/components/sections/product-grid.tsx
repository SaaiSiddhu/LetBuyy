'use client';

import { motion } from 'framer-motion';
import { DEFAULT_THEME_SETTINGS } from '@letbuyy/theme-engine/theme-settings';
import type { SectionModel, ProductGridSettings, ThemeSettings } from '@letbuyy/theme-engine';
import type { ProductModel } from '@letbuyy/commerce-core';
import { Button, ArrowRight, ShoppingBag, Heart } from '@letbuyy/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCart } from '@/context/cart-context';
import { useWishlist } from '@/context/wishlist-context';
import { StorefrontEmptyState } from '@/components/storefront/storefront-states';

const productImageFallback = '/images/banners/new-arrivals-1.png';

interface Props {
    section: SectionModel;
    products: ProductModel[];
    theme?: ThemeSettings;
    basePath?: string;
}

export default function ProductGrid({ section, products, theme, basePath: providedBasePath }: Props) {
    const settings = section.settings as Partial<ProductGridSettings>;
    const params = useParams();
    const subdomain = params.subdomain as string;
    const basePath = providedBasePath || (subdomain ? `/store/${subdomain}` : '');
    const { addToCart } = useCart();
    const { isInWishlist, toggleWishlist: contextToggleWishlist } = useWishlist();

    const colors = theme || DEFAULT_THEME_SETTINGS;
    const title = settings.title || 'Our Products';
    const showPrice = settings.showPrice !== false;
    const showAddToCart = settings.showAddToCart !== false;
    const columns = Math.max(1, Number(settings.columns || 3));
    const gridColumns = Math.min(columns, 4);
    const rows = Math.max(1, Number(settings.rows || 2));
    const displayProducts = products.slice(0, gridColumns * rows);
    const desktopGridClass =
        gridColumns === 1
            ? 'lg:grid-cols-1'
            : gridColumns === 2
                ? 'lg:grid-cols-2'
                : gridColumns === 4
                    ? 'lg:grid-cols-4'
                    : 'lg:grid-cols-3';

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

    const handleToggleWishlist = (e: React.MouseEvent, productId: string) => {
        e.preventDefault();
        e.stopPropagation();
        contextToggleWishlist(productId);
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
                        href={`${basePath}/shop`}
                        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
                        style={{ color: colors.secondaryColor }}
                    >
                        View All <ArrowRight size={14} />
                    </Link>
                </div>

                {/* 2x3 Grid */}
                <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${desktopGridClass}`}>
                    {displayProducts.map((product, i) => {
                        const discount = getDiscount(product);
                        const isWishlisted = isInWishlist(product.id);

                        return (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.03 }}
                            >
                                <Link href={`${basePath}/product/${product.id}`} className="group block">
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
                                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                                unoptimized
                                            />
                                            {discount > 0 && (
                                                <span
                                                    className="absolute top-2 left-2 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-lg bg-black"
                                                >
                                                    {discount}% OFF
                                                </span>
                                            )}
                                            {/* Heart icon - uses primaryColor */}
                                            <Button unstyled
                                                onClick={(e) => handleToggleWishlist(e, product.id)}
                                                className="absolute top-2 right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full transition-all card-theme"
                                                style={{
                                                    color: isWishlisted ? colors.primaryColor : colors.primaryColor,
                                                    opacity: isWishlisted ? 1 : undefined
                                                }}
                                            >
                                                <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
                                            </Button>
                                            {showAddToCart && (
                                                <Button unstyled
                                                    onClick={(e) => handleQuickAdd(e, product)}
                                                    className="absolute bottom-2 left-2 right-2 flex min-h-11 items-center justify-center gap-2 rounded text-sm font-semibold text-white transition-opacity"
                                                    style={{ backgroundColor: colors.primaryColor }}
                                                >
                                                    <ShoppingBag size={16} /> Add
                                                </Button>
                                            )}
                                        </div>
                                        {/* Info */}
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
                                            {showPrice && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="text-sm font-bold" style={{ color: colors.primaryColor }}>
                                                        ₹{product.price.toLocaleString('en-IN')}
                                                    </span>
                                                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                                                        <span className="flex flex-col text-[10px] text-theme-muted">
                                                            <span>Lowest in last 30 days</span>
                                                            <span className="line-through">₹{product.compareAtPrice.toLocaleString('en-IN')}</span>
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
                    <StorefrontEmptyState
                        icon={<ShoppingBag size={28} aria-hidden="true" />}
                        title="No products found"
                        body="Products added to this store will appear here."
                    />
                )}
            </div>
        </section>
    );
}
