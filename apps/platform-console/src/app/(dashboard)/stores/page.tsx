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
                <p className="font-medium text-zinc-100">{row.store_name || row.name || '-'}</p>
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
        <div className="space-y-6 p-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-50">Stores</h1>
                    <p className="mt-1 text-sm text-zinc-400">All tenant sites exposed as stores in merchant UI.</p>
                </div>
                <ConsoleSearchForm placeholder="Search stores..." defaultValue={q}>
                    <select
                        name="status"
                        defaultValue={status}
                        className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-sky-500"
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
        </div>
    );
}
