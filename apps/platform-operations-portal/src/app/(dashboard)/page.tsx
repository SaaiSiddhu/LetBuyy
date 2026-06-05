import {
    ModuleCard,
    ModuleGrid,
    OpsMetric,
    OpsWorkspace,
    MetricGrid,
    Panel,
    SkipBackendPanel,
} from '@/components/_local-ui/ops-workspace';
import { loadEmployeeAnalytics } from '@/lib/api/employee-modules';

export default async function TeamDashboardPage() {
    const analytics = await loadEmployeeAnalytics();

    return (
        <OpsWorkspace
            eyebrow="Employee operations"
            title="Operations Portal"
            description="Support, success, sales, and operations workspace for CRM, tickets, merchant health, retention, campaigns, communications, and onboarding."
        >
            <MetricGrid>
                <OpsMetric label="Stores visible" value={String(analytics.data?.total_stores || 0)} detail="/v1/employees/analytics" />
                <OpsMetric label="Orders visible" value={String(analytics.data?.total_orders || 0)} detail="/v1/employees/analytics" />
                <OpsMetric label="Users visible" value={String(analytics.data?.total_users || 0)} detail="/v1/employees/analytics" />
                <OpsMetric
                    label="Data health"
                    value={analytics.error ? 'blocked' : 'live'}
                    detail={analytics.error || 'Employee analytics endpoint responded.'}
                    tone={analytics.error ? 'warning' : 'success'}
                />
            </MetricGrid>

            <ModuleGrid>
                <ModuleCard href="/crm" title="CRM" description="Merchant and contact relationship workspace." status="blocked" detail="Needs employee CRM/search endpoint." />
                <ModuleCard href="/tickets" title="Tickets" description="Support queue and SLA triage." status="blocked" detail="Current endpoint returns support infrastructure unavailable." />
                <ModuleCard href="/merchant-health" title="Merchant Health" description="Merchant risk and growth monitoring." status="partial" detail="Uses /employees/analytics totals only." />
                <ModuleCard href="/retention" title="Retention" description="Save plays, churn risk, and renewal assistance." status="blocked" detail="Needs retention/cohort endpoint." />
                <ModuleCard href="/campaigns" title="Campaigns" description="Lifecycle campaigns and operational announcements." status="blocked" detail="Needs campaign endpoint." />
                <ModuleCard href="/communications" title="Communications" description="Merchant email, chat, and notification history." status="blocked" detail="Needs communications endpoint." />
                <ModuleCard href="/onboarding" title="Onboarding" description="Store setup and activation checklist." status="blocked" detail="Needs onboarding pipeline endpoint." />
                <ModuleCard href="/operations" title="Review Queue" description="Marketplace app/theme review decisions." status="live" detail="Contract: /v1/operations/marketplace-reviews" />
            </ModuleGrid>

            <Panel title="Operating Rules" description="Current employee portal data constraints.">
                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                    <SkipBackendPanel title="Unified employee task feed" contract="/v1/employees/tasks">
                        No task feed endpoint exists, so the dashboard links to module placeholders instead of inventing assignments.
                    </SkipBackendPanel>
                    <SkipBackendPanel title="Employee role-scoped module counts" contract="/v1/employees/modules/summary">
                        The current analytics endpoint exposes only platform totals, not role-scoped queue counts.
                    </SkipBackendPanel>
                </div>
            </Panel>
        </OpsWorkspace>
    );
}
