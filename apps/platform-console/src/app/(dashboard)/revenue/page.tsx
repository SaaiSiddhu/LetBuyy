import {
    ConsoleWorkspace,
    LeadershipMetric,
    MetricGrid,
    Panel,
    SkipBackendPanel,
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

type ConsoleSummary = {
    active_subscriptions: number;
    total_subscriptions: number;
    monthly_revenue_paise: number;
};

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

export default async function RevenuePage() {
    const [summaryResult, subscriptionsResult] = await Promise.all([
        fetchConsoleApi<ConsoleDataResponse<ConsoleSummary>>('/internal/console/summary'),
        fetchConsoleApi<ConsolePaginatedResponse<ConsoleSubscription>>('/internal/console/subscriptions', {
            page: 1,
            limit: 10,
        }),
    ]);
    const summary = summaryResult.data?.data;
    const rows = subscriptionsResult.data?.data || [];
    const pageRevenuePaise = rows.reduce((total, row) => total + Number(row.amount_paid || 0), 0);
    const activeRows = rows.filter((row) => row.status === 'active').length;
    const trialRows = rows.filter((row) => row.status === 'trialing').length;

    return (
        <ConsoleWorkspace
            eyebrow="Revenue"
            title="Revenue"
            description="Leadership billing view built from the existing console summary and subscription list contracts."
        >
            {summaryResult.error ? <ConsoleApiErrorPanel title="Summary API unavailable" message={summaryResult.error} /> : null}
            {subscriptionsResult.error ? <ConsoleApiErrorPanel title="Subscriptions API unavailable" message={subscriptionsResult.error} /> : null}

            <MetricGrid>
                <LeadershipMetric label="Monthly recurring value" value={formatMoneyFromPaise(summary?.monthly_revenue_paise || 0)} />
                <LeadershipMetric label="Active subscriptions" value={`${summary?.active_subscriptions || 0}/${summary?.total_subscriptions || 0}`} />
                <LeadershipMetric label="Latest page value" value={formatMoneyFromPaise(pageRevenuePaise)} />
                <LeadershipMetric label="Trials on latest page" value={String(trialRows)} tone="warning" />
            </MetricGrid>

            <Panel
                title="Recent Billing Records"
                description="Latest subscription records from /v1/internal/console/subscriptions."
            >
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
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
                    </table>
                </div>
                <p className="m-0 mt-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    Active records on latest page: {activeRows}. Full revenue cohorts need a dedicated aggregate endpoint.
                </p>
            </Panel>

            <SkipBackendPanel title="Cohort revenue, churn, refunds, and invoices" contract="/v1/internal/console/revenue">
                The current gateway exposes summary totals and subscription rows only. Leadership-grade MRR cohorts, churn, refunds, invoice aging, and net revenue require backend projections.
            </SkipBackendPanel>
        </ConsoleWorkspace>
    );
}
