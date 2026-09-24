'use client';

import { useState } from 'react';
import { BarChart3, Button, Loader2 } from '@letbuyy/ui';
import { formatInrCurrency } from '@letbuyy/ui/formatting';
import type { AppUsageSummary } from '@letbuyy/shared-types';

interface DeveloperUsageMeterPanelProps {
    appId: string;
}

function resultData(payload: unknown): AppUsageSummary | null {
    const record = payload as { data?: AppUsageSummary } | null;
    return record?.data || null;
}

function formatQuantity(value: unknown): string {
    const quantity = Number(value || 0);
    return Number.isFinite(quantity) ? quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0';
}

export function DeveloperUsageMeterPanel({ appId }: DeveloperUsageMeterPanelProps) {
    const [usage, setUsage] = useState<AppUsageSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadUsage = async () => {
        if (loading) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/developers/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list_usage', app_id: appId, limit: 12 }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.error?.message || 'Usage meters could not be loaded.');
            }
            setUsage(resultData(payload));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Usage meters could not be loaded.');
        } finally {
            setLoading(false);
        }
    };

    const rollups = usage?.rollups || [];
    const events = usage?.events || [];

    return (
        <div className="developer-usage-panel">
            <div className="developer-usage-panel__header">
                <div>
                    <strong>Usage meters</strong>
                    <span>{rollups.length > 0 ? `${rollups.length} active period${rollups.length === 1 ? '' : 's'}` : 'No usage loaded'}</span>
                </div>
                <Button unstyled className="dashboard-link-button" type="button" onClick={() => { void loadUsage(); }} disabled={loading}>
                    {loading ? <Loader2 size={13} aria-hidden="true" /> : <BarChart3 size={13} aria-hidden="true" />}
                    {usage ? 'Refresh' : 'Load'}
                </Button>
            </div>
            {error && <p className="billing-charge-panel__error" role="alert">{error}</p>}
            {usage && rollups.length === 0 && <p className="marketplace-panel-copy">No usage events have been metered for this app yet.</p>}
            {rollups.length > 0 && (
                <div className="developer-usage-panel__rollups">
                    {rollups.slice(0, 3).map((rollup) => (
                        <div key={rollup.id} className="developer-usage-row">
                            <span>{rollup.meter_name}</span>
                            <strong>{formatQuantity(rollup.quantity)} {rollup.usage_unit}</strong>
                            <small>{formatInrCurrency(Number(rollup.amount_minor || 0) / 100, { maximumFractionDigits: 0 })}</small>
                        </div>
                    ))}
                </div>
            )}
            {events.length > 0 && (
                <p className="marketplace-panel-copy">{events.length} recent event{events.length === 1 ? '' : 's'} captured.</p>
            )}
        </div>
    );
}
