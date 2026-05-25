import { AlertTriangle, CheckCircle2, GitBranch, RadioTower, RotateCcw, ShieldAlert } from 'lucide-react';

type OperationsOverview = {
    health?: Array<{ runtime_name: string; status: string; region?: string | null; checked_at?: string | null }>;
    queues?: Array<{ queue_name: string; depth?: number | null; leased?: number | null; retrying?: number | null; dead_lettered?: number | null; sampled_at?: string | null }>;
    incidents?: Array<{ incident_id: string; title: string; severity: string; status: string; started_at?: string | null }>;
    deployments?: Array<{ promotion_id: string; runtime_name: string; environment: string; strategy: string; status: string; version: string; created_at?: string | null }>;
    event_store_integrity?: Array<{ check_id: string; stream_name?: string | null; status: string; checked_events?: number | null; gap_count?: number | null; duplicate_count?: number | null; checked_at?: string | null }>;
    security_events?: Array<{ enforcement_id: string; control_name: string; runtime_root: string; status: string; severity: string; recorded_at?: string | null }>;
    error_budgets?: Array<{ budget_id: string; runtime_name: string; slo_id: string; status: string; remaining_budget_percent: number; burn_rate: number; sampled_at?: string | null }>;
    regional_routing_overrides?: Array<{ override_id: string; runtime_root: string; source_region: string; target_region: string; status: string; created_at?: string | null }>;
};

type ApiEnvelope = {
    data?: OperationsOverview;
    error?: {
        code?: string;
        message?: string;
    };
};

async function loadOperationsOverview(): Promise<{ overview?: OperationsOverview; error?: string }> {
    const token = process.env.PLATFORM_CONSOLE_API_TOKEN;
    const apiBase = process.env.PLATFORM_CONSOLE_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.letbuyy.store';

    if (!token) {
        return { error: 'PLATFORM_CONSOLE_API_TOKEN is not configured for live operations access.' };
    }

    const response = await fetch(`${apiBase}/v1/operations/runtime/overview?limit=30`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'X-Request-ID': `platform-console-operations-${Date.now()}`,
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        return { error: `Operations API returned HTTP ${response.status}.` };
    }

    const payload = (await response.json()) as ApiEnvelope;
    if (payload.error) {
        return { error: payload.error.message || payload.error.code || 'Operations API returned an error.' };
    }

    return { overview: payload.data || {} };
}

export default async function OperationsDashboardPage() {
    const { overview, error } = await loadOperationsOverview();

    if (error) {
        return (
            <main className="p-8">
                <PageHeader />
                <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <h2 className="text-sm font-semibold">Operations API unavailable</h2>
                            <p className="mt-1 text-sm text-amber-100/80">{error}</p>
                        </div>
                    </div>
                </section>
            </main>
        );
    }

    const health = overview?.health || [];
    const queues = overview?.queues || [];
    const incidents = overview?.incidents || [];
    const deployments = overview?.deployments || [];
    const integrity = overview?.event_store_integrity || [];
    const security = overview?.security_events || [];
    const budgets = overview?.error_budgets || [];
    const regional = overview?.regional_routing_overrides || [];

    return (
        <main className="space-y-8 p-8">
            <PageHeader />

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile label="Healthy runtimes" value={`${health.filter((item) => item.status === 'healthy').length}/${health.length}`} />
                <MetricTile label="Open incidents" value={String(incidents.filter((item) => item.status !== 'closed').length)} />
                <MetricTile label="DLQ messages" value={String(queues.reduce((total, item) => total + Number(item.dead_lettered || 0), 0))} />
                <MetricTile label="Frozen budgets" value={String(budgets.filter((item) => item.status === 'freeze' || item.status === 'exhausted').length)} />
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
                <OperationalPanel title="Runtime Health" icon={<RadioTower size={18} />}>
                    {health.map((item) => (
                        <StatusRow key={`${item.runtime_name}-${item.checked_at}`} label={item.runtime_name} detail={item.region || 'global'} status={item.status} />
                    ))}
                </OperationalPanel>

                <OperationalPanel title="Queue Diagnostics" icon={<RotateCcw size={18} />}>
                    {queues.map((item) => (
                        <StatusRow
                            key={`${item.queue_name}-${item.sampled_at}`}
                            label={item.queue_name}
                            detail={`depth ${item.depth ?? 0} · leased ${item.leased ?? 0} · retrying ${item.retrying ?? 0} · dlq ${item.dead_lettered ?? 0}`}
                            status={(item.dead_lettered || 0) > 0 ? 'degraded' : 'healthy'}
                        />
                    ))}
                </OperationalPanel>

                <OperationalPanel title="Deployment Gates" icon={<GitBranch size={18} />}>
                    {deployments.map((item) => (
                        <StatusRow key={item.promotion_id} label={item.runtime_name} detail={`${item.environment} · ${item.strategy} · ${item.version}`} status={item.status} />
                    ))}
                </OperationalPanel>

                <OperationalPanel title="Event Store Integrity" icon={<CheckCircle2 size={18} />}>
                    {integrity.map((item) => (
                        <StatusRow
                            key={item.check_id}
                            label={item.stream_name || item.check_id}
                            detail={`${item.checked_events ?? 0} events · gaps ${item.gap_count ?? 0} · duplicates ${item.duplicate_count ?? 0}`}
                            status={item.status}
                        />
                    ))}
                </OperationalPanel>

                <OperationalPanel title="Security Enforcement" icon={<ShieldAlert size={18} />}>
                    {security.map((item) => (
                        <StatusRow key={item.enforcement_id} label={item.control_name} detail={`${item.runtime_root} · ${item.severity}`} status={item.status} />
                    ))}
                </OperationalPanel>

                <OperationalPanel title="Regional Overrides" icon={<RadioTower size={18} />}>
                    {regional.map((item) => (
                        <StatusRow key={item.override_id} label={item.runtime_root} detail={`${item.source_region} to ${item.target_region}`} status={item.status} />
                    ))}
                </OperationalPanel>
            </section>
        </main>
    );
}

function PageHeader() {
    return (
        <header>
            <h1 className="text-2xl font-bold text-zinc-50">Production Operations</h1>
            <p className="mt-1 text-sm text-zinc-400">Live runtime projections from the operations control-plane.</p>
        </header>
    );
}

function MetricTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-medium text-zinc-400">{label}</p>
            <p className="mt-2 text-3xl font-bold text-zinc-50">{value}</p>
        </div>
    );
}

function OperationalPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-4 text-sm font-semibold text-zinc-100">
                {icon}
                {title}
            </div>
            <div className="divide-y divide-zinc-800">
                {Array.isArray(children) && children.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-zinc-500">No live records returned.</p>
                ) : children}
            </div>
        </section>
    );
}

function StatusRow({ label, detail, status }: { label: string; detail: string; status: string }) {
    const normalized = status.toLowerCase();
    const tone = ['healthy', 'passed', 'promoted', 'active'].includes(normalized)
        ? 'bg-emerald-500/10 text-emerald-300'
        : ['failed', 'blocked', 'exhausted', 'critical'].includes(normalized)
            ? 'bg-red-500/10 text-red-300'
            : 'bg-amber-500/10 text-amber-300';

    return (
        <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">{label}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">{detail}</p>
            </div>
            <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${tone}`}>{status}</span>
        </div>
    );
}
