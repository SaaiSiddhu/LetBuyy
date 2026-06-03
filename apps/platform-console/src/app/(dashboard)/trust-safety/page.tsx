import {
    Badge,
    Banner,
    Button,
    Card,
    Chart,
    EmptyState,
    FilterBar,
    Input,
    MetricCard,
    Page,
    PageContent,
    PageHeader,
    Section,
    Select,
    ShieldAlert,
} from '@letbuyy/ui';
import {
    fetchConsoleApi,
    formatDateTime,
    readPageParam,
    readSearchParam,
    type ConsolePagination,
    type ConsolePaginatedResponse,
} from '@/lib/console-api';
import { TrustSafetyIndexTable, type TrustSafetyStoreRisk } from './TrustSafetyIndexTable';

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
    views_count: number | string | null;
    created_at: string | null;
    updated_at: string | null;
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

const statusOptions = [
    { value: '', label: 'All status' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'inactive', label: 'Inactive' },
];

export default async function TrustSafetyPage({ searchParams }: PageProps) {
    const params = searchParams ? await searchParams : undefined;
    const q = readSearchParam(params, 'q');
    const status = readSearchParam(params, 'status');
    const page = readPageParam(params);
    const [storesResult, sampleStoresResult, auditResult] = await Promise.all([
        fetchConsoleApi<ConsolePaginatedResponse<ConsoleStore>>('/internal/console/stores', {
            q,
            status,
            page,
            limit: 25,
        }),
        fetchConsoleApi<ConsolePaginatedResponse<ConsoleStore>>('/internal/console/stores', {
            page: 1,
            limit: 100,
        }),
        fetchConsoleApi<ConsolePaginatedResponse<ConsoleAuditLog>>('/internal/console/audit-logs', {
            page: 1,
            limit: 100,
        }),
    ]);
    const stores = storesResult.data?.data || [];
    const sampleStores = sampleStoresResult.data?.data || stores;
    const auditRows = auditResult.data?.data || [];
    const riskRows = buildRiskRows(stores);
    const sampleRiskRows = buildRiskRows(sampleStores);
    const watchlistAuditRows = auditRows.filter((row) => isSafetyAuditAction(row.action)).slice(0, 6);
    const filterChipLabels = activeFilterChipLabels(q, status);
    const hasAggregateGap = Boolean(sampleStoresResult.data?.meta && sampleStoresResult.data.meta.total > sampleStores.length);

    return (
        <Page className="max-w-none p-[var(--lb-space-5)] sm:p-[var(--lb-space-6)]">
            <PageHeader
                title="Trust & Safety"
                description="Derived merchant review queue, suspension posture, and safety audit signals from existing console data."
                icon={<ShieldAlert />}
                showDescription
                secondaryActions={[{ label: 'Audit logs', href: '/audit-logs' }, { label: 'Merchant directory', href: '/stores' }]}
            />

            <PageContent>
                {storesResult.error ? (
                    <Banner title="Stores API unavailable" variant="critical">
                        {storesResult.error}
                    </Banner>
                ) : null}

                {auditResult.error ? (
                    <Banner title="Audit sample unavailable" variant="critical">
                        {auditResult.error}
                    </Banner>
                ) : null}

                <div className="grid gap-[var(--lb-density-card-gap)] md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Flagged merchants" value={formatCount(sampleRiskRows.length)} delta="Derived from store status" />
                    <MetricCard label="Suspension states" value={formatCount(countByStatus(sampleStores, ['suspended', 'frozen', 'inactive']))} delta="Needs review workflow" />
                    <MetricCard label="Safety audit signals" value={formatCount(watchlistAuditRows.length)} delta="Sensitive audit rows" />
                    <MetricCard label="Visible stores" value={formatCount(storesResult.data?.meta.total || sampleStores.length)} delta={`${formatCount(sampleStores.length)} sampled`} />
                </div>

                <Banner title="Trust & Safety backend required" variant="warning">
                    Current console APIs expose stores and audit logs only. True flagged merchant queues, abuse reports, KYC/compliance signals,
                    case assignment, risk scores, evidence attachments, reversible suspension actions, and appeal workflows require dedicated
                    trust-and-safety endpoints before actions can be enabled.
                </Banner>

                <div className="grid gap-[var(--lb-density-card-gap)] xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
                    <Card>
                        <Section title="Risk posture" description="Store status distribution from the current sample.">
                            <Chart data={statusDistribution(sampleStores)} type="bar" height="sm" ariaLabel="Trust and safety status distribution" />
                            {hasAggregateGap ? (
                                <p className="m-0 text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)]">
                                    Showing the first {formatCount(sampleStores.length)} of {formatCount(sampleStoresResult.data?.meta.total || 0)} stores.
                                </p>
                            ) : null}
                        </Section>
                    </Card>

                    <Card>
                        <Section title="Action controls" description="Controls remain disabled until the backend supports trust-and-safety cases.">
                            <div className="grid gap-[var(--lb-space-3)]">
                                <Button type="button" disabled>Open case</Button>
                                <Button type="button" disabled>Suspend merchant</Button>
                                <Button type="button" disabled>Request review</Button>
                            </div>
                        </Section>
                    </Card>
                </div>

                <Card>
                    <Section title="Safety audit signals" description="Recent sensitive platform actions that may inform review work.">
                        <AuditSignalList rows={watchlistAuditRows} />
                    </Section>
                </Card>

                <Card>
                    <Section title="Trust filters" description="Search stores and filter by lifecycle status.">
                        <form method="get">
                            <FilterBar
                                search={(
                                    <Input
                                        type="search"
                                        name="q"
                                        label="Search"
                                        defaultValue={q}
                                        placeholder="Search merchants..."
                                    />
                                )}
                                filters={(
                                    <Select
                                        name="status"
                                        label="Status"
                                        defaultValue={status}
                                        options={statusOptions}
                                    />
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

                {storesResult.error ? null : (
                    <>
                        <TrustSafetyIndexTable rows={riskRows} filterChipLabels={filterChipLabels} />
                        {storesResult.data?.meta ? <TrustPagination meta={storesResult.data.meta} q={q} status={status} /> : null}
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
                title="No safety audit signals in the current sample"
                body="The existing audit API returned no matching sensitive actions for this sample."
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
                                {formatLabel(row.action || 'unknown')}
                            </h3>
                            <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                {row.actor_email || row.actor_id || 'System actor'}
                            </p>
                        </div>
                        <Badge label={formatLabel(row.actor_type || 'system')} variant="warning" />
                    </div>
                    <p className="m-0 text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)]">
                        {formatLabel(row.resource_type || 'resource')} · {formatDateTime(row.created_at)}
                    </p>
                </article>
            ))}
        </div>
    );
}

function TrustPagination({ meta, q, status }: { meta: ConsolePagination; q: string; status: string }) {
    return (
        <nav
            aria-label="Trust and safety pagination"
            className="flex flex-col gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-secondary)] text-[color:var(--lb-color-text-subdued)] sm:flex-row sm:items-center sm:justify-between"
        >
            <span>
                Page {meta.page} of {Math.max(meta.total_pages, 1)} - {formatCount(meta.total)} stores scanned
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

function buildRiskRows(stores: ConsoleStore[]): TrustSafetyStoreRisk[] {
    return stores
        .map((store) => {
            const status = (store.status || '').toLowerCase();
            const ageDays = storeAgeDays(store.created_at);
            const views = Number(store.views_count || 0);

            if (['suspended', 'frozen', 'inactive'].includes(status)) {
                return riskRow(store, 'critical', 'Store is already in a restricted lifecycle state.', 'Review suspension posture');
            }

            if (status === 'draft' && ageDays >= 14) {
                return riskRow(store, 'warning', 'Draft store has remained unpublished for 14+ days.', 'Review onboarding legitimacy');
            }

            if (status === 'published' && views >= 10000) {
                return riskRow(store, 'warning', 'Traffic volume is high for the sampled store feed.', 'Review traffic and order patterns');
            }

            return null;
        })
        .filter((row): row is TrustSafetyStoreRisk => Boolean(row));
}

function riskRow(store: ConsoleStore, riskLevel: TrustSafetyStoreRisk['risk_level'], reason: string, recommendedAction: string): TrustSafetyStoreRisk {
    return {
        id: store.id,
        name: store.name,
        store_name: store.store_name,
        site_type: store.site_type,
        subdomain: store.subdomain,
        custom_domain: store.custom_domain,
        status: store.status,
        views_count: store.views_count,
        created_at: store.created_at,
        risk_level: riskLevel,
        risk_reason: reason,
        recommended_action: recommendedAction,
    };
}

function statusDistribution(stores: ConsoleStore[]) {
    const counts = new Map<string, number>();

    for (const store of stores) {
        const status = store.status || 'unknown';
        counts.set(status, (counts.get(status) || 0) + 1);
    }

    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label: formatLabel(label), value }));
}

function countByStatus(stores: ConsoleStore[], statuses: string[]): number {
    const allowed = new Set(statuses);

    return stores.filter((store) => allowed.has((store.status || '').toLowerCase())).length;
}

function isSafetyAuditAction(action: string | null | undefined): boolean {
    const normalized = (action || '').toLowerCase();

    return ['suspend', 'delete', 'remove', 'role', 'permission', 'password', 'payment', 'refund', 'token', 'mfa', 'login']
        .some((keyword) => normalized.includes(keyword));
}

function activeFilterChipLabels(q: string, status: string): string[] {
    const chips: string[] = [];

    if (q) chips.push(`Search: ${q}`);
    if (status) chips.push(`Status: ${formatLabel(status)}`);

    return chips;
}

function pageHref({ q, status, page }: { q: string; status: string; page: number }): string {
    const params = new URLSearchParams();

    if (q) params.set('q', q);
    if (status) params.set('status', status);
    params.set('page', String(Math.max(page, 1)));

    return `/trust-safety?${params.toString()}`;
}

function storeAgeDays(value: string | null | undefined): number {
    if (!value) return 0;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 0;
    return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

function formatLabel(value: string): string {
    return value
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCount(value: number): string {
    return value.toLocaleString('en-IN');
}
