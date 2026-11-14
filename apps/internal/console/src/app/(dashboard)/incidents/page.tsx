import { ConsoleActionForm } from '@/components/ConsoleActionForm';
import { revalidatePath } from 'next/cache';
import type {
    InternalProductionIncident,
    InternalIncidentSeverity,
    InternalIncidentStatus,
} from '@letbuyy/api-client';
import { Button, Input, Textarea } from '@letbuyy/ui';
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
    type ConsoleDataResponse,
} from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';

const INCIDENTS_LIMIT = 50;

const inputClassName =
    'rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityTone(
    severity: InternalIncidentSeverity,
): 'critical' | 'warning' | 'info' {
    if (severity === 'sev1' || severity === 'sev2') return 'critical';
    if (severity === 'sev3') return 'warning';
    return 'info';
}

function statusTone(
    status: InternalIncidentStatus,
): 'critical' | 'warning' | 'success' | undefined {
    if (status === 'open') return 'critical';
    if (status === 'mitigating') return 'warning';
    if (status === 'resolved' || status === 'closed') return 'success';
    return undefined;
}

function csvValues(value: FormDataEntryValue | null): string[] {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Server actions — mirror the operations page pattern exactly
// ---------------------------------------------------------------------------

async function createIncident(formData: FormData) {
    'use server';

    await requireConsoleSession({ mfa: true });

    const incidentId = String(formData.get('incident_id') || '').trim();
    const title = String(formData.get('title') || '').trim();
    const severity = String(formData.get('severity') || 'sev3');
    const customerImpact = String(formData.get('customer_impact') || '').trim();
    const reason = String(formData.get('reason') || '').trim();

    if (!incidentId || !title || customerImpact.length < 8 || reason.length < 8) {
        throw new Error(
            'Incident creation requires an id, title, customer impact (≥ 8 chars), and reason (≥ 8 chars).',
        );
    }

    const result = await fetchConsoleApi<
        ConsoleDataResponse<{ incident: InternalProductionIncident }>
    >('/operations/runtime/incidents', {
        method: 'POST',
        body: {
            incident_id: incidentId,
            title,
            severity,
            affected_runtimes: csvValues(formData.get('affected_runtimes')),
            affected_regions: csvValues(formData.get('affected_regions')),
            customer_impact: customerImpact,
            reason,
            metadata: { source: 'admin-web.incidents-center' },
        },
    });

    if (result.error) throw new Error(result.error);
    revalidatePath('/incidents');
}

async function updateIncidentStatus(formData: FormData) {
    'use server';

    await requireConsoleSession({ mfa: true });

    const incidentId = String(formData.get('incident_id') || '').trim();
    const status = String(formData.get('status') || '').trim();
    const summary = String(formData.get('summary') || '').trim();

    if (
        !incidentId ||
        !['open', 'mitigating', 'resolved', 'closed'].includes(status) ||
        summary.length < 8
    ) {
        throw new Error(
            'Status update requires an incident id, valid status, and summary (≥ 8 chars).',
        );
    }

    const result = await fetchConsoleApi<
        ConsoleDataResponse<{ incident: InternalProductionIncident }>
    >(`/operations/runtime/incidents/${incidentId}/status`, {
        method: 'PATCH',
        body: {
            status,
            summary,
            details: { source: 'admin-web.incidents-center' },
        },
    });

    if (result.error) throw new Error(result.error);
    revalidatePath('/incidents');
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

type IncidentsPageData = {
    incidents: InternalProductionIncident[];
    errors: string[];
};

async function loadIncidentsData(): Promise<IncidentsPageData> {
    const result = await fetchConsoleApi<
        ConsoleDataResponse<{ incidents: InternalProductionIncident[] }>
    >('/operations/runtime/incidents', { limit: String(INCIDENTS_LIMIT) });

    const errors = [result.error].filter((e): e is string => Boolean(e));

    return {
        incidents: result.data?.data.incidents ?? [],
        errors,
    };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function IncidentsCenterPage() {
    const data = await loadIncidentsData();

    const incidents = data.incidents;
    const open = incidents.filter((i) => i.status === 'open').length;
    const mitigating = incidents.filter((i) => i.status === 'mitigating').length;
    const sev12Open = incidents.filter(
        (i) =>
            (i.severity === 'sev1' || i.severity === 'sev2') &&
            i.status !== 'closed',
    ).length;
    const closed = incidents.filter((i) => i.status === 'closed').length;

    return (
        <ConsoleWorkspace
            eyebrow="Incident management"
            title="Incidents Center"
            description="Declare, track, and resolve production incidents. SEV-1/2 closure is blocked until an accepted postmortem exists. All actions are audit-logged."
        >
            {data.errors.map((error) => (
                <ConsoleApiErrorPanel
                    key={error}
                    title="Incidents API unavailable"
                    message={error}
                />
            ))}

            <MetricGrid>
                <LeadershipMetric
                    label="Total incidents"
                    value={data.errors.length ? 'Unavailable' : String(incidents.length)}
                />
                <LeadershipMetric
                    label="Open"
                    value={data.errors.length ? 'Unavailable' : String(open)}
                    tone={open > 0 ? 'critical' : 'success'}
                />
                <LeadershipMetric
                    label="Mitigating"
                    value={data.errors.length ? 'Unavailable' : String(mitigating)}
                    tone={mitigating > 0 ? 'warning' : 'success'}
                />
                <LeadershipMetric
                    label="SEV-1/2 open"
                    value={data.errors.length ? 'Unavailable' : String(sev12Open)}
                    detail="Critical severity, not yet closed"
                    tone={sev12Open > 0 ? 'critical' : 'success'}
                />
                <LeadershipMetric
                    label="Closed"
                    value={data.errors.length ? 'Unavailable' : String(closed)}
                    tone="neutral"
                />
            </MetricGrid>

            <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
                <IncidentListPanel
                    incidents={incidents}
                />
                <DeclareIncidentPanel />
            </section>
        </ConsoleWorkspace>
    );
}

// ---------------------------------------------------------------------------
// Incident list + per-incident status update + timeline detail
// ---------------------------------------------------------------------------

function IncidentListPanel({
    incidents,
}: {
    incidents: InternalProductionIncident[];
}) {
    return (
        <Panel
            title="Production Incidents"
            description={`Last ${INCIDENTS_LIMIT} incidents ordered by start time. Use the status controls to move an incident through its lifecycle.`}
        >
            {incidents.length === 0 ? (
                <EmptyDataState message="No incidents returned from the gateway." />
            ) : (
                <div className="grid gap-[var(--lb-space-3)]">
                    {incidents.map((incident) => (
                        <IncidentCard key={incident.incident_id} incident={incident} />
                    ))}
                </div>
            )}
        </Panel>
    );
}

function IncidentCard({ incident }: { incident: InternalProductionIncident }) {
    const isHighSeverity =
        incident.severity === 'sev1' || incident.severity === 'sev2';
    const isActive =
        incident.status === 'open' || incident.status === 'mitigating';

    return (
        <article className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
            {/* Header */}
            <div className="flex flex-col gap-[var(--lb-space-2)] sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                        <h3 className="m-0 text-base font-semibold text-[var(--lb-color-text)]">
                            {incident.title}
                        </h3>
                        <StatusPill
                            value={incident.severity.toUpperCase()}
                            tone={severityTone(incident.severity)}
                        />
                        <StatusPill
                            value={incident.status}
                            tone={statusTone(incident.status)}
                        />
                    </div>
                    <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">
                        {incident.incident_id}
                        {incident.started_at
                            ? ` · started ${formatDateTime(incident.started_at)}`
                            : null}
                        {incident.commander_id
                            ? ` · commander ${incident.commander_id}`
                            : null}
                    </p>
                </div>
            </div>

            {/* Customer impact */}
            {incident.customer_impact ? (
                <p className="m-0 mt-[var(--lb-space-2)] text-sm text-[var(--lb-color-text-subdued)]">
                    {incident.customer_impact}
                </p>
            ) : null}

            {/* Close gate notice */}
            {isHighSeverity && isActive ? (
                <p className="m-0 mt-[var(--lb-space-2)] text-xs text-[var(--lb-color-warning)]">
                    SEV-1/2 closure requires an accepted postmortem — create one
                    from Platform Ops.
                </p>
            ) : null}

            {/* Affected runtimes / regions */}
            {(incident.affected_runtimes?.length ||
                incident.affected_regions?.length) ? (
                <div className="mt-[var(--lb-space-3)] flex flex-wrap gap-[var(--lb-space-2)]">
                    {incident.affected_runtimes?.map((r) => (
                        <span
                            key={r}
                            className="inline-flex items-center rounded-[var(--lb-radius-sm)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] py-0.5 text-xs text-[var(--lb-color-text-subdued)]"
                        >
                            {r}
                        </span>
                    ))}
                    {incident.affected_regions?.map((r) => (
                        <span
                            key={r}
                            className="inline-flex items-center rounded-[var(--lb-radius-sm)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] py-0.5 text-xs text-[var(--lb-color-text-subdued)]"
                        >
                            {r}
                        </span>
                    ))}
                </div>
            ) : null}

            {/* Timeline summary */}
            <div className="mt-[var(--lb-space-3)] grid grid-cols-3 gap-[var(--lb-space-2)] text-xs text-[var(--lb-color-text-subdued)]">
                <span>
                    Opened:{' '}
                    {incident.started_at
                        ? formatDateTime(incident.started_at)
                        : '—'}
                </span>
                <span>
                    Mitigated:{' '}
                    {incident.mitigated_at
                        ? formatDateTime(incident.mitigated_at)
                        : '—'}
                </span>
                <span>
                    Resolved:{' '}
                    {incident.resolved_at
                        ? formatDateTime(incident.resolved_at)
                        : '—'}
                </span>
            </div>

            {/* Status update form — only for non-closed incidents */}
            {incident.status !== 'closed' ? (
                <ConsoleActionForm
                    action={updateIncidentStatus}
                    className="mt-[var(--lb-space-4)] grid gap-[var(--lb-space-2)] sm:grid-cols-[1fr_1fr_auto]"
                >
                    <Input
                        unstyled
                        type="hidden"
                        name="incident_id"
                        value={incident.incident_id}
                    />
                    <label className="flex flex-col gap-[var(--lb-space-1)] text-sm font-medium">
                        <span className="sr-only">New status</span>
                        <select aria-label="Status"
                            name="status"
                            defaultValue={incident.status}
                            className={inputClassName}
                        >
                            <option value="open">Open</option>
                            <option value="mitigating">Mitigating</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                        </select>
                    </label>
                    <Input
                        name="summary"
                        placeholder="Status change summary (≥ 8 chars)"
                        required
                    />
                    <Button type="submit" variant="secondary">
                        Update
                    </Button>
                </ConsoleActionForm>
            ) : null}

            {/* Postmortem link if present */}
            {incident.postmortem_url ? (
                <p className="m-0 mt-[var(--lb-space-3)] text-xs">
                    <a
                        href={incident.postmortem_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--lb-color-text-link)] underline"
                    >
                        View postmortem
                    </a>
                </p>
            ) : null}
        </article>
    );
}

// ---------------------------------------------------------------------------
// Declare incident sidebar panel
// ---------------------------------------------------------------------------

function DeclareIncidentPanel() {
    return (
        <Panel
            title="Declare Incident"
            description="All fields are required. Customer impact and reason must be at least 8 characters. The commander is set to the authenticated operator."
        >
            <ConsoleActionForm
                action={createIncident}
                className="grid gap-[var(--lb-space-3)]"
            >
                <Input
                    name="incident_id"
                    label="Incident ID"
                    placeholder="INC-2026-0001"
                    required
                />
                <Input
                    name="title"
                    label="Title"
                    placeholder="Checkout payment latency spike"
                    required
                />
                <label className="flex flex-col gap-[var(--lb-space-1)] text-sm font-medium">
                    Severity
                    <select aria-label="Severity"
                        name="severity"
                        defaultValue="sev3"
                        className={inputClassName}
                    >
                        <option value="sev1">SEV-1 — Critical, all-hands</option>
                        <option value="sev2">SEV-2 — Major impact</option>
                        <option value="sev3">SEV-3 — Degraded service</option>
                        <option value="sev4">SEV-4 — Minor / cosmetic</option>
                    </select>
                </label>
                <Input
                    name="affected_runtimes"
                    label="Affected runtimes"
                    placeholder="api-gateway, checkout"
                />
                <Input
                    name="affected_regions"
                    label="Affected regions"
                    placeholder="bom, del"
                />
                <Textarea
                    name="customer_impact"
                    label="Customer impact"
                    placeholder="Merchant checkout attempts are intermittently failing with payment timeout errors."
                    required
                />
                <Textarea
                    name="reason"
                    label="Reason / evidence"
                    placeholder="Alert confirmed by on-call — Razorpay P95 latency exceeded 10 s threshold."
                    required
                />
                <Button type="submit">Declare incident</Button>
            </ConsoleActionForm>
        </Panel>
    );
}
