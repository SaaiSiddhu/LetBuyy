'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import {
    Palette, Menu, X, Search, Sun, Moon, ChevronRight,
    LayoutDashboard, LayoutGrid, Tag, Sparkles, ArrowRight, Bell, Settings,
    Download, Star, LogOut, User as UserIcon, CreditCard, Package,
    BookOpen, MessageCircle, Flame, ChevronDown, Command,
} from '@letbuyy/ui';
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
   ANIMATED LOGO
   ═══════════════════════════════════════════════ */
function AnimatedLogo() {
    return (
        <Link href="/" className="flex items-center gap-3 group relative">
            <div className="relative">
                {/* Hover glow */}
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary via-purple-500 to-secondary opacity-0 group-hover:opacity-50 blur-lg transition-all duration-500" />
                {/* Icon container */}
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-violet-600 to-secondary flex items-center justify-center shadow-lg shadow-primary/25 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-primary/40 group-hover:scale-105">
                    <Palette className="w-5 h-5 text-white drop-shadow-sm" />
                </div>
            </div>
            <span className="text-xl font-bold text-text-heading tracking-tight">
                LetBuyy{' '}
                <span className="bg-gradient-to-r from-primary via-purple-400 to-secondary bg-clip-text text-transparent">
                    Themes
                </span>
            </span>
        </Link>
    );
}

/* ═══════════════════════════════════════════════
   NAV LINK — with animated underline & glow
   ═══════════════════════════════════════════════ */
function NavLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="relative px-4 py-2 text-sm font-medium text-text-body hover:text-text-heading rounded-xl transition-all duration-300 group"
        >
            <span className="relative z-10">{label}</span>
            {/* Hover background glow */}
            <div className="absolute inset-0 rounded-xl bg-white/[0.04] opacity-0 group-hover:opacity-100 transition-all duration-300" />
            {/* Animated underline */}
            <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-[2px] w-0 group-hover:w-3/4 bg-gradient-to-r from-transparent via-primary to-transparent transition-all duration-300 rounded-full" />
        </Link>
    );
}

/* ═══════════════════════════════════════════════
   SEARCH TRIGGER — Glass pill with glow
   ═══════════════════════════════════════════════ */
function SearchTrigger({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-2.5 px-3.5 py-2 text-sm rounded-xl',
                'text-text-muted hover:text-text-heading',
                'bg-white/[0.04] hover:bg-white/[0.08]',
                'border border-white/[0.06] hover:border-white/[0.12]',
                'transition-all duration-300 group'
            )}
        >
            <Search className="w-4 h-4 group-hover:text-primary transition-colors duration-300" />
            <span className="hidden lg:inline text-text-subtle group-hover:text-text-muted transition-colors">Search</span>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-white/[0.06] text-text-subtle rounded-md border border-white/[0.08] font-mono">
                <Command className="w-2.5 h-2.5" />K
            </kbd>
        </button>
    );
}

/* ═══════════════════════════════════════════════
   THEME TOGGLE — Animated with morphing icon
   ═══════════════════════════════════════════════ */
function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={cn(
                'relative p-2.5 rounded-xl transition-all duration-300',
                'text-text-muted hover:text-amber-400',
                'hover:bg-white/[0.06] active:scale-90',
                'group'
            )}
            aria-label="Toggle theme"
        >
            {/* Glow behind icon on hover */}
            <div className="absolute inset-0 rounded-xl bg-amber-400/0 group-hover:bg-amber-400/[0.08] transition-all duration-300" />
            <div className="relative">
                {isDark ? (
                    <Sun className="w-[18px] h-[18px] transition-transform duration-500 group-hover:rotate-45" />
                ) : (
                    <Moon className="w-[18px] h-[18px] transition-transform duration-500 group-hover:-rotate-12" />
                )}
            </div>
        </button>
    );
}

/* ═══════════════════════════════════════════════
   SEARCH MODAL (⌘K) — Refined with animations
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
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className="relative w-full max-w-xl mx-4 rounded-2xl border border-white/10 shadow-2xl shadow-primary/10 overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
            >
                {/* Top glow accent */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

                {/* Search Input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
                    <Search className="w-5 h-5 text-primary flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search themes, categories, docs..."
                        className="flex-1 bg-transparent text-base text-text-heading placeholder:text-text-subtle outline-none"
                    />
                    <kbd className="px-2 py-1 text-xs bg-white/[0.06] text-text-muted rounded-lg border border-white/[0.08] font-mono">
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
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-body hover:text-text-heading hover:bg-white/[0.04] transition-all group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-white/[0.04] group-hover:bg-primary/10 flex items-center justify-center group-hover:text-primary transition-all duration-300">
                                    <Icon className="w-4 h-4" />
                                </div>
                                <span>{action.label}</span>
                                <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-text-subtle" />
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

    const displayName = user?.fullName || user?.email?.split('@')[0] || 'User';
    const displayEmail = user?.email || '';
    const avatarUrl = user?.avatarUrl;
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
                    'hover:bg-white/[0.06] active:scale-[0.97]',
                    open && 'bg-white/[0.06]'
                )}
            >
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={displayName}
                        className="w-8 h-8 rounded-lg object-cover ring-2 ring-white/10"
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
                    'border border-white/10',
                    'shadow-xl shadow-black/20',
                    'transition-all duration-200 origin-top-right',
                    open
                        ? 'opacity-100 scale-100 translate-y-0'
                        : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                )}
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
            >
                {/* Top glow */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

                {/* User Info */}
                <div className="px-4 py-3 border-b border-white/[0.06]">
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
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-body hover:text-text-heading hover:bg-white/[0.04] transition-all"
                            >
                                <Icon className="w-4 h-4 text-text-muted" />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Sign Out */}
                <div className="p-1.5 border-t border-white/[0.06]">
                    <button
                        onClick={() => { signOut(); setOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all"
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
   NOTIFICATION BELL — with animated pulse
   ═══════════════════════════════════════════════ */
function NotificationBell() {
    const [notificationCount, setNotificationCount] = useState(0);

    useEffect(() => {
        fetch('/api/notifications/count')
            .then(res => res.ok ? res.json() : { count: 0 })
            .then(data => setNotificationCount(data.count || 0))
            .catch(() => setNotificationCount(0));
    }, []);

    return (
        <button
            className={cn(
                'relative p-2.5 rounded-xl transition-all duration-300 group',
                'text-text-muted hover:text-text-heading',
                'hover:bg-white/[0.06] active:scale-95'
            )}
            aria-label="Notifications"
        >
            <Bell className="w-[18px] h-[18px] group-hover:rotate-12 transition-transform duration-300" />
            {notificationCount > 0 && (
                <>
                    {/* Pulse ring */}
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500/30 animate-ping" />
                    {/* Badge */}
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-[var(--color-bg-secondary)]">
                        {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                </>
            )}
        </button>
    );
}

/* ═══════════════════════════════════════════════
   DRAWER SECTION HEADER
   ═══════════════════════════════════════════════ */
function DrawerSectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider mb-2 px-5">
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
            className="flex items-center gap-3 px-5 py-3 text-[15px] font-medium text-text-body hover:text-text-heading hover:bg-white/5 transition-all duration-200 group"
            onClick={onClick}
        >
            <Icon className="w-[18px] h-[18px] text-text-muted group-hover:text-primary transition-colors" />
            <span className="flex-1">{label}</span>
            {badge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">
                    {badge}
                </span>
            )}
            <ChevronRight className="w-4 h-4 text-text-subtle opacity-40 group-hover:opacity-100 group-hover:text-text-muted transition-all" />
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

    // Track scroll for header effects
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

    // Auth link helpers
    const returnToParam = currentUrl ? `?return_to=${encodeURIComponent(currentUrl)}` : '';
    const loginUrl = `${ACCOUNTS_URL}/lookup${returnToParam}`;
    const signupUrl = `${ACCOUNTS_URL}/signup${returnToParam}`;

    // User info for mobile drawer
    const displayName = user?.fullName || user?.email?.split('@')[0] || 'User';
    const displayEmail = user?.email || '';
    const avatarUrl = user?.avatarUrl;
    const initials = displayName.charAt(0).toUpperCase();

    return (
        <>
            <header
                className={cn(
                    'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
                )}
            >
                {/* ─── Glassmorphism background ─── */}
                <div
                    className={cn(
                        'absolute inset-0 transition-all duration-500',
                        scrolled
                            ? 'bg-[var(--color-bg-secondary)]/80 backdrop-blur-xl'
                            : 'bg-[var(--color-bg-secondary)]/60 backdrop-blur-md'
                    )}
                />

                {/* ─── Bottom border with gradient glow ─── */}
                <div
                    className={cn(
                        'absolute bottom-0 left-0 right-0 h-px transition-opacity duration-500',
                        scrolled ? 'opacity-100' : 'opacity-0'
                    )}
                >
                    <div className="w-full h-full bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                </div>

                {/* ─── Subtle top shine line ─── */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

                {/* ─── Navigation content ─── */}
                <nav className="container-main relative flex items-center justify-between h-[72px]">
                    {/* ─── Logo ─── */}
                    <AnimatedLogo />

                    {/* ─── Desktop Nav Links ─── */}
                    <div className="hidden md:flex items-center gap-1">
                        {NAV_LINKS.map(link => (
                            <NavLink key={link.href} href={link.href} label={link.label} />
                        ))}
                    </div>

                    {/* ─── Desktop Actions ─── */}
                    <div className="hidden md:flex items-center gap-2">
                        <SearchTrigger onClick={() => setSearchOpen(true)} />

                        <ThemeToggle />

                        {/* Divider with gradient */}
                        <div className="w-px h-6 bg-gradient-to-b from-transparent via-white/[0.12] to-transparent mx-1" />

                        {/* ── Auth-dependent actions ── */}
                        {isLoading ? (
                            <div className="w-24 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
                        ) : isAuthenticated ? (
                            <>
                                <NotificationBell />
                                <UserMenu />
                            </>
                        ) : (
                            <div className="flex items-center gap-2.5">
                                {/* Login button — ghost style */}
                                <a
                                    href={loginUrl}
                                    className={cn(
                                        'px-4 py-2 text-sm font-medium rounded-xl',
                                        'text-text-body hover:text-text-heading',
                                        'border border-white/[0.08] hover:border-white/[0.16]',
                                        'hover:bg-white/[0.04]',
                                        'transition-all duration-300'
                                    )}
                                >
                                    Login
                                </a>
                                {/* Sign Up button */}
                                <a
                                    href={signupUrl}
                                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-primary to-primary-dark shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/35 hover:-translate-y-px transition-all duration-300 active:scale-[0.97]"
                                >
                                    Sign Up
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-300" />
                                </a>
                            </div>
                        )}
                    </div>

                    {/* ─── Mobile: Actions + Hamburger ─── */}
                    <div className="md:hidden flex items-center gap-1.5">
                        {isAuthenticated && <NotificationBell />}
                        <ThemeToggle />
                        <button
                            className={cn(
                                'relative p-2.5 rounded-xl transition-all duration-300',
                                'text-text-body hover:text-text-heading',
                                'hover:bg-white/[0.06] active:scale-90',
                            )}
                            onClick={() => setMobileOpen(!mobileOpen)}
                            aria-label="Menu"
                        >
                            <div className="relative w-5 h-5">
                                {/* Animated hamburger → X */}
                                <span className={cn(
                                    'absolute left-0 block w-5 h-[2px] rounded-full bg-current transition-all duration-300',
                                    mobileOpen ? 'top-[9px] rotate-45' : 'top-[3px] rotate-0'
                                )} />
                                <span className={cn(
                                    'absolute left-0 top-[9px] block w-5 h-[2px] rounded-full bg-current transition-all duration-300',
                                    mobileOpen ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'
                                )} />
                                <span className={cn(
                                    'absolute left-0 block w-5 h-[2px] rounded-full bg-current transition-all duration-300',
                                    mobileOpen ? 'top-[9px] -rotate-45' : 'top-[15px] rotate-0'
                                )} />
                            </div>
                        </button>
                    </div>
                </nav>
            </header>

            {/* ═══════════════════════════════════════════════
               MOBILE DRAWER — Slides down from top
               ═══════════════════════════════════════════════ */}
            <div
                className={cn(
                    'fixed inset-0 z-[40] md:hidden transition-all duration-300',
                    mobileOpen ? 'visible' : 'invisible'
                )}
            >
                {/* Backdrop */}
                <div
                    className={cn(
                        'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
                        mobileOpen ? 'opacity-100' : 'opacity-0'
                    )}
                    onClick={closeMobile}
                />

                {/* Drawer Panel */}
                <div
                    className={cn(
                        'absolute top-[72px] left-0 right-0',
                        'max-h-[calc(100dvh-72px)]',
                        'rounded-b-3xl',
                        'shadow-2xl shadow-primary/10',
                        'flex flex-col',
                        'transition-all duration-300 ease-out origin-top',
                        'border-b border-white/[0.06]',
                        mobileOpen
                            ? 'opacity-100 translate-y-0 scale-y-100'
                            : 'opacity-0 -translate-y-4 scale-y-95 pointer-events-none'
                    )}
                    style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                >
                    {/* Top gradient accent */}
                    <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

                    {/* Drawer Body */}
                    <div className="flex-1 overflow-y-auto py-4 space-y-4">
                        {/* ── Authenticated: User Profile ── */}
                        {isAuthenticated && user && (
                            <div className="flex items-center gap-3 px-5 pb-3 border-b border-white/5">
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt={displayName}
                                        className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/30"
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-bold">
                                        {initials}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-text-heading truncate">{displayName}</p>
                                    <p className="text-xs text-text-muted truncate">{displayEmail}</p>
                                </div>
                            </div>
                        )}

                        {/* ── Authenticated: Workspace Section ── */}
                        {isAuthenticated && (
                            <div className="space-y-0.5">
                                <DrawerSectionLabel>Workspace</DrawerSectionLabel>
                                <DrawerItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={closeMobile} />
                                <DrawerItem href="/dashboard/purchases" icon={Package} label="My Themes" onClick={closeMobile} />
                                <DrawerItem href="/dashboard/downloads" icon={Download} label="Downloads" onClick={closeMobile} />
                                <DrawerItem href="/dashboard/installations" icon={Star} label="Installations" onClick={closeMobile} />
                            </div>
                        )}

                        {/* ── Explore Section ── */}
                        <div className="space-y-0.5">
                            <DrawerSectionLabel>Explore</DrawerSectionLabel>
                            <DrawerItem href="/themes" icon={LayoutGrid} label="Browse All" onClick={closeMobile} />
                            <DrawerItem href="/pricing" icon={Tag} label="Pricing" onClick={closeMobile} />
                            <DrawerItem href="/themes" icon={Flame} label="Trending" onClick={closeMobile} />
                        </div>

                        {/* ── Authenticated: Manage ── */}
                        {isAuthenticated && (
                            <div className="space-y-0.5 border-t border-white/5 pt-3">
                                <DrawerItem href="/dashboard/settings" icon={Settings} label="Settings" onClick={closeMobile} />
                            </div>
                        )}
                    </div>

                    {/* Drawer Footer */}
                    <div className="px-5 pb-5 pt-3 border-t border-white/5 flex-shrink-0 space-y-2.5">
                        {isAuthenticated ? (
                            <button
                                onClick={() => { signOut(); closeMobile(); }}
                                className="flex items-center justify-center gap-2 w-full py-3 text-sm font-semibold text-red-400 rounded-2xl border border-red-500/15 hover:bg-red-500/10 active:scale-[0.98] transition-all duration-200"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        ) : (
                            <>
                                <a
                                    href={loginUrl}
                                    className="flex items-center justify-center gap-2 w-full py-3 text-sm font-semibold text-text-heading rounded-2xl border border-white/[0.08] hover:bg-white/[0.04] active:scale-[0.98] transition-all duration-200"
                                    onClick={closeMobile}
                                >
                                    Login
                                </a>
                                <a
                                    href={signupUrl}
                                    className="relative flex items-center justify-center gap-2 w-full py-3 text-sm font-semibold text-white rounded-2xl overflow-hidden active:scale-[0.98] transition-all duration-200"
                                    onClick={closeMobile}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary via-violet-600 to-secondary" />
                                    <span className="relative">Sign Up Free</span>
                                </a>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* SEARCH MODAL */}
            {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
        </>
    );
}
