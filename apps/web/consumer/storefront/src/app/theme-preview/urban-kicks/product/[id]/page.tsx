'use client';

import PreviewShell from '../../_components/preview-shell';
import { MOCK_PRODUCTS, BRAND_GALLERY, formatPrice } from '../../_lib/mock-data';
import { useCart } from '@/context/cart-context';
import { usePreviewWishlist } from '../../_context/wishlist-context';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useMemo, useRef } from 'react';
import {
    ChevronRight, Star, Heart, ShoppingBag, Truck, Shield, RotateCcw,
    Minus, Plus, Share2, Check, Sparkles, ChevronDown, Ruler, Package,
    Info, MessageSquare, Zap, Leaf, Gem, Play, Pause, Image as ImageIcon
} from 'lucide-react';

const SIZES_MAP: Record<string, string[]> = {
    Sneakers: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'],
    Apparel: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    Accessories: ['One Size'],
};

const COLORS = [
    { name: 'Black', hex: '#111' },
    { name: 'White', hex: '#FFF' },
    { name: 'Grey', hex: '#888' },
    { name: 'Navy', hex: '#1A237E' },
];

type TabKey = 'details' | 'sizing' | 'shipping' | 'reviews';

export default function ProductDetailPage() {
    const params = useParams();
    const productId = params.id as string;
    const product = MOCK_PRODUCTS.find(p => p.id === productId);
    const { addToCart } = useCart();
    const router = useRouter();
    const { isInWishlist, toggleWishlist } = usePreviewWishlist();

    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [selectedColor, setSelectedColor] = useState(COLORS[0].name);
    const [quantity, setQuantity] = useState(1);
    const wishlisted = product ? isInWishlist(product.id) : false;
    const [activeTab, setActiveTab] = useState<TabKey>('details');
    const [addedToCart, setAddedToCart] = useState(false);
    const [mainImage, setMainImage] = useState(0);
    const [toast, setToast] = useState<string | null>(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const FEATURE_ICONS: Record<string, typeof Zap> = { Zap, Shield, Leaf, Gem };
    const gallery = product ? BRAND_GALLERY[product.category ?? ''] : null;

    const sizes = product ? SIZES_MAP[product.category ?? ''] || ['One Size'] : [];
    const discount = product?.compareAtPrice
        ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
        : 0;

    const related = useMemo(() => {
        if (!product) return [];
        return MOCK_PRODUCTS.filter(p => p.id !== product.id && p.category === product.category).slice(0, 4);
    }, [product]);

    // Generate pseudo gallery from single image
    const images = product ? [
        product.images[0],
        product.images[0],
        product.images[0],
    ] : [];

    const handleAddToCart = () => {
        if (!product) return;
        if (sizes.length > 1 && !selectedSize) {
            setToast('Please select a size before adding to cart');
            setTimeout(() => setToast(null), 3000);
            return;
        }
        for (let i = 0; i < quantity; i++) {
            addToCart(product);
        }
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
    };

    const handleBuyNow = () => {
        if (!product) return;
        if (sizes.length > 1 && !selectedSize) {
            setToast('Please select a size before buying');
            setTimeout(() => setToast(null), 3000);
            return;
        }
        for (let i = 0; i < quantity; i++) {
            addToCart(product);
        }
        router.push('/theme-preview/urban-kicks/checkout');
    };

    if (!product) {
        return (
            <PreviewShell hideFooter showWatermark>
                <div className="max-w-screen-xl mx-auto px-4 py-20 text-center">
                    <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
                    <h1 className="text-xl font-bold mb-2">Product not found</h1>
                    <p className="text-gray-500 text-sm mb-6">The product you&apos;re looking for doesn&apos;t exist.</p>
                    <Link
                        href="/theme-preview/urban-kicks/shop"
                        className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full text-sm font-semibold"
                    >
                        Browse Shop
                    </Link>
                </div>
            </PreviewShell>
        );
    }

    const TABS: { key: TabKey; label: string; icon: typeof Info }[] = [
        { key: 'details', label: 'Details', icon: Info },
        { key: 'sizing', label: 'Size Guide', icon: Ruler },
        { key: 'shipping', label: 'Shipping', icon: Package },
        { key: 'reviews', label: `Reviews (${product.reviewCount || 0})`, icon: MessageSquare },
    ];

    return (
        <PreviewShell hideFooter showWatermark>
            <div className="max-w-screen-xl mx-auto px-4 py-6 md:py-10">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6">
                    <Link href="/theme-preview/urban-kicks" className="hover:text-black transition-colors">Home</Link>
                    <ChevronRight size={12} />
                    <Link href="/theme-preview/urban-kicks/shop" className="hover:text-black transition-colors">Shop</Link>
                    <ChevronRight size={12} />
                    <span className="text-black font-medium truncate max-w-[180px]">{product.name}</span>
                </nav>

                {/* ═══ Main PDP Section ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                    {/* ── Left: Image Gallery ── */}
                    <div className="space-y-3">
                        {/* Main Image */}
                        <div className="relative aspect-square bg-gray-50 rounded-2xl overflow-hidden">
                            <img
                                src={images[mainImage]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                            />
                            {/* Badges */}
                            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
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
                                {discount > 0 && (
                                    <span className="bg-green-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-lg">
                                        {discount}% OFF
                                    </span>
                                )}
                            </div>
                            {/* Share */}
                            <button className="absolute top-3 right-3 p-2.5 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors">
                                <Share2 size={16} />
                            </button>
                        </div>

                        {/* Thumbnails */}
                        <div className="flex gap-2">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setMainImage(idx)}
                                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${mainImage === idx ? 'border-black' : 'border-transparent hover:border-gray-300'
                                        }`}
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Right: Product Info ── */}
                    <div className="space-y-5">
                        {/* Category & Name */}
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">{product.category}</p>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">{product.name}</h1>
                        </div>

                        {/* Rating */}
                        {product.rating && (
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <Star
                                            key={star}
                                            size={14}
                                            className={star <= Math.floor(product.rating!)
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-gray-200'
                                            }
                                        />
                                    ))}
                                </div>
                                <span className="text-sm font-semibold">{product.rating}</span>
                                <span className="text-xs text-gray-400">({product.reviewCount} reviews)</span>
                            </div>
                        )}

                        {/* Price */}
                        <div className="flex items-baseline gap-3">
                            <span className="text-2xl md:text-3xl font-bold">{formatPrice(product.price)}</span>
                            {product.compareAtPrice && (
                                <>
                                    <span className="text-lg text-gray-400 line-through">{formatPrice(product.compareAtPrice)}</span>
                                    <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md">
                                        Save {formatPrice(product.compareAtPrice - product.price)}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Description */}
                        <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>

                        <hr className="border-gray-100" />

                        {/* Color Picker */}
                        <div>
                            <p className="text-sm font-semibold mb-2.5">
                                Color: <span className="font-normal text-gray-500">{selectedColor}</span>
                            </p>
                            <div className="flex items-center gap-2.5">
                                {COLORS.map(c => (
                                    <button
                                        key={c.name}
                                        onClick={() => setSelectedColor(c.name)}
                                        className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center ${selectedColor === c.name ? 'border-black scale-110' : 'border-gray-200 hover:border-gray-400'
                                            }`}
                                        style={{ backgroundColor: c.hex }}
                                    >
                                        {selectedColor === c.name && (
                                            <Check size={14} className={c.hex === '#FFF' ? 'text-black' : 'text-white'} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Size Picker */}
                        <div>
                            <div className="flex items-center justify-between mb-2.5">
                                <p className="text-sm font-semibold">
                                    Size: <span className="font-normal text-gray-500">{selectedSize || 'Select'}</span>
                                </p>
                                <button className="text-xs text-gray-500 hover:text-black underline flex items-center gap-1 transition-colors">
                                    <Ruler size={12} /> Size Guide
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {sizes.map((size: string) => (
                                    <button
                                        key={size}
                                        onClick={() => setSelectedSize(size)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${selectedSize === size
                                            ? 'border-black bg-black text-white'
                                            : 'border-gray-200 hover:border-black'
                                            }`}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Quantity */}
                        <div>
                            <p className="text-sm font-semibold mb-2.5">Quantity</p>
                            <div className="inline-flex items-center border border-gray-200 rounded-xl h-10">
                                <button
                                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                    className="w-10 h-full flex items-center justify-center hover:bg-gray-50 transition-colors rounded-l-xl"
                                >
                                    <Minus size={14} />
                                </button>
                                <span className="w-12 text-center text-sm font-semibold border-x border-gray-200">{quantity}</span>
                                <button
                                    onClick={() => setQuantity(q => Math.min(10, q + 1))}
                                    className="w-10 h-full flex items-center justify-center hover:bg-gray-50 transition-colors rounded-r-xl"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                            {product.stock && product.stock <= 10 && (
                                <p className="text-xs text-red-500 font-medium mt-1.5">Only {product.stock} left in stock!</p>
                            )}
                        </div>

                        {/* CTA Buttons */}
                        <div className="space-y-2.5 pt-1">
                            <div className="flex gap-3">
                                <button
                                    onClick={handleAddToCart}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold border-2 transition-all active:scale-[0.98] ${addedToCart
                                        ? 'bg-green-600 text-white border-green-600'
                                        : sizes.length > 1 && !selectedSize
                                            ? 'bg-gray-100 text-gray-400 border-gray-200'
                                            : 'bg-white text-black border-black hover:bg-gray-50'
                                        }`}
                                >
                                    {addedToCart ? (
                                        <><Check size={16} /> Added to Cart</>
                                    ) : (
                                        <><ShoppingBag size={16} /> Add to Cart</>
                                    )}
                                </button>
                                <button
                                    onClick={() => product && toggleWishlist(product.id)}
                                    className={`w-14 flex items-center justify-center rounded-xl border-2 transition-all ${wishlisted
                                        ? 'border-red-200 bg-red-50 text-red-500'
                                        : 'border-gray-200 hover:border-black text-gray-600'
                                        }`}
                                >
                                    <Heart size={18} fill={wishlisted ? 'currentColor' : 'none'} />
                                </button>
                            </div>
                            <button
                                onClick={handleBuyNow}
                                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] bg-black text-white hover:bg-black/90`}
                            >
                                Buy Now · {formatPrice(product.price * quantity)}
                            </button>
                        </div>

                        {/* Trust Badges */}
                        <div className="grid grid-cols-3 gap-3 pt-2">
                            {[
                                { icon: Truck, title: 'Free Shipping', sub: 'Orders over ₹2,000' },
                                { icon: Shield, title: 'Secure Payment', sub: '100% protected' },
                                { icon: RotateCcw, title: 'Easy Returns', sub: '7-day policy' },
                            ].map(({ icon: Icon, title, sub }) => (
                                <div key={title} className="text-center bg-gray-50 rounded-xl py-3 px-2">
                                    <Icon size={16} className="mx-auto text-gray-500 mb-1" />
                                    <p className="text-[10px] font-semibold">{title}</p>
                                    <p className="text-[9px] text-gray-400">{sub}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ═══ Brand Gallery / Storytelling Section ═══ */}
                {gallery && (
                    <div className="mt-14 space-y-10">

                        {/* ── Section Header ── */}
                        <div className="text-center">
                            <p className="text-[10px] font-bold tracking-[0.3em] text-gray-400 uppercase mb-2">From the Brand</p>
                            <h2 className="text-xl sm:text-2xl font-black tracking-tight">The Story Behind the Product</h2>
                        </div>

                        {/* ── 1. Hero Lifestyle Banner ── */}
                        <div className="relative rounded-2xl overflow-hidden aspect-[16/9] sm:aspect-[21/9] group">
                            <img
                                src={gallery.heroBanner.image}
                                alt={gallery.heroBanner.title}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
                                <h3 className="text-white text-lg sm:text-2xl font-black tracking-wider mb-1">
                                    {gallery.heroBanner.title}
                                </h3>
                                <p className="text-white/70 text-xs sm:text-sm max-w-md">
                                    {gallery.heroBanner.subtitle}
                                </p>
                            </div>
                        </div>

                        {/* ── 2. Feature Highlights Grid ── */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {gallery.features.map((feat, i) => {
                                const FeatureIcon = FEATURE_ICONS[feat.icon] || Zap;
                                return (
                                    <div
                                        key={i}
                                        className="bg-gray-50 rounded-2xl p-4 sm:p-5 text-center hover:bg-gray-100 transition-colors group/feat"
                                    >
                                        <div className="w-10 h-10 mx-auto mb-3 bg-black rounded-xl flex items-center justify-center group-hover/feat:scale-110 transition-transform">
                                            <FeatureIcon size={18} className="text-white" />
                                        </div>
                                        <p className="text-xs sm:text-sm font-bold mb-0.5">{feat.title}</p>
                                        <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed">{feat.description}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── 3. Split Content Panels ── */}
                        <div className="space-y-6">
                            {gallery.splitPanels.map((panel, i) => (
                                <div
                                    key={i}
                                    className={`flex flex-col ${i % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'} gap-5 items-center`}
                                >
                                    <div className="w-full sm:w-1/2 aspect-[4/3] rounded-2xl overflow-hidden">
                                        <img
                                            src={panel.image}
                                            alt={panel.title}
                                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>
                                    <div className="w-full sm:w-1/2 px-1 sm:px-6">
                                        <h4 className="text-base sm:text-lg font-bold mb-2">{panel.title}</h4>
                                        <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{panel.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── 4. Video Player ── */}
                        {gallery.video && (
                            <div className="relative rounded-2xl overflow-hidden aspect-video bg-black shadow-xl">
                                {!isVideoPlaying ? (
                                    <>
                                        <img
                                            src={gallery.video.thumbnail}
                                            alt={gallery.video.title}
                                            className="w-full h-full object-cover opacity-80"
                                        />
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                            <button
                                                onClick={() => {
                                                    setIsVideoPlaying(true);
                                                    setTimeout(() => videoRef.current?.play(), 100);
                                                }}
                                                className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 hover:bg-white/30 transition-all hover:scale-110 active:scale-95"
                                            >
                                                <Play size={28} className="text-white ml-1" fill="white" />
                                            </button>
                                            <p className="text-white/80 text-xs sm:text-sm font-medium">{gallery.video.title}</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="relative w-full h-full">
                                        <video
                                            ref={videoRef}
                                            src={gallery.video.url}
                                            className="w-full h-full object-cover"
                                            controls
                                            onEnded={() => setIsVideoPlaying(false)}
                                        />
                                        <button
                                            onClick={() => {
                                                videoRef.current?.pause();
                                                setIsVideoPlaying(false);
                                            }}
                                            className="absolute top-3 right-3 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                                        >
                                            <Pause size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── 5. Image Showcase Grid (Bento) ── */}
                        {gallery.showcaseImages.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <ImageIcon size={16} className="text-gray-400" />
                                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Gallery</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 auto-rows-[160px] sm:auto-rows-[200px]">
                                    {gallery.showcaseImages.map((img, i) => {
                                        // Bento: first and last images span 2 rows on desktop
                                        const isLarge = i === 0 || i === gallery.showcaseImages.length - 1;
                                        return (
                                            <div
                                                key={i}
                                                className={`rounded-2xl overflow-hidden ${isLarge ? 'sm:col-span-2 sm:row-span-2' : ''} ${i === 0 ? 'col-span-2 sm:col-span-2' : ''}`}
                                            >
                                                <img
                                                    src={img}
                                                    alt={`Showcase ${i + 1}`}
                                                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500 cursor-pointer"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    </div>
                )}

                {/* ═══ Tabs Section ═══ */}
                <div className="mt-12 border-t border-gray-100 pt-8">
                    {/* Tab Bar */}
                    <div className="bg-gray-100 rounded-2xl p-1 grid grid-cols-2 sm:grid-cols-4 gap-1 mb-6">
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            const active = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`relative flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 py-2.5 text-[11px] sm:text-xs font-semibold rounded-xl transition-all duration-200 ${active
                                        ? 'bg-black text-white shadow-md'
                                        : 'text-gray-500 hover:text-black hover:bg-white/60'
                                        }`}
                                >
                                    <Icon size={13} className="flex-shrink-0" />
                                    <span className="truncate">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content */}
                    <div className="max-w-3xl">
                        {activeTab === 'details' && (
                            <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                                <p>{product.description}</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Material</p>
                                        <p className="font-medium text-black">
                                            {product.category === 'Sneakers' ? 'Premium leather & mesh upper' :
                                                product.category === 'Apparel' ? '100% heavyweight cotton' :
                                                    'Durable nylon & polyester'}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Fit</p>
                                        <p className="font-medium text-black">
                                            {product.category === 'Sneakers' ? 'True to size' :
                                                product.category === 'Apparel' ? 'Relaxed / Oversized' :
                                                    'One size fits most'}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Care</p>
                                        <p className="font-medium text-black">
                                            {product.category === 'Sneakers' ? 'Wipe with damp cloth' :
                                                'Machine wash cold, hang dry'}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">SKU</p>
                                        <p className="font-medium text-black font-mono">{product.id.toUpperCase()}-BLK</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'sizing' && (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600">
                                    {product.category === 'Sneakers'
                                        ? 'Our sneakers run true to size. If you prefer extra room, we recommend going half a size up.'
                                        : product.category === 'Apparel'
                                            ? 'This item features an oversized fit. If you prefer a snug fit, size down.'
                                            : 'This accessory is one-size-fits-most.'}
                                </p>
                                {product.category !== 'Accessories' && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    {product.category === 'Sneakers'
                                                        ? ['UK', 'US', 'EU', 'CM'].map(h => (
                                                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                                        ))
                                                        : ['Size', 'Chest', 'Waist', 'Length'].map(h => (
                                                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                                        ))
                                                    }
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {product.category === 'Sneakers' ? (
                                                    [
                                                        ['6', '7', '39', '24.5'],
                                                        ['7', '8', '40', '25.5'],
                                                        ['8', '9', '41', '26'],
                                                        ['9', '10', '42.5', '27'],
                                                        ['10', '11', '44', '28'],
                                                        ['11', '12', '45', '29'],
                                                    ].map((row, i) => (
                                                        <tr key={i} className="border-t border-gray-100">
                                                            {row.map((cell, j) => (
                                                                <td key={j} className="px-4 py-2 text-sm">{cell}</td>
                                                            ))}
                                                        </tr>
                                                    ))
                                                ) : (
                                                    [
                                                        ['XS', '34"', '28"', '26"'],
                                                        ['S', '36"', '30"', '27"'],
                                                        ['M', '38"', '32"', '28"'],
                                                        ['L', '40"', '34"', '29"'],
                                                        ['XL', '42"', '36"', '30"'],
                                                        ['XXL', '44"', '38"', '31"'],
                                                    ].map((row, i) => (
                                                        <tr key={i} className="border-t border-gray-100">
                                                            {row.map((cell, j) => (
                                                                <td key={j} className="px-4 py-2 text-sm">{cell}</td>
                                                            ))}
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'shipping' && (
                            <div className="space-y-4 text-sm text-gray-600">
                                <div className="space-y-3">
                                    {[
                                        { title: 'Standard Shipping', time: '5–7 business days', price: '₹99 (Free over ₹2,000)' },
                                        { title: 'Express Shipping', time: '2–3 business days', price: '₹249' },
                                        { title: 'Same Day Delivery', time: 'Within 12 hours (Select cities)', price: '₹499' },
                                    ].map(option => (
                                        <div key={option.title} className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                                            <div>
                                                <p className="font-semibold text-black text-sm">{option.title}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">{option.time}</p>
                                            </div>
                                            <span className="text-sm font-medium">{option.price}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400">
                                    All orders are processed within 24 hours. Tracking information will be sent via email.
                                </p>
                            </div>
                        )}

                        {activeTab === 'reviews' && (
                            <div className="space-y-5">
                                {/* Rating Summary */}
                                <div className="flex items-center gap-6 bg-gray-50 rounded-2xl p-5">
                                    <div className="text-center">
                                        <p className="text-4xl font-bold">{product.rating}</p>
                                        <div className="flex items-center gap-0.5 justify-center mt-1">
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <Star key={s} size={12} className={s <= Math.floor(product.rating!) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">{product.reviewCount} reviews</p>
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                        {[5, 4, 3, 2, 1].map(star => {
                                            const percent = star === 5 ? 68 : star === 4 ? 22 : star === 3 ? 7 : star === 2 ? 2 : 1;
                                            return (
                                                <div key={star} className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500 w-3">{star}</span>
                                                    <Star size={10} className="fill-yellow-400 text-yellow-400 flex-shrink-0" />
                                                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${percent}%` }} />
                                                    </div>
                                                    <span className="text-xs text-gray-400 w-8 text-right">{percent}%</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Sample Reviews */}
                                {[
                                    { name: 'Arjun M.', date: '2 days ago', rating: 5, text: 'Absolutely love these! The quality is premium and they look even better in person. True to size.' },
                                    { name: 'Priya S.', date: '1 week ago', rating: 4, text: 'Great product, fast shipping. Slightly different shade than the photos but still happy with my purchase.' },
                                    { name: 'Rahul K.', date: '2 weeks ago', rating: 5, text: 'Third time buying from Urban Kicks. Never disappoints. The packaging is also top-notch.' },
                                ].map((review, idx) => (
                                    <div key={idx} className="border-b border-gray-100 pb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold">
                                                    {review.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold">{review.name}</p>
                                                    <div className="flex items-center gap-1">
                                                        {[1, 2, 3, 4, 5].map(s => (
                                                            <Star key={s} size={10} className={s <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs text-gray-400">{review.date}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 leading-relaxed">{review.text}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ Related Products ═══ */}
                {related.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold tracking-tight">You May Also Like</h2>
                            <Link href="/theme-preview/urban-kicks/shop" className="text-xs font-medium text-gray-500 hover:text-black flex items-center gap-1 transition-colors">
                                View All <ChevronRight size={12} />
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                            {related.map(p => (
                                <Link
                                    key={p.id}
                                    href={`/theme-preview/urban-kicks/product/${p.id}`}
                                    className="group bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-all"
                                >
                                    <div className="relative aspect-square bg-gray-50 overflow-hidden">
                                        <img
                                            src={p.images?.[0] || ''}
                                            alt={p.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                        {p.isNew && (
                                            <span className="absolute top-2 left-2 bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-lg uppercase">New</span>
                                        )}
                                    </div>
                                    <div className="p-2.5">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{p.category}</p>
                                        <h4 className="text-xs font-semibold leading-tight truncate mt-0.5">{p.name}</h4>
                                        <div className="flex items-center justify-between mt-1.5">
                                            <span className="font-bold text-xs">{formatPrice(p.price)}</span>
                                            {p.rating && (
                                                <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                                    <Star size={10} className="fill-yellow-400 text-yellow-400" /> {p.rating}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>



            {/* Toast Snackbar */}
            {toast && (
                <div className="fixed top-20 left-1/2 z-[60]" style={{ transform: 'translateX(-50%)', animation: 'toastSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                    <div className="bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 whitespace-nowrap">
                        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3l9.66 16.59A1 1 0 0120.16 21H3.84a1 1 0 01-.86-1.41L12 3z" />
                        </svg>
                        {toast}
                    </div>
                </div>
            )}
            <style>{`@keyframes toastSlideDown { from { opacity: 0; transform: translateX(-50%) translateY(-24px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
        </PreviewShell>
    );
}
