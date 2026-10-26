import MarketplaceTaskTitle from '@/components/marketplace-task-title';
import { Download, Globe, Code, ShoppingBag, Monitor } from '@letbuyy/ui';
import { ThemeService } from '@/lib/theme-service';
import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = { title: 'Downloads' };

const PLATFORM_ICONS: Record<string, typeof Globe> = {
    letbuyy: ShoppingBag,
    wordpress: Globe,
    shopify: ShoppingBag,
    html: Code,
    react: Monitor,
};

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(record: Record<string, unknown>, key: string, fallback = ''): string {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
}

function formatBytes(value: unknown): string {
    const bytes = typeof value === 'number' && Number.isFinite(value) ? value : null;
    if (bytes === null) return 'Size unavailable';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DownloadsPage() {
    const downloadItems = await ThemeService.getThemeDownloads();

    return (
        <div>
            <div className="mb-8">
                <MarketplaceTaskTitle artwork="library">Downloads</MarketplaceTaskTitle>
                <p className="text-sm text-text-muted">Theme package delivery status for purchased themes</p>
            </div>

            {downloadItems.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
                        <Download className="w-7 h-7 text-text-subtle" />
                    </div>
                    <h3 className="text-lg font-semibold text-text-heading mb-2">No downloads available</h3>
                    <p className="text-sm text-text-muted">Purchase a theme to see delivery status here.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {downloadItems.map((item) => {
                        const theme = recordValue(item.theme);
                        const purchase = recordValue(item.purchase);
                        const itemId = stringValue(purchase, 'id', stringValue(theme, 'id', stringValue(theme, 'name', 'theme-download')));

                        return (
                        <div key={itemId} className="glass-card overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center gap-4 p-5 border-b border-border">
                                <div className="h-11 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-surface">
                                    {stringValue(theme, 'thumbnail_url') ? (
                                        <Image
                                            src={stringValue(theme, 'thumbnail_url')}
                                            alt={`${stringValue(theme, 'name', 'Theme')} thumbnail`}
                                            width={64}
                                            height={44}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : null}
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-text-heading">{stringValue(theme, 'name', 'Unknown theme')}</h3>
                                    <p className="text-xs text-text-muted capitalize">{stringValue(theme, 'category')} Theme • v{stringValue(theme, 'version', '1.0')}</p>
                                </div>
                            </div>

                            {/* Platform Downloads */}
                            <div className="divide-y divide-border">
                                {item.artifacts.map((artifact) => {
                                    const platform = stringValue(artifact, 'platform', 'letbuyy');
                                    const Icon = PLATFORM_ICONS[platform] || Globe;
                                    const deliveryStatus = stringValue(artifact, 'delivery_status', 'available').replace(/_/g, ' ');
                                    const signedUrl = stringValue(artifact, 'signed_url');
                                    return (
                                        <div
                                            key={stringValue(artifact, 'id', platform)}
                                            className="flex items-center gap-4 px-5 py-3.5"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center flex-shrink-0">
                                                <Icon className="w-4 h-4 text-text-subtle" />
                                            </div>
                                            <div className="flex-grow">
                                                <p className="text-sm font-medium text-text-heading capitalize">{platform}</p>
                                                <p className="text-[11px] text-text-subtle">{stringValue(artifact, 'file_name', `${platform}.zip`)} • {formatBytes(artifact.size_bytes)}</p>
                                            </div>
                                            {signedUrl ? (
                                                <a href={signedUrl} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white">
                                                    Download
                                                </a>
                                            ) : (
                                                <span className="rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-text-subtle capitalize">
                                                    {deliveryStatus}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
