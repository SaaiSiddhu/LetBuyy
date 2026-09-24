import type { InternalTrustSafetyCase, InternalTrustSafetyOverview } from '@letbuyy/api-client';
import {
    ConsoleWorkspace,
    EmptyDataState,
    LeadershipMetric,
    MetricGrid,
    Panel,
    StatusPill,
} from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import { fetchConsoleApi, formatDateTime, type ConsoleDataResponse } from '@/lib/console-api';

export default async function TrustSafetyPage() {
    const result = await fetchConsoleApi<ConsoleDataResponse<InternalTrustSafetyOverview>>('/operations/trust-safety/overview');
    const overview = result.data?.data;
    const recentCases = overview?.recent_cases || [];
    const activeTakedowns = overview?.active_takedowns || [];
    const appeals = overview?.appeals || [];
    const policies = overview?.policies || [];

    return (
        <ConsoleWorkspace
            eyebrow="Trust & Safety"
            title="Trust & Safety"
            description="Case oversight for policy enforcement, appeals, takedowns, and immutable safety decisions."
        >
            {result.error ? <ConsoleApiErrorPanel title="Trust & Safety API unavailable" message={result.error} /> : null}

            <MetricGrid>
                <LeadershipMetric label="Open cases" value={String(overview?.counts.open_cases || 0)} tone={(overview?.counts.open_cases || 0) > 0 ? 'warning' : 'success'} />
                <LeadershipMetric label="Active takedowns" value={String(overview?.counts.active_takedowns || 0)} tone={(overview?.counts.active_takedowns || 0) > 0 ? 'critical' : 'success'} />
                <LeadershipMetric label="Pending appeals" value={String(overview?.counts.pending_appeals || 0)} tone={(overview?.counts.pending_appeals || 0) > 0 ? 'warning' : 'success'} />
                <LeadershipMetric label="Case sample" value={String(overview?.counts.total_cases_sampled || 0)} />
            </MetricGrid>

            <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-[1.2fr_0.8fr]">
                <Panel title="Recent Cases" description="Latest Trust & Safety cases from the system of record.">
                    {recentCases.length === 0 ? (
                        <EmptyDataState message="No Trust & Safety cases have been opened yet." />
                    ) : (
                        <div className="divide-y divide-[var(--lb-color-border)]">
                            {recentCases.map((caseRow) => <CaseRow key={caseRow.id} caseRow={caseRow} />)}
                        </div>
                    )}
                </Panel>

                <Panel title="Active Policies" description="Versioned default policies currently available to case reviewers.">
                    {policies.length === 0 ? (
                        <EmptyDataState message="No active Trust & Safety policies returned." />
                    ) : (
                        <div className="grid gap-[var(--lb-space-3)]">
                            {policies.map((policy) => (
                                <div key={policy.id} className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                                    <p className="m-0 text-sm font-medium text-[var(--lb-color-text)]">{policy.title}</p>
                                    <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">
                                        {policy.policy_key} · version {String(policy.version || 1)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>
            </section>

            <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-2">
                <Panel title="Active Takedowns" description="Enforcement records retained for audit and appeal review.">
                    {activeTakedowns.length === 0 ? (
                        <EmptyDataState message="No active takedowns or suspensions." />
                    ) : (
                        <div className="divide-y divide-[var(--lb-color-border)]">
                            {activeTakedowns.map((takedown) => (
                                <div key={takedown.id} className="grid gap-[var(--lb-space-2)] py-[var(--lb-space-3)] md:grid-cols-[1fr_auto] md:items-center">
                                    <div className="min-w-0">
                                        <p className="m-0 truncate text-sm font-medium text-[var(--lb-color-text)]">{formatLabel(takedown.action_type)}</p>
                                        <p className="m-0 mt-[var(--lb-space-1)] truncate text-xs text-[var(--lb-color-text-subdued)]">
                                            {takedown.subject_type}:{takedown.subject_id}
                                        </p>
                                    </div>
                                    <StatusPill value={takedown.status} tone={takedown.status === 'active' ? 'critical' : undefined} />
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>

                <Panel title="Appeals" description="Filed appeals and due dates requiring independent review.">
                    {appeals.length === 0 ? (
                        <EmptyDataState message="No appeals have been filed." />
                    ) : (
                        <div className="divide-y divide-[var(--lb-color-border)]">
                            {appeals.map((appeal) => (
                                <div key={appeal.id} className="grid gap-[var(--lb-space-2)] py-[var(--lb-space-3)] md:grid-cols-[1fr_auto] md:items-center">
                                    <div className="min-w-0">
                                        <p className="m-0 truncate text-sm font-medium text-[var(--lb-color-text)]">Case {appeal.case_id}</p>
                                        <p className="m-0 mt-[var(--lb-space-1)] truncate text-xs text-[var(--lb-color-text-subdued)]">
                                            Due {formatDateTime(appeal.due_at)}
                                        </p>
                                    </div>
                                    <StatusPill value={appeal.status} />
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>
            </section>
        </ConsoleWorkspace>
    );
}

function CaseRow({ caseRow }: { caseRow: InternalTrustSafetyCase }) {
    const tone = caseRow.severity === 'critical' || caseRow.severity === 'high' ? 'critical' : caseRow.severity === 'medium' ? 'warning' : 'success';

    return (
        <div className="grid gap-[var(--lb-space-2)] py-[var(--lb-space-3)] md:grid-cols-[1fr_auto_auto] md:items-center">
            <div className="min-w-0">
                <p className="m-0 truncate text-sm font-medium text-[var(--lb-color-text)]">{caseRow.title}</p>
                <p className="m-0 mt-[var(--lb-space-1)] truncate text-xs text-[var(--lb-color-text-subdued)]">
                    {caseRow.subject_type}:{caseRow.subject_id} · {formatDateTime(caseRow.created_at)}
                </p>
            </div>
            <StatusPill value={caseRow.severity} tone={tone} />
            <StatusPill value={caseRow.status} />
        </div>
    );
}

function formatLabel(value: string): string {
    return value
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
