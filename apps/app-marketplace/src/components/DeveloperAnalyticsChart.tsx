import { BarChart3 } from '@letbuyy/ui';
import { formatInrCurrency } from '@letbuyy/ui/formatting';
import type { PartnerAnalyticsPoint, PartnerAnalyticsTimeseries } from '@letbuyy/shared-types';

interface DeveloperAnalyticsChartProps {
    timeseries: PartnerAnalyticsTimeseries | null;
}

function amountLabel(value: number): string {
    return formatInrCurrency(value / 100, { maximumFractionDigits: 0 }) || '₹0';
}

function dayLabel(point: PartnerAnalyticsPoint): string {
    const date = new Date(point.metric_date);
    return Number.isNaN(date.getTime())
        ? point.metric_date
        : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function DeveloperAnalyticsChart({ timeseries }: DeveloperAnalyticsChartProps) {
    const points = (timeseries?.points || []).slice(-30);
    const maxRequests = Math.max(...points.map((point) => Number(point.api_requests || 0)), 1);
    const maxRevenue = Math.max(...points.map((point) => Number(point.partner_amount_minor || 0)), 1);
    const totalApiRequests = points.reduce((sum, point) => sum + Number(point.api_requests || 0), 0);
    const totalErrors = points.reduce((sum, point) => sum + Number(point.api_errors || 0), 0);
    const totalUsage = points.reduce((sum, point) => sum + Number(point.usage_events || 0), 0);
    const totalRevenue = points.reduce((sum, point) => sum + Number(point.partner_amount_minor || 0), 0);

    return (
        <section className="dashboard-section marketplace-panel developer-analytics-panel">
            <div className="marketplace-panel-header">
                <div>
                    <h2 className="marketplace-panel-title marketplace-row">
                        <BarChart3 size={16} aria-hidden="true" />
                        Developer analytics
                    </h2>
                    <p className="marketplace-panel-copy">Last 30 days of app API usage, metered usage, and partner revenue.</p>
                </div>
                <span className="marketplace-badge marketplace-badge--neutral">{points.length} days</span>
            </div>
            {points.length === 0 ? (
                <div className="dashboard-empty">No analytics events have been recorded yet.</div>
            ) : (
                <>
                    <div className="developer-analytics-summary">
                        <div>
                            <span>API requests</span>
                            <strong>{totalApiRequests.toLocaleString('en-IN')}</strong>
                        </div>
                        <div>
                            <span>API errors</span>
                            <strong>{totalErrors.toLocaleString('en-IN')}</strong>
                        </div>
                        <div>
                            <span>Usage events</span>
                            <strong>{totalUsage.toLocaleString('en-IN')}</strong>
                        </div>
                        <div>
                            <span>Partner revenue</span>
                            <strong>{amountLabel(totalRevenue)}</strong>
                        </div>
                    </div>
                    <div className="developer-analytics-bars" aria-label="Developer analytics chart">
                        {points.map((point) => {
                            return (
                                <div key={point.metric_date} className="developer-analytics-bar">
                                    <div className="developer-analytics-bar__tracks">
                                        <meter
                                            min={0}
                                            max={maxRequests}
                                            value={Number(point.api_requests || 0)}
                                            title={`${Number(point.api_requests || 0).toLocaleString('en-IN')} API requests`}
                                        />
                                        <meter
                                            min={0}
                                            max={maxRevenue}
                                            value={Number(point.partner_amount_minor || 0)}
                                            title={`${amountLabel(Number(point.partner_amount_minor || 0))} partner revenue`}
                                        />
                                    </div>
                                    <small>{dayLabel(point)}</small>
                                </div>
                            );
                        })}
                    </div>
                    <div className="developer-analytics-legend">
                        <span><i className="developer-analytics-legend__requests" /> API requests</span>
                        <span><i className="developer-analytics-legend__revenue" /> Partner revenue</span>
                    </div>
                </>
            )}
        </section>
    );
}
