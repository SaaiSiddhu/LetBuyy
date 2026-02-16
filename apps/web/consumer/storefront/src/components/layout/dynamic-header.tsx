'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Menu, Search, X, ChevronRight, Home, Store, FileText, Shield, Truck, TrendingUp } from 'lucide-react';
import { useCart } from '@/context/cart-context';
import { HeaderSettings, NavPage, DEFAULT_NAV_PAGES, StoreModel, ThemeSettings, ProductModel, SiteType } from '@/types/store';

interface DynamicHeaderProps {
    store: StoreModel;
    settings?: HeaderSettings;
    products?: ProductModel[]; // Pass products for search
}

// Icon mapping for nav pages
const navIcons: Record<string, React.ReactNode> = {
    'home': <Home size={18} />,
    'shop': <Store size={18} />,
    'privacy': <Shield size={18} />,
    'terms': <FileText size={18} />,
    'shipping': <Truck size={18} />,
};

export default function DynamicHeader({ store, settings, products = [] }: DynamicHeaderProps) {
    const router = useRouter();
    const { scrollY } = useScroll();
    const [hidden, setHidden] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ProductModel[]>([]);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const { cartCount } = useCart();

    // Get theme settings from store
    const theme: ThemeSettings = store.templateConfig?.themeSettings || {
        primaryColor: '#00B3B3',
        secondaryColor: '#008080',
        accentColor: '#A4E500',
        backgroundColor: '#FFFFFF',
        textColor: '#1A1A2E',
        fontFamily: 'Inter',
        headingFontFamily: 'Inter',
        borderRadius: 12,
        enableAnimations: true,
        enableShadows: true,
    };

    // Get header settings with defaults
    const behavior = settings?.behavior || 'hide-on-scroll';
    const logoPlacement = settings?.logoPlacement || 'left';
    const displayMode = settings?.displayMode || 'both';
    const navPlacement = settings?.navPlacement || 'right';
    const navPages: NavPage[] = settings?.navPages || DEFAULT_NAV_PAGES;
    const showSearch = settings?.showSearch !== false && store.siteType === 'store';
    const showCart = settings?.showCart !== false && store.siteType === 'store';
    const isStoreSite = store.siteType === 'store';

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = scrollY.getPrevious() || 0;
        if (behavior === 'hide-on-scroll') {
            if (latest > previous && latest > 150) {
                setHidden(true);
            } else {
                setHidden(false);
            }
        }
        setScrolled(latest > 50);
    });

    // Search functionality
    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        const query = searchQuery.toLowerCase().trim();
        const results = products.filter(product => {
            const nameMatch = product.name.toLowerCase().includes(query);
            const descMatch = product.description?.toLowerCase().includes(query);
            const categoryMatch = product.category?.toLowerCase().includes(query);
            const tagsMatch = product.tags?.some(tag => tag.toLowerCase().includes(query));
            return nameMatch || descMatch || categoryMatch || tagsMatch;
        }).slice(0, 6); // Limit to 6 results

        setSearchResults(results);
    }, [searchQuery, products]);

    // Focus search input when opened
    useEffect(() => {
        if (searchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [searchOpen]);

    // Close search on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setSearchOpen(false);
                setSearchQuery('');
            }
        };

        if (searchOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [searchOpen]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/shop?search=${encodeURIComponent(searchQuery)}`);
            setSearchOpen(false);
            setSearchQuery('');
        }
    };

    const visiblePages = navPages.filter(p => p.isVisible);

    // Logo URL with proper fallback chain
    const getLogoUrl = (): string | null => {
        const settingsLogo = settings?.logoUrl;
        if (settingsLogo && typeof settingsLogo === 'string' && settingsLogo.length > 5 && settingsLogo.startsWith('http')) {
            return settingsLogo;
        }
        const storeLogo = store.logoUrl;
        if (storeLogo && typeof storeLogo === 'string' && storeLogo.length > 5 && storeLogo.startsWith('http')) {
            return storeLogo;
        }
        return null;
    };

    const logoUrl = getLogoUrl();
    const hasValidLogo = logoUrl !== null;

    // Cart URL with subdomain
    const cartUrl = `/cart`;

    return (
        <>
            {/* ENHANCED PROFESSIONAL HEADER */}
            <motion.header
                variants={{
                    visible: { y: 0 },
                    hidden: { y: -100 },
                }}
                animate={behavior === 'hide-on-scroll' ? (hidden ? "hidden" : "visible") : "visible"}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                style={{
                    background: scrolled ? 'var(--header-bg-scrolled)' : `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
                    boxShadow: scrolled ? '0 4px 15px var(--header-shadow)' : 'none'
                }}
                className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'py-2' : 'py-3'}`}
            >
                <div className="container mx-auto px-4 md:px-6 flex items-center justify-between gap-4">

                    {/* Mobile Menu Button */}
                    <motion.button
                        onClick={() => setMobileMenuOpen(true)}
                        whileTap={{ scale: 0.95 }}
                        className={`p-2 rounded-lg lg:hidden transition-colors`}
                        style={{ color: scrolled ? 'var(--text)' : 'white' }}
                    >
                        <Menu size={24} strokeWidth={1.5} />
                    </motion.button>

                    {/* Left Nav (Desktop) */}
                    {navPlacement === 'left' && (
                        <nav className="hidden lg:flex items-center gap-6" style={{ color: scrolled ? 'var(--text-secondary)' : 'white' }}>
                            {visiblePages.slice(0, 5).map((page) => (
                                <Link
                                    key={page.id}
                                    href={page.href.startsWith('/') ? page.href : page.href}
                                    className="text-sm font-medium hover:opacity-70 transition-opacity"
                                >
                                    {page.label}
                                </Link>
                            ))}
                        </nav>
                    )}

                    {/* Logo/Brand - HORIZONTAL FORCED */}
                    <Link
                        href={`/`}
                        className={`flex items-center gap-2 ${logoPlacement === 'center' ? 'absolute left-1/2 -translate-x-1/2' : ''}`}
                    >
                        {hasValidLogo && (displayMode === 'logo' || displayMode === 'both') && (
                            <div className="h-8 md:h-9 flex items-center">
                                <Image
                                    src={logoUrl!}
                                    alt={store.name}
                                    width={160}
                                    height={36}
                                    className="h-full w-auto max-h-8 md:max-h-9 object-contain"
                                    style={{ maxWidth: '160px' }}
                                    priority
                                />
                            </div>
                        )}
                        {(displayMode === 'name' || (displayMode === 'both' && !hasValidLogo) || displayMode === 'logo' && !hasValidLogo) && (
                            <span
                                className="font-bold text-lg md:text-xl tracking-tight"
                                style={{ color: scrolled ? 'var(--text)' : 'white' }}
                            >
                                {store.name}
                            </span>
                        )}
                    </Link>

                    {/* Right Nav (Desktop) */}
                    {navPlacement === 'right' && (
                        <nav className="hidden lg:flex items-center gap-6" style={{ color: scrolled ? 'var(--text-secondary)' : 'white' }}>
                            {visiblePages.slice(0, 5).map((page) => (
                                <Link
                                    key={page.id}
                                    href={page.href.startsWith('/') ? page.href : page.href}
                                    className="text-sm font-medium hover:opacity-70 transition-opacity"
                                >
                                    {page.label}
                                </Link>
                            ))}
                        </nav>
                    )}

                    {/* Right Icons */}
                    <div className="flex items-center gap-1" style={{ color: scrolled ? 'var(--text)' : 'white' }}>
                        {showSearch && (
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setSearchOpen(!searchOpen)}
                                className={`p-2 rounded-lg ${scrolled ? 'hover:bg-surface-hover' : 'hover:bg-white/10'}`}
                            >
                                <Search size={20} strokeWidth={1.5} />
                            </motion.button>
                        )}
                        {showCart && (
                            <Link href={cartUrl}>
                                <motion.div
                                    whileTap={{ scale: 0.9 }}
                                    className={`relative p-2 rounded-lg ${scrolled ? 'hover:bg-surface-hover' : 'hover:bg-white/10'}`}
                                >
                                    <ShoppingBag size={20} strokeWidth={1.5} />
                                    <AnimatePresence>
                                        {cartCount > 0 && (
                                            <motion.span
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0 }}
                                                className="absolute -top-0.5 -right-0.5 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full"
                                                style={{ backgroundColor: theme.accentColor || '#ff4757' }}
                                            >
                                                {cartCount > 9 ? '9+' : cartCount}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Expandable Search Bar with Results */}
                <AnimatePresence>
                    {searchOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t"
                            style={{ borderColor: scrolled ? '#e5e7eb' : 'rgba(255,255,255,0.1)' }}
                        >
                            <div ref={searchContainerRef} className="container mx-auto px-4 py-3">
                                <form onSubmit={handleSearchSubmit} className="relative">
                                    <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${scrolled ? 'text-theme-muted' : 'text-white/60'}`} />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search products..."
                                        className={`w-full pl-10 pr-10 py-2.5 rounded-lg text-sm ${scrolled
                                            ? 'input-theme'
                                            : 'bg-white/10 text-white placeholder-white/60'
                                            } outline-none`}
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className={`absolute right-3 top-1/2 -translate-y-1/2 ${scrolled ? 'text-theme-muted hover:text-theme-secondary' : 'text-white/60 hover:text-white'}`}
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </form>

                                {/* Search Results Dropdown */}
                                {searchResults.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-2 card-theme rounded-lg shadow-xl overflow-hidden"
                                    >
                                        {searchResults.map((product) => (
                                            <Link
                                                key={product.id}
                                                href={`/product/${product.id}`}
                                                onClick={() => {
                                                    setSearchOpen(false);
                                                    setSearchQuery('');
                                                }}
                                                className="flex items-center gap-3 p-3 hover:bg-surface-hover transition-colors"
                                            >
                                                {product.images[0] && (
                                                    <img
                                                        src={product.images[0]}
                                                        alt={product.name}
                                                        className="w-12 h-12 object-cover rounded-lg"
                                                    />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-card truncate">{product.name}</p>
                                                    <p className="text-sm font-bold" style={{ color: theme.primaryColor }}>
                                                        ₹{product.price.toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                                <ChevronRight size={16} className="text-card-muted" />
                                            </Link>
                                        ))}
                                    </motion.div>
                                )}

                                {/* No results message */}
                                {searchQuery.length >= 2 && searchResults.length === 0 && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="mt-2 p-4 card-theme rounded-lg shadow-xl text-center text-card-muted text-sm"
                                    >
                                        No products found for "{searchQuery}"
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.header>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* COMPACT MOBILE DRAWER */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed top-0 left-0 bottom-0 w-[280px] card-theme z-[70] shadow-2xl lg:hidden flex flex-col"
                    >
                        {/* Minimal Header - Just Close Button */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-card">
                            <span className="text-sm font-medium text-card-muted uppercase tracking-wider">Menu</span>
                            <button
                                onClick={() => setMobileMenuOpen(false)}
                                className="p-2 -mr-2 rounded-lg text-card-muted hover:bg-surface-hover"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search in Mobile Menu */}
                        <div className="px-4 py-3 border-b border-card">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (searchQuery.trim()) {
                                        router.push(`/shop?search=${encodeURIComponent(searchQuery)}`);
                                        setMobileMenuOpen(false);
                                        setSearchQuery('');
                                    }
                                }}
                                className="relative"
                            >
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-card-muted" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search products..."
                                    className="w-full pl-9 pr-4 py-2.5 card-theme-secondary rounded-lg text-sm text-card placeholder:text-card-muted outline-none"
                                />
                            </form>
                        </div>

                        {/* Compact Nav Links */}
                        <nav className="flex-1 overflow-y-auto py-2">
                            {visiblePages.map((page, index) => (
                                <motion.div
                                    key={page.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                >
                                    <Link
                                        href={page.href.startsWith('/') ? page.href : page.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center justify-between px-4 py-3 text-card hover:bg-surface-hover"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-card-muted">
                                                {navIcons[page.id.toLowerCase()] || <FileText size={18} />}
                                            </span>
                                            <span className="font-medium text-[15px]">{page.label}</span>
                                        </div>
                                        <ChevronRight size={16} className="text-card-muted" />
                                    </Link>
                                </motion.div>
                            ))}
                        </nav>

                        {/* Compact Footer Actions */}
                        <div className="border-t border-card p-4 space-y-3">
                            {isStoreSite ? (
                                <>
                                    <Link
                                        href={cartUrl}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 text-card-muted card-theme-secondary rounded-lg text-sm font-medium hover:bg-surface-hover"
                                    >
                                        <ShoppingBag size={16} />
                                        Cart {cartCount > 0 && `(${cartCount})`}
                                    </Link>
                                    <Link href={`/shop`} onClick={() => setMobileMenuOpen(false)}>
                                        <div
                                            className="w-full py-3 text-center text-white font-semibold text-sm rounded-lg"
                                            style={{ backgroundColor: theme.primaryColor }}
                                        >
                                            Shop Now
                                        </div>
                                    </Link>
                                </>
                            ) : (
                                <Link href={`#contact`} onClick={() => setMobileMenuOpen(false)}>
                                    <div
                                        className="w-full py-3 text-center text-white font-semibold text-sm rounded-lg"
                                        style={{ backgroundColor: theme.primaryColor }}
                                    >
                                        Get In Touch
                                    </div>
                                </Link>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
