'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { ProductModel } from '@letbuyy/commerce-core';
import { DEFAULT_THEME_SETTINGS } from '@letbuyy/theme-engine';
import type { ThemeSettings } from '@letbuyy/theme-engine';
import { useCart, type CartVariantContext } from '@/context/cart-context';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button,
    ArrowLeft, Minus, Plus, ShoppingBag, Heart, Share2,
    Zap, Truck, ShieldCheck, RefreshCcw, Package, ChevronDown, ChevronUp, Check, Star, Flame
} from '@letbuyy/ui';

interface Props {
    product: ProductModel;
    subdomain: string;
    theme?: ThemeSettings;
}

const productImageFallback = '/images/banners/new-arrivals-1.png';

export default function ProductDetailsClient({ product, subdomain, theme }: Props) {
    const colors = theme || DEFAULT_THEME_SETTINGS;
    const router = useRouter();
    const { addToCart } = useCart();
    const basePath = `/store/${subdomain}`;
    const productImages = product.images.length > 0 ? product.images : [productImageFallback];

    const [selectedImage, setSelectedImage] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [specsOpen, setSpecsOpen] = useState(false);
    const [addedToCart, setAddedToCart] = useState(false);
    const [isWishlisted, setIsWishlisted] = useState(false);

    // discount is recomputed after variant resolution using displayPrice/displayComparePrice
    // (defined below after resolvedVariant)
    let discount = 0; // overwritten below

    // Get variant options from variantOptions field (primary) or parse from variants
    const getVariantGroups = (): Record<string, string[]> => {
        const groups: Record<string, string[]> = {};

        // Primary: Use variantOptions if available (e.g., { name: "Size", values: ["S", "M", "L"] })
        const variantOptions = product.variantOptions || [];
        if (variantOptions.length > 0) {
            variantOptions.forEach((opt) => {
                if (opt.name && opt.values && Array.isArray(opt.values)) {
                    groups[opt.name] = opt.values;
                }
            });
            return groups;
        }

        // Fallback: Parse from variants array
        const variants = product.variants || [];

        variants.forEach((v) => {
            if (v.options && typeof v.options === 'object') {
                Object.entries(v.options).forEach(([key, value]) => {
                    if (!groups[key]) groups[key] = [];
                    if (!groups[key].includes(value as string)) {
                        groups[key].push(value as string);
                    }
                });
            } else if (v.name && !v.options) {
                // Simple variant format
                if (!groups['Option']) groups['Option'] = [];
                if (!groups['Option'].includes(v.name)) {
                    groups['Option'].push(v.name);
                }
            }
        });

        return groups;
    };

    const variantGroups = getVariantGroups();
    const hasVariants = Object.keys(variantGroups).length > 0;

    const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        Object.entries(variantGroups).forEach(([group, options]) => {
            if (options.length > 0) initial[group] = options[0];
        });
        return initial;
    });

    // Resolve matching variant from the hydrated variants array.
    // API returns option1/option2/option3 on each variant row; variantOptions drives the group order.
    const resolveMatchingVariant = (): CartVariantContext | undefined => {
        const variants = product.variants || [];
        if (variants.length === 0) return undefined;

        const optionNames = (product.variantOptions || []).map((o) => o.name);
        const matchedVariant = variants.find((v) => {
            // Support both option1/option2/option3 (API shape) and options map (typed shape)
            const raw = v as unknown as Record<string, unknown>;
            const option1 = (raw.option1 as string | null | undefined) ?? null;
            const option2 = (raw.option2 as string | null | undefined) ?? null;
            const option3 = (raw.option3 as string | null | undefined) ?? null;
            const optionValues = [option1, option2, option3].filter(Boolean) as string[];

            // Try option1/2/3 path first
            if (option1 !== null || option2 !== null || option3 !== null) {
                const groupKeys = Object.keys(selectedVariants);
                return groupKeys.every((key, idx) => {
                    const selected = selectedVariants[key];
                    return optionValues[idx] === selected;
                });
            }

            // Fallback: options map
            if (v.options && typeof v.options === 'object') {
                return Object.entries(selectedVariants).every(([key, val]) => {
                    return (v.options as Record<string, string>)[key] === val;
                });
            }
            return false;
        });

        if (!matchedVariant) return undefined;

        const raw = matchedVariant as unknown as Record<string, unknown>;
        const variantTitle = optionNames.length > 0
            ? optionNames.map((name) => selectedVariants[name]).filter(Boolean).join(' / ')
            : ((matchedVariant as { title?: string }).title || Object.values(selectedVariants).join(' / '));

        return {
            variantId: matchedVariant.id,
            variantTitle,
            price: (typeof raw.price === 'number' ? raw.price : Number(raw.price)) || product.price,
            comparePrice: raw.compare_price != null ? Number(raw.compare_price) : null,
        };
    };

    const resolvedVariant = hasVariants ? resolveMatchingVariant() : undefined;
    const displayPrice = resolvedVariant?.price ?? product.price;
    const displayComparePrice = hasVariants
        ? (resolvedVariant?.comparePrice ?? null)
        : product.compareAtPrice;
    const displayStock = (() => {
        if (!hasVariants) return product.stock;
        const variants = product.variants || [];
        if (variants.length === 0) return product.stock;
        const matched = variants.find((v) => {
            const raw = v as unknown as Record<string, unknown>;
            const o1 = raw.option1 as string | null | undefined;
            const o2 = raw.option2 as string | null | undefined;
            const o3 = raw.option3 as string | null | undefined;
            const optVals = [o1, o2, o3].filter(Boolean) as string[];
            const groupKeys = Object.keys(selectedVariants);
            return groupKeys.every((k, i) => optVals[i] === selectedVariants[k]);
        });
        if (!matched) return product.stock;
        const raw = matched as unknown as Record<string, unknown>;
        return typeof raw.inventory_qty === 'number' ? raw.inventory_qty
            : typeof raw.stock === 'number' ? raw.stock
            : product.stock;
    })();

    discount = displayComparePrice && displayComparePrice > displayPrice
        ? Math.round((1 - displayPrice / displayComparePrice) * 100)
        : 0;

    const handleQuantity = (delta: number) => {
        const newQty = quantity + delta;
        if (newQty >= 1 && newQty <= displayStock) {
            setQuantity(newQty);
        }
    };

    const handleAddToCart = () => {
        for (let i = 0; i < quantity; i++) {
            addToCart(product, resolvedVariant);
        }
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
    };

    const handleBuyNow = () => {
        for (let i = 0; i < quantity; i++) {
            addToCart(product, resolvedVariant);
        }
        router.push(`${basePath}/cart`);
    };

    const specs = product.specifications || {};
    const hasSpecs = Object.keys(specs).length > 0;

    const selectVariant = (group: string, value: string) => {
        setSelectedVariants(prev => ({ ...prev, [group]: value }));
    };

    // Only show rating if it exists and is > 0
    const showRating = product.rating && product.rating > 0;

    return (
        <div className="min-h-screen" style={{ backgroundColor: colors.backgroundColor }}>
            {/* Spacer for fixed header */}
            <div className="h-16 md:h-20" />

            <div className="max-w-5xl mx-auto px-4 pb-8">
                {/* Breadcrumb */}
                <div className="py-4">
                    <Link
                        href={basePath}
                        className="inline-flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
                        style={{ color: colors.primaryColor }}
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Store</span>
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
                    {/* Image Gallery */}
                    <div className="space-y-3">
                        {/* Main Image */}
                        <motion.div
                            className="relative aspect-square overflow-hidden shadow-lg"
                            style={{ backgroundColor: 'var(--card-bg-secondary)', borderRadius: `${colors.borderRadius}px` }}
                        >
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={selectedImage}
                                    initial={{ opacity: 0, scale: 1.02 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.3 }}
                                    className="absolute inset-0"
                                >
                                    <Image
                                        src={productImages[selectedImage] || productImageFallback}
                                        alt={product.name}
                                        fill
                                        sizes="(max-width: 1024px) 100vw, 50vw"
                                        className="object-cover"
                                        priority
                                        unoptimized
                                    />
                                </motion.div>
                            </AnimatePresence>

                            {/* Badges */}
                            <div className="absolute top-3 left-3 flex flex-col gap-2">
                                {discount > 0 && (
                                    <span
                                        className="text-white text-xs font-bold px-2.5 py-1 rounded-md shadow"
                                        style={{ backgroundColor: colors.accentColor || 'rgb(255 71 87)' }}
                                    >
                                        {discount}% OFF
                                    </span>
                                )}
                                {product.isNew && (
                                    <span className="bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow">
                                        NEW
                                    </span>
                                )}
                                {product.isTrending && (
                                    <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow">
                                        <Flame size={12} aria-hidden="true" /> HOT
                                    </span>
                                )}
                            </div>

                            {/* Wishlist & Share */}
                            <div className="absolute top-3 right-3 flex flex-col gap-2">
                                <Button unstyled
                                    type="button"
                                    aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                                    aria-pressed={isWishlisted}
                                    onClick={() => setIsWishlisted(!isWishlisted)}
                                    className={`flex h-11 w-11 items-center justify-center rounded-full shadow transition-all ${isWishlisted ? 'bg-rose-500 text-white' : 'card-theme text-theme-secondary'}`}
                                >
                                    <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
                                </Button>
                                <Button unstyled
                                    type="button"
                                    aria-label="Share product"
                                    className="flex h-11 w-11 items-center justify-center rounded-full shadow card-theme text-theme-secondary"
                                >
                                    <Share2 size={18} />
                                </Button>
                            </div>
                        </motion.div>

                        {/* Thumbnails */}
                        {productImages.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {productImages.map((img, i) => (
                                    <Button unstyled
                                        key={i}
                                        type="button"
                                        aria-label={`View product image ${i + 1}`}
                                        aria-current={selectedImage === i}
                                        onClick={() => setSelectedImage(i)}
                                        className={`relative h-16 w-16 flex-shrink-0 overflow-hidden transition-all border-2 shadow-sm ${selectedImage === i
                                            ? 'opacity-100'
                                            : 'opacity-60 hover:opacity-100 border-transparent'
                                            }`}
                                        style={{
                                            borderRadius: `${colors.borderRadius / 2}px`,
                                            borderColor: selectedImage === i ? colors.primaryColor : 'transparent'
                                        }}
                                    >
                                        <Image src={img} alt="" fill sizes="64px" className="object-cover" unoptimized />
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Product Info */}
                    <div className="space-y-4">
                        {/* Title */}
                        <h1
                            className="text-xl md:text-2xl font-bold leading-tight"
                            style={{ color: colors.textColor }}
                        >
                            {product.name}
                        </h1>

                        {/* Rating - Only show if exists and > 0 */}
                        {showRating && (
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded">
                                    <Star size={14} className="text-green-600 fill-green-600" />
                                    <span className="text-sm font-semibold text-green-700">{product.rating}</span>
                                </div>
                                {product.reviewCount && product.reviewCount > 0 && (
                                    <span className="text-sm text-theme-secondary">({product.reviewCount} reviews)</span>
                                )}
                            </div>
                        )}

                        {/* Price */}
                        <div className="flex items-baseline gap-3 flex-wrap">
                            <span
                                className="text-2xl md:text-3xl font-bold"
                                style={{ color: colors.primaryColor }}
                            >
                                ₹{displayPrice.toLocaleString('en-IN')}
                            </span>
                            {displayComparePrice && displayComparePrice > displayPrice && (
                                <>
                                    <span className="text-lg text-theme-muted line-through">
                                        ₹{displayComparePrice.toLocaleString('en-IN')}
                                    </span>
                                    <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                        Save ₹{(displayComparePrice - displayPrice).toLocaleString('en-IN')}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Description */}
                        {product.description && (
                            <p className="text-theme-secondary text-sm leading-relaxed">
                                {product.description}
                            </p>
                        )}

                        {/* Stock Status */}
                        <div className="flex items-center gap-2 text-sm">
                            <div
                                className={`w-2 h-2 rounded-full ${displayStock > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                            />
                            <span className={displayStock > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {displayStock > 0 ? 'In Stock' : 'Out of Stock'}
                            </span>
                            {displayStock > 0 && displayStock < 10 && (
                                <span className="text-orange-500 text-xs">• Hurry! Only {displayStock} left</span>
                            )}
                        </div>

                        {/* Variants Selection */}
                        {hasVariants && (
                            <div className="space-y-4 pt-2 border-t" style={{ borderColor: `${colors.primaryColor}15` }}>
                                <h3 className="font-semibold text-sm" style={{ color: colors.textColor }}>
                                    Select Options
                                </h3>
                                {Object.entries(variantGroups).map(([groupName, options]) => (
                                    <div key={groupName}>
                                        <label className="text-sm font-medium mb-2 block" style={{ color: colors.textColor }}>
                                            {groupName}: <span className="font-semibold" style={{ color: colors.primaryColor }}>{selectedVariants[groupName]}</span>
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {options.map((option) => {
                                                const isSelected = selectedVariants[groupName] === option;
                                                return (
                                                    <motion.button
                                                        key={option}
                                                        type="button"
                                                        aria-pressed={isSelected}
                                                        onClick={() => selectVariant(groupName, option)}
                                                        whileTap={{ scale: 0.95 }}
                                                        className={`px-3 py-2 text-sm rounded-lg border-2 transition-all flex items-center gap-1 font-medium ${isSelected
                                                            ? 'text-white shadow-md'
                                                            : 'card-theme hover:opacity-80'
                                                            }`}
                                                        style={{
                                                            backgroundColor: isSelected ? colors.primaryColor : undefined,
                                                            borderColor: isSelected ? colors.primaryColor : 'rgb(229 231 235)'
                                                        }}
                                                    >
                                                        {isSelected && <Check size={14} />}
                                                        {option}
                                                    </motion.button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Specifications */}
                        {hasSpecs && (
                            <div
                                className="border rounded-xl overflow-hidden"
                                style={{ borderColor: `${colors.primaryColor}20` }}
                            >
                                <Button unstyled
                                    type="button"
                                    aria-expanded={specsOpen}
                                    onClick={() => setSpecsOpen(!specsOpen)}
                                    className="w-full flex items-center justify-between p-3 bg-surface hover:bg-surface-hover transition-colors"
                                >
                                    <span className="font-medium text-sm" style={{ color: colors.textColor }}>
                                        Specifications ({Object.keys(specs).length})
                                    </span>
                                    {specsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </Button>
                                <AnimatePresence>
                                    {specsOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="p-3 space-y-2">
                                                {Object.entries(specs).map(([key, value]) => (
                                                    <div key={key} className="flex justify-between items-center py-1.5 border-b border-card last:border-0">
                                                        <span className="text-sm text-theme-muted">{key}</span>
                                                        <span className="text-sm font-medium" style={{ color: colors.textColor }}>{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Quantity Selector */}
                        <div className="flex items-center gap-4 pt-2">
                            <span className="text-sm font-medium" style={{ color: colors.textColor }}>Quantity:</span>
                            <div
                                className="flex items-center border rounded-lg overflow-hidden"
                                style={{ borderColor: `${colors.primaryColor}30` }}
                            >
                                <Button unstyled
                                    type="button"
                                    aria-label="Decrease quantity"
                                    onClick={() => handleQuantity(-1)}
                                    disabled={quantity <= 1}
                                    className="flex h-11 w-11 items-center justify-center hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                                >
                                    <Minus size={16} />
                                </Button>
                                <span
                                    aria-live="polite"
                                    className="px-5 py-1.5 font-semibold min-w-[48px] text-center card-theme-secondary"
                                    style={{ color: colors.textColor }}
                                >
                                    {quantity}
                                </span>
                                <Button unstyled
                                    type="button"
                                    aria-label="Increase quantity"
                                    onClick={() => handleQuantity(1)}
                                    disabled={quantity >= displayStock}
                                    className="flex h-11 w-11 items-center justify-center hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                                >
                                    <Plus size={16} />
                                </Button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 pt-3 sm:flex-row">
                            <motion.button
                                type="button"
                                onClick={handleAddToCart}
                                whileTap={{ scale: 0.98 }}
                                disabled={displayStock === 0}
                                className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 py-3.5 font-semibold transition-all disabled:opacity-50 sm:flex-1 ${addedToCart
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'hover:bg-surface-hover'
                                    }`}
                                style={{
                                    borderColor: addedToCart ? undefined : colors.primaryColor,
                                    color: addedToCart ? undefined : colors.primaryColor
                                }}
                            >
                                <ShoppingBag size={18} />
                                {addedToCart ? 'Added!' : 'Add to Cart'}
                            </motion.button>

                            <motion.button
                                type="button"
                                onClick={handleBuyNow}
                                whileTap={{ scale: 0.98 }}
                                disabled={displayStock === 0}
                                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-white shadow-lg disabled:opacity-50 sm:flex-1"
                                style={{ backgroundColor: colors.primaryColor }}
                            >
                                <Zap size={18} />
                                Buy Now
                            </motion.button>
                        </div>

                        {/* Trust Badges */}
                        <div className="grid grid-cols-2 gap-2 p-3 bg-surface rounded-xl">
                            {[
                                { icon: Truck, title: 'Free Delivery', sub: 'Above ₹999' },
                                { icon: ShieldCheck, title: 'Authentic', sub: 'Verified' },
                                { icon: RefreshCcw, title: 'Easy Returns', sub: '7 Days' },
                                { icon: Package, title: 'Secure Pack', sub: 'Safe delivery' },
                            ].map(({ icon: Icon, title, sub }) => (
                                <div key={title} className="flex min-w-0 items-center gap-2">
                                    <div
                                        className="shrink-0 rounded-lg p-1.5"
                                        style={{ backgroundColor: `${colors.primaryColor}15` }}
                                    >
                                        <Icon size={14} style={{ color: colors.primaryColor }} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold" style={{ color: colors.textColor }}>{title}</p>
                                        <p className="truncate text-[10px] text-theme-muted">{sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
