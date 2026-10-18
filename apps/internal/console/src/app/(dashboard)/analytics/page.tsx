import type { InternalConsoleAnalytics as ConsoleAnalytics } from '@letbuyy/shared-types';
import Link from 'next/link';
import type {
    ExecutiveCohortAnalytics,
    ExecutiveCompanyHealth,
    ExecutiveFunnelAnalytics,
    ExecutiveMrrAnalytics,
} from '@letbuyy/shared-types';
import { Button, Input, Table } from '@letbuyy/ui';
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
    readSearchParam,
    type ConsoleDataResponse,
} from '@/lib/console-api';


type CohortMerchant = {
    id: string;
    store_name?: string | null;
    name?: string | null;
    subdomain?: string | null;
    status?: string | null;
    created_at?: string | null;
};

type CohortMerchantDrill = {
    cohort_month: string;
    merchants: CohortMerchant[];
};

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function freshnessTone(stale?: boolean): 'success' | 'warning' {
    return stale ? 'warning' : 'success';
}

function freshnessLabel(stale?: boolean): string {
    return stale ? 'stale' : 'fresh';
}

function percentFromBps(value: number | undefined): string {
    return `${((value || 0) / 100).toFixed(1)}%`;
}

function monthLabel(value: string | null | undefined): string {
    return value ? value.slice(0, 7) : 'unknown';
}

export default async function ConsoleAnalyticsPage({ searchParams }: PageProps) {
    const params = searchParams ? await searchParams : undefined;
    const cohort = readSearchParam(params, 'cohort');
    const reason = readSearchParam(params, 'reason');
    const drillQuery = cohort && reason
        ? { reason, limit: 25 }
        : null;

    const [counterResult, mrrResult, funnelResult, cohortResult, healthResult, drillResult] = await Promise.all([
        fetchConsoleApi<ConsoleDataResponse<ConsoleAnalytics>>('/internal/console/analytics'),
        fetchConsoleApi<ConsoleDataResponse<ExecutiveMrrAnalytics>>('/internal/console/analytics/mrr', { limit: 13 }),
        fetchConsoleApi<ConsoleDataResponse<ExecutiveFunnelAnalytics>>('/internal/console/analytics/funnels', { days: 30 }),
        fetchConsoleApi<ConsoleDataResponse<ExecutiveCohortAnalytics>>('/internal/console/analytics/cohorts', { limit: 12 }),
        fetchConsoleApi<ConsoleDataResponse<ExecutiveCompanyHealth>>('/internal/console/analytics/company-health'),
        drillQuery
            ? fetchConsoleApi<ConsoleDataResponse<CohortMerchantDrill>>(`/internal/console/analytics/cohorts/${cohort}/merchants`, drillQuery)
            : Promise.resolve({ data: undefined, error: undefined }),
    ]);

    const counters = counterResult.data?.data;
    const mrr = mrrResult.data?.data;
    const latest = mrr?.latest;
    const funnel = funnelResult.data?.data;
    const cohorts = cohortResult.data?.data?.snapshots || [];
    const health = healthResult.data?.data;
    const healthMetric = (key: string) => health?.metrics.find((metric) => metric.metric_key === key);

    return (
        <ConsoleWorkspace
            eyebrow="Analytics"
            title="Executive Analytics"
            description="Leadership metrics from versioned rollups with stale-state handling and audited drill-through."
        >
            {counterResult.error ? <ConsoleApiErrorPanel title="Live counters unavailable" message={counterResult.error} /> : null}
            {mrrResult.error ? <ConsoleApiErrorPanel title="MRR rollups unavailable" message={mrrResult.error} /> : null}
            {funnelResult.error ? <ConsoleApiErrorPanel title="Funnel rollups unavailable" message={funnelResult.error} /> : null}
            {cohortResult.error ? <ConsoleApiErrorPanel title="Cohort rollups unavailable" message={cohortResult.error} /> : null}
            {healthResult.error ? <ConsoleApiErrorPanel title="Company-health rollups unavailable" message={healthResult.error} /> : null}
            {drillResult.error ? <ConsoleApiErrorPanel title="Cohort drill-through unavailable" message={drillResult.error} /> : null}

            <MetricGrid>
                <LeadershipMetric
                    label="MRR"
                    value={formatMoneyFromPaise(latest?.mrr_paise || 0)}
                    detail={`${freshnessLabel(mrr?.freshness.stale)} · ${latest?.period_date || 'no rollup'}`}
                    tone={freshnessTone(mrr?.freshness.stale)}
                />
                <LeadershipMetric label="ARR" value={formatMoneyFromPaise(latest?.arr_paise || 0)} />
                <LeadershipMetric label="Net new MRR" value={formatMoneyFromPaise(latest?.new_mrr_paise || 0)} />
                <LeadershipMetric label="Churned MRR" value={formatMoneyFromPaise(latest?.churned_mrr_paise || 0)} tone="warning" />
            </MetricGrid>

            {mrr?.freshness.stale ? (
                <Panel title="Rollup freshness" description={mrr.freshness.stale_reason || 'Latest executive analytics rollup is stale.'}>
                    <StatusPill value="stale" tone="warning" />
                </Panel>
            ) : null}

            <Panel title="Company Health" description="Operating load and trust signals from support, risk, T&S, incident, and telemetry rollups.">
                <MetricGrid>
                    <LeadershipMetric label="Open support" value={String(healthMetric('support.open_tickets')?.value || 0)} />
                    <LeadershipMetric label="SLA breaches" value={String(healthMetric('support.sla_breaches')?.value || 0)} tone="warning" />
                    <LeadershipMetric label="High risk" value={String(healthMetric('risk.high_scores')?.value || 0)} tone="warning" />
                    <LeadershipMetric label="Open incidents" value={String(healthMetric('incidents.open')?.value || 0)} tone="critical" />
                </MetricGrid>
            </Panel>

            <Panel title="Activation Funnel" description={`Latest period: ${funnel?.latest_period_date || 'no rollup'}.`}>
                {funnel?.steps.length ? (
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-5">
                        {funnel.steps.map((step) => (
                            <div key={step.step_key} className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
                                <p className="m-0 text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">{step.step_key.replace(/_/g, ' ')}</p>
                                <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)]">{step.count}</p>
                                <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                                    {percentFromBps(step.conversion_rate_bps)}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyDataState message="No activation funnel rollup is available yet." />
                )}
            </Panel>

            <Panel title="Revenue Mix" description="Subscription, app marketplace, theme marketplace, and partner payout liability from rollups.">
                <MetricGrid>
                    <LeadershipMetric label="Subscription" value={formatMoneyFromPaise(latest?.subscription_revenue_paise || 0)} />
                    <LeadershipMetric label="App revenue" value={formatMoneyFromPaise(latest?.app_revenue_paise || 0)} />
                    <LeadershipMetric label="Theme revenue" value={formatMoneyFromPaise(latest?.theme_revenue_paise || 0)} />
                    <LeadershipMetric label="Payout liability" value={formatMoneyFromPaise(latest?.partner_payout_liability_paise || 0)} tone="warning" />
                </MetricGrid>
            </Panel>

            <Panel title="Cohorts" description="Store cohorts with retained and converted counts. Merchant drill-through requires a reason and is audited.">
                {cohorts.length ? (
                    <Table className="shadow-none" containerClassName="overflow-x-auto" tableClassName="min-w-[760px] text-left text-sm">
                        <thead className="text-[var(--lb-color-text-subdued)]">
                            <tr className="border-b border-[var(--lb-color-border)]">
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Cohort</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Age</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Size</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Retained</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Converted</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Drill</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--lb-color-border)]">
                            {cohorts.map((row) => (
                                <tr key={`${row.cohort_month}-${row.period_index}`}>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{monthLabel(row.cohort_month)}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{row.period_index} mo</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{row.cohort_size}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{row.retained_count}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{row.conversion_count}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">
                                        <form action="/analytics" className="flex min-w-[220px] gap-[var(--lb-space-2)]">
                                            <Input unstyled type="hidden" name="cohort" value={monthLabel(row.cohort_month)} />
                                            <Input
                                                name="reason"
                                                required
                                                minLength={8}
                                                placeholder="Reason"
                                                className="min-w-0 flex-1"
                                            />
                                            <Button size="sm" variant="outline" type="submit">
                                                View
                                            </Button>
                                        </form>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyDataState message="No cohort snapshots are available yet." />
                )}
            </Panel>

            {drillResult.data?.data ? (
                <Panel title={`Cohort Merchants ${drillResult.data.data.cohort_month}`} description="Reason-captured cohort drill-through. Open a merchant to continue in Merchant 360.">
                    {drillResult.data.data.merchants.length ? (
                        <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                            {drillResult.data.data.merchants.map((merchant) => (
                                <Link
                                    key={merchant.id}
                                    href={`/merchants/${merchant.id}`}
                                    className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] p-[var(--lb-space-4)] hover:border-[var(--lb-color-primary)]"
                                >
                                    <div className="font-[var(--lb-font-weight-semibold)]">{merchant.store_name || merchant.name || merchant.subdomain || merchant.id}</div>
                                    <div className="mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                                        {merchant.status || 'unknown'} · {formatDateTime(merchant.created_at)}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <EmptyDataState message="No merchants matched this cohort." />
                    )}
                </Panel>
            ) : null}

            <Panel title="Live Launch Counters" description={`Last ${counters?.period_days || 30} days, retained for launch-pulse context beside rollups.`}>
                <MetricGrid>
                    <LeadershipMetric label="New signups" value={String(counters?.new_signups || 0)} />
                    <LeadershipMetric label="Stores created" value={String(counters?.stores_created || 0)} />
                    <LeadershipMetric label="New subscriptions" value={String(counters?.subscriptions_created || 0)} />
                    <LeadershipMetric label="Signup to store" value={`${counters?.signup_to_store_conversion_percent || 0}%`} />
                </MetricGrid>
            </Panel>
        </ConsoleWorkspace>
    );
}
