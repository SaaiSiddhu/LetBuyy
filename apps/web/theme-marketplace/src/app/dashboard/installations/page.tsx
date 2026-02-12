import Link from 'next/link';
import { Package, Globe, Palette, Trash2, Settings, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { MOCK_THEMES } from '@/lib/theme-data';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'My Installations' };

const INSTALLATIONS = [
    {
        id: 'inst-001',
        theme: MOCK_THEMES[0],
        store_name: 'dohi',
        store_url: 'dohi.letbuyy.store',
        installed_at: '2026-01-29',
        status: 'active' as const,
        auto_update: true,
    },
    {
        id: 'inst-002',
        theme: MOCK_THEMES[1],
        store_name: 'luxe-co',
        store_url: 'luxe-co.letbuyy.store',
        installed_at: '2026-01-16',
        status: 'active' as const,
        auto_update: true,
    },
    {
        id: 'inst-003',
        theme: MOCK_THEMES[2],
        store_name: 'neonstore',
        store_url: 'neonstore.letbuyy.store',
        installed_at: '2026-02-06',
        status: 'update_available' as const,
        auto_update: false,
    },
];

const STATUS_CONFIG = {
    active: { label: 'Active', icon: CheckCircle, className: 'text-success bg-success/15 border-success/20' },
    update_available: { label: 'Update Available', icon: AlertCircle, className: 'text-warning bg-warning/15 border-warning/20' },
};

export default function InstallationsPage() {
    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-1">Active Installations</h1>
                <p className="text-sm text-text-muted">{INSTALLATIONS.length} themes installed across your stores</p>
            </div>

            <div className="space-y-4">
                {INSTALLATIONS.map(inst => {
                    const statusConfig = STATUS_CONFIG[inst.status];
                    const StatusIcon = statusConfig.icon;

                    return (
                        <div key={inst.id} className="glass-card p-5" style={{ transform: 'none' }}>
                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                {/* Thumbnail */}
                                <div
                                    className="w-20 h-14 rounded-lg bg-cover bg-center flex-shrink-0 border border-border"
                                    style={{ backgroundImage: `url(${inst.theme.thumbnail_url})` }}
                                />

                                {/* Info */}
                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <h3 className="text-sm font-semibold text-text-heading">{inst.theme.name}</h3>
                                        <span className={cn(
                                            'px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1',
                                            statusConfig.className
                                        )}>
                                            <StatusIcon className="w-3 h-3" />
                                            {statusConfig.label}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-muted">
                                        <span className="flex items-center gap-1">
                                            <Globe className="w-3 h-3" />
                                            {inst.store_url}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Package className="w-3 h-3" />
                                            v{inst.theme.version}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Link
                                        href={`/dashboard/customizer/${inst.theme.slug}`}
                                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                                    >
                                        <Palette className="w-3 h-3" />
                                        Customize
                                    </Link>
                                    <a
                                        href={`https://${inst.store_url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Visit
                                    </a>
                                </div>
                            </div>

                            {/* Footer Row */}
                            <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-text-subtle">
                                <span>
                                    Installed {new Date(inst.installed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                <div className="flex items-center gap-3">
                                    <span className={cn(
                                        'flex items-center gap-1',
                                        inst.auto_update ? 'text-success' : 'text-text-subtle'
                                    )}>
                                        <Settings className="w-3 h-3" />
                                        Auto-update: {inst.auto_update ? 'ON' : 'OFF'}
                                    </span>
                                    <button className="text-text-subtle hover:text-error transition-colors flex items-center gap-1">
                                        <Trash2 className="w-3 h-3" />
                                        Uninstall
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
