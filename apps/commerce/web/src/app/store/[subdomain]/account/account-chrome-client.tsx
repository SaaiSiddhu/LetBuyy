// ============================================================
// ACCOUNT LAYOUT — Auth-gated wrapper for customer account pages
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCustomerAuth } from '@/context/customer-auth-context';
import {
    Package, Heart, MapPin, Settings, ChevronRight,
} from '@letbuyy/ui';
import { StorefrontListLoadingState } from '@/components/storefront/storefront-states';

const navItems = [
    { href: 'orders', icon: Package, label: 'Orders' },
    { href: 'addresses', icon: MapPin, label: 'Addresses' },
    { href: 'settings', icon: Settings, label: 'Settings' },
];

type BuyerSession = { email: string; emailVerified: boolean } | null;

export default function AccountChromeClient({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const params = useParams();
    const currentPath = usePathname();
    const subdomain = params.subdomain as string;
    const basePath = `/store/${subdomain}`;
    const { isAuthenticated, isLoading, customer } = useCustomerAuth();
    const [buyer, setBuyer] = useState<BuyerSession | undefined>(undefined);
    const [buyerSessionError, setBuyerSessionError] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/buyer-auth/session', { cache: 'no-store', signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error('session_unavailable');
                const payload = await response.json() as { buyer?: BuyerSession };
                setBuyer(payload.buyer ?? null);
                setBuyerSessionError(false);
            })
            .catch((error: unknown) => {
                if (error instanceof Error && error.name === 'AbortError') return;
                setBuyer(null);
                setBuyerSessionError(true);
            });
        return () => controller.abort();
    }, []);

    const loading = isLoading || buyer === undefined;
    const hasAccount = isAuthenticated || buyer !== null;

    useEffect(() => {
        if (!loading && !hasAccount && !buyerSessionError) {
            router.push(basePath);
        }
    }, [basePath, loading, hasAccount, buyerSessionError, router]);

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8 md:py-12" style={{ marginTop: '80px' }}>
                <StorefrontListLoadingState rows={4} />
            </div>
        );
    }

    if (!hasAccount) {
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
    const visibleNavItems = isAuthenticated ? [...navItems, { href: 'wishlist', icon: Heart, label: 'Wishlist' }] : navItems;

    return (
        <div className="container mx-auto px-4 py-8 md:py-12" style={{ marginTop: '80px' }}>
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
    );
}
