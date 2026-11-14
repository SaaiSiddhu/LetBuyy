import {
    ConsoleWorkspace,
    LeadershipMetric,
    MetricGrid,
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
    readSearchParam,
    readPageParam,
    type ConsoleDataResponse,
} from '@/lib/console-api';
import { FoundingAdminControls } from '@/components/founding/FoundingAdminControls';

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type FoundingProgram = {
    total_slots: number;
    public_slots: number;
    invited_slots: number;
    partner_slots: number;
    used_slots: number;
    public_used: number;
    invited_used: number;
    partner_used: number;
    remaining_slots: number;
    launch_price: number;
    growth_price: number;
    active: boolean;
    paused: boolean;
    paused_reason: string | null;
};

type ReconcileResult = {
    status: string;
    stored?: Record<string, number>;
    actual?: Record<string, number>;
    repairable?: boolean;
};

type FoundingAllocation = {
    id: string;
    site_id: string;
    founding_number: number;
    allocation_source: string;
    plan_slug: string;
    locked_monthly_price: number;
    allocated_at: string | null;
    released_at: string | null;
    release_reason: string | null;
    founding_released: boolean;
};

const columns: Array<ConsoleDataColumn<FoundingAllocation>> = [
    {
        key: 'founding_number',
        header: '#',
        cell: (row) => <span className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">#{row.founding_number}</span>,
    },
    {
        key: 'site_id',
        header: 'Site',
        cell: (row) => <span className="text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">{row.site_id}</span>,
    },
    {
        key: 'allocation_source',
        header: 'Source',
        cell: (row) => <StatusBadge value={row.allocation_source} />,
    },
    {
        key: 'plan_slug',
        header: 'Plan',
        cell: (row) => row.plan_slug,
    },
    {
        key: 'locked',
        header: 'Locked price',
        cell: (row) => `${formatMoneyFromPaise(row.locked_monthly_price)}/mo`,
    },
    {
        key: 'allocated_at',
        header: 'Allocated',
        cell: (row) => formatDateTime(row.allocated_at),
    },
    {
        key: 'state',
        header: 'State',
        cell: (row) => row.released_at
            ? <span className="text-[var(--lb-color-text-subdued)]">Released — {row.release_reason || 'n/a'}</span>
            : <StatusBadge value="active" />,
    },
];

export default async function FoundingPage({ searchParams }: PageProps) {
    const params = searchParams ? await searchParams : undefined;
    const q = readSearchParam(params, 'q');
    const page = readPageParam(params);

    const overview = await fetchConsoleApi<ConsoleDataResponse<{ program: FoundingProgram | null; reconcile: ReconcileResult | null }>>(
        '/internal/founding/overview',
    );
    const allocationsResult = await fetchConsoleApi<ConsoleDataResponse<{ allocations: FoundingAllocation[]; page: number; per_page: number; total: number }>>(
        '/internal/founding/allocations',
        { search: q || '', limit: 25, page },
    );

    const program = overview.data?.data?.program ?? null;
    const reconcile = overview.data?.data?.reconcile ?? null;
    const allocationPage = allocationsResult.data?.data;
    const rows = allocationPage?.allocations ?? [];
    const meta = allocationPage ? { page: allocationPage.page, per_page: allocationPage.per_page, total: allocationPage.total,
        total_pages: Math.ceil(allocationPage.total / allocationPage.per_page), has_prev: allocationPage.page > 1,
        has_next: allocationPage.page * allocationPage.per_page < allocationPage.total } : undefined;

    const remaining = program?.remaining_slots ?? 0;
    const total = program?.total_slots ?? 100;

    return (
        <ConsoleWorkspace
            eyebrow="Founding program"
            title="Founding Merchant Administration"
            description="Slots overview, allocations, recovery operations, and program controls. Live counts come from the founding program (no manual numbers)."
        >
            {overview.error || !program ? (
                <ConsoleApiErrorPanel title="Founding API unavailable" message={overview.error || 'The founding programme has not been configured.'} />
            ) : (
                <>
                    <MetricGrid>
                        <LeadershipMetric label="Remaining" value={`${remaining} / ${total}`} tone={remaining === 0 ? 'warning' : undefined} />
                        <LeadershipMetric label="Allocated" value={String(program?.used_slots ?? 0)} />
                        <LeadershipMetric label="Public" value={`${program?.public_used ?? 0} / ${program?.public_slots ?? 70}`} />
                        <LeadershipMetric label="Invited" value={`${program?.invited_used ?? 0} / ${program?.invited_slots ?? 20}`} />
                        <LeadershipMetric label="Partner" value={`${program?.partner_used ?? 0} / ${program?.partner_slots ?? 10}`} />
                        <LeadershipMetric
                            label="Status"
                            value={program?.paused ? 'Paused' : program?.active ? 'Active' : 'Disabled'}
                            tone={program?.paused || !program?.active ? 'warning' : undefined}
                        />
                    </MetricGrid>

                    <FoundingAdminControls
                        active={Boolean(program?.active)}
                        paused={Boolean(program?.paused)}
                        reconcileStatus={reconcile?.status ?? 'unknown'}
                        reconcileRepairable={Boolean(reconcile?.repairable)}
                    />

                    <ConsoleSearchForm placeholder="Search by founding number or site id..." defaultValue={q} />

                    {allocationsResult.error ? (
                        <ConsoleApiErrorPanel title="Allocations unavailable" message={allocationsResult.error} />
                    ) : (
                        <ConsoleDataTable
                            columns={columns}
                            rows={rows}
                            meta={meta}
                            basePath="/founding"
                            query={{ q }}
                            emptyLabel="No founding allocations yet."
                            getRowKey={(row) => row.id}
                        />
                    )}

                    <a
                        href={'/api/founding/export?' + new URLSearchParams({q,page:String(page)}).toString()}
                        className="inline-flex min-h-11 w-fit items-center gap-[var(--lb-space-2)] rounded-lg border border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)] transition-colors hover:bg-[var(--lb-color-surface-subdued)]"
                    >
                        Export current page (CSV)
                    </a>
                </>
            )}
        </ConsoleWorkspace>
    );
}
