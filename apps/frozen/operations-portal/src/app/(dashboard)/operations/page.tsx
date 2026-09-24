import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import type { MarketplaceReviewRecord, ReviewCheckRun } from '@letbuyy/shared-types';
import { Button, Input } from '@letbuyy/ui';
import { formatIndiaDateTime as formatDateTime } from '@letbuyy/ui/formatting';
import {
    EmptyDataState,
    MetricGrid,
    OpsMetric,
    OpsWorkspace,
    Panel,
    StatusPill,
} from '@/components/_local-ui/ops-workspace';
import { createPlatformOperationsApiClient } from '@/lib/api/client';

type SearchParamValue = string | string[] | undefined;

interface OperationsPageProps {
    searchParams?: Promise<Record<string, SearchParamValue>>;
}

function paramValue(value: SearchParamValue): string {
    return Array.isArray(value) ? value[0] || '' : value || '';
}

function jsonRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function jsonArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
        ? value.map(jsonRecord).filter((item) => Object.keys(item).length > 0)
        : [];
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
        .slice(0, 6);
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

function displayTimestamp(value?: string | null): string {
    return value ? formatDateTime(value) : 'Not recorded';
}

async function claimMarketplaceReview(formData: FormData) {
    'use server';

    const reviewId = String(formData.get('review_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!reviewId || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.claimMarketplaceReview(reviewId, { reason });
    revalidatePath('/operations');
}

async function assignMarketplaceReview(formData: FormData) {
    'use server';

    const reviewId = String(formData.get('review_id') || '').trim();
    const assigneeId = String(formData.get('assignee_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!reviewId || !assigneeId || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.assignMarketplaceReview(reviewId, {
        assignee_id: assigneeId,
        reason,
    });
    revalidatePath('/operations');
}

async function runMarketplaceReviewChecks(formData: FormData) {
    'use server';

    const reviewId = String(formData.get('review_id') || '').trim();
    if (!reviewId) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.runMarketplaceReviewChecks(reviewId);
    revalidatePath('/operations');
}

async function commentMarketplaceReview(formData: FormData) {
    'use server';

    const reviewId = String(formData.get('review_id') || '').trim();
    const comment = String(formData.get('comment') || '').trim();
    if (!reviewId || comment.length < 3) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.commentMarketplaceReview(reviewId, {
        comment,
        visibility: String(formData.get('visibility') || 'internal') as 'internal' | 'developer',
    });
    revalidatePath('/operations');
}

async function submitMarketplaceReviewDecision(formData: FormData) {
    'use server';

    const reviewId = String(formData.get('review_id') || '').trim();
    const decision = String(formData.get('decision') || '');
    const reason = String(formData.get('reason') || '').trim();

    if (!reviewId || !['approved', 'rejected', 'changes_requested'].includes(decision) || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.decideMarketplaceReview(reviewId, {
        decision: decision as 'approved' | 'rejected' | 'changes_requested',
        reason,
    });

    revalidatePath('/operations');
}

function ReviewQueueList({ reviews, selectedId }: { reviews: MarketplaceReviewRecord[]; selectedId: string }) {
    if (reviews.length === 0) return <EmptyDataState message="No marketplace submissions are waiting for review." />;

    return (
        <div className="grid gap-[var(--lb-space-3)]">
            {reviews.map((review) => {
                const summary = checkSummary(review);
                const selected = review.id === selectedId;

                return (
                    <Link
                        key={review.id}
                        href={`/operations?review=${review.id}`}
                        className={`block rounded-[var(--lb-radius-lg)] border p-[var(--lb-space-3)] text-[var(--lb-color-text)] no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] ${selected ? 'border-[var(--lb-color-focus-ring)] bg-[var(--lb-color-surface)]' : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] hover:border-[var(--lb-color-border-strong)]'}`}
                    >
                        <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                            <StatusPill value={review.submission_type} />
                            <StatusPill value={review.status.replace('_', ' ')} />
                            <StatusPill value={summary.status.replace('_', ' ')} />
                        </div>
                        <h2 className="m-0 mt-[var(--lb-space-2)] truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]">
                            {review.resource_name}
                        </h2>
                        <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            {review.resource_slug || review.resource_id} · submitted {displayTimestamp(review.submitted_at)}
                        </p>
                        <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            {summary.failed} failed · {summary.warnings} warnings · {summary.hardFails} hard fails
                        </p>
                    </Link>
                );
            })}
        </div>
    );
}

function CheckRunsPanel({ checkRuns }: { checkRuns: ReviewCheckRun[] }) {
    if (checkRuns.length === 0) return <EmptyDataState message="Automated checks have not run for this submission." />;

    return (
        <div className="grid gap-[var(--lb-space-3)]">
            {checkRuns.map((run) => (
                <article
                    key={run.id}
                    className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]"
                >
                    <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                        <StatusPill value={String(run.check_type).replaceAll('_', ' ')} />
                        <StatusPill value={String(run.result)} />
                        {run.hard_fail ? <StatusPill value="hard fail" /> : null}
                    </div>
                    <h3 className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]">
                        {run.title}
                    </h3>
                    <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        {run.summary}
                    </p>
                    <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Completed {displayTimestamp(run.completed_at)}
                    </p>
                </article>
            ))}
        </div>
    );
}

function ResourcePanel({ resource, review }: { resource: Record<string, unknown>; review: MarketplaceReviewRecord }) {
    const latestVersion = jsonRecord(resource.latest_version);
    const appScopes = Array.isArray(resource.api_scopes) ? resource.api_scopes.map(String) : [];
    const redirects = Array.isArray(resource.oauth_redirect_uris) ? resource.oauth_redirect_uris.map(String) : [];
    const packageManifest = jsonRecord(resource.package_manifest);

    return (
        <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
            <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]">Submission</h3>
                <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    ID: {review.id}
                </p>
                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    Resource: {review.resource_id}
                </p>
                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    Submitted: {displayTimestamp(review.submitted_at)}
                </p>
            </div>
            {review.submission_type === 'app' ? (
                <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                    <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]">App Signals</h3>
                    <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Scopes: {appScopes.length > 0 ? appScopes.join(', ') : 'Not declared'}
                    </p>
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Redirects: {redirects.length > 0 ? redirects.join(', ') : 'Not declared'}
                    </p>
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Webhook: {typeof resource.webhook_url === 'string' && resource.webhook_url ? 'Declared' : 'Not declared'}
                    </p>
                </div>
            ) : (
                <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                    <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]">Theme Signals</h3>
                    <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Version: {String(latestVersion.version || 'Not recorded')}
                    </p>
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Renderer: {String(latestVersion.renderer_version || 'Not recorded')}
                    </p>
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Manifest keys: {Object.keys(packageManifest).slice(0, 8).join(', ') || 'Not attached'}
                    </p>
                </div>
            )}
        </div>
    );
}

function LifecycleReviewPanel({ review }: { review: MarketplaceReviewRecord }) {
    const lifecycleItems = lifecycleReviewItems(review);

    if (lifecycleItems.length === 0) {
        return <EmptyDataState message="No extension lifecycle checklist items are attached to this review." />;
    }

    return (
        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
            {lifecycleItems.map((item) => (
                <StatusPill key={item.key} value={item.label} />
            ))}
        </div>
    );
}

function ActionForms({ review }: { review: MarketplaceReviewRecord }) {
    const summary = checkSummary(review);
    const approvalBlocked = !summary.checkedAt || summary.hardFails > 0 || summary.status === 'failed';

    return (
        <div className="grid gap-[var(--lb-space-4)]">
            <div className="grid gap-[var(--lb-space-3)] lg:grid-cols-3">
                <form action={claimMarketplaceReview} className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                    <Input unstyled type="hidden" name="review_id" value={review.id} />
                    <label className="grid gap-[var(--lb-space-2)]">
                        <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Claim reason</span>
                        <Input unstyled name="reason" placeholder="Reason" className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-sm" />
                    </label>
                    <Button unstyled type="submit" className="mt-[var(--lb-space-3)] min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border-strong)] px-[var(--lb-space-3)] text-sm font-medium">
                        Claim
                    </Button>
                </form>
                <form action={assignMarketplaceReview} className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                    <Input unstyled type="hidden" name="review_id" value={review.id} />
                    <label className="grid gap-[var(--lb-space-2)]">
                        <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Assignee employee ID</span>
                        <Input unstyled name="assignee_id" placeholder="Employee UUID" className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-sm" />
                    </label>
                    <label className="mt-[var(--lb-space-2)] grid gap-[var(--lb-space-2)]">
                        <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Assignment reason</span>
                        <Input unstyled name="reason" placeholder="Reason" className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-sm" />
                    </label>
                    <Button unstyled type="submit" className="mt-[var(--lb-space-3)] min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border-strong)] px-[var(--lb-space-3)] text-sm font-medium">
                        Assign
                    </Button>
                </form>
                <form action={runMarketplaceReviewChecks} className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                    <Input unstyled type="hidden" name="review_id" value={review.id} />
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Runs deterministic app/theme checks and records the evidence for reviewer decisions.
                    </p>
                    <Button unstyled type="submit" className="mt-[var(--lb-space-3)] min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border-strong)] px-[var(--lb-space-3)] text-sm font-medium">
                        Run checks
                    </Button>
                </form>
            </div>

            <form action={commentMarketplaceReview} className="grid gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                <Input unstyled type="hidden" name="review_id" value={review.id} />
                <label className="grid gap-[var(--lb-space-2)]">
                    <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Reviewer comment</span>
                    <textarea name="comment" rows={3} className="w-full rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]" placeholder="Comment" />
                </label>
                <select name="visibility" className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-sm text-[var(--lb-color-text)]">
                    <option value="internal">Internal note</option>
                    <option value="developer">Developer-visible</option>
                </select>
                <Button unstyled type="submit" className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border-strong)] px-[var(--lb-space-3)] text-sm font-medium">
                    Add comment
                </Button>
            </form>

            <form action={submitMarketplaceReviewDecision} className="grid gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                <Input unstyled type="hidden" name="review_id" value={review.id} />
                <label className="grid gap-[var(--lb-space-2)]">
                    <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Decision reason</span>
                    <textarea name="reason" rows={3} className="w-full rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]" placeholder="Reason" />
                </label>
                {approvalBlocked ? (
                    <p className="m-0 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-warning)] bg-[var(--lb-color-warning-soft)] p-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-warning)]">
                        Approval is blocked until checks have run and hard failures are cleared.
                    </p>
                ) : null}
                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                    <Button unstyled type="submit" name="decision" value="approved" disabled={approvalBlocked} className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-success)] bg-[var(--lb-color-success)] px-[var(--lb-space-3)] text-sm font-medium text-[var(--lb-color-text-inverse)] disabled:cursor-not-allowed disabled:opacity-50">
                        Approve
                    </Button>
                    <Button unstyled type="submit" name="decision" value="changes_requested" className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-warning)] bg-[var(--lb-color-warning-soft)] px-[var(--lb-space-3)] text-sm font-medium text-[var(--lb-color-warning)]">
                        Request changes
                    </Button>
                    <Button unstyled type="submit" name="decision" value="rejected" className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-critical)] bg-[var(--lb-color-critical-soft)] px-[var(--lb-space-3)] text-sm font-medium text-[var(--lb-color-critical)]">
                        Reject
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default async function OperationsPage({ searchParams }: OperationsPageProps) {
    const params = searchParams ? await searchParams : {};
    const selectedParam = paramValue(params.review);
    let reviews: MarketplaceReviewRecord[] = [];
    let selectedReview: MarketplaceReviewRecord | null = null;
    let checkRuns: ReviewCheckRun[] = [];
    let resource: Record<string, unknown> = {};
    let loadError: string | null = null;

    try {
        const api = await createPlatformOperationsApiClient({ requireSession: true });
        const response = await api.operations.marketplaceReviews({ limit: 50 });
        reviews = response.review_records;
        const selectedId = selectedParam || reviews[0]?.id || '';
        if (selectedId) {
            const detail = await api.operations.marketplaceReview(selectedId);
            selectedReview = detail.review_record;
            checkRuns = detail.check_runs || [];
            resource = jsonRecord(detail.resource);
        }
    } catch (error) {
        loadError = error instanceof Error ? error.message : 'Unable to load marketplace reviews';
    }

    const selectedId = selectedReview?.id || selectedParam || '';
    const appReviews = reviews.filter((review) => review.submission_type === 'app').length;
    const themeReviews = reviews.filter((review) => review.submission_type === 'theme').length;
    const failedChecks = reviews.reduce((total, review) => total + checkSummary(review).failed, 0);
    const hardFails = reviews.reduce((total, review) => total + checkSummary(review).hardFails, 0);
    const comments = jsonArray(jsonRecord(selectedReview?.metadata).comments);
    const assignment = jsonRecord(jsonRecord(selectedReview?.metadata).assignment);

    return (
        <OpsWorkspace
            eyebrow="Review queue"
            title="Marketplace Review Queue"
            description="Employee app and theme reviewer console with deterministic checks, claim/assignment state, evidence, comments, and audited decisions."
        >
            <MetricGrid>
                <OpsMetric label="Open reviews" value={String(reviews.length)} detail="App and theme submissions" />
                <OpsMetric label="Apps" value={String(appReviews)} />
                <OpsMetric label="Themes" value={String(themeReviews)} />
                <OpsMetric label="Failed checks" value={String(failedChecks)} tone={failedChecks > 0 ? 'critical' : 'success'} />
                <OpsMetric label="Hard fails" value={String(hardFails)} tone={hardFails > 0 ? 'critical' : 'success'} />
            </MetricGrid>

            {loadError ? (
                <Panel title="Review API unavailable" description={loadError}>
                    <EmptyDataState message="Marketplace review queue could not be loaded with the current employee session." />
                </Panel>
            ) : (
                <div className="grid gap-[var(--lb-space-4)] xl:grid-cols-[0.85fr_1.35fr]">
                    <Panel title="Submissions" description="Filter, claim, run checks, and decide app/theme submissions.">
                        <ReviewQueueList reviews={reviews} selectedId={selectedId} />
                    </Panel>

                    {selectedReview ? (
                        <div className="grid gap-[var(--lb-space-4)]">
                            <Panel
                                title={selectedReview.resource_name}
                                description={`${selectedReview.submission_type.toUpperCase()} review · ${selectedReview.status.replace('_', ' ')}`}
                            >
                                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                    <StatusPill value={selectedReview.submission_type} />
                                    <StatusPill value={selectedReview.status.replace('_', ' ')} />
                                    <StatusPill value={checkSummary(selectedReview).status.replace('_', ' ')} />
                                    {assignment.assignee_id ? <StatusPill value={`assigned ${String(assignment.assignee_id).slice(0, 8)}`} /> : null}
                                </div>
                                <div className="mt-[var(--lb-space-4)]">
                                    <ResourcePanel resource={resource} review={selectedReview} />
                                </div>
                            </Panel>

                            <Panel title="Automated Checks" description="App security checks and theme QA evidence for the selected submission.">
                                <CheckRunsPanel checkRuns={checkRuns} />
                            </Panel>

                            <Panel title="Extension lifecycle" description="Developer handoff checklist carried from extension_lifecycle_review evidence.">
                                <LifecycleReviewPanel review={selectedReview} />
                            </Panel>

                            <Panel title="Reviewer Actions" description="Actions require the employee review scope and are audited by the gateway.">
                                <ActionForms review={selectedReview} />
                            </Panel>

                            <Panel title="Decision History" description="Reviewer notes and developer-visible comments attached to the review record.">
                                {comments.length === 0 ? (
                                    <EmptyDataState message="No reviewer comments yet." />
                                ) : (
                                    <div className="grid gap-[var(--lb-space-3)]">
                                        {comments.map((comment) => (
                                            <article key={String(comment.id)} className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                                                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                                    <StatusPill value={String(comment.visibility || 'internal')} />
                                                    <StatusPill value={displayTimestamp(typeof comment.created_at === 'string' ? comment.created_at : null)} />
                                                </div>
                                                <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text)]">
                                                    {String(comment.body || '')}
                                                </p>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </Panel>
                        </div>
                    ) : (
                        <Panel title="Review detail" description="Select a submission from the queue.">
                            <EmptyDataState message="No marketplace review is selected." />
                        </Panel>
                    )}
                </div>
            )}
        </OpsWorkspace>
    );
}
