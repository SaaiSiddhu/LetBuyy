'use client';

import { useState } from 'react';
import { ConfirmDialog, Package, Settings, Trash2 } from '@letbuyy/ui';
import type { InstalledApp } from '@letbuyy/shared-types';
import Link from 'next/link';

interface InstalledAppsGridProps {
    installations: InstalledApp[];
}

function getInstalledAppName(installation: InstalledApp): string {
    return installation.marketplace_apps?.name || 'Installed app';
}

function getInstalledAppIcon(installation: InstalledApp): string | null {
    return installation.marketplace_apps?.icon_url || null;
}

function getInstalledAppLaunchUrl(installation: InstalledApp): string | null {
    return installation.marketplace_apps?.app_url || null;
}

export function InstalledAppsGrid({ installations }: InstalledAppsGridProps) {
    const [installedApps, setInstalledApps] = useState(installations);
    const [pendingUninstall, setPendingUninstall] = useState<InstalledApp | null>(null);
    const [uninstallingAppId, setUninstallingAppId] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const confirmUninstall = async () => {
        if (!pendingUninstall || uninstallingAppId) return;

        setUninstallingAppId(pendingUninstall.app_id);
        setNotice(null);
        setError(null);

        try {
            const response = await fetch(`/api/apps/${pendingUninstall.app_id}/install`, { method: 'DELETE' });
            const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;

            if (!response.ok) {
                throw new Error(payload?.error?.message || 'The app could not be uninstalled right now.');
            }

            const appName = getInstalledAppName(pendingUninstall);
            setInstalledApps((current) => current.filter((installation) => installation.id !== pendingUninstall.id));
            setPendingUninstall(null);
            setNotice(`${appName} was uninstalled.`);
        } catch (uninstallError) {
            const message = uninstallError instanceof Error ? uninstallError.message : 'The app could not be uninstalled right now.';
            setError(message);
            setPendingUninstall(null);
        } finally {
            setUninstallingAppId(null);
        }
    };

    if (installedApps.length === 0) {
        return (
            <>
                {notice && (
                    <div className="marketplace-toast marketplace-toast--success" role="status">
                        <span>{notice}</span>
                    </div>
                )}
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <Package size={32} aria-hidden="true" />
                    </div>
                    <h3>No apps installed</h3>
                    <p>Browse our marketplace to find apps that can help grow your store.</p>
                    <Link href="/" className="dev-portal-cta empty-state-action">
                        Browse Apps
                    </Link>
                </div>
            </>
        );
    }

    return (
        <>
            {notice && (
                <div className="marketplace-toast marketplace-toast--success" role="status">
                    <span>{notice}</span>
                </div>
            )}
            {error && (
                <div className="marketplace-banner marketplace-banner--critical" role="alert">
                    <strong>Could not uninstall</strong>
                    <span>{error}</span>
                </div>
            )}
            <div className="my-apps-grid">
                {installedApps.map((installation) => {
                    const appName = getInstalledAppName(installation);
                    const iconUrl = getInstalledAppIcon(installation);
                    const launchUrl = getInstalledAppLaunchUrl(installation);
                    return (
                        <div key={installation.id} className="installed-app-card">
                            <div className="installed-app-icon">
                                {iconUrl ? (
                                    <img src={iconUrl} alt={appName} />
                                ) : (
                                    <div className="installed-app-initial">
                                        {appName.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <div className="installed-app-info">
                                <div className="installed-app-name">{appName}</div>
                                <div className="installed-app-status">
                                    {installation.status === 'active' ? 'Active' : installation.status || 'Active'}
                                </div>
                            </div>
                            <div className="installed-app-actions">
                                {launchUrl ? (
                                    <a className="installed-app-btn" href={launchUrl} target="_blank" rel="noreferrer" aria-label={`Open ${appName} settings`}>
                                        <Settings size={14} aria-hidden="true" />
                                    </a>
                                ) : (
                                    <button className="installed-app-btn" type="button" disabled aria-label={`${appName} settings unavailable`}>
                                        <Settings size={14} aria-hidden="true" />
                                    </button>
                                )}
                                <button
                                    className="installed-app-btn danger"
                                    type="button"
                                    onClick={() => {
                                        setPendingUninstall(installation);
                                        setError(null);
                                    }}
                                    disabled={uninstallingAppId === installation.app_id}
                                    aria-label={`Uninstall ${appName}`}
                                >
                                    <Trash2 size={14} aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <ConfirmDialog
                open={Boolean(pendingUninstall)}
                title={`Uninstall ${pendingUninstall ? getInstalledAppName(pendingUninstall) : 'app'}?`}
                description="Data-loss note: this removes app access, embedded surfaces, webhooks, and app-managed configuration from your store. App-owned data may stop syncing or become unavailable after uninstall."
                confirmLabel={uninstallingAppId ? 'Uninstalling...' : 'Uninstall app'}
                cancelLabel="Keep app"
                destructive
                onConfirm={() => { void confirmUninstall(); }}
                onClose={() => {
                    if (uninstallingAppId) return;
                    setPendingUninstall(null);
                    setError(null);
                }}
            />
        </>
    );
}
