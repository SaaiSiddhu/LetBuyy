import Link from 'next/link';
import { Button, Input, Textarea } from '@letbuyy/ui';
import { ConsoleWorkspace, EmptyDataState, Panel, StatusPill } from '@/components/_local-ui/console-workspace';
import { fetchConsoleApi, formatDateTime } from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';
import { MAX_DECISION_REASON, MIN_DECISION_REASON, newListingAssignmentKey, newListingClaimKey, newListingDecisionKey } from '@/lib/listing-decision';
import { buildMarketplaceRevisionDiff, getSafeMarketplaceEvidenceLinks } from '@/lib/marketplace-revision-diff';
import { approveListing, assignListingReviewer, claimListingReview, rejectListing, takeDownListing } from '../actions';

type JsonObject = Record<string, unknown>;
type Listing = {
    id: string;
    site_id: string;
    product_id: string;
    channel: string;
    status: string;
    version: number;
    assigned_reviewer_id: string | null;
    reviewer_assigned_at: string | null;
    assigned_reviewer?: { full_name: string | null } | null;
    submitted_at: string | null;
    rejection_reason: string | null;
    submitted_product_snapshot: JsonObject | null;
    approved_product_snapshot: JsonObject | null;
    products?: { name?: string | null; slug?: string | null } | null;
    sites?: { store_name?: string | null; subdomain?: string | null } | null;
};
type Event = {
    id: string;
    from_status: string | null;
    to_status: string;
    actor_realm: string;
    reason: string | null;
    event_type: string;
    assigned_reviewer_id: string | null;
    previous_assigned_reviewer_id: string | null;
    created_at: string;
};
type DetailResponse = { data?: { listing: Listing; events: Event[] } };
type Reviewer = { user_id: string; full_name: string | null };
type ReviewerListResponse = { data?: Reviewer[] };

function DecisionForm({ listingId, decision, action, label, reasonRequired = false }: {
    listingId: string;
    decision: 'approve' | 'reject' | 'take-down';
    action: (formData: FormData) => Promise<void>;
    label: string;
    reasonRequired?: boolean;
}) {
    const id = `${decision}-reason`;
    return (
        <form action={action} className="space-y-3">
            <Input type="hidden" name="listing_id" value={listingId} />
            <Input type="hidden" name="idempotency_key" value={newListingDecisionKey(decision, listingId)} />
            {reasonRequired && <>
                <label htmlFor={id} className="block text-sm font-medium">Reason for the merchant</label>
                <Textarea id={id} name="reason" minLength={MIN_DECISION_REASON} maxLength={MAX_DECISION_REASON} required />
            </>}
            <Button type="submit" variant={decision === 'approve' ? 'primary' : 'secondary'}>{label}</Button>
        </form>
    );
}

export default async function MarketplaceListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const consoleSession = await requireConsoleSession();
    const { id } = await params;
    const response = await fetchConsoleApi<DetailResponse>(`/operations/marketplace-listings/${id}`);
    const detail = response.data?.data;
    const listing = detail?.listing;
    const reviewersResponse = listing?.status === 'pending_review'
        ? await fetchConsoleApi<ReviewerListResponse>('/operations/marketplace-listings/reviewers')
        : null;
    const eligibleReviewers = reviewersResponse?.data?.data?.filter((reviewer) =>
        reviewer.user_id !== listing?.assigned_reviewer_id && reviewer.user_id !== consoleSession.userId,
    ) ?? [];
    const diff = buildMarketplaceRevisionDiff(listing?.approved_product_snapshot ?? null, listing?.submitted_product_snapshot ?? null);
    const evidence = getSafeMarketplaceEvidenceLinks(listing?.submitted_product_snapshot ?? null);

    return (
        <ConsoleWorkspace eyebrow="Marketplace" title="Review listing" description="Compare the submitted product revision with its last approved revision before recording a decision.">
            <p><Link href="/marketplace-listings" className="text-[var(--lb-color-primary)] underline-offset-4 hover:underline">← Back to review queue</Link></p>
            {response.error || !listing ? (
                <Panel title="Listing details unavailable" description={response.error || 'This listing could not be found.'}>
                    <EmptyDataState message="The operations API did not return review details." />
                </Panel>
            ) : <>
                <Panel title={listing.products?.name || 'Untitled product'} description={`${listing.sites?.store_name || 'Unknown store'}${listing.sites?.subdomain ? ` (${listing.sites.subdomain})` : ''} · submitted ${formatDateTime(listing.submitted_at)}`}>
                    <StatusPill value={listing.status} />
                    <p>Product ID: {listing.product_id}</p>
                    {listing.rejection_reason && <p>Previous review reason: {listing.rejection_reason}</p>}
                </Panel>

                <Panel title="Revision comparison" description="Differences are computed from the submitted snapshot and the last approved snapshot. A first submission has no previous approved revision.">
                    {!listing.submitted_product_snapshot ? <EmptyDataState message="No submitted revision snapshot is available. Ask the merchant to resubmit before approving." />
                        : diff.length === 0 ? <p>No material differences from the last approved revision.</p>
                            : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Field</th><th>Previously approved</th><th>Submitted now</th></tr></thead><tbody>{diff.map((item) => <tr key={item.path}><th className="pr-4 align-top">{item.path}</th><td className="whitespace-pre-wrap pr-4 align-top">{item.before}</td><td className="whitespace-pre-wrap align-top">{item.after}</td></tr>)}</tbody></table></div>}
                </Panel>

                <Panel title="Submitted product evidence" description="Evidence references are shown as merchant-provided URLs. Open each item to inspect the source; the console does not fetch external URLs on the reviewer’s behalf.">
                    {evidence.length === 0 ? <EmptyDataState message="No safe HTTP(S) image references are attached to this submitted revision." />
                        : <ul>{evidence.map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer noopener" className="break-all text-[var(--lb-color-primary)] underline">{url}</a></li>)}</ul>}
                </Panel>

                <Panel title="Moderation history" description="Append-only listing transitions, newest first.">
                    {!detail.events.length ? <EmptyDataState message="No moderation events were returned." /> : <ol>{detail.events.map((event) => <li key={event.id} className="border-b py-3"><strong>{event.event_type === 'reviewer_assignment' ? `${event.previous_assigned_reviewer_id ? `Reassigned from ${event.previous_assigned_reviewer_id} to ` : 'Assigned to '}${event.assigned_reviewer_id || 'unknown reviewer'}` : `${event.from_status || 'created'} → ${event.to_status}`}</strong><span> · {event.actor_realm} · {formatDateTime(event.created_at)}</span>{event.reason && <p>{event.reason}</p>}</li>)}</ol>}
                </Panel>

                {listing.status === 'pending_review' && !listing.assigned_reviewer_id && consoleSession.userId && <Panel title="Claim review" description="Claiming reserves this pending listing for your review and adds an assignment event to its audit history.">
                    <form action={claimListingReview} className="space-y-3">
                        <Input type="hidden" name="listing_id" value={listing.id} />
                        <Input type="hidden" name="expected_version" value={listing.version} />
                        <Input type="hidden" name="idempotency_key" value={newListingClaimKey(listing.id)} />
                        <label htmlFor="claim-reason" className="block text-sm font-medium">Claim reason</label>
                        <Textarea id="claim-reason" name="reason" minLength={MIN_DECISION_REASON} maxLength={MAX_DECISION_REASON} required />
                        <Button type="submit" variant="secondary">Claim for review</Button>
                    </form>
                </Panel>}
                {listing.assigned_reviewer_id && <Panel title="Reviewer assignment" description={`Assigned to ${listing.assigned_reviewer?.full_name || 'an assigned reviewer'}${listing.reviewer_assigned_at ? ` · ${formatDateTime(listing.reviewer_assigned_at)}` : ''}`}><EmptyDataState message="Assignment changes are recorded in moderation history." /></Panel>}
                {listing.status === 'pending_review' && consoleSession.userId && !reviewersResponse?.error && <Panel title={listing.assigned_reviewer_id ? 'Reassign reviewer' : 'Assign reviewer'} description="An active platform lead or admin can change assignment. The database checks the displayed listing version and records the change atomically.">
                    {eligibleReviewers.length === 0 ? <EmptyDataState message="No other active platform reviewers are available to assign this review." /> : <form action={assignListingReviewer} className="space-y-3">
                        <Input type="hidden" name="listing_id" value={listing.id} />
                        <Input type="hidden" name="expected_version" value={listing.version} />
                        <Input type="hidden" name="idempotency_key" value={newListingAssignmentKey(listing.id)} />
                        <label htmlFor="assignee-user-id" className="block text-sm font-medium">Active platform reviewer</label>
                        <select id="assignee-user-id" name="assignee_user_id" required className="w-full rounded-md border bg-background p-2">
                            <option value="">Choose a reviewer</option>
                            {eligibleReviewers.map((reviewer) => <option key={reviewer.user_id} value={reviewer.user_id}>{reviewer.full_name || reviewer.user_id}</option>)}
                        </select>
                        <label htmlFor="assignment-reason" className="block text-sm font-medium">Assignment reason</label>
                        <Textarea id="assignment-reason" name="reason" minLength={MIN_DECISION_REASON} maxLength={MAX_DECISION_REASON} required />
                        <Button type="submit" variant="secondary">{listing.assigned_reviewer_id ? 'Reassign review' : 'Assign review'}</Button>
                    </form>}
                </Panel>}

                {listing.status === 'pending_review' && listing.submitted_product_snapshot && listing.assigned_reviewer_id === consoleSession.userId && <Panel title="Record review decision" description="Only the assigned reviewer can decide. Rejection and take-down reasons are recorded for the merchant; every action requires an MFA-verified console session.">
                    <div className="grid gap-6 md:grid-cols-3">
                        <DecisionForm listingId={listing.id} decision="approve" action={approveListing} label="Approve listing" />
                        <DecisionForm listingId={listing.id} decision="reject" action={rejectListing} label="Reject listing" reasonRequired />
                        <DecisionForm listingId={listing.id} decision="take-down" action={takeDownListing} label="Take down" reasonRequired />
                    </div>
                </Panel>}
                {listing.status === 'pending_review' && !listing.submitted_product_snapshot && <Panel title="Decision unavailable" description="This listing has no saved submitted revision. Resubmission is required before an operator can decide."><EmptyDataState message="No moderation decision is enabled until the merchant submits a revision that can be inspected." /></Panel>}
            </>}
        </ConsoleWorkspace>
    );
}
