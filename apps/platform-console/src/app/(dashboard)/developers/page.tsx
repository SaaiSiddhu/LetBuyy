import { revalidatePath } from 'next/cache';
import { Button, Input, Textarea } from '@letbuyy/ui';
import {
    ConsoleWorkspace,
    EmptyDataState,
    LeadershipMetric,
    MetricGrid,
    Panel,
    StatusPill,
} from '@/components/_local-ui/console-workspace';
import {
    ConsoleApiErrorPanel,
    ConsoleSearchForm,
    StatusBadge,
} from '@/components/ConsoleDataTable';
import {
    fetchConsoleApi,
    formatDateTime,
    formatMoneyFromPaise,
    type ConsolePaginatedResponse,
    type ConsoleDataResponse,
} from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';

// ---------------------------------------------------------------------------
// Types from gateway /operations/developers responses
// ---------------------------------------------------------------------------

type DeveloperStatus = 'pending' | 'approved' | 'suspended' | 'rejected' | 'all';

type DeveloperRow = {
    id: string;
    user_id: string;
    company_name: string | null;
    slug: string | null;
    support_email: string | null;
    verified: boolean;
    status: string;
    country: string | null;
    created_at: string | null;
    updated_at: string | null;
    app_count?: number | null;
    theme_count?: number | null;
    total_earnings_minor?: number | null;
    pending_payout_minor?: number | null;
};

type DeveloperOverview = {
    developer: DeveloperRow;
    apps: Array<{
        id: string;
        name: string | null;
        slug: string | null;
        status: string | null;
        install_count?: number | null;
        rating_avg?: number | null;
    }>;
    themes: Array<{
        id: string;
        name: string | null;
        slug: string | null;
        status: string | null;
        install_count?: number | null;
    }>;
    payouts: Array<{
        id: string;
        status: string | null;
        rail: string | null;
        partner_amount_minor: number | null;
        currency: string | null;
        held_at: string | null;
        hold_reason: string | null;
        created_at: string | null;
    }>;
    audit_log?: Array<{
        id: string;
        action: string;
        actor_email: string | null;
        reason: string | null;
        created_at: string | null;
    }>;
    earnings_summary?: {
        total_earned_minor?: number | null;
        total_pending_minor?: number | null;
        total_held_minor?: number | null;
    };
};

// ---------------------------------------------------------------------------
// Input class — mirrored from incidents page
// ---------------------------------------------------------------------------

const inputClassName =
    'rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function developerStatusTone(
    status: string,
): 'success' | 'warning' | 'critical' | 'info' | undefined {
    if (status === 'approved') return 'success';
    if (status === 'pending') return 'warning';
    if (status === 'suspended' || status === 'rejected') return 'critical';
    return undefined;
}

function payoutStatusTone(
    status: string | null,
): 'success' | 'warning' | 'critical' | 'info' | undefined {
    if (!status) return undefined;
    if (status === 'paid') return 'success';
    if (status === 'pending' || status === 'processing') return 'warning';
    if (status === 'failed') return 'critical';
    return 'info';
}

// ---------------------------------------------------------------------------
// Server actions — MFA-gated, developer:manage
// ---------------------------------------------------------------------------

async function runModeration(formData: FormData) {
    'use server';

    await requireConsoleSession({ mfa: true });

    const developerId = String(formData.get('developer_id') || '').trim();
    const action = String(formData.get('action') || '').trim();
    const reason = String(formData.get('reason') || '').trim();

    if (!developerId || !action || reason.length < 8) {
        throw new Error(
            'Moderation requires a developer ID, action, and reason (≥ 8 chars).',
        );
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<unknown>>(
        `/operations/developers/${developerId}/moderation`,
        {
            method: 'POST',
            body: { action, reason },
        },
    );

    if (result.error) throw new Error(result.error);
    revalidatePath('/developers');
}

async function runReconciliation(formData: FormData) {
    'use server';

    await requireConsoleSession({ mfa: true });

    const developerId = String(formData.get('developer_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();

    if (!developerId || reason.length < 8) {
        throw new Error(
            'Reconciliation requires a developer ID and reason (≥ 8 chars).',
        );
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<unknown>>(
        `/operations/developers/${developerId}/reconciliation/run`,
        {
            method: 'POST',
            body: { reason },
        },
    );

    if (result.error) throw new Error(result.error);
    revalidatePath('/developers');
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(params: SearchParams, key: string): string {
    const v = params[key];
    return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

type DevelopersPageData = {
    developers: DeveloperRow[];
    total: number;
    page: number;
    overview: DeveloperOverview | null;
    selectedId: string | null;
    errors: string[];
};

async function loadPageData(searchParams: SearchParams): Promise<DevelopersPageData> {
    const q = readParam(searchParams, 'q');
    const status = readParam(searchParams, 'status') || 'all';
    const page = Math.max(1, Number(readParam(searchParams, 'page') || '1'));
    const selectedId = readParam(searchParams, 'id') || null;

    const errors: string[] = [];

    const listQuery: Record<string, string> = { page: String(page), limit: '25', status };
    if (q) listQuery.q = q;

    const listResult = await fetchConsoleApi<ConsolePaginatedResponse<DeveloperRow>>(
        '/operations/developers/search',
        { query: listQuery },
    );
    if (listResult.error) errors.push(listResult.error);

    let overview: DeveloperOverview | null = null;
    if (selectedId) {
        const overviewResult = await fetchConsoleApi<ConsoleDataResponse<DeveloperOverview>>(
            `/operations/developers/${selectedId}/overview`,
        );
        if (overviewResult.error) {
            errors.push(overviewResult.error);
        } else {
            overview = overviewResult.data?.data ?? null;
        }
    }

    const developers = listResult.data?.data ?? [];
    const total = listResult.data?.meta?.total ?? 0;

    return { developers, total, page, overview, selectedId, errors };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DeveloperOperationsPage({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    const data = await loadPageData(searchParams);

    const { developers, total, overview, selectedId, errors } = data;

    const approved = developers.filter((d) => d.status === 'approved').length;
    const pending = developers.filter((d) => d.status === 'pending').length;
    const suspended = developers.filter((d) => d.status === 'suspended').length;

    const currentQ = readParam(searchParams, 'q');
    const currentStatus = readParam(searchParams, 'status') || 'all';

    return (
        <ConsoleWorkspace
            eyebrow="Developer operations"
            title="Developer Operations"
            description="Search developer profiles, review apps and payouts, apply moderation actions, and trigger payout reconciliation. Actions require MFA and are audit-logged."
        >
            {errors.map((error) => (
                <ConsoleApiErrorPanel
                    key={error}
                    title="Developer API unavailable"
                    message={error}
                />
            ))}

            <MetricGrid>
                <LeadershipMetric label="Returned" value={String(developers.length)} />
                <LeadershipMetric
                    label="Total matching"
                    value={String(total)}
                    tone="neutral"
                />
                <LeadershipMetric
                    label="Approved"
                    value={String(approved)}
                    tone={approved > 0 ? 'success' : 'neutral'}
                />
                <LeadershipMetric
                    label="Pending"
                    value={String(pending)}
                    tone={pending > 0 ? 'warning' : 'neutral'}
                />
                <LeadershipMetric
                    label="Suspended"
                    value={String(suspended)}
                    tone={suspended > 0 ? 'critical' : 'neutral'}
                />
            </MetricGrid>

            {/* Search + filter */}
            <Panel title="Search Developers">
                <ConsoleSearchForm
                    placeholder="Search by name, email, slug…"
                    defaultValue={currentQ}
                >
                    <select name="status" defaultValue={currentStatus} className={inputClassName}>
                        <option value="all">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="suspended">Suspended</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </ConsoleSearchForm>
            </Panel>

            <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
                <DeveloperListPanel developers={developers} selectedId={selectedId} />

                {/* Right column: detail (if selected) or empty prompt */}
                {overview ? (
                    <div className="grid auto-rows-min gap-[var(--lb-space-5)]">
                        <DeveloperDetailPanel overview={overview} />
                        <ModerationPanel developerId={overview.developer.id} currentStatus={overview.developer.status} />
                        <ReconciliationPanel developerId={overview.developer.id} />
                    </div>
                ) : (
                    <Panel title="Developer Detail">
                        <EmptyDataState message="Select a developer from the list to view their profile, apps, payouts, and available actions." />
                    </Panel>
                )}
            </section>
        </ConsoleWorkspace>
    );
}

// ---------------------------------------------------------------------------
// Developer list
// ---------------------------------------------------------------------------

function DeveloperListPanel({
    developers,
    selectedId,
}: {
    developers: DeveloperRow[];
    selectedId: string | null;
}) {
    return (
        <Panel
            title="Developers"
            description="Click a developer to load their full profile. Status colours: green = approved, amber = pending, red = suspended/rejected."
        >
            {developers.length === 0 ? (
                <EmptyDataState message="No developers returned. Try a different query or status filter." />
            ) : (
                <div className="grid gap-[var(--lb-space-2)]">
                    {developers.map((dev) => (
                        <DeveloperRow
                            key={dev.id}
                            developer={dev}
                            isSelected={dev.id === selectedId}
                        />
                    ))}
                </div>
            )}
        </Panel>
    );
}

function DeveloperRow({
    developer,
    isSelected,
}: {
    developer: DeveloperRow;
    isSelected: boolean;
}) {
    const detailHref = `?id=${encodeURIComponent(developer.id)}`;

    return (
        <a
            href={detailHref}
            className={[
                'block rounded-[var(--lb-radius-lg)] border p-[var(--lb-space-4)] transition-colors',
                isSelected
                    ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-surface-subdued)]'
                    : 'border-[var(--lb-color-border)] hover:bg-[var(--lb-color-surface-subdued)]',
            ].join(' ')}
        >
            <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-2)]">
                <div className="min-w-0">
                    <h3 className="m-0 text-sm font-semibold text-[var(--lb-color-text)]">
                        {developer.company_name || developer.slug || developer.id}
                    </h3>
                    <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">
                        {developer.support_email ?? '—'}
                        {developer.country ? ` · ${developer.country}` : null}
                        {developer.created_at
                            ? ` · joined ${formatDateTime(developer.created_at)}`
                            : null}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                    <StatusPill
                        value={developer.status}
                        tone={developerStatusTone(developer.status)}
                    />
                    {developer.verified ? (
                        <StatusPill value="verified" tone="success" />
                    ) : null}
                </div>
            </div>

            <div className="mt-[var(--lb-space-2)] flex flex-wrap gap-[var(--lb-space-4)] text-xs text-[var(--lb-color-text-subdued)]">
                {developer.app_count != null ? (
                    <span>Apps: {developer.app_count}</span>
                ) : null}
                {developer.theme_count != null ? (
                    <span>Themes: {developer.theme_count}</span>
                ) : null}
                {developer.total_earnings_minor != null ? (
                    <span>
                        Total earned:{' '}
                        {formatMoneyFromPaise(developer.total_earnings_minor)}
                    </span>
                ) : null}
                {developer.pending_payout_minor != null ? (
                    <span>
                        Pending payout:{' '}
                        {formatMoneyFromPaise(developer.pending_payout_minor)}
                    </span>
                ) : null}
            </div>
        </a>
    );
}

// ---------------------------------------------------------------------------
// Developer detail (overview)
// ---------------------------------------------------------------------------

function DeveloperDetailPanel({ overview }: { overview: DeveloperOverview }) {
    const dev = overview.developer;
    const earnings = overview.earnings_summary;

    return (
        <Panel
            title={dev.company_name ?? dev.slug ?? 'Developer Profile'}
            description={`ID: ${dev.id}`}
        >
            {/* Core fields */}
            <dl className="grid grid-cols-2 gap-[var(--lb-space-3)] text-sm sm:grid-cols-3">
                <FieldPair label="Status">
                    <StatusPill value={dev.status} tone={developerStatusTone(dev.status)} />
                </FieldPair>
                <FieldPair label="Verified">
                    <StatusBadge value={String(dev.verified)} />
                </FieldPair>
                <FieldPair label="Country">{dev.country ?? '—'}</FieldPair>
                <FieldPair label="Support email">{dev.support_email ?? '—'}</FieldPair>
                <FieldPair label="Slug">{dev.slug ?? '—'}</FieldPair>
                <FieldPair label="Joined">
                    {dev.created_at ? formatDateTime(dev.created_at) : '—'}
                </FieldPair>
            </dl>

            {/* Earnings summary */}
            {earnings ? (
                <div className="mt-[var(--lb-space-4)] grid grid-cols-3 gap-[var(--lb-space-3)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)] text-xs">
                    <div>
                        <span className="text-[var(--lb-color-text-subdued)]">Total earned</span>
                        <p className="m-0 mt-0.5 font-semibold text-[var(--lb-color-text)]">
                            {formatMoneyFromPaise(earnings.total_earned_minor ?? 0)}
                        </p>
                    </div>
                    <div>
                        <span className="text-[var(--lb-color-text-subdued)]">Pending</span>
                        <p className="m-0 mt-0.5 font-semibold text-[var(--lb-color-text)]">
                            {formatMoneyFromPaise(earnings.total_pending_minor ?? 0)}
                        </p>
                    </div>
                    <div>
                        <span className="text-[var(--lb-color-text-subdued)]">Held</span>
                        <p className="m-0 mt-0.5 font-semibold text-[var(--lb-color-warning)]">
                            {formatMoneyFromPaise(earnings.total_held_minor ?? 0)}
                        </p>
                    </div>
                </div>
            ) : null}

            {/* Apps */}
            {overview.apps.length > 0 ? (
                <div className="mt-[var(--lb-space-4)]">
                    <h4 className="m-0 mb-[var(--lb-space-2)] text-xs font-semibold uppercase tracking-wide text-[var(--lb-color-text-subdued)]">
                        Apps ({overview.apps.length})
                    </h4>
                    <div className="grid gap-[var(--lb-space-2)]">
                        {overview.apps.map((app) => (
                            <div
                                key={app.id}
                                className="flex items-center justify-between rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm"
                            >
                                <span className="font-medium text-[var(--lb-color-text)]">
                                    {app.name ?? app.slug ?? app.id}
                                </span>
                                <div className="flex items-center gap-[var(--lb-space-2)] text-xs text-[var(--lb-color-text-subdued)]">
                                    {app.install_count != null ? (
                                        <span>{app.install_count} installs</span>
                                    ) : null}
                                    {app.status ? (
                                        <StatusBadge value={app.status} />
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* Themes */}
            {overview.themes.length > 0 ? (
                <div className="mt-[var(--lb-space-4)]">
                    <h4 className="m-0 mb-[var(--lb-space-2)] text-xs font-semibold uppercase tracking-wide text-[var(--lb-color-text-subdued)]">
                        Themes ({overview.themes.length})
                    </h4>
                    <div className="grid gap-[var(--lb-space-2)]">
                        {overview.themes.map((theme) => (
                            <div
                                key={theme.id}
                                className="flex items-center justify-between rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm"
                            >
                                <span className="font-medium text-[var(--lb-color-text)]">
                                    {theme.name ?? theme.slug ?? theme.id}
                                </span>
                                <div className="flex items-center gap-[var(--lb-space-2)] text-xs text-[var(--lb-color-text-subdued)]">
                                    {theme.install_count != null ? (
                                        <span>{theme.install_count} installs</span>
                                    ) : null}
                                    {theme.status ? (
                                        <StatusBadge value={theme.status} />
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* Payouts — read-only; release action intentionally omitted (payout:release / dual-control) */}
            {overview.payouts.length > 0 ? (
                <div className="mt-[var(--lb-space-4)]">
                    <h4 className="m-0 mb-[var(--lb-space-1)] text-xs font-semibold uppercase tracking-wide text-[var(--lb-color-text-subdued)]">
                        Payouts ({overview.payouts.length})
                    </h4>
                    <p className="m-0 mb-[var(--lb-space-2)] text-xs text-[var(--lb-color-text-subdued)]">
                        Payout release is money-sensitive and requires dual-control approval — contact the finance team to trigger a release.
                    </p>
                    <div className="grid gap-[var(--lb-space-2)]">
                        {overview.payouts.map((payout) => (
                            <div
                                key={payout.id}
                                className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-xs"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-[var(--lb-color-text)]">
                                        {formatMoneyFromPaise(payout.partner_amount_minor ?? 0, payout.currency ?? 'INR')}
                                    </span>
                                    <div className="flex items-center gap-[var(--lb-space-2)]">
                                        {payout.status ? (
                                            <StatusPill
                                                value={payout.status}
                                                tone={payoutStatusTone(payout.status)}
                                            />
                                        ) : null}
                                        {payout.rail ? (
                                            <span className="text-[var(--lb-color-text-subdued)]">
                                                via {payout.rail}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                                {payout.held_at ? (
                                    <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-color-warning)]">
                                        Held since {formatDateTime(payout.held_at)}
                                        {payout.hold_reason ? ` — ${payout.hold_reason}` : ''}
                                    </p>
                                ) : null}
                                <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-color-text-subdued)]">
                                    {payout.created_at ? formatDateTime(payout.created_at) : '—'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* Audit log */}
            {overview.audit_log && overview.audit_log.length > 0 ? (
                <div className="mt-[var(--lb-space-4)]">
                    <h4 className="m-0 mb-[var(--lb-space-2)] text-xs font-semibold uppercase tracking-wide text-[var(--lb-color-text-subdued)]">
                        Recent audit events
                    </h4>
                    <div className="grid gap-[var(--lb-space-1)]">
                        {overview.audit_log.map((entry) => (
                            <div
                                key={entry.id}
                                className="flex flex-col gap-[var(--lb-space-1)] rounded-[var(--lb-radius-sm)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-xs"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-[var(--lb-color-text)]">
                                        {entry.action}
                                    </span>
                                    <span className="text-[var(--lb-color-text-subdued)]">
                                        {entry.created_at
                                            ? formatDateTime(entry.created_at)
                                            : '—'}
                                    </span>
                                </div>
                                {entry.actor_email ? (
                                    <span className="text-[var(--lb-color-text-subdued)]">
                                        by {entry.actor_email}
                                    </span>
                                ) : null}
                                {entry.reason ? (
                                    <span className="text-[var(--lb-color-text-subdued)]">
                                        {entry.reason}
                                    </span>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </Panel>
    );
}

// ---------------------------------------------------------------------------
// Moderation action panel
// ---------------------------------------------------------------------------

function ModerationPanel({
    developerId,
    currentStatus,
}: {
    developerId: string;
    currentStatus: string;
}) {
    return (
        <Panel
            title="Moderation"
            description="All moderation actions are audit-logged and require MFA. Suspension holds all pending payouts and suspends published apps. Dual-control is enforced by the gateway for suspend actions."
        >
            <form
                action={runModeration}
                className="grid gap-[var(--lb-space-3)]"
            >
                <Input unstyled type="hidden" name="developer_id" value={developerId} />

                <label className="flex flex-col gap-[var(--lb-space-1)] text-sm font-medium text-[var(--lb-color-text)]">
                    Action
                    <select name="action" defaultValue="verify" className={inputClassName}>
                        <option value="verify">Verify (approve)</option>
                        <option value="reject">Reject</option>
                        <option value="suspend">Suspend</option>
                        <option value="restore">Restore</option>
                    </select>
                </label>

                <Textarea
                    name="reason"
                    label="Reason"
                    placeholder="Provide a reason of at least 8 characters (required for all actions)."
                    required
                />

                <p className="m-0 text-xs text-[var(--lb-color-text-subdued)]">
                    Current status: <strong>{currentStatus}</strong>. Suspend requires a secondary approver
                    (enforced server-side). Contact a second approver before submitting a suspension.
                </p>

                <Button type="submit" variant="secondary">
                    Apply moderation action
                </Button>
            </form>
        </Panel>
    );
}

// ---------------------------------------------------------------------------
// Reconciliation panel
// ---------------------------------------------------------------------------

function ReconciliationPanel({ developerId }: { developerId: string }) {
    return (
        <Panel
            title="Payout Reconciliation"
            description="Triggers a reconciliation run for this developer's payouts. Results are audit-logged. The gateway limits a single run to 500 entries."
        >
            <form
                action={runReconciliation}
                className="grid gap-[var(--lb-space-3)]"
            >
                <Input unstyled type="hidden" name="developer_id" value={developerId} />

                <Textarea
                    name="reason"
                    label="Reason"
                    placeholder="Describe why reconciliation is being run (≥ 8 chars)."
                    required
                />

                <Button type="submit" variant="secondary">
                    Run reconciliation
                </Button>
            </form>
        </Panel>
    );
}

// ---------------------------------------------------------------------------
// Utility component
// ---------------------------------------------------------------------------

function FieldPair({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-[var(--lb-space-1)]">
            <dt className="text-xs text-[var(--lb-color-text-subdued)]">{label}</dt>
            <dd className="m-0 text-sm text-[var(--lb-color-text)]">{children}</dd>
        </div>
    );
}
