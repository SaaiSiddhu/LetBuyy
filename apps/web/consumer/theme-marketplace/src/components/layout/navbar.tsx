'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import {
    Palette, Menu, X, Search, Sun, Moon, Monitor, ChevronRight,
    LayoutDashboard, Tag, Sparkles, ArrowRight, Bell, Settings,
    Download, Star, LogOut, User as UserIcon, CreditCard, Package,
    BookOpen, MessageCircle, Flame, ChevronDown,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

/* ─── Constants ─── */
const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3000';

const NAV_LINKS = [
    { label: 'Browse Themes', href: '/themes', icon: Sparkles },
    { label: 'Pricing', href: '/pricing', icon: Tag },
];

/* ═══════════════════════════════════════════════
   THEME TOGGLE — Desktop (icon) & Mobile (inline)
   ═══════════════════════════════════════════════ */
function ThemeToggle({ variant = 'icon' }: { variant?: 'icon' | 'inline' }) {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const options = [
        { value: 'light' as const, icon: Sun, label: 'Light' },
        { value: 'dark' as const, icon: Moon, label: 'Dark' },
        { value: 'system' as const, icon: Monitor, label: 'System' },
    ];

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun;

    // Inline variant for mobile drawer
    if (variant === 'inline') {
        return (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface/80">
                {options.map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value)}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium transition-all duration-200',
                            theme === opt.value
                                ? 'bg-primary text-white shadow-md shadow-primary/25'
                                : 'text-text-muted hover:text-text-heading'
                        )}
                    >
                        <opt.icon className="w-3.5 h-3.5" />
                        {opt.label}
                    </button>
                ))}
            </div>
        );
    }

    // Icon variant for desktop
    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    'relative p-2.5 rounded-xl transition-all duration-200',
                    'text-text-muted hover:text-text-heading',
                    'hover:bg-surface active:scale-95',
                    open && 'bg-surface text-text-heading'
                )}
                aria-label="Toggle theme"
            >
                <CurrentIcon className="w-[18px] h-[18px]" />
            </button>

            {/* Dropdown */}
            <div
                className={cn(
                    'absolute right-0 top-full mt-2 z-[100] w-40',
                    'rounded-2xl overflow-hidden',
                    'border border-border-light',
                    'shadow-lg shadow-black/10',
                    'transition-all duration-200 origin-top-right',
                    open
                        ? 'opacity-100 scale-100 translate-y-0'
                        : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                )}
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
            >
                <div className="p-1.5">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { setTheme(opt.value); setOpen(false); }}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150',
                                theme === opt.value
                                    ? 'bg-primary/10 text-primary-light font-semibold'
                                    : 'text-text-body hover:bg-surface hover:text-text-heading'
                            )}
                        >
                            <opt.icon className="w-4 h-4 flex-shrink-0" />
                            <span>{opt.label}</span>
                            {theme === opt.value && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-light" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════
   SEARCH MODAL (⌘K)
   ═══════════════════════════════════════════════ */
function SearchModal({ onClose }: { onClose: () => void }) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const quickActions = [
        { label: 'Browse All Themes', href: '/themes', icon: Sparkles },
        { label: 'View Pricing', href: '/pricing', icon: Tag },
        { label: 'Go to Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Documentation', href: '#', icon: BookOpen },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div
                className="relative w-full max-w-xl mx-4 rounded-2xl border border-border-light shadow-2xl shadow-black/20 overflow-hidden"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                    <Search className="w-5 h-5 text-text-muted flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search themes, docs..."
                        className="flex-1 bg-transparent text-base text-text-heading placeholder:text-text-subtle outline-none"
                    />
                    <kbd className="px-2 py-1 text-xs bg-surface text-text-muted rounded-lg border border-border-light font-mono">
                        ESC
                    </kbd>
                </div>

                {/* Quick Actions */}
                <div className="p-3">
                    <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider mb-2 px-2">
                        Quick Actions
                    </p>
                    {quickActions.map(action => {
                        const Icon = action.icon;
                        return (
                            <Link
                                key={action.href}
                                href={action.href}
                                onClick={onClose}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-body hover:text-text-heading hover:bg-surface transition-all group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-surface/80 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    <Icon className="w-4 h-4" />
                                </div>
                                <span>{action.label}</span>
                                <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-text-subtle" />
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════
   USER MENU — Profile Dropdown (Desktop)
   ═══════════════════════════════════════════════ */
function UserMenu() {
    const { user, signOut } = useAuth();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const displayEmail = user?.email || '';
    const avatarUrl = user?.user_metadata?.avatar_url;
    const initials = displayName.charAt(0).toUpperCase();

    const menuItems = [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'My Themes', href: '/dashboard/purchases', icon: Package },
        { label: 'Downloads', href: '/dashboard/downloads', icon: Download },
        { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    ];

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    'flex items-center gap-2 p-1.5 pr-3 rounded-xl transition-all duration-200',
                    'hover:bg-surface active:scale-[0.97]',
                    open && 'bg-surface'
                )}
            >
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={displayName}
                        className="w-8 h-8 rounded-lg object-cover ring-2 ring-border-light"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-bold">
                        {initials}
                    </div>
                )}
                <ChevronDown className={cn(
                    'w-3.5 h-3.5 text-text-muted transition-transform duration-200',
                    open && 'rotate-180'
                )} />
            </button>

            {/* Dropdown */}
            <div
                className={cn(
                    'absolute right-0 top-full mt-2 z-[100] w-64',
                    'rounded-2xl overflow-hidden',
                    'border border-border-light',
                    'shadow-xl shadow-black/15',
                    'transition-all duration-200 origin-top-right',
                    open
                        ? 'opacity-100 scale-100 translate-y-0'
                        : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                )}
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
            >
                {/* User Info */}
                <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold text-text-heading truncate">{displayName}</p>
                    <p className="text-xs text-text-muted truncate mt-0.5">{displayEmail}</p>
                </div>

                {/* Menu Items */}
                <div className="p-1.5">
                    {menuItems.map(item => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-body hover:text-text-heading hover:bg-surface transition-all"
                            >
                                <Icon className="w-4 h-4 text-text-muted" />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Sign Out */}
                <div className="p-1.5 border-t border-border">
                    <button
                        onClick={() => { signOut(); setOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-500/10 transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════
   NOTIFICATION BELL
   ═══════════════════════════════════════════════ */
function NotificationBell() {
    const [notificationCount, setNotificationCount] = useState(0);

    useEffect(() => {
        // Fetch unread notification count on mount
        fetch('/api/notifications/count')
            .then(res => res.ok ? res.json() : { count: 0 })
            .then(data => setNotificationCount(data.count || 0))
            .catch(() => setNotificationCount(0));
    }, []);

    return (
        <button
            className={cn(
                'relative p-2.5 rounded-xl transition-all duration-200',
                'text-text-muted hover:text-text-heading',
                'hover:bg-surface active:scale-95'
            )}
            aria-label="Notifications"
        >
            <Bell className="w-[18px] h-[18px]" />
            {notificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-[var(--color-bg-secondary)]">
                    {notificationCount > 9 ? '9+' : notificationCount}
                </span>
            )}
        </button>
    );
}

/* ═══════════════════════════════════════════════
   DRAWER SECTION HEADER
   ═══════════════════════════════════════════════ */
function DrawerSectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider mb-1 px-4">
            {children}
        </p>
    );
}

/* ═══════════════════════════════════════════════
   DRAWER LINK ITEM
   ═══════════════════════════════════════════════ */
function DrawerItem({
    href, icon: Icon, label, badge, onClick,
}: {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    badge?: string;
    onClick?: () => void;
}) {
    return (
        <Link
            href={href}
            className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium text-text-body hover:text-text-heading rounded-2xl hover:bg-surface/70 transition-all duration-200 group"
            onClick={onClick}
        >
            <div className="w-9 h-9 rounded-xl bg-surface/80 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <Icon className="w-4 h-4" />
            </div>
            <span className="flex-1">{label}</span>
            {badge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">
                    {badge}
                </span>
            )}
            <ChevronRight className="w-4 h-4 text-text-subtle group-hover:text-text-muted transition-colors" />
        </Link>
    );
}

/* ═══════════════════════════════════════════════
   NAVBAR — Main Export
   ═══════════════════════════════════════════════ */
export default function Navbar() {
    const { user, isAuthenticated, isLoading, signOut } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    // Track scroll for header shadow/bg intensification
    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 8);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        document.body.style.overflow = mobileOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [mobileOpen]);

    // ⌘K shortcut for search
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const [currentUrl, setCurrentUrl] = useState('');

    // Set redirect URL only on client (avoids hydration mismatch)
    useEffect(() => {
        setCurrentUrl(window.location.href);
    }, []);

    const closeMobile = () => setMobileOpen(false);

    // Auth link helpers — redirect param only added after mount to avoid hydration mismatch
    const redirectParam = currentUrl ? `?redirect=${encodeURIComponent(currentUrl)}` : '';
    const loginUrl = `${ACCOUNTS_URL}/login${redirectParam}`;
    const signupUrl = `${ACCOUNTS_URL}/signup${redirectParam}`;

    // User info for mobile drawer
    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const displayEmail = user?.email || '';
    const avatarUrl = user?.user_metadata?.avatar_url;
    const initials = displayName.charAt(0).toUpperCase();

    return (
        <>
            <header
                className={cn(
                    'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
                    'border-b',
                    scrolled
                        ? 'border-border-light shadow-sm'
                        : 'border-transparent'
                )}
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
            >
                <nav className="container-main flex items-center justify-between h-[72px]">
                    {/* ─── Logo ─── */}
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-primary-dark to-secondary flex items-center justify-center shadow-md shadow-primary/20 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary/30 group-hover:scale-105">
                            <Palette className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-text-heading tracking-tight">
                            LetBuyy <span className="gradient-text">Themes</span>
                        </span>
                    </Link>

                    {/* ─── Desktop Nav Links ─── */}
                    <div className="hidden md:flex items-center gap-1">
                        {NAV_LINKS.map(link => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="px-4 py-2 text-sm font-medium text-text-body hover:text-text-heading rounded-xl hover:bg-surface/60 transition-all duration-200"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* ─── Desktop Actions ─── */}
                    <div className="hidden md:flex items-center gap-2">
                        {/* Search */}
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-text-muted hover:text-text-heading rounded-xl hover:bg-surface/60 transition-all duration-200"
                        >
                            <Search className="w-4 h-4" />
                            <span className="hidden lg:inline">Search</span>
                            <kbd className="hidden lg:inline px-1.5 py-0.5 text-[10px] bg-surface/80 text-text-subtle rounded border border-border-light font-mono">
                                ⌘K
                            </kbd>
                        </button>

                        <ThemeToggle variant="icon" />

                        <div className="w-px h-6 bg-border-light mx-1" />

                        {/* ── Auth-dependent actions ── */}
                        {isLoading ? (
                            // Skeleton placeholder while checking auth
                            <div className="w-24 h-9 rounded-xl bg-surface/60 animate-pulse" />
                        ) : isAuthenticated ? (
                            // AUTHENTICATED: Notification bell + User menu
                            <>
                                <NotificationBell />
                                <UserMenu />
                            </>
                        ) : (
                            // UNAUTHENTICATED: Login + Sign Up
                            <>
                                <a
                                    href={loginUrl}
                                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-body hover:text-text-heading rounded-xl border border-border-light hover:border-primary/40 hover:bg-surface/40 transition-all duration-200"
                                >
                                    Login
                                </a>
                                <a
                                    href={signupUrl}
                                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-primary to-primary-dark shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/35 hover:-translate-y-px transition-all duration-200"
                                >
                                    Sign Up
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </a>
                            </>
                        )}
                    </div>

                    {/* ─── Mobile: Actions + Hamburger ─── */}
                    <div className="md:hidden flex items-center gap-1.5">
                        {isAuthenticated && <NotificationBell />}
                        <ThemeToggle variant="icon" />
                        <button
                            className={cn(
                                'p-2.5 rounded-xl transition-all duration-200',
                                'text-text-body hover:text-text-heading hover:bg-surface/60',
                                'active:scale-95'
                            )}
                            onClick={() => setMobileOpen(!mobileOpen)}
                            aria-label="Menu"
                        >
                            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </nav>
            </header>

            {/* ═══════════════════════════════════════════════
               MOBILE DRAWER OVERLAY
               ═══════════════════════════════════════════════ */}
            <div
                className={cn(
                    'fixed inset-0 z-[60] md:hidden transition-all duration-300',
                    mobileOpen ? 'visible' : 'invisible'
                )}
            >
                {/* Backdrop */}
                <div
                    className={cn(
                        'absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
                        mobileOpen ? 'opacity-100' : 'opacity-0'
                    )}
                    onClick={closeMobile}
                />

                {/* Drawer Panel */}
                <div
                    className={cn(
                        'absolute top-0 right-0 h-full w-[85%] max-w-[340px]',
                        'border-l border-border-light',
                        'shadow-2xl shadow-black/30',
                        'flex flex-col',
                        'transition-transform duration-300 ease-out',
                        mobileOpen ? 'translate-x-0' : 'translate-x-full'
                    )}
                    style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                >
                    {/* Drawer Header */}
                    <div className="flex items-center justify-between px-5 h-[72px] border-b border-border flex-shrink-0">
                        <span className="text-base font-bold text-text-heading">Menu</span>
                        <button
                            className="p-2 rounded-xl text-text-muted hover:text-text-heading hover:bg-surface transition-all active:scale-95"
                            onClick={closeMobile}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Drawer Body */}
                    <div className="flex-1 overflow-y-auto py-5 space-y-5">
                        {/* ── Authenticated: User Profile Card ── */}
                        {isAuthenticated && user && (
                            <div className="mx-4 px-4 py-3.5 rounded-2xl bg-surface/60 border border-border-light">
                                <div className="flex items-center gap-3">
                                    {avatarUrl ? (
                                        <img
                                            src={avatarUrl}
                                            alt={displayName}
                                            className="w-10 h-10 rounded-xl object-cover ring-2 ring-border-light"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-bold">
                                            {initials}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-text-heading truncate">{displayName}</p>
                                        <p className="text-xs text-text-muted truncate">{displayEmail}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Authenticated: Workspace Section ── */}
                        {isAuthenticated && (
                            <div className="space-y-1">
                                <DrawerSectionLabel>Workspace</DrawerSectionLabel>
                                <DrawerItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={closeMobile} />
                                <DrawerItem href="/dashboard/purchases" icon={Package} label="My Themes" onClick={closeMobile} />
                                <DrawerItem href="/dashboard/downloads" icon={Download} label="Downloads" onClick={closeMobile} />
                                <DrawerItem href="/dashboard/installations" icon={Star} label="Installations" onClick={closeMobile} />
                            </div>
                        )}

                        {/* ── Explore Section ── */}
                        <div className="space-y-1">
                            <DrawerSectionLabel>Explore</DrawerSectionLabel>
                            <DrawerItem href="/themes" icon={Sparkles} label="Browse All" onClick={closeMobile} />
                            <DrawerItem href="/pricing" icon={Tag} label="Pricing" onClick={closeMobile} />
                            <DrawerItem href="/themes" icon={Flame} label="Trending" onClick={closeMobile} />
                        </div>

                        {/* ── Divider ── */}
                        <div className="px-4">
                            <div className="h-px bg-border" />
                        </div>

                        {/* ── Appearance ── */}
                        <div className="px-4 space-y-2">
                            <DrawerSectionLabel>Appearance</DrawerSectionLabel>
                            <ThemeToggle variant="inline" />
                        </div>

                        {/* ── Authenticated: Manage ── */}
                        {isAuthenticated && (
                            <>
                                <div className="px-4">
                                    <div className="h-px bg-border" />
                                </div>
                                <div className="space-y-1">
                                    <DrawerItem href="/dashboard/settings" icon={Settings} label="Settings" onClick={closeMobile} />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Drawer Footer */}
                    <div className="px-4 pb-6 pt-3 border-t border-border flex-shrink-0 space-y-2">
                        {isAuthenticated ? (
                            // AUTHENTICATED: Sign Out
                            <button
                                onClick={() => { signOut(); closeMobile(); }}
                                className="flex items-center justify-center gap-2 w-full py-3.5 text-sm font-semibold text-red-500 rounded-2xl border border-red-500/20 hover:bg-red-500/10 active:scale-[0.98] transition-all duration-200"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        ) : (
                            // UNAUTHENTICATED: Login + Sign Up
                            <>
                                <a
                                    href={loginUrl}
                                    className="flex items-center justify-center gap-2 w-full py-3.5 text-sm font-semibold text-text-heading rounded-2xl border border-border-light hover:bg-surface active:scale-[0.98] transition-all duration-200"
                                    onClick={closeMobile}
                                >
                                    Login
                                </a>
                                <a
                                    href={signupUrl}
                                    className="flex items-center justify-center gap-2 w-full py-3.5 text-sm font-semibold text-white rounded-2xl bg-gradient-to-r from-primary to-primary-dark shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 active:scale-[0.98] transition-all duration-200"
                                    onClick={closeMobile}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Sign Up Free
                                </a>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════
               SEARCH MODAL
               ═══════════════════════════════════════════════ */}
            {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
        </>
    );
}
