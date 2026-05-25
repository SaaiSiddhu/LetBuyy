import { Download, Globe, Code, ShoppingBag, Monitor } from 'lucide-react';
import { ThemeService } from '@/lib/theme-service';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Downloads' };

const PLATFORM_ICONS: Record<string, typeof Globe> = {
    letbuyy: ShoppingBag,
    wordpress: Globe,
    shopify: ShoppingBag,
    html: Code,
    react: Monitor,
};

export default async function DownloadsPage() {
    const purchases = await ThemeService.getUserPurchases();

    // Build download items from purchased themes
    const downloadItems = purchases.map((purchase: any) => {
        const theme = purchase.themes || {};
        const supportedPlatforms = theme.supported_platforms || ['letbuyy'];

        const platforms = [
            { platform: 'letbuyy', version: theme.version || '1.0', size: '2.4 MB', available: true },
            { platform: 'wordpress', version: theme.version || '1.0', size: '3.1 MB', available: supportedPlatforms.includes('wordpress') },
            { platform: 'html', version: theme.version || '1.0', size: '1.8 MB', available: supportedPlatforms.includes('html') },
            { platform: 'react', version: theme.version || '1.0', size: '2.9 MB', available: supportedPlatforms.includes('react') },
        ];

        return { theme, platforms };
    });

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-1">Downloads</h1>
                <p className="text-sm text-text-muted">Download your purchased themes for any supported platform</p>
            </div>

            {downloadItems.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
                        <Download className="w-7 h-7 text-text-subtle" />
                    </div>
                    <h3 className="text-lg font-semibold text-text-heading mb-2">No downloads available</h3>
                    <p className="text-sm text-text-muted">Purchase a theme to access downloads.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {downloadItems.map((item: any) => (
                        <div key={item.theme.id} className="glass-card overflow-hidden" style={{ transform: 'none' }}>
                            {/* Header */}
                            <div className="flex items-center gap-4 p-5 border-b border-border">
                                <div
                                    className="w-16 h-11 rounded-lg bg-cover bg-center flex-shrink-0 border border-border"
                                    style={{ backgroundImage: `url(${item.theme.thumbnail_url || ''})` }}
                                />
                                <div>
                                    <h3 className="text-sm font-semibold text-text-heading">{item.theme.name || 'Unknown'}</h3>
                                    <p className="text-xs text-text-muted capitalize">{item.theme.category || ''} Theme • v{item.theme.version || '1.0'}</p>
                                </div>
                            </div>

                            {/* Platform Downloads */}
                            <div className="divide-y divide-border">
                                {item.platforms.map((dl: any) => {
                                    const Icon = PLATFORM_ICONS[dl.platform] || Globe;
                                    return (
                                        <div
                                            key={dl.platform}
                                            className={cn(
                                                'flex items-center gap-4 px-5 py-3.5',
                                                !dl.available && 'opacity-40'
                                            )}
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center flex-shrink-0">
                                                <Icon className="w-4 h-4 text-text-subtle" />
                                            </div>
                                            <div className="flex-grow">
                                                <p className="text-sm font-medium text-text-heading capitalize">{dl.platform}</p>
                                                <p className="text-[11px] text-text-subtle">v{dl.version} • {dl.size}</p>
                                            </div>
                                            <button
                                                disabled={!dl.available}
                                                className={cn(
                                                    'text-xs py-1.5 px-3 rounded-lg font-medium flex items-center gap-1 transition-all',
                                                    dl.available
                                                        ? 'btn-secondary hover:bg-primary/10'
                                                        : 'bg-surface text-text-subtle cursor-not-allowed'
                                                )}
                                            >
                                                {dl.available ? (
                                                    <>
                                                        <Download className="w-3 h-3" />
                                                        Download
                                                    </>
                                                ) : (
                                                    'Not Available'
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
