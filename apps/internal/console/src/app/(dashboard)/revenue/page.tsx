import type { InternalConsoleSummary as ConsoleSummary } from '@letbuyy/shared-types';
import type { ExecutiveMrrAnalytics } from '@letbuyy/shared-types';
import { Table } from '@letbuyy/ui';
import {
    ConsoleWorkspace,
    EmptyDataState,
    LeadershipMetric,
    MetricGrid,
    Panel,
    StatusPill,
} from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import {
    fetchConsoleApi,
    formatDateTime,
    formatMoneyFromPaise,
    type ConsoleDataResponse,
    type ConsolePaginatedResponse,
} from '@/lib/console-api';


type ConsoleSubscription = {
    id: string;
    plan: string | null;
    status: string | null;
    billing_period: string | null;
    payment_gateway: string | null;
    amount_paid: number | string | null;
    currency: string | null;
    current_period_end: string | null;
    created_at: string | null;
};

function freshnessTone(stale?: boolean): 'success' | 'warning' {
    return stale ? 'warning' : 'success';
}

export default async function RevenuePage() {
    const [summaryResult, mrrResult, subscriptionsResult] = await Promise.all([
        fetchConsoleApi<ConsoleDataResponse<ConsoleSummary>>('/internal/console/summary'),
        fetchConsoleApi<ConsoleDataResponse<ExecutiveMrrAnalytics>>('/internal/console/analytics/mrr', { limit: 13 }),
        fetchConsoleApi<ConsolePaginatedResponse<ConsoleSubscription>>('/internal/console/subscriptions', {
            page: 1,
            limit: 10,
        }),
    ]);
    const summary = summaryResult.data?.data;
    const mrr = mrrResult.data?.data;
    const latest = mrr?.latest;
    const rows = subscriptionsResult.data?.data || [];
    const activeRows = rows.filter((row) => row.status === 'active').length;
    const trialRows = rows.filter((row) => row.status === 'trialing').length;

    return (
        <ConsoleWorkspace
            eyebrow="Revenue"
            title="Revenue"
            description="Leadership billing view backed by versioned MRR, ARR, marketplace revenue, and payout-liability rollups."
        >
            {summaryResult.error ? <ConsoleApiErrorPanel title="Summary API unavailable" message={summaryResult.error} /> : null}
            {mrrResult.error ? <ConsoleApiErrorPanel title="MRR rollups unavailable" message={mrrResult.error} /> : null}
            {subscriptionsResult.error ? <ConsoleApiErrorPanel title="Subscriptions API unavailable" message={subscriptionsResult.error} /> : null}

            <MetricGrid>
                <LeadershipMetric
                    label="MRR"
                    value={latest ? formatMoneyFromPaise(latest.mrr_paise) : 'Unavailable'}
                    detail={latest ? `${mrr?.freshness.stale ? 'stale' : 'fresh'} · ${latest.period_date}` : 'No MRR rollup'}
                    tone={latest ? freshnessTone(mrr?.freshness.stale) : 'warning'}
                />
                <LeadershipMetric label="ARR" value={latest ? formatMoneyFromPaise(latest.arr_paise) : 'Unavailable'} />
                <LeadershipMetric label="Active subscriptions" value={`${latest?.active_subscriptions || summary?.active_subscriptions || 0}/${summary?.total_subscriptions || 0}`} />
                <LeadershipMetric label="Logo churn" value={String(latest?.logo_churn_count || 0)} tone="warning" />
            </MetricGrid>

            {mrr?.freshness.stale ? (
                <Panel title="Rollup freshness" description={mrr.freshness.stale_reason || 'Latest revenue rollup is stale.'}>
                    <StatusPill value="stale" tone="warning" />
                </Panel>
            ) : null}

            <Panel title="Revenue Mix" description="Reconciles subscription MRR, app charges, theme purchases, and pending partner payout liability.">
                <MetricGrid>
                    <LeadershipMetric label="Subscription" value={formatMoneyFromPaise(latest?.subscription_revenue_paise || 0)} />
                    <LeadershipMetric label="App marketplace" value={formatMoneyFromPaise(latest?.app_revenue_paise || 0)} />
                    <LeadershipMetric label="Theme marketplace" value={formatMoneyFromPaise(latest?.theme_revenue_paise || 0)} />
                    <LeadershipMetric label="Payout liability" value={formatMoneyFromPaise(latest?.partner_payout_liability_paise || 0)} tone="warning" />
                </MetricGrid>
            </Panel>

            <Panel title="MRR Trend" description={`Definition: ${mrr?.definition_version || 'unknown'}.`}>
                {mrr?.trend.length ? (
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3 xl:grid-cols-4">
                        {mrr.trend.slice(-8).map((row) => (
                            <div key={row.id || row.period_date} className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
                                <p className="m-0 text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">{row.period_date}</p>
                                <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)]">
                                    {formatMoneyFromPaise(row.mrr_paise)}
                                </p>
                                <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                                    Net new {formatMoneyFromPaise(row.new_mrr_paise)} · churn {formatMoneyFromPaise(row.churned_mrr_paise)}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyDataState message="No MRR trend rollups are available yet." />
                )}
            </Panel>

            <Panel
                title="Recent Billing Records"
                description="Latest subscription records remain available for source-level reconciliation."
            >
                <Table className="shadow-none" containerClassName="overflow-x-auto" tableClassName="min-w-[720px] text-left text-sm">
                        <thead className="text-[var(--lb-color-text-subdued)]">
                            <tr className="border-b border-[var(--lb-color-border)]">
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] font-[var(--lb-font-weight-medium)]">Plan</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] font-[var(--lb-font-weight-medium)]">Status</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] font-[var(--lb-font-weight-medium)]">Gateway</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] font-[var(--lb-font-weight-medium)]">Amount</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] font-[var(--lb-font-weight-medium)]">Period End</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--lb-color-border)]">
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[var(--lb-color-text)]">
                                        <div className="font-[var(--lb-font-weight-medium)]">{row.plan || 'free'}</div>
                                        <div className="text-xs text-[var(--lb-color-text-subdued)]">{row.billing_period || 'monthly'}</div>
                                    </td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">
                                        <StatusPill value={row.status || 'active'} />
                                    </td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[var(--lb-color-text-subdued)]">
                                        {row.payment_gateway || 'not set'}
                                    </td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[var(--lb-color-text)]">
                                        {formatMoneyFromPaise(row.amount_paid, row.currency || 'INR')}
                                    </td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[var(--lb-color-text-subdued)]">
                                        {formatDateTime(row.current_period_end)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                </Table>
                <p className="m-0 mt-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    Active records on latest page: {activeRows}. Trials on latest page: {trialRows}.
                </p>
            </Panel>
        </ConsoleWorkspace>
    );
}
