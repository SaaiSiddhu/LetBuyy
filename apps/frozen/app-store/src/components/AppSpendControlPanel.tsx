'use client';

import { useEffect, useState } from 'react';
import { Button, Checkbox, Input, Loader2, ShieldCheck } from '@letbuyy/ui';
import { formatInrCurrency } from '@letbuyy/ui/formatting';
import type { AppSpendControlResult } from '@letbuyy/shared-types';

interface AppSpendControlPanelProps {
    appId: string | null;
    storeId: string | null;
}

function resultData(payload: unknown): AppSpendControlResult | null {
    const record = payload as { data?: AppSpendControlResult } | null;
    return record?.data || null;
}

function minorToMajor(value: unknown): string {
    const amount = Number(value || 0) / 100;
    return Number.isFinite(amount) && amount > 0 ? String(Math.round(amount)) : '';
}

function majorToMinor(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
}

export function AppSpendControlPanel({ appId, storeId }: AppSpendControlPanelProps) {
    const [result, setResult] = useState<AppSpendControlResult | null>(null);
    const [monthlyCap, setMonthlyCap] = useState('');
    const [alertThreshold, setAlertThreshold] = useState('');
    const [enabled, setEnabled] = useState(true);
    const [alertOnly, setAlertOnly] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!appId || !storeId) return;
        let cancelled = false;
        setLoading(true);
        fetch(`/api/apps/${encodeURIComponent(appId)}/install`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_spend_control', store_id: storeId }),
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => null);
                if (!response.ok) throw new Error(payload?.error?.message || 'Spend controls could not be loaded.');
                return resultData(payload);
            })
            .then((data) => {
                if (cancelled || !data) return;
                setResult(data);
                setMonthlyCap(minorToMajor(data.control?.monthly_cap_minor));
                setAlertThreshold(minorToMajor(data.control?.alert_threshold_minor));
                setEnabled(data.control?.status !== 'disabled');
                setAlertOnly(data.control?.enforcement_mode === 'alert_only');
            })
            .catch((loadError) => {
                if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Spend controls could not be loaded.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [appId, storeId]);

    const save = async () => {
        if (!appId || !storeId || saving) return;
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_spend_control',
                    store_id: storeId,
                    monthly_cap_minor: majorToMinor(monthlyCap),
                    alert_threshold_minor: majorToMinor(alertThreshold),
                    alerts_enabled: true,
                    enforcement_mode: alertOnly ? 'alert_only' : 'block',
                    status: enabled ? 'active' : 'disabled',
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error?.message || 'Spend controls could not be saved.');
            const data = resultData(payload);
            setResult(data);
            setMessage('Spend controls saved.');
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Spend controls could not be saved.');
        } finally {
            setSaving(false);
        }
    };

    if (!appId || !storeId) return null;

    return (
        <section className="app-spend-control-panel marketplace-panel">
            <div className="marketplace-panel-header">
                <div>
                    <h2 className="marketplace-panel-title marketplace-row">
                        <ShieldCheck size={16} aria-hidden="true" />
                        App spend controls
                    </h2>
                    <p className="marketplace-panel-copy">Set a monthly app spend cap for this store.</p>
                </div>
                <span className="marketplace-badge marketplace-badge--neutral">
                    {loading ? 'loading' : formatInrCurrency(Number(result?.spend.current_amount_minor || 0) / 100, { maximumFractionDigits: 0 })}
                </span>
            </div>
            <div className="app-spend-control-grid">
                <label>
                    Monthly cap
                    <Input unstyled className="form-input" value={monthlyCap} onChange={(event) => setMonthlyCap(event.target.value)} inputMode="numeric" placeholder="0" />
                </label>
                <label>
                    Alert at
                    <Input unstyled className="form-input" value={alertThreshold} onChange={(event) => setAlertThreshold(event.target.value)} inputMode="numeric" placeholder="0" />
                </label>
                <Checkbox wrapperClassName="app-spend-control-toggle" label="Enabled" checked={enabled} onCheckedChange={setEnabled} />
                <Checkbox wrapperClassName="app-spend-control-toggle" label="Alert only" checked={alertOnly} onCheckedChange={setAlertOnly} />
            </div>
            <div className="billing-charge-panel__actions">
                <Button unstyled className="installed-app-btn billing-charge-panel__button" type="button" onClick={() => { void save(); }} disabled={saving || loading}>
                    {saving ? <Loader2 size={14} aria-hidden="true" /> : <ShieldCheck size={14} aria-hidden="true" />}
                    Save controls
                </Button>
            </div>
            {message && <p className="billing-charge-panel__message" role="status">{message}</p>}
            {error && <p className="billing-charge-panel__error" role="alert">{error}</p>}
        </section>
    );
}
