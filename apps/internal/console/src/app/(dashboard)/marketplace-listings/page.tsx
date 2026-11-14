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
import { ConsoleApiErrorPanel, ConsoleDataTable, type ConsoleDataColumn } from '@/components/ConsoleDataTable';
import { readPageParam, type ConsolePagination } from '@/lib/console-api';
import {
    ConsoleWorkspace,
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
    meta?: ConsolePagination;
    error?: string;
}

// ---------------------------------------------------------------------------
// Server action — decisions are made from the evidence/detail page.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

export default async function MarketplaceListingsPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
    const page = readPageParam(await searchParams);
    await requireConsoleSession();

    const response = await fetchConsoleApi<ListResponse>('/operations/marketplace-listings', {
        query: { status: REVIEW_QUEUE_STATUS, limit: 25, page },
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
                <ConsoleApiErrorPanel title="Listing queue unavailable" message={response.error} />
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
                        <ConsoleDataTable columns={listingColumns} rows={listings} meta={response.data?.meta}
                            basePath="/marketplace-listings" emptyLabel="No listings are waiting for review." getRowKey={row=>row.id} />
                    </Panel>
                </>
            )}
        </ConsoleWorkspace>
    );
}

const listingColumns: ConsoleDataColumn<ListingRow>[] = [
    {key:'product',header:'Product',cell:row=><strong>{row.products?.name || 'Untitled product'}</strong>},
    {key:'store',header:'Store',cell:row=>row.sites?.store_name || row.sites?.subdomain || row.site_id},
    {key:'status',header:'Status',cell:row=><StatusPill value={row.status}/>},
    {key:'submitted',header:'Submitted',cell:row=>formatDateTime(row.submitted_at)},
    {key:'action',header:'Review',cell:row=><Link href={`/marketplace-listings/${row.id}`} className="font-medium text-primary underline">Review listing</Link>},
];
