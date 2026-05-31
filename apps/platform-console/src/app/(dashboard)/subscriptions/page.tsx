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
        <div className="space-y-6 p-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-50">Subscriptions & Billing</h1>
                    <p className="mt-1 text-sm text-zinc-400">Revenue, invoices, and plan management.</p>
                </div>
                <ConsoleSearchForm placeholder="Search subscriptions..." defaultValue={q}>
                    <select
                        name="status"
                        defaultValue={status}
                        className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-sky-500"
                    >
                        <option value="">All status</option>
                        <option value="active">Active</option>
                        <option value="trialing">Trialing</option>
                        <option value="past_due">Past due</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </ConsoleSearchForm>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <MetricTile label="Page Revenue" value={formatMoneyFromPaise(pageRevenuePaise)} />
                <MetricTile label="Active On Page" value={String(rows.filter((row) => row.status === 'active').length)} />
                <MetricTile label="Total Records" value={String(result.data?.meta.total || 0)} />
            </div>

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
        </div>
    );
}

function MetricTile({ label, value }: { label: string; value: string }) {
    return (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-medium text-zinc-400">{label}</p>
            <p className="mt-2 text-2xl font-bold text-zinc-50">{value}</p>
        </section>
    );
}
