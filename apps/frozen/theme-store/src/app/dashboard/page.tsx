import MarketplaceTaskTitle from '@/components/marketplace-task-title';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, Package, Star, ArrowRight, Clock } from '@letbuyy/ui';
import { ThemeService } from '@/lib/theme-service';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

type DashboardTheme = {
    slug?: string;
    name?: string;
    thumbnail_url?: string;
    version?: string;
    rating?: number;
    rating_avg?: number;
    letbuyy_pricing_type?: string;
};

type DashboardPurchase = {
    id?: string;
    created_at?: string;
    themes?: DashboardTheme;
};

type DashboardInstallation = {
    id?: string;
    is_active?: boolean;
    version_installed?: string;
    themes?: DashboardTheme;
};

export default async function DashboardOverview() {
    const [purchaseRows, installationRows] = await Promise.all([
        ThemeService.getUserPurchases() as Promise<DashboardPurchase[]>,
        ThemeService.getUserInstallations() as Promise<DashboardInstallation[]>,
    ]);
    const purchases = purchaseRows.slice(0, 5);
    const installedThemes = installationRows
        .filter((installation) => installation.is_active !== false)
        .slice(0, 5);

    const STATS = [
        { label: 'Installed Themes', value: String(installedThemes.length), icon: Package, color: 'text-primary-light bg-primary/15' },
        { label: 'Purchases', value: String(purchases.length), icon: ShoppingBag, color: 'text-success bg-success/15' },
        { label: 'Premium Licenses', value: String(purchases.filter((p) => p.themes?.letbuyy_pricing_type !== 'free').length), icon: Star, color: 'text-warning bg-warning/15' },
    ];

    return (
        <div>
            {/* Page Header */}
            <div className="mb-8">
                <MarketplaceTaskTitle artwork="library">My Themes Dashboard</MarketplaceTaskTitle>
                <p className="text-sm text-text-muted">Manage your themes, installations, and purchases.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                {STATS.map(stat => (
                    <div key={stat.label} className="glass-card p-5 flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.color}`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-text-heading">{stat.value}</p>
                            <p className="text-xs text-text-muted">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Installed Themes */}
            <div className="mb-10">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold">Installed Themes</h2>
                    <Link href="/dashboard/installations" className="text-xs text-text-muted hover:text-primary-light flex items-center gap-1">
                        View all <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>

                {installedThemes.length > 0 ? (
                    <div className="glass-card divide-y divide-border">
                        {installedThemes.map((inst) => {
                            const theme = inst.themes || {};
                            return (
                                <div key={inst.id} className="flex items-center gap-4 p-4 hover:bg-surface/30 transition-colors">
                                    <div className="relative h-10 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-surface">
                                        {theme.thumbnail_url ? (
                                            <Image
                                                src={theme.thumbnail_url}
                                                alt={`${theme.name || 'Theme'} thumbnail`}
                                                fill
                                                className="object-cover"
                                                sizes="56px"
                                            />
                                        ) : null}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <h3 className="text-sm font-semibold text-text-heading truncate">{theme.name || 'Unknown Theme'}</h3>
                                        <p className="text-[11px] text-text-muted flex items-center gap-2">
                                            <Star className="w-3 h-3 text-warning fill-warning inline" />
                                            {theme.rating_avg || theme.rating || '—'} • v{inst.version_installed || theme.version || '1.0'}
                                        </p>
                                    </div>
                                    <Link
                                        href={theme.slug ? `/themes/${theme.slug}` : '/themes'}
                                        className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0"
                                    >
                                        View
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="glass-card p-8 text-center">
                        <p className="text-sm text-text-muted">No themes installed yet.</p>
                        <Link href="/themes" className="text-sm text-primary-light hover:underline mt-2 inline-block">
                            Browse themes →
                        </Link>
                    </div>
                )}
            </div>

            {/* Recent Purchases */}
            {purchases.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-bold">Recent Purchases</h2>
                        <Link href="/dashboard/purchases" className="text-xs text-text-muted hover:text-primary-light flex items-center gap-1">
                            View all <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {purchases.map((purchase) => (
                            <div key={purchase.id} className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <ShoppingBag className="w-4 h-4 text-text-subtle" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-body">
                                        Purchased &quot;{purchase.themes?.name || 'Theme'}&quot;
                                    </p>
                                    <p className="text-[11px] text-text-subtle flex items-center gap-1 mt-0.5">
                                        <Clock className="w-3 h-3" />
                                        {purchase.created_at
                                            ? new Date(purchase.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
                                            : 'Date unavailable'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
