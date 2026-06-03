import {
    Badge,
    Banner,
    Button,
    Card,
    FilterBar,
    Input,
    MetricCard,
    Page,
    PageContent,
    PageHeader,
    Section,
    Store,
} from '@letbuyy/ui';
import {
    fetchConsoleApi,
    formatMoneyFromPaise,
    readPageParam,
    readSearchParam,
    type ConsolePagination,
    type ConsolePaginatedResponse,
} from '@/lib/console-api';
import { StoreDirectoryIndexTable, type ConsoleStore } from './StoreDirectoryIndexTable';

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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
    const rows = result.data?.data || [];
    const meta = result.data?.meta;
    const hasPlanRevenueGaps = rows.some((row) => !storePlan(row) || storeRevenuePaise(row) === null);
    const filterChipLabels = activeFilterChipLabels(q, status);

    return (
        <Page className="max-w-none p-[var(--lb-space-5)] sm:p-[var(--lb-space-6)]">
            <PageHeader
                title="Merchant Directory"
                description="All stores across the platform, with lifecycle status, billing plan, revenue readiness, and creation history."
                icon={<Store />}
                showDescription
                secondaryActions={[{ label: 'Reset filters', href: '/stores' }]}
            />

            <PageContent>
                <div className="grid gap-[var(--lb-density-card-gap)] sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Total stores" value={formatCount(meta?.total ?? rows.length)} />
                    <MetricCard label="Published on page" value={formatCount(countByStatus(rows, ['published', 'active']))} />
                    <MetricCard label="Suspended on page" value={formatCount(countByStatus(rows, ['suspended', 'inactive']))} />
                    <MetricCard
                        label="Page revenue"
                        value={pageRevenueLabel(rows)}
                        delta={hasReportedRevenue(rows) ? 'Reported by current API payload' : 'Awaiting revenue fields'}
                        deltaTone={hasReportedRevenue(rows) ? 'neutral' : 'negative'}
                    />
                </div>

                {hasPlanRevenueGaps ? (
                    <Banner title="Plan and revenue contract required" variant="warning">
                        Current `/internal/console/stores` rows do not consistently expose plan name, subscription status, currency, or
                        revenue paise. The directory keeps those columns visible and marks missing values as backend-needed.
                    </Banner>
                ) : null}

                <Card>
                    <Section
                        title="Directory filters"
                        description="Search by store or merchant identifiers and narrow the lifecycle status."
                    >
                        <form method="get">
                            <FilterBar
                                search={(
                                    <Input
                                        type="search"
                                        name="q"
                                        label="Search"
                                        defaultValue={q}
                                        placeholder="Search stores..."
                                    />
                                )}
                                filters={(
                                    <label className="flex min-w-[12rem] flex-col gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-small)] text-[color:var(--lb-color-text)]">
                                        Status
                                        <select
                                            name="status"
                                            defaultValue={status}
                                            className="h-[var(--lb-density-input-height)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-component-input-text)] outline-none transition-colors focus:border-[var(--lb-component-input-focus-border)] focus:ring-2 focus:ring-[var(--lb-component-input-focus-ring)]"
                                        >
                                            <option value="">All status</option>
                                            <option value="draft">Draft</option>
                                            <option value="published">Published</option>
                                            <option value="suspended">Suspended</option>
                                        </select>
                                    </label>
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

                {result.error ? (
                    <Banner title="Stores API unavailable" variant="critical">
                        {result.error}
                    </Banner>
                ) : (
                    <>
                        <StoreDirectoryIndexTable rows={rows} filterChipLabels={filterChipLabels} />
                        {meta ? <DirectoryPagination meta={meta} q={q} status={status} /> : null}
                    </>
                )}
            </PageContent>
        </Page>
    );
}

function activeFilterChipLabels(q: string, status: string): string[] {
    const chips: string[] = [];

    if (q) {
        chips.push(`Search: ${q}`);
    }

    if (status) {
        chips.push(`Status: ${formatStatusLabel(status)}`);
    }

    return chips;
}

function DirectoryPagination({ meta, q, status }: { meta: ConsolePagination; q: string; status: string }) {
    return (
        <nav
            aria-label="Stores pagination"
            className="flex flex-col gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-secondary)] text-[color:var(--lb-color-text-subdued)] sm:flex-row sm:items-center sm:justify-between"
        >
            <span>
                Page {meta.page} of {Math.max(meta.total_pages, 1)} - {formatCount(meta.total)} records
            </span>
            <div className="flex items-center gap-[var(--lb-space-2)]">
                <PaginationLink href={pageHref({ q, status, page: meta.page - 1 })} disabled={!meta.has_prev} label="Previous" />
                <PaginationLink href={pageHref({ q, status, page: meta.page + 1 })} disabled={!meta.has_next} label="Next" />
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

function pageHref({ q, status, page }: { q: string; status: string; page: number }): string {
    const params = new URLSearchParams();

    if (q) params.set('q', q);
    if (status) params.set('status', status);
    params.set('page', String(Math.max(page, 1)));

    return `/stores?${params.toString()}`;
}

function storePlan(row: ConsoleStore): string | null {
    return firstNonEmpty(row.plan_name, row.subscription_plan, row.plan);
}

function storeRevenuePaise(row: ConsoleStore): number | string | null {
    return firstValue(row.monthly_revenue_paise, row.revenue_paise, row.total_revenue_paise, row.orders_revenue_paise);
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
    for (const value of values) {
        const trimmed = value?.trim();
        if (trimmed) return trimmed;
    }

    return null;
}

function firstValue(...values: Array<number | string | null | undefined>): number | string | null {
    for (const value of values) {
        if (value !== null && value !== undefined && value !== '') return value;
    }

    return null;
}

function formatStatusLabel(status: string): string {
    return status
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function countByStatus(rows: ConsoleStore[], statuses: string[]): number {
    const allowed = new Set(statuses);

    return rows.filter((row) => allowed.has((row.status || '').toLowerCase())).length;
}

function hasReportedRevenue(rows: ConsoleStore[]): boolean {
    return rows.some((row) => storeRevenuePaise(row) !== null);
}

function pageRevenueLabel(rows: ConsoleStore[]): string {
    const reportedRows = rows.filter((row) => storeRevenuePaise(row) !== null);

    if (reportedRows.length === 0) return 'Needs backend';

    const currency = reportedRows[0]?.currency || 'INR';
    const paise = reportedRows.reduce((total, row) => total + Number(storeRevenuePaise(row) || 0), 0);

    return formatMoneyFromPaise(paise, currency);
}

function formatCount(value: number): string {
    return value.toLocaleString('en-IN');
}
