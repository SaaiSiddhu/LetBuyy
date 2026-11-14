import Link from 'next/link';
import {
    ConsoleWorkspace,
    LeadershipMetric,
    MetricGrid,
    SkipBackendPanel,
    StatusPill,
} from '@/components/_local-ui/console-workspace';
import {
    ConsoleApiErrorPanel,
    ConsoleDataTable,
    ConsoleSearchForm,
    type ConsoleDataColumn,
} from '@/components/ConsoleDataTable';
import { presentStatus, SUBSCRIPTION_STATUS_PRESENTATION } from '@letbuyy/shared-types';
import { Select } from '@letbuyy/ui';
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
    site_id: string | null;
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
    {key:'merchant',header:'Merchant',cell:row=>(row.site_id||row.store_id)?<Link className="underline" href={'/merchants/'+(row.site_id||row.store_id)+'/billing'}>Investigate billing</Link>:<span>Store not recorded</span>},
    {
        key: 'plan',
        header: 'Plan',
        cell: (row) => (
            <div>
                <p className="font-medium text-default">{row.plan || 'free'}</p>
                <p className="mt-1 text-xs text-subdued">{row.billing_period || 'monthly'}</p>
            </div>
        ),
    },
    {
        key: 'status',
        header: 'Status',
        cell: (row) => {
            const status = presentStatus(SUBSCRIPTION_STATUS_PRESENTATION, row.status);
            return <StatusPill value={row.status || 'unknown'} label={status.label} tone={status.tone} />;
        },
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
                <p className="mt-1 text-xs text-subdued">{formatDateTime(row.current_period_end)}</p>
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
            description="Review plan status, payments, and the current billing period for each subscription."
        >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <ConsoleSearchForm placeholder="Search subscriptions..." defaultValue={q}>
                    <Select aria-label="Status"
                        name="status"
                        defaultValue={status}
                        options={[{ value: '', label: 'All statuses' }, ...Object.entries(SUBSCRIPTION_STATUS_PRESENTATION).map(([value, presentation]) => ({ value, label: presentation.label }))]}
                    />
                </ConsoleSearchForm>
            </div>

            <MetricGrid>
                <LeadershipMetric label="Page revenue" value={result.data ? formatMoneyFromPaise(pageRevenuePaise) : 'Unavailable'} />
                <LeadershipMetric label="Active on page" value={result.data ? String(rows.filter((row) => row.status === 'active').length) : 'Unavailable'} />
                <LeadershipMetric label="Total records" value={result.data ? String(result.data.meta.total) : 'Unavailable'} />
                <LeadershipMetric label="Past due on page" value={result.data ? String(rows.filter((row) => row.status === 'past_due').length) : 'Unavailable'} tone="warning" />
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
                The gateway exposes read-only subscription listing. Open the store billing workspace for invoice record summaries, payment and renewal evidence. Plan changes, cancellation and charges remain in their canonical merchant workflow.
            </SkipBackendPanel>
        </ConsoleWorkspace>
    );
}
