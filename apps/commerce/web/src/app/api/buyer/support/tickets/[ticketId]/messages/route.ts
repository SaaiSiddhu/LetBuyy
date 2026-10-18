// Public conversation messages for one of the signed-in buyer's own tickets.
import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';

const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ ticketId: string }> };

function projectMessages(value: unknown): Array<{ id: string; author_type: string; body: string; created_at: string }> | null {
    if (!Array.isArray(value)) return null;
    const output: Array<{ id: string; author_type: string; body: string; created_at: string }> = [];
    for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const row = item as Record<string, unknown>;
        if (typeof row.id !== 'string' || typeof row.author_type !== 'string' || typeof row.body !== 'string' || typeof row.created_at !== 'string') return null;
        output.push({ id: row.id, author_type: row.author_type, body: row.body, created_at: row.created_at });
    }
    return output;
}

async function resolveContext(context: Context) {
    const { ticketId } = await context.params;
    return UUID.test(ticketId) ? ticketId : null;
}

export async function GET(request: NextRequest, context: Context) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;
    const ticketId = await resolveContext(context);
    if (!ticketId) return NextResponse.json({ error: 'Invalid support request.' }, { status: 400, headers: NO_STORE });
    let response: Response;
    try {
        response = await storefrontApiFetch(`/storefront/buyer/support/tickets/${encodeURIComponent(ticketId)}/messages?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'GET', headers: session.headers, cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Messages could not be loaded right now.' }, { status: 503, headers: NO_STORE });
    }
    if (response.status === 401 || response.status === 403 || response.status === 404) return NextResponse.json({ error: response.status === 404 ? 'Support request not found.' : 'Not authenticated' }, { status: response.status, headers: NO_STORE });
    if (!response.ok) return NextResponse.json({ error: 'Messages could not be loaded right now.' }, { status: 503, headers: NO_STORE });
    const payload = await response.json().catch(() => null) as { data?: unknown } | null;
    const messages = projectMessages(payload?.data);
    if (!messages) return NextResponse.json({ error: 'Messages could not be loaded right now.' }, { status: 503, headers: NO_STORE });
    return NextResponse.json({ messages }, { headers: NO_STORE });
}

export async function POST(request: NextRequest, context: Context) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;
    const ticketId = await resolveContext(context);
    if (!ticketId) return NextResponse.json({ error: 'Invalid support request.' }, { status: 400, headers: NO_STORE });
    const body = await request.json().catch(() => null) as { body?: unknown } | null;
    const message = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!message || message.length > 4000) return NextResponse.json({ error: 'Enter a message of up to 4,000 characters.' }, { status: 400, headers: NO_STORE });
    let response: Response;
    try {
        response = await storefrontApiFetch(`/storefront/buyer/support/tickets/${encodeURIComponent(ticketId)}/messages?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'POST', headers: session.headers, body: JSON.stringify({ body: message }), cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Your message could not be sent right now. Please try again.' }, { status: 503, headers: NO_STORE });
    }
    if (response.status === 401 || response.status === 403 || response.status === 404) return NextResponse.json({ error: response.status === 404 ? 'Support request not found.' : 'Not authenticated' }, { status: response.status, headers: NO_STORE });
    if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: { message?: unknown } } | null;
        return NextResponse.json({ error: response.status < 500 && typeof failure?.error?.message === 'string' ? failure.error.message : 'Your message could not be sent right now. Please try again.' }, { status: response.status < 500 ? response.status : 503, headers: NO_STORE });
    }
    const payload = await response.json().catch(() => null) as { data?: unknown } | null;
    const messages = projectMessages([payload?.data]);
    if (!messages || messages.length !== 1) return NextResponse.json({ error: 'Your message could not be confirmed right now.' }, { status: 503, headers: NO_STORE });
    return NextResponse.json({ message: messages[0] }, { status: 201, headers: NO_STORE });
}
