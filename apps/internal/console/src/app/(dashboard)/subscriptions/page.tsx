import {
    ConsoleWorkspace,
    LeadershipMetric,
    MetricGrid,
    SkipBackendPanel,
} from '@/components/_local-ui/console-workspace';
import {
    ConsoleApiErrorPanel,
    ConsoleDataTable,
    ConsoleSearchForm,
    StatusBadge,
    type ConsoleDataColumn,
} from '@/components/ConsoleDataTable';
import {
    fetchConsoleApi,
    formatDateTime,
    formatMoneyFromPaise,
    readPageParam,
    readSearchParam,
    type ConsolePaginatedResponse,
} from '@/lib/console-api';

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ConsoleSubscription = {
    id: string;
    user_id: string | null;
    store_id: string | null;
    plan: string | null;
    status: string | null;
    billing_period: string | null;
    payment_gateway: string | null;
    amount_paid: number | string | null;
    currency: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    created_at: string | null;
    updated_at: string | null;
};

const columns: Array<ConsoleDataColumn<ConsoleSubscription>> = [
    {
        key: 'plan',
        header: 'Plan',
        cell: (row) => (
            <div>
                <p className="font-medium text-zinc-100">{row.plan || 'free'}</p>
                <p className="mt-1 text-xs text-zinc-500">{row.billing_period || 'monthly'}</p>
            </div>
        ),
    },
    {
        key: 'status',
        header: 'Status',
        cell: (row) => <StatusBadge value={row.status || 'active'} />,
    },
    {
        key: 'amount',
        header: 'Amount',
        cell: (row) => formatMoneyFromPaise(row.amount_paid, row.currency || 'INR'),
    },
    {
        key: 'gateway',
        header: 'Gateway',
        cell: (row) => row.payment_gateway || '-',
    },
    {
        key: 'period',
        header: 'Current Period',
        cell: (row) => (
            <div>
                <p>{formatDateTime(row.current_period_start)}</p>
                <p className="mt-1 text-xs text-zinc-500">{formatDateTime(row.current_period_end)}</p>
            </div>
        ),
    },
    {
        key: 'created',
        header: 'Created',
        cell: (row) => formatDateTime(row.created_at),
    },
];

export default async function SubscriptionsPage({ searchParams }: PageProps) {
    const params = searchParams ? await searchParams : undefined;
    const q = readSearchParam(params, 'q');
    const status = readSearchParam(params, 'status');
    const page = readPageParam(params);
    const result = await fetchConsoleApi<ConsolePaginatedResponse<ConsoleSubscription>>('/internal/console/subscriptions', {
        q,
        status,
        page,
        limit: 25,
    });
    const rows = result.data?.data || [];
    const pageRevenuePaise = rows.reduce((total, row) => total + Number(row.amount_paid || 0), 0);

    return (
        <ConsoleWorkspace
            eyebrow="Billing control"
            title="Subscriptions"
            description="Plan status, paid value, payment gateway, and current billing periods from the console subscription list endpoint."
        >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <ConsoleSearchForm placeholder="Search subscriptions..." defaultValue={q}>
                    <select
                        name="status"
                        defaultValue={status}
                        className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none transition-colors focus:border-[var(--lb-color-primary)]"
                    >
                        <option value="">All status</option>
                        <option value="active">Active</option>
                        <option value="trialing">Trialing</option>
                        <option value="past_due">Past due</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </ConsoleSearchForm>
            </div>

            <MetricGrid>
                <LeadershipMetric label="Page revenue" value={formatMoneyFromPaise(pageRevenuePaise)} />
                <LeadershipMetric label="Active on page" value={String(rows.filter((row) => row.status === 'active').length)} />
                <LeadershipMetric label="Total records" value={String(result.data?.meta.total || 0)} />
                <LeadershipMetric label="Past due on page" value={String(rows.filter((row) => row.status === 'past_due').length)} tone="warning" />
            </MetricGrid>

            {result.error ? (
                <ConsoleApiErrorPanel title="Subscriptions API unavailable" message={result.error} />
            ) : (
                <ConsoleDataTable
                    columns={columns}
                    rows={rows}
                    meta={result.data?.meta}
                    basePath="/subscriptions"
                    query={{ q, status }}
                    emptyLabel="No subscriptions matched the current filters."
                    getRowKey={(row) => row.id}
                />
            )}
            <SkipBackendPanel title="Invoices and subscription mutations" contract="/v1/internal/console/invoices and /v1/internal/console/subscriptions/:id">
                The gateway exposes read-only subscription listing. Invoice download, plan override, cancellation, and retry actions need audited backend mutations.
            </SkipBackendPanel>
        </ConsoleWorkspace>
    );
}
