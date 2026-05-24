import Link from 'next/link';
import { Package, Globe, Palette, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { ThemeService } from '@/lib/theme-service';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'My Installations' };

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
    active: { label: 'Active', icon: CheckCircle, className: 'text-success bg-success/15 border-success/20' },
    update_available: { label: 'Update Available', icon: AlertCircle, className: 'text-warning bg-warning/15 border-warning/20' },
};

export default async function InstallationsPage() {
    const installations = (await ThemeService.getUserInstallations()).map((inst: any) => {
        const site = inst.sites || {};
        const storeHost = site.custom_domain || `${site.subdomain || 'unknown'}.letbuyy.store`;

        return {
            ...inst,
            store_url: storeHost,
            status: inst.themes?.version && inst.version_installed && inst.version_installed !== inst.themes.version
                ? 'update_available'
                : 'active',
        };
    });

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-1">Active Installations</h1>
                <p className="text-sm text-text-muted">{installations.length} themes installed across your stores</p>
            </div>

            {installations.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
                        <Package className="w-7 h-7 text-text-subtle" />
                    </div>
                    <h3 className="text-lg font-semibold text-text-heading mb-2">No installations yet</h3>
                    <p className="text-sm text-text-muted mb-4">Install a theme on one of your stores to see it here.</p>
                    <Link href="/themes" className="btn-primary text-sm">Browse Themes</Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {installations.map((inst: any) => {
                        const theme = inst.themes || {};
                        const statusConfig = STATUS_CONFIG[inst.status] || STATUS_CONFIG.active;
                        const StatusIcon = statusConfig.icon;

                        return (
                            <div key={inst.id} className="glass-card p-5" style={{ transform: 'none' }}>
                                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                    {/* Thumbnail */}
                                    <div
                                        className="w-20 h-14 rounded-lg bg-cover bg-center flex-shrink-0 border border-border"
                                        style={{ backgroundImage: `url(${theme.thumbnail_url || ''})` }}
                                    />

                                    {/* Info */}
                                    <div className="flex-grow min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <h3 className="text-sm font-semibold text-text-heading">{theme.name || 'Unknown Theme'}</h3>
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
                                                v{inst.version_installed || theme.version || '1.0'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <Link
                                            href={`/themes/${theme.slug || ''}`}
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
                                        Installed {inst.installed_at
                                            ? new Date(inst.installed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                            : '—'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
