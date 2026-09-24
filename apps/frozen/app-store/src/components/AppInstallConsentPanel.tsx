'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Button,
    CheckCircle2,
    ExternalLink,
    Input,
    Lock,
    Loader2,
    Modal,
    ShieldCheck,
} from '@letbuyy/ui';
import { formatScopeLabel } from '@/lib/marketplace-display';
import { recordMarketplaceEvent } from '@/lib/telemetry';
import { formatInrCurrency } from '@letbuyy/ui/formatting';
import type { AppPricingPlan } from '@letbuyy/shared-types';

interface AppInstallConsentPanelProps {
    appId: string;
    appName: string;
    priceLabel: string;
    priceDetail: string;
    scopes: string[];
    pricingPlans?: AppPricingPlan[];
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
        authorization?: {
            installation_id?: string;
        };
        token?: {
            expires_at?: string | null;
        } | null;
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

function planPriceDetail(plan: AppPricingPlan): string {
    const amount = formatInrCurrency(Number(plan.amount_minor || plan.usage_unit_amount_minor || 0) / 100, {
        maximumFractionDigits: 0,
        requirePositive: true,
    });
    const interval = plan.interval === 'monthly' ? '/mo' : plan.interval === 'yearly' ? '/yr' : '';
    const trial = typeof plan.trial_days === 'number' && plan.trial_days > 0 ? ` · ${plan.trial_days}-day trial` : '';
    const usage = plan.pricing_model === 'usage' && plan.usage_unit ? ` per ${plan.usage_unit}` : '';
    return amount ? `${amount}${interval}${usage}${trial}` : `Free${trial}`;
}

function defaultPricingPlan(plans: AppPricingPlan[]): AppPricingPlan | null {
    return plans.find((plan) => plan.is_default) || plans[0] || null;
}

function AppInstallConsentPanelInner({
    appId,
    appName,
    priceLabel,
    priceDetail,
    scopes,
    pricingPlans = [],
    launchUrl,
    privacyUrl,
    termsUrl,
}: AppInstallConsentPanelProps) {
    const activePlans = useMemo(() => pricingPlans.filter((plan) => plan.status === 'active'), [pricingPlans]);
    const initialPlan = useMemo(() => defaultPricingPlan(activePlans), [activePlans]);
    const [mode, setMode] = useState<InstallMode>('ready');
    const [consentOpen, setConsentOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [installationId, setInstallationId] = useState<string | null>(null);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(initialPlan?.id || null);
    const embedUrl: string | null = null;
    const launchRef = useRef<HTMLDivElement>(null);
    const permissionLabels = useMemo(() => scopes.map(formatScopeLabel), [scopes]);
    const selectedPlan = useMemo(
        () => activePlans.find((plan) => plan.id === selectedPlanId) || initialPlan,
        [activePlans, initialPlan, selectedPlanId],
    );
    const installPriceLabel = selectedPlan ? selectedPlan.name : priceLabel;
    const installPriceDetail = selectedPlan ? planPriceDetail(selectedPlan) : priceDetail;
    const canLaunch = Boolean(embedUrl || launchUrl);

    useEffect(() => {
        if (mode !== 'installed' || !canLaunch) return;

        const timer = window.setTimeout(() => {
            launchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            launchRef.current?.focus({ preventScroll: true });
        }, 100);

        return () => window.clearTimeout(timer);
    }, [canLaunch, mode]);

    const installApp = async () => {
        setMode('installing');
        setError(null);
        setNotice(null);
        recordMarketplaceEvent('install_started', { appId, scopes });

        try {
            const response = await fetch(`/api/apps/${appId}/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'oauth_install',
                    scopes,
                    pricing_plan_id: selectedPlan?.id || undefined,
                    redirect_uri: launchUrl || undefined,
                }),
            });
            const payload = await response.json().catch(() => null) as InstallResponse | null;

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, response.status));
            }

            const nextInstallationId = payload?.data?.installation?.id || payload?.data?.authorization?.installation_id || null;
            setInstallationId(nextInstallationId);
            setMode('installed');
            setConsentOpen(false);
            setNotice(nextInstallationId ? 'OAuth install completed. Open My Apps for setup, scopes, and billing actions.' : 'Open My Apps to manage this installation.');
            recordMarketplaceEvent('install_completed', { appId, installationId: nextInstallationId, oauth: true });
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
                    <div
                        ref={launchRef}
                        className="app-install-launch"
                        tabIndex={-1}
                        aria-label={`${appName} embedded app view`}
                    >
                        <div className="app-install-launch__header">
                            <span>Embedded launch</span>
                            <a href={embedUrl || launchUrl || '#'} target="_blank" rel="noreferrer">
                                Open full screen
                                <ExternalLink size={13} aria-hidden="true" />
                            </a>
                        </div>
                        <iframe
                            title={`${appName} embedded launch`}
                            src={embedUrl || launchUrl || undefined}
                            loading="lazy"
                            sandbox="allow-forms allow-popups allow-scripts"
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
                <span>{installPriceLabel}</span>
                <p>{installPriceDetail}</p>
            </div>
            {activePlans.length > 0 && (
                <div className="app-install-plan-selector" role="radiogroup" aria-label={`${appName} pricing plans`}>
                    {activePlans.map((plan) => (
                        <label key={plan.id} className="app-install-plan-option">
                            <Input
                                unstyled
                                type="radio"
                                name={`pricing-plan-${appId}`}
                                value={plan.id}
                                checked={(selectedPlan?.id || '') === plan.id}
                                onChange={() => setSelectedPlanId(plan.id)}
                            />
                            <span>
                                <strong>{plan.name}</strong>
                                <small>{planPriceDetail(plan)}</small>
                            </span>
                        </label>
                    ))}
                </div>
            )}
            <div className="app-install-scope-summary">
                <ShieldCheck size={15} aria-hidden="true" />
                <span>
                    {scopes.length > 0
                        ? `${scopes.length} declared permission${scopes.length === 1 ? '' : 's'} will be reviewed before install.`
                        : 'No API permissions requested.'}
                </span>
            </div>
            <Button
                unstyled
                className="app-install-primary-button"
                type="button"
                onClick={() => {
                    recordMarketplaceEvent('install_consent_opened', { appId });
                    setConsentOpen(true);
                }}
            >
                <ShieldCheck size={16} aria-hidden="true" />
                Review access and install
            </Button>
            <Modal
                open={consentOpen}
                title={`Approve ${appName} access`}
                description="LetBuyy will send only these declared permissions to the app install endpoint."
                onClose={closeConsent}
                footer={(
                    <>
                        <Button
                            unstyled
                            type="button"
                            className="app-install-secondary-button"
                            onClick={closeConsent}
                            disabled={mode === 'installing'}
                        >
                            Cancel
                        </Button>
                        <Button
                            unstyled
                            type="button"
                            className="app-install-primary-button"
                            onClick={installApp}
                            disabled={mode === 'installing'}
                        >
                            {mode === 'installing' && <Loader2 size={15} className="app-install-spinner" aria-hidden="true" />}
                            Grant access and install
                        </Button>
                    </>
                )}
            >
                <div className="app-install-consent">
                    <div className="app-install-consent__heading">
                        <Lock size={16} aria-hidden="true" />
                        <div>
                            <h3>Permissions, store, and billing</h3>
                            <p>Review requested scopes, target store context, and billing terms before granting access.</p>
                        </div>
                    </div>
                    <div className="marketplace-banner marketplace-banner--info">
                        <strong>Target store</strong>
                        <span>The app will be installed to the store attached to your signed-in merchant session.</span>
                    </div>
                    <div className="marketplace-banner marketplace-banner--info">
                        <strong>{installPriceLabel}</strong>
                        <span>{installPriceDetail}. Paid charges require merchant billing approval before activation.</span>
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
