import {
    ConsoleWorkspace,
    EmptyDataState,
    LeadershipMetric,
    MetricGrid,
    Panel,
    SkipBackendPanel,
    StatusPill,
} from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import {
    fetchConsoleApi,
    formatDateTime,
    type ConsoleDataResponse,
    type ConsolePaginatedResponse,
} from '@/lib/console-api';

type AuditLog = {
    id: string;
    actor_email: string | null;
    actor_type: string | null;
    action: string | null;
    resource_type: string | null;
    ip_address: string | null;
    created_at: string | null;
};

type RuntimeOverview = {
    security_events?: Array<{
        enforcement_id: string;
        control_name: string;
        runtime_root: string;
        status: string;
        severity: string;
        recorded_at?: string | null;
    }>;
    alerts?: Array<{
        alert_name: string;
        runtime_name: string;
        severity: string;
        firing: boolean;
        evaluated_at?: string | null;
    }>;
};

export default async function TrustSafetyPage() {
    const [auditResult, runtimeResult] = await Promise.all([
        fetchConsoleApi<ConsolePaginatedResponse<AuditLog>>('/internal/console/audit-logs', {
            page: 1,
            limit: 10,
        }),
        fetchConsoleApi<ConsoleDataResponse<RuntimeOverview>>('/operations/runtime/overview', {
            limit: 20,
        }),
    ]);
    const auditRows = auditResult.data?.data || [];
    const overview = runtimeResult.data?.data;
    const securityEvents = overview?.security_events || [];
    const firingAlerts = (overview?.alerts || []).filter((alert) => alert.firing);

    return (
        <ConsoleWorkspace
            eyebrow="Trust & Safety"
            title="Trust & Safety"
            description="Read-only governance view for platform audit events, security enforcement projections, and unresolved safety gaps."
        >
            {auditResult.error ? <ConsoleApiErrorPanel title="Audit API unavailable" message={auditResult.error} /> : null}
            {runtimeResult.error ? <ConsoleApiErrorPanel title="Runtime operations API unavailable" message={runtimeResult.error} /> : null}

            <MetricGrid>
                <LeadershipMetric label="Audit events loaded" value={String(auditRows.length)} />
                <LeadershipMetric label="Security events" value={String(securityEvents.length)} />
                <LeadershipMetric label="Firing alerts" value={String(firingAlerts.length)} tone={firingAlerts.length > 0 ? 'critical' : 'success'} />
                <LeadershipMetric label="Critical controls" value={String(securityEvents.filter((event) => event.severity === 'critical').length)} tone="warning" />
            </MetricGrid>

            <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-2">
                <Panel title="Recent Audit Activity" description="Latest platform audit records.">
                    {auditRows.length === 0 ? (
                        <EmptyDataState message="No audit events returned for the current filters." />
                    ) : (
                        <div className="divide-y divide-[var(--lb-color-border)]">
                            {auditRows.map((row) => (
                                <div key={row.id} className="flex items-start justify-between gap-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                    <div className="min-w-0">
                                        <p className="m-0 truncate text-sm font-medium text-[var(--lb-color-text)]">{row.action || 'unknown action'}</p>
                                        <p className="m-0 mt-[var(--lb-space-1)] truncate text-xs text-[var(--lb-color-text-subdued)]">
                                            {row.actor_email || row.actor_type || 'system'} on {row.resource_type || 'resource'}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-xs text-[var(--lb-color-text-subdued)]">{formatDateTime(row.created_at)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>

                <Panel title="Security Enforcement" description="Runtime control evidence from operations overview.">
                    {securityEvents.length === 0 ? (
                        <EmptyDataState message="No security enforcement projections returned." />
                    ) : (
                        <div className="divide-y divide-[var(--lb-color-border)]">
                            {securityEvents.map((event) => (
                                <div key={event.enforcement_id} className="flex items-start justify-between gap-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                    <div className="min-w-0">
                                        <p className="m-0 truncate text-sm font-medium text-[var(--lb-color-text)]">{event.control_name}</p>
                                        <p className="m-0 mt-[var(--lb-space-1)] truncate text-xs text-[var(--lb-color-text-subdued)]">
                                            {event.runtime_root} · {event.severity}
                                        </p>
                                    </div>
                                    <StatusPill value={event.status} />
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>
            </section>

            <SkipBackendPanel title="Case management, takedowns, and merchant risk scores" contract="/v1/internal/console/trust-safety">
                Audit and security projections are readable. Case queues, merchant risk scores, takedowns, and dispute workflows need explicit backend ownership before UI actions can be enabled.
            </SkipBackendPanel>
        </ConsoleWorkspace>
    );
}
