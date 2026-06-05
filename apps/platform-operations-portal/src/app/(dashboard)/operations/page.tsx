import type { MarketplaceReviewRecord } from '@letbuyy/shared-types';
import { revalidatePath } from 'next/cache';
import {
    EmptyDataState,
    MetricGrid,
    OpsMetric,
    OpsWorkspace,
    Panel,
    SkipBackendPanel,
    StatusPill,
} from '@/components/_local-ui/ops-workspace';
import { createPlatformOperationsApiClient } from '@/lib/api/client';

async function submitMarketplaceReviewDecision(formData: FormData) {
    'use server';

    const reviewId = String(formData.get('review_id') || '');
    const decision = String(formData.get('decision') || '');
    const reason = String(formData.get('reason') || '').trim();

    if (!reviewId || !['approved', 'rejected', 'changes_requested'].includes(decision)) {
        return;
    }

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.decideMarketplaceReview(reviewId, {
        decision: decision as 'approved' | 'rejected' | 'changes_requested',
        reason: reason || null,
    });

    revalidatePath('/operations');
}

function checkSummary(review: MarketplaceReviewRecord) {
    const automatedChecks = review.automated_checks || {};
    return {
        status: String(automatedChecks.status || 'pending'),
        failed: Number(automatedChecks.failed_count || 0),
        warnings: Number(automatedChecks.warning_count || 0),
    };
}

function formatSubmittedAt(value: string): string {
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export default async function OperationsPage() {
    let reviews: MarketplaceReviewRecord[] = [];
    let loadError: string | null = null;

    try {
        const api = await createPlatformOperationsApiClient({ requireSession: true });
        const response = await api.operations.marketplaceReviews({ status: 'pending', limit: 25 });
        reviews = response.review_records;
    } catch (error) {
        loadError = error instanceof Error ? error.message : 'Unable to load marketplace reviews';
    }

    const appReviews = reviews.filter((review) => review.submission_type === 'app').length;
    const themeReviews = reviews.filter((review) => review.submission_type === 'theme').length;
    const failedChecks = reviews.reduce((total, review) => total + checkSummary(review).failed, 0);
    const warnings = reviews.reduce((total, review) => total + checkSummary(review).warnings, 0);

    return (
        <OpsWorkspace
            eyebrow="Review queue"
            title="Marketplace Review Queue"
            description="Employee review surface for pending marketplace app and theme submissions using the existing operations API contract."
        >
            <MetricGrid>
                <OpsMetric label="Pending reviews" value={String(reviews.length)} detail="/v1/operations/marketplace-reviews" />
                <OpsMetric label="Apps" value={String(appReviews)} />
                <OpsMetric label="Themes" value={String(themeReviews)} />
                <OpsMetric label="Failed checks" value={String(failedChecks)} tone={failedChecks > 0 ? 'critical' : 'success'} />
                <OpsMetric label="Warnings" value={String(warnings)} tone={warnings > 0 ? 'warning' : 'success'} />
            </MetricGrid>

            {loadError ? (
                <Panel title="Review API unavailable" description={loadError}>
                    <EmptyDataState message="Marketplace review queue could not be loaded with the current employee session." />
                </Panel>
            ) : (
                <Panel
                    title="Pending Submissions"
                    description="Approve, reject, or request changes. Decisions call the existing audited operations endpoint."
                >
                    {reviews.length === 0 ? (
                        <EmptyDataState message="No pending marketplace reviews." />
                    ) : (
                        <div className="grid gap-[var(--lb-space-4)]">
                            {reviews.map((review) => {
                                const summary = checkSummary(review);

                                return (
                                    <article
                                        key={review.id}
                                        className="grid gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] xl:grid-cols-[1.2fr_0.7fr_1.3fr]"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                <StatusPill value={review.submission_type} />
                                                <h2 className="m-0 truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                    {review.resource_name}
                                                </h2>
                                            </div>
                                            <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                {review.resource_slug || review.resource_id} · {formatSubmittedAt(review.submitted_at)}
                                            </p>
                                            <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                Review ID: {review.id}
                                            </p>
                                        </div>

                                        <div className="grid content-start gap-[var(--lb-space-2)]">
                                            <StatusPill value={review.status.replace('_', ' ')} />
                                            <StatusPill value={summary.status} />
                                            <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                {summary.failed} failed · {summary.warnings} warnings
                                            </p>
                                        </div>

                                        <form action={submitMarketplaceReviewDecision} className="grid gap-[var(--lb-space-3)]">
                                            <input type="hidden" name="review_id" value={review.id} />
                                            <label className="grid gap-[var(--lb-space-2)]">
                                                <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                    Decision reason
                                                </span>
                                                <textarea
                                                    name="reason"
                                                    rows={3}
                                                    className="w-full rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none transition-colors placeholder:text-[var(--lb-color-text-subdued)] focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                                    placeholder="Reason"
                                                />
                                            </label>
                                            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                                <button
                                                    type="submit"
                                                    name="decision"
                                                    value="approved"
                                                    className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-success)] bg-[var(--lb-color-success)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm font-medium text-[var(--lb-color-text-inverse)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    type="submit"
                                                    name="decision"
                                                    value="changes_requested"
                                                    className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-warning)] bg-[var(--lb-color-warning-soft)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm font-medium text-[var(--lb-color-warning)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                                >
                                                    Changes
                                                </button>
                                                <button
                                                    type="submit"
                                                    name="decision"
                                                    value="rejected"
                                                    className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-critical)] bg-[var(--lb-color-critical-soft)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm font-medium text-[var(--lb-color-critical)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </form>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </Panel>
            )}

            <SkipBackendPanel title="Reviewer saved views and assignment routing" contract="/v1/operations/marketplace-reviews/assignments">
                The current contract supports list and decision. Queue ownership, saved reviewer views, SLA aging, and assignment routing need backend state before this can become a full review workstation.
            </SkipBackendPanel>
        </OpsWorkspace>
    );
}
