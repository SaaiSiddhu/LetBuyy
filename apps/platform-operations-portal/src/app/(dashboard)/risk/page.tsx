import type { InternalRiskScore } from '@letbuyy/api-client';
import type { RiskDecision } from '@letbuyy/shared-types';
import { Button, Input } from '@letbuyy/ui';
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

async function decideRiskScore(formData: FormData) {
    'use server';

    const scoreId = String(formData.get('score_id') || '');
    const decision = String(formData.get('decision') || '') as RiskDecision;
    const reason = String(formData.get('reason') || '').trim();

    if (!scoreId || !['confirm', 'dismiss', 'manual_block'].includes(decision) || reason.length < 8) {
        return;
    }

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.decideRiskScore(scoreId, {
        decision,
        reason,
    });

    revalidatePath('/risk');
}

export default async function RiskDecisionPage() {
    let scores: InternalRiskScore[] = [];
    let loadError: string | null = null;

    try {
        const api = await createPlatformOperationsApiClient({ requireSession: true });
        const response = await api.operations.riskReviewQueue({ limit: 25 });
        scores = response.data;
    } catch (error) {
        loadError = error instanceof Error ? error.message : 'Unable to load risk review queue';
    }

    const high = scores.filter((score) => score.band === 'high').length;
    const medium = scores.filter((score) => score.band === 'medium').length;
    const restricted = scores.filter((score) => score.status === 'restricted').length;

    return (
        <OpsWorkspace
            eyebrow="Risk Decisions"
            title="Risk Review Queue"
            description="Employee decision queue for medium and high risk entities with reason-captured outcomes."
        >
            <MetricGrid>
                <OpsMetric label="Open reviews" value={String(scores.length)} detail="/v1/operations/risk/review-queue" />
                <OpsMetric label="High risk" value={String(high)} tone={high > 0 ? 'critical' : 'success'} />
                <OpsMetric label="Medium risk" value={String(medium)} tone={medium > 0 ? 'warning' : 'success'} />
                <OpsMetric label="Restricted" value={String(restricted)} tone={restricted > 0 ? 'critical' : 'success'} />
            </MetricGrid>

            {loadError ? (
                <Panel title="Risk API unavailable" description={loadError}>
                    <EmptyDataState message="Risk review queue could not be loaded with the current employee session." />
                </Panel>
            ) : (
                <Panel title="Open Risk Reviews" description="Confirm, dismiss, or manually block with a recorded operator reason.">
                    {scores.length === 0 ? (
                        <EmptyDataState message="No medium or high risk entities are waiting for review." />
                    ) : (
                        <div className="grid gap-[var(--lb-space-4)]">
                            {scores.map((score) => <RiskDecisionCard key={score.id} score={score} />)}
                        </div>
                    )}
                </Panel>
            )}
        </OpsWorkspace>
    );
}

function RiskDecisionCard({ score }: { score: InternalRiskScore }) {
    const signalCount = Array.isArray(score.breakdown?.signals) ? score.breakdown.signals.length : 0;

    return (
        <article className="grid gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] xl:grid-cols-[1fr_0.6fr_1.2fr]">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                    <StatusPill value={score.band} />
                    <h2 className="m-0 truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                        {score.entity_type}:{score.entity_id}
                    </h2>
                </div>
                <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    Score {score.score}/100 · {signalCount} signal{signalCount === 1 ? '' : 's'}
                </p>
                {score.site_id ? (
                    <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Site {score.site_id}
                    </p>
                ) : null}
            </div>

            <div className="grid content-start gap-[var(--lb-space-2)]">
                <StatusPill value={score.status} />
                <span className="text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    Scored {formatDateTime(score.scored_at)}
                </span>
            </div>

            <form action={decideRiskScore} className="grid gap-[var(--lb-space-3)]">
                <Input unstyled type="hidden" name="score_id" value={score.id} />
                <label className="grid gap-[var(--lb-space-2)]">
                    <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Decision reason
                    </span>
                    <textarea
                        name="reason"
                        rows={3}
                        required
                        minLength={8}
                        className="w-full rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none transition-colors placeholder:text-[var(--lb-color-text-subdued)] focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                        placeholder="Reason"
                    />
                </label>
                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                    <Button
                        unstyled
                        type="submit"
                        name="decision"
                        value="confirm"
                        className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-warning)] bg-[var(--lb-color-warning-soft)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm font-medium text-[var(--lb-color-warning)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                    >
                        Confirm
                    </Button>
                    <Button
                        unstyled
                        type="submit"
                        name="decision"
                        value="dismiss"
                        className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-success)] bg-[var(--lb-color-success)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm font-medium text-[var(--lb-color-text-inverse)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                    >
                        Dismiss
                    </Button>
                    <Button
                        unstyled
                        type="submit"
                        name="decision"
                        value="manual_block"
                        className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-critical)] bg-[var(--lb-color-critical-soft)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm font-medium text-[var(--lb-color-critical)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                    >
                        Block
                    </Button>
                </div>
            </form>
        </article>
    );
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not recorded';

    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
