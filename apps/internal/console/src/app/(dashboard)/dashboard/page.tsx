import type { InternalConsoleSummary as ConsoleSummary, InternalConsoleAnalytics as ConsoleAnalytics } from '@letbuyy/shared-types';
import type { ExecutiveCompanyHealth, ExecutiveMrrAnalytics } from '@letbuyy/shared-types';
import {
    ConsoleWorkspace,
    LeadershipMetric,
    MetricGrid,
    ModuleCard,
    ModuleGrid,
    Panel,
    StatusPill,
} from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import { fetchConsoleApi, formatMoneyFromPaise, type ConsoleDataResponse } from '@/lib/console-api';



function freshnessTone(stale?: boolean): 'success' | 'warning' {
    return stale ? 'warning' : 'success';
}

export default async function ConsoleDashboardRoutePage() {
    const [summaryResult, analyticsResult, mrrResult, healthResult] = await Promise.all([
        fetchConsoleApi<ConsoleDataResponse<ConsoleSummary>>('/internal/console/summary'),
        fetchConsoleApi<ConsoleDataResponse<ConsoleAnalytics>>('/internal/console/analytics'),
        fetchConsoleApi<ConsoleDataResponse<ExecutiveMrrAnalytics>>('/internal/console/analytics/mrr', { limit: 13 }),
        fetchConsoleApi<ConsoleDataResponse<ExecutiveCompanyHealth>>('/internal/console/analytics/company-health'),
    ]);
    const summary = summaryResult.data?.data;
    const analytics = analyticsResult.data?.data;
    const mrr = mrrResult.data?.data;
    const latest = mrr?.latest;
    const health = healthResult.data?.data;
    const activeStoreRatio = `${summary?.active_stores || 0}/${summary?.total_stores || 0}`;
    const activeSubscriptionRatio = `${summary?.active_subscriptions || 0}/${summary?.total_subscriptions || 0}`;
    const healthMetric = (key: string) => health?.metrics.find((metric) => metric.metric_key === key);

    return (
        <ConsoleWorkspace
            eyebrow="Platform command"
            title="Leadership Home"
            description="CEO, CTO, and partner-facing operating view for merchants, revenue, governance, trust, analytics, and platform reliability."
        >
            {summaryResult.error ? <ConsoleApiErrorPanel title="Summary API unavailable" message={summaryResult.error} /> : null}
            {analyticsResult.error ? <ConsoleApiErrorPanel title="Launch counter API unavailable" message={analyticsResult.error} /> : null}
            {mrrResult.error ? <ConsoleApiErrorPanel title="MRR rollups unavailable" message={mrrResult.error} /> : null}
            {healthResult.error ? <ConsoleApiErrorPanel title="Company-health rollups unavailable" message={healthResult.error} /> : null}

            <MetricGrid>
                <LeadershipMetric label="Merchant stores" value={activeStoreRatio} detail="Published / total sites" tone="success" />
                <LeadershipMetric
                    label="MRR"
                    value={latest ? formatMoneyFromPaise(latest.mrr_paise) : 'Unavailable'}
                    detail={latest ? `${mrr?.freshness.stale ? 'stale' : 'fresh'} · ${latest.period_date}` : 'No MRR rollup'}
                    tone={latest ? freshnessTone(mrr?.freshness.stale) : 'warning'}
                />
                <LeadershipMetric label="ARR" value={latest ? formatMoneyFromPaise(latest.arr_paise) : 'Unavailable'} />
                <LeadershipMetric label="Subscriptions" value={activeSubscriptionRatio} detail="Active / total plans" />
            </MetricGrid>

            <Panel
                title="Company Health"
                description={`Rollup status: ${health?.freshness.stale ? 'stale' : 'fresh'}.`}
                action={<StatusPill value={health?.freshness.stale ? 'stale' : 'fresh'} tone={freshnessTone(health?.freshness.stale)} />}
            >
                <MetricGrid>
                    <LeadershipMetric label="Open support" value={String(healthMetric('support.open_tickets')?.value || 0)} />
                    <LeadershipMetric label="SLA breaches" value={String(healthMetric('support.sla_breaches')?.value || 0)} tone="warning" />
                    <LeadershipMetric label="High risk" value={String(healthMetric('risk.high_scores')?.value || 0)} tone="warning" />
                    <LeadershipMetric label="Open incidents" value={String(healthMetric('incidents.open')?.value || 0)} tone="critical" />
                </MetricGrid>
            </Panel>

            <Panel
                title="Launch Pulse"
                description={`Last ${analytics?.period_days || 30} days from live counters, shown beside the rollup layer for launch context.`}
            >
                <MetricGrid>
                    <LeadershipMetric label="New signups" value={String(analytics?.new_signups || 0)} />
                    <LeadershipMetric label="Stores created" value={String(analytics?.stores_created || 0)} />
                    <LeadershipMetric label="New subscriptions" value={String(analytics?.subscriptions_created || 0)} />
                    <LeadershipMetric label="Signup to store" value={`${analytics?.signup_to_store_conversion_percent || 0}%`} />
                </MetricGrid>
            </Panel>

            <ModuleGrid>
                <ModuleCard
                    href="/stores"
                    title="Merchant Directory"
                    description="Search and review every tenant site surfaced as a merchant store."
                    status="live"
                    details="Contract: /v1/internal/console/stores"
                />
                <ModuleCard
                    href="/revenue"
                    title="Revenue"
                    description="MRR, ARR, revenue mix, churn, and payout-liability rollups."
                    status="live"
                    details="Contracts: /analytics/mrr and /subscriptions"
                />
                <ModuleCard
                    href="/subscriptions"
                    title="Subscriptions"
                    description="Inspect plan, status, period, and payment gateway records."
                    status="live"
                    details="Contract: /v1/internal/console/subscriptions"
                />
                <ModuleCard
                    href="/marketplace-governance"
                    title="Marketplace Governance"
                    description="Review app and theme queue health, check results, and governance trends."
                    status="live"
                    details="Contract: /v1/operations/marketplace-reviews"
                />
                <ModuleCard
                    href="/trust-safety"
                    title="Trust & Safety"
                    description="Monitor case queues, active takedowns, appeals, and overturn rates."
                    status="live"
                    details="Contract: /v1/operations/trust-safety"
                />
                <ModuleCard
                    href="/analytics"
                    title="Analytics"
                    description="Inspect MRR/ARR, activation funnels, cohorts, and company-health rollups."
                    status="live"
                    details="Contracts: /analytics/mrr, /funnels, /cohorts"
                />
                <ModuleCard
                    href="/operations"
                    title="Platform Ops"
                    description="Runtime health, queues, incidents, deployments, SLOs, and certification."
                    status="live"
                    details="Contract: /v1/operations/runtime/overview"
                />
            </ModuleGrid>
        </ConsoleWorkspace>
    );
}
