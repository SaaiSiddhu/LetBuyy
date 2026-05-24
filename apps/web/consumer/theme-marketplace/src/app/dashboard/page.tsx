import Link from 'next/link';
import { Palette, ShoppingBag, Package, Star, ArrowRight, Clock } from 'lucide-react';
import { ThemeService } from '@/lib/theme-service';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardOverview() {
    const purchases = (await ThemeService.getUserPurchases()).slice(0, 5);
    const installedThemes = (await ThemeService.getUserInstallations())
        .filter((installation: any) => installation.is_active !== false)
        .slice(0, 5);

    const STATS = [
        { label: 'Installed Themes', value: String(installedThemes.length), icon: Package, color: 'text-primary-light bg-primary/15' },
        { label: 'Purchases', value: String(purchases.length), icon: ShoppingBag, color: 'text-success bg-success/15' },
        { label: 'Premium Licenses', value: String(purchases.filter((p: any) => p.themes?.letbuyy_pricing_type !== 'free').length), icon: Star, color: 'text-warning bg-warning/15' },
    ];

    return (
        <div>
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-bold mb-1">My Themes Dashboard</h1>
                <p className="text-sm text-text-muted">Manage your themes, installations, and purchases.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                {STATS.map(stat => (
                    <div key={stat.label} className="glass-card p-5 flex items-center gap-4" style={{ transform: 'none' }}>
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
                    <div className="glass-card divide-y divide-border" style={{ transform: 'none' }}>
                        {installedThemes.map((inst: any) => {
                            const theme = inst.themes || {};
                            return (
                                <div key={inst.id} className="flex items-center gap-4 p-4 hover:bg-surface/30 transition-colors">
                                    <div
                                        className="w-14 h-10 rounded-lg bg-cover bg-center flex-shrink-0 border border-border"
                                        style={{ backgroundImage: `url(${theme.thumbnail_url || ''})` }}
                                    />
                                    <div className="flex-grow min-w-0">
                                        <h3 className="text-sm font-semibold text-text-heading truncate">{theme.name || 'Unknown Theme'}</h3>
                                        <p className="text-[11px] text-text-muted flex items-center gap-2">
                                            <Star className="w-3 h-3 text-warning fill-warning inline" />
                                            {theme.rating_avg || theme.rating || '—'} • v{inst.version_installed || theme.version || '1.0'}
                                        </p>
                                    </div>
                                    <Link
                                        href={`/themes/${theme.slug || ''}`}
                                        className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0"
                                    >
                                        View
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="glass-card p-8 text-center" style={{ transform: 'none' }}>
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
                        {purchases.map((purchase: any) => (
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
                                        {new Date(purchase.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
