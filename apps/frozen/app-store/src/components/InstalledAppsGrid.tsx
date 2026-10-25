'use client';

import { useRef, useState } from 'react';
import { Activity, Button, ConfirmDialog, ExternalLink, Loader2, Package, Settings, ShieldCheck, Trash2 } from '@letbuyy/ui';
import type { AppActivityEvent, InstalledApp } from '@letbuyy/shared-types';
import Link from 'next/link';
import Image from 'next/image';
import { ExtensionConfigPanel } from '@/components/ExtensionConfigPanel';
import { ReviewComposer } from '@/components/ReviewComposer';
import { AppBillingChargePanel } from '@/components/AppBillingChargePanel';
import { AppSpendControlPanel } from '@/components/AppSpendControlPanel';
import { formatScopeLabel } from '@/lib/marketplace-display';

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

interface EmbedSessionResponse {
    data?: {
        embed?: { title?: string; url?: string };
        bridge?: { expires_at?: string; scopes?: string[] };
        bridge_probe?: { ok?: boolean; status?: number; error?: string | null } | null;
    };
    error?: { message?: string };
}

function EmbeddedLaunchButton({ appId, installation }: { appId: string; installation: InstalledApp }) {
    const [session, setSession] = useState<EmbedSessionResponse['data'] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fallbackUrl = getInstalledAppLaunchUrl(installation);

    const launch = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/apps/${appId}/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'embed_session',
                    installation_id: installation.id,
                    store_id: installation.store_id,
                }),
            });
            const payload = await response.json().catch(() => null) as EmbedSessionResponse | null;
            if (!response.ok) throw new Error(payload?.error?.message || 'Embedded launch is unavailable for this app.');
            setSession(payload?.data || null);
        } catch (launchError) {
            setError(launchError instanceof Error ? launchError.message : 'Embedded launch is unavailable for this app.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="embedded-launch-panel">
            <Button
                unstyled
                className="installed-app-btn"
                type="button"
                onClick={() => { void launch(); }}
                disabled={loading}
                aria-label={`Open ${getInstalledAppName(installation)} embedded app`}
            >
                {loading ? <Loader2 size={14} aria-hidden="true" /> : <Settings size={14} aria-hidden="true" />}
            </Button>
            {error && fallbackUrl ? (
                <a className="installed-app-btn" href={fallbackUrl} target="_blank" rel="noreferrer" aria-label={`Open ${getInstalledAppName(installation)} settings`}>
                    <ExternalLink size={14} aria-hidden="true" />
                </a>
            ) : null}
            {error && (
                <div className="marketplace-banner marketplace-banner--warning">
                    <strong>Embedded launch unavailable</strong>
                    <span>{error}</span>
                </div>
            )}
            {session?.embed?.url && (
                <div className="embedded-launch-frame">
                    <div className="embedded-launch-frame__header">
                        <strong>{session.embed.title || getInstalledAppName(installation)}</strong>
                        <a href={session.embed.url} target="_blank" rel="noreferrer">
                            Open
                            <ExternalLink size={13} aria-hidden="true" />
                        </a>
                    </div>
                    <iframe title={`${getInstalledAppName(installation)} embedded app`} src={session.embed.url} loading="lazy" sandbox="allow-forms allow-popups allow-scripts" />
                    <p>
                        Bridge session expires {session.bridge?.expires_at ? new Date(session.bridge.expires_at).toLocaleTimeString() : 'soon'}.
                        {session.bridge_probe ? ` API probe: ${session.bridge_probe.ok ? 'ready' : 'blocked'}.` : ''}
                    </p>
                </div>
            )}
        </div>
    );
}

function InstalledAppScopePanel({
    appId,
    installation,
    onScopesChanged,
}: {
    appId: string;
    installation: InstalledApp;
    onScopesChanged: (installation: InstalledApp) => void;
}) {
    const scopes = Array.isArray(installation.scopes_granted) ? installation.scopes_granted : [];
    const [revokingScope, setRevokingScope] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const revokeScope = async (scope: string) => {
        setRevokingScope(scope);
        setError(null);
        try {
            const response = await fetch(`/api/apps/${appId}/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'revoke_scope',
                    installation_id: installation.id,
                    store_id: installation.store_id,
                    scope,
                }),
            });
            const payload = await response.json().catch(() => null) as { data?: InstalledApp; error?: { message?: string } } | null;
            if (!response.ok || !payload?.data) throw new Error(payload?.error?.message || 'Scope could not be revoked.');
            onScopesChanged(payload.data);
        } catch (scopeError) {
            setError(scopeError instanceof Error ? scopeError.message : 'Scope could not be revoked.');
        } finally {
            setRevokingScope(null);
        }
    };

    return (
        <div className="installed-scope-panel">
            <div className="installed-scope-panel__header">
                <ShieldCheck size={15} aria-hidden="true" />
                <strong>Granted scopes</strong>
            </div>
            {scopes.length === 0 ? (
                <p>This installation has no API scopes.</p>
            ) : (
                <div className="installed-scope-list">
                    {scopes.map((scope) => (
                        <div key={scope} className="installed-scope-row">
                            <span>
                                <strong>{formatScopeLabel(scope)}</strong>
                                <code>{scope}</code>
                            </span>
                            <Button
                                unstyled
                                type="button"
                                className="marketplace-inline-action"
                                onClick={() => { void revokeScope(scope); }}
                                disabled={Boolean(revokingScope)}
                            >
                                {revokingScope === scope ? 'Revoking...' : 'Revoke'}
                            </Button>
                        </div>
                    ))}
                </div>
            )}
            {error && (
                <div className="marketplace-banner marketplace-banner--critical" role="alert">
                    <strong>Scope update failed</strong>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}

function PostInstallChecklist({ installation }: { installation: InstalledApp }) {
    const scopes = Array.isArray(installation.scopes_granted) ? installation.scopes_granted : [];
    const hasLaunchTarget = Boolean(getInstalledAppLaunchUrl(installation));
    const items = [
        { label: 'Review granted scopes', complete: scopes.length >= 0 },
        { label: 'Configure extensions and functions', complete: installation.status === 'active' },
        { label: 'Open embedded app setup', complete: hasLaunchTarget },
        { label: 'Review billing and spend controls', complete: installation.status === 'active' },
    ];

    return (
        <div className="post-install-checklist" aria-label={`${getInstalledAppName(installation)} setup checklist`}>
            <strong>Setup checklist</strong>
            <div className="post-install-checklist__items">
                {items.map((item) => (
                    <span key={item.label} className={item.complete ? 'complete' : undefined}>
                        {item.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

function InstalledAppActivityPanel({ installation }: { installation: InstalledApp }) {
    const [events, setEvents] = useState<AppActivityEvent[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadActivity = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/apps/${installation.app_id}/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'activity',
                    installation_id: installation.id,
                    store_id: installation.store_id,
                }),
            });
            const payload = await response.json().catch(() => null) as { data?: { events?: AppActivityEvent[] }; error?: { message?: string } } | null;
            if (!response.ok) throw new Error(payload?.error?.message || 'Activity could not be loaded.');
            setEvents(payload?.data?.events || []);
        } catch (activityError) {
            setError(activityError instanceof Error ? activityError.message : 'Activity could not be loaded.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="installed-activity-panel">
            <div className="installed-activity-panel__header">
                <Activity size={15} aria-hidden="true" />
                <strong>Activity</strong>
                <Button
                    unstyled
                    type="button"
                    className="marketplace-inline-action"
                    onClick={() => { void loadActivity(); }}
                    disabled={loading}
                >
                    {loading ? 'Loading...' : events ? 'Refresh' : 'Load'}
                </Button>
            </div>
            {events && events.length > 0 && (
                <ul className="installed-activity-list">
                    {events.slice(0, 5).map((event) => (
                        <li key={event.id}>
                            <span>{event.summary}</span>
                            {event.created_at && <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleDateString()}</time>}
                        </li>
                    ))}
                </ul>
            )}
            {events && events.length === 0 && <p>No activity events have been recorded yet.</p>}
            {error && (
                <div className="marketplace-banner marketplace-banner--critical" role="alert">
                    <strong>Activity unavailable</strong>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}

export function InstalledAppsGrid({ installations }: InstalledAppsGridProps) {
    const uninstallIntent = useRef<{ fingerprint: string; key: string } | null>(null);
    const [installedApps, setInstalledApps] = useState(installations);
    const [pendingUninstall, setPendingUninstall] = useState<InstalledApp | null>(null);
    const [uninstallReason, setUninstallReason] = useState('');
    const [uninstallingAppId, setUninstallingAppId] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const confirmUninstall = async () => {
        if (!pendingUninstall || uninstallingAppId) return;

        setUninstallingAppId(pendingUninstall.app_id);
        setNotice(null);
        setError(null);

        try {
            const fingerprint = JSON.stringify([pendingUninstall.id, uninstallReason.trim()]);
            if (uninstallIntent.current?.fingerprint !== fingerprint) {
                uninstallIntent.current = { fingerprint, key: crypto.randomUUID() };
            }
            const response = await fetch(`/api/apps/${pendingUninstall.app_id}/install?store_id=${encodeURIComponent(pendingUninstall.store_id)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': uninstallIntent.current.key },
                body: JSON.stringify({
                    reason_code: uninstallReason.trim() ? 'merchant_feedback' : undefined,
                    reason_text: uninstallReason.trim() || undefined,
                }),
            });
            const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;

            if (!response.ok) {
                throw new Error(payload?.error?.message || 'The app could not be uninstalled right now.');
            }

            const appName = getInstalledAppName(pendingUninstall);
            setInstalledApps((current) => current.filter((installation) => installation.id !== pendingUninstall.id));
            setPendingUninstall(null);
            setUninstallReason('');
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
            <AppSpendControlPanel appId={installedApps[0]?.app_id || null} storeId={installedApps[0]?.store_id || null} />
            <div className="my-apps-grid">
                {installedApps.map((installation) => {
                    const appName = getInstalledAppName(installation);
                    const iconUrl = getInstalledAppIcon(installation);
                    return (
                        <div key={installation.id} className="installed-app-card">
                            <div className="installed-app-icon">
                                {iconUrl ? (
                                    <Image src={iconUrl} alt={appName} width={96} height={96} sizes="48px" />
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
                                <ExtensionConfigPanel appId={installation.app_id} installationId={installation.id} storeId={installation.store_id} />
                                <EmbeddedLaunchButton appId={installation.app_id} installation={installation} />
                                <Button
                                    unstyled
                                    className="installed-app-btn danger"
                                    type="button"
                                    onClick={() => {
                                        setPendingUninstall(installation);
                                        setUninstallReason('');
                                        setError(null);
                                    }}
                                    disabled={uninstallingAppId === installation.app_id}
                                    aria-label={`Uninstall ${appName}`}
                                >
                                    <Trash2 size={14} aria-hidden="true" />
                                </Button>
                            </div>
                            {installation.status === 'active' && (
                                <div className="installed-app-panel-row">
                                    <PostInstallChecklist installation={installation} />
                                    <InstalledAppScopePanel
                                        appId={installation.app_id}
                                        installation={installation}
                                        onScopesChanged={(updated) => {
                                            setInstalledApps((current) => current.map((item) => item.id === updated.id ? updated : item));
                                        }}
                                    />
                                    <AppBillingChargePanel installation={installation} appName={appName} />
                                    <ReviewComposer appId={installation.app_id} appName={appName} />
                                    <InstalledAppActivityPanel installation={installation} />
                                </div>
                            )}
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
                setUninstallReason('');
                setError(null);
            }}
            >
                <label className="uninstall-feedback-field">
                    Reason (optional)
                    <textarea
                        className="form-textarea"
                        value={uninstallReason}
                        onChange={(event) => setUninstallReason(event.target.value)}
                        maxLength={1000}
                        rows={3}
                        placeholder="Share what did not work for this app"
                    />
                </label>
            </ConfirmDialog>
        </>
    );
}
