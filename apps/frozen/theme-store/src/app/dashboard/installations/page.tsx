import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button, Input, Package, Globe, Palette, ExternalLink, CheckCircle, AlertCircle } from '@letbuyy/ui';
import { ThemeService } from '@/lib/theme-service';
import { cn } from '@/lib/utils';
import { ThemeInstallFeedbackToast } from '@/components/theme-action-feedback';
import { getAdminUrl } from '@/lib/public-urls';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'My Installations' };

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
    active: { label: 'Active', icon: CheckCircle, className: 'text-success bg-success/15 border-success/20' },
    update_available: { label: 'Update pending', icon: AlertCircle, className: 'text-warning bg-warning/15 border-warning/20' },
};

type ThemeRecord = Record<string, unknown> & {
    id?: string;
    name?: string;
    slug?: string;
    thumbnail_url?: string;
    version?: string;
};

type InstallationRecord = Record<string, unknown> & {
    id?: string;
    store_id?: string;
    themes: ThemeRecord;
    store_url: string;
    store_slug?: string;
    status: string;
    version_installed?: string;
    installed_at?: string;
    releases?: Record<string, unknown>[];
};

type InstallationsPageProps = {
    searchParams?: Promise<{
        installed?: string;
        action?: string;
    }>;
};

function formStringValue(value: FormDataEntryValue | null): string {
    return typeof value === 'string' ? value : '';
}

async function rollbackReleaseAction(formData: FormData) {
    'use server';

    const slug = formStringValue(formData.get('theme'));
    const storeId = formStringValue(formData.get('store_id'));
    const releaseId = formStringValue(formData.get('release_id'));
    const expectedCurrentReleaseId = formStringValue(formData.get('expected_current_release_id'));
    if (!slug || !storeId || !releaseId || !expectedCurrentReleaseId) {
        redirect('/dashboard/installations?action=rollback-missing');
    }

    await ThemeService.rollbackThemeRelease(slug, storeId, releaseId, expectedCurrentReleaseId);
    redirect(`/dashboard/installations?action=rolled-back&installed=${encodeURIComponent(slug)}`);
}

async function applyThemeUpdateAction(formData: FormData) {
    'use server';

    const slug = formStringValue(formData.get('theme'));
    const storeId = formStringValue(formData.get('store_id'));
    if (!slug || !storeId) {
        redirect('/dashboard/installations?action=update-missing');
    }

    await ThemeService.installTheme(slug, storeId, { marketplace_update: true });
    redirect(`/dashboard/installations?action=updated&installed=${encodeURIComponent(slug)}`);
}

export default async function InstallationsPage({ searchParams }: InstallationsPageProps) {
    const params = await searchParams;
    const installedSlug = typeof params?.installed === 'string' ? params.installed : '';
    const installations: InstallationRecord[] = await Promise.all((await ThemeService.getUserInstallations()).map(async (inst: Record<string, unknown>) => {
        const site = (inst.sites && typeof inst.sites === 'object' ? inst.sites : {}) as Record<string, unknown>;
        const theme = (inst.themes && typeof inst.themes === 'object' ? inst.themes : {}) as ThemeRecord;
        const customDomain = typeof site.custom_domain === 'string' ? site.custom_domain : '';
        const subdomain = typeof site.subdomain === 'string' ? site.subdomain : 'unknown';
        const versionInstalled = typeof inst.version_installed === 'string' ? inst.version_installed : undefined;
        const installedAt = typeof inst.installed_at === 'string' ? inst.installed_at : undefined;
        const storeHost = customDomain || `${subdomain}.letbuyy.com`;
        const storeId = typeof inst.store_id === 'string' ? inst.store_id : '';
        const slug = typeof theme.slug === 'string' ? theme.slug : '';
        const releases = storeId && slug ? await ThemeService.getThemeReleases(slug, storeId) : [];

        return {
            ...inst,
            store_id: storeId,
            themes: theme,
            store_url: storeHost,
            store_slug: subdomain,
            status: theme.version && versionInstalled && versionInstalled !== theme.version
                ? 'update_available'
                : 'active',
            version_installed: versionInstalled,
            installed_at: installedAt,
            releases,
        };
    }));

    return (
        <div>
            <ThemeInstallFeedbackToast installed={installedSlug} themeName={installedSlug} />
            {params?.action === 'rolled-back' && (
                <div className="mb-4 rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
                    Theme release rolled back.
                </div>
            )}
            {params?.action === 'updated' && (
                <div className="mb-4 rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
                    Theme update applied as a new release.
                </div>
            )}
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
                    {installations.map((inst) => {
                        const theme = inst.themes;
                        const statusConfig = STATUS_CONFIG[inst.status] || STATUS_CONFIG.active;
                        const StatusIcon = statusConfig.icon;
                        const themeEditorId = theme.id || theme.slug;
                        const hasEditorLink = Boolean(themeEditorId && inst.store_slug);
                        const slug = typeof theme.slug === 'string' ? theme.slug : '';
                        const storeId = typeof inst.store_id === 'string' ? inst.store_id : '';
                        const rollbackRelease = (inst.releases || []).find((release) => release.is_current !== true && typeof release.id === 'string');
                        const currentRelease = (inst.releases || []).find((release) => release.is_current === true && typeof release.id === 'string');
                        const editorHref = hasEditorLink
                            ? getAdminUrl(`/${inst.store_slug}/online-store/themes/${themeEditorId}/editor`)
                            : '/support';

                        return (
                            <div key={inst.id} className="glass-card p-5">
                                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                    {/* Thumbnail */}
                                    <div className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-surface">
                                        {theme.thumbnail_url ? (
                                            <Image
                                                src={theme.thumbnail_url}
                                                alt={`${theme.name || 'Installed theme'} thumbnail`}
                                                fill
                                                sizes="80px"
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center">
                                                <Package className="h-5 w-5 text-text-subtle" aria-hidden="true" />
                                            </div>
                                        )}
                                    </div>

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
                                        {inst.status === 'update_available' && slug && storeId && (
                                            <form action={applyThemeUpdateAction}>
                                                <Input unstyled type="hidden" name="theme" value={slug} />
                                                <Input unstyled type="hidden" name="store_id" value={storeId} />
                                                <Button unstyled type="submit" className="btn-secondary text-xs py-1.5 px-3">
                                                    Apply update
                                                </Button>
                                            </form>
                                        )}
                                        {rollbackRelease && currentRelease && slug && storeId && (
                                            <form action={rollbackReleaseAction}>
                                                <Input unstyled type="hidden" name="theme" value={slug} />
                                                <Input unstyled type="hidden" name="store_id" value={storeId} />
                                                <Input unstyled type="hidden" name="release_id" value={String(rollbackRelease.id)} />
                                                <Input unstyled type="hidden" name="expected_current_release_id" value={String(currentRelease.id)} />
                                                <Button unstyled type="submit" className="btn-secondary text-xs py-1.5 px-3">
                                                    Roll back
                                                </Button>
                                            </form>
                                        )}
                                        <Link
                                            href={editorHref}
                                            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                                        >
                                            <Palette className="w-3 h-3" />
                                            {hasEditorLink ? 'Open editor' : 'Editor unavailable'}
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
                                            ? new Date(inst.installed_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
                                            : '—'}
                                    </span>
                                    {inst.status === 'update_available' && (
                                        <span>
                                            A newer marketplace version is available.
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
