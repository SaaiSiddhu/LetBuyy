// Only public conversation messages for the signed-in buyer's own ticket.
import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';
import { verifyExpectedBuyerIdentity } from '@/lib/buyer-auth/expected-buyer';
import { supportReceipt, validSupportKey, SUPPORT_UUID as UUID } from '@/lib/buyer-support-pending';
const NO_STORE = { 'Cache-Control': 'no-store' };
const fail = (error: string, status = 503) => NextResponse.json({ error }, { status, headers: NO_STORE });
const unavailable = 'Your message could not be confirmed. Check the saved action before sending again.';
 type Context = { params: Promise<{ ticketId: string }> };
function projectMessages(value: unknown, ticketId: string) {
    if (!Array.isArray(value)) return null;
    const output: Array<{ id: string; author_type: string; body: string; created_at: string }> = [];
    for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const row = item as Record<string, unknown>;
        if (typeof row.id !== 'string' || !UUID.test(row.id) || !['requester','agent','system'].includes(String(row.author_type)) || typeof row.body !== 'string' || typeof row.created_at !== 'string'
            || (row.visibility !== undefined && row.visibility !== 'public') || (row.ticket_id !== undefined && row.ticket_id !== ticketId)) return null;
        output.push({ id: row.id, author_type: row.author_type as string, body: row.body, created_at: row.created_at });
    }
    return output;
}
async function expected(session: { siteId: string; headers: Record<string,string> }, request: NextRequest) {
    return verifyExpectedBuyerIdentity(session, request.headers.get('x-letbuyy-expected-buyer-id'), {
        missing: 'Reload your account before sending.', unavailable: 'Your account could not be verified. Check your saved action before retrying.',
        changed: 'Your account changed. Reload before sending or recovering a support action.',
    });
}
export async function GET(request: NextRequest, context: Context) {
    const session = await resolveBuyerDataSession(request); if ('response' in session) return session.response;
    const { ticketId } = await context.params; if (!UUID.test(ticketId)) return fail('Invalid support request.', 400);
    if (request.headers.has('x-letbuyy-expected-buyer-id')) { const denial = await expected(session, request); if (denial) return denial; }
    const search = request.nextUrl.searchParams, rawLimit = search.get('limit') ?? '100', mode = search.get('pagination'), cursor = search.get('cursor');
    if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || (mode !== null && mode !== 'cursor') || (cursor !== null && (mode !== 'cursor' || !cursor || cursor.length > 1024))) return fail('Invalid support history request.', 400);
    const query = new URLSearchParams({ store_id: session.siteId });
    if (mode) { query.set('pagination', mode); query.set('limit', String(Math.min(Number(rawLimit), 200))); } if (cursor) query.set('cursor', cursor);
    let response: Response;
    try { response = await storefrontApiFetch(`/storefront/buyer/support/tickets/${ticketId}/messages?${query}`, { method: 'GET', headers: session.headers, cache: 'no-store' }); }
    catch { return fail('Messages could not be loaded right now.'); }
    if ([400,401,403,404,409].includes(response.status)) return fail('Your account or support request could not be verified.', response.status);
    if (!response.ok) return fail('Messages could not be loaded right now.');
    const payload = await response.json().catch(() => null), data = payload?.data;
    const messages = projectMessages(mode ? data?.items : data, ticketId);
    if (!messages || (mode && (typeof data.has_more !== 'boolean' || (data.has_more ? typeof data.next_cursor !== 'string' || !data.next_cursor : data.next_cursor !== null)))) return fail('Messages could not be loaded right now.');
    return NextResponse.json({ messages, ...(mode ? { hasMore: data.has_more, nextCursor: data.next_cursor } : {}) }, { headers: NO_STORE });
}
export async function POST(request: NextRequest, context: Context) {
    const session = await resolveBuyerDataSession(request); if ('response' in session) return session.response;
    const { ticketId } = await context.params; if (!UUID.test(ticketId)) return fail('Invalid support request.', 400);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('A JSON object is required.', 400);
    const recovering = body.action === 'recover'; if (body.action !== undefined && !recovering) return fail('Invalid support action.', 400);
    const canonical = request.headers.get('X-Idempotency-Key'), conventional = request.headers.get('Idempotency-Key'), key = recovering ? body.key : canonical ?? conventional;
    if ((canonical !== null && conventional !== null && canonical !== conventional) || (key !== null && !validSupportKey(key)) || (recovering && !validSupportKey(key))) return fail('Invalid support request key.', 400);
    const message = typeof body.body === 'string' ? body.body.trim() : '';
    if (!recovering && (!message || message.length > 4000)) return fail('Enter a message of up to 4,000 characters.', 400);
    const denial = await expected(session, request); if (denial) return denial;
    let response: Response;
    try { response = await storefrontApiFetch(`/storefront/buyer/support/tickets${recovering ? '/recovery' : `/${ticketId}/messages`}?store_id=${encodeURIComponent(session.siteId)}`, {
        method: 'POST', headers: { ...session.headers, ...(!recovering && key ? { 'X-Idempotency-Key': key } : {}) },
        body: JSON.stringify(recovering ? { operation: 'reply', target_id: ticketId, key } : { body: message }), cache: 'no-store',
    }); } catch { return fail(unavailable); }
    if (!response.ok) {
        const failure = await response.json().catch(() => null);
        return fail(response.status < 500 && typeof failure?.error?.message === 'string' ? failure.error.message : unavailable, response.status < 500 ? response.status : 503);
    }
    const payload = await response.json().catch(() => null), data = payload?.data, messages = projectMessages([data], ticketId), result = messages?.[0];
    if (!result || result.author_type !== 'requester' || (!recovering && result.body !== message)) return fail(unavailable);
    const receipt = key ? supportReceipt(data.mutation_receipt, key, 'reply', ticketId, result.id) : null;
    if (key && (!receipt || Date.parse(receipt.confirmed_at) !== Date.parse(result.created_at))) return fail(unavailable);
    return NextResponse.json({ message: result, ...(receipt ? { mutationReceipt: receipt } : {}) }, { status: recovering ? 200 : 201, headers: NO_STORE });
}
