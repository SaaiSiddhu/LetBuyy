'use client';

import { urbanKicks } from '@/lib/themes/store/urban-kicks';
import { useCart } from '@/context/cart-context';
import { usePreviewWishlist, PreviewWishlistProvider } from '../context/wishlist-context';
import SearchOverlay from './search-overlay';
import {
    Search, ShoppingCart, User, Menu, X, Heart, Package,
    ChevronRight, Mail, Lock, Eye, EyeOff, ArrowLeft
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ============= THEME CSS =============

const themeSettings = urbanKicks.demoConfig.templateConfig.themeSettings;

const THEME_CSS = `
    :root {
        --primary: ${themeSettings.primaryColor};
        --secondary: ${themeSettings.secondaryColor};
        --accent: ${themeSettings.accentColor || themeSettings.primaryColor};
        --background: ${themeSettings.backgroundColor};
        --text: ${themeSettings.textColor};
        --radius: ${themeSettings.borderRadius}px;
        --font-main: var(--font-inter), system-ui, sans-serif;
        --font-heading: var(--font-inter), system-ui, sans-serif;
        --enable-animations: ${themeSettings.enableAnimations ? 1 : 0};
        --enable-shadows: ${themeSettings.enableShadows ? 1 : 0};
        --is-dark: 0;
        --text-secondary: rgba(0,0,0,0.6);
        --text-muted: rgba(0,0,0,0.4);
        --text-hint: rgba(0,0,0,0.3);
        --text-inverse: #FFFFFF;
        --border-color: rgba(0,0,0,0.1);
        --surface: rgba(0,0,0,0.02);
        --surface-hover: rgba(0,0,0,0.05);
        --card-bg: #ffffff;
        --card-bg-secondary: #f9fafb;
        --card-text: #111827;
        --card-text-muted: #6b7280;
        --card-border: #e5e7eb;
        --header-bg-scrolled: #ffffff;
        --header-shadow: rgba(0,0,0,0.05);
        --footer-bg: #0f172a;
        --footer-text: #ffffff;
        --footer-text-muted: rgba(255,255,255,0.6);
        --input-bg: #f9fafb;
        --input-border: #e5e7eb;
        --input-text: ${themeSettings.textColor};
        --input-placeholder: rgba(0,0,0,0.4);
    }
    body { font-family: var(--font-main); color: var(--text); background-color: var(--background); }
    h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); font-weight: 600; letter-spacing: -0.02em; }
`;

// ============= NAV LINKS =============

const NAV_LINKS = [
    { label: 'Home', href: '/theme-preview/urban-kicks' },
    { label: 'Shop', href: '/theme-preview/urban-kicks/shop' },
    { label: 'New Arrivals', href: '/theme-preview/urban-kicks/new-arrivals' },
    { label: 'Track Order', href: '/theme-preview/urban-kicks/track-order' },
];

// ============= AUTH BOTTOM SHEET =============

function AuthBottomSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [tab, setTab] = useState<'login' | 'signup'>('login');
    const [showPass, setShowPass] = useState(false);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Sheet */}
            <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 animate-slide-up overflow-hidden">
                {/* Handle bar (mobile) */}
                <div className="flex justify-center pt-3 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-black/10" />
                </div>

                {/* Close */}
                <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-md hover:bg-black/5 transition-colors">
                    <X size={20} />
                </button>

                <div className="p-6 pt-4 sm:p-8">
                    <h2 className="text-xl font-bold tracking-tight mb-1">Welcome to Urban Kicks</h2>
                    <p className="text-sm text-gray-500 mb-6">Sign in to your account or create a new one</p>

                    {/* Tabs */}
                    <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
                        <button
                            onClick={() => setTab('login')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${tab === 'login' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => setTab('signup')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${tab === 'signup' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}
                        >
                            Create Account
                        </button>
                    </div>

                    {/* Form */}
                    <div className="space-y-3">
                        {tab === 'signup' && (
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 transition-all"
                                />
                            </div>
                        )}
                        <div className="relative">
                            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="email"
                                placeholder="Email address"
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 transition-all"
                            />
                        </div>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type={showPass ? 'text' : 'password'}
                                placeholder="Password"
                                className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>

                        <button className="w-full py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-black/90 transition-colors">
                            {tab === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium">OR</span>
                        <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    {/* Social Buttons */}
                    <div className="space-y-2">
                        <button className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                            Continue with Google
                        </button>
                        <button className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
                            Continue with Apple
                        </button>
                    </div>

                    <p className="text-center text-xs text-gray-400 mt-5">
                        This is a preview. For real accounts, visit{' '}
                        <a href="https://apps.letbuyy.store" target="_blank" rel="noopener noreferrer" className="text-black font-medium underline hover:no-underline">
                            apps.letbuyy.store
                        </a>
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up { animation: slide-up 0.3s ease-out; }
            `}</style>
        </div>
    );
}

// ============= INNER SHELL (needs context) =============

function InnerShell({ children, hideFooter }: { children: React.ReactNode; hideFooter?: boolean }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const { cartCount } = useCart();
    const { count: wishlistCount } = usePreviewWishlist();
    const pathname = usePathname();

    const isActive = (href: string) => pathname === href;

    return (
        <>
            <style>{THEME_CSS}</style>

            {/* ===== AUTH BOTTOM SHEET ===== */}
            <AuthBottomSheet open={authOpen} onClose={() => setAuthOpen(false)} />

            {/* ===== SEARCH OVERLAY ===== */}
            <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

            {/* ===== SIDEBAR / DRAWER ===== */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[60] transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            <aside
                className={`fixed top-0 left-0 h-full w-72 bg-white z-[70] shadow-2xl transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
                style={{ color: 'var(--text)' }}
            >
                <div className="flex items-center justify-between p-4 border-b border-black/10">
                    <span className="text-lg font-bold tracking-tight">Urban Kicks</span>
                    <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-md hover:bg-black/5 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <nav className="p-4 space-y-1">
                    {NAV_LINKS.map((link) => (
                        <Link
                            key={link.label}
                            href={link.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center justify-between py-3 px-3 rounded-lg text-sm font-medium transition-colors ${isActive(link.href) ? 'bg-black/5 text-black' : 'hover:bg-black/5'}`}
                        >
                            {link.label}
                            <ChevronRight size={16} className="opacity-40" />
                        </Link>
                    ))}
                </nav>
                <div className="border-t border-black/10 p-4 space-y-1">
                    <button
                        onClick={() => { setSidebarOpen(false); setAuthOpen(true); }}
                        className="flex items-center gap-3 py-3 px-3 rounded-lg text-sm font-medium hover:bg-black/5 transition-colors w-full"
                    >
                        <User size={18} className="opacity-60" />
                        Login / Sign Up
                    </button>
                    <Link
                        href="/theme-preview/urban-kicks/wishlist"
                        onClick={() => setSidebarOpen(false)}
                        className="flex items-center gap-3 py-3 px-3 rounded-lg text-sm font-medium hover:bg-black/5 transition-colors"
                    >
                        <Heart size={18} className="opacity-60" />
                        Wishlist
                        {wishlistCount > 0 && (
                            <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {wishlistCount > 9 ? '9+' : wishlistCount}
                            </span>
                        )}
                    </Link>
                    <Link
                        href="/theme-preview/urban-kicks/track-order"
                        onClick={() => setSidebarOpen(false)}
                        className="flex items-center gap-3 py-3 px-3 rounded-lg text-sm font-medium hover:bg-black/5 transition-colors"
                    >
                        <Package size={18} className="opacity-60" />
                        Track Order
                    </Link>
                </div>
            </aside>

            {/* ===== PREVIEW BANNER ===== */}
            <div className="sticky top-0 z-50 bg-black text-white text-center py-2 px-4 text-sm font-medium">
                <span className="opacity-80">Theme Preview:</span>{' '}
                <span className="font-bold">{urbanKicks.name}</span>
                <span className="hidden sm:inline opacity-60 ml-2">— {urbanKicks.description}</span>
            </div>

            {/* ===== MAIN CONTENT ===== */}
            <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
                {/* Header */}
                <header className="sticky top-8 z-40 backdrop-blur-md bg-white/90 border-b border-black/5">
                    <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
                        {/* Left: Menu + Logo */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="p-2 -ml-2 rounded-lg hover:bg-black/5 transition-colors"
                                aria-label="Open menu"
                            >
                                <Menu size={20} style={{ color: 'var(--text)' }} />
                            </button>
                            <Link href="/theme-preview/urban-kicks" className="text-lg font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                                Urban Kicks
                            </Link>
                        </div>

                        {/* Center: Desktop Nav */}
                        <nav className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: 'var(--text)' }}>
                            {NAV_LINKS.map((link) => (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className={`transition-opacity ${isActive(link.href) ? 'opacity-100 font-semibold' : 'opacity-70 hover:opacity-100'}`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>

                        {/* Right: Icons */}
                        <div className="flex items-center gap-1" style={{ color: 'var(--text)' }}>
                            <button
                                onClick={() => setSearchOpen(true)}
                                className="p-2 rounded-lg hover:bg-black/5 transition-colors"
                                aria-label="Search"
                            >
                                <Search size={20} />
                            </button>
                            <Link
                                href="/theme-preview/urban-kicks/wishlist"
                                className="p-2 rounded-lg hover:bg-black/5 transition-colors relative hidden sm:block"
                                aria-label="Wishlist"
                            >
                                <Heart size={20} />
                                {wishlistCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                        {wishlistCount > 9 ? '9+' : wishlistCount}
                                    </span>
                                )}
                            </Link>
                            <button
                                onClick={() => setAuthOpen(true)}
                                className="p-2 rounded-lg hover:bg-black/5 transition-colors hidden sm:block"
                                aria-label="Account"
                            >
                                <User size={20} />
                            </button>
                            <Link
                                href="/theme-preview/urban-kicks/cart"
                                className="p-2 rounded-lg hover:bg-black/5 transition-colors relative"
                                aria-label="Cart"
                            >
                                <ShoppingCart size={20} />
                                {cartCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center">
                                        {cartCount > 9 ? '9+' : cartCount}
                                    </span>
                                )}
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                {children}

                {/* Footer */}
                {!hideFooter && (
                    <footer className="text-white py-12" style={{ backgroundColor: 'var(--footer-bg)' }}>
                        <div className="max-w-screen-xl mx-auto px-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                <div>
                                    <h3 className="text-lg font-bold mb-3">Urban Kicks</h3>
                                    <p className="text-sm opacity-60 leading-relaxed">
                                        Premium streetwear & sneakers. Curated drops from top brands, delivered to your door.
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 opacity-80">Shop</h4>
                                    <ul className="space-y-2 text-sm opacity-60">
                                        <li><Link href="/theme-preview/urban-kicks/shop" className="hover:opacity-100 transition-opacity">All Products</Link></li>
                                        <li><Link href="/theme-preview/urban-kicks/new-arrivals" className="hover:opacity-100 transition-opacity">New Arrivals</Link></li>
                                        <li><Link href="/theme-preview/urban-kicks/shop" className="hover:opacity-100 transition-opacity">Sneakers</Link></li>
                                        <li><Link href="/theme-preview/urban-kicks/shop" className="hover:opacity-100 transition-opacity">Apparel</Link></li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 opacity-80">Help</h4>
                                    <ul className="space-y-2 text-sm opacity-60">
                                        <li><Link href="/theme-preview/urban-kicks/track-order" className="hover:opacity-100 transition-opacity">Track Order</Link></li>
                                        <li><span className="hover:opacity-100 cursor-pointer transition-opacity">Returns & Exchanges</span></li>
                                        <li><span className="hover:opacity-100 cursor-pointer transition-opacity">Shipping Info</span></li>
                                        <li><span className="hover:opacity-100 cursor-pointer transition-opacity">FAQs</span></li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 opacity-80">Contact</h4>
                                    <ul className="space-y-2 text-sm opacity-60">
                                        <li>hello@urban-kicks.store</li>
                                        <li>Instagram: @urbankicks</li>
                                        <li>Twitter: @urbankicks</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs opacity-40">
                                © 2026 Urban Kicks. All rights reserved. Powered by LetBuyy.
                            </div>
                        </div>
                    </footer>
                )}
            </div>
        </>
    );
}

// ============= PREVIEW SHELL (wraps with providers) =============

interface PreviewShellProps {
    children: React.ReactNode;
    hideFooter?: boolean;
}

export default function PreviewShell({ children, hideFooter }: PreviewShellProps) {
    return (
        <PreviewWishlistProvider>
            <InnerShell hideFooter={hideFooter}>{children}</InnerShell>
        </PreviewWishlistProvider>
    );
}
