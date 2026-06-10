'use client';

import { useMemo, useState } from 'react';
import { Button, CheckCircle2, CreditCard, Loader2, XCircle } from '@letbuyy/ui';
import { formatInrCurrency } from '@letbuyy/ui/formatting';
import type { AppBillingCharge, AppBillingChargeResult, AppBillingChargeMode, AppPricingPlan, InstalledApp } from '@letbuyy/shared-types';

type BillingApp = NonNullable<InstalledApp['marketplace_apps']> & {
    price_inr?: number | string | null;
    price_monthly?: number | string | null;
    price_yearly?: number | string | null;
};

interface AppBillingChargePanelProps {
    installation: InstalledApp;
    appName: string;
}

function numberValue(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function selectedPricingPlan(installation: InstalledApp): AppPricingPlan | null {
    const config = installation.config as { billing?: { selected_plan_snapshot?: AppPricingPlan } } | null;
    const plan = config?.billing?.selected_plan_snapshot;
    return plan?.id && plan?.name ? plan : null;
}

function chargePlanForInstallation(installation: InstalledApp): {
    billingMode: AppBillingChargeMode;
    amountMajor: number;
    amountMinor: number;
    label: string;
    pricingPlanId?: string;
    trialDays?: number;
} | null {
    const selectedPlan = selectedPricingPlan(installation);
    if (selectedPlan) {
        const amountMinor = Number(selectedPlan.amount_minor || selectedPlan.usage_unit_amount_minor || 0);
        const billingMode = selectedPlan.billing_mode === 'one_time' || selectedPlan.billing_mode === 'usage'
            ? selectedPlan.billing_mode
            : 'recurring';
        if (amountMinor > 0) {
            return {
                billingMode,
                amountMajor: amountMinor / 100,
                amountMinor,
                label: selectedPlan.name,
                pricingPlanId: selectedPlan.id,
                trialDays: typeof selectedPlan.trial_days === 'number' ? selectedPlan.trial_days : 0,
            };
        }
        return null;
    }

    const app = installation.marketplace_apps as BillingApp | null | undefined;
    const pricingModel = String(app?.pricing_model || 'free');

    if (pricingModel === 'free' || pricingModel === 'freemium') return null;

    const monthly = numberValue(app?.price_monthly);
    const yearly = numberValue(app?.price_yearly);
    const oneTime = numberValue(app?.price_inr);

    if (pricingModel === 'one_time' && oneTime) {
        return {
            billingMode: 'one_time',
            amountMajor: oneTime,
            amountMinor: Math.round(oneTime * 100),
            label: 'One-time charge',
        };
    }

    if (pricingModel === 'usage' && (monthly || oneTime)) {
        const amountMajor = monthly || oneTime || 0;
        return {
            billingMode: 'usage',
            amountMajor,
            amountMinor: Math.round(amountMajor * 100),
            label: 'Usage billing approval',
        };
    }

    const amountMajor = monthly || yearly || oneTime;
    if (!amountMajor) return null;

    return {
        billingMode: 'recurring',
        amountMajor,
        amountMinor: Math.round(amountMajor * 100),
        label: monthly ? 'Monthly charge' : 'Recurring charge',
    };
}

function resultCharge(result: unknown): AppBillingCharge | null {
    const payload = result as { data?: AppBillingChargeResult; charge?: AppBillingCharge } | null;
    return payload?.data?.charge || payload?.charge || null;
}

export function AppBillingChargePanel({ installation, appName }: AppBillingChargePanelProps) {
    const chargePlan = useMemo(() => chargePlanForInstallation(installation), [installation]);
    const [charge, setCharge] = useState<AppBillingCharge | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (!chargePlan) return null;

    const createCharge = async () => {
        if (loading) return;
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const response = await fetch(`/api/apps/${installation.app_id}/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_charge',
                    store_id: installation.store_id,
                    installation_id: installation.id,
                    billing_mode: chargePlan.billingMode,
                    name: `${appName} ${chargePlan.label}`,
                    amount_minor: chargePlan.amountMinor,
                    idempotency_key: `charge-${installation.id}-${chargePlan.billingMode}-${chargePlan.amountMinor}`,
                    metadata: {
                        source: 'merchant_my_apps',
                        listing_pricing_model: installation.marketplace_apps?.pricing_model || null,
                        pricing_plan_id: chargePlan.pricingPlanId || null,
                        trial_days: chargePlan.trialDays || 0,
                    },
                    pricing_plan_id: chargePlan.pricingPlanId,
                    trial_days: chargePlan.trialDays || 0,
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.error?.message || 'The charge could not be created.');
            }
            const createdCharge = resultCharge(payload);
            setCharge(createdCharge);
            setMessage(createdCharge?.status === 'pending_merchant_approval'
                ? 'Charge terms are ready for merchant approval.'
                : 'Charge terms were loaded.');
        } catch (chargeError) {
            setError(chargeError instanceof Error ? chargeError.message : 'The charge could not be created.');
        } finally {
            setLoading(false);
        }
    };

    const approveCharge = async () => {
        if (!charge || loading) return;
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const response = await fetch(`/api/apps/${installation.app_id}/install`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'approve_charge',
                    store_id: installation.store_id,
                    charge_id: charge.id,
                    provider_mode: 'sandbox',
                    idempotency_key: `approve-${charge.id}`,
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.error?.message || 'The charge could not be approved.');
            }
            const approvedCharge = resultCharge(payload);
            setCharge(approvedCharge || charge);
            setMessage(approvedCharge?.status === 'trialing'
                ? `Trial started. Billing begins after ${approvedCharge.trial_ends_at ? new Date(approvedCharge.trial_ends_at).toLocaleDateString() : 'the trial ends'}.`
                : approvedCharge?.status === 'active'
                ? 'Charge is active and ready for payout settlement.'
                : 'Charge terms are approved. Payment activation waits for provider verification.');
        } catch (approvalError) {
            setError(approvalError instanceof Error ? approvalError.message : 'The charge could not be approved.');
        } finally {
            setLoading(false);
        }
    };

    const cancelCharge = async () => {
        if (!charge || loading) return;
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const response = await fetch(`/api/apps/${installation.app_id}/install`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'cancel_charge',
                    store_id: installation.store_id,
                    charge_id: charge.id,
                    reason: 'merchant_declined_terms',
                    idempotency_key: `cancel-${charge.id}`,
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.error?.message || 'The charge could not be declined.');
            }
            const cancelledCharge = resultCharge(payload);
            setCharge(cancelledCharge || { ...charge, status: 'cancelled' });
            setMessage('Charge terms were declined.');
        } catch (cancelError) {
            setError(cancelError instanceof Error ? cancelError.message : 'The charge could not be declined.');
        } finally {
            setLoading(false);
        }
    };

    const canModifyCharge = Boolean(charge && charge.status !== 'active' && charge.status !== 'trialing' && charge.status !== 'cancelled');

    return (
        <div className="billing-charge-panel installed-app-panel-row">
            <div className="billing-charge-panel__summary">
                <div>
                    <strong>{chargePlan.label}</strong>
                    <span>{formatInrCurrency(chargePlan.amountMajor, { maximumFractionDigits: 0 })}</span>
                    {chargePlan.trialDays ? <small>{chargePlan.trialDays}-day trial</small> : null}
                </div>
                <span className="marketplace-badge marketplace-badge--neutral">
                    {charge?.status ? charge.status.replace(/_/g, ' ') : 'not created'}
                </span>
            </div>
            <div className="billing-charge-panel__actions">
                <Button unstyled className="installed-app-btn billing-charge-panel__button" type="button" onClick={() => { void createCharge(); }} disabled={loading}>
                    {loading && !charge ? <Loader2 size={14} aria-hidden="true" /> : <CreditCard size={14} aria-hidden="true" />}
                    {charge ? 'Refresh charge' : 'Create charge'}
                </Button>
                <Button
                    unstyled
                    className="installed-app-btn billing-charge-panel__button"
                    type="button"
                    onClick={() => { void approveCharge(); }}
                    disabled={loading || !canModifyCharge}
                >
                    {loading && charge ? <Loader2 size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                    Approve terms
                </Button>
                <Button
                    unstyled
                    className="installed-app-btn billing-charge-panel__button"
                    type="button"
                    onClick={() => { void cancelCharge(); }}
                    disabled={loading || !canModifyCharge}
                >
                    {loading && charge ? <Loader2 size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
                    Decline terms
                </Button>
            </div>
            {message && <p className="billing-charge-panel__message" role="status">{message}</p>}
            {error && <p className="billing-charge-panel__error" role="alert">{error}</p>}
        </div>
    );
}
