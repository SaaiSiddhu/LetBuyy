'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ProductModel, ThemeSettings } from '@/types/store';
import { ShoppingBag, Heart, Search, SlidersHorizontal, Grid, LayoutGrid, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/context/cart-context';
import { useState, useMemo } from 'react';

import { THEME_PRESETS } from '@/types/store';

interface Props {
    products: ProductModel[];
    theme: ThemeSettings;
    subdomain: string;
    storeName: string;
}

// Helper to get if theme is dark
const getIsDark = (theme: ThemeSettings): boolean => {
    // Get theme preset if available
    const presetId = Object.keys(THEME_PRESETS).find(id => {
        const preset = THEME_PRESETS[id];
        return preset.primaryColor === theme.primaryColor;
    });
    if (presetId && THEME_PRESETS[presetId]?.isDark !== undefined) {
        return THEME_PRESETS[presetId].isDark!;
    }
    // Fallback: check if background is dark
    const rgb = theme.backgroundColor?.match(/[0-9a-f]{2}/gi)?.map(h => parseInt(h, 16));
    if (rgb && rgb.length >= 3) {
        const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
        return luminance < 0.5;
    }
    return false;
};

export default function EnhancedShopGrid({ products, theme, subdomain, storeName }: Props) {
    const { addToCart } = useCart();
    const [wishlist, setWishlist] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high' | 'name'>('newest');
    const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');

    // Determine if this is a dark theme
    const isDark = getIsDark(theme);

    // Theme-aware colors
    const themeColors = {
        inputBg: isDark ? 'rgba(255,255,255,0.08)' : '#f9fafb',
        inputBorder: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
        inputText: theme.textColor || (isDark ? '#ffffff' : '#111827'),
        cardBg: isDark ? 'rgba(255,255,255,0.08)' : '#ffffff',
        cardBgSecondary: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
        textMuted: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
        surface: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
        headerBg: isDark ? (theme.surfaceColor || '#1e293b') : '#ffffff',
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

    // Filter and sort products
    const filteredProducts = useMemo(() => {
        let result = [...products];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.category?.toLowerCase().includes(query)
            );
        }

        // Sort
        switch (sortBy) {
            case 'price_low':
                result.sort((a, b) => a.price - b.price);
                break;
            case 'price_high':
                result.sort((a, b) => b.price - a.price);
                break;
            case 'name':
                result.sort((a, b) => a.name.localeCompare(b.name));
                break;
            default:
                // newest - keep as is (already sorted by createdAt)
                break;
        }

        return result;
    }, [products, searchQuery, sortBy]);

    return (
        <div className="min-h-screen" style={{ backgroundColor: theme.backgroundColor }}>
            {/* Premium Header */}
            <div
                className="relative py-8 md:py-12 px-4"
                style={{ background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)` }}
            >
                <div className="max-w-screen-xl mx-auto">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-white/70 mb-4">
                        <Link href={`/`} className="hover:text-white transition-colors">Home</Link>
                        <span>/</span>
                        <span className="text-white font-medium">Shop</span>
                    </nav>

                    {/* Title */}
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                        All Products
                    </h1>
                    <p className="text-white/80">
                        {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
                        {searchQuery && ` matching "${searchQuery}"`}
                    </p>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
            </div>

            {/* Filters Bar */}
            <div className="sticky top-[60px] z-40 border-b shadow-sm" style={{ backgroundColor: themeColors.headerBg }}>
                <div className="max-w-screen-xl mx-auto px-4 py-3">
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: themeColors.textMuted }} />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg focus:outline-none transition-colors"
                                style={{
                                    backgroundColor: themeColors.inputBg,
                                    border: `1px solid ${themeColors.inputBorder}`,
                                    color: themeColors.inputText
                                }}
                            />
                        </div>

                        {/* Right controls */}
                        <div className="flex items-center gap-2">
                            {/* Sort Dropdown */}
                            <div className="relative">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="appearance-none px-4 py-2.5 pr-8 text-sm rounded-lg focus:outline-none"
                                    style={{
                                        backgroundColor: themeColors.inputBg,
                                        border: `1px solid ${themeColors.inputBorder}`,
                                        color: themeColors.inputText
                                    }}
                                >
                                    <option value="newest">Newest</option>
                                    <option value="price_low">Price: Low to High</option>
                                    <option value="price_high">Price: High to Low</option>
                                    <option value="name">Name: A to Z</option>
                                </select>
                                <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: themeColors.textMuted }} />
                            </div>

                            {/* View Mode Toggle */}
                            <div className="hidden sm:flex rounded-lg overflow-hidden" style={{ border: `1px solid ${themeColors.inputBorder}` }}>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className="p-2.5"
                                    style={{ backgroundColor: viewMode === 'grid' ? themeColors.surface : 'transparent', color: themeColors.inputText }}
                                >
                                    <Grid size={18} />
                                </button>
                                <button
                                    onClick={() => setViewMode('compact')}
                                    className="p-2.5"
                                    style={{ backgroundColor: viewMode === 'compact' ? themeColors.surface : 'transparent', color: themeColors.inputText }}
                                >
                                    <LayoutGrid size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Products Grid */}
            <div className="py-6 px-4">
                <div className="max-w-screen-xl mx-auto">
                    {filteredProducts.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-16 border-2 border-dashed rounded-2xl"
                            style={{ borderColor: `${theme.primaryColor}30` }}
                        >
                            <ShoppingBag size={48} className="mx-auto mb-4" style={{ color: `${theme.primaryColor}50` }} />
                            <h3 className="text-lg font-semibold text-card-muted mb-2">
                                {searchQuery ? 'No products found' : 'No products available'}
                            </h3>
                            <p className="text-card-muted text-sm mb-4">
                                {searchQuery
                                    ? `Try searching for something else`
                                    : 'Check back soon for new arrivals!'}
                            </p>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                                    style={{ backgroundColor: theme.primaryColor }}
                                >
                                    Clear Search
                                </button>
                            )}
                        </motion.div>
                    ) : (
                        <div className={`grid gap-4 ${viewMode === 'compact'
                            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                            : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                            }`}>
                            <AnimatePresence mode="popLayout">
                                {filteredProducts.map((product, i) => {
                                    const discount = getDiscount(product);
                                    const isWishlisted = wishlist.has(product.id);

                                    return (
                                        <motion.div
                                            key={product.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ delay: i * 0.02, duration: 0.2 }}
                                        >
                                            <Link href={`/product/${product.id}`} className="group block">
                                                <div
                                                    className="overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
                                                    style={{ borderRadius: `${theme.borderRadius}px`, backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.inputBorder}` }}
                                                >
                                                    {/* Image */}
                                                    <div
                                                        className={`relative overflow-hidden ${viewMode === 'compact' ? 'aspect-square' : 'aspect-[4/5]'}`}
                                                        style={{ backgroundColor: themeColors.cardBgSecondary }}
                                                    >
                                                        <img
                                                            src={product.images[0]}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                        />

                                                        {/* Discount Badge */}
                                                        {discount > 0 && (
                                                            <span
                                                                className="absolute top-2 left-2 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow"
                                                                style={{ backgroundColor: theme.accentColor || '#ff4757' }}
                                                            >
                                                                {discount}% OFF
                                                            </span>
                                                        )}

                                                        {/* Wishlist */}
                                                        <button
                                                            onClick={(e) => toggleWishlist(e, product.id)}
                                                            className={`absolute top-2 right-2 p-2 rounded-full shadow transition-all ${isWishlisted
                                                                ? 'bg-rose-500 text-white scale-110'
                                                                : 'opacity-0 group-hover:opacity-100'
                                                                }`}
                                                            style={isWishlisted ? {} : {
                                                                backgroundColor: themeColors.cardBg,
                                                                color: themeColors.textMuted
                                                            }}
                                                        >
                                                            <Heart size={14} fill={isWishlisted ? 'currentColor' : 'none'} />
                                                        </button>

                                                        {/* Quick Add */}
                                                        <motion.button
                                                            onClick={(e) => handleQuickAdd(e, product)}
                                                            initial={{ y: 20, opacity: 0 }}
                                                            whileHover={{ scale: 1.02 }}
                                                            className="absolute bottom-3 left-3 right-3 py-3 text-white text-sm font-semibold rounded-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all flex items-center justify-center gap-2 shadow-lg"
                                                            style={{ backgroundColor: theme.primaryColor }}
                                                        >
                                                            <ShoppingBag size={16} /> Add to Cart
                                                        </motion.button>
                                                    </div>

                                                    {/* Info */}
                                                    <div className={viewMode === 'compact' ? 'p-2' : 'p-4'}>
                                                        {product.category && (
                                                            <span className="text-[10px] text-theme-muted uppercase tracking-wider">
                                                                {product.category}
                                                            </span>
                                                        )}
                                                        <h3
                                                            className={`font-semibold truncate mt-0.5 ${viewMode === 'compact' ? 'text-sm' : 'text-base'}`}
                                                            style={{ color: theme.textColor }}
                                                        >
                                                            {product.name}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span
                                                                className={`font-bold ${viewMode === 'compact' ? 'text-sm' : 'text-lg'}`}
                                                                style={{ color: theme.primaryColor }}
                                                            >
                                                                ₹{product.price.toLocaleString('en-IN')}
                                                            </span>
                                                            {product.compareAtPrice && product.compareAtPrice > product.price && (
                                                                <span className="text-xs text-theme-muted line-through">
                                                                    ₹{product.compareAtPrice.toLocaleString('en-IN')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
