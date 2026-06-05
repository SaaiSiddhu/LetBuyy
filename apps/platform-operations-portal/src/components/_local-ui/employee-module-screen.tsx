import {
    MetricGrid,
    OpsMetric,
    OpsWorkspace,
    Panel,
    SkipBackendPanel,
} from './ops-workspace';
import type { EmployeeAnalytics } from '@/lib/api/employee-modules';

export type EmployeeModuleKey =
    | 'crm'
    | 'tickets'
    | 'merchant-health'
    | 'retention'
    | 'campaigns'
    | 'communications'
    | 'onboarding';

const moduleCopy: Record<EmployeeModuleKey, {
    eyebrow: string;
    title: string;
    description: string;
    contract: string;
    workflows: string[];
    skip: string;
}> = {
    crm: {
        eyebrow: 'CRM',
        title: 'CRM',
        description: 'Merchant relationship view for support, success, and sales handoffs.',
        contract: '/v1/employees/crm',
        workflows: ['Merchant profile search', 'Contact timeline', 'Owner and store relationship map', 'Sales handoff notes'],
        skip: 'The gateway has no employee CRM search, contact timeline, or relationship-note contract.',
    },
    tickets: {
        eyebrow: 'Tickets',
        title: 'Tickets',
        description: 'Support triage, SLA scanning, and ticket ownership workspace.',
        contract: '/v1/employees/tickets',
        workflows: ['Queue by priority', 'Assigned tickets', 'SLA breach risk', 'Customer thread history'],
        skip: 'The current tickets endpoint explicitly reports that support ticket infrastructure is not configured.',
    },
    'merchant-health': {
        eyebrow: 'Merchant health',
        title: 'Merchant Health',
        description: 'Merchant health overview using available employee analytics totals only.',
        contract: '/v1/employees/merchant-health',
        workflows: ['Risk scoring', 'Store activation status', 'Order velocity', 'Health intervention queue'],
        skip: 'Employee analytics exposes only total stores, orders, and users. Risk scores and per-merchant health rows need a backend projection.',
    },
    retention: {
        eyebrow: 'Retention',
        title: 'Retention',
        description: 'Renewal risk, save plays, and merchant success interventions.',
        contract: '/v1/employees/retention',
        workflows: ['Churn-risk segments', 'Save playbook assignment', 'Renewal calendar', 'Win-back follow-up'],
        skip: 'No retention, subscription-risk, or save-play endpoint exists for employees.',
    },
    campaigns: {
        eyebrow: 'Campaigns',
        title: 'Campaigns',
        description: 'Operational campaign planning for merchant lifecycle and education.',
        contract: '/v1/employees/campaigns',
        workflows: ['Campaign calendar', 'Audience builder', 'Approval queue', 'Campaign performance'],
        skip: 'No employee campaign contract exists. Existing marketing scaffolds cannot send or schedule campaigns safely.',
    },
    communications: {
        eyebrow: 'Communications',
        title: 'Communications',
        description: 'Merchant message history, support replies, and outbound communications.',
        contract: '/v1/employees/communications',
        workflows: ['Merchant inbox', 'Conversation history', 'Outbound email drafts', 'Notification delivery status'],
        skip: 'No communication timeline, inbox, or delivery-status endpoint exists for employee operators.',
    },
    onboarding: {
        eyebrow: 'Onboarding',
        title: 'Onboarding',
        description: 'Store activation pipeline and assisted onboarding checklist.',
        contract: '/v1/employees/onboarding',
        workflows: ['New store setup', 'Domain/payment readiness', 'Theme launch checklist', 'Assisted onboarding tasks'],
        skip: 'No employee onboarding pipeline endpoint exists. Current onboarding ownership is in merchant/runtime flows.',
    },
};

export function EmployeeModuleScreen({
    moduleKey,
    analytics,
    analyticsError,
}: {
    moduleKey: EmployeeModuleKey;
    analytics?: EmployeeAnalytics;
    analyticsError?: string;
}) {
    const copy = moduleCopy[moduleKey];

    return (
        <OpsWorkspace eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
            <MetricGrid>
                <OpsMetric label="Stores visible" value={String(analytics?.total_stores || 0)} detail="/v1/employees/analytics" />
                <OpsMetric label="Orders visible" value={String(analytics?.total_orders || 0)} detail="/v1/employees/analytics" />
                <OpsMetric label="Users visible" value={String(analytics?.total_users || 0)} detail="/v1/employees/analytics" />
                <OpsMetric
                    label="Module readiness"
                    value={moduleKey === 'merchant-health' && !analyticsError ? 'partial' : 'blocked'}
                    detail={analyticsError || copy.contract}
                    tone={moduleKey === 'merchant-health' && !analyticsError ? 'warning' : 'critical'}
                />
            </MetricGrid>

            <Panel title="Expected Workflow" description="Visible structure without inventing unavailable data.">
                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                    {copy.workflows.map((workflow) => (
                        <div
                            key={workflow}
                            className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]"
                        >
                            {workflow}
                        </div>
                    ))}
                </div>
            </Panel>

            <SkipBackendPanel title={`${copy.title} data contract`} contract={copy.contract}>
                {copy.skip}
            </SkipBackendPanel>
        </OpsWorkspace>
    );
}
