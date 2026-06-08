'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Package, Download, Settings, ChevronLeft, Heart } from '@letbuyy/ui';
import { cn } from '@/lib/utils';

const SIDEBAR_ITEMS = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/favorites', label: 'Saved Themes', icon: Heart },
    { href: '/dashboard/purchases', label: 'Purchases', icon: ShoppingBag },
    { href: '/dashboard/installations', label: 'Installations', icon: Package },
    { href: '/dashboard/downloads', label: 'Downloads', icon: Download },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="container-main py-6 md:py-10">
            <div className="flex gap-6">
                {/* Sidebar */}
                <aside className="hidden lg:block w-56 flex-shrink-0">
                    <div className="sticky top-24 space-y-1">
                        {/* Back Link */}
                        <Link
                            href="/themes"
                            className="flex items-center gap-2 px-3 py-2 text-xs text-text-subtle hover:text-text-heading transition-colors mb-4"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Back to Themes
                        </Link>

                        {/* Nav Items */}
                        {SIDEBAR_ITEMS.map(item => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                                        isActive
                                            ? 'bg-primary/10 text-primary-light border border-primary/20'
                                            : 'text-text-muted hover:text-text-heading hover:bg-surface'
                                    )}
                                >
                                    <item.icon className={cn('w-4 h-4', isActive ? 'text-primary-light' : 'text-text-subtle')} />
                                    {item.label}
                                </Link>
                            );
                        })}

                        <div className="mt-6 p-4 rounded-xl border border-border bg-surface">
                            <p className="text-xs font-semibold text-text-heading">Theme purchases</p>
                            <p className="text-[11px] text-text-muted mb-3">Per-theme purchases are live. Subscription state is not exposed here yet.</p>
                            <Link href="/pricing" className="btn-secondary text-xs py-1.5 px-3 w-full text-center block">
                                View pricing
                            </Link>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <div className="flex-grow min-w-0">
                    {/* Mobile Nav */}
                    <div className="lg:hidden flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
                        {SIDEBAR_ITEMS.map(item => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                                        isActive
                                            ? 'bg-primary text-white'
                                            : 'bg-surface text-text-muted'
                                    )}
                                >
                                    <item.icon className="w-3.5 h-3.5" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>

                    {children}
                </div>
            </div>
        </div>
    );
}
