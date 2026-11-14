import type { InternalRiskOverview, InternalRiskScore } from '@letbuyy/api-client';
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

export default async function RiskPage() {
    const result = await fetchConsoleApi<ConsoleDataResponse<InternalRiskOverview>>('/operations/risk/overview');
    const overview = result.data?.data;
    const counts = overview?.counts;
    const recentScores = overview?.recent_scores || [];
    const recentActions = overview?.recent_actions || [];
    const topSignals = overview?.top_signals || [];

    return (
        <ConsoleWorkspace
            eyebrow="Risk Detection"
            title="Risk Detection"
            description="Deterministic merchant and marketplace risk scoring with explainable signals, score bands, and action evidence."
        >
            {result.error ? <ConsoleApiErrorPanel title="Risk API unavailable" message={result.error} /> : null}

            <MetricGrid>
                <LeadershipMetric label="High today" value={(counts?.high_today === undefined ? 'Unavailable' : String(counts?.high_today))} tone={counts?.high_today === undefined ? 'warning' : counts?.high_today > 0 ? 'critical' : 'success'} />
                <LeadershipMetric label="High sampled" value={(counts?.by_band?.high === undefined ? 'Unavailable' : String(counts?.by_band?.high))} tone={counts?.by_band?.high === undefined ? 'warning' : counts?.by_band?.high > 0 ? 'critical' : 'success'} />
                <LeadershipMetric label="Medium sampled" value={(counts?.by_band?.medium === undefined ? 'Unavailable' : String(counts?.by_band?.medium))} tone={counts?.by_band?.medium === undefined ? 'warning' : counts?.by_band?.medium > 0 ? 'warning' : 'success'} />
                <LeadershipMetric label="Restricted" value={(counts?.restricted === undefined ? 'Unavailable' : String(counts?.restricted))} tone={counts?.restricted === undefined ? 'warning' : counts?.restricted > 0 ? 'critical' : 'success'} />
            </MetricGrid>

            <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-[1.2fr_0.8fr]">
                <Panel title="Recent Scores" description="Latest scored entities from the risk engine.">
                    {recentScores.length === 0 ? (
                        <EmptyDataState message="No risk scores have been recorded yet." />
                    ) : (
                        <div className="divide-y divide-[var(--lb-color-border)]">
                            {recentScores.map((score) => <RiskScoreRow key={score.id} score={score} />)}
                        </div>
                    )}
                </Panel>

                <Panel title="Top Signals" description="Most frequent signal types in the latest sample.">
                    {topSignals.length === 0 ? (
                        <EmptyDataState message="No risk signals have been recorded yet." />
                    ) : (
                        <div className="grid gap-[var(--lb-space-3)]">
                            {topSignals.map((signal) => (
                                <div key={signal.signal_type} className="flex items-center justify-between gap-[var(--lb-space-3)]">
                                    <span className="truncate text-sm font-medium text-[var(--lb-color-text)]">{formatLabel(signal.signal_type)}</span>
                                    <span className="text-sm text-[var(--lb-color-text-subdued)]">{signal.count.toLocaleString('en-IN')}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>
            </section>

            <Panel title="Action Evidence" description="Recent risk actions and downstream Trust & Safety intake requests.">
                {recentActions.length === 0 ? (
                    <EmptyDataState message="No risk action events have been recorded yet." />
                ) : (
                    <div className="divide-y divide-[var(--lb-color-border)]">
                        {recentActions.map((action) => (
                            <div key={action.id} className="grid gap-[var(--lb-space-2)] py-[var(--lb-space-3)] md:grid-cols-[0.8fr_1fr_auto] md:items-center">
                                <div className="min-w-0">
                                    <p className="m-0 truncate text-sm font-medium text-[var(--lb-color-text)]">{formatLabel(action.action_type)}</p>
                                    <p className="m-0 mt-[var(--lb-space-1)] truncate text-xs text-[var(--lb-color-text-subdued)]">
                                        {action.entity_type}:{action.entity_id}
                                    </p>
                                </div>
                                <p className="m-0 text-sm text-[var(--lb-color-text-subdued)]">{action.reason}</p>
                                <div className="flex items-center justify-between gap-[var(--lb-space-3)] md:justify-end">
                                    <StatusPill value={action.action_status} />
                                    <span className="text-xs text-[var(--lb-color-text-subdued)]">{formatDateTime(action.created_at)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Panel>
        </ConsoleWorkspace>
    );
}

function RiskScoreRow({ score }: { score: InternalRiskScore }) {
    return (
        <div className="grid gap-[var(--lb-space-2)] py-[var(--lb-space-3)] md:grid-cols-[1fr_auto_auto] md:items-center">
            <div className="min-w-0">
                <p className="m-0 truncate text-sm font-medium text-[var(--lb-color-text)]">
                    {score.entity_type}:{score.entity_id}
                </p>
                <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">
                    Scored {formatDateTime(score.scored_at)}
                </p>
            </div>
            <StatusPill value={score.band} tone={score.band === 'high' ? 'critical' : score.band === 'medium' ? 'warning' : 'success'} />
            <span className="text-sm font-semibold text-[var(--lb-color-text)]">{score.score}/100</span>
        </div>
    );
}

function formatLabel(value: string): string {
    return value
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
