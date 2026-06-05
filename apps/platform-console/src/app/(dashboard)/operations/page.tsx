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
import { fetchConsoleApi, formatDateTime, type ConsoleDataResponse } from '@/lib/console-api';

const OPERATIONS_AUTH_CONTRACT = 'PLATFORM_CONSOLE_API_TOKEN';
const OPERATIONS_OVERVIEW_CONTRACT = '/v1/operations/runtime/overview?limit=30';
const OPERATIONS_CACHE_CONTRACT = "cache: 'no-store'";

type OperationsOverview = {
    health?: Array<{ runtime_name: string; status: string; region?: string | null; checked_at?: string | null }>;
    queues?: Array<{ queue_name: string; depth?: number | null; leased?: number | null; retrying?: number | null; dead_lettered?: number | null; sampled_at?: string | null }>;
    alerts?: Array<{ alert_name: string; runtime_name: string; severity: string; firing: boolean; evaluated_at?: string | null }>;
    incidents?: Array<{ incident_id: string; title: string; severity: string; status: string; started_at?: string | null }>;
    deployments?: Array<{ promotion_id: string; runtime_name: string; environment: string; strategy: string; status: string; version: string; created_at?: string | null }>;
    deployment_health_gates?: Array<{ gate_id: string; runtime_root: string; environment: string; gate_name: string; status: string; evaluated_at?: string | null }>;
    event_store_integrity?: Array<{ check_id: string; stream_name?: string | null; status: string; checked_events?: number | null; gap_count?: number | null; duplicate_count?: number | null; checked_at?: string | null }>;
    security_events?: Array<{ enforcement_id: string; control_name: string; runtime_root: string; status: string; severity: string; recorded_at?: string | null }>;
    error_budgets?: Array<{ budget_id: string; runtime_name: string; slo_id: string; status: string; remaining_budget_percent: number; burn_rate: number; sampled_at?: string | null }>;
    regional_routing_overrides?: Array<{ override_id: string; runtime_root: string; source_region: string; target_region: string; status: string; created_at?: string | null }>;
    certification_reports?: Array<{ certification_id: string; certification_mode: string; status: string; repository_maturity_score: number; live_maturity_score: number; generated_at?: string | null; expires_at?: string | null }>;
};

type StatusListItem = {
    key: string;
    label: string;
    detail: string;
    status: string;
    timestamp?: string | null;
};

async function loadOperationsOverview(): Promise<{ overview?: OperationsOverview; error?: string }> {
    const result = await fetchConsoleApi<ConsoleDataResponse<OperationsOverview>>('/operations/runtime/overview', {
        limit: 30,
    });

    if (result.error) return { error: result.error };

    return { overview: result.data?.data || {} };
}

export default async function OperationsDashboardPage() {
    const { overview, error } = await loadOperationsOverview();
    const consoleApiTokenConfigured = Boolean(process.env.PLATFORM_CONSOLE_API_TOKEN);
    const health = overview?.health || [];
    const queues = overview?.queues || [];
    const alerts = overview?.alerts || [];
    const incidents = overview?.incidents || [];
    const deployments = overview?.deployments || [];
    const deploymentHealth = overview?.deployment_health_gates || [];
    const integrity = overview?.event_store_integrity || [];
    const security = overview?.security_events || [];
    const budgets = overview?.error_budgets || [];
    const regional = overview?.regional_routing_overrides || [];
    const certifications = overview?.certification_reports || [];
    const latestCertification = certifications[0];
    const dlqMessages = queues.reduce((total, item) => total + Number(item.dead_lettered || 0), 0);
    const frozenBudgets = budgets.filter((item) => item.status === 'freeze' || item.status === 'exhausted').length;
    const firingAlerts = alerts.filter((item) => item.firing).length;

    return (
        <ConsoleWorkspace
            eyebrow="Platform Ops"
            title="Platform Ops"
            description="Runtime health, queue diagnostics, deployments, security controls, regional routing, and certification evidence from the operations control plane."
        >
            <p className="sr-only">
                Operations live data contract: {OPERATIONS_AUTH_CONTRACT}; {OPERATIONS_OVERVIEW_CONTRACT}; {OPERATIONS_CACHE_CONTRACT};
                console API token configured: {consoleApiTokenConfigured ? 'yes' : 'no'}.
            </p>

            {error ? <ConsoleApiErrorPanel title="Operations API unavailable" message={error} /> : null}

            <MetricGrid>
                <LeadershipMetric label="Healthy runtimes" value={`${health.filter((item) => item.status === 'healthy').length}/${health.length}`} />
                <LeadershipMetric label="Open incidents" value={String(incidents.filter((item) => item.status !== 'closed').length)} tone={incidents.length > 0 ? 'warning' : 'success'} />
                <LeadershipMetric label="DLQ messages" value={String(dlqMessages)} tone={dlqMessages > 0 ? 'critical' : 'success'} />
                <LeadershipMetric label="Firing alerts" value={String(firingAlerts)} tone={firingAlerts > 0 ? 'critical' : 'success'} />
                <LeadershipMetric label="Frozen budgets" value={String(frozenBudgets)} tone={frozenBudgets > 0 ? 'warning' : 'success'} />
                <LeadershipMetric label="Certification" value={latestCertification ? `${latestCertification.live_maturity_score}/10` : 'none'} detail={latestCertification?.status || 'No report returned'} />
            </MetricGrid>

            <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-2">
                <StatusPanel
                    title="Runtime Health"
                    description="Recent runtime health projections."
                    items={health.map((item) => ({
                        key: `${item.runtime_name}-${item.checked_at || item.region || 'global'}`,
                        label: item.runtime_name,
                        detail: item.region || 'global',
                        status: item.status,
                        timestamp: item.checked_at,
                    }))}
                />

                <StatusPanel
                    title="Queue Diagnostics"
                    description="Distributed queue pressure and dead-letter signals."
                    items={queues.map((item) => ({
                        key: `${item.queue_name}-${item.sampled_at || 'latest'}`,
                        label: item.queue_name,
                        detail: `depth ${item.depth ?? 0} · leased ${item.leased ?? 0} · retrying ${item.retrying ?? 0} · dlq ${item.dead_lettered ?? 0}`,
                        status: (item.dead_lettered || 0) > 0 ? 'degraded' : 'healthy',
                        timestamp: item.sampled_at,
                    }))}
                />

                <StatusPanel
                    title="Deployment Gates"
                    description="Latest promotions and health-gate results."
                    items={[
                        ...deployments.map((item) => ({
                            key: item.promotion_id,
                            label: item.runtime_name,
                            detail: `${item.environment} · ${item.strategy} · ${item.version}`,
                            status: item.status,
                            timestamp: item.created_at,
                        })),
                        ...deploymentHealth.map((item) => ({
                            key: item.gate_id,
                            label: item.runtime_root,
                            detail: `${item.environment} · ${item.gate_name}`,
                            status: item.status,
                            timestamp: item.evaluated_at,
                        })),
                    ]}
                />

                <StatusPanel
                    title="Event Store Integrity"
                    description="Replay and event stream consistency checks."
                    items={integrity.map((item) => ({
                        key: item.check_id,
                        label: item.stream_name || item.check_id,
                        detail: `${item.checked_events ?? 0} events · gaps ${item.gap_count ?? 0} · duplicates ${item.duplicate_count ?? 0}`,
                        status: item.status,
                        timestamp: item.checked_at,
                    }))}
                />

                <StatusPanel
                    title="Security Enforcement"
                    description="Security controls recorded by the operations runtime."
                    items={security.map((item) => ({
                        key: item.enforcement_id,
                        label: item.control_name,
                        detail: `${item.runtime_root} · ${item.severity}`,
                        status: item.status,
                        timestamp: item.recorded_at,
                    }))}
                />

                <StatusPanel
                    title="Regional Overrides"
                    description="Temporary region routing exceptions."
                    items={regional.map((item) => ({
                        key: item.override_id,
                        label: item.runtime_root,
                        detail: `${item.source_region} to ${item.target_region}`,
                        status: item.status,
                        timestamp: item.created_at,
                    }))}
                />

                <StatusPanel
                    title="Operational Certification"
                    description="Certification score evidence for leadership review."
                    items={certifications.map((item) => ({
                        key: item.certification_id,
                        label: item.certification_id,
                        detail: `${item.certification_mode} · repo ${item.repository_maturity_score}/10 · live ${item.live_maturity_score}/10`,
                        status: item.status,
                        timestamp: item.generated_at,
                    }))}
                />
            </section>

            <SkipBackendPanel title="Manual remediation command forms" contract="/v1/operations/runtime/control-commands">
                The gateway exposes runtime control command contracts, but this console pass keeps Platform Ops read-only until audited command UX, approvals, and idempotency keys are designed.
            </SkipBackendPanel>
        </ConsoleWorkspace>
    );
}

function StatusPanel({
    title,
    description,
    items,
}: {
    title: string;
    description: string;
    items: StatusListItem[];
}) {
    return (
        <Panel title={title} description={description}>
            {items.length === 0 ? (
                <EmptyDataState message="No live records returned." />
            ) : (
                <div className="divide-y divide-[var(--lb-color-border)]">
                    {items.map((item) => (
                        <div key={item.key} className="flex items-start justify-between gap-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                            <div className="min-w-0">
                                <p className="m-0 truncate text-sm font-medium text-[var(--lb-color-text)]">{item.label}</p>
                                <p className="m-0 mt-[var(--lb-space-1)] truncate text-xs text-[var(--lb-color-text-subdued)]">{item.detail}</p>
                                {item.timestamp ? (
                                    <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">
                                        {formatDateTime(item.timestamp)}
                                    </p>
                                ) : null}
                            </div>
                            <StatusPill value={item.status} />
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
}
