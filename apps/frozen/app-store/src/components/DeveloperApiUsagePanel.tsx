'use client';

import { useState } from 'react';
import { BarChart3, Button, Loader2 } from '@letbuyy/ui';
import type { AppApiUsageMetric, AppApiUsageSummary } from '@letbuyy/shared-types';

interface DeveloperApiUsagePanelProps {
    appId: string;
}

interface ApiUsageResponse {
    data?: AppApiUsageSummary;
    error?: { message?: string };
}

function metricTotal(metrics: AppApiUsageMetric[], key: 'request_count' | 'error_count'): number {
    return metrics.reduce((sum, metric) => sum + Number(metric[key] || 0), 0);
}

export function DeveloperApiUsagePanel({ appId }: DeveloperApiUsagePanelProps) {
    const [usage, setUsage] = useState<AppApiUsageSummary | null>(null);
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
                body: JSON.stringify({ action: 'list_api_usage', app_id: appId, days: 30 }),
            });
            const payload = await response.json().catch(() => null) as ApiUsageResponse | null;
            if (!response.ok || !payload?.data) {
                throw new Error(payload?.error?.message || 'API usage metrics could not be loaded.');
            }
            setUsage(payload.data);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'API usage metrics could not be loaded.');
        } finally {
            setLoading(false);
        }
    };

    const metrics = usage?.metrics || [];
    const totalRequests = metricTotal(metrics, 'request_count');
    const totalErrors = metricTotal(metrics, 'error_count');

    return (
        <div className="developer-api-usage-panel">
            <div className="developer-usage-panel__header">
                <div>
                    <strong>API usage</strong>
                    <span>{usage ? `${totalRequests.toLocaleString('en-IN')} requests · ${totalErrors.toLocaleString('en-IN')} errors` : 'Per-route request metrics'}</span>
                </div>
                <Button unstyled className="dashboard-link-button" type="button" onClick={() => { void loadUsage(); }} disabled={loading}>
                    {loading ? <Loader2 size={13} aria-hidden="true" /> : <BarChart3 size={13} aria-hidden="true" />}
                    {usage ? 'Refresh' : 'Load'}
                </Button>
            </div>
            {error && <p className="billing-charge-panel__error" role="alert">{error}</p>}
            {usage && metrics.length === 0 && <p className="marketplace-panel-copy">No app API requests have been recorded yet.</p>}
            {metrics.length > 0 && (
                <div className="developer-api-usage-panel__rows">
                    {metrics.slice(0, 4).map((metric) => (
                        <div key={metric.id || `${metric.metric_date}-${metric.route_group}-${metric.method}`} className="developer-api-usage-row">
                            <div>
                                <strong>{metric.route_group}</strong>
                                <span>{metric.method} · {metric.metric_date}</span>
                            </div>
                            <span>{Number(metric.request_count || 0).toLocaleString('en-IN')} req</span>
                            <span>{Number(metric.avg_latency_ms || 0).toLocaleString('en-IN')} ms avg</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
