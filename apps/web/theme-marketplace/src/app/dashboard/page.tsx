import Link from 'next/link';
import { Palette, ShoppingBag, Package, Star, ArrowRight, Clock, Activity } from 'lucide-react';
import { MOCK_THEMES } from '@/lib/theme-data';
import { formatCount } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

const STATS = [
    { label: 'Installed Themes', value: '3', icon: Package, color: 'text-primary-light bg-primary/15' },
    { label: 'Premium Licenses', value: '2', icon: Star, color: 'text-warning bg-warning/15' },
    { label: 'Active Stores', value: '2', icon: ShoppingBag, color: 'text-success bg-success/15' },
];

const ACTIVITY = [
    { text: 'Installed "Urban Kicks" on store dohi', time: '2 days ago', icon: Package },
    { text: 'Purchased "Neon Tech"', time: '5 days ago', icon: ShoppingBag },
    { text: 'Updated customizations on luxe-co', time: '1 week ago', icon: Palette },
    { text: 'Left a review on "Nature\'s Basket"', time: '2 weeks ago', icon: Star },
];

export default function DashboardOverview() {
    const installedThemes = MOCK_THEMES.slice(0, 3);

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

                <div className="glass-card divide-y divide-border" style={{ transform: 'none' }}>
                    {installedThemes.map((theme, i) => (
                        <div key={theme.id} className="flex items-center gap-4 p-4 hover:bg-surface/30 transition-colors">
                            <div
                                className="w-14 h-10 rounded-lg bg-cover bg-center flex-shrink-0 border border-border"
                                style={{ backgroundImage: `url(${theme.thumbnail_url})` }}
                            />
                            <div className="flex-grow min-w-0">
                                <h3 className="text-sm font-semibold text-text-heading truncate">{theme.name}</h3>
                                <p className="text-[11px] text-text-muted flex items-center gap-2">
                                    <Star className="w-3 h-3 text-warning fill-warning inline" />
                                    {theme.rating} • v{theme.version}
                                </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-xs text-text-muted">
                                    {i < 2 ? `Store: ${'dohi,luxe-co'.split(',')[i]}` : 'Not installed'}
                                </p>
                            </div>
                            <Link
                                href={i < 2 ? `/dashboard/customizer/${theme.slug}` : `/dashboard/installations`}
                                className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0"
                            >
                                {i < 2 ? 'Customize' : 'Install'}
                            </Link>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Activity */}
            <div>
                <h2 className="text-lg font-bold mb-5">Recent Activity</h2>
                <div className="space-y-3">
                    {ACTIVITY.map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center flex-shrink-0 mt-0.5">
                                <item.icon className="w-4 h-4 text-text-subtle" />
                            </div>
                            <div>
                                <p className="text-sm text-text-body">{item.text}</p>
                                <p className="text-[11px] text-text-subtle flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3" />
                                    {item.time}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
