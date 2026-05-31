import {
    ConsoleApiErrorPanel,
    ConsoleDataTable,
    ConsoleSearchForm,
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

type ConsoleAuditLog = {
    id: string;
    actor_id: string | null;
    actor_type: string | null;
    actor_email: string | null;
    action: string | null;
    resource_type: string | null;
    resource_id: string | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string | null;
};

const columns: Array<ConsoleDataColumn<ConsoleAuditLog>> = [
    {
        key: 'actor',
        header: 'Actor',
        cell: (row) => (
            <div>
                <p className="font-medium text-zinc-100">{row.actor_email || row.actor_id || '-'}</p>
                <p className="mt-1 text-xs text-zinc-500">{row.actor_type || 'system'}</p>
            </div>
        ),
    },
    {
        key: 'action',
        header: 'Action',
        cell: (row) => row.action || '-',
    },
    {
        key: 'resource',
        header: 'Resource',
        cell: (row) => (
            <div>
                <p>{row.resource_type || '-'}</p>
                <p className="mt-1 text-xs text-zinc-500">{row.resource_id || '-'}</p>
            </div>
        ),
    },
    {
        key: 'source',
        header: 'Source',
        cell: (row) => row.ip_address || '-',
    },
    {
        key: 'time',
        header: 'Time',
        cell: (row) => formatDateTime(row.created_at),
    },
];

export default async function AuditLogsPage({ searchParams }: PageProps) {
    const params = searchParams ? await searchParams : undefined;
    const q = readSearchParam(params, 'q');
    const actorType = readSearchParam(params, 'actor_type');
    const date = readSearchParam(params, 'date');
    const page = readPageParam(params);
    const result = await fetchConsoleApi<ConsolePaginatedResponse<ConsoleAuditLog>>('/internal/console/audit-logs', {
        q,
        actor_type: actorType,
        date,
        page,
        limit: 25,
    });

    return (
        <div className="space-y-6 p-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-50">Audit Logs</h1>
                    <p className="mt-1 text-sm text-zinc-400">Admin, employee, system, and user actions.</p>
                </div>
                <ConsoleSearchForm placeholder="Search audit logs..." defaultValue={q}>
                    <select
                        name="actor_type"
                        defaultValue={actorType}
                        className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-sky-500"
                    >
                        <option value="">All actors</option>
                        <option value="super_admin">Super admin</option>
                        <option value="employee">Employee</option>
                        <option value="system">System</option>
                        <option value="user">User</option>
                    </select>
                    <input
                        type="date"
                        name="date"
                        defaultValue={date}
                        className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-sky-500"
                    />
                </ConsoleSearchForm>
            </div>

            {result.error ? (
                <ConsoleApiErrorPanel title="Audit API unavailable" message={result.error} />
            ) : (
                <ConsoleDataTable
                    columns={columns}
                    rows={result.data?.data || []}
                    meta={result.data?.meta}
                    basePath="/audit-logs"
                    query={{ q, actor_type: actorType, date }}
                    emptyLabel="No audit logs matched the current filters."
                    getRowKey={(row) => row.id}
                />
            )}
        </div>
    );
}
