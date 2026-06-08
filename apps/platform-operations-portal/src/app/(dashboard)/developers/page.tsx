import type {
    InternalDeveloperOverview,
    InternalPartnerPayoutLedgerEntry,
    InternalPayoutDispute,
    InternalPayoutReconciliationRecord,
    MarketplaceAppDeveloper,
} from '@letbuyy/api-client';
import { Button, Input } from '@letbuyy/ui';
import { formatIndiaDateTime, formatInrCurrency } from '@letbuyy/ui/formatting';
import { revalidatePath } from 'next/cache';
import {
    EmptyDataState,
    MetricGrid,
    OpsMetric,
    OpsWorkspace,
    Panel,
    StatusPill,
} from '@/components/_local-ui/ops-workspace';
import { createPlatformOperationsApiClient } from '@/lib/api/client';

type SearchParamValue = string | string[] | undefined;

interface DevelopersPageProps {
    searchParams?: Promise<Record<string, SearchParamValue>>;
}

async function moderateDeveloper(formData: FormData) {
    'use server';

    const developerId = String(formData.get('developer_id') || '').trim();
    const action = String(formData.get('action') || '').trim() as 'verify' | 'reject' | 'suspend' | 'restore';
    const reason = String(formData.get('reason') || '').trim();
    const secondaryApproverId = String(formData.get('secondary_approver_id') || '').trim();

    if (!developerId || !['verify', 'reject', 'suspend', 'restore'].includes(action) || reason.length < 8) return;
    if (action === 'suspend' && !secondaryApproverId) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.moderateDeveloper(developerId, {
        action,
        reason,
        secondary_approver_id: secondaryApproverId || undefined,
    });

    revalidatePath('/developers');
}

async function approvePayoutRelease(formData: FormData) {
    'use server';

    const developerId = String(formData.get('developer_id') || '').trim();
    const payoutId = String(formData.get('payout_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    const secondaryApproverId = String(formData.get('secondary_approver_id') || '').trim();
    if (!developerId || !payoutId || !secondaryApproverId || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.approveDeveloperPayoutRelease(developerId, payoutId, {
        reason,
        secondary_approver_id: secondaryApproverId,
    });

    revalidatePath('/developers');
}

async function runReconciliation(formData: FormData) {
    'use server';

    const developerId = String(formData.get('developer_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!developerId || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.runDeveloperPayoutReconciliation(developerId, { reason });

    revalidatePath('/developers');
}

async function openPayoutDispute(formData: FormData) {
    'use server';

    const developerId = String(formData.get('developer_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!developerId || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.createDeveloperPayoutDispute(developerId, {
        reconciliation_record_id: String(formData.get('reconciliation_record_id') || '').trim() || null,
        payout_ledger_entry_id: String(formData.get('payout_ledger_entry_id') || '').trim() || null,
        assignee_id: String(formData.get('assignee_id') || '').trim() || null,
        amount_minor: Number(formData.get('amount_minor') || 0),
        reason,
    });

    revalidatePath('/developers');
}

async function updatePayoutDispute(formData: FormData) {
    'use server';

    const developerId = String(formData.get('developer_id') || '').trim();
    const disputeId = String(formData.get('dispute_id') || '').trim();
    const status = String(formData.get('status') || '').trim() as InternalPayoutDispute['status'];
    const reason = String(formData.get('reason') || '').trim();
    if (!developerId || !disputeId || !status || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.updateDeveloperPayoutDispute(developerId, disputeId, {
        status,
        resolution: String(formData.get('resolution') || '').trim() || null,
        reason,
    });

    revalidatePath('/developers');
}

export default async function DevelopersPage({ searchParams }: DevelopersPageProps) {
    const params = searchParams ? await searchParams : {};
    const q = firstParam(params.q) || '';
    const selectedDeveloperId = firstParam(params.developer) || '';
    let developers: MarketplaceAppDeveloper[] = [];
    let overview: InternalDeveloperOverview | null = null;
    let loadError: string | null = null;

    try {
        const api = await createPlatformOperationsApiClient({ requireSession: true });
        const search = await api.operations.developerSearch({ q: q || undefined, status: 'all', limit: 12 });
        developers = search.data;
        const activeDeveloperId = selectedDeveloperId || developers[0]?.id || '';
        if (activeDeveloperId) overview = await api.operations.developerOverview(activeDeveloperId);
    } catch (error) {
        loadError = error instanceof Error ? error.message : 'Developer operations unavailable';
    }

    const activeDeveloperId = overview?.developer.id || selectedDeveloperId;
    const pendingPayout = overview?.payouts.find((payout) => ['pending', 'processing'].includes(payout.status) && !payout.held_at);

    return (
        <OpsWorkspace
            eyebrow="Developer Operations"
            title="Developer 360"
            description="Operator workspace for partner profile, app lifecycle, installs, revenue, payout reconciliation, disputes, and enforcement context."
        >
            <Panel title="Find Developer" description="Search by company, slug, support email, developer id, or owner id.">
                <form className="grid gap-[var(--lb-space-3)] md:grid-cols-[1fr_auto]" action="/developers">
                    <Input name="q" defaultValue={q} placeholder="Search developers" />
                    <Button type="submit">Search</Button>
                </form>
                {developers.length > 0 ? (
                    <div className="mt-[var(--lb-space-4)] grid gap-[var(--lb-space-3)] md:grid-cols-2 xl:grid-cols-3">
                        {developers.map((developer) => {
                            const developerId = String(developer.id || '');
                            return (
                                <a
                                    key={developerId}
                                    href={`/developers?developer=${encodeURIComponent(developerId)}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                                    className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] transition-colors hover:border-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    <div className="flex items-center justify-between gap-[var(--lb-space-3)]">
                                        <span className="truncate text-sm font-medium text-[var(--lb-color-text)]">{developer.company_name || 'Developer'}</span>
                                        <StatusPill value={developer.status || 'pending'} />
                                    </div>
                                    <p className="m-0 mt-[var(--lb-space-1)] truncate text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                                        {developer.slug || developerId} · {developer.support_email || 'No support email'}
                                    </p>
                                </a>
                            );
                        })}
                    </div>
                ) : null}
            </Panel>

            {loadError ? (
                <Panel title="Developer API unavailable" description={loadError}>
                    <EmptyDataState message="Developer operations could not be loaded with the current employee session." />
                </Panel>
            ) : !overview ? (
                <Panel title="No Developer Selected">
                    <EmptyDataState message="No developer profiles matched the current search." />
                </Panel>
            ) : (
                <>
                    <MetricGrid>
                        <OpsMetric label="Apps" value={String(overview.analytics.total_apps)} detail={`${overview.analytics.published_apps} published`} />
                        <OpsMetric label="Active Installs" value={String(overview.analytics.active_installations)} detail="Across marketplace apps" />
                        <OpsMetric label="Pending Payout" value={money(overview.analytics.pending_partner_amount_minor)} tone={overview.analytics.pending_partner_amount_minor > 0 ? 'warning' : 'success'} />
                        <OpsMetric label="Open Disputes" value={String(overview.analytics.open_disputes)} tone={overview.analytics.open_disputes > 0 ? 'warning' : 'success'} />
                    </MetricGrid>

                    <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-[0.85fr_1.15fr]">
                        <Panel title={overview.developer.company_name || 'Developer'} description={`${overview.developer.slug || overview.developer.id} · ${displayText(overview.owner?.email) || overview.developer.support_email || 'No owner email'}`}>
                            <div className="grid gap-[var(--lb-space-3)]">
                                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                    <StatusPill value={overview.developer.status || 'pending'} />
                                    <StatusPill value={overview.developer.verified ? 'verified' : 'unverified'} />
                                    <StatusPill value={overview.developer.country || 'IN'} />
                                </div>
                                <dl className="grid gap-[var(--lb-space-3)] text-sm md:grid-cols-2">
                                    <Fact label="Support" value={overview.developer.support_email || 'Not recorded'} />
                                    <Fact label="Website" value={overview.developer.website_url || 'Not recorded'} />
                                    <Fact label="Joined" value={formatIndiaDateTime(displayText(overview.developer.created_at), { emptyValue: 'Not recorded' })} />
                                    <Fact label="T&S Cases" value={String(overview.analytics.open_trust_safety_cases)} />
                                </dl>
                            </div>
                        </Panel>

                        <Panel title="Moderation" description="Verification and suspension actions require a reason; suspension requires a second approver.">
                            <form action={moderateDeveloper} className="grid gap-[var(--lb-space-3)]">
                                <Input unstyled type="hidden" name="developer_id" value={activeDeveloperId} />
                                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                    <SelectField name="action" label="Action" values={['verify', 'reject', 'suspend', 'restore']} />
                                    <TextField name="secondary_approver_id" label="Second approver ID" placeholder="Required for suspend" />
                                </div>
                                <TextAreaField name="reason" label="Reason" />
                                <Button type="submit">Apply action</Button>
                            </form>
                        </Panel>
                    </section>

                    <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-[1.1fr_0.9fr]">
                        <Panel title="Apps and Installs" description="Current app portfolio with install and review signals.">
                            {overview.apps.length === 0 ? (
                                <EmptyDataState message="This developer has no apps." />
                            ) : (
                                <div className="grid gap-[var(--lb-space-3)]">
                                    {overview.apps.slice(0, 8).map((app) => (
                                        <div key={app.id} className="grid gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)] md:grid-cols-[1fr_auto]">
                                            <div className="min-w-0">
                                                <p className="m-0 truncate text-sm font-medium text-[var(--lb-color-text)]">{app.name}</p>
                                                <p className="m-0 mt-1 truncate text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                                                    {app.slug} · {app.pricing_model || 'free'} · {Number(app.install_count || 0)} listed installs
                                                </p>
                                            </div>
                                            <StatusPill value={app.status || 'draft'} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Panel>

                        <Panel title="Webhook Health" description="Developer-configured app webhook inventory.">
                            <MetricGrid>
                                <OpsMetric label="Total" value={String(overview.analytics.webhook_health.total)} />
                                <OpsMetric label="Active" value={String(overview.analytics.webhook_health.active)} tone="success" />
                                <OpsMetric label="Inactive" value={String(overview.analytics.webhook_health.inactive)} tone={overview.analytics.webhook_health.inactive > 0 ? 'warning' : 'success'} />
                                <OpsMetric label="Reviews" value={String(overview.review_records.length)} />
                            </MetricGrid>
                        </Panel>
                    </section>

                    <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-[1fr_1fr]">
                        <Panel title="Payout Reconciliation" description="Reconcile app billing charges against partner payout ledger entries.">
                            <div className="grid gap-[var(--lb-space-3)]">
                                <MetricGrid>
                                    <OpsMetric label="Expected" value={money(overview.analytics.expected_partner_amount_minor)} />
                                    <OpsMetric label="Ledger" value={money(overview.analytics.ledger_partner_amount_minor)} />
                                    <OpsMetric label="Delta" value={money(overview.analytics.reconciliation_delta_minor)} tone={overview.analytics.reconciliation_delta_minor === 0 ? 'success' : 'warning'} />
                                    <OpsMetric label="Held" value={money(overview.analytics.held_partner_amount_minor)} tone={overview.analytics.held_partner_amount_minor > 0 ? 'critical' : 'success'} />
                                </MetricGrid>
                                <form action={runReconciliation} className="grid gap-[var(--lb-space-3)]">
                                    <Input unstyled type="hidden" name="developer_id" value={activeDeveloperId} />
                                    <TextAreaField name="reason" label="Run reason" />
                                    <Button type="submit">Run reconciliation</Button>
                                </form>
                                <RecordList records={overview.recent.reconciliation} empty="No reconciliation records have been generated." />
                            </div>
                        </Panel>

                        <Panel title="Payout Release" description="Release approval is dual-control and records a provider-pending dry-run approval until live transfer credentials are enabled.">
                            {pendingPayout ? (
                                <form action={approvePayoutRelease} className="grid gap-[var(--lb-space-3)]">
                                    <Input unstyled type="hidden" name="developer_id" value={activeDeveloperId} />
                                    <Input unstyled type="hidden" name="payout_id" value={pendingPayout.id} />
                                    <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                                        <p className="m-0 text-sm font-medium text-[var(--lb-color-text)]">{money(pendingPayout.partner_amount_minor)}</p>
                                        <p className="m-0 mt-1 text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                                            {pendingPayout.status} · {pendingPayout.rail || 'manual'} · {formatIndiaDateTime(pendingPayout.created_at, { emptyValue: 'Not recorded' })}
                                        </p>
                                    </div>
                                    <TextField name="secondary_approver_id" label="Second approver ID" placeholder="Employee UUID" />
                                    <TextAreaField name="reason" label="Release reason" />
                                    <Button type="submit">Approve release</Button>
                                </form>
                            ) : (
                                <EmptyDataState message="No releasable pending payout is available." />
                            )}
                        </Panel>
                    </section>

                    <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-[1fr_1fr]">
                        <Panel title="Disputes" description="Open and resolve payout disputes with immutable audit context.">
                            <form action={openPayoutDispute} className="grid gap-[var(--lb-space-3)]">
                                <Input unstyled type="hidden" name="developer_id" value={activeDeveloperId} />
                                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                    <TextField name="reconciliation_record_id" label="Reconciliation ID" placeholder="Optional" />
                                    <TextField name="payout_ledger_entry_id" label="Payout ID" placeholder="Optional" />
                                </div>
                                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                    <TextField name="assignee_id" label="Assignee ID" placeholder="Optional employee UUID" />
                                    <TextField name="amount_minor" label="Amount paise" placeholder="0" />
                                </div>
                                <TextAreaField name="reason" label="Dispute reason" />
                                <Button type="submit">Open dispute</Button>
                            </form>
                            <div className="mt-[var(--lb-space-4)] grid gap-[var(--lb-space-3)]">
                                {overview.disputes.length === 0 ? (
                                    <EmptyDataState message="No payout disputes are open for this developer." />
                                ) : (
                                    overview.disputes.slice(0, 6).map((dispute) => (
                                        <DisputeRow key={dispute.id} dispute={dispute} developerId={activeDeveloperId} />
                                    ))
                                )}
                            </div>
                        </Panel>

                        <Panel title="Trust, Review, and Audit" description="Recent enforcement, marketplace review, and privileged-action trail.">
                            <div className="grid gap-[var(--lb-space-4)]">
                                <RecordList records={overview.trust_safety_cases.slice(0, 5)} empty="No linked Trust & Safety cases." />
                                <RecordList records={overview.review_records.slice(0, 5)} empty="No marketplace review history." />
                                <RecordList records={overview.audit_events.slice(0, 5)} empty="No developer audit events have been recorded." />
                            </div>
                        </Panel>
                    </section>
                </>
            )}
        </OpsWorkspace>
    );
}

function DisputeRow({ dispute, developerId }: { dispute: InternalPayoutDispute; developerId: string }) {
    return (
        <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
            <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-2)]">
                <p className="m-0 text-sm font-medium text-[var(--lb-color-text)]">{money(dispute.amount_minor)}</p>
                <StatusPill value={dispute.status} />
            </div>
            <p className="m-0 mt-1 text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">{dispute.reason}</p>
            <form action={updatePayoutDispute} className="mt-[var(--lb-space-3)] grid gap-[var(--lb-space-3)] md:grid-cols-[0.8fr_1fr_auto] md:items-end">
                <Input unstyled type="hidden" name="developer_id" value={developerId} />
                <Input unstyled type="hidden" name="dispute_id" value={dispute.id} />
                <SelectField name="status" label="Status" values={['in_review', 'waiting_partner', 'resolved', 'rejected', 'withdrawn']} />
                <TextField name="reason" label="Update reason" placeholder="Reason" />
                <Button type="submit">Update</Button>
            </form>
        </div>
    );
}

function RecordList({ records, empty }: { records: Record<string, unknown>[]; empty: string }) {
    if (records.length === 0) return <EmptyDataState message={empty} />;

    return (
        <div className="grid gap-[var(--lb-space-2)]">
            {records.map((record, index) => (
                <div key={displayText(record.id) || `record-${index}`} className="grid gap-[var(--lb-space-1)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                    <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-2)]">
                        <p className="m-0 truncate text-sm font-medium text-[var(--lb-color-text)]">
                            {displayText(record.resource_name) || displayText(record.title) || displayText(record.action) || displayText(record.reconciliation_key) || displayText(record.id) || 'Recorded item'}
                        </p>
                        <StatusPill value={displayText(record.status) || displayText(record.severity) || displayText(record.resource_type) || 'recorded'} />
                    </div>
                    <p className="m-0 text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                        {record.delta_minor !== undefined ? `${money(record.delta_minor as number | string)} delta · ` : ''}
                        {formatIndiaDateTime(displayText(record.checked_at) || displayText(record.created_at) || displayText(record.submitted_at), { emptyValue: 'Not recorded' })}
                    </p>
                </div>
            ))}
        </div>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-[var(--lb-font-size-caption)] font-medium text-[var(--lb-color-text-subdued)]">{label}</dt>
            <dd className="m-0 mt-1 break-words text-[var(--lb-color-text)]">{value}</dd>
        </div>
    );
}

function TextField({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) {
    return (
        <label className="grid gap-[var(--lb-space-2)]">
            <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">{label}</span>
            <Input name={name} placeholder={placeholder || label} />
        </label>
    );
}

function TextAreaField({ name, label }: { name: string; label: string }) {
    return (
        <label className="grid gap-[var(--lb-space-2)]">
            <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">{label}</span>
            <textarea
                name={name}
                rows={3}
                required
                minLength={8}
                className="w-full rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none transition-colors placeholder:text-[var(--lb-color-text-subdued)] focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                placeholder={label}
            />
        </label>
    );
}

function SelectField({ name, label, values }: { name: string; label: string; values: string[] }) {
    return (
        <label className="grid gap-[var(--lb-space-2)]">
            <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">{label}</span>
            <select
                name={name}
                className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
            >
                {values.map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
            </select>
        </label>
    );
}

function firstParam(value: SearchParamValue): string | null {
    if (Array.isArray(value)) return value[0] || null;
    return value || null;
}

function displayText(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function money(value: number | string | null | undefined): string {
    const paise = typeof value === 'number' ? value : Number(value || 0);
    return formatInrCurrency(paise / 100, { maximumFractionDigits: 2, minimumFractionDigits: 2 }) || '₹0.00';
}
