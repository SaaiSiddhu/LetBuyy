'use client';

import { urbanKicks } from '@/lib/themes/store/urban-kicks';
import { useCart } from '@/context/cart-context';
import { usePreviewWishlist } from '../_context/wishlist-context';
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
        --footer-bg: #000000;
        --footer-text: #ffffff;
        --footer-text-muted: rgba(255,255,255,0.5);
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

                    <p className="text-center text-xs text-gray-400 mt-5">
                        This is a theme preview — authentication is simulated.
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

function InnerShell({ children, hideFooter, hideFooterOnMobile, showWatermark }: { children: React.ReactNode; hideFooter?: boolean; hideFooterOnMobile?: boolean; showWatermark?: boolean }) {
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
            <div className="flex flex-col" style={{ backgroundColor: 'var(--background)', minHeight: 'calc(100dvh - 32px)' }}>
                {/* Header */}
                <header className="sticky top-8 z-40 backdrop-blur-md bg-white/90 border-b border-black/5">
                    <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
                        {/* Left: Menu + Logo */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="p-2 -ml-2 rounded-lg hover:bg-black/5 transition-colors md:hidden"
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
                <div className="flex-1">{children}</div>

                {/* Footer */}
                {!hideFooter && (
                    <footer className={`text-white ${hideFooterOnMobile ? 'hidden lg:block' : ''}`} style={{ backgroundColor: 'var(--footer-bg)' }}>
                        {/* Newsletter Banner */}
                        <div className="border-b border-white/[0.08]">
                            <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-12">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="text-center md:text-left">
                                        <h3 className="text-xl font-bold tracking-tight">Join the Kicks Club</h3>
                                        <p className="text-sm mt-1.5 text-white/50">Get early access to drops, exclusive deals & style tips. No spam, ever.</p>
                                    </div>
                                    <div className="flex w-full md:w-auto">
                                        <input
                                            type="email"
                                            placeholder="Enter your email"
                                            className="flex-1 md:w-72 px-4 py-3 rounded-l-lg bg-white/[0.06] border border-white/[0.12] text-sm text-white placeholder-white/30 outline-none focus:border-white/30 focus:bg-white/[0.1] transition-all"
                                        />
                                        <button className="px-6 py-3 bg-white text-black text-sm font-semibold rounded-r-lg hover:bg-white/90 transition-colors whitespace-nowrap">
                                            Subscribe
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Footer Grid */}
                        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-14">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-10 lg:gap-12">
                                {/* Brand */}
                                <div className="col-span-2 sm:col-span-3 lg:col-span-1 mb-4 lg:mb-0">
                                    <Link href="/theme-preview/urban-kicks" className="text-xl font-bold tracking-tight block mb-3 hover:opacity-80 transition-opacity">Urban Kicks</Link>
                                    <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--footer-text-muted)' }}>
                                        Premium streetwear & sneakers. Curated drops from top brands, delivered to your door.
                                    </p>
                                    {/* Social Icons */}
                                    <div className="flex items-center gap-3 mt-5">
                                        {/* Instagram */}
                                        <a href="https://instagram.com/urbankicks" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="Instagram">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                                        </a>
                                        {/* X / Twitter */}
                                        <a href="https://x.com/urbankicks" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="X">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                        </a>
                                        {/* Facebook */}
                                        <a href="https://facebook.com/urbankicks" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="Facebook">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                                        </a>
                                        {/* YouTube */}
                                        <a href="https://youtube.com/@urbankicks" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="YouTube">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" /><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" /></svg>
                                        </a>
                                        {/* TikTok */}
                                        <a href="https://tiktok.com/@urbankicks" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="TikTok">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78 2.92 2.92 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.57 6.33 6.33 0 0 0 9.37 22a6.33 6.33 0 0 0 6.37-6.23V9.13a8.16 8.16 0 0 0 3.85.97V6.73a4.85 4.85 0 0 1-.01-.04z" /></svg>
                                        </a>
                                    </div>
                                </div>

                                {/* Shop */}
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-widest mb-4 opacity-50">Shop</h4>
                                    <ul className="space-y-2.5 text-sm" style={{ color: 'var(--footer-text-muted)' }}>
                                        <li><Link href="/theme-preview/urban-kicks/shop" className="hover:text-white transition-colors">All Products</Link></li>
                                        <li><Link href="/theme-preview/urban-kicks/new-arrivals" className="hover:text-white transition-colors">New Arrivals</Link></li>
                                        <li><Link href="/theme-preview/urban-kicks/shop" className="hover:text-white transition-colors">Sneakers</Link></li>
                                        <li><Link href="/theme-preview/urban-kicks/shop" className="hover:text-white transition-colors">Apparel</Link></li>
                                        <li><Link href="/theme-preview/urban-kicks/shop" className="hover:text-white transition-colors">Accessories</Link></li>
                                    </ul>
                                </div>

                                {/* Help */}
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-widest mb-4 opacity-50">Help</h4>
                                    <ul className="space-y-2.5 text-sm" style={{ color: 'var(--footer-text-muted)' }}>
                                        <li><Link href="/theme-preview/urban-kicks/track-order" className="hover:text-white transition-colors">Track Order</Link></li>
                                        <li><span className="hover:text-white cursor-pointer transition-colors">Returns & Exchanges</span></li>
                                        <li><span className="hover:text-white cursor-pointer transition-colors">Shipping Info</span></li>
                                        <li><span className="hover:text-white cursor-pointer transition-colors">Size Guide</span></li>
                                        <li><span className="hover:text-white cursor-pointer transition-colors">FAQs</span></li>
                                    </ul>
                                </div>

                                {/* Company */}
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-widest mb-4 opacity-50">Company</h4>
                                    <ul className="space-y-2.5 text-sm" style={{ color: 'var(--footer-text-muted)' }}>
                                        <li><span className="hover:text-white cursor-pointer transition-colors">About Us</span></li>
                                        <li><span className="hover:text-white cursor-pointer transition-colors">Careers</span></li>
                                        <li><span className="hover:text-white cursor-pointer transition-colors">Privacy Policy</span></li>
                                        <li><span className="hover:text-white cursor-pointer transition-colors">Terms of Service</span></li>
                                        <li><span className="hover:text-white cursor-pointer transition-colors">Contact Us</span></li>
                                    </ul>
                                </div>

                                {/* Contact */}
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-widest mb-4 opacity-50">Get in Touch</h4>
                                    <ul className="space-y-3 text-sm" style={{ color: 'var(--footer-text-muted)' }}>
                                        <li className="flex items-center gap-2">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                            <a href="mailto:hello@urban-kicks.store" className="hover:text-white transition-colors">hello@urban-kicks.store</a>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                            <span>+91 99XX XXX XXX</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                            <span>Chennai, Tamil Nadu, India</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Bar */}
                        <div className="border-t border-white/[0.08]">
                            <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <p className="text-xs text-white/40 order-2 sm:order-1">
                                        © 2026 Urban Kicks. All rights reserved. Powered by{' '}
                                        <a href="https://letbuyy.store" target="_blank" rel="noopener noreferrer" className="font-semibold text-white/70 hover:text-white transition-colors">
                                            LetBuyy
                                        </a>
                                    </p>
                                    {/* Payment Icons */}
                                    <div className="flex items-center gap-3 order-1 sm:order-2 opacity-50">
                                        {/* Visa */}
                                        <svg width="34" height="22" viewBox="0 0 750 471" fill="currentColor"><path d="M278.2 334.2l33.3-195.8h53.3l-33.3 195.8h-53.3zM524.3 142.7c-10.5-4-27.1-8.3-47.7-8.3-52.6 0-89.7 26.6-89.9 64.7-.3 28.2 26.5 43.9 46.7 53.3 20.8 9.6 27.8 15.7 27.7 24.3-.1 13.1-16.6 19.1-32 19.1-21.4 0-32.7-3-50.3-10.2l-6.9-3.1-7.5 44.1c12.5 5.5 35.5 10.2 59.5 10.5 56 0 92.3-26.3 92.7-67 .2-22.3-14-39.3-44.7-53.3-18.6-9.1-30-15.1-29.9-24.3 0-8.1 9.6-16.8 30.4-16.8 17.4-.3 30 3.5 39.8 7.5l4.8 2.3 7.3-42.7zM661.6 138.4h-41.2c-12.8 0-22.3 3.5-27.9 16.2l-79.2 179.6h56s9.1-24.1 11.2-29.4c6.1 0 60.5.1 68.3.1 1.6 6.9 6.5 29.3 6.5 29.3h49.5l-43.2-195.8zm-65.6 126.4c4.4-11.3 21.3-54.7 21.3-54.7-.3.5 4.4-11.4 7.1-18.8l3.6 17s10.2 46.9 12.4 56.5h-44.4zM232.8 138.4l-52.2 133.5-5.6-27.1c-9.7-31.3-39.8-65.2-73.5-82.2l47.8 171.5 56.4-.1 83.9-195.6h-56.8z" /><path d="M131.9 138.4H46.5L46 142c66.8 16.2 111 55.3 129.4 102.2L157 159c-3.1-12.5-12.6-16.1-25.1-16.6z" fill="currentColor" opacity=".8" /></svg>
                                        {/* Mastercard */}
                                        <svg width="34" height="22" viewBox="0 0 152.407 108" fill="currentColor"><circle cx="60.412" cy="54" r="40" opacity=".6" /><circle cx="91.995" cy="54" r="40" opacity=".6" /></svg>
                                        {/* UPI */}
                                        <span className="text-[10px] font-bold border border-white/30 rounded px-1.5 py-0.5">UPI</span>
                                        {/* COD */}
                                        <span className="text-[10px] font-bold border border-white/30 rounded px-1.5 py-0.5">COD</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </footer>
                )}

                {/* Powered by LetBuyy watermark */}
                {showWatermark && (
                    <div className="mt-auto py-4 flex items-center justify-center gap-1 text-[11px] text-gray-300">
                        <span>Powered by</span>
                        <a
                            href="https://letbuyy.store"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-gray-400 hover:text-black transition-colors"
                        >
                            LetBuyy
                        </a>
                    </div>
                )}
            </div>
        </>
    );
}

// ============= PREVIEW SHELL (wraps with providers) =============

interface PreviewShellProps {
    children: React.ReactNode;
    hideFooter?: boolean;
    hideFooterOnMobile?: boolean;
    showWatermark?: boolean;
}

export default function PreviewShell({ children, hideFooter, hideFooterOnMobile, showWatermark }: PreviewShellProps) {
    return (
        <InnerShell hideFooter={hideFooter} hideFooterOnMobile={hideFooterOnMobile} showWatermark={showWatermark}>{children}</InnerShell>
    );
}
