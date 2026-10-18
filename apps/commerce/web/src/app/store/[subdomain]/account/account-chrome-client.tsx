// ============================================================
// ACCOUNT LAYOUT — Auth-gated wrapper for customer account pages
// ============================================================

'use client';

import { useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCustomerAuth } from '@/context/customer-auth-context';
import { useWishlist } from '@/context/wishlist-context';
import {
    Package, Heart, MapPin, Settings, ChevronRight, Award,
} from '@letbuyy/ui';
import { StorefrontListLoadingState } from '@/components/storefront/storefront-states';

const navItems = [
    { href: 'orders', icon: Package, label: 'Orders' },
    { href: 'addresses', icon: MapPin, label: 'Addresses' },
    { href: 'settings', icon: Settings, label: 'Settings' },
];

export default function AccountChromeClient({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const params = useParams();
    const currentPath = usePathname();
    const subdomain = params.subdomain as string;
    const basePath = `/store/${subdomain}`;
    const { isAuthenticated, isLoading, customer } = useCustomerAuth();
    const {
        buyerSession: hasBuyerSession,
        buyerSessionEmail,
        buyerSessionReady,
        buyerSessionUnavailable,
    } = useWishlist();
    const buyer = buyerSessionEmail ? { email: buyerSessionEmail } : null;
    const buyerSessionError = buyerSessionReady && buyerSessionUnavailable;
    const loading = isLoading || !buyerSessionReady;
    const hasAccount = isAuthenticated || buyer !== null;

    useEffect(() => {
        if (!loading && !hasAccount && !buyerSessionError) {
            router.push(basePath);
        }
    }, [basePath, loading, hasAccount, buyerSessionError, router]);

    if (loading && !hasAccount) {
        return (
            <div className="container mx-auto px-4 py-8 md:py-12" style={{ marginTop: '80px' }}>
                <StorefrontListLoadingState rows={4} />
            </div>
        );
    }

    if (!loading && !hasAccount) {
        return buyerSessionError ? (
            <div className="container mx-auto px-4 py-8 md:py-12" style={{ marginTop: '80px' }} role="alert">
                We could not check your account right now. Please try again.
            </div>
        ) : null;
    }

    const displayName = buyer?.email ?? customer?.fullName;
    const displayEmail = buyer?.email ?? customer?.email;
    const initials = displayName
        ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : displayEmail?.[0]?.toUpperCase() || '?';
    const visibleNavItems = [
        ...navItems,
        ...(isAuthenticated || hasBuyerSession ? [{ href: 'wishlist', icon: Heart, label: 'Wishlist' }] : []),
        ...(hasBuyerSession ? [{ href: 'loyalty', icon: Award, label: 'Rewards' }] : []),
    ];

    return (
        <div className="container mx-auto px-4 py-8 md:py-12" style={{ marginTop: '80px' }}>
            {loading && (
                <div role="status" className="mb-6">
                    <StorefrontListLoadingState rows={4} />
                </div>
            )}
            <div
                className={loading ? 'invisible pointer-events-none' : undefined}
                aria-hidden={loading || undefined}
                inert={loading || undefined}
            >
            {/* Mobile: Horizontal Nav */}
            <div className="md:hidden mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: 'var(--primary)' }}
                    >
                        {initials}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{displayName || 'Customer'}</p>
                        <p className="truncate text-xs" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>{displayEmail}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {visibleNavItems.map(({ href, icon: Icon, label }) => {
                        const itemHref = `${basePath}/account/${href}`;
                        const active = currentPath.includes(itemHref);
                        return (
                            <Link
                                key={href}
                                href={itemHref}
                                className="flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium transition-colors"
                                style={{
                                    backgroundColor: active ? 'var(--primary)' : 'var(--surface, rgb(243 244 246))',
                                    color: active ? 'rgb(255 255 255)' : 'var(--text, rgb(26 26 46))',
                                }}
                            >
                                <Icon size={14} />
                                {label}
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div className="flex gap-8">
                {/* Desktop: Sidebar */}
                <aside className="hidden md:block w-64 shrink-0">
                    <div className="sticky top-24">
                        <div className="flex items-center gap-3 mb-6">
                            <div
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                                style={{ backgroundColor: 'var(--primary)' }}
                            >
                                {initials}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate font-semibold">{displayName || 'Customer'}</p>
                                <p className="truncate text-sm" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                    {displayEmail}
                                </p>
                            </div>
                        </div>

                        <nav className="space-y-1">
                            {visibleNavItems.map(({ href, icon: Icon, label }) => {
                                const itemHref = `${basePath}/account/${href}`;
                                const active = currentPath.includes(itemHref);
                                return (
                                    <Link
                                        key={href}
                                        href={itemHref}
                                        className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                                        style={{
                                            backgroundColor: active ? 'var(--primary)' : 'transparent',
                                            color: active ? 'rgb(255 255 255)' : 'var(--text, rgb(26 26 46))',
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon size={18} />
                                            {label}
                                        </div>
                                        <ChevronRight size={14} className="opacity-50" />
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 min-w-0">
                    {children}
                </main>
            </div>
            </div>
        </div>
    );
}
