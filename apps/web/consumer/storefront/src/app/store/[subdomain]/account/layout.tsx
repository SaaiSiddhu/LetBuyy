// ============================================================
// ACCOUNT LAYOUT — Auth-gated wrapper for customer account pages
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCustomerAuth } from '@/context/customer-auth-context';
import {
    Package, Heart, MapPin, Settings, ChevronRight,
    Loader2, User as UserIcon,
} from 'lucide-react';

const navItems = [
    { href: 'orders', icon: Package, label: 'Orders' },
    { href: 'wishlist', icon: Heart, label: 'Wishlist' },
    { href: 'addresses', icon: MapPin, label: 'Addresses' },
    { href: 'settings', icon: Settings, label: 'Settings' },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const params = useParams();
    const subdomain = params.subdomain as string;
    const basePath = `/store/${subdomain}`;
    const { isAuthenticated, isLoading, customer } = useCustomerAuth();
    const [currentPath, setCurrentPath] = useState('');

    useEffect(() => {
        setCurrentPath(window.location.pathname);
    }, []);

    // Redirect if not authenticated (after loading completes)
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push(basePath);
        }
    }, [basePath, isLoading, isAuthenticated, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
        );
    }

    if (!isAuthenticated) return null;

    const initials = customer?.fullName
        ? customer.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : customer?.email?.[0]?.toUpperCase() || '?';

    return (
        <div className="container mx-auto px-4 py-8 md:py-12" style={{ marginTop: '80px' }}>
            {/* Mobile: Horizontal Nav */}
            <div className="md:hidden mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: 'var(--primary)' }}
                    >
                        {initials}
                    </div>
                    <div>
                        <p className="font-semibold text-sm">{customer?.fullName || 'Customer'}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary, #6B7280)' }}>{customer?.email}</p>
                    </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    {navItems.map(({ href, icon: Icon, label }) => {
                        const itemHref = `${basePath}/account/${href}`;
                        const active = currentPath.includes(itemHref);
                        return (
                            <Link
                                key={href}
                                href={itemHref}
                                onClick={() => setCurrentPath(itemHref)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                                style={{
                                    backgroundColor: active ? 'var(--primary)' : 'var(--surface, #F3F4F6)',
                                    color: active ? '#FFFFFF' : 'var(--text, #1A1A2E)',
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
                                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                                style={{ backgroundColor: 'var(--primary)' }}
                            >
                                {initials}
                            </div>
                            <div>
                                <p className="font-semibold">{customer?.fullName || 'Customer'}</p>
                                <p className="text-sm" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                    {customer?.email}
                                </p>
                            </div>
                        </div>

                        <nav className="space-y-1">
                            {navItems.map(({ href, icon: Icon, label }) => {
                                const itemHref = `${basePath}/account/${href}`;
                                const active = currentPath.includes(itemHref);
                                return (
                                    <Link
                                        key={href}
                                        href={itemHref}
                                        onClick={() => setCurrentPath(itemHref)}
                                        className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                                        style={{
                                            backgroundColor: active ? 'var(--primary)' : 'transparent',
                                            color: active ? '#FFFFFF' : 'var(--text, #1A1A2E)',
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
