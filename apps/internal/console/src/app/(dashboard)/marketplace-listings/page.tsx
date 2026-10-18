// CAP-ADM-2 — the marketplace listing moderation queue.
//
// This is the last link in a chain that is otherwise complete and entirely inert without it.
// transition_channel_listing (migration 217), the marketplace feed and detail routes (MKT-2/MKT-3),
// the operator API (PHASE-ADM-1) and customer_app's reader (FB-2) all exist — but nothing could move
// a listing to 'approved', so the feed returned zero rows forever. FB-1 then deleted the Firestore
// admin_app that used to hold these queues, leaving no operator UI at all.
//
// No API route is added. letbuyy-boundaries/no-new-next-api-route freezes those, and this page does
// not need one: reads go through the server-side fetchConsoleApi helper and writes are server
// actions, the pattern the compliance, developers, employees, incidents and merchants pages already
// use. A server action is not an API route, so the freeze is respected rather than exempted.

import Link from 'next/link';
import {
    ConsoleWorkspace,
    EmptyDataState,
    LeadershipMetric,
    MetricGrid,
    Panel,
    StatusPill,
} from '@/components/_local-ui/console-workspace';
import { fetchConsoleApi, formatDateTime } from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';

const REVIEW_QUEUE_STATUS = 'pending_review';

interface ListingRow {
    id: string;
    site_id: string;
    status: string;
    submitted_at: string | null;
    products?: { name?: string | null; slug?: string | null } | null;
    sites?: { store_name?: string | null; subdomain?: string | null } | null;
}

interface ListResponse {
    data?: ListingRow[];
    meta?: { total?: number };
    error?: string;
}

// ---------------------------------------------------------------------------
// Server action — decisions are made from the evidence/detail page.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

export default async function MarketplaceListingsPage() {
    await requireConsoleSession();

    const response = await fetchConsoleApi<ListResponse>('/operations/marketplace-listings', {
        query: { status: REVIEW_QUEUE_STATUS, limit: 50 },
    });

    const listings = response.data?.data ?? [];
    const total = response.data?.meta?.total ?? listings.length;

    return (
        <ConsoleWorkspace
            eyebrow="Marketplace"
            title="Marketplace Listings"
            description="Merchant submissions waiting on an operator decision. Nothing reaches the marketplace feed until it is approved here."
        >
            {response.error ? (
                <Panel title="Listing queue unavailable" description={response.error}>
                    <EmptyDataState message="The operations API did not return a listing queue." />
                </Panel>
            ) : (
                <>
                    <MetricGrid>
                        <LeadershipMetric label="Awaiting review" value={String(total)} />
                        <LeadershipMetric label="Shown" value={String(listings.length)} />
                    </MetricGrid>

                    <Panel
                        title="Pending review"
                        description="Approve publishes to the marketplace feed. Reject and take down both require a reason, which is recorded against the listing."
                    >
                        {listings.length === 0 ? (
                            <EmptyDataState message="No listings are waiting for review." />
                        ) : (
                            <ul>
                                {listings.map((listing) => (
                                    <li key={listing.id}>
                                        <div>
                                            <StatusPill value={listing.status} />
                                            <strong>{listing.products?.name || 'Untitled product'}</strong>
                                            <span>
                                                {listing.sites?.store_name || 'Unknown store'}
                                                {listing.sites?.subdomain ? ` (${listing.sites.subdomain})` : ''}
                                            </span>
                                            <span>Submitted {formatDateTime(listing.submitted_at)}</span>
                                        </div>

                                        <Link href={`/marketplace-listings/${listing.id}`} className="font-medium text-[var(--lb-color-primary)] underline-offset-4 hover:underline">
                                            Review listing
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </>
            )}
        </ConsoleWorkspace>
    );
}
