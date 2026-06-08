import Link from 'next/link';
import {
    ConsoleWorkspace,
    Panel,
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
    readPageParam,
    readSearchParam,
    type ConsolePaginatedResponse,
} from '@/lib/console-api';

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ConsoleStore = {
    id: string;
    user_id: string | null;
    name: string | null;
    store_name: string | null;
    site_type: string | null;
    subdomain: string | null;
    custom_domain: string | null;
    status: string | null;
    published_at: string | null;
    views_count: number | null;
    created_at: string | null;
    updated_at: string | null;
};

const columns: Array<ConsoleDataColumn<ConsoleStore>> = [
    {
        key: 'store',
        header: 'Store',
        cell: (row) => (
            <div>
                <Link
                    href={`/merchants/${row.id}`}
                    className="font-medium text-zinc-100 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                >
                    {row.store_name || row.name || '-'}
                </Link>
                <p className="mt-1 text-xs text-zinc-500">{row.subdomain ? `${row.subdomain}.letbuyy.store` : row.id}</p>
            </div>
        ),
    },
    {
        key: 'type',
        header: 'Type',
        cell: (row) => row.site_type || 'ecommerce',
    },
    {
        key: 'status',
        header: 'Status',
        cell: (row) => <StatusBadge value={row.status || 'draft'} />,
    },
    {
        key: 'views',
        header: 'Views',
        cell: (row) => Number(row.views_count || 0).toLocaleString('en-IN'),
    },
    {
        key: 'created',
        header: 'Created',
        cell: (row) => formatDateTime(row.created_at),
    },
];

export default async function StoresPage({ searchParams }: PageProps) {
    const params = searchParams ? await searchParams : undefined;
    const q = readSearchParam(params, 'q');
    const status = readSearchParam(params, 'status');
    const page = readPageParam(params);
    const result = await fetchConsoleApi<ConsolePaginatedResponse<ConsoleStore>>('/internal/console/stores', {
        q,
        status,
        page,
        limit: 25,
    });

    return (
        <ConsoleWorkspace
            eyebrow="Merchant operations"
            title="Merchant Directory"
            description="Tenant sites remain stored as sites in the database and are presented as stores in platform UI."
        >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <ConsoleSearchForm placeholder="Search stores..." defaultValue={q}>
                    <select
                        name="status"
                        defaultValue={status}
                        className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none transition-colors focus:border-[var(--lb-color-primary)]"
                    >
                        <option value="">All status</option>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="suspended">Suspended</option>
                    </select>
                </ConsoleSearchForm>
            </div>

            {result.error ? (
                <ConsoleApiErrorPanel title="Stores API unavailable" message={result.error} />
            ) : (
                <ConsoleDataTable
                    columns={columns}
                    rows={result.data?.data || []}
                    meta={result.data?.meta}
                    basePath="/stores"
                    query={{ q, status }}
                    emptyLabel="No stores matched the current filters."
                    getRowKey={(row) => row.id}
                />
            )}
            <Panel title="Merchant 360 actions" description="Open any merchant row to view risk, Trust & Safety, support, app, theme, audit, impersonation, and dual-control moderation context.">
                <Link href="/merchants" className="text-sm font-medium text-[var(--lb-color-primary)] underline-offset-4 hover:underline">
                    Open Merchant 360 search
                </Link>
            </Panel>
        </ConsoleWorkspace>
    );
}
