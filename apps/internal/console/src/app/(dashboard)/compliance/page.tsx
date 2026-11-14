import { ConsoleActionForm } from '@/components/ConsoleActionForm';
import { revalidatePath } from 'next/cache';
import type {
    InternalAuditExportCursor,
    InternalAuditExportRunResult,
    InternalComplianceOverview,
    InternalComplianceRetentionPolicy,
    InternalDataSubjectRequest,
} from '@letbuyy/api-client';
import { Button, Input, Select, Table, Textarea } from '@letbuyy/ui';
import {
    ConsoleWorkspace,
    EmptyDataState,
    LeadershipMetric,
    MetricGrid,
    Panel,
    StatusPill,
} from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import {
    fetchConsoleApi,
    formatDateTime,
    readPageParam,
    readSearchParam,
    type ConsoleDataResponse,
    type ConsolePaginatedResponse,
} from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const requestTypeOptions = [
    { label: 'All types', value: 'all' },
    { label: 'Access', value: 'access' },
    { label: 'Erasure', value: 'erasure' },
];

const requestStatusOptions = [
    { label: 'All statuses', value: 'all' },
    { label: 'Open', value: 'open' },
    { label: 'Verifying', value: 'verifying' },
    { label: 'In progress', value: 'in_progress' },
    { label: 'Fulfilled', value: 'fulfilled' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'Expired', value: 'expired' },
];

const updateStatusOptions = requestStatusOptions.filter((option) => option.value !== 'all');

const sourceOptions = [
    { label: 'All sources', value: 'all' },
    { label: 'Manual', value: 'manual' },
    { label: 'Customer data request', value: 'customers/data_request' },
    { label: 'Customer redact', value: 'customers/redact' },
    { label: 'Shop redact', value: 'shop/redact' },
    { label: 'Support', value: 'support' },
    { label: 'Trust & Safety', value: 'trust_safety' },
    { label: 'System', value: 'system' },
];

const createSourceOptions = sourceOptions.filter((option) => option.value !== 'all');

const subjectTypeOptions = [
    { label: 'Customer', value: 'customer' },
    { label: 'Shop', value: 'shop' },
    { label: 'Merchant', value: 'merchant' },
    { label: 'Developer', value: 'developer' },
    { label: 'Employee', value: 'employee' },
    { label: 'Other', value: 'other' },
];

function optionalString(value: FormDataEntryValue | null): string | null {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 ? trimmed : null;
}

function numberValue(value: FormDataEntryValue | null, fallback: number): number {
    const parsed = Number(value || fallback);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function statusTone(value: string): 'success' | 'warning' | 'critical' | 'info' {
    if (value === 'fulfilled') return 'success';
    if (value === 'rejected' || value === 'expired') return 'critical';
    if (value === 'open' || value === 'verifying' || value === 'in_progress') return 'warning';
    return 'info';
}

async function createDataSubjectRequest(formData: FormData) {
    'use server';

    const session = await requireConsoleSession({ mfa: true });
    const reason = String(formData.get('reason') || '').trim();
    if (reason.length < 8) throw new Error('Data-subject request intake requires a reason.');

    const result = await fetchConsoleApi<ConsoleDataResponse<{ request: InternalDataSubjectRequest }>>('/internal/console/compliance/data-requests', {
        method: 'POST',
        body: {
            request_type: String(formData.get('request_type') || 'access'),
            subject_type: String(formData.get('subject_type') || 'customer'),
            subject_id: optionalString(formData.get('subject_id')),
            subject_email: optionalString(formData.get('subject_email')),
            subject_display: optionalString(formData.get('subject_display')),
            site_id: optionalString(formData.get('site_id')),
            source: String(formData.get('source') || 'manual'),
            reason,
            request_payload: {
                intake_surface: 'admin-web.compliance',
            },
            metadata: {
                created_from: 'admin-web',
            },
            actor_id: session.userId || null,
            actor_email: session.email,
            idempotency_key: optionalString(formData.get('idempotency_key')),
        },
    });

    if (result.error) throw new Error(result.error);
    revalidatePath('/compliance');
}

async function updateDataSubjectRequest(formData: FormData) {
    'use server';

    const session = await requireConsoleSession({ mfa: true });
    const requestId = String(formData.get('request_id') || '').trim();
    const status = String(formData.get('status') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!requestId || reason.length < 8) throw new Error('Data-subject request updates require an id and reason.');

    const result = await fetchConsoleApi<ConsoleDataResponse<{ request: InternalDataSubjectRequest }>>(`/internal/console/compliance/data-requests/${requestId}`, {
        method: 'PATCH',
        body: {
            status,
            assignee_id: optionalString(formData.get('assignee_id')),
            fulfillment_summary: optionalString(formData.get('fulfillment_summary')),
            reason,
            metadata: {
                updated_from: 'admin-web',
            },
            actor_id: session.userId || null,
            actor_email: session.email,
        },
    });

    if (result.error) throw new Error(result.error);
    revalidatePath('/compliance');
}

async function runAuditExport(formData: FormData) {
    'use server';

    const session = await requireConsoleSession({ mfa: true });
    const reason = String(formData.get('reason') || '').trim();
    if (reason.length < 8) throw new Error('Audit export dry-run requires a reason.');

    const result = await fetchConsoleApi<ConsoleDataResponse<InternalAuditExportRunResult>>('/internal/console/compliance/audit-exports/run', {
        method: 'POST',
        body: {
            cursor_key: optionalString(formData.get('cursor_key')),
            limit: numberValue(formData.get('limit'), 500),
            reason,
            actor_id: session.userId || null,
            actor_email: session.email,
        },
    });

    if (result.error) throw new Error(result.error);
    revalidatePath('/compliance');
}

export default async function CompliancePage({ searchParams }: PageProps) {
    const session = await requireConsoleSession({ mfa: true });
    const params = searchParams ? await searchParams : undefined;
    const page = readPageParam(params);
    const status = readSearchParam(params, 'status') || 'all';
    const requestType = readSearchParam(params, 'request_type') || 'all';
    const source = readSearchParam(params, 'source') || 'all';
    const q = readSearchParam(params, 'q');

    const [overviewResult, requestsResult, retentionResult, exportsResult] = await Promise.all([
        fetchConsoleApi<ConsoleDataResponse<InternalComplianceOverview>>('/internal/console/compliance/overview'),
        fetchConsoleApi<ConsolePaginatedResponse<InternalDataSubjectRequest>>('/internal/console/compliance/data-requests', {
            page,
            limit: 25,
            status,
            request_type: requestType,
            source,
            q,
            actor_id: session.userId || undefined,
            actor_email: session.email,
        }),
        fetchConsoleApi<ConsoleDataResponse<InternalComplianceRetentionPolicy>>('/internal/console/compliance/retention-policy'),
        fetchConsoleApi<ConsoleDataResponse<{ cursors: InternalAuditExportCursor[] }>>('/internal/console/compliance/audit-exports'),
    ]);

    const overview = overviewResult.data?.data;
    const requests = requestsResult.data?.data || [];
    const meta = requestsResult.data?.meta;
    const retention = retentionResult.data?.data || overview?.retention_policy;
    const cursors = exportsResult.data?.data?.cursors || overview?.audit_export_cursors || [];

    return (
        <ConsoleWorkspace
            eyebrow="Compliance"
            title="Data Subject & Audit Export"
            description="Track privacy requests, review retention rules, and inspect audit export readiness."
        >
            {overviewResult.error ? <ConsoleApiErrorPanel title="Compliance overview unavailable" message={overviewResult.error} /> : null}
            {requestsResult.error ? <ConsoleApiErrorPanel title="Data-subject queue unavailable" message={requestsResult.error} /> : null}
            {retentionResult.error ? <ConsoleApiErrorPanel title="Retention policy unavailable" message={retentionResult.error} /> : null}
            {exportsResult.error ? <ConsoleApiErrorPanel title="Audit export status unavailable" message={exportsResult.error} /> : null}

            <MetricGrid>
                <LeadershipMetric label="Open requests" value={String(overview?.totals.open ?? 'Unavailable')} detail={overview ? `${overview.totals.due_soon} due soon` : 'Source unavailable'} tone="warning" />
                <LeadershipMetric label="Overdue" value={String(overview?.totals.overdue ?? 'Unavailable')} tone={!overview ? 'warning' : overview.totals.overdue ? 'critical' : 'success'} />
                <LeadershipMetric label="Erasure" value={String(overview?.totals.erasure ?? 'Unavailable')} />
                <LeadershipMetric label="Fulfilled" value={String(overview?.totals.fulfilled ?? 'Unavailable')} tone="success" />
            </MetricGrid>

            <Panel title="Data-subject queue" description="Webhook intake and manual requests with due clocks, assignees, and audited status changes.">
                <form action="/compliance" className="mb-[var(--lb-space-4)] grid gap-[var(--lb-space-3)] md:grid-cols-5">
                    <Input name="q" label="Search" defaultValue={q} placeholder="Email, subject, or id" />
                    <Select name="status" label="Status" defaultValue={status} options={requestStatusOptions} />
                    <Select name="request_type" label="Type" defaultValue={requestType} options={requestTypeOptions} />
                    <Select name="source" label="Source" defaultValue={source} options={sourceOptions} />
                    <div className="flex items-end">
                        <Button type="submit" variant="outline" className="w-full">Filter</Button>
                    </div>
                </form>

                {requests.length ? (
                    <Table className="shadow-none" containerClassName="overflow-x-auto" tableClassName="min-w-[1120px] text-left text-sm">
                        <thead className="text-[var(--lb-color-text-subdued)]">
                            <tr className="border-b border-[var(--lb-color-border)]">
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Subject</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Type</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Source</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Due</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Status</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Update</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--lb-color-border)]">
                            {requests.map((request) => (
                                <tr key={request.id} className="align-top">
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">
                                        <div className="font-[var(--lb-font-weight-semibold)]">{request.subject_display || request.subject_email || request.subject_id || request.site_id || request.id}</div>
                                        <div className="mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                                            {request.subject_type} · site {request.site_id || 'none'}
                                        </div>
                                    </td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{request.request_type}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{request.source}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{formatDateTime(request.due_at)}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">
                                        <StatusPill value={request.status} tone={statusTone(request.status)} />
                                    </td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">
                                        <ConsoleActionForm action={updateDataSubjectRequest} className="grid min-w-[360px] gap-[var(--lb-space-2)]">
                                            <Input unstyled type="hidden" name="request_id" value={request.id} />
                                            <Select name="status" hideLabel label="Status" defaultValue={request.status} options={updateStatusOptions} controlSize="sm" />
                                            <Input name="assignee_id" placeholder="Assignee employee id" />
                                            <Textarea name="fulfillment_summary" placeholder="Fulfillment summary" rows={2} />
                                            <div className="flex gap-[var(--lb-space-2)]">
                                                <Input name="reason" required minLength={8} placeholder="Reason" className="min-w-0 flex-1" />
                                                <Button type="submit" size="sm" variant="outline">Save</Button>
                                            </div>
                                        </ConsoleActionForm>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyDataState message="No data-subject requests match this filter." />
                )}
                {meta ? (
                    <p className="m-0 mt-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                        Page {meta.page} of {meta.total_pages || 1} · {meta.total} requests
                    </p>
                ) : null}
            </Panel>

            <Panel title="Manual intake" description="Create a governed request when legal/support intake arrives outside app-store webhooks.">
                <ConsoleActionForm action={createDataSubjectRequest} className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                    <Select name="request_type" label="Request type" options={requestTypeOptions.filter((option) => option.value !== 'all')} defaultValue="access" />
                    <Select name="subject_type" label="Subject type" options={subjectTypeOptions} defaultValue="customer" />
                    <Input name="subject_email" type="email" label="Subject email" placeholder="customer@example.com" />
                    <Input name="subject_id" label="Subject id" placeholder="Customer, merchant, or developer id" />
                    <Input name="subject_display" label="Subject display" placeholder="Human-readable subject" />
                    <Input name="site_id" label="Site id" placeholder="Optional site UUID" />
                    <Select name="source" label="Source" options={createSourceOptions} defaultValue="manual" />
                    <Input unstyled type="hidden" name="idempotency_key" value={crypto.randomUUID()} />
                    <div className="md:col-span-2">
                        <Textarea name="reason" required minLength={8} label="Reason" placeholder="Why this request is being opened" />
                    </div>
                    <div className="md:col-span-2">
                        <Button type="submit">Create request</Button>
                    </div>
                </ConsoleActionForm>
            </Panel>

            <Panel title="Retention policy" description="T&S enforcement records are explicitly retention-exempt; purgeable PII moves through the request workflow.">
                {retention ? (
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                        {retention.policies.map((policy) => (
                            <article key={String(policy.key)} className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
                                <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                                    <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)]">{String(policy.label)}</h3>
                                    <StatusPill value={String(policy.disposition)} tone={String(policy.disposition).includes('exempt') ? 'warning' : 'info'} />
                                </div>
                                <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                                    {String(policy.erasure_behavior)}
                                </p>
                                <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                                    Tables: {Array.isArray(policy.tables) ? policy.tables.join(', ') : 'not listed'}
                                </p>
                            </article>
                        ))}
                    </div>
                ) : (
                    <EmptyDataState message="Retention policy data is not available." />
                )}
            </Panel>

            <Panel title="Audit export" description="Tamper-evident audit export cursor with a local dry-run sink until an external SIEM/WORM destination is configured." action={(
                <ConsoleActionForm action={runAuditExport} className="grid gap-[var(--lb-space-2)] md:grid-cols-[minmax(160px,1fr)_120px_minmax(220px,1fr)_auto]">
                    <Input name="cursor_key" placeholder="audit_logs:local_dry_run" />
                    <Input name="limit" type="number" min={1} max={1000} defaultValue={500} />
                    <Input name="reason" required minLength={8} placeholder="Reason" />
                    <Button type="submit" variant="outline">Run</Button>
                </ConsoleActionForm>
            )}>
                {cursors.length ? (
                    <Table className="shadow-none" containerClassName="overflow-x-auto" tableClassName="min-w-[860px] text-left text-sm">
                        <thead className="text-[var(--lb-color-text-subdued)]">
                            <tr className="border-b border-[var(--lb-color-border)]">
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Cursor</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Sink</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Status</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Rows</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Last export</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">Checksum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--lb-color-border)]">
                            {cursors.map((cursor) => (
                                <tr key={cursor.id}>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{cursor.cursor_key}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{cursor.sink_type}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]"><StatusPill value={cursor.status} tone={cursor.status === 'failed' ? 'critical' : 'success'} /></td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{cursor.rows_exported}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{formatDateTime(cursor.last_exported_at)}</td>
                                    <td className="max-w-[220px] truncate px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{cursor.checksum || 'none'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyDataState message="No audit export cursor has run yet." />
                )}
            </Panel>
        </ConsoleWorkspace>
    );
}
