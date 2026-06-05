import type { MarketplaceReviewRecord } from '@letbuyy/shared-types';
import { revalidatePath } from 'next/cache';
import { createPlatformOperationsApiClient } from '../../../lib/api/client';

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

function jsonRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function lifecycleReviewItems(review: MarketplaceReviewRecord): Array<{ key: string; label: string }> {
    const automatedChecks = jsonRecord(review.automated_checks);
    const metadata = jsonRecord(automatedChecks.metadata);
    const rawItems = Array.isArray(metadata.extension_lifecycle_review) ? metadata.extension_lifecycle_review : [];

    return rawItems
        .map((item) => jsonRecord(item))
        .map((item) => ({
            key: String(item.key || item.label || 'extension-lifecycle'),
            label: String(item.label || item.key || 'Extension lifecycle'),
        }))
        .slice(0, 3);
}

function formatSubmittedAt(value: string): string {
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function badgeClass(status: string): string {
    if (status === 'passed') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300';
    if (status === 'failed') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300';
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300';
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

    return (
        <div className="p-8">
            <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Operations</h1>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Marketplace review queue and platform controls</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">{reviews.length}</span>
                    <span className="ml-2 text-zinc-600 dark:text-zinc-400">pending reviews</span>
                </div>
            </div>

            {loadError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
                    {loadError}
                </div>
            ) : null}

            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_1.4fr] gap-4 border-b border-zinc-200 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <div>Submission</div>
                    <div>Status</div>
                    <div>Checks</div>
                    <div>Decision</div>
                </div>

                {reviews.length === 0 ? (
                    <div className="px-5 py-8 text-sm text-zinc-600 dark:text-zinc-400">No pending marketplace reviews.</div>
                ) : reviews.map((review) => {
                    const summary = checkSummary(review);
                    const lifecycleItems = lifecycleReviewItems(review);

                    return (
                        <div
                            key={review.id}
                            className="grid grid-cols-[1.1fr_0.8fr_0.8fr_1.4fr] gap-4 border-b border-zinc-100 px-5 py-4 last:border-b-0 dark:border-zinc-800"
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                        {review.submission_type}
                                    </span>
                                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">{review.resource_name}</span>
                                </div>
                                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    {review.resource_slug || review.resource_id} · {formatSubmittedAt(review.submitted_at)}
                                </div>
                                {lifecycleItems.length > 0 ? (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {lifecycleItems.map((item) => (
                                            <span
                                                key={item.key}
                                                className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-300"
                                            >
                                                {item.label}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>

                            <div>
                                <span className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                                    {review.status.replace('_', ' ')}
                                </span>
                            </div>

                            <div>
                                <span className={`rounded-md border px-2 py-1 text-xs font-medium ${badgeClass(summary.status)}`}>
                                    {summary.status}
                                </span>
                                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    {summary.failed} failed · {summary.warnings} warnings
                                </div>
                            </div>

                            <form action={submitMarketplaceReviewDecision} className="space-y-3">
                                <input type="hidden" name="review_id" value={review.id} />
                                <textarea
                                    name="reason"
                                    rows={2}
                                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                                    placeholder="Reason"
                                />
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="submit"
                                        name="decision"
                                        value="approved"
                                        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        type="submit"
                                        name="decision"
                                        value="changes_requested"
                                        className="rounded-md border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
                                    >
                                        Changes
                                    </button>
                                    <button
                                        type="submit"
                                        name="decision"
                                        value="rejected"
                                        className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </form>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
