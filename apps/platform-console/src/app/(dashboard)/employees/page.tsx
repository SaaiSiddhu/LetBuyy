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

type ConsoleEmployee = {
    id: string;
    user_id: string | null;
    email: string | null;
    full_name: string | null;
    phone: string | null;
    role: string | null;
    is_active: boolean | null;
    last_login_at: string | null;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
};

const columns: Array<ConsoleDataColumn<ConsoleEmployee>> = [
    {
        key: 'employee',
        header: 'Employee',
        cell: (row) => (
            <div>
                <p className="font-medium text-zinc-100">{row.full_name || row.email || '-'}</p>
                <p className="mt-1 text-xs text-zinc-500">{row.email || row.id}</p>
            </div>
        ),
    },
    {
        key: 'role',
        header: 'Role',
        cell: (row) => row.role || '-',
    },
    {
        key: 'status',
        header: 'Status',
        cell: (row) => (
            <StatusBadge
                value={row.is_active ? 'active' : 'inactive'}
                tone={row.is_active ? 'green' : 'red'}
            />
        ),
    },
    {
        key: 'last-login',
        header: 'Last Login',
        cell: (row) => formatDateTime(row.last_login_at),
    },
    {
        key: 'created',
        header: 'Created',
        cell: (row) => formatDateTime(row.created_at),
    },
];

export default async function EmployeesPage({ searchParams }: PageProps) {
    const params = searchParams ? await searchParams : undefined;
    const q = readSearchParam(params, 'q');
    const status = readSearchParam(params, 'status');
    const page = readPageParam(params);
    const result = await fetchConsoleApi<ConsolePaginatedResponse<ConsoleEmployee>>('/internal/console/employees', {
        q,
        status,
        page,
        limit: 25,
    });

    return (
        <div className="space-y-6 p-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-50">Employees</h1>
                    <p className="mt-1 text-sm text-zinc-400">Support, operations, and platform team members.</p>
                </div>
                <ConsoleSearchForm placeholder="Search employees..." defaultValue={q}>
                    <select
                        name="status"
                        defaultValue={status}
                        className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-sky-500"
                    >
                        <option value="">All status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </ConsoleSearchForm>
            </div>

            {result.error ? (
                <ConsoleApiErrorPanel title="Employees API unavailable" message={result.error} />
            ) : (
                <ConsoleDataTable
                    columns={columns}
                    rows={result.data?.data || []}
                    meta={result.data?.meta}
                    basePath="/employees"
                    query={{ q, status }}
                    emptyLabel="No employees matched the current filters."
                    getRowKey={(row) => row.id}
                />
            )}
        </div>
    );
}
