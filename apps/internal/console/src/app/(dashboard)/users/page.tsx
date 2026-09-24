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

type ConsoleUser = {
    id: string;
    email: string | null;
    email_verified: boolean | null;
    full_name: string | null;
    auth_provider: string | null;
    created_at: string | null;
    updated_at: string | null;
};

const columns: Array<ConsoleDataColumn<ConsoleUser>> = [
    {
        key: 'email',
        header: 'Email',
        cell: (row) => (
            <div>
                <p className="font-medium text-zinc-100">{row.email || '-'}</p>
                <p className="mt-1 text-xs text-zinc-500">{row.id}</p>
            </div>
        ),
    },
    {
        key: 'name',
        header: 'Name',
        cell: (row) => row.full_name || '-',
    },
    {
        key: 'provider',
        header: 'Provider',
        cell: (row) => row.auth_provider || 'email',
    },
    {
        key: 'verified',
        header: 'Verified',
        cell: (row) => (
            <StatusBadge
                value={row.email_verified ? 'verified' : 'unverified'}
                tone={row.email_verified ? 'green' : 'amber'}
            />
        ),
    },
    {
        key: 'created',
        header: 'Created',
        cell: (row) => formatDateTime(row.created_at),
    },
];

export default async function UsersPage({ searchParams }: PageProps) {
    const params = searchParams ? await searchParams : undefined;
    const q = readSearchParam(params, 'q');
    const page = readPageParam(params);
    const result = await fetchConsoleApi<ConsolePaginatedResponse<ConsoleUser>>('/internal/console/users', {
        q,
        page,
        limit: 25,
    });

    return (
        <div className="space-y-6 p-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-50">Users</h1>
                    <p className="mt-1 text-sm text-zinc-400">All platform identity records.</p>
                </div>
                <ConsoleSearchForm placeholder="Search users..." defaultValue={q} />
            </div>

            {result.error ? (
                <ConsoleApiErrorPanel title="Users API unavailable" message={result.error} />
            ) : (
                <ConsoleDataTable
                    columns={columns}
                    rows={result.data?.data || []}
                    meta={result.data?.meta}
                    basePath="/users"
                    query={{ q }}
                    emptyLabel="No users matched the current filters."
                    getRowKey={(row) => row.id}
                />
            )}
        </div>
    );
}
