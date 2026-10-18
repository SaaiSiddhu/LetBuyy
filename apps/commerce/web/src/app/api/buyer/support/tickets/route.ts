// Host-bound canonical buyer session; browser JSON never selects the store.
import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';
import { verifyExpectedBuyerIdentity } from '@/lib/buyer-auth/expected-buyer';
import { supportReceipt, validSupportKey, SUPPORT_UUID as UUID } from '@/lib/buyer-support-pending';

const NO_STORE = { 'Cache-Control': 'no-store' };
const fail = (error: string, status = 503) => NextResponse.json({ error }, { status, headers: NO_STORE });
const unavailable = 'Your support request could not be confirmed. Check the saved action before sending again.';
function projectTicket(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (typeof row.id !== 'string' || !UUID.test(row.id) || typeof row.status !== 'string' || typeof row.created_at !== 'string') return null;
    return { id: row.id, ticket_ref: typeof row.ticket_ref === 'string' ? row.ticket_ref : null,
        subject: typeof row.subject === 'string' ? row.subject : null, status: row.status,
        topic: typeof row.topic === 'string' ? row.topic : null, created_at: row.created_at,
        last_agent_message_at: typeof row.last_agent_message_at === 'string' ? row.last_agent_message_at : null };
}
async function expected(session: { siteId: string; headers: Record<string,string> }, request: NextRequest) {
    return verifyExpectedBuyerIdentity(session, request.headers.get('x-letbuyy-expected-buyer-id'), {
        missing: 'Reload your account before sending.', unavailable: 'Your account could not be verified. Check your saved action before retrying.',
        changed: 'Your account changed. Reload before sending or recovering a support action.',
    });
}
export async function GET(request: NextRequest) {
    const session = await resolveBuyerDataSession(request); if ('response' in session) return session.response;
    if (request.headers.has('x-letbuyy-expected-buyer-id')) { const denial = await expected(session, request); if (denial) return denial; }
    const search = request.nextUrl.searchParams, rawLimit = search.get('limit') ?? '20', mode = search.get('pagination'), cursor = search.get('cursor');
    if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || (mode !== null && mode !== 'cursor') || (cursor !== null && (mode !== 'cursor' || !cursor || cursor.length > 1024))) return fail('Invalid support history request.', 400);
    const query = new URLSearchParams({ store_id: session.siteId, limit: String(Math.min(Number(rawLimit), 50)) });
    if (mode) query.set('pagination', mode); if (cursor) query.set('cursor', cursor);
    let response: Response;
    try { response = await storefrontApiFetch(`/storefront/buyer/support/tickets?${query}`, { method: 'GET', headers: session.headers, cache: 'no-store' }); }
    catch { return fail('Your support requests could not be loaded right now.'); }
    if ([400,401,403,409].includes(response.status)) return fail('Your account or support history request could not be verified.', response.status);
    if (!response.ok) return fail('Your support requests could not be loaded right now.');
    const payload = await response.json().catch(() => null), data = payload?.data;
    const rows = mode ? data?.items : data;
    if (!Array.isArray(rows)) return fail('Your support requests could not be loaded right now.');
    const tickets = rows.map(projectTicket); if (tickets.some(ticket => !ticket)) return fail('Your support requests could not be loaded right now.');
    if (mode && (typeof data.has_more !== 'boolean' || (data.has_more ? typeof data.next_cursor !== 'string' || !data.next_cursor : data.next_cursor !== null))) return fail('Your support requests could not be loaded right now.');
    return NextResponse.json({ tickets, ...(mode ? { hasMore: data.has_more, nextCursor: data.next_cursor } : {}) }, { headers: NO_STORE });
}
export async function POST(request: NextRequest) {
    const session = await resolveBuyerDataSession(request); if ('response' in session) return session.response;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('A JSON object is required.', 400);
    const recovering = body.action === 'recover';
    if (body.action !== undefined && !recovering) return fail('Invalid support action.', 400);
    const canonical = request.headers.get('X-Idempotency-Key'), conventional = request.headers.get('Idempotency-Key');
    const key = recovering ? body.key : canonical ?? conventional;
    if ((canonical !== null && conventional !== null && canonical !== conventional) || (key !== null && !validSupportKey(key)) || (recovering && !validSupportKey(key))) return fail('Invalid support request key.', 400);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '', message = typeof body.body === 'string' ? body.body.trim() : '';
    if (!recovering && (!subject || subject.length > 200 || !message || message.length > 4000)) return fail('Enter a subject of up to 200 characters and a message of up to 4,000 characters.', 400);
    const denial = await expected(session, request); if (denial) return denial;
    let response: Response;
    try { response = await storefrontApiFetch(`/storefront/buyer/support/tickets${recovering ? '/recovery' : ''}?store_id=${encodeURIComponent(session.siteId)}`, {
        method: 'POST', headers: { ...session.headers, ...(!recovering && key ? { 'X-Idempotency-Key': key } : {}) },
        body: JSON.stringify(recovering ? { operation: 'create', target_id: null, key } : { subject, body: message, site_id: session.siteId }), cache: 'no-store',
    }); } catch { return fail(unavailable); }
    if (!response.ok) {
        const failure = await response.json().catch(() => null);
        return fail(response.status < 500 && typeof failure?.error?.message === 'string' ? failure.error.message : unavailable, response.status < 500 ? response.status : 503);
    }
    const payload = await response.json().catch(() => null), data = payload?.data, ticket = projectTicket(data), complaint = data?.complaint_copy;
    if (!ticket || !complaint || typeof complaint.subject !== 'string' || typeof complaint.body !== 'string' || typeof complaint.recorded_at !== 'string' || ticket.subject !== complaint.subject
        || (!recovering && (complaint.subject !== subject || complaint.body !== message))) return fail(unavailable);
    const receipt = key ? supportReceipt(data.mutation_receipt, key, 'create', ticket.id) : null;
    if (key && (!receipt || Date.parse(receipt.confirmed_at) !== Date.parse(complaint.recorded_at))) return fail(unavailable);
    return NextResponse.json({ ticket, complaintCopy: { subject: complaint.subject, body: complaint.body, recordedAt: complaint.recorded_at },
        receiptConfirmedAt: receipt?.confirmed_at ?? complaint.recorded_at, ...(receipt ? { mutationReceipt: receipt } : {}) }, { status: recovering ? 200 : 201, headers: NO_STORE });
}
