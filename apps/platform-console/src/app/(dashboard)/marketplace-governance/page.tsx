import { notFound } from 'next/navigation';
import type { MarketplaceReviewListResult, MarketplaceReviewRecord } from '@letbuyy/api-client';
import {
    ConsoleWorkspace,
    EmptyDataState,
    LeadershipMetric,
    MetricGrid,
    Panel,
    StatusPill,
} from '@/components/_local-ui/console-workspace';
import { fetchConsoleApi, formatDateTime } from '@/lib/console-api';
import { isAppPlatformEnabled } from '@/lib/app-platform-flag';

function jsonRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function checkSummary(review: MarketplaceReviewRecord) {
    const automatedChecks = jsonRecord(review.automated_checks);
    return {
        status: String(automatedChecks.status || 'not_run'),
        failed: Number(automatedChecks.failed_count || 0),
        warnings: Number(automatedChecks.warning_count || 0),
        hardFails: Number(automatedChecks.hard_fail_count || 0),
        checkedAt: typeof automatedChecks.checked_at === 'string' ? automatedChecks.checked_at : null,
    };
}

function toneForStatus(value: string): 'success' | 'warning' | 'critical' | 'info' {
    if (value === 'passed') return 'success';
    if (value === 'failed') return 'critical';
    if (value === 'warning' || value === 'not_run') return 'warning';
    return 'info';
}

export default async function MarketplaceGovernancePage() {
    // ART-22 / ART-16 fail-closed gate. Must be the FIRST statement: the gateway now 404s
    // /v1/operations/marketplace-reviews, so this page must neither render nor fetch.
    if (!isAppPlatformEnabled()) notFound();

    const response = await fetchConsoleApi<MarketplaceReviewListResult>('/operations/marketplace-reviews', { limit: 50 });
    const reviews = response.data?.review_records || [];
    const appReviews = reviews.filter((review) => review.submission_type === 'app').length;
    const themeReviews = reviews.filter((review) => review.submission_type === 'theme').length;
    const pending = reviews.filter((review) => review.status === 'pending' || review.status === 'in_review').length;
    const hardFails = reviews.reduce((total, review) => total + checkSummary(review).hardFails, 0);

    return (
        <ConsoleWorkspace
            eyebrow="Marketplace governance"
            title="Marketplace Governance"
            description="Leadership oversight for app and theme review readiness, automated check health, partner risk, and policy enforcement."
        >
            <MetricGrid>
                <LeadershipMetric label="Open reviews" value={String(pending)} detail="Pending or in review" tone={pending > 0 ? 'warning' : 'success'} />
                <LeadershipMetric label="App submissions" value={String(appReviews)} />
                <LeadershipMetric label="Theme submissions" value={String(themeReviews)} />
                <LeadershipMetric label="Hard check failures" value={String(hardFails)} detail="Blocks approval" tone={hardFails > 0 ? 'critical' : 'success'} />
            </MetricGrid>

            {response.error ? (
                <Panel title="Governance data unavailable" description={response.error}>
                    <EmptyDataState message="Marketplace governance data could not be loaded for the current console session." />
                </Panel>
            ) : (
                <Panel title="Review Health" description="Read-only governance view over current app and theme submissions. Reviewer decisions stay in the employee operations portal.">
                    {reviews.length === 0 ? (
                        <EmptyDataState message="No app or theme submissions are currently in the review queue." />
                    ) : (
                        <div className="grid gap-[var(--lb-space-3)]">
                            {reviews.map((review) => {
                                const summary = checkSummary(review);

                                return (
                                    <article
                                        key={review.id}
                                        className="grid gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] lg:grid-cols-[1fr_auto]"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                <StatusPill value={review.submission_type} />
                                                <StatusPill value={review.status.replace('_', ' ')} />
                                                <StatusPill value={summary.status.replace('_', ' ')} tone={toneForStatus(summary.status)} />
                                                {summary.hardFails > 0 ? <StatusPill value="hard fail" tone="critical" /> : null}
                                            </div>
                                            <h2 className="m-0 mt-[var(--lb-space-2)] truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                {review.resource_name}
                                            </h2>
                                            <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                Submitted {formatDateTime(review.submitted_at)}
                                            </p>
                                        </div>
                                        <div className="grid gap-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)] lg:text-right">
                                            <span>{summary.failed} failed</span>
                                            <span>{summary.warnings} warnings</span>
                                            <span>Last check {summary.checkedAt ? formatDateTime(summary.checkedAt) : 'not run'}</span>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </Panel>
            )}
        </ConsoleWorkspace>
    );
}
