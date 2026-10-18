// Buyer support is proxied through the host-bound canonical buyer session.
// The store id is resolved from the request host and never accepted from browser JSON.
import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';

const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Ticket = {
    id: string;
    ticket_ref: string | null;
    subject: string | null;
    status: string;
    topic: string | null;
    created_at: string;
    last_agent_message_at: string | null;
};

function projectTicket(value: unknown): Ticket | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (typeof row.id !== 'string' || !UUID.test(row.id) || typeof row.status !== 'string' || typeof row.created_at !== 'string') return null;
    return {
        id: row.id,
        ticket_ref: typeof row.ticket_ref === 'string' ? row.ticket_ref : null,
        subject: typeof row.subject === 'string' ? row.subject : null,
        status: row.status,
        topic: typeof row.topic === 'string' ? row.topic : null,
        created_at: row.created_at,
        last_agent_message_at: typeof row.last_agent_message_at === 'string' ? row.last_agent_message_at : null,
    };
}

export async function GET(request: NextRequest) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;
    const rawLimit = request.nextUrl.searchParams.get('limit');
    const parsed = rawLimit === null ? 20 : Number.parseInt(rawLimit, 10);
    if (!Number.isInteger(parsed) || parsed < 1) return NextResponse.json({ error: 'limit must be a positive integer.' }, { status: 400, headers: NO_STORE });
    const limit = Math.min(parsed, 50);

    let response: Response;
    try {
        response = await storefrontApiFetch(`/storefront/buyer/support/tickets?store_id=${encodeURIComponent(session.siteId)}&limit=${limit}`, {
            method: 'GET', headers: session.headers, cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Your support requests could not be loaded right now.' }, { status: 503, headers: NO_STORE });
    }
    if (response.status === 401 || response.status === 403) return NextResponse.json({ error: 'Not authenticated' }, { status: response.status, headers: NO_STORE });
    if (!response.ok) return NextResponse.json({ error: 'Your support requests could not be loaded right now.' }, { status: 503, headers: NO_STORE });
    const payload = await response.json().catch(() => null) as { data?: unknown } | null;
    if (!Array.isArray(payload?.data)) return NextResponse.json({ error: 'Your support requests could not be loaded right now.' }, { status: 503, headers: NO_STORE });
    const tickets = payload.data.map(projectTicket);
    if (tickets.some((ticket) => !ticket)) return NextResponse.json({ error: 'Your support requests could not be loaded right now.' }, { status: 503, headers: NO_STORE });
    return NextResponse.json({ tickets }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;
    const body = await request.json().catch(() => null) as { subject?: unknown; body?: unknown } | null;
    if (!body) return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400, headers: NO_STORE });
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body.body === 'string' ? body.body.trim() : '';
    if (!subject || subject.length > 200) return NextResponse.json({ error: 'Enter a subject of up to 200 characters.' }, { status: 400, headers: NO_STORE });
    if (!message || message.length > 4000) return NextResponse.json({ error: 'Enter a message of up to 4,000 characters.' }, { status: 400, headers: NO_STORE });

    let response: Response;
    try {
        response = await storefrontApiFetch(`/storefront/buyer/support/tickets?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'POST',
            headers: session.headers,
            body: JSON.stringify({ subject, body: message, site_id: session.siteId }),
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Your support request could not be sent right now. Please try again.' }, { status: 503, headers: NO_STORE });
    }
    if (response.status === 401 || response.status === 403) return NextResponse.json({ error: 'Not authenticated' }, { status: response.status, headers: NO_STORE });
    if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: { message?: unknown } } | null;
        return NextResponse.json({ error: response.status < 500 && typeof failure?.error?.message === 'string' ? failure.error.message : 'Your support request could not be sent right now. Please try again.' }, {
            status: response.status < 500 ? response.status : 503, headers: NO_STORE,
        });
    }
    const payload = await response.json().catch(() => null) as { data?: Record<string, unknown> } | null;
    const data = payload?.data;
    const ticket = projectTicket(data);
    const copy = data?.complaint_copy;
    if (!ticket || !copy || typeof copy !== 'object' || Array.isArray(copy)) return NextResponse.json({ error: 'Your support request could not be confirmed right now.' }, { status: 503, headers: NO_STORE });
    const complaint = copy as Record<string, unknown>;
    if (typeof complaint.subject !== 'string' || typeof complaint.body !== 'string' || typeof complaint.recorded_at !== 'string') return NextResponse.json({ error: 'Your support request could not be confirmed right now.' }, { status: 503, headers: NO_STORE });
    return NextResponse.json({ ticket, complaintCopy: { subject: complaint.subject, body: complaint.body, recordedAt: complaint.recorded_at }, receiptConfirmedAt: typeof data?.receipt_confirmed_at === 'string' ? data.receipt_confirmed_at : complaint.recorded_at }, { status: 201, headers: NO_STORE });
}
