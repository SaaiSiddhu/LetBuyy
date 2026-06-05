import {
    ConsoleWorkspace,
    LeadershipMetric,
    MetricGrid,
    ModuleCard,
    ModuleGrid,
    Panel,
    SkipBackendPanel,
} from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import { fetchConsoleApi, formatMoneyFromPaise, type ConsoleDataResponse } from '@/lib/console-api';

type ConsoleSummary = {
    total_users: number;
    total_stores: number;
    active_stores: number;
    total_subscriptions: number;
    active_subscriptions: number;
    total_employees: number;
    total_audit_logs: number;
    monthly_revenue_paise: number;
};

type ConsoleAnalytics = {
    period_days: number;
    new_signups: number;
    stores_created: number;
    subscriptions_created: number;
    audit_events: number;
    signup_to_store_conversion_percent: number;
};

export default async function ConsoleDashboardRoutePage() {
    const [summaryResult, analyticsResult] = await Promise.all([
        fetchConsoleApi<ConsoleDataResponse<ConsoleSummary>>('/internal/console/summary'),
        fetchConsoleApi<ConsoleDataResponse<ConsoleAnalytics>>('/internal/console/analytics'),
    ]);
    const summary = summaryResult.data?.data;
    const analytics = analyticsResult.data?.data;
    const activeStoreRatio = `${summary?.active_stores || 0}/${summary?.total_stores || 0}`;
    const activeSubscriptionRatio = `${summary?.active_subscriptions || 0}/${summary?.total_subscriptions || 0}`;

    return (
        <ConsoleWorkspace
            eyebrow="Platform command"
            title="Leadership Home"
            description="CEO, CTO, and partner-facing operating view for merchants, revenue, governance, trust, analytics, and platform reliability."
        >
            {summaryResult.error ? (
                <ConsoleApiErrorPanel title="Summary API unavailable" message={summaryResult.error} />
            ) : null}

            <MetricGrid>
                <LeadershipMetric label="Merchant stores" value={activeStoreRatio} detail="Published / total sites" tone="success" />
                <LeadershipMetric label="Monthly revenue" value={formatMoneyFromPaise(summary?.monthly_revenue_paise || 0)} detail="Active subscription value" />
                <LeadershipMetric label="Subscriptions" value={activeSubscriptionRatio} detail="Active / total plans" />
                <LeadershipMetric label="Audit events" value={String(summary?.total_audit_logs || 0)} detail="Governance evidence trail" />
            </MetricGrid>

            {analyticsResult.error ? (
                <ConsoleApiErrorPanel title="Analytics API unavailable" message={analyticsResult.error} />
            ) : (
                <Panel
                    title="Launch Pulse"
                    description={`Last ${analytics?.period_days || 30} days from /internal/console/analytics.`}
                >
                    <MetricGrid>
                        <LeadershipMetric label="New signups" value={String(analytics?.new_signups || 0)} />
                        <LeadershipMetric label="Stores created" value={String(analytics?.stores_created || 0)} />
                        <LeadershipMetric label="New subscriptions" value={String(analytics?.subscriptions_created || 0)} />
                        <LeadershipMetric label="Signup to store" value={`${analytics?.signup_to_store_conversion_percent || 0}%`} />
                    </MetricGrid>
                </Panel>
            )}

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
                    description="Track subscription value and billing health for leadership reviews."
                    status="partial"
                    details="Contracts: /summary and /subscriptions"
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
                    description="Review partner app/theme governance readiness and missing backend contracts."
                    status="blocked"
                    details="Needs platform-console marketplace governance endpoint."
                />
                <ModuleCard
                    href="/trust-safety"
                    title="Trust & Safety"
                    description="Monitor audit events and security enforcement signals."
                    status="partial"
                    details="Contracts: /audit-logs and /operations/runtime/overview"
                />
                <ModuleCard
                    href="/analytics"
                    title="Analytics"
                    description="Inspect growth conversion and operational event volume."
                    status="live"
                    details="Contract: /v1/internal/console/analytics"
                />
                <ModuleCard
                    href="/operations"
                    title="Platform Ops"
                    description="Runtime health, queues, incidents, deployments, SLOs, and certification."
                    status="live"
                    details="Contract: /v1/operations/runtime/overview"
                />
            </ModuleGrid>

            <SkipBackendPanel title="Leadership exports and board packs" contract="/v1/internal/console/leadership-reports">
                PDF/CSV exports, investor-ready cohorts, and board-pack snapshots are not exposed by the current gateway.
            </SkipBackendPanel>
        </ConsoleWorkspace>
    );
}
