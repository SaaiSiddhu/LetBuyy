'use client';

import { useMemo, useState } from 'react';
import {
    CheckCircle2,
    ExternalLink,
    Lock,
    Loader2,
    Modal,
    ShieldCheck,
} from '@letbuyy/ui';
import { formatScopeLabel } from '@/lib/marketplace-display';

interface AppInstallConsentPanelProps {
    appId: string;
    appName: string;
    priceLabel: string;
    priceDetail: string;
    scopes: string[];
    launchUrl?: string | null;
    privacyUrl?: string | null;
    termsUrl?: string | null;
}

type InstallMode = 'ready' | 'installing' | 'installed';

interface InstallResponse {
    data?: {
        installation?: {
            id?: string;
        };
    };
    error?: {
        message?: string;
    };
}

function getErrorMessage(payload: InstallResponse | null, status: number): string {
    if (payload?.error?.message) return payload.error.message;
    if (status === 401) return 'Sign in to a merchant account before installing this app.';
    if (status === 403) return 'Your account does not have permission to install this app.';
    return 'The app could not be installed right now.';
}

function AppInstallConsentPanelInner({
    appId,
    appName,
    priceLabel,
    priceDetail,
    scopes,
    launchUrl,
    privacyUrl,
    termsUrl,
}: AppInstallConsentPanelProps) {
    const [mode, setMode] = useState<InstallMode>('ready');
    const [consentOpen, setConsentOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [installationId, setInstallationId] = useState<string | null>(null);
    const permissionLabels = useMemo(() => scopes.map(formatScopeLabel), [scopes]);
    const canLaunch = Boolean(launchUrl);

    const installApp = async () => {
        setMode('installing');
        setError(null);
        setNotice(null);

        try {
            const response = await fetch(`/api/apps/${appId}/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scopes }),
            });
            const payload = await response.json().catch(() => null) as InstallResponse | null;

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, response.status));
            }

            setInstallationId(payload?.data?.installation?.id || null);
            setMode('installed');
            setConsentOpen(false);
            setNotice(canLaunch ? 'The app is ready to launch.' : 'Open My Apps to manage this installation.');
        } catch (installError) {
            const message = installError instanceof Error ? installError.message : 'The app could not be installed right now.';
            setError(message);
            setMode('ready');
            setConsentOpen(true);
        }
    };

    const closeConsent = () => {
        if (mode === 'installing') return;
        setConsentOpen(false);
        setError(null);
    };

    if (mode === 'installed') {
        return (
            <div className="app-install-panel app-install-panel--installed">
                <div className="app-install-success">
                    <CheckCircle2 size={22} aria-hidden="true" />
                    <div>
                        <h3>{appName} is installed</h3>
                        <p>
                            {installationId
                                ? `Installation ${installationId.slice(0, 8)} is active.`
                                : 'The app is active on your store.'}
                        </p>
                    </div>
                </div>
                {canLaunch ? (
                    <div className="app-install-launch">
                        <div className="app-install-launch__header">
                            <span>Embedded launch</span>
                            <a href={launchUrl || '#'} target="_blank" rel="noreferrer">
                                Open full screen
                                <ExternalLink size={13} aria-hidden="true" />
                            </a>
                        </div>
                        <iframe
                            title={`${appName} embedded launch`}
                            src={launchUrl || undefined}
                            loading="lazy"
                            sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
                        />
                    </div>
                ) : (
                    <div className="marketplace-banner marketplace-banner--warning">
                        <strong>Launch target unavailable</strong>
                        <span>This app installed successfully, but the listing does not expose a direct app URL yet.</span>
                    </div>
                )}
                {notice && (
                    <div className="marketplace-toast marketplace-toast--success" role="status">
                        <CheckCircle2 size={16} aria-hidden="true" />
                        <span>{notice}</span>
                    </div>
                )}
                <a className="app-install-secondary-link" href="/my-apps">
                    Manage installed apps
                </a>
            </div>
        );
    }

    return (
        <div className="app-install-panel">
            <div className="app-install-price">
                <span>{priceLabel}</span>
                <p>{priceDetail}</p>
            </div>
            <div className="app-install-scope-summary">
                <ShieldCheck size={15} aria-hidden="true" />
                <span>
                    {scopes.length > 0
                        ? `${scopes.length} declared permission${scopes.length === 1 ? '' : 's'} will be reviewed before install.`
                        : 'No API permissions requested.'}
                </span>
            </div>
            <button className="app-install-primary-button" type="button" onClick={() => setConsentOpen(true)}>
                <ShieldCheck size={16} aria-hidden="true" />
                Review access and install
            </button>
            <Modal
                open={consentOpen}
                title={`Approve ${appName} access`}
                description="LetBuyy will send only these declared permissions to the app install endpoint."
                onClose={closeConsent}
                footer={(
                    <>
                        <button
                            type="button"
                            className="app-install-secondary-button"
                            onClick={closeConsent}
                            disabled={mode === 'installing'}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="app-install-primary-button"
                            onClick={installApp}
                            disabled={mode === 'installing'}
                        >
                            {mode === 'installing' && <Loader2 size={15} className="app-install-spinner" aria-hidden="true" />}
                            Grant access and install
                        </button>
                    </>
                )}
            >
                <div className="app-install-consent">
                    <div className="app-install-consent__heading">
                        <Lock size={16} aria-hidden="true" />
                        <div>
                            <h3>Permissions requested</h3>
                            <p>Review the exact scope names before granting access to your store.</p>
                        </div>
                    </div>
                    <ul className="app-install-permission-list">
                        {permissionLabels.length > 0 ? (
                            scopes.map((scope, index) => (
                                <li key={scope}>
                                    <ShieldCheck size={14} aria-hidden="true" />
                                    <span>
                                        {permissionLabels[index]}
                                        <code>{scope}</code>
                                    </span>
                                </li>
                            ))
                        ) : (
                            <li>
                                <ShieldCheck size={14} aria-hidden="true" />
                                <span>No API permissions requested</span>
                            </li>
                        )}
                    </ul>
                    {(privacyUrl || termsUrl) && (
                        <div className="app-install-policy-links">
                            {privacyUrl && <a href={privacyUrl} target="_blank" rel="noreferrer">Privacy policy</a>}
                            {termsUrl && <a href={termsUrl} target="_blank" rel="noreferrer">Terms</a>}
                        </div>
                    )}
                    {error && (
                        <div className="marketplace-banner marketplace-banner--critical" role="alert">
                            <strong>Could not install</strong>
                            <span>{error}</span>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}

export function AppInstallConsentPanel(props: AppInstallConsentPanelProps) {
    return <AppInstallConsentPanelInner {...props} />;
}
