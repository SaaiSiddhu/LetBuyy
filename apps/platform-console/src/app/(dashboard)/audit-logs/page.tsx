import {
    Badge,
    Banner,
    Button,
    Card,
    Chart,
    ClipboardList,
    EmptyState,
    FilterBar,
    Input,
    MetricCard,
    Page,
    PageContent,
    PageHeader,
    Section,
    Select,
} from '@letbuyy/ui';
import {
    fetchConsoleApi,
    formatDateTime,
    readPageParam,
    readSearchParam,
    type ConsolePagination,
    type ConsolePaginatedResponse,
} from '@/lib/console-api';
import { AuditLogIndexTable, type ConsoleAuditLog } from './AuditLogIndexTable';

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const actorOptions = [
    { value: '', label: 'All actors' },
    { value: 'super_admin', label: 'Super admin' },
    { value: 'employee', label: 'Employee' },
    { value: 'system', label: 'System' },
    { value: 'user', label: 'User' },
];

export default async function AuditLogsPage({ searchParams }: PageProps) {
    const params = searchParams ? await searchParams : undefined;
    const q = readSearchParam(params, 'q');
    const actorType = readSearchParam(params, 'actor_type');
    const date = readSearchParam(params, 'date');
    const page = readPageParam(params);
    const [result, sampleResult] = await Promise.all([
        fetchConsoleApi<ConsolePaginatedResponse<ConsoleAuditLog>>('/internal/console/audit-logs', {
            q,
            actor_type: actorType,
            date,
            page,
            limit: 25,
        }),
        fetchConsoleApi<ConsolePaginatedResponse<ConsoleAuditLog>>('/internal/console/audit-logs', {
            page: 1,
            limit: 100,
        }),
    ]);
    const rows = result.data?.data || [];
    const sampleRows = sampleResult.data?.data || rows;
    const sampleMeta = sampleResult.data?.meta;
    const filterChipLabels = activeFilterChipLabels(q, actorType, date);
    const actorData = actorDistribution(sampleRows);
    const actionData = actionDistribution(sampleRows);
    const recentSignals = sensitiveSignals(sampleRows);
    const hasAggregateGap = Boolean(sampleMeta && sampleMeta.total > sampleRows.length);

    return (
        <Page className="max-w-none p-[var(--lb-space-5)] sm:p-[var(--lb-space-6)]">
            <PageHeader
                title="Audit Logs"
                description="Admin, employee, system, and user actions from the internal audit trail."
                icon={<ClipboardList />}
                showDescription
                secondaryActions={[{ label: 'Operations center', href: '/operations' }]}
            />

            <PageContent>
                {result.error ? (
                    <Banner title="Audit API unavailable" variant="critical">
                        {result.error}
                    </Banner>
                ) : null}

                {sampleResult.error ? (
                    <Banner title="Audit sample unavailable" variant="critical">
                        {sampleResult.error}
                    </Banner>
                ) : null}

                <div className="grid gap-[var(--lb-density-card-gap)] md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Total audit events" value={formatCount(result.data?.meta.total || sampleRows.length)} />
                    <MetricCard
                        label="Human actor events"
                        value={formatCount(countActorTypes(sampleRows, ['super_admin', 'employee', 'user']))}
                        delta={`${formatCount(sampleRows.length)} sampled records`}
                    />
                    <MetricCard
                        label="System events"
                        value={formatCount(countActorTypes(sampleRows, ['system']))}
                        delta="Automation and backend actors"
                    />
                    <MetricCard
                        label="Watchlist signals"
                        value={formatCount(recentSignals.length)}
                        delta="Sensitive actions in sample"
                    />
                </div>

                <Banner title="Audit evidence contract required" variant="warning">
                    Current `/internal/console/audit-logs` data is a paginated row feed. This page derives actor mix, action mix, and
                    watchlist signals from the first 100 rows; immutable event metadata, request IDs, outcome status, before/after diffs,
                    severity, and export/retention controls require a dedicated audit evidence contract.
                </Banner>

                <div className="grid gap-[var(--lb-density-card-gap)] xl:grid-cols-2">
                    <Card>
                        <Section title="Actor mix" description="Audit events grouped by actor type in the current sample.">
                            <Chart data={actorData} type="bar" height="sm" ariaLabel="Audit actor mix" />
                            {hasAggregateGap ? (
                                <p className="m-0 text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)]">
                                    Showing the first {formatCount(sampleRows.length)} of {formatCount(sampleMeta?.total || 0)} audit events.
                                </p>
                            ) : null}
                        </Section>
                    </Card>

                    <Card>
                        <Section title="Action mix" description="Most frequent audit actions in the current sample.">
                            <Chart data={actionData} type="bar" height="sm" ariaLabel="Audit action mix" />
                        </Section>
                    </Card>
                </div>

                <Card>
                    <Section title="Watchlist signals" description="Recent sensitive audit events from the sampled audit trail.">
                        <AuditSignalList rows={recentSignals} />
                    </Section>
                </Card>

                <Card>
                    <Section
                        title="Audit filters"
                        description="Search actor email, action, resource type, actor type, or constrain the feed by actor and date."
                    >
                        <form method="get">
                            <FilterBar
                                search={(
                                    <Input
                                        type="search"
                                        name="q"
                                        label="Search"
                                        defaultValue={q}
                                        placeholder="Search audit logs..."
                                    />
                                )}
                                filters={(
                                    <div className="grid gap-[var(--lb-space-3)] sm:grid-cols-[minmax(12rem,0.8fr)_minmax(10rem,0.7fr)]">
                                        <Select
                                            name="actor_type"
                                            label="Actor"
                                            defaultValue={actorType}
                                            options={actorOptions}
                                        />
                                        <Input
                                            type="date"
                                            name="date"
                                            label="Date"
                                            defaultValue={date}
                                        />
                                    </div>
                                )}
                                actions={<Button type="submit">Search</Button>}
                                chips={filterChipLabels.length > 0 ? (
                                    <>
                                        {filterChipLabels.map((label) => (
                                            <Badge key={label} label={label} variant="info" />
                                        ))}
                                    </>
                                ) : undefined}
                            />
                        </form>
                    </Section>
                </Card>

                {result.error ? null : (
                    <>
                        <AuditLogIndexTable rows={rows} filterChipLabels={filterChipLabels} />
                        {result.data?.meta ? <AuditPagination meta={result.data.meta} q={q} actorType={actorType} date={date} /> : null}
                    </>
                )}
            </PageContent>
        </Page>
    );
}

function AuditSignalList({ rows }: { rows: ConsoleAuditLog[] }) {
    if (rows.length === 0) {
        return (
            <EmptyState
                title="No watchlist signals in the current sample"
                body="The existing audit API returned no sensitive action rows for this sample."
                kind="generic"
            />
        );
    }

    return (
        <div className="grid gap-[var(--lb-space-3)] lg:grid-cols-2">
            {rows.map((row) => (
                <article
                    key={row.id}
                    className="grid gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]"
                >
                    <div className="flex flex-wrap items-start justify-between gap-[var(--lb-space-2)]">
                        <div>
                            <h3 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                {formatAction(row.action)}
                            </h3>
                            <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                {row.actor_email || row.actor_id || 'System actor'}
                            </p>
                        </div>
                        <Badge label={formatActorType(row.actor_type)} variant={actorVariant(row.actor_type)} />
                    </div>
                    <div className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)] sm:grid-cols-2">
                        <span>{formatResource(row)}</span>
                        <span>{formatDateTime(row.created_at)}</span>
                    </div>
                </article>
            ))}
        </div>
    );
}

function AuditPagination({ meta, q, actorType, date }: { meta: ConsolePagination; q: string; actorType: string; date: string }) {
    return (
        <nav
            aria-label="Audit logs pagination"
            className="flex flex-col gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-secondary)] text-[color:var(--lb-color-text-subdued)] sm:flex-row sm:items-center sm:justify-between"
        >
            <span>
                Page {meta.page} of {Math.max(meta.total_pages, 1)} - {formatCount(meta.total)} records
            </span>
            <div className="flex items-center gap-[var(--lb-space-2)]">
                <PaginationLink href={pageHref({ q, actorType, date, page: meta.page - 1 })} disabled={!meta.has_prev} label="Previous" />
                <PaginationLink href={pageHref({ q, actorType, date, page: meta.page + 1 })} disabled={!meta.has_next} label="Next" />
            </div>
        </nav>
    );
}

function PaginationLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
    const className = 'inline-flex h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)]';

    if (disabled) {
        return <span className={`${className} cursor-not-allowed opacity-50`}>{label}</span>;
    }

    return (
        <a
            href={href}
            className={`${className} text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]`}
        >
            {label}
        </a>
    );
}

function activeFilterChipLabels(q: string, actorType: string, date: string): string[] {
    const chips: string[] = [];

    if (q) chips.push(`Search: ${q}`);
    if (actorType) chips.push(`Actor: ${formatActorType(actorType)}`);
    if (date) chips.push(`Date: ${date}`);

    return chips;
}

function pageHref({ q, actorType, date, page }: { q: string; actorType: string; date: string; page: number }): string {
    const params = new URLSearchParams();

    if (q) params.set('q', q);
    if (actorType) params.set('actor_type', actorType);
    if (date) params.set('date', date);
    params.set('page', String(Math.max(page, 1)));

    return `/audit-logs?${params.toString()}`;
}

function actorDistribution(rows: ConsoleAuditLog[]) {
    return countedChartData(rows.map((row) => row.actor_type || 'system'));
}

function actionDistribution(rows: ConsoleAuditLog[]) {
    return countedChartData(rows.map((row) => row.action || 'unknown')).slice(0, 8);
}

function countedChartData(values: string[]) {
    const counts = new Map<string, number>();

    for (const value of values) {
        counts.set(value, (counts.get(value) || 0) + 1);
    }

    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label: formatAction(label), value }));
}

function sensitiveSignals(rows: ConsoleAuditLog[]): ConsoleAuditLog[] {
    return rows
        .filter((row) => isSensitiveAction(row.action))
        .sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at))
        .slice(0, 6);
}

function isSensitiveAction(action: string | null | undefined): boolean {
    const normalized = (action || '').toLowerCase();

    return ['mfa', 'logout', 'login', 'invite', 'delete', 'remove', 'suspend', 'role', 'permission', 'password', 'payment', 'refund', 'token']
        .some((keyword) => normalized.includes(keyword));
}

function countActorTypes(rows: ConsoleAuditLog[], actorTypes: string[]): number {
    const allowed = new Set(actorTypes);

    return rows.filter((row) => allowed.has((row.actor_type || '').toLowerCase())).length;
}

function timestamp(value: string | null | undefined): number {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatAction(value: string | null | undefined): string {
    return (value || 'unknown')
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatActorType(value: string | null | undefined): string {
    return formatAction(value || 'system');
}

function formatResource(row: ConsoleAuditLog): string {
    const type = formatAction(row.resource_type || 'resource');
    return row.resource_id ? `${type} ${row.resource_id}` : type;
}

function actorVariant(actorType: string | null | undefined): 'default' | 'info' | 'success' | 'warning' | 'critical' {
    const normalized = (actorType || '').toLowerCase();

    if (normalized === 'super_admin') return 'critical';
    if (normalized === 'employee') return 'warning';
    if (normalized === 'user') return 'info';
    if (normalized === 'system') return 'success';
    return 'default';
}

function formatCount(value: number): string {
    return value.toLocaleString('en-IN');
}
