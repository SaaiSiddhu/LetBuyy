import {
    ConsoleWorkspace,
    LeadershipMetric,
    MetricGrid,
    SkipBackendPanel,
} from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import { fetchConsoleApi, type ConsoleDataResponse } from '@/lib/console-api';

type ConsoleAnalytics = {
    period_days: number;
    new_signups: number;
    stores_created: number;
    subscriptions_created: number;
    audit_events: number;
    signup_to_store_conversion_percent: number;
};

export default async function ConsoleAnalyticsPage() {
    const result = await fetchConsoleApi<ConsoleDataResponse<ConsoleAnalytics>>('/internal/console/analytics');
    const analytics = result.data?.data;

    return (
        <ConsoleWorkspace
            eyebrow="Analytics"
            title="Platform Analytics"
            description={`Growth metrics from the last ${analytics?.period_days || 30} days.`}
        >
            {result.error ? (
                <ConsoleApiErrorPanel title="Analytics API unavailable" message={result.error} />
            ) : (
                <MetricGrid>
                    <LeadershipMetric label="New signups" value={String(analytics?.new_signups || 0)} />
                    <LeadershipMetric label="Stores created" value={String(analytics?.stores_created || 0)} />
                    <LeadershipMetric label="New subscriptions" value={String(analytics?.subscriptions_created || 0)} />
                    <LeadershipMetric label="Audit events" value={String(analytics?.audit_events || 0)} />
                    <LeadershipMetric label="Signup to store" value={`${analytics?.signup_to_store_conversion_percent || 0}%`} />
                </MetricGrid>
            )}
            <SkipBackendPanel title="Funnels, cohorts, and segmented dashboards" contract="/v1/internal/console/analytics/funnels">
                The gateway exposes 30-day growth counters only. Product funnels, retention cohorts, marketplace analytics, and partner scorecards need aggregate endpoints.
            </SkipBackendPanel>
        </ConsoleWorkspace>
    );
}
