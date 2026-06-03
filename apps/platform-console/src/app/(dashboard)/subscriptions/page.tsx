import {
    Badge,
    Banner,
    Button,
    Card,
    Chart,
    CreditCard,
    EmptyState,
    FilterBar,
    Input,
    MetricCard,
    Page,
    PageContent,
    PageHeader,
    Section,
} from '@letbuyy/ui';
import {
    fetchConsoleApi,
    formatDateTime,
    formatMoneyFromPaise,
    readPageParam,
    readSearchParam,
    type ConsolePagination,
    type ConsolePaginatedResponse,
} from '@/lib/console-api';
import { SubscriptionManagementIndexTable, type ConsoleSubscription } from './SubscriptionManagementIndexTable';

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SubscriptionsPage({ searchParams }: PageProps) {
    const params = searchParams ? await searchParams : undefined;
    const q = readSearchParam(params, 'q');
    const status = readSearchParam(params, 'status');
    const page = readPageParam(params);
    const [result, sampleResult] = await Promise.all([
        fetchConsoleApi<ConsolePaginatedResponse<ConsoleSubscription>>('/internal/console/subscriptions', {
            q,
            status,
            page,
            limit: 25,
        }),
        fetchConsoleApi<ConsolePaginatedResponse<ConsoleSubscription>>('/internal/console/subscriptions', {
            page: 1,
            limit: 100,
        }),
    ]);
    const rows = result.data?.data || [];
    const sampleRows = sampleResult.data?.data || rows;
    const sampleMeta = sampleResult.data?.meta;
    const filterChipLabels = activeFilterChipLabels(q, status);
    const planData = planDistribution(sampleRows);
    const upcomingRenewals = renewalRows(sampleRows);
    const cancellations = cancellationRows(sampleRows);
    const hasAggregateGap = Boolean(sampleMeta && sampleMeta.total > sampleRows.length);

    return (
        <Page className="max-w-none p-[var(--lb-space-5)] sm:p-[var(--lb-space-6)]">
            <PageHeader
                title="Subscription Management"
                description="Plan distribution, renewal readiness, cancellation signals, and subscription records from the internal console API."
                icon={<CreditCard />}
                showDescription
                secondaryActions={[{ label: 'Revenue dashboard', href: '/analytics' }]}
            />

            <PageContent>
                {result.error ? (
                    <Banner title="Subscriptions API unavailable" variant="critical">
                        {result.error}
                    </Banner>
                ) : null}

                {sampleResult.error ? (
                    <Banner title="Subscription sample unavailable" variant="critical">
                        {sampleResult.error}
                    </Banner>
                ) : null}

                <div className="grid gap-[var(--lb-density-card-gap)] md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Total subscriptions" value={formatCount(result.data?.meta.total || sampleRows.length)} />
                    <MetricCard
                        label="Active in sample"
                        value={formatCount(countByStatus(sampleRows, ['active', 'trialing']))}
                        delta={`${formatCount(sampleRows.length)} sampled records`}
                    />
                    <MetricCard
                        label="Sample revenue"
                        value={formatMoneyFromPaise(sumRevenue(sampleRows), sampleRows[0]?.currency || 'INR')}
                        delta="From visible subscription rows"
                    />
                    <MetricCard
                        label="Upcoming renewals"
                        value={formatCount(upcomingRenewals.length)}
                        delta="Current period ending soon"
                    />
                </div>

                <Banner title="Subscription aggregate contract required" variant="warning">
                    Current `/internal/console/subscriptions` data is paginated and supports row-level search/status filtering. This page
                    derives plan distribution, upcoming renewals, and recent cancellations from the first 100 rows; full-platform aggregate
                    accuracy requires dedicated subscription analytics fields.
                </Banner>

                <div className="grid gap-[var(--lb-density-card-gap)] xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]">
                    <Card>
                        <Section
                            title="Plan distribution"
                            description="Plan mix derived from current subscription rows."
                        >
                            <Chart
                                data={planData}
                                type="bar"
                                height="md"
                                ariaLabel="Subscription plan distribution"
                            />
                            {hasAggregateGap ? (
                                <p className="m-0 text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)]">
                                    Showing the first {formatCount(sampleRows.length)} of {formatCount(sampleMeta?.total || 0)} subscriptions.
                                </p>
                            ) : null}
                        </Section>
                    </Card>

                    <Card>
                        <Section
                            title="Renewal queue"
                            description="Active or trialing subscriptions with the nearest period end."
                        >
                            <SubscriptionSignalList rows={upcomingRenewals} emptyTitle="No upcoming renewals in the current sample" />
                        </Section>
                    </Card>
                </div>

                <Card>
                    <Section
                        title="Recent cancellations"
                        description="Cancelled subscription rows from the current sample."
                    >
                        <SubscriptionSignalList rows={cancellations} emptyTitle="No recent cancellations in the current sample" />
                    </Section>
                </Card>

                <Card>
                    <Section
                        title="Subscription filters"
                        description="Search by plan, status, payment gateway, or provider subscription id."
                    >
                        <form method="get">
                            <FilterBar
                                search={(
                                    <Input
                                        type="search"
                                        name="q"
                                        label="Search"
                                        defaultValue={q}
                                        placeholder="Search subscriptions..."
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
                                            <option value="active">Active</option>
                                            <option value="trialing">Trialing</option>
                                            <option value="past_due">Past due</option>
                                            <option value="cancelled">Cancelled</option>
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

                {result.error ? null : (
                    <>
                        <SubscriptionManagementIndexTable rows={rows} filterChipLabels={filterChipLabels} />
                        {result.data?.meta ? <DirectoryPagination meta={result.data.meta} q={q} status={status} /> : null}
                    </>
                )}
            </PageContent>
        </Page>
    );
}

function SubscriptionSignalList({ rows, emptyTitle }: { rows: ConsoleSubscription[]; emptyTitle: string }) {
    if (rows.length === 0) {
        return (
            <EmptyState
                title={emptyTitle}
                body="The existing subscription API returned no matching rows for this signal."
                kind="generic"
            />
        );
    }

    return (
        <div className="grid gap-[var(--lb-space-3)]">
            {rows.map((row) => (
                <article
                    key={row.id}
                    className="grid gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]"
                >
                    <div className="flex flex-wrap items-start justify-between gap-[var(--lb-space-2)]">
                        <div>
                            <h3 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                {formatPlan(row)}
                            </h3>
                            <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                Store {row.store_id || 'unassigned'}
                            </p>
                        </div>
                        <Badge label={formatStatus(row.status || 'active')} variant={statusVariant(row.status)} />
                    </div>
                    <div className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)] sm:grid-cols-2">
                        <span>Amount {formatMoneyFromPaise(row.amount_paid, row.currency || 'INR')}</span>
                        <span>Period ends {formatDateTime(row.current_period_end)}</span>
                    </div>
                </article>
            ))}
        </div>
    );
}

function DirectoryPagination({ meta, q, status }: { meta: ConsolePagination; q: string; status: string }) {
    return (
        <nav
            aria-label="Subscriptions pagination"
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

function activeFilterChipLabels(q: string, status: string): string[] {
    const chips: string[] = [];

    if (q) chips.push(`Search: ${q}`);
    if (status) chips.push(`Status: ${formatStatus(status)}`);

    return chips;
}

function pageHref({ q, status, page }: { q: string; status: string; page: number }): string {
    const params = new URLSearchParams();

    if (q) params.set('q', q);
    if (status) params.set('status', status);
    params.set('page', String(Math.max(page, 1)));

    return `/subscriptions?${params.toString()}`;
}

function planDistribution(rows: ConsoleSubscription[]) {
    const counts = new Map<string, number>();

    for (const row of rows) {
        const plan = row.plan?.trim() || 'free';
        counts.set(plan, (counts.get(plan) || 0) + 1);
    }

    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, value]) => ({ label: formatStatus(label), value }));
}

function renewalRows(rows: ConsoleSubscription[]): ConsoleSubscription[] {
    const now = Date.now();

    return rows
        .filter((row) => ['active', 'trialing', 'past_due'].includes((row.status || '').toLowerCase()))
        .filter((row) => timestamp(row.current_period_end) >= now)
        .sort((a, b) => timestamp(a.current_period_end) - timestamp(b.current_period_end))
        .slice(0, 5);
}

function cancellationRows(rows: ConsoleSubscription[]): ConsoleSubscription[] {
    return rows
        .filter((row) => ['cancelled', 'canceled'].includes((row.status || '').toLowerCase()))
        .sort((a, b) => timestamp(b.updated_at || b.created_at) - timestamp(a.updated_at || a.created_at))
        .slice(0, 5);
}

function countByStatus(rows: ConsoleSubscription[], statuses: string[]): number {
    const allowed = new Set(statuses);

    return rows.filter((row) => allowed.has((row.status || '').toLowerCase())).length;
}

function sumRevenue(rows: ConsoleSubscription[]): number {
    return rows.reduce((total, row) => total + Number(row.amount_paid || 0), 0);
}

function timestamp(value: string | null | undefined): number {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatPlan(row: ConsoleSubscription): string {
    const plan = row.plan?.trim() || 'free';
    const period = row.billing_period?.trim() || 'monthly';
    return `${formatStatus(plan)} / ${formatStatus(period)}`;
}

function formatStatus(value: string): string {
    return value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusVariant(status: string | null | undefined): 'default' | 'info' | 'success' | 'warning' | 'critical' {
    const normalized = (status || '').toLowerCase();

    if (['active', 'published', 'verified'].includes(normalized)) return 'success';
    if (['draft', 'pending', 'trialing', 'past_due'].includes(normalized)) return 'warning';
    if (['suspended', 'cancelled', 'canceled', 'inactive'].includes(normalized)) return 'critical';
    if (normalized) return 'info';
    return 'default';
}

function formatCount(value: number): string {
    return value.toLocaleString('en-IN');
}
