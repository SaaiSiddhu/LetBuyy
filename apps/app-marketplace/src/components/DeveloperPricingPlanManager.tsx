'use client';

import { useMemo, useState } from 'react';
import { Button, Input, Plus, Select, Textarea, Trash2 } from '@letbuyy/ui';
import { formatInrCurrency } from '@letbuyy/ui/formatting';
import type { AppPricingPlan, MarketplaceAppPricingModel } from '@letbuyy/shared-types';

interface DeveloperPricingPlanManagerProps {
    appId: string;
    initialPlans: AppPricingPlan[];
}

interface PlanResponse {
    data?: AppPricingPlan;
    error?: { message?: string };
}

function slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 120) || 'plan';
}

function planAmount(plan: AppPricingPlan): string {
    const amount = formatInrCurrency(Number(plan.amount_minor || plan.usage_unit_amount_minor || 0) / 100, {
        maximumFractionDigits: 0,
        requirePositive: true,
    });
    if (!amount) return 'Free';
    const suffix = plan.interval === 'monthly' ? '/mo' : plan.interval === 'yearly' ? '/yr' : '';
    return `${amount}${suffix}`;
}

function planBillingMode(pricingModel: MarketplaceAppPricingModel): 'recurring' | 'one_time' | 'usage' | null {
    if (pricingModel === 'recurring') return 'recurring';
    if (pricingModel === 'one_time') return 'one_time';
    if (pricingModel === 'usage') return 'usage';
    return null;
}

export function DeveloperPricingPlanManager({ appId, initialPlans }: DeveloperPricingPlanManagerProps) {
    const [plans, setPlans] = useState(initialPlans.filter((plan) => plan.status !== 'archived'));
    const [name, setName] = useState('');
    const [pricingModel, setPricingModel] = useState<MarketplaceAppPricingModel>('recurring');
    const [amountRupees, setAmountRupees] = useState('');
    const [interval, setInterval] = useState<'none' | 'monthly' | 'yearly'>('monthly');
    const [trialDays, setTrialDays] = useState('');
    const [features, setFeatures] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sortedPlans = useMemo(
        () => [...plans].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
        [plans],
    );

    const createPlan = async () => {
        if (!name.trim() || saving) return;
        setSaving(true);
        setError(null);

        try {
            const amountMinor = Math.max(0, Math.round(Number(amountRupees || 0) * 100));
            const response = await fetch('/api/developers/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_pricing_plan',
                    app_id: appId,
                    plan: {
                        plan_slug: slugify(name),
                        name,
                        pricing_model: pricingModel,
                        billing_mode: planBillingMode(pricingModel),
                        amount_minor: amountMinor,
                        interval: pricingModel === 'recurring' || pricingModel === 'usage' ? interval : 'none',
                        trial_days: Math.max(0, Math.round(Number(trialDays || 0))),
                        features: features.split('\n').map((item) => item.trim()).filter(Boolean),
                        is_default: plans.length === 0,
                        status: 'active',
                        sort_order: plans.length * 10,
                    },
                }),
            });
            const payload = await response.json().catch(() => null) as PlanResponse | null;
            if (!response.ok || !payload?.data) {
                throw new Error(payload?.error?.message || 'Pricing plan could not be created.');
            }
            setPlans((current) => [...current, payload.data as AppPricingPlan]);
            setName('');
            setAmountRupees('');
            setTrialDays('');
            setFeatures('');
        } catch (planError) {
            setError(planError instanceof Error ? planError.message : 'Pricing plan could not be created.');
        } finally {
            setSaving(false);
        }
    };

    const archivePlan = async (planId: string) => {
        if (saving) return;
        setSaving(true);
        setError(null);
        try {
            const response = await fetch('/api/developers/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'archive_pricing_plan', app_id: appId, plan_id: planId }),
            });
            const payload = await response.json().catch(() => null) as PlanResponse | null;
            if (!response.ok) {
                throw new Error(payload?.error?.message || 'Pricing plan could not be archived.');
            }
            setPlans((current) => current.filter((plan) => plan.id !== planId));
        } catch (planError) {
            setError(planError instanceof Error ? planError.message : 'Pricing plan could not be archived.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="developer-plan-manager">
            <div className="developer-plan-manager__list">
                {sortedPlans.length === 0 ? (
                    <span className="marketplace-panel-copy">No pricing plans yet.</span>
                ) : (
                    sortedPlans.map((plan) => (
                        <div key={plan.id} className="developer-plan-pill">
                            <div>
                                <strong>{plan.name}</strong>
                                <span>{planAmount(plan)} · {String(plan.pricing_model).replace(/_/g, ' ')}</span>
                            </div>
                            {plan.is_default && <span className="marketplace-badge marketplace-badge--success">Default</span>}
                            <Button
                                unstyled
                                className="installed-app-btn danger"
                                type="button"
                                onClick={() => { void archivePlan(plan.id); }}
                                disabled={saving}
                                aria-label={`Archive ${plan.name}`}
                            >
                                <Trash2 size={13} aria-hidden="true" />
                            </Button>
                        </div>
                    ))
                )}
            </div>
            <div className="developer-plan-manager__form">
                <Input unstyled className="form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Plan name" />
                <Select
                    unstyled
                    className="form-select"
                    value={pricingModel}
                    onChange={(event) => setPricingModel(event.target.value as MarketplaceAppPricingModel)}
                    options={[
                        { label: 'Free', value: 'free' },
                        { label: 'Freemium', value: 'freemium' },
                        { label: 'Recurring', value: 'recurring' },
                        { label: 'One-time', value: 'one_time' },
                        { label: 'Usage', value: 'usage' },
                    ]}
                />
                <Input unstyled className="form-input" value={amountRupees} onChange={(event) => setAmountRupees(event.target.value)} placeholder="Amount INR" inputMode="decimal" />
                <Select
                    unstyled
                    className="form-select"
                    value={interval}
                    onChange={(event) => setInterval(event.target.value as 'none' | 'monthly' | 'yearly')}
                    options={[
                        { label: 'No interval', value: 'none' },
                        { label: 'Monthly', value: 'monthly' },
                        { label: 'Yearly', value: 'yearly' },
                    ]}
                />
                <Input unstyled className="form-input" value={trialDays} onChange={(event) => setTrialDays(event.target.value)} placeholder="Trial days" inputMode="numeric" />
                <Textarea unstyled className="form-textarea" value={features} onChange={(event) => setFeatures(event.target.value)} placeholder="Features, one per line" rows={2} />
                <Button unstyled className="dashboard-link-button" type="button" onClick={() => { void createPlan(); }} disabled={saving || !name.trim()}>
                    <Plus size={13} aria-hidden="true" />
                    Add plan
                </Button>
            </div>
            {error && <p className="billing-charge-panel__error" role="alert">{error}</p>}
        </div>
    );
}
